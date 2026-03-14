from functools import wraps
from flask import session, redirect, url_for, flash

def admin_required(f):
    """
    Decorator to protect routes that require Admin access.
    Usage:
    @app.route('/admin-dashboard')
    @admin_required
    def admin_dashboard():
        return render_template('admin.html')
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is logged in and is an admin
        if not session.get("isLoggedIn") or session.get("role") != "admin":
            # If not an admin, redirect to user dashboard
            flash("Access Denied: Admin role required.", "danger")
            return redirect(url_for("user_dashboard"))
        return f(*args, **kwargs)
    return decorated_function
