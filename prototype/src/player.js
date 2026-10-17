// The player on foot or on the Little Yellow Duck e-bike, plus the camera.
// The bike reports "slosh" (sharp turns, bumps, crashes) for the soup meter.

import * as THREE from 'three';
import { makeCharacter, mat } from './characters.js';
import { W, collide } from './world.js';
import { axis } from './input.js';
import { G, clamp } from './core.js';
import { sfx } from './audio.js';

const WALK = 7.5;
const BIKE_MAX = 17;

export const player = {
  char: null,
  bike: null,
  mode: 'foot',
  pos: new THREE.Vector3(),
  heading: 0,        // radians; 0 faces +z (towards the camera)
  speed: 0,
  slosh: 0,          // accumulated since last read (consumed by deliveries)
  bumpCooldown: 0,
  crashCooldown: 0,
  camFocus: null,    // optional override {x, z}
};

function makeBike() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 2.2), mat('#ffd23f'));
  frame.position.y = 0.75;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.4), mat('#333333'));
  deck.position.set(0, 0.55, -0.1);
  const wheelGeo = new THREE.TorusGeometry(0.38, 0.13, 8, 16).rotateY(Math.PI / 2);
  const w1 = new THREE.Mesh(wheelGeo, mat('#222222')); w1.position.set(0, 0.4, 0.95);
  const w2 = new THREE.Mesh(wheelGeo, mat('#222222')); w2.position.set(0, 0.4, -0.95);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), mat('#555555'));
  stem.position.set(0, 1.3, 0.95); stem.rotation.x = -0.25;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), mat('#555555'));
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.82, 0.82);
  // the delivery box with a duck on it
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 128, 128);
  x.font = '80px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('🦆', 64, 60);
  x.fillStyle = '#5b4636'; x.font = '900 18px Nunito, sans-serif'; x.fillText('小黄鸭', 64, 112);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const boxMat = new THREE.MeshLambertMaterial({ map: t });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.0), boxMat);
  crate.position.set(0, 1.85, -0.95);
  g.add(frame, deck, w1, w2, stem, bar, crate);
  g.userData.wheels = [w1, w2];
  return g;
}

export function initPlayer() {
  player.char = makeCharacter({
    skin: '#ffe0cc', shirt: '#4a8f5a', pants: '#3d4f6b', hair: '#d9772b', hairStyle: 'spiky', blush: true,
  });
  W.scene.add(player.char.root);
  player.bike = makeBike();
  player.bike.visible = false;
  W.scene.add(player.bike);
}

export function setMode(mode) {
  player.mode = mode;
  player.speed = 0;
  player.bike.visible = mode === 'bike';
  W.scene.attach(player.char.root);
  if (mode === 'bike') {
    player.bike.add(player.char.root);
    player.char.root.position.set(0, 0.55, -0.15);
    player.char.root.rotation.set(0, 0, 0);
    player.char.arms[0].rotation.x = -1.1;
    player.char.arms[1].rotation.x = -1.1;
  } else {
    player.char.arms[0].rotation.x = 0;
    player.char.arms[1].rotation.x = 0;
  }
}

