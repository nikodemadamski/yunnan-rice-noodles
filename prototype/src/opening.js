// The opening, cut like a short film (cinematography notes in
// docs/design/OPENING.md):
//   ACT 1 · memory: golden Kunming, Grandpa Zhao and the bowl. Show the love first.
//   ACT 2 · Dublin: grey, rain, silence; the bowl on his monitor (a match cut),
//          a slow push-in on his face, then PERMANENTLY CLOSED, a hit-zoom,
//          one beat of silence, "WHAT?!", the boss in shot / reverse-shot, the sprint.
//   ACT 3 · the flight, with the AI's "perfect" recipe.
// Shots are 1.5–3 s, cut on action, reactions held; almost no text on screen.

import { tasteMoment } from './taste.js';
import * as THREE from 'three';
import { G, addTicker } from './core.js';
import { W, makeSign, setNight } from './world.js';
import { makeCharacter, mat, toon, outline } from './characters.js';
import { player, teleport, updateCamera } from './player.js';
import { SP } from './npcs.js';
import { say, talk, fadeIn, fadeOut, beat, openPanel, closePanel, emote, bark, cutscene, hideDialogue } from './ui.js';
import { sfx, setMusic, setRain, note } from './audio.js';
import { addTrauma, hitstop } from './fx.js';
import { act, stopActing } from './acting.js';

const OX = 400, OZ = 400;           // the Dublin office set, far outside the town
const MX = 600, MZ = 400;           // the memory set
const MON = { x: OX - 3.0, z: OZ - 1.35, ry: 0.59 };
// the insert shot: straight down the monitor's normal
const INSERT = { x: MON.x + Math.sin(MON.ry) * 1.7, y: 2.2, z: MON.z + Math.cos(MON.ry) * 1.7 };
const SCREEN = { x: MON.x, y: 2.2, z: MON.z };
const HERO_H = -2.55;               // he faces the monitor
let built = null, memory = null;

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  W.scene.add(m);
  return m;
}

// ---------- the monitor: a dull spreadsheet, then the photo, then the stamp ----------

const screen = { mode: 'work', stamp: 0 };
let scr = null;

function bowlArt(g, cx, cy, r) {
  g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(cx + 6, cy + 10, r * 1.08, r * 0.98, 0, 0, 7); g.fill();
  g.fillStyle = '#f7f3ec'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.strokeStyle = '#3a6ea5'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(cx, cy, r * 0.93, 0, 7); g.stroke();
  const broth = g.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r * 0.8);
  broth.addColorStop(0, '#ffe2a0'); broth.addColorStop(1, '#e8b25a');
  g.fillStyle = broth; g.beginPath(); g.arc(cx, cy, r * 0.8, 0, 7); g.fill();
  g.strokeStyle = '#fffaf0'; g.lineWidth = 5;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx - r * 0.15 + i * 6, cy + r * 0.1, r * (0.25 + i * 0.05), 3.6, 5.6); g.stroke(); }
  g.fillStyle = '#f7a8a8';
  for (let i = 0; i < 4; i++) { g.save(); g.translate(cx + Math.cos(i * 1.6) * r * 0.45, cy + Math.sin(i * 1.6) * r * 0.45); g.rotate(i); g.fillRect(-r * 0.14, -r * 0.07, r * 0.28, r * 0.14); g.restore(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + r * 0.25, cy - r * 0.3, r * 0.13, 0, 7); g.fill();
  g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(cx + r * 0.25, cy - r * 0.3, r * 0.07, 0, 7); g.fill();
  g.fillStyle = '#4caf50';
  for (let i = 0; i < 9; i++) g.fillRect(cx - r * 0.4 + (i * 37) % (r * 0.8), cy - r * 0.05 + (i * 23) % (r * 0.4), 7, 3);
}

