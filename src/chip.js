import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mulberry, shared } from './hologram.js';

// Capas de arriba (0) hacia abajo (6)
export const REST_Y = [1.5, 1.22, 1.04, 0.88, 0.7, 0.52, 0.2];
export const EXP_Y = [10.2, 8.1, 6.5, 4.9, 3.4, 1.9, 0.2];
const ROT = [0.38, -0.26, 0.14, 0.0, -0.14, 0.22, 0];
const TILT = [0.1, -0.06, 0.04, 0, -0.04, 0.05, 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

// ---------- Texturas procedurales (canvas) ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function drawCircuit(x, w, h, { bg, line, pad, density = 200, lw = 3, seed = 5 }) {
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.lineCap = 'round'; x.lineJoin = 'round';
  const r = mulberry(seed), DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], G = 16;
  for (let i = 0; i < density; i++) {
    let px = Math.floor(r() * w / G) * G, py = Math.floor(r() * h / G) * G;
    x.strokeStyle = line; x.lineWidth = lw * (0.6 + r() * 0.9);
    x.beginPath(); x.moveTo(px, py);
    let dir = Math.floor(r() * 4);
    const steps = 3 + Math.floor(r() * 7);
    for (let s = 0; s < steps; s++) {
      const len = (1 + Math.floor(r() * 5)) * G;
      px += DX[dir] * len; py += DY[dir] * len; x.lineTo(px, py);
      const d2 = (dir + (r() < 0.5 ? 1 : 3)) % 4;
      if (r() < 0.5) { px += DX[d2] * G; py += DY[d2] * G; x.lineTo(px, py); } else dir = d2;
    }
    x.stroke();
    x.fillStyle = pad; x.beginPath(); x.arc(px, py, lw * 1.8, 0, 7); x.fill();
  }
}

function drawDie(x, w, h) {
  x.fillStyle = '#0a1016'; x.fillRect(0, 0, w, h);
  const n = 4, g = w / n, r = mulberry(31);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const hue = (r() * 360) | 0;
    const grd = x.createLinearGradient(i * g, j * g, (i + 1) * g, (j + 1) * g);
    grd.addColorStop(0, `hsl(${hue},75%,58%)`); grd.addColorStop(1, `hsl(${(hue + 50) % 360},80%,34%)`);
    x.fillStyle = grd; x.fillRect(i * g + 6, j * g + 6, g - 12, g - 12);
    for (let k = 0; k < 220; k++) {
      x.fillStyle = `rgba(255,255,255,${r() * 0.25})`;
      x.fillRect(i * g + 6 + r() * (g - 12), j * g + 6 + r() * (g - 12), 2 + r() * 6, 1 + r() * 3);
    }
  }
  x.strokeStyle = 'rgba(160,230,255,0.8)'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
}

function drawBrushed(x, w, h) {
  x.fillStyle = '#a0a0a0'; x.fillRect(0, 0, w, h);
  const r = mulberry(11);
  for (let i = 0; i < 900; i++) {
    const v = 90 + r() * 120;
    x.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
    x.fillRect(0, r() * h, w, 1 + r() * 2);
  }
}

function drawGlassGrid(x, w, h) {
  x.strokeStyle = 'rgba(200,255,255,0.75)'; x.lineWidth = 3;
  for (let i = 1; i <= 6; i++) { const m = (i * w) / 14; x.strokeRect(m, m, w - 2 * m, h - 2 * m); }
  x.lineWidth = 1.5;
  for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo((i * w) / 16, 0); x.lineTo((i * w) / 16, h); x.stroke(); x.beginPath(); x.moveTo(0, (i * h) / 16); x.lineTo(w, (i * h) / 16); x.stroke(); }
}

function drawHalo(x, w, h) {
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}

function drawSmoke(x, w, h) {
  const r = mulberry(8);
  for (let i = 0; i < 46; i++) {
    const px = w * (0.2 + r() * 0.6), py = h * (0.2 + r() * 0.6), rad = w * (0.1 + r() * 0.22);
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.12 + r() * 0.12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
  }
}

