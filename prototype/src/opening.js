// The opening, cut like a short film (cinematography notes in
// docs/design/OPENING.md):
//   ACT 1 · memory: golden Kunming, Grandpa Zhao and the bowl. Show the love first.
//   ACT 2 · Dublin: grey, rain, silence; the bowl on his monitor (a match cut),
//          a slow push-in on his face, then PERMANENTLY CLOSED, a hit-zoom,
//          one beat of silence, "WHAT?!", the boss in shot / reverse-shot, the sprint.
//   ACT 3 · the flight, with the AI's "perfect" recipe.
// Shots are 1.5–3 s, cut on action, reactions held; almost no text on screen.

import * as THREE from 'three';
import { G, addTicker } from './core.js';
import { W, makeSign, setNight } from './world.js';
import { makeCharacter, mat, toon, outline } from './characters.js';
import { player, teleport, updateCamera } from './player.js';
import { SP } from './npcs.js';
import { say, talk, fadeIn, fadeOut, beat, openPanel, closePanel, emote, bark, cutscene, hideDialogue } from './ui.js';
import { sfx, setMusic, setRain, note } from './audio.js';
import { addTrauma, hitstop } from './fx.js';

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
  built = { boss, coworker };
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
  memory = { zhao, drop() { dropT = 0; } };
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

