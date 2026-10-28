// Mundo em voxels editável: blocos, geração, pedaços (chunks) com malha + AO, raycast e colisão.
import * as THREE from './vendor/three.module.min.js';
import { TILE, ATLAS, atlasTex, waterTex, fbm, hash2, clamp, blockIcon } from './textures.js';

// tiles: top/side/bottom; drop: item obtido ao quebrar (padrão: o próprio bloco).
export const BLOCKS = [
  { key: 'ar', name: 'Ar' },
  { key: 'grama', name: 'Grama', tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hard: .5, drop: 'terra' },
  { key: 'terra', name: 'Terra', tiles: { all: 'dirt' }, hard: .5 },
  { key: 'pedra', name: 'Pedra', tiles: { all: 'stone' }, hard: 1.5, drop: 'pedregulho' },
  { key: 'areia', name: 'Areia', tiles: { all: 'sand' }, hard: .45 },
  { key: 'tronco', name: 'Tronco', tiles: { top: 'log_top', side: 'log_side', bottom: 'log_top' }, hard: 1.1 },
  { key: 'folhas', name: 'Folhas', tiles: { all: 'leaves' }, hard: .2, see: true, drop: null },
  { key: 'tabuas', name: 'Tábuas', tiles: { all: 'planks' }, hard: .9 },
  { key: 'pedregulho', name: 'Pedregulho', tiles: { all: 'cobble' }, hard: 1.5 },
  { key: 'vidro', name: 'Vidro', tiles: { all: 'glass' }, hard: .3, see: true },
  { key: 'agua', name: 'Água', water: true },
  { key: 'palha', name: 'Fardo de palha', tiles: { top: 'hay_top', side: 'hay', bottom: 'hay_top' }, hard: .4 },
  { key: 'bloco_racao', name: 'Bloco de ração', tiles: { top: 'kibble_top', side: 'kibble', bottom: 'kibble' }, hard: .4 },
  { key: 'fossil', name: 'Fóssil de osso', tiles: { all: 'fossil' }, hard: 1.7, drop: 'osso', dropN: 2 },
  { key: 'telhas', name: 'Telhas', tiles: { all: 'roof' }, hard: .8 },
  { key: 'trilha', name: 'Trilha', tiles: { top: 'path', side: 'dirt', bottom: 'dirt' }, hard: .5, drop: 'terra' },
  { key: 'pelucia', name: 'Tapete de pelo', tiles: { all: 'plush' }, hard: .3 },
  { key: 'bloco_osso', name: 'Bloco de osso', tiles: { top: 'bone_block', side: 'bone_block', bottom: 'bone_block' }, hard: 1 },
  { key: 'capim', name: 'Capim', plant: 'tallgrass', hard: 0, drop: null },
  { key: 'flor_vermelha', name: 'Flor vermelha', plant: 'flower_red', hard: 0 },
  { key: 'flor_amarela', name: 'Flor amarela', plant: 'flower_yel', hard: 0 },
  { key: 'folhas_maca', name: 'Folhas de macieira', tiles: { all: 'leaves_apple' }, hard: .2, see: true, drop: null },
  { key: 'parede', name: 'Parede branca', tiles: { all: 'white' }, hard: .9 },
  { key: 'placa_vet', name: 'Placa do veterinário', tiles: { all: 'vet_sign' }, hard: 99, drop: null },
];
export const B = Object.fromEntries(BLOCKS.map((b, i) => [b.key, i]));
for (const b of BLOCKS) if (b.tiles?.all) b.tiles = { top: b.tiles.all, side: b.tiles.all, bottom: b.tiles.all };

export const isSolid = id => id !== 0 && !BLOCKS[id].water && !BLOCKS[id].plant;
const opaque = id => isSolid(id) && !BLOCKS[id].see;
const aoSolid = id => isSolid(id);
export const targetable = id => id !== 0 && !BLOCKS[id].water;

const iconCache = {};
export function blockIconFor(key) {
  if (iconCache[key]) return iconCache[key];
  const b = BLOCKS[B[key]];
  let c;
  if (b.plant) {
    c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d'), t = TILE[b.plant];
    g.imageSmoothingEnabled = false;
    g.drawImage(ATLAS, t.px, t.py, 16, 16, 4, 4, 40, 40);
  } else c = blockIcon(b.tiles);
  return (iconCache[key] = c);
}