function drawScreen() {
  const g = scr.ctx, w = 512, h = 300;
  if (screen.mode === 'work') {                        // Q3_synergy_FINAL_v7: the most boring grid alive
    g.fillStyle = '#eef0f3'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f7d4f'; g.fillRect(0, 0, w, 26);
    g.fillStyle = '#fff'; g.font = '800 14px Nunito, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('Q3_synergy_FINAL_v7(2).xlsx', 10, 13);
    g.strokeStyle = '#cfd5dc'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x, h); g.stroke(); }
    for (let y = 26; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#9aa3ad';
    for (let r = 0; r < 14; r++) for (let c = 0; c < 8; c++) if ((r * 7 + c * 3) % 5) g.fillRect(c * 64 + 8, 32 + r * 18, 20 + ((r * c) % 4) * 8, 6);
  } else {                                             // the photo: Kunming, warm, the bowl
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#ffcf8a'); sky.addColorStop(1, '#ff9f6b');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(420, 70, 46, 0, 7); g.fill();
    g.fillStyle = '#c0392b'; for (const x of [60, 140, 380, 460]) { g.beginPath(); g.ellipse(x, 40, 16, 20, 0, 0, 7); g.fill(); }
    bowlArt(g, 256, 160, 110);
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(220 + i * 36, 50 - i * 6, 10, 22, 0.3, 0, 7); g.fill(); }
    g.fillStyle = '#fffaf0'; g.font = '900 20px Nunito, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('老赵过桥米线', 16, h - 22);
  }
  if (screen.stamp > 0) {
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.18);
    const s = 1 + Math.max(0, 1 - screen.stamp) * 2;
    g.scale(s, s);
    g.strokeStyle = '#e2241b'; g.lineWidth = 8; g.fillStyle = 'rgba(255,255,255,0.88)';
    g.beginPath(); g.roundRect(-200, -46, 400, 92, 12); g.fill(); g.stroke();
    g.fillStyle = '#e2241b'; g.font = '900 38px Nunito, sans-serif'; g.textAlign = 'center';
    g.fillText('PERMANENTLY CLOSED', 0, 3);
    g.restore();
  }
  scr.tex.needsUpdate = true;
}

// ---------- the set ----------

function buildOffice() {
  if (built) return built;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), mat('#d9b48a'));
  floor.rotation.x = -Math.PI / 2; floor.position.set(OX, 0.02, OZ); floor.receiveShadow = true;
  W.scene.add(floor);
  box(18, 6, 0.3, '#f6e9d6', OX, 3, OZ - 6);          // back wall
  box(0.3, 6, 12, '#f0e0ca', OX - 9, 3, OZ);          // left wall
  box(0.3, 6, 12, '#f0e0ca', OX + 9, 3, OZ);          // right wall
  box(18.6, 0.3, 12.6, '#fbf5ec', OX, 6.1, OZ).castShadow = false;   // ceiling: no sky indoors
  // the front wall only exists from the inside: a plane facing into the room,
  // invisible to the wide shots looking in from outside
  const front = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), mat('#f0e0ca'));
  front.rotation.y = Math.PI; front.position.set(OX, 3, OZ + 6);
  W.scene.add(front);
  // a rainy window
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), new THREE.MeshBasicMaterial({ color: '#56677d' }));
  win.position.set(OX - 2, 3.4, OZ - 5.84); W.scene.add(win);
  for (const [w, h, x, y] of [[7.3, 0.2, 0, 1.6], [7.3, 0.2, 0, -1.6], [0.2, 3.3, -3.6, 0], [0.2, 3.3, 3.6, 0], [0.12, 3, 0, 0]]) box(w, h, 0.2, '#f4f4f4', OX - 2 + x, 3.4 + y, OZ - 5.8);
  const rain = [];
  const rainMat = new THREE.MeshBasicMaterial({ color: '#c9d6e6', transparent: true, opacity: 0.6 });
  for (let i = 0; i < 40; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.35), rainMat);
    r.position.set(OX - 5.3 + Math.random() * 6.6, 2 + Math.random() * 2.8, OZ - 5.8);
    W.scene.add(r); rain.push(r);
  }
  // the desk, the monitor, the mug
  box(3.4, 0.15, 1.6, '#c8a27a', OX - 2, 1.35, OZ - 1.2);
  for (const dx of [-1.55, 1.55]) box(0.12, 1.3, 1.4, '#a8825a', OX - 2 + dx, 0.65, OZ - 1.2);
  // the monitor sits to one side, angled at him, so the camera can see his face
  const mon = new THREE.Group();
  mon.position.set(MON.x, 0, MON.z); mon.rotation.y = MON.ry;
  W.scene.add(mon);
  for (const [w, h, d, y] of [[1.8, 1.1, 0.12, 2.2], [0.15, 0.5, 0.15, 1.6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat('#efe9df'));
    m.position.y = y; m.castShadow = m.receiveShadow = true;
    mon.add(m);
  }
  const c = document.createElement('canvas'); c.width = 512; c.height = 300;
  scr = { canvas: c, ctx: c.getContext('2d'), tex: new THREE.CanvasTexture(c) };
  scr.tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.97), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  face.position.set(0, 2.2, 0.07); mon.add(face);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.3, 12), mat('#e94b3c'));
  mug.position.set(OX - 0.8, 1.58, OZ - 0.9); W.scene.add(mug);
  box(1, 0.06, 0.35, '#ddd', OX - 2, 1.45, OZ - 0.8);   // keyboard
  // chair
  box(1, 0.15, 1, '#3b4a6b', OX - 2, 0.9, OZ + 0.3);
  box(1, 1.1, 0.15, '#3b4a6b', OX - 2, 1.5, OZ + 0.85);
  // plant + second desk
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 12), mat('#c86b4a'));
  pot.position.set(OX - 7.5, 0.3, OZ - 4.8); W.scene.add(pot);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), mat('#5aa543'));
  leaves.position.set(OX - 7.5, 1.3, OZ - 4.8); W.scene.add(leaves);
  box(3.4, 0.15, 1.6, '#c8a27a', OX + 3.5, 1.35, OZ - 1.2);
  box(1.8, 1.1, 0.12, '#efe9df', OX + 3.5, 2.2, OZ - 1.6);
  const sign = makeSign(['GROWTH TEAM', 'Q3 · SYNERGY · AI-FIRST'], { bg: '#3b4a6b', w: 4, h: 1 });
  sign.position.set(OX + 4, 4.6, OZ - 5.8); W.scene.add(sign);
  // door
  box(0.2, 3.6, 1.8, '#8a6a4a', OX + 8.85, 1.8, OZ + 3);
  // people
  const boss = makeCharacter({ skin: '#f3c9a8', shirt: '#e8eef5', pants: '#3b4a6b', hair: '#6b4a2f', hairStyle: 'short', wide: 1.2, glasses: true });
  boss.root.position.set(OX + 5.5, 0.05, OZ + 2.5);
  boss.root.rotation.y = -2.2;
  W.scene.add(boss.root);
  const coworker = makeCharacter({ skin: '#e8bf95', shirt: '#9bd19b', pants: '#4a4f5a', hair: '#1a1a1a', hairStyle: 'long' });
  coworker.root.position.set(OX + 3.5, 0.05, OZ - 0.1);
  coworker.root.rotation.y = Math.PI;
  W.scene.add(coworker.root);
  addTicker(dt => {
    for (const r of rain) { r.position.y -= dt * 2.4; if (r.position.y < 2) r.position.y = 4.8; }
    if (screen.stamp > 0 && screen.stamp < 1) { screen.stamp = Math.min(1, screen.stamp + dt * 6); drawScreen(); }
  });
  box(3.4, 0.15, 1.6, '#c8a27a', OX - 6.2, 1.35, OZ + 3.0);
  const coworker2 = makeCharacter({ skin: '#f6d2b0', shirt: '#f4a6c0', pants: '#4a4f5a', hair: '#6b4a2f', hairStyle: 'bun' });
  coworker2.root.position.set(OX - 6.2, 0.05, OZ + 4.2);
  coworker2.root.rotation.y = Math.PI;
  W.scene.add(coworker2.root);
  built = { boss, coworker, coworker2 };
  SP.boss = { name: 'Boss', color: '#6b7c93', voice: 'spud', char: boss };
  return built;
}

