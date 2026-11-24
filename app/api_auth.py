"""JSON authentication API for native clients.

Tokens are stateless signed values (no server-side store exists), so logout is a
client-side discard; tokens otherwise expire on their own.
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from app.auth import (
    MEDIA_TOKEN_MAX_AGE,
    SESSION_TOKEN_MAX_AGE,
    create_media_token,
    create_session_token,
    get_current_user,
    is_local_auth_enabled,
    login_required,
    logout_user,
    verify_credentials,
)

api_auth_bp = Blueprint('api_auth', __name__, url_prefix='/api/auth')


@api_auth_bp.route('/login', methods=['POST'])
def api_login():
    """Exchange emergency local credentials for a bearer token when enabled."""
    if not is_local_auth_enabled():
        return jsonify({"error": "Local login is disabled; sign in with One Auth"}), 403

    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', ''))

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if not verify_credentials(username, password):
        return jsonify({"error": "Invalid username or password"}), 401

    expires_at = datetime.now() + timedelta(seconds=SESSION_TOKEN_MAX_AGE)
    return jsonify({
        "token": create_session_token(username),
        "username": username,
        "expires_at": expires_at.isoformat(),
    })


@api_auth_bp.route('/logout', methods=['POST'])
@login_required
def api_logout():
    """Clear any browser session; token clients discard the token themselves."""
    logout_user()
    return jsonify({"success": True})


@api_auth_bp.route('/me', methods=['GET'])
@login_required
def api_me():
    """Report the authenticated identity and server capabilities."""
    return jsonify({
        "username": get_current_user(),
        "authenticated": True,
        "server": "sentinel",
    })


@api_auth_bp.route('/media-token', methods=['POST'])
@login_required
def api_media_token():
    """Issue a short-lived, read-only token for media URLs."""
    return jsonify({
        "token": create_media_token(get_current_user()),
        "expires_in": MEDIA_TOKEN_MAX_AGE,
    })
