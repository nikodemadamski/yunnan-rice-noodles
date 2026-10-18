// Old Zhao's noodle shop, Papa's-style: an order counter, two noodle baskets
// on timer rings that keep cooking while you work elsewhere, and a build
// station where each bowl crosses the bridge in the right order.
// All rules live in shopcore.js; this file only draws and forwards clicks.

import { addTicker, esc } from './core.js';
import { openPanel, closePanel } from './ui.js';
import { sfx } from './audio.js';
import { BROTHS, PARTS, MENU, GUESTS, DAY1 } from './shopdata.js';
import * as core from './shopcore.js';

const C = 2 * Math.PI * 18;   // ring circumference (r = 18)

function ringSVG(id, zone) {
  const z = zone
    ? `<circle cx="22" cy="22" r="18" class="r-zone" stroke-dasharray="${C * (zone.hi - zone.lo)} ${C}" transform="rotate(${-90 + zone.lo * 360} 22 22)"/>`
    : '';
  return `<svg viewBox="0 0 44 44" class="ring" data-ring="${id}">
    <circle cx="22" cy="22" r="18" class="r-bg"/>${z}
    <circle cx="22" cy="22" r="18" class="r-fg" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 22 22)"/>
  </svg>`;
}

function setRing(root, id, v, color) {
  const fg = root.querySelector(`[data-ring="${id}"] .r-fg`);
  if (!fg) return;
  fg.style.strokeDashoffset = `${C * (1 - v)}`;
  fg.style.stroke = color;
}

const patienceColor = f => (f > 0.6 ? '#49b26a' : f > 0.3 ? '#f0b429' : '#e2574c');
const zoneColor = z => (z === 'firm' ? '#9aa3ad' : z === 'ready' ? '#49b26a' : '#e2574c');
const starsText = n => (n >= 5 ? '🥇' : n >= 3 ? '🥈' : n >= 1 ? '⭐'.repeat(n) : '');