// ---------- the memory set: Grandpa Zhao's table, golden hour ----------

function buildMemory() {
  if (memory) return memory;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), mat('#f3d6a8'));
  floor.rotation.x = -Math.PI / 2; floor.position.set(MX, 0.02, MZ);
  W.scene.add(floor);
  // the table and two stools
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 32), mat('#c98f5c'));
  top.position.set(MX, 1.02, MZ);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.0, 12), mat('#8a5a3b'));
  leg.position.set(MX, 0.5, MZ);
  W.scene.add(top, leg);
  outline(top, 1.03);
  // the bowl: a big blue-rimmed porcelain bowl of golden broth
  const bowl = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.48, 0.08], [0.6, 0.26], [0.64, 0.36]].map(([x, y]) => new THREE.Vector2(x, y)), 32), toon({ color: '#f7f3ec', side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.03, 8, 40).rotateX(Math.PI / 2), mat('#3a6ea5'));
  rim.position.y = 0.36;
  const broth = new THREE.Mesh(new THREE.CircleGeometry(0.58, 32).rotateX(-Math.PI / 2), toon({ color: '#f2c46d', emissive: '#7a4a10', emissiveIntensity: 0.25 }));
  broth.position.y = 0.3;
  bowl.add(shell, rim, broth);
  bowl.position.set(MX, 1.09, MZ);
  W.scene.add(bowl);
  // the raw ingredients wait on a little plate, then cross the "bridge" into the broth
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.05, 24), mat('#ffffff'));
  plate.position.set(MX + 0.75, 1.12, MZ + 0.35);
  W.scene.add(plate);
  const bits = [];
  const add = (geo, color, dx, dz, ry = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(MX + 0.75 + dx, 1.18, MZ + 0.35 + dz); m.rotation.y = ry;
    W.scene.add(m); bits.push(m); return m;
  };
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.22, 0.03, 0.12), '#f7a8a8', -0.12 + i * 0.1, -0.12 + i * 0.05, i);
  add(new THREE.SphereGeometry(0.07, 12, 10), '#fffaf0', 0.15, 0.12);
  for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5).rotateZ(Math.PI / 2), '#4caf50', -0.05 + i * 0.05, 0.18, i);
  // steam
  const steam = [];
  const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), steamMat.clone());
    p.userData.noShadow = true; p.userData.t = i / 9;
    W.scene.add(p); steam.push(p);
  }
  // red lanterns overhead on a cord
  for (const [dx, dz] of [[-2.2, -1.2], [0, -2], [2.2, -1.2]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), toon({ color: '#d8322a', emissive: '#ff5a2a', emissiveIntensity: 0.6 }));
    l.scale.y = 1.2; l.position.set(MX + dx, 3.9, MZ + dz);
    W.scene.add(l);
  }
  // Grandpa Zhao: chef's hat, white brows, the kindest face in Kunming
  const zhao = makeCharacter({ skin: '#f0c8a0', shirt: '#ffffff', pants: '#5a4a3a', hair: '#efefef', hairStyle: 'bald', hat: 'chef', brows: true, wide: 1.12, prop: 'ladle' });
  zhao.root.position.set(MX, 0.05, MZ - 1.55);
  W.scene.add(zhao.root);
  SP.zhao = { name: 'Grandpa Zhao', color: '#c98a3a', voice: 'ji', char: zhao };
  let dropT = -1;
  addTicker(dt => {
    for (const p of steam) {
      p.userData.t = (p.userData.t + dt * 0.35) % 1;
      const k = p.userData.t;
      p.position.set(MX + Math.sin(k * 6 + p.id) * 0.18, 1.5 + k * 1.6, MZ + Math.cos(k * 5 + p.id) * 0.15);
      p.scale.setScalar(0.6 + k * 2.2);
      p.material.opacity = 0.32 * Math.sin(k * Math.PI);
    }
    if (dropT >= 0) {                                   // ingredients arc in, one by one
      dropT += dt;
      bits.forEach((b, i) => {
        const k = Math.min(1, Math.max(0, (dropT - i * 0.12) / 0.45));
        if (!b.userData.from) b.userData.from = b.position.clone();
        const f = b.userData.from;
        const tx = MX + Math.cos(i * 1.7) * 0.32, tz = MZ + Math.sin(i * 1.7) * 0.32;
        b.position.set(f.x + (tx - f.x) * k, f.y + Math.sin(k * Math.PI) * 0.5 + (1.4 - f.y) * k, f.z + (tz - f.z) * k);
        if (k >= 1 && !b.userData.plop) { b.userData.plop = true; if (i % 3 === 0) sfx('sizzle'); }
      });
    }
  });
  // a living street corner: house fronts, neighbours eating, people strolling past
  const HOUSES = [['#ffd9de', '#e8735a'], ['#fff0b8', '#5fa8d3'], ['#d6f0dd', '#c7697f'], ['#d8e8ff', '#79b86e']];
  HOUSES.forEach(([wall, roof], i) => {
    const x = MX - 11 + i * 7.3, h = 6 + (i % 2) * 1.5;
    box(6.6, h, 2, wall, x, h / 2, MZ - 9);
    const r = new THREE.Mesh(new THREE.ConeGeometry(4.9, 2.4, 4).rotateY(Math.PI / 4), mat(roof));
    r.scale.set(1, 1, 0.45); r.position.set(x, h + 1.2, MZ - 9);
    W.scene.add(r);
    for (const wx of [-1.6, 1.6]) {
      box(1.3, 1.4, 0.1, '#8fc6e8', x + wx, h - 2, MZ - 7.95);
      box(1.5, 0.25, 0.3, '#c9785a', x + wx, h - 2.8, MZ - 7.85);
    }
    box(1.6, 2.6, 0.1, '#a8754a', x, 1.3, MZ - 7.95);
  });
  const neighbours = [];
  for (const [tx, tz, n] of [[-5, -1.8, 2], [5.2, -2.4, 1], [-4.2, 3.6, 1]]) {
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 24), mat('#c98f5c'));
    t2.position.set(MX + tx, 0.95, MZ + tz);
    const l2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 10), mat('#8a5a3b'));
    l2.position.set(MX + tx, 0.45, MZ + tz);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.24, 20), mat('#f7f3ec'));
    b2.position.set(MX + tx, 1.13, MZ + tz);
    W.scene.add(t2, l2, b2);
    for (let k = 0; k < n; k++) {
      const side = k ? -1 : 1;
      const c = makeCharacter({ skin: ['#f2cfae', '#e8bf95', '#f6d2b0'][k % 3], shirt: ['#7fb3e6', '#f4a6c0', '#9bd19b'][(tx > 0) + k], pants: '#4a4f5a', hair: '#5a3a28', hairStyle: ['short', 'long', 'bun'][(k + n) % 3], scale: 0.92 });
      c.root.position.set(MX + tx + side * 1.15, 0.05, MZ + tz);
      c.root.rotation.y = -side * Math.PI / 2;
      W.scene.add(c.root);
      neighbours.push(c);
    }
  }
  const strollers = [];
  for (let k = 0; k < 3; k++) {
    const c = makeCharacter({ skin: '#f2cfae', shirt: ['#ffd23f', '#c9a6e8', '#f2a65a'][k], pants: '#3d4f6b', hair: '#4a3328', hairStyle: ['pony', 'short', 'long'][k], scale: 0.9 });
    c.root.position.set(MX - 12 + k * 9, 0.05, MZ - 6.2 + (k % 2) * 0.8);
    W.scene.add(c.root);
    strollers.push({ c, dir: k % 2 ? -1 : 1, sp: 1.6 + k * 0.3 });
  }
  addTicker(dt => {
    for (const s of strollers) {
      const p = s.c.root.position;
      p.x += s.dir * s.sp * dt;
      if (p.x > MX + 13) p.x = MX - 13; if (p.x < MX - 13) p.x = MX + 13;
      s.c.root.rotation.y = s.dir * Math.PI / 2;
      s.c.animate(dt, s.sp, performance.now() / 1000 + p.z);
    }
  });
  memory = { zhao, neighbours, drop() { dropT = 0; } };
  return memory;
}

