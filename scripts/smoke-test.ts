/**
 * Content-persistence smoke test (no database required).
 * -----------------------------------------------------------------------------
 * Runs the real content layer — load, diff-write, migration, automatic backup
 * and restore — against an in-memory MongoDB substitute, and asserts the
 * promises this project makes:
 *
 *   1. content lives in MongoDB collections, never on the server disk;
 *   2. a restart brings every record back;
 *   3. a wiped database is refilled from the newest snapshot automatically;
 *   4. an unreachable database refuses the write instead of losing it.
 *
 * Run with:  npm run test:content
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createMemoryMongo, type MemoryMongo } from './lib/memoryMongo';
import { setCollectionFactory } from '../server/config/contentDb';
import { setDatabaseReadyOverride } from '../server/config/mongo';
import {
  initializeContentStore,
  memoryStore,
} from '../server/models/schemas';
import {
  ALL_COLLECTION_NAMES,
  BACKUP_COLLECTION,
  LEGACY_BLOB_COLLECTION,
  countRecords,
  isContentDurable,
  isEmptyByAdmin,
  loadContent,
  resetContentState,
} from '../server/services/contentStore';
import { persistStore } from '../server/config/persistence';
import {
  autoRestoreIfEmpty,
  createBackup,
  listBackups,
  restoreBackup,
} from '../server/services/backupService';

let passed = 0;
const failures: string[] = [];
let currentPhase = '';

function phase(name: string): void {
  currentPhase = name;
  console.log(`\n\x1b[1m▸ ${name}\x1b[0m`);
}

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures.push(`[${currentPhase}] ${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
  }
}

function equal(label: string, actual: unknown, expected: unknown): void {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function expectThrows(label: string, fn: () => Promise<unknown>, code?: string): Promise<void> {
  try {
    await fn();
    check(label, false, 'the call did not fail');
  } catch (err) {
    const actualCode = (err as { code?: string }).code || (err as Error).name;
    check(label, !code || actualCode === code, `got ${actualCode}: ${(err as Error).message}`);
  }
}

/* ── fixtures ───────────────────────────────────────────────────────────── */

const slide = (id: string, order: number) => ({
  id,
  image: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
  imagePublicId: `vdo_bogura/hero/${id}`,
  headline: `স্লাইড ${order}`,
  subtext: 'sub',
  order,
  isActive: true,
});

const stat = (id: string, value: number) => ({ id, label: { bn: 'প্রকল্প', en: 'Projects' }, value, suffix: '+', order: 1 });

/** Simulate a process restart: empty memory + forgotten caches. */
function restart(): void {
  initializeContentStore();
  resetContentState();
}

