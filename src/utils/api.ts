/**
 * Turn a failed fetch Response into a human-readable message.
 *
 * The API answers with `{ error, message }` JSON. `message` is the
 * user-facing Bengali text (e.g. "Cloudinary is not configured, so the upload
 * was refused"); `error` is a machine code or — on older endpoints — the text
 * itself. Falling back to the caller's generic message keeps the old behaviour
 * when the body is not JSON.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return fallback;
  }
  if (!text) return statusFallback(res.status, fallback);
  try {
    const body = JSON.parse(text) as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (typeof body.error === 'string' && body.error.trim() && !/^[a-z0-9_]+$/i.test(body.error)) {
      return body.error;
    }
  } catch {
    /* not JSON */
  }
  return statusFallback(res.status, fallback);
}

function statusFallback(status: number, fallback: string): string {
  if (status === 401 || status === 403) return 'আপনার সেশন শেষ হয়েছে অথবা এই কাজের অনুমতি নেই। আবার লগইন করুন।';
  if (status === 413) return 'ফাইলটি সার্ভারের নির্ধারিত আকারসীমার চেয়ে বড়। ছোট আকারের ফাইল দিন।';
  if (status === 503) return 'সার্ভারের স্টোরেজ/ডাটাবেস এখন উপলব্ধ নেই। অ্যাডমিন ড্যাশবোর্ডের উপরের সতর্কবার্তা দেখুন।';
  return fallback;
}

/** Error carrying the HTTP status so callers can recognise a dead session. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * JSON request helper used by every admin form.
 *
 * Content forms no longer send multipart bodies — media is uploaded on select
 * (see src/lib/upload.ts) and the record itself is saved as JSON with the
 * returned Cloudinary URL.
 */
export async function jsonRequest<T>(
  url: string,
  options: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; token?: string | null; body?: unknown }
): Promise<T> {
  const { method, token, body } = options;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('ইন্টারনেট সংযোগ বিচ্ছিন্ন — অনুরোধটি পাঠানো যায়নি।');
  }

  if (!res.ok) throw new ApiError(await readApiError(res, 'অনুরোধটি সম্পন্ন করা যায়নি।'), res.status);

  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('সার্ভার থেকে সঠিক উত্তর আসেনি।', res.status);
  }
}
