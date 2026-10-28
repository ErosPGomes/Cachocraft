// Cachocraft 3D: mundo de blocos, jogador-cachorro, Paçoca, inventário, criação, chat e guarda-roupa.
import * as THREE from './vendor/three.module.min.js';
import * as World from './world.js';
import { BLOCKS, B, HOME, HOUSE, BOWLS, VET_DOOR } from './world.js';
import { makeDog } from './dog3d.js';
import { clamp, lerp, hash2 } from './textures.js';

const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const GROUND = 13;

// ---------- save ----------
const SAVE_KEY = 'cachocraft3d-save-v1', WORLD_KEY = 'cachocraft3d-world-v1';
const DEFAULT_SAVE = {
  coins: 10, unlocked: [],
  playerSkin: { coat: 'pretinho', collar: 'azul', acc: 'nenhum' },
  dogSkin: { coat: 'caramelo', collar: 'vermelha', acc: 'nenhum' },
  dogName: 'Paçoca', playerName: '', learned: [], muted: false,
  inv: null, dayT: 0.32,
};
const save = (() => {
  try { return { ...structuredClone(DEFAULT_SAVE), ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
  catch { return structuredClone(DEFAULT_SAVE); }
})();
let savedEdits = null;
try { savedEdits = JSON.parse(localStorage.getItem(WORLD_KEY) || 'null'); } catch { /* sem save */ }
let worldDirty = false;
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    if (worldDirty) { localStorage.setItem(WORLD_KEY, JSON.stringify(World.edits)); worldDirty = false; }
  } catch { /* sem storage */ }
}
const isUnlocked = (kind, key) => CATALOG[kind][key].price === 0 || save.unlocked.includes(`${kind}:${key}`);
const dogName = () => save.dogName;
const learned = id => save.learned.includes(id);

// ---------- som ----------
const Sfx = (() => {
  let ac;
  function tone(f0, f1, dur, type = 'sine', vol = 0.12, delay = 0) {
    if (save.muted) return;
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + delay;
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch { /* áudio indisponível */ }
  }
  return {
    bark() { tone(620, 240, 0.13, 'sawtooth', 0.06); tone(600, 230, 0.13, 'sawtooth', 0.06, 0.17); },
    coin() { tone(880, 1500, 0.12, 'sine', 0.1); },
    chomp() { tone(220, 120, 0.06, 'square', 0.04); tone(220, 110, 0.06, 'square', 0.04, 0.13); },
    bad() { tone(320, 90, 0.45, 'triangle', 0.14); },
    good() { tone(520, 780, 0.14); tone(780, 1040, 0.16, 'sine', 0.1, 0.12); },
    toss() { tone(300, 700, 0.12, 'sine', 0.05); },
    drink() { tone(500, 900, 0.08, 'sine', 0.06); tone(500, 900, 0.08, 'sine', 0.06, 0.12); },
    dig() { tone(180, 90, 0.07, 'triangle', 0.08); },
    pop() { tone(260, 140, 0.1, 'square', 0.05); },
    place() { tone(140, 200, 0.06, 'triangle', 0.1); },
  };
})();

// ---------- renderer ----------
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('sem WebGL2');
} catch (e) {
  $('#nogl').hidden = false; $('#lock').hidden = true;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 500);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// céu (gradiente, sol, lua e estrelas), luzes e nuvens
