import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DatabaseBackup, Download, RotateCcw, Trash2, Upload, ShieldCheck, Cloud, Clock } from 'lucide-react';

/**
 * Backup & restore (admin only).
 *
 * The server keeps point-in-time snapshots of the whole site content:
 * one every few hours, one shortly after an edit, one before every restore and
 * one on a clean shutdown. Each snapshot is stored in MongoDB and mirrored to
 * the AM Storage cloud, so a wiped database can be refilled — automatically on
 * the next boot, or by hand from this tab.
 */

interface BackupItem {
  id: string;
  createdAt: string;
  reason: 'manual' | 'scheduled' | 'auto' | 'pre-restore' | 'startup' | 'shutdown';
  bytes: number;
  totalItems: number;
  pinned: boolean;
  amStorageUrl: string | null;
  amStorageError: string | null;
}

interface BackupStatus {
  enabled: boolean;
  intervalMinutes: number;
  keep: number;
  count: number;
  lastBackupAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  mirror: { enabled: boolean; provider: string; host: string; lastError: string | null } | null;
  autoRestored: { backupId: string; createdAt: string; at: string } | null;
}

interface BackupResponse {
  backups: BackupItem[];
  status: BackupStatus;
  content?: { totalItems: number; durable: boolean; source: string };
}

