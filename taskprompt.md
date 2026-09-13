# Task: Build a React Native (Expo) mobile client for the SENTINEL security camera dashboard

## 1. Objective

The SENTINEL project (a Flask app for Raspberry Pi that streams Pi/RTSP cameras) is currently
web-only. Build a **production-quality Expo mobile app** in a new `mobile/` folder inside this
repository that replicates the full web dashboard experience on iOS and Android, and make the
**minimum necessary Flask backend additions** to support a native client properly.

Deliver in the **phases** defined in section 9. Do not skip ahead. After each phase, stop and
report what changed.

---

## 2. Existing system — read before writing code

Read these files first and treat them as the source of truth:

| File | Contains |
|---|---|
| `app/routes.py` | All HTTP routes and the API surface |
| `app/camera.py` | `BaseCamera`, `PiCamera`, `RTSPCamera`, `CameraManager`, `CameraState`, all response payload shapes |
| `app/auth.py` | Session auth, `login_required`, `verify_credentials` |
| `app/auth_routes.py` | `/login` (HTML form), `/logout` |
| `config.py` | `Config.CAMERAS`, session cookie flags, port `8034` |
| `app/templates/*.html` + `app/static/js/*.js` | Exact UI behavior to replicate |
| `app/static/css/style.css` (lines 1–90) | Design tokens for both themes |

### 2.1 Current API inventory

Every route below is wrapped in `@login_required`, which today **302-redirects to `/login`**
instead of returning `401` — this is the primary reason the backend must change.

**Pages (HTML, not used by mobile):** `/`, `/recordings`, `/settings`, `/devices`, `/login`, `/logout`

**JSON API**
- `GET  /api/cameras` → `{ "cameras": CameraStatus[] }`
- `GET  /api/camera/<camera_id>/status` → `CameraStatus`
- `POST /api/recording/start/<camera_id>` → `{ success, message, filename, camera_id, start_time }`
- `POST /api/recording/stop/<camera_id>` → `{ success, message, filename, duration, size, type, camera_id }`
- `GET  /api/recording/status/<camera_id>` → `RecordingStatus`
- `GET  /api/recordings?camera_id=<id>` → `{ "recordings": Recording[] }` (sorted newest first)
- `DELETE /api/recordings/<camera_id>/<filename>` → `{ success, message }`
- `POST /api/snapshot/<camera_id>` → `{ success, filename, filepath, camera_id }`
- `GET  /api/motion/status/<camera_id>` → `MotionStatus`
- `POST /api/motion/enable/<camera_id>` / `POST /api/motion/disable/<camera_id>`
- `GET|POST /api/motion/settings/<camera_id>` → get/set `{ sensitivity, cooldown, buffer_seconds }`

**Media**
- `GET /stream/<camera_id>` → `multipart/x-mixed-replace; boundary=frame` MJPEG
- `GET /recordings/play/<camera_id>/<filename>` → inline `video/mp4`
- `GET /recordings/<camera_id>/<filename>` → `Content-Disposition: attachment` MP4
- `GET /thumbnails/<camera_id>/<filename>` → inline JPEG
- `GET /snapshots/<camera_id>/<filename>` → attachment JPEG

### 2.2 Payload shapes (mirror these exactly in TypeScript)

