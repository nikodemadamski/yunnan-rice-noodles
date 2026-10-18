// Spring in Kunming, the "City of Eternal Spring": flower beds round every
// tree, flower boxes along the pavements, and cherry petals drifting past the
// camera. Small, soft, everywhere: the clutter that makes a town feel loved.

import * as THREE from 'three';
import { W, P, addCollider } from './world.js';
import { toon } from './characters.js';
import { rng } from './core.js';
import { grass } from './textures.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

const R = rng(31);
const PETALS = ['#ffffff', '#ffd1e0', '#fff1a8', '#d9c7ff', '#ffb3c7', '#ffc98f'];

let petals = null;

function flowerField(spots) {
  // one instanced mesh for blooms, one for leaves
  const n = spots.length;
  const bloom = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#ffffff' }), n);
  const leaf = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), toon({ color: '#6cbf55' }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  spots.forEach(([x, y, z, col], i) => {
    const s = 0.8 + R() * 0.5;
    m.compose(new THREE.Vector3(x, y + 0.28 * s, z), q, new THREE.Vector3(s, s * 0.7, s));
    bloom.setMatrixAt(i, m);
    bloom.setColorAt(i, c.set(col));
    m.compose(new THREE.Vector3(x + 0.05, y + 0.1, z), q, new THREE.Vector3(s * 1.2, s * 0.5, s * 1.2));
    leaf.setMatrixAt(i, m);
  });
  for (const o of [bloom, leaf]) { o.receiveShadow = true; o.userData.noShadow = true; W.scene.add(o); }
}

// little three-blade tufts (Stardew's grass), instanced
function grassTufts(spots) {
  const blade = (rz, ry, h) => new THREE.ConeGeometry(0.05, h, 4).translate(0, h / 2, 0).rotateZ(rz).rotateY(ry);
  const geo = mergeGeometries([blade(0.25, 0, 0.42), blade(-0.3, 0.6, 0.36), blade(0.05, 2.1, 0.5), blade(-0.15, 3.6, 0.3)]);
  const m = new THREE.InstancedMesh(geo, toon({ color: '#ffffff' }), spots.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const GREENS = ['#5fa848', '#6fb954', '#4f9a3e', '#82c766'];
  spots.forEach(([x, y, z], i) => {
    const s = 0.8 + R() * 0.7;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.3);
    mx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    m.setMatrixAt(i, mx); m.setColorAt(i, c.set(GREENS[Math.floor(R() * GREENS.length)]));
  });
  m.userData.noShadow = true; m.receiveShadow = true;
  W.scene.add(m);
}

