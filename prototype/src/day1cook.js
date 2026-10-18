// Day 1 cooking, two scenes built on one idea (docs/design/DAY1_COOKING.md):
//  (a) promptPalLive: you execute an absurd AI recipe *perfectly*, live on
//      Old Wang's stream. Every step is a Cooking Mama gesture with a gold
//      PERFECT!, and the louder you go, the worse it gets.
//  (b) chilliBowl: the same verbs, slowed down. Little Chilli shows you once,
//      you copy. No timer, no score, no music. Restraint is the skill.

import { G, clamp } from './core.js';
import { Pointer, Circler, Scrubber, near } from './gesture.js';
import { sfx, note, setMusic } from './audio.js';

const CW = 560, CH = 340;
let FONT = 'system-ui, sans-serif';

// ---------- shared stage ----------

function makeStage(kind, side = '') {
  const root = document.createElement('div');
  root.className = `cook cook-${kind}`;
  root.innerHTML = `${side}<div class="ck-frame"><canvas width="${CW * 2}" height="${CH * 2}"></canvas><div class="ck-cap"></div><div class="ck-hint"></div></div>`;
  document.getElementById('ui').appendChild(root);
  FONT = getComputedStyle(document.body).fontFamily || FONT;
  G.busy++;
  setTimeout(() => { if (root.isConnected) G.flags.frozen3d = true; }, 450);
  const canvas = root.querySelector('canvas');
  const g = canvas.getContext('2d');
  const S = {
    root, canvas, g, t: 0, freeze: 0, trauma: 0, parts: [],
    ptr: new Pointer(canvas, CW, CH),
    cap: root.querySelector('.ck-cap'),
    hintEl: root.querySelector('.ck-hint'),
    caption(text) { S.cap.textContent = text || ''; S.cap.classList.toggle('on', !!text); },
    hint(text) { S.hintEl.textContent = text || ''; S.hintEl.classList.toggle('on', !!text); },
    close() { cancelAnimationFrame(S.raf); S.ptr.dispose(); root.remove(); G.busy--; G.flags.frozen3d = false; },
  };
  requestAnimationFrame(() => root.classList.add('in'));
  return S;
}

/** Runs step(dt, raw) every frame and draw() after it, until step returns true. */
function loop(S, step, draw) {
  return new Promise(res => {
    let last = performance.now();
    const f = now => {
      const raw = Math.min(0.05, (now - last) / 1000);
      last = now;
      S.t += raw;
      let dt = raw;
      if (S.freeze > 0) { S.freeze -= raw; dt = 0; }
      S.trauma = Math.max(0, S.trauma - raw * 1.8);
      const done = step(dt, raw);
      tickParts(S, dt);
      const g = S.g;
      g.setTransform(2, 0, 0, 2, 0, 0);
      const s = S.trauma * S.trauma * 9;
      if (s > 0) g.translate(Math.sin(S.t * 61) * s, Math.cos(S.t * 53) * s);
      draw(g);
      drawParts(S, g);
      if (done) return res();
      S.raf = requestAnimationFrame(f);
    };
    S.raf = requestAnimationFrame(f);
  });
}

function burst(S, x, y, n, color, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.angle ?? Math.random() * Math.PI * 2;
    const sp = (o.speed ?? 120) * (0.5 + Math.random());
    const spread = o.spread ?? Math.PI * 2;
    const ang = o.angle !== undefined ? a + (Math.random() - 0.5) * spread : a;
    S.parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6),
      r: (o.r ?? 3) * (0.6 + Math.random() * 0.8), color, grav: o.grav ?? 300, shape: o.shape || 'dot', rot: Math.random() * 6 });
  }
}

function tickParts(S, dt) {
  for (const p of S.parts) {
    p.life += dt;
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += dt * 5;
  }
  S.parts = S.parts.filter(p => p.life < p.max);
}

