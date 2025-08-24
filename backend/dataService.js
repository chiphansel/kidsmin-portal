// DROP-IN: Centralized DB access helpers for KidsMin API
// Uses mysql2/promise pool from ./db

const pool = require('./db');

// ---------- small helpers ----------
async function q(conn, sql, params = []) {
  // Run on a transaction connection if provided, otherwise on the pool
  if (conn && typeof conn.query === 'function') {
    return conn.query(sql, params);
  }
  return pool.query(sql, params);
}

async function withTransaction(taskFn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await taskFn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// ---------- health ----------
async function ping() {
  const [rows] = await q(null, 'SELECT 1');
  return rows;
}

// ---------- admin bootstrap / existence ----------
async function adminExists() {
  const [rows] = await q(null, `SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
  return rows.length > 0;
}

async function ensureNationalEntity(conn) {
  const [rows] = await q(conn, `SELECT id FROM entity WHERE level='NATIONAL' LIMIT 1`);
  if (rows.length) return rows[0].id;

  const [ins] = await q(conn, `
    INSERT INTO entity (name, level, created_at)
    VALUES ('National Office', 'NATIONAL', CURRENT_TIMESTAMP)
  `);
  return ins.insertId;
}

async function assignRole(conn, { individualId, targetType = 'ENTITY', targetId, role }) {
  if (!individualId || !targetId || !role) {
    throw new Error('assignRole requires individualId, targetId, role');
  }
  const [ins] = await q(conn, `
    INSERT INTO role_assignment
      (individual_id, target_type, target_id, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, '9999-12-31', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [individualId, targetType, targetId, role]);
  return ins.insertId;
}

// ---------- individuals ----------
async function createIndividual(conn, { firstName, lastName, grade = 'Adult', special = false, createdBy = null }) {
  if (!firstName || !lastName || !grade) {
    throw new Error('Missing firstName, lastName, or grade');
  }
  const [ins] = await q(conn, `
    INSERT INTO individual
      (first_name, last_name, grade, special, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [firstName, lastName, grade, special ? 1 : 0, createdBy]);
  return ins.insertId;
}

async function getIndividualById(id) {
  const [rows] = await q(null, `SELECT * FROM individual WHERE id=?`, [id]);
  return rows[0] || null;
}

// ---------- credentials ----------
async function getCredentialsByEmail(email) {
  const [rows] = await q(null, `
    SELECT c.*, i.id AS individualId
      FROM credentials c
      JOIN individual i ON i.id = c.individual_id
     WHERE c.email = ?
     LIMIT 1
  `, [email]);
  return rows[0] || null;
}

async function getCredentialsByIndividualId(individualId) {
  const [rows] = await q(null, `
    SELECT * FROM credentials WHERE individual_id=? LIMIT 1
  `, [individualId]);
  return rows[0] || null;
}

async function upsertCredentialsForIndividual(conn, { individualId, email }) {
  if (!individualId || !email) {
    throw new Error('upsertCredentialsForIndividual requires individualId and email');
  }
  const [rows] = await q(conn, `SELECT id FROM credentials WHERE individual_id=? LIMIT 1`, [individualId]);
  if (rows.length) {
    const credId = rows[0].id;
    await q(conn, `UPDATE credentials SET email=? WHERE id=?`, [email, credId]);
    return credId;
  }
  const [ins] = await q(conn, `
    INSERT INTO credentials
      (individual_id, email, password_hash, is_active, created_at)
    VALUES (?, ?, NULL, 0, CURRENT_TIMESTAMP)
  `, [individualId, email]);
  return ins.insertId;
}

async function insertCredentials(conn, { individualId, email }) {
  const [ins] = await q(conn, `
    INSERT INTO credentials
      (individual_id, email, password_hash, is_active, created_at)
    VALUES (?, ?, NULL, 0, CURRENT_TIMESTAMP)
  `, [individualId, email]);
  return ins.insertId;
}

async function setCredentialPasswordActive(conn, { credentialsId, passwordHash }) {
  if (!credentialsId || !passwordHash) {
    throw new Error('setCredentialPasswordActive requires credentialsId and passwordHash');
  }
  await q(conn, `
    UPDATE credentials
       SET password_hash=?, is_active=1, updated_at=CURRENT_TIMESTAMP
     WHERE id=?
  `, [passwordHash, credentialsId]);
}

// ---------- roles for menu/dashboard ----------
async function getActiveRolesForIndividual(individualId) {
  const [rows] = await q(null, `
    SELECT
      ra.target_type AS targetType,
      ra.target_id   AS targetId,
      e.name         AS targetName,
      e.level        AS targetLevel,
      ra.role,
      ra.active,
      ra.created_at  AS createdAt,
      ra.updated_at  AS updatedAt
    FROM role_assignment ra
    LEFT JOIN entity e ON e.id = ra.target_id
    WHERE ra.individual_id = ?
      AND ra.active = '9999-12-31'
  `, [individualId]);
  return rows;
}

// ---------- login helper ----------
async function getLoginRowByEmail(email) {
  const [rows] = await q(null, `
    SELECT
      c.id            AS credId,
      c.password_hash AS password_hash,
      c.is_active     AS is_active,
      i.id            AS individualId
    FROM credentials c
    JOIN individual i ON i.id = c.individual_id
    WHERE c.email = ?
    LIMIT 1
  `, [email]);
  return rows[0] || null;
}

module.exports = {
  // infra
  ping,
  withTransaction,

  // admin/bootstrap
  adminExists,
  ensureNationalEntity,
  assignRole,

  // individuals
  createIndividual,
  getIndividualById,

  // credentials
  getCredentialsByEmail,
  getCredentialsByIndividualId,
  upsertCredentialsForIndividual,
  insertCredentials,
  setCredentialPasswordActive,

  // roles
  getActiveRolesForIndividual,

  // login helper
  getLoginRowByEmail
};