// ---------- camera grammar ----------

function cut(pos, look, fov) {                          // a hard cut: snap the camera, set the lens
  player.camShot = { pos, look, speed: 99 };
  player.fovShot = fov || null;
  updateCamera(1);
  if (fov) { W.camera.fov = fov; W.camera.updateProjectionMatrix(); }
}
function move(pos, look, speed = 0.8, fov) {          // a slow dolly / push-in from where we are
  player.camShot = { pos, look, speed };
  if (fov !== undefined) player.fovShot = fov;
}
function grade(name) {
  document.body.classList.remove('grade-memory', 'grade-dublin');
  if (name) document.body.classList.add(`grade-${name}`);
}
function lower3(text) {                                 // a quiet caption, bottom-left, no motion
  document.querySelectorAll('.lower3').forEach(e => e.remove());
  if (!text) return;
  const el = document.createElement('div');
  el.className = 'lower3';
  el.textContent = text;
  document.getElementById('ui').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3400);
}

// ---------- the sequence ----------

// Walk a staged character along waypoints with a proper walk cycle.
function walkChar(c, pts, speed = 3.2) {
  return new Promise(res => {
    const path = pts.slice();
    addTicker(dt => {
      const p = c.root.position, tgt = path[0];
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.25 || G.skip) {
        if (G.skip) { const last = path[path.length - 1]; p.x = last.x; p.z = last.z; path.length = 1; }
        path.shift();
        if (!path.length) { c.animate(dt, 0, performance.now() / 1000); res(); return true; }
        return;
      }
      p.x += dx / d * speed * dt; p.z += dz / d * speed * dt;
      c.root.rotation.y = Math.atan2(dx, dz);
      c.animate(dt, speed, performance.now() / 1000);
    });
  });
}
const faceTo = (c, x, z) => { c.root.rotation.y = Math.atan2(x - c.root.position.x, z - c.root.position.z); };

