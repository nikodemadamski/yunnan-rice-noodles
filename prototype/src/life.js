// Life in the streets: the small things that happen whether or not you're
// looking. Pigeons that peck and scatter when you ride through, cats asleep on
// warm steps (you can pet them), butterflies over the flower beds by day and
// fireflies by the lake at night, trees breathing in the wind, and neighbours
// who wave, say hello, or hop aside at your bell.

import * as THREE from 'three';
import { G, rng } from './core.js';
import { W, P } from './world.js';
import { player } from './player.js';
import { N } from './npcs.js';
import { mat, outline } from './characters.js';
import { emote, bark } from './ui.js';
import { sfx } from './audio.js';
import { addInteract } from './interact.js';

const R = rng(77);
const near = (o, r) => Math.hypot(o.x - player.pos.x, o.z - player.pos.z) < r;
const awake = () => !W.night;

// ---------------------------------------------------------------- pigeons

const FLOCKS = [
  { x: P.plaza.x - 4, z: P.plaza.z + 3 }, { x: P.plaza.x + 6, z: P.plaza.z - 4 },
  { x: -8, z: -6.2 }, { x: 36, z: 6.4 }, { x: P.lakeBench.x - 6, z: P.lakeBench.z + 2 },
  { x: P.market.x - 8, z: P.market.z - 12 }, { x: -36, z: -6.4 },
];
const birds = [];

function pigeon() {
  const g = new THREE.Group();
  const col = ['#b8b4c8', '#a9a4ba', '#d8d2e2', '#8f8aa2'][Math.floor(R() * 4)];
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(col));
  body.scale.set(1, 0.85, 1.35); body.position.y = 0.2;
  const head = new THREE.Group(); head.position.set(0, 0.36, 0.17);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(col)); head.add(hm);
  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#7fb7a2')); neck.position.set(0, -0.07, -0.02); head.add(neck);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), mat('#e8a04a')); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.01, 0.11); head.add(beak);
  for (const x of [-0.05, 0.05]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat('#1a1a1a')); e.position.set(x, 0.03, 0.07); head.add(e); }
  const wings = [-1, 1].map(s => {
    const w = new THREE.Group(); w.position.set(s * 0.1, 0.3, -0.03);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6), mat(col)); m.scale.set(0.9, 0.18, 1.25); m.position.x = s * 0.1; w.add(m);
    g.add(w); return w;
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.18), mat('#6e6a80')); tail.position.set(0, 0.22, -0.28); tail.rotation.x = -0.3;
  g.add(body, head, tail);
  outline(g, 1.06);
  g.traverse(o => { o.castShadow = false; });
  return { g, head, wings };
}

function initBirds() {
  for (const f of FLOCKS) {
    const n = 4 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const p = pigeon();
      const b = { ...p, home: f, x: f.x + (R() - 0.5) * 3, z: f.z + (R() - 0.5) * 3, y: 0, vx: 0, vy: 0, vz: 0, state: 'ground', t: R() * 3, peck: 0, ry: R() * 6 };
      p.g.position.set(b.x, 0, b.z);
      W.scene.add(p.g);
      birds.push(b);
    }
  }
}

