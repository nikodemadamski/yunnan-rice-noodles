// Phone / laptop screens: the Dublin prologue chat, the boss chat (name
// entry), the in-flight "perfect recipe", and the Little Yellow Duck app.

import { G, esc, wait, addTicker } from './core.js';
import { openPanel, closePanel } from './ui.js';
import { sfx } from './audio.js';
import { takeAction, clearAction } from './input.js';

function screen(title, cls = '', bar = '#ffffff') {
  const p = openPanel(`
    <div class="phone"><div class="phone-screen ${cls}">
      <div class="app-bar" style="background:${bar}">${title}</div>
      <div class="chat" id="chat"></div>
      <div class="composer" id="composer"></div>
    </div></div>`);
  return { p, chat: p.querySelector('#chat'), composer: p.querySelector('#composer') };
}

function addMsg(chat, who, html) {
  const m = document.createElement('div');
  m.className = `msg ${who}`;
  m.innerHTML = html;
  chat.appendChild(m);
  chat.scrollTop = chat.scrollHeight;
  return m;
}

// "Hacker typer": every key press or tap types a few more characters.
function typePrompt(composer, text) {
  return new Promise(res => {
    composer.innerHTML = `<div class="field hint" id="field">Press any key / tap here to type…</div><button id="send">Send</button>`;
    const field = composer.querySelector('#field');
    let n = 0, done = false;
    const advance = (k = 3) => {
      if (done) return;
      if (n >= text.length) { finish(); return; }
      n = Math.min(text.length, n + k);
      field.classList.remove('hint');
      field.textContent = text.slice(0, n);
      sfx('type');
    };
    const finish = () => {
      if (n < text.length) { n = text.length; field.textContent = text; return; }
      done = true;
      removeEventListener('keydown', onKey);
      sfx('send');
      composer.innerHTML = '';
      res();
    };
    const onKey = e => {
      if (e.repeat && e.code !== 'Space') return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { finish(); return; }
      advance();
    };
    addEventListener('keydown', onKey);
    field.addEventListener('pointerdown', () => advance(5));
    composer.querySelector('#send').addEventListener('click', finish);
    clearAction();
  });
}

const PROLOGUE = [
  { me: 'Write a Q3 synergy strategy deck for the client', ai: 'Absolutely! 🚀 Here is a 40-slide deck on *leveraging cross-functional synergy* to unlock stakeholder value…' },
  { me: 'make it more engaging. noodle themed?', ai: 'Love it!! 🍜 Slide 1: “Oodles of Synergy”. Slide 2: “Using Our Noodle”. Slide 3: “Slurping Up Market Share”…' },
  { me: 'what are cross bridge rice noodles', ai: '过桥米线 (guò qiáo mǐxiàn) from Yunnan! 🌉 Legend says a wife carried soup across a bridge to her husband every day. A layer of chicken fat kept it hot all the way.' },
  { me: 'how are they made', ai: 'Boiling broth with a layer of oil on top. Raw slices, quail egg, chives and rice noodles go in at the table. You build the bowl yourself!' },
  { me: "is Old Zhao's Cross-Bridge Noodles in Kunming still open", ai: "Found it! ⭐ 4.9 · “Best bowl of my life.” · “The old man is a legend.”\nStatus:<br><span class='closed-stamp'>PERMANENTLY CLOSED</span>" },
];

export async function prologue() {
  const s = screen('💬 PromptPal AI', '', '#efe9ff');
  addMsg(s.chat, 'sys', 'Dublin · Tuesday · 16:47 · ☔');
  for (const step of PROLOGUE) {
    await typePrompt(s.composer, step.me);
    addMsg(s.chat, 'me', esc(step.me));
    const dots = addMsg(s.chat, 'ai', '…');
    await wait(0.8);
    dots.innerHTML = step.ai.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    sfx('pop');
    s.chat.scrollTop = s.chat.scrollHeight;
    await wait(0.4);
  }
  sfx('fail');
  const phone = s.p.querySelector('.phone');
  phone.classList.add('shake');
  addMsg(s.chat, 'me', 'WHAT?!?!?!');
  await wait(1.6);
  closePanel();

  // Boss chat: emergency leave + the player's name
  const b = screen('💼 Slick · #team-growth', '', '#ffe2c6');
  addMsg(b.chat, 'boss', '<b>Boss:</b> …hey, who just shouted “WHAT” in the office');
  await wait(0.9);
  await typePrompt(b.composer, 'EMERGENCY. I need my annual leave. All of it.');
  addMsg(b.chat, 'me', 'EMERGENCY. I need my annual leave. All of it.');
  await wait(0.8);
  addMsg(b.chat, 'boss', '<b>Boss:</b> All 22 days?? 😳 …fine. You never take any. Name for the form?');
  G.name = await askName(b.composer);
  addMsg(b.chat, 'me', esc(G.name));
  await wait(0.6);
  addMsg(b.chat, 'boss', `<b>Boss:</b> Leave approved ✅ 22 days. First paycheck when you're back, ${esc(G.name)}. Don't do anything mad.`);
  await wait(1.8);
  closePanel();

  // On the plane
  const a = screen('💬 PromptPal AI', '', '#efe9ff');
  addMsg(a.chat, 'sys', '✈️ In-flight Wi-Fi · somewhere over Siberia');
  await typePrompt(a.composer, 'give me the PERFECT cross bridge noodle recipe');
  addMsg(a.chat, 'me', 'give me the PERFECT cross bridge noodle recipe');
  const d = addMsg(a.chat, 'ai', '…');
  await wait(0.9);
  d.innerHTML = 'Of course! ✨ The <b>perfect</b> recipe:<br>• 1 stock cube<br>• a generous handful of cheddar 🧀<br>• gold leaf for the “wow”<br>• a sparkler for engagement 🎆<br>Trust me 🙂';
  sfx('pop');
  await wait(0.6);
  await typePrompt(a.composer, 'perfect.');
  addMsg(a.chat, 'me', 'perfect.');
  await wait(1.2);
  closePanel();
}

