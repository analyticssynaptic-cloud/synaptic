import { SERVICES, CONFIG } from './services.js';

const $ = (s) => document.querySelector(s);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Guion por capítulo: 0 = inicio, 1..7 = capas, 8 = cierre
export const SCRIPT = [
  'Hola, soy ARIA, la asistente inteligente de Synaptic. Voy a guiarte por dentro de un chip: cada capa es un servicio que construimos. Desliza, gira el chip con el mouse, o pregúntame lo que quieras.',
  'Empezamos por arriba: el blindaje. En ciberseguridad hacemos auditorías y pruebas de penetración, endurecemos servidores y monitoreamos todo el tiempo para frenar el ataque antes de que ocurra.',
  'Debajo está el disipador: la nube. Diseñamos arquitectura y migraciones, automatizamos los despliegues y cuidamos los costos, para que tu plataforma escale sin caerse.',
  'Este cristal es tu cara al mundo. Construimos sitios y tiendas con escenas tridimensionales en tiempo real, animaciones avanzadas y un rendimiento de primera, como esta misma página.',
  'Y aquí, en el silicio, vivo yo. Creamos agentes y asistentes de inteligencia artificial, chatbots para WhatsApp y sistemas que responden usando tus propios documentos.',
  'Esta capa proyecta tu producto en realidad aumentada y virtual: showrooms que se pueden recorrer, simuladores de entrenamiento y experiencias para eventos.',
  'La placa de circuitos conecta lo físico con los datos: sensores, monitoreo industrial, domótica y paneles en tiempo real.',
  'Y la base sostiene todo: software a la medida y aplicaciones móviles, con paneles, integraciones y pagos, pensados para escalar tu operación.',
  `Eso es Synaptic. Si algo de lo que viste encaja con tu proyecto, escríbenos al WhatsApp ${CONFIG.phone}. Y si te quedó alguna duda, pregúntame aquí abajo.`,
];

const CHIPS = ['¿Qué servicios ofrecen?', '¿Cómo trabajan?', '¿Cuánto cuesta?', '¿Cómo los contacto?'];

