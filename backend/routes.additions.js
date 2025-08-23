/**
 * Paste these into your existing routes.js (inside the same Express router).
 * Requires: db pool (./db), mailer (./mailer), authUtil (./authUtil)
 */
const pool = require('./db');
const { sendMail } = require('./mailer');
const {
  validatePasswordPolicy, signAuthToken, signSetPasswordToken,
  verifyToken, buildSetPasswordUrl, hashPassword
} = require('./authUtil');

// Admin exists gate
router.get('/system/admin-exists', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
    res.json({ exists: rows.length > 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// One-time admin creation
router.post('/createAdmin', async (req, res) => {
  const { firstName, lastName, email } = req.body || {};
  if (!firstName || !lastName || !email) return res.status(400).json({ error: 'Missing data' });

  const conn = await pool.getConnection();
  try {
    const [adm] = await conn.query(`SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
    if (adm.length) return res.status(403).json({ error: 'Admin already exists.' });

    await conn.beginTransaction();
    const [ind] = await conn.query(
      `INSERT INTO individual (first_name, last_name, grade, special, created_at) VALUES (?,?, 'Adult', 1, CURRENT_TIMESTAMP)`,
      [firstName, lastName]
    );
    const individualId = ind.insertId;

    const [cred] = await conn.query(
      `INSERT INTO credentials (individual_id, email, password_hash, is_active, created_at) VALUES (?, ?, NULL, 0, CURRENT_TIMESTAMP)`,
      [individualId, email]
    );
    const credentialsId = cred.insertId;

    const [natRows] = await conn.query(`SELECT id FROM entity WHERE level='NATIONAL' LIMIT 1`);
    let nationalId = natRows[0]?.id;
    if (!nationalId) {
      const [nat] = await conn.query(
        `INSERT INTO entity (name, level, created_at) VALUES ('National Office', 'NATIONAL', CURRENT_TIMESTAMP)`
      );
      nationalId = nat.insertId;
    }

    await conn.query(
      `INSERT INTO role_assignment (individual_id, target_type, target_id, role, active, created_at, updated_at)
       VALUES (?, 'ENTITY', ?, 'ADMIN', '9999-12-31', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [individualId, nationalId]
    );

    const token = signSetPasswordToken(credentialsId);
    const url = buildSetPasswordUrl(token);
    await sendMail({
      to: email,
      subject: 'KidsMin Portal — Set your password',
      text: `Set your password: ${url}`,
      html: `<p><a href="${url}">Click here to set your password</a> (valid 24h).</p>`
    });

    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message });
  } finally { conn.release(); }
});

// Create Individual
router.post('/individuals', async (req, res) => {
  const { firstName, lastName, grade, special, createdBy } = req.body || {};
  if (!firstName || !lastName || !grade) return res.status(400).json({ error: 'Missing data' });
  try {
    const [ins] = await pool.query(
      `INSERT INTO individual (first_name, last_name, grade, special, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [firstName, lastName, grade, special ? 1 : 0, createdBy || null]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Invite existing individual
router.post('/auth/invite', async (req, res) => {
  const { individualId, email } = req.body || {};
  if (!individualId || !email) return res.status(400).json({ error: 'Missing data' });
  try {
    const [rows] = await pool.query(`SELECT id FROM credentials WHERE individual_id=? LIMIT 1`, [individualId]);
    let credId = rows[0]?.id;
    if (!credId) {
      const [ins] = await pool.query(
        `INSERT INTO credentials (individual_id, email, password_hash, is_active, created_at)
         VALUES (?, ?, NULL, 0, CURRENT_TIMESTAMP)`,
        [individualId, email]
      );
      credId = ins.insertId;
    } else {
      await pool.query(`UPDATE credentials SET email=? WHERE id=?`, [email, credId]);
    }
    const token = signSetPasswordToken(credId);
    const url = buildSetPasswordUrl(token);
    await sendMail({ to: email, subject: 'KidsMin Portal — Set your password', text: url, html: `<a href="${url}">${url}</a>` });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Set/Reset password
router.post('/auth/set-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Missing data' });
  if (!validatePasswordPolicy(password)) return res.status(422).json({ error: 'Weak password' });
  try {
    const decoded = verifyToken(token);
    if (decoded.typ !== 'setpwd' || !decoded.cid) throw new Error('Invalid token');
    const hash = await hashPassword(password);
    await pool.query(`UPDATE credentials SET password_hash=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [hash, decoded.cid]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing data' });
  try {
    const [rows] = await pool.query(
      `SELECT c.id credId, c.password_hash, c.is_active, i.id individualId
       FROM credentials c JOIN individual i ON i.id=c.individual_id WHERE c.email=? LIMIT 1`,
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const bcrypt = require('bcrypt');
    const { password_hash, is_active, individualId, credId } = rows[0];
    const ok = await bcrypt.compare(password, password_hash || '');
    if (!ok || !is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const [roles] = await pool.query(
      `SELECT ra.target_type AS targetType, ra.target_id AS targetId, e.name AS targetName, e.level AS targetLevel,
              ra.role, ra.active, ra.created_at AS createdAt, ra.updated_at AS updatedAt
       FROM role_assignment ra LEFT JOIN entity e ON e.id=ra.target_id
       WHERE ra.individual_id=? AND ra.active='9999-12-31'`,
      [individualId]
    );
    const token = require('./authUtil').signAuthToken({ sub: String(individualId), cred: String(credId) });
    res.json({ token, roles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