export async function opening(opts = {}) {
  const { boss, coworker, coworker2 } = buildOffice();
  const { zhao, neighbours, drop } = buildMemory();
  screen.mode = 'work'; screen.stamp = 0;
  drawScreen();
  player.char.setHat('none');
  const golden = { top: '#ffb27a', mid: '#ffd29a', low: '#fff0c8' };
  const hero = player.char;
  try {
    await cutscene(async () => {
      // ===== ACT 1 · the memory (mostly medium and wide shots, long holds) =====
      if (!opts.dublinOnly) {
      setNight(false);
      for (const k of ['top', 'mid', 'low']) W.skyU[k].value.set(golden[k]);
      W.scene.fog.color.set('#ffd9a8');
      grade('memory');
      setMusic('day');
      document.getElementById('fade').classList.add('on');
      teleport(MX, MZ + 1.45, Math.PI);
      hero.setFace('happy');
      zhao.setFace('happy');
      act(zhao, 'ladle'); act(hero, 'bounce');
      neighbours.forEach(n => { act(n, 'eat'); n.setFace('happy'); });
      // S1 establishing (5 s): the street corner at golden hour, crane down
      cut({ x: MX + 14, y: 10, z: MZ + 16 }, { x: MX, y: 1.6, z: MZ - 1 }, 40);
      await fadeIn(1.2);
      lower3('Kunming · three springs ago');
      move({ x: MX + 9.5, y: 5.2, z: MZ + 11.5 }, { x: MX, y: 1.8, z: MZ - 0.5 }, 0.45);
      await beat(4.6);
      // S2 two-shot from the side (4 s): Grandpa ladles, the boy can't keep still
      cut({ x: MX + 8.2, y: 3.3, z: MZ - 0.2 }, { x: MX, y: 1.7, z: MZ }, 34);
      move({ x: MX + 7.2, y: 3.1, z: MZ - 0.1 }, { x: MX, y: 1.7, z: MZ }, 0.35);
      await beat(1.6);
      act(zhao, 'idle');
      drop();
      await beat(2.4);
      // S3 the ritual, framed with room around the bowl (3.4 s)
      cut({ x: MX - 4.4, y: 4.4, z: MZ + 1.8 }, { x: MX + 0.1, y: 1.3, z: MZ }, 38);
      move({ x: MX - 3.9, y: 4.0, z: MZ + 1.6 }, { x: MX + 0.1, y: 1.3, z: MZ }, 0.3);
      await beat(3.4);
      // S4 the boy, waist-up (3.6 s): the first slurp, then pure joy
      cut({ x: MX + 4.4, y: 3.3, z: MZ - 3.6 }, { x: MX, y: 1.6, z: MZ + 1.45 }, 34);
      act(hero, 'eat');
      await beat(1.9);
      act(hero, null);
      await tasteMoment({
        title: 'Grandpa Zhao’s Crossing-the-Bridge Noodles', desc: 'Kunming · the first bite', mode: 'perfect',
        flavours: [{ k: 'savoury', word: 'warm' }, { k: 'rich', word: 'safe' }, { k: 'fresh', word: 'a spring morning' },
          { k: 'sweet', word: 'Grandpa’s laugh' }, { k: 'smoky', word: 'home' }],
        heart: 'loved',
        lesson: 'I didn’t know a bowl of noodles could feel like being loved.',
      });
      cut({ x: MX + 4.4, y: 3.3, z: MZ - 3.6 }, { x: MX, y: 1.6, z: MZ + 1.45 }, 34);
      act(hero, 'bounce');
      emote(hero, '✨', 1.8);
      note(784, 0.5, 'sine', 0.12); note(1047, 0.7, 'sine', 0.1, 0.12);
      await beat(1.7);
      // S5 Grandpa over the boy's shoulder (5 s): the line, then he chuckles
      act(hero, 'eat');
      cut({ x: MX - 3.8, y: 3.4, z: MZ + 5.9 }, { x: MX, y: 1.45, z: MZ - 1.55 }, 32);
      move({ x: MX - 3.5, y: 3.3, z: MZ + 5.4 }, { x: MX, y: 1.45, z: MZ - 1.55 }, 0.3);
      await talk([[SP.zhao, '慢慢吃。Eat slowly, boy.', { face: 'happy', hold: 1.8 }]]);
      act(zhao, 'chuckle');
      emote(zhao, '❤️', 1.8);
      await beat(1.8);
      // S6 wide, pulling away (4 s); the memory whites out
      act(zhao, 'ladle');
      cut({ x: MX - 9, y: 4.4, z: MZ + 7 }, { x: MX, y: 1.8, z: MZ - 0.5 }, 40);
      move({ x: MX - 13, y: 6.5, z: MZ + 10.5 }, { x: MX, y: 1.8, z: MZ - 0.5 }, 0.4);
      await beat(3.2);
      document.getElementById('fade').style.background = '#fff6e6';
      await fadeOut(1.0);
      document.getElementById('fade').style.background = '';
      stopActing();
      }

      // ===== ACT 2 · Dublin =====
      setMusic(null);
      setRain(true);
      grade('dublin');
      W.scene.fog.color.set('#c9d0d8');
      for (const [k, c] of [['top', '#9aa8b8'], ['mid', '#b8c2cc'], ['low', '#d0d6dc']]) W.skyU[k].value.set(c);
      teleport(OX - 2, OZ + 0.15, HERO_H);
      hero.setFace('blank');
      act(hero, 'slump'); act(coworker, 'type'); act(coworker2, 'type'); act(boss, 'idle');
      // S7 wide (4.6 s): rain, typing, a small grey man
      cut({ x: OX - 2, y: 4.7, z: OZ + 5.7 }, { x: OX - 2, y: 2.1, z: OZ - 4 }, 54);
      await fadeIn(0.6);
      lower3('Dublin · now');
      await beat(4.4);
      // S8 him, waist-up (3.6 s): a sigh
      cut({ x: OX + 0.6, y: 3.1, z: OZ - 5.0 }, { x: OX - 2, y: 1.6, z: OZ + 0.15 }, 34);
      await beat(1.2);
      emote(hero, '💤', 1.8);
      await beat(2.4);
      // S9 insert, full colour (3.2 s): the photo. Match cut: the same bowl
      screen.mode = 'photo'; drawScreen();
      grade(null);
      sfx('pop');
      cut(INSERT, SCREEN, 46);
      setMusic('day');
      await beat(3.2);
      // S10 him, slow push-in (4.4 s): he sits up; longing
      grade('dublin');
      act(hero, 'perk');
      hero.setFace('happy');
      cut({ x: OX + 1.0, y: 3.2, z: OZ - 5.6 }, { x: OX - 2, y: 1.6, z: OZ + 0.15 }, 34);
      move({ x: OX - 0.1, y: 2.7, z: OZ - 3.9 }, { x: OX - 2, y: 1.7, z: OZ + 0.15 }, 0.35);
      await beat(1.6);
      // the photo brings it back: a ghost of that first bite flickers round him
      await tasteMoment({ mode: 'echo', flavours: [{ k: 'savoury' }, { k: 'rich' }, { k: 'fresh' }, { k: 'sweet' }, { k: 'smoky' }] });
      emote(hero, '💗', 2);
      await beat(1.6);
      // S11 insert (2.6 s): the stamp lands
      grade(null);
      cut(INSERT, SCREEN, 46);
      setMusic(null);
      screen.stamp = 0.01;
      sfx('scratch'); sfx('slam');
      hitstop(90); addTrauma(0.5);
      await beat(2.6);
      // S12 close-up, the one tight shot (3.4 s): silence, then WHAT
      grade('dublin');
      act(hero, null);
      cut({ x: OX - 0.6, y: 2.6, z: OZ - 3.6 }, { x: OX - 2, y: 1.7, z: OZ + 0.15 }, 32);
      hero.setFace('shock');
      setRain(false);
      await beat(1.4);
      addTrauma(0.6);
      sfx('gasp');
      player.squashV = 5;
      await talk([[SP.you, 'WHAT?!', { face: 'shock', hold: 0.9 }]]);
      setRain(true);
      // S13 reaction wide (3 s): the whole office turns to stare
      act(coworker, null); act(coworker2, null);
      cut({ x: OX - 4.6, y: 4.0, z: OZ + 1.6 }, { x: OX + 4.5, y: 1.5, z: OZ + 1.2 }, 50);   // past his head: the faces turned at him
      for (const c of [coworker, coworker2, boss]) { faceTo(c, OX - 2, OZ + 0.15); c.setFace('shock'); emote(c, '❗', 1.6); }
      sfx('pop');
      await beat(2.8);
      // S14 two-shot (side-on): the boss walks over
      act(boss, null);
      cut({ x: OX + 2.1, y: 3.3, z: OZ - 5.0 }, { x: OX - 0.6, y: 1.6, z: OZ + 0.9 }, 40);
      await walkChar(boss, [{ x: OX + 2.6, z: OZ + 2.4 }, { x: OX + 0.7, z: OZ + 1.5 }], 3.2);
      faceTo(boss, OX - 2, OZ + 0.15);
      player.heading = 1.12;
      hero.setFace('normal');
      await talk([[SP.boss, '…Everything OK over there?', { face: 'shock', hold: 1.0 }]]);
      // S15 him, medium close (3 s): the decision
      cut({ x: OX + 0.2, y: 3.0, z: OZ + 4.6 }, { x: OX - 2, y: 1.45, z: OZ + 0.15 }, 34);   // 3/4 on him, clear of the boss
      hero.setFace('angry');
      act(hero, 'bounce');
      await talk([[SP.you, 'I need my annual leave. All 22 days. Today.', { face: 'angry', hold: 1.1 }]]);
      act(hero, null);
      // S16 back to the two-shot: a long pause is the joke
      cut({ x: OX + 2.1, y: 3.3, z: OZ - 5.0 }, { x: OX - 0.6, y: 1.6, z: OZ + 0.9 }, 40);
      boss.setFace('blank');
      await beat(1.6);
      await talk([[SP.boss, '…Go.', { face: 'smug', hold: 0.9 }]]);
      // S17 high wide: he bolts, round the boss, out the door
      cut({ x: OX - 6, y: 5.4, z: OZ - 3.6 }, { x: OX + 3, y: 1.4, z: OZ + 3.4 }, 56);
      hero.setFace('happy');
      sfx('whack');
      await new Promise(res => {
        const path = [{ x: OX - 1.2, z: OZ + 4.4 }, { x: OX + 8.4, z: OZ + 3.8 }];
        addTicker(dt => {
          const target = path[0];
          const dx = target.x - player.pos.x, dz = target.z - player.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.4 && path.length > 1) { path.shift(); return; }
          if (d < 0.4 || G.skip) { res(); return true; }
          player.pos.x += dx / d * 10 * dt; player.pos.z += dz / d * 10 * dt;
          player.heading = Math.atan2(dx, dz);
          player.speed = 10;
          hero.root.position.set(player.pos.x, 0.1, player.pos.z);
        });
      });
      player.speed = 0;
      sfx('slam'); addTrauma(0.4);
      for (const c of [coworker, coworker2, boss]) emote(c, '❓', 1.2);
      await beat(1.0);
      document.getElementById('fade').classList.add('on');
      await beat(0.6);
    });
  } finally {
    stopActing();
    setRain(false);
    grade(null);
    lower3(null);
    player.camShot = null;
    player.fovShot = null;
    player.camFocus = null;
    setNight(false);
  }
  document.getElementById('fade').classList.remove('on');
  sfx('whoosh');
  await flight();
}

