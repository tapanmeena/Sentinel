/**
 * SENTINEL Security Dashboard - Main JavaScript
 */

// ========== State Management ==========
const state = {
    isRecording: false,
    recSeconds: 0,
    recInterval: null,
    // Motion detection state
    motionEnabled: false,
    motionDetected: false,
    motionSettings: {
        sensitivity: 30,
        cooldown: 10,
        buffer_seconds: 5
    },
    // Info panel state
    infoVisible: false,
    // Multi-camera state
    cameras: window.CAMERAS || {},
    currentCameraId: null,
    cameraStatuses: {},
    gridViewActive: false,
    // Theme state
    theme: localStorage.getItem('sentinel-theme') || 'dark',
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

// ========== Recording Timer ==========
function formatTime(totalSeconds) {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

function updateRecTime() {
    state.recSeconds++;
    const recTimeElement = document.getElementById('rec-time');
    if (recTimeElement) {
        recTimeElement.textContent = formatTime(state.recSeconds);
    }
}

function startRecTimer(initialSeconds = 0) {
    state.recSeconds = initialSeconds;
    updateRecTimeDisplay();
    state.recInterval = setInterval(updateRecTime, 1000);
}

function stopRecTimer() {
    if (state.recInterval) {
        clearInterval(state.recInterval);
        state.recInterval = null;
    }
    state.recSeconds = 0;
    updateRecTimeDisplay();
}

function updateRecTimeDisplay() {
    const recTimeElement = document.getElementById('rec-time');
    if (recTimeElement) {
        recTimeElement.textContent = formatTime(state.recSeconds);
    }
}

// ========== Recording Controls ==========
async function toggleRecording() {
    const recBtn = document.getElementById('rec-btn');
    const recIndicator = document.querySelector('.rec-indicator');
    
    try {
        if (state.isRecording) {
            // Stop recording
            const response = await fetch('/api/recording/stop', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                state.isRecording = false;
                stopRecTimer();
                updateRecordingUI(false);
                showNotification('Recording saved', 'success');
            } else {
                showNotification(data.message || 'Failed to stop recording', 'error');
            }
        } else {
            // Start recording
            const response = await fetch('/api/recording/start', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                state.isRecording = true;
                startRecTimer();
                updateRecordingUI(true);
                showNotification('Recording started', 'success');
            } else {
                showNotification(data.message || 'Failed to start recording', 'error');
            }
        }
    } catch (error) {
        console.error('Recording error:', error);
        showNotification('Connection error', 'error');
    }
}

function updateRecordingUI(isRecording) {
    const recBtn = document.getElementById('rec-btn');
    const recIndicator = document.querySelector('.rec-indicator');
    const recBtnText = recBtn?.querySelector('span');
    
    if (isRecording) {
        // Recording active
        recBtn?.classList.add('rec-active');
        recBtn?.classList.remove('rec-inactive');
        if (recBtnText) recBtnText.textContent = 'STOP';
        if (recBtn) recBtn.title = 'Stop Recording';
        recIndicator?.classList.add('recording-active');
        recIndicator?.classList.remove('recording-inactive');
    } else {
        // Recording inactive
        recBtn?.classList.remove('rec-active');
        recBtn?.classList.add('rec-inactive');
        if (recBtnText) recBtnText.textContent = 'REC';
        if (recBtn) recBtn.title = 'Start Recording';
        recIndicator?.classList.remove('recording-active');
        recIndicator?.classList.add('recording-inactive');
    }
}

// ========== Snapshot ==========
async function captureSnapshot() {
    try {
        const response = await fetch('/api/snapshot', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Snapshot saved: ${data.filename}`, 'success');
        } else {
            showNotification('Failed to capture snapshot', 'error');
        }
    } catch (error) {
        console.error('Snapshot error:', error);
        showNotification('Connection error', 'error');
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
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Icon based on type
    const icons = {
        success: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };
    
    notification.innerHTML = `
        ${icons[type] || icons.info}
        <span class="notification-message">${message}</span>
        <button class="notification-dismiss" aria-label="Dismiss">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    
    // Add dismiss handler
    const dismissBtn = notification.querySelector('.notification-dismiss');
    dismissBtn.addEventListener('click', () => dismissNotification(notification));
    
    container.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            dismissNotification(notification);
        }
    }, 4000);
}

function dismissNotification(notification) {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
}

// ========== Fullscreen Toggle ==========
function toggleFullscreen() {
    const videoWrapper = document.querySelector('.video-wrapper');
    
    if (!videoWrapper) return;
    
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        videoWrapper.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    }
}

// ========== Check Recording Status ==========
async function checkRecordingStatus() {
    try {
        const response = await fetch('/api/recording/status');
        const data = await response.json();
        
        state.isRecording = data.is_recording;
        
        if (data.is_recording && data.duration) {
            startRecTimer(Math.floor(data.duration));
        }
        
        updateRecordingUI(data.is_recording);
    } catch (error) {
        console.error('Failed to check recording status:', error);
    }
}

