import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { deleteAsset } from '../services/storage';
import { parseVideoLink, formatDuration } from '../utils/videoSources';
import { AssetRef, readAsset, readAssetList, releaseAsset, toBool } from '../utils/assets';
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

/**
 * Media that has already been pushed to Cloudinary arrives here as a plain
 * `{ url, publicId }` reference inside the JSON body. `assetOr` turns a missing
 * or unusable reference into a clear 400 message (instead of saving a record
 * with a broken picture, which is what the old multipart flow did).
 */
const assetOr = (
  res: Response,
  asset: AssetRef | null,
  label: string
): AssetRef | null => {
  if (!asset?.url) {
    res.status(400).json({
      error: 'missing_asset',
      message: `${label} সংযোগ করা যায়নি — ফাইলটি বেছে নিয়ে আপলোড শেষ হওয়ার পর আবার সেভ করুন।`,
    });
    return null;
  }
  return asset;
};

/** How many pictures one album request may carry (they are uploaded one by one). */
const MAX_GALLERY_PHOTOS = 40;

/**
 * Same as `assetOr` but for attachments that may legitimately be left out
 * (a career circular without a PDF, …). An empty value is accepted; a value that
 * looks like it was meant to be a URL but is not gets reported instead of being
 * saved into the record.
 */
const optionalAsset = (
  res: Response,
  body: Record<string, unknown>,
  key: string,
  label: string
): { ok: boolean; asset: AssetRef | null } => {
  const raw = body?.[key];
  if (raw === undefined || raw === null || raw === '') return { ok: true, asset: null };
  const asset = readAsset(body, key);
  if (!asset) {
    res.status(400).json({
      error: 'invalid_asset',
      message: `${label}-এর ঠিকানা সঠিক নয়। ফাইলটি আবার আপলোড করে তারপর সেভ করুন।`,
    });
    return { ok: false, asset: null };
  }
  return { ok: true, asset };
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
  const image = readAsset(req.body, 'image');
  if (!requireFields(res, { headline: req.body.headline, subtext: req.body.subtext })) return;
  const asset = assetOr(res, image, 'স্লাইডের ছবি');
  if (!asset) return;

  const newSlide: HeroSlide = {
    id: 'hs-' + Date.now(),
    image: asset.url,
    imagePublicId: asset.publicId,
    headline: req.body.headline,
    subtext: req.body.subtext,
    buttonText: req.body.buttonText,
    buttonLink: req.body.buttonLink,
    order: memoryStore.heroSlides.length + 1,
    isActive: toBool(req.body.isActive, true),
  };
  memoryStore.heroSlides.push(newSlide);
  persistStore();
  res.status(201).json(newSlide);
};

export const updateHeroSlide = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.heroSlides.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Slide not found' });

  const previous = memoryStore.heroSlides[index];
  const image = readAsset(req.body, 'image');

  const next: HeroSlide = {
    ...previous,
    headline: req.body.headline !== undefined ? req.body.headline : previous.headline,
    subtext: req.body.subtext !== undefined ? req.body.subtext : previous.subtext,
    buttonText: req.body.buttonText !== undefined ? req.body.buttonText : previous.buttonText,
    buttonLink: req.body.buttonLink !== undefined ? req.body.buttonLink : previous.buttonLink,
    order: Number(req.body.order ?? previous.order),
    isActive: toBool(req.body.isActive, previous.isActive),
    ...(image
      ? { image: image.url, imagePublicId: image.publicId }
      : { image: previous.image, imagePublicId: previous.imagePublicId }),
    id,
  };

  memoryStore.heroSlides[index] = next;
  persistStore();

  // The replaced picture is no longer shown anywhere → drop it from Cloudinary.
  if (image && image.url !== previous.image) {
    await releaseAsset({ url: previous.image, publicId: previous.imagePublicId }, (url) =>
      memoryStore.heroSlides.some((slide) => slide.id !== id && slide.image === url)
    );
  }

  res.json(next);
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

