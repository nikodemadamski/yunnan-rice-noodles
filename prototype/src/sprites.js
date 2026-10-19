// Character sprites for the drawn (2D) scenes, rendered from the same 3D
// characters that walk around town: one small offscreen renderer, one render
// per look + mood (cached), each mood with its own body pose. So the kitchen's
// customers, Grandma and Chilli are the real cast, never canvas doodles.

import * as THREE from 'three';
import { makeCharacter } from './characters.js';

const PX_W = 240, PX_H = 330;           // sprite size in canvas units (matches person()'s old box)
const RES = 2;                          // supersampling
let R = null, scene, cam;
const cache = new Map();

function setup() {
  const c = document.createElement('canvas');
  c.width = PX_W * RES; c.height = PX_H * RES;
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setClearColor(0x000000, 0);
  R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0xb59ad6, 1.25));
  const sun = new THREE.DirectionalLight(0xffe2c0, 2.2); sun.position.set(-2, 4, 5); scene.add(sun);
  // a gentle view from slightly above, like the town camera; feet at the bottom edge
  const h = 3.3, w = h * PX_W / PX_H, cy = 1.6, tilt = 0.17;
  cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 50);
  cam.position.set(0, cy + Math.sin(tilt) * 8, Math.cos(tilt) * 8); cam.lookAt(0, cy, 0);
}

// draw2d's look → the 3D character's options
function opts(look) {
  const st = look.style;
  return {
    skin: look.skin, shirt: look.shirt, hair: look.hair, pants: look.pants || '#4a4f5a',
    hairStyle: st === 'cap' ? 'short' : st, hat: st === 'cap' ? 'cap' : 'none', hatColor: look.cap,
    glasses: !!look.glasses, skirt: !!look.skirt, blush: true, wide: look.wide || 1,
  };
}

// body language per mood: arms, head, lean
const POSES = {
  normal: (c) => {},
  happy: (c) => { c.arms[0].rotation.z = -2.3; c.arms[1].rotation.z = 2.3; },                       // arms up!
  sad: (c) => { c.head.rotation.x = 0.18; c.body.rotation.x = 0.1; c.arms[0].rotation.z = 0.15; c.arms[1].rotation.z = -0.15; },
  cry: (c) => { c.head.rotation.x = 0.3; c.arms[0].rotation.x = -2.2; c.arms[1].rotation.x = -2.2; },
  angry: (c) => { c.arms[0].rotation.z = -0.9; c.arms[1].rotation.z = 0.9; c.arms[0].rotation.x = 0.6; c.arms[1].rotation.x = 0.6; c.head.rotation.x = 0.12; },   // hands on hips
  shock: (c) => { c.arms[0].rotation.z = -1.4; c.arms[1].rotation.z = 1.4; c.head.rotation.x = -0.15; },
  smug: (c) => { c.arms[0].rotation.x = -0.4; c.arms[0].rotation.z = 1.1; c.arms[1].rotation.x = -0.4; c.arms[1].rotation.z = -1.1; c.head.rotation.z = 0.12; },   // arms folded
  think: (c) => { c.arms[1].rotation.x = -2.4; c.arms[1].rotation.z = 0.6; c.head.rotation.z = 0.15; },   // hand on chin
  blank: (c) => {},
};
const FACE = { normal: 'normal', happy: 'happy', sad: 'sad', cry: 'cry', angry: 'angry', shock: 'shock', smug: 'smug', think: 'normal', blank: 'blank' };

/** A cached sprite canvas (PX_W × PX_H, feet at the bottom centre). */
export function charSprite(look, mood = 'normal') {
  const key = JSON.stringify(look) + '|' + mood;
  if (cache.has(key)) return cache.get(key);
  if (!R) setup();
  const ch = makeCharacter(opts(look));
  ch.setFace(FACE[mood] || 'normal');
  (POSES[mood] || POSES.normal)(ch);
  ch.root.rotation.y = 0.18;                    // a touch of three-quarter
  ch.root.children.forEach(o => { if (o.material?.opacity === 0.12) o.visible = false; });   // no ground shadow in the sprite
  scene.add(ch.root);
  R.render(scene, cam);
  scene.remove(ch.root);
  const out = document.createElement('canvas');
  out.width = PX_W * RES; out.height = PX_H * RES;
  out.getContext('2d').drawImage(R.domElement, 0, 0);
  cache.set(key, out);
  return out;
}

export const SPRITE = { w: PX_W, h: PX_H, top: -140 };   // in person() units: x −120..120, y −140..190