export async function opening() {
  const { boss } = buildOffice();
  const { zhao, drop } = buildMemory();
  screen.mode = 'work'; screen.stamp = 0;
  drawScreen();
  player.char.setHat('none');
  const golden = { top: '#ffb27a', mid: '#ffd29a', low: '#fff0c8' };
  try {
    await cutscene(async () => {
      // ===== ACT 1 · the memory =====
      setNight(false);
      for (const k of ['top', 'mid', 'low']) W.skyU[k].value.set(golden[k]);
      W.scene.fog.color.set('#ffd9a8');
      grade('memory');
      setMusic('day');
      document.getElementById('fade').classList.add('on');
      teleport(MX, MZ + 1.45, Math.PI);
      player.char.setFace('happy');
      zhao.setFace('happy');
      // Distances are set from the lens: a character is ~3 units tall with a
      // ~1.9-unit head, so MCU ≈ 4.5 away at 32°, CU ≈ 3.2, ECU ≈ 3 at 24°.
      // S1 establishing: crane down through the lanterns
      cut({ x: MX + 12, y: 13, z: MZ + 14 }, { x: MX, y: 1.6, z: MZ }, 38);
      await fadeIn(0.9);
      lower3('Kunming · three springs ago');
      move({ x: MX + 7.5, y: 5.2, z: MZ + 9.5 }, { x: MX, y: 1.8, z: MZ }, 0.8);
      await beat(2.8);
      // S2 insert: the ritual, raw slices crossing into the broth
      cut({ x: MX - 2.1, y: 2.75, z: MZ + 0.5 }, { x: MX + 0.15, y: 1.3, z: MZ + 0.05 }, 34);
      drop();
      move({ x: MX - 1.8, y: 2.45, z: MZ + 0.35 }, { x: MX + 0.1, y: 1.3, z: MZ }, 0.6);
      await beat(2.2);
      // S3 his face: the first sip (MCU from beside Grandpa)
      cut({ x: MX + 2.1, y: 2.75, z: MZ - 2.6 }, { x: MX, y: 1.85, z: MZ + 1.45 }, 32);
      player.squashV = 3;
      emote(player.char, '✨', 1.8);
      note(784, 0.5, 'sine', 0.12); note(1047, 0.7, 'sine', 0.1, 0.12);
      await beat(2.0);
      // S4 Grandpa, over the boy's shoulder: held, the emotional beat
      cut({ x: MX - 2.2, y: 2.7, z: MZ + 3.4 }, { x: MX, y: 1.55, z: MZ - 1.55 }, 30);   // face in the upper third, above the dialogue
      move({ x: MX - 1.9, y: 2.6, z: MZ + 2.9 }, { x: MX, y: 1.55, z: MZ - 1.55 }, 0.45);
      await talk([[SP.zhao, '慢慢吃。Eat slowly, boy.', { face: 'happy', hold: 1.6 }]]);
      emote(zhao, '❤️', 1.6);
      await beat(1.0);
      // S5 wide: the two of them, pulling away; the memory whites out
      cut({ x: MX - 8.5, y: 4.2, z: MZ + 6.5 }, { x: MX, y: 1.8, z: MZ }, 38);
      move({ x: MX - 11, y: 5.4, z: MZ + 8.8 }, { x: MX, y: 1.8, z: MZ }, 0.55);
      await beat(1.8);
      document.getElementById('fade').style.background = '#fff6e6';
      await fadeOut(0.7);
      document.getElementById('fade').style.background = '';

      // ===== ACT 2 · Dublin =====
      setMusic(null);
      setRain(true);
      grade('dublin');
      setNight(false);
      W.scene.fog.color.set('#c9d0d8');
      for (const [k, c] of [['top', '#9aa8b8'], ['mid', '#b8c2cc'], ['low', '#d0d6dc']]) W.skyU[k].value.set(c);
      teleport(OX - 2, OZ + 0.15, HERO_H);
      player.char.setFace('blank');
      // S6 symmetrical wide from behind: a small man, a big grey window, rain
      cut({ x: OX - 2, y: 4.7, z: OZ + 5.7 }, { x: OX - 2, y: 2.1, z: OZ - 4 }, 54);
      await fadeIn(0.25);
      lower3('Dublin · now');
      await beat(2.6);
      // S7 his face, lit by the spreadsheet (MCU from the far side of the monitor)
      cut({ x: OX - 0.2, y: 2.7, z: OZ - 4.0 }, { x: OX - 2, y: 1.85, z: OZ + 0.15 }, 32);
      emote(player.char, '💤', 1.4);
      await beat(1.8);
      // S8 insert, in full colour: he opens a photo. Match cut: the bowl, again
      screen.mode = 'photo'; drawScreen();
      grade(null);
      sfx('pop');
      cut(INSERT, SCREEN, 46);
      setMusic('day');
      await beat(1.9);
      // S9 slow push-in on his face: longing
      grade('dublin');
      cut({ x: OX + 0.3, y: 2.8, z: OZ - 4.6 }, { x: OX - 2, y: 1.85, z: OZ + 0.15 }, 30);
      player.char.setFace('happy');
      move({ x: OX - 0.4, y: 2.5, z: OZ - 3.4 }, { x: OX - 2, y: 1.85, z: OZ + 0.15 }, 0.5);
      await beat(2.5);
      // S10 insert: the stamp lands
      grade(null);
      cut(INSERT, SCREEN, 46);
      setMusic(null);
      screen.stamp = 0.01;
      sfx('scratch'); sfx('slam');
      hitstop(90); addTrauma(0.6);
      await beat(1.3);
      // S11 extreme close-up, hit-zoom, one beat of dead silence
      grade('dublin');
      cut({ x: OX - 1.2, y: 2.25, z: OZ - 2.8 }, { x: OX - 2, y: 1.7, z: OZ + 0.15 }, 27);
      player.char.setFace('shock');
      setRain(false);
      await beat(1.0);
      addTrauma(0.8);
      sfx('gasp');
      await talk([[SP.you, 'WHAT?!', { face: 'shock', hold: 0.7 }]]);
      setRain(true);
      // S12 whip-pan to the boss; shot / reverse-shot, both cameras on one side of the line
      boss.root.rotation.y = -1.875;                    // he looks across at our hero
      move({ x: OX + 0.85, y: 2.85, z: OZ + 2.35 }, { x: OX + 5.5, y: 1.5, z: OZ + 2.5 }, 14, 30);
      sfx('whoosh');
      await beat(0.35);
      boss.setFace('shock');
      await talk([[SP.boss, '…Everything OK over there?', { face: 'shock', hold: 0.8 }]]);
      player.heading = 1.27;
      cut({ x: OX + 2.05, y: 2.75, z: OZ + 2.65 }, { x: OX - 2, y: 1.5, z: OZ + 0.15 }, 30);
      player.char.setFace('angry');
      await talk([[SP.you, 'I need my annual leave. All 22 days. Today.', { face: 'angry', hold: 0.9 }]]);
      cut({ x: OX + 0.85, y: 2.75, z: OZ + 2.35 }, { x: OX + 5.5, y: 1.5, z: OZ + 2.5 }, 30);
      boss.setFace('blank');
      await beat(0.9);                                  // the pause is the joke
      await talk([[SP.boss, '…Go.', { face: 'smug', hold: 0.7 }]]);
      // S13 the sprint: cut on action, door slam, black
      cut({ x: OX + 0.2, y: 5.5, z: OZ + 5.8 }, { x: OX + 5, y: 1.4, z: OZ + 2.6 }, 60);   // high wide: he bolts away, right to the door
      player.char.setFace('happy');
      sfx('whack');
      await new Promise(res => {
        const path = [{ x: OX + 3, z: OZ + 5 }, { x: OX + 8.4, z: OZ + 3.8 }];   // round the boss, out the door
        addTicker(dt => {
          const target = path[0];
          const dx = target.x - player.pos.x, dz = target.z - player.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.4 && path.length > 1) { path.shift(); return; }
          if (d < 0.4 || G.skip) { res(); return true; }
          player.pos.x += dx / d * 11 * dt; player.pos.z += dz / d * 11 * dt;
          player.heading = Math.atan2(dx, dz);
          player.speed = 11;
          player.char.root.position.set(player.pos.x, 0.1, player.pos.z);
        });
      });
      player.speed = 0;
      sfx('slam'); addTrauma(0.4);
      document.getElementById('fade').classList.add('on');
      await beat(0.4);
    });
  } finally {
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
