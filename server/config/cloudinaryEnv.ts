/**
 * Cloudinary credentials — read, clean up and explain.
 * ---------------------------------------------------------------------------
 * Why this module exists
 *
 *   The admin panel kept saying "Cloudinary-র সাথে সংযোগ ব্যর্থ" (and every
 *   upload failed) while the cloud name / API key / API secret looked perfectly
 *   right in the hosting panel. The values used to be handed to the SDK
 *   byte-for-byte, so whatever a hosting panel or a copy-paste adds around them
 *   — "quotes", a trailing space or newline, a trailing comma, an invisible
 *   zero-width character, or the whole `CLOUDINARY_API_KEY=…` line pasted into
 *   the value box — made Cloudinary answer "Invalid cloud_name",
 *   "Unknown API key" or "Invalid Signature". None of those characters can ever
 *   be part of a real Cloudinary credential, so they are stripped here and
 *   reported (so the admin can tidy the variable up), instead of failing.
 *
 *   It also accepts a few common alternative variable names, merges
 *   CLOUDINARY_URL with the separate variables field by field, and says exactly
 *   WHICH variable is missing instead of a generic "not configured".
 *
 * Side effect on import (intentional, keep this module imported BEFORE the
 * `cloudinary` package — see server.ts and services/storage.ts):
 *
 *   The Cloudinary SDK parses CLOUDINARY_URL the moment it is loaded and throws
 *   on anything that does not start with `cloudinary://` — a quoted or
 *   space-prefixed CLOUDINARY_URL used to crash the whole website at boot. The
 *   variable is cleaned (or removed when unusable) before the SDK can see it.
 *
 * Nothing in here ever logs or returns the API secret.
 */
// Load .env first: the guard below runs on import, and a bundler may place this
// module ahead of server.ts's own `import 'dotenv/config'`. Loading twice is a
// no-op (dotenv never overrides variables that are already set).
import 'dotenv/config';

export type CredentialField = 'cloudName' | 'apiKey' | 'apiSecret';

export type CredentialNoticeKind =
  /* auto-corrected, the cleaned value is used */
  | 'quotes'
  | 'whitespace'
  | 'inner_whitespace'
  | 'invisible'
  | 'name_prefix'
  | 'trailing_punctuation'
  | 'extracted'
  /* informational */
  | 'alias'
  | 'conflict'
  /* the value is very likely wrong */
  | 'placeholder'
  | 'format'
  | 'url_invalid';

export interface CredentialNotice {
  /** Environment variable the notice is about. */
  variable: string;
  kind: CredentialNoticeKind;
  /** `info` = auto-corrected / FYI, `warn` = probably wrong, `error` = certainly wrong. */
  severity: 'info' | 'warn' | 'error';
  /** Bengali, safe to show in the admin panel (never contains the secret). */
  message: string;
}

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** All three values are present (after clean-up). */
  complete: boolean;
  /** Env variable each value was read from (`CLOUDINARY_URL` for the URL), null when missing. */
  sources: Record<CredentialField, string | null>;
  missing: CredentialField[];
  notices: CredentialNotice[];
}

interface FieldSpec {
  field: CredentialField;
  /** The documented variable name. */
  primary: string;
  /** Other names people commonly use (tutorials, older versions of this site…). */
  aliases: string[];
  /** Human label used in messages. */
  label: string;
}

export const CLOUDINARY_FIELDS: FieldSpec[] = [
  {
    field: 'cloudName',
    primary: 'CLOUDINARY_CLOUD_NAME',
    aliases: ['CLOUDINARY_NAME', 'CLOUDINARY_CLOUDNAME', 'CLOUDINARY_CLOUD', 'CLOUD_NAME', 'VITE_CLOUDINARY_CLOUD_NAME'],
    label: 'Cloud name',
  },
  {
    field: 'apiKey',
    primary: 'CLOUDINARY_API_KEY',
    aliases: ['CLOUDINARY_KEY', 'CLOUDINARY_APIKEY', 'VITE_CLOUDINARY_API_KEY'],
    label: 'API key',
  },
  {
    field: 'apiSecret',
    primary: 'CLOUDINARY_API_SECRET',
    aliases: ['CLOUDINARY_SECRET', 'CLOUDINARY_APISECRET', 'CLOUDINARY_SECRET_KEY', 'CLOUDINARY_API_SECRET_KEY'],
    label: 'API secret',
  },
];

const URL_VAR = 'CLOUDINARY_URL';
const ACCOUNT_URL_VAR = 'CLOUDINARY_ACCOUNT_URL';

