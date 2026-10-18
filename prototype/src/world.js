// The Kunming neighbourhood: roads, blocks, landmarks, NPC registry,
// collisions, day/night and the delivery marker.

import { cobbles, asphalt, grass, flagstones, water as waterTex, contact, brick, plaster, wood as woodTex } from './textures.js';
import * as THREE from 'three';
import { mat, toon, outline } from './characters.js';
import { rng } from './core.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

export const W = {
  scene: null, camera: null, renderer: null,
  colliders: [], bumps: [], trees: [], npcs: {}, lanterns: [], windowMats: [], neon: [], buildings: [],
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

// Animal Crossing's "rolling log": everything bends gently away from the camera,
// so you see more ground and the horizon curves. Done in view space for every
// material at once; shadow depth passes stay flat so shadows still line up.
THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
  'mvPosition = modelViewMatrix * mvPosition;',
  `mvPosition = modelViewMatrix * mvPosition;
  #ifndef DEPTH_PACKING
  { float d = max(0.0, -mvPosition.z - 16.0); mvPosition.y -= d * d * 0.0032; }
  #endif`);

const SKY = {
  day: { top: '#9db6ea', mid: '#f7c9bd', low: '#ffd9a4' },   // golden hour: lilac-blue, peach, gold
  night: { top: '#0f1430', mid: '#262a55', low: '#4a3a6a' },
};

function makeSky() {
  const u = { top: { value: new THREE.Color(SKY.day.top) }, mid: { value: new THREE.Color(SKY.day.mid) }, low: { value: new THREE.Color(SKY.day.low) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(low, mid, smoothstep(-0.15, 0.12, h));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.userData.noShadow = true;
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  W.sky = sky;
  W.skyU = u;
  return sky;
}

export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;          // building cutaways
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  Object.assign(W, { renderer, scene, camera });

  // warm low side sun + soft sky fill; the sun's shadow box follows the player
  W.hemi = new THREE.HemisphereLight(0xffe6cc, 0xa58fd0, 1.0);    // warm light, lilac shadows
  W.sun = new THREE.DirectionalLight(0xffc98f, 3.1);           // a low golden sun
  W.sun.castShadow = true;
  const phone = Math.min(innerWidth, innerHeight) < 700;
  W.sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(W.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
  W.sun.shadow.bias = -0.0005;
  W.sun.shadow.normalBias = 0.03;
  scene.add(W.hemi, W.sun, W.sun.target);
  scene.fog = new THREE.FogExp2(0xf6d8c8, 0.0040);
  scene.add(makeSky());

  buildGround();
  buildBlocks();
  buildLandmarks();
  flushPlinths();
  buildTrees();
  buildLanterns();
  buildBumps();
  buildLake();
  buildHorizon();
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
  // a storybook window: arched pane, white frame, little shutters, a flower box
  const plasterImg = plaster().image;
  windowTex = canvasTex(128, 128, (g) => {
    g.drawImage(plasterImg, 0, 0, 128, 128);                        // lime plaster, cracks, streaks
    const pane = () => { g.beginPath(); g.moveTo(40, 92); g.lineTo(40, 46); g.arc(64, 46, 24, Math.PI, 0); g.lineTo(88, 92); g.closePath(); };
    g.fillStyle = '#8fc6e8'; pane(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(46, 84); g.lineTo(46, 50); g.lineTo(56, 40); g.lineTo(56, 84); g.fill();
    g.strokeStyle = '#fbfbf7'; g.lineWidth = 5; pane(); g.stroke();
    g.beginPath(); g.moveTo(64, 24); g.lineTo(64, 92); g.moveTo(40, 62); g.lineTo(88, 62); g.lineWidth = 3; g.stroke();
    g.fillStyle = '#7fb8a8';                                         // shutters
    for (const x of [24, 92]) { g.beginPath(); g.roundRect(x, 34, 12, 58, 3); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (const x of [24, 92]) for (let y = 40; y < 90; y += 8) g.fillRect(x + 2, y, 8, 2);
    g.fillStyle = '#c9785a'; g.beginPath(); g.roundRect(34, 94, 60, 12, 3); g.fill();   // flower box
    g.fillStyle = '#6cbf55'; for (let x = 38; x < 92; x += 8) { g.beginPath(); g.arc(x, 93, 5, 0, Math.PI * 2); g.fill(); }
    const fl = ['#ff7fa3', '#fff3a6', '#ff9f6b', '#ffffff'];
    for (let i = 0; i < 7; i++) { g.fillStyle = fl[i % 4]; g.beginPath(); g.arc(40 + i * 8, 89 + (i % 2) * 3, 3.5, 0, Math.PI * 2); g.fill(); }
  });
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowGlowTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ffcf6b'; g.beginPath(); g.moveTo(20, 46); g.lineTo(20, 23); g.arc(32, 23, 12, Math.PI, 0); g.lineTo(44, 46); g.fill();
  });
  windowGlowTex.colorSpace = THREE.NoColorSpace;
  windowGlowTex.wrapS = windowGlowTex.wrapT = THREE.RepeatWrapping;
}

const WALLS = ['#ffe3c4', '#ffd9de', '#d6f0dd', '#d8e8ff', '#fff0b8', '#ecdcff', '#fbf1e2'];
const ROOFS = ['#e8735a', '#5fa8d3', '#79b86e', '#c7697f', '#8f74c4'];

// a soft dark pool where things meet the ground, so nothing floats
let contactMat = null, lidMat = null;
const PLINTH = [], LEDGE = [], KERB = [];
// all plinths in two draw calls
export function flushPlinths() {
  if (!PLINTH.length) return;
  const b = new THREE.Mesh(mergeGeometries(PLINTH), toon({ color: '#ffffff', map: brick() }));
  const l = new THREE.Mesh(mergeGeometries(LEDGE), mat('#d9cbb6'));
  W.scene.add(b, l);
  PLINTH.length = LEDGE.length = 0;
}
export function groundShadow(x, z, w, d, y = 0.17) {
  contactMat ||= new THREE.MeshBasicMaterial({ map: contact(), transparent: true, depthWrite: false });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), contactMat);
  s.rotation.x = -Math.PI / 2; s.position.set(x, y, z);
  s.userData.noShadow = true; s.renderOrder = 1;
  W.scene.add(s);
  return s;
}

