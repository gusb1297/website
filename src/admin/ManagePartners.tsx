import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { AssetField } from '../components/admin/AssetField';
import { useSaveAction } from '../hooks/useSaveAction';
import { useToast } from '../context/ToastContext';
import { uploadQueueSize } from '../lib/upload';
import type { AssetValue } from '../lib/upload';
import { Partner } from '../types';
import { Handshake, Plus, Trash2, Edit3, X, Save } from 'lucide-react';

export const ManagePartners: React.FC = () => {
  const toast = useToast();
  const { saving: creating, run } = useSaveAction();
  const { data: partners, refetch } = useFetch<Partner[]>('/api/partners');

  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoAsset, setLogoAsset] = useState<AssetValue | null>(null);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editLogo, setEditLogo] = useState<AssetValue | null>(null);


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error({ title: 'পার্টনারের নাম লিখুন' });
      return;
    }
    if (!logoAsset?.url && uploadQueueSize() === 0) {
      toast.error({
        title: 'লোগো নির্বাচন করুন',
        description: 'লোগো বেছে নিলেই সেটি সরাসরি Cloudinary-তে আপলোড হয়ে যাবে।',
      });
      return;
    }

    const created = await run<Partner>({
      url: '/api/partners',
      body: { name: name.trim(), websiteUrl: websiteUrl.trim(), logo: logoAsset },
      success: 'পার্টনার যোগ হয়েছে',
      failure: 'পার্টনার সংরক্ষণ করা যায়নি',
    });
    if (!created) return;

    setName('');
    setWebsiteUrl('');
    setLogoAsset(null);
    refetch();
  };


  const startEdit = (partner: Partner) => {
    setEditing(partner);
    setEditName(partner.name);
    setEditUrl(partner.websiteUrl || '');
    setEditLogo(partner.logo ? { url: partner.logo, publicId: partner.logoPublicId } : null);
  };


  const handleSaveEdit = async () => {
    if (!editing) return;
    const saved = await run<Partner>({
      url: `/api/partners/${editing.id}`,
      method: 'PUT',
      body: { name: editName.trim(), websiteUrl: editUrl.trim(), logo: editLogo },
      success: 'পার্টনার আপডেট হয়েছে',
      failure: 'পার্টনার আপডেট করা যায়নি',
    });
    if (!saved) return;
    setEditing(null);
    setEditLogo(null);
    refetch();
  };


  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই পার্টনারটি মুছে ফেলতে চান?')) return;
    const done = await run({
      url: `/api/partners/${id}`,
      method: 'DELETE',
      success: 'পার্টনার মুছে ফেলা হয়েছে',
      failure: 'পার্টনার মুছে ফেলা যায়নি',
    });
    if (done !== null) refetch();
  };

  return (
    <div className="space-y-8">
      {/* Add Partner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" /> নতুন পার্টনার / ডোনার যোগ করুন
        </h3>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পার্টনারের নাম</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: পল্লী কর্ম-সহায়ক ফাউন্ডেশন (PKSF)"
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ওয়েবসাইট URL (ঐচ্ছিক)</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <AssetField
                kind="logo"
                folder="partners"
                label="পার্টনারের লোগো"
                value={logoAsset}
                onChange={setLogoAsset}
              />
            </div>

          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {creating ? 'সেভ হচ্ছে...' : 'পার্টনার যোগ করুন'}
          </button>
        </form>
      </div>

      {/* Partner List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
          <Handshake className="w-5 h-5 text-emerald-800" /> বিদ্যমান পার্টনার ({partners?.length || 0})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(partners || []).map((partner) => (
            <div key={partner.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white rounded-xl border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 p-1">
                  <img src={partner.logo} alt={partner.name} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{partner.name}</h5>
                  {partner.websiteUrl && (
                    <p className="text-[10px] text-emerald-700 truncate">{partner.websiteUrl}</p>
                  )}
                </div>
              </div>

              {editing?.id === partner.id ? (
                <div className="space-y-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="নাম"
                  />
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs border border-slate-300"
                    placeholder="ওয়েবসাইট URL"
                  />
                  <AssetField
                    kind="logo"
                    folder="partners"
                    compact
                    value={editLogo}
                    onChange={setEditLogo}
                  />
<div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold"
                    >
                      <Save className="w-3.5 h-3.5" /> সেভ
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(partner)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold hover:bg-emerald-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> এডিট
                  </button>
                  <button
                    onClick={() => handleDelete(partner.id)}
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
    </div>
  );
};
