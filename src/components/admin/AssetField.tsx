import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Film,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AssetKind,
  AssetValue,
  StoredAsset,
  UPLOAD_SPECS,
  discardAsset,
  formatBytes,
  uploadFile,
  validateFile,
  UploadError,
  UploadTask,
} from '../../lib/upload';

/**
 * The one and only file input of the admin panel.
 *
 * Selecting (or dropping) a file starts the Cloudinary upload *immediately*:
 * the field shows byte progress, then a preview plus a toast that says what
 * happened — including the exact reason when an upload is refused. The parent
 * form only ever receives `{ url, publicId, … }`, so "saving" a record never
 * silently drops a picture the admin already picked.
 */
export interface AssetFieldProps {
  kind: AssetKind;
  /** Sub folder inside the Cloudinary media library, e.g. `hero`. */
  folder?: string;
  value?: AssetValue | null;
  onChange: (asset: AssetValue | null) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

type Status = 'idle' | 'uploading' | 'error';

export const AssetField: React.FC<AssetFieldProps> = ({
  kind,
  folder,
  value,
  onChange,
  label,
  hint,
  required = false,
  disabled = false,
  compact = false,
  className = '',
}) => {
  const { token, handleAuthError } = useAuth();
  const toast = useToast();
  const spec = UPLOAD_SPECS[kind];

  const inputRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<UploadTask | null>(null);
  const previewRef = useRef<string | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const hasValue = Boolean(value?.url);

  const clearPending = useCallback(() => {
    taskRef.current = null;
    setPending(null);
    setStatus('idle');
    setProgress(0);
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setLocalPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // The form replaced / cleared the value from the outside (edit panel closed,
  // record saved, …) — drop whatever the field was showing.
  useEffect(() => {
    setError(null);
    if (!value?.url && status !== 'uploading') clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.url, value?.publicId]);

  useEffect(() => () => clearPending(), [clearPending]);

  const startUpload = useCallback(
    (file: File) => {
      if (disabled) return;
      const invalid = validateFile(file, kind);
      if (invalid) {
        setError(invalid);
        toast.error({ title: 'ফাইলটি নেওয়া যাবে না', description: invalid });
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      const objectUrl = file.type.startsWith('video/') || file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      previewRef.current = objectUrl;
      setLocalPreview(objectUrl);
      setPending(file);
      setError(null);
      setProgress(0);
      setStatus('uploading');

      const task = uploadFile({
        file,
        kind,
        folder,
        token,
        onProgress: (percent) => setProgress(percent),
      });
      taskRef.current = task;

      task.promise
        .then((asset: StoredAsset) => {
          onChange(asset);
          setProgress(100);
          clearPending();
          toast.success({
            title: `${spec.label} আপলোড হয়েছে`,
            description: `${file.name}${asset.bytes ? ` · ${formatBytes(asset.bytes)}` : ''} → Cloudinary`,
          });
        })
        .catch((err: UploadError) => {
          // Cancelled by the admin — that is not an error worth a toast.
          if (err.name === 'AbortError' || err.message === 'আপলোড বাতিল করা হয়েছে।') {
            clearPending();
            return;
          }
          clearPending();
          setStatus('error');
          setError(err.message);
          // A dead session is handled by the shell (redirect to login).
          if (handleAuthError(err.status, err.message)) return;
          toast.error({ title: 'আপলোড ব্যর্থ', description: err.message });
        });
    },
    [clearPending, disabled, folder, handleAuthError, kind, onChange, spec.label, toast]
  );

  const openPicker = () => {
    if (disabled || status === 'uploading') return;
    inputRef.current?.click();
  };

  const acceptProps = { accept: spec.accept };

  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        {...acceptProps}
        className="sr-only"
        disabled={disabled}
        aria-label={label || spec.label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) startUpload(file);
        }}
      />

      {hasValue && status !== 'uploading' ? (
        <AssetPreview asset={value!} kind={kind} fallbackName={pending?.name} />
      ) : status === 'uploading' && pending ? (
        <div className={`rounded-2xl border border-emerald-200 bg-emerald-50/60 ${compact ? 'p-3' : 'p-4'}`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-emerald-200">
              {localPreview && kind !== 'video' ? (
                <img src={localPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <LoaderCircle className="h-5 w-5 animate-spin text-emerald-700" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">{pending.name}</p>
              <p className="text-[11px] text-emerald-800">
                {progress < 100 ? `আপলোড হচ্ছে… ${progress}%` : 'Cloudinary যাচাই করছে…'}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-[width] duration-200"
                  style={{ width: `${Math.max(6, progress)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                taskRef.current?.abort();
                clearPending();
              }}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-red-600"
              aria-label="আপলোড বাতিল করুন"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
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
            const file = event.dataTransfer.files?.[0];
            if (file) startUpload(file);
          }}
          className={`upload-dropzone select-none rounded-2xl border-2 border-dashed text-center transition ${
            dragging ? 'is-dragging' : ''
          } ${compact ? 'px-3 py-4' : 'px-4 py-6'} ${
            disabled
              ? 'pointer-events-none opacity-60'
              : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-emerald-700 hover:bg-emerald-50/40'
          } ${status === 'error' ? 'border-red-300 bg-red-50/50' : ''}`}
        >
          <UploadCloud className={`mx-auto mb-1.5 text-emerald-800 ${compact ? 'h-6 w-6' : 'h-7 w-7'}`} />
          <p className={`font-bold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
            {spec.label} বেছে নিন অথবা এখানে টেনে আনুন
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {hint || `${spec.extensions.map((item) => item.toUpperCase()).join(', ')} · সর্বোচ্চ ${spec.maxMb} MB`}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-900 shadow-sm ring-1 ring-slate-300">
            <UploadCloud className="h-3.5 w-3.5" /> ফাইল নির্বাচন
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
          <span className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">{error}</span>
          </span>
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3" /> আবার চেষ্টা
          </button>
        </div>
      )}

      {hasValue && !disabled && (
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 font-bold text-emerald-900 transition hover:bg-emerald-200"
          >
            <RefreshCw className="h-3 w-3" /> পরিবর্তন করুন
          </button>
          <button
            type="button"
            onClick={() => {
              if (value?.pending) void discardAsset(value, token);
              onChange(null);
              clearPending();
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 font-bold text-red-700 transition hover:bg-red-200"
          >
            <Trash2 className="h-3 w-3" /> সরান
          </button>
        </div>
      )}
    </div>
  );
};

/** Uploaded state: thumbnail / video / document chip with a "stored in cloud" note. */
const AssetPreview: React.FC<{ asset: AssetValue; kind: AssetKind; fallbackName?: string }> = ({
  asset,
  kind,
  fallbackName,
}) => {
  const src = asset.url;
  const name = asset.originalName || fallbackName || 'ফাইল';
  const isImage = kind === 'image' || kind === 'logo';
  const isVideo = kind === 'video';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
        {isImage && src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={asset.thumbnailUrl || src} poster={asset.thumbnailUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          <FileText className="h-6 w-6 text-slate-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-800" title={name}>
          {name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          {asset.bytes ? <span>{formatBytes(asset.bytes)}</span> : null}
          {asset.duration ? (
            <span className="inline-flex items-center gap-1">
              <Film className="h-3 w-3" /> {Math.round(asset.duration)}s
            </span>
          ) : null}
          {asset.width && asset.height ? <span>{`${asset.width}×${asset.height}`}</span> : null}
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Cloudinary
          </span>
        </p>
      </div>
      {isVideo && src ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-900"
          title="ভিডিও দেখুন"
          aria-label="ভিডিও দেখুন"
        >
          <Play className="h-4 w-4" />
        </a>
      ) : src ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-900"
          title="নতুন ট্যাবে খুলুন"
          aria-label="নতুন ট্যাবে খুলুন"
        >
          <FileText className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
};

export default AssetField;
