// Audio procedural con WebAudio (sin archivos externos)
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.master = null; }

  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this._drone();
  }

  _drone() {
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0.0; out.connect(this.master);
    out.gain.linearRampToValueAtTime(0.09, c.currentTime + 4);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6; lp.connect(out);
    [55, 55.4, 82.4, 110.3].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = i < 2 ? 0.5 : 0.22;
      o.connect(g); g.connect(lp); o.start();
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this.droneFilter = lp;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  _tone({ f = 880, f2, dur = 0.12, type = 'sine', vol = 0.15, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.6, from = 300, to = 4000, vol = 0.12 }) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t);
  }

  hover() { this._tone({ f: 1200, f2: 1800, dur: 0.07, type: 'sine', vol: 0.06 }); }
  click() { this._tone({ f: 300, f2: 900, dur: 0.18, type: 'square', vol: 0.07 }); }
  open() { this._noise({ dur: 0.9, from: 200, to: 5000, vol: 0.16 }); this._tone({ f: 110, f2: 440, dur: 0.8, type: 'sawtooth', vol: 0.08 }); }
  close() { this._noise({ dur: 0.5, from: 4000, to: 300, vol: 0.1 }); }
  collect() { [660, 880, 1320, 1760].forEach((f, i) => this._tone({ f, dur: 0.22, type: 'triangle', vol: 0.11, delay: i * 0.07 })); }
  eagle(on) { this._noise({ dur: 1.1, from: on ? 200 : 3000, to: on ? 3500 : 200, vol: 0.14 }); this._tone({ f: on ? 220 : 880, f2: on ? 880 : 220, dur: 0.6, type: 'sine', vol: 0.09 }); }
  boot() { [440, 660, 880].forEach((f, i) => this._tone({ f, dur: 0.15, type: 'square', vol: 0.05, delay: i * 0.09 })); }
  rank() { [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone({ f, dur: 0.35, type: 'triangle', vol: 0.12, delay: i * 0.1 })); }
}
