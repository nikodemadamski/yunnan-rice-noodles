// Game-feel helpers: dust puffs, camera trauma shake, hit-stop.
// (Juice it or lose it / The Art of Screenshake: trauma² shake, tiny freezes
// on impacts, particles that make movement feel physical.)

import * as THREE from 'three';
import { W } from './world.js';

const POOL = 40;
const puffs = [];
let geo = null, next = 0;

export const feel = { trauma: 0, hitstop: 0 };

function initPool() {
  geo = new THREE.SphereGeometry(0.22, 8, 6);
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f3ead8', transparent: true, opacity: 0, depthWrite: false }));
    m.userData.noShadow = true;
    m.visible = false;
    W.scene.add(m);
    puffs.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
  }
}

/** A small dust puff at a point (feet, wheels, landings). */
export function dust(x, z, n = 2, spread = 0.4, color = '#f3ead8') {
  if (!geo) initPool();
  for (let i = 0; i < n; i++) {
    const p = puffs[next];
    next = (next + 1) % POOL;
    p.m.material.color.set(color);
    p.m.position.set(x + (Math.random() - 0.5) * spread, 0.25, z + (Math.random() - 0.5) * spread);
    p.vx = (Math.random() - 0.5) * 0.8;
    p.vz = (Math.random() - 0.5) * 0.8;
    p.vy = 0.6 + Math.random() * 0.6;
    p.life = 0;
    p.max = 0.45 + Math.random() * 0.25;
    p.m.visible = true;
  }
}

export function addTrauma(v) { feel.trauma = Math.min(1, feel.trauma + v); }
export function hitstop(ms) { feel.hitstop = Math.max(feel.hitstop, ms / 1000); }

/** Camera shake offset for this frame (trauma², smooth noise). */
export function shakeOffset(t) {
  const s = feel.trauma * feel.trauma * 0.6;
  if (s <= 0) return { x: 0, y: 0 };
  return {
    x: s * (Math.sin(t * 25.1) * 0.6 + Math.sin(t * 61.7) * 0.4),
    y: s * (Math.sin(t * 29.3 + 1) * 0.6 + Math.sin(t * 53.9) * 0.4),
  };
}

export function updateFx(dt) {
  feel.trauma = Math.max(0, feel.trauma - dt * 1.5);
  for (const p of puffs) {
    if (!p.m.visible) continue;
    p.life += dt;
    const k = p.life / p.max;
    if (k >= 1) { p.m.visible = false; continue; }
    p.m.position.x += p.vx * dt;
    p.m.position.y += p.vy * dt;
    p.m.position.z += p.vz * dt;
    p.m.scale.setScalar(0.6 + k * 1.4);
    p.m.material.opacity = 0.55 * (1 - k);
  }
}
