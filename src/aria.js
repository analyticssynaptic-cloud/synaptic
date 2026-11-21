import { CONFIG, SERVICES } from './services.js';
import { createHolo } from './ariaHolo.js';

const $ = (s) => document.querySelector(s);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const BASE = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');

// Frases que terminan mostrando el número (no se dicta en voz)
const PHONE_IDS = new Set(['ch8', 'gracias', 'precio', 'contacto', 'ubicacion', 'fallback']);
const CHIPS = [['¿Qué servicios ofrecen?', 'servicios'], ['¿Cómo trabajan?', 'proceso'], ['¿Cuánto cuesta?', 'precio'], ['¿Cómo los contacto?', 'contacto']];

// Preguntas → id de frase grabada (+ servicio que se muestra en el chip)
const KB = [
  { id: 'saludo', k: ['hola', 'buenas', 'hey', 'saludos', 'buenos dias', 'buenas tardes', 'buenas noches'] },
  { id: 'gracias', k: ['gracias', 'perfecto', 'genial', 'excelente', 'listo', 'chevere'] },
  { id: 'quien', k: ['quien eres', 'tu nombre', 'como te llamas', 'aria', 'eres una', 'que eres'] },
  { id: 'empresa', k: ['quienes son', 'que es synaptic', 'empresa', 'compania', 'a que se dedican', 'que hacen', 'sobre ustedes', 'nosotros'] },
  { id: 'servicios', k: ['servicio', 'ofrecen', 'soluciones', 'catalogo', 'que venden', 'portafolio'] },
  { id: 's_web', svc: 'web', k: ['web', 'pagina', 'sitio', 'tienda', 'ecommerce', 'landing', 'webgl', '3d'] },
  { id: 's_apps', svc: 'apps', k: ['app', 'movil', 'celular', 'aplicacion', 'software', 'sistema', 'erp', 'crm', 'inventario'] },
  { id: 's_ia', svc: 'ia', k: ['ia', 'inteligencia', 'artificial', 'chatbot', 'agente', 'bot', 'automatiz', 'whatsapp', 'gpt'] },
  { id: 's_cyber', svc: 'cyber', k: ['segur', 'hack', 'ataque', 'pentest', 'ciber', 'proteg', 'vulnerab', 'phishing'] },
  { id: 's_cloud', svc: 'cloud', k: ['nube', 'cloud', 'aws', 'azure', 'servidor', 'devops', 'migrac', 'kubernetes', 'hosting'] },
  { id: 's_iot', svc: 'iot', k: ['iot', 'sensor', 'domotica', 'dispositivo', 'industrial', 'telemetria', 'internet de las cosas'] },
  { id: 's_arvr', svc: 'arvr', k: ['realidad', 'virtual', 'aumentada', 'vr', 'showroom', 'xr', 'simulador', 'metaverso'] },
  { id: 'proceso', k: ['como trabajan', 'proceso', 'metodologia', 'etapas', 'pasos', 'como funciona'] },
  { id: 'precio', k: ['cuanto cuesta', 'cuanto vale', 'precio', 'costo', 'valor', 'presupuesto', 'cotiz', 'tarifa', 'cobran'] },
  { id: 'tiempo', k: ['cuanto demora', 'tiempo', 'plazo', 'demora', 'entrega', 'tardan', 'cuanto tarda'] },
  { id: 'contacto', k: ['contact', 'whatsapp', 'telefono', 'llamar', 'numero', 'escribir', 'hablar con', 'reunion', 'cita', 'asesor'] },
  { id: 'tecno', k: ['tecnolog', 'stack', 'herramient', 'lenguaje', 'framework', 'programan'] },
  { id: 'soporte', k: ['soporte', 'mantenimiento', 'garantia', 'despues', 'postventa'] },
  { id: 'ubicacion', k: ['donde', 'ubicad', 'ciudad', 'pais', 'direccion', 'oficina', 'sede'] },
];

