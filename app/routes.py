"""Route definitions for the Flask application."""
from flask import Blueprint, Response, render_template, jsonify, send_from_directory, request
from app.camera import Camera
from app.auth import login_required, get_current_user
import os

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
@login_required
def index():
    """Render the main dashboard page."""
    return render_template('index.html', username=get_current_user())


@main_bp.route('/recordings')
@login_required
def recordings_page():
    """Render the recordings page."""
    return render_template('recordings.html', username=get_current_user())


@main_bp.route('/settings')
@login_required
def settings_page():
    """Render the settings page."""
    return render_template('settings.html', username=get_current_user())


@main_bp.route('/stream')
@login_required
def stream():
    """Video streaming route."""
    return Response(
        Camera.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


# ========== Recording API ==========

@main_bp.route('/api/recording/start', methods=['POST'])
@login_required
def start_recording():
    """Start video recording."""
    result = Camera.start_recording()
    return jsonify(result)


@main_bp.route('/api/recording/stop', methods=['POST'])
@login_required
def stop_recording():
    """Stop video recording."""
    result = Camera.stop_recording()
    return jsonify(result)


@main_bp.route('/api/recording/status')
@login_required
def recording_status():
    """Get current recording status."""
    result = Camera.get_recording_status()
    return jsonify(result)


@main_bp.route('/api/recordings')
@login_required
def list_recordings():
    """Get list of all recordings."""
    recordings = Camera.get_recordings_list()
    return jsonify({"recordings": recordings})


@main_bp.route('/api/recordings/<filename>', methods=['DELETE'])
@login_required
def delete_recording(filename):
    """Delete a recording file."""
    result = Camera.delete_recording(filename)
    return jsonify(result)


# ========== Snapshot API ==========

@main_bp.route('/api/snapshot', methods=['POST'])
@login_required
def capture_snapshot():
    """Capture a snapshot image."""
    result = Camera.capture_snapshot()
    return jsonify(result)


# ========== File Download Routes ==========

@main_bp.route('/recordings/<filename>')
@login_required
def download_recording(filename):
    """Download a recording file."""
    recordings_dir = os.path.join(os.getcwd(), 'recordings')
    return send_from_directory(recordings_dir, filename, as_attachment=True)


@main_bp.route('/recordings/play/<filename>')
@login_required
def play_recording(filename):
    """Stream a recording file for playback."""
    recordings_dir = os.path.join(os.getcwd(), 'recordings')
    return send_from_directory(recordings_dir, filename, as_attachment=False, mimetype='video/mp4')


@main_bp.route('/snapshots/<filename>')
@login_required
def download_snapshot(filename):
    """Download a snapshot file."""
    snapshots_dir = os.path.join(os.getcwd(), 'snapshots')
    return send_from_directory(snapshots_dir, filename, as_attachment=True)


@main_bp.route('/thumbnails/<filename>')
@login_required
def get_thumbnail(filename):
    """Serve a recording thumbnail."""
    thumbnails_dir = os.path.join(os.getcwd(), 'thumbnails')
    return send_from_directory(thumbnails_dir, filename, as_attachment=False)


# ========== Motion Detection API ==========

@main_bp.route('/api/motion/status')
@login_required
def motion_status():
    """Get motion detection status."""
    result = Camera.get_motion_status()
    return jsonify(result)


@main_bp.route('/api/motion/enable', methods=['POST'])
@login_required
def enable_motion():
    """Enable motion detection."""
    result = Camera.enable_motion_detection()
    return jsonify(result)


@main_bp.route('/api/motion/disable', methods=['POST'])
@login_required
def disable_motion():
    """Disable motion detection."""
    result = Camera.disable_motion_detection()
    return jsonify(result)


@main_bp.route('/api/motion/settings', methods=['GET', 'POST'])
@login_required
def motion_settings():
    """Get or update motion detection settings."""
    if request.method == 'GET':
        status = Camera.get_motion_status()
        return jsonify({
            "sensitivity": status['sensitivity'],
            "cooldown": status['cooldown'],
            "buffer_seconds": status['buffer_seconds']
        })
    
    # POST - update settings
    data = request.get_json() or {}
    result = Camera.set_motion_settings(
        sensitivity=data.get('sensitivity'),
        cooldown=data.get('cooldown'),
        buffer_seconds=data.get('buffer_seconds')
    )
    return jsonify(result)
