import * as THREE from 'three';
import { holoMesh, holoLine, holoPoints, addSeeds, mulberry } from './hologram.js';

// Kit de materiales por color
function kit(color) {
  return {
    solid: (alpha = 0.3) => holoMesh(color, { alpha }),
    wire: (alpha = 0.8) => holoMesh(color, { alpha, wireframe: true }),
    line: (alpha = 0.95) => holoLine(color, { alpha }),
    points: (size = 1, alpha = 1) => holoPoints(color, { size, alpha }),
  };
}

const edges = (geo, mat) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat);

function netGeometry(pts, maxDist) {
  const v = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      if (pts[i].distanceTo(pts[j]) < maxDist) v.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

function pointsFrom(pts) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return addSeeds(g, mulberry(pts.length));
}

// Cada modelo devuelve un Group con userData.tick(t, dt)
const builders = {
  // ---------- WEB 3D: ventanas flotantes + nudo toroidal ----------
  web(H) {
    const g = new THREE.Group();
    const frames = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(2.4, 1.5, 0.05);
      const f = new THREE.Mesh(geo, H.solid(0.22));
      f.add(edges(geo, H.line()));
      f.position.set(i * 0.45 - 0.5, i * 0.6 - 0.6, -i * 0.7 + 0.5);
      f.rotation.y = -0.4;
      // Barra de título y bloques UI
      const dots = [-1, -0.88, -0.76];
      dots.forEach((x) => {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), H.solid(1));
        d.position.set(x + 0.1, 0.62, 0.03);
        f.add(d);
      });
      for (let k = 0; k < 4; k++) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.7 - k * 0.3, 0.09), H.solid(0.85));
        bar.position.set(-0.3 + (0.3 * k) / 2 - 0.15, 0.3 - k * 0.22, 0.03);
        f.add(bar);
      }
      const block = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), H.solid(0.5));
      block.position.set(0.78, -0.2, 0.03);
      f.add(block);
      g.add(f);
      frames.push(f);
    }
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.16, 140, 18), H.wire(0.9));
    knot.position.set(1.15, -0.55, 1.1);
    g.add(knot);
    const cursor = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), H.solid(1));
    cursor.rotation.z = 0.5;
    g.add(cursor);
    g.userData.tick = (t) => {
      knot.rotation.x = t * 0.6; knot.rotation.y = t * 0.9;
      frames.forEach((f, i) => (f.position.y = i * 0.6 - 0.6 + Math.sin(t * 1.3 + i) * 0.08));
      cursor.position.set(Math.cos(t * 0.9) * 1.1, Math.sin(t * 1.3) * 0.7, 1.0);
    };
    return g;
  },

  // ---------- APPS: smartphone + pantallas orbitando ----------
  apps(H) {
    const g = new THREE.Group();
    const phoneGeo = new THREE.BoxGeometry(1.15, 2.3, 0.14);
    const phone = new THREE.Mesh(phoneGeo, H.solid(0.3));
    phone.add(edges(phoneGeo, H.line()));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.0), H.solid(0.5));
    screen.position.z = 0.08;
    phone.add(screen);
    const notch = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), H.solid(1));
    notch.position.set(0, 0.95, 0.09);
    phone.add(notch);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const ic = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), H.solid(0.95));
        ic.position.set(-0.3 + c * 0.3, 0.55 - r * 0.32, 0.09);
        phone.add(ic);
      }
    g.add(phone);
    const orbit = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pg = new THREE.PlaneGeometry(0.9, 0.6);
      const p = new THREE.Mesh(pg, H.solid(0.3));
      p.add(edges(pg, H.line(0.8)));
      const a = (i / 4) * Math.PI * 2;
      p.position.set(Math.cos(a) * 1.9, Math.sin(i * 1.7) * 0.5, Math.sin(a) * 1.9);
      p.userData.a = a;
      orbit.add(p);
    }
    g.add(orbit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.012, 8, 120), H.solid(0.9));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.userData.tick = (t) => {
      phone.rotation.y = Math.sin(t * 0.7) * 0.5;
      phone.position.y = Math.sin(t * 1.4) * 0.1;
      orbit.rotation.y = t * 0.5;
      orbit.children.forEach((p) => p.lookAt(0, p.position.y, 0));
    };
    return g;
  },

  // ---------- IA: red neuronal / cerebro ----------
  ia(H) {
    const g = new THREE.Group();
    const rnd = mulberry(7);
    const pts = [];
    for (let i = 0; i < 70; i++) {
      const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), r = 1.1 + rnd() * 0.55;
      pts.push(new THREE.Vector3(r * Math.sin(v) * Math.cos(u) * 1.15, r * Math.cos(v) * 0.85, r * Math.sin(v) * Math.sin(u)));
    }
    const net = new THREE.LineSegments(netGeometry(pts, 1.1), H.line(0.55));
    const dots = new THREE.Points(pointsFrom(pts), H.points(2.4));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), H.wire(0.9));
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), H.wire(0.15));
    // Impulsos viajando
    const pulseGeo = new THREE.BufferGeometry();
    const N = 22; const pa = new Float32Array(N * 3);
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pa, 3));
    addSeeds(pulseGeo);
    const pulses = new THREE.Points(pulseGeo, H.points(3.6));
    const pairs = [];
    for (let i = 0; i < N; i++) pairs.push([pts[(rnd() * pts.length) | 0], pts[(rnd() * pts.length) | 0], rnd()]);
    g.add(net, dots, core, shell, pulses);
    g.userData.tick = (t) => {
      g.rotation.y = t * 0.25;
      core.rotation.x = t * 0.8; core.rotation.y = t * 0.5;
      core.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
      shell.rotation.y = -t * 0.15;
      for (let i = 0; i < N; i++) {
        const [a, b, o] = pairs[i];
        const k = (t * 0.45 + o) % 1;
        pa[i * 3] = a.x + (b.x - a.x) * k; pa[i * 3 + 1] = a.y + (b.y - a.y) * k; pa[i * 3 + 2] = a.z + (b.z - a.z) * k;
      }
      pulseGeo.attributes.position.needsUpdate = true;
    };
    return g;
  },

  // ---------- CIBERSEGURIDAD: escudo + candado + anillos ----------
  cyber(H) {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0, 1.5); s.bezierCurveTo(0.5, 1.2, 1.0, 1.15, 1.25, 1.2);
    s.bezierCurveTo(1.25, 0.2, 1.0, -0.8, 0, -1.5);
    s.bezierCurveTo(-1.0, -0.8, -1.25, 0.2, -1.25, 1.2);
    s.bezierCurveTo(-1.0, 1.15, -0.5, 1.2, 0, 1.5);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    geo.center();
    const shield = new THREE.Mesh(geo, H.solid(0.25));
    shield.add(new THREE.Mesh(geo, H.wire(0.5)));
    shield.add(edges(geo, H.line()));
    g.add(shield);
    // Candado
    const lock = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.2), H.solid(0.7));
    body.add(edges(new THREE.BoxGeometry(0.62, 0.5, 0.2), H.line()));
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 24, Math.PI), H.solid(1));
    shackle.position.y = 0.25;
    lock.add(body, shackle);
    lock.position.z = 0.26;
    g.add(lock);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.28, 0.014, 8, 140), H.solid(0.9));
      r.rotation.x = Math.PI / 2 + i * 0.35;
      r.rotation.y = i * 0.5;
      g.add(r); rings.push(r);
    }
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), H.solid(1));
    g.add(orb);
    g.userData.tick = (t) => {
      shield.rotation.y = Math.sin(t * 0.8) * 0.5;
      lock.rotation.y = shield.rotation.y;
      rings.forEach((r, i) => { r.rotation.z = t * (0.4 + i * 0.25) * (i % 2 ? -1 : 1); });
      orb.position.set(Math.cos(t * 1.6) * 2.1, Math.sin(t * 1.1) * 0.8, Math.sin(t * 1.6) * 2.1);
      orb.rotation.y = t * 3;
    };
    return g;
  },

  // ---------- CLOUD: nube de esferas + satélites + haces de datos ----------
  cloud(H) {
    const g = new THREE.Group();
    const spec = [[0, 0, 0, 0.8], [-0.85, -0.2, 0.1, 0.6], [0.85, -0.15, -0.1, 0.65], [0.3, 0.55, 0.2, 0.55], [-0.4, 0.45, -0.2, 0.5], [0, -0.35, 0.45, 0.5]];
    const cloud = new THREE.Group();
    spec.forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), H.wire(0.7));
      m.position.set(x, y, z);
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.96, 1), H.solid(0.18));
      m.add(inner);
      cloud.add(m);
    });
    g.add(cloud);
    const sats = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.3, 0.01, 6, 120), H.solid(0.7));
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.45;
      g.add(ring);
      const sat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), H.solid(1));
      sat.userData = { r: 1.9 + i * 0.3, tilt: (i - 1) * 0.45, sp: 0.8 + i * 0.35, off: i * 2 };
      g.add(sat); sats.push(sat);
    }
    // Haces de datos hacia abajo
    const beams = [];
    for (let i = 0; i < 5; i++) {
      const pts = [new THREE.Vector3((i - 2) * 0.4, -0.9, 0), new THREE.Vector3((i - 2) * 0.4, -2.2, 0)];
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), H.line(0.7));
      g.add(l); beams.push(l);
    }
    const dgeo = new THREE.BufferGeometry();
    const D = 30; const da = new Float32Array(D * 3);
    dgeo.setAttribute('position', new THREE.BufferAttribute(da, 3)); addSeeds(dgeo);
    g.add(new THREE.Points(dgeo, H.points(2.2)));
    g.userData.tick = (t) => {
      cloud.rotation.y = t * 0.2;
      cloud.position.y = Math.sin(t * 1.2) * 0.1;
      sats.forEach((s) => {
        const a = t * s.userData.sp + s.userData.off, r = s.userData.r;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        s.position.set(x, z * Math.sin(s.userData.tilt), z * Math.cos(s.userData.tilt));
        s.rotation.y = t * 2;
      });
      for (let i = 0; i < D; i++) {
        const col = i % 5, k = ((t * 0.7 + i * 0.137) % 1);
        da[i * 3] = (col - 2) * 0.4; da[i * 3 + 1] = -0.9 - k * 1.3; da[i * 3 + 2] = 0;
      }
      dgeo.attributes.position.needsUpdate = true;
    };
    return g;
  },

  // ---------- IoT: chip + pines + trazas + nodos orbitando ----------
  iot(H) {
    const g = new THREE.Group();
    const chipGeo = new THREE.BoxGeometry(1.5, 0.22, 1.5);
    const chip = new THREE.Mesh(chipGeo, H.solid(0.35));
    chip.add(edges(chipGeo, H.line()));
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), H.solid(0.9));
    die.position.y = 0.15; chip.add(die);
    for (let i = 0; i < 8; i++) {
      for (const side of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(side[0] ? 0.3 : 0.07, 0.04, side[1] ? 0.3 : 0.07), H.solid(0.9));
        const off = -0.6 + i * 0.17;
        pin.position.set(side[0] ? side[0] * 0.9 : off, 0, side[1] ? side[1] * 0.9 : off);
        chip.add(pin);
      }
    }
    g.add(chip);
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), H.wire(0.9));
    ico.position.y = 1.2; g.add(ico);
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 0.95, 0)]), H.line());
    g.add(beam);
    const nodes = [];
    for (let i = 0; i < 6; i++) {
      const n = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), H.solid(1));
      n.userData = { a: (i / 6) * Math.PI * 2, r: 2.0, y: Math.sin(i * 2) * 0.6 };
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 0)]), H.line(0.5));
      g.add(n, l); nodes.push([n, l]);
    }
    g.userData.tick = (t) => {
      chip.rotation.y = t * 0.3;
      ico.rotation.x = t * 0.7; ico.rotation.y = t * 0.9; ico.position.y = 1.2 + Math.sin(t * 1.5) * 0.1;
      nodes.forEach(([n, l], i) => {
        const a = n.userData.a + t * 0.5;
        n.position.set(Math.cos(a) * n.userData.r, n.userData.y + Math.sin(t * 1.2 + i) * 0.15, Math.sin(a) * n.userData.r);
        n.rotation.y = t * 2;
        const p = l.geometry.attributes.position;
        p.setXYZ(1, n.position.x, n.position.y, n.position.z); p.needsUpdate = true;
      });
    };
    return g;
  },

  // ---------- AR/VR: visor + lentes + haz de proyección ----------
  arvr(H) {
    const g = new THREE.Group();
    const visorGeo = new THREE.BoxGeometry(2.3, 1.1, 1.0, 4, 2, 2);
    const visor = new THREE.Mesh(visorGeo, H.solid(0.3));
    visor.add(new THREE.Mesh(visorGeo, H.wire(0.35)));
    visor.add(edges(visorGeo, H.line()));
    for (const x of [-0.55, 0.55]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 10, 40), H.solid(1));
      lens.position.set(x, 0, 0.52);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), H.solid(0.5));
      inner.position.set(x, 0, 0.52);
      visor.add(lens, inner);
    }
    g.add(visor);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 8, 60, Math.PI), H.solid(0.8));
    strap.rotation.set(0, Math.PI / 2, 0); strap.position.z = -0.1;
    g.add(strap);
    // Cono de proyección
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 32, 1, true), H.solid(0.12));
    cone.rotation.x = -Math.PI / 2; cone.position.z = 1.8;
    g.add(cone);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), H.wire(0.95));
    cube.position.z = 2.4; g.add(cube);
    const hand = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), H.solid(0.9));
      f.position.set(-0.3 + i * 0.15, 0.2 * Math.sin(i * 0.9) , 0);
      hand.add(f);
    }
    hand.position.set(1.2, -1.0, 1.0); g.add(hand);
    g.userData.tick = (t) => {
      visor.rotation.y = Math.sin(t * 0.6) * 0.3;
      visor.position.y = Math.sin(t * 1.3) * 0.08;
      cube.rotation.x = t * 0.8; cube.rotation.y = t * 1.1;
      cube.position.y = Math.sin(t * 1.5) * 0.25;
      hand.rotation.z = Math.sin(t * 1.2) * 0.2;
    };
    return g;
  },
};

export function buildModel(id, color) {
  return builders[id](kit(color));
}
