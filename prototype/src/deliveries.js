// Day 2's orders. Each one is pick-up → pack → ride → a twist at the drop-off.

import * as THREE from 'three';
import { G, until, clamp, esc } from './core.js';
import { P, W, setMarker } from './world.js';
import { player } from './player.js';
import { N, SP, crowd, face } from './npcs.js';
import { say, talk, choose, emote, bark, toast, objective, fadeOut, fadeIn, cutscene, beat, showResult } from './ui.js';
import { addInteract } from './interact.js';
import { packBag } from './bag.js';
import { peekScheme } from './peek.js';
import { montage } from './phone.js';
import { tasteMoment } from './taste.js';
import { sfx, setMusic, blip } from './audio.js';

// a few voice blips so bubble answers still "talk"
function blipLine(text) {
  [...text].slice(0, 10).forEach((ch, i) => setTimeout(() => blip(ch, 'crowd'), i * 45));
}

export const ORDERS = [
  {
    id: 'redhat', ico: '🍲', title: 'Steam-pot chicken', pay: 14, hot: true, soup: true,
    from: 'ji', fromName: "Uncle Ji's Steam-Pot Chicken", toName: 'Zhuanxin Market', pickup: P.jiDoor,
    dest: { x: 25, z: 64 }, destR: 17,
    tags: ['🍲 Soup', '🔥 Keep hot', '🔎 Find the customer'],
    note: { zh: '放在菜市场戴红帽子的大叔那里', tr: 'Put in vegetable market wearing red hat uncle there.' },
    items: [
      { name: 'Steam-pot chicken', ico: '🍲', w: 2, h: 2, rules: ['top'], color: '#f6d38b' },
      { name: 'Rice', ico: '🍚', w: 1, h: 1, rules: [], color: '#ffffff' },
      { name: 'Chilli dip', ico: '🌶️', w: 1, h: 1, rules: [], color: '#ffc4b8' },
      { name: 'Pickled veg jar', ico: '🫙', w: 1, h: 1, rules: ['heavy'], color: '#d8e6c0' },
    ],
  },
  {
    id: 'surprise', ico: '🌸', title: 'Flower cakes + 2 bubble teas', pay: 12, hot: false, soup: false,
    from: 'rose', fromName: "Rose's Flower Cakes", toName: 'Bamboo Courtyard', pickup: P.roseDoor,
    dest: { x: 58.5, z: 20 }, destR: 4,
    tags: ['🧋 Keep upright', '🍰 Fragile', '🤫 Secret'],
    note: { zh: '惊喜！别让我女朋友看见你！她穿绿裙子。', tr: 'Surprised! Do not let my girlfriend see you! She wears green skirt.' },
    packHint: '(Rose threw in a free watermelon.)',
    items: [
      { name: 'Flower cake box', ico: '🍰', w: 2, h: 1, rules: ['fragile'], color: '#ffd6e2' },
      { name: 'Bubble tea', ico: '🧋', w: 1, h: 2, rules: ['upright', 'top'], rot: true, color: '#e8cfa8' },
      { name: 'Bubble tea', ico: '🧋', w: 1, h: 2, rules: ['upright', 'top'], rot: true, color: '#e8cfa8' },
      { name: 'Free watermelon', ico: '🍉', w: 2, h: 1, rules: ['heavy'], color: '#b8e0a0' },
    ],
  },
  {
    id: 'lonely', ico: '🍜', title: 'Small-pot rice noodles', pay: 11, hot: true, soup: true,
    from: 'fu', fromName: "Auntie Fu's Small-Pot Noodles", toName: 'Green Lake', pickup: P.fuDoor,
    dest: { x: 30, z: -44 }, destR: 12,
    tags: ['🍜 Soup', '🔥 Keep hot', '🦆 Strange directions'],
    note: { zh: '翠湖边，门口那棵像鸭子的树旁边，长椅上的老人', tr: 'Green Lake side, door mouth that tree like duck side, long chair on the old man.' },
    items: [
      { name: 'Small-pot noodles', ico: '🍜', w: 2, h: 1, rules: ['top'], color: '#f6d38b' },
      { name: 'Fried potatoes', ico: '🥔', w: 1, h: 1, rules: ['heavy'], color: '#f3d27a' },
      { name: 'Soy milk', ico: '🥛', w: 1, h: 2, rules: ['upright', 'top'], rot: true, color: '#f4f1e6' },
      { name: 'Steamed buns', ico: '🥟', w: 1, h: 1, rules: ['fragile'], color: '#ffffff' },
    ],
  },
  {
    id: 'spud', ico: '🥔', title: '10× fried potatoes', pay: 9, montage: true,
    from: 'spud', fromName: "Uncle Spud's Fried Potatoes", toName: 'Tech office tower',
    tags: ['⚡ Quick run (skips the ride)'], note: null,
  },
];

