// Boot, title screen, main loop, HUD and ambient gags.

import { G, CLOCK_SPEED, runTickers, fmtClock, esc } from './core.js';
import { W, P, initWorld, updateWorld, updateOcclusion } from './world.js';
import { player, initPlayer, updatePlayer, updateCamera, teleport } from './player.js';
import { N, initNPCs, updateNPCs } from './npcs.js';
import { initInput } from './input.js';
import { initAudio, setMusic, toggleMute, sfx } from './audio.js';
import { updateFloating, bark, toast, openPanel, closePanel, fadeOut, emote } from './ui.js';
import { updateInteract } from './interact.js';
import { updateRun } from './deliveries.js';
import { day1, day2, evening, openBoard } from './story.js';
import { prologue } from './phone.js';

const $ = id => document.getElementById(id);

initWorld($('scene'));
initPlayer();
initNPCs();
initInput();
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
  if (nav) location.search = nav.dataset.nav;
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

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (G.clockRunning && G.busy === 0) G.clock += dt * CLOCK_SPEED;
  updatePlayer(dt, t);
  updateNPCs(dt, t);
  updateWorld(dt, t);
  updateGags(dt);
  updateRun(dt);
  updateInteract();
  runTickers(dt);
  updateCamera(dt);
  updateOcclusion(W.camera.position, player.camFocus || player.pos);
  updateFloating(dt);
  updateHUD(dt);
  W.renderer.render(W.scene, W.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- title & flow ----------

const params = new URLSearchParams(location.search);
const start = params.get('start');

function title() {
  return new Promise(res => {
    const p = openPanel(`<div class="card title-card">
      <div class="big">过桥</div>
      <div class="en">Crossing the Bridge</div>
      <p class="sub">A vibe coder from Ireland. 22 days of leave. One missing grandpa.<br>And a very yellow delivery bike.</p>
      <div class="row" style="justify-content:center; margin-top:14px">
        <button class="btn-big" id="t-start">▶ Start</button>
        <button class="btn-soft" id="t-skip">Skip to Day 2 (deliveries)</button>
      </div>
      <p class="sub" style="margin-top:14px">Prototype · Day 1–2 · Keyboard: WASD/arrows + E/Space · Phone: joystick + yellow button · Hold Shift to speed up text</p>
    </div>`);
    p.querySelector('#t-start').addEventListener('click', () => { initAudio(); setMusic('day'); closePanel(); res('full'); });
    p.querySelector('#t-skip').addEventListener('click', () => { initAudio(); setMusic('day'); closePanel(); res('day2'); });
  });
}

async function run() {
  let mode = start;
  if (!mode) mode = await title();
  else initAudio();
  if (mode === 'full') {
    await fadeOut(0.3);
    $('fade').classList.remove('on');
    await prologue();
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

window.__game = { G, player, W, N };
run();