const skyUni = {
  top: { value: new THREE.Color('#4f92da') }, hor: { value: new THREE.Color('#c2e0f4') },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunOn: { value: 1 }, stars: { value: 0 }, time: { value: 0 },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vec4 wp = modelMatrix*vec4(position,1.); vDir = normalize(wp.xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*wp; gl_Position.z = gl_Position.w; }`,
  fragmentShader: `uniform vec3 top, hor, sunDir; uniform float sunOn, stars, time; varying vec3 vDir;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
  void main(){ vec3 d = normalize(vDir); float h = d.y;
    vec3 c = mix(hor, top, pow(smoothstep(0.0, 1.0, max(h, 0.0)), .55));
    c = mix(c, hor*.8, smoothstep(0.0, -.25, h));
    float s = max(dot(d, sunDir), 0.0);
    c += vec3(1.0,.95,.82) * (pow(s, 6.0)*.2 + smoothstep(.9985,.9992,s)*3.0) * sunOn;
    float m = max(dot(d, -sunDir), 0.0);
    c += vec3(.8,.86,1.0) * smoothstep(.9988,.9993,m) * 2.0 * (1.0-sunOn);
    if (stars > 0.0 && h > 0.02) { vec3 q = floor(d*220.0); float r = h3(q); if (r > .9965) c += vec3(1.0) * stars * (.6 + .4*sin(time*3.0 + r*90.0)); }
    gl_FragColor = vec4(c, 1.0); }`,
}));
sky.renderOrder = -1;
scene.add(sky);
scene.fog = new THREE.Fog(0xc2e0f4, 45, 120);
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 200 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbcd8f2, 0x6f8a4c, 1.1);
scene.add(hemi);
const clouds = new THREE.Group();
{
  const cells = [];
  for (let gx = -16; gx < 30; gx++) for (let gz = -16; gz < 30; gz++) if (hash2(gx * .7, gz * 1.3) > .86) cells.push([gx, gz]);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .4, transparent: true, opacity: .9, fog: false });
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 2, 8), mat, cells.length), m = new THREE.Matrix4();
  cells.forEach(([gx, gz], i) => { m.makeTranslation(gx * 8, 62, gz * 8); im.setMatrixAt(i, m); });
  clouds.add(im);
  clouds.userData.mat = mat;
}
scene.add(clouds);

// ---------- mundo ----------
World.generate(savedEdits);
if (savedEdits) Object.assign(World.edits, savedEdits);
World.buildAll(scene);

const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x1d1715, transparent: true, opacity: .6 }));
highlight.visible = false;
scene.add(highlight);

// adereços da casa: potinhos, torneira, saco de ração
const lamb = c => new THREE.MeshLambertMaterial({ color: c });
function propBowl(x, z, rim, fill) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(.34, .28, .16, 16), lamb(rim));
  outer.position.y = .08; outer.castShadow = true;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .02, 16), lamb(fill));
  inner.position.y = .15;
  g.add(outer, inner);
  g.position.set(x, GROUND, z);
  scene.add(g);
  return { g, inner, x, z };
}
const foodBowl = { ...propBowl(BOWLS.food.x, BOWLS.food.z, '#d64545', '#a96d38'), level: 0.6, kind: 'food' };
const waterBowl = { ...propBowl(BOWLS.water.x, BOWLS.water.z, '#2f7fd6', '#5cb2ee'), level: 0.6, kind: 'water' };
const faucet = new THREE.Group();
{
  const metal = lamb('#a9b2bc');
  const post = new THREE.Mesh(new THREE.BoxGeometry(.16, 1, .16), metal); post.position.y = .5;
  const spout = new THREE.Mesh(new THREE.BoxGeometry(.12, .1, .36), metal); spout.position.set(0, .86, .16);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .05, 10), lamb('#3a8ee0')); knob.position.y = 1.03;
  for (const m of [post, spout, knob]) m.castShadow = true;
  faucet.add(post, spout, knob);
  faucet.position.set(BOWLS.faucet.x, GROUND, BOWLS.faucet.z);
  scene.add(faucet);
}
const bagProp = new THREE.Group();
{
  const sack = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .4), lamb('#e8d3a3')); sack.position.y = .4; sack.castShadow = true;
  const label = new THREE.Mesh(new THREE.BoxGeometry(.42, .3, .02), lamb('#c8432f')); label.position.set(0, .45, .21);
  const bone = new THREE.Mesh(new THREE.BoxGeometry(.26, .06, .02), lamb('#f5e6c8')); bone.position.set(0, .45, .225);
  bagProp.add(sack, label, bone);
  bagProp.position.set(BOWLS.bag.x, GROUND, BOWLS.bag.z);
  scene.add(bagProp);
}
function updateBowl(b) {
  b.inner.visible = b.level > 0.05;
  b.inner.position.y = 0.06 + b.level * 0.1;
}

// ---------- sprites de itens ----------
const iconCache = {};
function itemIcon(key) {
  if (iconCache[key]) return iconCache[key];
  let c;
  if (B[key] !== undefined) c = World.blockIconFor(key);
  else {
    c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d');
    if (key === 'coin') Draw.item(g, 'coin', 24, 24, 2.6);
    else Draw.item(g, key, 24, 26, 2);
  }
  return (iconCache[key] = c);
}
const texCache = {};
function itemTex(key) {
  if (!texCache[key]) {
    const t = new THREE.CanvasTexture(itemIcon(key));
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    texCache[key] = t;
  }
  return texCache[key];
}
function itemSprite(key, size = .5) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: itemTex(key), alphaTest: .3 }));
  s.scale.setScalar(size);
  return s;
}
const itemName = key => key === 'coin' ? 'Ossinho dourado' : B[key] !== undefined ? BLOCKS[B[key]].name : ITEMS[key]?.name || key;
const isBlockKey = key => B[key] !== undefined && key !== 'ar' && key !== 'agua';

// ---------- inventário ----------
const INV_SIZE = 36, STACK = 64;
const inv = save.inv && save.inv.length === INV_SIZE ? save.inv : Array(INV_SIZE).fill(null);
if (!save.inv) {
  inv[0] = { key: 'graveto', n: 3 }; inv[1] = { key: 'racao', n: 4 }; inv[2] = { key: 'tabuas', n: 16 };
  inv[3] = { key: 'terra', n: 8 }; inv[4] = { key: 'pelucia', n: 4 };
}
save.inv = inv;
let sel = 0;
const countOf = key => inv.reduce((s, it) => s + (it && it.key === key ? it.n : 0), 0);
function addItem(key, n = 1) {
  for (const it of inv) if (it && it.key === key && it.n < STACK) { const k = Math.min(n, STACK - it.n); it.n += k; n -= k; if (!n) break; }
  for (let i = 0; i < INV_SIZE && n > 0; i++) if (!inv[i]) { const k = Math.min(n, STACK); inv[i] = { key, n: k }; n -= k; }
  renderHotbar();
  return n === 0;
}
function removeItem(key, n = 1) {
  if (countOf(key) < n) return false;
  for (let i = INV_SIZE - 1; i >= 0 && n > 0; i--) {
    const it = inv[i];
    if (it && it.key === key) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (!it.n) inv[i] = null; }
  }
  renderHotbar();
  return true;
}
function takeSelected() {
  const it = inv[sel];
  if (!it) return null;
  it.n--;
  if (!it.n) inv[sel] = null;
  renderHotbar();
  return it.key;
}
const selKey = () => inv[sel]?.key || null;

// ---------- entidades: jogador e Paçoca ----------
const spawn = { x: HOME.x + .5, y: GROUND, z: HOME.z + 2.5 };
const player = { ...spawn, vx: 0, vy: 0, vz: 0, hw: .3, h: .9, yaw: Math.PI, onGround: false, hp: 100, hunger: 90, thirst: 90, hurtT: 0, downT: 0, bubble: null };
const pModel = makeDog(save.playerSkin, 1.1);
scene.add(pModel.root);

const dog = {
  x: HOME.x - 1.5, y: GROUND, z: HOME.z + 1.5, vx: 0, vy: 0, vz: 0, hw: .26, h: .8, yaw: 0, onGround: false,
  state: 'idle', mode: 'free', poseName: 'stand', timer: 0, target: null, held: null, eating: null,
  health: 100, hunger: 75, thirst: 70, happy: 70, poisonT: 0, bubble: null,
  wanderT: 1, sniffT: 25, lastObey: -99, lastPet: -99, sickWarned: false, hop: 0, moving: false, speed: 0, stuckT: 0,
};
const dModel = makeDog(save.dogSkin, .9);
scene.add(dModel.root);

let items = [];
let time = 0;

function spawnItem(key, x, y, z, extra) {
  const it = { key, x, y, z, vx: 0, vy: 0, vz: 0, rest: false, byPlayer: false, ignoreUntil: 0, pickDelay: 0, phase: Math.random() * 6, ...extra };
  it.sprite = itemSprite(key, key === 'coin' ? .45 : isBlockKey(key) ? .38 : .5);
  scene.add(it.sprite);
  items.push(it);
  return it;
}
function removeEntity(it) {
  scene.remove(it.sprite);
  it.sprite.material.dispose();
  items = items.filter(x => x !== it);
  if (dog.target === it) dogIdle();
}
function surfaceSpot(cx, cz, rMin, rMax) {
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2), r = rand(rMin, rMax);
    const x = Math.floor(cx + Math.cos(a) * r), z = Math.floor(cz + Math.sin(a) * r);
    if (x < 2 || z < 2 || x > World.W - 3 || z > World.D - 3) continue;
    const y = World.topSolid(x, z), b = World.get(x, y, z);
    if (![B.grama, B.areia, B.trilha, B.terra].includes(b)) continue;
    if (World.isSolid(World.get(x, y + 1, z)) || BLOCKS[World.get(x, y + 1, z)].water) continue;
    return { x: x + .5, y: y + 1, z: z + .5 };
  }
  return null;
}
function weightedFood() {
  const entries = Object.entries(SPAWN_WEIGHTS);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [id, w] of entries) if ((r -= w) <= 0) return id;
  return entries[0][0];
}
spawnItem('chocolate', HOME.x + 5.5, GROUND, HOME.z + 6.5);
spawnItem('cenoura', HOME.x - 4.5, GROUND, HOME.z + 5.5);
for (let i = 0; i < 8; i++) { const p = surfaceSpot(HOME.x, HOME.z, 8, 30); if (p) spawnItem(weightedFood(), p.x, p.y, p.z); }
for (let i = 0; i < 6; i++) { const p = surfaceSpot(HOME.x, HOME.z, 5, 30); if (p) spawnItem('coin', p.x, p.y, p.z); }

// ---------- UI helpers ----------
function toast(msg, type = 'info', ms = 5000) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
}
const floaters = [];
function floatText(pos, text, color = '#3b2a1e') {
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  el.style.color = color;
  $('#labels').append(el);
  floaters.push({ el, x: pos.x, y: pos.y + 1.2, z: pos.z, life: 1.4 });
}
function addCoins(n, pos) {
  save.coins = Math.max(0, save.coins + n);
  if (n > 0) { Sfx.coin(); if (pos) floatText(pos, `+${n} ossinho${n > 1 ? 's' : ''}`, '#b8860b'); }
  $('#coins').textContent = save.coins;
}
const chatLog = $('#chatLog');
function logMsg(who, text) {
  const el = document.createElement('div');
  el.className = `msg ${who}`;
  const name = who === 'you' ? (save.playerName || 'Você') : who === 'dog' ? dogName() : '';
  if (name) { const b = document.createElement('b'); b.textContent = name + ': '; el.append(b); }
  el.append(text);
  chatLog.append(el);
  while (chatLog.children.length > 40) chatLog.firstChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
  el.dataset.t = performance.now();
}
function dogSay(text, log = true) {
  if (!text) return;
  dog.bubble = { text, t: 2.8 + text.length / 22 };
  if (log) logMsg('dog', text);
}

// partículas de bloco quebrado e corações
const particles = [];
const partGeo = new THREE.BoxGeometry(.1, .1, .1);
const blockColor = {};
function colorOfBlock(id) {
  if (blockColor[id]) return blockColor[id];
  const def = BLOCKS[id], tile = def.plant || def.tiles?.side;
  let c = '#888';
  if (tile) {
    const g = World.blockIconFor(def.key).getContext('2d');
    const d = g.getImageData(24, 30, 1, 1).data;
    c = `rgb(${d[0]},${d[1]},${d[2]})`;
  }
  return (blockColor[id] = new THREE.MeshLambertMaterial({ color: c }));
}
function burst(x, y, z, mat, n = 10) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, mat);
    m.position.set(x + rand(.2, .8), y + rand(.2, .8), z + rand(.2, .8));
    scene.add(m);
    particles.push({ m, vx: rand(-2, 2), vy: rand(1, 4), vz: rand(-2, 2), life: rand(.4, .8) });
  }
}
const heartTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  Draw.heart(c.getContext('2d'), 16, 18, 2.8, '#f05a7e');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function hearts(pos, n = 3) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true }));
    s.scale.setScalar(.35);
    s.position.set(pos.x + rand(-.3, .3), pos.y + 1, pos.z + rand(-.3, .3));
    scene.add(s);
    particles.push({ m: s, vx: rand(-.3, .3), vy: rand(.8, 1.4), vz: rand(-.3, .3), life: 1.2, sprite: true });
  }
}

// ---------- câmera e mira ----------
let camYaw = Math.PI, camPitch = -0.28, camDist = 4.6;
const camTarget = new THREE.Vector3(), lookDir = new THREE.Vector3();
function updateCamera() {
  camTarget.set(player.x, player.y + 1.25, player.z);
  lookDir.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
  const back = lookDir.clone().negate();
  const hit = World.raycast(camTarget, back, camDist, World.isSolid);
  const d = hit ? Math.max(.5, hit.t - .25) : camDist;
  camera.position.copy(camTarget).addScaledVector(back, d);
  camera.lookAt(camTarget.clone().addScaledVector(lookDir, 2));
  // modelo do jogador some quando a câmera encosta nele
  pModel.root.visible = d > 1.1 || player.downT > 0;
}
const REACH = 5.5;
let aim = null;
function updateAim() {
  aim = null;
  const hit = World.raycast(camera.position, lookDir, camDist + REACH);
  if (hit) {
    const head = { x: player.x, y: player.y + .8, z: player.z };
    if (dist3(head, { x: hit.x + .5, y: hit.y + .5, z: hit.z + .5 }) <= REACH) aim = hit;
  }
  highlight.visible = !!aim && !uiBlocking();
  if (aim) highlight.position.set(aim.x + .5, aim.y + .5, aim.z + .5);
}

// ---------- ações do jogador ----------
let mining = null;
function mineTick(dt) {
  const ring = $('#mineRing');
  if (!mouseDown || !aim || player.downT > 0) { mining = null; ring.style.opacity = 0; return; }
  const def = BLOCKS[aim.b];
  if (aim.y <= 0 || def.hard >= 99) { ring.style.opacity = 0; return; }
  if (!mining || mining.x !== aim.x || mining.y !== aim.y || mining.z !== aim.z) mining = { x: aim.x, y: aim.y, z: aim.z, p: 0, tick: 0 };
  mining.p += dt / Math.max(.05, def.hard);
  mining.tick -= dt;
  if (mining.tick <= 0) { mining.tick = .22; Sfx.dig(); }
  ring.style.opacity = 1;
  ring.style.setProperty('--p', `${Math.min(1, mining.p) * 360}deg`);
  if (mining.p >= 1) {
    breakBlock(aim.x, aim.y, aim.z, aim.b);
    mining = null;
    ring.style.opacity = 0;
  }
}
function breakBlock(x, y, z, b) {
  const def = BLOCKS[b];
  burst(x, y, z, colorOfBlock(b));
  World.setBlock(x, y, z, 0);
  worldDirty = true;
  Sfx.pop();
  const pos = { x: x + .5, y, z: z + .5 };
  if (b === B.folhas || b === B.folhas_maca) {
    if (Math.random() < .3) spawnItem('graveto', pos.x, y, pos.z, { pickDelay: .3 });
    if (b === B.folhas_maca && Math.random() < .35) spawnItem('maca', pos.x, y, pos.z, { pickDelay: .3 });
    return;
  }
  if (b === B.capim) { if (Math.random() < .5) addItem('capim'); return; }
  const drop = def.drop === undefined ? def.key : def.drop;
  if (drop) { addItem(drop, def.dropN || 1); floatText(pos, `+${def.dropN || 1} ${itemName(drop).toLowerCase()}`, '#3b2a1e'); }
}
function overlapsBody(x, y, z, e) {
  return x + 1 > e.x - e.hw && x < e.x + e.hw && z + 1 > e.z - e.hw && z < e.z + e.hw && y + 1 > e.y && y < e.y + e.h;
}
function useRight() {
  if (player.downT > 0) return;
  const key = selKey();
  if (!key) return;
  if (isBlockKey(key)) {
    if (!aim) return;
    let x = aim.x + aim.n[0], y = aim.y + aim.n[1], z = aim.z + aim.n[2];
    if (BLOCKS[aim.b].plant) { x = aim.x; y = aim.y; z = aim.z; }
    const cur = World.get(x, y, z);
    if (!World.inb(x, y, z) || (cur && !BLOCKS[cur].plant && !BLOCKS[cur].water)) return;
    if (overlapsBody(x, y, z, player) || overlapsBody(x, y, z, dog)) return;
    if (BLOCKS[B[key]].plant && World.get(x, y - 1, z) !== B.grama && World.get(x, y - 1, z) !== B.terra) return toast('Plantas só pegam em grama ou terra.', 'info', 2500);
    World.setBlock(x, y, z, B[key]);
    worldDirty = true;
    takeSelected();
    Sfx.place();
    return;
  }
  if (key === 'kit_casinha') return buildDoghouse();
  if (key === 'jarra') return toast('Use a jarra no potinho azul (E) ou beba (R).', 'info', 3000);
  throwSelected(12);
}
function throwSelected(power) {
  const key = takeSelected();
  if (!key) return;
  const dir = lookDir.clone();
  dir.y = Math.max(dir.y, -.2);
  dir.normalize();
  const it = spawnItem(key, player.x + dir.x * .5, player.y + .9, player.z + dir.z * .5, {
    vx: dir.x * power, vy: dir.y * power + 4, vz: dir.z * power, byPlayer: true, pickDelay: 1.2,
  });
  player.yaw = Math.atan2(dir.x, dir.z);
  Sfx.toss();
  dogReactToThrow(it);
}
function buildDoghouse() {
  if (!aim) return toast('Mire no chão onde quer a casinha.', 'info', 2500);
  const bx = aim.x + aim.n[0], by = aim.y + aim.n[1], bz = aim.z + aim.n[2];
  const fx = Math.abs(lookDir.x) > Math.abs(lookDir.z) ? Math.sign(lookDir.x) : 0, fz = fx ? 0 : Math.sign(lookDir.z) || 1;
  // porta virada para o jogador
  const cells = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy < 3; dy++) {
    const x = bx + dx + fx * 2, z = bz + dz + fz * 2, y = by + dy;
    let b = 0;
    if (dy < 2 && (Math.abs(dx) === 1 || Math.abs(dz) === 1)) b = B.tabuas;
    if (dy < 2 && dx === -fx && dz === -fz) b = 0;
    if (dy === 2) b = B.telhas;
    if (dy === 0 && dx === 0 && dz === 0) b = B.pelucia;
    cells.push([x, y, z, b]);
  }
  for (const [x, y, z] of cells) if (World.isSolid(World.get(x, y, z)) || overlapsBody(x, y, z, player) || overlapsBody(x, y, z, dog))
    return toast('Não cabe aqui: precisa de um espaço livre 3×3×3 à sua frente.', 'info', 3500);
  for (const [x, y, z, b] of cells) if (b) World.setBlock(x, y, z, b);
  worldDirty = true;
  takeSelected();
  Sfx.good();
  toast('Casinha construída! 🏠', 'good', 2500);
  dogSay('Uma casinha nova?! Pra MIM?!');
}
function eatSelected() {
  const key = selKey();
  if (!key) return toast('Selecione uma comida na barra (1–9) e aperte R.', 'info', 3000);
  const it = ITEMS[key];
  if (key === 'jarra') {
    takeSelected();
    player.thirst = clamp(player.thirst + it.drink, 0, 100);
    player.hp = clamp(player.hp + 3, 0, 100);
    floatText(player, 'glub glub', '#2f7fd6'); Sfx.drink();
    return;
  }
  if (!it || !isEdible(key)) return toast(`Não dá pra comer ${itemName(key).toLowerCase()}.`, 'info', 2500);
  takeSelected();
  if (it.toxic) {
    player.hp -= it.dmg; player.hurtT = .6;
    toast(`Você comeu ${it.name.toLowerCase()}! −${it.dmg} de vida. ${it.fact}`, 'bad', 7000);
    floatText(player, `−${it.dmg}`, '#d64545'); Sfx.bad();
  } else {
    player.hunger = clamp(player.hunger + it.food, 0, 100);
    player.hp = clamp(player.hp + it.heal, 0, 100);
    floatText(player, 'nhac nhac', '#3fa45a'); Sfx.chomp();
  }
}

// ---------- interações (E) ----------
function interactions() {
  const p = player, key = selKey(), out = [], n = dogName();
  const add = (pos, max, label, fn) => { const d = dist2(p, pos); if (d < max && Math.abs((pos.y ?? GROUND) - p.y) < 1.6) out.push({ d, label, fn }); };
  if (key && isEdible(key)) add(dog, 2.2, `Dar ${itemName(key).toLowerCase()} para ${n}`, giveToDog);
  else add(dog, 2.2, `Fazer carinho em ${n}`, petDog);
  add({ x: faucet.position.x, z: faucet.position.z }, 1.8, "Pegar jarra d'água", () => { addItem('jarra'); Sfx.drink(); floatText(player, "+1 jarra d'água", '#2f7fd6'); });
  add({ x: bagProp.position.x, z: bagProp.position.z }, 1.8, 'Pegar ração de osso e palha', () => { addItem('racao'); floatText(player, '+1 ração', '#9a6234'); });
  add(waterBowl, 1.6, countOf('jarra') ? 'Encher potinho de água' : waterBowl.level > .1 ? 'Beber do potinho' : 'Potinho vazio (pegue água na torneira)', () => {
    if (removeItem('jarra')) fillBowl(waterBowl);
    else if (waterBowl.level > .1) { waterBowl.level = Math.max(0, waterBowl.level - .35); player.thirst = clamp(player.thirst + 25, 0, 100); Sfx.drink(); dogSay('Ei! Esse potinho é meu! ...tá bom, pode beber um pouco.'); }
  });
  add(foodBowl, 1.6, countOf('racao') ? 'Colocar ração no potinho' : foodBowl.level > .1 ? 'Comer do potinho' : 'Potinho vazio (pegue ração no saco)', () => {
    if (removeItem('racao')) fillBowl(foodBowl);
    else if (foodBowl.level > .1) { foodBowl.level = Math.max(0, foodBowl.level - .35); player.hunger = clamp(player.hunger + 20, 0, 100); Sfx.chomp(); dogSay('Hmm... você tá comendo a MINHA ração?'); }
  });
  add(VET_DOOR, 2.4, `Veterinário (${save.coins >= 5 ? '5 ossinhos' : 'grátis hoje'})`, visitVet);
  out.sort((a, b) => a.d - b.d);
  return out[0] || null;
}
function interact() {
  if (player.downT > 0) return;
  const i = interactions();
  if (i) i.fn();
}
function fillBowl(b) {
  const wasEmpty = b.level < .15;
  b.level = 1;
  if (b.kind === 'water') { Sfx.drink(); floatText(b, 'potinho cheio!', '#2f7fd6'); }
  else { Sfx.chomp(); floatText(b, 'ração servida!', '#9a6234'); }
  if (wasEmpty) addCoins(2, b);
  if (dog.state !== 'eating') dogSay(b.kind === 'water' ? 'Água fresquinha! Obrigado!' : 'RAÇÃO DE OSSO E PALHA! *baba*');
}
function visitVet() {
  if (save.coins >= 5) addCoins(-5);
  player.hp = 100; player.hunger = Math.max(player.hunger, 70); player.thirst = Math.max(player.thirst, 70);
  Object.assign(dog, { health: 100, poisonT: 0, hunger: Math.max(dog.hunger, 60), thirst: Math.max(dog.thirst, 60), sickWarned: false });
  if (dog.state === 'sick') dogIdle();
  teleportDogNear(player);
  Sfx.good();
  toast(`O veterinário cuidou de você e de ${dogName()}. Tudo 100%!`, 'good');
  dogSay('O doutor me deu um petisco! Tô novinho em folha!');
}

// ---------- Paçoca ----------
function dogIdle() { dog.state = 'idle'; dog.target = null; }
function setPose(name, dur) { dog.state = 'pose'; dog.poseName = name; dog.timer = dur; dog.target = null; }
const dogBusy = () => ['eating', 'bowlUse', 'sick'].includes(dog.state);
function teleportDogNear(e) {
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), x = e.x + Math.cos(a) * 1.5, z = e.z + Math.sin(a) * 1.5;
    if (!World.boxHits(x, e.y, z, dog.hw, dog.h)) { Object.assign(dog, { x, y: e.y, z, vx: 0, vy: 0, vz: 0 }); return; }
  }
  Object.assign(dog, { x: e.x, y: e.y, z: e.z });
}
// Anda em direção a (tx,tz); pula degraus. Retorna true ao chegar.
function dogMoveTo(tx, tz, speed, arrive) {
  const dx = tx - dog.x, dz = tz - dog.z, d = Math.hypot(dx, dz);
  if (d <= arrive) return true;
  const sp = dog.inWater ? speed * .6 : speed;
  dog.vx = dx / d * sp; dog.vz = dz / d * sp;
  dog.yaw = Math.atan2(dx, dz);
  dog.moving = true; dog.speed = sp;
  if (dog.wantJump && dog.onGround) { dog.vy = 8.5; dog.wantJump = false; }
  return false;
}
function dogReactToThrow(it) {
  const n = dogName();
  if (dogBusy() || dog.state === 'fetchBack') return;
  if (dog.mode === 'stay') { if (it.key === 'graveto') dogSay('*treme de vontade* ...mas você mandou eu ficar!'); return; }
  if (dog.state === 'pose' && dog.poseName === 'sleep') { dogSay('*ronc* ...zzz', false); return; }
  if (it.key === 'graveto' || it.key === 'osso') {
    dog.state = 'fetchGo'; dog.target = it;
    dogSay(pick(['GRAVETO! *dispara*', 'Eu pego! Eu pego!', '*sai em disparada*']), false);
  } else if (isEdible(it.key)) {
    const food = ITEMS[it.key];
    if (food.toxic && learned(it.key)) { dogSay(`*cheira de longe* ${food.name}? Você me ensinou que isso faz mal. Não vou!`); return; }
    dog.state = 'eatGo'; dog.target = it;
    dogSay('Comida voando?! É pra mim?!', false);
    if (food.toxic) toast(`${n} está correndo atrás de ${food.name.toLowerCase()}! Diga "larga!" ou "não!" (Enter abre o chat).`, 'warn', 6000);
  }
}
function dogDrop() {
  const d = dog, n = dogName();
  if (d.state === 'eating' && d.eating) {
    const id = d.eating.id, food = ITEMS[id];
    spawnItem(id, d.x + Math.sin(d.yaw) * .6, d.y + .2, d.z + Math.cos(d.yaw) * .6, { ignoreUntil: time + 30, pickDelay: .5 });
    d.eating = null; dogIdle();
    if (food.toxic) {
      addCoins(3, d);
      toast(`Boa! Você impediu ${n} de comer ${food.name.toLowerCase()}. ${food.fact}`, 'good', 6500);
      if (!learned(id)) save.learned.push(id);
      return `*cospe* Tá bom... ${food.name}? Entendi, faz mal. Vou lembrar!`;
    }
    return 'Tá bom… larguei. *olhar de pidão*';
  }
  if (d.state === 'eatGo' && d.target) {
    const id = d.target.key, food = ITEMS[id];
    d.target.ignoreUntil = time + 30;
    dogIdle();
    if (food.toxic) {
      addCoins(2, d);
      toast(`Boa! ${n} deixou ${food.name.toLowerCase()} pra lá. ${food.fact}`, 'good', 6500);
      if (!learned(id)) save.learned.push(id);
      return `Ok, não vou comer! ${food.name} faz mal, né? Vou lembrar.`;
    }
    return 'Ok, ok, não vou comer...';
  }
  if (d.held) {
    spawnItem(d.held, d.x + Math.sin(d.yaw) * .6, d.y + .2, d.z + Math.cos(d.yaw) * .6, { pickDelay: .3 });
    d.held = null; dModel.setHeld(null); dogIdle();
    return '*solta o graveto* Pronto! Joga de novo?';
  }
  return 'Larguei o quê? Não tô com nada na boca!';
}
const TRICKS = ['sit', 'lie', 'roll', 'paw', 'come', 'bark', 'jump', 'fetch'];
function dogCommand(a) {
  const d = dog;
  if (a === 'drop') return dogDrop();
  if (d.state === 'sick') return '*ganido* Tô doente… me leva no veterinário? É o prédio branco com a cruz vermelha.';
  if (d.state === 'eating') return '*continua mastigando* Hmpf… só um segundo…';
  if (d.state === 'bowlUse') return '*com a cara no potinho* Já vou!';
  if (d.state === 'fetchBack' && a !== 'fetch') return '*com o graveto na boca* Mmmf! Já tô levando!';
  const facePlayer = () => { d.yaw = Math.atan2(player.x - d.x, player.z - d.z); };
  switch (a) {
    case 'sit': facePlayer(); setPose('sit', 6); break;
    case 'lie': setPose('lie', 7); break;
    case 'roll': setPose('roll', 1.1); break;
    case 'paw': facePlayer(); setPose('paw', 2.5); break;
    case 'jump': setPose('jump', 1.2); break;
    case 'sleep': setPose('sleep', 14); break;
    case 'bark': Sfx.bark(); setPose('jump', .4); break;
    case 'come': if (d.mode === 'stay') d.mode = 'free'; d.state = 'come'; break;
    case 'stay': d.mode = 'stay'; dogIdle(); break;
    case 'follow': d.mode = 'follow'; dogIdle(); break;
    case 'free': d.mode = 'free'; dogIdle(); break;
    case 'fetch': {
      const sticks = items.filter(i => i.key === 'graveto' || i.key === 'osso').sort((a, b) => dist2(a, d) - dist2(b, d));
      if (!sticks.length || dist2(sticks[0], d) > 30) return 'Cadê o graveto? Joga um pra mim! (clique direito com o graveto na barra)';
      if (d.mode === 'stay') d.mode = 'free';
      d.state = 'fetchGo'; d.target = sticks[0];
      break;
    }
  }
  d.happy = clamp(d.happy + 3, 0, 100);
  if (TRICKS.includes(a) && time - d.lastObey > 12) { d.lastObey = time; addCoins(1, d); }
  return null;
}
function petDog() {
  const d = dog;
  if (d.state === 'pose' && d.poseName === 'sleep') { dogIdle(); dogSay('*boceja* Hmm? Ah, é você! Carinho?'); }
  d.happy = clamp(d.happy + 10, 0, 100);
  d.yaw = Math.atan2(player.x - d.x, player.z - d.z);
  hearts(d);
  if (!dogBusy() && d.state !== 'fetchGo' && d.state !== 'eatGo') setPose('sit', 1.6);
  if (time - d.lastPet > 15) { d.lastPet = time; addCoins(1, d); }
  dogSay(pick(['*fecha os olhinhos* Aaah, aí mesmo...', 'Atrás da orelha! ATRÁS DA ORELHA!', '*perna de trás chuta sozinha*', '*encosta em você* Melhor amigo.', 'Mais! Mais um pouquinho!']), false);
}
function giveToDog() {
  const key = selKey(), food = ITEMS[key], d = dog;
  if (d.state === 'sick' && food.toxic) return dogSay('*vira o focinho* Já tô mal... não quero isso.');
  if (food.toxic && learned(key)) { d.happy = clamp(d.happy + 2, 0, 100); return dogSay(`*cheira* ${food.name}... Você me ensinou que faz mal. Não vou comer, mas obrigado por pensar em mim!`); }
  if (dogBusy()) return dogSay('Agora não, tô ocupado!');
  takeSelected();
  startEating(key);
  if (food.toxic) toast(`${dogName()} confiou em você e está comendo ${food.name.toLowerCase()}! Rápido: diga "larga!" (Enter)`, 'warn', 6000);
}
function startEating(id) {
  dog.eating = { id, t: 2.6 };
  dog.state = 'eating'; dog.target = null;
  dogSay('*nhac nhac nhac*', false);
  Sfx.chomp();
}
function finishEating() {
  const d = dog, id = d.eating.id, food = ITEMS[id], n = dogName();
  d.eating = null; dogIdle();
  if (food.toxic) {
    d.health = clamp(d.health - food.dmg, 1, 100);
    d.poisonT = 25; d.happy = clamp(d.happy - 10, 0, 100);
    Sfx.bad();
    floatText(d, `−${food.dmg}`, '#d64545');
    toast(`${n} comeu ${food.name.toLowerCase()}! −${food.dmg} de saúde. ${food.fact}`, 'bad', 7500);
    dogSay('*ganido* Ai... minha barriga... não tô me sentindo bem.');
  } else {
    d.hunger = clamp(d.hunger + food.food, 0, 100);
    d.health = clamp(d.health + food.heal, 0, 100);
    d.happy = clamp(d.happy + 6, 0, 100);
    dogSay(pick(['Delícia!', 'Hmm, que bom! Obrigado!', '*lambe o focinho* Tem mais?']), false);
  }
}
function dogNeeds() {
  const d = dog;
  if (dist2(d, foodBowl) > 40) return false;
  if (d.hunger < 45 && foodBowl.level > .05) { d.state = 'bowlGo'; d.target = foodBowl; return true; }
  if (d.thirst < 45 && waterBowl.level > .05) { d.state = 'bowlGo'; d.target = waterBowl; return true; }
  return false;
}
function dogThink(dt) {
  const d = dog, n = dogName();
  if (d.mode === 'stay') return;
  if (dogNeeds()) return;
  if ((d.sniffT -= dt) <= 0) {
    d.sniffT = rand(7, 12);
    if (d.hunger < 80) {
      const near = items.filter(it => isEdible(it.key) && it.rest && it.ignoreUntil < time && dist2(it, d) < 9 && !(ITEMS[it.key].toxic && learned(it.key)))
        .sort((a, b) => dist2(a, d) - dist2(b, d))[0];
      if (near) {
        d.state = 'eatGo'; d.target = near;
        const food = ITEMS[near.key];
        dogSay(`*fareja* Hmm... cheiro de ${food.name.toLowerCase()}...`, false);
        if (food.toxic) toast(`${n} farejou ${food.name.toLowerCase()} e está indo comer! Diga "não!" ou "larga!" (Enter)`, 'warn', 6000);
        return;
      }
    }
  }
  const dp = dist2(d, player);
  if (d.mode === 'follow') {
    if (dp > 2.6) dogMoveTo(player.x - Math.sin(player.yaw) * 1.4, player.z - Math.cos(player.yaw) * 1.4, dp > 8 ? 7 : 4.5, 1);
    return;
  }
  if (dp > 12) { d.state = 'wander'; d.target = { x: player.x + rand(-3, 3), z: player.z + rand(-3, 3) }; return; }
  if ((d.wanderT -= dt) <= 0) {
    d.wanderT = rand(2, 5);
    if (Math.random() < .6) { d.state = 'wander'; d.target = { x: player.x + rand(-6, 6), z: player.z + rand(-6, 6) }; }
  }
}
function updateDog(dt) {
  const d = dog, n = dogName();
  d.moving = false; d.speed = 0; d.hop = 0; d.vx = 0; d.vz = 0;
  d.hunger = clamp(d.hunger - dt * .4, 0, 100);
  d.thirst = clamp(d.thirst - dt * .55, 0, 100);
  d.happy = clamp(d.happy - dt * .2, 0, 100);
  d.poisonT -= dt;
  if (d.hunger <= 0 || d.thirst <= 0) d.health -= dt * .8;
  else if (d.hunger > 50 && d.thirst > 50 && d.poisonT <= 0) d.health += dt * .4;
  d.health = clamp(d.health, 1, 100);
  if (d.bubble && (d.bubble.t -= dt) <= 0) d.bubble = null;

  if (d.health < 20 && !['sick', 'eating', 'bowlGo', 'bowlUse'].includes(d.state)) {
    d.state = 'sick'; d.target = null;
    if (d.held) { d.held = null; dModel.setHeld(null); }
    if (!d.sickWarned) {
      d.sickWarned = true;
      dogSay('*ganido* Não tô bem... me leva no veterinário?');
      toast(`${n} está doente! Leve ao veterinário (prédio branco com a cruz vermelha).`, 'bad', 7000);
    }
  }

  switch (d.state) {
    case 'sick': if (d.health >= 35) { d.sickWarned = false; dogIdle(); } break;
    case 'idle': dogThink(dt); break;
    case 'wander': if (dogMoveTo(d.target.x, d.target.z, 2.6, .4)) dogIdle(); dogNeeds(); break;
    case 'come':
      if (dogMoveTo(player.x + Math.sin(camYaw) * 1.3, player.z + Math.cos(camYaw) * 1.3, 7, .6)) { d.yaw = Math.atan2(player.x - d.x, player.z - d.z); setPose('sit', 3); }
      break;
    case 'fetchGo': {
      const it = d.target;
      if (!items.includes(it)) { dogIdle(); break; }
      if (dogMoveTo(it.x, it.z, 7.5, .5) && it.rest) {
        d.held = it.key;
        dModel.setHeld(itemSprite(it.key, .45));
        removeEntity(it);
        d.state = 'fetchBack';
      }
      break;
    }
    case 'fetchBack':
      if (dogMoveTo(player.x, player.z, 7, 1.2)) {
        spawnItem(d.held, d.x, d.y + .3, d.z, { pickDelay: .2 });
        d.held = null; dModel.setHeld(null);
        d.happy = clamp(d.happy + 15, 0, 100);
        d.yaw = Math.atan2(player.x - d.x, player.z - d.z);
        hearts(d, 2);
        addCoins(2, d);
        setPose('jump', .8);
        dogSay(pick(['Trouxe! De novo! DE NOVO!', '*solta o graveto e encara* Joga!', 'Peguei! Sou rápido, né?']), false);
      }
      break;
    case 'eatGo': {
      const it = d.target;
      if (!items.includes(it)) { dogIdle(); break; }
      if (dogMoveTo(it.x, it.z, it.byPlayer ? 6 : 3.4, .5) && it.rest) { const key = it.key; removeEntity(it); startEating(key); }
      break;
    }
    case 'eating': if ((d.eating.t -= dt) <= 0) finishEating(); break;
    case 'bowlGo':
      if (d.target.level <= .05) { dogIdle(); break; }
      if (dogMoveTo(d.target.x, d.target.z + .7, 4, .25)) { d.yaw = Math.PI; d.state = 'bowlUse'; d.timer = 2.5; if (d.target.kind === 'food') Sfx.chomp(); else Sfx.drink(); }
      break;
    case 'bowlUse': {
      const b = d.target;
      if ((d.timer -= dt) <= 0) {
        if (b.kind === 'food') { d.hunger = clamp(d.hunger + 55 * b.level, 0, 100); d.health = clamp(d.health + 8, 0, 100); dogSay('Ração de osso e palha é a melhor! *arroto*', false); }
        else { d.thirst = clamp(d.thirst + 60 * b.level, 0, 100); dogSay('*slurp slurp* Ahhh, que água boa!', false); }
        b.level = 0;
        d.happy = clamp(d.happy + 5, 0, 100);
        dogIdle();
      }
      break;
    }
    case 'pose':
      if (d.poseName === 'jump') d.hop = Math.abs(Math.sin(time * 9)) * .35;
      if (d.poseName === 'sleep') d.happy = clamp(d.happy + dt * .5, 0, 100);
      if ((d.timer -= dt) <= 0) dogIdle();
      break;
  }

  // física
  d.vy -= 26 * dt;
  if (d.inWater) d.vy = Math.max(d.vy, -2) + (d.moving ? 18 * dt : 0);
  const px = d.x, pz = d.z;
  World.moveBody(d, dt);
  if (d.moving && d.hitWall && d.onGround) d.wantJump = true;
  const moved = Math.hypot(d.x - px, d.z - pz);
  d.stuckT = d.moving && moved < dt * .5 ? d.stuckT + dt : 0;
  if (d.y < -5 || (d.mode !== 'stay' && (d.stuckT > 2.5 || dist2(d, player) > 40))) { d.stuckT = 0; teleportDogNear(player); }
}
function dogPose() {
  const d = dog;
  if (d.state === 'pose') return d.poseName === 'jump' ? 'stand' : d.poseName;
  if (d.state === 'sick') return 'sick';
  if (d.state === 'idle' && d.mode === 'stay') return 'sit';
  return 'stand';
}

// ---------- chat ----------
function sendChat(text) {
  text = text.trim();
  if (!text) return;
  logMsg('you', text);
  player.bubble = { text, t: 2.5 + text.length / 30 };
  const r = DogBrain.respond(text, {
    dogName: dogName(), playerName: save.playerName, coatName: COATS[save.dogSkin.coat].name,
    hunger: dog.hunger, thirst: dog.thirst, health: dog.health, happy: dog.happy,
    sick: dog.state === 'sick', learned: save.learned,
  });
  if (r.dogName) { save.dogName = r.dogName; refreshNames(); }
  if (r.playerName) save.playerName = r.playerName;
  if (r.learn && !learned(r.learn)) save.learned.push(r.learn);
  if (r.happy) dog.happy = clamp(dog.happy + r.happy, 0, 100);
  let reply = r.text;
  if (r.action) { const o = dogCommand(r.action); if (o) reply = o; }
  setTimeout(() => dogSay(reply), 250);
}

// ---------- entrada ----------
const keys = {};
let mouseDown = false, locked = false, chatOpen = false;
const chatInput = $('#chatInput');
const modalOpen = () => !$('#inventory').hidden || !$('#wardrobe').hidden;
const uiBlocking = () => modalOpen() || !$('#lock').hidden;
const paused = () => uiBlocking();

const showLock = () => { if (!modalOpen() && !chatOpen && !locked) $('#lock').hidden = false; };
function lockPointer() {
  try { const r = canvas.requestPointerLock?.(); r?.catch?.(showLock); } catch { showLock(); }
}
document.addEventListener('pointerlockerror', showLock);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) { mouseDown = false; for (const k in keys) keys[k] = false; }
  if (!locked && !modalOpen() && !chatOpen) $('#lock').hidden = false;
  if (locked) $('#lock').hidden = true;
});
$('#btnPlay').addEventListener('click', e => { e.stopPropagation(); $('#lock').hidden = true; lockPointer(); });
canvas.addEventListener('click', () => { if (!locked && !modalOpen()) lockPointer(); });

addEventListener('mousemove', e => {
  if (!locked) return;
  camYaw -= e.movementX * .0026;
  camPitch = clamp(camPitch - e.movementY * .0022, -1.25, .9);
});
addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) useRight();
});
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('contextmenu', e => { if (locked) e.preventDefault(); });
addEventListener('wheel', e => {
  if (!locked) return;
  sel = (sel + (e.deltaY > 0 ? 1 : 8)) % 9;
  renderHotbar(true);
});

function openChat() {
  chatOpen = true;
  $('#chat').classList.add('open');
  document.exitPointerLock?.();
  setTimeout(() => chatInput.focus(), 0);
}
function closeChat(relock = true) {
  chatOpen = false;
  $('#chat').classList.remove('open');
  chatInput.blur();
  if (relock && !modalOpen()) { $('#lock').hidden = true; lockPointer(); }
}
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat(chatInput.value); chatInput.value = ''; closeChat(); });
document.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => { sendChat(b.dataset.say); closeChat(); }));

addEventListener('keydown', e => {
  if (document.activeElement === chatInput) { if (e.key === 'Escape') { e.preventDefault(); closeChat(); } return; }
  if (document.activeElement?.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (modalOpen()) {
    if (k === 'escape' || (k === 'i' && !$('#inventory').hidden) || (k === 'c' && !$('#wardrobe').hidden)) closeModals();
    return;
  }
  if (k === 'enter') { e.preventDefault(); openChat(); return; }
  if (!locked) return;
  if ([' ', 'tab'].includes(k)) e.preventDefault();
  keys[k] = true;
  if (e.repeat) return;
  if (k >= '1' && k <= '9') { sel = +k - 1; renderHotbar(true); }
  else if (k === 'e') interact();
  else if (k === 'r') eatSelected();
  else if (k === 'q') throwSelected(3);
  else if (k === 'i' || k === 'tab') openInventory();
  else if (k === 'c') openWardrobe();
  else if (k === 'f5' || k === 'v') camDist = camDist > 3 ? 1.6 : 4.6;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });

// ---------- jogador ----------
function updatePlayer(dt) {
  const p = player;
  p.hurtT -= dt;
  if (p.bubble && (p.bubble.t -= dt) <= 0) p.bubble = null;
  p.hunger = clamp(p.hunger - dt * .3, 0, 100);
  p.thirst = clamp(p.thirst - dt * .42, 0, 100);
  if (p.hunger <= 0 || p.thirst <= 0) p.hp -= dt * 1.5;
  else if (p.hunger > 40 && p.thirst > 40) p.hp = Math.min(100, p.hp + dt * .6);

  if (p.downT > 0) {
    if ((p.downT -= dt) <= 0) {
      Object.assign(p, { x: VET_DOOR.x, y: GROUND, z: VET_DOOR.z + 1.5, vx: 0, vy: 0, vz: 0, hp: 60, hunger: 60, thirst: 60 });
      teleportDogNear(p); dogIdle();
      toast('Você acordou no veterinário. Cuidado com o que come!', 'info');
    }
    return;
  }
  if (p.hp <= 0) {
    p.hp = 0; p.downT = 1.6;
    addCoins(-Math.min(5, save.coins));
    toast('Você passou mal e desmaiou! Perdeu até 5 ossinhos.', 'bad', 6000);
    return;
  }
  let f = 0, s = 0;
  if (keys.w || keys.arrowup) f += 1;
  if (keys.s || keys.arrowdown) f -= 1;
  if (keys.a || keys.arrowleft) s -= 1;
  if (keys.d || keys.arrowright) s += 1;
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  let mx = fx * f + rx * s, mz = fz * f + rz * s;
  const len = Math.hypot(mx, mz);
  const sp = (keys.shift ? 6.6 : 4.3) * (p.inWater ? .55 : 1);
  if (len > 0) { mx /= len; mz /= len; p.yaw = lerpAngle(p.yaw, Math.atan2(mx, mz), Math.min(1, dt * 12)); }
  else if (mouseDown && aim) p.yaw = lerpAngle(p.yaw, camYaw, Math.min(1, dt * 10));
  const accel = p.onGround ? 14 : 5;
  p.vx = lerp(p.vx, mx * sp, Math.min(1, dt * accel));
  p.vz = lerp(p.vz, mz * sp, Math.min(1, dt * accel));
  p.vy -= 26 * dt;
  if (p.inWater) { p.vy = Math.max(p.vy, -2.5); if (keys[' ']) p.vy = 3.2; }
  else if (keys[' '] && p.onGround) p.vy = 8.6;
  World.moveBody(p, dt);
  p.moving = len > 0;
  if (p.y < -10) Object.assign(p, { ...spawn, vy: 0 });

  for (const it of [...items]) {
    if (it.pickDelay > 0 || !it.rest) continue;
    if (dist3(it, { x: p.x, y: p.y + .3, z: p.z }) < 1.3) {
      if (it.key === 'coin') { addCoins(1, it); removeEntity(it); }
      else if (addItem(it.key)) { Sfx.pop(); removeEntity(it); }
    }
  }
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

// ---------- itens no mundo ----------
function updateItems(dt) {
  for (const it of items) {
    it.pickDelay -= dt;
    if (it.rest) {
      if (!World.isSolid(World.get(Math.floor(it.x), Math.floor(it.y - .05), Math.floor(it.z)))) it.rest = false;
      continue;
    }
    it.vy -= 22 * dt;
    let nx = it.x + it.vx * dt, ny = it.y + it.vy * dt, nz = it.z + it.vz * dt;
    if (World.isSolid(World.get(Math.floor(nx), Math.floor(it.y + .1), Math.floor(nz)))) { it.vx *= -.2; it.vz *= -.2; nx = it.x; nz = it.z; }
    if (World.isSolid(World.get(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
      if (it.vy < 0) { ny = Math.floor(ny) + 1; it.rest = true; it.vx = it.vz = it.vy = 0; }
      else { it.vy = 0; ny = it.y; }
    }
    if (BLOCKS[World.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))].water) { it.vx *= .9; it.vz *= .9; it.vy = Math.max(it.vy, -1); }
    it.x = clamp(nx, 1, World.W - 1); it.y = ny; it.z = clamp(nz, 1, World.D - 1);
    if (it.y < -5) it.gone = true;
  }
  for (const it of items.filter(i => i.gone)) removeEntity(it);
  for (const it of items) it.sprite.position.set(it.x, it.y + .3 + (it.rest ? Math.sin(time * 2.5 + it.phase) * .06 : 0), it.z);
}

// ---------- dia e noite ----------
const DAY_LEN = 480;
const C = (h) => new THREE.Color(h);
const PAL = {
  day: { top: C('#4f92da'), hor: C('#c2e0f4'), fog: C('#c4ddef'), sunI: 2.6, hemiI: 1.15 },
  dusk: { top: C('#4c76b8'), hor: C('#ffb468'), fog: C('#f0b48a'), sunI: 1.6, hemiI: .8 },
  night: { top: C('#03050c'), hor: C('#14204a'), fog: C('#0b1330'), sunI: .35, hemiI: .32 },
};
const tmpC = new THREE.Color();
function updateSky(dt) {
  save.dayT = (save.dayT + dt / DAY_LEN) % 1;
  const a = save.dayT * Math.PI * 2, sy = Math.sin(a);
  const sunDir = new THREE.Vector3(Math.cos(a) * .8, sy, .45).normalize();
  const dayK = clamp(sy * 3 + .3, 0, 1), duskK = clamp(1 - Math.abs(sy) * 4, 0, 1);
  const mix = (k) => {
    const base = PAL.night[k].clone().lerp(PAL.day[k], dayK);
    return base.lerp(PAL.dusk[k], duskK * .7);
  };
  skyUni.top.value.copy(mix('top'));
  skyUni.hor.value.copy(mix('hor'));
  scene.fog.color.copy(mix('fog'));
  skyUni.sunDir.value.copy(sunDir);
  skyUni.sunOn.value = clamp(sy * 5 + .5, 0, 1);
  skyUni.stars.value = 1 - dayK;
  skyUni.time.value = time;
  const lightDir = sy > -.05 ? sunDir : sunDir.clone().negate();
  sun.position.set(player.x, player.y, player.z).addScaledVector(lightDir, 80);
  sun.target.position.set(player.x, player.y, player.z);
  sun.intensity = lerp(PAL.night.sunI, lerp(PAL.day.sunI, PAL.dusk.sunI, duskK * .7), dayK);
  sun.color.copy(tmpC.set(sy > -.05 ? '#fff1d6' : '#93aaff'));
  hemi.intensity = lerp(PAL.night.hemiI, PAL.day.hemiI, dayK);
  clouds.userData.mat.color.copy(tmpC.set('#ffffff').lerp(C('#1b2238'), 1 - dayK));
  clouds.userData.mat.emissiveIntensity = .4 * dayK;
  clouds.position.x = (time * .6) % 64;
  sky.position.copy(camera.position);
  const hour = (save.dayT * 24 + 6) % 24;
  $('#clock').textContent = `${dayK > .5 ? '☀️' : '🌙'} ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
}

