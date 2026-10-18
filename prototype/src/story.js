// Day 1 (the fall + Little Chilli's bowl), Day 2 (the job), the evening Bowl Lab.
// Story moments run as auto-playing cutscenes; the player only acts in
// free roam, deliveries, choices and the Bowl Lab.

import { G, until, esc } from './core.js';
import { P, setMarker, setNight } from './world.js';
import { player, setMode, teleport, updateCamera } from './player.js';
import { N, SP, show, walkTo, face } from './npcs.js';
import { talk, say, choose, emote, bark, toast, objective, card, fadeIn, fadeOut, danmaku, cutscene, beat, shot } from './ui.js';
import { promptPalLive, chilliBowl } from './day1cook3d.js';
import { shopService } from './shop2d.js';
import { tasteMoment } from './taste.js';
import { legend, learn, notesHtml } from './lore.js';
import { duckSignup, orderBoard, infoCard } from './phone.js';
import { ORDERS, STORY_ORDERS, runOrder } from './deliveries.js';
import { sfx, setMusic } from './audio.js';

const $ = id => document.getElementById(id);

function reach(pos, r) {
  return until(() => G.busy === 0 && Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z) < r);
}

function placeCast(night = false) {
  for (const id of ['grandma', 'wang', 'chilli']) show(id, true);
  N.grandma.pos.set(-17.5, 0, -7.2); N.grandma.facing = 0;
  N.wang.pos.set(-15, 0, 7.5); N.wang.facing = Math.PI;
  N.chilli.pos.set(P.chilliStall.x, 0, P.chilliStall.z); N.chilli.facing = Math.PI;
  if (night) show('wang', false);
}

// ---------------------------------------------------------------- Day 1