export const STORY_ORDERS = ['redhat', 'surprise', 'lonely'];

function addFinding(key, ico, name, how) {
  if (G.findings.has(key)) return '';
  G.findings.add(key);
  toast(`📒 Finding: ${ico} <b>${esc(name)}</b>`);
  sfx('ding');
  return `<div class="finding"><span class="ico">${ico}</span><div>${esc(name)}<div class="sub">${esc(how)}</div></div></div>`;
}

function addDex(name) {
  if (G.foodDex.has(name)) return;
  G.foodDex.add(name);
}

function reach(pos, r) {
  return until(() => G.busy === 0 && Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z) < r);
}

// ---------- pick-up scenes ----------

async function pickupJi(run) {
  face('ji', player);
  await talk([
    [SP.ji, "A Duck rider! For the market order? Wait, wait. You've never seen a steam pot, have you?", { zh: '小黄鸭！菜市场的单？', face: 'happy' }],
    [SP.you, 'Is it… a pot? That steams?', { face: 'blank' }],
    [SP.ji, "Come, look. Old men like me love an audience.", { face: 'happy', emote: '✨' }],
  ]);
  await tasteMoment({
    title: 'Steam-Pot Chicken', desc: 'A whole old hen in a clay pot with a chimney. No water. The broth is only steam, for hours.',
    flavours: [{ k: 'savoury', word: 'patience' }],
    lesson: 'One thing, given time, can fill the whole dark.',
  });
  await talk([
    [SP.ji, "The secret? Time. And an *old* hen. Young hens have no opinions.", { face: 'smug' }],
    [SP.you, '(Old hen… hours… I should tell Grandma.)', { face: 'normal', emote: '💡' }],
  ]);
  run.found.push(addFinding('broth:hen', '🐔', 'Old hen broth', "Uncle Ji: time, and an old hen"));
  addDex('Steam-pot chicken 汽锅鸡');
}

async function pickupRose(run) {
  face('rose', player);
  await talk([
    [SP.rose, 'Hiii Duck! Flower cakes for the courtyard. And a *free watermelon*, it’s promo week!', { zh: '鲜花饼！还有西瓜！', face: 'happy', emote: '🌸' }],
    [SP.you, 'Why a watermelon?', { face: 'blank' }],
    [SP.rose, 'Why NOT a watermelon? Try a cake. Rose petals from Anning, sweetie. Everything’s better with roses!', { face: 'happy' }],
  ]);
  await tasteMoment({
    title: 'Flower Cake', desc: 'Flaky pastry, rose-petal jam inside. Kunming in one bite.',
    flavours: [{ k: 'floral', word: 'a first date' }, { k: 'rich', word: 'a lazy Sunday' }],
    lesson: 'Two things that love each other make a third thing neither could be alone.',
  });
  run.found.push(addFinding('top:rose', '🌸', 'Rose petals', "Rose: everything's better with roses"));
  run.found.push(addFinding('broth:flower', '🌹', 'Rose petal broth', "Rose: 'You could put roses in SOUP!' (could you?)"));
  addDex('Flower cake 鲜花饼');
}

