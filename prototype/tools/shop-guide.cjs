// Play a shop night on an emulated iPhone by following ONLY the on-screen guide.
//   node tools/shop-guide.cjs OUTDIR [landscape]
const { chromium, devices } = require('playwright');
const OUT = process.argv[2], LAND = process.argv[3] === 'landscape';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(LAND ? { viewport: { width: 1280, height: 720 } } : { ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  const W = ms => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto('http://localhost:8765/#shop');
  await p.waitForSelector('.svc-rules [data-go]'); await W(500);
  await p.screenshot({ path: `${OUT}/00-card.png` });
  await p.click('.svc-rules [data-go]');
  await p.waitForFunction(() => window.__shop2d);
  const C = (x, y) => ev(([x, y]) => window.__shop2d.toClient(x, y), [x, y]);
  const shots = new Set(); let n = 1;
  const t0 = Date.now();
  while (Date.now() - t0 < +(process.env.SECS || 600) * 1000) {
    const s = await ev(() => { const { S, st } = window.__shop2d; return { step: st.step, view: st.view, over: S.schedule.every(e => e.arrived) && S.guests.every(g => g.state === 'served') && !st.react, react: !!st.react, done: S.results.length, settled: Math.abs(st.camX - { order: 0, stove: 1, build: 2 }[st.view] * (window.__shop2dLayout?.VW || 0)) < 3 }; });
    if (s.over) break;
    const dbg = await ev(() => { const { S, st } = window.__shop2d; const t = S.tickets.find(t => t.uid === st.selected); return `${st.view} sel=${st.selected} ${t ? `fill=${t.fill.toFixed(2)} fat=${t.fat} noodles=${t.noodles} parts=${t.parts.join(',')}` : ''} baskets=${S.baskets.map(b => b.ticket ? b.ticket + ':' + b.t.toFixed(1) : '-').join('/')} step=${st.step ? st.step.kind + ':' + st.step.word : '-'}`; });
    if (dbg !== globalThis.lastDbg) { console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', dbg); globalThis.lastDbg = dbg; }
    if (s.react) {
      const rt = await ev(() => window.__shop2d.st.react?.t || 0);
      for (const [at, nm] of [[0.25, 'react-slide'], [1.0, 'react-eat'], [2.1, 'react-verdict']]) if (rt >= at && !shots.has(nm) && rt < at + 0.9) { shots.add(nm); if (s.view !== 'order') await ev(() => window.__shop2d.go('order')); await p.screenshot({ path: `${OUT}/${nm}.png` }); }
      await W(150); continue;
    }
    if (!s.step) { await W(400); continue; }
    if (s.step.view !== s.view) { await ev(v => window.__shop2d.go(v), s.step.view); await W(1200); continue; }
    const key = s.step.kind + ':' + s.step.word;
    if (!shots.has(key) && shots.size < 14) {               // let the ghost glove appear, then photograph the hint
      shots.add(key); await W(2600);
      await p.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-${s.step.kind}.png` });
    }
    const st = s.step;
    if (st.kind === 'tap') { const q = await C(st.at.x, st.at.y); await p.mouse.click(q.x, q.y); await W(500); }
    else if (st.kind === 'drag') {
      const a = await C(st.from.x, st.from.y), z = await C(st.at.x, st.at.y);
      await p.mouse.move(a.x, a.y); await p.mouse.down();
      for (let i = 1; i <= 8; i++) { await p.mouse.move(a.x + (z.x - a.x) * i / 8, a.y + (z.y - a.y) * i / 8); await W(30); }
      await p.mouse.up(); await W(400);
    } else if (st.kind === 'hold') {
      const q = await C(st.at.x, st.at.y); await p.mouse.move(q.x, q.y); await p.mouse.down();
      await p.waitForFunction(() => { const { S, st } = window.__shop2d; const t = S.tickets.find(t => t.uid === st.selected); return !t || t.fill >= 0.78; }, null, { timeout: 30000 });
      await p.mouse.up(); await W(400);
    } else await W(600);
  }
  await W(1500); await p.screenshot({ path: `${OUT}/99-end.png` });
  const res = await ev(() => window.__shop2d.S.results.map(r => `${r.who}:${r.points}`));
  console.log('RESULTS', res.join(' '), 'steps seen:', [...shots].join(' | '));
  console.log('ERRORS', errs.join('\n') || 'none'); await b.close();
})();
