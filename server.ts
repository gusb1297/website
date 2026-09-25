// Load .env before anything else so config modules (Cloudinary, JWT, Mongo)
// see the credentials on first use.
import 'dotenv/config';
// Cleans CLOUDINARY_URL before the Cloudinary SDK parses it (a quoted or
// otherwise malformed value used to crash the server on load).
import './server/config/cloudinaryEnv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import apiRouter from './server/routes/api';
import {
  ContentNotDurableError,
  describePersistenceStatus,
  flushStore,
  syncStoreWithDatabase,
} from './server/config/persistence';
import { connectMongo, isDatabaseReady, startMongoReconnectLoop } from './server/config/mongo';
import {
  autoRestoreIfEmpty,
  backupOnShutdown,
  describeBackupStatus,
  startBackupScheduler,
  stopBackupScheduler,
} from './server/services/backupService';
import { bootstrapAdminFromEnv } from './server/services/adminService';
import { getJwtSecret, isEphemeralHost } from './server/config/env';
import { StorageError, verifyStorageConnection } from './server/services/storage';
import { getHealth } from './server/controllers/storageController';
import { AmStorageError } from './server/services/amStorage';

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
  if (err instanceof ContentNotDurableError) {
    // The change was NOT saved: say so instead of returning a fake success.
    console.warn('[content] write refused:', err.message.split('\n')[0]);
    return res.status(503).json({ error: err.code, message: err.message });
  }

  if (err instanceof StorageError || err instanceof AmStorageError) {
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

/**
 * Load the site content from MongoDB and make sure the safety nets are in
 * place. Called on the first connection and after every reconnection.
 *
 *  1. read every collection into the in-memory store;
 *  2. if the database is empty, import the previous architecture's data
 *     (legacy `sitecontents` blob, then an old `data/store.json`);
 *  3. if it is *still* empty, restore the newest automatic snapshot — this is
 *     what turns "everything is gone after the update" into "the site came back
 *     on its own";
 *  4. start the snapshot scheduler and create the first admin account.
 */
async function bringContentOnline(): Promise<void> {
  if (!isDatabaseReady()) return;
  const report = await syncStoreWithDatabase();
  if (report.migratedFrom) {
    console.log(`[persistence] content imported from ${report.migratedFrom} into MongoDB collections.`);
  }
  if (report.empty) {
    const restored = await autoRestoreIfEmpty();
    if (restored) {
      console.warn(
        `[persistence] restored ${restored.totalItems} records from snapshot ${restored.id} (${restored.createdAt}).`
      );
    }
  }
  await bootstrapAdminFromEnv();
  if (!schedulerStarted) {
    schedulerStarted = true;
    startBackupScheduler();
  }
}

let schedulerStarted = false;

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

  // Fail fast when the JWT signing key is missing in production.
  getJwtSecret();

  /**
   * Admin accounts AND all site content live in MongoDB — every hero slide,
   * news item, photo, stat and setting is a document in its own collection.
   * Nothing is read from or written to the container's disk, so a deploy can
   * no longer wipe content.
   */
  const mongoOk = await connectMongo();
  if (mongoOk) {
    await bringContentOnline();
  } else {
    const where = isEphemeralHost()
      ? 'this host wipes its disk on every deploy'
      : 'only the running process holds any content';
    console.error(
      `[persistence] WARNING: MongoDB is not reachable and ${where} — every content edit will be refused ` +
        '(503) until MONGODB_URI works. Nothing is silently lost, but nothing can be saved either.'
    );
  }
  startMongoReconnectLoop(async () => {
    await bringContentOnline();
  });

  // File storage: Cloudinary is the only place media is kept. The connection
  // is checked in the background (it never delays the start) and re-checked
  // automatically after a failure; the result is logged and shown in the admin
  // banner. Media is never written to the local disk.
  void verifyStorageConnection();

  // Healthcheck endpoint (before the API router). Also reports whether
  // uploads and content edits are being stored durably.
  app.get('/api/health', getHealth);

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
    // Hashed bundles (/assets/index-<hash>.js) never change → cache for a year.
    // A missing bundle is a real 404, never index.html served as JavaScript.
    app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Not found');
    });
    // Other static files (favicon, robots.txt …) may change between deploys.
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    // SPA fallback for client-side routes. index.html must be revalidated on
    // every load: it used to be cached "immutable" for 7 days, so after a
    // deploy the admin panel kept running the previous build (stale fixes,
    // stale warnings) until the browser cache expired.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return next();
      }
      const indexHtml = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexHtml)) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  // 404 + error handlers (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    const content = describePersistenceStatus();
    const backup = describeBackupStatus();
    console.log(
      `Palli Unnayan Sangstha NGO Application running at http://0.0.0.0:${PORT} (${
        isProduction ? 'production' : 'development'
      })`
    );
    console.log(
      `[persistence] content: ${content.totalItems} records from ${content.source} — ` +
        `${content.durable ? 'durable in MongoDB' : 'NOT DURABLE'}` +
        `${content.hint ? ` (${content.hint})` : ''}`
    );
    console.log(
      `[backup] ${backup.enabled ? `enabled every ${backup.intervalMinutes} min, keeping ${backup.keep}` : 'disabled'}` +
        `${backup.lastBackupAt ? `, last snapshot ${backup.lastBackupAt}` : ', no snapshot yet'}`
    );
  });

  // Flush pending content changes to MongoDB and leave a final snapshot on a
  // graceful shutdown (a deploy, a restart) so nothing that was edited between
  // two scheduled backups can be lost.
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceExit = setTimeout(() => process.exit(0), 8000);
    forceExit.unref();
    void (async () => {
      try {
        await flushStore();
        await backupOnShutdown();
      } catch (err) {
        console.error('[persistence] Flush on shutdown failed:', err);
      } finally {
        stopBackupScheduler();
        process.exit(0);
      }
    })();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
