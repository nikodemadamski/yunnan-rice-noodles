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
import { MENU, GUESTS, PARTS, BROTHS, NIGHT1 } from './shopdata.js';
import {
  createShop, takeOrder, startNoodles, liftNoodles, setBroth, addPart, undoPart, serve, tick, dayOver, drainEvents, noodleRing,
} from './shopcore.js';
import {
  begin, end, hudEl, STATIONS, POT, BOWL, TOP, KX, KZ, run, pickAt, toScreen, burst, mesh, focus, TOPPING_ART, dish, pop,
} from './kitchen3d.js';

const BACK = KZ - 3.45;                     // where guests stand, behind the counter
const LINE_X = i => KX + 3.2 + i * 1.7;      // the queue at the order window (right)
const WAIT_X = i => KX - 4.6 + i * 1.6;      // waiting for their bowls (left, by the stove)
const BASKET_X = [POT.x - 0.5, POT.x + 0.5];
const BINS = ['meat', 'egg', 'ham', 'mushroom', 'tofu', 'chives', 'noodles'];
const BIN_X = i => KX - 1.9 + i * 0.86;
const BIN_Z = KZ + 1.75;
const JUGS = { hen: { x: KX - 1.2, z: KZ - 0.6, color: '#f2c14e' }, chilli: { x: KX + 1.4, z: KZ - 0.6, color: '#e0603a' } };

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
  ham: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), '#d9534f', (i - 1) * 0.1, 0.03 * i, 0, { parent: g, ink: false }).rotation.y = i; return g; },
  mushroom: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#a0703c', (i - 1) * 0.15, 0.05, 0, { parent: g, ink: false }); } return g; },
  tofu: () => { const g = new THREE.Group(); for (let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(0.34, 0.03, 0.22), '#f3dfa2', 0, 0.02 + i * 0.04, 0, { parent: g, ink: false }).rotation.y = i * 0.7; return g; },
};

