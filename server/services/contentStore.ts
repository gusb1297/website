import fs from 'fs';
import path from 'path';
import { memoryStore, DEFAULT_THEME } from '../models/schemas';
import { contentCollection, type ContentDoc } from '../config/contentDb';
import { isDatabaseReady } from '../config/mongo';

/**
 * The site content store — MongoDB only, one document per record.
 * ---------------------------------------------------------------------------
 * This module replaces the old "one JSON blob in `sitecontents` + a
 * `data/store.json` cache on the container disk" design. That design is what
 * made content disappear: on Render / Heroku / Railway the disk is wiped on
 * every deploy, and a single blob meant one bad write could erase everything.
 *
 * How it works now
 *   • Every entity lives in its own MongoDB collection as its own document
 *     (`heroslides`, `programs`, `newsitems`, `videos`, `notices`,
 *     `publications`, `galleryalbums`, `galleryphotos`, `committeemembers`,
 *     `partners`, `careers`, `applications`, `stats`), addressed by the same
 *     string `id` the admin panel already uses. Site settings and page copy are
 *     singleton documents in `sitesettings` / `pagecontents`.
 *   • Reads: the collections are loaded once into the in-memory store the
 *     controllers use (a read cache), so serving pages never touches MongoDB.
 *   • Writes: a controller mutates the in-memory store and calls
 *     `persistContent()`, which writes **only the collections that changed**
 *     (diffed against the last snapshot) with `replaceOne(upsert)` +
 *     `deleteMany($nin)` for removals.
 *   • Nothing is ever written to the server's disk. There is no JSON cache to
 *     lose, and no code path that can silently accept a write it cannot keep.
 *
 * Safety rules (these are the reason content can no longer vanish)
 *   1. A write is refused (503) while the collections have not been read back
 *      from MongoDB — an empty in-memory store can therefore never overwrite
 *      real content.
 *   2. A write is refused (503) while MongoDB is unreachable: the admin sees
 *      "not saved" instead of a green tick followed by data loss.
 *   3. On boot, an empty database is filled from the previous architecture
 *      (legacy blob → `data/store.json`) and, failing that, from the newest
 *      automatic backup. Migration never overwrites existing content.
 */

/** Bumped whenever the persisted layout changes (recorded in backups). */
export const CONTENT_FORMAT = 'gusb-content';
export const CONTENT_FORMAT_VERSION = 2;

/** store key → MongoDB collection. */
export const ARRAY_COLLECTIONS = [
  ['heroSlides', 'heroslides'],
  ['programs', 'programs'],
  ['news', 'newsitems'],
  ['videos', 'videos'],
  ['notices', 'notices'],
  ['publications', 'publications'],
  ['galleryAlbums', 'galleryalbums'],
  ['galleryPhotos', 'galleryphotos'],
  ['committee', 'committeemembers'],
  ['partners', 'partners'],
  ['careers', 'careers'],
  ['applications', 'applications'],
  ['stats', 'stats'],
] as const;

export const SINGLE_COLLECTIONS = [
  ['settings', 'sitesettings'],
  ['pageContent', 'pagecontents'],
] as const;

export type ArrayKey = (typeof ARRAY_COLLECTIONS)[number][0];
export type SingleKey = (typeof SINGLE_COLLECTIONS)[number][0];
export type StoreKey = ArrayKey | SingleKey;

/** The single-document collections are addressed with this key. */
export const SINGLETON_KEY = 'site';

/** The pre-`contentStore` blob document (kept only to migrate old installs). */
export const LEGACY_BLOB_COLLECTION = 'sitecontents';
export const LEGACY_BLOB_KEY = 'site';
/** Automatic snapshots (see services/backupService.ts). */
export const BACKUP_COLLECTION = 'contentbackups';
/** One small bookkeeping document (see `emptiedAt` below). */
export const META_COLLECTION = 'contentmeta';

const COLLECTION_BY_KEY: Record<StoreKey, string> = {
  ...(Object.fromEntries(ARRAY_COLLECTIONS) as Record<ArrayKey, string>),
  ...(Object.fromEntries(SINGLE_COLLECTIONS) as Record<SingleKey, string>),
};

