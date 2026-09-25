/**
 * End-to-end test against a real MongoDB (run by `npm run check` when
 * MONGODB_URI is set).
 *
 *   MONGODB_URI="mongodb://127.0.0.1:27017/gusb-check" npx tsx scripts/e2e-test.ts
 *
 * It boots the actual server and walks through the whole life-cycle that used
 * to lose data:
 *
 *   create an admin → log in → create content → restart (a deploy) → content is
 *   still there → snapshot → wipe the collections → restart → the snapshot is
 *   restored automatically → restore an older snapshot on purpose.
 *
 * The database is emptied first, so only ever point this at a throw-away
 * database (the name must contain "test", "check" or "e2e" unless
 * E2E_CONFIRM=1 is set).
 */
import { spawn } from 'child_process';
import path from 'path';
import mongoose from 'mongoose';

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.E2E_PORT || 4400);
const BASE = `http://127.0.0.1:${PORT}`;
const URI = (process.env.MONGODB_URI || '').trim();

let failures = 0;

function ok(message: string): void {
  console.log(`  \x1b[32m✓\x1b[0m ${message}`);
}

function bad(message: string): void {
  failures += 1;
  console.log(`  \x1b[31m✗ ${message}\x1b[0m`);
}

function assert(label: string, condition: boolean, detail = ''): void {
  if (condition) ok(label);
  else bad(`${label}${detail ? ` — ${detail}` : ''}`);
}

async function api<T = unknown>(
  url: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${url}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: T = null as T;
  try {
    body = text ? (JSON.parse(text) as T) : (null as T);
  } catch {
    body = text as unknown as T;
  }
  return { status: res.status, body };
}

async function waitForServer(timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

let child: ReturnType<typeof spawn> | null = null;
let serverLog: string[] = [];

async function startServer(): Promise<void> {
  serverLog = [];
  child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: '',
      MONGODB_URI: URI,
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret',
      BACKUP_ENABLED: 'true',
      BACKUP_MIRROR_AM_STORAGE: 'false',
      BACKUP_INTERVAL_MINUTES: '360',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => serverLog.push(String(chunk)));
  child.stderr?.on('data', (chunk) => serverLog.push(String(chunk)));
  const up = await waitForServer();
  if (!up) {
    console.error(serverLog.join('').split('\n').slice(-40).join('\n'));
    throw new Error(`server did not start on port ${PORT}`);
  }
}

async function stopServer(): Promise<void> {
  if (!child) return;
  const process_ = child;
  child = null;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      process_.kill('SIGKILL');
      resolve();
    }, 15_000);
    process_.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    process_.kill('SIGTERM');
  });
}

const CONTENT_COLLECTIONS = [
  'heroslides',
  'programs',
  'newsitems',
  'videos',
  'notices',
  'publications',
  'galleryalbums',
  'galleryphotos',
  'committeemembers',
  'partners',
  'careers',
  'applications',
  'stats',
  'sitesettings',
  'pagecontents',
  'contentmeta',
  'contentbackups',
  'sitecontents',
  'admins',
];

