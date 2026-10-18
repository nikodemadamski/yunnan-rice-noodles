// The Kunming neighbourhood: roads, blocks, landmarks, NPC registry,
// collisions, day/night and the delivery marker.

import * as THREE from 'three';
import { mat, toon } from './characters.js';
import { rng } from './core.js';

export const W = {
  scene: null, camera: null, renderer: null,
  colliders: [], bumps: [], npcs: {}, lanterns: [], windowMats: [], neon: [], buildings: [],
  gulls: [], night: false, marker: null, markerTarget: null,
};

const R = rng(22);

// Roads run along x = -50, 0, 50 and z = -40, 0, 40 (10 wide).
// Blocks sit between them.
const XS = [[-85, -55], [-45, -5], [5, 45], [55, 85]];
const ZS = [[-85, -45], [-35, -5], [5, 35], [45, 85]];

export const P = {
  start: { x: -48, z: 3 },
  shopFront: { x: -15, z: -7 },
  shopDoor: { x: -15, z: -8.6 },
  wangFront: { x: -15, z: 7.5 },
  chilliStall: { x: -28, z: 6.8 },
  spudStall: { x: -28, z: -6.8 },
  simStall: { x: -42.5, z: 9.2 },
  fuDoor: { x: 15, z: -7.5 },
  jiDoor: { x: 58, z: -20 },
  roseDoor: { x: -58, z: -20 },
  aunties: { x: 25, z: 0 },
  market: { x: 25, z: 64, w: 34, d: 36 },
  courtyard: { x: 70, z: 20 },
  bfBench: { x: 79.5, z: 20 },
  lakeBench: { x: 30, z: -46.6 },
  duckTree: { x: 35, z: -47.2 },
  plaza: { x: 25, z: 20 },
};

export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  Object.assign(W, { renderer, scene, camera });

  // warm low side sun + soft sky fill; the sun's shadow box follows the player
  W.hemi = new THREE.HemisphereLight(0xfff1d6, 0x9bbf7a, 1.3);
  W.sun = new THREE.DirectionalLight(0xfff0d0, 2.8);
  W.sun.castShadow = true;
  const phone = Math.min(innerWidth, innerHeight) < 700;
  W.sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(W.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
  W.sun.shadow.bias = -0.0005;
  W.sun.shadow.normalBias = 0.03;
  scene.add(W.hemi, W.sun, W.sun.target);
  scene.fog = new THREE.FogExp2(0xcfe9ff, 0.0062);

  buildGround();
  buildBlocks();
  buildLandmarks();
  buildTrees();
  buildLanterns();
  buildBumps();
  buildLake();
  buildMarker();
  bounds();
  setNight(false);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = W.baseFov = camera.aspect < 0.8 ? 52 : 38;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
}

// ---------- helpers ----------

function box(w, h, d, color, x, y, z, collide = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  W.scene.add(m);
  if (collide) addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  return m;
}

export function addCollider(x0, x1, z0, z1, tag) {
  W.colliders.push({ x0, x1, z0, z1, tag });
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSign(lines, { bg = '#c0392b', fg = '#fff5d6', w = 6, h = 1.6, glow = false } = {}) {
  const tex = canvasTex(512, Math.round(512 * h / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, cw - 20, ch - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      const size = i === 0 ? ch * (n > 1 ? 0.38 : 0.55) : ch * 0.2;
      g.font = `900 ${size}px "Nunito", "PingFang SC", "Microsoft YaHei", sans-serif`;
      const y = n === 1 ? ch / 2 : i === 0 ? ch * 0.38 : ch * 0.38 + ch * 0.32 * i;
      g.fillText(ln, cw / 2, y, cw - 40);
    });
  });
  const m = new THREE.MeshBasicMaterial({ map: tex, color: glow ? 0xffffff : 0xdddddd });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  if (glow) W.neon.push(m);
  return mesh;
}

