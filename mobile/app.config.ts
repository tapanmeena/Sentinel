import type { ConfigContext, ExpoConfig } from 'expo/config';

const SENTINEL_URL = process.env.EXPO_PUBLIC_SENTINEL_URL ?? '';
const AUTHKIT_URL = process.env.EXPO_PUBLIC_AUTHKIT_URL ?? 'https://auth.tapanmeena.com';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Sentinel',
  slug: 'sentinel-mobile',
  version: '1.0.0',
  orientation: 'default',
  scheme: 'sentinel',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.sentinel.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0B0F',
    },
    permissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
  },
  ios: {
    bundleIdentifier: 'com.sentinel.mobile',
    supportsTablet: true,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-video',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0A0B0F',
        dark: { backgroundColor: '#0A0B0F' },
      },
    ],
    [
      'expo-media-library',
      {
        savePhotosPermission: 'Sentinel saves recordings and snapshots to your gallery.',
        isAccessMediaLocationEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    sentinelUrl: SENTINEL_URL,
    authkitUrl: AUTHKIT_URL,
    eas: {
      projectId: "27d28ae2-f07c-497e-aefd-225fdb171cc8",
    },
  },
});
