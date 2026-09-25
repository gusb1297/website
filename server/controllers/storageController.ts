/**
 * Storage / persistence status — the data behind the admin "স্টোরেজ সতর্কতা" banner.
 *
 *   GET /api/health                  public, no credential details
 *   GET /api/storage/status          signed-in panel users: + which variables were
 *                                    used, masked API key, auto-corrections, and the
 *                                    cloud names that saved images point at
 *   GET /api/storage/status?verify=1 same, after a fresh Cloudinary check ("আবার যাচাই")
 *
 * Both endpoints also nudge a self-heal: a Cloudinary failure that is a few
 * minutes old is re-checked in the background, and a failed MongoDB save is
 * retried, so the banner does not stay red after the problem went away.
 */
import type { Request, Response } from 'express';
import { describeMongoStatus, isDatabaseReady } from '../config/mongo';
import { describePersistenceStatus, healPersistence } from '../config/persistence';
import { describeBackupStatus, listBackups } from '../services/backupService';
import { memoryStore } from '../models/schemas';
import {
  describeStorageCredentials,
  describeStorageStatus,
  forceStorageCheck,
  refreshStorageStatusIfStale,
} from '../services/storage';

/**
 * `backupCount` costs one database read, so it is only filled for the
 * signed-in admin endpoint — /api/health stays a cheap public probe.
 */
/**
 * Pictures / documents whose URL still points at the server's own `/uploads`
 * folder. Those files were written by a version of this app that stored uploads
 * on the container disk, so they are gone for good on any host that wipes it —
 * the only fix is to upload them again (they then live on Cloudinary / AM
 * Storage). Counting them turns "some images never load and nobody knows why"
 * into a number the admin can act on.
 */
function legacyLocalAssetCount(): number {
  let text = '';
  try {
    text = JSON.stringify(memoryStore);
  } catch {
    return 0;
  }
  return (text.match(/"\/uploads\//g) || []).length;
}

function statusPayload(backupCount?: number) {
  const mongo = describeMongoStatus();
  const storage = describeStorageStatus();
  const content = describePersistenceStatus();
  const backup = { ...describeBackupStatus(), count: backupCount ?? null };
  return {
    status: 'ok' as const,
    time: new Date().toISOString(),
    mongo: { configured: mongo.configured, connected: mongo.connected, state: mongo.state },
    storage: {
      provider: storage.provider,
      configured: storage.configured,
      state: storage.state,
      checking: storage.checking,
      durable: storage.durable,
      cloudName: storage.cloudName,
      folder: storage.folder,
      lastCheck: storage.lastCheck,
      missing: storage.missing,
      hint: storage.hint,
      documents: storage.documents,
    },
    content: {
      source: content.source,
      durable: content.durable,
      loaded: content.loaded,
      counts: content.counts,
      totalItems: content.totalItems,
      pendingWrites: content.pendingWrites,
      lastSavedAt: content.lastSavedAt,
      lastLoadedAt: content.lastLoadedAt,
      /** Assets still pointing at the deleted local /uploads folder. */
      legacyLocalAssets: legacyLocalAssetCount(),
      hint: content.hint,
    },
    backup,
  };
}

/**
 * Cloud names that the saved content's image/video URLs point at, most used
 * first. If the configured CLOUDINARY_CLOUD_NAME is not among them, the site
 * is showing pictures from one Cloudinary account while uploading to another.
 */
function cloudsUsedByContent(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  let text = '';
  try {
    text = JSON.stringify(memoryStore);
  } catch {
    return [];
  }
  for (const match of text.matchAll(/res\.cloudinary\.com\/([A-Za-z0-9_-]+)\//g)) {
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

export function getHealth(_req: Request, res: Response) {
  refreshStorageStatusIfStale();
  healPersistence();
  res.setHeader('Cache-Control', 'no-store');
  res.json(statusPayload());
}

export async function getStorageStatus(req: Request, res: Response) {
  const verify = req.query.verify === '1' || req.query.verify === 'true';
  healPersistence();
  if (verify) {
    await forceStorageCheck();
  } else {
    refreshStorageStatusIfStale();
  }
  const backupCount = isDatabaseReady() ? (await listBackups(500)).length : null;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ...statusPayload(backupCount ?? undefined),
    diagnostics: {
      cloudinary: describeStorageCredentials(),
      contentClouds: cloudsUsedByContent(),
    },
  });
}
