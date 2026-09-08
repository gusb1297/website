import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { isCloudStorageRequired, isEphemeralHost } from './env';

let configured = false;
/** Result of the last connectivity check (null = not checked yet). */
let lastPing: { ok: boolean; at: string; error?: string } | null = null;

/**
 * Configure the SDK the first time it is actually needed. Doing this lazily
 * (instead of at import time) means the credentials are picked up no matter
 * when the env file is loaded.
 */
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
      console.log('Cloudinary initialized with Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
    } else {
      cloudinary.config({ secure: true });
      console.log('Cloudinary initialized via CLOUDINARY_URL');
    }
    configured = true;
  }
  return true;
}

/** True when Cloudinary credentials are available in the environment. */
export function isCloudinaryConfigured(): boolean {
  return ensureConfigured();
}

/**
 * Error raised when a file cannot be stored durably. Controllers let it bubble
 * to the global error handler, which turns it into a 503 JSON response so the
 * admin sees exactly why the upload was refused instead of a silent "saved"
 * that vanishes on the next deploy.
 */
export class StorageError extends Error {
  status = 503;
  code: 'cloud_storage_not_configured' | 'cloud_storage_unavailable';

  constructor(code: StorageError['code'], message: string, public cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

const NOT_CONFIGURED_MESSAGE =
  'ফাইল স্টোরেজ (Cloudinary) কনফিগার করা নেই, তাই আপলোড সংরক্ষণ করা যাচ্ছে না। ' +
  'এই সার্ভারের লোকাল ডিস্ক প্রতিটি ডিপ্লয়/রিস্টার্টে মুছে যায়। ' +
  'হোস্টিং প্যানেলে CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ও CLOUDINARY_API_SECRET (অথবা CLOUDINARY_URL) সেট করে রিস্টার্ট করুন।';

const UNAVAILABLE_MESSAGE =
  'Cloudinary-তে ফাইল আপলোড করা যায়নি। API key/secret সঠিক কিনা ও ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।';

export interface StorageStatus {
  /** Which backend an upload made right now would land on. */
  provider: 'cloudinary' | 'local';
  configured: boolean;
  /** True when local-disk fallback is disabled (production / ephemeral host). */
  cloudRequired: boolean;
  /** True on a host whose disk is wiped on deploy (Render, Heroku, …). */
  ephemeralHost: boolean;
  /** True when uploads can be stored durably right now. */
  durable: boolean;
  cloudName?: string;
  lastCheck?: { ok: boolean; at: string; error?: string } | null;
  /** Operator-facing explanation (never includes secrets). */
  hint: string;
}

export function describeStorageStatus(): StorageStatus {
  const configuredNow = ensureConfigured();
  const cloudRequired = isCloudStorageRequired();
  const ephemeralHost = isEphemeralHost();

  if (configuredNow) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || cloudinary.config().cloud_name || undefined;
    const pingFailed = lastPing && !lastPing.ok;
    return {
      provider: 'cloudinary',
      configured: true,
      cloudRequired,
      ephemeralHost,
      durable: !pingFailed,
      cloudName,
      lastCheck: lastPing,
      hint: pingFailed
        ? `Cloudinary credentials are set but the last connectivity check failed: ${lastPing?.error || 'unknown error'}. Check CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.`
        : '',
    };
  }

  return {
    provider: 'local',
    configured: false,
    cloudRequired,
    ephemeralHost,
    durable: !cloudRequired,
    lastCheck: null,
    hint: cloudRequired
      ? 'Cloudinary is NOT configured. Uploads are refused because files written to this server’s local disk are deleted on every deploy/restart. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (or CLOUDINARY_URL).'
      : 'Cloudinary is not configured — uploads are kept in ./uploads on the local disk (fine for development only).',
  };
}

/**
 * Call Cloudinary's ping endpoint once so a typo in the credentials shows up
 * in the boot log (and in /api/health) instead of at the first admin upload.
 */
export async function verifyCloudinaryConnection(): Promise<boolean> {
  if (!ensureConfigured()) return false;
  try {
    await cloudinary.api.ping();
    lastPing = { ok: true, at: new Date().toISOString() };
    console.log('[storage] Cloudinary connection verified — uploads are stored in the cloud.');
    return true;
  } catch (err) {
    const message = (err as { error?: { message?: string }; message?: string }).error?.message ||
      (err as Error).message ||
      String(err);
    lastPing = { ok: false, at: new Date().toISOString(), error: message };
    console.error('[storage] Cloudinary ping FAILED — check CLOUDINARY_* credentials:', message);
    return false;
  }
}

export interface StoredFile {
  /** Public URL the browser can load (Cloudinary secure_url or a local /uploads path). */
  url: string;
  /** Cloudinary public_id — only present when the asset lives in Cloudinary. */
  publicId?: string;
  /** Cloudinary resource type (image / video / raw). */
  resourceType?: string;
  /** Where the file physically lives. */
  storage: 'cloudinary' | 'local';
  /** Video/audio duration in seconds (Cloudinary only). */
  duration?: number;
  /** File size in bytes. */
  bytes?: number;
  /** Auto-derived poster frame for videos (Cloudinary only). */
  thumbnailUrl?: string;
  format?: string;
}

function removeLocalFile(filePath: string) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function localUrlFor(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath).split(path.sep).join('/');
  return `/${relative}`;
}

