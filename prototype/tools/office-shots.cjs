const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/?auto=1#opening2');
  for (const [t, n] of [[6000, 'a'], [20000, 'b'], [40000, 'c'], [70000, 'd'], [100000, 'e']]) { await p.waitForTimeout(t - (n === 'a' ? 0 : 0)); await p.screenshot({ path: `${OUT}/02b-office-${n}.png` }); }
  console.log('ERRORS', errs.join('\n') || 'none'); await b.close();
})();
