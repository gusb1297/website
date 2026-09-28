import React, { useState } from 'react';
import {
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
  formatDuration,
  timeAgo,
} from '../api';
import { Button, Chip, Notice, Panel, PowerSwitch, Row, Stat, Tone } from '../ui';
import { StorageStatusBanner } from '../../admin/StorageStatusBanner';

/**
 * CONTROL ROOM — the first screen of the console.
 *
 * The two operator switches (database on/off, public write freeze) sit at the
 * top because they are the reason the console exists; everything below is the
 * live state of the platform and the quick maintenance actions.
 */
export const ControlRoom: React.FC<{
  token: string | null;
  snapshot: SystemSnapshot | null;
  audit: AuditEntry[];
  loading: boolean;
  onRefresh: () => void;
  onToast: (message: string, tone?: Tone) => void;
  onOpenAudit: () => void;
}> = ({ token, snapshot, audit, loading, onRefresh, onToast, onOpenAudit }) => {
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

  if (!snapshot) {
    return (
      <Panel title="Control Room" subtitle="সিস্টেমের অবস্থা পড়া হচ্ছে…">
        <p className="text-xs text-[color:var(--ha-muted)]">সংযোগ করা হচ্ছে…</p>
      </Panel>
    );
  }

  const activeGateways = snapshot.gateways.items.filter((item) => item.active).length;
  const dbTone: Tone = snapshot.mongo.state === 'connected' ? 'green' : dbEnabled ? 'amber' : 'red';
  const mediaGateway = snapshot.gateways.items.find((item) => item.kind === 'cloudinary' && item.active);
  const docGateway = snapshot.gateways.items.find((item) => item.kind === 'am-storage' && item.active);
  const effective = snapshot.gateways.effective;

  return (
    <div className="space-y-5">
      {/* Was on the /admin dashboard; the storage health check belongs here now. */}
      <StorageStatusBanner />

      {/* headline tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat
          label="database"
          value={dbEnabled ? 'ON' : 'OFF'}
          hint={`mongo: ${snapshot.mongo.state}`}
          tone={dbEnabled ? (snapshot.mongo.connected ? 'green' : 'amber') : 'red'}
        />
        <Stat
          label="write freeze"
          value={frozen ? 'ACTIVE' : 'OFF'}
          hint={frozen ? 'সব রাইট আটকে আছে' : 'স্বাভাবিক'}
          tone={frozen ? 'amber' : 'green'}
        />
        <Stat label="gateways" value={`${activeGateways}/${snapshot.gateways.total}`} hint="active / total" tone="cyan" />
        <Stat
          label="admins"
          value={snapshot.admins ? snapshot.admins.active : '—'}
          hint={snapshot.admins ? `মোট ${snapshot.admins.total}` : 'db বন্ধ'}
          tone="cyan"
        />
        <Stat label="content records" value={snapshot.content.totalItems} hint={`pending: ${snapshot.content.pendingWrites}`} />
        <Stat label="uptime" value={formatDuration(snapshot.process.uptimeSeconds)} hint={`pid ${snapshot.process.pid}`} tone="muted" />
      </div>

      {/* the two switches */}
      <Panel
        title="System Control"
        subtitle="রিডিপ্লয় ছাড়াই সার্ভার নিয়ন্ত্রণ — প্রতিটি অ্যাকশন অডিট লগে যায়।"
        actions={<Chip label="auto-refresh" value="10s" tone="muted" pulse />}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <PowerSwitch
            label="Database (MongoDB)"
            description="বন্ধ করলে MongoDB সংযোগ বিচ্ছিন্ন হয় — সাইট ক্যাশ থেকে চলে, কোনো লেখা সংরক্ষিত হয় না, এবং শুধুমাত্র এই কনসোল সেশন দিয়েই সব কাজ করা যায়। তথ্য মুছে যায় না।"
            on={dbEnabled}
            busy={dbBusy}
            onText="online"
            offText="killed"
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
              — পাবলিক সাইট এখন শুধু মেমরির স্ন্যাপশট দেখাচ্ছে। কোনো পরিবর্তন সংরক্ষিত হবে না। আবার চালু করলে MongoDB রিকানেক্ট হয়ে
              কন্টেন্ট অটো-সিঙ্ক হবে।
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
                  storage?: { state?: string; cloudName?: string; documents?: { host?: string; configured?: boolean } };
                };
                const state = body.storage?.state || 'unknown';
                return `media ${state}${body.storage?.cloudName ? ` (${body.storage.cloudName})` : ''} · docs ${
                  body.storage?.documents?.configured ? body.storage.documents.host : 'switched off'
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
        <Panel title="Live Telemetry" subtitle="বর্তমান অবস্থা — প্রতি ১০ সেকেন্ডে হালনাগাদ।">
          <Row
            label="mongo target"
            value={snapshot.mongo.target}
            tone={snapshot.mongo.state === 'connected' ? 'green' : 'red'}
          />
          <Row label="mongo state" value={snapshot.mongo.state.toUpperCase()} tone={dbTone} />
          <Row
            label="media gateway"
            value={
              mediaGateway
                ? `${mediaGateway.host} ${mediaGateway.folder ? `· ${mediaGateway.folder}` : ''}`
                : effective?.media.configured
                  ? `${effective.media.cloudName || 'configured'} (env)`
                  : 'switched off / not configured'
            }
            tone={mediaGateway || effective?.media.configured ? 'green' : 'red'}
          />
          <Row
            label="document gateway"
            value={
              docGateway
                ? docGateway.host
                : effective?.documents.configured
                  ? `${effective.documents.host} (env)`
                  : 'switched off / not configured'
            }
            tone={docGateway || effective?.documents.configured ? 'green' : 'red'}
          />
          <Row label="content source" value={`${snapshot.content.source} · ${snapshot.content.records} records`} />
          <Row
            label="pending writes"
            value={snapshot.content.pendingWrites ? `${snapshot.content.pendingWrites} (not saved)` : '0'}
            tone={snapshot.content.pendingWrites ? 'amber' : 'green'}
          />
          <Row
            label="last content load"
            value={timeAgo(snapshot.content.lastLoadedAt)}
            tone="muted"
          />
          <Row
            label="backups"
            value={`${snapshot.backups.count ?? 0} · last ${timeAgo(snapshot.backups.lastBackupAt)}`}
            tone={snapshot.backups.count ? 'green' : 'amber'}
          />
          <Row label="runtime" value={`node ${snapshot.process.node} · ${snapshot.process.platform} · rss ${snapshot.process.memory.rssMb}MB`} tone="muted" />
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
            <p className="text-xs text-[color:var(--ha-muted)]">এখনো কোনো এন্ট্রি নেই।</p>
          ) : (
            <ul className="space-y-2">
              {audit.slice(0, 8).map((entry) => (
                <li key={entry.id} className="border border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
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
            ডাটাবেস বন্ধ থাকলেও এই কনসোল সেশন চালু থাকে (টোকেন MongoDB-তে ভেরিফাই হয় না), তাই আবার চালু করার পথ কখনো বন্ধ হয় না।
          </li>
          <li className="flex gap-2">
            <Snowflake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-cyan)]" />
            ফ্রিজ চালু থাকলে কনসোল নিজে এখনো কন্টেন্ট সম্পাদনা করতে পারে — জরুরি সংশোধন আটকে যায় না।
          </li>
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-amber)]" />
            পাসকোড ভুল হলে IP-ভিত্তিক লকআউট (৫s → ৩০s → ২m → ৫m) আর প্রতি ১০ মিনিটে ৮টি চেষ্টার হার-লিমিট কাজ করে; প্রতিটি
            চেষ্টা অডিট লগে লেখা হয়।
          </li>
          <li className="flex gap-2">
            <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-green)]" />
            ডাটাবেস আবার চালু করলে কন্টেন্ট স্বয়ংক্রিয়ভাবে MongoDB থেকে সিঙ্ক হয় এবং ব্যাকআপ শিডিউলার আগের মতোই কাজ করে।
          </li>
        </ul>
        <p className="mt-3 text-[10px] text-[color:var(--ha-muted)]">
          {loading ? 'syncing…' : `last sync ${timeAgo(snapshot.time)} · session ${snapshot.session.passcodeFromEnvironment ? 'env passcode' : 'built-in passcode'}`}
        </p>
      </Panel>
    </div>
  );
};
