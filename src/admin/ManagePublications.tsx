import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Publication } from '../types';
import { BookOpen, Trash2, FileText, Edit3, X, Save } from 'lucide-react';

export const ManagePublications: React.FC = () => {
  const { token } = useAuth();
  const { data: publications, refetch } = useFetch<Publication[]>('/api/publications');

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'annual_report' | 'newsletter' | 'report'>('annual_report');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<Publication | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<Publication['type']>('annual_report');
  const [editYear, setEditYear] = useState('');
  const [editPdfUrl, setEditPdfUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile && !pdfUrl) {
      alert('অনুগ্রহ করে একটি পিডিএফ ফাইল নির্বাচন করুন অথবা PDF URL দিন');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('type', type);
      formData.append('year', year);
      if (pdfFile) {
        formData.append('pdfFile', pdfFile);
      } else {
        formData.append('pdfFile', pdfUrl);
      }

      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('পাবলিকেশন সেভ করা যায়নি');

      setTitle('');
      setPdfFile(null);
      setPdfUrl('');
      refetch();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (pub: Publication) => {
    setEditing(pub);
    setEditTitle(pub.title);
    setEditType(pub.type);
    setEditYear(String(pub.year));
    setEditPdfUrl(pub.pdfFile);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('type', editType);
      formData.append('year', editYear);
      if (editPdfUrl) formData.append('pdfFile', editPdfUrl);
      const res = await fetch(`/api/publications/${editing.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('পাবলিকেশন আপডেট করা যায়নি');
      setEditing(null);
      refetch();
    } catch (e) {
      alert('ত্রুটি ঘটেছে');
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
                onChange={(e) => setType(e.target.value as typeof type)}
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
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পিডিএফ ফাইল (PDF Document Upload)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">অথবা PDF URL দিন</label>
              <input
                type="text"
                placeholder="https://..."
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
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
            <div key={pub.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-emerald-800 shrink-0" />
                <div className="min-w-0">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{pub.title}</h5>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {pub.type.replace('_', ' ')} • বছর: {pub.year}
                  </span>
                </div>
              </div>

              {editing?.id === pub.id ? (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="শিরোনাম" />
                  <select value={editType} onChange={(e) => setEditType(e.target.value as Publication['type'])} className="px-3 py-2 rounded-lg text-xs border border-slate-300">
                    <option value="annual_report">Annual Report</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="report">Research Report</option>
                  </select>
                  <input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="বছর" />
                  <input type="text" value={editPdfUrl} onChange={(e) => setEditPdfUrl(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="PDF URL" />
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
                  <a
                    href={pub.pdfFile}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF দেখুন
                  </a>
                  <button
                    onClick={() => startEdit(pub)}
                    className="p-2 rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-colors"
                    title="এডিট"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pub.id)}
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
