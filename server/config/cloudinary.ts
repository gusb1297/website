import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

let configured = false;

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
 * - Otherwise → the file stays inside `uploads/` and its local URL is returned.
 *
 * Never throws: a Cloudinary failure gracefully falls back to local storage so
 * an upload from the admin panel is never lost.
 */
export async function storeFile(
  filePath: string,
  options: { folder?: string; resourceType?: 'image' | 'video' | 'raw' | 'auto'; keepLocal?: boolean } = {}
): Promise<StoredFile> {
  const { folder = 'vdo_bogura', resourceType = 'auto', keepLocal = false } = options;

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
      console.error('Cloudinary upload error (falling back to local storage):', error);
    }
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