export const deleteHeroSlide = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.heroSlides.find((s) => s.id === id);
  memoryStore.heroSlides = memoryStore.heroSlides.filter((s) => s.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.image, publicId: target.imagePublicId }, (url) =>
      memoryStore.heroSlides.some((slide) => slide.image === url)
    );
  }
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
  const cover = readAsset(req.body, 'coverImage');
  if (!requireFields(res, { title: req.body.title, shortDesc: req.body.shortDesc, content: req.body.content })) return;
  const asset = assetOr(res, cover, 'প্রজেক্টের কভার ছবি');
  if (!asset) return;

  const slug = slugify(req.body.slug || req.body.title || '') || 'program-' + Date.now();
  const newProgram: Program = {
    id: 'prg-' + Date.now(),
    title: req.body.title,
    slug,
    icon: req.body.icon || 'Sprout',
    shortDesc: req.body.shortDesc,
    content: req.body.content,
    coverImage: asset.url,
    coverImagePublicId: asset.publicId,
    status: req.body.status === 'completed' ? 'completed' : 'ongoing',
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

  const previous = memoryStore.programs[index];
  const cover = readAsset(req.body, 'coverImage');
  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));

  const next: Program = {
    ...previous,
    title: keep(req.body.title, previous.title),
    shortDesc: keep(req.body.shortDesc, previous.shortDesc),
    content: keep(req.body.content, previous.content),
    icon: keep(req.body.icon, previous.icon),
    status: req.body.status === 'ongoing' || req.body.status === 'completed' ? req.body.status : previous.status,
    beneficiariesCount:
      req.body.beneficiariesCount !== undefined ? Number(req.body.beneficiariesCount) : previous.beneficiariesCount,
    districtsCovered:
      req.body.districtsCovered !== undefined ? Number(req.body.districtsCovered) : previous.districtsCovered,
    order: req.body.order !== undefined ? Number(req.body.order) : previous.order,
    ...(cover
      ? { coverImage: cover.url, coverImagePublicId: cover.publicId }
      : { coverImage: previous.coverImage, coverImagePublicId: previous.coverImagePublicId }),
    id,
  };

  memoryStore.programs[index] = next;
  persistStore();

  if (cover && cover.url !== previous.coverImage) {
    await releaseAsset({ url: previous.coverImage, publicId: previous.coverImagePublicId }, (url) =>
      memoryStore.programs.some((program) => program.id !== id && program.coverImage === url)
    );
  }

  res.json(next);
};

export const deleteProgram = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.programs.find((p) => p.id === id);
  memoryStore.programs = memoryStore.programs.filter((p) => p.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.coverImage, publicId: target.coverImagePublicId }, (url) =>
      memoryStore.programs.some((program) => program.coverImage === url)
    );
  }
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

const NEWS_CATEGORIES = ['News', 'Event', 'Press Release', 'Impact Story'] as const;

export const createNews = async (req: Request, res: Response) => {
  const thumbnail = readAsset(req.body, 'thumbnail');
  if (!requireFields(res, { title: req.body.title, content: req.body.content })) return;
  const asset = assetOr(res, thumbnail, 'সংবাদের থাম্বনেইল ছবি');
  if (!asset) return;

  const slug = slugify(req.body.slug || req.body.title || '') || 'news-' + Date.now();
  const newNews: NewsItem = {
    id: 'news-' + Date.now(),
    title: req.body.title,
    slug,
    category: (NEWS_CATEGORIES as readonly string[]).includes(req.body.category)
      ? req.body.category
      : 'News',
    thumbnail: asset.url,
    thumbnailPublicId: asset.publicId,
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

  const previous = memoryStore.news[index];
  const thumbnail = readAsset(req.body, 'thumbnail');
  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));

  const next: NewsItem = {
    ...previous,
    title: keep(req.body.title, previous.title),
    content: keep(req.body.content, previous.content),
    author: keep(req.body.author, previous.author),
    publishedAt: keep(req.body.publishedAt, previous.publishedAt),
    category:
      (NEWS_CATEGORIES as readonly string[]).includes(req.body.category) ? req.body.category : previous.category,
    ...(thumbnail
      ? { thumbnail: thumbnail.url, thumbnailPublicId: thumbnail.publicId }
      : { thumbnail: previous.thumbnail, thumbnailPublicId: previous.thumbnailPublicId }),
    id,
  };

  memoryStore.news[index] = next;
  persistStore();

  if (thumbnail && thumbnail.url !== previous.thumbnail) {
    await releaseAsset({ url: previous.thumbnail, publicId: previous.thumbnailPublicId }, (url) =>
      memoryStore.news.some((item) => item.id !== id && item.thumbnail === url)
    );
  }

  res.json(next);
};

export const deleteNews = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.news.find((n) => n.id === id);
  memoryStore.news = memoryStore.news.filter((n) => n.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.thumbnail, publicId: target.thumbnailPublicId }, (url) =>
      memoryStore.news.some((item) => item.thumbnail === url)
    );
  }
  res.json({ message: 'News item deleted' });
};

// 5. VIDEO MANAGEMENT & STREAMING
export const getVideos = (req: Request, res: Response) => {
  const list = [...memoryStore.videos].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  res.json(list);
};

/**
 * A video record is one of two things:
 *
 *   • `upload` — the file was pushed to Cloudinary by `POST /api/uploads/video`
 *     and the record only keeps the returned URL + public id (so deleting the
 *     video also deletes the cloud file);
 *   • `embed`  — a YouTube / Vimeo (or any external) link the admin pasted.
 */
