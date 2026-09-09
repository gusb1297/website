/**
 * Client side of the Cloudinary upload system.
 * ---------------------------------------------------------------------------
 * A file is uploaded the moment it is chosen: this module validates it, streams
 * it to `POST /api/uploads/<kind>` with XHR (so real byte progress is
 * available), and resolves with the stored Cloudinary asset. The asset's URL is
 * what the admin form finally writes into the record — no multipart request, no
 * "upload on submit" step that could fail silently.
 */

export type AssetKind = 'image' | 'video' | 'document' | 'logo' | 'cv';

/** What a content record stores about its media. */
export interface AssetValue {
  url: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw';
  bytes?: number;
  format?: string;
  /** Seconds — videos only. */
  duration?: number;
  /** Poster frame for videos. */
  thumbnailUrl?: string;
  originalName?: string;
  /** True while the asset only exists because this form uploaded it. */
  pending?: boolean;
}

export interface StoredAsset extends AssetValue {
  kind: AssetKind;
  storage: 'cloudinary';
}

interface UploadSpec {
  label: string;
  /** Max size in MB — mirrors server/middleware/upload.ts. */
  maxMb: number;
  accept: string;
  extensions: string[];
  mimes: string[];
}

export const UPLOAD_SPECS: Record<AssetKind, UploadSpec> = {
  image: {
    label: 'ছবি',
    maxMb: 10,
    accept: '.jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
  logo: {
    label: 'লোগো',
    maxMb: 5,
    accept: '.png,.jpg,.jpeg,.webp,.svg,.ico,image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon',
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico'],
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
  },
  video: {
    label: 'ভিডিও',
    maxMb: 512,
    accept: '.mp4,.webm,.mov,.mkv,.avi,.mpeg,.mpg,.ogv,.3gp,video/mp4,video/webm,video/quicktime,video/x-matroska',
    extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mpeg', 'mpg', 'ogv', '3gp'],
    mimes: [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-matroska',
      'video/x-msvideo',
      'video/mpeg',
      'video/ogg',
      'video/3gpp',
    ],
  },
  document: {
    label: 'PDF / নথি',
    maxMb: 25,
    accept: '.pdf,.doc,.docx,.txt,application/pdf',
    extensions: ['pdf', 'doc', 'docx', 'txt'],
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
  cv: {
    label: 'সিভি',
    maxMb: 5,
    accept: '.pdf,.doc,.docx,application/pdf',
    extensions: ['pdf', 'doc', 'docx'],
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
};

/**
 * The numbers above are only the fallback: the real ceilings live on the server
 * (MAX_IMAGE_UPLOAD_MB / MAX_VIDEO_UPLOAD_MB / MAX_DOCUMENT_UPLOAD_MB /
 * MAX_APPLICATION_UPLOAD_MB) and can be changed without a rebuild. Fetching them
 * once keeps the picker from rejecting a file the server would happily accept.
 */
let limitsRequested = false;

export async function loadUploadLimits(): Promise<void> {
  if (limitsRequested) return;
  limitsRequested = true;
  try {
    const res = await fetch('/api/uploads/limits', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const data = (await res.json()) as Partial<Record<AssetKind, number>>;
    (Object.keys(UPLOAD_SPECS) as AssetKind[]).forEach((kind) => {
      const mb = Number(data?.[kind]);
      if (Number.isFinite(mb) && mb > 0) UPLOAD_SPECS[kind].maxMb = Math.round(mb);
    });
  } catch {
    /* offline / old build — the built-in defaults stay in place */
  }
}

void loadUploadLimits();

/**
 * How many picked files the browser has not finished sending yet.
 *
 * `inflight` counts live XHRs, `queued` the files a batch picker accepted but
 * has not started (its concurrency is limited). A form must not be saved while
 * this is above zero: the record would be written without those pictures, which
 * is exactly the kind of silent loss the old upload code was guilty of.
 */
let inflight = 0;
let queued = 0;

export function uploadQueueSize(): number {
  return inflight + queued;
}

/** Register (or release) files that are waiting for their turn in a batch. */
export function markQueuedUploads(delta: number): void {
  queued = Math.max(0, queued + delta);
}

export function fileExtension(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
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

/** Returns a Bengali error message, or null when the file is fine to upload. */
export function validateFile(file: File, kind: AssetKind): string | null {
  const spec = UPLOAD_SPECS[kind];
  const ext = fileExtension(file.name);
  const typeOk = spec.mimes.includes(file.type) || spec.extensions.includes(ext);

  if (!file.size) return `“${file.name}” ফাইলটি খালি।` as string;
  if (!typeOk) {
    return `${spec.label} হিসেবে ${spec.extensions
      .map((item) => item.toUpperCase())
      .slice(0, 4)
      .join(', ')} ফাইল দিন। (“${file.name}” নয়)`;
  }
  if (file.size > spec.maxMb * 1024 * 1024) {
    return `${spec.label}ের সর্বোচ্চ আকার ${spec.maxMb} MB — “${file.name}” ${formatBytes(file.size)}।`;
  }
  return null;
}

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

/** Human message for a failed upload/storage request (server sends Bengali `message`). */
export async function readUploadError(res: Response, fallback: string): Promise<string> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return fallback;
  }
  if (text) {
    try {
      const body = JSON.parse(text) as { message?: unknown; error?: unknown };
      if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
      if (typeof body.error === 'string' && body.error.trim() && !/^[a-z0-9_]+$/i.test(body.error)) {
        return body.error.trim();
      }
    } catch {
      /* non-JSON body (proxy error page) → status based text below */
    }
  }
  if (res.status === 401 || res.status === 403) {
    return 'আপনার সেশন শেষ হয়েছে — আবার লগইন করে আপলোড করুন।';
  }
  if (res.status === 413) return `ফাইলটি সার্ভারের সীমার চেয়ে বড় (${res.status})।`;
  if (res.status === 415) return 'ব্রাউজারে পুরোনো সংস্করণ খুলে আছে — একবার পৃষ্ঠাটি হার্ড রিলোড করুন।';
  if (res.status === 429) return 'অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পর আবার চেষ্টা করুন।';
  if (res.status === 503) return 'সার্ভারের স্টোরেজ (Cloudinary) এখন কাজ করছে না — অ্যাডমিন প্যানেলের সতর্কবার্তা দেখুন।';
  if (res.status >= 500) return 'সার্ভারে সমস্যা হয়েছে, ফাইলটি আপলোড হয়নি। একটু পর আবার চেষ্টা করুন।';
  return fallback;
}

export interface UploadTask {
  /** Resolves with the stored asset, rejects with UploadError. */
  promise: Promise<StoredAsset>;
  /** Cancel the request in flight (safe to call after it finished). */
  abort: () => void;
}

/**
 * Upload one file to the given endpoint with progress reporting.
 * `folder` maps to a Cloudinary sub folder (hero, gallery, news, …).
 */
export function uploadFile(options: {
  file: File;
  kind: AssetKind;
  folder?: string;
  token: string | null;
  endpoint?: string;
  onProgress?: (percent: number) => void;
}): UploadTask {
  const { file, kind, folder, token, onProgress } = options;
  const endpoint = options.endpoint || `/api/uploads/${kind}${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`;

  const formData = new FormData();
  formData.append('file', file, file.name);

  const xhr = new XMLHttpRequest();
  let aborted = false;

  const promise = new Promise<StoredAsset>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new UploadError('আপলোড শুরু করা যায়নি।'));
      return;
    }

    xhr.open('POST', endpoint);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'text';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    // Bytes are handed over, but Cloudinary still has to store the asset —
    // keep the bar moving so the UI never looks frozen at 100%.
    xhr.upload.onload = () => onProgress?.(99);

    xhr.onload = () => {
      if (aborted) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const asset = JSON.parse(xhr.responseText) as StoredAsset;
          if (!asset?.url) throw new Error('empty response');
          onProgress?.(100);
          resolve({ ...asset, kind });
          return;
        } catch {
          reject(new UploadError('সার্ভার থেকে সঠিক উত্তর আসেনি। আবার চেষ্টা করুন।', xhr.status));
          return;
        }
      }
      const status = xhr.status;
      const body = xhr.responseText || '';
      let message = '';
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed?.message) message = parsed.message;
      } catch {
        /* keep status based text */
      }
      reject(new UploadError(message || statusText(status, kind), status));
    };

    xhr.onerror = () => {
      if (aborted) return;
      reject(new UploadError('ইন্টারনেট সংযোগ বিচ্ছিন্ন — ফাইলটি আপলোড হয়নি। আবার চেষ্টা করুন।'));
    };
    xhr.ontimeout = () => reject(new UploadError('আপলোড সময় শেষ হয়ে গেছে। আবার চেষ্টা করুন।'));
    xhr.onabort = () => reject(new UploadError('আপলোড বাতিল করা হয়েছে।', 0));

    inflight += 1;
    xhr.onloadend = () => {
      inflight = Math.max(0, inflight - 1);
    };
    xhr.send(formData);
  });

  return {
    promise,
    abort: () => {
      aborted = true;
      try {
        xhr.abort();
      } catch {
        /* already finished */
      }
    },
  };
}

