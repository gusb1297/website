import React from 'react';
import { useFetch } from '../hooks/useFetch';
import { SiteSettings } from '../types';
import { MapWidget } from '../components/MapWidget';
import { MapPin, Phone, Mail, Clock, ShieldCheck, Building2 } from 'lucide-react';

export const Contact: React.FC = () => {
  const { data: settings } = useFetch<SiteSettings>('/api/settings');

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          আমাদের কার্যালয় নেটওয়ার্ক
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          যোগাযোগ ও প্রধান কার্যালয়
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) প্রধান কার্যালয় এবং উত্তরবঙ্গের আঞ্চলিক শাখা কার্যালয়সমূহের ঠিকানা।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Head Office Information Glass Card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="flex items-center gap-2 text-emerald-800 font-bold border-b border-slate-200 pb-3">
            <Building2 className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-serif text-slate-900">প্রধান কার্যালয় (Head Office)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-slate-700">
            <div className="p-4 rounded-2xl bg-[#faf8f5] border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-amber-800 uppercase block">ঠিকানা:</span>
              <p className="font-semibold text-slate-900">{settings?.address}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#faf8f5] border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-amber-800 uppercase block">ফোন নম্বর:</span>
              <a
                href={`tel:${settings?.phone.split(',')[0].trim()}`}
                className="font-semibold text-emerald-800 hover:underline block"
              >
                {settings?.phone}
              </a>
            </div>

            <div className="p-4 rounded-2xl bg-[#faf8f5] border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-amber-800 uppercase block">ইমেইল ঠিকানা:</span>
              <a
                href={`mailto:${settings?.email}`}
                className="font-semibold text-emerald-800 hover:underline block"
              >
                {settings?.email}
              </a>
            </div>

            <div className="p-4 rounded-2xl bg-[#faf8f5] border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-amber-800 uppercase block">অফিস সময়:</span>
              <p className="font-semibold text-slate-900">{settings?.officeHours}</p>
            </div>
          </div>
        </div>

        {/* Interactive Google Map & Branch Addresses */}
        {settings && <MapWidget settings={settings} />}
      </div>
    </div>
  );
};
