/**
 * Sentinel mobile design system.
 *
 * A dark-first "night ops" system built for phones: layered ink surfaces
 * instead of heavy shadows (cheap on Android), a violet signal accent, and a
 * dedicated live-red reserved exclusively for recording and motion states.
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  /** App background, behind everything. */
  bg: string;
  /** Slightly lifted background for scroll containers and headers. */
  bgElevated: string;
  /** Default card / row surface. */
  surface: string;
  /** Surface on top of a surface (nested cards, pressed states). */
  surfaceHigh: string;
  /** Surface used for inputs and inset wells. */
  surfaceSunken: string;
  /** Hairline dividers and card outlines. */
  border: string;
  /** Emphasised outline for focus and selection. */
  borderStrong: string;

  text: string;
  textMuted: string;
  textFaint: string;
  /** Text that sits on a brand-filled surface. */
  textOnBrand: string;

  brand: string;
  brandHover: string;
  /** Translucent brand wash for selected chips and icon tiles. */
  brandSoft: string;
  brandBorder: string;

  /** Reserved for live streams, recording, and motion alerts. */
  live: string;
  liveSoft: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  /** Overlay scrim behind sheets and modals. */
  scrim: string;
  /** Gradient applied over video tiles so overlay text stays legible. */
  videoScrim: readonly [string, string];
  /** Letterbox colour behind video content. */
  videoBackdrop: string;

  skeleton: string;
  skeletonHighlight: string;
}

const dark: Palette = {
  bg: '#0A0B0F',
  bgElevated: '#101219',
  surface: '#151822',
  surfaceHigh: '#1D212D',
  surfaceSunken: '#0D0F15',
  border: '#242938',
  borderStrong: '#39405360',

  text: '#F4F6FB',
  textMuted: '#98A0B3',
  textFaint: '#636B7D',
  textOnBrand: '#FFFFFF',

  brand: '#6E5BFF',
  brandHover: '#8577FF',
  brandSoft: 'rgba(110, 91, 255, 0.16)',
  brandBorder: 'rgba(110, 91, 255, 0.42)',

  live: '#FF3B5C',
  liveSoft: 'rgba(255, 59, 92, 0.16)',

  success: '#25D07C',
  successSoft: 'rgba(37, 208, 124, 0.15)',
  warning: '#FFB020',
  warningSoft: 'rgba(255, 176, 32, 0.15)',
  danger: '#FF5A5A',
  dangerSoft: 'rgba(255, 90, 90, 0.15)',
  info: '#3BA0FF',
  infoSoft: 'rgba(59, 160, 255, 0.15)',

  scrim: 'rgba(4, 5, 8, 0.72)',
  videoScrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'],
  videoBackdrop: '#000000',

  skeleton: '#1A1E29',
  skeletonHighlight: '#232837',
};

const light: Palette = {
  bg: '#F3F4F9',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceHigh: '#F0F1F7',
  surfaceSunken: '#EAECF3',
  border: '#E2E5EF',
  borderStrong: '#C8CDDC',

  text: '#0E1118',
  textMuted: '#596174',
  textFaint: '#8A92A6',
  textOnBrand: '#FFFFFF',

  brand: '#5A46F0',
  brandHover: '#4A37D8',
  brandSoft: 'rgba(90, 70, 240, 0.10)',
  brandBorder: 'rgba(90, 70, 240, 0.32)',

  live: '#E12D4B',
  liveSoft: 'rgba(225, 45, 75, 0.10)',

  success: '#0FA05E',
  successSoft: 'rgba(15, 160, 94, 0.12)',
  warning: '#C07500',
  warningSoft: 'rgba(192, 117, 0, 0.12)',
  danger: '#D93A3A',
  dangerSoft: 'rgba(217, 58, 58, 0.12)',
  info: '#1573D4',
  infoSoft: 'rgba(21, 115, 212, 0.12)',

  scrim: 'rgba(14, 17, 24, 0.45)',
  videoScrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'],
  videoBackdrop: '#0B0C10',

  skeleton: '#E6E9F1',
  skeletonHighlight: '#F2F4F9',
};

export const palettes: Record<ThemeName, Palette> = { dark, light };

/** 4pt spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  '2xl': 32,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  /** Micro caps used for status chips and section eyebrows. */
  overline: { fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.9 },
  /** Tabular-ish numerals for timers and counters. */
  mono: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.6 },
} as const;

export const duration = {
  fast: 140,
  base: 220,
  slow: 320,
} as const;

/**
 * Elevation tuned for Android: a matching `elevation` value plus a soft shadow
 * so the same token reads correctly on both platforms.
 */
export const elevation = {
  none: { elevation: 0, shadowOpacity: 0 },
  low: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  medium: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  high: {
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
  },
} as const;

/** Minimum touch target, per platform accessibility guidance. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 44;
