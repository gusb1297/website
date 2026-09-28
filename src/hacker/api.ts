/**
 * Typed client for the /api/hackeradmin endpoints.
 *
 * Every call carries the console (passcode) token. Errors are turned into a
 * Bengali `Error` message so the console can show the server's own explanation —
 * which matters here, because most failures are operational
 * ("database switched off", "gateway rejected the key") rather than bugs.
 */

export interface SystemControlState {
  databaseEnabled: boolean;
  maintenanceMode: boolean;
  note: string;
  updatedAt: string | null;
  updatedBy: string | null;
  source: 'mongodb' | 'default' | 'memory';
  persisted: boolean;
  databaseDisabledAt: string | null;
}

export interface GatewayTest {
  ok: boolean;
  at: string;
  status: number | null;
  message: string;
  latencyMs: number;
}

export type GatewayKind = 'am-storage' | 'cloudinary' | 'external';

export interface GatewayView {
  id: string;
  name: string;
  kind: GatewayKind;
  kindLabel: string;
  baseUrl: string;
  host: string;
  keyId: string;
  keyIdMasked: string;
  secretPreview: string;
  hasSecret: boolean;
  authMode: 'dual' | 'hmac';
  cloudName: string;
  folder: string;
  notes: string;
  enabled: boolean;
  primary: boolean;
  source: 'environment' | 'console';
  usedFor: string;
  active: boolean;
  lastTest: GatewayTest | null;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveGateway {
  configured: boolean;
  host?: string;
  cloudName?: string;
  folder?: string;
  /** `console` = managed here, `environment` = env fallback, `switched-off` = disabled here. */
  source: 'console' | 'environment' | 'switched-off';
}

export interface GatewayListResponse {
  loaded: boolean;
  total: number;
  enabled: number;
  lastError: string | null;
  collection: string;
  items: GatewayView[];
  /** What uploads really use right now (falls back to the environment). */
  effective?: { documents: EffectiveGateway; media: EffectiveGateway };
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  level: 'info' | 'warn' | 'critical';
  detail?: string;
  ip?: string;
  userAgent?: string;
  persisted: boolean;
}

export interface SystemSnapshot {
  time: string;
  process: {
    uptimeSeconds: number;
    startedAt: string;
    node: string;
    platform: string;
    pid: number;
    environment: string;
    memory: { rssMb: number; heapUsedMb: number };
  };
  control: SystemControlState;
  mongo: {
    configured: boolean;
    connected: boolean;
    state: 'connected' | 'not_configured' | 'unreachable' | 'disabled';
    hint: string;
    operatorDisabled: boolean;
    disabledAt: string | null;
    /** Result of the server-side `ping` command — the only proof of ONLINE. */
    ping: {
      ok: boolean;
      checkedAt: string;
      latencyMs: number | null;
      error: string | null;
    };
    reconnectLoop: string;
  };
  storage: {
    provider: string;
    configured: boolean;
    state: string;
    cloudName?: string;
    folder: string;
    lastCheck: { ok: boolean; at: string; state?: string; error?: string } | null;
    /** Document gateway: provider + configured only (no raw host). */
    documents: { provider: string; configured: boolean };
    hint: string;
  };
  content: {
    source: string;
    durable: boolean;
    loaded: boolean;
    totalItems: number;
    records: number;
    counts: Record<string, number>;
    collections: string[];
    pendingWrites: number;
    lastSavedAt: string | null;
    lastLoadedAt: string | null;
    hint: string;
  };
  backups: {
    enabled: boolean;
    intervalMinutes: number;
    keep: number;
    count: number | null;
    lastBackupAt: string | null;
    nextRunAt: string | null;
    lastError: string | null;
  };
  gateways: GatewayListResponse;
  audit: { inMemory: number; databaseWrites: number; databaseFailures: number };
  admins: { total: number; active: number } | null;
  session: { passcodeFromEnvironment: boolean; throttle: { trackedIps: number; lockedIps: number } };
}

export class ConsoleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ConsoleApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  token: string | null,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const { method = 'GET', body } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache: 'no-store',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ConsoleApiError('ইন্টারনেট সংযোগ বিচ্ছিন্ন — কনসোল সার্ভারে পৌঁছাতে পারেনি।', 0);
  }

  const text = await res.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }
  if (!res.ok) {
    const message =
      (payload as { message?: string } | undefined)?.message ||
      (typeof payload === 'object' && payload && typeof (payload as { error?: string }).error === 'string'
        ? (payload as { error?: string }).error
        : '') ||
      `HTTP ${res.status}`;
    throw new ConsoleApiError(message as string, res.status);
  }
  return payload as T;
}

