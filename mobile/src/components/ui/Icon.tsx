import { memo, type ReactNode } from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * Feather-style stroked icon set. Children inherit stroke from the root <Svg>,
 * so each glyph only declares geometry.
 */
const glyphs = {
  shield: (
    <>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  camera: (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </>
  ),
  video: (
    <>
      <Polygon points="23 7 16 12 23 17 23 7" />
      <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),
  film: (
    <>
      <Rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <Line x1="7" y1="2" x2="7" y2="22" />
      <Line x1="17" y1="2" x2="17" y2="22" />
      <Line x1="2" y1="12" x2="22" y2="12" />
      <Line x1="2" y1="7" x2="7" y2="7" />
      <Line x1="2" y1="17" x2="7" y2="17" />
      <Line x1="17" y1="17" x2="22" y2="17" />
      <Line x1="17" y1="7" x2="22" y2="7" />
    </>
  ),
  hardDrive: (
    <>
      <Line x1="22" y1="12" x2="2" y2="12" />
      <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <Line x1="6" y1="16" x2="6.01" y2="16" />
      <Line x1="10" y1="16" x2="10.01" y2="16" />
    </>
  ),
  sliders: (
    <>
      <Line x1="4" y1="21" x2="4" y2="14" />
      <Line x1="4" y1="10" x2="4" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12" y2="3" />
      <Line x1="20" y1="21" x2="20" y2="16" />
      <Line x1="20" y1="12" x2="20" y2="3" />
      <Line x1="1" y1="14" x2="7" y2="14" />
      <Line x1="9" y1="8" x2="15" y2="8" />
      <Line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  maximize: (
    <Path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  ),
  minimize: (
    <Path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  grid: (
    <>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  list: (
    <>
      <Line x1="8" y1="6" x2="21" y2="6" />
      <Line x1="8" y1="12" x2="21" y2="12" />
      <Line x1="8" y1="18" x2="21" y2="18" />
      <Line x1="3" y1="6" x2="3.01" y2="6" />
      <Line x1="3" y1="12" x2="3.01" y2="12" />
      <Line x1="3" y1="18" x2="3.01" y2="18" />
    </>
  ),
  chevronDown: <Polyline points="6 9 12 15 18 9" />,
  chevronRight: <Polyline points="9 18 15 12 9 6" />,
  chevronLeft: <Polyline points="15 18 9 12 15 6" />,
  arrowLeft: (
    <>
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </>
  ),
  close: (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  check: <Polyline points="20 6 9 17 4 12" />,
  alertTriangle: (
    <>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  alertCircle: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="8" x2="12" y2="12" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  refresh: (
    <>
      <Polyline points="23 4 23 10 17 10" />
      <Polyline points="1 20 1 14 7 14" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  download: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  share: (
    <>
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Polyline points="16 6 12 2 8 6" />
      <Line x1="12" y1="2" x2="12" y2="15" />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Line x1="10" y1="11" x2="10" y2="17" />
      <Line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  play: <Polygon points="6 3 20 12 6 21 6 3" />,
  moon: <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="5" />
      <Line x1="12" y1="1" x2="12" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="23" />
      <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <Line x1="1" y1="12" x2="3" y2="12" />
      <Line x1="21" y1="12" x2="23" y2="12" />
      <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
  ),
  smartphone: (
    <>
      <Rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <Line x1="12" y1="18" x2="12.01" y2="18" />
    </>
  ),
  logOut: (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  server: (
    <>
      <Rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <Rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <Line x1="6" y1="6" x2="6.01" y2="6" />
      <Line x1="6" y1="18" x2="6.01" y2="18" />
    </>
  ),
  database: (
    <>
      <Ellipse cx="12" cy="5" rx="9" ry="3" />
      <Path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <Path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  activity: <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  wifiOff: (
    <>
      <Line x1="1" y1="1" x2="23" y2="23" />
      <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <Path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <Line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  eye: (
    <>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  lock: (
    <>
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </>
  ),
  image: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polyline points="21 15 16 10 5 21" />
    </>
  ),
  plusCircle: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="8" x2="12" y2="16" />
      <Line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  square: <Rect x="5" y="5" width="14" height="14" rx="2" />,
} as const;

export type IconName = keyof typeof glyphs;

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

function IconBase({ name, size = 20, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[name] as ReactNode}
    </Svg>
  );
}

export const Icon = memo(IconBase);

/** Solid dot used for the record button and status indicators. */
export function DotIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" fill={color} />
    </Svg>
  );
}
