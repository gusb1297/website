import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldAlert, ArrowRight, KeyRound } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('admin@vdobogura.org');
  const [password, setPassword] = useState('admin123password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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
    } catch (err: any) {
      setError(err.message || 'লগইন করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@vdobogura.org');
    setPassword('admin123password');
  };

  return (
    <div className="min-h-screen py-16 bg-slate-950 text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-950 opacity-90" />

      <div className="relative z-10 max-w-md w-full bg-emerald-950/90 border border-amber-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto font-serif font-bold text-2xl shadow-lg border border-amber-300">
            GUSB
          </div>
          <h2 className="text-2xl font-serif font-bold text-white">অ্যাডমিন প্যানেল লগইন</h2>
          <p className="text-xs text-emerald-200">গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) বিষয়বস্তু ব্যবস্থাপনা পোর্টাল</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-emerald-100 mb-1">ইমেইল ঠিকানা</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-xs bg-slate-900 border border-emerald-800 text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-100 mb-1">পাসওয়ার্ড</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-xs bg-slate-900 border border-emerald-800 text-white focus:outline-none focus:border-amber-400"
              />
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

        {/* Demo Credentials Quick Button */}
        <div className="pt-4 border-t border-emerald-900/80 text-center space-y-2">
          <p className="text-[11px] text-emerald-300">দ্রুত টেস্ট লগইনের জন্য ডেমো তথ্য ব্যবহার করুন:</p>
          <button
            onClick={fillDemo}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-300 text-xs font-mono border border-emerald-700"
          >
            <KeyRound className="w-3.5 h-3.5" /> admin@vdobogura.org / admin123password
          </button>
        </div>
      </div>
    </div>
  );
};
