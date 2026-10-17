// Keyboard + touch input. Movement is a 2D axis (x = right, z = down/south);
// "action" is E / Space / Enter / the big touch button.

const keys = new Set();
const joy = { x: 0, z: 0, id: null };
let actionQueued = false;
let actionHeld = false;

const ACTION_KEYS = ['KeyE', 'Space', 'Enter', 'NumpadEnter'];

export function initInput() {
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys.add(e.code);
    if (ACTION_KEYS.includes(e.code)) {
      if (!e.repeat) actionQueued = true;
      actionHeld = true;
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => {
    keys.delete(e.code);
    if (ACTION_KEYS.includes(e.code)) actionHeld = false;
  });
  addEventListener('blur', () => { keys.clear(); actionHeld = false; });

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) {
    document.body.classList.add('touch');
    document.getElementById('touch').classList.remove('hidden');
  }

  const pad = document.getElementById('joy');
  const knob = document.getElementById('joy-knob');
  const R = 45;
  const move = e => {
    const r = pad.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    joy.x = dx / R; joy.z = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  pad.addEventListener('pointerdown', e => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); move(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === joy.id) move(e); });
  const end = e => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = 0; joy.z = 0; knob.style.transform = '';
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);

  const act = document.getElementById('act-btn');
  act.addEventListener('pointerdown', e => { e.preventDefault(); actionQueued = true; actionHeld = true; });
  act.addEventListener('pointerup', () => { actionHeld = false; });
  act.addEventListener('pointerleave', () => { actionHeld = false; });
}

export function axis() {
  let x = 0, z = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  x += joy.x; z += joy.z;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  return { x, z, len: Math.min(1, len) };
}

export function takeAction() {
  const a = actionQueued;
  actionQueued = false;
  return a;
}

export function queueAction() { actionQueued = true; }
export function clearAction() { actionQueued = false; }
export function isActionHeld() { return actionHeld; }
export function setActionHeld(v) { actionHeld = v; }
export function keyDown(code) { return keys.has(code); }

export function setActionLabel(text) {
  document.getElementById('act-btn').textContent = text || 'E';
}
