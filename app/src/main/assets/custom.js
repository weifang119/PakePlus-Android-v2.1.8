window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});/**
 * 视频播放速度控制器（服务器播放器优先）
 * 支持1.0倍到3.5倍速的自定义调节
 * 优先使用服务器播放器（8.0.01/8.0.02版本）
 */
class VideoPlaybackSpeedController {
    constructor() {
        this.speedOptions = [];
        this.currentSpeed = 1.0;
        this.videoElement = null;
        this.videoElements = new Set();
        this.isUIVisible = false;
        this.videoKey = null;
        this.isGlobalSync = true;
        this.lastSetSpeed = null;
        
        // 服务器播放器配置
        this.serverPlayers = {
            '8.0.01': {
                name: 'Server Player 8.0.01',
                priority: 100,
                features: ['adaptive', 'high_quality', 'stable']
            },
            '8.0.02': {
                name: 'Server Player 8.0.02',
                priority: 90,
                features: ['enhanced', 'optimized', 'latest']
            },
            'default': {
                name: 'Browser Player',
                priority: 0,
                features: ['basic']
            }
        };
        
        this.preferredServer = '8.0.01'; // 默认优先服务器
        this.useServerPlayer = true; // 是否使用服务器播放器
        
        this.generateSpeedOptions();
        this.storage = this.initStorage();
        this.GLOBAL_SPEED_KEY = 'video_playback_speed_global';
    }
    
    /**
     * 初始化存储系统
     */
    initStorage() {
        try {
            if (typeof localStorage !== 'undefined') {
                return {
                    get: (key) => {
                        const value = localStorage.getItem(key);
                        return value ? JSON.parse(value) : null;
                    },
                    set: (key, value) => {
                        localStorage.setItem(key, JSON.stringify(value));
                    },
                    remove: (key) => {
                        localStorage.removeItem(key);
                    },
                    getAllKeys: () => {
                        return Object.keys(localStorage);
                    }
                };
            }
        } catch (e) {
            console.warn('localStorage不可用，将使用内存存储');
        }
        
        const memoryStore = {};
        return {
            get: (key) => memoryStore[key],
            set: (key, value) => { memoryStore[key] = value; },
            remove: (key) => { delete memoryStore[key]; },
            getAllKeys: () => Object.keys(memoryStore)
        };
    }
    
    /**
     * 生成速度选项数组
     */
    generateSpeedOptions() {
        for (let speed = 1.0; speed <= 3.5; speed += 0.1) {
            this.speedOptions.push(parseFloat(speed.toFixed(1)));
        }
    }
    
