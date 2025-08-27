const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/system', require('./system.routes'));
router.use('/people', require('./people.routes'));

// Fallback root of /api
router.get('/', (_req, res) => res.json({ ok: true, api: 'kidsmin' }));

module.exports = router;
