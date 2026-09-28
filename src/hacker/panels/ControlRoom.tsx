import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Database,
  HardDriveDownload,
  RefreshCw,
  ShieldOff,
  Snowflake,
  UploadCloud,
  Zap,
} from 'lucide-react';
import {
  AuditEntry,
  SystemSnapshot,
  consoleApi,
  timeAgo,
} from '../api';
import { Button, Chip, Notice, Panel, PowerSwitch, Row, Stat, Tone } from '../ui';
import { StorageStatusBanner } from '../../admin/StorageStatusBanner';

/**
 * Shared view of how (and how recently) the console successfully talked to the
 * server. Built by HackerConsole from real fetch results — never decorated.
 */
export interface SyncState {
  /** The actual auto-refresh interval in seconds. */
  intervalSeconds: number;
  /** Client time of the last successful fetch (null = never). */
  lastSuccessAt: number | null;
  /** Error message of the last failed fetch (null = success). */
  error: string | null;
  /** True while a fetch is in flight. */
  syncing: boolean;
}

/** "12 seconds ago" / "3 minutes ago" — for the "Last checked" readouts. */
function sinceLabel(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return timeAgo(new Date(Date.now() - ms).toISOString());
}

/**
 * CONTROL ROOM — the first screen of the console.
 *
 * Top: a real SYSTEM STATUS section driven by the server-side MongoDB `ping`
 * and live storage/content state. Only values the backend actually reports are
 * rendered; anything unavailable shows as "Unavailable", never a made-up
 * number. Below: the two operator switches, maintenance actions and live state.
 */
