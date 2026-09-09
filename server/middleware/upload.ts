import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { putFile, StoredAsset, UploadKind } from '../services/storage';

/**
 * Upload transport — the only place that touches the file system, and only for
 * a few seconds. Files are received into the OS temp directory (never into the
 * project's ./uploads folder), streamed to the cloud by `putFile` (Cloudinary
 * for images/videos, the AM Storage gateway for PDFs & other documents), and
 * the staging copy is deleted immediately afterwards.
 */
const STAGING_DIR = path.join(os.tmpdir(), 'gusb-upload-staging');
fs.mkdirSync(STAGING_DIR, { recursive: true });

const MB = 1024 * 1024;

function limitMb(name: string, fallback: number): number {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : fallback;
}

/**
 * Per-kind ceilings in MB.
 *
 * Computed on every request on purpose: this module is evaluated before dotenv
 * has run, so constants here would freeze the defaults and ignore .env.
 */
export function uploadLimits(): Record<UploadKind, number> {
  return {
    image: limitMb('MAX_IMAGE_UPLOAD_MB', 10),
    // MAX_UPLOAD_MB is the historical name of the video ceiling; both work.
    video: limitMb('MAX_VIDEO_UPLOAD_MB', limitMb('MAX_UPLOAD_MB', 512)),
    document: limitMb('MAX_DOCUMENT_UPLOAD_MB', 25),
  };
}

/** Public job-application CVs get a much tighter ceiling. */
function applicationDocLimitMb(): number {
  return limitMb('MAX_APPLICATION_UPLOAD_MB', 5);
}

interface KindRules {
  mimes: string[];
  extensions: string[];
  /** Error text the admin sees when the file type is not accepted. */
  hint: string;
}

const IMAGE_RULES: KindRules = {
  mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'],
  hint: 'শুধু JPG, JPEG, PNG, WEBP, AVIF বা GIF ছবি আপলোড করা যাবে।',
};

const LOGO_RULES: KindRules = {
  mimes: [...IMAGE_RULES.mimes, 'image/x-icon', 'image/vnd.microsoft.icon'],
  extensions: [...IMAGE_RULES.extensions, 'ico'],
  hint: 'লোগো হিসেবে JPG, PNG, WEBP, SVG বা ICO ফাইল দিন।',
};

const VIDEO_RULES: KindRules = {
  mimes: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'video/x-msvideo',
    'video/mpeg',
    'video/ogg',
    'video/3gpp',
    'video/x-ms-wmv',
    'video/x-m4v',
  ],
  extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mpeg', 'mpg', 'ogv', '3gp', 'wmv', 'm4v'],
  hint: 'ভিডিও হিসেবে MP4, WebM, MOV, MKV, AVI বা MPEG ফাইল দিন।',
};

const DOCUMENT_RULES: KindRules = {
  mimes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  extensions: ['pdf', 'doc', 'docx', 'txt'],
  hint: 'নথি হিসেবে PDF, DOC, DOCX বা TXT ফাইল দিন।',
};

const CV_RULES: KindRules = {
  mimes: DOCUMENT_RULES.mimes,
  extensions: DOCUMENT_RULES.extensions,
  hint: 'সিভি হিসেবে PDF, DOC বা DOCX ফাইল দিন।',
};

export type UploadProfile = UploadKind | 'logo' | 'cv';

function rulesFor(profile: UploadProfile): KindRules {
  switch (profile) {
    case 'logo':
      return LOGO_RULES;
    case 'cv':
      return CV_RULES;
    default:
      return profile === 'image' ? IMAGE_RULES : profile === 'video' ? VIDEO_RULES : DOCUMENT_RULES;
  }
}

function maxMbFor(profile: UploadProfile): number {
  if (profile === 'cv') return applicationDocLimitMb();
  return uploadLimits()[profile];
}

function kindFor(profile: UploadProfile): UploadKind {
  if (profile === 'logo') return 'image';
  if (profile === 'cv') return 'document';
  return profile;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, STAGING_DIR),
  filename: (_req, file, cb) => {
    // Never reuse the browser-supplied name on disk: it can contain paths.
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

class UploadRequestError extends Error {
  status = 400;
  /** Machine-readable reason, sent to the browser as `error`. */
  code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'UploadRequestError';
    this.code = code;
  }
}

