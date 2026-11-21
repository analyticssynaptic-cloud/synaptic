import './style.css';
import * as THREE from 'three';
import { Stage } from './stage.js';
import { World, RING_R } from './world.js';
import { Game } from './game.js';
import { Chip, EXP_Y } from './chip.js';
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
  if (state.mode === 'journey') { const h = scroller.scrollHeight - scroller.clientHeight; scroller.scrollTo({ top: h * ((order.indexOf(i) + 1) / (SERVICES.length + 1)), behavior: 'smooth' }); return; }
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
  if (on && state.mode === 'journey') { toast('La Visión de Águila es del Modo Libre'); return; }
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

// ---------- Modo Viaje: anatomía de un chip ----------
const scroller = $('#scroller'), story = $('#story'), progressEl = $('#progress');
// Capas de arriba hacia abajo ↔ servicios
const LAYER_SERVICE = ['cyber', 'cloud', 'web', 'ia', 'arvr', 'iot', 'apps'];
const LAYER_NAME = ['Blindaje superior', 'Disipación térmica', 'Cristal óptico', 'Núcleo de silicio', 'Cristal de proyección', 'Placa de circuitos', 'Plataforma base'];
const order = LAYER_SERVICE.map((id) => SERVICES.findIndex((s) => s.id === id));
const chip = new Chip(stage.scene, stage.renderer, order.map((i) => SERVICES[i].color));
const chapters = [];
{
  const mk = (cls, color, html, side = '') => {
    const sec = document.createElement('section');
    sec.className = 'chap ' + side;
    sec.innerHTML = `<div class="chap-in ${cls}" style="--c:${color}">${html}</div>`;
    story.appendChild(sec);
    chapters.push(sec.firstElementChild);
  };
  mk('hero', '#7fe8ff', `<div class="ey">// SYNAPTIC · ANATOMÍA DE UN CHIP</div><h2>Descomponemos la tecnología para construir tu futuro.</h2><p>Siete capas. Siete servicios. Desliza y mira cómo se despliega por dentro.</p><div class="scrollhint">▼ DESLIZA PARA DESCOMPONER</div>`, 'L');
  order.forEach((si, k) => {
    const s = SERVICES[si];
    mk('', s.color,
      `<div class="ey">CAPA ${String(k + 1).padStart(2, '0')}/07 · ${LAYER_NAME[k].toUpperCase()}</div><h2>${s.name}</h2><p>${s.tagline} ${s.desc.split('. ')[0]}.</p><ul class="mini">${s.items.slice(0, 3).map((t) => `<li>${t}</li>`).join('')}</ul><div class="row"><button class="btn-main" data-detail="${si}" style="background:${s.color}">Ver detalle</button><button class="btn-ghost" data-contact="${si}">Cotizar</button></div>`,
      k % 2 ? 'L' : '');
  });
  mk('hero', '#ffc83d', `<div class="ey">// ENSAMBLAJE COMPLETO</div><h2>El siguiente chip es tu proyecto.</h2><p>Cuéntanos qué quieres construir, o entra al modo libre y explora el Animus.</p><div class="row"><button class="btn-main" data-contact="-1">Iniciar misión →</button><button class="btn-ghost" data-free="1">Explorar en modo libre</button></div>`, 'L');
}
// Navegación por puntos
progressEl.innerHTML = '';
chapters.forEach((_, k) => {
  const b = document.createElement('button');
  b.className = 'dot';
  b.title = k === 0 ? 'Inicio' : k === chapters.length - 1 ? 'Contacto' : LAYER_NAME[k - 1];
  b.onclick = () => { const h = scroller.scrollHeight - scroller.clientHeight; scroller.scrollTo({ top: (h * k) / (chapters.length - 1), behavior: 'smooth' }); };
  progressEl.appendChild(b);
});
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