export const ALL_COLLECTION_NAMES: string[] = [
  ...ARRAY_COLLECTIONS.map(([, name]) => name),
  ...SINGLE_COLLECTIONS.map(([, name]) => name),
];

/* ── in-process state ───────────────────────────────────────────────────── */

/** Last written (or loaded) JSON per collection, to skip unchanged writes. */
const snapshots = new Map<StoreKey, string>();
/** Ids present in MongoDB per collection, to skip pointless `$nin` deletes. */
const remoteIds = new Map<StoreKey, Set<string>>();
let dirty = new Set<StoreKey>();
let loaded = false;
let loading: Promise<LoadReport> | null = null;
let lastError: string | null = null;
let lastSavedAt: string | null = null;
let lastLoadedAt: string | null = null;
let source: ContentSource = 'none';
/**
 * Set when an administrator empties the site on purpose (deleted the last
 * record). It is what tells "the site was cleaned up" apart from "the database
 * was wiped", so the automatic restore does not resurrect deleted content.
 */
let emptiedAt: string | null = null;
/** How many records MongoDB held when this process loaded them. */
let totalAtLoad = 0;
/** Largest number of records this process has ever seen (after a migration…). */
let maxTotalSeen = 0;

/** True when the current emptiness is intentional (an admin deleted it all). */
export function isEmptyByAdmin(): boolean {
  return Boolean(emptiedAt);
}

export type ContentSource = 'mongodb' | 'legacy-blob' | 'local-file' | 'backup' | 'none';

export interface LoadReport {
  source: ContentSource;
  /** Number of records per store key. */
  counts: Record<string, number>;
  /** Total number of content records (excluding the always-present defaults). */
  totalItems: number;
  empty: boolean;
  /** Set when the previous architecture's data was imported into collections. */
  migratedFrom: string | null;
  at: string;
}

/** Thrown when a change cannot be persisted — the API answers 503. */
export class ContentNotDurableError extends Error {
  status = 503;
  code = 'content_not_durable';
  constructor(message: string) {
    super(message);
    this.name = 'ContentNotDurableError';
  }
}

function databaseUnavailable(): ContentNotDurableError {
  return new ContentNotDurableError(
    'MongoDB-এ সংযোগ নেই, তাই এই পরিবর্তনটি সংরক্ষণ করা যায়নি (কিছুই হারিয়ে যায়নি — পুরনো তথ্য আগের মতোই আছে)। ' +
      'MONGODB_URI ও Atlas Network Access ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।'
  );
}

/* ── reading ────────────────────────────────────────────────────────────── */

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Records without a usable string id cannot be addressed — drop them. */
function usableDocs(docs: ContentDoc[], collection: string): ContentDoc[] {
  const kept: ContentDoc[] = [];
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const id = (doc as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) {
      kept.push(doc);
      continue;
    }
    console.warn(`[content] ignoring a document without an id in ${collection}.`);
  }
  return kept;
}

function mergeSettings(value: unknown): void {
  const stored = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const currentTheme = ((memoryStore.settings as unknown as { theme?: Record<string, unknown> })?.theme ||
    {}) as Record<string, unknown>;
  const merged = { ...memoryStore.settings, ...stored } as typeof memoryStore.settings;
  // Stored theme wins, the seed theme fills the gaps, defaults fill the rest.
  merged.theme = { ...DEFAULT_THEME, ...currentTheme, ...((stored.theme as object) || {}) } as typeof merged.theme;
  memoryStore.settings = merged;
}

function mergePageContent(value: unknown): void {
  const stored = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const seed = (memoryStore.pageContent || {}) as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...seed };
  for (const [key, section] of Object.entries(stored)) {
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      merged[key] = { ...((seed[key] as object) || {}), ...(section as object) };
    } else {
      merged[key] = section;
    }
  }
  memoryStore.pageContent = merged as unknown as typeof memoryStore.pageContent;
}

/** Settings that were actually filled in by an administrator. */
function settingsLookCustomised(settings: unknown): boolean {
  const value = (settings || {}) as Record<string, unknown>;
  return Boolean(value.ngoName || value.ngoNameEn || value.logoUrl || value.email || value.phone);
}

