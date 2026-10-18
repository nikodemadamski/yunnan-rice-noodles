// "The SIM card": haggle with Auntie Duan for a phone number, then give your
// name on the real-name registration form (she mangles it; you fix it; you
// get a nickname). Design: docs/design/SIM_CARD_SCENE.md.

import * as THREE from 'three';
import { G, addTicker, esc } from './core.js';
import { W, P } from './world.js';
import { makeCharacter, mat } from './characters.js';
import { player, teleport, updateCamera } from './player.js';
import { SP } from './npcs.js';
import { say, talk, choose, bark, emote, cutscene, beat, openPanel, closePanel, toast, fadeIn } from './ui.js';
import { sfx, blip } from './audio.js';

const STALL = P.simStall;
let duan = null, cat = null;

function build() {
  if (duan) return;
  duan = makeCharacter({ skin: '#eec3a0', shirt: '#c0392b', pants: '#2d2d2d', hair: '#5a4a3a', hairStyle: 'bun', skirt: true, scale: 0.9, glasses: true, blush: true });
  duan.root.position.set(STALL.x + 0.6, 0.1, STALL.z - 2);
  duan.root.rotation.y = Math.PI;
  W.scene.add(duan.root);
  SP.duan = { name: 'Auntie Duan', color: '#2f6fb6', voice: 'fu', char: duan };
  SP.xiaoli = { name: 'Xiao Li (translator app)', color: '#7a52c7', voice: 'ai' };
  // the lucky cat on the counter; its paw slows down as her patience runs out
  cat = new THREE.Group();
  const gold = mat('#f2c14e');
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), gold); body.scale.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), gold); head.position.y = 0.36;
  const ears = [-0.12, 0.12].map(x => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), gold); e.position.set(x, 0.56, 0); return e; });
  const paw = new THREE.Group(); paw.position.set(0.2, 0.22, 0.05);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 3, 6), gold); arm.position.y = 0.12; paw.add(arm);
  cat.add(body, head, ...ears, paw);
  cat.position.set(STALL.x - 1.1, 1.38, STALL.z - 0.6);
  cat.rotation.y = Math.PI;
  W.scene.add(cat);
  cat.userData.paw = paw;
  cat.userData.speed = 1;
  addTicker(dt => {
    cat.userData.t = (cat.userData.t || 0) + dt * 6 * cat.userData.speed;
    paw.rotation.x = -0.6 + Math.sin(cat.userData.t) * 0.6;
  });
}

function duanSays(text) {
  bark(duan, text, 3.6);
  [...text].slice(0, 14).forEach((ch, i) => setTimeout(() => blip(ch, 'fu'), i * 55));
}

const NUMBERS = [
  { id: 'emperor', label: '138 8888 1688', name: 'The “Emperor” (all the eights!)', ask: 888, floor: 288 },
  { id: 'plain', label: '139 2468 0517', name: 'An ordinary number', ask: 50, floor: 20 },
  { id: 'cursed', label: '187 4444 1414', name: 'The cursed number (all the fours)', ask: 0, floor: 0 },
];

// ---------- haggling with "the Judge" ----------