// Ángulos de cámara por capa (rotación del chip en varios ángulos)
const CAM = [{ t: 0.55, p: 0.42 }, { t: -0.85, p: 0.18 }, { t: 1.35, p: 0.62 }, { t: -0.25, p: 0.28 }, { t: 2.3, p: 0.5 }, { t: -1.6, p: 0.14 }, { t: 0.95, p: 0.72 }];
const stops = () => {
  const wide = innerWidth > 900;
  const hr = (th, sh) => ({ tx: Math.cos(th) * sh, tz: -Math.sin(th) * sh });
  const S = [{ theta: -0.7, phi: 0.4, radius: wide ? 17 : 24, ty: 2.8, e: 0, ...hr(-0.7, wide ? -3.6 : 0) }];
  order.forEach((_, k) => {
    const c = CAM[k];
    const sh = wide ? (k % 2 ? -2.1 : 2.1) : 0; // texto a un lado, chip al otro
    S.push({ theta: c.t, phi: c.p, radius: wide ? 14 : 17, tx: Math.cos(c.t) * sh, ty: EXP_Y[k], tz: -Math.sin(c.t) * sh, e: 1 });
  });
  S.push({ theta: Math.PI * 2 - 0.5, phi: 0.5, radius: wide ? 19 : 27, ty: 3.4, e: 0.15, ...hr(Math.PI * 2 - 0.5, wide ? -3.6 : 0) });
  return S;
};
// Anotaciones HUD alrededor de la capa activa (estilo visor técnico)
const NS = 'http://www.w3.org/2000/svg';
const annot = document.createElementNS(NS, 'svg'); annot.id = 'annot';
const mkEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); annot.appendChild(e); return e; };
const aPoly = mkEl('polygon', { class: 'a-line', fill: 'none' });
const aLead = mkEl('polyline', { class: 'a-line', fill: 'none' });
const aUnder = mkEl('line', { class: 'a-line' });
const aT1 = mkEl('text', { class: 'a-txt big' }), aT2 = mkEl('text', { class: 'a-txt big' });
const aDat = mkEl('text', { class: 'a-txt' }), aCta = mkEl('text', { class: 'a-txt' }), aCta2 = mkEl('line', { class: 'a-line' });
const aDots = Array.from({ length: 5 }, () => mkEl('circle', { r: 2.2, class: 'a-dot' }));
document.body.appendChild(annot);
const aPos = new THREE.Vector3();
const PT = [[-1.0, -0.55], [0.15, -1.05], [1.15, -0.3], [0.85, 0.85], [-0.75, 0.95]];
function updateAnnot(x, t) {
  const k = Math.max(0, Math.min(order.length - 1, Math.round(x - 1)));
  const L = chip.layers[k], hl = x >= 0.5 && x <= order.length + 0.5 ? L.hl : 0;
  annot.style.opacity = hl.toFixed(2);
  if (hl < 0.02 || innerWidth < 900) return;
  L.g.getWorldPosition(aPos);
  const dist = aPos.distanceTo(stage.camera.position);
  const s = innerHeight / (2 * dist * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)));
  aPos.project(stage.camera);
  const cx = (aPos.x * 0.5 + 0.5) * innerWidth, cy = (-aPos.y * 0.5 + 0.5) * innerHeight, R = 2.7 * s;
  const rot = Math.sin(t * 0.3) * 0.06, cr = Math.cos(rot), sr = Math.sin(rot);
  const pts = PT.map(([px, py]) => [cx + (px * cr - py * sr) * R, cy + (px * sr + py * cr) * R]);
  aPoly.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
  pts.forEach((p, i) => { aDots[i].setAttribute('cx', p[0]); aDots[i].setAttribute('cy', p[1]); });
  const side = k % 2 ? 1 : -1;
  const ax = pts[1][0], ay = pts[1][1];
  const lx = Math.max(150, Math.min(innerWidth - 330, ax + side * R * 0.6 + (side > 0 ? 40 : -230)));
  const ly = Math.max(140, ay - 38);
  aLead.setAttribute('points', `${ax},${ay} ${ax + side * 28},${ly + 6} ${lx + (side > 0 ? 0 : 190)},${ly + 6}`);
  aUnder.setAttribute('x1', lx); aUnder.setAttribute('x2', lx + 190); aUnder.setAttribute('y1', ly + 6); aUnder.setAttribute('y2', ly + 6);
  aT1.setAttribute('x', lx); aT1.setAttribute('y', ly - 16); aT1.textContent = `CAPA_${String(k + 1).padStart(2, '0')} · ${LAYER_NAME[k].toUpperCase()}`;
  aT2.setAttribute('x', lx); aT2.setAttribute('y', ly - 2); aT2.textContent = SERVICES[order[k]].name.toUpperCase();
  const bx = pts[3][0] + 14, by = pts[3][1] + 26;
  aDat.setAttribute('x', bx); aDat.setAttribute('y', by);
  aDat.textContent = `TEMP ${(30 + k * 2.1 + Math.sin(t * 1.3) * 1.4).toFixed(2)}  +0${(1 + Math.abs(Math.sin(t * 0.7 + k))).toFixed(2)}`;
  aCta.setAttribute('x', bx); aCta.setAttribute('y', by + 18); aCta.textContent = 'ID ' + (SERVICES[order[k]].code) + ' // VER DETALLE ▸';
  aCta2.setAttribute('x1', bx); aCta2.setAttribute('x2', bx + 190); aCta2.setAttribute('y1', by + 24); aCta2.setAttribute('y2', by + 24);
}

