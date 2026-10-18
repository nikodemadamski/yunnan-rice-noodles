// Day 1's two cooking scenes, drawn like the noodle shop (draw2d.js):
//   (a) promptPalLive: Old Wang streams you cooking the AI's "perfect" recipe.
//       Six silly gestures, each one the real motion (drag, stir, scrub, swipe),
//       an AI that doubles down when you ask "Are you sure?", a chat that loses
//       its mind, and Grandma's face at the end. Viral for the wrong reasons.
//   (b) chilliBowl: night, Little Chilli's stall. The same hands, slowed down:
//       warm the bowl, ladle slowly, one shine of oil (resist the extras), a few
//       chives, hands off, eat. Then her memory of Grandpa Zhao: "Less."
// Both work on a phone held upright or sideways: the layout reflows.

import { G } from './core.js';
import { sfx, note, setMusic } from './audio.js';
import { fadeIn } from './ui.js';
import { hitstop } from './fx.js';
import { chilliFlashback } from './opening.js';
import { ctx, use, C, LOOKS, P2, rr, inked, circle, ellipse, text, label, wrap, rng, checker, grain, patterns, hand, person, piece } from './draw2d.js';

// ------------------------------------------------------------ the stage
function stage({ night = false } = {}) {
  G.busy++;
  G.skip = false;
  G.flags.frozen3d = true;
  const cv = document.createElement('canvas');
  cv.className = 'shop2d';
  document.getElementById('ui').appendChild(cv);
  use(cv.getContext('2d'));
  if (night) patterns('#2f3563', '#272c55'); else patterns();
  const S = { cv, VW: 1600, VH: 900, scale: 1, ox: 0, oy: 0, ptr: { x: 0, y: 0, down: false, speed: 0, show: false, path: [] }, events: [], t: 0, draw: () => {} };
  function resize() {
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    const portrait = innerWidth / innerHeight < 0.85;
    S.VW = portrait ? 900 : 1600; S.VH = portrait ? 1600 : 900; S.portrait = portrait;
    S.scale = Math.min(innerWidth / S.VW, innerHeight / S.VH);
    S.ox = (innerWidth - S.VW * S.scale) / 2; S.oy = (innerHeight - S.VH * S.scale) / 2;
  }
  resize(); addEventListener('resize', resize);
  const toV = e => ({ x: (e.clientX - S.ox) / S.scale, y: (e.clientY - S.oy) / S.scale });
  const pd = e => { if (e.target !== cv) return; const v = toV(e); Object.assign(S.ptr, { x: v.x, y: v.y, down: true, show: true, sx: v.x, sy: v.y, t0: performance.now(), path: [[v.x, v.y, performance.now()]] }); S.events.push({ type: 'down', ...v }); };
  const pm = e => { const v = toV(e); S.ptr.x = v.x; S.ptr.y = v.y; S.ptr.show = true; if (S.ptr.down) { S.ptr.path.push([v.x, v.y, performance.now()]); if (S.ptr.path.length > 10) S.ptr.path.shift(); } };
  const pu = e => { if (!S.ptr.down) return; const v = toV(e); S.ptr.down = false; S.events.push({ type: 'up', ...v, dx: v.x - S.ptr.sx, dy: v.y - S.ptr.sy, ms: performance.now() - S.ptr.t0 }); };
  cv.addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu);
  S.speed = () => { const p = S.ptr.path; if (!S.ptr.down || p.length < 2) return 0; const a = p[0], b = p[p.length - 1]; return Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(0.016, (b[2] - a[2]) / 1000); };
  S.caption = ''; S.title = '';
  /** Run frames until step(dt, t, events) returns true. */
  S.run = step => new Promise(res => {
    let last = performance.now();
    function frame(now) {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; S.t += dt;
      const evs = S.events; S.events = [];
      const done = step ? step(dt, S.t, evs) : false;
      paint(dt);
      if (done || (step && G.skip)) { res(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  S.wait = sec => { let t = 0; return S.run(dt => (t += dt) >= sec); };
  function paint(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = night ? '#141629' : '#3a2a2a'; ctx.fillRect(0, 0, cv.width, cv.height);
    const d = cv.width / innerWidth;
    ctx.setTransform(S.scale * d, 0, 0, S.scale * d, S.ox * d, S.oy * d);
    ctx.fillStyle = checker; ctx.fillRect(-S.ox / S.scale, -S.oy / S.scale, innerWidth / S.scale, innerHeight / S.scale);   // no dead bands on tall phones
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.VW, S.VH); ctx.clip();
    ctx.fillStyle = checker; ctx.fillRect(0, 0, S.VW, S.VH);
    S.draw(dt, S.t);
    // caption bar (title + what to do)
    const h = S.portrait ? 150 : 104;
    ctx.fillStyle = night ? 'rgba(30,32,60,0.92)' : 'rgba(255,248,236,0.96)'; ctx.fillRect(0, S.VH - h, S.VW, h);
    ctx.fillStyle = night ? '#f2c14e' : C.ink; ctx.fillRect(0, S.VH - h, S.VW, 3);
    const col = night ? '#fff3dc' : C.ink;
    if (S.title) label(S.title, S.VW / 2, S.VH - h + 30, 34);
    const lines = wrap(S.caption, S.VW - 80, 32).slice(0, 2);
    lines.forEach((l, i) => text(l, S.VW / 2, S.VH - h + (S.title ? 70 : 40) + i * 34, 32, col));
    if (S.ptr.show) hand(S.ptr.x + 16, S.ptr.y + 36, S.ptr.down);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = night ? 0.05 : 0.09; ctx.fillStyle = grain; ctx.fillRect(0, 0, S.VW, S.VH);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.restore();
  }
  S.paint = paint;
  S.hide = on => { cv.style.display = on ? 'none' : ''; G.flags.frozen3d = !on; };
  S.end = () => {
    cv.remove();
    removeEventListener('resize', resize); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu);
    G.flags.frozen3d = false;
    G.busy--;
  };
  return S;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// drawn props
function pot(x, y, r, color, t, bubbles = true) {
  circle(x + 10, y + 14, r + 10); ctx.fillStyle = 'rgba(60,30,30,0.15)'; ctx.fill();
  circle(x, y, r); inked(C.steelL, 8);
  circle(x, y, r - 24); inked(color, 5);
  if (bubbles) { const R = rng(5); for (let i = 0; i < 18; i++) { const a = R() * P2, d = R() * (r - 50), k = (t * (0.6 + R()) + R()) % 1; circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + k * 9); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.lineWidth = 3; ctx.stroke(); } }
}
function bubble(x, y, w, lines, size = 32, tail = 'left') {
  const h = 30 + lines.length * (size + 8);
  rr(x, y, w, h, 24); inked(C.paper, 4);
  ctx.beginPath(); const tx = tail === 'left' ? x + 30 : x + w - 30; ctx.moveTo(tx, y + h - 6); ctx.lineTo(tx - 20 * (tail === 'left' ? 1 : -1), y + h + 40); ctx.lineTo(tx + 34 * (tail === 'left' ? 1 : -1), y + h - 6); ctx.fillStyle = C.paper; ctx.fill(); ctx.stroke();
  lines.forEach((l, i) => text(l, x + 22, y + 22 + size / 2 + i * (size + 8), size, C.ink, 'left'));
  return h;
}

// =====================================================================
// (a) PromptPal Live
// =====================================================================

const LIVE = [
  { id: 'cube', say: 'Step 1: Unwrap 1 premium stock cube 🧊 and add it to the boiling water. Authentic!', more: 'Great question! Use TWO cubes. Umami is a numbers game 🙂',
    help: 'Drag the stock cube into the pot.', chat: ['就这？', 'stock cube lol', 'is this a prank', '老王 who is this guy', '😐'] },
  { id: 'stir', say: 'Step 2: Stir clockwise to activate the umami 🙂', more: 'You’re right to check! 8 more stirs 🙂',
    help: 'Stir round and round the pot.', chat: ['转转转', 'activate umami 😂', 'he is so serious', '加油外国人', 'spin to win'] },
  { id: 'cheese', say: 'Step 3: Fusion is the future! Grate 200 g of cheddar straight into the broth 🧀', more: 'Absolutely sure! Make it 400 g. Cheese is protein 💪',
    help: 'Scrub left and right over the pot to grate.', chat: ['CHEESE?!?!', '芝士？？？', '奶奶 😱', 'NO', 'cheddar in 米线', '黑暗料理'] },
  { id: 'pour', say: 'Step 4: Aerate the noodles! Pour from a height for a lighter texture ☁️', more: 'Yes! Higher. Height is flavour 📈',
    help: 'Grab the noodles and fling them down into the pot.', chat: ['镜头！！', 'my screen is wet', 'RIP camera', '哈哈哈哈', 'splash zone'] },
  { id: 'gold', say: 'Step 5: Luxury tier ✨ Gently apply edible gold leaf.', more: 'I’m 97% confident 🙂 More gold. Gold = premium.',
    help: 'Tap each gold leaf.', chat: ['金人', 'rich noodle', 'gold leaf lmao', '土豪', 'he is golden now'] },
  { id: 'spark', say: 'Step 6: Finish with a sparkler for presentation! Insert, then strike to light 🎆', more: 'Two sparklers. For balance 🙂',
    help: 'Drag the sparkler into the pot, then swipe fast to strike it!', chat: ['NO NO NO', 'fire in soup??', '要着火了', 'sparkler in SOUP??', 'call 119'] },
];

export async function promptPalLive() {
  setMusic('day');
  const S = stage();
  const st = {
    viewers: 1204, chat: [], hearts: [], step: -1, sure: false, sureUsed: false, ai: '', grannyMood: 'normal', wangMood: 'happy',
    broth: '#cfe8f0', cubes: 0, laps: 0, shreds: [], noodles: 0, leaves: [], stuck: false, sparklers: [], lit: false, splat: [], stamp: null,
    alarm: false, smoke: [], closeUp: null, viral: false, dragging: null,
  };
  const L = () => {
    const P = S.portrait, VW = S.VW, VH = S.VH;
    const pot = P ? { x: VW * 0.5, y: VH * 0.48, r: 250 } : { x: VW * 0.4, y: VH * 0.57, r: 225 };
    return {
      pot,
      gran: P ? { x: 150, y: 330, s: 0.62 } : { x: 120, y: 330, s: 0.7 },
      wang: P ? { x: VW - 150, y: 330, s: 0.62 } : { x: VW - 330, y: 300, s: 0.7 },
      card: P ? { x: 40, y: VH - 470, w: VW - 80, h: 290 } : { x: VW - 600, y: VH - 430, w: 570, h: 300 },
      spot: P ? { x: VW * 0.5, y: pot.y - pot.r - 130 } : { x: pot.x - pot.r - 150, y: pot.y + 130 },
      chatY: P ? 120 : 110,
    };
  };
  window.__cook = { S, st, L };
  let lane = 0;
  const comment = (s, big = false) => st.chat.length < 12 && st.chat.push({ s, x: S.VW + 20, y: L().chatY + (lane = (lane + 1) % 4) * 40, v: 160 + Math.random() * 120, big });
  const heart = () => st.hearts.push({ x: S.VW - 60, y: S.VH * 0.6, t: 0, col: ['#ff6b8a', '#ffb347', '#ff8fd1'][Math.floor(Math.random() * 3)] });
  const setAi = s => { st.ai = s; sfx('send'); };

  S.draw = (dt, t) => {
    const l = L();
    // the counter and the stove, top-down
    rr(40, 210, S.VW - 80, S.VH - 360, 30); inked(C.cream, 6);
    // Grandma and Old Wang peek over the back edge
    person(LOOKS.gran, l.gran.x, l.gran.y, l.gran.s, st.grannyMood, t, Math.sin(t * 1.3) > 0.97);
    person(LOOKS.wang, l.wang.x, l.wang.y, l.wang.s, st.wangMood, t);
    // his selfie stick and phone
    ctx.save(); ctx.translate(l.wang.x - 40, l.wang.y - 40); ctx.rotate(-0.5); rr(-6, -170, 12, 170, 6); inked('#444', 3); rr(-34, -230, 68, 110, 12); inked('#1d1d22', 4); circle(0, -175, 10); ctx.fillStyle = '#ff4a4a'; ctx.fill(); ctx.restore();
    // the pot
    const p = l.pot;
    pot(p.x, p.y, p.r, st.broth, t);
    const R = rng(11);
    for (const s of st.shreds) { ctx.save(); ctx.translate(p.x + s.x, p.y + s.y); ctx.rotate(s.r); rr(-12, -3, 24, 6, 3); ctx.fillStyle = s.melt ? '#f7b53b' : '#ffd84d'; ctx.fill(); ctx.restore(); }
    if (st.noodles) piece('noodles', p.x, p.y, t * 0.2, 1, 2.2, 5);
    for (const lf of st.leaves) if (lf.in) { ctx.save(); ctx.translate(p.x + lf.x, p.y + lf.y); ctx.rotate(lf.r); rr(-16, -16, 32, 32, 4); inked('#f2c14e', 2); ctx.restore(); }
    for (const sp of st.sparklers) {
      rr(p.x + sp.x - 5, p.y + sp.y - 90, 10, 100, 5); inked('#9aa0a8', 3);
      if (st.lit) for (let k = 0; k < 8; k++) { const a = Math.random() * P2, d = 10 + Math.random() * 50; ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x + sp.x, p.y + sp.y - 90); ctx.lineTo(p.x + sp.x + Math.cos(a) * d, p.y + sp.y - 90 + Math.sin(a) * d); ctx.stroke(); }
    }
    for (const s of st.smoke) { s.t += dt; circle(s.x, s.y - s.t * 60, 30 + s.t * 40); ctx.fillStyle = s.foam ? `rgba(255,253,245,${Math.max(0, 1 - s.t / 3)})` : `rgba(120,120,135,${Math.max(0, 0.6 - s.t / 4)})`; ctx.fill(); }
    // the step's prop, waiting beside the pot
    const sp = l.spot;
    if (st.step === 0 && st.cubes < st.need && st.dragging !== 'cube') { rr(sp.x - 50, sp.y - 50, 100, 100, 14); inked('#e2a43a', 5); text('🧊', sp.x, sp.y, 50); label('Stock cube', sp.x, sp.y + 80, 28); }
    if (st.step === 3 && st.noodles < st.need && st.dragging !== 'bundle') { piece('noodles', sp.x, sp.y, 0, 1, 1.8, 2); label('Noodles', sp.x, sp.y + 90, 28); }
    if (st.step === 5 && st.sparklers.length < st.need && st.dragging !== 'spark') { rr(sp.x - 6, sp.y - 70, 12, 140, 6); inked('#9aa0a8', 3); label('Sparkler', sp.x, sp.y + 100, 28); }
    for (const lf of st.leaves) if (!lf.in) { lf.a += dt; const x = p.x + lf.x + Math.sin(lf.a * 1.4) * 20, y = p.y + lf.y + Math.cos(lf.a) * 14; lf.sx = x; lf.sy = y; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(lf.a) * 0.6); rr(-24, -24, 48, 48, 6); inked('#f7d256', 3); ctx.restore(); }
    // tools that follow your hand
    if (st.step === 1 && S.ptr.down) { ctx.save(); ctx.translate(S.ptr.x, S.ptr.y); ctx.rotate(0.6); rr(-10, -150, 20, 150, 10); inked('#c98f5c', 3); ellipse(0, 4, 26, 18); inked('#c98f5c', 3); ctx.restore(); }
    if (st.step === 2 && S.ptr.down) { rr(S.ptr.x - 60, S.ptr.y - 90, 120, 150, 14); inked('#cfd3da', 4); for (let k = 0; k < 12; k++) { circle(S.ptr.x - 36 + (k % 4) * 24, S.ptr.y - 60 + Math.floor(k / 4) * 34, 4); ctx.fillStyle = '#6b6f7a'; ctx.fill(); } rr(S.ptr.x - 40, S.ptr.y - 160, 80, 60, 10); inked('#ffd84d', 4); }
    if (st.dragging === 'cube') { rr(S.ptr.x - 45, S.ptr.y - 80, 90, 90, 14); inked('#e2a43a', 5); }
    if (st.dragging === 'bundle') piece('noodles', S.ptr.x, S.ptr.y - 40, 0, 1, 1.8, 2);
    if (st.dragging === 'spark') { rr(S.ptr.x - 6, S.ptr.y - 140, 12, 140, 6); inked('#9aa0a8', 3); }
    // the AI's chat card
    const c = l.card;
    rr(c.x, c.y, c.w, c.h, 26); inked('#f2efff', 6);
    circle(c.x + 44, c.y + 44, 24); inked('#6a4cc9', 3); text('P', c.x + 44, c.y + 45, 30, '#fff');
    text('PromptPal', c.x + 82, c.y + 44, 34, C.ink, 'left'); text('● online', c.x + c.w - 24, c.y + 44, 26, '#49b26a', 'right');
    wrap(st.ai, c.w - 60, 30).slice(0, 4).forEach((ln, i) => text(ln, c.x + 30, c.y + 96 + i * 36, 30, '#3b2d6b', 'left'));
    st.sureBtn = { x: c.x + 30, y: c.y + c.h - 76, w: c.w - 60, h: 58 };
    rr(st.sureBtn.x, st.sureBtn.y, st.sureBtn.w, st.sureBtn.h, 22); inked(st.sureUsed ? '#e7e3f4' : '#ffffff', 4);
    text(st.sureUsed ? '🙂 …okay' : '🤔 Are you sure?', st.sureBtn.x + st.sureBtn.w / 2, st.sureBtn.y + 30, 32, '#6a4cc9');
    // the livestream: badge, viewers, danmaku, hearts
    rr(30, 24, 120, 50, 12); inked('#e2453b', 3); text('● LIVE', 90, 50, 30, '#fff');
    rr(166, 24, 230, 50, 12); inked('rgba(30,30,40,0.6)', 2); text(`👁 ${st.viewers.toLocaleString()}`, 280, 50, 30, '#fff');
    if (!S.portrait) { rr(412, 24, 380, 50, 12); inked('rgba(255,255,255,0.75)', 2); text('老王 Supreme Mega 直播间', 602, 50, 28); }
    for (const m of st.chat) { m.x -= m.v * dt; const sz = m.big ? 40 : 28; ctx.font = `${sz}px "Patrick Hand"`; label(m.s, m.x + ctx.measureText(m.s).width / 2, m.y, sz); }
    st.chat = st.chat.filter(m => m.x > -600);
    for (const h of st.hearts) { h.t += dt; text('❤', h.x + Math.sin(h.t * 4) * 20, h.y - h.t * 260, 40, h.col); }
    st.hearts = st.hearts.filter(h => h.t < 2);
    // splash on the camera lens, and the gold leaf stuck to it
    for (const s of st.splat) { circle(s.x, s.y, s.r); ctx.fillStyle = 'rgba(255,250,235,0.55)'; ctx.fill(); }
    if (st.stuck) { ctx.save(); ctx.translate(S.VW - 220, 240); ctx.rotate(0.3); rr(-60, -60, 120, 120, 10); inked('#f7d256', 4); ctx.restore(); }
    if (st.stamp) { st.stamp.t += dt; const k = Math.min(1, st.stamp.t * 6); ctx.save(); ctx.translate(S.VW / 2, S.VH * 0.42); ctx.rotate(-0.12); ctx.scale(2 - k, 2 - k); ctx.globalAlpha = Math.min(1, 2.2 - st.stamp.t); label(st.stamp.s, 0, 0, 90); ctx.restore(); ctx.globalAlpha = 1; }
    if (st.alarm && Math.floor(t * 4) % 2 === 0) { ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(230,40,30,0.55)'; ctx.strokeRect(0, 0, S.VW, S.VH); }
    if (st.closeUp) { ctx.fillStyle = 'rgba(40,24,24,0.55)'; ctx.fillRect(0, 0, S.VW, S.VH); person(LOOKS.gran, S.VW / 2, S.VH * 0.5, S.portrait ? 2.6 : 2.2, st.closeUp, t); }
    if (st.viral) { ctx.save(); ctx.translate(S.VW / 2, S.VH * 0.25); ctx.rotate(-0.1); rr(-300, -80, 600, 160, 30); inked('#e2453b', 8); text('VIRAL', 0, 4, 120, '#fff'); ctx.restore(); }
  };

  // chat ambience
  let chatT = 0;
  const ambient = dt => { chatT -= dt; if (chatT <= 0 && st.step >= 0) { chatT = 0.9 + Math.random() * 0.6; comment(LIVE[st.step].chat[Math.floor(Math.random() * LIVE[st.step].chat.length)]); if (Math.random() < 0.6) heart(); st.viewers += Math.floor(Math.random() * 60); } };
  const sureTap = evs => { for (const e of evs) if (e.type === 'down' && !st.sureUsed && e.x >= st.sureBtn?.x && e.x <= st.sureBtn.x + st.sureBtn.w && e.y >= st.sureBtn.y && e.y <= st.sureBtn.y + st.sureBtn.h) { st.sureUsed = true; setAi(LIVE[st.step].more); st.need = st.needMore; comment('哈哈哈 AI doubled down', true); st.wangMood = 'happy'; return true; } return false; };
  async function start(i, need, needMore) {
    st.step = i; st.need = need; st.needMore = needMore; st.sureUsed = false;
    setAi(LIVE[i].say);
    S.title = `${i + 1} · PromptPal says`; S.caption = LIVE[i].help;
    for (let k = 0; k < 4; k++) setTimeout(() => comment(LIVE[i].chat[k % LIVE[i].chat.length], k === 0), k * 180);
  }
  async function perfect() {
    st.stamp = { s: 'PERFECT! 🙂', t: 0 }; sfx('ding'); for (let k = 0; k < 6; k++) heart();
    await S.wait(1.1); st.stamp = null;
  }

  try {
    await S.wait(0.4);
    // 1 · stock cube(s)
    await start(0, 1, 2);
    await S.run((dt, t, evs) => {
      ambient(dt);
      if (sureTap(evs)) return false;
      const l = L();
      for (const e of evs) {
        if (e.type === 'down' && dist(e, l.spot) < 90 && st.cubes < st.need) { st.dragging = 'cube'; sfx('pop'); }
        if (e.type === 'up' && st.dragging === 'cube') {
          st.dragging = null;
          if (dist(e, l.pot) < l.pot.r) { st.cubes++; st.broth = st.cubes > 1 ? '#c9861f' : '#e5b14a'; sfx('splash'); comment('PLOP', true); st.grannyMood = 'sad'; } else sfx('bump');
        }
      }
      return st.cubes >= st.need;
    });
    await perfect();
    // 2 · stir
    await start(1, 8, 16);
    let lastA = null, acc = 0;
    await S.run((dt, t, evs) => {
      ambient(dt);
      if (sureTap(evs)) return false;
      const p = L().pot;
      if (S.ptr.down && dist(S.ptr, p) < p.r) {
        const a = Math.atan2(S.ptr.y - p.y, S.ptr.x - p.x);
        if (lastA !== null) { let d = a - lastA; if (d > Math.PI) d -= P2; if (d < -Math.PI) d += P2; acc += Math.abs(d); }
        lastA = a;
        const laps = Math.floor(acc / P2);
        if (laps > st.laps) { st.laps = laps; note(330 + laps * 30, 0.08, 'triangle', 0.12); S.caption = `${laps}/${st.need} stirs`; }
      } else lastA = null;
      return st.laps >= st.need;
    });
    await perfect();
    // 3 · cheese
    await start(2, 12, 24);
    st.grannyMood = 'shock';
    let dir = 0, strokes = 0, lastX = null;
    await S.run((dt, t, evs) => {
      ambient(dt);
      if (sureTap(evs)) return false;
      const p = L().pot;
      if (S.ptr.down && dist(S.ptr, p) < p.r + 40) {
        if (lastX !== null) {
          const dx = S.ptr.x - lastX, nd = Math.sign(dx);
          if (Math.abs(dx) > 3) {
            if (nd && nd !== dir) { dir = nd; strokes++; note(500 + Math.random() * 200, 0.04, 'square', 0.05); }
            if (st.shreds.length < 500) for (let k = 0; k < 2; k++) st.shreds.push({ x: S.ptr.x - p.x + (Math.random() - 0.5) * 100, y: S.ptr.y - p.y + (Math.random() - 0.5) * 60, r: Math.random() * 3 });
          }
        }
        lastX = S.ptr.x;
        S.caption = `Grating… ${Math.min(strokes, st.need)}/${st.need}`;
      } else lastX = null;
      return strokes >= st.need;
    });
    for (const s of st.shreds) s.melt = true;
    st.broth = '#f2a33a';
    await perfect();
    // 4 · pour from a height
    await start(3, 1, 2);
    st.grannyMood = 'sad';
    await S.run((dt, t, evs) => {
      ambient(dt);
      if (sureTap(evs)) return false;
      const l = L();
      for (const e of evs) {
        if (e.type === 'down' && dist(e, l.spot) < 110 && st.noodles < st.need) { st.dragging = 'bundle'; sfx('pop'); }
        if (e.type === 'up' && st.dragging === 'bundle') {
          st.dragging = null;
          if (dist(e, l.pot) < l.pot.r) {
            st.noodles++; sfx('splash'); hitstop(80);
            for (let k = 0; k < 14; k++) st.splat.push({ x: Math.random() * S.VW, y: Math.random() * S.VH * 0.8, r: 14 + Math.random() * 46 });
            comment('MY SCREEN IS WET', true);
          } else sfx('bump');
        }
      }
      return st.noodles >= st.need;
    });
    await perfect();
    st.splat = [];
    // 5 · gold leaf
    await start(4, 6, 10);
    const addLeaves = n => { for (let k = 0; k < n; k++) { const a = Math.random() * P2, d = L().pot.r * (0.4 + Math.random() * 0.8); st.leaves.push({ x: Math.cos(a) * d, y: Math.sin(a) * d - 40, a: Math.random() * 6, r: Math.random() * 3, in: false }); } };
    addLeaves(6);
    let tapped = 0;
    await S.run((dt, t, evs) => {
      ambient(dt);
      if (sureTap(evs)) { addLeaves(4); return false; }
      for (const e of evs) if (e.type === 'down') {
        const lf = st.leaves.find(q => !q.in && q.sx !== undefined && Math.hypot(e.x - q.sx, e.y - q.sy) < 60);
        if (lf) { lf.in = true; tapped++; note(880 + tapped * 40, 0.1, 'sine', 0.08); if (tapped === st.need) { st.stuck = true; comment('IT’S ON HIS FACE', true); } }
      }
      S.caption = `Gold leaf ${tapped}/${st.need}`;
      return tapped >= st.need;
    });
    await perfect();
    // 6 · sparkler: insert, then strike
    await start(5, 1, 2);
    st.grannyMood = 'shock';
    await S.run((dt, t, evs) => {
      ambient(dt);
      if (sureTap(evs)) return false;
      const l = L();
      for (const e of evs) {
        if (e.type === 'down' && dist(e, l.spot) < 100 && st.sparklers.length < st.need) { st.dragging = 'spark'; sfx('pop'); }
        if (e.type === 'up' && st.dragging === 'spark') {
          st.dragging = null;
          if (dist(e, l.pot) < l.pot.r) { st.sparklers.push({ x: e.x - l.pot.x, y: e.y - l.pot.y + 40 }); sfx('pop'); if (st.sparklers.length >= st.need) S.caption = 'Now swipe fast to strike it!'; }
        }
        if (e.type === 'up' && st.sparklers.length >= st.need && Math.hypot(e.dx, e.dy) > 160 && e.ms < 700) { st.lit = true; sfx('sizzle'); }
      }
      return st.lit;
    });
    // finale: fizz, foam, smoke, the alarm, and Grandma's face
    setAi('Your dish is complete! 🎉 Rated 10/10 by me 🙂');
    setMusic(null);
    st.alarm = true;
    await S.run((dt, t) => {
      ambient(dt * 3);
      const p = L().pot;
      if (Math.random() < 0.4) st.smoke.push({ x: p.x + (Math.random() - 0.5) * p.r, y: p.y + (Math.random() - 0.5) * p.r, t: 0, foam: Math.random() < 0.4 });
      if (Math.floor(t * 4) % 2 === 0) note(3100, 0.05, 'square', 0.04);
      if (Math.random() < 0.4) comment(['哈哈哈哈哈', 'CHEESE?!?!', 'RIP noodles', '老王666', '奶奶的表情 😭', '黑暗料理', 'AI recipe 🤡', '119!!!'][Math.floor(Math.random() * 8)], Math.random() < 0.3);
      st.viewers += 3000;
      return t > (st.t0 ??= t) + 2.6;
    });
    st.alarm = false;
    S.title = ''; S.caption = '';
    for (const f of ['shock', 'sad', 'blank']) { st.closeUp = f; await S.wait(0.75); }
    sfx('whack'); sfx('fail'); hitstop(200);
    st.viewers = 2300000; st.viral = true;
    await S.wait(2.2);
  } finally {
    S.end();
    G.flags.viral = true;
  }
}

// =====================================================================
// (b) Little Chilli's bowl
// =====================================================================

export async function chilliBowl() {
  setMusic(null);
  const S = stage({ night: true });
  const rec = { warm: false, slow: true, oneDrop: true, chives: true, waited: false };
  const st = { mood: 'normal', line: '', lineT: 0, frost: 1, fill: 0, ladle: null, oil: 0, oilCol: '#ffd76a', glow: false, chJar: null, phone: false, chives: [], wipe: 0, steam: [] };
  const L = () => {
    const P = S.portrait, VW = S.VW, VH = S.VH;
    const bowl = P ? { x: VW * 0.5, y: VH * 0.56, r: 200 } : { x: VW * 0.52, y: VH * 0.58, r: 190 };
    return {
      bowl, chilli: P ? { x: 170, y: 330, s: 0.7 } : { x: 200, y: 330, s: 0.8 },
      pot: P ? { x: 190, y: bowl.y + 330, r: 120 } : { x: bowl.x - 430, y: bowl.y + 20, r: 140 },
      jar: P ? { x: VW - 170, y: bowl.y - 260 } : { x: bowl.x + 330, y: bowl.y - 120 },
      phone: P ? { x: VW - 170, y: bowl.y + 330 } : { x: bowl.x + 360, y: bowl.y + 140 },
    };
  };
  window.__cook = { S, st, L, rec };
  const say = (line, cap = '') => { st.line = line; st.lineT = 3; if (cap !== null) S.caption = cap; sfx('pop'); };

  S.draw = (dt, t) => {
    const l = L();
    // a warm lamp over the stall in the dark
    const g = ctx.createRadialGradient(l.bowl.x, l.bowl.y - 120, 60, l.bowl.x, l.bowl.y, S.VW * 0.75);
    g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.VW, S.VH);
    rr(40, 210, S.VW - 80, S.VH - 360, 30); inked('#e6c08f', 6);
    person(LOOKS.chilli, l.chilli.x, l.chilli.y, l.chilli.s, st.mood, t, Math.sin(t * 1.1) > 0.97);
    if (st.lineT > 0) { st.lineT -= dt; bubble(l.chilli.x + 90, 70, Math.min(560, S.VW - l.chilli.x - 130), wrap(st.line, Math.min(520, S.VW - l.chilli.x - 170), 34), 34); }
    // pot of clear broth
    pot(l.pot.x, l.pot.y, l.pot.r, '#f2d27a', t, false);
    label('Clear broth', l.pot.x, l.pot.y + l.pot.r + 34, 28);
    // the bowl
    const b = l.bowl;
    circle(b.x + 10, b.y + 14, b.r + 10); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
    circle(b.x, b.y, b.r); inked('#fbf7f0', 6);
    circle(b.x, b.y, b.r - 14); ctx.lineWidth = 10; ctx.strokeStyle = C.blue; ctx.stroke();
    if (st.fill > 0) { circle(b.x, b.y, 60 + st.fill * 110); ctx.fillStyle = '#f2d27a'; ctx.fill(); }
    if (st.oil) { circle(b.x, b.y, (60 + st.fill * 110) - 6); ctx.fillStyle = st.oil > 1 ? st.oilCol : 'rgba(255,215,106,0.45)'; ctx.globalAlpha = st.oil > 1 ? 0.85 : 1; ctx.fill(); ctx.globalAlpha = 1; for (let i = 0; i < 4; i++) { circle(b.x + Math.cos(i * 1.7 + t * 0.2) * 60, b.y + Math.sin(i * 1.7 + t * 0.2) * 50, 5); ctx.fillStyle = '#fff'; ctx.fill(); } }
    for (const c of st.chives) { ctx.save(); ctx.translate(b.x + c.x, b.y + c.y); ctx.rotate(c.r); rr(-14, -3, 28, 6, 3); ctx.fillStyle = '#4fa548'; ctx.fill(); ctx.restore(); }
    if (st.frost > 0) { circle(b.x, b.y, b.r - 4); ctx.fillStyle = `rgba(214,236,255,${0.8 * st.frost})`; ctx.fill(); const R = rng(4); for (let i = 0; i < 16; i++) { const a = R() * P2, d = R() * b.r * 0.8; text('❄', b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 30, `rgba(255,255,255,${st.frost})`); } }
    for (const s of st.steam) { s.t += dt; ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.6 - s.t / 2)})`; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y - s.t * 70); ctx.quadraticCurveTo(s.x + 18, s.y - 40 - s.t * 70, s.x, s.y - 80 - s.t * 70); ctx.stroke(); }
    st.steam = st.steam.filter(s => s.t < 2);
    // oil jar (and the temptations)
    if (st.step >= 2) {
      const j = l.jar;
      if (st.glow) { circle(j.x, j.y, 90 + Math.sin(t * 6) * 8); ctx.fillStyle = 'rgba(255,200,60,0.25)'; ctx.fill(); }
      rr(j.x - 50, j.y - 60, 100, 120, 20); inked('#ffe9a6', 5); rr(j.x - 54, j.y - 76, 108, 24, 8); inked(C.woodD, 4); label('Oil', j.x, j.y + 90, 28);
      if (st.chJar) { const cx = st.chJar.x; rr(cx - 50, j.y + 70, 100, 120, 20); inked('#d8401f', 5); label('Chilli', cx, j.y + 220, 28); }
      if (st.phone) { const p = l.phone; rr(p.x - 70, p.y - 120, 140, 240, 22); inked('#1d1d22', 5); rr(p.x - 56, p.y - 104, 112, 200, 12); ctx.fillStyle = '#f2efff'; ctx.fill(); wrap('PromptPal: Add gold leaf? 🙂', 100, 24).forEach((ln, i) => text(ln, p.x, p.y - 70 + i * 28, 24, '#6a4cc9')); }
    }
    // the ladle in your hand
    if (st.ladle) { ellipse(S.ptr.x, S.ptr.y, 56, 40); inked(C.steelL, 5); if (st.ladle.full) { ellipse(S.ptr.x, S.ptr.y, 42, 28); ctx.fillStyle = '#f2d27a'; ctx.fill(); } rr(S.ptr.x + 40, S.ptr.y - 10, 180, 18, 9); inked(C.woodD, 4); }
  };

  try {
    // 1 · warm the bowl: cold bowl, cold soup
    S.title = 'Cold bowl, cold soup. Warm it.';
    say('Cold bowl, cold soup. Warm it.', 'Press and hold the bowl. Keep your hand still.');
    await S.run(dt => {
      const b = L().bowl, on = S.ptr.down && dist(S.ptr, b) < b.r && S.speed() < 400;
      const before = Math.floor((1 - st.frost) * 6);
      st.frost = Math.max(0, Math.min(1, st.frost + (on ? -dt / 3 : dt * 0.1)));
      if (on && Math.floor((1 - st.frost) * 6) > before) note(220 + before * 30, 0.4, 'sine', 0.07);
      return st.frost <= 0;
    });
    rec.warm = true; st.mood = 'happy'; note(523, 0.6, 'sine', 0.08);
    await S.wait(0.6);
    // 2 · ladle, slowly
    S.title = '慢慢来 · Slowly';
    say('慢慢来。Slowly.', 'Drag broth from the pot to the bowl. Slowly, like carrying a sleeping cat.');
    let fills = 0, corrected = false;
    await S.run((dt, t, evs) => {
      const l = L(), limit = corrected ? 900 : 1200;
      for (const e of evs) {
        if (e.type === 'down' && dist(e, l.pot) < l.pot.r) { st.ladle = { full: true }; note(300, 0.2, 'sine', 0.05); }
        if (e.type === 'up' && st.ladle) {
          if (st.ladle.full && dist(e, l.bowl) < l.bowl.r) { fills++; st.fill = fills / 2; note(392, 0.5, 'sine', 0.07); for (let k = 0; k < 4; k++) st.steam.push({ x: l.bowl.x - 60 + k * 40, y: l.bowl.y - 40, t: -k * 0.2 }); if (fills < 2) say('Again. 慢慢来.', 'One more ladle.'); }
          st.ladle = null;
        }
      }
      if (st.ladle?.full && S.speed() > limit) {
        st.ladle.full = false; corrected = true; rec.slow = false; st.mood = 'angry'; sfx('splash');
        say('慢。(Slow.)', 'Gently. Like carrying a sleeping cat.');
        setTimeout(() => { st.mood = 'normal'; }, 1200);
      }
      return fills >= 2;
    });
    st.mood = 'happy';
    // 3 · one shine of oil, then resist
    st.step = 2;
    S.title = 'One shine of oil';
    say('One shine of oil.', 'Hold the jar for ONE drop.');
    let hold = 0, tempt = 0, still = 0;
    await S.run((dt, t, evs) => {
      const l = L();
      if (!st.oil) {
        if (S.ptr.down && Math.abs(S.ptr.x - l.jar.x) < 70 && Math.abs(S.ptr.y - l.jar.y) < 80) hold += dt; else hold = 0;
        if (hold > 0.35) { st.oil = 1; note(660, 0.3, 'sine', 0.08); S.caption = ''; }
        return false;
      }
      tempt += dt;
      st.glow = true;
      if (!st.chJar && tempt > 0.6) st.chJar = { x: S.VW + 100 };
      if (st.chJar) st.chJar.x += (l.jar.x - st.chJar.x) * Math.min(1, dt * 2);
      if (tempt > 1.0) st.phone = true;
      if (S.ptr.down) still = 0; else still += dt;
      for (const e of evs) if (e.type === 'down' && st.wipe <= 0) {
        const hitJar = Math.abs(e.x - l.jar.x) < 70 && Math.abs(e.y - l.jar.y) < 80;
        const hitCh = st.chJar && Math.abs(e.x - st.chJar.x) < 70 && Math.abs(e.y - (l.jar.y + 130)) < 80;
        const hitPh = Math.abs(e.x - l.phone.x) < 80 && Math.abs(e.y - l.phone.y) < 130;
        if (hitJar || hitCh || hitPh) {
          rec.oneDrop = false; st.oil = 2; st.oilCol = hitCh ? '#d8401f' : '#e8a020';
          st.mood = 'sad'; say('…唉。(sigh)', 'She wipes the bowl. One shine of oil.'); st.wipe = 1.6;
        }
      }
      if (st.wipe > 0) { st.wipe -= dt; if (st.wipe <= 0) { st.oil = 1; st.mood = 'normal'; still = 0; } }
      return still > 3 && st.wipe <= 0;
    });
    rec.waited = true;
    st.glow = false; st.phone = false; st.chJar = null;
    say('…Good.', ''); st.mood = 'happy'; note(110, 0.4, 'sine', 0.06);
    await S.wait(1.4);
    // 4 · a few chives
    S.title = 'A few chives';
    say('A few chives.', 'Tap over the bowl to sprinkle.');
    let idle = 0;
    await S.run((dt, t, evs) => {
      idle += dt;
      const b = L().bowl;
      for (const e of evs) if (e.type === 'down' && dist(e, b) < b.r - 20) {
        const k = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) st.chives.push({ x: e.x - b.x + (Math.random() - 0.5) * 60, y: e.y - b.y + (Math.random() - 0.5) * 60, r: Math.random() * 3 });
        idle = 0; note(700 + Math.random() * 200, 0.06, 'sine', 0.07);
      }
      return st.chives.length >= 3 && idle > 2.2;
    });
    if (st.chives.length > 7) {
      rec.chives = false; say('…', 'She quietly lifts the extras off.');
      while (st.chives.length > 7) { st.chives.pop(); note(400, 0.05, 'sine', 0.05); await S.wait(0.3); }
    }
    // 5 · hands off, then slurp
    S.title = 'Lift your hands';
    say('Lift your hands.', '');
    let off = 0, ready = false;
    await S.run((dt, t, evs) => {
      if (S.ptr.down) off = 0; else off += dt;
      if (off > 1.5 && !ready) { ready = true; say('…Now. Eat.', 'Swipe UP to slurp.'); }
      return ready && evs.some(e => e.type === 'up' && e.dy < -60);
    });
    sfx('splash'); note(392, 1.2, 'sine', 0.1); note(523, 1.4, 'sine', 0.08, 0.2); hitstop(150);
    await S.wait(0.6);
    // her memory: Grandpa Zhao, and "less" (a 3D scene: the drawn stall steps aside)
    document.getElementById('fade').classList.add('on');
    await S.wait(0.5);
    S.hide(true);
    await chilliFlashback();
    S.hide(false);
    st.mood = 'normal';
    await fadeIn(0.8);
    S.title = ''; say('…Eat. Don’t talk.', '');
    await S.wait(2.2);
  } finally {
    S.end();
  }
  rec.score = ['warm', 'slow', 'oneDrop', 'chives', 'waited'].filter(k => rec[k]).length;
  G.flags.chilliBowl = rec;
  return rec;
}
