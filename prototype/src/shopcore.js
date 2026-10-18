// The noodle shop's rules, with no DOM: intents in, events out, tick(dt).
// (Pattern from open-source cooking games: a pure-logic kitchen core you can
// unit-test and later drive from any UI or engine.)

import { MENU, GUESTS, PARTS, BROTHS, NOODLE, BASE_PATIENCE, FILL, HEAT, COOK_HEAT } from './shopdata.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createShop(schedule, { baskets = 2 } = {}) {
  return {
    time: 0,
    schedule: schedule.map((s, i) => ({ ...s, uid: `g${i}`, arrived: false })),
    guests: [],        // { uid, who, state: 'line' | 'waiting' | 'served', patience, maxPatience, ticket }
    tickets: [],       // { uid, guest, dish, broth, parts: [], noodles: null | score, served }
    baskets: Array.from({ length: baskets }, () => ({ ticket: null, t: 0 })),
    results: [],
    tips: 0,
    points: 0,
    stars: {},         // guest type → star count (Papa's "Star Customer")
    events: [],
    nextTicket: 1,
    visits: {},        // guest type → how many times they've come (picks their next ask)
  };
}

// ---------- scoring helpers (exported for tests) ----------

/** Noodle quality for a basket lifted after t seconds. */
export function noodleScore(t) {
  const { cook, perfect, soft } = NOODLE;
  if (t < cook) return clamp(0.3 + 0.6 * (t / cook), 0, 0.9);          // too firm
  if (t <= cook + perfect) return 1;                                    // just right
  return clamp(1 - ((t - cook - perfect) / soft) * 0.7, 0.3, 1);       // too soft, never ruined
}

/** How full the timer ring is (0..1) and which zone it's in. */
export function noodleRing(t) {
  const { cook, perfect, soft } = NOODLE;
  const total = cook + perfect + soft;
  const zone = t < cook ? 'firm' : t <= cook + perfect ? 'ready' : 'soft';
  return { v: clamp(t / total, 0, 1), zone, lo: cook / total, hi: (cook + perfect) / total };
}

/** Topping accuracy: right items (multiset) and right order. */
export function buildScore(dish, broth, parts) {
  const want = MENU[dish];
  const brothOk = broth === want.broth ? 1 : 0;
  // multiset overlap (counts duplicates properly)
  const need = {};
  for (const p of want.parts) need[p] = (need[p] || 0) + 1;
  let hit = 0;
  const left = { ...need };
  for (const p of parts) if (left[p] > 0) { left[p]--; hit++; }
  const items = hit / Math.max(want.parts.length, parts.length);
  // order: of the wanted items that are present, how many pairs are in the right order
  const idx = p => want.parts.indexOf(p);
  const seq = parts.filter(p => idx(p) >= 0);
  let ok = 0, pairs = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) {
    if (seq[i] === seq[j]) continue;
    pairs++;
    if (idx(seq[i]) < idx(seq[j])) ok++;
  }
  const order = pairs ? ok / pairs : seq.length ? 1 : 0;
  return { brothOk, items, order, total: 0.3 * brothOk + 0.4 * items + 0.3 * order };
}

// ---------- intents ----------

export function takeOrder(s, guestUid) {
  const g = s.guests.find(x => x.uid === guestUid);
  if (!g || g.state !== 'line') return null;
  const guest = GUESTS[g.who];
  const v = s.visits[g.who] || 0;
  s.visits[g.who] = v + 1;
  const ask = guest.asks[v % guest.asks.length];
  const t = { uid: `#${s.nextTicket++}`, guest: g.uid, dish: guest.fav, ask, broth: null, fill: 0, heat: 0, fat: false, mixed: false,
    parts: [], noodles: null, served: false };
  g.state = 'waiting';
  g.ticket = t.uid;
  s.tickets.push(t);
  s.events.push({ type: 'ticket', ticket: t.uid, guest: g.uid });
  return t;
}

