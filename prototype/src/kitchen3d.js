// Grandma's kitchen in 3D: cook the cross-bridge bowl with your hands.
// Cooking Mama's lesson: one clear physical verb per step, generous input,
// big feedback. Papa's lesson: an order ticket, building in order, a score
// and a reaction. Everything happens on a real counter in the world, with
// Grandma beside you, not on a flat panel.
//   1 Broth   – drag a base into the pot; hold the knob to keep a gentle
//               simmer; tap the grey scum to skim it
//   2 Slice   – swipe the knife down through the meat on each guide line
//   3 Eggs    – tap when the swinging quail egg is over the bowl
//   4 Noodles – stir in circles, then lift the basket when they're just done
//   5 Oil     – drag a jar to the bowl, hold to pour, let go in the band
//   6 Build   – drag toppings into the bowl in the ticket's order
//   7 Taste   – Grandma tastes; medal, skill bars and her verdict
// No step can fail the bowl ("Grandma will fix it!").
// Resolves with { greens, perfect, extras, pick, skill, total, medal }.

import * as THREE from 'three';
import { G, addTicker, clamp, esc } from './core.js';
import { W } from './world.js';
import { makeCharacter, mat, toon, outline } from './characters.js';
import { player, updateCamera } from './player.js';
import { beat, emote } from './ui.js';
import { sfx, note } from './audio.js';
import { addTrauma, hitstop } from './fx.js';
import { act, stopActing } from './acting.js';
import { SLOTS, EXTRAS, hasOption } from './bowllab.js';

const KX = 800, KZ = 400, TOP = 1.5;
const POT = { x: KX - 3.4, z: KZ - 0.4, r: 1.15 };
const BOWL = { x: KX + 0.1, z: KZ + 1.0, r: 0.95 };
const BOARD = { x: KX + 3.7, z: KZ - 0.1 };
const KNOB = { x: KX - 3.4, z: KZ + 1.75 };
const STEPS = ['Broth', 'Slice', 'Eggs', 'Noodles', 'Oil', 'Build', 'Taste'];

let K = null;           // the built set
let hud = null;

// ============================================================ the set

function mesh(geo, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  if (o.ink !== false) outline(m, o.ink || 1.04);
  m.castShadow = true; m.receiveShadow = true;
  (o.parent || W.scene).add(m);
  return m;
}

function lathe(points, color, segs = 40) {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs), toon({ color, side: THREE.DoubleSide }));
}

function buildSet() {
  if (K) return K;
  K = { items: [], pickables: [] };
  // floor, back wall of tiles, a window of afternoon light
  mesh(new THREE.BoxGeometry(30, 0.2, 20), '#c99a6a', KX, -0.1, KZ, { ink: false });
  const tiles = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f7efe2'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#d9cbb3'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
    g.fillStyle = '#7fb8a8'; g.beginPath(); g.arc(64, 64, 10, 0, 7); g.fill();
    return c;
  })());
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(14, 5);
  mesh(new THREE.BoxGeometry(30, 10, 0.3), toon({ map: tiles }), KX, 5, KZ - 5.4, { ink: false });
  mesh(new THREE.BoxGeometry(5.5, 3.2, 0.1), '#bfe6ff', KX + 3.8, 5.6, KZ - 5.2, { ink: false });
  for (const [w, h, x, y] of [[5.9, 0.25, 0, 1.7], [5.9, 0.25, 0, -1.7], [0.25, 3.6, -2.85, 0], [0.25, 3.6, 2.85, 0], [0.15, 3.2, 0, 0]]) {
    mesh(new THREE.BoxGeometry(w, h, 0.2), '#fbf5ec', KX + 3.8 + x, 5.6 + y, KZ - 5.1, { ink: false });
  }
  // a string of dried chillies and a little shelf with jars
  mesh(new THREE.BoxGeometry(5, 0.2, 0.9), '#a8754a', KX - 3.5, 5.0, KZ - 4.9);
  for (let i = 0; i < 4; i++) {
    const j = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 16), ['#f2c14e', '#e2574c', '#7cc35b', '#f4a6c0'][i], KX - 5.3 + i * 1.2, 5.5, KZ - 4.9);
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 16), '#8a5a3b', 0, 0.45, 0, { parent: j });
  }
  // the counter
  mesh(new THREE.BoxGeometry(14, 0.35, 5.6), '#e8c49a', KX, TOP - 0.17, KZ - 0.3);
  mesh(new THREE.BoxGeometry(13.6, TOP - 0.35, 5.2), '#b97f52', KX, (TOP - 0.35) / 2, KZ - 0.3, { ink: false });
  // stove + burner + knob
  mesh(new THREE.BoxGeometry(3.4, 0.2, 3.4), '#4a4550', POT.x, TOP + 0.1, POT.z);
  const ring = mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 28).rotateX(Math.PI / 2), '#2a262e', POT.x, TOP + 0.22, POT.z, { ink: false });
  K.flames = [];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), new THREE.MeshBasicMaterial({ color: '#5aa8ff', transparent: true, opacity: 0.9 }));
    f.position.set(POT.x + Math.cos(a) * 0.85, TOP + 0.35, POT.z + Math.sin(a) * 0.85);
    f.userData.noShadow = true;
    W.scene.add(f); K.flames.push(f);
  }
  K.knob = mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.3, 18), '#e2574c', KNOB.x, TOP + 0.15, KNOB.z);
  mesh(new THREE.BoxGeometry(0.08, 0.06, 0.4), '#fffaf0', 0, 0.17, -0.1, { parent: K.knob, ink: false });
  K.knob.userData.pick = 'knob';
  // the pot
  const pot = new THREE.Group();
  pot.position.set(POT.x, TOP + 0.2, POT.z);
  const shell = lathe([[0, 0], [1.05, 0], [1.2, 0.1], [1.22, 1.15], [1.3, 1.2]], '#c9ced6');
  pot.add(shell); outline(shell, 1.03);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), '#4a4550', s * 1.45, 1.0, 0, { parent: pot });
  K.potBroth = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40).rotateX(-Math.PI / 2), toon({ color: '#d9ecf5' }));
  K.potBroth.position.y = 0.95;
  pot.add(K.potBroth);
  W.scene.add(pot);
  K.pot = pot;
  // the serving bowl: big, blue-rimmed porcelain
  const bowl = new THREE.Group();
  bowl.position.set(BOWL.x, TOP, BOWL.z);
  const bshell = lathe([[0, 0], [0.45, 0], [0.75, 0.12], [0.95, 0.42], [1.0, 0.55]], '#f7f3ec');
  bowl.add(bshell); outline(bshell, 1.03);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.045, 8, 48).rotateX(Math.PI / 2), mat('#3a6ea5'));
  rim.position.y = 0.55; bowl.add(rim);
  K.bowlBroth = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), toon({ color: '#f2c46d' }));
  K.bowlBroth.position.y = 0.44; K.bowlBroth.visible = false;
  bowl.add(K.bowlBroth);
  K.oilLayer = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0 }));
  K.oilLayer.position.y = 0.46;
  bowl.add(K.oilLayer);
  K.bowlStuff = new THREE.Group(); K.bowlStuff.position.y = 0.47; bowl.add(K.bowlStuff);
  W.scene.add(bowl);
  K.bowl = bowl;
  // the cutting board
  K.board = mesh(new THREE.BoxGeometry(3.3, 0.18, 2.3), '#e2b27a', BOARD.x, TOP + 0.09, BOARD.z);
  // steam over the pot
  K.steam = [];
  const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), steamMat.clone());
    p.userData.t = i / 10; p.userData.noShadow = true;
    W.scene.add(p); K.steam.push(p);
  }
  K.heat = 0.2;
  // warm kitchen lamp
  const lamp = new THREE.PointLight('#ffd9a0', 18, 18, 1.6);
  lamp.position.set(KX - 0.5, 7.5, KZ + 1.5);
  W.scene.add(lamp);
  // Grandma, beside the counter
  K.gran = makeCharacter({ skin: '#f3d0b5', shirt: '#9b5a8a', pants: '#4a3a5a', hair: '#d8d4d0', hairStyle: 'bun', skirt: true, scale: 0.9, blush: true, glasses: true });
  K.gran.root.position.set(KX - 1.5, 0.45, KZ - 3.6);
  K.gran.root.rotation.y = 0;
  W.scene.add(K.gran.root);
  // particles
  K.parts = [];
  addTicker(dt => {
    if (!K.live) return;
    if (K.granTarget && !K.granBusy) {
      const p = K.gran.root.position, dx = K.granTarget.x - p.x, dz = K.granTarget.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.15) { p.x += dx / d * 3 * dt; p.z += dz / d * 3 * dt; K.gran.root.rotation.y = Math.atan2(dx, dz); K.gran.animate(dt, 3, K.t || 0); }
      else K.gran.root.rotation.y += (0 - K.gran.root.rotation.y) * Math.min(1, dt * 6);
    }
    K.t = (K.t || 0) + dt;
    for (const [i, f] of K.flames.entries()) {
      const h = 0.25 + K.heat * 1.1 + Math.sin(K.t * 20 + i) * 0.05 * (0.4 + K.heat);
      f.scale.set(1, h / 0.4, 1);
      f.material.color.set(K.heat > 0.78 ? '#ff6a2a' : K.heat > 0.45 ? '#ffb02e' : '#5aa8ff');
    }
    for (const p of K.steam) {
      p.userData.t = (p.userData.t + dt * (0.25 + K.heat * 0.5)) % 1;
      const k = p.userData.t;
      p.position.set(POT.x + Math.sin(k * 7 + p.id) * 0.4, TOP + 1.4 + k * 2.6, POT.z + Math.cos(k * 5 + p.id) * 0.3);
      p.scale.setScalar(0.6 + k * 2.4);
      p.material.opacity = (0.12 + K.heat * 0.3) * Math.sin(k * Math.PI);
    }
    K.parts = K.parts.filter(p => {
      p.life += dt;
      p.v.y -= p.g * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max) { W.scene.remove(p.m); return false; }
      return true;
    });
  });
  return K;
}

