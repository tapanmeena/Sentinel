/**
 * SENTINEL Security Dashboard - Main JavaScript
 */

window._pageJsInitialized = true;

// ========== State Management ==========
const state = {
    isRecording: false,
    recordingKnown: false,
    motionKnown: false,
    recordingPending: false,
    motionPending: false,
    snapshotPending: false,
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
    selectionVersion: 0,
    gridViewActive: localStorage.getItem('sentinel-layout') !== 'focus',
    recordings: [],
    // Theme state
    theme: localStorage.getItem('sentinel-theme') || 'light',
    // Mobile nav state
    mobileNavOpen: false
};

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { Accept: 'application/json', ...options.headers },
        signal: options.signal || AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
}

function cameraEndpoint(resource, cameraId = state.currentCameraId) {
    return `/api/${resource}/${encodeURIComponent(cameraId)}`;
}

function isCurrentSelection(cameraId, version) {
    return cameraId === state.currentCameraId && version === state.selectionVersion;
}

function updateControlAvailability() {
    const connected = state.cameraStatuses[state.currentCameraId]?.state === 'connected';
    const recordButton = document.getElementById('rec-btn');
    const snapshotButton = document.getElementById('snapshot-btn');
    const motionToggle = document.getElementById('motion-toggle');
    if (recordButton) recordButton.disabled = !state.recordingKnown || state.recordingPending || (!connected && !state.isRecording);
    if (snapshotButton) snapshotButton.disabled = !connected || state.snapshotPending;
    if (motionToggle) motionToggle.disabled = !state.motionKnown || state.motionPending || !state.currentCameraId;
}

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
    if (state.recInterval) clearInterval(state.recInterval);
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
    const cameraId = state.currentCameraId;
    const version = state.selectionVersion;
    if (!cameraId || !state.recordingKnown || state.recordingPending) return;
    const wasRecording = state.isRecording;
    state.recordingPending = true;
    updateControlAvailability();
    try {
        const data = await fetchJson(cameraEndpoint(`recording/${wasRecording ? 'stop' : 'start'}`, cameraId), { method: 'POST' });
        if (!data.success) throw new Error(data.message || 'Recording action failed');
        if (isCurrentSelection(cameraId, version)) {
            state.isRecording = !wasRecording;
            if (wasRecording) stopRecTimer();
            else startRecTimer();
            updateRecordingUI(state.isRecording);
        }
        if (state.cameraStatuses[cameraId]) state.cameraStatuses[cameraId].is_recording = !wasRecording;
        updateGridCameraStatuses();
        showNotification(`${wasRecording ? 'Recording saved' : 'Recording started'}: ${state.cameras[cameraId].name || cameraId}`, 'success');
        if (wasRecording) loadRecordingsCount();
    } catch (error) {
        showNotification(error.message || 'Connection error', 'error');
    } finally {
        state.recordingPending = false;
        updateControlAvailability();
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
        if (recBtnText) recBtnText.textContent = 'Stop';
        if (recBtn) recBtn.title = 'Stop Recording';
        recIndicator?.classList.add('recording-active');
        recIndicator?.classList.remove('recording-inactive');
    } else {
        // Recording inactive
        recBtn?.classList.remove('rec-active');
        recBtn?.classList.add('rec-inactive');
        if (recBtnText) recBtnText.textContent = 'Record';
        if (recBtn) recBtn.title = 'Start Recording';
        recIndicator?.classList.remove('recording-active');
        recIndicator?.classList.add('recording-inactive');
    }
    recBtn?.setAttribute('aria-pressed', String(isRecording));
    updateControlAvailability();
}

// ========== Snapshot ==========
async function captureSnapshot() {
    const cameraId = state.currentCameraId;
    if (!cameraId || state.snapshotPending) return;
    state.snapshotPending = true;
    updateControlAvailability();
    try {
        const data = await fetchJson(cameraEndpoint('snapshot', cameraId), { method: 'POST' });
        if (!data.success) throw new Error(data.message || 'Failed to capture snapshot');
        showNotification(`Snapshot saved: ${data.filename}`, 'success');
    } catch (error) {
        showNotification(error.message || 'Connection error', 'error');
    } finally {
        state.snapshotPending = false;
        updateControlAvailability();
    }
}

