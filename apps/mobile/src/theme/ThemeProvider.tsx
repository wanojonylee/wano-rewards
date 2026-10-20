import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './colors';
import { getItem, setItem, KEYS } from '../lib/storage';

type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  colors: Palette;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getItem(KEYS.theme).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    setItem(KEYS.theme, p).catch(() => {});
    (Appearance as any).setColorScheme(p === 'system' ? null : p);
  }, []);

  const scheme = useMemo<'light' | 'dark'>(() => {
    if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
    return preference;
  }, [preference, system]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkPalette : lightPalette,
      scheme,
      preference,
      setPreference,
      isDark: scheme === 'dark',
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
