import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { GalleryAlbum, GalleryPhoto } from '../types';
import { Image as ImageIcon, Trash2, FolderPlus, Edit3, X, Save } from 'lucide-react';

export const ManageGallery: React.FC = () => {
  const { token } = useAuth();
  const { data: albums, refetch: refetchAlbums } = useFetch<GalleryAlbum[]>('/api/gallery/albums');

  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const { data: photos, refetch: refetchPhotos } = useFetch<GalleryPhoto[]>(
    selectedAlbumId ? `/api/gallery/albums/${selectedAlbumId}/photos` : '/api/gallery/albums'
  );

  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumCoverUrl, setAlbumCoverUrl] = useState('');
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null);

  const [editingAlbum, setEditingAlbum] = useState<GalleryAlbum | null>(null);
  const [editAlbumTitle, setEditAlbumTitle] = useState('');
  const [editAlbumDescription, setEditAlbumDescription] = useState('');
  const [editAlbumCoverUrl, setEditAlbumCoverUrl] = useState('');

  // Photo form
  const [caption, setCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeAlbum = albums?.find((a) => a.id === selectedAlbumId) || albums?.[0] || null;

  useEffect(() => {
    if (!selectedAlbumId && albums && albums.length > 0) {
      setSelectedAlbumId(albums[0].id);
    }
    if (selectedAlbumId && albums && !albums.find((a) => a.id === selectedAlbumId) && albums.length > 0) {
      setSelectedAlbumId(albums[0].id);
    }
  }, [albums, selectedAlbumId]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', albumTitle);
      if (albumDescription) formData.append('description', albumDescription);
      if (albumCoverFile) {
        formData.append('coverImage', albumCoverFile);
      } else if (albumCoverUrl) {
        formData.append('coverImage', albumCoverUrl);
      }
      const res = await fetch('/api/gallery/albums', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('অ্যালবাম তৈরি করতে সমস্যা হয়েছে');
      setAlbumTitle('');
      setAlbumDescription('');
      setAlbumCoverUrl('');
      setAlbumCoverFile(null);
      refetchAlbums();
    } catch (e) {
      alert('ত্রুটি ঘটেছে');
    }
  };

  const startEditAlbum = (album: GalleryAlbum) => {
    setEditingAlbum(album);
    setEditAlbumTitle(album.title);
    setEditAlbumDescription(album.description || '');
    setEditAlbumCoverUrl(album.coverImage);
  };

  const handleSaveAlbum = async () => {
    if (!editingAlbum) return;
    try {
      const formData = new FormData();
      formData.append('title', editAlbumTitle);
      formData.append('description', editAlbumDescription);
      if (editAlbumCoverUrl) formData.append('coverImage', editAlbumCoverUrl);
      const res = await fetch(`/api/gallery/albums/${editingAlbum.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('অ্যালবাম আপডেট করা যায়নি');
      setEditingAlbum(null);
      refetchAlbums();
    } catch (e) {
      alert('ত্রুটি ঘটেছে');
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('অ্যালবাম ও এর সব ছবি মুছে যাবে। আপনি কি নিশ্চিত?')) return;
    try {
      await fetch(`/api/gallery/albums/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedAlbumId('');
      refetchAlbums();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlbum) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('caption', caption);

      if (photoFile) {
        formData.append('image', photoFile);
      } else {
        formData.append('image', photoUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80');
      }

      const res = await fetch(`/api/gallery/albums/${activeAlbum.id}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('ছবি সেভ করা যায়নি');

      setCaption('');
      setPhotoFile(null);
      setPhotoUrl('');
      refetchPhotos();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (!confirm('আপনি কি এই ছবিটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/gallery/photos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      refetchPhotos();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8">
      {/* Album List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <FolderPlus className="w-5 h-5 text-amber-500" /> ফটো অ্যালবাম ({albums?.length || 0})
        </h3>

        <form onSubmit={handleCreateAlbum} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            placeholder="অ্যালবামের নাম (যেমন: চরাঞ্চলে ত্রাণ বিতরণ ২০২)"
            className="md:col-span-2 px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
          />
          <input
            type="text"
            value={albumDescription}
            onChange={(e) => setAlbumDescription(e.target.value)}
            placeholder="বর্ণনা (ঐচ্ছিক)"
            className="px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={albumCoverUrl}
              onChange={(e) => setAlbumCoverUrl(e.target.value)}
              placeholder="কভার URL (ঐচ্ছিক)"
              className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
            <input
              type="file"
              accept="image/*"
              title="কভার ছবি আপলোড"
              onChange={(e) => setAlbumCoverFile(e.target.files?.[0] || null)}
              className="w-10"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase"
            >
              তৈরি
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(albums || []).map((album) => (
            <div key={album.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={album.coverImage}
                  alt={album.title}
                  className="w-14 h-14 object-cover rounded-xl border border-slate-300 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{album.title}</h5>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{album.description || '—'}</p>
                </div>
              </div>

              {editingAlbum?.id === album.id ? (
                <div className="space-y-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input type="text" value={editAlbumTitle} onChange={(e) => setEditAlbumTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="অ্যালবামের নাম" />
                  <input type="text" value={editAlbumDescription} onChange={(e) => setEditAlbumDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="বর্ণনা" />
                  <input type="text" value={editAlbumCoverUrl} onChange={(e) => setEditAlbumCoverUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="কভার ছবি URL" />
                  <div className="flex gap-2">
                    <button onClick={handleSaveAlbum} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold">
                      <Save className="w-3.5 h-3.5" /> সেভ
                    </button>
                    <button onClick={() => setEditingAlbum(null)} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedAlbumId(album.id);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                  >
                    ছবির তালিকা দেখুন
                  </button>
                  <button
                    onClick={() => startEditAlbum(album)}
                    className="p-2 rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-colors"
                    title="এডিট"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAlbum(album.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Photos of Selected Album */}
      {activeAlbum && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
          <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-800" /> {activeAlbum.title} — ছবি ({photos?.length || 0})
          </h3>

          <form onSubmit={handleUploadPhoto} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="ছবির ক্যাপশন / বিবরণ"
              className="md:col-span-2 px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="w-1/2"
              />
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="অথবা URL"
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
            >
              {submitting ? 'আপলোড হচ্ছে...' : 'ছবি যুক্ত করুন'}
            </button>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(photos || []).map((photo) => (
              <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200">
                <img src={photo.image} alt={photo.caption} className="w-full h-32 object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-950/90 to-transparent text-white">
                  <p className="text-[10px] line-clamp-1">{photo.caption}</p>
                </div>
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="ছবি মুছুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {(photos || []).length === 0 && (
            <p className="text-center text-slate-400 font-serif text-sm py-6">এই অ্যালবামে এখনও কোনো ছবি নেই।</p>
          )}
        </div>
      )}
    </div>
  );
};
