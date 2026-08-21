import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Coins, HeartPulse, GraduationCap, Sprout, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Program } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface ProgramCardProps {
  program: Program;
}

const iconComponentMap: Record<string, React.ReactNode> = {
  Coins: <Coins className="w-6 h-6 text-amber-500" />,
  HeartPulse: <HeartPulse className="w-6 h-6 text-emerald-600" />,
  GraduationCap: <GraduationCap className="w-6 h-6 text-blue-600" />,
  Sprout: <Sprout className="w-6 h-6 text-amber-600" />,
};

export const ProgramCard: React.FC<ProgramCardProps> = ({ program }) => {
  const { lang, t } = useLanguage();

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[color:var(--site-primary)]/10 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full group hover:-translate-y-1">
      {/* Cover Image Container with Hover Zoom */}
      <div className="relative h-56 overflow-hidden bg-[color:var(--site-primary)]">
        <img
          src={program.coverImage}
          alt={program.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--site-primary)]/90 via-[color:var(--site-primary)]/20 to-transparent" />

        {/* Status Badge */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[color:var(--site-primary)]/90 text-[color:var(--site-accent)] border border-[color:var(--site-accent)]/30 text-[10px] font-bold uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3 text-[color:var(--site-accent)]" />
            {program.status === 'ongoing'
              ? (lang === 'en' ? 'Ongoing Project' : 'চলমান প্রজেক্ট')
              : (lang === 'en' ? 'Completed Project' : 'সম্পন্ন প্রজেক্ট')}
          </span>
        </div>

        {/* Floating Category Tag */}
        <div className="absolute bottom-4 left-4 text-xs font-bold uppercase tracking-widest text-[color:var(--site-accent)] bg-[color:var(--site-primary)]/90 px-3 py-1 border border-[color:var(--site-accent)]/20">
          {lang === 'en' ? 'Program' : 'প্রোগ্রাম'}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <h3 className="text-lg font-serif font-bold text-[color:var(--site-primary)] group-hover:text-[color:var(--site-accent)] transition-colors leading-snug line-clamp-2">
            {program.title}
          </h3>
          <p className="text-xs text-[color:var(--site-primary)]/70 leading-relaxed font-sans line-clamp-3">
            {program.shortDesc}
          </p>
        </div>

        {/* Key Metrics row */}
        {program.beneficiariesCount && (
          <div className="mt-4 pt-3 border-t border-[color:var(--site-primary)]/10 flex items-center justify-between text-[11px] text-[color:var(--site-primary)]/60 font-sans">
            <span>
              {lang === 'en' ? 'Beneficiaries: ' : 'উপকৃত পরিবার: '}{' '}
              <strong className="text-[color:var(--site-primary)] font-semibold">
                {lang === 'en'
                  ? program.beneficiariesCount.toLocaleString('en-US')
                  : program.beneficiariesCount.toLocaleString('bn-BD')}
              </strong>
            </span>
            <span>
              {lang === 'en' ? 'Districts: ' : 'জেলা: '}{' '}
              <strong className="text-[color:var(--site-primary)] font-semibold">
                {program.districtsCovered}
              </strong>
            </span>
          </div>
        )}

        {/* CTA Link */}
        <div className="mt-5 pt-2">
          <Link
            to={`/programs/${program.slug}`}
            className="inline-flex items-center gap-2 text-[11px] font-bold text-[color:var(--site-primary)] hover:text-[color:var(--site-accent)] transition-colors uppercase tracking-widest group/link"
          >
            <span>{t('read_more')}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform text-[color:var(--site-accent)]" />
          </Link>
        </div>
      </div>
    </div>
  );
};
