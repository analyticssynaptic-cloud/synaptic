import * as THREE from 'three';

const BASE = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');

// Carga la malla compacta generada por tools/decimate.cjs
async function loadBody() {
  const buf = await (await fetch(BASE + 'aria/aria-body.bin')).arrayBuffer();
  const dv = new DataView(buf);
  const nV = dv.getUint32(0, true), nI = dv.getUint32(4, true);
  const mn = [0, 1, 2].map((i) => dv.getFloat32(8 + i * 4, true)), mx = [0, 1, 2].map((i) => dv.getFloat32(20 + i * 4, true));
  const q = new Uint16Array(buf, 32, nV * 3);
  const off = 32 + nV * 6 + ((nV * 6) % 4 ? 4 - ((nV * 6) % 4) : 0);
  const idx = new Uint32Array(buf, off, nI);
  const pos = new Float32Array(nV * 3);
  for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = mn[k] + (q[i * 3 + k] / 65535) * (mx[k] - mn[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return { g, min: mn, max: mx };
}

export function createHolo(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  const root = new THREE.Group(); scene.add(root);
  const U = { uTime: { value: 0 }, uReveal: { value: 0 }, uMinY: { value: -1 }, uMaxY: { value: 1 } };
  let ready = false, running = false, raf = 0, t = 0, last = 0, yaw = 0.4, yawGoal = 0.4, drag = null;

  // ---------- Plataforma ----------
  const plat = new THREE.Group(); root.add(plat);
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.42 + i * 0.13, 0.006 - i * 0.0012, 8, 120), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.85 - i * 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.rotation.x = Math.PI / 2; plat.add(r);
  }
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(120,230,255,.9)'); gr.addColorStop(0.4, 'rgba(0,180,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; plat.add(disc);
  const back = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x2a7fff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  back.scale.set(2.6, 3.2, 1); back.position.set(0, 0.15, -0.6); root.add(back);

  // ---------- Cuerpo holográfico ----------
  const bodyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: U,
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vV; varying vec3 vL;
      void main(){ vL = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime,uReveal,uMinY,uMaxY; varying vec3 vN; varying vec3 vW; varying vec3 vV; varying vec3 vL;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float y01 = (vL.y - uMinY)/(uMaxY - uMinY);
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        // Traje: líneas de circuito horizontales y costuras verticales tipo Tron
        float bands = smoothstep(0.92, 1.0, abs(sin(vL.y*42.0 + n2(vL.xz*9.0)*2.0)));
        float seams = smoothstep(0.965, 1.0, abs(sin(vL.x*34.0))) * smoothstep(0.3, 0.7, abs(vN.z));
        float scan = 0.65 + 0.35*sin(vW.y*160.0 - uTime*6.0);
        float sweep = smoothstep(0.985, 1.0, sin(vW.y*3.0 - uTime*1.4));
        vec3 cyan = vec3(0.35,0.9,1.0), deep = vec3(0.05,0.35,0.8);
        vec3 col = mix(deep, cyan, fr) * (0.22 + fr*1.6) * scan + cyan*(bands*0.55 + seams*0.8) + vec3(0.8,1.0,1.0)*sweep*0.6;
        float a = (0.16 + fr*0.85 + bands*0.35 + seams*0.4) * scan;
        // Disolución en la base (el cuerpo se materializa desde partículas)
        float nz = n2(vL.xz*40.0 + uTime*0.3) * 0.12;
        float base = smoothstep(0.0, 0.22, y01 - nz);
        float edge = (1.0 - smoothstep(0.0, 0.05, abs(y01 - nz - 0.06))) * 1.4;
        // Aparición de abajo hacia arriba
        float rv = uReveal*1.25 - 0.1;
        float on = smoothstep(rv, rv - 0.03, y01);
        float rEdge = (1.0 - smoothstep(0.0, 0.03, abs(y01 - rv))) * step(0.001, uReveal) * step(uReveal, 0.999);
        col += cyan*(edge + rEdge*2.0);
        a = a*base*on + (edge*0.6 + rEdge)*on;
        gl_FragColor = vec4(col, clamp(a,0.0,1.0));
      }`,
  });
  let body = null, sparks = null;

  // ---------- Partículas que suben desde la plataforma ----------
  function makeSparks(min, max) {
    const N = 900, p = new Float32Array(N * 3), s = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 0.34; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.random(); p[i * 3 + 2] = Math.sin(a) * r * 0.7; s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.uTime, uB: { value: min[1] - 0.12 }, uH: { value: (max[1] - min[1]) * 0.45 }, uPx: { value: renderer.getPixelRatio() } },
      vertexShader: `uniform float uTime,uB,uH,uPx; attribute float aS; varying float vA;
        void main(){ float k = fract(position.y + uTime*(0.06+aS*0.1)); vec3 p = vec3(position.x*(1.0-k*0.35), uB + k*uH, position.z*(1.0-k*0.35));
          vA = smoothstep(0.0,0.1,k)*smoothstep(1.0,0.5,k); vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = (1.5+aS*2.5)*uPx*(2.2/-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(0.5,0.95,1.0, vA*smoothstep(0.5,0.0,d)); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
  }

  loadBody().then(({ g, min, max }) => {
    body = new THREE.Mesh(g, bodyMat); root.add(body);
    U.uMinY.value = min[1]; U.uMaxY.value = max[1];
    plat.position.y = min[1] - 0.16;
    sparks = makeSparks(min, max); root.add(sparks);
    const h = max[1] - min[1];
    cam.position.set(0, min[1] + h * 0.52, 5.0); cam.lookAt(0, min[1] + h * 0.44, 0);
    ready = true;
  });

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / r.height;
    cam.fov = cam.aspect < 0.8 ? 44 : 32;
    cam.updateProjectionMatrix();
  }

  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag !== null) { yawGoal += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    U.uTime.value = t;
    if (ready) U.uReveal.value = Math.min(1, U.uReveal.value + dt * 0.45);
    if (drag === null) yawGoal += dt * 0.25;
    yaw += (yawGoal - yaw) * (1 - Math.exp(-dt * 6));
    root.rotation.y = yaw;
    plat.children.forEach((r, i) => { if (r.geometry.type === 'TorusGeometry') r.rotation.z = t * (0.3 + i * 0.25) * (i % 2 ? -1 : 1); });
    if (body) body.position.y = Math.sin(t * 0.9) * 0.012;
    renderer.render(scene, cam);
  }

  return {
    start() { if (running) return; running = true; U.uReveal.value = 0; last = 0; resize(); raf = requestAnimationFrame(loop); addEventListener('resize', resize); },
    stop() { running = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); },
  };
}
