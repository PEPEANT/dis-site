const AudioSystem = {
    ctx: null,
    bgmNodes: [],
    isPlayingBGM: false,
    volume: { master: 0.5, bgm: 0.4, sfx: 0.6 },
    nextNoteTime: 0,
    tempo: 100,
    timerID: null,
    scale: [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83],

    lastSFXTime: {}, // [New] Throttling

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.createNoiseBuffer();
            this.mainVolume = this.ctx.createGain();
            this.mainVolume.connect(this.ctx.destination);
            this.updateVolumes();
        } catch (e) { console.error("Web Audio API Error", e); }
    },

    createNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    },

    setVolume(type, val) {
        this.volume[type] = Math.max(0, Math.min(1, val));
        this.updateVolumes();
    },

    updateVolumes() {
        if (this.mainVolume) this.mainVolume.gain.value = this.volume.master;
    },

    // [New] MP3 BGM System
    bgmEl: null,
    currentBgmIndex: 1,

    async playBGM() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.playMP3(this.currentBgmIndex);
    },

    playMP3(index) {
        if (this.bgmEl) {
            this.bgmEl.pause();
            this.bgmEl = null;
        }

        this.currentBgmIndex = index;
        const path = `BGM/BGM_${index}.mp3`;
        console.log("Playing BGM:", path);

        this.bgmEl = new Audio(path);
        this.bgmEl.loop = true;
        this.bgmEl.volume = this.volume.bgm * this.volume.master;

        this.bgmEl.play().catch(e => console.warn("Audio Play Error:", e));
    },

    stopBGM() {
        if (this.bgmEl) {
            this.bgmEl.pause();
            this.bgmEl = null;
        }
    },

    setBGMVolume(val) {
        this.volume.bgm = Math.max(0, Math.min(1, val));
        if (this.bgmEl) this.bgmEl.volume = this.volume.bgm * this.volume.master;
    },

    playTone(time, vol, type, freq, dur) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const masterVol = this.volume.master;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol * this.volume.bgm * masterVol, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
    },

    playSFX(type) {
        if (!this.ctx || this.volume.sfx <= 0) return;

        // [FIX] Sound Spam Protection (Throttle 0.05s)
        const now = this.ctx.currentTime;
        if (this.lastSFXTime[type] && now - this.lastSFXTime[type] < 0.05) {
            return;
        }
        this.lastSFXTime[type] = now;

        const t = this.ctx.currentTime;
        const vol = this.volume.sfx * this.volume.master;

        if (type === 'explode') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, t);
            filter.frequency.exponentialRampToValueAtTime(10, t + 0.8);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 1.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

            const osc = this.ctx.createOscillator();
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.5);
            const oscG = this.ctx.createGain();
            oscG.gain.setValueAtTime(vol, t);
            oscG.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            osc.connect(oscG); oscG.connect(this.ctx.destination);

            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            src.start(t);
            src.stop(t + 0.8);
            osc.start(t); osc.stop(t + 0.5);
        }
        else if (type === 'shoot') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(Math.random() * 100 + 150, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            gain.gain.setValueAtTime(0.15 * vol, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.connect(gain); gain.connect(this.ctx.destination); osc.start(t); osc.stop(t + 0.1);
        }
        else if (type === 'bomb_drop') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
            gain.gain.setValueAtTime(this.volume.sfx * this.volume.master, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.3);
        }
        else if (type === 'ui') {
            this.playTone(t, 0.1, 'sine', 1200, 0.1);
        }
    }
};
