import { isDatabaseReady, isMongoConfigured } from './mongo';
import { isEphemeralHost } from './env';
import { scheduleBackupAfterChange } from '../services/backupService';
import {
  ContentNotDurableError,
  describeContentStatus,
  flushContent,
  healContent,
  isContentDurable,
  loadContent,
  markDirty,
  persistAll,
  persistContent,
  persistContentQuiet,
  type LoadReport,
} from '../services/contentStore';

/**
 * Persistence façade.
 * ---------------------------------------------------------------------------
 * The real implementation lives in `server/services/contentStore.ts`:
 * every content entity is a document in its own MongoDB collection, and
 * **nothing is written to the server's disk** — there is no JSON cache left to
 * lose on the next deploy (that cache is exactly how content used to vanish).
 *
 * Controllers keep calling `persistStore()`; it is now asynchronous and throws
 * `ContentNotDurableError` when the change did not reach MongoDB, so an admin
 * gets "সংরক্ষণ হয়নি" instead of a green tick followed by lost work.
 */

export { ContentNotDurableError, isContentDurable };

/** Re-exported so `server.ts` can report what was loaded on boot. */
export type { LoadReport };

/**
 * Persist every collection that changed.
 *
 * `await` this in a controller: a rejected promise is turned into a 503 by the
 * JSON error handler in server.ts.
 */
export async function persistStore(): Promise<void> {
  markDirty();
  await persistContent();
  // Content changed → make sure a restorable snapshot exists soon (throttled).
  scheduleBackupAfterChange();
}

/** Save without failing the request (view counters and similar). */
export function persistStoreQuiet(): void {
  markDirty();
  persistContentQuiet();
}

/** Flush pending changes on graceful shutdown. */
export async function flushStore(): Promise<void> {
  await flushContent();
}

/** Load (or re-sync) the content from MongoDB. Safe to call repeatedly. */
export function syncStoreWithDatabase(): Promise<LoadReport> {
  return loadContent();
}

export interface PersistenceStatus {
  /** Where the content currently served from came from. */
  source: 'mongodb' | 'legacy-blob' | 'local-file' | 'backup' | 'none';
  /** True when every change is written to MongoDB (survives deploys). */
  durable: boolean;
  loaded: boolean;
  mongoConfigured: boolean;
  mongoConnected: boolean;
  ephemeralHost: boolean;
  /** Number of records currently served, per collection. */
  counts: Record<string, number>;
  totalItems: number;
  pendingWrites: number;
  lastSavedAt: string | null;
  lastLoadedAt: string | null;
  lastError: string | null;
  hint: string;
}

export function describePersistenceStatus(): PersistenceStatus {
  const content = describeContentStatus();
  const mongoConnected = isDatabaseReady();
  const mongoConfigured = isMongoConfigured();
  const ephemeral = isEphemeralHost();

  let hint = '';
  if (!mongoConfigured) {
    hint =
      'MONGODB_URI সেট করা নেই — কন্টেন্ট কোথাও সংরক্ষিত হচ্ছে না। সব তথ্য MongoDB-তে রাখতে Environment Variables-এ MONGODB_URI যোগ করুন।';
  } else if (!mongoConnected) {
    hint =
      'MONGODB_URI সেট করা আছে কিন্তু ডাটাবেসে পৌঁছানো যাচ্ছে না — সংযোগ ফিরলে পরিবর্তনগুলো MongoDB-তে লেখা হবে। Atlas → Network Access-এ এই সার্ভারের IP অনুমোদন করুন।';
  } else if (content.lastError) {
    hint = `MongoDB-এ শেষ লেখা ব্যর্থ হয়েছে: ${content.lastError}`;
  } else if (!content.loaded) {
    hint = 'MongoDB থেকে কন্টেন্ট এখনও লোড হয়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }

  return {
    source: content.source,
    durable: content.durable,
    loaded: content.loaded,
    mongoConfigured,
    mongoConnected,
    ephemeralHost: ephemeral,
    counts: content.counts,
    totalItems: content.totalItems,
    pendingWrites: content.pendingWrites,
    lastSavedAt: content.lastSavedAt,
    lastLoadedAt: content.lastLoadedAt,
    lastError: content.lastError,
    hint,
  };
}

/** Retry a failed load / save from the status endpoints. */
export function healPersistence(): void {
  healContent();
}

/** Force-write every collection (used after a restore). */
export async function forcePersistEverything(): Promise<void> {
  await persistAll({ force: true });
}
