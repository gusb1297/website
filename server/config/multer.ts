import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');
const subDirs = ['images', 'videos', 'pdfs', 'thumbnails'];

subDirs.forEach((dir) => {
  const fullPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'images';
    if (file.mimetype.startsWith('video/')) {
      folder = 'videos';
    } else if (file.mimetype === 'application/pdf') {
      folder = 'pdfs';
    } else if (req.path.includes('thumbnail')) {
      folder = 'thumbnails';
    }
    cb(null, path.join(uploadsDir, folder));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // The original base name is deliberately never used. Gallery uploads also
    // pass the strict MIME/extension filter below before reaching disk.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Videos are the biggest thing admins upload; Cloudinary chunks anything large
// on our side, so the ceiling here is generous.
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 512);

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-matroska',
      'video/x-msvideo',
      'video/mpeg',
      'video/ogg',
      'video/3gpp',
      'video/x-ms-wmv',
    ];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs and video files are allowed.'));
    }
  },
});

/**
 * Gallery uploads have a much smaller, image-only attack surface than the
 * general uploader above. Both the browser-reported MIME type and extension
 * must agree; the controller additionally verifies the file signature.
 */
const configuredGalleryImageMb = Number(process.env.MAX_IMAGE_UPLOAD_MB || 10);
export const MAX_GALLERY_IMAGE_MB = Number.isFinite(configuredGalleryImageMb)
  ? Math.max(1, configuredGalleryImageMb)
  : 10;
export const MAX_GALLERY_FILES = 20;

const galleryExtensions: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

export const galleryUpload = multer({
  storage,
  limits: {
    fileSize: MAX_GALLERY_IMAGE_MB * 1024 * 1024,
    // Album creation may contain one explicit cover plus twenty photos.
    files: MAX_GALLERY_FILES + 1,
    fields: 8,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const validExtensions = galleryExtensions[file.mimetype];
    if (!validExtensions || !validExtensions.includes(extension)) {
      const error = new Error(
        'invalid_image_type: Only JPG, JPEG, PNG, WEBP and GIF image files are allowed.'
      ) as Error & { status?: number };
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});