const DEFAULT_VIDEO_THUMB = '';

interface VideoBody {
  title?: string;
  category?: string;
  description?: string;
  type?: string;
  embedUrl?: string;
  youtubeUrl?: string;
  url?: string;
  duration?: string;
  thumbnail?: unknown;
  filePath?: unknown;
}

/** Uploaded file + optional custom poster → VideoItem. */
function buildUploadedVideo(body: VideoBody, asset: AssetRef, poster: AssetRef | null): VideoItem {
  const durationSeconds = typeof asset.duration === 'number' && asset.duration > 0 ? asset.duration : undefined;

  return {
    id: 'vid-' + Date.now(),
    title: (body.title || '').trim() || asset.originalName || 'ভিডিও',
    type: 'upload',
    filePath: asset.url,
    publicId: asset.publicId,
    storage: 'cloudinary',
    thumbnail: (poster?.url || asset.thumbnailUrl || DEFAULT_VIDEO_THUMB).trim(),
    thumbnailPublicId: poster?.publicId,
    duration: formatDuration(durationSeconds) || '00:00',
    durationSeconds,
    sizeBytes: asset.bytes,
    uploadedAt: new Date().toISOString(),
    category: (body.category || '').trim() || 'General',
    description: (body.description || '').trim() || undefined,
  };
}

/** Build a video record from a pasted YouTube / Vimeo / direct link. */
function buildEmbeddedVideo(body: VideoBody, thumbnailUrl?: string): VideoItem | null {
  const rawUrl = (body.embedUrl || body.youtubeUrl || body.url || '').trim();
  const parsed = parseVideoLink(rawUrl);
  if (!parsed) return null;

  return {
    id: 'vid-' + Date.now(),
    title: (body.title || '').trim() || 'ভিডিও',
    type: 'embed',
    provider: parsed.provider,
    providerId: parsed.videoId,
    embedUrl: parsed.embedUrl,
    watchUrl: parsed.watchUrl,
    thumbnail: thumbnailUrl || (typeof body.thumbnail === 'string' ? body.thumbnail.trim() : '') || parsed.thumbnail || DEFAULT_VIDEO_THUMB,
    duration: typeof body.duration === 'string' ? body.duration.trim() || undefined : undefined,
    uploadedAt: new Date().toISOString(),
    category: (body.category || '').trim() || 'Highlight',
    description: (body.description || '').trim() || undefined,
  };
}

/**
 * Unified video endpoint (POST /api/videos).
 *
 * `type=upload` with a `filePath` asset, or `type=embed` with a link — the mode
 * is also detected automatically from what the form actually sent.
 */
export const createVideo = (req: Request, res: Response) => {
  const body = (req.body || {}) as VideoBody & Record<string, unknown>;
  const asset = readAsset(body, 'filePath', 'filePathPublicId', 'video');
  const poster = readAsset(body, 'thumbnail');
  const linkValue = (body.embedUrl || body.youtubeUrl || body.url || '').trim();
  const requestedType = body.type === 'upload' || body.type === 'embed' ? body.type : undefined;
  const mode = requestedType || (asset ? 'upload' : linkValue ? 'embed' : undefined);

  if (mode === 'upload') {
    if (!asset) {
      return res.status(400).json({
        error: 'missing_video_file',
        message: 'ভিডিও ফাইলটি Cloudinary-তে আপলোড হয়নি। ফাইল বেছে নিয়ে আপলোড শেষ হলে আবার সেভ করুন।',
      });
    }
    if (!(body.title || '').trim()) {
      return res.status(400).json({ error: 'missing_title', message: 'ভিডিওর শিরোনাম লিখুন।' });
    }
    const newVid = buildUploadedVideo(body, asset, poster);
    memoryStore.videos.unshift(newVid);
    persistStore();
    return res.status(201).json(newVid);
  }

  if (mode === 'embed') {
    if (!(body.title || '').trim()) {
      return res.status(400).json({ error: 'missing_title', message: 'ভিডিওর শিরোনাম লিখুন।' });
    }
    const newVid = buildEmbeddedVideo(body, poster?.url);
    if (!newVid) {
      return res.status(400).json({
        error: 'invalid_video_link',
        message: 'সঠিক ইউটিউব/ভিমিও লিঙ্ক দিন (Invalid video link)।',
      });
    }
    memoryStore.videos.unshift(newVid);
    persistStore();
    return res.status(201).json(newVid);
  }

  return res.status(400).json({
    error: 'missing_video',
    message: 'ভিডিও ফাইল অথবা ইউটিউব লিঙ্ক দিন (send either an uploaded file or an embedUrl)।',
  });
};

