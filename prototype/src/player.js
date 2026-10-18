// The player on foot or on the Little Yellow Duck e-bike, plus the camera.
// The bike reports "slosh" (sharp turns, bumps, crashes) for the soup meter.

import * as THREE from 'three';
import { makeCharacter, mat, toon, outline } from './characters.js';
import { W, collide } from './world.js';
import { axis } from './input.js';
import { G, clamp } from './core.js';
import { sfx } from './audio.js';
import { dust, addTrauma, hitstop, shakeOffset } from './fx.js';

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
  camYaw: 0,         // cutscene camera direction (0 = from the south)
  camShot: null,     // exact camera { pos: {x,y,z}, look: {x,y,z}, speed } for staged shots
  vel: new THREE.Vector3(),
  squash: 0, squashV: 0,   // spring for squash & stretch
  lean: 0,
  stepT: 0,
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
  const boxMat = toon({ map: t });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.0), boxMat);
  crate.position.set(0, 1.85, -0.95);
  g.add(frame, deck, w1, w2, stem, bar, crate);
  g.userData.wheels = [w1, w2];
  outline(g, 1.05);
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
    // quick but not instant: ~70 ms to speed up, ~50 ms to stop (Swink: < 100 ms)
    const moving = a.len > 0.1;
    const k = 1 - Math.exp(-dt * (moving ? 14 : 20));
    const wasStill = player.speed < 0.5;
    player.vel.x += (a.x * WALK - player.vel.x) * k;
    player.vel.z += (a.z * WALK - player.vel.z) * k;
    player.speed = Math.hypot(player.vel.x, player.vel.z);
    const prevHeading = player.heading;
    if (moving) player.heading += angleDiff(player.heading, Math.atan2(a.x, a.z)) * (1 - Math.exp(-dt * 14));
    const yawRate = angleDiff(prevHeading, player.heading) / Math.max(dt, 1e-4);
    player.lean += (clamp(-yawRate * 0.04, -0.15, 0.15) - player.lean) * (1 - Math.exp(-dt * 10));
    if (wasStill && player.speed > 0.5) player.squashV -= 2.2;           // squash on the first step
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;
    collide(player.pos, 0.7);
    player.stepT -= dt;
    if (player.speed > 4 && player.stepT <= 0) { player.stepT = 0.28; dust(player.pos.x, player.pos.z, 2, 0.5); }
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
    const yawSigned = angleDiff(prevHeading, player.heading) / Math.max(dt, 1e-4);
    const yaw = Math.abs(yawSigned);
    const lateral = player.speed * yaw;
    player.lean += (clamp(-yawSigned * player.speed * 0.006, -0.32, 0.32) - player.lean) * (1 - Math.exp(-dt * 8));
    player.stepT -= dt;
    if (player.speed > 8 && player.stepT <= 0) {
      player.stepT = 0.12;
      dust(player.pos.x - Math.sin(player.heading) * 1.2, player.pos.z - Math.cos(player.heading) * 1.2, 1, 0.3);
    }
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
        addTrauma(0.5);
        hitstop(60);
        player.squashV -= 3;
        dust(player.pos.x, player.pos.z, 6, 1.2);
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
          addTrauma(0.25);
          player.squashV -= 2;
          G.flags.lastBump = t;
        }
      }
    }
  }
  syncMeshes(dt, t);
}

function syncMeshes(dt, t) {
  const c = player.char;
  // squash & stretch spring (k=300, d=18: one small overshoot)
  player.squashV += (-300 * player.squash - 18 * player.squashV) * dt;
  player.squash += player.squashV * dt;
  const s = clamp(player.squash, -0.25, 0.25);
  if (player.mode === 'foot') {
    c.root.position.set(player.pos.x, 0.1, player.pos.z);
    // in cutscenes, turn partly towards the camera so the face reads
    let want = player.heading;
    if (G.flags.cine) {
      const cam = W.camera.position;
      want += angleDiff(player.heading, Math.atan2(cam.x - player.pos.x, cam.z - player.pos.z)) * 0.55;
    }
    c.root.rotation.y += angleDiff(c.root.rotation.y, want) * Math.min(1, dt * 10 || 1);
    c.animate(dt, player.speed, t);
    c.body.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
    c.body.rotation.z = player.lean;
  } else {
    player.bike.position.set(player.pos.x, 0.1, player.pos.z);
    player.bike.rotation.y = player.heading;
    player.bike.rotation.z = player.lean;
    player.bike.scale.set(1 - s * 0.3, 1 + s * 0.6, 1 - s * 0.3);
    for (const w of player.bike.userData.wheels) w.rotation.x += player.speed * dt * 2.5;
    const bounce = G.flags.lastBump && t - G.flags.lastBump < 0.3 ? Math.sin((t - G.flags.lastBump) * 30) * 0.15 : 0;
    player.bike.position.y = 0.1 + Math.abs(bounce);
    c.animate(dt, 0, t);
  }
}

const camPos = new THREE.Vector3(0, 30, 30);
const camLook = new THREE.Vector3();
let camYaw = 0;

export function updateCamera(dt, snap = false) {
  const f = player.camFocus || player.pos;
  const bike = player.mode === 'bike';
  const cine = G.flags.cine;
  const ahead = cine ? 0 : bike ? 5 * player.speed / BIKE_MAX : 1.5 * player.speed / WALK;
  const tx = f.x + Math.sin(player.heading) * ahead;
  const tz = f.z + Math.cos(player.heading) * ahead;
  // cutscenes: lower, closer, slightly from the side, like a film camera
  const h = cine ? 5.5 : bike ? 16 : 11.5, back = cine ? 10.5 : bike ? 19.5 : 15, side = cine ? 3 : 0;
  const k = snap ? 1 : 1 - Math.exp(-dt * (cine ? 2.2 : bike ? 4 : 6));
  camYaw += angleDiff(camYaw, cine ? player.camYaw : 0) * (snap ? 1 : 1 - Math.exp(-dt * 2.5));
  const ox = Math.sin(camYaw) * back + Math.cos(camYaw) * side;
  const oz = Math.cos(camYaw) * back - Math.sin(camYaw) * side;
  if (!player.camShot) {
    camPos.lerp(new THREE.Vector3(tx + ox, h, tz + oz), k);
    camLook.lerp(new THREE.Vector3(tx, cine ? 2.3 : 1.5, tz), k);
  }
  if (player.camShot) {
    const s = player.camShot;
    const ks = snap ? 1 : 1 - Math.exp(-dt * (s.speed ?? 3));
    camPos.lerp(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), ks);
    camLook.lerp(new THREE.Vector3(s.look.x, s.look.y, s.look.z), ks);
  }
  const sh = shakeOffset(performance.now() / 1000);
  W.camera.position.set(camPos.x + sh.x, camPos.y + sh.y, camPos.z);
  W.camera.lookAt(camLook.x + sh.x * 0.5, camLook.y + sh.y * 0.5, camLook.z);
  // a little FOV kick at speed on the bike
  const fov = (W.baseFov || 38) + (bike && !cine ? 4 * player.speed / BIKE_MAX : 0);
  if (Math.abs(W.camera.fov - fov) > 0.05) { W.camera.fov += (fov - W.camera.fov) * k; W.camera.updateProjectionMatrix(); }
}
