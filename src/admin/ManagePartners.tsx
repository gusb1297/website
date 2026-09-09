import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useFileInput } from '../hooks/useFileInput';
import { useAuth } from '../context/AuthContext';
import { Partner } from '../types';
import { Handshake, Plus, Trash2, Edit3, X, Save } from 'lucide-react';
import { readApiError } from '../utils/api';

export const ManagePartners: React.FC = () => {
  const { token } = useAuth();
  const { data: partners, refetch } = useFetch<Partner[]>('/api/partners');

  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const logoInput = useFileInput();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const editLogoInput = useFileInput();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read the file at submit time (state, falling back to the input itself)
    // so the FormData always carries the file the browser is showing.
    const logoFile = logoInput.getFile();
    if (!logoFile) {
      alert('পার্টনারের লোগো নির্বাচন করুন।');
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('websiteUrl', websiteUrl);
      // Field name must match `upload.single('logo')` on the server.
      formData.append('logo', logoFile, logoFile.name);
      const res = await fetch('/api/partners', {
        method: 'POST',
        // No Content-Type here: the browser sets multipart/form-data with the boundary.
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'পার্টনার যোগ করা যায়নি'));
      setName('');
      setWebsiteUrl('');
      // Clears the native input too, so the next partner cannot show a stale file.
      logoInput.reset();
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ত্রুটি ঘটেছে');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (partner: Partner) => {
    setEditing(partner);
    setEditName(partner.name);
    setEditUrl(partner.websiteUrl || '');
    editLogoInput.reset();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const formData = new FormData();
      formData.append('name', editName);
      formData.append('websiteUrl', editUrl);
      const editLogoFile = editLogoInput.getFile();
      if (editLogoFile) {
        formData.append('logo', editLogoFile, editLogoFile.name);
      }
      const res = await fetch(`/api/partners/${editing.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'পার্টনার আপডেট করা যায়নি'));
      setEditing(null);
      editLogoInput.reset();
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ত্রুটি ঘটেছে');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই পার্টনারটি মুছে ফেলতে চান?')) return;
    try {
      await fetch(`/api/partners/${id}`, {
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
              <label className="block text-xs font-bold text-slate-700 mb-1">লোগো আপলোড (Direct Upload)</label>
              <input
                ref={logoInput.inputRef}
                type="file"
                name="logo"
                required
                accept="image/*"
                onChange={logoInput.onChange}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-300"
              />
              {logoInput.file && (
                <p className="mt-1 truncate text-[10px] text-emerald-700">নির্বাচিত: {logoInput.file.name}</p>
              )}
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
                  <input
                    ref={editLogoInput.inputRef}
                    type="file"
                    name="logo"
                    accept="image/*"
                    onChange={editLogoInput.onChange}
                    className="w-full px-2 py-1 text-[10px] border border-dashed border-slate-300 rounded-lg"
                    title="নতুন লোগো আপলোড করুন (ঐচ্ছিক)"
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
