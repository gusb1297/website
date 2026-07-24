import React from 'react';
import { FileText, Download, X, ExternalLink } from 'lucide-react';

interface PDFViewerModalProps {
  title: string;
  pdfUrl: string;
  onClose: () => void;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ title, pdfUrl, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full h-[85vh] bg-emerald-950 rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-serif font-bold text-base text-white line-clamp-1">{title}</h3>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={pdfUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow"
            >
              <Download className="w-3.5 h-3.5" /> ডাউনলোড
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-emerald-900 text-white hover:bg-amber-500 hover:text-slate-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Embedded PDF View */}
        <div className="flex-1 bg-slate-900 w-full relative">
          <iframe
            src={`${pdfUrl}#toolbar=1`}
            title={title}
            className="w-full h-full border-0"
          >
            <div className="p-12 text-center text-white space-y-4">
              <p>আপনার ব্রাউজারে ইনলাইন পিডিএফ ভিউয়ার সাপোর্ট করছে না।</p>
              <a
                href={pdfUrl}
                download
                className="inline-block px-6 py-3 rounded-lg bg-amber-500 text-slate-950 font-bold"
              >
                পিডিএফ ডাউনলোড করুন
              </a>
            </div>
          </iframe>
        </div>
      </div>
    </div>
  );
};
