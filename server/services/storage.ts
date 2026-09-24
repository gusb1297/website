/**
 * Media storage — Cloudinary for pictures & videos, AM Storage for documents.
 * ---------------------------------------------------------------------------
 * This module replaces the old "save to ./uploads on the server disk" system.
 * Nothing is ever written to the project directory any more: a file that is
 * uploaded by an admin is streamed to the cloud and only its public URL
 * (+ public_id, so we can delete it later) is stored in MongoDB.
 *
 * Routing by kind:
 *   image / video → Cloudinary (this file)
 *   document      → AM Storage gateway (services/amStorage.ts). Cloudinary
 *                   cannot host the site's PDFs, so every PDF / DOC / DOCX /
 *                   TXT goes through the bridge instead — see putFile().
 *
 * Why Cloudinary only:
 *   Render / Heroku / Railway … wipe the container disk on every deploy, so
 *   pictures "uploaded" to local disk disappeared after the next update and the
 *   admin never got any error — that is exactly the bug this module removes.
 *   If the credentials are missing or the upload fails, the request FAILS with
 *   an explicit, human-readable (Bengali) message instead of pretending to save.
 *
 * Connection status (what the admin "স্টোরেজ সতর্কতা" banner shows):
 *   It used to be ONE Admin-API ping at boot that was never repeated, and any
 *   failed upload — even a single file that was merely too big for the
 *   Cloudinary plan — flipped it to "connection failed, check the API key /
 *   secret". The panel could stay red for days while Cloudinary worked. Now:
 *     • credentials are cleaned up first (quotes, stray spaces, `NAME=` …) —
 *       see config/cloudinaryEnv.ts;
 *     • the check runs in the background with a hard timeout (it never delays
 *       the server start) and repeats automatically: soon after network
 *       trouble, every 10 minutes after a credential error;
 *     • when the Admin API refuses the ping — it can be locked down on its own
 *       (allowed-IP list, API key roles) while uploads work — a tiny test
 *       upload through the Upload API, the API this site actually uses,
 *       decides instead;
 *     • upload errors are classified: a file Cloudinary refuses is reported for
 *       that file only, network trouble is "temporarily unreachable", and only
 *       a real credential error marks the connection as failed;
 *     • the admin's "আবার যাচাই" button runs a fresh check
 *       (GET /api/storage/status?verify=1).
 */
import crypto from 'crypto';
import fs from 'fs';
// Keep this import ABOVE `cloudinary`: it cleans CLOUDINARY_URL before the SDK
// parses it (a malformed value used to crash the server on load).
import {
  primaryVariable,
  readCloudinaryCredentials,
  maskApiKey,
  type CloudinaryCredentials,
} from '../config/cloudinaryEnv';
import { v2 as cloudinary } from 'cloudinary';
import {
  AmStorageError,
  amStorageHost,
  deleteDocumentFromAmStorage,
  isAmStorageConfigured,
  uploadDocumentToAmStorage,
} from './amStorage';

/**
 * Documents are not Cloudinary assets, yet every record keeps a single
 * `publicId` string next to the URL. Gateway files are therefore recorded as
 * `amstorage/<file id>` so deleteAsset() can tell the two providers apart.
 */
export const AM_STORAGE_ID_PREFIX = 'amstorage/';

/** Every asset category the admin panel can upload. */
export type UploadKind = 'image' | 'video' | 'document';

export type StorageErrorCode =
  | 'cloud_storage_not_configured'
  | 'cloud_storage_unavailable'
  | 'cloud_storage_auth_failed'
  | 'cloud_file_rejected';

export class StorageError extends Error {
  /**
   * HTTP status for the upload response. Never 401/403: the admin panel treats
   * those as "your login expired" and would log the admin out over a Cloudinary
   * problem.
   */
  status: number;
  code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, public cause?: unknown, status = 503) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Root folder inside the Cloudinary media library. Read lazily so it always
 * reflects the environment the process runs with.
 */
function cloudFolder(): string {
  return (process.env.CLOUDINARY_FOLDER || 'vdo_bogura').trim().replace(/^\/+|\/+$/g, '');
}

/* ── credentials → SDK ──────────────────────────────────────────────────── */

let appliedFingerprint = '';

