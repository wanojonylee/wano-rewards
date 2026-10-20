import type { Locale } from '../types';
import { getI18nLocale } from './i18n';

const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthsFor = (locale: Locale) => (locale === 'en' ? MONTHS_EN : MONTHS_ZH);

/** Both supported locales group thousands with a comma. */
export function formatPoints(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = Math.abs(Math.round(value)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPointsEn(value: number): string {
  return formatPoints(value);
}

export function formatBRL(cents: number): string {
  const value = cents / 100;
  const fixed = Math.abs(value).toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}R$ ${grouped}.${dec}`;
}

export function formatBRLShort(cents: number): string {
  const value = cents / 100;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

/** Both supported locales use a dot decimal separator and comma grouping. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatKg(grams: number): string {
  return `${formatNumber(grams / 1000, 1)} kg`;
}

export function formatDate(iso: string, locale: Locale = getI18nLocale()): string {
  const d = new Date(iso);
  if (locale === 'en') return `${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;
  return `${MONTHS_ZH[d.getMonth()]}${d.getDate()}日`;
}

export function formatDateFull(iso: string, locale: Locale = getI18nLocale()): string {
  const d = new Date(iso);
  if (locale === 'en') return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getFullYear()}年${MONTHS_ZH[d.getMonth()]}${d.getDate()}日`;
}

export function formatMonth(iso: string, locale: Locale = getI18nLocale()): string {
  const d = new Date(iso);
  return monthsFor(locale)[d.getMonth()];
}

export function timeAgo(iso: string, locale: Locale = getI18nLocale()): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (locale === 'en') {
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return formatDate(iso, locale);
  }
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins}分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return formatDate(iso, locale);
}

export function greetingKey(): 'home.morning' | 'home.afternoon' | 'home.evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.morning';
  if (hour < 18) return 'home.afternoon';
  return 'home.evening';
}

export function maskPixKey(key: string): string {
  if (key.includes('@')) {
    const [user, domain] = key.split('@');
    const shown = user.slice(0, 2) + '***';
    return `${shown}@${domain}`;
  }
  if (key.length > 6) return `${key.slice(0, 3)}***${key.slice(-2)}`;
  return key;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
