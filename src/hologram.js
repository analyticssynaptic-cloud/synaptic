import * as THREE from 'three';

// Uniforms compartidos por TODOS los materiales holográficos
export const shared = {
  uTime: { value: 0 },
  uEagle: { value: 0 },
  uReveal: { value: 0 },
  uGlitch: { value: 0 },
  uPx: { value: 1 },
};

const HASH = /* glsl */ `float hash(float n){return fract(sin(n)*43758.5453123);}`;

const meshVert = /* glsl */ `
uniform float uTime; uniform float uGlitch;
varying vec3 vN; varying vec3 vW; varying vec3 vV;
${HASH}
void main(){
  vec4 wp = modelMatrix * vec4(position,1.0);
  float band = step(0.985, hash(floor(wp.y*6.0 + uTime*3.0)));
  wp.x += band * uGlitch * 0.3 * sin(uTime*45.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const COMMON = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform float uEagle;
uniform float uTarget; uniform float uHover; uniform float uReveal;
vec3 eagleMix(vec3 col, float fr, float scan){
  vec3 gold = vec3(1.0,0.72,0.16);
  float lum = dot(col, vec3(0.3,0.5,0.2));
  vec3 dim = vec3(lum) * vec3(0.25,0.5,1.0) * 0.4;
  vec3 hot = gold * (0.8 + fr*2.2) * scan;
  return mix(col, mix(dim, hot, uTarget), uEagle);
}
`;

const meshFrag = /* glsl */ `
${COMMON}
varying vec3 vN; varying vec3 vW; varying vec3 vV;
void main(){
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float scan = 0.62 + 0.38*sin(vW.y*38.0 - uTime*4.0);
  float sweep = smoothstep(0.965, 1.0, sin(vW.y*0.9 - uTime*1.6));
  vec3 col = uColor * (0.2 + fr*1.25) * scan + uColor * sweep * 0.9;
  col = eagleMix(col, fr, scan);
  col += uHover * uColor * 0.9;
  float a = uAlpha * (0.3 + fr*0.95);
  a *= mix(1.0, mix(0.35, 1.0, uTarget), uEagle);
  a *= mix(1.0, 0.1, uTarget * (1.0 - uEagle));
  a = clamp(a + uHover*0.2, 0.0, 1.0) * uReveal;
  gl_FragColor = vec4(col, a);
}`;

const lineVert = /* glsl */ `
uniform float uTime; uniform float uGlitch;
varying vec3 vW;
${HASH}
void main(){
  vec4 wp = modelMatrix * vec4(position,1.0);
  float band = step(0.985, hash(floor(wp.y*6.0 + uTime*3.0)));
  wp.x += band * uGlitch * 0.3 * sin(uTime*45.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const lineFrag = /* glsl */ `
${COMMON}
varying vec3 vW;
void main(){
  float scan = 0.7 + 0.3*sin(vW.y*30.0 - uTime*3.0);
  vec3 col = uColor * 0.85 * scan;
  col = eagleMix(col, 0.3, scan);
  col += uHover * uColor * 0.8;
  float a = uAlpha * uReveal;
  a *= mix(1.0, mix(0.25, 1.0, uTarget), uEagle);
  a *= mix(1.0, 0.1, uTarget * (1.0 - uEagle));
  gl_FragColor = vec4(col, a);
}`;

const pointsVert = /* glsl */ `
uniform float uTime; uniform float uSize; uniform float uPx;
attribute float aSeed;
varying float vSeed; varying float vTw;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vSeed = aSeed;
  vTw = 0.55 + 0.45*sin(uTime*2.0 + aSeed*40.0);
  gl_PointSize = uSize * uPx * vTw * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const pointsFrag = /* glsl */ `
${COMMON}
varying float vSeed; varying float vTw;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if(d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  vec3 col = uColor * (0.6 + core*1.8) * vTw;
  col = eagleMix(col, core, 1.0);
  float a = core * uAlpha * uReveal;
  a *= mix(1.0, mix(0.3, 1.0, uTarget), uEagle);
  a *= mix(1.0, 0.1, uTarget * (1.0 - uEagle));
  gl_FragColor = vec4(col, a);
}`;

function baseUniforms(color, alpha, extra = {}) {
  return {
    uTime: shared.uTime,
    uEagle: shared.uEagle,
    uReveal: shared.uReveal,
    uGlitch: shared.uGlitch,
    uPx: shared.uPx,
    uColor: { value: new THREE.Color(color) },
    uAlpha: { value: alpha },
    uTarget: { value: 0 },
    uHover: { value: 0 },
    ...extra,
  };
}

const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

export function holoMesh(color, { alpha = 0.55, wireframe = false, target = 0 } = {}) {
  const m = new THREE.ShaderMaterial({
    ...common, side: THREE.DoubleSide, wireframe,
    uniforms: baseUniforms(color, alpha),
    vertexShader: meshVert, fragmentShader: meshFrag,
  });
  m.uniforms.uTarget.value = target;
  return m;
}

export function holoLine(color, { alpha = 0.9, target = 0 } = {}) {
  const m = new THREE.ShaderMaterial({
    ...common,
    uniforms: baseUniforms(color, alpha),
    vertexShader: lineVert, fragmentShader: lineFrag,
  });
  m.uniforms.uTarget.value = target;
  return m;
}

export function holoPoints(color, { size = 1, alpha = 1, target = 0 } = {}) {
  const m = new THREE.ShaderMaterial({
    ...common,
    uniforms: baseUniforms(color, alpha, { uSize: { value: size } }),
    vertexShader: pointsVert, fragmentShader: pointsFrag,
  });
  m.uniforms.uTarget.value = target;
  return m;
}

// Atributo aSeed aleatorio para un BufferGeometry de puntos
export function addSeeds(geo, rnd = Math.random) {
  const n = geo.getAttribute('position').count;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rnd();
  geo.setAttribute('aSeed', new THREE.BufferAttribute(a, 1));
  return geo;
}

// Aplica un valor de hover a todos los materiales holográficos de un grupo
export function setHover(obj, v) {
  obj.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (u && u.uHover) u.uHover.value = v;
  });
}

// RNG determinista
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