    /**
     * 检测并选择最佳播放器
     */
    detectAndSelectPlayer(videoElement) {
        const playerInfo = {
            type: 'unknown',
            version: 'unknown',
            priority: 0,
            url: window.location.href
        };
        
        // 检测当前页面使用的播放器
        const serverPatterns = [
            { pattern: /8\.0\.01/, version: '8.0.01', priority: 100 },
            { pattern: /8\.0\.02/, version: '8.0.02', priority: 90 },
            { pattern: /server.*player/i, version: 'server', priority: 80 },
            { pattern: /cloud.*player/i, version: 'cloud', priority: 70 }
        ];
        
        // 检查URL
        const currentUrl = window.location.href.toLowerCase();
        for (const pattern of serverPatterns) {
            if (pattern.pattern.test(currentUrl)) {
                playerInfo.type = 'server';
                playerInfo.version = pattern.version;
                playerInfo.priority = pattern.priority;
                break;
            }
        }
        
        // 检查页面中的播放器元素
        const playerElements = document.querySelectorAll('[class*="player"], [id*="player"], video, iframe');
        playerElements.forEach(element => {
            const elementInfo = this.analyzePlayerElement(element);
            if (elementInfo.priority > playerInfo.priority) {
                Object.assign(playerInfo, elementInfo);
            }
        });
        
        // 检查脚本
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.src.toLowerCase();
            for (const pattern of serverPatterns) {
                if (pattern.pattern.test(src)) {
                    if (pattern.priority > playerInfo.priority) {
                        playerInfo.type = 'server';
                        playerInfo.version = pattern.version;
                        playerInfo.priority = pattern.priority;
                    }
                }
            }
        });
        
        // 如果检测到服务器播放器，优先使用
        if (playerInfo.type === 'server') {
            this.preferredServer = playerInfo.version;
            this.useServerPlayer = true;
            console.log(`检测到服务器播放器: ${playerInfo.version}, 优先级: ${playerInfo.priority}`);
        } else {
            console.log('使用默认浏览器播放器');
        }
        
        return playerInfo;
    }
    
    /**
     * 分析播放器元素
     */
    analyzePlayerElement(element) {
        const info = {
            type: 'browser',
            version: 'default',
            priority: 0
        };
        
        // 检查class和id
        const attrs = [
            element.className?.toString().toLowerCase() || '',
            element.id?.toLowerCase() || '',
            element.src?.toLowerCase() || '',
            element.getAttribute('data-player')?.toLowerCase() || ''
        ];
        
        const attrString = attrs.join(' ');
        
        if (attrString.includes('8.0.01')) {
            info.type = 'server';
            info.version = '8.0.01';
            info.priority = 100;
        } else if (attrString.includes('8.0.02')) {
            info.type = 'server';
            info.version = '8.0.02';
            info.priority = 90;
        } else if (attrString.includes('server-player') || attrString.includes('server_player')) {
            info.type = 'server';
            info.version = 'server';
            info.priority = 80;
        }
        
        return info;
    }
    
    /**
     * 生成视频的唯一标识符
     */
    generateVideoKey(videoElement) {
        if (!videoElement) return 'global_default';
        
        const sources = [];
        
        // 包含播放器信息
        const playerInfo = this.detectAndSelectPlayer(videoElement);
        sources.push(`player_${playerInfo.type}_${playerInfo.version}`);
        
        // 视频源
        if (videoElement.src && videoElement.src !== window.location.href) {
            sources.push(videoElement.src);
        }
        
        const sourceElements = videoElement.querySelectorAll('source');
        sourceElements.forEach(source => {
            if (source.src) sources.push(source.src);
        });
        
        if (videoElement.id) sources.push(`id_${videoElement.id}`);
        if (videoElement.dataset.id) sources.push(`data_id_${videoElement.dataset.id}`);
        
        if (sources.length <= 1) {
            const allVideos = document.querySelectorAll('video');
            const index = Array.from(allVideos).indexOf(videoElement);
            sources.push(`video_index_${index}_${window.location.href}`);
        }
        
        const combined = sources.join('|');
        return this.hashString(combined);
    }
    
    /**
     * 简单的字符串哈希函数
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'video_' + Math.abs(hash).toString(16);
    }
    
    /**
     * 获取存储键名
     */
    getStorageKey(key) {
        return `video_speed_${key}`;
    }
    
    /**
     * 保存播放速度设置
     */
    saveSpeedSetting() {
        if (!this.videoKey) return;
        
        const playerInfo = this.detectAndSelectPlayer(this.videoElement);
        
        const speedData = {
            speed: this.currentSpeed,
            timestamp: Date.now(),
            videoSrc: this.videoElement?.src || '',
            playerType: playerInfo.type,
            playerVersion: playerInfo.version,
            isGlobal: this.isGlobalSync
        };
        
        this.storage.set(this.getStorageKey(this.videoKey), speedData);
        
        if (this.isGlobalSync) {
            const globalData = {
                speed: this.currentSpeed,
                timestamp: Date.now(),
                playerType: playerInfo.type,
                playerVersion: playerInfo.version,
                isGlobal: true
            };
            this.storage.set(this.GLOBAL_SPEED_KEY, globalData);
        }
        
        console.log('播放速度设置已保存:', speedData);
        this.syncToOtherVideos();
    }
    
    /**
     * 加载播放速度设置
     */
    loadSpeedSetting() {
        if (!this.videoKey) return false;
        
        let speedToSet = 1.0;
        let loadedFrom = 'default';
        const playerInfo = this.detectAndSelectPlayer(this.videoElement);
        
        // 1. 当前视频特定设置
        const videoSpecificData = this.storage.get(this.getStorageKey(this.videoKey));
        if (videoSpecificData && videoSpecificData.speed) {
            const speed = parseFloat(videoSpecificData.speed);
            if (speed >= 1.0 && speed <= 3.5) {
                // 检查播放器类型是否匹配
                if (videoSpecificData.playerType === playerInfo.type && 
                    videoSpecificData.playerVersion === playerInfo.version) {
                    speedToSet = speed;
                    loadedFrom = 'video_specific';
                }
            }
        }
        
        // 2. 全局设置
        if (speedToSet === 1.0) {
            const globalData = this.storage.get(this.GLOBAL_SPEED_KEY);
            if (globalData && globalData.speed) {
                const speed = parseFloat(globalData.speed);
                if (speed >= 1.0 && speed <= 3.5) {
                    speedToSet = speed;
                    loadedFrom = 'global';
                }
            }
        }
        
        // 3. 最后一次设置
        if (speedToSet === 1.0 && this.lastSetSpeed !== null) {
            speedToSet = this.lastSetSpeed;
            loadedFrom = 'last_set';
        }
        
        this.currentSpeed = speedToSet;
        console.log(`播放速度设置已加载: ${speedToSet}x (来源: ${loadedFrom}, 播放器: ${playerInfo.version})`);
        
        return speedToSet !== 1.0;
    }
    
    /**
     * 同步到其他视频元素
     */
    syncToOtherVideos() {
        if (!this.isGlobalSync) return;
        
        this.videoElements.forEach(video => {
            if (video !== this.videoElement) {
                const previousSpeed = video.playbackRate;
                video.playbackRate = this.currentSpeed;
                
                if (Math.abs(previousSpeed - this.currentSpeed) > 0.01) {
                    console.log(`同步视频播放速度: ${previousSpeed.toFixed(1)}x → ${this.currentSpeed.toFixed(1)}x`);
                }
            }
        });
    }
    
    /**
     * 绑定视频元素
     */
    bindVideo(videoElement) {
        if (!videoElement) {
            console.error('视频元素无效');
            return;
        }
        
        this.videoElement = videoElement;
        
        // 检测播放器
        const playerInfo = this.detectAndSelectPlayer(videoElement);
        console.log(`播放器信息: ${playerInfo.type} ${playerInfo.version}, 优先级: ${playerInfo.priority}`);
        
        this.videoKey = this.generateVideoKey(videoElement);
        this.videoElements.add(videoElement);
        
        this.loadSpeedSetting();
        videoElement.playbackRate = this.currentSpeed;
        this.lastSetSpeed = this.currentSpeed;
        
        console.log(`视频已绑定，播放器: ${playerInfo.version}, 速度: ${this.currentSpeed}x`);
        
        this.setupVideoListeners(videoElement);
        this.observePageVideos();
        
        // 如果检测到服务器播放器，尝试优化
        if (playerInfo.type === 'server') {
            this.optimizeServerPlayer(videoElement, playerInfo);
        }
    }
    
    /**
     * 优化服务器播放器
     */
    optimizeServerPlayer(videoElement, playerInfo) {
        console.log(`正在优化服务器播放器 ${playerInfo.version}...`);
        
        // 8.0.01 版本优化
        if (playerInfo.version === '8.0.01') {
            this.optimizeServer_8_0_01(videoElement);
        }
        
        // 8.0.02 版本优化
        if (playerInfo.version === '8.0.02') {
            this.optimizeServer_8_0_02(videoElement);
        }
        
        // 通用优化
        this.applyCommonOptimizations(videoElement);
    }
    
    /**
     * 优化服务器 8.0.01
     */
    optimizeServer_8_0_01(videoElement) {
        try {
            // 设置更好的缓冲
            videoElement.preload = 'auto';
            
            // 添加事件监听器
            videoElement.addEventListener('waiting', () => {
                console.log('8.0.01: 视频等待中，优化缓冲...');
            });
            
            videoElement.addEventListener('playing', () => {
                console.log('8.0.01: 视频播放中');
            });
            
            // 设置元数据
            if (videoElement.readyState >= 1) {
                this.applyServerSpecificSettings(videoElement, '8.0.01');
            }
        } catch (e) {
            console.warn('8.0.01优化失败:', e);
        }
    }
    
    /**
     * 优化服务器 8.0.02
     */
    optimizeServer_8_0_02(videoElement) {
        try {
            // 设置预加载
            videoElement.preload = 'metadata';
            
            // 添加性能监控
            videoElement.addEventListener('progress', () => {
                if (videoElement.buffered.length > 0) {
                    const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
                    const currentTime = videoElement.currentTime;
                    const bufferAhead = bufferedEnd - currentTime;
                    
                    if (bufferAhead < 5) {
                        console.log('8.0.02: 缓冲区不足，建议预加载');
                    }
                }
            });
            
            // 设置高级属性
            videoElement.playsInline = true;
            videoElement.setAttribute('webkit-playsinline', '');
            videoElement.setAttribute('x5-playsinline', '');
            
            if (videoElement.readyState >= 1) {
                this.applyServerSpecificSettings(videoElement, '8.0.02');
            }
        } catch (e) {
            console.warn('8.0.02优化失败:', e);
        }
    }
    
    /**
     * 应用通用优化
     */
    applyCommonOptimizations(videoElement) {
        // 设置基本属性
        videoElement.crossOrigin = 'anonymous';
        videoElement.setAttribute('playsinline', '');
        
        // 监听错误
        videoElement.addEventListener('error', (e) => {
            console.warn('视频播放错误:', e);
            this.handlePlayerError(videoElement, e);
        });
        
        // 监听卡顿
        let lastTime = 0;
        let stutterCount = 0;
        
        videoElement.addEventListener('timeupdate', () => {
            const currentTime = videoElement.currentTime;
            const delta = currentTime - lastTime;
            
            if (delta > 0 && delta < 0.1) {
                stutterCount++;
                if (stutterCount > 3) {
                    console.log('检测到卡顿，尝试优化...');
                    this.optimizePlayback(videoElement);
                    stutterCount = 0;
                }
            } else {
                stutterCount = 0;
            }
            
            lastTime = currentTime;
        });
    }
    
    /**
     * 应用服务器特定设置
     */
    applyServerSpecificSettings(videoElement, serverVersion) {
        const settings = {
            '8.0.01': {
                bufferSize: 30,
                quality: 'high',
                codecPriority: ['h264', 'h265', 'vp9']
            },
            '8.0.02': {
                bufferSize: 20,
                quality: 'adaptive',
                codecPriority: ['h265', 'h264', 'vp9', 'av1']
            }
        };
        
        const setting = settings[serverVersion];
        if (setting) {
            console.log(`应用服务器 ${serverVersion} 设置:`, setting);
            
            // 存储设置供调试用
            videoElement.dataset.serverSettings = JSON.stringify(setting);
            
            // 尝试应用质量设置
            if (videoElement.canPlayType) {
                for (const codec of setting.codecPriority) {
                    const mimeType = `video/${codec === 'h264' ? 'mp4' : codec === 'h265' ? 'mp4' : 'webm'}; codecs="${codec}"`;
                    if (videoElement.canPlayType(mimeType) !== '') {
                        console.log(`推荐使用 ${codec} 编码`);
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * 处理播放器错误
     */
    handlePlayerError(videoElement, error) {
        console.error('播放器错误:', error);
        
        // 尝试重新加载
        if (videoElement.error && videoElement.error.code === 4) {
            console.log('尝试重新加载视频...');
            const currentSrc = videoElement.src;
            videoElement.src = '';
            setTimeout(() => {
                videoElement.src = currentSrc;
                videoElement.load();
            }, 1000);
        }
        
        // 如果是服务器播放器错误，尝试备用方案
        const playerInfo = this.detectAndSelectPlayer(videoElement);
        if (playerInfo.type === 'server') {
            console.log('服务器播放器错误，尝试备用方案...');
            this.tryFallbackPlayer(videoElement);
        }
    }
    
    /**
     * 尝试备用播放器
     */
    tryFallbackPlayer(videoElement) {
        // 检查是否有备用播放器可用
        const backupPlayers = ['8.0.02', '8.0.01', 'default'];
        
        for (const player of backupPlayers) {
            console.log(`尝试备用播放器: ${player}`);
            
            if (player !== this.preferredServer) {
                // 这里可以实现切换到备用播放器的逻辑
                // 例如：修改视频源URL或重新加载不同的播放器
                break;
            }
        }
    }
    
    /**
     * 优化播放性能
     */
    optimizePlayback(videoElement) {
        // 降低视频质量以减少卡顿
        if (videoElement.playbackRate > 1.5) {
            const newSpeed = Math.max(1.0, videoElement.playbackRate - 0.5);
            console.log(`检测到卡顿，降低速度: ${videoElement.playbackRate.toFixed(1)}x → ${newSpeed.toFixed(1)}x`);
            videoElement.playbackRate = newSpeed;
            this.currentSpeed = newSpeed;
        }
        
        // 尝试清理缓存
        if (videoElement.buffered.length > 0) {
            try {
                // 这里可以添加缓冲优化逻辑
            } catch (e) {
                console.warn('缓冲优化失败:', e);
            }
        }
    }
    
    /**
     * 观察页面中的所有视频元素
     */
    observePageVideos() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeName === 'VIDEO') {
                            this.autoBindNewVideo(node);
                        } else if (node.querySelectorAll) {
                            const videos = node.querySelectorAll('video');
                            videos.forEach(video => this.autoBindNewVideo(video));
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        document.querySelectorAll('video').forEach(video => {
            if (!this.videoElements.has(video)) {
                this.autoBindNewVideo(video);
            }
        });
    }
    
    /**
     * 自动绑定新视频
     */
    autoBindNewVideo(videoElement) {
        if (this.videoElements.has(videoElement)) return;
        
        this.videoElements.add(videoElement);
        videoElement.playbackRate = this.currentSpeed;
        this.lastSetSpeed = this.currentSpeed;
        
        const playerInfo = this.detectAndSelectPlayer(videoElement);
        console.log(`新视频已绑定，播放器: ${playerInfo.version}, 速度: ${this.currentSpeed}x`);
        
        this.setupVideoListeners(videoElement);
        
        if (playerInfo.type === 'server') {
            this.optimizeServerPlayer(videoElement, playerInfo);
        }
    }
    
    /**
     * 设置视频监听器
     */
    setupVideoListeners(videoElement) {
        videoElement.addEventListener('play', () => {
            if (Math.abs(videoElement.playbackRate - this.currentSpeed) > 0.01) {
                videoElement.playbackRate = this.currentSpeed;
            }
        });
        
        videoElement.addEventListener('error', () => {
            console.warn('视频播放错误，尝试重新绑定');
        });
        
        const sourceObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    console.log('检测到视频源变化，重新生成视频标识');
                    this.videoKey = this.generateVideoKey(videoElement);
                    this.loadSpeedSetting();
                    videoElement.playbackRate = this.currentSpeed;
                    
                    const playerInfo = this.detectAndSelectPlayer(videoElement);
                    if (playerInfo.type === 'server') {
                        this.optimizeServerPlayer(videoElement, playerInfo);
                    }
                }
            });
        });
        
        sourceObserver.observe(videoElement, { attributes: true });
    }
    
    /**
     * 设置播放速度
     */
    setPlaybackSpeed(speed) {
        if (speed < 1.0 || speed > 3.5) {
            console.error(`播放速度需在1.0到3.5之间，当前设置: ${speed}`);
            return false;
        }
        
        const normalizedSpeed = Math.round(speed * 10) / 10;
        this.currentSpeed = normalizedSpeed;
        this.lastSetSpeed = normalizedSpeed;
        
        if (this.videoElement) {
            this.videoElement.playbackRate = normalizedSpeed;
        }
        
        this.syncToOtherVideos();
        this.saveSpeedSetting();
        
        const playerInfo = this.detectAndSelectPlayer(this.videoElement);
        console.log(`播放速度已设置为: ${normalizedSpeed}x, 播放器: ${playerInfo.version}`);
        
        return true;
    }
    
    /**
     * 增加播放速度
     */
    increaseSpeed(step = 0.1) {
        const newSpeed = Math.min(3.5, this.currentSpeed + step);
        this.setPlaybackSpeed(newSpeed);
        return this.currentSpeed;
    }
    
    /**
     * 减少播放速度
     */
    decreaseSpeed(step = 0.1) {
        const newSpeed = Math.max(1.0, this.currentSpeed - step);
        this.setPlaybackSpeed(newSpeed);
        return this.currentSpeed;
    }
    
    /**
     * 重置为正常速度
     */
    resetSpeed() {
        this.setPlaybackSpeed(1.0);
    }
    
    /**
     * 切换同步模式
     */
    toggleSyncMode() {
        this.isGlobalSync = !this.isGlobalSync;
        console.log(`同步模式: ${this.isGlobalSync ? '全局同步' : '独立设置'}`);
        return this.isGlobalSync;
    }
    
    /**
     * 切换服务器播放器
     */
    toggleServerPlayer() {
        this.useServerPlayer = !this.useServerPlayer;
        
        if (this.useServerPlayer) {
            // 切换服务器版本
            this.preferredServer = this.preferredServer === '8.0.01' ? '8.0.02' : '8.0.01';
            console.log(`切换到服务器播放器: ${this.preferredServer}`);
            
            // 重新检测和优化当前视频
            if (this.videoElement) {
                const playerInfo = this.detectAndSelectPlayer(this.videoElement);
                if (playerInfo.type === 'server') {
                    this.optimizeServerPlayer(this.videoElement, playerInfo);
                }
            }
        } else {
            console.log('切换到浏览器默认播放器');
        }
        
        return this.useServerPlayer;
    }
    
    /**
     * 获取当前播放速度
     */
    getCurrentSpeed() {
        return this.currentSpeed;
    }
    
    /**
     * 获取所有速度选项
     */
    getSpeedOptions() {
        return this.speedOptions;
    }
    
    /**
     * 获取同步模式
     */
    getSyncMode() {
        return this.isGlobalSync;
    }
    
    /**
     * 获取服务器播放器状态
     */
    getServerPlayerStatus() {
        const playerInfo = this.videoElement ? this.detectAndSelectPlayer(this.videoElement) : { type: 'unknown', version: 'unknown' };
        
        return {
            useServerPlayer: this.useServerPlayer,
            preferredServer: this.preferredServer,
            currentPlayer: playerInfo.version,
            playerType: playerInfo.type,
            serverPlayers: Object.keys(this.serverPlayers)
        };
    }
    
    /**
     * 获取视频数量
     */
    getVideoCount() {
        return this.videoElements.size;
    }
    
    /**
     * 清除所有保存的速度设置
     */
    clearAllSpeedSettings() {
        try {
            const keys = this.storage.getAllKeys();
            keys.forEach(key => {
                if (key.startsWith('video_speed_') || key === this.GLOBAL_SPEED_KEY) {
                    this.storage.remove(key);
                }
            });
            console.log('已清除所有播放速度设置');
        } catch (e) {
            console.warn('清除设置时出错:', e);
        }
    }
    
    /**
     * 格式化速度显示
     */
    formatSpeed(speed) {
        return `${speed.toFixed(1)}x`;
    }
}

