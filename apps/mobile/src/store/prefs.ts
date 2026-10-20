import { useCallback } from 'react';
import { create } from 'zustand';
import { getI18nLocale, setI18nLocale, t as translate } from '../lib/i18n';
import { getItem, setItem, KEYS } from '../lib/storage';
import type { Locale } from '../types';

export const DEFAULT_LOCALE: Locale = 'zh-Hant';

/** Stored values are migrated here: `pt-BR` (and anything unknown) becomes `zh-Hant`. */
export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : DEFAULT_LOCALE;
}

interface PrefsState {
  locale: Locale;
  hydrated: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  setLocale: (locale: Locale) => void;
  setPush: (value: boolean) => void;
  setEmail: (value: boolean) => void;
  hydrate: () => Promise<void>;
}

export const usePrefs = create<PrefsState>((set) => ({
  locale: DEFAULT_LOCALE,
  hydrated: false,
  pushEnabled: true,
  emailEnabled: true,
  setLocale: (locale) => {
    setI18nLocale(locale);
    set({ locale });
    setItem(KEYS.locale, locale).catch(() => {});
  },
  setPush: (pushEnabled) => set({ pushEnabled }),
  setEmail: (emailEnabled) => set({ emailEnabled }),
  hydrate: async () => {
    const stored = await getItem(KEYS.locale);
    const locale = normalizeLocale(stored);
    if (stored !== null && stored !== locale) {
      // Migrate legacy values (e.g. 'pt-BR') so the next launch reads the new locale.
      setItem(KEYS.locale, locale).catch(() => {});
    }
    setI18nLocale(locale);
    set({ locale, hydrated: true });
  },
}));

export function useT() {
  const locale = usePrefs((s) => s.locale);
  return useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // locale is a dependency so components re-render on language change
      void locale;
      return translate(key, params);
    },
    [locale],
  );
}

export function currentLocale(): Locale {
  return getI18nLocale();
}
