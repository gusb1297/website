import { Router } from 'express';
import { upload } from '../config/multer';
import { authenticateJwt, requireAdmin } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';

const loginRateLimiter = createRateLimit(20, 15 * 60 * 1000);
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
  createVideo,
  updateVideo,
  uploadVideo,
  embedVideo,
  streamVideo,
  deleteVideo,
  getNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  getPublications,
  createPublication,
  updatePublication,
  deletePublication,
  getAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  getAlbumPhotos,
  getAllPhotos,
  addPhoto,
  updatePhoto,
  deletePhoto,
  getCommittee,
  createCommitteeMember,
  updateCommitteeMember,
  deleteCommitteeMember,
  getPartners,
  createPartner,
  updatePartner,
  deletePartner,
  getCareers,
  createCareer,
  updateCareer,
  deleteCareer,
  applyJob,
  getApplications,
  deleteApplication,
  getStats,
  createStat,
  updateStat,
  deleteStat,
  getSettings,
  updateSettings,
  getPageContent,
  updatePageContent,
} from '../controllers/ngoControllers';

const router = Router();

// Auth
router.post('/auth/login', loginRateLimiter, login);
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

// Videos — two-way upload:
//   * multipart with `videoFile` → device upload (Cloudinary when configured)
//   * body/field `embedUrl` (or `youtubeUrl`) → YouTube / Vimeo link
const videoUploadFields = upload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

router.get('/videos', getVideos);
router.post('/videos', authenticateJwt, videoUploadFields, createVideo);
router.put('/videos/:id', authenticateJwt, upload.single('thumbnail'), updateVideo);
// Legacy endpoints (kept so older admin builds keep working)
router.post('/videos/upload', authenticateJwt, videoUploadFields, uploadVideo);
router.post('/videos/embed', authenticateJwt, embedVideo);
router.get('/videos/stream/:id', streamVideo);
router.delete('/videos/:id', authenticateJwt, deleteVideo);

// Notices
router.get('/notices', getNotices);
router.post('/notices', authenticateJwt, upload.single('pdfFile'), createNotice);
router.put('/notices/:id', authenticateJwt, upload.single('pdfFile'), updateNotice);
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
router.put('/publications/:id', authenticateJwt, upload.single('pdfFile'), updatePublication);
router.delete('/publications/:id', authenticateJwt, deletePublication);

// Gallery
router.get('/gallery/albums', getAlbums);
router.post('/gallery/albums', authenticateJwt, upload.single('coverImage'), createAlbum);
router.put('/gallery/albums/:id', authenticateJwt, upload.single('coverImage'), updateAlbum);
router.delete('/gallery/albums/:id', authenticateJwt, deleteAlbum);
router.get('/gallery/albums/:id/photos', getAlbumPhotos);
router.get('/gallery/photos', getAllPhotos);
router.post('/gallery/albums/:id/photos', authenticateJwt, upload.single('image'), addPhoto);
router.put('/gallery/photos/:id', authenticateJwt, updatePhoto);
router.delete('/gallery/photos/:id', authenticateJwt, deletePhoto);

// Committee / Governance
router.get('/committee', getCommittee);
router.get('/committee/:type', getCommittee);
router.post('/committee', authenticateJwt, upload.single('photo'), createCommitteeMember);
router.put('/committee/:id', authenticateJwt, upload.single('photo'), updateCommitteeMember);
router.delete('/committee/:id', authenticateJwt, deleteCommitteeMember);

// Partners
router.get('/partners', getPartners);
router.post('/partners', authenticateJwt, upload.single('logo'), createPartner);
router.put('/partners/:id', authenticateJwt, upload.single('logo'), updatePartner);
router.delete('/partners/:id', authenticateJwt, deletePartner);

// Career & Applications
router.get('/career', getCareers);
router.post('/career', authenticateJwt, upload.single('pdfFile'), createCareer);
router.put('/career/:id', authenticateJwt, upload.single('pdfFile'), updateCareer);
router.delete('/career/:id', authenticateJwt, deleteCareer);
router.post('/career/apply', upload.single('cvFile'), applyJob);
router.get('/career/applications', authenticateJwt, getApplications);
router.delete('/career/applications/:id', authenticateJwt, deleteApplication);
// Backwards-compatible alias used by older admin builds
router.get('/career/applicants', authenticateJwt, getApplications);

// Stats
router.get('/stats', getStats);
router.post('/stats', authenticateJwt, createStat);
router.put('/stats/:id', authenticateJwt, updateStat);
router.delete('/stats/:id', authenticateJwt, deleteStat);

// Direct File Upload (Cloudinary)
router.post('/upload', authenticateJwt, upload.single('file'), uploadDirectFile);

// Settings (identity, contact, branch offices, social links, theme colors)
router.get('/settings', getSettings);
router.put('/settings', authenticateJwt, requireAdmin, upload.single('logo'), updateSettings);

// Page content (Home & About editable copy)
router.get('/page-content', getPageContent);
router.put('/page-content', authenticateJwt, requireAdmin, updatePageContent);

export default router;
