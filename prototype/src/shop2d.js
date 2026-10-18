// Old Zhao's noodle shop, drawn by hand (after Good Pizza, Great Pizza and
// Papa's): a flat, top-down kitchen on a rose-and-cream checker floor, soft
// maroon ink, paper grain, a cartoon glove doing the work, a cream caption
// bar that talks to you, and customers who walk up to the counter and *say*
// what they want (Okay / What?).
//
// Three panels you slide between, any time (Papa's freedom):
//   ORDER  the shop, front-on: the counter, the queue, the tables
//   STOVE  top-down pot: drop rice noodles in two baskets, lift on the green
//   BUILD  top-down bowl: hold the broth pot to ladle, oil to seal, drag the
//          saucers in (raw slices visibly cook on the scalding broth), Serve
// The rules live in shopcore.js (unit-tested). Facts: docs/design/GUOQIAO_MIXIAN.md

import { G, esc } from './core.js';
import { sfx, note, setMusic } from './audio.js';
import { GUESTS, PARTS, NIGHT1, FILL, COOK_HEAT } from './shopdata.js';
import {
  createShop, takeOrder, startNoodles, liftNoodles, pour, addFat, addPart, resetBowl, serve, tick, dayOver, drainEvents, noodleRing,
} from './shopcore.js';
import { learn } from './lore.js';

const VW = 1600, VH = 900;
const C = {
  ink: '#6b3a3a', inkSoft: 'rgba(107,58,58,0.55)', cream: '#fbf1e4', cream2: '#f4e2cf', paper: '#fff8ee',
  rose: '#ebbcb2', rose2: '#f6dcd3', steel: '#b3aebf', steelD: '#8c869c', steelL: '#d6d2df',
  wood: '#cf9a66', woodD: '#a8713f', woodL: '#e6bb8a', green: '#9fd36b', greenD: '#6a9f3e', red: '#d8473c',
  broth: '#f1c768', brothD: '#d9a744', blue: '#3a6ea5', gold: '#f2c14e',
};
const FONT = '"Patrick Hand", "Nunito", system-ui, sans-serif';

const LOOKS = {
  li: { skin: '#f0cfae', shirt: '#7d8fa6', hair: '#eeeeee', style: 'bald', glasses: true },
  student: { skin: '#f4d6b8', shirt: '#4a7bd8', hair: '#3a2a20', style: 'spiky', glasses: true },
  kid: { skin: '#f8dcc0', shirt: '#ffb3c8', hair: '#3a2a20', style: 'pony', scale: 0.78 },
  auntie: { skin: '#f2d0ae', shirt: '#ff6fa8', hair: '#2a2a2a', style: 'bun' },
  lan: { skin: '#f4d6b8', shirt: '#4a7bd8', hair: '#1a1a1a', style: 'cap', cap: '#4a7bd8' },
};

// ------------------------------------------------------------ drawing kit
let ctx;
const P2 = Math.PI * 2;
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function inked(fill, lw = 4) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke(); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, P2); }
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, P2); }
function text(s, x, y, size, col = C.ink, align = 'center', weight = '') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function label(s, x, y, size = 30) {          // GPGP-style lettering: cream with a maroon outline
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y);
  ctx.fillStyle = '#fff6ea'; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = s.split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
// seeded scatter so piles look the same every frame
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let checker = null, grain = null;
function patterns() {
  const a = document.createElement('canvas'); a.width = a.height = 160;
  const g = a.getContext('2d');
  g.fillStyle = C.rose2; g.fillRect(0, 0, 160, 160);
  g.fillStyle = C.rose; g.fillRect(0, 0, 80, 80); g.fillRect(80, 80, 80, 80);
  checker = ctx.createPattern(a, 'repeat');
  const b = document.createElement('canvas'); b.width = b.height = 200;
  const h = b.getContext('2d'), img = h.createImageData(200, 200), R = rng(9);
  for (let i = 0; i < img.data.length; i += 4) { const v = 150 + R() * 105; img.data[i] = v; img.data[i + 1] = v * 0.95; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255; }
  h.putImageData(img, 0, 0);
  grain = ctx.createPattern(b, 'repeat');
}