// ========== Event Listeners ==========
function initializeEventListeners() {
    // Recording button
    const recBtn = document.getElementById('rec-btn');
    if (recBtn) {
        recBtn.addEventListener('click', toggleRecording);
    }
    
    // Snapshot button
    const snapshotBtn = document.getElementById('snapshot-btn');
    if (snapshotBtn) {
        snapshotBtn.addEventListener('click', captureSnapshot);
    }
    
    // Fullscreen buttons
    document.querySelectorAll('#fullscreen-btn, .action-btn[title="Fullscreen"]').forEach(btn => {
        btn.addEventListener('click', toggleFullscreen);
    });
    
    // Info button
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', toggleInfoPanel);
    }
    
    // Theme toggle button
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// ========== Info Panel Toggle ==========
function toggleInfoPanel() {
    const videoInfo = document.getElementById('video-info');
    const infoBtn = document.getElementById('info-btn');
    
    if (!videoInfo) return;
    
    state.infoVisible = !state.infoVisible;
    
    if (state.infoVisible) {
        videoInfo.style.display = 'block';
        if (infoBtn) infoBtn.classList.add('active');
    } else {
        videoInfo.style.display = 'none';
        if (infoBtn) infoBtn.classList.remove('active');
    }
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

// ========== Multi-Camera Support ==========
function initCameras() {
    // Get cameras from window object (injected by template)
    const cameraIds = Object.keys(state.cameras);
    if (cameraIds.length === 0) return;
    
    // Set initial camera
    state.currentCameraId = cameraIds[0];
    
    // Populate camera selector
    const cameraSelect = document.getElementById('camera-select');
    if (cameraSelect) {
        cameraSelect.innerHTML = cameraIds.map(id => {
            const cam = state.cameras[id];
            return `<option value="${id}">${cam.name || id}</option>`;
        }).join('');
        
        cameraSelect.addEventListener('change', (e) => {
            switchCamera(e.target.value);
        });
    }
    
    // Update initial camera display
    updateCameraDisplay();
    
    // Start status polling
    startCameraStatusPolling();
}

function switchCamera(cameraId) {
    if (!state.cameras[cameraId]) return;
    
    state.currentCameraId = cameraId;
    updateCameraDisplay();
    
    // Update camera select
    const cameraSelect = document.getElementById('camera-select');
    if (cameraSelect) {
        cameraSelect.value = cameraId;
    }
}

function updateCameraDisplay() {
    const cameraId = state.currentCameraId;
    if (!cameraId) return;
    
    const camera = state.cameras[cameraId];
    
    // Update video feed
    const videoFeed = document.getElementById('video-feed');
    if (videoFeed) {
        videoFeed.src = `/stream/${cameraId}?t=${Date.now()}`;
    }
    
    // Update camera name badge
    const cameraNameBadge = document.getElementById('camera-name');
    if (cameraNameBadge) {
        cameraNameBadge.textContent = camera.name || cameraId;
    }
    
    // Update status indicator
    updateCameraStatusUI(cameraId);
}

function updateCameraStatusUI(cameraId) {
    const status = state.cameraStatuses[cameraId] || { state: 'unknown' };
    const indicator = document.querySelector('.camera-status-indicator');
    const statusDot = indicator?.querySelector('.status-dot');
    const statusText = indicator?.querySelector('.status-text');
    
    if (!indicator) return;
    
    // Remove all status classes
    indicator.classList.remove('reconnecting', 'offline');
    
    switch (status.state) {
        case 'connected':
            if (statusText) statusText.textContent = 'Connected';
            break;
        case 'connecting':
        case 'reconnecting':
            indicator.classList.add('reconnecting');
            if (statusText) statusText.textContent = 'Reconnecting...';
            break;
        case 'offline':
        case 'error':
            indicator.classList.add('offline');
            if (statusText) statusText.textContent = 'Offline';
            break;
        default:
            if (statusText) statusText.textContent = status.state || 'Unknown';
    }
    
    // Update connection overlay
    updateConnectionOverlay(cameraId, status);
}

function updateConnectionOverlay(cameraId, status) {
    const overlay = document.querySelector('.connection-status-overlay');
    if (!overlay) return;
    
    if (status.state === 'connected' || status.state === 'connecting') {
        overlay.classList.remove('visible', 'offline');
        return;
    }
    
    const title = overlay.querySelector('.status-title');
    const message = overlay.querySelector('.status-message');
    const retryInfo = overlay.querySelector('.retry-info');
    
    if (status.state === 'reconnecting') {
        overlay.classList.add('visible');
        overlay.classList.remove('offline');
        if (title) title.textContent = 'Reconnecting...';
        if (message) message.textContent = 'Attempting to restore camera connection';
        if (retryInfo) {
            const nextRetry = status.next_retry_in ? Math.ceil(status.next_retry_in) : 0;
            retryInfo.textContent = `Retry attempt ${status.retry_count || 0} • Next retry in ${nextRetry}s`;
        }
    } else if (status.state === 'offline' || status.state === 'error') {
        overlay.classList.add('visible', 'offline');
        if (title) title.textContent = 'Camera Offline';
        if (message) message.textContent = status.error || 'Connection lost';
        if (retryInfo) retryInfo.textContent = 'Check camera connection and network';
    }
}

async function fetchCameraStatuses() {
    try {
        const response = await fetch('/api/cameras');
        const data = await response.json();
        
        if (data.cameras) {
            data.cameras.forEach(cam => {
                state.cameraStatuses[cam.camera_id] = {
                    state: cam.state,
                    retry_count: cam.retry_count,
                    next_retry_in: cam.next_retry_in,
                    error: cam.last_error
                };
            });
            
            // Update current camera status UI
            if (state.currentCameraId) {
                updateCameraStatusUI(state.currentCameraId);
            }
            
            // Update grid view statuses if active
            if (state.gridViewActive) {
                updateGridCameraStatuses();
            }
        }
    } catch (error) {
        console.error('Failed to fetch camera statuses:', error);
    }
}

let cameraStatusPollInterval = null;

function startCameraStatusPolling() {
    if (cameraStatusPollInterval) {
        clearInterval(cameraStatusPollInterval);
    }
    
    // Initial fetch
    fetchCameraStatuses();
    
    // Poll every 3 seconds
    cameraStatusPollInterval = setInterval(fetchCameraStatuses, 3000);
}

// ========== Grid View ==========
function initGridView() {
    const gridToggle = document.getElementById('grid-toggle');
    if (!gridToggle) return;
    
    gridToggle.addEventListener('click', toggleGridView);
    
    // Build grid items
    buildCameraGrid();
}

function toggleGridView() {
    state.gridViewActive = !state.gridViewActive;
    
    const videoSection = document.querySelector('.video-section');
    const cameraGrid = document.querySelector('.camera-grid');
    const gridToggle = document.getElementById('grid-toggle');
    
    if (state.gridViewActive) {
        if (videoSection) videoSection.style.display = 'none';
        if (cameraGrid) cameraGrid.classList.add('active');
        if (gridToggle) gridToggle.classList.add('active');
        updateGridCameraStatuses();
    } else {
        if (videoSection) videoSection.style.display = '';
        if (cameraGrid) cameraGrid.classList.remove('active');
        if (gridToggle) gridToggle.classList.remove('active');
    }
}

function buildCameraGrid() {
    const grid = document.querySelector('.camera-grid');
    if (!grid) return;
    
    const cameraIds = Object.keys(state.cameras);
    
    grid.innerHTML = cameraIds.map(id => {
        const cam = state.cameras[id];
        return `
            <div class="grid-camera-item" data-camera-id="${id}" onclick="selectGridCamera('${id}')">
                <img class="video-feed" src="/stream/${id}" alt="${cam.name}">
                <div class="grid-live-badge">
                    <span class="live-dot"></span>
                    LIVE
                </div>
                <div class="camera-label">
                    <span class="status-dot"></span>
                    <span>${cam.name || id}</span>
                </div>
            </div>
        `;
    }).join('');
}

function selectGridCamera(cameraId) {
    switchCamera(cameraId);
    toggleGridView(); // Exit grid view
}

function updateGridCameraStatuses() {
    document.querySelectorAll('.grid-camera-item').forEach(item => {
        const cameraId = item.dataset.cameraId;
        const status = state.cameraStatuses[cameraId];
        const statusDot = item.querySelector('.camera-label .status-dot');
        
        if (statusDot && status) {
            statusDot.style.background = 
                status.state === 'connected' ? 'var(--accent-green)' :
                status.state === 'reconnecting' ? 'var(--accent-amber)' :
                'var(--accent-red)';
        }
    });
}

// Make selectGridCamera available globally
window.selectGridCamera = selectGridCamera;

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme first (before content visible)
    initTheme();
    
    // Start time updates
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Initialize mobile navigation
    initMobileNav();
    
    // Initialize multi-camera support
    initCameras();
    initGridView();
    
    // Check initial recording status
    checkRecordingStatus();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Set initial UI state (recording off by default)
    updateRecordingUI(false);
    
    // Load recordings count
    loadRecordingsCount();
    
    // Initialize motion detection
    loadMotionStatus().then(() => {
        initializeMotionListeners();
        // Only start polling if motion is enabled
        if (state.motionEnabled) {
            startMotionStatusPolling();
        }
    });
    
    console.log('SENTINEL Dashboard initialized');
});

