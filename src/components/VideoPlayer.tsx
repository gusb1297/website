import React from 'react';
import { Film, ExternalLink, Youtube } from 'lucide-react';
import { VideoItem } from '../types';
import { resolveVideoSource } from '../utils/video';

interface VideoPlayerProps {
  video: VideoItem;
}

/**
 * Renders both halves of the two-way video system:
 *  - `embed`  → YouTube / Vimeo iframe (with a "watch on provider" link)
 *  - `upload` → device-uploaded file served from Cloudinary (or streamed from
 *               this server when Cloudinary is not configured)
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video }) => {
  if (video.type === 'embed' && video.embedUrl) {
    return (
      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
        <div className="relative aspect-video w-full">
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="w-full h-full border-0"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-4 bg-emerald-950 text-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-emerald-900/80 px-2.5 py-0.5 rounded-full">
              {video.category || (video.provider === 'vimeo' ? 'ভিমিও ভিডিও' : 'ইউটিউব ভিডিও')}
            </span>
            <h4 className="font-serif font-bold text-base mt-1 text-white">{video.title}</h4>
            {video.description && (
              <p className="text-xs text-emerald-200 mt-1 line-clamp-2">{video.description}</p>
            )}
          </div>

          {video.watchUrl && (
            <a
              href={video.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-emerald-900/80 px-2.5 py-1.5 rounded-lg"
            >
              {video.provider === 'youtube' ? <Youtube className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">দেখুন</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Device-uploaded video: Cloudinary CDN URL when available, else our range-
  // enabled /api/videos/stream/:id endpoint.
  const streamUrl = resolveVideoSource(video);

  return (
    <div className="bg-slate-950 rounded-2xl overflow-hidden border border-emerald-900/60 shadow-2xl flex flex-col group">
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        <video
          id={`video-el-${video.id}`}
          src={streamUrl}
          poster={video.thumbnail}
          controls
          preload="metadata"
          playsInline
          className="w-full h-full object-contain"
        >
          আপনার ব্রাউজার ভিডিও প্লেয়ার সাপোর্ট করে না।
        </video>
      </div>

      <div className="p-4 bg-emerald-950 text-white flex justify-between items-center gap-3 border-t border-emerald-900">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-emerald-900 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <Film className="w-3 h-3" /> {video.category || 'অফিসিয়াল ভিডিও'}
          </span>
          <h4 className="font-serif font-bold text-base mt-1 text-white">{video.title}</h4>
          {video.description && <p className="text-xs text-emerald-200 mt-1 line-clamp-2">{video.description}</p>}
        </div>

        <span className="shrink-0 text-xs text-amber-300 font-mono bg-emerald-900/80 px-2.5 py-1 rounded">
          {video.duration || 'এইচডি ভিডিও'}
        </span>
      </div>
    </div>
  );
};
