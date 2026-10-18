// Day 1 cooking, on the same 3D counter as Grandma's kitchen.
//  (a) promptPalLive: Old Wang streams you cooking the AI's "perfect" recipe.
//      Every absurd step you do well gets a gold PERFECT!, and "Are you sure?"
//      makes the AI double down. Grandma watches from behind the counter.
//  (b) chilliBowl: night, Little Chilli's stall. The same verbs, slowed down:
//      warm the bowl, ladle gently, one drop of oil, a few chives, hands off.
//      No timer, no score, no music. Ends in her memory of Grandpa Zhao.
// Design notes: docs/design/DAY1_COOKING.md.

import * as THREE from 'three';
import { G, addTicker, clamp } from './core.js';
import { W } from './world.js';
import { makeCharacter, mat, toon } from './characters.js';
import { emote, bark, beat, fadeIn } from './ui.js';
import { sfx, note, setMusic } from './audio.js';
import { addTrauma, hitstop } from './fx.js';
import { act } from './acting.js';
import { player } from './player.js';
import { chilliFlashback } from './opening.js';
import {
  begin, end, kit, hudEl, POT, BOWL, TOP, KX, KZ, P, run, speedPx, pickAt, planeAt, toScreen, burst, mesh, place,
  clearItems, stamp, hint, pop, gauge, setStep, help, title, focus, TOPPING_ART, jar, dragInto,
} from './kitchen3d.js';

// =====================================================================
// (a) PromptPal Live
// =====================================================================

const LIVE = [
  { id: 'cube', say: 'Step 1: Unwrap 1 premium stock cube 🧊 and add it to the boiling water. Authentic!', more: 'Great question! Use TWO cubes. Umami is a numbers game 🙂',
    help: 'Drag the stock cube into the pot.', chat: ['就这？', 'stock cube lol', 'is this a prank', '老王 who is this guy', '😐'] },
  { id: 'stir', say: 'Step 2: Stir clockwise 20× to activate the umami 🙂', more: 'You’re right to check! 20 more stirs 🙂',
    help: 'Stir round and round the pot.', chat: ['转转转', 'activate umami 😂', 'he is so serious', '加油外国人', 'spin to win'] },
  { id: 'cheese', say: 'Step 3: Fusion is the future! Grate 200 g of cheddar straight into the broth 🧀', more: 'Absolutely sure! Make it 400 g. Cheese is protein 💪',
    help: 'Scrub left and right to grate.', chat: ['CHEESE?!?!', '芝士？？？', '奶奶 😱', 'NO', 'cheddar in 米线', '黑暗料理'] },
  { id: 'pour', say: 'Step 4: Aerate the noodles! Pour from a height for a lighter texture ☁️', more: 'Yes! Higher. Height is flavour 📈',
    help: 'Grab the noodles and drag them down into the pot.', chat: ['镜头！！', 'my screen is wet', 'RIP camera', '哈哈哈哈', 'splash zone'] },
  { id: 'gold', say: 'Step 5: Luxury tier ✨ Gently apply edible gold leaf.', more: 'I’m 97% confident 🙂 More gold. Gold = premium.',
    help: 'Tap each gold leaf.', chat: ['金人', 'rich noodle', 'gold leaf lmao', '土豪', 'he is golden now'] },
  { id: 'spark', say: 'Step 6: Finish with a sparkler for presentation! Insert, then strike to light 🎆', more: 'Two sparklers. For balance 🙂',
    help: 'Swipe fast to strike it!', chat: ['NO NO NO', 'fire in soup??', '要着火了', 'sparkler in SOUP??', 'call 119'] },
];
const VIEWERS = [1204, 3311, 9870, 28400, 71200, 166000, 412000];

