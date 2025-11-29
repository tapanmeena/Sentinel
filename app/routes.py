"""Route definitions for the Flask application."""
from flask import Blueprint, Response, render_template, jsonify, send_from_directory, request
from app.camera import Camera, CameraManager
from app.auth import login_required, get_current_user
import os

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
@login_required
def index():
    """Render the main dashboard page."""
    camera_info = Camera.get_camera_info()
    cameras = CameraManager.get_cameras_dict()
    return render_template('index.html', username=get_current_user(), camera=camera_info, cameras=cameras)


@main_bp.route('/recordings')
@login_required
def recordings_page():
    """Render the recordings page."""
    cameras = CameraManager.get_cameras_dict()
    return render_template('recordings.html', username=get_current_user(), cameras=cameras)


@main_bp.route('/settings')
@login_required
def settings_page():
    """Render the settings page."""
    camera_info = Camera.get_camera_info()
    cameras = CameraManager.get_cameras_dict()
    return render_template('settings.html', username=get_current_user(), camera=camera_info, cameras=cameras)


@main_bp.route('/devices')
@login_required
def devices_page():
    """Render the devices page."""
    cameras = CameraManager.get_cameras_dict()
    cameras_status = CameraManager.get_all_status()
    return render_template('devices.html', username=get_current_user(), cameras=cameras, cameras_status=cameras_status)


# ========== Multi-Camera API ==========

@main_bp.route('/api/cameras')
@login_required
def list_cameras():
    """Get list of all cameras with their status."""
    cameras = CameraManager.get_all_status()
    return jsonify({"cameras": cameras})


@main_bp.route('/api/camera/<camera_id>/status')
@login_required
def camera_status(camera_id):
    """Get status of a specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    return jsonify(camera.get_status())


@main_bp.route('/stream')
@login_required
def stream():
    """Video streaming route (default camera)."""
    return Response(
        Camera.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@main_bp.route('/stream/<camera_id>')
@login_required
def stream_camera(camera_id):
    """Video streaming route for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    return Response(
        camera.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


# ========== Recording API ==========

@main_bp.route('/api/recording/start', methods=['POST'])
@login_required
def start_recording():
    """Start video recording (default camera)."""
    result = Camera.start_recording()
    return jsonify(result)


@main_bp.route('/api/recording/start/<camera_id>', methods=['POST'])
@login_required
def start_recording_camera(camera_id):
    """Start video recording for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"success": False, "message": "Camera not found"}), 404
    result = camera.start_recording()
    return jsonify(result)


@main_bp.route('/api/recording/stop', methods=['POST'])
@login_required
def stop_recording():
    """Stop video recording (default camera)."""
    result = Camera.stop_recording()
    return jsonify(result)


@main_bp.route('/api/recording/stop/<camera_id>', methods=['POST'])
@login_required
def stop_recording_camera(camera_id):
    """Stop video recording for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"success": False, "message": "Camera not found"}), 404
    result = camera.stop_recording()
    return jsonify(result)


@main_bp.route('/api/recording/status')
@login_required
def recording_status():
    """Get current recording status (default camera)."""
    result = Camera.get_recording_status()
    return jsonify(result)


