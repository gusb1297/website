import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  FileText,
  HardDrive,
  Info,
  LoaderCircle,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Tells the admin, in plain words, WHERE uploads and content edits are stored —
 * and shouts when they cannot be.
 *
 * Pictures & videos live in Cloudinary, PDFs/documents in the AM Storage
 * gateway, content in MongoDB. Nothing is written to the server's own disk any
 * more, because on Render / Heroku / Railway that disk is wiped on every deploy
 * (that is how uploaded pictures used to vanish).
 *
 * The Cloudinary part used to trust a single check made when the server
 * started and treated every failed upload as "wrong API key/secret", so the
 * banner could stay red while Cloudinary worked. It now reads the live status
 * from GET /api/storage/status (signed-in users), which tells apart:
 *   checking    → the check is still running (polled)
 *   ok          → connected (green)
 *   unreachable → temporary network trouble, retried automatically (amber)
 *   failed      → Cloudinary rejected the credentials — says WHICH one and why
 *   not_configured → lists the missing variables
 * "আবার যাচাই" asks the server for a fresh check instead of re-reading the old one.
 */

type StorageState = 'not_configured' | 'unknown' | 'checking' | 'ok' | 'failed' | 'unreachable';
type FailureReason =
  | 'cloud_name'
  | 'api_key'
  | 'api_secret'
  | 'permission'
  | 'account'
  | 'clock'
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'service'
  | 'unknown';

interface StorageCheck {
  ok: boolean;
  state?: 'ok' | 'failed' | 'unreachable';
  at: string;
  via?: 'ping' | 'upload-test' | 'upload';
  reason?: FailureReason;
  error?: string;
  adminApiRestricted?: boolean;
  nextRetryAt?: string;
}

interface CredentialNotice {
  variable: string;
  kind: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

interface StatusResponse {
  status: string;
  mongo?: { configured: boolean; connected: boolean; state: string };
  storage?: {
    provider: 'cloudinary';
    configured: boolean;
    state?: StorageState;
    checking?: boolean;
    durable: boolean;
    cloudName?: string;
    folder?: string;
    lastCheck?: StorageCheck | null;
    missing?: string[];
    hint?: string;
    /** PDF / document gateway (AM Storage) — independent from Cloudinary. */
    documents?: { provider: 'am-storage'; configured: boolean; host: string };
  };
  content?: {
    source: 'mongodb' | 'legacy-blob' | 'local-file' | 'backup' | 'none';
    durable: boolean;
    loaded?: boolean;
    counts?: Record<string, number>;
    totalItems?: number;
    pendingWrites?: number;
    lastSavedAt: string | null;
    lastLoadedAt?: string | null;
    /** Records still pointing at the removed local /uploads folder. */
    legacyLocalAssets?: number;
    hint?: string;
  };
  /** Automatic snapshots (see /admin → ব্যাকআপ ও রিস্টোর). */
  backup?: {
    enabled: boolean;
    intervalMinutes: number;
    keep: number;
    count: number | null;
    lastBackupAt: string | null;
    nextRunAt: string | null;
    lastError: string | null;
    mirror?: { enabled: boolean; host: string; lastError: string | null } | null;
    autoRestored?: { backupId: string; createdAt: string; at: string } | null;
  };
  /** Only from /api/storage/status (signed-in users). Never contains the secret. */
  diagnostics?: {
    cloudinary: {
      cloudName: string;
      apiKeyMasked: string;
      apiSecretSet: boolean;
      apiSecretLength: number;
      sources: { cloudName: string | null; apiKey: string | null; apiSecret: string | null };
      missing: string[];
      notices: CredentialNotice[];
    };
    contentClouds: { name: string; count: number }[];
  };
}

type Tone = 'error' | 'warn';
type Area = 'media' | 'documents' | 'content';

interface Problem {
  key: string;
  area: Area;
  tone: Tone;
  title: string;
  detail: React.ReactNode;
}

const FAILED_TITLE: Record<FailureReason, string> = {
  cloud_name: 'Cloudinary এই cloud name চিনতে পারছে না — নতুন ছবি/ভিডিও আপলোড হবে না।',
  api_key: 'Cloudinary API key গ্রহণ করছে না — নতুন ছবি/ভিডিও আপলোড হবে না।',
  api_secret: 'Cloudinary API secret মিলছে না — নতুন ছবি/ভিডিও আপলোড হবে না।',
  permission: 'এই Cloudinary API key-র আপলোডের অনুমতি নেই।',
  account: 'Cloudinary অ্যাকাউন্টটি নিষ্ক্রিয় বা সীমিত।',
  clock: 'সার্ভারের সময় (ঘড়ি) ভুল — Cloudinary অনুরোধ বাতিল করছে।',
  auth: 'Cloudinary ক্রেডেনশিয়াল গ্রহণ করেনি — নতুন ছবি/ভিডিও আপলোড হবে না।',
  rate_limit: 'Cloudinary সাময়িকভাবে অনুরোধ সীমিত করেছে।',
  network: 'Cloudinary-তে পৌঁছানো যাচ্ছে না।',
  timeout: 'Cloudinary সময়মতো উত্তর দেয়নি।',
  service: 'Cloudinary সার্ভারে সাময়িক সমস্যা।',
  unknown: 'Cloudinary সংযোগ পরীক্ষা ব্যর্থ হয়েছে — নতুন ছবি/ভিডিও আপলোড হবে না।',
};

const VIA_LABEL: Record<NonNullable<StorageCheck['via']>, string> = {
  ping: 'Cloudinary API পরীক্ষা',
  'upload-test': 'পরীক্ষামূলক আপলোড',
  upload: 'সর্বশেষ আপলোড',
};

function bnNumber(value: number): string {
  return value.toLocaleString('bn-BD');
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 10) return 'এইমাত্র';
  if (seconds < 60) return `${bnNumber(seconds)} সেকেন্ড আগে`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${bnNumber(minutes)} মিনিট আগে`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${bnNumber(hours)} ঘণ্টা আগে`;
  return new Date(iso).toLocaleString('bn-BD');
}

function clockTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('bn-BD');
}

/** Works with the current server and with an older one that only reports lastCheck. */
function storageStateOf(storage: StatusResponse['storage']): StorageState {
  if (!storage) return 'unknown';
  if (storage.state) return storage.state;
  if (!storage.configured) return 'not_configured';
  if (storage.lastCheck) return storage.lastCheck.ok ? 'ok' : 'failed';
  return 'unknown';
}

async function fetchStatus(token: string | null, verify: boolean): Promise<StatusResponse> {
  if (token) {
    try {
      const res = await fetch(`/api/storage/status${verify ? '?verify=1' : ''}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return (await res.json()) as StatusResponse;
      // 401/403 (session), 503 (database down) or an older server: use the
      // public health check. Never log the admin out from a status banner.
    } catch {
      /* fall back below */
    }
  }
  const res = await fetch('/api/health', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as StatusResponse;
}

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px]">{children}</code>
);

export const StorageStatusBanner: React.FC = () => {
  const { token } = useAuth();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dismissedOk, setDismissedOk] = useState(false);
  const polls = useRef(0);

  const load = useCallback(
    async (options: { verify?: boolean; quiet?: boolean } = {}) => {
      if (options.verify) setVerifying(true);
      if (!options.quiet) setLoading(true);
      try {
        setStatus(await fetchStatus(token, Boolean(options.verify)));
        setFailed(false);
      } catch (err) {
        console.warn('[admin] Could not read the storage status:', err);
        if (!options.quiet) setFailed(true);
      } finally {
        setLoading(false);
        setVerifying(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const recheck = () => {
    polls.current = 0;
    setDismissedOk(false);
    void load({ verify: true });
  };

  // Follow a running check, and keep an eye on a temporary outage.
  const storage = status?.storage;
  const state = storageStateOf(storage);
  const busy = state === 'checking' || state === 'unknown' || Boolean(storage?.checking);
  useEffect(() => {
    if (!status) return;
    const delay = busy ? 3_000 : state === 'unreachable' ? 20_000 : 0;
    if (!delay || polls.current >= 40) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      void load({ quiet: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [status, busy, state, load]);

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> স্টোরেজ স্ট্যাটাস যাচাই করা হচ্ছে…
      </div>
    );
  }

  if (failed || !status) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> সার্ভারের স্টোরেজ স্ট্যাটাস পড়া যায়নি।
        </span>
        <button onClick={() => void load()} className="inline-flex items-center gap-1 font-bold underline">
          <RefreshCw className="h-3.5 w-3.5" /> আবার চেষ্টা
        </button>
      </div>
    );
  }

  const content = status.content;
  const check = storage?.lastCheck || null;
  const diag = status.diagnostics?.cloudinary;
  const notices = diag?.notices || [];
  const seriousNotices = notices.filter((notice) => notice.severity !== 'info');
  const cloudName = storage?.cloudName || diag?.cloudName || '';
  const documentsReady = storage?.documents ? storage.documents.configured : true;
  const contentDurable = Boolean(content?.durable);

  /* ── Cloudinary ─────────────────────────────────────────────────────── */
  const problems: Problem[] = [];

  const credentialSummary = diag ? (
    <span className="block">
      সার্ভার যে মান ব্যবহার করছে: cloud name <Code>{diag.cloudName || '—'}</Code>
      {diag.sources.cloudName ? ` (${diag.sources.cloudName})` : ''} · API key <Code>{diag.apiKeyMasked || '—'}</Code>
      {diag.sources.apiKey ? ` (${diag.sources.apiKey})` : ''} · API secret{' '}
      {diag.apiSecretSet ? `${bnNumber(diag.apiSecretLength)} অক্ষর` : 'নেই'}
      {diag.sources.apiSecret ? ` (${diag.sources.apiSecret})` : ''}
    </span>
  ) : null;

  const noticeList = (items: CredentialNotice[]) =>
    items.length ? (
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((notice) => (
          <li key={`${notice.variable}-${notice.kind}-${notice.message}`}>{notice.message}</li>
        ))}
      </ul>
    ) : null;

  if (state === 'not_configured') {
    const missing = storage?.missing?.length ? storage.missing : diag?.missing || [];
    problems.push({
      key: 'cloudinary',
      area: 'media',
      tone: 'error',
      title: 'ছবি / ভিডিও আপলোড বন্ধ — Cloudinary কনফিগার করা নেই।',
      detail: (
        <>
          {missing.length ? (
            <>
              সার্ভারে পাওয়া যায়নি:{' '}
              {missing.map((name, index) => (
                <React.Fragment key={name}>
                  {index ? ', ' : ''}
                  <Code>{name}</Code>
                </React.Fragment>
              ))}
              ।{' '}
            </>
          ) : null}
          হোস্টিং প্যানেলের Environment Variables-এ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
          (অথবা CLOUDINARY_URL) যোগ করে সার্ভার রিস্টার্ট/রিডিপ্লয় করুন।
          {noticeList(seriousNotices)}
        </>
      ),
    });
  } else if (state === 'failed') {
    const reason = check?.reason || 'unknown';
    const contentClouds = status.diagnostics?.contentClouds || [];
    const otherCloud =
      cloudName && contentClouds.length && !contentClouds.some((entry) => entry.name === cloudName)
        ? contentClouds[0].name
        : '';
    let advice: React.ReactNode;
    switch (reason) {
      case 'cloud_name':
        advice = (
          <>
            <Code>{cloudName || 'CLOUDINARY_CLOUD_NAME'}</Code> নামে কোনো Cloudinary অ্যাকাউন্ট পাওয়া যায়নি। Cloudinary
            Console → Settings → API Keys পাতার উপরের “Cloud name” হুবহু কপি করে CLOUDINARY_CLOUD_NAME-এ বসান (এটি
            অ্যাকাউন্টের ইমেইল/নাম নয়)।
          </>
        );
        break;
      case 'api_key':
        advice = (
          <>
            API key {diag?.apiKeyMasked ? <Code>{diag.apiKeyMasked}</Code> : null} এই cloud name-এর নয়, অথবা মুছে ফেলা
            হয়েছে। <Code>{cloudName || 'আপনার cloud'}</Code>-এর Settings → API Keys পাতা থেকেই key ও secret দুটো কপি করুন।
          </>
        );
        break;
      case 'api_secret':
        advice = (
          <>
            API key চেনা গেছে, কিন্তু CLOUDINARY_API_SECRET এই key-র secret নয়
            {diag?.apiSecretSet && diag.apiSecretLength !== 27
              ? ` (সেট করা secret ${bnNumber(diag.apiSecretLength)} অক্ষরের, অথচ Cloudinary secret সাধারণত ২৭ অক্ষরের — হয়তো পুরোটা কপি হয়নি)`
              : ''}
            । Console-এ চোখের আইকনে ক্লিক করে একই key-র পুরো secret কপি করে বসান।
          </>
        );
        break;
      case 'permission':
        advice =
          'Cloudinary Console → Settings → API Keys-এ এই key-র Role দেখুন — নতুন key-তে ডিফল্টভাবে কোনো অনুমতি থাকে না। Master Admin বা আপলোডের অনুমতিসহ রোল দিন, অথবা অনুমতিসহ অন্য key ব্যবহার করুন।';
        break;
      case 'account':
        advice = 'Cloudinary Console-এ লগইন করে অ্যাকাউন্টের অবস্থা, প্ল্যান ও কোটা দেখুন।';
        break;
      case 'clock':
        advice = 'হোস্টিং সার্ভারের সময় (NTP) ঠিক করুন — Cloudinary এক ঘণ্টার বেশি পুরোনো সময়ের অনুরোধ নেয় না।';
        break;
      default:
        advice =
          'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ও CLOUDINARY_API_SECRET — তিনটিই যেন একই Cloudinary অ্যাকাউন্টের (একই product environment) হয়।';
    }
    problems.push({
      key: 'cloudinary',
      area: 'media',
      tone: 'error',
      title: FAILED_TITLE[reason],
      detail: (
        <>
          <span className="block">{advice}</span>
          {check?.error ? (
            <span className="block">
              Cloudinary-র উত্তর: <Code>{check.error}</Code>
            </span>
          ) : null}
          {credentialSummary}
          {otherCloud ? (
            <span className="block">
              সাইটে সংরক্ষিত ছবিগুলো <Code>{otherCloud}</Code> ক্লাউড থেকে আসছে, কিন্তু সার্ভারে cloud name{' '}
              <Code>{cloudName}</Code> — হয়তো অন্য অ্যাকাউন্টের মান বসানো হয়েছে।
            </span>
          ) : null}
          {noticeList(notices)}
          <span className="mt-1 block opacity-80">
            মনে রাখুন: ওয়েবসাইটে আগের ছবিগুলো দেখাতে API key/secret লাগে না — সেগুলো সরাসরি Cloudinary-র পাবলিক লিংক থেকে
            আসে। তাই ছবি ঠিকমতো দেখা গেলেও নতুন আপলোডের জন্য এই মানগুলো সঠিক হতে হবে। মান ঠিক করে সার্ভার রিস্টার্ট করুন,
            তারপর “আবার যাচাই” চাপুন।
          </span>
        </>
      ),
    });
  } else if (state === 'unreachable') {
    problems.push({
      key: 'cloudinary',
      area: 'media',
      tone: 'warn',
      title: 'Cloudinary-তে সাময়িকভাবে পৌঁছানো যাচ্ছে না — নিজে থেকেই আবার চেষ্টা হচ্ছে।',
      detail: (
        <>
          <span className="block">
            এটি API key / secret-এর সমস্যা নয় (নেটওয়ার্ক বা Cloudinary-র সাময়িক সমস্যা) — কিছু বদলানোর দরকার নেই।
            {check?.nextRetryAt ? ` পরবর্তী স্বয়ংক্রিয় যাচাই: ${clockTime(check.nextRetryAt)}।` : ''}
          </span>
          {check?.error ? (
            <span className="block">
              বিস্তারিত: <Code>{check.error}</Code>
            </span>
          ) : null}
        </>
      ),
    });
  }

  /* ── AM Storage & MongoDB ───────────────────────────────────────────── */
  if (storage?.documents && !storage.documents.configured) {
    problems.push({
      key: 'documents',
      area: 'documents',
      tone: 'error',
      title: 'PDF / নথি আপলোড বন্ধ — ডকুমেন্ট স্টোরেজ (AM Storage) কনফিগার করা নেই।',
      detail:
        'Environment Variables-এ AM_STORAGE_BRIDGE_URL, AM_STORAGE_KEY_ID ও AM_STORAGE_KEY_SECRET সেট করে সার্ভার রিস্টার্ট করুন।',
    });
  }

  if (content && !contentDurable) {
    if (!status.mongo?.configured) {
      problems.push({
        key: 'content',
        area: 'content',
        tone: 'error',
        title: 'সাইটের কন্টেন্ট (স্লাইড, সংবাদ, গ্যালারি রেকর্ড…) MongoDB-তে সেভ হচ্ছে না।',
        detail:
          'MONGODB_URI সেট করা নেই, তাই সব এডিট শুধু সার্ভারের স্থায়ী নয় এমন ক্যাশে থাকছে — ডিপ্লয় করলেই মুছে যাবে। হোস্টিং প্যানেলে MONGODB_URI যোগ করুন।',
      });
    } else if (!status.mongo?.connected) {
      problems.push({
        key: 'content',
        area: 'content',
        tone: 'error',
        title: 'MongoDB-র সাথে সংযোগ নেই — এডিটগুলো আপাতত শুধু লোকাল ক্যাশে থাকছে।',
        detail:
          'Atlas → Network Access-এ এই সার্ভারের IP (বা 0.0.0.0/0) অনুমোদন করুন এবং Database Access-এর ইউজার/পাসওয়ার্ড মিলিয়ে দেখুন। সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সেভ হবে।',
      });
    } else if (content.hint) {
      problems.push({
        key: 'content',
        area: 'content',
        tone: 'error',
        title: 'MongoDB-তে কন্টেন্ট সেভ ব্যর্থ হয়েছে (স্বয়ংক্রিয়ভাবে আবার চেষ্টা হচ্ছে)।',
        detail: content.hint,
      });
    }
  }

  if (status.backup?.enabled && !status.backup.lastBackupAt && contentDurable) {
    problems.push({
      key: 'backup',
      area: 'content',
      tone: 'warn',
      title: 'এখনো কোনো স্বয়ংক্রিয় ব্যাকআপ তৈরি হয়নি।',
      detail:
        `প্রতি ${status.backup.intervalMinutes} মিনিটে (এবং প্রতি এডিটের পর) স্বয়ংক্রিয়ভাবে নেওয়া হয় — অ্যাডমিন ড্যাশবোর্ডের ` +
        '“ব্যাকআপ ও রিস্টোর” ট্যাব থেকে এখনই একটি তৈরি করতে পারেন।',
    });
  }

  if (content?.legacyLocalAssets) {
    problems.push({
      key: 'legacy-assets',
      area: 'media',
      tone: 'warn',
      title: `${content.legacyLocalAssets}টি ছবি/ফাইল এখনো “/uploads/…” পুরনো লোকাল ঠিকানায় নির্দেশ করছে।`,
      detail:
        'এগুলো কোনো সময় সার্ভারের নিজস্ব ডিস্কে সেভ হয়েছিল, যা ডিপ্লয়ের সময় মুছে যায় — তাই সেগুলো আর কখনোই লোড হবে না। ' +
        'সংশ্লিষ্ট রেকর্ডগুলো খুলে ছবি/ফাইলটি আবার আপলোড করুন (এবার Cloudinary/AM Storage-এ সংরক্ষিত হবে)।',
    });
  }

  const recheckButton = (className: string) => (
    <button
      onClick={recheck}
      disabled={verifying}
      className={`inline-flex items-center gap-1 whitespace-nowrap font-bold underline disabled:opacity-60 ${className}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} /> {verifying ? 'যাচাই হচ্ছে…' : 'আবার যাচাই'}
    </button>
  );

  const lastCheckLine = check ? (
    <span className="opacity-80">
      শেষ যাচাই: {timeAgo(check.at)}
      {check.via ? ` (${VIA_LABEL[check.via]})` : ''}
    </span>
  ) : null;

  /* ── still checking, nothing else wrong ─────────────────────────────── */
  if (!problems.length && busy) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Cloudinary সংযোগ যাচাই করা হচ্ছে…
          {cloudName ? <span className="opacity-70">({cloudName})</span> : null}
        </span>
      </div>
    );
  }

  /* ── all good ───────────────────────────────────────────────────────── */
  if (!problems.length) {
    if (dismissedOk) return null;
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> সব ঠিক আছে — Cloudinary সংযুক্ত; ছবি/ভিডিও
              Cloudinary-তে, PDF ডকুমেন্ট স্টোরেজে ও কন্টেন্ট MongoDB-তে সংরক্ষিত হচ্ছে।
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-800">
              <HardDrive className="h-3.5 w-3.5" /> মিডিয়া: Cloudinary
              {cloudName ? ` (${cloudName}${storage?.folder ? `/${storage.folder}` : ''})` : ''}
            </span>
            {storage?.documents ? (
              <span className="inline-flex items-center gap-1 text-emerald-800">
                <FileText className="h-3.5 w-3.5" /> PDF/নথি: AM Storage ({storage.documents.host})
              </span>
            ) : null}
            {lastCheckLine}
          </div>
          <div className="flex items-center gap-4">
            {recheckButton('text-emerald-700')}
            <button onClick={() => setDismissedOk(true)} className="font-bold text-emerald-700 hover:underline">
              বন্ধ করুন
            </button>
          </div>
        </div>
        {check?.adminApiRestricted ? (
          <p className="mt-2 flex items-start gap-1.5 text-emerald-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cloudinary-র Admin API এই সার্ভার থেকে সীমিত (Allowed IP তালিকা বা API key-র Role), তাই পরীক্ষামূলক আপলোড দিয়ে
            যাচাই করা হয়েছে — আপলোডে কোনো সমস্যা নেই।
          </p>
        ) : null}
        {notices.length ? (
          <div className="mt-2 flex items-start gap-1.5 text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              Environment Variables-এ ছোটখাটো অসংগতি ছিল — সার্ভার নিজে ঠিক করে নিয়েছে, তবে সময় পেলে পরিষ্কার করে দিন:
              {noticeList(notices)}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ── problems ───────────────────────────────────────────────────────── */
  const areas = new Set(problems.map((problem) => problem.area));
  const hasError = problems.some((problem) => problem.tone === 'error');
  const title =
    areas.size > 1
      ? 'স্টোরেজ সতর্কতা — কিছু আপলোড / এডিট স্থায়ীভাবে সংরক্ষিত হচ্ছে না'
      : areas.has('media')
        ? hasError
          ? 'ছবি / ভিডিও আপলোডে সমস্যা — Cloudinary'
          : 'Cloudinary-তে সাময়িক সংযোগ সমস্যা'
        : areas.has('documents')
          ? 'PDF / নথি আপলোডে সমস্যা — AM Storage'
          : 'কন্টেন্ট এডিট স্থায়ীভাবে সংরক্ষিত হচ্ছে না — MongoDB';
  const tone = hasError
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-amber-300 bg-amber-50 text-amber-900';
  const Icon = hasError ? CloudOff : WifiOff;

  return (
    <div className={`rounded-2xl border px-4 py-4 text-xs ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-bold">{title}</p>
            <ul className="space-y-3">
              {problems.map((problem) => (
                <li key={problem.key} className="leading-relaxed">
                  <span className="font-bold">{problem.title}</span>
                  <span className="mt-0.5 block space-y-0.5 break-words opacity-90">{problem.detail}</span>
                </li>
              ))}
            </ul>
            <p className="pt-1 opacity-80">
              বর্তমান অবস্থা: কন্টেন্ট →{' '}
              <strong>
                {content?.source === 'mongodb'
                  ? 'MongoDB'
                  : content?.source === 'backup'
                    ? 'MongoDB (স্বয়ংক্রিয় ব্যাকআপ থেকে পুনরুদ্ধার)'
                    : content?.source === 'legacy-blob'
                      ? 'MongoDB (পুরনো স্টোর থেকে স্থানান্তরিত)'
                      : content?.source === 'local-file'
                        ? 'MongoDB (পুরনো data/store.json থেকে স্থানান্তরিত)'
                        : 'কিছুই না'}
              </strong>
              {' · '}মিডিয়া →{' '}
              <strong>
                {state === 'not_configured'
                  ? 'কনফিগার করা নেই'
                  : `Cloudinary${cloudName ? ` (${cloudName})` : ''}${
                      state === 'ok' ? ' — সংযুক্ত' : state === 'failed' ? ' — সংযোগ ব্যর্থ' : state === 'unreachable' ? ' — সাময়িকভাবে অপ্রাপ্য' : ''
                    }`}
              </strong>
              {storage?.documents ? (
                <>
                  {' · '}PDF/নথি →{' '}
                  <strong>{storage.documents.configured ? `AM Storage (${storage.documents.host})` : 'কনফিগার করা নেই'}</strong>
                </>
              ) : null}
              {status.backup ? (
                <>
                  {' · '}ব্যাকআপ →{' '}
                  <strong>
                    {status.backup.enabled
                      ? status.backup.lastBackupAt
                        ? `${new Date(status.backup.lastBackupAt).toLocaleString('bn-BD')} (${status.backup.count ?? 0}টি)`
                        : 'এখনো কোনো স্ন্যাপশট নেই'
                      : 'বন্ধ'}
                  </strong>
                </>
              ) : null}
              {check ? <> {' · '}</> : null}
              {lastCheckLine}
            </p>
          </div>
        </div>
        {recheckButton('')}
      </div>
    </div>
  );
};
