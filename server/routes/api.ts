import { Router } from 'express';
import { receiveUpload, rejectMultipart, limitsForClient } from '../middleware/upload';
import { authenticateJwt, requireAdmin } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { discardAsset, respondWithAsset } from '../controllers/uploadController';

const loginRateLimiter = createRateLimit(20, 15 * 60 * 1000);
/** Anonymous visitors may only upload a CV, and only a handful of times. */
const publicUploadRateLimiter = createRateLimit(12, 30 * 60 * 1000);

import {
  login,
  authStatus,
  setupAdmin,
  getMe,
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

/* ---------------------------------------------------------------------------
 * FILE UPLOADS — the single door every media file goes through.
 *
 * The browser posts the raw file to one of these endpoints; it is streamed
 * straight to Cloudinary and the JSON response ({ url, public_id, … }) is what
 * the admin form then stores inside the record it is creating/editing.
 * No file is ever kept in the project folder.
 * ------------------------------------------------------------------------- */
router.post('/uploads/image', authenticateJwt, ...receiveUpload('image'), asyncHandler(respondWithAsset));
router.post('/uploads/logo', authenticateJwt, ...receiveUpload('logo'), asyncHandler(respondWithAsset));
router.post('/uploads/video', authenticateJwt, ...receiveUpload('video'), asyncHandler(respondWithAsset));
router.post('/uploads/document', authenticateJwt, ...receiveUpload('document'), asyncHandler(respondWithAsset));
// Applicants are not logged in, so their CV gets its own tightened endpoint.
router.post(
  '/uploads/cv',
  publicUploadRateLimiter,
  ...receiveUpload('cv'),
  asyncHandler(respondWithAsset)
);
// Ceilings for the pickers (sizes are enforced here, the UI only warns early).
router.get('/uploads/limits', (_req, res) => res.json(limitsForClient()));

// Uploaded but abandoned (admin pressed "remove" before saving) — clean it up.
router.post('/uploads/discard', authenticateJwt, asyncHandler(discardAsset));

/* ---------------------------------------------------------------------------
 * All content endpoints below are JSON-only now: the media file has already
 * been stored by /uploads/*, so a form submits its URL (+ publicId) instead of
 * a multipart body. `rejectMultipart` turns a stale cached bundle into a clear
 * message instead of a record saved with an empty image.
 * ------------------------------------------------------------------------- */

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
router.post('/hero-slides', authenticateJwt, rejectMultipart, asyncHandler(createHeroSlide));
router.put('/hero-slides/reorder', authenticateJwt, asyncHandler(reorderHeroSlides));
router.put('/hero-slides/:id', authenticateJwt, rejectMultipart, asyncHandler(updateHeroSlide));
router.delete('/hero-slides/:id', authenticateJwt, asyncHandler(deleteHeroSlide));

// Programs
router.get('/programs', asyncHandler(getPrograms));
router.get('/programs/:slug', asyncHandler(getProgramBySlug));
router.post('/programs', authenticateJwt, rejectMultipart, asyncHandler(createProgram));
router.put('/programs/:id', authenticateJwt, rejectMultipart, asyncHandler(updateProgram));
router.delete('/programs/:id', authenticateJwt, asyncHandler(deleteProgram));

// News
router.get('/news', asyncHandler(getNews));
router.get('/news/:slug', asyncHandler(getNewsBySlug));
router.post('/news', authenticateJwt, rejectMultipart, asyncHandler(createNews));
router.put('/news/:id', authenticateJwt, rejectMultipart, asyncHandler(updateNews));
router.delete('/news/:id', authenticateJwt, asyncHandler(deleteNews));

// Videos — device uploads arrive as an already-stored Cloudinary asset,
// links (YouTube / Vimeo) are parsed on the server.
router.get('/videos', asyncHandler(getVideos));
router.post('/videos', authenticateJwt, rejectMultipart, asyncHandler(createVideo));
router.put('/videos/:id', authenticateJwt, rejectMultipart, asyncHandler(updateVideo));
router.get('/videos/stream/:id', asyncHandler(streamVideo));
router.delete('/videos/:id', authenticateJwt, asyncHandler(deleteVideo));

// Notices
router.get('/notices', asyncHandler(getNotices));
router.post('/notices', authenticateJwt, rejectMultipart, asyncHandler(createNotice));
router.put('/notices/:id', authenticateJwt, rejectMultipart, asyncHandler(updateNotice));
router.delete('/notices/:id', authenticateJwt, asyncHandler(deleteNotice));

// Publications
router.get('/publications', asyncHandler(getPublications));
router.post('/publications', authenticateJwt, rejectMultipart, asyncHandler(createPublication));
router.put('/publications/:id', authenticateJwt, rejectMultipart, asyncHandler(updatePublication));
router.delete('/publications/:id', authenticateJwt, asyncHandler(deletePublication));

// Gallery
router.get('/gallery/albums', asyncHandler(getAlbums));
router.post('/gallery/albums', authenticateJwt, rejectMultipart, asyncHandler(createAlbum));
router.put('/gallery/albums/:id', authenticateJwt, rejectMultipart, asyncHandler(updateAlbum));
router.delete('/gallery/albums/:id', authenticateJwt, asyncHandler(deleteAlbum));
router.get('/gallery/albums/:id/photos', asyncHandler(getAlbumPhotos));
router.get('/gallery/photos', asyncHandler(getAllPhotos));
router.post('/gallery/albums/:id/photos', authenticateJwt, rejectMultipart, asyncHandler(addPhoto));
router.put('/gallery/photos/:id', authenticateJwt, asyncHandler(updatePhoto));
router.delete('/gallery/photos/:id', authenticateJwt, asyncHandler(deletePhoto));

// Committee / Governance
router.get('/committee', asyncHandler(getCommittee));
router.get('/committee/:type', asyncHandler(getCommittee));
router.post('/committee', authenticateJwt, rejectMultipart, asyncHandler(createCommitteeMember));
router.put('/committee/:id', authenticateJwt, rejectMultipart, asyncHandler(updateCommitteeMember));
router.delete('/committee/:id', authenticateJwt, asyncHandler(deleteCommitteeMember));

// Partners
router.get('/partners', asyncHandler(getPartners));
router.post('/partners', authenticateJwt, rejectMultipart, asyncHandler(createPartner));
router.put('/partners/:id', authenticateJwt, rejectMultipart, asyncHandler(updatePartner));
router.delete('/partners/:id', authenticateJwt, asyncHandler(deletePartner));

// Career & Applications
router.get('/career', asyncHandler(getCareers));
router.post('/career', authenticateJwt, rejectMultipart, asyncHandler(createCareer));
router.put('/career/:id', authenticateJwt, rejectMultipart, asyncHandler(updateCareer));
router.delete('/career/:id', authenticateJwt, asyncHandler(deleteCareer));
router.post('/career/apply', rejectMultipart, asyncHandler(applyJob));
router.get('/career/applications', authenticateJwt, asyncHandler(getApplications));
router.delete('/career/applications/:id', authenticateJwt, asyncHandler(deleteApplication));
// Backwards-compatible alias used by older admin builds
router.get('/career/applicants', authenticateJwt, asyncHandler(getApplications));

// Stats
router.get('/stats', asyncHandler(getStats));
router.post('/stats', authenticateJwt, asyncHandler(createStat));
router.put('/stats/:id', authenticateJwt, asyncHandler(updateStat));
router.delete('/stats/:id', authenticateJwt, asyncHandler(deleteStat));

// Settings (identity, contact, branch offices, social links, theme colors)
router.get('/settings', asyncHandler(getSettings));
router.put('/settings', authenticateJwt, requireAdmin, rejectMultipart, asyncHandler(updateSettings));

// Page content (Home & About editable copy)
router.get('/page-content', asyncHandler(getPageContent));
router.put('/page-content', authenticateJwt, requireAdmin, asyncHandler(updatePageContent));

export default router;