// ========== Load Recordings Count ==========
async function loadRecordingsCount() {
    try {
        const response = await fetch('/api/recordings');
        const data = await response.json();
        const countEl = document.getElementById('recordings-count');
        if (countEl) {
            countEl.textContent = data.recordings.length;
        }
    } catch (error) {
        console.error('Failed to load recordings count:', error);
    }
}

// ========== Motion Detection ==========
async function loadMotionStatus() {
    try {
        const response = await fetch('/api/motion/status');
        const data = await response.json();
        
        state.motionEnabled = data.enabled;
        state.motionDetected = data.motion_detected;
        state.motionSettings = {
            sensitivity: data.sensitivity,
            cooldown: data.cooldown,
            buffer_seconds: data.buffer_seconds
        };
        
        updateMotionUI();
        updateMotionSettingsUI();
        
        // If motion is recording, update recording UI
        if (data.is_motion_recording) {
            state.isRecording = true;
            updateRecordingUI(true);
        }
    } catch (error) {
        console.error('Failed to load motion status:', error);
    }
}

function updateMotionUI() {
    const toggle = document.getElementById('motion-toggle');
    const badge = document.getElementById('motion-status-badge');
    const settings = document.getElementById('motion-settings');
    const indicator = document.getElementById('motion-indicator');
    const videoWrapper = document.querySelector('.video-wrapper');
    
    // Update toggle
    if (toggle) {
        toggle.checked = state.motionEnabled;
    }
    
    // Update badge
    if (badge) {
        badge.classList.remove('active', 'detecting');
        if (state.motionEnabled) {
            if (state.motionDetected) {
                badge.textContent = 'MOTION';
                badge.classList.add('detecting');
            } else {
                badge.textContent = 'ON';
                badge.classList.add('active');
            }
        } else {
            badge.textContent = 'OFF';
        }
    }
    
    // Show/hide settings
    if (settings) {
        settings.classList.toggle('active', state.motionEnabled);
    }
    
    // Show/hide motion indicator
    if (indicator) {
        indicator.classList.toggle('active', state.motionEnabled && state.motionDetected);
    }
    
    // Visual feedback on video
    if (videoWrapper) {
        videoWrapper.classList.toggle('motion-active', state.motionEnabled && state.motionDetected);
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
        cooldownValue.textContent = `${state.motionSettings.cooldown}s`;
    }
    
    // Buffer
    const bufferSlider = document.getElementById('buffer-slider');
    const bufferValue = document.getElementById('buffer-value');
    if (bufferSlider) {
        bufferSlider.value = state.motionSettings.buffer_seconds;
    }
    if (bufferValue) {
        bufferValue.textContent = `${state.motionSettings.buffer_seconds}s`;
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
            
            // Start or stop polling based on new state
            if (enabled) {
                startMotionStatusPolling();
            } else if (motionPollInterval) {
                clearInterval(motionPollInterval);
                motionPollInterval = null;
            }
            
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
        }
    } catch (error) {
        console.error('Motion settings error:', error);
    }
}

