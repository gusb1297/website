import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MAdmin } from '../models/schemas';
import { describeMongoStatus, isDatabaseReady as mongoIsReady, MongoState } from '../config/mongo';

/**
 * Admin account management.
 *
 * Every admin account lives in MongoDB with a bcrypt-hashed password. There are
 * no built-in / demo credentials anywhere in the codebase. The first account is
 * created by any of:
 *   1. BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD on an empty collection
 *   2. POST /api/auth/setup from the /admin/login first-run form
 *   3. `npm run create-admin`
 *
 * Do not insert users from the MongoDB Atlas UI — a plaintext password will
 * never match, because login compares against `passwordHash` (bcrypt).
 */

export const MIN_PASSWORD_LENGTH = 8;
export const ADMIN_ROLES = ['admin', 'editor'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

export class AdminServiceError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AdminServiceError';
    this.status = status;
    this.code = code;
  }
}

export interface AdminDTO {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

export interface AdminInput {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  isActive?: unknown;
}

/** True when the MongoDB connection is usable. */
export function isDatabaseReady(): boolean {
  return mongoIsReady();
}

function databaseUnavailableError(): AdminServiceError {
  const status = describeMongoStatus();
  return new AdminServiceError(503, 'database_unavailable', status.hint);
}

function assertDatabase(): void {
  if (!isDatabaseReady()) {
    throw databaseUnavailableError();
  }
}

export interface AuthStatus {
  database: MongoState;
  setupRequired: boolean;
  message: string;
}

/** Public status for the login page (no secrets). */
export async function getAuthStatus(): Promise<AuthStatus> {
  const mongo = describeMongoStatus();
  if (!mongo.connected) {
    return {
      database: mongo.state,
      setupRequired: false,
      message: mongo.hint,
    };
  }

  const total = await MAdmin.countDocuments({});
  if (total === 0) {
    return {
      database: 'connected',
      setupRequired: true,
      message:
        'No admin account exists yet. Create the first one on this page — you do not add users from the MongoDB Atlas panel.',
    };
  }

  return { database: 'connected', setupRequired: false, message: '' };
}

/**
 * Create the very first administrator. Refuses to run once any account exists,
 * so it cannot be used as a backdoor after setup.
 */
export async function setupFirstAdmin(input: AdminInput): Promise<AdminDTO> {
  assertDatabase();
  const total = await MAdmin.countDocuments({});
  if (total > 0) {
    throw new AdminServiceError(
      409,
      'already_setup',
      'একজন অ্যাডমিন আগে থেকেই আছেন। লগইন ফর্ম ব্যবহার করুন।'
    );
  }
  return createAdmin({ ...input, role: 'admin', isActive: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(doc: any): AdminDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
    lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt).toISOString() : null,
  };
}

function normalizeName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 2) {
    throw new AdminServiceError(400, 'invalid_name', 'নাম কমপক্ষে ২ অক্ষরের হতে হবে।');
  }
  if (name.length > 80) {
    throw new AdminServiceError(400, 'invalid_name', 'নাম সর্বোচ্চ ৮০ অক্ষরের হতে পারে।');
  }
  return name;
}

function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) {
    throw new AdminServiceError(400, 'invalid_email', 'একটি বৈধ ইমেইল ঠিকানা দিন।');
  }
  return email;
}

function normalizeRole(value: unknown, fallback: AdminRole = 'admin'): AdminRole {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !ADMIN_ROLES.includes(value as AdminRole)) {
    throw new AdminServiceError(400, 'invalid_role', 'রোল অবশ্যই admin অথবা editor হতে হবে।');
  }
  return value as AdminRole;
}

function normalizeActive(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

function validatePassword(value: unknown): string {
  const password = typeof value === 'string' ? value : '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AdminServiceError(
      400,
      'weak_password',
      `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে।`
    );
  }
  if (password.length > 128) {
    throw new AdminServiceError(400, 'weak_password', 'পাসওয়ার্ড সর্বোচ্চ ১২৮ অক্ষরের হতে পারে।');
  }
  return password;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Number of accounts that can still log in and manage other admins. */
async function countActiveAdmins(excludeId?: string): Promise<number> {
  const query: Record<string, unknown> = { role: 'admin', isActive: true };
  if (excludeId) query._id = { $ne: excludeId };
  return MAdmin.countDocuments(query);
}

export async function listAdmins(): Promise<AdminDTO[]> {
  assertDatabase();
  const docs = await MAdmin.find({}).sort({ createdAt: 1 }).lean();
  return docs.map(toDTO);
}

export async function getAdminById(id: string): Promise<AdminDTO | null> {
  assertDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await MAdmin.findById(id).lean();
  return doc ? toDTO(doc) : null;
}

export async function createAdmin(input: AdminInput): Promise<AdminDTO> {
  assertDatabase();
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const role = normalizeRole(input.role);
  const isActive = normalizeActive(input.isActive);

  const existing = await MAdmin.findOne({ email }).lean();
  if (existing) {
    throw new AdminServiceError(409, 'email_exists', 'এই ইমেইল দিয়ে একটি অ্যাকাউন্ট আগে থেকেই আছে।');
  }

  try {
    const created = await MAdmin.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      isActive,
    });
    return toDTO(created.toObject());
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AdminServiceError(409, 'email_exists', 'এই ইমেইল দিয়ে একটি অ্যাকাউন্ট আগে থেকেই আছে।');
    }
    throw err;
  }
}

