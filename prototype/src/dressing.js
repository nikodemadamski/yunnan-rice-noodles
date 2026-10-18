// Set dressing from the player's own concept art: a warm seaside old town at
// golden hour. Iron street lamps with glowing heads, wooden planters spilling
// flowers, striped awnings, vines and blossom climbing the shopfronts, a
// chalkboard ("Good Food, Good Days"), a wooden signpost, a rope fence on the
// waterfront, open water to the horizon with a sailboat and a lighthouse.

import * as THREE from 'three';
import { W, P, addCollider } from './world.js';
import { mat, toon, outline } from './characters.js';
import { rng } from './core.js';
import { wood, water as waterTex } from './textures.js';

const R = rng(512);
const lamps = [], boats = [];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- street lamps
const glowTex = canvasTex(64, 64, g => {
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,220,150,0.9)'); gr.addColorStop(0.4, 'rgba(255,190,110,0.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
function lamp(x, z) {
  const g = new THREE.Group();
  const iron = mat('#2d2a2e');
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.4, 8), iron); post.position.y = 1.7; g.add(post);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.3, 10), iron); foot.position.y = 0.15; g.add(foot);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.35, 4), iron); cap.position.y = 4.15; cap.rotation.y = Math.PI / 4; g.add(cap);
  const glass = toon({ color: '#ffe2a8', emissive: '#ffb347', emissiveIntensity: 0.7 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.6, 4), glass); head.position.y = 3.7; head.rotation.y = Math.PI / 4; g.add(head);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 8), iron); ring.position.y = 3.38; g.add(ring);
  outline(g, 1.05);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.setScalar(2.6); halo.position.y = 3.7; halo.userData.noShadow = true; g.add(halo);
  g.position.set(x, 0.1, z);
  W.scene.add(g);
  addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  lamps.push({ glass, halo });
}