function fingerprintOf(creds: CloudinaryCredentials): string {
  // Only used to notice that the credentials changed; never stored or shown.
  return crypto
    .createHash('sha256')
    .update(`${creds.cloudName}\n${creds.apiKey}\n${creds.apiSecret}`)
    .digest('hex')
    .slice(0, 16);
}

const NOTICE_LOG_TEXT: Record<string, string> = {
  quotes: 'surrounding quotes removed',
  whitespace: 'leading/trailing whitespace removed',
  inner_whitespace: 'whitespace inside the value removed',
  invisible: 'invisible (zero-width) characters removed',
  name_prefix: '"NAME=" prefix removed from the value',
  trailing_punctuation: 'trailing comma/semicolon removed',
  extracted: 'cloud name extracted from a pasted Cloudinary URL',
  alias: 'read from an alternative variable name',
  conflict: 'holds different values than the separate CLOUDINARY_* variables (the separate variables win)',
  placeholder: 'looks like a placeholder, not a real value',
  format: 'does not look like a valid value',
  url_invalid: 'is not a valid cloudinary:// URL',
};

/**
 * Read + clean the credentials and hand them to the SDK whenever they change.
 * Explicit values override whatever the SDK parsed from CLOUDINARY_URL; other
 * URL options (private CDN, upload prefix …) are kept.
 */
function currentCredentials(): CloudinaryCredentials {
  const creds = readCloudinaryCredentials();
  if (!creds.complete) return creds;
  const fingerprint = fingerprintOf(creds);
  if (fingerprint !== appliedFingerprint) {
    cloudinary.config({
      cloud_name: creds.cloudName,
      api_key: creds.apiKey,
      api_secret: creds.apiSecret,
      secure: true,
    });
    appliedFingerprint = fingerprint;
    const from = [...new Set(Object.values(creds.sources).filter(Boolean))].join(', ');
    console.log(
      `[storage] Cloudinary configured — cloud "${creds.cloudName}", API key ${maskApiKey(creds.apiKey)} (from ${from}).`
    );
    for (const notice of creds.notices) {
      const log = notice.severity === 'info' ? console.log : console.warn;
      log(`[storage] ${notice.variable}: ${NOTICE_LOG_TEXT[notice.kind] || notice.kind}.`);
    }
  }
  return creds;
}

export function isStorageConfigured(): boolean {
  return currentCredentials().complete;
}

/* ── error classification ───────────────────────────────────────────────── */

export type StorageFailureReason =
  | 'cloud_name'
  | 'api_key'
  | 'api_secret'
  | 'permission'
  | 'account'
  | 'clock'
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'service'
  | 'unknown';

interface CloudinaryErrorInfo {
  /** Cloudinary's own message, cleaned (no signature dump). */
  message: string;
  httpCode?: number;
  reason: StorageFailureReason;
  /** Network / timeout / rate limit / Cloudinary outage — NOT the credentials. */
  transient: boolean;
  /** Cloudinary refused this particular file; the connection itself is fine. */
  fileProblem: boolean;
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EPIPE',
  'EPROTO',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_SSL_WRONG_VERSION_NUMBER',
]);

