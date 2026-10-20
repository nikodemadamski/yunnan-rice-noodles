// Automated playtester: plays the game on an emulated iPhone 13 with REAL input
// (CDP touch events at on-screen CSS pixels: taps, drags with intermediate
// moves, holds, the on-screen joystick). It reads state through the test hooks
// (window.__shop2d, __cook, __game) only to decide WHAT to do, the way a player
// reads the screen. Measures console/page errors, rAF frame times, long tasks,
// JS heap growth, CPU hot spots (sampling profiler), and flags stuck states.
//
//   NODE_PATH=/opt/node22/lib/node_modules node tools/playtest.cjs [shop|story|town|slow|all] [--out DIR] [--scenes opening,day2,...]
//
// `all` = shop + slow (the shop again with CDP CPU throttling ×4) + story + town.
// Writes DIR/report.json, DIR/report.md and JPG screenshots (default: design/playtest).
// Needs the dev server on :8765; it is started (and restarted) if it is down.
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');

const PROTO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const POS = []; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { i++; continue; } POS.push(argv[i]); }
const WHAT = (POS[0] || 'all').toLowerCase();
const OUT = path.resolve(opt('--out', path.join(PROTO, '..', 'design', 'playtest')));
const SCENES = (opt('--scenes', 'opening,day2,evening,live,chilli,taste')).split(',');
const STUCK_S = +opt('--stuck', 20);
const DPR = opt('--dpr', null);
const WATCH = +opt('--watch', 8);   // game-seconds to watch each cutscene before tapping Skip ⏭ (0 = never skip)       // 3D scenes default to DPR 1: SwiftShader draws the town at ~1 fps at DPR 3
const BASE = 'http://localhost:8765/';
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ------------------------------------------------------------ dev server
function ping() { return new Promise(r => { const q = http.get(BASE, res => { res.resume(); r(res.statusCode === 200); }); q.on('error', () => r(false)); q.setTimeout(2000, () => { q.destroy(); r(false); }); }); }
async function ensureServer() {
  if (await ping()) return;
  log('dev server down: starting python3 -m http.server 8765');
  spawn('python3', ['-m', 'http.server', '8765'], { cwd: PROTO, detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 20; i++) { await sleep(300); if (await ping()) return; }
  throw new Error('could not start the dev server on :8765');
}

// ------------------------------------------------------------ in-page probe
const PROBE = () => {
  const pt = window.__pt = { frames: [], long: [], downAt: 0, gameT: 0, nFrames: 0 };
  let last = 0;
  const raf = window.requestAnimationFrame.bind(window);
  // gameT mirrors the game's own clock: every loop clamps dt to 50 ms, so below 20 fps the game runs in slow motion
  const f = t => { if (last) { pt.frames.push(t - last); pt.gameT += Math.min(0.05, (t - last) / 1000); } pt.nFrames++; last = t; raf(f); };
  raf(f);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) pt.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { pt.noLongtask = String(e); }
  addEventListener('pointerdown', () => { pt.downAt = performance.now(); }, true);
  pt.take = () => { const r = { frames: pt.frames, long: pt.long, heap: performance.memory ? performance.memory.usedJSHeapSize : null }; pt.frames = []; pt.long = []; return r; };
};

// ------------------------------------------------------------ report model
const report = { started: new Date().toISOString(), device: 'iPhone 13 (Playwright device: 390×664 CSS px, DPR 3, touch, iOS UA) on Chromium + SwiftShader', scenarios: [] };
let SC = null;   // current scenario record
function newScenario(name, note = '') {
  SC = { name, note, t0: now(), ok: true, checks: [], issues: [], shots: [], segments: [], errors: [], hot: [], timeline: [] };
  report.scenarios.push(SC);
  return SC;
}
function check(name, ok, detail = '') { SC.checks.push({ name, ok: !!ok, detail }); if (!ok) SC.ok = false; log(ok ? 'PASS' : 'FAIL', name, detail); }
function note(s) { SC.timeline.push(`${((now() - SC.t0) / 1000).toFixed(0)}s ${s}`); log(' ·', s); }
let shotN = 0;
async function shot(page, label) {
  const f = `${SC.name}-${String(++shotN).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.jpg`;
  try { await page.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 80 }); } catch (e) { note(`screenshot failed: ${e.message}`); return null; }
  SC.shots.push({ f, label });
  return f;
}
async function issue(page, sev, title, detail = '', state = null) {
  const key = `${sev}|${title}`;
  if (SC.issues.some(i => i.key === key)) { SC.issues.find(i => i.key === key).count++; return; }
  const f = page ? await shot(page, `ISSUE-${title}`) : null;
  SC.issues.push({ key, sev, title, detail, shot: f, state, count: 1 });
  log(`ISSUE [${sev}]`, title, detail);
}

// ------------------------------------------------------------ stats
function stats(frames, long, heap0, heap1, label) {
  const a = frames.filter(x => x > 0 && x < 5000).sort((x, y) => x - y);
  const q = p => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
  const sum = a.reduce((s, x) => s + x, 0);
  return {
    label, frames: a.length, seconds: +(sum / 1000).toFixed(1), fps: a.length ? +(1000 * a.length / sum).toFixed(1) : 0,
    median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), over33: a.length ? +(100 * a.filter(x => x > 33.4).length / a.length).toFixed(1) : 0,
    longest: +(a[a.length - 1] || 0).toFixed(0), longTasks: long.length, longTaskMs: long.reduce((s, x) => s + x[1], 0), longestTask: long.reduce((m, x) => Math.max(m, x[1]), 0),
    heapMB0: heap0 != null ? +(heap0 / 1048576).toFixed(1) : null, heapMB1: heap1 != null ? +(heap1 / 1048576).toFixed(1) : null,
  };
}
async function segment(page, label, heap0) {
  const r = await page.evaluate(() => window.__pt.take()).catch(() => null);
  if (!r) return null;
  const s = stats(r.frames, r.long, heap0, r.heap, label);
  SC.segments.push(s);
  log(`frames[${label}] n=${s.frames} fps=${s.fps} median=${s.median}ms p95=${s.p95}ms >33ms=${s.over33}% longest=${s.longest}ms longtasks=${s.longTasks} heap ${s.heapMB0}→${s.heapMB1}MB`);
  return r.heap;
}

// ------------------------------------------------------------ CPU profile → hot functions
async function profile(cdp, ms) {
  try {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await sleep(ms);
    const { profile: p } = await cdp.send('Profiler.stop');
    const byId = new Map(p.nodes.map(n => [n.id, n])), self = new Map();
    const dts = p.timeDeltas || [];
    p.samples.forEach((id, i) => { self.set(id, (self.get(id) || 0) + (dts[i] || 0)); });
    const agg = new Map(); let total = 0;
    for (const [id, us] of self) {
      const n = byId.get(id), c = n.callFrame; total += us;
      const file = (c.url || '').replace(BASE, '').replace(/^.*\/vendor\//, 'vendor/');
      const k = c.functionName === '(idle)' || c.functionName === '(program)' || c.functionName === '(garbage collector)' ? c.functionName : `${c.functionName || '(anon)'} ${file}:${c.lineNumber + 1}`;
      agg.set(k, (agg.get(k) || 0) + us);
    }
    return [...agg].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, us]) => ({ fn: k, ms: Math.round(us / 1000), pct: +(100 * us / total).toFixed(1) }));
  } catch (e) { return [{ fn: `profile failed: ${e.message}`, ms: 0, pct: 0 }]; }
}

