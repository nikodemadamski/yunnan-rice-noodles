// Grandma's kitchen: cook a cross-bridge bowl, Cooking Mama / Papa's style.
//   1 Broth  – drop in the base, hold the flame in the simmer zone, skim the scum
//   2 Slice  – chop the meat on each dashed line as it slides under the knife
//   3 Egg    – tap when the swinging quail egg is over the star
//   4 Noodles – lift the basket when the timer-ring needle is in the green
//   5 Oil    – pick an oil, hold to pour, let go inside the band
//   6 Build  – add ingredients from the bins in the legend's order before it cools
//   7 Taste  – a score ticket per station, a medal, and grandma's verdict on the recipe
// Every gesture step opens with a one-second hint; a failed step gets a
// "Grandma will fix it!" and the bowl carries on (no step ever blocks the dish).
// Resolves with { greens, perfect, extras, pick, skill } like the old Bowl Lab.

import { G, addTicker, clamp, esc, rng } from './core.js';
import { openPanel, closePanel, beat } from './ui.js';
import { isActionHeld } from './input.js';
import { sfx } from './audio.js';
import { SLOTS, EXTRAS, hasOption } from './bowllab.js';

const W = 560, H = 340;
const STEPS = ['Broth', 'Slice', 'Egg', 'Noodles', 'Oil', 'Build', 'Taste'];
const R = rng(88);

let canvas, ctx, ui, title, msg, panel, holdBtn;
let held = false;

function grade(s) {
  if (s >= 0.9) return ['PERFECT!', 'perfect'];
  if (s >= 0.7) return ['GREAT!', 'great'];
  if (s >= 0.45) return ['OK!', 'ok'];
  return ['OOPS…', 'oops'];
}

async function stamp(score) {
  const [text, cls] = grade(score);
  const el = document.createElement('div');
  el.className = `k-stamp ${cls}`;
  el.textContent = text;
  const stage = panel.querySelector('.k-stage');
  stage.appendChild(el);
  sfx(score >= 0.7 ? 'ding' : score >= 0.45 ? 'pop' : 'fail');
  // Grandma reacts: praise for a top step, and a failed step never stops the bowl
  let say = null;
  if (score >= 0.95) say = '👵✨ Better than Grandma!';
  else if (score < 0.45) say = '👵🔥 Don’t worry, Grandma will fix it!';
  let bubble = null;
  if (say) {
    bubble = document.createElement('div');
    bubble.className = `k-grandma ${score < 0.45 ? 'fix' : ''}`;
    bubble.textContent = say;
    stage.appendChild(bubble);
  }
  await beat(say ? 1.9 : 1.4);
  el.remove();
  if (bubble) bubble.remove();
}

// A one-second "ghost hand" hint before each gesture step (Cooking Mama style).
async function hint(gesture, text) {
  tiles();   // never show the previous station behind the hint
  const el = document.createElement('div');
  el.className = 'k-hint';
  el.innerHTML = `<span class="hand">${gesture}</span><span>${esc(text)}</span>`;
  panel.querySelector('.k-stage').appendChild(el);
  sfx('beep');
  await beat(1.1);
  el.remove();
}

function setStep(i, heading, help) {
  panel.querySelectorAll('.k-step').forEach((s, j) => {
    s.classList.toggle('on', j === i);
    s.classList.toggle('done', j < i);
  });
  title.textContent = heading;
  msg.textContent = help || '';
  ui.innerHTML = '';
}

function showHold(label) {
  holdBtn.textContent = label;
  holdBtn.classList.remove('hidden');
}

const holding = () => held || isActionHeld();

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

// ---------- drawing helpers ----------

function bg(top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function tiles() {
  bg('#efe3ff', '#dcc8f5');
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function flames(cx, cy, r, heat, t) {
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = 8 + heat * 26 + Math.sin(t * 20 + i) * 4 * heat;
    const x = cx + Math.cos(a) * (r + 4), y = cy + Math.sin(a) * (r + 4) * 0.9;
    ctx.fillStyle = heat > 0.75 ? '#ff5a1f' : '#ffa62b';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a + 1.57) * 5, y + Math.sin(a + 1.57) * 5);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.lineTo(x - Math.cos(a + 1.57) * 5, y - Math.sin(a + 1.57) * 5);
    ctx.fill();
  }
}

