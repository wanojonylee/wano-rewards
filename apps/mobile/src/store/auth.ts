import { create } from 'zustand';
import { authApi, setAuthToken, userApi } from '../lib/api';
import { getItem, KEYS, removeItem, setItem } from '../lib/storage';
import type { Locale, Profile } from '../types';

interface AuthState {
  token: string | null;
  profile: Profile | null;
  hydrated: boolean;
  onboarded: boolean;
  busy: boolean;
  hydrate: () => Promise<void>;
  verifyOtp: (identifier: string, code: string, locale: Locale) => Promise<void>;
  setProfile: (profile: Profile) => void;
  refreshProfile: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  profile: null,
  hydrated: false,
  onboarded: false,
  busy: false,
  hydrate: async () => {
    const [token, onboarded] = await Promise.all([getItem(KEYS.token), getItem(KEYS.onboarded)]);
    if (token) setAuthToken(token);
    let profile: Profile | null = null;
    if (token) {
      try {
        profile = await userApi.me();
      } catch {
        await removeItem(KEYS.token);
        await removeItem(KEYS.refresh);
        setAuthToken(null);
      }
    }
    set({ token: profile ? token : null, profile, onboarded: onboarded === '1', hydrated: true });
  },
  verifyOtp: async (identifier, code, locale) => {
    set({ busy: true });
    try {
      const result = await authApi.verify(identifier, code, locale);
      setAuthToken(result.accessToken);
      await setItem(KEYS.token, result.accessToken);
      await setItem(KEYS.refresh, result.refreshToken);
      const profile = await userApi.me();
      set({ token: result.accessToken, profile });
    } finally {
      set({ busy: false });
    }
  },
  setProfile: (profile) => set({ profile }),
  refreshProfile: async () => {
    const profile = await userApi.me();
    set({ profile });
  },
  completeOnboarding: async () => {
    await setItem(KEYS.onboarded, '1');
    set({ onboarded: true });
  },
  signOut: async () => {
    try {
      await authApi.logout();
    } catch {
      // best effort
    }
    setAuthToken(null);
    await removeItem(KEYS.token);
    await removeItem(KEYS.refresh);
    set({ token: null, profile: null });
  },
}));

export const isAuthed = () => !!useAuth.getState().token;
