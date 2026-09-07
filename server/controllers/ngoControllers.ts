import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { processVideoFile, probeVideoDuration } from '../config/ffmpeg';
import { uploadToCloudinary, storeFile, destroyCloudinaryAsset } from '../config/cloudinary';
import { MAX_GALLERY_FILES } from '../config/multer';
import { parseVideoLink, formatDuration } from '../utils/videoSources';
import {
  hasValidImageSignature,
  removeGalleryImage,
  removeUploadedFiles,
  storeGalleryImage,
  uploadedFiles,
} from '../utils/galleryImages';
import { persistStore } from '../config/persistence';
import { getJwtSecret } from '../config/env';
import { AdminServiceError, getAuthStatus, setupFirstAdmin, verifyCredentials } from '../services/adminService';
import { AuthRequest } from '../middleware/auth';
import { memoryStore, DEFAULT_THEME } from '../models/schemas';
import {
  HeroSlide,
  Program,
  NewsItem,
  VideoItem,
  Notice,
  Publication,
  GalleryAlbum,
  GalleryPhoto,
  CommitteeMember,
  Partner,
  CareerCircular,
  Application,
  StatItem,
  SiteSettings,
  PageContent,
} from '../../src/types';

/** 400 response helper for missing required fields. */
const requireFields = (
  res: Response,
  fields: Record<string, unknown>
): boolean => {
  const missing = Object.entries(fields)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([key]) => key);
  if (missing.length) {
    res.status(400).json({
      error: 'missing_fields',
      fields: missing,
      message: `আবশ্যক তথ্য দেওয়া হয়নি: ${missing.join(', ')}`,
    });
    return false;
  }
  return true;
};

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Direct File Upload (returns uploaded URL directly)
export const uploadDirectFile = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const url = await uploadToCloudinary(req.file.path, 'vdo_bogura');
    return res.json({ url });
  } catch (err: unknown) {
    console.error('Direct file upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
};

// 1. AUTH CONTROLLER
export const authStatus = async (_req: Request, res: Response) => {
  try {
    res.json(await getAuthStatus());
  } catch (err) {
    console.error('[auth] Status error:', err);
    res.status(500).json({ error: 'server_error', message: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

export const setupAdmin = async (req: Request, res: Response) => {
  try {
    const admin = await setupFirstAdmin(req.body || {});
    return res.status(201).json({
      message: 'প্রথম অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে। এখন লগইন করুন।',
      user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    if (err instanceof AdminServiceError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('[auth] Setup error:', err);
    return res.status(500).json({ error: 'server_error', message: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'missing_fields', message: 'ইমেইল ও পাসওয়ার্ড দুটোই দিতে হবে।' });
  }

  try {
    // Credentials are checked against the admins collection in MongoDB.
    // There are no built-in or demo accounts.
    const admin = await verifyCredentials(email, password);
    if (!admin) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'অবৈধ ইমেইল অথবা পাসওয়ার্ড' });
    }

    const payload = { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
    return res.json({ token, user: payload });
  } catch (err) {
    if (err instanceof AdminServiceError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('[auth] Login error:', err);
    return res.status(500).json({ error: 'server_error', message: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (req.user) {
    return res.json({ user: req.user });
  }
  return res.status(401).json({ error: 'Not authenticated' });
};

// 2. HERO SLIDES
export const getHeroSlides = (req: Request, res: Response) => {
  const isAdminView = req.query.all === 'true';
  const slides = memoryStore.heroSlides
    .filter((s) => isAdminView || s.isActive)
    .sort((a, b) => a.order - b.order);
  res.json(slides);
};

export const createHeroSlide = async (req: Request, res: Response) => {
  let imagePath = req.body.image;
  if (req.file) {
    imagePath = await uploadToCloudinary(req.file.path, 'vdo_bogura/hero');
  }
  if (!requireFields(res, { image: imagePath, headline: req.body.headline, subtext: req.body.subtext })) return;

  const newSlide: HeroSlide = {
    id: 'hs-' + Date.now(),
    image: imagePath,
    headline: req.body.headline,
    subtext: req.body.subtext,
    buttonText: req.body.buttonText,
    buttonLink: req.body.buttonLink,
    order: memoryStore.heroSlides.length + 1,
    isActive: req.body.isActive !== 'false',
  };
  memoryStore.heroSlides.push(newSlide);
  persistStore();
  res.status(201).json(newSlide);
};

export const updateHeroSlide = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.heroSlides.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Slide not found' });

  if (req.file) {
    req.body.image = await uploadToCloudinary(req.file.path, 'vdo_bogura/hero');
  }

  memoryStore.heroSlides[index] = {
    ...memoryStore.heroSlides[index],
    ...req.body,
    id,
    order: Number(req.body.order ?? memoryStore.heroSlides[index].order),
    isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : memoryStore.heroSlides[index].isActive,
  };
  persistStore();
  res.json(memoryStore.heroSlides[index]);
};

export const reorderHeroSlides = (req: Request, res: Response) => {
  const { slideIds } = req.body;
  if (Array.isArray(slideIds)) {
    slideIds.forEach((id: string, idx: number) => {
      const item = memoryStore.heroSlides.find((s) => s.id === id);
      if (item) item.order = idx + 1;
    });
  }
  memoryStore.heroSlides.sort((a, b) => a.order - b.order);
  persistStore();
  res.json(memoryStore.heroSlides);
};

export const deleteHeroSlide = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.heroSlides = memoryStore.heroSlides.filter((s) => s.id !== id);
  persistStore();
  res.json({ message: 'Slide deleted' });
};

// 3. PROGRAMS
export const getPrograms = (req: Request, res: Response) => {
  const programs = [...memoryStore.programs].sort((a, b) => a.order - b.order);
  res.json(programs);
};

export const getProgramBySlug = (req: Request, res: Response) => {
  const { slug } = req.params;
  const program = memoryStore.programs.find((p) => p.slug === slug || p.id === slug);
  if (!program) return res.status(404).json({ error: 'Program not found' });
  res.json(program);
};

export const createProgram = async (req: Request, res: Response) => {
  let coverImage = req.body.coverImage;
  if (req.file) {
    coverImage = await uploadToCloudinary(req.file.path, 'vdo_bogura/programs');
  }
  if (!requireFields(res, { title: req.body.title, shortDesc: req.body.shortDesc, content: req.body.content, coverImage })) return;

  const slug = slugify(req.body.slug || req.body.title || '') || 'program-' + Date.now();
  const newProgram: Program = {
    id: 'prg-' + Date.now(),
    title: req.body.title,
    slug,
    icon: req.body.icon || 'Sprout',
    shortDesc: req.body.shortDesc,
    content: req.body.content,
    coverImage,
    status: req.body.status || 'ongoing',
    order: memoryStore.programs.length + 1,
    beneficiariesCount: Number(req.body.beneficiariesCount || 0),
    districtsCovered: Number(req.body.districtsCovered || 0),
  };
  memoryStore.programs.push(newProgram);
  persistStore();
  res.status(201).json(newProgram);
};

export const updateProgram = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.programs.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Program not found' });

  if (req.file) {
    req.body.coverImage = await uploadToCloudinary(req.file.path, 'vdo_bogura/programs');
  }

  memoryStore.programs[index] = {
    ...memoryStore.programs[index],
    ...req.body,
    id,
  };
  persistStore();
  res.json(memoryStore.programs[index]);
};

export const deleteProgram = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.programs = memoryStore.programs.filter((p) => p.id !== id);
  persistStore();
  res.json({ message: 'Program deleted' });
};

// 4. NEWS & EVENTS
export const getNews = (req: Request, res: Response) => {
  const { category, search } = req.query;
  let list = [...memoryStore.news];

  if (category) {
    list = list.filter((n) => n.category === category);
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }

  list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  res.json(list);
};

export const getNewsBySlug = (req: Request, res: Response) => {
  const { slug } = req.params;
  const news = memoryStore.news.find((n) => n.slug === slug || n.id === slug);
  if (!news) return res.status(404).json({ error: 'News article not found' });
  news.views += 1;
  persistStore();
  res.json(news);
};

export const createNews = async (req: Request, res: Response) => {
  let thumbnail = req.body.thumbnail;
  if (req.file) {
    thumbnail = await uploadToCloudinary(req.file.path, 'vdo_bogura/news');
  }
  if (!requireFields(res, { title: req.body.title, content: req.body.content, thumbnail })) return;

  const slug = slugify(req.body.slug || req.body.title || '') || 'news-' + Date.now();
  const newNews: NewsItem = {
    id: 'news-' + Date.now(),
    title: req.body.title,
    slug,
    category: req.body.category || 'News',
    thumbnail,
    content: req.body.content,
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    views: 0,
    author: req.body.author || '',
  };
  memoryStore.news.unshift(newNews);
  persistStore();
  res.status(201).json(newNews);
};

export const updateNews = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.news.findIndex((n) => n.id === id);
  if (index === -1) return res.status(404).json({ error: 'News item not found' });

  if (req.file) {
    req.body.thumbnail = await uploadToCloudinary(req.file.path, 'vdo_bogura/news');
  }

  memoryStore.news[index] = {
    ...memoryStore.news[index],
    ...req.body,
    id,
  };
  persistStore();
  res.json(memoryStore.news[index]);
};

export const deleteNews = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.news = memoryStore.news.filter((n) => n.id !== id);
  persistStore();
  res.json({ message: 'News item deleted' });
};

// 5. VIDEO MANAGEMENT & STREAMING
export const getVideos = (req: Request, res: Response) => {
  const list = [...memoryStore.videos].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  res.json(list);
};

type MulterFiles = Record<string, Express.Multer.File[]> | undefined;

/** Pull the first matching file out of an `upload.fields()` request. */
const pickFile = (req: Request, names: string[]): Express.Multer.File | undefined => {
  const files = req.files as MulterFiles;
  if (files) {
    for (const name of names) {
      const match = files[name]?.[0];
      if (match) return match;
    }
  }
  return (req.file && names.includes(req.file.fieldname) ? req.file : undefined) || undefined;
};

/** No stock imagery: when no poster can be derived the player renders its own placeholder. */
const DEFAULT_VIDEO_THUMB = '';

/**
 * Build a video record from an uploaded device file.
 * Cloudinary is used whenever it is configured (chunked upload for big files,
 * auto poster frame); otherwise the file is kept on local disk and streamed
 * through /api/videos/stream/:id.
 */
async function buildUploadedVideo(
  file: Express.Multer.File,
  body: Record<string, string | undefined>,
  thumbnailFile?: Express.Multer.File
): Promise<VideoItem> {
  // Read the real duration while the file is still on local disk.
  let durationSeconds = await probeVideoDuration(file.path);

  const stored = await storeFile(file.path, {
    folder: 'vdo_bogura/videos',
    resourceType: 'video',
  });

  let thumbnail: string;
  if (stored.storage === 'cloudinary') {
    // Cloudinary derives the poster frame itself — no ffmpeg needed.
    durationSeconds = stored.duration ?? durationSeconds;
    thumbnail = stored.thumbnailUrl || DEFAULT_VIDEO_THUMB;
  } else {
    // Local disk: generate a poster frame with ffmpeg (falls back to a
    // placeholder when ffmpeg is not installed on the host).
    const processed = await processVideoFile(file.path);
    thumbnail = processed.thumbnailPath;
    durationSeconds = durationSeconds ?? processed.durationSeconds;
  }

  // Admin supplied a custom poster image → store it too and prefer it.
  if (thumbnailFile) {
    const storedThumb = await storeFile(thumbnailFile.path, { folder: 'vdo_bogura/thumbnails' });
    thumbnail = storedThumb.url;
  }

  return {
    id: 'vid-' + Date.now(),
    title: body.title?.trim() || file.originalname,
    type: 'upload',
    filePath: stored.url,
    publicId: stored.publicId,
    storage: stored.storage,
    thumbnail,
    duration: formatDuration(durationSeconds) || '00:00',
    durationSeconds,
    sizeBytes: stored.bytes ?? file.size,
    uploadedAt: new Date().toISOString(),
    category: body.category?.trim() || 'General',
    description: body.description?.trim() || undefined,
  };
}

/** Build a video record from a pasted YouTube / Vimeo / direct link. */
function buildEmbeddedVideo(body: Record<string, string | undefined>, thumbnailUrl?: string): VideoItem | null {
  const rawUrl = (body.embedUrl || body.youtubeUrl || body.url || '').trim();
  const parsed = parseVideoLink(rawUrl);
  if (!parsed) return null;

  return {
    id: 'vid-' + Date.now(),
    title: body.title?.trim() || 'ভিডিও',
    type: 'embed',
    provider: parsed.provider,
    providerId: parsed.videoId,
    embedUrl: parsed.embedUrl,
    watchUrl: parsed.watchUrl,
    thumbnail: thumbnailUrl || body.thumbnail?.trim() || parsed.thumbnail || DEFAULT_VIDEO_THUMB,
    duration: body.duration?.trim() || undefined,
    uploadedAt: new Date().toISOString(),
    category: body.category?.trim() || 'Highlight',
    description: body.description?.trim() || undefined,
  };
}

/**
 * Unified two-way video endpoint (POST /api/videos).
 *
 * 1. **Device upload** – send `videoFile` (or `video`) as multipart/form-data;
 *    the file goes to Cloudinary when configured, local disk otherwise.
 * 2. **YouTube / Vimeo link** – send `embedUrl` (or `youtubeUrl`); any YouTube
 *    URL shape is normalised to a real embed URL with an auto thumbnail.
 *
 * The mode can be forced with `type=upload|embed`, otherwise it is detected
 * from what was actually sent.
 */
export const createVideo = async (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, string | undefined>;
  const videoFile = pickFile(req, ['videoFile', 'video', 'file']);
  const thumbnailFile = pickFile(req, ['thumbnail', 'thumbnailFile', 'poster']);
  const linkValue = (body.embedUrl || body.youtubeUrl || body.url || '').trim();
  const requestedType = body.type === 'upload' || body.type === 'embed' ? body.type : undefined;
  const mode = requestedType || (videoFile ? 'upload' : linkValue ? 'embed' : undefined);

  try {
    if (mode === 'upload') {
      if (!videoFile) {
        return res.status(400).json({ error: 'অনুগ্রহ করে একটি ভিডিও ফাইল নির্বাচন করুন (videoFile)' });
      }
      const newVid = await buildUploadedVideo(videoFile, body, thumbnailFile);
      memoryStore.videos.unshift(newVid);
      persistStore();
      return res.status(201).json(newVid);
    }

    if (mode === 'embed') {
      let customThumb: string | undefined;
      if (thumbnailFile) {
        const storedThumb = await storeFile(thumbnailFile.path, { folder: 'vdo_bogura/thumbnails' });
        customThumb = storedThumb.url;
      }
      const newVid = buildEmbeddedVideo(body, customThumb);
      if (!newVid) {
        return res.status(400).json({ error: 'সঠিক ইউটিউব/ভিমিও লিঙ্ক দিন (Invalid video link)' });
      }
      if (!body.title?.trim()) {
        return res.status(400).json({ error: 'ভিডিও শিরোনাম আবশ্যক (Title is required)' });
      }
      memoryStore.videos.unshift(newVid);
      persistStore();
      return res.status(201).json(newVid);
    }

    return res.status(400).json({
      error: 'ভিডিও ফাইল অথবা ইউটিউব লিঙ্ক দিন (send either a videoFile or an embedUrl)',
    });
  } catch (err) {
    console.error('Video create error:', err);
    return res.status(500).json({ error: 'ভিডিও সংরক্ষণ করা যায়নি (Failed to save video)' });
  }
};

/** Legacy endpoint kept for older admin builds: POST /api/videos/upload. */
export const uploadVideo = async (req: Request, res: Response) => {
  const file = pickFile(req, ['video', 'videoFile', 'file']);
  if (!file) {
    return res.status(400).json({ error: 'Please upload a video file' });
  }
  try {
    const newVid = await buildUploadedVideo(file, (req.body || {}) as Record<string, string>, pickFile(req, ['thumbnail']));
    memoryStore.videos.unshift(newVid);
    persistStore();
    return res.status(201).json(newVid);
  } catch (err) {
    console.error('Video upload error:', err);
    return res.status(500).json({ error: 'Failed to upload video' });
  }
};

/** Legacy endpoint kept for older admin builds: POST /api/videos/embed. */
export const embedVideo = (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, string | undefined>;
  if (!body.title || !(body.embedUrl || body.youtubeUrl || body.url)) {
    return res.status(400).json({ error: 'Title and Embed URL are required' });
  }
  const newVid = buildEmbeddedVideo(body);
  if (!newVid) {
    return res.status(400).json({ error: 'Invalid video link' });
  }
  memoryStore.videos.unshift(newVid);
  persistStore();
  res.status(201).json(newVid);
};

/** Update the editable metadata of a video (title / category / link / poster). */
export const updateVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = memoryStore.videos.find((v) => v.id === id);
  if (!existing) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const body = (req.body || {}) as Record<string, string | undefined>;
  if (body.title?.trim()) existing.title = body.title.trim();
  if (body.category?.trim()) existing.category = body.category.trim();
  if (body.description !== undefined) existing.description = body.description.trim() || undefined;

  const link = (body.embedUrl || body.youtubeUrl || body.url || '').trim();
  if (existing.type === 'embed' && link) {
    const parsed = parseVideoLink(link);
    if (!parsed) return res.status(400).json({ error: 'Invalid video link' });
    existing.embedUrl = parsed.embedUrl;
    existing.watchUrl = parsed.watchUrl;
    existing.provider = parsed.provider;
    existing.providerId = parsed.videoId;
    if (parsed.thumbnail && !body.thumbnail) existing.thumbnail = parsed.thumbnail;
  }

  const thumbnailFile = pickFile(req, ['thumbnail', 'thumbnailFile', 'poster']);
  if (thumbnailFile) {
    const storedThumb = await storeFile(thumbnailFile.path, { folder: 'vdo_bogura/thumbnails' });
    existing.thumbnail = storedThumb.url;
  } else if (body.thumbnail?.trim()) {
    existing.thumbnail = body.thumbnail.trim();
  }

  persistStore();
  res.json(existing);
};

export const streamVideo = (req: Request, res: Response) => {
  const { id } = req.params;
  const video = memoryStore.videos.find((v) => v.id === id);
  if (!video || video.type !== 'upload' || !video.filePath) {
    return res.status(404).json({ error: 'Uploaded video not found' });
  }

  // Cloudinary (or any remote) asset → hand the browser the CDN URL directly;
  // Cloudinary already serves HTTP range requests for smooth seeking.
  if (/^https?:\/\//i.test(video.filePath)) {
    return res.redirect(302, video.filePath);
  }

  const absolutePath = path.join(process.cwd(), video.filePath.replace(/^\//, ''));
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Video file missing from server disk' });
  }

  const stat = fs.statSync(absolutePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(absolutePath, { start, end });

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(absolutePath).pipe(res);
  }
};

export const deleteVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.videos.find((v) => v.id === id);
  memoryStore.videos = memoryStore.videos.filter((v) => v.id !== id);
  persistStore();

  // Best-effort cleanup of the stored asset so deleted videos stop billing.
  if (target?.type === 'upload' && target.filePath) {
    if (target.storage === 'cloudinary' && target.publicId) {
      await destroyCloudinaryAsset(target.publicId, 'video');
    } else if (!/^https?:\/\//i.test(target.filePath)) {
      try {
        const abs = path.join(process.cwd(), target.filePath.replace(/^\//, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
  }

  res.json({ message: 'Video deleted' });
};

// 6. NOTICES
export const getNotices = (req: Request, res: Response) => {
  const isAdmin = req.query.all === 'true';
  const now = new Date();
  const list = memoryStore.notices.filter((n) => {
    if (isAdmin) return true;
    if (!n.isActive) return false;
    if (n.expiryDate && new Date(n.expiryDate) < now) return false;
    return true;
  });
  list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  res.json(list);
};

export const createNotice = async (req: Request, res: Response) => {
  let pdfFile = req.body.pdfFile;
  if (req.file) {
    pdfFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/notices');
  }
  if (!requireFields(res, { title: req.body.title, pdfFile })) return;

  const newNotice: Notice = {
    id: 'not-' + Date.now(),
    title: req.body.title,
    pdfFile,
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    expiryDate: req.body.expiryDate || undefined,
    isActive: req.body.isActive !== 'false',
    referenceNo: req.body.referenceNo || '',
  };
  memoryStore.notices.unshift(newNotice);
  persistStore();
  res.status(201).json(newNotice);
};

export const updateNotice = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.notices.findIndex((n) => n.id === id);
  if (index === -1) return res.status(404).json({ error: 'Notice not found' });

  if (req.file) {
    req.body.pdfFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/notices');
  }

  memoryStore.notices[index] = {
    ...memoryStore.notices[index],
    ...req.body,
    id,
    isActive:
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : memoryStore.notices[index].isActive,
  };
  persistStore();
  res.json(memoryStore.notices[index]);
};

export const deleteNotice = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.notices = memoryStore.notices.filter((n) => n.id !== id);
  persistStore();
  res.json({ message: 'Notice deleted' });
};

// 7. PUBLICATIONS
export const getPublications = (req: Request, res: Response) => {
  const { type } = req.query;
  let list = [...memoryStore.publications];
  if (type) {
    list = list.filter((p) => p.type === type);
  }
  list.sort((a, b) => b.year - a.year);
  res.json(list);
};

export const createPublication = async (req: Request, res: Response) => {
  let pdfFile = req.body.pdfFile;
  let thumbnail = req.body.thumbnail;

  if (req.files && typeof req.files === 'object') {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['pdfFile']?.[0]) {
      pdfFile = await uploadToCloudinary(files['pdfFile'][0].path, 'vdo_bogura/publications');
    }
    if (files['thumbnail']?.[0]) {
      thumbnail = await uploadToCloudinary(files['thumbnail'][0].path, 'vdo_bogura/publications');
    }
  } else if (req.file) {
    pdfFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/publications');
  }

  if (!requireFields(res, { title: req.body.title, pdfFile })) return;

  const newPub: Publication = {
    id: 'pub-' + Date.now(),
    title: req.body.title,
    type: req.body.type || 'annual_report',
    pdfFile,
    year: Number(req.body.year || new Date().getFullYear()),
    thumbnail: thumbnail || '',
  };
  memoryStore.publications.unshift(newPub);
  persistStore();
  res.status(201).json(newPub);
};

export const updatePublication = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.publications.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Publication not found' });

  if (req.file) {
    req.body.pdfFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/publications');
  }

  memoryStore.publications[index] = {
    ...memoryStore.publications[index],
    ...req.body,
    id,
    year: Number(req.body.year ?? memoryStore.publications[index].year),
  };
  persistStore();
  res.json(memoryStore.publications[index]);
};

export const deletePublication = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.publications = memoryStore.publications.filter((p) => p.id !== id);
  persistStore();
  res.json({ message: 'Publication deleted' });
};

// 8. GALLERY (Albums & Photos)
const galleryAlbumResponse = (album: GalleryAlbum): GalleryAlbum => ({
  ...album,
  photoCount: memoryStore.galleryPhotos.filter((photo) => photo.albumId === album.id).length,
});

const cleanGalleryText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const rejectGalleryText = (
  res: Response,
  values: { title?: string; description?: string; caption?: string }
): boolean => {
  if (values.title !== undefined && !values.title) {
    res.status(400).json({ error: 'missing_title', message: 'অ্যালবামের নাম লিখুন।' });
    return true;
  }
  if ((values.title?.length || 0) > 120) {
    res.status(400).json({ error: 'title_too_long', message: 'অ্যালবামের নাম ১২০ অক্ষরের মধ্যে রাখুন।' });
    return true;
  }
  if ((values.description?.length || 0) > 500) {
    res.status(400).json({ error: 'description_too_long', message: 'বর্ণনা ৫০০ অক্ষরের মধ্যে রাখুন।' });
    return true;
  }
  if ((values.caption?.length || 0) > 300) {
    res.status(400).json({ error: 'caption_too_long', message: 'ক্যাপশন ৩০০ অক্ষরের মধ্যে রাখুন।' });
    return true;
  }
  return false;
};

const uniqueGalleryId = (prefix: 'alb' | 'p') => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;

export const getAlbums = (_req: Request, res: Response) => {
  // Counts are derived so they can never drift from photo records.
  res.json(memoryStore.galleryAlbums.map(galleryAlbumResponse));
};

export const createAlbum = async (req: Request, res: Response) => {
  const filesByField = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const allFiles = uploadedFiles(req.files as Record<string, Express.Multer.File[]> | undefined);
  const title = cleanGalleryText(req.body.title);
  const description = cleanGalleryText(req.body.description);
  const caption = cleanGalleryText(req.body.caption);

  if (rejectGalleryText(res, { title, description, caption })) {
    removeUploadedFiles(allFiles);
    return;
  }
  if (allFiles.some((file) => !hasValidImageSignature(file))) {
    removeUploadedFiles(allFiles);
    return res.status(400).json({
      error: 'invalid_image_content',
      message: 'একটি বা একাধিক ফাইল সঠিক ইমেজ নয়। JPG, PNG, WEBP অথবা GIF ছবি দিন।',
    });
  }

  // `coverImage` remains supported for older admin builds. The current UI
  // sends initial album photos as `photos` and the first photo becomes cover.
  const explicitCoverFile = filesByField.coverImage?.[0] || req.file;
  const photoFiles = filesByField.photos || [];
  const [storedCover, storedPhotos] = await Promise.all([
    explicitCoverFile ? storeGalleryImage(explicitCoverFile) : Promise.resolve(null),
    Promise.all(photoFiles.map(storeGalleryImage)),
  ]);
  const cover = storedCover || storedPhotos[0] || null;

  const newAlbum: GalleryAlbum = {
    id: uniqueGalleryId('alb'),
    title,
    coverImage: cover?.url || '',
    coverPublicId: cover?.publicId,
    coverStorage: cover?.storage,
    description,
    createdAt: new Date().toISOString(),
  };

  const createdPhotos: GalleryPhoto[] = storedPhotos.map((stored, index) => ({
    id: uniqueGalleryId('p'),
    albumId: newAlbum.id,
    image: stored.url,
    publicId: stored.publicId,
    storage: stored.storage,
    caption: caption || (storedPhotos.length > 1 ? `${title} — ${index + 1}` : title),
    uploadedAt: new Date().toISOString(),
  }));

  // Album + initial photos are committed together, preventing orphan records.
  memoryStore.galleryAlbums.unshift(newAlbum);
  memoryStore.galleryPhotos.push(...createdPhotos);
  persistStore();
  res.status(201).json({ ...galleryAlbumResponse(newAlbum), photos: createdPhotos });
};

export const updateAlbum = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.galleryAlbums.findIndex((album) => album.id === id);
  if (index === -1) {
    if (req.file) removeUploadedFiles([req.file]);
    return res.status(404).json({ error: 'album_not_found', message: 'অ্যালবামটি পাওয়া যায়নি।' });
  }

  const title = cleanGalleryText(req.body.title);
  const description = cleanGalleryText(req.body.description);
  if (rejectGalleryText(res, { title, description })) {
    if (req.file) removeUploadedFiles([req.file]);
    return;
  }
  if (req.file && !hasValidImageSignature(req.file)) {
    removeUploadedFiles([req.file]);
    return res.status(400).json({ error: 'invalid_image_content', message: 'নির্বাচিত ফাইলটি সঠিক ইমেজ নয়।' });
  }

  const oldAlbum = memoryStore.galleryAlbums[index];
  const storedCover = req.file ? await storeGalleryImage(req.file) : null;
  const updatedAlbum: GalleryAlbum = {
    ...oldAlbum,
    title,
    description,
    ...(storedCover
      ? {
          coverImage: storedCover.url,
          coverPublicId: storedCover.publicId,
          coverStorage: storedCover.storage,
        }
      : {}),
    id,
  };

  memoryStore.galleryAlbums[index] = updatedAlbum;
  persistStore();

  // Do not remove a previous cover that is also one of the album's photos.
  if (
    storedCover &&
    oldAlbum.coverImage &&
    oldAlbum.coverImage !== storedCover.url &&
    !memoryStore.galleryPhotos.some((photo) => photo.image === oldAlbum.coverImage)
  ) {
    await removeGalleryImage({
      image: oldAlbum.coverImage,
      publicId: oldAlbum.coverPublicId,
      storage: oldAlbum.coverStorage,
    });
  }

  res.json(galleryAlbumResponse(updatedAlbum));
};

export const deleteAlbum = async (req: Request, res: Response) => {
  const { id } = req.params;
  const album = memoryStore.galleryAlbums.find((item) => item.id === id);
  if (!album) return res.status(404).json({ error: 'album_not_found', message: 'অ্যালবামটি পাওয়া যায়নি।' });

  const albumPhotos = memoryStore.galleryPhotos.filter((photo) => photo.albumId === id);
  memoryStore.galleryAlbums = memoryStore.galleryAlbums.filter((item) => item.id !== id);
  memoryStore.galleryPhotos = memoryStore.galleryPhotos.filter((photo) => photo.albumId !== id);
  persistStore();

  // Remove each unique physical file once. A legacy URL still referenced by
  // another album/photo is deliberately retained.
  const uniqueAssets = new Map<string, { image: string; publicId?: string; storage?: 'cloudinary' | 'local' }>();
  uniqueAssets.set(album.coverImage, {
    image: album.coverImage,
    publicId: album.coverPublicId,
    storage: album.coverStorage,
  });
  albumPhotos.forEach((photo) => {
    uniqueAssets.set(photo.image, { image: photo.image, publicId: photo.publicId, storage: photo.storage });
  });
  await Promise.all(
    [...uniqueAssets.values()]
      .filter(
        (asset) =>
          asset.image &&
          !memoryStore.galleryAlbums.some((item) => item.coverImage === asset.image) &&
          !memoryStore.galleryPhotos.some((photo) => photo.image === asset.image)
      )
      .map(removeGalleryImage)
  );

  res.json({ message: 'Album and its photos deleted' });
};

export const getAlbumPhotos = (req: Request, res: Response) => {
  const { id } = req.params;
  if (!memoryStore.galleryAlbums.some((album) => album.id === id)) {
    return res.status(404).json({ error: 'album_not_found', message: 'অ্যালবামটি পাওয়া যায়নি।' });
  }
  res.json(memoryStore.galleryPhotos.filter((photo) => photo.albumId === id));
};

export const getAllPhotos = (_req: Request, res: Response) => {
  res.json(memoryStore.galleryPhotos);
};

export const addPhoto = async (req: Request, res: Response) => {
  const albumId = req.params.id;
  const files = uploadedFiles(req.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined);
  const albumIndex = memoryStore.galleryAlbums.findIndex((album) => album.id === albumId);
  const caption = cleanGalleryText(req.body.caption);

  if (albumIndex === -1) {
    removeUploadedFiles(files);
    return res.status(404).json({ error: 'album_not_found', message: 'অ্যালবামটি পাওয়া যায়নি।' });
  }
  if (rejectGalleryText(res, { caption })) {
    removeUploadedFiles(files);
    return;
  }
  if (files.length === 0) {
    return res.status(400).json({ error: 'no_images', message: 'আপলোড করার জন্য অন্তত একটি ছবি নির্বাচন করুন।' });
  }
  if (files.length > MAX_GALLERY_FILES) {
    removeUploadedFiles(files);
    return res.status(400).json({
      error: 'too_many_images',
      message: `একবারে সর্বোচ্চ ${MAX_GALLERY_FILES}টি ছবি আপলোড করা যাবে।`,
    });
  }
  if (files.some((file) => !hasValidImageSignature(file))) {
    removeUploadedFiles(files);
    return res.status(400).json({
      error: 'invalid_image_content',
      message: 'একটি বা একাধিক ফাইল সঠিক ইমেজ নয়। JPG, PNG, WEBP অথবা GIF ছবি দিন।',
    });
  }

  const storedImages = await Promise.all(files.map(storeGalleryImage));
  const createdPhotos: GalleryPhoto[] = storedImages.map((stored, index) => ({
    id: uniqueGalleryId('p'),
    albumId,
    image: stored.url,
    publicId: stored.publicId,
    storage: stored.storage,
    caption: caption || (storedImages.length > 1 ? `${memoryStore.galleryAlbums[albumIndex].title} — ${index + 1}` : ''),
    uploadedAt: new Date().toISOString(),
  }));

  memoryStore.galleryPhotos.push(...createdPhotos);
  const album = memoryStore.galleryAlbums[albumIndex];
  if (!album.coverImage) {
    memoryStore.galleryAlbums[albumIndex] = {
      ...album,
      coverImage: createdPhotos[0].image,
      coverPublicId: createdPhotos[0].publicId,
      coverStorage: createdPhotos[0].storage,
    };
  }
  persistStore();
  res.status(201).json(createdPhotos.length === 1 ? createdPhotos[0] : createdPhotos);
};

export const updatePhoto = (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.galleryPhotos.findIndex((photo) => photo.id === id);
  if (index === -1) return res.status(404).json({ error: 'photo_not_found', message: 'ছবিটি পাওয়া যায়নি।' });

  const caption = cleanGalleryText(req.body.caption);
  if (rejectGalleryText(res, { caption })) return;
  memoryStore.galleryPhotos[index] = { ...memoryStore.galleryPhotos[index], caption, id };
  persistStore();
  res.json(memoryStore.galleryPhotos[index]);
};

export const deletePhoto = async (req: Request, res: Response) => {
  const { id } = req.params;
  const photo = memoryStore.galleryPhotos.find((item) => item.id === id);
  if (!photo) return res.status(404).json({ error: 'photo_not_found', message: 'ছবিটি পাওয়া যায়নি।' });

  memoryStore.galleryPhotos = memoryStore.galleryPhotos.filter((item) => item.id !== id);
  const albumIndex = memoryStore.galleryAlbums.findIndex((album) => album.id === photo.albumId);
  if (albumIndex !== -1 && memoryStore.galleryAlbums[albumIndex].coverImage === photo.image) {
    const nextPhoto = memoryStore.galleryPhotos.find((item) => item.albumId === photo.albumId);
    memoryStore.galleryAlbums[albumIndex] = {
      ...memoryStore.galleryAlbums[albumIndex],
      coverImage: nextPhoto?.image || '',
      coverPublicId: nextPhoto?.publicId,
      coverStorage: nextPhoto?.storage,
    };
  }
  persistStore();

  const stillReferenced =
    memoryStore.galleryPhotos.some((item) => item.image === photo.image) ||
    memoryStore.galleryAlbums.some((album) => album.coverImage === photo.image);
  if (!stillReferenced) await removeGalleryImage(photo);
  res.json({ message: 'Photo deleted' });
};

// 9. COMMITTEE / GOVERNANCE
export const getCommittee = (req: Request, res: Response) => {
  const { type } = req.params;
  let list = [...memoryStore.committee];
  if (type) {
    list = list.filter((c) => c.type === type);
  }
  list.sort((a, b) => a.order - b.order);
  res.json(list);
};

export const createCommitteeMember = async (req: Request, res: Response) => {
  let photo = req.body.photo;
  if (req.file) {
    photo = await uploadToCloudinary(req.file.path, 'vdo_bogura/committee');
  }
  if (!requireFields(res, { name: req.body.name, designation: req.body.designation, photo })) return;

  const newMember: CommitteeMember = {
    id: 'com-' + Date.now(),
    name: req.body.name,
    designation: req.body.designation,
    type: req.body.type || 'executive',
    photo,
    bio: req.body.bio || '',
    order: memoryStore.committee.length + 1,
    email: req.body.email,
    phone: req.body.phone,
  };
  memoryStore.committee.push(newMember);
  persistStore();
  res.status(201).json(newMember);
};

export const updateCommitteeMember = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.committee.findIndex((c) => c.id === id);
  if (index === -1) return res.status(404).json({ error: 'Committee member not found' });

  if (req.file) {
    req.body.photo = await uploadToCloudinary(req.file.path, 'vdo_bogura/committee');
  }

  memoryStore.committee[index] = {
    ...memoryStore.committee[index],
    ...req.body,
    id,
  };
  persistStore();
  res.json(memoryStore.committee[index]);
};