export function countRecords(): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [key] of ARRAY_COLLECTIONS) {
    const list = (memoryStore[key] as unknown[]) || [];
    counts[key] = list.length;
    total += list.length;
  }
  counts.settings = settingsLookCustomised(memoryStore.settings) ? 1 : 0;
  total += counts.settings;
  counts.pageContent = 0;
  return { ...counts, __total: total } as Record<string, number>;
}

function totalFromCounts(counts: Record<string, number>): number {
  let total = 0;
  for (const [key] of ARRAY_COLLECTIONS) total += counts[key] || 0;
  total += counts.settings || 0;
  return total;
}

/** Read every collection into the in-memory store. */
async function readCollections(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const [key, collectionName] of ARRAY_COLLECTIONS) {
    const docs = usableDocs(await contentCollection(collectionName).find(), collectionName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (memoryStore as any)[key] = docs;
    counts[key] = docs.length;
    total += docs.length;
    remoteIds.set(
      key,
      new Set(docs.map((doc) => String(doc.id)))
    );
    snapshots.set(key, json(docs.map((doc) => ({ ...doc }))));
  }

  await readEmptiedMarker();
  const settingsDocs = await contentCollection('sitesettings').find({ key: SINGLETON_KEY }, { limit: 1 });
  const storedSettings = settingsDocs[0]?.value;
  if (storedSettings) {
    mergeSettings(storedSettings);
    // Only *filled-in* settings count as content, exactly like countRecords():
    // a wiped site must still be recognised as empty and restored.
    counts.settings = settingsLookCustomised(storedSettings) ? 1 : 0;
    total += counts.settings;
  } else {
    counts.settings = 0;
  }
  snapshots.set('settings', json(memoryStore.settings));

  const pageDocs = await contentCollection('pagecontents').find({ key: SINGLETON_KEY }, { limit: 1 });
  const storedPage = pageDocs[0]?.value;
  if (storedPage) {
    mergePageContent(storedPage);
    counts.pageContent = 1;
  } else {
    counts.pageContent = 0;
  }
  snapshots.set('pageContent', json(memoryStore.pageContent));

  return { ...counts, __total: total } as Record<string, number>;
}

/* ── migration from the previous architecture (zero-loss upgrade) ───────── */

function snapshotHasContent(store: Record<string, unknown> | null | undefined): boolean {
  if (!store || typeof store !== 'object') return false;
  return Object.entries(store).some(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (key === 'settings' && value && typeof value === 'object') return settingsLookCustomised(value);
    return false;
  });
}

/** Apply a whole legacy store snapshot (arrays replaced, objects merged). */
export function applyLegacyStore(store: Record<string, unknown>): void {
  for (const [key] of ARRAY_COLLECTIONS) {
    const value = store[key];
    if (Array.isArray(value)) {
      const docs = usableDocs(value as ContentDoc[], key);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (memoryStore as any)[key] = docs;
    }
  }
  if (store.settings && typeof store.settings === 'object') mergeSettings(store.settings);
  if (store.pageContent && typeof store.pageContent === 'object') mergePageContent(store.pageContent);
}

/** Old install: one JSON blob in `sitecontents`. Import it, then retire it. */
async function migrateLegacyBlob(): Promise<boolean> {
  try {
    const docs = await contentCollection(LEGACY_BLOB_COLLECTION).find({ key: LEGACY_BLOB_KEY }, { limit: 1 });
    const store = docs[0]?.store as Record<string, unknown> | undefined;
    if (!snapshotHasContent(store)) return false;

    applyLegacyStore(store as Record<string, unknown>);
    await persistAll({ force: true });
    // Retire the blob so a later empty boot cannot resurrect stale content.
    await contentCollection(LEGACY_BLOB_COLLECTION).updateOne(
      { key: LEGACY_BLOB_KEY },
      { $set: { key: `legacy-migrated-${Date.now()}`, migratedAt: new Date() } }
    );
    console.log('[content] Imported the legacy sitecontents blob into per-collection documents.');
    return true;
  } catch (err) {
    console.warn('[content] Legacy blob migration failed:', (err as Error).message);
    return false;
  }
}

/** Only read (never written) — the old JSON cache of the previous design. */
function legacyFilePath(): string {
  return path.join(process.cwd(), 'data', 'store.json');
}

