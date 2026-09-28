import React from 'react';
import { Activity, AlertTriangle, Cpu, Database, HardDrive, RefreshCw, Server, Timer } from 'lucide-react';
import { SystemSnapshot, formatDuration, timeAgo } from '../api';
import { Chip, Notice, Panel, Row } from '../ui';

/**
 * TELEMETRY — the raw state of the platform: process, MongoDB (verified with a
 * real ping), Cloudinary, document gateway, per-collection content counts,
 * snapshots and the console session itself.
 */
export const TelemetryPanel: React.FC<{
  snapshot: SystemSnapshot | null;
  loading?: boolean;
  syncError?: string | null;
}> = ({ snapshot, loading, syncError }) => {
  if (!snapshot) {
    return (
      <Panel title="Telemetry">
        <p className="flex items-center gap-2 text-xs text-[color:var(--ha-muted)]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {syncError
            ? `স্ট্যাটাস আনা যায়নি — ${syncError}`
            : loading
              ? 'লোড হচ্ছে…'
              : 'প্রথম স্ট্যাটাস আপডেটের অপেক্ষায়…'}
        </p>
        {!loading && syncError ? (
          <Notice tone="red">সার্ভারে পৌঁছানো যাচ্ছে না — কিছুক্ষণ পর আবার চেষ্টা করুন।</Notice>
        ) : null}
      </Panel>
    );
  }

  const { process: proc, mongo, storage, content, backups, control, gateways, session, audit } = snapshot;
  const ping = mongo.ping;

  return (
    <div className="space-y-5">
      {syncError ? (
        <Notice tone="red">
          <span className="inline-flex items-center gap-2 font-bold">
            <AlertTriangle className="h-3.5 w-3.5" /> Unable to refresh — সার্ভার থেকে সাম্প্রতিক ডেটা আনা যায়নি (
            {syncError})। নিচের তথ্যগুলো সর্বশেষ সফল ফেচের।
          </span>
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Runtime"
          actions={<Chip label="env" value={proc.environment} tone="cyan" />}
        >
          <Row label="uptime" value={formatDuration(proc.uptimeSeconds)} />
          <Row label="started" value={new Date(proc.startedAt).toLocaleString('en-GB')} tone="muted" />
          <Row label="node" value={proc.node} />
          <Row label="platform" value={proc.platform} tone="muted" />
          <Row label="pid" value={String(proc.pid)} tone="muted" />
          <Row label="memory" value={`rss ${proc.memory.rssMb} MB · heap ${proc.memory.heapUsedMb} MB`} tone="cyan" />
          <p className="mt-3 flex items-center gap-2 text-[10px] text-[color:var(--ha-muted)]">
            <Cpu className="h-3.5 w-3.5" /> এই রিডিংগুলো সার্ভার থেকে আসে এবং প্রতিটি রিফ্রেশে নতুন করে পড়া হয়।
          </p>
        </Panel>

        <Panel
          title="MongoDB"
          actions={
            <Chip
              label="state"
              value={mongo.state}
              tone={mongo.state === 'connected' ? 'green' : mongo.state === 'disabled' ? 'red' : 'amber'}
              pulse={mongo.state === 'connected'}
            />
          }
        >
          <Row
            label="ping check"
            value={
              ping.ok
                ? `ok${ping.latencyMs != null ? ` · ${ping.latencyMs} ms` : ''} · ${timeAgo(ping.checkedAt)}`
                : `failed · ${timeAgo(ping.checkedAt)}`
            }
            tone={ping.ok ? 'green' : 'red'}
          />
          {ping.error && !ping.ok ? <Notice tone="red">{ping.error}</Notice> : null}
          <Row label="operator switch" value={control.databaseEnabled ? 'ON' : 'OFF'} tone={control.databaseEnabled ? 'green' : 'red'} />
          <Row label="disabled at" value={control.databaseDisabledAt ? timeAgo(control.databaseDisabledAt) : '—'} tone="muted" />
          <Row label="reconnect loop" value={mongo.reconnectLoop} tone="muted" />
          <Row label="write freeze" value={control.maintenanceMode ? 'ACTIVE' : 'off'} tone={control.maintenanceMode ? 'amber' : 'green'} />
          <Row label="control state" value={`${control.source}${control.persisted ? '' : ' · unsaved'}`} tone={control.persisted ? 'green' : 'amber'} />
        </Panel>

        <Panel
          title="Storage"
          actions={<Chip label="media" value={storage.state} tone={storage.configured ? 'green' : 'red'} pulse={storage.configured} />}
        >
          <Row label="cloudinary cloud" value={storage.cloudName || '—'} />
          <Row label="folder" value={storage.folder || '—'} tone="muted" />
          <Row label="last check" value={storage.lastCheck ? `${storage.lastCheck.state || (storage.lastCheck.ok ? 'ok' : 'failed')} · ${timeAgo(storage.lastCheck.at)}` : 'not checked yet'} />
          <Row
            label="document gateway"
            value={storage.documents.configured ? `${storage.documents.provider} · configured` : 'switched off / not configured'}
            tone={storage.documents.configured ? 'green' : 'red'}
          />
          <Row label="gateway registry" value={`${gateways.total} records · ${gateways.loaded ? 'loaded' : 'not loaded'}`} />
          <Row label="db collection" value={gateways.collection} tone="muted" />
          {storage.hint ? <Notice tone="amber">{storage.hint}</Notice> : null}
        </Panel>

        <Panel
          title="Content & Snapshots"
          actions={<Chip label="source" value={content.source} tone={content.durable ? 'green' : 'amber'} />}
        >
          <Row label="records" value={`${content.records} (${content.totalItems} tracked)`} />
          <Row label="pending writes" value={String(content.pendingWrites)} tone={content.pendingWrites ? 'amber' : 'green'} />
          <Row label="last load" value={content.lastLoadedAt ? timeAgo(content.lastLoadedAt) : '—'} tone="muted" />
          <Row label="last save" value={content.lastSavedAt ? timeAgo(content.lastSavedAt) : '—'} tone="muted" />
          <Row
            label="backups"
            value={
              backups.count !== null
                ? `${backups.count} snapshots · every ${backups.intervalMinutes}m · keep ${backups.keep}`
                : 'Unavailable'
            }
            tone={backups.count !== null ? 'cyan' : 'muted'}
          />
          <Row label="last backup" value={backups.lastBackupAt ? timeAgo(backups.lastBackupAt) : '—'} tone={backups.lastBackupAt ? 'green' : 'amber'} />
          <Row label="next run" value={backups.nextRunAt ? timeAgo(backups.nextRunAt) : '—'} tone="muted" />
          {backups.lastError ? <Notice tone="red">{backups.lastError}</Notice> : null}
        </Panel>
      </div>

      <Panel
        title="Content Collections"
        subtitle="প্রতিটি কালেকশনে কত রেকর্ড আছে (MongoDB ↔ মেমরি স্টোর)।"
        actions={
          <>
            <Chip label="collections" value={String(content.collections.length)} tone="cyan" />
            <Chip label="audit" value={`${audit.inMemory} in memory`} tone="muted" />
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* `counts` is keyed the way the server reports it (heroSlides,
              galleryPhotos, …) — rendered directly so the numbers shown are
              exactly the numbers the backend returned. */}
          {Object.entries(content.counts)
            .filter(([key]) => key !== '__total')
            .map(([key, value]) => (
              <div key={key} className="border border-[color:var(--ha-line)] bg-slate-50 px-3 py-2">
                <p className="ha-label truncate">{key}</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[color:var(--ha-green)]">
                  <HardDrive className="h-3.5 w-3.5" />
                  {value}
                </p>
              </div>
            ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-[10px] text-[color:var(--ha-muted)]">
          <Server className="h-3.5 w-3.5" /> মিডিয়া ফাইলগুলো MongoDB-তে থাকে না — সেগুলো গেটওয়েতে (Cloudinary / AM
          Storage) থাকে, রেকর্ডে শুধু URL ও public id সংরক্ষিত।
        </p>
      </Panel>

      <Panel title="Console Session" actions={<Chip label="passcode" value={session.passcodeFromEnvironment ? 'env' : 'built-in'} tone="cyan" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Row label="throttled ips" value={`${session.throttle.trackedIps} tracked · ${session.throttle.lockedIps} locked`} tone={session.throttle.lockedIps ? 'amber' : 'green'} />
            <Row label="audit writes" value={`${audit.databaseWrites} stored · ${audit.databaseFailures} failed`} tone={audit.databaseFailures ? 'amber' : 'green'} />
            <Row label="database config" value={mongo.configured ? 'URI configured' : 'URI missing'} tone={mongo.configured ? 'green' : 'red'} />
          </div>
          <div className="border border-[color:var(--ha-line)] bg-slate-50 p-3 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
            <p className="flex items-center gap-2 text-[color:var(--ha-green)]">
              <Activity className="h-3.5 w-3.5" /> {gateways.items.filter((item) => item.active).length} gateway(s) actively routing uploads
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" /> server time {new Date(snapshot.time).toLocaleTimeString('en-GB')} · polled {timeAgo(snapshot.time)}
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Database className="h-3.5 w-3.5" /> {mongo.configured ? 'Connection URI configured' : 'Connection URI missing'} · connection state {mongo.state}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};
