/**
 * Storage gateway registry — the "Gateways" module of the /hackeradmin console.
 * ---------------------------------------------------------------------------
 * Every place a file can be stored is a *gateway record* here, so an operator can
 * add, edit, enable/disable, test and delete them from the console instead of
 * editing environment variables and redeploying:
 *
 *   kind = 'am-storage'  → documents / PDFs (the AM Storage bridge)
 *   kind = 'cloudinary'  → pictures & videos
 *   kind = 'external'    → any other HTTP endpoint that accepts a multipart POST
 *
 * How the running app picks a gateway
 *   • The registry lives in the `storagegateways` MongoDB collection and is
 *     cached in memory (one read per boot, or after every console change).
 *   • While the registry has been loaded, it is the single source of truth: the
 *     enabled + primary record of each kind is what uploads actually use. A kind
 *     with no enabled record is *switched off* — uploads of that kind are
 *     refused with a clear message instead of being written somewhere unexpected.
 *   • If the registry has never been loaded (MongoDB off / unreachable), the
 *     environment credentials keep working exactly as before. A registry failure
 *     can therefore never break uploads.
 *   • On first run the registry is seeded from the environment (source:
 *     'environment') so the console shows the gateway that is really in use.
 *     Deleting a record is a real decision — `POST /gateways/restore-defaults`
 *     puts the environment defaults back.
 *
 * Secrets are never returned to the browser: reads expose a masked preview
 * (`ng_live_…5Js`) and a boolean, never the value itself.
 */
import { contentCollection, type ContentDoc } from '../config/contentDb';
import { isDatabaseReady } from '../config/mongo';
import { readCloudinaryCredentials } from '../config/cloudinaryEnv';
import {
  AM_STORAGE_DEFAULT_BASE_URL,
  AM_STORAGE_DEFAULT_KEY_ID,
  AM_STORAGE_DEFAULT_KEY_SECRET,
  CLOUDINARY_DEFAULT_FOLDER,
  envValue,
} from '../config/gatewayDefaults';

export const GATEWAY_COLLECTION = 'storagegateways';

export type GatewayKind = 'am-storage' | 'cloudinary' | 'external';
export type GatewaySource = 'environment' | 'console';
export type GatewayAuthMode = 'dual' | 'hmac';

export const GATEWAY_KINDS: GatewayKind[] = ['am-storage', 'cloudinary', 'external'];

export interface GatewayTest {
  ok: boolean;
  at: string;
  /** HTTP status of the probe, when there was one. */
  status: number | null;
  message: string;
  latencyMs: number;
}

export interface GatewayRecord {
  id: string;
  name: string;
  kind: GatewayKind;
  /** API base URL (Cloudinary: `https://api.cloudinary.com/v1_1/<cloud>`). */
  baseUrl: string;
  /** API key / key id. */
  keyId: string;
  /** Private secret — server side only. */
  keySecret: string;
  authMode: GatewayAuthMode;
  /** Cloudinary cloud name. */
  cloudName: string;
  /** Cloudinary upload folder. */
  folder: string;
  notes: string;
  enabled: boolean;
  /** The record uploads of this kind are routed to. */
  primary: boolean;
  source: GatewaySource;
  lastTest: GatewayTest | null;
  createdAt: string;
  updatedAt: string;
}

/** What the browser is allowed to see. */
export interface GatewayView {
  id: string;
  name: string;
  kind: GatewayKind;
  kindLabel: string;
  baseUrl: string;
  host: string;
  keyId: string;
  keyIdMasked: string;
  /** Masked secret, e.g. `ng_live_x…5Js`. Empty when unset. */
  secretPreview: string;
  hasSecret: boolean;
  authMode: GatewayAuthMode;
  cloudName: string;
  folder: string;
  notes: string;
  enabled: boolean;
  primary: boolean;
  source: GatewaySource;
  /** Where this gateway is used, in plain words. */
  usedFor: string;
  /** True when uploads of this kind actually go through this record now. */
  active: boolean;
  lastTest: GatewayTest | null;
  createdAt: string;
  updatedAt: string;
}

export class GatewayError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.code = code;
  }
}

let records: GatewayRecord[] = [];
let loaded = false;
let lastError: string | null = null;

