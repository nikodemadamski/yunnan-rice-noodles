// Food that looks like food. Each ingredient is painted once (per variant
// and cooked state) into a small offscreen canvas: one light from the top
// left, soft contact shadow, gloss where it's wet or oily, translucency where
// it's raw, texture where it's real (marbling, fibres, gills, seeds). No black
// outlines: edges are a deeper shade of the food itself. The scenes then draw
// these sprites and cross-fade raw → cooked as the broth cooks them.

const SIZE = 124;                 // sprite box in scene units (±62)
const RES = 3;                    // pixels per unit
const cache = new Map();

function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const P2 = Math.PI * 2;

// --- small painting kit (g = a 2D context in scene units, origin at centre)
function shade(g, path, base, light, dark, lx = -0.5, ly = -0.6, r = 40) {
  const gr = g.createRadialGradient(lx * r * 0.6, ly * r * 0.6, r * 0.05, 0, 0, r * 1.15);
  gr.addColorStop(0, light); gr.addColorStop(0.55, base); gr.addColorStop(1, dark);
  path(); g.fillStyle = gr; g.fill();
}
function rim(g, path, col, w = 1.6) { path(); g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
function gloss(g, x, y, rx, ry, rot = -0.5, a = 0.7) {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, P2); g.restore(); g.fillStyle = gr; g.fill();
}
function contact(g, rx, ry, dx = 4, dy = 6, a = 0.28) {
  const gr = g.createRadialGradient(dx, dy, 0, dx, dy, rx);
  gr.addColorStop(0, `rgba(70,40,25,${a})`); gr.addColorStop(1, 'rgba(70,40,25,0)');
  g.save(); g.scale(1, ry / rx); g.beginPath(); g.arc(dx, dy * rx / ry, rx, 0, P2); g.restore(); g.fillStyle = gr; g.fill();
}
const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = sh => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };
// an organic blob outline (for slices, puddles, egg whites)
function blobPath(g, rx, ry, R, wob = 0.12, n = 18) {
  g.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * P2, k = 1 + (R() - 0.5) * wob * 2; pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]); }
  for (let i = 0; i <= n; i++) { const [x0, y0] = pts[i % n], [x1, y1] = pts[(i + 1) % n]; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(x0, y0, mx, my); }
  g.closePath();
}

