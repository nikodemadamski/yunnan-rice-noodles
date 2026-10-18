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

// The Little Yellow Duck logo, drawn (a round yellow duckling, not an emoji)
function duckLogo() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const ink = '#3a2a20';
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#e8a800'; x.fillRect(0, 226, 256, 30);
  x.beginPath(); x.arc(128, 108, 92, 0, Math.PI * 2); x.fillStyle = '#fffaf0'; x.fill();
  x.lineWidth = 7; x.strokeStyle = ink; x.stroke();
  x.lineWidth = 6;
  x.beginPath(); x.ellipse(120, 140, 58, 40, 0, 0, Math.PI * 2); x.fillStyle = '#ffcf1f'; x.fill(); x.stroke();   // body
  x.beginPath(); x.moveTo(66, 128); x.quadraticCurveTo(50, 112, 62, 102); x.quadraticCurveTo(72, 118, 80, 122); x.fill(); x.stroke(); // tail
  x.beginPath(); x.arc(150, 82, 38, 0, Math.PI * 2); x.fill(); x.stroke();                                       // head
  x.beginPath(); x.ellipse(110, 140, 26, 16, -0.3, 0, Math.PI * 2); x.fillStyle = '#f5b800'; x.fill(); x.stroke(); // wing
  x.beginPath(); x.moveTo(182, 86); x.quadraticCurveTo(214, 82, 208, 98); x.quadraticCurveTo(196, 106, 180, 100); x.closePath();
  x.fillStyle = '#ff8a1f'; x.fill(); x.stroke();                                                                  // beak
  x.beginPath(); x.arc(158, 74, 6, 0, Math.PI * 2); x.fillStyle = ink; x.fill();
  x.beginPath(); x.arc(160, 72, 2, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
  x.beginPath(); x.ellipse(146, 96, 9, 5, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(255,120,140,.6)'; x.fill();
  x.fillStyle = ink; x.font = '900 34px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('小黄鸭', 128, 222);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wheel(z) {
  const w = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.14, 10, 20).rotateY(Math.PI / 2), mat('#2a2522'));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 14).rotateZ(Math.PI / 2), mat('#c9ced6'));
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.08), mat('#8a9099'));   // shows the spin
  w.add(tyre, hub, spoke);
  w.position.set(0, 0.42, z);
  return w;
}

// A step-through e-scooter in Duck yellow: front shield, floorboard, seat,
// rear delivery box. Front is +z.
function makeBike() {
  const g = new THREE.Group();
  const yellow = mat('#ffd23f'), dark = mat('#3a3430'), chrome = mat('#9aa0a8');
  const cap = (r, len, m, x, y, z, rx = 0, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
    o.position.set(x, y, z); o.rotation.x = rx; o.scale.set(sx, sy, sz);
    g.add(o); return o;
  };
  const w1 = wheel(1.0), w2 = wheel(-0.95);
  g.add(w1, w2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 1.1), dark);
  floor.position.set(0, 0.58, 0.15);
  g.add(floor);
  cap(0.3, 0.75, yellow, 0, 1.08, 0.78, -0.32, 1.35, 1, 0.55);           // front shield
  cap(0.36, 0.7, yellow, 0, 0.82, -0.55, Math.PI / 2, 1.15, 1, 1);        // body under the seat
  cap(0.16, 0.62, mat('#5b3a2a'), 0, 1.2, -0.5, Math.PI / 2, 1.7, 1, 0.7); // seat
  cap(0.14, 0.4, yellow, 0, 0.82, 1.05, Math.PI / 2.4, 1.4, 1, 1);        // front fender
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 8), chrome);
  stem.position.set(0, 1.62, 0.9); stem.rotation.x = -0.3;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.05, 8), chrome);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.95, 0.98);
  g.add(stem, bar);
  for (const sx of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8), dark);
    grip.rotation.z = Math.PI / 2; grip.position.set(sx * 0.48, 1.95, 0.98);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), chrome);
    arm.position.set(sx * 0.36, 2.12, 0.96); arm.rotation.z = -sx * 0.3;
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), chrome);
    mirror.scale.z = 0.4; mirror.position.set(sx * 0.42, 2.28, 0.96);
    g.add(grip, arm, mirror);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff6d8' }));
  lamp.scale.z = 0.5; lamp.position.set(0, 1.42, 1.0); lamp.userData.noOutline = true;
  g.add(lamp);
  // the delivery box on the rear rack
  const logo = toon({ map: duckLogo() });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.9), [mat('#ffd23f'), mat('#ffd23f'), mat('#ffd23f'), mat('#ffd23f'), logo, logo]);
  crate.position.set(0, 1.72, -1.1);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.1, 0.96), mat('#e8a800'));
  lid.position.set(0, 2.2, -1.1);
  g.add(crate, lid);
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
    player.char.root.position.set(0, 0.5, -0.38);
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
    for (const w of player.bike.userData.wheels) w.rotation.x += player.speed * dt * 2.6;
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