// ========== Notifications ==========
function createNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    return container;
}

function showNotification(message, type = 'info') {
    const container = createNotificationContainer();
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'info');
    const text = document.createElement('span');
    text.className = 'notification-message';
    text.textContent = message;
    const dismiss = document.createElement('button');
    dismiss.className = 'notification-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss notification');
    dismiss.title = 'Dismiss notification';
    const closeIcon = document.createElement('i');
    closeIcon.setAttribute('data-lucide', 'x');
    dismiss.append(closeIcon);
    dismiss.addEventListener('click', () => dismissNotification(notification));
    notification.append(icon, text, dismiss);
    container.append(notification);
    window.lucide?.createIcons();
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
    const cameraId = state.currentCameraId;
    const version = state.selectionVersion;
    if (!cameraId || state.recordingPending) return;
    try {
        const data = await fetchJson(cameraEndpoint('recording/status', cameraId));
        if (!isCurrentSelection(cameraId, version) || state.recordingPending) return;
        state.recordingKnown = true;
        state.isRecording = Boolean(data.is_recording);
        if (state.isRecording) startRecTimer(Math.floor(data.duration || 0));
        else stopRecTimer();
        updateRecordingUI(state.isRecording);
    } catch (error) {
        if (isCurrentSelection(cameraId, version)) {
            state.recordingKnown = false;
            updateControlAvailability();
        }
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
    document.querySelectorAll('#fullscreen-btn, #header-fullscreen-btn').forEach(btn => {
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
    
    videoInfo.hidden = !state.infoVisible;
    infoBtn?.classList.toggle('active', state.infoVisible);
    infoBtn?.setAttribute('aria-expanded', String(state.infoVisible));
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
    const cameraIds = Object.keys(state.cameras);
    if (cameraIds.length === 0) return;
    const requested = new URLSearchParams(window.location.search).get('camera');
    state.currentCameraId = state.cameras[requested] ? requested : (window.DEFAULT_CAMERA || cameraIds[0]);
    const cameraSelect = document.getElementById('camera-select');
    if (cameraSelect) {
        cameraSelect.value = state.currentCameraId;
        cameraSelect.addEventListener('change', (event) => {
            switchCamera(event.target.value);
        });
    }
    document.querySelectorAll('[data-camera-link]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            switchCamera(link.dataset.cameraLink);
        });
    });
    document.querySelectorAll('#video-feed, .grid-video-feed').forEach(image => {
        image.addEventListener('load', () => {
            delete image.dataset.failed;
            image.hidden = false;
        });
        image.addEventListener('error', () => {
            image.dataset.failed = 'true';
            image.hidden = true;
            if (image.id === 'video-feed') updateCameraStatusUI(state.currentCameraId);
            else updateGridCameraStatuses();
        });
    });
    updateCameraDisplay();
}

function switchCamera(cameraId) {
    if (!state.cameras[cameraId] || cameraId === state.currentCameraId) return;
    state.currentCameraId = cameraId;
    state.selectionVersion++;
    state.recordingKnown = false;
    state.motionKnown = false;
    state.isRecording = false;
    state.motionEnabled = false;
    state.motionDetected = false;
    stopRecTimer();
    updateRecordingUI(false);
    updateMotionUI();
    updateCameraDisplay();
    const cameraSelect = document.getElementById('camera-select');
    if (cameraSelect) cameraSelect.value = cameraId;
    checkRecordingStatus();
    loadMotionStatus();
}

function updateCameraDisplay() {
    const cameraId = state.currentCameraId;
    if (!cameraId) return;
    
    const camera = state.cameras[cameraId];
    
    const videoFeed = document.getElementById('video-feed');
    if (videoFeed) {
        videoFeed.alt = `${camera.name || cameraId} live camera feed`;
    }
    document.querySelectorAll('[data-current-camera-name]').forEach(element => { element.textContent = camera.name || cameraId; });
    document.querySelectorAll('[data-camera-link]').forEach(link => {
        const active = link.dataset.cameraLink === cameraId;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
    });
    syncCameraStreams();
    updateCameraStatusUI(cameraId);
    updateGridCameraStatuses();
}

