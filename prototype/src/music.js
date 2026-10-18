// The soundtrack: small composed pieces in the spirit of Kung Fu Panda and
// Animal Crossing. A dizi flute and a whistle sing pentatonic tunes over
// guzheng plucks, a dagu drum, woodblocks, a little cymbal and the odd gong.
// Everything is synthesised (no sample files), scheduled ahead on the audio
// clock so it never drifts, and loops seamlessly.
//
// Melodies are original, written for this game. Notation per note:
//   'G4' pitch, beats, optional ornament: '^' grace from above, '~' slide in,
//   't' trill, 'r' rest (pitch ignored).

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = n => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  const semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
};
const r = b => ['r', b];

// ---------------------------------------------------------------- the pieces
// Each: bpm, lead instruments for section A/B, melody (A then B), one bass
// root per bar, accompaniment style and drum kit.
const TRACKS = {
  // Grandpa's street by day: C gong mode (C D E G A), a bouncy stroll
  day: {
    bpm: 112, leads: ['whistle', 'dizi'], comp: 'guzheng', kit: 'stroll',
    melody: [
      ['G4', .5], ['A4', .5], ['C5', .5], ['A4', .5], ['G4', 1], ['E4', 1],
      ['D4', .5], ['E4', .5], ['G4', .5], ['A4', .5], ['G4', 2, '~'],
      ['C5', .5], ['D5', .5], ['E5', 1, '^'], ['D5', .5], ['C5', .5], ['A4', 1],
      ['G4', .5], ['A4', .5], ['G4', .5], ['E4', .5], ['D4', 2],
      ['E4', .5], ['G4', .5], ['A4', 1], ['C5', .5], ['A4', .5], ['G4', 1],
      ['A4', .5], ['C5', .5], ['D5', 1, '^'], ['E5', 1], ['D5', 1],
      ['C5', .75], ['A4', .25], ['G4', .5], ['E4', .5], ['D4', .5], ['E4', .5], ['G4', 1],
      ['E4', .5], ['D4', .5], ['C4', 1], r(2),
      // B: the flute takes over, longer lines
      ['E5', 1.5, '~'], ['D5', .5], ['C5', 1], ['A4', 1],
      ['G4', 1.5], ['A4', .5], ['C5', 2],
      ['D5', .5], ['E5', .5], ['D5', .5], ['C5', .5], ['A4', 1], ['G4', 1],
      ['A4', 3, 't'], r(1),
      ['E5', .5], ['G5', .5], ['E5', .5], ['D5', .5], ['C5', 1], ['D5', 1],
      ['E5', 2, '^'], ['D5', .5], ['C5', .5], ['A4', 1],
      ['G4', .5], ['A4', .5], ['C5', .5], ['D5', .5], ['E5', .5], ['D5', .5], ['C5', .5], ['A4', .5],
      ['C5', 2, 't'], r(2),
    ],
    roots: ['C3', 'G2', 'A2', 'G2', 'C3', 'A2', 'G2', 'C3', 'A2', 'C3', 'G2', 'A2', 'C3', 'A2', 'G2', 'C3'],
  },
  // on the delivery bike: G zhi mode (G A C D E), a chase
  ride: {
    bpm: 138, leads: ['dizi', 'dizi'], comp: 'pipa', kit: 'chase',
    melody: [
      ['G4', .25], ['G4', .25], ['A4', .25], ['C5', .25], ['D5', .5], r(.25), ['D5', .25], ['E5', .5], ['D5', .5], ['C5', 1],
      ['C5', .25], ['A4', .25], ['G4', .25], ['E4', .25], ['G4', 1, '~'], r(.5), ['A4', .5], ['C5', .5], ['D5', .5],
      ['E5', .5], ['D5', .25], ['E5', .25], ['G5', 1, '^'], ['E5', .5], ['D5', .5], ['C5', 1],
      ['D5', .5], ['C5', .5], ['A4', .5], ['G4', .5], ['A4', 2, 't'],
      ['G4', .25], ['G4', .25], ['A4', .25], ['C5', .25], ['D5', .5], r(.25), ['D5', .25], ['E5', .5], ['D5', .5], ['C5', 1],
      ['C5', .25], ['A4', .25], ['G4', .25], ['E4', .25], ['D4', 1], ['E4', .5], ['G4', .5], ['A4', 1],
      ['C5', .5], ['D5', .5], ['E5', .5], ['G5', .5], ['E5', .5], ['D5', .5], ['C5', .5], ['D5', .5],
      ['G4', 1], r(1), ['G4', .25], ['G4', .25], r(.5), ['G5', 1, '~'],
    ],
    roots: ['G2', 'C3', 'G2', 'D3', 'G2', 'C3', 'A2', 'G2'],
  },
  // evenings at Grandma's: A yu mode (A C D E G), the erhu sings
  night: {
    bpm: 70, leads: ['erhu', 'xiao'], comp: 'guzheng-slow', kit: 'hush',
    melody: [
      ['A4', 1.5, '~'], ['C5', .5], ['D5', 1], ['E5', 1],
      ['D5', .5], ['C5', .5], ['A4', 2], r(1),
      ['G4', 1.5], ['A4', .5], ['C5', 1], ['D5', 1],
      ['E5', 3, 't'], r(1),
      ['G5', 1, '~'], ['E5', .5], ['D5', .5], ['C5', 1], ['D5', 1],
      ['E5', 1], ['D5', .5], ['C5', .5], ['A4', 2],
      ['C5', 1], ['A4', .5], ['G4', .5], ['E4', 1], ['G4', 1],
      ['A4', 3], r(1),
    ],
    roots: ['A2', 'D3', 'G2', 'C3', 'C3', 'A2', 'E2', 'A2'],
  },
  // the noodle shop at service: D gong mode (D E F# A B), busy and cheeky
  shop: {
    bpm: 122, leads: ['whistle', 'dizi'], comp: 'guzheng', kit: 'kitchen',
    melody: [
      ['A4', .5], ['B4', .5], ['D5', .5], ['B4', .5], ['A4', .5], ['F#4', .5], ['E4', 1],
      ['F#4', .5], ['A4', .5], ['B4', 1, '^'], ['A4', 2],
      ['D5', .5], ['E5', .5], ['F#5', 1], ['E5', .5], ['D5', .5], ['B4', 1],
      ['A4', .5], ['B4', .5], ['A4', .5], ['F#4', .5], ['E4', 1], ['D4', 1],
      ['D4', .25], ['E4', .25], ['F#4', .5], ['A4', 1], ['B4', .5], ['A4', .5], ['F#4', 1],
      ['E4', .5], ['F#4', .5], ['A4', .5], ['B4', .5], ['D5', 2, '~'],
      ['E5', .5], ['D5', .5], ['B4', .5], ['A4', .5], ['B4', .5], ['A4', .5], ['F#4', .5], ['E4', .5],
      ['D4', 1], r(.5), ['D5', .5], ['D5', 1], r(1),
    ],
    roots: ['D3', 'A2', 'B2', 'A2', 'D3', 'E2', 'B2', 'D3'],
  },
  // Grandpa's table, years ago: G zhi, slow and golden
  memory: {
    bpm: 78, leads: ['erhu', 'dizi'], comp: 'guzheng-slow', kit: 'hush',
    melody: [
      ['D5', 1.5, '~'], ['E5', .5], ['D5', 1], ['C5', 1],
      ['A4', 2], ['G4', 1], ['A4', 1],
      ['C5', 1.5], ['D5', .5], ['E5', 1], ['G5', 1, '^'],
      ['E5', 3, 't'], r(1),
      ['D5', 1], ['E5', .5], ['G5', .5], ['A5', 1], ['G5', 1],
      ['E5', 1], ['D5', 1], ['C5', 1], ['A4', 1],
      ['G4', 1], ['A4', .5], ['C5', .5], ['D5', 1], ['E5', 1],
      ['D5', 3, '~'], r(1),
    ],
    roots: ['G2', 'D3', 'C3', 'A2', 'G2', 'C3', 'G2', 'D3'],
  },
  // the grey office: a lonely electric piano, no China yet
  office: {
    bpm: 60, leads: ['epiano', 'epiano'], comp: null, kit: null,
    melody: [
      ['D4', 2], ['F4', 2],
      ['A3', 4],
      ['C4', 2], ['E4', 2],
      ['D4', 4],
    ],
    roots: ['D2', 'F2', 'A2', 'D2'],
  },
};

