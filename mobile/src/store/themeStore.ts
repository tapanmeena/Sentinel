import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'sentinel.theme.preference';

export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeState {
  preference: ThemePreference;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

function isPreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'dark',

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(KEY);
      if (isPreference(stored)) set({ preference: stored });
    } catch {
      // Fall back to the dark default.
    }
  },

  setPreference: async (preference) => {
    set({ preference });
    await AsyncStorage.setItem(KEY, preference).catch(() => {});
  },
}));
