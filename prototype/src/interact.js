// "Press E to talk" style interactions in the world.

import { G } from './core.js';
import { player } from './player.js';
import { takeAction, setActionLabel } from './input.js';
import { showPrompt } from './ui.js';

const list = new Set();
let running = false;

/** it: { at: () => {x,z}, r, label, fn: async () => {} } */
export function addInteract(it) {
  list.add(it);
  return () => list.delete(it);
}

export function clearInteracts() { list.clear(); }

export function updateInteract() {
  if (running || G.busy > 0 || G.flags.cutscene) { showPrompt(null); return; }
  let best = null, bestD = Infinity;
  for (const it of list) {
    const p = it.at();
    const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (d < it.r && d < bestD) { best = it; bestD = d; }
  }
  if (!best) { showPrompt(null); setActionLabel('E'); takeAction(); return; }
  showPrompt(`E · ${best.label}`);
  setActionLabel('💬');
  if (takeAction()) {
    running = true;
    showPrompt(null);
    player.speed = 0;
    Promise.resolve(best.fn()).finally(() => { running = false; });
  }
}
