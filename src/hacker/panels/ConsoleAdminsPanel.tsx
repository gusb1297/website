import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2, UserPlus, UserX, UserCheck } from 'lucide-react';
import { consoleApi, SystemSnapshot, timeAgo } from '../api';
import { Button, Chip, Field, Notice, Panel, Tone, inputClass } from '../ui';

interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor';
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

/**
 * ADMIN ACCOUNTS — create and remove the accounts that can sign into /admin
 * (and everything the console itself can do with content). Passwords are hashed
 * with bcrypt on the server; they are never shown again after creation.
 */
export const ConsoleAdminsPanel: React.FC<{
  token: string | null;
  snapshot: SystemSnapshot | null;
  onToast: (message: string, tone?: Tone) => void;
  onReload: () => void;
}> = ({ token, snapshot, onToast, onReload }) => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('admin');

  const dbOff = snapshot ? !snapshot.control.databaseEnabled : false;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setAdmins(await consoleApi.admins(token));
    } catch (err) {
      setError((err as Error).message);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('create');
    try {
      await consoleApi.createAdmin(token, { name, email, password, role, isActive: true });
      onToast(`${email} অ্যাডমিন হিসেবে যোগ হয়েছে।`, 'green');
      setName('');
      setEmail('');
      setPassword('');
      setRole('admin');
      await load();
      onReload();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setBusy(null);
    }
  };

  const patch = async (admin: AdminRow, body: Record<string, unknown>, label: string) => {
    setBusy(`${admin.id}:patch`);
    try {
      const res = await fetch(`/api/admins/${encodeURIComponent(admin.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(payload.message || payload.error || 'পরিবর্তন সংরক্ষণ করা যায়নি।');
      onToast(label, 'green');
      await load();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (admin: AdminRow) => {
    if (!window.confirm(`"${admin.email}" অ্যাকাউন্টটি মুছে ফেলবেন?`)) return;
    setBusy(`${admin.id}:delete`);
    try {
      await consoleApi.deleteAdmin(token, admin.id);
      onToast(`${admin.email} মুছে ফেলা হয়েছে।`, 'green');
      await load();
      onReload();
    } catch (err) {
      onToast((err as Error).message, 'red');
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (admin: AdminRow) => {
    const next = window.prompt(`${admin.email} এর জন্য নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর):`);
    if (!next) return;
    if (next.length < 8) {
      onToast('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', 'red');
      return;
    }
    await patch(admin, { password: next }, 'পাসওয়ার্ড পরিবর্তন হয়েছে।');
  };

  return (
    <div className="space-y-5">
      <Panel
        title="Admin Accounts"
        subtitle="যারা /admin প্যানেলে লগইন করতে পারবে। পাসওয়ার্ড bcrypt হ্যাশ হিসেবে MongoDB-তে থাকে।"
        actions={
          <>
            <Chip label="total" value={String(admins.length)} tone="cyan" />
            <Chip label="active" value={String(admins.filter((admin) => admin.isActive).length)} tone="green" />
            <Button tone="cyan" onClick={() => void load()} busy={loading}>
              refresh
            </Button>
          </>
        }
      >
        {dbOff ? (
          <Notice tone="red">
            DATABASE IS OFF — অ্যাডমিন অ্যাকাউন্ট MongoDB-তে থাকে, তাই আগে Control Room থেকে ডাটাবেস চালু করুন।
          </Notice>
        ) : null}
        {error ? <Notice tone="red">{error}</Notice> : null}

        <form onSubmit={create} className="mt-4 grid gap-3 border border-[color:var(--ha-line)] bg-slate-50 p-4 sm:grid-cols-2">
          <Field label="full name">
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required placeholder="Mohi" />
          </Field>
          <Field label="email">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="admin@example.org"
            />
          </Field>
          <Field label="password" hint="কমপক্ষে ৮ অক্ষর — server-side bcrypt (12 rounds)">
            <input
              className={inputClass}
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
            />
          </Field>
          <Field label="role">
            <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'editor')}>
              <option value="admin">admin — পূর্ণ ক্ষমতা</option>
              <option value="editor">editor — শুধু কন্টেন্ট</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" busy={busy === 'create'} disabled={dbOff}>
              <UserPlus className="h-3.5 w-3.5" /> create admin
            </Button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--ha-line)]">
                <th className="py-2 pr-3 text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">account</th>
                <th className="py-2 pr-3 text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">role</th>
                <th className="py-2 pr-3 text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">state</th>
                <th className="py-2 pr-3 text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">last login</th>
                <th className="py-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-[color:var(--ha-line)] align-middle">
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-[color:var(--ha-text)]">{admin.name}</p>
                    <p className="text-[11px] text-[color:var(--ha-muted)]">{admin.email}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-[color:var(--ha-cyan)]">{admin.role}</td>
                  <td className="py-2.5 pr-3">
                    {admin.isActive ? (
                      <span className="text-[color:var(--ha-green)]">active</span>
                    ) : (
                      <span className="text-[color:var(--ha-red)]">disabled</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-[color:var(--ha-muted)]">{timeAgo(admin.lastLoginAt || undefined)}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        tone={admin.isActive ? 'amber' : 'green'}
                        busy={busy === `${admin.id}:patch`}
                        disabled={dbOff}
                        onClick={() =>
                          void patch(
                            admin,
                            { isActive: !admin.isActive },
                            admin.isActive ? 'অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।' : 'অ্যাকাউন্ট সক্রিয় করা হয়েছে।'
                          )
                        }
                      >
                        {admin.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {admin.isActive ? 'disable' : 'enable'}
                      </Button>
                      <Button tone="cyan" disabled={dbOff} onClick={() => void resetPassword(admin)}>
                        <KeyRound className="h-3.5 w-3.5" /> password
                      </Button>
                      <Button tone="red" busy={busy === `${admin.id}:delete`} disabled={dbOff} onClick={() => void remove(admin)}>
                        <Trash2 className="h-3.5 w-3.5" /> delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="py-4 text-[color:var(--ha-muted)]">
                    কোনো অ্যাডমিন অ্যাকাউন্ট নেই।
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-[color:var(--ha-muted)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ha-green)]" />
          শেষ সক্রিয় অ্যাডমিন অ্যাকাউন্টটি মুছে ফেলা বা নিষ্ক্রিয় করা যাবে না — কনসোল নিজেই সেই সুরক্ষা বলবৎ রাখে।
        </p>
      </Panel>
    </div>
  );
};
