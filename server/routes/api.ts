import { Router } from 'express';
import { galleryUpload, MAX_GALLERY_FILES, upload } from '../config/multer';
import { authenticateJwt, requireAdmin } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

const loginRateLimiter = createRateLimit(20, 15 * 60 * 1000);
import {
  login,
  authStatus,
  setupAdmin,
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
import { getAdmins, postAdmin, putAdmin, removeAdmin } from '../controllers/adminControllers';

const router = Router();

// Auth
router.get('/auth/status', asyncHandler(authStatus));
router.post('/auth/setup', loginRateLimiter, asyncHandler(setupAdmin));
router.post('/auth/login', loginRateLimiter, asyncHandler(login));
router.get('/auth/me', authenticateJwt, asyncHandler(getMe));

// Admin user management (MongoDB backed, admins only)
router.get('/admins', authenticateJwt, requireAdmin, asyncHandler(getAdmins));
router.post('/admins', authenticateJwt, requireAdmin, asyncHandler(postAdmin));
router.put('/admins/:id', authenticateJwt, requireAdmin, asyncHandler(putAdmin));
router.delete('/admins/:id', authenticateJwt, requireAdmin, asyncHandler(removeAdmin));

// Hero Slides
router.get('/hero-slides', asyncHandler(getHeroSlides));
router.post('/hero-slides', authenticateJwt, upload.single('image'), asyncHandler(createHeroSlide));
router.put('/hero-slides/reorder', authenticateJwt, asyncHandler(reorderHeroSlides));
router.put('/hero-slides/:id', authenticateJwt, upload.single('image'), asyncHandler(updateHeroSlide));
router.delete('/hero-slides/:id', authenticateJwt, asyncHandler(deleteHeroSlide));

// Programs
router.get('/programs', asyncHandler(getPrograms));
router.get('/programs/:slug', asyncHandler(getProgramBySlug));
router.post('/programs', authenticateJwt, upload.single('coverImage'), asyncHandler(createProgram));
router.put('/programs/:id', authenticateJwt, upload.single('coverImage'), asyncHandler(updateProgram));
router.delete('/programs/:id', authenticateJwt, asyncHandler(deleteProgram));

// News
router.get('/news', asyncHandler(getNews));
router.get('/news/:slug', asyncHandler(getNewsBySlug));
router.post('/news', authenticateJwt, upload.single('thumbnail'), asyncHandler(createNews));
router.put('/news/:id', authenticateJwt, upload.single('thumbnail'), asyncHandler(updateNews));
router.delete('/news/:id', authenticateJwt, asyncHandler(deleteNews));

// Videos — two-way upload:
//   * multipart with `videoFile` → device upload (Cloudinary when configured)
//   * body/field `embedUrl` (or `youtubeUrl`) → YouTube / Vimeo link
const videoUploadFields = upload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

router.get('/videos', asyncHandler(getVideos));
router.post('/videos', authenticateJwt, videoUploadFields, asyncHandler(createVideo));
router.put('/videos/:id', authenticateJwt, upload.single('thumbnail'), asyncHandler(updateVideo));
// Legacy endpoints (kept so older admin builds keep working)
router.post('/videos/upload', authenticateJwt, videoUploadFields, asyncHandler(uploadVideo));
router.post('/videos/embed', authenticateJwt, asyncHandler(embedVideo));
router.get('/videos/stream/:id', asyncHandler(streamVideo));
router.delete('/videos/:id', authenticateJwt, asyncHandler(deleteVideo));

// Notices
router.get('/notices', asyncHandler(getNotices));
router.post('/notices', authenticateJwt, upload.single('pdfFile'), asyncHandler(createNotice));
router.put('/notices/:id', authenticateJwt, upload.single('pdfFile'), asyncHandler(updateNotice));
router.delete('/notices/:id', authenticateJwt, asyncHandler(deleteNotice));

// Publications
router.get('/publications', asyncHandler(getPublications));
router.post(
  '/publications',
  authenticateJwt,
  upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  asyncHandler(createPublication)
);
router.put('/publications/:id', authenticateJwt, upload.single('pdfFile'), asyncHandler(updatePublication));
router.delete('/publications/:id', authenticateJwt, asyncHandler(deletePublication));

// Gallery — strict image-only multipart handling. The legacy `coverImage` and
// `image` field names remain accepted while the current UI can send batches.
router.get('/gallery/albums', asyncHandler(getAlbums));
router.post(
  '/gallery/albums',
  authenticateJwt,
  galleryUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'photos', maxCount: MAX_GALLERY_FILES },
  ]),
  asyncHandler(createAlbum)
);
router.put('/gallery/albums/:id', authenticateJwt, galleryUpload.single('coverImage'), asyncHandler(updateAlbum));
router.delete('/gallery/albums/:id', authenticateJwt, asyncHandler(deleteAlbum));
router.get('/gallery/albums/:id/photos', asyncHandler(getAlbumPhotos));
router.get('/gallery/photos', asyncHandler(getAllPhotos));
router.post(
  '/gallery/albums/:id/photos',
  authenticateJwt,
  galleryUpload.fields([
    { name: 'image', maxCount: MAX_GALLERY_FILES },
    { name: 'images', maxCount: MAX_GALLERY_FILES },
  ]),
  asyncHandler(addPhoto)
);
router.put('/gallery/photos/:id', authenticateJwt, asyncHandler(updatePhoto));
router.delete('/gallery/photos/:id', authenticateJwt, asyncHandler(deletePhoto));

