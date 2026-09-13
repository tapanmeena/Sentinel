/**
 * SENTINEL Security Dashboard - Settings Page JavaScript
 */

window._pageJsInitialized = true;

// ========== State ==========
const state = {
    motionEnabled: false,
    motionSettings: {
        sensitivity: 30,
        cooldown: 10,
        buffer_seconds: 5
    },
    // Theme state
    theme: localStorage.getItem('sentinel-theme') || 'light',
    // Mobile nav state
    mobileNavOpen: false
};

// ========== Time & Date Display ==========
function updateDateTime() {
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
}

// ========== Motion Detection ==========
async function loadMotionStatus() {
    try {
        const response = await fetch('/api/motion/status');
        const data = await response.json();
        
        state.motionEnabled = data.enabled;
        state.motionSettings = {
            sensitivity: data.sensitivity,
            cooldown: data.cooldown,
            buffer_seconds: data.buffer_seconds
        };
        
        updateMotionUI();
        updateMotionSettingsUI();
    } catch (error) {
        console.error('Failed to load motion status:', error);
    }
}

function updateMotionUI() {
    const toggle = document.getElementById('motion-toggle');
    const statusIndicator = document.getElementById('motion-status-indicator');
    const settings = document.getElementById('motion-settings');
    
    // Update toggle
    if (toggle) {
        toggle.checked = state.motionEnabled;
    }
    
    // Update status indicator
    if (statusIndicator) {
        const dot = statusIndicator.querySelector('.status-dot');
        const text = statusIndicator.querySelector('span');
        
        if (state.motionEnabled) {
            dot.classList.add('active');
            text.textContent = 'Enabled - Monitoring for motion';
        } else {
            dot.classList.remove('active');
            text.textContent = 'Disabled';
        }
    }
    
    // Show/hide settings (always visible but indicate state)
    if (settings) {
        settings.classList.toggle('disabled', !state.motionEnabled);
    }
}

function updateMotionSettingsUI() {
    // Sensitivity
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityValue = document.getElementById('sensitivity-value');
    if (sensitivitySlider) {
        sensitivitySlider.value = state.motionSettings.sensitivity;
    }
    if (sensitivityValue) {
        const level = getSensitivityLevel(state.motionSettings.sensitivity);
        sensitivityValue.textContent = `${level} (${state.motionSettings.sensitivity})`;
    }
    
    // Cooldown
    const cooldownSlider = document.getElementById('cooldown-slider');
    const cooldownValue = document.getElementById('cooldown-value');
    if (cooldownSlider) {
        cooldownSlider.value = state.motionSettings.cooldown;
    }
    if (cooldownValue) {
        cooldownValue.textContent = `${state.motionSettings.cooldown} seconds`;
    }
    
    // Buffer
    const bufferSlider = document.getElementById('buffer-slider');
    const bufferValue = document.getElementById('buffer-value');
    if (bufferSlider) {
        bufferSlider.value = state.motionSettings.buffer_seconds;
    }
    if (bufferValue) {
        bufferValue.textContent = `${state.motionSettings.buffer_seconds} seconds`;
    }
}

function getSensitivityLevel(value) {
    if (value <= 15) return 'High';
    if (value <= 30) return 'Medium';
    if (value <= 50) return 'Low';
    return 'Very Low';
}

async function toggleMotion(enabled) {
    try {
        const endpoint = enabled ? '/api/motion/enable' : '/api/motion/disable';
        const response = await fetch(endpoint, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            state.motionEnabled = enabled;
            updateMotionUI();
            showNotification(
                enabled ? 'Motion detection enabled' : 'Motion detection disabled',
                'success'
            );
        } else {
            showNotification(data.message || 'Failed to toggle motion detection', 'error');
            // Revert toggle
            const toggle = document.getElementById('motion-toggle');
            if (toggle) toggle.checked = !enabled;
        }
    } catch (error) {
        console.error('Motion toggle error:', error);
        showNotification('Connection error', 'error');
    }
}

// No polling needed on settings page - just load once

