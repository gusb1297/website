import React, { useMemo, useRef, useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { VideoItem } from '../types';
import { formatBytes, previewVideoLink, videoSourceLabel } from '../utils/video';
import {
  Video,
  UploadCloud,
  Trash2,
  Link as LinkIcon,
  Film,
  Youtube,
  MonitorSmartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Pencil,
  Save,
} from 'lucide-react';

type UploadMode = 'device' | 'link';

const CATEGORY_OPTIONS = ['প্রামাণ্যচিত্র', 'সাফল্যের গল্প', 'মাঠপর্যায়ের কাজ', 'ইভেন্ট', 'প্রশিক্ষণ', 'সচেতনতা'];

export const ManageVideos: React.FC = () => {
  const { token } = useAuth();
  const { data: videos, refetch } = useFetch<VideoItem[]>('/api/videos');

  const [mode, setMode] = useState<UploadMode>('device');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [description, setDescription] = useState('');

  // Device upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Link state
  const [embedUrl, setEmbedUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Inline editing of an existing item
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const linkPreview = useMemo(() => previewVideoLink(embedUrl), [embedUrl]);
  const localPreviewUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEmbedUrl('');
    setVideoFile(null);
    setThumbnailFile(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pickDroppedFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setMessage({ kind: 'err', text: 'শুধুমাত্র ভিডিও ফাইল দেওয়া যাবে (MP4, WebM, MOV…)' });
      return;
    }
    setMessage(null);
    setVideoFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setMessage({ kind: 'err', text: 'ভিডিও শিরোনাম লিখুন।' });
      return;
    }
    if (mode === 'device' && !videoFile) {
      setMessage({ kind: 'err', text: 'ডিভাইস থেকে একটি ভিডিও ফাইল নির্বাচন করুন।' });
      return;
    }
    if (mode === 'link' && !linkPreview) {
      setMessage({ kind: 'err', text: 'সঠিক ইউটিউব বা ভিমিও লিঙ্ক দিন।' });
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('category', category.trim());
    formData.append('description', description.trim());
    formData.append('type', mode === 'device' ? 'upload' : 'embed');

    if (mode === 'device' && videoFile) {
      formData.append('videoFile', videoFile);
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
    } else {
      formData.append('embedUrl', embedUrl.trim());
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
    }

    // XHR (not fetch) so the admin sees a real upload progress bar for big files.
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    setSubmitting(true);
    setProgress(0);

    xhr.open('POST', '/api/videos');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
    };

    xhr.onload = () => {
      setSubmitting(false);
      xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage({
          kind: 'ok',
          text: mode === 'device' ? 'ভিডিও সফলভাবে আপলোড হয়েছে।' : 'ইউটিউব/ভিমিও ভিডিও যুক্ত হয়েছে।',
        });
        resetForm();
        refetch();
      } else {
        let text = 'ভিডিও সংরক্ষণ করা যায়নি।';
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          text = body.message || body.error || text;
        } catch {
          /* keep default */
        }
        setMessage({ kind: 'err', text });
      }
    };

    xhr.onerror = () => {
      setSubmitting(false);
      xhrRef.current = null;
      setMessage({ kind: 'err', text: 'নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।' });
    };

    xhr.onabort = () => {
      setSubmitting(false);
      xhrRef.current = null;
      setProgress(0);
      setMessage({ kind: 'err', text: 'আপলোড বাতিল করা হয়েছে।' });
    };

    xhr.send(formData);
  };

  const cancelUpload = () => xhrRef.current?.abort();

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই ভিডিওটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/videos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (vid: VideoItem) => {
    setEditingId(vid.id);
    setEditTitle(vid.title);
    setEditCategory(vid.category || '');
  };

  const saveEdit = async (id: string) => {
    try {
      await fetch(`/api/videos/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, category: editCategory }),
      });
      setEditingId(null);
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  const uploadCount = (videos || []).filter((v) => v.type === 'upload').length;
  const embedCount = (videos || []).filter((v) => v.type === 'embed').length;

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <Video className="w-5 h-5 text-amber-500" /> নতুন ভিডিও যোগ করুন
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            দুইভাবে ভিডিও দেওয়া যায় — ডিভাইস থেকে সরাসরি আপলোড অথবা ইউটিউব লিঙ্ক
          </span>
        </div>

        {/* Two-way mode switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('device')}
            className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
              mode === 'device'
                ? 'border-emerald-800 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                mode === 'device' ? 'bg-emerald-950 text-amber-400' : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              <MonitorSmartphone className="w-5 h-5" />
            </span>
            <span>
              <span className="block font-bold text-xs text-slate-900">ডিভাইস থেকে আপলোড</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                মোবাইল/কম্পিউটার থেকে MP4 ফাইল — Cloudinary-তে সংরক্ষিত হয়
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
              mode === 'link'
                ? 'border-emerald-800 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                mode === 'link' ? 'bg-emerald-950 text-amber-400' : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              <Youtube className="w-5 h-5" />
            </span>
            <span>
              <span className="block font-bold text-xs text-slate-900">ইউটিউব / ভিমিও লিঙ্ক</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                যেকোনো ইউটিউব লিঙ্ক পেস্ট করুন — থাম্বনেইল স্বয়ংক্রিয়ভাবে আসবে
              </span>
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ভিডিও শিরোনাম *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: চরাঞ্চলে পরিবর্তনের গল্প ও বাস্তব চিত্র"
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
              <input
                list="video-categories"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
              <datalist id="video-categories">
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {mode === 'device' ? (
            <div className="space-y-4">
              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickDroppedFile(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  dragging ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:border-emerald-700'
                }`}
              >
                <UploadCloud className="w-8 h-8 mx-auto text-emerald-800" />
                <p className="text-xs font-bold text-slate-800 mt-2">
                  ভিডিও ফাইল এখানে টেনে আনুন অথবা ক্লিক করে নির্বাচন করুন
                </p>
                <p className="text-[11px] text-slate-500 mt-1">MP4, WebM, MOV, MKV — সর্বোচ্চ ৫১২ এমবি</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => pickDroppedFile(e.target.files)}
                />
              </div>

              {videoFile && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-emerald-950 text-amber-400 flex items-center justify-center shrink-0">
                        <Film className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{videoFile.name}</p>
                        <p className="text-[11px] text-slate-500">{formatBytes(videoFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {localPreviewUrl && (
                    <video src={localPreviewUrl} controls className="w-full rounded-xl max-h-56 bg-black" />
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  থাম্বনেইল ইমেজ (ঐচ্ছিক — না দিলে স্বয়ংক্রিয়ভাবে তৈরি হবে)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ইউটিউব / ভিমিও লিঙ্ক *</label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={embedUrl}
                    onChange={(e) => setEmbedUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... অথবা https://youtu.be/..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  watch, share, shorts, live বা embed — যেকোনো ফরম্যাটের লিঙ্ক কাজ করবে।
                </p>
              </div>

              {embedUrl.trim() && (
                <div
                  className={`rounded-2xl border p-4 ${
                    linkPreview ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50'
                  }`}
                >
                  {linkPreview ? (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {linkPreview.label} লিঙ্ক শনাক্ত হয়েছে
                      </p>
                      <div className="aspect-video w-full max-w-md rounded-xl overflow-hidden bg-black">
                        <iframe
                          src={linkPreview.embedUrl}
                          title="preview"
                          className="w-full h-full border-0"
                          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> লিঙ্কটি সঠিক নয়।
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  কাস্টম থাম্বনেইল (ঐচ্ছিক — না দিলে ইউটিউব থাম্বনেইল ব্যবহার হবে)
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          {submitting && mode === 'device' && (
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-800 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>আপলোড হচ্ছে… {progress}%</span>
                <button type="button" onClick={cancelUpload} className="font-bold text-red-600 hover:underline">
                  বাতিল করুন
                </button>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl ${
                message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 disabled:opacity-60 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {submitting
              ? 'ভিডিও প্রসেস হচ্ছে...'
              : mode === 'device'
              ? 'আপলোড করে সেভ করুন'
              : 'লিঙ্ক যুক্ত করুন'}
          </button>
        </form>
      </div>

      {/* Video Library */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-lg font-serif font-bold text-slate-900">ভিডিও লাইব্রেরি ({videos?.length || 0})</h4>
          <div className="flex gap-2 text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">আপলোড: {uploadCount}</span>
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700">ইউটিউব/লিঙ্ক: {embedCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(videos || []).map((vid) => (
            <div key={vid.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex gap-4">
              <div className="w-28 h-20 rounded-xl overflow-hidden bg-emerald-950 shrink-0 relative">
                {vid.thumbnail ? (
                  <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-400">
                    <Film className="w-6 h-6" />
                  </div>
                )}
                {vid.duration && (
                  <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {vid.duration}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                {editingId === vid.id ? (
                  <div className="space-y-1.5">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white border border-slate-300"
                    />
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="ক্যাটাগরি"
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white border border-slate-300"
                    />
                  </div>
                ) : (
                  <>
                    <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-2">{vid.title}</h5>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          vid.type === 'embed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {videoSourceLabel(vid)}
                      </span>
                      {vid.category && (
                        <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                          {vid.category}
                        </span>
                      )}
                      {vid.sizeBytes ? (
                        <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatBytes(vid.sizeBytes)}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {editingId === vid.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(vid.id)}
                      className="p-2 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(vid)}
                      className="p-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(vid.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {(videos || []).length === 0 && (
            <p className="col-span-2 text-center text-xs text-slate-500 py-8">এখনো কোনো ভিডিও যোগ করা হয়নি।</p>
          )}
        </div>
      </div>
    </div>
  );
};
