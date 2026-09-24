import fs from 'fs';
import path from 'path';
import { memoryStore, DEFAULT_THEME, MSiteContent } from '../models/schemas';
import { isDatabaseReady, isMongoConfigured } from './mongo';
import { isEphemeralHost } from './env';

/**
 * Persistence for the in-memory content store.
 *
 * Primary storage: MongoDB (one `sitecontents` document, key = "site").
 * Secondary:       <cwd>/data/store.json (local cache, and the only store in
 *                  development when no MongoDB is configured).
 *
 * Why both: hosts like Render / Heroku / Railway throw away the local disk on
 * every deploy and restart. Only writing `data/store.json` meant every site
 * update wiped all admin content (hero slides, news, gallery records, …).
 * Now every change is written to MongoDB (debounced) and the JSON file is
 * merely a warm cache — if the two ever disagree, the database wins.
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const CONTENT_KEY = 'site';
const STORE_VERSION = 1;

let saveTimer: NodeJS.Timeout | null = null;
let fileSnapshot: string | null = null;
let dbSnapshot: string | null = null;
let dbWriteInFlight: Promise<void> | null = null;
let dbWriteQueued = false;
let syncInFlight: Promise<boolean> | null = null;
/** Set once the database copy has been loaded (or confirmed empty). */
let dbLoaded = false;
/** True when the store changed in this process before MongoDB was reachable. */
let dirtySinceBoot = false;

export type ContentSource = 'mongodb' | 'file' | 'none';
let activeSource: ContentSource = 'none';
let lastDbError: string | null = null;
let lastDbSaveAt: string | null = null;

function serialize(): string {
  return JSON.stringify({ version: STORE_VERSION, savedAt: new Date().toISOString(), store: memoryStore }, null, 2);
}

/** Layer a persisted snapshot on top of the seeds (never removes seed keys). */
function applySnapshot(persisted: Record<string, unknown>): void {
  Object.keys(persisted).forEach((key) => {
    const value = persisted[key];
    if (value === undefined || value === null) return;
    if (!(key in memoryStore)) return;
    if (key === 'settings') {
      memoryStore.settings = { ...memoryStore.settings, ...(value as object) } as typeof memoryStore.settings;
    } else if (key === 'pageContent') {
      memoryStore.pageContent = {
        ...memoryStore.pageContent,
        ...(value as object),
      } as typeof memoryStore.pageContent;
    } else if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (memoryStore as any)[key] = value;
    }
  });

  // Guarantee the theme object is always present (older snapshots may lack it).
  memoryStore.settings.theme = {
    ...(memoryStore.settings.theme || {}),
    ...DEFAULT_THEME,
    ...(memoryStore.settings.theme || {}),
  };
}

/**
 * Merge a database snapshot over the in-memory store.
 *
 * Normally the database copy simply replaces the local one. When writes
 * already happened in this process before the database became reachable
 * (e.g. a CV was submitted while MongoDB was down at boot) those records are
 * kept: each array collection becomes "database items + local-only items".
 */
function applyDatabaseSnapshot(dbStore: Record<string, unknown>): void {
  if (!dirtySinceBoot) {
    applySnapshot(dbStore);
    return;
  }

  const localOnly: Record<string, unknown[]> = {};
  Object.keys(dbStore).forEach((key) => {
    const dbValue = dbStore[key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localValue = (memoryStore as any)[key];
    if (!Array.isArray(dbValue) || !Array.isArray(localValue)) return;
    const dbIds = new Set(dbValue.map((item) => (item as { id?: string })?.id));
    localOnly[key] = localValue.filter((item) => !dbIds.has((item as { id?: string })?.id));
  });

  applySnapshot(dbStore);

  Object.keys(localOnly).forEach((key) => {
    if (!localOnly[key].length) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (memoryStore as any)[key] = [...((memoryStore as any)[key] as unknown[]), ...localOnly[key]];
  });
}

/** True when the snapshot contains at least one piece of admin content. */
function snapshotHasContent(store: Record<string, unknown> | undefined | null): boolean {
  if (!store || typeof store !== 'object') return false;
  return Object.entries(store).some(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (key === 'settings' && value && typeof value === 'object') {
      const settings = value as Record<string, unknown>;
      return Boolean(settings.ngoName || settings.ngoNameEn || settings.logoUrl || settings.email || settings.phone);
    }
    return false;
  });
}