@main_bp.route('/api/recording/status/<camera_id>')
@login_required
def recording_status_camera(camera_id):
    """Get current recording status for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    result = camera.get_recording_status()
    return jsonify(result)


@main_bp.route('/api/recordings')
@login_required
def list_recordings():
    """Get list of all recordings, optionally filtered by camera."""
    camera_id = request.args.get('camera_id')
    recordings = CameraManager.get_recordings_list(camera_id)
    return jsonify({"recordings": recordings})


@main_bp.route('/api/recordings/<camera_id>/<filename>', methods=['DELETE'])
@login_required
def delete_recording_camera(camera_id, filename):
    """Delete a recording file from specific camera."""
    result = CameraManager.delete_recording(camera_id, filename)
    return jsonify(result)


@main_bp.route('/api/recordings/<filename>', methods=['DELETE'])
@login_required
def delete_recording(filename):
    """Delete a recording file (searches all cameras)."""
    result = Camera.delete_recording(filename)
    return jsonify(result)


# ========== Snapshot API ==========

@main_bp.route('/api/snapshot', methods=['POST'])
@login_required
def capture_snapshot():
    """Capture a snapshot image (default camera)."""
    result = Camera.capture_snapshot()
    return jsonify(result)


@main_bp.route('/api/snapshot/<camera_id>', methods=['POST'])
@login_required
def capture_snapshot_camera(camera_id):
    """Capture a snapshot image from specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"success": False, "message": "Camera not found"}), 404
    result = camera.capture_snapshot()
    return jsonify(result)


# ========== File Download Routes ==========

@main_bp.route('/recordings/<camera_id>/<filename>')
@login_required
def download_recording_camera(camera_id, filename):
    """Download a recording file from specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    recordings_dir = os.path.join(os.getcwd(), 'recordings', camera_id)
    return send_from_directory(recordings_dir, filename, as_attachment=True)


@main_bp.route('/recordings/<filename>')
@login_required
def download_recording(filename):
    """Download a recording file (legacy - searches default camera)."""
    recordings_dir = os.path.join(os.getcwd(), 'recordings')
    # Try default camera directory first
    default_camera = CameraManager.get_default()
    if default_camera:
        cam_dir = os.path.join(recordings_dir, default_camera.camera_id)
        if os.path.exists(os.path.join(cam_dir, filename)):
            return send_from_directory(cam_dir, filename, as_attachment=True)
    # Fallback to legacy flat structure
    return send_from_directory(recordings_dir, filename, as_attachment=True)


@main_bp.route('/recordings/play/<camera_id>/<filename>')
@login_required
def play_recording_camera(camera_id, filename):
    """Stream a recording file for playback from specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    recordings_dir = os.path.join(os.getcwd(), 'recordings', camera_id)
    return send_from_directory(recordings_dir, filename, as_attachment=False, mimetype='video/mp4')


@main_bp.route('/recordings/play/<filename>')
@login_required
def play_recording(filename):
    """Stream a recording file for playback (legacy)."""
    recordings_dir = os.path.join(os.getcwd(), 'recordings')
    default_camera = CameraManager.get_default()
    if default_camera:
        cam_dir = os.path.join(recordings_dir, default_camera.camera_id)
        if os.path.exists(os.path.join(cam_dir, filename)):
            return send_from_directory(cam_dir, filename, as_attachment=False, mimetype='video/mp4')
    return send_from_directory(recordings_dir, filename, as_attachment=False, mimetype='video/mp4')


@main_bp.route('/snapshots/<camera_id>/<filename>')
@login_required
def download_snapshot_camera(camera_id, filename):
    """Download a snapshot file from specific camera."""
    snapshots_dir = os.path.join(os.getcwd(), 'snapshots', camera_id)
    return send_from_directory(snapshots_dir, filename, as_attachment=True)


@main_bp.route('/snapshots/<filename>')
@login_required
def download_snapshot(filename):
    """Download a snapshot file (legacy)."""
    snapshots_dir = os.path.join(os.getcwd(), 'snapshots')
    default_camera = CameraManager.get_default()
    if default_camera:
        cam_dir = os.path.join(snapshots_dir, default_camera.camera_id)
        if os.path.exists(os.path.join(cam_dir, filename)):
            return send_from_directory(cam_dir, filename, as_attachment=True)
    return send_from_directory(snapshots_dir, filename, as_attachment=True)


@main_bp.route('/thumbnails/<camera_id>/<filename>')
@login_required
def get_thumbnail_camera(camera_id, filename):
    """Serve a recording thumbnail from specific camera."""
    thumbnails_dir = os.path.join(os.getcwd(), 'thumbnails', camera_id)
    return send_from_directory(thumbnails_dir, filename, as_attachment=False)


