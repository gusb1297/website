import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { PageContent, BilingualText } from '../types';
import { LayoutTemplate, Save, CheckCircle2, Home as HomeIcon, Info } from 'lucide-react';
import { readApiError } from '../utils/api';

const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700';

const emptyBn: BilingualText = { bn: '', en: '' };

const asBilingual = (value: unknown): BilingualText => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Partial<BilingualText>;
    return { bn: typeof v.bn === 'string' ? v.bn : '', en: typeof v.en === 'string' ? v.en : '' };
  }
  return { ...emptyBn };
};

/**
 * Guarantee every editable field exists so the form can never crash on an
 * older/partial content snapshot (e.g. created before new fields were added).
 */
function normalizePageContent(input: Partial<PageContent> | null | undefined): PageContent {
  const h = (input?.home || {}) as Record<string, unknown>;
  const a = (input?.about || {}) as Record<string, unknown>;

  const homeKeys: (keyof PageContent['home'])[] = [
    'noticeBadge', 'viewNotice', 'establishedBadge', 'teaserTitle', 'teaserText',
    'visionTitle', 'visionText', 'missionTitle', 'missionText', 'learnMoreCta',
    'teaserImageLabel', 'teaserImageCaption', 'programsBadge', 'programsTitle',
    'viewAllPrograms', 'videoBadge', 'videoTitle', 'videoText', 'watchAllVideos',
    'newsBadge', 'newsTitle', 'readAllNews', 'partnersTitle',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const home: any = {};
  homeKeys.forEach((key) => { home[key] = asBilingual(h[key]); });
  home.teaserImage = typeof h.teaserImage === 'string' ? h.teaserImage : '';

  const aboutKeys: (keyof PageContent['about'])[] = [
    'bannerBadge', 'bannerTitle', 'bannerSub', 'historyTitle', 'history1', 'history2',
    'vision', 'mission', 'messageSectionBadge', 'messageSectionTitle', 'legalBadge',
    'legalTitle', 'legalSub',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const about: any = {};
  aboutKeys.forEach((key) => { about[key] = asBilingual(a[key]); });

  const leader = (src: unknown) => {
    const l = (src || {}) as Record<string, unknown>;
    return {
      name: asBilingual(l.name),
      title: asBilingual(l.title),
      message: asBilingual(l.message),
      photo: typeof l.photo === 'string' ? l.photo : '',
    };
  };
  about.chairman = leader(a.chairman);
  about.director = leader(a.director);
  about.legalItems = Array.isArray(a.legalItems)
    ? a.legalItems.map((item) => asBilingual(item))
    : [];

  return { home: home as PageContent['home'], about: about as PageContent['about'] };
}

/** Two stacked inputs (Bangla + English) for an editable bilingual field. */
const BilingualField: React.FC<{
  label: string;
  value: BilingualText;
  onChange: (value: BilingualText) => void;
  rows?: number;
  asInput?: boolean;
}> = ({ label, value, onChange, rows = 2, asInput = false }) => (
  <div>
    <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
    <div className="space-y-2">
      {asInput ? (
        <>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              বাং
            </span>
            <input
              type="text"
              value={value.bn || ''}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              className={`${inputCls} pl-12`}
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              EN
            </span>
            <input
              type="text"
              value={value.en || ''}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              className={`${inputCls} pl-12`}
            />
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              বাং
            </span>
            <textarea
              rows={rows}
              value={value.bn || ''}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
              className={`${inputCls} pl-12`}
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              EN
            </span>
            <textarea
              rows={rows}
              value={value.en || ''}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              className={`${inputCls} pl-12`}
            />
          </div>
        </>
      )}
    </div>
  </div>
);

const TextField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
    <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls} />
  </div>
);