let flutterT = 0, chirpT = 0;
function updateBirds(dt, t, focus) {
  flutterT -= dt; chirpT -= dt;
  const fast = player.mode === 'bike' && player.speed > 5;
  for (const b of birds) {
    b.g.visible = awake();
    if (!b.g.visible || Math.abs(b.x - focus.x) > 70 || Math.abs(b.z - focus.z) > 70) continue;
    if (b.state === 'ground') {
      // peck, look about, hop
      b.t -= dt;
      b.peck = Math.max(0, b.peck - dt * 3);
      if (b.t <= 0) {
        b.t = 0.6 + R() * 2.2;
        if (R() < 0.5) b.peck = 1;
        else { b.ry += (R() - 0.5) * 2; b.hop = 0.25; }
      }
      if (b.hop > 0) { b.hop -= dt; b.x += Math.sin(b.ry) * dt * 1.2; b.z += Math.cos(b.ry) * dt * 1.2; }
      b.y = b.hop > 0 ? Math.sin((0.25 - b.hop) / 0.25 * Math.PI) * 0.12 : 0;
      b.head.rotation.x = Math.sin(b.peck * Math.PI) * 0.9;
      b.wings[0].rotation.z = 0.9; b.wings[1].rotation.z = -0.9;   // folded along the body
      if (near(b, fast ? 8 : 3.6) && !G.flags.cutscene) {
        // scatter: up and away from you
        const dx = b.x - player.pos.x, dz = b.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
        const sp = 4 + R() * 3;
        b.vx = dx / d * sp + (R() - 0.5) * 2; b.vz = dz / d * sp + (R() - 0.5) * 2; b.vy = 4.5 + R() * 2.5;
        b.state = 'fly'; b.t = 2.2 + R() * 2;
        b.ry = Math.atan2(b.vx, b.vz);
        if (flutterT <= 0) { sfx('flutter'); flutterT = 0.6; }
      } else if (near(b, 9) && chirpT <= 0 && R() < 0.004) { sfx('chirp'); chirpT = 4; }
    } else if (b.state === 'fly') {
      b.t -= dt;
      b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
      b.vy -= 2.2 * dt;
      if (b.t <= 0) {
        // pick a landing spot near home (away from you if possible) and glide down
        b.state = 'land';
        let lx = b.home.x + (R() - 0.5) * 8, lz = b.home.z + (R() - 0.5) * 8;
        if (near({ x: lx, z: lz }, 6)) { lx = b.home.x + (b.home.x - player.pos.x) * 0.5; lz = b.home.z + (b.home.z - player.pos.z) * 0.5; }
        b.land = { x: lx, z: lz };
      }
      const flap = Math.sin(t * 38 + b.ry) * 0.9;
      b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
    } else if (b.state === 'land') {
      const dx = b.land.x - b.x, dz = b.land.z - b.z, d = Math.hypot(dx, dz);
      const sp = Math.min(6, d * 1.5 + 1);
      if (d > 0.1) { b.x += dx / d * sp * dt; b.z += dz / d * sp * dt; b.ry = Math.atan2(dx, dz); }
      b.y = Math.max(0, b.y - dt * Math.max(1.5, b.y * 1.2));
      const flap = Math.sin(t * 22 + b.ry) * 0.5;
      b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
      if (b.y <= 0 && d < 0.3) { b.state = 'ground'; b.t = 1 + R() * 2; }
    }
    b.g.position.set(b.x, b.y, b.z);
    b.g.rotation.y = b.ry;
  }
}

// ---------------------------------------------------------------- cats

const CATS = [
  { x: -12.6, z: -8.6, ry: 0.4, coat: ['#f0a25a', '#c9763a'], name: 'Mantou' },         // Grandma's step
  { x: -24.8, z: 8.9, ry: Math.PI - 0.3, coat: ['#f4f0e8', '#d9cfc2'], name: 'Tangyuan' }, // by Little Chilli's stall
  { x: P.lakeBench.x + 2.6, z: P.lakeBench.z + 0.4, ry: 0.2, coat: ['#3a3a42', '#26262c'], name: 'Heidou' },
  { x: P.plaza.x + 13.4, z: P.plaza.z + 8.3, ry: -0.8, coat: ['#b9b0a4', '#e8a35a'], name: 'Huahua' },
];
const cats = [];

