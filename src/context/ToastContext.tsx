import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, X, XCircle } from 'lucide-react';

/**
 * Tiny toast system for the admin panel (and the public CV form).
 *
 * Everything the admin does — picking a photo, uploading a video, saving an
 * album — now answers back immediately: a spinner while bytes travel to
 * Cloudinary, then a green "হয়েছে" or a red toast that literally explains why it
 * failed. Previously a file could be selected with no reaction at all, which is
 * exactly what made uploads look broken.
 */

export type ToastKind = 'success' | 'error' | 'info' | 'loading';

export interface ToastInput {
  title: string;
  /** Secondary line — usually the server's own explanation. */
  description?: string;
  /** Milliseconds until auto dismiss. `0` keeps it until it is closed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastInput {
  id: number;
  kind: ToastKind;
}

interface ToastApi {
  push: (kind: ToastKind, input: ToastInput) => number;
  success: (input: ToastInput | string) => number;
  error: (input: ToastInput | string) => number;
  info: (input: ToastInput | string) => number;
  /** Shows a spinner toast and returns a handle to update/dismiss it. */
  loading: (input: ToastInput | string) => { id: number; update: (kind: ToastKind, next: ToastInput) => void };
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 4500,
  info: 5000,
  loading: 0,
  error: 9000,
};

const toInput = (input: ToastInput | string): ToastInput =>
  typeof input === 'string' ? { title: input } : input;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback(
    (id: number, kind: ToastKind, duration?: number) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.delete(id);
      const ms = duration ?? DEFAULT_DURATION[kind];
      if (ms > 0) timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss]
  );

  const push = useCallback(
    (kind: ToastKind, input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, kind, ...input }]);
      schedule(id, kind, input.duration);
      return id;
    },
    [schedule]
  );

  const update = useCallback(
    (id: number, kind: ToastKind, input: ToastInput) => {
      setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, kind, ...input } : toast)));
      schedule(id, kind, input.duration);
    },
    [schedule]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (input) => push('success', toInput(input)),
      error: (input) => push('error', toInput(input)),
      info: (input) => push('info', toInput(input)),
      loading: (input) => {
        const id = push('loading', toInput(input));
        return {
          id,
          update: (kind, next) => update(id, kind, next),
        };
      },
    }),
    [push, update, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

const ToastViewport: React.FC<{ toasts: ToastItem[]; onDismiss: (id: number) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-20 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
      role="region"
      aria-label="নোটিফিকেশন"
    >
      <div className="sr-only" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <p key={toast.id}>{`${toast.title} ${toast.description || ''}`}</p>
        ))}
      </div>

      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const TONE: Record<ToastKind, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
  },
  error: {
    wrap: 'border-red-300 bg-red-50 text-red-950',
    icon: <XCircle className="h-5 w-5 shrink-0 text-red-600" />,
  },
  info: {
    wrap: 'border-slate-300 bg-white text-slate-900',
    icon: <Info className="h-5 w-5 shrink-0 text-slate-500" />,
  },
  loading: {
    wrap: 'border-amber-300 bg-amber-50 text-amber-950',
    icon: <LoaderCircle className="h-5 w-5 shrink-0 animate-spin" />,
  },
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const tone = TONE[toast.kind];
  return (
    <div
      className={`toast-card pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ring-1 ring-black/5 ${tone.wrap}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="mt-0.5">{toast.kind === 'error' && toast.description ? <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" /> : tone.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug">{toast.title}</p>
        {toast.description && <p className="mt-1 break-words text-xs leading-relaxed opacity-90">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 rounded-lg bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-900"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 shrink-0 rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
        aria-label="বন্ধ করুন"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

/** Never throws outside a provider — public pages may render before it is mounted. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (context) return context;
  return {
    push: () => 0,
    success: () => 0,
    error: () => 0,
    info: () => 0,
    loading: () => ({ id: 0, update: () => undefined }),
    dismiss: () => undefined,
  };
}
