// Grandma's noodle shop, Papa's-style, on the 3D counter.
// What makes Papa's work (Flipline's own FAQ + the series' design):
//   • you choose where to be: three stations you can switch between any time
//   • orders overlap: guests keep arriving while you cook for others
//   • food keeps cooking while you're away (baskets ring when ready), so you plan
//   • every bowl is scored against its ticket (waiting, noodles, build), for tips,
//     points and Star Customers
// Here: ORDER (greet the queue, take tickets) · STOVE (two noodle baskets) ·
// BUILD (broth + toppings across the bridge, in order, then serve).
// The rules live in shopcore.js (pure logic, unit-tested); this file is the 3D
// stage, the hands and the feel.

import * as THREE from 'three';
import { G, esc } from './core.js';
import { W } from './world.js';
import { makeCharacter } from './characters.js';
import { emote, bark, beat } from './ui.js';
import { sfx, note, setMusic } from './audio.js';
import { hitstop } from './fx.js';
import { act } from './acting.js';
import { learn } from './lore.js';
import { GUESTS, PARTS, BROTHS, NIGHT1, FILL } from './shopdata.js';
import {
  createShop, takeOrder, startNoodles, liftNoodles, pour, addFat, addPart, undoPart, serve, tick, dayOver, drainEvents, noodleRing,
} from './shopcore.js';
import {
  begin, end, hudEl, STATIONS, POT, BOWL, TOP, KX, KZ, P, run, pickAt, planeAt, toScreen, burst, mesh, focus, TOPPING_ART, dish, pop, gauge,
} from './kitchen3d.js';

const BACK = KZ - 3.45;                     // where guests stand, behind the counter
const LINE_X = i => KX + 3.2 + i * 1.7;      // the queue at the order window (right)
const WAIT_X = i => KX - 4.6 + i * 1.6;      // waiting for their bowls (left, by the stove)
const BASKET_X = [POT.x - 0.5, POT.x + 0.5];
// the saucers, two rows to the right of the bowl: the order they cross the
// bridge reads left to right, top row then bottom (raw → cooked → flowers →
// greens → noodles), so the counter itself teaches the ritual
const ROWS = [['pork', 'fish', 'egg', 'ham', 'chrys', 'chilli'], ['pea', 'chives', 'tofu', 'jizong', 'noodles']];
const BINS = ROWS.flat();
const BIN_POS = p => { const r = ROWS.findIndex(row => row.includes(p)), i = ROWS[r].indexOf(p); return { x: KX + 1.35 + i * 0.88, z: KZ + 1.42 + r * 0.88 }; };
const JUGS = { hen: { x: KX - 1.55, z: KZ + 0.1, color: '#f2c96a' } };
const FAT = { x: KX - 1.45, z: KZ + 1.75 };
const POUR_RATE = 0.42;                    // bowl fill per second while you hold a jug

const LOOKS = {
  li: { skin: '#e8c4a0', shirt: '#7d8fa6', pants: '#4a4f5a', hair: '#e8e8e8', hairStyle: 'short', glasses: true, scale: 0.9 },
  student: { skin: '#f2cfae', shirt: '#4a7bd8', pants: '#2d3a4f', hair: '#3a2a20', hairStyle: 'spiky', glasses: true },
  kid: { skin: '#f6d2b0', shirt: '#ffb3c8', pants: '#4a4f5a', hair: '#3a2a20', hairStyle: 'pony', scale: 0.72 },
  auntie: { skin: '#f0c8a0', shirt: '#ff6fa8', pants: '#3a3a5a', hair: '#2a2a2a', hairStyle: 'bun', skirt: true, prop: 'fan', scale: 0.88 },
  lan: { skin: '#f2cfae', shirt: '#4a7bd8', pants: '#2d3a4f', hair: '#1a1a1a', hairStyle: 'pony', hat: 'cap', hatColor: '#4a7bd8' },
};