let smoothP = 0, introT = 0, prevP = 0, lastNear = -1;
function journeyCam(dt, t) {
  const max = scroller.scrollHeight - scroller.clientHeight;
  const p = max > 0 ? scroller.scrollTop / max : 0;
  smoothP += (p - smoothP) * (1 - Math.exp(-dt * 5));
  const S = stops(), n = S.length - 1, x = smoothP * n;
  const i = Math.min(n - 1, Math.floor(x));
  let f = x - i; f = f * f * (3 - 2 * f);
  const a = S[i], b = S[i + 1], g = stage.rig.goal;
  const d = Math.atan2(Math.sin(b.theta - a.theta), Math.cos(b.theta - a.theta));
  let th = a.theta + d * f + Math.sin(t * 0.25) * 0.04;
  th += Math.round((g.theta - th) / (Math.PI * 2)) * Math.PI * 2;
  g.theta = th;
  g.phi = a.phi + (b.phi - a.phi) * f;
  g.radius = a.radius + (b.radius - a.radius) * f;
  g.tx = a.tx + (b.tx - a.tx) * f; g.ty = a.ty + (b.ty - a.ty) * f; g.tz = a.tz + (b.tz - a.tz) * f;
  // Entrada cinematográfica
  if (introT < 4) { introT += dt; const k = Math.pow(1 - introT / 4, 2); g.radius += k * 26; stage.fovGoal = 55 + k * 22; }
  chip.setState(a.e + (b.e - a.e) * f, x);
  updateAnnot(x, t);
  sfx.setWhir(Math.abs(smoothP - prevP) / Math.max(dt, 0.001) * 0.6); prevP = smoothP;
  chapters.forEach((c, k) => c.style.setProperty('--o', Math.max(0, Math.min(1, 1.15 - Math.abs(x - k) * 2.1)).toFixed(3)));
  const near = Math.round(x);
  [...progressEl.children].forEach((d, k) => d.classList.toggle('on', k === near));
  if (near !== lastNear && Math.abs(x - near) < 0.2) { if (lastNear >= 0) sfx.lock(); lastNear = near; }
  if (near >= 1 && near <= order.length && Math.abs(x - near) < 0.12 && !game.visited.has(order[near - 1])) {
    const up = game.visit(order[near - 1]); refreshHud(up); toast(`+100 XP · ${SERVICES[order[near - 1]].name} sincronizado`);
  }
}

function setMode(m) {
  if (state.mode === m) return;
  state.mode = m;
  const journey = m === 'journey';
  scroller.classList.toggle('hidden', !journey);
  progressEl.classList.toggle('hidden', !journey);
  labelsEl.classList.toggle('off', journey);
  document.body.classList.toggle('journey', journey);
  $('#modeLbl').textContent = journey ? 'Modo Libre' : 'Viaje';
  chip.group.visible = journey;
  annot.style.display = journey ? '' : 'none';
  sfx.cyberOff = !journey && false;
  world.root.visible = !journey;
  stage.scene.background = new THREE.Color(journey ? 0x1d222a : 0x01030a);
  stage.renderer.toneMapping = journey ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  stage.renderer.toneMappingExposure = 1.05;
  if (journey) { stage.bloom.strength = 0.42; stage.bloom.radius = 0.55; stage.bloom.threshold = 0.72; if (state.eagle) setEagle(false); }
  else { stage.bloom.strength = 0.75; stage.bloom.radius = 0.5; stage.bloom.threshold = 0.2; }
  if (panel.classList.contains('open')) { panel.classList.remove('open'); state.detail = -1; }
  if (!journey) {
    state.focus = -1; state.idle = 0;
    if (shared.uReveal.value < 1) stage.tween({ from: shared.uReveal.value, to: 1, dur: 1.6, ease: 'out', onUpdate: (k, v) => (shared.uReveal.value = v) });
    stage.fovGoal = 55;
    stage.flyTo({ phi: 0.5, radius: 33, target: new THREE.Vector3(0, 1.5, 0), dur: 1.8 });
    toast('Modo libre · arrastra, explora y pulsa [E]');
  } else {
    scroller.scrollTop = 0; smoothP = 0; introT = 0;
    toast('Modo viaje · desliza para descomponer el chip');
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
  state.introDone = true;
  setMode('journey');
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
  if (state.mode === 'journey') chip.update(t, dt); else world.update(t, dt, state.eagle);
  if (state.started) { updateLabels(); drawRadar(t); }
  stage.render();

  // Calidad adaptativa
  if (!lowered) {
    slow = dt > 1 / 28 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 3 && state.started) {
      lowered = true;
      stage.dpr = 1; shared.uPx.value = 1;
      stage.renderer.setPixelRatio(1); stage.composer.setPixelRatio(1); stage.resize();
      stage.bloom.strength = Math.min(stage.bloom.strength, 0.5);
    }
  }
}
requestAnimationFrame(frame);

// Exponer para depuración
window.__synaptic = { stage, world, game, state, openNode, chip, skipIntro: () => { introT = 4; } };
