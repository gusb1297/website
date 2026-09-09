import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useSaveAction } from '../hooks/useSaveAction';
import { useToast } from '../context/ToastContext';
import { StatItem } from '../types';
import { BarChart3, Plus, Trash2, Edit3, X, Save } from 'lucide-react';

const ICONS = ['Users', 'Coins', 'MapPin', 'School', 'HeartPulse', 'Award', 'Building', 'GraduationCap'];

export const ManageStats: React.FC = () => {
  const toast = useToast();
  const { saving, run } = useSaveAction();
  const { data: stats, refetch } = useFetch<StatItem[]>('/api/stats');

  const [label, setLabel] = useState('');
  const [value, setValue] = useState(1000);
  const [suffix, setSuffix] = useState('+');
  const [icon, setIcon] = useState('Users');
  const [editing, setEditing] = useState<StatItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState(0);
  const [editSuffix, setEditSuffix] = useState('+');
  const [editIcon, setEditIcon] = useState('Users');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error({ title: 'স্ট্যাটের নাম লিখুন' });
      return;
    }
    const created = await run<StatItem>({
      url: '/api/stats',
      body: { label: label.trim(), value: Number(value), suffix: suffix.trim(), icon },
      success: 'নতুন স্ট্যাট যোগ হয়েছে',
      failure: 'স্ট্যাট যোগ করা যায়নি',
    });
    if (!created) return;
    setLabel('');
    setValue(1000);
    setSuffix('+');
    setIcon('Users');
    refetch();
  };

  const startEdit = (stat: StatItem) => {
    setEditing(stat);
    setEditLabel(stat.label);
    setEditValue(stat.value);
    setEditSuffix(stat.suffix || '+');
    setEditIcon(stat.icon || 'Users');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editLabel.trim()) {
      toast.error({ title: 'স্ট্যাটের নাম লিখুন' });
      return;
    }
    const saved = await run<StatItem>({
      url: `/api/stats/${editing.id}`,
      method: 'PUT',
      body: { label: editLabel.trim(), value: Number(editValue), suffix: editSuffix.trim(), icon: editIcon },
      success: 'স্ট্যাট আপডেট হয়েছে',
      failure: 'স্ট্যাট আপডেট করা যায়নি',
    });
    if (!saved) return;
    setEditing(null);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই পরিসংখ্যানটি মুছে ফেলতে চান?')) return;
    const done = await run({
      url: `/api/stats/${id}`,
      method: 'DELETE',
      success: 'স্ট্যাটটি মুছে ফেলা হয়েছে',
      failure: 'স্ট্যাটটি মুছে ফেলা যায়নি',
    });
    if (done !== null) refetch();
  };

  return (
    <div className="space-y-8">
      {/* Add Stat */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" /> নতুন পরিসংখ্যান কাউন্টার
        </h3>
        <p className="text-xs text-slate-500">
          হোম পেজ ও About পেজের ডার্ক ব্যানারে অ্যানিমেটেড কাউন্টার হিসেবে দেখানো হয়।
        </p>

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">লেবেল</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="যেমন: সুবিধাভোগী পরিবার"
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মান (সংখ্যা)</label>
            <input
              type="number"
              required
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">সফিক্স</label>
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="+ / টি /%"
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">আইকন</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            >
              {ICONS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
            >
              {saving ? 'সেভ হচ্ছে…' : 'কাউন্টার যোগ করুন'}
            </button>
          </div>
        </form>
      </div>

      {/* Stats List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-800" /> বিদ্যমান পরিসংখ্যান ({stats?.length || 0})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(stats || []).map((stat, idx) => (
            <div key={stat.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-serif font-bold text-emerald-950">
                    {stat.value.toLocaleString()}
                    <span className="text-amber-500 text-sm">{stat.suffix}</span>
                  </p>
                  <p className="text-xs font-bold text-slate-700">{stat.label}</p>
                  <p className="text-[10px] text-slate-400">আইকন: {stat.icon} • ক্রম: {stat.order}</p>
                </div>
              </div>

              {editing?.id === stat.id ? (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="লেবেল"
                  />
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="মান"
                  />
                  <input
                    type="text"
                    value={editSuffix}
                    onChange={(e) => setEditSuffix(e.target.value)}
                    className="px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="সফিক্স"
                  />
                  <select
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300"
                  >
                    {ICONS.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold"
                    >
                      <Save className="w-3.5 h-3.5" /> সেভ
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(stat)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold hover:bg-emerald-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> এডিট ({idx + 1})
                  </button>
                  <button
                    onClick={() => handleDelete(stat.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
