// Modelo de pessoa em caixas (voxel), com visuais próprios de Cachocraft. Olha para +Z.
// Mesma interface do cachorro (root, setSkin, animate, setHeld) para trocar no jogador.
import * as THREE from './vendor/three.module.min.js';

export const HUMANS = {
  tutora:     { name: 'Tutora', price: 0, skin: '#e8b796', hair: '#7a3b22', shirt: '#e07b2e', pants: '#6b3f5e', shoes: '#2a2320', hairStyle: 'long' },
  tutor:      { name: 'Tutor de boné', price: 0, skin: '#c98e66', hair: '#1f1a17', shirt: '#3fa45a', pants: '#4a3b2b', shoes: '#f2f2f2', cap: '#d64545' },
  passeador:  { name: 'Passeador', price: 10, skin: '#f1c9a5', hair: '#d9a441', shirt: '#8a5bd6', pants: '#2f3640', shoes: '#7a4a24' },
  vet:        { name: 'Veterinária', price: 15, skin: '#8d5a3b', hair: '#2a1d16', shirt: '#f4f4f4', pants: '#4aa3a0', shoes: '#ffffff', hairStyle: 'bun', coat: true },
  jardineiro: { name: 'Jardineiro', price: 20, skin: '#6b4430', hair: '#cfcfcf', shirt: '#f2d83a', pants: '#5c7a3a', shoes: '#4a3626', straw: true },
};