function pot(cx, cy, r, broth) {
  ctx.fillStyle = '#7d8590';
  ctx.fillRect(cx - r - 34, cy - 12, 30, 24);
  ctx.fillRect(cx + r + 4, cy - 12, 30, 24);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r + 10);
  g.addColorStop(0, '#f4f6f8'); g.addColorStop(1, '#9aa3ad');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4d545c'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = broth;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function emoji(e, x, y, size) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y);
}

function gaugeV(x, y, h, value, lo, hi, label) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5b4636'; ctx.lineWidth = 3;
  roundRect(x, y, 26, h, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9be3a8';
  ctx.fillRect(x + 3, y + h * (1 - hi), 20, h * (hi - lo));
  const my = y + h * (1 - value);
  ctx.fillStyle = '#e0602c';
  ctx.beginPath(); ctx.moveTo(x - 10, my - 8); ctx.lineTo(x - 2, my); ctx.lineTo(x - 10, my + 8); ctx.fill();
  ctx.fillRect(x + 2, my - 2, 22, 4);
  ctx.fillStyle = '#5b4636'; ctx.font = '900 13px Nunito, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + 13, y + h + 18);
}

function gaugeH(x, y, w, value, lo, hi) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5b4636'; ctx.lineWidth = 3;
  roundRect(x, y, w, 22, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9be3a8';
  ctx.fillRect(x + w * lo, y + 3, w * (hi - lo), 16);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(x + 3, y + 5, Math.max(0, (w - 6) * Math.min(1, value)), 12);
  ctx.fillStyle = '#e0602c';
  ctx.fillRect(x + w * Math.min(1, value) - 2, y - 4, 4, 30);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function timerBar(frac) {
  ctx.fillStyle = 'rgba(91,70,54,0.15)';
  ctx.fillRect(0, H - 8, W, 8);
  ctx.fillStyle = '#c86bfa';
  ctx.fillRect(0, H - 8, W * (1 - frac), 8);
}

function floatText(list, t) {
  ctx.textAlign = 'center';
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    f.t += t;
    if (f.t > 1) { list.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - f.t;
    ctx.fillStyle = f.color;
    ctx.font = '900 22px Nunito, sans-serif';
    ctx.fillText(f.text, f.x, f.y - f.t * 30);
    ctx.globalAlpha = 1;
  }
}

function pickButtons(slot, onPick) {
  ui.innerHTML = `<div class="k-bins">${slot.options.map(o => {
    const have = hasOption(slot, o);
    return `<button class="k-bin" data-id="${o.id}" ${have ? '' : 'disabled'}>
      <span class="ico">${have ? o.ico : '❔'}</span><span>${esc(have ? o.name : o.hint || '???')}</span></button>`;
  }).join('')}</div>`;
  ui.querySelectorAll('.k-bin').forEach(b => b.addEventListener('click', () => {
    ui.innerHTML = '';
    sfx('pop');
    onPick(slot.options.find(o => o.id === b.dataset.id));
  }));
}

function run(frame) {
  return new Promise(res => {
    let t = 0;
    addTicker(dt => {
      t += dt;
      const out = frame(dt, t);
      if (out !== undefined) { res(out); return true; }
    });
  });
}

// ---------- 1. broth ----------

async function stepBroth(st) {
  setStep(0, '1 · Make the broth', 'Pick a base for the pot.');
  tiles(); flames(280, 175, 120, 0.2, 0); pot(280, 175, 120, '#e8e0cf');
  const base = await new Promise(res => pickButtons(SLOTS[0], res));
  st.broth = base.id;
  const color = base.color;
  // drop it in
  await run((dt, t) => {
    tiles(); flames(280, 175, 120, 0.2, t); pot(280, 175, 120, '#e8e0cf');
    emoji(base.ico, 280, -40 + Math.min(1, t / 0.6) * 215, 64);
    if (t > 0.8) { sfx('splash'); return true; }
  });
  setStep(0, '1 · Simmer & skim', 'Hold 🔥 (or Space) to raise the heat. Keep it in the green. Tap the scum to skim it!');
  showHold('🔥 Hold for heat');
  await hint('👇', 'HOLD to heat · TAP the scum');
  let heat = 0.25, inZone = 0, spawned = 0, skimmed = 0, spawnT = 1;
  const bubbles = [], scum = [], fx = [];
  const DUR = 10, LO = 0.45, HI = 0.72;
  const onTap = e => {
    const p = toCanvas(e);
    for (let i = scum.length - 1; i >= 0; i--) {
      if (Math.hypot(p.x - scum[i].x, p.y - scum[i].y) < scum[i].r + 12) {
        fx.push({ text: 'Skim!', x: scum[i].x, y: scum[i].y, t: 0, color: '#3a9a5a' });
        scum.splice(i, 1); skimmed++; sfx('pop');
        return;
      }
    }
  };
  canvas.addEventListener('pointerdown', onTap);
  const score = await run((dt, t) => {
    heat = clamp(heat + (holding() ? 0.55 : -0.32) * dt + (R() - 0.5) * 0.25 * dt, 0, 1);
    if (heat >= LO && heat <= HI) inZone += dt;
    if (R() < heat * 18 * dt) bubbles.push({ a: R() * 6.28, d: R() * 105, r: 2, life: 0 });
    spawnT -= dt * (heat > HI ? 1.8 : 1);
    if (spawnT <= 0 && scum.length < 6) {
      spawnT = 1.2 + R();
      spawned++;
      const a = R() * 6.28, d = R() * 85;
      scum.push({ x: 280 + Math.cos(a) * d, y: 175 + Math.sin(a) * d, r: 12 + R() * 8 });
    }
    tiles();
    flames(280, 175, 120, heat, t);
    pot(280, 175, 120, color);
    emoji(base.ico, 280 + Math.sin(t * 2) * 10, 175 + Math.cos(t * 1.7) * 8, 44);
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.life += dt; b.r += dt * 10;
      if (b.life > 0.5) { bubbles.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(280 + Math.cos(b.a) * b.d, 175 + Math.sin(b.a) * b.d, b.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const s of scum) {
      ctx.fillStyle = '#d8c7a3';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 6.28, rr = s.r * (0.8 + 0.25 * Math.sin(k * 3 + t * 2));
        ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
      }
      ctx.fill();
    }
    gaugeV(36, 60, 220, heat, LO, HI, 'HEAT');
    ctx.fillStyle = '#5b4636'; ctx.font = '900 16px Nunito, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(heat > HI ? 'Too hot! 💦' : heat < LO ? 'Too cold…' : 'Simmering ♪', W - 16, 30);
    floatText(fx, dt);
    timerBar(t / DUR);
    if (G.skip || t >= DUR) {
      const skim = spawned ? Math.min(1, skimmed / spawned) : 1;
      return clamp((inZone / DUR) * 0.7 / 0.8 + skim * 0.3, 0, 1);
    }
  });
  canvas.removeEventListener('pointerdown', onTap);
  holdBtn.classList.add('hidden');
  st.brothScore = score;
  await stamp(score);
}

// ---------- 2. slice ----------

async function stepSlice(st) {
  setStep(1, '2 · Slice it thin', 'Tap (or Space) when a dashed line is under the knife. Thin slices cook in the hot broth!');
  await hint('👆', 'TAP on the lines!');
  const KNIFE = 300, SPEED = 85, MARKS = 7, GAP = 44;
  let slabX = KNIFE + 70, chopT = 0, results = [];
  const marks = Array.from({ length: MARKS }, (_, i) => ({ off: 40 + i * GAP, hit: null }));
  const fx = [];
  let pressed = false;
  const chop = () => { pressed = true; };
  canvas.addEventListener('pointerdown', chop);
  const onKey = e => { if (e.code === 'Space' || e.code === 'KeyE') chop(); };
  addEventListener('keydown', onKey);
  const score = await run((dt, t) => {
    slabX -= SPEED * dt;
    chopT = Math.max(0, chopT - dt);
    if (pressed) {
      pressed = false;
      chopT = 0.15;
      sfx('whack');
      let best = null, bd = 1e9;
      for (const m of marks) if (!m.hit) { const d = Math.abs(slabX + m.off - KNIFE); if (d < bd) { bd = d; best = m; } }
      if (best && bd < 30) {
        best.hit = bd < 6 ? 'perfect' : bd < 13 ? 'good' : 'ok';
        best.x = KNIFE;
        fx.push({ text: best.hit === 'perfect' ? 'Perfect!' : best.hit === 'good' ? 'Good' : 'OK', x: KNIFE, y: 90, t: 0, color: best.hit === 'perfect' ? '#e0602c' : '#5b4636' });
      } else {
        fx.push({ text: 'Whiff!', x: KNIFE, y: 90, t: 0, color: '#a3322a' });
        results.push(0);
      }
    }
    for (const m of marks) if (!m.hit && slabX + m.off < KNIFE - 30) {
      m.hit = 'miss';
      fx.push({ text: 'Miss', x: KNIFE - 40, y: 110, t: 0, color: '#a3322a' });
    }
    // board
    bg('#fde8f1', '#f6cfe0');
    ctx.fillStyle = '#d9a86c'; roundRect(40, 120, 480, 170, 18); ctx.fill();
    ctx.strokeStyle = '#a8754a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#c99556';
    for (let i = 0; i < 6; i++) ctx.fillRect(60, 140 + i * 25, 440, 2);
    // slab
    const sw = 40 + MARKS * GAP + 10;
    ctx.save();
    ctx.beginPath(); ctx.rect(40, 0, 480, H); ctx.clip();
    ctx.fillStyle = '#f4a3a3'; roundRect(slabX, 160, sw, 90, 22); ctx.fill();
    ctx.strokeStyle = '#d97a7a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(slabX + 20 + i * 70, 180); ctx.quadraticCurveTo(slabX + 50 + i * 70, 205, slabX + 30 + i * 70, 235); ctx.stroke(); }
    for (const m of marks) {
      const x = slabX + m.off;
      ctx.strokeStyle = m.hit && m.hit !== 'miss' ? '#7a2b22' : '#5b4636';
      ctx.setLineDash(m.hit && m.hit !== 'miss' ? [] : [8, 6]);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 156); ctx.lineTo(x, 254); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    // knife
    const ky = chopT > 0 ? 40 : 0;
    ctx.fillStyle = '#cfd8dc'; ctx.strokeStyle = '#5b4636'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(KNIFE - 4, 40 + ky); ctx.lineTo(KNIFE + 34, 40 + ky); ctx.lineTo(KNIFE + 34, 150 + ky); ctx.lineTo(KNIFE - 4, 170 + ky); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5b3b22'; roundRect(KNIFE + 2, 0 + ky, 26, 44, 8); ctx.fill();
    floatText(fx, dt);
    if (G.skip || marks.every(m => m.hit)) {
      const val = { perfect: 1, good: 0.75, ok: 0.45, miss: 0 };
      const all = marks.map(m => val[m.hit] ?? 0).concat(results);
      return all.reduce((a, b) => a + b, 0) / all.length;
    }
  });
  canvas.removeEventListener('pointerdown', chop);
  removeEventListener('keydown', onKey);
  st.slice = score;
  await stamp(score);
}

// ---------- 3. egg ----------

async function stepEgg(st) {
  setStep(2, '3 · Crack the quail eggs', 'The egg swings over the bowl. Tap (or Space) when it’s above the ★ to crack it in!');
  await hint('👆', 'TAP over the ★');
  const EGGS = 2, results = [], fx = [];
  let pressed = false, fall = null;
  const tap = () => { pressed = true; };
  canvas.addEventListener('pointerdown', tap);
  const onKey = e => { if (e.code === 'Space' || e.code === 'KeyE') tap(); };
  addEventListener('keydown', onKey);
  const brothColor = SLOTS[0].options.find(o => o.id === st.broth).color;
  let swingT = 0;
  const score = await run((dt, t) => {
    swingT += dt;
    const ex = 280 + Math.sin(swingT * 2.4) * 190;
    if (pressed && !fall && results.length < EGGS) {
      pressed = false;
      const d = Math.abs(ex - 280);
      const v = d < 14 ? 1 : d < 34 ? 0.75 : d < 60 ? 0.45 : 0;
      results.push(v);
      fall = { x: ex, y: 70, good: v > 0 };
      sfx(v > 0 ? 'whack' : 'fail');
      fx.push({ text: v === 1 ? 'Perfect!' : v >= 0.75 ? 'Good' : v > 0 ? 'OK' : 'Splat!', x: ex, y: 50, t: 0, color: v > 0 ? '#e0602c' : '#a3322a' });
    }
    pressed = false;
    tiles();
    // bowl, side view
    ctx.fillStyle = brothColor; ctx.beginPath(); ctx.ellipse(280, 230, 150, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#5b7fb5'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(130, 230); ctx.quadraticCurveTo(140, 330, 280, 332); ctx.quadraticCurveTo(420, 330, 430, 230); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f0b429'; ctx.font = '900 30px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 280, 150);
    if (results.length < EGGS && !fall) emoji('🥚', ex, 70, 46);
    if (fall) {
      fall.y += dt * 420;
      emoji(fall.good ? '🍳' : '💥', fall.x, fall.y, 40);
      if (fall.y > 220) { fall = null; if (results.length < EGGS) swingT = 0; }
    }
    results.forEach((v, i) => emoji(v > 0 ? '🍳' : '💥', 250 + i * 60, 230, 30));
    floatText(fx, dt);
    timerBar(Math.min(1, t / 12));
    if (G.skip || (results.length >= EGGS && !fall) || t > 12) {
      while (results.length < EGGS) results.push(0);
      return results.reduce((a, b) => a + b, 0) / EGGS;
    }
  });
  canvas.removeEventListener('pointerdown', tap);
  removeEventListener('keydown', onKey);
  st.egg = score;
  await stamp(score);
}

// ---------- 4. noodles (Papa's-style timer ring) ----------

async function stepNoodles(st) {
  setStep(3, '4 · Blanch the noodles', 'Fresh rice noodles need a quick dip. Tap (or Space) to lift them when the needle is in the green!');
  await hint('👆', 'TAP in the green');
  const LO = 0.55, HI = 0.75, DUR = 5.5;
  let lifted = null;
  const lift = () => { if (lifted === null) lifted = 'now'; };
  canvas.addEventListener('pointerdown', lift);
  const onKey = e => { if (e.code === 'Space' || e.code === 'KeyE') lift(); };
  addEventListener('keydown', onKey);
  const score = await run((dt, t) => {
    const v = Math.min(1, t / DUR);
    if (lifted === 'now') { lifted = v; sfx('splash'); }
    tiles();
    flames(200, 190, 105, 0.8, t);
    pot(200, 190, 105, '#e6eef2');
    // strainer basket with noodles
    const lift = lifted === null ? 0 : 60;
    ctx.strokeStyle = '#7d5a3c'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(200, 190 - lift); ctx.lineTo(330, 60 - lift); ctx.stroke();
    ctx.fillStyle = 'rgba(160,160,160,0.6)';
    ctx.beginPath(); ctx.arc(200, 190 - lift, 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(160 + i * 12, 160 - lift);
      ctx.bezierCurveTo(150 + i * 12, 190 - lift, 175 + i * 12, 200 - lift, 165 + i * 12, 225 - lift);
      ctx.stroke();
    }
    // the timer ring (under / ideal / over)
    const cx = 430, cy = 170, r = 70;
    const arc = (a0, a1, col) => { ctx.strokeStyle = col; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 + a0 * 6.283, -Math.PI / 2 + a1 * 6.283); ctx.stroke(); };
    arc(0, LO, '#d9d2e8'); arc(LO, HI, '#9be3a8'); arc(HI, 1, '#f3a0a0');
    const nv = lifted === null ? v : lifted;
    const na = -Math.PI / 2 + nv * 6.283;
    ctx.strokeStyle = '#5b4636'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (r + 8), cy + Math.sin(na) * (r + 8)); ctx.stroke();
    ctx.fillStyle = '#5b4636'; ctx.font = '900 14px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(nv < LO ? 'Too firm' : nv <= HI ? 'Just right!' : 'Too soft!', cx, cy + r + 34);
    if (G.skip || (lifted !== null && lifted !== 'now') || v >= 1) {
      const x = lifted === null || lifted === 'now' ? 1 : lifted;
      if (x >= LO && x <= HI) return 1;
      return clamp(1 - Math.min(Math.abs(x - LO), Math.abs(x - HI)) * 4, 0, 1);
    }
  });
  canvas.removeEventListener('pointerdown', lift);
  removeEventListener('keydown', onKey);
  await beat(0.4);
  st.noodles = score;
  await stamp(score);
}

