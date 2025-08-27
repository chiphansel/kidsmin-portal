const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/system/admin-exists
router.get('/admin-exists', async (_req, res) => {
  try {
    const [rows] = await db.query(`SELECT 1 FROM role_assignment WHERE role='ADMIN' LIMIT 1`);
    res.json({ exists: rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
