require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

module.exports = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),

  // DB
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: required('DB_USER'),
  DB_PASS: required('DB_PASS'),
  DB_NAME: required('DB_NAME'),

  // Auth / JWT
  JWT_SECRET: required('JWT_SECRET'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4200',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',

  // SMTP (personal email account)
  SMTP_HOST: required('SMTP_HOST'),
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  SMTP_USER: required('SMTP_USER'),
  SMTP_PASS: required('SMTP_PASS'),
  SMTP_FROM: process.env.SMTP_FROM || `KidsMin <${process.env.SMTP_USER}>`,

  // 2FA flags
  TWOFA_ENABLED: String(process.env.TWOFA_ENABLED || 'true').toLowerCase() === 'true',
  TWOFA_CHANNEL: process.env.TWOFA_CHANNEL || 'email',
  TWOFA_CODE_TTL_MIN: parseInt(process.env.TWOFA_CODE_TTL_MIN || '5', 10),
  TWOFA_CODE_LENGTH: parseInt(process.env.TWOFA_CODE_LENGTH || '6', 10),

  // Allowed CORS origins (array)
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};