// ---------- 5. oil ----------

async function stepOil(st) {
  setStep(4, '5 · Seal the heat', 'Pick an oil for the top of the broth.');
  const brothColor = SLOTS[0].options.find(o => o.id === st.broth).color;
  tiles(); flames(280, 190, 110, 0.5, 0); pot(280, 190, 110, brothColor);
  const oil = await new Promise(res => pickButtons(SLOTS[1], res));
  st.oil = oil.id;
  if (oil.id === 'none') {
    msg.textContent = 'No oil… the steam escapes straight away.';
    st.oilScore = 0.3;
    await beat(1.6);
    return;
  }
  setStep(4, '5 · Pour the oil layer', 'Hold to pour (or hold Space). Let go inside the green band!');
  showHold('🫗 Hold to pour');
  await hint('👇', 'HOLD… let go in the green!');
  const LO = 0.55, HI = 0.8;
  let layer = 0, started = false;
  const tint = oil.id === 'chilli' ? '217,56,30' : '255,226,140';
  const score = await run((dt, t) => {
    const h = holding();
    if (h) { started = true; layer += dt * 0.38; if (R() < 0.3) sfx('type'); }
    tiles();
    flames(280, 190, 110, 0.5, t);
    pot(280, 190, 110, brothColor);
    ctx.fillStyle = `rgba(${tint},${Math.min(0.85, layer)})`;
    ctx.beginPath(); ctx.arc(280, 190, 110 * Math.min(1, 0.3 + layer), 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 * Math.min(1, layer * 2)})`;
      ctx.beginPath(); ctx.ellipse(250 + i * 14, 160 + (i % 2) * 30, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // ladle
    ctx.save();
    ctx.translate(330, 60);
    ctx.rotate(h ? 0.7 : 0.2);
    ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#7d5a3c'; ctx.fillRect(20, -6, 110, 10);
    ctx.restore();
    if (h) { ctx.fillStyle = `rgba(${tint},0.9)`; ctx.fillRect(312, 80, 6, 100); }
    gaugeH(130, 300, 300, layer, LO, HI);
    ctx.fillStyle = '#5b4636'; ctx.font = '900 13px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('OIL LAYER', 280, 295);
    if (G.skip || (started && !h) || layer >= 1.15) {
      if (layer >= LO && layer <= HI) return 1;
      return clamp(1 - Math.min(Math.abs(layer - LO), Math.abs(layer - HI)) * 3, 0, 1);
    }
  });
  holdBtn.classList.add('hidden');
  st.oilScore = score;
  st.oilLayer = true;
  await stamp(score);
}

// ---------- 4. build ----------

const BINS = [
  { id: 'meat', name: 'Raw slices', ico: '🥩', group: 0, free: true },
  { id: 'egg', name: 'Quail egg', ico: '🥚', group: 1, free: true },
  { id: 'chives', name: 'Chives', ico: '🌿', group: 2, finding: 'top:chives' },
  { id: 'rose', name: 'Rose petals', ico: '🌸', group: 2, finding: 'top:rose' },
  { id: 'potato', name: 'Fried potato', ico: '🥔', group: 2, free: true },
  { id: 'cheese', name: 'Cheddar', ico: '🧀', group: 2, free: true },
  { id: 'noodles', name: 'Rice noodles', ico: '🍜', group: 3, free: true },
];

async function stepBuild(st) {
  setStep(5, '6 · Cross the bridge', 'Tap ingredients into the boiling bowl. The legend’s order: meat → egg → greens → noodles. Serve before it cools!');
  const added = [];
  const extras = [];
  const history = [];
  panel.querySelector('.kitchen').classList.add('build');
  const brothColor = SLOTS[0].options.find(o => o.id === st.broth).color;
  // a good oil layer keeps the heat in
  const loss = st.oil === 'fat' ? 0.012 + (1 - st.oilScore) * 0.02 : st.oil === 'chilli' ? 0.025 : 0.06;
  let heat = 1, served = false;
  const renderUI = () => {
    ui.innerHTML = `<div class="row" style="justify-content:space-between">
      <button class="btn-soft" id="k-undo">↶ Undo</button>
      <button class="btn-big" id="k-serve" ${added.length ? '' : 'disabled'}>Serve! 🍜</button></div>
    <div class="k-bins">${BINS.map(b => {
      const have = b.free || G.findings.has(b.finding);
      const used = added.includes(b.id);
      return `<button class="k-bin ${used ? 'used' : ''}" data-bin="${b.id}" ${have && !used ? '' : 'disabled'}>
        <span class="ico">${have ? b.ico : '❔'}</span><span>${have ? esc(b.name) : '???'}</span></button>`;
    }).join('')}</div>
    <div class="k-bins">${EXTRAS.map(e => `<button class="k-bin extra ${extras.includes(e.id) ? 'used' : ''}" data-extra="${e.id}" ${extras.includes(e.id) ? 'disabled' : ''}>
      <span class="ico">${e.ico}</span><span>${esc(e.name)}</span></button>`).join('')}</div>
`;
    ui.querySelectorAll('[data-bin]').forEach(b => b.addEventListener('click', () => {
      added.push(b.dataset.bin); history.push(added); sfx('splash'); renderUI();
    }));
    ui.querySelectorAll('[data-extra]').forEach(b => b.addEventListener('click', () => {
      extras.push(b.dataset.extra); history.push(extras); sfx('pop'); renderUI();
    }));
    ui.querySelector('#k-undo').addEventListener('click', () => {
      const list = history.pop();
      if (list) { list.pop(); sfx('beep'); }
      renderUI();
    });
    ui.querySelector('#k-serve').addEventListener('click', () => { served = true; });
  };
  renderUI();
  await run((dt, t) => {
    heat = Math.max(0, heat - loss * dt);
    tiles();
    // the big bowl, top view
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#5b7fb5'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(280, 160, 135, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(280, 160, 120, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = brothColor;
    ctx.beginPath(); ctx.arc(280, 160, 108, 0, Math.PI * 2); ctx.fill();
    if (st.oil !== 'none') {
      ctx.fillStyle = st.oil === 'chilli' ? 'rgba(217,56,30,0.45)' : 'rgba(255,230,150,0.55)';
      ctx.beginPath(); ctx.arc(280, 160, 108, 0, Math.PI * 2); ctx.fill();
    }
    added.forEach((id, i) => {
      const b = BINS.find(x => x.id === id);
      const a = i * 2.4 + 0.4, d = 28 + (i % 3) * 24;
      emoji(b.ico, 280 + Math.cos(a) * d, 160 + Math.sin(a) * d, 40);
    });
    extras.forEach((id, i) => emoji(EXTRAS.find(e => e.id === id).ico, 200 + i * 70, 60, 36));
    // steam shows the heat
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * heat})`; ctx.lineWidth = 6;
      ctx.beginPath();
      const x = 200 + i * 40, y0 = 40 + ((t * 40 + i * 20) % 30);
      ctx.moveTo(x, y0 + 30); ctx.bezierCurveTo(x - 12, y0 + 15, x + 12, y0 + 5, x, y0 - 10); ctx.stroke();
    }
    gaugeV(500, 60, 200, heat, 0.6, 1, 'HOT');
    if (G.skip || served) return true;
  });
  panel.querySelector('.kitchen').classList.remove('build');
  st.added = added;
  st.extras = extras;
  st.heat = heat;
}