// --- the ingredients. cook: 0 raw → 1 cooked; 'shell' for eggs in the tray
const PAINT = {
  pork(g, R, cook) {        // paper-thin loin slices, fanned; raw rose-pink with a pale fat edge, cooked opal-white and curled
    contact(g, 44, 26);
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate((i - 1) * 9, (i - 1) * 6); g.rotate(-0.5 + i * 0.42 + (R() - 0.5) * 0.2);
      const rx = 30, ry = 17 * (1 - cook * 0.12);
      const path = () => blobPath(g, rx, ry, rng(i * 7 + 3), 0.08 + cook * 0.1);
      shade(g, path, mix('#f08a94', '#eadbcd', cook), mix('#ffc2c6', '#fff7ee', cook), mix('#c95b6a', '#c9b3a2', cook), -0.5, -0.6, 30);
      g.save(); path(); g.clip();
      g.globalAlpha = 0.5; g.strokeStyle = mix('#fff0f0', '#ffffff', cook); g.lineWidth = 2;   // fine marbling
      for (let k = 0; k < 5; k++) { g.beginPath(); const y = -ry + (k + 0.5) * ry * 0.4; g.moveTo(-rx, y + R() * 4); g.bezierCurveTo(-10, y - 4 + R() * 8, 10, y + R() * 8, rx, y); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = mix('#fde9e4', '#fbf4ea', cook); g.fillRect(-rx, ry - 6, rx * 2, 8);   // the fat edge
      g.restore();
      rim(g, path, mix('#b84c5c', '#b7a08e', cook), 1.4);
      gloss(g, -8, -6, 12, 4, -0.4, 0.55 - cook * 0.3);
      g.restore();
    }
  },
  fish(g, R, cook) {        // black fish (乌鱼) slices: translucent pearl when raw with a dark skin edge; cooked opaque white, flakes showing
    contact(g, 42, 24);
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate((i - 1) * 10, (i - 1) * 5); g.rotate(-0.6 + i * 0.5);
      const rx = 28, ry = 15;
      const path = () => blobPath(g, rx, ry, rng(i * 5 + 11), 0.06 + cook * 0.12);
      shade(g, path, mix('#d6dde6', '#fbf8f1', cook), mix('#f6f9ff', '#ffffff', cook), mix('#9aa6b4', '#d9d0c2', cook), -0.5, -0.6, 28);
      g.save(); path(); g.clip();
      g.strokeStyle = cook > 0.5 ? 'rgba(200,185,165,0.6)' : 'rgba(130,140,160,0.45)'; g.lineWidth = 1.5;
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 8 - 6, -ry); g.quadraticCurveTo(k * 8 + 6, 0, k * 8 - 6, ry); g.stroke(); }   // the muscle flakes
      g.fillStyle = mix('#4a5160', '#8e8a84', cook); g.fillRect(-rx, -ry, rx * 2, 4);                                                     // black skin edge
      g.restore();
      rim(g, path, mix('#8792a3', '#c8bba8', cook), 1.3);
      gloss(g, -6, -4, 13, 4, -0.3, 0.7 - cook * 0.4);
      g.restore();
    }
  },
  egg(g, R, cook, shell) {
    if (shell) {             // quail eggs in the tray: cream shells with brown blotches, a soft gloss
      contact(g, 34, 22);
      for (const [dx, dy, a] of [[-15, 3, -0.3], [13, -6, 0.4], [3, 13, 0.1]]) {
        g.save(); g.translate(dx, dy); g.rotate(a);
        const path = () => { g.beginPath(); g.ellipse(0, 0, 11.5, 15, 0, 0, P2); };
        shade(g, path, '#ecdcc0', '#fff8e8', '#b9a17c', -0.5, -0.6, 15);
        g.save(); path(); g.clip(); for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse((R() - 0.5) * 20, (R() - 0.5) * 26, 1.5 + R() * 3.5, 1 + R() * 2.5, R() * 3, 0, P2); g.fillStyle = R() < 0.5 ? '#6b4a32' : '#8a6a4a'; g.fill(); } g.restore();
        rim(g, path, '#a88c66', 1.2); gloss(g, -4, -7, 5, 3, -0.6, 0.8);
        g.restore();
      }
      return;
    }
    // cracked into the broth: the white sets from clear to snowy, the yolk glows
    contact(g, 30, 22, 3, 4, 0.18);
    const white = () => blobPath(g, 30, 25, rng(77), 0.18, 16);
    g.globalAlpha = 0.45 + cook * 0.55; shade(g, white, mix('#fff6dc', '#ffffff', cook), '#ffffff', mix('#efe2bf', '#e9e3d6', cook), -0.4, -0.5, 30); g.globalAlpha = 1;
    const yolk = () => { g.beginPath(); g.arc(3, 1, 11, 0, P2); };
    shade(g, yolk, mix('#ffa51f', '#f7b93c', cook), '#ffe08a', mix('#e07a0c', '#d99a2a', cook), -0.5, -0.6, 11);
    rim(g, yolk, mix('#d97a10', '#c98a2a', cook), 1);
    gloss(g, -1, -4, 5, 3, -0.5, 0.9);
  },
  ham(g, R) {               // Xuanwei ham (宣威火腿): deep rose-red lean, cream fat, a dry-cured sheen
    contact(g, 40, 24);
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate((i - 1) * 9, (i - 1) * 5); g.rotate(-0.7 + i * 0.6);
      const path = () => { g.beginPath(); g.roundRect(-24, -13, 48, 26, 5); };
      shade(g, path, '#b8323e', '#e36070', '#7e1d28', -0.5, -0.6, 26);
      g.save(); path(); g.clip();
      g.fillStyle = '#f7ead8'; g.beginPath(); g.moveTo(-24, 6); g.quadraticCurveTo(0, 2 + R() * 4, 24, 7); g.lineTo(24, 13); g.lineTo(-24, 13); g.fill();   // the fat
      g.strokeStyle = 'rgba(255,215,215,0.5)'; g.lineWidth = 1.2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-20 + R() * 10, -10 + k * 4); g.lineTo(10 + R() * 12, -8 + k * 4 + R() * 3); g.stroke(); }
      g.restore();
      rim(g, path, '#6d1a24', 1.2);
      gloss(g, -8, -6, 12, 3.5, -0.2, 0.45);
      g.restore();
    }
  },
  chrys(g, R) {             // chrysanthemum petals (菊花): long, soft gold, a scatter like confetti
    contact(g, 34, 22, 3, 4, 0.16);
    for (let i = 0; i < 22; i++) {
      g.save(); const a = R() * P2, d = R() * 22; g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(R() * P2);
      const L = 9 + R() * 6;
      const path = () => { g.beginPath(); g.ellipse(0, 0, L, 2.6, 0, 0, P2); };
      shade(g, path, R() < 0.3 ? '#ffd44a' : '#ffe27a', '#fff6c4', '#e3a91c', -0.5, -0.5, L);
      g.restore();
    }
  },
  pea(g, R) {               // pea shoots (豌豆尖): tender stems, round young leaves, curling tendrils
    contact(g, 38, 24, 3, 4, 0.18);
    for (let i = 0; i < 4; i++) {
      g.save(); g.rotate(-1 + i * 0.7 + R() * 0.3);
      g.strokeStyle = '#7cba52'; g.lineWidth = 3.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-26, 6); g.bezierCurveTo(-10, -4, 6, 8, 26, -2); g.stroke();
      for (const [x, y, r] of [[-10, -4, 8], [6, 4, 9], [20, -6, 7]]) {
        const path = () => { g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * 3, 0, P2); };
        shade(g, path, '#78c25a', '#c4f08e', '#4c8f36', -0.5, -0.6, r);
        g.strokeStyle = 'rgba(60,110,40,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - r * 0.7, y); g.lineTo(x + r * 0.7, y); g.stroke();
      }
      g.strokeStyle = '#8fcf62'; g.lineWidth = 1.4; g.beginPath(); g.arc(28, -6, 5, Math.PI, P2 * 0.9); g.stroke();   // a tendril
      g.restore();
    }
  },
  chives(g, R) {            // garlic chives (韭菜), cut short: glossy green tubes, pale ends where they were cut
    contact(g, 34, 22, 3, 4, 0.16);
    for (let i = 0; i < 14; i++) {
      g.save(); const a = R() * P2, d = R() * 18; g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(R() * P2);
      const L = 10 + R() * 4;
      const path = () => { g.beginPath(); g.roundRect(-L, -2.6, L * 2, 5.2, 2.6); };
      const gr = g.createLinearGradient(0, -2.6, 0, 2.6); gr.addColorStop(0, '#a6e07a'); gr.addColorStop(0.45, '#4fae3a'); gr.addColorStop(1, '#2f7d27');
      path(); g.fillStyle = gr; g.fill();
      g.fillStyle = '#d8f2b8'; g.beginPath(); g.ellipse(-L, 0, 1.4, 2.4, 0, 0, P2); g.ellipse(L, 0, 1.4, 2.4, 0, 0, P2); g.fill();
      g.restore();
    }
  },
  tofu(g, R) {              // tofu skin (豆腐皮): thin golden sheets, folded, little blisters
    contact(g, 40, 26);
    for (let i = 0; i < 2; i++) {
      g.save(); g.rotate(-0.4 + i * 0.9); g.translate(i * 6, i * 4);
      const path = () => blobPath(g, 30, 17, rng(i * 13 + 5), 0.1);
      shade(g, path, '#f1d58f', '#fff3c9', '#c9a35a', -0.5, -0.6, 30);
      g.save(); path(); g.clip();
      g.strokeStyle = 'rgba(190,150,80,0.55)'; g.lineWidth = 1.6; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-28, -8 + k * 8); g.bezierCurveTo(-10, -14 + k * 8, 8, -2 + k * 8, 28, -9 + k * 8); g.stroke(); }
      for (let k = 0; k < 10; k++) { g.beginPath(); g.arc((R() - 0.5) * 50, (R() - 0.5) * 26, 1.6, 0, P2); g.fillStyle = 'rgba(255,250,225,0.8)'; g.fill(); }
      g.restore();
      rim(g, path, '#b38c46', 1.2);
      g.restore();
    }
  },
  jizong(g, R) {            // jizong mushrooms (鸡枞): long ivory stems with fibres, dark pointed caps
    contact(g, 38, 24);
    for (let i = 0; i < 3; i++) {
      g.save(); g.rotate(-0.7 + i * 0.65); g.translate(0, 4);
      const stem = () => { g.beginPath(); g.moveTo(-5, -10); g.quadraticCurveTo(-7, 12, -4, 30); g.lineTo(4, 30); g.quadraticCurveTo(7, 12, 5, -10); g.closePath(); };
      shade(g, stem, '#f1e7d4', '#fffaf0', '#c9b896', -0.5, -0.3, 22);
      g.strokeStyle = 'rgba(170,150,120,0.6)'; g.lineWidth = 0.8; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 1.6, -8); g.lineTo(k * 1.8, 28); g.stroke(); }
      const cap = () => { g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(-10, -18, 0, -24); g.quadraticCurveTo(10, -18, 14, -6); g.quadraticCurveTo(0, -2, -14, -6); g.closePath(); };
      shade(g, cap, '#8a6244', '#c79a74', '#4f3524', -0.5, -0.8, 18);
      rim(g, cap, '#4a3020', 1.1); gloss(g, -4, -16, 5, 2.5, -0.6, 0.45);
      g.restore();
    }
  },
  chilli(g, R) {            // chilli oil: a glossy red puddle with chilli flakes and toasted sesame
    const path = () => blobPath(g, 34, 26, rng(19), 0.22, 14);
    g.globalAlpha = 0.9; shade(g, path, '#d1351c', '#ff7a4a', '#8a1a0c', -0.4, -0.5, 34); g.globalAlpha = 1;
    for (let k = 0; k < 18; k++) { g.beginPath(); g.ellipse((R() - 0.5) * 50, (R() - 0.5) * 36, 2 + R() * 2.5, 1.2 + R(), R() * 3, 0, P2); g.fillStyle = R() < 0.6 ? '#6a120a' : '#a8261a'; g.fill(); }
    for (let k = 0; k < 8; k++) { g.beginPath(); g.ellipse((R() - 0.5) * 44, (R() - 0.5) * 30, 2, 1.1, R() * 3, 0, P2); g.fillStyle = '#f6e1b0'; g.fill(); }
    gloss(g, -10, -8, 16, 5, -0.4, 0.75); gloss(g, 10, 6, 6, 2, -0.4, 0.5);
  },
  noodles(g, R) {           // fresh rice noodles (米线): a soft, heavy nest of round, glossy, slightly translucent strands
    contact(g, 50, 34, 4, 9, 0.3);
    // the body of the nest: creamy, shaded underneath, so it has weight
    const body = () => blobPath(g, 44, 34, rng(3), 0.12, 16);
    shade(g, body, '#ece4d4', '#fffdf6', '#b9ab94', -0.5, -0.6, 44);
    const strands = 64;
    for (let i = 0; i < strands; i++) {
      const a0 = R() * P2, rx = 12 + R() * 32, ry = 9 + R() * 24, cx = (R() - 0.5) * 14, cy = (R() - 0.5) * 12, rot = R() * 3;
      const a1 = a0 + 1.8 + R() * 3;
      const top = i / strands;                    // later strands sit on top: lighter, glossier
      g.beginPath(); g.ellipse(cx, cy + 1, rx, ry, rot, a0, a1);
      g.strokeStyle = `rgba(150,130,105,${0.35 * (1 - top)})`; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();   // the shadow between strands
      g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, a0, a1);
      g.strokeStyle = `rgb(${226 + top * 29},${220 + top * 33},${206 + top * 42})`; g.lineWidth = 4.2; g.stroke();
      g.beginPath(); g.ellipse(cx, cy - 0.9, rx, ry, rot, a0 + 0.2, a0 + 0.2 + (a1 - a0) * 0.35);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2; g.stroke();   // the wet shine along each strand
    }
    gloss(g, -14, -14, 22, 9, -0.5, 0.4);
  },
};

