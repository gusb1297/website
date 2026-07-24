import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { NewsItem } from '../types';
import { Newspaper, Plus, Trash2 } from 'lucide-react';

export const ManageNews: React.FC = () => {
  const { token } = useAuth();
  const { data: newsList, refetch } = useFetch<NewsItem[]>('/api/news');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('News');
  const [author, setAuthor] = useState('পাবলিক রিলেশনস অফিসার');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('category', category);
      formData.append('author', author);

      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      } else {
        formData.append('thumbnail', thumbnailUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80');
      }

      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('সংবাদ সেভ করা যায়নি');

      setTitle('');
      setContent('');
      setThumbnailFile(null);
      setThumbnailUrl('');
      refetch();
    } catch (err) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই সংবাদটি ডিলিট করতে চান?')) return;
    try {
      await fetch(`/api/news/${id}`, {
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
          <Newspaper className="w-5 h-5 text-amber-500" /> নতুন সংবাদ / ইভেন্ট প্রকাশ করুন
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শিরোনাম</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="সংবাদের শিরোনাম..."
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              >
                <option value="News">সাধারণ সংবাদ (News)</option>
                <option value="Event">ইভেন্ট (Event)</option>
                <option value="Press Release">প্রেস বিজ্ঞপ্তি (Press Release)</option>
                <option value="Impact Story">সফলতার গল্প (Impact Story)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">সংবাদের মূল লেখা (Content)</label>
            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="সংবাদের বিস্তারিত বিবরণ লিখুন..."
              className="w-full px-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ছবি আপলোড (Multer)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">অথবা ছবি URL দিন</label>
              <input
                type="text"
                placeholder="https://..."
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {submitting ? 'প্রকাশ হচ্ছে...' : 'সংবাদ প্রকাশ করুন'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">প্রকাশিত সংবাদসমূহ ({newsList?.length || 0})</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(newsList || []).map((news) => (
            <div key={news.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={news.thumbnail} alt={news.title} className="w-16 h-16 object-cover rounded-xl border border-slate-300" />
                <div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {news.category}
                  </span>
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1 mt-1">{news.title}</h5>
                </div>
              </div>

              <button
                onClick={() => handleDelete(news.id)}
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
