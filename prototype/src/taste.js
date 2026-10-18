// The taste moment (after Ratatouille's strawberry-and-cheese scene): the world
// goes dark, the duck closes their eyes, and each flavour appears as its own
// shape, colour and note. Flavours that belong together braid into a spark.
// Too many at once turn to grey noise and fizzle out: no spark.
// The shapes are a language the player learns across the whole game, so a
// flavour always looks and sounds the same, wherever it's tasted.
//
// Four kinds of taste, the spine of the story:
//   perfect  Grandpa Zhao's bowl: every flavour in balance round a warm heart. WOAH.
//   spark    good food with soul (Uncle Ji, Rose, Auntie Fu, Little Chilli)
//   pop      our own early bowls: correct, small, lopsided… a tiny pop, no spark
//   bomb     the competitor: a neon explosion, tastes great, then empty. No heart.
//   missing  almost Grandpa's bowl: balance, and an empty place where the heart goes
// tasteMoment({ title, desc, flavours: [{ k, word }], mode, lesson })

import * as THREE from 'three';
import { G } from './core.js';
import { W } from './world.js';
import { player } from './player.js';
import { note, sfx } from './audio.js';

// one flavour = one shape, one colour, one note (C major pentatonic, so any mix of
// real flavours sounds kind together; only the clash breaks out of the scale)
export const FLAVOURS = {
  savoury: { color: '#f5b942', shape: 'rings', freq: 130.8, wave: 'sine', name: 'savoury' },     // deep slow rings: broth, time
  rich: { color: '#ffcf70', shape: 'bokeh', freq: 196.0, wave: 'sine', name: 'rich' },           // soft glowing blobs: fat, oil
  fresh: { color: '#7ed957', shape: 'curls', freq: 329.6, wave: 'triangle', name: 'fresh' },     // green spirals: chives, herbs
  sweet: { color: '#ff9ec7', shape: 'bubbles', freq: 392.0, wave: 'triangle', name: 'sweet' },   // pink rising bubbles
  floral: { color: '#f7b2e6', shape: 'petals', freq: 440.0, wave: 'sine', name: 'floral' },      // drifting petals: rose
  spicy: { color: '#ff5a36', shape: 'flames', freq: 587.3, wave: 'sawtooth', name: 'spicy' },    // red ribbons that dance up
  smoky: { color: '#b48ad8', shape: 'wisps', freq: 98.0, wave: 'sine', name: 'smoky' },          // violet wisps: ham, char
  sour: { color: '#fff07a', shape: 'stars', freq: 784.0, wave: 'triangle', name: 'sour' },       // lemon sparks
  salty: { color: '#cfe8ff', shape: 'stars', freq: 523.3, wave: 'sine', name: 'salty' },
};

let el = null, ctx = null, parts = [], emitters = [], clock = 0, face = { x: 0, y: 0, r: 120 };
const grey = { v: 0 }, shake = { v: 0 }, flash = { v: 0 }, veil = { v: 1 };

function ensure() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'taste hidden';
  el.innerHTML = `<canvas></canvas><div class="taste-title"><b></b><span></span></div><div class="taste-words"></div>
    <div class="taste-note"><small>Soul note</small><p></p><em>tap to continue</em></div>`;
  document.body.appendChild(el);
  ctx = el.querySelector('canvas').getContext('2d');
}

function resize() {
  const c = ctx.canvas, d = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * d; c.height = innerHeight * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}

// ---------- the duck's face, in close-up ----------
const v3 = new THREE.Vector3(), dir = new THREE.Vector3();
function headWorld() { return player.char.head.getWorldPosition(v3.set(0, 0, 0)).clone(); }
function frameFace() {
  const h = headWorld();
  player.char.root.getWorldDirection(dir); dir.y = 0; dir.normalize();
  // a medium close-up, like Remy: head and shoulders, centred, room all round
  const pos = h.clone().addScaledVector(dir, 5.4).add(new THREE.Vector3(0, 0.35, 0));
  player.camShot = { pos: { x: pos.x, y: pos.y, z: pos.z }, look: { x: h.x, y: h.y + 0.05, z: h.z }, speed: 2.4 };
  player.fovShot = 30;
}
function trackFace() {
  const p = headWorld().project(W.camera);
  face.x = (p.x + 1) / 2 * innerWidth;
  face.y = (1 - p.y) / 2 * innerHeight;
  face.r = Math.min(innerWidth, innerHeight) * 0.26;
}

