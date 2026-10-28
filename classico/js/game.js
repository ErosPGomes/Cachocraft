'use strict';
// Cachocraft: loop principal, mundo, jogador, cachorro, HUD e guarda-roupa.

(() => {
  const $ = s => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');

  const WORLD = { w: 2200, h: 1400 };
  const HOME = { x: 560, y: 520 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- save ----------
  const SAVE_KEY = 'cachocraft-save-v1';
  const DEFAULT_SAVE = {
    coins: 10,
    unlocked: [],
    playerSkin: { coat: 'pretinho', collar: 'azul', acc: 'nenhum' },
    dogSkin: { coat: 'caramelo', collar: 'vermelha', acc: 'nenhum' },
    dogName: 'Paçoca',
    playerName: '',
    learned: [],
    muted: false,
    seenHelp: false,
  };
  const save = (() => {
    try { return { ...structuredClone(DEFAULT_SAVE), ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
    catch { return structuredClone(DEFAULT_SAVE); }
  })();
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* sem storage */ } };
  const isUnlocked = (kind, key) => CATALOG[kind][key].price === 0 || save.unlocked.includes(`${kind}:${key}`);

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
      splash() { tone(900, 180, 0.3, 'sine', 0.06); },
      toss() { tone(300, 700, 0.12, 'sine', 0.05); },
      drink() { tone(500, 900, 0.08, 'sine', 0.06); tone(500, 900, 0.08, 'sine', 0.06, 0.12); },
    };
  })();

  // ---------- mundo ----------
  const house = { x: HOME.x, y: HOME.y };
  const faucet = { x: HOME.x + 150, y: HOME.y - 6 };
  const bag = { x: HOME.x - 130, y: HOME.y + 20 };
  const foodBowl = { x: HOME.x - 40, y: HOME.y + 90, level: 0.6, kind: 'food' };
  const waterBowl = { x: HOME.x + 40, y: HOME.y + 90, level: 0.6, kind: 'water' };
  const vet = { x: 1880, y: 360, w: 220, h: 110 };
  const vetDoor = { x: vet.x, y: vet.y + 14 };
  const pond = { x: 1250, y: 980, rx: 170, ry: 90 };
  const inPond = (x, y, pad = 0) => ((x - pond.x) / (pond.rx + pad)) ** 2 + ((y - pond.y) / (pond.ry + pad)) ** 2 < 1;

  const srand = mulberry32(20261028);
  const trees = [];
  for (let tries = 0; trees.length < 22 && tries < 2000; tries++) {
    const x = 90 + srand() * (WORLD.w - 180), y = 120 + srand() * (WORLD.h - 200);
    if (Math.hypot(x - HOME.x, y - HOME.y) < 300) continue;
    if (Math.hypot(x - vet.x, y - vet.y) < 260) continue;
    if (inPond(x, y, 90)) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.y - y) < 150)) continue;
    trees.push({ x, y, apple: trees.length % 4 === 0, phase: srand() * 10, shakeT: 0, cd: 0 });
  }
  const tufts = Array.from({ length: 1400 }, () => ({ x: srand() * WORLD.w, y: srand() * WORLD.h, s: 0.6 + srand() * 0.8 }));
  const flowers = Array.from({ length: 160 }, () => ({ x: srand() * WORLD.w, y: srand() * WORLD.h, c: ['#fff6d6', '#f6b3d0', '#ffd34d', '#b9a6f2'][Math.floor(srand() * 4)] }))
    .filter(f => !inPond(f.x, f.y, 20));
  const patches = Array.from({ length: 40 }, () => ({ x: srand() * WORLD.w, y: srand() * WORLD.h, rx: 80 + srand() * 160, ry: 40 + srand() * 80 }));

  function blocked(x, y, r = 10) {
    if (inPond(x, y, r)) return true;
    for (const t of trees) if (Math.hypot(t.x - x, t.y - y + 4) < 13 + r) return true;
    if (x > house.x - 58 - r && x < house.x + 58 + r && y > house.y - 34 && y < house.y + 6 + r) return true;
    if (x > vet.x - vet.w / 2 - r && x < vet.x + vet.w / 2 + r && y > vet.y - 60 && y < vet.y + 4 + r) return true;
    if (Math.hypot(bag.x - x, bag.y - y) < 16 + r) return true;
    if (Math.hypot(faucet.x - x, faucet.y - y) < 7 + r) return true;
    return false;
  }

  // ---------- entidades ----------
  const player = {
    x: HOME.x + 60, y: HOME.y + 170, facing: 1, t: 0, moving: false,
    hp: 100, hunger: 90, thirst: 90, held: null, hurtT: 0, downT: 0, bubble: null,
  };
  const dog = {
    x: HOME.x - 30, y: HOME.y + 160, facing: -1, t: 0, moving: false, running: false,
    state: 'idle', mode: 'free', poseName: 'stand', timer: 0, target: null, held: null, eating: null,
    health: 100, hunger: 75, thirst: 70, happy: 70, poisonT: 0,
    bubble: null, wanderT: 1, sniffT: 25, lastObey: -99, lastPet: -99, sickWarned: false, hop: 0,
  };
  let items = [], coins = [], particles = [];
  let time = 0, paused = false;
  let uid = 0;

  function spawnItem(id, x, y, extra) {
    const it = { uid: ++uid, id, x, y, z: 0, vx: 0, vy: 0, vz: 0, flying: false, byPlayer: false, ignoreUntil: 0, ...extra };
    items.push(it);
    return it;
  }
  function randomFreeSpot(margin = 70) {
    for (let i = 0; i < 50; i++) {
      const x = rand(margin, WORLD.w - margin), y = rand(margin + 40, WORLD.h - margin);
      if (!blocked(x, y, 14) && Math.hypot(x - vet.x, y - vet.y) > 140) return { x, y };
    }
    return { x: HOME.x, y: HOME.y + 200 };
  }
  function weightedFood() {
    const entries = Object.entries(SPAWN_WEIGHTS);
    let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [id, w] of entries) if ((r -= w) <= 0) return id;
    return entries[0][0];
  }

  for (let i = 0; i < 3; i++) spawnItem('graveto', HOME.x + 120 + i * 40, HOME.y + 230 + (i % 2) * 20);
  spawnItem('chocolate', HOME.x + 340, HOME.y + 260);
  spawnItem('cenoura', HOME.x - 200, HOME.y + 250);
  for (let i = 0; i < 9; i++) { const p = randomFreeSpot(); spawnItem(weightedFood(), p.x, p.y); }
  for (let i = 0; i < 6; i++) { const p = randomFreeSpot(); coins.push({ x: p.x, y: p.y, phase: Math.random() * 10 }); }

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
  function floatText(x, y, text, color = '#3b2a1e') {
    particles.push({ type: 'text', x, y, vx: 0, vy: -30, life: 1.4, max: 1.4, text, color });
  }
  function hearts(x, y, n = 3) {
    for (let i = 0; i < n; i++) particles.push({ type: 'heart', x: x + rand(-10, 10), y, vx: rand(-15, 15), vy: rand(-60, -35), life: 1.2, max: 1.2 });
  }
  function addCoins(n, x, y) {
    save.coins = Math.max(0, save.coins + n);
    persist();
    if (n > 0) { Sfx.coin(); if (x !== undefined) floatText(x, y - 40, `+${n} ossinho${n > 1 ? 's' : ''}`, '#b8860b'); }
    $('#coins').textContent = save.coins;
  }
  const dogName = () => save.dogName;

  const chatLog = $('#chatLog');
  function logMsg(who, text) {
    const el = document.createElement('div');
    el.className = `msg ${who}`;
    const name = who === 'you' ? (save.playerName || 'Você') : who === 'dog' ? dogName() : '';
    if (name) { const b = document.createElement('b'); b.textContent = name + ': '; el.append(b); }
    el.append(text);
    chatLog.append(el);
    while (chatLog.children.length > 80) chatLog.firstChild.remove();
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function dogSay(text, log = true) {
    if (!text) return;
    dog.bubble = { text, t: 2.8 + text.length / 22 };
    if (log) logMsg('dog', text);
  }

  // ---------- jogador ----------
  function interactions() {
    const p = player, held = p.held, out = [];
    const add = (d, max, label, fn) => { if (d < max) out.push({ d, label, fn }); };
    const n = dogName();

    if (held && isEdible(held)) add(dist(p, dog) + 8, 64, `Dar ${ITEMS[held].name.toLowerCase()} para ${n}`, giveToDog);
    else add(dist(p, dog) + 8, 64, `Fazer carinho em ${n}`, petDog);

    for (const it of items) if (!it.flying) add(dist(p, it), 44, `${held ? 'Trocar por' : 'Pegar'} ${ITEMS[it.id].name.toLowerCase()}`, () => pickUp(it));
    if (!held) add(dist(p, faucet), 56, "Pegar jarra d'água", () => { p.held = 'jarra'; Sfx.drink(); });
    if (!held) add(dist(p, bag), 56, 'Pegar porção de ração', () => { p.held = 'racao'; });
    if (held === 'jarra') add(dist(p, waterBowl), 50, 'Encher potinho de água', fillBowl.bind(null, waterBowl));
    else if (!held && waterBowl.level > 0.1) add(dist(p, waterBowl), 44, 'Beber do potinho', () => drinkBowl());
    if (held === 'racao') add(dist(p, foodBowl), 50, 'Colocar ração no potinho', fillBowl.bind(null, foodBowl));
    for (const t of trees) add(Math.hypot(t.x - p.x, t.y - p.y + 6), 58, t.cd > 0 ? 'Árvore descansando...' : 'Sacudir árvore', () => shakeTree(t));
    add(dist(p, vetDoor), 80, `Veterinário (${save.coins >= 5 ? '5 ossinhos' : 'grátis hoje'})`, visitVet);
    out.sort((a, b) => a.d - b.d);
    return out[0] || null;
  }

  function interact() {
    if (player.downT > 0) return;
    const i = interactions();
    if (i) i.fn();
  }
  function pickUp(it) {
    items = items.filter(x => x !== it);
    if (dog.target === it) dogIdle();
    if (player.held) spawnItem(player.held, player.x + player.facing * 16, player.y + 6);
    player.held = it.id;
  }
  function dropHeld() {
    if (!player.held) return;
    spawnItem(player.held, player.x + player.facing * 18, player.y + 6);
    player.held = null;
  }
  function eatHeld() {
    const id = player.held;
    if (!id) return toast('Você não está segurando nada. Chegue perto de algo e aperte E.', 'info', 3000);
    const it = ITEMS[id];
    if (id === 'jarra') {
      player.thirst = clamp(player.thirst + it.drink, 0, 100);
      player.hp = clamp(player.hp + 3, 0, 100);
      floatText(player.x, player.y - 46, 'glub glub', '#2f7fd6'); Sfx.drink();
    } else if (it.toxic) {
      player.hp -= it.dmg; player.hurtT = 0.6;
      toast(`Você comeu ${it.name.toLowerCase()}! −${it.dmg} de vida. ${it.fact}`, 'bad', 7000);
      floatText(player.x, player.y - 46, `−${it.dmg}`, '#d64545'); Sfx.bad();
    } else if (it.safe) {
      player.hunger = clamp(player.hunger + it.food, 0, 100);
      player.hp = clamp(player.hp + it.heal, 0, 100);
      floatText(player.x, player.y - 46, 'nhac nhac', '#3fa45a'); Sfx.chomp();
    } else return toast(`Não dá pra comer ${it.name.toLowerCase()}. Tente jogar (clique)!`, 'info', 3000);
    player.held = null;
  }
  function throwHeld(tx, ty) {
    const id = player.held;
    if (!id || player.downT > 0) return;
    if (id === 'jarra') return toast('Melhor não jogar a jarra… encha o potinho com ela!', 'info', 3000);
    const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy) || 1;
    const range = clamp(d, 50, 420), T = 0.35 + range / 900, g = 900, z0 = 20;
    const it = spawnItem(id, player.x + dx / d * 12, player.y, {
      z: z0, flying: true, byPlayer: true,
      vx: dx / d * range / T, vy: dy / d * range / T, vz: (g * T * T / 2 - z0) / T,
    });
    player.held = null;
    player.facing = dx >= 0 ? 1 : -1;
    Sfx.toss();
    dogReactToThrow(it);
  }
  function fillBowl(b) {
    const wasEmpty = b.level < 0.15;
    b.level = 1;
    player.held = null;
    if (b.kind === 'water') { Sfx.drink(); floatText(b.x, b.y - 30, 'potinho cheio!', '#2f7fd6'); }
    else { Sfx.chomp(); floatText(b.x, b.y - 30, 'ração servida!', '#9a6234'); }
    if (wasEmpty) addCoins(2, b.x, b.y);
    if (dog.state !== 'eating') dogSay(b.kind === 'water' ? 'Água fresquinha! Obrigado!' : 'RAÇÃO DE OSSO E PALHA! *baba*');
  }
  function drinkBowl() {
    waterBowl.level = Math.max(0, waterBowl.level - 0.35);
    player.thirst = clamp(player.thirst + 25, 0, 100);
    Sfx.drink();
    dogSay(`Ei! Esse potinho é meu! ...tá bom, pode beber um pouco.`);
  }
  function shakeTree(t) {
    if (t.cd > 0) return;
    t.cd = 7; t.shakeT = 0.5;
    const n = 1 + (Math.random() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const ang = rand(0.3, Math.PI - 0.3);
      spawnItem(t.apple && Math.random() < 0.5 ? 'maca' : 'graveto', t.x + Math.cos(ang) * 38, t.y + Math.sin(ang) * 24 + 10);
    }
    for (let i = 0; i < 8; i++) particles.push({ type: 'leaf', x: t.x + rand(-30, 30), y: t.y - rand(50, 90), vx: rand(-20, 20), vy: rand(20, 50), life: 1.6, max: 1.6, rot: rand(0, 6) });
  }
  function visitVet() {
    if (save.coins >= 5) addCoins(-5);
    player.hp = 100; player.hunger = Math.max(player.hunger, 70); player.thirst = Math.max(player.thirst, 70);
    dog.health = 100; dog.poisonT = 0; dog.hunger = Math.max(dog.hunger, 60); dog.thirst = Math.max(dog.thirst, 60); dog.sickWarned = false;
    if (dog.state === 'sick') dogIdle();
    dog.x = vetDoor.x - 50; dog.y = vetDoor.y + 40;
    Sfx.good();
    toast(`O veterinário cuidou de você e de ${dogName()}. Tudo 100%!`, 'good');
    dogSay('O doutor me deu um petisco! Tô novinho em folha!');
  }

  // ---------- cachorro ----------
  function dogIdle() { dog.state = 'idle'; dog.target = null; }
  function setPose(name, dur) { dog.state = 'pose'; dog.poseName = name; dog.timer = dur; dog.target = null; }
  const dogBusy = () => ['eating', 'bowlUse', 'sick'].includes(dog.state);
  const learned = id => save.learned.includes(id);

  function moveTo(e, tx, ty, speed, arrive, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d <= arrive) return true;
    const step = Math.min(speed * dt, d - arrive + 0.01);
    e.x = clamp(e.x + dx / d * step, 20, WORLD.w - 20);
    e.y = clamp(e.y + dy / d * step, 40, WORLD.h - 20);
    if (Math.abs(dx) > 2) e.facing = dx > 0 ? 1 : -1;
    e.moving = true;
    e.running = speed > 160;
    return false;
  }

  function dogReactToThrow(it) {
    const n = dogName();
    if (dogBusy() || dog.state === 'fetchBack') return;
    if (dog.mode === 'stay') {
      if (it.id === 'graveto') dogSay('*treme de vontade* ...mas você mandou eu ficar!');
      return;
    }
    if (dog.state === 'pose' && dog.poseName === 'sleep') { dogSay('*ronc* ...zzz', false); return; }
    if (it.id === 'graveto') {
      dog.state = 'fetchGo'; dog.target = it;
      dogSay(pick(['GRAVETO! *dispara*', 'Eu pego! Eu pego!', '*sai em disparada*']), false);
    } else if (isEdible(it.id)) {
      const food = ITEMS[it.id];
      if (food.toxic && learned(it.id)) { dogSay(`*cheira de longe* ${food.name}? Você me ensinou que isso faz mal. Não vou!`); return; }
      dog.state = 'eatGo'; dog.target = it;
      dogSay('Comida voando?! É pra mim?!', false);
      if (food.toxic) toast(`${n} está correndo atrás de ${food.name.toLowerCase()}! Diga "larga!" ou "não!" no chat.`, 'warn', 6000);
    }
  }

  function dogDrop() {
    const d = dog, n = dogName();
    if (d.state === 'eating' && d.eating) {
      const id = d.eating.id, food = ITEMS[id];
      spawnItem(id, d.x + d.facing * 22, d.y + 4, { ignoreUntil: time + 30 });
      d.eating = null; dogIdle();
      if (food.toxic) {
        addCoins(3, d.x, d.y);
        toast(`Boa! Você impediu ${n} de comer ${food.name.toLowerCase()}. ${food.fact}`, 'good', 6500);
        if (!learned(id)) { save.learned.push(id); persist(); }
        return `*cospe* Tá bom... ${food.name}? Entendi, faz mal. Vou lembrar!`;
      }
      return 'Tá bom… larguei. *olhar de pidão*';
    }
    if (d.state === 'eatGo' && d.target) {
      const id = d.target.id, food = ITEMS[id];
      d.target.ignoreUntil = time + 30;
      dogIdle();
      if (food.toxic) {
        addCoins(2, d.x, d.y);
        toast(`Boa! ${n} deixou ${food.name.toLowerCase()} pra lá. ${food.fact}`, 'good', 6500);
        if (!learned(id)) { save.learned.push(id); persist(); }
        return `Ok, não vou comer! ${food.name} faz mal, né? Vou lembrar.`;
      }
      return 'Ok, ok, não vou comer...';
    }
    if (d.held) {
      spawnItem(d.held, d.x + d.facing * 20, d.y + 4);
      d.held = null; dogIdle();
      return '*solta o graveto* Pronto! Joga de novo?';
    }
    return 'Larguei o quê? Não tô com nada na boca!';
  }

  const TRICKS = ['sit', 'lie', 'roll', 'paw', 'come', 'bark', 'jump', 'fetch'];
  function dogCommand(a) {
    const d = dog;
    if (a === 'drop') return dogDrop();
    if (d.state === 'sick') return '*ganido* Tô doente… me leva no veterinário? Ele fica à direita do parque.';
    if (d.state === 'eating') return '*continua mastigando* Hmpf… só um segundo…';
    if (d.state === 'bowlUse') return '*com a cara no potinho* Já vou!';
    if (d.state === 'fetchBack' && a !== 'fetch') return '*com o graveto na boca* Mmmf! Já tô levando!';
    switch (a) {
      case 'sit': setPose('sit', 6); break;
      case 'lie': setPose('lie', 7); break;
      case 'roll': setPose('roll', 1.1); break;
      case 'paw': d.facing = player.x > d.x ? 1 : -1; setPose('paw', 2.5); break;
      case 'jump': setPose('jump', 1.2); break;
      case 'sleep': setPose('sleep', 14); break;
      case 'bark': Sfx.bark(); setPose('jump', 0.4); break;
      case 'come': if (d.mode === 'stay') d.mode = 'free'; d.state = 'come'; break;
      case 'stay': d.mode = 'stay'; dogIdle(); break;
      case 'follow': d.mode = 'follow'; dogIdle(); break;
      case 'free': d.mode = 'free'; dogIdle(); break;
      case 'fetch': {
        const sticks = items.filter(i => i.id === 'graveto');
        if (!sticks.length) return 'Cadê o graveto? Sacode uma árvore e joga um pra mim!';
        sticks.sort((a, b) => dist(a, d) - dist(b, d));
        if (d.mode === 'stay') d.mode = 'free';
        d.state = 'fetchGo'; d.target = sticks[0];
        break;
      }
    }
    d.happy = clamp(d.happy + 3, 0, 100);
    if (TRICKS.includes(a) && time - d.lastObey > 12) { d.lastObey = time; addCoins(1, d.x, d.y); }
    return null;
  }

  function petDog() {
    const d = dog;
    if (d.state === 'pose' && d.poseName === 'sleep') { dogIdle(); dogSay('*boceja* Hmm? Ah, é você! Carinho?'); }
    d.happy = clamp(d.happy + 10, 0, 100);
    d.facing = player.x > d.x ? 1 : -1;
    hearts(d.x, d.y - 40);
    if (!dogBusy() && d.state !== 'fetchGo' && d.state !== 'eatGo') setPose('sit', 1.6);
    if (time - d.lastPet > 15) { d.lastPet = time; addCoins(1, d.x, d.y); }
    dogSay(pick(['*fecha os olhinhos* Aaah, aí mesmo...', 'Atrás da orelha! ATRÁS DA ORELHA!', '*perna de trás chuta sozinha*', '*encosta em você* Melhor humano.', 'Mais! Mais um pouquinho!']), false);
  }

  function giveToDog() {
    const id = player.held, food = ITEMS[id], d = dog;
    if (d.state === 'sick' && food.toxic) return dogSay('*vira o focinho* Já tô mal... não quero isso.');
    if (food.toxic && learned(id)) {
      d.happy = clamp(d.happy + 2, 0, 100);
      return dogSay(`*cheira* ${food.name}... Você me ensinou que faz mal. Não vou comer, mas obrigado por pensar em mim!`);
    }
    if (dogBusy()) return dogSay('Agora não, tô ocupado!');
    player.held = null;
    startEating(id);
    if (food.toxic) toast(`${dogName()} confiou em você e está comendo ${food.name.toLowerCase()}! Rápido: diga "larga!"`, 'warn', 6000);
  }

  function startEating(id) {
    dog.eating = { id, t: 2.4 };
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
      floatText(d.x, d.y - 46, `−${food.dmg}`, '#d64545');
      toast(`${n} comeu ${food.name.toLowerCase()}! −${food.dmg} de saúde. ${food.fact}`, 'bad', 7500);
      dogSay('*ganido* Ai... minha barriga... não tô me sentindo bem.');
    } else {
      d.hunger = clamp(d.hunger + food.food, 0, 100);
      d.health = clamp(d.health + food.heal, 0, 100);
      d.happy = clamp(d.happy + 6, 0, 100);
      dogSay(pick(['Delícia!', 'Hmm, que bom! Obrigado!', '*lambe o focinho* Tem mais?']), false);
    }
  }

  function updateDog(dt) {
    const d = dog, n = dogName();
    d.t += dt; d.moving = false; d.running = false; d.hop = 0;
    d.hunger = clamp(d.hunger - dt * 0.45, 0, 100);
    d.thirst = clamp(d.thirst - dt * 0.6, 0, 100);
    d.happy = clamp(d.happy - dt * 0.2, 0, 100);
    d.poisonT -= dt;
    if (d.hunger <= 0 || d.thirst <= 0) d.health -= dt * 0.8;
    else if (d.hunger > 50 && d.thirst > 50 && d.poisonT <= 0) d.health += dt * 0.4;
    d.health = clamp(d.health, 1, 100);
    if (d.bubble && (d.bubble.t -= dt) <= 0) d.bubble = null;

    if (d.health < 20 && !['sick', 'eating', 'bowlGo', 'bowlUse'].includes(d.state)) {
      d.state = 'sick'; d.held = null; d.target = null;
      if (!d.sickWarned) {
        d.sickWarned = true;
        dogSay('*ganido* Não tô bem... me leva no veterinário?');
        toast(`${n} está doente! Leve ao veterinário (prédio azul à direita).`, 'bad', 7000);
      }
    }

    switch (d.state) {
      case 'sick':
        if (d.health >= 35) { d.sickWarned = false; dogIdle(); }
        break;
      case 'idle': dogThink(dt); break;
      case 'wander':
        if (moveTo(d, d.target.x, d.target.y, 80, 6, dt)) dogIdle();
        dogNeeds();
        break;
      case 'come':
        if (moveTo(d, player.x - player.facing * 28, player.y + 6, 230, 10, dt)) { d.facing = player.x > d.x ? 1 : -1; setPose('sit', 3); }
        break;
      case 'fetchGo': {
        const it = d.target;
        if (!items.includes(it)) { dogIdle(); break; }
        if (moveTo(d, it.x, it.y, 250, 10, dt) && !it.flying) {
          items = items.filter(x => x !== it);
          d.held = it.id; d.state = 'fetchBack'; d.target = null;
        }
        break;
      }
      case 'fetchBack':
        if (moveTo(d, player.x + player.facing * 30, player.y + 6, 220, 12, dt)) {
          spawnItem(d.held, d.x + (player.x > d.x ? 8 : -8), d.y + 6);
          d.held = null;
          d.happy = clamp(d.happy + 15, 0, 100);
          d.facing = player.x > d.x ? 1 : -1;
          hearts(d.x, d.y - 40, 2);
          addCoins(2, d.x, d.y);
          setPose('jump', 0.8);
          dogSay(pick(['Trouxe! De novo! DE NOVO!', '*solta o graveto e encara* Joga!', 'Peguei! Sou rápido, né?']), false);
        }
        break;
      case 'eatGo': {
        const it = d.target;
        if (!items.includes(it)) { dogIdle(); break; }
        if (moveTo(d, it.x, it.y, it.byPlayer ? 190 : 120, 10, dt) && !it.flying) {
          items = items.filter(x => x !== it);
          startEating(it.id);
        }
        break;
      }
      case 'eating':
        d.hop = Math.abs(Math.sin(d.t * 12)) * 1.5;
        if ((d.eating.t -= dt) <= 0) finishEating();
        break;
      case 'bowlGo':
        if (d.target.level <= 0.05) { dogIdle(); break; }
        if (moveTo(d, d.target.x + (d.x < d.target.x ? -26 : 26), d.target.y, 130, 6, dt)) {
          d.facing = d.target.x > d.x ? 1 : -1;
          d.state = 'bowlUse'; d.timer = 2.5;
          if (d.target.kind === 'food') Sfx.chomp(); else Sfx.drink();
        }
        break;
      case 'bowlUse': {
        const b = d.target;
        d.hop = Math.abs(Math.sin(d.t * 10)) * 1.2;
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
        if (d.poseName === 'jump') d.hop = Math.abs(Math.sin(d.t * 9)) * 9;
        if (d.poseName === 'sleep') { d.happy = clamp(d.happy + dt * 0.5, 0, 100); if (Math.random() < dt * 0.8) particles.push({ type: 'text', x: d.x + 14, y: d.y - 28, vx: 10, vy: -18, life: 1.6, max: 1.6, text: 'z', color: '#6b7fa8' }); }
        if ((d.timer -= dt) <= 0) dogIdle();
        break;
    }
  }

  function dogNeeds() {
    const d = dog;
    if (d.hunger < 45 && foodBowl.level > 0.05) { d.state = 'bowlGo'; d.target = foodBowl; return true; }
    if (d.thirst < 45 && waterBowl.level > 0.05) { d.state = 'bowlGo'; d.target = waterBowl; return true; }
    return false;
  }

  function dogThink(dt) {
    const d = dog, n = dogName();
    if (d.mode === 'stay') return;
    if (dogNeeds()) return;

    if ((d.sniffT -= dt) <= 0) {
      d.sniffT = rand(7, 12);
      if (d.hunger < 80) {
        const near = items.filter(it => isEdible(it.id) && !it.flying && it.ignoreUntil < time && dist(it, d) < 240 && !(ITEMS[it.id].toxic && learned(it.id)))
          .sort((a, b) => dist(a, d) - dist(b, d))[0];
        if (near) {
          d.state = 'eatGo'; d.target = near;
          const food = ITEMS[near.id];
          dogSay(`*fareja* Hmm... cheiro de ${food.name.toLowerCase()}...`, false);
          if (food.toxic) toast(`${n} farejou ${food.name.toLowerCase()} e está indo comer! Diga "não!" ou "larga!"`, 'warn', 6000);
          return;
        }
      }
    }

    const dp = dist(d, player);
    if (d.mode === 'follow') {
      if (dp > 70) moveTo(d, player.x - player.facing * 40, player.y + 8, dp > 220 ? 230 : 150, 20, dt);
      return;
    }
    if (dp > 340) { d.state = 'wander'; d.target = { x: player.x + rand(-80, 80), y: player.y + rand(-40, 60) }; return; }
    if ((d.wanderT -= dt) <= 0) {
      d.wanderT = rand(2, 5);
      if (Math.random() < 0.65) {
        d.state = 'wander';
        d.target = { x: clamp(player.x + rand(-170, 170), 40, WORLD.w - 40), y: clamp(player.y + rand(-120, 140), 60, WORLD.h - 40) };
      }
    }
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
    if (r.dogName) { save.dogName = r.dogName; persist(); refreshNames(); }
    if (r.playerName) { save.playerName = r.playerName; persist(); }
    if (r.learn && !learned(r.learn)) { save.learned.push(r.learn); persist(); }
    if (r.happy) dog.happy = clamp(dog.happy + r.happy, 0, 100);
    let reply = r.text;
    if (r.action) {
      const override = dogCommand(r.action);
      if (override) reply = override;
    }
    setTimeout(() => dogSay(reply), 250);
  }

  // ---------- input ----------
  const keys = {};
  const chatInput = $('#chatInput');
  const typing = () => document.activeElement === chatInput || document.activeElement?.tagName === 'INPUT';
  const mouse = { x: 0, y: 0, in: false };
  const cam = { x: 0, y: 0 };
  let VW = 800, VH = 600, dpr = 1;

  addEventListener('keydown', e => {
    if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (!$('#wardrobe').hidden || !$('#help').hidden) { if (e.key === 'Escape') closeModals(); return; }
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    keys[k] = true;
    if (e.repeat) return;
    if (k === 'e' || k === ' ') interact();
    else if (k === 'r') eatHeld();
    else if (k === 'q') dropHeld();
    else if (k === 'f') throwHeld(player.x + player.facing * 220, player.y);
    else if (k === 'enter') { e.preventDefault(); chatInput.focus(); }
    else if (k === 'c' || k === 'tab') openWardrobe();
    else if (k === 'h' || k === '?') openHelp();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  chatInput.addEventListener('focus', () => { for (const k in keys) keys[k] = false; });
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat(chatInput.value); chatInput.value = ''; });
  document.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => sendChat(b.dataset.say)));

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = true;
  });
  canvas.addEventListener('mouseleave', () => { mouse.in = false; });
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    chatInput.blur();
    const r = canvas.getBoundingClientRect();
    throwHeld(e.clientX - r.left + cam.x, e.clientY - r.top + cam.y);
  });

  $('#btnInteract').addEventListener('click', interact);
  $('#btnEat').addEventListener('click', eatHeld);
  $('#btnDrop').addEventListener('click', dropHeld);

  function updatePlayer(dt) {
    const p = player;
    p.t += dt; p.moving = false; p.hurtT -= dt;
    if (p.bubble && (p.bubble.t -= dt) <= 0) p.bubble = null;

    p.hunger = clamp(p.hunger - dt * 0.35, 0, 100);
    p.thirst = clamp(p.thirst - dt * 0.5, 0, 100);
    if (p.hunger <= 0 || p.thirst <= 0) p.hp -= dt * 1.5;
    else if (p.hunger > 40 && p.thirst > 40) p.hp = Math.min(100, p.hp + dt * 0.6);

    if (p.downT > 0) {
      if ((p.downT -= dt) <= 0) {
        p.x = vetDoor.x; p.y = vetDoor.y + 50; p.hp = 60; p.hunger = 60; p.thirst = 60;
        dog.x = p.x - 40; dog.y = p.y + 10; dogIdle();
        toast('Você acordou no veterinário. Cuidado com o que come!', 'info');
      }
      return;
    }
    if (p.hp <= 0) {
      p.hp = 0; p.downT = 1.6; p.held = null;
      addCoins(-Math.min(5, save.coins));
      toast('Você passou mal e desmaiou! Perdeu até 5 ossinhos.', 'bad', 6000);
      return;
    }

    let mx = 0, my = 0;
    if (keys.a || keys.arrowleft) mx -= 1;
    if (keys.d || keys.arrowright) mx += 1;
    if (keys.w || keys.arrowup) my -= 1;
    if (keys.s || keys.arrowdown) my += 1;
    if (joy.active) { mx = joy.dx; my = joy.dy; }
    const len = Math.hypot(mx, my);
    if (len > 0.1) {
      const sp = (keys.shift ? 260 : 180) * Math.min(1, len) / len;
      const nx = clamp(p.x + mx * sp * dt, 20, WORLD.w - 20), ny = clamp(p.y + my * sp * dt, 50, WORLD.h - 20);
      if (!blocked(nx, p.y)) p.x = nx;
      if (!blocked(p.x, ny)) p.y = ny;
      if (Math.abs(mx) > 0.1) p.facing = mx > 0 ? 1 : -1;
      p.moving = true;
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      if (Math.hypot(coins[i].x - p.x, coins[i].y - p.y) < 26) { addCoins(1, coins[i].x, coins[i].y); coins.splice(i, 1); }
    }
  }

  // joystick de toque (celular)
  const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  canvas.addEventListener('touchstart', e => {
    const tch = e.changedTouches[0], r = canvas.getBoundingClientRect();
    const x = tch.clientX - r.left, y = tch.clientY - r.top;
    if (x < VW / 2) { Object.assign(joy, { active: true, id: tch.identifier, ox: x, oy: y, dx: 0, dy: 0 }); }
    else if (player.held) throwHeld(x + cam.x, y + cam.y);
    else interact();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    for (const tch of e.changedTouches) if (tch.identifier === joy.id) {
      const r = canvas.getBoundingClientRect();
      const dx = tch.clientX - r.left - joy.ox, dy = tch.clientY - r.top - joy.oy, d = Math.hypot(dx, dy) || 1;
      joy.dx = dx / Math.max(d, 40); joy.dy = dy / Math.max(d, 40);
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', e => { for (const tch of e.changedTouches) if (tch.identifier === joy.id) joy.active = false; });

  // ---------- update ----------
  let spawnT = 4, coinT = 3, hudT = 0;
  function update(dt) {
    time += dt;
    updatePlayer(dt);
    updateDog(dt);

    for (const it of items) {
      if (!it.flying) continue;
      it.x += it.vx * dt; it.y += it.vy * dt; it.vz -= 900 * dt; it.z += it.vz * dt;
      it.x = clamp(it.x, 20, WORLD.w - 20); it.y = clamp(it.y, 50, WORLD.h - 20);
      if (it.z <= 0) {
        it.z = 0; it.flying = false;
        if (inPond(it.x, it.y)) {
          it.gone = true; Sfx.splash();
          for (let i = 0; i < 10; i++) particles.push({ type: 'splash', x: it.x, y: it.y, vx: rand(-50, 50), vy: rand(-90, -30), life: 0.6, max: 0.6 });
          if (dog.target === it) { dogIdle(); dogSay('Caiu na água! *olha triste pro lago*'); }
        }
      }
    }
    items = items.filter(it => !it.gone);

    for (const t of trees) { t.cd -= dt; t.shakeT -= dt; }
    for (const pt of particles) {
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.type === 'splash') pt.vy += 300 * dt;
      if (pt.type === 'leaf') { pt.rot += dt * 3; pt.vx = Math.sin(pt.life * 4) * 30; }
    }
    particles = particles.filter(pt => pt.life > 0);

    if ((spawnT -= dt) <= 0) {
      spawnT = rand(5, 9);
      if (items.filter(i => isEdible(i.id)).length < 14) { const p = randomFreeSpot(); spawnItem(weightedFood(), p.x, p.y); }
    }
    if ((coinT -= dt) <= 0) {
      coinT = rand(4, 8);
      if (coins.length < 8) { const p = randomFreeSpot(); coins.push({ x: p.x, y: p.y, phase: Math.random() * 10 }); }
    }
    if ((hudT -= dt) <= 0) { hudT = 0.15; updateHud(); }
  }

  // ---------- render ----------
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    VW = r.width; VH = r.height;
    canvas.width = Math.round(VW * dpr); canvas.height = Math.round(VH * dpr);
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  function drawGround() {
    ctx.fillStyle = '#6fae52';
    ctx.fillRect(cam.x - 10, cam.y - 10, VW + 20, VH + 20);
    ctx.fillStyle = '#8fcf6a';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    for (const p of patches) Draw.ellipse(ctx, p.x, p.y, p.rx, p.ry, 0, 'rgba(255,255,255,0.06)');

    ctx.strokeStyle = '#dcc39a'; ctx.lineWidth = 40; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(HOME.x, HOME.y + 140);
    ctx.bezierCurveTo(HOME.x + 500, HOME.y + 280, 1300, 300, vetDoor.x, vetDoor.y + 30);
    ctx.moveTo(HOME.x + 260, HOME.y + 230);
    ctx.quadraticCurveTo(900, 900, pond.x - pond.rx - 20, pond.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,120,70,0.18)'; ctx.lineWidth = 28; ctx.stroke();

    const vx0 = cam.x - 20, vx1 = cam.x + VW + 20, vy0 = cam.y - 20, vy1 = cam.y + VH + 20;
    ctx.strokeStyle = '#6aa64a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const t of tufts) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      ctx.moveTo(t.x - 3 * t.s, t.y); ctx.lineTo(t.x - 1 * t.s, t.y - 6 * t.s);
      ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 0.5 * t.s, t.y - 8 * t.s);
      ctx.moveTo(t.x + 3 * t.s, t.y); ctx.lineTo(t.x + 2.5 * t.s, t.y - 5 * t.s);
    }
    ctx.stroke();
    for (const f of flowers) {
      if (f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1) continue;
      for (let i = 0; i < 5; i++) Draw.circle(ctx, f.x + Math.cos(i * 1.26) * 2.6, f.y + Math.sin(i * 1.26) * 2.6, 2, f.c);
      Draw.circle(ctx, f.x, f.y, 1.4, '#f2a33a');
    }
    Draw.pond(ctx, pond, time);

    // cerca
    ctx.fillStyle = '#b98a55';
    for (let x = 0; x <= WORLD.w; x += 40) { ctx.fillRect(x - 3, -6, 6, 26); ctx.fillRect(x - 3, WORLD.h - 22, 6, 26); }
    for (let y = 0; y <= WORLD.h; y += 40) { ctx.fillRect(-4, y - 6, 8, 26); ctx.fillRect(WORLD.w - 4, y - 6, 8, 26); }
    ctx.fillStyle = '#a3763f';
    ctx.fillRect(0, 2, WORLD.w, 4); ctx.fillRect(0, 12, WORLD.w, 4);
    ctx.fillRect(0, WORLD.h - 14, WORLD.w, 4); ctx.fillRect(0, WORLD.h - 4, WORLD.w, 4);
  }

  function drawGroundItem(it) {
    const bob = it.flying ? 0 : Math.sin(time * 3 + it.uid) * 1.2;
    Draw.ellipse(ctx, it.x, it.y + 2, 9 * (1 - Math.min(it.z, 120) / 240), 3, 0, 'rgba(0,0,0,0.18)');
    const isToxic = ITEMS[it.id].toxic;
    Draw.item(ctx, it.id, it.x, it.y - 6 - it.z + bob, 1.1, it.flying ? time * 12 : 0);
    if (isToxic && learned(it.id) && !it.flying) {
      ctx.strokeStyle = 'rgba(214,69,69,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(it.x, it.y - 6, 14, 0, TAU); ctx.moveTo(it.x - 10, it.y - 16); ctx.lineTo(it.x + 10, it.y + 4); ctx.stroke();
    }
  }

  function drawLabel(x, y, text, color = 'rgba(59,42,30,0.75)') {
    ctx.font = '700 11px Nunito, sans-serif';
    const w = ctx.measureText(text).width + 12;
    Draw.rrect(ctx, x - w / 2, y - 9, w, 17, 8, color);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.x = WORLD.w <= VW ? (WORLD.w - VW) / 2 : clamp(player.x - VW / 2, 0, WORLD.w - VW);
    cam.y = WORLD.h <= VH ? (WORLD.h - VH) / 2 : clamp(player.y - VH / 2, 0, WORLD.h - VH);
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    drawGround();

    const list = [];
    for (const t of trees) list.push({ y: t.y, f: () => { ctx.save(); if (t.shakeT > 0) ctx.translate(Math.sin(t.shakeT * 50) * 3, 0); Draw.tree(ctx, t.x, t.y, t.apple, time + t.phase); ctx.restore(); } });
    list.push({ y: house.y, f: () => Draw.doghouse(ctx, house.x, house.y, dogName()) });
    list.push({ y: faucet.y, f: () => Draw.faucet(ctx, faucet.x, faucet.y, time) });
    list.push({ y: bag.y, f: () => Draw.bag(ctx, bag.x, bag.y) });
    list.push({ y: foodBowl.y - 10, f: () => Draw.bowl(ctx, foodBowl.x, foodBowl.y, 'food', foodBowl.level, '#d64545') });
    list.push({ y: waterBowl.y - 10, f: () => Draw.bowl(ctx, waterBowl.x, waterBowl.y, 'water', waterBowl.level, '#2f7fd6') });
    list.push({ y: vet.y, f: () => Draw.vet(ctx, vet.x, vet.y, vet.w, vet.h) });
    for (const it of items) list.push({ y: it.y, f: () => drawGroundItem(it) });
    for (const c of coins) list.push({ y: c.y, f: () => { Draw.ellipse(ctx, c.x, c.y + 2, 7, 2.5, 0, 'rgba(0,0,0,0.15)'); Draw.item(ctx, 'coin', c.x, c.y - 8 - Math.sin(time * 3 + c.phase) * 2.5, 1.1); } });
    list.push({ y: dog.y, f: () => Draw.dog(ctx, dog.x, dog.y, {
      facing: dog.facing, skin: save.dogSkin, t: dog.t, moving: dog.moving, pose: dogPose(), held: dog.held, hop: dog.hop,
      pant: dog.running || dog.happy > 80, wagSpeed: dog.happy > 60 ? 14 : dog.happy > 30 ? 8 : 3, wagAmp: dog.state === 'sick' ? 0.05 : 0.45,
    }) });
    list.push({ y: player.y, f: () => {
      if (player.downT > 0) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 20); }
      Draw.dog(ctx, player.x, player.y, {
        facing: player.facing, skin: save.playerSkin, t: player.t, moving: player.moving, scale: 1.15,
        pose: player.downT > 0 ? 'sick' : 'stand', held: player.held, pant: keys.shift && player.moving,
      });
      ctx.globalAlpha = 1;
    } });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();

    for (const pt of particles) {
      const a = Math.max(0, pt.life / pt.max);
      ctx.globalAlpha = a;
      if (pt.type === 'heart') Draw.heart(ctx, pt.x, pt.y, 1.3, '#f05a7e');
      else if (pt.type === 'leaf') Draw.ellipse(ctx, pt.x, pt.y, 4, 2, pt.rot, '#5fb455');
      else if (pt.type === 'splash') Draw.circle(ctx, pt.x, pt.y, 2.5, '#9fd4f5');
      else if (pt.type === 'text') {
        ctx.font = '800 13px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.strokeText(pt.text, pt.x, pt.y);
        ctx.fillStyle = pt.color; ctx.fillText(pt.text, pt.x, pt.y);
      }
    }
    ctx.globalAlpha = 1;

    // mira do arremesso
    if (player.held && player.held !== 'jarra' && mouse.in && player.downT <= 0) {
      const mx = mouse.x + cam.x, my = mouse.y + cam.y;
      const dx = mx - player.x, dy = my - player.y, d = Math.hypot(dx, dy) || 1, r = clamp(d, 50, 420);
      const tx = player.x + dx / d * r, ty = player.y + dy / d * r;
      ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(player.x, player.y - 14);
      ctx.quadraticCurveTo((player.x + tx) / 2, Math.min(player.y, ty) - r * 0.35, tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(tx, ty, 10, 4, 0, 0, TAU); ctx.stroke();
    }

    const dogHeadY = dog.y - (dogPose() === 'stand' ? 52 : 40) - dog.hop;
    if (dog.bubble) Draw.bubble(ctx, dog.x, dogHeadY, dog.bubble.text);
    else drawLabel(dog.x, dogHeadY - 4, dogName() + (dog.mode === 'stay' ? ' · parado' : dog.mode === 'follow' ? ' · seguindo' : ''), 'rgba(176,111,44,0.85)');
    if (player.bubble) Draw.bubble(ctx, player.x, player.y - 56, player.bubble.text);
    else drawLabel(player.x, player.y - 60, save.playerName || 'Você', 'rgba(47,127,214,0.85)');

    const it = player.downT > 0 ? null : interactions();
    if (it) {
      ctx.font = '800 12px Nunito, sans-serif';
      const label = `E  ${it.label}`, w = ctx.measureText(label).width + 18;
      const y = player.y + 22;
      Draw.rrect(ctx, player.x - w / 2, y, w, 22, 11, 'rgba(30,22,16,0.78)');
      Draw.rrect(ctx, player.x - w / 2 + 4, y + 3, 16, 16, 5, '#ffd34d');
      ctx.fillStyle = '#3b2a1e'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('E', player.x - w / 2 + 8, y + 11.5);
      ctx.fillStyle = '#fff'; ctx.fillText(it.label, player.x - w / 2 + 24, y + 11.5);
    }
    ctx.restore();

    if (player.hurtT > 0) { ctx.fillStyle = `rgba(214,69,69,${player.hurtT * 0.5})`; ctx.fillRect(0, 0, VW, VH); }
    if (player.downT > 0) { ctx.fillStyle = `rgba(20,10,5,${0.7 - player.downT * 0.3})`; ctx.fillRect(0, 0, VW, VH); }
    if (joy.active) {
      Draw.circle(ctx, joy.ox, joy.oy, 40, 'rgba(255,255,255,0.25)');
      Draw.circle(ctx, joy.ox + joy.dx * 40, joy.oy + joy.dy * 40, 18, 'rgba(255,255,255,0.6)');
    }
  }

  // ---------- HUD ----------
  const bars = {};
  document.querySelectorAll('[data-bar]').forEach(el => { bars[el.dataset.bar] = el; });
  function setBar(key, v) {
    const el = bars[key];
    if (!el) return;
    el.querySelector('i').style.width = `${clamp(v, 0, 100)}%`;
    el.querySelector('span').textContent = Math.round(clamp(v, 0, 100));
    el.classList.toggle('low', v < 25);
  }
  const heldCanvas = $('#heldIcon'), heldCtx = heldCanvas.getContext('2d');
  let lastHeld = '-';
  function updateHud() {
    setBar('p-hp', player.hp); setBar('p-hunger', player.hunger); setBar('p-thirst', player.thirst);
    setBar('d-health', dog.health); setBar('d-hunger', dog.hunger); setBar('d-thirst', dog.thirst); setBar('d-happy', dog.happy);
    const mood = dog.state === 'sick' ? 'doente 🤒' : dog.state === 'eating' ? 'comendo' : dog.state === 'pose' && dog.poseName === 'sleep' ? 'dormindo' : dog.happy > 70 ? 'muito feliz' : dog.happy > 35 ? 'tranquilo' : 'entediado';
    $('#dogMood').textContent = mood;
    if (player.held !== lastHeld) {
      lastHeld = player.held;
      heldCtx.setTransform(1, 0, 0, 1, 0, 0);
      heldCtx.clearRect(0, 0, heldCanvas.width, heldCanvas.height);
      if (player.held) Draw.item(heldCtx, player.held, heldCanvas.width / 2, heldCanvas.height / 2 + 2, 2.2);
      $('#heldName').textContent = player.held ? ITEMS[player.held].name : 'Nada na boca';
      const h = player.held;
      $('#heldHint').textContent = !h ? 'Chegue perto de algo e aperte E'
        : h === 'jarra' ? 'E no potinho azul · R bebe'
        : h === 'racao' ? 'E no potinho vermelho · R come · clique joga'
        : isEdible(h) ? 'R come · clique joga · E dá pro cachorro'
        : 'Clique para jogar · Q solta';
      $('#btnEat').disabled = !h || !(isEdible(h) || h === 'jarra');
      $('#btnDrop').disabled = !h;
    }
  }
  function refreshNames() {
    document.querySelectorAll('[data-dogname]').forEach(el => { el.textContent = dogName(); });
    $('#coins').textContent = save.coins;
    chatInput.placeholder = `Fale com ${dogName()}… (Enter)`;
  }

  // ---------- modais ----------
  let wardrobeWho = 'player', previewRAF = 0;
  function closeModals() {
    $('#wardrobe').hidden = true; $('#help').hidden = true;
    paused = false; cancelAnimationFrame(previewRAF);
  }
  function openHelp() { $('#help').hidden = false; paused = true; }
  function openWardrobe() {
    $('#wardrobe').hidden = false; paused = true;
    renderWardrobe();
    const pc = $('#preview'), pctx = pc.getContext('2d');
    const loop = t => {
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.clearRect(0, 0, pc.width, pc.height);
      Draw.ellipse(pctx, pc.width / 2, pc.height - 40, 90, 22, 0, '#a8d98a');
      Draw.dog(pctx, pc.width / 2 - 10, pc.height - 40, {
        facing: 1, skin: wardrobeWho === 'player' ? save.playerSkin : save.dogSkin, t: t / 1000, scale: 3, pant: true, wagSpeed: 12,
        moving: Math.floor(t / 2500) % 2 === 1,
      });
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
            if (save.coins < def.price) { toast(`Faltam ${def.price - save.coins} ossinhos para ${def.name}. Brinque com o cachorro para ganhar!`, 'info', 3500); return; }
            save.coins -= def.price;
            save.unlocked.push(`${kind}:${key}`);
            Sfx.good();
            toast(`Você comprou ${def.name}!`, 'good', 2500);
          }
          skin[kind] = key;
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
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('mousedown', e => { if (e.target === m) closeModals(); }));
  $('#btnWardrobe').addEventListener('click', openWardrobe);
  $('#btnHelp').addEventListener('click', openHelp);
  const muteBtn = $('#btnMute');
  const syncMute = () => { muteBtn.textContent = save.muted ? '🔇' : '🔊'; muteBtn.title = save.muted ? 'Ligar som' : 'Desligar som'; };
  muteBtn.addEventListener('click', () => { save.muted = !save.muted; persist(); syncMute(); });
  syncMute();
  $('#helpStart').addEventListener('click', () => { save.seenHelp = true; persist(); closeModals(); });

  // ---------- start ----------
  refreshNames();
  updateHud();
  logMsg('sys', `${dogName()} está te esperando! Diga "oi", "senta", "busca" ou pergunte "posso te dar chocolate?"`);
  if (!save.seenHelp) openHelp();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__cachocraft = { player, dog, save, sendChat, get items() { return items; } };
})();
