import React, { useEffect, useId, useRef, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import './AdminMobileNav.css';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

const primaryLabels: Record<string, string> = {
  slides: 'স্লাইডার',
  gallery: 'গ্যালারি',
  news: 'সংবাদ',
  settings: 'সেটিংস',
};

/** Admin-only phone navigation. The public Navbar keeps its hamburger menu. */
export function AdminMobileNav({ items, activeId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const primary = Object.keys(primaryLabels)
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is NavItem => Boolean(item));
  const secondary = items.filter((item) => !Object.hasOwn(primaryLabels, item.id));

  useEffect(() => setOpen(false), [activeId]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal(); // Native focus trap, Escape support and focus restoration.
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const select = (id: string) => {
    setOpen(false);
    onSelect(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <>
      <nav className="admin-bottom-nav" aria-label="অ্যাডমিন মোবাইল নেভিগেশন" data-testid="admin-bottom-nav">
        <div className="admin-bottom-nav-items">
          {primary.map((item) => (
            <button
              type="button"
              key={item.id}
              className="admin-bottom-nav-button"
              aria-current={item.id === activeId ? 'page' : undefined}
              onClick={() => select(item.id)}
            >
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{primaryLabels[item.id]}</span>
            </button>
          ))}
          <button
            type="button"
            className={`admin-bottom-nav-button ${secondary.some((item) => item.id === activeId) ? 'is-active' : ''}`}
            aria-label="আরও অ্যাডমিন বিভাগ"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            onClick={() => setOpen(true)}
          >
            <span className="admin-nav-icon" aria-hidden="true"><LayoutGrid /></span>
            <span>আরও</span>
          </button>
        </div>
      </nav>

      <dialog
        id={dialogId}
        ref={dialogRef}
        className="admin-mobile-nav-sheet"
        aria-labelledby={`${dialogId}-title`}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <div className="admin-mobile-nav-sheet-content">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={`${dialogId}-title`} className="text-lg font-bold text-emerald-950">অ্যাডমিন বিভাগসমূহ</h2>
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="অ্যাডমিন নেভিগেশন বন্ধ করুন" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {secondary.map((item) => (
              <button
                type="button"
                key={item.id}
                className="admin-mobile-section-button"
                aria-current={item.id === activeId ? 'page' : undefined}
                onClick={() => select(item.id)}
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