export function building(x, z, w, d, h, opts = {}) {
  windowTextures();
  const wall = opts.wall || WALLS[Math.floor(R() * WALLS.length)];
  const tex = windowTex.clone();
  tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
  const glow = windowGlowTex.clone();
  glow.repeat.copy(tex.repeat);
  const clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5)];   // moved down to 1.5 m for a cutaway
  const side = toon({ color: wall, map: tex, emissive: 0xffb347, emissiveMap: glow, emissiveIntensity: 0, clippingPlanes: clip, side: THREE.DoubleSide });
  const top = mat(opts.roof || ROOFS[Math.floor(R() * ROOFS.length)]).clone();
  top.clippingPlanes = clip; top.side = THREE.DoubleSide;
  W.windowMats.push(side);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  m.position.set(x, h / 2, z);
  W.scene.add(m);
  // an old brick plinth with moss at its foot, capped by a stone ledge;
  // skipped on the shopfront face (opts.front: '+z' | '-z' | '+x' | '-x')
  for (const [face, sx, sz, len] of [['+z', 0, 1, w], ['-z', 0, -1, w], ['+x', 1, 0, d], ['-x', -1, 0, d]]) {
    if (opts.front === face) continue;
    const along = len + 0.16, px = x + sx * (w / 2 + 0.04), pz = z + sz * (d / 2 + 0.04);
    const strip = sx ? new THREE.BoxGeometry(0.08, 1, along) : new THREE.BoxGeometry(along, 1, 0.08);
    const uv = strip.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * along / 2, uv.getY(i) * 0.5);   // brick-sized bricks
    PLINTH.push(strip.translate(px, 0.5, pz));
    const ledge = sx ? new THREE.BoxGeometry(0.2, 0.12, along + 0.1) : new THREE.BoxGeometry(along + 0.1, 0.12, 0.2);
    LEDGE.push(ledge.translate(x + sx * (w / 2 + 0.06), 1.04, z + sz * (d / 2 + 0.06)));
  }
  groundShadow(x, z, w + 2.2, d + 2.2);
  addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  // the lid of a cut-away building: a solid top at the cut, so it reads as a
  // low wall, never a hollow box you can see through
  lidMat ||= (() => { const t = woodTex('#c9935f'); t.repeat.set(2, 2); return toon({ color: '#ffffff', map: t }); })();   // a dollhouse floor
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), lidMat);
  lid.position.set(x, 1.5, z); lid.visible = false; lid.userData.noShadow = true;
  W.scene.add(lid);
  const rec = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, mats: [side, top], clip, lid, roof: null, faded: false };
  W.buildings.push(rec);
  if (opts.pitched ?? R() < 0.7) {
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
  // one big lawn under everything, including the far-off intro sets (office
  // at x 400, Grandpa's memory street at x 600), so no shot ever sees the void
  const grassT = grass(); grassT.repeat.set(1500 / 9, 700 / 9);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 700), toon({ color: '#ffffff', map: grassT, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));   // always loses depth ties to paving and water laid on top
  ground.rotation.x = -Math.PI / 2; ground.position.set(250, 0, 264);   // starts at the shore (z -86): no grass under the sea to flicker through
  W.scene.add(ground);

  // painted asphalt, cobbled pavements: never one flat colour
  const asph = flagstones(['#b8b0c4', '#aea6bb', '#c2bacb', '#b3abc0', '#bdb5c6'], '#8f879e');   // stone-paved roads (concept art)
  const roadMat = (w, d) => { const t = asph.clone(); t.repeat.set(w / 5, d / 5); return toon({ color: '#ffffff', map: t }); };
  const road = { x: roadMat(180, 10), z: roadMat(10, 180) };
  const line = mat('#fffaf0');
  for (const z of [-40, 0, 40]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(180, 0.1, 10), road.x);
    r.position.set(0, 0.03, z); W.scene.add(r);
    for (let x = -86; x < 86; x += 6) box(2.5, 0.05, 0.3, line, x, 0.09, z);
  }
  for (const x of [-50, 0, 50]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 180), road.z);
    r.position.set(x, 0.035, 0); W.scene.add(r);
    for (let z = -86; z < 86; z += 6) box(0.3, 0.05, 2.5, line, x, 0.095, z);
  }
  // Grandpa's street is an old pedestrian lane of bluestone flags (青石板),
  // like Kunming's old quarters, not asphalt
  const flags = flagstones(); flags.repeat.set(40 / 6, 10 / 6);
  const lane = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 10), toon({ color: '#ffffff', map: flags }));
  lane.position.set(-25, 0.095, 0); W.scene.add(lane);
  // pavement slabs on every block
  const cob = cobbles();
  XS.forEach(([x0, x1], i) => ZS.forEach(([z0, z1], j) => {
    if (i >= 1 && j === 0) z0 = -48.4;          // lake blocks keep only a promenade strip
    const t = cob.clone(); t.repeat.set((x1 - x0) / 5, (z1 - z0) / 5);
    const pave = toon({ color: '#ffffff', map: t });
    const s = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.16, z1 - z0), pave);
    s.position.set((x0 + x1) / 2, 0.08, (z0 + z1) / 2);
    W.scene.add(s);
    // a granite kerb with a lit top edge around every block
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const [kw, kd, kx, kz] of [[w, 0.36, cx, z0 + 0.18], [w, 0.36, cx, z1 - 0.18], [0.36, d, x0 + 0.18, cz], [0.36, d, x1 - 0.18, cz]]) {
      KERB.push(new THREE.BoxGeometry(kw, 0.2, kd).translate(kx, 0.1, kz));
    }
  }));
  W.scene.add(new THREE.Mesh(mergeGeometries(KERB), toon({ color: '#d4cbc0' })));
  KERB.length = 0;
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
  building(-15, -13.5, 10, 9, 7, { wall: '#efe4cf', roof: '#7b4b3a', pitched: true, front: '+z' });
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
  building(-15, 14.5, 14, 9, 10, { wall: '#ffe7f3', roof: '#ffcc00', pitched: false, front: '-z' });
  const neon = makeSign(['超级至尊过桥米线', 'SUPREME MEGA CROSS-BRIDGE NOODLE · 48 TOPPINGS!'], { bg: '#ff2d8a', fg: '#fff35c', w: 12, h: 2.4, glow: true });
  neon.position.set(-15, 8, 9.95);
  neon.rotation.y = Math.PI;
  W.scene.add(neon);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.5), mat('#ffd700'));
  door.position.set(-15, 1.75, 9.96); door.rotation.y = Math.PI;
  W.scene.add(door);
  for (const x of [-21, -9]) {
    // balloons painted flat on the facade, so they never block the camera
    const balloon = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), mat('#ff2d8a'));
    balloon.scale.y = 1.2;
    balloon.position.set(x, 6.8, 9.94);
    balloon.rotation.y = Math.PI;
    W.scene.add(balloon);
  }

  // Street stalls (Little Chilli's sign is falling apart)
  stall(P.chilliStall.x, 9.2, Math.PI, '#d63c2f', ['小辣烧饵块', "LITTLE CHILLI'S ERKUAI"], 0.18);
  stall(P.spudStall.x, -9.2, 0, '#a86b2d', ['土豆叔炸洋芋', "UNCLE SPUD'S FRIED POTATOES"]);
  stall(P.simStall.x, P.simStall.z, Math.PI, '#2f6fb6', ['段阿姨手机卡', "AUNTIE DUAN'S SIM CARDS"]);

  // Auntie Fu's small-pot noodles
  building(15, -14, 10, 8, 7, { wall: '#f6e3c6', roof: '#7b4b3a', pitched: true, front: '+z' });
  const fu = makeSign(['傅阿姨小锅米线', "AUNTIE FU'S SMALL-POT NOODLES"], { bg: '#b83b2e', w: 8, h: 1.5 });
  fu.position.set(15, 4.5, -9.95); W.scene.add(fu);
  box(4, 3, 0.1, '#6b4a2f', 15, 1.5, -9.97);

  // Steam-pot chicken house (faces west onto x=50 road)
  building(64, -20, 10, 12, 8, { wall: '#efe7d6', roof: '#4f5d4c', pitched: true, front: '-x' });
  const ji = makeSign(['老纪汽锅鸡', "UNCLE JI'S STEAM-POT CHICKEN"], { bg: '#7a4e2d', w: 9, h: 1.6 });
  ji.position.set(58.95, 5, -20); ji.rotation.y = -Math.PI / 2; W.scene.add(ji);
  box(0.1, 3, 4, '#5a3b22', 58.97, 1.5, -20);

  // Flower cake bakery (faces east onto x=-50 road)
  building(-64, -20, 10, 12, 7, { wall: '#fde3ec', roof: '#c25b7a', pitched: true, front: '+x' });
  const rose = makeSign(['玫瑰鲜花饼', "ROSE'S FLOWER CAKES"], { bg: '#d9577f', w: 8, h: 1.6 });
  rose.position.set(-58.95, 4.6, -20); rose.rotation.y = Math.PI / 2; W.scene.add(rose);
  box(0.1, 3, 4, '#a14462', -58.97, 1.5, -20);

  // Plaza: a pink boombox for the dancing aunties (benches come from props.js)
  const boom = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 6, 16).rotateZ(Math.PI / 2), mat('#ff8fb1'));
  shell.scale.z = 0.7;
  boom.add(shell);
  for (const x of [-0.55, 0.55]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20).rotateX(Math.PI / 2), mat('#fff3f6'));
    cone.position.set(x, 0, 0.36);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 14).rotateX(Math.PI / 2), mat('#e05a87'));
    dot.position.set(x, 0, 0.4);
    boom.add(cone, dot);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 20, Math.PI), mat('#e05a87'));
  handle.position.y = 0.5;
  boom.add(handle);
  boom.position.set(32, 0.75, 6.5);
  boom.rotation.y = Math.PI;
  outline(boom, 1.04);
  W.scene.add(boom);
  addCollider(31, 33, 6, 7);

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
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.8, 8), mat('#8a5a3b'));
  trunk.position.set(x, 1.4, z);
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
    // a puffy cloud of a canopy: three soft balls, half the town in spring blossom
    const blossom = R() < 0.65;
    const cols = blossom ? ['#ffbfd3', '#ffd3e1', '#f9a9c4'] : ['#7cc95a', '#8fd468', '#6bbb4e'];
    const crown = new THREE.Group();
    const r0 = 1.45 + R() * 0.4;
    const balls = [[0, 0.25, 0, 1], [-0.8, -0.2, 0.3, 0.72], [0.75, -0.15, -0.25, 0.75], [0.1, -0.3, 0.75, 0.62], [-0.2, 0.55, -0.45, 0.6]];
    for (const [dx, dy, dz, k] of balls) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r0 * k, 18, 14), mat(cols[Math.floor(R() * 3)]));
      b.position.set(dx * r0, dy * r0, dz * r0);
      crown.add(b);
    }
    if (blossom) {                                   // clusters of single flowers on the surface
      const dot = new THREE.SphereGeometry(0.11, 6, 5);
      for (let i = 0; i < 26; i++) {
        const [dx, dy, dz, k] = balls[i % balls.length];
        const a = R() * Math.PI * 2, e = (R() - 0.3) * 1.2, rr = r0 * k;
        const f = new THREE.Mesh(dot, mat(R() < 0.5 ? '#ffffff' : '#ff93b6'));
        f.position.set(dx * r0 + Math.cos(a) * Math.cos(e) * rr, dy * r0 + Math.sin(e) * rr, dz * r0 + Math.sin(a) * Math.cos(e) * rr);
        f.userData.noOutline = true;
        crown.add(f);
      }
    }
    crown.position.set(x, 3.3, z);
    crown.rotation.y = R() * 6;
    outline(crown, 1.04);
    W.scene.add(crown);
    crown.userData.ph = R() * 6;
    (W.crowns ||= []).push(crown);
  }
  W.trees.push({ x, z });
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
  const geo = new THREE.SphereGeometry(0.3, 16, 12);
  const capGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.08, 12);
  const gold = mat('#f2c14e');
  for (let x = -40; x <= 40; x += 6) {
    for (const z of [-5.6, 5.6]) {
      if (Math.abs(x - P.chilliStall.x) < 3 || Math.abs(x - P.spudStall.x) < 3) continue;
      if (x === -16 && z < 0) continue;              // keep the FOR LEASE shutter readable
      const m = toon({ color: '#d8322a', emissive: '#ff5a2a', emissiveIntensity: 0 });
      const l = new THREE.Mesh(geo, m);
      l.scale.y = 1.2;
      l.position.set(x, 4.3, z);
      for (const dy of [0.36, -0.36]) {                 // gold caps top and bottom
        const cap = new THREE.Mesh(capGeo, gold);
        cap.position.y = dy / 1.2;
        l.add(cap);
      }
      W.scene.add(l);
      W.lanterns.push(m);
      if ((x + 40) % 12 === 0 && !(x === -16 && z < 0)) {   // no post in front of Old Zhao's shutter
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 6), mat('#4a3a2c'));
        pole.position.set(x, 2.3, z + Math.sign(z) * 0.2);
        W.scene.add(pole);
        addCollider(x - 0.2, x + 0.2, pole.position.z - 0.2, pole.position.z + 0.2);
      }
    }
  }
  // festival strings: a sagging cord through each row of lanterns
  const cord = new THREE.LineBasicMaterial({ color: '#7a4a32' });
  for (const z of [-5.6, 5.6]) {
    const pts = [];
    for (let x = -40; x <= 40; x += 0.5) pts.push(new THREE.Vector3(x, 4.62 - Math.abs(Math.sin(((x + 40) / 6) * Math.PI)) * 0.35, z));
    W.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cord));
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

