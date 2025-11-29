/**
 * SENTINEL Security Dashboard - Recordings Page JavaScript
 */

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
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// ========== Recordings Functions ==========
function showRecordingsList() {
    document.getElementById('recordings-section').style.display = 'block';
    document.getElementById('video-player-section').style.display = 'none';
    const videoPlayer = document.getElementById('video-player');
    if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = '';
    }
}

function showVideoPlayer(filename) {
    document.getElementById('recordings-section').style.display = 'none';
    document.getElementById('video-player-section').style.display = 'block';
    document.getElementById('now-playing').textContent = filename;
}

async function loadRecordings() {
    const loadingEl = document.getElementById('recordings-loading');
    const emptyEl = document.getElementById('recordings-empty');
    const gridEl = document.getElementById('recordings-grid');
    const countEl = document.getElementById('recordings-count');
    const totalEl = document.getElementById('recordings-total');
    
    loadingEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    gridEl.innerHTML = '';
    
    try {
        const response = await fetch('/api/recordings');
        const data = await response.json();
        
        loadingEl.style.display = 'none';
        
        if (countEl) {
            countEl.textContent = data.recordings.length;
        }
        if (totalEl) {
            totalEl.textContent = `${data.recordings.length} video${data.recordings.length !== 1 ? 's' : ''}`;
        }
        
        if (data.recordings.length === 0) {
            emptyEl.style.display = 'flex';
            return;
        }
        
        data.recordings.forEach(recording => {
            const card = createRecordingCard(recording);
            gridEl.appendChild(card);
        });
        
    } catch (error) {
        console.error('Failed to load recordings:', error);
        loadingEl.style.display = 'none';
        showNotification('Failed to load recordings', 'error');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createRecordingCard(recording) {
    const card = document.createElement('div');
    card.className = 'recording-card';
    card.innerHTML = `
        <div class="recording-thumbnail" onclick="playRecording('${recording.filename}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                <line x1="7" y1="2" x2="7" y2="22"/>
                <line x1="17" y1="2" x2="17" y2="22"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <line x1="2" y1="7" x2="7" y2="7"/>
                <line x1="2" y1="17" x2="7" y2="17"/>
                <line x1="17" y1="17" x2="22" y2="17"/>
                <line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
            <div class="recording-play-overlay">
                <div class="play-btn-large">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </div>
            </div>
        </div>
        <div class="recording-info">
            <div class="recording-name">${recording.filename}</div>
            <div class="recording-meta">
                <span>${formatDate(recording.created)}</span>
                <span>${formatFileSize(recording.size)}</span>
            </div>
        </div>
        <div class="recording-actions">
            <button class="recording-action-btn" onclick="event.stopPropagation(); playRecording('${recording.filename}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Play
            </button>
            <button class="recording-action-btn" onclick="event.stopPropagation(); downloadRecording('${recording.filename}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
            </button>
            <button class="recording-action-btn delete" onclick="event.stopPropagation(); deleteRecording('${recording.filename}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
            </button>
        </div>
    `;
    return card;
}

function playRecording(filename) {
    const videoPlayer = document.getElementById('video-player');
    if (videoPlayer) {
        videoPlayer.src = `/recordings/play/${filename}`;
        showVideoPlayer(filename);
        videoPlayer.play();
    }
}

function downloadRecording(filename) {
    window.location.href = `/recordings/${filename}`;
    showNotification('Download started', 'info');
}

async function deleteRecording(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/recordings/${filename}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Recording deleted', 'success');
            loadRecordings();
        } else {
            showNotification(data.message || 'Failed to delete recording', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete recording', 'error');
    }
}

// ========== Event Listeners ==========
function initializeEventListeners() {
    // Back to list button
    const backBtn = document.getElementById('back-to-list');
    if (backBtn) {
        backBtn.addEventListener('click', showRecordingsList);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-recordings');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadRecordings();
            showNotification('Recordings refreshed', 'info');
        });
    }
}

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    // Start time updates
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Load recordings
    loadRecordings();
    
    // Initialize event listeners
    initializeEventListeners();
    
    console.log('SENTINEL Recordings Page initialized');
});