function liveHud() {
  const el = document.createElement('div');
  el.className = 'live3';
  el.innerHTML = `
    <div class="live3-badge"><b>● LIVE</b><span class="live3-views">👁 1,204</span><small>老王 Supreme Mega 直播间</small></div>
    <div class="ck-chat live3-chat">
      <div class="ck-chat-head"><span class="ck-pp">P</span><b>PromptPal</b><small>● online</small></div>
      <div class="ck-msgs"></div>
      <button class="ck-sure">🤔 Are you sure?</button>
    </div>
    <div class="live3-comments"></div>
    <div class="live3-lens"></div>`;
  hudEl().appendChild(el);
  return el;
}

export async function promptPalLive() {
  const K = begin({ steps: ['Cube', 'Stir', 'Cheese', 'Pour', 'Gold', 'Spark'], host: 'gran', station: 'broth' });
  const host = K.host;
  // Old Wang, filming, behind the counter on the right
  const wang = makeCharacter({ skin: '#f0c8a0', shirt: '#ffd700', pants: '#e0418a', hair: '#1a1a1a', hairStyle: 'short', wide: 1.35, prop: 'selfie', glasses: true });
  wang.root.position.set(KX + 1.4, 0.45, KZ - 3.7);
  wang.arms[1].rotation.x = -1.6;
  W.scene.add(wang.root);
  const L = liveHud();
  const msgs = L.querySelector('.ck-msgs'), sure = L.querySelector('.ck-sure'), cmts = L.querySelector('.live3-comments');
  let viewers = VIEWERS[0];
  const bubble = (who, txt) => {
    const b = document.createElement('div');
    b.className = `ck-b ${who}`;
    b.textContent = txt;
    msgs.appendChild(b);
    msgs.scrollTop = msgs.scrollHeight;
    sfx(who === 'pp' ? 'send' : 'type');
  };
  const comment = (txt, big = false) => {
    const c = document.createElement('div');
    c.className = `live3-c ${big ? 'big' : ''}`;
    c.textContent = txt;
    c.style.top = `${12 + Math.random() * 40}%`;
    c.style.color = `hsl(${Math.random() * 360}, 90%, 92%)`;
    c.style.animationDuration = `${5 + Math.random() * 3}s`;
    cmts.appendChild(c);
    setTimeout(() => c.remove(), 8500);
  };
  const setViewers = v => { viewers = v; L.querySelector('.live3-views').textContent = `👁 ${v.toLocaleString()}`; };
  const faces = ['flat', 'squint', 'shock', 'sad', 'blank', 'blank'];
  let chatTimer = setInterval(() => { if (cur) comment(cur.chat[Math.floor(Math.random() * cur.chat.length)]); }, 1100);
  let cur = null, more = false;
  sure.addEventListener('click', () => {
    if (!cur || more) return;
    more = true; sure.disabled = true;
    bubble('me', 'Are you sure? 🤔');
    setTimeout(() => { bubble('pp', cur.more); comment('他问AI确定吗 😂', true); }, 600);
  });
  const perfect = async i => {
    sfx('cheer');
    setViewers(VIEWERS[i + 1]);
    for (let k = 0; k < 5; k++) setTimeout(() => comment(LIVE[i].chat[k % LIVE[i].chat.length], k === 0), k * 150);
    host.setFace(faces[i]);
    act(wang, 'bounce'); setTimeout(() => act(wang, null), 1200);
    await stamp(1, { react: false });
    host.setFace(faces[i]);
    emote(host, ['😐', '🤨', '😱', '😢', '😶', '😶'][i], 1.4);
  };
  const startStep = async (i, station) => {
    cur = LIVE[i]; more = false; sure.disabled = false;
    if (station) focus(station);
    setStep(i, `${i + 1} · ${cur.say.split(':')[0].replace(/^Step \d+/, 'PromptPal says')}`, cur.help);
    bubble('pp', cur.say);
    await beat(0.6);
  };

  try {
    setMusic('day');
    // 1 · the stock cube (or two)
    await startStep(0, 'broth');
    const cubes = [];
    const mkCube = (x) => {
      const o = new THREE.Group();
      mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), '#f2c14e', 0, 0.25, 0, { parent: o });
      o.userData.pick = `cube${cubes.length}`;
      place(o, x, KZ - 1.6); K.pickables.push(o);
      cubes.push({ obj: o, x, z: KZ - 1.6 });
    };
    mkCube(KX - 0.4);
    let dropped = 0;
    while (dropped < (more ? 2 : 1)) {
      if (more && cubes.length < 2) mkCube(KX + 0.8);
      const left = cubes.filter(c => !c.done);
      const id = await dragInto(left, POT, 1.2);
      const c = cubes.find(c => c.obj.userData.pick === id); c.done = true;
      W.scene.remove(c.obj);
      dropped++;
      sfx('splash'); hitstop(60); addTrauma(0.2);
      burst(POT.x, TOP + 1.3, POT.z, 14, '#d9ecf5', { up: 4 });
      K.potBroth.material.color.set(dropped > 1 ? '#a8742f' : '#c99a55');
    }
    clearItems();
    await perfect(0);

    // 2 · stir 20× (then "20 more")
    await startStep(1, 'live');
    const spoon = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), '#b98149', 0, 1.1, 0, { parent: spoon });
    mesh(new THREE.SphereGeometry(0.2, 10, 8), '#b98149', 0, 0, 0, { parent: spoon }).scale.y = 0.5;
    place(spoon, POT.x + 0.5, POT.z, TOP + 1.1);
    spoon.rotation.z = -0.4;
    const c0 = toScreen(POT.x, TOP + 1.1, POT.z);
    let stirs = 0, last = null, need = 20, bonusSaid = false;
    await run((dt, t) => {
      if (more && need === 20) need = 40;
      if (P.down) {
        const a = Math.atan2(P.y - c0.y, P.x - c0.x), d = Math.hypot(P.y - c0.y, P.x - c0.x);
        if (last !== null && d > 25) {
          let da = a - last; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) < 1) {
            const before = Math.floor(stirs);
            stirs += Math.abs(da) / (Math.PI * 2) * 6 * (bonusSaid ? 2 : 1);
            if (Math.floor(stirs) > before) { note(330 + Math.min(40, stirs) * 14, 0.08, 'triangle', 0.15); const s = toScreen(POT.x, TOP + 2, POT.z); pop(`${Math.floor(stirs)}/${need}`, s.x, s.y); }
          }
        }
        last = a;
        const p = planeAt(P.x, P.y, TOP + 1.1);
        const dx = p.x - POT.x, dz = p.z - POT.z, r = Math.min(0.85, Math.hypot(dx, dz));
        const ang = Math.atan2(dz, dx);
        spoon.position.set(POT.x + Math.cos(ang) * r, TOP + 1.1, POT.z + Math.sin(ang) * r);
      } else last = null;
      if (stirs >= 20 && !bonusSaid && need <= 20) { bonusSaid = true; need = 40; bubble('pp', 'Great! 20 more 🙂'); comment('20 MORE?!', true); }
      if (stirs >= need || G.skip) return true;
    });
    clearItems();
    await perfect(1);

    // 3 · grate the cheddar (it piles up and over)
    await startStep(2, 'live');
    const block = new THREE.Group();
    mesh(new THREE.BoxGeometry(1.0, 0.6, 0.7), '#ffd84d', 0, 0, 0, { parent: block });
    place(block, POT.x, POT.z, TOP + 2.4);
    const grater = mesh(new THREE.BoxGeometry(1.6, 1.2, 0.08), '#c9ced6', POT.x, TOP + 2.0, POT.z + 0.45);
    K.items.push(grater);
    const mound = mesh(new THREE.SphereGeometry(1.0, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), '#ffd84d', POT.x, TOP + 1.15, POT.z);
    mound.scale.set(0.01, 0.01, 0.01);
    K.items.push(mound);
    let grates = 0, dir = 0, anchor = null;
    const needG = () => (more ? 24 : 12);
    await run(() => {
      if (P.down) {
        const p = planeAt(P.x, P.y, TOP + 2.4);
        block.position.x = clamp(p.x, POT.x - 0.9, POT.x + 0.9);
        if (anchor === null) anchor = P.x;
        const d = P.x - anchor, s = Math.sign(d);
        if (Math.abs(d) > 22 && s !== dir) {
          dir = s; anchor = P.x; grates++;
          sfx('type'); note(180 + Math.random() * 40, 0.06, 'sawtooth', 0.1); addTrauma(0.05);
          burst(block.position.x, TOP + 2.0, POT.z + 0.3, 6, '#ffd84d', { up: 0.5, speed: 1, r: 0.05, g: 7 });
          const k = Math.min(1.6, grates / 12 * 1.15);
          mound.scale.set(k, k * 0.55, k);
        } else if (s === dir) anchor = dir > 0 ? Math.max(anchor, P.x) : Math.min(anchor, P.x);
      } else { anchor = null; dir = 0; }
      if (grates >= needG() || G.skip) return true;
    });
    W.scene.remove(block); W.scene.remove(grater);
    await perfect(2);

    // 4 · pour the noodles "from a height"
    await startStep(3, 'live');
    const bundle = new THREE.Group();
    mesh(new THREE.TorusKnotGeometry(0.4, 0.07, 64, 6, 3, 5), '#fffaf0', 0, 0, 0, { parent: bundle }).scale.y = 2;
    const grab = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    bundle.add(grab);                                  // a forgiving grab area round the tangle
    bundle.userData.pick = 'bundle';
    const startY = TOP + (more ? 4.6 : 3.8);
    place(bundle, POT.x, POT.z, startY);
    K.pickables = [bundle];
    let held = false;
    await run((dt, t, evs) => {
      for (const e of evs) { if (e.type === 'down' && pickAt(e.x, e.y, [bundle])) held = true; if (e.type === 'up') held = false; }
      if (held) {
        const p = planeAt(P.x, P.y, TOP + 2);
        bundle.position.y += (clamp(startY - (P.y - toScreen(POT.x, startY, POT.z).y) * 0.02, TOP + 1.2, startY) - bundle.position.y) * Math.min(1, dt * 14);
        if (Math.random() < 0.4) burst(bundle.position.x, bundle.position.y - 0.4, POT.z, 1, '#fffaf0', { up: -2, speed: 0.2, r: 0.04, g: 4 });
      } else bundle.position.y += (startY - bundle.position.y) * Math.min(1, dt * 4);
      if (bundle.position.y < TOP + 1.45 || G.skip) return true;
    });
    sfx('splash'); sfx('whack'); hitstop(100); addTrauma(0.8);
    burst(POT.x, TOP + 1.4, POT.z, 40, '#f2e2b6', { up: 6, speed: 4 });
    const lens = L.querySelector('.live3-lens');
    for (let k = 0; k < 9; k++) {
      const b = document.createElement('i');
      b.style.cssText = `left:${5 + Math.random() * 85}%; top:${5 + Math.random() * 80}%; width:${40 + Math.random() * 90}px; height:${36 + Math.random() * 80}px;`;
      lens.appendChild(b);
    }
    W.scene.remove(bundle);
    await perfect(3);

    // 5 · gold leaf, gently
    await startStep(4, 'live');
    const leaves = [];
    const mkLeaves = n => { for (let k = 0; k < n; k++) {
      const lf = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.42), toon({ color: '#f2c14e', emissive: '#7a5a10', emissiveIntensity: 0.4 }), POT.x + 0.5 + (k % 5) * 0.62, TOP + 1.7 + (k % 3) * 0.45, POT.z - 0.4 + Math.floor(k / 5) * 0.9);
      lf.userData.pick = 'leaf'; lf.userData.ph = k; leaves.push(lf); K.items.push(lf);
    } };
    mkLeaves(5);
    let got = 0, extraAdded = false;
    await run((dt, t, evs) => {
      if (more && !extraAdded) { extraAdded = true; mkLeaves(4); }
      for (const lf of leaves) if (lf.visible) { lf.position.y += Math.sin(t * 2 + lf.userData.ph) * 0.004; lf.rotation.y += dt * 0.8; }
      for (const e of evs) if (e.type === 'down') {
        const lf = pickAt(e.x, e.y, leaves.filter(l => l.visible));
        if (lf) {
          lf.visible = false; got++;
          sfx('pop'); note(880 + got * 60, 0.12, 'sine', 0.15);
          burst(lf.position.x, lf.position.y, lf.position.z, 8, '#f2c14e', { up: 1, speed: 1.2, r: 0.05 });
          const s = toScreen(lf.position.x, lf.position.y, lf.position.z); pop('✨', s.x, s.y, 'gold');
        }
      }
      if (got >= leaves.length || G.skip) return true;
    });
    const face = document.createElement('i'); face.className = 'leaf'; lens.appendChild(face);   // the last one sticks to your face
    comment('金人 😂', true); comment('ON HIS FACE', true);
    clearItems();
    await perfect(4);

    // 6 · the sparkler, and the finale
    await startStep(5, 'live');
    const sticks = [];
    const mkStick = x => { const st = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), '#9aa0a8', x, TOP + 1.9, POT.z, { ink: false }); st.rotation.z = 0.2; sticks.push(st); K.items.push(st); };
    mkStick(POT.x + 0.2);
    let strikes = 0;
    await run((dt, t, evs) => {
      if (more && sticks.length < 2) mkStick(POT.x - 0.3);
      for (const e of evs) if (e.type === 'up' && Math.hypot(e.dx, e.dy) > 80 && e.ms < 700) {
        strikes++;
        sfx('whack'); hitstop(80); addTrauma(0.5);
        burst(POT.x, TOP + 2.7, POT.z, 24, '#ffe28a', { up: 3, speed: 3, r: 0.05 });
      }
      if (strikes >= sticks.length || G.skip) return true;
    });
    await perfect(5);
    cur = null;
    clearInterval(chatTimer);
    sure.disabled = true;
    bubble('pp', 'Your dish is complete! 🎉 Rated 10/10 by me 🙂');
    // finale: fizz, foam, smoke, the alarm, and Grandma's face
    setMusic(null);
    const alarm = document.createElement('div'); alarm.className = 'live3-alarm'; L.appendChild(alarm);
    let ft = 0;
    await run(dt => {
      ft += dt;
      for (const st of sticks) if (Math.random() < 0.8) burst(st.position.x, TOP + 2.7, POT.z, 2, '#fff2a8', { up: 2, speed: 2.5, r: 0.04, life: 0.5 });
      if (Math.random() < 0.35) burst(POT.x + (Math.random() - 0.5) * 1.6, TOP + 1.6, POT.z, 1, '#8a8a96', { up: 0.8, speed: 0.3, r: 0.5, g: -0.6, life: 2.6 });
      if (Math.random() < 0.3) burst(POT.x + (Math.random() - 0.5) * 1.8, TOP + 1.3, POT.z + (Math.random() - 0.5) * 1.4, 1, '#fffdf5', { up: 0.3, speed: 0.1, r: 0.25, g: 0, life: 3 });
      if (Math.floor(ft / 0.25) % 2 === 0) note(3100, 0.05, 'square', 0.06);
      if (Math.random() < 0.5) comment(['哈哈哈哈哈', 'CHEESE?!?!', 'RIP noodles', '老王666', '奶奶的表情 😭', '黑暗料理', 'AI recipe 🤡', '119!!!'][Math.floor(Math.random() * 8)], Math.random() < 0.2);
      if (ft > 2.6 || G.skip) return true;
    });
    // cut to Grandma: her face says everything
    player.camShot = { pos: { x: host.root.position.x + 0.6, y: 3.0, z: KZ + 1.6 }, look: { x: host.root.position.x, y: 2.2, z: host.root.position.z }, speed: 99 };
    for (const f of ['shock', 'sad', 'blank']) { host.setFace(f); await beat(0.7); }
    alarm.remove();
    sfx('whack'); sfx('fail');
    setViewers(2300000);
    const viral = document.createElement('div'); viral.className = 'live3-viral'; viral.textContent = 'VIRAL'; L.appendChild(viral);
    hitstop(200);
    await beat(2.2);
  } finally {
    clearInterval(chatTimer);
    W.scene.remove(wang.root);
    end();
    G.flags.viral = true;
  }
}