// ---------- HUD ----------
const bars = {};
document.querySelectorAll('[data-bar]').forEach(el => { bars[el.dataset.bar] = el; });
function setBar(key, v) {
  const el = bars[key];
  el.querySelector('i').style.width = `${clamp(v, 0, 100)}%`;
  el.classList.toggle('low', v < 25);
}
const hotbar = $('#hotbar');
let labelT = 0;
function slotEl(it) {
  const el = document.createElement('div');
  el.className = 'slot';
  if (it) {
    const img = itemIcon(it.key);
    const c = document.createElement('canvas'); c.width = c.height = 48;
    c.getContext('2d').drawImage(img, 0, 0);
    el.append(c);
    if (it.n > 1) { const n = document.createElement('b'); n.textContent = it.n; el.append(n); }
    el.title = itemName(it.key);
  }
  return el;
}
function renderHotbar(showLabel) {
  hotbar.replaceChildren();
  for (let i = 0; i < 9; i++) {
    const el = slotEl(inv[i]);
    if (i === sel) el.classList.add('sel');
    const k = document.createElement('i'); k.textContent = i + 1; el.append(k);
    el.addEventListener('click', () => { sel = i; renderHotbar(true); });
    hotbar.append(el);
  }
  if (showLabel) {
    const it = inv[sel];
    $('#heldLabel').textContent = it ? itemName(it.key) + (isEdible(it.key) ? ' · R come · clique dir. joga' : isBlockKey(it.key) ? ' · clique dir. coloca' : it.key === 'jarra' ? ' · R bebe · E no potinho' : ' · clique dir. joga') : '';
    $('#heldLabel').classList.add('show');
    labelT = 2.5;
  }
  if (!$('#inventory').hidden) renderInventory();
}
let hudT = 0;
const tmpV = new THREE.Vector3();
function project(x, y, z) {
  tmpV.set(x, y, z).project(camera);
  if (tmpV.z > 1) return null;
  return { x: (tmpV.x * .5 + .5) * innerWidth, y: (-tmpV.y * .5 + .5) * innerHeight };
}
const dogLabel = document.createElement('div'); dogLabel.className = 'nametag dog';
const youLabel = document.createElement('div'); youLabel.className = 'nametag you';
const dogBubble = document.createElement('div'); dogBubble.className = 'bubble';
const youBubble = document.createElement('div'); youBubble.className = 'bubble you';
$('#labels').append(dogLabel, youLabel, dogBubble, youBubble);
function placeEl(el, pos, show) {
  if (!pos || !show) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.style.transform = `translate(-50%, -100%) translate(${pos.x}px, ${pos.y}px)`;
}
function updateHud(dt) {
  const dp = project(dog.x, dog.y + 1.25, dog.z), pp = project(player.x, player.y + 1.45, player.z);
  const near = dist3(camera.position, dog) < 30;
  if (dog.bubble) { dogBubble.textContent = dog.bubble.text; placeEl(dogBubble, dp, near); placeEl(dogLabel, null); }
  else {
    placeEl(dogBubble, null);
    dogLabel.textContent = dogName() + (dog.mode === 'stay' ? ' · parado' : dog.mode === 'follow' ? ' · seguindo' : '');
    placeEl(dogLabel, dp, near);
  }
  if (player.bubble) { youBubble.textContent = player.bubble.text; placeEl(youBubble, pp, pModel.root.visible); }
  else placeEl(youBubble, null);
  youLabel.textContent = save.playerName || 'Você';
  placeEl(youLabel, pp, !player.bubble && pModel.root.visible);

  for (const f of floaters) {
    f.life -= dt; f.y += dt * .8;
    const p = project(f.x, f.y, f.z);
    placeEl(f.el, p, f.life > 0);
    f.el.style.opacity = Math.min(1, f.life);
    if (f.life <= 0) f.el.remove();
  }
  for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].life <= 0) floaters.splice(i, 1);

  const it = !uiBlocking() && player.downT <= 0 ? interactions() : null;
  const pr = $('#prompt');
  pr.style.display = it ? '' : 'none';
  if (it) pr.innerHTML = `<kbd>E</kbd> ${escapeHtml(it.label)}`;

  if ((labelT -= dt) <= 0) $('#heldLabel').classList.remove('show');
  const now = performance.now();
  for (const m of chatLog.children) m.classList.toggle('old', now - m.dataset.t > 12000);

  if ((hudT -= dt) > 0) return;
  hudT = .15;
  setBar('p-hp', player.hp); setBar('p-hunger', player.hunger); setBar('p-thirst', player.thirst);
  setBar('d-health', dog.health); setBar('d-hunger', dog.hunger); setBar('d-thirst', dog.thirst); setBar('d-happy', dog.happy);
  $('#dogMood').textContent = dog.state === 'sick' ? 'doente' : dog.state === 'eating' ? 'comendo' : dog.state === 'pose' && dog.poseName === 'sleep' ? 'dormindo' : dog.happy > 70 ? 'muito feliz' : dog.happy > 35 ? 'tranquilo' : 'entediado';
  $('#coins').textContent = save.coins;
  document.body.classList.toggle('hurt', player.hurtT > 0);
  document.body.classList.toggle('down', player.downT > 0);
}
const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function refreshNames() {
  document.querySelectorAll('[data-dogname]').forEach(el => { el.textContent = dogName(); });
  $('#coins').textContent = save.coins;
  chatInput.placeholder = `Fale com ${dogName()}… (Enter envia, Esc fecha)`;
}

