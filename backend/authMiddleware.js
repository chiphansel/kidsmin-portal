const jwt = require('jsonwebtoken');
const config = require('./config');

function requireAuth(req, res, next) {
  const header = req.get('authorization') || req.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    // payload.sub should be the UUID string of the individual
    req.user = { sub: payload.sub };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