// ------------------------------------------------------------ browser + real input
let browser;
async function openPage(url, { cpu = 1, dpr = 3 } = {}) {
  await ensureServer();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: +(DPR || dpr) });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  page.on('pageerror', e => { SC.errors.push(`pageerror: ${e.message}`); log('PAGEERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text()) && !/Failed to load resource: the server responded with a status of 4/.test(m.text())) { SC.errors.push(`console.error: ${m.text()}`); log('CONSOLE.ERROR', m.text()); } });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) SC.errors.push(`http ${r.status()}: ${r.url().replace(BASE, '/')}`); });
  page.on('requestfailed', r => { if (!/favicon/.test(r.url())) SC.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  await page.goto(BASE + url);
  const T = touchKit(page, cdp);
  return { ctx, page, cdp, T };
}
function touchKit(page, cdp) {
  const pt = (x, y, id = 0) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, id, radiusX: 6, radiusY: 6, force: 1 });
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const K = {
    async tap(x, y) { await send('touchStart', [pt(x, y)]); await sleep(60); await send('touchEnd', []); },
    async down(x, y) { await send('touchStart', [pt(x, y)]); },
    async move(x, y) { await send('touchMove', [pt(x, y)]); },
    async up() { await send('touchEnd', []); },
    async drag(a, b, { steps = 12, ms = 480, hold = 80 } = {}) {
      await send('touchStart', [pt(a.x, a.y)]); await sleep(hold);
      for (let i = 1; i <= steps; i++) { const k = i / steps; await send('touchMove', [pt(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)]); await sleep(ms / steps); }
      await sleep(60); await send('touchEnd', []);
    },
    // a DOM element, tapped where a finger would land; reports what's really under that point
    async tapEl(sel, { label = sel, scroll = true } = {}) {
      const info = await page.evaluate(([sel, scroll]) => {
        const el = typeof sel === 'string' ? document.querySelector(sel) : null;
        if (!el) return { missing: true };
        let r = el.getBoundingClientRect();
        const off = r.bottom > innerHeight || r.top < 0 || r.right > innerWidth || r.left < 0;
        return { off, r: { x: r.x, y: r.y, w: r.width, h: r.height }, vw: innerWidth, vh: innerHeight };
      }, [sel, scroll]);
      if (info.missing) return { ok: false, why: 'missing' };
      let r = info.r;
      if (info.off && scroll) {
        // a finger scrolls the card: swipe up inside the nearest scroll container
        const sc = await page.evaluate(sel => { let e = document.querySelector(sel); while (e && e !== document.body) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2) { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y0: Math.min(innerHeight - 20, b.bottom - 30), y1: Math.max(20, b.top + 30), top: e.scrollTop }; } e = e.parentElement; } return null; }, sel);
        if (sc) {
          for (let k = 0; k < 4; k++) {
            await K.drag({ x: sc.x, y: sc.y0 }, { x: sc.x, y: sc.y1 }, { steps: 10, ms: 260, hold: 20 }); await sleep(400);
            r = await page.evaluate(sel => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b && { x: b.x, y: b.y, w: b.width, h: b.height }; }, sel);
            if (r && r.y + r.h <= info.vh && r.y >= 0) break;
          }
        }
        if (r && r.y + r.h <= info.vh && r.y >= 0) SC.scrolled = Object.assign(SC.scrolled || {}, { [label]: (SC.scrolled?.[label] || 0) + 1 });
        if (!r || r.y + r.h > info.vh || r.y < 0) { SC && issue(page, 'major', `Button off-screen: ${label}`, `"${label}" is outside the 390×664 viewport and could not be scrolled into view by a finger swipe (rect ${JSON.stringify(info.r)}).`); return { ok: false, why: 'offscreen' }; }
      }
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const hit = await page.evaluate(([sel, cx, cy]) => { const el = document.querySelector(sel), h = document.elementFromPoint(cx, cy); return { ok: !!(el && h && (el === h || el.contains(h))), hit: h ? `${h.tagName.toLowerCase()}${h.id ? '#' + h.id : ''}${h.className && typeof h.className === 'string' ? '.' + h.className.split(' ').join('.') : ''}` : null }; }, [sel, cx, cy]);
      if (!hit.ok) { SC && issue(page, 'major', `Covered button: ${label}`, `The centre of "${label}" (${cx.toFixed(0)},${cy.toFixed(0)}) is covered by ${hit.hit}; a finger tap lands on that instead.`); }
      if (r.w < 40 || r.h < 34) SC.small = Object.assign(SC.small || {}, { [label]: `${r.w.toFixed(0)}×${r.h.toFixed(0)}` });
      await K.tap(cx, cy);
      return { ok: true, covered: !hit.ok };
    },
  };
  return K;
}

// ------------------------------------------------------------ stuck detector
function stuckWatch(page, sigFn, { secs = STUCK_S, quiet = () => false } = {}) {
  // "stuck" = no visible state change for `secs` of GAME time (the clamped clock), so a slow
  // software renderer doesn't cry wolf; at >= 20 fps game time equals wall time
  let last = null, since = 0, flagged = 0;
  return async function poll(ctxLabel = '') {
    let sig, gt;
    try { [sig, gt] = await page.evaluate(src => [eval(`(${src})`)(), window.__pt.gameT], sigFn.toString()); } catch (e) { return 0; }
    const s = JSON.stringify(sig);
    if (s !== last) { last = s; since = gt; flagged = 0; return 0; }
    const idle = gt - since;
    if (idle > secs && !flagged && !(await quiet())) {
      flagged = 1;
      await issue(page, 'major', `Stuck ${secs}s+${ctxLabel ? ': ' + ctxLabel : ''}`, `No visible state change for ${idle.toFixed(0)} s of game time.`, sig);
    }
    return idle;
  };
}

// =====================================================================
// SHOP: play a night with the in-game guide, real touch only
// =====================================================================
const TABS = { portrait: { x: 195, y: 14, w: 160, h: 56, gap: 175 }, landscape: { x: 560, y: 14, w: 160, h: 56, gap: 170 } };   // shop2d.js H.tabs (not exposed)
const VIEWS = ['order', 'stove', 'build'];
const SHOP_READ = () => {
  const h = window.__shop2d, L = window.__shop2dLayout;
  if (!h || !document.querySelector('canvas.shop2d')) return null;
  const { S, st } = h;
  const VW = L.VW, VH = L.VH, iw = innerWidth, ih = innerHeight;
  const scale = Math.min(iw / VW, ih / VH), ox = (iw - VW * scale) / 2, oy = (ih - VH * scale) / 2;
  const xy = p => p && { x: p.x, y: p.y };
  const sel = S.tickets.find(t => t.uid === st.selected && !t.served);
  const probe = h.toClient(VW * 2 + 100, 200);
  return {
    VW, VH, scale, ox, oy, portrait: iw / ih < 0.85, view: st.view, camX: st.camX, idleT: st.idleT,
    step: st.step ? { view: st.step.view, kind: st.step.kind, word: st.step.word, part: st.step.part, at: xy(st.step.at), from: xy(st.step.from) } : null,
    bubble: st.bubble ? { ok: st.bubble.ok, what: st.bubble.what, used: !!st.bubble.what.used, lines: st.bubble.lines.join(' ') } : null,
    react: st.react ? { t: st.react.t, pts: st.react.res.points } : null, money: st.money, tips: S.tips, results: S.results.map(r => ({ who: r.who, points: r.points, tip: r.tip })),
    sel: sel ? { uid: sel.uid, fill: sel.fill, fat: !!sel.fat, parts: [...sel.parts], noodles: sel.noodles, ask: sel.ask.say } : null,
    tickets: S.tickets.filter(t => !t.served).map(t => t.uid), nTickets: S.tickets.length,
    baskets: S.baskets.map(b => b.ticket ? `${b.ticket}:${b.t.toFixed(1)}` : '-'),
    guests: S.guests.map(g => `${g.who}:${g.state}:${Math.round(g.patience)}`), pending: S.schedule.filter(e => !e.arrived).length, time: S.time,
    caption: st.caption, captionT: st.captionT,
    mapCheck: { mine: { x: ox + (VW * 2 + 100 - st.camX) * scale, y: oy + 200 * scale }, hook: probe },
    card: !!document.querySelector('.night-card'),
  };
};
const shopSig = () => { const h = window.__shop2d; if (!h || !document.querySelector('canvas.shop2d')) return { card: !!document.querySelector('.night-card'), rules: !!document.querySelector('.svc-rules') }; const { S, st } = h; return { v: st.view, sel: st.selected, r: S.results.length, m: st.money, react: !!st.react, b: !!st.bubble, tk: S.tickets.map(t => [t.uid, Math.round(t.fill * 20), t.fat, t.parts.length, t.noodles !== null, t.served]), bs: S.baskets.map(b => b.ticket), g: S.guests.map(g => g.state), x: Math.round(st.camX / 50) }; };

