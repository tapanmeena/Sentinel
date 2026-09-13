/**
 * SENTINEL Security Dashboard - Common JavaScript
 * Shared functionality for all pages
 * Note: This provides base functionality. Page-specific JS files may override.
 */

// ========== Theme Management ==========
// Only define if not already defined by page-specific JS
if (typeof window.initTheme === 'undefined') {
    window.initTheme = function() {
        const theme = localStorage.getItem('sentinel-theme') || 'light';
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
window.loadStorageStats = async function() {
    const meter = document.getElementById('sidebar-storage-meter');
    const percent = document.getElementById('sidebar-storage-percent');
    const detail = document.getElementById('sidebar-storage-detail');
    if (!meter || window._storageStatsPending) return;
    window._storageStatsPending = true;
    const formatBytes = bytes => {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const unit = Math.min(Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)), units.length - 1);
        return `${(bytes / 1024 ** unit).toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
    };
    try {
        const response = await fetch('/api/storage/stats', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Storage unavailable');
        const data = await response.json();
        const usage = data.disk_usage;
        if (usage?.total_bytes > 0) {
            const used = Math.min(100, Math.max(0, Math.round(usage.used_bytes / usage.total_bytes * 100)));
            meter.value = used;
            meter.hidden = false;
            meter.setAttribute('aria-label', `Local storage ${used}% used`);
            percent.textContent = `${used}%`;
            detail.textContent = `${formatBytes(usage.free_bytes)} available`;
        } else {
            meter.hidden = true;
            percent.textContent = '--';
            detail.textContent = `${formatBytes(data.total_size_bytes || 0)} in recordings`;
        }
        document.getElementById('sidebar-connection-dot')?.classList.add('connected');
    } catch {
        meter.hidden = true;
        percent.textContent = '--';
        detail.textContent = 'Storage unavailable';
    } finally {
        window._storageStatsPending = false;
    }
};

// Mark that common.js has loaded
window._commonJsLoaded = true;

// Initialize immediately for theme (prevents flash)
window.initTheme();

// Initialize other features when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
    window.loadStorageStats();
    document.querySelectorAll('[data-device-preview]').forEach(image => {
        image.addEventListener('error', () => { image.hidden = true; });
    });
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
        if (document.getElementById('recordings-count')) window.loadRecordingsCount();
    }
});
