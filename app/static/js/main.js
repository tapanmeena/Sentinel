/**
 * SENTINEL Security Dashboard - Main JavaScript
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

// ========== Recording Timer ==========
let recSeconds = 0;

function updateRecTime() {
    recSeconds++;
    const hrs = String(Math.floor(recSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((recSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(recSeconds % 60).padStart(2, '0');
    
    const recTimeElement = document.getElementById('rec-time');
    if (recTimeElement) {
        recTimeElement.textContent = `${hrs}:${mins}:${secs}`;
    }
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

// ========== Event Listeners ==========
function initializeEventListeners() {
    // Fullscreen buttons
    document.querySelectorAll('.control-btn.primary, .action-btn[title="Fullscreen"]').forEach(btn => {
        btn.addEventListener('click', toggleFullscreen);
    });

    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Snapshot button
    const snapshotBtn = document.querySelector('.control-btn:has(span:first-child:contains("📸"))');
    if (snapshotBtn) {
        snapshotBtn.addEventListener('click', () => {
            console.log('Snapshot captured');
            // Future: Implement actual snapshot functionality
        });
    }
}

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    // Start time updates
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Start recording timer
    setInterval(updateRecTime, 1000);
    
    // Initialize event listeners
    initializeEventListeners();
    
    console.log('SENTINEL Dashboard initialized');
});
