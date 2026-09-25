import type { ContentCollection, ContentDoc, FindOptions } from '../../server/config/contentDb';

/**
 * A tiny in-memory stand-in for MongoDB, used by the test-suite.
 *
 * It implements exactly the surface `server/config/contentDb.ts` needs, so the
 * whole content layer (load, diff-write, migration, automatic backup and
 * restore) can be exercised in CI — or in a sandbox without a database — while
 * production keeps using the real driver.
 */

type Filter = Record<string, unknown>;

function valueOf(doc: ContentDoc, key: string): unknown {
  return doc[key];
}

function matches(doc: ContentDoc, filter: Filter | undefined): boolean {
  if (!filter) return true;
  for (const [key, condition] of Object.entries(filter)) {
    const value = valueOf(doc, key);
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const operators = condition as Record<string, unknown>;
      for (const [op, operand] of Object.entries(operators)) {
        if (op === '$in') {
          if (!(Array.isArray(operand) && operand.includes(value))) return false;
        } else if (op === '$nin') {
          if (Array.isArray(operand) && operand.includes(value)) return false;
        } else {
          throw new Error(`memoryMongo: unsupported operator ${op}`);
        }
      }
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

function applyProjection(doc: ContentDoc, projection?: Record<string, 0 | 1>): ContentDoc {
  if (!projection) return { ...doc };
  const entries = Object.entries(projection);
  const mode = entries[0]?.[1];
  const copy: ContentDoc = { ...doc };
  for (const [key, flag] of entries) {
    if (flag === 0 || mode === 1) {
      if (flag === 0) delete copy[key];
    }
  }
  if (mode === 1) {
    for (const key of Object.keys(copy)) {
      if (!(key in projection)) delete copy[key];
    }
  }
  return copy;
}

export interface MemoryMongo {
  /** Factory handed to `setCollectionFactory()`. */
  factory(name: string): ContentCollection;
  /** All documents currently stored under a collection name. */
  docs(name: string): ContentDoc[];
  counts(): Record<string, number>;
  /** Replace the contents of a collection (test fixture helper). */
  seed(name: string, docs: ContentDoc[]): void;
  /** Number of write operations performed (proves the diffing works). */
  stats(): { writes: number; deletes: number };
  reset(): void;
}

export function createMemoryMongo(initial?: Record<string, ContentDoc[]>): MemoryMongo {
  const collections = new Map<string, ContentDoc[]>();
  const stats = { writes: 0, deletes: 0 };

  for (const [name, docs] of Object.entries(initial || {})) {
    collections.set(name, docs.map((doc) => ({ ...doc })));
  }

  const list = (name: string): ContentDoc[] => {
    const existing = collections.get(name);
    if (existing) return existing;
    const created: ContentDoc[] = [];
    collections.set(name, created);
    return created;
  };

  const factory = (name: string): ContentCollection => ({
    name,

    async find(filter = {}, options: FindOptions = {}) {
      let docs = list(name)
        .filter((doc) => matches(doc, filter))
        .map((doc) => applyProjection(doc, options.projection));
      const sort = options.sort;
      if (sort) {
        const [key, direction] = Object.entries(sort)[0] || [];
        if (key) {
          docs = [...docs].sort((a, b) => {
            const left = String(a[key] ?? '');
            const right = String(b[key] ?? '');
            return left === right ? 0 : (left > right ? 1 : -1) * (direction === -1 ? -1 : 1);
          });
        }
      }
      if (options.limit && options.limit > 0) docs = docs.slice(0, options.limit);
      return docs;
    },

    async count(filter = {}) {
      return list(name).filter((doc) => matches(doc, filter)).length;
    },

    async sync(docs, keepIds) {
      const current = list(name);
      for (const doc of docs) {
        const index = current.findIndex((item) => item.id === doc.id);
        if (index === -1) current.push({ ...doc });
        else current[index] = { ...doc };
        stats.writes += 1;
      }
      const keep = new Set(keepIds);
      for (let index = current.length - 1; index >= 0; index -= 1) {
        if (!keep.has(String(current[index].id))) {
          current.splice(index, 1);
          stats.deletes += 1;
        }
      }
      return { upserted: docs.length, deleted: 0 };
    },

    async insertMany(docs) {
      const current = list(name);
      for (const doc of docs) {
        current.push({ ...doc });
        stats.writes += 1;
      }
    },

    async delete(filter) {
      const current = list(name);
      let removed = 0;
      for (let index = current.length - 1; index >= 0; index -= 1) {
        if (matches(current[index], filter)) {
          current.splice(index, 1);
          removed += 1;
          stats.deletes += 1;
        }
      }
      return removed;
    },

    async updateOne(filter, update, options) {
      const current = list(name);
      const doc = current.find((item) => matches(item, filter));
      if (!doc) {
        if (options?.upsert) {
          current.push({ ...(filter as ContentDoc), ...((update.$set as ContentDoc) || {}) });
          stats.writes += 1;
        }
        return;
      }
      const set = (update.$set as ContentDoc) || {};
      for (const [key, value] of Object.entries(set)) doc[key] = value;
      stats.writes += 1;
    },
  });

  return {
    factory,
    docs: (name) => list(name).map((doc) => ({ ...doc })),
    counts() {
      const result: Record<string, number> = {};
      for (const [name, docs] of collections) result[name] = docs.length;
      return result;
    },
    seed(name, docs) {
      collections.set(
        name,
        docs.map((doc) => ({ ...doc }))
      );
    },
    stats: () => ({ ...stats }),
    reset() {
      collections.clear();
      stats.writes = 0;
      stats.deletes = 0;
    },
  };
}
