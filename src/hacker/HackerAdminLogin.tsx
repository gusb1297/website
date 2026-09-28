import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, ShieldAlert, Terminal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * /hackeradmin — the passcode gate of the operations console.
 *
 * Deliberately its own page, separate from /admin/login: one passcode field, no
 * account e-mail, and a dark terminal surface. Everything the console can do
 * (switch the database off, add/remove gateways, create admins) sits behind this
 * single door, so the gate is strict: rate-limited, throttled per IP and audited.
 */
export const HackerAdminLogin: React.FC = () => {
  const { hackerLogin, isHackerSession } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [passcode, setPasscode] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockSeconds, setLockSeconds] = useState(0);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [clock, setClock] = useState(() => new Date());

  // A live console session can walk straight in.
  useEffect(() => {
    if (isHackerSession) navigate('/hackeradmin/console', { replace: true });
  }, [isHackerSession, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Short boot log — it makes the surface feel like a console and shows that
  // the page really is talking to the server.
  const boot = useMemo(
    () => [
      'booting secure channel …',
      'verifying operator endpoint …',
      'loading access policy …',
      'ready — passcode required',
    ],
    []
  );
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setBootLines(boot.slice(0, index));
      if (index >= boot.length) clearInterval(timer);
    }, 320);
    return () => clearInterval(timer);
  }, [boot]);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = setInterval(() => setLockSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [lockSeconds]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || lockSeconds > 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/hackeradmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        token?: string;
        user?: { id: string; name: string; email: string; role: 'admin' };
        message?: string;
        retryAfterSeconds?: number;
      };

      if (!res.ok || !body.token || !body.user) {
        setError(body.message || 'প্রবেশ অনুমোদিত হয়নি।');
        if (body.retryAfterSeconds) setLockSeconds(Math.ceil(body.retryAfterSeconds));
        setPasscode('');
        return;
      }

      hackerLogin(body.token, body.user);
      navigate('/hackeradmin/console', { replace: true });
    } catch {
      setError('সার্ভারে পৌঁছানো যাচ্ছে না — ইন্টারনেট সংযোগ দেখুন।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ha-dark ha-scanlines relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* top rail */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[color:var(--ha-line)] px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--ha-muted)] sm:px-6">
        <span className="inline-flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-[color:var(--ha-green)]" /> vdo · operations console
        </span>
        <span className="hidden sm:inline">passcode gate</span>
        <span>{clock.toLocaleTimeString('en-GB')} utc</span>
      </div>

      <div className="ha-boot ha-panel w-full max-w-lg p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 border border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.06)] px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[color:var(--ha-green)]">
            <span className="ha-dot-live inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--ha-green)]" />
            Restricted · Operations
          </span>
        </div>

        <h1 className="ha-glow ha-flicker text-center text-2xl font-bold tracking-tight text-[color:var(--ha-green)] sm:text-3xl">
          Control Panel Access
        </h1>

        <p className="mx-auto mt-4 max-w-md text-center text-[11px] leading-relaxed text-[color:var(--ha-muted)]">
          This console is protected by a private access passcode held only by the registered security operator. It can
          switch the database and every storage gateway, so access is limited to a single keyholder.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="ha-passcode" className="ha-label mb-2 block">
              Access passcode
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ha-green-dim)]" />
              <input
                id="ha-passcode"
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={busy || lockSeconds > 0}
                placeholder="••••••••••"
                className="ha-font w-full border border-[color:var(--ha-line)] bg-[rgba(4,10,8,0.9)] py-3 pl-10 pr-11 text-sm tracking-[0.18em] text-[color:var(--ha-text)] outline-none transition focus:border-[color:var(--ha-green)] focus:shadow-[0_0_0_3px_rgba(57,255,158,0.14)] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                aria-label={show ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--ha-muted)] transition hover:text-[color:var(--ha-green)]"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 border border-[rgba(255,77,94,0.4)] bg-[rgba(255,77,94,0.1)] px-3 py-2 text-[11px] text-[#ffb3ba]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ha-red)]" />
              <span>
                {error}
                {lockSeconds > 0 ? ` (${lockSeconds}s)` : ''}
              </span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || lockSeconds > 0 || !passcode}
            className="group flex w-full items-center justify-center gap-2 border border-[color:var(--ha-green)] bg-[rgba(57,255,158,0.1)] py-3 text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--ha-green)] transition hover:bg-[rgba(57,255,158,0.2)] hover:shadow-[0_0_24px_-4px_rgba(57,255,158,0.6)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin border-2 border-[color:var(--ha-green)] border-t-transparent" />
                Authenticating
              </span>
            ) : (
              <>
                <span className={passcode ? '' : 'ha-cursor'}>Enter the panel</span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-[10px] leading-relaxed text-[color:var(--ha-muted)]">
          Every attempt is rate-limited and written to the audit log. The passcode is never shown in this interface, in
          URLs or in application logs.
        </p>

        <div className="mt-6 border-t border-[color:var(--ha-line)] pt-4">
          <div className="space-y-1 text-[10px] text-[color:var(--ha-muted)]">
            {bootLines.map((line) => (
              <p key={line} className="flex items-center gap-2">
                <span className="text-[color:var(--ha-green-dim)]">›</span>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <Link
        to="/"
        className="mt-6 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ha-muted)] transition hover:text-[color:var(--ha-green)]"
      >
        ← Back to site
      </Link>
    </div>
  );
};
