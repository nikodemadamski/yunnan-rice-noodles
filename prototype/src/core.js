// Shared game state, per-frame tickers and small helpers.

export const G = {
  name: 'You',
  day: 1,
  clock: 10 * 60,          // minutes since midnight
  clockRunning: false,
  money: 0,
  busy: 0,                 // >0 while a dialogue, panel or cutscene owns the player
  findings: new Set(),     // ids of Bowl Lab options the player has unlocked
  foodDex: new Set(),
  ordersDone: new Set(),
  stars: [],
  auntieGags: 0,
  bans: new Set(),         // restaurants that caught you scheming
  run: null,               // the active delivery, if any
  flags: {},
};

// Game minutes that pass per real second while riding / walking.
export const CLOCK_SPEED = 2;

const tickers = new Set();

export function addTicker(fn) {
  tickers.add(fn);
  return () => tickers.delete(fn);
}

export function runTickers(dt) {
  for (const fn of [...tickers]) {
    if (fn(dt) === true) tickers.delete(fn);
  }
}

export function wait(sec) {
  return new Promise(res => {
    let t = 0;
    addTicker(dt => {
      t += dt;
      if (t >= sec) { res(); return true; }
    });
  });
}

export function until(cond) {
  return new Promise(res => {
    if (cond()) return res();
    addTicker(() => {
      if (cond()) { res(); return true; }
    });
  });
}

// Deterministic RNG (mulberry32) so runs are reproducible.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function fmtClock(min) {
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
