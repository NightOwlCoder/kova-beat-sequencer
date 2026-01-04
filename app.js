/**
 * Beat Sequencer - Main Application
 * Synthesized drum sounds via Web Audio API
 * 
 * Uses Web Audio look-ahead scheduler for rock-solid timing
 */

(function() {
    'use strict';

    // =========================================
    // Configuration
    // =========================================
    const CONFIG = {
        steps: 16,
        rows: 6,
        defaultBpm: 120,
        minBpm: 60,
        maxBpm: 180,
        storageKey: 'beatSequencer_pattern',
        // Scheduler config for look-ahead pattern
        scheduleAheadTime: 0.1,  // How far ahead to schedule (seconds)
        lookaheadInterval: 25    // How often to call scheduler (ms)
    };

    const SOUNDS = ['kick', 'snare', 'hihat', 'tom', 'clap', 'rim'];

    // =========================================
    // State
    // =========================================
    let audioCtx = null;
    let analyser = null;
    let masterGain = null;
    let pattern = createEmptyPattern();
    let currentStep = 0;
    let isPlaying = false;
    let schedulerTimerId = null;
    let bpm = CONFIG.defaultBpm;
    
    // Look-ahead scheduler state
    let nextStepTime = 0;  // When the next step should play (in audioCtx time)
    let lastScheduledStep = -1;  // Track which step was last scheduled for UI
    
    // Pre-allocated buffers (FIX: avoid per-frame allocation)
    let waveformDataArray = null;
    
    // Pre-generated noise buffers (FIX: avoid per-hit allocation)
    let noiseBuffers = {
        short: null,   // 0.03s for clap bursts
        medium: null,  // 0.1s for hihat
        long: null     // 0.2s for snare/clap tail
    };

    // =========================================
    // DOM Elements
    // =========================================
    const elements = {};

    function cacheElements() {
        elements.grid = document.getElementById('grid');
        elements.stepIndicators = document.getElementById('step-indicators');
        elements.playBtn = document.getElementById('play-btn');
        elements.clearBtn = document.getElementById('clear-btn');
        elements.randomBtn = document.getElementById('random-btn');
        elements.saveBtn = document.getElementById('save-btn');
        elements.loadBtn = document.getElementById('load-btn');
        elements.bpmSlider = document.getElementById('bpm-slider');
        elements.bpmValue = document.getElementById('bpm-value');
        elements.waveform = document.getElementById('waveform');
        elements.overlay = document.getElementById('start-overlay');
    }

    // =========================================
    // Pattern Management
    // =========================================
    function createEmptyPattern() {
        return Array.from({ length: CONFIG.rows }, () => 
            Array(CONFIG.steps).fill(false)
        );
    }

    function toggleCell(row, step) {
        pattern[row][step] = !pattern[row][step];
        updateCellDisplay(row, step);
    }

    function clearPattern() {
        pattern = createEmptyPattern();
        updateGridDisplay();
        showToast('Pattern cleared');
    }

    function randomizePattern() {
        pattern = Array.from({ length: CONFIG.rows }, (_, rowIdx) => 
            Array.from({ length: CONFIG.steps }, (_, stepIdx) => {
                // Different densities per instrument for musical results
                const densities = [0.25, 0.2, 0.4, 0.15, 0.1, 0.15];
                // Prefer on-beats for kick/snare
                const onBeat = stepIdx % 4 === 0;
                const offBeat = stepIdx % 4 === 2;
                let chance = densities[rowIdx];
                if (rowIdx === 0 && onBeat) chance = 0.7;  // Kick on beats
                if (rowIdx === 1 && offBeat) chance = 0.5; // Snare on off-beats
                return Math.random() < chance;
            })
        );
        updateGridDisplay();
        showToast('Random pattern generated');
    }

    // =========================================
    // Audio Engine
    // =========================================
    function initAudio() {
        if (audioCtx) return;
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Master gain
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.7;
        
        // Analyser for visualization
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        masterGain.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        // Pre-allocate waveform data array (FIX: memory allocation)
        waveformDataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Pre-generate noise buffers (FIX: noise buffer per hit)
        generateNoiseBuffers();
        
        // Start visualization loop
        requestAnimationFrame(drawWaveform);
    }
    
    /**
     * Pre-generate noise buffers at different durations.
     * These are reused for all noise-based sounds.
     */
    function generateNoiseBuffers() {
        noiseBuffers.short = createNoiseBuffer(0.05);   // Clap bursts, rim
        noiseBuffers.medium = createNoiseBuffer(0.15);  // Hi-hat
        noiseBuffers.long = createNoiseBuffer(0.3);     // Snare, clap tail
    }

    function playSoundAtTime(soundName, time) {
        if (!audioCtx) return;
        
        switch(soundName) {
            case 'kick':
                playKick(time);
                break;
            case 'snare':
                playSnare(time);
                break;
            case 'hihat':
                playHihat(time);
                break;
            case 'tom':
                playTom(time);
                break;
            case 'clap':
                playClap(time);
                break;
            case 'rim':
                playRim(time);
                break;
        }
    }
    
    // Convenience for immediate playback (previews)
    function playSound(soundName) {
        if (!audioCtx) return;
        playSoundAtTime(soundName, audioCtx.currentTime);
    }

    function playKick(time) {
        // Oscillator for the body
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
        
        oscGain.gain.setValueAtTime(1, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.3);
        
        // Click transient
        const click = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        
        click.type = 'sine';
        click.frequency.setValueAtTime(1000, time);
        click.frequency.exponentialRampToValueAtTime(100, time + 0.02);
        
        clickGain.gain.setValueAtTime(0.5, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        
        click.connect(clickGain);
        clickGain.connect(masterGain);
        
        click.start(time);
        click.stop(time + 0.02);
    }

    function playSnare(time) {
        // Noise burst for the snap (using pre-generated buffer)
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffers.long;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        noiseSource.start(time);
        noiseSource.stop(time + 0.2);
        
        // Body tone
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
        
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.15);
    }

    function playHihat(time) {
        // High-frequency noise (using pre-generated buffer)
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffers.medium;
        
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 7000;
        
        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 10000;
        bandpass.Q.value = 1;
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.4, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        
        noiseSource.connect(highpass);
        highpass.connect(bandpass);
        bandpass.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        noiseSource.start(time);
        noiseSource.stop(time + 0.1);
    }

    function playTom(time) {
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.2);
        
        oscGain.gain.setValueAtTime(0.7, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.25);
    }

    function playClap(time) {
        // Multiple noise bursts for realistic clap (using pre-generated buffer)
        for (let i = 0; i < 3; i++) {
            const noiseSource = audioCtx.createBufferSource();
            noiseSource.buffer = noiseBuffers.short;
            
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2500;
            filter.Q.value = 3;
            
            const noiseGain = audioCtx.createGain();
            const startTime = time + (i * 0.01);
            noiseGain.gain.setValueAtTime(0.6, startTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02);
            
            noiseSource.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(masterGain);
            
            noiseSource.start(startTime);
            noiseSource.stop(startTime + 0.03);
        }
        
        // Tail (using pre-generated buffer)
        const tailSource = audioCtx.createBufferSource();
        tailSource.buffer = noiseBuffers.long;
        
        const tailFilter = audioCtx.createBiquadFilter();
        tailFilter.type = 'bandpass';
        tailFilter.frequency.value = 2500;
        tailFilter.Q.value = 2;
        
        const tailGain = audioCtx.createGain();
        tailGain.gain.setValueAtTime(0.4, time + 0.03);
        tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        tailSource.connect(tailFilter);
        tailFilter.connect(tailGain);
        tailGain.connect(masterGain);
        
        tailSource.start(time + 0.03);
        tailSource.stop(time + 0.18);
    }

    function playRim(time) {
        // Sharp high click
        const osc = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = 800;
        
        osc2.type = 'square';
        osc2.frequency.value = 1200;
        
        const osc2Gain = audioCtx.createGain();
        osc2Gain.gain.value = 0.3;
        
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        
        osc.connect(gain);
        osc2.connect(osc2Gain);
        osc2Gain.connect(gain);
        gain.connect(masterGain);
        
        osc.start(time);
        osc.stop(time + 0.03);
        osc2.start(time);
        osc2.stop(time + 0.03);
    }

    function createNoiseBuffer(duration) {
        const sampleRate = audioCtx.sampleRate;
        const length = sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        return buffer;
    }

    // =========================================
    // Sequencer (Look-ahead Scheduler Pattern)
    // =========================================
    
    /**
     * Calculate the duration of one step (16th note) in seconds
     */
    function getStepDuration() {
        return 60.0 / bpm / 4;  // 16th notes
    }
    
    /**
     * Start the sequencer using Web Audio look-ahead scheduling.
     * This provides sample-accurate timing regardless of JavaScript timing jitter.
     */
    function startSequencer() {
        if (isPlaying) return;
        
        isPlaying = true;
        elements.playBtn.classList.add('playing');
        elements.playBtn.querySelector('.btn-text').textContent = 'Stop';
        
        // Initialize timing - start slightly in the future
        currentStep = 0;
        nextStepTime = audioCtx.currentTime + 0.05;
        lastScheduledStep = -1;
        
        // Start the scheduler loop
        scheduler();
    }

    function stopSequencer() {
        if (!isPlaying) return;
        
        isPlaying = false;
        elements.playBtn.classList.remove('playing');
        elements.playBtn.querySelector('.btn-text').textContent = 'Play';
        
        if (schedulerTimerId) {
            clearTimeout(schedulerTimerId);
            schedulerTimerId = null;
        }
        
        // Clear step highlight
        clearStepHighlight();
        currentStep = 0;
    }

    function togglePlayback() {
        if (isPlaying) {
            stopSequencer();
        } else {
            startSequencer();
        }
    }

    /**
     * The look-ahead scheduler.
     * 
     * This runs frequently (every ~25ms) but schedules audio events
     * using audioCtx.currentTime, which is rock-solid.
     * 
     * The key insight: setTimeout is ONLY used to wake up the scheduler.
     * Actual timing comes from Web Audio's clock.
     */
    function scheduler() {
        if (!isPlaying) return;
        
        // Schedule all steps that fall within our look-ahead window
        while (nextStepTime < audioCtx.currentTime + CONFIG.scheduleAheadTime) {
            // Schedule this step's sounds
            scheduleStep(currentStep, nextStepTime);
            
            // Schedule UI update (approximate, visual only)
            scheduleStepUI(currentStep, nextStepTime);
            
            // Advance to next step
            nextStepTime += getStepDuration();
            currentStep = (currentStep + 1) % CONFIG.steps;
        }
        
        // Wake up again soon to check if more scheduling is needed
        schedulerTimerId = setTimeout(scheduler, CONFIG.lookaheadInterval);
    }
    
    /**
     * Schedule audio for a specific step at a specific time
     */
    function scheduleStep(step, time) {
        for (let row = 0; row < CONFIG.rows; row++) {
            if (pattern[row][step]) {
                playSoundAtTime(SOUNDS[row], time);
            }
        }
    }
    
    /**
     * Schedule UI highlight update.
     * Uses setTimeout for visual sync (doesn't need to be sample-accurate)
     */
    function scheduleStepUI(step, time) {
        const delay = Math.max(0, (time - audioCtx.currentTime) * 1000);
        setTimeout(() => {
            if (isPlaying) {
                updateStepHighlight(step);
            }
        }, delay);
    }

    function setBpm(newBpm) {
        bpm = Math.max(CONFIG.minBpm, Math.min(CONFIG.maxBpm, newBpm));
        elements.bpmValue.textContent = bpm;
        // BPM changes take effect immediately via getStepDuration()
    }

    // =========================================
    // UI Rendering
    // =========================================
    function buildGrid() {
        elements.grid.innerHTML = '';
        
        for (let row = 0; row < CONFIG.rows; row++) {
            for (let step = 0; step < CONFIG.steps; step++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.step = step;
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `${SOUNDS[row]} step ${step + 1}`);
                cell.setAttribute('tabindex', '0');
                
                elements.grid.appendChild(cell);
            }
        }
    }

    function buildStepIndicators() {
        elements.stepIndicators.innerHTML = '';
        
        for (let i = 0; i < CONFIG.steps; i++) {
            const indicator = document.createElement('span');
            indicator.className = 'step-indicator';
            indicator.textContent = i + 1;
            indicator.dataset.step = i;
            elements.stepIndicators.appendChild(indicator);
        }
    }

    function updateGridDisplay() {
        const cells = elements.grid.querySelectorAll('.cell');
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const step = parseInt(cell.dataset.step);
            cell.classList.toggle('active', pattern[row][step]);
            cell.setAttribute('aria-pressed', pattern[row][step]);
        });
    }

    function updateCellDisplay(row, step) {
        const cell = elements.grid.querySelector(
            `.cell[data-row="${row}"][data-step="${step}"]`
        );
        if (cell) {
            cell.classList.toggle('active', pattern[row][step]);
            cell.setAttribute('aria-pressed', pattern[row][step]);
        }
    }

    function updateStepHighlight(step) {
        // Clear previous highlights
        clearStepHighlight();
        
        // Highlight current column
        const cells = elements.grid.querySelectorAll(`.cell[data-step="${step}"]`);
        cells.forEach(cell => cell.classList.add('current-step'));
        
        // Update step indicator
        const indicators = elements.stepIndicators.querySelectorAll('.step-indicator');
        indicators.forEach((ind, i) => {
            ind.classList.toggle('current', i === step);
        });
    }

    function clearStepHighlight() {
        elements.grid.querySelectorAll('.cell.current-step').forEach(cell => {
            cell.classList.remove('current-step');
        });
        elements.stepIndicators.querySelectorAll('.step-indicator.current').forEach(ind => {
            ind.classList.remove('current');
        });
    }

    // =========================================
    // Waveform Visualization
    // =========================================
    function drawWaveform() {
        if (!analyser || !elements.waveform || !waveformDataArray) {
            requestAnimationFrame(drawWaveform);
            return;
        }
        
        const canvas = elements.waveform;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Get waveform data (reusing pre-allocated array)
        analyser.getByteTimeDomainData(waveformDataArray);
        
        // Clear canvas
        ctx.fillStyle = '#0d0d0f';
        ctx.fillRect(0, 0, width, height);
        
        // Draw waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#bf5af2';
        ctx.shadowColor = '#bf5af2';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        
        const bufferLength = waveformDataArray.length;
        const sliceWidth = width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = waveformDataArray[i] / 128.0;
            const y = (v * height) / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        // Draw center line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(191, 90, 242, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        requestAnimationFrame(drawWaveform);
    }

    // =========================================
    // Storage
    // =========================================
    function savePattern() {
        try {
            const data = {
                pattern: pattern,
                bpm: bpm,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
            showToast('Pattern saved');
        } catch (e) {
            showToast('Could not save pattern');
            console.error('Save error:', e);
        }
    }

    function loadPattern() {
        try {
            const data = localStorage.getItem(CONFIG.storageKey);
            if (!data) {
                showToast('No saved pattern found');
                return;
            }
            
            const parsed = JSON.parse(data);
            
            // Validate pattern structure
            if (Array.isArray(parsed.pattern) && 
                parsed.pattern.length === CONFIG.rows &&
                parsed.pattern[0].length === CONFIG.steps) {
                pattern = parsed.pattern;
                updateGridDisplay();
                
                if (parsed.bpm) {
                    setBpm(parsed.bpm);
                    elements.bpmSlider.value = bpm;
                }
                
                showToast('Pattern loaded');
            } else {
                showToast('Invalid saved pattern');
            }
        } catch (e) {
            showToast('Could not load pattern');
            console.error('Load error:', e);
        }
    }

    // =========================================
    // Toast Notifications
    // =========================================
    function showToast(message) {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) {
            existing.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // =========================================
    // Event Handlers
    // =========================================
    function handleGridClick(e) {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        
        const row = parseInt(cell.dataset.row);
        const step = parseInt(cell.dataset.step);
        
        toggleCell(row, step);
        
        // Play sound preview
        playSound(SOUNDS[row]);
    }

    function handleGridKeydown(e) {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const row = parseInt(cell.dataset.row);
            const step = parseInt(cell.dataset.step);
            toggleCell(row, step);
            playSound(SOUNDS[row]);
        }
    }

    function handleOverlayClick() {
        initAudio();
        elements.overlay.classList.add('hidden');
        
        // Resume audio context if suspended (for mobile)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function setupEventListeners() {
        // Overlay
        elements.overlay.addEventListener('click', handleOverlayClick);
        elements.overlay.addEventListener('touchend', handleOverlayClick);
        
        // Grid - use event delegation
        elements.grid.addEventListener('click', handleGridClick);
        elements.grid.addEventListener('keydown', handleGridKeydown);
        
        // Touch support for grid
        elements.grid.addEventListener('touchend', (e) => {
            e.preventDefault(); // Prevent double-firing with click
            handleGridClick(e);
        });
        
        // Transport
        elements.playBtn.addEventListener('click', () => {
            initAudio();
            togglePlayback();
        });
        
        // BPM slider
        elements.bpmSlider.addEventListener('input', (e) => {
            setBpm(parseInt(e.target.value));
        });
        
        // Pattern controls
        elements.clearBtn.addEventListener('click', clearPattern);
        elements.randomBtn.addEventListener('click', randomizePattern);
        
        // Storage controls
        elements.saveBtn.addEventListener('click', savePattern);
        elements.loadBtn.addEventListener('click', loadPattern);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    initAudio();
                    togglePlayback();
                    break;
                case 'KeyC':
                    if (!e.metaKey && !e.ctrlKey) clearPattern();
                    break;
                case 'KeyR':
                    if (!e.metaKey && !e.ctrlKey) randomizePattern();
                    break;
                case 'KeyS':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        savePattern();
                    }
                    break;
            }
        });
        
        // Handle visibility change (pause when tab hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && isPlaying) {
                stopSequencer();
            }
        });
        
        // Handle window resize for canvas
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        const canvas = elements.waveform;
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Only resize if significantly different
        if (Math.abs(canvas.width - rect.width) > 10) {
            canvas.width = rect.width - 32; // Account for padding
        }
    }

    // =========================================
    // Initialize
    // =========================================
    function init() {
        cacheElements();
        buildGrid();
        buildStepIndicators();
        setupEventListeners();
        resizeCanvas();
        
        // Check for saved pattern on load
        const savedData = localStorage.getItem(CONFIG.storageKey);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.pattern) {
                    pattern = parsed.pattern;
                    updateGridDisplay();
                }
                if (parsed.bpm) {
                    bpm = parsed.bpm;
                    elements.bpmSlider.value = bpm;
                    elements.bpmValue.textContent = bpm;
                }
            } catch (e) {
                console.error('Failed to restore pattern:', e);
            }
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
