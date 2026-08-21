import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ManageHeroSlider } from './ManageHeroSlider';
import { ManagePrograms } from './ManagePrograms';
import { ManageNews } from './ManageNews';
import { ManageVideos } from './ManageVideos';
import { ManageGallery } from './ManageGallery';
import { ManagePublications } from './ManagePublications';
import { ManageCareer } from './ManageCareer';
import { ManageNotices } from './ManageNotices';
import { ManagePartners } from './ManagePartners';
import { ManageStats } from './ManageStats';
import { ManageCommittee } from './ManageCommittee';
import { ManagePages } from './ManagePages';
import { ManageSettings } from './ManageSettings';
import { ManageAdmins } from './ManageAdmins';
import {
  Sliders,
  Sprout,
  Newspaper,
  Video,
  Image as ImageIcon,
  BookOpen,
  Briefcase,
  FileText,
  Settings,
  LogOut,
  ShieldCheck,
  Users,
  BarChart3,
  Handshake,
  LayoutTemplate,
  UserCog,
} from 'lucide-react';

type TabId =
  | 'slides'
  | 'programs'
  | 'news'
  | 'videos'
  | 'gallery'
  | 'publications'
  | 'career'
  | 'notices'
  | 'partners'
  | 'stats'
  | 'committee'
  | 'content'
  | 'settings'
  | 'admins';

export const Dashboard: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('slides');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="pt-32 pb-20 min-h-screen text-center space-y-4 font-serif">
        <p className="text-red-600 font-bold">অনুগ্রহ করে প্রথমে অ্যাডমিন হিসেবে লগইন করুন।</p>
        <button
          onClick={() => navigate('/admin/login')}
          className="px-6 py-2 bg-emerald-950 text-white rounded-xl font-bold text-xs"
        >
          লগইন পেজে যান
        </button>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'slides', label: 'হিরো স্লাইডার (হোম)', icon: <Sliders className="w-4 h-4" /> },
    { id: 'content', label: 'হোম ও About কন্টেন্ট', icon: <LayoutTemplate className="w-4 h-4" /> },
    { id: 'programs', label: 'প্রজেক্টসমূহ', icon: <Sprout className="w-4 h-4" /> },
    { id: 'news', label: 'সংবাদ ও ইভেন্ট', icon: <Newspaper className="w-4 h-4" /> },
    { id: 'videos', label: 'ভিডিও গ্যালারি', icon: <Video className="w-4 h-4" /> },
    { id: 'gallery', label: 'ফটো গ্যালারি', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'publications', label: 'পাবলিকেশন', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'notices', label: 'নোটিশ বোর্ড', icon: <FileText className="w-4 h-4" /> },
    { id: 'career', label: 'ক্যারিয়ার ও আবেদন', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'committee', label: 'পরিচালনা পরিষদ', icon: <Users className="w-4 h-4" /> },
    { id: 'partners', label: 'পার্টনার ও ডোনার', icon: <Handshake className="w-4 h-4" /> },
    { id: 'stats', label: 'পরিসংখ্যান কাউন্টার', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'ওয়েবসাইট সেটিংস & রঙ', icon: <Settings className="w-4 h-4" /> },
  ];

  // Only full administrators can manage other admin accounts.
  if (user?.role === 'admin') {
    navItems.push({ id: 'admins', label: 'অ্যাডমিন ব্যবস্থাপনা', icon: <UserCog className="w-4 h-4" /> });
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Top Header Bar */}
      <div className="bg-emerald-950 text-white py-6 px-4 border-b-4 border-amber-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="text-2xl font-serif font-bold text-white">অ্যাডমিন ড্যাশবোর্ড</h1>
              <p className="text-xs text-emerald-200">
                লগইন অ্যাকাউন্ট: <strong>{user?.name}</strong> ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-emerald-100 text-xs font-bold border border-emerald-700 transition-all"
            >
              <LayoutTemplate className="w-4 h-4" /> সাইট দেখুন
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-900/80 hover:bg-red-800 text-white text-xs font-bold border border-red-700 transition-all"
            >
              <LogOut className="w-4 h-4" /> লগআউট করুন
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar Navigation */}
          <div className="lg:col-span-3 space-y-2">
            <div className="lg:hidden mb-2">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-950 text-amber-400 font-bold text-xs shadow-md"
              >
                <span>মেনু</span>
                <span className="text-sm">{mobileNavOpen ? '▲' : '▼'}</span>
              </button>
            </div>
            <div className={`${mobileNavOpen ? 'block' : 'hidden'} lg:block bg-white p-3 rounded-2xl border border-slate-200 shadow-md space-y-1`}>
              <p className="px-4 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                কন্টেন্ট ম্যানেজমেন্ট
              </p>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                    activeTab === item.id
                      ? 'bg-emerald-950 text-amber-400 shadow-md'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Module Content Area */}
          <div className="lg:col-span-9">
            {activeTab === 'slides' && <ManageHeroSlider />}
            {activeTab === 'content' && <ManagePages />}
            {activeTab === 'programs' && <ManagePrograms />}
            {activeTab === 'news' && <ManageNews />}
            {activeTab === 'videos' && <ManageVideos />}
            {activeTab === 'gallery' && <ManageGallery />}
            {activeTab === 'publications' && <ManagePublications />}
            {activeTab === 'notices' && <ManageNotices />}
            {activeTab === 'career' && <ManageCareer />}
            {activeTab === 'committee' && <ManageCommittee />}
            {activeTab === 'partners' && <ManagePartners />}
            {activeTab === 'stats' && <ManageStats />}
            {activeTab === 'settings' && <ManageSettings />}
            {activeTab === 'admins' && user?.role === 'admin' && <ManageAdmins />}
          </div>
        </div>
      </div>
    </div>
  );
};
