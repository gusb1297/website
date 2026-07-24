import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Publication } from '../types';
import { BookOpen, Upload, Trash2, FileText } from 'lucide-react';

export const ManagePublications: React.FC = () => {
  const { token } = useAuth();
  const { data: publications, refetch } = useFetch<Publication[]>('/api/publications');

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'annual_report' | 'newsletter' | 'report'>('annual_report');
  const [year, setYear] = useState('2024');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      alert('অনুগ্রহ করে একটি পিডিএফ ফাইল নির্বাচন করুন');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('type', type);
      formData.append('year', year);
      formData.append('pdfFile', pdfFile);

      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('পাবলিকেশন সেভ করা যায়নি');

      setTitle('');
      setPdfFile(null);
      refetch();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই প্রতিবেদনটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/publications/${id}`, {
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
          <BookOpen className="w-5 h-5 text-amber-500" /> নতুন প্রকাশনা / পিডিএফ আপলোড করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">প্রতিবেদনের শিরোনাম</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: বার্ষিক অডিট ও কার্যক্রম রিপোর্ট ২০২৩-২৪"
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">টাইপ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              >
                <option value="annual_report">বার্ষিক অডিট রিপোর্ট (Annual Report)</option>
                <option value="newsletter">ত্রৈমাসিক বুলেটিন (Newsletter)</option>
                <option value="report">গবেষণা সমীক্ষা (Research Report)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">বছর</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পিডিএফ ফাইল (PDF Document Upload)</label>
            <input
              type="file"
              required
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {submitting ? 'আপলোড হচ্ছে...' : 'পিডিএফ প্রকাশ করুন'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">প্রকাশিত ফাইলসমূহ ({publications?.length || 0})</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(publications || []).map((pub) => (
            <div key={pub.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-emerald-800 shrink-0" />
                <div>
                  <h5 className="font-serif font-bold text-sm text-slate-900">{pub.title}</h5>
                  <span className="text-[10px] text-slate-500 font-mono">বছর: {pub.year}</span>
                </div>
              </div>

              <button
                onClick={() => handleDelete(pub.id)}
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
