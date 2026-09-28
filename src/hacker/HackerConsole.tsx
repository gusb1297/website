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
 * same React modules, styled for the navy administration surface), and the SYSTEM group adds
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
      aria-current={active === module.id ? 'page' : undefined}
      className={`ha-nav-button flex w-full items-center gap-3 px-3 py-2.5 text-left text-[11px] font-semibold transition ${
        active === module.id ? 'is-active' : ''
      }`}
    >
      <span className="ha-nav-code">{module.code}</span>
      <span className="ha-nav-icon">{module.icon}</span>
      <span className="ha-nav-label truncate">{module.label}</span>
    </button>
  );

  return (
    <div className="ha-console min-h-screen">
      {/* Primary console navigation */}
      <header className="ha-topbar sticky top-0 z-30">
        <div className="ha-topbar-inner flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-5">
          <button
            onClick={() => setMenuOpen((value) => !value)}
            className="ha-icon-button lg:hidden"
            aria-label="Toggle module navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link to="/hackeradmin/console" className="ha-brand flex items-center gap-2.5">
            <span className="ha-brand-mark grid h-9 w-9 place-items-center rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="ha-brand-title block text-sm font-bold">Operations Console</span>
              <span className="ha-brand-meta hidden text-[10px] sm:block">
                {user?.name || 'GUSB Administration'} · Secure session
              </span>
            </span>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="ha-header-status hidden xl:flex xl:items-center xl:gap-2">
              <Chip label="MongoDB" value={dbState.toUpperCase()} tone={dbTone} pulse={dbState === 'connected'} />
              <Chip
                label="Media"
                value={mediaGateway ? mediaGateway.host : 'Off'}
                tone={mediaGateway ? 'green' : 'red'}
                pulse={Boolean(mediaGateway)}
              />
              <Chip
                label="Documents"
                value={docGateway ? docGateway.host : 'Off'}
                tone={docGateway ? 'cyan' : 'red'}
                pulse={Boolean(docGateway)}
              />
              {snapshot?.control.maintenanceMode ? <Chip label="Maintenance" value="Active" tone="amber" pulse /> : null}
            </span>
            <span className="ha-header-clock hidden text-[10px] md:block">
              {clock.toLocaleTimeString('en-GB')}
            </span>
            <Link to="/" className="ha-topbar-action">
              <Globe className="h-3.5 w-3.5" />
              <span>Website</span>
            </Link>
            <button
              onClick={() => {
                hackerLogout();
                navigate('/hackeradmin', { replace: true });
              }}
              className="ha-topbar-action ha-topbar-danger"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Compact module navigation for smaller screens */}
        <div className="ha-mobile-nav flex gap-2 overflow-x-auto px-3 py-2 lg:hidden">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => {
                setActive(module.id);
                setMenuOpen(false);
              }}
              aria-current={active === module.id ? 'page' : undefined}
              className={`ha-mobile-nav-button whitespace-nowrap px-3 py-2 text-[10px] font-semibold ${
                active === module.id ? 'is-active' : ''
              }`}
            >
              {module.label}
            </button>
          ))}
        </div>
      </header>

      <div className="ha-layout mx-auto flex w-full max-w-[1600px] gap-5 px-3 py-5 sm:px-5">
        {/* Module navigation */}
        <aside className={`ha-sidebar ${menuOpen ? 'block' : 'hidden'} w-full shrink-0 lg:block lg:w-64`}>
          <div className="space-y-4 lg:sticky lg:top-24">
            <nav className="ha-panel ha-sidebar-nav p-2" aria-label="System control modules">
              <p className="ha-label px-2 pb-2 pt-1">System control</p>
              {systemModules.map(navButton)}
            </nav>
            <nav className="ha-panel ha-sidebar-nav p-2" aria-label="Content management modules">
              <p className="ha-label px-2 pb-2 pt-1">Content management</p>
              <div className="max-h-[46vh] overflow-y-auto pr-1">{contentModules.map(navButton)}</div>
            </nav>
            <div className="ha-panel ha-sidebar-meta p-3 text-[10px] leading-relaxed">
              <p className="ha-meta-line flex items-center gap-2">
                <Server className="h-3.5 w-3.5" />
                {snapshot ? `Uptime ${formatDuration(snapshot.process.uptimeSeconds)}` : 'Connecting to services'}
              </p>
              <p className="ha-meta-line mt-2 flex items-center gap-2">
                <Database className="h-3.5 w-3.5" /> MongoDB {dbState} · {snapshot?.mongo.target || '—'}
              </p>
              <p className="ha-meta-line mt-2 flex items-center gap-2">
                <Cloud className="h-3.5 w-3.5" /> {mediaGateway ? mediaGateway.name : 'Media gateway off'}
              </p>
              <p className="ha-meta-line mt-2 flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5" /> Node {snapshot?.process.node || '—'}
              </p>
              <p className="ha-meta-sync mt-3">{snapshot ? `Last updated ${timeAgo(snapshot.time)}` : 'Waiting for first update'}</p>
            </div>
          </div>
        </aside>

        {/* Active module workspace */}
        <main className="ha-main min-w-0 flex-1">
          <div className="ha-page-heading ha-boot mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ha-module-caption">
                {current.group === 'system' ? 'System control' : 'Content management'}
                <span aria-hidden="true"> / </span>
                {current.code}
              </p>
              <h1 className="ha-module-title mt-1 text-2xl font-bold">{current.label}</h1>
              <p className="ha-module-description mt-1 text-[11px]">{current.description}</p>
            </div>
            <div className="ha-sync-status flex items-center gap-2 text-[10px]">
              <span className={`ha-sync-dot ${syncing ? 'is-syncing' : ''}`} />
              {syncing ? 'Updating system status' : `Last updated ${snapshot ? timeAgo(snapshot.time) : '—'}`}
            </div>
          </div>

          {renderModule()}

          <footer className="ha-console-footer mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-[10px]">
            <span className="inline-flex items-center gap-2">
              <span className="ha-sync-dot" /> Services operational
            </span>
            <span>Audit storage: {auditSource}</span>
            <span>Active gateways: {snapshot?.gateways.enabled ?? 0}</span>
            {snapshot?.content.pendingWrites ? (
              <span className="ha-footer-warning">{snapshot.content.pendingWrites} pending changes</span>
            ) : null}
            <span className="ml-auto">GUSB · Administration</span>
          </footer>
        </main>
      </div>

      {/* Feedback for completed operator actions */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ha-toast ha-toast-${toast.tone} pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed`}>
            <span className="mt-0.5 inline-flex shrink-0">
              {toast.tone === 'red' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
