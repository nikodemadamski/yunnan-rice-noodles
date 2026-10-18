// Grandma's evening Bowl Lab: pick a broth, an oil layer and a topping
// (plus tempting "extras"), grandma tastes it against her memory of
// grandpa's bowl and gives per-slot feedback.

import { G, esc, wait } from './core.js';
import { openPanel, closePanel, beat } from './ui.js';
import { sfx } from './audio.js';

export const SLOTS = [
  {
    id: 'broth', label: 'Broth', options: [
      { id: 'cube', name: 'AI stock cube', ico: '🧊', color: '#a07a4a', free: true,
        verdict: 'bad', fb: 'Tastes like a factory. Where is the chicken?' },
      { id: 'hen', name: 'Old hen broth', ico: '🐔', color: '#f2c14e', hint: 'Someone steams hens for hours…',
        verdict: 'good', fb: 'Yes… hours and hours of old hen. Like his.' },
      { id: 'flower', name: 'Rose petal broth', ico: '🌹', color: '#f4a6c0', hint: 'Someone who loves flowers a bit too much',
        verdict: 'bad', fb: 'Flowers are for cakes, child.' },
    ],
  },
  {
    id: 'oil', label: 'Oil layer', options: [
      { id: 'none', name: 'No oil', ico: '⭕', free: true,
        verdict: 'bad', fb: 'It went cold before I reached the spoon.' },
      { id: 'chilli', name: 'Fried chilli oil', ico: '🌶️', hint: "Auntie Fu's secret jar",
        verdict: 'close', fb: 'An oil layer, yes! But this one shouts too loud.' },
      { id: 'fat', name: 'Chicken fat layer', ico: '✨', hint: 'An old story by Green Lake',
        verdict: 'good', fb: 'The fat keeps the heat in. Just like the legend.' },
    ],
  },
  {
    id: 'top', label: 'Topping', options: [
      { id: 'cheese', name: 'Cheddar (AI idea)', ico: '🧀', free: true,
        verdict: 'bad', fb: 'Why. Why is there cheese.' },
      { id: 'potato', name: 'Fried potato', ico: '🥔', free: true,
        verdict: 'close', fb: 'Very Irish. Very honest. Close… but no.' },
      { id: 'chives', name: 'Chives', ico: '🌿', hint: "Little Chilli's bowl had these",
        verdict: 'good', fb: 'Chives. Simple. He always said less is more.' },
      { id: 'rose', name: 'Rose petals', ico: '🌸', hint: 'From the flower cake shop',
        verdict: 'bad', fb: 'Pretty. Wrong. Very wrong.' },
    ],
  },
];

export const EXTRAS = [
  { id: 'gold', name: 'Gold leaf', ico: '🪙' },
  { id: 'sparkler', name: 'Sparkler', ico: '🎆' },
  { id: 'eggs', name: '12 quail eggs', ico: '🥚' },
];

export function hasOption(slot, opt) {
  return opt.free || G.findings.has(`${slot.id}:${opt.id}`);
}

