const { verifyToken } = require('../utils/jwt');
const auth = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }

      const decoded = verifyToken(token);
      req.user = decoded;

      // Check role authorization
      if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }

      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(401).json({ error: 'Invalid token.' });
    }
  };
};

module.exports = auth;