export const ControlRoom: React.FC<{
  token: string | null;
  snapshot: SystemSnapshot | null;
  audit: AuditEntry[];
  loading: boolean;
  sync: SyncState;
  onRefresh: () => void;
  onToast: (message: string, tone?: Tone) => void;
  onOpenAudit: () => void;
}> = ({ token, snapshot, audit, loading, sync, onRefresh, onToast, onOpenAudit }) => {
  const [dbBusy, setDbBusy] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const control = snapshot?.control;
  const dbEnabled = control?.databaseEnabled ?? true;
  const frozen = control?.maintenanceMode ?? false;

  const toggleDatabase = async (next: boolean) => {
    if (!next) {
      const confirmed = window.confirm(
        'ডাটাবেস বন্ধ করবেন?\n\n• পাবলিক সাইট মেমরির ক্যাশ থেকে চলবে (ভিজিটর কিছু বুঝবে না)\n' +
          '• কোনো কন্টেন্ট/আপলোড সংরক্ষিত হবে না (৫০৩ রেসপন্স)\n' +
          '• সাধারণ /admin লগইন বন্ধ থাকবে, শুধু এই কনসোল কাজ করবে\n' +
          '• কিছুই মুছে যাবে না — আবার চালু করলেই সব আগের মতো'
      );
      if (!confirmed) return;
    }
    setDbBusy(true);
    try {
      const result = await consoleApi.setDatabase(token, next);
      onToast(result.message, next ? 'green' : 'amber');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setDbBusy(false);
    }
  };

  const toggleFreeze = async (next: boolean) => {
    setFreezeBusy(true);
    try {
      const result = await consoleApi.setMaintenance(token, next);
      onToast(result.message, next ? 'amber' : 'green');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setFreezeBusy(false);
    }
  };

  const run = async (key: string, label: string, action: () => Promise<string>) => {
    setActionBusy(key);
    try {
      onToast(`${label}: ${await action()}`, 'green');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setActionBusy(null);
    }
  };

  /* ── first load: honest loading state, no placeholder numbers ─────────── */
  if (!snapshot) {
    return (
      <Panel title="System Status" subtitle="Live operational status">
        <div className="flex items-center gap-3 py-6 text-xs text-[color:var(--ha-muted)]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {loading ? 'Checking system status…' : 'Waiting for the first status update from the server…'}
        </div>
        <Button tone="cyan" busy={loading} onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </Panel>
    );
  }

  const ping = snapshot.mongo.ping;
  const pingCheckedAgo = ping.checkedAt ? sinceLabel(Date.now() - new Date(ping.checkedAt).getTime()) : null;
  const dbOnline = snapshot.mongo.state === 'connected';
  const dbDisabledByOperator = snapshot.mongo.state === 'disabled';
  const dbNotConfigured = snapshot.mongo.state === 'not_configured';

  const dbStatusValue = sync.error
    ? 'UNKNOWN — REFRESH FAILED'
    : dbOnline
      ? 'ONLINE'
      : dbDisabledByOperator
        ? 'OFFLINE — SWITCHED OFF'
        : dbNotConfigured
          ? 'NOT CONFIGURED'
          : 'OFFLINE';
  const dbStatusTone: Tone = sync.error ? 'amber' : dbOnline ? 'green' : dbDisabledByOperator || dbNotConfigured ? 'amber' : 'red';

  // Counts are keyed by the store keys the server reports (heroSlides,
  // galleryPhotos, news, …). A missing key means the server did not report it
  // → the card says "Unavailable" instead of inventing a zero.
  const counts = snapshot.content.counts;
  const countOf = (key: string): { value: number | null; hint: string } => {
    const value = counts[key];
    return typeof value === 'number'
      ? { value, hint: 'records in the content store' }
      : { value: null, hint: 'Unavailable' };
  };
  const photos = countOf('galleryPhotos');
  const videos = countOf('videos');
  const news = countOf('news');
  const projects = countOf('programs');

  const mediaState = snapshot.storage.state;
  const mediaOnline = snapshot.storage.configured && mediaState === 'ok';
  const mediaLabel = !snapshot.storage.configured
    ? 'NOT CONFIGURED'
    : mediaState === 'ok'
      ? 'ONLINE'
      : mediaState === 'checking'
        ? 'CHECKING…'
        : mediaState === 'unknown'
          ? 'UNKNOWN'
          : 'OFFLINE';
  const mediaTone: Tone = !snapshot.storage.configured ? 'red' : mediaState === 'ok' ? 'green' : mediaState === 'checking' || mediaState === 'unknown' ? 'amber' : 'red';

  const activeGateways = snapshot.gateways.items.filter((item) => item.active).length;
  const effective = snapshot.gateways.effective;

  const syncCaption = sync.error
    ? 'Unable to refresh'
    : sync.lastSuccessAt !== null
      ? `Last updated ${sinceLabel(Date.now() - sync.lastSuccessAt)}`
      : 'Waiting for first update';

  return (
    <div className="space-y-5">
      {/* Was on the /admin dashboard; the storage health check belongs here now. */}
      <StorageStatusBanner />

      {/* ── REAL system status ──────────────────────────────────────────── */}
      <Panel
        title="System Status"
        subtitle="Verified server-side on every refresh — a status is only green when the server proved it."
        actions={
          <>
            <Chip
              label="auto-refresh"
              value={`every ${sync.intervalSeconds}s`}
              tone="muted"
            />
            <Chip
              label="sync"
              value={sync.error ? 'Unable to refresh' : sync.syncing ? 'Updating…' : syncCaption}
              tone={sync.error ? 'red' : sync.syncing ? 'cyan' : 'green'}
            />
          </>
        }
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {/* DATABASE — real ping */}
          <div className={`ha-status-card border p-4 ${sync.error ? 'ha-tone-warning' : dbOnline ? 'ha-tone-success' : dbDisabledByOperator || dbNotConfigured ? 'ha-tone-warning' : 'ha-tone-danger'}`}>
            <p className="ha-label">Database</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--ha-muted)]">MongoDB</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold">
              <span
                className={`ha-status-dot ${sync.syncing && !ping.checkedAt ? 'is-checking' : dbOnline && !sync.error ? 'is-online' : 'is-offline'}`}
                aria-hidden="true"
              />
              <span
                className={
                  sync.error
                    ? 'ha-tone-text-warning'
                    : dbOnline
                      ? 'ha-tone-text-success'
                      : dbDisabledByOperator || dbNotConfigured
                        ? 'ha-tone-text-warning'
                        : 'ha-tone-text-danger'
                }
              >
                {dbStatusValue}
              </span>
            </p>
            {sync.error ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-red)]">
                Unable to refresh — the console could not reach the server. Status unknown until the next successful
                fetch.
              </p>
            ) : dbOnline ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
                MongoDB connection verified
                {ping.latencyMs != null ? ` · ping ${ping.latencyMs} ms` : ''}
                {pingCheckedAgo ? ` · Last checked: ${pingCheckedAgo}` : ''}
              </p>
            ) : dbDisabledByOperator ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
                Switched off by an operator. Content is served from memory; nothing is being written.
              </p>
            ) : dbNotConfigured ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
                No database connection is configured on the server. Admin accounts and content cannot be saved.
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
                Unable to reach database
                {ping.error ? ` — ${ping.error}` : '.'}
                {pingCheckedAgo ? ` · Last checked: ${pingCheckedAgo}` : ''}
              </p>
            )}
          </div>

          {/* MEDIA STORAGE — real storage state */}
          <div className={`ha-status-card border p-4 ${mediaTone === 'green' ? 'ha-tone-success' : mediaTone === 'amber' ? 'ha-tone-warning' : 'ha-tone-danger'}`}>
            <p className="ha-label">Media storage</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--ha-muted)]">Photos & videos</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold">
              <span className={`ha-status-dot ${mediaOnline ? 'is-online' : mediaState === 'checking' ? 'is-checking' : 'is-offline'}`} aria-hidden="true" />
              <span className={mediaTone === 'green' ? 'ha-tone-text-success' : mediaTone === 'amber' ? 'ha-tone-text-warning' : 'ha-tone-text-danger'}>
                {mediaLabel}
              </span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
              {!snapshot.storage.configured
                ? 'Image/video uploads are refused until storage is configured.'
                : mediaState === 'ok'
                  ? `Cloudinary${snapshot.storage.cloudName ? ` (${snapshot.storage.cloudName})` : ''}${
                      snapshot.storage.lastCheck ? ` · checked ${timeAgo(snapshot.storage.lastCheck.at)}` : ''
                    }`
                  : snapshot.storage.lastCheck
                    ? `Last check failed ${timeAgo(snapshot.storage.lastCheck.at)}${snapshot.storage.lastCheck.error ? ` — ${snapshot.storage.lastCheck.error}` : ''}`
                    : 'Not checked yet in this process.'}
            </p>
          </div>

          {/* CONTENT — real persistence state */}
          <div className={`ha-status-card border p-4 ${snapshot.content.durable ? 'ha-tone-success' : 'ha-tone-warning'}`}>
            <p className="ha-label">Content</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--ha-muted)]">Records & writes</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-bold">
              <span className={`ha-status-dot ${snapshot.content.durable ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
              <span className={snapshot.content.durable ? 'ha-tone-text-success' : 'ha-tone-text-warning'}>
                {snapshot.content.durable ? 'SAVED TO MongoDB' : 'NOT DURABLE'}
              </span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
              {snapshot.content.totalItems} record{snapshot.content.totalItems === 1 ? '' : 's'} served ·{' '}
              {snapshot.content.pendingWrites} pending change{snapshot.content.pendingWrites === 1 ? '' : 's'} · source:{' '}
              {snapshot.content.source}
              {snapshot.content.lastSavedAt ? ` · last save ${timeAgo(snapshot.content.lastSavedAt)}` : ''}
            </p>
          </div>
        </div>

        {/* ── content metrics: only real counts ───────────────────────────── */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Stat
            label="database"
            value={sync.error ? 'Unavailable' : dbStatusValue}
            hint={sync.error ? 'refresh failed' : `ping verified ${pingCheckedAgo || '—'}`}
            tone={dbStatusTone}
          />
          <Stat
            label="content"
            value={sync.error ? 'Unavailable' : snapshot.content.totalItems}
            hint="total records"
            tone={sync.error ? 'muted' : 'green'}
          />
          <Stat
            label="administrators"
            value={snapshot.admins ? `${snapshot.admins.active}/${snapshot.admins.total}` : 'Unavailable'}
            hint={snapshot.admins ? 'active / total' : 'database offline'}
            tone={snapshot.admins ? 'cyan' : 'muted'}
          />
          <Stat
            label="photo gallery"
            value={photos.value === null ? 'Unavailable' : photos.value}
            hint={photos.hint}
            tone={photos.value === null ? 'muted' : 'green'}
          />
          <Stat
            label="video gallery"
            value={videos.value === null ? 'Unavailable' : videos.value}
            hint={videos.hint}
            tone={videos.value === null ? 'muted' : 'green'}
          />
          <Stat label="news" value={news.value === null ? 'Unavailable' : news.value} hint={news.hint} tone={news.value === null ? 'muted' : 'green'} />
          <Stat label="projects" value={projects.value === null ? 'Unavailable' : projects.value} hint={projects.hint} tone={projects.value === null ? 'muted' : 'green'} />
        </div>
      </Panel>

      {/* the two switches */}
      <Panel
        title="System Control"
        subtitle="রিডিপ্লয় ছাড়াই সার্ভার নিয়ন্ত্রণ — প্রতিটি অ্যাকশন অডিট লগে যায়।"
        actions={
          <Chip
            label="auto-refresh"
            value={`${sync.intervalSeconds}s`}
            tone="muted"
          />
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <PowerSwitch
            label="Database (MongoDB)"
            description="বন্ধ করলে MongoDB সংযোগ বিচ্ছিন্ন হয় — সাইট ক্যাশ থেকে চলে, কোনো লেখা সংরক্ষিত হয় না, এবং শুধুমাত্র এই কনসোল সেশন দিয়েই সব কাজ করা যায়। তথ্য মুছে যায় না।"
            on={dbEnabled}
            busy={dbBusy}
            onText="online"
            offText="switched off"
            danger={!dbEnabled}
            onToggle={toggleDatabase}
          />
          <PowerSwitch
            label="Public Write Freeze"
            description="চালু করলে সাধারণ অ্যাডমিন ও ভিজিটর (জব অ্যাপ্লিকেশন, CV আপলোড) কিছুই সংরক্ষণ করতে পারবে না। কনসোল ও লগইন সবসময় কাজ করবে।"
            on={frozen}
            busy={freezeBusy}
            onText="frozen"
            offText="open"
            danger
            onToggle={toggleFreeze}
          />
        </div>

        {!dbEnabled ? (
          <div className="mt-3">
            <Notice tone="red">
              <span className="inline-flex items-center gap-2 font-bold">
                <ShieldOff className="h-3.5 w-3.5" /> DATABASE IS OFF
              </span>{' '}
              — পাবলিক সাইট এখন শুধু মেমরির স্ন্যাপশট দেখাচ্ছে। কোনো পরিবর্তন সংরক্ষিত হবে না। আবার চালু করলে MongoDB
              রিকানেক্ট হয়ে কন্টেন্ট অটো-সিঙ্ক হবে।
            </Notice>
          </div>
        ) : null}
      </Panel>

      {/* quick actions */}
      <Panel title="Maintenance Actions" subtitle="এক ক্লিকে রক্ষণাবেক্ষণ ও পুনরুদ্ধার কাজ।">
        <div className="flex flex-wrap gap-2">
          <Button
            busy={actionBusy === 'flush'}
            onClick={() =>
              run('flush', 'Pending writes flushed', async () => {
                const result = await consoleApi.flushContent(token);
                return `${result.flushed}টি পরিবর্তন সংরক্ষিত`;
              })
            }
          >
            <UploadCloud className="h-3.5 w-3.5" /> flush writes
          </Button>
          <Button
            tone="cyan"
            busy={actionBusy === 'reload'}
            disabled={!dbEnabled}
            onClick={() =>
              run('reload', 'Content reloaded', async () => {
                const result = await consoleApi.reloadContent(token);
                return `${result.report.totalItems} records (${result.report.source})`;
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" /> reload content
          </Button>
          <Button
            tone="cyan"
            busy={actionBusy === 'backup'}
            disabled={!dbEnabled}
            onClick={() =>
              run('backup', 'Snapshot created', async () => {
                const result = await consoleApi.backupNow(token);
                return `${result.backup.id} (${result.backup.totalItems} records)`;
              })
            }
          >
            <HardDriveDownload className="h-3.5 w-3.5" /> snapshot now
          </Button>
          <Button
            tone="amber"
            busy={actionBusy === 'storage'}
            onClick={() =>
              run('storage', 'Storage re-checked', async () => {
                const res = await fetch('/api/storage/status?verify=1', {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const body = (await res.json().catch(() => ({}))) as {
                  storage?: { state?: string; cloudName?: string; documents?: { configured?: boolean } };
                };
                const state = body.storage?.state || 'unknown';
                return `media ${state}${body.storage?.cloudName ? ` (${body.storage.cloudName})` : ''} · documents ${
                  body.storage?.documents?.configured ? 'configured' : 'not configured'
                }`;
              })
            }
          >
            <Zap className="h-3.5 w-3.5" /> re-check storage
          </Button>
        </div>
      </Panel>

      {/* live state */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Live Telemetry" subtitle={`বর্তমান অবস্থা — প্রতি ${sync.intervalSeconds} সেকেন্ডে হালনাগাদ।`}>
          <Row
            label="mongo status"
            value={sync.error ? 'UNKNOWN (refresh failed)' : dbStatusValue}
            tone={dbStatusTone}
          />
          <Row
            label="last database check"
            value={
              sync.error
                ? 'Unavailable'
                : ping.checkedAt
                  ? `${timeAgo(ping.checkedAt)}${ping.latencyMs != null ? ` · ${ping.latencyMs} ms` : ''}`
                  : 'never'
            }
            tone={sync.error || !ping.checkedAt ? 'muted' : 'green'}
          />
          <Row
            label="media gateway"
            value={
              mediaOnline
                ? `Cloudinary (${snapshot.storage.cloudName || 'configured'})`
                : !snapshot.storage.configured
                  ? 'not configured'
                  : `state: ${mediaState}`
            }
            tone={mediaOnline ? 'green' : 'red'}
          />
          <Row
            label="document gateway"
            value={
              effective?.documents.configured
                ? `${effective.documents.source === 'console' ? 'console-managed' : 'environment'} · configured`
                : 'switched off / not configured'
            }
            tone={effective?.documents.configured ? 'green' : 'red'}
          />
          <Row label="active gateways" value={`${activeGateways}/${snapshot.gateways.total}`} tone="cyan" />
          <Row label="content source" value={`${snapshot.content.source} · ${snapshot.content.records} records`} />
          <Row
            label="pending writes"
            value={snapshot.content.pendingWrites ? `${snapshot.content.pendingWrites} (not saved)` : '0'}
            tone={snapshot.content.pendingWrites ? 'amber' : 'green'}
          />
          <Row
            label="last content load"
            value={snapshot.content.lastLoadedAt ? timeAgo(snapshot.content.lastLoadedAt) : '—'}
            tone="muted"
          />
          <Row
            label="backups"
            value={
              snapshot.backups.count !== null
                ? `${snapshot.backups.count} · last ${snapshot.backups.lastBackupAt ? timeAgo(snapshot.backups.lastBackupAt) : '—'}`
                : 'Unavailable'
            }
            tone={snapshot.backups.count ? 'green' : 'muted'}
          />
          <Row
            label="runtime"
            value={`node ${snapshot.process.node} · ${snapshot.process.platform} · rss ${snapshot.process.memory.rssMb}MB`}
            tone="muted"
          />
        </Panel>

        <Panel
          title="Audit Tail"
          subtitle="সর্বশেষ কার্যক্রম — সম্পূর্ণ লগ Audit Log মডিউলে।"
          actions={
            <Button tone="cyan" onClick={onOpenAudit}>
              open full log
            </Button>
          }
        >
          {audit.length === 0 ? (
            <p className="text-xs text-[color:var(--ha-muted)]">কোনো এন্ট্রি নেই — কোনো কনসোল অ্যাকশন এখনো পর্যন্ত লেখা হয়নি।</p>
          ) : (
            <ul className="space-y-2">
              {audit.slice(0, 8).map((entry) => (
                <li key={entry.id} className="border border-[color:var(--ha-line)] bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em]">
                    <span
                      className={
                        entry.level === 'critical'
                          ? 'text-[color:var(--ha-red)]'
                          : entry.level === 'warn'
                            ? 'text-[color:var(--ha-amber)]'
                            : 'text-[color:var(--ha-green)]'
                      }
                    >
                      {entry.action}
                    </span>
                    <span className="text-[color:var(--ha-muted)]">{timeAgo(entry.at)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[color:var(--ha-text)]">
                    {entry.target ? <span className="text-[color:var(--ha-cyan)]">{entry.target} </span> : null}
                    {entry.detail || '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Edge Cases & Recovery" subtitle="কী হলে কী হবে — কনসোল কখনো বাইরে বন্ধ হয়ে যেতে পারে না।">
        <ul className="space-y-2 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
          <li className="flex gap-2">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-cyan)]" />
            ডাটাবেস বন্ধ থাকলেও এই কনসোল সেশন চালু থাকে (টোকেন MongoDB-তে ভেরিফাই হয় না), তাই আবার চালু করার পথ কখনো
            বন্ধ হয় না।
          </li>
          <li className="flex gap-2">
            <Snowflake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-cyan)]" />
            ফ্রিজ চালু থাকলে কনসোল নিজে এখনো কন্টেন্ট সম্পাদনা করতে পারে — জরুরি সংশোধন আটকে যায় না।
          </li>
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-amber)]" />
            পাসকোড ভুল হলে IP-ভিত্তিক লকআউট (৫s → ৩০s → ২m → ৫m) আর প্রতি ১০ মিনিটে ৮টি চেষ্টার হার-লিমিট কাজ করে;
            প্রতিটি চেষ্টা অডিট লগে লেখা হয়।
          </li>
          <li className="flex gap-2">
            <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-green)]" />
            ডাটাবেস আবার চালু করলে কন্টেন্ট স্বয়ংক্রিয়ভাবে MongoDB থেকে সিঙ্ক হয় এবং ব্যাকআপ শিডিউলার আগের মতোই কাজ করে।
          </li>
          <li className="flex gap-2">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-cyan)]" />
            স্ট্যাটাস যাচাই হয় সার্ভারে অবস্থিত MongoDB `ping` কমান্ড দিয়ে — ব্রাউজারে কোনো ক্যাশড/হার্ডকোডেড স্ট্যাটাস
            দেখানো হয় না।
          </li>
        </ul>
        <p className="mt-3 text-[10px] text-[color:var(--ha-muted)]">
          {syncCaption}
          {sync.error ? ` · ${sync.error}` : ''}
        </p>
      </Panel>
    </div>
  );
};
