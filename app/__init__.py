import os
import atexit
from flask import Flask
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Global reference for cleanup
_camera_manager_initialized = False


def create_app():
    """Application factory for creating the Flask app."""
    global _camera_manager_initialized
    
    app = Flask(__name__)
    
    # Load configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours in seconds
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    
    # In production (behind Cloudflare), cookies should be secure
    app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') != 'development'
    
    # Initialize camera manager with configuration
    # Only initialize once to prevent issues with Flask debug mode reloader
    from config import Config
    from app.camera import CameraManager
    
    # Release any existing cameras first (important for debug mode restarts)
    if _camera_manager_initialized:
        CameraManager.release_all()
        CameraManager._initialized = False
    
    CameraManager.initialize(Config.CAMERAS)
    _camera_manager_initialized = True
    
    # Register cleanup on exit
    def cleanup_cameras():
        CameraManager.release_all()
    
    atexit.register(cleanup_cameras)
    
    # Register blueprints
    from app.routes import main_bp
    from app.auth_routes import auth_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    
    return app
