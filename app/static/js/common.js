/**
 * SENTINEL Security Dashboard - Common JavaScript
 * Shared functionality for all pages
 * Note: This provides base functionality. Page-specific JS files may override.
 */

// ========== Theme Management ==========
// Only define if not already defined by page-specific JS
if (typeof window.initTheme === 'undefined') {
    window.initTheme = function() {
        const theme = localStorage.getItem('sentinel-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    };
}

if (typeof window.toggleTheme === 'undefined') {
    window.toggleTheme = function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('sentinel-theme', newTheme);
    };
}

// ========== Mobile Navigation ==========
if (typeof window.openMobileNav === 'undefined') {
    window.openMobileNav = function() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
}

if (typeof window.closeMobileNav === 'undefined') {
    window.closeMobileNav = function() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    };
}

if (typeof window.initMobileNav === 'undefined') {
    window.initMobileNav = function() {
        const hamburgerBtn = document.querySelector('.hamburger-btn');
        const closeBtn = document.querySelector('.sidebar-close');
        const overlay = document.querySelector('.mobile-nav-overlay');

        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', window.openMobileNav);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', window.closeMobileNav);
        }

        if (overlay) {
            overlay.addEventListener('click', window.closeMobileNav);
        }

        // Close on nav item click (mobile)
        document.querySelectorAll('.sidebar .nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    window.closeMobileNav();
                }
            });
        });
    };
}

// ========== Time & Date Display ==========
if (typeof window.updateDateTime === 'undefined') {
    window.updateDateTime = function() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const timeElement = document.getElementById('time');
        if (timeElement) {
            timeElement.textContent = `${hours}:${minutes}:${seconds}`;
        }

        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        const dateElement = document.getElementById('date');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    };
}

// ========== Recordings Count ==========
if (typeof window.loadRecordingsCount === 'undefined') {
    window.loadRecordingsCount = function() {
        fetch('/api/recordings')
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('recordings-count');
                if (el) el.textContent = data.recordings?.length || 0;
            })
            .catch(() => {});
    };
}

// ========== Initialize Common Features ==========
// Mark that common.js has loaded
window._commonJsLoaded = true;

// Initialize immediately for theme (prevents flash)
window.initTheme();

// Initialize other features when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Only run if page-specific JS hasn't already initialized these
    if (!window._pageJsInitialized) {
        // Theme toggle button
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle && !themeToggle._themeToggleInitialized) {
            themeToggle.addEventListener('click', window.toggleTheme);
            themeToggle._themeToggleInitialized = true;
        }
        
        // Mobile navigation
        window.initMobileNav();
        
        // Time display
        window.updateDateTime();
        setInterval(window.updateDateTime, 1000);
        
        // Load recordings count
        window.loadRecordingsCount();
    }
});
