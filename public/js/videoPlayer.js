/**
 * VdoCipher Video Player with Anti-Piracy Features
 */

class SecureVideoPlayer {
    constructor(containerId, videoData) {
        this.containerId = containerId;
        this.videoData = videoData;
        this.player = null;
        this.watchInterval = null;
        this.watchStartTime = null;
        this.totalWatchTime = 0;
    }

    async initialize() {
        try {
            // Initialize VdoCipher player
            this.player = await this.createVdoCipherPlayer();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start watch tracking
            this.startWatchTracking();
            
            // Apply dynamic watermark
            this.applyWatermark();
            
            console.log('✅ Secure video player initialized');
        } catch (error) {
            console.error('Failed to initialize video player:', error);
            this.showError('Failed to load video. Please try again.');
        }
    }

    async createVdoCipherPlayer() {
        return new Promise((resolve, reject) => {
            const container = document.getElementById(this.containerId);
            
            if (!container) {
                reject(new Error('Video container not found'));
                return;
            }

            // VdoCipher player configuration
            const playerConfig = {
                otp: this.videoData.otp,
                playbackInfo: this.videoData.playbackInfo,
                theme: '#2563eb',
                plugins: ['watermark'],
                watermark: {
                    text: `${this.videoData.studentName} | ${this.videoData.studentId} | ${this.videoData.mobile}`,
                    opacity: 0.7,
                    fontSize: '14px',
                    interval: 15, // seconds
                    dynamic: true
                },
                controlsConfig: {
                    download: false,      // Disable download
                    share: false,         // Disable share
                    speedControl: true,
                    qualityControl: true
                }
            };

            // Initialize VdoCipher
            if (typeof VdoPlayer !== 'undefined') {
                const player = new VdoPlayer(container, playerConfig);
                resolve(player);
            } else {
                reject(new Error('VdoCipher library not loaded'));
            }
        });
    }

    setupEventListeners() {
        // Prevent right-click
        document.getElementById(this.containerId).addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showProtectionWarning();
        });

        // Prevent keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Block Ctrl+S, Ctrl+U, F12
            if ((e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) || e.key === 'F12') {
                e.preventDefault();
                this.showProtectionWarning();
                return false;
            }
        });

        // Track video events
        if (this.player) {
            this.player.on('play', () => this.handlePlay());
            this.player.on('pause', () => this.handlePause());
            this.player.on('ended', () => this.handleEnded());
            this.player.on('timeupdate', (data) => this.handleTimeUpdate(data));
            this.player.on('error', (error) => this.handleError(error));
        }

        // Detect DevTools
        this.detectDevTools();
    }

    handlePlay() {
        console.log('▶️ Video started');
        this.watchStartTime = Date.now();
        this.sendActivityLog('video_play');
    }

    handlePause() {
        console.log('⏸️ Video paused');
        this.updateWatchTime();
        this.sendActivityLog('video_pause');
    }

    handleEnded() {
        console.log('✅ Video completed');
        this.updateWatchTime();
        this.sendActivityLog('video_complete', { watchPercentage: 100 });
    }

    handleTimeUpdate(data) {
        // Track progress every 30 seconds
        if (data.currentTime % 30 === 0) {
            const percentage = (data.currentTime / data.duration) * 100;
            this.sendActivityLog('video_progress', {
                currentTime: data.currentTime,
                duration: data.duration,
                percentage: percentage.toFixed(2)
            });
        }
    }

    handleError(error) {
        console.error('Video error:', error);
        this.sendActivityLog('video_error', { error: error.message });
    }

    updateWatchTime() {
        if (this.watchStartTime) {
            this.totalWatchTime += (Date.now() - this.watchStartTime) / 1000;
            this.watchStartTime = null;
        }
    }

    startWatchTracking() {
        // Send watch data every 60 seconds
        this.watchInterval = setInterval(() => {
            this.updateWatchTime();
            this.sendActivityLog('watch_heartbeat', {
                totalWatchTime: this.totalWatchTime
            });
        }, 60000);
    }

    applyWatermark() {
        // Additional CSS-based watermark (extra protection)
        const overlay = document.createElement('div');
        overlay.className = 'dynamic-watermark';
        overlay.innerHTML = `${this.videoData.studentName} - ${this.videoData.studentId}`;
        overlay.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            color: rgba(255, 255, 255, 0.6);
            background: rgba(0, 0, 0, 0.5);
            padding: 5px 15px;
            border-radius: 4px;
            font-size: 13px;
            z-index: 999;
            pointer-events: none;
            animation: watermarkFloat 20s infinite;
        `;
        
        document.getElementById(this.containerId).appendChild(overlay);
    }

    async sendActivityLog(action, details = {}) {
        try {
            const response = await fetch('/video/log-activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lessonId: this.videoData.lessonId,
                    action: action,
                    details: details
                })
            });

            if (!response.ok) {
                console.warn('Failed to log activity');
            }
        } catch (error) {
            console.error('Activity log error:', error);
        }
    }

    showProtectionWarning() {
        const warning = document.createElement('div');
        warning.className = 'protection-warning';
        warning.textContent = '⚠️ Content Protected: This video is copyrighted. Screen recording and downloading are prohibited.';
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc2626;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 9999;
            animation: fadeInOut 3s forwards;
        `;
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            warning.remove();
        }, 3000);
    }

    detectDevTools() {
        let devtoolsOpen = false;
        
        const threshold = 160;
        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                if (!devtoolsOpen) {
                    devtoolsOpen = true;
                    console.warn('⚠️ DevTools detected - possible piracy attempt');
                    this.sendActivityLog('devtools_detected');
                }
            } else {
                devtoolsOpen = false;
            }
        }, 1000);
    }

    showError(message) {
        const container = document.getElementById(this.containerId);
        container.innerHTML = `
            <div class="video-error">
                <div class="error-icon">⚠️</div>
                <h3>Video Unavailable</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="retry-btn">Retry</button>
            </div>
        `;
    }

    destroy() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
        }
        if (this.player) {
            this.player.destroy();
        }
    }
}

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('vdocipher-container');
    
    if (videoContainer) {
        const videoData = {
            otp: videoContainer.dataset.otp,
            playbackInfo: videoContainer.dataset.playbackInfo,
            lessonId: videoContainer.dataset.lessonId,
            studentName: videoContainer.dataset.studentName,
            studentId: videoContainer.dataset.studentId,
            mobile: videoContainer.dataset.mobile
        };
        
        const player = new SecureVideoPlayer('vdocipher-container', videoData);
        player.initialize();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            player.destroy();
        });
    }
});
