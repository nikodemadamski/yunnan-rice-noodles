// The hand-drawn kit shared by every drawn scene (the noodle shop, Day 1's
// livestream, Little Chilli's bowl): Good Pizza, Great Pizza's flat look,
// soft maroon ink, hand lettering, paper grain, a cartoon glove, baby-schema
// people and top-down ingredients that cook (raw → done) on scalding broth.
// Call use(ctx) before drawing.

export const C = {
  ink: '#6b3a3a', inkSoft: 'rgba(107,58,58,0.55)', cream: '#fbf1e4', cream2: '#f4e2cf', paper: '#fff8ee',
  rose: '#ebbcb2', rose2: '#f6dcd3', steel: '#b3aebf', steelD: '#8c869c', steelL: '#d6d2df',
  wood: '#cf9a66', woodD: '#a8713f', woodL: '#e6bb8a', green: '#9fd36b', greenD: '#6a9f3e', red: '#d8473c',
  broth: '#f1c768', brothD: '#d9a744', blue: '#3a6ea5', gold: '#f2c14e',
};
export const FONT = '"Patrick Hand", "Nunito", system-ui, sans-serif';

export const LOOKS = {   // the cast sheet: big round hair, navy jeans, white sneakers
  gran: { skin: '#f3d6bd', shirt: '#6e3b6e', hair: '#d9d5cf', style: 'bun', glasses: true, skirt: true, pants: '#6e3b6e', brooch: true },
  chilli: { skin: '#f2cba7', shirt: '#d63c2f', hair: '#1a1a1a', style: 'pony' },
  wang: { skin: '#f0c8a0', shirt: '#ffd23f', hair: '#1a1a1a', style: 'short', wide: 1.3 },
  li: { skin: '#f0cfae', shirt: '#8a919c', hair: '#cfcac4', style: 'bowl', glasses: true },
  student: { skin: '#f4d6b8', shirt: '#3f6fc4', hair: '#3f271b', style: 'bowl', glasses: true },
  kid: { skin: '#f8dcc0', shirt: '#f08fb0', hair: '#3f271b', style: 'messybun', scale: 0.78 },
  auntie: { skin: '#f2d0ae', shirt: '#ff6fa8', hair: '#2a2a2a', style: 'bun' },
  lan: { skin: '#f4d6b8', shirt: '#3f6fc4', hair: '#3f271b', style: 'cap', cap: '#3f6fc4' },
};

import { charSprite, SPRITE } from './sprites.js';

