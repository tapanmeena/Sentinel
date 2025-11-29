/**
 * SENTINEL Security Dashboard - Main JavaScript
 */

// ========== State Management ==========
const state = {
    isRecording: false,
    recSeconds: 0,
    recInterval: null
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
        if (recBtnText) recBtnText.textContent = 'Stop REC';
        recIndicator?.classList.add('recording-active');
        recIndicator?.classList.remove('recording-inactive');
    } else {
        // Recording inactive
        recBtn?.classList.remove('rec-active');
        recBtn?.classList.add('rec-inactive');
        if (recBtnText) recBtnText.textContent = 'Start REC';
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
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
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