// Committee / Governance
router.get('/committee', asyncHandler(getCommittee));
router.get('/committee/:type', asyncHandler(getCommittee));
router.post('/committee', authenticateJwt, upload.single('photo'), asyncHandler(createCommitteeMember));
router.put('/committee/:id', authenticateJwt, upload.single('photo'), asyncHandler(updateCommitteeMember));
router.delete('/committee/:id', authenticateJwt, asyncHandler(deleteCommitteeMember));

// Partners
router.get('/partners', asyncHandler(getPartners));
router.post('/partners', authenticateJwt, upload.single('logo'), asyncHandler(createPartner));
router.put('/partners/:id', authenticateJwt, upload.single('logo'), asyncHandler(updatePartner));
router.delete('/partners/:id', authenticateJwt, asyncHandler(deletePartner));

// Career & Applications
router.get('/career', asyncHandler(getCareers));
router.post('/career', authenticateJwt, upload.single('pdfFile'), asyncHandler(createCareer));
router.put('/career/:id', authenticateJwt, upload.single('pdfFile'), asyncHandler(updateCareer));
router.delete('/career/:id', authenticateJwt, asyncHandler(deleteCareer));
router.post('/career/apply', upload.single('cvFile'), asyncHandler(applyJob));
router.get('/career/applications', authenticateJwt, asyncHandler(getApplications));
router.delete('/career/applications/:id', authenticateJwt, asyncHandler(deleteApplication));
// Backwards-compatible alias used by older admin builds
router.get('/career/applicants', authenticateJwt, asyncHandler(getApplications));

// Stats
router.get('/stats', asyncHandler(getStats));
router.post('/stats', authenticateJwt, asyncHandler(createStat));
router.put('/stats/:id', authenticateJwt, asyncHandler(updateStat));
router.delete('/stats/:id', authenticateJwt, asyncHandler(deleteStat));

// Direct File Upload (Cloudinary)
router.post('/upload', authenticateJwt, upload.single('file'), asyncHandler(uploadDirectFile));

// Settings (identity, contact, branch offices, social links, theme colors)
router.get('/settings', asyncHandler(getSettings));
router.put('/settings', authenticateJwt, requireAdmin, upload.single('logo'), asyncHandler(updateSettings));

// Page content (Home & About editable copy)
router.get('/page-content', asyncHandler(getPageContent));
router.put('/page-content', authenticateJwt, requireAdmin, asyncHandler(updatePageContent));

export default router;
