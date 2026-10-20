import React, { createContext, useContext, useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

export function Card({
  children,
  className = '',
  flat = false,
  muted = false,
  forest = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  flat?: boolean;
  muted?: boolean;
  forest?: boolean;
  style?: React.CSSProperties;
}) {
  const classes = ['card', flat ? 'card--flat' : '', muted ? 'card--muted' : '', forest ? 'card--forest' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

export function CardHead({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card__head">
      <div>
        <div className="card__title">{title}</div>
        {hint ? <div className="card__hint">{hint}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = 'grey',
  dot = false,
}: {
  children: React.ReactNode;
  tone?: 'green' | 'lime' | 'amber' | 'red' | 'grey';
  dot?: boolean;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  size,
  block,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'lime' | 'ghost' | 'danger';
  size?: 'sm';
  block?: boolean;
}) {
  const classes = ['btn', `btn--${variant}`, size ? `btn--${size}` : '', block ? 'btn--block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`field ${full ? 'form-grid--full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 90 ? 'progress--danger' : clamped >= 75 ? 'progress--warn' : '';
  return (
    <div className={`progress ${tone}`}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  const { t } = useI18n();
  return <div className="loading">{t('common.loading')}</div>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h3>{title}</h3>
          <ModalCloseButton onClose={onClose} />
        </div>
        {children}
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

function ModalCloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.close')}>
      ✕
    </Button>
  );
}

interface ToastContextValue {
  show: (message: string, tone?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const show = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? <div className={`toast ${toast.tone === 'error' ? 'toast--error' : ''}`}>{toast.message}</div> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export function Chart({ data }: { data: Array<{ date: string; count: number; kg: number }> }) {
  const { t } = useI18n();
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <div className="chart">
      {data.map((item) => {
        const day = new Date(item.date);
        return (
          <div className="chart__col" key={item.date}>
            <div className="chart__value">{item.count}</div>
            <div
              className={`chart__bar ${item.count === max ? 'chart__bar--lime' : ''}`}
              style={{ height: `${Math.max(6, (item.count / max) * 128)}px` }}
              title={t('chart.tooltip', { count: item.count, kg: item.kg })}
            />
            <div className="chart__label">{day.getDate()}/{day.getMonth() + 1}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Stat({
  label,
  value,
  foot,
  delta,
  small = false,
}: {
  label: string;
  value: React.ReactNode;
  foot?: React.ReactNode;
  delta?: { text: string; up: boolean };
  small?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className={`kpi__value ${small ? 'kpi__value--small' : ''}`}>{value}</div>
      {delta ? (
        <div className="kpi__foot">
          <span className={`kpi__delta ${delta.up ? 'kpi__delta--up' : 'kpi__delta--down'}`}>{delta.text}</span>
        </div>
      ) : foot ? (
        <div className="kpi__foot">{foot}</div>
      ) : null}
    </div>
  );
}
