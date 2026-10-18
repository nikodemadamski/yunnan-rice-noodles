// Little performances for staged scenes: characters that breathe, type,
// ladle, slurp, bounce and chuckle, so a shot is never a frozen pose.
// act(char, kind) starts a loop (replacing the last one); act(char, null) stops it.
// Runs as a ticker after the regular walk/idle animation, so it wins the frame.

import { addTicker } from './core.js';

const actors = new Map();
let t = 0, running = false;

const KINDS = {
  // standing idle with a breath, for anyone not managed by npcs.js / player.js
  idle(c, s, t) {
    c.body.position.y = Math.sin(t * 2.2 + s.ph) * 0.03;
    c.head.rotation.z = Math.sin(t * 1.3 + s.ph) * 0.03;
  },
  type(c, s, t) {                                   // fast alternating hands on a keyboard
    c.arms[0].rotation.x = -1.2 + Math.sin(t * 22 + s.ph) * 0.12;
    c.arms[1].rotation.x = -1.2 + Math.sin(t * 22 + s.ph + 2) * 0.12;
    c.head.rotation.x = 0.12 + Math.sin(t * 1.7) * 0.03;
  },
  ladle(c, s, t) {                                  // scoop, lift, pour: a 1.6 s cycle
    const k = (t * 0.62 + s.ph) % 1;
    c.arms[1].rotation.x = -0.6 - Math.sin(k * Math.PI * 2) * 0.7;
    c.arms[1].rotation.z = 0.25;
    c.body.rotation.x = Math.max(0, Math.sin(k * Math.PI * 2)) * 0.12;
    c.head.rotation.x = 0.18;
  },
  eat(c, s, t) {                                    // chopsticks up, head dips, a happy slurp
    const k = (t * 0.9 + s.ph) % 1;
    const dip = Math.max(0, Math.sin(k * Math.PI * 2));
    c.arms[1].rotation.x = -1.3 - dip * 0.6;
    c.arms[0].rotation.x = -0.9;
    c.head.rotation.x = 0.25 * dip;
    c.body.position.y = dip * 0.05;
  },
  bounce(c, s, t) {                                 // excited little hops on the toes
    const k = Math.abs(Math.sin(t * 7 + s.ph));
    c.body.position.y = k * 0.22;
    c.arms[0].rotation.z = -0.4 - k * 0.3; c.arms[1].rotation.z = 0.4 + k * 0.3;
  },
  chuckle(c, s, t) {                                // shoulders shake, head bobs
    c.body.position.y = Math.abs(Math.sin(t * 16)) * 0.05;
    c.head.rotation.x = -0.1 + Math.sin(t * 16) * 0.05;
    c.head.rotation.z = Math.sin(t * 2) * 0.06;
  },
  slump(c, s, t) {                                  // the 4:47 pm posture
    c.body.rotation.x = 0.1;
    c.head.rotation.x = 0.1 + Math.sin(t * 0.9) * 0.03;
    c.arms[0].rotation.x = -0.9; c.arms[1].rotation.x = -0.9;
    c.body.position.y = -0.05;
  },
  perk(c, s, t) {                                   // sits up, leans in to the screen
    c.body.rotation.x = -0.05;
    c.head.rotation.x = -0.12 + Math.sin(t * 3) * 0.04;
    c.arms[0].rotation.x = -1.0; c.arms[1].rotation.x = -1.0;
  },
};

function reset(c) {
  c.arms[0].rotation.set(0, 0, 0); c.arms[1].rotation.set(0, 0, 0);
  c.head.rotation.set(0, 0, 0);
  c.body.rotation.set(0, 0, 0);
  c.body.position.y = 0;
}

export function act(char, kind) {
  if (!running) {
    running = true;
    addTicker(dt => {
      t += dt;
      for (const [c, s] of actors) KINDS[s.kind](c, s, t);
    });
  }
  const prev = actors.get(char);
  if (prev) reset(char);
  if (!kind) { actors.delete(char); return; }
  actors.set(char, { kind, ph: prev?.ph ?? Math.random() * 6 });
}

export function stopActing() {
  for (const c of actors.keys()) reset(c);
  actors.clear();
}
