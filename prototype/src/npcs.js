// The cast and their little behaviours (idle, wander, dance, patrol, ride, walkTo).

import * as THREE from 'three';
import { makeCharacter, mat, outline } from './characters.js';
import { W, P, collide } from './world.js';
import { player } from './player.js';
import { G, rng, dist2 } from './core.js';
import { bark, cheatFacing } from './ui.js';

const R = rng(7);
export const N = {};       // id → npc
export const crowd = [];   // market crowd npcs

// Speaker definitions used by dialogue.
export const SP = {
  you:     { name: '{name}', color: '#4a8f5a', voice: 'player' },
  grandma: { name: 'Grandma Zhao', color: '#c0587e', voice: 'grandma' },
  wang:    { name: 'Old Wang', color: '#e0418a', voice: 'wang' },
  chilli:  { name: 'Little Chilli', color: '#d63c2f', voice: 'chilli' },
  spud:    { name: 'Uncle Spud', color: '#a86b2d', voice: 'spud' },
  fu:      { name: 'Auntie Fu', color: '#b83b2e', voice: 'fu' },
  ji:      { name: 'Uncle Ji', color: '#7a4e2d', voice: 'ji' },
  rose:    { name: 'Rose', color: '#d9577f', voice: 'rose' },
  li:      { name: 'Mr Li', color: '#5a7a9a', voice: 'li' },
  redhat:  { name: 'Uncle in a Red Hat', color: '#c0392b', voice: 'crowd' },
  gf:      { name: 'Xiao Mei', color: '#3f9a5a', voice: 'rose' },
  bf:      { name: 'Ah Jie', color: '#3b6fb6', voice: 'crowd' },
  lan:     { name: 'Xiao Lan', color: '#4a7bd8', voice: 'lan' },
  auntie:  { name: 'The Aunties', color: '#ff6fa8', voice: 'auntie' },
  duck:    { name: 'Little Yellow Duck App', color: '#e8a800', voice: 'ai' },
  ai:      { name: 'PromptPal AI', color: '#7a52c7', voice: 'ai' },
  crowd:   { name: 'Passer-by', color: '#8a7562', voice: 'crowd' },
};

function spawn(id, look, pos, behavior = { type: 'idle' }, facing = 0) {
  const char = makeCharacter(look);
  char.root.position.set(pos.x, 0.1, pos.z);
  char.root.rotation.y = facing;
  W.scene.add(char.root);
  const npc = { id, char, pos: new THREE.Vector3(pos.x, 0, pos.z), behavior, home: { ...pos }, facing, speed: 0, barkT: 0, hop: 0, anchor: null };
  N[id] = npc;
  if (SP[id]) SP[id].char = char;
  return npc;
}

const SKINS = ['#f6d2b0', '#eec3a0', '#f9dcc4', '#e5b893', '#f2cfae'];
const SHIRTS = ['#7fb3e6', '#e9a1a1', '#9bd19b', '#f4d06f', '#c9a6e8', '#f2a65a', '#8fd3d3', '#e7e1d5'];

