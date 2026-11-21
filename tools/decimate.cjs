// Reduce la malla de ARIA (GLB de solo posiciones) por agrupación de vértices
// y la guarda en un binario compacto: [nV u32][nI u32][bbox 6×f32][pos nV×3 u16][idx nI u32]
// Uso: node tools/decimate.cjs entrada.glb salida.bin [celda]
const fs = require('fs');
const [, , inp, out, cellArg] = process.argv;
const b = fs.readFileSync(inp);
const jlen = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jlen).toString());
const binStart = 20 + jlen + 8;
const prim = j.meshes[0].primitives[0];
const acc = (i) => j.accessors[i];
const view = (a) => { const bv = j.bufferViews[a.bufferView]; return binStart + (bv.byteOffset || 0) + (a.byteOffset || 0); };
const pa = acc(prim.attributes.POSITION), ia = acc(prim.indices);
const P = new Float32Array(b.buffer.slice(b.byteOffset + view(pa), b.byteOffset + view(pa) + pa.count * 12));
const IT = ia.componentType === 5125 ? Uint32Array : ia.componentType === 5123 ? Uint16Array : Uint8Array;
const I = new IT(b.buffer.slice(b.byteOffset + view(ia), b.byteOffset + view(ia) + ia.count * IT.BYTES_PER_ELEMENT));
const min = pa.min, max = pa.max;
const cell = parseFloat(cellArg || '0.0065');
// Agrupar vértices en celdas y promediar
const map = new Map(), sum = [], cnt = [], remap = new Int32Array(pa.count);
for (let v = 0; v < pa.count; v++) {
  const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  const key = `${Math.floor((x - min[0]) / cell)},${Math.floor((y - min[1]) / cell)},${Math.floor((z - min[2]) / cell)}`;
  let id = map.get(key);
  if (id === undefined) { id = cnt.length; map.set(key, id); sum.push(0, 0, 0); cnt.push(0); }
  sum[id * 3] += x; sum[id * 3 + 1] += y; sum[id * 3 + 2] += z; cnt[id]++;
  remap[v] = id;
}
const nV = cnt.length, pos = new Float32Array(nV * 3);
for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = sum[i * 3 + k] / cnt[i];
const tris = [], seen = new Set();
for (let t = 0; t < I.length; t += 3) {
  const a = remap[I[t]], c = remap[I[t + 1]], d = remap[I[t + 2]];
  if (a === c || c === d || a === d) continue;
  const k = [a, c, d].sort((x, y) => x - y).join('_');
  if (seen.has(k)) continue; seen.add(k);
  tris.push(a, c, d);
}
// Cuantizar posiciones a u16 dentro del bbox
const q = new Uint16Array(nV * 3);
for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) q[i * 3 + k] = Math.round(((pos[i * 3 + k] - min[k]) / (max[k] - min[k])) * 65535);
const head = Buffer.alloc(8 + 24);
head.writeUInt32LE(nV, 0); head.writeUInt32LE(tris.length, 4);
[...min, ...max].forEach((v, i) => head.writeFloatLE(v, 8 + i * 4));
const pad = (q.byteLength % 4) ? Buffer.alloc(4 - (q.byteLength % 4)) : Buffer.alloc(0);
fs.writeFileSync(out, Buffer.concat([head, Buffer.from(q.buffer), pad, Buffer.from(new Uint32Array(tris).buffer)]));
console.log(`vértices ${pa.count} → ${nV}, triángulos ${I.length / 3} → ${tris.length / 3}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