// a little art for the toppings the bins hold
const ART = {
  ...TOPPING_ART,
  pork: () => TOPPING_ART.meat(),
  // paper-thin black fish: pearly white with a grey edge
  fish: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = mesh(new THREE.BoxGeometry(0.4, 0.03, 0.2), '#f6f1ea', (i - 1) * 0.08, 0.02 * i, 0, { parent: g, ink: false }); m.rotation.y = i * 0.5 - 0.4; mesh(new THREE.BoxGeometry(0.4, 0.032, 0.03), '#9aa0aa', 0, 0, 0.1, { parent: m, ink: false }); } return g; },
  // quail eggs: small, cream, freckled
  egg: () => { const g = new THREE.Group(); for (const [x, z] of [[-0.12, 0], [0.1, 0.06], [0, -0.1]]) { const e = mesh(new THREE.SphereGeometry(0.085, 10, 8), '#efe2c8', x, 0.05, z, { parent: g, ink: false }); e.scale.y = 1.25; for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.018, 5, 4), '#6b4a32', Math.cos(k * 2) * 0.07, 0.02 + k * 0.025, Math.sin(k * 2) * 0.07, { parent: e, ink: false }); } return g; },
  // Xuanwei ham: deep red with a white rind of fat
  ham: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), '#b3343a', (i - 1) * 0.1, 0.03 * i, 0, { parent: g, ink: false }); m.rotation.y = i; mesh(new THREE.BoxGeometry(0.3, 0.052, 0.04), '#fbefe4', 0, 0, 0.1, { parent: m, ink: false }); } return g; },
  // chrysanthemum petals, scattered gold
  chrys: () => { const g = new THREE.Group(); for (let i = 0; i < 14; i++) { const p = mesh(new THREE.SphereGeometry(0.05, 6, 4), i % 3 ? '#ffd23f' : '#ffe680', (Math.random() - 0.5) * 0.4, 0.03, (Math.random() - 0.5) * 0.3, { parent: g, ink: false }); p.scale.set(1.6, 0.3, 0.6); p.rotation.y = Math.random() * 3; } return g; },
  pea: () => { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const l = mesh(new THREE.SphereGeometry(0.07, 8, 6), i % 2 ? '#7bd36a' : '#5fbf4e', (Math.random() - 0.5) * 0.35, 0.04, (Math.random() - 0.5) * 0.25, { parent: g, ink: false }); l.scale.set(1.4, 0.4, 0.9); } return g; },
  // jizong: tall white-stemmed wild mushrooms with brown caps
  jizong: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.13; mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 6), '#efe5d2', x, 0.11, 0, { parent: g, ink: false }); mesh(new THREE.ConeGeometry(0.08, 0.07, 10), '#8a6244', x, 0.25, 0, { parent: g, ink: false }); } return g; },
  // a saucer of red chilli oil
  chilli: () => { const g = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 18), '#c9301d', 0, 0.03, 0, { parent: g, ink: false }); for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.03, 5, 4), '#5a1a10', (Math.random() - 0.5) * 0.35, 0.05, (Math.random() - 0.5) * 0.35, { parent: g, ink: false }); return g; },
  tofu: () => { const g = new THREE.Group(); for (let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22), '#f3dfa2', 0, 0.02 + i * 0.04, 0, { parent: g, ink: false }).rotation.y = i * 0.7; return g; },
};

