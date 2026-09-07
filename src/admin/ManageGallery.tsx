import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { GalleryAlbum, GalleryPhoto } from '../types';
import { SafeImage } from '../components/SafeImage';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Eye,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Images,
  LoaderCircle,
  Save,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_COUNT = 20;

const inputClassName =
  'w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-700/15';

type Notice = { kind: 'success' | 'error'; text: string };
type GalleryAlbumCreateResponse = GalleryAlbum & { photos?: GalleryPhoto[] };

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

function apiErrorMessage(status: number, responseText = '', fallback = 'অনুরোধটি সম্পন্ন করা যায়নি।') {
  if (status === 401 || status === 403) return 'আপনার সেশন শেষ হয়েছে অথবা এই কাজের অনুমতি নেই। আবার লগইন করুন।';
  if (status === 413) return 'একটি ছবি সার্ভারের নির্ধারিত আকারসীমার চেয়ে বড়। ছোট আকারের ছবি দিন।';
  if (status >= 500) return 'সার্ভারে সাময়িক সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';

  try {
    const body = JSON.parse(responseText) as { message?: string; error?: string };
    if (body.message) return body.message;
  } catch {
    // Keep the user-friendly fallback; technical response text goes to console.
  }
  return fallback;
}

function uploadFormData<T>(
  url: string,
  method: 'POST' | 'PUT',
  token: string | null,
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'text';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch (error) {
          console.error('[gallery] Invalid API response:', error);
          reject(new ApiRequestError('সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি।', xhr.status));
        }
        return;
      }
      console.error(`[gallery] ${method} ${url} failed (${xhr.status}):`, xhr.responseText);
      reject(new ApiRequestError(apiErrorMessage(xhr.status, xhr.responseText), xhr.status));
    };
    xhr.onerror = () => {
      console.error(`[gallery] Network error while calling ${method} ${url}`);
      reject(new ApiRequestError('নেটওয়ার্ক সমস্যা হয়েছে। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।'));
    };
    xhr.onabort = () => reject(new ApiRequestError('আপলোডটি বাতিল হয়েছে।'));
    xhr.send(formData);
  });
}

function fileExtension(name: string) {
  return name.toLowerCase().split('.').pop() || '';
}

function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || !ALLOWED_EXTENSIONS[file.type]?.includes(fileExtension(file.name))) {
    return `“${file.name}” সঠিক ইমেজ নয়। শুধু JPG, JPEG, PNG, WEBP বা GIF দিন।`;
  }
  if (file.size > MAX_IMAGE_BYTES) return `“${file.name}” ১০ MB সীমার চেয়ে বড়।`;
  if (file.size === 0) return `“${file.name}” ফাইলটি খালি।`;
  return null;
}

function mergeSelectedImages(current: File[], incoming: File[]) {
  const valid: File[] = [];
  const errors: string[] = [];
  const keys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));

  incoming.forEach((file) => {
    const error = validateImage(file);
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (error) errors.push(error);
    else if (!keys.has(key)) {
      keys.add(key);
      valid.push(file);
    }
  });

  const available = Math.max(0, MAX_IMAGE_COUNT - current.length);
  if (valid.length > available) errors.push(`একবারে সর্বোচ্চ ${MAX_IMAGE_COUNT}টি ছবি নির্বাচন করা যাবে।`);
  return { files: [...current, ...valid.slice(0, available)], error: errors[0] || null };
}

