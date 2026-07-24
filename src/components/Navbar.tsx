import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Phone,
  Mail,
  ChevronDown,
  Globe,
  MapPin,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [govDropdown, setGovDropdown] = useState(false);
  const [progDropdown, setProgDropdown] = useState(false);
  const location = useLocation();
  const { lang, toggleLang } = useLanguage();
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && mobileMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      {/* Top Emergency & Info Announcement Bar */}
      <div className="bg-[#1B3022] text-[#F8F5F0]/80 text-xs py-2 px-4 border-b border-[#B38B4D]/30 hidden lg:block">
        <div className="container flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <span className="flex items-center gap-1.5 text-[#B38B4D] font-medium tracking-wider uppercase text-[11px]">
              <Phone className="w-3.5 h-3.5" />
              Hotline: 16300
            </span>
            <span className="flex items-center gap-1.5 text-[#F8F5F0]/80 text-[11px]">
              <Mail className="w-3.5 h-3.5 text-[#B38B4D]" />
              info@vdobogura.org
            </span>
            <span className="flex items-center gap-1.5 text-[#F8F5F0]/80 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-[#B38B4D]" />
              Bogura Sadar, Bogura, Bangladesh
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav
        className={`transition-all duration-300 ${
          scrolled
            ? 'bg-[#1B3022] shadow-2xl py-3 border-b border-[#B38B4D]/30'
            : 'bg-[#1B3022] lg:bg-gradient-to-b lg:from-[#1B3022] lg:via-[#1B3022]/90 lg:to-transparent py-3 lg:py-4'
        }`}
      >
        <div className="container flex items-center justify-between gap-3">
          {/* Logo & Brand Name */}
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 group lg:flex-none lg:shrink-0">
            <div className="w-12 h-12 bg-white/95 border-2 border-[#B38B4D] rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden p-1 shrink-0">
              <img
                src="https://i.ibb.co.com/G4ygxGcZ/NGO.png"
                alt="Gram Unnayan Sangstha Bogura Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="max-w-full overflow-hidden text-sm sm:text-base md:text-lg font-bold font-serif text-[#F8F5F0] tracking-wide leading-tight group-hover:text-[#B38B4D] transition-colors break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                গ্রাম উন্নয়ন সংস্থা বগুড়া
              </h1>
              <p className="max-w-full truncate text-[9px] sm:text-[10px] md:text-xs text-[#B38B4D] font-bold tracking-[0.08em] sm:tracking-[0.14em] lg:tracking-[0.2em] uppercase">
                Village Development Organization Bogura (GUSB)
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links - Centered */}
          <div className="hidden lg:flex items-center space-x-1">
            <Link
              to="/"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              Home
            </Link>

            <Link
              to="/about"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/about')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              About
            </Link>

            {/* Governance Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setGovDropdown(true)}
              onMouseLeave={() => setGovDropdown(false)}
            >
              <Link
                to="/governance"
                className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold flex items-center gap-1 whitespace-nowrap transition-all ${
                  isCurrent('/governance')
                    ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                    : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
                }`}
              >
                Governance
                <ChevronDown className="w-3.5 h-3.5 text-[#B38B4D]" />
              </Link>

              {govDropdown && (
                <div className="absolute top-full left-0 w-56 bg-[#1B3022] border border-[#B38B4D]/40 rounded-xl shadow-2xl py-2 backdrop-blur-md z-50">
                  <Link
                    to="/governance#executive"
                    className="block px-4 py-2 text-xs text-[#F8F5F0] hover:bg-[#B38B4D] hover:text-[#1B3022] font-medium transition-colors"
                  >
                    Executive Committee
                  </Link>
                  <Link
                    to="/governance#general"
                    className="block px-4 py-2 text-xs text-[#F8F5F0] hover:bg-[#B38B4D] hover:text-[#1B3022] font-medium transition-colors"
                  >
                    General Council
                  </Link>
                  <Link
                    to="/governance#advisory"
                    className="block px-4 py-2 text-xs text-[#F8F5F0] hover:bg-[#B38B4D] hover:text-[#1B3022] font-medium transition-colors"
                  >
                    Advisory Board
                  </Link>
                </div>
              )}
            </div>

            {/* Programs Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setProgDropdown(true)}
              onMouseLeave={() => setProgDropdown(false)}
            >
              <Link
                to="/programs"
                className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold flex items-center gap-1 whitespace-nowrap transition-all ${
                  isCurrent('/programs')
                    ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                    : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
                }`}
              >
                Programs
                <ChevronDown className="w-3.5 h-3.5 text-[#B38B4D]" />
              </Link>

              {progDropdown && (
                <div className="absolute top-full left-0 w-60 bg-[#1B3022] border border-[#B38B4D]/40 rounded-xl shadow-2xl py-2 backdrop-blur-md z-50">
                  <Link
                    to="/programs"
                    className="block px-4 py-2 text-xs text-[#F8F5F0] hover:bg-[#B38B4D] hover:text-[#1B3022] font-medium transition-colors"
                  >
                    View All Projects
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/publications"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/publications')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              Publications
            </Link>

            <Link
              to="/gallery"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/gallery')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              Gallery
            </Link>

            <Link
              to="/news"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/news')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              News
            </Link>

            <Link
              to="/career"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/career')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              Career
            </Link>

            <Link
              to="/notice"
              className={`px-2.5 py-2 rounded-full text-[11px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap transition-all ${
                isCurrent('/notice')
                  ? 'text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/50 shadow-sm'
                  : 'text-[#F8F5F0]/90 hover:text-[#B38B4D]'
              }`}
            >
              Notices
            </Link>
          </div>

          {/* Desktop Right Side: Contact & Language */}
          <div className="hidden lg:flex items-center space-x-2">
            <Link
              to="/contact"
              className="px-3 py-1.5 border border-[#B38B4D] text-[#B38B4D] hover:bg-[#B38B4D] hover:text-[#1B3022] rounded-full text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap"
            >
              Contact
            </Link>

            <button
              onClick={toggleLang}
              className="px-3 py-1.5 border border-[#B38B4D]/60 text-[#F8F5F0] hover:bg-[#B38B4D] hover:text-[#1B3022] rounded-full text-[10px] uppercase tracking-widest font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
              title="Transform / Switch Language"
              aria-label="Transform / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-[#B38B4D]" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
          </div>

          {/* Mobile Menu Trigger & Language Button */}
          <div className="flex lg:hidden items-center space-x-2 shrink-0">
            <button
              onClick={toggleLang}
              className="px-2.5 py-1 text-[#B38B4D] bg-[#1B3022] border border-[#B38B4D]/40 rounded-full text-[10px] font-bold flex items-center gap-1"
              title="Transform / Switch Language"
            >
              <Globe className="w-3 h-3 text-[#B38B4D]" />
              <span className="hidden sm:inline">{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[#F8F5F0] hover:text-[#B38B4D] focus:outline-none focus:ring-2 focus:ring-[#B38B4D]/60"
              aria-label="Toggle Navigation Menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setIsOpen(false)}></div>
            {/* Slide-in menu */}
            <div ref={mobileMenuRef} className="fixed right-0 top-0 h-full w-[82vw] max-w-xs bg-[#1B3022] border-l border-[#B38B4D]/30 shadow-2xl overflow-y-auto transition-transform duration-300 ease-out">
              <div className="px-5 py-6">
                <div className="flex justify-end mb-6">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg text-[#F8F5F0] hover:text-[#B38B4D] focus:outline-none"
                    aria-label="Close menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="space-y-3">
                  <Link
                    to="/"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    to="/about"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    About Us
                  </Link>
                  <Link
                    to="/governance"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Governance
                  </Link>
                  <Link
                    to="/programs"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Programs
                  </Link>
                  <Link
                    to="/publications"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Publications
                  </Link>
                  <Link
                    to="/gallery"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Gallery
                  </Link>
                  <Link
                    to="/news"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    News & Events
                  </Link>
                  <Link
                    to="/career"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Career
                  </Link>
                  <Link
                    to="/notice"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-bold uppercase tracking-wider text-[#F8F5F0] hover:text-[#B38B4D] transition-colors"
                  >
                    Notice Board
                  </Link>
                  <Link
                    to="/contact"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center mt-4 px-4 py-3 rounded-full font-bold text-sm uppercase tracking-widest bg-[#B38B4D] text-[#1B3022] h-12"
                  >
                    Contact
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
