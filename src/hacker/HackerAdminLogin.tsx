import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** The secure, passcode-only sign-in page for the operations console. */
export const HackerAdminLogin: React.FC = () => {
  const { hackerLogin, isHackerSession } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [passcode, setPasscode] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockSeconds, setLockSeconds] = useState(0);

  useEffect(() => {
    if (isHackerSession) navigate('/hackeradmin/console', { replace: true });
  }, [isHackerSession, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <div className="ha-console ha-login-page flex min-h-screen flex-col">
      <header className="ha-login-brandbar flex items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <Link to="/" className="ha-login-wordmark inline-flex items-center gap-3">
          <span className="ha-login-mark grid h-10 w-10 place-items-center rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold">GUSB</span>
            <span className="ha-login-brand-subtitle block text-[10px]">Village Development Organization</span>
          </span>
        </Link>
        <Link to="/" className="ha-login-back text-xs font-semibold transition-colors">
          Back to website
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-8 sm:py-10">
        <div className="ha-login-card grid w-full max-w-5xl overflow-hidden md:grid-cols-[0.92fr_1.08fr]">
          <section className="ha-login-aside flex min-h-[300px] flex-col justify-between p-7 sm:p-10 lg:p-12">
            <div>
              <div className="ha-login-crest grid h-14 w-14 place-items-center rounded-2xl">
                <ShieldCheck className="h-7 w-7" strokeWidth={1.6} />
              </div>
              <p className="ha-login-eyebrow mt-8 text-[10px] font-semibold uppercase">GUSB · Administration</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Operations<br className="hidden sm:block" /> Console</h1>
              <p className="ha-login-aside-copy mt-4 max-w-sm text-sm leading-6">
                A secure workspace for managing site operations, content, storage and system access.
              </p>
            </div>

            <div className="ha-login-assurance mt-8 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <LockKeyhole className="h-4 w-4" />
                Protected administrative environment
              </div>
              <p className="mt-2 pl-6 text-[11px] leading-relaxed">
                Privileged actions are monitored and recorded in the audit log.
              </p>
            </div>
          </section>

          <section className="ha-login-form-panel flex items-center p-7 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <span className="ha-login-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase">
                <span className="ha-login-status-dot h-1.5 w-1.5 rounded-full" />
                Restricted access
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Sign in to continue</h2>
              <p className="ha-login-intro mt-2 text-sm leading-6">
                Enter the operations passcode to open the administration console.
              </p>

              <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                  <label htmlFor="ha-passcode" className="ha-login-label mb-2 block text-xs font-semibold">
                    Access passcode
                  </label>
                  <div className="ha-login-input-wrap relative">
                    <LockKeyhole className="ha-login-input-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <input
                      id="ha-passcode"
                      ref={inputRef}
                      type={show ? 'text' : 'password'}
                      value={passcode}
                      onChange={(event) => setPasscode(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy || lockSeconds > 0}
                      placeholder="Enter your passcode"
                      aria-describedby={error ? 'ha-login-error' : 'ha-login-hint'}
                      className="ha-passcode-control w-full rounded-lg border py-3 pl-10 pr-11 text-sm outline-none transition disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((value) => !value)}
                      aria-label={show ? 'Hide passcode' : 'Show passcode'}
                      className="ha-login-reveal absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!error ? (
                    <p id="ha-login-hint" className="ha-login-hint mt-2 text-[11px]">
                      This passcode is provided to authorized operators only.
                    </p>
                  ) : null}
                </div>

                {error ? (
                  <div id="ha-login-error" role="alert" className="ha-login-error flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {error}
                      {lockSeconds > 0 ? ` (${lockSeconds}s)` : ''}
                    </span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy || lockSeconds > 0 || !passcode}
                  className="ha-login-submit group flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <span className="ha-login-spinner h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Verifying access
                    </>
                  ) : (
                    <>
                      Continue to console
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="ha-login-note mt-7 flex items-start gap-2.5 border-t pt-5">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  Access attempts are rate-limited and audited. Your passcode is never displayed in the interface or included in the URL.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="ha-login-footer px-5 py-4 text-center text-[10px] sm:px-8">
        © {new Date().getFullYear()} Village Development Organization Bogura · Secure administration
      </footer>
    </div>
  );
};