function makeCat(c) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), mat(c.coat[0]));
  body.scale.set(1, 0.8, 1.35); body.position.y = 0.26;
  const head = new THREE.Group(); head.position.set(0, 0.48, 0.32);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat(c.coat[0])));
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 4), mat(c.coat[1]));
    ear.position.set(s * 0.12, 0.18, 0); ear.rotation.z = -s * 0.25; head.add(ear);
  }
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#2a2a2a')); e.position.set(s * 0.08, 0.03, 0.19); head.add(e); return e; });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), mat('#f29aa8')); nose.position.set(0, -0.03, 0.21); head.add(nose);
  const tail = new THREE.Group(); tail.position.set(0, 0.28, -0.4);
  const tm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), mat(c.coat[1])); tm.position.y = 0.22; tail.add(tm);
  g.add(body, head, tail);
  outline(g, 1.05);
  g.position.set(c.x, 0.1, c.z); g.rotation.y = c.ry;
  W.scene.add(g);
  const cat = { ...c, g, body, head, eyes, tail, state: R() < 0.6 ? 'sleep' : 'sit', t: 0, ph: R() * 6, pets: 0, run: null };
  // emote/bark anchor at cat height (floaters draw ~3.9 above root)
  cat.anchor = { root: { position: new THREE.Vector3(c.x, -3.1, c.z), scale: { y: 1 } } };
  addInteract({ at: () => cat.g.position, r: 2.2, label: `Pet ${c.name} 🐱`, fn: () => pet(cat) });
  return cat;
}

async function pet(cat) {
  cat.state = 'purr'; cat.t = 3.2;
  sfx('purr'); setTimeout(() => sfx('meow'), 500);
  cat.anchor.root.position.set(cat.g.position.x, -3.1, cat.g.position.z);
  emote(cat.anchor, cat.pets ? '💗' : '😺', 2);
  cat.pets++;
  G.flags.catPets = (G.flags.catPets || 0) + 1;
  if (G.flags.catPets === 1) bark(player.char, `${cat.name}! What a good cat.`, 2.4);
  player.char.setFace('happy');
  await new Promise(r => setTimeout(r, 1400));
}

function updateCats(dt, t) {
  const fast = player.mode === 'bike' && player.speed > 6;
  for (const c of cats) {
    c.t -= dt;
    const breath = Math.sin(t * (c.state === 'sleep' ? 1.6 : 2.4) + c.ph);
    if (c.state === 'run') {
      const dx = c.run.x - c.g.position.x, dz = c.run.z - c.g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { c.state = 'sit'; c.t = 4; }
      else { c.g.position.x += dx / d * 7 * dt; c.g.position.z += dz / d * 7 * dt; c.g.rotation.y = Math.atan2(dx, dz); c.g.position.y = 0.1 + Math.abs(Math.sin(t * 18)) * 0.12; }
    } else if (fast && near(c.g.position, 3.4) && c.state !== 'purr') {
      // startled by the scooter: a hop, a yowl, and off to a safer spot
      c.state = 'run';
      const dx = c.g.position.x - player.pos.x, dz = c.g.position.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
      c.run = { x: c.g.position.x + dx / d * 3, z: c.g.position.z + dz / d * 3 };
      sfx('meow');
      c.anchor.root.position.set(c.g.position.x, -3.1, c.g.position.z);
      emote(c.anchor, '❗', 1);
    } else {
      c.g.position.y = 0.1;
      if (c.state === 'purr' && c.t <= 0) c.state = 'sit';
      if (c.state === 'sleep' && near(c.g.position, 2.6) && !fast) { c.state = 'sit'; c.t = 3; }
      if (c.state === 'sit' && c.t <= 0 && !near(c.g.position, 5) && R() < 0.01) c.state = 'sleep';
    }
    const sleeping = c.state === 'sleep', purring = c.state === 'purr';
    c.body.scale.y = (sleeping ? 0.6 : 0.8) + breath * 0.03;
    c.head.position.y = sleeping ? 0.3 : 0.48;
    c.head.position.z = sleeping ? 0.36 : 0.32;
    c.eyes.forEach(e => { e.scale.y = sleeping || purring ? 0.2 : 1; });
    c.tail.rotation.z = Math.sin(t * (purring ? 6 : 1.4) + c.ph) * (sleeping ? 0.15 : 0.6);
    c.tail.rotation.x = sleeping ? -1.2 : -0.4;
    if (!sleeping && c.state !== 'run' && near(c.g.position, 6)) {
      // watches you go by
      const want = Math.atan2(player.pos.x - c.g.position.x, player.pos.z - c.g.position.z) - c.g.rotation.y;
      c.head.rotation.y += (Math.max(-1, Math.min(1, Math.atan2(Math.sin(want), Math.cos(want)))) - c.head.rotation.y) * Math.min(1, dt * 4);
    } else c.head.rotation.y *= 0.95;
    c.head.rotation.z = purring ? Math.sin(t * 5) * 0.15 : 0;
  }
}

