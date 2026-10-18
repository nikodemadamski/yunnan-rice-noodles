// Hand-painted surface textures, drawn on canvas at load (no image files).
// The look we're after (Animal Crossing's paving, Stardew's grass, Child of
// Light's paper): the ground is never one flat colour; every surface has
// shapes, wear, warm darks and little highlights.

import * as THREE from 'three';
import { rng } from './core.js';

const R = rng(404);
const pick = a => a[Math.floor(R() * a.length)];

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function tex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(repeat, repeat);
  return t;
}
// wrap-around drawing so tiles join seamlessly
function wrapDraw(ctx, size, x, y, r, fn) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    if (x + dx < -r || x + dx > size + r || y + dy < -r || y + dy > size + r) continue;
    fn(x + dx, y + dy);
  }
}
function speckle(ctx, size, n, cols, rMax = 1.6, alpha = 0.35) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = pick(cols);
    ctx.beginPath(); ctx.arc(R() * size, R() * size, 0.4 + R() * rMax, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Rounded cobblestones in warm stone colours with dark grout (Animal Crossing paving). */
export function cobbles() {
  const S = 512, [c, ctx] = canvas(S);
  ctx.fillStyle = '#b9a78c'; ctx.fillRect(0, 0, S, S);              // grout
  const STONES = ['#efe2cb', '#e6d6bb', '#ecdcc4', '#e0cfb2', '#f2e6d2', '#e8d2bf', '#dcd2c0'];
  const rows = 8, h = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * h * 0.5 - h * 0.5;
    while (x < S) {
      const w = h * (0.8 + R() * 0.6);
      const cx = x + w / 2, cy = r * h + h / 2;
      const col = pick(STONES);
      wrapDraw(ctx, S, cx, cy, w, (px, py) => {
        const rw = w / 2 - 4, rh = h / 2 - 4, rr = Math.min(rw, rh) * 0.7;
        // body
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(px - rw, py - rh, rw * 2, rh * 2, rr); ctx.fill();
        // soft shading: darker lower-right, light top-left
        const g = ctx.createLinearGradient(px - rw, py - rh, px + rw, py + rh);
        g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,90,60,0.22)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(110,85,60,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      });
      x += w;
    }
  }
  speckle(ctx, S, 900, ['#8a7358', '#ffffff', '#b8a283'], 1.4, 0.25);
  // a few moss tufts in the cracks
  speckle(ctx, S, 60, ['#8fbf62', '#7aae54'], 2.4, 0.55);
  return tex(c);
}

/** Old-street bluestone flags (青石板): big worn slabs, blue-grey, rain-polished. */
export function flagstones() {
  const S = 512, [c, ctx] = canvas(S);
  ctx.fillStyle = '#7d8590'; ctx.fillRect(0, 0, S, S);              // joints
  const SLABS = ['#a9b2bb', '#9fa9b3', '#b3bbc2', '#a3aab6', '#aeb4b0', '#9aa4ae'];
  const rows = 4, h = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = -R() * h;
    while (x < S) {
      const w = h * (1.1 + R() * 0.9);
      const col = pick(SLABS), cx = x + w / 2, cy = r * h + h / 2;
      wrapDraw(ctx, S, cx, cy, w, (px, py) => {
        const rw = w / 2 - 3, rh = h / 2 - 3;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(px - rw, py - rh, rw * 2, rh * 2, 8); ctx.fill();
        // worn, polished centre where feet go
        const g = ctx.createRadialGradient(px, py, 4, px, py, rw);
        g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(40,50,70,0.12)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(60,66,80,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      });
      x += w;
    }
  }
  speckle(ctx, S, 1800, ['#ffffff', '#5f6874', '#c9d0d6'], 1.2, 0.28);
  speckle(ctx, S, 50, ['#7fae5a', '#6f9e4e'], 2.6, 0.6);           // moss in the joints
  return tex(c);
}

