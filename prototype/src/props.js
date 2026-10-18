// Set dressing with CC0 models (KayKit City/Restaurant Bits, Kenney Food Kit;
// see assets/CREDITS.md). Models are converted to the same toon material and
// ink outline as everything else, scaled by target height, and loaded in the
// background so the game never waits on them.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { W, P, addCollider } from './world.js';
import { toon, outline } from './characters.js';

const loader = new GLTFLoader();
const cache = new Map();

function load(path) {
  if (!cache.has(path)) {
    const url = new URL(`../assets/${path}`, import.meta.url).href;
    cache.set(path, loader.loadAsync(url).then(gltf => {
      const root = gltf.scene;
      root.traverse(o => {
        if (!o.isMesh) return;
        const m = o.material;
        o.material = toon({ color: m.color, map: m.map || null });
      });
      return root;
    }).catch(err => { console.warn('prop failed', path, err); return null; }));
  }
  return cache.get(path);
}

/** Place a model with its base on the ground (or at y), scaled to height h. */
async function place(path, x, z, { h = 1, y = 0, rot = 0, solid = false, ink = true } = {}) {
  const src = await load(path);
  if (!src) return null;
  const obj = src.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = h / Math.max(size.y, 1e-3);
  obj.scale.setScalar(s);
  obj.position.set(x, y - box.min.y * s, z);
  obj.rotation.y = rot;
  if (ink) outline(obj, 1.04);
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = !o.userData.noShadow;
  });
  W.scene.add(obj);
  if (solid) {
    const b = new THREE.Box3().setFromObject(obj);
    addCollider(b.min.x, b.max.x, b.min.z, b.max.z);
  }
  return obj;
}

// counter-local (lx along the counter, lz towards the customer) → world
function onCounter(st, facing, lx, lz) {
  const c = Math.cos(facing), s = Math.sin(facing);
  return { x: st.x + lx * c + lz * s, z: st.z - lx * s + lz * c };
}
const TOP = 1.1;   // stall counter height (world.js stall())

function dressStall(st, facing, items) {
  for (const [path, lx, lz, h, r = 0] of items) {
    const p = onCounter(st, facing, lx, lz);
    place(path, p.x, p.z, { h, y: TOP, rot: facing + r });
  }
}

