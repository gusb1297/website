/**
 * Audit log for the /hackeradmin operations console.
 * ---------------------------------------------------------------------------
 * Every privileged action — signing in with the console passcode, switching the
 * database off/on, adding or deleting a storage gateway, creating or removing an
 * administrator — is written here, together with who did it and from which IP.
 *
 * Entries are kept in a small in-memory ring buffer (always available, even when
 * MongoDB is switched off) and, best-effort, appended to the `auditlogs`
 * collection. A failed database write never breaks the action it describes: the
 * entry stays in memory and is marked `persisted: false`.
 */
import { contentCollection, type ContentDoc } from '../config/contentDb';
import { isDatabaseReady } from '../config/mongo';
import type { Request } from 'express';

export type AuditLevel = 'info' | 'warn' | 'critical';

export interface AuditEntry {
  id: string;
  at: string;
  /** Who performed the action (`hackeradmin`, or an admin's e-mail). */
  actor: string;
  /** Machine-readable action code, e.g. `database.disable`. */
  action: string;
  /** What the action was performed on (gateway id, admin e-mail …). */
  target?: string;
  level: AuditLevel;
  detail?: string;
  ip?: string;
  userAgent?: string;
  /** False when the entry could not be written to MongoDB. */
  persisted: boolean;
}

/** How many entries the in-memory ring buffer keeps. */
export const AUDIT_BUFFER_SIZE = 400;
const COLLECTION = 'auditlogs';

const buffer: AuditEntry[] = [];
let databaseWrites = 0;
let databaseFailures = 0;

export interface AuditInput {
  actor: string;
  action: string;
  target?: string;
  level?: AuditLevel;
  detail?: string;
  ip?: string;
  userAgent?: string;
}

/** Client IP as reported by the proxy chain, trimmed to something readable. */
export function clientIp(req?: Request): string | undefined {
  if (!req) return undefined;
  const forwarded = (req.headers['x-forwarded-for'] as string | undefined) || '';
  const first = forwarded.split(',')[0]?.trim();
  const value = first || req.socket?.remoteAddress || '';
  return value ? value.replace(/^::ffff:/, '') : undefined;
}

function newId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Record an action. Never throws: the caller is mid-operation and the audit
 * trail must not be able to break the panel.
 */
export function recordAudit(input: AuditInput): AuditEntry {
  const entry: AuditEntry = {
    id: newId(),
    at: new Date().toISOString(),
    actor: input.actor || 'unknown',
    action: input.action,
    target: input.target,
    level: input.level || 'info',
    detail: input.detail,
    ip: input.ip,
    userAgent: input.userAgent ? input.userAgent.slice(0, 180) : undefined,
    persisted: false,
  };

  buffer.unshift(entry);
  if (buffer.length > AUDIT_BUFFER_SIZE) buffer.length = AUDIT_BUFFER_SIZE;

  if (isDatabaseReady()) {
    void contentCollection(COLLECTION)
      .insertMany([entry as unknown as ContentDoc])
      .then(() => {
        entry.persisted = true;
        databaseWrites += 1;
      })
      .catch((err: unknown) => {
        databaseFailures += 1;
        console.warn('[audit] Could not persist entry:', (err as Error).message);
      });
  }

  const line = `[audit] ${entry.level.toUpperCase()} ${entry.actor} → ${entry.action}${
    entry.target ? ` (${entry.target})` : ''
  }${entry.detail ? ` — ${entry.detail}` : ''}`;
  if (entry.level === 'info') console.log(line);
  else console.warn(line);

  return entry;
}

export interface AuditQuery {
  limit?: number;
  action?: string;
  level?: AuditLevel;
}

/**
 * Recent entries, newest first. Reads from MongoDB when it is available (so the
 * list survives restarts) and merges anything the memory buffer holds that the
 * database does not have yet (e.g. entries written while it was switched off).
 */
export async function listAudit(query: AuditQuery = {}): Promise<{ entries: AuditEntry[]; source: 'mongodb' | 'memory' }> {
  const limit = Math.min(Math.max(query.limit && query.limit > 0 ? query.limit : 100, 1), AUDIT_BUFFER_SIZE);
  let fromDatabase: AuditEntry[] = [];
  let source: 'mongodb' | 'memory' = 'memory';

  if (isDatabaseReady()) {
    try {
      const filter: Record<string, unknown> = {};
      if (query.action) filter.action = query.action;
      if (query.level) filter.level = query.level;
      const docs = await contentCollection(COLLECTION).find(filter, { sort: { at: -1 }, limit });
      fromDatabase = docs as unknown as AuditEntry[];
      source = 'mongodb';
    } catch (err) {
      console.warn('[audit] Falling back to the in-memory trail:', (err as Error).message);
    }
  }

  const seen = new Set(fromDatabase.map((entry) => entry.id));
  const merged = [...fromDatabase, ...buffer.filter((entry) => !seen.has(entry.id))].slice(0, limit);
  return { entries: merged, source };
}

export function describeAuditStatus(): {
  inMemory: number;
  databaseWrites: number;
  databaseFailures: number;
} {
  return { inMemory: buffer.length, databaseWrites, databaseFailures };
}
