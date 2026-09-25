/**
 * `npm run check` — one command that proves the site is ready to run.
 * -----------------------------------------------------------------------------
 *   1. TypeScript type check          (npm run lint)
 *   2. Content-layer smoke test       (scripts/smoke-test.ts, no database needed)
 *   3. Production build               (vite build + server bundle)
 *   4. Live boot probe                (boots the app, exercises the HTTP API)
 *   5. End-to-end database test       (only when MONGODB_URI is set: real
 *                                      create → restart → survive → backup →
 *                                      wipe → auto-restore round trip)
 *
 * Exits non-zero on the first failure, so it can be used in CI.
 */
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.CHECK_PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;

function step(name: string): void {
  console.log(`\n\x1b[1m━━━ ${name} ━━━\x1b[0m`);
}

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

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): number {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

async function waitForServer(timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

interface Probe {
  label: string;
  path: string;
  expect: number;
  method?: string;
  body?: unknown;
  /** Extra assertion on the parsed JSON body. */
  check?: (body: unknown) => string | null;
}

async function probe(list: Probe[]): Promise<void> {
  for (const item of list) {
    try {
      const res = await fetch(`${BASE}${item.path}`, {
        method: item.method || 'GET',
        headers: item.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: item.body === undefined ? undefined : JSON.stringify(item.body),
        signal: AbortSignal.timeout(15_000),
      });
      let body: unknown = null;
      const text = await res.text();
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      if (res.status !== item.expect) {
        bad(`${item.label} — HTTP ${res.status} (expected ${item.expect})`);
        continue;
      }
      const problem = item.check ? item.check(body) : null;
      if (problem) bad(`${item.label} — ${problem}`);
      else ok(item.label);
    } catch (err) {
      bad(`${item.label} — request failed: ${(err as Error).message}`);
    }
  }
}

async function bootProbe(useDatabase: boolean, productionBuild = false): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...(productionBuild ? { NODE_ENV: 'production' } : { NODE_ENV: '' }),
    PORT: String(PORT),
    // The probe must never touch a real database unless step 5 asks for one.
    MONGODB_URI: useDatabase ? process.env.MONGODB_URI || '' : '',
    BACKUP_ENABLED: 'true',
    BACKUP_MIRROR_AM_STORAGE: 'false',
    JWT_SECRET: 'run-check-secret-run-check-secret',
  };
  if (!useDatabase) delete env.MONGODB_URI;

  const child = spawn(productionBuild ? 'node' : 'npx', productionBuild ? ['dist/server.cjs'] : ['tsx', 'server.ts'], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log: string[] = [];
  child.stdout?.on('data', (chunk) => log.push(String(chunk)));
  child.stderr?.on('data', (chunk) => log.push(String(chunk)));

  try {
    const up = await waitForServer();
    if (!up) {
      bad(`the server did not start on port ${PORT}`);
      console.error(log.join('').split('\n').slice(-30).join('\n'));
      return;
    }
    ok(`${productionBuild ? 'built server (dist/server.cjs)' : 'dev server'} answered /api/health on port ${PORT}`);

    await probe([
      { label: 'GET / serves the site (HTTP 200)', path: '/', expect: 200 },
      { label: 'GET /admin serves the admin shell', path: '/admin', expect: 200 },
      {
        label: 'GET /api/health is JSON',
        path: '/api/health',
        expect: 200,
        check: (body) => {
          const payload = body as { status?: string; mongo?: { configured: boolean; connected: boolean } };
          if (payload?.status !== 'ok') return 'status is not "ok"';
          if (useDatabase && !payload.mongo?.connected) return 'MongoDB is not connected';
          if (!useDatabase && payload.mongo?.configured) return 'MONGODB_URI leaked into the probe';
          return null;
        },
      },
      { label: 'GET /api/hero-slides', path: '/api/hero-slides', expect: 200, check: (body) => (Array.isArray(body) ? null : 'not an array') },
      { label: 'GET /api/programs', path: '/api/programs', expect: 200, check: (body) => (Array.isArray(body) ? null : 'not an array') },
      { label: 'GET /api/news', path: '/api/news', expect: 200, check: (body) => (Array.isArray(body) ? null : 'not an array') },
      { label: 'GET /api/stats', path: '/api/stats', expect: 200, check: (body) => (Array.isArray(body) ? null : 'not an array') },
      { label: 'GET /api/gallery/albums', path: '/api/gallery/albums', expect: 200 },
      { label: 'GET /api/notices', path: '/api/notices', expect: 200 },
      { label: 'GET /api/publications', path: '/api/publications', expect: 200 },
      { label: 'GET /api/career', path: '/api/career', expect: 200 },
      { label: 'GET /api/committee', path: '/api/committee', expect: 200 },
      { label: 'GET /api/partners', path: '/api/partners', expect: 200 },
      { label: 'GET /api/videos', path: '/api/videos', expect: 200 },
      { label: 'GET /api/settings', path: '/api/settings', expect: 200 },
      { label: 'GET /api/page-content', path: '/api/page-content', expect: 200 },
      { label: 'GET /api/uploads/limits', path: '/api/uploads/limits', expect: 200 },
      {
        label: 'GET /api/auth/status reports the database state',
        path: '/api/auth/status',
        expect: 200,
        check: (body) => {
          const payload = body as { database?: string };
          const expected = useDatabase ? 'connected' : 'not_configured';
          return payload?.database === expected ? null : `database is "${payload?.database}", expected "${expected}"`;
        },
      },
      { label: 'unknown API routes answer 404 JSON', path: '/api/does-not-exist', expect: 404 },
      {
        label: 'POST without a token is refused (401)',
        path: '/api/hero-slides',
        method: 'POST',
        body: { headline: 'x', subtext: 'y', image: { url: 'https://example.com/a.jpg' } },
        expect: 401,
      },
      {
        label: 'GET /api/backups without a token is refused (401)',
        path: '/api/backups',
        expect: 401,
      },
    ]);

    if (!useDatabase) {
      // Fail-closed: an admin save must be refused with 503, never "saved".
      try {
        const res = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nobody@example.com', password: 'whatever' }),
        });
        assert('login without a database is refused (503)', res.status === 503, `HTTP ${res.status}`);
      } catch (err) {
        bad(`login probe failed: ${(err as Error).message}`);
      }
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!child.killed) child.kill('SIGKILL');
  }
}

