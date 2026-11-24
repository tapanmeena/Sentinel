import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { create } from 'zustand';

import {
  configureApi,
  normalizeBaseUrl,
  setTokenChangeListener,
  tokenStorage,
} from '@/api/client';

const LEGACY_TOKEN_KEY = 'sentinel.auth.token';
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

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  serverUrl: null,
  token: null,
  username: null,
  suggestedServerUrl: defaultServerUrl(),

  hydrate: async () => {
    let serverUrl: string | null = null;
    let token: string | null = null;
    let username: string | null = null;

    // Remove any pre-AuthKit legacy token from SecureStore.
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => {});

    try {
      serverUrl = await AsyncStorage.getItem(SERVER_KEY);
      username = await AsyncStorage.getItem(USERNAME_KEY);
    } catch {
      serverUrl = null;
    }

    try {
      const stored = await tokenStorage.getTokens();
      token = stored?.accessToken ?? null;
    } catch {
      token = null;
    }

    setTokenChangeListener((nextAccessToken) => {
      set({ token: nextAccessToken });
    });

    configureApi({ baseUrl: serverUrl, token });
    set({ hydrated: true, serverUrl, token, username });
  },

  setServerUrl: async (url) => {
    const normalized = normalizeBaseUrl(url);
    if (!normalized) throw new Error('Enter a valid server address');

    await AsyncStorage.setItem(SERVER_KEY, normalized);
    configureApi({ baseUrl: normalized });
    set({ serverUrl: normalized });
  },

  signIn: async (token, username) => {
    await AsyncStorage.setItem(USERNAME_KEY, username);
    configureApi({ token });
    set({ token, username });
  },

  signOut: async () => {
    await tokenStorage.clearTokens();
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => {});
    configureApi({ token: null });
    set({ token: null });
  },

  clearServer: async () => {
    await AsyncStorage.removeItem(SERVER_KEY).catch(() => {});
    await AsyncStorage.removeItem(USERNAME_KEY).catch(() => {});
    await tokenStorage.clearTokens();
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY).catch(() => {});
    configureApi({ baseUrl: null, token: null });
    set({ serverUrl: null, token: null, username: null });
  },
}));