@main_bp.route('/thumbnails/<filename>')
@login_required
def get_thumbnail(filename):
    """Serve a recording thumbnail (legacy)."""
    thumbnails_dir = os.path.join(os.getcwd(), 'thumbnails')
    default_camera = CameraManager.get_default()
    if default_camera:
        cam_dir = os.path.join(thumbnails_dir, default_camera.camera_id)
        if os.path.exists(os.path.join(cam_dir, filename)):
            return send_from_directory(cam_dir, filename, as_attachment=False)
    return send_from_directory(thumbnails_dir, filename, as_attachment=False)


# ========== Motion Detection API ==========

@main_bp.route('/api/motion/status')
@login_required
def motion_status():
    """Get motion detection status (default camera)."""
    result = Camera.get_motion_status()
    return jsonify(result)


@main_bp.route('/api/motion/status/<camera_id>')
@login_required
def motion_status_camera(camera_id):
    """Get motion detection status for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    result = camera.get_motion_status()
    return jsonify(result)


@main_bp.route('/api/motion/enable', methods=['POST'])
@login_required
def enable_motion():
    """Enable motion detection (default camera)."""
    result = Camera.enable_motion_detection()
    return jsonify(result)


@main_bp.route('/api/motion/enable/<camera_id>', methods=['POST'])
@login_required
def enable_motion_camera(camera_id):
    """Enable motion detection for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"success": False, "message": "Camera not found"}), 404
    result = camera.enable_motion_detection()
    CameraManager.save_motion_configs()
    return jsonify(result)


@main_bp.route('/api/motion/disable', methods=['POST'])
@login_required
def disable_motion():
    """Disable motion detection (default camera)."""
    result = Camera.disable_motion_detection()
    return jsonify(result)


@main_bp.route('/api/motion/disable/<camera_id>', methods=['POST'])
@login_required
def disable_motion_camera(camera_id):
    """Disable motion detection for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"success": False, "message": "Camera not found"}), 404
    result = camera.disable_motion_detection()
    CameraManager.save_motion_configs()
    return jsonify(result)


@main_bp.route('/api/motion/settings', methods=['GET', 'POST'])
@login_required
def motion_settings():
    """Get or update motion detection settings (default camera)."""
    if request.method == 'GET':
        status = Camera.get_motion_status()
        return jsonify({
            "sensitivity": status.get('sensitivity'),
            "cooldown": status.get('cooldown'),
            "buffer_seconds": status.get('buffer_seconds'),
            "highlight_motion": status.get('highlight_motion', True)
        })
    
    # POST - update settings
    data = request.get_json() or {}
    result = Camera.set_motion_settings(
        sensitivity=data.get('sensitivity'),
        cooldown=data.get('cooldown'),
        buffer_seconds=data.get('buffer_seconds'),
        highlight_motion=data.get('highlight_motion')
    )
    return jsonify(result)


@main_bp.route('/api/motion/settings/<camera_id>', methods=['GET', 'POST'])
@login_required
def motion_settings_camera(camera_id):
    """Get or update motion detection settings for specific camera."""
    camera = CameraManager.get(camera_id)
    if not camera:
        return jsonify({"error": "Camera not found"}), 404
    
    if request.method == 'GET':
        status = camera.get_motion_status()
        return jsonify({
            "sensitivity": status.get('sensitivity'),
            "cooldown": status.get('cooldown'),
            "buffer_seconds": status.get('buffer_seconds'),
            "highlight_motion": status.get('highlight_motion', True)
        })
    
    # POST - update settings
    data = request.get_json() or {}
    result = camera.set_motion_settings(
        sensitivity=data.get('sensitivity'),
        cooldown=data.get('cooldown'),
        buffer_seconds=data.get('buffer_seconds'),
        highlight_motion=data.get('highlight_motion')
    )
    CameraManager.save_motion_configs()
    return jsonify(result)
