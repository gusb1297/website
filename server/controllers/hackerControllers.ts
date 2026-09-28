/**
 * /hackeradmin — the operations console API.
 * ---------------------------------------------------------------------------
 * Everything an operator needs to run the platform from one place:
 *
 *   POST   /api/hackeradmin/login            passcode → console session
 *   GET    /api/hackeradmin/system           live snapshot of the whole system
 *   POST   /api/hackeradmin/database         switch MongoDB off / on
 *   POST   /api/hackeradmin/maintenance      freeze / unfreeze public writes
 *   GET    /api/hackeradmin/gateways         storage gateways (secrets masked)
 *   POST   /api/hackeradmin/gateways         add a gateway
 *   PUT    /api/hackeradmin/gateways/:id     edit / enable / make primary
 *   DELETE /api/hackeradmin/gateways/:id     delete a gateway
 *   POST   /api/hackeradmin/gateways/:id/test  connectivity probe
 *   POST   /api/hackeradmin/gateways/restore-defaults
 *   GET    /api/hackeradmin/audit            audit trail
 *   POST   /api/hackeradmin/content/flush    force-write pending content
 *   POST   /api/hackeradmin/content/reload   re-read content from MongoDB
 *   POST   /api/hackeradmin/content/backup   snapshot now
 *   GET    /api/hackeradmin/admins           admin accounts
 *   POST   /api/hackeradmin/admins           create an admin
 *   DELETE /api/hackeradmin/admins/:id       delete an admin
 *
 * Every action is audited. Nothing in this file ever returns a secret.
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { describeMongoStatus, isDatabaseReady, isMongoConfigured } from '../config/mongo';
import { describePersistenceStatus, flushStore, syncStoreWithDatabase } from '../config/persistence';
import { describeStorageStatus } from '../services/storage';
import { describeBackupStatus, createBackup, listBackups } from '../services/backupService';
import { describeContentStatus } from '../services/contentStore';
import { memoryStore } from '../models/schemas';
import {
  createGateway,
  deleteGateway,
  describeGatewayRegistry,
  isMediaGatewayDisabledByOperator,
  managedDocumentGateway,
  managedMediaGateway,
  getGatewayRecord,
  listGateways,
  restoreEnvironmentGateways,
  testGateway,
  updateGateway,
  GatewayError,
} from '../services/gatewayRegistry';
import {
  getSystemControlState,
  setDatabaseEnabled,
  setMaintenanceMode,
  syncSystemControl,
} from '../services/systemControl';
import {
  describePasscodeThrottle,
  hackerPasscode,
  issueHackerToken,
  notePasscodeFailure,
  notePasscodeSuccess,
  passcodeFromEnvironment,
  passcodeLockRemaining,
  verifyHackerPasscode,
} from '../services/hackerAuth';
import { clientIp, describeAuditStatus, listAudit, recordAudit } from '../services/auditLog';
import {
  AdminServiceError,
  createAdmin,
  deleteAdmin,
  listAdmins,
} from '../services/adminService';

const OPERATOR = 'hackeradmin';

/** Uniform error translation for the console. */
function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof GatewayError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  if (err instanceof AdminServiceError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  const status = (err as { status?: number }).status || 500;
  console.error('[hackeradmin] unexpected error:', err);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    error: (err as { code?: string }).code || 'server_error',
    message: (err as Error).message || fallback,
  });
}

/* ── session ────────────────────────────────────────────────────────────── */

/** `POST /api/hackeradmin/login` — the passcode gate of the console. */
export const hackerLogin = async (req: AuthRequest, res: Response) => {
  const ip = clientIp(req) || 'unknown';
  const wait = passcodeLockRemaining(ip);
  if (wait > 0) {
    recordAudit({
      actor: OPERATOR,
      action: 'console.login.locked',
      level: 'warn',
      detail: `Throttled attempt from ${ip} (${Math.ceil(wait / 1000)}s remaining).`,
      ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(429).json({
      error: 'too_many_attempts',
      message: `অনেকবার ভুল পাসকোড — ${Math.ceil(wait / 1000)} সেকেন্ড পর আবার চেষ্টা করুন।`,
      retryAfterSeconds: Math.ceil(wait / 1000),
    });
  }

  const passcode = (req.body as { passcode?: unknown })?.passcode;
  if (!verifyHackerPasscode(passcode)) {
    const added = notePasscodeFailure(ip);
    recordAudit({
      actor: OPERATOR,
      action: 'console.login.failed',
      level: 'critical',
      detail: `Wrong passcode from ${ip}.`,
      ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(401).json({
      error: 'invalid_passcode',
      message: added > 0 ? `ভুল পাসকোড। ${Math.ceil(added / 1000)} সেকেন্ড অপেক্ষা করুন।` : 'ভুল পাসকোড।',
      retryAfterSeconds: Math.ceil(added / 1000),
    });
  }

  notePasscodeSuccess(ip);
  const issued = issueHackerToken();
  recordAudit({
    actor: OPERATOR,
    action: 'console.login',
    level: 'info',
    detail: 'Console session opened.',
    ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    token: issued.token,
    expiresAt: issued.expiresAt,
    hours: issued.hours,
    user: {
      id: 'hackeradmin',
      name: 'Operations Console',
      email: 'hackeradmin@console.local',
      role: 'admin' as const,
    },
  });
};

/** `GET /api/hackeradmin/session` — is the console session still valid? */
export const hackerSession = async (req: AuthRequest, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
    passcodeFromEnvironment: passcodeFromEnvironment(),
    throttle: describePasscodeThrottle(),
    serverTime: new Date().toISOString(),
  });
};

/* ── system snapshot ────────────────────────────────────────────────────── */

function maskedMongoTarget(): string {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) return 'not set';
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//i, '');
    const credentials = withoutProtocol.split('@');
    const hostPart = credentials.length > 1 ? credentials[1] : withoutProtocol;
    const host = hostPart.split('/')[0].split('?')[0];
    return host || 'set';
  } catch {
    return 'set';
  }
}