function askName(composer) {
  return new Promise(res => {
    composer.innerHTML = `<input id="name-in" maxlength="14" placeholder="Your name" autocomplete="off"><button id="name-ok">OK</button>`;
    const inp = composer.querySelector('#name-in');
    setTimeout(() => inp.focus(), 50);
    const ok = () => {
      const v = inp.value.trim().replace(/[<>]/g, '');
      if (!v) { inp.focus(); return; }
      sfx('send');
      res(v);
    };
    composer.querySelector('#name-ok').addEventListener('click', ok);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}

// ---------- Little Yellow Duck ----------

export function duckSignup() {
  return new Promise(res => {
    const p = openPanel(`<div class="phone"><div class="phone-screen duck-app">
      <div class="app-bar">🦆 Little Yellow Duck · 小黄鸭</div>
      <div class="chat" style="text-align:center; align-items:center; justify-content:center">
        <div style="font-size:90px">🦆</div>
        <h2 style="margin:0">Welcome, rider ${esc(G.name)}!</h2>
        <p class="sub" style="max-width:260px">Your helmet (with bill) and e-bike are waiting outside.<br>Be fast. Be kind. Never spill. Quack.</p>
        <button class="btn-big" id="duck-go">Quack! Start riding</button>
      </div></div></div>`);
    sfx('quack');
    p.querySelector('#duck-go').addEventListener('click', () => { closePanel(); sfx('quack'); res(); });
  });
}

/** Resolves with the chosen order id, or null if closed. */
export function orderBoard(orders) {
  return new Promise(res => {
    const avg = G.stars.length ? (G.stars.reduce((a, b) => a + b, 0) / G.stars.length).toFixed(1) : '—';
    const p = openPanel(`<div class="phone"><div class="phone-screen duck-app">
      <div class="app-bar">🦆 Orders · ${esc(G.name)} · ⭐ ${avg}<span style="flex:1"></span><button class="btn-soft" id="ob-close">✕</button></div>
      <div class="chat" id="ob-list"></div></div></div>`);
    const list = p.querySelector('#ob-list');
    for (const o of orders) {
      const done = G.ordersDone.has(o.id);
      const banned = o.from && G.bans.has(o.from);
      const el = document.createElement('div');
      el.className = 'order' + (done ? ' done' : '');
      el.innerHTML = `
        <div class="top"><span>${o.ico} ${esc(o.title)}</span><span class="pay">¥${o.pay}</span></div>
        <div class="sub">${esc(o.fromName)} → ${esc(o.toName)}</div>
        <div class="tags">${o.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        ${o.note ? `<div class="note"><div class="zh">📝 ${esc(o.note.zh)}</div><div class="tr hidden"></div>
          <button class="btn-soft goggle" data-tr>👀 Goggle Translate</button></div>` : ''}
        <div class="row" style="justify-content:flex-end; margin-top:8px">
          ${done ? '<span class="sub">Delivered ✅</span>' : banned ? '<span class="sub">🚫 Banned from this restaurant</span>' : `<button class="btn-big" data-take>${o.montage ? 'Quick run ⚡' : 'Accept'}</button>`}
        </div>`;
      const tr = el.querySelector('[data-tr]');
      if (tr) tr.addEventListener('click', () => {
        const box = el.querySelector('.tr');
        box.textContent = `“${o.note.tr}”`;
        box.classList.remove('hidden');
        tr.remove();
        sfx('beep');
      });
      const take = el.querySelector('[data-take]');
      if (take) take.addEventListener('click', () => { closePanel(); sfx('quack'); res(o.id); });
      list.appendChild(el);
    }
    p.querySelector('#ob-close').addEventListener('click', () => { closePanel(); res(null); });
  });
}

export async function montage(lines, pay) {
  const p = openPanel(`<div class="card" style="text-align:center; overflow:hidden">
    <h2>⚡ Quick run</h2>
    <div style="position:relative; height:90px; margin:10px 0; background:#ece1cc; border-radius:16px; overflow:hidden">
      <div id="mt-bike" style="position:absolute; left:-80px; top:18px; font-size:52px; transition:left 2.4s linear">🛵💨</div>
    </div>
    <p id="mt-line" style="min-height:2.8em"></p>
    <h2 id="mt-pay" style="visibility:hidden">+¥${pay}</h2></div>`);
  await wait(0.1);
  p.querySelector('#mt-bike').style.left = 'calc(100% + 20px)';
  for (const ln of lines) {
    p.querySelector('#mt-line').textContent = ln;
    sfx('beep');
    await wait(0.9);
  }
  p.querySelector('#mt-pay').style.visibility = 'visible';
  sfx('coin');
  await wait(1.2);
  closePanel();
}

// A simple card with a Continue button (results, notes).
export function infoCard(html, button = 'Continue') {
  return new Promise(res => {
    const p = openPanel(`<div class="card">${html}<div class="row" style="justify-content:flex-end; margin-top:14px">
      <button class="btn-big" id="ic-ok">${esc(button)}</button></div></div>`);
    clearAction();
    let closed = false;
    const close = () => { if (closed) return; closed = true; closePanel(); res(); };
    p.querySelector('#ic-ok').addEventListener('click', close);
    let lock = 0.4;
    addTicker(dt => {
      if (closed) return true;
      lock -= dt;
      if (takeAction() && lock <= 0) { close(); return true; }
    });
  });
}
