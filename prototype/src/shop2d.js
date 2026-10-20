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
import { drawFood, drawBowl, drawDish, drawSplash, splashAt } from './food.js';
import { foley, foleyLoop } from './foley.js';
import { progress, owns, buy, useBowl, bowlRim, earn, pagesFound, ITEMS, PAGES, heartsFor } from './progress.js';
import { ctx, use, C, FONT, LOOKS, P2, rr, inked, circle, ellipse, text, label, wrap, rng, checker, grain, patterns, hand, person, piece } from './draw2d.js';

// one layout for a landscape tablet, one for a phone held upright
let VW = 1600, VH = 900, PORTRAIT = false, BUILD = 2 * VW, STOVE = VW, COUNTER_Y = 600, ROWS = [];
const PANEL = { order: 0, stove: 1, build: 2 };
const BOWL = {}, POT = {}, OIL = {}, TRASH = {}, SERVE = {}, THERMO = {}, BIN = {}, STOVE_POT = {}, COILS = {}, SLAB = {}, SLAB2 = {}, BSLAB = {}, O = {}, H = {};
const BASKETS = [{}, {}], TABLES = [{}, {}, {}, {}];
function relayout(portrait) {
  PORTRAIT = portrait; VW = portrait ? 900 : 1600; VH = portrait ? 1600 : 900; BUILD = 2 * VW; STOVE = VW;
  const set = (o, v) => Object.assign(o, v);
  if (!portrait) {
    set(BOWL, { x: BUILD + 720, y: 600, r: 218 }); set(POT, { x: BUILD + 205, y: 600, r: 130 }); set(OIL, { x: BUILD + 205, y: 360, r: 62 });
    set(TRASH, { x: BUILD + 1450, y: 640, w: 120, h: 150 }); set(SERVE, { x: BUILD + 1080, y: 705, w: 230, h: 84 }); set(THERMO, { x: BUILD + 980, y: 430, h: 260 });
    ROWS = [['pork', 'fish', 'egg', 'ham', 'chrys', 'chilli'], ['pea', 'chives', 'tofu', 'jizong', 'noodles']];
    set(BIN, { w: 150, h: 112, gap: 18, x0: BUILD + 345, y0: 92, rowGap: 52, shift: 40 });
    set(BSLAB, { x: BUILD + 300, y: 60, w: 1120, h: 820 });
    set(STOVE_POT, { x: STOVE + 860, y: 520, r: 300 }); set(BASKETS[0], { x: STOVE + 735, y: 520 }); set(BASKETS[1], { x: STOVE + 985, y: 520 });
    set(COILS, { x: STOVE + 250, y: 520, w: 280, h: 300, cols: 2 }); set(SLAB, { x: STOVE + 80, y: 150, w: 1440, h: 680 }); set(SLAB2, { x: STOVE + 520, y: 190, w: 680, h: 620 });
    COUNTER_Y = 600;
    [[330, 470], [640, 462], [960, 462], [1270, 470]].forEach(([x, y], i) => set(TABLES[i], { x, y }));
    set(O, { wallH: 470, wainY: 430, board: { x: 110, y: 70, w: 380, h: 270 }, win: { x: 980, y: 70, w: 470, h: 300 }, lanterns: [620, 800], cx: 560, guestY: 420, guestS: 1.4, walkY: 470, walkS: 0.75,
      queue: i => 1320 + i * 110, bubble: { x: 800, y: 120, w: 600 }, tableR: 95, teapot: 1260, jar: 1420, plant: 170, seatS: 0.42 });
    set(H, { tabs: { x: 560, y: 14, w: 160, gap: 170 }, chips: [{ x: 20, y: 14 }, { x: 220, y: 14 }], money: { x: 1360, y: 14 }, tk: { x: 20, y: 96, gap: 118 }, cap: 92 });
  } else {
    set(BOWL, { x: BUILD + 450, y: 955, r: 238 }); set(POT, { x: BUILD + 175, y: 1330, r: 115 }); set(OIL, { x: BUILD + 400, y: 1340, r: 60 });
    set(TRASH, { x: BUILD + 760, y: 800, w: 110, h: 140 }); set(SERVE, { x: BUILD + 540, y: 1290, w: 320, h: 96 }); set(THERMO, { x: BUILD + 50, y: 800, h: 260 });
    ROWS = [['pork', 'fish', 'egg', 'ham'], ['chrys', 'chilli', 'pea', 'chives'], ['tofu', 'jizong', 'noodles']];
    set(BIN, { w: 172, h: 106, gap: 30, x0: BUILD + 50, y0: 300, rowGap: 46, shift: 0 });
    set(BSLAB, { x: BUILD + 20, y: 280, w: 860, h: 1210 });
    set(STOVE_POT, { x: STOVE + 450, y: 760, r: 290 }); set(BASKETS[0], { x: STOVE + 330, y: 760 }); set(BASKETS[1], { x: STOVE + 570, y: 760 });
    set(COILS, { x: STOVE + 150, y: 1290, w: 600, h: 200, cols: 3 }); set(SLAB, { x: STOVE + 30, y: 290, w: 840, h: 1200 }); set(SLAB2, { x: STOVE + 120, y: 420, w: 660, h: 680 });
    COUNTER_Y = 1180;
    [[150, 830], [380, 815], [610, 815], [800, 830]].forEach(([x, y], i) => set(TABLES[i], { x, y }));
    set(O, { wallH: 850, wainY: 800, board: { x: 40, y: 300, w: 400, h: 270 }, win: { x: 470, y: 300, w: 390, h: 250 }, lanterns: [250, 650], lanternTop: 560, cx: 450, guestY: 1060, guestS: 1.45, walkY: 900, walkS: 0.65,
      queue: i => 700 + i * 90, bubble: { x: 40, y: 1205, w: 820, below: true }, tableR: 70, teapot: 700, jar: 800, plant: 110, seatS: 0.36 });
    set(H, { tabs: { x: 195, y: 14, w: 160, gap: 175 }, chips: [{ x: 20, y: 84 }, { x: 220, y: 84 }], money: { x: 660, y: 84 }, tk: { x: 20, y: 156, gap: 118 }, cap: 92 });
  }
}
relayout(false);
const binRect = p => { const r = ROWS.findIndex(row => row.includes(p)), i = ROWS[r].indexOf(p); return { x: BIN.x0 + i * (BIN.w + BIN.gap) + r * BIN.shift, y: BIN.y0 + r * (BIN.h + BIN.rowGap), w: BIN.w, h: BIN.h }; };
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
  setMusic('shop');
  const cv = document.createElement('canvas');
  cv.className = 'shop2d';
  document.getElementById('ui').appendChild(cv);
  use(cv.getContext('2d'));
  patterns();

  const S = createShop(schedule, { baskets: 2 });
  const st = {
    view: 'order', camX: 0, t: 0, selected: null, ptr: { x: 0, y: 0, down: false, vx: 0, vy: 0 }, drag: null, pouring: false,
    people: {}, pieces: {}, ripples: [], pops: [], caption: '', captionT: 0, idleT: 0, drops: [], waves: [], fatT: {}, held: { x: 0, y: 0, rot: 0 }, shake: 0, bubble: null, money: 0, react: null, lifts: [],
  };
  let scale = 1, ox = 0, oy = 0;
  function resize() {
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    relayout(innerWidth / innerHeight < 0.85);
    scale = Math.min(innerWidth / VW, innerHeight / VH);
    ox = (innerWidth - VW * scale) / 2; oy = (innerHeight - VH * scale) / 2;
  }
  resize(); addEventListener('resize', resize);
  const toV = (cx, cy) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });
  const toW = v => ({ x: v.x + st.camX, y: v.y });

  const sel = () => S.tickets.find(t => t.uid === st.selected && !t.served);

  // ---------- the guide: what to do next, shown not told (Good Pizza style) ----------
  // One step at a time for the selected bowl. If it's on this panel: a glowing
  // ring and a ghost glove acting it out; if not, that tab bounces.
  const count = (xs, p) => xs.filter(x => x === p).length;
  function nextStep() {
    const ready = S.baskets.findIndex(b => b.ticket && noodleRing(b.t).zone !== 'firm');
    if (ready >= 0) return { view: 'stove', kind: 'tap', at: BASKETS[ready], word: noodleRing(S.baskets[ready].t).zone === 'ready' ? 'Lift now!' : 'Lift! Going soft!' };
    const t = sel();
    const order = () => { const b = st.bubble.ok; return { view: 'order', kind: 'tap', at: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, word: 'Take the order' }; };
    // greet a waiting customer straight away (one tap), unless a finished bowl
    // is ready to go out to someone
    if (st.bubble) { const s = t && bowlStep(t); return s && s.serve ? s : order(); }
    if (!t) return null;
    return bowlStep(t);
  }
  function bowlStep(t) {
    const inBasket = S.baskets.findIndex(b => b.ticket === t.uid);
    if (t.noodles === null && inBasket < 0) {
      const free = S.baskets.findIndex(b => !b.ticket);
      if (free >= 0) return { view: 'stove', kind: 'drag', from: { x: COILS.x + COILS.w / 2, y: COILS.y }, at: BASKETS[free], word: 'Noodles in to cook', part: 'noodles' };
    }
    if (t.fill < FILL.lo) return { view: 'build', kind: 'hold', at: POT, word: t.fill > 0 ? 'Keep pouring to the line' : 'Hold to pour the broth' };
    if (!t.fat) return { view: 'build', kind: 'tap', at: OIL, word: 'Seal it with oil' };
    // saucers, in the order they cross the bridge: what the guest asked for first
    const a = t.ask || {}, ban = a.ban || [], have = t.parts.filter(p => p !== 'noodles');
    const top = Math.max(-1, ...t.parts.map(p => PARTS[p]?.rank ?? 0));
    const want = Object.entries(a.need || {}).filter(([p, n]) => count(t.parts, p) < n).map(([p]) => p).sort((p, q) => PARTS[p].rank - PARTS[q].rank);
    let part = want[0];
    if (!part && a.min && have.length + 1 < a.min) part = ['pork', 'egg', 'ham', 'chrys', 'pea', 'tofu', 'jizong', 'chives'].find(p => !ban.includes(p) && PARTS[p].rank >= top && count(t.parts, p) < 2);
    if (!part && !have.length) part = ['pork', 'egg', 'ham', 'chrys', 'pea'].find(p => !ban.includes(p));
    if (part) { const r = binRect(part); return { view: 'build', kind: 'drag', from: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, at: BOWL, word: PARTS[part].rank === 0 ? `${NAMES[part]}: raw goes first` : NAMES[part], part }; }
    if (!t.parts.includes('noodles')) {
      if (t.noodles === null) return inBasket >= 0 ? { view: 'stove', kind: 'wait', at: BASKETS[inBasket], word: 'Wait for the green…' } : null;
      const r = binRect('noodles'); return { view: 'build', kind: 'drag', from: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, at: BOWL, word: 'Noodles go in last', part: 'noodles' };
    }
    return { view: 'build', kind: 'tap', at: { x: SERVE.x + SERVE.w / 2, y: SERVE.y + SERVE.h / 2 }, word: 'Serve it!', serve: true };
  }
  function drawGuide(step, t) {
    if (!step || step.view !== st.view || st.drag || st.pouring) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const ringAt = (p, r) => { circle(p.x, p.y, r + pulse * 14); ctx.strokeStyle = `rgba(255,214,90,${0.55 + pulse * 0.45})`; ctx.lineWidth = 10; ctx.stroke(); circle(p.x, p.y, r + pulse * 14); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke(); };
    const R = step.at === BOWL ? BOWL.r + 10 : step.at === POT ? POT.r + 8 : step.at === OIL ? OIL.r + 10 : 110;
    if (step.kind !== 'drag') ringAt(step.at, step.kind === 'tap' && !BASKETS.includes(step.at) && step.at !== OIL ? 70 : R);
    else { ringAt(step.from, 80); }
    // the ghost glove only after a moment of hesitation, so it never nags
    if (st.idleT > 1.1) {
      ctx.globalAlpha = 0.6;
      if (step.kind === 'drag') {
        const k = (t * 0.7) % 1, e = k < 0.15 ? 0 : k > 0.8 ? 1 : (k - 0.15) / 0.65, ee = e * e * (3 - 2 * e);
        const x = step.from.x + (step.at.x - step.from.x) * ee, y = step.from.y + (step.at.y - step.from.y) * ee;
        if (k > 0.1 && k < 0.85) drawFood(ctx, step.part, x, y - 30, { cook: step.part === 'egg' ? 'shell' : PARTS[step.part]?.rank === 0 ? 0 : 1, s: 1, alpha: 0.8 });
        hand(x + 18, y + 40, k > 0.1 && k < 0.85);
        if (k > 0.8) { circle(step.at.x, step.at.y, 40 + (k - 0.8) * 600); ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 5; ctx.stroke(); }
      } else if (step.kind === 'hold') {
        const k = (t * 0.6) % 1;
        hand(step.at.x + 18, step.at.y + 40 + (k < 0.7 ? 6 : 0), k < 0.7);
        if (k < 0.7) { circle(step.at.x, step.at.y, 30 + k * 80); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 6; ctx.stroke(); }
      } else if (step.kind === 'tap') {
        const k = (t * 1.6) % 1;
        hand(step.at.x + 18, step.at.y + 40 + (k < 0.3 ? 10 : 0), k < 0.3);
      }
      ctx.globalAlpha = 1;
    }
    const lx = step.kind === 'drag' ? step.from.x : step.at.x, ly = (step.kind === 'drag' ? step.from.y - 110 : step.at.y - R - 46);
    if (st.view !== 'order') label(step.word, Math.max(160, Math.min(PANEL[st.view] * VW + VW - 160, lx)), Math.max(130, ly), 40);   // (the order bubble has words of its own)
  }
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
        <b>📜 Grandpa’s way · 过桥米线</b>
        <div class="svc-steps">
          <span>🍲<small>hot broth</small></span><i>→</i><span>✨<small>oil seal</small></span><i>→</i><span>🥩<small>raw first</small></span><i>→</i><span>🌼🌱<small>then the rest</small></span><i>→</i><span>🍜<small>noodles last</small></span>
        </div>
        <p class="sub">The glowing ring shows what’s next. Not sure what a customer means? Tap “What?”.</p>
        <div class="row" style="justify-content:flex-end"><button class="btn-big" data-go>Open the hatch 🏮</button></div></div>`;
      document.getElementById('ui').appendChild(el);
      el.querySelector('[data-go]').addEventListener('click', () => { el.remove(); res(); });
    });
  }
  learn('feast');

  // ---------- guests ----------
  function spawn(g) {
    st.people[g.uid] = { uid: g.uid, who: g.who, look: LOOKS[g.who], x: VW + 100, y: 0, tx: VW + 100, mood: 'happy', blinkT: Math.random() * 3, table: null, leaving: false };
    sfx('beep');
  }
  function layout() {
    const line = S.guests.filter(g => g.state === 'line');
    // the counter is free unless someone's tasting their bowl there
    line.forEach((g, i) => { const p = st.people[g.uid]; p.tx = i === 0 && !st.react ? O.cx : O.queue(i - (st.react ? 0 : 1)); });
    const waiting = S.guests.filter(g => g.state === 'waiting');
    const taken = new Set(waiting.map(g => st.people[g.uid].table).filter(x => x !== null));
    for (const g of waiting) {
      const p = st.people[g.uid];
      if (p.table === null) { p.table = TABLES.findIndex((_, i) => !taken.has(i)); if (p.table < 0) p.table = 0; taken.add(p.table); }
      p.tx = TABLES[p.table].x;
    }
  }
  function counterGuest() { const g = S.guests.find(q => q.state === 'line'); return g && Math.abs(st.people[g.uid].x - O.cx) < 8 ? g : null; }
  function nextAsk(g) { const asks = GUESTS[g.who].asks; return asks[(S.visits[g.who] || 0) % asks.length]; }

  // ---------- interactions ----------
  function tabsAt(v) {
    const tabs = [['order', '🛎️ Order'], ['stove', '♨️ Stove'], ['build', '🍜 Build']];
    return tabs.map(([id, s], i) => ({ id, s, x: H.tabs.x + i * H.tabs.gap, y: H.tabs.y, w: H.tabs.w, h: 56 })).find(b => inR(v, b));
  }
  function ticketAt(v) {
    const open = S.tickets.filter(t => !t.served);
    return open.find((t, i) => inR(v, { x: H.tk.x + i * H.tk.gap, y: H.tk.y, w: 110, h: 120 }));
  }
  function down(v) {
    const w = toW(v);
    st.ptr.down = true; st.ptr.sx = v.x; st.ptr.sy = v.y; st.drag = null; st.idleT = 0;
    if (st.hero) { if (st.hero.t > 0.5) st.hero.t = Math.max(st.hero.t, 1.9); return; }   // tap: send it out
    const tab = tabsAt(v); if (tab) { go(tab.id); return; }
    const tk = ticketAt(v); if (tk) { st.selected = tk.uid; sfx('pop'); return; }
    if (st.view === 'order' && st.bubble) {
      if (inR(v, st.bubble.ok)) { accept(); return; }
      if (inR(v, st.bubble.what)) {
        if (st.bubble.what.used) { accept(); return; }
        st.bubble.what.used = true; st.bubble.lines = wrap(`${st.bubble.ask.say} ${hint(st.bubble.ask)}`, O.bubble.w - 80, 36); sfx('pop'); return;
      }
    }
    if (st.view === 'stove') {
      if (inR(w, { x: COILS.x, y: COILS.y - COILS.h / 2, w: COILS.w, h: COILS.h })) { st.drag = { kind: 'coil' }; foley('chopsticks', { gain: 0.7 }); return; }
      const bi = BASKETS.findIndex(b => near(w, b, 105));
      if (bi >= 0 && S.baskets[bi].ticket) { lift(bi); return; }
    }
    if (st.view === 'build') {
      const t = sel();
      const part = ROWS.flat().find(p => inR(w, binRect(p)));
      if (part) {
        if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; }
        if (part === 'noodles' && t.noodles === null) { say('The noodles for this bowl aren’t cooked yet. To the stove! ♨️'); sfx('bump'); return; }
        st.drag = { kind: 'part', part, seed: Math.floor(Math.random() * 999) }; st.held.x = w.x; st.held.y = w.y - 40; st.held.rot = 0; foley('chopsticks', { gain: 0.8 }); return;
      }
      if (near(w, POT, POT.r)) { if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; } st.pouring = true; foley('ladle_clink', { gain: 0.7 }); foley('pour_broth', { gain: 0.9, delay: 0.08 }); return; }
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
        if (t.fill >= FILL.lo && t.fill <= FILL.hi) { pop('Right on the line!', BOWL.x, BOWL.y - BOWL.r - 50, C.greenD); sfx('ding'); }
        else if (t.fill > FILL.hi) { pop('Spilling over!', BOWL.x, BOWL.y - BOWL.r - 50, C.red); sfx('bump'); }
        else pop('A little more…', BOWL.x, BOWL.y - BOWL.r - 50);
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
      startNoodles(S, bi, t.uid); foley('plop_heavy', { gain: 0.9, rate: 0.85 });
      for (let k = 0; k < 6; k++) st.ripples.push({ x: BASKETS[bi].x, y: BASKETS[bi].y, t: k * -0.08, col: '#ffffff' });
      return;
    }
    if (d.kind === 'part') {
      const t = sel();
      if (!t || !near(w, BOWL, BOWL.r - 10)) { sfx('bump'); return; }
      if (!t.fill && PARTS[d.part].rank === 0) say('Raw slices into an empty bowl? They need scalding broth to cook!');
      if (!addPart(S, t.uid, d.part)) { sfx('bump'); return; }
      const hot = t.fill > 0 && t.heat >= COOK_HEAT;
      // a composed bowl: noodles in the middle, everything else finds its own space round the rim
      const list = (st.pieces[t.uid] ||= []);
      let px = w.x - BOWL.x, py = w.y - BOWL.y;
      if (d.part === 'noodles') { px = 0; py = 0; }
      else {
        const ring = BOWL.r * 0.5, gap = BOWL.r * 0.3;
        const free = (x, y) => list.every(q => q.p === 'noodles' || Math.hypot(q.x - x, q.y - y) > gap);
        if (Math.hypot(px, py) > ring * 1.25 || !free(px, py)) {
          let best = null;
          for (let k = 0; k < 24 && !best; k++) { const a = Math.atan2(py, px) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.42, rr2 = ring * (k < 12 ? 1 : 0.62); const x = Math.cos(a) * rr2, y = Math.sin(a) * rr2; if (free(x, y)) best = [x, y]; }
          [px, py] = best || [px * 0.7, py * 0.7];
        }
      }
      list.push({ p: d.part, x: px, y: py, rot: Math.random() * 6, born: st.t, hot, seed: d.seed });
      if (d.part === 'egg') foley('egg_crack', { gain: 0.9 });   // cracked on the rim as it goes in
      // let go: the plop comes when it lands
      if (PARTS[d.part].rank === 0) { learn('raw'); pop(hot ? 'Tssss… cooked in seconds' : '…it won’t cook. Too cold!', w.x, w.y - 70, hot ? C.greenD : C.red); }
      if (d.part === 'chrys') learn('chrys');
    }
  }
  function oil() {
    const t = sel();
    if (!t) { say('👆 Pick a ticket first (top left).'); sfx('bump'); return; }
    if (!t.broth) { say('Broth first, then the oil on top.'); sfx('bump'); return; }
    if (!addFat(S, t.uid)) return;
    st.fatT[t.uid] = st.t;
    foley('oil_pour'); foley('sizzle', { gain: 0.35, delay: 0.35 });
    pop('✨ Sealed: a coin-thick layer of oil', BOWL.x, BOWL.y - BOWL.r - 50, C.woodD);
    learn('seal');
  }
  function lift(i) {
    const score = liftNoodles(S, i);
    foley('noodle_lift');
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
    p.mood = 'normal';
    st.react = { uid: t.guest, tk: t.uid, t: 0, res, mood: res.points >= 80 ? 'happy' : res.points >= 60 ? 'normal' : res.points >= 45 ? 'sad' : 'angry', line: bad ? bad.text : good.length ? `Mm! ${good[0].text}` : 'Mm!' };
    p.tx = O.cx; p.react = true;
    // the hero shot: before it goes out, the bowl you made fills the screen for a moment
    st.hero = { tk: t.uid, t: 0, fill: t.fill, fat: t.fat ? 1 : 0, mixed: t.mixed };
    note(1046, 0.5, 'sine', 0.06); note(1568, 0.6, 'sine', 0.04, 0.12);
    layout();
    go('order');
    st.selected = S.tickets.find(q => !q.served)?.uid || null;
  }

  // The finished bowl, close: it rises out of the kitchen into the light, steam
  // curling off the oil, a glint across the glaze, then out to the counter.
  function drawHero(h) {
    const k = Math.min(1, h.t / 0.35), out = Math.max(0, (h.t - 1.9) / 0.3), e = 1 - (1 - k) ** 3;
    const a = (1 - out);
    ctx.save();
    ctx.globalAlpha = 0.72 * e * a;
    const bg = ctx.createRadialGradient(VW / 2, VH / 2, 40, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
    bg.addColorStop(0, '#6a3a1e'); bg.addColorStop(1, '#1d0f08');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = a;
    const R = Math.min(VW, VH) * 0.34 * (0.8 + 0.2 * e) * (1 + out * 0.1), cx = VW / 2, cy = VH / 2 + (1 - e) * 120 + out * 160;
    // warm pool of light under the bowl
    const pool = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.6);
    pool.addColorStop(0, 'rgba(255,200,120,0.35)'); pool.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = pool; ctx.fillRect(cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4);
    drawBowl(ctx, cx, cy, R, { fill: h.fill, fat: h.fat, rimCol: bowlRim('#3a6ea5'), t: st.t, mixed: h.mixed });
    const sc = R / BOWL.r;
    for (const pc of st.pieces[h.tk] || []) {
      const raw = PARTS[pc.p].rank === 0;
      drawFood(ctx, pc.p, cx + pc.x * sc, cy + pc.y * sc + Math.sin(st.t * 1.6 + pc.seed) * 2, { rot: pc.rot, cook: raw ? (pc.hot ? 1 : 0) : 1, s: sc * (pc.p === 'noodles' ? 1.6 : 1.1), variant: pc.seed });
    }
    // a glint sweeping across the glaze and the oil
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, P2); ctx.clip();
    const gx = cx - R * 1.6 + Math.min(1, h.t / 1.2) * R * 3.2;
    const gl = ctx.createLinearGradient(gx - 60, cy - R, gx + 60, cy + R);
    gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,250,235,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    // steam: soft curls rising off the bowl
    for (let i = 0; i < 9; i++) {
      const q = (h.t * 0.45 + i / 9) % 1, sx = cx + Math.sin(i * 2.3) * R * 0.5 + Math.sin(st.t * 1.4 + i) * 18 * q;
      const sy = cy - R * 0.2 - q * R * 1.3, r = R * (0.1 + q * 0.22);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      sg.addColorStop(0, `rgba(255,255,255,${0.32 * Math.sin(q * Math.PI) * e})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, P2); ctx.fill();
    }
    ctx.globalAlpha = a * Math.min(1, Math.max(0, (h.t - 0.3) / 0.3));
    label('过桥米线', cx, cy - R - 70, 64);
    label('Order up!', cx, cy + R + 70, 46);
    ctx.restore();
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
    ctx.fillStyle = '#f6e4cc'; ctx.fillRect(0, 0, VW, O.wallH);
    ctx.fillStyle = C.wood; ctx.fillRect(0, O.wainY, VW, 60); ctx.fillStyle = C.woodD; ctx.fillRect(0, O.wainY + 56, VW, 6);
    ctx.fillStyle = checker; ctx.fillRect(0, O.wainY + 60, VW, VH);
    const w = O.win;
    rr(w.x, w.y, w.w, w.h, 12); const sky = ctx.createLinearGradient(0, w.y, 0, w.y + w.h); sky.addColorStop(0, '#7d6bb0'); sky.addColorStop(1, '#f2a679');
    ctx.fillStyle = sky; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.woodD; ctx.stroke();
    ctx.strokeStyle = C.woodD; ctx.lineWidth = 6;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w.x + i * w.w / 4, w.y); ctx.lineTo(w.x + i * w.w / 4, w.y + w.h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(w.x, w.y + w.h / 2); ctx.lineTo(w.x + w.w, w.y + w.h / 2); ctx.stroke();
    for (let i = 0; i < 6; i++) { circle(w.x + 30 + i * (w.w - 60) / 5, w.y + 50 + Math.sin(t + i) * 3, 13); ctx.fillStyle = '#ff6a4a'; ctx.fill(); }   // lanterns outside
    // menu board: the exam-rank sets
    const bd = O.board;
    rr(bd.x, bd.y, bd.w, bd.h, 14); inked('#2f4f3f', 6);
    text('过桥米线', bd.x + bd.w / 2, bd.y + 48, 46, '#fff6ea');
    text('Crossing-the-Bridge Noodles', bd.x + bd.w / 2, bd.y + 90, 24, '#e7dcc2');
    [['秀才 Xiucai', '¥16'], ['举人 Juren', '¥22'], ['状元 Zhuangyuan', '¥38']].forEach(([a, b], i) => { text(a, bd.x + 30, bd.y + 135 + i * 42, 30, '#fff6ea', 'left'); text(b, bd.x + bd.w - 30, bd.y + 135 + i * 42, 30, '#ffd23f', 'right'); });
    // hanging lanterns inside
    for (const [i, x] of O.lanterns.entries()) {
      const sw = Math.sin(t * 1.2 + i * 1.3) * 0.06, top = O.lanternTop || 0;
      ctx.save(); ctx.translate(x, top); ctx.rotate(sw);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 70); ctx.stroke();
      ellipse(0, 112, 40, 46); inked('#e0473b', 4); rr(-22, 62, 44, 12, 4); inked(C.gold, 3); rr(-22, 150, 44, 12, 4); inked(C.gold, 3);
      ctx.restore();
    }
    drawDeco(t);
    // tables (customers who are waiting sit here)
    const seated = p => p.table !== null && !p.react && !p.leaving && Math.abs(p.x - TABLES[p.table].x) <= 10;
    for (const tb of TABLES) { ellipse(tb.x, tb.y + 40, O.tableR, 26); inked('#e9c79b', 4); }
    for (const p of Object.values(st.people)) {
      if (!seated(p)) continue;
      const tb = TABLES[p.table];
      person(p.look, p.x, tb.y - 22, O.seatS, p.mood, t, p.blink);   // seated: the table hides their lap
      ellipse(tb.x, tb.y + 40, O.tableR, 26); inked('#e9c79b', 4);
      const g = S.guests.find(q => q.uid === p.uid), tk = S.tickets.find(q => q.guest === p.uid);
      if (g && tk) { const ty = tb.y - 110; rr(p.x - 34, ty, 68, 40, 10); inked(C.paper, 3); text(tk.uid, p.x, ty + 21, 26); const pat = g.patience / g.maxPatience; rr(p.x - 34, ty + 46, 68, 8, 4); ctx.fillStyle = '#eadccb'; ctx.fill(); rr(p.x - 34, ty + 46, 68 * pat, 8, 4); ctx.fillStyle = pat > 0.5 ? C.green : pat > 0.25 ? C.gold : C.red; ctx.fill(); }
    }
    // the queue by the door, and whoever's at the counter (or walking)
    for (const p of Object.values(st.people)) {
      if (seated(p)) continue;
      const atCounter = Math.abs(p.x - O.cx) < 120;
      const sc = atCounter ? O.guestS : O.walkS, y = atCounter ? O.guestY : O.walkY;     // the counter cuts them at the waist
      person(p.look, p.x, y + Math.sin(t * 6 + p.x) * (Math.abs(p.x - p.tx) > 4 ? 6 : 1.5), sc, p.mood, t, p.blink);
    }
    // the counter
    rr(-20, COUNTER_Y, VW + 40, 60, 0); inked(C.woodL, 5);
    ctx.fillStyle = C.wood; ctx.fillRect(0, COUNTER_Y + 60, VW, VH);
    ctx.strokeStyle = C.woodD; ctx.lineWidth = 3; for (let x = 60; x < VW; x += 160) { ctx.beginPath(); ctx.moveTo(x, COUNTER_Y + 60); ctx.lineTo(x, VH); ctx.stroke(); }
    // teapot, a little plant and the tip jar on the counter
    ellipse(O.teapot, COUNTER_Y + 2, 60, 46); inked('#7fb5a8', 4); rr(O.teapot + 40, COUNTER_Y - 34, 40, 12, 6); inked('#7fb5a8', 3);
    rr(O.jar, COUNTER_Y - 70, 70, 80, 14); inked('rgba(220,240,255,0.6)', 4); text(`¥${st.money}`, O.jar + 35, COUNTER_Y - 30, 26, C.woodD);
    rr(O.plant, COUNTER_Y - 50, 70, 56, 10); inked('#e09a6b', 4); for (let i = 0; i < 5; i++) { ellipse(O.plant + 20 + i * 8, COUNTER_Y - 70, 9, 22, (i - 2) * 0.3); inked(C.green, 2); }
    // speech bubble with Okay / What?
    const g = counterGuest(), B = O.bubble;
    if (g && !st.react && !st.bubble) { const ask = nextAsk(g); st.bubble = { uid: g.uid, ask, lines: wrap(ask.say, B.w - 80, 36), ok: { x: 0, y: 0, w: 170, h: 70 }, what: { x: 0, y: 0, w: 170, h: 70 } }; sfx('pop'); }
    if (st.bubble && (!g || g.uid !== st.bubble.uid)) st.bubble = null;
    const speech = (lines, extra) => {
      const h = 40 + lines.length * 44 + extra;
      rr(B.x, B.y, B.w, h, 26); inked(C.paper, 5);
      ctx.beginPath();
      if (B.below) { ctx.moveTo(O.cx - 40, B.y + 4); ctx.lineTo(O.cx + 10, B.y - 60); ctx.lineTo(O.cx + 30, B.y + 4); }
      else { ctx.moveTo(B.x + 20, B.y + h - 30); ctx.lineTo(B.x - 70, B.y + 130); ctx.lineTo(B.x + 50, B.y + h - 10); }
      ctx.fillStyle = C.paper; ctx.fill(); ctx.stroke();
      lines.forEach((l, i) => text(l, B.x + 30, B.y + 42 + i * 44, 36, C.ink, 'left'));
      return h;
    };
    if (st.bubble) {
      const b = st.bubble, h = speech(b.lines, 0);
      b.ok.x = B.x + B.w / 2 - 190; b.what.x = B.x + B.w / 2 + 20;
      b.ok.y = b.what.y = B.y + h + 20;
      for (const [btn, s, k] of [[b.ok, 'Okay', 'A'], [b.what, b.what.used ? 'Got it' : 'What?', 'B']]) {
        rr(btn.x, btn.y, btn.w, btn.h, 30); inked('#fff3e2', 5); text(s, btn.x + btn.w / 2 - 10, btn.y + btn.h / 2, 36);
        circle(btn.x + btn.w - 18, btn.y + btn.h - 10, 15); inked(C.rose, 3); text(k, btn.x + btn.w - 18, btn.y + btn.h - 10, 20);
      }
    }
    // a served guest tastes it, right here at the counter
    if (st.react) {
      const r = st.react, p = st.people[r.uid];
      if (Math.abs(p.x - O.cx) < 10) {
        // 1) the bowl slides along the counter  2) they eat  3) the verdict:
        // hearts and coins, the body acts it, one short line
        const pts = r.res.points, hearts = pts >= 85 ? 3 : pts >= 65 ? 2 : 1;
        const by = COUNTER_Y - 18, slide = Math.min(1, r.t / 0.55), ease = 1 - (1 - slide) ** 3;
        const bx = O.cx + (1 - ease) * (VW * 0.55);
        const eat = Math.max(0, Math.min(1, (r.t - 0.6) / 1.0));
        // the real bowl, seen across the counter: what you made, going down as they eat
        ctx.save(); ctx.translate(bx, by); ctx.scale(1, 0.42);
        drawBowl(ctx, 0, 0, 118, { fill: 0.85 * (1 - eat * 0.5), fat: 1, rimCol: bowlRim('#3a6ea5'), t });
        const ps = (st.pieces[r.tk] || []).filter((_, i, a) => i >= a.length - 6);
        ps.forEach((pc, i) => { if (i / ps.length < 1 - eat) drawFood(ctx, pc.p, pc.x * 0.55, pc.y * 0.55, { rot: pc.rot, cook: 1, s: pc.p === 'noodles' ? 0.95 : 0.7, variant: pc.seed }); });
        ctx.restore();
        rr(bx - 118, by, 236, 34, 16); ctx.fillStyle = '#efe8dc'; ctx.fill();   // the bowl's front wall
        ctx.strokeStyle = bowlRim('#3a6ea5'); ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(bx, by + 10, 112, 30, 0, 0.15, Math.PI - 0.15); ctx.stroke();
        if (eat > 0 && eat < 1) {                     // chopsticks dipping, steam
          const dip = Math.abs(Math.sin(r.t * 9)) * 30;
          ctx.save(); ctx.translate(bx + 40, by - 70 + dip); ctx.rotate(0.35); rr(-4, -90, 8, 110, 4); inked('#c9935f', 3); rr(10, -90, 8, 110, 4); inked('#c9935f', 3); ctx.restore();
          for (let k = 0; k < 3; k++) { const q = (r.t * 0.9 + k / 3) % 1; ctx.globalAlpha = 0.5 * (1 - q); circle(bx - 30 + k * 30, by - 40 - q * 90, 14 + q * 16); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
        }
        if (r.t >= 1.6) {
          const k = Math.min(1, (r.t - 1.6) / 0.25);
          for (let i = 0; i < 3; i++) {
            const on = i < hearts, pop = Math.min(1, Math.max(0, (r.t - 1.6 - i * 0.18) / 0.22));
            const sc = pop < 1 ? pop * 1.3 : 1.3 - Math.min(0.3, (r.t - 1.8 - i * 0.18) * 1.5);
            ctx.save(); ctx.translate(O.cx - 90 + i * 90, O.guestY - 330 * O.guestS * 0.7); ctx.scale(sc, sc);
            text(on ? '❤️' : '🤍', 0, 0, 64); ctx.restore();
          }
          label(`+¥${r.res.tip}`, O.cx + 200, O.guestY - 330 * O.guestS * 0.7 - (r.t - 1.6) * 30, 44 * k);
          const lines = wrap(r.line, B.w - 80, 34).slice(0, 2); speech(lines, 50);
        }
      }
    }
  }

  // what the shop has bought with its tips (progress.js): all on the back wall
  function drawDeco(t) {
    const ledge = O.wainY;                          // things stand on the wainscot ledge
    const pot = (x, w, h, col) => { rr(x - w / 2, ledge - h, w, h, 10); inked(col, 4); };
    if (owns('ivy')) for (const [x0, dir] of [[0, 1], [VW, -1]]) {
      for (let i = 0; i < 9; i++) { const y = 10 + i * 34, x = x0 + dir * (24 + Math.sin(i * 1.7 + t * 0.8) * 8 + (i % 2) * 22); ellipse(x, y, 20, 13, dir * 0.6); inked(i % 3 ? C.green : '#5f9e4a', 3); }
    }
    if (owns('lanterns')) for (const [i, x] of [VW * 0.08, VW * 0.92].entries()) {
      const sw = Math.sin(t * 1.4 + i) * 0.07; ctx.save(); ctx.translate(x, (O.lanternTop || 0) + 30); ctx.rotate(sw);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 50); ctx.stroke();
      ellipse(0, 82, 30, 36); inked('#e0473b', 4); rr(-16, 44, 32, 10, 4); inked(C.gold, 3); ctx.restore();
    }
    if (owns('fern')) { const x = PORTRAIT ? 70 : 60; for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(x, ledge - 56); ctx.rotate(-1.3 + i * 0.32 + Math.sin(t + i) * 0.04); ellipse(0, -44, 13, 48); inked(i % 2 ? C.green : '#5f9e4a', 3); ctx.restore(); } pot(x, 78, 60, '#c9785a'); }
    if (owns('bamboo')) { const x = VW - (PORTRAIT ? 70 : 60); for (const [dx, h] of [[-14, 220], [4, 260], [20, 190]]) { rr(x + dx - 7, ledge - 50 - h, 14, h, 6); inked('#7fbf6a', 3); for (let y = ledge - 50 - h + 40; y < ledge - 60; y += 50) { ctx.fillStyle = '#5f9e4a'; ctx.fillRect(x + dx - 8, y, 16, 4); } ellipse(x + dx + 18, ledge - 40 - h, 20, 8, -0.5); inked(C.green, 2); } pot(x, 74, 52, '#e8e2d6'); }
    if (owns('camellia')) {
      const x = PORTRAIT ? VW / 2 : O.win.x - 70;
      for (let i = 0; i < 7; i++) { ellipse(x - 40 + (i % 4) * 26, ledge - 90 - Math.floor(i / 4) * 34, 24, 18); inked('#4f8f3e', 3); }
      for (let i = 0; i < 5; i++) { const fx = x - 36 + i * 18, fy = ledge - 112 + (i % 2) * 26; circle(fx, fy, 13); inked('#e0475a', 3); circle(fx, fy, 4); ctx.fillStyle = '#ffd23f'; ctx.fill(); }
      pot(x, 92, 58, '#b5654a');
    }
  }

  function drawStove(t) {
    const X = STOVE;
    counter(X);
    // the stove: dark enamel, a ring of blue flame peeking out under the pot
    let gr = ctx.createLinearGradient(0, SLAB2.y, 0, SLAB2.y + SLAB2.h); gr.addColorStop(0, '#4d4858'); gr.addColorStop(1, '#2f2b38');
    rr(SLAB2.x, SLAB2.y, SLAB2.w, SLAB2.h, 40); ctx.fillStyle = gr; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; rr(SLAB2.x + 6, SLAB2.y + 6, SLAB2.w - 12, SLAB2.h - 12, 34); ctx.stroke();
    const P = STOVE_POT;
    for (let k = 0; k < 24; k++) { const a = k / 24 * P2, fx = P.x + Math.cos(a) * (P.r + 14), fy = P.y + Math.sin(a) * (P.r + 14), h = 14 + Math.sin(t * 20 + k * 2) * 5; ctx.save(); ctx.translate(fx, fy); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, -h * 1.4, 6, 0); ctx.fillStyle = k % 2 ? '#5aa9ff' : '#8ad0ff'; ctx.fill(); ctx.restore(); }
    // the big pot of boiling water: steel walls, a rolling boil, steam
    gr = ctx.createRadialGradient(P.x - P.r * 0.4, P.y - P.r * 0.4, P.r * 0.1, P.x, P.y, P.r); gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.75, '#b5bec9'); gr.addColorStop(1, '#6f7a88');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, P2); ctx.fill();
    const wr = P.r * 0.9;
    gr = ctx.createRadialGradient(P.x - wr * 0.3, P.y - wr * 0.3, 10, P.x, P.y, wr); gr.addColorStop(0, '#eef8fb'); gr.addColorStop(0.7, '#cbe5ec'); gr.addColorStop(1, '#9cc4cf');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(P.x, P.y, wr, 0, P2); ctx.fill();
    const R = rng(3);
    for (let i = 0; i < 40; i++) { const a = R() * P2, d = R() * (wr - 20), k = (t * (0.8 + R()) + R()) % 1; circle(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.95, 3 + k * 12); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(P.x, P.y, P.r - 4, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    for (let i = 0; i < 5; i++) { const k = (t * 0.45 + i / 5) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - k)})`; ctx.lineWidth = 14 * (1 - k * 0.5); ctx.lineCap = 'round'; const sx = P.x - 120 + i * 60; ctx.beginPath(); ctx.moveTo(sx, P.y - 40 - k * 220); ctx.quadraticCurveTo(sx + 26, P.y - 90 - k * 220, sx, P.y - 140 - k * 220); ctx.stroke(); }
    // two baskets with a segmented timer each (Papa's ring, Good Pizza's oven bar)
    BASKETS.forEach((b, i) => {
      const bk = S.baskets[i];
      // a wire noodle basket, sunk in the boil
      let bg = ctx.createRadialGradient(b.x, b.y, 20, b.x, b.y, 100); bg.addColorStop(0, 'rgba(120,160,175,0.25)'); bg.addColorStop(1, 'rgba(80,110,125,0.45)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, P2); ctx.fill();
      ctx.strokeStyle = 'rgba(70,80,95,0.45)'; ctx.lineWidth = 1.6;
      for (let k = -90; k <= 90; k += 15) { const h = Math.sqrt(Math.max(0, 10000 - k * k)); ctx.beginPath(); ctx.moveTo(b.x + k, b.y - h); ctx.lineTo(b.x + k, b.y + h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x - h, b.y + k); ctx.lineTo(b.x + h, b.y + k); ctx.stroke(); }
      ctx.lineWidth = 7; ctx.strokeStyle = '#a9b2bd'; ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, P2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, 100, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      rr(b.x - 10, b.y - 230, 20, 130, 10); inked(C.woodD, 4);      // handle
      if (bk.ticket) {
        drawFood(ctx, 'noodles', b.x, b.y, { rot: t * 0.3, s: 1.35, variant: i + 7 });
        const r = noodleRing(bk.t), segs = 10;
        const bw = PORTRAIT ? 210 : 240, sw = (bw - 16) / segs;
        rr(b.x - bw / 2, b.y + 130, bw, 44, 12); inked('#e8e4ee', 4);
        for (let k = 0; k < segs; k++) {
          const f = (k + 1) / segs, on = r.v >= f - 0.0001;
          const col = f <= r.lo ? '#7fb8f0' : f <= r.hi + 0.05 ? C.green : '#f08a7a';
          rr(b.x - bw / 2 + 8 + k * sw, b.y + 138, sw - 4, 28, 5); ctx.fillStyle = on ? col : '#fbf7ff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.inkSoft; ctx.stroke();
        }
        label(bk.ticket, b.x, b.y - 128, 34);
        if (r.zone === 'ready') { label('LIFT!', b.x, b.y + 210, 40 + Math.sin(t * 10) * 3); }
      } else label('empty', b.x, b.y + 150, 28);
    });
    // fresh rice noodle coils
    rr(COILS.x, COILS.y - COILS.h / 2, COILS.w, COILS.h, 18); inked(C.steelL, 6);
    rr(COILS.x + 16, COILS.y - COILS.h / 2 + 16, COILS.w - 32, COILS.h - 32, 12); inked('#8f8aa0', 4);
    for (let i = 0; i < 6; i++) { const c = i % COILS.cols, rw = Math.floor(i / COILS.cols), rows = 6 / COILS.cols; drawFood(ctx, 'noodles', COILS.x + (c + 0.5) * COILS.w / COILS.cols, COILS.y - COILS.h / 2 + (rw + 0.5) * COILS.h / rows, { rot: i, s: 0.85, variant: i + 2 }); }
    label('Fresh rice noodles', COILS.x + COILS.w / 2, COILS.y + COILS.h / 2 + 40, 34);
    // noodles flying out of a basket
    for (const l of st.lifts) { l.t += 1 / 60; drawFood(ctx, 'noodles', l.x + l.t * 500, l.y - Math.sin(l.t * 3) * 260, { rot: l.t * 4, s: 1.2 - l.t * 0.35, variant: 3 }); }
    st.lifts = st.lifts.filter(l => l.t < 1);
  }

  // a warm wooden counter, lit from the top left (cached: it never changes)
  let counterCache = null;
  function counter(X) {
    const key = `${VW}x${VH}`;
    if (!counterCache || counterCache.key !== key) {
      const c = document.createElement('canvas'); c.width = VW * 1.25; c.height = VH * 1.25;
      const g = c.getContext('2d'); g.scale(1.25, 1.25);
      const base = g.createLinearGradient(0, 0, 0, VH); base.addColorStop(0, '#d8a46c'); base.addColorStop(1, '#c08a55');
      g.fillStyle = base; g.fillRect(0, 0, VW, VH);
      const R = rng(4);
      for (let y = 0; y < VH; y += 120) {                       // planks with grain
        g.fillStyle = `rgba(${R() < 0.5 ? '255,235,205' : '120,70,35'},${0.06 + R() * 0.05})`; g.fillRect(0, y, VW, 120);
        g.strokeStyle = 'rgba(100,58,30,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.lineTo(VW, y); g.stroke();
        g.strokeStyle = 'rgba(120,72,38,0.18)'; g.lineWidth = 1.5;
        for (let k = 0; k < 7; k++) { const yy = y + 12 + R() * 96; g.beginPath(); g.moveTo(0, yy); for (let x = 0; x <= VW; x += 80) g.lineTo(x, yy + Math.sin(x * 0.01 + k) * 4); g.stroke(); }
      }
      const light = g.createRadialGradient(VW * 0.3, VH * 0.2, 40, VW * 0.4, VH * 0.4, Math.max(VW, VH) * 0.85);   // the lamp over the counter
      light.addColorStop(0, 'rgba(255,236,190,0.45)'); light.addColorStop(0.5, 'rgba(255,220,170,0.1)'); light.addColorStop(1, 'rgba(60,30,20,0.35)');
      g.fillStyle = light; g.fillRect(0, 0, VW, VH);
      counterCache = { key, c };
    }
    ctx.drawImage(counterCache.c, X, 0, VW, VH);
  }
  // the stockpot of old-hen broth: steel, a rolling simmer, steam
  function stockpot(t) {
    const { x, y, r } = POT;
    let gr = ctx.createRadialGradient(x + 10, y + 18, r * 0.8, x + 10, y + 18, r * 1.25); gr.addColorStop(0, 'rgba(70,40,25,0.4)'); gr.addColorStop(1, 'rgba(70,40,25,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x + 10, y + 18, r * 1.25, 0, P2); ctx.fill();
    for (const sx of [-1, 1]) { rr(x + sx * (r + 6) - (sx < 0 ? 34 : 0), y - 14, 34, 28, 12); ctx.fillStyle = '#8f97a3'; ctx.fill(); }
    gr = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.7, '#b9c1cb'); gr.addColorStop(1, '#7d8794');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, P2); ctx.fill();
    const br = r * 0.84;
    gr = ctx.createRadialGradient(x - br * 0.3, y - br * 0.3, 4, x, y, br); gr.addColorStop(0, '#ffe7a8'); gr.addColorStop(0.6, '#f0be62'); gr.addColorStop(1, '#c98a30');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, br, 0, P2); ctx.fill();
    const R = rng(8);
    for (let i = 0; i < 14; i++) {                               // the simmer: bubbles rise and pop
      const k = (t * (0.5 + R() * 0.6) + R()) % 1, a = R() * P2, d = R() * br * 0.85;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + k * 7, 0, P2);
      ctx.strokeStyle = `rgba(255,250,225,${0.75 * (1 - k)})`; ctx.lineWidth = 2; ctx.stroke();
    }
    for (let i = 0; i < 26; i++) { const a = R() * P2, d = Math.sqrt(R()) * br * 0.9, rr2 = 1.5 + R() * 4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr2, 0, P2); ctx.fillStyle = 'rgba(255,210,80,0.55)'; ctx.fill(); }
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x, y, r - 3, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    for (let i = 0; i < 3; i++) {                                // steam
      const k = (t * 0.4 + i / 3) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`; ctx.lineWidth = 10 * (1 - k * 0.5); ctx.lineCap = 'round';
      const sx = x - 40 + i * 40; ctx.beginPath(); ctx.moveTo(sx, y - 20 - k * 160); ctx.quadraticCurveTo(sx + 22, y - 60 - k * 160, sx, y - 100 - k * 160); ctx.stroke();
    }
  }
  // the chicken-oil jar: glass, golden, a spoon in it
  function oilJar() {
    const { x, y, r } = OIL;
    let gr = ctx.createRadialGradient(x + 6, y + 10, r * 0.6, x + 6, y + 10, r * 1.2); gr.addColorStop(0, 'rgba(70,40,25,0.35)'); gr.addColorStop(1, 'rgba(70,40,25,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x + 6, y + 10, r * 1.2, 0, P2); ctx.fill();
    gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.5, '#ffd760'); gr.addColorStop(1, '#d99a20');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, P2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(x, y, r - 3, 0, P2); ctx.stroke();
    ctx.save(); ctx.translate(x + 8, y - 6); ctx.rotate(0.5); rr(-6, -r - 50, 12, r + 40, 6); ctx.fillStyle = '#c9ced6'; ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -4, 16, 11, 0, 0, P2); ctx.fill(); ctx.restore();
  }

  function drawBuild(t) {
    const X = BUILD, tk = sel();
    counter(X);
    // the saucers, each a porcelain dish with a little pile of the real thing
    const want = st.step && st.step.view === 'build' && st.step.part;
    for (const p of ROWS.flat()) {
      const r = binRect(p);
      const locked = p === 'noodles' && (!tk || tk.noodles === null);
      const glow = want === p && !st.drag ? 0.55 + 0.45 * Math.sin(t * 5) : 0;
      drawDish(ctx, r.x, r.y, r.w, r.h, p, { t, glow, locked, shell: p === 'egg', count: p === 'noodles' ? 1 : 5 });
      if (locked) text('♨️ cooking', r.x + r.w / 2, r.y + r.h / 2, 28, '#fff6ea');
      label(NAMES[p], r.x + r.w / 2, r.y + r.h + 22, 26);
    }
    stockpot(t);
    label('Old hen broth', POT.x, POT.y + POT.r + 34, 30);
    oilJar();
    label('Chicken oil', OIL.x, OIL.y + OIL.r + 30, 28);
    // the slop bin
    rr(TRASH.x, TRASH.y, TRASH.w, TRASH.h, 16); inked('#8f8aa0', 5); rr(TRASH.x + 14, TRASH.y + 14, TRASH.w - 28, 40, 10); inked('#6d6880', 3);
    text('🗑️', TRASH.x + TRASH.w / 2, TRASH.y + 100, 44);
    // the bowl
    const R0 = BOWL.r, inner = R0 * 0.84;
    const brad = f => inner * (0.45 + Math.min(f, 1.15) * 0.48);
    for (const w of st.waves) w.t += st.dt || 1 / 60;
    st.waves = st.waves.filter(w => w.t < 1);
    const fat = tk && tk.fat ? Math.min(1, (st.t - (st.fatT[tk.uid] ?? -9)) / 0.7) : 0;
    const shake = st.shake > 0 ? Math.sin(st.t * 60) * st.shake * 6 : 0;
    drawBowl(ctx, BOWL.x + shake, BOWL.y, R0, { fill: tk ? tk.fill : 0, fat: fat > 0 ? 1 - (1 - fat) ** 3 : 0, rimCol: bowlRim('#3a6ea5'), t, mixed: tk?.mixed, waves: st.waves });
    if (tk && tk.fill > FILL.hi + 0.08) { circle(BOWL.x, BOWL.y, R0 + 20); ctx.fillStyle = 'rgba(241,199,104,0.25)'; ctx.fill(); }
    // the fill line: a gold ring where the broth should reach
    ctx.setLineDash([14, 10]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(200,140,30,0.85)';
    circle(BOWL.x, BOWL.y, brad((FILL.lo + FILL.hi) / 2)); ctx.stroke(); ctx.setLineDash([]);
    // what's crossed the bridge: it drops in, splashes, settles and floats
    if (tk) for (const pc of st.pieces[tk.uid] || []) {
      const age = st.t - pc.born, fall = Math.min(1, age / 0.22);
      if (fall >= 1 && !pc.landed) {
        pc.landed = true;
        splashAt(st.drops, BOWL.x + pc.x, BOWL.y + pc.y, pc.p === 'noodles' ? 16 : 9, pc.p === 'noodles' ? 1.2 : 0.8, tk.fat ? '#f7c94a' : '#f3c46a');
        st.waves.push({ x: pc.x, y: pc.y, t: 0 }, { x: pc.x, y: pc.y, t: -0.15 });
        st.shake = pc.p === 'noodles' ? 0.8 : 0.35;
        const weight = { noodles: 196, pork: 330, fish: 350, ham: 300, egg: 440, jizong: 380, tofu: 400 }[pc.p] || 520;
        if (pc.p === 'noodles') foley('noodle_slide');
        else foley(weight < 450 ? 'plop_heavy' : 'plop_light');
        if (pc.hot && PARTS[pc.p].rank === 0) foley('sizzle', { delay: 0.12 });
      }
      const raw = PARTS[pc.p].rank === 0;
      const cook = raw ? (pc.hot ? Math.min(1, Math.max(0, (age - 0.25) / 1.6)) : 0) : 1;
      const bob = fall >= 1 ? Math.sin(st.t * 1.6 + pc.seed) * 1.5 : 0;
      const land = fall < 1 ? 1 - (1 - fall) ** 2 : 1;
      const squash = fall >= 1 && age < 0.4 ? 1 + Math.sin((age - 0.22) / 0.18 * Math.PI) * 0.08 : 1;
      const big = (pc.p === 'noodles' ? 2.3 : 1.55) * BOWL.r / 230;   // food you can see
      drawFood(ctx, pc.p, BOWL.x + pc.x, BOWL.y + pc.y - (1 - land) * 140 + bob, { rot: pc.rot + Math.sin(st.t * 0.3 + pc.seed) * 0.05, cook: pc.p === 'egg' ? Math.max(0.15, cook) : cook, s: big * (1 + (1 - land) * 0.35) * squash, variant: pc.seed });
      if (raw && pc.hot && cook > 0 && cook < 1) {                 // it cooks in front of you: bubbles and a wisp of steam
        for (let k = 0; k < 4; k++) { const q = (st.t * 1.4 + k / 4 + pc.seed) % 1; circle(BOWL.x + pc.x + Math.cos(k * 1.7) * 26, BOWL.y + pc.y + Math.sin(k * 1.7) * 16 - q * 10, 2 + q * 4); ctx.strokeStyle = `rgba(255,255,240,${0.8 * (1 - q)})`; ctx.lineWidth = 2; ctx.stroke(); }
        const q = (st.t * 0.8 + pc.seed) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - q) * (1 - cook)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(BOWL.x + pc.x, BOWL.y + pc.y - 10 - q * 60); ctx.quadraticCurveTo(BOWL.x + pc.x + 14, BOWL.y + pc.y - 30 - q * 60, BOWL.x + pc.x, BOWL.y + pc.y - 50 - q * 60); ctx.stroke();
      }
    }
    // steam only escapes when there's no oil seal
    if (tk && tk.fill > 0 && fat < 1 && tk.heat > 0.2) for (let i = 0; i < 4; i++) {
      const k = (t * 0.5 + i / 4) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * tk.heat * 0.7 * (1 - fat)})`; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); const sx = BOWL.x - 90 + i * 60; ctx.moveTo(sx, BOWL.y - 40 - k * 200); ctx.quadraticCurveTo(sx + 20, BOWL.y - 80 - k * 200, sx, BOWL.y - 120 - k * 200); ctx.stroke();
    }
    // the ladle pouring: a glossy amber stream that wobbles, rings where it lands
    if (st.pouring && tk) {
      const lx = BOWL.x - 150, ly = BOWL.y - 190, ex = BOWL.x - 30 + Math.sin(t * 9) * 6, ey = BOWL.y - 10;
      for (const [w, col] of [[20, 'rgba(200,130,40,0.9)'], [13, '#f3c46a'], [4, 'rgba(255,250,220,0.9)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx + 30, ly + 30); ctx.quadraticCurveTo(BOWL.x - 70 + Math.sin(t * 7) * 8, BOWL.y - 130, ex, ey); ctx.stroke();
      }
      if (Math.random() < 0.5) { st.waves.push({ x: ex - BOWL.x, y: ey - BOWL.y, t: 0 }); splashAt(st.drops, ex, ey, 1, 0.5); }
      let gr = ctx.createRadialGradient(lx - 14, ly - 14, 4, lx, ly, 60); gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(1, '#8a939f');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(lx, ly, 58, 42, 0.6, 0, P2); ctx.fill();
      rr(lx - 220, ly - 70, 200, 18, 9); inked(C.woodD, 4);
    }
    st.drops = drawSplash(ctx, st.drops, st.dt || 1 / 60);
    // thermometer: how hot it still is
    rr(THERMO.x, THERMO.y, 40, THERMO.h, 20); inked('#fbf7ff', 4);
    const heat = tk && tk.fill > 0 ? tk.heat : 0;
    rr(THERMO.x + 8, THERMO.y + 8 + (THERMO.h - 16) * (1 - heat), 24, (THERMO.h - 16) * heat, 12);
    ctx.fillStyle = heat > COOK_HEAT ? '#f0703a' : '#7fb8f0'; ctx.fill();
    circle(THERMO.x + 20, THERMO.y + THERMO.h + 18, 26); inked(heat > COOK_HEAT ? '#f0703a' : '#7fb8f0', 4);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; const cy = THERMO.y + 8 + (THERMO.h - 16) * (1 - COOK_HEAT); ctx.beginPath(); ctx.moveTo(THERMO.x - 12, cy); ctx.lineTo(THERMO.x + 52, cy); ctx.stroke(); ctx.setLineDash([]);
    label('hot', THERMO.x + 20, THERMO.y - 24, 26);
    // serve button (Good Pizza's green button)
    rr(SERVE.x, SERVE.y, SERVE.w, SERVE.h, 20); inked('#c9e98a', 6);
    rr(SERVE.x + 10, SERVE.y + 8, SERVE.w - 20, SERVE.h - 22, 14); ctx.fillStyle = '#b4dd6f'; ctx.fill();
    text('Serve ▶▶', SERVE.x + SERVE.w / 2, SERVE.y + SERVE.h / 2 - 2, 44, C.ink);
  }

  // ---------- overlays: tabs, tickets, chips, caption bar ----------
  function drawHud(t) {
    // view tabs
    for (const [i, [id, s]] of [['order', '🛎️ Order'], ['stove', '♨️ Stove'], ['build', '🍜 Build']].entries()) {
      const x = H.tabs.x + i * H.tabs.gap, on = st.view === id;
      const call = st.step && st.step.view === id && !on && !st.react;            // the next step is over there
      const bob = call ? Math.abs(Math.sin(t * 6)) * 10 : 0;
      rr(x, H.tabs.y + bob * 0.4, 160, 56, 16); inked(on ? '#ffd98a' : call ? '#fff0a8' : C.paper, call ? 7 : 5); text(s, x + 80, H.tabs.y + 29 + bob * 0.4, 32);
      if (call) { ctx.save(); ctx.translate(x + 80, H.tabs.y + 84 + bob); ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(0, 0); ctx.lineTo(22, 22); ctx.closePath(); inked('#ffd65a', 4); ctx.restore(); }
      const n = id === 'order' ? S.guests.filter(g => g.state === 'line').length : id === 'stove' ? S.baskets.filter(b => b.ticket && noodleRing(b.t).zone !== 'firm').length : S.tickets.filter(q => !q.served && q.noodles !== null).length;
      if (n) { circle(x + 152, H.tabs.y + 4, 18); inked(id === 'build' ? '#7fb8f0' : C.red, 3); text(String(n), x + 152, H.tabs.y + 5, 24, '#fff'); }
    }
    // chips: night, happiness, money (Good Pizza's top bar)
    const minutes = 19 * 60 + 30 + Math.floor(S.time * 1.5);
    const avg = S.results.length ? Math.round(S.results.reduce((a, r) => a + r.points, 0) / S.results.length) : 100;
    [[`🌙 ${Math.floor(minutes / 60) - 12}:${String(minutes % 60).padStart(2, '0')}PM`, H.chips[0]], [`${avg >= 80 ? '😊' : avg >= 60 ? '🙂' : '😟'} ${avg}%`, H.chips[1]]].forEach(([s, c]) => { rr(c.x, c.y, 180, 56, 10); inked('#8a3b3b', 4); rr(c.x + 8, c.y + 8, 164, 40, 6); ctx.fillStyle = C.paper; ctx.fill(); text(s, c.x + 90, c.y + 29, 30); });
    const M = H.money; rr(M.x, M.y, 220, 56, 10); inked('#8a3b3b', 4); rr(M.x + 8, M.y + 8, 204, 40, 6); ctx.fillStyle = C.paper; ctx.fill(); text(`💴 ¥${st.money}`, M.x + 110, M.y + 29, 32);
    // ticket receipts
    S.tickets.filter(q => !q.served).forEach((q, i) => {
      const x = H.tk.x + i * H.tk.gap, y = H.tk.y, on = q.uid === st.selected;
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
    if (!cap && st.step && !st.react) cap = st.step.view === st.view ? `Next: ${st.step.word}` : `Next: ${st.step.word} → ${{ order: '🛎️ Order', stove: '♨️ Stove', build: '🍜 Build' }[st.step.view]}`;
    if (!cap) {
      if (st.view === 'order') cap = st.bubble ? 'Listen to what they want. Not sure? Ask “What?”.' : S.guests.some(g => g.state === 'line') ? 'Next customer’s coming to the counter…' : 'Bowls to make! Off to the stove and the counter ♨️';
      if (st.view === 'stove') cap = S.baskets.some(b => b.ticket && noodleRing(b.t).zone === 'ready') ? 'Green! Tap the basket to lift the noodles.' : 'Drag fresh noodles into an empty basket. Lift on the green.';
      if (st.view === 'build') cap = !tk ? '👆 Pick a ticket at the top left.' : `${tk.uid} · “${tk.ask.say}”`;
    }
    ctx.fillStyle = 'rgba(255,248,236,0.96)'; ctx.fillRect(0, VH - 92, VW, 92);
    ctx.fillStyle = C.ink; ctx.fillRect(0, VH - 92, VW, 3);
    const lines = wrap(cap, VW - 120, 34).slice(0, 2);
    lines.forEach((l, i) => text(l, VW / 2, VH - 46 + (i - (lines.length - 1) / 2) * 36, 34));
  }

  // ------------------------------------------------------------ the loop
  let last = performance.now(), done = false;
  await new Promise(resolve => {
    let boil = null, simmer = null;
    function frame(now) {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      st.t += dt; st.dt = dt;
      tick(S, dt);
      for (const e of drainEvents(S)) if (e.type === 'arrive') { spawn(S.guests.find(g => g.uid === e.guest)); layout(); foley('bell_counter', { gain: 0.5 }); }
      // the kitchen's bed of sound: the stockpot roars on the stove, the bowl simmers on the counter
      const boiling = S.baskets.some(b => b.ticket);
      boil ||= foleyLoop('boil_loop', 0); simmer ||= foleyLoop('simmer_loop', 0);
      boil.set(st.view === 'stove' ? (boiling ? 0.9 : 0.5) : 0.12);
      simmer.set(st.view === 'build' && sel()?.fill ? 0.6 : 0);
      if (st.pouring && sel()) pour(S, st.selected, 'hen', dt * 0.42);
      // people walk to their spots, blink, get cross
      for (const p of Object.values(st.people)) {
        const dx = p.tx - p.x; p.x += Math.sign(dx) * Math.min(Math.abs(dx), 520 * dt);
        p.blinkT -= dt; p.blink = p.blinkT < 0.12; if (p.blinkT < 0) p.blinkT = 2 + Math.random() * 3;
        const g = S.guests.find(q => q.uid === p.uid);
        if (g && g.state !== 'served' && !p.react) p.mood = g.patience / g.maxPatience < 0.25 ? 'angry' : 'happy';
      }
      if (st.react) {
        const r = st.react, p = st.people[r.uid];
        if (Math.abs(p.x - O.cx) < 10 && !st.hero) {
          const t0 = r.t; r.t += dt;
          const cross = at => t0 < at && r.t >= at;
          if (cross(0.01)) sfx('whoosh');
          if (cross(0.6)) { p.mood = 'think'; note(392, 0.08, 'sine', 0.08); }
          if (cross(0.75)) foley('slurp');
          if (cross(1.3)) foley('slurp', { gain: 0.8 });
          if (cross(1.6)) { p.mood = r.mood; sfx(r.res.points >= 85 ? 'reveal' : r.res.points >= 65 ? 'ding' : 'fail'); }
          const hearts = r.res.points >= 85 ? 3 : r.res.points >= 65 ? 2 : 1;
          for (let i = 0; i < hearts; i++) if (cross(1.6 + i * 0.18)) note(660 + i * 220, 0.12, 'triangle', 0.14);
        }
        if (r.t > 3.4) { st.money += st.react.res.tip; foley('coin_drop'); p.react = false; p.leaving = true; p.tx = VW + 200; st.react = null; layout(); }
      }
      for (const [uid, p] of Object.entries(st.people)) if (p.leaving && p.x >= VW + 190) delete st.people[uid];
      if (!st.selected) st.selected = S.tickets.find(q => !q.served)?.uid || null;
      st.captionT -= dt;
      st.shake = Math.max(0, st.shake - dt * 3);
      if (!st.ptr.down) st.idleT += dt;
      st.step = nextStep();
      st.camX += (PANEL[st.view] * VW - st.camX) * Math.min(1, dt * 9);

      // draw
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(0, 0, cv.width, cv.height);
      const d = cv.width / innerWidth;
      ctx.setTransform(scale * d, 0, 0, scale * d, ox * d, oy * d);
      ctx.fillStyle = checker; ctx.fillRect(-ox / scale, -oy / scale, innerWidth / scale, innerHeight / scale);   // no dead bands on tall phones
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
      ctx.save(); ctx.translate(-st.camX, 0);
      if (st.camX < VW) drawOrder(st.t);
      if (st.camX > 0 && st.camX < 2 * VW) drawStove(st.t);
      if (st.camX > VW) drawBuild(st.t);
      for (const r of st.ripples) { r.t += dt; if (r.t > 0) { circle(r.x, r.y, 10 + r.t * 140); ctx.strokeStyle = r.col; ctx.globalAlpha = Math.max(0, 1 - r.t * 1.6); ctx.lineWidth = 5; ctx.stroke(); ctx.globalAlpha = 1; } }
      st.ripples = st.ripples.filter(r => r.t < 0.7);
      for (const q of st.pops) { q.t += dt; ctx.globalAlpha = Math.max(0, 1 - q.t / 1.6); label(q.s, q.x, q.y - q.t * 50, 38); ctx.globalAlpha = 1; }
      st.pops = st.pops.filter(q => q.t < 1.6);
      if (!st.react) drawGuide(st.step, st.t);
      // the dragged saucer, in the glove
      const w = toW({ x: st.ptr.vx, y: st.ptr.vy });
      if (st.drag?.kind === 'part') {
        const h = st.held, k = 1 - Math.exp(-dt * 22), px = h.x;
        h.x += (w.x - h.x) * k; h.y += (w.y - 40 - h.y) * k;
        h.rot += (((h.x - px) / Math.max(dt, 1e-3)) * 0.0008 - h.rot) * 0.2;
        ctx.globalAlpha = 0.3; ctx.fillStyle = '#4a2a1a'; ctx.beginPath(); ctx.ellipse(h.x + 18, h.y + 60, 40, 16, 0, 0, P2); ctx.fill(); ctx.globalAlpha = 1;
        const raw = PARTS[st.drag.part].rank === 0;
        drawFood(ctx, st.drag.part, h.x, h.y, { rot: h.rot, cook: st.drag.part === 'egg' ? 'shell' : raw ? 0 : 1, s: st.drag.part === 'noodles' ? 1.5 : 1.25, variant: st.drag.seed });
      }
      if (st.drag?.kind === 'coil') drawFood(ctx, 'noodles', w.x, w.y - 30, { s: 1.1, variant: 4 });
      ctx.restore();
      drawHud(st.t);
      if (st.hero) { st.hero.t += dt; drawHero(st.hero); if (st.hero.t > 2.2) { st.hero = null; foley('bowl_set'); } }
      if (st.ptr.show) hand(st.ptr.vx + 18, st.ptr.vy + 40, !!st.drag || st.pouring);
      // paper grain over everything
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.09; ctx.fillStyle = grain; ctx.fillRect(0, 0, VW, VH);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.restore();

      if (!done && (dayOver(S) && !st.react || G.skip)) { done = true; boil?.stop(0.6); simmer?.stop(0.6); resolve(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  // ---------- end of the night ----------
  const avg = S.results.length ? Math.round(S.results.reduce((a, r) => a + r.points, 0) / S.results.length) : 0;
  const hearts = S.results.reduce((a, r) => a + heartsFor(r.points), 0);
  const before = pagesFound().length;
  earn(S.tips, hearts);
  const newPages = pagesFound().slice(before);
  const card = document.createElement('div');
  card.className = 'k3-result';
  const render = () => {
    const pr = progress();
    card.innerHTML = `<div class="k-ticket night-card">
      <div class="row" style="justify-content:space-between"><b>🏮 ${esc(title)}</b><span class="k-total">💴 ${pr.coins}</span></div>
      <div class="night-guests">${S.results.map(r => `<span title="${esc(GUESTS[r.who].name)}">${GUESTS[r.who].ico}<i>${'❤️'.repeat(heartsFor(r.points))}${'🤍'.repeat(3 - heartsFor(r.points))}</i><small>+¥${r.tip}</small></span>`).join('')}</div>
      ${newPages.map(pg => `<div class="night-page">📜 <b>A page of Grandpa’s recipe book!</b><br>${esc(pg.text)}</div>`).join('')}
      <div class="night-shop">${ITEMS.map(it => {
        const own = owns(it.id), using = it.bowl && pr.bowl === it.id;
        return `<button data-buy="${it.id}" class="${own ? 'own' : pr.coins >= it.price ? 'can' : ''}${using ? ' using' : ''}"><b>${it.ico}</b><small>${esc(it.name)}</small><em>${own ? (it.bowl ? (using ? 'in use' : 'use') : '✓') : `¥${it.price}`}</em></button>`;
      }).join('')}</div>
      <p class="sub">❤️ ${pr.hearts} hearts · recipe pages ${pagesFound().length}/${PAGES.length}</p>
      <div class="row" style="justify-content:flex-end; margin-top:6px"><button class="btn-big" id="k-done">Close up</button></div>
    </div>`;
    card.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => {
      const id = bt.dataset.buy, it = ITEMS.find(i => i.id === id);
      if (owns(id)) { if (it.bowl) { useBowl(progress().bowl === id ? null : id); sfx('pop'); render(); } return; }
      if (buy(id)) { sfx('coin'); note(880, 0.15, 'triangle', 0.15); render(); } else sfx('bump');
    }));
    card.querySelector('#k-done').addEventListener('click', () => card.dispatchEvent(new Event('done')));
  };
  render();
  document.getElementById('ui').appendChild(card);
  if (newPages.length) sfx('reveal');
  if (!G.skip) await new Promise(res => card.addEventListener('done', res));
  card.remove();
  cv.remove();
  removeEventListener('resize', resize); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu);
  G.flags.frozen3d = false;
  G.busy--;
  G.money += S.tips;
  return { results: S.results, tips: S.tips, avg, stars: S.stars };
}

// test hook: where things are, in client pixels
export const SHOP2D = { BOWL, POT, OIL, TRASH, SERVE, BASKETS, COILS, binRect, get VW() { return VW; }, get VH() { return VH; } };
window.__shop2dLayout = SHOP2D;
