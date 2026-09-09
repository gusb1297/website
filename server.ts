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
import { getJwtSecret, isEphemeralHost } from './server/config/env';
import { StorageError, describeStorageStatus, verifyStorageConnection } from './server/services/storage';

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

function errorHandler(err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) {
  // Upload refused because it could not be stored durably (no Cloudinary on an
  // ephemeral host, or Cloudinary rejected the file). This is an expected,
  // already-explained condition: log one line, not a stack trace.
  if (err instanceof StorageError) {
    console.warn('[upload] refused:', err.message.split('\n')[0]);
    return res.status(err.status).json({ error: err.code, message: err.message });
  }

  console.error('[server] Unhandled error:', err);

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
        message: 'একবারে একটি ফাইল আপলোড করা যাবে। এক এক করে ফাইল দিন।',
      });
    }
    return res.status(400).json({
      error: 'invalid_upload',
      message: 'ফাইল আপলোডের তথ্য সঠিক নয়। ফাইলটি আবার নির্বাচন করুন।',
    });
  }

  const status = (err as { status?: number }).status || 500;
  const rawMessage = (err as { message?: string }).message || 'Internal server error';
  if (status < 500) {
    console.warn(`[server] ${status} ${req.method} ${req.originalUrl}: ${rawMessage.split('\n')[0]}`);
    // Upload rejections carry a machine code + a user text: `invalid_file_type: …`
    const message = /^[a-z_]+: /.test(rawMessage) ? rawMessage.slice(rawMessage.indexOf(': ') + 2) : rawMessage;
    const code = (err as { code?: string }).code;
    return res.status(status).json({ error: code || 'invalid_upload', message });
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

  // Legacy files: records created before the Cloudinary migration may still
  // point at /uploads/*. Those are served read-only — nothing is ever written
  // here any more, every new upload goes straight to Cloudinary.
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath, { maxAge: isProduction ? '30d' : 0, immutable: isProduction }));
  }

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

  // File storage: Cloudinary is the only place media is kept. Verify the
  // credentials at boot so a typo shows up here instead of at the first upload.
  const cloudinaryOk = await verifyStorageConnection();
  if (!cloudinaryOk) {
    console.error(
      '[storage] WARNING: Cloudinary is not configured (or unreachable). Every image/video/PDF upload will be ' +
        'refused with a clear message until CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET ' +
        '(or CLOUDINARY_URL) are set. Local ./uploads storage has been removed on purpose: files written to an ' +
        'ephemeral host disappear on the next deploy.'
    );
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
        cloudName: storage.cloudName,
        folder: storage.folder,
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
