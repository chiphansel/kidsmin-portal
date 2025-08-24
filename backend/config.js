require('dotenv').config(); 

const APP_ENV = process.env.APP_ENV || 'development';

function parseOrigins(input) {
  if (!input) return true; // allow all in dev if not set
  const list = String(input).split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return true;
  return function originCheck(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / tools
    return list.includes(origin) ? cb(null, true) : cb(new Error('CORS not allowed'), false);
  };
}

module.exports = {
  env: APP_ENV,
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN),

  // DB
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kidsmin_dev',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL || 10)
  },

  // Mail
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER
  }
};
