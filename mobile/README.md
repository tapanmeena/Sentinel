# Sentinel Mobile

Android and iOS client for the Sentinel security dashboard, built with Expo. It talks to the same
Flask server as the web UI, using a token-based API rather than session cookies.

## Requirements

* Node.js 20 or newer
* A Sentinel server running the token auth API (`/api/auth/*`), reachable from your phone
* Android Studio for a local Android build, or an EAS account for cloud builds

This app uses native modules (WebView, video, media library), so it does not run in Expo Go. You
need a development build.

## Setup

```bash
cd mobile
npm install
cp .env.example .env
```

Edit `.env` and point `EXPO_PUBLIC_SENTINEL_URL` at your server and `EXPO_PUBLIC_AUTHKIT_URL` at
your One Auth (AuthKit) issuer:

```bash
EXPO_PUBLIC_SENTINEL_URL=https://camera.tapanmeena.com
EXPO_PUBLIC_AUTHKIT_URL=https://auth.tapanmeena.com
```

## Running on Android

Build and install a development client once, then iterate over the Metro bundler:

```bash
npx expo run:android     # local build, requires Android Studio + a device or emulator
npm start                # afterwards, just start the bundler
```

To build in the cloud instead:

```bash
npx eas build --profile development --platform android
```

Install the resulting APK, then run `npm start` and scan the QR code.

## Checks

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, zero warnings allowed
npm run check            # both
npx expo-doctor          # dependency and config validation
```

## Project layout

```text
mobile/
├── app/                        Expo Router routes
│   ├── _layout.tsx             Providers, store hydration, 401 handling
│   ├── index.tsx               Entry gate: server, then login, then tabs
│   ├── (auth)/                 Server setup and sign in
│   ├── (tabs)/                 Live, Clips, Devices, Settings
│   └── player/                 Full screen recording playback
└── src/
    ├── api/                    Typed HTTP client and endpoint modules
    ├── components/             Feature components and the UI kit
    ├── hooks/                  Query, polling, download, and lifecycle hooks
    ├── store/                  Zustand stores for auth, theme, and UI state
    ├── theme/                  Design tokens and the theme provider
    └── utils/                  Formatting helpers
```

## How authentication works

1. Users sign in against **One Auth** (`AuthKitClient` with `clientId: 'sentinel-mobile'` in pool
   `one-auth`) using either **Email + Password** or a passwordless **6-digit Email OTP**.
2. Access and refresh tokens are stored in `expo-secure-store` via `KeyValueTokenStorage`. Before
   every Sentinel `/api/*` request, `authClient.getValidAccessToken()` returns a valid `EdDSA`
   access token (automatically rotating refresh tokens single-flight when needed).
3. Media URLs cannot carry headers, so the app still exchanges its bearer token for a short-lived
   read-only media token from `POST /api/auth/media-token` and appends it as `?token=`. It refreshes
   every four minutes.
4. Any `401` after refresh clears stored tokens, wipes the query cache, and returns to sign-in.

## How live streaming works

The server exposes `/embed/stream/<camera_id>`, a self-contained HTML page that renders the MJPEG
feed and handles reconnect backoff. The app loads that page in a WebView because React Native's
`Image` component cannot consume `multipart/x-mixed-replace` reliably on Android.

The page reports its state back over `postMessage`, which drives the native overlays.

Streams are torn down whenever the screen loses focus or the app is backgrounded, and the grid view
caps concurrent streams at four. Both limits exist to protect the Pi's CPU.

`MjpegStream.tsx` is the single seam where this is implemented, so swapping to HLS or WebRTC later
means replacing one component.

## Design system

Tokens live in `src/theme/tokens.ts` and cover both dark and light palettes. Colours are semantic
rather than literal, so components never hardcode hex values.

| Role      | Purpose                                              |
|-----------|------------------------------------------------------|
| `brand`   | Primary actions, selection, focus                    |
| `live`    | Reserved for recording and motion states only        |
| `success` | Connected cameras, armed motion detection            |
| `warning` | Connecting, reconnecting, degraded states            |
| `danger`  | Offline cameras, destructive actions, errors         |

Depth comes from layered surfaces (`bg`, `surface`, `surfaceHigh`) rather than heavy shadows, which
keeps rendering cheap on Android.

## Known limitations

* MJPEG has higher latency and battery cost than HLS or WebRTC. Migrating is a planned follow-up.
* Push notifications for motion events are not implemented; the backend has no push registry yet.
* Cameras are still configured server side in `config.py`. The app cannot add or edit them.
* Media tokens appear in URLs. They expire after five minutes and are rejected by every write
  endpoint, but they can still land in reverse proxy access logs.