let windowTex = null, windowGlowTex = null;
function windowTextures() {
  if (windowTex) return;
  windowTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#9cc7e0'; g.fillRect(16, 14, 32, 30);
    g.fillStyle = '#ffffff'; g.fillRect(31, 14, 2, 30);
    g.fillStyle = '#d9cbb3'; g.fillRect(12, 44, 40, 5);
  });
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowGlowTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ffcf6b'; g.fillRect(16, 14, 32, 30);
  });
  windowGlowTex.colorSpace = THREE.NoColorSpace;
  windowGlowTex.wrapS = windowGlowTex.wrapT = THREE.RepeatWrapping;
}

const WALLS = ['#f4ead8', '#efd9c0', '#e8c9a8', '#f7f1e6', '#dfe8ee', '#f1d4c4', '#e6e0cf'];
const ROOFS = ['#5d6a75', '#7b4b3a', '#4f5d4c', '#6b5a7a'];

function building(x, z, w, d, h, opts = {}) {
  windowTextures();
  const wall = opts.wall || WALLS[Math.floor(R() * WALLS.length)];
  const tex = windowTex.clone();
  tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
  const glow = windowGlowTex.clone();
  glow.repeat.copy(tex.repeat);
  const side = toon({ color: wall, map: tex, emissive: 0xffb347, emissiveMap: glow, emissiveIntensity: 0 });
  const top = mat(opts.roof || ROOFS[Math.floor(R() * ROOFS.length)]).clone();
  W.windowMats.push(side);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  m.position.set(x, h / 2, z);
  W.scene.add(m);
  addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  const rec = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, mats: [side, top], roof: null, faded: false };
  W.buildings.push(rec);
  if (opts.pitched ?? R() < 0.45) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.02, Math.min(w, d) * 0.45, 4).rotateY(Math.PI / 4), top);
    roof.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
    roof.position.set(x, h + Math.min(w, d) * 0.225, z);
    W.scene.add(roof);
    rec.roof = roof;
    rec.h += Math.min(w, d) * 0.45;
  }
  return m;
}

// ---------- ground & roads ----------

function buildGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat('#a7d36f'));
  ground.rotation.x = -Math.PI / 2;
  W.scene.add(ground);

  const road = mat('#b9b2a7');
  const line = mat('#fffaf0');
  for (const z of [-40, 0, 40]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(180, 0.1, 10), road);
    r.position.set(0, 0.03, z); W.scene.add(r);
    for (let x = -86; x < 86; x += 6) box(2.5, 0.05, 0.3, line, x, 0.09, z);
  }
  for (const x of [-50, 0, 50]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 180), road);
    r.position.set(x, 0.035, 0); W.scene.add(r);
    for (let z = -86; z < 86; z += 6) box(0.3, 0.05, 2.5, line, x, 0.095, z);
  }
  // pavement slabs on every block
  const pave = mat('#ece1cc');
  XS.forEach(([x0, x1], i) => ZS.forEach(([z0, z1], j) => {
    if (i >= 1 && j === 0) z0 = -48.4;          // lake blocks keep only a promenade strip
    const s = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.16, z1 - z0), pave);
    s.position.set((x0 + x1) / 2, 0.08, (z0 + z1) / 2);
    W.scene.add(s);
  }));
}

function bounds() {
  addCollider(-200, -88, -200, 200);
  addCollider(88, 200, -200, 200);
  addCollider(-200, 200, -200, -88);
  addCollider(-200, 200, 88, 200);
}

// ---------- blocks ----------

function fillBlock(x0, x1, z0, z1, exclude = []) {
  const cell = 10;
  const nx = Math.max(1, Math.round((x1 - x0) / cell));
  const nz = Math.max(1, Math.round((z1 - z0) / cell));
  const cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = x0 + cw * (i + 0.5), cz = z0 + cd * (j + 0.5);
    const inner = i > 0 && i < nx - 1 && j > 0 && j < nz - 1;
    if (inner && R() < 0.6) continue;
    const hit = exclude.some(e => cx > e[0] - cw / 2 && cx < e[1] + cw / 2 && cz > e[2] - cd / 2 && cz < e[3] + cd / 2);
    if (hit) continue;
    const w = cw - 1.5 - R() * 1.5, d = cd - 1.5 - R() * 1.5;
    building(cx, cz, w, d, 5 + R() * 9);
  }
}