function bowlSVG(pick, extras) {
  const broth = SLOTS[0].options.find(o => o.id === pick.broth);
  const oil = pick.oil;
  const top = SLOTS[2].options.find(o => o.id === pick.top);
  const oilEllipses = oil === 'none' ? '' : [[70, 60, 14], [118, 66, 10], [96, 76, 8], [134, 56, 6]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" fill="${oil === 'chilli' ? '#d9381e' : '#ffe9a0'}" opacity="0.8"/>`).join('');
  const tops = top ? [[78, 66], [110, 58], [126, 72], [92, 54]].map(([x, y]) => `<text x="${x}" y="${y}" font-size="18" text-anchor="middle">${top.ico}</text>`).join('') : '';
  const ex = extras.map((id, i) => `<text x="${60 + i * 40}" y="${40 - (i % 2) * 8}" font-size="22" text-anchor="middle">${EXTRAS.find(e => e.id === id).ico}</text>`).join('');
  return `<svg class="bowl-svg" viewBox="0 0 200 170" aria-hidden="true">
    <ellipse cx="100" cy="64" rx="92" ry="32" fill="#e9eef5" stroke="#5b7fb5" stroke-width="3"/>
    <ellipse cx="100" cy="66" rx="82" ry="25" fill="${broth ? broth.color : '#ddd'}"/>
    ${oilEllipses}${tops}
    <path d="M8,66 Q16,160 100,160 Q184,160 192,66 Q150,98 100,98 Q50,98 8,66 Z" fill="#ffffff" stroke="#5b7fb5" stroke-width="3"/>
    <path d="M30,108 Q100,128 170,108" fill="none" stroke="#5b7fb5" stroke-width="3" stroke-dasharray="6 6"/>
    <rect x="72" y="158" width="56" height="8" rx="4" fill="#5b7fb5"/>
    ${ex}
  </svg>`;
}

/**
 * mode 'ai': the day-1 disaster, recipe fixed by the AI.
 * mode 'free': the player chooses.
 * Resolves with { greens, perfect, extras, pick }.
 */
export function bowlLab(mode = 'free') {
  return new Promise(resolve => {
    const ai = mode === 'ai';
    const pick = ai ? { broth: 'cube', oil: 'none', top: 'cheese' } : { broth: null, oil: null, top: null };
    let extras = ai ? ['gold', 'sparkler'] : [];
    let tasted = false, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      closePanel();
      resolve(result());
    };

    const panel = openPanel(`<div class="card" id="lab"></div>`);
    const root = panel.querySelector('#lab');

    function render(feedback) {
      const slots = SLOTS.map(slot => `
        <div class="slot"><h3>${slot.label}</h3><div class="opts">
          ${slot.options.map(o => {
            const have = hasOption(slot, o);
            const on = pick[slot.id] === o.id;
            return `<button class="btn-soft ${on ? 'on' : ''}" data-slot="${slot.id}" data-opt="${o.id}" ${!have || ai || tasted ? 'disabled' : ''}
              title="${have ? '' : esc(o.hint || '')}">${have ? `${o.ico} ${esc(o.name)}` : `❔ ${esc(o.hint || '???')}`}</button>`;
          }).join('')}
        </div>${feedback ? `<div class="fb ${feedback[slot.id].verdict}">${feedback[slot.id].verdict === 'good' ? '🟢' : feedback[slot.id].verdict === 'close' ? '🟡' : '🔴'} ${esc(feedback[slot.id].fb)}</div>` : ''}</div>`).join('');
      const ex = `<div class="slot"><h3>Extras <span class="sub">(the AI and Old Wang swear by these)</span></h3><div class="opts">
        ${EXTRAS.map(e => `<button class="btn-soft ${extras.includes(e.id) ? 'on' : ''}" data-extra="${e.id}" ${ai || tasted ? 'disabled' : ''}>${e.ico} ${esc(e.name)}</button>`).join('')}
        </div>${feedback && extras.length ? `<div class="fb bad">🔴 Too much! It tastes like that Wang's bowl!</div>` : ''}</div>`;
      const ready = pick.broth && pick.oil && pick.top;
      root.innerHTML = `
        <div class="lab-top">${bowlSVG(pick, extras)}
          <div><h2>${ai ? '🤖 The AI’s “Perfect” Bowl' : '👵 Grandma’s Kitchen'}</h2>
          <p class="sub">${ai ? 'PromptPal says: “Trust me 🙂”. Wang’s livestream is rolling.' : 'Choose what grandma cooks. She’ll taste it against her memory of grandpa’s bowl.'}</p>
          <p class="sub">Findings so far: ${G.findings.size}</p></div></div>
        ${slots}${ex}
        <div class="row" style="justify-content:flex-end; margin-top:14px" id="lab-actions">
          ${feedback
            ? `${!ai ? '<button class="btn-soft" id="lab-again">Try another (prototype)</button>' : ''}<button class="btn-big" id="lab-done">Continue</button>`
            : `<button class="btn-big" id="lab-cook" ${ready ? '' : 'disabled'}>${ai ? 'Serve it live 🎥' : 'Cook it! 🔥'}</button>`}
        </div>`;

      root.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => {
        pick[b.dataset.slot] = b.dataset.opt; sfx('pop'); render();
      }));
      root.querySelectorAll('[data-extra]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.extra;
        extras = extras.includes(id) ? extras.filter(e => e !== id) : [...extras, id];
        sfx('pop'); render();
      }));
      const cook = root.querySelector('#lab-cook');
      if (cook) cook.addEventListener('click', taste);
      const again = root.querySelector('#lab-again');
      if (again) again.addEventListener('click', () => { tasted = false; render(); });
      const done = root.querySelector('#lab-done');
      if (done) done.addEventListener('click', finish);
    }

    function verdicts() {
      const fb = {};
      for (const slot of SLOTS) fb[slot.id] = slot.options.find(o => o.id === pick[slot.id]);
      return fb;
    }

    function result() {
      const fb = verdicts();
      const greens = SLOTS.filter(s => fb[s.id].verdict === 'good').length;
      return { greens, perfect: greens === 3 && extras.length === 0, extras: [...extras], pick: { ...pick } };
    }

    async function taste() {
      tasted = true;
      const actions = root.querySelector('#lab-actions');
      actions.innerHTML = '<p class="sub" style="font-size:22px">👵 slurp… <span id="taste-face">😐</span></p>';
      const faces = ai ? ['😐', '😮', '😨', '🤢', '😡', '😶'] : ['😐', '🤔', '😮'];
      for (const f of faces) {
        const el = root.querySelector('#taste-face');
        if (el) el.textContent = f;
        sfx('beep');
        await (ai ? beat(0.45) : wait(0.45));
      }
      const r = result();
      sfx(r.perfect ? 'reveal' : r.greens >= 2 ? 'ding' : 'fail');
      render(verdicts());
      if (ai) beat(3.6).then(finish);   // the day-1 disaster plays out by itself
    }

    render();
    if (ai) beat(1.8).then(() => { if (!tasted) taste(); });
  });
}
