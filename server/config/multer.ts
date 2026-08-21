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
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
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
  fileFilter: (req, file, cb) => {
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
