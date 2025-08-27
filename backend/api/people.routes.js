const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../authMiddleware');

function isValidGrade(g) {
  const v = String(g || '');
  return ['Adult', '12', '11', '10', '9'].includes(v);
}

// POST /api/people/individuals
router.post('/individuals', requireAuth, async (req, res) => {
  const { firstName, lastName, grade, special } = req.body || {};
  if (!firstName || !lastName || !grade) {
    return res.status(400).json({ error: 'Missing firstName, lastName, or grade.' });
  }
  if (!isValidGrade(grade)) {
    return res.status(422).json({ error: 'Invalid grade.' });
  }

  try {
    // Generate UUID in SQL-friendly form
    const [[{ uuid }]] = await db.query(`SELECT UUID() AS uuid`);
    await db.query(
      `INSERT INTO individual (id, first_name, last_name, grade, special, created_at)
       VALUES (UUID_TO_BIN(?, 1), ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [uuid, firstName, lastName, String(grade), special ? 1 : 0]
    );

    res.status(201).json({ id: uuid }); // return UUID string
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
