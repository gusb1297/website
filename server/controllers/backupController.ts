import type { Request, Response } from 'express';
import multer from 'multer';
import { isDatabaseReady } from '../config/mongo';
import {
  createBackup,
  describeBackupStatus,
  getBackup,
  listBackups,
  normalizeSnapshot,
  removeBackup,
  restoreBackup,
  restoreContent,
} from '../services/backupService';
import { describeContentStatus } from '../services/contentStore';

/**
 * Admin API for the automatic content backups.
 *
 *   GET    /api/backups               list snapshots (newest first)
 *   POST   /api/backups               take a snapshot now
 *   GET    /api/backups/:id/download  download a snapshot as JSON
 *   POST   /api/backups/:id/restore   put the content back to that snapshot
 *   DELETE /api/backups/:id           delete one snapshot
 *   POST   /api/backups/upload        restore from a snapshot file (multipart)
 *
 * Restoring is deliberately destructive-first-safe: a `pre-restore` snapshot of
 * the current content is written before anything is overwritten, so a mistaken
 * restore can be undone by restoring the snapshot that was just created.
 */

const MAX_BACKUP_FILE_MB = 32;
const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BACKUP_FILE_MB * 1024 * 1024, files: 1 },
}).single('file');

function databaseUnavailable(res: Response): boolean {
  if (isDatabaseReady()) return false;
  res.status(503).json({
    error: 'database_unavailable',
    message: 'MongoDB-এ সংযোগ নেই, তাই ব্যাকআপ/রিস্টোর এই মুহূর্তে সম্ভব নয়।',
  });
  return true;
}

export async function listBackupsHandler(_req: Request, res: Response) {
  if (databaseUnavailable(res)) return;
  const backups = await listBackups();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    backups,
    status: { ...describeBackupStatus(), count: backups.length },
    content: describeContentStatus(),
  });
}

export async function createBackupHandler(req: Request, res: Response) {
  if (databaseUnavailable(res)) return;
  const summary = await createBackup('manual');
  res.status(201).json({ backup: summary, message: 'ব্যাকআপ তৈরি হয়েছে।' });
}

export async function downloadBackupHandler(req: Request, res: Response) {
  if (databaseUnavailable(res)) return;
  const snapshot = await getBackup(String(req.params.id));
  if (!snapshot) return res.status(404).json({ error: 'not_found', message: 'ব্যাকআপটি পাওয়া যায়নি।' });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gusb-backup-${String(req.params.id)}.json"`);
  res.send(JSON.stringify(snapshot, null, 2));
}

export async function restoreBackupHandler(req: Request, res: Response) {
  if (databaseUnavailable(res)) return;
  const result = await restoreBackup(String(req.params.id));
  res.json({
    message: 'ব্যাকআপ থেকে কন্টেন্ট পুনরুদ্ধার করা হয়েছে।',
    counts: result.counts,
    safetyBackup: result.safetyBackup,
  });
}

export async function deleteBackupHandler(req: Request, res: Response) {
  if (databaseUnavailable(res)) return;
  const removed = await removeBackup(String(req.params.id));
  if (!removed) return res.status(404).json({ error: 'not_found', message: 'ব্যাকআপটি পাওয়া যায়নি।' });
  res.json({ message: 'ব্যাকআপ মুছে ফেলা হয়েছে।' });
}

/** Restore from a file the admin downloaded earlier (or from another site). */
export function restoreUploadedHandler(req: Request, res: Response) {
  if (databaseUnavailable(res)) return;
  uploadBackup(req, res, (err: unknown) => {
    void (async () => {
      if (err) {
        const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? `ব্যাকআপ ফাইলটি ${MAX_BACKUP_FILE_MB} MB-এর চেয়ে বড়।`
          : 'ব্যাকআপ ফাইলটি পড়া যায়নি।';
        return res.status(400).json({ error: 'invalid_backup_file', message });
      }
      try {
        const raw = req.file?.buffer?.toString('utf8') || '';
        if (!raw) {
          return res.status(400).json({ error: 'empty_file', message: 'কোনো ফাইল পাওয়া যায়নি।' });
        }
        const parsed = JSON.parse(raw) as unknown;
        const snapshot = normalizeSnapshot(parsed);
        if (!snapshot) {
          return res.status(400).json({
            error: 'invalid_backup',
            message: 'এটি একটি বৈধ GUSB ব্যাকআপ ফাইল নয় (heroSlides/news/programs কোনো তালিকাই পাওয়া যায়নি)।',
          });
        }
        const result = await restoreContent(snapshot, `uploaded file "${req.file?.originalname || 'backup.json'}"`);
        res.json({ message: 'ফাইল থেকে কন্টেন্ট পুনরুদ্ধার করা হয়েছে।', counts: result.counts, safetyBackup: result.safetyBackup });
      } catch (error) {
        const message = (error as Error).message || '';
        if (message.includes('JSON')) {
          return res.status(400).json({ error: 'invalid_json', message: 'ফাইলটি সঠিক JSON নয়।' });
        }
        // eslint-disable-next-line no-console
        console.error('[backup] restore from upload failed:', error);
        res.status(500).json({ error: 'restore_failed', message: message || 'রিস্টোর করা যায়নি।' });
      }
    })();
  });
}