/** Load cached content from data/store.json. Returns true when a file was found. */
export function loadStore(): boolean {
  try {
    if (!fs.existsSync(DATA_FILE)) return false;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object' || !parsed.store) return false;

    applySnapshot(parsed.store as Record<string, unknown>);
    fileSnapshot = raw;
    activeSource = 'file';
    return true;
  } catch (err) {
    console.warn('[persistence] Could not load store file, using seed data:', (err as Error).message);
    return false;
  }
}

/**
 * Bring the in-memory store and MongoDB (the source of truth) in line.
 * Safe to call repeatedly — it runs on the initial connection, after every
 * reconnection, and before the first database write.
 *
 * - First successful call and a content document exists → the database copy
 *   replaces whatever the local file provided.
 * - First successful call and no document yet, but the local file had content
 *   (first boot after this upgrade / a VPS still carrying store.json) → the
 *   local content is migrated into MongoDB so nothing is lost.
 * - Later calls (reconnections) → pending in-memory changes are pushed to
 *   MongoDB; the database is never re-read over newer local edits.
 */
export function syncStoreWithDatabase(): Promise<boolean> {
  if (!isDatabaseReady()) return Promise.resolve(false);
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    if (dbLoaded) {
      await writeStoreToDatabase();
      return !lastDbError;
    }

    try {
      const doc = await MSiteContent.findOne({ key: CONTENT_KEY }).lean();
      if (doc && doc.store && typeof doc.store === 'object') {
        const hadLocalWrites = dirtySinceBoot;
        applyDatabaseSnapshot(doc.store as Record<string, unknown>);
        dbSnapshot = JSON.stringify(doc.store);
        dbLoaded = true;
        dirtySinceBoot = false;
        activeSource = 'mongodb';
        lastDbError = null;
        lastDbSaveAt = doc.savedAt ? new Date(doc.savedAt).toISOString() : null;
        console.log('[persistence] Loaded site content from MongoDB.');
        // Keep the local cache in sync with the authoritative copy, and push
        // back anything that was written locally before the database was up.
        writeStoreFile();
        if (hadLocalWrites) await writeStoreToDatabase();
        return !lastDbError;
      }

      dbLoaded = true;
      dirtySinceBoot = false;
      lastDbError = null;
      activeSource = 'mongodb';
      if (snapshotHasContent(memoryStore as unknown as Record<string, unknown>)) {
        console.log(
          '[persistence] No content document in MongoDB yet — migrating local data/store.json into the database.'
        );
        await writeStoreToDatabase();
        return !lastDbError;
      }

      console.log('[persistence] MongoDB connected — site content will be saved there from now on.');
      return true;
    } catch (err) {
      lastDbError = (err as Error).message;
      console.error('[persistence] Could not load site content from MongoDB:', lastDbError);
      return false;
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Persist the store. Debounced (max once per 400ms) + trailing save. */
export function persistStore(): void {
  if (!dbLoaded) dirtySinceBoot = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeStore();
  }, 400);
}

/** Write to every available backend (MongoDB first, local file as cache). */
export function writeStore(): void {
  void writeStoreToDatabase();
  writeStoreFile();
}

/** Write the JSON cache on disk (harmless when the disk is ephemeral). */
export function writeStoreFile(): void {
  try {
    const data = serialize();
    // Skip the write when nothing changed since the last flush.
    if (data === fileSnapshot) return;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, data, 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
    fileSnapshot = data;
  } catch (err) {
    console.warn('[persistence] Failed to write store file:', (err as Error).message);
  }
}

/**
 * Upsert the content document. Concurrent calls are coalesced: while one write
 * is in flight the next one is queued and runs with the latest state.
 *
 * Never writes before the database copy has been read (`dbLoaded`), so a
 * half-empty in-memory store can never clobber real content in MongoDB.
 */