export const deleteCommitteeMember = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.committee = memoryStore.committee.filter((c) => c.id !== id);
  persistStore();
  res.json({ message: 'Member removed' });
};

// 10. PARTNERS
export const getPartners = (req: Request, res: Response) => {
  res.json(memoryStore.partners);
};

export const createPartner = async (req: Request, res: Response) => {
  let logo = req.body.logo;
  if (req.file) {
    logo = await uploadToCloudinary(req.file.path, 'vdo_bogura/partners');
  }
  if (!requireFields(res, { name: req.body.name, logo })) return;

  const newPartner: Partner = {
    id: 'part-' + Date.now(),
    name: req.body.name,
    logo,
    websiteUrl: req.body.websiteUrl || '',
  };
  memoryStore.partners.push(newPartner);
  persistStore();
  res.status(201).json(newPartner);
};

export const updatePartner = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.partners.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Partner not found' });

  if (req.file) {
    req.body.logo = await uploadToCloudinary(req.file.path, 'vdo_bogura/partners');
  }

  memoryStore.partners[index] = {
    ...memoryStore.partners[index],
    ...req.body,
    id,
  };
  persistStore();
  res.json(memoryStore.partners[index]);
};

export const deletePartner = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.partners = memoryStore.partners.filter((p) => p.id !== id);
  persistStore();
  res.json({ message: 'Partner removed' });
};

