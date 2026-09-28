import mongoose from 'mongoose';

/**
 * MongoDB connection helpers.
 *
 * Admin accounts AND the whole site content live in MongoDB (one document per
 * record, see services/contentStore.ts). A configured URI is not enough — the
 * process must actually be connected before login / bootstrap / content
 * loading can run.
 */

let lastError: string | null = null;
let connecting: Promise<boolean> | null = null;

/**
 * Operator switch (the /hackeradmin console's "database" control).
 *
 * When an operator turns the database OFF, the whole app must behave exactly as
 * if MongoDB were unreachable: reads keep coming from the in-memory snapshot the
 * site is already serving, writes are refused, and admin sessions are frozen.
 * The switch is held in module state (so it applies instantly and even while
 * MongoDB is down) and mirrored into MongoDB by services/systemControl.ts so it
 * survives a restart.
 */
let operatorDisabled = false;
/** Moment the switch was flipped (ISO), for the console readout. */
let operatorDisabledAt: string | null = null;

export type MongoState = 'connected' | 'not_configured' | 'unreachable' | 'disabled';

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

/**
 * Test seam: lets the suite (scripts/smoke-test.ts) simulate "MongoDB is
 * reachable / unreachable" without a real server. Production never touches it.
 */
let readyOverride: (() => boolean) | null = null;

export function setDatabaseReadyOverride(override: (() => boolean) | null): void {
  readyOverride = override;
}

export function isDatabaseReady(): boolean {
  if (operatorDisabled) return false;
  return readyOverride ? readyOverride() : mongoose.connection.readyState === 1;
}

/** True when an operator switched the database off from /hackeradmin. */
export function isDatabaseOperatorDisabled(): boolean {
  return operatorDisabled;
}

export function databaseDisabledAt(): string | null {
  return operatorDisabledAt;
}

/**
 * Flip the operator switch without touching the connection (used at boot, right
 * after the persisted value is read).
 */
export function noteDatabaseOperatorSwitch(disabled: boolean): void {
  operatorDisabled = disabled;
  operatorDisabledAt = disabled ? new Date().toISOString() : null;
}

/**
 * Turn the database off: the connection is dropped so nothing can be written
 * behind the operator's back. Serving continues from the in-memory snapshot.
 */
export async function disableDatabase(): Promise<void> {
  operatorDisabled = true;
  operatorDisabledAt = new Date().toISOString();
  try {
    await mongoose.disconnect();
    console.warn('[mongo] Database turned OFF by the operator — content is served from memory and writes are refused.');
  } catch (err) {
    console.warn('[mongo] Disconnect while switching the database off failed:', (err as Error).message);
  }
}

/** Turn the database back on and reconnect immediately. */
export async function enableDatabase(): Promise<boolean> {
  operatorDisabled = false;
  operatorDisabledAt = null;
  const ok = await connectMongo();
  console.log(`[mongo] Database turned ON by the operator — ${ok ? 'connected' : 'NOT reachable yet (retrying)'}.`);
  return ok;
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
  if (operatorDisabled) {
    return {
      configured: isMongoConfigured(),
      connected: false,
      state: 'disabled',
      hint:
        'ডাটাবেস অপারেটর কর্তৃক বন্ধ করা হয়েছে (/hackeradmin → System Control)। কন্টেন্ট মেমরি থেকে পরিবেশন হচ্ছে এবং কোনো পরিবর্তন সংরক্ষিত হচ্ছে না; আবার চালু করলেই স্বাভাবিক হয়ে যাবে।',
    };
  }

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

  // The operator switched the database off from /hackeradmin: never reconnect
  // behind their back (the reconnect loop calls this function too).
  if (operatorDisabled) return false;

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
    // Never reconnect while the /hackeradmin operator switch is off.
    if (operatorDisabled) return;
    const state = mongoose.connection.readyState;
    // 1 = connected, 2 = connecting
    if (state === 1 || state === 2) return;
    void connectMongo();
  }, 20000);
  timer.unref?.();
}