/**
 * Multer middleware + immediate Cloudinary push.
 *
 * `folder` is taken from the query string (`?folder=gallery`) so it is known
 * before the multipart body is parsed, and is whitelisted to [a-z0-9/_-].
 * On success `req.uploadedAsset` holds the Cloudinary result.
 */
/**
 * The env-driven ceiling can only be read once dotenv has run, and the router
 * is built before that happens — so the multer instance is created per profile
 * on the first request (and rebuilt if the configured limit ever changes).
 */
interface BuiltUploader {
  limitMb: number;
  handler: RequestHandler;
}
const uploaders = new Map<UploadProfile, BuiltUploader>();

function uploaderFor(profile: UploadProfile): BuiltUploader {
  const rules = rulesFor(profile);
  const limit = maxMbFor(profile);
  const cached = uploaders.get(profile);
  if (cached && cached.limitMb === limit) return cached;

  const built: BuiltUploader = {
    limitMb: limit,
    handler: multer({
      storage,
      limits: { fileSize: limit * MB, files: 1, fields: 4 },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').replace('.', '').toLowerCase();
        if (!rules.mimes.includes(file.mimetype) && !rules.extensions.includes(ext)) {
          return cb(new UploadRequestError('invalid_file_type', rules.hint));
        }
        cb(null, true);
      },
    }).single('file'),
  };
  uploaders.set(profile, built);
  return built;
}

/** Current ceilings in MB — the admin UI reads these so its hints match the server. */
export function limitsForClient() {
  const limits = uploadLimits();
  return {
    image: limits.image,
    logo: limits.image,
    video: limits.video,
    document: limits.document,
    cv: applicationDocLimitMb(),
  };
}

export function receiveUpload(profile: UploadProfile): RequestHandler[] {
  const kind = kindFor(profile);

  const push: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      if (!req.file) {
        return next(new UploadRequestError('no_file', 'আপলোড করার জন্য কোনো ফাইল পাওয়া যায়নি।'));
      }
      try {
        const rawFolder = String(req.query.folder || req.body?.folder || '');
        const folder = rawFolder.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 60) || profile;
        const rawTitle = typeof req.body?.title === 'string' ? req.body.title : '';
        req.uploadedAsset = await putFile(req.file.path, {
          kind,
          folder,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          // Documents carry a human title into the AM Storage record.
          title: rawTitle.trim().slice(0, 200) || undefined,
        });
        next();
      } catch (err) {
        next(err);
      }
    })();
  };

  return [
    (req, res, next) => {
      uploaderFor(profile).handler(req, res, (err?: unknown) => {
        if (err) {
          removeStaged(req);
          return next(err);
        }
        next();
      });
    },
    push,
  ];
}

/** Delete a staging file that is still around (rejected / abandoned request). */
export function removeStaged(req: Request): void {
  const file = req.file || (req.files ? (Object.values(req.files as Record<string, Express.Multer.File[]>).flat()[0] as Express.Multer.File) : undefined);
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Cloudinary result of `receiveUpload`, present on /api/uploads routes. */
      uploadedAsset?: StoredAsset;
    }
  }
}

/**
 * Entity endpoints now receive JSON only (the file has already been uploaded).
 * A browser tab that still runs the previous bundle would silently send an
 * empty multipart body and wipe the record — so answer it with a clear
 * "reload the page" instruction instead.
 */
export const rejectMultipart: RequestHandler = (req, res, next) => {
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (type.includes('multipart/form-data')) {
    return res.status(415).json({
      error: 'stale_client',
      message:
        'আপনার ব্রাউজারে পুরোনো সংস্করণ খুলে আছে। একবার পৃষ্ঠাটি হার্ড রিলোড করুন (Ctrl + Shift + R / Mac: Cmd + Shift + R), তারপর আবার চেষ্টা করুন।',
    });
  }
  next();
};