/* ── helpers ────────────────────────────────────────────────────────────── */

function newId(): string {
  return `gw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url || '—';
  }
}

export function maskSecret(secret: string): string {
  const value = (secret || '').trim();
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 9)}…${value.slice(-3)}`;
}

export function maskKeyId(keyId: string): string {
  const value = (keyId || '').trim();
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function kindLabel(kind: GatewayKind): string {
  switch (kind) {
    case 'am-storage':
      return 'Documents (PDF / DOC)';
    case 'cloudinary':
      return 'Media (image / video)';
    default:
      return 'Custom HTTP endpoint';
  }
}

export function usedForLabel(kind: GatewayKind): string {
  switch (kind) {
    case 'am-storage':
      return 'নোটিশ, পাবলিকেশন, সার্কুলার ও CV আপলোড';
    case 'cloudinary':
      return 'ছবি, লোগো, ভিডিও ও পোস্টার';
    default:
      return 'কাস্টম ইন্টিগ্রেশন (ম্যানুয়াল রেফারেন্স)';
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Cloudinary base URL derived from a cloud name. */
function cloudinaryBaseUrl(cloudName: string): string {
  return cloudName ? `https://api.cloudinary.com/v1_1/${cloudName}` : 'https://api.cloudinary.com/v1_1';
}

function normalizeKind(value: unknown): GatewayKind {
  if (typeof value === 'string' && (GATEWAY_KINDS as string[]).includes(value)) return value as GatewayKind;
  throw new GatewayError(400, 'invalid_kind', 'গেটওয়ের ধরন অবশ্যই am-storage, cloudinary অথবা external হতে হবে।');
}

function normalizeAuthMode(value: unknown): GatewayAuthMode {
  return value === 'hmac' ? 'hmac' : 'dual';
}

function toRecord(raw: ContentDoc): GatewayRecord | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  const kind = (GATEWAY_KINDS as string[]).includes(String(raw.kind)) ? (raw.kind as GatewayKind) : 'external';
  const lastTest = (raw.lastTest as GatewayTest | undefined) || null;
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : kindLabel(kind),
    kind,
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
    keyId: typeof raw.keyId === 'string' ? raw.keyId : '',
    keySecret: typeof raw.keySecret === 'string' ? raw.keySecret : '',
    authMode: normalizeAuthMode(raw.authMode),
    cloudName: typeof raw.cloudName === 'string' ? raw.cloudName : '',
    folder: typeof raw.folder === 'string' ? raw.folder : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    enabled: raw.enabled !== false,
    primary: raw.primary === true,
    source: raw.source === 'environment' ? 'environment' : 'console',
    lastTest: lastTest && typeof lastTest === 'object' ? lastTest : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  };
}

function serialise(record: GatewayRecord): ContentDoc {
  return { ...record } as unknown as ContentDoc;
}

/** Views set AFTER validation, so the API response mirrors what will be used. */
function ensureSinglePrimary(): void {
  for (const kind of GATEWAY_KINDS) {
    const ofKind = records.filter((record) => record.kind === kind);
    if (!ofKind.length) continue;
    const active = ofKind.filter((record) => record.primary && record.enabled);
    if (active.length > 1) {
      // Keep the first, demote the rest (a primary that is switched off is idle).
      for (const record of active.slice(1)) record.primary = false;
      continue;
    }
    if (!active.length && ofKind.every((record) => record.enabled)) {
      // An enabled gateway of a kind always exists as primary so uploads never
      // depend on an accidental flag state.
      ofKind[0].primary = true;
      continue;
    }
    if (!active.length) {
      const enabled = ofKind.find((record) => record.enabled);
      if (enabled) enabled.primary = true;
    }
  }
}

/* ── loading & seeding ──────────────────────────────────────────────────── */

/** The gateway the environment says documents should go to (never persisted). */
function environmentDocumentGateway(): GatewayRecord {
  const baseUrl = (envValue('AM_STORAGE_BRIDGE_URL') || AM_STORAGE_DEFAULT_BASE_URL).replace(/\/+$/, '');
  return {
    id: 'gw_env_am_storage',
    name: 'AM Storage — documents (from environment)',
    kind: 'am-storage',
    baseUrl,
    keyId: envValue('AM_STORAGE_KEY_ID') || AM_STORAGE_DEFAULT_KEY_ID,
    keySecret: envValue('AM_STORAGE_KEY_SECRET') || AM_STORAGE_DEFAULT_KEY_SECRET,
    authMode: envValue('AM_STORAGE_AUTH_MODE').toLowerCase() === 'hmac' ? 'hmac' : 'dual',
    cloudName: '',
    folder: '',
    notes: 'Environment variables (AM_STORAGE_*) থেকে স্বয়ংক্রিয়ভাবে তৈরি।',
    enabled: true,
    primary: true,
    source: 'environment',
    lastTest: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function environmentMediaGateway(): GatewayRecord | null {
  const creds = readCloudinaryCredentials();
  if (!creds.cloudName || !creds.apiKey || !creds.apiSecret) return null;
  return {
    id: 'gw_env_cloudinary',
    name: 'Cloudinary — media (from environment)',
    kind: 'cloudinary',
    baseUrl: cloudinaryBaseUrl(creds.cloudName),
    keyId: creds.apiKey,
    keySecret: creds.apiSecret,
    authMode: 'dual',
    cloudName: creds.cloudName,
    folder: envValue('CLOUDINARY_FOLDER') || CLOUDINARY_DEFAULT_FOLDER,
    notes: 'Environment variables (CLOUDINARY_*) থেকে স্বয়ংক্রিয়ভাবে তৈরি।',
    enabled: true,
    primary: true,
    source: 'environment',
    lastTest: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function environmentGateways(): GatewayRecord[] {
  const list: GatewayRecord[] = [environmentDocumentGateway()];
  const media = environmentMediaGateway();
  if (media) list.push(media);
  return list;
}

/**
 * Read the registry. Called at boot and after every console change. When the
 * collection is empty it is seeded from the environment, so the console starts
 * out showing the gateways the site is really using.
 */
export async function loadGatewayRegistry(options: { seed?: boolean } = {}): Promise<void> {
  if (!isDatabaseReady()) {
    lastError = 'database_unavailable';
    return;
  }
  try {
    const docs = await contentCollection(GATEWAY_COLLECTION).find({}, { sort: { createdAt: 1 } });
    let next = docs.map(toRecord).filter((record): record is GatewayRecord => Boolean(record));

    if (!next.length && options.seed !== false) {
      next = environmentGateways();
      await contentCollection(GATEWAY_COLLECTION).insertMany(next.map(serialise));
      console.log(`[gateways] Seeded ${next.length} gateway(s) from the environment.`);
    }

    records = next;
    ensureSinglePrimary();
    loaded = true;
    lastError = null;
    console.log(`[gateways] ${records.length} gateway(s) loaded (${records.filter((r) => r.enabled).length} enabled).`);
  } catch (err) {
    lastError = (err as Error).message;
    console.warn('[gateways] Could not read the registry:', lastError);
  }
}

/** Put the environment defaults back (used after deleting a seeded gateway). */
export async function restoreEnvironmentGateways(actor: string): Promise<GatewayRecord[]> {
  if (!isDatabaseReady()) {
    throw new GatewayError(503, 'database_unavailable', 'ডাটাবেস বন্ধ থাকায় গেটওয়ে তালিকা পরিবর্তন করা যাচ্ছে না।');
  }
  const defaults = environmentGateways();
  const added: GatewayRecord[] = [];
  for (const candidate of defaults) {
    const existing = records.find((record) => record.id === candidate.id);
    if (existing) {
      Object.assign(existing, candidate, { updatedAt: nowIso() });
      added.push(existing);
      continue;
    }
    candidate.updatedAt = nowIso();
    records.push(candidate);
    added.push(candidate);
  }
  ensureSinglePrimary();
  await contentCollection(GATEWAY_COLLECTION).insertMany(added.map(serialise));
  console.log(`[gateways] Environment defaults restored by ${actor}.`);
  return added;
}

async function writeRecord(record: GatewayRecord): Promise<void> {
  await contentCollection(GATEWAY_COLLECTION).updateOne(
    { id: record.id },
    { $set: serialise(record) },
    { upsert: true }
  );
}

/* ── reads ──────────────────────────────────────────────────────────────── */

export function isGatewayRegistryLoaded(): boolean {
  return loaded;
}

export function describeGatewayRegistry(): {
  loaded: boolean;
  total: number;
  enabled: number;
  lastError: string | null;
  collection: string;
} {
  return {
    loaded,
    total: records.length,
    enabled: records.filter((record) => record.enabled).length,
    lastError,
    collection: GATEWAY_COLLECTION,
  };
}

export function listGatewayRecords(): GatewayRecord[] {
  return records.map((record) => ({ ...record }));
}

export function getGatewayRecord(id: string): GatewayRecord | null {
  const record = records.find((candidate) => candidate.id === id);
  return record ? { ...record } : null;
}

function activeOf(kind: GatewayKind): GatewayRecord | null {
  if (!loaded) return null;
  const enabled = records.filter((record) => record.kind === kind && record.enabled);
  if (!enabled.length) return null;
  return enabled.find((record) => record.primary) || enabled[0];
}

function toView(record: GatewayRecord): GatewayView {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    kindLabel: kindLabel(record.kind),
    baseUrl: record.baseUrl,
    host: record.kind === 'cloudinary' ? record.cloudName || hostOf(record.baseUrl) : hostOf(record.baseUrl),
    keyId: record.keyId,
    keyIdMasked: maskKeyId(record.keyId),
    secretPreview: maskSecret(record.keySecret),
    hasSecret: Boolean(record.keySecret),
    authMode: record.authMode,
    cloudName: record.cloudName,
    folder: record.folder,
    notes: record.notes,
    enabled: record.enabled,
    primary: record.primary,
    source: record.source,
    usedFor: usedForLabel(record.kind),
    active: loaded ? activeOf(record.kind)?.id === record.id : false,
    lastTest: record.lastTest,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function listGateways(): GatewayView[] {
  return records.map(toView);
}

/* ── writes ─────────────────────────────────────────────────────────────── */

export interface GatewayInput {
  name?: unknown;
  kind?: unknown;
  baseUrl?: unknown;
  keyId?: unknown;
  keySecret?: unknown;
  authMode?: unknown;
  cloudName?: unknown;
  folder?: unknown;
  notes?: unknown;
  enabled?: unknown;
  primary?: unknown;
}

function cleanText(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

/** Validate + fold a create/update payload onto a record. */
function applyInput(record: GatewayRecord, input: GatewayInput, creating: boolean): void {
  const kind = input.kind === undefined && !creating ? record.kind : normalizeKind(input.kind);

  if (input.name !== undefined) record.name = cleanText(input.name, 80);
  if (input.kind !== undefined) record.kind = kind;
  if (input.authMode !== undefined) record.authMode = normalizeAuthMode(input.authMode);
  if (input.notes !== undefined) record.notes = cleanText(input.notes, 400);
  if (input.cloudName !== undefined) record.cloudName = cleanText(input.cloudName, 120);
  if (input.folder !== undefined) record.folder = cleanText(input.folder, 120);
  if (input.keyId !== undefined) record.keyId = cleanText(input.keyId, 200);
  // An empty secret on update means "keep the stored one".
  if (input.keySecret !== undefined && cleanText(input.keySecret, 400) !== '') {
    record.keySecret = cleanText(input.keySecret, 400);
  }
  if (input.enabled !== undefined) record.enabled = booleanOr(input.enabled, record.enabled);

  if (record.kind === 'cloudinary') {
    if (!record.cloudName) {
      throw new GatewayError(400, 'missing_cloud_name', 'Cloudinary গেটওয়ের জন্য cloud name দিতে হবে।');
    }
    record.baseUrl = cloudinaryBaseUrl(record.cloudName);
    record.authMode = 'dual';
  } else {
    const url = cleanText(input.baseUrl, 400) || record.baseUrl;
    if (!url || !isHttpUrl(url)) {
      throw new GatewayError(400, 'invalid_base_url', 'গেটওয়ে ঠিকানা (https://…) সঠিক নয়।');
    }
    record.baseUrl = url.replace(/\/+$/, '');
  }

  if (!record.keyId) {
    throw new GatewayError(400, 'missing_key_id', 'Key ID / API key দিতে হবে।');
  }
  if (!record.keySecret) {
    throw new GatewayError(400, 'missing_key_secret', 'Key Secret / API secret দিতে হবে।');
  }
  if (!record.name) record.name = kindLabel(record.kind);

  const wantsPrimary = booleanOr(input.primary, creating || record.primary);
  record.primary = wantsPrimary;
  if (wantsPrimary) {
    // Only one primary per kind.
    for (const other of records) {
      if (other.id !== record.id && other.kind === record.kind) other.primary = false;
    }
  }
  if (!record.enabled) record.primary = false;
  record.updatedAt = nowIso();
}

export async function createGateway(input: GatewayInput, actor: string): Promise<GatewayView> {
  if (!isDatabaseReady()) {
    throw new GatewayError(
      503,
      'database_unavailable',
      'ডাটাবেস বন্ধ/অনুপলব্ধ থাকায় নতুন গেটওয়ে সংরক্ষণ করা যাচ্ছে না। আগে System Control থেকে ডাটাবেস চালু করুন।'
    );
  }
  const record: GatewayRecord = {
    id: newId(),
    name: '',
    kind: 'external',
    baseUrl: '',
    keyId: '',
    keySecret: '',
    authMode: 'dual',
    cloudName: '',
    folder: '',
    notes: '',
    enabled: true,
    primary: true,
    source: 'console',
    lastTest: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  applyInput(record, input, true);
  records.push(record);
  ensureSinglePrimary();
  await writeRecord(record);
  console.log(`[gateways] ${actor} added "${record.name}" (${record.kind}, ${hostOf(record.baseUrl)}).`);
  return toView(record);
}

export async function updateGateway(id: string, input: GatewayInput, actor: string): Promise<GatewayView> {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new GatewayError(404, 'not_found', 'গেটওয়েটি পাওয়া যায়নি।');
  if (!isDatabaseReady()) {
    throw new GatewayError(503, 'database_unavailable', 'ডাটাবেস বন্ধ থাকায় গেটওয়ে পরিবর্তন সংরক্ষণ করা যাচ্ছে না।');
  }
  applyInput(record, input, false);
  ensureSinglePrimary();
  await writeRecord(record);
  console.log(`[gateways] ${actor} updated "${record.name}" (enabled: ${record.enabled}, primary: ${record.primary}).`);
  return toView(record);
}

export async function deleteGateway(id: string, actor: string): Promise<void> {
  const index = records.findIndex((candidate) => candidate.id === id);
  if (index === -1) throw new GatewayError(404, 'not_found', 'গেটওয়েটি পাওয়া যায়নি।');
  const [removed] = records.splice(index, 1);
  ensureSinglePrimary();
  if (isDatabaseReady()) {
    try {
      await contentCollection(GATEWAY_COLLECTION).delete({ id });
    } catch (err) {
      console.warn('[gateways] Could not delete the record from MongoDB:', (err as Error).message);
    }
  }
  console.log(`[gateways] ${actor} deleted "${removed.name}" (${removed.kind}).`);
}

/* ── which gateway is really used ───────────────────────────────────────── */

export interface ManagedDocumentGateway {
  /** Ready-to-use config, or null when the operator switched documents off. */
  config: { baseUrl: string; keyId: string; keySecret: string; mode: GatewayAuthMode } | null;
  name: string;
  host: string;
}

/**
 * The document gateway the console decided on.
 *
 * `null` means "the console has no opinion" (registry not loaded) — the caller
 * then falls back to the environment. An object with `config: null` means the
 * operator switched document storage off on purpose.
 */
export function managedDocumentGateway(): ManagedDocumentGateway | null {
  if (!loaded) return null;
  const active = activeOf('am-storage');
  if (!active) return { config: null, name: 'switched off', host: '—' };
  if (active.kind === 'am-storage' && !isHttpUrl(active.baseUrl)) return { config: null, name: active.name, host: '—' };
  if (active.kind === 'external') {
    // A custom HTTP endpoint can host documents too: same multipart contract.
    return {
      config: { baseUrl: active.baseUrl.replace(/\/+$/, ''), keyId: active.keyId, keySecret: active.keySecret, mode: active.authMode },
      name: active.name,
      host: hostOf(active.baseUrl),
    };
  }
  return {
    config: {
      baseUrl: active.baseUrl.replace(/\/+$/, ''),
      keyId: active.keyId,
      keySecret: active.keySecret,
      mode: active.authMode,
    },
    name: active.name,
    host: hostOf(active.baseUrl),
  };
}

export interface ManagedMediaGateway {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  name: string;
}

/** The Cloudinary gateway the console decided on, or null when unmanaged. */
export function managedMediaGateway(): ManagedMediaGateway | null {
  if (!loaded) return null;
  const active = activeOf('cloudinary');
  if (!active) return null;
  return {
    cloudName: active.cloudName || hostOf(active.baseUrl),
    apiKey: active.keyId,
    apiSecret: active.keySecret,
    folder: active.folder || CLOUDINARY_DEFAULT_FOLDER,
    name: active.name,
  };
}

/** True when the console switched media storage off on purpose. */
export function isMediaGatewayDisabledByOperator(): boolean {
  return loaded && records.some((record) => record.kind === 'cloudinary') && !activeOf('cloudinary');
}

/* ── connectivity test ──────────────────────────────────────────────────── */

async function probe(url: string, headers: Record<string, string> = {}): Promise<{ status: number | null; ok: boolean; message: string }> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });
    return { status: response.status, ok: response.ok, message: `HTTP ${response.status}` };
  } catch (err) {
    const reason = (err as Error).message || String(err);
    return { status: null, ok: false, message: reason };
  }
}

/**
 * Probe a gateway and remember the result.
 *
 * A reachable-but-unauthorised answer (401/403/404) still proves the endpoint is
 * alive, so it is reported as such instead of as a failure — the operator then
 * knows whether to fix credentials or the address.
 */
export async function testGateway(id: string): Promise<{ view: GatewayView; test: GatewayTest }> {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new GatewayError(404, 'not_found', 'গেটওয়েটি পাওয়া যায়নি।');

  const started = Date.now();
  let message = '';
  let status: number | null = null;
  let ok = false;

  if (record.kind === 'cloudinary') {
    const auth = Buffer.from(`${record.keyId}:${record.keySecret}`).toString('base64');
    const result = await probe(`https://api.cloudinary.com/v1_1/${record.cloudName}/ping`, {
      Authorization: `Basic ${auth}`,
    });
    status = result.status;
    ok = result.ok;
    message = result.ok
      ? 'Cloudinary credentials accepted (ping ok).'
      : result.status === 401 || result.status === 403
        ? 'Cloudinary credentials rejected — API key/secret মিলছে না।'
        : result.status === 404
          ? `Cloudinary এই cloud name চিনতে পারছে না (${record.cloudName})।`
          : result.message;
  } else {
    const result = await probe(record.baseUrl, {
      'X-AM-Storage-Key-Id': record.keyId,
      'X-AM-Storage-Key-Secret': record.keySecret,
    });
    status = result.status;
    // Any HTTP answer proves the host is alive (an unknown GET route is normal).
    ok = result.status !== null && result.status < 500;
    message =
      result.status === null
        ? `সংযোগ ব্যর্থ — ${result.message}`
        : result.status >= 500
          ? `গেটওয়ে সার্ভারে সমস্যা (HTTP ${result.status})।`
          : `গেটওয়ে সাড়া দিচ্ছে (HTTP ${result.status})${result.status === 401 || result.status === 403 ? ' — তবে এই কী দিয়ে অনুমতি মেলেনি' : ''}।`;
  }

  const test: GatewayTest = {
    ok,
    at: nowIso(),
    status,
    message,
    latencyMs: Date.now() - started,
  };
  record.lastTest = test;
  record.updatedAt = nowIso();
  if (isDatabaseReady()) {
    try {
      await writeRecord(record);
    } catch (err) {
      console.warn('[gateways] Could not store the test result:', (err as Error).message);
    }
  }
  return { view: toView(record), test };
}

/** Used by the test-suite / a fresh boot. */
export function resetGatewayRegistry(): void {
  records = [];
  loaded = false;
  lastError = null;
}
