import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { AssetField } from '../components/admin/AssetField';
import { useAuth } from '../context/AuthContext';
import { useSaveAction } from '../hooks/useSaveAction';
import { useToast } from '../context/ToastContext';
import type { AssetValue } from '../lib/upload';
import { CareerCircular, Applicant } from '../types';
import { Briefcase, Users, Download, Trash2, Mail, Phone, Edit3, X, Save } from 'lucide-react';

export const ManageCareer: React.FC = () => {
  const toast = useToast();
  const { token } = useAuth();
  const { saving: submitting, run } = useSaveAction();
  const { data: careers, refetch: refetchCareers } = useFetch<CareerCircular[]>('/api/career?all=true');
  const { data: applicants, refetch: refetchApplicants } = useFetch<Applicant[]>('/api/career/applications', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const [title, setTitle] = useState('');
  const [vacancy, setVacancy] = useState(2);
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState('2026-12-31');
  const [description, setDescription] = useState('');
  const [pdfAsset, setPdfAsset] = useState<AssetValue | null>(null);

  const [editing, setEditing] = useState<CareerCircular | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVacancy, setEditVacancy] = useState(1);
  const [editLocation, setEditLocation] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editDescription, setEditDescription] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location.trim() || !description.trim()) {
      toast.error({ title: 'শিরোনাম, কর্মস্থল ও বিবরণ আবশ্যক' });
      return;
    }
    if (pdfAsset && !pdfAsset.url) {
      toast.error({ title: 'PDF ফাইলটি ঠিকভাবে আপলোড হয়নি', description: 'আবার ফাইল বেছে নিন।' });
      return;
    }

    const created = await run<CareerCircular>({
      url: '/api/career',
      body: {
        title: title.trim(),
        vacancy,
        location: location.trim(),
        deadline,
        description: description.trim(),
        isActive: true,
        pdfFile: pdfAsset,
      },
      success: 'নিয়োগ বিজ্ঞপ্তি প্রকাশিত হয়েছে',
      failure: 'বিজ্ঞপ্তি সংরক্ষণ করা যায়নি',
    });
    if (!created) return;

    setTitle('');
    setDescription('');
    setLocation('');
    setPdfAsset(null);
    refetchCareers();
  };

  const startEdit = (circular: CareerCircular) => {
    setEditing(circular);
    setEditTitle(circular.title);
    setEditVacancy(circular.vacancy);
    setEditLocation(circular.location);
    setEditDeadline(String(circular.deadline).slice(0, 10));
    setEditDescription(circular.description);
  };


  const handleSaveEdit = async () => {
    if (!editing) return;
    const saved = await run<CareerCircular>({
      url: `/api/career/${editing.id}`,
      method: 'PUT',
      body: {
        title: editTitle.trim(),
        vacancy: editVacancy,
        location: editLocation.trim(),
        deadline: editDeadline,
        description: editDescription.trim(),
        isActive: editing.isActive,
      },
      success: 'বিজ্ঞপ্তি আপডেট হয়েছে',
      failure: 'বিজ্ঞপ্তি আপডেট করা যায়নি',
    });
    if (!saved) return;
    setEditing(null);
    refetchCareers();
  };


  const toggleActive = async (circular: CareerCircular) => {
    const saved = await run<CareerCircular>({
      url: `/api/career/${circular.id}`,
      method: 'PUT',
      body: { isActive: !circular.isActive },
      success: circular.isActive ? 'বিজ্ঞপ্তি নিষ্ক্রিয় করা হয়েছে' : 'বিজ্ঞপ্তি সক্রিয় করা হয়েছে',
      failure: 'অবস্থা পরিবর্তন করা যায়নি',
    });
    if (saved) refetchCareers();
  };


  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই বিজ্ঞপ্তিটি মুছে ফেলতে চান?')) return;
    const done = await run({
      url: `/api/career/${id}`,
      method: 'DELETE',
      success: 'বিজ্ঞপ্তি মুছে ফেলা হয়েছে',
      failure: 'বিজ্ঞপ্তি মুছে ফেলা যায়নি',
    });
    if (done !== null) refetchCareers();
  };


  const handleDeleteApplication = async (id: string) => {
    if (!confirm('আপনি কি এই আবেদনটি মুছে ফেলতে চান?')) return;
    const done = await run({
      url: `/api/career/applications/${id}`,
      method: 'DELETE',
      success: 'আবেদনটি মুছে ফেলা হয়েছে',
      failure: 'আবেদন মুছে ফেলা যায়নি',
    });
    if (done !== null) refetchApplicants();
  };

  return (
    <div className="space-y-8">
      {/* 1. Add New Job Circular Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-amber-500" /> নতুন নিয়োগ বিজ্ঞপ্তি প্রকাশ করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পদের নাম / সার্কুলার টাইটেল</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: ফিল্ড অফিসার (ক্ষুদ্রঋণ ও স্বাস্থ্যপ্রকল্প)"
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পদসংখ্যা</label>
              <input
                type="number"
                value={vacancy}
                onChange={(e) => setVacancy(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">কর্মস্থল</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">আবেদনের শেষ তারিখ</label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">যোগ্যতা ও কাজের বিবরণ</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="যোগ্যতা, অভিজ্ঞতা ও সুযোগ-সুবিধার বিবরণ লিখুন..."
              className="w-full px-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <AssetField
                kind="document"
                folder="careers"
                label="অফিশিয়াল সার্কুলার (PDF — ঐচ্ছিক)"
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
            {submitting ? 'প্রকাশ হচ্ছে...' : 'সার্কুলার প্রকাশ করুন'}
          </button>
        </form>
      </div>

      {/* 2. Circulars List with Edit/Delete */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">প্রকাশিত নিয়োগ বিজ্ঞপ্তি ({careers?.length || 0})</h4>

        <div className="space-y-3">
          {(careers || []).map((circular) => (
            <div key={circular.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{circular.title}</h5>
                  <p className="text-[11px] text-slate-500">
                    পদসংখ্যা: {circular.vacancy} • মেয়াদ: {new Date(circular.deadline).toLocaleDateString('bn-BD')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(circular)}
                    className="p-2 rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-colors"
                    title="এডিট"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(circular.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editing?.id === circular.id && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="পদের নাম" />
                  <input type="number" value={editVacancy} onChange={(e) => setEditVacancy(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="পদসংখ্যা" />
                  <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="কর্মস্থল" />
                  <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="px-3 py-2 rounded-lg text-xs border border-slate-300" />
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="বিবরণ" />
                  <div className="col-span-2 flex gap-2">
                    <button onClick={handleSaveEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold">
                      <Save className="w-3.5 h-3.5" /> আপডেট সেভ করুন
                    </button>
                    <button
                      onClick={() => toggleActive(circular)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${circular.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {circular.isActive ? 'সক্রিয় → নিষ্ক্রিয়' : 'নিষ্ক্রিয় → সক্রিয়'}
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

      {/* 3. Job Applicants Submissions & CV Download Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-800" /> আবেদনকারীদের তালিকা ও সিভিসমূহ ({applicants?.length || 0})
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-950 text-white font-serif">
                <th className="p-3 rounded-tl-xl">আবেদনকারীর নাম</th>
                <th className="p-3">যোগাযোগ</th>
                <th className="p-3">নোট / মন্তব্য</th>
                <th className="p-3">তারিখ</th>
                <th className="p-3 rounded-tr-xl">সিভি (CV) ডাউনলোড</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(applicants || []).map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{app.name}</td>
                  <td className="p-3 space-y-0.5">
                    <p className="flex items-center gap-1 text-slate-700">
                      <Mail className="w-3 h-3 text-emerald-700" /> {app.email}
                    </p>
                    <p className="flex items-center gap-1 text-slate-700 font-mono">
                      <Phone className="w-3 h-3 text-amber-600" /> {app.phone}
                    </p>
                  </td>
                  <td className="p-3 text-slate-600 max-w-xs truncate">{app.notes || 'N/A'}</td>
                  <td className="p-3 text-slate-500 font-mono">
                    {new Date(app.submittedAt).toLocaleDateString('bn-BD')}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={app.cvFile}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                      >
                        <Download className="w-3.5 h-3.5" /> সিভি দেখুন
                      </a>
                      <button
                        onClick={() => handleDeleteApplication(app.id)}
                        className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                        title="আবেদন মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {(applicants || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-serif">
                    এখনও কোনো আবেদন জমা পড়েনি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
