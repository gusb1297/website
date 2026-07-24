import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { Program } from '../types';
import { ProgramCard } from '../components/ProgramCard';
import { Search, Filter, Sprout } from 'lucide-react';

export const Programs: React.FC = () => {
  const { data: programs, loading } = useFetch<Program[]>('/api/programs');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPrograms = (programs || []).filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.shortDesc.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          আমাদের মূল উদ্যোগসমূহ
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          কার্যক্রম ও প্রজেক্টসমূহ
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          দরিদ্র বিমোচন, শিক্ষা, স্বাস্থ্য সেবা ও জলবায়ু সহনশীলতায় গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) বহুমুখী
          উদ্যোগ।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-md">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="প্রজেক্ট খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-emerald-800" />
            <span className="text-xs font-semibold text-slate-600">স্ট্যাটাস:</span>
            <div className="flex space-x-1">
              {[
                { id: 'all', label: 'সব প্রজেক্ট' },
                { id: 'ongoing', label: 'চলমান' },
                { id: 'completed', label: 'সম্পন্ন' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setStatusFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === btn.id
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Programs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPrograms.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>

        {filteredPrograms.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-500 font-serif space-y-2">
            <Sprout className="w-12 h-12 text-slate-400 mx-auto" />
            <p>আপনার সার্চ অনুযায়ী কোনো প্রজেক্ট পাওয়া যায়নি।</p>
          </div>
        )}
      </div>
    </div>
  );
};
