import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { shared } from './hologram.js';

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: shared.uTime, uGlitch: shared.uGlitch, uEagle: shared.uEagle },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uGlitch,uEagle; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv-0.5; float d = dot(c,c);
      float g = uGlitch * step(0.72, h(vec2(floor(uv.y*28.0), floor(uTime*14.0))));
      uv.x += g * 0.035 * (h(vec2(uTime, uv.y))-0.5) * 2.0;
      float ab = 0.0016 + d*0.014 + uGlitch*0.012;
      vec3 col = vec3(texture2D(tDiffuse, uv + c*ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c*ab).b);
      col *= 0.95 + 0.05*sin(uv.y*1000.0 + uTime*2.0);
      col *= 1.0 - d*1.25;
      col += (h(uv*vec2(1920.0,1080.0) + uTime) - 0.5) * 0.028;
      col = mix(col, col * vec3(1.12,1.0,0.8) + vec3(0.02,0.012,0.0), uEagle*0.5);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(innerWidth, innerHeight);
    shared.uPx.value = this.dpr;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01030a);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(innerWidth, innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 0.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(FinalShader));
    this.composer.addPass(new OutputPass());

    // Rig de cámara orbital con amortiguación
    this.rig = {
      goal: { theta: 0.3, phi: 0.5, radius: 70, tx: 0, ty: 1.5, tz: 0 },
      cur: { theta: 0.3, phi: 0.5, radius: 70, tx: 0, ty: 1.5, tz: 0 },
      parallax: new THREE.Vector2(),
      shake: 0,
    };
    this.tweens = [];
    this.fovGoal = 55;
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tween({ from = 0, to = 1, dur = 1, ease: e = 'inOut', onUpdate, onDone, delay = 0 }) {
    this.tweens.push({ from, to, dur, e: ease[e] || ease.inOut, onUpdate, onDone, t: -delay });
  }

  // Vuelo de cámara ("Salto de Fe")
  flyTo({ theta, phi, radius, target, dur = 1.8, fovKick = 22 }) {
    const g = this.rig.goal, c = this.rig.cur;
    // Camino angular más corto
    if (theta !== undefined) {
      let d = theta - g.theta;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      theta = g.theta + d;
    }
    const s = { theta: g.theta, phi: g.phi, radius: g.radius, tx: g.tx, ty: g.ty, tz: g.tz };
    const e = {
      theta: theta ?? s.theta, phi: phi ?? s.phi, radius: radius ?? s.radius,
      tx: target ? target.x : s.tx, ty: target ? target.y : s.ty, tz: target ? target.z : s.tz,
    };
    this.tween({
      dur, ease: 'inOut',
      onUpdate: (k) => {
        for (const key of Object.keys(s)) g[key] = s[key] + (e[key] - s[key]) * k;
        this.fovGoal = 55 + Math.sin(k * Math.PI) * fovKick;
      },
      onDone: () => { this.fovGoal = 55; },
    });
    shared.uGlitch.value = Math.max(shared.uGlitch.value, 0.5);
  }

  update(dt) {
    // Tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.dur);
      const v = tw.from + (tw.to - tw.from) * tw.e(k);
      tw.onUpdate && tw.onUpdate(tw.e(k), v);
      if (k >= 1) { this.tweens.splice(i, 1); tw.onDone && tw.onDone(); }
    }
    // Amortiguación
    const { goal, cur } = this.rig;
    const a = 1 - Math.exp(-dt * 7);
    for (const key of Object.keys(cur)) cur[key] += (goal[key] - cur[key]) * a;

    const th = cur.theta + this.rig.parallax.x * 0.05;
    const ph = THREE.MathUtils.clamp(cur.phi + this.rig.parallax.y * 0.03, -0.25, 1.4);
    const r = cur.radius;
    this.camera.position.set(
      cur.tx + r * Math.cos(ph) * Math.sin(th),
      cur.ty + r * Math.sin(ph),
      cur.tz + r * Math.cos(ph) * Math.cos(th)
    );
    if (this.rig.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.rig.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.rig.shake;
      this.rig.shake *= Math.exp(-dt * 6);
      if (this.rig.shake < 0.002) this.rig.shake = 0;
    }
    this.camera.lookAt(cur.tx, cur.ty, cur.tz);
    this.camera.fov += (this.fovGoal - this.camera.fov) * (1 - Math.exp(-dt * 8));
    this.camera.updateProjectionMatrix();

    // Glitch decae
    shared.uGlitch.value *= Math.exp(-dt * 4);
    if (shared.uGlitch.value < 0.003) shared.uGlitch.value = 0;
  }

  render() { this.composer.render(); }
}
