import { deleteAsset } from '../services/storage';

/**
 * Helpers for the "record stores a Cloudinary URL" model.
 *
 * Since the file is uploaded by /api/uploads/* before the form is submitted,
 * content endpoints only ever receive the asset reference (url + public_id)
 * inside a JSON body. These helpers keep that handling consistent — including
 * the cleanup of the asset that a replaced/removed picture used to point at.
 */

export interface AssetRef {
  url: string;
  publicId?: string;
  /** Cloudinary resource type, needed to destroy the asset later. */
  resourceType?: 'image' | 'video' | 'raw';
  bytes?: number;
  duration?: number;
  thumbnailUrl?: string;
  originalName?: string;
}

const MAX_URL_LENGTH = 2048;

/**
 * Only http(s) URLs are accepted, so a crafted `javascript:` / `file:` value can
 * never be rendered by the public site. Legacy `/uploads/...` paths from before
 * the Cloudinary migration keep working (they are still served read-only).
 */
export function sanitizeUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url) return '';
  if (url.length > MAX_URL_LENGTH) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/uploads\/[\w./-]+$/.test(url)) return url;
  return '';
}

function cleanPublicId(value: unknown): string | undefined {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 300) return undefined;
  // Cloudinary public ids and `amstorage/<id>` document references share one field.
  return /^[\w.:/-]+$/.test(id) ? id : undefined;
}

function cleanResourceType(value: unknown): AssetRef['resourceType'] {
  return value === 'image' || value === 'video' || value === 'raw' ? value : undefined;
}

/**
 * Read one asset reference from a request body.
 *
 * Accepts the compact object form (`{ image: { url, publicId } }`) and the flat
 * form the admin forms actually send (`image` + `imagePublicId`).
 */
export function readAsset(
  body: Record<string, unknown> | undefined,
  urlKey: string,
  publicIdKey = `${urlKey}PublicId`,
  fallbackResourceType?: AssetRef['resourceType']
): AssetRef | null {
  if (!body) return null;

  const nested = body[urlKey];
  if (nested && typeof nested === 'object') {
    const ref = nested as Record<string, unknown>;
    const url = sanitizeUrl(ref.url ?? ref.secure_url);
    if (!url) return null;
    return {
      url,
      publicId: cleanPublicId(ref.publicId),
      resourceType: cleanResourceType(ref.resourceType) || fallbackResourceType,
      bytes: typeof ref.bytes === 'number' ? ref.bytes : undefined,
      duration: typeof ref.duration === 'number' ? ref.duration : undefined,
      thumbnailUrl: sanitizeUrl(ref.thumbnailUrl) || undefined,
      originalName: typeof ref.originalName === 'string' ? ref.originalName.slice(0, 200) : undefined,
    };
  }

  const url = sanitizeUrl(body[urlKey]);
  if (!url) return null;
  return {
    url,
    publicId: cleanPublicId(body[publicIdKey]),
    resourceType: cleanResourceType(body[`${urlKey}ResourceType`]) || fallbackResourceType,
  };
}

/** A list of assets (the gallery sends the pictures of an album in one go). */
export function readAssetList(
  body: Record<string, unknown> | undefined,
  key: string,
  max: number
): AssetRef[] {
  const raw = body?.[key];
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? safeJsonArray(raw) : [];
  const assets: AssetRef[] = [];

  for (const item of list.slice(0, max)) {
    if (typeof item === 'string') {
      const url = sanitizeUrl(item);
      if (url) assets.push({ url });
      continue;
    }
    const extra = item as Record<string, unknown>;
    // A gallery entry is `{ url, publicId, resourceType, … }` — exactly what
    // /api/uploads/* handed the browser. Map it onto the flat `url` +
    // `urlPublicId` shape readAsset understands, otherwise the public id (and
    // with it the ability to delete the file later) would silently be lost.
    const ref = readAsset(
      {
        url: extra.url ?? extra.secure_url ?? extra.image ?? extra.thumbnail,
        urlPublicId: extra.publicId ?? extra.public_id ?? extra.imagePublicId ?? extra.thumbnailPublicId,
        urlResourceType: extra.resourceType,
      },
      'url'
    );
    if (ref) {
      assets.push({
        ...ref,
        resourceType: cleanResourceType(extra.resourceType) || ref.resourceType,
        bytes: typeof extra.bytes === 'number' ? extra.bytes : undefined,
        duration: typeof extra.duration === 'number' ? extra.duration : undefined,
        thumbnailUrl: sanitizeUrl(extra.thumbnailUrl) || undefined,
      });
    }
  }
  return assets;
}

function safeJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** `?isActive=false` used to arrive as a string through multipart — JSON now sends booleans. */
export function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
}

/** Free a stored asset (Cloudinary or AM Storage document) that is no longer referenced by any record. */
export async function releaseAsset(ref?: AssetRef | null, stillReferenced?: (url: string) => boolean) {
  if (!ref?.publicId) return;
  if (ref.url && stillReferenced?.(ref.url)) return;
  await deleteAsset(ref.publicId, ref.resourceType);
}
