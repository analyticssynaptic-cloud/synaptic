import * as THREE from 'three';
import { SERVICES, CONFIG } from './services.js';
import { buildModel } from './models.js';
import { shared, holoMesh, holoLine, holoPoints, addSeeds, setHover, mulberry } from './hologram.js';

export const RING_R = 14;

const COLOR = { cyan: '#00e5ff', gold: '#ffc83d', white: '#9fdfff' };

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.nodes = [];
    this.fragments = [];
    this.bursts = [];
    this.hitMeshes = [];
    this.pulseTime = 0;
    this._buildSky();
    this._buildFloor();
    this._buildRain();
    this._buildCore();
    this._buildNodes();
    this._buildFragments();
    this._buildStars();
  }

  // ---------- Cúpula y partículas ambientales ----------
  _buildSky() {
    const geo = new THREE.IcosahedronGeometry(90, 3);
    this.sky = new THREE.Mesh(geo, holoMesh('#0a4a66', { alpha: 0.35, wireframe: true }));
    this.root.add(this.sky);
    this.sky2 = new THREE.Mesh(new THREE.IcosahedronGeometry(70, 2), holoMesh('#3a1a7a', { alpha: 0.25, wireframe: true }));
    this.root.add(this.sky2);
    // Anillos orbitales lejanos
    this.farRings = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(40 + i * 8, 0.05, 6, 220), holoMesh(i % 2 ? '#00e5ff' : '#7c5cff', { alpha: 0.5 }));
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.root.add(r); this.farRings.push(r);
    }
  }

  _buildStars() {
    const rnd = mulberry(99);
    const N = 2600, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), r = 20 + rnd() * 60;
      p[i * 3] = r * Math.sin(v) * Math.cos(u); p[i * 3 + 1] = r * Math.cos(v) * 0.7; p[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); addSeeds(g, rnd);
    this.stars = new THREE.Points(g, holoPoints('#9fdfff', { size: 0.9, alpha: 0.9 }));
    this.root.add(this.stars);
  }

  // ---------- Suelo con rejilla y ondas de pulso ----------
  _buildFloor() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uTime: shared.uTime, uEagle: shared.uEagle, uReveal: shared.uReveal,
        uPulse: { value: 0 }, uColor: { value: new THREE.Color('#00e5ff') },
      },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform float uTime,uEagle,uReveal,uPulse; uniform vec3 uColor; varying vec3 vW;
        float grid(vec2 p,float s,float w){ vec2 g=abs(fract(p/s-0.5)-0.5)/fwidth(p/s); return 1.0-min(min(g.x,g.y)/w,1.0); }
        void main(){
          float d = length(vW.xz);
          float g1 = grid(vW.xz, 2.0, 1.0);
          float g2 = grid(vW.xz, 10.0, 1.6) * 0.8;
          float ring = smoothstep(0.7,1.0,sin(d*0.6 - uTime*1.6));
          float pulse = smoothstep(3.0,0.0,abs(d - uPulse)) * step(uPulse, 60.0);
          float fade = smoothstep(70.0, 6.0, d);
          vec3 base = mix(uColor, vec3(1.0,0.72,0.16), uEagle);
          vec3 col = base * (g1*0.35 + g2*0.9 + ring*0.12*(1.0-g1) + pulse*1.4);
          float a = (g1*0.4 + g2*0.7 + ring*0.1 + pulse) * fade * uReveal;
          gl_FragColor = vec4(col, clamp(a,0.0,1.0));
        }`,
      extensions: { derivatives: true },
    });
    this.floorMat = mat;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -4;
    this.root.add(this.floor);
  }

  // ---------- Lluvia de datos ----------
  _buildRain() {
    const rnd = mulberry(5);
    const COLS = 520, TRAIL = 9, N = COLS * TRAIL;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N), trail = new Float32Array(N), speed = new Float32Array(N);
    for (let c = 0; c < COLS; c++) {
      const a = rnd() * Math.PI * 2, r = 16 + rnd() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 6 + rnd() * 12, off = rnd();
      for (let t = 0; t < TRAIL; t++) {
        const i = c * TRAIL + t;
        pos[i * 3] = x; pos[i * 3 + 1] = off; pos[i * 3 + 2] = z;
        seed[i] = off; trail[i] = t / TRAIL; speed[i] = s;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aTrail', new THREE.BufferAttribute(trail, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uEagle: shared.uEagle, uReveal: shared.uReveal, uPx: shared.uPx, uColor: { value: new THREE.Color('#00e5ff') } },
      vertexShader: `
        uniform float uTime,uPx; attribute float aSeed,aTrail,aSpeed; varying float vA;
        void main(){
          float h = 46.0;
          float y = mod(aSeed*h - uTime*aSpeed + aTrail*3.0, h) - 6.0;
          vec4 mv = modelViewMatrix*vec4(position.x,y,position.z,1.0);
          vA = (1.0-aTrail) * smoothstep(40.0,30.0,y+6.0) * smoothstep(-6.0,-3.0,y);
          gl_PointSize = (1.0 + (1.0-aTrail)*1.2) * uPx * (46.0 / -mv.z);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uEagle,uReveal; varying float vA;
        void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard;
          vec3 col = mix(uColor, vec3(1.0,0.72,0.16), uEagle*0.8);
          gl_FragColor = vec4(col*1.4, vA*smoothstep(0.5,0.0,d)*0.5*uReveal*(1.0-uEagle*0.6)); }`,
    });
    this.rain = new THREE.Points(g, m);
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
  }

  // ---------- Núcleo central (la IA de Synaptic) ----------
  _buildCore() {
    const core = new THREE.Group();
    this.core = core;
    this.root.add(core);
    core.position.y = 1.5;
    const rnd = mulberry(1234);
    const N = 760, pts = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      const rr = 2.3 + (rnd() - 0.5) * 0.25;
      pts.push(new THREE.Vector3(Math.cos(th) * rad * rr, y * rr, Math.sin(th) * rad * rr));
    }
    const v = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (pts[i].distanceTo(pts[j]) < 0.55) v.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.coreNet = new THREE.LineSegments(lg, holoLine('#00e5ff', { alpha: 0.28 }));
    const pg = addSeeds(new THREE.BufferGeometry().setFromPoints(pts), rnd);
    this.corePts = new THREE.Points(pg, holoPoints('#7ff4ff', { size: 0.9 }));
    core.add(this.coreNet, this.corePts);

    this.coreInner = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 2), holoMesh('#00e5ff', { alpha: 0.9, wireframe: true }));
    this.coreSolid = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 3), holoMesh('#00a8ff', { alpha: 0.3 }));
    this.coreShell = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0, 1), holoMesh('#7c5cff', { alpha: 0.5, wireframe: true }));
    core.add(this.coreInner, this.coreSolid, this.coreShell);

    this.coreRings = [];
    [3.6, 4.2, 4.9].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02 + i * 0.006, 8, 180), holoMesh(i === 1 ? '#7c5cff' : '#00e5ff', { alpha: 0.9 }));
      ring.rotation.set(i * 0.9, i * 0.5, 0);
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), holoMesh('#ffffff', { alpha: 1 }));
      ring.add(bead); bead.userData = { r, k: i };
      core.add(ring); this.coreRings.push(ring);
    });

    // Haz vertical
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: shared.uTime, uReveal: shared.uReveal, uEagle: shared.uEagle },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime,uReveal,uEagle; varying vec2 vUv; varying vec3 vW;
        void main(){ float h = smoothstep(0.0,0.15,vUv.y)*smoothstep(1.0,0.5,vUv.y);
          float s = 0.6+0.4*sin(vW.y*8.0 - uTime*5.0);
          vec3 col = mix(vec3(0.0,0.9,1.0), vec3(1.0,0.72,0.16), uEagle);
          gl_FragColor = vec4(col*1.3, h*s*0.22*uReveal); }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 70, 32, 1, true), beamMat);
    beam.position.y = 28;
    this.root.add(beam);

    // Pilar base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 0.3, 48, 1, true), holoMesh('#00e5ff', { alpha: 0.6 }));
    base.position.y = -3.9; this.root.add(base);
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.05, 8, 100), holoMesh('#00e5ff', { alpha: 1 }));
    baseRing.rotation.x = Math.PI / 2; baseRing.position.y = -3.75; this.root.add(baseRing);

    // Hitbox
    const hit = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData = { type: 'core' };
    core.add(hit);
    this.hitMeshes.push(hit);
  }

  // ---------- Nodos de servicio ----------
  _buildNodes() {
    SERVICES.forEach((s, i) => {
      const a = (i / SERVICES.length) * Math.PI * 2;
      const y = 0.5 + (i % 2 ? 1.4 : -0.3);
      const group = new THREE.Group();
      group.position.set(Math.sin(a) * RING_R, y, Math.cos(a) * RING_R);

      const model = buildModel(s.id, s.color);
      model.scale.setScalar(1.05);
      group.add(model);

      // Plataforma holográfica
      const plat = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + k * 0.45, 0.02, 6, 80), holoMesh(s.color, { alpha: 0.9 - k * 0.2 }));
        r.rotation.x = Math.PI / 2; plat.add(r);
      }
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), holoMesh(s.color, { alpha: 0.22 }));
      disc.rotation.x = -Math.PI / 2; plat.add(disc);
      plat.position.y = -2.2;
      group.add(plat);

      // Haz al suelo
      const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -2.2, 0), new THREE.Vector3(0, -4 - y, 0)]), holoLine(s.color, { alpha: 0.6 }));
      group.add(beam);

      // Conexión al núcleo
      const link = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-Math.sin(a) * (RING_R - 4.3), 1.5 - y, -Math.cos(a) * (RING_R - 4.3))]),
        holoLine(s.color, { alpha: 0.4 })
      );
      group.add(link);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(2.3, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { type: 'node', index: i };
      group.add(hit);
      this.hitMeshes.push(hit);

      this.root.add(group);
      this.nodes.push({ group, model, plat, angle: a, baseY: y, hit, hover: 0, targetHover: 0, service: s, platRings: plat.children });
    });
  }

  // ---------- Fragmentos coleccionables (Visión de Águila) ----------
  _buildFragments() {
    const rnd = mulberry(2026);
    const placed = [];
    const nodePos = this.nodes.map((n) => n.group.position);
    while (placed.length < CONFIG.fragments) {
      const a = rnd() * Math.PI * 2, r = 6 + rnd() * 20, y = -2 + rnd() * 9;
      const p = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
      if (p.distanceTo(new THREE.Vector3(0, 1.5, 0)) < 5.2) continue;
      if (nodePos.some((n) => n.distanceTo(p) < 3.6)) continue;
      if (placed.some((q) => q.distanceTo(p) < 4)) continue;
      placed.push(p);
    }
    placed.forEach((p, i) => {
      const g = new THREE.Group();
      g.position.copy(p);
      const octa = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), holoMesh('#ffc83d', { alpha: 0.95, wireframe: true, target: 1 }));
      const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), holoMesh('#ffd77a', { alpha: 1, target: 1 }));
      const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -(p.y + 4), 0), new THREE.Vector3(0, 9, 0)]);
      const beam = new THREE.Line(beamGeo, holoLine('#ffc83d', { alpha: 0.7, target: 1 }));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.012, 6, 48), holoMesh('#ffc83d', { alpha: 1, target: 1 }));
      g.add(octa, inner, beam, halo);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { type: 'fragment', index: i };
      g.add(hit);
      this.root.add(g);
      this.fragments.push({ group: g, octa, inner, halo, hit, collected: false, phase: i * 1.7, base: p.clone() });
    });
  }

  fragmentHits() {
    return this.fragments.filter((f) => !f.collected).map((f) => f.hit);
  }

  collectFragment(i) {
    const f = this.fragments[i];
    if (!f || f.collected) return null;
    f.collected = true;
    f.group.visible = false;
    this.burst(f.group.position, '#ffc83d', 70, 5);
    return f.group.position.clone();
  }

  restoreFragments(indices) {
    indices.forEach((i) => {
      const f = this.fragments[i];
      if (f) { f.collected = true; f.group.visible = false; }
    });
  }

  // ---------- Ráfaga de partículas ----------
  burst(pos, color, n = 60, speed = 4) {
    const p = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      vel.push(d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); addSeeds(g);
    const pts = new THREE.Points(g, holoPoints(color, { size: 3 }));
    pts.frustumCulled = false;
    this.root.add(pts);
    this.bursts.push({ pts, p, vel, life: 0 });
  }

  pulse() { this.pulseTime = 0.0001; }

  setNodeHover(index) {
    this.nodes.forEach((n, i) => (n.targetHover = i === index ? 1 : 0));
  }

  update(t, dt, eagle) {
    // Sky
    this.sky.rotation.y = t * 0.01; this.sky2.rotation.y = -t * 0.015; this.sky2.rotation.x = t * 0.01;
    this.farRings.forEach((r, i) => { r.rotation.z += dt * 0.03 * (i + 1) * (i % 2 ? -1 : 1); });
    this.stars.rotation.y = t * 0.004;

    // Pulso del suelo cada 5 s
    if (this.pulseTime === 0 && t % 6 < dt) this.pulseTime = 0.0001;
    if (this.pulseTime > 0) { this.pulseTime += dt * 14; if (this.pulseTime > 70) this.pulseTime = 0; }
    this.floorMat.uniforms.uPulse.value = this.pulseTime || 999;

    // Core
    const cp = 1 + Math.sin(t * 2.2) * 0.03;
    this.core.position.y = 1.5 + Math.sin(t * 0.8) * 0.25;
    this.coreNet.rotation.y = t * 0.12; this.corePts.rotation.y = t * 0.12;
    this.coreInner.rotation.set(t * 0.4, t * 0.6, 0);
    this.coreSolid.scale.setScalar(cp * (1 + Math.sin(t * 3.4) * 0.05));
    this.coreShell.rotation.set(-t * 0.1, t * 0.08, 0);
    this.coreRings.forEach((r, i) => {
      r.rotation.z += dt * (0.35 + i * 0.2) * (i % 2 ? -1 : 1);
      r.rotation.x += dt * 0.08 * (i + 1);
      const bead = r.children[0], k = bead.userData;
      const a = t * (0.8 + k.k * 0.3) + k.k * 2;
      bead.position.set(Math.cos(a) * k.r, Math.sin(a) * k.r, 0);
      bead.rotation.y = t * 3;
    });

    // Nodos
    this.nodes.forEach((n, i) => {
      n.hover += (n.targetHover - n.hover) * (1 - Math.exp(-dt * 10));
      setHover(n.group, n.hover * 0.5);
      n.model.userData.tick && n.model.userData.tick(t, dt);
      n.model.rotation.y = t * 0.18 + i;
      n.model.position.y = Math.sin(t * 1.1 + i) * 0.18;
      const sc = 1.05 + n.hover * 0.22;
      n.model.scale.setScalar(sc);
      n.platRings.forEach((r, k) => { if (k < 3) r.rotation.z = t * (0.4 + k * 0.2) * (k % 2 ? -1 : 1); });
    });

    // Fragmentos
    this.fragments.forEach((f) => {
      if (f.collected) return;
      f.octa.rotation.y = t * 1.4 + f.phase; f.octa.rotation.x = t * 0.9;
      f.inner.rotation.y = -t * 2;
      f.halo.rotation.x = t + f.phase; f.halo.rotation.y = t * 0.7;
      f.group.position.y = f.base.y + Math.sin(t * 1.3 + f.phase) * 0.25;
      const s = 1 + (eagle ? Math.sin(t * 5 + f.phase) * 0.12 : 0);
      f.octa.scale.setScalar(s);
    });

    // Ráfagas
    for (let b = this.bursts.length - 1; b >= 0; b--) {
      const B = this.bursts[b]; B.life += dt;
      for (let i = 0; i < B.vel.length; i++) {
        B.p[i * 3] += B.vel[i].x * dt; B.p[i * 3 + 1] += B.vel[i].y * dt; B.p[i * 3 + 2] += B.vel[i].z * dt;
        B.vel[i].multiplyScalar(1 - dt * 1.8);
      }
      B.pts.geometry.attributes.position.needsUpdate = true;
      B.pts.material.uniforms.uAlpha.value = Math.max(0, 1 - B.life / 1.3);
      if (B.life > 1.3) { this.root.remove(B.pts); B.pts.geometry.dispose(); B.pts.material.dispose(); this.bursts.splice(b, 1); }
    }
  }
}
