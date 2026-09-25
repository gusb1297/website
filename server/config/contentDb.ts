import mongoose from 'mongoose';

/**
 * MongoDB access for the site content.
 * ---------------------------------------------------------------------------
 * Every content entity (hero slides, programs, news, videos, notices,
 * publications, gallery albums/photos, committee, partners, careers,
 * applications, stats) is stored as **its own document in its own MongoDB
 * collection** — not as one JSON blob, and never on the server's disk.
 *
 * This module is deliberately tiny: it exposes the handful of collection
 * operations the content store needs, so
 *   • the MongoDB driver is used in exactly one place, and
 *   • the whole content layer can be exercised in tests against an in-memory
 *     implementation (see scripts/lib/memoryMongo.ts) — no database required.
 */

/** One persisted record. `id` is the stable key used by the admin panel. */
export type ContentDoc = Record<string, unknown>;

export interface FindOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  /** Mongo-style include/exclude projection (e.g. `{ payload: 0 }`). */
  projection?: Record<string, 0 | 1>;
}

export interface SyncResult {
  upserted: number;
  deleted: number;
}

/**
 * The collection surface used by the content store.
 *
 * Documents are keyed by a string `id` (never a Mongo ObjectId), because the
 * ids are also handed to the browser and stored inside backups.
 */
export interface ContentCollection {
  readonly name: string;
  find(filter?: Record<string, unknown>, options?: FindOptions): Promise<ContentDoc[]>;
  count(filter?: Record<string, unknown>): Promise<number>;
  /**
   * Make the collection contain exactly `docs`: every document is upserted by
   * its `id`, and anything whose id is not in `keepIds` is removed.
   */
  sync(docs: ContentDoc[], keepIds: string[]): Promise<SyncResult>;
  insertMany(docs: ContentDoc[]): Promise<void>;
  delete(filter: Record<string, unknown>): Promise<number>;
  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { upsert?: boolean }
  ): Promise<void>;
}

export type CollectionFactory = (name: string) => ContentCollection;

/* ── MongoDB implementation ─────────────────────────────────────────────── */

function mongoCollection(name: string): ContentCollection {
  const collection = () => {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB is not connected');
    return db.collection(name);
  };

  return {
    name,

    async find(filter = {}, options = {}) {
      // `_id` is an internal detail: content documents are addressed by `id`.
      const cursor = collection()
        .find(filter, { projection: { _id: 0, ...(options.projection || {}) } })
        .sort(options.sort || {})
        .limit(options.limit && options.limit > 0 ? options.limit : 0);
      return (await cursor.toArray()) as ContentDoc[];
    },

    async count(filter = {}) {
      return collection().countDocuments(filter);
    },

    async sync(docs, keepIds) {
      let deleted = 0;
      if (docs.length) {
        // `replaceOne` (instead of `$set`) so field names containing dots or a
        // leading `$` — possible in admin-authored page copy — can never make
        // MongoDB reject the write.
        await collection().bulkWrite(
          docs.map((doc) => ({
            replaceOne: { filter: { id: doc.id }, replacement: doc, upsert: true },
          })),
          { ordered: false }
        );
      }
      if (keepIds.length) {
        const result = await collection().deleteMany({ id: { $nin: keepIds } });
        deleted = result.deletedCount || 0;
      } else {
        const result = await collection().deleteMany({});
        deleted = result.deletedCount || 0;
      }
      return { upserted: docs.length, deleted };
    },

    async insertMany(docs) {
      if (!docs.length) return;
      await collection().insertMany(docs, { ordered: false });
    },

    async delete(filter) {
      const result = await collection().deleteMany(filter);
      return result.deletedCount || 0;
    },

    async updateOne(filter, update, options) {
      await collection().updateOne(filter, update, { upsert: Boolean(options?.upsert) });
    },
  };
}

/* ── factory + cache ────────────────────────────────────────────────────── */

let factory: CollectionFactory = mongoCollection;
const cache = new Map<string, ContentCollection>();

/**
 * Swap the storage implementation. Used by the test-suite (in-memory MongoDB
 * substitute) — production always uses the real driver above.
 * Passing `null` restores the default and clears cached collections.
 */
export function setCollectionFactory(next: CollectionFactory | null): void {
  factory = next || mongoCollection;
  cache.clear();
}

export function contentCollection(name: string): ContentCollection {
  const existing = cache.get(name);
  if (existing) return existing;
  const created = factory(name);
  cache.set(name, created);
  return created;
}
