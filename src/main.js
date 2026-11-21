import './style.css';
import * as THREE from 'three';
import { Stage } from './stage.js';
import { World, RING_R } from './world.js';
import { Game } from './game.js';
import { Sfx } from './audio.js';
import { shared } from './hologram.js';
import { SERVICES, CONFIG, RANKS } from './services.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#gl');

// ---------- Arranque ----------
const bootLog = $('#bootLog'), bootBar = $('#bootBar'), startBtn = $('#start');
const bootLines = [
  ['Iniciando núcleo SYNAPTIC…', ''],
  ['Montando motor holográfico (GLSL shaders)', 'ok'],
  ['Cargando geometrías: 7 recuerdos de servicio', 'ok'],
  ['Compilando lluvia de datos · 4680 partículas', 'ok'],
  ['Calibrando Visión de Águila', 'ok'],
  ['Generando síntesis de audio procedural', 'ok'],
  ['Sincronizando con el Animus…', 'wr'],
  ['Sujeto listo.', 'ok'],
];

let stage, world;
try {
  stage = new Stage(canvas);
  world = new World(stage.scene);
} catch (err) {
  console.error(err);
  bootLog.innerHTML = '<span class="wr">⚠ No se pudo iniciar WebGL. Activa la aceleración por hardware o prueba otro navegador.</span>';
  startBtn.textContent = 'WebGL no disponible';
  throw err;
}

const game = new Game();
const sfx = new Sfx();
world.restoreFragments([...game.frags]);

bootLines.forEach(([txt, cls], i) => {
  setTimeout(() => {
    const d = document.createElement('div');
    d.innerHTML = `<span class="${cls}">${cls === 'ok' ? '[ OK ] ' : cls === 'wr' ? '[ .. ] ' : '> '}</span>${txt}`;
    bootLog.appendChild(d);
    bootLog.scrollTop = bootLog.scrollHeight;
    bootBar.style.width = `${((i + 1) / bootLines.length) * 100}%`;
    if (i === bootLines.length - 1) {
      startBtn.disabled = false;
      startBtn.textContent = '▶ Sincronizar';
    }
  }, 250 + i * 330);
});

// ---------- Estado ----------
const state = { mode: 'free', detail: -1, introDone: false, started: false, focus: -1, eagle: false, modal: false, hover: null, idle: 0 };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2(9, 9);
let pointerDirty = false;

// ---------- Etiquetas ----------
const labelsEl = $('#labels');
const labelItems = [];
function addLabel({ code, name, color, onClick, onHover, cls = '' }) {
  const el = document.createElement('div');
  el.className = 'nlabel ' + cls;
  el.style.setProperty('--c', color || '#00e5ff');
  el.innerHTML = `<div class="code">${code}</div><div class="nm">${name}</div><div class="tick"></div>`;
  el.addEventListener('click', onClick);
  el.addEventListener('pointerenter', () => onHover && onHover(true));
  el.addEventListener('pointerleave', () => onHover && onHover(false));
  labelsEl.appendChild(el);
  return el;
}
SERVICES.forEach((s, i) => {
  const el = addLabel({
    code: s.code, name: s.name, color: s.color,
    onClick: () => { sfx.init(); openNode(i); },
    onHover: (h) => { world.setNodeHover(h ? i : -1); if (h) sfx.hover(); },
  });
  labelItems.push({ el, i, pos: new THREE.Vector3() });
});
const coreLabel = addLabel({
  code: 'NÚCLEO', name: 'SYNAPTIC', cls: 'core', color: '#ffffff',
  onClick: () => openAbout(),
});

// ---------- UI / HUD ----------
const objList = $('#objList');
SERVICES.forEach((s) => {
  const li = document.createElement('li');
  li.textContent = s.name; li.style.setProperty('--c', s.color);
  objList.appendChild(li);
});

