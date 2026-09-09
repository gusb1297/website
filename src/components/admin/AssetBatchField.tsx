import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Images, LoaderCircle, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AssetValue,
  StoredAsset,
  UPLOAD_SPECS,
  discardAsset,
  formatBytes,
  markQueuedUploads,
  uploadFile,
  validateFile,
} from '../../lib/upload';

type ItemState = 'queued' | 'uploading' | 'done' | 'error';

interface BatchItem {
  key: string;
  file: File;
  preview: string;
  progress: number;
  state: ItemState;
  asset?: StoredAsset;
  error?: string;
}

export interface AssetBatchFieldProps {
  /** Cloudinary sub folder, e.g. `gallery`. */
  folder?: string;
  /** Called with every asset that finished uploading (in selection order). */
  onChange: (assets: AssetValue[]) => void;
  max?: number;
  disabled?: boolean;
  /** Bump to empty the staging grid (e.g. right after the album was created). */
  resetKey?: string | number;
}

const IMAGE_SPEC = UPLOAD_SPECS.image;
const CONCURRENCY = 3;

/**
 * Multi-picture staging area used by the photo gallery.
 *
 * Every chosen file is uploaded to Cloudinary straight away — each tile shows
 * its own progress, a green tick when it is stored, or a red tile with the reason
 * it was refused. Nothing is queued "inside the browser" waiting for a submit
 * that may never happen, which is how the previous version lost pictures.
 */
