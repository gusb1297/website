import { createHash, randomUUID } from 'crypto';
import { contentCollection, type ContentDoc } from '../config/contentDb';
import { isDatabaseReady } from '../config/mongo';
import {
  BACKUP_COLLECTION,
  CONTENT_FORMAT,
  CONTENT_FORMAT_VERSION,
  countRecords,
  isEmptyByAdmin,
  restoreSnapshot,
  snapshotContent,
  type ContentSnapshot,
} from './contentStore';
import {
  amStorageHost,
  deleteDocumentFromAmStorage,
  isAmStorageConfigured,
  uploadBytesToAmStorage,
} from './amStorage';

/**
 * Automatic content backups.
 * ---------------------------------------------------------------------------
 * MongoDB is the single source of truth for the site content, but a database
 * can still be wiped (a bad migration, a dropped cluster, an Atlas project that
 * was deleted, a deployment pointing at the wrong connection string). The site
 * therefore keeps **point-in-time snapshots of the whole content**:
 *
 *   • every scheduled interval (default: every 6 hours) when something changed,
 *   • shortly after a content edit (at most once every 30 minutes),
 *   • before every restore (so a restore can be undone),
 *   • on graceful shutdown when content changed since the last backup;
 *
 * and, crucially:
 *
 *   • **on boot, when the database turns out to be empty, the newest snapshot is
 *     restored automatically.** That is the fix for "after the update all my
 *     numbers, images and texts were gone".
 *
 * Each snapshot is stored twice:
 *   1. as a document in the `contentbackups` MongoDB collection (instant,
 *      restorable from the admin panel with one click), and
 *   2. mirrored to the AM Storage gateway as a `.txt` file, so a copy exists
 *      outside the database (best effort — a gateway outage is logged, never
 *      fatal, and never blocks a backup).
 *
 * Nothing is written to the server's own disk.
 */

export type BackupReason = 'manual' | 'scheduled' | 'auto' | 'pre-restore' | 'startup' | 'shutdown';

export interface BackupSummary {
  id: string;
  createdAt: string;
  reason: BackupReason;
  bytes: number;
  totalItems: number;
  counts: Record<string, number>;
  pinned: boolean;
  /** Cloud copy on the AM Storage gateway (may be missing — best effort). */
  amStorageUrl: string | null;
  amStorageFileId: string | null;
  amStorageError: string | null;
}

interface BackupDoc extends ContentDoc {
  id: string;
  createdAt: string;
  reason: BackupReason;
  bytes: number;
  totalItems: number;
  counts: Record<string, number>;
  pinned: boolean;
  format: string;
  version: number;
  amStorageUrl: string | null;
  amStorageFileId: string | null;
  amStorageError: string | null;
  payload: ContentSnapshot;
}

export interface BackupStatus {
  enabled: boolean;
  /** Minutes between two scheduled backups. */
  intervalMinutes: number;
  /** Minutes that must pass between two change-triggered backups. */
  minIntervalMinutes: number;
  keep: number;
  count: number;
  lastBackupAt: string | null;
  lastBackupId: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  mirror: { enabled: boolean; provider: string; host: string; lastError: string | null };
  autoRestored: { backupId: string; createdAt: string; at: string } | null;
}

/* ── configuration ──────────────────────────────────────────────────────── */

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] || '').trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw !== '0' && raw !== 'false' && raw !== 'no';
}

export function backupIntervalMinutes(): number {
  return envNumber('BACKUP_INTERVAL_MINUTES', 360, 5, 24 * 60);
}

export function backupMinIntervalMinutes(): number {
  return envNumber('BACKUP_MIN_INTERVAL_MINUTES', 30, 1, 24 * 60);
}

export function backupKeepCount(): number {
  return envNumber('BACKUP_KEEP', 40, 3, 500);
}

export function backupsEnabled(): boolean {
  return envFlag('BACKUP_ENABLED', true);
}

export function mirrorEnabled(): boolean {
  return envFlag('BACKUP_MIRROR_AM_STORAGE', true);
}

/* ── state ──────────────────────────────────────────────────────────────── */

let lastBackupAt: string | null = null;
let lastBackupId: string | null = null;
let lastBackupHash: string | null = null;
let lastError: string | null = null;
let lastMirrorError: string | null = null;
let nextRunAt: string | null = null;
let autoRestored: BackupStatus['autoRestored'] = null;
let timer: NodeJS.Timeout | null = null;
let changeTimer: NodeJS.Timeout | null = null;
let inFlight: Promise<BackupSummary> | null = null;