let toastTimer;
function toast(msg, gold = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('gold', gold);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

let lastPct = -1;
function refreshHud(rankUp = false) {
  $('#rankName').textContent = game.rank.name;
  $('#syncPct').textContent = game.pct + '%';
  $('#syncFill').style.width = game.pct + '%';
  $('#xp').textContent = game.xp;
  $('#fragCount').textContent = game.frags.size;
  [...objList.children].forEach((li, i) => {
    li.classList.toggle('done', game.visited.has(i));
    labelItems[i].el.classList.toggle('done', game.visited.has(i));
  });
  const v = game.visited.size, f = game.frags.size;
  $('#objSub').textContent = v < SERVICES.length
    ? `Explora los ${SERVICES.length} recuerdos de servicio (${v}/${SERVICES.length})`
    : f < CONFIG.fragments ? `Visión de Águila: caza los fragmentos (${f}/${CONFIG.fragments})` : 'Sincronización completa ✔';
  if (rankUp) { sfx.rank(); setTimeout(() => toast(`Rango: ${game.rank.name}`, true), 900); }
  lastPct = game.pct;
}

// ---------- Panel de servicio ----------
const panel = $('#panel');
function fillPanel(i) {
  const s = SERVICES[i];
  panel.style.setProperty('--c', s.color);
  $('#pCode').textContent = `${s.code} · RECUERDO DESBLOQUEADO`;
  $('#pName').textContent = s.name;
  $('#pTag').textContent = s.tagline;
  $('#pDesc').textContent = s.desc;
  $('#pItems').innerHTML = s.items.map((t, k) => `<li style="transition-delay:${0.35 + k * 0.08}s">${t}</li>`).join('');
  $('#pStack').innerHTML = s.stack.map((t) => `<span>${t}</span>`).join('');
  $('#pStats').innerHTML = Object.entries(s.stats).map(([k, v]) => `<div class="stat"><span>${k}</span><div class="bar"><i data-w="${v}"></i></div><b>${v}</b></div>`).join('');
  panel.scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => panel.querySelectorAll('.bar i').forEach((b) => (b.style.width = b.dataset.w + '%'))));
}

function focusCam(i) {
  const n = world.nodes[i];
  const right = new THREE.Vector3(Math.cos(n.angle), 0, -Math.sin(n.angle));
  const wide = innerWidth > 900;
  const target = n.group.position.clone().addScaledVector(right, wide ? 2.3 : 0);
  stage.flyTo({ theta: n.angle, phi: 0.09, radius: wide ? 10.5 : 12, target, dur: 1.7 });
}

let panelTimer;
function openNode(i) {
  if (!state.started || state.modal) return;
  if (state.mode === 'journey') { const h = scroller.scrollHeight - scroller.clientHeight; scroller.scrollTo({ top: h * ((i + 1) / (SERVICES.length + 1)), behavior: 'smooth' }); return; }
  const switching = state.focus >= 0;
  state.focus = i;
  sfx.click(); sfx.open();
  labelsEl.classList.add('off');
  $('#hint').classList.add('fade');
  world.setNodeHover(-1);
  focusCam(i);
  clearTimeout(panelTimer);
  if (switching) { panel.classList.remove('open'); }
  panelTimer = setTimeout(() => {
    fillPanel(i);
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    const first = !game.visited.has(i);
    const up = game.visit(i);
    refreshHud(up);
    if (first) toast(`+100 XP · ${SERVICES[i].name} sincronizado`);
  }, switching ? 700 : 1100);
}

function closePanel() {
  if (state.focus < 0) { if (panel.classList.contains('open')) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); state.detail = -1; } return; }
  clearTimeout(panelTimer);
  state.focus = -1;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  labelsEl.classList.remove('off');
  $('#hint').classList.remove('fade');
  sfx.close();
  stage.flyTo({ phi: 0.5, radius: 33, target: new THREE.Vector3(0, 1.5, 0), dur: 1.6 });
}

$('#panelClose').onclick = closePanel;
const curIdx = () => (state.focus >= 0 ? state.focus : state.detail);
const go = (d) => { const n = (curIdx() + d + SERVICES.length) % SERVICES.length; if (state.focus >= 0) openNode(n); else { state.detail = n; fillPanel(n); const up = game.visit(n); refreshHud(up); } };
$('#pPrev').onclick = () => go(-1);
$('#pNext').onclick = () => go(1);
$('#pCta').onclick = () => openContact(curIdx());