export function initDecor() {
  const spots = [];
  // a ring of flowers round every street tree
  for (const t of W.trees) {
    const col = PETALS[Math.floor(R() * PETALS.length)];
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + R() * 0.3, r = 0.65 + R() * 0.35;
      spots.push([t.x + Math.cos(a) * r, 0.16, t.z + Math.sin(a) * r, R() < 0.75 ? col : PETALS[Math.floor(R() * PETALS.length)]]);
    }
  }
  // flower boxes on the pavement edges of Grandpa's street and the avenues
  const boxMat = toon({ color: '#ffffff' }), soil = toon({ color: '#8a5a3b' });
  const boxes = [];
  for (let x = -38; x <= 38; x += 12) for (const z of [-6.9, 6.9]) {
    const bx = x + 3;
    if ([P.chilliStall, P.spudStall, P.shopFront, P.wangFront, P.fuDoor].some(p => Math.abs(bx - p.x) < 4.5)) continue;
    if ([-50, 0, 50].some(rx => Math.abs(bx - rx) < 7.5)) continue;          // keep crossings clear
    boxes.push([bx, z]);
  }
  for (const [x, z] of boxes) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.7), boxMat);
    b.position.set(x, 0.43, z);
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.55), soil);
    s.position.set(x, 0.71, z);
    W.scene.add(b, s);
    addCollider(x - 1.1, x + 1.1, z - 0.35, z + 0.35);
    const col = PETALS[Math.floor(R() * PETALS.length)];
    for (let k = 0; k < 7; k++) spots.push([x - 0.9 + k * 0.3 + (R() - 0.5) * 0.1, 0.62, z + (R() - 0.5) * 0.3, col]);
  }
  // a ring of lawn round the plaza (Animal Crossing park), and grass tufts
  const lawnT = grass(); lawnT.repeat.set(6, 6);
  const lawn = new THREE.Mesh(new THREE.RingGeometry(10.8, 15.4, 64, 1).rotateX(-Math.PI / 2), toon({ color: '#ffffff', map: lawnT }));
  lawn.scale.z = 0.75; lawn.position.set(P.plaza.x, 0.175, P.plaza.z);
  W.scene.add(lawn);
  const edge = new THREE.Mesh(new THREE.RingGeometry(15.4, 15.75, 64, 1).rotateX(-Math.PI / 2), toon({ color: '#d9c7a6' }));
  edge.scale.z = 0.75; edge.position.set(P.plaza.x, 0.18, P.plaza.z);
  const edge2 = edge.clone(); edge2.geometry = new THREE.RingGeometry(10.45, 10.8, 64, 1).rotateX(-Math.PI / 2);
  W.scene.add(edge, edge2);
  const tufts = [];
  for (let k = 0; k < 260; k++) {
    const a = R() * Math.PI * 2, rr = 11.2 + R() * 3.9;
    tufts.push([P.plaza.x + Math.cos(a) * rr, 0.18, P.plaza.z + Math.sin(a) * rr * 0.75]);
  }
  for (const t of W.trees) for (let k = 0; k < 4; k++) { const a = R() * 6.3, rr = 1.1 + R() * 0.5; tufts.push([t.x + Math.cos(a) * rr, 0.16, t.z + Math.sin(a) * rr]); }
  grassTufts(tufts);

  // flower beds round the plaza
  for (let k = 0; k < 80; k++) {
    const a = R() * Math.PI * 2, r = 13 + R() * 1.5;
    spots.push([P.plaza.x + Math.cos(a) * r, 0.16, P.plaza.z + Math.sin(a) * r * 0.75, PETALS[Math.floor(R() * PETALS.length)]]);
  }
  flowerField(spots);

  // drifting cherry petals around the camera
  const N = 90;
  const geo = new THREE.PlaneGeometry(0.16, 0.11);
  petals = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffc4d6', side: THREE.DoubleSide, transparent: true, opacity: 0.9, fog: false }), N);
  petals.userData.noShadow = true;
  petals.frustumCulled = false;
  petals.data = Array.from({ length: N }, () => ({ x: (R() - 0.5) * 40, y: R() * 12, z: (R() - 0.5) * 40, s: R() * 6, v: 0.6 + R() * 0.6 }));
  W.scene.add(petals);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _zero = new THREE.Vector3(0, 0, 0);

export function updateDecor(dt, t, focus) {
  if (!petals) return;
  petals.visible = !W.night && Math.abs(focus.x) < 150;   // not indoors in Dublin
  if (!petals.visible) return;
  petals.data.forEach((d, i) => {
    d.y -= d.v * dt;
    d.x += Math.sin(t * 0.8 + d.s) * 0.6 * dt + 0.5 * dt;   // a little breeze from the west
    d.z += Math.cos(t * 0.6 + d.s) * 0.4 * dt;
    let wx = focus.x + d.x, wz = focus.z + d.z;
    if (d.y < 0.1 || Math.abs(d.x) > 20 || Math.abs(d.z) > 20) { d.y = 8 + R() * 5; d.x = (R() - 0.5) * 40; d.z = (R() - 0.5) * 40; wx = focus.x + d.x; wz = focus.z + d.z; }
    _e.set(t * 2 + d.s, t * 1.3 + d.s, d.s);
    // a petal right in front of the lens reads as a giant pink card: hide those
    const c = W.camera.position, near = Math.hypot(wx - c.x, d.y - c.y, wz - c.z) < 7;
    _m.compose(_p.set(wx, d.y, wz), _q.setFromEuler(_e), near ? _zero : _s);
    petals.setMatrixAt(i, _m);
  });
  petals.instanceMatrix.needsUpdate = true;
}
