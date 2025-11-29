"""Route definitions for the Flask application."""
from flask import Blueprint, Response, render_template
from app.camera import Camera

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')


@main_bp.route('/stream')
def stream():
    """Video streaming route."""
    return Response(
        Camera.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )
