import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { SiteSettings } from '../types';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export const ManageSettings: React.FC = () => {
  const { token } = useAuth();
  const { data: settings, refetch } = useFetch<SiteSettings>('/api/settings');

  const [orgName, setOrgName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [emergencyHotline, setEmergencyHotline] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setOfficeHours(settings.officeHours || '');
      setEmergencyHotline(settings.emergencyHotline || '');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgName,
          address,
          phone,
          email,
          officeHours,
          emergencyHotline,
        }),
      });

      if (!res.ok) throw new Error('সেটিংস আপডেট করা যায়নি');

      setMsg('ওয়েবসাইট সেটিংস সফলভাবে সেভ করা হয়েছে!');
      refetch();
    } catch (e) {
      alert('ত্রুটি ঘটেছে');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-6">
      <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
        <Settings className="w-5 h-5 text-amber-500" /> সংস্থা ও অফিশিয়াল তথ্য সেটিংস
      </h3>

      {msg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 font-bold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">সংস্থার নাম (বাংলা)</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">প্রধান কার্যালয়ের ঠিকানা</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ফোন নম্বরসমূহ</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ইমেইল ঠিকানা</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">অফিস সময়</label>
            <input
              type="text"
              value={officeHours}
              onChange={(e) => setOfficeHours(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">জরুরি হটলাইন</label>
            <input
              type="text"
              value={emergencyHotline}
              onChange={(e) => setEmergencyHotline(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
        >
          <Save className="w-4 h-4" /> {saving ? 'সেভ হচ্ছে...' : 'পরিবর্তনসমূহ সেভ করুন'}
        </button>
      </form>
    </div>
  );
};