function buildBlocks() {
  const SPECIAL = {
    '1,1': [[-45, -5, -12, -5]],          // grandpa's street frontage
    '1,2': [[-45, -5, 5, 14]],            // Wang + stalls frontage
    '2,1': [[5, 45, -12, -5]],            // Auntie Fu frontage
    '2,2': 'plaza',
    '3,1': [[55, 62, -35, -5]],
    '0,1': [[-62, -55, -35, -5]],
    '3,2': 'courtyard',
    '2,3': 'market',
    '1,0': 'lake', '2,0': 'lake', '3,0': 'lake',
  };
  XS.forEach(([x0, x1], i) => ZS.forEach(([z0, z1], j) => {
    const s = SPECIAL[`${i},${j}`];
    if (typeof s === 'string') return;
    fillBlock(x0 + 1, x1 - 1, z0 + 1, z1 - 1, s || []);
  }));
  // a row of smaller shops along grandpa's street (north side) and Fu's side
  building(-38, -16, 7, 8, 6 + R() * 3, { pitched: true });
  building(-8, -16, 5, 8, 6 + R() * 3, { pitched: true });
  for (const x of [26, 38]) building(x, -16, 8, 8, 6 + R() * 4, { pitched: true });
  for (const x of [-38]) building(x, 18, 8, 8, 7, { pitched: true });
}

// ---------- landmarks ----------

export function stall(x, z, facing, color, sign, tilt = 0) {
  const g = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 1.6), mat('#a8754a'));
  counter.position.y = 0.55;
  const awning = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 2.4), mat(color));
  awning.position.set(0, 2.7, 0.2);
  awning.rotation.x = 0.18;
  for (const px of [-1.7, 1.7]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), mat('#6b4a2f'));
    pole.position.set(px, 1.3, -0.6);
    g.add(pole);
  }
  const s = makeSign(sign, { bg: color, w: 3.4, h: 0.9 });
  s.position.set(0, 3.25, 1.0);
  s.rotation.z = tilt;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.4, 12), mat('#555555'));
  pot.position.set(0.8, 1.3, 0);
  g.add(counter, awning, s, pot);
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  W.scene.add(g);
  addCollider(x - 1.9, x + 1.9, z - 1, z + 1);
  return g;
}