/** Update the editable metadata of a video (title / category / link / poster). */
export const updateVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = memoryStore.videos.find((v) => v.id === id);
  if (!existing) return res.status(404).json({ error: 'Video not found' });

  const body = (req.body || {}) as VideoBody & Record<string, unknown>;
  if (body.title?.trim()) existing.title = body.title.trim();
  if (body.category?.trim()) existing.category = body.category.trim();
  if (body.description !== undefined) existing.description = body.description.trim() || undefined;

  const link = (body.embedUrl || body.youtubeUrl || body.url || '').trim();
  if (existing.type === 'embed' && link) {
    const parsed = parseVideoLink(link);
    if (!parsed) return res.status(400).json({ error: 'invalid_video_link', message: 'সঠিক ইউটিউব/ভিমিও লিঙ্ক দিন।' });
    existing.embedUrl = parsed.embedUrl;
    existing.watchUrl = parsed.watchUrl;
    existing.provider = parsed.provider;
    existing.providerId = parsed.videoId;
    if (parsed.thumbnail && !body.thumbnail) existing.thumbnail = parsed.thumbnail;
  }

  const poster = readAsset(body, 'thumbnail');
  const previousPoster = existing.thumbnailPublicId
    ? { url: existing.thumbnail, publicId: existing.thumbnailPublicId }
    : null;
  if (poster) {
    existing.thumbnail = poster.url;
    existing.thumbnailPublicId = poster.publicId;
  }

  persistStore();

  if (poster && previousPoster && poster.url !== previousPoster.url) {
    await releaseAsset(previousPoster, (url) => memoryStore.videos.some((v) => v.id !== id && v.thumbnail === url));
  }

  res.json(existing);
};

/**
 * Legacy helper for files uploaded before the Cloudinary migration: records that
 * still point at a local /uploads path are streamed from disk (remote assets are
 * served by Cloudinary itself, so the browser is simply redirected there).
 */
export const streamVideo = (req: Request, res: Response) => {
  const { id } = req.params;
  const video = memoryStore.videos.find((v) => v.id === id);
  if (!video || video.type !== 'upload' || !video.filePath) {
    return res.status(404).json({ error: 'Uploaded video not found' });
  }

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

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' });
  fs.createReadStream(absolutePath).pipe(res);
};

export const deleteVideo = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.videos.find((v) => v.id === id);
  memoryStore.videos = memoryStore.videos.filter((v) => v.id !== id);
  persistStore();

  if (target?.type === 'upload' && target.filePath) {
    if (target.publicId) {
      await deleteAsset(target.publicId, target.storage === 'local' ? undefined : 'video');
    } else if (!/^https?:\/\//i.test(target.filePath)) {
      // Legacy record still living on the server disk.
      try {
        const abs = path.join(process.cwd(), target.filePath.replace(/^\//, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
    if (target.thumbnailPublicId) {
      await releaseAsset({ url: target.thumbnail, publicId: target.thumbnailPublicId, resourceType: 'image' });
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
  const pdf = readAsset(req.body, 'pdfFile');
  if (!requireFields(res, { title: req.body.title })) return;
  const asset = assetOr(res, pdf, 'নোটিশের PDF ফাইল');
  if (!asset) return;

  const newNotice: Notice = {
    id: 'not-' + Date.now(),
    title: req.body.title,
    pdfFile: asset.url,
    pdfFilePublicId: asset.publicId,
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    expiryDate: req.body.expiryDate || undefined,
    isActive: toBool(req.body.isActive, true),
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

  const previous = memoryStore.notices[index];
  const pdf = readAsset(req.body, 'pdfFile');
  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));

  const next: Notice = {
    ...previous,
    title: keep(req.body.title, previous.title),
    referenceNo: keep(req.body.referenceNo, previous.referenceNo),
    publishedAt: keep(req.body.publishedAt, previous.publishedAt),
    expiryDate: req.body.expiryDate === '' ? undefined : keep(req.body.expiryDate, previous.expiryDate),
    isActive: toBool(req.body.isActive, previous.isActive),
    ...(pdf
      ? { pdfFile: pdf.url, pdfFilePublicId: pdf.publicId }
      : { pdfFile: previous.pdfFile, pdfFilePublicId: previous.pdfFilePublicId }),
    id,
  };

  memoryStore.notices[index] = next;
  persistStore();

  if (pdf && pdf.url !== previous.pdfFile) {
    await releaseAsset({ url: previous.pdfFile, publicId: previous.pdfFilePublicId }, (url) =>
      memoryStore.notices.some((notice) => notice.id !== id && notice.pdfFile === url)
    );
  }

  res.json(next);
};

export const deleteNotice = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.notices.find((n) => n.id === id);
  memoryStore.notices = memoryStore.notices.filter((n) => n.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.pdfFile, publicId: target.pdfFilePublicId }, (url) =>
      memoryStore.notices.some((notice) => notice.pdfFile === url)
    );
  }
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

const PUBLICATION_TYPES = ['annual_report', 'newsletter', 'report'] as const;

export const createPublication = async (req: Request, res: Response) => {
  const pdf = readAsset(req.body, 'pdfFile');
  const cover = readAsset(req.body, 'thumbnail');
  if (!requireFields(res, { title: req.body.title })) return;
  const asset = assetOr(res, pdf, 'প্রকাশনার PDF ফাইল');
  if (!asset) return;

  const newPub: Publication = {
    id: 'pub-' + Date.now(),
    title: req.body.title,
    type: (PUBLICATION_TYPES as readonly string[]).includes(req.body.type)
      ? (req.body.type as Publication['type'])
      : 'annual_report',
    pdfFile: asset.url,
    pdfFilePublicId: asset.publicId,
    year: Number(req.body.year || new Date().getFullYear()),
    thumbnail: cover?.url || '',
    thumbnailPublicId: cover?.publicId,
  };
  memoryStore.publications.unshift(newPub);
  persistStore();
  res.status(201).json(newPub);
};

export const updatePublication = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.publications.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Publication not found' });

  const previous = memoryStore.publications[index];
  const pdf = readAsset(req.body, 'pdfFile');
  const cover = readAsset(req.body, 'thumbnail');
  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));

  const next: Publication = {
    ...previous,
    title: keep(req.body.title, previous.title),
    year: Number(req.body.year ?? previous.year),
    type: (PUBLICATION_TYPES as readonly string[]).includes(req.body.type)
      ? (req.body.type as Publication['type'])
      : previous.type,
    ...(pdf
      ? { pdfFile: pdf.url, pdfFilePublicId: pdf.publicId }
      : { pdfFile: previous.pdfFile, pdfFilePublicId: previous.pdfFilePublicId }),
    ...(cover ? { thumbnail: cover.url, thumbnailPublicId: cover.publicId } : {}),
    id,
  };

  memoryStore.publications[index] = next;
  persistStore();

  if (pdf && pdf.url !== previous.pdfFile) {
    await releaseAsset({ url: previous.pdfFile, publicId: previous.pdfFilePublicId }, (url) =>
      memoryStore.publications.some((pub) => pub.id !== id && pub.pdfFile === url)
    );
  }
  if (cover && previous.thumbnail && cover.url !== previous.thumbnail) {
    await releaseAsset({ url: previous.thumbnail, publicId: previous.thumbnailPublicId }, (url) =>
      memoryStore.publications.some((pub) => pub.id !== id && pub.thumbnail === url)
    );
  }

  res.json(next);
};