function burst(x, y, z, n, color, o = {}) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(o.r || 0.07, 6, 5), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.set(x, y, z);
    m.userData.noShadow = true;
    W.scene.add(m);
    const a = Math.random() * Math.PI * 2, sp = (o.speed || 2.5) * (0.4 + Math.random() * 0.8);
    K.parts.push({ m, v: new THREE.Vector3(Math.cos(a) * sp * 0.6, (o.up ?? 3) * (0.6 + Math.random() * 0.6), Math.sin(a) * sp * 0.6), g: o.g ?? 9, life: 0, max: o.life || 0.7 });
  }
}

// ============================================================ input

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const P = { down: false, x: 0, y: 0, sx: 0, sy: 0, t0: 0, events: [] };

function onDown(e) {
  if (!K?.live || e.target !== W.renderer.domElement) return;
  Object.assign(P, { down: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: performance.now(), path: [[e.clientX, e.clientY, performance.now()]] });
  P.events.push({ type: 'down', x: e.clientX, y: e.clientY });
}
function onMove(e) {
  if (!K?.live) return;
  P.x = e.clientX; P.y = e.clientY;
  if (P.down) { P.path.push([e.clientX, e.clientY, performance.now()]); if (P.path.length > 12) P.path.shift(); }
}
function onUp(e) {
  if (!K?.live || !P.down) return;
  P.down = false;
  const ms = performance.now() - P.t0, dx = e.clientX - P.sx, dy = e.clientY - P.sy;
  P.events.push({ type: 'up', x: e.clientX, y: e.clientY, dx, dy, ms });
  if (ms < 300 && Math.hypot(dx, dy) < 14) P.events.push({ type: 'tap', x: e.clientX, y: e.clientY });
}
const poll = () => { const e = P.events; P.events = []; return e; };
const speedPx = () => {                       // recent pointer speed in px/s
  const p = P.path || []; if (p.length < 2) return 0;
  const a = p[0], b = p[p.length - 1];
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(0.016, (b[2] - a[2]) / 1000);
};

function setRay(x, y) {
  const r = W.renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, W.camera);
}
/** Which pickable (userData.pick) is under the screen point? */
function pickAt(x, y, list = K.pickables) {
  setRay(x, y);
  const hits = ray.intersectObjects(list, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o) return o; }
  return null;
}
/** The point on a horizontal plane at height y under the screen point. */
function planeAt(x, y, h = TOP + 0.6) {
  setRay(x, y);
  const t = (h - ray.ray.origin.y) / ray.ray.direction.y;
  return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
}
/** Screen position of a world point (for DOM overlays). */
function toScreen(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(W.camera);
  const r = W.renderer.domElement.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
}

// ============================================================ HUD