// 11. CAREER & APPLICATIONS
export const getCareers = (req: Request, res: Response) => {
  const isAdmin = req.query.all === 'true';
  const now = new Date();
  const list = memoryStore.careers.filter((c) => {
    if (isAdmin) return true;
    if (!c.isActive) return false;
    if (new Date(c.deadline) < now) return false;
    return true;
  });
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(list);
};

export const createCareer = async (req: Request, res: Response) => {
  let pdfFile = req.body.pdfFile;
  if (req.file) {
    pdfFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/careers');
  }
  if (!requireFields(res, {
    title: req.body.title,
    deadline: req.body.deadline,
    description: req.body.description,
    location: req.body.location,
  })) return;

  const newCircular: CareerCircular = {
    id: 'car-' + Date.now(),
    title: req.body.title,
    deadline: req.body.deadline,
    description: req.body.description,
    location: req.body.location,
    vacancy: Number(req.body.vacancy || 1),
    pdfFile,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  memoryStore.careers.unshift(newCircular);
  persistStore();
  res.status(201).json(newCircular);
};

export const updateCareer = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.careers.findIndex((c) => c.id === id);
  if (index === -1) return res.status(404).json({ error: 'Career circular not found' });

  if (req.file) {
    req.body.pdfFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/careers');
  }

  memoryStore.careers[index] = {
    ...memoryStore.careers[index],
    ...req.body,
    id,
    vacancy: Number(req.body.vacancy ?? memoryStore.careers[index].vacancy),
    isActive:
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : memoryStore.careers[index].isActive,
  };
  persistStore();
  res.json(memoryStore.careers[index]);
};