export function initNPCs() {
  spawn('grandma', { skin: '#f3d0b5', shirt: '#6e3b6e', pants: '#6e3b6e', hair: '#d9d5cf', hairStyle: 'bun', skirt: true, glasses: true, brooch: true, sneakers: true, shoes: '#fbf7f0', scale: 0.82, blush: true },   // cast sheet: purple dress, daisy button, white sneakers
    { x: -17.5, z: -7.2 }, { type: 'idle' });
  spawn('wang', { skin: '#f0c8a0', shirt: '#ffd700', pants: '#e0418a', hair: '#1a1a1a', hairStyle: 'short', wide: 1.35, prop: 'selfie', glasses: true },
    { x: -15, z: 7.5 }, { type: 'idle' }, Math.PI);
  spawn('chilli', { skin: '#f2c9a5', shirt: '#d63c2f', pants: '#2d2d2d', hair: '#1a1a1a', hairTip: '#d63c2f', hairStyle: 'pony', brows: true },
    { x: P.chilliStall.x, z: P.chilliStall.z }, { type: 'idle' }, Math.PI);
  spawn('spud', { skin: '#e8bf95', shirt: '#c9a06a', pants: '#5a4630', hair: '#5a4a3a', hairStyle: 'bald', wide: 1.2 },
    { x: P.spudStall.x, z: P.spudStall.z }, { type: 'idle' });
  spawn('fu', { skin: '#f0c8a0', shirt: '#ffffff', pants: '#b83b2e', hair: '#2a2a2a', hairStyle: 'bun', hat: 'chef', prop: 'ladle', skirt: true },
    { x: 17, z: -7.6 }, { type: 'idle' });
  spawn('ji', { skin: '#e5b893', shirt: '#ffffff', pants: '#5a3b22', hair: '#888888', hairStyle: 'short', hat: 'chef', wide: 1.15 },
    { x: 57.6, z: -17.5 }, { type: 'idle' }, -Math.PI / 2);
  spawn('rose', { skin: '#f9dcc4', shirt: '#ffb3c8', pants: '#d9577f', hair: '#6b3a2a', hairStyle: 'long', skirt: true, blush: true },
    { x: -57.6, z: -17.5 }, { type: 'idle' }, Math.PI / 2);
  spawn('li', { skin: '#e8c4a0', shirt: '#7d8fa6', pants: '#4a4f5a', hair: '#e8e8e8', hairStyle: 'short', glasses: true, scale: 0.9 },
    { x: P.lakeBench.x, z: P.lakeBench.z }, { type: 'idle' });
  spawn('gf', { skin: '#f6d2b0', shirt: '#3f9a5a', pants: '#3f9a5a', hair: '#3a2a20', hairStyle: 'long', skirt: true },
    { x: 76, z: 20 }, { type: 'patrol', cx: P.courtyard.x, cz: P.courtyard.z, r: 6, w: 0.45, a: 0 });
  spawn('bf', { skin: '#eec3a0', shirt: '#3b6fb6', pants: '#2d3a4f', hair: '#1a1a1a', hairStyle: 'spiky' },
    { x: P.bfBench.x - 1.2, z: P.bfBench.z }, { type: 'idle' }, -Math.PI / 2);
  spawn('lan', { skin: '#f2cfae', shirt: '#4a7bd8', pants: '#2d3a4f', hair: '#1a1a1a', hairStyle: 'pony', hat: 'cap', hatColor: '#4a7bd8' },
    { x: 0, z: -40 }, { type: 'ride', path: [[-50, -40], [50, -40], [50, 40], [-50, 40]], i: 0, sp: 13 });
  addBlueBike(N.lan);

  // The square-dancing aunties take over the road for practice.
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const pos = { x: P.aunties.x - 3.75 + col * 2.5, z: P.aunties.z - 1.25 + row * 2.5 };
    spawn(`auntie${i}`, { skin: SKINS[i % 5], shirt: ['#ff6fa8', '#ff9a3c', '#c86bfa', '#ff4f4f'][i % 4], pants: '#3a3a5a', hair: i % 3 ? '#2a2a2a' : '#a0a0a0',
      hairStyle: i % 2 ? 'bun' : 'short', skirt: i % 2 === 0, prop: 'fan', scale: 0.85, blush: true }, pos, { type: 'dance', phase: i * 0.3 });
  }

  // Market crowd, with decoy hats and one true red hat.
  const hats = [['cap', '#f08a4b'], ['cap', '#ff6fa8'], ['scarf', '#c0392b'], ['none'], ['cap', '#e9a13b'], ['none'], ['cap', '#8e2f2f'], ['none'], ['cap', '#d65c8a'], ['none'], ['none'], ['scarf', '#e94b3c']];
  const m = P.market;
  hats.forEach(([hat, hc], i) => {
    const pos = { x: m.x - m.w / 2 + 2 + R() * (m.w - 4), z: m.z - m.d / 2 + 2 + R() * (m.d - 4) };
    const n = spawn(`crowd${i}`, { skin: SKINS[i % 5], shirt: SHIRTS[i % SHIRTS.length], pants: '#2f3a56', hair: i % 5 === 3 ? '#cfcac4' : '#3f271b', hairStyle: hat === 'cap' ? 'short' : ['bowl', 'bun', 'long', 'bowl'][i % 4], glasses: i % 5 === 3, sneakers: true, shoes: '#fbf7f0', hat, hatColor: hc, scale: 0.9 + R() * 0.15 },
      pos, { type: 'wander', rect: m, wait: R() * 2 });
    crowd.push(n);
  });
  const red = spawn('redhat', { skin: '#e5b893', shirt: '#7a8a6a', pants: '#3a3a3a', hair: '#2a2a2a', hairStyle: 'short', hat: 'cap', hatColor: '#e3241b', wide: 1.1 },
    { x: 34, z: 79 }, { type: 'wander', rect: { x: 31, z: 78, w: 10, d: 8 }, wait: 1 });
  crowd.push(red);

  // a few passers-by on grandpa's street
  for (let i = 0; i < 4; i++) {
    spawn(`walker${i}`, { skin: SKINS[(i + 2) % 5], shirt: ['#e0453a', '#f2c230', '#3f6fc4', '#f08fb0'][i], pants: '#2f3a56', hair: '#3f271b', hairStyle: ['bowl', 'bun', 'bowl', 'messybun'][i], glasses: i === 2, sneakers: true, shoes: '#fbf7f0', scale: 0.95 },
      { x: -30 + i * 12, z: i % 2 ? 5.9 : -5.9 }, { type: 'wander', rect: { x: 0, z: i % 2 ? 5.9 : -5.9, w: 70, d: 0.4 }, wait: 1 });   // the lane in front of the planters
  }
}

