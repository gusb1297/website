import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Briefcase,
  Cloud,
  Cpu,
  Database,
  DatabaseBackup,
  FileText,
  Gauge,
  Globe,
  Handshake,
  History,
  Image as ImageIcon,
  LayoutTemplate,
  LogOut,
  Menu,
  Newspaper,
  Plug,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Sliders,
  Sprout,
  Users,
  UserCog,
  Video,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuditEntry, GatewayListResponse, SystemSnapshot, consoleApi, formatDuration, timeAgo } from './api';
import { Chip, Tone } from './ui';
import { ControlRoom } from './panels/ControlRoom';
import { GatewayPanel } from './panels/GatewayPanel';
import { ConsoleAdminsPanel } from './panels/ConsoleAdminsPanel';
import { AuditPanel } from './panels/AuditPanel';
import { TelemetryPanel } from './panels/TelemetryPanel';
import { ManageHeroSlider } from '../admin/ManageHeroSlider';
import { ManagePages } from '../admin/ManagePages';
import { ManagePrograms } from '../admin/ManagePrograms';
import { ManageNews } from '../admin/ManageNews';
import { ManageVideos } from '../admin/ManageVideos';
import { ManageGallery } from '../admin/ManageGallery';
import { ManagePublications } from '../admin/ManagePublications';
import { ManageNotices } from '../admin/ManageNotices';
import { ManageCareer } from '../admin/ManageCareer';
import { ManageCommittee } from '../admin/ManageCommittee';
import { ManagePartners } from '../admin/ManagePartners';
import { ManageStats } from '../admin/ManageStats';
import { ManageSettings } from '../admin/ManageSettings';
import { ManageBackups } from '../admin/ManageBackups';

type ModuleId =
  | 'control'
  | 'gateways'
  | 'admins'
  | 'audit'
  | 'telemetry'
  | 'slides'
  | 'pages'
  | 'programs'
  | 'news'
  | 'videos'
  | 'gallery'
  | 'publications'
  | 'notices'
  | 'career'
  | 'committee'
  | 'partners'
  | 'stats'
  | 'settings'
  | 'backups';

interface ModuleDef {
  id: ModuleId;
  code: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  group: 'system' | 'content';
  element?: React.ReactNode;
}

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

/**
 * /hackeradmin/console — the operations console.
 *
 * Everything the old /admin panel could do lives in the CONTENT group (the very
 * same React modules, repainted for the dark surface), and the SYSTEM group adds
 * what only this console can do: switch the database off/on, freeze public
 * writes, manage the storage gateways, create admin accounts and read the audit
 * trail.
 */
