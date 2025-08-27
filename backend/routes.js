// backend/routes.js
const express = require('express');
const router = express.Router();

const { sendMail } = require('./mailer');
const {
  validatePasswordPolicy, signAuthToken, signSetPasswordToken,
  verifyToken, buildSetPasswordUrl, hashPassword
} = require('./authUtil');
const { requireAuth } = require('./authMiddleware');

// --- helpers ---
function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}
function isValidGrade(g) {
  const v = String(g || '');
  return ['Adult', '12', '11', '10', '9'].includes(v);
}

// --- extra health (optional alongside /healthz) ---
router.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});

// --- admin exists gate ---
router.get('/system/admin-exists', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
    res.json({ exists: rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- one-time admin creation ---
router.post('/createAdmin', async (req, res) => {
  let { firstName, lastName, email } = req.body || {};
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing firstName, lastName, or email.' });
  }
  email = normalizeEmail(email);

  const conn = await pool.getConnection();
  try {
    const [adm] = await conn.query(`SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
    if (adm.length) return res.status(403).json({ error: 'Admin already exists.' });

    await conn.beginTransaction();

    // 1) create individual
    const [ind] = await conn.query(
      `INSERT INTO individual (first_name, last_name, grade, special, created_at)
       VALUES (?,?, 'Adult', 1, CURRENT_TIMESTAMP)`,
      [firstName, lastName]
    );
    const individualId = ind.insertId;

    // 2) create credentials (inactive, no password yet)
    const [cred] = await conn.query(
      `INSERT INTO credentials (individual_id, email, password_hash, is_active, created_at)
       VALUES (?, ?, NULL, 0, CURRENT_TIMESTAMP)`,
      [individualId, email]
    );
    const credentialsId = cred.insertId;

    // 3) ensure national entity exists
    const [natRows] = await conn.query(`SELECT id FROM entity WHERE level='NATIONAL' LIMIT 1`);
    let nationalId = natRows[0]?.id;
    if (!nationalId) {
      const [nat] = await conn.query(
        `INSERT INTO entity (name, level, created_at)
         VALUES ('National Office', 'NATIONAL', CURRENT_TIMESTAMP)`
      );
      nationalId = nat.insertId;
    }

    // 4) assign ADMIN at national
    await conn.query(
      `INSERT INTO role_assignment (individual_id, target_type, target_id, role, active, created_at, updated_at)
       VALUES (?, 'ENTITY', ?, 'ADMIN', '9999-12-31', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [individualId, nationalId]
    );

    // Commit BEFORE email so admin is durable even if SMTP fails
    await conn.commit();

    // 5) send set-password email (outside transaction)
    try {
      const token = signSetPasswordToken(credentialsId);
      const url = buildSetPasswordUrl(token);
      await sendMail({
        to: email,
        subject: 'KidsMin Portal — Set your password',
        text: `Set your password: ${url}`,
        html: `<p><a href="${url}">Click here to set your password</a> (valid 24h).</p>`
      });
    } catch (mailErr) {
      console.error('[MAIL] createAdmin send failed:', mailErr);
      // Do not rollback DB—admin already created.
    }

    res.status(201).json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    res.status(400).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// --- create individual (protected) ---
router.post('/individuals', requireAuth, async (req, res) => {
  const { firstName, lastName, grade, special } = req.body || {};
  if (!firstName || !lastName || !grade) {
    return res.status(400).json({ error: 'Missing firstName, lastName, or grade.' });
  }
  if (!isValidGrade(grade)) {
    return res.status(422).json({ error: 'Invalid grade.' });
  }

  const createdBy = req.user?.sub || null;

  try {
    const [ins] = await pool.query(
      `INSERT INTO individual (first_name, last_name, grade, special, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [firstName, lastName, String(grade), special ? 1 : 0, createdBy]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- invite existing individual (protected) ---
router.post('/auth/invite', requireAuth, async (req, res) => {
  let { individualId, email } = req.body || {};
  if (!individualId || !email) return res.status(400).json({ error: 'Missing individualId or email.' });
  email = normalizeEmail(email);

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
    await sendMail({
      to: email,
      subject: 'KidsMin Portal — Set your password',
      text: `Set your password: ${url}`,
      html: `<p><a href="${url}">Click here to set your password</a> (valid 24h).</p>`
    });

    res.json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    res.status(400).json({ error: e.message });
  }
});

// --- set/reset password (shared page) ---
router.post('/auth/set-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Missing token or password.' });
  if (!validatePasswordPolicy(password)) {
    return res.status(422).json({ error: 'Password must be 12+ chars with upper, lower, number, and symbol.' });
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.typ !== 'setpwd' || !decoded.cid) throw new Error('Invalid token type.');
    const hash = await hashPassword(password);

    await pool.query(
      `UPDATE credentials SET password_hash=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [hash, decoded.cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- request password reset (no auth; does not leak account existence) ---
router.post('/auth/request-reset', async (req, res) => {
  let { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email.' });
  email = normalizeEmail(email);

  try {
    const [rows] = await pool.query(`SELECT id FROM credentials WHERE email=? LIMIT 1`, [email]);
    if (rows.length) {
      const token = signSetPasswordToken(rows[0].id);
      const url = buildSetPasswordUrl(token);
      await sendMail({
        to: email,
        subject: 'KidsMin Portal — Reset your password',
        text: `Reset your password: ${url}`,
        html: `<p><a href="${url}">Click here to reset your password</a> (valid 24h).</p>`
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- login ---
router.post('/login', async (req, res) => {
  let { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password.' });
  email = normalizeEmail(email);

  try {
    const [rows] = await pool.query(
      `SELECT c.id credId, c.password_hash, c.is_active, i.id individualId
         FROM credentials c
         JOIN individual i ON i.id = c.individual_id
        WHERE c.email = ? LIMIT 1`,
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials.' });

    const { password_hash, is_active, individualId, credId } = rows[0];
    if (!is_active) return res.status(401).json({ error: 'Invalid credentials.' });

    const bcrypt = require('bcrypt');
    const ok = await bcrypt.compare(password, password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const [roles] = await pool.query(`
      SELECT ra.target_type AS targetType,
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

    const token = signAuthToken({ sub: String(individualId), cred: String(credId) });
    res.json({ token, roles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- (optional) current user/roles helper for Angular ---
router.get('/me', requireAuth, async (req, res) => {
  const individualId = req.user.sub;
  try {
    const [roles] = await pool.query(`
      SELECT ra.target_type AS targetType,
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
    res.json({ individualId, roles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Password check → either start 2FA or issue JWT immediately
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // fetch credentials + person name (BINARY ids)
    const [rows] = await db.query(
      `SELECT
         c.id                 AS cred_id,          -- BINARY(16)
         c.individual_id      AS individual_id,    -- BINARY(16)
         BIN_TO_UUID(c.individual_id, 1) AS individual_uuid,
         c.email,
         c.email_lc,
         c.password_hash,
         c.twofa_enabled,
         c.twofa_preferred,
         i.first_name,
         i.last_name
       FROM credentials c
       JOIN individual i ON i.id = c.individual_id
       WHERE c.email_lc = LOWER(?) LIMIT 1`,
      [email]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const row = rows[0];

    if (!row.password_hash) {
      return res.status(401).json({ error: 'Account has no password set' });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // 2FA?
    if (shouldRequire2fa(row)) {
      await twofa.issueEmailChallenge({
        credentialsIdBin: row.cred_id,               // Buffer from mysql2 for BINARY(16)
        email: row.email,
        displayName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
        ip: req.ip,
        ua: req.get('user-agent') || ''
      });

      const ttlMin = parseInt(process.env.TWOFA_CODE_TTL_MIN || '5', 10);
      return res.json({
        status: '2FA_REQUIRED',
        method: 'email',
        ttlMin,
        emailMasked: maskEmail(row.email)
      });
    }

    // no 2FA → issue JWT now
    const token = jwt.sign(
      { sub: row.individual_uuid }, // UUID string of the individual
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );
    const roles = await fetchRolesForIndividual(row.individual_id);
    return res.json({ token, roles });
  } catch (err) {
    console.error('POST /api/login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
