// backend/server.js
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const router = require('./routes');
const pool = require('./db'); // used by /readyz

const app = express();

// --- env / config fallbacks ---
const ENV  = config?.env || process.env.APP_ENV || process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || config?.port || 3000);
const ORIGIN = config?.corsOrigin || config?.frontendUrl || process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:4200';

// --- security hardening ---
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// --- CORS ---
const corsOptions = {
  origin: ORIGIN,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// --- body parser ---
app.use(express.json({ limit: '32kb' }));

// --- logging ---
app.use(morgan(ENV === 'production' ? 'combined' : 'dev'));

// --- rate limits for auth endpoints ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login', authLimiter);
app.use('/api/auth', authLimiter);

// --- health endpoints ---
app.get('/', (_req, res) => res.json({ ok: true, name: 'KidsMin API', env: ENV }));
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.get('/readyz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ready: true }); }
  catch { res.status(503).json({ ready: false }); }
});

// --- main API router ---
app.use('/api', router);

// --- 404 ---
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// --- error handler ---
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  const status = (err && Number.isInteger(err.status)) ? err.status : 500;
  const msg = status >= 500 ? 'Server error' : (err.message || 'Request error');
  res.status(status).json({ error: msg });
});

// --- start & graceful shutdown ---
const server = app.listen(PORT, () => {
  console.log(`KidsMin API listening on http://localhost:${PORT} [${ENV}] (origin: ${ORIGIN})`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, closing server...`);
  server.close(() => {
    console.log('Server closed. Bye!');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
