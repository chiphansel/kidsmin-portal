const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db');
const config = require('../config');
const twofa = require('../twofa');
const { sendMail } = require('../mailer');
const { requireAuth } = require('../authMiddleware');

const {
  validatePasswordPolicy,
  signSetPasswordToken,
  verifyToken,
  buildSetPasswordUrl,
  hashPassword,
} = require('../authUtil');

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}
function maskEmail(email) {
  const [u, d] = String(email).split('@');
  if (!d) return email;
  const first = u[0] || '';
  const last = u.length > 1 ? u[u.length - 1] : '';
  const stars = u.length > 2 ? '*'.repeat(u.length - 2) : '*';
  return `${first}${stars}${last}@${d}`;
}
function shouldRequire2fa(row) {
  if (config.TWOFA_ENABLED) return true;
  return !!row.twofa_enabled;
}
async function fetchRolesForIndividual(individualIdBin) {
  const [rows] = await db.query(
    `SELECT
       BIN_TO_UUID(ra.target_id, 1) AS targetId,
       e.name  AS targetName,
       e.level AS targetLevel,
       ra.role,
       ra.active,
       ra.created_at AS createdAt,
       ra.updated_at AS updatedAt
     FROM role_assignment ra
     LEFT JOIN entity e ON e.id = ra.target_id
     WHERE ra.individual_id = ? AND ra.active = '9999-12-31'`,
    [individualIdBin]
  );
  return rows || [];
}

