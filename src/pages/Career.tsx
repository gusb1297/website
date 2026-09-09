import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useFileInput } from '../hooks/useFileInput';
import { CareerCircular } from '../types';
import {
  Briefcase,
  MapPin,
  Calendar,
  Users,
  FileText,
  Upload,
  CheckCircle2,
  X,
  Send,
  Download,
} from 'lucide-react';

export const Career: React.FC = () => {
  const { data: careers } = useFetch<CareerCircular[]>('/api/career');
  const [selectedCircular, setSelectedCircular] = useState<CareerCircular | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const cvInput = useFileInput();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read the file at submit time (state, falling back to the input itself)
    // so the FormData always carries the file the browser is showing.
    const cvFile = cvInput.getFile();
    if (!cvFile) {
      setErrorMsg('অনুগ্রহ করে আপনার সিভি (PDF ফরম্যাট) সিলেক্ট করুন।');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('careerId', selectedCircular?.id || 'gen');
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('notes', notes);
      // Field name must match `upload.single('cvFile')` on the server.
      formData.append('cvFile', cvFile, cvFile.name);

      const res = await fetch('/api/career/apply', {
        method: 'POST',
        // No Content-Type header: the browser sets multipart/form-data with the boundary.
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        // Public visitors should not see infrastructure details — keep the
        // storage-refusal explanation for the admin, show a short message here.
        const technical = typeof json.error === 'string' && /^[a-z0-9_]+$/i.test(json.error);
        throw new Error(
          res.status === 503
            ? 'সিভি আপলোড এই মুহূর্তে সম্ভব হচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা ইমেইলে সিভি পাঠান।'
            : (!technical && json.error) || json.message || 'আবেদন জমা দিতে ব্যর্থ হয়েছে'
        );
      }

      setSuccessMsg('আপনার আবেদনপত্র ও সিভি সফলভাবে জমা হয়েছে। ধন্যবাদ!');
      setName('');
      setEmail('');
      setPhone('');
      cvInput.reset();
      setNotes('');
      setTimeout(() => {
        setApplyModalOpen(false);
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'আবেদন জমা দিতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          ক্যারিয়ার ও নিয়োগ বিজ্ঞপ্তি
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          আমাদের দলের অংশ হোন
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          উত্তরবঙ্গের সামাজিক অগ্রগতি ও দারিদ্র্য বিমোচনে নিবেদিত পেশাদারদের আহ্বান জানানো হচ্ছে।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Job Circular List */}
          <div className="lg:col-span-12 space-y-6">
            {(careers || []).map((circular) => {
              const deadlineDate = new Date(circular.deadline).toLocaleDateString('bn-BD', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });

              return (
                <div
                  key={circular.id}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg hover:shadow-2xl transition-all space-y-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 mb-2">
                        <Briefcase className="w-3.5 h-3.5" /> নিয়োগ বিজ্ঞপ্তি
                      </span>
                      <h2 className="text-2xl font-serif font-bold text-slate-900">
                        {circular.title}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {circular.pdfFile && (
                        <a
                          href={circular.pdfFile}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all"
                        >
                          <Download className="w-4 h-4 text-emerald-800" /> অফিশিয়াল নোটিশ (PDF)
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setSelectedCircular(circular);
                          setApplyModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all border border-amber-300"
                      >
                        <Send className="w-4 h-4" /> সরাসরি সিভি দিন (Apply)
                      </button>
                    </div>
                  </div>

                  {/* Circular Highlights */}
                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-700" />
                      <strong>কর্মস্থল:</strong> {circular.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-700" />
                      <strong>পদসংখ্যা:</strong> {circular.vacancy} জন
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <strong>আবেদনের শেষ তারিখ:</strong> {deadlineDate}
                    </span>
                  </div>

                  {/* Description Markdown */}
                  <div className="bg-[#faf8f5] p-5 rounded-2xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line border border-slate-200">
                    {circular.description}
                  </div>
                </div>
              );
            })}

            {(careers || []).length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-500 font-serif space-y-2 border border-slate-200">
                <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
                <p>বর্তমানে কোনো নতুন নিয়োগ বিজ্ঞপ্তি প্রকাশ হয়নি।</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Applicant CV Submission Modal */}
      {applyModalOpen && selectedCircular && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setApplyModalOpen(false)}
        >
          <div
            className="relative max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setApplyModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                চাকরির আবেদন
              </span>
              <h3 className="text-xl font-serif font-bold text-slate-900 mt-0.5">
                {selectedCircular.title}
              </h3>
            </div>

            {successMsg ? (
              <div className="p-6 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2 text-emerald-900 font-serif">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <p className="font-bold text-base">{successMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    আপনার পূর্ণ নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: মো: কামরুল হাসান"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ইমেইল ঠিকানা <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      মোবাইল নম্বর <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="01711000000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    সিভি (CV) ফাইল আপলোড করুন (PDF) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center hover:border-emerald-600 transition-colors bg-slate-50">
                    <input
                      ref={cvInput.inputRef}
                      type="file"
                      name="cvFile"
                      required
                      accept=".pdf,application/pdf"
                      onChange={cvInput.onChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-emerald-800 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700">
                      {cvInput.file ? cvInput.file.name : 'সিভি নির্বাচন করতে এখানে ক্লিক করুন (PDF)'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    অতিরিক্ত কোনো মন্তব্য / বার্তা (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="আপনার অভিজ্ঞতা বা বিশেষ বক্তব্য..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
                  >
                    {submitting ? 'আবেদন জমা হচ্ছে...' : 'আবেদনপত্র জমা দিন'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
