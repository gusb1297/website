import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'bn' | 'en';

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  bn: {
    // NGO Identity
    ngo_name: 'গ্রাম উন্নয়ন সংস্থা বগুড়া',
    ngo_short_name: 'GUSB',
    ngo_tagline: 'টেকসই বিকাশ ও স্বাবলম্বী গ্রামীণ সমাজ গঠনের অঙ্গীকার',
    
    // Header & Navigation
    home: 'হোম',
    about: 'আমাদের কথা',
    governance: 'গভর্ন্যান্স',
    programs: 'প্রোগ্রামসমূহ',
    gallery: 'গ্যালারি',
    news: 'সংবাদ ও ইভেন্ট',
    notice: 'নোটিশ বোর্ড',
    career: 'ক্যারিয়ার',
    contact: 'যোগাযোগ',
    admin_login: 'অ্যাডমিন লগইন',
    admin_portal: 'অ্যাডমিন প্যানেল',
    emergency_hotline: 'জরুরী হটলাইন',
    
    // Buttons & Labels
    read_more: 'বিস্তারিত পড়ুন',
    view_all: 'সবগুলো দেখুন',
    download: 'ডাউনলোড করুন',
    apply_now: 'আবেদন করুন',
    submit: 'জমা দিন',
    cancel: 'বাতিল',
    search: 'অনুসন্ধান করুন',
    close: 'বন্ধ করুন',
    
    // Empty states
    no_hero_slides: 'কোনো হিরো স্লাইড পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_programs: 'কোনো প্রজেক্ট বা প্রোগ্রাম পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_news: 'কোনো সংবাদ বা ইভেন্ট পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_videos: 'কোনো ভিডিও পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_notices: 'কোনো নোটিশ পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_publications: 'কোনো প্রকাশনা পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_gallery: 'কোনো ফটো বা অ্যালবাম পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_committee: 'কোনো সদস্য তথ্য পাওয়া যায়নি। অ্যাডমিন প্যানেল থেকে যোগ করুন।',
    no_careers: 'বর্তমানে কোনো নতুন সার্কুলার খালি নেই।',
    
    // Titles & Subtitles
    our_programs_title: 'আমাদের মূল কার্যক্রম',
    our_programs_subtitle: 'টেকসই সমাজ বিনির্মাণে প্রধান প্রজেক্টসমূহ',
    latest_news_title: 'সংবাদ ও ইভেন্ট',
    latest_news_subtitle: 'গ্রাম উন্নয়ন সংস্থা বগুড়ার সাম্প্রতিক খবরাখবর',
    video_showcase_title: 'ভিডিও প্রামাণ্যচিত্র',
    video_showcase_subtitle: 'বগুড়া ও উত্তরবঙ্গে পরিবর্তনের বাস্তব চিত্র',
    about_teaser_title: 'গ্রাম উন্নয়ন সংস্থা বগুড়া - প্রান্তিক মানুষের পাশে নিরন্তর',
    about_teaser_sub: 'বগুড়া ও উত্তরবঙ্গের অবহেলিত চরাঞ্চল ও সুবিধা বঞ্চিত মানুষের সার্বিক আর্থ-সামাজিক উন্নয়ন ও স্বাবলম্বিতা অর্জনে নিবেদিত।',
    
    // Footer
    quick_links: 'গুরুত্বপূর্ণ লিঙ্ক',
    regional_offices: 'শাখা কার্যালয়সমূহ',
    head_office: 'প্রধান কার্যালয়',
    rights_reserved: 'সর্বস্বত্ব সংরক্ষিত।',
    privacy_policy: 'গোপনীয়তা নীতি',
    terms_conditions: 'শর্তাবলী',
  },
  en: {
    // NGO Identity
    ngo_name: 'Village Development Organization Bogura',
    ngo_short_name: 'VDO Bogura',
    ngo_tagline: 'Committed to sustainable development & self-reliant society',
    
    // Header & Navigation
    home: 'Home',
    about: 'About Us',
    governance: 'Governance',
    programs: 'Programs',
    gallery: 'Gallery',
    news: 'News & Events',
    notice: 'Notice Board',
    career: 'Careers',
    contact: 'Contact Us',
    admin_login: 'Admin Login',
    admin_portal: 'Admin Portal',
    emergency_hotline: 'Emergency Hotline',
    
    // Buttons & Labels
    read_more: 'Read More',
    view_all: 'View All',
    download: 'Download',
    apply_now: 'Apply Now',
    submit: 'Submit',
    cancel: 'Cancel',
    search: 'Search',
    close: 'Close',
    
    // Empty states
    no_hero_slides: 'No hero slides found. Please add content from the Admin Panel.',
    no_programs: 'No active programs found. Please add content from the Admin Panel.',
    no_news: 'No news or events found. Please add content from the Admin Panel.',
    no_videos: 'No videos found. Please add content from the Admin Panel.',
    no_notices: 'No notices published yet. Please add content from the Admin Panel.',
    no_publications: 'No publications found. Please add content from the Admin Panel.',
    no_gallery: 'No photo albums found. Please add content from the Admin Panel.',
    no_committee: 'No committee members added yet. Please add from the Admin Panel.',
    no_careers: 'No open career vacancies available at this moment.',
    
    // Titles & Subtitles
    our_programs_title: 'Our Key Programs',
    our_programs_subtitle: 'Core Projects for Sustainable Development',
    latest_news_title: 'News & Events',
    latest_news_subtitle: 'Latest updates from Village Development Organization Bogura',
    video_showcase_title: 'Video Documentaries',
    video_showcase_subtitle: 'Real stories of transformation in Bogura & North Bengal',
    about_teaser_title: 'Village Development Organization Bogura - Empowering Communities',
    about_teaser_sub: 'Dedicated to socio-economic empowerment, education, microfinance, and sustainable growth in Bogura and surrounding regions.',
    
    // Footer
    quick_links: 'Quick Links',
    regional_offices: 'Branch Offices',
    head_office: 'Head Office',
    rights_reserved: 'All rights reserved.',
    privacy_policy: 'Privacy Policy',
    terms_conditions: 'Terms & Conditions',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('vdo_lang');
    return (saved === 'en' || saved === 'bn') ? saved : 'bn';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('vdo_lang', newLang);
  };

  const toggleLang = () => {
    setLang(lang === 'bn' ? 'en' : 'bn');
  };

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations['bn']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
