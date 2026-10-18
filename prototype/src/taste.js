// The taste moment (after Ratatouille's strawberry-and-cheese scene): the world
// goes dark, the duck closes their eyes, and each flavour appears as its own
// shape, colour and note. Flavours that belong together braid into a spark.
// Too many at once turn to grey noise and fizzle out: no spark.
// The shapes are a language the player learns across the whole game, so a
// flavour always looks and sounds the same, wherever it's tasted.
//
// tasteMoment({ title, desc, flavours: [{ k, word }], mode: 'spark'|'clash'|'missing', lesson })

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
const grey = { v: 0 }, shake = { v: 0 };

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
  const a = slot.all ? Math.random() * Math.PI * 2 : slot.a + (Math.random() - 0.5) * 0.7 + (o.spread ? (Math.random() - 0.5) * 6 : 0);
  const R = slot.R * (0.75 + Math.random() * 0.5);
  parts.push({
    shape: F.shape, color: F.color, a, R, x: 0, y: 0, born: clock, life: (o.life || 2.6) * (0.7 + Math.random() * 0.6),
    s: (0.6 + Math.random() * 0.8) * (o.big || 1), ph: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25, vR: 8 + Math.random() * 18,
    orbit: 0,
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
  g.addColorStop(0, 'rgba(8,6,12,0)'); g.addColorStop(0.55, 'rgba(8,6,12,0.88)'); g.addColorStop(1, 'rgba(8,6,12,1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  const jx = () => (Math.random() - 0.5) * shake.v * 14;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], age = clock - p.born, k = age / p.life;
    if (k >= 1) { parts.splice(i, 1); continue; }
    p.a += p.vr * dt + p.orbit * dt * 1.6;
    p.R += p.vR * dt * (1 - p.orbit) - p.orbit * dt * 22;
    p.x = face.x + Math.cos(p.a) * p.R + jx();
    p.y = face.y + Math.sin(p.a) * p.R * 0.85 + jx();
    const al = Math.sin(Math.min(1, k * 1.0) * Math.PI) * (1 - grey.v * 0.5);
    const col = mix(p.color, grey.v);
    ctx.globalAlpha = Math.max(0, al);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 18;
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

function word(text, i, n, color) {
  const s = home(i, n);
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
export async function tasteMoment({ title = '', desc = '', flavours = [], mode = 'spark', lesson = '' } = {}) {
  if (G.skip) { save(title, lesson); return; }
  ensure(); resize();
  G.busy++;
  const prev = { shot: player.camShot, fov: player.fovShot, face: null };
  parts = []; emitters = []; clock = 0; grey.v = 0; shake.v = 0;
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
  if (mode === 'clash') {
    // everything at once, louder and louder, until it's only noise
    flavours.forEach((f, i) => { emitters.push({ f, slot: slots[i], rate: 9, acc: 0, o: { spread: true } }); word(f.word, i, n, FLAVOURS[f.k].color); });
    const cluster = [261.6, 277.2, 293.7, 311.1, 329.6, 349.2, 370];
    for (let i = 0; i < 9; i++) {
      note(cluster[i % cluster.length] * (i % 2 ? 1 : 2), 0.5, 'square', 0.035 + i * 0.004);
      note(cluster[(i + 3) % cluster.length], 0.5, 'sawtooth', 0.03);
      shake.v = i / 9; grey.v = Math.max(0, (i - 3) / 6);
      if (i === 5) player.char.setFace('shock');
      await sleep(0.32);
    }
    emitters.push({ f: { k: 'salty' }, slot: { a: 0, R: face.r * 1.8 }, rate: 30, acc: 0, o: { spread: true, life: 1 } });
    parts.forEach(p => { p.shape = Math.random() < 0.5 ? 'noise' : p.shape; });
    await sleep(0.8);
    // …pop. Nothing.
    emitters = []; parts = []; shake.v = 0; grey.v = 0;
    el.querySelector('.taste-words').innerHTML = '';
    sfx('fail'); note(110, 0.9, 'sine', 0.12);
    player.char.setFace('blank');
    await sleep(1.4);
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
      parts.push({ shape: 'ghost', color: '#d8d0ff', a: Math.PI / 2 + 0.2, R: face.r * 1.7, born: clock, life: 4, s: 1, ph: 0, vr: 0.05, vR: 0, orbit: 0 });
      note(220, 0.6, 'sine', 0.05);
      await sleep(1.2);
    }
    // they braid together around the duck… and spark
    for (const p of parts) p.orbit = 1, p.life += 1.5;
    chord(flavours.map(f => FLAVOURS[f.k].freq).concat(mode === 'missing' ? [] : [261.6]));
    await sleep(1.0);
    const sparks = mode === 'missing' ? 24 : 60;
    for (let i = 0; i < sparks; i++) parts.push({ shape: 'spark', color: i % 3 ? '#ffe08a' : '#fff6dc', a: Math.random() * 6.3, R: 0, born: clock, life: 1.2 + Math.random(), s: 0.6 + Math.random(), ph: 0, vr: 0, vR: 0, orbit: 0 });
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

function save(title, lesson) {
  G.soul = G.soul || [];
  if (lesson && !G.soul.some(s => s.lesson === lesson)) G.soul.push({ title, lesson });
}

// dev hook: #taste plays all three kinds
window.__taste = tasteMoment;