export async function writeStoreToDatabase(options: { force?: boolean } = {}): Promise<void> {
  if (!isDatabaseReady()) return;
  if (!dbLoaded) {
    dirtySinceBoot = true;
    await syncStoreWithDatabase();
    return;
  }
  if (dbWriteInFlight) {
    dbWriteQueued = true;
    return dbWriteInFlight;
  }

  const write: Promise<void> = (async () => {
    // `force` re-sends an unchanged store once — used to confirm MongoDB
    // accepts writes again after an error (see healPersistence()).
    let force = Boolean(options.force);
    try {
      do {
        dbWriteQueued = false;
        // Round-trip through JSON so Mongoose receives plain data (no class
        // instances / undefined values) and the comparison stays cheap.
        const plain = JSON.parse(JSON.stringify(memoryStore)) as Record<string, unknown>;
        const serialized = JSON.stringify(plain);
        if (serialized === dbSnapshot && !force) continue;
        force = false;

        await MSiteContent.updateOne(
          { key: CONTENT_KEY },
          { $set: { store: plain, version: STORE_VERSION, savedAt: new Date() } },
          { upsert: true }
        );
        dbSnapshot = serialized;
        lastDbError = null;
        lastDbSaveAt = new Date().toISOString();
        activeSource = 'mongodb';
      } while (dbWriteQueued);
    } catch (err) {
      lastDbError = (err as Error).message;
      console.error('[persistence] Failed to save site content to MongoDB:', lastDbError);
    }
  })().finally(() => {
    // Cleared in a chained `.finally` on purpose: it always runs after the
    // assignment below. A `finally` inside the async body ran synchronously
    // when there was nothing to write — i.e. BEFORE the assignment — which
    // left a settled promise in dbWriteInFlight, so every later save returned
    // early and never reached MongoDB while the status still said "durable".
    if (dbWriteInFlight === write) dbWriteInFlight = null;
    // A save requested after the loop above had already finished: run it now.
    if (dbWriteQueued) {
      dbWriteQueued = false;
      void writeStoreToDatabase();
    }
  });
  dbWriteInFlight = write;
  return write;
}

const HEAL_MIN_INTERVAL_MS = 60_000;
let lastHealAt = 0;

/**
 * Called by the status endpoints (/api/health, /api/storage/status).
 *
 * One failed MongoDB load/save used to keep the admin banner red until the next
 * content edit happened to succeed — unchanged content is never re-sent, so
 * nothing cleared the error. While MongoDB is connected, retry at most once a
 * minute: finish the initial load, or re-send the store to prove writes work.
 */
export function healPersistence(): void {
  if (!isDatabaseReady() || syncInFlight || dbWriteInFlight) return;
  if (dbLoaded && !lastDbError) return;
  const now = Date.now();
  if (now - lastHealAt < HEAL_MIN_INTERVAL_MS) return;
  lastHealAt = now;
  if (!dbLoaded) void syncStoreWithDatabase();
  else void writeStoreToDatabase({ force: true });
}

/** Flush pending changes on graceful shutdown (awaits the database write). */
export async function flushStore(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeStoreFile();
  await writeStoreToDatabase();
}

export interface PersistenceStatus {
  /** Where the content currently served from was loaded / is saved. */
  source: ContentSource;
  /** True when admin edits are written to MongoDB (survive deploys). */
  durable: boolean;
  mongoConfigured: boolean;
  mongoConnected: boolean;
  ephemeralHost: boolean;
  lastDbSaveAt: string | null;
  lastDbError: string | null;
  hint: string;
}

export function describePersistenceStatus(): PersistenceStatus {
  const mongoConnected = isDatabaseReady();
  const mongoConfigured = isMongoConfigured();
  const ephemeral = isEphemeralHost();
  const durable = mongoConnected && dbLoaded && !lastDbError;

  let hint = '';
  if (!mongoConfigured) {
    hint = ephemeral
      ? 'MONGODB_URI is not set: content is only kept in data/store.json, which this host deletes on every deploy. Set MONGODB_URI so content survives.'
      : 'MONGODB_URI is not set: content is kept only in data/store.json on the local disk.';
  } else if (!mongoConnected) {
    hint =
      'MongoDB is configured but not reachable right now — edits are cached in data/store.json and will be written to MongoDB as soon as the connection is back.';
  } else if (lastDbError) {
    hint = `The last MongoDB write failed: ${lastDbError}`;
  }

  return {
    source: activeSource,
    durable,
    mongoConfigured,
    mongoConnected,
    ephemeralHost: ephemeral,
    lastDbSaveAt,
    lastDbError,
    hint,
  };
}
