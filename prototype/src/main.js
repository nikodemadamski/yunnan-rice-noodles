// Boot, title screen, main loop, HUD and ambient gags.

import { G, CLOCK_SPEED, runTickers, fmtClock, esc } from './core.js';
import { W, P, initWorld, updateWorld, updateOcclusion, updateSun, applyShadows } from './world.js';
import { updateFx, feel } from './fx.js';
import { dressWorld } from './props.js';
import { initDecor, updateDecor } from './decor.js';
import { initLife, updateLife } from './life.js';
import { initDressing, updateDressing } from './dressing.js';
import { paperOverlay } from './textures.js';
import { player, initPlayer, updatePlayer, updateCamera, teleport, setMode } from './player.js';
import { N, initNPCs, updateNPCs } from './npcs.js';
import { initInput } from './input.js';
import { initAudio, setMusic, toggleMute, sfx, setEngine, speak, tapStream } from './audio.js';
import { updateFloating, bark, toast, openPanel, closePanel, fadeOut, emote, cutscene } from './ui.js';
import { updateInteract } from './interact.js';
import { updateRun } from './deliveries.js';
import { day1, day2, evening, openBoard } from './story.js';
import { opening } from './opening.js';
import { simScene } from './sim.js';
import { promptPalLive, chilliBowl } from './cook2d.js';
import { shopService } from './shop2d.js';
import './taste.js';

const $ = id => document.getElementById(id);

initWorld($('scene'));
initPlayer();
initNPCs();
initInput();
applyShadows();
dressWorld();
initDecor();
initLife();
initDressing();
document.getElementById('scene').after(paperOverlay());   // paper grain + vignette over the 3D, under the UI
teleport(P.start.x, P.start.z, Math.PI / 2);
updateCamera(0, true);

// ---------- HUD ----------

function meter(ico, label, val, color) {
  return `<div class="meter"><span>${ico}</span><div class="bar"><div class="fill" style="width:${val}%; background:${color}"></div></div>
    <span class="val">${Math.round(val)}%</span></div><div class="sub" style="font-size:11px; margin-left:26px">${label}</div>`;
}

let hudT = 0;
function updateHUD(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.1;
  $('clock').textContent = `Day ${G.day} · ${fmtClock(G.clock)}`;
  $('money').textContent = `¥ ${G.money}`;
  const run = G.run;
  const card = $('run-card');
  if (run && run.phase === 'ride') {
    card.classList.remove('hidden');
    const o = run.order;
    card.innerHTML = `<div>${o.ico} ${esc(o.title)} → ${esc(o.toName)}</div>
      ${meter(o.hot ? '🔥' : '🧊', o.hot ? 'Heat' : 'Freshness', run.heat, run.heat > 50 ? '#f08a4b' : '#6ec6ff')}
      ${meter(o.soup ? '🥣' : '📦', o.soup ? 'Spilled' : 'Jostled', run.spill, run.spill < 30 ? '#f0b429' : '#e2574c')}`;
  } else {
    card.classList.add('hidden');
  }
  const comp = $('compass');
  const tgt = W.markerTarget;
  if (tgt && G.busy === 0) {
    const dx = tgt.x - player.pos.x, dz = tgt.z - player.pos.z;
    if (Math.hypot(dx, dz) > 14) {
      comp.classList.remove('hidden');
      $('compass-arrow').style.transform = `rotate(${Math.atan2(dx, -dz)}rad)`;
    } else comp.classList.add('hidden');
  } else comp.classList.add('hidden');
}

$('btn-sound').addEventListener('click', () => { $('btn-sound').textContent = toggleMute() ? '🔇' : '🔊'; });
$('btn-orders').addEventListener('click', () => openBoard());
addEventListener('keydown', e => { if (e.code === 'KeyO' || e.code === 'Tab') { e.preventDefault(); openBoard(); } });
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  location.hash = nav.dataset.nav;   // '#day2' or '#' (start over)
  location.reload();
});

// ---------- ambient gags ----------

let auntieCool = 0, wangBarkT = 8;
function updateGags(dt) {
  auntieCool -= dt;
  wangBarkT -= dt;
  if (G.busy > 0 || G.flags.cutscene) return;
  const d = Math.hypot(player.pos.x - P.aunties.x, player.pos.z - P.aunties.z);
  if (d < 6.5 && auntieCool <= 0 && player.mode === 'bike') {
    auntieCool = 10;
    if (player.speed > 6) {
      G.auntieGags++;
      for (let i = 0; i < 8; i++) N[`auntie${i}`].behavior.chase = 2.2;
      bark(N.auntie0.char, '哎呀！Slow down, little Duck!');
      emote(N.auntie3.char, '💢');
      sfx('whack');
      player.slosh += 12;
      player.speed *= 0.3;
      if (G.auntieGags === 1) toast('💃 Running gag 1/3: <b>the Square-Dance Aunties</b>. Ride slowly past them…');
    } else {
      bark(N.auntie1.char, 'Good duck! Slow and polite! 👏');
    }
  }
  if (wangBarkT <= 0 && N.wang.char.root.visible && Math.hypot(player.pos.x - N.wang.pos.x, player.pos.z - N.wang.pos.z) < 14) {
    wangBarkT = 18;
    bark(N.wang.char, ['Supreme Mega! 48 toppings!', '30% off! Gold leaf on everything!', 'Like and subscribe, family!'][Math.floor(Math.random() * 3)]);
  }
}

// ---------- loop ----------

const speedLines = document.createElement('div');
speedLines.id = 'speedlines';
$('ui').prepend(speedLines);

