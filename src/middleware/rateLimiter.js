const rateLimit = require('express-rate-limit');

// Login — 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Super admin registration — 5 attempts per hour per IP (one-time operation)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { loginLimiter, registerLimiter };
