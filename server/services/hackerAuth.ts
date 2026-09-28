/**
 * /hackeradmin console authentication.
 * ---------------------------------------------------------------------------
 * The operations console is deliberately separate from the ordinary admin
 * accounts: it is opened with a single private passcode
 * (default `Mohi@99221`, overridable with `HACKER_ADMIN_PASSCODE`) and the token
 * it issues is marked `kind: 'hackeradmin'`.
 *
 * That marker matters:
 *   • the console keeps working while MongoDB is switched off (see
 *     middleware/auth.ts — a hackeradmin token is never re-checked against the
 *     database, so the operator can always switch it back on);
 *   • only this token may call the /api/hackeradmin/* endpoints;
 *   • it inherits full administrator rights on every content endpoint, so the
 *     console can do everything the old /admin panel could.
 *
 * Protections: the passcode is compared in constant time, guessed passcodes are
 * throttled per IP with a growing lockout, and every attempt is written to the
 * audit log.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env';

export const HACKER_ADMIN_KIND = 'hackeradmin';
/** How long a console session stays valid. */
export const HACKER_SESSION_HOURS = 12;

const DEFAULT_PASSCODE = 'Mohi@99221';

/** True when the passcode comes from the environment instead of the default. */
export function passcodeFromEnvironment(): boolean {
  return (process.env.HACKER_ADMIN_PASSCODE || '').trim().length > 0;
}

export function hackerPasscode(): string {
  return (process.env.HACKER_ADMIN_PASSCODE || '').trim() || DEFAULT_PASSCODE;
}

function digest(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

/** Constant-time comparison so the passcode cannot be guessed by timing. */
export function verifyHackerPasscode(candidate: unknown): boolean {
  const value = typeof candidate === 'string' ? candidate : '';
  if (!value) return false;
  const expected = digest(hackerPasscode());
  const provided = digest(value);
  return crypto.timingSafeEqual(expected, provided);
}

export interface HackerTokenPayload {
  sub: string;
  kind: typeof HACKER_ADMIN_KIND;
  role: 'admin';
  name: string;
  email: string;
}

export interface IssuedHackerToken {
  token: string;
  expiresAt: string;
  hours: number;
}

export function issueHackerToken(): IssuedHackerToken {
  const payload: HackerTokenPayload = {
    sub: 'hackeradmin',
    kind: HACKER_ADMIN_KIND,
    role: 'admin',
    name: 'Operations Console',
    email: 'hackeradmin@console.local',
  };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: `${HACKER_SESSION_HOURS}h` });
  return {
    token,
    expiresAt: new Date(Date.now() + HACKER_SESSION_HOURS * 3600_000).toISOString(),
    hours: HACKER_SESSION_HOURS,
  };
}

/** Decode a token; null when invalid/expired or not a console token. */
export function readHackerToken(token: string): HackerTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as Partial<HackerTokenPayload> & { kind?: string };
    if (decoded.kind !== HACKER_ADMIN_KIND) return null;
    return {
      sub: String(decoded.sub || 'hackeradmin'),
      kind: HACKER_ADMIN_KIND,
      role: 'admin',
      name: typeof decoded.name === 'string' ? decoded.name : 'Operations Console',
      email: typeof decoded.email === 'string' ? decoded.email : 'hackeradmin@console.local',
    };
  } catch {
    return null;
  }
}

/* ── brute-force throttle ───────────────────────────────────────────────── */

interface AttemptWindow {
  failures: number;
  lockedUntil: number;
  lastAttempt: number;
}

const LOCK_STEPS_MS = [0, 0, 5_000, 30_000, 120_000, 300_000];
const attempts = new Map<string, AttemptWindow>();
const WINDOW_RESET_MS = 30 * 60 * 1000;

function windowFor(ip: string): AttemptWindow {
  const existing = attempts.get(ip);
  if (existing && Date.now() - existing.lastAttempt < WINDOW_RESET_MS) return existing;
  const fresh: AttemptWindow = { failures: 0, lockedUntil: 0, lastAttempt: Date.now() };
  attempts.set(ip, fresh);
  return fresh;
}

/** Milliseconds the caller must wait before trying again (0 = allowed now). */
export function passcodeLockRemaining(ip: string): number {
  const state = attempts.get(ip);
  if (!state) return 0;
  return Math.max(0, state.lockedUntil - Date.now());
}

export function notePasscodeFailure(ip: string): number {
  const state = windowFor(ip);
  state.failures += 1;
  state.lastAttempt = Date.now();
  const wait = LOCK_STEPS_MS[Math.min(state.failures, LOCK_STEPS_MS.length - 1)];
  state.lockedUntil = Date.now() + wait;
  // Keep the map from growing without bound on a busy host.
  if (attempts.size > 5000) attempts.clear();
  return wait;
}

export function notePasscodeSuccess(ip: string): void {
  attempts.delete(ip);
}

/** Number of IPs currently throttled (shown in the console overview). */
export function describePasscodeThrottle(): { trackedIps: number; lockedIps: number } {
  let locked = 0;
  for (const state of attempts.values()) if (state.lockedUntil > Date.now()) locked += 1;
  return { trackedIps: attempts.size, lockedIps: locked };
}
