const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

const TTL_MIN = config.TWOFA_CODE_TTL_MIN;
const CODE_LEN = config.TWOFA_CODE_LENGTH;

function generateNumericCode(len = CODE_LEN) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += (bytes[i] % 10).toString();
  return s;
}

async function upsertChallenge(credentialsIdBin, codeHash, channel, ttlMin = TTL_MIN) {
  const sql = `
    INSERT INTO twofactor_challenge (credentials_id, code_hash, channel, attempts, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, 0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), UTC_TIMESTAMP(), UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE
      code_hash=VALUES(code_hash),
      channel=VALUES(channel),
      attempts=0,
      expires_at=VALUES(expires_at),
      updated_at=UTC_TIMESTAMP()
  `;
  await db.query(sql, [credentialsIdBin, codeHash, channel, ttlMin]);
}

async function issueEmailChallenge({ credentialsIdBin, email, displayName }) {
  const code = generateNumericCode(CODE_LEN);
  const codeHash = await bcrypt.hash(code, 10);

  await upsertChallenge(credentialsIdBin, codeHash, 'email', TTL_MIN);

  const mailer = require('./mailer');
  await mailer.sendTwofaCode(email, displayName, code, TTL_MIN);

  return { channel: 'email', ttlMin: TTL_MIN };
}

async function verifyChallenge(credentialsIdBin, codeAttempt) {
  const [rows] = await db.query(
    `SELECT code_hash, attempts, expires_at
     FROM twofactor_challenge
     WHERE credentials_id = ?`,
    [credentialsIdBin]
  );
  if (!rows || rows.length === 0) return { ok: false, reason: 'NO_CHALLENGE' };

  const row = rows[0];
  if (new Date(row.expires_at) < new Date()) return { ok: false, reason: 'EXPIRED' };

  const ok = await bcrypt.compare(codeAttempt, row.code_hash);
  if (!ok) {
    await db.query(
      `UPDATE twofactor_challenge
       SET attempts = attempts + 1, updated_at = UTC_TIMESTAMP()
       WHERE credentials_id = ?`,
      [credentialsIdBin]
    );
    return { ok: false, reason: 'BAD_CODE' };
  }

  await db.query(`DELETE FROM twofactor_challenge WHERE credentials_id = ?`, [credentialsIdBin]);
  return { ok: true };
}

module.exports = { issueEmailChallenge, verifyChallenge };
