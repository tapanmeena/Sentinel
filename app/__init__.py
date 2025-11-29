import os
from flask import Flask
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def create_app():
    """Application factory for creating the Flask app."""
    app = Flask(__name__)
    
    # Load configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours in seconds
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    
    # In production (behind Cloudflare), cookies should be secure
    app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') != 'development'
    
    # Register blueprints
    from app.routes import main_bp
    from app.auth_routes import auth_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    
    return app
