import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';

import { useThemeStore } from '@/store/themeStore';
import {
  duration,
  elevation,
  palettes,
  radius,
  space,
  typography,
  type Palette,
  type ThemeName,
} from './tokens';

export interface Theme {
  name: ThemeName;
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  duration: typeof duration;
  isDark: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useColorScheme();

  const resolved: ThemeName =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const theme = useMemo<Theme>(
    () => ({
      name: resolved,
      colors: palettes[resolved],
      space,
      radius,
      typography,
      elevation,
      duration,
      isDark: resolved === 'dark',
    }),
    [resolved],
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => {});
    if (Platform.OS === 'android') {
      // Under edge-to-edge only the button icons can be styled, not the bar itself.
      NavigationBar.setStyle(theme.isDark ? 'light' : 'dark');
    }
  }, [theme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return theme;
}
