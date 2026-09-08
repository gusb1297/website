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
