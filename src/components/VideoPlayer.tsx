import React, { useState } from 'react';
import { Play, Pause, Maximize, Volume2, VolumeX, Film, ExternalLink } from 'lucide-react';
import { VideoItem } from '../types';

interface VideoPlayerProps {
  video: VideoItem;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (video.type === 'embed' && video.embedUrl) {
    return (
      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
        <div className="relative aspect-video w-full">
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4 bg-emerald-950 text-white">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-emerald-900/80 px-2.5 py-0.5 rounded-full">
            {video.category || 'ইউটিউব ভিডিও'}
          </span>
          <h4 className="font-serif font-bold text-base mt-1 text-white">{video.title}</h4>
        </div>
      </div>
    );
  }

  // Custom Uploaded MP4 Video Player
  const streamUrl = `/api/videos/stream/${video.id}`;

  return (
    <div className="bg-slate-950 rounded-2xl overflow-hidden border border-emerald-900/60 shadow-2xl flex flex-col group">
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        <video
          id={`video-el-${video.id}`}
          src={streamUrl}
          poster={video.thumbnail}
          controls
          className="w-full h-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          আপনার ব্রাউজার ভিডিও প্লেয়ার সাপোর্ট করে না।
        </video>
      </div>

      <div className="p-4 bg-emerald-950 text-white flex justify-between items-center border-t border-emerald-900">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-emerald-900 px-2.5 py-0.5 rounded-full">
            অফিসিয়াল ভিডিও এইচডি
          </span>
          <h4 className="font-serif font-bold text-base mt-1 text-white">{video.title}</h4>
        </div>

        <span className="text-xs text-amber-300 font-mono bg-emerald-900/80 px-2.5 py-1 rounded">
          {video.duration || 'এইচডি ভিডিও'}
        </span>
      </div>
    </div>
  );
};
