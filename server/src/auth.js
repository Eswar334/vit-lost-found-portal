import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { unauthorized } from './errors.js';

export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/** Attaches req.user if a valid bearer token is present. Never rejects. */
export const optionalAuth = (db) => (req, _res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db
      .prepare('SELECT id, name, reg_no, email, phone, alias, created_at FROM users WHERE id = ?')
      .get(Number(payload.sub));
    if (user) req.user = user;
  } catch {
    req.authError = true;
  }
  next();
};

export const requireAuth = (req, _res, next) => {
  if (!req.user) {
    return next(
      unauthorized(req.authError ? 'Your session has expired. Please log in again.' : undefined),
    );
  }
  next();
};

/** The logged-in user's own profile — the only place their full details appear. */
export const selfView = (u) => ({
  id: u.id,
  name: u.name,
  regNo: u.reg_no,
  email: u.email,
  phone: u.phone,
  alias: u.alias,
  createdAt: u.created_at,
});
