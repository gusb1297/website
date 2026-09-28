import React from 'react';
import { Loader2 } from 'lucide-react';

/** Small building blocks shared by every console module (dark terminal look). */

export type Tone = 'green' | 'cyan' | 'amber' | 'red' | 'muted';

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-[color:var(--ha-green)]',
  cyan: 'text-[color:var(--ha-cyan)]',
  amber: 'text-[color:var(--ha-amber)]',
  red: 'text-[color:var(--ha-red)]',
  muted: 'text-[color:var(--ha-muted)]',
};

const TONE_BORDER: Record<Tone, string> = {
  green: 'border-[color:var(--ha-line-strong)] bg-[rgba(57,255,158,0.08)]',
  cyan: 'border-[rgba(55,224,255,0.4)] bg-[rgba(55,224,255,0.08)]',
  amber: 'border-[rgba(255,181,69,0.4)] bg-[rgba(255,181,69,0.08)]',
  red: 'border-[rgba(255,77,94,0.45)] bg-[rgba(255,77,94,0.1)]',
  muted: 'border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.02)]',
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
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--ha-green)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-[11px] text-[color:var(--ha-muted)]">{subtitle}</p> : null}
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
  pulse,
}) => (
  <span className={`inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${TONE_BORDER[tone]}`}>
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? 'ha-dot-live' : ''}`} style={{ background: 'currentColor' }} />
    <span className="text-[color:var(--ha-muted)]">{label}</span>
    <span className={`font-bold ${TONE_TEXT[tone]}`}>{value}</span>
  </span>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: Tone }> = ({
  label,
  value,
  hint,
  tone = 'green',
}) => (
  <div className={`border px-3 py-2.5 ${TONE_BORDER[tone]}`}>
    <p className="ha-label">{label}</p>
    <p className={`mt-1 truncate text-lg font-bold ${TONE_TEXT[tone]}`}>{value}</p>
    {hint ? <p className="mt-0.5 truncate text-[10px] text-[color:var(--ha-muted)]">{hint}</p> : null}
  </div>
);

export const Row: React.FC<{ label: string; value: React.ReactNode; tone?: Tone }> = ({ label, value, tone = 'green' }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--ha-line)] py-2 last:border-0">
    <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ha-muted)]">{label}</span>
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
    className={`inline-flex items-center justify-center gap-2 border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45 ${TONE_BORDER[tone]} ${TONE_TEXT[tone]} hover:brightness-125 ${className}`}
  >
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
    {children}
  </button>
);

/**
 * A big physical-feeling switch. Used for the two operator toggles (database and
 * write freeze) where the state must be readable at a glance.
 */
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
    <div className={`border p-4 ${TONE_BORDER[activeTone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ha-text)]">{label}</p>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-[color:var(--ha-muted)]">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold uppercase tracking-[0.2em] ${TONE_TEXT[activeTone]}`}>
            {on ? onText : offText}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={() => onToggle(!on)}
            className={`relative h-8 w-16 shrink-0 border transition disabled:opacity-50 ${
              on
                ? danger
                  ? 'border-[rgba(255,77,94,0.6)] bg-[rgba(255,77,94,0.22)]'
                  : 'border-[color:var(--ha-green)] bg-[rgba(57,255,158,0.22)]'
                : 'border-[color:var(--ha-line)] bg-[rgba(255,255,255,0.04)]'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 transition-all ${
                on ? 'left-9' : 'left-1'
              } ${on ? (danger ? 'bg-[color:var(--ha-red)]' : 'bg-[color:var(--ha-green)]') : 'bg-[color:var(--ha-muted)]'}`}
            />
            {busy ? <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" /> : null}
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
  <label className={`block ${className}`}>
    <span className="ha-label mb-1 block">{label}</span>
    {children}
    {hint ? <span className="mt-1 block text-[10px] text-[color:var(--ha-muted)]">{hint}</span> : null}
  </label>
);

export const inputClass =
  'w-full border border-[color:var(--ha-line)] bg-[rgba(4,10,8,0.85)] px-3 py-2 text-xs text-[color:var(--ha-text)] outline-none transition placeholder:text-[color:var(--ha-muted)] focus:border-[color:var(--ha-green)]';

export const Notice: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'muted', children }) => (
  <div className={`border px-3 py-2 text-[11px] leading-relaxed ${TONE_BORDER[tone]}`}>{children}</div>
);
