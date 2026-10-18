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
    set(BOWL, { x: BUILD + 720, y: 612, r: 192 }); set(POT, { x: BUILD + 205, y: 600, r: 130 }); set(OIL, { x: BUILD + 205, y: 360, r: 62 });
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
    set(BOWL, { x: BUILD + 450, y: 960, r: 190 }); set(POT, { x: BUILD + 175, y: 1330, r: 115 }); set(OIL, { x: BUILD + 400, y: 1340, r: 60 });
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
  setMusic('day');
  const cv = document.createElement('canvas');
  cv.className = 'shop2d';
  document.getElementById('ui').appendChild(cv);
  use(cv.getContext('2d'));
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
    relayout(innerWidth / innerHeight < 0.85);
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
    st.ptr.down = true; st.ptr.sx = v.x; st.ptr.sy = v.y; st.drag = null;
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
      if (inR(w, { x: COILS.x, y: COILS.y - COILS.h / 2, w: COILS.w, h: COILS.h })) { st.drag = { kind: 'coil' }; sfx('pop'); return; }
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
    pop('✨ Sealed: a coin-thick layer of oil', BOWL.x, BOWL.y - BOWL.r - 50, C.woodD);
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
    p.tx = O.cx; p.react = true;
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
        r.t += 1 / 60;
        const lines = wrap(r.line, B.w - 80, 36), h = speech(lines, 50);
        const pts = r.res.points;
        text(`${pts >= 90 ? '😍' : pts >= 80 ? '😋' : pts >= 60 ? '🙂' : '😕'}  ${pts}%   +¥${r.res.tip}`, B.x + 30, B.y + h - 34, 36, pts >= 80 ? C.greenD : C.ink, 'left');
      }
    }
  }

  function drawStove(t) {
    const X = STOVE;
    ctx.fillStyle = checker; ctx.fillRect(X, 0, VW, VH);
    // stovetop slab
    rr(SLAB.x, SLAB.y, SLAB.w, SLAB.h, 30); inked(C.cream, 6);
    rr(SLAB2.x, SLAB2.y, SLAB2.w, SLAB2.h, 40); inked('#5a5466', 6);
    // big pot of boiling water
    circle(STOVE_POT.x, STOVE_POT.y, STOVE_POT.r); inked(C.steelL, 8);
    circle(STOVE_POT.x, STOVE_POT.y, STOVE_POT.r - 26); inked('#cfe8f0', 5);
    const R = rng(3);
    for (let i = 0; i < 26; i++) { const a = R() * P2, d = R() * (STOVE_POT.r - 60), k = (t * (0.6 + R()) + R()) % 1; circle(STOVE_POT.x + Math.cos(a) * d, STOVE_POT.y + Math.sin(a) * d * 0.9, 4 + k * 10); ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.stroke(); }
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
    for (let i = 0; i < 6; i++) { const c = i % COILS.cols, rw = Math.floor(i / COILS.cols), rows = 6 / COILS.cols; piece('noodles', COILS.x + (c + 0.5) * COILS.w / COILS.cols, COILS.y - COILS.h / 2 + (rw + 0.5) * COILS.h / rows, i, 1, 0.95, i + 2); }
    label('Fresh rice noodles', COILS.x + COILS.w / 2, COILS.y + COILS.h / 2 + 40, 34);
    // noodles flying out of a basket
    for (const l of st.lifts) { l.t += 1 / 60; piece('noodles', l.x + l.t * 500, l.y - Math.sin(l.t * 3) * 260, l.t * 4, 1, 1.4 - l.t * 0.4, 3); }
    st.lifts = st.lifts.filter(l => l.t < 1);
  }

  function drawBuild(t) {
    const X = BUILD, tk = sel();
    ctx.fillStyle = checker; ctx.fillRect(X, 0, VW, VH);
    rr(BSLAB.x, BSLAB.y, BSLAB.w, BSLAB.h, 28); inked(C.cream, 6);           // the counter
    // saucer trays (Good Pizza's bins), two rows in crossing order
    for (const p of ROWS.flat()) {
      const r = binRect(p);
      rr(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 12); inked(C.steelL, 4);
      rr(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 8); inked('#fbf6ef', 3);
      const locked = p === 'noodles' && (!tk || tk.noodles === null);
      for (let k = 0; k < 6; k++) piece(p, r.x + r.w * 0.22 + (k % 3) * r.w * 0.28, r.y + 32 + Math.floor(k / 3) * 46, k * 1.7, p === 'egg' ? -1 : 0.0, 0.66, k + p.length);
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
      const x = H.tabs.x + i * H.tabs.gap, on = st.view === id;
      rr(x, H.tabs.y, 160, 56, 16); inked(on ? '#ffd98a' : C.paper, 5); text(s, x + 80, H.tabs.y + 29, 32);
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
    function frame(now) {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
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
        if (st.react.t > 3.2) { st.money += st.react.res.tip; sfx('coin'); p.react = false; p.leaving = true; p.tx = VW + 200; st.react = null; layout(); }
      }
      for (const [uid, p] of Object.entries(st.people)) if (p.leaving && p.x >= VW + 190) delete st.people[uid];
      if (!st.selected) st.selected = S.tickets.find(q => !q.served)?.uid || null;
      st.captionT -= dt;
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
export const SHOP2D = { BOWL, POT, OIL, TRASH, SERVE, BASKETS, COILS, binRect, get VW() { return VW; }, get VH() { return VH; } };
window.__shop2dLayout = SHOP2D;
