// The noodle shop's progression: coins from tips buy plants and decorations
// that appear in the shop, and new bowls; hearts earned add up to pages of
// Grandpa's recipe book. Saved on this device.

const KEY = 'crossing-the-bridge.progress.v1';

export const ITEMS = [
  { id: 'fern', ico: '🪴', name: 'A fern by the wall', price: 15 },
  { id: 'ivy', ico: '🌿', name: 'Ivy over the beams', price: 30 },
  { id: 'lanterns', ico: '🏮', name: 'More lanterns', price: 35 },
  { id: 'bamboo', ico: '🎍', name: 'Lucky bamboo', price: 40 },
  { id: 'camellia', ico: '🌺', name: 'Camellia, Kunming’s flower', price: 60 },
  { id: 'celadon', ico: '🥣', name: 'Celadon bowls', price: 50, bowl: '#7fb5a0' },
  { id: 'lacquer', ico: '🍜', name: 'Red-rim bowls', price: 50, bowl: '#c0392b' },
];

// Grandpa's recipe book: found a page at a time (hearts from happy customers).
// The last page stays missing: that one is the story's to give.
export const PAGES = [
  { at: 6, text: 'The broth: an old hen and pork bones, four hours, never a drop of water added.' },
  { at: 18, text: 'The oil seal: chicken fat, a coin thick. No steam shows. Underneath, hotter than boiling.' },
  { at: 36, text: 'The order: raw first, while it’s scalding. Then cooked, then flowers, then greens. Noodles last.' },
  { at: 60, text: 'Slice the pork thin enough to read a newspaper through.' },
  { at: Infinity, text: '…the last page has been torn out.' },
];

let P = null;
export function progress() {
  if (P) return P;
  P = { coins: 0, hearts: 0, owned: [], bowl: null };
  try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  return P;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch {} }

export function owns(id) { return progress().owned.includes(id); }
export function buy(id) {
  const p = progress(), it = ITEMS.find(i => i.id === id);
  if (!it || owns(id) || p.coins < it.price) return false;
  p.coins -= it.price; p.owned.push(id);
  if (it.bowl) p.bowl = id;
  save(); return true;
}
export function useBowl(id) { const p = progress(); if (owns(id) || id === null) { p.bowl = id; save(); } }
export function bowlRim(fallback) { const it = ITEMS.find(i => i.id === progress().bowl); return it?.bowl || fallback; }
export function earn(coins, hearts) { const p = progress(); p.coins += coins; p.hearts += hearts; save(); }
export function pagesFound() { return PAGES.filter(pg => progress().hearts >= pg.at); }
export const heartsFor = points => points >= 85 ? 3 : points >= 65 ? 2 : 1;
