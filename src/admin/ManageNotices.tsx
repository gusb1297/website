import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { AssetField } from '../components/admin/AssetField';
import { useSaveAction } from '../hooks/useSaveAction';
import { useToast } from '../context/ToastContext';
import { uploadQueueSize } from '../lib/upload';
import type { AssetValue } from '../lib/upload';
import { Notice } from '../types';
import { FileText, Plus, Trash2, Edit3, X, Save, Eye, EyeOff } from 'lucide-react';

export const ManageNotices: React.FC = () => {
  const toast = useToast();
  const { saving: submitting, run } = useSaveAction();
  const { data: notices, refetch } = useFetch<Notice[]>('/api/notices?all=true');

  const [title, setTitle] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [pdfAsset, setPdfAsset] = useState<AssetValue | null>(null);

  const [editing, setEditing] = useState<Notice | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editPdf, setEditPdf] = useState<AssetValue | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error({ title: 'নোটিশের শিরোনাম লিখুন' });
      return;
    }
    if (!pdfAsset?.url && uploadQueueSize() === 0) {
      toast.error({
        title: 'নোটিশের PDF ফাইল দিন',
        description: 'ফাইলটি বেছে নিলেই সরাসরি Cloudinary-তে আপলোড হয়ে যাবে।',
      });
      return;
    }

    const created = await run<Notice>({
      url: '/api/notices',
      body: {
        title: title.trim(),
        referenceNo: referenceNo.trim(),
        expiryDate: expiryDate || undefined,
        isActive: true,
        pdfFile: pdfAsset,
      },
      success: 'নোটিশ প্রকাশিত হয়েছে',
      failure: 'নোটিশ সংরক্ষণ করা যায়নি',
    });
    if (!created) return;

    setTitle('');
    setReferenceNo('');
    setExpiryDate('');
    setPdfAsset(null);
    refetch();
  };


  const startEdit = (notice: Notice) => {
    setEditing(notice);
    setEditTitle(notice.title);
    setEditReference(notice.referenceNo || '');
    setEditExpiry(notice.expiryDate ? String(notice.expiryDate).slice(0, 10) : '');
    setEditPdf(notice.pdfFile ? { url: notice.pdfFile, publicId: notice.pdfFilePublicId } : null);
  };


  const handleSaveEdit = async () => {
    if (!editing) return;
    const saved = await run<Notice>({
      url: `/api/notices/${editing.id}`,
      method: 'PUT',
      body: {
        title: editTitle.trim(),
        referenceNo: editReference.trim(),
        expiryDate: editExpiry || '',
        isActive: editing.isActive,
        pdfFile: editPdf,
      },
      success: 'নোটিশ আপডেট হয়েছে',
      failure: 'নোটিশ আপডেট করা যায়নি',
    });
    if (!saved) return;
    setEditing(null);
    setEditPdf(null);
    refetch();
  };


  const toggleActive = async (notice: Notice) => {
    const saved = await run<Notice>({
      url: `/api/notices/${notice.id}`,
      method: 'PUT',
      body: { isActive: !notice.isActive },
      success: notice.isActive ? 'নোটিশটি নিষ্ক্রিয় করা হয়েছে' : 'নোটিশটি সক্রিয় করা হয়েছে',
      failure: 'অবস্থা পরিবর্তন করা যায়নি',
    });
    if (saved) refetch();
  };


  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই নোটিশটি মুছে ফেলতে চান?')) return;
    const done = await run({
      url: `/api/notices/${id}`,
      method: 'DELETE',
      success: 'নোটিশটি মুছে ফেলা হয়েছে',
      failure: 'নোটিশ মুছে ফেলা যায়নি',
    });
    if (done !== null) refetch();
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
              <AssetField
                kind="document"
                folder="notices"
                label="নোটিশের PDF ফাইল"
                value={pdfAsset}
                onChange={setPdfAsset}
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
                  <AssetField
                    kind="document"
                    folder="notices"
                    compact
                    value={editPdf}
                    onChange={setEditPdf}
                  />
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
