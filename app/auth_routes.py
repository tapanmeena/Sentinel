"""Authentication routes for SENTINEL Security Dashboard."""
from flask import Blueprint, render_template, request, redirect, url_for, session
from app.auth import verify_credentials, login_user, logout_user, is_logged_in

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    # If already logged in, redirect to dashboard
    if is_logged_in():
        return redirect(url_for('main.index'))
    
    error = None
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        if verify_credentials(username, password):
            login_user(username)
            
            # Redirect to originally requested page or dashboard
            next_url = session.pop('next_url', None)
            if next_url:
                return redirect(next_url)
            return redirect(url_for('main.index'))
        else:
            error = 'Invalid username or password'
    
    return render_template('login.html', error=error)


@auth_bp.route('/logout')
def logout():
    """Handle user logout."""
    logout_user()
    return redirect(url_for('auth.login'))