// ---------- grade ----------
export const W = 128, H = 48, D = 128, SEA = 10, CS = 16;
const grid = new Uint8Array(W * H * D);
const idx = (x, y, z) => (x * H + y) * D + z;
export const inb = (x, y, z) => x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D;
export const get = (x, y, z) => inb(x, y, z) ? grid[idx(x, y, z)] : (y < 0 ? B.pedra : 0);
const rawSet = (x, y, z, b) => { if (inb(x, y, z)) grid[idx(x, y, z)] = b; };
export function topSolid(x, z) {
  for (let y = H - 1; y >= 0; y--) if (isSolid(get(x, y, z))) return y;
  return -1;
}

// ---------- geração ----------
export const HOME = { x: 64, z: 64 };
export const HOUSE = { x0: 58, x1: 62, z0: 56, z1: 59 };
export const VET = { x0: 82, x1: 90, z0: 70, z1: 76 };
export const BOWLS = { food: { x: 61.5, z: 62.5 }, water: { x: 63.5, z: 62.5 }, faucet: { x: 65.5, z: 60.5 }, bag: { x: 57.5, z: 61.5 } };
export const VET_DOOR = { x: 86.5, z: 77.6 };
const BASE = 12;

function heightAt(x, z) {
  const n = fbm(x * .035 + 3.1, z * .035 - 7.7);
  let h = BASE + Math.round((n - .45) * 14);
  const edge = Math.max(Math.abs(x - W / 2), Math.abs(z - D / 2));
  h += Math.round(clamp((edge - 42) / 20, 0, 1) * (6 + fbm(x * .07, z * .07) * 14));
  const dHome = Math.hypot(x - HOME.x, z - HOME.z), dVet = Math.hypot(x - 86, z - 73);
  const flat = Math.max(clamp(1 - (dHome - 12) / 10, 0, 1), clamp(1 - (dVet - 8) / 6, 0, 1));
  h = Math.round(h * (1 - flat) + BASE * flat);
  return clamp(h, 2, H - 12);
}

function genTerrain() {
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const h = heightAt(x, z);
    for (let y = 0; y <= h; y++) {
      let b = y === h ? B.grama : y >= h - 3 ? B.terra : B.pedra;
      // quanto mais fundo, mais fósseis de osso
      if (b === B.pedra && y < h - 3 && hash2(x * 1.3 + y * 7.1, z * 2.9 - y) < .008 + (h - y - 3) * .007) b = B.fossil;
      if (y === h && h <= SEA + 1) b = B.areia;
      if (y < h && y >= h - 2 && h <= SEA + 1) b = B.areia;
      rawSet(x, y, z, b);
    }
    for (let y = h + 1; y <= SEA; y++) rawSet(x, y, z, B.agua);
  }
}

function genTree(tx, tz, apple) {
  const g = topSolid(tx, tz);
  if (get(tx, g, tz) !== B.grama) return;
  const h = 4 + Math.floor(hash2(tx, tz) * 3), leaf = apple ? B.folhas_maca : B.folhas;
  rawSet(tx, g, tz, B.terra);
  for (let y = 1; y <= h; y++) rawSet(tx, g + y, tz, B.tronco);
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && hash2(tx * 3 + dx, tz * 7 + dz + dy * 13) > .4) continue;
      const y = g + h + dy;
      if (!get(tx + dx, y, tz + dz)) rawSet(tx + dx, y, tz + dz, leaf);
    }
  }
  rawSet(tx, g + h + 2, tz, leaf);
}

function genHouse() {
  const { x0, x1, z0, z1 } = HOUSE, y0 = BASE + 1;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    rawSet(x, BASE, z, B.tabuas);
    for (let y = y0; y <= y0 + 1; y++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) { rawSet(x, y, z, 0); continue; }
      const door = z === z1 && x === 60;
      rawSet(x, y, z, door ? 0 : (x === x0 || x === x1) && (z === z0 || z === z1) ? B.tronco : B.tabuas);
    }
  }
  for (let l = 0; l < 3; l++) for (let x = x0 - 1 + l; x <= x1 + 1 - l; x++) for (let z = z0 - 1; z <= z1 + 1; z++) rawSet(x, y0 + 2 + l, z, B.telhas);
  rawSet(59, y0, 57, B.pelucia); rawSet(61, y0, 57, B.pelucia); rawSet(60, y0, 57, B.pelucia);
  for (const [x, z] of [[55, 58], [55, 59], [56, 58]]) rawSet(x, y0, z, B.palha);
  rawSet(55, y0 + 1, 58, B.palha);
}