// The Western Hills (西山) and the mountains round Kunming, soft in the haze,
// and a few fat clouds: the world never ends in a beige void.
function buildHorizon() {
  const R2 = rng(77);
  const hillMat = toon({ color: '#9fb3d6' }), farMat = toon({ color: '#b9c3e3' });
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * Math.PI * 2 + R2() * 0.08;
    for (const [rad, m, hMul] of [[215, farMat, 1.25], [175, hillMat, 1]]) {
      const h = (22 + R2() * 30) * hMul, w = 38 + R2() * 30;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
      hill.scale.set(w, h, w * 0.7);
      hill.position.set(Math.cos(a) * rad, -2, Math.sin(a) * rad);
      hill.userData.noShadow = true;
      W.scene.add(hill);
    }
  }
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, fog: false });
  W.clouds = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(6 + R2() * 5, 12, 8), cloudMat); b.position.set(k * 7 - 10, R2() * 3, R2() * 4); b.scale.y = 0.6; g.add(b); }
    const a = R2() * Math.PI * 2, rad = 140 + R2() * 60;
    g.position.set(Math.cos(a) * rad, 55 + R2() * 25, Math.sin(a) * rad);
    g.userData.noShadow = true;
    W.scene.add(g); W.clouds.push(g);
  }
}

