// JWT helpers + password policy + hashing
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { jwtSecret, frontendUrl } = require('./config');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

function validatePasswordPolicy(pw) {
  return PASSWORD_REGEX.test(pw || '');
}

function signAuthToken(payload, expiresIn = '12h') {
  return jwt.sign(payload, jwtSecret, { expiresIn });
}

function signSetPasswordToken(credId, expiresIn = '24h') {
  return jwt.sign({ typ: 'setpwd', cid: credId }, jwtSecret, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

function buildSetPasswordUrl(token) {
  return `${frontendUrl}/set-password?token=${encodeURIComponent(token)}`;
}

async function hashPassword(pw) {
  const saltRounds = 12;
  return bcrypt.hash(pw, saltRounds);
}

module.exports = {
  PASSWORD_REGEX,
  validatePasswordPolicy,
  signAuthToken,
  signSetPasswordToken,
  verifyToken,
  buildSetPasswordUrl,
  hashPassword
};