async function updateMotionSetting(setting, value) {
    try {
        const response = await fetch('/api/motion/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [setting]: value })
        });
        const data = await response.json();
        
        if (data.success) {
            state.motionSettings = data.settings;
            updateMotionSettingsUI();
            showNotification('Setting updated', 'success');
        }
    } catch (error) {
        console.error('Motion settings error:', error);
        showNotification('Failed to update setting', 'error');
    }
}

// ========== Recordings Count ==========
async function loadRecordingsCount() {
    try {
        const response = await fetch('/api/recordings');
        const data = await response.json();
        
        const countEl = document.getElementById('recordings-count');
        if (countEl) {
            countEl.textContent = data.recordings.length;
        }
        
        const totalEl = document.getElementById('total-recordings');
        if (totalEl) {
            totalEl.textContent = `${data.recordings.length} recordings`;
        }
    } catch (error) {
        console.error('Failed to load recordings count:', error);
    }
}

// ========== Notifications ==========
function createNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}

function showNotification(message, type = 'info') {
    const container = createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };
    
    notification.innerHTML = `
        ${icons[type] || icons.info}
        <span class="notification-message">${message}</span>
        <button class="notification-dismiss" aria-label="Dismiss">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    
    const dismissBtn = notification.querySelector('.notification-dismiss');
    dismissBtn.addEventListener('click', () => dismissNotification(notification));
    
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            dismissNotification(notification);
        }
    }, 3000);
}

function dismissNotification(notification) {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
}

// ========== Theme Toggle ==========
function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('sentinel-theme', state.theme);
}

// ========== Mobile Navigation ==========
function openMobileNav() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-nav-overlay');
    
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    state.mobileNavOpen = true;
    document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-nav-overlay');
    
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    state.mobileNavOpen = false;
    document.body.style.overflow = '';
}

function initMobileNav() {
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const closeBtn = document.querySelector('.sidebar-close');
    const overlay = document.querySelector('.mobile-nav-overlay');
    
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', openMobileNav);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMobileNav);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeMobileNav);
    }
    
    // Close on nav item click (mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (state.mobileNavOpen) {
                closeMobileNav();
            }
        });
    });
}

// ========== Event Listeners ==========
function initializeEventListeners() {
    // Motion toggle
    const motionToggle = document.getElementById('motion-toggle');
    if (motionToggle) {
        motionToggle.addEventListener('change', (e) => {
            toggleMotion(e.target.checked);
        });
    }
    
    // Sensitivity slider
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const sensitivityValue = document.getElementById('sensitivity-value');
            if (sensitivityValue) {
                const level = getSensitivityLevel(value);
                sensitivityValue.textContent = `${level} (${value})`;
            }
        });
        sensitivitySlider.addEventListener('change', (e) => {
            updateMotionSetting('sensitivity', parseInt(e.target.value));
        });
    }
    
    // Cooldown slider
    const cooldownSlider = document.getElementById('cooldown-slider');
    if (cooldownSlider) {
        cooldownSlider.addEventListener('input', (e) => {
            const cooldownValue = document.getElementById('cooldown-value');
            if (cooldownValue) {
                cooldownValue.textContent = `${e.target.value} seconds`;
            }
        });
        cooldownSlider.addEventListener('change', (e) => {
            updateMotionSetting('cooldown', parseInt(e.target.value));
        });
    }
    
    // Buffer slider
    const bufferSlider = document.getElementById('buffer-slider');
    if (bufferSlider) {
        bufferSlider.addEventListener('input', (e) => {
            const bufferValue = document.getElementById('buffer-value');
            if (bufferValue) {
                bufferValue.textContent = `${e.target.value} seconds`;
            }
        });
        bufferSlider.addEventListener('change', (e) => {
            updateMotionSetting('buffer_seconds', parseInt(e.target.value));
        });
    }
    
    // Theme toggle button
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme first
    initTheme();
    
    // Start time updates
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Initialize mobile navigation
    initMobileNav();
    
    // Load data
    loadMotionStatus();
    loadRecordingsCount();
    
    // Initialize event listeners
    initializeEventListeners();
    
    console.log('SENTINEL Settings initialized');
});