// ---------- particles ----------
// each flavour gets its own place beside the duck: left, right, then the
// corners (never straight up, where the title is)
const PLACES = [Math.PI, 0, Math.PI * 0.78, Math.PI * 0.22, Math.PI * 1.2, -Math.PI * 0.2, Math.PI * 0.5];
function home(i, n) {
  return { a: PLACES[i % PLACES.length], R: face.r * 1.55, all: n === 1 };
}

function spawn(f, slot, o = {}) {
  const F = FLAVOURS[f.k];
  const a = slot.all ? Math.random() * Math.PI * 2 : slot.a + clock * (o.spin || 0) + (Math.random() - 0.5) * (o.even ? 0.35 : 0.7) + (o.spread ? (Math.random() - 0.5) * 6 : 0);
  const R = slot.R * (0.75 + Math.random() * 0.5);
  parts.push({
    shape: F.shape, color: F.color, a, R, x: 0, y: 0, born: clock, life: (o.life || 2.6) * (0.7 + Math.random() * 0.6),
    s: (o.even ? 1 : 0.6 + Math.random() * 0.8) * (o.big || 1), ph: Math.random() * 6, vr: o.spin ?? (Math.random() - 0.5) * 0.25, vR: o.even ? 6 : 8 + Math.random() * 18,
    orbit: 0, dim: o.dim,
  });
}

function mix(hex, g) {                          // fade a colour to grey (the clash)
  if (g <= 0) return hex;
  const n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, m = (r + gg + b) / 3 * 0.7;
  const L = (x) => Math.round(x + (m - x) * g);
  return `rgb(${L(r)},${L(gg)},${L(b)})`;
}

