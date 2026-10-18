// Synthesised audio: "animalese"-style voices with Mandarin tone contours,
// a handful of sound effects and a soft pentatonic background loop.

let ctx = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
let muted = false;

// tone: flat (1st), up (2nd), dip (3rd), down (4th)
export const VOICES = {
  player:  { base: 250, tone: 'flat', wave: 'triangle' },
  grandma: { base: 430, tone: 'dip',  wave: 'sine' },
  chilli:  { base: 360, tone: 'down', wave: 'square' },
  wang:    { base: 165, tone: 'up',   wave: 'sawtooth' },
  spud:    { base: 190, tone: 'flat', wave: 'triangle' },
  fu:      { base: 330, tone: 'down', wave: 'square' },
  ji:      { base: 210, tone: 'dip',  wave: 'triangle' },
  rose:    { base: 470, tone: 'up',   wave: 'sine' },
  li:      { base: 180, tone: 'dip',  wave: 'sine' },
  crowd:   { base: 300, tone: 'flat', wave: 'triangle' },
  lan:     { base: 400, tone: 'up',   wave: 'square' },
  auntie:  { base: 390, tone: 'down', wave: 'square' },
  ai:      { base: 520, tone: 'flat', wave: 'sine' },
};

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.32;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.18;
  musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.32;
  return muted;
}

const SILENT = /[\s.,!?…—\-'"“”()（），。！？、：:;；~*0-9]/;

// Mood shifts the voice like Animal Crossing: up when happy, down when sad.
const MOOD_SEMITONES = { happy: 2, smug: 1, shock: 3, sad: -2, cry: -2, angry: -1 };

export function blip(ch, voiceId, mood) {
  if (!ctx) return;
  const v = VOICES[voiceId];
  if (!v || SILENT.test(ch)) return;
  const t = ctx.currentTime;
  const code = ch.codePointAt(0);
  const han = code > 0x2e80;
  const dur = han ? 0.09 : 0.06;
  const step = [0, 2, 4, 7, 9][code % 5];
  const shift = (MOOD_SEMITONES[mood] || 0) + (Math.random() - 0.5) * 2;   // ±1 semitone of life
  const f0 = v.base * Math.pow(2, (step + shift) / 12);
  const contour = { flat: [1, 1, 1], up: [0.88, 1, 1.22], down: [1.25, 1.05, 0.82], dip: [1, 0.8, 1.08] }[v.tone];

  const osc = ctx.createOscillator();
  osc.type = v.wave;
  osc.frequency.setValueAtTime(f0 * contour[0], t);
  osc.frequency.linearRampToValueAtTime(f0 * contour[1], t + dur * 0.5);
  osc.frequency.linearRampToValueAtTime(f0 * contour[2], t + dur);

  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 700 + (code % 7) * 220;
  filt.Q.value = 1.4;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);

  osc.connect(filt); filt.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + dur + 0.02);
}

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

// --- soft background music: a pentatonic random walk ---
const SCALES = {
  day:   [392, 440, 523, 587, 659, 784, 880],
  night: [262, 294, 349, 392, 440, 523, 587],
  ride:  [440, 494, 587, 659, 740, 880, 988],
};
let musicTimer = null;
let musicMood = null;

export function setMusic(mood) {
  musicMood = mood;
  if (!ctx) return;
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (!mood) return;
  let i = 3;
  const speed = mood === 'ride' ? 230 : mood === 'night' ? 520 : 380;
  musicTimer = setInterval(() => {
    if (!ctx || muted) return;
    const scale = SCALES[musicMood];
    i = Math.max(0, Math.min(scale.length - 1, i + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
    if (Math.random() < 0.25) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = scale[i];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.65);
  }, speed);
}

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
