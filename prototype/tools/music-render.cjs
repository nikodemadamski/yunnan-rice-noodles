// Render each music piece offline (exact, no recorder) to WAV, one or two loops.
//   node tools/music-render.cjs OUTDIR
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/error|warn/.test(m.type())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/tools/blank.html');
  for (const name of ['day', 'ride', 'night', 'shop', 'memory', 'office']) {
    const res = await p.evaluate(async name => {
      const { createMusic } = await import('/src/music.js');
      const sr = 44100, secs = 40;
      const ctx = new OfflineAudioContext(2, sr * secs, sr);
      const noise = ctx.createBuffer(1, sr, sr); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const out = ctx.createGain(); out.gain.value = 0.62 * 0.5; out.connect(ctx.destination);   // musicGain x master, as in the game
      const m = createMusic(ctx, out, noise);
      const len = m.renderTo(name, 0.05, name === 'office' ? 2 : 1);
      const buf = await ctx.startRendering();
      const n = Math.min(buf.length, Math.ceil((len + 1.5) * sr));
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      // per-second RMS
      const rms = []; for (let s = 0; s < n; s += sr) { let a = 0; for (let i = s; i < Math.min(n, s + sr); i++) a += L[i] * L[i]; rms.push(+Math.sqrt(a / sr).toFixed(3)); }
      let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      // 16-bit WAV
      const dv = new DataView(new ArrayBuffer(44 + n * 4));
      const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
      dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      const u = new Uint8Array(dv.buffer); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return { b64: btoa(bin), secs: (n / sr).toFixed(1), peak: peak.toFixed(3), rms };
    }, name);
    fs.writeFileSync(`${OUT}/music-${name}.wav`, Buffer.from(res.b64, 'base64'));
    console.log(name.padEnd(7), res.secs + 's', 'peak', res.peak, 'rms/s', res.rms.join(' '));
  }
  console.log('ERRORS', errs.join('\n') || 'none'); await b.close();
})();
