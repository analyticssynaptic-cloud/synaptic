// Audio procedural moderno (WebAudio): pad ambiental suave, clics de cristal y barridos de aire
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.master = null; this.cyberOff = false; }

  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const c = (this.ctx = new C());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(c.destination);
    // Reverb sintética (cola de ruido con decaimiento)
    const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    this.verbG = c.createGain(); this.verbG.gain.value = 0.55;
    this.verb.connect(this.verbG); this.verbG.connect(this.master);
    this._pad();
    this._air();
  }

  _pad() {
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.055, c.currentTime + 5);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
    lp.connect(out); out.connect(this.master); out.connect(this.verb);
    // Acorde maj9 abierto: re-mi-la-si
    [73.4, 110, 164.8, 220, 329.6].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 2) * 4;
      const g = c.createGain(); g.gain.value = i < 2 ? 0.5 : 0.28;
      o.connect(g); g.connect(lp); o.start();
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  }

  // Aire suave ligado al desplazamiento
  _air() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    this.whirF = c.createBiquadFilter(); this.whirF.type = 'lowpass'; this.whirF.frequency.value = 500; this.whirF.Q.value = 0.5;
    this.whirG = c.createGain(); this.whirG.gain.value = 0;
    src.connect(this.whirF); this.whirF.connect(this.whirG); this.whirG.connect(this.master); this.whirG.connect(this.verb); src.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setWhir(v) {
    if (!this.whirG || this.muted) return;
    const t = this.ctx.currentTime;
    this.whirG.gain.setTargetAtTime(Math.min(v * 0.06, 0.05), t, 0.1);
    this.whirF.frequency.setTargetAtTime(400 + v * 2400, t, 0.1);
  }

  _tone({ f = 880, f2, dur = 0.2, type = 'sine', vol = 0.1, delay = 0, rev = 0.5, attack = 0.008 }) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    if (rev > 0) { const s = c.createGain(); s.gain.value = rev; g.connect(s); s.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  _swoosh({ dur = 0.7, from = 300, to = 2600, vol = 0.07, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.verb); s.start(t);
  }

  // Pluck de cristal: pentatónica suave
  _pluck(f, vol = 0.07, delay = 0) {
    this._tone({ f, dur: 0.5, type: 'sine', vol, delay, rev: 0.8, attack: 0.004 });
    this._tone({ f: f * 2.01, dur: 0.25, type: 'sine', vol: vol * 0.35, delay, rev: 0.6, attack: 0.004 });
  }

  hover() { this._pluck(1568, 0.035); }
  hoverTri() {
    const n = [659, 784, 988, 1175, 1319][(Math.random() * 5) | 0];
    this._pluck(n, 0.06);
    this._swoosh({ dur: 0.35, from: 2000, to: 6000, vol: 0.025 });
  }
  click() { this._tone({ f: 240, f2: 120, dur: 0.14, type: 'sine', vol: 0.16, rev: 0.25 }); this._pluck(1175, 0.05, 0.02); }
  open() { this._swoosh({ dur: 0.8, from: 250, to: 3200, vol: 0.09 }); this._pluck(880, 0.05, 0.3); this._pluck(1319, 0.04, 0.4); }
  close() { this._swoosh({ dur: 0.5, from: 3000, to: 250, vol: 0.06 }); }
  lock() { this._pluck(988, 0.06); this._pluck(1480, 0.045, 0.09); }
  collect() { [880, 1175, 1568, 1976].forEach((f, i) => this._pluck(f, 0.06, i * 0.07)); }
  eagle(on) { this._swoosh({ dur: 1.0, from: on ? 200 : 3500, to: on ? 3500 : 200, vol: 0.09 }); this._tone({ f: on ? 196 : 392, f2: on ? 392 : 196, dur: 0.7, vol: 0.07 }); }
  boot() { [523, 784, 1175].forEach((f, i) => this._pluck(f, 0.06, i * 0.1)); this._swoosh({ dur: 1.4, from: 200, to: 2800, vol: 0.08 }); }
  rank() { [659, 784, 988, 1319, 1760].forEach((f, i) => this._pluck(f, 0.07, i * 0.1)); }
}