```ts
type CameraState = 'connected' | 'connecting' | 'reconnecting' | 'offline' | 'disabled';

interface CameraStatus {
  camera_id: string; name: string;
  type: 'PiCamera' | 'RTSPCamera';
  state: CameraState;
  enabled: boolean;
  last_error: string | null;
  resolution: [number, number];
  framerate: number;
  is_recording: boolean;
  motion_enabled: boolean;
  motion_detected: boolean;
  retry_count?: number;      // RTSP only
  next_retry_in?: number | null; // RTSP only, seconds
}

interface RecordingStatus {
  is_recording: boolean; is_motion_recording: boolean;
  filename: string | null;   // NOTE: full path on stop/status, bare name on start
  duration: number | null;   // seconds, float
  start_time: string | null; // ISO
  camera_id: string;
}

interface Recording {
  filename: string; camera_id: string; camera_name: string;
  size: number;              // bytes
  created: string;           // ISO
  thumbnail: string | null;  // bare filename under /thumbnails/<camera_id>/
}

interface MotionStatus {
  camera_id: string; enabled: boolean; motion_detected: boolean;
  is_motion_recording: boolean;
  sensitivity: number;    // 1–100,  clamped server-side
  cooldown: number;       // 3–60 s, clamped server-side
  buffer_seconds: number; // 1–10 s, clamped server-side
  time_since_motion: number | null;
}
```

### 2.3 Known quirks — respect these, do not "fix" silently

- The **camera-scoped** motion endpoints call `CameraManager.save_motion_configs()`; the default
  (non-scoped) ones do **not**. The mobile app must **always use camera-scoped endpoints** so
  settings persist to `motion_config.json`.
- `filename` is a full filesystem path in `stop_recording`/`get_recording_status` but a bare name in
  `start_recording`. Normalize with `basename` on the client.