export async function day1() {
  G.day = 1;
  G.clock = 17 * 60 + 30;
  await card('Day 1', 'Kunming · the Spring City · 22 days of leave left', 2.4);
  setNight(false);
  setMusic('day');
  setMode('foot');
  placeCast();
  teleport(P.start.x, P.start.z, Math.PI / 2);
  updateCamera(0, true);
  $('hud').classList.remove('hidden');
  await fadeIn();

  objective("Find Old Zhao's shop");
  setMarker(P.shopFront, 2.5);
  toast('Move: WASD / arrow keys (or the joystick)', 5);
  await reach(P.shopFront, 4.5);
  setMarker(null);
  objective(null);

  // --- the fall
  await cutscene(async () => {
    player.heading = Math.PI;
    shot({ x: -15, z: -8 });
    emote(player.char, '❗');
    await beat(1.2);
    await say(SP.you, "Old Zhao's… the shutters are down. “FOR LEASE”?!", { face: 'shock' });
    face('grandma', player);
    emote(N.grandma.char, '❗');
    sfx('gasp');
    await talk([
      [SP.grandma, "Aiyo! It's YOU! The tall foreigner who ate *three bowls*!", { zh: '哎哟！是你！吃了三碗的那个高个子外国人！', face: 'happy' }],
      [SP.you, "Grandma Zhao! What happened? Where's Grandpa Zhao?", { face: 'shock' }],
      [SP.grandma, 'Gone. One morning his apron was on the hook, and he… was gone.', { zh: '他不见了。', face: 'sad' }],
      [SP.grandma, 'And *that one* across the street stole his recipe!', { face: 'angry', emote: '💢' }],
    ]);

    shot(N.wang.pos);
    bark(N.wang.char, '老铁们！Hello family!');
    await beat(1);
    await walkTo('wang', -15, 1.5, 3);
    face('wang', player);
    await talk([
      [SP.wang, 'Hello livestream family! Look, look, a foreigner at the OLD shop!', { zh: '老铁们，看！一个外国人！', face: 'smug' }],
      [SP.wang, 'Supreme Mega Cross-Bridge Noodle opens TODAY! *48 toppings*! Old Zhao’s recipe… improved!', { face: 'happy', emote: '✨' }],
      [SP.grandma, 'STOLEN!', { zh: '偷的！', face: 'angry', emote: '💢' }],
    ]);
    await choose(["I'll fix this. I have the PERFECT recipe.", 'Uh… I have a recipe from an AI?']);
    await talk([
      [SP.you, 'The AI said it’s perfect. I’ll cook it right here!', { face: 'happy', emote: '✨' }],
      [SP.wang, 'A foreigner with a phone recipe?! Wonderful content! Cook it! LIVE! 一、二、三！', { zh: '直播！一、二、三！', face: 'happy' }],
    ]);
  });

  // --- PromptPal Live: you play this one
  await promptPalLive();
  await tasteMoment({
    title: 'Supreme Mega Bowl™', desc: 'Optimised by PromptPal for 2.3 million viewers. 30% off today.', mode: 'bomb',
    flavours: [{ k: 'rich', word: 'wow' }, { k: 'savoury', word: 'more' }, { k: 'sweet', word: 'viral' }, { k: 'spicy', word: 'maximum' },
      { k: 'sour', word: 'trending' }, { k: 'smoky', word: '30% off' }, { k: 'floral', word: 'like & subscribe' }],
    lesson: 'It tasted amazing. For about three seconds. Then there was nothing left. Nobody was in it.',
  });

  await cutscene(async () => {
    shot({ x: -15, z: -4 });
    N.grandma.char.setFace('shock');
    emote(N.grandma.char, '😱');
    await beat(1.2);
    await talk([
      [SP.grandma, '…', { face: 'blank', hold: 1.4 }],
      [SP.grandma, 'What… is this.', { zh: '这……是什么？', face: 'sad' }],
      [SP.wang, 'HAHAHAHA! CHEESE! In cross-bridge noodles! Family, you saw it here first!', { face: 'happy', emote: '😂' }],
      [SP.wang, 'Supreme Mega, 30% off today! Bring your foreigners!', { face: 'smug' }],
    ]);
    walkTo('wang', -15, 7.5, 3).then(() => { N.wang.facing = Math.PI; });
    emote(N.grandma.char, '💧');
    shot(N.grandma.pos);
    await walkTo('grandma', -15, -8.6, 2);
    show('grandma', false);
    shot(player.pos);
    await say(SP.you, '…Okay. That went… badly.', { face: 'sad', emote: '💧' });
  });

  // --- night: kindness from below
  await fadeOut();
  setNight(true);
  setMusic('night');
  show('wang', false);
  teleport(-11.5, -5.6, 0);
  player.char.setFace('sad');
  updateCamera(0, true);
  await cutscene(async () => {
    await beat(0.4);
    await fadeIn();
    await beat(0.8);
    await say(SP.you, 'Day one. Viral for the wrong reasons. Phone on 3%. Great job, me.', { face: 'sad', emote: '🔋' });
    emote(N.chilli.char, '💢');
    shot(N.chilli.pos);
    await walkTo('chilli', -12, -3.2, 4);
    face('chilli', player);
    await talk([
      [SP.chilli, 'YOU. You put *cheese* in Grandpa Zhao’s soup?!', { zh: '你！你在赵爷爷的汤里放芝士？！', face: 'angry' }],
      [SP.you, 'The AI said it was perfect…', { face: 'sad' }],
      [SP.chilli, 'The AI. Hmph.', { face: 'angry' }],
      [SP.chilli, '…Here. Sit. You’re going to cook. Properly.', { zh: '……坐。你来做。', face: 'normal', emote: '🍜' }],
    ]);
    await talk([[SP.chilli, 'Grandpa Zhao’s way. I show you once. Then you.', { face: 'normal' }]]);
  });

  // --- Little Chilli's bowl: the same verbs, slowly
  const bowl = await chilliBowl();
  setMusic('night');
  await tasteMoment({
    title: 'Little Chilli’s Bowl', desc: 'Grandpa Zhao’s way. Clear broth, a shine of oil, chives.',
    flavours: [{ k: 'savoury', word: 'quiet' }, { k: 'rich', word: 'cared for' }, { k: 'fresh', word: 'hope' }],
    lesson: 'Less. Every flavour needs room to be heard.',
  });

  await cutscene(async () => {
    await talk([
      [SP.you, 'This is… nothing special. Why is it SO GOOD?', { face: 'shock' }],
      [SP.chilli, 'Grandpa Zhao fed me this every day when I was a kid with nowhere to go. Never charged me once.', { face: 'normal' }],
      [SP.chilli, 'Plain broth, a little oil, chives. He always said: “Less, Little Chilli. Always less.”', { face: 'sad' }],
      bowl.score >= 5
        ? [SP.chilli, '…You have quiet hands. For a foreigner.', { face: 'happy', emote: '✨' }]
        : [SP.chilli, 'Your hands are too loud. Phone hands. You’ll learn.', { face: 'smug' }],
    ]);
    G.findings.add('top:chives');
    G.memories = ['Little Chilli’s bowl: clear broth, a shine of oil, chives. “Less. Always less.”'];
    sfx('ding');
    await say(SP.chilli, 'My stall sign is falling apart. You. Paint me a new one.', { face: 'smug' });
    const c = await choose(['Sure! Later!', "Me? I can't paint…"]);
    await talk([
      [SP.chilli, c === 0 ? 'Later then. Don’t forget, foreigner.' : 'Learn. Later. Don’t forget, foreigner.', { face: 'normal' }],
      [SP.chilli, 'And get a job. *Little Yellow Duck* hires anyone who doesn’t sleep.', { face: 'happy' }],
    ]);
    G.flags.signPromised = true;
    walkTo('chilli', P.chilliStall.x, P.chilliStall.z, 3).then(() => { N.chilli.facing = Math.PI; });
    await beat(1.5);
  });
  toast('💭 Memory: <b>Little Chilli’s bowl</b> · 🌿 Chives unlocked');
  await card('You sleep on a folding bed\nin the back of Old Zhao’s shop.', '', 2.6);
}

