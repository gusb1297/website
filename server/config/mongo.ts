import mongoose from 'mongoose';

/**
 * MongoDB connection helpers.
 *
 * Admin accounts are the only data that lives in MongoDB. Site content is
 * still stored in data/store.json. A configured URI is not enough — the
 * process must actually be connected before login / bootstrap can run.
 */

let lastError: string | null = null;
let connecting: Promise<boolean> | null = null;

export type MongoState = 'connected' | 'not_configured' | 'unreachable';

export interface MongoStatus {
  configured: boolean;
  connected: boolean;
  state: MongoState;
  /** Safe, operator-facing hint (never includes credentials). */
  hint: string;
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function sanitizeMongoError(message: string): string {
  return message.replace(/mongodb(\+srv)?:\/\/\S+/gi, 'mongodb://***');
}

/** Connection string from the environment, or empty when unset. */
export function getMongoUri(): string {
  return stripWrappingQuotes(process.env.MONGODB_URI || '');
}

export function isMongoConfigured(): boolean {
  return getMongoUri().length > 0;
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getMongoLastError(): string | null {
  return lastError;
}

/**
 * True when the URI already names a database (`...mongodb.net/mydb?...`).
 * Atlas "connect" strings sometimes omit it, in which case mongoose would
 * otherwise write to the `test` database and the Atlas UI looks "empty".
 */
function uriHasDatabaseName(uri: string): boolean {
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//i, '');
    const slash = withoutProtocol.indexOf('/');
    if (slash === -1) return false;
    const db = withoutProtocol.slice(slash + 1).split('?')[0].trim();
    return db.length > 0;
  } catch {
    return false;
  }
}

export function getMongoDbName(): string {
  const fromEnv = stripWrappingQuotes(process.env.MONGODB_DB || '');
  return fromEnv || 'gusb';
}

export function describeMongoStatus(): MongoStatus {
  if (!isMongoConfigured()) {
    return {
      configured: false,
      connected: false,
      state: 'not_configured',
      hint:
        'MONGODB_URI is not set. Add the connection string to .env or your host’s environment variables. Do not create admin users in the MongoDB Atlas panel — passwords must be bcrypt-hashed by this app.',
    };
  }

  if (mongoose.connection.readyState === 1) {
    return {
      configured: true,
      connected: true,
      state: 'connected',
      hint: '',
    };
  }

  const detail = lastError ? ` Last error: ${sanitizeMongoError(lastError)}` : '';
  return {
    configured: true,
    connected: false,
    state: 'unreachable',
    hint:
      'MONGODB_URI is set but the database is not reachable. In Atlas: Network Access → allow this server’s IP (or 0.0.0.0/0 for testing); Database Access → username/password must match the URI (URL-encode special characters in the password).' +
      detail,
  };
}

export async function connectMongo(): Promise<boolean> {
  const uri = getMongoUri();
  if (!uri) {
    lastError = null;
    console.warn(
      '[mongo] MONGODB_URI is not set. Admin accounts live in MongoDB, so /admin cannot be used until it is configured.'
    );
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    lastError = null;
    return true;
  }

  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const options: mongoose.ConnectOptions = {
        serverSelectionTimeoutMS: 15000,
      };
      if (!uriHasDatabaseName(uri)) {
        options.dbName = getMongoDbName();
        console.log(`[mongo] URI has no database name — using "${options.dbName}"`);
      }

      await mongoose.connect(uri, options);
      lastError = null;
      const dbName = mongoose.connection.name;
      console.log(`[mongo] Connected (database: ${dbName}).`);
      return true;
    } catch (err) {
      lastError = (err as Error).message;
      console.error(
        '[mongo] Connection failed — admin login is disabled until it is reachable:',
        lastError
      );
      return false;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/**
 * Keep trying in the background so a temporary Atlas blip (or an IP
 * whitelist change) does not require a process restart.
 */
export function startMongoReconnectLoop(onReady?: () => void | Promise<void>): void {
  mongoose.connection.on('connected', () => {
    lastError = null;
    if (onReady) void onReady();
  });
  mongoose.connection.on('error', (err) => {
    lastError = err.message;
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[mongo] Disconnected.');
  });

  const timer = setInterval(() => {
    if (!isMongoConfigured()) return;
    const state = mongoose.connection.readyState;
    // 1 = connected, 2 = connecting
    if (state === 1 || state === 2) return;
    void connectMongo();
  }, 20000);
  timer.unref?.();
}
