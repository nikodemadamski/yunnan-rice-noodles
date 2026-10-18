// Run: node --test prototype/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShop, tick, takeOrder, startNoodles, liftNoodles, setBroth, addPart, serve, dayOver,
  noodleScore, buildScore, drainEvents, pour, addFat, judge } from '../src/shopcore.js';
import { NOODLE, MENU, HEAT } from '../src/shopdata.js';

test('noodles: firm, perfect window, then soft but never ruined', () => {
  assert.ok(noodleScore(2) < 0.9);
  assert.equal(noodleScore(NOODLE.cook + 1), 1);
  assert.ok(noodleScore(NOODLE.cook + NOODLE.perfect + 3) < 1);
  assert.equal(noodleScore(999), 0.3);
});

test('build: right broth, items and order score 1; wrong order scores less', () => {
  const perfect = buildScore('classic', 'hen', MENU.classic.parts);
  assert.equal(perfect.total, 1);
  const shuffled = buildScore('classic', 'hen', ['noodles', 'chives', 'egg', 'meat']);
  assert.equal(shuffled.items, 1);
  assert.equal(shuffled.order, 0);
  assert.ok(shuffled.total < perfect.total);
  const wrongBroth = buildScore('classic', 'chilli', MENU.classic.parts);
  assert.equal(wrongBroth.brothOk, 0);
});

test('build: duplicates count properly (not set-based)', () => {
  const dup = buildScore('kids', 'hen', ['egg', 'egg', 'egg', 'noodles']);
  assert.equal(dup.items, 0.5);   // 2 right out of 4 given
});

test('a bowl that answers what the guest asked for earns high points, tip and a star', () => {
  const s = createShop([{ at: 0, who: 'li' }]);
  tick(s, 0.1);
  const t = takeOrder(s, s.guests[0].uid);
  assert.match(t.ask.say, /classic/i);
  assert.ok(startNoodles(s, 0, t.uid));
  tick(s, NOODLE.cook + 1);
  assert.equal(liftNoodles(s, 0), 1);
  pour(s, t.uid, 'hen', 0.8);
  addFat(s, t.uid);
  for (const p of ['meat', 'egg', 'chives', 'noodles']) assert.ok(addPart(s, t.uid, p));
  const r = serve(s, t.uid);
  assert.equal(r.judge.ask, 1);
  assert.equal(r.judge.craft, 1);
  assert.ok(r.points >= 90, `points ${r.points}`);
  assert.ok(r.tip > 0);
  assert.equal(s.stars.li, 1);
  assert.ok(dayOver(s));
});

test('guests ask in their own words; the next visit asks something new', () => {
  const s = createShop([{ at: 0, who: 'li' }, { at: 1, who: 'li' }]);
  tick(s, 2);
  const a = takeOrder(s, s.guests[0].uid), b = takeOrder(s, s.guests[1].uid);
  assert.notEqual(a.ask.say, b.ask.say);
  assert.ok(b.ask.need.ham);
});

test('the kid notices green stuff, and counts the eggs', () => {
  const s = createShop([{ at: 0, who: 'kid' }]);
  tick(s, 0.1);
  const t = takeOrder(s, s.guests[0].uid);
  pour(s, t.uid, 'hen', 0.8);
  t.noodles = 1;
  for (const p of ['egg', 'chives', 'noodles']) addPart(s, t.uid, p);
  const j = judge(t);
  assert.ok(j.ask < 0.5, `ask ${j.ask}`);
  assert.ok(j.notes.some(n => !n.ok && /GREEN/.test(n.text)));
  assert.ok(j.notes.some(n => !n.ok && /TWO eggs/.test(n.text)));
});

test('raw meat must cross the bridge before the noodles', () => {
  const s = createShop([{ at: 0, who: 'li' }]);
  tick(s, 0.1);
  const t = takeOrder(s, s.guests[0].uid);
  pour(s, t.uid, 'hen', 0.8); t.noodles = 1;
  for (const p of ['noodles', 'meat', 'egg', 'chives']) addPart(s, t.uid, p);
  const j = judge(t);
  assert.ok(j.craft < 1);
  assert.ok(j.notes.some(n => /raw/.test(n.text)));
});

test('broth cools from the pour; the chicken-fat layer keeps it hot', () => {
  const s = createShop([{ at: 0, who: 'lan' }, { at: 0, who: 'li' }]);
  tick(s, 0.1);
  const a = takeOrder(s, s.guests[0].uid), b = takeOrder(s, s.guests[1].uid);
  pour(s, a.uid, 'hen', 0.8); pour(s, b.uid, 'hen', 0.8); addFat(s, b.uid);
  tick(s, HEAT.plain * 0.8);
  assert.ok(a.heat < 0.3, `plain ${a.heat}`);
  assert.ok(b.heat > 0.7, `fat ${b.heat}`);
});

test('the fill line: too little or spilling over costs craft', () => {
  const s = createShop([{ at: 0, who: 'li' }]);
  tick(s, 0.1);
  const t = takeOrder(s, s.guests[0].uid);
  pour(s, t.uid, 'hen', 1.2); t.noodles = 1; addPart(s, t.uid, 'noodles');
  assert.ok(judge(t).notes.some(n => /spilling/.test(n.text)));
});

test('noodles cannot be added before they come out of the basket', () => {
  const s = createShop([{ at: 0, who: 'kid' }]);
  tick(s, 0.1);
  const t = takeOrder(s, s.guests[0].uid);
  assert.equal(addPart(s, t.uid, 'noodles'), false);
});

test('baskets keep cooking while you are elsewhere, and only one per ticket', () => {
  const s = createShop([{ at: 0, who: 'li' }, { at: 0, who: 'kid' }]);
  tick(s, 0.1);
  const a = takeOrder(s, s.guests[0].uid), b = takeOrder(s, s.guests[1].uid);
  assert.ok(startNoodles(s, 0, a.uid));
  assert.equal(startNoodles(s, 1, a.uid), false);
  assert.ok(startNoodles(s, 1, b.uid));
  tick(s, 5);
  assert.equal(s.baskets[0].t, 5);
  assert.equal(s.baskets[1].t, 5);
});

test('waiting forever lowers points but guests never leave (cosy)', () => {
  const s = createShop([{ at: 0, who: 'lan' }]);
  tick(s, 0.1);
  tick(s, 500);
  assert.equal(s.guests[0].state, 'line');
  assert.equal(s.guests[0].patience, 0);
  const t = takeOrder(s, s.guests[0].uid);
  setBroth(s, t.uid, 'hen');
  addPart(s, t.uid, 'meat');
  const r = serve(s, t.uid);
  assert.ok(r.wait >= 0.3 && r.wait < 0.31);
  assert.equal(s.stars.lan, 0);
});

test('arrivals follow the schedule and emit events', () => {
  const s = createShop([{ at: 0, who: 'li' }, { at: 10, who: 'student' }]);
  tick(s, 1);
  assert.equal(s.guests.length, 1);
  tick(s, 10);
  assert.equal(s.guests.length, 2);
  assert.deepEqual(drainEvents(s).map(e => e.type), ['arrive', 'arrive']);
  assert.equal(dayOver(s), false);
});