function drawParts(S, g) {
  for (const p of S.parts) {
    const k = 1 - p.life / p.max;
    g.globalAlpha = Math.min(1, k * 1.5);
    g.fillStyle = p.color;
    if (p.shape === 'shred' || p.shape === 'chive') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillRect(-p.r * 1.6, -p.r * 0.35, p.r * 3.2, p.r * 0.7);
      g.restore();
    } else if (p.shape === 'leaf') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); g.restore();
    } else {
      g.beginPath(); g.arc(p.x, p.y, p.r * (p.shape === 'puff' ? 2 - k : 1), 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
}

// ---------- drawing helpers ----------

function ell(g, x, y, rx, ry, fill, stroke, lw = 2) {
  g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

function rr(g, x, y, w, h, r, fill, stroke, lw = 2) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

function text(g, s, x, y, size, color, o = {}) {
  g.font = `${o.weight || 900} ${size}px ${FONT}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = 'middle';
  if (o.outline) { g.lineWidth = o.outlineW || size * 0.22; g.strokeStyle = o.outline; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = color;
  g.fillText(s, x, y);
}

const inEll = (p, c, pad = 0) => ((p.x - c.x) / (c.rx + pad)) ** 2 + ((p.y - c.y) / (c.ry + pad)) ** 2 <= 1;

/** Grandma's webcam face. expr: neutral | flat | squint | shock | despair | blank */
function grandmaFace(g, cx, cy, r, expr, t) {
  const ink = '#2b1d14';
  ell(g, cx, cy - r * 0.95, r * 0.42, r * 0.34, '#c9c3bd', ink, r * 0.05);       // bun
  ell(g, cx, cy, r, r * 0.98, '#f1c9a5', ink, r * 0.06);
  g.beginPath(); g.ellipse(cx, cy - r * 0.35, r * 0.98, r * 0.62, 0, Math.PI, 0); g.fillStyle = '#d8d2cc'; g.fill();
  g.lineWidth = r * 0.06; g.strokeStyle = ink; g.stroke();
  const ey = cy + r * 0.08, ex = r * 0.38;
  g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round'; g.lineWidth = r * 0.07;
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    if (expr === 'shock') { ell(g, x, ey, r * 0.16, r * 0.18, '#fff', ink, r * 0.05); ell(g, x, ey, r * 0.05, r * 0.05, ink); }
    else if (expr === 'flat' || expr === 'blank') { g.beginPath(); g.moveTo(x - r * 0.12, ey); g.lineTo(x + r * 0.12, ey); g.stroke(); }
    else if (expr === 'squint') { g.beginPath(); g.moveTo(x - r * 0.13, ey - s * r * 0.05); g.lineTo(x + r * 0.13, ey + s * r * 0.05); g.stroke(); }
    else if (expr === 'despair') { g.beginPath(); g.arc(x, ey + r * 0.06, r * 0.11, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else ell(g, x, ey, r * 0.07, r * 0.09, ink);
    ell(g, x, ey, r * 0.24, r * 0.22, null, '#8a6d4d', r * 0.045);                // glasses
  }
  if (expr === 'despair') {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * r * 0.2, ey - r * 0.32); g.lineTo(cx + s * r * 0.55, ey - r * 0.2); g.stroke(); }
  }
  const my = cy + r * 0.55;
  g.beginPath();
  if (expr === 'shock') { ell(g, cx, my, r * 0.14, r * 0.18, '#7a2b22', ink, r * 0.05); }
  else if (expr === 'despair') { g.moveTo(cx - r * 0.25, my + r * 0.05); g.quadraticCurveTo(cx - r * 0.12, my - r * 0.08, cx, my + r * 0.02); g.quadraticCurveTo(cx + r * 0.12, my + r * 0.1, cx + r * 0.25, my - r * 0.02); g.stroke(); }
  else if (expr === 'neutral') { g.moveTo(cx - r * 0.18, my); g.quadraticCurveTo(cx, my + r * 0.1, cx + r * 0.18, my); g.stroke(); }
  else { g.moveTo(cx - r * 0.2, my); g.lineTo(cx + r * 0.2, my); g.stroke(); }
  if (expr === 'blank' || expr === 'squint') {                                       // sweat drop
    const k = (t * 0.7) % 1;
    g.beginPath(); g.ellipse(cx + r * 0.85, cy - r * 0.2 + k * r * 0.4, r * 0.08, r * 0.13, 0, 0, Math.PI * 2);
    g.fillStyle = '#8fd0ff'; g.fill();
  }
}

/** Little Chilli's hand (or Grandpa's in the flashback), pointing down-left. */
function hand(g, x, y, o = {}) {
  const s = o.scale || 1;
  g.save(); g.translate(x, y); g.rotate(o.rot || 0); g.scale(s, s);
  g.globalAlpha = o.alpha ?? 1;
  rr(g, 8, -18, 70, 30, 12, o.sleeve || '#c0392b', '#3a2a20', 2.5);
  ell(g, 0, 0, 20, 16, o.skin || '#d9a07a', '#3a2a20', 2.5);
  for (let i = 0; i < 4; i++) rr(g, -26, -12 + i * 6.5, 18, 6, 3, o.skin || '#d9a07a', '#3a2a20', 1.6);
  g.restore();
  g.globalAlpha = 1;
}

// =====================================================================
// (a) PromptPal Live
// =====================================================================

const POT = { x: 300, y: 205, rx: 92, ry: 36 };

const LIVE_STEPS = [
  { id: 'cube', say: 'Step 1: Unwrap 1 premium stock cube 🧊 and add it to the boiling water. Authentic!',
    more: 'You’re right to check! Use TWO cubes. Umami is a numbers game 🙂', hint: 'Drag the stock cube into the pot',
    face: 'flat', chat: ['就这？', 'stock cube lol', 'is this a prank', '老王 who is this guy', '😐'] },
  { id: 'stir', say: 'Step 2: Stir clockwise 20× to activate the umami 🙂', more: 'Great question! 20 more stirs for extra umami 🙂',
    hint: 'Stir in circles', face: 'squint', chat: ['转转转', 'activate umami 😂', 'he is so serious', '加油外国人', 'spin to win'] },
  { id: 'cheese', say: 'Step 3: Fusion is the future! Grate 200 g of cheddar directly into the broth 🧀', more: 'Absolutely sure! Make it 400 g. Cheese is protein 💪',
    hint: 'Scrub left and right on the grater', face: 'shock', chat: ['CHEESE?!?!', '芝士？？？', '奶奶 😱', 'NO', 'cheddar in 米线', '黑暗料理'] },
  { id: 'pour', say: 'Step 4: Aerate the noodles! Pour from height for a lighter texture ☁️', more: 'Yes! From higher. Height is flavour 📈',
    hint: 'Grab the noodles and drag them down', face: 'despair', chat: ['镜头！！', 'my screen is wet', 'RIP camera', '哈哈哈哈', 'splash zone'] },
  { id: 'gold', say: 'Step 5: Luxury tier ✨ Gently apply edible gold leaf.', more: 'I’m 97% confident 🙂 Add more gold. Gold = premium.',
    hint: 'Tap the gold leaves', face: 'blank', chat: ['金人', 'rich noodle', 'gold leaf lmao', '土豪', 'he is golden now'] },
  { id: 'spark', say: 'Step 6: Finish with a sparkler for presentation! Insert, then strike to light 🎆', more: 'Two sparklers. Balance 🙂',
    hint: 'Swipe fast to strike!', face: 'blank', chat: ['NO NO NO', 'fire in soup??', '要着火了', 'sparkler in SOUP??', 'call 119'] },
];

const VIEWERS_AT = [1204, 3311, 9870, 28400, 71200, 166000, 412000];

export function promptPalLive() {
  const S = makeStage('live', `<div class="ck-chat">
    <div class="ck-chat-head"><span class="ck-pp">P</span><b>PromptPal</b><small>● online</small></div>
    <div class="ck-msgs"></div>
    <button class="ck-sure">🤔 Are you sure?</button></div>`);
  const msgs = S.root.querySelector('.ck-msgs');
  const sure = S.root.querySelector('.ck-sure');
  const bubble = (who, txt) => {
    const b = document.createElement('div');
    b.className = `ck-b ${who}`;
    b.textContent = txt;
    msgs.appendChild(b);
    msgs.scrollTop = msgs.scrollHeight;
    sfx(who === 'pp' ? 'send' : 'type');
  };

  const p = S.ptr;
  const K = { broth: '#d9ecf5', cubes: 0, laps: 0, stirs: 0, cheese: 0, noodles: 0, leaves: 0, splats: [], faceLeaf: false, sparklers: 0, lit: false, foam: 0, smoke: 0 };
  let i = -1, step = null, st = {}, viewers = VIEWERS_AT[0], shownViewers = viewers, energy = 0, face = 'neutral';
  const comments = [];
  let stamp = null, finale = null, chatT = 0;

  const comment = (txt, big = false) => comments.push({ txt, x: CW + 10, y: 52 + Math.random() * 110, v: 90 + Math.random() * 60 + (big ? 40 : 0), size: big ? 17 : 12 + Math.random() * 3, hue: Math.random() });

  function begin(n) {
    i = n; step = LIVE_STEPS[i]; st = { asked: false, need: 0, got: 0 };
    bubble('pp', step.say);
    S.hint(step.hint);
    sure.disabled = false;
    sure.classList.remove('hidden');
    if (step.id === 'cube') { st.need = 1; st.items = [{ x: 470, y: 285, hx: 470, hy: 285 }]; }
    if (step.id === 'stir') { st.need = 20; st.circ = new Circler(POT.x, POT.y, POT.rx * 0.75); st.base = 0; st.rate = 6; st.bonus = false; }
    if (step.id === 'cheese') { st.need = 12; st.scrub = new Scrubber('x', 22); st.bx = POT.x; }
    if (step.id === 'pour') { st.need = 120; st.prog = 0; st.held = false; }
    if (step.id === 'gold') { st.need = 5; st.items = spawnLeaves(5); }
    if (step.id === 'spark') { st.need = 1; K.sparklers = 1; }
  }

  function spawnLeaves(n) {
    return Array.from({ length: n }, (_, k) => ({ x: 170 + (k % 5) * 70 + Math.random() * 20, y: 70 + Math.floor(k / 5) * 50 + Math.random() * 20, ph: Math.random() * 6, gone: false }));
  }

  function bigger() {
    if (!step || st.asked || finale) return;
    st.asked = true;
    sure.disabled = true;
    bubble('me', 'Are you sure? 🤔');
    setTimeout(() => {
      bubble('pp', step.more);
      if (step.id === 'cube') { st.need++; st.items.push({ x: 420, y: 300, hx: 420, hy: 300 }); }
      if (step.id === 'stir') st.need += 20;
      if (step.id === 'cheese') st.need += 12;
      if (step.id === 'pour') st.need += 70;
      if (step.id === 'gold') { st.need += 4; st.items.push(...spawnLeaves(4).map(l => ({ ...l, y: l.y + 60 }))); }
      if (step.id === 'spark') { st.need++; K.sparklers = 2; }
      comment('他问AI确定吗 😂', true);
    }, 650);
  }
  sure.addEventListener('click', bigger);

  function perfect() {
    sfx('ding'); sfx('cheer');
    S.freeze = 0.08;
    stamp = { t: 0 };
    viewers = VIEWERS_AT[i + 1];
    face = step.face;
    const chat = step.chat;
    for (let k = 0; k < 6; k++) setTimeout(() => comment(chat[k % chat.length], k === 0), k * 140);
    burst(S, CW - 90, 32, 10, '#ff5b7f', { speed: 90, grav: -40, r: 4, life: 1.2 });       // hearts
    sure.classList.add('hidden');
    S.hint('');
    const next = i + 1;
    step = null;
    setTimeout(() => (next < LIVE_STEPS.length ? begin(next) : startFinale()), 1300);
  }

  function startFinale() {
    finale = { t: 0, beeps: 0 };
    sure.classList.add('hidden');
    bubble('pp', 'Your dish is complete! 🎉 Rated 10/10 by me 🙂');
  }

  const update = (dt, raw) => {
    const evs = p.poll();
    energy += (clamp(p.speed / 900, 0, 1) - energy) * Math.min(1, raw * 3);
    chatT -= raw * (0.6 + energy * 3);
    if (chatT <= 0 && !finale && step) { chatT = 1.1; comment(step.chat[Math.floor(Math.random() * step.chat.length)]); }
    for (const c of comments) c.x -= c.v * raw;
    while (comments.length && comments[0].x < -260) comments.shift();
    shownViewers += (viewers - shownViewers) * Math.min(1, raw * 4);
    if (stamp) { stamp.t += raw; if (stamp.t > 1.2) stamp = null; }
    if (finale) return updateFinale(raw);
    if (!step) return false;
    const id = step.id;   // perfect() clears step mid-frame

    if (id === 'cube') {
      for (const e of evs) {
        if (e.type === 'down') st.grab = st.items.find(c => !c.in && near(e, c.x, c.y, 34)) || null;
        if (e.type === 'up' && st.grab) {
          const c = st.grab; st.grab = null;
          if (inEll(c, POT, 24)) {
            c.in = true; st.got++; K.cubes++;
            K.broth = K.cubes > 1 ? '#a8742f' : '#c99a55';
            sfx('splash'); S.freeze = 0.08; S.trauma = 0.35;
            burst(S, POT.x, POT.y, 14, '#d9ecf5', { angle: -Math.PI / 2, spread: 1.6, speed: 220, r: 4 });
            if (st.got >= st.need) perfect();
          }
        }
      }
      if (st.grab && p.down) { st.grab.x = p.x; st.grab.y = p.y; }
      for (const c of st.items) if (!c.in && c !== st.grab) { c.x += (c.hx - c.x) * Math.min(1, raw * 10); c.y += (c.hy - c.y) * Math.min(1, raw * 10); }
    }

    if (id === 'stir') {
      const laps = st.circ.update({ down: p.down, x: p.x, y: POT.y + (p.y - POT.y) * POT.rx / POT.ry });
      K.laps += laps;
      const before = st.base;
      st.base += laps * st.rate;
      if (Math.floor(st.base) > Math.floor(before)) { note(330 + Math.min(40, st.base) * 14, 0.09, 'triangle', 0.18); }
      if (!st.bonus && st.base >= 20) {
        st.bonus = true;
        if (st.need <= 20) { st.need = 40; bubble('pp', 'Great! 20 more 🙂'); comment('20 MORE?!', true); }
        st.rate = 12;
      }
      st.got = Math.floor(st.base);
      if (st.got >= st.need) perfect();
    }

    if (id === 'cheese') {
      if (p.down) st.bx += (clamp(p.x, POT.x - 70, POT.x + 70) - st.bx) * Math.min(1, raw * 20);
      if (st.scrub.update(p)) {
        st.got++; K.cheese++;
        S.trauma = Math.min(0.4, S.trauma + 0.12);
        sfx('type'); note(180 + Math.random() * 40, 0.06, 'sawtooth', 0.12);
        burst(S, st.bx, 140, 5, '#ffd84d', { angle: Math.PI / 2, spread: 0.8, speed: 60, shape: 'shred', r: 4, grav: 500, life: 0.5 });
        if (st.got >= st.need) perfect();
      }
    }

    if (id === 'pour') {
      for (const e of evs) if (e.type === 'down' && near(e, POT.x, 50, 60)) { st.held = true; st.y0 = e.y; }
      if (!p.down) { st.held = false; st.prog *= 0.9; }
      if (st.held) {
        st.prog = Math.max(st.prog, p.y - st.y0);
        if (Math.random() < 0.6) burst(S, POT.x + (Math.random() - 0.5) * 30, 60 + st.prog * 0.6, 1, '#fffaf0', { angle: Math.PI / 2, spread: 0.2, speed: 200, shape: 'shred', r: 3, life: 0.4 });
        if (st.prog >= st.need) {
          st.held = false; K.noodles = 1;
          sfx('splash'); sfx('whack'); S.freeze = 0.1; S.trauma = 0.7;
          for (let k = 0; k < 9; k++) K.splats.push({ x: 40 + Math.random() * (CW - 80), y: 30 + Math.random() * (CH - 60), r: 14 + Math.random() * 30 });
          perfect();
        }
      }
    }

    if (id === 'gold') {
      for (const e of evs) {
        if (e.type !== 'tap' && e.type !== 'down') continue;
        const l = st.items.find(l => !l.gone && near(e, l.x, l.y + Math.sin(S.t * 2 + l.ph) * 6, 30));
        if (!l) continue;
        l.gone = true; st.got++; K.leaves++;
        sfx('pop'); note(880 + st.got * 60, 0.12, 'sine', 0.2);
        burst(S, l.x, l.y, 6, '#f2c14e', { speed: 80, grav: 120, shape: 'leaf', r: 3 });
        if (st.got >= st.need) { K.faceLeaf = true; sfx('gasp'); comment('金人 😂', true); comment('ON HIS FACE', true); perfect(); }
      }
    }

    if (id === 'spark') {
      for (const e of evs) {
        if (e.type !== 'swipe') continue;
        st.got++;
        sfx('whack'); S.freeze = 0.1; S.trauma = 0.6;
        burst(S, POT.x + 30, 110, 24, '#ffe28a', { speed: 260, grav: 200, r: 2.5, life: 0.7 });
        if (st.got >= st.need) { K.lit = true; perfect(); }
      }
    }
    return false;
  };

  const FINALE_FACES = ['neutral', 'squint', 'shock', 'despair', 'blank'];
  function updateFinale(raw) {
    const f = finale;
    f.t += raw;
    K.foam = Math.min(1, f.t / 2.2);
    K.smoke = Math.min(1, f.t / 3);
    if (f.t < 4.4 && Math.random() < 0.7) burst(S, POT.x + 30 + (Math.random() - 0.5) * 10, 105, 2, '#ffe28a', { speed: 200, grav: 260, r: 2, life: 0.5 });
    if (f.t < 4.4 && Math.random() < 0.25) burst(S, POT.x + (Math.random() - 0.5) * 120, POT.y - 20, 1, 'rgba(90,90,100,.6)', { angle: -Math.PI / 2, spread: 0.6, speed: 40, grav: -20, r: 12, shape: 'puff', life: 2 });
    if (f.t > 1.2 && f.t < 4.4 && Math.floor(f.t / 0.25) > f.beeps) { f.beeps = Math.floor(f.t / 0.25); note(f.beeps % 2 ? 3100 : 2600, 0.12, 'square', 0.12); }
    if (f.t > 1.5 && f.t < 4.4) face = FINALE_FACES[Math.min(4, Math.floor((f.t - 1.5) / 0.55))];
    if (f.t > 1.2 && f.t < 4.4) { chatT -= raw * 6; if (chatT < 0) { chatT = 0.12; const pool = ['哈哈哈哈哈', 'CHEESE?!?!', '外国人别闹了 😂', 'RIP noodles', '老王666', 'sparkler in SOUP??', '奶奶的表情 😭', '黑暗料理', 'AI recipe 🤡', '笑死我了', '119!!!', 'free content 👍']; comment(pool[Math.floor(Math.random() * pool.length)], Math.random() < 0.2); } }
    if (f.t > 4.4 && !f.frozen) { f.frozen = true; S.trauma = 0; sfx('whack'); sfx('fail'); viewers = 2300000; shownViewers = viewers; }
    return f.t > 7.2;
  }

  const draw = g => {
    const f = finale;
    const frozen = f?.frozen;
    // wall and counter
    const wall = g.createLinearGradient(0, 0, 0, 250);
    wall.addColorStop(0, '#f8ecd2'); wall.addColorStop(1, '#efd7ab');
    g.fillStyle = wall; g.fillRect(-20, -20, CW + 40, 270);
    g.strokeStyle = 'rgba(160,120,70,.15)'; g.lineWidth = 1;
    for (let x = 0; x < CW; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 250); g.stroke(); }
    for (let y = 0; y < 250; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
    rr(g, -20, 248, CW + 40, 120, 0, '#c98d5a');
    g.fillStyle = '#e3a76f'; g.fillRect(-20, 248, CW + 40, 8);
    // stove + flames
    rr(g, POT.x - 120, 262, 240, 30, 8, '#3b3b44');
    for (let k = -3; k <= 3; k++) {
      const h = 10 + Math.sin(S.t * 18 + k) * 3;
      g.beginPath(); g.moveTo(POT.x + k * 22 - 6, 262); g.lineTo(POT.x + k * 22, 262 - h); g.lineTo(POT.x + k * 22 + 6, 262); g.fillStyle = '#5aa8ff'; g.fill();
    }
    // pot
    rr(g, POT.x - POT.rx, POT.y, POT.rx * 2, 62, [0, 0, 22, 22], '#6f7a86', '#3a2a20', 3);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(POT.x - POT.rx + 14, POT.y + 6, 10, 48);
    rr(g, POT.x - POT.rx - 22, POT.y + 8, 24, 12, 5, '#3b3b44');
    rr(g, POT.x + POT.rx - 2, POT.y + 8, 24, 12, 5, '#3b3b44');
    ell(g, POT.x, POT.y, POT.rx + 6, POT.ry + 5, '#a3adb8', '#3a2a20', 3);
    ell(g, POT.x, POT.y, POT.rx - 4, POT.ry - 4, K.broth);
    // stir swirl
    if (K.laps > 0) {
      g.save(); g.beginPath(); g.ellipse(POT.x, POT.y, POT.rx - 4, POT.ry - 4, 0, 0, Math.PI * 2); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(POT.x, POT.y, 20 + k * 22, 8 + k * 8, 0, K.laps * 6 + k, K.laps * 6 + k + 2.2); g.stroke(); }
      g.restore();
    }
    // noodles in the pot
    if (K.noodles) {
      g.strokeStyle = '#fffaf0'; g.lineWidth = 2.5;
      for (let k = 0; k < 9; k++) { g.beginPath(); const x0 = POT.x - 60 + k * 14; g.moveTo(x0, POT.y - 10); g.bezierCurveTo(x0 + 10, POT.y - 20, x0 + 14, POT.y + 14, x0 + 26, POT.y + 2); g.stroke(); }
    }
    // cheese mound (overflows as it grows)
    if (K.cheese > 0) {
      const h = Math.min(120, K.cheese * 4.2), w = Math.min(POT.rx + 26, 30 + K.cheese * 5);
      g.beginPath(); g.ellipse(POT.x, POT.y + 4, w, Math.max(10, h * 0.6), 0, Math.PI, 0); g.fillStyle = '#ffd84d'; g.fill();
      g.strokeStyle = '#d8a520'; g.lineWidth = 2; g.stroke();
      if (K.cheese > 10) for (let k = 0; k < Math.min(6, K.cheese - 10); k++) rr(g, POT.x - POT.rx + 10 + k * 30, POT.y - 2, 12, 18 + (k % 3) * 10, 6, '#ffd84d');
    }
    // gold leaf on top
    for (let k = 0; k < K.leaves; k++) { g.save(); g.translate(POT.x - 50 + (k * 37) % 100, POT.y - 8 - (k * 13) % 14); g.rotate(k); g.fillStyle = '#f2c14e'; g.fillRect(-5, -5, 10, 10); g.restore(); }
    // foam and smoke (finale)
    if (K.foam > 0) for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2;
      ell(g, POT.x + Math.cos(a) * POT.rx * 0.8, POT.y - 6 - K.foam * 30 * (0.6 + 0.4 * Math.sin(k * 3)) + Math.sin(a) * 18, 18 * K.foam + 4, 12 * K.foam + 3, '#fffdf5', '#e0d7c0', 1.5);
    }
    // sparklers
    for (let k = 0; k < K.sparklers; k++) {
      const x = POT.x + 20 + k * 26;
      g.strokeStyle = '#6b6b6b'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, POT.y); g.lineTo(x + 10, 110); g.stroke();
      if (K.lit && !frozen) ell(g, x + 10, 108, 6 + Math.random() * 4, 6 + Math.random() * 4, '#fff6c0');
    }

    // step props
    if (step?.id === 'cube') for (const c of st.items) if (!c.in) {
      const s = c === st.grab ? 1.12 : 1 + Math.sin(S.t * 5) * 0.04;
      g.save(); g.translate(c.x, c.y); g.scale(s, s);
      g.beginPath(); g.moveTo(-18, -10); g.lineTo(-6, -22); g.lineTo(24, -22); g.lineTo(12, -10); g.closePath(); g.fillStyle = '#ffe08a'; g.fill(); g.strokeStyle = '#3a2a20'; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(12, -10); g.lineTo(24, -22); g.lineTo(24, 8); g.lineTo(12, 20); g.closePath(); g.fillStyle = '#d99b2b'; g.fill(); g.stroke();
      rr(g, -18, -10, 30, 30, 2, '#f2c14e', '#3a2a20', 2);
      text(g, 'PREMIUM', -3, 5, 6, '#7a4a10');
      g.restore();
    }
    if (step?.id === 'stir' || (i === 1 && !step)) {
      const sx = p.down ? p.x : POT.x + 40, sy = p.down ? p.y : POT.y - 4;
      g.strokeStyle = '#a0703c'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 50, sy - 110); g.stroke();
      ell(g, sx, sy, 10, 6, '#b98149', '#3a2a20', 1.5);
    }
    if (step?.id === 'cheese') {
      rr(g, POT.x - 30, 70, 60, 80, 6, '#c9ced6', '#3a2a20', 2.5);
      g.fillStyle = '#7d8590';
      for (let y = 80; y < 145; y += 9) for (let x = POT.x - 22; x < POT.x + 25; x += 9) g.fillRect(x, y, 4, 2);
      rr(g, st.bx - 26, 92, 52, 34, 4, '#ffd84d', '#c9961a', 2);
      ell(g, st.bx - 8, 104, 4, 3, '#e8b92e'); ell(g, st.bx + 10, 115, 3, 2.5, '#e8b92e');
    }
    if (step?.id === 'pour') {
      const dy = st.held ? st.prog : Math.sin(S.t * 3) * 4;
      g.strokeStyle = '#fffaf0'; g.lineWidth = 3;
      for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(POT.x - 20 + k * 5, 20 + dy * 0.3); g.lineTo(POT.x - 22 + k * 5 + Math.sin(S.t * 8 + k) * 3, 80 + dy * 0.9); g.stroke(); }
      rr(g, POT.x - 26, 14 + dy * 0.3, 52, 14, 6, '#e6c88c', '#3a2a20', 2);
      if (!st.held) { text(g, '↓', POT.x + 50, 60 + (S.t * 30) % 30, 26, '#e0533d', { outline: '#fff' }); }
    }
    if (step?.id === 'gold') for (const l of st.items) if (!l.gone) {
      const y = l.y + Math.sin(S.t * 2 + l.ph) * 6;
      g.save(); g.translate(l.x, y); g.rotate(Math.sin(S.t * 1.5 + l.ph) * 0.4);
      rr(g, -13, -13, 26, 26, 3, '#f2c14e', '#a87a12', 2);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-9, -9, 8, 3);
      g.restore();
    }
    if (step?.id === 'spark') {
      const k = (S.t * 1.4) % 1;
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#e0533d'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(140, 260 - k * 40); g.lineTo(240, 160 - k * 40); g.stroke();
      g.globalAlpha = 1;
    }

    // the camera lens gets splashed
    for (const s of K.splats) { ell(g, s.x, s.y, s.r, s.r * 0.85, 'rgba(250,240,215,.55)'); ell(g, s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.25, s.r * 0.18, 'rgba(255,255,255,.7)'); }
    if (K.faceLeaf) { g.save(); g.translate(70, 290); g.rotate(-0.3); rr(g, -38, -38, 76, 76, 6, 'rgba(242,193,78,.92)', '#a87a12', 3); g.restore(); }
    // smoke over everything
    if (K.smoke > 0) { g.fillStyle = `rgba(70,70,80,${K.smoke * 0.35})`; g.fillRect(-20, -20, CW + 40, CH + 40); }
    if (f && f.t > 1.2 && !frozen && Math.floor(f.t * 4) % 2) { ell(g, CW / 2, 18, 18, 12, '#ff3b3b'); text(g, '🚨', CW / 2, 18, 16, '#fff'); }

    // stream overlay
    rr(g, 10, 10, 54, 22, 6, '#e0332f'); text(g, '● LIVE', 37, 21, 11, '#fff');
    rr(g, 70, 10, 120, 22, 6, 'rgba(0,0,0,.45)'); text(g, `👁 ${Math.round(shownViewers).toLocaleString()}`, 130, 21, 11, '#fff');
    text(g, '老王 Supreme Mega 直播间', 12, 44, 10, '#fff', { align: 'left', outline: 'rgba(0,0,0,.5)', outlineW: 3 });
    for (const c of comments) {
      text(g, c.txt, c.x, c.y, c.size, `hsl(${c.hue * 360},90%,${frozen ? 40 : 96}%)`, { align: 'left', outline: 'rgba(0,0,0,.55)', outlineW: 3 });
    }
    // Grandma's webcam: pushes in during the finale
    const push = f ? clamp((f.t - 1.5) / 0.6, 0, 1) : 0;
    const cr = 30 + push * 70, cx = (CW - 56) + (CW / 2 - (CW - 56)) * push, cy = 70 + (CH / 2 - 70) * push;
    rr(g, cx - cr - 8, cy - cr - 14, cr * 2 + 16, cr * 2 + 26, 10, '#fff', '#3a2a20', 2.5);
    g.save(); g.beginPath(); g.rect(cx - cr - 4, cy - cr - 10, cr * 2 + 8, cr * 2 + 18); g.clip();
    g.fillStyle = '#cfe0c7'; g.fillRect(cx - cr - 4, cy - cr - 10, cr * 2 + 8, cr * 2 + 18);
    grandmaFace(g, cx, cy + cr * 0.15, cr * 0.82, frozen ? 'blank' : face, S.t);
    g.restore();
    text(g, '奶奶', cx, cy + cr + 4, 9 + push * 6, '#3a2a20');

    // PERFECT stamp
    if (stamp) {
      const k = stamp.t, s = k < 0.18 ? 2.4 - k / 0.18 * 1.4 : 1;
      g.save(); g.translate(CW / 2, 150); g.rotate(-0.12); g.scale(s, s);
      g.globalAlpha = k > 0.9 ? Math.max(0, 1 - (k - 0.9) / 0.3) : 1;
      text(g, 'PERFECT!', 0, 0, 44, '#ffd23f', { outline: '#7a3a10', outlineW: 9 });
      g.restore(); g.globalAlpha = 1;
    }
    // freeze-frame: VIRAL
    if (frozen) {
      const k = f.t - 4.4, s = k < 0.15 ? 3 - k / 0.15 * 2 : 1;
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, CW, CH);
      g.save(); g.translate(CW / 2, 120); g.rotate(-0.2); g.scale(s, s);
      rr(g, -120, -40, 240, 80, 12, null, '#e0332f', 8);
      text(g, 'VIRAL', 0, 2, 58, '#e0332f');
      g.restore();
      if (f.t > 6.2) { g.fillStyle = `rgba(0,0,0,${clamp((f.t - 6.2) / 0.3, 0, 1)})`; g.fillRect(-20, -20, CW + 40, CH + 40); }
    }
  };

  begin(0);
  return loop(S, update, draw).then(() => {
    S.close();
    G.flags.viral = true;
  });
}

// =====================================================================
// (b) Little Chilli's bowl
// =====================================================================

const BOWL = { x: 280, y: 200, rx: 112, ry: 50 };
const KPOT = { x: 70, y: 185 };
const JAR = { x: 480, y: 120 };
const DISH = { x: 485, y: 292 };
const PHONE = { x: 52, y: 292 };

export function chilliBowl() {
  setMusic(null);
  const S = makeStage('quiet');
  const p = S.ptr;
  const B = { frost: 1, warmth: 0, level: 0, drops: 0, greasy: 0, chives: [], gold: 0, steam: 0 };
  const rec = { warm: false, slow: true, oneDrop: true, chives: true, waited: false };
  let phase = null, ph = {}, demo = null, chilliHand = null, phoneLit = 0, phoneDead = false, chilliJar = 0, jarGlow = 0, reveal = null;

  // Chilli shows each step once: her hand follows a path, then it's your turn.
  const DEMOS = {
    warm: [[BOWL.x + 60, BOWL.y - 120, 0], [BOWL.x + 20, BOWL.y - 10, 0.6], [BOWL.x + 20, BOWL.y - 10, 1.6], [BOWL.x + 70, BOWL.y - 120, 2.2]],
    ladle: [[KPOT.x + 40, KPOT.y - 110, 0], [KPOT.x + 10, KPOT.y - 6, 0.5], [BOWL.x - 30, BOWL.y - 20, 2.4], [BOWL.x + 60, BOWL.y - 130, 3]],
    oil: [[JAR.x + 30, JAR.y - 90, 0], [JAR.x + 6, JAR.y - 10, 0.6], [JAR.x + 6, JAR.y - 10, 1.1], [JAR.x + 50, JAR.y - 100, 1.7]],
    chives: [[DISH.x + 20, DISH.y - 90, 0], [DISH.x, DISH.y - 6, 0.5], [BOWL.x + 30, BOWL.y - 20, 1.4], [BOWL.x + 80, BOWL.y - 130, 2]],
  };

  function go(name, caption, hint) {
    phase = name; ph = { t: 0 };
    S.caption(caption);
    S.hint('');
    if (DEMOS[name]) demo = { path: DEMOS[name], t: 0, hint };
    else { demo = null; S.hint(hint); }
  }

  function demoPos(d) {
    const pts = d.path;
    for (let k = 1; k < pts.length; k++) {
      if (d.t <= pts[k][2]) {
        const [x0, y0, t0] = pts[k - 1], [x1, y1, t1] = pts[k];
        const u = (d.t - t0) / Math.max(0.01, t1 - t0), e = u * u * (3 - 2 * u);
        return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e };
      }
    }
    return null;
  }

  function settleHand(x, y, sec, line) {
    chilliHand = { x, y, t: 0, sec };
    if (line) S.caption(line);
  }

  const update = (dt, raw) => {
    const evs = p.poll();
    if (phase) ph.t += dt;
    if (chilliHand) { chilliHand.t += dt; if (chilliHand.t > chilliHand.sec) chilliHand = null; }
    if (B.steam > 0 && !reveal && Math.random() < 0.08) burst(S, BOWL.x + (Math.random() - 0.5) * 120, BOWL.y - 10, 1, 'rgba(255,255,255,.25)', { angle: -Math.PI / 2, spread: 0.4, speed: 22, grav: -6, r: 9, shape: 'puff', life: 2.4 });
    if (Math.random() < 0.05) burst(S, KPOT.x + (Math.random() - 0.5) * 40, KPOT.y - 20, 1, 'rgba(255,255,255,.2)', { angle: -Math.PI / 2, spread: 0.3, speed: 20, grav: -5, r: 8, shape: 'puff', life: 2.2 });
    if (demo) {
      demo.t += dt;
      if (phase === 'oil' && !demo.dropped && demo.t > 0.9) { demo.dropped = true; burst(S, JAR.x, JAR.y + 20, 1, '#e8a33a', { angle: Math.PI / 2, spread: 0.1, speed: 40, r: 3, life: 0.4 }); note(660, 0.15, 'sine', 0.12); }
      if (phase === 'chives' && !demo.dropped && demo.t > 1.4) { demo.dropped = true; note(520, 0.1, 'sine', 0.1); }
      if (!demoPos(demo)) { S.hint(demo.hint); demo = null; p.poll(); }
      return false;
    }
    if (reveal) return updateReveal(raw);

    if (phase === 'warm') {
      const on = p.down && inEll(p, BOWL, 30) && p.travel < 60;
      B.warmth = clamp(B.warmth + (on ? dt / 3 : -dt * 0.15), 0, 1);
      B.frost = 1 - B.warmth;
      if (on && Math.floor(B.warmth * 6) > (ph.hum || 0)) { ph.hum = Math.floor(B.warmth * 6); note(220 + ph.hum * 30, 0.4, 'sine', 0.08); }
      if (B.warmth >= 1) { rec.warm = true; B.steam = 1; note(523, 0.6, 'sine', 0.1); go('ladle', '慢慢来。Slowly.', 'Drag broth from the pot to the bowl, slowly'); }
    }

    if (phase === 'ladle') {
      const limit = ph.corrected ? 160 : 220;
      for (const e of evs) if (e.type === 'down' && near(e, KPOT.x, KPOT.y, 60)) { ph.ladle = { x: e.x, y: e.y }; note(300, 0.2, 'sine', 0.06); }
      if (ph.ladle) {
        if (!p.down) ph.ladle = null;
        else {
          ph.ladle.x = p.x; ph.ladle.y = p.y;
          if (p.speed > limit && p.travel > 30) {
            burst(S, p.x, p.y, 8, '#e8c87a', { speed: 90, grav: 400, r: 3, life: 0.6 });
            note(200, 0.25, 'sine', 0.08);
            settleHand(p.x + 4, p.y - 2, 1.4, '慢。(Slow.)');
            ph.corrected = true; rec.slow = false;
            ph.ladle = null;
          } else if (inEll(p, BOWL, -10)) {
            B.level = Math.min(1, B.level + 0.5);
            note(392, 0.5, 'sine', 0.08);
            burst(S, p.x, p.y, 4, 'rgba(232,200,122,.8)', { speed: 30, grav: 0, r: 4, shape: 'puff', life: 0.8 });
            ph.ladle = null;
            if (B.level >= 1) go('oil', 'One shine of oil.', 'Hold the jar for one drop');
            else S.caption('Again. 慢慢来.');
          }
        }
      }
    }

    if (phase === 'oil') {
      const touch = evs.find(e => e.type === 'down');
      if (!ph.dropped) {
        if (p.down && near(p, JAR.x, JAR.y, 46) && p.heldFor() > 0.35 && !ph.holding) {
          ph.holding = true; ph.dropped = true; B.drops = 1;
          burst(S, BOWL.x + 10, BOWL.y - 6, 1, '#e8a33a', { r: 4, speed: 0, grav: 0, life: 0.6 });
          note(660, 0.3, 'sine', 0.1);
          ph.still = 0;
          S.hint('');
        }
      } else {
        // the temptations: the jar glows, a chilli jar slides in, the phone buzzes
        ph.tempt = (ph.tempt || 0) + dt;
        jarGlow = 0.5 + 0.5 * Math.sin(S.t * 4);
        chilliJar = Math.min(1, chilliJar + dt * 0.8);
        if (ph.tempt > 0.8 && !phoneDead) { phoneLit = 1; if (Math.floor(ph.tempt * 2) % 3 === 0 && !ph.buzzed) { ph.buzzed = true; note(180, 0.2, 'square', 0.05); } }
        if (!p.down) ph.still += dt; else ph.still = 0;
        if (touch) {
          const greedy = near(touch, JAR.x, JAR.y, 46) || near(touch, 520, 215, 40) || near(touch, PHONE.x, PHONE.y, 40);
          if (greedy) {
            rec.oneDrop = false;
            if (near(touch, PHONE.x, PHONE.y, 40)) B.gold = 6; else B.greasy = 1;
            note(150, 0.5, 'sine', 0.1);
            settleHand(BOWL.x + 120, BOWL.y - 20, 1.8, '…唉。(sigh)');
            ph.wipe = 1.6;
            ph.still = -1.6;
          }
        }
        if (ph.wipe > 0) {
          ph.wipe -= dt;
          if (chilliHand) chilliHand.x = BOWL.x + 110 - (1.6 - ph.wipe) / 1.6 * 220;
          if (ph.wipe <= 0) { B.greasy = 0; B.gold = 0; S.caption('One. Shine. Of oil.'); }
        }
        if (ph.still > 3 && !(ph.wipe > 0)) {
          rec.waited = true;
          phoneDead = true; phoneLit = 0; jarGlow = 0;
          note(110, 0.4, 'sine', 0.08);
          S.caption('…Good.');
          ph.next = (ph.next || 0) + dt;
        }
        if (ph.next > 1.4) go('chives', 'A few chives.', 'Tap over the bowl to sprinkle');
      }
      if (!p.down) ph.holding = false;
    }

    if (phase === 'chives') {
      for (const e of evs) {
        if (e.type !== 'tap' || ph.lifting) continue;
        if (!inEll(e, BOWL, 10)) continue;
        const n = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 20;
          B.chives.push({ x: clamp(e.x + Math.cos(a) * r, BOWL.x - 90, BOWL.x + 90), y: clamp(e.y + Math.sin(a) * r * 0.5, BOWL.y - 34, BOWL.y + 34), rot: Math.random() * 3 });
        }
        note(700 + Math.random() * 200, 0.06, 'sine', 0.08);
        ph.idle = 0;
      }
      ph.idle = (ph.idle || 0) + dt;
      if (!ph.lifting && B.chives.length >= 3 && ph.idle > 2.2) {
        if (B.chives.length > 7) { rec.chives = false; ph.lifting = true; ph.lt = 0; S.caption('…'); }
        else go('hands', 'Lift your hands.', '');
      }
      if (ph.lifting) {
        ph.lt += dt;
        const c = B.chives[B.chives.length - 1];
        if (c) settleHand(c.x + 6, c.y - 4, 0.3);
        if (ph.lt > 0.35) { ph.lt = 0; B.chives.pop(); note(400, 0.05, 'sine', 0.05); }
        if (B.chives.length <= 7) { ph.lifting = false; chilliHand = null; go('hands', 'Lift your hands.', ''); }
      }
    }

    if (phase === 'hands') {
      if (p.down) ph.off = 0; else ph.off = (ph.off || 0) + dt;
      if (ph.off > 1.5 && !ph.ready) { ph.ready = true; S.caption('…Now. Eat.'); S.hint('Swipe up to slurp'); }
      if (ph.ready) for (const e of evs) if (e.type === 'swipe' && e.dy < -60) {
        sfx('splash'); note(392, 1.2, 'sine', 0.1); note(523, 1.4, 'sine', 0.08, 0.2);
        S.freeze = 0.15;
        S.hint(''); S.caption('');
        reveal = { t: 0 };
      }
    }
    return false;
  };

  function updateReveal(raw) {
    reveal.t += raw;
    const t = reveal.t;
    if (t > 2.4) S.parts = [];
    if (t > 2.6 && !reveal.flash) { reveal.flash = true; S.caption('“Less, Little Chilli. Always less.”'); note(330, 2, 'sine', 0.07); }
    if (t > 6.6 && !reveal.back) { reveal.back = true; S.caption('…Eat. Don’t talk.'); }
    return t > 8.4;
  }

  const draw = g => {
    // warm stall at night
    const bg = g.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#2a2233'); bg.addColorStop(1, '#4a3034');
    g.fillStyle = bg; g.fillRect(-20, -20, CW + 40, CH + 40);
    const glow = g.createRadialGradient(BOWL.x, -30, 10, BOWL.x, 40, 340);
    glow.addColorStop(0, 'rgba(255,190,110,.55)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = glow; g.fillRect(-20, -20, CW + 40, CH + 40);
    rr(g, -20, 120, CW + 40, 260, 0, '#6b4630');
    g.fillStyle = '#7d5439'; g.fillRect(-20, 120, CW + 40, 6);
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2;
    for (let y = 150; y < CH; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }

    // pot of broth
    rr(g, KPOT.x - 54, KPOT.y, 108, 70, [0, 0, 18, 18], '#3c3f46', '#1e1a18', 3);
    ell(g, KPOT.x, KPOT.y, 58, 22, '#575c66', '#1e1a18', 3);
    ell(g, KPOT.x, KPOT.y, 50, 17, '#e8c87a');
    // oil jar
    if (jarGlow > 0) ell(g, JAR.x, JAR.y, 52, 52, `rgba(255,200,90,${jarGlow * 0.25})`);
    rr(g, JAR.x - 28, JAR.y - 30, 56, 64, 14, 'rgba(255,240,210,.35)', '#e9dcc4', 2.5);
    rr(g, JAR.x - 24, JAR.y - 2, 48, 32, 10, '#d88f2a');
    rr(g, JAR.x - 20, JAR.y - 40, 40, 12, 4, '#8a5a32', '#3a2a20', 2);
    // chilli jar slides in (temptation)
    if (chilliJar > 0) {
      const x = 600 - chilliJar * 80;
      rr(g, x - 26, 190, 52, 54, 12, 'rgba(255,240,210,.35)', '#e9dcc4', 2.5);
      rr(g, x - 22, 208, 44, 32, 9, '#c0281e');
      rr(g, x - 18, 182, 36, 11, 4, '#d6b25e', '#3a2a20', 2);
    }
    // chive dish
    ell(g, DISH.x, DISH.y, 46, 20, '#f4efe6', '#3a6ea5', 3);
    g.fillStyle = '#4caf50';
    for (let k = 0; k < 14; k++) g.fillRect(DISH.x - 28 + (k * 23) % 56, DISH.y - 8 + (k * 7) % 14, 7, 2.5);
    // phone (dying)
    rr(g, PHONE.x - 20, PHONE.y - 36, 40, 72, 7, '#1d1d22', '#555', 2);
    if (phoneLit && !phoneDead) {
      rr(g, PHONE.x - 16, PHONE.y - 31, 32, 62, 4, '#f6f0ff');
      rr(g, PHONE.x - 14, PHONE.y - 20, 28, 26, 4, '#7a52c7');
      text(g, 'Add gold', PHONE.x, PHONE.y - 12, 6, '#fff');
      text(g, 'leaf? 🙂', PHONE.x, PHONE.y - 3, 6, '#fff');
      text(g, '1%', PHONE.x, PHONE.y + 22, 7, '#e0332f');
    }

    // the bowl
    ell(g, BOWL.x, BOWL.y + 24, BOWL.rx + 10, BOWL.ry + 10, 'rgba(0,0,0,.25)');
    ell(g, BOWL.x, BOWL.y, BOWL.rx + 18, BOWL.ry + 14, '#f4efe6', '#2b3f66', 3);
    g.strokeStyle = '#3a6ea5'; g.lineWidth = 4;
    g.beginPath(); g.ellipse(BOWL.x, BOWL.y, BOWL.rx + 11, BOWL.ry + 8, 0, 0, Math.PI * 2); g.stroke();
    ell(g, BOWL.x, BOWL.y, BOWL.rx, BOWL.ry, B.level > 0 ? '#e8c87a' : '#e9e2d6');
    if (B.level > 0 && B.level < 1) ell(g, BOWL.x, BOWL.y + 8, BOWL.rx * 0.7, BOWL.ry * 0.6, '#e9e2d6');
    if (B.level > 0) { g.globalAlpha = 0.35; ell(g, BOWL.x - 30, BOWL.y - 16, 40, 8, '#fff6dc'); g.globalAlpha = 1; }
    if (B.drops) {                                                                        // one shine of oil
      g.globalAlpha = 0.5; ell(g, BOWL.x + 10, BOWL.y - 4, 26, 12, '#f5c25a'); g.globalAlpha = 1;
    }
    if (B.greasy) { g.globalAlpha = 0.55; for (let k = 0; k < 7; k++) ell(g, BOWL.x - 70 + k * 24, BOWL.y - 16 + (k % 3) * 14, 18, 8, '#d8901f'); g.globalAlpha = 1; }
    for (let k = 0; k < B.gold; k++) { g.fillStyle = '#f2c14e'; g.fillRect(BOWL.x - 60 + k * 22, BOWL.y - 10 + (k % 2) * 12, 9, 9); }
    for (const c of B.chives) { g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.fillStyle = '#3f9d48'; g.fillRect(-5, -1.3, 10, 2.6); g.restore(); }
    if (B.frost > 0) {
      g.globalAlpha = B.frost * 0.75;
      ell(g, BOWL.x, BOWL.y, BOWL.rx + 16, BOWL.ry + 12, '#cfe6ff');
      g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      for (let k = 0; k < 10; k++) { const a = k * 0.63; g.beginPath(); g.moveTo(BOWL.x + Math.cos(a) * 40, BOWL.y + Math.sin(a) * 18); g.lineTo(BOWL.x + Math.cos(a) * 100, BOWL.y + Math.sin(a) * 44); g.stroke(); }
      g.globalAlpha = 1;
    }
    // warm-up ring
    if (phase === 'warm' && B.warmth > 0) {
      g.strokeStyle = '#ffb86b'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.ellipse(BOWL.x, BOWL.y, BOWL.rx + 26, BOWL.ry + 22, 0, -Math.PI / 2, -Math.PI / 2 + B.warmth * Math.PI * 2); g.stroke();
    }
    // the ladle in your hand
    if (phase === 'ladle' && ph.ladle) {
      g.strokeStyle = '#9aa0a8'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ph.ladle.x, ph.ladle.y); g.lineTo(ph.ladle.x + 40, ph.ladle.y - 70); g.stroke();
      ell(g, ph.ladle.x, ph.ladle.y, 18, 10, '#b8bec6', '#3a2a20', 2);
      ell(g, ph.ladle.x, ph.ladle.y - 1, 14, 7, '#e8c87a');
    } else if (phase === 'ladle') {
      g.strokeStyle = '#9aa0a8'; g.lineWidth = 5; g.beginPath(); g.moveTo(KPOT.x + 10, KPOT.y); g.lineTo(KPOT.x + 50, KPOT.y - 70); g.stroke();
    }
    // Chilli's hands: the demonstration, or settling over yours
    if (demo) { const q = demoPos(demo); if (q) hand(g, q.x, q.y, { alpha: 0.95 }); }
    if (chilliHand) hand(g, chilliHand.x, chilliHand.y, { alpha: Math.min(1, chilliHand.t * 4, (chilliHand.sec - chilliHand.t) * 4) });

    if (reveal) drawReveal(g, reveal.t);
  };

  function drawReveal(g, t) {
    // light beams, then the steam draws a stone bridge
    const a = clamp(t / 0.8, 0, 1) * (t > 2.4 ? clamp(1 - (t - 2.4) / 0.4, 0, 1) : 1);
    g.save(); g.translate(BOWL.x, BOWL.y - 10);
    for (let k = 0; k < 12; k++) {
      g.rotate(Math.PI / 6 + Math.sin(t) * 0.01);
      g.fillStyle = `rgba(255,230,160,${0.18 * a})`;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-30, -420); g.lineTo(30, -420); g.closePath(); g.fill();
    }
    g.restore();
    const b = clamp((t - 0.6) / 1.6, 0, 1);
    if (b > 0 && t < 2.8) {
      g.strokeStyle = `rgba(255,255,255,${0.75 * (t > 2.4 ? 1 - (t - 2.4) / 0.4 : 1)})`; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(BOWL.x, 120, 110, Math.PI, Math.PI + Math.PI * b); g.stroke();
      g.beginPath(); g.arc(BOWL.x, 120, 70, Math.PI, Math.PI + Math.PI * b); g.stroke();
      for (let k = 0; k < 7 * b; k++) { const ang = Math.PI + (k + 0.5) / 7 * Math.PI; g.beginPath(); g.moveTo(BOWL.x + Math.cos(ang) * 70, 120 + Math.sin(ang) * 70); g.lineTo(BOWL.x + Math.cos(ang) * 110, 120 + Math.sin(ang) * 110); g.stroke(); }
    }
    // sepia flashback
    const fb = clamp((t - 2.4) / 0.4, 0, 1) * clamp(1 - (t - 6.2) / 0.4, 0, 1);
    if (fb > 0) {
      g.globalAlpha = fb;
      g.fillStyle = '#d9b98a'; g.fillRect(-20, -20, CW + 40, CH + 40);
      const vg = g.createRadialGradient(CW / 2, CH / 2, 80, CW / 2, CH / 2, 360);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,40,15,.6)');
      g.fillStyle = vg; g.fillRect(-20, -20, CW + 40, CH + 40);
      const ink = '#4a2e18';
      g.fillStyle = '#b8955f'; g.fillRect(0, 250, CW, 90);
      g.fillStyle = '#a4814f'; g.fillRect(0, 244, CW, 12);
      // the kid on the kerb
      ell(g, 200, 200, 15, 15, ink);
      rr(g, 186, 214, 28, 34, 9, ink);
      rr(g, 192, 244, 28, 10, 5, ink);
      // Grandpa sets down the bowl
      const lean = clamp((t - 2.8) / 1.2, 0, 1);
      rr(g, 318, 180, 12, 72, 5, ink); rr(g, 336, 180, 12, 72, 5, ink);          // legs
      g.save(); g.translate(333, 186); g.rotate(-0.9 * lean);                       // he bends at the hip
      rr(g, -17, -78, 34, 82, 14, ink);
      ell(g, 0, -94, 17, 17, ink);
      g.lineWidth = 9; g.strokeStyle = ink; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-8, -66); g.lineTo(-30, -30); g.stroke();
      g.restore();
      const bx = 300 - lean * 60, by = 170 + lean * 74;
      ell(g, bx, by, 20, 8, ink);
      g.beginPath(); g.ellipse(bx, by, 20, 14, 0, 0, Math.PI); g.fill();
      if (lean >= 1) for (let k = 0; k < 3; k++) { g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); const sx = bx - 8 + k * 8; g.moveTo(sx, by - 10); g.bezierCurveTo(sx - 6, by - 20, sx + 6, by - 28, sx, by - 38 - Math.sin(t * 2 + k) * 3); g.stroke(); }
      g.globalAlpha = 1;
    }
  }

  go('warm', 'Cold bowl, cold soup. Warm it.', 'Press and hold the bowl');
  return loop(S, update, draw).then(() => {
    S.close();
    rec.score = ['warm', 'slow', 'oneDrop', 'chives', 'waited'].filter(k => rec[k]).length;
    G.flags.chilliBowl = rec;
    return rec;
  });
}