export function startNoodles(s, basketIdx, ticketUid) {
  const b = s.baskets[basketIdx];
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!b || b.ticket || !t || t.served || t.noodles !== null) return false;
  if (s.baskets.some(x => x.ticket === ticketUid)) return false;
  b.ticket = ticketUid;
  b.t = 0;
  s.events.push({ type: 'basketIn', basket: basketIdx, ticket: ticketUid });
  return true;
}

export function liftNoodles(s, basketIdx) {
  const b = s.baskets[basketIdx];
  if (!b || !b.ticket) return null;
  const t = s.tickets.find(x => x.uid === b.ticket);
  const score = noodleScore(b.t);
  if (t) t.noodles = score;
  s.events.push({ type: 'basketOut', basket: basketIdx, ticket: b.ticket, score });
  b.ticket = null;
  b.t = 0;
  return score;
}

/** Pour some broth into a ticket's bowl (hold-to-pour sends small amounts). */
export function pour(s, ticketUid, broth, amount) {
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!t || t.served) return false;
  if (t.broth && t.broth !== broth && t.fill > 0.08) t.mixed = true;
  if (!t.broth || t.fill < 0.08) t.broth = broth;
  if (t.fill === 0) t.heat = 1;
  t.fill = Math.min(1.2, t.fill + amount);
  return true;
}

/** A spoon of chicken fat seals the heat in (the bridge legend). */
export function addFat(s, ticketUid) {
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!t || t.served || !t.broth || t.fat) return false;
  t.fat = true;
  return true;
}

export function setBroth(s, ticketUid, broth) {
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!t || t.served) return false;
  t.broth = broth;
  if (!t.fill) { t.fill = (FILL.lo + FILL.hi) / 2; t.heat = 1; }
  return true;
}

export function addPart(s, ticketUid, part) {
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!t || t.served) return false;
  if (part === 'noodles' && t.noodles === null) return false;   // must come out of the basket first
  // raw slices cook only in scalding broth (that's the whole trick of the dish)
  if (PARTS[part]?.rank === 0 && (!t.broth || t.heat < COOK_HEAT)) t.undercooked = true;
  t.parts.push(part);
  return true;
}

export function undoPart(s, ticketUid) {
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!t || t.served || !t.parts.length) return false;
  t.parts.pop();
  return true;
}

const count = (parts, p) => parts.filter(x => x === p).length;

/**
 * What the guest notices about a bowl: their ask, then Grandma's rules.
 * Returns { ask: 0..1, craft: 0..1, notes: [{ ok, text }] }.
 */
export function judge(t) {
  const a = t.ask || { need: {} }, no = a.no || {}, parts = t.parts, notes = [];
  const say = (ok, good, bad) => notes.push({ ok, text: ok ? good : bad });
  const askChecks = [];
  const check = (ok, good, bad) => { askChecks.push(ok); say(ok, good, bad); };
  if (a.broth) check(t.broth === a.broth && !t.mixed, `${BROTHS[a.broth].ico} just right`, no.broth || (a.broth === 'chilli' ? 'Not spicy at all…' : 'Too spicy!'));
  for (const [p, n] of Object.entries(a.need || {})) {
    check(count(parts, p) >= n, `${PARTS[p].ico}${n > 1 ? ` ×${n}` : ''} yes!`, no[p] || `No ${PARTS[p].name.toLowerCase()}?`);
  }
  for (const p of a.ban || []) check(!parts.includes(p), `no ${PARTS[p].ico}, good`, no[p] || `I said no ${PARTS[p].name.toLowerCase()}!`);
  if (a.max) check(parts.length <= a.max, 'nice and light', no.max || 'Too much!');
  if (a.hot) check(t.heat >= 0.6, '🔥 piping hot', no.hot || 'It’s gone cold…');
  if (a.min) check(parts.length >= a.min, 'a proper feast', no.min || 'Is that all?');
  // Grandma's rules, for every bowl: the order the saucers cross the bridge
  const craft = [];
  const hasNoodles = parts.includes('noodles');
  craft.push(hasNoodles); if (!hasNoodles) say(false, '', 'Where are the noodles?!');
  const ranks = parts.map(p => PARTS[p]?.rank ?? 3).filter(r => r >= 0);
  let inOrder = 0, pairs = 0;
  for (let i = 1; i < ranks.length; i++) { pairs++; if (ranks[i] >= ranks[i - 1]) inOrder++; }
  if (pairs) {
    craft.push(inOrder / pairs);
    if (inOrder < pairs) {
      const nd = parts.indexOf('noodles');
      say(false, '', nd >= 0 && nd < parts.length - 1 && parts.slice(nd + 1).some(p => PARTS[p].rank >= 0) ? 'Noodles go in last!' : 'Raw first, then cooked, flowers, greens…');
    } else if (ranks.length > 2) say(true, 'crossed the bridge in order', '');
  }
  if (t.undercooked) { craft.push(0); say(false, '', 'The slices are still raw! The broth wasn’t hot enough.'); }
  const fillOk = t.fill >= FILL.lo && t.fill <= FILL.hi;
  craft.push(fillOk ? 1 : Math.max(0, 1 - Math.min(Math.abs(t.fill - FILL.lo), Math.abs(t.fill - FILL.hi)) * 4));
  if (!fillOk) say(false, '', t.fill > FILL.hi ? 'It’s spilling over!' : 'Bit stingy with the broth…');
  if (t.mixed) say(false, '', 'Two broths? Strange…');
  const avg = xs => xs.length ? xs.reduce((u, v) => u + Number(v), 0) / xs.length : 1;
  return { ask: avg(askChecks), craft: avg(craft), notes };
}

