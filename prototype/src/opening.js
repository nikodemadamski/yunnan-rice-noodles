// The opening: a rainy Dublin office built as a little diorama set, the AI
// chat drifting from business to noodles on the monitor (no typing to watch),
// "PERMANENTLY CLOSED", the boss, and the flight to Kunming.

import * as THREE from 'three';
import { G, addTicker } from './core.js';
import { W, makeSign } from './world.js';
import { makeCharacter, mat } from './characters.js';
import { player, teleport, updateCamera } from './player.js';
import { SP } from './npcs.js';
import { say, talk, card, fadeIn, fadeOut, beat, openPanel, closePanel, emote } from './ui.js';
import { sfx, setMusic } from './audio.js';
import { addTrauma } from './fx.js';

const OX = 400, OZ = 400;           // the office set lives far outside the town
let built = null;

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  W.scene.add(m);
  return m;
}

// ---------- the monitor's chat, drawn on a canvas texture ----------

const screen = { msgs: [], stamp: 0, photo: false };
let scr = null;

function drawScreen() {
  const g = scr.ctx, w = 512, h = 300;
  g.fillStyle = '#f4f4f8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7a52c7'; g.fillRect(0, 0, w, 34);
  g.fillStyle = '#fff'; g.font = '900 18px Nunito, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('PromptPal AI', 14, 18);
  let y = h - 12;
  const items = [...screen.msgs].reverse();
  for (const m of items) {
    if (y < 44) break;
    if (m.photo) {
      const ph = 110; y -= ph;
      g.fillStyle = '#fff'; g.fillRect(20, y, 220, ph - 8);
      g.strokeStyle = '#ccc'; g.strokeRect(20, y, 220, ph - 8);
      // a sunny Kunming photo: two faces, three empty bowls
      g.fillStyle = '#bfe6ff'; g.fillRect(28, y + 8, 204, ph - 40);
      g.fillStyle = '#f6d2b0'; g.beginPath(); g.arc(90, y + 44, 18, 0, 7); g.arc(160, y + 46, 16, 0, 7); g.fill();
      g.fillStyle = '#d9772b'; g.beginPath(); g.arc(90, y + 34, 18, Math.PI, 0); g.fill();
      g.fillStyle = '#ddd'; g.beginPath(); g.arc(160, y + 36, 16, Math.PI, 0); g.fill();
      for (let i = 0; i < 3; i++) { g.fillStyle = '#fff'; g.strokeStyle = '#5b7fb5'; g.lineWidth = 2; g.beginPath(); g.ellipse(70 + i * 45, y + 70, 16, 6, 0, 0, 7); g.fill(); g.stroke(); }
      g.fillStyle = '#5b4636'; g.font = '700 12px Nunito, sans-serif'; g.fillText('Kunming, 3 years ago ❤', 30, y + ph - 16);
      y -= 8;
      continue;
    }
    g.font = '700 15px Nunito, sans-serif';
    const lines = wrap(g, m.text, 330);
    const bh = lines.length * 19 + 14;
    y -= bh;
    const bw = Math.min(360, Math.max(...lines.map(l => g.measureText(l).width)) + 24);
    const x = m.me ? w - bw - 14 : 14;
    g.fillStyle = m.me ? '#3b82f6' : '#ffffff';
    roundRect(g, x, y, bw, bh, 12); g.fill();
    if (!m.me) { g.strokeStyle = '#e2e2ea'; g.lineWidth = 1; g.stroke(); }
    g.fillStyle = m.me ? '#fff' : '#333';
    lines.forEach((l, i) => g.fillText(l, x + 12, y + 16 + i * 19));
    y -= 8;
  }
  if (screen.stamp > 0) {
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.15);
    const s = 1 + Math.max(0, 1 - screen.stamp) * 1.5;
    g.scale(s, s);
    g.strokeStyle = '#e2241b'; g.lineWidth = 6; g.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(g, -190, -40, 380, 80, 10); g.fill(); g.stroke();
    g.fillStyle = '#e2241b'; g.font = '900 34px Nunito, sans-serif'; g.textAlign = 'center';
    g.fillText('PERMANENTLY CLOSED', 0, 2);
    g.restore();
  }
  scr.tex.needsUpdate = true;
}

