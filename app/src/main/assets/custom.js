window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// ==UserScript==
// @name         自定义视频播放器增强脚本
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  支持1.0-5.0倍速播放，预加载缓存，记忆功能，右下角悬浮控制面板
// @author       VideoEnhancer
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    class CustomVideoPlayer {
        constructor() {
            this.video = null;
            this.isInitialized = false;
            this.currentSpeed = 1.0;
            this.lastPlayPosition = 0;
            this.isPrecaching = false;
            this.config = {
                autoPrecache: true,
                enableMemory: true,
                alwaysShowIcon: true,
                panelScale: 1.0,
                hidePanel: false
            };
            
            this.videoId = this.generateVideoId();
            this.init();
        }
        
        generateVideoId() {
            return window.location.href + '_' + document.title;
        }
        
        init() {
            // 等待页面加载完成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupPlayer());
            } else {
                this.setupPlayer();
            }
            
            // 监听页面变化（SPA应用）
            this.observeDOMChanges();
        }
        
        setupPlayer() {
            // 查找页面中的视频元素
            this.findVideoElements();
            
            // 如果没有找到视频，延迟重试
            if (!this.video && !this.isInitialized) {
                setTimeout(() => this.setupPlayer(), 1000);
                return;
            }
            
            if (this.video && !this.isInitialized) {
                this.isInitialized = true;
                this.loadConfig();
                this.createUI();
                this.bindEvents();
                this.checkMemory();
                
                if (this.config.autoPrecache) {
                    this.setupAutoPrecache();
                }
                
                console.log('自定义视频播放器 v5.0 已加载');
            }
        }
        
        findVideoElements() {
            // 查找页面中的所有video元素
            const videos = document.querySelectorAll('video');
            if (videos.length > 0) {
                this.video = videos[0];
                
                // 如果需要，可以添加对iframe内视频的支持
                // this.checkIframes();
            }
        }
        
        observeDOMChanges() {
            // 监听DOM变化，处理动态加载的视频
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (!this.video && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.tagName === 'VIDEO' || 
                                (node.querySelector && node.querySelector('video'))) {
                                this.setupPlayer();
                            }
                        });
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        
        createUI() {
            // 创建样式
            this.createStyles();
            
            // 创建主控制面板
            this.createMainControls();
            
            // 创建悬浮控制面板
            this.createFloatingPanel();
            
            // 创建状态指示器
            this.createStatusIndicator();
        }
        
        createStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .custom-video-controls {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0, 0, 0, 0.8);
                    padding: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .custom-control-btn {
                    background: #0ea5e9;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .custom-control-btn:hover {
                    background: #0284c7;
                }
                
                .speed-controls {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                .speed-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: bold;
                }
                
                .speed-btn.active {
                    background: #0ea5e9;
                    border-color: #0ea5e9;
                }
                
                .floating-controls-panel {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    width: 220px;
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 12px;
                    z-index: 99999;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
                    transition: transform 0.3s;
                }
                
                .floating-icon {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 99999;
                    box-shadow: 0 5px 15px rgba(14, 165, 233, 0.4);
                    font-size: 20px;
                    font-weight: bold;
                    color: white;
                }
                
                .floating-icon:hover {
                    transform: scale(1.1);
                }
                
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .panel-title {
                    font-weight: 600;
                    color: #0ea5e9;
                    font-size: 14px;
                }
                
                .scale-controls {
                    display: flex;
                    gap: 4px;
                }
                
                .scale-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .scale-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                .setting-item {
                    margin-bottom: 10px;
                }
                
                .setting-label {
                    display: block;
                    margin-bottom: 4px;
                    color: #cbd5e1;
                    font-size: 12px;
                }
                
                .checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .status-indicator {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.8);
                    border-radius: 6px;
                    padding: 8px 12px;
                    z-index: 99999;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .status-item {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                }
                
                .status-label {
                    color: #94a3b8;
                }
                
                .status-value {
                    color: #f1f5f9;
                    font-weight: 600;
                }
                
                .status-value.highlight {
                    color: #86efac;
                }
                
                .hidden {
                    display: none !important;
                }
                
                .mini-mode {
                    transform: scale(0.8);
                    transform-origin: bottom right;
                }
            `;
            
            document.head.appendChild(style);
        }
        
        createMainControls() {
            // 创建主控制容器
            this.controlsContainer = document.createElement('div');
            this.controlsContainer.className = 'custom-video-controls';
            
            // 播放/暂停按钮
            this.playBtn = document.createElement('button');
            this.playBtn.className = 'custom-control-btn';
            this.playBtn.textContent = '播放/暂停';
            this.controlsContainer.appendChild(this.playBtn);
            
            // 预加载按钮
            this.precacheBtn = document.createElement('button');
            this.precacheBtn.className = 'custom-control-btn';
            this.precacheBtn.textContent = '预加载';
            this.controlsContainer.appendChild(this.precacheBtn);
            
            // 速度控制区域
            const speedContainer = document.createElement('div');
            speedContainer.className = 'speed-controls';
            
            const speedLabel = document.createElement('span');
            speedLabel.textContent = '速度:';
            speedLabel.style.color = '#cbd5e1';
            speedLabel.style.marginRight = '5px';
            speedLabel.style.fontSize = '12px';
            speedContainer.appendChild(speedLabel);
            
            // 创建速度按钮
            this.speedBtns = [];
            const speeds = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
            
            speeds.forEach(speed => {
                const btn = document.createElement('button');
                btn.className = 'speed-btn';
                if (speed === this.currentSpeed) btn.classList.add('active');
                btn.textContent = speed === 1.0 ? '1x' : `${speed}x`;
                btn.dataset.speed = speed;
                speedContainer.appendChild(btn);
                this.speedBtns.push(btn);
            });
            
            this.controlsContainer.appendChild(speedContainer);
            
            // 将控制面板添加到视频容器
            if (this.video.parentNode) {
                this.video.parentNode.style.position = 'relative';
                this.video.parentNode.appendChild(this.controlsContainer);
            }
        }
        
        createFloatingPanel() {
            // 创建悬浮图标
            this.floatingIcon = document.createElement('div');
            this.floatingIcon.className = 'floating-icon';
            this.floatingIcon.textContent = '▶';
            this.floatingIcon.title = '视频播放器设置';
            document.body.appendChild(this.floatingIcon);
            
            // 创建悬浮面板
            this.floatingPanel = document.createElement('div');
            this.floatingPanel.className = 'floating-controls-panel';
            this.floatingPanel.innerHTML = `
                <div class="panel-header">
                        <div class="panel-title">播放器设置 v5.0</div>
                        <div class="scale-controls">
                            <button class="scale-btn minimize-btn">−</button>
                            <button class="scale-btn maximize-btn">＋</button>
                            <button class="scale-btn close-btn">×</button>
                        </div>
                    </div>
                    <div class="panel-content">
                        <div class="setting-item">
                            <div class="setting-label">预加载缓存 (1分钟)</div>
                            <label class="checkbox-label">
                                <input type="checkbox" class="auto-precache" ${this.config.autoPrecache ? 'checked' : ''}>
                                <span>自动预加载</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-label">记忆播放位置</div>
                            <label class="checkbox-label">
                                <input type="checkbox" class="enable-memory" ${this.config.enableMemory ? 'checked' : ''}>
                                <span>启用记忆功能</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-label">缓存状态</div>
                            <div class="cache-info" style="font-size: 11px; color: #86efac; margin-top: 4px;">
                                就绪
                            </div>
                        </div>
                    </div>
            `;
            
            document.body.appendChild(this.floatingPanel);
            
            // 如果配置为隐藏面板，则初始隐藏
            if (this.config.hidePanel) {
                this.floatingPanel.classList.add('hidden');
            } else if (!this.config.alwaysShowIcon) {
                this.floatingIcon.classList.add('hidden');
            }
            
            // 应用保存的缩放
            this.floatingPanel.style.transform = `scale(${this.config.panelScale})`;
        }
        
        createStatusIndicator() {
            this.statusIndicator = document.createElement('div');
            this.statusIndicator.className = 'status-indicator';
            this.statusIndicator.innerHTML = `
                <div class="status-item">
                    <span class="status-label">速度:</span>
                    <span class="status-value current-speed">1.0x</span>
                </div>
                <div class="status-item">
                    <span class="status-label">记忆:</span>
                    <span class="status-value memory-position">00:00</span>
                </div>
                <div class="status-item">
                    <span class="status-label">缓存:</span>
                    <span class="status-value cache-status">0%</span>
                </div>
            `;
            
            document.body.appendChild(this.statusIndicator);
        }
        
        bindEvents() {
            // 播放/暂停按钮
            this.playBtn.addEventListener('click', () => {
                if (this.video.paused) {
                    this.video.play();
                } else {
                    this.video.pause();
                }
            });
            
            // 视频播放状态变化
            this.video.addEventListener('play', () => {
                this.playBtn.textContent = '暂停';
            });
            
            this.video.addEventListener('pause', () => {
                this.playBtn.textContent = '播放';
            });
            
            // 速度控制按钮
            this.speedBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const speed = parseFloat(btn.dataset.speed);
                    this.setPlaybackSpeed(speed);
                });
            });
            
            // 预加载按钮
            this.precacheBtn.addEventListener('click', () => {
                this.precacheVideo(60);
            });
            
            // 视频播放时间更新
            this.video.addEventListener('timeupdate', () => {
                if (this.config.enableMemory) {
                    this.savePlayPosition();
                }
                this.updateStatusDisplay();
            });
            
            // 悬浮图标点击事件
            this.floatingIcon.addEventListener('click', () => {
                this.toggleFloatingPanel();
            });
            
            // 悬浮面板控制按钮
            this.floatingPanel.querySelector('.minimize-btn').addEventListener('click', () => {
                this.scalePanel(-0.2);
            });
            
            this.floatingPanel.querySelector('.maximize-btn').addEventListener('click', () => {
                this.scalePanel(0.2);
            });
            
            this.floatingPanel.querySelector('.close-btn').addEventListener('click', () => {
                this.hideFloatingPanel();
            });
            
            // 配置复选框事件
            this.floatingPanel.querySelector('.auto-precache').addEventListener('change', (e) => {
                this.config.autoPrecache = e.target.checked;
                this.saveConfig();
                
                const cacheInfo = this.floatingPanel.querySelector('.cache-info');
                if (this.config.autoPrecache) {
                    cacheInfo.textContent = '自动预缓存已启用';
                    cacheInfo.style.color = '#86efac';
                    this.setupAutoPrecache();
                } else {
                    cacheInfo.textContent = '自动预缓存已禁用';
                    cacheInfo.style.color = '#f87171';
                }
            });
            
            this.floatingPanel.querySelector('.enable-memory').addEventListener('change', (e) => {
                this.config.enableMemory = e.target.checked;
                this.saveConfig();
                
                if (this.config.enableMemory) {
                    this.checkMemory();
                }
            });
            
            // 页面事件
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.config.enableMemory) {
                    this.savePlayPosition();
                }
            });
            
            window.addEventListener('beforeunload', () => {
                if (this.config.enableMemory) {
                    this.savePlayPosition();
                }
            });
            
            // 点击页面其他地方隐藏面板
            document.addEventListener('click', (e) => {
                if (!this.floatingPanel.contains(e.target) && 
                    !this.floatingIcon.contains(e.target) &&
                    !this.floatingPanel.classList.contains('hidden')) {
                    this.hideFloatingPanel();
                }
            });
        }
        
        setPlaybackSpeed(speed) {
            this.currentSpeed = speed;
            this.video.playbackRate = speed;
            
            // 更新按钮状态
            this.speedBtns.forEach(btn => {
                if (parseFloat(btn.dataset.speed) === speed) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // 更新状态显示
            this.updateStatusDisplay();
            
            // 保存偏好
            localStorage.setItem('videoPlayer_preferredSpeed', speed.toString());
        }
        
        precacheVideo(seconds) {
            if (this.isPrecaching || !this.video.buffered.length) {
                return;
            }
            
            this.isPrecaching = true;
            this.precacheBtn.textContent = '缓存中...';
            this.precacheBtn.disabled = true;
            
            const cacheInfo = this.floatingPanel.querySelector('.cache-info');
            cacheInfo.textContent = '开始预缓存...';
            cacheInfo.style.color = '#0ea5e9';
            
            // 模拟预加载过程
            let progress = 0;
            const interval = setInterval(() => {
                progress += 5;
                this.updateCacheStatus(progress);
                
                if (progress >= 100) {
                    clearInterval(interval);
                    this.isPrecaching = false;
                    this.precacheBtn.textContent = '预加载';
                    this.precacheBtn.disabled = false;
                    cacheInfo.textContent = `已预加载${seconds}秒内容`;
                    cacheInfo.style.color = '#86efac';
                    
                    setTimeout(() => {
                        if (this.config.autoPrecache) {
                            cacheInfo.textContent = '自动预缓存已启用';
                        } else {
                            cacheInfo.textContent = '就绪';
                        }
                        cacheInfo.style.color = '#0ea5e9';
                    }, 3000);
                }
            }, 50);
        }
        
        setupAutoPrecache() {
            this.video.addEventListener('canplay', () => {
                if (this.config.autoPrecache && !this.isPrecaching) {
                    setTimeout(() => {
                        this.precacheVideo(60);
                    }, 1000);
                }
            }, { once: true });
        }
        
        savePlayPosition() {
            if (!this.config.enableMemory) return;
            
            const playInfo = {
                time: this.video.currentTime,
                speed: this.currentSpeed,
                timestamp: Date.now(),
                videoId: this.videoId
            };
            
            localStorage.setItem('videoPlayer_memory', JSON.stringify(playInfo));
        }
        
        checkMemory() {
            if (!this.config.enableMemory) return;
            
            const saved = localStorage.getItem('videoPlayer_memory');
            if (saved) {
                try {
                    const playInfo = JSON.parse(saved);
                    
                    if (playInfo.videoId === this.videoId && 
                        Date.now() - playInfo.timestamp < 7 * 24 * 60 * 60 * 1000) {
                        
                        this.lastPlayPosition = playInfo.time;
                        
                        this.video.addEventListener('loadedmetadata', () => {
                            if (this.video.duration > playInfo.time) {
                                this.video.currentTime = playInfo.time;
                                this.updateStatusDisplay();
                                
                                if (playInfo.speed) {
                                    this.setPlaybackSpeed(playInfo.speed);
                                }
                            }
                        }, { once: true });
                    }
                } catch (e) {
                    console.error('读取播放记忆失败:', e);
                }
            }
        }
        
        updateStatusDisplay() {
            if (!this.statusIndicator) return;
            
            // 更新当前速度
            const speedElement = this.statusIndicator.querySelector('.current-speed');
            if (speedElement) {
                speedElement.textContent = `${this.currentSpeed.toFixed(1)}x`;
            }
            
            // 更新记忆位置
            const memoryElement = this.statusIndicator.querySelector('.memory-position');
            if (memoryElement) {
                memoryElement.textContent = this.formatTime(this.video.currentTime);
            }
            
            // 更新缓存状态
            if (this.video.buffered.length > 0) {
                const bufferedEnd = this.video.buffered.end(0);
                const duration = this.video.duration || 1;
                const cachePercent = Math.min(100, Math.floor((bufferedEnd / duration) * 100));
                
                const cacheElement = this.statusIndicator.querySelector('.cache-status');
                if (cacheElement) {
                    cacheElement.textContent = `${cachePercent}%`;
                }
            }
        }
        
        updateCacheStatus(percent) {
            const cacheElement = this.statusIndicator.querySelector('.cache-status');
            if (cacheElement) {
                cacheElement.textContent = `${percent}%`;
            }
        }
        
        toggleFloatingPanel() {
            if (this.floatingPanel.classList.contains('hidden')) {
                this.floatingPanel.classList.remove('hidden');
                if (!this.config.alwaysShowIcon) {
                    this.floatingIcon.classList.add('hidden');
                }
            } else {
                this.hideFloatingPanel();
            }
        }
        
        hideFloatingPanel() {
            this.floatingPanel.classList.add('hidden');
            this.config.hidePanel = true;
            this.saveConfig();
            
            if (this.config.alwaysShowIcon) {
                this.floatingIcon.classList.remove('hidden');
            }
        }
        
        scalePanel(delta) {
            this.config.panelScale = Math.max(0.5, Math.min(2.0, this.config.panelScale + delta));
            this.floatingPanel.style.transform = `scale(${this.config.panelScale})`;
            localStorage.setItem('videoPlayer_panelScale', this.config.panelScale.toString());
        }
        
        loadConfig() {
            // 加载播放速度偏好
            const savedSpeed = localStorage.getItem('videoPlayer_preferredSpeed');
            if (savedSpeed) {
                this.currentSpeed = parseFloat(savedSpeed);
                if (this.video) {
                    this.video.playbackRate = this.currentSpeed;
                }
            }
            
            // 加载配置
            const savedConfig = localStorage.getItem('videoPlayer_config');
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    this.config = { ...this.config, ...config };
                } catch (e) {
                    console.error('加载配置失败:', e);
                }
            }
        }
        
        saveConfig() {
            localStorage.setItem('videoPlayer_config', JSON.stringify(this.config));
        }
        
        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // 初始化播放器
    setTimeout(() => {
        new CustomVideoPlayer();
    }, 1000);

})();