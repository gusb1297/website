import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  User as UserIcon,
  Database,
  CheckCircle2,
} from 'lucide-react';

type MongoState = 'connected' | 'not_configured' | 'unreachable';

interface AuthStatus {
  database: MongoState;
  setupRequired: boolean;
  message: string;
}

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-xl text-xs bg-slate-900 border border-emerald-800 text-white focus:outline-none focus:border-amber-400';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  // Shown when the admin was bounced here because their session died (expired
  // token, server restarted, account removed) instead of logging out cleanly.
  const [sessionNotice, setSessionNotice] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/auth/status');
      const data = (await res.json()) as AuthStatus;
      setStatus(data);
    } catch {
      setStatus({
        database: 'unreachable',
        setupRequired: false,
        message: 'Could not reach the API. Is the server running?',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setSessionNotice(state.message);
      // Show it once — clear the navigation state so a refresh doesn't repeat it.
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'লগইন ব্যর্থ হয়েছে');
      }

      login(data.token, data.user);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError((err as Error).message || 'লগইন করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    if (password !== confirmPassword) {
      setError('পাসওয়ার্ড দুটি মিলছে না।');
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'অ্যাডমিন তৈরি করা যায়নি');
      }
      setPassword('');
      setConfirmPassword('');
      setInfo(data.message || 'প্রথম অ্যাডমিন তৈরি হয়েছে। এখন লগইন করুন।');
      await loadStatus();
    } catch (err: unknown) {
      setError((err as Error).message || 'অ্যাডমিন তৈরি করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  const dbBlocked = status && status.database !== 'connected';
  const setupMode = Boolean(status?.setupRequired);

  return (
    <div className="min-h-screen py-16 bg-slate-950 text-white flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-950 opacity-90" />

      <div className="relative z-10 max-w-md w-full bg-emerald-950/90 border border-amber-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto font-serif font-bold text-2xl shadow-lg border border-amber-300">
            GUSB
          </div>
          <h2 className="text-2xl font-serif font-bold text-white">
            {setupMode ? 'প্রথম অ্যাডমিন তৈরি করুন' : 'অ্যাডমিন প্যানেল লগইন'}
          </h2>
          <p className="text-xs text-emerald-200">
            গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) বিষয়বস্তু ব্যবস্থাপনা পোর্টাল
          </p>
        </div>

        {statusLoading && <p className="text-xs text-center text-emerald-300">সার্ভার স্ট্যাটাস যাচাই হচ্ছে...</p>}

        {dbBlocked && (
          <div className="p-4 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-100 text-xs space-y-2">
            <p className="font-bold flex items-center gap-2">
              <Database className="w-4 h-4 shrink-0 text-amber-400" />
              MongoDB সংযোগ হয়নি
            </p>
            <p className="leading-relaxed">{status?.message}</p>
            <ol className="list-decimal pl-4 space-y-1 text-amber-50/90">
              <li>
                Hosting / <code className="text-amber-300">.env</code> এ <code className="text-amber-300">MONGODB_URI</code> সেট করুন।
              </li>
              <li>Atlas → Network Access → এই সার্ভারের IP (বা টেস্টের জন্য 0.0.0.0/0) allow করুন।</li>
              <li>Atlas → Database Access ইউজার/পাসওয়ার্ড URI-এর সাথে মিলতে হবে (বিশেষ অক্ষর URL-encode করুন)।</li>
              <li className="font-semibold">
                Atlas প্যানেল থেকে অ্যাডমিন যোগ করবেন না — পাসওয়ার্ড bcrypt হ্যাশ ছাড়া লগইন হবে না।
              </li>
            </ol>
            <button
              type="button"
              onClick={loadStatus}
              className="mt-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 hover:text-white"
            >
              আবার চেক করুন
            </button>
          </div>
        )}

        {sessionNotice && (
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-100 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            {sessionNotice}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            {error}
          </div>
        )}

        {info && (
          <div className="p-3 rounded-xl bg-emerald-900/80 border border-emerald-500/40 text-emerald-100 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            {info}
          </div>
        )}

        {setupMode && !statusLoading && (
          <form onSubmit={handleSetup} className="space-y-4">
            <p className="text-[11px] text-emerald-200 leading-relaxed">
              MongoDB সংযুক্ত আছে, কিন্তু কোনো অ্যাডমিন অ্যাকাউন্ট নেই। Atlas থেকে ম্যানুয়ালি যোগ করার দরকার নেই —
              এই ফর্মটিই প্রথম অ্যাডমিন তৈরি করবে (পাসওয়ার্ড bcrypt দিয়ে হ্যাশ হয়ে MongoDB-তে যাবে)।
            </p>
            <div>
              <label className="block text-xs font-bold text-emerald-100 mb-1">পূর্ণ নাম</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Site Administrator"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-100 mb-1">ইমেইল ঠিকানা</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="you@example.org"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-100 mb-1">পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-amber-400"
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-100 mb-1">পাসওয়ার্ড নিশ্চিত করুন</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-xl transition-all border border-amber-300 flex items-center justify-center gap-2"
            >
              {loading ? 'তৈরি হচ্ছে...' : 'প্রথম অ্যাডমিন তৈরি করুন'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {!setupMode && !dbBlocked && !statusLoading && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-emerald-100 mb-1">ইমেইল ঠিকানা</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="you@example.org"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-100 mb-1">পাসওয়ার্ড</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-amber-400"
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-xl transition-all border border-amber-300 flex items-center justify-center gap-2"
            >
              {loading ? 'যাচাই হচ্ছে...' : 'লগইন করুন'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