async function main(): Promise<void> {
  // Work in a scratch directory so the test can prove nothing is written next
  // to the code (the old design kept data/store.json there).
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gusb-content-test-'));
  process.chdir(workDir);

  // No network calls from the test: keep the snapshots in MongoDB only.
  process.env.BACKUP_MIRROR_AM_STORAGE = 'false';
  process.env.BACKUP_ENABLED = 'true';
  process.env.BACKUP_MIN_INTERVAL_MINUTES = '0';

  const mongo: MemoryMongo = createMemoryMongo();
  setCollectionFactory(mongo.factory);
  let online = true;
  setDatabaseReadyOverride(() => online);

  phase('1. First boot with an empty database');
  restart();
  let report = await loadContent();
  equal('reports zero records', report.totalItems, 0);
  check('is not durable before a write', !isContentDurable() || report.empty);
  check(
    'no collection holds a record',
    Object.values(mongo.counts()).every((value) => value === 0),
    JSON.stringify(mongo.counts())
  );

  phase('2. Admin creates content → written to MongoDB collections');
  memoryStore.heroSlides.push(slide('hs-1', 1) as never, slide('hs-2', 2) as never);
  memoryStore.stats.push(stat('st-1', 42) as never);
  memoryStore.settings.ngoName = 'গ্রাম উন্নয়ন সংস্থা বগুড়া';
  memoryStore.settings.phone = '+880 1712-345678';
  memoryStore.settings.theme = { primary: '#123456', accent: '#abcdef' };
  await persistStore();

  equal('heroslides collection', mongo.docs('heroslides').map((doc) => doc.id), ['hs-1', 'hs-2']);
  equal('stats collection', mongo.docs('stats').length, 1);
  equal('sitesettings is a singleton', mongo.docs('sitesettings').length, 1);
  const storedSettings = (mongo.docs('sitesettings')[0]?.value || {}) as Record<string, unknown>;
  equal('settings kept the organisation name', storedSettings.ngoName, 'গ্রাম উন্নয়ন সংস্থা বগুড়া');
  equal('theme was stored', storedSettings.theme, { primary: '#123456', accent: '#abcdef' });
  check('content is durable', isContentDurable());

  phase('3. Nothing is written to the server disk');
  check('no data/ directory was created', !fs.existsSync(path.join(workDir, 'data')));
  check('no uploads/ directory was created', !fs.existsSync(path.join(workDir, 'uploads')));

  phase('4. Unchanged content is not rewritten');
  const writesBefore = mongo.stats().writes;
  await persistStore();
  equal('no extra write operations', mongo.stats().writes, writesBefore);

  phase('5. Deleting a record removes it from MongoDB');
  memoryStore.heroSlides = memoryStore.heroSlides.filter((item) => item.id !== 'hs-1');
  await persistStore();
  equal('only the remaining slide is stored', mongo.docs('heroslides').map((doc) => doc.id), ['hs-2']);

  phase('6. Restart → every record comes back from MongoDB');
  restart();
  report = await loadContent();
  equal('every record came back (1 slide + 1 stat + custom settings)', report.totalItems, 3);
  equal('per-collection counts', [report.counts.heroSlides, report.counts.stats, report.counts.settings], [1, 1, 1]);
  equal('slide survived', memoryStore.heroSlides.map((item) => item.id), ['hs-2']);
  equal('stat survived', memoryStore.stats[0]?.value, 42);
  equal('settings survived', memoryStore.settings.phone, '+880 1712-345678');
  equal('theme survived', memoryStore.settings.theme, { primary: '#123456', accent: '#abcdef' });

  phase('7. Automatic snapshot after a content change');
  memoryStore.programs.push({
    id: 'prg-1',
    title: 'শিক্ষা কার্যক্রম',
    slug: 'shikkha',
    icon: 'Sprout',
    shortDesc: 'short',
    content: 'content',
    coverImage: 'https://res.cloudinary.com/demo/image/upload/prg.jpg',
    coverImagePublicId: 'vdo_bogura/programs/prg',
    status: 'ongoing',
    order: 1,
    beneficiariesCount: 1200,
    districtsCovered: 3,
  } as never);
  await persistStore();
  await createBackup('manual');
  const backups = await listBackups();
  equal('one snapshot exists', backups.length, 1);
  check('snapshot counted the records', (backups[0]?.totalItems || 0) >= 3, JSON.stringify(backups[0]));

  phase('8. Wiped database → newest snapshot restored automatically');
  mongo.seed('heroslides', []);
  mongo.seed('stats', []);
  mongo.seed('programs', []);
  mongo.seed('sitesettings', []);
  mongo.seed('pagecontents', []);
  restart();
  report = await loadContent();
  equal('database is reported empty', report.empty, true);
  const restored = await autoRestoreIfEmpty();
  check('a snapshot was restored', Boolean(restored), 'no snapshot found');
  equal('slide is back', memoryStore.heroSlides.map((item) => item.id), ['hs-2']);
  equal('stat is back', memoryStore.stats[0]?.value, 42);
  equal('program is back', memoryStore.programs[0]?.title, 'শিক্ষা কার্যক্রম');
  equal('settings are back', memoryStore.settings.phone, '+880 1712-345678');
  check('restored content is in MongoDB again', mongo.docs('heroslides').length === 1);

  phase('9. Restoring an older snapshot (with a pre-restore safety net)');
  const beforeEdit = (await listBackups())[0];
  memoryStore.stats = [];
  await persistStore();
  equal('the stat is gone', countRecords().stats, 0);
  await restoreBackup(String(beforeEdit?.id));
  equal('the stat is back after the restore', countRecords().stats, 1);
  const afterRestore = await listBackups();
  check('a pre-restore snapshot was taken', afterRestore.some((item) => item.reason === 'pre-restore'));

  phase('10. Legacy `sitecontents` blob is migrated (zero-loss upgrade)');
  restart();
  mongo.reset();
  mongo.seed(LEGACY_BLOB_COLLECTION, [
    {
      key: 'site',
      version: 1,
      store: {
        heroSlides: [slide('old-1', 1)],
        news: [],
        settings: { ngoName: 'পুরনো নাম', phone: '01700-000000' },
      },
    },
  ]);
  report = await loadContent();
  equal('migrated from the legacy blob', report.migratedFrom, 'legacy-blob');
  equal('legacy slide was imported', memoryStore.heroSlides.map((item) => item.id), ['old-1']);
  equal('legacy settings were imported', memoryStore.settings.phone, '01700-000000');
  check('legacy slide is now a document', mongo.docs('heroslides').length === 1);
  check('the blob was retired (no longer addressable as the live store)', mongo.docs(LEGACY_BLOB_COLLECTION)[0]?.key !== 'site');

  phase('11. An old `data/store.json` is imported, then never used again');
  restart();
  mongo.reset();
  fs.mkdirSync(path.join(workDir, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(workDir, 'data', 'store.json'),
    JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      store: { heroSlides: [slide('file-1', 1)], settings: { ngoName: 'ফাইল থেকে' } },
    })
  );
  report = await loadContent();
  equal('migrated from the local file', report.migratedFrom, 'local-file');
  equal('file slide was imported', memoryStore.heroSlides.map((item) => item.id), ['file-1']);
  check('the imported file was renamed', fs.readdirSync(path.join(workDir, 'data')).every((name) => name !== 'store.json'));
  check('imported content is in MongoDB', mongo.docs('heroslides').length === 1);

  phase('12. MongoDB unreachable → the write is refused, nothing is lost');
  online = false;
  const slidesBefore = memoryStore.heroSlides.length;
  await expectThrows('write is rejected with 503', () => persistStore(), 'content_not_durable');
  equal('in-memory content is untouched', memoryStore.heroSlides.length, slidesBefore);
  const probe = await loadContent();
  check('loading with no connection does not throw', probe !== null);
  check('the site still serves the loaded content', memoryStore.heroSlides.length === slidesBefore);

  phase('13. Reconnecting → pending changes reach MongoDB (no restart needed)');
  memoryStore.heroSlides.push(slide('after-outage', 9) as never);
  await expectThrows('still refused while offline', () => persistStore(), 'content_not_durable');
  online = true;
  await persistStore();
  equal(
    'the slide written after the outage is stored',
    mongo.docs('heroslides').map((doc) => String(doc.id)).includes('after-outage'),
    true
  );

  phase('14. Snapshot collection is separate from the content collections');
  await createBackup('manual');
  check('backups live in their own collection', mongo.docs(BACKUP_COLLECTION).length > 0);
  check('backups are not mixed into content', !mongo.docs('heroslides').some((doc) => String(doc.id).startsWith('bkp-')));
  equal('page content is a single document', mongo.docs('pagecontents').length, 1);

  phase('15. An administrator emptying the site is not undone');
  // Clear everything the way the admin panel does (record by record).
  memoryStore.heroSlides = [];
  memoryStore.stats = [];
  memoryStore.programs = [];
  memoryStore.settings.ngoName = '';
  memoryStore.settings.phone = '';
  memoryStore.settings.email = '';
  memoryStore.settings.logoUrl = '';
  await persistStore();
  equal('nothing is left', countRecords().__total, 0);
  check('the clean-up is remembered', isEmptyByAdmin());
  // A restart must respect that decision (the marker survives in MongoDB).
  for (const name of ALL_COLLECTION_NAMES) mongo.seed(name, []);
  restart();
  report = await loadContent();
  equal('still empty after the restart', report.totalItems, 0);
  equal('no snapshot was forced back in', await autoRestoreIfEmpty(), null);

  phase('16. Adding content again clears the clean-up marker');
  memoryStore.heroSlides.push(slide('fresh-start', 1) as never);
  await persistStore();
  check('the marker was cleared', !isEmptyByAdmin());
  equal('the new slide is stored', mongo.docs('heroslides').map((doc) => String(doc.id)), ['fresh-start']);

  // Clean up the scratch directory.
  process.chdir(os.tmpdir());
  fs.rmSync(workDir, { recursive: true, force: true });

  console.log(`\n\x1b[1m${passed} checks passed, ${failures.length} failed\x1b[0m`);
  if (failures.length) {
    for (const failure of failures) console.error(`  \x1b[31m✗\x1b[0m ${failure}`);
    process.exit(1);
  }
}

void main().catch((err) => {
  console.error('\n\x1b[31mSmoke test crashed:\x1b[0m', err);
  process.exit(1);
});