export function shopDay(schedule = DAY1) {
  return new Promise(resolve => {
    const s = core.createShop(schedule);
    let tab = 'order', active = null, msg = 'The shutters are up! Old Zhao’s is open. Customers will come to the counter.', over = false;

    const panel = openPanel(`<div class="shop">
      <div class="shop-top"><b>🍜 Old Zhao’s · Day 1</b><span id="sh-clock"></span><span id="sh-tips">¥0</span></div>
      <div class="shop-rail" id="sh-rail"></div>
      <div class="shop-tabs">
        <button data-tab="order">🛎️ Order <span class="badge" id="b-order"></span></button>
        <button data-tab="noodles">♨️ Noodles <span class="badge" id="b-noodles"></span></button>
        <button data-tab="build">🥣 Build</button>
      </div>
      <div class="shop-station" id="sh-station"></div>
      <div class="shop-msg" id="sh-msg"></div>
    </div>`);
    panel.classList.add('dim');
    const $ = sel => panel.querySelector(sel);
    panel.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; sfx('beep'); render(); }));
    const onKey = e => {
      const t = { Digit1: 'order', Digit2: 'noodles', Digit3: 'build' }[e.code];
      if (t) { tab = t; render(); }
    };
    addEventListener('keydown', onKey);

    const ticket = uid => s.tickets.find(t => t.uid === uid);
    const guestOf = t => s.guests.find(g => g.uid === t.guest);

    function renderRail() {
      const open = s.tickets.filter(t => !t.served);
      $('#sh-rail').innerHTML = open.length ? open.map(t => {
        const d = MENU[t.dish];
        const g = GUESTS[guestOf(t).who];
        const basket = s.baskets.findIndex(b => b.ticket === t.uid);
        const noodle = t.noodles !== null ? '✅' : basket >= 0 ? '♨️' : '·';
        return `<button class="ticket ${t.uid === active ? 'on' : ''}" data-ticket="${t.uid}">
          <div class="t-head">${t.uid} ${g.ico}</div>
          <div class="t-row">${BROTHS[d.broth].ico} ${d.parts.map(p => PARTS[p].ico).join('')}</div>
          <div class="t-foot">${esc(d.name)} · noodles ${noodle}</div></button>`;
      }).join('') : '<span class="sub">No tickets yet: take an order at the counter.</span>';
      $('#sh-rail').querySelectorAll('[data-ticket]').forEach(b => b.addEventListener('click', () => {
        active = b.dataset.ticket; sfx('beep'); if (tab === 'order') tab = 'build'; render();
      }));
    }

    function renderOrder() {
      const list = s.guests.filter(g => g.state !== 'served');
      $('#sh-station').innerHTML = `<div class="counter">${list.length ? list.map(g => {
        const G = GUESTS[g.who];
        return `<div class="guest">
          <div class="g-ring">${ringSVG(`p-${g.uid}`)}<span class="g-ico">${G.ico}</span></div>
          <div class="g-body"><b>${esc(G.name)}</b>
            <div class="sub">${g.state === 'line' ? 'At the counter' : `Waiting for ${g.ticket}`} ${starsText(s.stars[g.who] || 0)}</div></div>
          ${g.state === 'line' ? `<button class="btn-big" data-take="${g.uid}">Take order</button>` : ''}
        </div>`;
      }).join('') : '<p class="sub">The counter is quiet… for now.</p>'}</div>`;
      $('#sh-station').querySelectorAll('[data-take]').forEach(b => b.addEventListener('click', () => {
        const t = core.takeOrder(s, b.dataset.take);
        if (!t) return;
        const g = s.guests.find(x => x.uid === b.dataset.take);
        msg = `${GUESTS[g.who].ico} ${GUESTS[g.who].name}: “${GUESTS[g.who].line}” → ticket ${t.uid}`;
        active = t.uid;
        sfx('pop');
        render();
      }));
    }

    function renderNoodles() {
      $('#sh-station').innerHTML = `<div class="baskets">${s.baskets.map((b, i) => {
        const r = core.noodleRing(b.t);
        const t = b.ticket && ticket(b.ticket);
        const canDrop = active && !b.ticket && ticket(active) && ticket(active).noodles === null && !s.baskets.some(x => x.ticket === active);
        return `<div class="basket">
          <div class="b-ring">${ringSVG(`n-${i}`, r)}<span class="b-ico">${b.ticket ? '🍜' : '🧺'}</span></div>
          <div class="b-label" data-blabel="${i}">${b.ticket ? `${t.uid}` : 'Empty'}</div>
          ${b.ticket
            ? `<button class="btn-big" data-lift="${i}">Lift!</button>`
            : `<button class="btn-soft" data-drop="${i}" ${canDrop ? '' : 'disabled'}>${active ? `Noodles for ${active}` : 'Pick a ticket first'}</button>`}
        </div>`;
      }).join('')}</div>
      <p class="sub" style="text-align:center">Lift when the needle is in the green. They keep cooking while you’re at other stations!</p>`;
      $('#sh-station').querySelectorAll('[data-drop]').forEach(b => b.addEventListener('click', () => {
        if (core.startNoodles(s, +b.dataset.drop, active)) { sfx('splash'); render(); }
      }));
      $('#sh-station').querySelectorAll('[data-lift]').forEach(b => b.addEventListener('click', () => {
        const sc = core.liftNoodles(s, +b.dataset.lift);
        msg = sc >= 1 ? '🍜 Perfect noodles! Springy and tender.' : sc >= 0.7 ? '🍜 Good noodles.' : '🍜 Hmm… not quite.';
        sfx(sc >= 1 ? 'ding' : 'pop');
        render();
      }));
    }

    function renderBuild() {
      const t = active && ticket(active);
      if (!t || t.served) {
        $('#sh-station').innerHTML = '<p class="sub" style="text-align:center">Pick a ticket from the rail above to build its bowl.</p>';
        return;
      }
      const d = MENU[t.dish];
      const color = t.broth ? BROTHS[t.broth].color : '#eef1f4';
      $('#sh-station').innerHTML = `<div class="build">
        <div class="bowl" style="--broth:${color}"><div class="bowl-in">${t.parts.map(p => `<span>${PARTS[p].ico}</span>`).join('')}</div></div>
        <div class="b-side">
          <div class="sub">Ticket ${t.uid}: <b>${esc(d.name)}</b></div>
          <div class="row">${Object.entries(BROTHS).map(([id, b]) =>
            `<button class="btn-soft ${t.broth === id ? 'on' : ''}" data-broth="${id}">${b.ico} ${esc(b.name)}</button>`).join('')}</div>
          <div class="k-bins">${Object.entries(PARTS).map(([id, p]) => {
            const dis = id === 'noodles' && t.noodles === null;
            return `<button class="k-bin" data-part="${id}" ${dis ? 'disabled' : ''}><span class="ico">${p.ico}</span>
              <span>${esc(p.name)}${id === 'noodles' ? (t.noodles === null ? (s.baskets.some(b => b.ticket === t.uid) ? ' ♨️' : ' (cook first)') : ' ✅') : ''}</span></button>`;
          }).join('')}</div>
          <div class="row" style="justify-content:space-between">
            <button class="btn-soft" id="sh-undo">↶ Undo</button>
            <button class="btn-big" id="sh-serve" ${t.broth && t.parts.length ? '' : 'disabled'}>Serve ${t.uid} 🍜</button>
          </div>
        </div></div>`;
      $('#sh-station').querySelectorAll('[data-broth]').forEach(b => b.addEventListener('click', () => {
        core.setBroth(s, t.uid, b.dataset.broth); sfx('splash'); render();
      }));
      $('#sh-station').querySelectorAll('[data-part]').forEach(b => b.addEventListener('click', () => {
        if (core.addPart(s, t.uid, b.dataset.part)) { sfx('pop'); render(); }
      }));
      $('#sh-undo').addEventListener('click', () => { core.undoPart(s, t.uid); render(); });
      $('#sh-serve').addEventListener('click', () => {
        const r = core.serve(s, t.uid);
        if (!r) return;
        const G = GUESTS[r.who];
        const face = r.points >= 80 ? '😋' : r.points >= 60 ? '🙂' : '😕';
        msg = `${G.ico} ${face} ${G.name}: ${r.points} pts · +¥${r.tip} tip ${r.stars ? `· ${starsText(r.stars)} star customer` : ''}`;
        sfx(r.points >= 80 ? 'coin' : 'pop');
        active = null;
        tab = 'order';
        render();
      });
    }

    function render() {
      panel.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
      renderRail();
      if (tab === 'order') renderOrder();
      if (tab === 'noodles') renderNoodles();
      if (tab === 'build') renderBuild();
      $('#sh-msg').textContent = msg;
      update();
    }

    // per-frame: timers, rings and badges only (no re-render, so clicks are never lost)
    function update() {
      $('#sh-clock').textContent = `⏱ ${Math.floor(s.time)}s`;
      $('#sh-tips').textContent = `¥${s.tips}`;
      for (const g of s.guests) {
        const f = g.patience / g.maxPatience;
        setRing(panel, `p-${g.uid}`, f, patienceColor(f));
      }
      s.baskets.forEach((b, i) => {
        const r = core.noodleRing(b.t);
        setRing(panel, `n-${i}`, b.ticket ? r.v : 0, zoneColor(r.zone));
        const lab = panel.querySelector(`[data-blabel="${i}"]`);
        if (lab && b.ticket) lab.textContent = `${b.ticket} · ${r.zone === 'firm' ? 'too firm' : r.zone === 'ready' ? 'READY!' : 'getting soft…'}`;
      });
      const waiting = s.guests.filter(g => g.state === 'line').length;
      $('#b-order').textContent = waiting ? `${waiting}` : '';
      const ready = s.baskets.some(b => b.ticket && core.noodleRing(b.t).zone !== 'firm');
      $('#b-noodles').textContent = ready ? '🔔' : '';
    }

    function summary() {
      removeEventListener('keydown', onKey);
      const rows = s.results.map(r => `<tr><td>${GUESTS[r.who].ico} ${esc(GUESTS[r.who].name)}</td><td>${esc(MENU[r.dish].name)}</td>
        <td>${Math.round(r.wait * 100)}%</td><td>${Math.round(r.noodles * 100)}%</td><td>${Math.round(r.build.total * 100)}%</td>
        <td><b>${r.points}</b></td><td>¥${r.tip}</td><td>${starsText(r.stars)}</td></tr>`).join('');
      const avg = s.results.length ? Math.round(s.points / s.results.length) : 0;
      panel.querySelector('.shop').innerHTML = `
        <h2>🌙 Closing time</h2>
        <p>${s.results.length} bowls served · average <b>${avg}</b> points · tips <b>¥${s.tips}</b></p>
        <div class="tbl"><table><tr><th>Guest</th><th>Bowl</th><th>Wait</th><th>Noodles</th><th>Build</th><th>Points</th><th>Tip</th><th>Stars</th></tr>${rows}</table></div>
        <p class="sub">${avg >= 80 ? 'Grandma is beaming. “Just like the old days.”' : avg >= 60 ? 'Grandma nods. “Not bad, foreigner.”' : 'Grandma pats your arm. “Tomorrow, again.”'}</p>
        <div class="row" style="justify-content:flex-end; gap:8px">
          <button class="btn-soft" data-nav="#shop">Play the day again</button>
          <button class="btn-big" id="sh-done">Done</button>
        </div>`;
      sfx('reveal');
      panel.querySelector('#sh-done').addEventListener('click', () => {
        panel.classList.remove('dim');
        closePanel();
        resolve({ points: s.points, tips: s.tips, results: s.results, stars: s.stars });
      });
    }

    addTicker(dt => {
      if (over) return true;
      core.tick(s, dt);
      for (const e of core.drainEvents(s)) {
        if (e.type === 'arrive') {
          sfx('ding');
          msg = `${GUESTS[e.who].ico} ${GUESTS[e.who].name} is at the counter!`;
          render();
        }
      }
      update();
      if (core.dayOver(s)) { over = true; setTimeout(summary, 1200); return true; }
    });

    window.__shop = s;   // for automated tests
    render();
  });
}
