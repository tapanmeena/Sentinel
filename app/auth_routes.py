"""Authentication routes for SENTINEL Security Dashboard."""
from __future__ import annotations

import base64
import hashlib
import secrets
from urllib.parse import urlencode, urlsplit

import requests
from flask import Blueprint, render_template, request, redirect, url_for, session

from app.auth import (
    get_authkit_client_id,
    get_authkit_issuer_url,
    is_local_auth_enabled,
    is_logged_in,
    login_user,
    logout_user,
    verify_authkit_access_token,
    verify_credentials,
)

auth_bp = Blueprint('auth', __name__)


def _is_safe_next_url(target: str | None) -> bool:
    if not target:
        return False
    parsed = urlsplit(target)
    if not parsed.scheme and not parsed.netloc:
        return target.startswith('/') and not target.startswith('//')
    host_parsed = urlsplit(request.host_url)
    return parsed.scheme in ('http', 'https') and parsed.netloc == host_parsed.netloc


def _pop_safe_next_url() -> str | None:
    next_url = session.pop('next_url', None)
    return next_url if _is_safe_next_url(next_url) else None


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    if is_logged_in():
        return redirect(url_for('main.index'))

    local_auth_enabled = is_local_auth_enabled()
    error = None

    if request.method == 'POST':
        if not local_auth_enabled:
            error = 'Local password sign-in is disabled. Please sign in with One Auth.'
            return render_template(
                'login.html',
                error=error,
                local_auth_enabled=False,
            ), 403

        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if verify_credentials(username, password):
            login_user(username)
            next_url = _pop_safe_next_url()
            if next_url:
                return redirect(next_url)
            return redirect(url_for('main.index'))
        error = 'Invalid username or password'

    return render_template(
        'login.html',
        error=error,
        local_auth_enabled=local_auth_enabled,
    )


@auth_bp.route('/auth/oidc/login')
def oidc_login():
    """Initiate OAuth 2.1 + S256 PKCE login with AuthKit (One Auth)."""
    if is_logged_in():
        return redirect(url_for('main.index'))

    requested_next = request.args.get('next')
    if _is_safe_next_url(requested_next) and 'next_url' not in session:
        session['next_url'] = requested_next

    code_verifier = secrets.token_urlsafe(48)
    code_challenge = _pkce_challenge(code_verifier)
    state = secrets.token_urlsafe(24)

    session['oidc_code_verifier'] = code_verifier
    session['oidc_state'] = state

    params = {
        'response_type': 'code',
        'client_id': get_authkit_client_id(),
        'redirect_uri': url_for('auth.oidc_callback', _external=True),
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
        'state': state,
        'scope': 'openid profile email',
    }
    authorize_url = f"{get_authkit_issuer_url()}/oauth/authorize?{urlencode(params)}"
    return redirect(authorize_url)


@auth_bp.route('/auth/callback')
def oidc_callback():
    """Handle OAuth 2.1 authorization code callback from AuthKit."""
    expected_state = session.pop('oidc_state', None)
    code_verifier = session.pop('oidc_code_verifier', None)
    local_auth_enabled = is_local_auth_enabled()

    provider_error = request.args.get('error')
    if provider_error:
        description = request.args.get('error_description') or 'Sign-in was cancelled or denied.'
        return render_template(
            'login.html',
            error=description,
            local_auth_enabled=local_auth_enabled,
        ), 400

    state = request.args.get('state', '')
    if not expected_state or not state or not secrets.compare_digest(state, expected_state):
        return render_template(
            'login.html',
            error='Invalid or expired login state. Please try signing in again.',
            local_auth_enabled=local_auth_enabled,
        ), 400

    code = request.args.get('code', '').strip()
    if not code or not code_verifier:
        return render_template(
            'login.html',
            error='Missing authorization code. Please try signing in again.',
            local_auth_enabled=local_auth_enabled,
        ), 400

    token_url = f"{get_authkit_issuer_url()}/oauth/token"
    try:
        token_resp = requests.post(
            token_url,
            json={
                'grant_type': 'authorization_code',
                'client_id': get_authkit_client_id(),
                'code': code,
                'redirect_uri': url_for('auth.oidc_callback', _external=True),
                'code_verifier': code_verifier,
            },
            headers={'Accept': 'application/json'},
            timeout=10,
        )
    except requests.RequestException:
        return render_template(
            'login.html',
            error='Could not reach One Auth token server. Please try again.',
            local_auth_enabled=local_auth_enabled,
        ), 502

    if not token_resp.ok:
        return render_template(
            'login.html',
            error='Failed to verify authorization code with One Auth.',
            local_auth_enabled=local_auth_enabled,
        ), 401

    try:
        token_data = token_resp.json()
    except ValueError:
        return render_template(
            'login.html',
            error='Invalid response from One Auth token server.',
            local_auth_enabled=local_auth_enabled,
        ), 502

    access_token = token_data.get('access_token') if isinstance(token_data, dict) else None
    email = verify_authkit_access_token(access_token) if isinstance(access_token, str) else None
    if not email:
        return render_template(
            'login.html',
            error='Your One Auth account is not authorized to access Sentinel.',
            local_auth_enabled=local_auth_enabled,
        ), 403

    login_user(email)
    next_url = _pop_safe_next_url()
    if next_url:
        return redirect(next_url)
    return redirect(url_for('main.index'))


@auth_bp.route('/logout')
def logout():
    """Handle user logout."""
    logout_user()
    return redirect(url_for('auth.login'))