// ---------------------------------------------------------------- butterflies & fireflies

const flyers = [];
function initFlyers() {
  const beds = W.trees.filter(() => R() < 0.25).slice(0, 18).concat([P.plaza, P.lakeBench]);
  const wingGeo = new THREE.CircleGeometry(0.2, 10);
  for (const [i, b] of beds.entries()) {
    const g = new THREE.Group();
    const col = ['#ffe36e', '#ffffff', '#ffb3d1', '#a9d8ff', '#ffc27a'][i % 5];
    const m = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const wings = [-1, 1].map(s => { const w = new THREE.Group(); const p = new THREE.Mesh(wingGeo, m); p.position.x = s * 0.18; p.scale.y = 0.8; w.add(p); g.add(w); return w; });
    W.scene.add(g);
    flyers.push({ kind: 'butterfly', g, wings, c: b, ph: R() * 6, r: 1.2 + R() * 1.4 });
  }
  // fireflies: the lake, the plaza and Grandpa's street at night
  const glow = new THREE.SphereGeometry(0.07, 6, 4);
  for (const [cx, cz, n] of [[P.lakeBench.x, P.lakeBench.z + 2, 26], [P.plaza.x, P.plaza.z, 16], [-15, 0, 12]]) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ color: '#d8ff7a', transparent: true, opacity: 0.8, depthWrite: false }));
      m.userData.noShadow = true;
      W.scene.add(m);
      flyers.push({ kind: 'firefly', g: m, c: { x: cx + (R() - 0.5) * 18, z: cz + (R() - 0.5) * 12 }, ph: R() * 6, r: 1 + R() * 2 });
    }
  }
}

function updateFlyers(dt, t, focus) {
  for (const f of flyers) {
    const on = f.kind === 'butterfly' ? !W.night : W.night;
    const close = Math.abs(f.c.x - focus.x) < 60 && Math.abs(f.c.z - focus.z) < 60;
    f.g.visible = on && close;
    if (!f.g.visible) continue;
    const a = t * (f.kind === 'butterfly' ? 0.7 : 0.25) + f.ph;
    let x = f.c.x + Math.sin(a) * f.r, z = f.c.z + Math.sin(a * 2) * f.r * 0.6;
    if (f.kind === 'butterfly') {
      // a figure of eight over the flowers; shy of the duck
      if (near({ x, z }, 1.6)) { f.ph += dt * 2; }
      f.g.position.set(x, 0.9 + Math.sin(t * 3 + f.ph) * 0.25, z);
      f.g.rotation.y = Math.atan2(Math.cos(a), Math.cos(a * 2) * 1.2);
      const flap = Math.sin(t * 20 + f.ph) * 1.1;
      f.wings[0].rotation.y = flap; f.wings[1].rotation.y = -flap;
    } else {
      f.g.position.set(x, 0.6 + Math.sin(a * 3) * 0.5 + 0.5, z);
      f.g.material.opacity = 0.25 + Math.max(0, Math.sin(t * 2.2 + f.ph * 3)) * 0.75;
    }
  }
}

// ---------------------------------------------------------------- the trees breathe