export function createAria({ sfx, order, state, scroller, layerScreen, openContact, goChapter, activeLayer }) {
  const el = $('#aria'), bubble = $('#ariaBubble'), textEl = $('#ariaText'), face = $('#ariaFace'), talk = $('#ariaTalk');
  const act = $('#ariaAct'), chipsEl = $('#ariaChips'), form = $('#ariaForm'), input = $('#ariaQ'), muteBtn = $('#ariaMute'), replayBtn = $('#ariaVoice');
  const wrap = el.querySelector('.aria-wrap');

  let voiceOn = true; try { voiceOn = localStorage.getItem('synaptic.ariaVoice') !== '0'; } catch (e) { /* ok */ }
  let man = null; const manReady = fetch(BASE + 'aria/voice/manifest.json?v=' + __BUILD__).then((r) => r.json()).then((m) => (man = m)).catch(() => (man = {}));

  // ---------- Una sola salida de voz, analizada para mover la boca ----------
  const voiceEl = new Audio(); voiceEl.preload = 'auto';
  let analyser = null, buf = null, srcNode = null;
  const hookAudio = () => {
    if (srcNode || !sfx.ctx) return;
    try {
      srcNode = sfx.ctx.createMediaElementSource(voiceEl);
      analyser = sfx.ctx.createAnalyser(); analyser.fftSize = 512; buf = new Uint8Array(analyser.fftSize);
      srcNode.connect(analyser); analyser.connect(sfx.master);
    } catch (e) { srcNode = null; analyser = null; }
  };

  let cur = null, speaking = false, wi = 0, env = 0, nod = 0, mouth = 0, holdUntil = 0, idx = -1, settle = 0, lastGreet = -1e9;
  let pointK = -1, pointT = 0, gestureT = 7, ry = 0, rx = 0, mx = innerWidth / 2, my = innerHeight / 2;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  // ---------- Texto con karaoke exacto (tiempos de la voz) ----------
  let spans = [];
  function render(text, done) {
    spans = []; textEl.innerHTML = '';
    let pos = 0;
    text.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { textEl.appendChild(document.createTextNode(tok)); pos += tok.length; return; }
      const s = document.createElement('span'); s.className = 'w' + (done ? ' said' : ''); s.textContent = tok;
      textEl.appendChild(s); spans.push({ s, start: pos }); pos += tok.length;
    });
  }
  const mark = (ci) => spans.forEach((w) => { if (w.start < ci) w.s.classList.add('said'); });

  function showPhone(id) {
    act.innerHTML = '';
    if (!PHONE_IDS.has(id)) return;
    const wa = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent('Hola Synaptic, vengo de la página y quiero más información.')}`;
    act.innerHTML = `<a class="aria-phone" href="${wa}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 7.5c.3-.6.6-.6 1-.6l.6.1 1 2.3-.6.8c.6 1.3 1.6 2.3 2.9 2.9l.8-.6 2.3 1-.1.7c0 .4-.3.9-.7 1.1-1 .5-2.6.2-4.4-1.2s-3.4-3.6-3.3-4.8c0-.4.2-.9.5-1.2z" fill="currentColor"/></svg>${CONFIG.phone}</a><button class="aria-btn" type="button">Escribir ahora</button>`;
    act.querySelector('button').onclick = () => window.open(wa, '_blank', 'noopener');
  }

  function stop() {
    clearTimeout(settle);
    voiceEl.pause();
    if (speaking) { speaking = false; el.classList.remove('talking'); sfx.duck && sfx.duck(false); }
  }

  async function play(id, { onEnd } = {}) {
    stop();
    await manReady;
    const entry = man && man[id];
    if (!entry) { onEnd && onEnd(); return; }
    render(entry.text, !voiceOn);
    showPhone(id);
    if (!voiceOn) { onEnd && onEnd(); return; }
    // Posición en el texto donde termina cada palabra dicha
    let c = 0;
    const marks = entry.words.map(([s, e, w]) => { const p = entry.text.indexOf(w, c); if (p >= 0) c = p + w.length; return { s, e, end: c }; });
    cur = { id, entry, marks, onEnd }; wi = 0;
    hookAudio();
    if (sfx.ctx && sfx.ctx.state === 'suspended') sfx.ctx.resume();
    voiceEl.src = `${BASE}aria/voice/${id}.mp3?v=${__BUILD__}`;
    voiceEl.currentTime = 0;
    try { await voiceEl.play(); } catch (e) { render(entry.text, true); onEnd && onEnd(); return; }
    speaking = true; el.classList.add('talking'); sfx.duck && sfx.duck(true);
  }
  voiceEl.addEventListener('ended', () => {
    if (!cur) return;
    mark(1e9); speaking = false; el.classList.remove('talking'); sfx.duck && sfx.duck(false);
    const cb = cur.onEnd; cur = null; cb && cb();
  });

  // ---------- Narración por capítulo ----------
  function say(i) {
    if (i === idx) return;
    if (performance.now() < holdUntil) { idx = i; return; }
    idx = i;
    const textLeft = i === 0 || i === 8 || (i - 1) % 2 === 1;
    el.classList.toggle('pos-r', textLeft); el.classList.toggle('pos-l', !textLeft);
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    stop();
    manReady.then(() => { if (idx === i && man[`ch${i}`]) { render(man[`ch${i}`].text, !voiceOn); showPhone(`ch${i}`); } });
    settle = setTimeout(() => {
      if (state.mode !== 'journey' || idx !== i || $('#ariaBody').classList.contains('on')) return;
      play(`ch${i}`);
      if (i >= 1 && i <= 7) { setTimeout(() => idx === i && point(i - 1, 5), 700); setTimeout(() => idx === i && point(i - 1, 4), 6000); }
    }, 900);
  }

  // ---------- Preguntas ----------
  const history = [];
  const showSvc = (svc) => {
    const ch = order.indexOf(SERVICES.findIndex((s) => s.id === svc)) + 1;
    if (ch > 0) setTimeout(() => goChapter(ch), 700);
  };
  // Respuesta libre con Groq (vía el intermediario seguro, la clave no vive en la página)
  async function askAI(q) {
    stop(); act.innerHTML = '';
    textEl.innerHTML = '<span class="aria-typing"><i></i><i></i><i></i></span>';
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(CONFIG.ariaApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, history: history.slice(-6) }), signal: ctrl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('http ' + r.status);
      const { answer, tag } = await r.json();
      if (!answer) throw new Error('vacía');
      history.push({ role: 'user', content: q }, { role: 'assistant', content: answer });
      render(answer, false);
      let k = 0; const ws = textEl.querySelectorAll('.w');
      const tmr = setInterval(() => { if (k >= ws.length) return clearInterval(tmr); ws[k++].classList.add('said'); }, 55);
      if (tag === 'contacto') showPhone('contacto');
      else if (tag && tag.startsWith('svc:')) showSvc(tag.slice(4));
      return true;
    } catch (e) { return false; }
  }
  async function ask(q) {
    q = q.trim(); if (!q) return;
    const n = ' ' + norm(q) + ' ';
    let best = null, bs = 0;
    KB.forEach((e) => { let s = 0; e.k.forEach((kw) => { const k = norm(kw); if (n.includes(' ' + k) || (k.length > 3 && n.includes(k))) s += k.length > 4 ? 2 : 1; }); if (s > bs) { bs = s; best = e; } });
    holdUntil = performance.now() + 15000;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    // Preguntas conocidas: respuesta con su voz grabada. El resto: Groq (si está configurado).
    const known = best && (bs >= 2 || (bs >= 1 && n.trim().split(' ').length <= 4));
    if (!known && CONFIG.ariaApi && (await askAI(q))) return;
    const entry = best && bs >= 1 ? best : { id: 'fallback' };
    play(entry.id);
    if (entry.svc) showSvc(entry.svc);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; sfx.init(); ask(q); });
  CHIPS.forEach(([label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'aria-chip'; b.textContent = label; b.onclick = () => { sfx.init(); sfx.click(); ask(label); }; chipsEl.appendChild(b); });

  // ---------- Controles ----------
  const paintMute = () => { muteBtn.textContent = voiceOn ? 'Voz activada' : 'Voz apagada'; muteBtn.classList.toggle('off', !voiceOn); };
  muteBtn.onclick = () => { voiceOn = !voiceOn; try { localStorage.setItem('synaptic.ariaVoice', voiceOn ? '1' : '0'); } catch (e) { /* ok */ } paintMute(); if (!voiceOn) { stop(); mark(1e9); } };
  paintMute();
  $('#ariaChatBtn').onclick = () => { el.classList.toggle('chat'); $('#ariaChatBtn').textContent = el.classList.contains('chat') ? 'Cerrar' : 'Preguntar'; if (el.classList.contains('chat')) setTimeout(() => input.focus(), 50); };
  replayBtn.textContent = '↻ Repetir';
  replayBtn.onclick = () => { sfx.init(); play(cur ? cur.id : `ch${Math.max(0, idx)}`); };
  el.addEventListener('wheel', (e) => { if (state.mode === 'journey' && !e.target.closest('input,.aria-bubble')) { e.preventDefault(); scroller.scrollTop += e.deltaY; } }, { passive: false });

  // Saluda cuando le pasas el mouse
  face.addEventListener('pointerenter', () => {
    el.classList.add('notice');
    if (speaking || !voiceOn || performance.now() - lastGreet < 25000) return;
    lastGreet = performance.now();
    const pick = ['hi1', 'hi2', 'hi3'][(Math.random() * 3) | 0];
    holdUntil = performance.now() + 3500;
    play(pick);
  });
  face.addEventListener('pointerleave', () => el.classList.remove('notice'));

  // ---------- Clic: ARIA de cuerpo completo ----------
  const body = $('#ariaBody'), abVideo = $('#abVideo'), abHolo = $('#abHolo'), abCards = $('#abCards');
  let holo = null; // se crea (y descarga el modelo) solo al abrir la ventana
  const tabs = [...body.querySelectorAll('[data-t]')];
  function setTab(t) {
    tabs.forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    const isHolo = t === 'holo';
    abHolo.style.display = isHolo ? '' : 'none';
    abCards.style.display = isHolo ? '' : 'none';
    abVideo.style.display = isHolo ? 'none' : '';
    if (isHolo) { abVideo.pause(); (holo = holo || createHolo(abHolo)).start(); }
    else { holo && holo.stop(); if (!abVideo.src) abVideo.src = BASE + 'aria/intro.mp4'; abVideo.currentTime = 0; abVideo.play().catch(() => {}); }
  }
  tabs.forEach((b) => (b.onclick = () => { sfx.click(); setTab(b.dataset.t); }));
  abVideo.addEventListener('ended', () => setTab('holo'));
  function openBody() {
    sfx.init(); sfx.open();
    body.classList.add('on'); document.body.classList.add('ab-open'); state.modal = true;
    requestAnimationFrame(() => setTab('holo'));
    holdUntil = performance.now() + 12000;
    play('body');
  }
  function closeBody() {
    body.classList.remove('on'); document.body.classList.remove('ab-open'); state.modal = false;
    holo && holo.stop(); abVideo.pause(); sfx.close();
  }
  face.onclick = openBody;
  $('#abClose').onclick = closeBody;
  body.addEventListener('pointerdown', (e) => { if (e.target === body) closeBody(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && body.classList.contains('on')) closeBody(); });

  // ---------- Señalar ----------
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.id = 'ariaPoint';
  svg.innerHTML = '<path id="apPath" class="ap-line"/><circle id="apPing1" class="ap-ping"/><circle id="apPing2" class="ap-ping"/><circle id="apDot" class="ap-dot" r="4"/>';
  document.body.appendChild(svg);
  const apPath = svg.querySelector('#apPath'), ping1 = svg.querySelector('#apPing1'), ping2 = svg.querySelector('#apPing2'), apDot = svg.querySelector('#apDot');
  function point(k, dur = 4) { if (k >= 0 && k <= 6) { pointK = k; pointT = dur; } }

  // ---------- Frame: karaoke y señal (sin animar labios) ----------
  function frame(dt, t) {
    if (speaking && cur) {
      const ct = voiceEl.currentTime;
      while (wi < cur.marks.length && cur.marks[wi].s <= ct + 0.03) { mark(cur.marks[wi].end); wi++; }
    }
    gestureT -= dt;
    const ak = activeLayer();
    if (gestureT <= 0) { gestureT = 10 + Math.random() * 8; if (ak >= 0 && state.mode === 'journey') point(ak, 3.2); }
    if (pointT > 0 && pointK >= 0) {
      pointT -= dt;
      const L = layerScreen(pointK), r = wrap.getBoundingClientRect();
      if (L && L.vis && r.width) {
        const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
        const qx = (sx + L.x) / 2, qy = Math.min(sy, L.y) - 70;
        apPath.setAttribute('d', `M${sx},${sy} Q${qx},${qy} ${L.x},${L.y}`);
        apPath.style.strokeDashoffset = (-t * 40) % 1000;
        const p1 = (t * 0.9) % 1, p2 = (t * 0.9 + 0.5) % 1;
        for (const [c, p] of [[ping1, p1], [ping2, p2]]) { c.setAttribute('cx', L.x); c.setAttribute('cy', L.y); c.setAttribute('r', 8 + p * 34); c.style.opacity = (1 - p) * 0.8; }
        apDot.setAttribute('cx', L.x); apDot.setAttribute('cy', L.y);
        svg.style.opacity = clamp(pointT * 2, 0, 1);
      }
    } else svg.style.opacity = 0;
  }

  function setJourney(on) {
    el.classList.toggle('hidden', !on);
    svg.style.display = on ? '' : 'none';
    if (on) {
      const lv = $('#ariaLoop');
      if (lv && !lv.getAttribute('src')) { lv.src = BASE + lv.dataset.src; }
      lv && lv.play().catch(() => {});
      idx = -1; say(0);
    } else stop();
  }

  return { say, frame, setJourney, point, stop, play, _debug: () => ({ speaking, t: voiceEl.currentTime, paused: voiceEl.paused, wi, mouth, analyser: !!analyser, ctx: sfx.ctx && sfx.ctx.state }) };
}