function buildLandmarks() {
  // Old Zhao's shop: shuttered
  building(-15, -13.5, 10, 9, 7, { wall: '#efe4cf', roof: '#7b4b3a', pitched: true });
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.2), toon({
    map: canvasTex(256, 160, (g) => {
      g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 256, 160);
      g.strokeStyle = '#7d8389'; g.lineWidth = 3;
      for (let y = 8; y < 160; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
      g.fillStyle = '#c0392b'; g.font = '900 22px Nunito, sans-serif'; g.textAlign = 'center';
      g.fillText('转让 · FOR LEASE', 128, 90);
    }),
  }));
  shutter.position.set(-15, 2.1, -8.98);
  W.scene.add(shutter);
  const sign = makeSign(['老赵过桥米线', "OLD ZHAO'S CROSS-BRIDGE NOODLES"], { bg: '#2f5d50', w: 8, h: 1.6 });
  sign.position.set(-15, 5.4, -8.95);
  W.scene.add(sign);
  // a folding stool on the kerb
  box(0.8, 0.5, 0.8, '#3b6fb6', -11.5, 0.25, -6.5);

  // Wang's Supreme Mega chain: loud, neon, gold
  building(-15, 14.5, 14, 9, 10, { wall: '#ffe7f3', roof: '#ffcc00', pitched: false });
  const neon = makeSign(['超级至尊过桥米线', 'SUPREME MEGA CROSS-BRIDGE NOODLE · 48 TOPPINGS!'], { bg: '#ff2d8a', fg: '#fff35c', w: 12, h: 2.4, glow: true });
  neon.position.set(-15, 8, 9.95);
  neon.rotation.y = Math.PI;
  W.scene.add(neon);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.5), mat('#ffd700'));
  door.position.set(-15, 1.75, 9.96); door.rotation.y = Math.PI;
  W.scene.add(door);
  for (const x of [-21, -9]) {
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), mat('#ff2d8a'));
    balloon.position.set(x, 6.5, 9.4);
    W.scene.add(balloon);
  }

  // Street stalls (Little Chilli's sign is falling apart)
  stall(P.chilliStall.x, 9.2, Math.PI, '#d63c2f', ['小辣烧饵块', "LITTLE CHILLI'S ERKUAI"], 0.18);
  stall(P.spudStall.x, -9.2, 0, '#a86b2d', ['土豆叔炸洋芋', "UNCLE SPUD'S FRIED POTATOES"]);
  stall(P.simStall.x, P.simStall.z, Math.PI, '#2f6fb6', ['段阿姨手机卡', "AUNTIE DUAN'S SIM CARDS"]);

  // Auntie Fu's small-pot noodles
  building(15, -14, 10, 8, 7, { wall: '#f6e3c6', roof: '#7b4b3a', pitched: true });
  const fu = makeSign(['傅阿姨小锅米线', "AUNTIE FU'S SMALL-POT NOODLES"], { bg: '#b83b2e', w: 8, h: 1.5 });
  fu.position.set(15, 4.5, -9.95); W.scene.add(fu);
  box(4, 3, 0.1, '#6b4a2f', 15, 1.5, -9.97);

  // Steam-pot chicken house (faces west onto x=50 road)
  building(64, -20, 10, 12, 8, { wall: '#efe7d6', roof: '#4f5d4c', pitched: true });
  const ji = makeSign(['老纪汽锅鸡', "UNCLE JI'S STEAM-POT CHICKEN"], { bg: '#7a4e2d', w: 9, h: 1.6 });
  ji.position.set(58.95, 5, -20); ji.rotation.y = -Math.PI / 2; W.scene.add(ji);
  box(0.1, 3, 4, '#5a3b22', 58.97, 1.5, -20);

  // Flower cake bakery (faces east onto x=-50 road)
  building(-64, -20, 10, 12, 7, { wall: '#fde3ec', roof: '#c25b7a', pitched: true });
  const rose = makeSign(['玫瑰鲜花饼', "ROSE'S FLOWER CAKES"], { bg: '#d9577f', w: 8, h: 1.6 });
  rose.position.set(-58.95, 4.6, -20); rose.rotation.y = Math.PI / 2; W.scene.add(rose);
  box(0.1, 3, 4, '#a14462', -58.97, 1.5, -20);

  // Plaza: benches and a speaker for the dancing aunties
  for (const [x, z] of [[12, 28], [38, 28], [12, 12], [38, 12]]) box(3, 0.5, 1, '#8a6a4a', x, 0.5, z, true);
  box(1.2, 1.6, 1.2, '#333333', 32, 0.8, 6.5, true);

  // Courtyard with fountain (west entrance gap z 15..25)
  const wall = '#d9cdb5';
  box(26, 2, 1, wall, 70, 1, 7.5, true);
  box(26, 2, 1, wall, 70, 1, 32.5, true);
  box(1, 2, 25, wall, 82.5, 1, 20, true);
  box(1, 2, 8, wall, 57.5, 1, 11, true);
  box(1, 2, 8, wall, 57.5, 1, 29, true);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.9, 24), mat('#cfd8dc'));
  fountain.position.set(70, 0.45, 20); W.scene.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 24), mat('#7cc4e0'));
  water.position.set(70, 0.92, 20); W.scene.add(water);
  addCollider(67.4, 72.6, 17.4, 22.6);
  box(1, 0.5, 3, '#8a6a4a', 80.6, 0.5, 20, true);
  const cy = makeSign(['翠竹小院', 'BAMBOO COURTYARD'], { bg: '#3f7d4f', w: 5, h: 1.2 });
  cy.position.set(57, 3, 20); cy.rotation.y = -Math.PI / 2; W.scene.add(cy);

  // Market: rows of awning stalls
  const awn = ['#e94b3c', '#3fa7d6', '#f6c90e', '#59b36b', '#f08a4b'];
  let k = 0;
  for (const z of [55, 72]) for (let x = 11; x <= 39; x += 7) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), mat('#b08559'));
    c.position.y = 0.5;
    const a = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.15, 3), mat(awn[k++ % awn.length]));
    a.position.y = 2.6;
    const veg = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mat(['#7cc35b', '#e2574c', '#f0a43a'][k % 3]));
    veg.position.set(0, 1.2, 0); veg.scale.y = 0.5;
    g.add(c, a, veg);
    g.position.set(x, 0, z);
    W.scene.add(g);
    addCollider(x - 2, x + 2, z - 1, z + 1);
  }
  const mk = makeSign(['篆新农贸市场', 'ZHUANXIN MARKET'], { bg: '#2e7d32', w: 7, h: 1.5 });
  mk.position.set(25, 4, 45.6); W.scene.add(mk);
}