function addBlueBike(npc) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 2.2), mat('#4a7bd8'));
  frame.position.y = 0.75;
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1), mat('#4a7bd8'));
  crate.position.set(0, 1.85, -0.95);
  const w = new THREE.TorusGeometry(0.38, 0.13, 8, 16).rotateY(Math.PI / 2);
  const w1 = new THREE.Mesh(w, mat('#222222')); w1.position.set(0, 0.4, 0.95);
  const w2 = new THREE.Mesh(w, mat('#222222')); w2.position.set(0, 0.4, -0.95);
  g.add(frame, crate, w1, w2);
  outline(g, 1.05);
  npc.char.root.add(g);
  g.position.y = -0.1;
  npc.char.body.position.y = 0.45;
  npc.char.arms[0].rotation.x = -1.1; npc.char.arms[1].rotation.x = -1.1;
}

export function show(id, on) { N[id].char.root.visible = on; }

// Scripted walk; resolves on arrival.
export function walkTo(id, x, z, speed = 3.2) {
  const npc = N[id];
  return new Promise(res => { npc.walk = { x, z, speed, res }; });
}

export function face(id, target) {
  const n = N[id];
  const t = target.pos || target;
  n.facing = Math.atan2(t.x - n.pos.x, t.z - n.pos.z);
}

