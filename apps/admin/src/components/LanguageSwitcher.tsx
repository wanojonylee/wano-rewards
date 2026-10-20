import React from 'react';
import { LOCALE_LABELS, useI18n } from '../lib/i18n';
import type { Locale } from '../lib/i18n';

const OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'zh-Hant', label: LOCALE_LABELS['zh-Hant'] },
  { value: 'en', label: LOCALE_LABELS.en },
];

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`lang-switch ${className}`.trim()}
      role="group"
      aria-label={t('common.language')}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={locale === option.value}
          className={locale === option.value ? 'active' : ''}
          onClick={() => setLocale(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
