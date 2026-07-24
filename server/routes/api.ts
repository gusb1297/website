import { Router } from 'express';
import { upload } from '../config/multer';
import { authenticateJwt, requireAdmin } from '../middleware/auth';
import {
  login,
  getMe,
  uploadDirectFile,
  getHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  reorderHeroSlides,
  deleteHeroSlide,
  getPrograms,
  getProgramBySlug,
  createProgram,
  updateProgram,
  deleteProgram,
  getNews,
  getNewsBySlug,
  createNews,
  updateNews,
  deleteNews,
  getVideos,
  uploadVideo,
  embedVideo,
  streamVideo,
  deleteVideo,
  getNotices,
  createNotice,
  deleteNotice,
  getPublications,
  createPublication,
  deletePublication,
  getAlbums,
  createAlbum,
  getAlbumPhotos,
  addPhoto,
  getCommittee,
  createCommitteeMember,
  updateCommitteeMember,
  deleteCommitteeMember,
  getPartners,
  createPartner,
  deletePartner,
  getCareers,
  createCareer,
  applyJob,
  getApplications,
  getStats,
  updateStat,
  getSettings,
  updateSettings,
} from '../controllers/ngoControllers';

const router = Router();

// Auth
router.post('/auth/login', login);
router.get('/auth/me', authenticateJwt, getMe);

// Hero Slides
router.get('/hero-slides', getHeroSlides);
router.post('/hero-slides', authenticateJwt, upload.single('image'), createHeroSlide);
router.put('/hero-slides/reorder', authenticateJwt, reorderHeroSlides);
router.put('/hero-slides/:id', authenticateJwt, upload.single('image'), updateHeroSlide);
router.delete('/hero-slides/:id', authenticateJwt, deleteHeroSlide);

// Programs
router.get('/programs', getPrograms);
router.get('/programs/:slug', getProgramBySlug);
router.post('/programs', authenticateJwt, upload.single('coverImage'), createProgram);
router.put('/programs/:id', authenticateJwt, upload.single('coverImage'), updateProgram);
router.delete('/programs/:id', authenticateJwt, deleteProgram);

// News
router.get('/news', getNews);
router.get('/news/:slug', getNewsBySlug);
router.post('/news', authenticateJwt, upload.single('thumbnail'), createNews);
router.put('/news/:id', authenticateJwt, upload.single('thumbnail'), updateNews);
router.delete('/news/:id', authenticateJwt, deleteNews);

// Videos
router.get('/videos', getVideos);
router.post('/videos/upload', authenticateJwt, upload.single('video'), uploadVideo);
router.post('/videos/embed', authenticateJwt, embedVideo);
router.get('/videos/stream/:id', streamVideo);
router.delete('/videos/:id', authenticateJwt, deleteVideo);

// Notices
router.get('/notices', getNotices);
router.post('/notices', authenticateJwt, upload.single('pdfFile'), createNotice);
router.delete('/notices/:id', authenticateJwt, deleteNotice);

// Publications
router.get('/publications', getPublications);
router.post(
  '/publications',
  authenticateJwt,
  upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  createPublication
);
router.delete('/publications/:id', authenticateJwt, deletePublication);

// Gallery
router.get('/gallery/albums', getAlbums);
router.post('/gallery/albums', authenticateJwt, upload.single('coverImage'), createAlbum);
router.get('/gallery/albums/:id/photos', getAlbumPhotos);
router.post('/gallery/photos', authenticateJwt, upload.single('image'), addPhoto);

// Committee / Governance
router.get('/committee', getCommittee);
router.get('/committee/:type', getCommittee);
router.post('/committee', authenticateJwt, upload.single('photo'), createCommitteeMember);
router.put('/committee/:id', authenticateJwt, upload.single('photo'), updateCommitteeMember);
router.delete('/committee/:id', authenticateJwt, deleteCommitteeMember);

// Partners
router.get('/partners', getPartners);
router.post('/partners', authenticateJwt, upload.single('logo'), createPartner);
router.delete('/partners/:id', authenticateJwt, deletePartner);

// Career & Applications
router.get('/career', getCareers);
router.post('/career', authenticateJwt, upload.single('pdfFile'), createCareer);
router.post('/career/apply', upload.single('cvFile'), applyJob);
router.get('/career/applications', authenticateJwt, getApplications);

// Stats
router.get('/stats', getStats);
router.put('/stats/:id', authenticateJwt, updateStat);

// Direct File Upload (Cloudinary)
router.post('/upload', authenticateJwt, upload.single('file'), uploadDirectFile);

// Settings
router.get('/settings', getSettings);
router.put('/settings', authenticateJwt, upload.single('logo'), updateSettings);

export default router;