// ---------- trees, lanterns, bumps ----------

function tree(x, z, duck = false) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2, 8), mat('#8a5a3b'));
  trunk.position.set(x, 1, z);
  W.scene.add(trunk);
  if (duck) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), mat('#4f9a3a'));
    body.scale.set(1.3, 0.9, 1); body.position.set(x, 3, z);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), mat('#4f9a3a'));
    headM.position.set(x + 1.6, 4.3, z + 0.2);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), mat('#ff9a1f'));
    beak.rotation.z = -Math.PI / 2; beak.position.set(x + 2.7, 4.2, z + 0.2);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 8), mat('#4f9a3a'));
    tail.rotation.z = Math.PI / 2.6; tail.position.set(x - 2.1, 3.6, z);
    W.scene.add(body, headM, beak, tail);
  } else {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.4 + R() * 0.5, 12, 10), mat(R() < 0.25 ? '#f7b6c8' : '#5aa543'));
    c.position.set(x, 2.8, z);
    W.scene.add(c);
  }
  addCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
}

function buildTrees() {
  const ok = (x, z) => !W.colliders.some(c => x > c.x0 - 1.2 && x < c.x1 + 1.2 && z > c.z0 - 1.2 && z < c.z1 + 1.2);
  for (const zr of [-46.2, -33.8, -6.2, 6.2, 33.8, 46.2]) {
    for (let x = -82; x < 84; x += 9) {
      if (Math.abs(x + 50) < 7 || Math.abs(x) < 7 || Math.abs(x - 50) < 7) continue;
      if (zr === -46.2 && x > -48) continue;          // lakeside handled separately
      if (Math.abs(zr) === 6.2 && x > -34 && x < 34) continue; // keep grandpa's street open
      if (R() < 0.35 || !ok(x, zr)) continue;
      tree(x, zr);
    }
  }
  for (const xr of [-56.2, -43.8, -6.2, 6.2, 43.8, 56.2]) {
    for (let z = -82; z < 84; z += 9) {
      if (Math.abs(z + 40) < 7 || Math.abs(z) < 7 || Math.abs(z - 40) < 7 || z < -46) continue;
      if (R() < 0.4 || !ok(xr, z)) continue;
      tree(xr, z);
    }
  }
  tree(P.duckTree.x, P.duckTree.z, true);
  for (const x of [-40, -20, 5, 15, 50, 65, 78]) tree(x, -46.8);
}

function buildLanterns() {
  const geo = new THREE.SphereGeometry(0.42, 12, 10);
  for (let x = -40; x <= 40; x += 6) {
    for (const z of [-5.6, 5.6]) {
      if (Math.abs(x - P.chilliStall.x) < 3 || Math.abs(x - P.spudStall.x) < 3) continue;
      const m = toon({ color: '#d8322a', emissive: '#ff5a2a', emissiveIntensity: 0 });
      const l = new THREE.Mesh(geo, m);
      l.scale.y = 1.2;
      l.position.set(x, 4.2, z);
      W.scene.add(l);
      W.lanterns.push(m);
      if ((x + 40) % 12 === 0) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 6), mat('#4a3a2c'));
        pole.position.set(x, 2.3, z + Math.sign(z) * 0.2);
        W.scene.add(pole);
      }
    }
  }
}

