const jwt = require('jsonwebtoken');
const { sqlite } = require('./db');

async function getJwtSecret() {
  try {
    const setting = await sqlite.systemSetting.findUnique({
      where: { key: 'JWT_SECRET' }
    });
    if (setting && setting.value) {
      return setting.value.trim();
    }
  } catch (err) {
    // Ignore and fallback
  }
  return 'career-launcher-default-secret-key-123';
}

function authMiddleware(permissionRequired) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      
      const token = authHeader.split(' ')[1];
      const secret = await getJwtSecret();
      
      let decoded;
      try {
        decoded = jwt.verify(token, secret);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
      }
      
      // Query local SQLite for active status/permission validation
      const user = await sqlite.user.findUnique({
        where: { id: decoded.userId }
      });
      
      if (!user) {
        return res.status(401).json({ error: 'User does not exist in local database.' });
      }
      
      req.user = user;
      
      // Admin role bypasses all permission gates
      if (user.role === 'ADMIN') {
        return next();
      }
      
      // Granular permission check
      if (permissionRequired) {
        const userPerms = user.permissions.split(',').map(p => p.trim().toLowerCase());
        const reqPerm = permissionRequired.toLowerCase();
        
        if (!userPerms.includes(reqPerm)) {
          return res.status(403).json({ error: `Forbidden. You need the '${permissionRequired}' permission.` });
        }
      }
      
      next();
    } catch (err) {
      console.error('Authentication Error:', err.message);
      return res.status(500).json({ error: 'Authentication processing failure.' });
    }
  };
}

module.exports = {
  authMiddleware,
  getJwtSecret
};
