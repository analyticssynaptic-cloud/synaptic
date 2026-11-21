import { RANKS, MAX_XP, XP, SERVICES, CONFIG } from './services.js';

const KEY = 'synaptic.animus.v1';

export class Game {
  constructor() {
    this.visited = new Set();
    this.frags = new Set();
    this.eagleUsed = false;
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s) {
        this.visited = new Set(s.visited || []);
        this.frags = new Set(s.frags || []);
        this.eagleUsed = !!s.eagleUsed;
      }
    } catch (e) { /* sin almacenamiento */ }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ visited: [...this.visited], frags: [...this.frags], eagleUsed: this.eagleUsed }));
    } catch (e) { /* ignorar */ }
  }

  get xp() {
    return this.visited.size * XP.visit + this.frags.size * XP.fragment + (this.eagleUsed ? XP.eagle : 0);
  }
  get pct() { return Math.min(100, Math.round((this.xp / MAX_XP) * 100)); }
  get rankIndex() {
    let r = 0;
    RANKS.forEach((k, i) => { if (this.xp >= k.xp) r = i; });
    return r;
  }
  get rank() { return RANKS[this.rankIndex]; }
  get complete() { return this.visited.size === SERVICES.length && this.frags.size === CONFIG.fragments; }

  // Cada método devuelve true si subió de rango
  _gain(fn) {
    const before = this.rankIndex;
    fn();
    this.save();
    return this.rankIndex > before;
  }
  visit(i) { return this._gain(() => this.visited.add(i)); }
  collect(i) { return this._gain(() => this.frags.add(i)); }
  useEagle() { if (this.eagleUsed) return false; return this._gain(() => { this.eagleUsed = true; }); }
  reset() { this.visited.clear(); this.frags.clear(); this.eagleUsed = false; this.save(); }
}