async function playShop(P, { label = 'shop', budgetS = 900, firstWhat = true, swipeOnce = true } = {}) {
  const { page, T } = P;
  const R = () => page.evaluate(SHOP_READ);
  const V = (s, x, y, world = true) => ({ x: s.ox + (x - (world ? VIEWS.indexOf(s.view) * s.VW : 0)) * s.scale, y: s.oy + y * s.scale });   // virtual → CSS px (shop2d.js resize/toV)
  const FILL = await page.evaluate(() => import('/src/shopdata.js').then(m => m.FILL));
  const stuck = stuckWatch(page, shopSig, { quiet: async () => { const s = await R(); return s && !s.step && !s.bubble && s.pending > 0; } });
  const t0 = now(); let mapped = false, whatDone = !firstWhat, swiped = !swipeOnce, lastStepKey = '', stepTries = 0;
  const seen = new Set(); const moneySeries = [];
  const miss = async (what, detail) => { await issue(page, 'major', `Input miss: ${what}`, detail); };
  while (now() - t0 < budgetS * 1000) {
    await stuck(label);
    const s = await R();
    if (!s) { if (await page.$('.night-card')) break; await sleep(400); continue; }
    if (s.card) break;
    if (!mapped) {
      mapped = true;
      const d = Math.hypot(s.mapCheck.mine.x - s.mapCheck.hook.x, s.mapCheck.mine.y - s.mapCheck.hook.y);
      check(`${label}: virtual→CSS mapping matches the game's (toClient)`, d < 1, `Δ=${d.toFixed(2)}px scale=${s.scale.toFixed(3)} ox=${s.ox.toFixed(1)} oy=${s.oy.toFixed(1)} portrait=${s.portrait}`);
      const tabPx = TABS.portrait.h * s.scale, tabW = TABS.portrait.w * s.scale;
      SC.small = Object.assign(SC.small || {}, { 'shop tab (Order/Stove/Build)': `${tabW.toFixed(0)}×${tabPx.toFixed(0)}`, 'shop Okay/What? buttons': `${(170 * s.scale).toFixed(0)}×${(70 * s.scale).toFixed(0)}`, 'shop ticket': `${(110 * s.scale).toFixed(0)}×${(120 * s.scale).toFixed(0)}` });
    }
    if (moneySeries[moneySeries.length - 1] !== s.money) moneySeries.push(s.money);
    if (s.react) {
      if (!seen.has('react' + s.results.length) && s.react.t > 2.0) { seen.add('react' + s.results.length); await shot(page, `${label}-verdict-${s.results.length}`); }
      await sleep(250); continue;
    }
    if (!s.step) { await sleep(400); continue; }
    const st = s.step, key = `${st.kind}:${st.word}:${s.sel?.uid}`;
    if (key === lastStepKey && st.kind !== 'wait') stepTries++; else if (key !== lastStepKey) { lastStepKey = key; stepTries = 0; }
    if (stepTries > 6) { await miss(`step "${st.word}" never completes`, `Tried ${stepTries}× with real touches; state: ${JSON.stringify({ view: s.view, step: st, sel: s.sel })}`); await sleep(1500); if (stepTries > 12) break; }
    // the guide says the next thing is on another panel: tap its tab (or swipe once)
    if (st.view !== s.view) {
      const from = VIEWS.indexOf(s.view), to = VIEWS.indexOf(st.view);
      if (!swiped && Math.abs(to - from) === 1) {
        swiped = true;
        const y = s.oy + (s.VH - 46) * s.scale, x0 = s.ox + s.VW * s.scale * (to > from ? 0.8 : 0.2), x1 = s.ox + s.VW * s.scale * (to > from ? 0.2 : 0.8);
        await T.drag({ x: x0, y }, { x: x1, y }, { steps: 8, ms: 220, hold: 10 });
        await sleep(300);
        const v = (await R())?.view;
        check(`${label}: a horizontal swipe changes panel (${s.view}→${st.view})`, v === st.view, `view after swipe: ${v}`);
      } else {
        const tb = TABS[s.portrait ? 'portrait' : 'landscape'];
        const c = V(s, tb.x + to * tb.gap + tb.w / 2, tb.y + tb.h / 2, false);
        await T.tap(c.x, c.y); await sleep(250);
        const v = (await R())?.view;
        if (v !== st.view) await miss(`tab "${st.view}"`, `Tapped the ${st.view} tab at (${c.x.toFixed(0)},${c.y.toFixed(0)}) but the view is ${v}.`);
      }
      // wait for the camera slide to settle before touching the panel
      for (let i = 0; i < 30; i++) { const q = await R(); if (!q || Math.abs(q.camX - VIEWS.indexOf(q.view) * q.VW) < 3) break; await sleep(100); }
      continue;
    }
    if (!seen.has(st.kind + st.word.split(':')[0]) && seen.size < 40) { seen.add(st.kind + st.word.split(':')[0]); await sleep(1300); await shot(page, `${label}-${st.kind}-${st.word}`); }   // let the ghost glove show, as a hesitating player sees it
    const before = s;
    if (st.kind === 'tap') {
      // the first customer: ask "What?" once, like a new player would
      if (!whatDone && s.bubble && st.word === 'Take the order') {
        whatDone = true;
        const w = V(s, s.bubble.what.x + s.bubble.what.w / 2, s.bubble.what.y + s.bubble.what.h / 2);
        await T.tap(w.x, w.y); await sleep(500);
        const q = await R();
        check(`${label}: "What?" explains the order`, q.bubble?.used, q.bubble?.lines?.slice(0, 120));
        await shot(page, `${label}-what-hint`);
        continue;
      }
      const c = V(s, st.at.x, st.at.y);
      await T.tap(c.x, c.y); await sleep(450);
      const q = await R();
      let ok = true;
      if (st.word === 'Take the order') ok = q.nTickets > before.nTickets;
      else if (/Lift/.test(st.word)) ok = q.baskets.join() !== before.baskets.join();
      else if (/oil/.test(st.word)) ok = q.sel?.fat || q.sel?.uid !== before.sel?.uid;
      else if (st.word === 'Serve it!') ok = q.results.length > before.results.length || !!q.react;
      if (!ok) await miss(`tap "${st.word}"`, `Real tap at (${c.x.toFixed(0)},${c.y.toFixed(0)}) on ${s.view} didn't register. Caption: ${q.caption}`);
      else if (st.word === 'Serve it!') note(`served ${before.sel?.uid}: ${JSON.stringify(q.results[q.results.length - 1] || {})}`);
    } else if (st.kind === 'drag') {
      const a = V(s, st.from.x, st.from.y), b = V(s, st.at.x, st.at.y);
      await T.drag(a, b); await sleep(450);
      const q = await R();
      const ok = st.part === 'noodles' && st.view === 'stove' ? q.baskets.join() !== before.baskets.join() : (q.sel?.parts.length || 0) > (before.sel?.parts.length || 0) || q.sel?.uid !== before.sel?.uid;
      if (!ok) await miss(`drag "${st.word}"`, `Drag ${JSON.stringify(a)}→${JSON.stringify(b)} didn't add ${st.part}. Caption: ${q.caption}`);
    } else if (st.kind === 'hold') {
      const c = V(s, st.at.x, st.at.y), goal = (FILL.lo + FILL.hi) / 2;
      await T.down(c.x, c.y);
      const h0 = now(); let f = before.sel?.fill || 0;
      while (now() - h0 < 25000) { await sleep(70); const q = await page.evaluate(() => { const { S, st } = window.__shop2d; return S.tickets.find(t => t.uid === st.selected)?.fill ?? 1; }); f = q; if (f >= goal) break; }
      if (!SC.cancelTested) {
        // iOS cancels touches (edge swipe, notification shade, incoming call): the pour must stop
        SC.cancelTested = true;
        await P.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await sleep(900);
        const q = await page.evaluate(() => ({ pouring: window.__shop2d.st.pouring, fill: window.__shop2d.S.tickets.find(t => t.uid === window.__shop2d.st.selected)?.fill }));
        check(`${label}: a cancelled touch (touchcancel) stops the pour`, !q.pouring, `after touchcancel: pouring=${q.pouring}, fill ${f.toFixed(2)} → ${q.fill?.toFixed(2)}`);
        if (q.pouring) { await issue(page, 'major', 'touchcancel leaves the ladle pouring', 'shop2d.js only listens for pointerup; after a pointercancel st.pouring stays true and the bowl overflows until the next tap.'); const c2 = V(s, s.VW / 2, s.VH - 46, false); await T.tap(c2.x, c2.y); }
      } else await T.up();
      await sleep(350);
      f = await page.evaluate(() => { const { S, st } = window.__shop2d; return S.tickets.find(t => t.uid === st.selected)?.fill ?? 1; });
      if (f < FILL.lo) await miss('hold to pour', `Held the stockpot ${(now() - h0) / 1000}s; fill only ${f.toFixed(2)}.`);
      else if (f > FILL.hi) await issue(page, 'minor', 'Pour overshoot', `Released at fill ${f.toFixed(2)} (> ${FILL.hi}) even polling every ~70 ms: the pour rate is tight at low fps.`);
    } else await sleep(500);
  }
  const s = await R();
  // the end card
  let card = null;
  for (let i = 0; i < 40 && !card; i++) { card = await page.evaluate(() => { const c = document.querySelector('.night-card'); return c && { text: c.innerText.slice(0, 400), guests: c.querySelectorAll('.night-guests span').length, coins: c.querySelector('.k-total')?.textContent }; }); if (!card) await sleep(500); }
  return { card, moneySeries, last: s, seconds: (now() - t0) / 1000 };
}

