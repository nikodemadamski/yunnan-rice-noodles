// Plankton scheme: sneak a look at Auntie Fu's secret while her back is
// turned. Hold the button to creep in; let go when she stops humming.

import { addTicker, rng } from './core.js';
import { openPanel, closePanel } from './ui.js';
import { isActionHeld, setActionHeld } from './input.js';
import { sfx } from './audio.js';

export function peekScheme() {
  return new Promise(resolve => {
    const R = rng(1996);
    const panel = openPanel(`
      <div class="card">
        <h2>🕵️ Scheme: peek at Auntie Fu’s secret</h2>
        <p class="sub">Hold to creep towards the stove. When she stops humming (♪), she’s about to turn. <b>Let go!</b></p>
        <div class="peek-stage">
          <div class="door"></div>
          <div class="you" id="pk-you">🧍</div>
          <div class="notes" id="pk-notes">♪ ♫</div>
          <div class="cook" id="pk-cook">👩‍🍳</div>
          <div class="stove">🍲🫙</div>
        </div>
        <div class="meter"><span>🫙</span><div class="bar"><div class="fill" id="pk-fill" style="width:0%; background:#e0602c"></div></div></div>
        <button class="btn-big hold-btn" id="pk-hold">Hold to sneak (or hold E / Space)</button>
      </div>`);
    const you = panel.querySelector('#pk-you');
    const cook = panel.querySelector('#pk-cook');
    const notes = panel.querySelector('#pk-notes');
    const fill = panel.querySelector('#pk-fill');
    const btn = panel.querySelector('#pk-hold');
    let held = false;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); held = true; });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => { held = false; });
    setActionHeld(false);

    let state = 'back', t = 1.8 + R() * 1.2, progress = 0, grace = 0, done = false;
    addTicker(dt => {
      if (done) return true;
      const holding = held || isActionHeld();
      t -= dt;
      if (t <= 0) {
        if (state === 'back') { state = 'warn'; t = 0.7; }
        else if (state === 'warn') { state = 'front'; t = 1.1 + R() * 0.6; grace = 0.12; sfx('beep'); }
        else { state = 'back'; t = 1.4 + R() * 1.8; }
      }
      notes.style.visibility = state === 'back' ? 'visible' : 'hidden';
      cook.classList.toggle('front', state === 'front');
      if (holding) progress += dt * 26;
      you.textContent = holding ? '🚶' : '🧍';
      you.style.left = `${10 + progress * 2.2}px`;
      fill.style.width = `${Math.min(100, progress)}%`;
      if (state === 'front') {
        grace -= dt;
        if (holding && grace <= 0) {
          done = true;
          cook.textContent = '😡';
          sfx('whack');
          setTimeout(() => { closePanel(); resolve('caught'); }, 900);
          return true;
        }
      }
      if (progress >= 100) {
        done = true;
        sfx('reveal');
        setTimeout(() => { closePanel(); resolve('success'); }, 500);
        return true;
      }
    });
  });
}
