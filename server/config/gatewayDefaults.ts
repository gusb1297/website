/**
 * Vendor defaults for the storage gateways.
 * ---------------------------------------------------------------------------
 * Kept in one tiny leaf module (no imports) so that both the upload services
 * (`services/amStorage.ts`, `services/storage.ts`) and the gateway registry
 * (`services/gatewayRegistry.ts`) can read the same values without any risk of a
 * circular import.
 *
 * These are the credentials issued for this site; the environment always wins
 * when it provides a value.
 */

export const AM_STORAGE_DEFAULT_BASE_URL = 'https://st.thamjj13.top/api/v1';
export const AM_STORAGE_DEFAULT_KEY_ID = 'ng_key_poSEfjsP5RZVE71L';
export const AM_STORAGE_DEFAULT_KEY_SECRET = 'ng_live_xLUXCYNcRKWb1MedNwLaaLaIxYArDutgNVgy47Ml5Js';

/** Root folder inside the Cloudinary media library. */
export const CLOUDINARY_DEFAULT_FOLDER = 'vdo_bogura';

export function envValue(name: string): string {
  return (process.env[name] || '').trim();
}