/**
 * First boot after this upgrade on a host that still has the old JSON cache.
 * Imported (never written again) so nothing that exists on disk is lost, then
 * renamed so it can never be imported twice.
 */
function migrateLocalFile(): boolean {
  try {
    const legacyFile = legacyFilePath();
    if (!fs.existsSync(legacyFile)) return false;
    const parsed = JSON.parse(fs.readFileSync(legacyFile, 'utf-8')) as { store?: Record<string, unknown> };
    if (!parsed?.store || !snapshotHasContent(parsed.store)) return false;
    applyLegacyStore(parsed.store);
    console.log('[content] Imported the local data/store.json cache into MongoDB (it is no longer used).');
    try {
      fs.renameSync(legacyFile, `${legacyFile}.imported-${Date.now()}`);
    } catch {
      /* renaming is cosmetic — the file is never read again once migrated */
    }
    return true;
  } catch (err) {
    console.warn('[content] Could not import data/store.json:', (err as Error).message);
    return false;
  }
}

/* ── loading ────────────────────────────────────────────────────────────── */

/**
 * Bring the in-memory store and MongoDB in line. Called on boot and after every
 * reconnection; safe to call repeatedly.
 *
 * A reconnect **pushes** pending local changes instead of re-reading the
 * database over newer edits, so an edit made while MongoDB was down is not lost.
 */
export function loadContent(): Promise<LoadReport> {
  if (loading) return loading;
  loading = (async (): Promise<LoadReport> => {
    const at = new Date().toISOString();
    if (!isDatabaseReady()) {
      return {
        source,
        counts: countRecords(),
        totalItems: totalFromCounts(countRecords()),
        empty: totalFromCounts(countRecords()) === 0,
        migratedFrom: null,
        at,
      };
    }

    if (loaded && dirty.size > 0) {
      await persistAll();
      return report('mongodb', null, at);
    }

    try {
      const counts = await readCollections();
      const total = totalFromCounts(counts);
      totalAtLoad = total;
      loaded = true;
      lastLoadedAt = at;
      lastError = null;

      if (total === 0) {
        let migratedFrom: string | null = null;
        if (await migrateLegacyBlob()) {
          migratedFrom = 'legacy-blob';
        } else if (migrateLocalFile()) {
          migratedFrom = 'local-file';
          await persistAll({ force: true });
        }
        if (migratedFrom) {
          source = migratedFrom as ContentSource;
          return report(migratedFrom as ContentSource, migratedFrom, at);
        }
        source = 'mongodb';
        // `empty: true` lets the caller (server.ts) restore the newest backup.
        return { ...report('mongodb', null, at), empty: true };
      }

      source = 'mongodb';
      return report('mongodb', null, at);
    } catch (err) {
      lastError = (err as Error).message;
      console.error('[content] Could not load site content from MongoDB:', lastError);
      return {
        source,
        counts: countRecords(),
        totalItems: totalFromCounts(countRecords()),
        empty: false,
        migratedFrom: null,
        at,
      };
    }
  })().finally(() => {
    loading = null;
  });
  return loading;
}

function report(from: ContentSource, migratedFrom: string | null, at: string): LoadReport {
  const counts = countRecords();
  const total = totalFromCounts(counts);
  return {
    source: from,
    counts,
    totalItems: total,
    empty: total === 0 && migratedFrom === null,
    migratedFrom,
    at,
  };
}

/* ── writing ────────────────────────────────────────────────────────────── */

function docsForKey(key: StoreKey): ContentDoc[] {
  // Singleton documents carry BOTH `id` and `key`: every collection is
  // addressed by `id` (see config/contentDb.ts), while `key` documents the fact
  // that there is only ever one settings / page-content record.
  if (key === 'settings') {
    return [{ id: SINGLETON_KEY, key: SINGLETON_KEY, value: memoryStore.settings, updatedAt: new Date().toISOString() }];
  }
  if (key === 'pageContent') {
    return [
      { id: SINGLETON_KEY, key: SINGLETON_KEY, value: memoryStore.pageContent, updatedAt: new Date().toISOString() },
    ];
  }
  return ((memoryStore[key] as unknown[]) || []).map((item) => ({ ...(item as ContentDoc) }));
}

