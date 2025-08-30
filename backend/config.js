// backend/config.js
const fs = require('fs');
const path = require('path');

// Accept either NODE_ENV or APP_ENV, default to 'development'
const MODE = process.env.NODE_ENV || process.env.APP_ENV || 'development';

// Load env in this order: .env.<MODE> (from backend/) → .env (from backend/)
(function loadEnv() {
  const candidates = [`.env.${MODE}`, '.env'];
  for (const name of candidates) {
    const p = path.join(__dirname, name);
    if (fs.existsSync(p)) {
      require('dotenv').config({ path: p });
      break;
    }
  }
})();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
function bool(name, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  return String(v).toLowerCase() === 'true';
}
function num(name, def) {
  const v = process.env[name];
  return v == null ? def : parseInt(String(v), 10);
}

module.exports = {
  NODE_ENV: MODE,
  PORT: num('PORT', 3000),

  // DB
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: num('DB_PORT', 3306),
  DB_USER: required('DB_USER'),
  DB_PASS: required('DB_PASS'),
  DB_NAME: required('DB_NAME'),

  // Auth / JWT
  JWT_SECRET: required('JWT_SECRET'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4200',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',

  // SMTP (support MAIL_FROM fallback)
  SMTP_HOST: required('SMTP_HOST'),
  SMTP_PORT: num('SMTP_PORT', 587),
  SMTP_SECURE: bool('SMTP_SECURE', false),
  SMTP_USER: required('SMTP_USER'),
  SMTP_PASS: required('SMTP_PASS'),
  SMTP_FROM: process.env.SMTP_FROM || process.env.MAIL_FROM || `KidsMin <${process.env.SMTP_USER}>`,

  // 2FA
  TWOFA_ENABLED: bool('TWOFA_ENABLED', true),
  TWOFA_CHANNEL: process.env.TWOFA_CHANNEL || 'email',
  TWOFA_CODE_TTL_MIN: num('TWOFA_CODE_TTL_MIN', 5),
  TWOFA_CODE_LENGTH: num('TWOFA_CODE_LENGTH', 6),

  // CORS (support singular CORS_ORIGIN)
  CORS_ORIGINS: (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};