export function dressWorld() {
  const chilli = { x: P.chilliStall.x, z: 9.2 }, spud = { x: P.spudStall.x, z: -9.2 };

  // Little Chilli's erkuai stall: steamers, tea, a stool out front
  dressStall(chilli, Math.PI, [
    ['food/steamer.glb', -1.1, 0.1, 0.32],
    ['food/dim-sum.glb', -0.2, 0.3, 0.22, 0.4], ['food/cup-tea.glb', 0.3, 0.45, 0.3],
  ]);
  load('food/steamer.glb').then(() => {                    // stack the second steamer
    const p = onCounter(chilli, Math.PI, -1.1, 0.1);
    place('food/steamer.glb', p.x, p.z, { h: 0.32, y: TOP + 0.3, rot: 0.3 });
  });
  place('kitchen/chair_stool.gltf', chilli.x + 2.4, chilli.z - 1.8, { h: 0.7 });
  place('kitchen/crate_lettuce.gltf', chilli.x + 2.6, chilli.z + 0.2, { h: 0.9, rot: 0.2, solid: true });

  // Uncle Spud's potatoes: skewers on the counter, crates of potatoes beside
  dressStall(spud, 0, [
    ['food/skewer-vegetables.glb', -1.2, 0.35, 0.18, 0.3], ['food/skewer-vegetables.glb', -0.9, 0.45, 0.18, -0.2],
    ['food/skewer-vegetables.glb', -0.6, 0.3, 0.18, 0.1], ['food/cabbage.glb', 1.3, -0.3, 0.45],
  ]);
  place('kitchen/crate_potatoes.gltf', spud.x - 2.6, spud.z - 0.2, { h: 0.9, rot: -0.15, solid: true });
  place('kitchen/crate_onions.gltf', spud.x - 2.7, spud.z + 1.3, { h: 0.85, rot: 0.3, solid: true });

  // Auntie Duan's SIM stall: her tea, always her tea
  dressStall(P.simStall, Math.PI, [['food/cup-tea.glb', -0.9, 0.2, 0.3], ['food/cup-tea.glb', -0.6, 0.35, 0.3, 1]]);
  place('kitchen/chair_stool.gltf', P.simStall.x - 1, P.simStall.z + 0.4, { h: 0.7 });

  // Auntie Fu's restaurant door: produce and a stool for the smokers' corner
  place('kitchen/crate_carrots.gltf', P.fuDoor.x + 3.2, P.fuDoor.z + 0.2, { h: 0.9, solid: true });
  place('kitchen/crate_lettuce.gltf', P.fuDoor.x + 4.5, P.fuDoor.z - 0.1, { h: 0.9, rot: 0.4, solid: true });
  place('kitchen/chair_stool.gltf', P.fuDoor.x - 2.6, P.fuDoor.z + 0.8, { h: 0.7 });

  // The plaza: an open-air noodle corner, steaming bowls and tea on every table
  const TABLE_H = 1.25;
  [[-7, -3], [0, 1], [7, -3], [-3.5, 7], [3.5, 7]].forEach(([dx, dz], i) => {
    const x = P.plaza.x + dx, z = P.plaza.z + dz;
    place('kitchen/table_round_A_small.gltf', x, z, { h: TABLE_H, solid: true });
    place('food/bowl-broth.glb', x - 0.2, z + 0.1, { h: 0.4, y: TABLE_H, rot: i });
    if (i % 2 === 0) place('food/cup-tea.glb', x + 0.4, z - 0.3, { h: 0.26, y: TABLE_H, rot: i * 2 });
    for (let k = 0; k < 3; k++) {
      const a = i + k * Math.PI * 2 / 3;
      place('kitchen/chair_stool.gltf', x + Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, { h: 0.5 });
    }
  });
  for (const [dx, dz] of [[-12, -8], [12, -8], [-12, 12], [12, 12]]) place('city/bush.gltf', P.plaza.x + dx, P.plaza.z + dz, { h: 1.7, solid: true });

  // Streetlights along the big avenues (Grandpa's street keeps its lanterns)
  for (const x of [-55.8, 44.2]) for (let z = -30; z <= 30; z += 15) {
    if (Math.abs(z) < 8) continue;
    place('city/streetlight.gltf', x, z, { h: 7, rot: x < 0 ? Math.PI / 2 : -Math.PI / 2, solid: true });
  }
  for (let x = -40; x <= 40; x += 20) place('city/streetlight.gltf', x, 45.8, { h: 7, rot: Math.PI, solid: true });

  // Benches and bushes round the plaza and the lake promenade
  for (const [x, z, r] of [[P.plaza.x - 6, P.plaza.z + 9, Math.PI], [P.plaza.x + 6, P.plaza.z + 9, Math.PI], [12, -46.6, 0], [46, -46.6, 0]]) {
    place('city/bench.gltf', x, z, { h: 1.1, rot: r, solid: true });
  }
  for (const [x, z] of [[-6.4, 14], [-6.4, 26], [6.4, -14], [6.4, -26], [44, 12], [56, -12], [-44, -26], [-56, 24]]) {
    place('city/bush.gltf', x, z, { h: 1.7, rot: x * z, solid: true });
  }
  for (const [x, z] of [[-6, 6], [6, -6], [44.4, 5.6], [-44.4, -5.6]]) place('city/firehydrant.gltf', x, z, { h: 1.1, solid: true });

  // Parked cars on the outer roads (Kunming has a taxi for every soul)
  for (const [path, x, z, r] of [['city/car_taxi.gltf', 20, 43.6, Math.PI / 2], ['city/car_hatchback.gltf', -22, 43.6, -Math.PI / 2],
    ['city/car_taxi.gltf', 53.6, -22, 0], ['city/car_hatchback.gltf', -46.4, 24, Math.PI]]) {
    place(path, x, z, { h: 2.9, rot: r, solid: true });
  }
  // cardboard boxes stacked by delivery doors
  for (const [x, z] of [[P.jiDoor.x - 2.2, P.jiDoor.z + 0.6], [P.roseDoor.x + 2.2, P.roseDoor.z + 0.6]]) {
    place('city/box_A.gltf', x, z, { h: 0.9, rot: 0.3, solid: true });
    place('city/box_B.gltf', x + 0.3, z, { h: 0.7, y: 0.9, rot: 0.9 });
  }
}