function idsOf(key: StoreKey, docs: ContentDoc[]): string[] {
  return key === 'settings' || key === 'pageContent' ? [SINGLETON_KEY] : docs.map((doc) => String(doc.id));
}

async function writeKey(key: StoreKey, force: boolean): Promise<void> {
  const collectionName = COLLECTION_BY_KEY[key];
  const docs = docsForKey(key).map((doc) => JSON.parse(JSON.stringify(doc)) as ContentDoc);
  // `updatedAt` changes on every call, so it must not take part in the diff —
  // otherwise an unchanged collection would be rewritten once per minute.
  const serialized = json(docs.map(({ updatedAt: _updatedAt, ...rest }) => rest));
  if (!force && serialized === snapshots.get(key)) return;

  const keepIds = idsOf(key, docs);
  await contentCollection(collectionName).sync(docs, keepIds);
  remoteIds.set(key, new Set(keepIds));
  snapshots.set(key, serialized);
  lastSavedAt = new Date().toISOString();
  lastError = null;
}

/**
 * Persist the collections marked dirty (or everything when `all` is set).
 *
 * Throws `ContentNotDurableError` when the change could not be stored, so the
 * caller can answer the browser with 503 instead of a false success.
 */
export async function persistContent(options: { all?: boolean; force?: boolean } = {}): Promise<void> {
  if (!isDatabaseReady()) {
    // The dirty set keeps the changed collections: the next successful
    // connection pushes them (see loadContent()).
    throw databaseUnavailable();
  }
  if (!loaded) {
    await loadContent();
    if (!loaded) throw databaseUnavailable();
  }

  const keys: StoreKey[] = options.all
    ? (Object.keys(COLLECTION_BY_KEY) as StoreKey[])
    : ([...dirty].filter((key) => key in COLLECTION_BY_KEY) as StoreKey[]);
  if (!keys.length) return;

  const failures: string[] = [];
  for (const key of keys) {
    try {
      await writeKey(key, Boolean(options.force));
      dirty.delete(key);
    } catch (err) {
      failures.push(`${key}: ${(err as Error).message}`);
    }
  }

  if (failures.length) {
    lastError = failures.join(' | ');
    throw new ContentNotDurableError(
      `MongoDB-এ সংরক্ষণ করা যায়নি: ${lastError}`
    );
  }

  await trackEmptiedState();
}

/**
 * Remember whether the site is empty because an administrator deleted the last
 * record (do not restore it behind their back) or because the data is simply
 * not there yet (restore the newest snapshot).
 */