const mats = new Map();
const flat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makeHuman(skin, scale = 1) {
  const root = new THREE.Group(), rig = new THREE.Group();
  root.add(rig);
  root.scale.setScalar(scale);
  const h = { root, rig, t: Math.random() * 10, arms: [], legs: [], head: null, hand: null, human: true };

  h.setSkin = s => {
    h.skin = { ...s };
    for (const ch of [...rig.children]) { rig.remove(ch); ch.traverse(o => o.geometry?.dispose()); }
    const P = HUMANS[s.human] || HUMANS.tutora, acc = s.acc || 'nenhum';
    h.legs = [];
    for (const x of [-.13, .13]) {
      const g = new THREE.Group(); g.position.set(x, .75, 0);
      g.add(box(.24, .7, .26, P.pants, 0, -.35, 0), box(.25, .1, .3, P.shoes, 0, -.7, .02));
      rig.add(g); h.legs.push(g);
    }
    rig.add(box(.52, .72, .28, P.shirt, 0, 1.11, 0));
    if (P.coat) rig.add(box(.54, .3, .3, '#f4f4f4', 0, .82, 0), box(.04, .7, .02, '#d0d0d0', 0, 1.1, .15));
    if (P.straw) rig.add(box(.4, .3, .02, P.pants, 0, 1.08, .15), box(.06, .38, .02, P.pants, -.16, 1.3, .15), box(.06, .38, .02, P.pants, .16, 1.3, .15));
    h.arms = [];
    for (const x of [-.34, .34]) {
      const g = new THREE.Group(); g.position.set(x, 1.42, 0);
      g.add(box(.18, .38, .22, P.shirt, 0, -.17, 0), box(.16, .34, .2, P.skin, 0, -.53, 0));
      rig.add(g); h.arms.push(g);
    }
    h.hand = new THREE.Group(); h.hand.position.set(0, -.72, .1);
    h.arms[1].add(h.hand);

    const hg = new THREE.Group(); hg.position.set(0, 1.47, 0);
    rig.add(hg); h.head = hg;
    hg.add(box(.44, .44, .42, P.skin, 0, .22, 0));
    for (const ex of [-.1, .1]) { hg.add(box(.09, .07, .02, '#ffffff', ex, .25, .215)); hg.add(box(.05, .07, .02, '#2a2320', ex + (ex > 0 ? .02 : -.02), .25, .222)); }
    hg.add(box(.12, .03, .02, '#9a4a3a', 0, .1, .215));
    hg.add(box(.46, .12, .44, P.hair, 0, .42, -.01), box(.46, .3, .1, P.hair, 0, .3, -.18));
    for (const ex of [-.22, .22]) hg.add(box(.04, .16, .3, P.hair, ex, .36, -.05));
    if (P.hairStyle === 'long') hg.add(box(.44, .5, .1, P.hair, 0, .08, -.2));
    if (P.hairStyle === 'bun') hg.add(box(.18, .16, .16, P.hair, 0, .52, -.18));
    if (P.cap) hg.add(box(.48, .12, .46, P.cap, 0, .47, 0), box(.36, .04, .2, P.cap, 0, .42, .3));
    if (P.straw) hg.add(box(.7, .04, .7, '#e8d3a3', 0, .47, 0), box(.46, .16, .44, '#e8d3a3', 0, .55, 0));

    if (acc === 'bandana' || acc === 'pingente') rig.add(box(.4, .08, .3, acc === 'bandana' ? '#d64545' : '#f2c230', 0, 1.44, .02));
    if (acc === 'pingente') rig.add(box(.1, .06, .02, '#f2c230', 0, 1.32, .15));
    if (acc === 'laco') hg.add(box(.12, .1, .05, '#f06aa8', -.1, .5, .1), box(.12, .1, .05, '#f06aa8', .1, .5, .1), box(.06, .06, .06, '#d94b8e', 0, .5, .1));
    if (acc === 'oculos') hg.add(box(.42, .09, .02, '#111111', 0, .25, .23));
    if (acc === 'chapeu') { const c = new THREE.Mesh(new THREE.ConeGeometry(.16, .4, 6), flat('#3a8ef2')); c.position.set(0, .68, 0); c.castShadow = true; hg.add(c, box(.08, .08, .08, '#f06aa8', 0, .9, 0)); }
    if (acc === 'coroa') {
      hg.add(box(.36, .08, .34, '#f2c230', 0, .52, 0));
      for (const [px, pz] of [[-.14, -.12], [.14, -.12], [-.14, .12], [.14, .12]]) hg.add(box(.06, .1, .06, '#f2c230', px, .6, pz));
    }
    h.boneAcc = null;
    if (acc === 'osso') {
      const bone = new THREE.Group();
      bone.add(box(.04, .04, .26, '#f3ead7'));
      for (const dz of [-.13, .13]) for (const dx of [-.025, .025]) bone.add(box(.05, .05, .05, '#f3ead7', dx, 0, dz));
      h.hand.add(bone); h.boneAcc = bone;
    }
  };
  h.setSkin(skin);

  h.animate = (dt, s) => {
    h.t += dt;
    const sw = s.moving ? Math.sin(h.t * (s.speed > 5 ? 13 : 9)) * (s.speed > 5 ? .9 : .6) : 0;
    rig.rotation.set(0, 0, 0); rig.position.set(0, 0, 0);
    h.legs[0].rotation.x = sw; h.legs[1].rotation.x = -sw;
    h.arms[0].rotation.set(-sw * .8, 0, .05); h.arms[1].rotation.set(sw * .8, 0, -.05);
    h.head.rotation.set(0, 0, 0);
    if (s.swing) h.arms[1].rotation.x = -1.2 + Math.sin(h.t * 18) * .5;
    if (s.eat) { h.arms[1].rotation.x = -1.6; h.head.rotation.x = Math.sin(h.t * 14) * .08; }
    if (s.sneak) { rig.rotation.x = .25; rig.position.z = -.15; rig.position.y = -.1; h.head.rotation.x = -.25; }
    if (s.pose === 'sick') { rig.rotation.x = -Math.PI / 2; rig.position.set(0, .2, -.6); }
  };
  h.setHeld = node => {
    for (const ch of [...h.hand.children]) if (ch !== h.boneAcc) h.hand.remove(ch);
    if (h.boneAcc) h.boneAcc.visible = !node;
    if (node) h.hand.add(node);
  };
  return h;
}