function countRecords(): number {
  let total = 0;
  for (const value of Object.values(memoryStore)) {
    if (Array.isArray(value)) total += value.length;
  }
  return total;
}

/** `GET /api/hackeradmin/system` — the whole system at a glance. */
export const getSystemSnapshot = async (req: AuthRequest, res: Response) => {
  const mongo = describeMongoStatus();
  const control = getSystemControlState();
  const storage = describeStorageStatus();
  const content = describePersistenceStatus();
  const contentStatus = describeContentStatus();
  const registry = describeGatewayRegistry();
  const backups = describeBackupStatus();

  let admins: { total: number; active: number } | null = null;
  let backupCount: number | null = null;
  if (isDatabaseReady()) {
    try {
      const list = await listAdmins();
      admins = { total: list.length, active: list.filter((admin) => admin.isActive).length };
    } catch {
      admins = null;
    }
    try {
      backupCount = (await listBackups(500)).length;
    } catch {
      backupCount = null;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    time: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1048576),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576),
      },
    },
    control,
    mongo: {
      ...mongo,
      configured: isMongoConfigured(),
      operatorDisabled: !control.databaseEnabled,
      disabledAt: control.databaseDisabledAt,
      target: maskedMongoTarget(),
      reconnectLoop: 'active (20s)',
    },
    storage: {
      provider: storage.provider,
      configured: storage.configured,
      state: storage.state,
      cloudName: storage.cloudName,
      folder: storage.folder,
      lastCheck: storage.lastCheck,
      documents: storage.documents,
      hint: storage.hint,
    },
    content: {
      ...content,
      counts: contentStatus.counts,
      records: countRecords(),
      collections: contentStatus.collections,
      pendingWrites: contentStatus.pendingWrites,
    },
    backups: { ...backups, count: backupCount, polledAt: new Date().toISOString() },
    gateways: { ...registry, items: listGateways(), effective: effectiveGateways() },
    audit: describeAuditStatus(),
    admins,
    session: {
      passcodeFromEnvironment: passcodeFromEnvironment(),
      passcodeLength: hackerPasscode().length,
      throttle: describePasscodeThrottle(),
    },
  });
};

/* ── switches ───────────────────────────────────────────────────────────── */

