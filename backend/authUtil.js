const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');

function validatePasswordPolicy(pw) {
  const s = String(pw || '');
  if (s.length < 12) return false;
  return /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);
}

function buildSetPasswordUrl(token) {
  const base = config.FRONTEND_URL.replace(/\/+$/, '');
  return `${base}/set-password?token=${encodeURIComponent(token)}`;
}

// Accept Buffer (BINARY(16)) or string
function signSetPasswordToken(credentialsId) {
  const cid =
    Buffer.isBuffer(credentialsId) ? credentialsId.toString('base64url')
    : typeof credentialsId === 'string' ? credentialsId
    : String(credentialsId);

  return jwt.sign(
    { typ: 'setpwd', cid },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

module.exports = {
  validatePasswordPolicy,
  buildSetPasswordUrl,
  signSetPasswordToken,
  verifyToken,
  hashPassword,
};