// --- rendered food (tools/blender/food.py): real geometry and materials, lit
// like food photography, same 124 mm box. Loaded in the background; until a
// picture arrives the painted sprite above stands in.
const STATES = { pork: [0, 1], fish: [0, 1], egg: ['shell', 0, 1] };
const KINDS = ['pork', 'fish', 'egg', 'ham', 'chrys', 'pea', 'chives', 'tofu', 'jizong', 'chilli', 'noodles'];
const shots = new Map();
const asset = name => new URL(`../assets/food2d/${name}.webp`, import.meta.url).href;
function load(key, name) {
  const im = new Image(); im.decoding = 'async';
  im.onload = () => shots.set(key, im);
  im.src = asset(name);
}
for (const k of KINDS) for (const st of STATES[k] || [1]) for (let v = 0; v < 3; v++) load(`${k}|${st}|${v}`, `${k}_${st}_${v}`);
for (const g of ['blue', 'celadon', 'red']) load(`bowl|${g}`, `bowl_${g}`);
load('dish', 'dish');
load('broth|clear', 'broth_clear'); load('broth|sealed', 'broth_sealed');
const GLAZE = { '#3a6ea5': 'blue', '#7fb5a0': 'celadon', '#c0392b': 'red' };

/** The sprite for one ingredient (cached). cook: 0 raw..1 cooked (snapped to raw/cooked), or 'shell'. */
export function foodSprite(kind, cook = 1, variant = 0) {
  const shell = cook === 'shell';
  const state = shell ? 'shell' : cook >= 0.5 ? 1 : 0;
  const key = `${kind}|${state}|${variant % 3}`;
  const shot = shots.get(key) || shots.get(`${kind}|1|${variant % 3}`);
  if (shot) return shot;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = SIZE * RES;
  const g = c.getContext('2d'); g.scale(RES, RES); g.translate(SIZE / 2, SIZE / 2);
  const paint = PAINT[kind];
  if (paint) paint(g, rng(variant * 31 + kind.length * 7), shell ? 0 : state, shell);
  cache.set(key, c);
  return c;
}