// ---------- Little Chilli's memory (played at the end of her bowl on Day 1) ----------

export async function chilliFlashback() {
  const { zhao, neighbours } = buildMemory();
  const wasNight = W.night;
  const kid = makeCharacter({ skin: '#f2c9a5', shirt: '#d63c2f', pants: '#2d2d2d', hair: '#1a1a1a', hairTip: '#d63c2f', hairStyle: 'pony', scale: 0.7, brows: true });
  kid.root.position.set(MX, 0.05, MZ + 1.45);
  kid.root.rotation.y = Math.PI;
  W.scene.add(kid.root);
  const keep = { camShot: player.camShot, fov: player.fovShot };
  document.body.classList.add('grade-sepia');
  setNight(false);
  for (const [k, c] of [['top', '#e8c89a'], ['mid', '#f0d8b0'], ['low', '#fff0d0']]) W.skyU[k].value.set(c);
  kid.setFace('sad'); zhao.setFace('happy');
  act(zhao, 'ladle');
  neighbours.forEach(n => act(n, 'eat'));
  try {
    cut({ x: MX - 7.5, y: 4, z: MZ + 6 }, { x: MX, y: 1.6, z: MZ }, 38);
    move({ x: MX - 5.2, y: 3.2, z: MZ + 4.2 }, { x: MX, y: 1.5, z: MZ }, 0.35);
    await fadeIn(0.8);
    await beat(1.6);
    act(zhao, 'idle');
    cut({ x: MX - 2.6, y: 2.9, z: MZ + 5.4 }, { x: MX, y: 1.4, z: MZ - 1.55 }, 32);
    await talk([[SP.zhao, '少一点，小辣椒。永远少一点。Less, Little Chilli. Always less.', { face: 'happy', hold: 2.2 }]]);
    kid.setFace('happy');
    act(kid, 'eat');
    cut({ x: MX + 3.6, y: 2.8, z: MZ - 3.4 }, { x: MX, y: 1.3, z: MZ + 1.45 }, 32);
    await beat(2.2);
    document.getElementById('fade').style.background = '#fff6e6';
    await fadeOut(0.9);
    document.getElementById('fade').style.background = '';
  } finally {
    act(zhao, null); act(kid, null); neighbours.forEach(n => act(n, null));
    W.scene.remove(kid.root);
    document.body.classList.remove('grade-sepia');
    setNight(wasNight);
    player.camShot = keep.camShot;
    player.fovShot = keep.fov;
  }
}

