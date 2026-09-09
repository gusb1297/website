import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError, jsonRequest } from '../utils/api';
import { uploadQueueSize } from '../lib/upload';

interface SaveOptions<T> {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Toast title shown after a successful save. */
  success?: string;
  /** Toast title shown when the request failed (defaults to "সংরক্ষণ ব্যর্থ"). */
  failure?: string;
}

/**
 * One place for "save a record, tell the admin what happened".
 *
 * Returns the parsed response (or null when it failed) plus a `saving` flag for
 * the button. A 401/403 clears the session so the shell can redirect to the
 * login page with the server's own message.
 */
export function useSaveAction() {
  const { token, handleAuthError } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const run = useCallback(
    async <T = unknown>({ url, method = 'POST', body, success, failure }: SaveOptions<T>): Promise<T | null> => {
      // Files picked a second ago are still travelling to Cloudinary. Saving now
      // would store the record without them, so refuse — loudly, not silently.
      if (uploadQueueSize() > 0) {
        toast.info({
          title: 'আপলোড এখনও চলছে',
          description: 'ছবি/ফাইল Cloudinary-তে ওঠা শেষ হলেই ফর্মটি সেভ করা যাবে — কয়েক সেকেন্ড অপেক্ষা করুন।',
        });
        return null;
      }
      setSaving(true);
      try {
        const data = await jsonRequest<T>(url, { method, token, body });
        if (success) toast.success({ title: success });
        return data;
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        const message = error instanceof Error ? error.message : 'সার্ভারের উত্তর পাওয়া যায়নি।';
        if (handleAuthError(status, message)) return null;
        toast.error({ title: failure || 'সংরক্ষণ ব্যর্থ', description: message });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [handleAuthError, toast, token]
  );

  return { saving, run, token };
}
