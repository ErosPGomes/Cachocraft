'use strict';
// Desenho procedural (canvas 2D): cachorros, itens e cenário. Nada de imagens externas.

const Draw = (() => {
  function circle(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) ctx.fillStyle = fill;
    ctx.fill();
  }
  function ellipse(ctx, x, y, rx, ry, rot, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    if (fill) ctx.fillStyle = fill;
    ctx.fill();
  }
  function rrect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) ctx.fillStyle = fill;
    ctx.fill();
  }
  function poly(ctx, pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) ctx.fillStyle = fill;
    ctx.fill();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.round(clampByte(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  const clampByte = v => Math.max(0, Math.min(255, v));

  function bone(ctx, x, y, len, r, fill, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = fill;
    const h = len / 2;
    ctx.fillRect(-h, -r * 0.55, len, r * 1.1);
    for (const sx of [-h, h]) for (const sy of [-r * 0.6, r * 0.6]) circle(ctx, sx, sy, r * 0.75);
    ctx.restore();
  }

  function collarStyle(ctx, col, x0, x1) {
    if (!col.rainbow) return col.color;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    ['#e84a4a', '#f2a33a', '#f2d83a', '#4cc06a', '#3a8ef2', '#9a5bd6'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    return g;
  }

  // o: { facing, skin:{coat,collar,acc}, t, moving, pose, scale, held, hop, pant, wagSpeed }
  function dog(ctx, x, y, o) {
    const C = COATS[o.skin.coat] || COATS.caramelo;
    const col = COLLARS[o.skin.collar] || COLLARS.vermelha;
    const acc = o.skin.acc || 'nenhum';
    const s = o.scale || 1, L = C.long || 1, leg = 11 * (C.short || 1), sn = C.snout ?? 1;
    const t = o.t || 0, pose = o.pose || 'stand';
    const low = pose === 'lie' || pose === 'sleep' || pose === 'sick';
    const sit = pose === 'sit' || pose === 'paw';

    ctx.save();
    ctx.translate(x, y);
    ellipse(ctx, 0, 0, 19 * s * L, 5.5 * s, 0, 'rgba(0,0,0,0.18)');
    ctx.scale((o.facing < 0 ? -1 : 1) * s, s);
    if (o.hop) ctx.translate(0, -o.hop);
    if (pose === 'roll') { ctx.translate(0, -12); ctx.rotate(t * 9); ctx.translate(0, 12); }

    const by = low ? -8 : -(leg + 7);
    const swing = o.moving ? Math.sin(t * 15) * 4 : 0;
    const legDark = shade(C.base, -0.2);
    let hx = 17 * L, hy = by - 9, bodyRot = 0;
    if (sit) { bodyRot = -0.55; hx = 9 * L + 3; hy = by - 17; }
    if (low) { hx = 18 * L; hy = by - 4; }
    if (pose === 'sleep' || pose === 'sick') hy += 3;

    // rabo
    const wag = Math.sin(t * (o.wagSpeed || 8)) * (o.wagAmp ?? 0.45);
    ctx.save();
    ctx.translate(sit ? -10 * L : -15 * L, sit ? -6 : by - 3);
    ctx.rotate(wag + (low ? 0.9 : 0) + (sit ? 0.6 : 0));
    ctx.strokeStyle = C.base; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -3, -11, -12); ctx.stroke();
    ctx.restore();

    // patas de trás (lado de lá)
    const legRect = (lx, phase, fill) => rrect(ctx, lx - 2.5 + phase, by + 2, 5, -by - 1, 2, fill);
    if (!low && !sit) {
      legRect(-10 * L + 4, -swing, legDark);
      legRect(10 * L + 4, swing, legDark);
    }
    if (sit) legRect(9 * L + 4, 0, legDark);

    // corpo
    ctx.save();
    ctx.translate(sit ? -1 : 0, sit ? by + 1 : by);
    ctx.rotate(bodyRot);
    ellipse(ctx, 0, 0, 17 * L, 10, 0, C.base);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, 17 * L, 10, 0, 0, TAU); ctx.clip();
    if (C.pattern === 'spots') {
      for (const [sx, sy, r] of [[-8, -4, 3], [2, -6, 2.5], [9, -1, 2.8], [-3, 3, 2], [-13, 2, 2.2], [6, 5, 1.8], [-6, -8, 1.6]])
        circle(ctx, sx * L, sy, r, C.patternColor);
    }
    if (C.pattern === 'saddle') ellipse(ctx, -3, -7, 12 * L, 8, 0, C.patternColor);
    ellipse(ctx, 1, 7, 13 * L, 5, 0, C.belly);
    ctx.restore();
    ctx.restore();

    // patas da frente/de cá
    if (low) {
      ellipse(ctx, 15 * L + 5, -2.5, 7, 3, 0, C.base);
      ellipse(ctx, -11 * L, -2.5, 7, 3, 0, legDark);
    } else if (sit) {
      ellipse(ctx, -9 * L, -6, 9, 7, 0, C.base);
      ellipse(ctx, -4 * L, -1.5, 6, 2.5, 0, legDark);
      if (pose === 'paw') {
        ctx.save(); ctx.translate(9 * L, by - 2); ctx.rotate(-1.25 + Math.sin(t * 6) * 0.15);
        rrect(ctx, -2.5, 0, 5, leg + 2, 2, C.base); ctx.restore();
      } else legRect(9 * L, 0, C.base);
    } else {
      legRect(-10 * L, swing, C.base);
      legRect(10 * L, -swing, C.base);
    }

    // cabeça
    circle(ctx, hx, hy, 9, C.head || C.base);
    if (C.pattern === 'spots') { circle(ctx, hx - 3, hy - 5, 1.6, C.patternColor); circle(ctx, hx + 4, hy + 4, 1.3, C.patternColor); }
    if (C.pattern === 'mask') ellipse(ctx, hx + 3, hy + 3, 6.5, 5, 0, C.patternColor);
    if (C.pattern === 'saddle') ellipse(ctx, hx + 2.5, hy - 1, 2, 7, 0, '#ffffff');
    const snoutX = hx + 6 + 2 * sn;
    ellipse(ctx, snoutX, hy + 3, 3.5 + 3 * sn, 4, 0, C.pattern === 'muzzle' ? C.patternColor : C.pattern === 'mask' ? C.patternColor : C.belly);
    const noseX = snoutX + 2.5 + 3 * sn;
    if (o.pant) ellipse(ctx, noseX - 3, hy + 8, 2.4, 3.4, 0, '#e36b7a');
    circle(ctx, noseX, hy + 1.2, 2.3, '#1d1715');

    // olho
    if (pose === 'sleep' || pose === 'sick') {
      ctx.strokeStyle = '#1d1715'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(hx + 3, hy - 2.5, 1.8, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      circle(ctx, hx + 3, hy - 2.5, 1.9, '#1d1715');
      circle(ctx, hx + 3.6, hy - 3.1, 0.6, '#ffffff');
    }

    // orelha
    if (C.ears === 'up') poly(ctx, [hx - 6, hy - 4, hx - 2, hy - 16, hx + 2, hy - 6], C.ear);
    else ellipse(ctx, hx - 4, hy + 1, 4, 8.5, 0.35 + (o.moving ? Math.sin(t * 15) * 0.15 : 0), C.ear);

    // coleira
    ctx.save();
    ctx.translate(hx - 6.5, hy + 7);
    ctx.rotate(sit ? -0.15 : -0.6);
    rrect(ctx, -2.6, -7, 5.2, 14, 2, collarStyle(ctx, col, -3, 3));
    if (acc === 'pingente') bone(ctx, 1, 9, 8, 2.4, '#f2c230', 0.3);
    else circle(ctx, 1.5, 8, 2.1, '#f4c430');
    ctx.restore();

    // acessórios
    if (acc === 'bandana') {
      poly(ctx, [hx - 11, hy + 5, hx - 1, hy + 9, hx - 8, hy + 18], '#d64545');
      circle(ctx, hx - 6, hy + 10, 0.9, '#fff'); circle(ctx, hx - 8, hy + 14, 0.9, '#fff');
    }
    if (acc === 'laco') {
      poly(ctx, [hx - 2, hy - 9, hx - 9, hy - 14, hx - 8, hy - 5], '#f06aa8');
      poly(ctx, [hx - 2, hy - 9, hx + 5, hy - 15, hx + 4, hy - 5], '#f06aa8');
      circle(ctx, hx - 2, hy - 9, 2.2, '#d94b8e');
    }
    if (acc === 'chapeu') {
      poly(ctx, [hx - 7, hy - 6, hx + 5, hy - 7, hx - 2, hy - 24], '#3a8ef2');
      ctx.strokeStyle = '#f2d83a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(hx - 5, hy - 11); ctx.lineTo(hx + 3, hy - 12); ctx.moveTo(hx - 3.5, hy - 16); ctx.lineTo(hx + 1, hy - 17); ctx.stroke();
      circle(ctx, hx - 2, hy - 25, 2.4, '#f06aa8');
    }
    if (acc === 'coroa') {
      poly(ctx, [hx - 7, hy - 7, hx + 6, hy - 7, hx + 7, hy - 16, hx + 3, hy - 11, hx - 0.5, hy - 18, hx - 4, hy - 11, hx - 8, hy - 16], '#f2c230');
      circle(ctx, hx - 0.5, hy - 10, 1.4, '#d64545');
    }
    if (acc === 'oculos') {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx - 5, hy - 3); ctx.lineTo(hx, hy - 3); ctx.stroke();
      rrect(ctx, hx - 0.5, hy - 5.5, 8, 5, 2, '#111');
      rrect(ctx, hx + 1, hy - 4.8, 2.5, 1.2, 1, 'rgba(255,255,255,0.5)');
    }
    if (o.held) item(ctx, o.held, noseX + 3, hy + 7, 0.75);
    else if (acc === 'osso') bone(ctx, noseX + 1, hy + 6, 13, 2.6, '#f3ead7');

    ctx.restore();
  }

  function item(ctx, id, x, y, s = 1, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(rot);
    switch (id) {
      case 'graveto':
        ctx.strokeStyle = '#7a4b22'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-13, 2); ctx.lineTo(13, -2); ctx.moveTo(3, 0); ctx.lineTo(8, -7); ctx.stroke();
        ellipse(ctx, 9.5, -8.5, 3, 1.8, -0.6, '#5c9e3f');
        break;
      case 'racao':
        for (const [px, py, c] of [[-5, 1, '#9a6234'], [0, -2, '#c48a4e'], [5, 1, '#8a5428'], [-2, 3, '#b07a42'], [3, 3, '#a96d38'], [0, 1, '#d8b27a']])
          circle(ctx, px, py, 2.8, c);
        bone(ctx, 0, -5, 8, 2, '#efe2c4', -0.2);
        break;
      case 'petisco': bone(ctx, 0, 0, 13, 3.2, '#d9a066', 0.15); break;
      case 'osso': bone(ctx, 0, 0, 15, 3.4, '#f3ead7', -0.5); break;
      case 'kit_casinha':
        rrect(ctx, -9, -4, 18, 13, 1, '#c07a3e');
        poly(ctx, [-12, -3, 0, -12, 12, -3], '#c8432f');
        rrect(ctx, -3, 1, 6, 8, 2, '#3b2416');
        break;
      case 'cenoura':
        poly(ctx, [-11, 1, 7, -3.5, 7, 3.5], '#f08a24');
        ctx.strokeStyle = '#c96a12'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(0, 1); ctx.moveTo(2, -2); ctx.lineTo(4, 0); ctx.stroke();
        poly(ctx, [7, -1, 13, -6, 11, 0], '#4caa3a'); poly(ctx, [7, 1, 13, 5, 12, 0], '#3d9130');
        break;
      case 'maca':
        circle(ctx, 0, 0, 6.5, '#d8323c');
        circle(ctx, -2.2, -2.2, 1.6, 'rgba(255,255,255,0.45)');
        ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(1, -9); ctx.stroke();
        ellipse(ctx, 3.5, -8, 3, 1.5, -0.4, '#4caa3a');
        break;
      case 'chocolate':
        rrect(ctx, -10, -6, 20, 12, 2, '#5a3220');
        ctx.strokeStyle = '#3e2214'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(5, -6); ctx.lineTo(5, 6); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        rrect(ctx, -10, -6.5, 9, 13, 2, '#c9302c');
        ctx.fillStyle = '#e8e2d8'; ctx.fillRect(-2, -6.5, 1.5, 13);
        break;
      case 'uva':
        ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(1, -11); ctx.stroke();
        for (const [px, py] of [[-4, -5], [0, -5.5], [4, -5], [-2, -1.5], [2, -1.5], [0, 2], [-5, -1.5], [5, -1.5]])
          circle(ctx, px, py, 2.9, '#7b3f8c');
        circle(ctx, -1, -6, 1, 'rgba(255,255,255,0.5)');
        break;
      case 'cebola':
        ellipse(ctx, 0, 0, 6.5, 6, 0, '#c78bb5');
        poly(ctx, [-2, -5, 2, -5, 0, -11], '#c78bb5');
        ctx.strokeStyle = 'rgba(120,50,100,0.5)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-3, -4); ctx.quadraticCurveTo(-5, 0, -3, 5); ctx.moveTo(3, -4); ctx.quadraticCurveTo(5, 0, 3, 5); ctx.stroke();
        ctx.strokeStyle = '#e8dccc'; ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-2, 8); ctx.moveTo(1, 6); ctx.lineTo(2, 8); ctx.stroke();
        break;
      case 'biscoito':
        ellipse(ctx, 0, 2, 8, 3.5, 0, '#3a2418');
        rrect(ctx, -7.5, -1.5, 15, 2.6, 1, '#f5efe3');
        ellipse(ctx, 0, -2.5, 8, 3.5, 0, '#4a2e1f');
        circle(ctx, -3, -3, 0.8, '#2a180f'); circle(ctx, 2, -2, 0.8, '#2a180f');
        break;
      case 'cafe':
        rrect(ctx, -6, -6, 11, 11, 2, '#f4f1ec');
        ellipse(ctx, -0.5, -6, 5.5, 1.8, 0, '#6b3f22');
        ctx.strokeStyle = '#f4f1ec'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(6, -1, 3, -1.3, 1.3); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-2, -9); ctx.quadraticCurveTo(-4, -12, -1, -15); ctx.stroke();
        break;
      case 'abacate':
        ellipse(ctx, 0, 0, 6.5, 8.5, 0.2, '#3f6b2a');
        ellipse(ctx, 0, 0.5, 5, 7, 0.2, '#cfdc7a');
        circle(ctx, 0.5, 2, 3.2, '#7a4a26');
        break;
      case 'chiclete':
        rrect(ctx, -8, -4.5, 16, 9, 3, '#ff8cc6');
        rrect(ctx, -4, -4.5, 8, 9, 0, '#ffffff');
        ctx.fillStyle = '#ff5fa8'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('XIL', 0, 0.5);
        break;
      case 'jarra':
        rrect(ctx, -6, -9, 12, 16, 3, 'rgba(120,190,240,0.85)');
        rrect(ctx, -5, -2, 10, 8, 2, '#3a8ee0');
        ctx.strokeStyle = 'rgba(120,190,240,0.95)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(7, -2, 3.5, -1.4, 1.4); ctx.stroke();
        break;
      case 'coin':
        bone(ctx, 0, 0, 12, 3.4, '#f2c230', -0.35);
        bone(ctx, -0.5, -0.8, 10, 2, '#ffe27a', -0.35);
        break;
    }
    ctx.restore();
  }

  function tree(ctx, x, y, apple, t) {
    const sway = Math.sin(t * 0.8) * 1.5;
    ellipse(ctx, x, y, 32, 9, 0, 'rgba(0,0,0,0.15)');
    rrect(ctx, x - 7, y - 40, 14, 42, 4, '#7a4b22');
    rrect(ctx, x - 7, y - 40, 5, 42, 3, '#8f5b2c');
    const cx = x + sway, cy = y - 66;
    circle(ctx, cx - 20, cy + 8, 22, '#3f8a3a');
    circle(ctx, cx + 20, cy + 8, 22, '#3f8a3a');
    circle(ctx, cx, cy - 10, 28, '#4a9a42');
    circle(ctx, cx - 10, cy + 2, 22, '#55a84b');
    circle(ctx, cx + 12, cy - 4, 20, '#5fb455');
    circle(ctx, cx - 6, cy - 16, 10, 'rgba(255,255,255,0.12)');
    if (apple) for (const [ax, ay] of [[-18, 4], [14, -6], [2, 12], [-4, -18], [22, 10]]) circle(ctx, cx + ax, cy + ay, 3.6, '#d8323c');
  }

  function doghouse(ctx, x, y, name) {
    ellipse(ctx, x, y, 72, 12, 0, 'rgba(0,0,0,0.15)');
    rrect(ctx, x - 56, y - 72, 112, 74, 4, '#c07a3e');
    ctx.strokeStyle = 'rgba(90,50,20,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 56, y - 72 + i * 12.3); ctx.lineTo(x + 56, y - 72 + i * 12.3); ctx.stroke(); }
    poly(ctx, [x - 70, y - 66, x, y - 122, x + 70, y - 66], '#c8432f');
    poly(ctx, [x - 70, y - 66, x, y - 122, x, y - 112, x - 58, y - 66], '#a83322');
    ctx.fillStyle = '#3b2416';
    ctx.beginPath(); ctx.moveTo(x - 22, y + 1); ctx.lineTo(x - 22, y - 30); ctx.arc(x, y - 30, 22, Math.PI, 0); ctx.lineTo(x + 22, y + 1); ctx.closePath(); ctx.fill();
    rrect(ctx, x - 34, y - 102, 68, 18, 5, '#f5e6c8');
    ctx.fillStyle = '#6b3f22'; ctx.font = '700 12px "Baloo 2", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y - 92);
  }

  function faucet(ctx, x, y, t) {
    ellipse(ctx, x, y + 2, 16, 5, 0, 'rgba(70,140,200,0.35)');
    rrect(ctx, x - 5, y - 46, 10, 48, 3, '#8e98a3');
    rrect(ctx, x - 5, y - 46, 4, 48, 2, '#a9b2bc');
    rrect(ctx, x, y - 40, 16, 7, 3, '#b7c0c9');
    rrect(ctx, x + 12, y - 37, 6, 9, 2, '#b7c0c9');
    circle(ctx, x, y - 50, 5, '#3a8ee0');
    const drip = (t * 1.2) % 1;
    circle(ctx, x + 15, y - 26 + drip * 24, 1.8, `rgba(90,170,240,${1 - drip})`);
  }

  function bag(ctx, x, y) {
    ellipse(ctx, x, y, 22, 6, 0, 'rgba(0,0,0,0.15)');
    rrect(ctx, x - 20, y - 46, 40, 47, 6, '#e8d3a3');
    poly(ctx, [x - 20, y - 44, x - 14, y - 54, x + 14, y - 54, x + 20, y - 44], '#d9c08a');
    rrect(ctx, x - 15, y - 34, 30, 22, 4, '#c8432f');
    bone(ctx, x, y - 27, 14, 2.6, '#f5e6c8');
    ctx.fillStyle = '#fff'; ctx.font = '800 7px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RAÇÃO', x, y - 17);
  }

  function bowl(ctx, x, y, kind, level, rim) {
    ellipse(ctx, x, y + 2, 22, 7, 0, 'rgba(0,0,0,0.15)');
    ellipse(ctx, x, y - 4, 20, 9, 0, rim);
    ellipse(ctx, x, y - 6, 15, 6, 0, shade(rim, -0.35));
    if (level > 0) {
      if (kind === 'water') ellipse(ctx, x, y - 6, 14 * Math.sqrt(level), 5.4 * Math.sqrt(level), 0, '#5cb2ee');
      else for (let i = 0; i < Math.ceil(level * 9); i++) circle(ctx, x - 9 + (i % 5) * 4.5, y - 8 + Math.floor(i / 5) * 3.5, 2.4, i % 2 ? '#a96d38' : '#c48a4e');
    }
    bone(ctx, x, y + 1, 9, 1.6, 'rgba(255,255,255,0.75)');
  }

  function vet(ctx, x, y, w, h) {
    ellipse(ctx, x, y, w / 2 + 12, 14, 0, 'rgba(0,0,0,0.15)');
    rrect(ctx, x - w / 2, y - h, w, h + 2, 6, '#f4f1ec');
    poly(ctx, [x - w / 2 - 12, y - h + 6, x - w / 2 + 14, y - h - 34, x + w / 2 - 14, y - h - 34, x + w / 2 + 12, y - h + 6], '#4a90c2');
    rrect(ctx, x - 22, y - 56, 44, 58, 4, '#7fb6dc');
    rrect(ctx, x - 1, y - 56, 2, 58, 0, '#4a90c2');
    for (const wx of [x - w / 2 + 18, x + w / 2 - 58]) { rrect(ctx, wx, y - h + 22, 40, 30, 4, '#bfe0f2'); rrect(ctx, wx, y - h + 22, 40, 4, 2, '#ffffff'); }
    rrect(ctx, x - 13, y - h - 26, 26, 26, 5, '#ffffff');
    ctx.fillStyle = '#d64545'; ctx.fillRect(x - 3.5, y - h - 22, 7, 18); ctx.fillRect(x - 9, y - h - 16.5, 18, 7);
    ctx.fillStyle = '#2d5d80'; ctx.font = '800 13px "Baloo 2", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VETERINÁRIO', x, y - h + 10);
  }

  function pond(ctx, p, t) {
    ellipse(ctx, p.x, p.y, p.rx + 8, p.ry + 6, 0, '#b8a27a');
    ellipse(ctx, p.x, p.y, p.rx, p.ry, 0, '#4fa3d6');
    ellipse(ctx, p.x - 20, p.y - 10, p.rx * 0.7, p.ry * 0.55, 0, '#66b6e4');
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.25 + i / 3) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(p.x + 40 - i * 50, p.y + 10 - i * 12, 8 + k * 26, 3 + k * 9, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const [lx, ly] of [[-90, 20], [70, -30], [110, 30]]) {
      ellipse(ctx, p.x + lx, p.y + ly, 11, 6, 0, '#3f8a3a');
      circle(ctx, p.x + lx + 3, p.y + ly - 2, 2.2, '#f6b3d0');
    }
  }

  function bubble(ctx, x, y, text, maxW = 210) {
    ctx.font = '600 13px Nunito, sans-serif';
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    const lh = 17, pad = 8;
    const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width))) + pad * 2;
    const h = lines.length * lh + pad * 2 - 4;
    const bx = x - w / 2, by = y - h - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.roundRect(bx + 2, by + 3, w, h, 10); ctx.fill();
    ctx.fillStyle = '#fffdf7';
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 10); ctx.fill();
    poly(ctx, [x - 7, by + h - 1, x + 7, by + h - 1, x, by + h + 9], '#fffdf7');
    ctx.fillStyle = '#3b2a1e'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x, by + pad + i * lh));
  }

  function heart(ctx, x, y, s, fill) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-6, -2, -4, -8, 0, -4.5);
    ctx.bezierCurveTo(4, -8, 6, -2, 0, 3);
    ctx.fill(); ctx.restore();
  }

  return { dog, item, bone, tree, doghouse, faucet, bag, bowl, vet, pond, bubble, heart, ellipse, circle, rrect, shade };
})();
