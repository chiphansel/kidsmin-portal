// dataService.js
const pool   = require('./db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { jwtSecret, frontendUrl } = require('./config');

// --- Authenticate via stored proc (email + password) → JWT + roles ---
async function authenticate({ email, password }) {
  const [resultSets] = await pool.execute(
    'CALL sp_authenticate(?,?)',
    [email, password]
  );

  const [profile] = resultSets[0];
  if (!profile) throw new Error('Invalid credentials');

  const token = jwt.sign({ sub: profile.id }, jwtSecret, { expiresIn: '1h' });

  const roles = resultSets[1].map(r => ({
    targetType: r.target_type,
    targetId:   r.targetId,
    targetName: r.targetName,
    role:       r.role,
    active:     r.active,
    createdAt:  r.created_at,
    updatedAt:  r.updated_at
  }));

  return { token, roles };
}

// --- Refresh an existing JWT ---
function refreshToken(oldToken) {
  try {
    const { sub } = jwt.verify(oldToken, jwtSecret);
    return jwt.sign({ sub }, jwtSecret, { expiresIn: '1h' });
  } catch {
    throw new Error('Invalid token');
  }
}

// --- Create a brand-new user (individual + credentials + JWT) ---
async function createUser({ firstName, lastName, grade, special, email, password, createdBy }) {
  const id = uuidv4();
  await pool.execute(
    'CALL sp_create_individual(?,?,?,?,?,?)',
    [id, firstName, lastName, grade, special ? 1 : 0, createdBy]
  );
  const hash = await bcrypt.hash(password, 12);
  await pool.execute(
    'CALL sp_create_credentials(?,?,?,?)',
    [id, email, hash, createdBy]
  );
  const token = jwt.sign({ sub: id }, jwtSecret, { expiresIn: '1h' });
  return { id, token };
}

// --- Create credentials for an existing individual + return JWT + message ---
async function createCredentialsForExistingIndividual({ individualId, email, password }) {
  const [[ind]] = await pool.execute(
    'SELECT first_name, last_name FROM individual WHERE id = UUID_TO_BIN(?,1) LIMIT 1',
    [individualId]
  );
  if (!ind) throw new Error(`No individual found with id ${individualId}`);
  const fullName = `${ind.first_name} ${ind.last_name}`;

  const hash = await bcrypt.hash(password, 12);
  await pool.execute(
    'CALL sp_create_credentials(?,?,?,?)',
    [individualId, email, hash, individualId]
  );

  const token = jwt.sign({ sub: individualId }, jwtSecret, { expiresIn: '1h' });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const loginUrl  = `${frontendUrl}/login?token=${token}`;
  const message   = `
Hello ${fullName},

Your credentials have been created. Please log in before ${expiresAt.toLocaleString()}:

${loginUrl}

If you did not request this, please ignore.
  `.trim();

  return { id: individualId, name: fullName, email, token, loginUrl, expiresAt, message };
}

// --- Helpers to fetch ENUM values from MySQL ---
async function getEntityTypes() {
  const [[col]] = await pool.query("SHOW COLUMNS FROM entity LIKE 'type'");
  return col.Type
    .match(/^enum\((.*)\)$/)[1]
    .split(',')
    .map(s => s.slice(1, -1));
}

async function getIndividualGrades() {
  const [[col]] = await pool.query("SHOW COLUMNS FROM individual LIKE 'grade'");
  return col.Type
    .match(/^enum\((.*)\)$/)[1]
    .split(',')
    .map(s => s.slice(1, -1));
}

async function getRoleAssignmentRoles() {
  const [[col]] = await pool.query("SHOW COLUMNS FROM role_assignment LIKE 'role'");
  return col.Type
    .match(/^enum\((.*)\)$/)[1]
    .split(',')
    .map(s => s.slice(1, -1));
}

// --- NEW: Helper to fetch all state_province values ---
async function getStateProvinces() {
  const [[col]] = await pool.query("SHOW COLUMNS FROM address LIKE 'state_province'");
  return col.Type
    .match(/^enum\((.*)\)$/)[1]
    .split(',')
    .map(s => s.slice(1, -1));
}

// --- Create a new individual ---
async function createIndividual({ firstName, lastName, grade, special, createdBy }) {
  const id = uuidv4();
  await pool.execute(`
    INSERT INTO individual
      (id, first_name, last_name, grade, special, created_by, active, created_at, updated_at)
    VALUES
      (UUID_TO_BIN(?,1), ?, ?, ?, ?, UUID_TO_BIN(?,1), '9999-12-31', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [id, firstName, lastName, grade, special ? 1 : 0, createdBy]);
  return id;
}

// --- Create a new entity ---
async function createEntity({ name, addressId, supportOrganizationId, type, denominationId, createdBy }) {
  const id = uuidv4();
  await pool.execute(`
    INSERT INTO entity
      (id, name, address_id, support_organization_id, type, denomination_id, created_by, active, created_at, updated_at)
    VALUES
      (UUID_TO_BIN(?,1), ?, UUID_TO_BIN(?,1), IF(? IS NULL, NULL, UUID_TO_BIN(?,1)), ?, ?, UUID_TO_BIN(?,1), '9999-12-31', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [id, name, addressId, supportOrganizationId, type, denominationId, createdBy]);
  return id;
}

// --- Create a new event ---
async function createEvent({ title, type, denominationId, addressId, supportOrganizationId, startDate, endDate, start, finish, comments, createdBy }) {
  const id = uuidv4();
  await pool.execute(`
    INSERT INTO event
      (id, title, type, denomination_id, address_id, support_organization_id, start_date, end_date, start, finish, comments, created_by, created_at, updated_at)
    VALUES
      (UUID_TO_BIN(?,1), ?, ?, ?, UUID_TO_BIN(?,1), IF(? IS NULL, NULL, UUID_TO_BIN(?,1)), ?, ?, ?, ?, ?, UUID_TO_BIN(?,1), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [id, title, type, denominationId, addressId, supportOrganizationId, startDate, endDate, start, finish, comments, createdBy]);
  return id;
}

module.exports = {
  authenticate,
  refreshToken,
  createUser,
  createCredentialsForExistingIndividual,
  getEntityTypes,
  getIndividualGrades,
  getRoleAssignmentRoles,
  getStateProvinces,
  createIndividual,
  createEntity,
  createEvent
};
