import { VideoItem } from '../types';

/** Extract a YouTube video id from any URL shape (watch / share / shorts / embed / live). */
export function extractYouTubeId(url: string): string | null {
  const value = (url || '').trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v', 'e'].includes(parts[0])) return parts[1];
    }
    return null;
  } catch {
    return /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
  }
}

/** Extract a Vimeo id from a vimeo.com / player.vimeo.com URL. */
export function extractVimeoId(url: string): string | null {
  try {
    const parsed = new URL((url || '').trim());
    if (!parsed.hostname.replace(/^www\./, '').endsWith('vimeo.com')) return null;
    return parsed.pathname.split('/').filter((p) => /^\d+$/.test(p))[0] || null;
  } catch {
    return null;
  }
}

export interface LinkPreview {
  provider: 'youtube' | 'vimeo' | 'external';
  embedUrl: string;
  thumbnail?: string;
  label: string;
}

/** Client-side preview of a pasted link (the server re-validates on submit). */
export function previewVideoLink(url: string): LinkPreview | null {
  const value = (url || '').trim();
  if (!value) return null;

  const ytId = extractYouTubeId(value);
  if (ytId) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      label: 'YouTube',
    };
  }

  const vimeoId = extractVimeoId(value);
  if (vimeoId) {
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoId}`, label: 'Vimeo' };
  }

  if (/^https?:\/\//i.test(value)) {
    return { provider: 'external', embedUrl: value, label: 'External' };
  }
  return null;
}

/** Playable source for an uploaded video: the CDN URL when we have one, else our stream route. */
export function resolveVideoSource(video: VideoItem): string {
  if (video.filePath && /^https?:\/\//i.test(video.filePath)) return video.filePath;
  return `/api/videos/stream/${video.id}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Short human label for where a video comes from. */
export function videoSourceLabel(video: VideoItem): string {
  if (video.type === 'embed') {
    if (video.provider === 'youtube') return 'ইউটিউব লিঙ্ক';
    if (video.provider === 'vimeo') return 'ভিমিও লিঙ্ক';
    return 'এমবেড লিঙ্ক';
  }
  return video.storage === 'cloudinary' ? 'ক্লাউডিনারি আপলোড' : 'সার্ভার আপলোড';
}