function makeHud() {
  hud = document.createElement('div');
  hud.className = 'k3';
  hud.innerHTML = `
    <div class="k3-top">
      <div class="k3-steps">${STEPS.map((s, i) => `<span class="k3-step">${i + 1} ${s}</span>`).join('')}</div>
    </div>
    <div class="k3-bottom">
      <div class="k3-title"></div>
      <div class="k3-help"></div>
    </div>
    <div class="k3-gauge hidden"><div class="k3-band"></div><div class="k3-needle"></div><span></span></div>
    <div class="k3-ticket hidden"></div>
    <div class="k3-float"></div>`;
  document.getElementById('ui').appendChild(hud);
  document.body.classList.add('cooking');
}

function setStep(i, title, help) {
  hud.querySelectorAll('.k3-step').forEach((s, j) => { s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); });
  hud.querySelector('.k3-title').textContent = title;
  hud.querySelector('.k3-help').textContent = help || '';
}
const help = t => { hud.querySelector('.k3-help').textContent = t; };

/** A vertical gauge on the right: value 0..1, green band lo..hi. */
function gauge(value, lo, hi, label) {
  const g = hud.querySelector('.k3-gauge');
  if (value === null) { g.classList.add('hidden'); return; }
  g.classList.remove('hidden');
  g.querySelector('.k3-band').style.cssText = `bottom:${lo * 100}%; height:${(hi - lo) * 100}%`;
  g.querySelector('.k3-needle').style.bottom = `${clamp(value, 0, 1) * 100}%`;
  g.querySelector('span').textContent = label;
}

