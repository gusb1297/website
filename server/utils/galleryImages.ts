import fs from 'fs';
import path from 'path';
import { Express } from 'express';
import { destroyCloudinaryAsset, StoredFile, storeFile } from '../config/cloudinary';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/** Flatten files produced by multer.fields() without trusting field names. */
export function uploadedFiles(reqFiles: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined) {
  if (!reqFiles) return [];
  return Array.isArray(reqFiles) ? reqFiles : Object.values(reqFiles).flat();
}

/**
 * Verify the bytes, not only multipart headers. This blocks renamed scripts or
 * documents whose extension and browser-provided MIME claim to be an image.
 */
export function hasValidImageSignature(file: Express.Multer.File): boolean {
  let header: Buffer;
  try {
    const descriptor = fs.openSync(file.path, 'r');
    try {
      header = Buffer.alloc(16);
      fs.readSync(descriptor, header, 0, header.length, 0);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    return false;
  }

  switch (file.mimetype) {
    case 'image/jpeg':
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case 'image/png':
      return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'image/gif': {
      const signature = header.subarray(0, 6).toString('ascii');
      return signature === 'GIF87a' || signature === 'GIF89a';
    }
    default:
      return false;
  }
}

/** Remove multer temporary/local files after a rejected request. */
export function removeUploadedFiles(files: Express.Multer.File[]): void {
  files.forEach((file) => {
    try {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (error) {
      console.warn('[gallery] Could not clean rejected upload:', (error as Error).message);
    }
  });
}

export async function storeGalleryImage(file: Express.Multer.File): Promise<StoredFile> {
  return storeFile(file.path, { folder: 'vdo_bogura/gallery', resourceType: 'image' });
}

/**
 * Remove a stored gallery asset. New Cloudinary records carry their public id;
 * local URLs are resolved only inside uploads/ to prevent path traversal.
 */
export async function removeGalleryImage(asset: {
  image?: string;
  publicId?: string;
  storage?: 'cloudinary' | 'local';
}): Promise<void> {
  if (asset.storage === 'cloudinary' && asset.publicId) {
    await destroyCloudinaryAsset(asset.publicId, 'image');
    return;
  }

  const url = asset.image || '';
  if (asset.storage === 'cloudinary' || !url.startsWith('/uploads/')) return;

  const relative = url.replace(/^\/uploads\//, '').split('?')[0];
  const absolute = path.resolve(UPLOADS_ROOT, relative);
  if (absolute !== UPLOADS_ROOT && !absolute.startsWith(`${UPLOADS_ROOT}${path.sep}`)) return;

  try {
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (error) {
    console.warn('[gallery] Could not delete local image:', (error as Error).message);
  }
}
