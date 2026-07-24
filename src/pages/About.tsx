import React from 'react';
import {
  ShieldCheck,
  Target,
  Compass,
  Award,
  Calendar,
  Building,
  CheckCircle,
  FileCheck,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { StatItem, SiteSettings } from '../types';
import { StatsCounter } from '../components/StatsCounter';
import { useLanguage } from '../context/LanguageContext';

export const About: React.FC = () => {
  const { lang, t } = useLanguage();
  const { data: stats } = useFetch<StatItem[]>('/api/stats');
  const { data: settings } = useFetch<SiteSettings>('/api/settings');

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#F8F5F0]">
      {/* Page Banner Header */}
      <div className="bg-[#1B3022] text-white py-16 px-4 border-b-2 border-[#B38B4D]/40 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center space-y-3 relative z-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#B38B4D]">
            {lang === 'en' ? 'Our Identity & Heritage' : 'আমাদের পরিচয় ও ইতিহাস'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#F8F5F0]">
            {lang === 'en'
              ? 'Village Development Organization Bogura (GUSB)'
              : 'গ্রাম উন্নয়ন সংস্থা বগুড়া (Village Development Organization Bogura)'}
          </h1>
          <p className="text-[#F8F5F0]/80 text-sm sm:text-base max-w-2xl mx-auto font-sans">
            {lang === 'en'
              ? 'Working continuously since 2010 to build self-reliance for disadvantaged communities in Bogura and North Bengal.'
              : '২০১০ সাল থেকে বগুড়া ও উত্তরবঙ্গের প্রত্যন্ত অঞ্চলে দরিদ্র ও সুবিধাবঞ্চিত মানুষের স্বাবলম্বিতার লক্ষ্যে কর্মরত।'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
        {/* 1. History & Vision/Mission */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h2 className="text-3xl font-serif font-bold text-[#1B3022] leading-tight">
              {lang === 'en' ? 'Organization History & Genesis' : 'সংস্থার ইতিহাস ও সূচনা'}
            </h2>
            <p className="text-sm text-[#1B3022]/75 leading-relaxed font-sans">
              {lang === 'en'
                ? 'Village Development Organization Bogura (GUSB) was established in 2010 in response to the severe poverty and climate vulnerabilities faced by communities living along riverbank char areas in Kurigram, Gaibandha, Rangpur, and Bogura. Founded by visionary social workers and educators, GUSB operates as a non-political, non-profit development agency.'
                : 'উত্তরবঙ্গের অবহেলিত ও নদীভাঙন কবলিত কুড়িগ্রাম, গাইবান্ধা ও রংপুর অঞ্চলের নদীবেষ্টিত চরে বসবাসরত মানুষের অভাবনীয় কষ্ট ও দারিদ্র্যের চিত্র থেকেই ২০১০ সালে গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) জন্ম। কতিপয় সমাজসেবী, শিক্ষাবিদ ও উন্নয়নকর্মীর সুচিন্তিত উদ্যোগে এই অরাজনৈতিক, অলাভজনক বেসরকারি সেবা সংস্থা আত্মপ্রকাশ করে।'}
            </p>
            <p className="text-sm text-[#1B3022]/75 leading-relaxed font-sans">
              {lang === 'en'
                ? 'Over the past 15 years, GUSB has evolved into one of the most trusted development organizations in North Bengal, empowering over 450,000 individuals through microfinance, healthcare, education, and climate-resilient agriculture.'
                : 'বিগত ১৫ বছরে সংস্থাটি একটি ছোট সামাজিক উদ্যোগ থেকে উত্তরবঙ্গের অন্যতম নির্ভরযোগ্য উন্নয়ন সংস্থায় পরিণত হয়েছে। আজ আমরা প্রায় সাড়ে ৪ লাখ মানুষকে ক্ষুদ্রঋণ, স্বাস্থ্য, শিক্ষা ও জলবায়ু সহনশীল কৃষি প্রযুক্তির মাধ্যমে স্বয়ংসম্পূর্ণ হতে সাহায্য করেছি।'}
            </p>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 gap-6">
            <div className="bg-[#1B3022] text-white p-6 sm:p-8 rounded-2xl border-l-4 border-[#B38B4D] shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-[#B38B4D] font-bold font-serif text-lg">
                <Target className="w-5 h-5 text-[#B38B4D]" />
                {lang === 'en' ? 'Our Vision' : 'ভিশন (Vision)'}
              </div>
              <p className="text-xs sm:text-sm text-[#F8F5F0]/90 leading-relaxed font-sans">
                {lang === 'en'
                  ? 'To build an exploitation-free, self-reliant, and equitable rural society where every woman and child enjoys dignity and fundamental human rights.'
                  : 'একটি শোষনমুক্ত, আত্মনির্ভরশীল ও ন্যায়ভিত্তিক গ্রামীণ সমাজ গঠন, যেখানে প্রত্যেক নারী ও শিশু সম্মানজনক জীবন ও মৌলিক অধিকার ভোগ করবে।'}
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#1B3022]/10 shadow-md space-y-3">
              <div className="flex items-center gap-2 text-[#1B3022] font-bold font-serif text-lg">
                <Compass className="w-5 h-5 text-[#B38B4D]" />
                {lang === 'en' ? 'Our Mission' : 'মিশন (Mission)'}
              </div>
              <p className="text-xs sm:text-sm text-[#1B3022]/75 leading-relaxed font-sans">
                {lang === 'en'
                  ? 'Organizing underprivileged communities, enhancing vocational skills, providing accessible microfinance, and expanding sanitation and educational facilities.'
                  : 'সুবিধাবঞ্চিত জনগোষ্ঠীকে সুসংগঠিত করা, তাদের পেশাগত দক্ষতা বৃদ্ধি, সহজ শর্তে ক্ষুদ্রঋণ প্রদান এবং শিক্ষা ও স্যানিটেশন সুবিধার উন্নয়ন ঘটানো।'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Chairman & Executive Director Message */}
        <div className="bg-white rounded-2xl p-8 lg:p-12 border border-[#1B3022]/10 shadow-lg space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold text-[#B38B4D] uppercase tracking-[0.2em]">
              {lang === 'en' ? 'Leadership Message' : 'নেতৃত্বের বার্তা'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1B3022] mt-1">
              {lang === 'en'
                ? 'Message from Chairman & Executive Director'
                : 'চেয়ারম্যান ও নির্বাহী পরিচালকের বক্তব্য'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#F8F5F0] p-6 sm:p-8 rounded-2xl border border-[#1B3022]/10 flex flex-col justify-between">
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-[#1B3022]/80 italic leading-relaxed font-sans">
                  {lang === 'en'
                    ? '"Our ultimate objective extends beyond short-term assistance — we strive to instill self-reliance, entrepreneurship, and dignity in every household we serve."'
                    : '"আমাদের মূল উদ্দেশ্য কোনো নির্দিষ্ট আর্থিক সুবিধায় সীমাবদ্ধ নয়, বরং প্রতিটি পরিবারের মাঝে স্থায়ী স্বাবলম্বিতার মানসিকতা ও সক্ষমতা তৈরি করা। আমরা সততা ও স্বচ্ছতার সাথে কাজ চালিয়ে যেতে প্রতিশ্রুতিবদ্ধ।"'}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#1B3022]/10 flex items-center gap-4">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                  alt="Chairman"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#B38B4D]"
                />
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#1B3022]">
                    {lang === 'en' ? 'Dr. Md. Abdur Rahman' : 'ড. মো: আব্দুর রহমান'}
                  </h4>
                  <p className="text-[11px] text-[#B38B4D] font-bold uppercase tracking-wider">
                    {lang === 'en' ? 'Chairman, General Council' : 'চেয়ারম্যান, সাধারণ পরিষদ'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#F8F5F0] p-6 sm:p-8 rounded-2xl border border-[#1B3022]/10 flex flex-col justify-between">
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-[#1B3022]/80 italic leading-relaxed font-sans">
                  {lang === 'en'
                    ? '"Over 15 years, our greatest pride lies in thousands of rural female micro-entrepreneurs whose success stories light up the riverine charlands."'
                    : '"১৫ বছরের এই যাত্রায় আমাদের সবচেয়ে বড় অর্জন উত্তরবঙ্গের চরাঞ্চলের হাজার হাজার নারীদের তৈরি করা ক্ষুদ্র ব্যবসায়িক সফলতার উদাহরণসমূহ। তাদের সাফল্যই আমাদের অনুপ্রেরণা।"'}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#1B3022]/10 flex items-center gap-4">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
                  alt="Executive Director"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#B38B4D]"
                />
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#1B3022]">
                    {lang === 'en' ? 'Begum Sultana Parveen' : 'বেগম সুলতানা পারভীন'}
                  </h4>
                  <p className="text-[11px] text-[#B38B4D] font-bold uppercase tracking-wider">
                    {lang === 'en' ? 'Executive Director' : 'নির্বাহী পরিচালক'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Legal Status & Registration Box */}
        <div className="bg-[#1B3022] text-white rounded-2xl p-8 sm:p-10 border border-[#B38B4D]/30 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#B38B4D] uppercase tracking-[0.2em]">
                {lang === 'en' ? 'Legal Status & Accreditation' : 'আইনগত স্বীকৃতি ও অনুমোদন'}
              </span>
              <h3 className="text-2xl font-serif font-bold text-[#F8F5F0]">
                {lang === 'en'
                  ? 'Registered under Government of Bangladesh'
                  : 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার কর্তৃক নিবন্ধিত'}
              </h3>
              <p className="text-xs sm:text-sm text-[#F8F5F0]/80 font-sans">
                {lang === 'en'
                  ? 'All operations comply strictly with government guidelines and Microcredit Regulatory Authority (MRA) standards.'
                  : 'আমাদের সকল কার্যক্রম সরকারি বিধিমালা ও মাইক্রোক্রেডিট রেগুলেটরি অথরিটির (MRA) নিয়মাবলী অনুসরণ করে পরিচালিত।'}
              </p>
            </div>

            <div className="bg-[#1B3022]/80 p-6 rounded-2xl border border-[#B38B4D]/40 text-xs space-y-2.5 shrink-0">
              <p className="flex items-center gap-2 text-[#B38B4D] font-semibold">
                <FileCheck className="w-4 h-4 text-[#B38B4D]" />
                {lang === 'en' ? 'Dept of Social Welfare: Dhaka-094512' : 'সমাজসেবা অধিদপ্তর: ঢাকা-০৯৪৫১২'}
              </p>
              <p className="flex items-center gap-2 text-[#B38B4D] font-semibold">
                <FileCheck className="w-4 h-4 text-[#B38B4D]" />
                {lang === 'en' ? 'NGO Affairs Bureau Reg: 2415' : 'এনজিও বিষয়ক ব্যুরো: ২৪১৫'}
              </p>
              <p className="flex items-center gap-2 text-[#B38B4D] font-semibold">
                <FileCheck className="w-4 h-4 text-[#B38B4D]" />
                {lang === 'en' ? 'MRA License No: 00942' : 'এমআরএ (MRA) সনদ নং: ০০৯৪২'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Animated Stats Overview */}
      {stats && <StatsCounter stats={stats} />}
    </div>
  );
};