async function scenarioShop({ cpu = 1, name = 'shop' } = {}) {
  newScenario(name, cpu > 1 ? `Same night with CDP Emulation.setCPUThrottlingRate(${cpu}) to approximate a slower phone.` : 'One full night at #shop on iPhone 13, following the in-game guide with real touch.');
  const P = await openPage('#shop', { cpu });
  const { page, T, cdp } = P;
  let heap = null;
  try {
    await page.waitForSelector('.svc-rules [data-go]', { timeout: 60000 });
    await sleep(800); await shot(page, 'rules-card');
    heap = await segment(page, 'load+rules', null);
    const r = await T.tapEl('.svc-rules [data-go]', { label: 'Open the hatch' });
    check(`${name}: rules card button tappable`, r.ok);
    await page.waitForFunction(() => window.__shop2d && document.querySelector('canvas.shop2d'), null, { timeout: 30000 });
    const prof = (async () => { await sleep(15000); SC.hot = await profile(cdp, 12000); })();
    const res = await playShop(P, { label: name, firstWhat: cpu === 1, swipeOnce: cpu === 1 });
    await prof;
    heap = await segment(page, 'night', heap);
    await shot(page, 'night-card');
    const results = res.last?.results || [];
    check(`${name}: all 7 guests served`, results.length === 7, JSON.stringify(results));
    check(`${name}: money rises through the night`, res.moneySeries.length > 2 && res.moneySeries.every((m, i, a) => i === 0 || m >= a[i - 1]) && res.moneySeries[res.moneySeries.length - 1] > 0, `¥ series ${res.moneySeries.join('→')}`);
    check(`${name}: end card appears`, !!res.card, res.card ? res.card.text.replace(/\s+/g, ' ').slice(0, 160) : 'no .night-card');
    const avg = results.length ? Math.round(results.reduce((a, r) => a + r.points, 0) / results.length) : 0;
    SC.result = { avgPoints: avg, results, tips: res.last?.tips, money: res.last?.money, seconds: Math.round(res.seconds) };
    note(`night done in ${res.seconds.toFixed(0)} s, avg ${avg} pts`);
    if (res.card) {
      const c = await T.tapEl('#k-done', { label: 'Close up' });
      await sleep(3000);
      check(`${name}: "Close up" returns to the title`, c.ok && !!(await page.$('.title-card')));
    }
  } catch (e) { check(`${name}: ran without exceptions`, false, e.stack.split('\n').slice(0, 3).join(' | ')); await issue(page, 'major', 'Shop scenario aborted', e.message); }
  await segment(page, 'end', heap);
  check(`${name}: zero console/page errors`, SC.errors.length === 0, SC.errors.slice(0, 5).join(' || '));
  await P.ctx.close();
}

// =====================================================================
// navigation (a player who knows the town): grid A* over the colliders
// =====================================================================
function makeNav(cols, r = 1.3) {
  const X0 = -88, N = 176, cell = 1;
  const blocked = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = X0 + (i + 0.5) * cell, z = X0 + (j + 0.5) * cell;
    if (cols.some(c => x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r)) blocked[i * N + j] = 1;
  }
  const idx = (x, z) => [Math.max(0, Math.min(N - 1, Math.floor(x - X0))), Math.max(0, Math.min(N - 1, Math.floor(z - X0)))];
  const free = (i, j) => i >= 0 && j >= 0 && i < N && j < N && !blocked[i * N + j];
  function nearestFree(i, j) { for (let d = 0; d < 12; d++) for (let a = -d; a <= d; a++) for (const [p, q] of [[i + a, j - d], [i + a, j + d], [i - d, j + a], [i + d, j + a]]) if (free(p, q)) return [p, q]; return [i, j]; }
  function los(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d * 2); for (let k = 0; k <= n; k++) { const [i, j] = idx(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n); if (!free(i, j)) return false; } return true; }
  function path(a, b) {
    const [si, sj] = nearestFree(...idx(a.x, a.z)), [gi, gj] = nearestFree(...idx(b.x, b.z));
    const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), open = [[0, si * N + sj]];
    g[si * N + sj] = 0;
    const H = k => Math.hypot(Math.floor(k / N) - gi, (k % N) - gj);
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === gi * N + gj) break;
      const ci = Math.floor(cur / N), cj = cur % N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = ci + di, nj = cj + dj; if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
        const nk = ni * N + nj, ng = g[cur] + (di && dj ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = cur; open.push([ng + H(nk), nk]); }
      }
    }
    const pts = []; let k = gi * N + gj; if (from[k] < 0 && k !== si * N + sj) return [b];
    while (k >= 0) { pts.unshift({ x: X0 + Math.floor(k / N) + 0.5, z: X0 + (k % N) + 0.5 }); k = from[k]; }
    const out = [pts[0]]; let i = 0;                       // string-pull
    while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
    out.push(b);
    return out;
  }
  return { path, blockedAt: (x, z) => !free(...idx(x, z)) };
}

// the on-screen joystick, held by one finger
function joystick(page, T) {
  let c = null, held = false;
  return {
    async center() { c = await page.evaluate(() => { const r = document.getElementById('joy').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, vis: getComputedStyle(document.getElementById('touch')).display !== 'none' && !document.getElementById('touch').classList.contains('hidden') }; }); return c; },
    async push(dx, dz) {      // world direction; camera from the south so screen-down = +z
      if (!c) await this.center();
      const L = Math.hypot(dx, dz) || 1, x = c.x + dx / L * 44, y = c.y + dz / L * 44;
      if (!held) { await T.down(c.x, c.y); held = true; await sleep(30); }
      await T.move(x, y);
    },
    async release() { if (held) { await T.up(); held = false; } },
    get held() { return held; },
  };
}