// ---------- the flight: a map card with the AI's "perfect recipe" ----------

function flight() {
  return new Promise(res => {
    const p = openPanel(`<div class="flight">
      <svg viewBox="0 0 600 260" class="route">
        <path id="fl-path" d="M60,90 C200,10 420,30 540,190" fill="none" stroke="#e8dcc8" stroke-width="4" stroke-dasharray="10 10"/>
        <circle cx="60" cy="90" r="8" fill="#49b26a"/><text x="60" y="122" text-anchor="middle">Dublin</text>
        <circle cx="540" cy="190" r="8" fill="#e0602c"/><text x="540" y="222" text-anchor="middle">Kunming 昆明</text>
        <text id="fl-plane" font-size="34" text-anchor="middle" dominant-baseline="middle">✈️</text>
      </svg>
      <div class="fl-phone"><b>PromptPal</b> · in-flight Wi-Fi<br>
        The <b>perfect</b> cross-bridge recipe ✨<br>• 1 stock cube<br>• a generous handful of cheddar 🧀<br>• gold leaf for the “wow”<br>• a sparkler for engagement 🎆<br>Trust me 🙂</div>
    </div>`);
    p.classList.add('dim');
    const path = p.querySelector('#fl-path'), plane = p.querySelector('#fl-plane');
    const len = path.getTotalLength();
    let t = 0;
    sfx('whack');
    addTicker(dt => {
      t += dt / 3.2;
      const q = path.getPointAtLength(Math.min(1, t) * len);
      const q2 = path.getPointAtLength(Math.min(1, t + 0.01) * len);
      plane.setAttribute('x', q.x); plane.setAttribute('y', q.y);
      plane.setAttribute('transform', `rotate(${Math.atan2(q2.y - q.y, q2.x - q.x) * 57.3 + 45} ${q.x} ${q.y})`);
      if (t >= 1.2 || G.skip) {
        p.classList.remove('dim');
        closePanel();
        res();
        return true;
      }
    });
  });
}
