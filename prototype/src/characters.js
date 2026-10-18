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

function faceTexture(expr, o) {
  const key = `${expr}|${o.blush}|${o.glasses}|${o.brows}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.translate(0, 9);                     // features sit low on the face: big forehead, baby-like
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ink = '#2b1d14';
  const L = 42, Rx = 86, Y = 44;

  const dotEyes = (ry = 10) => {
    g.fillStyle = ink;
    for (const x of [L, Rx]) {
      g.beginPath(); g.ellipse(x, Y, 8.5, ry * 1.15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x + 2.5, Y - 4.5, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x - 2.5, Y + 4, 1.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink;
    }
  };
  const mouth = (kind) => {
    g.strokeStyle = ink; g.lineWidth = 4; g.fillStyle = '#7a2b22';
    g.beginPath();
    if (kind === 'smile') g.arc(64, 64, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (kind === 'big') { g.arc(64, 64, 12, 0, Math.PI); g.closePath(); g.fill(); }
    else if (kind === 'o') { g.ellipse(64, 72, 7, 9, 0, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'frown') g.arc(64, 80, 10, 1.15 * Math.PI, 1.85 * Math.PI);
    else if (kind === 'flat') { g.moveTo(54, 72); g.lineTo(74, 72); }
    else if (kind === 'smirk') { g.moveTo(54, 72); g.quadraticCurveTo(68, 76, 78, 66); }
    else if (kind === 'wobble') { g.moveTo(52, 74); g.quadraticCurveTo(58, 68, 64, 74); g.quadraticCurveTo(70, 80, 76, 72); }
    g.stroke();
  };
  const brows = (tilt) => {
    g.strokeStyle = ink; g.lineWidth = 5;
    g.beginPath();
    g.moveTo(L - 10, 26 - tilt); g.lineTo(L + 9, 26 + tilt);
    g.moveTo(Rx - 9, 26 + tilt); g.lineTo(Rx + 10, 26 - tilt);
    g.stroke();
  };

  switch (expr) {
    case 'happy':
      g.strokeStyle = ink; g.lineWidth = 6;
      for (const x of [L, Rx]) { g.beginPath(); g.arc(x, Y + 4, 8, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke(); }
      mouth('big'); break;
    case 'shock':
      for (const x of [L, Rx]) {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, Y, 13, 0, Math.PI * 2); g.fill();
        g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
        g.fillStyle = ink; g.beginPath(); g.arc(x, Y, 4.5, 0, Math.PI * 2); g.fill();
      }
      mouth('o'); break;
    case 'sad':
      dotEyes(8); brows(-6); mouth('frown');
      g.fillStyle = '#6ec6ff'; g.beginPath(); g.ellipse(Rx + 6, Y + 18, 4, 7, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'angry':
      dotEyes(8); brows(7); mouth('flat'); break;
    case 'smug':
      dotEyes(9);
      g.fillStyle = '#00000000';
      g.strokeStyle = ink; g.lineWidth = 5;
      for (const x of [L, Rx]) { g.beginPath(); g.moveTo(x - 10, Y - 3); g.lineTo(x + 10, Y - 3); g.stroke(); }
      mouth('smirk'); break;
    case 'blank':
      g.fillStyle = ink;
      for (const x of [L, Rx]) { g.beginPath(); g.arc(x, Y, 3.5, 0, Math.PI * 2); g.fill(); }
      mouth('flat'); break;
    case 'cry':
      g.strokeStyle = ink; g.lineWidth = 6;
      for (const x of [L, Rx]) { g.beginPath(); g.arc(x, Y + 6, 8, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke(); }
      g.fillStyle = '#6ec6ff';
      g.fillRect(L - 4, Y + 6, 8, 28); g.fillRect(Rx - 4, Y + 6, 8, 28);
      mouth('wobble'); break;
    default:
      dotEyes(); mouth('smile');
  }
  if (o.brows && expr === 'normal') brows(2);
  if (o.blush) {
    g.fillStyle = 'rgba(255,120,140,0.45)';
    g.beginPath(); g.ellipse(24, 62, 10, 6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(104, 62, 10, 6, 0, 0, Math.PI * 2); g.fill();
  }
  if (o.glasses) {
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 3;
    g.beginPath(); g.arc(L, Y, 15, 0, Math.PI * 2); g.moveTo(Rx + 15, Y); g.arc(Rx, Y, 15, 0, Math.PI * 2);
    g.moveTo(L + 15, Y); g.lineTo(Rx - 15, Y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, tex);
  return tex;
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
      body.add(leg);
    }
  }
  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.47, 0.26, 6, 16), mat(o.shirt));
  torso.position.y = 0.98;
  torso.scale.x = o.wide;
  body.add(torso);

  // arms (pivot at shoulder)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (0.47 * o.wide + 0.06), 1.28, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.26, 4, 8), mat(o.shirt));
    arm.position.y = -0.22;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat(o.skin));
    hand.position.y = -0.44;
    pivot.add(hand);
    body.add(pivot);
    arms.push(pivot);
  }

  // head
  const head = new THREE.Group();
  const HEAD_Y = 2.0;
  head.position.y = HEAD_Y;
  head.scale.setScalar(1.16);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 18), mat(o.skin));
  head.add(skull);

  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture('normal', o), transparent: true, depthWrite: false });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.785, 32, 20, Math.PI / 2 - 0.68, 1.36, Math.PI / 2 - 0.5, 1.0), faceMat);
  face.userData.noOutline = true;
  face.userData.noShadow = true;
  head.add(face);

  // hair
  const hairMat = mat(o.hair);
  if (o.hairStyle !== 'bald') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    cap.rotation.x = -0.35;
    cap.position.set(0, 0.04, -0.06);
    head.add(cap);
  }
  if (o.hairStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), hairMat);
    bun.position.set(0, 0.72, -0.35);
    head.add(bun);
  } else if (o.hairStyle === 'long') {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.5, 4, 12), hairMat);
    back.position.set(0, -0.35, -0.38);
    back.scale.z = 0.6;
    head.add(back);
  } else if (o.hairStyle === 'pony') {
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), mat(o.hairTip || o.hair));
    tail.position.set(0, 0.1, -0.92);
    tail.rotation.x = 0.7;
    head.add(tail);
  } else if (o.hairStyle === 'spiky') {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), hairMat);
      s.position.set(-0.4 + i * 0.2, 0.72, 0.05 - Math.abs(i - 2) * 0.08);
      s.rotation.z = (i - 2) * -0.3;
      head.add(s);
    }
  } else if (o.hairStyle === 'bald') {
    for (const x of [-0.72, 0.72]) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hairMat);
      tuft.position.set(x, -0.05, -0.1);
      head.add(tuft);
    }
  }

  // hats
  const hatParts = new THREE.Group();
  head.add(hatParts);
  const setHat = (hat, color = o.hatColor) => {
    hatParts.clear();
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