export const AssetBatchField: React.FC<AssetBatchFieldProps> = ({
  folder = 'gallery',
  onChange,
  max = 20,
  disabled = false,
  resetKey,
}) => {
  const { token } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<BatchItem[]>([]);
  const aborters = useRef(new Map<string, () => void>());
  const [items, setItems] = useState<BatchItem[]>([]);
  const [dragging, setDragging] = useState(false);

  const publish = useCallback(
    (next: BatchItem[]) => {
      onChange(next.filter((item) => item.state === 'done' && item.asset).map((item) => item.asset!));
    },
    [onChange]
  );

  // The parent is updated from an effect, never from inside a state updater:
  // React runs updaters twice in development and only the committed list may
  // ever reach the form.
  useEffect(() => {
    itemsRef.current = items;
    publish(items);
  }, [items, publish]);

  const patch = useCallback((key: string, changes: Partial<BatchItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }, []);

  // Reset after a successful save: the parent owns the pictures from now on.
  useEffect(() => {
    markQueuedUploads(-itemsRef.current.filter((item) => item.state === 'queued').length);
    setItems([]);
    aborters.current.forEach((abort) => abort());
    aborters.current.clear();
  }, [resetKey]);

  useEffect(
    () => () => {
      markQueuedUploads(-itemsRef.current.filter((item) => item.state === 'queued').length);
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    },
    []
  );

  const runUpload = useCallback(
    async (queue: BatchItem[]) => {
      let cursor = 0;
      let ok = 0;
      let failed = 0;
      let firstError: string | null = null;
      const worker = async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          // It leaves the queue the moment its own request starts.
          markQueuedUploads(-1);
          patch(item.key, { state: 'uploading', progress: 1 });
          const task = uploadFile({
            file: item.file,
            kind: 'image',
            folder,
            token,
            onProgress: (progress) => patch(item.key, { progress }),
          });
          aborters.current.set(item.key, task.abort);
          try {
            const asset = await task.promise;
            patch(item.key, { state: 'done', progress: 100, asset });
            ok += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'আপলোড ব্যর্থ হয়েছে।';
            patch(item.key, { state: 'error', progress: 0, error: message });
            failed += 1;
            if (!firstError) firstError = message;
          } finally {
            aborters.current.delete(item.key);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

      // Counted from the requests themselves: the list may still be mid-render
      // when the last upload settles, and a stale tally would hide a failure.
      if (ok) {
        toast.success({
          title: `${ok}টি ছবি Cloudinary-তে আপলোড হয়েছে`,
          description: 'এখন ফর্মটি সেভ করলেই অ্যালবামে যুক্ত হয়ে যাবে।',
        });
      }
      if (failed) {
        toast.error({
          title: `${failed}টি ছবি আপলোড হয়নি`,
          description: firstError || 'লাল টাইলটিতে কারণ লেখা আছে।',
        });
      }
    },
    [folder, patch, toast, token]
  );

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const incoming = Array.from(fileList);
      const errors: string[] = [];
      const room = Math.max(0, max - items.length);
      const accepted: BatchItem[] = [];

      incoming.forEach((file) => {
        const invalid = validateFile(file, 'image');
        if (invalid) {
          errors.push(invalid);
          return;
        }
        if (accepted.length >= room) {
          errors.push(`একবারে সর্বোচ্চ ${max}টি ছবি নেওয়া যাবে।`);
          return;
        }
        accepted.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${accepted.length}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          preview: URL.createObjectURL(file),
          progress: 0,
          state: 'queued',
        });
      });

      if (errors.length) toast.error({ title: 'কিছু ফাইল নেওয়া যায়নি', description: errors[0] });
      if (!accepted.length) return;

      markQueuedUploads(accepted.length);
      setItems((current) => [...current, ...accepted]);
      void runUpload(accepted);
    },
    [max, runUpload, toast]
  );

  const removeItem = (item: BatchItem) => {
    if (item.state === 'queued') markQueuedUploads(-1);
    aborters.current.get(item.key)?.();
    aborters.current.delete(item.key);
    URL.revokeObjectURL(item.preview);
    // Uploaded but abandoned here → it was never saved into a record, so free it.
    if (item.state === 'done' && item.asset) void discardAsset(item.asset, token);
    setItems((current) => current.filter((entry) => entry.key !== item.key));
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const inFlight = items.filter((item) => item.state === 'uploading' || item.state === 'queued').length;
  const doneCount = items.filter((item) => item.state === 'done').length;

  return (
    <div className="min-w-0 space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_SPEC.accept}
        multiple
        className="sr-only"
        disabled={disabled}
        aria-label="ছবি নির্বাচন করুন"
        onChange={(event) => {
          addFiles(event.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`upload-dropzone select-none rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging ? 'is-dragging' : ''
        } ${disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-emerald-700 hover:bg-emerald-50/40'}`}
      >
        <UploadAreaIcon inFlight={inFlight > 0} />
        <p className="text-sm font-bold text-slate-800">ছবি এখানে টেনে আনুন</p>
        <p className="mt-1 text-xs text-slate-500">বাছাই করার সাথে সাথেই Cloudinary-তে আপলোড শুরু হবে</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-emerald-900 shadow-sm ring-1 ring-slate-300">
          <Images className="h-3.5 w-3.5" /> ছবি নির্বাচন করুন
        </span>
        <p className="mt-2 text-[11px] text-slate-400">
          JPG, PNG, WEBP, AVIF · প্রতি ছবি সর্বোচ্চ {IMAGE_SPEC.maxMb} MB · একবারে সর্বোচ্চ {max}টি
        </p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.key}
              className={`group relative min-w-0 overflow-hidden rounded-xl border bg-white ${
                item.state === 'error' ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            >
              <img src={item.preview} alt={item.file.name} className="aspect-square w-full object-cover" decoding="async" />

              {item.state === 'uploading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900/55 px-2 text-white">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <div className="h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-white/30">
                    <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${item.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-bold">{item.progress}%</span>
                </div>
              )}
              {item.state === 'queued' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] font-bold text-slate-600">
                  অপেক্ষমাণ…
                </div>
              )}
              {item.state === 'done' && (
                <div className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-700/95 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <CheckCircle2 className="h-2.5 w-2.5" /> আপলোড
                </div>
              )}
              {item.state === 'error' && (
                <div className="absolute inset-x-0 bottom-0 flex items-start gap-1 bg-red-600/95 px-1.5 py-1 text-[9px] font-bold leading-tight text-white">
                  <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                  <span className="line-clamp-2">{item.error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => removeItem(item)}
                className="absolute right-1.5 top-1.5 rounded-full bg-slate-950/80 p-1.5 text-white shadow transition hover:bg-red-600"
                title={item.state === 'done' ? 'ছবিটি সরান (Cloudinary থেকেও মুছে যাবে)' : 'বাতিল করুন'}
                aria-label={`${item.file.name} সরান`}
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <p className="truncate px-2 py-1.5 text-[10px] font-medium text-slate-600" title={item.file.name}>
                {item.file.name}
                {item.asset?.bytes ? ` · ${formatBytes(item.asset.bytes)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {doneCount > 0 && (
        <p className="text-[11px] font-semibold text-emerald-800">
          {doneCount}টি ছবি প্রস্তুত{inFlight ? ` · ${inFlight}টি আপলোড হচ্ছে` : ''}
        </p>
      )}
    </div>
  );
};

const UploadAreaIcon: React.FC<{ inFlight: boolean }> = ({ inFlight }) =>
  inFlight ? (
    <LoaderCircle className="mx-auto mb-2 h-8 w-8 animate-spin text-emerald-800" />
  ) : (
    <UploadCloud className="mx-auto mb-2 h-8 w-8 text-emerald-800" />
  );

export default AssetBatchField;
