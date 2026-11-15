import type { ReactNode } from 'react';
import { errorText, useApp } from '../state';
import { RefreshCWIcon } from './icons/refresh-cw';
import { useIconAnim } from './icons/useIconAnim';

export function Panel({
  children,
  className = '',
  title,
  sub,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="heading">{title}</h2>
            {sub && <p className="kicker mt-1 normal-case tracking-normal">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1 rounded border border-line bg-panel p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded border font-mono uppercase tracking-wider transition-colors ${
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${on ? 'border-cyan bg-cyan-deep text-ink' : 'border-transparent text-mute hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded border transition-colors ${
          checked ? 'border-cyan bg-cyan-deep' : 'border-line-2 bg-panel-2'
        }`}
      >
        <span
          className={`absolute top-1 h-3.5 w-3.5 rounded-sm transition-all ${
            checked ? 'left-6 bg-cyan' : 'left-1 bg-dim'
          }`}
        />
      </button>
      <span className={checked ? 'text-ink' : 'text-mute'}>{label}</span>
    </label>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ErrorBox({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const { t } = useApp();
  const icon = useIconAnim();
  return (
    <div role="alert" className="panel flex flex-col items-start gap-3 border-warn/60 p-4 text-sm">
      <p>
        <span className="mr-2 font-mono text-warn">!</span>
        {errorText(t, code)}
      </p>
      {onRetry && (
        <button
          type="button"
          className="btn flex items-center gap-2"
          {...icon.trigger}
          onClick={() => {
            // Gira mientras se repite la petición (al cargar, este aviso se reemplaza).
            icon.start();
            onRetry();
          }}
        >
          <RefreshCWIcon ref={icon.ref} size={15} aria-hidden="true" className="flex" />
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}

export function StatusIcon({ status, color, size = 14 }: { status: string; color: string; size?: number }) {
  if (status === 'no_data') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="#93a0ad" strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (status === 'insufficient_baseline') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="#93a0ad" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={color} />
    </svg>
  );
}