/** Draw an ingredient into `ctx` at (x, y), cross-fading raw → cooked. */
export function drawFood(ctx, kind, x, y, { rot = 0, cook = 1, s = 1, variant = 0, alpha = 1 } = {}) {
  // a rendered picture has its light baked in (top left) and its own shadow: turn it only a little
  if (shots.size) rot = Math.sin(rot) * 0.3;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const half = SIZE / 2;
  if (cook === 'shell' || cook <= 0 || cook >= 1 || !['pork', 'fish', 'egg'].includes(kind)) {
    ctx.globalAlpha = alpha; ctx.drawImage(foodSprite(kind, cook === 'shell' ? 'shell' : cook, variant), -half, -half, SIZE, SIZE);
  } else {
    ctx.globalAlpha = alpha; ctx.drawImage(foodSprite(kind, 0, variant), -half, -half, SIZE, SIZE);
    ctx.globalAlpha = alpha * cook; ctx.drawImage(foodSprite(kind, 1, variant), -half, -half, SIZE, SIZE);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the bowl
/**
 * The big porcelain bowl, top-down with real depth: a shadow on the counter,
 * a thick glazed rim with a qinghua-blue band, the inner wall falling away to
 * the broth, and the broth itself: amber, a golden skin of chicken fat beads,
 * ripples and a light that moves. fill 0..1.2, fat 0..1 (spread), t = time.
 */
export function drawBowl(ctx, x, y, R, { fill = 0, fat = 0, rimCol = '#3a6ea5', t = 0, heat = 1, mixed = false, waves = [] } = {}) {
  ctx.save(); ctx.translate(x, y);
  const shot = shots.get(`bowl|${GLAZE[rimCol] || 'blue'}`);
  if (shot) ctx.drawImage(shot, -R * 1.25, -R * 1.25, R * 2.5, R * 2.5);   // the rendered porcelain, 2.5 R wide
  const inner = R * 0.84;
  if (!shot) {
  // shadow on the counter
  let gr = ctx.createRadialGradient(12, 22, R * 0.7, 12, 22, R * 1.18);
  gr.addColorStop(0, 'rgba(80,45,30,0.38)'); gr.addColorStop(1, 'rgba(80,45,30,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(12, 22, R * 1.18, 0, P2); ctx.fill();
  // outer glaze
  gr = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.2, 0, 0, R);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#f6f1e8'); gr.addColorStop(1, '#d9d0c2');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, P2); ctx.fill();
  // the blue band and its little scroll
  ctx.lineWidth = R * 0.055; ctx.strokeStyle = rimCol; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, P2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = rimCol;
  for (let i = 0; i < 28; i++) { const a = i / 28 * P2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.955, Math.sin(a) * R * 0.955, R * 0.022, a, a + Math.PI); ctx.stroke(); }
  // the inner wall falling away (darker to the bottom right, lit at top left)
  gr = ctx.createRadialGradient(-inner * 0.25, -inner * 0.3, inner * 0.2, 0, 0, inner);
  gr.addColorStop(0, '#fbf8f2'); gr.addColorStop(0.75, '#ece5d8'); gr.addColorStop(1, '#bfb2a0');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, inner, 0, P2); ctx.fill();
  // the bottom of the bowl, deeper
  gr = ctx.createRadialGradient(0, 0, 0, 0, 0, inner * 0.55);
  gr.addColorStop(0, '#e6ddcf'); gr.addColorStop(1, 'rgba(230,221,207,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, inner * 0.55, 0, P2); ctx.fill();
  }
  // the broth: rises up the wall as it fills
  if (fill > 0) {
    const br = inner * (0.45 + Math.min(fill, 1.15) * 0.48);
    const clear = shots.get('broth|clear'), sealed = shots.get('broth|sealed');
    if (clear) {
      // the rendered broth, fixed in scale and clipped to the level it's reached;
      // the oil seal spreads out from the centre over it
      const S = inner * 1.12;
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, br, 0, P2); ctx.clip();
      ctx.drawImage(clear, -S, -S, S * 2, S * 2);
      if (fat > 0 && sealed) {
        const fr = br * Math.min(1, fat);
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, fr, 0, P2); ctx.clip();
        ctx.globalAlpha = Math.min(1, fat * 1.4); ctx.drawImage(sealed, -S + Math.sin(t * 0.3) * 2, -S + Math.cos(t * 0.25) * 2, S * 2, S * 2);
        ctx.restore();
      }
      if (mixed) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#7a4a24'; ctx.fillRect(-br, -br, br * 2, br * 2); }
      // the wall's shade falls on the broth at the far side, depth reads at the rim
      gr = ctx.createRadialGradient(br * 0.12, br * 0.14, br * 0.6, 0, 0, br);
      gr.addColorStop(0, 'rgba(90,50,10,0)'); gr.addColorStop(1, 'rgba(90,50,10,0.28)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(-br, -br, br * 2, br * 2);
      ctx.restore();
    } else {
    gr = ctx.createRadialGradient(-br * 0.3, -br * 0.35, br * 0.05, 0, 0, br);
    gr.addColorStop(0, mixed ? '#d8b98a' : '#ffe6a6'); gr.addColorStop(0.6, mixed ? '#b48e5e' : '#f3c46a'); gr.addColorStop(1, mixed ? '#8a6a44' : '#d99b3c');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, br, 0, P2); ctx.fill();
    }
    // meniscus: a bright ring where broth meets porcelain
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,245,215,0.75)'; ctx.beginPath(); ctx.arc(0, 0, br - 1.5, 0, P2); ctx.stroke();
    // ripples from drops and pours
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, br, 0, P2); ctx.clip();
    for (const w of waves) {
      const k = w.t / 0.9; if (k < 0 || k > 1) continue;
      ctx.lineWidth = 3 * (1 - k); ctx.strokeStyle = `rgba(255,248,225,${0.7 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, 6 + k * br * 0.8, 0, P2); ctx.stroke();
    }
    // the oil seal: spreads from the centre, then a skin of golden fat beads
    if (fat > 0 && !clear) {
      const fr = br * Math.min(1, fat);
      gr = ctx.createRadialGradient(0, 0, fr * 0.2, 0, 0, fr);
      gr.addColorStop(0, 'rgba(255,214,90,0.35)'); gr.addColorStop(1, 'rgba(255,200,70,0.22)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, fr, 0, P2); ctx.fill();
      const Rb = rng(5);
      for (let i = 0; i < 70; i++) {
        const a = Rb() * P2, d = Math.sqrt(Rb()) * fr * 0.95, r = 2 + Rb() * Rb() * 9;
        const bx = Math.cos(a) * d + Math.sin(t * 0.4 + i) * 1.5, by = Math.sin(a) * d + Math.cos(t * 0.35 + i) * 1.5;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, P2); ctx.fillStyle = 'rgba(255,204,64,0.55)'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(214,150,30,0.55)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.35, 0, P2); ctx.fillStyle = 'rgba(255,255,240,0.85)'; ctx.fill();
      }
    }
    // a moving window-light reflection on the surface
    const lx = -br * 0.35 + Math.sin(t * 0.7) * 6, ly = -br * 0.4 + Math.cos(t * 0.6) * 4;
    gloss(ctx, lx, ly, br * 0.32, br * 0.1, -0.6, fat > 0 ? 0.55 : 0.4);
    ctx.restore();
  }
  // rim highlight
  if (!shot) {
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, R - 3, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,90,70,0.35)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, P2); ctx.stroke();
  }
  ctx.restore();
}

/** A small porcelain saucer/dish that holds a pile of one ingredient (the prep trays). */
export function drawDish(ctx, x, y, w, h, kind, { t = 0, glow = 0, locked = false, shell = false, count = 5 } = {}) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2);
  const rx = w / 2, ry = h / 2;
  const shot = shots.get('dish');
  let gr;
  if (shot) ctx.drawImage(shot, -rx * 1.25, -ry * 1.25, rx * 2.5, ry * 2.5);
  else {
  gr = ctx.createRadialGradient(6, 12, ry * 0.4, 6, 12, rx * 1.05);
  gr.addColorStop(0, 'rgba(80,45,30,0.32)'); gr.addColorStop(1, 'rgba(80,45,30,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(6, 12, rx * 1.05, ry * 1.08, 0, 0, P2); ctx.fill();
  gr = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, 4, 0, 0, rx);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#f3eee5'); gr.addColorStop(1, '#cfc4b4');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, P2); ctx.fill();
  gr = ctx.createRadialGradient(rx * 0.15, ry * 0.2, 2, 0, 0, rx * 0.82);
  gr.addColorStop(0, '#f6f1e8'); gr.addColorStop(1, '#ddd2c2');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.82, ry * 0.78, 0, 0, P2); ctx.fill();
  }
  if (glow > 0) { ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,210,80,${glow})`; ctx.beginPath(); ctx.ellipse(0, 0, rx + 4, ry + 4, 0, 0, P2); ctx.stroke(); }
  // a little pile: pieces overlapping, the top one a touch bigger
  const pos = [[-0.32, 0.12], [0.3, 0.1], [0, -0.12], [-0.12, 0.22], [0.16, -0.2]].slice(0, count);
  pos.forEach(([px, py], i) => drawFood(ctx, kind, px * rx, py * ry * 1.1, { rot: (i * 1.9) % 6, cook: shell ? 'shell' : (kind === 'pork' || kind === 'fish' ? 0 : 1), s: Math.min(rx, ry * 1.4) / 62 * (i === pos.length - 1 ? 1.05 : 0.95), variant: i }));
  if (locked) { ctx.fillStyle = 'rgba(70,60,80,0.55)'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, P2); ctx.fill(); }
  if (!shot) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(0, 0, rx - 2, ry - 2, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke(); }
  ctx.restore();
}

/** Splash droplets: arcs of broth that fly up and fall back. Mutates the list. */
export function drawSplash(ctx, drops, dt) {
  for (const d of drops) {
    d.t += dt; d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    const k = Math.min(1, d.t / d.life);
    ctx.globalAlpha = 1 - k;
    const gr = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
    gr.addColorStop(0, '#fff6d8'); gr.addColorStop(1, d.col || '#f3c46a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1 - k * 0.4), 0, P2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return drops.filter(d => d.t < d.life);
}
export function splashAt(drops, x, y, n = 10, power = 1, col) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const v = (220 + Math.random() * 260) * power;
    drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 5, t: 0, life: 0.45 + Math.random() * 0.3, col });
  }
}
