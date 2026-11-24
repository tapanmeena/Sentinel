"""Configuration settings for the application."""
import os
from datetime import timedelta

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = False
    TESTING = False
    
    # Session settings
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = True  # Only send cookie over HTTPS
    SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access
    SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF protection
    
    # Server settings
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 8034))

    # AuthKit (One Auth) settings
    AUTHKIT_ISSUER_URL = os.environ.get('AUTHKIT_ISSUER_URL', 'https://auth.tapanmeena.com').rstrip('/')
    AUTHKIT_JWKS_URL = os.environ.get('AUTHKIT_JWKS_URL', '')
    AUTHKIT_POOL_SLUG = os.environ.get('AUTHKIT_POOL_SLUG', 'one-auth')
    AUTHKIT_CLIENT_ID = os.environ.get('AUTHKIT_CLIENT_ID', 'sentinel-web')
    SENTINEL_ALLOWED_EMAILS = os.environ.get('SENTINEL_ALLOWED_EMAILS', '')
    SENTINEL_LOCAL_AUTH_ENABLED = os.environ.get('SENTINEL_LOCAL_AUTH_ENABLED', 'false').lower() in ('1', 'true', 'yes')
    
    # Legacy camera settings (for backwards compatibility)
    CAMERA_RESOLUTION = (1920, 1080)
    CAMERA_FRAMERATE = 30
    
    # Multi-camera configuration
    # Each camera has: type, name, enabled, resolution, framerate
    # For Pi cameras: index (camera_num for Picamera2)
    # For RTSP cameras: url (supports {ENV_VAR} substitution for credentials)
    #
    # RTSP URL credentials can use environment variables:
    #   - RTSP_CAM2_USER, RTSP_CAM2_PASS for cam2
    #   - RTSP_CAM3_USER, RTSP_CAM3_PASS for cam3, etc.
    #
    # Example .env file:
    #   RTSP_CAM2_USER=admin
    #   RTSP_CAM2_PASS=secretpassword
    #
    CAMERAS = {
        'cam1': {
            'type': 'picamera',
            'name': 'Main Camera',
            'enabled': True,
            'index': 0,
            'resolution': (1920, 1080),
            'framerate': 30,
        },
        # Example RTSP camera (commented out by default):
        # 'cam2': {
        #     'type': 'rtsp',
        #     'name': 'Backyard Camera',
        #     'enabled': True,
        #     'url': 'rtsp://{RTSP_CAM2_USER}:{RTSP_CAM2_PASS}@192.168.1.100:554/stream1',
        #     'resolution': (1280, 720),
        #     'framerate': 15,
        # },
        # 'cam3': {
        #     'type': 'rtsp',
        #     'name': 'Front Door',
        #     'enabled': True,
        #     'url': 'rtsp://{RTSP_CAM3_USER}:{RTSP_CAM3_PASS}@192.168.1.101:554/h264',
        #     'resolution': (1920, 1080),
        #     'framerate': 30,
        # },
    }


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SESSION_COOKIE_SECURE = False  # Allow HTTP in development


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SENTINEL_LOCAL_AUTH_ENABLED = True


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
