/**
 * AM Storage Company bridge — document (PDF / DOC / DOCX / TXT) storage.
 * ---------------------------------------------------------------------------
 * Cloudinary is kept for pictures and videos only. Every *document* an admin (or
 * a job applicant) uploads is pushed, server-side, to the AM Storage gateway:
 *
 *     POST {AM_STORAGE_BRIDGE_URL}/api/v1/storage/upload   (multipart: file, title)
 *
 * Two authentication modes are supported (see the gateway guide):
 *   - `dual`  (default) — key id + key secret travel as headers over TLS.
 *   - `hmac`            — the secret never leaves the server; the request is
 *                          signed as  HMAC_SHA256(secret, "<ts>:<sha256hex(body)>").
 *
 * The multipart body is assembled by hand so the exact bytes are known — that
 * is what makes the HMAC mode possible with the same code path.
 *
 * Configuration is read lazily (dotenv runs after this module is evaluated).
 * The values fall back to the credentials issued for this site so the gateway
 * works out of the box; setting AM_STORAGE_* in the environment overrides them.
 */
import fs from 'fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';

const DEFAULT_BRIDGE_URL = 'https://st.thamjj13.top';
const DEFAULT_KEY_ID = 'am_store_live_j7OX7YW2HBHveff1';
const DEFAULT_KEY_SECRET = 'am_sec_live__sJQeDB79gxeQMsu3GYIJSIiworDApHMDxfMZztkXPI';

const UPLOAD_PATH = '/api/v1/storage/upload';
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export type AmAuthMode = 'dual' | 'hmac';

export interface AmStorageConfig {
  baseUrl: string;
  keyId: string;
  keySecret: string;
  mode: AmAuthMode;
}

function env(name: string): string {
  return (process.env[name] || '').trim();
}

/** Resolved settings: environment first, built-in defaults second. */
export function amStorageConfig(): AmStorageConfig {
  const baseUrl = (env('AM_STORAGE_BRIDGE_URL') || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
  const mode: AmAuthMode = env('AM_STORAGE_AUTH_MODE').toLowerCase() === 'hmac' ? 'hmac' : 'dual';
  return {
    baseUrl,
    keyId: env('AM_STORAGE_KEY_ID') || DEFAULT_KEY_ID,
    keySecret: env('AM_STORAGE_KEY_SECRET') || DEFAULT_KEY_SECRET,
    mode,
  };
}

export function isAmStorageConfigured(): boolean {
  const cfg = amStorageConfig();
  return Boolean(cfg.baseUrl && cfg.keyId && cfg.keySecret && /^https?:\/\//i.test(cfg.baseUrl));
}

/** Host name only — safe to show in the admin health banner. */
export function amStorageHost(): string {
  try {
    return new URL(amStorageConfig().baseUrl).host;
  } catch {
    return amStorageConfig().baseUrl;
  }
}

export class AmStorageError extends Error {
  status = 503;
  code = 'document_storage_unavailable' as const;
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'AmStorageError';
  }
}

/** Gateway response as documented: `{ data: { file: {...}, url } }` (read leniently). */
interface GatewayFileRecord {
  id?: string | number;
  title?: string;
  size?: number;
  bytes?: number;
  retention?: unknown;
  status?: string;
  url?: string;
  mime?: string;
  mimeType?: string;
  contentType?: string;
}
interface GatewayResponse {
  data?: { file?: GatewayFileRecord; url?: string };
  file?: GatewayFileRecord;
  url?: string;
  error?: unknown;
  message?: unknown;
}

export interface AmStoredFile {
  /** URL visitors open (the gateway hands back a signed PDF URL). */
  url: string;
  /** Gateway record id — kept so the file can be traced / removed later. */
  fileId?: string;
  title?: string;
  bytes?: number;
  status?: string;
  retention?: unknown;
}

/* ── multipart helpers ─────────────────────────────────────────────────── */

function contentTypeFor(fileName: string, fallback?: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    default:
      return fallback || 'application/octet-stream';
  }
}

