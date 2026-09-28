import React, { useEffect, useMemo, useState } from 'react';
import { Filter, History, RefreshCw } from 'lucide-react';
import { AuditEntry, consoleApi } from '../api';
import { Button, Chip, Notice, Panel, Tone, inputClass } from '../ui';

const LEVEL_TEXT: Record<AuditEntry['level'], string> = {
  info: 'text-[color:var(--ha-green)]',
  warn: 'text-[color:var(--ha-amber)]',
  critical: 'text-[color:var(--ha-red)]',
};

/**
 * AUDIT LOG — every privileged action, who did it and from where.
 *
 * Entries live in MongoDB (`auditlogs`) and in an in-memory ring buffer, so the
 * trail keeps working even while the database is switched off.
 */
export const AuditPanel: React.FC<{
  token: string | null;
  entries: AuditEntry[];
  source: 'mongodb' | 'memory';
  onToast: (message: string, tone?: Tone) => void;
  onReload: () => void;
}> = ({ token, entries, source, onToast, onReload }) => {
  const [level, setLevel] = useState<'all' | AuditEntry['level']>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (level !== 'all' && entry.level !== level) return false;
      if (!needle) return true;
      return [entry.action, entry.actor, entry.target, entry.detail, entry.ip]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [entries, level, query]);

  const counts = useMemo(
    () => ({
      total: entries.length,
      warn: entries.filter((entry) => entry.level === 'warn').length,
      critical: entries.filter((entry) => entry.level === 'critical').length,
    }),
    [entries]
  );

  useEffect(() => {
    /* keep the filter stable while the snapshot polls */
  }, [entries]);

  const refresh = async () => {
    setBusy(true);
    try {
      await consoleApi.audit(token, 200);
      onReload();
      onToast('অডিট লগ হালনাগাদ হয়েছে।', 'green');
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Audit Log"
      subtitle="প্রতিটি কনসোল অ্যাকশন, লগইন চেষ্টা, ডাটাবেস/গেটওয়ে পরিবর্তন ও অ্যাডমিন তৈরি-মুছে ফেলা — সব এখানে।"
      actions={
        <>
          <Chip label="entries" value={String(counts.total)} tone="cyan" />
          <Chip label="warn" value={String(counts.warn)} tone="amber" />
          <Chip label="critical" value={String(counts.critical)} tone="red" />
          <Chip label="source" value={source} tone={source === 'mongodb' ? 'green' : 'amber'} pulse />
          <Button tone="cyan" busy={busy} onClick={() => void refresh()}>
            <RefreshCw className="h-3.5 w-3.5" /> refresh
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[200px_1fr]">
        <label className="block">
          <span className="ha-label mb-1 block">
            <Filter className="mr-1 inline h-3 w-3" /> level
          </span>
          <select className={inputClass} value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
            <option value="all">all levels</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="block">
          <span className="ha-label mb-1 block">search</span>
          <input
            className={inputClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="action / target / ip / detail…"
          />
        </label>
      </div>

      {source === 'memory' ? (
        <Notice tone="amber">
          এন্ট্রিগুলো শুধু মেমরি থেকে দেখানো হচ্ছে (MongoDB বন্ধ/অনুপলব্ধ) — ডাটাবেস চালু হলে নতুন এন্ট্রি আবার স্থায়ীভাবে সংরক্ষিত হবে।
        </Notice>
      ) : null}

      <ul className="mt-3 space-y-2">
        {filtered.map((entry) => (
          <li key={entry.id} className="border border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em]">
              <span className={LEVEL_TEXT[entry.level]}>
                <History className="mr-1 inline h-3 w-3" />
                {entry.action}
              </span>
              <span className="text-[color:var(--ha-muted)]">
                {new Date(entry.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
                {entry.persisted ? '' : ' · memory only'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[color:var(--ha-text)]">
              {entry.target ? <span className="text-[color:var(--ha-cyan)]">{entry.target} </span> : null}
              {entry.detail || '—'}
            </p>
            <p className="mt-1 text-[10px] text-[color:var(--ha-muted)]">
              actor {entry.actor}
              {entry.ip ? ` · ip ${entry.ip}` : ''}
            </p>
          </li>
        ))}
        {filtered.length === 0 ? <li className="text-xs text-[color:var(--ha-muted)]">কোনো এন্ট্রি মেলেনি।</li> : null}
      </ul>
    </Panel>
  );
};