async function pickupFu(run) {
  let c = 0;
  await cutscene(async () => {
    face('fu', player);
    await say(SP.fu, 'Duck! Green Lake order. Two minutes. The noodles cook in their own little pot, one by one.', { zh: '小锅米线，一锅一锅煮！', face: 'normal' });
    await say(SP.you, '(She keeps glancing at a brown jar by the stove. That must be the secret…)', { face: 'smug' });
    c = await choose(['Wait politely', 'Scheme: sneak a look at the jar 🕵️']);
    if (c === 0) {
      await talk([
        [SP.fu, 'A rider who waits without whining? Here. Taste. Don’t tell anyone I’m nice.', { face: 'happy' }],
      ]);
      await tasteMoment({
        title: 'Small-Pot Rice Noodles', desc: 'Cooked one pot at a time, for one person at a time.',
        flavours: [{ k: 'savoury', word: 'someone noticed me' }, { k: 'spicy', word: 'cheeky' }, { k: 'fresh', word: 'awake' }],
        lesson: 'She only let me taste because I waited. Kindness is an ingredient too.',
      });
      addDex('Small-pot rice noodles 小锅米线');
      G.flags.fuPolite = true;
    }
  });
  if (c === 0) return;
  const r = await peekScheme();
  await cutscene(async () => {
    if (r === 'success') {
      await tasteMoment({
        title: 'Auntie Fu’s Chilli Oil', desc: 'Dried chillies, Sichuan pepper and a spoon of sugar, fried slowly in rapeseed oil.',
        flavours: [{ k: 'spicy', word: 'brave' }, { k: 'sweet', word: 'gentle' }, { k: 'rich', word: 'held' }],
        lesson: 'Heat needs something gentle underneath to hold it up.',
      });
      run.found.push(addFinding('oil:chilli', '🌶️', 'Fried chilli oil', "Auntie Fu's secret jar (you sneaky duck)"));
      await say(SP.you, '(Like Plankton, but it WORKED.)', { face: 'happy', emote: '😏' });
    } else {
      sfx('whack');
      emote(N.fu.char, '💢');
      await talk([
        [SP.fu, 'HEY! Spying on my jar?! Out! OUT! Banned! You can take this order and GO!', { zh: '偷看我的辣油？出去！', face: 'angry' }],
        [SP.you, '(Caught. Clue, at least: it smelled like chillies… and something sweet?)', { face: 'sad', emote: '💧' }],
      ]);
      G.bans.add('fu');
      run.notes.push('Auntie Fu banned you. Clue: chillies… and something sweet?');
    }
  });
}

// ---------- drop-off twists ----------

const CROWD_LINES = [
  'This hat? It’s ORANGE. Like a persimmon.',
  'Pink, my dear. PINK. Very different.',
  'Red SCARF. Your app can’t tell a hat from a scarf?',
  'No hat. Do I look like I own a hat?',
  'Mine’s more of a… mango. Mango hat.',
  'No hat, but I’ll take that soup if nobody wants it.',
  'Wine-red. Close! But the real red hat is over by the corner stalls.',
  '红帽子？那边那边！ (Points everywhere at once.)',
  'This is a pink hat AND I’m busy. Two problems.',
  'No hat. Is this one of those TV shows?',
  'Red hat? He’s always hiding near the back. Buys too many leeks.',
  'This is a scarf AND I’m a woman. Two mistakes!',
];

async function dropRedhat(run) {
  objective('Find: “vegetable market wearing red hat uncle”');
  let found = false, done = false;
  const offs = crowd.map((npc, i) => addInteract({
    at: () => npc.pos, r: 2.6, label: npc.id === 'redhat' ? 'Deliver' : 'Ask',
    fn: async () => {
      if (found) return;
      face(npc.id, player);
      npc.behavior.wait = 3;
      if (npc.id === 'redhat') {
        found = true;
        await cutscene(() => talk([
          [SP.redhat, 'My chicken! My wife ordered it for me. She says I don’t eat enough.', { face: 'happy', emote: '❤️' }],
          [SP.you, 'She’s right. You look like you need a steam pot.', { face: 'happy' }],
        ]));
        done = true;
      } else {
        // wrong person: they answer in a bubble and you keep moving
        npc.char.setFace(i % 3 ? 'smug' : 'normal');
        bark(npc.char, CROWD_LINES[i % CROWD_LINES.length], 3.4);
        blipLine(CROWD_LINES[i % CROWD_LINES.length]);
        run.asked = (run.asked || 0) + 1;
      }
    },
  }));
  await until(() => done);
  offs.forEach(off => off());
  return { cap: 5, line: run.asked > 3 ? 'Took a while, but he got it.' : 'Found him fast!' };
}