function genVet() {
  const { x0, x1, z0, z1 } = VET, y0 = BASE + 1;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    rawSet(x, BASE, z, B.pedregulho);
    for (let y = y0; y <= y0 + 3; y++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) { rawSet(x, y, z, 0); continue; }
      const door = z === z1 && x === 86 && y <= y0 + 1;
      const win = y === y0 + 1 && !door && ((z === z1 && (x === 83 || x === 89)) || ((x === x0 || x === x1) && z === 73));
      rawSet(x, y, z, door ? 0 : win ? B.vidro : B.parede);
    }
    rawSet(x, y0 + 4, z, B.pedregulho);
  }
  rawSet(86, y0 + 3, z1 + 1, B.placa_vet);
  rawSet(85, y0 + 3, z1 + 1, B.parede); rawSet(87, y0 + 3, z1 + 1, B.parede);
}

function genPath() {
  const pts = [[60, 60], [64, 66], [72, 70], [80, 76], [86, 78]];
  for (let s = 0; s <= 300; s++) {
    const k = s / 300 * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), f = k - i;
    const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const bx = Math.floor(x + dx * .6), bz = Math.floor(z + dz * .6), y = topSolid(bx, bz);
      if (get(bx, y, bz) === B.grama) rawSet(bx, y, bz, B.trilha);
    }
  }
}

function genNature() {
  const cell = 7;
  for (let cx = 0; cx < W; cx += cell) for (let cz = 0; cz < D; cz += cell) {
    const tx = cx + 1 + Math.floor(hash2(cx, cz) * (cell - 2)), tz = cz + 1 + Math.floor(hash2(cz + 9, cx) * (cell - 2));
    if (tx < 3 || tz < 3 || tx > W - 4 || tz > D - 4) continue;
    if (Math.hypot(tx - HOME.x, tz - HOME.z) < 9) continue;
    if (tx >= VET.x0 - 3 && tx <= VET.x1 + 3 && tz >= VET.z0 - 3 && tz <= VET.z1 + 5) continue;
    if (hash2(tx * 2, tz * 3) < .62) genTree(tx, tz, hash2(tx, tz * 5) < .25);
  }
  for (let x = 1; x < W - 1; x++) for (let z = 1; z < D - 1; z++) {
    const y = topSolid(x, z);
    if (get(x, y, z) !== B.grama || get(x, y + 1, z) !== 0) continue;
    const r = hash2(x * 1.31, z * 2.77);
    if (r < .012) rawSet(x, y + 1, z, B.flor_vermelha);
    else if (r < .024) rawSet(x, y + 1, z, B.flor_amarela);
    else if (r < .13) rawSet(x, y + 1, z, B.capim);
    else if (r > .997 && Math.hypot(x - HOME.x, z - HOME.z) > 12) rawSet(x, y + 1, z, B.palha);
  }
}

export function generate(edits) {
  grid.fill(0);
  genTerrain(); genHouse(); genVet(); genPath(); genNature();
  if (edits) for (const [k, v] of Object.entries(edits)) grid[+k] = v;
}

// ---------- edição ----------
const dirty = new Set();
export const edits = {};
// Lençol freático: em baixadas (terreno original perto do nível do lago), buraco abaixo do nível enche de água.
const lowland = (x, z) => heightAt(x, z) <= SEA + 3;
export function seep(x, y, z) {
  const q = [[x, y, z]], N = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
  let n = 0;
  while (q.length && n < 400) {
    const [cx, cy, cz] = q.shift();
    if (!inb(cx, cy, cz) || get(cx, cy, cz) !== 0) continue;
    const nearWater = N.some(([dx, dy, dz]) => BLOCKS[get(cx + dx, cy + dy, cz + dz)].water);
    const table = cy <= SEA && lowland(cx, cz);
    if (!nearWater && !table) continue;
    setBlock(cx, cy, cz, B.agua);
    n++;
    q.push([cx, cy - 1, cz]);
    if (cy <= SEA) for (const [dx, , dz] of N.slice(0, 4)) q.push([cx + dx, cy, cz + dz]);
  }
  return n;
}