// =====================================================================
// (b) Little Chilli's bowl
// =====================================================================

export async function chilliBowl() {
  setMusic(null);
  const K = begin({ steps: ['Warm', 'Ladle', 'Oil', 'Chives', 'Eat'], host: 'chilli', night: true, station: 'chilli' });
  const chilli = K.host;
  const rec = { warm: false, slow: true, oneDrop: true, chives: true, waited: false };
  chilli.setFace('normal');
  const say = (line, hint = '') => { title(line); help(hint); bark(chilli, line, 2.4); };
  K.bowl.userData.pick = 'bowl';
  K.bowlBroth.visible = false;
  try {
    // 1 · warm the bowl: cold bowl, cold soup
    setStep(0, 'Cold bowl, cold soup. Warm it.', 'Press and hold the bowl.');
    const frost = mesh(new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }), BOWL.x, TOP + 0.56, BOWL.z, { ink: false });
    frost.scale.y = 0.55;
    K.items.push(frost);
    let warm = 0, hum = 0;
    await run((dt, t, evs) => {
      const on = P.down && pickAt(P.x, P.y, [K.bowl]) && speedPx() < 400;
      warm = clamp(warm + (on ? dt / 3 : -dt * 0.1), 0, 1);
      frost.material.opacity = 0.75 * (1 - warm);
      gauge(warm, 0.97, 1, on ? 'Warming…' : 'Hold the bowl');
      if (on && Math.floor(warm * 6) > hum) { hum = Math.floor(warm * 6); note(220 + hum * 30, 0.4, 'sine', 0.07); }
      if (warm >= 1 || G.skip) return true;
    });
    gauge(null);
    rec.warm = true;
    note(523, 0.6, 'sine', 0.08);
    clearItems();
    chilli.setFace('happy');
    await beat(0.6);

    // 2 · ladle, slowly
    setStep(1, '', '');
    say('慢慢来。Slowly.', 'Drag broth from the pot to the bowl. Slowly.');
    focus('build');
    await beat(1.0);
    const ladle = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#c9ced6', 0, 0, 0, { parent: ladle });
    const ladleBroth = mesh(new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), '#f2c46d', 0, -0.02, 0, { parent: ladle, ink: false });
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), '#9aa0a8', 0.55, 0.6, 0, { parent: ladle }).rotation.z = -0.9;
    place(ladle, POT.x + 0.6, POT.z, TOP + 1.3);
    let fills = 0, carrying = false, corrected = false;
    let level = 0;
    await run((dt, t, evs) => {
      const limit = corrected ? 520 : 700;
      for (const e of evs) if (e.type === 'down') {
        const p = planeAt(e.x, e.y, TOP + 1.3);
        if (Math.hypot(p.x - POT.x, p.z - POT.z) < 1.4) { carrying = true; ladleBroth.visible = true; note(300, 0.2, 'sine', 0.05); }
      }
      if (carrying) {
        if (!P.down) { carrying = false; }
        else {
          const p = planeAt(P.x, P.y, TOP + 1.3);
          ladle.position.lerp(new THREE.Vector3(p.x, TOP + 1.3, p.z), Math.min(1, dt * 16));
          if (speedPx() > limit) {
            burst(ladle.position.x, ladle.position.y, ladle.position.z, 10, '#f2c46d', { up: 1.5, speed: 2, r: 0.05 });
            note(200, 0.25, 'sine', 0.06);
            say('慢。(Slow.)', 'Gently. Like carrying a sleeping cat.');
            chilli.setFace('angry');
            setTimeout(() => chilli.setFace('normal'), 1200);
            corrected = true; rec.slow = false;
            carrying = false; ladleBroth.visible = false;
          } else if (Math.hypot(ladle.position.x - BOWL.x, ladle.position.z - BOWL.z) < 0.7) {
            fills++; carrying = false; ladleBroth.visible = false;
            level = fills / 2;
            K.bowlBroth.visible = true;
            K.bowlBroth.material.color.set('#f2c46d');
            K.bowlBroth.position.y = 0.2 + 0.24 * level;
            K.bowlBroth.scale.setScalar(0.75 + 0.25 * level);
            note(392, 0.5, 'sine', 0.07);
            burst(BOWL.x, TOP + 0.9, BOWL.z, 5, '#ffffff', { up: 0.8, speed: 0.4, r: 0.12, g: -0.5, life: 1.4 });
            if (fills < 2) say('Again. 慢慢来.', 'One more ladle.');
          }
        }
      } else ladle.position.lerp(new THREE.Vector3(POT.x + 0.6, TOP + 1.3, POT.z), Math.min(1, dt * 5));
      if (fills >= 2 || G.skip) return true;
    });
    clearItems();
    chilli.setFace('happy');

    // 3 · one shine of oil, then resist
    setStep(2, '', '');
    say('One shine of oil.', 'Hold the jar for ONE drop.');
    focus('chilli');
    const glow = toon({ color: '#f2c14e', emissive: '#ffb300', emissiveIntensity: 0 });
    const oil = jar('#f2c14e'); oil.userData.pick = 'oil';
    place(oil, BOWL.x + 1.5, BOWL.z - 0.7);
    const phone = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.9), '#1d1d22', BOWL.x - 0.4, TOP + 0.03, BOWL.z + 1.5);
    phone.userData.pick = 'phone'; K.items.push(phone);
    const phoneNote = document.createElement('div'); phoneNote.className = 'phone3 hidden'; phoneNote.textContent = 'PromptPal: Add gold leaf? 🙂'; hudEl().appendChild(phoneNote);
    let dropped = false, tempt = 0, still = 0, chJar = null, wiping = 0, holdT = 0;
    await run((dt, t, evs) => {
      if (!dropped) {
        if (P.down && pickAt(P.x, P.y, [oil])) holdT += dt; else holdT = 0;
        if (holdT > 0.35) {
          dropped = true;
          burst(BOWL.x + 0.6, TOP + 1.2, BOWL.z - 0.2, 1, '#f2c14e', { up: -1, speed: 0, r: 0.08, g: 6, life: 0.5 });
          K.oilLayer.material.color.set('#ffd76a'); K.oilLayer.material.opacity = 0.35;
          note(660, 0.3, 'sine', 0.08);
          help('');
        }
        return;
      }
      // the temptations
      tempt += dt;
      oil.children[1].material = glow;
      glow.emissiveIntensity = 0.4 + Math.sin(t * 5) * 0.4;
      if (!chJar && tempt > 0.6) { chJar = jar('#c0281e'); chJar.userData.pick = 'chilliJar'; place(chJar, BOWL.x + 4.2, BOWL.z - 0.9); }
      if (chJar) chJar.position.x += (BOWL.x + 2.35 - chJar.position.x) * Math.min(1, dt * 2);
      if (tempt > 1.0 && !rec.waited) { phoneNote.classList.remove('hidden'); const s = toScreen(phone.position.x, TOP + 0.6, phone.position.z); phoneNote.style.left = `${s.x}px`; phoneNote.style.top = `${s.y}px`; }
      if (P.down) still = 0; else still += dt;
      for (const e of evs) if (e.type === 'down' && wiping <= 0) {
        const o = pickAt(e.x, e.y, [oil, phone, ...(chJar ? [chJar] : [])]);
        if (o) {
          rec.oneDrop = false;
          K.oilLayer.material.color.set(o === chJar ? '#d8401f' : o === phone ? '#f2c14e' : '#e8a020');
          K.oilLayer.material.opacity = 0.9;
          chilli.setFace('sad'); emote(chilli, '😮‍💨', 1.4);
          say('…唉。(sigh)', 'She wipes the bowl. One shine of oil.');
          wiping = 1.6;
        }
      }
      if (wiping > 0) { wiping -= dt; if (wiping <= 0) { K.oilLayer.material.color.set('#ffd76a'); K.oilLayer.material.opacity = 0.35; chilli.setFace('normal'); still = 0; } }
      if (still > 3 && wiping <= 0) return true;
      if (G.skip) return true;
    });
    rec.waited = true;
    phoneNote.textContent = '🔋 0%'; setTimeout(() => phoneNote.remove(), 900);
    say('…Good.', '');
    chilli.setFace('happy');
    note(110, 0.4, 'sine', 0.06);
    await beat(1.4);
    clearItems();

    // 4 · a few chives
    setStep(3, '', '');
    focus('chilli');
    say('A few chives.', 'Tap over the bowl to sprinkle.');
    let n = 0, idle = 0;
    const bits = [];
    await run((dt, t, evs) => {
      idle += dt;
      for (const e of evs) if (e.type === 'down') {
        const p = planeAt(e.x, e.y, TOP + 0.5);
        if (Math.hypot(p.x - BOWL.x, p.z - BOWL.z) > 1.2) continue;
        const k = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) {
          const c = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 5).rotateZ(Math.PI / 2), '#3f9d48', clamp(p.x + (Math.random() - 0.5) * 0.4, BOWL.x - 0.7, BOWL.x + 0.7), TOP + 0.48, clamp(p.z + (Math.random() - 0.5) * 0.4, BOWL.z - 0.7, BOWL.z + 0.7), { ink: false });
          c.rotation.y = Math.random() * 3; bits.push(c); K.items.push(c);
        }
        n += k; idle = 0;
        note(700 + Math.random() * 200, 0.06, 'sine', 0.07);
      }
      if ((n >= 3 && idle > 2.2) || G.skip) return true;
    });
    if (bits.length > 7) {
      rec.chives = false;
      say('…', 'She quietly lifts the extras off.');
      while (bits.length > 7) { const b = bits.pop(); burst(b.position.x, b.position.y, b.position.z, 3, '#3f9d48', { up: 1.5, speed: 0.5, r: 0.03 }); W.scene.remove(b); note(400, 0.05, 'sine', 0.05); await beat(0.3); }
    }

    // 5 · hands off, then slurp
    setStep(4, '', '');
    say('Lift your hands.', '');
    let off = 0, slurped = false, ready = false;
    await run((dt, t, evs) => {
      if (P.down) off = 0; else off += dt;
      if (off > 1.5 && !ready) { ready = true; say('…Now. Eat.', 'Swipe UP to slurp.'); }
      for (const e of evs) if (ready && e.type === 'up' && e.dy < -60) slurped = true;
      if (slurped || G.skip) return true;
    });
    sfx('splash'); note(392, 1.2, 'sine', 0.1); note(523, 1.4, 'sine', 0.08, 0.2);
    hitstop(150);
    await beat(0.6);
    // her memory: Grandpa Zhao, and "less"
    document.getElementById('fade').classList.add('on');
    await beat(0.5);
    hudEl().classList.add('hidden');
    await chilliFlashback();
    hudEl().classList.remove('hidden');
    chilli.setFace('normal');
    await fadeIn(0.8);
    say('…Eat. Don’t talk.', '');
    await beat(2.2);
  } finally {
    end();
  }
  rec.score = ['warm', 'slow', 'oneDrop', 'chives', 'waited'].filter(k => rec[k]).length;
  G.flags.chilliBowl = rec;
  return rec;
}
