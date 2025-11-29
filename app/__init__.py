from flask import Flask

def create_app():
    """Application factory for creating the Flask app."""
    app = Flask(__name__)
    
    # Register blueprints
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    
    return app