function wrap(g, text, max) {
  const words = text.split(' '), out = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- the set ----------

function buildOffice() {
  if (built) return built;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), mat('#8e9aa8'));
  floor.rotation.x = -Math.PI / 2; floor.position.set(OX, 0.02, OZ); floor.receiveShadow = true;
  W.scene.add(floor);
  box(18, 6, 0.3, '#dfe3e6', OX, 3, OZ - 6);          // back wall
  box(0.3, 6, 12, '#d6dade', OX - 9, 3, OZ);          // left wall
  box(0.3, 6, 12, '#d6dade', OX + 9, 3, OZ);          // right wall
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
  box(1.8, 1.1, 0.12, '#2b2b33', OX - 2, 2.2, OZ - 1.6);
  box(0.15, 0.5, 0.15, '#2b2b33', OX - 2, 1.6, OZ - 1.6);
  const c = document.createElement('canvas'); c.width = 512; c.height = 300;
  scr = { ctx: c.getContext('2d'), tex: new THREE.CanvasTexture(c) };
  scr.tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.97), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  face.position.set(OX - 2, 2.2, OZ - 1.53); W.scene.add(face);
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
  box(1.8, 1.1, 0.12, '#2b2b33', OX + 3.5, 2.2, OZ - 1.6);
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
    if (screen.stamp > 0 && screen.stamp < 1) { screen.stamp = Math.min(1, screen.stamp + dt * 4); drawScreen(); }
  });
  built = { boss, coworker };
  SP.boss = { name: 'Boss', color: '#6b7c93', voice: 'spud', char: boss };
  return built;
}

function shot(pos, look, speed = 3) { player.camShot = { pos, look, speed }; }

async function chat(me, ai, hold = 1.3) {
  if (me) { screen.msgs.push({ me: true, text: me }); drawScreen(); sfx('send'); await beat(0.55); }
  if (ai) { screen.msgs.push({ me: false, text: ai }); drawScreen(); sfx('pop'); await beat(hold); }
}

// ---------- the sequence ----------

export async function opening() {
  const { boss } = buildOffice();
  screen.msgs = []; screen.stamp = 0;
  drawScreen();
  setMusic(null);
  teleport(OX - 2, OZ + 0.15, Math.PI);
  player.camFocus = { x: OX, z: OZ };
  shot({ x: OX + 1, y: 4.6, z: OZ + 10 }, { x: OX - 0.5, y: 2.2, z: OZ - 2 }, 99);
  updateCamera(0, true);

  await card('Dublin', 'Tuesday · 16:47 · raining, obviously', 2.2);
  await fadeIn();
  await beat(1.2);
  shot({ x: OX - 2.3, y: 2.9, z: OZ + 1.2 }, { x: OX - 2, y: 2.2, z: OZ - 1.6 }, 2.2);
  await beat(1.4);
  await chat('Write a Q3 synergy strategy deck for the client', 'Absolutely! 🚀 40 slides on leveraging cross-functional synergy…', 1.4);
  await chat('make it noodle themed?', 'Love it!! Slide 1: "Oodles of Synergy" 🍜', 1.2);
  await chat('what are cross bridge rice noodles', '过桥米线 from Yunnan! A wife carried soup across a bridge every day. A layer of chicken fat kept it hot.', 1.8);
  screen.msgs.push({ photo: true }); drawScreen(); sfx('pop');
  await beat(1.6);
  await chat("is Old Zhao's in Kunming still open?", '⭐ 4.9 · "Best bowl of my life" · "The old man is a legend."', 1.2);
  screen.stamp = 0.01;
  sfx('fail');
  addTrauma(0.7);
  await beat(1.4);

  // the outburst
  shot({ x: OX + 0.5, y: 3.6, z: OZ + 7.5 }, { x: OX, y: 1.8, z: OZ }, 6);
  player.squashV = 4;
  player.char.setFace('shock');
  emote(player.char, '❗');
  await say(SP.you, 'WHAT?!?!', { face: 'shock', hold: 0.9 });
  boss.root.rotation.y = -2.6;
  await talk([
    [SP.boss, '…Who just shouted “what”?', { face: 'blank' }],
    [SP.you, 'EMERGENCY. I need my annual leave. All of it.', { face: 'shock' }],
    [SP.boss, 'All 22 days?? …Fine. You never take any. Don’t do anything mad.', { face: 'smug' }],
  ]);

  // he runs for the door
  sfx('whack');
  await new Promise(res => {
    const target = { x: OX + 8, z: OZ + 3 };
    addTicker(dt => {
      const dx = target.x - player.pos.x, dz = target.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4 || G.skip) { res(); return true; }
      player.pos.x += dx / d * 9 * dt; player.pos.z += dz / d * 9 * dt;
      player.heading = Math.atan2(dx, dz);
      player.speed = 9;
      player.char.root.position.set(player.pos.x, 0.1, player.pos.z);
    });
  });
  player.speed = 0;
  await fadeOut();
  player.camShot = null;
  player.camFocus = null;
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
      t += dt / 4.6;
      const q = path.getPointAtLength(Math.min(1, t) * len);
      const q2 = path.getPointAtLength(Math.min(1, t + 0.01) * len);
      plane.setAttribute('x', q.x); plane.setAttribute('y', q.y);
      plane.setAttribute('transform', `rotate(${Math.atan2(q2.y - q.y, q2.x - q.x) * 57.3 + 45} ${q.x} ${q.y})`);
      if (t >= 1.25 || G.skip) {
        p.classList.remove('dim');
        closePanel();
        res();
        return true;
      }
    });
  });
}