async function main(): Promise<void> {
  if (!URI) {
    console.log('MONGODB_URI is not set — skipping the end-to-end database test.');
    return;
  }

  const dbName = (URI.replace(/^mongodb(\+srv)?:\/\//i, '').split('?')[0].split('/')[1] || '').toLowerCase();
  if (!/test|check|e2e|local/.test(dbName) && process.env.E2E_CONFIRM !== '1') {
    console.error(
      `\x1b[31mRefusing to run against the database "${dbName}":\x1b[0m this test DELETES every content collection.\n` +
        'Use a throw-away database (name containing test/check/e2e) or set E2E_CONFIRM=1.'
    );
    process.exit(1);
  }

  console.log(`\n\x1b[1m━━━ End-to-end test against ${dbName || '(default db)'} ━━━\x1b[0m`);

  // Start from a clean slate.
  await mongoose.connect(URI);
  for (const name of CONTENT_COLLECTIONS) {
    await mongoose.connection.db?.collection(name).deleteMany({});
  }
  await mongoose.disconnect();
  ok('database cleaned');

  await startServer();
  try {
    const health = await api<{ mongo: { connected: boolean }; content: { durable: boolean } }>('/api/health');
    assert('MongoDB is connected', health.body.mongo?.connected === true, JSON.stringify(health.body.mongo));

    const setup = await api('/api/auth/setup', {
      method: 'POST',
      body: { name: 'E2E Admin', email: `e2e-${Date.now()}@example.com`, password: 'e2e-password' },
    });
    assert('first admin created', setup.status === 201, `HTTP ${setup.status} ${JSON.stringify(setup.body)}`);

    const email = (setup.body as { user?: { email?: string } })?.user?.email || '';
    const login = await api<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'e2e-password' },
    });
    assert('admin can log in', login.status === 200 && Boolean(login.body.token), JSON.stringify(login.body));
    const token = login.body.token;

    const created = await api<{ id: string }>('/api/hero-slides', {
      method: 'POST',
      token,
      body: {
        image: { url: 'https://res.cloudinary.com/demo/image/upload/e2e.jpg', publicId: 'demo/e2e' },
        headline: 'ই২ই স্লাইড',
        subtext: 'created by the end-to-end test',
      },
    });
    assert('hero slide created', created.status === 201, `HTTP ${created.status} ${JSON.stringify(created.body)}`);

    const stat = await api('/api/stats', {
      method: 'POST',
      token,
      body: { label: { bn: 'প্রকল্প', en: 'Projects' }, value: 1234, suffix: '+' },
    });
    assert('stat counter created', stat.status === 201, `HTTP ${stat.status}`);

    const backup = await api<{ backup: { id: string; totalItems: number } }>('/api/backups', { method: 'POST', token });
    assert('snapshot created', backup.status === 201, JSON.stringify(backup.body));
    assert('snapshot counted the records', (backup.body.backup?.totalItems || 0) >= 2, JSON.stringify(backup.body.backup));

    console.log('\n  restarting the server (this is what a deploy does)…');
    await stopServer();
    await startServer();

    const afterRestart = await api<Array<{ id: string }>>('/api/hero-slides');
    assert('content survived the restart', Array.isArray(afterRestart.body) && afterRestart.body.length === 1, JSON.stringify(afterRestart.body));
    const statsAfter = await api<Array<{ value: number }>>('/api/stats');
    assert('the stat survived the restart', statsAfter.body?.[0]?.value === 1234, JSON.stringify(statsAfter.body));

    console.log('\n  wiping the content collections (simulating a lost database)…');
    await mongoose.connect(URI);
    for (const name of CONTENT_COLLECTIONS) {
      if (name === 'contentbackups') continue; // keep the snapshots
      await mongoose.connection.db?.collection(name).deleteMany({});
    }
    await mongoose.disconnect();
    await stopServer();
    await startServer();

    const restored = await api<Array<{ id: string }>>('/api/hero-slides');
    assert('the snapshot was restored automatically', Array.isArray(restored.body) && restored.body.length === 1, JSON.stringify(restored.body));
    const healthAfter = await api<{ content: { source: string; durable: boolean } }>('/api/health');
    assert('health reports content from MongoDB', healthAfter.body.content?.durable === true, JSON.stringify(healthAfter.body.content));

    const list = await api<{ backups: Array<{ id: string; reason: string }> }>('/api/backups', { token });
    const oldest = [...(list.body.backups || [])].reverse()[0];
    assert('snapshots are listed', Boolean(oldest), JSON.stringify(list.body));
    if (oldest) {
      const restore = await api('/api/backups/' + oldest.id + '/restore', { method: 'POST', token });
      assert('restoring an older snapshot works', restore.status === 200, JSON.stringify(restore.body));
    }
  } finally {
    await stopServer();
    // Leave nothing behind.
    await mongoose.connect(URI);
    for (const name of CONTENT_COLLECTIONS) {
      await mongoose.connection.db?.collection(name).deleteMany({});
    }
    await mongoose.disconnect();
    console.log('  \x1b[2m(database cleaned up)\x1b[0m');
  }

  console.log('');
  if (failures) {
    console.log(`\x1b[31m✗ ${failures} end-to-end check(s) failed.\x1b[0m`);
    process.exit(1);
  }
  console.log('\x1b[32m✓ End-to-end database test passed.\x1b[0m');
}

void main().catch(async (err) => {
  console.error('\x1b[31mEnd-to-end test crashed:\x1b[0m', err);
  await stopServer().catch(() => undefined);
  process.exit(1);
});
