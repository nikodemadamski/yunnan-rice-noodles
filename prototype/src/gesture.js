// Touch/mouse gesture tracking for cooking scenes, in canvas logical units.
// Rules and tolerances follow docs/design/DAY1_COOKING.md (Cooking Mama-style
// generous input: detect direction and speed, not exact paths).

export class Pointer {
  constructor(canvas, W, H) {
    this.canvas = canvas; this.W = W; this.H = H;
    this.down = false; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.speed = 0;
    this.downAt = 0; this.downX = 0; this.downY = 0; this.travel = 0;
    this.lastMove = performance.now();
    this.idleSince = performance.now();
    this.queue = [];
    this._t = performance.now();
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    this.onDown = e => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const p = pos(e);
      Object.assign(this, { down: true, x: p.x, y: p.y, downX: p.x, downY: p.y, downAt: performance.now(), travel: 0, vx: 0, vy: 0, speed: 0 });
      this._t = performance.now();
      this.queue.push({ type: 'down', x: p.x, y: p.y });
    };
    this.onMove = e => {
      const p = pos(e);
      const now = performance.now();
      const dt = Math.max(1, now - this._t) / 1000;
      const ivx = (p.x - this.x) / dt, ivy = (p.y - this.y) / dt;
      if (this.down) {
        this.vx += (ivx - this.vx) * 0.3;              // EMA smoothing, α≈0.3
        this.vy += (ivy - this.vy) * 0.3;
        this.speed = Math.hypot(this.vx, this.vy);
        this.travel += Math.hypot(p.x - this.x, p.y - this.y);
      }
      this.x = p.x; this.y = p.y; this._t = now; this.lastMove = now;
    };
    this.onUp = e => {
      if (!this.down) return;
      const p = pos(e);
      const ms = performance.now() - this.downAt;
      const dx = p.x - this.downX, dy = p.y - this.downY;
      this.down = false;
      this.idleSince = performance.now();
      this.queue.push({ type: 'up', x: p.x, y: p.y, ms, dx, dy });
      if (ms < 250 && this.travel < 12) this.queue.push({ type: 'tap', x: p.x, y: p.y });
      if (ms < 300 && Math.hypot(dx, dy) >= 80) this.queue.push({ type: 'swipe', dx, dy, angle: Math.atan2(dy, dx) });
      this.speed = 0;
    };
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
  }

  /** Events since the last poll: down / up / tap / swipe. */
  poll() { const q = this.queue; this.queue = []; return q; }

  /** Seconds since the last touch ended (0 while touching). */
  idle() { return this.down ? 0 : (performance.now() - this.idleSince) / 1000; }

  heldFor() { return this.down ? (performance.now() - this.downAt) / 1000 : 0; }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }
}

/** Circle-stir around (cx, cy): accumulates signed laps while the pointer is in the ring. */
export class Circler {
  constructor(cx, cy, R) { this.cx = cx; this.cy = cy; this.R = R; this.last = null; this.angle = 0; }
  update(p) {
    if (!p.down) { this.last = null; return 0; }
    const dx = p.x - this.cx, dy = p.y - this.cy, d = Math.hypot(dx, dy);
    if (d < this.R * 0.35 || d > this.R * 1.3) { this.last = null; return 0; }
    const a = Math.atan2(dy, dx);
    let da = 0;
    if (this.last !== null) {
      da = a - this.last;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > 1) da = 0;                  // ignore teleports
    }
    this.last = a;
    this.angle += Math.abs(da);
    return Math.abs(da) / (Math.PI * 2);             // laps added this frame
  }
  get laps() { return this.angle / (Math.PI * 2); }
}

/** Back-and-forth scrubbing on one axis: counts reversals at least `amp` apart within 300 ms. */
export class Scrubber {
  constructor(axis = 'x', amp = 25) { this.axis = axis; this.amp = amp; this.dir = 0; this.anchor = null; this.lastRev = 0; this.count = 0; }
  update(p) {
    if (!p.down) { this.anchor = null; this.dir = 0; return 0; }
    const v = p[this.axis];
    if (this.anchor === null) { this.anchor = v; return 0; }
    const d = v - this.anchor;
    const dir = Math.sign(d);
    if (Math.abs(d) >= this.amp && dir !== 0 && dir !== this.dir) {
      const now = performance.now();
      const ok = this.dir === 0 || now - this.lastRev < 600;
      this.dir = dir; this.anchor = v; this.lastRev = now;
      if (ok) { this.count++; return 1; }
    } else if (dir === this.dir) {
      this.anchor = this.dir > 0 ? Math.max(this.anchor, v) : Math.min(this.anchor, v);
    }
    return 0;
  }
}

export const near = (p, x, y, r) => Math.hypot(p.x - x, p.y - y) <= r;