export const deleteCareer = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.careers = memoryStore.careers.filter((c) => c.id !== id);
  persistStore();
  res.json({ message: 'Career circular deleted' });
};

export const applyJob = async (req: Request, res: Response) => {
  let cvFile = req.body.cvFile;
  if (req.file) {
    cvFile = await uploadToCloudinary(req.file.path, 'vdo_bogura/cvs');
  }

  if (!cvFile) {
    return res.status(400).json({ error: 'Please upload your CV (PDF file)' });
  }

  const { careerId, name, email, phone, notes } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  const circular = memoryStore.careers.find((c) => c.id === careerId);

  const newApp: Application = {
    id: 'app-' + Date.now(),
    careerId,
    jobTitle: circular ? circular.title : 'General Application',
    name,
    email,
    phone,
    cvFile,
    notes,
    submittedAt: new Date().toISOString(),
  };

  memoryStore.applications.unshift(newApp);
  persistStore();
  res.status(201).json({ message: 'আপনার আবেদনপত্র সফলভাবে জমা হয়েছে। ধন্যবাদ!', application: newApp });
};

export const getApplications = (req: Request, res: Response) => {
  res.json(memoryStore.applications);
};

export const deleteApplication = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.applications = memoryStore.applications.filter((a) => a.id !== id);
  persistStore();
  res.json({ message: 'Application deleted' });
};