function initializeMotionListeners() {
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
                cooldownValue.textContent = `${e.target.value}s`;
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
                bufferValue.textContent = `${e.target.value}s`;
            }
        });
        bufferSlider.addEventListener('change', (e) => {
            updateMotionSetting('buffer_seconds', parseInt(e.target.value));
        });
    }
}

// Poll motion status periodically (only when motion is enabled)
let motionPollInterval = null;

function startMotionStatusPolling() {
    // Clear any existing interval
    if (motionPollInterval) {
        clearInterval(motionPollInterval);
    }
    
    // Only poll if motion is enabled
    if (!state.motionEnabled) {
        return;
    }
    
    motionPollInterval = setInterval(async () => {
        // Stop polling if motion gets disabled
        if (!state.motionEnabled) {
            clearInterval(motionPollInterval);
            motionPollInterval = null;
            return;
        }
        
        try {
            const response = await fetch('/api/motion/status');
            const data = await response.json();
            
            const wasDetected = state.motionDetected;
            state.motionDetected = data.motion_detected;
            
            // Update UI if state changed
            if (wasDetected !== state.motionDetected) {
                updateMotionUI();
            }
            
            // Sync recording state
            if (data.is_motion_recording && !state.isRecording) {
                state.isRecording = true;
                updateRecordingUI(true);
            } else if (!data.is_motion_recording && state.isRecording) {
                // Check if it was a motion recording that stopped
                const statusResponse = await fetch('/api/recording/status');
                const statusData = await statusResponse.json();
                if (!statusData.is_recording) {
                    state.isRecording = false;
                    stopRecTimer();
                    updateRecordingUI(false);
                }
            }
        } catch (error) {
            // Silent fail for polling
        }
    }, 1000);
}