export async function shopService({ schedule = NIGHT1, title = 'Old Zhao’s · reopening night' } = {}) {
  // stations for service: everything happens behind/at the counter
  STATIONS.order = { x: KX + 4.4, z: KZ - 2.4, w: 3.4, h: 2.4, hostX: KX - 6.4, lookY: 1.2, tilt: 3.2 };
  STATIONS.stove = { x: POT.x + 0.6, z: KZ - 1.2, w: 3.2, h: 3.0, hostX: KX - 6.4 };
  STATIONS.build = { x: KX + 0.3, z: KZ + 0.2, w: 3.5, h: 2.8, hostX: KX - 6.4 };
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
    <div class="svc-help"></div>`);
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
  // topping bins along the front of the counter
  const bins = BINS.map((p, i) => {
    const g = dish(ART[p] || ART.chives);
    g.scale.setScalar(0.95);
    g.userData.pick = `part:${p}`;
    g.position.set(BIN_X(i), TOP, BIN_Z);
    W.scene.add(g); add(g);
    return g;
  });
  // the bowl's contents for the selected ticket
  const bowlStuff = K.bowlStuff;
  function renderBowl() {
    bowlStuff.clear();
    const t = S.tickets.find(x => x.uid === selected);
    K.bowlBroth.visible = !!t?.broth;
    if (t?.broth) K.bowlBroth.material.color.set(BROTHS[t.broth].color);
    K.oilLayer.material.opacity = t?.broth ? 0.25 : 0;
    if (!t) return;
    t.parts.forEach((p, i) => {
      const a = (ART[p] || ART.chives)();
      const ang = i * 2.1;
      a.position.set(Math.cos(ang) * 0.35 * (i ? 1 : 0.2), 0.02 + i * 0.015, Math.sin(ang) * 0.3 * (i ? 1 : 0.2));
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
      const want = MENU[t.dish];
      const pat = g.patience / g.maxPatience;
      const done = p => t.parts.includes(p) ? 'done' : '';
      const html = `<div class="tk-head"><b>${t.uid}</b> ${GUESTS[g.who].ico}<span class="tk-pat"><i style="width:${Math.round(pat * 50) * 2}%; background:${pat > 0.5 ? '#49b26a' : pat > 0.25 ? '#f0b429' : '#e2574c'}"></i></span></div>
        <div class="tk-dish">${esc(want.name)}</div>
        <div class="tk-row"><span class="${t.broth === want.broth ? 'done' : t.broth ? 'bad' : ''}">${BROTHS[want.broth].ico}</span>
          ${want.parts.map((p, i) => `<span class="${done(p)}">${i + 1}${PARTS[p].ico}</span>`).join('')}</div>
        <div class="tk-noodle">${t.noodles === null ? (S.baskets.some(b => b.ticket === t.uid) ? '♨️ cooking…' : '🍜 noodles not started') : '🍜 ready ✓'}</div>`;
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
    if (station === 'build') h = !t ? '👆 Pick a ticket at the top' : t.noodles === null ? 'This bowl’s noodles aren’t ready. Stove ♨️' : !t.broth ? '👆 Broth first: tap the right jug' : '👆 Toppings in the ticket’s order (1, 2, 3…), then Serve';
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
      bark(c, GUESTS[g.who].line, 2.6);
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
      const t = selectedTicket();
      const o = pickAt(x, y, [...props.filter(p => p.userData.pick?.startsWith('broth:')), ...bins]);
      if (!o) return;
      if (!t) { pop('Pick a ticket first ↑', x, y); sfx('bump'); return; }
      const [kind, id] = o.userData.pick.split(':');
      if (kind === 'broth') {
        setBroth(S, t.uid, id);
        sfx('splash');
        burst(BOWL.x, TOP + 0.9, BOWL.z, 8, BROTHS[id].color, { up: 2 });
        pop(id === MENU[t.dish].broth ? `${BROTHS[id].ico} broth` : `${BROTHS[id].ico} …wrong broth?`, x, y - 30);
      } else {
        if (!addPart(S, t.uid, id)) { pop('Noodles aren’t cooked yet!', x, y - 30, 'bad'); sfx('bump'); return; }
        const want = MENU[t.dish].parts;
        const right = want[t.parts.length - 1] === id;
        sfx(right ? 'pop' : 'bump'); note(right ? 660 + t.parts.length * 90 : 220, 0.1, 'sine', 0.1);
        o.scale.setScalar(1.15); setTimeout(() => o.scale.setScalar(0.95), 120);
        burst(BOWL.x, TOP + 0.8, BOWL.z, 4, '#f2c46d', { up: 1.5 });
        pop(`+ ${PARTS[id].ico}`, x, y - 30, right ? '' : 'bad');
      }
      renderBowl(); renderRail();
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
    pop(`${res.points} pts · ¥${res.tip}`, s.x, s.y, res.points >= 80 ? 'gold' : '');
    if (res.stars && res.points >= 80) pop(`⭐ Star ${res.stars}`, s.x, s.y - 50, 'gold');
    burst(BOWL.x, TOP + 1, BOWL.z, 16, '#ffd23f', { up: 4 });
    p.leaving = true;
    p.tx = KX - 10;
    setTimeout(() => act(c, null), 1500);
    selected = S.tickets.find(q => !q.served)?.uid || null;
    renderBowl(); renderRail();
  });

  // dev/test hook
  window.__shop = { S, go, people, baskets, bins, get station() { return station; }, get selected() { return selected; } };

  // ---------- the service loop ----------
  K.pickables = [];
  let railT = 0;
  await run((dt, t, evs) => {
    tick(S, dt);
    for (const e of drainEvents(S)) {
      if (e.type === 'arrive') { spawnGuest(S.guests.find(g => g.uid === e.guest)); layout(); sfx('beep'); }
    }
    for (const e of evs) if (e.type === 'tap') onTap(e.x, e.y);
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
    renderRings(); renderBadges(); renderHelp();
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
    ${S.results.map(r => `<div class="meter"><span style="width:170px; font-size:13px">${GUESTS[r.who].ico} ${esc(MENU[r.dish].name)}</span>
      <div class="bar"><div class="fill" style="width:${r.points}%; background:${r.points >= 80 ? '#49b26a' : r.points >= 60 ? '#f0b429' : '#e2574c'}"></div></div><span class="val">¥${r.tip}</span></div>`).join('')}
    <p class="sub">Tips: ¥${S.tips} · ⭐ ${Object.values(S.stars).filter(n => n > 0).length} happy regulars</p>
    <div class="row" style="justify-content:flex-end; margin-top:10px"><button class="btn-big" id="k-done">Close up</button></div>
  </div>`;
  hud.appendChild(card);
  await new Promise(res => card.querySelector('#k-done').addEventListener('click', res));
  for (const o of props) W.scene.remove(o);
  for (const p of Object.values(people)) W.scene.remove(p.char.root);
  K.bowlBroth.visible = false;
  hud.classList.remove('service');
  end();
  G.money += S.tips;
  return { results: S.results, tips: S.tips, avg, stars: S.stars };
}