// 12. STATS
export const getStats = (req: Request, res: Response) => {
  const stats = [...memoryStore.stats].sort((a, b) => a.order - b.order);
  res.json(stats);
};

export const createStat = (req: Request, res: Response) => {
  const newStat: StatItem = {
    id: 'st-' + Date.now(),
    label: req.body.label || 'নতুন পরিসংখ্যান',
    value: Number(req.body.value || 0),
    suffix: req.body.suffix || '+',
    icon: req.body.icon || 'Users',
    order: memoryStore.stats.length + 1,
  };
  memoryStore.stats.push(newStat);
  persistStore();
  res.status(201).json(newStat);
};

export const updateStat = (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.stats.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Stat item not found' });

  memoryStore.stats[index] = {
    ...memoryStore.stats[index],
    ...req.body,
    id,
    value: Number(req.body.value ?? memoryStore.stats[index].value),
    order: Number(req.body.order ?? memoryStore.stats[index].order),
  };
  persistStore();
  res.json(memoryStore.stats[index]);
};

export const deleteStat = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.stats = memoryStore.stats.filter((s) => s.id !== id);
  persistStore();
  res.json({ message: 'Stat item deleted' });
};

// 13. SETTINGS (identity, contact, theme colors)
export const getSettings = (req: Request, res: Response) => {
  res.json(memoryStore.settings);
};