/**
 * Build a poster-frame URL from a Cloudinary *video* URL by asking Cloudinary
 * for a JPG frame two seconds in (no extra upload / no ffmpeg needed).
 */
export function cloudinaryVideoThumbnail(videoUrl: string): string {
  if (!videoUrl.includes('/upload/')) return videoUrl;
  const transformed = videoUrl.replace('/upload/', '/upload/so_2,w_640,h_360,c_fill,q_auto,f_jpg/');
  return transformed.replace(/\.(mp4|webm|mov|mkv|avi|ogv|m4v)(\?.*)?$/i, '.jpg$2');
}

/**
 * Upload any local temp file to storage.
 *
 * - Cloudinary configured → the file is pushed to the cloud (large videos are
 *   streamed with `upload_large`, which chunks the request so multi-hundred-MB
 *   files do not fail) and the local temp copy is removed.
 * - Cloudinary NOT configured / upload failed:
 *     • development (local disk is persistent) → the file stays in `uploads/`
 *       and its local URL is returned;
 *     • production or an ephemeral host (Render, Heroku, …) → a `StorageError`
 *       is thrown. Silently "saving" to a disk that is wiped on the next deploy
 *       is exactly the bug that made uploaded photos disappear, so the upload
 *       is refused with a clear message instead.
 */
export async function storeFile(
  filePath: string,
  options: { folder?: string; resourceType?: 'image' | 'video' | 'raw' | 'auto'; keepLocal?: boolean } = {}
): Promise<StoredFile> {
  const { folder = 'vdo_bogura', resourceType = 'auto', keepLocal = false } = options;
  const cloudRequired = isCloudStorageRequired();

  if (ensureConfigured()) {
    try {
      const isVideo = resourceType === 'video';
      const uploadOptions = {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        ...(isVideo ? { chunk_size: 20 * 1024 * 1024 } : {}),
      } as Record<string, unknown>;

      // `upload_large` chunks the request body — required for big video files.
      // It is callback-based (it returns a stream, not a promise), so it has to
      // be promisified explicitly or the upload silently never happens.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploaded: any = isVideo
        ? await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_large(filePath, uploadOptions, (error, result) => {
              if (error || !result) return reject(error || new Error('Cloudinary returned an empty result'));
              resolve(result);
            });
          })
        : await cloudinary.uploader.upload(filePath, uploadOptions);

      if (!uploaded?.secure_url && !uploaded?.url) {
        throw new Error('Cloudinary response did not contain a URL');
      }

      if (!keepLocal) removeLocalFile(filePath);
      lastPing = { ok: true, at: new Date().toISOString() };

      const url: string = uploaded.secure_url || uploaded.url;
      return {
        url,
        publicId: uploaded.public_id,
        resourceType: uploaded.resource_type,
        storage: 'cloudinary',
        duration: typeof uploaded.duration === 'number' ? uploaded.duration : undefined,
        bytes: uploaded.bytes,
        format: uploaded.format,
        thumbnailUrl: uploaded.resource_type === 'video' ? cloudinaryVideoThumbnail(url) : url,
      };
    } catch (error) {
      const message =
        (error as { error?: { message?: string } }).error?.message || (error as Error).message || String(error);
      lastPing = { ok: false, at: new Date().toISOString(), error: message };
      if (cloudRequired) {
        console.error('[storage] Cloudinary upload failed — upload refused (local disk is not durable here):', message);
        removeLocalFile(filePath);
        throw new StorageError('cloud_storage_unavailable', UNAVAILABLE_MESSAGE, error);
      }
      console.error('Cloudinary upload error (falling back to local storage):', message);
    }
  } else if (cloudRequired) {
    console.error(
      '[storage] Upload refused: Cloudinary is not configured and the local disk on this host is wiped on every deploy.'
    );
    removeLocalFile(filePath);
    throw new StorageError('cloud_storage_not_configured', NOT_CONFIGURED_MESSAGE);
  }

  return { url: localUrlFor(filePath), storage: 'local' };
}

/**
 * Backwards-compatible helper used by the non-video controllers: returns just
 * the public URL of the stored file.
 */
export async function uploadToCloudinary(filePath: string, folder = 'vdo_bogura'): Promise<string> {
  const stored = await storeFile(filePath, { folder });
  return stored.url;
}

/** Delete a Cloudinary asset. Safe to call with an undefined id. */
export async function destroyCloudinaryAsset(
  publicId?: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<void> {
  if (!publicId || !ensureConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (error) {
    console.warn('Cloudinary destroy failed (ignored):', (error as Error).message);
  }
}

export { cloudinary };
