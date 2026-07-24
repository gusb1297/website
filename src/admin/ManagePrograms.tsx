import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Program } from '../types';
import { Plus, Trash2, Edit3 } from 'lucide-react';

export const ManagePrograms: React.FC = () => {
  const { token } = useAuth();
  const { data: programs, refetch } = useFetch<Program[]>('/api/programs');

  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('Sprout');
  const [beneficiariesCount, setBeneficiariesCount] = useState(10000);
  const [districtsCovered, setDistrictsCovered] = useState(5);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('shortDesc', shortDesc);
      formData.append('content', content);
      formData.append('icon', icon);
      formData.append('beneficiariesCount', String(beneficiariesCount));
      formData.append('districtsCovered', String(districtsCovered));

      if (coverFile) {
        formData.append('coverImage', coverFile);
      } else {
        formData.append('coverImage', coverUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80');
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
      setCoverUrl('');
      refetch();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" /> নতুন NGO প্রজেক্ট যোগ করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              >
                <option value="Coins">ক্ষুদ্রঋণ (Coins)</option>
                <option value="HeartPulse">স্বাস্থ্য (HeartPulse)</option>
                <option value="GraduationCap">শিক্ষা (GraduationCap)</option>
                <option value="Sprout">কৃষি (Sprout)</option>
              </select>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">কভার ইমেজ আপলোড (Multer)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">অথবা ছবি URL দিন</label>
              <input
                type="text"
                placeholder="https://..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
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
            <div key={prog.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={prog.coverImage} alt={prog.title} className="w-16 h-16 object-cover rounded-xl border border-slate-300" />
                <div>
                  <h5 className="font-serif font-bold text-sm text-slate-900">{prog.title}</h5>
                  <p className="text-xs text-slate-600 line-clamp-1">{prog.shortDesc}</p>
                </div>
              </div>

              <button
                onClick={() => handleDelete(prog.id)}
                className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