/** Header values may not contain quotes / CR / LF — strip anything risky. */
function safeHeaderValue(value: string): string {
  return value.replace(/["\r\n\\]/g, '_');
}

interface MultipartPart {
  name: string;
  value: Buffer;
  fileName?: string;
  contentType?: string;
}

/** Build a complete `multipart/form-data` body so the exact bytes can be signed. */
export function buildMultipartBody(parts: MultipartPart[]): { body: Buffer; contentType: string } {
  const boundary = `----AMStorage${randomBytes(16).toString('hex')}`;
  const chunks: Buffer[] = [];
  for (const part of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${safeHeaderValue(part.name)}"`;
    if (part.fileName) head += `; filename="${safeHeaderValue(part.fileName)}"`;
    head += '\r\n';
    if (part.contentType) head += `Content-Type: ${part.contentType}\r\n`;
    head += '\r\n';
    chunks.push(Buffer.from(head, 'utf8'), part.value, Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

/** Headers for one request, in the configured auth mode. */
export function authHeaders(cfg: AmStorageConfig, body: Buffer, now = Date.now()): Record<string, string> {
  if (cfg.mode === 'hmac') {
    const timestamp = Math.floor(now / 1000);
    const bodyHash = createHash('sha256').update(body).digest('hex');
    const signature = createHmac('sha256', cfg.keySecret).update(`${timestamp}:${bodyHash}`).digest('hex');
    return {
      'X-AM-Storage-Key-Id': cfg.keyId,
      'X-AM-Storage-Timestamp': String(timestamp),
      'X-AM-Storage-Signature': signature,
    };
  }
  return { 'X-AM-Storage-Key-Id': cfg.keyId, 'X-AM-Storage-Key-Secret': cfg.keySecret };
}

function extractMessage(payload: GatewayResponse | null, rawText: string, fallback: string): string {
  const raw = payload?.message ?? payload?.error;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object' && typeof (raw as { message?: unknown }).message === 'string') {
    return String((raw as { message: string }).message);
  }
  const clean = (rawText || '').trim();
  if (clean.startsWith('<!DOCTYPE') || clean.startsWith('<html') || clean.includes('/_next/static/')) {
    return 'গেটওয়ে সার্ভার থেকে API JSON-এর পরিবর্তে Next.js ওয়েবপেজ (HTML 404) ফেরত এসেছে — গেটওয়ে সার্ভারে /api/v1/storage/upload এন্ডপয়েন্ট পাওয়া যায়নি।';
  }
  return clean.slice(0, 200) || fallback;
}

function titleFrom(originalName: string | undefined, fallback: string): string {
  const base = (originalName || '').replace(/\.[^.]+$/, '').replace(/[\r\n\t]/g, ' ').trim();
  return (base || fallback).slice(0, 200);
}

/* ── public API ────────────────────────────────────────────────────────── */

const UNAVAILABLE_MESSAGE =
  'PDF/নথি ফাইলটি ডকুমেন্ট স্টোরেজ (AM Storage) সার্ভারে পাঠানো যায়নি। ' +
  'ইন্টারনেট সংযোগ এবং AM_STORAGE_BRIDGE_URL / AM_STORAGE_KEY_ID / AM_STORAGE_KEY_SECRET ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।';

/**
 * Upload one staged document to the gateway.
 *
 * Reads the file fully into memory on purpose: document ceilings are small
 * (25 MB default) and the HMAC mode needs the complete body to sign it.
 */
export async function uploadDocumentToAmStorage(options: {
  filePath: string;
  originalName?: string;
  mimeType?: string;
  /** Free-text label stored next to the file (defaults to the file name). */
  title?: string;
}): Promise<AmStoredFile> {
  const cfg = amStorageConfig();
  if (!isAmStorageConfigured()) {
    throw new AmStorageError(
      'ডকুমেন্ট স্টোরেজ কনফিগার করা নেই — AM_STORAGE_BRIDGE_URL, AM_STORAGE_KEY_ID ও AM_STORAGE_KEY_SECRET সেট করুন।'
    );
  }

  const fileName = (options.originalName || 'document.pdf').replace(/[/\\]/g, '_').slice(0, 180) || 'document.pdf';
  const title = options.title?.trim() || titleFrom(options.originalName, 'Document');
  const fileBytes = await fs.promises.readFile(options.filePath);

  const { body, contentType } = buildMultipartBody([
    { name: 'file', value: fileBytes, fileName, contentType: contentTypeFor(fileName, options.mimeType) },
    { name: 'title', value: Buffer.from(title, 'utf8') },
  ]);

  const url = cfg.baseUrl + UPLOAD_PATH;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(cfg, body), 'Content-Type': contentType, Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = (error as Error)?.message || String(error);
    console.error('[am-storage] upload request failed:', reason);
    throw new AmStorageError(`${UNAVAILABLE_MESSAGE}\n(${reason})`, error);
  }

  let payload: GatewayResponse | null = null;
  const text = await response.text();
  try {
    payload = text ? (JSON.parse(text) as GatewayResponse) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const reason = extractMessage(payload, text, `HTTP ${response.status}`);
    console.error(`[am-storage] gateway rejected the upload (HTTP ${response.status}):`, reason);
    throw new AmStorageError(`${UNAVAILABLE_MESSAGE}\n(HTTP ${response.status}: ${reason})`);
  }

  const record = payload?.data?.file || payload?.file || undefined;
  const fileUrl = payload?.data?.url || record?.url || payload?.url || '';
  if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
    console.error('[am-storage] gateway answered without a file URL:', text.slice(0, 300));
    throw new AmStorageError(`${UNAVAILABLE_MESSAGE}\n(গেটওয়ে কোনো ফাইল URL ফেরত দেয়নি)`);
  }

  const size = typeof record?.size === 'number' ? record.size : typeof record?.bytes === 'number' ? record.bytes : undefined;
  return {
    url: fileUrl,
    fileId: record?.id !== undefined && record?.id !== null ? String(record.id) : undefined,
    title: record?.title || title,
    bytes: size ?? fileBytes.length,
    status: record?.status,
    retention: record?.retention,
  };
}

/**
 * Best-effort removal of a gateway file (used when an admin discards or
 * replaces a document). The bridge guide documents upload only, so a missing
 * DELETE route is tolerated silently — nothing on our side depends on it.
 */
export async function deleteDocumentFromAmStorage(fileId?: string): Promise<boolean> {
  const id = (fileId || '').trim();
  if (!id || !isAmStorageConfigured()) return false;
  const cfg = amStorageConfig();
  try {
    const body = Buffer.alloc(0);
    const response = await fetch(`${cfg.baseUrl}/api/v1/storage/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { ...authHeaders(cfg, body), Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) return true;
    if (response.status !== 404 && response.status !== 405) {
      console.warn(`[am-storage] delete of ${id} answered HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`[am-storage] delete of ${id} failed:`, (error as Error).message);
  }
  return false;
}

/** True for URLs that point at the configured gateway host. */
export function isAmStorageUrl(url: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).host === amStorageHost();
  } catch {
    return false;
  }
}