// ---------- inventário e criação ----------
let invPick = null;
function openInventory() { document.exitPointerLock?.(); $('#inventory').hidden = false; $('#lock').hidden = true; invPick = null; renderInventory(); }
function renderInventory() {
  const grid = $('#invGrid');
  grid.replaceChildren();
  for (let i = 0; i < INV_SIZE; i++) {
    const el = slotEl(inv[i]);
    if (i < 9) el.classList.add('hot');
    if (i === invPick) el.classList.add('picked');
    el.addEventListener('click', () => {
      if (invPick === null) { if (inv[i]) invPick = i; }
      else {
        const a = inv[invPick], b = inv[i];
        if (b && a && a.key === b.key && invPick !== i) { const k = Math.min(a.n, STACK - b.n); b.n += k; a.n -= k; if (!a.n) inv[invPick] = null; }
        else { inv[invPick] = b; inv[i] = a; }
        invPick = null;
      }
      renderHotbar(); renderInventory();
    });
    grid.append(el);
  }
  const box = $('#recipes');
  box.replaceChildren();
  for (const r of RECIPES) {
    const ok = Object.entries(r.need).every(([k, n]) => countOf(k) >= n);
    const row = document.createElement('div');
    row.className = `recipe${ok ? '' : ' missing'}`;
    const out = slotEl({ key: r.out, n: r.n });
    const info = document.createElement('div');
    info.className = 'rinfo';
    const title = document.createElement('b'); title.textContent = `${itemName(r.out)}${r.n > 1 ? ' ×' + r.n : ''}`;
    const need = document.createElement('small');
    need.textContent = Object.entries(r.need).map(([k, n]) => `${n} ${itemName(k).toLowerCase()} (${countOf(k)})`).join(' + ');
    info.append(title, need);
    const btn = document.createElement('button');
    btn.className = 'btn small'; btn.textContent = 'Criar'; btn.disabled = !ok;
    btn.addEventListener('click', () => {
      if (!Object.entries(r.need).every(([k, n]) => countOf(k) >= n)) return;
      for (const [k, n] of Object.entries(r.need)) removeItem(k, n);
      addItem(r.out, r.n);
      Sfx.good();
      renderInventory();
    });
    row.append(out, info, btn);
    box.append(row);
  }
}

