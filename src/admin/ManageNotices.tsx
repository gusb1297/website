import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Notice } from '../types';
import { FileText, Plus, Trash2 } from 'lucide-react';

export const ManageNotices: React.FC = () => {
  const { token } = useAuth();
  const { data: notices, refetch } = useFetch<Notice[]>('/api/notices');

  const [title, setTitle] = useState('');
  const [referenceNo, setReferenceNo] = useState('GUSB/NOTICE/2026/001');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      alert('অনুগ্রহ করে নোটিশের পিডিএফ ফাইল সিলেক্ট করুন');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('referenceNo', referenceNo);
      formData.append('pdfFile', pdfFile);

      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('নোটিশ সেভ করা যায়নি');

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
    if (!confirm('আপনি কি এই নোটিশটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/notices/${id}`, {
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
          <FileText className="w-5 h-5 text-amber-500" /> নতুন অফিশিয়াল নোটিশ / টেন্ডার আপলোড করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">নোটিশ শিরোনাম</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: বার্ষিক সাধারণ সভা (AGM) সংক্রান্ত বিজ্ঞপ্তি"
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">স্মারক নম্বর (Reference No)</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">নোটিশ পিডিএফ ফাইল (PDF)</label>
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
            {submitting ? 'আপলোড হচ্ছে...' : 'নোটিশ প্রকাশ করুন'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">প্রকাশিত নোটিশসমূহ ({notices?.length || 0})</h4>

        <div className="space-y-3">
          {(notices || []).map((notice) => (
            <div key={notice.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-emerald-800 shrink-0" />
                <div>
                  <h5 className="font-serif font-bold text-sm text-slate-900">{notice.title}</h5>
                  <span className="text-[10px] text-slate-500 font-mono">স্মারক: {notice.referenceNo}</span>
                </div>
              </div>

              <button
                onClick={() => handleDelete(notice.id)}
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
