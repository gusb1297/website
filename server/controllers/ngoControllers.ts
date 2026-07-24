import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { processVideoFile } from '../config/ffmpeg';
import { uploadToCloudinary } from '../config/cloudinary';
import { memoryStore } from '../models/schemas';
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
} from '../../src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'vdo_bogura_secret_key_2026';

// Direct File Upload (returns uploaded URL directly)
export const uploadDirectFile = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const url = await uploadToCloudinary(req.file.path, 'vdo_bogura');
    return res.json({ url });
  } catch (err: any) {
    console.error('Direct file upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
};

// 1. AUTH CONTROLLER
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Pre-configured admin check
  const validEmails = ['admin@vdobogura.org', 'admin@gusb.org', 'admin@palli-ngo.org', 'admin@gmail.com', 'admin'];
  const isAdmin =
    validEmails.includes(email.toLowerCase()) &&
    (password === 'admin123password' || password === 'admin' || password === 'admin123');

  if (isAdmin) {
    const token = jwt.sign(
      { id: 'admin-1', email, role: 'admin', name: 'NGO System Administrator' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      user: { id: 'admin-1', email, role: 'admin', name: 'NGO System Administrator' },
    });
  }

  return res.status(401).json({ error: 'invalid_credentials', message: 'অবৈধ ইমেইল অথবা পাসওয়ার্ড' });
};

export const getMe = async (req: any, res: Response) => {
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
  const newSlide: HeroSlide = {
    id: 'hs-' + Date.now(),
    image: imagePath || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80',
    headline: req.body.headline || 'নতুন শিরোনাম',
    subtext: req.body.subtext || 'সাবটেক্সট বিবরণ',
    buttonText: req.body.buttonText,
    buttonLink: req.body.buttonLink,
    order: memoryStore.heroSlides.length + 1,
    isActive: req.body.isActive !== 'false',
  };
  memoryStore.heroSlides.push(newSlide);
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
    order: Number(req.body.order ?? memoryStore.heroSlides[index].order),
    isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : memoryStore.heroSlides[index].isActive,
  };
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
  res.json(memoryStore.heroSlides);
};

export const deleteHeroSlide = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.heroSlides = memoryStore.heroSlides.filter((s) => s.id !== id);
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
  const slug = req.body.slug || (req.body.title ? req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'program-' + Date.now());
  const newProgram: Program = {
    id: 'prg-' + Date.now(),
    title: req.body.title,
    slug,
    icon: req.body.icon || 'Sprout',
    shortDesc: req.body.shortDesc,
    content: req.body.content,
    coverImage: coverImage || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
    status: req.body.status || 'ongoing',
    order: memoryStore.programs.length + 1,
    beneficiariesCount: Number(req.body.beneficiariesCount || 0),
    districtsCovered: Number(req.body.districtsCovered || 0),
  };
  memoryStore.programs.push(newProgram);
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
  };
  res.json(memoryStore.programs[index]);
};

export const deleteProgram = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.programs = memoryStore.programs.filter((p) => p.id !== id);
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
  res.json(news);
};

export const createNews = async (req: Request, res: Response) => {
  let thumbnail = req.body.thumbnail;
  if (req.file) {
    thumbnail = await uploadToCloudinary(req.file.path, 'vdo_bogura/news');
  }
  const slug = req.body.slug || (req.body.title ? req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'news-' + Date.now());
  const newNews: NewsItem = {
    id: 'news-' + Date.now(),
    title: req.body.title,
    slug,
    category: req.body.category || 'News',
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
    content: req.body.content,
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    views: 0,
    author: req.body.author || 'সিস্টেম অ্যাডমিন',
  };
  memoryStore.news.unshift(newNews);
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
  };
  res.json(memoryStore.news[index]);
};

export const deleteNews = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.news = memoryStore.news.filter((n) => n.id !== id);
  res.json({ message: 'News item deleted' });
};

// 5. VIDEO MANAGEMENT & STREAMING
export const getVideos = (req: Request, res: Response) => {
  const list = [...memoryStore.videos].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  res.json(list);
};

export const uploadVideo = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a video file' });
  }

  let filePath = `/uploads/videos/${req.file.filename}`;
  const absolutePath = path.join(process.cwd(), req.file.path);

  const { thumbnailPath, duration } = await processVideoFile(absolutePath);

  // If Cloudinary configured, upload video file
  filePath = await uploadToCloudinary(req.file.path, 'vdo_bogura/videos');

  const newVid: VideoItem = {
    id: 'vid-' + Date.now(),
    title: req.body.title || req.file.originalname,
    type: 'upload',
    filePath,
    thumbnail: thumbnailPath,
    duration,
    uploadedAt: new Date().toISOString(),
    category: req.body.category || 'General',
  };

  memoryStore.videos.unshift(newVid);
  res.status(201).json(newVid);
};

export const embedVideo = (req: Request, res: Response) => {
  const { title, embedUrl, thumbnail, category } = req.body;
  if (!title || !embedUrl) {
    return res.status(400).json({ error: 'Title and Embed URL are required' });
  }

  let finalEmbed = embedUrl;
  if (embedUrl.includes('watch?v=')) {
    finalEmbed = embedUrl.replace('watch?v=', 'embed/');
  }

  const newVid: VideoItem = {
    id: 'vid-' + Date.now(),
    title,
    type: 'embed',
    embedUrl: finalEmbed,
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
    duration: '05:00',
    uploadedAt: new Date().toISOString(),
    category: category || 'Highlight',
  };

  memoryStore.videos.unshift(newVid);
  res.status(201).json(newVid);
};

