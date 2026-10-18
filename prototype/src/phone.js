// Phone screens: the Little Yellow Duck app, the order board, montages
// and info cards. (The Dublin opening lives in opening.js.)

import { G, esc, wait, addTicker } from './core.js';
import { openPanel, closePanel, beat } from './ui.js';
import { sfx } from './audio.js';
import { takeAction, clearAction } from './input.js';

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
    let done = false;
    const go = () => { if (done) return; done = true; closePanel(); sfx('quack'); res(); };
    p.querySelector('#duck-go').addEventListener('click', go);
    beat(3).then(go);
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
