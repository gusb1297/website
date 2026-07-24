import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { CareerCircular, Applicant } from '../types';
import { Briefcase, Users, Download, Trash2, Mail, Phone, Calendar } from 'lucide-react';

export const ManageCareer: React.FC = () => {
  const { token } = useAuth();
  const { data: careers, refetch: refetchCareers } = useFetch<CareerCircular[]>('/api/career');
  const { data: applicants, refetch: refetchApplicants } = useFetch<Applicant[]>('/api/career/applicants', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const [title, setTitle] = useState('');
  const [vacancy, setVacancy] = useState(2);
  const [location, setLocation] = useState('কুড়িগ্রাম ও রংপুর জেলা');
  const [deadline, setDeadline] = useState('2025-12-31');
  const [description, setDescription] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('vacancy', String(vacancy));
      formData.append('location', location);
      formData.append('deadline', deadline);
      formData.append('description', description);

      if (pdfFile) {
        formData.append('pdfFile', pdfFile);
      }

      const res = await fetch('/api/career', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('নিয়োগ বিজ্ঞপ্তি সেভ করা যায়নি');

      setTitle('');
      setDescription('');
      setPdfFile(null);
      refetchCareers();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই বিজ্ঞপ্তিটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/career/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      refetchCareers();
    } catch (e) {
      console.error(e);
    }
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">অফিশিয়াল সার্কুলার পিডিএফ (PDF File)</label>
            <input
              type="file"
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
            {submitting ? 'প্রকাশ হচ্ছে...' : 'সার্কুলার প্রকাশ করুন'}
          </button>
        </form>
      </div>

      {/* 2. Job Applicants Submissions & CV Download Table */}
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
                    <a
                      href={app.cvUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                    >
                      <Download className="w-3.5 h-3.5" /> সিভি দেখুন
                    </a>
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
