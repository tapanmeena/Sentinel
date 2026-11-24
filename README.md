---
title: SENTINEL Security Dashboard
description: Multi-camera streaming, recording, and motion detection for Raspberry Pi.
---

A professional, futuristic security camera streaming dashboard for Raspberry Pi with multi-camera support, motion detection, and recording capabilities.

## ✨ Features

- **Multi-Camera Support** - Pi cameras and RTSP/IP network cameras
- **Live Streaming** - Real-time MJPEG video streaming with grid view
- **Motion Detection** - Automatic recording triggered by motion with configurable sensitivity
- **Manual Recording** - On-demand video recording with thumbnail generation
- **Dark/Light Theme** - Toggle between themes with persistence
- **Mobile Responsive** - Full mobile support with hamburger menu navigation
- **Authentication** - Secure login system with session management
- **Per-Camera Storage** - Organized recordings by camera (recordings/cam1/, recordings/cam2/)
- **RTSP Reconnection** - Exponential backoff reconnection strategy (1s→30s) with visual indicators
- **Glassmorphism UI** - Modern dark theme with translucent elements

## 📁 Project Structure

```
live-stream/
├── app/
│   ├── __init__.py           # Application factory
│   ├── auth.py               # Authentication utilities (session + bearer tokens)
│   ├── auth_routes.py        # Login/logout routes
│   ├── api_auth.py           # JSON auth API for the mobile app
│   ├── camera.py             # Multi-camera module (PiCamera, RTSP)
│   ├── routes.py             # Flask route definitions
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css     # Main stylesheet (dark/light themes)
│   │   └── js/
│   │       ├── common.js     # Shared functionality
│   │       ├── main.js       # Live view JavaScript
│   │       ├── recordings.js # Recordings page JavaScript
│   │       └── settings.js   # Settings page JavaScript
│   └── templates/
│       ├── components/
│       │   └── sidebar.html  # Reusable sidebar component
│       ├── index.html        # Live view dashboard
│       ├── login.html        # Login page
│       ├── recordings.html   # Recordings browser
│       ├── settings.html     # Settings page
│       ├── devices.html      # Camera management page
│       └── embed_stream.html # Standalone MJPEG viewer for the mobile app
├── config.py                 # Configuration settings
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
├── motion_config.json        # Per-camera motion detection settings
├── sentinel.service          # Systemd service file
├── .env                      # Environment variables (credentials)
├── mobile/                   # Expo mobile app (Android + iOS)
├── recordings/               # Video recordings (per-camera subdirs)
├── thumbnails/               # Recording thumbnails
└── snapshots/                # Manual snapshots
```

## 🚀 Getting Started

### Prerequisites

- Raspberry Pi with camera module (or any system with RTSP cameras)
- Python 3.9+
- Picamera2 library (for Pi cameras)
- OpenCV (for RTSP cameras and motion detection)

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd ~/Desktop/live-stream
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create environment file for credentials:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

### Environment Variables

Create a `.env` file with:
```bash
# Authentication (One Auth / AuthKit)
SECRET_KEY=your-secret-key-here
AUTHKIT_ISSUER_URL=https://auth.tapanmeena.com
# Optional local JWKS override on Raspberry Pi for offline LAN resilience:
# AUTHKIT_JWKS_URL=http://127.0.0.1:7583/.well-known/jwks.json
AUTHKIT_POOL_SLUG=one-auth
AUTHKIT_CLIENT_ID=sentinel-web
SENTINEL_ALLOWED_EMAILS=you@example.com

# Optional emergency break-glass local login (disabled by default)
SENTINEL_LOCAL_AUTH_ENABLED=false
# SENTINEL_USERNAME=admin
# SENTINEL_PASSWORD=your-secure-password

# RTSP Camera Credentials (optional)
RTSP_CAM2_USER=admin
RTSP_CAM2_PASS=camera-password
```

### Running the Application

**Development:**
```bash
python run.py
```

**Production (with Gunicorn):**
```bash
gunicorn -w 1 --threads 4 -b 0.0.0.0:8034 'app:create_app()'
```

**As a Systemd Service:**
```bash
sudo cp sentinel.service /etc/systemd/system/
sudo systemctl enable sentinel
sudo systemctl start sentinel
```

The dashboard will be available at `http://<your-pi-ip>:8034`

## 📷 Camera Configuration

Edit `config.py` to configure cameras:

```python
CAMERAS = {
    'cam1': {
        'type': 'picamera',      # Pi camera module
        'name': 'Main Camera',
        'enabled': True,
        'index': 0,              # Camera index for Picamera2
        'resolution': (1920, 1080),
        'framerate': 30,
    },
    'cam2': {
        'type': 'rtsp',          # Network/IP camera
        'name': 'Backyard Camera',
        'enabled': True,
        'url': 'rtsp://{RTSP_CAM2_USER}:{RTSP_CAM2_PASS}@192.168.1.100:554/stream1',
        'resolution': (1280, 720),
        'framerate': 15,
    },
}
```

### RTSP URL Credentials

Use `{ENV_VAR}` syntax in RTSP URLs to substitute environment variables:
- Keeps passwords out of config files
- Store credentials in `.env` file

### CP Plus Recorder Channels

To stream through a CP Plus CP-UNR-104F1 recorder, give each camera entry the
same recorder address and credential variables. Set `channel` to the channel
number shown on the recorder, starting at `1`. Use the recorder login in `.env`,
not the individual camera logins or the gCMOB app account.

```text
rtsp://{RTSP_CAM2_USER}:{RTSP_CAM2_PASS}@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
```

`subtype=0` selects the main stream. Restart Sentinel after changing the camera
configuration and check the Devices page for each channel's connection status.

## ⚙️ Configuration Options

### Server Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8034` | Server port |

### Camera Settings
| Setting | Description |
|---------|-------------|
| `type` | `picamera` or `rtsp` |
| `name` | Display name |
| `enabled` | Enable/disable camera |
| `resolution` | Video resolution tuple |
| `framerate` | Target FPS |
| `index` | Pi camera index (picamera only) |
| `url` | RTSP stream URL (rtsp only) |

### Motion Detection
Motion settings are stored in `motion_config.json` per camera:
- `enabled` - Enable/disable motion detection
- `sensitivity` - Motion sensitivity threshold (1-100)
- `cooldown` - Seconds between motion recordings
- `buffer_seconds` - Pre-motion buffer duration

## 🖥️ Pages

| Page | URL | Description |
|------|-----|-------------|
| Live View | `/` | Main dashboard with live camera feed |
| Recordings | `/recordings` | Browse and playback recorded videos |
| Settings | `/settings` | Configure motion detection |
| Devices | `/devices` | Camera status and management |
| Login | `/login` | Authentication page |

## � JSON API for native clients

Browsers sign in via **One Auth** (`AuthKit` OAuth 2.1 + S256 PKCE at `/auth/oidc/login` -> `/auth/callback`) and keep using the Flask session cookie flow. Native clients authenticate directly against One Auth (`sentinel-mobile` in pool `one-auth`) and send `EdDSA` access tokens as `Authorization: Bearer <jwt>`, receiving JSON `401` responses rather than HTML redirects.

| Endpoint | Method | Description |
|-----------------------------|--------|--------------------------------------------------------|
| `/auth/oidc/login` | GET | Start OAuth 2.1 + PKCE sign-in with One Auth (`sentinel-web`) |
| `/auth/callback` | GET | Complete One Auth PKCE callback and establish browser session |
| `/api/auth/logout` | POST | Clear any browser session |
| `/api/auth/me` | GET | Return the authenticated email / username |
| `/api/auth/media-token` | POST | Issue a 5 minute, read-only token for media URLs |
| `/api/storage/stats` | GET | Recording counts and sizes, per camera |
| `/embed/stream/<camera_id>` | GET | Standalone MJPEG viewer page for the mobile WebView |

Send the AuthKit access token as `Authorization: Bearer <token>`. Media URLs such as `/stream/<id>`,
`/thumbnails/...`, and `/recordings/play/...` cannot carry headers, so they additionally accept
`?token=<media-token>`. Media tokens are signed with `SECRET_KEY` + `MEDIA_TOKEN_SALT`, expire in five minutes, and
are rejected by every `/api/*` and write endpoint.

## 🔒 Security

- Session-based authentication for browsers, signed bearer tokens for the mobile app
- Constant-time credential comparison
- HTTP-only secure cookies
- CSRF protection via SameSite cookies
- Environment variable credential storage
- No hardcoded passwords in source

## 📱 Mobile

A native Expo app for Android and iOS lives in [mobile/](mobile/). It covers live streaming,
multi-camera grid view, recording controls, snapshots, the recordings browser with playback and
downloads, per-camera motion settings, and device status.

See [mobile/README.md](mobile/README.md) for setup and build instructions.

The web dashboard also stays fully usable on a phone browser:

- Responsive design with hamburger menu
- Touch-friendly controls
- Optimized video streaming
- Theme toggle support

## 📝 License

MIT License - Feel free to use and modify.