// ------------------------------------------------------------ drawing kit
export let ctx;
export function use(c) { ctx = c; }
export const P2 = Math.PI * 2;
export function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
export function inked(fill, lw = 4) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke(); }
export function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, P2); }
export function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, P2); }
export function text(s, x, y, size, col = C.ink, align = 'center', weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
export function label(s, x, y, size = 30) {          // GPGP-style lettering: cream with a maroon outline
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
  ctx.fillStyle = '#fff6ea'; ctx.fillText(s, x, y);
}
export function wrap(s, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = s.split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
// seeded scatter so piles look the same every frame
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export let checker = null, grain = null;
/** Floor checker + paper grain; pass two floor colours for other moods (night). */
export function patterns(a1 = C.rose2, a2 = C.rose) {
  const a = document.createElement('canvas'); a.width = a.height = 160;
  const g = a.getContext('2d');
  g.fillStyle = a1; g.fillRect(0, 0, 160, 160);
  g.fillStyle = a2; g.fillRect(0, 0, 80, 80); g.fillRect(80, 80, 80, 80);
  checker = ctx.createPattern(a, 'repeat');
  const b = document.createElement('canvas'); b.width = b.height = 200;
  const h = b.getContext('2d'), img = h.createImageData(200, 200), R = rng(9);
  for (let i = 0; i < img.data.length; i += 4) { const v = 150 + R() * 105; img.data[i] = v; img.data[i + 1] = v * 0.95; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255; }
  h.putImageData(img, 0, 0);
  grain = ctx.createPattern(b, 'repeat');
}

// ------------------------------------------------------------ the glove (Good Pizza's hand)
export function hand(x, y, pinch = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
  ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.fillStyle = '#fffaf2';
  // pointing finger
  rr(-10, -78, 26, 74, 13); ctx.fill(); ctx.stroke();
  // palm + curled fingers
  ellipse(14, 12, 46, 40); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 3; i++) { ellipse(30 + i * 4, -14 + i * 18, 18, 13); ctx.fill(); ctx.stroke(); }
  ellipse(-16, 20, 16, 22, 0.4); ctx.fill(); ctx.stroke();       // thumb
  if (pinch) { ctx.fillStyle = 'rgba(107,58,58,0.15)'; circle(4, -76, 10); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------ people (drawn, baby-schema)
// A person in the drawn scenes: a sprite of the real 3D character (see
// sprites.js), and the body acts the mood: happy hops, sad slumps, angry
// stomps and shakes, shock jumps, thinking sways. Origin and size match the
// old drawn people (head ≈ y−40, feet ≈ y+190, ×s).
export function person(look, x, y, s, mood = 'normal', t = 0, blink = false) {
  s *= look.scale || 1;
  const img = charSprite(look, mood);
  const ph = (x * 0.013) % 6.28;                 // people don't all move in sync
  let dy = 0, sx = 1, sy = 1, rot = 0, dx = 0;
  if (mood === 'happy') { const k = Math.abs(Math.sin(t * 6 + ph)); dy = -k * 26; sy = 1 + (k < 0.15 ? -0.06 : 0.03); sx = 2 - sy; }   // a happy hop, squash on landing
  else if (mood === 'sad' || mood === 'cry') { sy = 0.95 + Math.sin(t * 1.5 + ph) * 0.01; dy = 8; }                                      // slumped, barely breathing
  else if (mood === 'angry') { const k = Math.sin(t * 9 + ph); dx = Math.sign(k) * Math.abs(k) ** 4 * 5; dy = Math.max(0, k) * -8; }   // stomp-stomp, a shake
  else if (mood === 'shock') { dy = -18 - Math.abs(Math.sin(t * 12)) * 6; sy = 1.04; }                                                    // jumped out of their skin
  else if (mood === 'think') { rot = Math.sin(t * 1.4 + ph) * 0.05; }
  else { sy = 1 + Math.sin(t * 2.2 + ph) * 0.012; }                                                                                         // idle breathing
  ctx.save();
  ctx.translate(x + dx * s, y + (190 + dy) * s);  // pivot at the feet
  ctx.rotate(rot); ctx.scale(s * sx, s * sy);
  ctx.drawImage(img, -SPRITE.w / 2, -SPRITE.h, SPRITE.w, SPRITE.h);
  ctx.restore();
}

// ------------------------------------------------------------ ingredients, top-down
export function piece(kind, x, y, rot = 0, cook = 1, s = 1, seed = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  const R = rng(seed * 97 + 13);
  const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = sh => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
  switch (kind) {
    case 'pork':      // paper-thin slices: pink when raw, pale when cooked
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * 0.5 - 0.5); rr(-30, -12 + i * 6, 60, 24, 10); inked(mix('#f39aa2', '#efe0d2', cook), 3); ctx.restore(); }
      break;
    case 'fish':      // black fish: translucent grey-white → opaque white
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * 0.6 - 0.6); rr(-28, -10 + i * 5, 56, 20, 9); inked(mix('#d9dde3', '#fbf8f2', cook), 3); ctx.beginPath(); ctx.moveTo(-24, 6 + i * 5); ctx.lineTo(24, 6 + i * 5); ctx.strokeStyle = '#9aa0aa'; ctx.stroke(); ctx.restore(); }
      break;
    case 'egg': {     // quail egg: speckled shell in the tray, cracked & cooking in the bowl
      if (cook < 0) { for (const [dx, dy] of [[-16, 0], [14, -8], [4, 14]]) { ellipse(dx, dy, 13, 17); inked('#f1e3c8', 3); ctx.fillStyle = '#6b4a32'; for (let k = 0; k < 4; k++) { circle(dx + (R() - 0.5) * 14, dy + (R() - 0.5) * 18, 2.2); ctx.fill(); } } }
      else { ellipse(0, 0, 26, 22); inked(mix('#fff8e0', '#ffffff', cook), 3); circle(2, 0, 10); inked(mix('#ffb52e', '#f7c24a', cook), 2); }
      break;
    }
    case 'ham':       // Xuanwei ham: deep red with a white rind
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * 0.7 - 0.7); rr(-24, -11, 48, 22, 6); inked('#b3343a', 3); rr(-24, 5, 48, 6, 3); ctx.fillStyle = '#fbefe4'; ctx.fill(); ctx.restore(); }
      break;
    case 'chrys':     // chrysanthemum petals
      for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * 0.52 + R()); ctx.translate(10 + R() * 14, 0); ellipse(0, 0, 11, 4); ctx.fillStyle = i % 3 ? '#ffd23f' : '#ffe680'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
      break;
    case 'pea':       // pea shoots: little leaves on curls
      for (let i = 0; i < 6; i++) { const a = i * 1.05; ellipse(Math.cos(a) * 18, Math.sin(a) * 14, 12, 7, a); inked(i % 2 ? '#8fd16a' : '#6fbf55', 2); }
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.bezierCurveTo(-5, -14, 5, 14, 22, 0); ctx.strokeStyle = '#4f8f3a'; ctx.lineWidth = 3; ctx.stroke();
      break;
    case 'chives':
      for (let i = 0; i < 9; i++) { ctx.save(); ctx.rotate(R() * 3); rr(-14, (R() - 0.5) * 30, 28, 5, 2); ctx.fillStyle = i % 2 ? '#5fae45' : '#7bc85a'; ctx.fill(); ctx.restore(); }
      break;
    case 'tofu':      // tofu skin sheets
      for (let i = 0; i < 2; i++) { ctx.save(); ctx.rotate(i * 0.8); rr(-28, -16, 56, 32, 6); inked('#f3dfa2', 3); ctx.beginPath(); ctx.moveTo(-20, -4); ctx.lineTo(20, 6); ctx.strokeStyle = '#d9bf7a'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      break;
    case 'jizong':    // wild mushroom: long pale stems, brown caps
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * 0.7 - 0.7); rr(-6, -4, 12, 40, 6); inked('#efe5d2', 3); ellipse(0, -8, 16, 10); inked('#8a6244', 3); ctx.restore(); }
      break;
    case 'chilli':    // red chilli oil: a spreading ring of droplets
      for (let i = 0; i < 10; i++) { const a = R() * P2, d = R() * 30; circle(Math.cos(a) * d, Math.sin(a) * d, 5 + R() * 7); ctx.fillStyle = 'rgba(214,52,30,0.75)'; ctx.fill(); }
      for (let i = 0; i < 5; i++) { circle((R() - 0.5) * 40, (R() - 0.5) * 40, 2.5); ctx.fillStyle = '#5a1a10'; ctx.fill(); }
      break;
    case 'noodles':   // fresh rice noodles: a soft white nest
      ctx.lineWidth = 4;
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse((R() - 0.5) * 16, (R() - 0.5) * 16, 30 + R() * 16, 20 + R() * 10, R() * 3, 0, P2); ctx.strokeStyle = i % 2 ? '#fffdf6' : '#efe6d4'; ctx.stroke(); }
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(107,58,58,0.35)'; ellipse(0, 0, 46, 34); ctx.stroke();
      break;
  }
  ctx.restore();
}

