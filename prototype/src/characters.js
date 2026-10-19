// Simple round characters in the Animal Crossing spirit: capsule body,
// big head, a drawn face that swaps expressions.

import * as THREE from 'three';

// One 3-step gradient shared by every material: soft cel shading, like a picture book.
const GRADIENT = new THREE.DataTexture(new Uint8Array([160, 218, 255]), 3, 1, THREE.RedFormat);
GRADIENT.minFilter = GRADIENT.magFilter = THREE.NearestFilter;
GRADIENT.needsUpdate = true;

export function toon(params = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: GRADIENT, ...params });
}

const matCache = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, toon({ color, ...extra }));
  return matCache.get(key);
}

// Inverted-hull ink outline (cheap, reads well at our camera distance).
const INK = new THREE.MeshBasicMaterial({ color: '#5a3d2b', side: THREE.BackSide });
export function outline(root, thickness = 1.06) {
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.noOutline && !o.userData.hasHull) meshes.push(o); });
  for (const m of meshes) {
    const hull = new THREE.Mesh(m.geometry, INK);
    hull.userData.noOutline = true;
    hull.userData.noShadow = true;
    hull.scale.setScalar(thickness);
    m.add(hull);
    m.userData.hasHull = true;
  }
}

const faceCache = new Map();

// The face, drawn to the baby-schema proportions that measurably read as cute
// (Lorenz; Glocker et al. 2009): wide round face, high forehead (features in
// the lower half), big wide-set eyes, tiny mouth, no nose, soft blush.
// Canvas units 128x96 map onto the front of the skull.
function faceTexture(expr, o) {
  const key = `${expr}|${o.blush}|${o.glasses}|${o.brows}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ink = '#3a2418';
  const L = 37, Rx = 91, Y = 56, MY = 74;       // wide-set eyes, low on the face; mouth close under them

  const eye = (x, h = 1) => {                    // big glossy brown eyes (character sheets): dark rim, warm iris, two catch-lights
    g.fillStyle = '#2a1810';
    g.beginPath(); g.ellipse(x, Y, 10.5, 13 * h, 0, 0, Math.PI * 2); g.fill();
    const ir = g.createLinearGradient(0, Y - 10 * h, 0, Y + 12 * h);
    ir.addColorStop(0, '#3b2214'); ir.addColorStop(1, '#8a5232');
    g.fillStyle = ir;
    g.beginPath(); g.ellipse(x, Y + 1.5 * h, 8.2, 10.6 * h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1e110b';
    g.beginPath(); g.ellipse(x, Y + 1 * h, 4.2, 5.4 * h, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(x + 3.2, Y - 4.8 * h, 3.8, 4.4 * h, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x - 3.6, Y + 5.5 * h, 1.9, 0, Math.PI * 2); g.fill();
  };
  const closed = (x, up = true) => {             // ^ ^ happy arcs, or u u
    g.strokeStyle = ink; g.lineWidth = 4.5;
    g.beginPath();
    if (up) g.arc(x, Y + 5, 8, 1.15 * Math.PI, 1.85 * Math.PI); else g.arc(x, Y - 3, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  };
  const mouth = (kind) => {
    g.strokeStyle = ink; g.lineWidth = 3; g.fillStyle = '#c4544a';
    g.beginPath();
    if (kind === 'smile') { g.moveTo(59, MY); g.quadraticCurveTo(64, MY + 5, 69, MY); }
    else if (kind === 'big') { g.moveTo(57, MY - 1); g.quadraticCurveTo(64, MY + 10, 71, MY - 1); g.closePath(); g.fill(); }
    else if (kind === 'o') { g.ellipse(64, MY + 2, 4, 5, 0, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'frown') { g.moveTo(59, MY + 3); g.quadraticCurveTo(64, MY - 2, 69, MY + 3); }
    else if (kind === 'flat') { g.moveTo(60, MY + 1); g.lineTo(68, MY + 1); }
    else if (kind === 'smirk') { g.moveTo(59, MY + 1); g.quadraticCurveTo(66, MY + 4, 71, MY - 2); }
    else if (kind === 'wobble') { g.moveTo(57, MY + 2); g.quadraticCurveTo(60, MY - 1, 63, MY + 2); g.quadraticCurveTo(66, MY + 5, 70, MY + 1); }
    g.stroke();
  };
  const brows = (tilt) => {
    g.strokeStyle = ink; g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(L - 8, Y - 19 - tilt); g.lineTo(L + 7, Y - 19 + tilt);
    g.moveTo(Rx - 7, Y - 19 + tilt); g.lineTo(Rx + 8, Y - 19 - tilt);
    g.stroke();
  };

  switch (expr) {
    case 'happy':
      closed(L); closed(Rx); mouth('big'); break;
    case 'shock':
      for (const x of [L, Rx]) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, Y, 11, 13, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
        g.fillStyle = ink; g.beginPath(); g.arc(x, Y + 1, 4.5, 0, Math.PI * 2); g.fill();
      }
      mouth('o'); break;
    case 'sad':
      eye(L, 0.85); eye(Rx, 0.85); brows(-5); mouth('frown');
      g.fillStyle = '#7fd0ff'; g.beginPath(); g.ellipse(Rx + 9, Y + 12, 3.5, 6, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'angry':
      eye(L, 0.8); eye(Rx, 0.8); brows(6); mouth('flat'); break;
    case 'smug':
      closed(L, false); closed(Rx, false); mouth('smirk'); break;
    case 'blank':
      g.fillStyle = ink;
      for (const x of [L, Rx]) { g.beginPath(); g.arc(x, Y, 3.5, 0, Math.PI * 2); g.fill(); }
      mouth('flat'); break;
    case 'cry':
      closed(L); closed(Rx);
      g.fillStyle = '#7fd0ff';
      g.beginPath(); g.roundRect(L - 4, Y + 4, 8, 24, 4); g.roundRect(Rx - 4, Y + 4, 8, 24, 4); g.fill();
      mouth('wobble'); break;
    default:
      eye(L); eye(Rx); mouth('smile');
  }
  if (o.brows && expr === 'normal') brows(1);
  // a tiny nose, just a warm dot between the eyes and the mouth
  g.fillStyle = 'rgba(200,110,90,0.55)'; g.beginPath(); g.ellipse(64, MY - 9, 2.6, 1.8, 0, 0, Math.PI * 2); g.fill();
  if (o.blush) {
    g.fillStyle = 'rgba(255,130,150,0.5)';
    g.beginPath(); g.ellipse(L - 6, MY + 1, 9, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(Rx + 6, MY + 1, 9, 5, 0, 0, Math.PI * 2); g.fill();
  }
  if (o.glasses) {                                // big round specs sit over the eyes
    g.strokeStyle = '#6a4a3a'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(L, Y, 15, 0, Math.PI * 2); g.moveTo(Rx + 15, Y); g.arc(Rx, Y, 15, 0, Math.PI * 2);
    g.moveTo(L + 15, Y); g.quadraticCurveTo(64, Y - 5, Rx - 15, Y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

// a ribbed knit, for jumpers (soft vertical ribs, cream on cream)
let knitTex = null;
function knit() {
  if (knitTex) return knitTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) {
    const gr = g.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, 'rgba(150,120,90,0.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(150,120,90,0.22)');
    g.fillStyle = gr; g.fillRect(x, 0, 8, 64);
    for (let y = 0; y < 64; y += 8) { g.strokeStyle = 'rgba(150,120,90,0.12)'; g.beginPath(); g.moveTo(x + 1, y + 6); g.lineTo(x + 4, y + 2); g.lineTo(x + 7, y + 6); g.stroke(); }
  }
  knitTex = new THREE.CanvasTexture(c);
  knitTex.wrapS = knitTex.wrapT = THREE.RepeatWrapping; knitTex.repeat.set(4, 2);
  knitTex.colorSpace = THREE.SRGBColorSpace;
  return knitTex;
}

// a little white daisy (hair clip, backpack patch)
function daisy(r = 0.12) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), mat('#fffdf6'));
    p.scale.set(1, 0.45, 0.7); const a = i / 6 * Math.PI * 2;
    p.position.set(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, 0); p.rotation.z = a;
    g.add(p);
  }
  const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 10, 8), mat('#f6c443'));
  c.position.z = r * 0.12; g.add(c);
  return g;
}

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false });
const shadowGeo = new THREE.CircleGeometry(0.9, 20).rotateX(-Math.PI / 2);

/**
 * opts: skin, shirt, pants, hair, hairStyle (short|bun|long|pony|spiky|bald),
 *       hat (duck|cap|chef|none), hatColor, skirt, blush, glasses, brows, scale, wide, prop (selfie|fan|ladle)
 */
export function makeCharacter(opts = {}) {
  const o = {
    skin: '#f6d2b0', shirt: '#7fb3e6', pants: '#5a6b8c', hair: '#3a2a20', hairStyle: 'short',
    hat: 'none', hatColor: '#e94b3c', scale: 1, wide: 1, blush: true, ...opts,
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.userData.noOutline = true;
  shadow.position.y = 0.03;
  root.add(shadow);

  // legs / skirt
  if (o.skirt) {
    const sk = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.75, 18), mat(o.pants));
    sk.position.y = 0.45;
    body.add(sk);
  } else {
    const legGeo = new THREE.CapsuleGeometry(0.17, 0.18, 4, 10);
    for (const x of [-0.21, 0.21]) {
      const leg = new THREE.Mesh(legGeo, mat(o.pants));
      leg.position.set(x, 0.3, 0);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), mat(o.shoes || '#6b4a3a'));
      shoe.scale.set(1, 0.6, 1.3); shoe.position.set(x, 0.1, 0.05);
      body.add(shoe);
      body.add(leg);
      if (o.sneakers) {                              // white sneakers: a sole and a tan heel tab
        const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), mat('#e9dfcf'));
        sole.scale.set(1, 1, 1.3); sole.position.set(x, 0.035, 0.05); body.add(sole);
        const tab = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#d9a35a')); tab.position.set(x, 0.16, -0.15); body.add(tab);
      }
      if (o.cuffs) {                                 // rolled-up jeans
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 16).rotateX(Math.PI / 2), mat(o.cuffs));
        cuff.position.set(x, 0.24, 0); body.add(cuff);
      }
    }
  }
  // torso
  const shirtMat = o.knit ? toon({ color: o.shirt, map: knit() }) : mat(o.shirt);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.47, 0.26, 6, 16), shirtMat);
  torso.position.y = 0.98;
  torso.scale.x = o.wide;
  body.add(torso);

  // arms (pivot at shoulder)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (0.47 * o.wide + 0.06), 1.28, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(o.knit ? 0.15 : 0.13, 0.26, 4, 8), shirtMat);   // knit sleeves are a bit puffy
    arm.position.y = -0.22;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat(o.skin));
    hand.position.y = -0.44;
    pivot.add(hand);
    body.add(pivot);
    arms.push(pivot);
  }

  if (o.knit) {                                    // a ribbed collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20).rotateX(Math.PI / 2), shirtMat);
    collar.position.y = 1.42; body.add(collar);
  }
  if (o.hoodie) {                                  // a hoodie: the hood bunched behind the neck, a pocket, drawstrings
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 10, 22), shirtMat);
    hood.rotation.x = Math.PI / 2 - 0.5; hood.position.set(0, 1.42, -0.12); hood.scale.set(1.1, 1, 0.9); body.add(hood);
    const pocket = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10).rotateZ(Math.PI / 2), shirtMat);
    pocket.scale.set(1, 1, 0.45); pocket.position.set(0, 0.86, 0.43); body.add(pocket);
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 5), mat('#fbf6ee')); st.position.set(sx * 0.1, 1.3, 0.44); body.add(st); }
  }
  if (o.brooch) { const d = daisy(0.08); d.position.set(0.18, 1.18, 0.46); body.add(d); }   // Grandma's daisy button
  if (o.backpack) {                                // a brown leather backpack with a daisy patch
    const pack = new THREE.Group();
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.22, 6, 12), mat(o.backpack));
    bag.scale.set(1.15, 1, 0.6); pack.add(bag);
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#a06a3e'));
    flap.scale.set(1.18, 0.6, 0.68); flap.position.y = 0.12; pack.add(flap);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.08), mat('#a06a3e'));
    pocket.position.set(0, -0.12, -0.17); pack.add(pocket);
    const d = daisy(0.07); d.position.set(0, -0.1, -0.22); d.rotation.y = Math.PI; pack.add(d);
    pack.position.set(0, 1.02, -0.42);
    body.add(pack);
    for (const sx of [-1, 1]) {                    // straps over the shoulders
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 14, Math.PI), mat('#7a4a2a'));
      strap.rotation.y = Math.PI / 2; strap.position.set(sx * 0.26, 1.1, -0.05); strap.scale.set(1, 1.15, 1);
      body.add(strap);
    }
  }

  // head
  const head = new THREE.Group();
  const HEAD_Y = 1.95;
  head.position.y = HEAD_Y;
  head.scale.set(1.1, 1.02, 1.02);              // a wide, round face
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 24), mat(o.skin));
  head.add(skull);

  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture('normal', o), transparent: true, depthWrite: false });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.785, 32, 20, Math.PI / 2 - 0.68, 1.36, Math.PI / 2 - 0.5, 1.0), faceMat);
  face.userData.noOutline = true;
  face.userData.noShadow = true;
  head.add(face);

  // hair: soft volumes only (no spikes: sharp shapes read as danger)
  const SOFT = { '#1a1a1a': '#3d2c25', '#2a2a2a': '#45332a', '#111111': '#3d2c25' };
  const hairMat = mat(SOFT[o.hair] || o.hair);
  const tufts = [];                                 // top-of-head hair that hides under hats
  const blob = (r, x, y, z, sx = 1, sy = 1, sz = 1, m = hairMat) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
    b.position.set(x, y, z); b.scale.set(sx, sy, sz);
    head.add(b); return b;
  };
  if (o.hairStyle === 'bowl') {
    // a thick round bowl cut: a dome down to the brows, full sides over the
    // ears, rounded bangs, tousled top, one cowlick
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.88, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.43), hairMat);
    dome.position.y = 0.02; head.add(dome);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.86, 32, 16, Math.PI * 1.08, Math.PI * 0.84, 0, Math.PI * 0.8), hairMat);
    head.add(back);
    for (let i = -4; i <= 4; i++) {                  // a soft continuous fringe, longest in the middle
      const a = i * 0.2;
      blob(0.2, 0.86 * Math.sin(a), 0.28 - Math.abs(i) * 0.015, 0.86 * Math.cos(a) - 0.1, 1.45, 0.8 + (4 - Math.abs(i)) * 0.03, 0.55);
    }
    for (const sx of [-1, 1]) { blob(0.3, sx * 0.74, 0.08, 0.02, 0.75, 1.1, 1.05); blob(0.28, sx * 0.68, -0.08, -0.32, 0.8, 1.05, 1); }   // full sides over the ears
    const cow = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12, Math.PI * 1.3), hairMat);
    cow.position.set(0.05, 1.02, 0.02); cow.rotation.set(0, 0.4, 0.6); head.add(cow); tufts.push(cow);
  }
  if (o.hairStyle !== 'bald' && o.hairStyle !== 'bowl') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.82, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    cap.rotation.x = -0.3;                          // rim rises at the front: a high forehead
    head.add(cap);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.815, 32, 16, Math.PI, Math.PI, 0, Math.PI * 0.78), hairMat);
    head.add(back);                                 // no bald patch behind
    for (let i = -2; i <= 2; i++) {                 // a soft scalloped fringe
      const a = i * 0.33, th = 1.24 + Math.abs(i) * 0.05;
      blob(0.22, 0.8 * Math.sin(th) * Math.sin(a), 0.8 * Math.cos(th), 0.8 * Math.sin(th) * Math.cos(a), 1.25, 0.75, 0.6);
    }
  }
  if (o.hairStyle === 'messybun') {
    // a big curly top-knot made of curls, and loose ringlets framing the face
    for (const [x, y, z, rr] of [[0, 0.98, -0.12, 0.3], [-0.2, 0.92, -0.05, 0.2], [0.2, 0.94, -0.08, 0.2], [0.02, 1.15, -0.1, 0.2], [-0.12, 1.06, -0.3, 0.19], [0.15, 1.06, -0.28, 0.18], [0.0, 0.9, -0.36, 0.2]]) tufts.push(blob(rr, x, y, z));
    for (const sx of [-1, 1]) {                    // two soft ringlets by each cheek
      blob(0.17, sx * 0.72, -0.12, 0.18, 0.8, 1.2, 0.8);
      blob(0.12, sx * 0.7, -0.42, 0.12, 0.8, 1.3, 0.8);
    }
    for (const [x, y, z, rr] of [[-0.5, 0.42, 0.6, 0.12], [0.48, 0.45, 0.6, 0.11]]) blob(rr, x, y, z);
    for (const [x, y, z] of [[-0.45, 0.62, -0.5], [0.45, 0.6, -0.5], [0, 0.5, -0.75], [-0.6, 0.2, -0.45], [0.6, 0.2, -0.45]]) blob(0.2, x, y, z);   // curly volume at the back
  } else if (o.hairStyle === 'bun') {
    blob(0.34, 0, 0.74, -0.32);
  } else if (o.hairStyle === 'long') {
    const longBack = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 0.45, 6, 16), hairMat);
    longBack.position.set(0, -0.38, -0.36);
    longBack.scale.set(1.15, 1, 0.65);
    head.add(longBack);
  } else if (o.hairStyle === 'pony') {
    const tail = blob(0.26, 0, 0.05, -0.95, 1, 1.5, 1, mat(o.hairTip || o.hair));
    tail.rotation.x = 0.5;
  } else if (o.hairStyle === 'spiky') {             // tousled round tufts, not spikes
    for (const [x, y, z, r] of [[-0.3, 0.72, 0.15, 0.24], [0.05, 0.8, 0.2, 0.26], [0.35, 0.7, 0.1, 0.22], [-0.1, 0.78, -0.2, 0.25], [0.25, 0.72, -0.3, 0.22]]) tufts.push(blob(r, x, y, z));
    const curl = blob(0.13, 0.02, 0.98, 0.15);
    curl.scale.set(1, 1.3, 1);
    tufts.push(curl);
  } else if (o.hairStyle === 'bald') {
    for (const x of [-0.72, 0.72]) blob(0.22, x, -0.05, -0.1);
  }

  if (o.flower) {                                  // the white daisy clip, just above the right ear
    const f = daisy(0.13); f.position.set(0.58, 0.48, 0.42); f.rotation.y = 0.9;
    head.add(f); tufts.push(f);
  }

  // hats
  const hatParts = new THREE.Group();
  head.add(hatParts);
  const setHat = (hat, color = o.hatColor) => {
    hatParts.clear();
    for (const t of tufts) t.visible = !hat || hat === 'none' || hat === 'scarf';
    if (hat === 'duck') {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.88, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#ffd23f'));
      helm.position.y = 0.05;
      hatParts.add(helm);
      const bill = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), mat('#ff9a1f'));
      bill.position.set(0, 0.42, 0.78);
      bill.rotation.x = 0.25;
      hatParts.add(bill);
      for (const x of [-0.28, 0.28]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#2b1d14'));
        eye.position.set(x, 0.66, 0.52);
        hatParts.add(eye);
      }
    } else if (hat === 'cap') {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(color));
      c.position.y = 0.08;
      hatParts.add(c);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.55), mat(color));
      visor.position.set(0, 0.42, 0.75);
      hatParts.add(visor);
    } else if (hat === 'chef') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.8, 16), mat('#ffffff'));
      c.position.y = 0.95;
      hatParts.add(c);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 10), mat('#ffffff'));
      puff.position.y = 1.4;
      hatParts.add(puff);
    } else if (hat === 'scarf') {
      const s = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 16), mat(color));
      s.rotation.x = Math.PI / 2;
      s.position.y = -0.72;
      hatParts.add(s);
    }
    outline(hatParts, 1.05);
  };
  setHat(o.hat);
  outline(body, 1.05);

  // props
  const prop = new THREE.Group();
  arms[1].add(prop);
  prop.position.y = -0.62;
  if (o.prop === 'selfie') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), mat('#333333'));
    stick.rotation.x = Math.PI / 2; stick.position.z = 0.6;
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.05), mat('#111111'));
    phone.position.z = 1.3; phone.position.y = 0.1;
    prop.add(stick, phone);
  } else if (o.prop === 'fan') {
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16, 0, Math.PI), toon({ color: '#ff6fa8', side: THREE.DoubleSide }));
    fan.position.set(0, -0.1, 0.1);
    fan.userData.noOutline = true;
    prop.add(fan);
  } else if (o.prop === 'ladle') {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mat('#8a6a4a'));
    h.position.y = -0.3;
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#b0b0b0'));
    cup.position.y = -0.75;
    prop.add(h, cup);
  }

  root.scale.setScalar(o.scale);

  let expr = 'normal';
  let walkPhase = 0;
  const api = {
    root, head, arms, body, headY: HEAD_Y,
    get expr() { return expr; },
    setFace(e) {
      expr = e || 'normal';
      faceMat.map = faceTexture(expr, o);
      faceMat.needsUpdate = true;
    },
    setHat,
    setShirt(color) { torso.material = mat(color); for (const a of arms) a.children[0].material = mat(color); },
    // speed: units/s on the ground; used to drive the walk cycle
    animate(dt, speed, t) {
      if (speed > 0.3) {
        walkPhase += dt * (4 + speed * 1.2);
        const s = Math.sin(walkPhase);
        arms[0].rotation.x = s * 0.7; arms[1].rotation.x = -s * 0.7;
        body.position.y = Math.abs(Math.cos(walkPhase)) * 0.12;
      } else {
        arms[0].rotation.x *= 0.85; arms[1].rotation.x *= 0.85;
        body.position.y = Math.sin(t * 2.2) * 0.03;
      }
      head.rotation.z = Math.sin(t * 1.3) * 0.03;
    },
    wave(t) { arms[1].rotation.z = 2.4 + Math.sin(t * 10) * 0.3; },
    unwave() { arms[1].rotation.z = 0; },
  };
  root.userData.char = api;
  return api;
}