const REASON_LABEL: Record<BackupItem['reason'], string> = {
  manual: 'অ্যাডমিন (ম্যানুয়াল)',
  scheduled: 'নির্ধারিত সময়ে',
  auto: 'এডিটের পর স্বয়ংক্রিয়',
  'pre-restore': 'রিস্টোরের আগে (নিরাপত্তা কপি)',
  startup: 'সার্ভার চালু হওয়ার সময়',
  shutdown: 'সার্ভার বন্ধ হওয়ার সময়',
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ManageBackups: React.FC = () => {
  const { token, handleAuthError } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<BackupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backups', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text();
        if (handleAuthError(res.status, text)) return;
        throw new Error('সার্ভার থেকে তথ্য আসেনি।');
      }
      setData((await res.json()) as BackupResponse);
    } catch (err) {
      toast.error({ title: 'ব্যাকআপ তালিকা আনা যায়নি', description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, toast, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (label: string, url: string, options: { method?: string; body?: unknown } = {}) => {
    setWorking(label);
    try {
      const res = await fetch(url, {
        method: options.method || 'POST',
        headers: {
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          Authorization: `Bearer ${token}`,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await res.text();
      if (!res.ok) {
        let message = text;
        try {
          message = (JSON.parse(text) as { message?: string }).message || text;
        } catch {
          /* plain text error */
        }
        if (handleAuthError(res.status, message)) return false;
        throw new Error(message);
      }
      return true;
    } catch (err) {
      toast.error({ title: 'ব্যাকআপ কার্যক্রম ব্যর্থ', description: (err as Error).message });
      return false;
    } finally {
      setWorking(null);
    }
  };

  const createBackup = async () => {
    const done = await run('create', '/api/backups');
    if (!done) return;
    toast.success({ title: 'ব্যাকআপ তৈরি হয়েছে' });
    await load();
  };

  const restore = async (item: BackupItem) => {
    if (
      !confirm(
        `“${formatWhen(item.createdAt)}” (${item.totalItems}টি রেকর্ড) ব্যাকআপটি রিস্টোর করবেন?\n\n` +
          'বর্তমান কন্টেন্ট সম্পূর্ণ বদলে যাবে — তবে রিস্টোরের আগে বর্তমান অবস্থার আরেকটি ব্যাকআপ নেওয়া হয়, তাই ভুল হলেও ফেরানো যাবে।'
      )
    ) {
      return;
    }
    const done = await run(`restore-${item.id}`, `/api/backups/${item.id}/restore`);
    if (!done) return;
    toast.success({ title: 'কন্টেন্ট পুনরুদ্ধার হয়েছে', description: 'পেজটি রিফ্রেশ করে নতুন কন্টেন্ট দেখুন।' });
    await load();
  };

  const download = async (item: BackupItem) => {
    try {
      const res = await fetch(`/api/backups/${item.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('ডাউনলোড করা যায়নি।');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gusb-backup-${item.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error({ title: 'ডাউনলোড ব্যর্থ', description: (err as Error).message });
    }
  };

  const remove = async (item: BackupItem) => {
    if (!confirm('এই ব্যাকআপটি মুছে ফেলবেন?')) return;
    const done = await run(`delete-${item.id}`, `/api/backups/${item.id}`, { method: 'DELETE' });
    if (!done) return;
    toast.success({ title: 'ব্যাকআপ মুছে ফেলা হয়েছে' });
    await load();
  };

  const uploadRestore = async (file: File) => {
    if (
      !confirm(
        `“${file.name}” ফাইল থেকে কন্টেন্ট রিস্টোর করবেন?\n\nবর্তমান কন্টেন্ট সম্পূর্ণ বদলে যাবে ` +
          '(রিস্টোরের আগে বর্তমান অবস্থার একটি ব্যাকআপ নেওয়া হয়)।'
      )
    ) {
      return;
    }
    setWorking('upload');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) {
        let message = text;
        try {
          message = (JSON.parse(text) as { message?: string }).message || text;
        } catch {
          /* plain text */
        }
        if (handleAuthError(res.status, message)) return;
        throw new Error(message);
      }
      toast.success({ title: 'ফাইল থেকে কন্টেন্ট পুনরুদ্ধার হয়েছে' });
      await load();
    } catch (err) {
      toast.error({ title: 'রিস্টোর ব্যর্থ', description: (err as Error).message });
    } finally {
      setWorking(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const status = data?.status;

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5 text-amber-500" /> ব্যাকআপ ও রিস্টোর
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          সাইটের সম্পূর্ণ কন্টেন্টের (স্লাইড, প্রজেক্ট, সংবাদ, ছবি, নোটিশ, পরিসংখ্যান, সেটিংস) স্ন্যাপশট MongoDB-তে এবং
          AM Storage ক্লাউডে রাখা হয় — প্রতি {status?.intervalMinutes ?? 360} মিনিটে, প্রতি বড় এডিটের পর, প্রতি
          রিস্টোরের আগে এবং সার্ভার বন্ধ হওয়ার সময়। ডেটাবেস কখনো ফাঁকা হয়ে গেলে পরের বুটে সর্বশেষ স্ন্যাপশট
          <strong> স্বয়ংক্রিয়ভাবে</strong> ফিরিয়ে আনা হয়।
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">সর্বশেষ ব্যাকআপ</p>
            <p className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              {formatWhen(status?.lastBackupAt ?? null)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">সংরক্ষিত স্ন্যাপশট</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {status?.count ?? 0} টি (সর্বোচ্চ {status?.keep ?? 40} টি রাখা হয়)
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ক্লাউড কপি (AM Storage)</p>
            <p className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-slate-400" />
              {status?.mirror?.enabled ? status.mirror.host : 'বন্ধ'}
            </p>
          </div>
        </div>

        {status?.autoRestored ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> স্বয়ংক্রিয়ভাবে পুনরুদ্ধার করা হয়েছে
            </p>
            <p className="mt-1 opacity-90">
              স্টার্টআপে MongoDB ফাঁকা পাওয়ায় {formatWhen(status.autoRestored.createdAt)} এর স্ন্যাপশট (
              {status.autoRestored.backupId}) ফিরিয়ে আনা হয়েছে।
            </p>
          </div>
        ) : null}

        {status?.lastError ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-900">
            <p className="font-bold">সর্বশেষ ব্যাকআপ ব্যর্থ হয়েছে</p>
            <p className="mt-1 opacity-90 break-words">{status.lastError}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={createBackup}
            disabled={working !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-950 text-white text-xs font-bold hover:bg-emerald-900 transition-all disabled:opacity-50"
          >
            <DatabaseBackup className="w-4 h-4" /> {working === 'create' ? 'নেওয়া হচ্ছে…' : 'এখনই ব্যাকআপ নিন'}
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={working !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-700 text-xs font-bold border border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {working === 'upload' ? 'রিস্টোর হচ্ছে…' : 'ফাইল থেকে রিস্টোর'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadRestore(file);
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-sm font-bold text-slate-800">সংরক্ষিত স্ন্যাপশটসমূহ</h4>
        {loading ? (
          <p className="text-xs text-slate-500">লোড হচ্ছে…</p>
        ) : !data?.backups.length ? (
          <p className="text-xs text-slate-500">এখনো কোনো ব্যাকআপ নেই — “এখনই ব্যাকআপ নিন” চাপুন।</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.backups.map((item) => (
              <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">{formatWhen(item.createdAt)}</p>
                  <p className="text-[11px] text-slate-500">
                    {REASON_LABEL[item.reason] || item.reason} · {item.totalItems}টি রেকর্ড ·{' '}
                    {formatBytes(item.bytes)}
                    {item.pinned ? ' · সংরক্ষিত' : ''}
                    {item.amStorageUrl ? ' · ক্লাউড কপি আছে' : item.amStorageError ? ' · ক্লাউড কপি ব্যর্থ' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void download(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5" /> ডাউনলোড
                  </button>
                  {item.amStorageUrl ? (
                    <a
                      href={item.amStorageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Cloud className="w-3.5 h-3.5" /> ক্লাউড লিংক
                    </a>
                  ) : null}
                  <button
                    onClick={() => void restore(item)}
                    disabled={working !== null}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-900 text-white text-[11px] font-bold hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> রিস্টোর
                  </button>
                  <button
                    onClick={() => void remove(item)}
                    disabled={working !== null}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-[11px] font-bold hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> মুছুন
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
