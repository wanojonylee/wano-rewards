import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // ignore private-mode storage failures
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export const KEYS = {
  token: 'recio.token',
  refresh: 'recio.refresh',
  onboarded: 'recio.onboarded',
  theme: 'recio.theme',
  locale: 'recio.locale',
  user: 'recio.user',
};