function usePreviewUrls(files: File[]) {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  return previews;
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'তারিখ নেই';
  return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function StatusNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold ${
        notice.kind === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {notice.kind === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{notice.text}</span>
    </div>
  );
}

function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{progress < 100 ? 'ছবি আপলোড হচ্ছে…' : 'সার্ভারে সংরক্ষণ হচ্ছে…'}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-800 transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface ImagePickerProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onValidationError: (message: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

function ImagePicker({ files, setFiles, onValidationError, disabled = false, compact = false }: ImagePickerProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = usePreviewUrls(files);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((current) => {
      const merged = mergeSelectedImages(current, Array.from(list));
      if (merged.error) onValidationError(merged.error);
      return merged.files;
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="min-w-0 space-y-3">
      <div
        className={`rounded-2xl border-2 border-dashed px-4 text-center transition ${
          compact ? 'py-5' : 'py-7'
        } ${
          dragging
            ? 'border-emerald-700 bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-emerald-600 hover:bg-emerald-50/40'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(event) => addFiles(event.target.files)}
          aria-label="ছবি নির্বাচন করুন"
        />
        <UploadCloud className="mx-auto mb-2 h-8 w-8 text-emerald-800" />
        <p className="text-sm font-bold text-slate-800">ছবি এখানে টেনে আনুন</p>
        <p className="mt-1 text-xs text-slate-500">অথবা ডিভাইস থেকে এক বা একাধিক ছবি বেছে নিন</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-xs font-bold text-emerald-900 shadow-sm ring-1 ring-slate-300 transition hover:bg-emerald-50"
        >
          ছবি নির্বাচন করুন
        </button>
        <p className="mt-2 text-[11px] text-slate-400">JPG, PNG, WEBP বা GIF • প্রতি ছবি সর্বোচ্চ ১০ MB • সর্বোচ্চ ২০টি</p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {previews.map(({ file, url }, index) => (
            <div key={`${file.name}-${file.lastModified}`} className="group relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img src={url} alt={file.name} className="aspect-square w-full object-cover" decoding="async" />
              <button
                type="button"
                onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="absolute right-1.5 top-1.5 rounded-full bg-slate-950/80 p-1.5 text-white shadow transition hover:bg-red-600"
                title="নির্বাচিত ছবি সরান"
                aria-label={`${file.name} সরান`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <p className="truncate px-2 py-1.5 text-[10px] font-medium text-slate-600" title={file.name}>
                {file.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AlbumPhotosPanelProps {
  album: GalleryAlbum;
  token: string | null;
  onAlbumPatch: (id: string, patch: Partial<GalleryAlbum>) => void;
}

function AlbumPhotosPanel({ album, token, onAlbumPatch }: AlbumPhotosPanelProps) {
  const {
    data: photos,
    loading,
    error,
    refetch,
    setData: setPhotos,
  } = useFetch<GalleryPhoto[]>(`/api/gallery/albums/${album.id}/photos`);
  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setCaption('');
    setSelectedFiles([]);
    setNotice(null);
    setProgress(0);
  }, [album.id]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (selectedFiles.length === 0) {
      setNotice({ kind: 'error', text: 'আপলোড করার জন্য অন্তত একটি ছবি নির্বাচন করুন।' });
      return;
    }
    if (caption.trim().length > 300) {
      setNotice({ kind: 'error', text: 'ক্যাপশন ৩০০ অক্ষরের মধ্যে রাখুন।' });
      return;
    }

    const formData = new FormData();
    formData.append('caption', caption.trim());
    selectedFiles.forEach((file) => formData.append('images', file));
    setSubmitting(true);
    setProgress(0);

    try {
      const result = await uploadFormData<GalleryPhoto | GalleryPhoto[]>(
        `/api/gallery/albums/${album.id}/photos`,
        'POST',
        token,
        formData,
        setProgress
      );
      const created = Array.isArray(result) ? result : [result];
      setPhotos((current) => [...(current || []), ...created]);
      onAlbumPatch(album.id, {
        photoCount: (album.photoCount || 0) + created.length,
        ...(!album.coverImage && created[0]
          ? {
              coverImage: created[0].image,
              coverPublicId: created[0].publicId,
              coverStorage: created[0].storage,
            }
          : {}),
      });
      setCaption('');
      setSelectedFiles([]);
      setProgress(100);
      setNotice({
        kind: 'success',
        text: created.length === 1 ? 'ছবিটি সফলভাবে আপলোড হয়েছে।' : `${created.length}টি ছবি সফলভাবে আপলোড হয়েছে।`,
      });
    } catch (uploadError) {
      setNotice({
        kind: 'error',
        text: uploadError instanceof Error ? uploadError.message : 'ছবি আপলোড করা যায়নি।',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (photo: GalleryPhoto) => {
    if (!confirm('আপনি কি এই ছবিটি মুছে ফেলতে চান?')) return;
    setDeletingId(photo.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/gallery/photos/${photo.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(`[gallery] DELETE photo failed (${response.status}):`, text);
        throw new ApiRequestError(apiErrorMessage(response.status, text, 'ছবিটি মুছতে সমস্যা হয়েছে।'), response.status);
      }

      const remaining = (photos || []).filter((item) => item.id !== photo.id);
      setPhotos(remaining);
      const patch: Partial<GalleryAlbum> = { photoCount: Math.max(0, (album.photoCount || 1) - 1) };
      if (album.coverImage === photo.image) {
        patch.coverImage = remaining[0]?.image || '';
        patch.coverPublicId = remaining[0]?.publicId;
        patch.coverStorage = remaining[0]?.storage;
      }
      onAlbumPatch(album.id, patch);
      setNotice({ kind: 'success', text: 'ছবিটি মুছে ফেলা হয়েছে।' });
    } catch (deleteError) {
      console.error('[gallery] Could not delete photo:', deleteError);
      setNotice({
        kind: 'error',
        text: deleteError instanceof Error ? deleteError.message : 'ছবিটি মুছতে সমস্যা হয়েছে।',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="selected-album-photos" className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950 text-amber-400">
            <FolderOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">নির্বাচিত অ্যালবাম</p>
            <h3 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{album.title}</h3>
          </div>
        </div>
        <span className="self-start rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900 sm:self-auto">
          {photos?.length ?? album.photoCount ?? 0}টি ছবি
        </span>
      </header>

      <div className="space-y-6 p-4 sm:p-6">
        <form onSubmit={handleUpload} className="space-y-4 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UploadCloud className="h-4 w-4 text-emerald-800" /> নতুন ছবি যোগ করুন
            </h4>
            <p className="mt-1 text-xs text-slate-500">একবারে এক বা একাধিক ছবি আপলোড করতে পারবেন।</p>
          </div>
          <div className="space-y-4 px-4 pb-5 sm:px-5">
            <div>
              <label htmlFor="gallery-caption" className="mb-1.5 block text-xs font-bold text-slate-700">
                ছবির ক্যাপশন <span className="font-normal text-slate-400">(ঐচ্ছিক, নির্বাচিত সব ছবিতে প্রযোজ্য)</span>
              </label>
              <input
                id="gallery-caption"
                type="text"
                maxLength={300}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="যেমন: শীতবস্ত্র বিতরণ কার্যক্রম"
                className={inputClassName}
                disabled={submitting}
              />
            </div>

            <ImagePicker
              files={selectedFiles}
              setFiles={setSelectedFiles}
              disabled={submitting}
              compact
              onValidationError={(text) => setNotice({ kind: 'error', text })}
            />
            {submitting && <UploadProgress progress={progress} />}
            <StatusNotice notice={notice} />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-amber-400 shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {submitting ? 'আপলোড হচ্ছে…' : `ছবি আপলোড করুন${selectedFiles.length ? ` (${selectedFiles.length})` : ''}`}
            </button>
          </div>
        </form>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Images className="h-4 w-4 text-emerald-800" /> অ্যালবামের ছবিসমূহ
            </h4>
            {error && (
              <button type="button" onClick={() => refetch()} className="text-xs font-bold text-emerald-800 hover:underline">
                আবার চেষ্টা করুন
              </button>
            )}
          </div>

          {loading && !photos ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="ছবি লোড হচ্ছে">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="aspect-square animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : error && !photos ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm font-semibold text-red-700">
              ছবির তালিকা লোড করা যায়নি। নেটওয়ার্ক সংযোগ দেখে আবার চেষ্টা করুন।
            </div>
          ) : (photos || []).length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {(photos || []).map((photo) => (
                <article key={photo.id} className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                  <SafeImage
                    src={photo.image}
                    alt={photo.caption || album.title}
                    className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    fallbackClassName="aspect-square"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-3 pt-8">
                    <p className="truncate text-[11px] font-medium text-white">{photo.caption || 'ক্যাপশন নেই'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(photo)}
                    disabled={deletingId === photo.id}
                    className="absolute right-2 top-2 rounded-lg bg-red-600/95 p-2 text-white opacity-100 shadow transition hover:bg-red-700 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    title="ছবি মুছুন"
                    aria-label="ছবি মুছুন"
                  >
                    {deletingId === photo.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
              <ImageIcon className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-600">এই অ্যালবামে এখনও কোনো ছবি নেই</p>
              <p className="mt-1 text-xs text-slate-400">উপরের অংশ থেকে প্রথম ছবি আপলোড করুন।</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export const ManageGallery: React.FC = () => {
  const { token } = useAuth();
  const {
    data: albums,
    loading: albumsLoading,
    error: albumsError,
    refetch: refetchAlbums,
    setData: setAlbums,
  } = useFetch<GalleryAlbum[]>('/api/gallery/albums');
  const [selectedAlbumId, setSelectedAlbumId] = useState('');

  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumFiles, setAlbumFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [createNotice, setCreateNotice] = useState<Notice | null>(null);

  const [editingAlbum, setEditingAlbum] = useState<GalleryAlbum | null>(null);
  const [editAlbumTitle, setEditAlbumTitle] = useState('');
  const [editAlbumDescription, setEditAlbumDescription] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [albumNotice, setAlbumNotice] = useState<Notice | null>(null);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);

  const activeAlbum = useMemo(
    () => (albums || []).find((album) => album.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  useEffect(() => {
    if (!albums) return;
    if (albums.length === 0) {
      if (selectedAlbumId) setSelectedAlbumId('');
      return;
    }
    if (!albums.some((album) => album.id === selectedAlbumId)) setSelectedAlbumId(albums[0].id);
  }, [albums, selectedAlbumId]);

  const patchAlbum = (id: string, patch: Partial<GalleryAlbum>) => {
    setAlbums((current) => (current || []).map((album) => (album.id === id ? { ...album, ...patch } : album)));
  };

  const handleCreateAlbum = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateNotice(null);
    const title = albumTitle.trim();
    const description = albumDescription.trim();
    if (!title) {
      setCreateNotice({ kind: 'error', text: 'অ্যালবামের নাম লিখুন।' });
      return;
    }
    if (title.length > 120 || description.length > 500) {
      setCreateNotice({ kind: 'error', text: title.length > 120 ? 'অ্যালবামের নাম ১২০ অক্ষরের মধ্যে রাখুন।' : 'বর্ণনা ৫০০ অক্ষরের মধ্যে রাখুন।' });
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    albumFiles.forEach((file) => formData.append('photos', file));
    setCreating(true);
    setCreateProgress(0);

    try {
      const created = await uploadFormData<GalleryAlbumCreateResponse>(
        '/api/gallery/albums',
        'POST',
        token,
        formData,
        setCreateProgress
      );
      const { photos: _initialPhotos, ...album } = created;
      setAlbums((current) => [album, ...(current || []).filter((item) => item.id !== album.id)]);
      setSelectedAlbumId(album.id);
      setAlbumTitle('');
      setAlbumDescription('');
      setAlbumFiles([]);
      setCreateProgress(100);
      setCreateNotice({
        kind: 'success',
        text: album.photoCount
          ? `অ্যালবাম ও ${album.photoCount}টি ছবি সফলভাবে তৈরি হয়েছে।`
          : 'খালি অ্যালবামটি সফলভাবে তৈরি হয়েছে।',
      });
    } catch (createError) {
      setCreateNotice({
        kind: 'error',
        text: createError instanceof Error ? createError.message : 'অ্যালবাম তৈরি করা যায়নি।',
      });
    } finally {
      setCreating(false);
    }
  };

  const startEditAlbum = (album: GalleryAlbum) => {
    setEditingAlbum(album);
    setEditAlbumTitle(album.title);
    setEditAlbumDescription(album.description || '');
    setEditCoverFile(null);
    setAlbumNotice(null);
  };

  const handleEditCover = (file: File | undefined) => {
    if (!file) {
      setEditCoverFile(null);
      return;
    }
    const error = validateImage(file);
    if (error) {
      setAlbumNotice({ kind: 'error', text: error });
      setEditCoverFile(null);
      return;
    }
    setAlbumNotice(null);
    setEditCoverFile(file);
  };

  const handleSaveAlbum = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAlbum) return;
    const title = editAlbumTitle.trim();
    const description = editAlbumDescription.trim();
    if (!title) {
      setAlbumNotice({ kind: 'error', text: 'অ্যালবামের নাম খালি রাখা যাবে না।' });
      return;
    }
    if (title.length > 120 || description.length > 500) {
      setAlbumNotice({ kind: 'error', text: title.length > 120 ? 'অ্যালবামের নাম ১২০ অক্ষরের মধ্যে রাখুন।' : 'বর্ণনা ৫০০ অক্ষরের মধ্যে রাখুন।' });
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    if (editCoverFile) formData.append('coverImage', editCoverFile);
    setSavingEdit(true);
    try {
      const updated = await uploadFormData<GalleryAlbum>(
        `/api/gallery/albums/${editingAlbum.id}`,
        'PUT',
        token,
        formData,
        () => undefined
      );
      setAlbums((current) => (current || []).map((album) => (album.id === updated.id ? updated : album)));
      setEditingAlbum(null);
      setEditCoverFile(null);
      setAlbumNotice({ kind: 'success', text: 'অ্যালবামের তথ্য আপডেট হয়েছে।' });
    } catch (editError) {
      setAlbumNotice({
        kind: 'error',
        text: editError instanceof Error ? editError.message : 'অ্যালবাম আপডেট করা যায়নি।',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAlbum = async (album: GalleryAlbum) => {
    if (!confirm(`“${album.title}” অ্যালবাম ও এর সব ছবি স্থায়ীভাবে মুছে যাবে। আপনি কি নিশ্চিত?`)) return;
    setDeletingAlbumId(album.id);
    setAlbumNotice(null);
    try {
      const response = await fetch(`/api/gallery/albums/${album.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(`[gallery] DELETE album failed (${response.status}):`, text);
        throw new ApiRequestError(apiErrorMessage(response.status, text, 'অ্যালবামটি মুছতে সমস্যা হয়েছে।'), response.status);
      }
      setAlbums((current) => (current || []).filter((item) => item.id !== album.id));
      if (editingAlbum?.id === album.id) setEditingAlbum(null);
      setAlbumNotice({ kind: 'success', text: 'অ্যালবাম ও এর ছবিগুলো মুছে ফেলা হয়েছে।' });
    } catch (deleteError) {
      console.error('[gallery] Could not delete album:', deleteError);
      setAlbumNotice({
        kind: 'error',
        text: deleteError instanceof Error ? deleteError.message : 'অ্যালবামটি মুছতে সমস্যা হয়েছে।',
      });
    } finally {
      setDeletingAlbumId(null);
    }
  };

  const openAlbum = (id: string) => {
    setSelectedAlbumId(id);
    window.setTimeout(() => document.getElementById('selected-album-photos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  return (
    <div className="min-w-0 space-y-6">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
        <header className="border-b border-emerald-900 bg-emerald-950 px-4 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-slate-950">
                <FolderPlus className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white sm:text-2xl">ফটো গ্যালারি</h2>
                <p className="mt-0.5 text-xs text-emerald-200">নতুন অ্যালবাম তৈরি করুন এবং একসাথে একাধিক ছবি যোগ করুন</p>
              </div>
            </div>
            <span className="self-start rounded-full border border-emerald-700 bg-emerald-900 px-3 py-1.5 text-xs font-bold text-emerald-100 sm:self-auto">
              মোট {albums?.length || 0}টি অ্যালবাম
            </span>
          </div>
        </header>

        <form onSubmit={handleCreateAlbum} className="space-y-5 p-4 sm:p-6">
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <label htmlFor="album-title" className="mb-1.5 block text-xs font-bold text-slate-700">
                অ্যালবামের নাম <span className="text-red-600">*</span>
              </label>
              <input
                id="album-title"
                type="text"
                required
                maxLength={120}
                value={albumTitle}
                onChange={(event) => setAlbumTitle(event.target.value)}
                placeholder="যেমন: চরাঞ্চলে ত্রাণ বিতরণ ২০২৬"
                className={inputClassName}
                disabled={creating}
              />
            </div>
            <div>
              <label htmlFor="album-description" className="mb-1.5 block text-xs font-bold text-slate-700">
                সংক্ষিপ্ত বর্ণনা <span className="font-normal text-slate-400">(ঐচ্ছিক)</span>
              </label>
              <input
                id="album-description"
                type="text"
                maxLength={500}
                value={albumDescription}
                onChange={(event) => setAlbumDescription(event.target.value)}
                placeholder="অ্যালবাম সম্পর্কে সংক্ষিপ্ত তথ্য"
                className={inputClassName}
                disabled={creating}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-700">সরাসরি ছবি আপলোড <span className="font-normal text-slate-400">(ঐচ্ছিক)</span></p>
                <p className="mt-0.5 text-[11px] text-slate-500">ছবি দিলে প্রথম ছবিটি অ্যালবামের কভার হবে। ছবি ছাড়াও অ্যালবাম তৈরি করা যাবে।</p>
              </div>
              {albumFiles.length > 0 && <span className="text-xs font-bold text-emerald-800">{albumFiles.length}টি নির্বাচিত</span>}
            </div>
            <ImagePicker
              files={albumFiles}
              setFiles={setAlbumFiles}
              disabled={creating}
              onValidationError={(text) => setCreateNotice({ kind: 'error', text })}
            />
          </div>

          {creating && <UploadProgress progress={createProgress} />}
          <StatusNotice notice={createNotice} />
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-slate-400">আপলোড করা ছবি নিরাপদভাবে যাচাই করে Cloudinary অথবা সার্ভার স্টোরেজে সংরক্ষণ হবে।</p>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              {creating ? 'তৈরি হচ্ছে…' : 'অ্যালবাম তৈরি করুন'}
            </button>
          </div>
        </form>
      </section>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl">
              <FolderOpen className="h-5 w-5 text-amber-600" /> অ্যালবামসমূহ
            </h3>
            <p className="mt-1 text-xs text-slate-500">ছবি দেখতে বা নতুন ছবি যোগ করতে একটি অ্যালবাম খুলুন।</p>
          </div>
          {albumsError && (
            <button type="button" onClick={() => refetchAlbums()} className="self-start text-xs font-bold text-emerald-800 hover:underline">
              আবার লোড করুন
            </button>
          )}
        </div>

        <StatusNotice notice={albumNotice} />

        {albumsLoading && !albums ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="অ্যালবাম লোড হচ্ছে">
            {[0, 1].map((item) => (
              <div key={item} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : albumsError && !albums ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
            <p className="mt-3 text-sm font-bold text-red-700">অ্যালবামের তালিকা লোড করা যায়নি</p>
            <p className="mt-1 text-xs text-red-500">নেটওয়ার্ক সংযোগ দেখে আবার চেষ্টা করুন।</p>
          </div>
        ) : (albums || []).length > 0 ? (
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {(albums || []).map((album) => (
              <article
                key={album.id}
                className={`min-w-0 overflow-hidden rounded-2xl border bg-slate-50 transition ${
                  selectedAlbumId === album.id ? 'border-emerald-700 ring-2 ring-emerald-700/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex min-w-0 gap-3 p-3 sm:gap-4 sm:p-4">
                  <SafeImage
                    src={album.coverImage}
                    alt={`${album.title} কভার`}
                    className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
                    fallbackClassName="border border-slate-200"
                    fallbackLabel="কভার নেই"
                  />
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="line-clamp-2 text-base font-bold leading-snug text-slate-900">{album.title}</h4>
                      {selectedAlbumId === album.id && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-700" title="নির্বাচিত" />}
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-slate-500">{album.description || 'কোনো বর্ণনা দেওয়া হয়নি।'}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {album.photoCount || 0}টি ছবি</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDate(album.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {editingAlbum?.id === album.id ? (
                  <form onSubmit={handleSaveAlbum} className="space-y-3 border-t border-emerald-200 bg-white p-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">অ্যালবামের নাম</label>
                      <input
                        value={editAlbumTitle}
                        maxLength={120}
                        onChange={(event) => setEditAlbumTitle(event.target.value)}
                        className={inputClassName}
                        disabled={savingEdit}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">বর্ণনা</label>
                      <input
                        value={editAlbumDescription}
                        maxLength={500}
                        onChange={(event) => setEditAlbumDescription(event.target.value)}
                        className={inputClassName}
                        disabled={savingEdit}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">নতুন কভার ছবি (ঐচ্ছিক)</label>
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT}
                        onChange={(event) => handleEditCover(event.target.files?.[0])}
                        className="block w-full min-w-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-900"
                        disabled={savingEdit}
                      />
                      {editCoverFile && <p className="mt-1 truncate text-[10px] text-emerald-700">নির্বাচিত: {editCoverFile.name}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-950 px-3 py-2.5 text-xs font-bold text-amber-400 disabled:opacity-60"
                      >
                        {savingEdit ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} সেভ করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAlbum(null);
                          setEditCoverFile(null);
                        }}
                        className="rounded-lg bg-slate-200 px-3 py-2.5 text-slate-600 hover:bg-slate-300"
                        aria-label="সম্পাদনা বাতিল করুন"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
                    <button
                      type="button"
                      onClick={() => openAlbum(album.id)}
                      className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-950 px-3 py-2.5 text-xs font-bold text-amber-400 transition hover:bg-emerald-900"
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">অ্যালবাম খুলুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditAlbum(album)}
                      className="rounded-lg bg-emerald-100 p-2.5 text-emerald-900 transition hover:bg-emerald-200"
                      title="অ্যালবাম সম্পাদনা করুন"
                      aria-label="অ্যালবাম সম্পাদনা করুন"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlbum(album)}
                      disabled={deletingAlbumId === album.id}
                      className="rounded-lg bg-red-100 p-2.5 text-red-700 transition hover:bg-red-200 disabled:opacity-60"
                      title="অ্যালবাম মুছুন"
                      aria-label="অ্যালবাম মুছুন"
                    >
                      {deletingAlbumId === album.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-14 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">এখনও কোনো ফটো অ্যালবাম তৈরি হয়নি</p>
            <p className="mt-1 text-xs text-slate-400">উপরের ফর্ম থেকে প্রথম অ্যালবাম তৈরি করুন।</p>
          </div>
        )}
      </section>

      {activeAlbum && <AlbumPhotosPanel album={activeAlbum} token={token} onAlbumPatch={patchAlbum} />}
    </div>
  );
};
