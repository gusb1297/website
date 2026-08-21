import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Facebook,
  Youtube,
  Linkedin,
  Twitter,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../context/SettingsContext';

export const Footer: React.FC = () => {
  const { lang, t } = useLanguage();
  const { settings } = useSettings();

  // Everything below is editable from the Admin Panel.
  const logoUrl = settings?.logoUrl || 'https://i.ibb.co.com/G4ygxGcZ/NGO.png';
  const nameBn = settings?.ngoName || 'গ্রাম উন্নয়ন সংস্থা বগুড়া';
  const nameEn = settings?.ngoNameEn || 'Village Development Organization Bogura';
  const footerAbout = settings?.footerAbout?.[lang] || settings?.footerAbout?.en || '';
  const footerCopyright = settings?.footerCopyright?.[lang] || settings?.footerCopyright?.en || 'All rights reserved.';
  const social = settings?.socialLinks || {};
  const registration = settings?.registrationNumber || '';

  const socials = [
    { key: 'facebook', icon: <Facebook className="w-4 h-4" />, label: 'Facebook' },
    { key: 'youtube', icon: <Youtube className="w-4 h-4" />, label: 'YouTube' },
    { key: 'linkedin', icon: <Linkedin className="w-4 h-4" />, label: 'LinkedIn' },
    { key: 'twitter', icon: <Twitter className="w-4 h-4" />, label: 'Twitter' },
  ].filter((s) => social[s.key]);

  return (
    <footer className="bg-[color:var(--site-primary)] text-[color:var(--site-cream)]/80 pt-16 pb-8 border-t-2 border-[color:var(--site-accent)]/40 relative overflow-hidden">
      {/* Background Subtle Overlay Pattern */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(var(--site-accent)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

      <div className="container relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[color:var(--site-accent)]/20">
          {/* NGO Info Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/95 border-2 border-[color:var(--site-accent)] flex items-center justify-center p-1 shadow-md overflow-hidden shrink-0">
                <img
                  src={logoUrl}
                  alt="Village Development Organization Bogura Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-base font-bold font-serif text-[color:var(--site-cream)]">
                  {lang === 'bn' ? nameBn : nameEn}
                </h3>
                <p className="text-[10px] text-[color:var(--site-accent)] font-bold uppercase tracking-[0.2em]">
                  {lang === 'bn' ? nameEn : nameBn}
                </p>
              </div>
            </div>
            {footerAbout && (
              <p className="text-xs text-[color:var(--site-cream)]/70 leading-relaxed font-sans">{footerAbout}</p>
            )}
            {registration && (
              <div className="pt-2 text-xs text-[color:var(--site-accent)] space-y-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-[color:var(--site-accent)]" />
                  {registration}
                </p>
              </div>
            )}
          </div>

          {/* Quick Sitemap Links */}
          <div>
            <h4 className="text-xs font-bold text-[color:var(--site-cream)] uppercase tracking-[0.2em] mb-4 border-b border-[color:var(--site-accent)]/40 pb-2 inline-block font-sans">
              {t('quick_links')}
            </h4>
            <ul className="space-y-2.5 text-xs">
              {[
                { name: t('about'), path: '/about' },
                { name: t('governance'), path: '/governance' },
                { name: t('programs'), path: '/programs' },
                { name: lang === 'bn' ? 'প্রকাশনা' : 'Publications', path: '/publications' },
                { name: t('gallery'), path: '/gallery' },
                { name: t('career'), path: '/career' },
                { name: t('notice'), path: '/notice' },
                { name: t('contact'), path: '/contact' },
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    to={link.path}
                    className="hover:text-[color:var(--site-accent)] transition-colors flex items-center gap-1.5 group text-[color:var(--site-cream)]/80"
                  >
                    <ChevronRight className="w-3 h-3 text-[color:var(--site-accent)] group-hover:translate-x-1 transition-transform" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Regional Branch Offices */}
          <div>
            <h4 className="text-xs font-bold text-[color:var(--site-cream)] uppercase tracking-[0.2em] mb-4 border-b border-[color:var(--site-accent)]/40 pb-2 inline-block font-sans">
              {t('regional_offices')}
            </h4>
            <div className="space-y-3 text-xs">
              <div className="bg-[color:var(--site-primary)] p-3 rounded-lg border border-[color:var(--site-accent)]/30">
                <p className="font-semibold text-[color:var(--site-accent)]">
                  {lang === 'bn' ? 'মূল শাখা (Head Office)' : 'Main Branch (Head Office)'}
                </p>
                <p className="text-[color:var(--site-cream)]/80 text-[11px] mt-0.5">
                  {settings?.address || (lang === 'bn' ? 'ঠিকানা অ্যাডমিন প্যানেল থেকে যোগ করুন' : 'Address coming soon')}
                </p>
                {settings?.phone && (
                  <p className="text-[color:var(--site-accent)]/90 text-[11px]">
                    {lang === 'bn' ? 'ফোন' : 'Phone'}: {settings.phone.split(',')[0].trim()}
                  </p>
                )}
              </div>

              {(settings?.branchAddresses || []).map((branch, idx) => (
                <div key={idx} className="bg-[color:var(--site-primary)] p-3 rounded-lg border border-[color:var(--site-accent)]/30">
                  <p className="font-semibold text-[color:var(--site-accent)]">{branch.name}</p>
                  <p className="text-[color:var(--site-cream)]/80 text-[11px] mt-0.5">{branch.address}</p>
                  {branch.phone && (
                    <p className="text-[color:var(--site-accent)]/90 text-[11px]">
                      {lang === 'bn' ? 'ফোন' : 'Phone'}: {branch.phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Head Office & Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[color:var(--site-cream)] uppercase tracking-[0.2em] mb-4 border-b border-[color:var(--site-accent)]/40 pb-2 inline-block font-sans">
              {t('head_office')}
            </h4>
            <div className="space-y-2.5 text-xs text-[color:var(--site-cream)]/80">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[color:var(--site-accent)] shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? settings?.address : settings?.addressEn || settings?.address}</span>
              </div>
              {settings?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[color:var(--site-accent)] shrink-0" />
                  <a href={`tel:${(settings.phone || '').split(',')[0].trim()}`} className="hover:text-[color:var(--site-accent)]">
                    {settings.phone}
                  </a>
                </div>
              )}
              {settings?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[color:var(--site-accent)] shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-[color:var(--site-accent)]">
                    {settings.email}
                  </a>
                </div>
              )}
              {settings?.officeHours && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[color:var(--site-accent)] shrink-0 mt-0.5" />
                  <span>{lang === 'bn' ? settings.officeHours : settings.officeHoursEn || settings.officeHours}</span>
                </div>
              )}
            </div>

            {/* Social Icons */}
            {socials.length > 0 && (
              <div className="pt-3">
                <div className="flex space-x-2">
                  {socials.map((s) => (
                    <a
                      key={s.key}
                      href={social[s.key]}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.label}
                      className="w-8 h-8 rounded-full border border-[color:var(--site-accent)]/40 bg-[color:var(--site-primary)] text-[color:var(--site-cream)] flex items-center justify-center hover:bg-[color:var(--site-accent)] hover:text-[color:var(--site-primary)] transition-colors"
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-[color:var(--site-cream)]/60 gap-4">
          <p>
            © {new Date().getFullYear()} {lang === 'bn' ? nameBn : nameEn}. {footerCopyright}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/about" className="hover:text-[color:var(--site-accent)]">
              {t('privacy_policy')}
            </Link>
            <Link to="/notice" className="hover:text-[color:var(--site-accent)]">
              {t('terms_conditions')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
