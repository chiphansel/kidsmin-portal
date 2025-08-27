const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config(); // loads .env.* into process.env

const config = require('./config');

const app = express();

// CORS
app.use(cors({
  origin: config.CORS_ORIGINS, // array of allowed origins
  credentials: false,
}));

// Security / parsing / logs
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true, env: config.NODE_ENV }));

// API
app.use('/api', require('./api/routes'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Server error' });
});

const port = config.PORT;
app.listen(port, () => {
  console.log(`KidsMin backend listening on http://localhost:${port}`);
});