// ---------- guarda-roupa ----------
let wardrobeWho = 'player', previewRAF = 0;
const pv = { renderer: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, 300 / 240, .1, 50), model: null };
pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x8fbf6a, 1.6));
{ const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(2, 3, 2); pv.scene.add(l); }
const pvGround = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .1, 24), lamb('#8fcf6a'));
pvGround.position.y = -.05; pv.scene.add(pvGround);
pv.cam.position.set(1.8, 1.3, 2.4); pv.cam.lookAt(0, .45, 0);
function closeModals() {
  $('#inventory').hidden = true; $('#wardrobe').hidden = true;
  cancelAnimationFrame(previewRAF);
  $('#lock').hidden = true;
  lockPointer();
}
function openWardrobe() {
  document.exitPointerLock?.();
  $('#wardrobe').hidden = false; $('#lock').hidden = true;
  if (!pv.renderer) {
    pv.renderer = new THREE.WebGLRenderer({ canvas: $('#preview'), antialias: true, alpha: true });
    pv.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    pv.renderer.setSize(300, 240, false);
  }
  renderWardrobe();
  const loop = () => {
    if (pv.model) { pv.model.root.rotation.y += .012; pv.model.animate(1 / 60, { moving: false, wag: 12, pant: true }); }
    pv.renderer.render(pv.scene, pv.cam);
    previewRAF = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(previewRAF);
  previewRAF = requestAnimationFrame(loop);
}
function swatch(kind, key) {
  if (kind === 'coat') { const c = COATS[key]; return `linear-gradient(135deg, ${c.base} 55%, ${c.ear} 55%)`; }
  if (kind === 'collar') { const c = COLLARS[key]; return c.rainbow ? 'linear-gradient(90deg,#e84a4a,#f2d83a,#4cc06a,#3a8ef2,#9a5bd6)' : c.color; }
  return null;
}
function renderWardrobe() {
  const skin = wardrobeWho === 'player' ? save.playerSkin : save.dogSkin;
  if (pv.model) pv.scene.remove(pv.model.root);
  pv.model = makeDog(skin, 1.3);
  pv.scene.add(pv.model.root);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.who === wardrobeWho));
  $('#nameLabel').textContent = wardrobeWho === 'player' ? 'Seu nome' : 'Nome do cachorro';
  $('#nameInput').value = wardrobeWho === 'player' ? save.playerName : save.dogName;
  $('#wrCoins').textContent = save.coins;
  document.querySelectorAll('.grid[data-kind]').forEach(grid => {
    const kind = grid.dataset.kind;
    grid.replaceChildren();
    for (const [key, def] of Object.entries(CATALOG[kind])) {
      const owned = isUnlocked(kind, key), on = skin[kind] === key;
      const b = document.createElement('button');
      b.className = `opt${on ? ' on' : ''}${owned ? '' : ' locked'}`;
      const sw = document.createElement('span'); sw.className = 'sw';
      const bg = swatch(kind, key);
      if (bg) sw.style.background = bg; else sw.textContent = def.icon;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = def.name;
      const pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = on ? 'usando' : owned ? 'seu' : `🦴 ${def.price}`;
      b.append(sw, nm, pr);
      b.addEventListener('click', () => {
        if (!owned) {
          if (save.coins < def.price) { toast(`Faltam ${def.price - save.coins} ossinhos para ${def.name}. Brinque com ${dogName()} para ganhar!`, 'info', 3500); return; }
          save.coins -= def.price;
          save.unlocked.push(`${kind}:${key}`);
          Sfx.good();
          toast(`Você comprou ${def.name}!`, 'good', 2500);
        }
        skin[kind] = key;
        (wardrobeWho === 'player' ? pModel : dModel).setSkin(skin);
        if (wardrobeWho === 'dog' && dog.held) dModel.setHeld(itemSprite(dog.held, .45));
        persist(); refreshNames(); renderWardrobe();
      });
      grid.append(b);
    }
  });
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { wardrobeWho = b.dataset.who; renderWardrobe(); }));
$('#nameInput').addEventListener('change', e => {
  const v = e.target.value.trim().slice(0, 14);
  if (wardrobeWho === 'player') save.playerName = v;
  else if (v) save.dogName = v;
  persist(); refreshNames();
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));
$('#btnInv').addEventListener('click', openInventory);
$('#btnWardrobe').addEventListener('click', openWardrobe);
$('#btnHelp').addEventListener('click', () => { document.exitPointerLock?.(); $('#lock').hidden = false; });
const muteBtn = $('#btnMute');
const syncMute = () => { muteBtn.textContent = save.muted ? '🔇' : '🔊'; };
muteBtn.addEventListener('click', () => { save.muted = !save.muted; syncMute(); persist(); });
syncMute();

