import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { CommitteeMember } from '../types';
import { CommitteeCard } from '../components/CommitteeCard';
import { Users, Award, Shield, Network } from 'lucide-react';

export const Governance: React.FC = () => {
  const { data: committee } = useFetch<CommitteeMember[]>('/api/committee');
  const [activeTab, setActiveTab] = useState<'all' | 'executive' | 'general' | 'advisory' | 'leadership'>('executive');

  const filteredMembers = (committee || []).filter((m) => {
    if (activeTab === 'all') return true;
    return m.type === activeTab;
  });

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          সুশাসন ও পরিচালনা পরিষদ
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          গভর্ন্যান্স ও সাংগঠনিক কাঠামো
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          স্বচ্ছতা, জবাবদিহিতা ও দূরদর্শী নেতৃত্বের মাধ্যমে পরিচালিত গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB)।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            { id: 'executive', label: 'কার্যনির্বাহী পরিষদ (Executive Committee)', icon: <Award className="w-4 h-4" /> },
            { id: 'leadership', label: 'উচ্চতর নেতৃত্ব (Leadership Team)', icon: <Users className="w-4 h-4" /> },
            { id: 'advisory', label: 'উপদেষ্টা পরিষদ (Advisory Board)', icon: <Shield className="w-4 h-4" /> },
            { id: 'general', label: 'সাধারণ পরিষদ (General Committee)', icon: <Users className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-lg scale-105 border border-amber-300'
                  : 'bg-emerald-900/10 text-emerald-950 hover:bg-emerald-900/20'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Member Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredMembers.map((member) => (
            <CommitteeCard key={member.id} member={member} />
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-16 text-slate-500 font-serif">
            <p>এই বিভাগে কোনো সদস্য তালিকাভুক্ত নেই।</p>
          </div>
        )}

        {/* Organogram Visual Chart */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6 mt-16">
          <div className="flex items-center gap-2 text-emerald-800 font-bold border-b border-slate-200 pb-4">
            <Network className="w-6 h-6 text-amber-500" />
            <h3 className="text-xl font-serif text-slate-900">অর্গানোগ্রাম (Organogram Overview)</h3>
          </div>

          <div className="p-6 bg-emerald-950 text-white rounded-2xl border border-amber-500/30 text-center space-y-4">
            <div className="inline-block px-6 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm">
              সাধারণ পরিষদ (General Body)
            </div>
            <div className="w-0.5 h-6 bg-amber-400 mx-auto" />
            <div className="inline-block px-6 py-2 rounded-xl bg-emerald-800 text-white font-bold text-sm border border-emerald-600">
              কার্যনির্বাহী পরিষদ (Executive Committee)
            </div>
            <div className="w-0.5 h-6 bg-amber-400 mx-auto" />
            <div className="inline-block px-6 py-2 rounded-xl bg-amber-600 text-slate-950 font-bold text-sm">
              নির্বাহী পরিচালক (Executive Director)
            </div>
            <div className="w-0.5 h-6 bg-amber-400 mx-auto" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
              <div className="p-3 bg-emerald-900 rounded-lg border border-emerald-700">
                প্রোগ্রাম ও ক্ষুদ্রঋণ বিভাগ
              </div>
              <div className="p-3 bg-emerald-900 rounded-lg border border-emerald-700">
                অর্থ ও হিসাব বিভাগ
              </div>
              <div className="p-3 bg-emerald-900 rounded-lg border border-emerald-700">
                মনিটরিং, অডিট ও মানবসম্পদ
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
