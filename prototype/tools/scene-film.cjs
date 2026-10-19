// Film a story scene on an emulated iPhone: a frame every few seconds plus the line on screen.
//   node tools/scene-film.cjs OUTDIR '#day1' [seconds] [every]
const { chromium, devices } = require('playwright');
const [OUT, HASH, SECS = '400', EVERY = '3000'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/?auto=1' + HASH);
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < +SECS * 1000) {
    await p.waitForTimeout(+EVERY);
    const st = await p.evaluate(() => { const g = window.__game; return { line: document.getElementById('dialogue').classList.contains('hidden') ? '' : document.getElementById('dlg-name').textContent + ': ' + document.getElementById('dlg-text').textContent.slice(0, 60), cine: !!g?.G.flags.cine, panel: !document.getElementById('panel').classList.contains('hidden'), obj: document.getElementById('objective')?.textContent || '', pos: g ? [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)] : null }; });
    await p.screenshot({ path: `${OUT}/${String(i).padStart(3, '0')}.png` });
    console.log(String(i++).padStart(3, '0'), ((Date.now() - t0) / 1000).toFixed(0) + 's', st.cine ? 'CINE' : '    ', st.panel ? 'PANEL' : '', JSON.stringify(st.pos), st.obj, '|', st.line);
    // keep the scene moving: tap through panels and choices, walk towards objectives
    await p.evaluate(() => { const g = window.__game; if (g && !g.G.flags.cine && g.W.markerTarget) { const m = g.W.markerTarget; g.teleport(m.x + 1.5, m.z + 1.5, Math.PI); } });   // walk to the objective
    await p.evaluate(() => { const c = document.querySelector('#choices:not(.hidden) button, #panel:not(.hidden) .btn-big, #panel:not(.hidden) button, .k3-result button'); if (c) c.click(); });
  }
  console.log('ERRORS', errs.join('\n') || 'none'); await b.close();
})();