function buildBumps() {
  const tex = canvasTex(64, 16, (g) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#222' : '#ffd23f'; g.fillRect(i * 8, 0, 8, 16); }
  });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(4, 1);
  const m = toon({ map: tex });
  const spots = [
    { x: -50, z: -22, along: 'z' }, { x: 0, z: 22, along: 'z' }, { x: 50, z: -12, along: 'z' },
    { x: 35, z: -40, along: 'x' }, { x: -32, z: 40, along: 'x' }, { x: 50, z: 26, along: 'z' },
    { x: -62, z: 0, along: 'x' }, { x: 8, z: 0, along: 'x' },
  ];
  for (const s of spots) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(s.along === 'x' ? 0.8 : 10, 0.22, s.along === 'x' ? 10 : 0.8), m);
    b.position.set(s.x, 0.11, s.z);
    W.scene.add(b);
    W.bumps.push(s);
  }
}

function buildLake() {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(130, 37), toon({ color: '#76c2dc' }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(20, 0.12, -66.5);
  W.scene.add(water);
  W.water = water;
  addCollider(-45, 85, -85, -48.4, 'lake');
  // zig-zag bridge (decorative)
  const pts = [[10, -48], [14, -54], [8, -60], [14, -66], [10, -72]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const deck = box(2, 0.3, len, '#f2ead8', (ax + bx) / 2, 0.5, (az + bz) / 2);
    deck.rotation.y = Math.atan2(bx - ax, bz - az);
  }
  const s = makeSign(['翠湖', 'GREEN LAKE'], { bg: '#2f6f8f', w: 4, h: 1.2 });
  s.position.set(0, 2.2, -46); W.scene.add(s);
  box(0.2, 1.6, 0.2, '#4a3a2c', 0, 0.8, -46.2);
  // bench for Mr Li
  box(3, 0.5, 1, '#8a6a4a', P.lakeBench.x, 0.5, P.lakeBench.z - 0.6);
  addCollider(P.lakeBench.x - 1.5, P.lakeBench.x + 1.5, P.lakeBench.z - 1.1, P.lakeBench.z - 0.2);
  // the last gulls of the season
  const gullMat = mat('#ffffff');
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.3), gullMat);
      wing.position.x = s * 0.45;
      g.add(wing);
    }
    W.scene.add(g);
    W.gulls.push({ g, r: 6 + R() * 18, a: R() * 6.28, h: 5 + R() * 4, sp: 0.3 + R() * 0.4, cx: 5 + R() * 40, cz: -64 + R() * 10 });
  }
}

// ---------- delivery marker ----------

function buildMarker() {
  const g = new THREE.Group();
  const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), toon({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 0.5 }));
  pin.scale.y = 1.5;
  pin.position.y = 6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  g.add(pin, ring);
  g.visible = false;
  W.scene.add(g);
  W.marker = g;
  W.markerPin = pin;
  W.markerRing = ring;
}

export function setMarker(pos, radius = 2.5) {
  W.markerTarget = pos ? { x: pos.x, z: pos.z } : null;
  W.marker.visible = !!pos;
  if (pos) {
    W.marker.position.set(pos.x, 0, pos.z);
    W.markerRing.scale.setScalar(radius / 2.5);
  }
}

// ---------- day / night ----------

export function setNight(on) {
  W.night = on;
  const bg = on ? '#1d2440' : '#bfe6ff';
  W.scene.background = new THREE.Color(bg);
  W.scene.fog.color.set(on ? '#1d2440' : '#cfe9ff');
  W.hemi.intensity = on ? 0.55 : 1.3;
  W.hemi.color.set(on ? '#8fa0ff' : '#fff1d6');
  W.sun.intensity = on ? 0.35 : 2.8;
  W.sun.color.set(on ? '#9fb4ff' : '#fff0d0');
  for (const m of W.lanterns) m.emissiveIntensity = on ? 1.4 : 0;
  for (const m of W.windowMats) m.emissiveIntensity = on ? 0.9 : 0;
  document.body.style.background = bg;
}