// ---------- Modales ----------
const modal = $('#modal'), modalBody = $('#modalBody');
function showModal(html) {
  modalBody.innerHTML = html;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  state.modal = true;
  sfx.open();
}
function closeModal() {
  if (!state.modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  state.modal = false;
  sfx.close();
}
$('#modalClose').onclick = closeModal;
modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeModal(); });

function openAbout() {
  if (!state.started) return;
  showModal(`
    <div class="eyebrow">// NÚCLEO · SYNAPTIC</div>
    <h2>Sincronizamos tu empresa con el futuro</h2>
    <p>Synaptic es una empresa de tecnología que construye producto digital, inteligencia artificial y experiencias inmersivas. Conectamos ideas con ingeniería —como las neuronas de una sinapsis— para que tu negocio responda más rápido, se vea extraordinario y escale sin límites.</p>
    <div class="kpis">
      <div class="kpi"><b>${SERVICES.length}</b><span>Líneas de servicio</span></div>
      <div class="kpi"><b>3D</b><span>Tiempo real</span></div>
      <div class="kpi"><b>24/7</b><span>Monitoreo</span></div>
      <div class="kpi"><b>100%</b><span>A tu medida</span></div>
    </div>
    <p>Trabajamos por misiones: entendemos tu objetivo, diseñamos la arquitectura, construimos en ciclos cortos y operamos contigo después del lanzamiento.</p>
    <div class="actions"><button class="btn-main" id="aboutCta">Iniciar misión →</button><button class="btn-ghost" id="aboutReset">Reiniciar progreso</button></div>
  `);
  $('#aboutCta').onclick = () => openContact(-1);
  $('#aboutReset').onclick = () => { game.reset(); world.fragments.forEach((f) => { f.collected = false; f.group.visible = true; }); refreshHud(); closeModal(); toast('Progreso reiniciado'); };
}

function openContact(idx) {
  if (!state.started) return;
  if (state.modal) closeModal();
  const opts = SERVICES.map((s, i) => `<option value="${s.name}" ${i === idx ? 'selected' : ''}>${s.name}</option>`).join('');
  showModal(`
    <div class="eyebrow">// NUEVA MISIÓN</div>
    <h2>Cuéntanos tu proyecto</h2>
    <p>Elige el servicio, descríbenos tu objetivo y te respondemos con una propuesta.</p>
    <form id="cForm">
      <div class="row">
        <label>NOMBRE<input name="n" required autocomplete="name" placeholder="Tu nombre" /></label>
        <label>CORREO<input name="e" type="email" required autocomplete="email" placeholder="tu@correo.com" /></label>
      </div>
      <label>SERVICIO<select name="s">${opts}<option>Otro / No estoy seguro</option></select></label>
      <label>MENSAJE<textarea name="m" required placeholder="¿Qué quieres construir?"></textarea></label>
      <div class="actions">
        <button class="btn-main" type="submit">Enviar misión ✦</button>
        ${CONFIG.whatsapp ? `<a class="btn-ghost" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.whatsapp}">WhatsApp</a>` : ''}
      </div>
    </form>
  `);
  $('#cForm').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = `Nombre: ${f.get('n')}\nCorreo: ${f.get('e')}\nServicio: ${f.get('s')}\n\n${f.get('m')}`;
    location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Nueva misión Synaptic · ' + f.get('s'))}&body=${encodeURIComponent(body)}`;
    toast('Abriendo tu correo…');
  };
}

function openComplete() {
  showModal(`
    <div class="reward">
      <div class="big">◈</div>
      <div class="eyebrow">// SINCRONIZACIÓN 100%</div>
      <h2>Leyenda del Animus</h2>
      <p>Recorriste los ${SERVICES.length} recuerdos y recuperaste los ${CONFIG.fragments} fragmentos. Ya conoces todo lo que Synaptic puede construir: ahora hagamos que tu proyecto sea el siguiente recuerdo.</p>
      <div class="actions" style="justify-content:center"><button class="btn-main" id="rwCta">Iniciar misión →</button></div>
    </div>`);
  $('#rwCta').onclick = () => openContact(-1);
}

$('#btnAbout').onclick = openAbout;
$('#btnContact').onclick = () => openContact(state.focus >= 0 ? state.focus : state.detail);

