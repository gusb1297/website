import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { NewsItem } from '../types';
import { ArrowLeft, Calendar, Eye, User, Share2, Tag } from 'lucide-react';

export const NewsDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: news, loading, error } = useFetch<NewsItem>(`/api/news/${slug}`);

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center font-serif text-slate-600">
        <p>সংবাদ লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error || !news) {
    return (
      <div className="pt-32 pb-20 min-h-screen max-w-3xl mx-auto px-4 text-center space-y-4 font-serif">
        <h2 className="text-2xl font-bold text-slate-800">সংবাদটি পাওয়া যায়নি</h2>
        <Link to="/news" className="inline-block px-6 py-2 rounded-full bg-amber-500 text-slate-950 font-bold">
          সব খবরে ফিরে যান
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(news.publishedAt).toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-12 px-4 border-b-4 border-amber-500 relative">
        <div className="max-w-4xl mx-auto space-y-4">
          <Link
            to="/news"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> সব খবরে ফিরুন
          </Link>

          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-slate-950">
            {news.category}
          </span>

          <h1 className="text-2xl sm:text-4xl font-serif font-bold text-white leading-tight">
            {news.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-xs text-emerald-200 border-t border-emerald-900 pt-3">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-400" />
              {news.views} বার পঠিত
            </span>
            {news.author && (
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-400" />
                {news.author}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Thumbnail Image */}
        <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
          <img src={news.thumbnail} alt={news.title} className="w-full h-[400px] object-cover" />
        </div>

        {/* Article Body */}
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line">
          {news.content}
        </div>
      </div>
    </div>
  );
};
