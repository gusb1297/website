import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { VideoItem } from '../types';
import { Video, Upload, Trash2, Link as LinkIcon, Film } from 'lucide-react';

export const ManageVideos: React.FC = () => {
  const { token } = useAuth();
  const { data: videos, refetch } = useFetch<VideoItem[]>('/api/videos');

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'upload' | 'embed'>('embed');
  const [embedUrl, setEmbedUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [category, setCategory] = useState('প্রামাণ্যচিত্র');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('type', type);
      formData.append('category', category);

      if (type === 'embed') {
        formData.append('embedUrl', embedUrl);
      } else if (videoFile) {
        formData.append('videoFile', videoFile);
        if (thumbnailFile) {
          formData.append('thumbnail', thumbnailFile);
        }
      }

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('ভিডিও আপলোড/সেভ করতে ব্যর্থ হয়েছে');

      setTitle('');
      setEmbedUrl('');
      setVideoFile(null);
      setThumbnailFile(null);
      refetch();
    } catch (err) {
      alert('ভিডিও প্রসেস করতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই ভিডিওটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Video className="w-5 h-5 text-amber-500" /> নতুন ভিডিও যোগ করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ভিডিও শিরোনাম</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: চরাঞ্চলে পরিবর্তনের গল্প ও বাস্তব চিত্র"
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ভিডিও টাইপ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              >
                <option value="embed">ইউটিউব/ভিমিও এমবেড লিঙ্ক (Embed Link)</option>
                <option value="upload">এমপিফোর ফাইল আপলোড (Multer + ffmpeg)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          {type === 'embed' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ইউটিউব এমবেড URL</label>
              <input
                type="text"
                required
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://www.youtube.com/embed/..."
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  এমপিফোর ভিডিও ফাইল আপলোড (MP4)
                </label>
                <input
                  type="file"
                  required
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  থাম্বনেইল ইমেজ (ঐচ্ছিক - না দিলে ffmpeg স্বয়ংক্রিয় বানাবে)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {submitting ? 'ভিডিও প্রসেস হচ্ছে...' : 'ভিডিও সেভ করুন'}
          </button>
        </form>
      </div>

      {/* Video List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">ভিডিও লাইব্রেরি ({videos?.length || 0})</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(videos || []).map((vid) => (
            <div key={vid.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-950 text-amber-400 flex items-center justify-center shrink-0">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="font-serif font-bold text-sm text-slate-900">{vid.title}</h5>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    {vid.type === 'embed' ? 'ইউটিউব লিঙ্ক' : 'এইচডি এমপিফোর স্ট্রিমিং'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDelete(vid.id)}
                className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