/** FormData submits nested objects as JSON strings - parse them back. */
function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return value;
  }
}

export const updateSettings = async (req: Request, res: Response) => {
  let updatedData = { ...req.body } as Record<string, unknown>;
  if (req.file) {
    updatedData.logoUrl = await uploadToCloudinary(req.file.path, 'vdo_bogura/settings');
  }

  ['theme', 'socialLinks', 'branchAddresses', 'headerLocation', 'footerAbout', 'footerCopyright'].forEach(
    (key) => {
      if (key in updatedData) {
        updatedData[key] = parseJsonField(updatedData[key]);
      }
    }
  );

  // Merge theme carefully so a missing key never wipes the active colors.
  const theme = updatedData.theme as { primary?: string; accent?: string } | undefined;
  if (theme) {
    updatedData.theme = {
      primary: theme.primary || memoryStore.settings.theme?.primary || DEFAULT_THEME.primary,
      accent: theme.accent || memoryStore.settings.theme?.accent || DEFAULT_THEME.accent,
    };
  }

  memoryStore.settings = {
    ...memoryStore.settings,
    ...(updatedData as Partial<SiteSettings>),
  };
  persistStore();
  res.json(memoryStore.settings);
};

// 14. PAGE CONTENT (Home & About editable copy)
export const getPageContent = (req: Request, res: Response) => {
  res.json(memoryStore.pageContent);
};

export const updatePageContent = async (req: Request, res: Response) => {
  const incoming: Partial<PageContent> = req.body || {};
  const current = memoryStore.pageContent as Partial<PageContent>;

  const next: PageContent = {
    home: { ...(current.home as object), ...(incoming.home || {}) } as PageContent['home'],
    about: { ...(current.about as object), ...(incoming.about || {}) } as PageContent['about'],
  };

  memoryStore.pageContent = next;
  persistStore();
  res.json(memoryStore.pageContent);
};
