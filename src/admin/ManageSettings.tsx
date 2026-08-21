import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { SiteSettings, BranchOffice } from '../types';
import { Settings, Save, CheckCircle2, Palette, Plus, Trash2, RotateCcw } from 'lucide-react';

const PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: 'মূল সবুজ-সোনালি', primary: '#1B3022', accent: '#B38B4D' },
  { name: 'রাতের সবুজ', primary: '#102A43', accent: '#3E92CC' },
  { name: 'লাল-গোলাপী', primary: '#5C1A1B', accent: '#D4A017' },
  { name: 'নীল-বেগুনি', primary: '#1E1B4B', accent: '#F59E0B' },
  { name: 'টেরাকোটা', primary: '#7C2D12', accent: '#FBBF24' },
  { name: 'কালো-গোল্ড', primary: '#111827', accent: '#EAB308' },
];

const inputCls =
  'w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300 focus:outline-none focus:border-emerald-700';

export const ManageSettings: React.FC = () => {
  const { token } = useAuth();
  const { notifySettingsUpdated } = useSettings();
  const { data: settings } = useFetch<SiteSettings>('/api/settings');

  const [orgName, setOrgName] = useState('');
  const [orgNameEn, setOrgNameEn] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [establishedYear, setEstablishedYear] = useState(2010);
  const [address, setAddress] = useState('');
  const [addressEn, setAddressEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [officeHoursEn, setOfficeHoursEn] = useState('');
  const [emergencyHotline, setEmergencyHotline] = useState('');
  const [headerLocationBn, setHeaderLocationBn] = useState('');
  const [headerLocationEn, setHeaderLocationEn] = useState('');
  const [mapLat, setMapLat] = useState('24.8481');
  const [mapLng, setMapLng] = useState('89.373');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [branches, setBranches] = useState<BranchOffice[]>([]);
  const [social, setSocial] = useState({ facebook: '', youtube: '', linkedin: '', twitter: '' });
  const [footerAboutBn, setFooterAboutBn] = useState('');
  const [footerAboutEn, setFooterAboutEn] = useState('');
  const [footerCopyrightBn, setFooterCopyrightBn] = useState('');
  const [footerCopyrightEn, setFooterCopyrightEn] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1B3022');
  const [accentColor, setAccentColor] = useState('#B38B4D');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setOrgName(settings.ngoName || '');
      setOrgNameEn(settings.ngoNameEn || '');
      setTagline(settings.ngoTagline || '');
      setLogoUrl(settings.logoUrl || '');
      setEstablishedYear(settings.establishedYear || new Date().getFullYear());
      setAddress(settings.address || '');
      setAddressEn(settings.addressEn || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setOfficeHours(settings.officeHours || '');
      setOfficeHoursEn(settings.officeHoursEn || '');
      setEmergencyHotline(settings.emergencyHotline || '');
      setHeaderLocationBn(settings.headerLocation?.bn || '');
      setHeaderLocationEn(settings.headerLocation?.en || '');
      setMapLat(String(settings.mapLat ?? ''));
      setMapLng(String(settings.mapLng ?? ''));
      setRegistrationNumber(settings.registrationNumber || '');
      setBranches(settings.branchAddresses || []);
      setSocial({
        facebook: settings.socialLinks?.facebook || '',
        youtube: settings.socialLinks?.youtube || '',
        linkedin: settings.socialLinks?.linkedin || '',
        twitter: settings.socialLinks?.twitter || '',
      });
      setFooterAboutBn(settings.footerAbout?.bn || '');
      setFooterAboutEn(settings.footerAbout?.en || '');
      setFooterCopyrightBn(settings.footerCopyright?.bn || '');
      setFooterCopyrightEn(settings.footerCopyright?.en || '');
      setPrimaryColor(settings.theme?.primary || '#1B3022');
      setAccentColor(settings.theme?.accent || '#B38B4D');
    }
  }, [settings]);

  const updateBranch = (idx: number, field: keyof BranchOffice, value: string) => {
    setBranches((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    try {
      const body: Record<string, unknown> = {
        ngoName: orgName,
        ngoNameEn: orgNameEn,
        ngoTagline: tagline,
        logoUrl,
        establishedYear: Number(establishedYear),
        address,
        addressEn,
        phone,
        email,
        officeHours,
        officeHoursEn,
        emergencyHotline,
        headerLocation: { bn: headerLocationBn, en: headerLocationEn },
        mapLat: Number(mapLat || 0),
        mapLng: Number(mapLng || 0),
        registrationNumber,
        branchAddresses: branches,
        socialLinks: social,
        footerAbout: { bn: footerAboutBn, en: footerAboutEn },
        footerCopyright: { bn: footerCopyrightBn, en: footerCopyrightEn },
        theme: { primary: primaryColor, accent: accentColor },
      };

      let res: Response;
      if (logoFile) {
        const formData = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        });
        formData.append('logo', logoFile);
        res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        res = await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error('সেটিংস আপডেট করা যায়নি');

      setMsg('ওয়েবসাইট সেটিংস সফলভাবে সেভ করা হয়েছে!');
      setLogoFile(null);
      // Let the public site + admin preview pick up the new values/colors.
      notifySettingsUpdated();
    } catch (e) {
      alert('ত্রুটি ঘটেছে: সেটিংস সেভ করা যায়নি');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ================= THEME / SITE-WIDE COLORS ================= */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-5">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-500" /> সাইট-ওয়াইড রঙ (Theme Colors)
        </h3>
        <p className="text-xs text-slate-500 font-sans">
          নিচের কালার বক্স থেকে পুরো ওয়েবসাইটের প্রধান (dark) রঙ ও অ্যাকসেন্ট (gold) রঙ পরিবর্তন করুন।
          নেভিগেশন, ফুটার, ব্যানার, বাটন — সব জায়গায় সাথে সাথে প্রয়োগ হবে।
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary color */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
            <label className="block text-xs font-bold text-slate-700">প্রাইমারি রঙ (হেডার, ফুটার, ব্যানার)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-14 h-14 rounded-xl border border-slate-300 cursor-pointer bg-white p-1"
                title="Primary color picker"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                pattern="#?[0-9a-fA-F]{6}"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
            <div
              className="h-10 rounded-xl border border-slate-300 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: primaryColor }}
            >
              প্রিভিউ
            </div>
          </div>

          {/* Accent color */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
            <label className="block text-xs font-bold text-slate-700">অ্যাকসেন্ট রঙ (বাটন, হাইলাইট, লোগো বর্ডার)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-14 h-14 rounded-xl border border-slate-300 cursor-pointer bg-white p-1"
                title="Accent color picker"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                pattern="#?[0-9a-fA-F]{6}"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>
            <div
              className="h-10 rounded-xl border border-slate-300 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: accentColor }}
            >
              প্রিভিউ
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-600">রেডিমেড থিম প্রিসেট:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setPrimaryColor(p.primary);
                  setAccentColor(p.accent);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 hover:border-emerald-700 bg-white text-[11px] font-bold text-slate-700 transition-all"
              >
                <span className="flex -space-x-1">
                  <span className="w-5 h-5 rounded-full border border-white" style={{ backgroundColor: p.primary }} />
                  <span className="w-5 h-5 rounded-full border border-white" style={{ backgroundColor: p.accent }} />
                </span>
                {p.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPrimaryColor('#1B3022');
                setAccentColor('#B38B4D');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:border-red-400 bg-white text-[11px] font-bold text-slate-500 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> ডিফল্টে ফিরে যান
            </button>
          </div>
        </div>
      </div>

      {/* ================= MAIN SETTINGS FORM ================= */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-6">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" /> সংস্থা ও অফিশিয়াল তথ্য সেটিংস
        </h3>

        {msg && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 font-bold text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identity */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">পরিচয় (Identity)</legend>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">সংস্থার নাম (বাংলা)</label>
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Organization Name (English)</label>
              <input type="text" value={orgNameEn} onChange={(e) => setOrgNameEn(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ট্যাগলাইন</label>
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">লোগো আপলোড (নতুন)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">লোগো URL</label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">প্রতিষ্ঠা বছর</label>
              <input
                type="number"
                value={establishedYear}
                onChange={(e) => setEstablishedYear(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </fieldset>

          {/* Contact */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">যোগাযোগ (Contact)</legend>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">প্রধান কার্যালয়ের ঠিকানা (বাংলা)</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Head Office Address (English)</label>
              <input type="text" value={addressEn} onChange={(e) => setAddressEn(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ফোন নম্বরসমূহ (কমা দিয়ে)</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ইমেইল ঠিকানা</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">অফিস সময় (বাংলা)</label>
                <input type="text" value={officeHours} onChange={(e) => setOfficeHours(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Office Hours (English)</label>
                <input type="text" value={officeHoursEn} onChange={(e) => setOfficeHoursEn(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">জরুরি হটলাইন</label>
                <input type="text" value={emergencyHotline} onChange={(e) => setEmergencyHotline(e.target.value)} className={inputCls} />
              </div>
              <div />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">হেডার লোকেশন (বাংলা)</label>
                <input type="text" value={headerLocationBn} onChange={(e) => setHeaderLocationBn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Header Location (English)</label>
                <input type="text" value={headerLocationEn} onChange={(e) => setHeaderLocationEn(e.target.value)} className={inputCls} />
              </div>
            </div>
          </fieldset>

          {/* Map */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">ম্যাপ অবস্থান (Map)</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Map Latitude</label>
                <input type="number" step="any" value={mapLat} onChange={(e) => setMapLat(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Map Longitude</label>
                <input type="number" step="any" value={mapLng} onChange={(e) => setMapLng(e.target.value)} className={inputCls} />
              </div>
            </div>
          </fieldset>

          {/* Branches */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">শাখা কার্যালয়সমূহ (Branches)</legend>
            {branches.map((branch, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="শাখার নাম"
                    value={branch.name}
                    onChange={(e) => updateBranch(idx, 'name', e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    placeholder="ঠিকানা"
                    value={branch.address}
                    onChange={(e) => updateBranch(idx, 'address', e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    placeholder="ফোন"
                    value={branch.phone}
                    onChange={(e) => updateBranch(idx, 'phone', e.target.value)}
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ইমেইল"
                      value={branch.email}
                      onChange={(e) => updateBranch(idx, 'email', e.target.value)}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setBranches((prev) => prev.filter((_, i) => i !== idx))}
                      className="px-3 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      title="শাখা মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBranches((prev) => [...prev, { name: '', address: '', phone: '', email: '' }])}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-950 text-amber-400 font-bold text-xs uppercase"
            >
              <Plus className="w-4 h-4" /> নতুন শাখা যোগ করুন
            </button>
          </fieldset>

          {/* Social */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">সোশ্যাল মিডিয়া লিংক</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(social) as (keyof typeof social)[]).map((key) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-700 mb-1 capitalize">{key}</label>
                  <input
                    type="url"
                    value={social[key]}
                    onChange={(e) => setSocial((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          {/* Footer text */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">ফুটার টেক্সট</legend>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ফুটার পরিচিতি (বাংলা)</label>
              <textarea rows={2} value={footerAboutBn} onChange={(e) => setFooterAboutBn(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Footer About (English)</label>
              <textarea rows={2} value={footerAboutEn} onChange={(e) => setFooterAboutEn(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">কপিরাইট টেক্সট (বাংলা)</label>
                <input type="text" value={footerCopyrightBn} onChange={(e) => setFooterCopyrightBn(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Copyright Text (English)</label>
                <input type="text" value={footerCopyrightEn} onChange={(e) => setFooterCopyrightEn(e.target.value)} className={inputCls} />
              </div>
            </div>
          </fieldset>

          {/* Registration */}
          <fieldset className="space-y-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500">নিবন্ধন (Registration)</legend>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">রাজিস্ট্রেশন নম্বর / অনুমোদন</label>
              <textarea rows={2} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputCls} />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            <Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'পরিবর্তনসমূহ সেভ করুন'}
          </button>
        </form>
      </div>
    </div>
  );
};
