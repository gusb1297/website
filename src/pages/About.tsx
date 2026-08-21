import React from 'react';
import {
  Target,
  Compass,
  FileCheck,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { StatItem, PageContent, BilingualText } from '../types';
import { StatsCounter } from '../components/StatsCounter';
import { useLanguage } from '../context/LanguageContext';

const pick = (value: BilingualText | undefined, lang: 'bn' | 'en', fallback: string) =>
  value?.[lang] || value?.en || fallback;

export const About: React.FC = () => {
  const { lang } = useLanguage();
  const { data: stats } = useFetch<StatItem[]>('/api/stats');
  const { data: pageContent } = useFetch<PageContent>('/api/page-content');

  const about = pageContent?.about;
  const chairman = about?.chairman;
  const director = about?.director;
  const legalItems = about?.legalItems || [];

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#F8F5F0]">
      {/* Page Banner Header */}
      <div className="bg-[color:var(--site-primary)] text-white py-16 px-4 border-b-2 border-[color:var(--site-accent)]/40 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center space-y-3 relative z-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--site-accent)]">
            {pick(about?.bannerBadge, lang, lang === 'en' ? 'Our Identity & Heritage' : 'আমাদের পরিচয় ও ইতিহাস')}
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[color:var(--site-cream)]">
            {pick(about?.bannerTitle, lang, '')}
          </h1>
          <p className="text-[color:var(--site-cream)]/80 text-sm sm:text-base max-w-2xl mx-auto font-sans">
            {pick(about?.bannerSub, lang, '')}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
        {/* 1. History & Vision/Mission */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h2 className="text-3xl font-serif font-bold text-[color:var(--site-primary)] leading-tight">
              {pick(about?.historyTitle, lang, lang === 'en' ? 'Organization History & Genesis' : 'সংস্থার ইতিহাস ও সূচনা')}
            </h2>
            <p className="text-sm text-[color:var(--site-primary)]/75 leading-relaxed font-sans">
              {pick(about?.history1, lang, '')}
            </p>
            <p className="text-sm text-[color:var(--site-primary)]/75 leading-relaxed font-sans">
              {pick(about?.history2, lang, '')}
            </p>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 gap-6">
            <div className="bg-[color:var(--site-primary)] text-white p-6 sm:p-8 rounded-2xl border-l-4 border-[color:var(--site-accent)] shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-[color:var(--site-accent)] font-bold font-serif text-lg">
                <Target className="w-5 h-5 text-[color:var(--site-accent)]" />
                {lang === 'en' ? 'Our Vision' : 'ভিশন (Vision)'}
              </div>
              <p className="text-xs sm:text-sm text-[color:var(--site-cream)]/90 leading-relaxed font-sans">
                {pick(about?.vision, lang, '')}
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[color:var(--site-primary)]/10 shadow-md space-y-3">
              <div className="flex items-center gap-2 text-[color:var(--site-primary)] font-bold font-serif text-lg">
                <Compass className="w-5 h-5 text-[color:var(--site-accent)]" />
                {lang === 'en' ? 'Our Mission' : 'মিশন (Mission)'}
              </div>
              <p className="text-xs sm:text-sm text-[color:var(--site-primary)]/75 leading-relaxed font-sans">
                {pick(about?.mission, lang, '')}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Chairman & Executive Director Message (editable) */}
        <div className="bg-white rounded-2xl p-8 lg:p-12 border border-[color:var(--site-primary)]/10 shadow-lg space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold text-[color:var(--site-accent)] uppercase tracking-[0.2em]">
              {pick(about?.messageSectionBadge, lang, lang === 'en' ? 'Leadership Message' : 'নেতৃত্বের বার্তা')}
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[color:var(--site-primary)] mt-1">
              {pick(
                about?.messageSectionTitle,
                lang,
                lang === 'en' ? 'Message from Chairman & Executive Director' : 'চেয়ারম্যান ও নির্বাহী পরিচালকের বক্তব্য'
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { profile: chairman, alt: 'Chairman' },
              { profile: director, alt: 'Executive Director' },
            ].map(({ profile, alt }, idx) => (
              <div key={idx} className="bg-[#F8F5F0] p-6 sm:p-8 rounded-2xl border border-[color:var(--site-primary)]/10 flex flex-col justify-between">
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-[color:var(--site-primary)]/80 italic leading-relaxed font-sans">
                    {pick(profile?.message, lang, '')}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[color:var(--site-primary)]/10 flex items-center gap-4">
                  {profile?.photo && (
                    <img
                      src={profile.photo}
                      alt={alt}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[color:var(--site-accent)]"
                    />
                  )}
                  <div>
                    <h4 className="font-serif font-bold text-sm text-[color:var(--site-primary)]">
                      {pick(profile?.name, lang, '—')}
                    </h4>
                    <p className="text-[11px] text-[color:var(--site-accent)] font-bold uppercase tracking-wider">
                      {pick(profile?.title, lang, '')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Legal Status & Registration Box (editable) */}
        <div className="bg-[color:var(--site-primary)] text-white rounded-2xl p-8 sm:p-10 border border-[color:var(--site-accent)]/30 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-[color:var(--site-accent)] uppercase tracking-[0.2em]">
                {pick(about?.legalBadge, lang, lang === 'en' ? 'Legal Status & Accreditation' : 'আইনগত স্বীকৃতি ও অনুমোদন')}
              </span>
              <h3 className="text-2xl font-serif font-bold text-[color:var(--site-cream)]">
                {pick(about?.legalTitle, lang, '')}
              </h3>
              <p className="text-xs sm:text-sm text-[color:var(--site-cream)]/80 font-sans">
                {pick(about?.legalSub, lang, '')}
              </p>
            </div>

            {legalItems.length > 0 && (
              <div className="bg-[color:var(--site-primary)]/80 p-6 rounded-2xl border border-[color:var(--site-accent)]/40 text-xs space-y-2.5 shrink-0">
                {legalItems.map((item, idx) => (
                  <p key={idx} className="flex items-center gap-2 text-[color:var(--site-accent)] font-semibold">
                    <FileCheck className="w-4 h-4 text-[color:var(--site-accent)]" />
                    {pick(item, lang, item?.en || '')}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Animated Stats Overview */}
      {stats && <StatsCounter stats={stats} />}
    </div>
  );
};