function updateCameraStatusUI(cameraId) {
    const status = state.cameraStatuses[cameraId] || { state: 'unknown' };
    const indicator = document.querySelector('.camera-status-indicator');
    const statusText = indicator?.querySelector('.status-text');
    if (!indicator) return;
    const failed = document.getElementById('video-feed')?.dataset.failed === 'true';
    const connected = status.state === 'connected' && !failed;
    const reconnecting = ['connecting', 'reconnecting', 'unknown'].includes(status.state) || failed;
    indicator.classList.toggle('reconnecting', reconnecting);
    indicator.classList.toggle('offline', !connected && !reconnecting);
    const label = failed ? 'Stream unavailable' : statusLabel(status.state);
    if (statusText) statusText.textContent = label;
    setText('info-status', label);
    setText('info-source', status.type || state.cameras[cameraId]?.type || '--');
    setText('info-resolution', status.resolution?.join(' x ') || '--');
    setText('info-fps', status.framerate ? `${status.framerate} fps` : '--');
    setText('feed-quality', status.resolution ? `${status.resolution[1]}P / ${status.framerate} FPS` : '--');
    const live = document.getElementById('live-indicator');
    if (live) live.hidden = !connected;
    updateConnectionOverlay(cameraId, status);
    updateControlAvailability();
}

function updateConnectionOverlay(cameraId, status) {
    const overlay = document.querySelector('.connection-status-overlay');
    if (!overlay) return;
    const failed = document.getElementById('video-feed')?.dataset.failed === 'true';
    overlay.hidden = status.state === 'connected' && !failed;
    if (overlay.hidden) return;
    const title = overlay.querySelector('.status-title');
    const message = overlay.querySelector('.status-message');
    const retryInfo = overlay.querySelector('.retry-info');
    if (title) title.textContent = failed ? 'Stream unavailable' : status.state === 'unknown' ? 'Connecting to camera' : `Camera ${statusLabel(status.state).toLowerCase()}`;
    if (message) message.textContent = status.last_error || (failed ? 'Retrying the live stream' : `Waiting for ${state.cameras[cameraId]?.name || cameraId}`);
    if (retryInfo) retryInfo.textContent = status.next_retry_in != null ? `Retry ${status.retry_count || 0} / next attempt in ${Math.ceil(status.next_retry_in)}s` : '';
}

function statusLabel(status) {
    const labels = { connected: 'Online', connecting: 'Connecting', reconnecting: 'Reconnecting', offline: 'Offline', error: 'Unavailable', disabled: 'Disabled', unknown: 'Connecting' };
    return labels[status] || 'Unknown';
}

function setStreamSource(image, cameraId, active) {
    if (!image) return;
    if (!active) {
        image.removeAttribute('src');
        image.hidden = true;
        delete image.dataset.failed;
        return;
    }
    const source = `/stream/${encodeURIComponent(cameraId)}`;
    if (image.getAttribute('src') !== source || image.dataset.failed) {
        image.removeAttribute('src');
        delete image.dataset.failed;
        image.src = source;
    }
    image.hidden = false;
}

function syncCameraStreams() {
    document.querySelectorAll('.grid-camera-item').forEach(item => {
        const cameraId = item.dataset.cameraId;
        const selected = cameraId === state.currentCameraId;
        item.hidden = selected;
        setStreamSource(item.querySelector('img'), cameraId, !document.hidden && !selected && state.gridViewActive && state.cameraStatuses[cameraId]?.state === 'connected');
    });
    setStreamSource(document.getElementById('video-feed'), state.currentCameraId, !document.hidden && state.cameraStatuses[state.currentCameraId]?.state === 'connected');
}

let cameraStatusFetching = false;