// ---------- Visión de Águila ----------
function setEagle(on) {
  if (!state.started || state.eagle === on) return;
  state.eagle = on;
  document.body.classList.toggle('eagle', on);
  $('#btnEagle').classList.toggle('on', on);
  sfx.eagle(on);
  const from = shared.uEagle.value, to = on ? 1 : 0;
  stage.tween({ from, to, dur: 0.9, ease: 'out', onUpdate: (k, v) => (shared.uEagle.value = v) });
  stage.bloom.strength = on ? 1.0 : 0.75;
  if (on) {
    const up = game.useEagle();
    refreshHud(up);
    const left = CONFIG.fragments - game.frags.size;
    toast(left ? `Visión de Águila · ${left} fragmentos por recuperar` : 'Visión de Águila activa', true);
    shared.uGlitch.value = 0.4;
  }
}
$('#btnEagle').onclick = () => { sfx.init(); setEagle(!state.eagle); };

// ---------- Sonido ----------
$('#btnMute').onclick = () => {
  sfx.init();
  sfx.setMuted(!sfx.muted);
  document.body.classList.toggle('muted', sfx.muted);
};

// ---------- Selección con el puntero ----------
function pick() {
  raycaster.setFromCamera(ndc, stage.camera);
  const targets = world.hitMeshes.slice();
  if (state.eagle) targets.push(...world.fragmentHits());
  const hit = raycaster.intersectObjects(targets, false)[0];
  return hit ? hit.object.userData : null;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('grabbing');
  state.idle = 0;
});
canvas.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  stage.rig.parallax.set(ndc.x, ndc.y);
  pointerDirty = true;
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (state.focus < 0 && !state.modal) {
      stage.rig.goal.theta -= dx * 0.0055;
      stage.rig.goal.phi = THREE.MathUtils.clamp(stage.rig.goal.phi + dy * 0.0045, -0.05, 1.25);
    }
  }
});
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('grabbing');
  const wasClick = drag && drag.moved < 8;
  drag = null;
  if (!wasClick || !state.started || state.modal) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const h = pick();
  if (!h) return;
  sfx.init();
  if (h.type === 'node' && state.focus < 0) openNode(h.index);
  else if (h.type === 'core' && state.focus < 0) openAbout();
  else if (h.type === 'fragment') collect(h.index);
});
canvas.addEventListener('wheel', (e) => {
  if (state.focus >= 0 || state.modal) return;
  e.preventDefault();
  stage.rig.goal.radius = THREE.MathUtils.clamp(stage.rig.goal.radius + e.deltaY * 0.02, 14, 50);
  state.idle = 0;
}, { passive: false });

function collect(i) {
  const p = world.collectFragment(i);
  if (!p) return;
  sfx.collect();
  const up = game.collect(i);
  refreshHud(up);
  stage.rig.shake = 0.12;
  shared.uGlitch.value = 0.35;
  const left = CONFIG.fragments - game.frags.size;
  toast(left ? `+50 XP · Fragmento recuperado (${game.frags.size}/${CONFIG.fragments})` : '¡Todos los fragmentos recuperados!', true);
  world.pulse();
  if (game.complete) setTimeout(openComplete, 1600);
}

// ---------- Teclado ----------
addEventListener('keydown', (e) => {
  if (e.target.matches && e.target.matches('input,textarea,select')) { if (e.key === 'Escape') closeModal(); return; }
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (state.modal) closeModal(); else closePanel(); }
  else if (k === 'e') setEagle(!state.eagle);
  else if (k === 'm') $('#btnMute').click();
  else if (/^[1-7]$/.test(k)) openNode(+k - 1);
  else if (k === 'arrowright' && curIdx() >= 0) $('#pNext').click();
  else if (k === 'arrowleft' && curIdx() >= 0) $('#pPrev').click();
});

