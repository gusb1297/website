import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminAccount, AdminRole } from '../types';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit3,
  X,
  Save,
  KeyRound,
  Mail,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700';

const MIN_PASSWORD_LENGTH = 8;

const roleLabel = (role: AdminRole) => (role === 'admin' ? 'অ্যাডমিন (পূর্ণ ক্ষমতা)' : 'এডিটর (শুধু কন্টেন্ট)');

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
};

export const ManageAdmins: React.FC = () => {
  const { token, user } = useAuth();

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit form
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('admin');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const authHeaders = useCallback(
    (json = true) => ({
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admins', { headers: authHeaders(false) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'অ্যাডমিন তালিকা লোড করা যায়নি');
      setAdmins(data as AdminAccount[]);
    } catch (err) {
      setLoadError((err as Error).message);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setNotice('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setCreateError(`পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে।`);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, email, password, role, isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'অ্যাডমিন যোগ করা যায়নি');

      setName('');
      setEmail('');
      setPassword('');
      setRole('admin');
      setNotice(`নতুন অ্যাকাউন্ট তৈরি হয়েছে: ${data.email}`);
      loadAdmins();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (admin: AdminAccount) => {
    setEditing(admin);
    setEditName(admin.name);
    setEditEmail(admin.email);
    setEditRole(admin.role);
    setEditActive(admin.isActive);
    setEditPassword('');
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError('');

    if (editPassword && editPassword.length < MIN_PASSWORD_LENGTH) {
      setEditError(`নতুন পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে।`);
      return;
    }

    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        name: editName,
        email: editEmail,
        role: editRole,
        isActive: editActive,
      };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/admins/${editing.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'আপডেট করা যায়নি');

      setNotice(`${data.email} অ্যাকাউন্টটি আপডেট করা হয়েছে।`);
      setEditing(null);
      loadAdmins();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (admin: AdminAccount) => {
    if (!confirm(`"${admin.name}" (${admin.email}) অ্যাকাউন্টটি স্থায়ীভাবে মুছে ফেলতে চান?`)) return;
    setNotice('');
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'DELETE',
        headers: authHeaders(false),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'মুছে ফেলা যায়নি');
      setNotice(`${admin.email} অ্যাকাউন্টটি মুছে ফেলা হয়েছে।`);
      loadAdmins();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      {/* ============ CREATE ============ */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-5">
        <div className="space-y-1">
          <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-500" /> নতুন অ্যাডমিন যোগ করুন
          </h3>
          <p className="text-xs text-slate-500 font-sans">
            অ্যাকাউন্টগুলো MongoDB ডেটাবেজে সংরক্ষিত হয় এবং পাসওয়ার্ড bcrypt দিয়ে হ্যাশ করে রাখা হয়।
          </p>
        </div>

        {createError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {createError}
          </div>
        )}
        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
          </div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পূর্ণ নাম</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} pl-10`}
                placeholder="যেমন: রফিকুল ইসলাম"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ইমেইল ঠিকানা</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputCls} pl-10`}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              পাসওয়ার্ড (কমপক্ষে {MIN_PASSWORD_LENGTH} অক্ষর)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pl-10 pr-10`}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title={showPassword ? 'লুকান' : 'দেখুন'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">রোল / ক্ষমতা</label>
            <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} className={inputCls}>
              <option value="admin">{roleLabel('admin')}</option>
              <option value="editor">{roleLabel('editor')}</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 disabled:opacity-60 text-amber-400 font-bold text-xs uppercase tracking-wider transition-all"
            >
              <UserPlus className="w-4 h-4" /> {creating ? 'তৈরি হচ্ছে...' : 'অ্যাডমিন তৈরি করুন'}
            </button>
          </div>
        </form>
      </div>

      {/* ============ LIST ============ */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-500" /> বিদ্যমান অ্যাডমিন অ্যাকাউন্ট ({admins.length})
        </h3>

        {loadError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {loadError}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-500">লোড হচ্ছে...</p>
        ) : admins.length === 0 && !loadError ? (
          <p className="text-xs text-slate-500">কোনো অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200">
                  <th className="py-3 pr-4">নাম</th>
                  <th className="py-3 pr-4">ইমেইল</th>
                  <th className="py-3 pr-4">রোল</th>
                  <th className="py-3 pr-4">স্ট্যাটাস</th>
                  <th className="py-3 pr-4">সর্বশেষ লগইন</th>
                  <th className="py-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-bold text-slate-800">
                      {admin.name}
                      {admin.id === user?.id && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                          আপনি
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 font-mono">{admin.email}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          admin.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {admin.role === 'admin' ? 'ADMIN' : 'EDITOR'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          admin.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {admin.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{formatDate(admin.lastLoginAt)}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(admin)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          title="সম্পাদনা করুন"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(admin)}
                          disabled={admin.id === user?.id}
                          className="p-2 rounded-lg bg-red-100 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-700"
                          title={admin.id === user?.id ? 'নিজের অ্যাকাউন্ট মুছে ফেলা যাবে না' : 'মুছে ফেলুন'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============ EDIT MODAL ============ */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-serif font-bold text-slate-900">অ্যাডমিন সম্পাদনা</h4>
                <p className="text-[11px] text-slate-500 font-mono">{editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {editError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পূর্ণ নাম</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ইমেইল ঠিকানা</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">রোল</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AdminRole)}
                    className={inputCls}
                  >
                    <option value="admin">{roleLabel('admin')}</option>
                    <option value="editor">{roleLabel('editor')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={editActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditActive(e.target.value === 'active')}
                    disabled={editing.id === user?.id}
                    className={`${inputCls} disabled:opacity-60`}
                  >
                    <option value="active">সক্রিয়</option>
                    <option value="inactive">নিষ্ক্রিয় (লগইন বন্ধ)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নতুন পাসওয়ার্ড (ফাঁকা রাখলে অপরিবর্তিত থাকবে)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 disabled:opacity-60 text-amber-400 text-xs font-bold"
              >
                <Save className="w-4 h-4" /> {savingEdit ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
