import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SiteSettings } from '../types';

interface SettingsContextType {
  settings: SiteSettings | null;
  loading: boolean;
  refetch: () => void;
  /** Broadcast after the admin panel saves settings (other components refetch). */
  notifySettingsUpdated: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SETTINGS_UPDATED_EVENT = 'site-settings-updated';

/** Convert #rrggbb to an hsl tuple. Returns null on invalid input. */
function hexToHsl(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (sat: number) => {
    const k = (n: number) => (n + h / 30) % 12;
    const f = (n: number) =>
      l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (n: number) =>
      Math.round(255 * n)
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  };
  return a(s / 100);
}

/** Lighten/darken a hex color by a percentage (-100..100). */
function shade(hex: string, percent: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const [h, s, l] = hsl;
  const nextL = Math.max(0, Math.min(100, l + percent));
  return hslToHex(h, s, nextL);
}

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function applyThemeToDocument(theme: { primary?: string; accent?: string } | undefined) {
  const root = document.documentElement;
  if (isValidHex(theme?.primary)) {
    root.style.setProperty('--site-primary', theme!.primary);
  }
  if (isValidHex(theme?.accent)) {
    root.style.setProperty('--site-accent', theme!.accent);
    root.style.setProperty('--site-accent-dark', shade(theme!.accent, -14));
    root.style.setProperty('--site-accent-light', shade(theme!.accent, 18));
  }
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SiteSettings;
      if (!mounted.current) return;
      setSettings(json);
      applyThemeToDocument(json?.theme);
      if (json?.ngoNameEn) {
        document.title = `${json.ngoNameEn} | ${json.ngoTagline || 'NGO'}`;
      }
    } catch (err) {
      console.warn('Failed to load site settings:', err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const onUpdated = () => load();
    window.addEventListener(SETTINGS_UPDATED_EVENT, onUpdated);
    return () => {
      mounted.current = false;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, onUpdated);
    };
  }, [load]);

  const notifySettingsUpdated = useCallback(() => {
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refetch: load, notifySettingsUpdated }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
