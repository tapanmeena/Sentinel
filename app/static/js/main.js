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
    infoVisible: false
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

function startRecTimer() {
    state.recSeconds = 0;
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
            state.recSeconds = Math.floor(data.duration);
            startRecTimer();
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

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    // Start time updates
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
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