async function fetchCameraStatuses() {
    if (cameraStatusFetching) return;
    cameraStatusFetching = true;
    try {
        const data = await fetchJson('/api/cameras');
        if (!Array.isArray(data.cameras)) throw new Error('Invalid camera status');
        state.cameraStatuses = Object.fromEntries(data.cameras.map(camera => [camera.camera_id, camera]));
        setText('online-camera-count', data.cameras.filter(camera => camera.state === 'connected').length);
        setText('server-status', `Connected to ${window.location.host}`);
        document.getElementById('server-status-dot')?.classList.add('connected');
        syncCameraStreams();
        updateCameraStatusUI(state.currentCameraId);
        updateGridCameraStatuses();
        updateMotionSummary();
    } catch (error) {
        setText('online-camera-count', '--');
        setText('server-status', 'Server connection lost');
        document.getElementById('server-status-dot')?.classList.remove('connected');
        Object.values(state.cameraStatuses).forEach(camera => { camera.state = 'error'; });
        syncCameraStreams();
        updateCameraStatusUI(state.currentCameraId);
        updateGridCameraStatuses();
        setText('motion-summary', 'Detection status unavailable');
    } finally {
        cameraStatusFetching = false;
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
    cameraStatusPollInterval = setInterval(() => { if (!document.hidden) fetchCameraStatuses(); }, 3000);
}

// ========== Grid View ==========
function initGridView() {
    const gridToggle = document.getElementById('grid-toggle');
    const focusToggle = document.getElementById('focus-toggle');
    gridToggle?.addEventListener('click', () => setCameraLayout(true));
    focusToggle?.addEventListener('click', () => setCameraLayout(false));
    document.querySelectorAll('.grid-camera-item').forEach(item => {
        item.addEventListener('click', () => switchCamera(item.dataset.cameraId));
    });
    setCameraLayout(state.gridViewActive);
}

function toggleGridView() {
    setCameraLayout(!state.gridViewActive);
}

function setCameraLayout(overview) {
    state.gridViewActive = overview;
    localStorage.setItem('sentinel-layout', overview ? 'overview' : 'focus');
    const secondary = document.getElementById('other-cameras');
    if (secondary) secondary.hidden = !overview || Object.keys(state.cameras).length < 2;
    document.getElementById('home-monitor')?.classList.toggle('focus-mode', !overview);
    const gridToggle = document.getElementById('grid-toggle');
    const focusToggle = document.getElementById('focus-toggle');
    gridToggle?.classList.toggle('active', overview);
    gridToggle?.setAttribute('aria-pressed', String(overview));
    focusToggle?.classList.toggle('active', !overview);
    focusToggle?.setAttribute('aria-pressed', String(!overview));
    syncCameraStreams();
}

function selectGridCamera(cameraId) {
    switchCamera(cameraId);
}

function updateGridCameraStatuses() {
    document.querySelectorAll('.grid-camera-item').forEach(item => {
        const cameraId = item.dataset.cameraId;
        const status = state.cameraStatuses[cameraId] || { state: 'unknown' };
        const failed = item.querySelector('img')?.dataset.failed === 'true';
        const placeholder = item.querySelector('.home-preview-state');
        if (placeholder) placeholder.hidden = status.state === 'connected' && !failed;
        const label = item.querySelector('.preview-status');
        if (label) label.textContent = failed ? 'Unavailable' : statusLabel(status.state);
        const statusDot = item.querySelector('.status-dot');
        if (statusDot) statusDot.style.background = status.state === 'connected' && !failed ? 'var(--home-online)' : 'var(--home-warning)';
        const recordBadge = item.querySelector('.home-preview-recording');
        if (recordBadge) recordBadge.hidden = !status.is_recording;
    });
    document.querySelectorAll('[data-camera-link]').forEach(link => {
        const status = state.cameraStatuses[link.dataset.cameraLink]?.state || 'unknown';
        const dot = link.querySelector('.home-status-dot');
        if (dot) dot.className = `home-status-dot ${status}`;
        link.title = `${state.cameras[link.dataset.cameraLink]?.name || link.dataset.cameraLink}: ${statusLabel(status)}`;
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
    startCameraStatusPolling();
    
    // Check initial recording status
    checkRecordingStatus();
    
    // Initialize event listeners
    initializeEventListeners();
    
    updateRecordingUI(false);
    
    // Load recordings count
    loadRecordingsCount();
    
    initializeMotionListeners();
    loadMotionStatus();
    startMotionStatusPolling();
    initializeRecordingPreview();
    window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
    setInterval(() => { if (!document.hidden) loadRecordingsCount(); }, 30000);
    document.addEventListener('visibilitychange', () => {
        syncCameraStreams();
        if (!document.hidden) {
            fetchCameraStatuses();
            checkRecordingStatus();
            loadMotionStatus();
        }
    });
    window.addEventListener('pagehide', () => {
        document.querySelectorAll('#video-feed, .grid-video-feed').forEach(image => image.removeAttribute('src'));
    });
});

// ========== Load Recordings Count ==========
async function loadRecordingsCount() {
    try {
        const data = await fetchJson('/api/recordings');
        if (!Array.isArray(data.recordings)) throw new Error('Invalid recordings response');
        state.recordings = data.recordings;
        setText('recordings-count', data.recordings.length);
        const dates = data.recordings.map(recording => new Date(recording.created)).filter(date => !Number.isNaN(date.getTime()));
        const today = new Date().toDateString();
        setText('today-recordings-count', dates.filter(date => date.toDateString() === today).length);
        const oldest = dates.length ? Math.min(...dates.map(date => date.getTime())) : null;
        const historyDays = oldest === null ? 0 : Math.max(1, Math.floor((Date.now() - oldest) / 86400000) + 1);
        setText('recording-history-days', historyDays);
        setText('recording-history-unit', historyDays === 1 ? 'day' : 'days');
        renderRecentRecordings(data.recordings.slice(0, 3));
        window.loadStorageStats?.();
    } catch (error) {
        setText('recordings-count', '--');
        setText('today-recordings-count', '--');
        setText('recording-history-days', '--');
        renderRecentRecordings([], 'Recordings are unavailable.');
    }
}

function renderRecentRecordings(recordings, emptyMessage = 'No recordings yet.') {
    const list = document.getElementById('recent-recordings');
    if (!list) return;
    list.replaceChildren();
    if (!recordings.length) {
        const message = document.createElement('p');
        message.className = 'home-empty-message';
        message.textContent = emptyMessage;
        list.append(message);
        return;
    }
    recordings.forEach(recording => {
        const button = document.createElement('button');
        button.className = 'home-event';
        button.type = 'button';
        const thumbnail = document.createElement('span');
        thumbnail.className = 'home-event-thumbnail';
        const fallback = document.createElement('i');
        fallback.setAttribute('data-lucide', 'clapperboard');
        thumbnail.append(fallback);
        if (recording.thumbnail) {
            const image = document.createElement('img');
            image.src = `/thumbnails/${encodeURIComponent(recording.camera_id)}/${encodeURIComponent(recording.thumbnail)}`;
            image.alt = '';
            image.loading = 'lazy';
            image.addEventListener('load', () => { thumbnail.replaceChildren(image); });
            image.addEventListener('error', () => { image.remove(); });
            thumbnail.append(image);
        }
        const copy = document.createElement('span');
        copy.className = 'home-event-copy';
        const name = document.createElement('strong');
        name.textContent = recording.camera_name || recording.camera_id;
        const label = document.createElement('span');
        label.textContent = recording.filename.startsWith('motion_') ? 'Motion recording' : 'Recording saved';
        const time = document.createElement('small');
        time.textContent = new Date(recording.created).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        copy.append(name, label, time);
        button.append(thumbnail, copy);
        button.addEventListener('click', () => openRecordingPreview(recording));
        list.append(button);
    });
    window.lucide?.createIcons();
}

function initializeRecordingPreview() {
    const dialog = document.getElementById('recording-preview');
    const video = document.getElementById('preview-video');
    if (!dialog || !video) return;
    document.getElementById('preview-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
    });
    video.addEventListener('error', () => {
        const error = document.getElementById('preview-error');
        if (error && video.getAttribute('src')) error.hidden = false;
    });
}

function openRecordingPreview(recording) {
    const dialog = document.getElementById('recording-preview');
    const video = document.getElementById('preview-video');
    if (!dialog || !video) return;
    const path = `${encodeURIComponent(recording.camera_id)}/${encodeURIComponent(recording.filename)}`;
    setText('preview-title', recording.camera_name || recording.camera_id);
    setText('preview-description', new Date(recording.created).toLocaleString());
    document.getElementById('preview-error').hidden = true;
    document.getElementById('preview-download').href = `/recordings/${path}`;
    video.src = `/recordings/play/${path}`;
    dialog.showModal();
}

// ========== Motion Detection ==========
async function loadMotionStatus() {
    const cameraId = state.currentCameraId;
    const version = state.selectionVersion;
    if (!cameraId || state.motionPending) return;
    try {
        const data = await fetchJson(cameraEndpoint('motion/status', cameraId));
        if (!isCurrentSelection(cameraId, version) || state.motionPending) return;
        state.motionKnown = true;
        state.motionEnabled = Boolean(data.enabled);
        state.motionDetected = Boolean(data.motion_detected);
        state.motionSettings = {
            sensitivity: data.sensitivity,
            cooldown: data.cooldown,
            buffer_seconds: data.buffer_seconds
        };
        
        updateMotionUI();
        updateMotionSettingsUI();
        
    } catch (error) {
        if (isCurrentSelection(cameraId, version)) {
            state.motionKnown = false;
            updateMotionUI();
        }
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
    if (!state.motionKnown && badge) badge.textContent = '--';
    updateControlAvailability();
}

function updateMotionSummary() {
    const cameras = Object.values(state.cameraStatuses).filter(camera => camera.enabled !== false);
    const armed = cameras.filter(camera => camera.motion_enabled).length;
    setText('motion-summary', armed ? `${armed} ${armed === 1 ? 'camera' : 'cameras'} armed` : 'Motion detection off');
    document.getElementById('motion-summary-dot')?.classList.toggle('connected', armed > 0);
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
    const cameraId = state.currentCameraId;
    const version = state.selectionVersion;
    if (!cameraId || !state.motionKnown || state.motionPending) return;
    state.motionPending = true;
    updateControlAvailability();
    try {
        const data = await fetchJson(cameraEndpoint(`motion/${enabled ? 'enable' : 'disable'}`, cameraId), { method: 'POST' });
        if (!data.success) throw new Error(data.message || 'Failed to toggle motion detection');
        if (isCurrentSelection(cameraId, version)) {
            state.motionEnabled = enabled;
            state.motionDetected = false;
            updateMotionUI();
        }
        if (state.cameraStatuses[cameraId]) state.cameraStatuses[cameraId].motion_enabled = enabled;
        updateMotionSummary();
        showNotification(`Motion detection ${enabled ? 'enabled' : 'disabled'}: ${state.cameras[cameraId].name || cameraId}`, 'success');
    } catch (error) {
        if (isCurrentSelection(cameraId, version)) updateMotionUI();
        showNotification(error.message || 'Connection error', 'error');
    } finally {
        state.motionPending = false;
        updateControlAvailability();
    }
}

async function updateMotionSetting(setting, value) {
    const cameraId = state.currentCameraId;
    const version = state.selectionVersion;
    if (!cameraId) return;
    try {
        const data = await fetchJson(cameraEndpoint('motion/settings', cameraId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [setting]: value })
        });
        if (data.success && isCurrentSelection(cameraId, version)) {
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
    if (motionPollInterval) {
        clearInterval(motionPollInterval);
    }
    let polling = false;
    motionPollInterval = setInterval(async () => {
        if (document.hidden || !state.currentCameraId || polling) return;
        polling = true;
        try {
            await Promise.all([loadMotionStatus(), checkRecordingStatus()]);
        } finally {
            polling = false;
        }
    }, 2000);
}