function haggle(num) {
  return new Promise(resolve => {
    let price = num.ask, patience = 5, tooMuch = 0, praised = false, sipped = false, offer = '';
    const el = document.createElement('div');
    el.className = 'judge';
    el.innerHTML = `
      <div class="j-top"><span class="j-cups" id="j-cups"></span><span class="j-num">${esc(num.label)}</span></div>
      <div class="j-lcd"><div><small>她 SHE SAYS</small><b id="j-her">¥${price}</b></div><div><small>你 YOU OFFER</small><b id="j-you">¥_</b></div></div>
      <div class="j-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map(k => `<button data-k="${k}" class="${k === 'OK' ? 'ok' : ''}">${k}</button>`).join('')}</div>
      <div class="j-acts">
        <button data-a="guile">太贵了！<small>Too expensive!</small></button>
        <button data-a="cat">🐱 <small>Praise the cat</small></button>
        <button data-a="walk">🚶 <small>Walk away</small></button>
      </div>`;
    document.getElementById('ui').appendChild(el);
    const $ = s => el.querySelector(s);
    const paint = () => {
      $('#j-her').textContent = `¥${price}`;
      $('#j-you').textContent = `¥${offer || '_'}`;
      $('#j-cups').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < patience ? 'hot' : 'cold'}">🍵</span>`).join('');
      duan.setFace(patience >= 4 ? 'happy' : patience === 3 ? 'normal' : patience === 2 ? 'smug' : 'angry');
      cat.userData.speed = Math.max(0.15, patience / 5);
      if (!sipped && price <= num.floor * 1.25) { sipped = true; emote(duan, '🍵'); duanSays('*sips tea slowly*'); }
    };
    const done = (paid, outcome, extras = []) => {
      el.remove();
      resolve({ number: num.id, paid, outcome, extras });
    };
    const tired = () => {
      if (patience > 0) return false;
      duan.setFace('sad');
      duanSays('唉… Fine. Ordinary number, full price. And a tea egg. You are too thin.');
      sfx('fail');
      setTimeout(() => done(50, 'fail', ['tea egg']), 1600);
      return true;
    };
    const counter = v => Math.max(num.floor, Math.floor(v / 10) * 10 + 8);   // she likes prices ending in 8

    function makeOffer() {
      const o = parseInt(offer || '0', 10);
      offer = '';
      if (!o) return paint();
      sfx('beep');
      if (o >= price) { duanSays('成交！Deal!'); sfx('coin'); return setTimeout(() => done(o, 'deal'), 1200); }
      if (Math.abs(o - num.floor) <= 5) {
        duan.setFace('happy'); emote(duan, '😂');
        duanSays('哈哈！You are Kunming already! Deal. And a phone case!');
        sfx('reveal');
        return setTimeout(() => done(o, 'just', ['phone case']), 1600);
      }
      if (o < num.ask * 0.3) {
        patience -= 2;
        emote(duan, '💢');
        duanSays('哎哟！You want me to starve?!');
      } else if (o < num.floor) {
        patience -= 1;
        price = counter(price - (price - num.floor) * 0.35);
        duanSays(`计算器不会说谎。The calculator does not lie: ¥${price}.`);
      } else if (price - o <= Math.max(10, price * 0.08)) {
        duanSays('…好吧。OK, OK. Deal.'); sfx('coin');
        return setTimeout(() => done(o, 'deal'), 1200);
      } else {
        price = counter((price + o) / 2);
        duanSays(`¥${price}. Very lucky price.`);
      }
      paint();
      tired();
    }

    el.addEventListener('click', e => {
      const k = e.target.closest('[data-k]');
      const a = e.target.closest('[data-a]');
      if (k) {
        const v = k.dataset.k;
        if (v === 'OK') return makeOffer();
        if (v === '⌫') offer = offer.slice(0, -1);
        else if (offer.length < 4) offer += v;
        sfx('type');
        return paint();
      }
      if (!a) return;
      if (a.dataset.a === 'guile') {
        tooMuch++;
        if (tooMuch <= 2) { price = counter(price * 0.9); duanSays(`太贵？好好好… ¥${price}.`); }
        else { patience -= 1; duanSays('Yes yes, everything 太贵了. 老表!'); }
      }
      if (a.dataset.a === 'cat') {
        if (!praised) { praised = true; patience = Math.min(5, patience + 1); emote(duan, '❤️'); duanSays('招财猫！She likes you.'); }
        else duanSays('The cat is busy. Waving.');
      }
      if (a.dataset.a === 'walk') {
        if (price <= num.floor * 1.25) {
          duanSays(`好好好！¥${num.floor}! 回来！Come back!`);
          sfx('coin');
          return setTimeout(() => done(num.floor, 'callback'), 1500);
        }
        patience -= 1;
        duanSays('…Bye bye.');
        toast('You walk three steps… and come back. Sheepishly.');
      }
      sfx('pop');
      paint();
      tired();
    });
    paint();
  });
}

// ---------- the real-name form ----------

