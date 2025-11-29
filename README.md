# SENTINEL Security Dashboard

A professional, futuristic security camera streaming dashboard for Raspberry Pi.

## 📁 Project Structure

```
live-stream/
├── app/
│   ├── __init__.py          # Application factory
│   ├── camera.py             # Camera module (Picamera2 handling)
│   ├── routes.py             # Flask route definitions
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css     # Main stylesheet
│   │   └── js/
│   │       └── main.js       # Frontend JavaScript
│   └── templates/
│       └── index.html        # Main dashboard template
├── config.py                 # Configuration settings
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## 🚀 Getting Started

### Prerequisites

- Raspberry Pi with camera module
- Python 3.9+
- Picamera2 library installed

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd ~/Desktop/live-stream
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

```bash
python run.py
```

The dashboard will be available at `http://<your-pi-ip>:8034`

## 🎨 Features

- **Glassmorphism UI** - Modern dark theme with translucent elements
- **Live Video Feed** - Real-time MJPEG streaming
- **Responsive Design** - Works on desktop and mobile
- **Visual Indicators** - Live status, recording timer, stream stats
- **Fullscreen Mode** - Immersive viewing experience

## ⚙️ Configuration

Edit `config.py` to customize:

- `HOST` - Server bind address (default: `0.0.0.0`)
- `PORT` - Server port (default: `8034`)
- `CAMERA_RESOLUTION` - Video resolution
- `CAMERA_FRAMERATE` - Target framerate

## 📝 License

MIT License - Feel free to use and modify.
