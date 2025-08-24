// Express app bootstrap: CORS, JSON body, routes mounted under /api
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { port, corsOrigin, env } = require('./config');

const app = express();

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Basic root
app.get('/', (_req, res) => res.json({ ok: true, name: 'KidsMin API', env }));

// API routes
const router = require('./routes');
app.use('/api', router);

// Not found handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Server error' });
});

// Start
app.listen(port, () => {
  console.log(`KidsMin API listening on http://localhost:${port} [${env}]`);
});
