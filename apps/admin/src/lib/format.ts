import type { Locale } from './i18n';

/**
 * Locale used by the date formatters. The i18n provider keeps this in sync with
 * the active UI locale so pages do not need to pass a locale to every call.
 */
let currentLocale: Locale = 'zh-Hant';

const DATE_LOCALES: Record<Locale, string> = {
  'zh-Hant': 'zh-TW',
  en: 'en-US',
};

export function setFormatLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getFormatLocale(): Locale {
  return currentLocale;
}

export function brl(cents: number): string {
  const value = Math.abs(cents) / 100;
  const fixed = value.toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${cents < 0 ? '-' : ''}${grouped},${dec}`;
}

export function compact(cents: number): string {
  const value = cents / 100;
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return brl(cents);
}

export function num(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function pct(value: number, decimals = 1): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

export function date(iso: string, locale: Locale = currentLocale): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALES[locale], { day: '2-digit', month: 'short' });
}

export function dateTime(iso: string, locale: Locale = currentLocale): string {
  return new Date(iso).toLocaleString(DATE_LOCALES[locale], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function maskKey(key: string): string {
  if (key.includes('@')) {
    const [user, domain] = key.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return key.length > 6 ? `${key.slice(0, 3)}***${key.slice(-2)}` : key;
}
