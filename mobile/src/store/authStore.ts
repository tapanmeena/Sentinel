import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { create } from 'zustand';

import { configureApi, normalizeBaseUrl } from '@/api/client';

const TOKEN_KEY = 'sentinel.auth.token';
const SERVER_KEY = 'sentinel.server.url';
const USERNAME_KEY = 'sentinel.auth.username';

function defaultServerUrl(): string {
  const extra = Constants.expoConfig?.extra as { sentinelUrl?: string } | undefined;
  const raw = process.env.EXPO_PUBLIC_SENTINEL_URL ?? extra?.sentinelUrl ?? '';
  return raw ? (normalizeBaseUrl(raw) ?? '') : '';
}

interface AuthState {
  hydrated: boolean;
  serverUrl: string | null;
  token: string | null;
  username: string | null;
  /** Pre-filled value for the setup screen when no server is saved yet. */
  suggestedServerUrl: string;

  hydrate: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  signIn: (token: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearServer: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  serverUrl: null,
  token: null,
  username: null,
  suggestedServerUrl: defaultServerUrl(),

  hydrate: async () => {
    let serverUrl: string | null = null;
    let token: string | null = null;
    let username: string | null = null;

    try {
      serverUrl = await AsyncStorage.getItem(SERVER_KEY);
      username = await AsyncStorage.getItem(USERNAME_KEY);
    } catch {
      serverUrl = null;
    }

    try {
      token = await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      token = null;
    }

    configureApi({ baseUrl: serverUrl, token });
    set({ hydrated: true, serverUrl, token, username });
  },

  setServerUrl: async (url) => {
    const normalized = normalizeBaseUrl(url);
    if (!normalized) throw new Error('Enter a valid server address');

    const changedHost = get().serverUrl !== null && get().serverUrl !== normalized;
    await AsyncStorage.setItem(SERVER_KEY, normalized);

    if (changedHost) {
      // A token is only valid for the server that issued it.
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      await AsyncStorage.removeItem(USERNAME_KEY).catch(() => {});
      configureApi({ baseUrl: normalized, token: null });
      set({ serverUrl: normalized, token: null, username: null });
      return;
    }

    configureApi({ baseUrl: normalized });
    set({ serverUrl: normalized });
  },

  signIn: async (token, username) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.setItem(USERNAME_KEY, username);
    configureApi({ token });
    set({ token, username });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    configureApi({ token: null });
    set({ token: null });
  },

  clearServer: async () => {
    await AsyncStorage.removeItem(SERVER_KEY).catch(() => {});
    await AsyncStorage.removeItem(USERNAME_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    configureApi({ baseUrl: null, token: null });
    set({ serverUrl: null, token: null, username: null });
  },
}));
