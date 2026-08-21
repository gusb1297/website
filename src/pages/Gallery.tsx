import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { GalleryAlbum, GalleryPhoto, VideoItem } from '../types';
import { GalleryGrid } from '../components/GalleryGrid';
import { VideoPlayer } from '../components/VideoPlayer';
import { Image as ImageIcon, Video as VideoIcon } from 'lucide-react';

export const Gallery: React.FC = () => {
  const { data: albums } = useFetch<GalleryAlbum[]>('/api/gallery/albums');
  // The grid itself filters per album; load all photos once so every tab works.
  const { data: photos } = useFetch<GalleryPhoto[]>('/api/gallery/photos');
  const { data: videos } = useFetch<VideoItem[]>('/api/videos');

  const [mainTab, setMainTab] = useState<'photos' | 'videos'>('photos');

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[#faf8f5]">
      {/* Banner */}
      <div className="bg-emerald-950 text-white py-16 px-4 border-b-4 border-amber-500 text-center space-y-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          ছবি ও প্রামাণ্যচিত্র
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white">
          ফটোগ্যালারি ও ভিডিও লাইব্রেরি
        </h1>
        <p className="text-emerald-200 text-sm max-w-2xl mx-auto">
          উত্তরবঙ্গের চরাঞ্চলে আমাদের বহুমুখী মাঠপর্যায়ের কাজ ও বদলে যাওয়া মানুষের স্থিরচিত্র।
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Main Tab Switcher */}
        <div className="flex justify-center border-b border-slate-200 pb-4">
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-md flex space-x-2">
            <button
              onClick={() => setMainTab('photos')}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${
                mainTab === 'photos'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-600 hover:text-emerald-950'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> ফটো গ্যালারি
            </button>

            <button
              onClick={() => setMainTab('videos')}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${
                mainTab === 'videos'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-600 hover:text-emerald-950'
              }`}
            >
              <VideoIcon className="w-4 h-4" /> ভিডিও গ্যালারি ({videos?.length || 0})
            </button>
          </div>
        </div>

        {/* Tab 1: Photos */}
        {mainTab === 'photos' && (
          <GalleryGrid albums={albums || []} photos={photos || []} />
        )}

        {/* Tab 2: Videos */}
        {mainTab === 'videos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(videos || []).map((vid) => (
              <VideoPlayer key={vid.id} video={vid} />
            ))}
            {(videos || []).length === 0 && (
              <div className="col-span-2 text-center py-16 text-slate-500 font-serif">
                <p>কোনো ভিডিও পাওয়া যায়নি।</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