function hashSnapshot(snapshot: ContentSnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot.store || {})).digest('hex');
}

function toSummary(doc: BackupDoc): BackupSummary {
  return {
    id: doc.id,
    createdAt: doc.createdAt,
    reason: doc.reason,
    bytes: doc.bytes,
    totalItems: doc.totalItems,
    counts: doc.counts || {},
    pinned: Boolean(doc.pinned),
    amStorageUrl: doc.amStorageUrl || null,
    amStorageFileId: doc.amStorageFileId || null,
    amStorageError: doc.amStorageError || null,
  };
}

/* ── creating backups ───────────────────────────────────────────────────── */

/**
 * Snapshot the current content and store it (MongoDB + AM Storage mirror).
 *
 * Concurrent calls share one run. A mirror failure is recorded, never thrown —
 * the backup stays restorable from MongoDB.
 */
export function createBackup(reason: BackupReason, options: { pinned?: boolean } = {}): Promise<BackupSummary> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!isDatabaseReady()) {
      throw new Error('MongoDB-এ সংযোগ নেই, তাই ব্যাকআপ নেওয়া যায়নি।');
    }

    const snapshot = snapshotContent();
    const payload = JSON.stringify(snapshot);
    const hash = hashSnapshot(snapshot);
    if (reason !== 'manual' && hash === lastBackupHash) {
      // Nothing changed since the previous snapshot — keep the schedule quiet.
      const existing = await latestBackupDoc();
      if (existing) return toSummary(existing);
    }

    const createdAt = new Date();
    const id = `bkp-${createdAt.getTime()}-${randomUUID().slice(0, 8)}`;
    let amStorageUrl: string | null = null;
    let amStorageFileId: string | null = null;
    let amStorageError: string | null = null;

    if (mirrorEnabled() && isAmStorageConfigured()) {
      try {
        const stored = await uploadBytesToAmStorage({
          buffer: Buffer.from(payload, 'utf8'),
          fileName: `gusb-backup-${createdAt.toISOString().replace(/[:.]/g, '-')}.txt`,
          title: `GUSB content backup ${createdAt.toISOString()}`,
          mimeType: 'text/plain',
        });
        amStorageUrl = stored.url;
        amStorageFileId = stored.fileId || null;
        lastMirrorError = null;
      } catch (err) {
        amStorageError = (err as Error).message;
        lastMirrorError = amStorageError;
        console.warn('[backup] AM Storage mirror failed (the MongoDB copy is still safe):', amStorageError);
      }
    }

    const counts = countRecords();
    const doc: BackupDoc = {
      id,
      createdAt: createdAt.toISOString(),
      reason,
      bytes: Buffer.byteLength(payload, 'utf8'),
      totalItems: counts.__total || 0,
      counts,
      pinned: Boolean(options.pinned) || reason === 'manual' || reason === 'pre-restore',
      format: CONTENT_FORMAT,
      version: CONTENT_FORMAT_VERSION,
      amStorageUrl,
      amStorageFileId,
      amStorageError,
      payload: snapshot,
    };

    await contentCollection(BACKUP_COLLECTION).insertMany([doc as ContentDoc]);
    await rotateBackups();

    lastBackupAt = doc.createdAt;
    lastBackupId = doc.id;
    lastBackupHash = hash;
    lastError = null;
    console.log(
      `[backup] snapshot ${doc.id} saved (${doc.totalItems} records, ${Math.round(doc.bytes / 1024)} KB, ${reason})${
        amStorageUrl ? ' + AM Storage copy' : ''
      }.`
    );
    return toSummary(doc);
  })()
    .catch((err) => {
      lastError = (err as Error).message;
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Delete everything beyond the retention window (manual snapshots are kept). */
async function rotateBackups(): Promise<void> {
  const keep = backupKeepCount();
  const docs = (await contentCollection(BACKUP_COLLECTION).find({}, { sort: { createdAt: -1 } })) as BackupDoc[];
  if (docs.length <= keep) return;

  const keepIds = new Set<string>();
  for (const doc of docs) {
    if (doc.pinned) keepIds.add(doc.id);
    if (keepIds.size >= keep) break;
  }
  // Oldest first: fill the remaining slots with the newest unpinned snapshots.
  for (const doc of docs) {
    if (keepIds.size >= keep) break;
    keepIds.add(doc.id);
  }

  const expired = docs.filter((doc) => !keepIds.has(doc.id));
  if (!expired.length) return;
  await contentCollection(BACKUP_COLLECTION).delete({ id: { $in: expired.map((doc) => doc.id) } });
  for (const doc of expired) {
    if (doc.amStorageFileId) void deleteDocumentFromAmStorage(doc.amStorageFileId);
  }
  console.log(`[backup] rotated ${expired.length} old snapshot(s), kept ${keepIds.size}.`);
}

/* ── reading ────────────────────────────────────────────────────────────── */

async function latestBackupDoc(): Promise<BackupDoc | null> {
  const docs = (await contentCollection(BACKUP_COLLECTION).find({}, { sort: { createdAt: -1 }, limit: 1 })) as BackupDoc[];
  return docs[0] || null;
}

export async function listBackups(limit = 60): Promise<BackupSummary[]> {
  if (!isDatabaseReady()) return [];
  try {
    const docs = (await contentCollection(BACKUP_COLLECTION).find(
      {},
      { sort: { createdAt: -1 }, limit, projection: { payload: 0 } }
    )) as BackupDoc[];
    return docs.map(toSummary);
  } catch (err) {
    lastError = (err as Error).message;
    return [];
  }
}

async function findBackupDoc(id: string): Promise<BackupDoc | null> {
  const docs = (await contentCollection(BACKUP_COLLECTION).find({ id }, { limit: 1 })) as BackupDoc[];
  return docs[0] || null;
}

export async function getBackup(id: string): Promise<ContentSnapshot | null> {
  const doc = await findBackupDoc(id);
  return doc?.payload || null;
}

export async function removeBackup(id: string): Promise<boolean> {
  const doc = await findBackupDoc(id);
  if (!doc) return false;
  await contentCollection(BACKUP_COLLECTION).delete({ id });
  if (doc.amStorageFileId) void deleteDocumentFromAmStorage(doc.amStorageFileId);
  return true;
}

/* ── restoring ──────────────────────────────────────────────────────────── */

/**
 * Accept the three shapes a backup file can have:
 *   • a snapshot from this version  (`{ format, store }`)
 *   • a raw store object            (`{ heroSlides: [...], settings: {...} }`)
 *   • the old `data/store.json`     (`{ version, store: {...} }`)
 */
export function normalizeSnapshot(input: unknown): ContentSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;

  if (value.store && typeof value.store === 'object') {
    const inner = value.store as Record<string, unknown>;
    if (Array.isArray(inner.heroSlides) || Array.isArray(inner.news) || Array.isArray(inner.programs)) {
      return {
        format: CONTENT_FORMAT,
        version: typeof value.version === 'number' ? value.version : CONTENT_FORMAT_VERSION,
        createdAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
        counts: {},
        store: inner,
      };
    }
  }
  if (Array.isArray(value.heroSlides) || Array.isArray(value.news) || Array.isArray(value.programs)) {
    return {
      format: CONTENT_FORMAT,
      version: CONTENT_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      counts: {},
      store: value,
    };
  }
  return null;
}

export interface RestoreResult {
  counts: Record<string, number>;
  /** Snapshot taken just before the restore, so the step can be undone. */
  safetyBackup: BackupSummary | null;
  from: string;
}

/** Replace the live content with a snapshot (a safety snapshot is taken first). */
export async function restoreContent(snapshot: ContentSnapshot, from: string): Promise<RestoreResult> {
  if (!isDatabaseReady()) {
    throw new Error('MongoDB-এ সংযোগ নেই, তাই রিস্টোর করা যায়নি।');
  }
  let safetyBackup: BackupSummary | null = null;
  try {
    safetyBackup = await createBackup('pre-restore', { pinned: true });
  } catch (err) {
    console.warn('[backup] could not take a pre-restore snapshot:', (err as Error).message);
  }

  const counts = await restoreSnapshot(snapshot);
  lastBackupHash = null;
  console.log(`[backup] restored content from ${from} (${counts.__total || 0} records).`);
  return { counts, safetyBackup, from };
}

export async function restoreBackup(id: string): Promise<RestoreResult> {
  const doc = await findBackupDoc(id);
  if (!doc) throw new Error('এই ব্যাকআপটি খুঁজে পাওয়া যায়নি।');
  return restoreContent(doc.payload, `backup ${id} (${doc.createdAt})`);
}

/**
 * Boot-time recovery: when MongoDB holds **no content at all** but at least one
 * snapshot exists, the newest snapshot is restored automatically. Without this,
 * a wiped collection (or a fresh cluster pointed at by a new deployment) shows
 * an empty website and the admin assumes everything was lost.
 */
export async function autoRestoreIfEmpty(): Promise<BackupSummary | null> {
  if (!isDatabaseReady() || !backupsEnabled()) return null;
  const counts = countRecords();
  if ((counts.__total || 0) > 0) return null;
  if (isEmptyByAdmin()) {
    // The last record was deleted by an administrator: leave the site empty.
    console.log('[backup] the site was emptied on purpose — no automatic restore.');
    return null;
  }

  const doc = await latestBackupDoc();
  if (!doc || !doc.payload) return null;

  console.warn(
    `[backup] MongoDB holds no content — restoring the newest snapshot ${doc.id} (${doc.createdAt}) automatically so nothing is lost.`
  );
  try {
    await restoreSnapshot(doc.payload);
    autoRestored = { backupId: doc.id, createdAt: doc.createdAt, at: new Date().toISOString() };
    return toSummary(doc);
  } catch (err) {
    lastError = (err as Error).message;
    console.error('[backup] automatic restore failed:', lastError);
    return null;
  }
}

/* ── scheduling ─────────────────────────────────────────────────────────── */

/**
 * Called after a successful content write: take a snapshot soon, but never
 * more often than `BACKUP_MIN_INTERVAL_MINUTES`.
 */
export function scheduleBackupAfterChange(): void {
  if (!backupsEnabled() || !isDatabaseReady()) return;
  const minInterval = backupMinIntervalMinutes() * 60_000;
  if (lastBackupAt && Date.now() - new Date(lastBackupAt).getTime() < minInterval) return;
  if (changeTimer) return;
  changeTimer = setTimeout(() => {
    changeTimer = null;
    void createBackup('auto').catch((err) => console.warn('[backup] automatic snapshot failed:', (err as Error).message));
  }, 10_000);
  changeTimer.unref?.();
}

/**
 * Start the periodic backup timer. The first run happens shortly after boot
 * when there is no snapshot newer than one interval.
 */
export function startBackupScheduler(): void {
  if (!backupsEnabled()) {
    console.log('[backup] automatic backups are disabled (BACKUP_ENABLED=false).');
    return;
  }
  const intervalMs = backupIntervalMinutes() * 60_000;

  const tick = () => {
    nextRunAt = new Date(Date.now() + intervalMs).toISOString();
    if (!isDatabaseReady()) return;
    void createBackup('scheduled')
      .catch((err) => console.warn('[backup] scheduled snapshot failed:', (err as Error).message))
      .finally(() => {
        nextRunAt = new Date(Date.now() + intervalMs).toISOString();
      });
  };

  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  nextRunAt = new Date(Date.now() + intervalMs).toISOString();

  // Catch up on the first boot (or after a long downtime).
  setTimeout(() => {
    if (!isDatabaseReady()) return;
    const minInterval = backupMinIntervalMinutes() * 60_000;
    const stale = !lastBackupAt || Date.now() - new Date(lastBackupAt).getTime() >= minInterval;
    if (stale) tick();
  }, 20_000).unref?.();

  console.log(`[backup] automatic snapshots every ${backupIntervalMinutes()} minutes (keeping ${backupKeepCount()}).`);
}

export function stopBackupScheduler(): void {
  if (timer) clearInterval(timer);
  if (changeTimer) clearTimeout(changeTimer);
  timer = null;
  changeTimer = null;
}

/** Snapshot on a clean shutdown when content changed since the last one. */
export async function backupOnShutdown(): Promise<void> {
  if (!backupsEnabled() || !isDatabaseReady()) return;
  try {
    const snapshot = snapshotContent();
    if (hashSnapshot(snapshot) !== lastBackupHash) {
      await createBackup('shutdown');
    }
  } catch (err) {
    console.warn('[backup] shutdown snapshot failed:', (err as Error).message);
  }
}

export function describeBackupStatus(): BackupStatus {
  return {
    enabled: backupsEnabled(),
    intervalMinutes: backupIntervalMinutes(),
    minIntervalMinutes: backupMinIntervalMinutes(),
    keep: backupKeepCount(),
    count: 0,
    lastBackupAt,
    lastBackupId,
    nextRunAt,
    lastError,
    mirror: {
      enabled: mirrorEnabled() && isAmStorageConfigured(),
      provider: 'am-storage',
      host: amStorageHost(),
      lastError: lastMirrorError,
    },
    autoRestored,
  };
}