/** Warm wooden planks with grain and knots (counters, tables). */
export function wood(base = '#d9a873') {
  const S = 512, [c, ctx] = canvas(S);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  const planks = 6, h = S / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * h;
    ctx.fillStyle = `rgba(${R() < 0.5 ? '255,235,205' : '120,70,35'},${0.06 + R() * 0.08})`;
    ctx.fillRect(0, y0, S, h);
    ctx.strokeStyle = 'rgba(110,62,30,0.22)'; ctx.lineWidth = 1.3;
    for (let k = 0; k < 9; k++) {
      const y = y0 + 6 + R() * (h - 12), amp = 2 + R() * 4, f = 0.01 + R() * 0.02, ph = R() * 6;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 8) { const yy = y + Math.sin(x * f + ph) * amp; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
    }
    for (let k = 0; k < 2; k++) { if (R() < 0.5) continue; const x = R() * S, y = y0 + h / 2 + (R() - 0.5) * h * 0.4; ctx.fillStyle = 'rgba(110,60,28,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(90,50,25,0.55)'; ctx.fillRect(0, y0, S, 2.5);   // plank seam
  }
  speckle(ctx, S, 600, ['#7a4a26', '#fff1dc'], 1, 0.2);
  return tex(c);
}

/** Warm, worn asphalt with patches and painted wear. */
export function asphalt() {
  const S = 512, [c, ctx] = canvas(S);
  ctx.fillStyle = '#b9b3bd'; ctx.fillRect(0, 0, S, S);
  // big soft blotches of tone
  for (let i = 0; i < 40; i++) {
    const x = R() * S, y = R() * S, r = 30 + R() * 70;
    wrapDraw(ctx, S, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, R() < 0.5 ? 'rgba(90,85,110,0.07)' : 'rgba(255,245,235,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  // patched squares
  // hairline cracks
  ctx.strokeStyle = 'rgba(80,72,95,0.22)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = R() * S, y = R() * S; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  speckle(ctx, S, 3000, ['#ffffff', '#7d7688', '#d4ced8', '#9a93a4'], 1.0, 0.28);
  return tex(c);
}

/** Lush painted grass: clumps, light patches, blade strokes, flower specks. */
export function grass() {
  const S = 512, [c, ctx] = canvas(S);
  ctx.fillStyle = '#8ccc63'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = R() * S, y = R() * S, r = 18 + R() * 50;
    wrapDraw(ctx, S, x, y, r, (px, py) => {
      ctx.fillStyle = R() < 0.5 ? 'rgba(98,170,72,0.45)' : 'rgba(170,224,120,0.4)';
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.7, R() * 3, 0, Math.PI * 2); ctx.fill();
    });
  }
  // blade strokes, little "v" tufts like Stardew
  ctx.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = R() * S, y = R() * S, h = 4 + R() * 6;
    ctx.strokeStyle = pick(['#5f9e44', '#6fb04f', '#a6dc7a', '#4f8f3a']);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - 2, y - h); ctx.lineTo(x, y); ctx.lineTo(x + 2, y - h * 0.9); ctx.stroke();
  }
  speckle(ctx, S, 120, ['#ffffff', '#fff27a', '#ffb3c8', '#c9b3ff'], 1.8, 0.85);
  return tex(c);
}

/** Water with soft bands and white ripple squiggles. */
export function water() {
  const S = 512, [c, ctx] = canvas(S);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#6cc0d8'); g.addColorStop(0.5, '#5fb3d0'); g.addColorStop(1, '#6cc0d8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const x = R() * S, y = R() * S, r = 40 + R() * 80;
    ctx.fillStyle = R() < 0.5 ? 'rgba(130,215,235,0.25)' : 'rgba(60,140,180,0.18)';
    wrapDraw(ctx, S, x, y, r, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const x = R() * S, y = R() * S, w = 14 + R() * 26;
    wrapDraw(ctx, S, x, y, w, (px, py) => {
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + w / 4, py - 4, px + w / 2, py); ctx.quadraticCurveTo(px + w * 3 / 4, py + 4, px + w, py); ctx.stroke();
    });
  }
  return tex(c);
}

/** A soft-edged dark rectangle: contact shadow under buildings and props. */
export function contact() {
  const S = 128, [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(60,40,70,0.55)'); g.addColorStop(1, 'rgba(60,40,70,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Paper grain + warm vignette over the 3D view, under the UI (the hand-made feel). */
export function paperOverlay() {
  const S = 256, [c, ctx] = canvas(S);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.floor(R() * 55);
    img.data[i] = v; img.data[i + 1] = v - 4; img.data[i + 2] = v - 12; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // fibres
  ctx.strokeStyle = 'rgba(150,120,90,0.18)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 70; i++) { const x = R() * S, y = R() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * 18, y + (R() - 0.5) * 18); ctx.stroke(); }
  const el = document.createElement('div');
  el.id = 'paper';
  el.style.backgroundImage = `url(${c.toDataURL()})`;
  return el;
}
