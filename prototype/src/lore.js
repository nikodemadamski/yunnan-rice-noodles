// What the game knows about 过桥米线, and when you learn it.
// Facts and sources: docs/design/GUOQIAO_MIXIAN.md. The legend is told as a
// legend; the facts are facts. Each Bridge Note unlocks at the moment you
// meet it in play, and they're all kept on the end card.

import { G, esc } from './core.js';
import { toast } from './ui.js';
import { sfx, note } from './audio.js';

export const NOTES = {
  legend: { ico: '🌉', title: 'The South Lake legend', text: 'A scholar studied on an island in Mengzi’s South Lake; his wife crossed the bridge with broth kept hot under chicken fat. A folk tale, but it gave the dish its name.' },
  mengzi: { ico: '🏞️', title: 'Hometown: Mengzi', text: 'The dish comes from Mengzi (蒙自), southern Yunnan, from the late Ming / early Qing: 300-odd years. Mengzi is “the Hometown of Crossing-the-Bridge Rice Noodles”.' },
  broth: { ico: '🐔', title: 'The broth', text: 'Free-range old hen and pork tube bones, boiled hard then simmered 4+ hours, and never a drop of water added.' },
  seal: { ico: '✨', title: 'The seal', text: 'A coin-thick layer of oil keeps the broth above 95°C. No steam shows, which is why first-timers burn their mouths.' },
  raw: { ico: '🥩', title: 'Heat is the stove', text: 'Paper-thin raw slices cook in the bowl in seconds. That only works if the broth is scalding: cooled broth can’t cook them.' },
  order: { ico: '📜', title: 'Crossing in order', text: '先生后熟、先荤后素: raw before cooked, meat before greens, and the rice noodles last.' },
  chrys: { ico: '🌼', title: 'Chrysanthemum petals', text: 'Mengzi’s master Wang Lizhu (王丽珠), a national heritage inheritor and 3rd generation of her family’s craft, is known for adding chrysanthemum to the bowl.' },
  tiers: { ico: '🎓', title: 'Xiucai, Juren, Zhuangyuan', text: 'Kunming shops name their sets after the scholar’s exam ranks: 秀才 scholar, 举人 graduate, 状元 top scholar, the whole feast.' },
  feast: { ico: '🍽️', title: 'A feast for one', text: '一个人的盛宴: a big deep bowl of broth and a tray of little saucers, and the diner crosses the bridge themselves.' },
  heritage: { ico: '🏛️', title: 'National heritage', text: 'In 2014 the Mengzi making technique (蒙自过桥米线制作技艺) joined China’s national intangible cultural heritage list.' },
  masters: { ico: '🏮', title: 'The old masters', text: 'Jianxinyuan (建新园), Kunming: serving it since 1906 (first as Sanhechun), on Baoshan Street; a China Time-Honoured Brand.' },
};

export function learn(id) {
  G.notes = G.notes || new Set();
  if (!NOTES[id] || G.notes.has(id)) return;
  G.notes.add(id);
  const n = NOTES[id];
  toast(`📜 Bridge Note: ${n.ico} <b>${esc(n.title)}</b>`, 3.6);
  note(988, 0.12, 'sine', 0.08); note(1318, 0.2, 'sine', 0.06, 0.1);
}

export function notesHtml() {
  const got = G.notes || new Set();
  const ids = Object.keys(NOTES);
  return `<h3>📜 Bridge Notes · ${got.size}/${ids.length}</h3>` + ids.map(id => {
    const n = NOTES[id];
    return got.has(id) ? `<p class="sub"><b>${n.ico} ${esc(n.title)}</b>: ${esc(n.text)}</p>` : `<p class="sub" style="opacity:.45">🔒 ???</p>`;
  }).join('');
}

// ------------------------------------------------------------- the storybook

const INK = '#5b4636', LAKE = '#9fd3e6', LAKE2 = '#7fbfd8', GRASS = '#9bd19b', GOLD = '#f2c96a';
const pavilion = (x, y) => `<g transform="translate(${x} ${y})">
  <rect x="-22" y="-10" width="44" height="26" fill="#f6e3c4" stroke="${INK}" stroke-width="2.5"/>
  <path d="M-34 -10 Q0 -40 34 -10 Z" fill="#c0392b" stroke="${INK}" stroke-width="2.5"/>
  <rect x="-6" y="2" width="12" height="14" fill="${INK}"/></g>`;