function pop(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `k3-pop ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  hud.querySelector('.k3-float').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

const GRADES = [[0.9, 'PERFECT!', 'perfect'], [0.7, 'GREAT!', 'great'], [0.45, 'OK!', 'ok'], [-1, 'OOPS…', 'oops']];
async function stamp(score) {
  const [, text, cls] = GRADES.find(([min]) => score >= min);
  const el = document.createElement('div');
  el.className = `k3-stamp ${cls}`;
  el.textContent = text;
  hud.appendChild(el);
  sfx(score >= 0.7 ? 'ding' : score >= 0.45 ? 'pop' : 'fail');
  const gran = K.gran;
  if (score >= 0.9) { gran.setFace('happy'); emote(gran, '✨', 1.4); act(gran, 'bounce'); }
  else if (score < 0.45) { gran.setFace('smug'); emote(gran, '👵', 1.4); pop('Grandma will fix it!', innerWidth / 2, innerHeight * 0.62, 'fix'); }
  else { gran.setFace('happy'); act(gran, 'chuckle'); }
  await beat(1.3);
  act(gran, 'idle');
  gran.setFace('normal');
  el.remove();
}

/** Cooking Mama's "watch Grandma first" card: icon + verb, a second long. */
async function hint(icon, text) {
  const el = document.createElement('div');
  el.className = 'k3-hint';
  el.innerHTML = `<span class="hand">${icon}</span><b>${esc(text)}</b>`;
  hud.appendChild(el);
  sfx('beep');
  await beat(1.2);
  el.remove();
}

function run(frame) {
  return new Promise(res => {
    let t = 0;
    addTicker(dt => {
      t += dt;
      const out = frame(dt, t, poll());
      if (out !== undefined) { res(out); return true; }
    });
  });
}

// ============================================================ ingredient models

function hen() {
  const g = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.42, 18, 14), '#f6d9b6', 0, 0.38, 0, { parent: g });
  for (const s of [-1, 1]) {
    const d = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), '#f1c99c', s * 0.32, 0.25, 0.22, { parent: g });
    d.rotation.z = s * 0.9;
  }
  mesh(new THREE.ConeGeometry(0.12, 0.25, 8), '#f6d9b6', 0, 0.55, -0.4, { parent: g });
  return g;
}
function cube() { const g = new THREE.Group(); mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), '#d9a03a', 0, 0.23, 0, { parent: g }); return g; }
function rose() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const p = mesh(new THREE.SphereGeometry(0.2, 10, 8), '#f4a6c0', Math.cos(i) * 0.18, 0.25 + (i % 2) * 0.08, Math.sin(i) * 0.18, { parent: g }); p.scale.y = 0.6; }
  mesh(new THREE.SphereGeometry(0.15, 10, 8), '#e05a87', 0, 0.38, 0, { parent: g });
  return g;
}
function jar(color) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 18), toon({ color: '#ffffff', transparent: true, opacity: 0.45 }), 0, 0.4, 0, { parent: g, ink: 1.03 });
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 18), color, 0, 0.3, 0, { parent: g, ink: false });
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 18), '#8a5a3b', 0, 0.85, 0, { parent: g });
  return g;
}
function dish(contents) {               // a little prep bowl holding a topping
  const g = new THREE.Group();
  const b = lathe([[0, 0], [0.3, 0], [0.48, 0.12], [0.52, 0.3]], '#ffffff', 24);
  g.add(b); outline(b, 1.04);
  const c = contents(); c.position.y = 0.2; g.add(c);
  return g;
}
const TOPPING_ART = {
  meat: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = mesh(new THREE.BoxGeometry(0.42, 0.05, 0.22), '#f7a8a8', (i - 1) * 0.1, 0.03 * i, 0, { parent: g, ink: false }); m.rotation.y = i * 0.6; } return g; },
  egg: () => { const g = new THREE.Group(); for (const x of [-0.12, 0.12]) { mesh(new THREE.SphereGeometry(0.13, 12, 10), '#fffaf0', x, 0, 0, { parent: g, ink: false }); mesh(new THREE.SphereGeometry(0.07, 10, 8), '#ffc93c', x, 0.07, 0, { parent: g, ink: false }); } return g; },
  noodles: () => { const g = new THREE.Group(); mesh(new THREE.TorusKnotGeometry(0.18, 0.04, 48, 6, 3, 5), '#fffaf0', 0, 0.05, 0, { parent: g, ink: false }).scale.y = 0.45; return g; },
  chives: () => { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const c = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 5).rotateZ(Math.PI / 2), '#4caf50', (Math.random() - 0.5) * 0.4, 0.02, (Math.random() - 0.5) * 0.3, { parent: g, ink: false }); c.rotation.y = Math.random() * 3; } return g; },
  rose: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const p = mesh(new THREE.SphereGeometry(0.08, 8, 6), '#f4a6c0', (Math.random() - 0.5) * 0.4, 0.02, (Math.random() - 0.5) * 0.3, { parent: g, ink: false }); p.scale.y = 0.4; } return g; },
  cheese: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), '#ffd84d', (Math.random() - 0.5) * 0.35, 0.04, (Math.random() - 0.5) * 0.3, { parent: g, ink: false }); return g; },
  potato: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.1, 0.1, 0.3), '#e8b04a', (Math.random() - 0.5) * 0.35, 0.04, (Math.random() - 0.5) * 0.25, { parent: g, ink: false }).rotation.y = Math.random() * 3; return g; },
  gold: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.16, 0.01, 0.16), '#f2c14e', (Math.random() - 0.5) * 0.3, 0.03, (Math.random() - 0.5) * 0.3, { parent: g, ink: false }).rotation.y = Math.random() * 3; return g; },
  sparkler: () => { const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), '#9aa0a8', 0, 0.3, 0, { parent: g, ink: false }); return g; },
  eggs: () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.08, 8, 6), '#fffaf0', (i % 3 - 1) * 0.16, 0.04 + Math.floor(i / 3) * 0.1, 0, { parent: g, ink: false }); return g; },
};

function place(obj, x, z, y = TOP) {
  obj.position.set(x, y, z);
  W.scene.add(obj);
  K.items.push(obj);
  return obj;
}
function clearItems() {
  for (const o of K.items) W.scene.remove(o);
  K.items = []; K.pickables = [];
}

/** Drag-to-target with a soft spring: returns the dropped item's id. */
function dragInto(choices, target, radius, onHover) {
  return run((dt, t, evs) => {
    for (const e of evs) {
      if (e.type === 'down') { const o = pickAt(e.x, e.y, choices.map(c => c.obj)); if (o && !o.userData.locked) { K.drag = o; sfx('pop'); } }
      if (e.type === 'up' && K.drag) {
        const o = K.drag; K.drag = null;
        if (Math.hypot(o.position.x - target.x, o.position.z - target.z) < radius) return o.userData.pick;
        sfx('bump');
      }
    }
    for (const c of choices) {
      const o = c.obj;
      if (o === K.drag) {
        const p = planeAt(P.x, P.y, TOP + 0.9);
        o.position.lerp(new THREE.Vector3(p.x, TOP + 0.9, p.z), Math.min(1, dt * 18));
        o.rotation.z = Math.sin(t * 9) * 0.08;
        onHover?.(Math.hypot(o.position.x - target.x, o.position.z - target.z) < radius);
      } else {
        o.position.lerp(new THREE.Vector3(c.x, TOP + (o.userData.locked ? 0 : Math.abs(Math.sin(t * 3 + c.x)) * 0.06), c.z), Math.min(1, dt * 10));
        o.rotation.z *= 0.9;
      }
    }
  });
}

// ============================================================ the steps

async function stepBroth(st) {
  setStep(0, '1 · The broth', 'Drag a base into the pot.');
  const opts = SLOTS[0].options;
  const art = { cube, hen, flower: rose };
  const choices = opts.map((o, i) => {
    const obj = art[o.id]();
    obj.userData.pick = o.id;
    obj.userData.locked = !hasOption(SLOTS[0], o);
    if (obj.userData.locked) obj.traverse(m => { if (m.isMesh && m.material.color) m.material = mat('#b9b0a6'); });
    const x = KX - 0.6 + i * 1.3, z = KZ - 1.7;
    place(obj, x, z); K.pickables.push(obj);
    return { obj, x, z };
  });
  const id = await dragInto(choices, POT, 1.2);
  const base = opts.find(o => o.id === id);
  st.broth = id;
  const dropped = choices.find(c => c.obj.userData.pick === id).obj;
  // plop!
  await run((dt, t) => { dropped.position.lerp(new THREE.Vector3(POT.x, TOP + 0.9, POT.z), dt * 12); dropped.scale.multiplyScalar(1 - dt * 3); if (t > 0.35) return true; });
  W.scene.remove(dropped);
  sfx('splash'); hitstop(60);
  burst(POT.x, TOP + 1.3, POT.z, 16, '#d9ecf5', { up: 4 });
  K.potBroth.material.color.set(base.color);
  clearItems();

  // simmer: hold the knob to raise the flame, keep the needle in the band; tap the scum
  await hint('👆', 'Hold the red knob for heat · tap the grey scum');
  help('Keep the simmer in the green band. Tap the scum to skim it.');
  K.pickables = [K.knob];
  const LO = 0.45, HI = 0.72, DUR = 10;
  let inZone = 0, scumSpawned = 0, skimmed = 0;
  const scum = [];
  const r = await run((dt, t, evs) => {
    const holding = P.down && K.holdingKnob;
    for (const e of evs) {
      if (e.type === 'down') {
        K.holdingKnob = pickAt(e.x, e.y, [K.knob]) === K.knob;
        if (!K.holdingKnob) {
          const s = pickAt(e.x, e.y, scum.filter(s => s.visible));
          if (s) { s.visible = false; skimmed++; sfx('pop'); burst(s.position.x, s.position.y, s.position.z, 6, '#b8b0a0', { up: 2, speed: 1.5 }); pop('Skim!', e.x, e.y - 30); }
        }
      }
      if (e.type === 'up') K.holdingKnob = false;
    }
    K.heat = clamp(K.heat + (holding ? 0.6 : -0.22) * dt, 0, 1);
    K.knob.rotation.y = -K.heat * 2.4;
    if (K.heat >= LO && K.heat <= HI) inZone += dt;
    gauge(K.heat, LO, HI, K.heat > HI ? 'Too hot!' : K.heat < LO ? 'Too cold' : 'Simmer ✓');
    // bubbles show the heat
    if (Math.random() < K.heat * 0.5) burst(POT.x + (Math.random() - 0.5) * 1.6, TOP + 1.16, POT.z + (Math.random() - 0.5) * 1.6, 1, '#ffffff', { r: 0.06, up: 0.6 + K.heat * 2, speed: 0.2, g: 2, life: 0.4 });
    if (K.heat > HI && Math.random() < dt * 3) { addTrauma(0.08); sfx('sizzle'); }
    // scum rises every ~1.6 s
    if (t > 1 + scumSpawned * 1.6 && scumSpawned < 5) {
      const s = mesh(new THREE.SphereGeometry(0.22, 10, 8), '#b8b0a0', POT.x + (Math.random() - 0.5) * 1.3, TOP + 1.17, POT.z + (Math.random() - 0.5) * 1.3, { ink: false });
      s.scale.y = 0.35; s.userData.pick = 'scum';
      scum.push(s); K.items.push(s); scumSpawned++;
    }
    if (t > DUR || G.skip) return true;
  });
  gauge(null);
  st.heat = K.heat;
  st.brothScore = clamp(inZone / (DUR - 1.5), 0, 1) * 0.7 + (scumSpawned ? skimmed / scumSpawned : 1) * 0.3;
  clearItems();
  await stamp(st.brothScore);
}

async function stepSlice(st) {
  focus('slice');
  setStep(1, '2 · Slice it thin', 'Swipe DOWN through the meat on each dotted line.');
  // the slab and its guide lines
  const slab = mesh(new THREE.BoxGeometry(2.4, 0.4, 1.2), '#f2949a', BOARD.x, TOP + 0.38, BOARD.z);
  for (let i = 0; i < 3; i++) { const f = mesh(new THREE.BoxGeometry(2.42, 0.06, 0.06), '#fff3f0', BOARD.x, TOP + 0.4, BOARD.z - 0.35 + i * 0.35, { ink: false }); f.userData.noShadow = true; K.items.push(f); }
  K.items.push(slab);
  const LINES = 6, x0 = BOARD.x - 0.95, gap = 0.38;
  const guides = [];
  for (let i = 0; i < LINES; i++) {
    const gm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 1.25), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
    gm.position.set(x0 + i * gap, TOP + 0.4, BOARD.z);
    W.scene.add(gm); K.items.push(gm); guides.push({ x: x0 + i * gap, m: gm, cut: false });
  }
  const knife = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.06, 0.7, 1.5), '#dfe3e8', 0, 0.35, 0, { parent: knife });
  mesh(new THREE.BoxGeometry(0.12, 0.25, 0.8), '#8a5a3b', 0, 0.75, 0.9, { parent: knife });
  place(knife, BOARD.x + 1.6, BOARD.z, TOP + 0.9);
  await hint('👇', 'Swipe down to chop!');
  const scores = [];
  let down = null;
  await run((dt, t, evs) => {
    const p = planeAt(P.x, P.y, TOP + 0.4);
    const kx = clamp(p.x, BOARD.x - 1.4, BOARD.x + 1.6);
    knife.position.x += (kx - knife.position.x) * Math.min(1, dt * 20);
    for (const e of evs) {
      if (e.type === 'down') down = { y: e.y, x: knife.position.x };
      if (e.type === 'up' && down) {
        const swipe = e.dy > 40;
        if (swipe) {
          const x = knife.position.x;
          const g = guides.filter(g => !g.cut).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
          if (g && Math.abs(g.x - x) < gap * 0.6) {
            g.cut = true; g.m.visible = false;
            const acc = clamp(1 - Math.abs(g.x - x) / (gap * 0.5), 0, 1);
            scores.push(acc);
            // a slice falls over onto the board
            const sl = mesh(new THREE.BoxGeometry(0.08, 0.38, 1.18), '#f7a8a8', g.x + 0.12, TOP + 0.38, BOARD.z);
            K.items.push(sl);
            let tt = 0;
            addTicker(d => { tt += d; sl.rotation.z = -Math.min(1, tt * 5) * 1.35; sl.position.y = TOP + 0.38 - Math.min(1, tt * 5) * 0.16; sl.position.x = g.x + 0.12 + Math.min(1, tt * 5) * 0.15; return tt > 0.3; });
            knife.position.y = TOP + 0.4;
            setTimeout(() => { knife.position.y = TOP + 0.9; }, 90);
            sfx('whack'); hitstop(45); addTrauma(0.12);
            burst(g.x, TOP + 0.6, BOARD.z, 5, '#f7a8a8', { up: 2, speed: 1.4, r: 0.05 });
            const s = toScreen(g.x, TOP + 1.2, BOARD.z);
            pop(acc > 0.85 ? 'Perfect!' : acc > 0.5 ? 'Good' : 'Thick…', s.x, s.y, acc > 0.85 ? 'gold' : '');
          } else { sfx('bump'); }
        }
        down = null;
      }
    }
    if (guides.every(g => g.cut) || G.skip || t > 20) return true;
  });
  st.slice = scores.length ? scores.reduce((a, b) => a + b, 0) / LINES : 0;
  clearItems();
  await stamp(st.slice);
}

async function stepEgg(st) {
  focus('eggs');
  setStep(2, '3 · Quail eggs', 'Tap when the egg is right over the bowl!');
  K.bowlBroth.visible = true;
  K.bowlBroth.material.color.set(SLOTS[0].options.find(o => o.id === st.broth).color);
  const egg = new THREE.Group();
  const shell = mesh(new THREE.SphereGeometry(0.2, 14, 12), '#f6ecd8', 0, 0, 0, { parent: egg });
  shell.scale.y = 1.25;
  for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.03, 6, 5), '#8a6a4a', Math.cos(i * 2) * 0.17, (i % 3 - 1) * 0.12, Math.sin(i * 2) * 0.17, { parent: egg, ink: false });
  place(egg, BOWL.x, BOWL.z, TOP + 2.4);
  await hint('👆', 'Tap at the right moment');
  const results = [];
  let phase = 0;
  await run((dt, t, evs) => {
    const sw = Math.sin(t * 2.4 + phase) * 2.1;
    egg.position.x = BOWL.x + sw;
    egg.rotation.z = -Math.cos(t * 2.4 + phase) * 0.4;
    for (const e of evs) if (e.type === 'down') {
      const off = Math.abs(sw);
      const good = off < 0.45, ok = off < 0.9;
      results.push(good ? 1 : ok ? 0.6 : 0);
      if (ok) {
        // crack: the egg drops in and a yolk appears in the bowl
        const yolk = TOPPING_ART.egg(); yolk.scale.setScalar(0.8);
        yolk.position.set((results.length - 1.5) * 0.45, 0.02, 0.15);
        K.bowlStuff.add(yolk);
        sfx('splash'); hitstop(50);
        burst(BOWL.x + yolk.position.x, TOP + 0.6, BOWL.z, 8, '#fff3c4', { up: 2.5 });
      } else { sfx('fail'); burst(egg.position.x, TOP + 0.4, BOWL.z, 10, '#fff3c4', { up: 1.5 }); }
      const s = toScreen(egg.position.x, egg.position.y + 0.5, BOWL.z);
      pop(good ? 'Perfect!' : ok ? 'Good' : 'Splat!', s.x, s.y, good ? 'gold' : '');
      phase += 1.3;
    }
    if (results.length >= 2 || G.skip || t > 14) return true;
  });
  st.egg = results.length ? results.reduce((a, b) => a + b, 0) / 2 : 0;
  clearItems();
  await stamp(st.egg);
}

async function stepNoodles(st) {
  focus('noodles');
  setStep(3, '4 · Rice noodles', 'Stir in circles so they don’t stick, then LIFT the basket in the green.');
  const basket = new THREE.Group();
  mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 32).rotateX(Math.PI / 2), '#9aa0a8', 0, 0, 0, { parent: basket });
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6).rotateZ(Math.PI / 2.4), '#8a5a3b', 1.2, 0.5, 0, { parent: basket });
  const tangle = mesh(new THREE.TorusKnotGeometry(0.5, 0.08, 96, 8, 3, 7), '#fffaf0', 0, 0, 0, { parent: basket, ink: false });
  tangle.scale.y = 0.35;
  place(basket, POT.x, POT.z, TOP + 1.12);
  basket.userData.pick = 'basket';
  K.pickables = [basket];
  await hint('🔄', 'Stir, then drag the basket UP');
  const DONE_AT = 8.5, LO = 0.68, HI = 0.88;
  let laps = 0, last = null, lifted = null, stirScore = 0;
  const center = toScreen(POT.x, TOP + 1.1, POT.z);
  await run((dt, t, evs) => {
    const cook = t / DONE_AT * 0.86;
    K.cook = cook;
    gauge(Math.min(1, cook), LO, HI, cook < LO ? 'Cooking…' : cook <= HI ? 'LIFT NOW!' : 'Too soft!');
    for (const e of evs) if (e.type === 'up' && e.dy < -50 && pickAt(e.x - e.dx, e.y - e.dy, [basket])) lifted = cook;
    if (P.down && lifted === null) {
      const a = Math.atan2(P.y - center.y, P.x - center.x), d = Math.hypot(P.y - center.y, P.x - center.x);
      if (last !== null && d > 30) {
        let da = a - last; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 1) { laps += Math.abs(da) / (Math.PI * 2); tangle.rotation.y += da; if (Math.random() < 0.3) note(330 + (laps * 120) % 400, 0.06, 'triangle', 0.08); }
      }
      last = a;
    } else last = null;
    stirScore = clamp(laps / 3, 0, 1);
    if (lifted !== null || G.skip || t > DONE_AT * 1.6) return true;
  });
  gauge(null);
  if (lifted === null) lifted = 1;
  // the lift: drip!
  await run((dt, t) => { basket.position.y = TOP + 1.12 + Math.min(1, t * 3) * 1.4; if (Math.random() < 0.5) burst(POT.x, basket.position.y - 0.2, POT.z, 1, '#d9ecf5', { up: 0, speed: 0.4, r: 0.05 }); if (t > 0.6) return true; });
  const timing = lifted >= LO && lifted <= HI ? 1 : clamp(1 - Math.min(Math.abs(lifted - LO), Math.abs(lifted - HI)) * 4, 0, 1);
  st.noodles = timing * 0.75 + stirScore * 0.25;
  clearItems();
  await stamp(st.noodles);
}

async function stepOil(st) {
  focus('oil');
  setStep(4, '5 · The oil layer', 'Drag a jar to the bowl.');
  const slot = SLOTS[1];
  const COL = { none: '#dddddd', chilli: '#c0281e', fat: '#f2c14e' };
  const choices = slot.options.map((o, i) => {
    const obj = o.id === 'none' ? (() => { const g = new THREE.Group(); mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 20).rotateX(Math.PI / 2), '#b9b0a6', 0, 0.1, 0, { parent: g }); return g; })() : jar(COL[o.id]);
    obj.userData.pick = o.id;
    obj.userData.locked = !hasOption(slot, o);
    if (obj.userData.locked) obj.traverse(m => { if (m.isMesh && m.material.color) m.material = mat('#b9b0a6'); });
    const x = KX + 2.4 + i * 1.2, z = KZ + 1.4;
    place(obj, x, z); K.pickables.push(obj);
    return { obj, x, z };
  });
  const id = await dragInto(choices, BOWL, 1.1);
  st.oil = id;
  const jarObj = choices.find(c => c.obj.userData.pick === id).obj;
  for (const c of choices) if (c.obj !== jarObj) W.scene.remove(c.obj);
  if (id === 'none') { st.oilScore = 0.5; clearItems(); await stamp(0.5); return; }
  // pour: hold anywhere; let go inside the band
  jarObj.position.set(BOWL.x + 0.9, TOP + 1.5, BOWL.z - 0.3);
  jarObj.rotation.z = 0.9;
  K.oilLayer.material.color.set(COL[id]);
  await hint('✋', 'Hold to pour · let go in the band');
  help('Hold to pour. Let go when the layer is in the green band.');
  const LO = 0.55, HI = 0.75;
  let amount = 0, started = false, done = false;
  await run((dt, t, evs) => {
    for (const e of evs) { if (e.type === 'down') started = true; if (e.type === 'up' && started) done = true; }
    if (P.down && started) {
      amount += dt * 0.42;
      jarObj.rotation.z = 0.9 + 0.6;
      if (Math.random() < 0.7) burst(BOWL.x + 0.55, TOP + 1.3, BOWL.z - 0.3, 1, COL[id], { up: -1, speed: 0.1, g: 6, r: 0.05, life: 0.35 });
      if (Math.random() < 0.15) note(200 + amount * 300, 0.08, 'sine', 0.06);
    } else jarObj.rotation.z += (0.9 - jarObj.rotation.z) * dt * 8;
    K.oilLayer.material.opacity = Math.min(0.85, amount * 0.9);
    gauge(amount, LO, HI, amount < LO ? 'More…' : amount <= HI ? 'Stop!' : 'Too much!');
    if (done || amount > 1.1 || G.skip || t > 12) return true;
  });
  gauge(null);
  st.oilScore = amount >= LO && amount <= HI ? 1 : clamp(1 - Math.min(Math.abs(amount - LO), Math.abs(amount - HI)) * 3, 0, 1);
  clearItems();
  await stamp(st.oilScore);
}

const BRIDGE_ORDER = ['meat', 'egg', 'veg', 'noodles'];   // raw first, noodles last: across the bridge

async function stepBuild(st) {
  focus('build');
  setStep(5, '6 · Build the bowl', 'Drag each dish into the bowl, in the ticket’s order. Quick, before it cools!');
  const top = SLOTS[2];
  const bins = [
    { id: 'meat', art: 'meat', label: 'Meat' },
    { id: 'egg', art: 'egg', label: 'Eggs' },
    ...top.options.filter(o => hasOption(top, o)).map(o => ({ id: `top:${o.id}`, art: o.id, label: o.name, veg: true })),
    { id: 'noodles', art: 'noodles', label: 'Noodles' },
    ...EXTRAS.map(x => ({ id: `extra:${x.id}`, art: x.id, label: x.name, extra: true })),
  ];
  const ticket = hud.querySelector('.k3-ticket');
  ticket.classList.remove('hidden');
  ticket.innerHTML = `<b>Order of the bridge</b><ol><li>Raw meat</li><li>Quail eggs</li><li>Something green</li><li>Noodles last</li></ol><small>Hot broth cooks them on the way across.</small>`;
  const choices = bins.map((b, i) => {
    const obj = dish(TOPPING_ART[b.art] || TOPPING_ART.chives);
    obj.userData.pick = b.id;
    const row = i < 6 ? 0 : 1, col = row ? i - 6 : i;
    const x = KX - 4.6 + col * 1.25 + (row ? 1.9 : 0), z = KZ - 1.5 + row * 1.25;
    place(obj, x, z); K.pickables.push(obj);
    return { obj, x, z, b };
  });
  st.added = []; st.extras = [];
  K.heatBowl = 1;
  await hint('🥢', 'Drag in order, then tap SERVE');
  const serve = document.createElement('button');
  serve.className = 'btn-big k3-serve';
  serve.textContent = 'Serve 🍜';
  hud.appendChild(serve);
  let served = false;
  serve.addEventListener('click', () => { served = true; });
  await run((dt, t, evs) => {
    K.heatBowl = Math.max(0, K.heatBowl - dt * 0.035);
    gauge(K.heatBowl, 0.4, 1, K.heatBowl > 0.4 ? 'Hot ♨' : 'Cooling!');
    for (const e of evs) {
      if (e.type === 'down') { const o = pickAt(e.x, e.y, choices.filter(c => !c.used).map(c => c.obj)); if (o) { K.drag = o; sfx('pop'); } }
      if (e.type === 'up' && K.drag) {
        const o = K.drag; K.drag = null;
        const c = choices.find(c => c.obj === o);
        if (Math.hypot(o.position.x - BOWL.x, o.position.z - BOWL.z) < 1.2) {
          c.used = true;
          W.scene.remove(o);
          const art = (TOPPING_ART[c.b.art] || TOPPING_ART.chives)();
          art.position.set((Math.random() - 0.5) * 0.7, 0.02 + st.added.length * 0.02, (Math.random() - 0.5) * 0.5);
          K.bowlStuff.add(art);
          if (c.b.extra) { st.extras.push(c.b.id.split(':')[1]); K.gran.setFace('shock'); emote(K.gran, '💢', 1.2); sfx('fail'); }
          else { st.added.push(c.b.id); sfx('splash'); }
          burst(BOWL.x, TOP + 0.8, BOWL.z, 8, '#f2c46d', { up: 2 });
          const s = toScreen(BOWL.x, TOP + 1.4, BOWL.z);
          pop(c.b.extra ? 'Too much!' : `+ ${c.b.label}`, s.x, s.y, c.b.extra ? 'bad' : '');
        } else sfx('bump');
      }
    }
    for (const c of choices) {
      if (c.used) continue;
      const o = c.obj;
      if (o === K.drag) {
        const p = planeAt(P.x, P.y, TOP + 0.9);
        o.position.lerp(new THREE.Vector3(p.x, TOP + 0.9, p.z), Math.min(1, dt * 18));
      } else o.position.lerp(new THREE.Vector3(c.x, TOP, c.z), Math.min(1, dt * 10));
    }
    if (served || G.skip || t > 60) return true;
  });
  serve.remove();
  ticket.classList.add('hidden');
  gauge(null);
  st.heat = K.heatBowl;
}

function orderScore(added) {
  const kinds = added.map(a => (a.startsWith('top:') ? 'veg' : a));
  const want = BRIDGE_ORDER;
  let s = 0;
  for (let i = 0; i < want.length; i++) if (kinds[i] === want[i]) s++;
  return s / want.length;
}
function toppingPick(added) {
  const t = added.find(a => a.startsWith('top:'));
  return t ? t.split(':')[1] : null;
}

async function stepTaste(st) {
  setStep(6, '7 · Grandma tastes', '');
  const pick = { broth: st.broth, oil: st.oil, top: toppingPick(st.added) };
  const fb = {
    broth: SLOTS[0].options.find(o => o.id === pick.broth),
    oil: SLOTS[1].options.find(o => o.id === pick.oil),
    top: pick.top ? SLOTS[2].options.find(o => o.id === pick.top) : { verdict: 'close', fb: 'Plain… something green is missing.' },
  };
  const greens = ['broth', 'oil', 'top'].filter(k => fb[k].verdict === 'good').length;
  const skill = {
    'Simmer & skim': st.brothScore,
    'Slicing': st.slice,
    'Quail eggs': st.egg,
    'Noodles': st.noodles,
    'Oil layer': st.oilScore,
    'Order of the bridge': orderScore(st.added),
    'Served hot': clamp((st.heat - 0.2) / 0.7, 0, 1),
  };
  const skillAvg = Object.values(skill).reduce((a, b) => a + b, 0) / Object.keys(skill).length;
  const recipe = greens / 3 * (st.extras.length ? 0.6 : 1);
  const total = Math.round((skillAvg * 0.5 + recipe * 0.5) * 100);
  const medal = total >= 95 ? ['🥇', 'Gold · Better than Grandma!'] : total >= 80 ? ['🥈', 'Silver'] : total >= 55 ? ['🥉', 'Bronze'] : ['👵', 'Grandma fixed it'];
  // Grandma comes round, tastes, and reacts
  const g = K.gran;
  K.granBusy = true;
  player.camShot = { pos: { x: BOWL.x - 1.4, y: 4.4, z: BOWL.z + 7.2 }, look: { x: BOWL.x - 0.6, y: 2.0, z: BOWL.z - 0.6 }, speed: 2.5 };
  await new Promise(res => {
    addTicker(dt => {
      const p = g.root.position, tx = BOWL.x, tz = KZ - 3.9;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.2 || G.skip) { res(); return true; }
      p.x += dx / d * 3.5 * dt; p.z += dz / d * 3.5 * dt;
      g.root.rotation.y = Math.atan2(dx, dz);
      g.animate(dt, 3.5, performance.now() / 1000);
    });
  });
  g.root.rotation.y = 0;
  act(g, 'eat');
  sfx('sizzle');
  await beat(1.6);
  act(g, null);
  const face = total >= 80 ? 'cry' : total >= 55 ? 'happy' : 'shock';
  g.setFace(face);
  emote(g, total >= 80 ? '😭' : total >= 55 ? '😋' : '😵', 1.8);
  if (total >= 80) act(g, 'bounce'); else if (total >= 55) act(g, 'chuckle');
  sfx(total >= 80 ? 'reveal' : total >= 55 ? 'ding' : 'fail');
  await beat(1.8);
  act(g, null);
  // the ticket
  const bar = v => `<div class="bar"><div class="fill" style="width:${Math.round(v * 100)}%; background:${v >= 0.7 ? '#49b26a' : v >= 0.45 ? '#f0b429' : '#e2574c'}"></div></div>`;
  const dot = v => (v === 'good' ? '🟢' : v === 'close' ? '🟡' : '🔴');
  const card = document.createElement('div');
  card.className = 'k3-result';
  card.innerHTML = `<div class="k-ticket">
    <div class="row" style="justify-content:space-between"><b>${medal[0]} ${medal[1]}</b><span class="k-total">${total}%</span></div>
    ${Object.entries(skill).map(([k, v]) => `<div class="meter"><span style="width:150px; font-size:13px">${k}</span>${bar(v)}</div>`).join('')}
    <h3>Taste</h3>
    ${['broth', 'oil', 'top'].map(k => `<div class="fb ${fb[k].verdict}">${dot(fb[k].verdict)} ${esc(fb[k].fb)}</div>`).join('')}
    ${st.extras.length ? '<div class="fb bad">🔴 Too much! It tastes like that Wang’s bowl!</div>' : ''}
    <div class="row" style="justify-content:flex-end; margin-top:10px"><button class="btn-big" id="k-done">Continue</button></div>
  </div>`;
  hud.appendChild(card);
  await new Promise(res => card.querySelector('#k-done').addEventListener('click', res));
  return { greens, perfect: greens === 3 && st.extras.length === 0, extras: st.extras, pick, skill, total, medal: medal[1] };
}

// ============================================================ entry

// Each step frames its own station (Cooking Mama zooms to the board, the pot…).
const STATIONS = {
  all: { x: KX - 1.3, z: KZ - 0.4, w: 8.1, h: 3.6 },
  broth: { x: KX - 1.4, z: KZ - 0.2, w: 3.9, h: 2.7 },
  slice: { x: BOARD.x, z: BOARD.z, w: 2.6, h: 2.0 },
  eggs: { x: BOWL.x, z: BOWL.z - 0.4, w: 2.9, h: 2.6 },
  noodles: { x: POT.x, z: POT.z, w: 2.6, h: 2.4 },
  oil: { x: KX + 2.4, z: KZ + 0.6, w: 3.3, h: 2.4 },
  build: { x: KX - 1.5, z: KZ - 0.3, w: 4.4, h: 2.6 },
};
let station = 'all';
function focus(name, snap = false) {
  station = name;
  frameCounter(snap);
  const st = STATIONS[name];
  K.granTarget = { x: clamp(st.x - 1.6, KX - 6, KX + 5), z: KZ - 3.6 };
}

function frameCounter(snap = true) {
  const aspect = innerWidth / innerHeight;
  const fov = aspect < 0.8 ? 58 : 40;
  const s = STATIONS[station] || STATIONS.all;
  const look = new THREE.Vector3(s.x, TOP + 0.4, s.z);
  const dir = new THREE.Vector3(0, 7.2, 8.6).normalize();       // a warm 3/4 view: faces, not the tops of heads
  const halfW = s.w, halfH = s.h;
  const tv = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const dist = Math.max(halfH / tv, halfW / (tv * aspect)) * 1.05;
  const pos = look.clone().addScaledVector(dir, dist);
  player.camShot = { pos: { x: pos.x, y: pos.y, z: pos.z }, look: { x: look.x, y: look.y, z: look.z }, speed: snap === true ? 99 : 3.2 };
  player.fovShot = fov;
  if (snap === true) { W.camera.fov = fov; W.camera.updateProjectionMatrix(); updateCamera(1); }
}

export async function cookBowl() {
  buildSet();
  K.live = true;
  K.heat = 0.2;
  K.bowlBroth.visible = false;
  K.oilLayer.material.opacity = 0;
  K.bowlStuff.clear();
  K.gran.root.position.set(KX - 1.5, 0.45, KZ - 3.6);
  K.gran.root.rotation.y = 0;
  K.gran.setFace('happy');
  K.granBusy = false;
  act(K.gran, 'idle');
  G.busy++;
  const light = { hemi: W.hemi.intensity, sun: W.sun.intensity };   // indoors: always lamp-lit, even at night
  W.hemi.intensity = 1.25; W.sun.intensity = 1.6;
  const prevFocus = player.camFocus;
  player.camFocus = { x: KX, z: KZ };
  player.char.root.visible = false;
  focus('broth', true);
  addEventListener('resize', frameCounter);
  const cv = W.renderer.domElement;
  cv.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  makeHud();
  G.skip = false;
  const st = {};
  try {
    await stepBroth(st);
    await stepSlice(st);
    await stepEgg(st);
    await stepNoodles(st);
    await stepOil(st);
    await stepBuild(st);
    return await stepTaste(st);
  } finally {
    K.live = false;
    clearItems();
    stopActing();
    cv.removeEventListener('pointerdown', onDown);
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerup', onUp);
    removeEventListener('resize', frameCounter);
    hud.remove();
    document.body.classList.remove('cooking');
    player.camShot = null;
    player.fovShot = null;
    player.camFocus = prevFocus;
    player.char.root.visible = true;
    W.hemi.intensity = light.hemi; W.sun.intensity = light.sun;
    G.busy--;
  }
}

// dev/test hook: where things are on screen
window.__kitchen = { toScreen, POT, BOWL, BOARD, KNOB, TOP, P, get K() { return K; } };
