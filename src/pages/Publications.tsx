import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { Publication } from '../types';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { FileText, Download, Eye, Calendar, BookOpen } from 'lucide-react';

export const Publications: React.FC = () => {
  const { data: publications } = useFetch<Publication[]>('/api/publications');
  const [selectedType, setSelectedType] = useState<'all' | 'annual_report' | 'newsletter' | 'report'>('all');
  const [activePdf, setActivePdf] = useState<{ title: string; url: string } | null>(null);

  const filteredPubs = (publications || []).filter((p) => {
    if (selectedType === 'all') return true;
    return p.type === selectedType;
  });

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          তথ্য, অডিট ও গবেষণা প্রকাশনা
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          বার্ষিক প্রতিবেদন ও পাবলিকেশন
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          স্বচ্ছতা ও জবাবদিহিতা রক্ষায় গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) সকল বার্ষিক অডিট ও প্রভাব মূল্যায়ন রিপোর্ট।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            { id: 'all', label: 'সব প্রকাশনা' },
            { id: 'annual_report', label: 'বার্ষিক প্রতিবেদন (Annual Reports)' },
            { id: 'newsletter', label: 'ত্রৈমাসিক বুলেটিন (Newsletters)' },
            { id: 'report', label: 'গবেষণা ও প্রভাব সমীক্ষা (Research)' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedType(btn.id as any)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                selectedType === btn.id
                  ? 'bg-amber-500 text-slate-950 shadow-lg scale-105 border border-amber-300'
                  : 'bg-emerald-900/10 text-emerald-950 hover:bg-emerald-900/20'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Publications Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPubs.map((pub) => (
            <div
              key={pub.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-18 rounded-lg bg-emerald-950 flex flex-col items-center justify-center text-amber-400 shrink-0 p-2 border border-amber-500/30">
                  <BookOpen className="w-6 h-6" />
                  <span className="text-[10px] font-bold text-white mt-1">{pub.year}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {pub.type === 'annual_report'
                      ? 'বার্ষিক অডিট'
                      : pub.type === 'newsletter'
                      ? 'বুলেটিন'
                      : 'গবেষণা সমীক্ষা'}
                  </span>
                  <h3 className="font-serif font-bold text-base text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2">
                    {pub.title}
                  </h3>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setActivePdf({ title: pub.title, url: pub.pdfFile })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold transition-all"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" /> প্রিভিউ দেখুন
                </button>

                <a
                  href={pub.pdfFile}
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> ডাউনলোড
                </a>
              </div>
            </div>
          ))}
        </div>

        {filteredPubs.length === 0 && (
          <div className="text-center py-16 text-slate-500 font-serif">
            <p>এই বিভাগে কোনো প্রকাশনা যুক্ত করা হয়নি।</p>
          </div>
        )}
      </div>

      {/* PDF Modal */}
      {activePdf && (
        <PDFViewerModal
          title={activePdf.title}
          pdfUrl={activePdf.url}
          onClose={() => setActivePdf(null)}
        />
      )}
    </div>
  );
};
