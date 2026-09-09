import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Database, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react';

/**
 * Tells the admin, in plain words, WHERE uploads and content edits are stored —
 * and shouts when they cannot be.
 *
 * Media has exactly one home now: Cloudinary. Nothing is written to the server's
 * own disk any more, because on Render / Heroku / Railway that disk is wiped on
 * every deploy (that is how uploaded pictures used to vanish). So when the
 * credentials are missing, uploads are refused loudly instead of half-working —
 * and this banner explains what to set, before the admin wastes time on it.
 */

interface HealthResponse {
  status: string;
  mongo?: { configured: boolean; connected: boolean; state: string };
  storage?: {
    provider: 'cloudinary';
    configured: boolean;
    durable: boolean;
    cloudName?: string;
    folder?: string;
    lastCheck?: { ok: boolean; at: string; error?: string } | null;
    hint?: string;
  };
  content?: {
    source: 'mongodb' | 'file' | 'none';
    durable: boolean;
    lastSavedAt: string | null;
    hint?: string;
  };
}

export const StorageStatusBanner: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dismissedOk, setDismissedOk] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth((await res.json()) as HealthResponse);
    } catch (err) {
      console.warn('[admin] Could not read /api/health:', err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> স্টোরেজ স্ট্যাটাস যাচাই করা হচ্ছে…
      </div>
    );
  }

  if (failed || !health) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> সার্ভারের স্টোরেজ স্ট্যাটাস পড়া যায়নি।
        </span>
        <button onClick={load} className="inline-flex items-center gap-1 font-bold underline">
          <RefreshCw className="h-3.5 w-3.5" /> আবার চেষ্টা
        </button>
      </div>
    );
  }

  const storage = health.storage;
  const content = health.content;
  const filesReady = Boolean(storage?.configured && storage?.durable);
  const contentDurable = Boolean(content?.durable);
  const allGood = filesReady && contentDurable;

  if (allGood && dismissedOk) return null;

  if (allGood) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> সব ঠিক আছে — ছবি/ভিডিও Cloudinary-তে ও কন্টেন্ট
            MongoDB-তে সংরক্ষিত হচ্ছে।
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-800">
            <HardDrive className="h-3.5 w-3.5" /> মিডিয়া: Cloudinary
            {storage?.cloudName ? ` (${storage.cloudName}${storage.folder ? `/${storage.folder}` : ''})` : ''}
          </span>
        </div>
        <button onClick={() => setDismissedOk(true)} className="font-bold text-emerald-700 hover:underline">
          বন্ধ করুন
        </button>
      </div>
    );
  }

  const problems: { title: string; detail: string; severity: 'error' | 'warn' }[] = [];

  if (!storage?.configured) {
    problems.push({
      severity: 'error',
      title: 'ছবি / ভিডিও / PDF আপলোড বন্ধ — Cloudinary কনফিগার করা নেই।',
      detail:
        'হোস্টিং প্যানেলের Environment Variables-এ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET ' +
        '(অথবা CLOUDINARY_URL) যোগ করে সার্ভার রিস্টার্ট করুন। Cloudinary-র ফ্রি টিয়ারই সাধারণত যথেষ্ট।',
    });
  } else if (storage.lastCheck && !storage.lastCheck.ok) {
    problems.push({
      severity: 'error',
      title: 'Cloudinary-র সাথে সংযোগ ব্যর্থ — আপলোড কাজ করবে না।',
      detail: `API key / secret ঠিক আছে কিনা দেখুন। ত্রুটি: ${storage.lastCheck.error || 'অজানা'}`,
    });
  }

  if (content && !contentDurable) {
    if (!health.mongo?.configured) {
      problems.push({
        severity: 'error',
        title: 'সাইটের কন্টেন্ট (স্লাইড, সংবাদ, গ্যালারি রেকর্ড…) MongoDB-তে সেভ হচ্ছে না।',
        detail:
          'MONGODB_URI সেট করা নেই, তাই সব এডিট শুধু সার্ভারের স্থায়ী নয় এমন ক্যাশে থাকছে — ডিপ্লয় করলেই মুছে যাবে। হোস্টিং প্যানেলে MONGODB_URI যোগ করুন।',
      });
    } else if (!health.mongo?.connected) {
      problems.push({
        severity: 'error',
        title: 'MongoDB-র সাথে সংযোগ নেই — এডিটগুলো আপাতত শুধু লোকাল ক্যাশে থাকছে।',
        detail:
          'Atlas → Network Access-এ এই সার্ভারের IP (বা 0.0.0.0/0) অনুমোদন করুন এবং Database Access-এর ইউজার/পাসওয়ার্ড মিলিয়ে দেখুন। সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সেভ হবে।',
      });
    } else if (content.hint) {
      problems.push({ severity: 'error', title: 'MongoDB-তে কন্টেন্ট সেভ ব্যর্থ হয়েছে।', detail: content.hint });
    }
  }

  if (!problems.length) return null;

  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-4 text-xs text-red-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-bold">স্টোরেজ সতর্কতা — আপলোড / এডিট স্থায়ীভাবে সংরক্ষিত হচ্ছে না</p>
            <ul className="space-y-2">
              {problems.map((problem) => (
                <li key={problem.title} className="leading-relaxed">
                  <span className="font-bold">{problem.title}</span>
                  <br />
                  <span className="opacity-90">{problem.detail}</span>
                </li>
              ))}
            </ul>
            <p className="pt-1 opacity-80">
              বর্তমান অবস্থা: কন্টেন্ট →{' '}
              <strong>
                {content?.source === 'mongodb' ? 'MongoDB' : content?.source === 'file' ? 'লোকাল ফাইল (ডেটা ক্যাশ)' : 'কিছুই না'}
              </strong>
              {' · '}মিডিয়া →{' '}
              <strong>{storage?.configured ? `Cloudinary${storage.cloudName ? ` (${storage.cloudName})` : ''}` : 'কনফিগার করা নেই'}</strong>
            </p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1 whitespace-nowrap font-bold underline">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> আবার যাচাই
        </button>
      </div>
    </div>
  );
};
