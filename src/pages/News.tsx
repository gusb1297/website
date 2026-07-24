import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { NewsItem } from '../types';
import { NewsCard } from '../components/NewsCard';
import { Search, Tag } from 'lucide-react';

export const News: React.FC = () => {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUrl = `/api/news${selectedCat !== 'all' ? `?category=${selectedCat}` : ''}`;
  const { data: newsList, loading } = useFetch<NewsItem[]>(fetchUrl);

  const filtered = (newsList || []).filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          সংবাদ কেন্দ্র
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          খবর, সংবাদ ও প্রেস বিজ্ঞপ্তি
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) সাম্প্রতিক ইভেন্ট, সাফল্য এবং মাঠ পর্যায়ের খবর।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-md">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="সংবাদ খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'সব খবর' },
              { id: 'News', label: 'সাধারণ সংবাদ' },
              { id: 'Event', label: 'ইভেন্ট' },
              { id: 'Press Release', label: 'প্রেস বিজ্ঞপ্তি' },
              { id: 'Impact Story', label: 'সফলতার গল্প' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCat === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* News Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-500 font-serif">
            <p>কোনো খবর পাওয়া যায়নি।</p>
          </div>
        )}
      </div>
    </div>
  );
};