// ---------------------------------------------------------------- awnings, vines, signs
function stripes(a, b) {
  return canvasTex(128, 64, g => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 64); }
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 54, 128, 10);
  });
}
// a sloped striped awning on a facade; `ry` turns it to face the street
function awning(x, z, w, a, b, ry = 0, y = 3.4) {
  const g = new THREE.Group();
  const t = stripes(a, b); t.wrapS = THREE.RepeatWrapping; t.repeat.x = w / 2.5;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 1.7), toon({ color: '#ffffff', map: t }));
  cloth.rotation.x = 0.42; cloth.position.set(0, 0, 0.75); g.add(cloth);
  for (let i = 0; i < Math.round(w / 0.6); i++) {               // scalloped valance
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(i % 2 ? b : a));
    s.position.set(-w / 2 + 0.3 + i * 0.6, -0.36, 1.5); g.add(s);
  }
  outline(g, 1.04);
  g.position.set(x, y, z); g.rotation.y = ry;
  W.scene.add(g);
}
// climbing greenery with blossoms on a wall face (z = face plane), from the ground up
function vines(x0, x1, zFace, dir = 1, h = 4.5) {
  const leaf = new THREE.SphereGeometry(0.32, 8, 6), bloom = new THREE.SphereGeometry(0.12, 6, 5);
  const leafMats = ['#5f9e4a', '#6fb057', '#4f8f3e'].map(c => mat(c)), bloomMats = ['#ffffff', '#ff9fc0', '#ffd1e0', '#ffe27a'].map(c => mat(c));
  for (const xs of [x0, x1]) {
    for (let y = 0.3; y < h; y += 0.32) {
      const spread = 0.35 + (y / h) * 0.9;
      for (let k = 0; k < 2; k++) {
        const l = new THREE.Mesh(leaf, leafMats[Math.floor(R() * 3)]);
        l.position.set(xs + (R() - 0.5) * spread * 2, y, zFace + dir * 0.18); l.scale.set(1, 0.85, 0.5);
        W.scene.add(l);
        if (R() < 0.55) { const f = new THREE.Mesh(bloom, bloomMats[Math.floor(R() * 4)]); f.position.set(l.position.x + (R() - 0.5) * 0.3, y + (R() - 0.5) * 0.3, zFace + dir * 0.38); W.scene.add(f); }
      }
    }
  }
}
function chalkboard(x, z, ry, lines) {
  const g = new THREE.Group();
  const t = canvasTex(256, 320, c => {
    c.fillStyle = '#2f3a33'; c.fillRect(0, 0, 256, 320);
    c.fillStyle = '#f6efe0'; c.font = '44px "Patrick Hand", "Nunito", sans-serif'; c.textAlign = 'center';
    lines.forEach((l, i) => c.fillText(l, 128, 80 + i * 56));
    c.font = '40px sans-serif'; c.fillText('♥', 128, 290);
  });
  const frame = mat('#8a5a36');
  for (const s of [-1, 1]) {
    const panel = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.06), [frame, frame, frame, frame, toon({ map: t }), toon({ map: t })]);
    board.position.y = 0.75; panel.add(board);
    panel.rotation.x = s * 0.18; panel.position.z = s * 0.14;
    if (s < 0) panel.rotation.y = Math.PI;
    g.add(panel);
  }
  outline(g, 1.04);
  g.position.set(x, 0.12, z); g.rotation.y = ry;
  W.scene.add(g);
  addCollider(x - 0.6, x + 0.6, z - 0.4, z + 0.4);
}
function signpost(x, z, boards) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.2, 8), mat('#6b4a32')); post.position.y = 2.1; g.add(post);
  boards.forEach(([label, dir], i) => {
    const t = canvasTex(256, 72, c => {
      c.fillStyle = '#9a6a42'; c.fillRect(0, 0, 256, 72);
      c.strokeStyle = '#6b4a32'; c.lineWidth = 6; c.strokeRect(3, 3, 250, 66);
      c.fillStyle = '#fff4e2'; c.font = '40px "Patrick Hand", "Nunito", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(`${label} ${dir > 0 ? '→' : '←'}`, 128, 38);
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.48, 0.08), [mat('#7a5034'), mat('#7a5034'), mat('#7a5034'), mat('#7a5034'), toon({ map: t }), toon({ map: t })]);
    b.position.set(dir * 0.75, 3.6 - i * 0.62, 0); b.rotation.y = (i % 2 ? 0.08 : -0.08);
    g.add(b);
  });
  outline(g, 1.04);
  g.position.set(x, 0.1, z);
  W.scene.add(g);
  addCollider(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
}

// ---------------------------------------------------------------- the waterfront
function ropeFence(x0, x1, z) {
  const postM = mat('#8a5a36'), rope = new THREE.MeshBasicMaterial({ color: '#c9a77a' });
  for (let x = x0; x <= x1; x += 3) {
    if (x > 7 && x < 16) continue;                  // the zig-zag bridge starts here
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.3, 8), postM); p.position.set(x, 0.75, z);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), postM); top.position.set(x, 1.42, z);
    W.scene.add(p, top); outline(p, 1.06);
    if (x + 3 <= x1 && !(x + 3 > 7 && x + 3 < 16)) {
      for (const hgt of [1.2, 0.75]) {
        const pts = []; for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector3(x + k * 0.3, hgt - Math.sin(k / 10 * Math.PI) * 0.18, z));
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.035, 5), rope);
        W.scene.add(tube);
      }
    }
  }
}
function sailboat(x, z, s = 1) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2.6, 4, 10), mat('#fbf4ea')); hull.rotation.z = Math.PI / 2; hull.scale.set(0.55, 1, 0.7); hull.position.y = 0.3; g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.84), mat('#d9576e')); stripe.position.y = 0.45; g.add(stripe);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6), mat('#8a5a36')); mast.position.y = 2.6; g.add(mast);
  const sailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, 4.6, 0), new THREE.Vector3(1.9, 0.7, 0)]);
  sailGeo.setIndex([0, 1, 2]); sailGeo.computeVertexNormals();
  g.add(new THREE.Mesh(sailGeo, toon({ color: '#ffffff', side: THREE.DoubleSide })));
  const jibGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.1, 0.8, 0), new THREE.Vector3(-0.05, 4.2, 0), new THREE.Vector3(-1.5, 0.8, 0)]);
  jibGeo.setIndex([0, 2, 1]); jibGeo.computeVertexNormals();
  g.add(new THREE.Mesh(jibGeo, toon({ color: '#ffd9e2', side: THREE.DoubleSide })));
  outline(g, 1.04);
  g.scale.setScalar(s);
  g.position.set(x, 0.05, z);
  W.scene.add(g);
  boats.push({ g, x0: x, ph: R() * 6 });
}
function lighthouse(x, z) {
  const isle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#7fae6a'));
  isle.scale.set(16, 3.5, 10); isle.position.set(x, 0, z); W.scene.add(isle);
  const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c9b79a'));
  rock.scale.set(17.5, 1.6, 11); rock.position.set(x, 0, z); W.scene.add(rock);
  const tower = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.15 - i * 0.12, 1.25 - i * 0.12, 2.2, 14), mat(i % 2 ? '#d9576e' : '#fbf4ea'));
    seg.position.y = 1.1 + i * 2.2; tower.add(seg);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1, 10), toon({ color: '#ffe9b0', emissive: '#ffcf6a', emissiveIntensity: 0.8 })); top.position.y = 9.4; tower.add(top);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 10), mat('#d9576e')); roof.position.y = 10.5; tower.add(roof);
  outline(tower, 1.04);
  tower.position.set(x + 2, 3, z);
  W.scene.add(tower);
}

