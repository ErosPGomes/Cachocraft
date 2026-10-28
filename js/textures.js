// Texturas procedurais (atlas 16×16 px por bloco, com margem anti-sangramento).
// Base adaptada do motor de voxels de github.com/ErosPGomes/animation (js/world3d.js).
import * as THREE from './vendor/three.module.min.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fract = x => x - Math.floor(x);
export const hash2 = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v);
}
export function fbm(x, z) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); a *= .5; f *= 2; } return s / .9375; }

export const ATLAS = document.createElement('canvas');
ATLAS.width = ATLAS.height = 512;
const actx = ATLAS.getContext('2d');
export const TILE = {};
let tileN = 0;
function tile(name, fn) {
  const i = tileN++, cx = (i % 21) * 24 + 4, cy = Math.floor(i / 21) * 24 + 4, img = actx.createImageData(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const c = fn(x, y, hash2(x + i * 37.1, y + i * 11.3), hash2(x * 3.7 + i, y * 5.1 - i)), k = (y * 16 + x) * 4;
    img.data[k] = clamp(c[0], 0, 255); img.data[k + 1] = clamp(c[1], 0, 255); img.data[k + 2] = clamp(c[2], 0, 255); img.data[k + 3] = c[3] == null ? 255 : c[3];
  }
  actx.putImageData(img, cx, cy);
  for (let p = 1; p <= 4; p++) { actx.drawImage(ATLAS, cx, cy, 1, 16, cx - p, cy, 1, 16); actx.drawImage(ATLAS, cx + 15, cy, 1, 16, cx + 15 + p, cy, 1, 16); }
  for (let p = 1; p <= 4; p++) { actx.drawImage(ATLAS, cx - 4, cy, 24, 1, cx - 4, cy - p, 24, 1); actx.drawImage(ATLAS, cx - 4, cy + 15, 24, 1, cx - 4, cy + 15 + p, 24, 1); }
  TILE[name] = { u0: cx / 512, u1: (cx + 16) / 512, v0: 1 - (cy + 16) / 512, v1: 1 - cy / 512, px: cx, py: cy };
}
const sh = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const boneShape = (x, y, cx, cy, len) => {
  const dx = x - cx, dy = y - cy;
  if (Math.abs(dy) <= 0.6 && Math.abs(dx) <= len) return true;
  for (const ex of [-len, len]) for (const ey of [-1, 1]) if (Math.hypot(dx - ex, dy - ey) < 1.3) return true;
  return false;
};

