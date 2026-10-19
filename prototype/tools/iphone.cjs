// iPhone-emulated captures (390x844 @3x, touch, iOS UA), Chromium engine.
//   node tools/iphone.cjs OUTDIR intro|walk [seconds]
const { chromium, devices } = require('playwright');
const [OUT, MODE, SECS = '240'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });
  if (MODE === 'intro') {
    await p.goto('http://localhost:8765/?auto=1');
    await p.waitForSelector('#t-start'); await p.tap('#t-start');
    const t0 = Date.now(); let i = 0, lastTxt = '';
    while (Date.now() - t0 < +SECS * 1000) {
      await p.waitForTimeout(4000);
      const st = await p.evaluate(() => ({ dlg: document.getElementById('dlg-text')?.textContent || '', fade: document.getElementById('fade').className, panel: !document.getElementById('panel').classList.contains('hidden') }));
      await shot(String(i++).padStart(3, '0'));
      if (st.dlg !== lastTxt) { console.log(i - 1, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(st.dlg.slice(0, 70)), st.panel ? '[panel]' : ''); lastTxt = st.dlg; }
      // tap through any choice/continue the scene waits on
      await p.evaluate(() => { const c = document.querySelector('#choices:not(.hidden) button, #panel:not(.hidden) .btn-big, #panel:not(.hidden) button'); if (c) c.click(); });
    }
  } else {
    await p.goto('http://localhost:8765/?auto=1');
    await p.waitForSelector('.title-card'); await p.waitForTimeout(1000);
    await p.evaluate(() => { document.querySelectorAll('#panel').forEach(e => e.classList.add('hidden')); const g = window.__game; g.G.busy = 0; g.teleport(-20, -2, Math.PI); });
    await p.waitForTimeout(1500);
    const keys = [['ArrowRight', 1500], ['ArrowDown', 1500], ['ArrowLeft', 1200], ['ArrowUp', 2000]];
    let i = 0;
    for (const [k, ms] of keys) {
      await p.keyboard.down(k);
      for (let t = 0; t < ms; t += 500) { await p.waitForTimeout(500); await shot(`walk-${String(i++).padStart(2, '0')}`); }
      await p.keyboard.up(k);
    }
  }
  console.log('ERRORS', errs.length ? '\n' + errs.join('\n') : 'none');
  await b.close();
})();