async function main(): Promise<void> {
  console.log('\x1b[1mGUSB website — production readiness check\x1b[0m');

  step('1/5  TypeScript');
  if (run('npx', ['tsc', '--noEmit']) === 0) ok('no type errors');
  else bad('type check failed');

  step('2/5  Content layer (load / write / backup / restore)');
  if (run('npx', ['tsx', 'scripts/smoke-test.ts']) === 0) ok('smoke test passed');
  else bad('smoke test failed');

  step('3/5  Production build');
  if (run('npx', ['vite', 'build', '--logLevel', 'warn']) === 0) ok('frontend built into dist/');
  else bad('frontend build failed');
  if (
    run('npx', [
      'esbuild',
      'server.ts',
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--packages=external',
      '--sourcemap',
      '--outfile=dist/server.cjs',
    ]) === 0
  ) {
    ok('server bundled into dist/server.cjs');
  } else {
    bad('server bundle failed');
  }
  assert('dist/index.html exists', fs.existsSync(path.join(ROOT, 'dist', 'index.html')));

  step('4/5  Boot & HTTP probe without a database (fail-closed behaviour)');
  await bootProbe(false);
  if (fs.existsSync(path.join(ROOT, 'dist', 'server.cjs'))) {
    await bootProbe(false, true);
  }

  step('5/5  End-to-end test with MongoDB');
  if (process.env.MONGODB_URI) {
    if (run('npx', ['tsx', 'scripts/e2e-test.ts']) === 0) ok('end-to-end database test passed');
    else bad('end-to-end database test failed');
  } else {
    console.log(
      '  \x1b[33m•\x1b[0m skipped — set MONGODB_URI to also run the live create → restart → backup → restore test\n' +
        '      (e.g. MONGODB_URI="mongodb://127.0.0.1:27017/gusb-check" npm run check)'
    );
  }

  console.log('');
  if (failures) {
    console.log(`\x1b[31m✗ ${failures} problem(s) found.\x1b[0m`);
    process.exit(1);
  }
  console.log('\x1b[32m✓ All checks passed — the app is ready to run.\x1b[0m');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
