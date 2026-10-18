// Synthesised audio: "animalese"-style voices with Mandarin tone contours,
// a handful of sound effects and a soft pentatonic background loop.

import { createMusic } from './music.js';

let ctx = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
let muted = false;

// Voices, Animal Crossing style ("Animalese"): every letter becomes a tiny,
// sped-up syllable whose vowel colour matches the letter, pitched per
// character. Base pitch follows AC's personality types (peppy highest,
// cranky lowest); tone gives Chinese characters a Mandarin contour.
// tone: flat (1st), up (2nd), dip (3rd), down (4th)
export const VOICES = {
  player:  { base: 430, tone: 'flat' },              // our heroine: normal, bright
  grandma: { base: 360, tone: 'dip', slow: 1.15 },   // older, a touch slower
  chilli:  { base: 470, tone: 'down', rough: 1 },    // loud, punchy
  wang:    { base: 230, tone: 'up', rough: 1 },      // smug
  spud:    { base: 175, tone: 'flat', slow: 1.1 },   // cranky
  fu:      { base: 390, tone: 'down' },
  ji:      { base: 195, tone: 'dip', slow: 1.1 },
  rose:    { base: 560, tone: 'up' },                // peppy
  li:      { base: 210, tone: 'dip', slow: 1.2 },    // lazy old man
  crowd:   { base: 320, tone: 'flat' },
  lan:     { base: 520, tone: 'up' },
  auntie:  { base: 460, tone: 'down' },
  ai:      { base: 600, tone: 'flat', robot: 1 },    // the chatbot: square, flat, uncanny
};

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}   // iPhone: ignore the silent switch like a music app
  const wake = () => { if (ctx.state !== 'running') ctx.resume(); };
  for (const e of ['touchend', 'pointerdown', 'keydown', 'visibilitychange']) addEventListener(e, wake, { passive: true });
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.62;
  musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (musicMood) setMusic(musicMood);               // a scene asked for music before the first tap
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// ---------- Animalese ----------
// vowel formants (F1, F2), scaled up ×1.2 for a small, cute voice
const FORMANT = { a: [850, 1600], e: [600, 2300], i: [350, 2700], o: [550, 1000], u: [380, 900], y: [350, 2400], n: [500, 1500] };
const VOWEL = /[aeiouy]/;
const MOOD = { happy: 1.1, smug: 1.05, shock: 1.2, sad: 0.9, cry: 0.88, angry: 0.92 };
let voiceFree = 0;                                   // when the voice is next free to speak

function syllable(t, f0, vowel, dur, v, opts) {
  const [f1, f2] = FORMANT[vowel] || FORMANT.n;
  const src = ctx.createOscillator();
  src.type = v.robot ? 'square' : 'sawtooth';
  src.frequency.setValueAtTime(f0 * 0.92, t);                    // a little upward chirp into each syllable
  src.frequency.exponentialRampToValueAtTime(f0 * (opts.bend || 1), t + Math.min(0.02, dur * 0.3));
  if (opts.contour) src.frequency.linearRampToValueAtTime(f0 * opts.contour, t + dur);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(opts.gain, t + 0.006);
  out.gain.setValueAtTime(opts.gain, t + dur * 0.55);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = v.rough ? 4200 : 3400; lp.Q.value = 0.7;
  for (const [fq, q, g] of [[f1 * 1.2, 7, 1], [f2 * 1.2, 9, 0.6]]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
    const bg = ctx.createGain(); bg.gain.value = g * 3.2;
    src.connect(bp); bp.connect(bg); bg.connect(lp);
  }
  lp.connect(out); out.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}
function consonant(t, ch, gain) {
  const fric = /[sfzxcjh]/.test(ch), plos = /[ptkbdgq]/.test(ch);
  if (!fric && !plos) return 0;
  const len = fric ? 0.022 : 0.006;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = fric ? 4200 : 1800;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain * (fric ? 0.5 : 0.8), t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(hp); hp.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + len + 0.01);
  return fric ? len * 0.6 : 0;
}

