/**
 * Console render smoke test (no browser, no database).
 * ---------------------------------------------------------------------------
 * Renders the /hackeradmin screens to HTML with `react-dom/server` against stub
 * `localStorage`/`fetch` globals. Any crash inside the passcode gate, the
 * console shell or its modules (Control Room, Gateways, Admins, Audit,
 * Telemetry) shows up here immediately instead of as a blank page in the
 * browser.
 *
 * Usage: `npx tsx scripts/console-smoke.tsx`
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

(globalThis as unknown as { fetch: typeof fetch }).fetch = (async () =>
  new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;

const { AuthProvider } = await import('../src/context/AuthContext');
const { HackerAdminLogin } = await import('../src/hacker/HackerAdminLogin');
const { HackerConsole } = await import('../src/hacker/HackerConsole');
const { ControlRoom } = await import('../src/hacker/panels/ControlRoom');
const { GatewayPanel } = await import('../src/hacker/panels/GatewayPanel');
const { TelemetryPanel } = await import('../src/hacker/panels/TelemetryPanel');
const { AuditPanel } = await import('../src/hacker/panels/AuditPanel');
const { ConsoleAdminsPanel } = await import('../src/hacker/panels/ConsoleAdminsPanel');
const { ManageNews } = await import('../src/admin/ManageNews');

function render(label: string, element: React.ReactElement, route: string) {
  try {
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(MemoryRouter, { initialEntries: [route] }, element)
      )
    );
    const ok = html.includes('hackeradmin') || html.length > 500;
    console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label} (${html.length} bytes)`);
    return ok;
  } catch (err) {
    console.log(`  \x1b[31m✗ ${label} — ${(err as Error).message}\x1b[0m`);
    return false;
  }
}

const snapshot = {
  time: new Date().toISOString(),
  process: {
    uptimeSeconds: 1234,
    startedAt: new Date().toISOString(),
    node: 'v22.0.0',
    platform: 'linux x64',
    pid: 4242,
    environment: 'test',
    memory: { rssMb: 120, heapUsedMb: 40 },
  },
  control: {
    databaseEnabled: false,
    maintenanceMode: true,
    note: 'smoke',
    updatedAt: new Date().toISOString(),
    updatedBy: 'hackeradmin',
    source: 'mongodb' as const,
    persisted: true,
    databaseDisabledAt: new Date().toISOString(),
  },
  mongo: {
    configured: true,
    connected: false,
    state: 'disabled' as const,
    hint: 'disabled by operator',
    operatorDisabled: true,
    disabledAt: new Date().toISOString(),
    target: 'cluster.mongodb.net',
    reconnectLoop: 'active (20s)',
  },
  storage: {
    provider: 'cloudinary',
    configured: true,
    state: 'ok',
    cloudName: 'vdo_bogura',
    folder: 'vdo_bogura',
    lastCheck: { ok: true, at: new Date().toISOString(), state: 'ok' },
    documents: { provider: 'am-storage', configured: true, host: 'st.thamjj13.top' },
    hint: '',
  },
  content: {
    source: 'mongodb',
    durable: true,
    loaded: true,
    totalItems: 12,
    records: 14,
    counts: { heroslides: 3, programs: 2, newsitems: 4 },
    collections: ['heroslides', 'programs', 'newsitems'],
    pendingWrites: 0,
    lastSavedAt: new Date().toISOString(),
    lastLoadedAt: new Date().toISOString(),
    hint: '',
  },
  backups: {
    enabled: true,
    intervalMinutes: 360,
    keep: 40,
    count: 5,
    lastBackupAt: new Date().toISOString(),
    nextRunAt: new Date().toISOString(),
    lastError: null,
  },
  gateways: {
    loaded: true,
    total: 2,
    enabled: 2,
    lastError: null,
    collection: 'storagegateways',
    items: [
      {
        id: 'gw_env_am_storage',
        name: 'AM Storage — documents',
        kind: 'am-storage' as const,
        kindLabel: 'Documents (PDF / DOC)',
        baseUrl: 'https://st.thamjj13.top/api/v1',
        host: 'st.thamjj13.top',
        keyId: 'ng_key_poSEfjsP5RZVE71L',
        keyIdMasked: 'ng_key…71L',
        secretPreview: 'ng_live_x…5Js',
        hasSecret: true,
        authMode: 'dual' as const,
        cloudName: '',
        folder: '',
        notes: '',
        enabled: true,
        primary: true,
        source: 'environment' as const,
        usedFor: 'নোটিশ, পাবলিকেশন',
        active: false,
        lastTest: { ok: true, at: new Date().toISOString(), status: 200, message: 'gateway alive', latencyMs: 120 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    effective: {
      documents: { configured: true, host: 'st.thamjj13.top', source: 'environment' as const },
      media: { configured: true, cloudName: 'vdo_bogura', folder: 'vdo_bogura', source: 'console' as const },
    },
  },
  audit: { inMemory: 3, databaseWrites: 3, databaseFailures: 0 },
  admins: { total: 2, active: 2 },
  session: { passcodeFromEnvironment: false, passcodeLength: 10, throttle: { trackedIps: 1, lockedIps: 0 } },
};

const auditEntry = {
  id: 'aud_1',
  at: new Date().toISOString(),
  actor: 'hackeradmin',
  action: 'database.disable',
  target: 'MongoDB',
  level: 'critical' as const,
  detail: 'Database switched OFF',
  ip: '127.0.0.1',
  persisted: true,
};

console.log('\n\x1b[1m▸ /hackeradmin render smoke test\x1b[0m');
let failures = 0;
if (!render('passcode gate (/hackeradmin)', React.createElement(HackerAdminLogin), '/hackeradmin')) failures += 1;

// A console session is required, otherwise the shell redirects to the gate.
store.set('ngo_hacker_token', 'stub-token');
store.set(
  'ngo_hacker_user',
  JSON.stringify({ id: 'hackeradmin', name: 'Operations Console', email: 'hackeradmin@console.local', role: 'admin' })
);
if (!render('console shell (/hackeradmin/console)', React.createElement(HackerConsole), '/hackeradmin/console')) failures += 1;

const noop = () => {};
const panels: [string, React.ReactElement][] = [
  [
    'Control Room (database off + frozen)',
    React.createElement(ControlRoom, {
      token: 'stub',
      snapshot: snapshot as never,
      audit: [auditEntry],
      loading: false,
      onRefresh: noop,
      onToast: noop,
      onOpenAudit: noop,
    }),
  ],
  [
    'Gateways (registry loaded)',
    React.createElement(GatewayPanel, {
      token: 'stub',
      data: snapshot.gateways as never,
      onReload: noop,
      onToast: noop,
    }),
  ],
  ['Telemetry', React.createElement(TelemetryPanel, { snapshot: snapshot as never })],
  [
    'Audit log',
    React.createElement(AuditPanel, {
      token: 'stub',
      entries: [auditEntry] as never,
      source: 'mongodb' as const,
      onToast: noop,
      onReload: noop,
    }),
  ],
  [
    'Admin accounts',
    React.createElement(ConsoleAdminsPanel, { token: 'stub', snapshot: snapshot as never, onToast: noop, onReload: noop }),
  ],
  ['Reused content module (news)', React.createElement(ManageNews)],
];

for (const [label, element] of panels) {
  if (!render(`module · ${label}`, element, '/hackeradmin/console')) failures += 1;
}

console.log(failures ? `\n\x1b[31m${failures} screen(s) failed to render\x1b[0m\n` : '\n\x1b[32mall console screens render\x1b[0m\n');
process.exit(failures ? 1 : 0);