const KNOWN_NAMES = new Set<string>([
  URL_VAR,
  ACCOUNT_URL_VAR,
  ...CLOUDINARY_FIELDS.flatMap((spec) => [spec.primary, ...spec.aliases]),
]);

/** Documented variable name of a field (for "set CLOUDINARY_API_SECRET" style hints). */
export function primaryVariable(field: CredentialField): string {
  return CLOUDINARY_FIELDS.find((spec) => spec.field === field)!.primary;
}

/* ── value clean-up ─────────────────────────────────────────────────────── */

// Two copies on purpose: `.test()` on a /g regex is stateful (lastIndex).
const HAS_INVISIBLE_CHAR = /[\u200B-\u200D\u2060\uFEFF\u00AD]/;
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const QUOTE_CHARS = `'"\`\u2018\u2019\u201C\u201D`;
const LEADING_QUOTES = new RegExp(`^[${QUOTE_CHARS}]+`);
const TRAILING_QUOTES = new RegExp(`[${QUOTE_CHARS}]+$`);
const PLACEHOLDER =
  /<[^>]*>|\byour[_\s-]*(?:api[_\s-]*)?(?:key|secret|cloud(?:[_\s-]*name)?)\b|^\*{3,}$|^x{4,}$|^(?:changeme|change_me|placeholder|todo|xxx+)$/i;
const EMPTY_WORDS = /^(?:undefined|null|none|nil|false)$/i;

interface CleanResult {
  value: string;
  fixes: CredentialNoticeKind[];
}

/**
 * Remove everything that cannot be part of a Cloudinary credential but tends
 * to sneak into environment variables. `token` = the value is a single
 * key/secret/cloud name, so inner whitespace is removed too.
 */
function cleanValue(raw: string | undefined, token: boolean): CleanResult {
  if (raw === undefined || raw === null) return { value: '', fixes: [] };
  const fixes = new Set<CredentialNoticeKind>();
  let value = String(raw);

  if (HAS_INVISIBLE_CHAR.test(value)) fixes.add('invisible');
  value = value.replace(INVISIBLE_CHARS, '').replace(/\u00A0/g, ' ');

  for (let round = 0; round < 6; round += 1) {
    const before = value;
    const trimmed = value.trim();
    if (trimmed !== value) {
      fixes.add('whitespace');
      value = trimmed;
    }
    // The whole `NAME=value` (or `export NAME=value`) line pasted as the value.
    const assignment = value.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/);
    if (assignment && KNOWN_NAMES.has(assignment[1].toUpperCase())) {
      fixes.add('name_prefix');
      value = assignment[2];
      continue;
    }
    if (LEADING_QUOTES.test(value) || TRAILING_QUOTES.test(value)) {
      fixes.add('quotes');
      value = value.replace(LEADING_QUOTES, '').replace(TRAILING_QUOTES, '');
      continue;
    }
    if (/[,;]+$/.test(value)) {
      fixes.add('trailing_punctuation');
      value = value.replace(/[,;]+$/, '');
      continue;
    }
    if (value === before) break;
  }

  if (token && /\s/.test(value)) {
    fixes.add('inner_whitespace');
    value = value.replace(/\s+/g, '');
  }
  if (EMPTY_WORDS.test(value)) value = '';
  return { value, fixes: [...fixes] };
}

const FIX_TEXT: Partial<Record<CredentialNoticeKind, string>> = {
  quotes: 'মানের চারপাশে উদ্ধৃতিচিহ্ন (" বা \') ছিল',
  whitespace: 'মানের শুরুতে/শেষে স্পেস বা নতুন লাইন ছিল',
  inner_whitespace: 'মানের ভেতরে স্পেস ছিল',
  invisible: 'মানে অদৃশ্য (zero-width) অক্ষর ছিল',
  name_prefix: 'মানের ভেতরে ভেরিয়েবলের নামসহ পুরো লাইন (NAME=…) বসানো ছিল',
  trailing_punctuation: 'মানের শেষে কমা/সেমিকোলন ছিল',
};

function fixNotices(variable: string, fixes: CredentialNoticeKind[]): CredentialNotice[] {
  return fixes
    .filter((kind) => FIX_TEXT[kind])
    .map((kind) => ({
      variable,
      kind,
      severity: 'info' as const,
      message: `${variable}: ${FIX_TEXT[kind]} — সেটি বাদ দিয়ে ব্যবহার করা হচ্ছে। সময় পেলে হোস্টিং প্যানেলে মানটি পরিষ্কার করে দিন।`,
    }));
}

