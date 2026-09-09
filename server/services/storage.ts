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
 */
import fs from 'fs';
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

export class StorageError extends Error {
  status = 503;
  code: 'cloud_storage_not_configured' | 'cloud_storage_unavailable';

  constructor(code: StorageError['code'], message: string, public cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/**
 * Root folder inside the Cloudinary media library.
 *
 * Read lazily on purpose: this module is evaluated before dotenv has run, so a
 * constant computed at load time would silently ignore CLOUDINARY_FOLDER from .env.
 */
function cloudFolder(): string {
  return (process.env.CLOUDINARY_FOLDER || 'vdo_bogura').trim().replace(/^\/+|\/+$/g, '');
}

const NOT_CONFIGURED_MESSAGE =
  'ছবি/ভিডিও সংরক্ষণ করা যায়নি — সার্ভারে Cloudinary কনফিগার করা নেই। ' +
  'হোস্টিং প্যানেলের Environment Variables-এ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET ' +
  '(অথবা CLOUDINARY_URL) যোগ করে সার্ভার রিস্টার্ট করুন। এর আগে কোনো ফাইল আপলোড হবে না।';

const UNAVAILABLE_MESSAGE =
  'Cloudinary-তে ফাইলটি পাঠানো যায়নি। ইন্টারনেট সংযোগ এবং CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ঠিক ' +
  'আছে কিনা দেখে আবার চেষ্টা করুন।';

let configured = false;
let lastPing: { ok: boolean; at: string; error?: string } | null = null;

/** Lazily configure the SDK so the credentials are read whenever .env is loaded. */
function ensureConfigured(): boolean {
  const hasKeys = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  if (!hasKeys && !hasUrl) return false;

  if (!configured) {
    if (hasKeys) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      console.log('[storage] Cloudinary ready — cloud:', process.env.CLOUDINARY_CLOUD_NAME);
    } else {
      cloudinary.config({ secure: true });
      console.log('[storage] Cloudinary ready — using CLOUDINARY_URL');
    }
    configured = true;
  }
  return true;
}

export function isStorageConfigured(): boolean {
  return ensureConfigured();
}

export interface StorageStatus {
  provider: 'cloudinary';
  configured: boolean;
  /** Document (PDF) gateway — separate from the Cloudinary media account. */
  documents: { provider: 'am-storage'; configured: boolean; host: string };
  /** True when uploads can be stored durably right now. */
  durable: boolean;
  cloudName?: string;
  folder: string;
  lastCheck?: { ok: boolean; at: string; error?: string } | null;
  /** Operator-facing explanation, never contains secrets. */
  hint: string;
}

export function describeStorageStatus(): StorageStatus {
  const isConfigured = ensureConfigured();
  const documents: StorageStatus['documents'] = {
    provider: 'am-storage',
    configured: isAmStorageConfigured(),
    host: amStorageHost(),
  };
  if (isConfigured) {
    const pingFailed = lastPing && !lastPing.ok;
    return {
      provider: 'cloudinary',
      configured: true,
      documents,
      durable: !pingFailed,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || cloudinary.config().cloud_name || undefined,
      folder: cloudFolder(),
      lastCheck: lastPing,
      hint: pingFailed
        ? `Cloudinary-র ক্রেডেনশিয়াল সেট করা আছে কিন্তু শেষ পরীক্ষা ব্যর্থ হয়েছে: ${lastPing?.error || 'unknown error'}`
        : '',
    };
  }

  return {
    provider: 'cloudinary',
    configured: false,
    documents,
    durable: false,
    folder: cloudFolder(),
    lastCheck: lastPing,
    hint:
      'Cloudinary কনফিগার করা নেই, তাই আপলোড বন্ধ। CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET সেট করুন।',
  };
}

/** Ping Cloudinary once at boot so a wrong key shows up in the log, not mid-upload. */
export async function verifyStorageConnection(): Promise<boolean> {
  if (!ensureConfigured()) {
    console.error('[storage] Cloudinary is NOT configured — every upload will be refused until the credentials are set.');
    return false;
  }
  try {
    await cloudinary.api.ping();
    lastPing = { ok: true, at: new Date().toISOString() };
    console.log('[storage] Cloudinary connection verified — uploads are stored in the cloud.');
    return true;
  } catch (err) {
    const message =
      (err as { error?: { message?: string } }).error?.message || (err as Error).message || String(err);
    lastPing = { ok: false, at: new Date().toISOString(), error: message };
    console.error('[storage] Cloudinary ping FAILED — check the CLOUDINARY_* credentials:', message);
    return false;
  }
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

/**
 * Push one staged (temporary) file to the cloud and remove the temp copy.
 *
 * Documents (PDF, DOC, DOCX, TXT) go to the AM Storage gateway; pictures and
 * videos to Cloudinary. Videos go through `upload_large`, which chunks the
 * request so a few-hundred-MB file does not die on a proxy timeout. Any failure
 * throws a StorageError / AmStorageError with a message the admin panel can
 * show directly — we never fall back to the local disk.
 */
export async function putFile(
  tempPath: string,
  options: { kind: UploadKind; folder?: string; originalName?: string; mimeType?: string; title?: string }
): Promise<StoredAsset> {
  const { kind, folder = 'misc', originalName } = options;

  if (kind === 'document') {
    return putDocument(tempPath, options);
  }

  if (!ensureConfigured()) {
    deleteLocalCopy(tempPath);
    throw new StorageError('cloud_storage_not_configured', NOT_CONFIGURED_MESSAGE);
  }

  // Only images and videos reach Cloudinary (documents were routed above).
  const resourceType: StoredAsset['resourceType'] = kind === 'image' ? 'image' : 'video';

  const base = {
    folder: assetFolder(folder),
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    timeout: 10 * 60 * 1000,
  } as Record<string, unknown>;

  // Images are stored in their original format but auto-optimized on delivery.
  if (kind === 'image') {
    base.eager = [{ fetch_format: 'auto', quality: 'auto' }];
  }

  try {
    let uploaded: CloudinaryResponse;

    if (kind === 'video') {
      // `upload_large` is callback based (it returns a stream), so it must be
      // promisified explicitly or the upload silently never finishes.
      uploaded = await new Promise<CloudinaryResponse>((resolve, reject) => {
        cloudinary.uploader.upload_large(
          tempPath,
          { ...base, chunk_size: 20 * 1024 * 1024 },
          (error: Error | null, result: CloudinaryResponse | undefined) => {
            if (error || !result) return reject(error || new Error('Cloudinary returned an empty result'));
            resolve(result);
          }
        );
      });
    } else {
      uploaded = (await cloudinary.uploader.upload(tempPath, base)) as CloudinaryResponse;
    }

    const rawUrl = uploaded.secure_url || uploaded.url || '';
    if (!rawUrl) throw new Error('Cloudinary response did not contain a URL');

    // The asset is safe in the cloud — the staging copy can go.
    deleteLocalCopy(tempPath);
    lastPing = { ok: true, at: new Date().toISOString() };

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
  } catch (error) {
    deleteLocalCopy(tempPath);
    const message =
      (error as { error?: { message?: string } }).error?.message || (error as Error).message || String(error);
    lastPing = { ok: false, at: new Date().toISOString(), error: message };
    console.error('[storage] Cloudinary upload failed:', message);
    throw new StorageError('cloud_storage_unavailable', `${UNAVAILABLE_MESSAGE}\n(${message})`, error);
  }
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
  if (!ensureConfigured()) return;

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
