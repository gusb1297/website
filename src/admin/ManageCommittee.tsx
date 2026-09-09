import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { AssetField } from '../components/admin/AssetField';
import { useSaveAction } from '../hooks/useSaveAction';
import { useToast } from '../context/ToastContext';
import { uploadQueueSize } from '../lib/upload';
import type { AssetValue } from '../lib/upload';
import { CommitteeMember } from '../types';
import { Users, Plus, Trash2, Edit3, X, Save } from 'lucide-react';

const TYPES = [
  { value: 'executive', label: 'কার্যনির্বাহী পরিষদ (Executive)' },
  { value: 'leadership', label: 'উচ্চতর নেতৃত্ব (Leadership)' },
  { value: 'advisory', label: 'উপদেষ্টা পরিষদ (Advisory)' },
  { value: 'general', label: 'সাধারণ পরিষদ (General)' },
];

export const ManageCommittee: React.FC = () => {
  const toast = useToast();
  const { saving: creating, run } = useSaveAction();
  const { data: members, refetch } = useFetch<CommitteeMember[]>('/api/committee');

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [type, setType] = useState<'general' | 'executive' | 'advisory' | 'leadership'>('executive');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoAsset, setPhotoAsset] = useState<AssetValue | null>(null);

  const [editing, setEditing] = useState<CommitteeMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editType, setEditType] = useState<CommitteeMember['type']>('executive');
  const [editBio, setEditBio] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoto, setEditPhoto] = useState<AssetValue | null>(null);


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !designation.trim()) {
      toast.error({ title: 'নাম ও পদবি লিখুন' });
      return;
    }
    if (!photoAsset?.url && uploadQueueSize() === 0) {
      toast.error({
        title: 'সদস্যের ছবি নির্বাচন করুন',
        description: 'ছবি বেছে নিলেই সেটি সরাসরি Cloudinary-তে আপলোড হয়ে যাবে।',
      });
      return;
    }

    const created = await run<CommitteeMember>({
      url: '/api/committee',
      body: {
        name: name.trim(),
        designation: designation.trim(),
        type,
        bio: bio.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photo: photoAsset,
      },
      success: 'সদস্য যোগ হয়েছে',
      failure: 'সদস্য সংরক্ষণ করা যায়নি',
    });
    if (!created) return;

    setName('');
    setDesignation('');
    setBio('');
    setEmail('');
    setPhone('');
    setPhotoAsset(null);
    refetch();
  };


  const startEdit = (member: CommitteeMember) => {
    setEditing(member);
    setEditName(member.name);
    setEditDesignation(member.designation);
    setEditType(member.type);
    setEditBio(member.bio || '');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditPhoto(member.photo ? { url: member.photo, publicId: member.photoPublicId } : null);
  };


  const handleSaveEdit = async () => {
    if (!editing) return;
    const saved = await run<CommitteeMember>({
      url: `/api/committee/${editing.id}`,
      method: 'PUT',
      body: {
        name: editName.trim(),
        designation: editDesignation.trim(),
        type: editType,
        bio: editBio.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        photo: editPhoto,
      },
      success: 'সদস্যের তথ্য আপডেট হয়েছে',
      failure: 'সদস্য আপডেট করা যায়নি',
    });
    if (!saved) return;
    setEditing(null);
    setEditPhoto(null);
    refetch();
  };


  const handleDelete = async (id: string) => {
    if (!confirm('আপনি কি এই সদস্যটিকে তালিকা থেকে বাদ দিতে চান?')) return;
    const done = await run({
      url: `/api/committee/${id}`,
      method: 'DELETE',
      success: 'সদস্যকে বাদ দেওয়া হয়েছে',
      failure: 'সদস্য বাদ দেওয়া যায়নি',
    });
    if (done !== null) refetch();
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-300';

  return (
    <div className="space-y-8">
      {/* Add Member */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" /> নতুন পরিচালনা পরিষদ সদস্য
        </h3>
        <p className="text-xs text-slate-500">গভর্ন্যান্স পেজে প্রদর্শিত হয়।</p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">নাম</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পদবি</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="যেমন: চেয়ারম্যান, পরিচালনা পর্ষদ"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">বিভাগ</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputCls}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ইমেইল (ঐচ্ছিক)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ফোন (ঐচ্ছিক)</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">সংক্ষিপ্ত জীবনী (Bio)</label>
            <textarea rows={3} required value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <AssetField
                kind="image"
                folder="committee"
                label="সদস্যের ছবি"
                value={photoAsset}
                onChange={setPhotoAsset}
              />
            </div>

          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-amber-400 font-bold text-xs uppercase shadow transition-all"
          >
            {creating ? 'সেভ হচ্ছে...' : 'সদস্য যোগ করুন'}
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg space-y-4">
        <h4 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-800" /> বিদ্যমান সদস্য ({members?.length || 0})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(members || []).map((member) => (
            <div key={member.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shrink-0"
                />
                <div className="min-w-0">
                  <h5 className="font-serif font-bold text-sm text-slate-900 line-clamp-1">{member.name}</h5>
                  <p className="text-[11px] text-amber-700 font-bold line-clamp-1">{member.designation}</p>
                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 inline-block mt-1">
                    {TYPES.find((t) => t.value === member.type)?.label || member.type}
                  </span>
                </div>
              </div>

              {editing?.id === member.id ? (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-emerald-300">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="নাম" />
                  <input type="text" value={editDesignation} onChange={(e) => setEditDesignation(e.target.value)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="পদবি" />
                  <select value={editType} onChange={(e) => setEditType(e.target.value as typeof editType)} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300">
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="ইমেইল" />
                  <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="ফোন" />
                  <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2} className="col-span-2 px-3 py-2 rounded-lg text-xs border border-slate-300" placeholder="জীবনী" />
                  <p className="col-span-2 text-xs text-slate-400">ছবি পরিবর্তনের জন্য নতুন ফাইল আপলোড করুন (ঐচ্ছিক)</p>
                  <AssetField
                    kind="image"
                    folder="committee"
                    compact
                    value={editPhoto}
                    onChange={setEditPhoto}
                  />
<div className="col-span-2 flex gap-2">
                    <button onClick={handleSaveEdit} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-950 text-amber-400 text-xs font-bold">
                      <Save className="w-3.5 h-3.5" /> সেভ
                    </button>
                    <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(member)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold hover:bg-emerald-200 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> এডিট
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
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
