import React, { useEffect, useMemo, useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useSaveAction } from '../hooks/useSaveAction';
import { useToast } from '../context/ToastContext';
import { AssetField } from '../components/admin/AssetField';
import { AssetBatchField } from '../components/admin/AssetBatchField';
import { SafeImage } from '../components/SafeImage';
import { GalleryAlbum, GalleryPhoto } from '../types';
import type { AssetValue } from '../lib/upload';
import {
  AlertCircle,
  CalendarDays,
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

/** One album may hold this many pictures at a time (Cloudinary itself is unlimited). */
const MAX_ALBUM_PHOTOS = 20;

const inputClassName =
  'w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-700/15';

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'তারিখ নেই';
  return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

/* -------------------------------------------------------------------------- */
/* Photos of the open album                                                    */
/* -------------------------------------------------------------------------- */

interface AlbumPhotosPanelProps {
  album: GalleryAlbum;
  onAlbumPatch: (id: string, patch: Partial<GalleryAlbum>) => void;
}

function AlbumPhotosPanel({ album, onAlbumPatch }: AlbumPhotosPanelProps) {
  const toast = useToast();
  const { saving, run } = useSaveAction();
  const {
    data: photos,
    loading,
    error,
    refetch,
  } = useFetch<GalleryPhoto[]>(`/api/gallery/albums/${album.id}/photos`);

  const [caption, setCaption] = useState('');
  const [staged, setStaged] = useState<AssetValue[]>([]);
  const [batchKey, setBatchKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setCaption('');
    setStaged([]);
    setBatchKey((key) => key + 1);
  }, [album.id]);

  const readyCount = staged.filter((asset) => asset.url).length;

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (caption.trim().length > 300) {
      toast.error({ title: 'ক্যাপশন ৩০০ অক্ষরের মধ্যে রাখুন' });
      return;
    }
    if (!readyCount) {
      toast.error({
        title: 'কোনো ছবি যোগ হয়নি',
        description: 'ছবি বেছে নিন — বাছার সাথে সাথেই Cloudinary-তে আপলোড শুরু হয়।',
      });
      return;
    }

    const created = await run<GalleryPhoto | GalleryPhoto[]>({
      url: `/api/gallery/albums/${album.id}/photos`,
      body: { caption: caption.trim(), photos: staged },
      success:
        readyCount === 1 ? 'ছবিটি অ্যালবামে যোগ হয়েছে' : `${readyCount}টি ছবি অ্যালবামে যোগ হয়েছে`,
      failure: 'ছবি যোগ করা যায়নি',
    });
    if (!created) return;

    setCaption('');
    setStaged([]);
    setBatchKey((key) => key + 1);
    refetch();
    onAlbumPatch(album.id, {
      photoCount: (album.photoCount || 0) + (Array.isArray(created) ? created.length : 1),
      ...(!album.coverImage
        ? { coverImage: staged[0].url, coverPublicId: staged[0].publicId, coverStorage: 'cloudinary' as const }
        : {}),
    });
  };

  const handleDelete = async (photo: GalleryPhoto) => {
    if (!confirm('আপনি কি এই ছবিটি মুছে ফেলতে চান?')) return;
    setDeletingId(photo.id);
    const done = await run({
      url: `/api/gallery/photos/${photo.id}`,
      method: 'DELETE',
      success: 'ছবিটি মুছে ফেলা হয়েছে',
      failure: 'ছবিটি মুছে ফেলা যায়নি',
    });
    setDeletingId(null);
    if (done !== null) {
      refetch();
      onAlbumPatch(album.id, { photoCount: Math.max(0, (album.photoCount || 1) - 1) });
    }
  };

  return (
    <section
      id="selected-album-photos"
      className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg"
    >
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
        <form onSubmit={handleAdd} className="space-y-4 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UploadCloud className="h-4 w-4 text-emerald-800" /> নতুন ছবি যোগ করুন
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              ছবি বেছে নেওয়ার সাথে সাথেই Cloudinary-তে আপলোড হবে; তারপর "ছবি যোগ করুন" চাপলে অ্যালবামে বসে যাবে।
            </p>
          </div>

          <div className="space-y-4 px-4 pb-5 sm:px-5">
            <div>
              <label htmlFor="gallery-caption" className="mb-1.5 block text-xs font-bold text-slate-700">
                ছবির ক্যাপশন <span className="font-normal text-slate-400">(ঐচ্ছিক, সব ছবিতে প্রযোজ্য)</span>
              </label>
              <input
                id="gallery-caption"
                type="text"
                maxLength={300}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="যেমন: শীতবস্ত্র বিতরণ কার্যক্রম"
                className={inputClassName}
                disabled={saving}
              />
            </div>

            <AssetBatchField
              folder="gallery"
              max={MAX_ALBUM_PHOTOS}
              resetKey={batchKey}
              onChange={setStaged}
              disabled={saving}
            />

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-950 px-5 py-3 text-sm font-bold text-amber-400 shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {saving ? 'যোগ হচ্ছে…' : `ছবি যোগ করুন${readyCount ? ` (${readyCount})` : ''}`}
            </button>
          </div>
        </form>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Images className="h-4 w-4 text-emerald-800" /> অ্যালবামের ছবিসমূহ
            </h4>
            {error && (
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs font-bold text-emerald-800 hover:underline"
              >
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
                <article
                  key={photo.id}
                  className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
                >
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
                    className="absolute right-2 top-2 rounded-lg bg-red-600/95 p-2 text-white shadow transition hover:bg-red-700 disabled:opacity-60"
                    title="ছবি মুছুন"
                    aria-label="ছবি মুছুন"
                  >
                    {deletingId === photo.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
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

/* -------------------------------------------------------------------------- */
/* Albums                                                                      */
/* -------------------------------------------------------------------------- */

export const ManageGallery: React.FC = () => {
  const toast = useToast();
  const { saving: creating, run } = useSaveAction();
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
  const [albumPhotos, setAlbumPhotos] = useState<AssetValue[]>([]);
  const [albumCover, setAlbumCover] = useState<AssetValue | null>(null);
  const [batchKey, setBatchKey] = useState(0);

  const [editingAlbum, setEditingAlbum] = useState<GalleryAlbum | null>(null);
  const [editAlbumTitle, setEditAlbumTitle] = useState('');
  const [editAlbumDescription, setEditAlbumDescription] = useState('');
  const [editCover, setEditCover] = useState<AssetValue | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
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

  const resetCreateForm = () => {
    setAlbumTitle('');
    setAlbumDescription('');
    setAlbumPhotos([]);
    setAlbumCover(null);
    setBatchKey((key) => key + 1);
  };

  const handleCreateAlbum = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = albumTitle.trim();
    const description = albumDescription.trim();
    if (!title) {
      toast.error({ title: 'অ্যালবামের নাম লিখুন' });
      return;
    }
    if (title.length > 120) {
      toast.error({ title: 'অ্যালবামের নাম ১২০ অক্ষরের মধ্যে রাখুন' });
      return;
    }
    if (description.length > 500) {
      toast.error({ title: 'বর্ণনা ৫০০ অক্ষরের মধ্যে রাখুন' });
      return;
    }

    const created = await run<GalleryAlbum & { photos?: GalleryPhoto[] }>({
      url: '/api/gallery/albums',
      body: {
        title,
        description,
        // Already uploaded to Cloudinary by AssetBatchField — the album only stores the links.
        photos: albumPhotos,
        ...(albumCover ? { cover: albumCover } : {}),
      },
      success: albumPhotos.length
        ? `অ্যালবাম ও ${albumPhotos.length}টি ছবি তৈরি হয়েছে`
        : 'খালি অ্যালবামটি তৈরি হয়েছে',
      failure: 'অ্যালবাম তৈরি করা যায়নি',
    });
    if (!created) return;

    setAlbums((current) => {
      const { photos: _initialPhotos, ...album } = created;
      return [album as GalleryAlbum, ...(current || []).filter((item) => item.id !== album.id)];
    });
    setSelectedAlbumId(created.id);
    resetCreateForm();
  };

  const startEditAlbum = (album: GalleryAlbum) => {
    setEditingAlbum(album);
    setEditAlbumTitle(album.title);
    setEditAlbumDescription(album.description || '');
    setEditCover(album.coverImage ? { url: album.coverImage, publicId: album.coverPublicId } : null);
  };

  const handleSaveAlbum = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAlbum) return;
    const title = editAlbumTitle.trim();
    const description = editAlbumDescription.trim();
    if (!title) {
      toast.error({ title: 'অ্যালবামের নাম খালি রাখা যাবে না' });
      return;
    }
    if (title.length > 120 || description.length > 500) {
      toast.error({ title: title.length > 120 ? 'নাম ১২০ অক্ষরের মধ্যে রাখুন' : 'বর্ণনা ৫০০ অক্ষরের মধ্যে রাখুন' });
      return;
    }

    setSavingEdit(true);
    const updated = await run<GalleryAlbum>({
      url: `/api/gallery/albums/${editingAlbum.id}`,
      method: 'PUT',
      body: { title, description, cover: editCover },
      success: 'অ্যালবামের তথ্য আপডেট হয়েছে',
      failure: 'অ্যালবাম আপডেট করা যায়নি',
    });
    setSavingEdit(false);
    if (!updated) return;

    setAlbums((current) => (current || []).map((album) => (album.id === updated.id ? updated : album)));
    setEditingAlbum(null);
    setEditCover(null);
  };

  const handleDeleteAlbum = async (album: GalleryAlbum) => {
    if (!confirm(`“${album.title}” অ্যালবাম ও এর সব ছবি স্থায়ীভাবে মুছে যাবে। আপনি কি নিশ্চিত?`)) return;
    setDeletingAlbumId(album.id);
    const done = await run({
      url: `/api/gallery/albums/${album.id}`,
      method: 'DELETE',
      success: 'অ্যালবাম ও এর ছবিগুলো মুছে ফেলা হয়েছে',
      failure: 'অ্যালবাম মুছে ফেলা যায়নি',
    });
    setDeletingAlbumId(null);
    if (done === null) return;

    setAlbums((current) => (current || []).filter((item) => item.id !== album.id));
    if (editingAlbum?.id === album.id) setEditingAlbum(null);
  };

  const openAlbum = (id: string) => {
    setSelectedAlbumId(id);
    window.setTimeout(
      () => document.getElementById('selected-album-photos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0
    );
  };

  return (
    <div className="min-w-0 space-y-6">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
        <header className="flex flex-col gap-3 border-b border-emerald-900 bg-emerald-950 px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
        </header>

        <form onSubmit={handleCreateAlbum} className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">অ্যালবামের নাম *</label>
              <input
                value={albumTitle}
                maxLength={120}
                onChange={(event) => setAlbumTitle(event.target.value)}
                placeholder="যেমন: বন্যা ত্রাণ ২০২৪"
                className={inputClassName}
                disabled={creating}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">বর্ণনা (ঐচ্ছিক)</label>
              <input
                value={albumDescription}
                maxLength={500}
                onChange={(event) => setAlbumDescription(event.target.value)}
                placeholder="সংক্ষেপে কার্যক্রমের বিবরণ"
                className={inputClassName}
                disabled={creating}
              />
            </div>
          </div>

          <AssetBatchField
            folder="gallery"
            max={MAX_ALBUM_PHOTOS}
            resetKey={batchKey}
            onChange={setAlbumPhotos}
            disabled={creating}
          />

          <AssetField
            kind="image"
            folder="gallery"
            compact
            label="কভার ছবি (ঐচ্ছিক — না দিলে প্রথম ছবিটাই কভার হবে)"
            value={albumCover}
            onChange={setAlbumCover}
          />

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-slate-400">
              প্রতিটি ছবি সরাসরি Cloudinary-তে সংরক্ষিত হয় — সার্ভারের ডিস্কে কিছু থাকে না, তাই ডিপ্লয়ের পরও ছবি হারায় না।
            </p>
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
            <button
              type="button"
              onClick={() => refetchAlbums()}
              className="self-start text-xs font-bold text-emerald-800 hover:underline"
            >
              আবার লোড করুন
            </button>
          )}
        </div>

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
                  selectedAlbumId === album.id
                    ? 'border-emerald-700 ring-2 ring-emerald-700/10'
                    : 'border-slate-200 hover:border-slate-300'
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
                      {selectedAlbumId === album.id && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-700" title="নির্বাচিত" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-slate-500">
                      {album.description || 'কোনো বর্ণনা দেওয়া হয়নি।'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> {album.photoCount || 0}টি ছবি
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDate(album.createdAt)}
                      </span>
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
                    <AssetField
                      kind="image"
                      folder="gallery"
                      compact
                      label="কভার ছবি পরিবর্তন (ঐচ্ছিক)"
                      value={editCover}
                      onChange={setEditCover}
                      disabled={savingEdit}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-950 px-3 py-2.5 text-xs font-bold text-amber-400 disabled:opacity-60"
                      >
                        {savingEdit ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}{' '}
                        সেভ করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAlbum(null);
                          setEditCover(null);
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
                      <Eye className="h-3.5 w-3.5 shrink-0" />{' '}
                      <span className="truncate">অ্যালবাম খুলুন</span>
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
                      {deletingAlbumId === album.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
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

      {activeAlbum && <AlbumPhotosPanel album={activeAlbum} onAlbumPatch={patchAlbum} />}
    </div>
  );
};