// Base de conocimiento: palabras clave → respuesta (+ servicio / acción)
function buildKB(order) {
  const svc = (id) => SERVICES.find((s) => s.id === id);
  const sv = (id, kw) => {
    const s = svc(id);
    return { k: kw, svc: id, a: `${s.name}. ${s.tagline} ${s.desc}` };
  };
  return [
    { k: ['hola', 'buenas', 'hey', 'saludos', 'buenos dias', 'buenas tardes'], a: 'Hola, ¡qué gusto! Soy ARIA. Puedo contarte qué hace Synaptic, cómo trabajamos o llevarte a cualquiera de los siete servicios. ¿Qué quieres saber?' },
    { k: ['gracias', 'perfecto', 'genial', 'excelente', 'listo'], a: 'Con gusto. Si quieres avanzar con tu proyecto, escríbenos por WhatsApp y el equipo te responde el mismo día.', act: 'contact' },
    { k: ['quien eres', 'tu nombre', 'aria', 'eres una', 'que eres'], a: 'Soy ARIA, la asistente inteligente de Synaptic. Te guío por la web, respondo dudas sobre la compañía y te conecto con el equipo cuando quieras avanzar.' },
    { k: ['quienes son', 'que es synaptic', 'empresa', 'compania', 'a que se dedican', 'que hacen', 'sobre ustedes', 'nosotros'], a: 'Synaptic es una empresa de tecnología. Construimos software y aplicaciones, inteligencia artificial, ciberseguridad, infraestructura en la nube, IoT y experiencias 3D y de realidad aumentada. Todo a la medida de cada negocio, de la idea al lanzamiento y después.' },
    { k: ['servicio', 'ofrecen', 'soluciones', 'catalogo', 'que venden', 'que ofrecen'], a: `Ofrecemos siete líneas: ${SERVICES.map((s) => s.name).join(', ')}. Dime cuál te interesa y te la muestro.` },
    sv('web', ['web', 'pagina', 'sitio', 'tienda', 'ecommerce', 'landing', 'webgl']),
    sv('apps', ['app', 'movil', 'celular', 'aplicacion', 'software', 'sistema', 'erp', 'crm', 'a la medida', 'panel']),
    sv('ia', ['ia', 'inteligencia', 'artificial', 'chatbot', 'agente', 'bot', 'automatiz', 'whatsapp', 'machine', 'rag']),
    sv('cyber', ['segur', 'hack', 'ataque', 'pentest', 'ciber', 'proteg', 'vulnerab', 'phishing']),
    sv('cloud', ['nube', 'cloud', 'aws', 'azure', 'servidor', 'devops', 'migrac', 'kubernetes', 'hosting']),
    sv('iot', ['iot', 'sensor', 'domotica', 'dispositivo', 'industrial', 'telemetria', 'arduino']),
    sv('arvr', ['realidad', 'virtual', 'aumentada', 'vr', 'showroom', 'xr', 'simulador', 'metaverso']),
    { k: ['como trabajan', 'proceso', 'metodologia', 'etapas', 'pasos', 'como funciona'], a: 'Trabajamos por misiones: primero entendemos tu objetivo, luego diseñamos la arquitectura, construimos en ciclos cortos con entregas que puedes ver, lanzamos y seguimos operando contigo después.' },
    { k: ['cuanto cuesta', 'precio', 'costo', 'valor', 'presupuesto', 'cotiz', 'tarifa', 'cobran'], a: `El valor depende del alcance de cada proyecto, por eso no manejamos precios fijos. Cuéntanos qué necesitas y te preparamos una cotización. Escríbenos al WhatsApp ${CONFIG.phone}.`, act: 'contact' },
    { k: ['cuanto demora', 'tiempo', 'plazo', 'cuando', 'demora', 'entrega', 'tardan'], a: 'Los tiempos dependen del alcance. Trabajamos en ciclos cortos con entregas parciales para que veas avances rápido, y al cotizar te damos un cronograma claro.' },
    { k: ['contact', 'whatsapp', 'telefono', 'llamar', 'numero', 'escribir', 'hablar', 'celular de', 'reunion', 'cita'], a: `Puedes escribirnos o llamarnos al ${CONFIG.phone}. Te respondemos el mismo día.`, act: 'contact' },
    { k: ['tecnolog', 'stack', 'herramient', 'lenguaje', 'framework', 'usan'], a: `Según el proyecto usamos, entre otras: ${[...new Set(SERVICES.flatMap((s) => s.stack.slice(0, 3)))].slice(0, 14).join(', ')}. Elegimos la herramienta correcta para cada caso, no al revés.` },
    { k: ['soporte', 'mantenimiento', 'garantia', 'despues', 'postventa'], a: 'No desaparecemos tras el lanzamiento: operamos contigo con monitoreo, mejoras y soporte según el plan que acordemos.' },
    { k: ['donde', 'ubicad', 'ciudad', 'pais', 'direccion', 'oficina', 'sede'], a: `Para temas de ubicación y reuniones, lo mejor es escribirnos al WhatsApp ${CONFIG.phone} y el equipo te confirma.`, act: 'contact' },
  ];
}

