// audio.js — fully procedural WebAudio: wind, ambient pad, and SFX. No files needed.

export class AudioSys {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.started = false;
    this.windGain = null;
    this.padGain = null;
    this.speedTarget = 0;
  }

  // Must be called from a user gesture.
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // --- wind: noise -> bandpass -> gain
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();

    // --- ambient pad
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 900;
    this.padGain.connect(padFilter).connect(this.master);
    this.padOscs = [];
    this.padChord = [0, 0, 0];
    this.setChord([220, 277.18, 329.63]);
    this.chordTimer = 0;

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.master);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setChord(freqs) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const o of this.padOscs) { try { o.stop(ctx.currentTime + 2); } catch (e) { /* noop */ } }
    this.padOscs = [];
    freqs.forEach((f, i) => {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 2.5);
        o.connect(g).connect(this.padGain);
        o.start();
        this.padOscs.push(o);
      }
    });
  }

  // Called every frame with current flight state.
  update(dt, { speed = 0, boosting = false, flying = false, menu = false }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const sfxOn = this.settings.sfx;
    const musicOn = this.settings.music;
    const target = sfxOn && flying ? Math.min(1, Math.max(0, (speed - 8) / 80)) : 0;
    const g = this.windGain.gain;
    g.setTargetAtTime(target * 0.55 + (boosting ? 0.15 : 0), ctx.currentTime, 0.1);
    this.windFilter.frequency.setTargetAtTime(250 + speed * 9 + (boosting ? 500 : 0), ctx.currentTime, 0.1);
    this.padGain.gain.setTargetAtTime(musicOn ? (menu ? 0.5 : 0.35) : 0, ctx.currentTime, 0.5);

    this.chordTimer += dt;
    if (this.chordTimer > 14) {
      this.chordTimer = 0;
      const chords = [[220, 277.18, 329.63], [246.94, 293.66, 369.99], [196, 246.94, 293.66], [174.61, 220, 261.63]];
      this.setChord(chords[Math.floor(Math.random() * chords.length)]);
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.3, delay = 0, slide = 0) {
    if (!this.ctx || !this.settings.sfx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, vol = 0.5, freq = 800) {
    if (!this.ctx || !this.settings.sfx) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start();
  }

  ring(combo) {
    const base = 523.25 * Math.pow(2, Math.min(combo, 8) / 12);
    this.tone(base, 0.25, 'triangle', 0.25);
    this.tone(base * 1.5, 0.35, 'sine', 0.2, 0.06);
  }
  gem() { this.tone(1567, 0.12, 'sine', 0.15, 0, 400); }
  gold() { [0, 0.07, 0.14, 0.21].forEach((d, i) => this.tone(880 * Math.pow(2, i / 4), 0.2, 'triangle', 0.18, d)); }
  roll() { this.noise(0.4, 0.35, 1500); this.tone(300, 0.4, 'sawtooth', 0.08, 0, 500); }
  jump() { this.noise(0.5, 0.3, 600); }
  crash() { this.noise(0.9, 0.9, 300); this.tone(80, 0.6, 'sine', 0.5, 0, -50); }
  bounce() { this.noise(0.3, 0.5, 500); this.tone(160, 0.3, 'square', 0.15, 0, 100); }
  boostOn() { this.tone(200, 0.5, 'sawtooth', 0.1, 0, 300); }
  miss() { this.tone(300, 0.25, 'square', 0.08, 0, -100); }
  goal() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.22, i * 0.12)); }
  click() { this.tone(900, 0.06, 'square', 0.06); }
  unlock() { [659.25, 880, 1318.5].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.2, i * 0.08)); }
}