function statusText(status: number, kind: AssetKind): string {
  const label = UPLOAD_SPECS[kind].label;
  if (status === 401 || status === 403) return 'আপনার সেশন শেষ হয়েছে — আবার লগইন করুন।';
  if (status === 413) return `${label} ফাইলটি সার্ভারের সীমার চেয়ে বড়।`;
  if (status === 503) return `সার্ভারের স্টোরেজ (Cloudinary) এখন উপলব্ধ নয় — ${label} আপলোড হয়নি।`;
  return `${label} আপলোড করা যায়নি (HTTP ${status})।`;
}

/**
 * Tell the server an asset that was uploaded but then discarded can be deleted,
 * so the Cloudinary library does not fill up with abandoned files. Failures are
 * ignored: the record itself is already saved.
 */
export async function discardAsset(asset: AssetValue | null | undefined, token: string | null): Promise<void> {
  if (!asset?.publicId || !token) return; // applicants cannot delete from the media library
  try {
    await fetch('/api/uploads/discard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ publicId: asset.publicId, resourceType: asset.resourceType }),
    });
  } catch {
    /* best effort */
  }
}

/** Upload a batch of files with limited parallelism, reporting each result. */
export async function uploadBatch(
  files: File[],
  options: {
    kind: AssetKind;
    folder?: string;
    token: string | null;
    concurrency?: number;
    onItem: (index: number, patch: { progress?: number; asset?: StoredAsset; error?: string }) => void;
  }
): Promise<{ assets: StoredAsset[]; errors: string[] }> {
  const { kind, folder, token, onItem } = options;
  const list = files;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 6));
  const results: (StoredAsset | null)[] = new Array(list.length).fill(null);
  const errors: (string | null)[] = new Array(list.length).fill(null);
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor++;
      const file = list[index];
      try {
        const { promise } = uploadFile({
          file,
          kind,
          folder,
          token,
          onProgress: (progress) => onItem(index, { progress }),
        });
        const asset = await promise;
        results[index] = asset;
        onItem(index, { progress: 100, asset });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'আপলোড ব্যর্থ হয়েছে।';
        errors[index] = message;
        onItem(index, { error: message });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));

  return {
    assets: results.filter((item): item is StoredAsset => Boolean(item)),
    errors: errors.filter((item): item is string => Boolean(item)),
  };
}