function buildLake() {
  const wt = waterTex(); wt.repeat.set(130 / 14, 37 / 14);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(130, 37), new THREE.MeshBasicMaterial({ map: wt }));
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
  const bg = on ? '#1d2440' : '#f7c9bd';
  const sky = on ? SKY.night : SKY.day;
  for (const k of ['top', 'mid', 'low']) W.skyU[k].value.set(sky[k]);
  W.scene.background = null;
  W.scene.fog.color.set(on ? '#3a3360' : '#f6d8c8');
  W.hemi.intensity = on ? 0.6 : 1.0;
  W.hemi.color.set(on ? '#8fa0ff' : '#ffe6cc');
  W.sun.intensity = on ? 0.35 : 3.1;
  W.sun.color.set(on ? '#9fb4ff' : '#ffc98f');
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
  if (W.sky) W.sky.position.copy(W.camera.position);
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

// screen points (NDC) whose view of the street must stay clear: the lower
// two-thirds of the frame, where the player and the pavement are
// (rooftops along the bottom edge are fine, like Animal Crossing; only walls
// across the middle band, where you look, get cut)
const OCC_NDC = [[0, -0.1], [-0.8, -0.1], [0.8, -0.1], [-0.45, 0.15], [0.45, 0.15]];
const OCC_RING = [[2.5, 0], [-2.5, 0], [0, 2], [0, -2]];
const _v = new THREE.Vector3();
export function updateOcclusion(cam, target) {
  // rays from the player, and from street points seen across the screen, to
  // the camera: any building they pass through is cut away
  const q = { x: cam.x, y: cam.y, z: cam.z };
  const ps = [{ x: target.x, y: 1.2, z: target.z }, ...OCC_RING.map(([dx, dz]) => ({ x: target.x + dx, y: 1.2, z: target.z + dz }))];
  for (const [nx, ny] of OCC_NDC) {
    _v.set(nx, ny, 0.5).unproject(W.camera).sub(W.camera.position);
    if (_v.y >= -1e-3) continue;
    const k = (1.2 - cam.y) / _v.y;
    if (k <= 0 || k * _v.length() > 70) continue;
    const px = cam.x + _v.x * k, pz = cam.z + _v.z * k;
    if (W.buildings.some(b => px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1)) continue;   // that's a building's own wall
    ps.push({ x: px, y: 1.2, z: pz });
  }
  for (const b of W.buildings) {
    const hide = ps.some(p => segHitsBox(p, q, b));
    if (hide === b.faded) continue;
    b.faded = hide;
    // a cutaway, like a dollhouse: the building in front is cut down to a low
    // stump so you always see the duck, and the street never goes empty
    b.clip[0].constant = hide ? 1.5 : 1e5;      // same shader either way: no recompile hitch on phones
    b.lid.visible = hide;
  }
}

// Keep the sun's shadow box centred on what the camera looks at (snapped to
// shadow-map texels so shadows don't shimmer while moving).
const SUN_OFFSET = new THREE.Vector3(-46, 34, 30);   // low sun: long golden-hour shadows
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