// People are solid at the feet. Nobody walks through anybody: the player is
// pushed out of NPCs, NPCs in the player's path step aside (on the bike they
// hop out of the way), then drift back to where they were standing.
const BODY = 0.5, FOOT = 0.55, BIKE = 1.1;
function makeWay(n, b, dt) {
  if (b.type === 'ride' || G.flags.cutscene || G.flags.cine) { n.anchor = null; return 0; }
  const bike = player.mode === 'bike';
  const pv = bike ? { x: Math.sin(player.heading) * player.speed, z: Math.cos(player.heading) * player.speed } : player.vel;
  const ps = Math.hypot(pv.x, pv.z);
  let dx = n.pos.x - player.pos.x, dz = n.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1e-4;
  const reach = (bike ? BIKE : FOOT) + BODY;
  const homeable = b.type === 'idle' || b.type === 'dance';
  let moved = 0;
  // ahead of a moving player and close to their line: sidestep early
  if (ps > 1 && d < (bike ? 6 : 2.6)) {
    const ux = pv.x / ps, uz = pv.z / ps, along = dx * ux + dz * uz, side = dx * uz - dz * ux;
    if (along > 0 && Math.abs(side) < reach + 0.2) {
      if (homeable && !n.anchor) n.anchor = { x: n.pos.x, z: n.pos.z };
      const s = side >= 0 ? 1 : -1, v = (bike ? 7 : 2.6) * dt;
      n.pos.x += uz * s * v; n.pos.z += -ux * s * v;
      if (bike && n.hop <= 0 && d < 4) {
        n.hop = 0.45;
        if (n.barkT <= 0) { n.barkT = 3; bark(n.char, ['Whoa!', '哎哟!', 'Careful, Duck!'][Math.floor(R() * 3)]); }
      }
      moved = bike ? 7 : 2.6;
    }
  }
  // overlap: push both, the NPC takes most of it; a wall-pinned NPC pushes back fully
  dx = n.pos.x - player.pos.x; dz = n.pos.z - player.pos.z; d = Math.hypot(dx, dz) || 1e-4;
  if (d < reach) {
    if (homeable && !n.anchor) n.anchor = { x: n.pos.x, z: n.pos.z };
    const push = reach - d;
    n.pos.x += dx / d * push * 0.75; n.pos.z += dz / d * push * 0.75;
    collide(n.pos, 0.6);
    dx = n.pos.x - player.pos.x; dz = n.pos.z - player.pos.z; d = Math.hypot(dx, dz) || 1e-4;
    if (d < reach) { player.pos.x -= dx / d * (reach - d); player.pos.z -= dz / d * (reach - d); }
  }
  // drift back once the player has passed
  if (n.anchor && d > reach + 1.5 && moved === 0) {
    const ax = n.anchor.x - n.pos.x, az = n.anchor.z - n.pos.z, a = Math.hypot(ax, az);
    if (a < 0.08) n.anchor = null;
    else { const v = Math.min(a, 1.6 * dt); n.pos.x += ax / a * v; n.pos.z += az / a * v; n.facing = Math.atan2(ax, az); moved = 1.6; }
  }
  return moved;
}

// crowd members never stand inside each other
function separate(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i].pos, c = list[j].pos, dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
    if (d > 0 && d < BODY * 2) { const p = (BODY * 2 - d) / 2; a.x -= dx / d * p; a.z -= dz / d * p; c.x += dx / d * p; c.z += dz / d * p; }
  }
}

