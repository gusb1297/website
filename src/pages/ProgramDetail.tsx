import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { Program } from '../types';
import { ArrowLeft, CheckCircle2, Users, MapPin, Calendar, FileText } from 'lucide-react';

export const ProgramDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: program, loading, error } = useFetch<Program>(`/api/programs/${slug}`);

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center font-serif text-slate-600">
        <p>প্রজেক্টের বিবরণ লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="pt-32 pb-20 min-h-screen max-w-3xl mx-auto px-4 text-center space-y-4 font-serif">
        <h2 className="text-2xl font-bold text-slate-800">প্রজেক্টটি পাওয়া যায়নি</h2>
        <Link to="/programs" className="inline-block px-6 py-2 rounded-full bg-amber-500 text-slate-950 font-bold">
          সব প্রজেক্টে ফিরে যান
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Header Banner */}
      <div className="bg-emerald-950 text-white py-12 px-4 border-b-4 border-amber-500 relative">
        <div className="max-w-5xl mx-auto space-y-4">
          <Link
            to="/programs"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> সব প্রজেক্টে ফিরুন
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                program.status === 'ongoing' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'
              }`}
            >
              {program.status === 'ongoing' ? 'চলমান প্রজেক্ট' : 'সম্পন্ন প্রজেক্ট'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">{program.title}</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Cover Image */}
        <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
          <img src={program.coverImage} alt={program.title} className="w-full h-[400px] object-cover" />
        </div>

        {/* Stats Row */}
        {program.beneficiariesCount && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg text-center">
            <div>
              <span className="text-xs text-slate-500 font-semibold block">উপকৃত মোট পরিবার</span>
              <span className="text-2xl font-serif font-bold text-emerald-800">
                {program.beneficiariesCount.toLocaleString('bn-BD')}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-semibold block">আওতাভুক্ত জেলা</span>
              <span className="text-2xl font-serif font-bold text-amber-600">
                {program.districtsCovered} টি
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-semibold block">প্রজেক্ট অবস্থা</span>
              <span className="text-base font-serif font-bold text-slate-800 uppercase mt-1 block">
                {program.status === 'ongoing' ? 'চলমান' : 'সম্পন্ন'}
              </span>
            </div>
          </div>
        )}

        {/* Detailed Content */}
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-slate-700 leading-relaxed text-sm sm:text-base">
          <h3 className="text-2xl font-serif font-bold text-slate-900 border-b border-slate-200 pb-3">
            প্রজেক্টের বিস্তারিত রূপরেখা
          </h3>

          <div className="whitespace-pre-line space-y-4">{program.content}</div>
        </div>
      </div>
    </div>
  );
};