// ------------------------------------------------------------ the glove (Good Pizza's hand)
function hand(x, y, pinch = false) {
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
function person(look, x, y, s, mood = 'normal', t = 0, blink = false) {
  s *= look.scale || 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // body
  rr(-78, 40, 156, 150, 60); inked(look.shirt, 5);
  for (const sx of [-1, 1]) { rr(sx * 70 - 22, 70, 44, 90, 22); inked(look.shirt, 5); }
  // head
  const hy = -40;
  circle(0, hy, 92); inked(look.skin, 5);
  // hair
  ctx.fillStyle = look.hair; ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
  if (look.style !== 'bald') {
    ctx.beginPath(); ctx.arc(0, hy, 94, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(40, hy - 40, 0, hy - 30); ctx.quadraticCurveTo(-40, hy - 46, -92, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    for (const sx of [-1, 1]) { ellipse(sx * 84, hy + 4, 18, 26); ctx.fill(); ctx.stroke(); }
  }
  if (look.style === 'bun') { circle(0, hy - 104, 34); ctx.fill(); ctx.stroke(); }
  if (look.style === 'pony') { ellipse(96, hy - 10, 26, 46, 0.5); ctx.fill(); ctx.stroke(); }
  if (look.style === 'spiky') for (const [dx, r] of [[-40, 26], [0, 30], [40, 26]]) { circle(dx, hy - 86, r); ctx.fill(); ctx.stroke(); }
  if (look.style === 'cap') {
    ctx.fillStyle = look.cap; ctx.beginPath(); ctx.arc(0, hy - 10, 96, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    rr(-10, hy - 22, 130, 24, 12); inked(look.cap, 5);
  }
  // face: wide-set big eyes, tiny mouth, blush (Glocker's baby schema)
  ctx.fillStyle = '#ffadb0'; ctx.globalAlpha = 0.6;
  ellipse(-52, hy + 30, 18, 11); ctx.fill(); ellipse(52, hy + 30, 18, 11); ctx.fill(); ctx.globalAlpha = 1;
  const ey = hy + 8;
  for (const sx of [-1, 1]) {
    if (blink || mood === 'happy') {
      ctx.beginPath(); ctx.arc(sx * 34, ey + 6, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 6; ctx.strokeStyle = '#3a2420'; ctx.stroke();
    } else {
      ellipse(sx * 34, ey, 13, 18); ctx.fillStyle = '#3a2420'; ctx.fill();
      circle(sx * 34 - 4, ey - 7, 5); ctx.fillStyle = '#fff'; ctx.fill();
    }
    if (mood === 'angry') { ctx.beginPath(); ctx.moveTo(sx * 18, ey - 26); ctx.lineTo(sx * 50, ey - 34); ctx.lineWidth = 6; ctx.strokeStyle = '#3a2420'; ctx.stroke(); }
  }
  if (look.glasses) { ctx.lineWidth = 4; ctx.strokeStyle = '#4a3a3a'; for (const sx of [-1, 1]) { circle(sx * 34, ey + 2, 24); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-10, ey); ctx.lineTo(10, ey); ctx.stroke(); }
  ctx.lineWidth = 5; ctx.strokeStyle = '#3a2420'; ctx.beginPath();
  if (mood === 'sad' || mood === 'angry') ctx.arc(0, hy + 52, 12, Math.PI * 1.15, Math.PI * 1.85);
  else if (mood === 'shock') { circle(0, hy + 44, 8); }
  else ctx.arc(0, hy + 36, 12, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------ ingredients, top-down
function piece(kind, x, y, rot = 0, cook = 1, s = 1, seed = 1) {
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

// ------------------------------------------------------------ layout (virtual 1600×900; panels side by side)
const PANEL = { order: 0, stove: 1, build: 2 };
const BUILD = 2 * VW, STOVE = VW;
const BOWL = { x: BUILD + 720, y: 612, r: 192 };
const POT = { x: BUILD + 205, y: 600, r: 130 };
const OIL = { x: BUILD + 205, y: 360, r: 62 };
const TRASH = { x: BUILD + 1450, y: 640, w: 120, h: 150 };
const SERVE = { x: BUILD + 1080, y: 705, w: 230, h: 84 };
const THERMO = { x: BUILD + 980, y: 430, h: 260 };
const ROWS = [['pork', 'fish', 'egg', 'ham', 'chrys', 'chilli'], ['pea', 'chives', 'tofu', 'jizong', 'noodles']];
const BIN = { w: 150, h: 112, gap: 18, x0: BUILD + 345, y0: 92 };
const binRect = p => { const r = ROWS.findIndex(row => row.includes(p)), i = ROWS[r].indexOf(p); return { x: BIN.x0 + i * (BIN.w + BIN.gap) + r * 40, y: BIN.y0 + r * (BIN.h + 52), w: BIN.w, h: BIN.h }; };
const STOVE_POT = { x: STOVE + 860, y: 520, r: 300 };
const BASKETS = [{ x: STOVE + 735, y: 520 }, { x: STOVE + 985, y: 520 }];
const COILS = { x: STOVE + 250, y: 520, w: 280, h: 300 };
const COUNTER_Y = 600;
const TABLES = [{ x: 330, y: 470 }, { x: 640, y: 462 }, { x: 960, y: 462 }, { x: 1270, y: 470 }];
const NAMES = { pork: 'Pork loin', fish: 'Black fish', egg: 'Quail egg', ham: 'Xuanwei ham', chrys: 'Chrysanthemum', chilli: 'Chilli oil', pea: 'Pea shoots', chives: 'Chives', tofu: 'Tofu skin', jizong: 'Jizong', noodles: 'Rice noodles' };
const inR = (q, r) => q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
const near = (q, c, r) => Math.hypot(q.x - c.x, q.y - c.y) <= r;

// what a guest *means*, when you ask "What?" (Good Pizza's second chance)
function hint(ask) {
  const bits = [];
  for (const [p, n] of Object.entries(ask.need || {})) bits.push(`${n > 1 ? `${n}× ` : ''}${NAMES[p].toLowerCase()}`);
  for (const p of ask.ban || []) bits.push(`no ${NAMES[p].toLowerCase()}`);
  if (ask.max) bits.push(`${ask.max} saucers at most`);
  if (ask.min) bits.push(`at least ${ask.min} saucers`);
  if (ask.hot) bits.push('scalding hot: seal it with oil');
  return `(…so: ${bits.join(', ')}.)`;
}

// ------------------------------------------------------------ the service
export async function shopService({ schedule = NIGHT1, title = 'Old Zhao’s · first night' } = {}) {
  G.busy++;
  G.skip = false;
  G.flags.frozen3d = true;
  setMusic('day');
  const cv = document.createElement('canvas');
  cv.className = 'shop2d';
  document.getElementById('ui').appendChild(cv);
  ctx = cv.getContext('2d');
  patterns();

  const S = createShop(schedule, { baskets: 2 });
  const st = {
    view: 'order', camX: 0, t: 0, selected: null, ptr: { x: 0, y: 0, down: false, vx: 0, vy: 0 }, drag: null, pouring: false,
    people: {}, pieces: {}, ripples: [], pops: [], caption: '', captionT: 0, bubble: null, money: 0, react: null, lifts: [],
  };
  let scale = 1, ox = 0, oy = 0;
  function resize() {
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    scale = Math.min(innerWidth / VW, innerHeight / VH);
    ox = (innerWidth - VW * scale) / 2; oy = (innerHeight - VH * scale) / 2;
  }
  resize(); addEventListener('resize', resize);
  const toV = (cx, cy) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });
  const toW = v => ({ x: v.x + st.camX, y: v.y });

  const sel = () => S.tickets.find(t => t.uid === st.selected && !t.served);
  const go = view => { if (st.view !== view) { st.view = view; sfx('whoosh'); } };
  const say = (s, sec = 3.5) => { st.caption = s; st.captionT = sec; };
  const pop = (s, x, y, col = C.ink) => st.pops.push({ s, x, y, col, t: 0 });

  // ---------- Grandma's rules card (the real ritual), first time only ----------
  if (!G.flags.rulesSeen) {
    G.flags.rulesSeen = true;
    await new Promise(res => {
      const el = document.createElement('div');
      el.className = 'k3-result svc-rules';
      el.innerHTML = `<div class="k-ticket svc-rules-card">
        <b>📜 Grandma’s rules · 过桥米线</b>
        <ol>
          <li><b>The broth.</b> Old hen and pork bones, four hours, never a drop of water added. Hold the pot to ladle it in, up to the gold line.</li>
          <li><b>The seal.</b> A spoon of chicken oil on top. No steam shows, but underneath it stays hotter than 95°C.</li>
          <li><b>Raw first.</b> Pork loin, black fish, quail egg, while it’s scalding. Watch them cook in seconds. In cold broth, they don’t.</li>
          <li><b>Then ham, flowers, greens.</b> And the <b>noodles last</b>. Always.</li>
        </ol>
        <p class="sub">Listen to the customers. Not sure what they mean? Ask “What?”.</p>
        <div class="row" style="justify-content:flex-end"><button class="btn-big" data-go>Open the hatch 🏮</button></div></div>`;
      document.getElementById('ui').appendChild(el);
      el.querySelector('[data-go]').addEventListener('click', () => { el.remove(); res(); });
    });
  }
  learn('feast');

  // ---------- guests ----------
  function spawn(g) {
    st.people[g.uid] = { uid: g.uid, who: g.who, look: LOOKS[g.who], x: 1700, y: 0, tx: 1700, mood: 'happy', blinkT: Math.random() * 3, table: null, leaving: false };
    sfx('beep');
  }
  function layout() {
    const line = S.guests.filter(g => g.state === 'line');
    // the counter is free unless someone's tasting their bowl there
    line.forEach((g, i) => { const p = st.people[g.uid]; p.tx = i === 0 && !st.react ? 560 : 1320 + (i - (st.react ? 0 : 1)) * 110; });
    const waiting = S.guests.filter(g => g.state === 'waiting');
    const taken = new Set(waiting.map(g => st.people[g.uid].table).filter(x => x !== null));
    for (const g of waiting) {
      const p = st.people[g.uid];
      if (p.table === null) { p.table = TABLES.findIndex((_, i) => !taken.has(i)); if (p.table < 0) p.table = 0; taken.add(p.table); }
      p.tx = TABLES[p.table].x;
    }
  }
  function counterGuest() { const g = S.guests.find(q => q.state === 'line'); return g && Math.abs(st.people[g.uid].x - 560) < 8 ? g : null; }
  function nextAsk(g) { const asks = GUESTS[g.who].asks; return asks[(S.visits[g.who] || 0) % asks.length]; }

  // ---------- interactions ----------
  function tabsAt(v) {
    const tabs = [['order', '🛎️ Order'], ['stove', '♨️ Stove'], ['build', '🍜 Build']];
    return tabs.map(([id, s], i) => ({ id, s, x: 560 + i * 170, y: 14, w: 160, h: 56 })).find(b => inR(v, b));
  }
  function ticketAt(v) {
    const open = S.tickets.filter(t => !t.served);
    return open.find((t, i) => inR(v, { x: 20 + i * 118, y: 96, w: 110, h: 120 }));
  }
  function down(v) {
    const w = toW(v);
    st.ptr.down = true; st.ptr.sx = v.x; st.ptr.sy = v.y; st.drag = null;
    const tab = tabsAt(v); if (tab) { go(tab.id); return; }
    const tk = ticketAt(v); if (tk) { st.selected = tk.uid; sfx('pop'); return; }
    if (st.view === 'order' && st.bubble) {
      if (inR(v, st.bubble.ok)) { accept(); return; }
      if (inR(v, st.bubble.what)) {
        if (st.bubble.what.used) { accept(); return; }
        st.bubble.what.used = true; st.bubble.lines = wrap(`${st.bubble.ask.say} ${hint(st.bubble.ask)}`, 520, 36); sfx('pop'); return;
      }
    }
    if (st.view === 'stove') {
      if (inR(w, COILS)) { st.drag = { kind: 'coil' }; sfx('pop'); return; }
      const bi = BASKETS.findIndex(b => near(w, b, 105));
      if (bi >= 0 && S.baskets[bi].ticket) { lift(bi); return; }
    }
    if (st.view === 'build') {
      const t = sel();
      const part = ROWS.flat().find(p => inR(w, binRect(p)));
      if (part) {
        if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; }
        if (part === 'noodles' && t.noodles === null) { say('The noodles for this bowl aren’t cooked yet. To the stove! ♨️'); sfx('bump'); return; }
        st.drag = { kind: 'part', part, seed: Math.floor(Math.random() * 999) }; sfx('pop'); return;
      }
      if (near(w, POT, POT.r)) { if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; } st.pouring = true; sfx('splash'); return; }
      if (near(w, OIL, OIL.r)) { oil(); return; }
      if (inR(w, TRASH)) { if (t && (t.fill || t.parts.length)) { resetBowl(S, t.uid); st.pieces[t.uid] = []; sfx('whack'); say('Tipped it out. Start again: broth first.'); } return; }
      if (inR(w, SERVE)) { doServe(); return; }
    }
  }
  function up(v) {
    st.ptr.down = false;
    const w = toW(v);
    if (st.pouring) {
      st.pouring = false;
      const t = sel();
      if (t) {
        learn('broth');
        if (t.fill >= FILL.lo && t.fill <= FILL.hi) { pop('Right on the line!', BOWL.x, BOWL.y - 250, C.greenD); sfx('ding'); }
        else if (t.fill > FILL.hi) { pop('Spilling over!', BOWL.x, BOWL.y - 250, C.red); sfx('bump'); }
        else pop('A little more…', BOWL.x, BOWL.y - 250);
      }
    }
    const d = st.drag; st.drag = null;
    if (!d) {
      // a swipe changes panel, like turning your head in the kitchen
      const dx = v.x - (st.ptr.sx ?? v.x);
      if (Math.abs(dx) > 160 && Math.abs(v.y - st.ptr.sy) < 120) { const order = ['order', 'stove', 'build']; const i = order.indexOf(st.view) + (dx < 0 ? 1 : -1); if (order[i]) go(order[i]); }
      return;
    }
    if (d.kind === 'coil') {
      const bi = BASKETS.findIndex(b => near(w, b, 120));
      if (bi < 0 || S.baskets[bi].ticket) { sfx('bump'); return; }
      const t = sel()?.noodles === null && !S.baskets.some(b => b.ticket === st.selected) ? sel()
        : S.tickets.find(q => !q.served && q.noodles === null && !S.baskets.some(b => b.ticket === q.uid));
      if (!t) { say('No ticket needs noodles right now. Take an order 🛎️'); sfx('bump'); return; }
      startNoodles(S, bi, t.uid); sfx('splash');
      for (let k = 0; k < 6; k++) st.ripples.push({ x: BASKETS[bi].x, y: BASKETS[bi].y, t: k * -0.08, col: '#ffffff' });
      return;
    }
    if (d.kind === 'part') {
      const t = sel();
      if (!t || !near(w, BOWL, BOWL.r - 10)) { sfx('bump'); return; }
      if (!t.fill && PARTS[d.part].rank === 0) say('Raw slices into an empty bowl? They need scalding broth to cook!');
      if (!addPart(S, t.uid, d.part)) { sfx('bump'); return; }
      const hot = t.fill > 0 && t.heat >= COOK_HEAT;
      (st.pieces[t.uid] ||= []).push({ p: d.part, x: w.x - BOWL.x, y: w.y - BOWL.y, rot: Math.random() * 6, born: st.t, hot, seed: d.seed });
      st.ripples.push({ x: w.x, y: w.y, t: 0, col: '#fff6d8' }, { x: w.x, y: w.y, t: -0.12, col: '#fff6d8' });
      sfx('splash'); note(520 + t.parts.length * 60, 0.12, 'sine', 0.1);
      if (PARTS[d.part].rank === 0) { learn('raw'); pop(hot ? 'Tssss… cooked in seconds' : '…it won’t cook. Too cold!', w.x, w.y - 70, hot ? C.greenD : C.red); }
      if (d.part === 'chrys') learn('chrys');
    }
  }
  function oil() {
    const t = sel();
    if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; }
    if (!t.broth) { say('Broth first, then the oil on top.'); sfx('bump'); return; }
    if (!addFat(S, t.uid)) return;
    sfx('sizzle'); note(880, 0.2, 'sine', 0.08);
    pop('✨ Sealed: a coin-thick layer of oil', BOWL.x, BOWL.y - 250, C.woodD);
    learn('seal');
  }
  function lift(i) {
    const score = liftNoodles(S, i);
    sfx('splash');
    st.lifts.push({ x: BASKETS[i].x, y: BASKETS[i].y, t: 0 });
    pop(score >= 0.95 ? 'Perfect!' : score >= 0.7 ? 'Good' : score < 0.6 ? 'Too firm…' : 'A bit soft', BASKETS[i].x, BASKETS[i].y - 150, score >= 0.95 ? C.greenD : C.ink);
  }
  function accept() {
    const g = counterGuest(); if (!g) return;
    const t = takeOrder(S, g.uid);
    st.selected = t.uid;
    st.bubble = null;
    sfx('ding');
    if (/Zhuangyuan|Xiucai|Juren/.test(t.ask.say)) learn('tiers');
    layout();
    say(`Ticket ${t.uid}: “${t.ask.say}”`, 4);
  }
  function doServe() {
    const t = sel();
    if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; }
    const res = serve(S, t.uid);
    if (!res) { say('Broth and at least one saucer first!'); sfx('bump'); return; }
    const p = st.people[t.guest];
    const bad = res.judge.notes.find(n => !n.ok), good = res.judge.notes.filter(n => n.ok);
    if (res.judge.notes.some(n => n.ok && /in order/.test(n.text))) learn('order');
    p.mood = res.points >= 80 ? 'happy' : res.points >= 60 ? 'normal' : 'sad';
    st.react = { uid: t.guest, t: 0, res, line: bad ? bad.text : good.length ? `Mm! ${good.slice(0, 2).map(n => n.text).join(' · ')}` : 'Mm!' };
    p.tx = 560; p.react = true;
    layout();
    go('order');
    sfx(res.points >= 80 ? 'reveal' : res.points >= 60 ? 'ding' : 'fail');
    st.selected = S.tickets.find(q => !q.served)?.uid || null;
  }

  // test hook: state, plus virtual → client coordinates
  window.__shop2d = { S, st, go, toClient: (x, y) => ({ x: ox + (x - st.camX) * scale, y: oy + y * scale }) };

  // pointer plumbing
  const pd = e => { if (e.target !== cv) return; const v = toV(e.clientX, e.clientY); st.ptr.vx = v.x; st.ptr.vy = v.y; st.ptr.show = true; down(v); };
  const pm = e => { const v = toV(e.clientX, e.clientY); st.ptr.vx = v.x; st.ptr.vy = v.y; st.ptr.show = true; };
  const pu = e => { const v = toV(e.clientX, e.clientY); st.ptr.vx = v.x; st.ptr.vy = v.y; up(v); };
  cv.addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu);

  // ------------------------------------------------------------ drawing the panels
  function drawOrder(t) {
    // back wall, wainscot, lattice window onto the street at dusk
    ctx.fillStyle = '#f6e4cc'; ctx.fillRect(0, 0, VW, 470);
    ctx.fillStyle = C.wood; ctx.fillRect(0, 430, VW, 60); ctx.fillStyle = C.woodD; ctx.fillRect(0, 486, VW, 6);
    ctx.fillStyle = checker; ctx.fillRect(0, 490, VW, 420);
    // window
    rr(980, 70, 470, 300, 12); const sky = ctx.createLinearGradient(0, 70, 0, 370); sky.addColorStop(0, '#7d6bb0'); sky.addColorStop(1, '#f2a679');
    ctx.fillStyle = sky; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.woodD; ctx.stroke();
    ctx.strokeStyle = C.woodD; ctx.lineWidth = 6;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(980 + i * 117, 70); ctx.lineTo(980 + i * 117, 370); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(980, 220); ctx.lineTo(1450, 220); ctx.stroke();
    for (let i = 0; i < 6; i++) { circle(1010 + i * 82, 120 + Math.sin(t + i) * 3, 13); ctx.fillStyle = '#ff6a4a'; ctx.fill(); }   // lanterns outside
    // menu board
    rr(110, 70, 380, 270, 14); inked('#2f4f3f', 6);
    text('过桥米线', 300, 118, 46, '#fff6ea');
    text('Crossing-the-Bridge Noodles', 300, 160, 24, '#e7dcc2');
    [['秀才 Xiucai', '¥16'], ['举人 Juren', '¥22'], ['状元 Zhuangyuan', '¥38']].forEach(([a, b], i) => { text(a, 140, 205 + i * 42, 30, '#fff6ea', 'left'); text(b, 460, 205 + i * 42, 30, '#ffd23f', 'right'); });
    // hanging lanterns inside
    for (const [x, ph] of [[620, 0], [800, 1.3]]) {
      const sw = Math.sin(t * 1.2 + ph) * 0.06;
      ctx.save(); ctx.translate(x, 0); ctx.rotate(sw);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 70); ctx.stroke();
      ellipse(0, 112, 40, 46); inked('#e0473b', 4); rr(-22, 62, 44, 12, 4); inked(C.gold, 3); rr(-22, 150, 44, 12, 4); inked(C.gold, 3);
      ctx.restore();
    }
    // tables (customers who are waiting sit here)
    for (const tb of TABLES) { ellipse(tb.x, tb.y + 40, 95, 26); inked('#e9c79b', 4); }
    for (const p of Object.values(st.people)) {
      if (p.table === null || p.react || p.leaving || Math.abs(p.x - TABLES[p.table].x) > 10) continue;
      person(p.look, p.x, TABLES[p.table].y - 22, 0.42, p.mood, t, p.blink);   // seated: the table hides their lap
      ellipse(TABLES[p.table].x, TABLES[p.table].y + 40, 95, 26); inked('#e9c79b', 4);
      const g = S.guests.find(q => q.uid === p.uid), tk = S.tickets.find(q => q.guest === p.uid);
      if (g && tk) { rr(p.x - 34, 360, 68, 40, 10); inked(C.paper, 3); text(tk.uid, p.x, 381, 26); const pat = g.patience / g.maxPatience; rr(p.x - 34, 406, 68, 8, 4); ctx.fillStyle = '#eadccb'; ctx.fill(); rr(p.x - 34, 406, 68 * pat, 8, 4); ctx.fillStyle = pat > 0.5 ? C.green : pat > 0.25 ? C.gold : C.red; ctx.fill(); }
    }
    // the queue by the door, and whoever's at the counter (or walking)
    for (const p of Object.values(st.people)) {
      if (p.table !== null && !p.react && !p.leaving && Math.abs(p.x - TABLES[p.table].x) <= 10) continue;
      const atCounter = Math.abs(p.x - 560) < 120;
      const s = atCounter ? 1.4 : 0.75, y = atCounter ? 420 : 470;     // the counter cuts them at the waist
      person(p.look, p.x, y + Math.sin(t * 6 + p.x) * (Math.abs(p.x - p.tx) > 4 ? 6 : 1.5), s, p.mood, t, p.blink);
    }
    // the counter
    rr(-20, COUNTER_Y, VW + 40, 60, 0); inked(C.woodL, 5);
    ctx.fillStyle = C.wood; ctx.fillRect(0, COUNTER_Y + 60, VW, 300);
    ctx.strokeStyle = C.woodD; ctx.lineWidth = 3; for (let x = 60; x < VW; x += 160) { ctx.beginPath(); ctx.moveTo(x, COUNTER_Y + 60); ctx.lineTo(x, VH); ctx.stroke(); }
    // teapot, a little plant and the tip jar on the counter
    ellipse(1260, COUNTER_Y + 2, 60, 46); inked('#7fb5a8', 4); rr(1300, COUNTER_Y - 34, 40, 12, 6); inked('#7fb5a8', 3);
    rr(1420, COUNTER_Y - 70, 70, 80, 14); inked('rgba(220,240,255,0.6)', 4); text(`¥${st.money}`, 1455, COUNTER_Y - 30, 26, C.woodD);
    rr(170, COUNTER_Y - 50, 70, 56, 10); inked('#e09a6b', 4); for (let i = 0; i < 5; i++) { ellipse(190 + i * 8, COUNTER_Y - 70, 9, 22, (i - 2) * 0.3); inked(C.green, 2); }
    // speech bubble with Okay / What?
    const g = counterGuest();
    if (g && !st.react && !st.bubble) { const ask = nextAsk(g); st.bubble = { uid: g.uid, ask, lines: wrap(ask.say, 520, 36), ok: { x: 860, y: 400, w: 170, h: 70 }, what: { x: 1060, y: 400, w: 170, h: 70 } }; sfx('pop'); }
    if (st.bubble && (!g || g.uid !== st.bubble.uid)) st.bubble = null;
    if (st.bubble) {
      const b = st.bubble, h = 40 + b.lines.length * 44;
      rr(800, 120, 600, h, 26); inked(C.paper, 5);
      ctx.beginPath(); ctx.moveTo(820, 120 + h - 30); ctx.lineTo(730, 250); ctx.lineTo(850, 120 + h - 10); ctx.fillStyle = C.paper; ctx.fill(); ctx.stroke();
      b.lines.forEach((l, i) => text(l, 830, 162 + i * 44, 36, C.ink, 'left'));
      b.ok.y = b.what.y = 120 + h + 24;
      for (const [btn, s, k] of [[b.ok, 'Okay', 'A'], [b.what, b.what.used ? 'Got it' : 'What?', 'B']]) {
        rr(btn.x, btn.y, btn.w, btn.h, 30); inked('#fff3e2', 5); text(s, btn.x + btn.w / 2 - 10, btn.y + btn.h / 2, 36);
        circle(btn.x + btn.w - 18, btn.y + btn.h - 10, 15); inked(C.rose, 3); text(k, btn.x + btn.w - 18, btn.y + btn.h - 10, 20);
      }
    }
    // a served guest tastes it, right here at the counter
    if (st.react) {
      const r = st.react, p = st.people[r.uid];
      if (Math.abs(p.x - 560) < 10) {
        r.t += 1 / 60;
        const lines = wrap(r.line, 520, 36), h = 40 + lines.length * 44;
        rr(800, 120, 600, h + 60, 26); inked(C.paper, 5);
        lines.forEach((l, i) => text(l, 830, 162 + i * 44, 36, C.ink, 'left'));
        const pts = r.res.points;
        text(`${pts >= 90 ? '😍' : pts >= 80 ? '😋' : pts >= 60 ? '🙂' : '😕'}  ${pts}%   +¥${r.res.tip}`, 830, 130 + h + 20, 36, pts >= 80 ? C.greenD : C.ink, 'left');
      }
    }
  }

  function drawStove(t) {
    const X = STOVE;
    ctx.fillStyle = checker; ctx.fillRect(X, 0, VW, VH);
    // stovetop slab
    rr(X + 80, 150, 1440, 680, 30); inked(C.cream, 6);
    rr(X + 520, 190, 680, 620, 40); inked('#5a5466', 6);
    // big pot of boiling water
    circle(STOVE_POT.x, STOVE_POT.y, STOVE_POT.r); inked(C.steelL, 8);
    circle(STOVE_POT.x, STOVE_POT.y, STOVE_POT.r - 26); inked('#cfe8f0', 5);
    const R = rng(3);
    for (let i = 0; i < 26; i++) { const a = R() * P2, d = R() * 240, k = (t * (0.6 + R()) + R()) % 1; circle(STOVE_POT.x + Math.cos(a) * d, STOVE_POT.y + Math.sin(a) * d * 0.9, 4 + k * 10); ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.stroke(); }
    // two baskets with a segmented timer each (Papa's ring, Good Pizza's oven bar)
    BASKETS.forEach((b, i) => {
      const bk = S.baskets[i];
      circle(b.x, b.y, 100); inked('rgba(160,155,175,0.35)', 5);
      ctx.strokeStyle = 'rgba(107,58,58,0.25)'; ctx.lineWidth = 2;
      for (let k = -90; k <= 90; k += 18) { ctx.beginPath(); ctx.moveTo(b.x + k, b.y - Math.sqrt(Math.max(0, 9000 - k * k))); ctx.lineTo(b.x + k, b.y + Math.sqrt(Math.max(0, 9000 - k * k))); ctx.stroke(); }
      rr(b.x - 10, b.y - 230, 20, 130, 10); inked(C.woodD, 4);      // handle
      if (bk.ticket) {
        piece('noodles', b.x, b.y, t * 0.3, 1, 1.6, i + 7);
        const r = noodleRing(bk.t), segs = 10;
        rr(b.x - 120, b.y + 130, 240, 44, 12); inked('#e8e4ee', 4);
        for (let k = 0; k < segs; k++) {
          const f = (k + 1) / segs, on = r.v >= f - 0.0001;
          const col = f <= r.lo ? '#7fb8f0' : f <= r.hi + 0.05 ? C.green : '#f08a7a';
          rr(b.x - 112 + k * 23, b.y + 138, 19, 28, 5); ctx.fillStyle = on ? col : '#fbf7ff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.inkSoft; ctx.stroke();
        }
        label(bk.ticket, b.x, b.y - 128, 34);
        if (r.zone === 'ready') { label('LIFT!', b.x, b.y + 210, 40 + Math.sin(t * 10) * 3); }
      } else label('empty', b.x, b.y + 150, 28);
    });
    // fresh rice noodle coils
    rr(COILS.x, COILS.y - COILS.h / 2, COILS.w, COILS.h, 18); inked(C.steelL, 6);
    rr(COILS.x + 16, COILS.y - COILS.h / 2 + 16, COILS.w - 32, COILS.h - 32, 12); inked('#8f8aa0', 4);
    for (let i = 0; i < 6; i++) piece('noodles', COILS.x + 80 + (i % 2) * 120, COILS.y - 90 + Math.floor(i / 2) * 90, i, 1, 0.95, i + 2);
    label('Fresh rice noodles', COILS.x + COILS.w / 2, COILS.y + COILS.h / 2 + 40, 34);
    // noodles flying out of a basket
    for (const l of st.lifts) { l.t += 1 / 60; piece('noodles', l.x + l.t * 500, l.y - Math.sin(l.t * 3) * 260, l.t * 4, 1, 1.4 - l.t * 0.4, 3); }
    st.lifts = st.lifts.filter(l => l.t < 1);
  }

  function drawBuild(t) {
    const X = BUILD, tk = sel();
    ctx.fillStyle = checker; ctx.fillRect(X, 0, VW, VH);
    rr(X + 300, 60, 1120, 820, 28); inked(C.cream, 6);           // the counter
    // saucer trays (Good Pizza's bins), two rows in crossing order
    for (const p of ROWS.flat()) {
      const r = binRect(p);
      rr(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 12); inked(C.steelL, 4);
      rr(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 8); inked('#fbf6ef', 3);
      const locked = p === 'noodles' && (!tk || tk.noodles === null);
      for (let k = 0; k < 6; k++) piece(p, r.x + 34 + (k % 3) * 41, r.y + 32 + Math.floor(k / 3) * 46, k * 1.7, p === 'egg' ? -1 : 0.0, 0.66, k + p.length);
      if (locked) { rr(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 8); ctx.fillStyle = 'rgba(90,80,100,0.55)'; ctx.fill(); text('♨️ cooking', r.x + r.w / 2, r.y + r.h / 2, 28, '#fff6ea'); }
      label(NAMES[p], r.x + r.w / 2, r.y + r.h + 22, 26);
    }
    // broth pot (hold to ladle) and the chicken-oil jar
    circle(POT.x, POT.y, POT.r); inked(C.steelL, 7); circle(POT.x, POT.y, POT.r - 22); inked(C.broth, 4);
    ctx.fillStyle = 'rgba(255,240,200,0.6)'; ellipse(POT.x - 30, POT.y - 30, 40, 14, -0.5); ctx.fill();
    label('Old hen broth', POT.x, POT.y + POT.r + 34, 30);
    circle(OIL.x, OIL.y, OIL.r); inked('#fff2c2', 5); circle(OIL.x, OIL.y, OIL.r - 16); inked('#ffd76a', 3);
    rr(OIL.x + 10, OIL.y - 90, 14, 80, 7); inked(C.steel, 3);
    label('Chicken oil', OIL.x, OIL.y + OIL.r + 30, 28);
    // trash
    rr(TRASH.x, TRASH.y, TRASH.w, TRASH.h, 16); inked('#8f8aa0', 5); rr(TRASH.x + 14, TRASH.y + 14, TRASH.w - 28, 40, 10); inked('#6d6880', 3);
    text('🗑️', TRASH.x + TRASH.w / 2, TRASH.y + 100, 44);
    // the bowl, top-down: porcelain, blue rim, gold fill line
    circle(BOWL.x + 10, BOWL.y + 14, BOWL.r + 12); ctx.fillStyle = 'rgba(107,58,58,0.15)'; ctx.fill();
    circle(BOWL.x, BOWL.y, BOWL.r); inked('#fbf7f0', 6);
    circle(BOWL.x, BOWL.y, BOWL.r - 14); ctx.lineWidth = 10; ctx.strokeStyle = C.blue; ctx.stroke();
    circle(BOWL.x, BOWL.y, 70); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(107,58,58,0.2)'; ctx.stroke();
    const rad = f => 70 + Math.min(f, 1.15) * 120;
    if (tk && tk.fill > 0) {
      const r = rad(tk.fill);
      const g = ctx.createRadialGradient(BOWL.x - 40, BOWL.y - 40, 10, BOWL.x, BOWL.y, r);
      g.addColorStop(0, '#fbe3a2'); g.addColorStop(1, tk.mixed ? '#b08a5a' : C.broth);
      circle(BOWL.x, BOWL.y, r); ctx.fillStyle = g; ctx.fill();
      if (tk.fill > FILL.hi + 0.08) { circle(BOWL.x, BOWL.y, BOWL.r + 30); ctx.fillStyle = 'rgba(241,199,104,0.35)'; ctx.fill(); }
      if (tk.fat) {                                        // the oil seal: glossy, glinting, no steam
        circle(BOWL.x, BOWL.y, r - 4); ctx.fillStyle = 'rgba(255,214,90,0.35)'; ctx.fill();
        for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 0.2; circle(BOWL.x + Math.cos(a) * r * 0.6, BOWL.y + Math.sin(a) * r * 0.5, 5 + Math.sin(t * 3 + i) * 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); }
      }
    }
    // the fill line
    ctx.setLineDash([14, 10]); ctx.lineWidth = 5; ctx.strokeStyle = C.gold;
    circle(BOWL.x, BOWL.y, rad((FILL.lo + FILL.hi) / 2)); ctx.stroke(); ctx.setLineDash([]);
    // what's crossed the bridge so far
    if (tk) for (const pc of st.pieces[tk.uid] || []) {
      const age = st.t - pc.born, drop = Math.min(1, age * 5);
      const cook = PARTS[pc.p].rank === 0 ? (pc.hot ? Math.min(1, age / 1.6) : 0) : 1;
      piece(pc.p, BOWL.x + pc.x, BOWL.y + pc.y - (1 - drop) * 60, pc.rot, cook, (pc.p === 'noodles' ? 1.7 : 1.25) + (1 - drop) * 0.3, pc.seed);
    }
    // steam only escapes when there's no oil seal
    if (tk && tk.fill > 0 && !tk.fat && tk.heat > 0.2) for (let i = 0; i < 4; i++) {
      const k = (t * 0.5 + i / 4) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * tk.heat})`; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); const sx = BOWL.x - 90 + i * 60; ctx.moveTo(sx, BOWL.y - 40 - k * 200); ctx.quadraticCurveTo(sx + 20, BOWL.y - 80 - k * 200, sx, BOWL.y - 120 - k * 200); ctx.stroke();
    }
    // thermometer: how hot it still is
    rr(THERMO.x, THERMO.y, 40, THERMO.h, 20); inked('#fbf7ff', 4);
    const heat = tk && tk.fill > 0 ? tk.heat : 0;
    rr(THERMO.x + 8, THERMO.y + 8 + (THERMO.h - 16) * (1 - heat), 24, (THERMO.h - 16) * heat, 12);
    ctx.fillStyle = heat > COOK_HEAT ? '#f0703a' : '#7fb8f0'; ctx.fill();
    circle(THERMO.x + 20, THERMO.y + THERMO.h + 18, 26); inked(heat > COOK_HEAT ? '#f0703a' : '#7fb8f0', 4);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; const cy = THERMO.y + 8 + (THERMO.h - 16) * (1 - COOK_HEAT); ctx.beginPath(); ctx.moveTo(THERMO.x - 12, cy); ctx.lineTo(THERMO.x + 52, cy); ctx.stroke(); ctx.setLineDash([]);
    label('hot', THERMO.x + 20, THERMO.y - 24, 26);
    // the ladle pouring
    if (st.pouring && tk) {
      const lx = BOWL.x - 150, ly = BOWL.y - 190;
      ctx.strokeStyle = C.broth; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx + 30, ly + 30); ctx.quadraticCurveTo(BOWL.x - 60, BOWL.y - 120, BOWL.x - 30, BOWL.y - 20); ctx.stroke();
      ellipse(lx, ly, 56, 40, 0.6); inked(C.steelL, 5); rr(lx - 220, ly - 70, 200, 18, 9); inked(C.woodD, 4);
    }
    // serve button (Good Pizza's green button)
    rr(SERVE.x, SERVE.y, SERVE.w, SERVE.h, 20); inked('#c9e98a', 6);
    rr(SERVE.x + 10, SERVE.y + 8, SERVE.w - 20, SERVE.h - 22, 14); ctx.fillStyle = '#b4dd6f'; ctx.fill();
    text('Serve ▶▶', SERVE.x + SERVE.w / 2, SERVE.y + SERVE.h / 2 - 2, 44, C.ink);
  }

  // ---------- overlays: tabs, tickets, chips, caption bar ----------
  function drawHud(t) {
    // view tabs
    for (const [i, [id, s]] of [['order', '🛎️ Order'], ['stove', '♨️ Stove'], ['build', '🍜 Build']].entries()) {
      const x = 560 + i * 170, on = st.view === id;
      rr(x, 14, 160, 56, 16); inked(on ? '#ffd98a' : C.paper, 5); text(s, x + 80, 43, 32);
      const n = id === 'order' ? S.guests.filter(g => g.state === 'line').length : id === 'stove' ? S.baskets.filter(b => b.ticket && noodleRing(b.t).zone !== 'firm').length : S.tickets.filter(q => !q.served && q.noodles !== null).length;
      if (n) { circle(x + 152, 18, 18); inked(id === 'build' ? '#7fb8f0' : C.red, 3); text(String(n), x + 152, 19, 24, '#fff'); }
    }
    // chips: night, happiness, money (Good Pizza's top bar)
    const minutes = 19 * 60 + 30 + Math.floor(S.time * 1.5);
    const avg = S.results.length ? Math.round(S.results.reduce((a, r) => a + r.points, 0) / S.results.length) : 100;
    [[`🌙 ${Math.floor(minutes / 60) - 12}:${String(minutes % 60).padStart(2, '0')}PM`, 20], [`${avg >= 80 ? '😊' : avg >= 60 ? '🙂' : '😟'} ${avg}%`, 220]].forEach(([s, x]) => { rr(x, 14, 180, 56, 10); inked('#8a3b3b', 4); rr(x + 8, 22, 164, 40, 6); ctx.fillStyle = C.paper; ctx.fill(); text(s, x + 90, 43, 30); });
    rr(1360, 14, 220, 56, 10); inked('#8a3b3b', 4); rr(1368, 22, 204, 40, 6); ctx.fillStyle = C.paper; ctx.fill(); text(`💴 ¥${st.money}`, 1470, 43, 32);
    // ticket receipts
    S.tickets.filter(q => !q.served).forEach((q, i) => {
      const x = 20 + i * 118, y = 96, on = q.uid === st.selected;
      ctx.save(); ctx.translate(x + 55, y + 60); ctx.rotate((i % 2 ? 1 : -1) * 0.03 + (on ? 0 : 0)); ctx.translate(-55, -60 + (on ? 6 : 0));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(110, 0); ctx.lineTo(110, 110); for (let k = 0; k <= 5; k++) ctx.lineTo(110 - k * 22, 110 + (k % 2 ? 8 : 0)); ctx.closePath();
      inked(on ? '#fff3c6' : C.paper, on ? 5 : 3);
      const g = S.guests.find(z => z.uid === q.guest);
      text(q.uid, 55, 24, 28);
      ctx.save(); ctx.translate(55, 66); ctx.scale(0.22, 0.22); person(LOOKS[g.who], 0, 30, 1, st.people[g.uid].mood, t); ctx.restore();
      const pat = g.patience / g.maxPatience;
      rr(10, 100, 90, 7, 3); ctx.fillStyle = '#eadccb'; ctx.fill(); rr(10, 100, 90 * pat, 7, 3); ctx.fillStyle = pat > 0.5 ? C.green : pat > 0.25 ? C.gold : C.red; ctx.fill();
      if (q.noodles !== null) text('🍜', 92, 22, 22);
      ctx.restore();
    });
    // caption bar: Good Pizza's cream strip that talks to you
    const tk = sel();
    let cap = st.captionT > 0 ? st.caption : '';
    if (!cap) {
      if (st.view === 'order') cap = st.bubble ? 'Listen to what they want. Not sure? Ask “What?”.' : S.guests.some(g => g.state === 'line') ? 'Next customer’s coming to the counter…' : 'Bowls to make! Off to the stove and the counter ♨️';
      if (st.view === 'stove') cap = S.baskets.some(b => b.ticket && noodleRing(b.t).zone === 'ready') ? 'Green! Tap the basket to lift the noodles.' : 'Drag fresh noodles into an empty basket. Lift on the green.';
      if (st.view === 'build') cap = !tk ? '👆 Pick a ticket at the top left.' : `${tk.uid} · “${tk.ask.say}”`;
    }
    ctx.fillStyle = 'rgba(255,248,236,0.96)'; ctx.fillRect(0, VH - 92, VW, 92);
    ctx.fillStyle = C.ink; ctx.fillRect(0, VH - 92, VW, 3);
    const lines = wrap(cap, 1400, 34).slice(0, 2);
    lines.forEach((l, i) => text(l, VW / 2, VH - 46 + (i - (lines.length - 1) / 2) * 36, 34));
  }

  // ------------------------------------------------------------ the loop
  let last = performance.now(), done = false;
  await new Promise(resolve => {
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      st.t += dt;
      tick(S, dt);
      for (const e of drainEvents(S)) if (e.type === 'arrive') { spawn(S.guests.find(g => g.uid === e.guest)); layout(); }
      if (st.pouring && sel()) pour(S, st.selected, 'hen', dt * 0.42);
      // people walk to their spots, blink, get cross
      for (const p of Object.values(st.people)) {
        const dx = p.tx - p.x; p.x += Math.sign(dx) * Math.min(Math.abs(dx), 520 * dt);
        p.blinkT -= dt; p.blink = p.blinkT < 0.12; if (p.blinkT < 0) p.blinkT = 2 + Math.random() * 3;
        const g = S.guests.find(q => q.uid === p.uid);
        if (g && g.state !== 'served' && !p.react) p.mood = g.patience / g.maxPatience < 0.25 ? 'angry' : 'happy';
      }
      if (st.react) {
        const p = st.people[st.react.uid];
        if (st.react.t > 3.2) { st.money += st.react.res.tip; sfx('coin'); p.react = false; p.leaving = true; p.tx = 1800; st.react = null; layout(); }
      }
      for (const [uid, p] of Object.entries(st.people)) if (p.leaving && p.x >= 1790) delete st.people[uid];
      if (!st.selected) st.selected = S.tickets.find(q => !q.served)?.uid || null;
      st.captionT -= dt;
      st.camX += (PANEL[st.view] * VW - st.camX) * Math.min(1, dt * 9);

      // draw
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(0, 0, cv.width, cv.height);
      const d = cv.width / innerWidth;
      ctx.setTransform(scale * d, 0, 0, scale * d, ox * d, oy * d);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
      ctx.save(); ctx.translate(-st.camX, 0);
      if (st.camX < VW) drawOrder(st.t);
      if (st.camX > 0 && st.camX < 2 * VW) drawStove(st.t);
      if (st.camX > VW) drawBuild(st.t);
      for (const r of st.ripples) { r.t += dt; if (r.t > 0) { circle(r.x, r.y, 10 + r.t * 140); ctx.strokeStyle = r.col; ctx.globalAlpha = Math.max(0, 1 - r.t * 1.6); ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1; } }
      st.ripples = st.ripples.filter(r => r.t < 0.7);
      for (const q of st.pops) { q.t += dt; ctx.globalAlpha = Math.max(0, 1 - q.t / 1.6); label(q.s, q.x, q.y - q.t * 50, 38); ctx.globalAlpha = 1; }
      st.pops = st.pops.filter(q => q.t < 1.6);
      // the dragged saucer, in the glove
      const w = toW({ x: st.ptr.vx, y: st.ptr.vy });
      if (st.drag?.kind === 'part') piece(st.drag.part, w.x, w.y - 30, 0, st.drag.part === 'egg' ? -1 : 0, 1.1, st.drag.seed);
      if (st.drag?.kind === 'coil') piece('noodles', w.x, w.y - 30, 0, 1, 1.2, 4);
      ctx.restore();
      drawHud(st.t);
      if (st.ptr.show) hand(st.ptr.vx + 18, st.ptr.vy + 40, !!st.drag || st.pouring);
      // paper grain over everything
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.09; ctx.fillStyle = grain; ctx.fillRect(0, 0, VW, VH);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.restore();

      if (!done && (dayOver(S) && !st.react || G.skip)) { done = true; resolve(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  // ---------- end of the night ----------
  const avg = S.results.length ? Math.round(S.results.reduce((a, r) => a + r.points, 0) / S.results.length) : 0;
  const card = document.createElement('div');
  card.className = 'k3-result';
  card.innerHTML = `<div class="k-ticket">
    <div class="row" style="justify-content:space-between"><b>🏮 ${esc(title)}</b><span class="k-total">${avg}%</span></div>
    ${S.results.map(r => `<div class="meter"><span style="width:170px; font-size:13px">${GUESTS[r.who].ico} ${esc(GUESTS[r.who].name)}</span>
      <div class="bar"><div class="fill" style="width:${r.points}%; background:${r.points >= 80 ? '#49b26a' : r.points >= 60 ? '#f0b429' : '#e2574c'}"></div></div><span class="val">¥${r.tip}</span></div>
      <p class="sub" style="margin:0 0 6px 0">${r.judge.notes.map(n => `${n.ok ? '✓' : '✗'} ${esc(n.text)}`).join(' · ')}</p>`).join('')}
    <p class="sub">Tips: ¥${S.tips} · ⭐ ${Object.values(S.stars).filter(n => n > 0).length} happy regulars</p>
    <div class="row" style="justify-content:flex-end; margin-top:10px"><button class="btn-big" id="k-done">Close up</button></div>
  </div>`;
  document.getElementById('ui').appendChild(card);
  if (!G.skip) await new Promise(res => card.querySelector('#k-done').addEventListener('click', res));
  card.remove();
  cv.remove();
  removeEventListener('resize', resize); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu);
  G.flags.frozen3d = false;
  G.busy--;
  G.money += S.tips;
  return { results: S.results, tips: S.tips, avg, stars: S.stars };
}

// test hook: where things are, in client pixels
export const SHOP2D = { BOWL, POT, OIL, TRASH, SERVE, BASKETS, COILS, binRect, VW, VH };
window.__shop2dLayout = SHOP2D;