export const consoleApi = {
  system: (token: string | null) => request<SystemSnapshot>('/api/hackeradmin/system', token),
  session: (token: string | null) => request<{ authenticated: boolean }>('/api/hackeradmin/session', token),
  setDatabase: (token: string | null, enabled: boolean) =>
    request<{ ok: boolean; control: SystemControlState; message: string }>('/api/hackeradmin/database', token, {
      method: 'POST',
      body: { enabled },
    }),
  setMaintenance: (token: string | null, enabled: boolean, note = '') =>
    request<{ ok: boolean; control: SystemControlState; message: string }>('/api/hackeradmin/maintenance', token, {
      method: 'POST',
      body: { enabled, note },
    }),
  gateways: (token: string | null) => request<GatewayListResponse>('/api/hackeradmin/gateways', token),
  createGateway: (token: string | null, body: Record<string, unknown>) =>
    request<{ ok: boolean; gateway: GatewayView; items: GatewayView[] }>('/api/hackeradmin/gateways', token, {
      method: 'POST',
      body,
    }),
  updateGateway: (token: string | null, id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean; gateway: GatewayView; items: GatewayView[] }>(
      `/api/hackeradmin/gateways/${encodeURIComponent(id)}`,
      token,
      { method: 'PUT', body }
    ),
  deleteGateway: (token: string | null, id: string) =>
    request<{ ok: boolean; items: GatewayView[]; message: string }>(
      `/api/hackeradmin/gateways/${encodeURIComponent(id)}`,
      token,
      { method: 'DELETE' }
    ),
  testGateway: (token: string | null, id: string) =>
    request<{ ok: boolean; gateway: GatewayView; test: GatewayTest; items: GatewayView[] }>(
      `/api/hackeradmin/gateways/${encodeURIComponent(id)}/test`,
      token,
      { method: 'POST' }
    ),
  restoreGateways: (token: string | null) =>
    request<{ ok: boolean; items: GatewayView[]; restored: number }>(
      '/api/hackeradmin/gateways/restore-defaults',
      token,
      { method: 'POST' }
    ),
  audit: (token: string | null, limit = 120) =>
    request<{ entries: AuditEntry[]; source: 'mongodb' | 'memory'; status: SystemSnapshot['audit'] }>(
      `/api/hackeradmin/audit?limit=${limit}`,
      token
    ),
  flushContent: (token: string | null) =>
    request<{ ok: boolean; flushed: number }>('/api/hackeradmin/content/flush', token, { method: 'POST' }),
  reloadContent: (token: string | null) =>
    request<{ ok: boolean; report: { totalItems: number; source: string } }>('/api/hackeradmin/content/reload', token, {
      method: 'POST',
    }),
  backupNow: (token: string | null) =>
    request<{ ok: boolean; backup: { id: string; totalItems: number } }>('/api/hackeradmin/content/backup', token, {
      method: 'POST',
    }),
  admins: (token: string | null) =>
    request<
      {
        id: string;
        name: string;
        email: string;
        role: 'admin' | 'editor';
        isActive: boolean;
        createdAt?: string;
        lastLoginAt?: string | null;
      }[]
    >('/api/hackeradmin/admins', token),
  createAdmin: (token: string | null, body: Record<string, unknown>) =>
    request<{ id: string; email: string }>('/api/hackeradmin/admins', token, { method: 'POST', body }),
  deleteAdmin: (token: string | null, id: string) =>
    request<{ message: string }>(`/api/hackeradmin/admins/${encodeURIComponent(id)}`, token, { method: 'DELETE' }),
};

/** 1284 → "21m 24s", for uptime readouts. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '—';
  const seconds = Math.max(0, Math.round(diff / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