/**
 * 创建右下角悬浮按钮控制面板（带服务器播放器控制）
 */
class FloatingSpeedControl {
    constructor(controller) {
        this.controller = controller;
        this.floatingButton = null;
        this.controlPanel = null;
        this.speedDisplay = null;
        this.isPanelVisible = false;
        this.init();
    }
    
    init() {
        this.createFloatingButton();
        this.createControlPanel();
        this.setupEventListeners();
        this.hideControlPanel();
    }
    
    /**
     * 创建右下角悬浮按钮
     */
    createFloatingButton() {
        this.floatingButton = document.createElement('div');
        this.floatingButton.className = 'speed-floating-button';
        
        const playerStatus = this.controller.getServerPlayerStatus();
        const playerIcon = playerStatus.useServerPlayer ? '🖥️' : '🌐';
        
        this.floatingButton.innerHTML = `
            <div class="speed-icon">${playerIcon}</div>
            <div class="speed-text">${this.controller.formatSpeed(this.controller.getCurrentSpeed())}</div>
            <div class="player-indicator" title="${playerStatus.currentPlayer}">${playerStatus.currentPlayer}</div>
        `;
        
        Object.assign(this.floatingButton.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '80px',
            height: '80px',
            backgroundColor: '#2196F3',
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: '9999',
            transition: 'all 0.3s ease',
            color: 'white',
            fontSize: '12px',
            userSelect: 'none'
        });
        