function updateTrees(t, focus) {
  for (const c of W.crowns || []) {
    if (Math.abs(c.position.x - focus.x) > 60 || Math.abs(c.position.z - focus.z) > 60) continue;
    const ph = c.userData.ph;
    c.rotation.z = Math.sin(t * 0.9 + ph) * 0.03;
    c.rotation.x = Math.sin(t * 0.7 + ph * 1.3) * 0.02;
  }
}

// ---------------------------------------------------------------- neighbours say hello

const HELLO = ['早！Morning, Duck! 🦆', '小黄鸭！Little Yellow Duck!', 'Hello, foreigner! 👋', '吃了吗？Eaten yet?', 'Nice scooter!',
  'Duck! Bring me noodles later!', 'Slow down on the crossing!', '你好！Ni hao!', 'Kunming weather, eh? Always spring!'];
const HELLO_NIGHT = ['晚上好！Evening, Duck!', 'Still riding? Go to bed!', 'Mind the dark, little duck.'];
const SHOPKEEPERS = {
  spud: ['Potatoes! Hot potatoes! For you, half spicy.', 'Duck! Spud’s finest, any time!'],
  fu: ['Hmph. Duck.', 'Wipe your feet if you come in.'],
  ji: ['The hen’s been steaming since dawn!', 'Duck! Tell your grandma Ji says hi.'],
  rose: ['Hiii Duck! Roses today? Roses every day!', 'Sweetie! You look tired. Eat a cake!'],
};
const greet = {};
let bellT = 0;

function updateHello(dt, t) {
  bellT -= dt;
  if (G.flags.cutscene || G.busy > 0) return;
  const moving = player.speed > 0.5;
  for (const id in N) {
    const n = N[id];
    const walker = id.startsWith('walker'), keeper = SHOPKEEPERS[id];
    if ((!walker && !keeper) || !n.char.root.visible) continue;
    const g = greet[id] || (greet[id] = { t: R() * 10, wave: 0 });
    g.t -= dt;
    const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z);
    // the bell: riders ring, walkers hop aside
    if (walker && player.mode === 'bike' && player.speed > 6 && d < 3.4) {
      if (bellT <= 0) { sfx('bell'); bellT = 2.5; }
      if (!g.hop) {
        g.hop = 0.35;
        emote(n.char, '❗', 0.9);
        const dx = n.pos.x - player.pos.x, dz = n.pos.z - player.pos.z, dd = d || 1;
        n.pos.x += dx / dd * 0.9; n.pos.z += dz / dd * 0.9;
      }
    }
    if (g.hop > 0) { g.hop -= dt; n.char.body.position.y = Math.sin((0.35 - Math.max(0, g.hop)) / 0.35 * Math.PI) * 0.35; if (g.hop <= 0) { g.hop = 0; n.char.body.position.y = 0; } }
    // a wave and a hello when you pass, now and then
    if (g.t <= 0 && d < 3.6 && moving) {
      g.t = 35 + R() * 25;
      g.wave = 1.4;
      const lines = keeper || (W.night ? HELLO_NIGHT : HELLO);
      bark(n.char, lines[Math.floor(R() * lines.length)], 2.4);
      n.facing = Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z);
    }
    if (g.wave > 0) {
      g.wave -= dt;
      n.char.arms[1].rotation.z = 2.5 + Math.sin(t * 14) * 0.35;
      n.char.arms[1].rotation.x = 0;
    }
  }
}

// ---------------------------------------------------------------- entry

export function initLife() {
  initBirds();
  for (const c of CATS) cats.push(makeCat(c));
  initFlyers();
}

export function updateLife(dt, t, focus) {
  updateBirds(dt, t, focus);
  updateCats(dt, t);
  updateFlyers(dt, t, focus);
  updateTrees(t, focus);
  updateHello(dt, t);
}

// dev/test hook
window.__life = { birds, cats, flyers };