/** `POST /api/hackeradmin/database` — `{ enabled: boolean }`. */
export const postDatabaseSwitch = async (req: AuthRequest, res: Response) => {
  const enabled = Boolean((req.body as { enabled?: unknown })?.enabled);
  try {
    const before = getSystemControlState();
    const state = await setDatabaseEnabled(enabled, OPERATOR);
    // With the database back on, store the decision (and any change made while
    // it was off) so the switch survives a restart.
    if (enabled) await syncSystemControl();

    recordAudit({
      actor: OPERATOR,
      action: enabled ? 'database.enable' : 'database.disable',
      level: enabled ? 'info' : 'critical',
      target: 'MongoDB',
      detail: enabled
        ? 'Database switched ON — writes and admin logins are available again.'
        : 'Database switched OFF — the site serves the in-memory snapshot; nothing can be written.',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({
      ok: true,
      changed: before.databaseEnabled !== state.databaseEnabled,
      control: getSystemControlState(),
      mongo: describeMongoStatus(),
      message: enabled
        ? 'ডাটাবেস চালু করা হয়েছে।'
        : 'ডাটাবেস বন্ধ করা হয়েছে — পাবলিক সাইট ক্যাশ থেকে চলবে, কোনো পরিবর্তন সংরক্ষিত হবে না।',
    });
  } catch (err) {
    fail(res, err, 'ডাটাবেস সুইচ পরিবর্তন করা যায়নি।');
  }
};

/** `POST /api/hackeradmin/maintenance` — `{ enabled, note? }`. */
export const postMaintenanceSwitch = async (req: AuthRequest, res: Response) => {
  const body = (req.body || {}) as { enabled?: unknown; note?: unknown };
  const enabled = Boolean(body.enabled);
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : '';
  try {
    const state = await setMaintenanceMode(enabled, OPERATOR, note);
    recordAudit({
      actor: OPERATOR,
      action: enabled ? 'maintenance.enable' : 'maintenance.disable',
      level: enabled ? 'warn' : 'info',
      detail: enabled
        ? `Public writes frozen${note ? ` — ${note}` : ''}.`
        : 'Public writes unfrozen.',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.json({
      ok: true,
      control: state,
      message: enabled
        ? 'রাইট ফ্রিজ চালু — পাবলিক/অ্যাডমিন পরিবর্তন বন্ধ। কনসোল কাজ করবে।'
        : 'রাইট ফ্রিজ বন্ধ — সবাই আবার সংরক্ষণ করতে পারবে।',
    });
  } catch (err) {
    fail(res, err, 'মেইনটেন্যান্স সুইচ পরিবর্তন করা যায়নি।');
  }
};

/* ── gateways ───────────────────────────────────────────────────────────── */

/**
 * Which gateway uploads actually use right now — including the environment
 * fallback that is in effect while the registry has not been loaded (MongoDB
 * switched off). Without this the console would show an empty list and the
 * operator could not tell whether uploads still work.
 */
function effectiveGateways() {
  const storage = describeStorageStatus();
  const documentGateway = managedDocumentGateway();
  const mediaGateway = managedMediaGateway();
  return {
    documents: {
      configured: storage.documents.configured,
      host: storage.documents.host,
      source: documentGateway?.config ? 'console' : documentGateway ? 'switched-off' : 'environment',
    },
    media: {
      configured: storage.configured,
      cloudName: storage.cloudName || '',
      folder: storage.folder,
      source: mediaGateway ? 'console' : isMediaGatewayDisabledByOperator() ? 'switched-off' : 'environment',
    },
  };
}

export const getGateways = async (_req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ...describeGatewayRegistry(), items: listGateways(), effective: effectiveGateways() });
};

export const postGateway = async (req: AuthRequest, res: Response) => {
  try {
    const view = await createGateway(req.body || {}, OPERATOR);
    recordAudit({
      actor: OPERATOR,
      action: 'gateway.create',
      level: 'warn',
      target: `${view.kind}:${view.name}`,
      detail: `${view.host} (key ${view.keyIdMasked})`,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ ok: true, gateway: view, items: listGateways() });
  } catch (err) {
    fail(res, err, 'গেটওয়ে যোগ করা যায়নি।');
  }
};

export const putGateway = async (req: AuthRequest, res: Response) => {
  try {
    const before = getGatewayRecord(req.params.id);
    if (!before) {
      recordAudit({
        actor: OPERATOR,
        action: 'gateway.update.missing',
        level: 'warn',
        target: req.params.id,
        ip: clientIp(req),
      });
      return res.status(404).json({ error: 'not_found', message: 'গেটওয়েটি পাওয়া যায়নি।' });
    }
    const view = await updateGateway(req.params.id, req.body || {}, OPERATOR);
    recordAudit({
      actor: OPERATOR,
      action: view.enabled ? 'gateway.update' : 'gateway.disable',
      level: 'warn',
      target: `${view.kind}:${view.name}`,
      detail: before.enabled !== view.enabled ? `enabled: ${before.enabled} → ${view.enabled}` : 'settings updated',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true, gateway: view, items: listGateways() });
  } catch (err) {
    fail(res, err, 'গেটওয়ে পরিবর্তন করা যায়নি।');
  }
};

export const removeGateway = async (req: AuthRequest, res: Response) => {
  try {
    const before = getGatewayRecord(req.params.id);
    await deleteGateway(req.params.id, OPERATOR);
    recordAudit({
      actor: OPERATOR,
      action: 'gateway.delete',
      level: 'critical',
      target: before ? `${before.kind}:${before.name}` : req.params.id,
      detail: before ? `${before.baseUrl} removed` : 'record removed',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true, items: listGateways(), message: 'গেটওয়ে মুছে ফেলা হয়েছে।' });
  } catch (err) {
    fail(res, err, 'গেটওয়ে মুছে ফেলা যায়নি।');
  }
};

export const testGatewayHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { view, test } = await testGateway(req.params.id);
    recordAudit({
      actor: OPERATOR,
      action: 'gateway.test',
      level: test.ok ? 'info' : 'warn',
      target: `${view.kind}:${view.name}`,
      detail: test.message,
      ip: clientIp(req),
    });
    res.json({ ok: true, gateway: view, test, items: listGateways() });
  } catch (err) {
    fail(res, err, 'গেটওয়ে পরীক্ষা করা যায়নি।');
  }
};