export const deletePublication = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.publications.find((p) => p.id === id);
  memoryStore.publications = memoryStore.publications.filter((p) => p.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.pdfFile, publicId: target.pdfFilePublicId }, (url) =>
      memoryStore.publications.some((pub) => pub.pdfFile === url)
    );
    if (target.thumbnail) {
      await releaseAsset({ url: target.thumbnail, publicId: target.thumbnailPublicId }, (url) =>
        memoryStore.publications.some((pub) => pub.thumbnail === url)
      );
    }
  }
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

/**
 * Gallery pictures are uploaded one by one through /api/uploads/image, so an
 * "album create" request is pure JSON: the title plus the assets that already
 * live in Cloudinary.
 */
const galleryAssetsFromBody = (
  req: Request,
  res: Response,
  key: string
): AssetRef[] | null => {
  const raw = req.body?.[key];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!list.length) return [];
  const assets = readAssetList(req.body, key, MAX_GALLERY_PHOTOS);
  if (assets.length !== list.length) {
    res.status(400).json({
      error: 'invalid_image_urls',
      message: 'একটি বা একাধিক ছবির ঠিকানা সঠিক নয়। ছবিগুলো আবার আপলোড করে তারপর সেভ করুন।',
    });
    return null;
  }
  return assets;
};

const galleryCaption = (body: Record<string, unknown>, index: number, fallback: string) => {
  const captions = Array.isArray(body.captions) ? (body.captions as unknown[]) : [];
  const own = cleanGalleryText(captions[index]);
  if (own) return own.slice(0, 300);
  const shared = cleanGalleryText(body.caption);
  if (shared) return shared.slice(0, 300);
  return fallback;
};

const photoRecord = (albumId: string, asset: AssetRef, caption: string): GalleryPhoto => ({
  id: uniqueGalleryId('p'),
  albumId,
  image: asset.url,
  publicId: asset.publicId,
  storage: 'cloudinary',
  caption,
  uploadedAt: new Date().toISOString(),
});

