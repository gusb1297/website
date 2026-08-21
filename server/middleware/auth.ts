import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env';
import { AdminRole, getAdminById, isDatabaseReady } from '../services/adminService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
}

/**
 * Verify the bearer token and re-check the account against MongoDB on every
 * request, so deleting or deactivating an admin revokes their access instantly
 * instead of waiting for the token to expire.
 */
export const authenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: { id: string; email: string; role: AdminRole };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as { id: string; email: string; role: AdminRole };
  } catch {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }

  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'database_unavailable',
      message: 'Admin accounts are stored in MongoDB, which is currently unreachable.',
    });
  }

  const admin = await getAdminById(decoded.id);
  if (!admin || !admin.isActive) {
    return res.status(401).json({ error: 'account_revoked', message: 'অ্যাকাউন্টটি আর সক্রিয় নেই। আবার লগইন করুন।' });
  }

  req.user = { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Requires Admin privileges' });
  }
  next();
};