// ---------------------------------------------------------------- Day 2

export async function day2() {
  G.day = 2;
  G.clock = 10 * 60;
  await card('Day 2', `21 days of leave left · ¥${G.money} in your pocket`, 2.2);
  setNight(false);
  setMusic('day');
  placeCast();
  setMode('foot');
  teleport(-15, -4.5, Math.PI);
  player.char.setFace('normal');
  updateCamera(0, true);
  $('hud').classList.remove('hidden');

  await cutscene(async () => {
    await fadeIn();
    face('grandma', player);
    await talk([
      [SP.grandma, 'No money, no noodles. Grandma’s rule.', { zh: '没钱，没面。', face: 'normal' }],
      [SP.grandma, 'Bring me back what you find out there. Every evening, we cook.', { face: 'happy' }],
      [SP.you, 'Right. A job. Little Yellow Duck, here I come.', { face: 'happy' }],
    ]);
    await duckSignup();
    player.char.setHat('duck');
    player.char.setShirt('#ffd23f');
    setMode('bike');
    player.heading = Math.PI / 2;
    emote(player.char, '🦆');
    sfx('quack');
    await beat(1.4);
  });

  toast('🛵 Steer with WASD / arrows / joystick · let go to slow down · 📱 Orders (O) to take a job', 6);
  bark(N.grandma.char, 'Drive safe! Don’t spill!');
  bark(N.chilli.char, 'Oi, Duck! Nice helmet!');
  G.clockRunning = true;
  G.flags.ordersOpen = true;
  $('btn-orders').classList.remove('hidden');
  objective('Open 📱 Orders (O) and take a job');
  setTimeout(openBoard, 900);

  const storyDone = () => STORY_ORDERS.every(id => G.ordersDone.has(id));
  while (!storyDone()) {
    G.flags.boardPick = null;
    await until(() => G.flags.boardPick || (G.clock >= 20 * 60 && !G.run));
    if (!G.flags.boardPick) break;
    const order = ORDERS.find(o => o.id === G.flags.boardPick);
    G.flags.boardPick = null;
    await runOrder(order);
    if (!storyDone() && G.clock < 20 * 60) objective('Open 📱 Orders (O) for the next job');
  }
  G.clockRunning = false;
  G.flags.ordersOpen = false;
  $('btn-orders').classList.add('hidden');
  objective(null);
  toast(G.clock >= 20 * 60 ? 'It’s getting dark. Time to head home.' : 'All the day’s big orders done! Back to Grandma.');
  await beat(2.5);
}

export function openBoard() {
  if (!G.flags.ordersOpen || G.busy > 0 || G.run || G.flags.cine) return;
  orderBoard(ORDERS).then(id => { if (id) G.flags.boardPick = id; });
}

// ---------------------------------------------------------------- Evening

