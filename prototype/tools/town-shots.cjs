const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/?auto=1');
  await page.waitForFunction(() => window.__game && window.__life);
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelectorAll('#panel, .panel').forEach(e => e.classList.add('hidden')));
  const spots = [['street', -15, -3, Math.PI], ['plaza', 22, 16, 0.6], ['stalls', -30, 2, 2.2], ['lake', 30, -40, 3]];
  for (const [n, x, z, f] of spots) {
    await page.evaluate(([x, z, f]) => { const g = window.__game; g.teleport(x, z, f); }, [x, z, f]);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${n}.png` });
  }
  console.log('ERRORS', errs.join('\n') || 'none'); await browser.close();
})();
