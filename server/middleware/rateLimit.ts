import express from 'express';

/**
 * Simple in-memory sliding-window rate limiter (per IP).
 * Used to protect the login endpoint from brute force.
 */
export function createRateLimit(maxAttempts = 20, windowMs = 15 * 60 * 1000) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Periodically drop stale entries so the map cannot grow unbounded.
  const sweep = setInterval(() => {
    const now = Date.now();
    hits.forEach((entry, key) => {
      if (now > entry.resetAt) hits.delete(key);
    });
  }, 5 * 60 * 1000);
  sweep.unref?.();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxAttempts) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}