const NICK = { A: ['阿', 'Ā'], B: ['博', 'Bó'], C: ['卡', 'Kǎ'], D: ['大', 'Dà'], E: ['艾', 'Ài'], F: ['弗', 'Fú'], G: ['格', 'Gé'], H: ['哈', 'Hā'],
  I: ['伊', 'Yī'], J: ['杰', 'Jié'], K: ['凯', 'Kǎi'], L: ['莉', 'Lì'], M: ['马', 'Mǎ'], N: ['尼', 'Ní'], O: ['欧', 'Ōu'], P: ['帕', 'Pà'], Q: ['奎', 'Kuí'],
  R: ['瑞', 'Ruì'], S: ['西', 'Xī'], T: ['汤', 'Tāng'], U: ['乌', 'Wū'], V: ['维', 'Wéi'], W: ['威', 'Wēi'], X: ['克', 'Kè'], Y: ['尤', 'Yóu'], Z: ['扎', 'Zā'] };

const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '');

function form() {
  return new Promise(resolve => {
    const p = openPanel(`<div class="reg">
      <div class="passport">
        <div class="pp-head">PASSPORT · IRELAND</div>
        <div class="pp-photo">🙂</div>
        <label for="pp-name">Name (as in passport)</label>
        <input id="pp-name" maxlength="28" placeholder="Your name" autocomplete="off">
        <button class="btn-big" id="pp-give">Hand it over</button>
      </div>
      <div class="regform">
        <div class="rf-head">实名登记 Real-name registration</div>
        <div class="rf-row"><span>姓 Surname</span><b id="rf-sur">…</b><button class="btn-soft fix" data-fix="order" disabled>✎ Wrong</button></div>
        <div class="rf-row"><span>名 Given name</span><b id="rf-giv">…</b></div>
        <div class="rf-row"><span>读音 Said as</span><b id="rf-say">…</b><button class="btn-soft fix" data-fix="spell" disabled>✎ Spelling</button></div>
        <div class="rf-row"><span>昵称 Nickname</span><b id="rf-nick">—</b></div>
        <p class="sub" id="rf-msg">Auntie Duan uncaps a pen.</p>
        <button class="btn-big hidden" id="rf-ok">Sign 签字</button>
      </div></div>`);
    p.classList.add('dim');
    const $ = s => p.querySelector(s);
    const inp = $('#pp-name');
    setTimeout(() => inp.focus(), 60);
    let name = '', fixes = 0, orderFixed = false;
    const words = () => name.trim().split(/\s+/);
    const given = () => words()[0];
    const surname = () => words().slice(1).join(' ');
    const sayAs = s => strip(s).toUpperCase().slice(0, 8).split('').map(ch => ch).join('-');
    const render = () => {
      const g = strip(given()).toUpperCase(), s = strip(surname()).toUpperCase();
      $('#rf-sur').textContent = orderFixed ? (s || '—') : (g || '—');
      $('#rf-giv').textContent = orderFixed ? g : (s || '—');
      $('#rf-say').textContent = sayAs(given());
    };
    const msg = t => { $('#rf-msg').textContent = t; };
    const give = () => {
      const v = inp.value.trim().replace(/[<>]/g, '');
      if (!v) { inp.focus(); return; }
      name = v;
      inp.disabled = true;
      $('#pp-give').disabled = true;
      sfx('pop');
      msg('She copies it onto the form, tongue out in concentration…');
      setTimeout(() => {
        render();
        msg(`“${esc(sayAs(given()))}”? 好名字！Good name!`);
        p.querySelectorAll('.fix').forEach(b => { b.disabled = false; });
        $('#rf-ok').classList.remove('hidden');
        sfx('type');
      }, 900);
    };
    $('#pp-give').addEventListener('click', give);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') give(); });
    p.addEventListener('click', e => {
      const f = e.target.closest('[data-fix]');
      if (!f || f.disabled) return;
      fixes++;
      if (f.dataset.fix === 'order') {
        orderFixed = true; f.disabled = true;
        msg('哦哦！Surname first in China, given name first in Ireland. Fixed!');
      } else {
        msg('System no like accents. Or apostrophes. 对不起.');
        if (fixes >= 2) f.disabled = true;
      }
      sfx('pop');
      render();
      if (fixes >= 2 || orderFixed && f.dataset.fix === 'spell') giveNick();
    });
    let nicked = false;
    const giveNick = () => {
      if (nicked) return;
      nicked = true;
      const [ch, py] = NICK[strip(given())[0]?.toUpperCase()] || ['西', 'Xī'];
      G.nickname = `小${ch}`;
      $('#rf-nick').textContent = `小${ch} (Xiǎo ${py})`;
      msg(`Too hard. I write 小${ch} here. Little ${py}. 好记！Easy to remember.`);
      sfx('ding');
    };
    $('#rf-ok').addEventListener('click', () => {
      giveNick();
      sfx('coin');
      p.classList.remove('dim');
      closePanel();
      resolve(name);
    });
  });
}