export async function evening() {
  await card('Evening', 'Grandma has the pot on', 2);
  setNight(true);
  setMusic('night');
  placeCast(true);
  setMode('foot');
  player.char.setHat('duck');
  teleport(-15, -4.5, Math.PI);
  updateCamera(0, true);

  await cutscene(async () => {
    await fadeIn();
    face('grandma', player);
    await talk([
      [SP.grandma, 'You’re back! Sit. Tell me everything you found. Then we cook.', { face: 'happy' }],
      G.findings.size <= 1
        ? [SP.grandma, 'Not much today? Never mind. Bad bowls teach us too.', { face: 'normal' }]
        : [SP.grandma, `${G.findings.size} things! Good duck. Let’s see what they taste like.`, { face: 'happy', emote: '✨' }],
      [SP.grandma, 'And look, the street’s hungry. We open the hatch tonight. You take orders, I keep the fire.', { face: 'happy', emote: '🏮' }],
    ]);
  });
  await cutscene(async () => {
    await talk([
      [SP.grandma, 'But first. You’re serving Zhao’s noodles, so you should know why they’re called crossing the bridge.', { face: 'normal' }],
    ]);
    await legend();
    await talk([
      [SP.you, 'Is that… true?', { face: 'blank' }],
      [SP.grandma, 'Who knows! It’s a story. But the oil is true, and so is the love. Zhao’s father brought the recipe up from Mengzi.', { face: 'happy', emote: '🌉' }],
    ]);
  });
  const svc = await shopService({ title: 'Old Zhao’s · first night open' });
  await cutscene(async () => {
    await talk([
      [SP.grandma, 'Not bad, duck. Jianxinyuan on Baoshan Street has been doing this since 1906. We’ve been doing it for one night.', { face: 'happy' }],
      [SP.grandma, 'In Mengzi they say the craft is national heritage now. Since 2014! A bowl of noodles, heritage. Zhao would have laughed till he cried.', { face: 'happy', emote: '😂' }],
    ]);
    learn('masters'); learn('heritage');
  });
  // the night's bowls, in the shape the ending reads
  const r = { greens: svc.avg >= 85 ? 3 : svc.avg >= 65 ? 2 : 1, perfect: svc.avg >= 85, extras: [], avg: svc.avg, tips: svc.tips };
  await cutscene(async () => {
    if (r.perfect) {
      await tasteMoment({
        title: 'Almost Grandpa’s Bowl', desc: 'So close I could cry.', mode: 'missing',
        flavours: [{ k: 'savoury', word: 'warm' }, { k: 'rich', word: 'safe' }, { k: 'fresh', word: 'almost home' }],
        lesson: 'Almost. One note is still missing… and it isn’t in the pot.',
      });
      await talk([
        [SP.grandma, '…This. This is almost his bowl.', { face: 'cry', emote: '💧' }],
        [SP.grandma, 'Almost. Something is still missing. Not in the pot… I wonder who it’s for?', { face: 'sad' }],
      ]);
    } else {
      await tasteMoment({
        title: 'Our first night’s bowl', desc: 'The right things, in the right order.', mode: 'pop',
        flavours: [{ k: 'savoury', word: 'fine' }, { k: 'rich', word: 'correct' }, { k: 'fresh', word: 'okay' }],
        lesson: 'Correct. Clean. …pop. Where’s the spark Grandpa’s had?',
      });
      await talk([r.greens >= 2
        ? [SP.grandma, 'Close! Closer than that Wang will ever get.', { face: 'happy' }]
        : [SP.grandma, 'Terrible! Wonderful! Now we know what NOT to do.', { face: 'happy', emote: '😂' }]]);
    }
    if (r.extras.length) await talk([[SP.grandma, 'And no more sparklers in my kitchen.', { face: 'angry', emote: '💢' }]]);
  });
  await endCard(r);
}

async function endCard(r) {
  const avg = G.stars.length ? (G.stars.reduce((a, b) => a + b, 0) / G.stars.length).toFixed(1) : '—';
  await infoCard(`
    <h2>🌉 End of the prototype</h2>
    <p>Thanks for riding, ${esc(G.name)}!</p>
    <p class="sub">💰 ¥${G.money} · ⭐ ${avg} average · 📒 ${G.findings.size} findings · 🍽️ Food Dex ${G.foodDex.size}
      · 💃 Auntie encounters ${G.auntieGags} · First night: ${r.avg ?? '—'} pts avg ${r.perfect ? '(perfect!)' : ''}</p>
    ${notesHtml()}
    ${G.soul?.length ? `<h3>✨ Soul notes</h3>${G.soul.map(s => `<p class="sub"><b>${esc(s.title)}</b>: <i>${esc(s.lesson)}</i></p>`).join('')}` : ''}
    <h3>What’s next in the full game</h3>
    <p class="sub">Days 3–22: the rest of Kunming, Little Chilli & Uncle Spud’s feud, more Plankton schemes, the plain-broth customer,
      Qingming, the trip to Mengzi, and the Supreme Mega Championship.</p>
    <p class="sub">Questions to think about while you play: Were the deliveries fun? Which twist was best? Did the soup physics feel fair?</p>
    <div class="row" style="margin-top:10px">
      <button class="btn-soft" data-nav="#day2">Replay Day 2</button>
      <button class="btn-soft" data-nav="#">Start over</button>
    </div>`, 'Keep riding around');
}