// ---------- Radar ----------
const radar = $('#radar'), rctx = radar.getContext('2d');
function drawRadar(t) {
  const W = radar.width, c = W / 2, R = c - 8, sc = R / (RING_R + 4);
  rctx.clearRect(0, 0, W, W);
  rctx.strokeStyle = state.eagle ? 'rgba(255,200,61,.35)' : 'rgba(0,229,255,.3)';
  rctx.lineWidth = 2;
  [1, 0.66, 0.33].forEach((k) => { rctx.beginPath(); rctx.arc(c, c, R * k, 0, 7); rctx.stroke(); });
  rctx.beginPath(); rctx.moveTo(c, 8); rctx.lineTo(c, W - 8); rctx.moveTo(8, c); rctx.lineTo(W - 8, c); rctx.stroke();
  const th = stage.rig.cur.theta;
  const fx = -Math.sin(th), fz = -Math.cos(th), rx = Math.cos(th), rz = -Math.sin(th);
  // cono de visión
  rctx.fillStyle = state.eagle ? 'rgba(255,200,61,.14)' : 'rgba(0,229,255,.12)';
  rctx.beginPath(); rctx.moveTo(c, c); rctx.arc(c, c, R, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); rctx.fill();
  // barrido
  const sw = t * 1.6;
  const g = rctx.createConicGradient(sw, c, c);
  g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(0.9, 'rgba(0,229,255,0)'); g.addColorStop(1, 'rgba(0,229,255,.35)');
  rctx.fillStyle = g; rctx.beginPath(); rctx.arc(c, c, R, 0, 7); rctx.fill();
  const dot = (x, z, col, r) => {
    const sx = c + (x * rx + z * rz) * sc, sy = c - (x * fx + z * fz) * sc;
    rctx.fillStyle = col; rctx.shadowColor = col; rctx.shadowBlur = 10;
    rctx.beginPath(); rctx.arc(sx, sy, r, 0, 7); rctx.fill(); rctx.shadowBlur = 0;
  };
  dot(0, 0, '#fff', 6);
  world.nodes.forEach((n, i) => {
    const p = n.group.position;
    dot(p.x, p.z, SERVICES[i].color, game.visited.has(i) ? 8 : 5.5);
    if (i === state.focus) { rctx.strokeStyle = '#fff'; rctx.lineWidth = 2; rctx.beginPath(); rctx.arc(c + (p.x * rx + p.z * rz) * sc, c - (p.x * fx + p.z * fz) * sc, 12, 0, 7); rctx.stroke(); }
  });
  if (state.eagle) world.fragments.forEach((f) => { if (!f.collected) dot(f.base.x, f.base.z, '#ffc83d', 4); });
  rctx.fillStyle = '#fff';
  rctx.beginPath(); rctx.moveTo(c, c - 9); rctx.lineTo(c + 6, c + 6); rctx.lineTo(c - 6, c + 6); rctx.fill();
}

// ---------- Etiquetas: proyección ----------
const tmp = new THREE.Vector3();
function updateLabels() {
  if (labelsEl.classList.contains('off')) return;
  const w = innerWidth, h = innerHeight;
  const camPos = stage.camera.position;
  const place = (el, v) => {
    const dist = v.distanceTo(camPos);
    tmp.copy(v).project(stage.camera);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.2 || Math.abs(tmp.y) > 1.2) { el.style.display = 'none'; return; }
    el.style.display = '';
    // Profundidad: lo cercano grande y nítido, lo lejano pequeño y tenue
    const k = THREE.MathUtils.clamp(36 / dist, 0.55, 1.1);
    el.style.opacity = THREE.MathUtils.clamp((k - 0.5) * 2.4, 0.35, 1);
    el.style.zIndex = Math.round(1000 - dist * 10);
    el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${k})`;
  };
  labelItems.forEach(({ el, i }) => {
    tmp.copy(world.nodes[i].group.position); tmp.y += 2.9;
    place(el, tmp.clone());
    el.classList.toggle('hov', state.hover && state.hover.type === 'node' && state.hover.index === i);
  });
  const cp = world.core.position.clone(); cp.y += 3.4;
  place(coreLabel, cp);
}

// ---------- Modo Viaje (scroll cinematográfico) ----------
const scroller = $('#scroller'), story = $('#story'), progressEl = $('#progress');
const chapters = [];
{
  const mk = (cls, color, html) => {
    const sec = document.createElement('section');
    sec.className = 'chap';
    sec.innerHTML = `<div class="chap-in ${cls}" style="--c:${color}">${html}</div>`;
    story.appendChild(sec);
    chapters.push(sec.firstElementChild);
  };
  mk('hero', '#00e5ff', `<div class="ey">// SYNAPTIC · ANIMUS</div><h2>Tu empresa, sincronizada con el futuro.</h2><p>Tecnología, inteligencia artificial y experiencias 3D. Desliza para viajar por nuestros siete recuerdos.</p><div class="scrollhint">▼ DESLIZA PARA VIAJAR</div>`);
  SERVICES.forEach((s, i) => {
    mk('', s.color, `<div class="ey">${s.code} · ${String(i + 1).padStart(2, '0')}/${String(SERVICES.length).padStart(2, '0')}</div><h2>${s.name}</h2><p>${s.tagline} ${s.desc.split('. ')[0]}.</p><div class="row"><button class="btn-main" data-detail="${i}" style="background:${s.color}">Ver detalle</button><button class="btn-ghost" data-contact="${i}">Cotizar</button></div>`);
  });
  mk('hero', '#ffc83d', `<div class="ey">// MISIÓN FINAL</div><h2>El siguiente recuerdo es tu proyecto.</h2><p>Cuéntanos qué quieres construir, o explora el mundo libremente y caza los fragmentos ocultos.</p><div class="row"><button class="btn-main" data-contact="-1">Iniciar misión →</button><button class="btn-ghost" data-free="1">Explorar en modo libre</button></div>`);
}
story.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  sfx.init(); sfx.click();
  if (b.dataset.detail !== undefined) openDetail(+b.dataset.detail);
  else if (b.dataset.contact !== undefined) openContact(+b.dataset.contact);
  else if (b.dataset.free) setMode('free');
});