// =====================================================================
// STORY: an autopilot that reads the screen and answers with real taps
// =====================================================================
const STORY_READ = () => {
  const $ = id => document.getElementById(id);
  const vis = e => !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none';
  const g = window.__game, G = g?.G;
  const panel = $('panel'), dlg = $('dialogue');
  const taste = document.querySelector('.taste:not(.hidden)');
  return {
    dlg: vis(dlg) ? { name: $('dlg-name').textContent, text: $('dlg-text').textContent, done: dlg.classList.contains('done') } : null,
    choices: vis($('choices')) ? [...$('choices').querySelectorAll('button')].map(b => b.textContent) : null,
    panel: vis(panel) ? { html: panel.innerHTML.length, text: panel.innerText.slice(0, 160).replace(/\s+/g, ' '), kind: panel.querySelector('#bag') ? 'bag' : panel.querySelector('#pk-hold') ? 'peek' : panel.querySelector('#ob-list') ? 'board' : panel.querySelector('#duck-go') ? 'duck' : panel.querySelector('#ic-ok') ? 'info' : panel.querySelector('.title-card') ? 'title' : 'other' } : null,
    taste: taste ? { note: !!taste.querySelector('.taste-note.on'), title: taste.querySelector('.taste-title b')?.textContent } : null,
    book: !!document.querySelector('.storybook:not(.out)'),
    rules: !!document.querySelector('.svc-rules'), night: !!document.querySelector('.night-card'),
    shop: !!(window.__shop2d && document.querySelector('canvas.shop2d') && !document.querySelector('.svc-rules')),
    cook: !!(window.__cook && document.querySelector('canvas.shop2d')),
    cookTitle: window.__cook && document.querySelector('canvas.shop2d') ? `${window.__cook.S.title}|${window.__cook.st.step}` : null,
    fade: $('fade').classList.contains('on') ? $('fade-text').textContent : null,
    obj: vis($('objective')) ? $('objective').textContent : null, prompt: vis($('prompt')) ? $('prompt').textContent : null,
    toast: $('toast').textContent, result: vis($('result-pop')) ? $('result-pop').innerText.slice(0, 80) : null,
    G: G ? { busy: G.busy, cine: !!G.flags.cine, cutscene: !!G.flags.cutscene, day: G.day, money: G.money, orders: [...G.ordersDone], run: G.run ? G.run.phase : null, clock: Math.round(G.clock) } : null,
    pos: g ? { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z, speed: g.player.speed, mode: g.player.mode } : null,
    cam: g ? { x: g.W.camera.position.x, y: g.W.camera.position.y, z: g.W.camera.position.z } : null,
    marker: g?.W.markerTarget || null,
    joy: vis($('touch')) && getComputedStyle($('touch')).display !== 'none',
    skipBtn: document.body.classList.contains('cine'),
    gameT: window.__pt.gameT,
  };
};
const storySig = () => {
  const s = window.__ptStoryRead(); const r = v => Math.round(v * 2) / 2;
  const cook = window.__cook?.st; const sh = window.__shop2d;
  return [s.dlg?.text, s.choices, s.panel?.html, s.panel?.text, s.taste, s.book, s.fade, s.obj, s.prompt, s.G?.busy, s.G?.cine, s.pos && [r(s.pos.x), r(s.pos.z)], s.cam && [r(s.cam.x), r(s.cam.y), r(s.cam.z)],
    cook && [cook.step, cook.cubes, cook.laps, cook.noodles, cook.frost, cook.fill, cook.oil, cook.chives?.length, cook.sparklers?.length, cook.lit, cook.alarm, cook.closeUp, cook.viral, cook.leaves?.filter(l => l.in).length], sh && document.querySelector('canvas.shop2d') && [sh.S.results.length, sh.st.view, sh.S.tickets.length], s.night, s.toast];
};

async function cookStep(P, kind) {
  // #live (PromptPal) and #chilli: the verbs each step asks for, with real touches
  const { page, T } = P;
  const s = await page.evaluate(() => {
    const c = window.__cook; if (!c || !document.querySelector('canvas.shop2d')) return null;
    const { S, st, L } = c, l = L();
    const m = (x, y) => ({ x: S.ox + x * S.scale, y: S.oy + y * S.scale });
    return { live: 'viewers' in st, step: st.step, st: JSON.parse(JSON.stringify({ ...st, chat: undefined, hearts: undefined, smoke: undefined, shreds: (st.shreds || []).length, splat: undefined, steam: undefined })),
      pot: l.pot && { ...m(l.pot.x, l.pot.y), r: l.pot.r * S.scale }, spot: l.spot && m(l.spot.x, l.spot.y), bowl: l.bowl && { ...m(l.bowl.x, l.bowl.y), r: l.bowl.r * S.scale },
      jar: l.jar && m(l.jar.x, l.jar.y), leaves: (st.leaves || []).filter(q => !q.in && q.sx !== undefined).map(q => m(q.sx, q.sy)), caption: S.caption, title: S.title, scale: S.scale };
  });
  if (!s) return false;
  const st = s.st;
  if (s.live) {
    if (st.alarm || st.closeUp || st.viral || st.stamp) { await sleep(300); return true; }
    const pot = s.pot;
    if (st.step === 0 || st.step === 3 || (st.step === 5 && st.sparklers.length < st.need)) { await T.drag(s.spot, { x: pot.x, y: pot.y }); await sleep(300); return true; }
    if (st.step === 1) { await T.down(pot.x + pot.r * 0.5, pot.y); for (let k = 1; k <= 48; k++) { const a = k / 48 * Math.PI * 4; await T.move(pot.x + Math.cos(a) * pot.r * 0.5, pot.y + Math.sin(a) * pot.r * 0.5); await sleep(16); } await T.up(); return true; }
    if (st.step === 2) { await T.down(pot.x - pot.r * 0.5, pot.y); for (let k = 1; k <= 16; k++) { await T.move(pot.x + (k % 2 ? 1 : -1) * pot.r * 0.5, pot.y + (k % 3) * 3); await sleep(40); } await T.up(); return true; }
    if (st.step === 4) { if (s.leaves[0]) await T.tap(s.leaves[0].x, s.leaves[0].y); await sleep(200); return true; }
    if (st.step === 5) { await T.drag({ x: pot.x - pot.r, y: pot.y }, { x: pot.x + pot.r, y: pot.y - 10 }, { steps: 6, ms: 120, hold: 10 }); await sleep(300); return true; }
    await sleep(300); return true;
  }
  // Little Chilli's bowl
  const b = s.bowl;
  if (st.frost > 0) { await T.down(b.x, b.y); const h0 = now(); while (now() - h0 < 12000) { await sleep(200); const f = await page.evaluate(() => window.__cook.st.frost); if (f <= 0) break; } await T.up(); return true; }
  if (st.fill < 1) { await T.drag({ x: s.pot.x, y: s.pot.y }, { x: b.x, y: b.y }, { steps: 30, ms: 1600 }); await sleep(400); return true; }
  if (!st.oil && /oil/i.test(s.title)) { await T.down(s.jar.x, s.jar.y); await sleep(700); await T.up(); await sleep(3800); return true; }   // one drop, then hands off
  if (/chives/i.test(s.title) && st.chives.length < 4) { await T.tap(b.x + (Math.random() - 0.5) * 40, b.y + (Math.random() - 0.5) * 40); await sleep(2600); return true; }
  if (/Lift your hands/.test(s.title) && /slurp/i.test(s.caption)) { await T.drag({ x: b.x, y: b.y + 80 }, { x: b.x, y: b.y - 120 }, { steps: 6, ms: 160 }); await sleep(600); return true; }
  await sleep(400); return true;
}

async function bagStep(P) {
  const { page, T } = P;
  const items = await page.evaluate(() => [...document.querySelectorAll('#tray .item')].map((b, i) => ({ i, used: b.classList.contains('used'), sel: b.classList.contains('sel'), rules: b.querySelector('.rule:last-child')?.textContent || '' })));
  const left = items.filter(x => !x.used);
  if (!left.length) {
    const warn = await page.evaluate(() => document.getElementById('bag-warn').innerText.trim());
    if (warn) note(`bag packed with warnings: ${warn.replace(/\s+/g, ' ')}`);
    await shot(page, 'bag-packed');
    await T.tapEl('#b-go', { label: 'Ride! (bag)' }); return;
  }
  const rank = r => /Heavy/.test(r) ? 0 : /No fuss/.test(r) ? 1 : /Fragile/.test(r) ? 2 : 3;
  left.sort((a, b) => rank(a.rules) - rank(b.rules));
  const it = left[0];
  await P.page.evaluate(i => document.querySelectorAll('#tray .item')[i].setAttribute('data-pt', 'it'), it.i);
  await T.tapEl('#tray .item[data-pt="it"]', { label: 'bag tray item' });
  await page.evaluate(() => document.querySelectorAll('[data-pt]').forEach(e => e.removeAttribute('data-pt')));
  for (const x of [0, 1, 2, 3, 0]) {
    await T.tapEl(`#bag .cell[data-x="${x}"]`, { label: 'bag column' }); await sleep(250);
    const used = await page.evaluate(i => document.querySelectorAll('#tray .item')[i].classList.contains('used'), it.i);
    if (used) return;
  }
  await T.tapEl('#b-undo', { label: 'Undo (bag)' });
}

async function navStep(P, nav, joy, s, target, r = 2.5) {
  // steer one finger on the joystick along an A* path to `target`
  const st = P.nav || (P.nav = { path: null, to: null, t: 0, lastPos: null, stall: 0 });
  if (!st.path || !st.to || Math.hypot(st.to.x - target.x, st.to.z - target.z) > 1.5 || now() - st.t > 8000) { st.path = nav.path(s.pos, target); st.to = target; st.t = now(); }
  while (st.path.length > 1 && Math.hypot(st.path[0].x - s.pos.x, st.path[0].z - s.pos.z) < (s.pos.mode === 'bike' ? 3.2 : 1.6)) st.path.shift();
  const wp = st.path[0];
  let dx = wp.x - s.pos.x, dz = wp.z - s.pos.z;
  if (st.lastPos && Math.hypot(s.pos.x - st.lastPos.x, s.pos.z - st.lastPos.z) < 0.15) st.stall++; else st.stall = 0;
  st.lastPos = { x: s.pos.x, z: s.pos.z };
  if (st.stall > 6) { [dx, dz] = [-dz + dx * 0.2, dx + dz * 0.2]; st.path = null; }   // wiggle off a corner
  await joy.push(dx, dz);
}