export function createAria({ sfx, order, state, scroller, chaptersCount, layerScreen, openContact, goChapter, activeLayer }) {
  const el = $('#aria'), bubble = $('#ariaBubble'), textEl = $('#ariaText'), face = $('#ariaFace'), loop = $('#ariaLoop'), talk = $('#ariaTalk');
  const act = $('#ariaAct'), chipsEl = $('#ariaChips'), form = $('#ariaForm'), input = $('#ariaQ'), muteBtn = $('#ariaMute'), origBtn = $('#ariaVoice');
  const kb = buildKB(order);
  const wrap = el.querySelector('.aria-wrap');

  let voiceOn = true; try { voiceOn = localStorage.getItem('synaptic.ariaVoice') !== '0'; } catch (e) { /* ok */ }
  let idx = -1, speaking = false, amp = 0, settle = 0, estTimer = 0, queueToken = 0, pointK = -1, pointT = 0, gestureT = 6, ry = 0, rx = 0;
  let voice = null, words = [], recorded = null, analyser = null, anaData = null, recWords = null, srcNode = null;

  // ---------- Voz: elegir la mejor voz en español ----------
  const pickVoice = () => {
    const vs = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
    const score = (v) => (/natural|neural|online/i.test(v.name) ? 6 : 0) + (/sabina|dalia|paulina|helena|elena|laura|monica|google/i.test(v.name) ? 4 : 0) + (/CO|MX|US|419/i.test(v.lang) ? 2 : 0) + (/male|jorge|pablo|diego|raul/i.test(v.name) ? -5 : 0);
    voice = vs.sort((a, b) => score(b) - score(a))[0] || null;
  };
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }

  // ---------- Texto con palabras resaltables ----------
  function render(text, doneAll = false) {
    words = [];
    textEl.innerHTML = '';
    let pos = 0;
    text.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { textEl.appendChild(document.createTextNode(tok)); pos += tok.length; return; }
      const s = document.createElement('span'); s.className = 'w' + (doneAll ? ' said' : ''); s.textContent = tok;
      textEl.appendChild(s); words.push({ s, start: pos }); pos += tok.length;
    });
  }
  const mark = (charIdx) => words.forEach((w) => { if (w.start <= charIdx) w.s.classList.add('said'); });

  function setTalking(on) {
    speaking = on;
    el.classList.toggle('talking', on);
    sfx.duck && sfx.duck(on);
    if (on) { talk.currentTime = 0; talk.play().catch(() => {}); } else { talk.pause(); talk.style.opacity = 0; }
  }

  function stopSpeech() {
    queueToken++;
    clearTimeout(settle); clearInterval(estTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (recorded) { recorded.pause(); recorded = null; origBtn.textContent = '▶ Escuchar su voz original'; }
    if (speaking) setTalking(false);
  }

  // Habla un texto con TTS, resaltando palabra a palabra
  function speak(text, onDone) {
    stopSpeech();
    render(text, !voiceOn);
    if (!voiceOn || !('speechSynthesis' in window)) { onDone && onDone(); return; }
    const token = ++queueToken;
    const sentences = text.match(/[^.!?¿]+[.!?]?/g) || [text];
    let offset = 0, i = 0;
    setTalking(true);
    const t0 = performance.now();
    clearInterval(estTimer);
    let boundarySeen = false;
    estTimer = setInterval(() => { if (!boundarySeen) mark(((performance.now() - t0) / 1000) * 14.5); }, 90);
    const next = () => {
      if (token !== queueToken) return;
      if (i >= sentences.length) { clearInterval(estTimer); mark(1e9); setTalking(false); onDone && onDone(); return; }
      const sent = sentences[i], base = offset;
      const u = new SpeechSynthesisUtterance(sent.trim());
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'es-CO';
      u.rate = 1.02; u.pitch = 1.08; u.volume = sfx.muted ? 0 : 1;
      u.onboundary = (e) => { boundarySeen = true; amp = 1; mark(base + (e.charIndex || 0) + 1); };
      u.onend = () => { amp = 0.2; offset += sent.length; i++; setTimeout(next, 160); };
      u.onerror = () => { i++; next(); };
      speechSynthesis.speak(u);
    };
    setTimeout(next, 60);
  }

  // ---------- Voz original grabada (con análisis de amplitud) ----------
  async function playRecorded() {
    sfx.init();
    if (recorded) { stopSpeech(); render(SCRIPT[Math.max(0, idx)] || SCRIPT[0], true); return; }
    stopSpeech();
    if (!recWords) { try { recWords = await (await fetch('aria-voz.json')).json(); } catch (e) { recWords = []; } }
    const a = new Audio('aria-voz.mp3'); recorded = a;
    const full = recWords.map((w) => w[2]).join(' ');
    render(full); origBtn.textContent = '■ Detener';
    // posición de caracteres de cada palabra
    let p = 0; const starts = recWords.map((w) => { const s = p; p += w[2].length + 1; return s; });
    a.volume = sfx.muted ? 0 : 1;
    setTalking(true);
    a.ontimeupdate = () => { const ct = a.currentTime; let ci = -1; recWords.forEach((w, k) => { if (w[0] <= ct) ci = starts[k]; }); mark(ci); amp = Math.max(amp, 0.5 + 0.5 * Math.abs(Math.sin(ct * 11))); };
    a.onended = () => { recorded = null; origBtn.textContent = '▶ Escuchar su voz original'; setTalking(false); mark(1e9); };
    a.play().catch(() => { recorded = null; setTalking(false); });
  }
  origBtn.onclick = playRecorded;

  // ---------- Narración por capítulo ----------
  let holdUntil = 0;
  function say(i) {
    if (i === idx) return;
    if (performance.now() < holdUntil) { idx = i; return; }
    idx = i;
    const txt = SCRIPT[clamp(i, 0, SCRIPT.length - 1)];
    const textLeft = i === 0 || i === SCRIPT.length - 1 || (i - 1) % 2 === 1;
    el.classList.toggle('pos-r', textLeft); el.classList.toggle('pos-l', !textLeft);
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    act.innerHTML = '';
    stopSpeech();
    render(txt, false);
    if (!voiceOn) mark(1e9);
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (state.mode !== 'journey' || idx !== i) return;
      speak(txt);
      if (i >= 1 && i <= 7) { setTimeout(() => idx === i && point(i - 1, 5), 900); setTimeout(() => idx === i && point(i - 1, 4), 6500); }
    }, 1100);
  }

  // ---------- Gesto de señalar ----------
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.id = 'ariaPoint';
  svg.innerHTML = '<path id="apPath" class="ap-line"/><circle id="apPing1" class="ap-ping"/><circle id="apPing2" class="ap-ping"/><circle id="apDot" class="ap-dot" r="4"/>';
  document.body.appendChild(svg);
  const apPath = svg.querySelector('#apPath'), ping1 = svg.querySelector('#apPing1'), ping2 = svg.querySelector('#apPing2'), apDot = svg.querySelector('#apDot');
  function point(k, dur = 4) { if (k < 0 || k > 6) return; pointK = k; pointT = dur; }

  // ---------- Preguntas ----------
  function ask(q) {
    q = q.trim(); if (!q) return;
    const n = ' ' + norm(q) + ' ';
    let best = null, bs = 0;
    kb.forEach((e) => { let s = 0; e.k.forEach((kw) => { if (n.includes(' ' + norm(kw)) || n.includes(norm(kw))) s += kw.length > 4 ? 2 : 1; }); if (s > bs) { bs = s; best = e; } });
    let ans, action = null, svcId = null;
    if (best && bs >= 1) { ans = best.a; action = best.act || null; svcId = best.svc || null; }
    else { ans = `Buena pregunta. Eso lo confirma mejor el equipo de Synaptic: escríbenos al WhatsApp ${CONFIG.phone} y te responden el mismo día. Mientras tanto, puedo contarte de cualquiera de los siete servicios.`; action = 'contact'; }
    act.innerHTML = '';
    stopSpeech();
    holdUntil = performance.now() + 14000;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    const done = () => {};
    speak(ans, done);
    if (action === 'contact' || svcId) {
      const b = document.createElement('button'); b.className = 'aria-btn';
      b.textContent = svcId ? 'Ver este servicio en el chip' : 'Escribir por WhatsApp';
      b.onclick = () => (svcId ? goChapter(order.indexOf(SERVICES.findIndex((s) => s.id === svcId)) + 1) : openContact(-1));
      act.appendChild(b);
    }
    if (svcId) { const k = order.indexOf(SERVICES.findIndex((s) => s.id === svcId)); setTimeout(() => goChapter(k + 1), 600); }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; sfx.init(); ask(q); });
  CHIPS.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'aria-chip'; b.textContent = c; b.onclick = () => { sfx.init(); sfx.click(); ask(c); }; chipsEl.appendChild(b); });

  // ---------- Controles ----------
  const paintMute = () => { muteBtn.textContent = voiceOn ? 'Voz activada' : 'Voz apagada'; muteBtn.classList.toggle('off', !voiceOn); };
  muteBtn.onclick = () => { voiceOn = !voiceOn; try { localStorage.setItem('synaptic.ariaVoice', voiceOn ? '1' : '0'); } catch (e) { /* ok */ } paintMute(); if (!voiceOn) { stopSpeech(); mark(1e9); } else { const i = idx; idx = -1; say(i); } };
  paintMute();
  face.onclick = () => { sfx.init(); if (speaking) { stopSpeech(); mark(1e9); } else speak(SCRIPT[clamp(idx, 0, SCRIPT.length - 1)]); };
  el.addEventListener('wheel', (e) => { if (state.mode === 'journey' && !e.target.closest('input')) { e.preventDefault(); scroller.scrollTop += e.deltaY; } }, { passive: false });

  // ---------- Frame: boca, cabeza y señal ----------
  function frame(dt, t) {
    amp *= Math.exp(-dt * 6);
    const base = speaking ? 0.28 + 0.22 * Math.sin(t * 13) : 0;
    const a = clamp(Math.max(amp, base), 0, 1);
    talk.style.opacity = speaking && a > 0.22 ? 1 : 0;
    talk.playbackRate = 0.9 + a * 0.5;
    el.style.setProperty('--amp', a.toFixed(2));
    // Señal
    gestureT -= dt;
    const ak = activeLayer();
    if (gestureT <= 0) { gestureT = 11 + Math.random() * 7; if (ak >= 0 && state.mode === 'journey') point(ak, 3.2); }
    let tryX = 0, tryY = 0;
    if (pointT > 0 && pointK >= 0) {
      pointT -= dt;
      const L = layerScreen(pointK), r = wrap.getBoundingClientRect();
      if (L && L.vis && r.width) {
        const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
        const mx = (sx + L.x) / 2, my = Math.min(sy, L.y) - 70;
        apPath.setAttribute('d', `M${sx},${sy} Q${mx},${my} ${L.x},${L.y}`);
        apPath.style.strokeDashoffset = (-t * 40) % 1000;
        const p1 = (t * 0.9) % 1, p2 = (t * 0.9 + 0.5) % 1;
        ping1.setAttribute('cx', L.x); ping1.setAttribute('cy', L.y); ping1.setAttribute('r', 8 + p1 * 34); ping1.style.opacity = (1 - p1) * 0.8;
        ping2.setAttribute('cx', L.x); ping2.setAttribute('cy', L.y); ping2.setAttribute('r', 8 + p2 * 34); ping2.style.opacity = (1 - p2) * 0.8;
        apDot.setAttribute('cx', L.x); apDot.setAttribute('cy', L.y);
        svg.style.opacity = clamp(pointT * 2, 0, 1);
        tryX = clamp((L.x - sx) / innerWidth * 70, -28, 28); tryY = clamp(-(L.y - sy) / innerHeight * 30, -14, 14);
      }
    } else svg.style.opacity = 0;
    ry += (tryX - ry) * (1 - Math.exp(-dt * 4)); rx += (tryY - rx) * (1 - Math.exp(-dt * 4));
    face.style.transform = `perspective(280px) rotateY(${ry.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg) translateY(${(-a * 3).toFixed(1)}px) scale(${(1 + a * 0.03).toFixed(3)})`;
  }

  function setJourney(on) {
    el.classList.toggle('hidden', !on);
    svg.style.display = on ? '' : 'none';
    if (on) { idx = -1; say(0); } else { stopSpeech(); }
  }

  return { say, frame, setJourney, point, stop: stopSpeech };
}