const bridge = `<path d="M70 150 Q160 92 250 128" fill="none" stroke="${INK}" stroke-width="7"/><path d="M70 150 Q160 92 250 128" fill="none" stroke="#e7c08a" stroke-width="4"/>`;
const lake = `<ellipse cx="200" cy="150" rx="190" ry="60" fill="${LAKE}"/><ellipse cx="210" cy="160" rx="150" ry="38" fill="${LAKE2}" opacity=".5"/>`;
const island = `<ellipse cx="290" cy="135" rx="62" ry="22" fill="${GRASS}" stroke="${INK}" stroke-width="2.5"/>`;
const wife = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <circle cx="0" cy="-34" r="11" fill="#f6d2b0" stroke="${INK}" stroke-width="2"/><path d="M-11 -38 Q0 -52 11 -38" fill="#2a2a2a"/>
  <path d="M-12 -22 L12 -22 L16 6 L-16 6 Z" fill="#e8708f" stroke="${INK}" stroke-width="2"/>
  <rect x="10" y="-18" width="16" height="11" rx="3" fill="#c98f5c" stroke="${INK}" stroke-width="2"/></g>`;
const scholar = (x, y) => `<g transform="translate(${x} ${y})">
  <circle cx="0" cy="-30" r="10" fill="#f6d2b0" stroke="${INK}" stroke-width="2"/><rect x="-6" y="-44" width="12" height="6" fill="#2a2a2a"/>
  <path d="M-11 -19 L11 -19 L14 6 L-14 6 Z" fill="#5a7bb0" stroke="${INK}" stroke-width="2"/>
  <rect x="-18" y="-12" width="14" height="10" fill="#fffaf0" stroke="${INK}" stroke-width="1.5"/></g>`;
const bowl = (x, y, { steam = 0, oil = false, cold = false, s = 1 } = {}) => `<g transform="translate(${x} ${y}) scale(${s})">
  ${Array.from({ length: steam }, (_, i) => `<path d="M${-14 + i * 14} -24 q6 -10 0 -20 q-6 -10 0 -20" fill="none" stroke="${cold ? '#9ab' : '#fff'}" stroke-width="3" opacity=".8"/>`).join('')}
  <path d="M-40 -18 L40 -18 Q36 22 0 26 Q-36 22 -40 -18 Z" fill="#fffaf0" stroke="${INK}" stroke-width="3"/>
  <ellipse cx="0" cy="-18" rx="40" ry="8" fill="${cold ? '#d8cdb0' : GOLD}" stroke="${INK}" stroke-width="2.5"/>
  ${oil ? `<ellipse cx="0" cy="-19" rx="34" ry="5.5" fill="#ffe680" opacity=".9"/><circle cx="-12" cy="-20" r="2" fill="#fff"/><circle cx="10" cy="-18" r="1.6" fill="#fff"/>` : ''}
  <path d="M-36 -10 L36 -10" stroke="#3a6ea5" stroke-width="3"/></g>`;
const saucer = (x, y, c) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="15" ry="5" fill="#fff" stroke="${INK}" stroke-width="2"/><ellipse cx="0" cy="-2" rx="9" ry="3" fill="${c}"/></g>`;

const PAGES = [
  { svg: `${lake}${island}${bridge}${pavilion(290, 118)}${scholar(318, 128)}`,
    text: 'Long ago, in Mengzi, there was a lake called South Lake. On a little island, a young scholar sat studying for the imperial exams.' },
  { svg: `${lake}${island}${bridge}${pavilion(290, 118)}${wife(150, 112)}${bowl(80, 70, { steam: 2, cold: true })}`,
    text: 'Every day his wife carried his lunch across the long bridge. And every day, by the time she reached him, it had gone cold.' },
  { svg: `<rect x="0" y="0" width="400" height="200" fill="#fbecd2"/>${bowl(200, 128, { oil: true, s: 1.9 })}<text x="200" y="40" text-anchor="middle" font-size="16" font-weight="800" fill="${INK}">…quiet. No steam at all.</text>`,
    text: 'One day she stewed a fat old hen, and was called away. When she came back, the pot looked quiet, not a wisp of steam. But underneath, it was burning hot.' },
  { svg: `<rect x="0" y="0" width="400" height="200" fill="#fbecd2"/>${bowl(200, 98, { oil: true, s: 1.5 })}${saucer(110, 160, '#f7a8a8')}${saucer(150, 172, '#efe2c8')}${saucer(200, 178, '#b3343a')}${saucer(250, 172, '#ffd23f')}${saucer(290, 160, '#6cc35a')}`,
    text: 'The hen’s fat had sealed the heat in. So she carried the scalding broth under its fat, with the noodles and the thin raw slices apart, and put them together on his side of the bridge.' },
  { svg: `<rect x="0" y="0" width="400" height="200" fill="#ffe9c4"/><circle cx="320" cy="60" r="34" fill="#ffd23f" opacity=".8"/>${lake}${island}${bridge}${pavilion(290, 118)}${wife(240, 124, 0.9)}${scholar(272, 128)}<text x="120" y="56" font-size="30" font-weight="900" fill="#c0392b">过桥米线</text>`,
    text: 'He passed his exams, and swore her noodles did it. People named the dish after her walk: crossing the bridge.' },
];

/** Grandma tells the South Lake legend, page by page (tap to turn). */
export async function legend() {
  if (G.skip) { learn('legend'); learn('mengzi'); return; }
  G.busy++;
  const el = document.createElement('div');
  el.className = 'storybook';
  document.getElementById('ui').appendChild(el);
  for (const [i, pg] of PAGES.entries()) {
    el.innerHTML = `<div class="sb-page"><svg viewBox="0 0 400 200" class="sb-art">${pg.svg}</svg>
      <p class="sb-text">${esc(pg.text)}</p>
      <div class="sb-foot"><span>👵 Grandma’s story · ${i + 1}/${PAGES.length}</span><span class="sb-tap">tap ▸</span></div></div>`;
    sfx('pop'); note([392, 440, 523, 587, 659][i], 0.6, 'sine', 0.06);
    await new Promise(res => {
      const t = setTimeout(res, 9000);
      el.addEventListener('pointerdown', () => { clearTimeout(t); res(); }, { once: true });
    });
    if (G.skip) break;
  }
  el.classList.add('out');
  await new Promise(r => setTimeout(r, 350));
  el.remove();
  G.busy--;
  learn('legend'); learn('mengzi');
}