function cleanErrorMessage(message: string): string {
  return message
    .replace(/\s*[-.]?\s*String to sign\b[\s\S]*$/i, '')
    .replace(/(Invalid Signature)\s+[0-9a-f]{20,}/i, '$1')
    .replace(/(api_secret=)[^&\s'"]*/gi, '$1***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function classifyCloudinaryError(error: unknown): CloudinaryErrorInfo {
  // Admin API rejects with { error: { message, http_code } }, the Upload API
  // with { message, http_code }, sockets with an Error carrying `.code`.
  const outer = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
  const inner = (outer.error && typeof outer.error === 'object' ? outer.error : outer) as Record<string, unknown>;
  const rawMessage =
    (typeof inner.message === 'string' && inner.message) ||
    (typeof outer.message === 'string' && outer.message) ||
    (typeof error === 'string' ? error : '') ||
    'unknown Cloudinary error';
  const message = cleanErrorMessage(rawMessage) || 'unknown Cloudinary error';
  const httpCode = Number(inner.http_code ?? outer.http_code) || undefined;
  const sysCode = [outer.code, inner.code].find((code): code is string => typeof code === 'string');

  const result = (reason: StorageFailureReason, transient = false, fileProblem = false): CloudinaryErrorInfo => ({
    message,
    httpCode,
    reason,
    transient,
    fileProblem,
  });

  if (httpCode === 499 || sysCode === 'ETIMEDOUT' || sysCode === 'ESOCKETTIMEDOUT' || /timed? ?out|timeout/i.test(message)) {
    return result('timeout', true);
  }
  if (
    (sysCode && NETWORK_ERROR_CODES.has(sysCode)) ||
    /socket hang up|getaddrinfo|ECONN|ENOTFOUND|EAI_AGAIN|network|certificate|\bTLS\b|\bSSL\b/i.test(message)
  ) {
    return result('network', true);
  }
  if (httpCode === 420 || httpCode === 429 || /rate limit/i.test(message)) return result('rate_limit', true);
  if (httpCode && httpCode >= 500) return result('service', true);
  if (/stale request/i.test(message)) return result('clock');
  if (/must supply cloud_name|cloud[_ ]?name/i.test(message)) return result('cloud_name');
  if (/must supply api_key|api[_ ]?key/i.test(message)) return result('api_key');
  if (/must supply api_secret|signature|api[_ ]?secret/i.test(message)) return result('api_secret');
  if (/\b(?:account|cloud)\b.*\b(?:disabled|suspended|deactivated|blocked|inactive)\b/i.test(message)) {
    return result('account');
  }
  if (httpCode === 403 || /not allowed|permission|forbidden|restricted|access denied|unauthori[sz]ed/i.test(message)) {
    return result('permission');
  }
  if (httpCode === 401) return result('auth');
  if (
    httpCode === 400 ||
    httpCode === 413 ||
    /file size too large|too large|invalid (?:image|video) file|unsupported|megapixel|empty file|corrupt/i.test(message)
  ) {
    return result('unknown', false, true);
  }
  return result('unknown');
}

/* ── connection state ───────────────────────────────────────────────────── */

export type StorageConnectionState = 'ok' | 'failed' | 'unreachable';

export interface StorageCheck {
  ok: boolean;
  state: StorageConnectionState;
  at: string;
  /** How the result was obtained. */
  via: 'ping' | 'upload-test' | 'upload';
  reason?: StorageFailureReason;
  /** Cloudinary's own error message (cleaned). */
  error?: string;
  httpCode?: number;
  /** The Admin API refused the ping but the Upload API — the one the site uses — works. */
  adminApiRestricted?: boolean;
  /** When the next automatic re-check runs (failed / unreachable only). */
  nextRetryAt?: string;
}

const CHECK_TIMEOUT_MS = 15_000;
const RETRY_UNREACHABLE_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
const RETRY_FAILED_MS = 10 * 60_000;
/** A status request re-checks a stale failure at most this often. */
const SELF_HEAL_UNREACHABLE_MS = 60_000;
const SELF_HEAL_FAILED_MS = 5 * 60_000;
/** Repeated "আবার যাচাই" clicks closer together than this reuse the last result. */
const MANUAL_CHECK_MIN_INTERVAL_MS = 5_000;
/** 1×1 transparent PNG used by the Upload-API test. */
const TEST_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let lastCheck: StorageCheck | null = null;
let lastCheckFingerprint = '';
let checkInFlight: Promise<StorageCheck | null> | null = null;
let lastCheckStartedAt = 0;
let lastManualCheckAt = 0;
let retryTimer: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`), { code: 'ETIMEDOUT' })),
      ms
    );
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function successCheck(via: StorageCheck['via']): StorageCheck {
  return { ok: true, state: 'ok', via, at: new Date().toISOString() };
}

function failedCheck(via: StorageCheck['via'], info: CloudinaryErrorInfo): StorageCheck {
  return {
    ok: false,
    state: info.transient ? 'unreachable' : 'failed',
    via,
    at: new Date().toISOString(),
    reason: info.reason,
    error: info.message,
    httpCode: info.httpCode,
  };
}

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function recordCheck(result: StorageCheck, fingerprint: string): void {
  const previous = lastCheckFingerprint === fingerprint ? lastCheck : null;
  if (result.ok && result.via === 'upload' && previous?.adminApiRestricted) {
    result.adminApiRestricted = true;
  }
  lastCheck = result;
  lastCheckFingerprint = fingerprint;

  if (result.ok) {
    consecutiveFailures = 0;
    clearRetry();
    if (!previous?.ok) {
      console.log(
        result.adminApiRestricted
          ? '[storage] Cloudinary OK — a test upload worked (the Admin API refused the ping: it is probably limited by an allowed-IP list or the API key role; uploads are not affected).'
          : `[storage] Cloudinary connection OK (${result.via}) — uploads are stored in the cloud.`
      );
    }
    return;
  }

  consecutiveFailures += 1;
  const delay =
    result.state === 'unreachable'
      ? RETRY_UNREACHABLE_MS[Math.min(consecutiveFailures - 1, RETRY_UNREACHABLE_MS.length - 1)]
      : RETRY_FAILED_MS;
  result.nextRetryAt = new Date(Date.now() + delay).toISOString();
  clearRetry();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void verifyStorageConnection();
  }, delay);
  retryTimer.unref?.();
  console.error(
    `[storage] Cloudinary ${
      result.state === 'unreachable' ? 'is temporarily UNREACHABLE (not a credential problem)' : `check FAILED (${result.reason})`
    } via ${result.via}: ${result.error} — re-checking in ${Math.round(delay / 1000)}s.`
  );
}

/** Upload API check: store (and remove) a 1×1 PNG. Only used when the Admin API refuses the ping. */
async function uploadTestPixel(): Promise<void> {
  const publicId = `${cloudFolder()}/_healthcheck/connection-test`;
  await withTimeout(
    cloudinary.uploader.upload(TEST_PIXEL, {
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
      timeout: CHECK_TIMEOUT_MS,
    }),
    CHECK_TIMEOUT_MS + 2_000,
    'Cloudinary test upload'
  );
  cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => undefined);
}

async function runConnectionCheck(): Promise<StorageCheck | null> {
  const creds = currentCredentials();
  if (!creds.complete) {
    clearRetry();
    lastCheck = null;
    console.error(
      `[storage] Cloudinary is NOT configured (missing ${creds.missing.map(primaryVariable).join(', ')}) — ` +
        'image/video uploads are refused with a clear message until it is set. Nothing is ever stored on the local disk.'
    );
    return null;
  }
  const fingerprint = appliedFingerprint;

  let result: StorageCheck;
  try {
    await withTimeout(cloudinary.api.ping({ timeout: CHECK_TIMEOUT_MS }), CHECK_TIMEOUT_MS + 2_000, 'Cloudinary ping');
    result = successCheck('ping');
  } catch (pingError) {
    const ping = classifyCloudinaryError(pingError);
    if (ping.transient) {
      result = failedCheck('ping', ping);
    } else {
      // The Admin API said no. It can be restricted on its own while uploads
      // work, so let the Upload API — the one the site uses — decide.
      try {
        await uploadTestPixel();
        result = { ...successCheck('upload-test'), adminApiRestricted: true };
      } catch (probeError) {
        const probe = classifyCloudinaryError(probeError);
        result = failedCheck(
          'upload-test',
          probe.reason === 'unknown' && !probe.transient ? { ...probe, reason: ping.reason } : probe
        );
      }
    }
  }
  recordCheck(result, fingerprint);
  return result;
}

/**
 * Check the Cloudinary connection (background-safe: never throws, always
 * finishes within ~35 s). Concurrent callers share the same check.
 */
export function verifyStorageConnection(): Promise<StorageCheck | null> {
  if (checkInFlight) return checkInFlight;
  lastCheckStartedAt = Date.now();
  checkInFlight = runConnectionCheck()
    .catch((error) => {
      console.error('[storage] Cloudinary check crashed:', error);
      return lastCheck;
    })
    .finally(() => {
      checkInFlight = null;
    });
  return checkInFlight;
}

/**
 * "আবার যাচাই" from the admin panel: always a fresh check (automatic checks
 * do not count), except that rapid repeated clicks share one result.
 */
export async function forceStorageCheck(): Promise<void> {
  if (checkInFlight) {
    await checkInFlight;
    return;
  }
  const now = Date.now();
  if (lastCheck && now - lastManualCheckAt < MANUAL_CHECK_MIN_INTERVAL_MS) return;
  lastManualCheckAt = now;
  await verifyStorageConnection();
}

/**
 * Called by the status endpoints: if the last check failed a while ago (or the
 * credentials changed), re-check in the background so the banner heals itself.
 */
export function refreshStorageStatusIfStale(): void {
  if (checkInFlight) return;
  if (!currentCredentials().complete) return;
  const current = lastCheckFingerprint === appliedFingerprint ? lastCheck : null;
  if (current?.ok) return;
  const age = Date.now() - lastCheckStartedAt;
  if (current && age < (current.state === 'unreachable' ? SELF_HEAL_UNREACHABLE_MS : SELF_HEAL_FAILED_MS)) return;
  void verifyStorageConnection();
}

/* ── status for /api/health and the admin panel ─────────────────────────── */

export interface StorageStatus {
  provider: 'cloudinary';
  configured: boolean;
  /**
   * not_configured → credentials missing; checking → first check running;
   * ok / failed / unreachable → result of the last check; unknown → not checked yet.
   */
  state: 'not_configured' | 'unknown' | 'checking' | StorageConnectionState;
  /** A (re-)check is running right now. */
  checking: boolean;
  /** Document (PDF) gateway — separate from the Cloudinary media account. */
  documents: { provider: 'am-storage'; configured: boolean; host: string };
  /** False when uploads cannot be stored right now (missing / rejected credentials, Cloudinary unreachable). */
  durable: boolean;
  cloudName?: string;
  folder: string;
  lastCheck: StorageCheck | null;
  /** Documented names of the missing variables (when not configured). */
  missing?: string[];
  /** Operator-facing explanation, never contains secrets. */
  hint: string;
}

const REASON_HINT: Record<StorageFailureReason, string> = {
  cloud_name: 'Cloudinary cloud name চিনতে পারছে না — CLOUDINARY_CLOUD_NAME দেখুন।',
  api_key: 'Cloudinary API key গ্রহণ করেনি — CLOUDINARY_API_KEY এবং সেটি একই cloud name-এর কিনা দেখুন।',
  api_secret: 'Cloudinary API secret মিলছে না — CLOUDINARY_API_SECRET আবার কপি করে বসান।',
  permission: 'এই API key-র আপলোডের অনুমতি নেই — Cloudinary Console-এ কী-টির Role দেখুন।',
  account: 'Cloudinary অ্যাকাউন্টটি নিষ্ক্রিয়/সীমিত — Cloudinary Console দেখুন।',
  clock: 'সার্ভারের ঘড়ি (সময়) ভুল, তাই Cloudinary অনুরোধ বাতিল করছে।',
  auth: 'Cloudinary ক্রেডেনশিয়াল গ্রহণ করেনি — তিনটি মান একই অ্যাকাউন্টের কিনা দেখুন।',
  rate_limit: 'Cloudinary সাময়িকভাবে অনুরোধ সীমিত করেছে — কিছুক্ষণ পর নিজে থেকেই আবার চেষ্টা হবে।',
  network: 'সার্ভার থেকে Cloudinary-তে এই মুহূর্তে পৌঁছানো যাচ্ছে না — নিজে থেকেই আবার চেষ্টা হবে।',
  timeout: 'Cloudinary সময়মতো উত্তর দেয়নি — নিজে থেকেই আবার চেষ্টা হবে।',
  service: 'Cloudinary সার্ভারে সাময়িক সমস্যা — নিজে থেকেই আবার চেষ্টা হবে।',
  unknown: 'Cloudinary পরীক্ষা ব্যর্থ হয়েছে।',
};

export function describeStorageStatus(): StorageStatus {
  const creds = currentCredentials();
  const documents: StorageStatus['documents'] = {
    provider: 'am-storage',
    configured: isAmStorageConfigured(),
    host: amStorageHost(),
  };
  const base = { provider: 'cloudinary' as const, documents, folder: cloudFolder(), checking: Boolean(checkInFlight) };

  if (!creds.complete) {
    const missing = creds.missing.map(primaryVariable);
    return {
      ...base,
      configured: false,
      state: 'not_configured',
      durable: false,
      cloudName: creds.cloudName || undefined,
      lastCheck: null,
      missing,
      hint: `Cloudinary কনফিগার করা নেই (${missing.join(', ')} পাওয়া যায়নি), তাই ছবি/ভিডিও আপলোড বন্ধ।`,
    };
  }

  const check = lastCheckFingerprint === appliedFingerprint ? lastCheck : null;
  const state: StorageStatus['state'] = check ? check.state : checkInFlight ? 'checking' : 'unknown';
  return {
    ...base,
    configured: true,
    state,
    durable: state !== 'failed' && state !== 'unreachable',
    cloudName: creds.cloudName,
    lastCheck: check,
    hint: check && !check.ok ? `${REASON_HINT[check.reason || 'unknown']} (${check.error || 'unknown error'})` : '',
  };
}

/** Admin-only extras: which variables were used and what was auto-corrected. Never the secret. */
export interface StorageCredentialReport {
  cloudName: string;
  apiKeyMasked: string;
  apiSecretSet: boolean;
  apiSecretLength: number;
  sources: CloudinaryCredentials['sources'];
  missing: string[];
  notices: CloudinaryCredentials['notices'];
}

export function describeStorageCredentials(): StorageCredentialReport {
  const creds = currentCredentials();
  return {
    cloudName: creds.cloudName,
    apiKeyMasked: maskApiKey(creds.apiKey),
    apiSecretSet: Boolean(creds.apiSecret),
    apiSecretLength: creds.apiSecret.length,
    sources: creds.sources,
    missing: creds.missing.map(primaryVariable),
    notices: creds.notices,
  };
}

/** What the browser gets back after a successful upload. */
export interface StoredAsset {
  /** Public CDN URL (https://res.cloudinary.com/…). */
  url: string;
  /** Cloudinary public_id — needed to delete / replace the asset later. */
  publicId?: string;
  kind: UploadKind;
  resourceType: 'image' | 'video' | 'raw';
  /** Where the bytes live: Cloudinary (image/video) or the AM Storage gateway (documents). */
  storage: 'cloudinary' | 'am-storage';
  bytes?: number;
  format?: string;
  /** Seconds — videos only. */
  duration?: number;
  width?: number;
  height?: number;
  /** Poster frame for videos. */
  thumbnailUrl?: string;
  /** Original file name, kept only so the UI can show something familiar. */
  originalName?: string;
}

function toHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

/** True for URLs that live in our Cloudinary account (used to validate client-supplied URLs). */
export function isCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\//i.test(url || '');
}

/** Best-effort poster URL for a Cloudinary video (2s in, 640×360 crop). */
export function cloudinaryVideoThumbnail(videoUrl: string): string {
  if (!videoUrl.includes('/upload/')) return videoUrl;
  const transformed = videoUrl.replace('/upload/', '/upload/so_2,w_640,h_360,c_fill,q_auto,f_jpg/');
  return toHttps(transformed.replace(/\.(mp4|webm|mov|mkv|avi|ogv|m4v)(\?.*)?$/i, '.jpg$2'));
}

function deleteLocalCopy(filePath: string) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* staging leftovers are never fatal */
  }
}

/** `vdo_bogura/gallery` style folder, always inside the site's root folder. */
export function assetFolder(subFolder?: string): string {
  const safe = (subFolder || '')
    .toLowerCase()
    .replace(/[^a-z0-9/\-_]/g, '')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 60);
  const root = cloudFolder();
  return safe ? `${root}/${safe}` : root;
}

interface CloudinaryResponse {
  secure_url?: string;
  url?: string;
  public_id?: string;
  resource_type?: string;
  bytes?: number;
  format?: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  thumbnail_url?: string;
}

const NOT_CONFIGURED_MESSAGE =
  'ছবি/ভিডিও সংরক্ষণ করা যায়নি — সার্ভারে Cloudinary কনফিগার করা নেই। ' +
  'হোস্টিং প্যানেলের Environment Variables-এ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET ' +
  '(অথবা CLOUDINARY_URL) যোগ করে সার্ভার রিস্টার্ট করুন। এর আগে কোনো ফাইল আপলোড হবে না।';

function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/** Bengali explanation for a file Cloudinary refused (the connection itself is fine). */
function fileRejectedMessage(info: CloudinaryErrorInfo, kind: UploadKind): { message: string; status: number } {
  const sizes = info.message.match(/Got (\d+)\. Maximum is (\d+)/i);
  if (sizes) {
    return {
      status: 413,
      message:
        `ফাইলটি ${formatMegabytes(Number(sizes[1]))} — আপনার Cloudinary প্ল্যানে ${kind === 'video' ? 'ভিডিওর' : 'ছবির'} সর্বোচ্চ সীমা ` +
        `${formatMegabytes(Number(sizes[2]))}। ছোট/কমপ্রেস করা ফাইল দিন। (Cloudinary সংযোগ ঠিক আছে — সমস্যা শুধু এই ফাইলের আকারে।)`,
    };
  }
  return {
    status: 422,
    message:
      `Cloudinary এই ফাইলটি গ্রহণ করেনি। অন্য ফাইল বা অন্য ফরম্যাটে (${kind === 'video' ? 'MP4' : 'JPG/PNG/WebP'}) চেষ্টা করুন। ` +
      `(Cloudinary সংযোগ ঠিক আছে — সমস্যা এই ফাইলে।)\n(${info.message})`,
  };
}

/** Bengali explanation for an upload that failed because of the account / credentials / network. */
function connectionFailureMessage(info: CloudinaryErrorInfo): string {
  if (info.transient) {
    return (
      'এই মুহূর্তে Cloudinary-তে পৌঁছানো যাচ্ছে না (নেটওয়ার্ক/সাময়িক সমস্যা) — কিছুক্ষণ পর আবার চেষ্টা করুন। ' +
      `ক্রেডেনশিয়াল বদলানোর দরকার নেই।\n(${info.message})`
    );
  }
  return `Cloudinary আপলোড গ্রহণ করেনি: ${REASON_HINT[info.reason]}\n(${info.message})`;
}

/**
 * Push one staged (temporary) file to the cloud and remove the temp copy.
 *
 * Documents (PDF, DOC, DOCX, TXT) go to the AM Storage gateway; pictures and
 * videos to Cloudinary. Videos go through `upload_large`, which chunks the
 * request so a few-hundred-MB file does not die on a proxy timeout. Any failure
 * throws a StorageError / AmStorageError with a message the admin panel can
 * show directly — we never fall back to the local disk.
 *
 * Only failures that are about the connection (credentials, account, network)
 * change the connection status shown in the admin banner; a single file that
 * Cloudinary refuses (too large for the plan, unreadable…) does not.
 */
export async function putFile(
  tempPath: string,
  options: { kind: UploadKind; folder?: string; originalName?: string; mimeType?: string; title?: string }
): Promise<StoredAsset> {
  const { kind, folder = 'misc', originalName } = options;

  if (kind === 'document') {
    return putDocument(tempPath, options);
  }

  if (!currentCredentials().complete) {
    deleteLocalCopy(tempPath);
    throw new StorageError('cloud_storage_not_configured', NOT_CONFIGURED_MESSAGE);
  }
  const fingerprint = appliedFingerprint;

  // Only images and videos reach Cloudinary (documents were routed above).
  const resourceType: StoredAsset['resourceType'] = kind === 'image' ? 'image' : 'video';

  // Stored as uploaded (no eager derivatives: `f_auto` has no effect in eager
  // transformations and a synchronous derivative only slowed uploads down).
  const base = {
    folder: assetFolder(folder),
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    timeout: 10 * 60 * 1000,
  } as Record<string, unknown>;

  let uploaded: CloudinaryResponse;
  try {
    if (kind === 'video') {
      // `upload_large` is callback based (it returns a stream), so it must be
      // promisified explicitly or the upload silently never finishes.
      uploaded = await new Promise<CloudinaryResponse>((resolve, reject) => {
        cloudinary.uploader.upload_large(
          tempPath,
          { ...base, chunk_size: 20 * 1024 * 1024 },
          (error: unknown, result: CloudinaryResponse | undefined) => {
            if (error || !result) return reject(error || new Error('Cloudinary returned an empty result'));
            resolve(result);
          }
        );
      });
    } else {
      uploaded = (await cloudinary.uploader.upload(tempPath, base)) as CloudinaryResponse;
    }
  } catch (error) {
    deleteLocalCopy(tempPath);
    const info = classifyCloudinaryError(error);
    if (info.fileProblem) {
      console.warn(`[storage] Cloudinary refused "${originalName || 'file'}": ${info.message}`);
      const { message, status } = fileRejectedMessage(info, kind);
      throw new StorageError('cloud_file_rejected', message, error, status);
    }
    recordCheck(failedCheck('upload', info), fingerprint);
    throw new StorageError(
      info.transient ? 'cloud_storage_unavailable' : 'cloud_storage_auth_failed',
      connectionFailureMessage(info),
      error
    );
  }

  // The asset is safe in the cloud — the staging copy can go.
  deleteLocalCopy(tempPath);
  const rawUrl = uploaded.secure_url || uploaded.url || '';
  if (!rawUrl) {
    throw new StorageError(
      'cloud_storage_unavailable',
      'Cloudinary ফাইলটি নিয়েছে কিন্তু কোনো লিংক ফেরত দেয়নি — আবার চেষ্টা করুন।'
    );
  }
  recordCheck(successCheck('upload'), fingerprint);

  const url = toHttps(rawUrl);
  const derivedThumbnail =
    uploaded.thumbnail || uploaded.thumbnail_url || (kind === 'video' ? cloudinaryVideoThumbnail(url) : url);

  return {
    url,
    publicId: uploaded.public_id,
    kind,
    resourceType: (uploaded.resource_type as StoredAsset['resourceType']) || resourceType,
    storage: 'cloudinary',
    bytes: typeof uploaded.bytes === 'number' ? uploaded.bytes : undefined,
    format: uploaded.format,
    duration: typeof uploaded.duration === 'number' ? uploaded.duration : undefined,
    width: typeof uploaded.width === 'number' ? uploaded.width : undefined,
    height: typeof uploaded.height === 'number' ? uploaded.height : undefined,
    thumbnailUrl: toHttps(derivedThumbnail || ''),
    originalName,
  };
}

/** Documents: hand the staged file to the AM Storage gateway. */
async function putDocument(
  tempPath: string,
  options: { folder?: string; originalName?: string; mimeType?: string; title?: string }
): Promise<StoredAsset> {
  try {
    const stored = await uploadDocumentToAmStorage({
      filePath: tempPath,
      originalName: options.originalName,
      mimeType: options.mimeType,
      title: options.title,
    });
    deleteLocalCopy(tempPath);
    const ext = (options.originalName || '').split('.').pop()?.toLowerCase() || undefined;
    return {
      url: stored.url,
      publicId: stored.fileId ? `${AM_STORAGE_ID_PREFIX}${stored.fileId}` : undefined,
      kind: 'document',
      resourceType: 'raw',
      storage: 'am-storage',
      bytes: stored.bytes,
      format: ext && ext.length <= 5 ? ext : undefined,
      thumbnailUrl: stored.url,
      originalName: options.originalName,
    };
  } catch (error) {
    deleteLocalCopy(tempPath);
    if (error instanceof AmStorageError) throw error;
    const message = (error as Error).message || String(error);
    console.error('[storage] document upload failed:', message);
    throw new AmStorageError(`PDF/নথি ফাইলটি সংরক্ষণ করা যায়নি।\n(${message})`, error);
  }
}

/**
 * Delete a stored asset. Safe to call with an undefined id (legacy URLs).
 * Ids prefixed `amstorage/` belong to the document gateway; everything else is
 * a Cloudinary public id.
 *
 * When the resource type was not recorded next to the public id, every type is
 * tried until Cloudinary reports `ok` — a PDF uploaded with `resource_type=auto`
 * lives under "image", a DOCX under "raw", and orphaned files should not be a
 * reason to keep billing.
 */
export async function deleteAsset(publicId?: string, resourceType?: StoredAsset['resourceType']): Promise<void> {
  if (!publicId) return;
  if (publicId.startsWith(AM_STORAGE_ID_PREFIX)) {
    await deleteDocumentFromAmStorage(publicId.slice(AM_STORAGE_ID_PREFIX.length));
    return;
  }
  if (!currentCredentials().complete) return;

  const attempts: StoredAsset['resourceType'][] = resourceType ? [resourceType] : ['image', 'video', 'raw'];
  for (const type of attempts) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await cloudinary.uploader.destroy(publicId, { resource_type: type, invalidate: true });
      if (result?.result === 'ok') return;
    } catch (error) {
      console.warn(`[storage] Cloudinary destroy (${type}) failed for ${publicId}:`, (error as Error).message);
    }
  }
}

export { cloudinary };
