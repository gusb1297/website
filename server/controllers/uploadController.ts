import { Request, Response } from 'express';
import { deleteAsset, StoredAsset } from '../services/storage';

/**
 * Upload endpoints used by every admin form (and the public CV form).
 *
 * The client sends one file at a time and gets the finished Cloudinary asset
 * back, so the picker can show progress and a notification the moment a file is
 * chosen — the entity record itself is saved afterwards as plain JSON.
 *
 * `receiveUpload()` (server/middleware/upload.ts) has already pushed the bytes
 * to Cloudinary and removed the staging copy by the time we get here.
 */
export const respondWithAsset = (req: Request, res: Response) => {
  const asset: StoredAsset | undefined = req.uploadedAsset;
  if (!asset) {
    return res.status(500).json({ error: 'upload_failed', message: 'ফাইলটি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।' });
  }
  return res.status(201).json(asset);
};

/**
 * Remove an asset the admin uploaded and then discarded (e.g. removed the photo
 * before saving the form) so the Cloudinary library does not fill up with
 * orphaned files.
 */
export async function discardAsset(req: Request, res: Response) {
  const publicId = String(req.body?.publicId || '').trim();
  const rawType = String(req.body?.resourceType || '');
  const resourceType = rawType === 'image' || rawType === 'video' || rawType === 'raw' ? rawType : undefined;

  if (!publicId) return res.status(400).json({ error: 'missing_public_id', message: 'কোনো ফাইল উল্লেখ করা হয়নি।' });

  // No (or an unknown) type simply means: look it up across all resource types.
  await deleteAsset(publicId, resourceType);
  res.json({ message: 'ফাইলটি সরানো হয়েছে।' });
}
