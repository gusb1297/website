import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Database, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react';

interface HealthResponse {
  status: string;
  mongo?: { configured: boolean; connected: boolean; state: string };
  storage?: {
    provider: 'cloudinary' | 'local';
    configured: boolean;
    durable: boolean;
    cloudRequired: boolean;
    ephemeralHost: boolean;
    cloudName?: string;
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

/**
 * Tells the admin, in plain words, WHERE their uploads and edits are being
 * saved — and shouts when they are only on a disk that disappears on the next
 * deploy (the reason photos used to vanish after every site update).
 */
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
  const filesDurable = Boolean(storage?.durable && storage?.provider === 'cloudinary');
  const filesRefused = Boolean(storage && !storage.configured && storage.cloudRequired);
  const contentDurable = Boolean(content?.durable);
  const allGood = filesDurable && contentDurable;

  if (allGood && dismissedOk) return null;

  if (allGood) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> সব ঠিক আছে — আপলোড ও কন্টেন্ট স্থায়ীভাবে সংরক্ষিত হচ্ছে।
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-800">
            <Database className="h-3.5 w-3.5" /> কন্টেন্ট: MongoDB
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-800">
            <HardDrive className="h-3.5 w-3.5" /> ফাইল: Cloudinary{storage?.cloudName ? ` (${storage.cloudName})` : ''}
          </span>
        </div>
        <button onClick={() => setDismissedOk(true)} className="font-bold text-emerald-700 hover:underline">
          বন্ধ করুন
        </button>
      </div>
    );
  }

  const problems: { title: string; detail: string; severity: 'error' | 'warn' }[] = [];

  if (storage && !filesDurable) {
    if (filesRefused) {
      problems.push({
        severity: 'error',
        title: 'ছবি / PDF / ভিডিও আপলোড এখন বন্ধ — Cloudinary কনফিগার করা নেই।',
        detail:
          'এই হোস্টের লোকাল ডিস্ক প্রতিটি ডিপ্লয়/রিস্টার্টে মুছে যায়, তাই ফাইল সেখানে সেভ করা হয় না। হোস্টিং প্যানেলের Environment Variables-এ CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET যোগ করে সার্ভার রিস্টার্ট করুন।',
      });
    } else if (storage.configured && storage.lastCheck && !storage.lastCheck.ok) {
      problems.push({
        severity: 'error',
        title: 'Cloudinary-র সাথে সংযোগ ব্যর্থ হয়েছে — আপলোড কাজ করবে না।',
        detail: `API key / secret ঠিক আছে কিনা দেখুন। ত্রুটি: ${storage.lastCheck.error || 'অজানা'}`,
      });
    } else if (!storage.configured) {
      problems.push({
        severity: 'warn',
        title: 'ফাইল আপলোড লোকাল ডিস্কে (./uploads) সেভ হচ্ছে — শুধু ডেভেলপমেন্টের জন্য ঠিক আছে।',
        detail:
          'লাইভ সার্ভারে (Render/Heroku ইত্যাদি) এই ফাইলগুলো পরের ডিপ্লয়ে হারিয়ে যাবে। Cloudinary ক্রেডেনশিয়াল সেট করুন।',
      });
    }
  }

  if (content && !contentDurable) {
    if (!health.mongo?.configured) {
      problems.push({
        severity: content.source === 'file' && !storage?.ephemeralHost ? 'warn' : 'error',
        title: 'সাইটের কন্টেন্ট (স্লাইড, সংবাদ, গ্যালারি রেকর্ড…) MongoDB-তে সেভ হচ্ছে না।',
        detail:
          'MONGODB_URI সেট করা নেই, তাই সব এডিট শুধু data/store.json ফাইলে থাকছে — ডিপ্লয় করলেই মুছে যাবে। হোস্টিং প্যানেলে MONGODB_URI যোগ করুন।',
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

  const hasError = problems.some((p) => p.severity === 'error');
  const palette = hasError
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-amber-300 bg-amber-50 text-amber-900';

  return (
    <div className={`rounded-2xl border px-4 py-4 text-xs ${palette}`}>
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
              বর্তমান অবস্থা: কন্টেন্ট → <strong>{content?.source === 'mongodb' ? 'MongoDB' : content?.source === 'file' ? 'লোকাল ফাইল (data/store.json)' : 'কিছুই না'}</strong>
              {' · '}ফাইল → <strong>{storage?.provider === 'cloudinary' ? `Cloudinary${storage.cloudName ? ` (${storage.cloudName})` : ''}` : 'লোকাল ডিস্ক (./uploads)'}</strong>
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
