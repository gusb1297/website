import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useFileInput } from '../hooks/useFileInput';
import { useAuth } from '../context/AuthContext';
import { HeroSlide } from '../types';
import { Plus, Trash2, Eye, EyeOff, Edit3, X, Save } from 'lucide-react';
import { readApiError } from '../utils/api';

export const ManageHeroSlider: React.FC = () => {
  const { token } = useAuth();
  const { data: slides, refetch } = useFetch<HeroSlide[]>('/api/hero-slides?all=true');

  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('/programs');
  const imageInput = useFileInput();
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editSubtext, setEditSubtext] = useState('');
  const [editButtonText, setEditButtonText] = useState('');
  const [editButtonLink, setEditButtonLink] = useState('');
  const editImageInput = useFileInput();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read the file at submit time (state, falling back to the input itself)
    // so the FormData always carries the file the browser is showing.
    const imageFile = imageInput.getFile();
    if (!imageFile) {
      alert('স্লাইডের জন্য একটি ছবি নির্বাচন করুন।');
      return;
    }
    setCreating(true);

    try {
      const formData = new FormData();
      formData.append('headline', headline);
      formData.append('subtext', subtext);
      formData.append('buttonText', buttonText);
      formData.append('buttonLink', buttonLink);
      formData.append('isActive', 'true');

      // Field name must match `upload.single('image')` on the server.
      formData.append('image', imageFile, imageFile.name);

      const res = await fetch('/api/hero-slides', {
        method: 'POST',
        // No Content-Type here: the browser sets multipart/form-data with the boundary.
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error(await readApiError(res, 'স্লাইড সংরক্ষণ ব্যর্থ হয়েছে'));

      setHeadline('');
      setSubtext('');
      // Clears the native input too, so the next slide cannot show a stale file.
      imageInput.reset();
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'স্লাইড যোগ করতে সমস্যা হয়েছে');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (slide: HeroSlide) => {
    try {
      await fetch(`/api/hero-slides/${slide.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !slide.isActive }),
      });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (slide: HeroSlide) => {
    setEditing(slide);
    setEditHeadline(slide.headline);
    setEditSubtext(slide.subtext);
    setEditButtonText(slide.buttonText || '');
    setEditButtonLink(slide.buttonLink || '');
    editImageInput.reset();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const formData = new FormData();
      formData.append('headline', editHeadline);
      formData.append('subtext', editSubtext);
      formData.append('buttonText', editButtonText);
      formData.append('buttonLink', editButtonLink);
      formData.append('isActive', String(editing.isActive));
      const editImageFile = editImageInput.getFile();
      if (editImageFile) {
        formData.append('image', editImageFile, editImageFile.name);
      }
      const res = await fetch(`/api/hero-slides/${editing.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'স্লাইড আপডেট করা যায়নি'));
      setEditing(null);
      editImageInput.reset();
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ত্রুটি ঘটেছে');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই স্লাইডটি ডিলিট করতে চান?')) return;
    try {
      await fetch(`/api/hero-slides/${id}`, {
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
          <Plus className="w-5 h-5 text-amber-500" /> নতুন হোমপেজ হিরো স্লাইড যোগ করুন
        </h3>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">স্লাইড প্রধান শিরোনাম</label>
              <input
                type="text"
                required
                placeholder="যেমন: গ্রামীণ সমাজে স্বাবলম্বিতা ও আর্থিক ক্ষমতায়ন"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">বাটন বিবরণ & লিঙ্ক</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="বাটন টেক্সট"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
                />
                <input
                  type="text"
                  placeholder="লিঙ্ক (যেমন: /programs)"
                  value={buttonLink}
                  onChange={(e) => setButtonLink(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">সাবটেক্সট / বিবরণ</label>
            <textarea
              rows={2}
              required
              placeholder="স্লাইডের বিস্তারিত বিবরণ প্রদান করুন..."
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              className="w-full px-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ছবি ফাইল আপলোড করুন (Direct Upload)</label>
              <input
                ref={imageInput.inputRef}
                type="file"
                name="image"
                required
                accept="image/*"
                onChange={imageInput.onChange}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
              {imageInput.file && (
                <p className="mt-1 truncate text-[10px] text-emerald-700">নির্বাচিত: {imageInput.file.name}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {creating ? 'সেভ হচ্ছে...' : 'স্লাইড যুক্ত করুন'}
          </button>
        </form>
      </div>

      {/* Slide List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900">বর্তমান হিরো স্লাইডসমূহ ({slides?.length || 0})</h4>

        <div className="space-y-4">
          {(slides || []).map((slide) => (
            <div
              key={slide.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={slide.image}
                  alt={slide.headline}
                  className="w-24 h-16 object-cover rounded-xl border border-slate-300 shrink-0"
                />
                <div className="min-w-0">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{slide.headline}</h5>
                  <p className="text-xs text-slate-600 line-clamp-1">{slide.subtext}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => toggleActive(slide)}
                  className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    slide.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {slide.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {slide.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </button>

                <button
                  onClick={() => startEdit(slide)}
                  className="p-2 rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-colors"
                  title="এডিট"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(slide.id)}
                  className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Inline edit form */}
              {editing?.id === slide.id && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-emerald-300">
                  <input
                    type="text"
                    value={editHeadline}
                    onChange={(e) => setEditHeadline(e.target.value)}
                    className="md:col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="শিরোনাম"
                  />
                  <textarea
                    rows={2}
                    value={editSubtext}
                    onChange={(e) => setEditSubtext(e.target.value)}
                    className="md:col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="সাবটেক্সট"
                  />
                  <input
                    type="text"
                    value={editButtonText}
                    onChange={(e) => setEditButtonText(e.target.value)}
                    className="px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="বাটন টেক্সট"
                  />
                  <input
                    type="text"
                    value={editButtonLink}
                    onChange={(e) => setEditButtonLink(e.target.value)}
                    className="px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="বাটন লিঙ্ক (যেমন: /programs)"
                  />
                  <input
                    ref={editImageInput.inputRef}
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={editImageInput.onChange}
                    className="px-2 py-1 text-[10px] border border-dashed border-slate-300 rounded-lg"
                  />
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold"
                    >
                      <Save className="w-3.5 h-3.5" /> আপডেট সেভ করুন
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5" /> বাতিল
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
