import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { GalleryAlbum, GalleryPhoto } from '../types';
import { Image as ImageIcon, Plus, Trash2, FolderPlus } from 'lucide-react';

export const ManageGallery: React.FC = () => {
  const { token } = useAuth();
  const { data: albums, refetch: refetchAlbums } = useFetch<GalleryAlbum[]>('/api/gallery/albums');

  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('alb-1');
  const [albumTitle, setAlbumTitle] = useState('');

  // Photo form
  const [caption, setCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/gallery/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: albumTitle }),
      });
      if (!res.ok) throw new Error('অ্যালবাম তৈরি করতে সমস্যা হয়েছে');
      setAlbumTitle('');
      refetchAlbums();
    } catch (e) {
      alert('ত্রুটি ঘটেছে');
    }
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('caption', caption);

      if (photoFile) {
        formData.append('image', photoFile);
      } else {
        formData.append('image', photoUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80');
      }

      const res = await fetch(`/api/gallery/albums/${selectedAlbumId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('ছবি সেভ করা যায়নি');

      setCaption('');
      setPhotoFile(null);
      setPhotoUrl('');
      alert('অ্যালবামে ছবি যুক্ত হয়েছে!');
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Album */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <FolderPlus className="w-5 h-5 text-amber-500" /> নতুন ফটো অ্যালবাম তৈরি করুন
        </h3>

        <form onSubmit={handleCreateAlbum} className="flex gap-4">
          <input
            type="text"
            required
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            placeholder="অ্যালবামের নাম (যেমন: চরাঞ্চলে ত্রাণ বিতরণ ২০২৩)"
            className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase"
          >
            অ্যালবাম তৈরি করুন
          </button>
        </form>
      </div>

      {/* Upload Photo to Album */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-emerald-800" /> অ্যালবামে ছবি আপলোড করুন
        </h3>

        <form onSubmit={handleUploadPhoto} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">অ্যালবাম নির্বাচন করুন</label>
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            >
              {(albums || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ছবির ক্যাপশন / বিবরণ</label>
            <input
              type="text"
              required
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="ছবির বর্ণনা..."
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ছবি ফাইল আপলোড (Multer)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">অথবা ছবি URL দিন</label>
              <input
                type="text"
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {submitting ? 'আপলোড হচ্ছে...' : 'ছবি যুক্ত করুন'}
          </button>
        </form>
      </div>
    </div>
  );
};