function openDetail(i) {
  state.detail = i;
  fillPanel(i);
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  const first = !game.visited.has(i);
  const up = game.visit(i);
  refreshHud(up);
  if (first) toast(`+100 XP · ${SERVICES[i].name} sincronizado`);
}

const camTarget = (i) => {
  const n = world.nodes[i];
  const right = new THREE.Vector3(Math.cos(n.angle), 0, -Math.sin(n.angle));
  return { theta: n.angle, phi: 0.12, radius: innerWidth > 900 ? 10.5 : 13, target: n.group.position.clone().addScaledVector(right, innerWidth > 900 ? 2.4 : 0) };
};
const stops = () => [
  { theta: 0.3, phi: 0.5, radius: 33, target: new THREE.Vector3(0, 1.5, 0) },
  ...SERVICES.map((_, i) => camTarget(i)),
  { theta: 0.3 + Math.PI * 2, phi: 0.75, radius: 40, target: new THREE.Vector3(0, 1.5, 0) },
];
let smoothP = 0;
function journeyCam(dt, t) {
  const max = scroller.scrollHeight - scroller.clientHeight;
  const p = max > 0 ? scroller.scrollTop / max : 0;
  smoothP += (p - smoothP) * (1 - Math.exp(-dt * 5));
  const S = stops(), n = S.length - 1, x = smoothP * n;
  const i = Math.min(n - 1, Math.floor(x));
  let f = x - i; f = f * f * (3 - 2 * f);
  const a = S[i], b = S[i + 1], g = stage.rig.goal;
  let th = a.theta + (b.theta - a.theta + Math.round(0) ) * 0;
  const d = Math.atan2(Math.sin(b.theta - a.theta), Math.cos(b.theta - a.theta));
  th = a.theta + d * f + Math.sin(t * 0.25) * 0.05;
  th += Math.round((g.theta - th) / (Math.PI * 2)) * Math.PI * 2;
  g.theta = th;
  g.phi = a.phi + (b.phi - a.phi) * f;
  g.radius = a.radius + (b.radius - a.radius) * f;
  g.tx = a.target.x + (b.target.x - a.target.x) * f;
  g.ty = a.target.y + (b.target.y - a.target.y) * f;
  g.tz = a.target.z + (b.target.z - a.target.z) * f;
  chapters.forEach((c, k) => {
    const o = Math.max(0, Math.min(1, 1.15 - Math.abs(x - k) * 2.1));
    c.style.setProperty('--o', o.toFixed(3));
  });
  const near = Math.round(x);
  if (near >= 1 && near <= SERVICES.length && Math.abs(x - near) < 0.12 && !game.visited.has(near - 1)) {
    const up = game.visit(near - 1); refreshHud(up); toast(`+100 XP · ${SERVICES[near - 1].name} sincronizado`);
  }
  $('#progressFill').style.height = (smoothP * 100) + '%';
}

