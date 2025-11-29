"""Route definitions for the Flask application."""
from flask import Blueprint, Response, render_template, jsonify, send_from_directory
from app.camera import Camera
import os

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')


@main_bp.route('/recordings')
def recordings_page():
    """Render the recordings page."""
    return render_template('recordings.html')


@main_bp.route('/stream')
def stream():
    """Video streaming route."""
    return Response(
        Camera.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


# ========== Recording API ==========

@main_bp.route('/api/recording/start', methods=['POST'])
def start_recording():
    """Start video recording."""
    result = Camera.start_recording()
    return jsonify(result)


@main_bp.route('/api/recording/stop', methods=['POST'])
def stop_recording():
    """Stop video recording."""
    result = Camera.stop_recording()
    return jsonify(result)


@main_bp.route('/api/recording/status')
def recording_status():
    """Get current recording status."""
    result = Camera.get_recording_status()
    return jsonify(result)


@main_bp.route('/api/recordings')
def list_recordings():
    """Get list of all recordings."""
    recordings = Camera.get_recordings_list()
    return jsonify({"recordings": recordings})


@main_bp.route('/api/recordings/<filename>', methods=['DELETE'])
def delete_recording(filename):
    """Delete a recording file."""
    result = Camera.delete_recording(filename)
    return jsonify(result)


# ========== Snapshot API ==========

@main_bp.route('/api/snapshot', methods=['POST'])
def capture_snapshot():
    """Capture a snapshot image."""
    result = Camera.capture_snapshot()
    return jsonify(result)


# ========== File Download Routes ==========

@main_bp.route('/recordings/<filename>')
def download_recording(filename):
    """Download a recording file."""
    recordings_dir = os.path.join(os.getcwd(), 'recordings')
    return send_from_directory(recordings_dir, filename, as_attachment=True)


@main_bp.route('/recordings/play/<filename>')
def play_recording(filename):
    """Stream a recording file for playback."""
    recordings_dir = os.path.join(os.getcwd(), 'recordings')
    return send_from_directory(recordings_dir, filename, as_attachment=False, mimetype='video/mp4')


@main_bp.route('/snapshots/<filename>')
def download_snapshot(filename):
    """Download a snapshot file."""
    snapshots_dir = os.path.join(os.getcwd(), 'snapshots')
    return send_from_directory(snapshots_dir, filename, as_attachment=True)


@main_bp.route('/thumbnails/<filename>')
def get_thumbnail(filename):
    """Serve a recording thumbnail."""
    thumbnails_dir = os.path.join(os.getcwd(), 'thumbnails')
    return send_from_directory(thumbnails_dir, filename, as_attachment=False)