export function setBlock(x, y, z, b) {
  if (!inb(x, y, z)) return;
  const i = idx(x, y, z);
  grid[i] = b;
  edits[i] = b;
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  dirty.add(cx + ',' + cz);
  if (x % CS === 0) dirty.add((cx - 1) + ',' + cz);
  if (x % CS === CS - 1) dirty.add((cx + 1) + ',' + cz);
  if (z % CS === 0) dirty.add(cx + ',' + (cz - 1));
  if (z % CS === CS - 1) dirty.add(cx + ',' + (cz + 1));
  // planta sem chão some
  if (BLOCKS[get(x, y + 1, z)].plant && !isSolid(b)) setBlock(x, y + 1, z, 0);
}

// ---------- malha ----------
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AO_LV = [.42, .62, .8, 1];
class GeoB {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  quad(vs, nrm, uv, cs, flip) {
    const b = this.p.length / 3;
    for (let k = 0; k < 4; k++) { this.p.push(...vs[k]); this.n.push(...nrm); this.u.push(...uv[k]); this.c.push(cs[k], cs[k], cs[k]); }
    if (flip) this.i.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
const tileOf = (b, f) => { const t = BLOCKS[b].tiles; return f === 2 ? t.top : f === 3 ? t.bottom : t.side; };

function meshChunk(cx, cz) {
  const solid = new GeoB(), water = new GeoB();
  const X0 = cx * CS, Z0 = cz * CS;
  for (let x = X0; x < X0 + CS; x++) for (let z = Z0; z < Z0 + CS; z++) for (let y = 0; y < H; y++) {
    const b = grid[idx(x, y, z)];
    if (!b) continue;
    const def = BLOCKS[b];
    if (def.plant) {
      const T = TILE[def.plant], uv = [[T.u0, T.v0], [T.u1, T.v0], [T.u1, T.v1], [T.u0, T.v1]];
      const ox = (hash2(x, z * 3) - .5) * .3, oz = (hash2(x * 5, z) - .5) * .3, s = def.plant === 'tallgrass' ? .9 : .75;
      const a = [x + .15 + ox, z + .15 + oz], bb = [x + .85 + ox, z + .85 + oz], c = [x + .85 + ox, z + .15 + oz], d = [x + .15 + ox, z + .85 + oz];
      for (const [p, q] of [[a, bb], [bb, a], [c, d], [d, c]])
        solid.quad([[p[0], y, p[1]], [q[0], y, q[1]], [q[0], y + s, q[1]], [p[0], y + s, p[1]]], [0, 1, 0], p === a || p === c ? uv : [uv[1], uv[0], uv[3], uv[2]], [1, 1, 1, 1]);
      continue;
    }
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const nb = (ny < 0) ? B.pedra : (nx < 0 || nz < 0 || nx >= W || nz >= D) ? 0 : get(nx, ny, nz);
      if (def.water) {
        if (nb === b || opaque(nb)) continue;
        const top = f === 2, drop = top ? .12 : 0;
        const vs = F.c.map(c => [x + c[0], y + c[1] - (c[1] ? drop : 0), z + c[2]]);
        const uv = vs.map(v => top ? [v[0] * .5, v[2] * .5] : [(F.n[0] ? v[2] : v[0]) * .5, v[1] * .5]);
        water.quad(vs, F.n, uv, [1, 1, 1, 1], false);
        continue;
      }
      if (opaque(nb) || (nb === b && def.see)) continue;
      const ax = [0, 1, 2].filter(a => F.n[a] === 0), ao = [];
      for (const c of F.c) {
        const d1 = [0, 0, 0], d2 = [0, 0, 0];
        d1[ax[0]] = c[ax[0]] ? 1 : -1; d2[ax[1]] = c[ax[1]] ? 1 : -1;
        const s1 = aoSolid(get(nx + d1[0], ny + d1[1], nz + d1[2])), s2 = aoSolid(get(nx + d2[0], ny + d2[1], nz + d2[2]));
        const cr = aoSolid(get(nx + d1[0] + d2[0], ny + d1[1] + d2[1], nz + d1[2] + d2[2]));
        ao.push(AO_LV[s1 && s2 ? 0 : 3 - (s1 + s2 + cr)]);
      }
      const T = TILE[tileOf(b, f)], uv = [[T.u0, T.v0], [T.u1, T.v0], [T.u1, T.v1], [T.u0, T.v1]];
      solid.quad(F.c.map(c => [x + c[0], y + c[1], z + c[2]]), F.n, uv, ao, ao[0] + ao[2] < ao[1] + ao[3]);
    }
  }
  return { solid: solid.build(), water: water.build() };
}

export const solidMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: .5, side: THREE.FrontSide });
export const waterMat = new THREE.MeshLambertMaterial({ map: waterTex, color: 0xcfe3ff, transparent: true, opacity: .78, depthWrite: false });
const chunks = new Map();