export const streamVideo = (req: Request, res: Response) => {
  const { id } = req.params;
  const video = memoryStore.videos.find((v) => v.id === id);
  if (!video || video.type !== 'upload' || !video.filePath) {
    return res.status(404).json({ error: 'Uploaded video not found' });
  }

  const absolutePath = path.join(process.cwd(), video.filePath);
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

export const deleteVideo = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.videos = memoryStore.videos.filter((v) => v.id !== id);
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
  const newNotice: Notice = {
    id: 'not-' + Date.now(),
    title: req.body.title,
    pdfFile: pdfFile || '/uploads/pdfs/sample_notice.pdf',
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    expiryDate: req.body.expiryDate,
    isActive: true,
    referenceNo: req.body.referenceNo || `VDO/NOT/${Date.now().toString().slice(-4)}`,
  };
  memoryStore.notices.unshift(newNotice);
  res.status(201).json(newNotice);
};

export const deleteNotice = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.notices = memoryStore.notices.filter((n) => n.id !== id);
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

  const newPub: Publication = {
    id: 'pub-' + Date.now(),
    title: req.body.title,
    type: req.body.type || 'annual_report',
    pdfFile: pdfFile || '/uploads/pdfs/sample_pub.pdf',
    year: Number(req.body.year || new Date().getFullYear()),
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
  };
  memoryStore.publications.unshift(newPub);
  res.status(201).json(newPub);
};

export const deletePublication = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.publications = memoryStore.publications.filter((p) => p.id !== id);
  res.json({ message: 'Publication deleted' });
};

// 8. GALLERY (Albums & Photos)
export const getAlbums = (req: Request, res: Response) => {
  res.json(memoryStore.galleryAlbums);
};

export const createAlbum = async (req: Request, res: Response) => {
  let coverImage = req.body.coverImage;
  if (req.file) {
    coverImage = await uploadToCloudinary(req.file.path, 'vdo_bogura/gallery');
  }
  const newAlbum: GalleryAlbum = {
    id: 'alb-' + Date.now(),
    title: req.body.title,
    coverImage: coverImage || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
    description: req.body.description,
    createdAt: new Date().toISOString(),
  };
  memoryStore.galleryAlbums.unshift(newAlbum);
  res.status(201).json(newAlbum);
};

export const getAlbumPhotos = (req: Request, res: Response) => {
  const { id } = req.params;
  const photos = memoryStore.galleryPhotos.filter((p) => p.albumId === id);
  res.json(photos);
};

export const addPhoto = async (req: Request, res: Response) => {
  let image = req.body.image;
  if (req.file) {
    image = await uploadToCloudinary(req.file.path, 'vdo_bogura/gallery');
  }
  const newPhoto: GalleryPhoto = {
    id: 'p-' + Date.now(),
    albumId: req.body.albumId,
    image: image || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
    caption: req.body.caption || '',
    uploadedAt: new Date().toISOString(),
  };
  memoryStore.galleryPhotos.push(newPhoto);
  res.status(201).json(newPhoto);
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
  const newMember: CommitteeMember = {
    id: 'com-' + Date.now(),
    name: req.body.name,
    designation: req.body.designation,
    type: req.body.type || 'executive',
    photo: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: req.body.bio || '',
    order: memoryStore.committee.length + 1,
    email: req.body.email,
    phone: req.body.phone,
  };
  memoryStore.committee.push(newMember);
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
  };
  res.json(memoryStore.committee[index]);
};

export const deleteCommitteeMember = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.committee = memoryStore.committee.filter((c) => c.id !== id);
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
  const newPartner: Partner = {
    id: 'part-' + Date.now(),
    name: req.body.name,
    logo: logo || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=200&q=80',
    websiteUrl: req.body.websiteUrl || '#',
  };
  memoryStore.partners.push(newPartner);
  res.status(201).json(newPartner);
};

export const deletePartner = (req: Request, res: Response) => {
  const { id } = req.params;
  memoryStore.partners = memoryStore.partners.filter((p) => p.id !== id);
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
  const newCircular: CareerCircular = {
    id: 'car-' + Date.now(),
    title: req.body.title,
    deadline: req.body.deadline,
    description: req.body.description,
    location: req.body.location || 'প্রধান কার্যালয় ও ফিল্ড শাখা',
    vacancy: Number(req.body.vacancy || 1),
    pdfFile,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  memoryStore.careers.unshift(newCircular);
  res.status(201).json(newCircular);
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
  res.status(201).json({ message: 'আপনার আবেদনপত্র সফলভাবে জমা হয়েছে। ধন্যবাদ!', application: newApp });
};

export const getApplications = (req: Request, res: Response) => {
  res.json(memoryStore.applications);
};

// 12. STATS & SETTINGS
export const getStats = (req: Request, res: Response) => {
  const stats = [...memoryStore.stats].sort((a, b) => a.order - b.order);
  res.json(stats);
};

export const updateStat = (req: Request, res: Response) => {
  const { id } = req.params;
  const index = memoryStore.stats.findIndex((s) => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Stat item not found' });

  memoryStore.stats[index] = {
    ...memoryStore.stats[index],
    ...req.body,
    value: Number(req.body.value ?? memoryStore.stats[index].value),
  };
  res.json(memoryStore.stats[index]);
};

export const getSettings = (req: Request, res: Response) => {
  res.json(memoryStore.settings);
};

export const updateSettings = async (req: Request, res: Response) => {
  let updatedData = { ...req.body };
  if (req.file) {
    updatedData.logoUrl = await uploadToCloudinary(req.file.path, 'vdo_bogura/settings');
  }
  memoryStore.settings = {
    ...memoryStore.settings,
    ...updatedData,
  };
  res.json(memoryStore.settings);
};
