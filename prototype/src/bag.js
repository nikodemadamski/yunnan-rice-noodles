// Packing puzzle: a side view of the Duck delivery bag, with gravity.
// Rules: soup and tea need nothing on top; tea must stay upright;
// fragile cakes can't have anything heavy on them.

import { openPanel, closePanel } from './ui.js';
import { sfx } from './audio.js';
import { esc } from './core.js';

const COLS = 4, ROWS = 3, CELL = 58, GAP = 3, PAD = 10;

const RULE_TEXT = {
  top: 'Nothing on top',
  upright: 'Keep upright',
  fragile: 'Fragile: nothing heavy on it',
  heavy: 'Heavy',
};

export function packBag(order) {
  return new Promise(resolve => {
    const items = order.items.map((it, i) => ({ ...it, key: i, w0: it.w, h0: it.h, rotated: false, placed: null }));
    const history = [];
    let sel = 0;

    const panel = openPanel(`
      <div class="card">
        <h2>🦆 Pack the bag</h2>
        <p class="sub">Tap an item, then tap a column to drop it in. Gravity is real. ${esc(order.packHint || '')}</p>
        <div class="bag-wrap">
          <div class="bag" id="bag" style="grid-template-columns: repeat(${COLS}, ${CELL}px); position: relative;"></div>
          <div class="tray" id="tray"></div>
        </div>
        <div id="bag-warn" style="margin-top:10px"></div>
        <div class="row" style="margin-top:12px; justify-content: space-between">
          <div class="row">
            <button class="btn-soft" id="b-rot">↻ Rotate</button>
            <button class="btn-soft" id="b-undo">↶ Undo</button>
            <button class="btn-soft" id="b-reset">Reset</button>
          </div>
          <button class="btn-big" id="b-go" disabled>Ride! 🛵</button>
        </div>
      </div>`);

    const bag = panel.querySelector('#bag');
    const tray = panel.querySelector('#tray');
    const cells = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const c = document.createElement('div');
        c.className = 'cell';
        c.dataset.x = x;
        c.addEventListener('click', () => drop(x));
        c.addEventListener('pointerenter', () => hover(x));
        bag.appendChild(c);
        cells.push(c);
      }
    }
    bag.addEventListener('pointerleave', () => hover(-1));

    const occupied = (x, y, w, h, ignore) => items.some(it => it !== ignore && it.placed &&
      x < it.placed.x + it.w && x + w > it.placed.x && y < it.placed.y + it.h && y + h > it.placed.y);

    function landing(x, w, h) {
      if (x + w > COLS || h > ROWS) return -1;
      let y = ROWS - h;
      if (occupied(x, y, w, h)) return -1;
      while (y > 0 && !occupied(x, y - 1, w, h)) y--;
      return y;
    }

    function hover(x) {
      const it = items[sel];
      cells.forEach(c => c.classList.remove('col-hover'));
      if (x < 0 || !it || it.placed) return;
      const sx = Math.min(x, COLS - it.w);
      cells.forEach(c => { const cx = +c.dataset.x; if (cx >= sx && cx < sx + it.w) c.classList.add('col-hover'); });
    }

    function drop(x) {
      const it = items[sel];
      if (!it || it.placed) return;
      const sx = Math.max(0, Math.min(x, COLS - it.w));
      const y = landing(sx, it.w, it.h);
      if (y < 0) { sfx('bump'); bag.classList.remove('shake'); void bag.offsetWidth; bag.classList.add('shake'); return; }
      it.placed = { x: sx, y };
      history.push(it);
      sfx('pop');
      const next = items.findIndex(i => !i.placed);
      sel = next < 0 ? sel : next;
      render();
    }

    function violations() {
      const out = [];
      for (const p of items) {
        if (!p.placed) continue;
        const above = items.filter(q => q !== p && q.placed &&
          q.placed.x < p.placed.x + p.w && q.placed.x + q.w > p.placed.x && q.placed.y >= p.placed.y + p.h);
        const touching = above.filter(q => q.placed.y === p.placed.y + p.h);
        if (p.rules.includes('top') && above.length) out.push({ it: p, kind: 'top', msg: `${p.ico} ${p.name} has something on top. It'll spill!` });
        if (p.rules.includes('fragile') && touching.some(q => q.rules.includes('heavy'))) out.push({ it: p, kind: 'fragile', msg: `${p.ico} ${p.name} is getting crushed!` });
        if (p.rules.includes('upright') && p.rotated) out.push({ it: p, kind: 'upright', msg: `${p.ico} ${p.name} is lying on its side!` });
      }
      return out;
    }

    function render() {
      bag.querySelectorAll('.piece').forEach(e => e.remove());
      const bad = violations();
      for (const it of items) {
        if (!it.placed) continue;
        const el = document.createElement('div');
        el.className = 'piece' + (bad.some(b => b.it === it) ? ' bad' : '');
        el.style.left = `${PAD + it.placed.x * (CELL + GAP)}px`;
        el.style.top = `${PAD + (ROWS - it.placed.y - it.h) * (CELL + GAP)}px`;
        el.style.width = `${it.w * CELL + (it.w - 1) * GAP}px`;
        el.style.height = `${it.h * CELL + (it.h - 1) * GAP}px`;
        el.style.background = it.color;
        el.textContent = it.ico;
        if (it.rotated) el.style.fontSize = '26px';
        bag.appendChild(el);
      }
      tray.innerHTML = '';
      items.forEach((it, i) => {
        const b = document.createElement('button');
        b.className = 'item' + (i === sel && !it.placed ? ' sel' : '') + (it.placed ? ' used' : '');
        b.innerHTML = `<span class="ico">${it.ico}</span><span><div>${esc(it.name)} <span class="rule">${it.w}×${it.h}</span></div>
          <div class="rule">${it.rules.map(r => RULE_TEXT[r]).join(' · ') || 'No fuss'}</div></span>`;
        b.addEventListener('click', () => { if (!it.placed) { sel = i; sfx('beep'); render(); } });
        tray.appendChild(b);
      });
      const warn = panel.querySelector('#bag-warn');
      warn.innerHTML = bad.map(b => `<div class="warn">⚠️ ${esc(b.msg)}</div>`).join('');
      const all = items.every(i => i.placed);
      const go = panel.querySelector('#b-go');
      go.disabled = !all;
      go.textContent = all && bad.length ? 'Ride anyway… 😬' : 'Ride! 🛵';
      const cur = items[sel];
      panel.querySelector('#b-rot').disabled = !cur || cur.placed || !cur.rot;
    }

    panel.querySelector('#b-rot').addEventListener('click', () => {
      const it = items[sel];
      if (!it || it.placed || !it.rot) return;
      [it.w, it.h] = [it.h, it.w];
      it.rotated = !it.rotated;
      sfx('beep');
      render();
    });
    panel.querySelector('#b-undo').addEventListener('click', () => {
      const it = history.pop();
      if (!it) return;
      it.placed = null;
      sel = it.key;
      render();
    });
    panel.querySelector('#b-reset').addEventListener('click', () => {
      for (const it of items) { it.placed = null; it.w = it.w0; it.h = it.h0; it.rotated = false; }
      history.length = 0;
      sel = 0;
      render();
    });
    panel.querySelector('#b-go').addEventListener('click', () => {
      const bad = violations();
      let spill = 0, quality = 1;
      for (const b of bad) {
        if (b.kind === 'top') spill += 20;
        if (b.kind === 'upright') spill += 25;
        if (b.kind === 'fragile') quality *= 0.7;
      }
      sfx(bad.length ? 'gasp' : 'quack');
      closePanel();
      resolve({ spill, quality, problems: bad.map(b => b.msg), perfect: bad.length === 0 });
    });

    render();
  });
}
