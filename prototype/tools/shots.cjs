// Phase screenshots (same screens every phase): node tools/shots.cjs OUTDIR [phone]
// Needs the dev server on :8765 (python3 -m http.server 8765 in prototype/).
const { chromium } = require('playwright');
const OUT = process.argv[2], PHONE = process.argv[3] === 'phone', P = PHONE ? 'phone-' : '';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const errs = [];
  const open = async hash => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(`[${hash}] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(`[${hash}] ${m.text()}`); });
    await page.goto('http://localhost:8765/?auto=1' + hash);
    return page;
  };
  const shot = (page, n) => page.screenshot({ path: `${OUT}/${P}${n}.png` });  // convert to .jpg afterwards (tools/README)
  // title
  let p = await open('');
  await p.waitForSelector('.title-card'); await p.waitForTimeout(1500); await shot(p, '01-title'); await p.close();
  // intro: grey office, daydream, closed shop, arrival — sampled through the opening
  p = await open('#opening');
  const marks = [[4000, '02-intro-a'], [25000, '03-intro-b'], [60000, '04-intro-c'], [100000, '05-intro-d'], [140000, '06-intro-e'], [180000, '07-intro-f'], [220000, '08-intro-g']];
  let t = 0;
  for (const [at, n] of marks) { await p.waitForTimeout(at - t); t = at; await shot(p, n); }
  await p.close();
  // street + dialogue on Day 2
  p = await open('#day2');
  const dlg = () => p.evaluate(() => !document.getElementById('dialogue').classList.contains('hidden'));
  await p.waitForFunction(() => !document.getElementById('dialogue').classList.contains('hidden'), null, { timeout: 90000 });
  await p.waitForTimeout(2500); await shot(p, '09-dialogue-day2');
  for (let i = 0; i < 60; i++) { if (!await dlg()) { await p.waitForTimeout(1500); if (!await dlg()) break; } await p.keyboard.press('Enter'); await p.waitForTimeout(500); }
  await p.waitForTimeout(4000); await shot(p, '10-street-day2');
  await p.close();
  // free roam: title hidden, walk-cam at fixed spots
  p = await open('');
  await p.waitForSelector('.title-card'); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('#panel').forEach(e => e.classList.add('hidden')));
  for (const [n, x, z, f] of [['11-roam-street', -15, -3, Math.PI], ['12-roam-plaza', 22, 16, 0.6], ['13-roam-stalls', -30, 2, 2.2], ['13b-roam-lake', 30, -40, 3]]) {
    await p.evaluate(([x, z, f]) => window.__game.teleport(x, z, f), [x, z, f]);
    await p.waitForTimeout(2500); await shot(p, n);
  }
  await p.close();
  // evening at grandma's (bowl lab)
  p = await open('#evening'); await p.waitForFunction(() => !document.getElementById('dialogue').classList.contains('hidden'), null, { timeout: 90000 }); await p.waitForTimeout(2500); await shot(p, '14-evening'); await p.close();
  // kitchen + cooking: the drawn shop
  p = await open('#shop');
  await p.waitForSelector('.svc-rules [data-go]'); await shot(p, '15-shop-rules');
  await p.click('.svc-rules [data-go]');
  await p.waitForFunction(() => window.__shop2d && window.__shop2d.st.bubble, null, { timeout: 30000 });
  await p.waitForTimeout(600); await shot(p, '16-kitchen-order');
  for (const v of ['stove', 'build']) { await p.evaluate(v => window.__shop2d.go(v), v); await p.waitForTimeout(1800); await shot(p, `17-cooking-${v}`); }
  await p.close();
  // drawn set-pieces
  p = await open('#live'); await p.waitForTimeout(6000); await shot(p, '18-cook-livestream'); await p.close();
  p = await open('#chilli'); await p.waitForTimeout(6000); await shot(p, '19-cook-chilli'); await p.close();
  console.log('ERRORS', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})();
