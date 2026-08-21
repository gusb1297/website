import React, { useState } from 'react';
import { Mail, Phone, Info, X } from 'lucide-react';
import { CommitteeMember } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface CommitteeCardProps {
  member: CommitteeMember;
}

export const CommitteeCard: React.FC<CommitteeCardProps> = ({ member }) => {
  const [showBio, setShowBio] = useState(false);
  const { lang, t } = useLanguage();

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden border border-[color:var(--site-primary)]/10 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full group hover:-translate-y-1">
        {/* Photo Container */}
        <div className="relative h-64 overflow-hidden bg-[color:var(--site-primary)]/5">
          <img
            src={member.photo}
            alt={member.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--site-primary)]/90 via-[color:var(--site-primary)]/20 to-transparent" />

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h4 className="text-lg font-bold font-serif text-[#F8F5F0] leading-snug">{member.name}</h4>
            <p className="text-xs text-[color:var(--site-accent)] font-medium mt-0.5">{member.designation}</p>
          </div>
        </div>

        {/* Content & Actions */}
        <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
          <p className="text-xs sm:text-sm text-[color:var(--site-primary)]/70 line-clamp-3 leading-relaxed font-sans">{member.bio}</p>

          <div className="pt-3 border-t border-[color:var(--site-primary)]/10 flex items-center justify-between text-xs">
            {member.email ? (
              <a
                href={`mailto:${member.email}`}
                className="text-[color:var(--site-primary)] hover:text-[color:var(--site-accent)] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[color:var(--site-accent)]" /> {lang === 'en' ? 'Email' : 'ইমেইল'}
              </a>
            ) : (
              <span />
            )}

            <button
              onClick={() => setShowBio(true)}
              className="text-[color:var(--site-accent)] hover:text-[color:var(--site-primary)] font-bold flex items-center gap-1.5 transition-colors ml-auto"
            >
              <Info className="w-3.5 h-3.5" /> {lang === 'en' ? 'Biography' : 'জীবনবৃত্তান্ত'}
            </button>
          </div>
        </div>
      </div>

      {/* Bio Modal */}
      {showBio && (
        <div
          className="fixed inset-0 z-50 bg-[color:var(--site-primary)]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowBio(false)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl p-6 sm:p-8 border border-[color:var(--site-accent)]/30 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowBio(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-[color:var(--site-primary)]/10 text-[color:var(--site-primary)] hover:bg-[color:var(--site-accent)] hover:text-white transition-all"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <img
                src={member.photo}
                alt={member.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[color:var(--site-accent)] shadow-md shrink-0"
              />
              <div>
                <h3 className="text-xl font-bold font-serif text-[color:var(--site-primary)]">{member.name}</h3>
                <p className="text-xs font-semibold text-[color:var(--site-accent)] mt-0.5">{member.designation}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[color:var(--site-primary)]/10 space-y-2 text-xs sm:text-sm text-[color:var(--site-primary)]/80 leading-relaxed font-sans">
              <p className="font-bold text-[color:var(--site-primary)]">
                {lang === 'en' ? 'Biography & Profile:' : 'পরিচিতি ও ভূমিকা:'}
              </p>
              <p>{member.bio}</p>
            </div>

            {(member.email || member.phone) && (
              <div className="pt-4 border-t border-[color:var(--site-primary)]/10 flex flex-wrap gap-4 text-xs text-[color:var(--site-primary)]/80">
                {member.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[color:var(--site-accent)]" /> {member.email}
                  </span>
                )}
                {member.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-[color:var(--site-accent)]" /> {member.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
