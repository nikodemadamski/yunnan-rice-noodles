// Speech bubbles, choices, emotes, barks, toasts, fades, the God of Cookery
// "food reveal" and livestream bullet comments.

import { G, addTicker, wait, esc } from './core.js';
import { takeAction, clearAction, queueAction, keyDown } from './input.js';
import { blip, sfx } from './audio.js';
import { toScreen } from './world.js';

const $ = id => document.getElementById(id);

// ---------- dialogue ----------

const dlg = $('dialogue');
dlg.addEventListener('pointerdown', () => queueAction());

// *word* → highlighted
function segments(text) {
  const out = [];
  text.split(/(\*[^*]+\*)/).forEach(part => {
    if (!part) return;
    if (part.startsWith('*') && part.endsWith('*')) out.push({ t: part.slice(1, -1), em: true });
    else out.push({ t: part, em: false });
  });
  return out;
}

function renderSegs(segs, n) {
  let html = '', left = n;
  for (const s of segs) {
    if (left <= 0) break;
    const piece = esc([...s.t].slice(0, left).join(''));
    left -= [...s.t].length;
    html += s.em ? `<span class="em">${piece}</span>` : piece;
  }
  return html;
}

/**
 * speaker: { name, color, voice, char? }
 * o: { zh, tr, face, emote, speed }
 */
export function say(sp, text, o = {}) {
  text = text.replaceAll('{name}', G.name);
  G.busy++;
  return new Promise(res => {
    dlg.classList.remove('hidden', 'done');
    const name = $('dlg-name');
    name.textContent = sp.name.replaceAll('{name}', G.name);
    name.style.background = sp.color || '#8a7562';
    $('dlg-zh').textContent = o.zh || '';
    $('dlg-tr').textContent = o.tr ? `🦆 Goggle Translate: “${o.tr}”` : '';
    if (sp.char && o.face) sp.char.setFace(o.face);
    if (sp.char && o.emote) emote(sp.char, o.emote);
    const segs = segments(text);
    const total = segs.reduce((a, s) => a + [...s.t].length, 0);
    const chars = segs.flatMap(s => [...s.t]);
    const el = $('dlg-text');
    el.innerHTML = '';
    let shown = 0, acc = 0;
    const cps = (o.speed || 1) * (keyDown('ShiftLeft') ? 90 : 32);
    clearAction();
    let talkT = 0;
    addTicker(dt => {
      if (shown < total) {
        acc += dt * cps;
        if (takeAction()) acc = total;
        let next = Math.min(total, Math.floor(acc));
        while (shown < next) {
          if (next - shown < 4) blip(chars[shown], sp.voice);
          shown++;
        }
        el.innerHTML = renderSegs(segs, shown);
        if (sp.char) { talkT += dt; sp.char.head.position.y = 2.25 + Math.abs(Math.sin(talkT * 14)) * 0.06; }
        if (shown >= total) dlg.classList.add('done');
        return false;
      }
      if (takeAction()) {
        sfx('pop');
        if (sp.char) sp.char.head.position.y = 2.25;
        G.busy--;
        res();
        return true;
      }
    });
  });
}

export function hideDialogue() { dlg.classList.add('hidden'); }

// A run of lines from one or more speakers: [[sp, text, opts], ...]
export async function talk(lines) {
  for (const [sp, text, o] of lines) await say(sp, text, o);
  hideDialogue();
}

// ---------- choices ----------

export function choose(options) {
  G.busy++;
  return new Promise(res => {
    const box = $('choices');
    box.innerHTML = '';
    box.classList.remove('hidden');
    let sel = 0;
    const btns = options.map((label, i) => {
      const b = document.createElement('button');
      b.textContent = label.replaceAll('{name}', G.name);
      b.addEventListener('pointerenter', () => { sel = i; paint(); });
      b.addEventListener('click', e => { e.stopPropagation(); finish(i); });
      box.appendChild(b);
      return b;
    });
    const paint = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
    paint();
    let lockT = 0.25;
    const onKey = e => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel + options.length - 1) % options.length; paint(); sfx('beep'); }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % options.length; paint(); sfx('beep'); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) finish(n - 1);
    };
    addEventListener('keydown', onKey);
    clearAction();
    let done = false;
    const finish = i => {
      if (done) return;
      done = true;
      removeEventListener('keydown', onKey);
      box.classList.add('hidden');
      sfx('pop');
      G.busy--;
      clearAction();
      res(i);
    };
    addTicker(dt => {
      if (done) return true;
      lockT -= dt;
      if (takeAction() && lockT <= 0) finish(sel);
    });
  });
}

