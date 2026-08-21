/**
 * Helpers for the "link" half of the two-way video uploader.
 *
 * Admins paste any YouTube / Vimeo URL they have at hand (watch, share, shorts,
 * live, embed, playlist…) and this module normalises it into a real embeddable
 * URL plus a poster image, so the public site never has to guess.
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'external';

export interface ParsedVideoLink {
  provider: VideoProvider;
  /** Provider video id (YouTube / Vimeo). */
  videoId?: string;
  /** URL safe to drop into an <iframe src>. */
  embedUrl: string;
  /** Human URL to open the video on the provider site. */
  watchUrl: string;
  /** Auto-derived poster image (YouTube only; empty for other providers). */
  thumbnail?: string;
  /** Start offset in seconds parsed from ?t= / #t=. */
  startSeconds?: number;
}

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'];
const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];

function parseStartSeconds(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const plain = Number(raw);
  if (!Number.isNaN(plain) && plain > 0) return Math.floor(plain);
  // Supports 1h2m10s / 2m10s / 45s
  const match = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!match) return undefined;
  const [, h, m, s] = match;
  const total = Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0);
  return total > 0 ? total : undefined;
}

/** Extract a YouTube video id from any of its many URL shapes. */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const keyed = ['embed', 'shorts', 'live', 'v', 'e'];
      if (parts.length >= 2 && keyed.includes(parts[0])) return parts[1];
    }
    return null;
  } catch {
    // Bare id pasted directly (e.g. "dQw4w9WgXcQ")
    const trimmed = url.trim();
    return /^[A-Za-z0-9_-]{11}$/.test(trimmed) ? trimmed : null;
  }
}

function extractVimeoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname.split('/').filter(Boolean);
    const numeric = parts.find((p) => /^\d+$/.test(p));
    return numeric || null;
  } catch {
    return null;
  }
}

/**
 * Normalise a pasted video URL. Returns `null` when the string is not a usable
 * http(s) URL and not a bare YouTube id.
 */
export function parseVideoLink(rawUrl: string): ParsedVideoLink | null {
  const url = (rawUrl || '').trim();
  if (!url) return null;

  let startSeconds: number | undefined;
  let host = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, '');
    startSeconds = parseStartSeconds(parsed.searchParams.get('t') || parsed.searchParams.get('start'));
  } catch {
    host = '';
  }

  const youtubeId = extractYouTubeId(url);
  if (youtubeId && (host === '' || YOUTUBE_HOSTS.includes(host) || host.endsWith('youtube.com'))) {
    const query = startSeconds ? `?start=${startSeconds}&rel=0` : '?rel=0';
    return {
      provider: 'youtube',
      videoId: youtubeId,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}${query}`,
      watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      startSeconds,
    };
  }

  if (VIMEO_HOSTS.includes(host)) {
    const vimeoId = extractVimeoId(url);
    if (vimeoId) {
      return {
        provider: 'vimeo',
        videoId: vimeoId,
        embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
        watchUrl: `https://vimeo.com/${vimeoId}`,
        startSeconds,
      };
    }
  }

  if (/^https?:\/\//i.test(url)) {
    return { provider: 'external', embedUrl: url, watchUrl: url, startSeconds };
  }

  return null;
}

/** Format a duration in seconds as mm:ss (or hh:mm:ss when over an hour). */
export function formatDuration(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
