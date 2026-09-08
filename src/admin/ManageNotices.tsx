import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Notice } from '../types';
import { FileText, Plus, Trash2, Edit3, X, Save, Eye, EyeOff } from 'lucide-react';
import { readApiError } from '../utils/api';

export const ManageNotices: React.FC = () => {
  const { token } = useAuth();
  const { data: notices, refetch } = useFetch<Notice[]>('/api/notices?all=true');

  const [title, setTitle] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<Notice | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      alert('অনুগ্রহ করে নোটিশের পিডিএফ ফাইল বা PDF URL দিন');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('referenceNo', referenceNo);
      if (expiryDate) formData.append('expiryDate', expiryDate);
      formData.append('pdfFile', pdfFile);

      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(await readApiError(res, 'নোটিশ সেভ করা যায়নি'));

      setTitle('');
      setPdfFile(null);
      setExpiryDate('');
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (notice: Notice) => {
    setEditing(notice);
    setEditTitle(notice.title);
    setEditReference(notice.referenceNo || '');
    setEditExpiry(notice.expiryDate ? String(notice.expiryDate).slice(0, 10) : '');
    setEditPdfFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('referenceNo', editReference);
      if (editExpiry) formData.append('expiryDate', editExpiry);
      formData.append('isActive', String(editing.isActive));
      if (editPdfFile) {
        formData.append('pdfFile', editPdfFile);
      }
      const res = await fetch(`/api/notices/${editing.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'নোটিশ আপডেট করা যায়নি'));
      setEditing(null);
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ত্রুটি ঘটেছে');
    }
  };

  const toggleActive = async (notice: Notice) => {
    try {
      await fetch(`/api/notices/${notice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !notice.isActive }),
      });
      refetch();
    } catch (e) {
      console.error(e);
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
          <Plus className="w-5 h-5 text-amber-500" /> নতুন অফিশিয়াল নোটিশ / টেন্ডার প্রকাশ করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">মেয়াদ (Expiry Date, ঐচ্ছিক)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div key={notice.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className={`w-6 h-6 shrink-0 ${notice.isActive ? 'text-emerald-800' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{notice.title}</h5>
                    <span className="text-[10px] text-slate-500 font-mono">
                      স্মারক: {notice.referenceNo} • {new Date(notice.publishedAt).toLocaleDateString('bn-BD')}
                      {notice.expiryDate ? ` • মেয়াদ: ${new Date(notice.expiryDate).toLocaleDateString('bn-BD')}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(notice)}
                    className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      notice.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {notice.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    {notice.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </button>

                  <button
                    onClick={() => startEdit(notice)}
                    className="p-2 rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-colors"
                    title="এডিট"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(notice.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editing?.id === notice.id && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="col-span-2 md:col-span-1 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="শিরোনাম" />
                  <input type="text" value={editReference} onChange={(e) => setEditReference(e.target.value)} className="col-span-2 md:col-span-1 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="স্মারক নম্বর" />
                  <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="px-3 py-2 rounded-lg text-xs border border-slate-300" />
                  <p className="text-xs text-slate-400">পিডিএফ পরিবর্তনের জন্য নতুন ফাইল আপলোড করুন (ঐচ্ছিক)</p>
                  <input type="file" accept=".pdf" onChange={(e) => setEditPdfFile(e.target.files?.[0] || null)} className="col-span-2 px-2 py-1 text-[10px] border border-dashed border-slate-300 rounded-lg" />
                  <div className="col-span-2 flex gap-2">
                    <button onClick={handleSaveEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold">
                      <Save className="w-3.5 h-3.5" /> আপডেট সেভ করুন
                    </button>
                    <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold">
                      <X className="w-3.5 h-3.5" /> বাতিল
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