async function storyScene(P, scene, { budgetS }) {
  const { page, T } = P;
  await page.evaluate(src => { window.__ptStoryRead = eval(src); }, `(${STORY_READ.toString()})`);
  const R = () => page.evaluate(() => window.__ptStoryRead());
  const cols = await page.evaluate(() => window.__game.W.colliders.map(c => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, tag: c.tag })));
  const nav = makeNav(cols);
  const joy = joystick(page, T);
  const stuck = stuckWatch(page, storySig, { secs: STUCK_S });
  const t0 = now(), g0 = await page.evaluate(() => window.__pt.gameT); let cineT = null, skips = 0; const seenLines = new Set(); let lastLine = '', lastLineT = now(), dlgTaps = 0, dlgAdv = 0, asks = 0, lastShotKey = '', choiceN = 0;
  const done = s => {
    if (['live', 'chilli', 'taste', 'opening'].includes(scene)) return /Scene finished/.test(s.toast);
    if (scene === 'day2') return /Evening/.test(s.fade || '');
    if (scene === 'evening') return s.panel?.kind === 'info' && /End of the prototype/.test(s.panel.text);
    return false;
  };
  let s;
  while (now() - t0 < budgetS * 25000) {
    const idle = await stuck(scene);
    if (idle > 75) { note(`giving up on ${scene}: stuck ${idle.toFixed(0)} s`); break; }
    s = await R().catch(() => null);
    if (!s) { await sleep(500); continue; }
    if (done(s)) { note(`${scene} finished`); break; }
    if (s.gameT - g0 > budgetS) { note(`${scene}: game-time budget ${budgetS}s used up`); break; }
    // cutscenes play on their own; watch a few game-seconds, then tap Skip like an impatient player
    if (s.skipBtn) { if (cineT === null) cineT = s.gameT; } else cineT = null;
    if (WATCH > 0 && cineT !== null && s.gameT - cineT > (scene === 'opening' ? Math.max(WATCH, 45) : WATCH) && !s.choices && !s.panel && !s.taste) {
      const r = await T.tapEl('#cine-skip', { label: 'Skip ⏭' }); skips++; cineT = s.gameT + 1e9; await sleep(600);
      if (!r.ok) note('Skip button not tappable');
      continue;
    }
    const key = `${s.fade || ''}|${s.panel?.kind || ''}|${s.taste?.title || ''}|${s.choices?.join() || ''}|${s.obj || ''}|${s.book}|${s.shop}|${s.cookTitle}`;
    if (key !== lastShotKey) { lastShotKey = key; if (SC.shots.length < 140) await shot(page, `${scene}-${(s.panel?.kind || s.taste?.title || s.obj || s.fade || (s.shop ? 'shop' : s.cook ? 'cook-' + s.cookTitle : 'scene')).slice(0, 30)}`); }
    // a free-roam control must be let go while anything else happens
    const roam = s.G && s.G.busy === 0 && !s.G.cine && !s.G.cutscene && !s.panel && !s.dlg;
    if (!roam && joy.held) await joy.release();
    if (s.rules) { await T.tapEl('.svc-rules [data-go]', { label: 'Open the hatch' }); await sleep(800); continue; }
    if (s.night) { await sleep(1500); await shot(page, `${scene}-night-card`); await T.tapEl('#k-done', { label: 'Close up' }); await sleep(1500); continue; }
    if (s.shop) { const r = await playShop(P, { label: `${scene}-shop`, budgetS: 600, firstWhat: false, swipeOnce: false }); note(`shop night inside ${scene}: ${r.last?.results?.length} served, ¥${r.last?.money}`); continue; }
    if (s.taste) { if (s.taste.note) { await sleep(700); await T.tap(195, 330); await sleep(800); } else await sleep(400); continue; }
    if (s.book) { await sleep(900); await T.tap(195, 400); await sleep(700); continue; }
    if (s.choices) {
      // pick like a curious player: the scheme (to exercise the peek game), otherwise the first
      const pick = s.choices.findIndex(c => /Scheme/.test(c)) >= 0 ? s.choices.findIndex(c => /Scheme/.test(c)) : (choiceN++ % 2 && s.choices.length > 1 && !/Sit and eat/.test(s.choices[0]) ? 1 : 0);
      note(`choice: ${s.choices[pick]}`);
      await page.evaluate(i => document.querySelectorAll('#choices button')[i].setAttribute('data-pt', 'c'), pick);
      await T.tapEl('#choices button[data-pt="c"]', { label: 'choice button' }); await sleep(600); continue;
    }
    if (s.panel) {
      const k = s.panel.kind;
      if (k === 'bag') { await bagStep(P); await sleep(300); continue; }
      if (k === 'peek') {
        const b = await page.evaluate(() => { const r = document.getElementById('pk-hold').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        let down = false; const h0 = now();
        while (now() - h0 < 30000 && await page.$('#pk-hold')) {
          const humming = await page.evaluate(() => document.getElementById('pk-notes')?.style.visibility !== 'hidden');
          if (humming && !down) { await T.down(b.x, b.y); down = true; } else if (!humming && down) { await T.up(); down = false; }
          await sleep(60);
        }
        if (down) await T.up();
        continue;
      }
      if (k === 'board') {
        const id = await page.evaluate(() => { const o = [...document.querySelectorAll('#ob-list .order')].find(e => e.querySelector('[data-take]') && !/Quick run/.test(e.innerText)); if (!o) return null; o.querySelector('[data-take]').setAttribute('data-pt', 'take'); return o.querySelector('.top span').textContent; });
        if (id) { note(`take order: ${id}`); await T.tapEl('[data-take][data-pt="take"]', { label: 'Accept order' }); }
        else await T.tapEl('#ob-close', { label: 'close board' });
        await sleep(600); continue;
      }
      if (k === 'duck') { await T.tapEl('#duck-go', { label: 'Quack! Start riding' }); await sleep(500); continue; }
      if (k === 'info') { await sleep(800); await T.tapEl('#ic-ok', { label: 'info Continue' }); await sleep(500); continue; }
      if (k === 'title') { await T.tapEl('#t-start', { label: 'Start' }); continue; }
      const btn = await page.evaluate(() => { const b = document.querySelector('#panel .btn-big, #panel button'); if (b) b.setAttribute('data-pt', 'b'); return b?.textContent; });
      if (btn) { note(`panel button: ${btn}`); await T.tapEl('#panel [data-pt="b"]', { label: `panel: ${btn}` }); }
      await sleep(600); continue;
    }
    if (s.dlg) {
      // tap the dialogue box once the line is fully shown, and check it advances
      const line = `${s.dlg.name}: ${s.dlg.text}`;
      if (line !== lastLine) { if (lastLine && dlgTaps) dlgAdv++; lastLine = line; lastLineT = now(); seenLines.add(line); }
      if (s.dlg.done && now() - lastLineT > 900) {
        const before = line; dlgTaps++;
        await T.tapEl('#dialogue', { label: 'dialogue box' });
        await sleep(700);
        const q = await R();
        if (q.dlg && `${q.dlg.name}: ${q.dlg.text}` === before && q.dlg.done) {
          await sleep(1500); const q2 = await R();
          if (q2.dlg && `${q2.dlg.name}: ${q2.dlg.text}` === before) await issue(page, 'major', 'Dialogue tap does not advance', `Tapped the dialogue box on "${before.slice(0, 80)}" and the line stayed.`);
        }
        lastLineT = now();
      } else await sleep(250);
      continue;
    }
    if (s.cook) { await cookStep(P); continue; }
    if (roam && s.pos) {
      // where does the game want me? marker, or the person the objective describes
      let target = s.marker, r = 2;
      const o = s.obj || '';
      if (!target && /red hat/i.test(o)) target = await page.evaluate(n => { const N = window.__game.N; const crowd = Object.keys(N).filter(k => /^crowd/.test(k)); const id = n < 1 && crowd.length ? crowd.sort((a, b) => N[a].pos.distanceTo(window.__game.player.pos) - N[b].pos.distanceTo(window.__game.player.pos))[0] : 'redhat'; return { x: N[id].pos.x, z: N[id].pos.z }; }, asks);
      if (!target && /old man|long chair/i.test(o)) target = await page.evaluate(() => ({ x: window.__game.N.li.pos.x, z: window.__game.N.li.pos.z }));
      if (!target && /Ah Jie|bench/i.test(o)) target = await page.evaluate(() => ({ x: window.__game.N.bf.pos.x, z: window.__game.N.bf.pos.z }));
      if (s.prompt && (/Deliver/.test(s.prompt) || (/Ask/.test(s.prompt) && asks < 1))) {
        if (joy.held) { await joy.release(); await sleep(400); }
        if (/Ask/.test(s.prompt)) asks++;
        note(`action button: ${s.prompt}`);
        await T.tapEl('#act-btn', { label: 'action button' }); await sleep(900); continue;
      }
      if (/Orders/.test(o) && !target) { await T.tapEl('#btn-orders', { label: '📱 Orders' }); await sleep(800); continue; }
      if (target) { await navStep(P, nav, joy, s, target, r); await sleep(120); continue; }
    }
    await sleep(300);
  }
  if (joy.held) await joy.release();
  return { skips, gameS: ((await page.evaluate(() => window.__pt.gameT)) - g0), lines: seenLines.size, dlgTaps, dlgAdv, finished: s && done(s), seconds: (now() - t0) / 1000, last: s };
}

async function scenarioStory() {
  newScenario('story', `Scenes ${SCENES.join(', ')} with ?auto=1, tapping through dialogue, choices, panels and the mini-games with real touch; walking/riding with the joystick.`);
  const budgets = { opening: 400, day2: 1200, evening: 1000, live: 300, chilli: 300, taste: 200 };   // game-seconds
  for (const scene of SCENES) {
    const P = await openPage(`?auto=1#${scene}`, { dpr: 1 });
    const { page, cdp } = P;
    const e0 = SC.errors.length;
    try {
      await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
      await sleep(500);
      await page.evaluate(() => window.__pt.take());
      const prof = (async () => { await sleep(20000); const h = await profile(cdp, 8000); SC.hot.push({ scene, top: h.slice(0, 8) }); })();
      const r = await storyScene(P, scene, { budgetS: budgets[scene] || 400 });
      await prof.catch(() => {});
      await segment(page, scene, null);
      await shot(page, `${scene}-end`);
      check(`story/${scene}: reaches its end`, r.finished, `${r.seconds.toFixed(0)} s wall / ${r.gameS.toFixed(0)} s game, ${r.skips} cutscene skips, ${r.lines} lines seen, dialogue taps ${r.dlgTaps}; last: ${JSON.stringify({ obj: r.last?.obj, fade: r.last?.fade, panel: r.last?.panel?.kind, dlg: r.last?.dlg?.text?.slice(0, 60), G: r.last?.G })}`);
      check(`story/${scene}: zero console/page errors`, SC.errors.length === e0, SC.errors.slice(e0, e0 + 4).join(' || '));
    } catch (e) { check(`story/${scene}: ran without exceptions`, false, e.stack.split('\n').slice(0, 3).join(' | ')); await issue(page, 'major', `Story scene ${scene} aborted`, e.message); }
    await P.ctx.close();
  }
}

// =====================================================================
// TOWN: walk Day 1's street with the joystick
// =====================================================================
async function scenarioTown() {
  newScenario('town', 'Day 1 free roam on foot (?start=day1): ~60 s of joystick drags in 8 directions; checks movement, camera follow, ground contact, input latency.');
  const P = await openPage('?auto=1&start=day1', { dpr: 1 });
  const { page, T, cdp } = P;
  try {
    await page.waitForFunction(() => window.__game && window.__game.G.busy === 0 && !document.getElementById('fade').classList.contains('on') && document.getElementById('objective') && !document.getElementById('objective').classList.contains('hidden'), null, { timeout: 90000 });
    await sleep(1500);
    await page.evaluate(src => { window.__ptStoryRead = eval(src); }, `(${STORY_READ.toString()})`);
    const R = () => page.evaluate(() => window.__ptStoryRead());
    const joy = joystick(page, T);
    const navT = makeNav(await page.evaluate(() => window.__game.W.colliders.map(c => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }))), 0.75);
    const c = await joy.center();
    check('town: on-screen joystick is visible on touch', c.vis, JSON.stringify(c));
    await shot(page, 'start');
    await page.evaluate(() => window.__pt.take());
    const heap0 = await page.evaluate(() => performance.memory?.usedJSHeapSize);
    // latency: finger down → the hero is moving
    const lat = await (async () => {
      const p = page.evaluate(() => new Promise(res => { const g = window.__game, pt = window.__pt; const t0 = performance.now(), n0 = pt.nFrames; const f = () => { if (g.player.speed > 0.5) res({ ms: performance.now() - pt.downAt, frames: pt.nFrames - n0 }); else if (performance.now() - t0 > 20000) res({ ms: -1, frames: pt.nFrames - n0 }); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
      await sleep(50); await joy.push(1, 0); return p;
    })();
    SC.latency = lat.ms;
    check('town: joystick moves the hero', lat.ms > 0, `touch → speed>0.5 in ${lat.ms.toFixed(0)} ms = ${lat.frames} frame(s) (one SwiftShader frame here is ~0.5-1 s)`);
    await joy.release(); await sleep(800);
    const prof = (async () => { await sleep(8000); SC.hot = await profile(cdp, 10000); })();
    const dirs = [['east', 1, 0], ['north', 0, -1], ['west', -1, 0], ['south', 0, 1], ['north-east', 1, -1], ['south-west', -1, 1], ['north-west', -1, -1], ['south-east', 1, 1]];
    const shopFront = { x: -15, z: -7 };
    for (const [name, dx, dz] of dirs) {
      let s0 = await R();
      // keep clear of the shop-front trigger: it starts the Day 1 cutscene
      const ahead = { x: s0.pos.x + dx * 30, z: s0.pos.z + dz * 30 };
      const avoid = Math.hypot(ahead.x - shopFront.x, ahead.z - shopFront.z) < 12;
      const [ux, uz] = avoid ? [-dx || -1, dz] : [dx, dz];
      await joy.push(ux, uz);
      const g0 = await page.evaluate(() => window.__pt.gameT);
      const t0 = now(); let moved = 0, camOk = true, groundOk = true, maxCamOff = 0, last = s0, blockedT = 0, cine = false;
      while (now() - t0 < 30000 && (await page.evaluate(() => window.__pt.gameT)) - g0 < 7) {
        await sleep(400);
        const s = await R();
        if (!s.pos) continue;
        if (s.G.cine || s.G.busy) { cine = true; break; }
        const step = (s.pos.x - last.pos.x) * ux + (s.pos.z - last.pos.z) * uz;
        moved += step / Math.hypot(ux, uz);
        if (Math.hypot(s.pos.x - last.pos.x, s.pos.z - last.pos.z) < 0.05) blockedT += 0.4;
        const off = Math.hypot(s.cam.x - s.pos.x, s.cam.z - s.pos.z);
        maxCamOff = Math.max(maxCamOff, off);
        if (off > 40 || !isFinite(off)) camOk = false;
        if (!(s.pos.y > -0.5 && s.pos.y < 1) || !(s.cam.y > 1) || [s.pos.x, s.pos.z, s.cam.x, s.cam.y, s.cam.z].some(v => !isFinite(v))) groundOk = false;
        last = s;
      }
      const gt = (await page.evaluate(() => window.__pt.gameT)) - g0;
      await joy.release(); await sleep(500);
      const s1 = await R();
      const expect = gt * 7.5;   // WALK m/s × game seconds the finger was down
      await shot(page, `walk-${name}`);
      const camMoved = Math.hypot(s1.cam.x - s0.cam.x, s1.cam.z - s0.cam.z), heroMoved = Math.hypot(s1.pos.x - s0.pos.x, s1.pos.z - s0.pos.z);
      const ul = Math.hypot(ux, uz), wall = navT.blockedAt(s1.pos.x + ux / ul * 1.2, s1.pos.z + uz / ul * 1.2);
      note(`${name}${avoid ? ' (diverted)' : ''}: ${gt.toFixed(1)} game-s held, hero moved ${heroMoved.toFixed(1)} m (${moved.toFixed(1)} m along the push, ${expect.toFixed(1)} m at full walk speed), camera ${camMoved.toFixed(1)} m, max cam-hero ${maxCamOff.toFixed(1)} m${wall ? ', ran into something' : ''}${cine ? ', a cutscene started' : ''}`);
      check(`town/${name}: hero moves along the push`, moved > expect * 0.55 || (wall && heroMoved > 0.5) || cine, `${moved.toFixed(1)} m of ${expect.toFixed(1)} m expected${wall ? ' (blocked by a collider part of the way)' : ''}`);
      check(`town/${name}: camera follows`, camOk && (heroMoved < 1 || Math.abs(camMoved - heroMoved) < Math.max(3, heroMoved * 0.5)), `camera ${camMoved.toFixed(1)} m vs hero ${heroMoved.toFixed(1)} m, max offset ${maxCamOff.toFixed(1)} m`);
      check(`town/${name}: stays on the ground, no NaN`, groundOk, `y=${s1.pos.y} cam.y=${s1.cam.y.toFixed(1)}`);
      if (cine) break;
    }
    await prof;
    await segment(page, 'walk', heap0);
  } catch (e) { check('town: ran without exceptions', false, e.stack.split('\n').slice(0, 3).join(' | ')); await issue(page, 'major', 'Town scenario aborted', e.message); }
  check('town: zero console/page errors', SC.errors.length === 0, SC.errors.slice(0, 4).join(' || '));
  await P.ctx.close();
}

// =====================================================================
// report
// =====================================================================
function writeReport() {
  report.finished = new Date().toISOString();
  for (const s of report.scenarios) s.seconds = Math.round((now() - s.t0) / 1000);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  const L = [];
  L.push('# Playtest report (automated, real touch input)', '');
  L.push(`Run ${report.started} → ${report.finished}. Device: ${report.device}. Tool: \`prototype/tools/playtest.cjs\`.`, '');
  L.push('Frame times come from a requestAnimationFrame probe injected before the game loads. **SwiftShader renders WebGL on the CPU here, so absolute fps is far below a real iPhone; read the numbers relatively** (scene vs scene, ×1 vs ×4 CPU throttle) and look at the hot functions.', '');
  L.push('## Scenarios', '');
  L.push('| scenario | result | checks | issues | errors | time |', '|---|---|---|---|---|---|');
  for (const s of report.scenarios) L.push(`| ${s.name} | ${s.ok ? 'PASS' : 'FAIL'} | ${s.checks.filter(c => c.ok).length}/${s.checks.length} | ${s.issues.length} | ${s.errors.length} | ${s.seconds}s |`);
  if (report.throttle) { const t = report.throttle; L.push('', '## CPU throttle ×4 vs ×1 (shop night)', '', `fps ${t.fps[0]} → ${t.fps[1]}; median frame ${t.median[0]} → ${t.median[1]} ms; p95 ${t.p95[0]} → ${t.p95[1]} ms; frames > 33 ms ${t.over33[0]}% → ${t.over33[1]}%; night took ${t.nightSeconds[0]} → ${t.nightSeconds[1]} s wall-clock; average bowl ${t.avgPoints[0]} → ${t.avgPoints[1]} points.`); }
  L.push('', '## Frame times per segment', '', '| scenario | segment | frames | fps | median ms | p95 ms | % > 33 ms | longest ms | long tasks (n / total ms / max) | heap MB |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const s of report.scenarios) for (const g of s.segments) L.push(`| ${s.name} | ${g.label} | ${g.frames} | ${g.fps} | ${g.median} | ${g.p95} | ${g.over33} | ${g.longest} | ${g.longTasks} / ${g.longTaskMs} / ${g.longestTask} | ${g.heapMB0 ?? '–'} → ${g.heapMB1 ?? '–'} |`);
  for (const s of report.scenarios) {
    L.push('', `## ${s.name}`, '', s.note, '');
    if (s.result) L.push(`Result: ${JSON.stringify(s.result)}`, '');
    if (s.latency) L.push(`Touch → movement latency: ${s.latency.toFixed(0)} ms.`, '');
    L.push('Checks:', '');
    for (const c of s.checks) L.push(`- ${c.ok ? '✅' : '❌'} ${c.name}${c.detail ? ` · ${c.detail}` : ''}`);
    if (s.errors.length) {
      const grp = new Map(); for (const e of s.errors) { const k = e.replace(/\/assets\/food2d\/[^ ]+\.webp/, '/assets/food2d/*.webp'); grp.set(k, (grp.get(k) || 0) + 1); }
      L.push('', `Console / page / HTTP errors (${s.errors.length}):`, ''); for (const [e, n] of [...grp].slice(0, 25)) L.push(`- \`${e.slice(0, 300)}\`${n > 1 ? ` ×${n}` : ''}`);
    }
    if (s.issues.length) { L.push('', 'Flagged during play:', ''); for (const i of s.issues) L.push(`- **[${i.sev}] ${i.title}**${i.count > 1 ? ` (×${i.count})` : ''}: ${i.detail}${i.shot ? ` ![](${i.shot})` : ''}${i.state ? `\n  <details><summary>state</summary>\n\n  \`\`\`\n  ${JSON.stringify(i.state).slice(0, 1500)}\n  \`\`\`\n  </details>` : ''}`); }
    if (s.scrolled) { L.push('', 'Buttons that were below the fold (a finger had to scroll the card first):', ''); for (const [k, v] of Object.entries(s.scrolled)) L.push(`- ${k} (×${v})`); }
    if (s.small) { L.push('', 'Touch targets measured (CSS px; Apple asks for ≥ 44×44):', ''); for (const [k, v] of Object.entries(s.small)) L.push(`- ${k}: ${v}`); }
    const hot = Array.isArray(s.hot) && s.hot[0]?.scene ? s.hot : [{ scene: s.name, top: s.hot }];
    for (const h of hot) if (h.top?.length) { L.push('', `CPU hot spots (${h.scene}, sampled):`, '', '| function | self ms | % |', '|---|---|---|'); for (const f of h.top) L.push(`| \`${f.fn}\` | ${f.ms} | ${f.pct} |`); }
    if (s.timeline.length) { L.push('', '<details><summary>timeline</summary>', ''); for (const t of s.timeline) L.push(`- ${t}`); L.push('', '</details>'); }
    if (s.shots.length) { L.push('', '<details><summary>screenshots</summary>', ''); for (const f of s.shots) L.push(`- [${f.label}](${f.f})`); L.push('', '</details>'); }
  }
  const findings = path.join(OUT, 'FINDINGS.md');
  if (fs.existsSync(findings)) L.push('', fs.readFileSync(findings, 'utf8'));
  fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n') + '\n');
  log('wrote', path.join(OUT, 'report.md'));
}

(async () => {
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
  const plan = WHAT === 'all' ? ['shop', 'slow', 'story', 'town'] : WHAT.split(',');
  try {
    for (const w of plan) {
      if (w === 'shop') await scenarioShop();
      else if (w === 'slow') await scenarioShop({ cpu: 4, name: 'shop-cpu4' });
      else if (w === 'story') await scenarioStory();
      else if (w === 'town') await scenarioTown();
      else console.error('unknown scenario', w);
      writeReport();
    }
    const a = report.scenarios.find(s => s.name === 'shop'), b = report.scenarios.find(s => s.name === 'shop-cpu4');
    if (a && b) {
      const sa = a.segments.find(x => x.label === 'night'), sb = b.segments.find(x => x.label === 'night');
      if (sa && sb) report.throttle = { fps: [sa.fps, sb.fps], median: [sa.median, sb.median], p95: [sa.p95, sb.p95], over33: [sa.over33, sb.over33], nightSeconds: [a.result?.seconds, b.result?.seconds], avgPoints: [a.result?.avgPoints, b.result?.avgPoints] };
    }
  } finally { writeReport(); await browser.close(); }
  const bad = report.scenarios.filter(s => !s.ok).map(s => s.name);
  console.log(bad.length ? `FAILED: ${bad.join(', ')}` : 'ALL PASSED');
})();