export async function shopService({ schedule = NIGHT1, title = 'Old Zhao’s · reopening night' } = {}) {
  // stations for service: everything happens behind/at the counter
  STATIONS.order = { x: KX + 4.4, z: KZ - 2.4, w: 3.4, h: 2.4, hostX: KX - 6.4, lookY: 1.2, tilt: 3.2 };
  STATIONS.stove = { x: POT.x + 0.6, z: KZ - 1.2, w: 3.2, h: 3.0, hostX: KX - 6.4 };
  STATIONS.build = { x: KX + 1.9, z: KZ + 0.9, w: 4.4, h: 2.7, hostX: KX - 6.4 };
  const K = begin({ steps: [], host: 'gran', station: 'order' });
  setMusic('day');
  const S = createShop(schedule, { baskets: 2 });
  const hud = hudEl();
  hud.classList.add('service');
  hud.insertAdjacentHTML('beforeend', `
    <div class="svc-rail"></div>
    <div class="svc-tabs">
      <button data-st="order">🛎️ Order<i></i></button>
      <button data-st="stove">♨️ Stove<i></i></button>
      <button data-st="build">🍜 Build<i></i></button>
    </div>
    <div class="svc-rings"></div>
    <div class="svc-build hidden"><button class="btn-soft" data-a="undo">↩ Undo</button><button class="btn-big" data-a="serve">Serve 🍜</button></div>
    <div class="svc-money">💰 <b>0</b></div>
    <div class="svc-title">${esc(title)}</div>
    <div class="svc-help"></div>
    <div class="svc-labels"></div>
    <button class="svc-rules-btn" title="Grandma's rules">📜</button>`);
  const rail = hud.querySelector('.svc-rail'), rings = hud.querySelector('.svc-rings'), buildBar = hud.querySelector('.svc-build');
  let station = 'order', selected = null, shown = { money: 0 };
  const go = st => {
    if (station === st) return;
    station = st;
    focus(st);
    sfx('pop');
    hud.querySelectorAll('.svc-tabs button').forEach(b => b.classList.toggle('on', b.dataset.st === st));
    buildBar.classList.toggle('hidden', st !== 'build');
    renderBowl();
  };
  hud.querySelectorAll('.svc-tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.st)));
  hud.querySelector('[data-st="order"]').classList.add('on');

  // ---------- 3D props for service ----------
  const props = [];
  const add = o => { props.push(o); return o; };
  // two noodle baskets in the big pot
  const baskets = BASKET_X.map((x, i) => {
    const g = new THREE.Group();
    mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 24).rotateX(Math.PI / 2), '#9aa0a8', 0, 0, 0, { parent: g });
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), '#8a5a3b', 0, 0.55, -0.35, { parent: g }).rotation.x = -0.5;
    const tangle = mesh(new THREE.TorusKnotGeometry(0.22, 0.05, 64, 6, 3, 5), '#fffaf0', 0, 0.02, 0, { parent: g, ink: false });
    tangle.scale.y = 0.4; tangle.visible = false;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 12), new THREE.MeshBasicMaterial({ visible: false }));
    g.add(hit);
    g.userData = { pick: `basket${i}`, tangle };
    g.position.set(x, TOP + 1.12, POT.z);
    W.scene.add(g); add(g);
    return g;
  });
  K.potBroth.material.color.set('#d9ecf5');
  K.board.visible = false;
  // broth jugs
  for (const [id, j] of Object.entries(JUGS)) {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.7, 18), '#c9ced6', 0, 0.35, 0, { parent: g });
    mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 18), j.color, 0, 0.68, 0, { parent: g, ink: false });
    mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), '#9aa0a8', 0.45, 0.5, 0, { parent: g }).rotation.z = -0.6;
    g.userData.pick = `broth:${id}`;
    g.position.set(j.x, TOP, j.z);
    W.scene.add(g); add(g);
  }
  // the chicken-fat jar: a spoon seals the heat in (Mr Li's wife's trick)
  const fatJar = (() => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 18), '#fff3c4', 0, 0.25, 0, { parent: g });
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 18), '#c98a0e', 0, 0.55, 0, { parent: g });
    mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), '#9aa0a8', 0.12, 0.7, 0, { parent: g }).rotation.z = -0.3;
    g.userData.pick = 'fat';
    g.position.set(FAT.x, TOP, FAT.z);
    W.scene.add(g); add(g);
    return g;
  })();
  // the line on the bowl: fill to here
  const fillLine = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.018, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.85 }));
  fillLine.position.y = 0.12 + ((FILL.lo + FILL.hi) / 2) * 0.42;
  fillLine.visible = false;
  K.bowl.add(fillLine); props.push(fillLine);
  const level = f => 0.12 + Math.min(f, 1.05) * 0.42;
  // topping bins along the front of the counter
  const bins = BINS.map((p, i) => {
    const g = dish(ART[p] || ART.chives);
    g.scale.setScalar(0.95);
    g.userData.pick = `part:${p}`;
    const q = BIN_POS(p);
    g.position.set(q.x, TOP, q.z);
    W.scene.add(g); add(g);
    return g;
  });
  // the bowl's contents for the selected ticket
  const bowlStuff = K.bowlStuff;
  function renderBowl() {
    bowlStuff.clear();
    const t = S.tickets.find(x => x.uid === selected && !x.served);
    fillLine.visible = station === 'build' && !!t;
    K.bowlBroth.visible = !!t && t.fill > 0;
    if (!t) { K.oilLayer.material.opacity = 0; return; }
    if (t.broth) K.bowlBroth.material.color.set(t.mixed ? '#b08a5a' : BROTHS[t.broth].color);
    const y = level(t.fill), sc = 0.62 + Math.min(t.fill, 1) * 0.36;
    K.bowlBroth.position.y = y; K.bowlBroth.scale.setScalar(sc);
    K.oilLayer.position.y = y + 0.01; K.oilLayer.scale.setScalar(sc);
    K.oilLayer.material.opacity = t.fat ? 0.6 : t.fill > 0 ? 0.12 : 0;
    bowlStuff.position.y = y + 0.02;
    t.parts.forEach((p, i) => {
      const a = (ART[p] || ART.chives)();
      const ang = i * 2.1;
      a.position.set(Math.cos(ang) * 0.35 * (i ? 1 : 0.2), 0.01 + i * 0.012, Math.sin(ang) * 0.3 * (i ? 1 : 0.2));
      a.scale.setScalar(0.85);
      bowlStuff.add(a);
    });
  }

  // ---------- guests ----------
  const people = {};   // uid → { char, x, tx }
  function spawnGuest(g) {
    const c = makeCharacter({ ...LOOKS[g.who] });
    c.root.position.set(KX + 9, 0.85, BACK);
    c.root.userData.pick = `guest:${g.uid}`;
    W.scene.add(c.root);
    people[g.uid] = { char: c, tx: KX + 9 };
    c.setFace('happy');
    emote(c, '👋', 1.2);
  }
  function layout() {
    const line = S.guests.filter(g => g.state === 'line');
    const waiting = S.guests.filter(g => g.state === 'waiting');
    line.forEach((g, i) => { people[g.uid].tx = LINE_X(i); });
    waiting.forEach((g, i) => { people[g.uid].tx = WAIT_X(i); });
  }

  // ---------- the rail of tickets ----------
  // tickets update in place (re-creating them every frame would eat clicks)
  const tix = new Map();
  function renderRail() {
    const open = S.tickets.filter(t => !t.served);
    for (const [uid, el] of tix) if (!open.some(t => t.uid === uid)) { el.remove(); tix.delete(uid); }
    for (const t of open) {
      const g = S.guests.find(x => x.uid === t.guest);
      const pat = g.patience / g.maxPatience;
      const heat = t.fill > 0 ? `<span class="tk-heat" title="heat"><i style="width:${Math.round(t.heat * 10) * 10}%"></i></span>${t.fat ? '✨' : ''}` : '';
      const html = `<div class="tk-head"><b>${t.uid}</b> ${GUESTS[g.who].ico}<span class="tk-pat"><i style="width:${Math.round(pat * 50) * 2}%; background:${pat > 0.5 ? '#49b26a' : pat > 0.25 ? '#f0b429' : '#e2574c'}"></i></span></div>
        <div class="tk-say">“${esc(t.ask.say)}”</div>
        <div class="tk-row">${t.parts.map(p => PARTS[p].ico).join('') || '<i>empty bowl</i>'}</div>
        <div class="tk-noodle">${t.noodles === null ? (S.baskets.some(b => b.ticket === t.uid) ? '♨️ cooking…' : '🍜 noodles not started') : '🍜 ready ✓'} ${heat}</div>`;
      let el = tix.get(t.uid);
      if (!el) { el = document.createElement('button'); el.className = 'svc-ticket'; el.dataset.t = t.uid; rail.appendChild(el); tix.set(t.uid, el); }
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      el.classList.toggle('sel', t.uid === selected);
    }
  }
  rail.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    selected = b.dataset.t;
    sfx('pop');
    renderRail(); renderBowl();
  });

  // ---------- timer rings over the baskets ----------
  rings.innerHTML = BASKET_X.map((_, i) => `<div class="svc-ring hidden" data-b="${i}"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="zone"/><circle cx="20" cy="20" r="16" class="fill"/></svg><b></b></div>`).join('');
  const C = 2 * Math.PI * 16;
  function renderRings() {
    S.baskets.forEach((b, i) => {
      const el = rings.children[i];
      if (!b.ticket || station !== 'stove') { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      const r = noodleRing(b.t);
      const s = toScreen(BASKET_X[i], TOP + 2.3, POT.z);
      el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
      const [fill, zone] = [el.querySelector('.fill'), el.querySelector('.zone')];
      fill.style.strokeDasharray = `${r.v * C} ${C}`;
      fill.style.stroke = r.zone === 'firm' ? '#5aa8ff' : r.zone === 'ready' ? '#49b26a' : '#e2574c';
      zone.style.strokeDasharray = `0 ${r.lo * C} ${(r.hi - r.lo) * C} ${C}`;
      el.querySelector('b').textContent = b.ticket;
      el.classList.toggle('ready', r.zone === 'ready');
    });
  }
  // tab badges: what needs you
  function renderBadges() {
    const lineN = S.guests.filter(g => g.state === 'line').length;
    const readyN = S.baskets.filter(b => b.ticket && noodleRing(b.t).zone !== 'firm').length;
    const buildN = S.tickets.filter(t => !t.served && t.noodles !== null).length;
    const set = (st, n, hot) => { const i = hud.querySelector(`[data-st="${st}"] i`); i.textContent = n || ''; i.className = n ? (hot ? 'hot' : 'on') : ''; };
    set('order', lineN, lineN > 0);
    set('stove', readyN, readyN > 0);
    set('build', buildN, false);
  }

  // one line that says what this station needs right now (the reason to act)
  const helpEl = hud.querySelector('.svc-help');
  function renderHelp() {
    const t = selectedTicket();
    const line = S.guests.some(g => g.state === 'line');
    const needNoodles = S.tickets.some(q => !q.served && q.noodles === null && !S.baskets.some(b => b.ticket === q.uid));
    const freeBasket = S.baskets.some(b => !b.ticket);
    const ready = S.baskets.some(b => b.ticket && noodleRing(b.t).zone !== 'firm');
    let h = '';
    if (station === 'order') h = line ? '👆 Tap a customer to take their order' : S.tickets.some(q => !q.served) ? 'No one in line. Go cook! ♨️' : 'Waiting for customers…';
    if (station === 'stove') h = ready ? '✅ Green ring! Tap the basket to lift' : needNoodles && freeBasket ? '👆 Tap an empty basket to cook noodles for the chosen ticket' : S.baskets.some(b => b.ticket) ? 'Lift when the ring is in the green. Go do something else meanwhile!' : 'Nothing to cook. Take an order 🛎️';
    if (station === 'build') h = !t ? '👆 Pick a ticket at the top' : !t.broth ? '✋ Hold the broth jug. Stop at the gold line' : !t.fat && t.parts.length === 0 ? '✨ Seal it with chicken oil, then the saucers, raw first' : t.noodles === null ? 'Noodles aren’t ready yet. Stove ♨️' : '✋ Drag the saucers in: raw → ham → flowers → greens → noodles last';
    if (line && station !== 'order') h = '🛎️ Someone’s at the window! · ' + h;
    if (helpEl.textContent !== h) helpEl.textContent = h;
  }

  // ---------- intents from the 3D hands ----------
  function selectedTicket() { return S.tickets.find(x => x.uid === selected && !x.served); }
  function onTap(x, y) {
    if (station === 'order') {
      const o = pickAt(x, y, Object.values(people).map(p => p.char.root));
      if (!o) return;
      const uid = o.userData.pick.slice(6);
      const g = S.guests.find(q => q.uid === uid);
      if (!g || g.state !== 'line') return;
      const t = takeOrder(S, uid);
      selected = t.uid;
      const c = people[uid].char;
      bark(c, t.ask.say, 4.2);
      if (/Zhuangyuan|Xiucai|Juren/.test(t.ask.say)) learn('tiers');
      c.setFace('happy');
      sfx('ding');
      layout(); renderRail();
      const s = toScreen(c.root.position.x, 3.6, BACK); pop('Ticket!', s.x, s.y);
      return;
    }
    if (station === 'stove') {
      const o = pickAt(x, y, baskets);
      if (!o) return;
      const i = Number(o.userData.pick.slice(6));
      const b = S.baskets[i];
      if (b.ticket) {
        const score = liftNoodles(S, i);
        o.userData.tangle.visible = false;
        sfx('splash'); hitstop(50);
        burst(BASKET_X[i], TOP + 1.4, POT.z, 10, '#d9ecf5', { up: 3 });
        const s = toScreen(BASKET_X[i], TOP + 2, POT.z);
        pop(score >= 0.95 ? 'Perfect!' : score >= 0.7 ? 'Good' : score < 0.6 ? 'Too firm…' : 'A bit soft', s.x, s.y, score >= 0.95 ? 'gold' : '');
        renderRail();
        return;
      }
      // start the selected ticket, or the oldest one still needing noodles
      const t = selectedTicket()?.noodles === null && !S.baskets.some(q => q.ticket === selected) ? selectedTicket()
        : S.tickets.find(q => !q.served && q.noodles === null && !S.baskets.some(z => z.ticket === q.uid));
      if (!t) { const s = toScreen(BASKET_X[i], TOP + 2, POT.z); pop('No ticket needs noodles', s.x, s.y); sfx('bump'); return; }
      startNoodles(S, i, t.uid);
      o.userData.tangle.visible = true;
      sfx('splash');
      burst(BASKET_X[i], TOP + 1.3, POT.z, 6, '#ffffff', { up: 2 });
      renderRail();
      return;
    }
    if (station === 'build') {
      const o = pickAt(x, y, [fatJar]);
      if (!o) return;
      const t = selectedTicket();
      if (!t) { pop('Pick a ticket first ↑', x, y); sfx('bump'); return; }
      if (!t.broth) { pop('Broth first!', x, y - 30, 'bad'); sfx('bump'); return; }
      if (!addFat(S, t.uid)) return;
      sfx('sizzle'); note(880, 0.2, 'sine', 0.08);
      burst(BOWL.x, TOP + 0.7, BOWL.z, 12, '#ffd76a', { up: 1.5, speed: 1.5 });
      pop('✨ A coin-thick seal of chicken oil', x, y - 40, 'gold');
      learn('seal');
      renderBowl(); renderRail();
    }
  }

  // ---------- the hands: hold to pour, drag to drop ----------
  let hold = null;           // { kind: 'pour', broth, jug } | { kind: 'drag', part, ghost, bin, sx, sy }
  function onDown(x, y) {
    if (station !== 'build') return;
    const o = pickAt(x, y, [...props.filter(p => p.userData.pick?.startsWith('broth:')), ...bins]);
    if (!o) return;
    const t = selectedTicket();
    if (!t) { pop('Pick a ticket first ↑', x, y); sfx('bump'); return; }
    const [kind, id] = o.userData.pick.split(':');
    if (kind === 'broth') { hold = { kind: 'pour', broth: id, jug: o, t: 0 }; sfx('splash'); return; }
    const ghost = (ART[id] || ART.chives)();
    ghost.scale.setScalar(1.3);
    ghost.position.copy(o.position).add(new THREE.Vector3(0, 0.5, 0));
    W.scene.add(ghost);
    hold = { kind: 'drag', part: id, ghost, bin: o, sx: x, sy: y };
    o.scale.setScalar(1.12);
    sfx('pop');
  }
  function onUp(x, y) {
    if (!hold) return;
    const h = hold; hold = null;
    if (h.kind === 'pour') {
      h.jug.rotation.z = 0;
      gauge(null);
      const t = selectedTicket();
      if (!t) return;
      const s2 = toScreen(BOWL.x, TOP + 1.3, BOWL.z);
      learn('broth');
      if (t.fill >= FILL.lo && t.fill <= FILL.hi) { pop('Right on the line!', s2.x, s2.y, 'gold'); sfx('ding'); }
      else if (t.fill > FILL.hi) { pop('Spilling over!', s2.x, s2.y, 'bad'); sfx('bump'); }
      else pop('A bit more…', s2.x, s2.y);
      renderRail();
      return;
    }
    // a drop: anywhere near the bowl counts; a quick tap on a bin drops one too
    W.scene.remove(h.ghost);
    h.bin.scale.setScalar(0.95);
    const tap = Math.hypot(x - h.sx, y - h.sy) < 14;
    const p = h.ghost.position;
    const inBowl = tap || Math.hypot(p.x - BOWL.x, p.z - BOWL.z) < BOWL.r + 0.45;
    if (!inBowl) { sfx('bump'); return; }
    const t = selectedTicket();
    if (!t) return;
    if (!addPart(S, t.uid, h.part)) { const s2 = toScreen(BOWL.x, TOP + 1.3, BOWL.z); pop('Noodles aren’t cooked yet!', s2.x, s2.y, 'bad'); sfx('bump'); return; }
    if (PARTS[h.part].rank === 0) {
      const s3 = toScreen(BOWL.x, TOP + 1.7, BOWL.z);
      learn('raw');
      if (t.heat >= 0.55) pop('Tssss… cooked in seconds', s3.x, s3.y - 30, 'gold');
      else { pop('…it won’t cook. Too cold!', s3.x, s3.y - 30, 'bad'); }
    }
    if (h.part === 'chrys') learn('chrys');
    sfx('splash'); note(520 + t.parts.length * 70, 0.12, 'sine', 0.1);
    burst(BOWL.x, TOP + 0.7, BOWL.z, 6, t.broth ? BROTHS[t.broth].color : '#ffffff', { up: 2, speed: 1.4 });
    const s2 = toScreen(BOWL.x, TOP + 1.4, BOWL.z);
    pop(`+ ${PARTS[h.part].ico}`, s2.x, s2.y);
    renderBowl(); renderRail();
  }
  function onHold(dt) {
    if (!hold) return;
    if (hold.kind === 'pour') {
      const t = selectedTicket();
      if (!t) return;
      pour(S, t.uid, hold.broth, dt * POUR_RATE);
      hold.jug.rotation.z = Math.min(0.9, hold.jug.rotation.z + dt * 4);
      // a stream from the jug's spout into the bowl
      const j = hold.jug.position;
      if (Math.random() < 0.8) burst(j.x + (BOWL.x - j.x) * 0.55, TOP + 1.2, j.z + (BOWL.z - j.z) * 0.55, 2, BROTHS[hold.broth].color, { up: -1, speed: 0.6, r: 0.06, life: 0.4 });
      gauge(t.fill / 1.2, FILL.lo / 1.2, FILL.hi / 1.2, t.fill > FILL.hi ? 'Too much!' : t.fill >= FILL.lo ? 'Stop!' : 'Pour…');
      renderBowl();
    } else {
      const q = planeAt(P.x, P.y, TOP + 0.9);
      if (q) hold.ghost.position.lerp(q, 0.5);
      hold.ghost.rotation.y += dt * 2;
    }
  }

  buildBar.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const t = selectedTicket();
    if (!a || !t) return;
    if (a === 'undo') { undoPart(S, t.uid); sfx('pop'); renderBowl(); renderRail(); return; }
    const res = serve(S, t.uid);
    if (!res) { pop('Needs broth and toppings first', innerWidth / 2, innerHeight - 140, 'bad'); sfx('bump'); return; }
    // the bowl slides to the guest; they react
    const p = people[t.guest];
    const c = p.char;
    sfx(res.points >= 80 ? 'reveal' : res.points >= 60 ? 'ding' : 'fail');
    c.setFace(res.points >= 80 ? 'happy' : res.points >= 60 ? 'normal' : 'sad');
    emote(c, res.points >= 90 ? '😍' : res.points >= 80 ? '😋' : res.points >= 60 ? '🙂' : '😕', 1.8);
    if (res.points >= 80) act(c, 'bounce');
    const s = toScreen(BOWL.x, TOP + 1.5, BOWL.z);
    // they tell you what they noticed: the worst thing first, or the best
    const notes = res.judge.notes;
    const bad = notes.find(n => !n.ok), good = notes.filter(n => n.ok);
    if (notes.some(n => n.ok && /in order/.test(n.text))) learn('order');
    bark(c, bad ? bad.text : good.length ? `Mm! ${good.map(n => n.text).slice(0, 2).join(' · ')}` : 'Mm!', 3.2);
    notes.slice(0, 4).forEach((n, i) => setTimeout(() => pop(`${n.ok ? '✓' : '✗'} ${n.text}`, s.x + (i % 2 ? 90 : -90), s.y - 40 - i * 34, n.ok ? '' : 'bad'), 250 + i * 260));
    pop(`${res.points} pts · ¥${res.tip}`, s.x, s.y, res.points >= 80 ? 'gold' : '');
    if (res.stars && res.points >= 80) setTimeout(() => pop(`⭐ Star ${res.stars}`, s.x, s.y - 200, 'gold'), 1300);
    burst(BOWL.x, TOP + 1, BOWL.z, 16, '#ffd23f', { up: 4 });
    p.leaving = true;
    p.tx = KX - 10;
    setTimeout(() => act(c, null), 1500);
    selected = S.tickets.find(q => !q.served)?.uid || null;
    renderBowl(); renderRail();
  });

  // labels under every bin and jug, so you can read the counter at a glance
  const labelsEl = hud.querySelector('.svc-labels');
  const LABELS = [
    ...BINS.map(p => { const q = BIN_POS(p), top = ROWS[0].includes(p); return { text: `${PARTS[p].ico} ${PARTS[p].short}`, x: q.x, y: TOP + (top ? 0.25 : 0), z: q.z + (top ? -0.52 : 0.5) }; }),
    { text: '🐔 old hen broth', x: JUGS.hen.x, y: TOP + 1.05, z: JUGS.hen.z },
    { text: '✨ chicken oil', x: FAT.x, y: TOP + 0.95, z: FAT.z },
  ];
  labelsEl.innerHTML = LABELS.map(l => `<span>${esc(l.text)}</span>`).join('');
  function renderLabels() {
    labelsEl.style.display = station === 'build' ? '' : 'none';
    if (station !== 'build') return;
    LABELS.forEach((l, i) => { const q = toScreen(l.x, l.y, l.z); const e = labelsEl.children[i]; e.style.left = `${q.x}px`; e.style.top = `${q.y}px`; });
  }

  // dev/test hook
  window.__shop = { S, go, people, baskets, bins, fatJar, get station() { return station; }, get selected() { return selected; } };

  // ---------- Grandma's rules: the real ritual, on a card by the stove ----------
  const RULES = `<div class="k-ticket svc-rules-card">
    <b>📜 Grandma’s rules · 过桥米线</b>
    <ol>
      <li><b>The broth.</b> Old hen and pork bones, four hours on the fire, never a drop of water added. Pour it scalding, up to the line.</li>
      <li><b>The seal.</b> A coin-thick layer of chicken oil on top. No steam shows, but underneath it stays hotter than 95°C. That’s what crosses the bridge.</li>
      <li><b>Raw first.</b> Paper-thin pork loin, black fish, quail egg, while it’s hottest. They cook in seconds. In cold broth, they don’t.</li>
      <li><b>Then cooked, flowers, greens.</b> Xuanwei ham, chrysanthemum petals, pea shoots, chives, tofu skin, jizong.</li>
      <li><b>Noodles last.</b> Always.</li>
    </ol>
    <p class="sub">Chilli oil is a saucer, not the broth. And listen to what they ask for: a Xiucai set is small, a Zhuangyuan set is the whole feast.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn-big" data-go>Open the hatch 🏮</button></div>
  </div>`;
  async function showRules(blocking) {
    const el = document.createElement('div');
    el.className = 'k3-result svc-rules';
    el.innerHTML = RULES;
    hud.appendChild(el);
    sfx('pop');
    await new Promise(res => el.querySelector('[data-go]').addEventListener('click', res));
    el.remove();
  }
  hud.querySelector('.svc-rules-btn').addEventListener('click', () => showRules(false));
  if (!G.flags.rulesSeen) { G.flags.rulesSeen = true; await showRules(true); }
  learn('feast');

  // ---------- the service loop ----------
  K.pickables = [];
  let railT = 0;
  await run((dt, t, evs) => {
    tick(S, dt);
    for (const e of drainEvents(S)) {
      if (e.type === 'arrive') { spawnGuest(S.guests.find(g => g.uid === e.guest)); layout(); sfx('beep'); }
    }
    for (const e of evs) {
      if (e.type === 'down') onDown(e.x, e.y);
      if (e.type === 'up') onUp(e.x, e.y);
      if (e.type === 'tap' && !(station === 'build' && pickAt(e.x, e.y, bins))) onTap(e.x, e.y);
    }
    onHold(dt);
    // steam off the bowl shows how hot it still is
    const sel = selectedTicket();
    if (sel && sel.fill > 0 && Math.random() < sel.heat * 0.5) burst(BOWL.x + (Math.random() - 0.5) * 0.8, TOP + 0.7, BOWL.z + (Math.random() - 0.5) * 0.6, 1, '#ffffff', { up: 1.2, speed: 0.2, r: 0.08, g: -0.5, life: 1.1 });
    if (sel && sel.fill > 0 && Math.random() < 0.05) renderBowl();
    // people walk to their spots
    for (const [uid, p] of Object.entries(people)) {
      const pos = p.char.root.position, dx = p.tx - pos.x;
      if (Math.abs(dx) > 0.05) {
        const sp = 3.2; pos.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        p.char.root.rotation.y = Math.sign(dx) * Math.PI / 2;
        p.char.animate(dt, sp, t + pos.z);
      } else { p.char.root.rotation.y += (0 - p.char.root.rotation.y) * Math.min(1, dt * 6); p.char.animate(dt, 0, t); }
      if (p.leaving && pos.x < KX - 9.5) { W.scene.remove(p.char.root); delete people[uid]; }
      const g = S.guests.find(q => q.uid === uid);
      if (g && g.state !== 'served') {
        const pat = g.patience / g.maxPatience;
        if (pat < 0.25 && !p.cross) { p.cross = true; p.char.setFace('angry'); emote(p.char, '💢', 1.6); bark(K.gran, `Duck! ${GUESTS[g.who].name} is getting hungry!`, 2.2); }
      }
    }
    for (const [i, b] of S.baskets.entries()) {
      if (b.ticket && Math.random() < 0.15) burst(BASKET_X[i], TOP + 1.2, POT.z, 1, '#ffffff', { up: 1, speed: 0.3, r: 0.05, g: 1, life: 0.6 });
      const r = b.ticket ? noodleRing(b.t) : null;
      if (r && r.zone === 'ready' && !b.dinged) { b.dinged = true; sfx('ding'); }
      if (!b.ticket) b.dinged = false;
    }
    renderRings(); renderBadges(); renderHelp(); renderLabels();
    railT -= dt; if (railT <= 0) { railT = 0.25; renderRail(); }
    const money = hud.querySelector('.svc-money b');
    if (shown.money !== S.tips) { shown.money += Math.sign(S.tips - shown.money) * Math.max(1, Math.round(Math.abs(S.tips - shown.money) * 0.2)); money.textContent = shown.money; }
    if (dayOver(S) || G.skip) return true;
  });

  // ---------- end of service ----------
  await beat(1.0);
  const avg = S.results.length ? Math.round(S.results.reduce((a, r) => a + r.points, 0) / S.results.length) : 0;
  const card = document.createElement('div');
  card.className = 'k3-result';
  card.innerHTML = `<div class="k-ticket">
    <div class="row" style="justify-content:space-between"><b>🏮 Service over</b><span class="k-total">${avg} pts</span></div>
    ${S.results.map(r => `<div class="meter"><span style="width:170px; font-size:13px">${GUESTS[r.who].ico} ${esc(GUESTS[r.who].name)}</span>
      <div class="bar"><div class="fill" style="width:${r.points}%; background:${r.points >= 80 ? '#49b26a' : r.points >= 60 ? '#f0b429' : '#e2574c'}"></div></div><span class="val">¥${r.tip}</span></div>
      <p class="sub" style="margin:0 0 6px 0">${r.judge.notes.map(n => `${n.ok ? '✓' : '✗'} ${esc(n.text)}`).join(' · ')}</p>`).join('')}
    <p class="sub">Tips: ¥${S.tips} · ⭐ ${Object.values(S.stars).filter(n => n > 0).length} happy regulars</p>
    <div class="row" style="justify-content:flex-end; margin-top:10px"><button class="btn-big" id="k-done">Close up</button></div>
  </div>`;
  hud.appendChild(card);
  await new Promise(res => card.querySelector('#k-done').addEventListener('click', res));
  for (const o of props) W.scene.remove(o);
  for (const p of Object.values(people)) W.scene.remove(p.char.root);
  K.bowlBroth.visible = false;
  K.board.visible = true;
  hud.classList.remove('service');
  end();
  G.money += S.tips;
  return { results: S.results, tips: S.tips, avg, stars: S.stars };
}