// ---------- collisions ----------

export function collide(pos, r) {
  let hit = null;
  for (const c of W.colliders) {
    if (pos.x < c.x0 - r || pos.x > c.x1 + r || pos.z < c.z0 - r || pos.z > c.z1 + r) continue;
    const px = Math.min(pos.x - (c.x0 - r), (c.x1 + r) - pos.x);
    const pz = Math.min(pos.z - (c.z0 - r), (c.z1 + r) - pos.z);
    if (px < pz) pos.x = pos.x - (c.x0 - r) < (c.x1 + r) - pos.x ? c.x0 - r : c.x1 + r;
    else pos.z = pos.z - (c.z0 - r) < (c.z1 + r) - pos.z ? c.z0 - r : c.z1 + r;
    hit = c;
  }
  return hit;
}

// ---------- per-frame ----------

export function updateWorld(dt, t) {
  for (const g of W.gulls) {
    g.a += g.sp * dt;
    g.g.position.set(g.cx + Math.cos(g.a) * g.r, g.h + Math.sin(t * 2 + g.a) * 0.4, g.cz + Math.sin(g.a) * g.r * 0.5);
    g.g.rotation.y = -g.a;
    const flap = Math.sin(t * 8 + g.r) * 0.5;
    g.g.children[0].rotation.z = flap; g.g.children[1].rotation.z = -flap;
  }
  if (W.marker.visible) {
    W.markerPin.rotation.y += dt * 2;
    W.markerPin.position.y = 6 + Math.sin(t * 3) * 0.4;
  }
  // Wang's neon flickers, a little desperately
  const f = W.night ? (Math.sin(t * 23) > 0.92 ? 0.4 : 1) : 0.85;
  for (const m of W.neon) if (m.color) m.color.setScalar(f);
}

// Fade buildings that sit between the camera and the player.
function segHitsBox(p, q, b) {
  let t0 = 0, t1 = 1;
  for (const [a, lo, hi] of [['x', b.x0, b.x1], ['y', 0, b.h], ['z', b.z0, b.z1]]) {
    const d = q[a] - p[a];
    if (Math.abs(d) < 1e-6) { if (p[a] < lo || p[a] > hi) return false; continue; }
    let ta = (lo - p[a]) / d, tb = (hi - p[a]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export function updateOcclusion(cam, target) {
  const p = { x: target.x, y: 1.2, z: target.z };
  const q = { x: cam.x, y: cam.y, z: cam.z };
  for (const b of W.buildings) {
    const hide = segHitsBox(p, q, b);
    if (hide === b.faded) continue;
    b.faded = hide;
    for (const m of b.mats) { m.transparent = hide; m.opacity = hide ? 0.22 : 1; m.depthWrite = !hide; m.needsUpdate = true; }
    if (b.roof) b.roof.visible = !hide;
  }
}

// Keep the sun's shadow box centred on what the camera looks at (snapped to
// shadow-map texels so shadows don't shimmer while moving).
const SUN_OFFSET = new THREE.Vector3(-40, 50, 25);
export function updateSun(focus) {
  const texel = 64 / W.sun.shadow.mapSize.x;
  const x = Math.round(focus.x / texel) * texel, z = Math.round(focus.z / texel) * texel;
  W.sun.target.position.set(x, 0, z);
  W.sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
}

// Every solid mesh casts and receives shadows; flat ground only receives.
export function applyShadows() {
  W.scene.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    const g = o.geometry && o.geometry.type;
    let flat = g === 'PlaneGeometry' || g === 'CircleGeometry' || g === 'RingGeometry';
    if (!flat && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      flat = (b.max.y - b.min.y) * o.scale.y < 0.3;   // roads, slabs, lane lines
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.castShadow = !flat && !o.userData.noShadow && !mats.some(m => m && m.transparent);
  });
}

// Project a world point to screen pixels (null when behind the camera).
const v = new THREE.Vector3();
export function toScreen(x, y, z) {
  v.set(x, y, z).project(W.camera);
  if (v.z > 1) return null;
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}
