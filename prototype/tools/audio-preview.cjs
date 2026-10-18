// Record music tracks and voice lines from the real game audio into webm files.
//   node tools/audio-preview.cjs OUTDIR
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/error|warn/.test(m.type())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/tools/blank.html');   // just the audio modules: no 3D, no scene
  await p.evaluate(async () => { const A = await import('/src/audio.js'); window.__audio = A; A.initAudio(); });
  const rec = async (name, secs, fn) => {
    const b64 = await p.evaluate(async ([secs, fn]) => {
      const A = window.__audio;
      const stream = A.tapStream();
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = []; mr.ondataavailable = e => chunks.push(e.data);
      mr.start();
      // eslint-disable-next-line no-new-func
      new Function('A', fn)(A);
      await new Promise(r => setTimeout(r, secs * 1000));
      mr.stop(); await new Promise(r => mr.onstop = r);
      A.setMusic(null);
      const buf = await new Blob(chunks).arrayBuffer();
      let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      return btoa(s);
    }, [secs, fn]);
    fs.writeFileSync(`${OUT}/${name}.webm`, Buffer.from(b64, 'base64'));
    console.log('wrote', name);
    await p.waitForTimeout(1200);
  };
  if (process.argv[3] !== 'voices') for (const t of ['day', 'ride', 'night', 'shop', 'memory', 'office']) await rec(`music-${t}`, t === 'office' ? 12 : 18, `A.setMusic('${t}')`);
  const lines = [
    ['player', 'Grandpa Zhao? Is that really you? I came all the way from Dublin!'],
    ['grandma', 'No money, no noodles. Grandma’s rule. Now sit down and eat.'],
    ['chilli', 'Hey! You! What do you think you’re doing to his noodles?!'],
    ['wang', 'Supreme Mega Bowl. Forty-eight toppings. You’re welcome.'],
    ['spud', 'Hmph. Potatoes don’t lie, kid.'],
    ['rose', 'Oh! Flower cakes, fresh this morning! Want one?'],
    ['ai', 'Great question! Here is the perfect recipe. Trust me.'],
    ['grandma', '没钱，没面。慢慢吃。'],
  ];
  const code = lines.map(([v, l], k) => `setTimeout(() => { const c = [...${JSON.stringify(l)}]; c.forEach((_, i) => setTimeout(() => A.speak(c, i, '${v}', 'normal'), i * 25)); }, ${k * 4200});`).join('\n');
  await rec('voices', lines.length * 4.2 + 0.5, code);
  console.log('ERRORS', errs.join('\n') || 'none'); await b.close();
})();
