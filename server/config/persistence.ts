import fs from 'fs';
import path from 'path';
import { memoryStore, DEFAULT_THEME } from '../models/schemas';

/**
 * Lightweight JSON file persistence for the in-memory store.
 *
 * All admin edits are written to <cwd>/data/store.json (debounced) so content
 * survives process restarts without requiring an external database. When a
 * real database is configured later this module is the single place to swap.
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

let saveTimer: NodeJS.Timeout | null = null;
let snapshot: string | null = null;

function serialize(): string {
  return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), store: memoryStore }, null, 2);
}

/** Load persisted content over the seed data. Returns true when a file was found. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadStore(): boolean {
  try {
    if (!fs.existsSync(DATA_FILE)) return false;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object' || !parsed.store) return false;

    // Merge persisted collections over the seeds so newly added seed keys
    // (e.g. pageContent) still exist after an upgrade.
    const persisted: Record<string, unknown> = parsed.store;
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

    return true;
  } catch (err) {
    console.warn('[persistence] Could not load store file, using seed data:', (err as Error).message);
    return false;
  }
}

/** Persist the store to disk. Debounced (max once per 400ms) + trailing save. */
export function persistStore(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeStore();
  }, 400);
}

export function writeStore(): void {
  try {
    const data = serialize();
    // Skip the write when nothing changed since the last flush.
    if (data === snapshot) return;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, data, 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
    snapshot = data;
  } catch (err) {
    console.warn('[persistence] Failed to write store file:', (err as Error).message);
  }
}

/** Flush pending changes on graceful shutdown. */
export function flushStore(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeStore();
}