export function serve(s, ticketUid) {
  const t = s.tickets.find(x => x.uid === ticketUid);
  if (!t || t.served || !t.broth || !t.parts.length) return null;
  const g = s.guests.find(x => x.uid === t.guest);
  const guest = GUESTS[g.who];
  const dish = MENU[t.dish];
  const wait = 0.3 + 0.7 * clamp(g.patience / g.maxPatience, 0, 1);   // cosy: waiting only costs points
  const noodles = t.noodles ?? 0;
  const heat = 0.3 + 0.7 * t.heat;
  const j = judge(t);
  const total = 0.15 * wait + 0.15 * noodles + 0.15 * heat + 0.4 * j.ask + 0.15 * j.craft;
  const points = Math.round(total * 100);
  const tip = Math.round(dish.price * total * guest.tip * (total >= 0.8 ? 1.5 : 1));
  // Star Customer: 80+ earns a star, 59 or less resets the meter
  const before = s.stars[g.who] || 0;
  s.stars[g.who] = points >= 80 ? before + 1 : points <= 59 ? 0 : before;
  t.served = true;
  g.state = 'served';
  s.tips += tip;
  s.points += points;
  const result = { ticket: t.uid, guest: g.uid, who: g.who, dish: t.dish, ask: t.ask, wait, noodles, heat, judge: j, total, points, tip, stars: s.stars[g.who] };
  s.results.push(result);
  s.events.push({ type: 'served', ...result });
  return result;
}

// ---------- time ----------

export function tick(s, dt) {
  s.time += dt;
  for (const e of s.schedule) {
    if (!e.arrived && s.time >= e.at) {
      e.arrived = true;
      const max = BASE_PATIENCE * GUESTS[e.who].patience;
      s.guests.push({ uid: e.uid, who: e.who, state: 'line', patience: max, maxPatience: max, ticket: null });
      s.events.push({ type: 'arrive', guest: e.uid, who: e.who });
    }
  }
  for (const g of s.guests) if (g.state !== 'served') g.patience = Math.max(0, g.patience - dt);
  for (const b of s.baskets) if (b.ticket) b.t += dt;
  for (const t of s.tickets) if (!t.served && t.fill > 0) t.heat = Math.max(0, t.heat - dt / (t.fat ? HEAT.fat : HEAT.plain));
}

export function dayOver(s) {
  return s.schedule.every(e => e.arrived) && s.guests.every(g => g.state === 'served');
}

export function drainEvents(s) {
  const out = s.events;
  s.events = [];
  return out;
}