export const restoreGateways = async (req: AuthRequest, res: Response) => {
  try {
    const added = await restoreEnvironmentGateways(OPERATOR);
    recordAudit({
      actor: OPERATOR,
      action: 'gateway.restore_defaults',
      level: 'warn',
      detail: added.map((record) => `${record.kind}:${record.name}`).join(', ') || 'nothing to restore',
      ip: clientIp(req),
    });
    res.json({ ok: true, items: listGateways(), restored: added.length });
  } catch (err) {
    fail(res, err, 'ডিফল্ট গেটওয়ে ফিরিয়ে আনা যায়নি।');
  }
};

/* ── audit, content, backups, admins ────────────────────────────────────── */

export const getAuditLog = async (req: AuthRequest, res: Response) => {
  const limit = Number(req.query.limit || 100);
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const level = typeof req.query.level === 'string' ? (req.query.level as 'info' | 'warn' | 'critical') : undefined;
  const { entries, source } = await listAudit({ limit: Number.isFinite(limit) ? limit : 100, action, level });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ entries, source, status: describeAuditStatus() });
};

export const postContentFlush = async (req: AuthRequest, res: Response) => {
  try {
    const before = describeContentStatus().pendingWrites;
    await flushStore();
    const after = describePersistenceStatus();
    recordAudit({
      actor: OPERATOR,
      action: 'content.flush',
      level: 'info',
      detail: `pending writes before: ${before}, after: ${after.pendingWrites}`,
      ip: clientIp(req),
    });
    res.json({ ok: true, flushed: before - after.pendingWrites, content: after });
  } catch (err) {
    fail(res, err, 'কন্টেন্ট ফ্লাশ করা যায়নি।');
  }
};

export const postContentReload = async (req: AuthRequest, res: Response) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'database_unavailable',
      message: 'ডাটাবেস বন্ধ/অনুপলব্ধ — আগে System Control থেকে ডাটাবেস চালু করুন।',
    });
  }
  try {
    const report = await syncStoreWithDatabase();
    recordAudit({
      actor: OPERATOR,
      action: 'content.reload',
      level: 'warn',
      detail: `${report.totalItems} records from ${report.source}`,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true, report });
  } catch (err) {
    fail(res, err, 'কন্টেন্ট রিলোড করা যায়নি।');
  }
};

export const postBackupNow = async (req: AuthRequest, res: Response) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'database_unavailable',
      message: 'ডাটাবেস বন্ধ/অনুপলব্ধ — আগে System Control থেকে ডাটাবেস চালু করুন।',
    });
  }
  try {
    const backup = await createBackup('manual', { pinned: true });
    recordAudit({
      actor: OPERATOR,
      action: 'backup.create',
      level: 'info',
      target: backup.id,
      detail: `${backup.totalItems} records`,
      ip: clientIp(req),
    });
    res.status(201).json({ ok: true, backup });
  } catch (err) {
    fail(res, err, 'ব্যাকআপ তৈরি করা যায়নি।');
  }
};

export const getAdmins = async (_req: AuthRequest, res: Response) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      error: 'database_unavailable',
      message: 'ডাটাবেস বন্ধ/অনুপল্বব্ধ — অ্যাডমিন অ্যাকাউন্ট MongoDB-তে থাকে, তাই আগে ডাটাবেস চালু করুন।',
    });
  }
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await listAdmins());
  } catch (err) {
    fail(res, err, 'অ্যাডমিন তালিকা লোড করা যায়নি।');
  }
};

export const postAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await createAdmin(req.body);
    recordAudit({
      actor: OPERATOR,
      action: 'admin.create',
      level: 'critical',
      target: admin.email,
      detail: `role: ${admin.role}`,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json(admin);
  } catch (err) {
    fail(res, err, 'অ্যাডমিন তৈরি করা যায়নি।');
  }
};

export const removeAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const admins = await listAdmins().catch(() => []);
    const target = admins.find((admin) => admin.id === req.params.id);
    await deleteAdmin(req.params.id, undefined);
    recordAudit({
      actor: OPERATOR,
      action: 'admin.delete',
      level: 'critical',
      target: target?.email || req.params.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.json({ message: 'অ্যাডমিন অ্যাকাউন্ট মুছে ফেলা হয়েছে।' });
  } catch (err) {
    fail(res, err, 'অ্যাডমিন মুছে ফেলা যায়নি।');
  }
};