let last = performance.now();
function frame(now) {
  const raw = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  // hit-stop: freeze the world for a few frames on impacts (UI keeps running)
  let dt = raw;
  if (feel.hitstop > 0) { feel.hitstop -= raw; dt = 0; }
  const t = now / 1000;
  if (G.clockRunning && G.busy === 0) G.clock += dt * CLOCK_SPEED;
  updatePlayer(dt, t);
  updateNPCs(dt, t);
  updateWorld(dt, t);
  updateDecor(raw, t, player.camFocus || player.pos);
  updateLife(dt, t, player.camFocus || player.pos);
  updateDressing(dt, t);
  updateGags(dt);
  updateRun(dt);
  updateInteract();
  runTickers(raw);
  updateFx(raw);
  updateCamera(raw);
  updateSun(player.camFocus || player.pos);
  updateOcclusion(W.camera.position, player.camFocus || player.pos);
  updateFloating(raw);
  updateHUD(raw);
  const v = player.mode === 'bike' && !G.flags.frozen3d && !G.flags.cine ? player.speed / 17 : 0;
  setEngine(v);
  speedLines.style.opacity = (Math.max(0, (v - 0.78) / 0.22) * 0.6).toFixed(2);
  if (!G.flags.frozen3d) W.renderer.render(W.scene, W.camera);   // a full-screen minigame covers the world
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- title & flow ----------

const params = new URLSearchParams(location.search);
const start = params.get('start') || location.hash.slice(1) || null;

function title() {
  return new Promise(res => {
    const p = openPanel(`<div class="card title-card">
      <div class="big">过桥</div>
      <div class="en">Crossing the Bridge</div>
      <p class="sub">A vibe coder from Ireland. 22 days of leave. One missing grandpa.<br>And a very yellow delivery bike.</p>
      <div class="row" style="justify-content:center; margin-top:14px">
        <button class="btn-big" id="t-start">▶ Start</button>
        <button class="btn-soft" id="t-skip">Skip to Day 2 (deliveries)</button>
        <button class="btn-soft" id="t-shop">🍜 Noodle shop (new)</button>
      </div>
      <p class="sub" style="margin-top:14px">Prototype · Day 1–2 · Keyboard: WASD/arrows + E · Phone: joystick + yellow button · Story scenes play by themselves (Skip ⏭ any time)</p>
    </div>`);
    p.querySelector('#t-start').addEventListener('click', () => { initAudio(); setMusic('day'); closePanel(); res('full'); });
    p.querySelector('#t-skip').addEventListener('click', () => { initAudio(); setMusic('day'); closePanel(); res('day2'); });
    p.querySelector('#t-shop').addEventListener('click', () => { initAudio(); setMusic('day'); closePanel(); res('shop'); });
  });
}

async function run() {
  let mode = start;
  if (!mode) mode = await title();
  else initAudio();
  if (mode === 'shop') {
    teleport(-15, -7.2, Math.PI);
    updateCamera(0, true);
    await shopService();
    location.hash = '';
    location.reload();
    return;
  }
  // dev shortcuts for single scenes: #opening, #sim, #live, #chilli
  if (['opening', 'opening2', 'sim', 'live', 'chilli', 'taste'].includes(mode)) {
    $('fade').classList.remove('on');
    if (mode === 'opening') await opening();
    if (mode === 'opening2') await opening({ dublinOnly: true });
    if (mode === 'sim') await simScene();
    if (mode === 'live') await promptPalLive();
    if (mode === 'chilli') await chilliBowl();
    if (mode === 'taste') {                       // the three kinds of taste moment
      setMode('foot'); teleport(-11.5, -5.6, 0); updateCamera(0, true);
      const T = window.__taste;
      await T({ title: 'Grandpa Zhao’s Noodles', mode: 'perfect', flavours: [{ k: 'savoury', word: 'warm' }, { k: 'rich', word: 'safe' }, { k: 'fresh', word: 'a spring morning' }, { k: 'sweet', word: 'Grandpa’s laugh' }, { k: 'smoky', word: 'home' }], heart: 'loved', lesson: 'I didn’t know a bowl of noodles could feel like being loved.' });
      await T({ title: 'Our first bowl', mode: 'pop', flavours: [{ k: 'savoury', word: 'fine' }, { k: 'rich', word: 'correct' }, { k: 'fresh', word: 'okay' }], lesson: 'Correct. Clean. …pop.' });
      await T({ title: 'Supreme Mega Bowl™', mode: 'bomb', flavours: ['rich', 'savoury', 'sweet', 'spicy', 'sour', 'smoky', 'floral'].map(k => ({ k, word: k.toUpperCase() })), lesson: 'Everything shouting at once. Nobody singing.' });
      await T({ title: 'Almost Grandpa’s Bowl', mode: 'missing', flavours: [{ k: 'savoury', word: 'old hen broth' }, { k: 'rich', word: 'a shine of fat' }, { k: 'fresh', word: 'chives' }], lesson: 'Almost. One note is still missing…' });
    }
    toast(`Scene finished · ${esc(JSON.stringify(G.flags.chilliBowl || G.flags.sim || G.name))}`, 8);
    return;
  }
  if (mode === 'full') {
    await fadeOut(0.3);
    $('fade').classList.remove('on');
    await opening();
    await simScene();
    await day1();
  }
  if (mode === 'full' || mode === 'day2') {
    if (mode === 'day2') {
      G.name = params.get('name') || 'Duck';
      G.findings.add('top:chives');   // Little Chilli's bowl from Day 1
    }
    await day2();
  }
  if (mode === 'evening') {
    G.name = 'Niko';
    for (const f of ['broth:hen', 'oil:fat', 'top:chives', 'oil:chilli', 'top:rose', 'broth:flower']) G.findings.add(f);
  }
  await evening();
}

window.__game = { G, player, W, N, setMode, teleport };
window.__audio = { initAudio, setMusic, speak, sfx, tapStream };   // dev: previews and tests
run();