function draw(dt) {
  const w = innerWidth, h = innerHeight;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  // the dark, with a soft window on the duck's face
  const R = face.r;
  const g = ctx.createRadialGradient(face.x, face.y, R * 0.45, face.x, face.y, R * 1.5);
  g.addColorStop(0, 'rgba(8,6,12,0)'); g.addColorStop(0.55, `rgba(8,6,12,${0.88 * veil.v})`); g.addColorStop(1, `rgba(8,6,12,${veil.v})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (flash.v > 0) { ctx.fillStyle = `rgba(255,255,255,${flash.v})`; ctx.fillRect(0, 0, w, h); flash.v = Math.max(0, flash.v - dt * 3); }
  ctx.globalCompositeOperation = 'lighter';
  const jx = () => (Math.random() - 0.5) * shake.v * 14;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], age = clock - p.born, k = age / p.life;
    if (k >= 1) { parts.splice(i, 1); continue; }
    p.a += p.vr * dt + p.orbit * dt * 1.6;
    p.R += p.vR * dt * (1 - p.orbit) * (p.decel ? 1 - k : 1) - p.orbit * dt * 22;
    p.x = face.x + Math.cos(p.a) * p.R + jx();
    p.y = face.y + Math.sin(p.a) * p.R * 0.85 + jx();
    const al = Math.sin(Math.min(1, k * 1.0) * Math.PI) * (1 - grey.v * 0.5) * (p.dim ?? 1);
    const col = mix(p.color, grey.v);
    ctx.globalAlpha = Math.max(0, al);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = p.hard ? 0 : 18;
    ctx.lineCap = 'round';
    SHAPES[p.shape](p, age, k);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

const SHAPES = {
  rings(p, age) { ctx.lineWidth = 4 * p.s; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + age * 18 * p.s, 0, Math.PI * 2); ctx.stroke(); },
  bokeh(p) {
    const r = 22 * p.s, gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    gr.addColorStop(0, ctx.fillStyle); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  },
  curls(p, age, k) {
    ctx.lineWidth = 4 * p.s; ctx.beginPath();
    const n = Math.min(1, k * 2.2) * 3.2 * Math.PI;
    for (let a = 0; a <= n; a += 0.15) { const r = a * 4.2 * p.s; const x = p.x + Math.cos(a + p.ph) * r, y = p.y + Math.sin(a + p.ph) * r; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  },
  bubbles(p, age) { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - age * 30, 9 * p.s, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha *= 0.35; ctx.fill(); },
  petals(p, age) {
    ctx.save(); ctx.translate(p.x + Math.sin(age * 2 + p.ph) * 12, p.y + age * 18); ctx.rotate(age * 1.5 + p.ph);
    ctx.beginPath(); ctx.ellipse(0, 0, 13 * p.s, 6 * p.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },
  flames(p, age) {
    ctx.lineWidth = 5 * p.s; ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const y = p.y - i * 7 * p.s - age * 20, x = p.x + Math.sin(i * 0.8 + age * 9 + p.ph) * 9 * p.s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  },
  wisps(p, age) {
    ctx.lineWidth = 3 * p.s; ctx.beginPath(); ctx.moveTo(p.x - 30, p.y);
    ctx.bezierCurveTo(p.x - 10, p.y - 25 + Math.sin(age * 2) * 10, p.x + 10, p.y + 25, p.x + 34, p.y - 6 - age * 8); ctx.stroke();
  },
  stars(p, age) {
    const r = 7 * p.s * (1 + Math.sin(age * 12 + p.ph) * 0.3);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + p.ph; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * r * 2, p.y + Math.sin(a) * r * 2); }
    ctx.stroke();
  },
  noise(p) { ctx.fillRect(p.x, p.y, 6 * p.s, 3 * p.s); },
  spark(p, age) {                              // the golden burst when flavours become one
    const r = 3 + age * 140 * p.s;
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(face.x + Math.cos(p.a) * r * 0.6, face.y + Math.sin(p.a) * r * 0.6);
    ctx.lineTo(face.x + Math.cos(p.a) * r, face.y + Math.sin(p.a) * r); ctx.stroke();
  },
  heart(p, age) {                              // what Grandpa put in that isn't an ingredient
    const k = 1 + Math.sin(age * 5) * 0.08, z = 22 * p.s * k;
    ctx.beginPath(); ctx.moveTo(p.x, p.y + z * 0.9);
    ctx.bezierCurveTo(p.x - z * 1.6, p.y - z * 0.2, p.x - z * 0.7, p.y - z * 1.3, p.x, p.y - z * 0.45);
    ctx.bezierCurveTo(p.x + z * 0.7, p.y - z * 1.3, p.x + z * 1.6, p.y - z * 0.2, p.x, p.y + z * 0.9);
    ctx.fill();
  },
  bloom(p, age) {                              // warm light filling the dark
    const r = 40 + age * Math.max(innerWidth, innerHeight) * 0.7, gr = ctx.createRadialGradient(face.x, face.y, 0, face.x, face.y, r);
    gr.addColorStop(0, 'rgba(255,214,140,0.55)'); gr.addColorStop(0.6, 'rgba(255,170,90,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, innerWidth, innerHeight);
  },
  shard(p, age) {                              // the competitor's neon: hard, fast, geometric
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(age * 9 * p.vr + p.ph);
    const z = 9 * p.s; ctx.beginPath();
    if (p.ph > 3) { ctx.rect(-z, -z, z * 2, z * 2); } else { ctx.moveTo(0, -z * 1.4); ctx.lineTo(z * 1.2, z); ctx.lineTo(-z * 1.2, z); ctx.closePath(); }
    ctx.fill(); ctx.restore();
  },
  hollow(p, age) {                             // where the heart should be: nothing, cold
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 24 + age * 3, 0, Math.PI * 2); ctx.stroke();
  },
  ghost(p, age) {                              // the missing note: an empty, dashed place
    ctx.setLineDash([6, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(age * 2) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '700 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', p.x, p.y);
  },
};

// ---------- timing (wall clock, so it plays the same on any device) ----------
let raf = 0, last = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
  clock += dt;
  for (const e of emitters) { e.acc += dt * e.rate; while (e.acc >= 1) { e.acc--; spawn(e.f, e.slot, e.o); } }
  trackFace();
  draw(dt);
  raf = requestAnimationFrame(loop);
}
const sleep = sec => new Promise(res => { const end = clock + sec; const t = () => (G.skip || clock >= end ? res() : setTimeout(t, 30)); t(); });

function word(text, i, n, color, slot) {
  const s = slot || home(i, n);
  const d = document.createElement('div');
  d.className = 'taste-word';
  d.textContent = text;
  d.style.color = color;
  const x = face.x + Math.cos(s.a) * s.R * 1.25, y = face.y + Math.sin(s.a) * s.R * 1.05 + (s.all ? face.r * 1.3 : 0);
  d.style.left = `${Math.max(70, Math.min(innerWidth - 70, x))}px`; d.style.top = `${Math.max(90, Math.min(innerHeight - 140, y))}px`;
  el.querySelector('.taste-words').appendChild(d);
}

function chord(freqs, dur = 2.6, vol = 0.09) { freqs.forEach((f, i) => { note(f, dur, 'sine', vol, i * 0.06); note(f * 2, dur * 0.8, 'triangle', vol * 0.35, i * 0.06 + 0.02); }); }

/** Play a taste moment. Resolves when the player taps on through the soul note. */
export async function tasteMoment({ title = '', desc = '', flavours = [], mode = 'spark', lesson = '', heart = '' } = {}) {
  if (G.skip) { save(title, lesson); return; }
  ensure(); resize();
  if (mode === 'echo') return echo(flavours);
  G.busy++;
  const prev = { shot: player.camShot, fov: player.fovShot, face: null };
  parts = []; emitters = []; clock = 0; grey.v = 0; shake.v = 0; flash.v = 0; veil.v = 1;
  el.querySelector('.taste-title b').textContent = title;
  el.querySelector('.taste-title span').textContent = desc;
  el.querySelector('.taste-words').innerHTML = '';
  el.querySelector('.taste-note').classList.remove('on');
  frameFace();
  trackFace();
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('on'));
  last = performance.now(); raf = requestAnimationFrame(loop);
  sfx('pop');
  await sleep(0.9);
  player.char.setFace('happy');                    // eyes closed: listening
  await sleep(0.5);

  const n = flavours.length;
  const slots = flavours.map((_, i) => home(i, n));
  const add = (shape, color, o = {}) => parts.push({ shape, color, a: 0, R: 0, born: clock, life: 2, s: 1, ph: Math.random() * 6, vr: 0, vR: 0, orbit: 0, ...o });
  const HEART = Math.PI / 2;                       // the heart's place: just under the chin
  if (mode === 'perfect') {
    // a wheel in balance: every flavour the same size, evenly round the duck,
    // arriving on the beat of a rising arpeggio, turning together
    const scale = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0];
    const ring = flavours.map((_, i) => ({ a: Math.PI + i * (Math.PI * 2 / n), R: face.r * 1.6 }));
    for (const [i, f] of flavours.entries()) {
      emitters.push({ f, slot: ring[i], rate: 5, acc: 0, o: { even: true, spin: 0.35, big: 1.15 } });
      note(FLAVOURS[f.k].freq, 3.2, 'sine', 0.11); note(scale[i % scale.length], 1.2, 'triangle', 0.06);
      word(f.word, i, n, FLAVOURS[f.k].color, ring[i]);
      await sleep(1.0);
    }
    // …and in the middle of it all, something warm that isn't an ingredient
    add('heart', '#ff8f7a', { a: HEART, R: face.r * 1.05, life: 6, s: 1.2 });
    if (heart) word(heart, 0, 1, '#ffb3a3', { a: HEART, R: face.r * 1.25 });
    chord([261.6, 329.6, 392.0], 3.5, 0.07);
    await sleep(1.3);
    // WOAH
    player.char.setFace('shock');
    flash.v = 0.5; shake.v = 0.15;
    add('bloom', '#ffd28c', { life: 2.6 });
    const all = flavours.map(f => FLAVOURS[f.k].color).concat(['#ffe08a', '#fff6dc']);
    for (let i = 0; i < 140; i++) add('spark', all[i % all.length], { a: Math.random() * 6.3, life: 1.4 + Math.random() * 1.2, s: 0.7 + Math.random() * 0.9 });
    [[261.6, 329.6, 392.0], [349.2, 440.0, 523.3], [392.0, 493.9, 587.3], [523.3, 659.3, 784.0]].forEach((c, i) => setTimeout(() => chord(c, 1.6, 0.06), i * 380));
    sfx('reveal');
    await sleep(1.1);
    shake.v = 0;
    player.char.setFace('happy');
    await sleep(2.4);
    emitters = [];
    await sleep(0.8);
  } else if (mode === 'pop') {
    // our own bowl: the right things, small and lopsided, out of step… pop.
    const side = flavours.map((_, i) => ({ a: Math.PI * 0.9 + i * 0.3, R: face.r * 1.4 }));
    for (const [i, f] of flavours.entries()) {
      emitters.push({ f, slot: side[i], rate: 1.6, acc: 0, o: { big: 0.45, dim: 0.55, life: 1.6 } });
      note(FLAVOURS[f.k].freq * 0.97, 0.5, 'sine', 0.06);
      word(f.word, i, n, FLAVOURS[f.k].color, side[i]);
      await sleep(0.55);
    }
    await sleep(0.9);
    emitters = [];
    for (let i = 0; i < 8; i++) add('stars', '#a8a29a', { a: Math.PI * 0.95 + (Math.random() - 0.5), R: face.r * 1.3, life: 0.6, s: 0.5, dim: 0.6 });
    sfx('pop'); note(330, 0.12, 'sine', 0.08);
    player.char.setFace('normal');
    await sleep(1.6);
  } else if (mode === 'bomb' || mode === 'clash') {
    // the competitor: everything maxed, a neon firework of flavour. It tastes GREAT…
    const NEON = ['#00f0ff', '#ff2bd6', '#c6ff00', '#ffffff', '#7a5cff'];
    player.char.setFace('shock');
    flavours.forEach((f, i) => word(f.word.toUpperCase() + '!', i, n, NEON[i % NEON.length]));
    for (let wave = 0; wave < 3; wave++) {
      flash.v = 0.75 - wave * 0.2; shake.v = 0.5;
      for (let i = 0; i < 70; i++) add('shard', NEON[i % NEON.length], { a: Math.random() * 6.3, R: 10, vR: 320 + Math.random() * 380, decel: true, hard: true, vr: (Math.random() - 0.5) * 2, life: 1.1 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.9 });
      note(55, 0.5, 'sine', 0.25); note(110, 0.25, 'square', 0.06);
      [0, 4, 7, 12, 16, 19].forEach((st, j) => note(392 * 2 ** ((st + wave * 2) / 12), 0.09, 'sawtooth', 0.045, j * 0.05));
      if (wave === 1) player.char.setFace('happy');
      await sleep(0.65);
    }
    shake.v = 0;
    await sleep(1.0);
    // …and then nothing. No heart. Just the place where one should be.
    el.querySelector('.taste-words').innerHTML = '';
    add('hollow', '#93a3bb', { a: HEART, R: face.r * 1.05, life: 3.2, hard: true });
    note(196, 1.6, 'sine', 0.07);
    player.char.setFace('blank');
    await sleep(2.2);
  } else {
    // one at a time: each flavour gets room to sing
    for (const [i, f] of flavours.entries()) {
      const F = FLAVOURS[f.k];
      emitters.push({ f, slot: slots[i], rate: n === 1 ? 7 : 5, acc: 0, o: { big: n === 1 ? 1.5 : 1 } });
      note(F.freq, 2.4, F.wave === 'sawtooth' ? 'triangle' : F.wave, 0.13);
      word(f.word, i, n, F.color);
      await sleep(n === 1 ? 2.2 : 1.4);
    }
    if (mode === 'missing') {
      parts.push({ shape: 'ghost', color: '#d8d0ff', a: HEART, R: face.r * 1.05, born: clock, life: 4, s: 1, ph: 0, vr: 0, vR: 0, orbit: 0 });
      note(220, 0.6, 'sine', 0.05);
      await sleep(1.2);
    }
    // they braid together around the duck… and spark
    for (const p of parts) if (p.shape !== 'ghost') p.orbit = 1, p.life += 1.5;
    chord(flavours.map(f => FLAVOURS[f.k].freq).concat(mode === 'missing' ? [] : [261.6]));
    await sleep(1.0);
    const sparks = mode === 'missing' ? 24 : 50;
    for (let i = 0; i < sparks; i++) add('spark', i % 3 ? '#ffe08a' : '#fff6dc', { a: Math.random() * 6.3, life: 1.2 + Math.random(), s: 0.6 + Math.random() * 0.6 });
    sfx('reveal');
    player.char.setFace('happy');
    await sleep(1.6);
    emitters = [];
    await sleep(0.6);
  }

  // the lesson, in the duck's notebook
  const box = el.querySelector('.taste-note');
  box.querySelector('p').textContent = lesson;
  box.classList.add('on');
  save(title, lesson);
  await Promise.race([
    new Promise(res => el.addEventListener('pointerdown', res, { once: true })),
    sleep(6),
  ]);
  el.classList.remove('on');
  await sleep(0.4);
  cancelAnimationFrame(raf);
  el.classList.add('hidden');
  player.camShot = prev.shot; player.fovShot = prev.fov;
  player.char.setFace('normal');
  G.busy--;
}

// A memory of a taste, seen from where you are now (no close-up, no words):
// the wheel and the heart flicker round you for a moment, faint, then gone.
async function echo(flavours) {
  if (G.skip) return;
  parts = []; emitters = []; clock = 0; flash.v = 0; grey.v = 0; shake.v = 0; veil.v = 0.22;
  el.querySelector('.taste-title b').textContent = '';
  el.querySelector('.taste-title span').textContent = '';
  el.querySelector('.taste-words').innerHTML = '';
  el.querySelector('.taste-note').classList.remove('on');
  trackFace();
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('on'));
  last = performance.now(); raf = requestAnimationFrame(loop);
  const n = flavours.length;
  flavours.forEach((f, i) => emitters.push({ f, slot: { a: Math.PI + i * (Math.PI * 2 / n), R: face.r * 1.4 }, rate: 2.5, acc: 0, o: { even: true, spin: 0.35, dim: 0.55 } }));
  parts.push({ shape: 'heart', color: '#ff8f7a', a: Math.PI / 2, R: face.r * 0.95, born: clock, life: 2.8, s: 0.8, ph: 0, vr: 0, vR: 0, orbit: 0, dim: 0.7 });
  [261.6, 329.6, 392.0].forEach((f, i) => note(f, 2.2, 'sine', 0.05, i * 0.25));
  await sleep(2.0);
  emitters = [];
  el.classList.remove('on');
  await sleep(0.8);
  cancelAnimationFrame(raf);
  el.classList.add('hidden');
}

function save(title, lesson) {
  G.soul = G.soul || [];
  if (lesson && !G.soul.some(s => s.lesson === lesson)) G.soul.push({ title, lesson });
}

// dev hook: #taste plays all three kinds
window.__taste = tasteMoment;
