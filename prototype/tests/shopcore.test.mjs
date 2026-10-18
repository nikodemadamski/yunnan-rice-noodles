// Run: node --test prototype/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShop, tick, takeOrder, startNoodles, liftNoodles, setBroth, addPart, serve, dayOver,
  noodleScore, buildScore, drainEvents } from '../src/shopcore.js';
import { NOODLE, MENU } from '../src/shopdata.js';

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

test('a full perfect order earns high points, tip and a star', () => {
  const s = createShop([{ at: 0, who: 'li' }]);
  tick(s, 0.1);
  const g = s.guests[0];
  const t = takeOrder(s, g.uid);
  assert.equal(t.dish, 'classic');
  assert.ok(startNoodles(s, 0, t.uid));
  tick(s, NOODLE.cook + 1);
  assert.equal(liftNoodles(s, 0), 1);
  setBroth(s, t.uid, 'hen');
  for (const p of MENU.classic.parts) assert.ok(addPart(s, t.uid, p));
  const r = serve(s, t.uid);
  assert.ok(r.points >= 80, `points ${r.points}`);
  assert.ok(r.tip > 0);
  assert.equal(s.stars.li, 1);
  assert.ok(dayOver(s));
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