// ---------- 5. taste ----------

function orderScore(added) {
  const groups = added.map(id => BINS.find(b => b.id === id).group);
  let ok = 0, pairs = 0;
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    if (groups[i] === groups[j]) continue;
    pairs++;
    if (groups[i] < groups[j]) ok++;
  }
  let s = pairs ? ok / pairs : 0.5;
  if (!added.includes('meat')) s *= 0.6;
  if (!added.includes('noodles')) s *= 0.5;
  return s;
}

function toppingPick(added) {
  if (added.includes('cheese')) return 'cheese';
  if (added.includes('rose')) return 'rose';
  if (added.includes('chives')) return 'chives';
  if (added.includes('potato')) return 'potato';
  return null;
}

async function stepTaste(st) {
  setStep(6, '7 · Grandma tastes', '');
  const pick = { broth: st.broth, oil: st.oil, top: toppingPick(st.added) };
  const fb = {
    broth: SLOTS[0].options.find(o => o.id === pick.broth),
    oil: SLOTS[1].options.find(o => o.id === pick.oil),
    top: pick.top ? SLOTS[2].options.find(o => o.id === pick.top) : { verdict: 'close', fb: 'Plain… something green is missing.' },
  };
  const greens = ['broth', 'oil', 'top'].filter(k => fb[k].verdict === 'good').length;
  const skill = {
    'Simmer & skim': st.brothScore,
    'Slicing': st.slice,
    'Egg crack': st.egg,
    'Noodles': st.noodles,
    'Oil layer': st.oilScore,
    'Order of the bridge': orderScore(st.added),
    'Served hot': clamp((st.heat - 0.3) / 0.6, 0, 1),
  };
  const skillAvg = Object.values(skill).reduce((a, b) => a + b, 0) / Object.keys(skill).length;
  const recipe = greens / 3 * (st.extras.length ? 0.6 : 1);
  const total = Math.round((skillAvg * 0.5 + recipe * 0.5) * 100);
  // Cooking Mama style medal for the whole bowl
  const medal = total >= 95 ? ['🥇', 'Gold · Better than Grandma!'] : total >= 80 ? ['🥈', 'Silver'] : total >= 55 ? ['🥉', 'Bronze'] : ['👵', 'Grandma fixed it'];
  // grandma's tasting faces, then the ticket
  await run((dt, t) => {
    tiles();
    const faces = ['😐', '🥄', '😮', total >= 80 ? '😭' : total >= 55 ? '🙂' : '😖'];
    emoji(faces[Math.min(faces.length - 1, Math.floor(t / 0.55))], 280, 160, 120);
    if (G.skip || t > faces.length * 0.55 + 0.4) return true;
  });
  const bar = v => `<div class="bar"><div class="fill" style="width:${Math.round(v * 100)}%; background:${v >= 0.7 ? '#49b26a' : v >= 0.45 ? '#f0b429' : '#e2574c'}"></div></div>`;
  const dot = v => (v === 'good' ? '🟢' : v === 'close' ? '🟡' : '🔴');
  panel.querySelector('.k-stage').classList.add('hidden');
  ui.innerHTML = `<div class="k-ticket">
    <div class="row" style="justify-content:space-between"><b>${medal[0]} ${medal[1]}</b><span class="k-total">${total}%</span></div>
    ${Object.entries(skill).map(([k, v]) => `<div class="meter"><span style="width:150px; font-size:13px">${k}</span>${bar(v)}</div>`).join('')}
    <h3>Taste</h3>
    ${['broth', 'oil', 'top'].map(k => `<div class="fb ${fb[k].verdict}">${dot(fb[k].verdict)} ${esc(fb[k].fb)}</div>`).join('')}
    ${st.extras.length ? '<div class="fb bad">🔴 Too much! It tastes like that Wang’s bowl!</div>' : ''}
    <div class="row" style="justify-content:flex-end; margin-top:10px"><button class="btn-big" id="k-done">Continue</button></div>
  </div>`;
  sfx(total >= 80 ? 'reveal' : total >= 55 ? 'ding' : 'fail');
  await new Promise(res => ui.querySelector('#k-done').addEventListener('click', res));
  return { greens, perfect: greens === 3 && st.extras.length === 0, extras: st.extras, pick, skill, total, medal: medal[1] };
}

// ---------- entry ----------

export async function cookBowl() {
  panel = openPanel(`<div class="kitchen">
    <div class="k-steps">${STEPS.map((s, i) => `<span class="k-step">${i + 1} ${s}</span>`).join('')}</div>
    <h2 class="k-title"></h2>
    <div class="k-stage"><canvas class="k-canvas"></canvas></div>
    <p class="k-msg"></p>
    <button class="btn-big hold-btn hidden" id="k-hold"></button>
    <div class="k-ui"></div>
  </div>`);
  canvas = panel.querySelector('.k-canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ui = panel.querySelector('.k-ui');
  title = panel.querySelector('.k-title');
  msg = panel.querySelector('.k-msg');
  holdBtn = panel.querySelector('#k-hold');
  holdBtn.addEventListener('pointerdown', e => { e.preventDefault(); held = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) holdBtn.addEventListener(ev, () => { held = false; });
  G.skip = false;

  const st = {};
  await stepBroth(st);
  await stepSlice(st);
  await stepEgg(st);
  await stepNoodles(st);
  await stepOil(st);
  await stepBuild(st);
  const result = await stepTaste(st);
  closePanel();
  return result;
}
