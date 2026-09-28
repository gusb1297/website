import React from 'react';
import { Activity, Cpu, Database, HardDrive, Server, Timer } from 'lucide-react';
import { SystemSnapshot, formatDuration, timeAgo } from '../api';
import { Chip, Notice, Panel, Row } from '../ui';

/**
 * TELEMETRY — the raw state of the platform: process, MongoDB, Cloudinary,
 * document gateway, per-collection content counts, snapshots and the console
 * session itself.
 */
export const TelemetryPanel: React.FC<{ snapshot: SystemSnapshot | null }> = ({ snapshot }) => {
  if (!snapshot) {
    return (
      <Panel title="Telemetry">
        <p className="text-xs text-[color:var(--ha-muted)]">লোড হচ্ছে…</p>
      </Panel>
    );
  }

  const { process: proc, mongo, storage, content, backups, control, gateways, session, audit } = snapshot;

  return (
    <div className="space-y-5">
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
            <Cpu className="h-3.5 w-3.5" /> এই রিডিংগুলো প্রতি ১০ সেকেন্ডে রিফ্রেশ হয়।
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
          <Row label="target" value={mongo.target} />
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
            label="documents"
            value={storage.documents.configured ? storage.documents.host : 'switched off / not configured'}
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
          <Row label="last load" value={timeAgo(content.lastLoadedAt)} tone="muted" />
          <Row label="last save" value={timeAgo(content.lastSavedAt)} tone="muted" />
          <Row
            label="backups"
            value={`${backups.count ?? 0} snapshots · every ${backups.intervalMinutes}m · keep ${backups.keep}`}
          />
          <Row label="last backup" value={timeAgo(backups.lastBackupAt)} tone={backups.lastBackupAt ? 'green' : 'amber'} />
          <Row label="next run" value={backups.nextRunAt ? timeAgo(backups.nextRunAt) : '—'} tone="muted" />
          {backups.lastError ? <Notice tone="red">{backups.lastError}</Notice> : null}
        </Panel>
      </div>

      <Panel
        title="Content Collections"
        subtitle="প্রতি কলেেকশনে কত রেকর্ড আছে (MongoDB ↔ মেমরি স্টোর)।"
        actions={
          <>
            <Chip label="collections" value={String(content.collections.length)} tone="cyan" />
            <Chip label="audit" value={`${audit.inMemory} in memory`} tone="muted" />
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {content.collections.map((collection) => (
            <div key={collection} className="border border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
              <p className="ha-label truncate">{collection}</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[color:var(--ha-green)]">
                <HardDrive className="h-3.5 w-3.5" />
                {content.counts[collection] ?? 0}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-[10px] text-[color:var(--ha-muted)]">
          <Server className="h-3.5 w-3.5" /> মিডিয়া ফাইলগুলো MongoDB-তে থাকে না — সেগুলো গেটওয়েতে (Cloudinary / AM Storage) থাকে,
          রেকর্ডে শুধু URL ও public id সংরক্ষিত।
        </p>
      </Panel>

      <Panel title="Console Session" actions={<Chip label="passcode" value={session.passcodeFromEnvironment ? 'env' : 'built-in'} tone="cyan" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Row label="passcode length" value={`${session.passcodeLength} characters`} tone="muted" />
            <Row label="throttled ips" value={`${session.throttle.trackedIps} tracked · ${session.throttle.lockedIps} locked`} tone={session.throttle.lockedIps ? 'amber' : 'green'} />
            <Row label="audit writes" value={`${audit.databaseWrites} stored · ${audit.databaseFailures} failed`} tone={audit.databaseFailures ? 'amber' : 'green'} />
          </div>
          <div className="border border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.02)] p-3 text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
            <p className="flex items-center gap-2 text-[color:var(--ha-green)]">
              <Activity className="h-3.5 w-3.5" /> {gateways.items.filter((item) => item.active).length} gateway(s) actively routing uploads
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" /> server time {new Date(snapshot.time).toLocaleTimeString('en-GB')} · polled {timeAgo(snapshot.time)}
            </p>
            <p className="mt-2 flex items-center gap-2">
              <Database className="h-3.5 w-3.5" /> mongo target {mongo.target} · {mongo.configured ? 'uri configured' : 'uri missing'}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};