tile('grass_top', (x, y, n, m) => sh(m > .85 ? [118, 182, 70] : [94, 158, 52], .82 + n * .32));
tile('grass_side', (x, y, n, m) => (y < 3 || (y === 3 && m > .45) || (y === 4 && m > .8)) ? sh([94, 158, 52], .8 + n * .3) : sh(m > .9 ? [104, 74, 50] : [134, 96, 67], .8 + n * .35));
tile('dirt', (x, y, n, m) => sh(m > .88 ? [100, 70, 48] : [134, 96, 67], .8 + n * .35));
tile('stone', (x, y, n, m) => sh(m > .9 ? [96, 96, 98] : [128, 128, 130], .78 + n * .34));
tile('sand', (x, y, n) => sh([219, 205, 160], .9 + n * .14));
tile('log_side', (x, y, n) => sh((x % 4 === 0 || (x + (y >> 2)) % 5 === 0) ? [78, 58, 36] : [108, 82, 52], .85 + n * .25));
tile('log_top', (x, y, n) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return sh(d > 6.5 ? [104, 80, 50] : (Math.floor(d) % 2 ? [176, 140, 90] : [150, 116, 70]), .9 + n * .15); });
tile('leaves', (x, y, n, m) => { const c = sh(m > .8 ? [86, 160, 62] : [62, 132, 48], .8 + n * .42); c.push(m < .035 ? 0 : 255); return c; });
tile('leaves_apple', (x, y, n, m) => { if ((x === 4 && y === 5) || (x === 11 && y === 10) || (x === 12 && y === 3)) return [214, 50, 56]; const c = sh(m > .8 ? [86, 160, 62] : [62, 132, 48], .8 + n * .42); c.push(m < .035 ? 0 : 255); return c; });
tile('planks', (x, y, n) => { const seam = x === ((y >> 2) * 5 + 3) % 16; return sh((y % 4 === 3 || seam) ? [122, 92, 56] : [180, 142, 90], .88 + n * .2 + ((y >> 2) % 2) * .05); });
tile('cobble', (x, y, n) => { const row = y >> 2, ox = (x + (row % 2) * 2) % 4; const mortar = (y % 4 === 0) || ox === 0; return sh(mortar ? [82, 82, 84] : [132, 132, 134], .8 + n * .35); });
tile('path', (x, y, n, m) => sh(m > .85 ? [126, 100, 60] : [158, 128, 78], .85 + n * .25));
tile('roof', (x, y, n) => sh(y % 4 === 0 ? [110, 34, 28] : [158, 54, 42], .85 + n * .25));
tile('glass', (x, y, n) => { const fr = x === 0 || x === 15 || y === 0 || y === 15; if (fr) return sh([200, 220, 232], .9 + n * .1); return (x + y === 10 || x + y === 11) ? [240, 250, 255, 200] : [190, 222, 240, 90]; });
tile('hay', (x, y, n) => sh((x % 3 === 0) ? [178, 140, 40] : [214, 180, 70], .88 + n * .2));
tile('hay_top', (x, y, n) => { const d = Math.hypot(x - 7.5, y - 7.5); return sh(Math.floor(d) % 3 === 0 ? [176, 138, 40] : [216, 182, 74], .9 + n * .18); });
tile('kibble', (x, y, n, m) => { const cx = (x >> 2) * 4 + 2, cy = (y >> 2) * 4 + 2, d = Math.hypot(x + .5 - cx - (m - .5), y + .5 - cy); return d < 1.7 ? sh(m > .5 ? [168, 110, 58] : [140, 88, 44], .85 + n * .3) : sh([92, 58, 30], .8 + n * .3); });
tile('kibble_top', (x, y, n, m) => { if (boneShape(x, y, 7.5, 7.5, 3.5)) return [238, 226, 196]; const cx = (x >> 2) * 4 + 2, cy = (y >> 2) * 4 + 2; return Math.hypot(x + .5 - cx, y + .5 - cy) < 1.7 ? sh([168, 110, 58], .85 + n * .3) : sh([92, 58, 30], .8 + n * .3); });
tile('bone_block', (x, y, n) => (boneShape(x, y, 7.5, 4, 4) || boneShape(x, y, 7.5, 11.5, 4)) ? sh([246, 238, 216], .95 + n * .08) : sh([214, 198, 160], .85 + n * .2));
tile('fossil', (x, y, n, m) => boneShape(x, y, 7.5, 7.5, 3.5) ? sh([232, 222, 196], .92 + n * .1) : sh(m > .9 ? [96, 96, 98] : [128, 128, 130], .78 + n * .34));
tile('plush', (x, y, n, m) => sh(((x + y * 3) % 7 === 0 || m > .9) ? [222, 128, 168] : [246, 176, 208], .9 + n * .16));
tile('flower_red', (x, y) => { if ((x === 7 || x === 8) && y >= 8) return [62, 128, 48, 255]; const d = Math.hypot(x - 7.5, y - 5); if (d < 1.4) return [246, 200, 60, 255]; if (d < 3.6) return [214, 52, 56, 255]; if (y === 11 && (x === 9 || x === 10)) return [74, 146, 54, 255]; return [74, 146, 54, 0]; });
tile('flower_yel', (x, y) => { if ((x === 7 || x === 8) && y >= 8) return [62, 128, 48, 255]; const d = Math.hypot(x - 7.5, y - 5); if (d < 1.3) return [200, 120, 30, 255]; if (d < 3.3) return [246, 214, 60, 255]; return [74, 146, 54, 0]; });
tile('tallgrass', (x, y, n, m) => { const h = 6 + Math.floor(hash2(x, 3.3) * 9); return 15 - y < h && (x % 2 === 0 || m > .6) ? sh([82, 148, 50], .75 + n * .4).concat(255) : [82, 148, 50, 0]; });
tile('white', (x, y, n) => sh([238, 236, 230], .95 + n * .06));
tile('vet_sign', (x, y) => (x === 0 || x === 15 || y === 0 || y === 15) ? [60, 120, 170] : ((x >= 6 && x <= 9 && y >= 3 && y <= 12) || (y >= 6 && y <= 9 && x >= 3 && x <= 12)) ? [214, 60, 60] : [250, 250, 250]);

function texFrom(canvas, nearest) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = nearest ? THREE.NearestFilter : THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = !nearest;
  t.anisotropy = 4;
  return t;
}
export const atlasTex = texFrom(ATLAS, false);

export function smallTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y, hash2(x * 1.7 + w, y * 2.3 + h)), k = (y * w + x) * 4;
    img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = v[3] == null ? 255 : v[3];
  }
  g.putImageData(img, 0, 0);
  const t = texFrom(c, true);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const waterTex = smallTex(16, 16, (x, y, n) => {
  const w = Math.sin((x + y * .5) * .8) * .5 + .5, foam = hash2(x * 7, 3) > .78 && n > .35;
  return foam ? [210, 228, 246] : sh([70, 128, 214], .85 + n * .12 + w * .16);
}, true);

// Ícone isométrico de um bloco para a barra de itens.
export function blockIcon(tiles, size = 48) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const s = size / 2, top = TILE[tiles.top], side = TILE[tiles.side];
  const face = (t, a, b, cc, d, e, f, shade) => {
    g.save(); g.setTransform(a, b, cc, d, e, f);
    g.drawImage(ATLAS, t.px, t.py, 16, 16, 0, 0, 16, 16);
    if (shade) { g.fillStyle = `rgba(0,0,0,${shade})`; g.fillRect(0, 0, 16, 16); }
    g.restore();
  };
  const k = s * 0.92 / 16;
  face(top, k, k * 0.5, -k, k * 0.5, s, s * 0.08, 0);
  face(side, k, k * 0.5, 0, k, s - 16 * k, s * 0.08 + 8 * k, 0.12);
  face(side, k, -k * 0.5, 0, k, s, s * 0.08 + 16 * k, 0.3);
  return c;
}
