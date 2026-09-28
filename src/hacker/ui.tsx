import React from 'react';
import { Loader2 } from 'lucide-react';

/** Shared interface elements for the professional operations console. */

export type Tone = 'green' | 'cyan' | 'amber' | 'red' | 'muted';

const TONE_TEXT: Record<Tone, string> = {
  green: 'ha-tone-text-success',
  cyan: 'ha-tone-text-info',
  amber: 'ha-tone-text-warning',
  red: 'ha-tone-text-danger',
  muted: 'ha-tone-text-muted',
};

const TONE_SURFACE: Record<Tone, string> = {
  green: 'ha-tone-success',
  cyan: 'ha-tone-info',
  amber: 'ha-tone-warning',
  red: 'ha-tone-danger',
  muted: 'ha-tone-neutral',
};

export const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, children, className = '' }) => (
  <section className={`ha-panel p-4 sm:p-5 ${className}`}>
    {title ? (
      <header className="ha-panel-header mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="ha-panel-title text-sm font-bold">{title}</h2>
          {subtitle ? <p className="ha-panel-subtitle mt-1 text-[11px]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    ) : null}
    {children}
  </section>
);

export const Chip: React.FC<{ label: string; value: string; tone?: Tone; pulse?: boolean }> = ({
  label,
  value,
  tone = 'muted',
}) => (
  <span className={`ha-chip inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] ${TONE_SURFACE[tone]}`}>
    <span className="ha-chip-dot inline-block h-1.5 w-1.5 rounded-full" aria-hidden="true" />
    <span className="ha-chip-label">{label}</span>
    <span className={`font-bold ${TONE_TEXT[tone]}`}>{value}</span>
  </span>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: Tone }> = ({
  label,
  value,
  hint,
  tone = 'green',
}) => (
  <div className={`ha-stat border px-3 py-2.5 ${TONE_SURFACE[tone]}`}>
    <p className="ha-label">{label}</p>
    <p className={`mt-1 truncate text-lg font-bold ${TONE_TEXT[tone]}`}>{value}</p>
    {hint ? <p className="mt-0.5 truncate text-[10px] text-[color:var(--ha-muted)]">{hint}</p> : null}
  </div>
);

export const Row: React.FC<{ label: string; value: React.ReactNode; tone?: Tone }> = ({ label, value, tone = 'green' }) => (
  <div className="ha-row flex items-baseline justify-between gap-3 border-b py-2 last:border-0">
    <span className="ha-row-label text-[10px]">{label}</span>
    <span className={`truncate text-right text-xs font-semibold ${TONE_TEXT[tone]}`}>{value}</span>
  </div>
);

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  tone?: Tone;
  busy?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}> = ({ children, onClick, tone = 'green', busy, disabled, type = 'button', className = '', title }) => (
  <button
    type={type}
    title={title}
    onClick={onClick}
    disabled={disabled || busy}
    className={`ha-button inline-flex items-center justify-center gap-2 border px-3 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${TONE_SURFACE[tone]} ${TONE_TEXT[tone]} ${className}`}
  >
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
    {children}
  </button>
);

/** A clear, accessible switch for high-impact operator controls. */
export const PowerSwitch: React.FC<{
  label: string;
  description: string;
  on: boolean;
  busy?: boolean;
  onText: string;
  offText: string;
  danger?: boolean;
  onToggle: (next: boolean) => void;
}> = ({ label, description, on, busy, onText, offText, danger, onToggle }) => {
  const activeTone = on ? (danger ? 'red' : 'green') : 'muted';
  return (
    <div className={`ha-switch-card border p-4 ${TONE_SURFACE[activeTone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ha-switch-title text-xs font-bold">{label}</p>
          <p className="ha-switch-description mt-1 max-w-md text-[11px] leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`ha-switch-state text-xs font-bold ${TONE_TEXT[activeTone]}`}>
            {on ? onText : offText}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${label}: ${on ? onText : offText}`}
            disabled={busy}
            onClick={() => onToggle(!on)}
            className={`ha-switch relative h-7 w-12 shrink-0 border transition disabled:opacity-50 ${
              on ? (danger ? 'is-on is-danger' : 'is-on') : ''
            }`}
          >
            <span className={`ha-switch-thumb absolute top-0.5 h-5 w-5 transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
            {busy ? <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}> = ({ label, children, hint, className = '' }) => (
  <label className={`ha-field block ${className}`}>
    <span className="ha-field-label mb-1.5 block">{label}</span>
    {children}
    {hint ? <span className="ha-field-hint mt-1 block text-[10px]">{hint}</span> : null}
  </label>
);

export const inputClass = 'ha-control w-full border px-3 py-2 text-xs outline-none transition placeholder:text-[color:var(--ha-muted)]';

export const Notice: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'muted', children }) => (
  <div className={`ha-notice border px-3 py-2 text-[11px] leading-relaxed ${TONE_SURFACE[tone]}`}>{children}</div>
);