// ---- LOGIN ----
async function loginHandler(req, res) {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    email = normalizeEmail(email);

    const [rows] = await db.query(
      `SELECT
         c.id                       AS cred_id,
         c.individual_id            AS individual_id,
         BIN_TO_UUID(c.individual_id, 1) AS individual_uuid,
         c.email, c.email_lc,
         c.password_hash, c.is_active,
         c.twofa_enabled, c.twofa_preferred,
         i.first_name, i.last_name
       FROM credentials c
       JOIN individual i ON i.id = c.individual_id
       WHERE c.email_lc = LOWER(?) LIMIT 1`,
      [email]
    );
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const row = rows[0];

    if (!row.is_active || !row.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (shouldRequire2fa(row)) {
      await twofa.issueEmailChallenge({
        credentialsIdBin: row.cred_id,
        email: row.email,
        displayName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      });
      return res.json({
        status: '2FA_REQUIRED',
        method: 'email',
        ttlMin: config.TWOFA_CODE_TTL_MIN,
        emailMasked: maskEmail(row.email),
      });
    }

    const token = jwt.sign({ sub: row.individual_uuid }, config.JWT_SECRET, { expiresIn: '8h' });
    const roles = await fetchRolesForIndividual(row.individual_id);
    return res.json({ token, roles });
  } catch (err) {
    console.error('[auth] login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
router.post('/login', loginHandler);

// ---- VERIFY 2FA ----
router.post('/2fa/verify', async (req, res) => {
  try {
    let { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    email = normalizeEmail(email);

    const [rows] = await db.query(
      `SELECT
         c.id            AS cred_id,
         c.individual_id AS individual_id,
         BIN_TO_UUID(c.individual_id, 1) AS individual_uuid
       FROM credentials c
       WHERE c.email_lc = LOWER(?) LIMIT 1`,
      [email]
    );
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Invalid code' });
    const row = rows[0];

    const result = await twofa.verifyChallenge(row.cred_id, String(code).trim());
    if (!result.ok) {
      const map = { NO_CHALLENGE: 'No active challenge', EXPIRED: 'Code expired', BAD_CODE: 'Invalid code' };
      return res.status(400).json({ error: map[result.reason] || 'Invalid code' });
    }

    const token = jwt.sign({ sub: row.individual_uuid }, config.JWT_SECRET, { expiresIn: '8h' });
    const roles = await fetchRolesForIndividual(row.individual_id);
    return res.json({ token, roles });
  } catch (err) {
    console.error('[auth] 2fa verify error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ---- REQUEST RESET ----
router.post('/request-reset', async (req, res) => {
  try {
    let { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email.' });
    email = normalizeEmail(email);

    const [rows] = await db.query(`SELECT id FROM credentials WHERE email_lc = LOWER(?) LIMIT 1`, [email]);
    if (rows.length) {
      const credId = rows[0].id;
      const token = signSetPasswordToken(credId);
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
    console.error('[auth] request-reset error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- SET / RESET PASSWORD ----
router.post('/set-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Missing token or password.' });
  if (!validatePasswordPolicy(password)) {
    return res.status(422).json({ error: 'Password must be 12+ chars with upper, lower, number, and symbol.' });
  }
  try {
    const decoded = verifyToken(token);
    if (decoded.typ !== 'setpwd' || !decoded.cid) throw new Error('Invalid token type.');

    const hash = await hashPassword(password);
    await db.query(
      `UPDATE credentials SET password_hash=?, is_active=1, updated_at=UTC_TIMESTAMP() WHERE id=?`,
      [hash, Buffer.from(decoded.cid, 'base64url')]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[auth] set-password error', e);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// ---- INVITE (protected) ----
router.post('/invite', requireAuth, async (req, res) => {
  try {
    let { individualId, email } = req.body || {};
    if (!individualId || !email) return res.status(400).json({ error: 'Missing individualId or email.' });
    email = normalizeEmail(email);

    // upsert credentials for this individual
    const [rows] = await db.query(`SELECT id FROM credentials WHERE individual_id=? LIMIT 1`, [Buffer.from(individualId, 'hex')]);
    let credId = rows[0]?.id;
    if (!credId) {
      await db.query(
        `INSERT INTO credentials (id, individual_id, email, is_active, created_at)
         VALUES (UUID_TO_BIN(UUID(), 1), ?, ?, 0, UTC_TIMESTAMP())`,
        [Buffer.from(individualId, 'hex'), email]
      );
      const [re] = await db.query(`SELECT id FROM credentials WHERE individual_id=? LIMIT 1`, [Buffer.from(individualId, 'hex')]);
      credId = re[0].id;
    } else {
      await db.query(`UPDATE credentials SET email=?, updated_at=UTC_TIMESTAMP() WHERE id=?`, [email, credId]);
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
    console.error('[auth] invite error', e);
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    res.status(400).json({ error: 'Bad request' });
  }
});

// ---- ONE-TIME ADMIN CREATION ----
router.post('/create-admin', async (req, res) => {
  let { firstName, lastName, email } = req.body || {};
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing firstName, lastName, or email.' });
  }
  email = normalizeEmail(email);

  const conn = await db.getConnection();
  try {
    const [adm] = await conn.query(`SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
    if (adm.length) return res.status(403).json({ error: 'Admin already exists.' });

    await conn.beginTransaction();

    // 1) person
    const [[{ uuid }]] = await conn.query(`SELECT UUID() AS uuid`);
    await conn.query(
      `INSERT INTO individual (id, first_name, last_name, grade, special, created_at)
       VALUES (UUID_TO_BIN(?, 1), ?, ?, 'Adult', 1, UTC_TIMESTAMP())`,
      [uuid, firstName, lastName]
    );
    const [indRow] = await conn.query(`SELECT id FROM individual WHERE id = UUID_TO_BIN(?, 1)`, [uuid]);
    const individualId = indRow[0].id;

    // 2) credentials (inactive)
    await conn.query(
      `INSERT INTO credentials (id, individual_id, email, is_active, created_at)
       VALUES (UUID_TO_BIN(UUID(), 1), ?, ?, 0, UTC_TIMESTAMP())`,
      [individualId, email]
    );
    const [credRow] = await conn.query(`SELECT id FROM credentials WHERE individual_id=? LIMIT 1`, [individualId]);
    const credentialsId = credRow[0].id;

    // 3) national entity (ensure)
    const [natRows] = await conn.query(`SELECT id FROM entity WHERE level='NATIONAL' LIMIT 1`);
    let nationalId = natRows[0]?.id;
    if (!nationalId) {
      await conn.query(
        `INSERT INTO entity (id, name, level, created_at)
         VALUES (UUID_TO_BIN(UUID(), 1), 'National', 'NATIONAL', UTC_TIMESTAMP())`
      );
      const [nat2] = await conn.query(`SELECT id FROM entity WHERE level='NATIONAL' LIMIT 1`);
      nationalId = nat2[0].id;
    }

    // 4) assign ADMIN
    await conn.query(
      `INSERT INTO role_assignment (id, individual_id, target_type, target_id, role, active, created_at, updated_at)
       VALUES (UUID_TO_BIN(UUID(), 1), ?, 'ENTITY', ?, 'ADMIN', '9999-12-31', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [individualId, nationalId]
    );

    await conn.commit();

    // 5) email set-password
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
      console.error('[MAIL] create-admin send failed:', mailErr);
    }

    res.status(201).json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('[auth] create-admin error', e);
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    res.status(400).json({ error: 'Bad request' });
  } finally {
    conn.release();
  }
});

module.exports = router;