function setMode(m) {
  if (state.mode === m) return;
  state.mode = m;
  const journey = m === 'journey';
  scroller.classList.toggle('hidden', !journey);
  progressEl.classList.toggle('hidden', !journey);
  labelsEl.classList.toggle('off', journey);
  $('#hint').classList.toggle('fade', journey);
  $('#modeLbl').textContent = journey ? 'Modo Libre' : 'Viaje';
  if (panel.classList.contains('open')) { panel.classList.remove('open'); state.detail = -1; }
  if (!journey) {
    state.focus = -1; state.idle = 0;
    stage.flyTo({ phi: 0.5, radius: 33, target: new THREE.Vector3(0, 1.5, 0), dur: 1.8 });
    toast('Modo libre · arrastra, explora y pulsa [E]');
  } else {
    scroller.scrollTop = 0; smoothP = 0;
    toast('Modo viaje · desliza para recorrer');
  }
}
$('#btnMode').onclick = () => { sfx.init(); setMode(state.mode === 'journey' ? 'free' : 'journey'); };

// Loader ASCII
{
  const el = $('#ascii'), chars = '-=+.';
  setInterval(() => { el.textContent = Array.from({ length: 10 }, () => chars[(Math.random() * chars.length) | 0]).join(''); }, 90);
}

// ---------- Inicio ----------
startBtn.onclick = () => {
  sfx.init(); sfx.boot();
  $('#boot').classList.add('out');
  $('#flash').classList.add('go');
  $('#hud').classList.remove('hidden');
  state.started = true;
  refreshHud();
  stage.tween({ from: 0, to: 1, dur: 3.2, ease: 'inOut', onUpdate: (k, v) => (shared.uReveal.value = v) });
  stage.flyTo({ theta: stage.rig.goal.theta + 1.2, phi: 0.5, radius: 33, target: new THREE.Vector3(0, 1.5, 0), dur: 5, fovKick: 25 });
  setTimeout(() => { state.introDone = true; setMode('journey'); }, 5200);
  setTimeout(() => toast('Bienvenido al Animus · Toca un recuerdo para sincronizar'), 2500);
  setTimeout(() => { if (!game.eagleUsed) toast('Pulsa [E] — Visión de Águila: fragmentos ocultos', true); }, 8500);
};

// ---------- Bucle principal ----------
let last = performance.now(), t = 0, slow = 0, lowered = false, hoverKey = '';
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  shared.uTime.value = t;

  // Rotación automática en reposo
  if (state.mode === 'journey' && state.introDone) journeyCam(dt, t);
  else if (state.started && state.focus < 0 && !state.modal && !drag) {
    state.idle += dt;
    if (state.idle > 2.5) stage.rig.goal.theta += dt * 0.045;
  } else if (!state.started) {
    stage.rig.goal.theta += dt * 0.03;
  }

  // Hover
  if (pointerDirty && state.started && !drag && !state.modal) {
    pointerDirty = false;
    const h = state.focus < 0 || state.eagle ? pick() : null;
    const key = h ? h.type + (h.index ?? '') : '';
    if (key !== hoverKey) {
      hoverKey = key; state.hover = h;
      world.setNodeHover(h && h.type === 'node' ? h.index : -1);
      canvas.classList.toggle('pointer', !!h);
      if (h) sfx.hover();
    }
  }

  stage.update(dt);
  world.update(t, dt, state.eagle);
  if (state.started) { updateLabels(); drawRadar(t); }
  stage.render();

  // Calidad adaptativa
  if (!lowered) {
    slow = dt > 1 / 28 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 3 && state.started) {
      lowered = true;
      stage.dpr = 1; shared.uPx.value = 1;
      stage.renderer.setPixelRatio(1); stage.composer.setPixelRatio(1); stage.resize();
      stage.bloom.strength = 0.6;
    }
  }
}
requestAnimationFrame(frame);

// Exponer para depuración
window.__synaptic = { stage, world, game, state, openNode };
