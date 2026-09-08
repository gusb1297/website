// Load .env before anything else so config modules (Cloudinary, JWT, Mongo)
// see the credentials on first use.
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import apiRouter from './server/routes/api';
import {
  loadStore,
  flushStore,
  syncStoreWithDatabase,
  describePersistenceStatus,
} from './server/config/persistence';
import { connectMongo, describeMongoStatus, startMongoReconnectLoop } from './server/config/mongo';
import { bootstrapAdminFromEnv } from './server/services/adminService';
import { getJwtSecret, isCloudStorageRequired, isEphemeralHost } from './server/config/env';
import { StorageError, describeStorageStatus, verifyCloudinaryConnection } from './server/config/cloudinary';

const isProduction = process.env.NODE_ENV === 'production';

/** Minimal production-grade security headers (no external dependency). */
function securityHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/** JSON error responses for malformed bodies / multer rejections. */
function notFoundHandler(req: express.Request, res: express.Response) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // SPA fallback is registered for non-API paths earlier in the stack.
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) {
  console.error('[server] Unhandled error:', err);

  // Upload refused because it could not be stored durably (no Cloudinary on an
  // ephemeral host, or Cloudinary rejected the file). Tell the admin exactly why.
  if (err instanceof StorageError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'file_too_large',
        message: 'ফাইলটি নির্ধারিত সীমার চেয়ে বড়। ছোট আকারের ফাইল নির্বাচন করুন।',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'too_many_files',
        message: 'একবারে অনুমোদিত সংখ্যার চেয়ে বেশি ফাইল নির্বাচন করা হয়েছে।',
      });
    }
    return res.status(400).json({
      error: 'invalid_upload',
      message: 'ফাইল আপলোডের তথ্য সঠিক নয়। ফাইলগুলো আবার নির্বাচন করুন।',
    });
  }

  const status = (err as { status?: number }).status || 500;
  const rawMessage = (err as { message?: string }).message || 'Internal server error';
  if (status < 500) {
    const message = rawMessage.startsWith('invalid_image_type:')
      ? 'শুধু JPG, JPEG, PNG, WEBP অথবা GIF ছবি আপলোড করা যাবে।'
      : rawMessage;
    return res.status(status).json({ error: 'invalid_upload', message });
  }
  res.status(500).json({ error: 'Internal server error', message: 'সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।' });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable('x-powered-by');
  app.use(securityHeaders);

  // JSON & URL Encoded parsing (size-capped for safety)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Static uploads directory
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsPath, { maxAge: isProduction ? '7d' : 0 }));

  // Warm the in-memory store from the local JSON cache first (instant boot);
  // MongoDB — the source of truth — is layered on top right after connecting.
  const loaded = loadStore();
  if (loaded) {
    console.log('Loaded cached content from data/store.json');
  } else {
    console.log('No local content cache found (data/store.json).');
  }

  // Fail fast when the JWT signing key is missing in production.
  getJwtSecret();

  // Admin accounts AND all site content live in MongoDB. Without a connection
  // nobody can sign in to the admin panel (there are no fallback / demo
  // credentials by design) and content edits would only reach the local disk.
  const mongoOk = await connectMongo();
  if (mongoOk) {
    await syncStoreWithDatabase();
    await bootstrapAdminFromEnv();
  } else if (isEphemeralHost()) {
    console.error(
      '[persistence] WARNING: MongoDB is not connected and this host wipes its disk on every deploy — ' +
        'admin content will NOT survive the next deploy until MONGODB_URI works.'
    );
  }
  startMongoReconnectLoop(async () => {
    await syncStoreWithDatabase();
    await bootstrapAdminFromEnv();
  });

  // File storage: Cloudinary keeps uploads across deploys. Verify the
  // credentials at boot so a typo shows up here instead of at the first upload.
  const cloudinaryOk = await verifyCloudinaryConnection();
  if (!cloudinaryOk) {
    if (isCloudStorageRequired()) {
      console.error(
        '[storage] WARNING: Cloudinary is not configured (or unreachable). Image/PDF/video uploads will be ' +
          'REFUSED with a clear error, because files written to this server\'s local disk are deleted on every ' +
          'deploy/restart. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
      );
    } else {
      console.warn('[storage] Cloudinary is not configured — uploads are kept on the local disk (development mode).');
    }
  }

  // Healthcheck endpoint (before the API router). Also reports whether
  // uploads and content edits are being stored durably.
  app.get('/api/health', (req, res) => {
    const mongo = describeMongoStatus();
    const storage = describeStorageStatus();
    const content = describePersistenceStatus();
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      mongo: { configured: mongo.configured, connected: mongo.connected, state: mongo.state },
      storage: {
        provider: storage.provider,
        configured: storage.configured,
        durable: storage.durable,
        cloudRequired: storage.cloudRequired,
        ephemeralHost: storage.ephemeralHost,
        cloudName: storage.cloudName,
        lastCheck: storage.lastCheck,
        hint: storage.hint,
      },
      content: {
        source: content.source,
        durable: content.durable,
        lastSavedAt: content.lastDbSaveAt,
        hint: content.hint,
      },
    });
  });

  // API Routes
  app.use('/api', apiRouter);
  // Unknown API endpoints get a JSON 404 (before Vite's SPA fallback in dev).
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Vite middleware for Development / Production static files.
  // Vite is imported dynamically so the production bundle never requires
  // the dev-only package (keeps `npm install --omit=dep` deploys working).
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '7d', immutable: true }));
    // SPA fallback for client-side routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return next();
      }
      const indexHtml = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexHtml)) {
        return next();
      }
      res.sendFile(indexHtml);
    });
  }

  // 404 + error handlers (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Palli Unnayan Sangstha NGO Application running at http://0.0.0.0:${PORT} (${
        isProduction ? 'production' : 'development'
      })`
    );
  });

  // Flush pending content changes (file cache + MongoDB) on shutdown
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceExit = setTimeout(() => process.exit(0), 5000);
    forceExit.unref();
    flushStore()
      .catch((err) => console.error('[persistence] Flush on shutdown failed:', err))
      .finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
