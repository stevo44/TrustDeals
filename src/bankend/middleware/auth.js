/**
 * middleware/auth.js
 * -------------------
 * JWT authentication and role-based access control middleware.
 *
 * Usage:
 *   router.post('/initiate', authenticate, requireRole('buyer'), handler)
 *   router.post('/release',  authenticate, requireRole('admin'),  handler)
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[Auth] FATAL: JWT_SECRET is not set. Server will not start securely.');
}

// ─── Authenticate ─────────────────────────────────────────────────────────────
/**
 * Verifies the Bearer token in Authorization header.
 * Sets req.user = { id, role, email, ... } on success.
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.slice(7); // Strip "Bearer "

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id:    decoded.sub || decoded.id,
      role:  decoded.role || 'buyer',
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

// ─── Require Role ─────────────────────────────────────────────────────────────
/**
 * Restricts endpoint to users with one of the given roles.
 * Must be used AFTER authenticate().
 *
 * @param {...string} roles  – e.g. requireRole('admin', 'system')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}`,
      });
    }
    next();
  };
}

// ─── Validate Request Body ────────────────────────────────────────────────────
/**
 * Simple required-field validator middleware factory.
 * Returns 400 if any of the listed fields is missing.
 *
 * Usage: router.post('/initiate', validate(['session_id','phone','network','amount']), handler)
 */
export function validate(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter(f => req.body[f] === undefined || req.body[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }
    next();
  };
}