async function dropSurprise(run) {
  const gf = N.gf;
  const cone = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20, -Math.PI / 2 - 0.6, 1.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.28, depthWrite: false }),
  );
  cone.position.y = 0.2;
  gf.char.root.add(cone);
  objective('Sneak into the Bamboo Courtyard. Don’t let the green skirt see you!');
  await reach(run.order.dest, 4);
  setMarker({ x: P.bfBench.x - 1.2, z: P.bfBench.z }, 1.6);
  objective('Reach Ah Jie on the bench. Stay out of the yellow cone!');

  let spotted = false, delivered = false;
  const off = addInteract({
    at: () => N.bf.pos, r: 2.8, label: 'Deliver quietly',
    fn: async () => { delivered = true; },
  });
  await until(() => {
    if (delivered) return true;
    const inYard = player.pos.x > 58 && player.pos.x < 82 && player.pos.z > 8 && player.pos.z < 32;
    if (!inYard) return false;
    const dx = player.pos.x - gf.pos.x, dz = player.pos.z - gf.pos.z, d = Math.hypot(dx, dz);
    let da = Math.atan2(dx, dz) - gf.char.root.rotation.y;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (d < 9 && Math.abs(da) < 0.6) { spotted = true; return true; }
    return false;
  });
  off();
  gf.char.root.remove(cone);
  const b = gf.behavior;
  gf.behavior = { type: 'idle' };
  await cutscene(async () => {
    if (spotted) {
      sfx('gasp');
      emote(gf.char, '❗');
      face('gf', player);
      await talk([
        [SP.gf, 'Who is that for?! …FLOWER CAKES?! And… a watermelon?', { zh: '这是给谁的？！', face: 'shock' }],
        [SP.bf, 'It was a SURPRISE! Duck, you had ONE job!', { face: 'sad', emote: '💧' }],
        [SP.gf, 'Aiya, you silly man. …I love it.', { face: 'happy', emote: '❤️' }],
      ]);
    } else {
      face('bf', player);
      await talk([
        [SP.bf, '(whispering) You made it! She didn’t see a thing. Thank you, Duck!', { face: 'happy' }],
      ]);
      face('gf', N.bf);
      await beat(0.4);
      emote(gf.char, '❤️');
      await talk([
        [SP.gf, 'Flower cakes?! For me?! You remembered!', { face: 'happy', emote: '❤️' }],
      ]);
    }
  });
  gf.behavior = b;
  return spotted ? { cap: 3, line: 'Surprise ruined… but she loved it anyway.' } : { cap: 5, line: 'Perfect stealth delivery. True love saved.' };
}

async function dropLonely(run) {
  objective('Find: “door mouth that tree like duck side, long chair on the old man”');
  let met = false;
  const off = addInteract({ at: () => N.li.pos, r: 3, label: 'Deliver', fn: async () => { met = true; } });
  await until(() => met);
  off();
  let line;
  await cutscene(async () => {
    face('li', player);
    await talk([
      [SP.li, 'Ah. The noodles. Thank you, young duck.', { zh: '谢谢你，小鸭子。', face: 'normal' }],
      [SP.li, '…Would you sit for a moment? Just a moment. It’s quiet here, with the last gulls leaving.', { face: 'sad' }],
    ]);
    const c = await choose(['Sit and eat with him (takes an hour)', 'Sorry, next order! (+¥3 speed bonus)']);
    if (c === 0) {
      await fadeOut();
      G.clock += 60;
      await fadeIn();
      await talk([
        [SP.li, 'My wife brought me lunch at the office every day. Forty years. All the way across the Green Lake bridge.', { face: 'normal' }],
        [SP.li, 'She poured a little *chicken fat* on the soup, so it stayed hot the whole way. Clever woman.', { face: 'happy', emote: '✨' }],
        [SP.you, '…The fat keeps the heat in. Like the legend.', { face: 'shock', emote: '💡' }],
        [SP.li, 'She is gone now. So I order noodles, and I sit where she used to wave from the bridge.', { face: 'sad' }],
        [SP.li, 'Food is never just food, young duck. It is who it is for.', { face: 'normal' }],
      ]);
      run.found.push(addFinding('oil:fat', '✨', 'Chicken fat layer', 'Mr Li: so it stayed hot all the way across the bridge'));
      run.memory = '“Food is never just food. It is who it is for.” (Mr Li)';
      line = 'You stayed. He waved at the bridge for a long time.';
    } else {
      G.money += 3;
      await talk([[SP.li, 'Of course. Young people are busy. Go, go.', { face: 'sad', emote: '💧' }]]);
      line = 'He waved you off. He seemed lonely.';
    }
  });
  return { cap: 5, line };
}

