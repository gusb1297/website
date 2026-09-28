import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env';
import { AdminRole, getAdminById, isDatabaseReady } from '../services/adminService';
import { HACKER_ADMIN_KIND, readHackerToken } from '../services/hackerAuth';
import { isMaintenanceMode } from '../services/systemControl';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    /**
     * `admin`   → a normal account from MongoDB (re-checked on every request).
     * `hackeradmin` → the /hackeradmin operations console (passcode session;
     *                 deliberately NOT re-checked against MongoDB, so the console
     *                 stays usable while the database is switched off).
     */
    kind?: 'admin' | typeof HACKER_ADMIN_KIND;
  };
}

/**
 * Verify the bearer token and re-check the account against MongoDB on every
 * request, so deleting or deactivating an admin revokes their access instantly
 * instead of waiting for the token to expire.
 *
 * A /hackeradmin token is accepted without a database round trip — that is the
 * whole point of the console: it must be able to switch the database back on.
 */
export const authenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];

  const hacker = readHackerToken(token);
  if (hacker) {
    req.user = {
      id: hacker.sub,
      name: hacker.name,
      email: hacker.email,
      role: 'admin',
      kind: HACKER_ADMIN_KIND,
    };
    return next();
  }

  let decoded: { id: string; email: string; role: AdminRole };
  try {
    decoded = jwt.verify(token, getJwtSecret()) as { id: string; email: string; role: AdminRole };
  } catch {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }

  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'database_unavailable',
      message:
        'MongoDB is not reachable, so this session cannot be verified. Check MONGODB_URI and Atlas Network Access.',
    });
  }

  const admin = await getAdminById(decoded.id);
  if (!admin || !admin.isActive) {
    return res.status(401).json({ error: 'account_revoked', message: 'অ্যাকাউন্টটি আর সক্রিয় নেই। আবার লগইন করুন।' });
  }

  req.user = { id: admin.id, name: admin.name, email: admin.email, role: admin.role, kind: 'admin' };
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Requires Admin privileges' });
  }
  next();
};

/** Only the operations console (passcode session) may call /api/hackeradmin/*. */
export const requireHackerAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.kind !== HACKER_ADMIN_KIND) {
    return res.status(403).json({
      error: 'hackeradmin_required',
      message: '/hackeradmin কনসোলের পাসকোড সেশন প্রয়োজন।',
    });
  }
  next();
};

/** True when the request carries a console (hackeradmin) token. */
export function isHackerRequest(req: AuthRequest): boolean {
  return req.user?.kind === HACKER_ADMIN_KIND;
}

/** Read the token kind without a database check (used by the freeze gate). */
export function requestTokenKind(req: Request): 'admin' | 'hackeradmin' | 'none' {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return 'none';
  const token = header.split(' ')[1];
  if (readHackerToken(token)) return HACKER_ADMIN_KIND;
  try {
    jwt.verify(token, getJwtSecret());
    return 'admin';
  } catch {
    return 'none';
  }
}

/**
 * Public write freeze (`maintenanceMode` in the console).
 *
 * While it is on, every state-changing request is refused — except those coming
 * from the operations console itself, which must always be able to un-freeze the
 * site, and the login endpoints (nobody should be locked out of their own panel).
 */
export const maintenanceGate = (req: Request, res: Response, next: NextFunction) => {
  if (!isMaintenanceMode()) return next();

  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  if (req.path.startsWith('/hackeradmin')) return next();
  if (req.path.startsWith('/auth/')) return next();
  if (requestTokenKind(req) === HACKER_ADMIN_KIND) return next();

  return res.status(503).json({
    error: 'maintenance_mode',
    message:
      'সাইটটি এখন রক্ষণাবেক্ষণ মোডে আছে (Write Freeze) — এই মুহূর্তে কোনো পরিবর্তন সংরক্ষণ করা যাবে না। ' +
      '/hackeradmin কনসোল থেকে System Control → Freeze বন্ধ করলে আবার স্বাভাবিক হয়ে যাবে।',
  });
};