export function updateNPCs(dt, t) {
  separate(Object.values(N).filter(n => n.char.root.visible && n.behavior.type !== 'ride' && !n.walk && n.behavior.type !== 'dance'));
  for (const id in N) {
    const n = N[id];
    if (!n.char.root.visible) continue;
    const b = n.behavior;
    let speed = 0;
    if (n.walk && G.skip) {
      n.pos.x = n.walk.x; n.pos.z = n.walk.z;
      const r = n.walk.res; n.walk = null; r();
    } else if (n.walk) {
      const dx = n.walk.x - n.pos.x, dz = n.walk.z - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { const r = n.walk.res; n.walk = null; r(); }
      else {
        const step = Math.min(d, n.walk.speed * dt);
        n.pos.x += dx / d * step; n.pos.z += dz / d * step;
        n.facing = Math.atan2(dx, dz);
        speed = n.walk.speed;
      }
    } else if (b.type === 'wander') {
      if (!b.target || b.wait > 0) {
        b.wait -= dt;
        if (b.wait <= 0 && !b.target) {
          b.target = { x: b.rect.x - b.rect.w / 2 + R() * b.rect.w, z: b.rect.z - b.rect.d / 2 + R() * b.rect.d };
        }
      }
      if (b.target && b.wait <= 0) {
        const dx = b.target.x - n.pos.x, dz = b.target.z - n.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.3 || b.stuck > 2) { b.target = null; b.wait = 1 + R() * 3; b.stuck = 0; }
        else {
          const before = n.pos.clone();
          n.pos.x += dx / d * 1.8 * dt; n.pos.z += dz / d * 1.8 * dt;
          collide(n.pos, 0.6);
          if (n.pos.distanceTo(before) < 0.5 * 1.8 * dt) b.stuck = (b.stuck || 0) + dt;
          n.facing = Math.atan2(dx, dz);
          speed = 1.8;
        }
      }
    } else if (b.type === 'patrol') {
      b.a += b.w * dt;
      n.pos.x = b.cx + Math.cos(b.a) * b.r;
      n.pos.z = b.cz + Math.sin(b.a) * b.r;
      // walk counter-clockwise; look along the tangent
      n.facing = Math.atan2(-Math.sin(b.a), Math.cos(b.a));
      speed = b.r * b.w;
    } else if (b.type === 'ride') {
      const [tx, tz] = b.path[b.i];
      const dx = tx - n.pos.x, dz = tz - n.pos.z, d = Math.hypot(dx, dz);
      if (d < 1) b.i = (b.i + 1) % b.path.length;
      else { n.pos.x += dx / d * b.sp * dt; n.pos.z += dz / d * b.sp * dt; n.facing = Math.atan2(dx, dz); }
      if (dist2(n.pos, player.pos) < 9 && n.barkT <= 0) {
        n.barkT = 25;
        bark(n.char, player.mode === 'bike' ? 'Too slow, Duck! 🫐' : 'Blueberry delivers faster! 🫐');
      }
    } else if (b.type === 'dance') {
      const beat = t * 3.2 + b.phase;
      n.char.body.position.y = Math.abs(Math.sin(beat)) * 0.25;
      n.char.arms[1].rotation.z = 1.8 + Math.sin(beat) * 0.8;
      n.char.arms[0].rotation.z = -1.2 - Math.sin(beat) * 0.6;
      n.facing = Math.sin(t * 0.8) * 0.8;
      if (b.chase > 0) {
        b.chase -= dt;
        const dx = player.pos.x - n.pos.x, dz = player.pos.z - n.pos.z, d = Math.hypot(dx, dz);
        if (d > 1.5) { n.pos.x += dx / d * 7 * dt; n.pos.z += dz / d * 7 * dt; }
        n.facing = Math.atan2(dx, dz);
        if (b.chase <= 0) b.returning = true;
      } else if (b.returning) {
        const dx = n.home.x - n.pos.x, dz = n.home.z - n.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.2) b.returning = false;
        else { n.pos.x += dx / d * 4 * dt; n.pos.z += dz / d * 4 * dt; }
      }
    } else if (b.type === 'idle') {
      if (dist2(n.pos, player.pos) < 7 && !G.flags.cutscene) n.facing = Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z);
    }
    n.barkT -= dt;
    if (!n.walk) speed = Math.max(speed, makeWay(n, b, dt));
    n.char.root.position.set(n.pos.x, 0.1 + (n.hop > 0 ? Math.sin(n.hop / 0.45 * Math.PI) * 0.5 : 0), n.pos.z);
    if (n.hop > 0) n.hop -= dt;
    const want = n.walk || b.type !== 'idle' ? n.facing : cheatFacing(n.facing, n.pos.x, n.pos.z);
    let dr = want - n.char.root.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    n.char.root.rotation.y += dr * Math.min(1, dt * 8);
    if (b.type !== 'dance' && b.type !== 'ride') n.char.animate(dt, speed, t + n.home.x);
  }
}
