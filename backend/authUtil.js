const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { JWT_SECRET, FRONTEND_URL } = process.env;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

function validatePasswordPolicy(pw) { return PASSWORD_REGEX.test(pw || ''); }
function signAuthToken(payload, expiresIn = '12h') { return jwt.sign(payload, JWT_SECRET, { expiresIn }); }
function signSetPasswordToken(credId, expiresIn = '24h') { return jwt.sign({ typ: 'setpwd', cid: credId }, JWT_SECRET, { expiresIn }); }
function verifyToken(t) { return jwt.verify(t, JWT_SECRET); }
function buildSetPasswordUrl(token) { return `${FRONTEND_URL}/set-password?token=${encodeURIComponent(token)}`; }
async function hashPassword(pw) { const saltRounds = 12; return bcrypt.hash(pw, saltRounds); }

module.exports = {
  PASSWORD_REGEX, validatePasswordPolicy,
  signAuthToken, signSetPasswordToken, verifyToken,
  buildSetPasswordUrl, hashPassword
};