async function trackEmptiedState(): Promise<void> {
  const total = countRecords().__total || 0;
  const hadContent = totalAtLoad > 0 || maxTotalSeen > 0;
  maxTotalSeen = Math.max(maxTotalSeen, total);
  if (total > 0) {
    if (!emptiedAt) return;
    emptiedAt = null;
  } else {
    // Only an intentional clean-up leaves a marker; a site that never held any
    // content must not be protected from its own snapshots.
    if (emptiedAt || !hadContent) return;
    emptiedAt = new Date().toISOString();
  }
  try {
    await contentCollection(META_COLLECTION).updateOne(
      { id: 'site' },
      { $set: { id: 'site', emptiedAt, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[content] could not record the empty-state marker:', (err as Error).message);
  }
}

/** Read the empty-state marker written by a previous process. */
async function readEmptiedMarker(): Promise<void> {
  try {
    const docs = await contentCollection(META_COLLECTION).find({ id: 'site' }, { limit: 1 });
    emptiedAt = (docs[0]?.emptiedAt as string) || null;
  } catch (err) {
    emptiedAt = null;
    console.warn('[content] could not read the empty-state marker:', (err as Error).message);
  }
}

/** Mark one collection (or, by default, every collection) as changed. */
export function markDirty(key?: StoreKey | StoreKey[]): void {
  if (!key) {
    for (const name of Object.keys(COLLECTION_BY_KEY) as StoreKey[]) dirty.add(name);
    return;
  }
  const keys = Array.isArray(key) ? key : [key];
  for (const item of keys) dirty.add(item);
}

/**
 * Fire-and-forget save for changes that must not break a page view when the
 * database is briefly unreachable (news view counters, for example).
 */
export function persistContentQuiet(): void {
  void persistContent().catch((err) => {
    console.warn('[content] background save failed:', (err as Error).message);
  });
}

/** Write every pending change now (used on shutdown and before backups). */
export async function flushContent(): Promise<void> {
  markDirty();
  await persistContent();
}

export async function persistAll(options: { force?: boolean } = {}): Promise<void> {
  markDirty();
  await persistContent({ all: true, force: options.force });
}

/* ── snapshots & restore (used by the backup service) ───────────────────── */

export interface ContentSnapshot {
  format: typeof CONTENT_FORMAT;
  version: number;
  createdAt: string;
  counts: Record<string, number>;
  store: Record<string, unknown>;
}

/** A complete, JSON-serialisable copy of the current content. */
export function snapshotContent(): ContentSnapshot {
  const counts = countRecords();
  const store: Record<string, unknown> = {};
  for (const [key] of ARRAY_COLLECTIONS) {
    store[key] = JSON.parse(JSON.stringify(memoryStore[key] || []));
  }
  store.settings = JSON.parse(JSON.stringify(memoryStore.settings || {}));
  store.pageContent = JSON.parse(JSON.stringify(memoryStore.pageContent || {}));
  return {
    format: CONTENT_FORMAT,
    version: CONTENT_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    counts,
    store,
  };
}

/**
 * Replace the current content with a snapshot and persist it.
 *
 * Used by "restore a backup" and by the automatic recovery after a wipe. The
 * previous state is NOT preserved in MongoDB — callers take their own backup
 * first (backupService does).
 */
export async function restoreSnapshot(snapshot: ContentSnapshot): Promise<Record<string, number>> {
  const store = snapshot?.store;
  if (!store || typeof store !== 'object') {
    throw new Error('ব্যাকআপ ফাইলটি পড়া যায়নি — এটি একটি বৈধ GUSB ব্যাকআপ নয়।');
  }

  for (const [key] of ARRAY_COLLECTIONS) {
    const value = store[key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (memoryStore as any)[key] = Array.isArray(value) ? usableDocs(value as ContentDoc[], key) : [];
  }
  mergeSettings(store.settings);
  mergePageContent(store.pageContent);

  source = 'backup';
  markDirty();
  await persistAll({ force: true });
  return countRecords();
}

/* ── status ─────────────────────────────────────────────────────────────── */

export interface ContentStatus {
  source: ContentSource;
  /** True when every change is written to MongoDB (survives deploys). */
  durable: boolean;
  loaded: boolean;
  mongoConnected: boolean;
  counts: Record<string, number>;
  totalItems: number;
  pendingWrites: number;
  lastSavedAt: string | null;
  lastLoadedAt: string | null;
  lastError: string | null;
  collections: string[];
}

export function describeContentStatus(): ContentStatus {
  const counts = countRecords();
  const total = totalFromCounts(counts);
  const mongoConnected = isDatabaseReady();
  return {
    source,
    durable: mongoConnected && loaded && !lastError,
    loaded,
    mongoConnected,
    counts,
    totalItems: total,
    pendingWrites: [...dirty].filter((key) => key in COLLECTION_BY_KEY).length,
    lastSavedAt,
    lastLoadedAt,
    lastError,
    collections: ALL_COLLECTION_NAMES,
  };
}

export function isContentLoaded(): boolean {
  return loaded;
}

export function isContentDurable(): boolean {
  return isDatabaseReady() && loaded && !lastError;
}

/** Called from the status endpoints: retry a failed load/save on demand. */
export function healContent(): void {
  if (!isDatabaseReady()) return;
  if (!loaded) {
    void loadContent();
    return;
  }
  if (lastError && dirty.size === 0) {
    void persistContent({ all: true, force: true }).catch(() => undefined);
  } else if (dirty.size) {
    void persistContent().catch(() => undefined);
  }
}

/** Test helper: forget cached state so a fresh boot can be simulated. */
export function resetContentState(): void {
  snapshots.clear();
  remoteIds.clear();
  dirty = new Set<StoreKey>();
  loaded = false;
  loading = null;
  lastError = null;
  lastSavedAt = null;
  lastLoadedAt = null;
  source = 'none';
  emptiedAt = null;
  totalAtLoad = 0;
  maxTotalSeen = 0;
}