// ---------- floating emotes & barks ----------

const floating = $('floating');
const floaters = [];

function addFloater(el, char, height, dur) {
  floating.appendChild(el);
  floaters.push({ el, char, height, t: dur });
}

export function emote(char, symbol, dur = 1.6) {
  const el = document.createElement('div');
  el.className = 'emote';
  el.textContent = symbol;
  addFloater(el, char, 3.9, dur);
}

export function bark(char, text, dur = 2.6) {
  for (const f of floaters) if (f.char === char && f.el.classList.contains('bark')) f.t = 0;
  const el = document.createElement('div');
  el.className = 'bark';
  el.textContent = text.replaceAll('{name}', G.name);
  addFloater(el, char, 4.4, dur);
}

export function updateFloating(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t -= dt;
    const p = f.char.root.position;
    const s = toScreen(p.x, p.y + f.height * f.char.root.scale.y, p.z);
    if (f.t <= 0 || !s) {
      if (f.t <= 0) { f.el.remove(); floaters.splice(i, 1); }
      else f.el.style.display = 'none';
      continue;
    }
    f.el.style.display = '';
    f.el.style.left = `${s.x}px`;
    f.el.style.top = `${s.y}px`;
  }
}

// ---------- prompts, toasts, objective ----------

export function showPrompt(text) {
  const p = $('prompt');
  if (!text) { p.classList.add('hidden'); return; }
  p.textContent = text;
  p.classList.remove('hidden');
}

let toastTimer = null;
export function toast(text, sec = 3.2) {
  const t = $('toast');
  t.innerHTML = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), sec * 1000);
}

export function objective(text) {
  const o = $('objective');
  if (!text) { o.classList.add('hidden'); return; }
  o.textContent = `📍 ${text}`;
  o.classList.remove('hidden');
}

// ---------- fades & chapter cards ----------

export async function fadeOut(sec = 0.6) {
  $('fade').classList.add('on');
  await wait(sec);
}

export async function fadeIn(sec = 0.6) {
  $('fade-text').innerHTML = '';
  $('fade').classList.remove('on');
  await wait(sec);
}

export async function card(title, sub = '', hold = 2) {
  await fadeOut();
  $('fade-text').innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  await wait(hold);
}

// ---------- panels ----------

export function openPanel(html) {
  G.busy++;
  const p = $('panel');
  p.innerHTML = html;
  p.classList.remove('hidden');
  return p;
}

export function closePanel() {
  const p = $('panel');
  if (p.classList.contains('hidden')) return;
  p.classList.add('hidden');
  p.innerHTML = '';
  G.busy--;
}

// ---------- the God of Cookery moment ----------

export function foodReveal(dish, head, desc, sec = 3.4) {
  G.busy++;
  const r = $('reveal');
  r.innerHTML = `<div class="rays"></div><div class="inner"><div class="dish">${dish}</div>
    <div class="head">${esc(head)}</div><div class="desc">${esc(desc)}</div></div>`;
  r.classList.remove('hidden');
  sfx('gong');
  setTimeout(() => sfx('reveal'), 500);
  return wait(sec).then(() => {
    r.classList.add('hidden');
    r.innerHTML = '';
    G.busy--;
  });
}

// ---------- livestream bullet comments ----------

export function danmaku(lines, sec = 6) {
  const box = $('danmaku');
  const badge = document.createElement('div');
  badge.className = 'live-badge';
  badge.textContent = '● LIVE  · 老王 Supreme Mega · 👀 12,408';
  box.appendChild(badge);
  lines.forEach((text, i) => {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'dm';
      d.textContent = text;
      d.style.top = `${8 + ((i * 37) % 60)}%`;
      d.style.animationDuration = `${4 + (i % 3)}s`;
      box.appendChild(d);
      setTimeout(() => d.remove(), 7000);
    }, (i * sec * 1000) / lines.length * 0.7);
  });
  setTimeout(() => badge.remove(), sec * 1000 + 1500);
}