function rr(p, w, h, r) {
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

function flatExtrude(shape, depth, bevel = 0.04) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, -depth / 2, 0);
  return g;
}

export class Chip {
  constructor(scene, renderer, colors) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.e = 0; this.x = 0; this.layers = []; this.pickMeshes = []; this.hoverIdx = -1;

    // Reflejos de estudio para metal y cristal
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
    scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.1, 0.116, 0.143, THREE.LinearSRGBColorSpace), 0.026);

    this._lights();
    this._backdrop();
    this._materials();
    this._buildLayers(colors);
    this._buildBracket();
    this._ground();
    this._streams();
    this._dust();
    this._smoke();
    this._shards();
    this._logo();
  }

  _logo() {
    const tex = new THREE.TextureLoader().load((import.meta.env.BASE_URL || './') + 'logo.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    this.logo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    this.logo.scale.set(6.6, 6, 1);
    this.logo.position.set(0, 6.2, 0);
    this.group.add(this.logo);
  }

  _lights() {
    const g = this.group;
    const key = new THREE.DirectionalLight(0xffffff, 4.2); key.position.set(6, 14, 8);
    const rim = new THREE.DirectionalLight(0x66ddff, 2.0); rim.position.set(-10, 5, -7);
    const amber = new THREE.PointLight(0xffb060, 160, 45, 2); amber.position.set(9, 6, -5);
    const cyan = new THREE.PointLight(0x40d0ff, 120, 40, 2); cyan.position.set(-7, 3, 7);
    g.add(key, rim, amber, cyan, new THREE.HemisphereLight(0x8899aa, 0x10141a, 0.5));
  }

  _backdrop() {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: shared.uTime },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform float uTime;
        void main(){
          float h = vP.y*0.5+0.5;
          vec3 top = vec3(0.115,0.13,0.158), bot = vec3(0.05,0.057,0.07);
          vec3 col = mix(bot, top, smoothstep(0.15,0.95,h));
          col += vec3(0.03,0.036,0.046)*exp(-pow((vP.y-0.0)*4.0,2.0));
          float g = fract(sin(dot(vP.xy*900.0,vec2(12.9,78.2)))*43758.5);
          col += (g-0.5)*0.012;
          gl_FragColor = vec4(col,1.0);
        }`,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), m));
  }

  _materials() {
    this.brushed = canvasTex(512, 512, drawBrushed, false);
    this.brushed.repeat.set(2, 2);
    const brushed = this.brushed;
    this.m = {
      steel: new THREE.MeshStandardMaterial({ color: 0xc3ccd6, metalness: 1, roughness: 0.62, roughnessMap: brushed, envMapIntensity: 1.2 }),
      steelDark: new THREE.MeshStandardMaterial({ color: 0x8e99a6, metalness: 1, roughness: 0.55, roughnessMap: brushed, envMapIntensity: 1.1 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xc27a45, metalness: 1, roughness: 0.28, envMapIntensity: 1.4 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xe0ad4a, metalness: 1, roughness: 0.25, envMapIntensity: 1.4 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x7fb4c6, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.12, clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
      dark: new THREE.MeshStandardMaterial({ color: 0x10171e, metalness: 0.6, roughness: 0.45 }),
      glow: new THREE.MeshBasicMaterial({ color: 0x55e6ff, toneMapped: false }),
    };
  }

  _triOverlay(w, d, color, seed) {
    const r = mulberry(seed * 37 + 5), N = 11, V = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const edge = i === 0 || j === 0 || i === N || j === N;
      V.push([(i / N - 0.5) * w + (edge ? 0 : (r() - 0.5) * (w / N) * 0.8), (j / N - 0.5) * d + (edge ? 0 : (r() - 0.5) * (d / N) * 0.8)]);
    }
    const pos = [], bary = [], rnd = [];
    const push = (a, b, c) => {
      const q = r();
      for (const [k, p] of [a, b, c].entries()) { pos.push(p[0], 0, p[1]); bary.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0); rnd.push(q); }
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = V[j * (N + 1) + i], b = V[j * (N + 1) + i + 1], c = V[(j + 1) * (N + 1) + i], e = V[(j + 1) * (N + 1) + i + 1];
      if (r() < 0.5) { push(a, b, c); push(b, e, c); } else { push(a, b, e); push(a, e, c); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aBary', new THREE.Float32BufferAttribute(bary, 3));
    g.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: shared.uTime, uH: { value: 0 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: 'attribute vec3 aBary; attribute float aRand; varying vec3 vB; varying float vR; varying vec2 vP; void main(){ vB=aBary; vR=aRand; vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime,uH; uniform vec3 uColor; varying vec3 vB; varying float vR; varying vec2 vP;
        void main(){
          float edge = 1.0 - smoothstep(0.0, 0.06, min(min(vB.x,vB.y),vB.z));
          float wave = 0.5 + 0.5*sin(uTime*2.2 + vR*6.283 + length(vP)*0.9);
          float face = 0.16 + vR*0.32 + wave*vR*0.5;
          vec3 col = mix(uColor*1.25, vec3(1.0), edge*0.75);
          gl_FragColor = vec4(col, uH*clamp(edge*0.95 + face, 0.0, 1.0));
        }`,
    });
    return { g, m };
  }

  _layerWrap(i, g, w, d, color) {
    g.position.y = REST_Y[i];
    const c = new THREE.Color(color);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.7, d * 1.7),
      new THREE.MeshBasicMaterial({ map: this.haloTex, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.05;
    const ol = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.14, d)),
      new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    g.add(halo, ol);
    const topY = [0.2, 0.12, 0.05, 0.22, 0.05, 0.12, 0.26][i];
    const tri = this._triOverlay(w * 0.99, d * 0.99, color, i + 1);
    const t1 = new THREE.Mesh(tri.g, tri.m), t2 = new THREE.Mesh(tri.g, tri.m);
    t1.position.y = topY + 0.025; t2.position.y = -topY * 0.6;
    g.add(t1, t2);
    g.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && o !== halo && o !== t1 && o !== t2 && o.material.blending !== THREE.AdditiveBlending) { o.userData.layer = i; this.pickMeshes.push(o); }
    });
    this.group.add(g);
    this.layers.push({ g, i, halo, ol, hl: 0, hov: 0, triMat: tri.m });
  }

  _buildLayers(colors) {
    const m = this.m;
    this.haloTex = canvasTex(256, 256, drawHalo);
    const pcbTex = canvasTex(1024, 1024, (x, w, h) => drawCircuit(x, w, h, { bg: '#0d3a40', line: '#2aa6a6', pad: '#e0b050', density: 240, lw: 3 }));
    const pcbEmit = canvasTex(1024, 1024, (x, w, h) => drawCircuit(x, w, h, { bg: '#000', line: '#1d8f8f', pad: '#f2c36a', density: 240, lw: 3 }));
    const baseEmit = canvasTex(1024, 1024, (x, w, h) => drawCircuit(x, w, h, { bg: '#000', line: '#2aa8d8', pad: '#9ff0ff', density: 420, lw: 2, seed: 17 }));
    baseEmit.repeat.set(3, 3);
    const dieTex = canvasTex(512, 512, drawDie);
    const glassGrid = canvasTex(512, 512, drawGlassGrid);
    const glassCirc = canvasTex(1024, 1024, (x, w, h) => drawCircuit(x, w, h, { bg: null, line: 'rgba(210,255,255,0.8)', pad: 'rgba(255,255,255,0.95)', density: 120, lw: 2, seed: 99 }));

    // 0 · Cubierta superior (marco metálico con ventana)
    {
      const g = new THREE.Group();
      const shape = rr(new THREE.Shape(), 6.4, 6.4, 0.55);
      shape.holes.push(rr(new THREE.Path(), 3.0, 3.0, 0.3));
      g.add(new THREE.Mesh(flatExtrude(shape, 0.22), m.steel));
      const ringS = rr(new THREE.Shape(), 3.18, 3.18, 0.34); ringS.holes.push(rr(new THREE.Path(), 2.98, 2.98, 0.3));
      const ring = new THREE.Mesh(flatExtrude(ringS, 0.05, 0.005), m.glow); ring.position.y = 0.13; g.add(ring);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 0.2), m.steelDark);
        rib.position.set(sx * 2.1, 0.14, sz * 2.1); rib.rotation.y = sx * sz * Math.PI / 4; g.add(rib);
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), m.steelDark);
        bolt.position.set(sx * 2.85, 0.15, sz * 2.85); g.add(bolt);
      }
      this._layerWrap(0, g, 6.4, 6.4, colors[0]);
    }

    // 1 · Disipador con heat-pipes de cobre
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 5.6), m.steelDark));
      const block = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.6), m.steel); block.position.y = -0.12; g.add(block);
      for (let k = 0; k < 3; k++) {
        const z0 = (k - 1) * 0.85, s = k % 2 ? 1 : -1;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-3.4, 0.5, z0 + s * 0.2), new THREE.Vector3(-2.4, 0.17, z0),
          new THREE.Vector3(-1.1, 0.19, z0 + s * 0.55), new THREE.Vector3(0.2, 0.19, z0 - s * 0.1),
          new THREE.Vector3(1.4, 0.19, z0 + s * 0.45), new THREE.Vector3(2.6, 0.17, z0), new THREE.Vector3(3.4, 0.55, z0 - s * 0.2),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.14, 14), m.copper));
      }
      const fins = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.5), m.steel);
      fins.position.set(0, 0.1, 2.5); g.add(fins);
      this._layerWrap(1, g, 5.6, 5.6, colors[1]);
    }

    // 2 · Cristal óptico superior
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.05, 5.4), m.glass));
      const ov = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 5.3), new THREE.MeshBasicMaterial({ map: glassCirc, color: 0x9ff4ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      ov.rotation.x = -Math.PI / 2; ov.position.y = 0.03; g.add(ov);
      this._layerWrap(2, g, 5.4, 5.4, colors[2]);
    }

    // 3 · Núcleo de silicio (sustrato + die colorido)
    {
      const g = new THREE.Group();
      const sub = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 4.0), new THREE.MeshStandardMaterial({ color: 0x1d3446, metalness: 0.5, roughness: 0.4 }));
      g.add(sub);
      const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.0, 0.16, 4.0)), new THREE.LineBasicMaterial({ color: 0xe0ad4a }));
      g.add(rim);
      const side = new THREE.MeshStandardMaterial({ color: 0x20262e, metalness: 0.9, roughness: 0.3 });
      const topM = new THREE.MeshStandardMaterial({ map: dieTex, metalness: 0.6, roughness: 0.22, emissive: 0xffffff, emissiveMap: dieTex, emissiveIntensity: 0.45 });
      const die = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 2.5), [side, side, topM, side, side, side]);
      die.position.y = 0.14; g.add(die);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), m.steel);
        p.position.set(sx * 1.78, 0.13, sz * 1.78); g.add(p);
      }
      this._layerWrap(3, g, 4.0, 4.0, colors[3]);
    }

    // 4 · Cristal de proyección
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.05, 4.7), m.glass));
      const ov = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: glassGrid, color: 0x8fd8ff, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      ov.rotation.x = -Math.PI / 2; ov.position.y = 0.03; g.add(ov);
      this._layerWrap(4, g, 4.7, 4.7, colors[4]);
    }

    // 5 · Placa de circuitos (PCB) con BGA, SMD y conector dorado
    {
      const g = new THREE.Group();
      const edge = new THREE.MeshStandardMaterial({ color: 0x0b2a30, metalness: 0.3, roughness: 0.6 });
      const top = new THREE.MeshStandardMaterial({ map: pcbTex, metalness: 0.35, roughness: 0.4, emissive: 0xffffff, emissiveMap: pcbEmit, emissiveIntensity: 0.55 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 6.4), [edge, edge, top, edge, edge, edge]));
      const n = 34, balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 8, 6), m.gold, n * n);
      const d = new THREE.Object3D(); let k = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { d.position.set((i - n / 2 + 0.5) * 0.11, 0.1, (j - n / 2 + 0.5) * 0.11); d.updateMatrix(); balls.setMatrixAt(k++, d.matrix); }
      g.add(balls);
      const r = mulberry(404), smdN = 70, smd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.08, 0.11), m.dark, smdN);
      for (let q = 0; q < smdN; q++) {
        let x, z; do { x = (r() - 0.5) * 5.8; z = (r() - 0.5) * 5.8; } while (Math.abs(x) < 2.1 && Math.abs(z) < 2.1);
        d.position.set(x, 0.12, z); d.rotation.set(0, r() < 0.5 ? 0 : Math.PI / 2, 0); d.updateMatrix(); smd.setMatrixAt(q, d.matrix);
      }
      g.add(smd);
      d.rotation.set(0, 0, 0);
      const fingers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.02, 0.32), m.gold, 26);
      for (let q = 0; q < 26; q++) { d.position.set((q - 12.5) * 0.2, 0.09, 3.02); d.updateMatrix(); fingers.setMatrixAt(q, d.matrix); }
      g.add(fingers);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20), m.gold);
        t.rotation.x = Math.PI / 2; t.position.set(sx * 2.95, 0.1, sz * 2.95); g.add(t);
      }
      this._layerWrap(5, g, 6.4, 6.4, colors[5]);
    }

    // 6 · Plataforma base (circuito luminoso)
    {
      const g = new THREE.Group();
      const side = new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.8, roughness: 0.3 });
      const top = new THREE.MeshStandardMaterial({ color: 0x1b2733, metalness: 0.75, roughness: 0.22, emissive: 0xffffff, emissiveMap: baseEmit, emissiveIntensity: 0.9, envMapIntensity: 1.3 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 18), [side, side, top, side, side, side]));
      const inset = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.05, 8.4), new THREE.MeshStandardMaterial({ color: 0x0e151d, metalness: 0.9, roughness: 0.12, envMapIntensity: 1.6 }));
      inset.position.y = 0.22; g.add(inset);
      const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8.4, 0.05, 8.4)), new THREE.LineBasicMaterial({ color: 0x55e6ff, toneMapped: false }));
      rim.position.y = 0.22; g.add(rim);
      this._layerWrap(6, g, 18, 18, colors[6]);
    }
  }

  _buildBracket() {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(1.1, 0); s.lineTo(1.1, 0.9); s.lineTo(0.62, 0.9); s.lineTo(0.62, 3.5);
    s.lineTo(1.1, 3.5); s.lineTo(1.1, 4.4); s.lineTo(0, 4.4); s.closePath();
    const hole = new THREE.Path(); hole.absarc(0.31, 2.2, 0.12, 0, Math.PI * 2, true); s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    geo.translate(-0.55, -2.2, -0.08);
    this.bracket = new THREE.Mesh(geo, this.m.steel);
    this.bracket.rotation.y = Math.PI / 2;
    this.bracket.userData.layer = 0; this.pickMeshes.push(this.bracket);
    this.group.add(this.bracket);
  }

  _ground() {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(120, 64),
      new THREE.MeshStandardMaterial({ color: 0x424a57, metalness: 0.4, roughness: 0.5, envMapIntensity: 0.6 })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.02;
    this.group.add(disc);
  }

  _streams() {
    const N = 1500, pos = new Float32Array(N * 3), seed = new Float32Array(N), kind = new Float32Array(N), R = new Float32Array(N), A = new Float32Array(N);
    const r = mulberry(222);
    for (let i = 0; i < N; i++) { seed[i] = r(); kind[i] = r() < 0.18 ? 1 : 0; R[i] = 0.4 + r() * 2.5; A[i] = r() * 6.283; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.setAttribute('aR', new THREE.BufferAttribute(R, 1));
    g.setAttribute('aA', new THREE.BufferAttribute(A, 1));
    this.streamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: shared.uTime, uPx: shared.uPx, uE: { value: 0 } },
      vertexShader: `
        uniform float uTime,uE,uPx; attribute float aSeed,aKind,aR,aA; varying vec3 vCol; varying float vA;
        void main(){
          float H = 11.0;
          float k = fract(aSeed*7.0 + uTime*(0.05+aSeed*0.06));
          float y = k*H;
          float wob = sin(y*1.2 + aSeed*30.0 + uTime)*0.25;
          float ang = aA + uTime*0.15*(1.0+aSeed) + y*0.12;
          float r = aR*(1.0+0.1*sin(y*2.0+uTime));
          vec3 p;
          if(aKind < 0.5){ p = vec3(cos(ang)*r + wob, y, sin(ang)*r); vCol = vec3(0.2,0.85,1.0); }
          else { p = vec3(4.6 + cos(ang)*r*0.5 + k*2.2, 1.0 + y*0.75, sin(ang)*r*0.6 + wob); vCol = vec3(1.0,0.7,0.22); }
          vA = smoothstep(0.0,0.1,k)*smoothstep(1.0,0.8,k)*uE;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_PointSize = (0.8 + aSeed*1.4)*uPx*(42.0/-mv.z);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `varying vec3 vCol; varying float vA;
        void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard;
          gl_FragColor = vec4(vCol*1.3, vA*0.6*smoothstep(0.5,0.0,d)); }`,
    });
    this.streams = new THREE.Points(g, this.streamMat);
    this.streams.frustumCulled = false;
    this.group.add(this.streams);
  }

  _dust() {
    const N = 1100, pos = new Float32Array(N * 3), seed = new Float32Array(N), r = mulberry(606);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (r() - 0.5) * 44; pos[i * 3 + 1] = r() * 22 - 4; pos[i * 3 + 2] = (r() - 0.5) * 44; seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: shared.uTime, uPx: shared.uPx },
      vertexShader: `
        uniform float uTime,uPx; attribute float aSeed; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(position.y + uTime*(0.12+aSeed*0.3) + 4.0, 22.0) - 4.0;
          p.x += sin(uTime*0.2 + aSeed*40.0)*1.6; p.z += cos(uTime*0.17 + aSeed*33.0)*1.6;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          vA = (0.25 + 0.75*fract(aSeed*13.0)) * smoothstep(-4.0,-1.0,p.y)*smoothstep(18.0,14.0,p.y);
          gl_PointSize = (1.0 + aSeed*2.0)*uPx*(40.0/-mv.z);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; gl_FragColor = vec4(0.82,0.87,0.93, vA*smoothstep(0.5,0.1,d)*0.42); }`,
    });
    this.dust = new THREE.Points(g, m);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  _smoke() {
    const tex = canvasTex(256, 256, drawSmoke);
    const r = mulberry(909);
    this.smoke = [];
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: i % 3 ? 0xb4bdca : 0x9fb4c8, transparent: true, opacity: 0.1 + r() * 0.09, depthWrite: false, fog: false });
      const s = new THREE.Sprite(mat);
      const sc = 22 + r() * 30; s.scale.set(sc, sc, 1);
      s.userData = { a: r() * 6.283, rad: 12 + r() * 26, y: -1 + r() * 14, sp: (0.01 + r() * 0.03) * (r() < 0.5 ? 1 : -1), rs: (r() - 0.5) * 0.04, bob: r() * 6 };
      this.group.add(s); this.smoke.push(s);
    }
  }

  _shards() {
    const r = mulberry(1212);
    this.shards = [];
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xb4c2d2, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.17, flatShading: true, clearcoat: 1, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xeaf5ff, transparent: true, opacity: 0.42, depthWrite: false });
    for (let i = 0; i < 80; i++) {
      const kind = r();
      const geo = (kind < 0.4 ? new THREE.TetrahedronGeometry(1) : kind < 0.75 ? new THREE.OctahedronGeometry(1) : new THREE.IcosahedronGeometry(1, 0)).clone();
      const p = geo.attributes.position, cache = new Map();
      for (let v = 0; v < p.count; v++) {
        const key = p.getX(v).toFixed(3) + p.getY(v).toFixed(3) + p.getZ(v).toFixed(3);
        if (!cache.has(key)) cache.set(key, [(r() - 0.5) * 0.7, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7]);
        const o = cache.get(key); p.setXYZ(v, p.getX(v) + o[0], p.getY(v) + o[1], p.getZ(v) + o[2]);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, glass);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), lineMat));
      const a = r() * 6.283, rad = 13 + r() * 46;
      mesh.position.set(Math.cos(a) * rad, -1 + r() * 26, Math.sin(a) * rad);
      mesh.scale.setScalar((0.5 + r() * 2.6) * (0.6 + rad * 0.03));
      mesh.userData = { spin: new THREE.Vector3((r() - 0.5) * 0.25, (r() - 0.5) * 0.25, (r() - 0.5) * 0.2), y0: mesh.position.y, ph: r() * 6 };
      this.group.add(mesh); this.shards.push(mesh);
    }
  }

  setHover(i) { this.hoverIdx = i; }
  pick(raycaster) { const h = raycaster.intersectObjects(this.pickMeshes, false)[0]; return h ? h.object.userData.layer : -1; }

  setState(e, x) { this.e = e; this.x = x; }

  update(t, dt) {
    const e = this.e;
    this.layers.forEach((L) => {
      const i = L.i, fromBottom = 6 - i;
      const le = ease(clamp(e * 1.25 - fromBottom * 0.035, 0, 1));
      L.g.position.y = REST_Y[i] + (EXP_Y[i] - REST_Y[i]) * le + Math.sin(t * 0.8 + i * 1.3) * 0.05 * le;
      L.g.rotation.y = ROT[i] * le + Math.sin(t * 0.3 + i) * 0.02 * le;
      L.g.rotation.z = TILT[i] * le;
      L.hov += ((this.hoverIdx === i ? 1 : 0) - L.hov) * (1 - Math.exp(-dt * 9));
      L.triMat.uniforms.uH.value = L.hov;
      L.g.position.y += L.hov * 0.22;
      const target = Math.max(clamp(1 - Math.abs(this.x - 1 - i) * 1.5, 0, 1), L.hov * 0.9);
      L.hl += (target - L.hl) * (1 - Math.exp(-dt * 6));
      L.halo.material.opacity = L.hl * 0.3 * (0.35 + 0.65 * le);
      L.ol.material.opacity = 0.1 * le + L.hl * 0.95;
    });
    const be = ease(clamp(e * 1.15, 0, 1));
    this.bracket.position.set(3.7 + be * 3.4, 2.4 + be * 3.8, 0.5 - be * 0.4);
    this.bracket.rotation.set(be * 0.12, Math.PI / 2 + be * 0.35, be * -0.25);
    this.streamMat.uniforms.uE.value = ease(e) * 0.95 + 0.12;
    this.group.rotation.y = t * 0.035;
    const lg = (1 - ease(clamp(e * 3.2, 0, 1))) * 0.95;
    this.logo.material.opacity = lg;
    this.logo.position.y = 6.2 + Math.sin(t * 0.8) * 0.25 + ease(clamp(e * 3.2, 0, 1)) * 3;
    this.logo.material.rotation = Math.sin(t * 0.4) * 0.08;
    this.shards.forEach((m) => { const u = m.userData; m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt; m.rotation.z += u.spin.z * dt; m.position.y = u.y0 + Math.sin(t * 0.2 + u.ph) * 0.8; });
    this.smoke.forEach((s) => {
      const u = s.userData; u.a += dt * u.sp;
      s.position.set(Math.cos(u.a) * u.rad, u.y + Math.sin(t * 0.15 + u.bob) * 1.2, Math.sin(u.a) * u.rad);
      s.material.rotation += dt * u.rs;
    });
  }
}