export const createAlbum = async (req: Request, res: Response) => {
  const title = cleanGalleryText(req.body.title);
  const description = cleanGalleryText(req.body.description);
  if (rejectGalleryText(res, { title, description })) return;

  const photos = galleryAssetsFromBody(req, res, 'photos');
  if (!photos) return;
  const cover = readAsset(req.body, 'cover') || photos[0] || null;

  const newAlbum: GalleryAlbum = {
    id: uniqueGalleryId('alb'),
    title,
    coverImage: cover?.url || '',
    coverPublicId: cover?.publicId,
    coverStorage: cover ? 'cloudinary' : undefined,
    description,
    createdAt: new Date().toISOString(),
  };

  const createdPhotos: GalleryPhoto[] = photos.map((asset, index) =>
    photoRecord(newAlbum.id, asset, galleryCaption(req.body, index, photos.length > 1 ? `${title} — ${index + 1}` : title))
  );

  // Album + its pictures are committed together, preventing orphan records.
  memoryStore.galleryAlbums.unshift(newAlbum);
  memoryStore.galleryPhotos.push(...createdPhotos);
  persistStore();
  res.status(201).json({ ...galleryAlbumResponse(newAlbum), photos: createdPhotos });
};

export const updateAlbum = async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.galleryAlbums.findIndex((album) => album.id === id);
  if (index === -1) return res.status(404).json({ error: 'album_not_found', message: 'অ্যালবামটি পাওয়া যায়নি।' });

  const title = cleanGalleryText(req.body.title);
  const description = cleanGalleryText(req.body.description);
  if (rejectGalleryText(res, { title, description })) return;

  const oldAlbum = memoryStore.galleryAlbums[index];
  const cover = readAsset(req.body, 'cover');
  const updatedAlbum: GalleryAlbum = {
    ...oldAlbum,
    title,
    description,
    ...(cover
      ? { coverImage: cover.url, coverPublicId: cover.publicId, coverStorage: 'cloudinary' as const }
      : {}),
    id,
  };

  memoryStore.galleryAlbums[index] = updatedAlbum;
  persistStore();

  // Do not remove a previous cover that is also one of the album's photos.
  if (cover && oldAlbum.coverImage && oldAlbum.coverImage !== cover.url) {
    await releaseAsset(
      { url: oldAlbum.coverImage, publicId: oldAlbum.coverPublicId, resourceType: 'image' },
      (url) =>
        memoryStore.galleryPhotos.some((photo) => photo.image === url) ||
        memoryStore.galleryAlbums.some((album) => album.id !== id && album.coverImage === url)
    );
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

  // Remove each unique Cloudinary asset once. A URL still referenced by
  // another album/photo is deliberately retained.
  const uniqueAssets = new Map<string, AssetRef>();
  if (album.coverImage) {
    uniqueAssets.set(album.coverImage, { url: album.coverImage, publicId: album.coverPublicId, resourceType: 'image' });
  }
  albumPhotos.forEach((photo) => {
    if (photo.image) {
      uniqueAssets.set(photo.image, { url: photo.image, publicId: photo.publicId, resourceType: 'image' });
    }
  });

  await Promise.all(
    [...uniqueAssets.values()]
      .filter(
        (asset) =>
          asset.url &&
          !memoryStore.galleryAlbums.some((item) => item.coverImage === asset.url) &&
          !memoryStore.galleryPhotos.some((photo) => photo.image === asset.url)
      )
      .map((asset) => releaseAsset(asset))
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

/**
 * Add already-uploaded pictures to an open album:
 * `{ photos: [{ url, publicId, caption? }], caption? }`.
 */
export const addPhoto = async (req: Request, res: Response) => {
  const albumId = req.params.id;
  const albumIndex = memoryStore.galleryAlbums.findIndex((album) => album.id === albumId);
  const caption = cleanGalleryText(req.body.caption);

  if (albumIndex === -1) {
    return res.status(404).json({ error: 'album_not_found', message: 'অ্যালবামটি পাওয়া যায়নি।' });
  }
  if (rejectGalleryText(res, { caption })) return;

  const photos = galleryAssetsFromBody(req, res, 'photos') || galleryAssetsFromBody(req, res, 'images');
  if (!photos) return;
  if (photos.length === 0) {
    return res.status(400).json({ error: 'no_images', message: 'আপলোড করার জন্য অন্তত একটি ছবি নির্বাচন করুন।' });
  }

  const album = memoryStore.galleryAlbums[albumIndex];
  const createdPhotos: GalleryPhoto[] = photos.map((asset, index) =>
    photoRecord(
      albumId,
      asset,
      galleryCaption(
        req.body,
        index,
        photos.length > 1 ? `${album.title} — ${index + 1}` : ''
      )
    )
  );

  memoryStore.galleryPhotos.push(...createdPhotos);
  if (!album.coverImage) {
    memoryStore.galleryAlbums[albumIndex] = {
      ...album,
      coverImage: createdPhotos[0].image,
      coverPublicId: createdPhotos[0].publicId,
      coverStorage: 'cloudinary',
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
  if (!stillReferenced) {
    await releaseAsset({ url: photo.image, publicId: photo.publicId, resourceType: 'image' });
  }
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

const COMMITTEE_TYPES = ['general', 'executive', 'advisory', 'leadership'] as const;

export const createCommitteeMember = async (req: Request, res: Response) => {
  const photo = readAsset(req.body, 'photo');
  if (!requireFields(res, { name: req.body.name, designation: req.body.designation })) return;
  const asset = assetOr(res, photo, 'সদস্যের ছবি');
  if (!asset) return;

  const newMember: CommitteeMember = {
    id: 'com-' + Date.now(),
    name: req.body.name,
    designation: req.body.designation,
    type: (COMMITTEE_TYPES as readonly string[]).includes(req.body.type)
      ? (req.body.type as CommitteeMember['type'])
      : 'executive',
    photo: asset.url,
    photoPublicId: asset.publicId,
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

  const previous = memoryStore.committee[index];
  const photo = readAsset(req.body, 'photo');
  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));

  const next: CommitteeMember = {
    ...previous,
    name: keep(req.body.name, previous.name),
    designation: keep(req.body.designation, previous.designation),
    bio: keep(req.body.bio, previous.bio),
    email: keep(req.body.email, previous.email),
    phone: keep(req.body.phone, previous.phone),
    order: req.body.order !== undefined ? Number(req.body.order) : previous.order,
    type: (COMMITTEE_TYPES as readonly string[]).includes(req.body.type)
      ? (req.body.type as CommitteeMember['type'])
      : previous.type,
    ...(photo ? { photo: photo.url, photoPublicId: photo.publicId } : {}),
    id,
  };

  memoryStore.committee[index] = next;
  persistStore();

  if (photo && photo.url !== previous.photo) {
    await releaseAsset({ url: previous.photo, publicId: previous.photoPublicId }, (url) =>
      memoryStore.committee.some((member) => member.id !== id && member.photo === url)
    );
  }

  res.json(next);
};

export const deleteCommitteeMember = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.committee.find((c) => c.id === id);
  memoryStore.committee = memoryStore.committee.filter((c) => c.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.photo, publicId: target.photoPublicId }, (url) =>
      memoryStore.committee.some((member) => member.photo === url)
    );
  }
  res.json({ message: 'Member removed' });
};

// 10. PARTNERS
export const getPartners = (req: Request, res: Response) => {
  res.json(memoryStore.partners);
};

export const createPartner = async (req: Request, res: Response) => {
  const logo = readAsset(req.body, 'logo');
  if (!requireFields(res, { name: req.body.name })) return;
  const asset = assetOr(res, logo, 'পার্টনারের লোগো');
  if (!asset) return;

  const newPartner: Partner = {
    id: 'part-' + Date.now(),
    name: req.body.name,
    logo: asset.url,
    logoPublicId: asset.publicId,
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

  const previous = memoryStore.partners[index];
  const logo = readAsset(req.body, 'logo');
  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));

  const next: Partner = {
    ...previous,
    name: keep(req.body.name, previous.name),
    websiteUrl: keep(req.body.websiteUrl, previous.websiteUrl),
    ...(logo ? { logo: logo.url, logoPublicId: logo.publicId } : {}),
    id,
  };

  memoryStore.partners[index] = next;
  persistStore();

  if (logo && logo.url !== previous.logo) {
    await releaseAsset({ url: previous.logo, publicId: previous.logoPublicId }, (url) =>
      memoryStore.partners.some((partner) => partner.id !== id && partner.logo === url)
    );
  }

  res.json(next);
};