/* ── CLOUDINARY_URL ─────────────────────────────────────────────────────── */

interface ParsedUrl {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `cloudinary://<api_key>:<api_secret>@<cloud_name>[/…][?…]` → parts (lenient, never throws). */
function parseCloudinaryUrl(value: string): ParsedUrl | null {
  const match = value.match(/^cloudinary:\/\/(?:([^:@/?#]*)(?::([^@/?#]*))?@)?([^/?#@]+)/i);
  if (!match) return null;
  return {
    apiKey: safeDecode(match[1] || ''),
    apiSecret: safeDecode(match[2] || ''),
    cloudName: safeDecode(match[3] || ''),
  };
}

function isSdkParsable(value: string, protocol: string): boolean {
  if (!value.toLowerCase().startsWith(protocol)) return false;
  try {
    // The SDK runs `new URL()` on it at load time; anything that throws here
    // would throw there and take the whole server down.
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/* ── SDK guard (runs once, on import) ───────────────────────────────────── */

interface SdkEnvAdjustment {
  raw: string;
  /** Value left in process.env, or null when the variable had to be removed. */
  applied: string | null;
}
const sdkEnvAdjustments = new Map<string, SdkEnvAdjustment>();

function prepareSdkEnvironment(): void {
  const targets: [string, string][] = [
    [URL_VAR, 'cloudinary://'],
    [ACCOUNT_URL_VAR, 'account://'],
  ];
  for (const [name, protocol] of targets) {
    const raw = process.env[name];
    if (raw === undefined) continue;
    const { value } = cleanValue(raw, false);
    if (value === raw && (!value || isSdkParsable(value, protocol))) {
      if (!value) delete process.env[name];
      continue;
    }
    if (value && isSdkParsable(value, protocol)) {
      process.env[name] = value;
      sdkEnvAdjustments.set(name, { raw, applied: value });
    } else {
      delete process.env[name];
      sdkEnvAdjustments.set(name, { raw, applied: null });
      if (value) {
        console.error(
          `[storage] ${name} is not a valid "${protocol}…" URL and was ignored (the Cloudinary SDK would otherwise crash the server). Fix or remove the variable.`
        );
      }
    }
  }
}

prepareSdkEnvironment();

/** The variable as the operator set it (even if the guard above rewrote/removed it). */
function operatorValue(name: string): string | undefined {
  const adjusted = sdkEnvAdjustments.get(name);
  const current = process.env[name];
  if (adjusted && (current === undefined ? adjusted.applied === null : current === adjusted.applied)) {
    return adjusted.raw;
  }
  return current;
}

/* ── public API ─────────────────────────────────────────────────────────── */

function formatNotice(field: CredentialField, variable: string, value: string): CredentialNotice | null {
  if (!value) return null;
  if (PLACEHOLDER.test(value)) {
    return {
      variable,
      kind: 'placeholder',
      severity: 'error',
      message: `${variable}-এ আসল মানের বদলে নমুনা/প্লেসহোল্ডার লেখা আছে (যেমন <your_api_key>)। Cloudinary Console → Settings → API Keys থেকে আসল মান কপি করে বসান।`,
    };
  }
  if (field === 'apiKey' && !/^\d{6,25}$/.test(value)) {
    return {
      variable,
      kind: 'format',
      severity: 'warn',
      message: `${variable} দেখতে Cloudinary API key-এর মতো নয় — API key সাধারণত শুধু সংখ্যা (প্রায় ১৫ অঙ্ক)। হয়তো cloud name / secret-এর সাথে জায়গা বদল হয়েছে।`,
    };
  }
  if (field === 'apiSecret' && !/^[A-Za-z0-9_-]{10,}$/.test(value)) {
    return {
      variable,
      kind: 'format',
      severity: 'warn',
      message: `${variable} দেখতে Cloudinary API secret-এর মতো নয় (সাধারণত ইংরেজি অক্ষর, সংখ্যা, - ও _ মিলিয়ে ২০–৩০ অক্ষর)। Console থেকে পুরো secret আবার কপি করুন।`,
    };
  }
  if (field === 'cloudName' && !/^[A-Za-z0-9_-]+$/.test(value)) {
    return {
      variable,
      kind: 'format',
      severity: 'warn',
      message: `${variable}-এ শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _ থাকার কথা (যেমন dxyz12abc) — মানটি আবার দেখুন।`,
    };
  }
  return null;
}

/**
 * Current Cloudinary credentials, cleaned. Reads process.env on every call
 * (cheap), so it always reflects the environment the process runs with.
 */
export function readCloudinaryCredentials(): CloudinaryCredentials {
  const notices: CredentialNotice[] = [];
  const values: Record<CredentialField, string> = { cloudName: '', apiKey: '', apiSecret: '' };
  const sources: Record<CredentialField, string | null> = { cloudName: null, apiKey: null, apiSecret: null };

  // 1. CLOUDINARY_URL (fills whatever the separate variables leave empty).
  let fromUrl: ParsedUrl | null = null;
  const rawUrl = operatorValue(URL_VAR);
  if (rawUrl !== undefined) {
    const cleaned = cleanValue(rawUrl, false);
    if (cleaned.value) {
      notices.push(...fixNotices(URL_VAR, cleaned.fixes));
      fromUrl = parseCloudinaryUrl(cleaned.value);
      if (!fromUrl) {
        notices.push({
          variable: URL_VAR,
          kind: 'url_invalid',
          severity: 'error',
          message: `${URL_VAR} সঠিক ফরম্যাটে নেই — হওয়া উচিত cloudinary://API_KEY:API_SECRET@CLOUD_NAME। ভেরিয়েবলটি ঠিক করুন অথবা মুছে দিয়ে CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET আলাদা করে দিন।`,
        });
      }
    }
  }

  // 2. The separate variables (documented name first, then the aliases).
  for (const spec of CLOUDINARY_FIELDS) {
    for (const name of [spec.primary, ...spec.aliases]) {
      const raw = process.env[name];
      if (raw === undefined) continue;
      const cleaned = cleanValue(raw, true);
      if (!cleaned.value) continue;
      values[spec.field] = cleaned.value;
      sources[spec.field] = name;
      notices.push(...fixNotices(name, cleaned.fixes));
      if (name !== spec.primary) {
        notices.push({
          variable: name,
          kind: 'alias',
          severity: 'info',
          message: `${spec.label} পাওয়া গেছে ${name} ভেরিয়েবল থেকে (নির্ধারিত নাম ${spec.primary})। কাজ করবে, তবে নামটি ${spec.primary} করে দিলে ভালো।`,
        });
      }
      break;
    }
  }

  if (fromUrl) {
    for (const spec of CLOUDINARY_FIELDS) {
      const urlValue = cleanValue(fromUrl[spec.field], true).value;
      if (!urlValue) continue;
      if (!values[spec.field]) {
        values[spec.field] = urlValue;
        sources[spec.field] = URL_VAR;
      } else if (values[spec.field] !== urlValue) {
        notices.push({
          variable: URL_VAR,
          kind: 'conflict',
          severity: 'warn',
          message: `${URL_VAR}-এর ${spec.label} আর ${sources[spec.field]}-এর মান আলাদা — ${sources[spec.field]}-এরটি ব্যবহার করা হচ্ছে। পুরোনো/অপ্রয়োজনীয় ভেরিয়েবলটি মুছে দিন।`,
        });
      }
    }
  }

  // 3. Someone pasted a delivery URL into the cloud name ("https://res.cloudinary.com/dxyz/…").
  const deliveryUrl = values.cloudName.match(/res\.cloudinary\.com\/([A-Za-z0-9_-]+)/i);
  if (deliveryUrl) {
    notices.push({
      variable: sources.cloudName || primaryVariable('cloudName'),
      kind: 'extracted',
      severity: 'info',
      message: `${sources.cloudName}-এ পুরো Cloudinary লিংক ছিল — তার ভেতর থেকে cloud name "${deliveryUrl[1]}" নেওয়া হয়েছে।`,
    });
    values.cloudName = deliveryUrl[1];
  }

  for (const spec of CLOUDINARY_FIELDS) {
    const notice = formatNotice(spec.field, sources[spec.field] || spec.primary, values[spec.field]);
    if (notice) notices.push(notice);
  }

  const missing = CLOUDINARY_FIELDS.filter((spec) => !values[spec.field]).map((spec) => spec.field);
  const seen = new Set<string>();
  return {
    ...values,
    complete: missing.length === 0,
    sources,
    missing,
    notices: notices.filter((notice) => {
      const key = `${notice.variable}|${notice.kind}|${notice.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

/** `123456789012345` → `1234…345` — enough to recognise a key, useless to abuse it. */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 7) return `${apiKey.slice(0, 2)}…`;
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-3)}`;
}