export function buildAll(scene) {
  for (let cx = 0; cx < W / CS; cx++) for (let cz = 0; cz < D / CS; cz++) rebuild(scene, cx, cz);
}
function rebuild(scene, cx, cz) {
  if (cx < 0 || cz < 0 || cx >= W / CS || cz >= D / CS) return;
  const key = cx + ',' + cz, old = chunks.get(key);
  const g = meshChunk(cx, cz);
  if (old) {
    old.solid.geometry.dispose(); old.water.geometry.dispose();
    old.solid.geometry = g.solid; old.water.geometry = g.water;
    return;
  }
  const solid = new THREE.Mesh(g.solid, solidMat);
  solid.castShadow = solid.receiveShadow = true;
  const water = new THREE.Mesh(g.water, waterMat);
  water.receiveShadow = true;
  water.renderOrder = 1;
  scene.add(solid, water);
  chunks.set(key, { solid, water });
}
export function flush(scene) {
  for (const key of dirty) { const [cx, cz] = key.split(',').map(Number); rebuild(scene, cx, cz); }
  dirty.clear();
}

// ---------- raycast (DDA) ----------
export function raycast(o, d, maxDist, pred = targetable) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = d.x ? ((sx > 0 ? x + 1 - o.x : o.x - x) * tdx) : Infinity;
  let ty = d.y ? ((sy > 0 ? y + 1 - o.y : o.y - y) * tdy) : Infinity;
  let tz = d.z ? ((sz > 0 ? z + 1 - o.z : o.z - z) * tdz) : Infinity;
  let t = 0, n = [0, 0, 0];
  while (t <= maxDist) {
    const b = get(x, y, z);
    if (pred(b) && inb(x, y, z)) return { x, y, z, n, t, b };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}

// ---------- física (caixa alinhada aos eixos) ----------
export function boxHits(px, py, pz, hw, h) {
  for (let x = Math.floor(px - hw); x <= Math.floor(px + hw - 1e-4); x++)
    for (let y = Math.floor(py); y <= Math.floor(py + h - 1e-4); y++)
      for (let z = Math.floor(pz - hw); z <= Math.floor(pz + hw - 1e-4); z++)
        if (isSolid(get(x, y, z)) || x < 0 || z < 0 || x >= W || z >= D) return true;
  return false;
}
// Move e resolve colisão por eixo. e: {x,y,z,vx,vy,vz,hw,h,onGround}
export function moveBody(e, dt) {
  e.onGround = false;
  e.hitWall = false;
  const steps = Math.ceil(Math.max(Math.abs(e.vx), Math.abs(e.vy), Math.abs(e.vz)) * dt / 0.4) || 1;
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    let nx = e.x + e.vx * sdt;
    if (boxHits(nx, e.y, e.z, e.hw, e.h)) { e.vx = 0; e.hitWall = true; } else e.x = nx;
    let nz = e.z + e.vz * sdt;
    if (boxHits(e.x, e.y, nz, e.hw, e.h)) { e.vz = 0; e.hitWall = true; } else e.z = nz;
    let ny = e.y + e.vy * sdt;
    if (boxHits(e.x, ny, e.z, e.hw, e.h)) {
      if (e.vy < 0) { e.onGround = true; e.y = Math.floor(ny) + 1; }
      else e.y = Math.floor(ny + e.h) - e.h - 1e-3;
      e.vy = 0;
    } else e.y = ny;
  }
  e.inWater = BLOCKS[get(Math.floor(e.x), Math.floor(e.y + .3), Math.floor(e.z))].water === true;
}