- The sidebar links to `/alerts`, which has no route. **Exclude Alerts from the mobile app.**
- `verify_credentials` reads `SENTINEL_USERNAME` / `SENTINEL_PASSWORD`, but `README.md` documents
  `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Keep the current env var names working; flag the
  discrepancy in your report rather than renaming.

---

## 3. Backend work (Part A — Flask)

Backend changes are **approved and in scope**, but keep them additive and non-breaking: the
existing browser session flow must continue to work unchanged.

### 3.1 Token authentication

Add `app/api_auth.py` (or extend `app/auth.py`) providing:

- `POST /api/auth/login` — body `{ "username": string, "password": string }` →
  `200 { "token": string, "username": string, "expires_at": <ISO> }` or `401 { "error": "..." }`.
- `POST /api/auth/logout` — Bearer-authenticated, `200 { "success": true }`.
- `GET  /api/auth/me` — Bearer-authenticated → `{ "username": string, "authenticated": true }`.
- `POST /api/auth/media-token` — Bearer-authenticated → `{ "token": string, "expires_in": 300 }`.

Requirements:
- Tokens are **stateless signed tokens** via `itsdangerous.URLSafeTimedSerializer` keyed on
  `SECRET_KEY` (no database exists — do not add one). Session token TTL: 30 days. Media token TTL:
  5 minutes, with a distinct salt so it cannot be used for write operations.
- Replace the plaintext `==` comparison in `verify_credentials` with `secrets.compare_digest`.
- Add `itsdangerous` to `requirements.txt` if not already transitively pinned.

### 3.2 Make `login_required` client-aware

Rewrite the decorator so it authenticates in this order: **(1)** `Authorization: Bearer <token>`,
**(2)** existing Flask session cookie, **(3)** for `GET` media routes only, a `?token=` query param
holding a valid **media token**.

On failure:
- Return `401 application/json` when the request path starts with `/api/`, when an
  `Authorization` header is present, or when `Accept` prefers JSON.
- Otherwise keep the current redirect-to-login behavior for browsers.

Document the deliberate tradeoff: query-param tokens can leak into proxy/access logs, which is why
they are short-lived, read-only, and separately salted.

### 3.3 MJPEG embed page for the WebView

Add `GET /embed/stream/<camera_id>` (auth as above, accepts `?token=`) returning a minimal
standalone HTML document:
- black background, zero margin, `<img>` filling the viewport with `object-fit: contain`
- `src="/stream/<camera_id>?token=<media_token>"`
- inline JS that listens for `error`/`stalled` on the image and retries with exponential backoff
  (1 s → 30 s, matching the RTSP reconnect strategy) plus a cache-busting query param
- posts `{"type":"stream-status","state":"connected|reconnecting|error"}` to
  `window.ReactNativeWebView.postMessage` so the app can render native overlays
- no external assets, no third-party requests, correct `Content-Security-Policy` (`default-src
  'self'; img-src 'self'; script-src 'unsafe-inline'`), `X-Frame-Options: DENY`

### 3.4 Convenience endpoint

Add `GET /api/storage/stats` → `{ recordings_count, total_size_bytes, per_camera: [{camera_id, count, size}] }`
so the Settings screen does not have to download the entire recordings list to show storage info.

### 3.5 Backend acceptance

- All existing web pages and JS continue to work with **zero changes** to `app/static/js/*`.
- `curl` with a bearer token succeeds on every `/api/*` route; without one it returns JSON `401`.
- Update `README.md` with the new endpoints and the mobile app's existence.

---

## 4. Mobile app — stack and non-negotiables

- **Expo SDK (latest stable)**, TypeScript in **strict** mode, managed workflow targeting an
  **EAS development build** (not Expo Go — `expo-notifications`, native video and background tasks
  are needed later).
- **Expo Router** with file-based routing and a bottom tab bar.
- **TanStack Query** for all server state, caching, polling and invalidation.
- **Zustand** for client state only: auth session, server URL, theme, selected camera, view prefs.
- **expo-secure-store** for the auth token; **AsyncStorage** for non-secret prefs (theme, server URL,
  last camera, grid/table preference).
- iOS and Android phones, portrait-first with **landscape supported on the live view and video player**.
- The server is reachable at a **custom domain over HTTPS**. Do **not** add cleartext-HTTP
  exceptions to `Info.plist`/`AndroidManifest` by default; instead make the base URL user-editable
  and gracefully surface TLS/DNS/timeout errors. Ship the default domain via
  `app.config.ts` + `EXPO_PUBLIC_SENTINEL_URL` in `.env.example`, never hardcoded in a component.
- No secrets committed. `mobile/.gitignore` must cover `.env`, `node_modules`, `.expo`, build output.

---

## 5. File-by-file structure to create

```
mobile/
├── app.config.ts               # name SENTINEL, slug, scheme sentinel://, icons, splash, plugins
├── eas.json                    # development / preview / production profiles
├── package.json
├── tsconfig.json               # strict, path alias @/* -> src/*
├── .env.example                # EXPO_PUBLIC_SENTINEL_URL=https://your-domain
├── .gitignore
├── README.md                   # setup, dev build, env vars, troubleshooting
├── assets/                     # icon, splash, adaptive-icon, notification-icon
└── app/
    ├── _layout.tsx             # QueryClientProvider, ThemeProvider, SafeArea, auth bootstrap + splash gate
    ├── index.tsx               # routes to /server, /login, or /(tabs)/live based on hydrated state
    ├── (auth)/
    │   ├── _layout.tsx
    │   ├── server.tsx          # base URL entry + reachability check
    │   └── login.tsx           # username/password, replicates login.html styling
    ├── (tabs)/
    │   ├── _layout.tsx         # 4 tabs: Live, Recordings, Devices, Settings (+ recordings count badge)
    │   ├── live.tsx
    │   ├── recordings.tsx
    │   ├── devices.tsx
    │   └── settings.tsx
    ├── player/[cameraId]/[filename].tsx   # full-screen modal video player
    └── +not-found.tsx
└── src/
    ├── api/
    │   ├── client.ts           # fetch wrapper: base URL, bearer header, timeout+abort, 401 -> logout, typed errors
    │   ├── auth.ts             # login, logout, me, mediaToken
    │   ├── cameras.ts          # list, status, startRecording, stopRecording, recordingStatus, snapshot
    │   ├── recordings.ts       # list, delete, urls for play/download/thumbnail
    │   ├── motion.ts           # status, enable, disable, getSettings, setSettings
    │   ├── storage.ts          # storage stats
    │   ├── queryKeys.ts        # centralized key factory
    │   └── types.ts            # the interfaces from section 2.2
    ├── hooks/
    │   ├── useCameras.ts       # poll /api/cameras every 3 s while screen focused
    │   ├── useRecordingStatus.ts   # poll every 2 s; derives elapsed timer from start_time
    │   ├── useMotionStatus.ts  # poll every 2 s
    │   ├── useRecordings.ts    # list + delete mutation with optimistic update
    │   ├── useMediaToken.ts    # fetch + auto-refresh every 4 min, appends ?token= to media URLs
    │   ├── useDownloadRecording.ts # expo-file-system download + progress
    │   └── useAppStateRefresh.ts   # pause polling in background, refetch on foreground
    ├── store/
    │   ├── authStore.ts        # token, username, serverUrl, hydrate/login/logout
    │   ├── themeStore.ts       # 'dark' | 'light' | 'system', persisted
    │   └── uiStore.ts          # selectedCameraId, gridView, recordings view mode
    ├── theme/
    │   ├── tokens.ts           # section 6 tokens
    │   ├── ThemeProvider.tsx   # context + useTheme()
    │   └── glass.ts            # shared BlurView/glass surface style helpers
    ├── components/
    │   ├── ui/                 # Button, Card, GlassCard, Slider, Toggle, Badge, Toast, EmptyState, Skeleton, ErrorState, ConfirmDialog
    │   ├── MjpegStream.tsx     # WebView wrapper, handles postMessage status, remounts on token refresh
    │   ├── CameraSelector.tsx  # native picker / action sheet
    │   ├── LiveControls.tsx    # REC + timer, snapshot, fullscreen, info
    │   ├── CameraGrid.tsx      # multi-camera grid, tap to expand
    │   ├── CameraInfoSheet.tsx # source, resolution, fps, codec, status
    │   ├── ConnectionOverlay.tsx  # reconnecting + next_retry_in countdown
    │   ├── MotionBadge.tsx
    │   ├── RecordingCard.tsx / RecordingRow.tsx
    │   └── DeviceCard.tsx
    └── utils/
        ├── format.ts           # formatDuration(hh:mm:ss), formatFileSize, formatDate, sensitivityLabel
        └── errors.ts           # user-facing message mapping for network/TLS/401/404/5xx
```

---

## 6. Design system — port these exact tokens

From `app/static/css/style.css`. Build `tokens.ts` with `dark` and `light` palettes:

| Token | Dark | Light |
|---|---|---|
| bgPrimary | `#0a0a0f` | `#f8fafc` |
| bgSecondary | `#12121a` | `#ffffff` |
| bgTertiary | `#1a1a24` | `#f1f5f9` |
| glassBg | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.02)` |
| glassBorder | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` |
| textPrimary | `#ffffff` | `#0f172a` |
| textSecondary | `#a1a1aa` | `#475569` |
| textMuted | `#71717a` | `#94a3b8` |
| accentRed | `#ef4444` | `#dc2626` |
| accentCyan | `#22d3ee` | `#0891b2` |
| accentGreen | `#22c55e` | `#16a34a` |
| accentAmber | `#f59e0b` | `#d97706` |

Radii: `sm 8, md 12, lg 16, xl 24`. Gradient: cyan → `#3b82f6` (dark) / `#0891b2` → `#2563eb` (light).

Recreate the glassmorphism feel with `expo-blur` `BlurView` + translucent borders — do not simply
flatten it to solid cards. Use `expo-linear-gradient` for the accent gradient, `react-native-svg`
for the shield logo and Feather-style icons matching the web SVGs. Status colors:
`connected → green`, `connecting/reconnecting → amber`, `offline → red`, `disabled → muted`.

---

## 7. Screen-by-screen requirements

### 7.1 Server setup (`(auth)/server.tsx`)
Prefilled with `EXPO_PUBLIC_SENTINEL_URL`. Validates and normalizes the URL (strip trailing slash,
require scheme), pings `GET /api/auth/me` to confirm reachability, shows distinct errors for DNS
failure, TLS failure, timeout and non-SENTINEL responses. Persists on success. Also reachable from
Settings to change servers (which forces logout).

### 7.2 Login (`(auth)/login.tsx`)
Username + password, secure entry with a show/hide toggle, keyboard-avoiding layout, submit on
return key, loading state, inline error for `401` matching the web's "Invalid username or password".
Stores the token in SecureStore and routes to Live. Optional "Remember me" defaults on.

### 7.3 Live view (`(tabs)/live.tsx`) — replicates `index.html` + `main.js`
- Header: camera dropdown, connection status dot + label, live clock/date (1 s tick), theme toggle,
  grid-view toggle, logout.
- Single view: `MjpegStream` in a 16:9 container with `LIVE` badge, camera name badge, and a `REC`
  indicator with an `hh:mm:ss` timer.
- **Timer must be derived from the server's `duration`/`start_time`**, not a naive local counter, so
  it stays correct after backgrounding or reconnecting.
- Controls row: motion toggle with `OFF/ON` badge, REC start/stop, snapshot, fullscreen, info.
- Motion alert banner when `motion_detected` is true; light haptic on the transition.
- `ConnectionOverlay` when `state` is `connecting`/`reconnecting`, showing `retry_count` and a
  live `next_retry_in` countdown.
- Grid view: all enabled cameras as MJPEG tiles with name + status; tap expands to single view.
  Cap simultaneous streams (default 4) and lazily unmount off-screen tiles — MJPEG connections are
  expensive on the Pi.
- **Pause all streams when the screen loses focus or the app backgrounds**; resume on return. This is
  mandatory for battery and Pi CPU.
- Toast feedback for every action, mirroring the web's `showNotification` copy exactly
  ("Recording started", "Recording saved", "Snapshot saved: <filename>", "Connection error").
- Fullscreen: hide chrome, lock/allow landscape, restore on exit.

### 7.4 Recordings (`(tabs)/recordings.tsx`) — replicates `recordings.html` + `recordings.js`
- Camera filter (All + each camera), total count header, refresh button, pull-to-refresh.
- Grid ↔ table view toggle, persisted.
- Grid card: thumbnail from `/thumbnails/<camera_id>/<thumb>` with a `No Signal`-style placeholder
  fallback, filename, camera name, `formatFileSize`, `formatDate`, and a `motion` vs `manual` badge
  derived from the `motion_` / `recording_` filename prefix.
- Row actions: Play, Download, Delete (with a confirm dialog).
- Delete calls the **camera-scoped** `DELETE /api/recordings/<camera_id>/<filename>` and optimistically
  updates the cache.
- Loading skeletons and an empty state matching the web copy.
- Use `FlashList` or a properly-configured `FlatList` — do not render all recordings at once.

### 7.5 Video player (`player/[cameraId]/[filename].tsx`)
`expo-video` playing `/recordings/play/<camera_id>/<filename>?token=<media>`. Native controls,
scrubbing, landscape support, filename in the title, buffering and error states, download and share
actions, back to list.

### 7.6 Download & share
`expo-file-system` download with a progress indicator, then save to the gallery via
`expo-media-library` (request permission, handle denial gracefully) or open the OS share sheet via
`expo-sharing`. Same flow for snapshots.

### 7.7 Devices (`(tabs)/devices.tsx`) — replicates `devices.html`
Card per camera: live MJPEG preview (throttled/paused off-screen), name, colored state pill, type
(`PiCamera`/`RTSPCamera`), `camera_id`, resolution + fps, and `last_error` in a red error strip when
present. RTSP cards show `retry_count` and the retry countdown. Pull-to-refresh, empty state
pointing to `config.py`.

### 7.8 Settings (`(tabs)/settings.tsx`) — replicates `settings.html` + `settings.js`
- **Per-camera** motion section with a camera picker: enable/disable toggle, status indicator, and
  three sliders — sensitivity `1–100` (labelled Low/Medium/High per `getSensitivityLevel`),
  cooldown `3–60 s`, pre-record buffer `1–10 s`. Debounce slider commits (~400 ms) and use the
  camera-scoped POST so values persist.
- Storage section from `/api/storage/stats`.
- Appearance: dark / light / system.
- Account: username, server URL (editable), logout with confirmation.
- About: app version, build number, backend host.

---

## 8. Cross-cutting requirements

- **Auth failure handling:** any `401` clears the token, wipes the query cache, and routes to login
  with an explanatory toast.
- **Offline/error:** every screen has explicit loading, empty, and error states with a retry action.
  Detect connectivity with `expo-network` and show a persistent offline banner.
- **Polling discipline:** only poll while the screen is focused and the app is foregrounded
  (`useFocusEffect` + `AppState`). Cameras 3 s, recording/motion status 2 s, recordings list on
  focus + pull-to-refresh only.
- **Accessibility:** every icon-only control needs `accessibilityLabel` and `accessibilityRole`;
  ≥44×44 pt touch targets; respect `prefers-reduced-motion`; support dynamic type without clipping.
- **Security:** token only in SecureStore; never log tokens, credentials or full media URLs; no
  cleartext HTTP by default; path-traversal-safe filename handling; validate the server URL scheme.
- **Performance:** memoize list items, cap concurrent MJPEG connections, cancel in-flight requests on
  unmount, avoid re-creating the WebView on unrelated re-renders.
- **Code quality:** ESLint + Prettier configured and passing; `tsc --noEmit` clean; no `any`; no
  dead code; comments only where intent isn't obvious from the code.

---

## 9. Phased delivery

1. **Backend auth + embed** — section 3 in full, verified with `curl`, web UI regression-checked.
2. **App scaffold** — Expo Router, TypeScript, theme tokens, providers, API client, stores,
   server-setup + login screens, persisted session, tab shell.
3. **Live view** — MJPEG WebView, camera switcher, record/snapshot/fullscreen/info, motion toggle,
   connection overlay, grid view, focus-aware stream lifecycle.
4. **Recordings** — list/grid/table, filter, thumbnails, player, delete, download/share.
5. **Devices + Settings** — status cards, motion sliders, storage, appearance, account.
6. **Polish** — empty/error/offline states, accessibility pass, haptics, app icon and splash,
   `eas.json` profiles, `mobile/README.md`, root `README.md` update.
7. **(Deferred, plan only)** — replace MJPEG with **HLS or WebRTC** (e.g. `go2rtc` or an ffmpeg
   sidecar) for lower latency and battery use, plus **push notifications on motion events** via
   `expo-notifications` and an Expo push-token registry on the backend. Write a short design note
   describing the migration path and the abstraction seam in `MjpegStream.tsx` that makes it a
   drop-in swap. **Do not implement in this pass.**

---

## 10. Acceptance criteria

- `cd mobile && npm install && npx expo start` runs; `eas build --profile development` succeeds for
  both platforms.
- `npx tsc --noEmit` and `npm run lint` pass with zero errors.
- Against a live SENTINEL server: log in, view a live stream, switch cameras, view the grid, start and
  stop a recording with a correct timer, take a snapshot, toggle motion detection, adjust all three
  motion sliders and see them persist in `motion_config.json`, browse and filter recordings, play,
  download and delete one, and view device status — all from the phone.
- Backgrounding the app stops all MJPEG connections; foregrounding restores them and re-syncs state.
- The existing web dashboard is functionally unchanged.
- Report at the end: files added/changed, backend endpoints added, deviations from this spec with
  reasons, and known limitations.

## 11. Out of scope

Alerts screen, adding/editing cameras from the app (`config.py` remains the source), user
management, cloud sync, Android TV / iPad-specific layouts, and anything in phase 7.