// ---------- the full order loop ----------

export async function runOrder(order) {
  const run = { order, found: [], notes: [], phase: 'pickup', heat: 100, spill: 0, quality: 1 };
  G.run = run;

  if (order.montage) {
    await cutscene(() => talk([
      [SP.spud, 'Ten portions for the tech tower. Those office people never eat real food.', { face: 'normal' }],
      [SP.you, 'I… used to be one of those office people.', { face: 'sad' }],
      [SP.spud, 'A foreigner who respects the potato. Rare. Go!', { face: 'happy', emote: '🥔' }],
    ]));
    await montage(['Up 23 floors in a lift full of laptops…', '“Is this… food? Made by a human?”', 'They clap. One of them cries.'], order.pay);
    G.money += order.pay;
    G.clock += 60;
    G.flags.spudFriend = true;
    G.ordersDone.add(order.id);
    G.run = null;
    return;
  }

  setMarker(order.pickup, 2.2);
  objective(`Pick up at ${order.fromName}`);
  await reach(order.pickup, 3.2);
  player.speed = 0;
  setMarker(null);
  if (order.from === 'fu') await pickupFu(run);
  else await cutscene(() => (order.from === 'ji' ? pickupJi(run) : pickupRose(run)));

  const pack = await packBag(order);
  run.spill = pack.spill;
  run.quality = pack.quality;
  run.packProblems = pack.problems;
  player.slosh = 0;
  run.phase = 'ride';
  setMusic('ride');
  toast(order.hot ? '🔥 It’s getting cold. Ride smooth: sharp turns, bumps and crashes slosh the soup!' : '🧋 Keep it fresh and steady!');
  setMarker(order.dest, order.destR > 6 ? 6 : order.destR);
  objective(`Deliver to ${order.toName}`);
  await reach(order.dest, order.destR);

  let twist;
  if (order.id === 'redhat') twist = await dropRedhat(run);
  if (order.id === 'surprise') twist = await dropSurprise(run);
  if (order.id === 'lonely') twist = await dropLonely(run);
  run.phase = 'done';
  setMarker(null);
  setMusic(W.night ? 'night' : 'day');

  const q = (run.heat / 100) * (1 - run.spill / 100) * run.quality;
  const stars = clamp(Math.min(twist.cap, Math.round(1 + q * 4.4)), 1, 5);
  const tip = stars >= 4 ? (stars - 3) * 3 : 0;
  G.money += order.pay + tip;
  G.stars.push(stars);
  G.ordersDone.add(order.id);
  sfx('coin');

  const customerLine = stars === 5 ? '“Hot, perfect, magical. Five stars, little duck!”'
    : stars === 4 ? '“Very good! A tiny bit wobbly.”'
    : stars === 3 ? '“It arrived. That’s something.”'
    : '“Is this soup or a puddle?”';
  showResult(`
    <h2>${order.ico} Delivered!</h2>
    <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
    <p>${esc(customerLine)}</p>
    <p class="sub">🔥 Heat ${Math.round(run.heat)}% · 🥣 Spilled ${Math.round(run.spill)}% ${run.quality < 1 ? '· 🍰 crushed' : ''}</p>
    <p class="sub">${esc(twist.line)}</p>
    ${run.packProblems.length ? `<p class="warn">Packing: ${esc(run.packProblems.join(' '))}</p>` : ''}
    <p><b>+¥${order.pay}</b>${tip ? ` + ¥${tip} tip` : ''}</p>
    ${run.found.filter(Boolean).length ? `<h3>Findings for Grandma</h3>${run.found.join('')}` : ''}
    ${run.notes.map(n => `<p class="sub">📒 ${esc(n)}</p>`).join('')}
    ${run.memory ? `<p class="sub">💭 ${esc(run.memory)}</p>` : ''}
  `);
  G.run = null;
}

// Called every frame by main: drains heat and adds slosh while riding.
export function updateRun(dt) {
  const run = G.run;
  if (!run || run.phase !== 'ride') { player.slosh = 0; return; }
  if (G.busy === 0) run.heat = Math.max(0, run.heat - dt * (run.order.hot ? 0.9 : 0.7));
  run.spill = clamp(run.spill + player.slosh * (run.order.soup ? 1 : 0.6), 0, 100);
  player.slosh = 0;
}