        // 图标样式
        this.floatingButton.querySelector('.speed-icon').style.cssText = `
            font-size: 24px;
            line-height: 1;
        `;
        
        // 速度文本样式
        this.floatingButton.querySelector('.speed-text').style.cssText = `
            font-size: 12px;
            line-height: 1;
            margin-top: 2px;
        `;
        
        // 播放器指示器样式
        this.floatingButton.querySelector('.player-indicator').style.cssText = `
            font-size: 8px;
            line-height: 1;
            margin-top: 2px;
            opacity: 0.8;
            background: rgba(0,0,0,0.3);
            padding: 1px 3px;
            border-radius: 3px;
        `;
        
        // 悬停效果
        this.floatingButton.addEventListener('mouseenter', () => {
            this.floatingButton.style.backgroundColor = '#1976D2';
            this.floatingButton.style.transform = 'scale(1.05)';
        });
        
        this.floatingButton.addEventListener('mouseleave', () => {
            this.floatingButton.style.backgroundColor = '#2196F3';
            this.floatingButton.style.transform = 'scale(1)';
        });
        
        this.floatingButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleControlPanel();
        });
        
        document.body.appendChild(this.floatingButton);
    }
    
    /**
     * 创建控制面板
     */
    createControlPanel() {
        this.controlPanel = document.createElement('div');
        this.controlPanel.className = 'speed-control-panel';
        
        Object.assign(this.controlPanel.style, {
            position: 'fixed',
            bottom: '110px',
            right: '20px',
            width: '280px',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            borderRadius: '10px',
            padding: '15px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: '9998',
            display: 'none',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            border: '1px solid #333'
        });
        
        // 面板标题
        const title = this.createPanelTitle();
        
        // 播放器控制
        const playerControl = this.createPlayerControl();
        
        // 同步控制
        const syncControl = this.createSyncControl();
        
        // 当前速度显示
        this.speedDisplay = document.createElement('div');
        this.speedDisplay.className = 'speed-display-large';
        this.speedDisplay.textContent = this.controller.formatSpeed(this.controller.getCurrentSpeed());
        this.speedDisplay.style.cssText = `
            font-size: 24px;
            text-align: center;
            margin: 10px 0;
            font-weight: bold;
            color: white;
        `;
        
        // 控制按钮容器
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        `;
        
        // 控制按钮
        const decreaseBtn = this.createControlButton('-', '减速0.1倍', () => {
            this.controller.decreaseSpeed();
            this.updateDisplay();
        });
        
        const increaseBtn = this.createControlButton('+', '加速0.1倍', () => {
            this.controller.increaseSpeed();
            this.updateDisplay();
        });
        
        const resetBtn = this.createControlButton('↺', '重置为1.0倍', () => {
            this.controller.resetSpeed();
            this.updateDisplay();
        }, { width: '100%', marginTop: '5px' });
        
        // 记忆控制
        const memoryControl = this.createMemoryControl();
        
        // 速度预设网格
        const presetGrid = this.createPresetGrid();
        
        // 速度滑块
        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'margin-top: 10px;';
        
        const speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.min = '10';
        speedSlider.max = '35';
        speedSlider.value = Math.round(this.controller.getCurrentSpeed() * 10).toString();
        speedSlider.step = '1';
        speedSlider.style.cssText = 'width: 100%;';
        
        speedSlider.oninput = (e) => {
            const speed = parseInt(e.target.value) / 10;
            this.controller.setPlaybackSpeed(speed);
            this.updateDisplay();
        };
        
        // 组装面板
        controlsContainer.appendChild(decreaseBtn);
        controlsContainer.appendChild(this.speedDisplay.cloneNode(true));
        controlsContainer.appendChild(increaseBtn);
        
        this.controlPanel.appendChild(title);
        this.controlPanel.appendChild(playerControl);
        this.controlPanel.appendChild(syncControl);
        this.controlPanel.appendChild(controlsContainer);
        this.controlPanel.appendChild(resetBtn);
        this.controlPanel.appendChild(memoryControl);
        this.controlPanel.appendChild(document.createElement('hr'));
        this.controlPanel.appendChild(presetGrid);
        this.controlPanel.appendChild(document.createElement('hr'));
        this.controlPanel.appendChild(sliderContainer);
        
        document.body.appendChild(this.controlPanel);
    }
    
    /**
     * 创建面板标题
     */
    createPanelTitle() {
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
            color: #2196F3;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const videoCount = this.controller.getVideoCount();
        const playerStatus = this.controller.getServerPlayerStatus();
        
        title.innerHTML = `
            <span>播放速度控制</span>
            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <span style="font-size: 10px; opacity: 0.7; font-weight: normal;">
                    ${videoCount}个视频
                </span>
                <span style="font-size: 9px; opacity: 0.6; font-weight: normal;">
                    ${playerStatus.currentPlayer}
                </span>
            </div>
        `;
        
        return title;
    }
    
    /**
     * 创建播放器控制
     */
    createPlayerControl() {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 10px;
            padding: 8px;
            background: rgba(33, 150, 243, 0.1);
            border-radius: 5px;
            border-left: 3px solid #2196F3;
        `;
        
        const playerStatus = this.controller.getServerPlayerStatus();
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        `;
        
        const label = document.createElement('span');
        label.textContent = '播放器设置';
        label.style.cssText = 'font-size: 12px; font-weight: bold; color: #2196F3;';
        
        const statusIndicator = document.createElement('span');
        statusIndicator.textContent = playerStatus.useServerPlayer ? '🖥️ 服务器' : '🌐 浏览器';
        statusIndicator.style.cssText = 'font-size: 10px; opacity: 0.8;';
        
        header.appendChild(label);
        header.appendChild(statusIndicator);
        
        // 服务器选择按钮
        const serverButtons = document.createElement('div');
        serverButtons.style.cssText = `
            display: flex;
            gap: 5px;
            margin-top: 5px;
        `;
        
        const servers = ['8.0.01', '8.0.02'];
        servers.forEach(server => {
            const button = document.createElement('button');
            button.textContent = server;
            button.title = `使用服务器播放器 ${server}`;
            
            Object.assign(button.style, {
                padding: '3px 8px',
                backgroundColor: playerStatus.preferredServer === server ? '#4CAF50' : '#666',
                border: 'none',
                borderRadius: '3px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '10px',
                flex: '1',
                transition: 'all 0.2s'
            });
            
            button.onmouseenter = () => {
                if (playerStatus.preferredServer !== server) {
                    button.style.backgroundColor = '#888';
                }
            };
            
            button.onmouseleave = () => {
                if (playerStatus.preferredServer !== server) {
                    button.style.backgroundColor = '#666';
                }
            };
            
            button.onclick = (e) => {
                e.stopPropagation();
                if (playerStatus.preferredServer !== server) {
                    this.controller.preferredServer = server;
                    this.controller.useServerPlayer = true;
                    this.showMessage(`切换到服务器播放器 ${server}`);
                    this.updateDisplay();
                    
                    // 重新优化当前视频
                    if (this.controller.videoElement) {
                        const playerInfo = this.controller.detectAndSelectPlayer(this.controller.videoElement);
                        this.controller.optimizeServerPlayer(this.controller.videoElement, playerInfo);
                    }
                }
            };
            
            serverButtons.appendChild(button);
        });
        
        // 切换播放器类型按钮
        const toggleButton = document.createElement('button');
        toggleButton.textContent = playerStatus.useServerPlayer ? '切换浏览器播放器' : '切换服务器播放器';
        toggleButton.title = '切换播放器类型';
        toggleButton.style.cssText = `
            padding: 3px 8px;
            backgroundColor: '#FF9800';
            border: none;
            border-radius: 3px;
            color: white;
            cursor: pointer;
            fontSize: 10px;
            marginTop: 5px;
            width: 100%;
        `;
        
        toggleButton.onclick = (e) => {
            e.stopPropagation();
            const newStatus = this.controller.toggleServerPlayer();
            toggleButton.textContent = newStatus ? '切换浏览器播放器' : '切换服务器播放器';
            this.showMessage(newStatus ? '已启用服务器播放器' : '已启用浏览器播放器');
            this.updateDisplay();
        };
        
        container.appendChild(header);
        container.appendChild(serverButtons);
        container.appendChild(toggleButton);
        
        return container;
    }
    
    /**
     * 创建同步控制
     */
    createSyncControl() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding: 5px 10px;
            background: rgba(255,255,255,0.1);
            border-radius: 5px;
        `;
        
        const label = document.createElement('span');
        label.textContent = '全局同步';
        label.style.cssText = 'font-size: 12px; opacity: 0.9;';
        
        const switchContainer = document.createElement('label');
        switchContainer.style.cssText = 'position: relative; display: inline-block; width: 40px; height: 20px;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.controller.getSyncMode();
        checkbox.style.cssText = 'opacity: 0; width: 0; height: 0;';
        
        const slider = document.createElement('span');
        slider.style.cssText = `
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 20px;
        `;
        
        const circle = document.createElement('span');
        circle.style.cssText = `
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        `;
        
        if (checkbox.checked) {
            slider.style.backgroundColor = '#4CAF50';
            circle.style.transform = 'translateX(20px)';
        }
        
        checkbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            this.controller.toggleSyncMode();
            
            if (isChecked) {
                slider.style.backgroundColor = '#4CAF50';
                circle.style.transform = 'translateX(20px)';
            } else {
                slider.style.backgroundColor = '#ccc';
                circle.style.transform = 'translateX(0)';
            }
            
            this.showMessage(isChecked ? '已启用全局同步' : '已启用独立模式');
        });
        
        switchContainer.appendChild(checkbox);
        switchContainer.appendChild(slider);
        slider.appendChild(circle);
        
        container.appendChild(label);
        container.appendChild(switchContainer);
        
        return container;
    }
    
    /**
     * 创建记忆控制
     */
    createMemoryControl() {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-top: 10px;
            font-size: 12px;
        `;
        
        const memoryInfo = document.createElement('div');
        memoryInfo.style.cssText = `
            margin-bottom: 8px;
            opacity: 0.8;
            font-size: 11px;
        `;
        memoryInfo.textContent = '速度设置已自动保存';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 5px;
            margin-top: 5px;
        `;
        
        const saveBtn = this.createControlButton('💾', '保存当前设置', () => {
            this.controller.saveSpeedSetting();
            this.showMessage('设置已保存');
        }, { 
            padding: '5px 10px',
            fontSize: '12px',
            flex: '1'
        });
        
        const clearBtn = this.createControlButton('🗑️', '清除所有设置', () => {
            if (confirm('确定要清除所有视频的播放速度设置吗？')) {
                this.controller.clearAllSpeedSettings();
                this.showMessage('设置已清除');
            }
        }, { 
            padding: '5px 10px',
            fontSize: '12px',
            flex: '1'
        });
        
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(clearBtn);
        
        container.appendChild(memoryInfo);
        container.appendChild(buttonContainer);
        
        return container;
    }
    
    /**
     * 创建控制按钮
     */
    createControlButton(text, title, onClick, customStyle = {}) {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.title = title;
        
        Object.assign(button.style, {
            width: '40px',
            height: '40px',
            backgroundColor: '#333',
            border: 'none',
            borderRadius: '5px',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            ...customStyle
        });
        
        button.onmouseenter = () => button.style.backgroundColor = '#555';
        button.onmouseleave = () => button.style.backgroundColor = '#333';
        button.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };
        
        return button;
    }
    
    /**
     * 创建速度预设网格
     */
    createPresetGrid() {
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
            margin-top: 10px;
        `;
        
        const presetSpeeds = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
        
        presetSpeeds.forEach(speed => {
            const button = document.createElement('button');
            button.textContent = `${speed}x`;
            button.title = `设置 ${speed} 倍速度`;
            
            Object.assign(button.style, {
                padding: '8px 0',
                backgroundColor: Math.abs(this.controller.getCurrentSpeed() - speed) < 0.05 ? '#4CAF50' : '#444',
                border: 'none',
                borderRadius: '3px',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '12px'
            });
            
            button.onmouseenter = () => {
                if (Math.abs(this.controller.getCurrentSpeed() - speed) > 0.05) {
                    button.style.backgroundColor = '#666';
                }
            };
            
            button.onmouseleave = () => {
                if (Math.abs(this.controller.getCurrentSpeed() - speed) > 0.05) {
                    button.style.backgroundColor = '#444';
                }
            };
            
            button.onclick = (e) => {
                e.stopPropagation();
                this.controller.setPlaybackSpeed(speed);
                this.updateDisplay();
            };
            
            grid.appendChild(button);
        });
        
        return grid;
    }
    
    /**
     * 设置事件监听
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (this.isPanelVisible && 
                !this.controlPanel.contains(e.target) && 
                !this.floatingButton.contains(e.target)) {
                this.hideControlPanel();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPanelVisible) {
                this.hideControlPanel();
            }
        });
    }
    
    /**
     * 切换控制面板
     */
    toggleControlPanel() {
        if (this.isPanelVisible) {
            this.hideControlPanel();
        } else {
            this.showControlPanel();
        }
    }
    
    /**
     * 显示控制面板
     */
    showControlPanel() {
        this.controlPanel.style.display = 'block';
        this.isPanelVisible = true;
        
        this.controlPanel.style.opacity = '0';
        this.controlPanel.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            this.controlPanel.style.transition = 'opacity 0.3s, transform 0.3s';
            this.controlPanel.style.opacity = '1';
            this.controlPanel.style.transform = 'translateY(0)';
        }, 10);
    }
    
    /**
     * 隐藏控制面板
     */
    hideControlPanel() {
        this.controlPanel.style.transition = 'opacity 0.3s, transform 0.3s';
        this.controlPanel.style.opacity = '0';
        this.controlPanel.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            this.controlPanel.style.display = 'none';
            this.isPanelVisible = false;
        }, 300);
    }
    
    /**
     * 更新显示
     */
    updateDisplay() {
        const speed = this.controller.getCurrentSpeed();
        const formattedSpeed = this.controller.formatSpeed(speed);
        const videoCount = this.controller.getVideoCount();
        const playerStatus = this.controller.getServerPlayerStatus();
        
        // 更新悬浮按钮
        const speedText = this.floatingButton.querySelector('.speed-text');
        const playerIcon = this.floatingButton.querySelector('.speed-icon');
        const playerIndicator = this.floatingButton.querySelector('.player-indicator');
        
        if (speedText) {
            speedText.textContent = formattedSpeed;
        }
        
        if (playerIcon) {
            playerIcon.textContent = playerStatus.useServerPlayer ? '🖥️' : '🌐';
        }
        
        if (playerIndicator) {
            playerIndicator.textContent = playerStatus.currentPlayer;
            playerIndicator.title = playerStatus.currentPlayer;
        }
        
        // 更新标题
        const title = this.controlPanel.querySelector('div[style*="display: flex; flex-direction: column"]');
        if (title) {
            const videoSpan = title.querySelector('span:nth-child(1)');
            const playerSpan = title.querySelector('span:nth-child(2)');
            if (videoSpan) videoSpan.textContent = `${videoCount}个视频`;
            if (playerSpan) playerSpan.textContent = playerStatus.currentPlayer;
        }
        
        // 更新控制面板显示
        const speedDisplay = this.controlPanel.querySelector('.speed-display-large');
        if (speedDisplay) {
            speedDisplay.textContent = formattedSpeed;
        }
        
        // 更新滑块
        const slider = this.controlPanel.querySelector('input[type="range"]');
        if (slider) {
            slider.value = Math.round(speed * 10);
        }
        
        // 更新服务器按钮
        const serverButtons = this.controlPanel.querySelectorAll('button[style*="font-size: 10px"]');
        serverButtons.forEach(button => {
            if (button.textContent.includes('8.0')) {
                const server = button.textContent.trim();
                button.style.backgroundColor = playerStatus.preferredServer === server ? '#4CAF50' : '#666';
            }
        });
        
        // 更新预设按钮状态
        const buttons = this.controlPanel.querySelectorAll('button');
        buttons.forEach(button => {
            if (button.textContent.includes('x')) {
                const buttonSpeed = parseFloat(button.textContent);
                button.style.backgroundColor = Math.abs(speed - buttonSpeed) < 0.05 ? '#4CAF50' : '#444';
            }
        });
        
        // 显示速度变化动画
        this.showSpeedChangeFeedback();
    }
    
    /**
     * 显示速度变化反馈
     */
    showSpeedChangeFeedback() {
        const speedText = this.floatingButton.querySelector('.speed-text');
        if (speedText) {
            speedText.style.transition = 'all 0.3s';
            speedText.style.color = '#FF9800';
            speedText.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                speedText.style.color = 'white';
                speedText.style.transform = 'scale(1)';
            }, 300);
        }
    }
    
    /**
     * 显示消息
     */
    showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            animation: messageFadeInOut 2s ease;
            font-size: 12px;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    }
    
    /**
     * 销毁控制面板
     */
    destroy() {
        if (this.floatingButton) this.floatingButton.remove();
        if (this.controlPanel) this.controlPanel.remove();
    }
}

/**
 * 键盘快捷键控制
 */
function setupKeyboardControls(controller) {
    if (!controller) return;
    
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const isCtrlPressed = e.ctrlKey || e.metaKey;
        
        switch(e.key) {
            case '[':
            case '-':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.decreaseSpeed(0.1);
                }
                break;
                
            case ']':
            case '=':
            case '+':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.increaseSpeed(0.1);
                }
                break;
                
            case '0':
            case 'r':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.resetSpeed();
                }
                break;
                
            case 's':
                if (isCtrlPressed && e.shiftKey) {
                    e.preventDefault();
                    controller.saveSpeedSetting();
                    alert('播放速度设置已保存');
                } else if (isCtrlPressed) {
                    e.preventDefault();
                    controller.toggleServerPlayer();
                }
                break;
                
            case 'g':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.toggleSyncMode();
                    alert(`已${controller.getSyncMode() ? '启用' : '禁用'}全局同步模式`);
                }
                break;
                
            case '1':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.preferredServer = '8.0.01';
                    controller.useServerPlayer = true;
                    alert('已切换到服务器播放器 8.0.01');
                }
                break;
                
            case '2':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.preferredServer = '8.0.02';
                    controller.useServerPlayer = true;
                    alert('已切换到服务器播放器 8.0.02');
                }
                break;
                
            case 'b':
                if (isCtrlPressed) {
                    e.preventDefault();
                    controller.useServerPlayer = false;
                    alert('已切换到浏览器播放器');
                }
                break;
        }
    });
}

/**
 * 初始化视频播放速度控制
 */
function initVideoSpeedControl(videoSelector = 'video') {
    const video = document.querySelector(videoSelector);
    if (!video) {
        console.error(`未找到视频元素: ${videoSelector}`);
        return null;
    }
    
    const controller = new VideoPlaybackSpeedController();
    controller.bindVideo(video);
    
    const floatingUI = new FloatingSpeedControl(controller);
    
    setupKeyboardControls(controller);
    
    // 添加样式
    addServerPlayerCSS();
    
    return {
        controller,
        floatingUI,
        destroy: () => floatingUI.destroy()
    };
}

/**
 * 添加CSS样式
 */
function addServerPlayerCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* 悬浮按钮动画 */
        .speed-floating-button {
            animation: floatAnimation 3s ease-in-out infinite;
        }
        
        @keyframes floatAnimation {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-5px) scale(1.05); }
        }
        
        /* 控制面板动画 */
        @keyframes speedPanelFadeIn {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        .speed-control-panel {
            animation: speedPanelFadeIn 0.3s ease-out;
        }
        
        /* 消息动画 */
        @keyframes messageFadeInOut {
            0% { opacity: 0; transform: translateX(100%); }
            20% { opacity: 1; transform: translateX(0); }
            80% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(100%); }
        }
        
        /* 服务器播放器指示器动画 */
        .speed-floating-button .player-indicator {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
        
        /* 服务器播放器状态指示 */
        .player-status-8-0-01 {
            border-color: #4CAF50 !important;
        }
        
        .player-status-8-0-02 {
            border-color: #2196F3 !important;
        }
        
        .player-status-browser {
            border-color: #FF9800 !important;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .speed-floating-button {
                width: 70px !important;
                height: 70px !important;
                bottom: 15px !important;
                right: 15px !important;
            }
            
            .speed-control-panel {
                width: 260px !important;
                bottom: 95px !important;
                right: 15px !important;
            }
        }
        
        @media (max-width: 480px) {
            .speed-floating-button {
                width: 60px !important;
                height: 60px !important;
                bottom: 10px !important;
                right: 10px !important;
            }
            
            .speed-control-panel {
                width: 240px !important;
                bottom: 80px !important;
                right: 10px !important;
            }
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * 服务器播放器工具函数
 */
const ServerPlayerUtils = {
    /**
     * 检测页面中使用的播放器
     */
    detectAllPlayers: () => {
        const players = [];
        
        // 检测URL中的播放器
        const url = window.location.href;
        if (url.includes('8.0.01')) players.push('8.0.01');
        if (url.includes('8.0.02')) players.push('8.0.02');
        
        // 检测脚本中的播放器
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.src;
            if (src.includes('8.0.01')) players.push('8.0.01');
            if (src.includes('8.0.02')) players.push('8.0.02');
        });
        
        // 检测元素中的播放器
        document.querySelectorAll('[class*="player"], [id*="player"]').forEach(el => {
            const className = el.className || '';
            const id = el.id || '';
            if (className.includes('8.0.01') || id.includes('8.0.01')) players.push('8.0.01');
            if (className.includes('8.0.02') || id.includes('8.0.02')) players.push('8.0.02');
        });
        
        return [...new Set(players)];
    },
    
    /**
     * 获取推荐的播放器
     */
    getRecommendedPlayer: () => {
        const players = ServerPlayerUtils.detectAllPlayers();
        
        if (players.includes('8.0.01')) return '8.0.01';
        if (players.includes('8.0.02')) return '8.0.02';
        return 'browser';
    },
    
    /**
     * 检查播放器特性
     */
    checkPlayerFeatures: (playerVersion) => {
        const features = {
            '8.0.01': ['自适应码率', '硬件加速', '高清支持', '稳定播放'],
            '8.0.02': ['4K支持', 'HDR', '低延迟', '优化编码'],
            'browser': ['基础播放', '兼容性好']
        };
        
        return features[playerVersion] || [];
    },
    
    /**
     * 获取播放器信息
     */
    getPlayerInfo: () => {
        const recommended = ServerPlayerUtils.getRecommendedPlayer();
        const features = ServerPlayerUtils.checkPlayerFeatures(recommended);
        
        return {
            recommended,
            availablePlayers: ServerPlayerUtils.detectAllPlayers(),
            features,
            timestamp: Date.now(),
            url: window.location.href
        };
    }
};

// 自动初始化
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const videoElements = document.querySelectorAll('video');
        
        if (videoElements.length > 0) {
            console.log(`找到 ${videoElements.length} 个视频元素，初始化播放速度控制`);
            
            // 检测播放器信息
            const playerInfo = ServerPlayerUtils.getPlayerInfo();
            console.log('播放器检测结果:', playerInfo);
            
            const speedControl = initVideoSpeedControl('video:first-of-type');
            window.videoSpeedControl = speedControl;
            
            // 显示欢迎信息
            setTimeout(() => {
                console.log('服务器播放器优化的视频播放速度控制已启动');
                console.log('功能特性:');
                console.log('1. 自动检测和优先使用服务器播放器 (8.0.01/8.0.02)');
                console.log('2. 智能播放器优化和性能调整');
                console.log('3. 多视频同步和记忆功能');
                console.log('快捷键:');
                console.log('  Ctrl+[ 减速 | Ctrl+] 加速 | Ctrl+R 重置');
                console.log('  Ctrl+S 切换播放器 | Ctrl+1 切到8.0.01 | Ctrl+2 切到8.0.02');
                console.log('  Ctrl+B 切到浏览器 | Ctrl+G 切换同步模式');
            }, 1000);
        } else {
            console.log('未找到视频元素，等待动态加载');
            
            const observer = new MutationObserver(() => {
                const videos = document.querySelectorAll('video');
                if (videos.length > 0) {
                    window.videoSpeedControl = initVideoSpeedControl('video:first-of-type');
                    observer.disconnect();
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
}

// 全局API
if (typeof window !== 'undefined') {
    window.VideoSpeedControl = {
        init: (videoSelector) => initVideoSpeedControl(videoSelector),
        createController: (videoElement) => {
            const controller = new VideoPlaybackSpeedController();
            controller.bindVideo(videoElement);
            return controller;
        },
        
        // 服务器播放器相关API
        serverPlayer: {
            // 检测播放器
            detect: () => ServerPlayerUtils.detectAllPlayers(),
            
            // 获取推荐播放器
            getRecommended: () => ServerPlayerUtils.getRecommendedPlayer(),
            
            // 获取播放器信息
            getInfo: () => ServerPlayerUtils.getPlayerInfo(),
            
            // 手动切换到指定播放器
            switchTo: (version) => {
                if (window.videoSpeedControl && window.videoSpeedControl.controller) {
                    const controller = window.videoSpeedControl.controller;
                    
                    if (version === '8.0.01' || version === '8.0.02') {
                        controller.preferredServer = version;
                        controller.useServerPlayer = true;
                        console.log(`手动切换到服务器播放器 ${version}`);
                        
                        // 重新优化当前视频
                        if (controller.videoElement) {
                            const playerInfo = controller.detectAndSelectPlayer(controller.videoElement);
                            controller.optimizeServerPlayer(controller.videoElement, playerInfo);
                        }
                        
                        return true;
                    } else if (version === 'browser') {
                        controller.useServerPlayer = false;
                        console.log('手动切换到浏览器播放器');
                        return true;
                    }
                }
                return false;
            },
            
            // 获取当前播放器状态
            getStatus: () => {
                if (window.videoSpeedControl && window.videoSpeedControl.controller) {
                    return window.videoSpeedControl.controller.getServerPlayerStatus();
                }
                return null;
            },
            
            // 优化所有视频播放器
            optimizeAll: () => {
                if (window.videoSpeedControl && window.videoSpeedControl.controller) {
                    const controller = window.videoSpeedControl.controller;
                    controller.videoElements.forEach(video => {
                        const playerInfo = controller.detectAndSelectPlayer(video);
                        if (playerInfo.type === 'server') {
                            controller.optimizeServerPlayer(video, playerInfo);
                        }
                    });
                    return true;
                }
                return false;
            }
        },
        
        // 工具函数
        utils: ServerPlayerUtils
    };
}