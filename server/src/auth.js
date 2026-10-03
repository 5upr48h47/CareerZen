import jwt from 'jsonwebtoken';
import { get } from './db.js';

export const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured and at least 32 characters long');
  return secret;
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, email: user.email },
    JWT_SECRET(),
    { expiresIn: '7d' }
  );
};

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET());
    const user = await get(
      `SELECT u.id, u.username, u.email, u.role, p.full_name, p.headline, p.avatar_url 
       FROM users u 
       LEFT JOIN profiles p ON u.id = p.user_id 
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET());
      const user = await get(
        `SELECT u.id, u.username, u.email, u.role, p.full_name, p.headline, p.avatar_url 
         FROM users u 
         LEFT JOIN profiles p ON u.id = p.user_id 
         WHERE u.id = ? AND u.is_active = 1`,
        [decoded.id]
      );
      if (user) req.user = user;
    } catch {
      // Ignore token failure in optional auth
    }
  }
  next();
};
