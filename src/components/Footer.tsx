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

export const Footer: React.FC = () => {
  const { lang, t } = useLanguage();

  return (
    <footer className="bg-[#1B3022] text-[#F8F5F0]/80 pt-16 pb-8 border-t-2 border-[#B38B4D]/40 relative overflow-hidden">
      {/* Background Subtle Overlay Pattern */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#B38B4D_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

      <div className="container relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[#B38B4D]/20">
          {/* NGO Info Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/95 border-2 border-[#B38B4D] flex items-center justify-center p-1 shadow-md overflow-hidden shrink-0">
                <img
                  src="https://i.ibb.co.com/G4ygxGcZ/NGO.png"
                  alt="Village Development Organization Bogura Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-base font-bold font-serif text-[#F8F5F0]">
                  {lang === 'bn' ? 'গ্রাম উন্নয়ন সংস্থা বগুড়া' : 'Village Development Organization Bogura'}
                </h3>
                <p className="text-[10px] text-[#B38B4D] font-bold uppercase tracking-[0.2em]">
                  {lang === 'bn' ? 'Gram Unnayan Sangstha Bogura' : 'Village Development Organization Bogura'}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#F8F5F0]/70 leading-relaxed font-sans">
              {lang === 'bn'
                ? 'বগুড়া ও উত্তরবঙ্গের সুবিধাবঞ্চিত গ্রামীণ মানুষের আর্থ-সামাজিক উন্নয়ন, ক্ষুদ্রঋণ সহায়তায় আত্মকর্মসংস্থান এবং জীবনমান বৃদ্ধিতে নিবেদিত।'
                : 'Dedicated to socio-economic development, microfinance support, self-reliance, and uplifting lives across Bogura and North Bengal.'}
            </p>
            <div className="pt-2 text-xs text-[#B38B4D] space-y-1">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-[#B38B4D]" />
                {lang === 'bn' ? 'সমাজসেবা অধিদপ্তর নিবন্ধিত' : 'Registered under Social Welfare Dept.'}
              </p>
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-[#B38B4D]" />
                {lang === 'bn' ? 'এনজিও বিষয়ক ব্যুরো নিবন্ধিত' : 'Registered with NGO Affairs Bureau'}
              </p>
            </div>
          </div>

          {/* Quick Sitemap Links */}
          <div>
            <h4 className="text-xs font-bold text-[#F8F5F0] uppercase tracking-[0.2em] mb-4 border-b border-[#B38B4D]/40 pb-2 inline-block font-sans">
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
                    className="hover:text-[#B38B4D] transition-colors flex items-center gap-1.5 group text-[#F8F5F0]/80"
                  >
                    <ChevronRight className="w-3 h-3 text-[#B38B4D] group-hover:translate-x-1 transition-transform" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Regional Branch Offices */}
          <div>
            <h4 className="text-xs font-bold text-[#F8F5F0] uppercase tracking-[0.2em] mb-4 border-b border-[#B38B4D]/40 pb-2 inline-block font-sans">
              {t('regional_offices')}
            </h4>
            <div className="space-y-3 text-xs">
              <div className="bg-[#1B3022] p-3 rounded-lg border border-[#B38B4D]/30">
                <p className="font-semibold text-[#B38B4D]">
                  {lang === 'bn' ? 'বগুড়া প্রধান শাখা' : 'Bogura Main Branch'}
                </p>
                <p className="text-[#F8F5F0]/80 text-[11px] mt-0.5">
                  {lang === 'bn' ? 'নওয়াববাড়ী রোড, বগুড়া সদর, বগুড়া' : 'Nawabbari Road, Bogura Sadar, Bogura'}
                </p>
                <p className="text-[#B38B4D]/90 text-[11px]">ফোন: +880 1711 000000</p>
              </div>

              <div className="bg-[#1B3022] p-3 rounded-lg border border-[#B38B4D]/30">
                <p className="font-semibold text-[#B38B4D]">
                  {lang === 'bn' ? 'শেরপুর উপশাখা' : 'Sherpur Sub-branch'}
                </p>
                <p className="text-[#F8F5F0]/80 text-[11px] mt-0.5">
                  {lang === 'bn' ? 'বাসস্ট্যান্ড রোড, শেরপুর, বগুড়া' : 'Bus Stand Road, Sherpur, Bogura'}
                </p>
              </div>
            </div>
          </div>

          {/* Head Office & Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#F8F5F0] uppercase tracking-[0.2em] mb-4 border-b border-[#B38B4D]/40 pb-2 inline-block font-sans">
              {t('head_office')}
            </h4>
            <div className="space-y-2.5 text-xs text-[#F8F5F0]/80">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#B38B4D] shrink-0 mt-0.5" />
                <span>
                  {lang === 'bn'
                    ? 'গ্রাম উন্নয়ন সংস্থা বগুড়া, বগুড়া সদর, বগুড়া-৫৮০০, বাংলাদেশ'
                    : 'Village Development Organization Bogura, Bogura Sadar, Bogura-5800, Bangladesh'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#B38B4D] shrink-0" />
                <a href="tel:+8801711000000" className="hover:text-[#B38B4D]">
                  +880 1711 000000
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#B38B4D] shrink-0" />
                <a href="mailto:info@vdobogura.org" className="hover:text-[#B38B4D]">
                  info@vdobogura.org
                </a>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#B38B4D] shrink-0 mt-0.5" />
                <span>
                  {lang === 'bn'
                    ? 'রবি - বৃহঃ: সকাল ৯:০০ - বিকাল ৫:০০ (শুক্র ও শনি বন্ধ)'
                    : 'Sun - Thu: 9:00 AM - 5:00 PM (Fri & Sat closed)'}
                </span>
              </div>
            </div>

            {/* Social Icons */}
            <div className="pt-3">
              <div className="flex space-x-2">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#B38B4D]/40 bg-[#1B3022] text-[#F8F5F0] flex items-center justify-center hover:bg-[#B38B4D] hover:text-[#1B3022] transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#B38B4D]/40 bg-[#1B3022] text-[#F8F5F0] flex items-center justify-center hover:bg-[#B38B4D] hover:text-[#1B3022] transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#B38B4D]/40 bg-[#1B3022] text-[#F8F5F0] flex items-center justify-center hover:bg-[#B38B4D] hover:text-[#1B3022] transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#B38B4D]/40 bg-[#1B3022] text-[#F8F5F0] flex items-center justify-center hover:bg-[#B38B4D] hover:text-[#1B3022] transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-[#F8F5F0]/60 gap-4">
          <p>
            © {new Date().getFullYear()} {lang === 'bn' ? 'গ্রাম উন্নয়ন সংস্থা বগুড়া' : 'Village Development Organization Bogura'}. {t('rights_reserved')}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/about" className="hover:text-[#B38B4D]">
              {t('privacy_policy')}
            </Link>
            <Link to="/notice" className="hover:text-[#B38B4D]">
              {t('terms_conditions')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