/**
 * Speak letter i of `chars` (called as the typewriter reveals it). The voice
 * runs on its own clock at ~14 syllables a second; if the text runs ahead,
 * letters are skipped (AC does the same), so it never turns into a buzz.
 */
export function speak(chars, i, voiceId, mood) {
  if (!ctx || muted) return;
  const v = VOICES[voiceId] || VOICES.crowd;
  const ch = (chars[i] || '').toLowerCase();
  const now = ctx.currentTime;
  if (voiceFree < now) voiceFree = now;
  // pauses: spaces and punctuation are silence of different lengths (never
  // stacking up more than a breath ahead of the text)
  const pause = /\s/.test(ch) ? 0.03 : /[,，、;；:：]/.test(ch) ? 0.12 : /[.。…!！?？]/.test(ch) ? 0.22 : 0;
  if (pause) { voiceFree = Math.min(voiceFree + pause, now + 0.3); return; }
  if (/[\d"“”'‘’()（）\-—~*]/.test(ch)) return;
  if (voiceFree - now > 0.1) return;                  // running behind: skip this letter
  const code = ch.codePointAt(0), han = code > 0x2e80;
  const dur = (han ? 0.095 : 0.068) * (v.slow || 1) * (0.9 + Math.random() * 0.2);
  // which vowel colours this letter: its own, or the next vowel in the word
  let vowel = VOWEL.test(ch) ? ch : null;
  for (let k = i + 1; !vowel && k < chars.length && k < i + 4; k++) { const c = (chars[k] || '').toLowerCase(); if (/[^a-z]/.test(c)) break; if (VOWEL.test(c)) vowel = c; }
  if (han) vowel = 'aeiou'[code % 5];
  vowel = vowel || 'n';
  // phrase shape: look ahead to the end of the sentence
  let end = null, dist = 0;
  for (let k = i + 1; k < chars.length && k < i + 6; k++) { const c = chars[k]; if (/[.。!！?？…]/.test(c)) { end = c; break; } if (/\S/.test(c)) dist++; }
  let f0 = v.base * (MOOD[mood] || 1) * (1 + (Math.random() - 0.5) * 0.12);
  let gain = 0.22, contour = null;
  if (end && /[?？]/.test(end) && dist < 2) f0 *= 1.25;                      // questions rise
  else if (end && /[.。…]/.test(end) && dist < 3) f0 *= 0.86;                // statements settle
  else if (end && /[!！]/.test(end) && dist < 4) { f0 *= 1.15; gain = 0.3; }  // exclamations pop
  if (han) contour = { flat: 1, up: 1.22, down: 0.8, dip: 0.85 }[v.tone];
  const t = voiceFree + consonant(voiceFree, ch, gain);
  syllable(t, f0, vowel, dur, v, { gain, contour });
  voiceFree = t + dur;
}

/** Back-compat: a single blip with no context. */
export function blip(ch, voiceId, mood) { speak([ch], 0, voiceId, mood); }

function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, freq, q = 1, vol = 0.5, delay = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'quack':
      tone('sawtooth', 620, 360, 0.12, 0.35); tone('sawtooth', 600, 340, 0.12, 0.35, 0.16); break;
    case 'ding':
      tone('sine', 1320, 1320, 0.5, 0.4); tone('sine', 1980, 1980, 0.4, 0.2, 0.05); break;
    case 'coin':
      tone('square', 990, 990, 0.08, 0.2); tone('square', 1320, 1320, 0.25, 0.2, 0.08); break;
    case 'fail':
      tone('sawtooth', 330, 300, 0.3, 0.3); tone('sawtooth', 300, 270, 0.3, 0.3, 0.3); tone('sawtooth', 270, 140, 0.7, 0.3, 0.6); break;
    case 'pop':
      tone('sine', 420, 880, 0.08, 0.4); break;
    case 'whack':
      noise(0.15, 900, 0.8, 0.8); tone('square', 160, 60, 0.12, 0.3); break;
    case 'splash':
      noise(0.4, 2400, 0.6, 0.5); break;
    case 'gong':
      tone('sine', 110, 104, 2.5, 0.6); tone('sine', 247, 240, 2, 0.25); tone('sine', 389, 380, 1.6, 0.15); break;
    case 'reveal':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.5, 0.3, i * 0.09));
      noise(1.4, 6000, 0.5, 0.15, 0.4); break;
    case 'type':
      noise(0.03, 3000, 1, 0.25); break;
    case 'send':
      tone('sine', 600, 1200, 0.12, 0.3); break;
    case 'cheer':
      for (let i = 0; i < 6; i++) noise(0.5, 900 + i * 300, 2, 0.12, i * 0.05); break;
    case 'bump':
      tone('sine', 140, 70, 0.15, 0.6); break;
    case 'beep':
      tone('square', 880, 880, 0.1, 0.2); break;
    case 'scratch':                                   // record scratch: the comedy stop
      tone('sawtooth', 1400, 160, 0.22, 0.25); noise(0.22, 1800, 0.7, 0.4); break;
    case 'sizzle':
      noise(0.7, 5200, 0.6, 0.12); noise(0.4, 2600, 1.2, 0.06, 0.1); break;
    case 'slam':
      tone('square', 90, 40, 0.25, 0.5); noise(0.18, 400, 0.8, 0.7); break;
    case 'whoosh':
      noise(0.45, 900, 0.5, 0.35); tone('sine', 300, 1200, 0.4, 0.08); break;
    case 'meow':
      tone('triangle', 620, 940, 0.16, 0.18); tone('triangle', 940, 560, 0.3, 0.16, 0.15); break;
    case 'purr':
      for (let i = 0; i < 8; i++) noise(0.09, 120, 2, 0.35, i * 0.11); break;
    case 'chirp':
      tone('sine', 2600, 3400, 0.06, 0.08); tone('sine', 2900, 3700, 0.06, 0.07, 0.09); break;
    case 'flutter':
      for (let i = 0; i < 7; i++) noise(0.05, 1300 + i * 120, 1.5, 0.22, i * 0.045); break;
    case 'bell':
      tone('sine', 2093, 2093, 0.5, 0.2); tone('sine', 2637, 2637, 0.45, 0.12); tone('sine', 2093, 2093, 0.4, 0.15, 0.16); break;
    case 'gasp':
      tone('triangle', 500, 900, 0.25, 0.35); break;
  }
}

