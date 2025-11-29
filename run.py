#!/usr/bin/env python3
"""Entry point for the SENTINEL Security Dashboard application."""
from app import create_app
from config import Config

app = create_app()

if __name__ == '__main__':
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        threaded=True
    )
