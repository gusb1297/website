import crypto from 'crypto';

/**
 * Runtime configuration helpers.
 *
 * No credential in this project has a hard-coded fallback: the JWT secret must
 * be supplied through the environment. In development a random per-boot secret
 * is generated (which simply invalidates old sessions on restart) so nobody can
 * sign a token with a well-known key.
 */
let cachedJwtSecret: string | null = null;

export const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * True when the process runs on a PaaS whose local disk is thrown away on
 * every deploy / restart (Render, Heroku, Railway, Fly.io, Vercel, …).
 * Anything written to `data/` or `uploads/` on such a host is lost.
 */
export function isEphemeralHost(): boolean {
  return Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.DYNO ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME ||
      process.env.VERCEL ||
      process.env.KOYEB_APP_NAME
  );
}

export function getJwtSecret(): string {
  if (cachedJwtSecret) return cachedJwtSecret;

  const fromEnv = (process.env.JWT_SECRET || '').trim();
  if (fromEnv.length >= 16) {
    cachedJwtSecret = fromEnv;
    return cachedJwtSecret;
  }

  if (isProduction()) {
    throw new Error(
      'JWT_SECRET is missing or too short. Set a random string of at least 16 characters before starting the server in production.'
    );
  }

  cachedJwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn(
    '[auth] JWT_SECRET is not set - generated a temporary development secret. Sessions are invalidated on every restart.'
  );
  return cachedJwtSecret;
}
