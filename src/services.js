// Datos de Synaptic: servicios (los "Recuerdos" del Animus) y configuración
export const CONFIG = {
  phone: '+57 319 691 0228',
  tel: '+573196910228',
  whatsapp: '573196910228',
  fragments: 12,
};

export const SERVICES = [
  {
    id: 'web', code: 'MEM-01', color: '#00e5ff', name: 'Experiencias Web 3D',
    tagline: 'Sitios que se sienten como videojuegos.',
    desc: 'Diseñamos y construimos plataformas web inmersivas con WebGL, shaders y animación en tiempo real. Desde landing pages holográficas hasta configuradores de producto y portales corporativos de alto impacto.',
    items: ['Sitios y plataformas web de alto rendimiento', 'Escenas 3D interactivas con Three.js / WebGL', 'E-commerce y configuradores de producto 3D', 'Animación avanzada, scroll narrativo y micro-interacciones', 'SEO técnico, accesibilidad y Core Web Vitals'],
    stack: ['Three.js', 'WebGL / GLSL', 'React', 'Next.js', 'Vite', 'GSAP'],
    stats: { Impacto: 96, Complejidad: 78, Velocidad: 88 },
  },
  {
    id: 'apps', code: 'MEM-02', color: '#7c5cff', name: 'Apps Móviles & Software',
    tagline: 'Producto digital que tus usuarios aman.',
    desc: 'Aplicaciones nativas y multiplataforma para iOS y Android, además de software a la medida: paneles, ERPs, CRMs y sistemas internos que escalan con tu operación.',
    items: ['Apps iOS / Android nativas y multiplataforma', 'Software a la medida y sistemas internos', 'Paneles administrativos y dashboards en vivo', 'Integración con pagos, APIs y terceros', 'UX/UI research y prototipado'],
    stack: ['Flutter', 'React Native', 'Swift', 'Kotlin', 'Node.js', 'PostgreSQL'],
    stats: { Impacto: 90, Complejidad: 82, Velocidad: 80 },
  },
  {
    id: 'ia', code: 'MEM-03', color: '#ff3df2', name: 'Inteligencia Artificial',
    tagline: 'Tu negocio, con una mente sintética.',
    desc: 'Agentes conversacionales, automatización inteligente, visión por computador y análisis predictivo. Conectamos modelos de lenguaje con tus datos y procesos para que trabajen por ti 24/7.',
    items: ['Agentes y asistentes de IA personalizados', 'Chatbots para WhatsApp, web y voz', 'RAG: IA que responde con tus propios documentos', 'Visión por computador y análisis predictivo', 'Automatización de procesos con IA'],
    stack: ['Claude API', 'LLMs', 'RAG', 'Python', 'TensorFlow', 'LangChain'],
    stats: { Impacto: 99, Complejidad: 92, Velocidad: 74 },
  },
  {
    id: 'cyber', code: 'MEM-04', color: '#ff4d4d', name: 'Ciberseguridad',
    tagline: 'Defensa activa para tu infraestructura.',
    desc: 'Protegemos aplicaciones, redes y datos. Auditorías, pruebas de penetración, monitoreo continuo y cultura de seguridad para que tu empresa opere sin miedo.',
    items: ['Auditorías y pruebas de penetración', 'Hardening de servidores y aplicaciones', 'Monitoreo, SIEM y respuesta a incidentes', 'Cumplimiento y políticas de seguridad', 'Capacitación anti-phishing para equipos'],
    stack: ['OWASP', 'Zero Trust', 'SIEM', 'WAF', 'IAM', 'Pentesting'],
    stats: { Impacto: 94, Complejidad: 88, Velocidad: 70 },
  },
  {
    id: 'cloud', code: 'MEM-05', color: '#3dffb0', name: 'Cloud & DevOps',
    tagline: 'Infraestructura que nunca duerme.',
    desc: 'Migramos y operamos tu tecnología en la nube con alta disponibilidad, despliegues continuos y costos controlados. Arquitecturas escalables listas para crecer.',
    items: ['Arquitectura y migración a la nube', 'CI/CD y automatización de despliegues', 'Contenedores y Kubernetes', 'Observabilidad, backups y recuperación', 'Optimización de costos cloud'],
    stack: ['AWS', 'Google Cloud', 'Azure', 'Docker', 'Kubernetes', 'Terraform'],
    stats: { Impacto: 88, Complejidad: 85, Velocidad: 90 },
  },
  {
    id: 'iot', code: 'MEM-06', color: '#ffc83d', name: 'IoT & Automatización',
    tagline: 'El mundo físico, conectado y medible.',
    desc: 'Sensores, dispositivos y plataformas que convierten tu operación física en datos en tiempo real. Domótica, monitoreo industrial y control remoto.',
    items: ['Dispositivos y sensores conectados', 'Monitoreo industrial y telemetría', 'Domótica y edificios inteligentes', 'Gemelos digitales y paneles en tiempo real', 'Firmware y electrónica a medida'],
    stack: ['ESP32', 'MQTT', 'Arduino', 'Raspberry Pi', 'Node-RED', 'TimescaleDB'],
    stats: { Impacto: 86, Complejidad: 90, Velocidad: 72 },
  },
  {
    id: 'arvr', code: 'MEM-07', color: '#4d9bff', name: 'Realidad Aumentada & VR',
    tagline: 'Entra dentro de tu producto.',
    desc: 'Experiencias inmersivas para ventas, capacitación y eventos: showrooms virtuales, AR en el navegador, simulaciones y gemelos digitales que se pueden recorrer.',
    items: ['Showrooms y recorridos virtuales 3D', 'AR en el navegador (WebXR) y apps', 'Simuladores de entrenamiento', 'Modelado 3D, texturizado y optimización', 'Experiencias para eventos y activaciones'],
    stack: ['WebXR', 'Unity', 'Unreal', 'Blender', 'glTF', 'Spatial'],
    stats: { Impacto: 95, Complejidad: 91, Velocidad: 68 },
  },
];

export const HEADLINES = {
  web: 'Sitios web que se sienten vivos.',
  apps: 'Software y apps que escalan tu operación.',
  ia: 'IA que trabaja a tu lado, todo el día.',
  cyber: 'Seguridad que se anticipa al ataque.',
  cloud: 'Infraestructura que escala sin fricción.',
  iot: 'Lo físico, conectado y medible.',
  arvr: 'Realidad aumentada que convence.',
};

export const RANKS = [
  { xp: 0, name: 'Iniciado' },
  { xp: 200, name: 'Aprendiz Neural' },
  { xp: 500, name: 'Sincronizado' },
  { xp: 900, name: 'Maestro Synaptic' },
  { xp: 1300, name: 'Leyenda del Animus' },
];

export const XP = { visit: 100, fragment: 50, eagle: 25 };
export const MAX_XP = SERVICES.length * XP.visit + CONFIG.fragments * XP.fragment + XP.eagle;