export async function updateAdmin(id: string, input: AdminInput, actorId?: string): Promise<AdminDTO> {
  assertDatabase();
  if (!mongoose.isValidObjectId(id)) {
    throw new AdminServiceError(404, 'not_found', 'অ্যাডমিন অ্যাকাউন্টটি পাওয়া যায়নি।');
  }
  const admin = await MAdmin.findById(id);
  if (!admin) {
    throw new AdminServiceError(404, 'not_found', 'অ্যাডমিন অ্যাকাউন্টটি পাওয়া যায়নি।');
  }

  if (input.name !== undefined) admin.name = normalizeName(input.name);

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (email !== admin.email) {
      const clash = await MAdmin.findOne({ email, _id: { $ne: admin._id } }).lean();
      if (clash) {
        throw new AdminServiceError(409, 'email_exists', 'এই ইমেইল দিয়ে একটি অ্যাকাউন্ট আগে থেকেই আছে।');
      }
      admin.email = email;
    }
  }

  const nextRole = input.role !== undefined ? normalizeRole(input.role, admin.role) : admin.role;
  const nextActive = input.isActive !== undefined ? normalizeActive(input.isActive, admin.isActive) : admin.isActive;

  // Never allow the panel to lock itself out: at least one active admin must remain.
  const losesAdminAccess = (admin.role === 'admin' && admin.isActive) && (nextRole !== 'admin' || !nextActive);
  if (losesAdminAccess && (await countActiveAdmins(String(admin._id))) === 0) {
    throw new AdminServiceError(
      409,
      'last_admin',
      'অন্তত একজন সক্রিয় অ্যাডমিন থাকতে হবে — শেষ অ্যাডমিনের রোল বা স্ট্যাটাস পরিবর্তন করা যাবে না।'
    );
  }
  if (actorId && String(admin._id) === actorId && !nextActive) {
    throw new AdminServiceError(409, 'self_deactivate', 'নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।');
  }

  admin.role = nextRole;
  admin.isActive = nextActive;

  if (input.password !== undefined && input.password !== '') {
    admin.passwordHash = await hashPassword(validatePassword(input.password));
  }

  await admin.save();
  return toDTO(admin.toObject());
}

export async function deleteAdmin(id: string, actorId?: string): Promise<void> {
  assertDatabase();
  if (!mongoose.isValidObjectId(id)) {
    throw new AdminServiceError(404, 'not_found', 'অ্যাডমিন অ্যাকাউন্টটি পাওয়া যায়নি।');
  }
  if (actorId && actorId === id) {
    throw new AdminServiceError(409, 'self_delete', 'নিজের অ্যাকাউন্ট মুছে ফেলা যাবে না।');
  }
  const admin = await MAdmin.findById(id);
  if (!admin) {
    throw new AdminServiceError(404, 'not_found', 'অ্যাডমিন অ্যাকাউন্টটি পাওয়া যায়নি।');
  }
  if (admin.role === 'admin' && admin.isActive && (await countActiveAdmins(String(admin._id))) === 0) {
    throw new AdminServiceError(409, 'last_admin', 'শেষ সক্রিয় অ্যাডমিন অ্যাকাউন্টটি মুছে ফেলা যাবে না।');
  }
  await admin.deleteOne();
}

/** Verify a login attempt. Returns the account or null when credentials fail. */
export async function verifyCredentials(email: unknown, password: unknown): Promise<AdminDTO | null> {
  assertDatabase();
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPassword = typeof password === 'string' ? password : '';
  if (!cleanEmail || !cleanPassword) return null;

  const admin = await MAdmin.findOne({ email: cleanEmail });
  if (!admin || !admin.isActive) {
    // Equalise timing between "unknown user" and "wrong password".
    await bcrypt.compare(cleanPassword, '$2a$12$invalidsaltinvalidsaltuOeVjHkQ0Hh8ZEgUqZq3rjB5r9M9O');
    return null;
  }

  const matches = await bcrypt.compare(cleanPassword, admin.passwordHash);
  if (!matches) return null;

  admin.lastLoginAt = new Date();
  await admin.save();
  return toDTO(admin.toObject());
}

/**
 * Create the first admin from the environment when the collection is empty.
 * Does nothing when an account already exists, so it is safe on every boot.
 */
export async function bootstrapAdminFromEnv(): Promise<void> {
  if (!isDatabaseReady()) return;

  const total = await MAdmin.countDocuments({});
  if (total > 0) return;

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || '').trim() || 'Site Administrator';

  if (!email || !password) {
    console.warn(
      '[auth] No admin account exists yet. Open /admin/login to create the first administrator, or set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD and restart. Do not insert users from the MongoDB Atlas panel.'
    );
    return;
  }

  try {
    const created = await createAdmin({ name, email, password, role: 'admin', isActive: true });
    console.log(`[auth] Created the first administrator account: ${created.email}`);
  } catch (err) {
    console.error('[auth] Could not create the bootstrap administrator:', (err as Error).message);
  }
}