function flash() {
  const f = document.createElement('div');
  f.className = 'flash';
  document.getElementById('ui').appendChild(f);
  sfx('whack');
  setTimeout(() => f.remove(), 700);
}

// ---------- the scene ----------

export async function simScene() {
  build();
  teleport(STALL.x + 0.4, STALL.z - 4.8, 0);
  // one composed shot for the whole scene: both faces, the stall, room for the UI below
  player.camShot = { pos: { x: STALL.x - 7.5, y: 4, z: STALL.z - 10.5 }, look: { x: STALL.x + 0.3, y: 0.9, z: STALL.z - 3.2 }, speed: 3 };
  updateCamera(0, true);
  let deal;
  await cutscene(async () => {
    await fadeIn();
    await beat(0.6);
    await say(SP.you, 'Phone says “No service”. Taxi app wants a Chinese number. Hotel wants a Chinese number…', { face: 'sad' });
    emote(duan, '❗');
    await talk([
      [SP.duan, '来来来，老表！手机卡要吗？', { zh: '来来来，老表！手机卡要吗？', tr: 'Come come, old watch! Hand machine card want?', face: 'happy' }],
      [SP.xiaoli, 'Auntie says: “Come, buddy! You need SIM card?”', {}],
      [SP.you, 'Yes! Please! One SIM card!', { face: 'happy' }],
      [SP.duan, 'Plan first. Price is price, 老表. No discount on plan.', { face: 'smug' }],
    ]);
    await choose(['¥88 · 10 GB', '¥128 · 20 GB', '¥198 · unlimited “for TikTok”']);
    await talk([[SP.duan, 'Now… the number. Numbers I can talk about. 嘿嘿.', { face: 'smug', emote: '✨' }]]);
  });
  const pick = await choose(NUMBERS.map(n => `${n.label} · ${n.name}`));
  const num = NUMBERS[pick];
  if (num.id === 'cursed') {
    await cutscene(() => talk([
      [SP.duan, '四四四四…送你！Free! And sunflower seeds.', { face: 'happy', emote: '🌻' }],
      [SP.xiaoli, 'Auntie says: “Your death number is very cheap and very fresh.”', {}],
      [SP.duan, '*lights a joss stick for you* There. Now it is lucky.', { face: 'normal' }],
    ]));
    deal = { number: 'cursed', paid: 0, outcome: 'free', extras: ['sunflower seeds', 'Brave Foreigner sticker'] };
  } else {
    G.flags.cutscene = true;
    duanSays(`${num.label}? ¥${num.ask}. 很吉利！Very lucky!`);
    toast('Type an offer on the Judge and press OK. Watch her face, her tea… and the cat.', 6);
    deal = await haggle(num);
    G.flags.cutscene = false;
    await beat(0.4);
  }
  G.flags.sim = deal;
  const name = await form();
  G.name = name;
  await cutscene(async () => {
    await talk([[SP.duan, 'Last thing. Face scan. Look at the cat. Smile!', { face: 'happy' }]]);
    flash();
    await beat(0.8);
    await talk([[SP.duan, '…The cat is in the photo too. 板扎！Perfect.', { face: 'happy', emote: '📸' }]]);
    sfx('ding');
    toast(`📱 【联通】Welcome to China, ${esc(G.nickname || name)}! Your number is active.`, 4);
    await beat(1.6);
    await talk([
      [SP.you, 'It works! I have a number! I’m a real person in China!', { face: 'happy', emote: '✨' }],
      [SP.duan, '下一步：微信！Next step: WeChat. Good luck, 老表. 嘿嘿.', { face: 'smug' }],
    ]);
  });
  player.camShot = null;
}