// ---------- loop ----------
let spawnT = 4, coinT = 3, saveT = 5;
function update(dt) {
  time += dt;
  updatePlayer(dt);
  updateDog(dt);
  updateItems(dt);
  updateCamera();
  updateAim();
  mineTick(dt);
  World.flush(scene);
  for (const b of [foodBowl, waterBowl]) updateBowl(b);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (!p.sprite) p.vy -= 14 * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    if (p.sprite) p.m.material.opacity = Math.min(1, p.life);
    if (p.life <= 0) { scene.remove(p.m); if (p.sprite) p.m.material.dispose(); particles.splice(i, 1); }
  }

  if ((spawnT -= dt) <= 0) {
    spawnT = rand(6, 10);
    if (items.filter(i => isEdible(i.key)).length < 12) { const p = surfaceSpot(player.x, player.z, 8, 26); if (p) spawnItem(weightedFood(), p.x, p.y, p.z); }
  }
  if ((coinT -= dt) <= 0) {
    coinT = rand(5, 9);
    if (items.filter(i => i.key === 'coin').length < 8) { const p = surfaceSpot(player.x, player.z, 5, 24); if (p) spawnItem('coin', p.x, p.y, p.z); }
  }
  if ((saveT -= dt) <= 0) { saveT = 5; persist(); }
}
function syncModels(dt) {
  pModel.root.position.set(player.x, player.y, player.z);
  pModel.root.rotation.y = player.yaw;
  const pSpeed = Math.hypot(player.vx, player.vz);
  pModel.animate(dt, { moving: pSpeed > .5, speed: pSpeed, pose: player.downT > 0 ? 'sick' : 'stand', wag: 9, pant: pSpeed > 5 });
  dModel.root.position.set(dog.x, dog.y, dog.z);
  dModel.root.rotation.y = lerpAngle(dModel.root.rotation.y, dog.yaw, Math.min(1, dt * 10));
  dModel.animate(dt, {
    moving: dog.moving, speed: dog.speed, pose: dogPose(), hop: dog.hop, eat: dog.state === 'eating' || dog.state === 'bowlUse',
    pant: dog.speed > 5 || dog.happy > 80, wag: dog.happy > 60 ? 16 : dog.happy > 30 ? 9 : 3,
  });
}

refreshNames();
renderHotbar();
logMsg('sys', `${dogName()} está te esperando! Aperte Enter para conversar: "oi", "senta", "busca" ou "posso te dar chocolate?"`);
addEventListener('beforeunload', persist);

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (!paused()) update(dt);
  else updateCamera();
  updateSky(paused() ? 0 : dt);
  syncModels(paused() ? 0 : dt);
  updateHud(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Avança a simulação manualmente (depuração com a aba em segundo plano).
function step(n = 60, dt = 1 / 60) {
  for (let i = 0; i < n; i++) { update(dt); updateSky(dt); syncModels(dt); }
  updateHud(dt);
  renderer.render(scene, camera);
}
window.__cachocraft = { step, mine: v => { mouseDown = v; }, player, dog, save, sendChat, inv, World, get items() { return items; }, addItem, setSel: i => { sel = i; renderHotbar(true); }, useRight, interact, camera, get aim() { return aim; }, setCam: (y, p) => { camYaw = y; camPitch = p; } };