// --- music: composed pieces, see music.js ---
let music = null, musicMood = null;
export function setMusic(mood) {
  musicMood = mood;
  if (!ctx) return;
  music ||= createMusic(ctx, musicGain, noiseBuf);
  music.play(mood);
}
export function musicSting(name) { if (ctx && music) music.sting(name); }

/** A single pitched note (stir laps, hold hums, alarms). */
export function note(freq, dur = 0.15, wave = 'triangle', vol = 0.25, delay = 0) {
  if (!ctx) return;
  tone(wave, freq, freq, dur, vol, delay);
}

// --- the e-bike's electric whine: pitch and level follow speed (0..1) ---
let engine = null;
export function setEngine(v) {
  if (!ctx) return;
  if (!engine) {
    const a = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    a.type = 'sawtooth'; b.type = 'sine';
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.value = 0;
    a.connect(f); b.connect(f); f.connect(g); g.connect(master);
    a.start(); b.start();
    engine = { a, b, g };
  }
  const t = ctx.currentTime;
  engine.a.frequency.setTargetAtTime(90 + v * 260, t, 0.08);
  engine.b.frequency.setTargetAtTime(180 + v * 520, t, 0.08);
  engine.g.gain.setTargetAtTime(v > 0.02 ? 0.02 + v * 0.05 : 0, t, 0.1);
}

// --- rain on the window (a looped, filtered noise bed) ---
let rainNode = null;
export function setRain(on) {
  if (!ctx) return;
  if (on && !rainNode) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(0.09, ctx.currentTime, 0.4);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    rainNode = { src, g };
  } else if (!on && rainNode) {
    const r = rainNode; rainNode = null;
    r.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => r.src.stop(), 800);
  }
}

/** Dev/test: a MediaStream of everything we play (for recording previews). */
export function tapStream() {
  if (!ctx) return null;
  const d = ctx.createMediaStreamDestination();
  master.connect(d);
  return d.stream;
}