// sanity: every melody fills its bars exactly (a bad edit would drift the loop)
for (const [k, t] of Object.entries(TRACKS)) {
  const beats = t.melody.reduce((a, n) => a + n[1], 0);
  if (Math.abs(beats - t.roots.length * 4) > 1e-6) console.warn(`music: ${k} melody is ${beats} beats, roots say ${t.roots.length * 4}`);
}

export function createMusic(ctx, out, noiseBuf) {
  // a soft room: generated impulse response, shared by every instrument
  const verb = ctx.createConvolver();
  {
    const len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
  }
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.22;
  verb.connect(verbGain); verbGain.connect(out);

  // ---------------------------------------------------------- instruments
  function voiceOut(bus, vol, t, dur, att = 0.02, rel = 0.12) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    g.connect(bus); g.connect(verb);
    return g;
  }
  function pitch(param, f, t, dur, orn, vib) {
    // ornaments: grace note from a step above, a scoop up, or a trill
    if (orn === '^') { param.setValueAtTime(f * 1.122, t); param.setValueAtTime(f, t + 0.04); }
    else if (orn === '~') { param.setValueAtTime(f * 0.89, t); param.exponentialRampToValueAtTime(f, t + 0.1); }
    else if (orn === 't') { param.setValueAtTime(f, t); for (let x = t + 0.25, up = true; x < t + dur - 0.08; x += 0.065, up = !up) param.setValueAtTime(up ? f * 1.122 : f, x); param.setValueAtTime(f, t + dur - 0.08); }
    else param.setValueAtTime(f, t);
    if (vib) {                                      // vibrato that blooms after the attack
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vib.rate;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * vib.depth, t + Math.min(0.35, dur * 0.6));
      lfo.connect(lg); lg.connect(param);
      lfo.start(t); lfo.stop(t + dur + 0.3);
    }
  }
  function breath(bus, t, dur, freq, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2;
    const g = voiceOut(bus, vol, t, dur, 0.02, 0.05);
    s.connect(f); f.connect(g);
    s.start(t, Math.random()); s.stop(t + dur + 0.2);
  }
  const INST = {
    // 笛子: bright, breathy, a reedy buzz from the membrane
    dizi(bus, t, f, dur, orn, v = 1) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
      o.type = 'triangle'; o2.type = 'sine'; o3.type = 'square';
      for (const [osc, mul] of [[o, 1], [o2, 2], [o3, 1]]) pitch(osc.frequency, f * 2 * mul, t, dur, orn, { rate: 5.6, depth: 0.009 });
      const g = voiceOut(bus, 0.26 * v, t, dur, 0.03, 0.09);
      const g2 = ctx.createGain(); g2.gain.value = 0.22; const g3 = ctx.createGain(); g3.gain.value = 0.035;
      o.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
      for (const x of [o, o2, o3]) { x.start(t); x.stop(t + dur + 0.25); }
      breath(bus, t, Math.min(dur, 0.25), 2600, 0.05 * v);
    },
    // a cheerful human whistle: pure, an octave up, always scooping in
    whistle(bus, t, f, dur, orn, v = 1) {
      const o = ctx.createOscillator(); o.type = 'sine';
      pitch(o.frequency, f * 2, t, dur, orn || '~', { rate: 6.2, depth: 0.012 });
      const g = voiceOut(bus, 0.3 * v, t, dur, 0.02, 0.07);
      o.connect(g); o.start(t); o.stop(t + dur + 0.2);
      breath(bus, t, Math.min(dur, 0.12), 5200, 0.025 * v);
    },
    // 二胡: bowed, nasal, sliding between notes
    erhu(bus, t, f, dur, orn, v = 1) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const from = INST.erhu.last || f;
      if (!orn && Math.abs(from / f - 1) < 0.5) { o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1); pitch(o.frequency, f, t + 0.1, dur, null, { rate: 6, depth: 0.018 }); }
      else pitch(o.frequency, f, t, dur, orn, { rate: 6, depth: 0.018 });
      INST.erhu.last = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2300; lp.Q.value = 2.5;
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1000; pk.gain.value = 6;
      const g = voiceOut(bus, 0.16 * v, t, dur, 0.09, 0.15);
      o.connect(lp); lp.connect(pk); pk.connect(g);
      o.start(t); o.stop(t + dur + 0.3);
    },
    // 箫: the low end-blown flute, soft and airy
    xiao(bus, t, f, dur, orn, v = 1) {
      const o = ctx.createOscillator(); o.type = 'sine';
      pitch(o.frequency, f, t, dur, orn, { rate: 4.6, depth: 0.008 });
      const g = voiceOut(bus, 0.3 * v, t, dur, 0.12, 0.2);
      o.connect(g); o.start(t); o.stop(t + dur + 0.4);
      breath(bus, t, dur, 1400, 0.04 * v);
    },
    // 古筝 / 琵琶: plucked strings, a bright attack that mellows
    pluck(bus, t, f, dur, v = 1, bright = 4200, decay = 1.2) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'sawtooth'; o2.type = 'triangle';
      o.frequency.value = f; o2.frequency.value = f * 1.003;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus); g.connect(verb);
      for (const x of [o, o2]) { x.start(t); x.stop(t + decay + 0.05); }
    },
    epiano(bus, t, f, dur, orn, v = 1) {
      for (const [mul, vol] of [[1, 0.32], [2, 0.08], [3.01, 0.03]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
        o.connect(g); g.connect(bus); g.connect(verb);
        o.start(t); o.stop(t + dur + 1.3);
      }
    },
  };
  // ---------------------------------------------------------- percussion
  const DRUM = {
    dagu(bus, t, v = 1) {                         // 大鼓: deep, round thump
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.55);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.25 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      s.connect(lp); lp.connect(ng); ng.connect(bus); s.start(t, Math.random()); s.stop(t + 0.05);
    },
    block(bus, t, v = 1, hi = false) {             // 木鱼 woodblock: tok
      for (const [f, a] of [[hi ? 1100 : 820, 0.22], [hi ? 1880 : 1370, 0.1]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.setValueAtTime(a * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.08);
      }
    },
    bo(bus, t, v = 1) {                            // 钹 small cymbal: a bright splash
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      s.connect(hp); hp.connect(g); g.connect(bus); g.connect(verb); s.start(t, Math.random()); s.stop(t + 0.4);
      for (const f of [540, 800, 1170]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 1;
        const og = ctx.createGain(); og.gain.setValueAtTime(0.02 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(bp); bp.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.3);
      }
    },
    shaker(bus, t, v = 1) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.05 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(hp); hp.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + 0.06);
    },
    gong(bus, t, v = 1) {                          // the opera gong: wobbles up as it rings
      [1, 1.48, 1.92, 2.6, 3.4, 4.1].forEach((m, i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(90 * m * 0.985, t); o.frequency.linearRampToValueAtTime(90 * m * 1.02, t + 1);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * v / (i + 1), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        o.connect(g); g.connect(bus); g.connect(verb); o.start(t); o.stop(t + 3.3);
      });
    },
  };
  // drum kits: what plays on each 8th of the bar (i = 0..7), per bar index
  const KITS = {
    stroll(bus, t, i, bar, eighth) {
      if (i % 2 === 0 || i === 5 || i === 7) DRUM.block(bus, t, i % 4 === 0 ? 1 : 0.55, i % 4 === 2);
      if (i === 0 || i === 3) DRUM.dagu(bus, t, i === 0 ? 1 : 0.6);
      if (i === 4 && bar % 2) DRUM.dagu(bus, t, 0.45);
      if (i === 0 && bar % 8 === 7) DRUM.bo(bus, t);
      DRUM.shaker(bus, t + eighth / 2, 0.6);
    },
    chase(bus, t, i, bar, eighth) {
      DRUM.shaker(bus, t, 1); DRUM.shaker(bus, t + eighth / 2, 0.5);
      if (i === 0 || i === 3 || i === 4 || (i === 6 && bar % 2)) DRUM.dagu(bus, t, i === 0 ? 1 : 0.7);
      if (i === 2 || i === 6) DRUM.bo(bus, t, 0.6);
      if (i % 2) DRUM.block(bus, t, 0.5, true);
      if (bar % 8 === 7 && i === 0) DRUM.gong(bus, t, 0.7);
    },
    hush(bus, t, i, bar) {
      if (i === 0 && bar % 2 === 0) DRUM.block(bus, t, 0.35);
      if (i === 0 && bar % 8 === 0) DRUM.gong(bus, t, 0.25);
    },
    kitchen(bus, t, i, bar, eighth) {
      DRUM.block(bus, t, i % 2 ? 0.45 : 0.8, i % 2 === 1);
      if (i === 0 || i === 5) DRUM.dagu(bus, t, 0.8);
      if (i === 4) DRUM.bo(bus, t, 0.5);
      if (i === 7) DRUM.block(bus, t + eighth / 2, 0.5, true);
    },
  };

  // ---------------------------------------------------------- the player
  let cur = null;
  function build(name) {
    const tr = TRACKS[name];
    const beat = 60 / tr.bpm, events = [];
    let b = 0;
    const half = tr.melody.reduce((a, n) => a + n[1], 0) / 2;
    for (const [n, len, orn] of tr.melody) {
      if (n !== 'r') {
        const lead = tr.leads[b < half ? 0 : 1];
        events.push({ at: b, play: (bus, t) => INST[lead](bus, t, hz(n), len * beat * 0.95, orn) });
      }
      b += len;
    }
    tr.roots.forEach((root, bar) => {
      const f = hz(root), at = bar * 4;
      if (tr.comp === 'guzheng' || tr.comp === 'pipa') {
        // rising arpeggio root-5th-octave-5th; the pipa doubles it in 16ths
        const steps = [1, 1.5, 2, 1.5, 1, 1.5, 2, 3];
        steps.forEach((m, i) => events.push({ at: at + i * 0.5, play: (bus, t) => INST.pluck(bus, t, f * m * 2, 0, i % 4 === 0 ? 0.9 : 0.5, tr.comp === 'pipa' ? 5200 : 3800, tr.comp === 'pipa' ? 0.45 : 1.1) }));
        events.push({ at, play: (bus, t) => INST.pluck(bus, t, f, 0, 1, 1600, 1.6) });
        if (tr.comp === 'pipa') events.push({ at: at + 2, play: (bus, t) => INST.pluck(bus, t, f, 0, 0.8, 1600, 1) });
      } else if (tr.comp === 'guzheng-slow') {
        [1, 1.5, 2, 3].forEach((m, i) => events.push({ at: at + i, play: (bus, t) => INST.pluck(bus, t, f * m * 2, 0, 0.6, 3000, 2.2) }));
        events.push({ at, play: (bus, t) => INST.pluck(bus, t, f, 0, 1, 1200, 2.6) });
      } else if (name === 'office') {
        events.push({ at, play: (bus, t) => INST.epiano(bus, t, f, 3.5 * beat, null, 0.8) });
      }
      if (tr.kit) for (let i = 0; i < 8; i++) events.push({ at: at + i * 0.5, play: (bus, t) => KITS[tr.kit](bus, t, i, bar, beat / 2) });
    });
    events.sort((a, c) => a.at - c.at);
    return { tr, beat, events, loopBeats: tr.roots.length * 4 };
  }

  function play(name) {
    if (cur && cur.name === name) return;
    const t = ctx.currentTime;
    if (cur) {                                    // fade the old piece out, stop scheduling it
      const old = cur;
      old.stopped = true;
      old.bus.gain.setTargetAtTime(0.0001, t, 0.25);
      setTimeout(() => old.bus.disconnect(), 2500);
    }
    cur = null;
    if (!name || !TRACKS[name]) return;
    const song = build(name);
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t); bus.gain.setTargetAtTime(1, t + 0.15, 0.3);
    bus.connect(out);
    const me = { name, bus, song, start: t + 0.2, idx: 0, loop: 0, stopped: false };
    cur = me;
    const tick = () => {
      if (me.stopped) return;
      // schedule 0.6 s ahead, so a busy frame (shader compile, big scene
      // change) on a phone never makes the band drop notes
      const now = ctx.currentTime, horizon = now + 0.6;
      for (;;) {
        const ev = song.events[me.idx];
        const at = me.start + (me.loop * song.loopBeats + ev.at) * song.beat;
        if (at > horizon) break;
        if (at > now - 0.35) ev.play(bus, Math.max(at, now));
        if (++me.idx >= song.events.length) { me.idx = 0; me.loop++; }
      }
      setTimeout(tick, 100);
    };
    tick();
  }
  // offline/test: schedule `loops` passes of a piece from time t0, all at once
  function renderTo(name, t0 = 0, loops = 1) {
    const song = build(name);
    for (let l = 0; l < loops; l++) for (const ev of song.events) ev.play(out, t0 + (l * song.loopBeats + ev.at) * song.beat);
    return loops * song.loopBeats * song.beat;
  }
  return { play, renderTo, sting: (n) => DRUM[n] && DRUM[n](out, ctx.currentTime) };
}

export const TRACK_NAMES = Object.keys(TRACKS);
