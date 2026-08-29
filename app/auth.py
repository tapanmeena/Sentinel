"""Authentication module for SENTINEL Security Dashboard.

Supports two client types against the same routes:

* Browsers   -> Flask session cookie, redirected to the login page on failure.
* Native app -> stateless signed bearer tokens, given a JSON 401 on failure.
"""
import os
import hashlib
import secrets
from functools import wraps

from flask import session, redirect, url_for, request, jsonify, current_app, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

# Salts keep session tokens and media tokens mutually unusable even though both
# are signed with SECRET_KEY.
SESSION_TOKEN_SALT = 'sentinel.api.session'
MEDIA_TOKEN_SALT = 'sentinel.api.media'

SESSION_TOKEN_MAX_AGE = 30 * 24 * 60 * 60  # 30 days
MEDIA_TOKEN_MAX_AGE = 5 * 60  # 5 minutes

# Read-only media endpoints that may additionally be authenticated with a
# short-lived `?token=` query parameter, because <img>/<video> sources cannot
# carry an Authorization header.
MEDIA_ENDPOINTS = frozenset({
    'main.stream',
    'main.stream_camera',
    'main.embed_stream',
    'main.play_recording',
    'main.play_recording_camera',
    'main.download_recording',
    'main.download_recording_camera',
    'main.download_snapshot',
    'main.download_snapshot_camera',
    'main.get_thumbnail',
    'main.get_thumbnail_camera',
})


def get_credentials():
    """Get authentication credentials from environment."""
    username = os.environ.get('SENTINEL_USERNAME', 'admin')
    password = os.environ.get('SENTINEL_PASSWORD', 'sentinel')
    return username, password


def hash_password(password):
    """Create a simple hash for password comparison."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_credentials(username, password):
    """Verify username and password against stored credentials."""
    stored_username, stored_password = get_credentials()
    # Both comparisons always run so the result does not leak which field failed.
    user_ok = secrets.compare_digest(str(username), stored_username)
    pass_ok = secrets.compare_digest(str(password), stored_password)
    return user_ok and pass_ok


def login_user(username):
    """Log in a user by setting session variables."""
    session['logged_in'] = True
    session['username'] = username
    session['session_token'] = secrets.token_hex(16)
    session.permanent = True


def logout_user():
    """Log out the current user."""
    session.clear()


def is_logged_in():
    """Check if the browser session is currently logged in."""
    return session.get('logged_in', False)


# ========== Signed token helpers ==========

def _serializer(salt):
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=salt)


def create_session_token(username):
    """Create a long-lived bearer token for API clients."""
    return _serializer(SESSION_TOKEN_SALT).dumps({'u': username})


def create_media_token(username):
    """Create a short-lived token for read-only media URLs."""
    return _serializer(MEDIA_TOKEN_SALT).dumps({'u': username})


def _load_token(token, salt, max_age):
    try:
        data = _serializer(salt).loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    return data.get('u')


def verify_session_token(token):
    """Return the username for a valid session token, otherwise None."""
    return _load_token(token, SESSION_TOKEN_SALT, SESSION_TOKEN_MAX_AGE)


def verify_media_token(token):
    """Return the username for a valid media token, otherwise None."""
    return _load_token(token, MEDIA_TOKEN_SALT, MEDIA_TOKEN_MAX_AGE)


def _bearer_token():
    header = request.headers.get('Authorization', '')
    if header.startswith('Bearer '):
        return header[7:].strip() or None
    return None


def authenticate_request():
    """Resolve the current user from bearer token, session cookie, or media token."""
    token = _bearer_token()
    if token:
        username = verify_session_token(token)
        if username:
            return username

    if is_logged_in():
        return session.get('username')

    # Query-param tokens are accepted only for read-only media endpoints. They
    # can leak into proxy access logs, so they expire in five minutes and are
    # signed with a salt that write endpoints never accept.
    if request.method == 'GET' and request.endpoint in MEDIA_ENDPOINTS:
        media_token = request.args.get('token')
        if media_token:
            username = verify_media_token(media_token)
            if username:
                return username

    return None


def wants_json_response():
    """Whether the caller expects a JSON error instead of a login redirect."""
    if request.path.startswith('/api/'):
        return True
    if request.headers.get('Authorization'):
        return True
    # A rejected `?token=` means an app client with a stale media token; a JSON
    # 401 lets it refresh instead of silently receiving the login page HTML.
    if request.args.get('token'):
        return True
    accept = request.accept_mimetypes
    return accept.accept_json and not accept.accept_html


def login_required(f):
    """Decorator to require authentication for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        username = authenticate_request()
        if not username:
            if wants_json_response():
                return jsonify({"error": "Authentication required"}), 401
            session['next_url'] = request.url
            return redirect(url_for('auth.login'))
        g.current_user = username
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """Get the current authenticated username."""
    return getattr(g, 'current_user', None) or session.get('username', None)
