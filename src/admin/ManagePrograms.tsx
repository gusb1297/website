import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Program } from '../types';
import { Plus, Trash2, Edit3, X, Save } from 'lucide-react';

const ICON_OPTIONS = ['Coins', 'HeartPulse', 'GraduationCap', 'Sprout', 'Building', 'Award', 'School', 'MapPin'];

export const ManagePrograms: React.FC = () => {
  const { token } = useAuth();
  const { data: programs, refetch } = useFetch<Program[]>('/api/programs');

  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('Sprout');
  const [status, setStatus] = useState<'ongoing' | 'completed'>('ongoing');
  const [beneficiariesCount, setBeneficiariesCount] = useState(10000);
  const [districtsCovered, setDistrictsCovered] = useState(5);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // URL input removed - direct upload only
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<Program | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editShortDesc, setEditShortDesc] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIcon, setEditIcon] = useState('Sprout');
  const [editStatus, setEditStatus] = useState<'ongoing' | 'completed'>('ongoing');
  const [editBeneficiaries, setEditBeneficiaries] = useState(0);
  const [editDistricts, setEditDistricts] = useState(0);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('shortDesc', shortDesc);
      formData.append('content', content);
      formData.append('icon', icon);
      formData.append('status', status);
      formData.append('beneficiariesCount', String(beneficiariesCount));
      formData.append('districtsCovered', String(districtsCovered));

      if (coverFile) {
        formData.append('coverImage', coverFile);
      } else {
        formData.append('coverImage', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80');
      }

      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('প্রজেক্ট যোগ করতে ব্যর্থ হয়েছে');

      setTitle('');
      setShortDesc('');
      setContent('');
      setCoverFile(null);
      refetch();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (prog: Program) => {
    setEditing(prog);
    setEditTitle(prog.title);
    setEditShortDesc(prog.shortDesc);
    setEditContent(prog.content);
    setEditIcon(prog.icon);
    setEditStatus(prog.status);
    setEditBeneficiaries(prog.beneficiariesCount || 0);
    setEditDistricts(prog.districtsCovered || 0);
    setEditCoverFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('shortDesc', editShortDesc);
      formData.append('content', editContent);
      formData.append('icon', editIcon);
      formData.append('status', editStatus);
      formData.append('beneficiariesCount', String(editBeneficiaries));
      formData.append('districtsCovered', String(editDistricts));
      if (editCoverFile) {
        formData.append('coverImage', editCoverFile);
      }
      const res = await fetch(`/api/programs/${editing.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('প্রজেক্ট আপডেট করা যায়নি');
      setEditing(null);
      refetch();
    } catch (e) {
      alert('ত্রুটি ঘটেছে');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই প্রজেক্টটি ডিলিট করতে চান?')) return;
    try {
      await fetch(`/api/programs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  const iconSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300">
      {ICON_OPTIONS.map((i) => (
        <option key={i} value={i}>{i}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" /> নতুন NGO প্রজেক্ট যোগ করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">প্রজেক্ট নাম</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: চরাঞ্চলে স্বাস্থ্য সেবা প্রকল্প"
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">আইকন টাইপ</label>
              {iconSelect(icon, setIcon)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
            <input
              type="text"
              required
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="প্রজেক্টের সংক্ষেপ..."
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ (Markdown/Text)</label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="প্রজেক্টের বিশদ বিবরণ লিখুন..."
              className="w-full px-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">উপকৃত পরিবার সংখ্যা</label>
              <input
                type="number"
                value={beneficiariesCount}
                onChange={(e) => setBeneficiariesCount(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">জেলা সংখ্যা</label>
              <input
                type="number"
                value={districtsCovered}
                onChange={(e) => setDistrictsCovered(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ongoing' | 'completed')}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              >
                <option value="ongoing">চলমান (Ongoing)</option>
                <option value="completed">সম্পন্ন (Completed)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">কভার ইমেজ আপলোড (Direct Upload)</label>
              <input
                type="file"
                required
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>


          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {submitting ? 'সেভ হচ্ছে...' : 'প্রজেক্ট যোগ করুন'}
          </button>
        </form>
      </div>

      {/* Program List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">বিদ্যমান প্রজেক্টসমূহ ({programs?.length || 0})</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(programs || []).map((prog) => (
            <div key={prog.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <img src={prog.coverImage} alt={prog.title} className="w-16 h-16 object-cover rounded-xl border border-slate-300 shrink-0" />
                <div className="min-w-0">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{prog.title}</h5>
                  <p className="text-xs text-slate-600 line-clamp-1">{prog.shortDesc}</p>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 mt-1 inline-block ${prog.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {prog.status === 'ongoing' ? 'চলমান' : 'সম্পন্ন'}
                  </span>
                </div>
              </div>

              {editing?.id === prog.id ? (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="প্রজেক্ট নাম" />
                  <input type="text" value={editShortDesc} onChange={(e) => setEditShortDesc(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="সংক্ষিপ্ত বিবরণ" />
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="বিস্তারিত" />
                  <div className="px-1">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">আইকন</p>
                    {iconSelect(editIcon, setEditIcon)}
                  </div>
                  <div className="px-1">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">স্ট্যাটাস</p>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'ongoing' | 'completed')} className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300">
                      <option value="ongoing">চলমান</option>
                      <option value="completed">সম্পন্ন</option>
                    </select>
                  </div>
                  <input type="number" value={editBeneficiaries} onChange={(e) => setEditBeneficiaries(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="উপকৃত সংখ্যা" />
                  <input type="number" value={editDistricts} onChange={(e) => setEditDistricts(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="জেলা সংখ্যা" />
                  <input type="file" accept="image/*" onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)} className="col-span-2 px-2 py-1 text-[10px] border border-dashed border-slate-300 rounded-lg" />
                  <div className="col-span-2 flex gap-2">
                    <button onClick={handleSaveEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold">
                      <Save className="w-3.5 h-3.5" /> আপডেট সেভ করুন
                    </button>
                    <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold">
                      <X className="w-3.5 h-3.5" /> বাতিল
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(prog)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold hover:bg-emerald-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> এডিট
                  </button>
                  <button
                    onClick={() => handleDelete(prog.id)}
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
