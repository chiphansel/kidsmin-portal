// backend/authMiddleware.js
const { verifyToken } = require('./authUtil');

// Usage: app.use('/secure', requireAuth, handler)
function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'Missing token' });

  try {
    req.user = verifyToken(m[1]); // expects payload like { sub, cred, exp, ... }
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAuth };
