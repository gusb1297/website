import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { formatDuration } from '../utils/videoSources';

/**
 * Read the real duration (in seconds) of a video file with ffprobe.
 * Resolves to `undefined` when ffprobe/ffmpeg is unavailable.
 */
export async function probeVideoDuration(videoPath: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value?: number) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return done(undefined);
        const seconds = metadata?.format?.duration;
        done(typeof seconds === 'number' && seconds > 0 ? seconds : undefined);
      });
    } catch {
      done(undefined);
    }

    const timer = setTimeout(() => done(undefined), 8000);
    (timer as { unref?: () => void }).unref?.();
  });
}

/**
 * Generate a thumbnail + duration for an uploaded video. When ffmpeg is not
 * available on the host a placeholder thumbnail is written instead so the
 * video still appears in the gallery.
 */
export async function processVideoFile(
  videoPath: string
): Promise<{ thumbnailPath: string; duration: string; durationSeconds?: number }> {
  const durationSeconds = await probeVideoDuration(videoPath);
  const durationLabel = formatDuration(durationSeconds) || '03:00';
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
  const thumbnailFilename = `thumb-${videoName}.jpg`;
  const thumbnailFile = path.join(thumbnailsDir, thumbnailFilename);

  return new Promise((resolve) => {
    let settled = false;
    const done = (result: { thumbnailPath: string; duration: string; durationSeconds?: number }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .on('end', () => {
        done({ thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`, duration: durationLabel, durationSeconds });
      })
      .on('error', (err) => {
        console.warn('FFmpeg thumbnail generation notice (using fallback thumbnail):', err.message);
        createFallbackThumbnail(thumbnailFile);
        done({ thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`, duration: durationLabel, durationSeconds });
      })
      .screenshots({
        count: 1,
        folder: thumbnailsDir,
        filename: thumbnailFilename,
        size: '640x360',
      });

    // Safety net: if ffmpeg never fires an event (binary missing can hang the
    // callback queue on some platforms), resolve with the fallback after 8s.
    const safetyTimer = setTimeout(() => {
      if (!fs.existsSync(thumbnailFile)) {
        createFallbackThumbnail(thumbnailFile);
      }
      done({ thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`, duration: durationLabel, durationSeconds });
    }, 8000);
    (safetyTimer as { unref?: () => void }).unref?.();
  });
}

function createFallbackThumbnail(targetPath: string) {
  try {
    if (fs.existsSync(targetPath)) return;
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#134e3a"/>
      <circle cx="320" cy="180" r="50" fill="#d97706" opacity="0.9"/>
      <polygon points="310,160 340,180 310,200" fill="#ffffff"/>
      <text x="320" y="270" font-family="sans-serif" font-size="20" fill="#ffffff" text-anchor="middle">NGO Video Highlight</text>
    </svg>`;
    // The URL served to browsers ends in .jpg; write the placeholder as a real
    // file at that exact path so requests for it never 404.
    fs.writeFileSync(targetPath, svgContent, 'utf-8');
  } catch (e) {
    console.error('Failed to write fallback thumbnail', e);
  }
}