export const deletePartner = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.partners.find((p) => p.id === id);
  memoryStore.partners = memoryStore.partners.filter((p) => p.id !== id);
  persistStore();
  if (target) {
    await releaseAsset({ url: target.logo, publicId: target.logoPublicId }, (url) =>
      memoryStore.partners.some((partner) => partner.logo === url)
    );
  }
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
  if (!requireFields(res, {
    title: req.body.title,
    deadline: req.body.deadline,
    description: req.body.description,
    location: req.body.location,
  })) return;

  const pdf = optionalAsset(res, req.body, 'pdfFile', 'বিজ্ঞপ্তির PDF');
  if (!pdf.ok) return;

  const newCircular: CareerCircular = {
    id: 'car-' + Date.now(),
    title: req.body.title,
    deadline: req.body.deadline,
    description: req.body.description,
    location: req.body.location,
    vacancy: Number(req.body.vacancy || 1),
    pdfFile: pdf.asset?.url,
    pdfFilePublicId: pdf.asset?.publicId,
    isActive: toBool(req.body.isActive, true),
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

  const previous = memoryStore.careers[index];
  const pdf = optionalAsset(res, req.body, 'pdfFile', 'বিজ্ঞপ্তির PDF');
  if (!pdf.ok) return;

  const keep = <T>(value: unknown, fallback: T): T => (value === undefined ? fallback : (value as T));
  const next: CareerCircular = {
    ...previous,
    title: keep(req.body.title, previous.title),
    deadline: keep(req.body.deadline, previous.deadline),
    description: keep(req.body.description, previous.description),
    location: keep(req.body.location, previous.location),
    vacancy: Number(req.body.vacancy ?? previous.vacancy),
    isActive: toBool(req.body.isActive, previous.isActive),
    ...(pdf.asset
      ? { pdfFile: pdf.asset.url, pdfFilePublicId: pdf.asset.publicId }
      : 'pdfFile' in req.body
        ? { pdfFile: undefined, pdfFilePublicId: undefined }
        : {}),
    id,
  };

  memoryStore.careers[index] = next;
  persistStore();

  if (pdf.asset && pdf.asset.url !== previous.pdfFile) {
    await releaseAsset({ url: previous.pdfFile, publicId: previous.pdfFilePublicId }, (url) =>
      memoryStore.careers.some((circular) => circular.id !== id && circular.pdfFile === url)
    );
  }

  res.json(next);
};

