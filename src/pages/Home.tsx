import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Heart,
  FileText,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Building2,
  Users,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useLanguage } from '../context/LanguageContext';
import { HeroSlider } from '../components/HeroSlider';
import { StatsCounter } from '../components/StatsCounter';
import { ProgramCard } from '../components/ProgramCard';
import { NewsCard } from '../components/NewsCard';
import { VideoPlayer } from '../components/VideoPlayer';
import { MapWidget } from '../components/MapWidget';
import {
  HeroSlide,
  Program,
  NewsItem,
  VideoItem,
  Notice,
  Partner,
  StatItem,
  SiteSettings,
} from '../types';

export const Home: React.FC = () => {
  const { lang, t } = useLanguage();
  const { data: slides } = useFetch<HeroSlide[]>('/api/hero-slides');
  const { data: programs } = useFetch<Program[]>('/api/programs');
  const { data: newsList } = useFetch<NewsItem[]>('/api/news');
  const { data: videos } = useFetch<VideoItem[]>('/api/videos');
  const { data: notices } = useFetch<Notice[]>('/api/notices');
  const { data: partners } = useFetch<Partner[]>('/api/partners');
  const { data: stats } = useFetch<StatItem[]>('/api/stats');
  const { data: settings } = useFetch<SiteSettings>('/api/settings');

  const latestNotice = notices && notices.length > 0 ? notices[0] : null;
  const topPrograms = (programs || []).slice(0, 4);
  const topNews = (newsList || []).slice(0, 3);
  const highlightVideo = videos && videos.length > 0 ? videos[0] : null;

  return (
    <div className="min-h-screen bg-[#F8F5F0]">
      {/* 1. Full Screen Hero Auto-Playing Slider */}
      {slides && <HeroSlider slides={slides} />}

      {/* 2. Urgent Notice Ticker Banner */}
      {latestNotice && (
        <div className="bg-[#B38B4D] text-[#1B3022] py-3 shadow-md">
          <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-[#1B3022] text-[#F8F5F0] text-[10px] font-bold uppercase tracking-widest shrink-0">
                <Bell className="w-3.5 h-3.5 text-[#B38B4D] animate-bounce" />
                {lang === 'en' ? 'SPECIAL NOTICE' : 'বিশেষ নোটিশ'}
              </span>
              <p className="line-clamp-1 font-bold text-[#1B3022]">{latestNotice.title}</p>
            </div>

            <Link
              to="/notice"
              className="inline-flex items-center gap-1 font-bold text-[#1B3022] hover:underline uppercase text-xs tracking-wider shrink-0"
            >
              {lang === 'en' ? 'VIEW NOTICE' : 'নোটিশ দেখুন'} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* 3. About NGO Teaser Section */}
      <section className="py-12 sm:py-[72px] lg:py-[96px]">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-[#B38B4D] text-xs font-bold uppercase tracking-[0.3em] block">
                {lang === 'en' ? '15 Years of Trusted Social Service' : '১৫ বছরের বিশ্বস্ত সামাজিক সেবা'}
              </span>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-serif font-bold text-[#1B3022] leading-tight">
                {lang === 'en'
                  ? 'Village Development Organization Bogura (GUSB) - Standing Beside Rural Communities'
                  : 'গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB) - প্রান্তিক মানুষের পাশে নিরন্তর'}
              </h2>

              <p className="text-sm sm:text-base text-[#1B3022]/70 leading-relaxed font-sans">
                {lang === 'en'
                  ? 'Village Development Organization Bogura (GUSB) is a premier non-governmental organization established in 2010. We are dedicated to empowering disadvantaged communities, especially women and children, across Bogura and North Bengal.'
                  : 'গ্রাম উন্নয়ন সংস্থা বগুড়া (Gram Unnayan Sangstha Bogura - GUSB) ২০১০ সালে প্রতিষ্ঠিত উত্তরবঙ্গের একটি অগ্রগামী নন-গভর্নমেন্টাল অর্গানাইজেশন (NGO)। আমরা বগুড়া ও উত্তরবঙ্গের সুবিধাবঞ্চিত মানুষ, বিশেষ করে নারী ও শিশুদের ক্ষমতায়নে নিবেদিতভাবে কাজ করছি।'}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-5 bg-white border-l-2 border-[#B38B4D] shadow-sm">
                  <h4 className="font-bold text-[#1B3022] text-sm font-serif">
                    {lang === 'en' ? 'Our Vision' : 'আমাদের ভিশন'}
                  </h4>
                  <p className="text-xs text-[#1B3022]/70 mt-1 font-sans">
                    {lang === 'en'
                      ? 'Building a poverty-free, self-reliant, and equitable rural Bangladesh.'
                      : 'দারিদ্র্যমুক্ত, স্বাবলম্বী ও সমতাভিত্তিক গ্রাম বাংলাদেশ গড়ে তোলা।'}
                  </p>
                </div>

                <div className="p-5 bg-white border-l-2 border-[#1B3022] shadow-sm">
                  <h4 className="font-bold text-[#1B3022] text-sm font-serif">
                    {lang === 'en' ? 'Our Mission' : 'আমাদের মিশন'}
                  </h4>
                  <p className="text-xs text-[#1B3022]/70 mt-1 font-sans">
                    {lang === 'en'
                      ? 'Delivering the benefits of microfinance, education, healthcare, and sustainable agricultural technology.'
                      : 'ক্ষুদ্রঋণ, শিক্ষা, স্বাস্থ্য ও কৃষি প্রযুক্তির সুফল পৌঁছে দেওয়া।'}
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  to="/about"
                  className="inline-flex items-center justify-center sm:justify-start gap-2 px-8 py-3.5 bg-[#1B3022] hover:bg-[#B38B4D] text-white font-bold text-xs uppercase tracking-widest transition-all shadow-md w-full sm:w-auto"
                >
                  <span>{lang === 'en' ? 'Learn More About Us' : 'আমাদের সম্পর্কে আরো জানুন'}</span>
                  <ArrowRight className="w-4 h-4 text-[#B38B4D]" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="relative overflow-hidden border border-[#1B3022]/20 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80"
                  alt="GUSB Rural Development"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B3022]/90 via-transparent to-transparent" />

                <div className="absolute bottom-6 left-6 right-6 p-6 bg-[#1B3022]/90 border border-[#B38B4D]/30 text-white">
                  <p className="text-[10px] text-[#B38B4D] font-bold uppercase tracking-[0.2em]">
                    {lang === 'en' ? 'Real Field Impact' : 'মাঠ পর্যায়ের বাস্তব প্রভাব'}
                  </p>
                  <p className="text-sm font-serif font-bold text-[#F8F5F0] mt-1">
                    {lang === 'en'
                      ? 'Direct services across 28 sub-districts in Kurigram, Gaibandha, and Rangpur.'
                      : 'কুড়িগ্রাম, গাইবান্ধা ও রংপুরের ২৮টি উপজেলায় আমাদের প্রত্যক্ষ সেবা বিস্তৃত।'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Animated Stats Section */}
      {stats && <StatsCounter stats={stats} />}

      {/* 5. Core Programs Grid */}
      <section className="py-12 sm:py-[72px] lg:py-[96px]">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-[#B38B4D] text-xs font-bold uppercase tracking-[0.3em] block">
                {lang === 'en' ? 'Our Core Activities' : 'আমাদের মূল কার্যক্রম'}
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#1B3022] mt-1">
                {lang === 'en'
                  ? 'Key Projects for Sustainable Community Development'
                  : 'টেকসই সমাজ বিনির্মাণে প্রধান প্রজেক্টসমূহ'}
              </h2>
            </div>

            <Link
              to="/programs"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B3022] hover:text-[#B38B4D] transition-colors uppercase tracking-widest"
            >
              {lang === 'en' ? 'View All Projects' : 'সব প্রজেক্ট দেখুন'}{' '}
              <ArrowRight className="w-4 h-4 text-[#B38B4D]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </div>
      </section>

      {/* 6. Impact Video Showcase Section (Dark Atmosphere) */}
      <section className="py-12 sm:py-[72px] lg:py-[96px] bg-[#1B3022] text-white relative overflow-hidden">
        <div className="container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-[#B38B4D] text-xs font-bold uppercase tracking-[0.3em] block">
                {lang === 'en' ? 'Video Documentaries' : 'ভিডিও প্রামাণ্যচিত্র'}
              </span>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white leading-tight">
                {lang === 'en'
                  ? 'Real Impact & Stories of Hope from Riverine Char Lands'
                  : 'চরাঞ্চলে পরিবর্তনের গল্প ও বাস্তব চিত্র'}
              </h2>

              <p className="text-sm sm:text-base text-[#F8F5F0]/90 leading-relaxed font-sans">
                {lang === 'en'
                  ? 'Watch official video documentaries showing transformed lives, microfinance entrepreneur successes, and field work across rural communities.'
                  : 'আমাদের অফিশিয়াল ভিডিও গ্যালারিতে চরাঞ্চলের সুবিধা বঞ্চিত মানুষের বদলে যাওয়া জীবন, ক্ষুদ্রঋণ উদ্যোক্তাদের সাফল্যের গল্প এবং মাঠপর্যায়ের কাজ দেখুন।'}
              </p>

              <Link
                to="/gallery#videos"
                className="inline-flex items-center justify-center sm:justify-start gap-2 px-8 py-3.5 bg-[#B38B4D] hover:bg-[#a17a3b] text-white font-bold text-xs uppercase tracking-widest transition-all shadow-xl w-full sm:w-auto"
              >
                <span>{lang === 'en' ? 'Watch All Videos' : 'সব ভিডিও দেখুন'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="lg:col-span-7">
              {highlightVideo && <VideoPlayer video={highlightVideo} />}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Latest News & Events */}
      <section className="py-12 sm:py-[72px] lg:py-[96px]">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-[#B38B4D] text-xs font-bold uppercase tracking-[0.3em] block">
                {lang === 'en' ? 'News & Events' : 'সংবাদ ও ইভেন্ট'}
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#1B3022] mt-1">
                {lang === 'en'
                  ? 'Latest News & Field Updates from GUSB'
                  : 'গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB) এর সাম্প্রতিক খবরাখবর'}
              </h2>
            </div>

            <Link
              to="/news"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B3022] hover:text-[#B38B4D] transition-colors uppercase tracking-widest"
            >
              {lang === 'en' ? 'Read All News' : 'সব খবর দেখুন'}{' '}
              <ArrowRight className="w-4 h-4 text-[#B38B4D]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </div>
      </section>

      {/* 8. Partner Organizations Logos */}
      {partners && partners.length > 0 && (
        <section className="py-12 sm:py-[72px] bg-white border-y border-[#1B3022]/10">
          <div className="container text-center">
            <p className="text-xs font-bold text-[#1B3022]/60 uppercase tracking-[0.3em] mb-8">
              {lang === 'en'
                ? 'Our Partners & Donors'
                : 'আমাদের সহযোগী ও তহবিল অংশীদারবৃন্দ (Partners & Donors)'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              {partners.map((partner) => (
                <a
                  key={partner.id}
                  href={partner.websiteUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="p-4 bg-[#F8F5F0] border border-[#1B3022]/10 hover:border-[#B38B4D] transition-all"
                >
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 9. Interactive Map & Office Network Widget */}
      <section className="py-12 sm:py-[72px]">
        <div className="container">
          {settings && <MapWidget settings={settings} />}
        </div>
      </section>
    </div>
  );
};