export const ManagePages: React.FC = () => {
  const { token } = useAuth();
  const { data: pageContent } = useFetch<PageContent>('/api/page-content');
  const [activeSection, setActiveSection] = useState<'home' | 'about'>('home');
  const [draft, setDraft] = useState<PageContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (pageContent && !draft) {
      // Deep clone + normalize so edits never mutate the fetched cache and
      // every field exists even for older snapshots.
      const raw = JSON.parse(JSON.stringify(pageContent)) as Partial<PageContent>;
      setDraft(normalizePageContent(raw));
    }
  }, [pageContent, draft]);

  const setHome = <K extends keyof PageContent['home']>(key: K, value: PageContent['home'][K]) => {
    setDraft((prev) => (prev ? { ...prev, home: { ...prev.home, [key]: value } } : prev));
  };

  const setAbout = <K extends keyof PageContent['about']>(key: K, value: PageContent['about'][K]) => {
    setDraft((prev) => (prev ? { ...prev, about: { ...prev.about, [key]: value } } : prev));
  };

  const setLeader = (who: 'chairman' | 'director', key: 'name' | 'title' | 'message', value: BilingualText) => {
    setDraft((prev) =>
      prev
        ? { ...prev, about: { ...prev.about, [who]: { ...prev.about[who], [key]: value } } }
        : prev
    );
  };

  const setLegalItem = (idx: number, value: BilingualText) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...(prev.about.legalItems || [])];
      items[idx] = value;
      return { ...prev, about: { ...prev.about, legalItems: items } };
    });
  };

  const addLegalItem = () => {
    setDraft((prev) =>
      prev
        ? { ...prev, about: { ...prev.about, legalItems: [...(prev.about.legalItems || []), { ...emptyBn }] } }
        : prev
    );
  };

  const removeLegalItem = (idx: number) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            about: { ...prev.about, legalItems: (prev.about.legalItems || []).filter((_, i) => i !== idx) },
          }
        : prev
    );
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/page-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'কন্টেন্ট সেভ করা যায়নি'));
      setMsg('পেজ কন্টেন্ট সফলভাবে সেভ করা হয়েছে!');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ত্রুটি ঘটেছে: কন্টেন্ট সেভ করা যায়নি');
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-lg text-center text-slate-500 font-serif">
        লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-amber-500" /> ওয়েবসাইট কন্টেন্ট (হোম ও About পেজ)
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('home')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'home'
                  ? 'bg-emerald-950 text-amber-400 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <HomeIcon className="w-4 h-4" /> হোম পেজ
            </button>
            <button
              onClick={() => setActiveSection('about')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'about'
                  ? 'bg-emerald-950 text-amber-400 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Info className="w-4 h-4" /> About পেজ
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-sans">
          পাবলিক সাইটের হোম ও About পেজে যে লেখা দেখানো হয় তা এখান থেকে সম্পূর্ণ এডিট করা যায় (বাংলা + English)।
          সেভ করলেই সাইটে প্রয়োগ হবে।
        </p>

        {msg && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 font-bold text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {msg}
          </div>
        )}
      </div>

      {/* ================= HOME SECTION ================= */}
      {activeSection === 'home' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-6">
          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pb-3">
            ১. নোটিশ টিকার (হোমের উপরে সোনালি ব্যানার)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="নোটিশ লেবেল" value={draft.home.noticeBadge} onChange={(v) => setHome('noticeBadge', v)} asInput />
            <BilingualField label="নোটিশ CTA" value={draft.home.viewNotice} onChange={(v) => setHome('viewNotice', v)} asInput />
          </div>

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ২. অর্গানাইজেশন টিজার সেকশন
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="ব্যাজ (যেমন: ১৫ বছরের বিশ্বস্ত সামাজিক সেবা)" value={draft.home.establishedBadge} onChange={(v) => setHome('establishedBadge', v)} asInput />
            <BilingualField label="ছবির লেবেল (ছবির নিচের বক্স)" value={draft.home.teaserImageLabel} onChange={(v) => setHome('teaserImageLabel', v)} asInput />
          </div>
          <BilingualField label="প্রধান শিরোনাম" value={draft.home.teaserTitle} onChange={(v) => setHome('teaserTitle', v)} />
          <BilingualField label="মূল পরিচিতি লেখা" value={draft.home.teaserText} onChange={(v) => setHome('teaserText', v)} rows={4} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <BilingualField label="ভিশন শিরোনাম" value={draft.home.visionTitle} onChange={(v) => setHome('visionTitle', v)} asInput />
            </div>
            <div>
              <BilingualField label="মিশন শিরোনাম" value={draft.home.missionTitle} onChange={(v) => setHome('missionTitle', v)} asInput />
            </div>
            <div>
              <BilingualField label="ভিশন লেখা" value={draft.home.visionText} onChange={(v) => setHome('visionText', v)} />
            </div>
            <div>
              <BilingualField label="মিশন লেখা" value={draft.home.missionText} onChange={(v) => setHome('missionText', v)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="'আমাদের সম্পর্কে' বাটনের টেক্সট" value={draft.home.learnMoreCta} onChange={(v) => setHome('learnMoreCta', v)} asInput />
            <TextField label="টেজার ছবির URL" value={draft.home.teaserImage} onChange={(v) => setHome('teaserImage', v)} />
          </div>
          <BilingualField label="ছবির নিচের ক্যাপশন" value={draft.home.teaserImageCaption} onChange={(v) => setHome('teaserImageCaption', v)} />

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ৩. প্রজেক্ট সেকশনের শিরোনাম
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="বিজে (Badge)" value={draft.home.programsBadge} onChange={(v) => setHome('programsBadge', v)} asInput />
            <BilingualField label="'সব দেখুন' লিংক টেক্সট" value={draft.home.viewAllPrograms} onChange={(v) => setHome('viewAllPrograms', v)} asInput />
          </div>
          <BilingualField label="প্রধান শিরোনাম" value={draft.home.programsTitle} onChange={(v) => setHome('programsTitle', v)} asInput />

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ৪. ভিডিও সেকশন (ডার্ক ব্যানার)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="বিজে (Badge)" value={draft.home.videoBadge} onChange={(v) => setHome('videoBadge', v)} asInput />
            <BilingualField label="'সব ভিডিও' বাটন টেক্সট" value={draft.home.watchAllVideos} onChange={(v) => setHome('watchAllVideos', v)} asInput />
          </div>
          <BilingualField label="প্রধান শিরোনাম" value={draft.home.videoTitle} onChange={(v) => setHome('videoTitle', v)} asInput />
          <BilingualField label="বিস্তারিত লেখা" value={draft.home.videoText} onChange={(v) => setHome('videoText', v)} rows={3} />

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ৫. সংবাদ সেকশন ও পার্টনার লেবেল
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="সংবাদ বিজে (Badge)" value={draft.home.newsBadge} onChange={(v) => setHome('newsBadge', v)} asInput />
            <BilingualField label="'সব খবর' লিংক টেক্সট" value={draft.home.readAllNews} onChange={(v) => setHome('readAllNews', v)} asInput />
          </div>
          <BilingualField label="সংবাদ শিরোনাম" value={draft.home.newsTitle} onChange={(v) => setHome('newsTitle', v)} asInput />
          <BilingualField label="পার্টনার সেকশন শিরোনাম" value={draft.home.partnersTitle} onChange={(v) => setHome('partnersTitle', v)} asInput />
        </div>
      )}

      {/* ================= ABOUT SECTION ================= */}
      {activeSection === 'about' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-6">
          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pb-3">
            ১. পেজ ব্যানার
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="বিজে (Badge)" value={draft.about.bannerBadge} onChange={(v) => setAbout('bannerBadge', v)} asInput />
            <BilingualField label="প্রধান শিরোনাম" value={draft.about.bannerTitle} onChange={(v) => setAbout('bannerTitle', v)} asInput />
          </div>
          <BilingualField label="সাব-শিরোনাম" value={draft.about.bannerSub} onChange={(v) => setAbout('bannerSub', v)} asInput />

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ২. ইতিহাস
          </h4>
          <BilingualField label="সেকশন শিরোনাম" value={draft.about.historyTitle} onChange={(v) => setAbout('historyTitle', v)} asInput />
          <BilingualField label="ইতিহাস - প্রথম প্যারাগ্রাফ" value={draft.about.history1} onChange={(v) => setAbout('history1', v)} rows={4} />
          <BilingualField label="ইতিহাস - দ্বিতীয় প্যারাগ্রাফ" value={draft.about.history2} onChange={(v) => setAbout('history2', v)} rows={4} />

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ৩. ভিশন ও মিশন
          </h4>
          <BilingualField label="ভিশন" value={draft.about.vision} onChange={(v) => setAbout('vision', v)} rows={3} />
          <BilingualField label="মিশন" value={draft.about.mission} onChange={(v) => setAbout('mission', v)} rows={3} />

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ৪. নেতৃত্বের বার্তা
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="সেকশন বিজে" value={draft.about.messageSectionBadge} onChange={(v) => setAbout('messageSectionBadge', v)} asInput />
            <BilingualField label="সেকশন শিরোনাম" value={draft.about.messageSectionTitle} onChange={(v) => setAbout('messageSectionTitle', v)} asInput />
          </div>

          {(['chairman', 'director'] as const).map((who) => (
            <div key={who} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {who === 'chairman' ? 'চেয়ারম্যান (Chairman)' : 'নির্বাহী পরিচালক (Executive Director)'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BilingualField label="নাম" value={draft.about[who].name} onChange={(v) => setLeader(who, 'name', v)} asInput />
                <BilingualField label="পদবি" value={draft.about[who].title} onChange={(v) => setLeader(who, 'title', v)} asInput />
              </div>
              <TextField label="ছবি URL" value={draft.about[who].photo} onChange={(v) => {
                setDraft((prev) =>
                  prev ? { ...prev, about: { ...prev.about, [who]: { ...prev.about[who], photo: v } } } : prev
                );
              }} />
              <BilingualField label="বার্তা" value={draft.about[who].message} onChange={(v) => setLeader(who, 'message', v)} rows={3} />
            </div>
          ))}

          <h4 className="text-lg font-serif font-bold text-slate-900 border-b border-slate-100 pt-4 pb-3">
            ৫. আইনগত নিবন্ধন বক্স
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <BilingualField label="বিজে (Badge)" value={draft.about.legalBadge} onChange={(v) => setAbout('legalBadge', v)} asInput />
            <BilingualField label="শিরোনাম" value={draft.about.legalTitle} onChange={(v) => setAbout('legalTitle', v)} asInput />
          </div>
          <BilingualField label="বর্ণনা" value={draft.about.legalSub} onChange={(v) => setAbout('legalSub', v)} rows={2} />
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-600">নিবন্ধন আইটেমসমূহ:</p>
            {(draft.about.legalItems || []).map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1">
                  <BilingualField label={`আইটেম ${idx + 1}`} value={item} onChange={(v) => setLegalItem(idx, v)} asInput />
                </div>
                <button
                  type="button"
                  onClick={() => removeLegalItem(idx)}
                  className="mt-1 px-3 py-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold"
                >
                  মুছুন
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLegalItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              + নতুন আইটেম
            </button>
          </div>
        </div>
      )}

      {/* Save bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-lg flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
        >
          <Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'পরিবর্তনসমূহ সেভ করুন'}
        </button>
      </div>
    </div>
  );
};