// ---------------------------------------------------------------- entry
export function initDressing() {
  // street lamps on Grandpa's street, the plaza and the lake promenade
  for (const x of [-42, -30, -19, -6]) for (const z of [-7.7, 7.7]) lamp(x, z);
  for (const [dx, dz] of [[-15, -9], [15, -9], [-15, 13], [15, 13]]) lamp(P.plaza.x + dx, P.plaza.z + dz);
  for (let x = -38; x <= 82; x += 16) lamp(x, -47.4);
  // awnings over the shopfronts
  awning(-15, -9, 9, '#2f5d50', '#f4ead8');                     // Old Zhao's
  awning(15, -10, 8, '#d9576e', '#fbf1e6');                     // Auntie Fu's
  awning(-58.9, -20, 7, '#f29ab6', '#fff4f7', Math.PI / 2);      // Rose's flower cakes
  awning(58.9, -20, 7, '#c7843e', '#fbf1e6', -Math.PI / 2);      // Uncle Ji's
  // vines and blossom climbing the old shopfronts
  vines(-20.3, -9.7, -9, 1);
  vines(10.2, 19.8, -10, 1);
  vines(-41.3, -34.7, -12, 1, 4);
  // a chalkboard outside Old Zhao's, and a signpost at the crossroads
  chalkboard(-9.6, -7.6, 0.3, ['Good Food', 'Good Days']);
  signpost(-46.6, -7.2, [['Market', 1], ['Shops', -1], ['Lake', 1]]);
  // the waterfront: rope fence, open water to the horizon, a sailboat, a lighthouse
  ropeFence(-44, 84, -48.9);
  const wt = waterTex(); wt.repeat.set(60, 30);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 420), new THREE.MeshBasicMaterial({ map: wt }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(20, 0.08, -295);
  W.scene.add(sea); W.sea = sea;
  sailboat(-10, -118, 1.6); sailboat(64, -170, 1.3);
  lighthouse(105, -210);
}

export function updateDressing(dt, t) {
  const glow = W.night ? 1.6 : 0.7;
  for (const l of lamps) { l.glass.emissiveIntensity = glow; l.halo.material.opacity = W.night ? 0.9 : 0.5; }
  for (const b of boats) { b.g.position.x = b.x0 + Math.sin(t * 0.05 + b.ph) * 14; b.g.position.y = 0.05 + Math.sin(t * 1.3 + b.ph) * 0.12; b.g.rotation.z = Math.sin(t * 1.1 + b.ph) * 0.05; }
  if (W.sea) { const m = W.sea.material.map; m.offset.x += dt * 0.004; }
}