export const HackerConsole: React.FC = () => {
  const { token, user, hackerLogout, isHackerSession, hackerSessionExpired } = useAuth();
  const navigate = useNavigate();

  const [active, setActive] = useState<ModuleId>('control');
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [gateways, setGateways] = useState<GatewayListResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditSource, setAuditSource] = useState<'mongodb' | 'memory'>('memory');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [syncing, setSyncing] = useState(false);
  const toastId = useRef(0);

  const pushToast = useCallback((message: string, tone: Tone = 'green') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((list) => [...list, { id, message, tone }].slice(-4));
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 6500);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const [system, auditLog] = await Promise.all([
        consoleApi.system(token),
        consoleApi.audit(token, 120).catch(() => ({ entries: [] as AuditEntry[], source: 'memory' as const, status: null })),
      ]);
      setSnapshot(system);
      setGateways(system.gateways);
      setAudit(auditLog.entries);
      setAuditSource(auditLog.source);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        pushToast('কনসোল সেশন শেষ — আবার পাসকোড দিন।', 'red');
        navigate('/hackeradmin', { replace: true });
        return;
      }
      pushToast((err as Error).message, 'red');
    } finally {
      setSyncing(false);
    }
  }, [token, navigate, pushToast]);

  useEffect(() => {
    if (!isHackerSession) {
      navigate('/hackeradmin', { replace: true, state: { message: hackerSessionExpired } });
      return;
    }
    void refresh();
    const poll = setInterval(() => void refresh(), 10_000);
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHackerSession, refresh]);

  const modules: ModuleDef[] = useMemo(
    () => [
      {
        id: 'control',
        code: '00',
        label: 'Control Room',
        description: 'Master switches, maintenance actions, live state',
        icon: <Gauge className="h-4 w-4" />,
        group: 'system',
      },
      {
        id: 'gateways',
        code: '01',
        label: 'Gateways',
        description: 'Add, test, disable and delete storage gateways',
        icon: <Plug className="h-4 w-4" />,
        group: 'system',
      },
      {
        id: 'admins',
        code: '02',
        label: 'Admin Accounts',
        description: 'Create / disable / delete administrator logins',
        icon: <UserCog className="h-4 w-4" />,
        group: 'system',
      },
      {
        id: 'audit',
        code: '03',
        label: 'Audit Log',
        description: 'Every privileged action, rate-limited attempts included',
        icon: <History className="h-4 w-4" />,
        group: 'system',
      },
      {
        id: 'telemetry',
        code: '04',
        label: 'Telemetry',
        description: 'Process, MongoDB, storage, collections, snapshots',
        icon: <Activity className="h-4 w-4" />,
        group: 'system',
      },
      { id: 'slides', code: '10', label: 'Hero Slider', description: 'হোম পেজের স্লাইডার', icon: <Sliders className="h-4 w-4" />, group: 'content', element: <ManageHeroSlider /> },
      { id: 'pages', code: '11', label: 'Home & About', description: 'হোম ও About কন্টেন্ট', icon: <LayoutTemplate className="h-4 w-4" />, group: 'content', element: <ManagePages /> },
      { id: 'programs', code: '12', label: 'Projects', description: 'প্রজেক্টসমূহ', icon: <Sprout className="h-4 w-4" />, group: 'content', element: <ManagePrograms /> },
      { id: 'news', code: '13', label: 'News & Events', description: 'সংবাদ ও ইভেন্ট', icon: <Newspaper className="h-4 w-4" />, group: 'content', element: <ManageNews /> },
      { id: 'videos', code: '14', label: 'Video Gallery', description: 'ভিডিও গ্যালারি', icon: <Video className="h-4 w-4" />, group: 'content', element: <ManageVideos /> },
      { id: 'gallery', code: '15', label: 'Photo Gallery', description: 'ফটো গ্যালারি', icon: <ImageIcon className="h-4 w-4" />, group: 'content', element: <ManageGallery /> },
      { id: 'publications', code: '16', label: 'Publications', description: 'পাবলিকেশন (PDF)', icon: <BookOpen className="h-4 w-4" />, group: 'content', element: <ManagePublications /> },
      { id: 'notices', code: '17', label: 'Notice Board', description: 'নোটিশ বোর্ড', icon: <FileText className="h-4 w-4" />, group: 'content', element: <ManageNotices /> },
      { id: 'career', code: '18', label: 'Career', description: 'ক্যারিয়ার ও আবেদন', icon: <Briefcase className="h-4 w-4" />, group: 'content', element: <ManageCareer /> },
      { id: 'committee', code: '19', label: 'Committee', description: 'পরিচালনা পরিষদ', icon: <Users className="h-4 w-4" />, group: 'content', element: <ManageCommittee /> },
      { id: 'partners', code: '1A', label: 'Partners', description: 'পার্টনার ও ডোনার', icon: <Handshake className="h-4 w-4" />, group: 'content', element: <ManagePartners /> },
      { id: 'stats', code: '1B', label: 'Statistics', description: 'পরিসংখ্যান কাউন্টার', icon: <Gauge className="h-4 w-4" />, group: 'content', element: <ManageStats /> },
      { id: 'settings', code: '1C', label: 'Site Settings', description: 'ওয়েবসাইট সেটিংস ও রঙ', icon: <SettingsIcon className="h-4 w-4" />, group: 'content', element: <ManageSettings /> },
      { id: 'backups', code: '1D', label: 'Backups & Restore', description: 'ব্যাকআপ ও রিস্টোর', icon: <DatabaseBackup className="h-4 w-4" />, group: 'content', element: <ManageBackups /> },
    ],
    []
  );

  const current = modules.find((module) => module.id === active) || modules[0];
  const systemModules = modules.filter((module) => module.group === 'system');
  const contentModules = modules.filter((module) => module.group === 'content');

  const dbState = snapshot?.mongo.state || 'unknown';
  const dbTone: Tone = dbState === 'connected' ? 'green' : snapshot?.control.databaseEnabled ? 'amber' : 'red';
  const mediaGateway = snapshot?.gateways.items.find((item) => item.kind === 'cloudinary' && item.active);
  const docGateway = snapshot?.gateways.items.find((item) => item.kind === 'am-storage' && item.active);

  const renderModule = () => {
    switch (active) {
      case 'control':
        return (
          <ControlRoom
            token={token}
            snapshot={snapshot}
            audit={audit}
            loading={syncing}
            onRefresh={() => void refresh()}
            onToast={pushToast}
            onOpenAudit={() => setActive('audit')}
          />
        );
      case 'gateways':
        return <GatewayPanel token={token} data={gateways} onReload={() => void refresh()} onToast={pushToast} />;
      case 'admins':
        return (
          <ConsoleAdminsPanel token={token} snapshot={snapshot} onToast={pushToast} onReload={() => void refresh()} />
        );
      case 'audit':
        return (
          <AuditPanel
            token={token}
            entries={audit}
            source={auditSource}
            onToast={pushToast}
            onReload={() => void refresh()}
          />
        );
      case 'telemetry':
        return <TelemetryPanel snapshot={snapshot} />;
      default:
        return (
          <div className="ha-window">
            <div className="ha-window-bar">
              <span className="ha-window-dot" />
              <span>{current.label}</span>
              <span className="ml-auto text-[10px] text-[color:var(--ha-muted)]">
                module {current.code} · content editor
              </span>
            </div>
            <div className="p-3 sm:p-4">{current.element}</div>
          </div>
        );
    }
  };

  const navButton = (module: ModuleDef) => (
    <button
      key={module.id}
      onClick={() => {
        setActive(module.id);
        setMenuOpen(false);
      }}
      className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] transition ${
        active === module.id
          ? 'border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.12)] text-[color:var(--ha-green)]'
          : 'border-transparent text-[color:var(--ha-muted)] hover:border-[color:var(--ha-line)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[color:var(--ha-text)]'
      }`}
    >
      <span className="text-[10px] text-[color:var(--ha-green-dim)]">{module.code}</span>
      {module.icon}
      <span className="truncate">{module.label}</span>
    </button>
  );

  return (
    <div className="ha-dark min-h-screen">
      {/* ── top rail ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--ha-line)] bg-[rgba(4,8,10,0.92)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-5">
          <button
            onClick={() => setMenuOpen((value) => !value)}
            className="border border-[color:var(--ha-line)] p-2 text-[color:var(--ha-green)] lg:hidden"
            aria-label="Toggle modules"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link to="/hackeradmin/console" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center border border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.1)] text-[color:var(--ha-green)]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-[11px] font-bold uppercase tracking-[0.28em] text-[color:var(--ha-green)]">
                operations console
              </span>
              <span className="block text-[10px] text-[color:var(--ha-muted)]">
                {user?.name || 'Operations Console'} · passcode session
              </span>
            </span>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="hidden xl:flex xl:items-center xl:gap-2">
              <Chip label="mongo" value={dbState.toUpperCase()} tone={dbTone} pulse={dbState === 'connected'} />
              <Chip
                label="media"
                value={mediaGateway ? mediaGateway.host : 'off'}
                tone={mediaGateway ? 'green' : 'red'}
                pulse={Boolean(mediaGateway)}
              />
              <Chip
                label="docs"
                value={docGateway ? docGateway.host : 'off'}
                tone={docGateway ? 'cyan' : 'red'}
                pulse={Boolean(docGateway)}
              />
              {snapshot?.control.maintenanceMode ? <Chip label="freeze" value="active" tone="amber" pulse /> : null}
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)] md:block">
              {clock.toLocaleTimeString('en-GB')}
            </span>
            <Link
              to="/"
              className="border border-[color:var(--ha-line)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ha-muted)] transition hover:text-[color:var(--ha-green)]"
            >
              <Globe className="mr-1 inline h-3.5 w-3.5" /> site
            </Link>
            <button
              onClick={() => {
                hackerLogout();
                navigate('/hackeradmin', { replace: true });
              }}
              className="border border-[rgba(255,77,94,0.45)] bg-[rgba(255,77,94,0.12)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--ha-red)] transition hover:bg-[rgba(255,77,94,0.2)]"
            >
              <LogOut className="mr-1 inline h-3.5 w-3.5" /> logout
            </button>
          </div>
        </div>

        {/* mobile module strip */}
        <div className="flex gap-2 overflow-x-auto border-t border-[color:var(--ha-line)] px-3 py-2 lg:hidden">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActive(module.id)}
              className={`whitespace-nowrap border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                active === module.id
                  ? 'border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.12)] text-[color:var(--ha-green)]'
                  : 'border-[color:var(--ha-line)] text-[color:var(--ha-muted)]'
              }`}
            >
              {module.code} · {module.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-5 px-3 py-4 sm:px-5">
        {/* ── sidebar ────────────────────────────────────────────────────── */}
        <aside className={`${menuOpen ? 'block' : 'hidden'} w-full shrink-0 lg:block lg:w-64`}>
          <div className="space-y-4 lg:sticky lg:top-24">
            <nav className="ha-panel p-2">
              <p className="ha-label px-2 pb-2 pt-1">system control</p>
              {systemModules.map(navButton)}
            </nav>
            <nav className="ha-panel p-2">
              <p className="ha-label px-2 pb-2 pt-1">content modules</p>
              <div className="max-h-[46vh] overflow-y-auto pr-1">{contentModules.map(navButton)}</div>
            </nav>
            <div className="ha-panel p-3 text-[10px] leading-relaxed text-[color:var(--ha-muted)]">
              <p className="flex items-center gap-2 text-[color:var(--ha-green)]">
                <Server className="h-3.5 w-3.5" /> {snapshot ? `uptime ${formatDuration(snapshot.process.uptimeSeconds)}` : 'connecting…'}
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Database className="h-3.5 w-3.5" /> mongo {dbState} · {snapshot?.mongo.target || '—'}
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Cloud className="h-3.5 w-3.5" /> {mediaGateway ? mediaGateway.name : 'media gateway off'}
              </p>
              <p className="mt-1 flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5" /> node {snapshot?.process.node || '—'}
              </p>
              <p className="mt-2 text-[color:var(--ha-green-dim)]">
                {snapshot ? `synced ${timeAgo(snapshot.time)}` : 'waiting for first sync'}
              </p>
            </div>
          </div>
        </aside>

        {/* ── module surface ─────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1">
          <div className="ha-boot mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ha-label">
                module {current.code} · {current.group === 'system' ? 'system control' : 'content'}
              </p>
              <h1 className="mt-1 text-xl font-bold uppercase tracking-[0.16em] text-[color:var(--ha-green)] ha-glow">
                {current.label}
              </h1>
              <p className="mt-1 text-[11px] text-[color:var(--ha-muted)]">{current.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">
                {syncing ? 'syncing…' : `last sync ${snapshot ? timeAgo(snapshot.time) : '—'}`}
              </span>
            </div>
          </div>

          {renderModule()}

          <footer className="mt-5 flex flex-wrap items-center gap-3 border-t border-[color:var(--ha-line)] pt-3 text-[10px] uppercase tracking-[0.16em] text-[color:var(--ha-muted)]">
            <span className="inline-flex items-center gap-2 text-[color:var(--ha-green)]">
              <span className="ha-dot-live inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--ha-green)]" /> console online
            </span>
            <span>audit: {auditSource}</span>
            <span>gateways: {snapshot?.gateways.enabled ?? 0} enabled</span>
            {snapshot?.content.pendingWrites ? (
              <span className="text-[color:var(--ha-amber)]">{snapshot.content.pendingWrites} pending writes</span>
            ) : null}
            <span className="ml-auto">vdo_bogura · operations</span>
          </footer>
        </main>
      </div>

      {/* ── toasts ───────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`ha-boot pointer-events-auto border px-3 py-2 text-[11px] leading-relaxed ${
              toast.tone === 'red'
                ? 'border-[rgba(255,77,94,0.5)] bg-[rgba(40,6,10,0.95)] text-[#ffb3ba]'
                : toast.tone === 'amber'
                  ? 'border-[rgba(255,181,69,0.5)] bg-[rgba(38,26,4,0.95)] text-[#ffdca8]'
                  : 'border-[color:var(--ha-line-strong)] bg-[rgba(6,20,15,0.95)] text-[#c8f7e0]'
            }`}
          >
            <span className="mr-2 inline-flex align-middle">
              {toast.tone === 'red' ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};
