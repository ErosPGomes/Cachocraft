'use strict';
// Catálogos do jogo: pelagens, coleiras, acessórios e itens do mundo.

const TAU = Math.PI * 2;

const COATS = {
  caramelo: { name: 'Caramelo', price: 0, base: '#d9934a', belly: '#f3cf98', ear: '#b06f2c' },
  pretinho: { name: 'Pretinho', price: 0, base: '#342c28', belly: '#55483f', ear: '#1f1916' },
  golden:   { name: 'Golden', price: 10, base: '#efbf6f', belly: '#f9e0b0', ear: '#d69c45' },
  dalmata:  { name: 'Dálmata', price: 15, base: '#f5f2ea', belly: '#ffffff', ear: '#262222', pattern: 'spots', patternColor: '#262222' },
  husky:    { name: 'Husky', price: 20, base: '#7d8592', belly: '#f2f2f2', ear: '#565d69', pattern: 'mask', patternColor: '#f2f2f2', ears: 'up' },
  beagle:   { name: 'Beagle', price: 20, base: '#f4eee2', belly: '#ffffff', ear: '#9a5a26', head: '#c27a3a', pattern: 'saddle', patternColor: '#2c2420' },
  salsicha: { name: 'Salsicha', price: 25, base: '#7b3a1c', belly: '#a65a32', ear: '#5c2a12', long: 1.35, short: 0.55 },
  pug:      { name: 'Pug', price: 30, base: '#e6cd9d', belly: '#f3e2c0', ear: '#2a2320', pattern: 'muzzle', patternColor: '#2a2320', short: 0.8, snout: 0.35 },
  algodao:  { name: 'Algodão-doce', price: 45, base: '#f6b3d0', belly: '#fde3ef', ear: '#e98cb8' },
};

const COLLARS = {
  vermelha: { name: 'Vermelha', price: 0, color: '#d23b3b' },
  azul:     { name: 'Azul', price: 0, color: '#2f7fd6' },
  verde:    { name: 'Verde', price: 5, color: '#3fa45a' },
  rosa:     { name: 'Rosa', price: 5, color: '#f06aa8' },
  couro:    { name: 'Couro', price: 8, color: '#7a4a24' },
  roxa:     { name: 'Roxa', price: 10, color: '#8a5bd6' },
  dourada:  { name: 'Dourada', price: 30, color: '#f2c230' },
  arcoiris: { name: 'Arco-íris', price: 40, color: '#f06aa8', rainbow: true },
};

const ACCESSORIES = {
  nenhum:   { name: 'Nenhum', price: 0, icon: '—' },
  bandana:  { name: 'Bandana', price: 8, icon: '🧣' },
  laco:     { name: 'Laço', price: 10, icon: '🎀' },
  osso:     { name: 'Osso na boca', price: 12, icon: '🦴' },
  pingente: { name: 'Pingente de ossinho', price: 15, icon: '🏅' },
  oculos:   { name: 'Óculos escuros', price: 18, icon: '🕶️' },
  chapeu:   { name: 'Chapéu de festa', price: 20, icon: '🎉' },
  coroa:    { name: 'Coroa', price: 50, icon: '👑' },
};

const CATALOG = { coat: COATS, collar: COLLARS, acc: ACCESSORIES };

// safe: comida boa pra cachorro. toxic: faz mal na vida real, então faz mal no jogo.
const ITEMS = {
  graveto:   { name: 'Graveto' },
  jarra:     { name: "Jarra d'água", drink: 40 },
  racao:     { name: 'Ração de osso e palha', safe: true, food: 35, heal: 6, fact: 'A comida oficial de Cachocraft: nutritiva e segura.' },
  petisco:   { name: 'Petisco natural', safe: true, food: 15, heal: 3, fact: 'Petisco feito para cães, com moderação, é ótimo.' },
  cenoura:   { name: 'Cenoura', safe: true, food: 12, heal: 4, fact: 'Cenoura é segura e ajuda a limpar os dentes.' },
  maca:      { name: 'Maçã sem sementes', safe: true, food: 12, heal: 4, fact: 'Maçã sem sementes e sem miolo é um petisco seguro.' },
  chocolate: { name: 'Chocolate', toxic: true, dmg: 30, fact: 'Chocolate tem teobromina, que o cão não consegue eliminar.' },
  uva:       { name: 'Uva', toxic: true, dmg: 35, fact: 'Uva e uva-passa podem causar insuficiência renal em cães.' },
  cebola:    { name: 'Cebola', toxic: true, dmg: 25, fact: 'Cebola e alho destroem as hemácias e causam anemia.' },
  biscoito:  { name: 'Biscoito recheado', toxic: true, dmg: 15, fact: 'Biscoito de gente tem açúcar, gordura e às vezes chocolate ou xilitol.' },
  cafe:      { name: 'Café', toxic: true, dmg: 30, fact: 'Cafeína dispara o coração do cão e pode causar convulsões.' },
  abacate:   { name: 'Abacate', toxic: true, dmg: 20, fact: 'Abacate tem persina, e o caroço pode causar obstrução.' },
  chiclete:  { name: 'Chiclete com xilitol', toxic: true, dmg: 40, fact: 'Xilitol derruba a glicose do cão e pode lesar o fígado.' },
};

ITEMS.osso = { name: 'Osso' };
ITEMS.kit_casinha = { name: 'Kit casinha de cachorro' };

const isEdible = id => !!(ITEMS[id] && (ITEMS[id].safe || ITEMS[id].toxic));

// Receitas de Cachocraft (ingredientes → resultado). Chaves de bloco vêm de js/world.js.
const RECIPES = [
  { out: 'tabuas', n: 4, need: { tronco: 1 } },
  { out: 'graveto', n: 4, need: { tabuas: 1 } },
  { out: 'palha', n: 1, need: { capim: 4 } },
  { out: 'racao', n: 3, need: { palha: 1, osso: 1 } },
  { out: 'petisco', n: 2, need: { osso: 1, cenoura: 1 } },
  { out: 'bloco_racao', n: 1, need: { racao: 4 } },
  { out: 'bloco_osso', n: 1, need: { osso: 4 } },
  { out: 'vidro', n: 1, need: { areia: 2 } },
  { out: 'telhas', n: 4, need: { terra: 2, areia: 1 } },
  { out: 'parede', n: 4, need: { pedregulho: 2, areia: 1 } },
  { out: 'pelucia', n: 2, need: { palha: 1, flor_vermelha: 1 } },
  { out: 'kit_casinha', n: 1, need: { tabuas: 10, telhas: 6 } },
];

const SPAWN_WEIGHTS = {
  petisco: 2, cenoura: 3, maca: 2,
  chocolate: 2, uva: 2, cebola: 1.5, biscoito: 2, cafe: 1, abacate: 1, chiclete: 1,
};
