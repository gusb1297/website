import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import type { Notice as NoticeType } from '../types';
import { PDFViewerModal } from '../components/PDFViewerModal';
import { FileText, Download, Eye, Calendar, AlertCircle } from 'lucide-react';

export const Notice: React.FC = () => {
  const { data: notices } = useFetch<NoticeType[]>('/api/notices');
  const [activeNotice, setActiveNotice] = useState<NoticeType | null>(null);

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          অফিসিয়াল ঘোষণা
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          নোটিশ বোর্ড ও দরপত্র বিজ্ঞপ্তি
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) সাধারণ সভা, প্রশাসনিক সিদ্ধান্ত ও টেন্ডার সার্কুলার।
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        {(notices || []).map((notice) => {
          const pubDate = new Date(notice.publishedAt).toLocaleDateString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return (
            <div
              key={notice.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 border border-amber-400/40">
                  <FileText className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                      {pubDate}
                    </span>
                    {notice.referenceNo && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                        স্মারক: {notice.referenceNo}
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif font-bold text-lg text-slate-900 group-hover:text-emerald-800 transition-colors">
                    {notice.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveNotice(notice)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 text-xs font-bold transition-all shadow"
                >
                  <Eye className="w-4 h-4" /> প্রিভিউ
                </button>

                <a
                  href={notice.pdfFile}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow"
                >
                  <Download className="w-4 h-4" /> ডাউনলোড
                </a>
              </div>
            </div>
          );
        })}

        {(notices || []).length === 0 && (
          <div className="text-center py-16 text-slate-500 font-serif space-y-2 bg-white rounded-3xl border border-slate-200">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <p>বর্তমানে কোনো নোটিশ সক্রিয় নেই।</p>
          </div>
        )}
      </div>

      {activeNotice && (
        <PDFViewerModal
          title={activeNotice.title}
          pdfUrl={activeNotice.pdfFile}
          onClose={() => setActiveNotice(null)}
        />
      )}
    </div>
  );
};
