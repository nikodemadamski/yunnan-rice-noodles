// Cooking foley: recorded-sounding samples synthesised offline by
// tools/foley/synth.py into assets/sfx/*.m4a (AAC, so iPhone Safari plays them),
// with *.ogg (Opus) as a fallback for browsers built without AAC.
//
//   foley('plop_heavy')                 -> a random plop_heavy_1..3, ±4% pitch
//   foley('pour_broth', { gain: 0.8, pan: -0.3, delay: 0.1 })
//   const boil = foleyLoop('boil_loop', 0.4); boil.set(0.1); boil.stop();
//
// Uses the game's shared AudioContext and master gain from audio.js. Until the
// context exists (first tap) every call is a silent no-op. Nothing here throws.

import { audioCtx, sfxOut } from './audio.js';

const VARIANTS = {
  plop_light: 3, plop_heavy: 3, sizzle: 2, chopsticks: 2, slurp: 2, knife_chop: 2,
};
const SINGLES = [
  'pour_broth', 'ladle_clink', 'oil_pour', 'egg_crack', 'noodle_slide', 'noodle_lift',
  'boil_loop', 'simmer_loop', 'bowl_set', 'saucer_set', 'stir', 'coin_drop', 'bell_counter',
];
export const FOLEY_FILES = [
  ...SINGLES,
  ...Object.entries(VARIANTS).flatMap(([b, n]) => Array.from({ length: n }, (_, i) => `${b}_${i + 1}`)),
];
const LOOP_LEN = 4.0;                                  // seconds, as rendered by synth.py
const LOOP_IN = 0.1;                                   // loop window start inside the file
const BASE = new URL('../assets/sfx/', import.meta.url);
// AAC everywhere it exists (Safari/iOS, Chrome, Edge); Ogg Opus for builds without it.
const EXTS = (() => {
  try {
    const a = document.createElement('audio');
    return a.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? ['m4a', 'ogg'] : ['ogg', 'm4a'];
  } catch { return ['m4a', 'ogg']; }
})();

const buffers = new Map();                             // file -> AudioBuffer
const pending = new Map();                             // file -> Promise<AudioBuffer|null>
const lastPick = new Map();                            // base name -> last variant played
let preloadedFor = null;

function decode(ctx, data) {
  return new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(data, resolve, reject);   // callback form for old webkit
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (e) { reject(e); }
  });
}

function load(ctx, file) {
  if (buffers.has(file)) return Promise.resolve(buffers.get(file));
  if (pending.has(file)) return pending.get(file);
  const get = (ext) => fetch(new URL(file + '.' + ext, BASE))
    .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + file + '.' + ext); return r.arrayBuffer(); })
    .then((ab) => decode(ctx, ab));
  const p = get(EXTS[0])
    .catch(() => get(EXTS[1]))                       // other format if the first won't decode
    .then((buf) => { buffers.set(file, buf); return buf; })
    .catch((e) => { try { console.warn('foley: could not load', file, e && e.message); } catch {} return null; });
  pending.set(file, p);
  return p;
}

/** Fetch and decode every foley file (once the AudioContext exists). Returns a promise. */
export function preloadFoley() {
  try {
    const ctx = audioCtx();
    if (!ctx) return Promise.resolve(false);
    if (preloadedFor !== ctx) {
      preloadedFor = ctx;
      return Promise.all(FOLEY_FILES.map((f) => load(ctx, f))).then((bs) => bs.every(Boolean));
    }
    return Promise.all(FOLEY_FILES.map((f) => pending.get(f))).then((bs) => bs.every(Boolean));
  } catch {
    return Promise.resolve(false);
  }
}

/** Decoded duration in seconds of a file (or 0 if not loaded yet). */
export function foleyDuration(file) {
  const b = buffers.get(file);
  return b ? b.duration : 0;
}

function pickFile(name) {
  const n = VARIANTS[name];
  if (!n) return name;
  let k = 1 + Math.floor(Math.random() * n);
  if (n > 1 && k === lastPick.get(name)) k = (k % n) + 1;  // never the same take twice in a row
  lastPick.set(name, k);
  return `${name}_${k}`;
}

function chain(ctx, gain, pan) {
  const g = ctx.createGain();
  g.gain.value = gain;
  let out = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    out = p;
  }
  out.connect(sfxOut());
  return g;
}

function play(ctx, buf, { gain = 1, rate = 1, pan = 0, delay = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * 0.04);
  const g = chain(ctx, gain, pan);
  src.connect(g);
  src.onended = () => { try { src.disconnect(); g.disconnect(); } catch {} };
  src.start(ctx.currentTime + Math.max(0, delay));
  return src;
}

/**
 * Play a one-shot. name is a file ('sizzle_2') or a base with variants
 * ('sizzle'). Sounds requested before their file has decoded still play if
 * it arrives within a quarter second, otherwise they are dropped.
 */
export function foley(name, opts = {}) {
  try {
    const ctx = audioCtx();
    if (!ctx || !sfxOut()) return;
    preloadFoley();
    const file = pickFile(name);
    const buf = buffers.get(file);
    if (buf) { play(ctx, buf, opts); return; }
    const asked = ctx.currentTime;
    load(ctx, file).then((b) => {
      try {
        const late = ctx.currentTime - asked;
        if (b && late < 0.25) play(ctx, b, { ...opts, delay: Math.max(0, (opts.delay || 0) - late) });
      } catch {}
    });
  } catch {}
}

/**
 * Start a seamless loop ('boil_loop', 'simmer_loop'). Returns a handle:
 * .set(gain) glides the level, .stop() fades out and releases it.
 * Safe to call before the context exists: it starts on the first .set()
 * after audio is unlocked.
 */
export function foleyLoop(name, gain = 1) {
  let src = null, g = null, level = gain, stopped = false, starting = false;
  const start = () => {
    try {
      const ctx = audioCtx();
      if (stopped || src || starting || !ctx || !sfxOut()) return;
      preloadFoley();
      starting = true;
      load(ctx, name).then((buf) => {
        starting = false;
        if (!buf || stopped || src) return;
        try {
          src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          // Files hold one 4 s period plus 0.2 s of wrap-around, so this exact
          // 4 s window is seamless whatever priming the decoder kept or trimmed.
          src.loopStart = LOOP_IN;
          src.loopEnd = LOOP_IN + LOOP_LEN;
          g = chain(ctx, 0, 0);
          g.gain.setTargetAtTime(level, ctx.currentTime, 0.12);
          src.connect(g);
          src.start(ctx.currentTime, LOOP_IN + Math.random() * LOOP_LEN);
        } catch { src = null; }
      });
    } catch { starting = false; }
  };
  start();
  return {
    set(v) {
      try {
        level = Math.max(0, +v || 0);
        if (!src) { start(); return; }
        const ctx = audioCtx();
        g.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
      } catch {}
    },
    stop(fadeSec = 0.3) {
      stopped = true;
      try {
        if (!src) return;
        const ctx = audioCtx(), t = ctx.currentTime, s = src, gg = g;
        gg.gain.cancelScheduledValues(t);
        gg.gain.setValueAtTime(gg.gain.value, t);
        gg.gain.linearRampToValueAtTime(0, t + fadeSec);
        s.stop(t + fadeSec + 0.05);
        s.onended = () => { try { s.disconnect(); gg.disconnect(); } catch {} };
        src = null;
      } catch {}
    },
    get playing() { return !!src; },
  };
}
