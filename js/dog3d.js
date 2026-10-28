// Modelo de cachorro em caixas (voxel), com pelagem pintada por skin. Olha para +Z.
// COATS, COLLARS e ACCESSORIES vêm de js/data.js (script clássico carregado antes).
import * as THREE from './vendor/three.module.min.js';
import { hash2 } from './textures.js';

const hexRgb = h => { const c = parseInt(h.slice(1), 16); return [c >> 16 & 255, c >> 8 & 255, c & 255]; };
const texCache = new Map();
function furTex(base, pattern, pcolor, seed) {
  const key = [base, pattern, pcolor, seed].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d'), img = g.createImageData(16, 16), b = hexRgb(base), p = pcolor ? hexRgb(pcolor) : b;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = hash2(x * 1.3 + seed, y * 2.1 - seed), k = (y * 16 + x) * 4;
    let col = b;
    if (pattern === 'spots') {
      for (const [sx, sy, r] of [[3, 4, 1.8], [11, 3, 1.5], [7, 10, 2], [13, 12, 1.4], [2, 13, 1.2]])
        if (Math.hypot(x - (sx + seed * 3) % 16, y - sy) < r) col = p;
    }
    const f = .9 + n * .18;
    img.data[k] = Math.min(255, col[0] * f); img.data[k + 1] = Math.min(255, col[1] * f); img.data[k + 2] = Math.min(255, col[2] * f); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  texCache.set(key, t);
  return t;
}
const matCache = new Map();
const flat = color => {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
};
const fur = (base, pattern, pcolor, seed = 0) => {
  const key = 'f' + [base, pattern, pcolor, seed].join('|');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ map: furTex(base, pattern, pcolor, seed) }));
  return matCache.get(key);
};
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makeDog(skin, scale = 1) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  root.scale.setScalar(scale);
  const dog = { root, rig, skin: null, legs: [], head: null, tail: null, tongue: null, mouth: null, t: Math.random() * 10, legH: .34 };

  dog.setSkin = s => {
    dog.skin = { ...s };
    for (const ch of [...rig.children]) { rig.remove(ch); ch.traverse(o => o.geometry?.dispose()); }
    const C = COATS[s.coat] || COATS.caramelo, col = COLLARS[s.collar] || COLLARS.vermelha, acc = s.acc || 'nenhum';
    const L = C.long || 1, short = C.short || 1, sn = C.snout ?? 1;
    const legH = .34 * short, bodyH = .34, bodyW = .38, bodyLen = .72 * L;
    dog.legH = legH;
    const body = fur(C.base, C.pattern === 'spots' ? 'spots' : null, C.patternColor, 1);
    const head = fur(C.head || C.base, C.pattern === 'spots' ? 'spots' : null, C.patternColor, 2);
    const legM = fur(C.base, null, null, 3);
    const by = legH + bodyH / 2;

    rig.add(box(bodyW, bodyH, bodyLen, body, 0, by, 0));
    rig.add(box(bodyW * .84, .04, bodyLen * .8, flat(C.belly), 0, legH + .005, 0));
    if (C.pattern === 'saddle') rig.add(box(bodyW + .02, .1, bodyLen * .6, flat(C.patternColor), 0, by + bodyH / 2 - .03, -.04));

    dog.legs = [];
    for (const [lx, lz] of [[-.12, bodyLen / 2 - .1], [.12, bodyLen / 2 - .1], [-.12, -bodyLen / 2 + .1], [.12, -bodyLen / 2 + .1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, legH, lz);
      pivot.add(box(.12, legH, .12, legM, 0, -legH / 2, 0));
      pivot.add(box(.13, .05, .14, flat(C.belly), 0, -legH + .025, .01));
      rig.add(pivot);
      dog.legs.push(pivot);
    }

    const hg = new THREE.Group();
    hg.position.set(0, by + bodyH * .3, bodyLen / 2 - .02);
    rig.add(hg);
    dog.head = hg;
    hg.add(box(.34, .32, .32, head, 0, .17, .1));
    const snoutLen = .08 + .1 * sn;
    const snoutCol = C.pattern === 'muzzle' ? C.patternColor : C.pattern === 'mask' ? C.patternColor : C.belly;
    hg.add(box(.2, .15, snoutLen, flat(snoutCol), 0, .08, .26 + snoutLen / 2));
    hg.add(box(.09, .07, .05, flat('#1d1715'), 0, .14, .26 + snoutLen + .01));
    if (C.pattern === 'mask') hg.add(box(.3, .12, .02, flat(C.patternColor), 0, .07, .265));
    if (C.pattern === 'saddle') hg.add(box(.06, .3, .02, flat('#ffffff'), 0, .17, .265));
    for (const ex of [-.09, .09]) {
      hg.add(box(.07, .07, .02, flat('#ffffff'), ex, .22, .265));
      hg.add(box(.045, .055, .02, flat('#1d1715'), ex + (ex > 0 ? .01 : -.01), .215, .275));
    }
    if (C.ears === 'up') {
      for (const ex of [-.1, .1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(.08, .18, 4), flat(C.ear));
        ear.position.set(ex, .4, .06); ear.rotation.y = Math.PI / 4; ear.castShadow = true;
        hg.add(ear);
      }
    } else {
      for (const ex of [-1, 1]) {
        const ear = box(.06, .2, .14, flat(C.ear), ex * .19, .18, .06);
        ear.rotation.z = ex * .25;
        hg.add(ear);
      }
    }
    dog.tongue = box(.07, .02, .1, flat('#e36b7a'), 0, .005, .26 + snoutLen - .02);
    dog.tongue.visible = false;
    hg.add(dog.tongue);
    dog.mouth = new THREE.Group();
    dog.mouth.position.set(0, .03, .3 + snoutLen);
    hg.add(dog.mouth);

    // coleira
    const collarMat = col.rainbow ? flat('#e84a8a') : flat(col.color);
    hg.add(box(.36, .07, .3, collarMat, 0, .0, .05));
    if (col.rainbow) for (const [i, c] of ['#e84a4a', '#f2a33a', '#f2d83a', '#4cc06a', '#3a8ef2'].entries()) hg.add(box(.37, .015, .31, flat(c), 0, -.03 + i * .015, .05));
    if (acc === 'pingente') {
      hg.add(box(.12, .04, .03, flat('#f2c230'), 0, -.08, .21));
      for (const dx of [-.06, .06]) hg.add(box(.05, .07, .03, flat('#f2c230'), dx, -.08, .21));
    } else hg.add(box(.06, .06, .02, flat('#f4c430'), 0, -.06, .21));

    if (acc === 'bandana') {
      const band = new THREE.Mesh(new THREE.ConeGeometry(.16, .2, 3), flat('#d64545'));
      band.position.set(0, -.1, .14); band.rotation.set(Math.PI, 0, 0); band.scale.z = .4; band.castShadow = true;
      hg.add(band);
    }
    if (acc === 'laco') { hg.add(box(.1, .08, .04, flat('#f06aa8'), -.07, .36, .1), box(.1, .08, .04, flat('#f06aa8'), .07, .36, .1), box(.05, .05, .05, flat('#d94b8e'), 0, .36, .1)); }
    if (acc === 'chapeu') {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(.12, .3, 6), flat('#3a8ef2'));
      hat.position.set(0, .47, .08); hat.castShadow = true;
      hg.add(hat, box(.07, .07, .07, flat('#f06aa8'), 0, .64, .08));
    }
    if (acc === 'coroa') {
      hg.add(box(.26, .06, .22, flat('#f2c230'), 0, .35, .1));
      for (const [px, pz] of [[-.1, .02], [.1, .02], [-.1, .18], [.1, .18], [0, .1]]) hg.add(box(.05, .08, .05, flat('#f2c230'), px, .41, pz));
      hg.add(box(.04, .04, .02, flat('#d64545'), 0, .35, .215));
    }
    if (acc === 'oculos') { hg.add(box(.3, .07, .02, flat('#111111'), 0, .22, .285)); }
    if (acc === 'osso') {
      const bone = new THREE.Group();
      bone.add(box(.26, .04, .04, flat('#f3ead7')));
      for (const dx of [-.13, .13]) for (const dy of [-.025, .025]) bone.add(box(.05, .05, .05, flat('#f3ead7'), dx, dy, 0));
      bone.position.set(0, -.01, .04);
      dog.mouth.add(bone);
      dog.boneAcc = bone;
    } else dog.boneAcc = null;

    const tg = new THREE.Group();
    tg.position.set(0, by + bodyH * .3, -bodyLen / 2);
    const tailMesh = box(.07, .07, .32, legM, 0, 0, -.15);
    tg.add(tailMesh);
    tg.rotation.x = .7;
    rig.add(tg);
    dog.tail = tg;
  };
  dog.setSkin(skin);

  // s: { moving, speed, pose, wag, pant, dt }
  dog.animate = (dt, s) => {
    dog.t += dt;
    const t = dog.t, legH = dog.legH;
    const swing = s.moving ? Math.sin(t * (s.speed > 4 ? 16 : 11)) * (s.speed > 4 ? .9 : .6) : 0;
    rig.rotation.set(0, 0, 0);
    rig.position.set(0, 0, 0);
    dog.head.rotation.set(0, 0, 0);
    const [fl, fr, bl, br] = dog.legs;
    fl.rotation.set(swing, 0, 0); br.rotation.set(swing, 0, 0);
    fr.rotation.set(-swing, 0, 0); bl.rotation.set(-swing, 0, 0);
    if (s.moving) rig.position.y = Math.abs(Math.sin(t * 11)) * .03;
    switch (s.pose) {
      case 'sit':
      case 'paw':
        rig.rotation.x = -.5; rig.position.set(0, -.04, -.12);
        bl.rotation.x = br.rotation.x = 1.45; fl.rotation.x = fr.rotation.x = .5;
        if (s.pose === 'paw') fr.rotation.x = -.9 + Math.sin(t * 6) * .2;
        dog.head.rotation.x = .35;
        break;
      case 'lie':
      case 'sleep':
      case 'sick':
        rig.position.y = -legH * .82;
        fl.rotation.x = fr.rotation.x = -1.45; bl.rotation.x = br.rotation.x = 1.45;
        if (s.pose !== 'lie') dog.head.rotation.x = .35;
        break;
      case 'roll':
        rig.position.y = .25;
        rig.rotation.z = t * 9;
        break;
    }
    if (s.hop) rig.position.y += s.hop;
    if (s.eat) dog.head.rotation.x = .5 + Math.sin(t * 14) * .15;
    const wag = s.wag ?? 8;
    dog.tail.rotation.set(s.pose === 'sick' ? -.2 : .7, Math.sin(t * wag) * (s.pose === 'sick' ? .05 : .55), 0);
    dog.tongue.visible = !!s.pant;
  };

  dog.setHeld = (node) => {
    for (const ch of [...dog.mouth.children]) if (ch !== dog.boneAcc) dog.mouth.remove(ch);
    if (dog.boneAcc) dog.boneAcc.visible = !node;
    if (node) dog.mouth.add(node);
  };
  return dog;
}
