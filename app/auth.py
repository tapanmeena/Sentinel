"""Authentication module for SENTINEL Security Dashboard."""
import os
import hashlib
import secrets
from functools import wraps
from flask import session, redirect, url_for, request


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
    return username == stored_username and password == stored_password


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
    """Check if user is currently logged in."""
    return session.get('logged_in', False)


def login_required(f):
    """Decorator to require login for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_logged_in():
            # Store the requested URL for redirect after login
            session['next_url'] = request.url
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """Get the current logged in username."""
    return session.get('username', None)