export function teleport(x, z, heading = 0) {
  player.pos.set(x, 0, z);
  player.heading = heading;
  player.speed = 0;
  syncMeshes(0, 0);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updatePlayer(dt, t) {
  const free = G.busy === 0 && !G.flags.cutscene;
  const a = free ? axis() : { x: 0, z: 0, len: 0 };
  player.bumpCooldown -= dt;
  player.crashCooldown -= dt;

  if (player.mode === 'foot') {
    const vx = a.x * WALK, vz = a.z * WALK;
    player.speed = Math.hypot(vx, vz);
    if (a.len > 0.1) player.heading += angleDiff(player.heading, Math.atan2(a.x, a.z)) * Math.min(1, dt * 12);
    player.pos.x += vx * dt;
    player.pos.z += vz * dt;
    collide(player.pos, 0.7);
  } else {
    const prevHeading = player.heading;
    if (a.len > 0.15) {
      const target = Math.atan2(a.x, a.z);
      const diff = angleDiff(player.heading, target);
      const turnRate = 3.4 - (player.speed / BIKE_MAX) * 1.2;
      player.heading += clamp(diff, -turnRate * dt, turnRate * dt);
      const align = Math.max(0.15, Math.cos(diff));
      const want = a.len * align * BIKE_MAX;
      player.speed += (want - player.speed) * Math.min(1, dt * (want > player.speed ? 1.6 : 2.5));
    } else {
      player.speed *= 1 - Math.min(1, dt * 1.3);
      if (player.speed < 0.2) player.speed = 0;
    }
    const yaw = Math.abs(angleDiff(prevHeading, player.heading)) / Math.max(dt, 1e-4);
    const lateral = player.speed * yaw;
    if (lateral > 16) player.slosh += (lateral - 16) * 0.45 * dt;

    const before = player.pos.clone();
    player.pos.x += Math.sin(player.heading) * player.speed * dt;
    player.pos.z += Math.cos(player.heading) * player.speed * dt;
    const hit = collide(player.pos, 1.0);
    if (hit) {
      const moved = Math.hypot(player.pos.x - before.x, player.pos.z - before.z) / Math.max(dt, 1e-4);
      if (player.speed > 5 && moved < player.speed * 0.6 && player.crashCooldown <= 0) {
        player.slosh += player.speed * 1.1;
        sfx('whack');
        G.flags.lastCrash = t;
        player.crashCooldown = 0.6;
      }
      player.speed *= 0.4;
    }
    // speed bumps
    for (const b of W.bumps) {
      const onLine = b.along === 'x' ? Math.abs(player.pos.x - b.x) < 0.7 && Math.abs(player.pos.z - b.z) < 5
                                     : Math.abs(player.pos.z - b.z) < 0.7 && Math.abs(player.pos.x - b.x) < 5;
      if (onLine && player.bumpCooldown <= 0) {
        player.bumpCooldown = 0.5;
        if (player.speed > 7) {
          player.slosh += (player.speed - 7) * 1.5;
          sfx('bump');
          G.flags.lastBump = t;
        }
      }
    }
  }
  syncMeshes(dt, t);
}

function syncMeshes(dt, t) {
  const c = player.char;
  if (player.mode === 'foot') {
    c.root.position.set(player.pos.x, 0.1, player.pos.z);
    c.root.rotation.y = player.heading;
    c.animate(dt, player.speed, t);
  } else {
    player.bike.position.set(player.pos.x, 0.1, player.pos.z);
    player.bike.rotation.y = player.heading;
    player.bike.rotation.z = 0;
    for (const w of player.bike.userData.wheels) w.rotation.x += player.speed * dt * 2.5;
    const bounce = G.flags.lastBump && t - G.flags.lastBump < 0.3 ? Math.sin((t - G.flags.lastBump) * 30) * 0.15 : 0;
    player.bike.position.y = 0.1 + Math.abs(bounce);
    c.animate(dt, 0, t);
  }
}

const camPos = new THREE.Vector3(0, 30, 30);
const camLook = new THREE.Vector3();

export function updateCamera(dt, snap = false) {
  const f = player.camFocus || player.pos;
  const bike = player.mode === 'bike';
  const ahead = bike ? 4 * player.speed / BIKE_MAX : 0;
  const tx = f.x + Math.sin(player.heading) * ahead;
  const tz = f.z + Math.cos(player.heading) * ahead;
  const h = bike ? 16 : 11.5, back = bike ? 19.5 : 15;
  const k = snap ? 1 : Math.min(1, dt * 4);
  camPos.lerp(new THREE.Vector3(tx, h, tz + back), k);
  camLook.lerp(new THREE.Vector3(tx, 1.5, tz), k);
  W.camera.position.copy(camPos);
  W.camera.lookAt(camLook);
}