export const deleteCareer = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.careers.find((c) => c.id === id);
  memoryStore.careers = memoryStore.careers.filter((c) => c.id !== id);
  persistStore();
  if (target?.pdfFile) {
    await releaseAsset({ url: target.pdfFile, publicId: target.pdfFilePublicId }, (url) =>
      memoryStore.careers.some((circular) => circular.pdfFile === url)
    );
  }
  res.json({ message: 'Career circular deleted' });
};

/**
 * Public job application. The CV is uploaded first (POST /api/uploads/cv, rate
 * limited), so this request is JSON only and carries the stored URL.
 */
export const applyJob = async (req: Request, res: Response) => {
  const cv = readAsset(req.body, 'cvFile');
  if (!cv) {
    return res.status(400).json({
      error: 'missing_cv',
      message: 'সিভি ফাইলটি আপলোড হয়নি। ফাইল বেছে নিয়ে আপলোড শেষ হওয়ার পর আবার জমা দিন।',
    });
  }

  const { careerId, name, email, phone, notes } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'missing_fields', message: 'নাম, ইমেইল ও মোবাইল নম্বর আবশ্যক।' });
  }

  const circular = memoryStore.careers.find((c) => c.id === careerId);

  const newApp: Application = {
    id: 'app-' + Date.now(),
    careerId,
    jobTitle: circular ? circular.title : 'General Application',
    name,
    email,
    phone,
    cvFile: cv.url,
    cvPublicId: cv.publicId,
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

export const deleteApplication = async (req: Request, res: Response) => {
  const { id } = req.params;
  const target = memoryStore.applications.find((a) => a.id === id);
  memoryStore.applications = memoryStore.applications.filter((a) => a.id !== id);
  persistStore();
  if (target?.cvFile) {
    await releaseAsset({ url: target.cvFile, publicId: target.cvPublicId }, (url) =>
      memoryStore.applications.some((application) => application.cvFile === url)
    );
  }
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
  const updatedData = { ...req.body } as Record<string, unknown>;

  // The logo is either a Cloudinary reference from /api/uploads/logo or the URL
  // the admin typed into the plain text field. An explicitly emptied field
  // clears the logo; anything that only LOOKS like a URL but is not one is a 400.
  const logo = readAsset(req.body, 'logoUrl') || readAsset(req.body, 'logo');
  const cleared = 'logoUrl' in req.body && String(req.body.logoUrl ?? '').trim() === '';
  if (logo) {
    updatedData.logoUrl = logo.url;
    updatedData.logoPublicId = logo.publicId;
  } else if (cleared) {
    updatedData.logoUrl = '';
    updatedData.logoPublicId = undefined;
  } else if ('logoUrl' in req.body || 'logo' in req.body) {
    return res.status(400).json({
      error: 'invalid_asset',
      message: 'লোগো ছবির ঠিকানা সঠিক নয়। ছবিটি আবার আপলোড করে তারপর সেভ করুন।',
    });
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

  const previousLogo = memoryStore.settings.logoUrl;
  const previousLogoPublicId = memoryStore.settings.logoPublicId;

  memoryStore.settings = {
    ...memoryStore.settings,
    ...(updatedData as Partial<SiteSettings>),
  };
  persistStore();

  if (logo && previousLogo && previousLogo !== logo.url) {
    await releaseAsset({ url: previousLogo, publicId: previousLogoPublicId }, (url) =>
      memoryStore.settings.logoUrl === url
    );
  }

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
