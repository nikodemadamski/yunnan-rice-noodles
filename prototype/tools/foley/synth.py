#!/usr/bin/env python3
"""Offline foley synthesiser for the noodle-shop cooking sounds.

Every sound is built from physically informed models rather than samples:

* modal synthesis (sums of exponentially damped, slightly inharmonic sine
  partials, struck through a contact pulse whose width sets the hardness)
  for porcelain, steel, brass, bamboo, coins and the wooden counter;
* Minnaert bubbles (van den Doel's model: f0 ~ 3.26 m/s / radius, damping
  d = 0.043 f + 0.0014 f^1.5, pitch rising as the bubble nears the surface),
  scattered as Poisson clouds, for boiling, pouring, plops and gurgles;
* Poisson crackle (heavy-tailed impulses through tiny high resonances) plus
  fluttering hiss for the sizzle of raw meat on scalding oil-sealed broth;
* band-limited noise with slow random amplitude flutter and swept
  state-variable filters for slithering noodles, stirring and slurping;
* a synthetic small-kitchen impulse response (early reflections + a two-band
  diffuse tail) so nothing sounds bone-dry.

Usage:
    pip install numpy scipy
    python3 prototype/tools/foley/synth.py            # render everything
    python3 prototype/tools/foley/synth.py sizzle_1   # render some
    python3 prototype/tools/foley/synth.py --wav DIR  # also keep the WAVs

Output: prototype/assets/sfx/<name>.m4a (AAC-LC, mono, 44.1 kHz, ~96 kbps)
plus <name>.ogg (Opus 48 kbps fallback). Needs ffmpeg with libopus. Fixed seeds: re-running gives the same sounds.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import zlib

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'sfx'))
TWO_PI = 2 * np.pi
LOOP_PAD = 0.2        # seconds of wrap-around appended to loop files


# ----------------------------------------------------------------- basics

def ns(sec):
    return int(round(sec * SR))


def tvec(n):
    return np.arange(n) / SR


def rng_for(name):
    return np.random.default_rng(zlib.crc32(name.encode()))


def add(buf, x, t0, gain=1.0, wrap=False):
    """Mix x into buf starting at t0 seconds (wrap: fold overflow to the start)."""
    i = ns(t0)
    n = len(buf)
    if wrap:
        i %= n
        while len(x):
            k = min(len(x), n - i)
            buf[i:i + k] += gain * x[:k]
            x = x[k:]
            i = 0
        return
    if i >= n:
        return
    k = min(len(x), n - i)
    buf[i:i + k] += gain * x[:k]


def sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output='sos')


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos('bandpass', [lo, hi], order), x)


def lp(x, f, order=2):
    return signal.sosfilt(sos('lowpass', f, order), x)


def hp(x, f, order=2):
    return signal.sosfilt(sos('highpass', f, order), x)


def smooth_noise(rng, n, rate_hz, circular=False):
    """Random signal band-limited to ~rate_hz, unit-ish RMS (for flutter)."""
    w = rng.standard_normal(n)
    if circular:
        W = np.fft.rfft(w)
        f = np.fft.rfftfreq(n, 1 / SR)
        W *= 1 / (1 + (f / rate_hz) ** 4)
        y = np.fft.irfft(W, n)
    else:
        y = lp(w, rate_hz, 2)
    return y / (np.std(y) + 1e-12)


def svf_bandpass(x, fc, q):
    """Zero-delay-feedback state-variable band-pass with per-sample fc (and q)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    q = np.broadcast_to(np.asarray(q, float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    y = np.empty_like(x)
    ic1 = ic2 = 0.0
    for i in range(len(x)):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + g[i] * a1[i] * v3
        v2 = ic2 + g[i] * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[i] = v1 * k[i]          # unity peak gain band-pass
    return y


def env_adsr(n, a, d_tau, start=0.0):
    t = tvec(n) - start
    e = np.where(t < 0, 0.0, np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(t - a, 0) / d_tau))
    return e


def fade(x, fin=0.0, fout=0.0):
    x = x.copy()
    if fin > 0:
        k = ns(fin)
        x[:k] *= np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    if fout > 0:
        k = ns(fout)
        x[-k:] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return x


# ----------------------------------------------------------------- models

def contact_pulse(width_ms):
    """Half-sine contact force; longer = softer strike (low-passes the modes)."""
    w = max(2, int(width_ms * 1e-3 * SR))
    p = np.sin(np.linspace(0, np.pi, w + 2)[1:-1])
    return p / p.sum()


def modal(modes, dur, rng=None, width_ms=0.1, spread=0.25, detune=0.0, damp=1.0):
    """Struck resonator: modes = [(freq_hz, t60_s, amp), ...].

    spread randomises each mode's excitation (strike position), detune its
    frequency (manufacturing scatter), damp scales all decay times.
    """
    n = ns(dur)
    t = tvec(n)
    y = np.zeros(n)
    for f, t60, a in modes:
        if rng is not None:
            a *= 1 + spread * rng.uniform(-1, 1)
            f *= 1 + detune * rng.uniform(-1, 1)
        if f >= SR * 0.47:
            continue
        y += a * np.exp(-6.91 * t / (t60 * damp)) * np.sin(TWO_PI * f * t)
    return signal.fftconvolve(y, contact_pulse(width_ms))[:n]


def bubble(f0, amp=1.0, rise=0.1, decay_mul=1.0, fmax_mul=1.8, life=None):
    """Minnaert bubble, van den Doel style: rising pitch, exponential decay.

    Damping follows the instantaneous pitch (smaller = faster decay), so the
    rising tail dies away instead of whistling. life: the bubble bursts at the
    surface after that many seconds (short fade), as large boiling bubbles do.
    """
    d0 = (0.043 * f0 + 0.0014 * f0 ** 1.5) * decay_mul
    n = ns(min(7.0 / d0, 1.2) if life is None else min(7.0 / d0, life + 0.006))
    t = tvec(n)
    f = np.minimum(f0 * (1 + rise * d0 * t), f0 * fmax_mul)
    d = (0.043 * f + 0.0014 * f ** 1.5) * decay_mul
    ph = TWO_PI * np.cumsum(f) / SR
    env = np.exp(-np.cumsum(d) / SR) * np.minimum(1, t / 0.0005)
    if life is not None:
        env *= np.clip((life + 0.006 - t) / 0.006, 0, 1)
    return amp * np.sin(ph) * env


def bubble_amp(f0, rng, ref=1000.0, k=0.55, sd=0.45):
    """Bigger (lower) bubbles are louder; lognormal scatter on top."""
    return (ref / f0) ** k * rng.lognormal(0, sd)


def poisson_times(rng, t0, t1, rate_fn, rmax):
    """Inhomogeneous Poisson process by thinning."""
    n = rng.poisson(rmax * (t1 - t0))
    ts = np.sort(rng.uniform(t0, t1, n))
    keep = rng.uniform(0, rmax, n) < rate_fn(ts)
    return ts[keep]


def bubble_cloud(buf, rng, t0, t1, rate_fn, rmax, fmin, fmax, amp=1.0,
                 rise=(0.05, 0.4), decay_mul=1.0, fshift=None, wrap=False, k=0.55):
    """Scatter bubbles: radii log-distributed so small ones dominate the count."""
    for ts in poisson_times(rng, t0, t1, rate_fn, rmax):
        u = rng.uniform() ** 0.7                     # skew toward small bubbles
        f = fmin * (fmax / fmin) ** u
        if fshift is not None:
            f *= fshift(ts)
        b = bubble(f, bubble_amp(f, rng, k=k) * amp, rng.uniform(*rise), decay_mul)
        add(buf, b, ts, wrap=wrap)


def crackle_pop(rng, fmin=1800, fmax=11000):
    """One crisp micro-pop: a few-hundred-microsecond high resonance."""
    f = fmin * (fmax / fmin) ** rng.uniform()
    tau = rng.uniform(0.00012, 0.0011)
    n = ns(tau * 7) + 2
    t = tvec(n)
    y = np.exp(-t / tau) * np.sin(TWO_PI * f * t + rng.uniform(0, np.pi))
    y[0] += rng.uniform(-0.6, 0.6)                    # a bit of raw click
    return y


def noise_burst(rng, dur, lo, hi, attack=0.002, tau=0.02, order=2):
    n = ns(dur)
    x = bp(rng.standard_normal(n), lo, hi, order)
    return x * env_adsr(n, attack, tau)


def drop_plink(rng, f0=None, amp=1.0):
    """A falling droplet: tiny impact splash + strongly chirping bubble."""
    f0 = f0 or rng.uniform(900, 3200)
    y = bubble(f0, amp, rise=rng.uniform(0.5, 1.4), decay_mul=1.3)
    s = noise_burst(rng, 0.012, 2500, 12000, 0.0003, 0.0018) * amp * 0.35
    y[:len(s)] += s
    return y


# ----------------------------------------------------------------- materials

# Large porcelain noodle bowl. Ring-bending modes n=2..5 follow roughly
# n(n^2-1)/sqrt(n^2+1) (1 : 2.8 : 5.4 : 8.8), each split into a slightly
# detuned doublet (that slow shimmer real bowls have), plus weak odd modes.
BOWL = [
    (1185, 1.0, 1.0), (1188.4, 1.0, 0.55),
    (3310, 0.6, 0.6), (3318, 0.6, 0.3),
    (6290, 0.34, 0.33), (6305, 0.34, 0.18),
    (9980, 0.18, 0.16),
    (2240, 0.35, 0.10), (4730, 0.25, 0.09), (7900, 0.15, 0.06),
]
# Same bowl holding hot broth: liquid mass loads and damps the walls.
BOWL_FULL = [(f * 0.88, t60 * 0.32, a) for f, t60, a in BOWL]
# Small ceramic sauce dish / tip dish.
DISH = [
    (2310, 0.55, 1.0), (2316, 0.55, 0.5), (5480, 0.32, 0.55), (5492, 0.32, 0.3),
    (9600, 0.17, 0.25), (3900, 0.2, 0.1), (13100, 0.1, 0.1),
]
# Stainless ladle held in a hand (handle damping shortens the ring).
LADLE = [(2650, 0.22, 0.5), (4170, 0.18, 0.45), (7320, 0.12, 0.3), (10450, 0.08, 0.2), (1210, 0.1, 0.12)]
# Wooden counter / board: low, very damped plate modes.
COUNTER = [(118, 0.10, 1.0), (176, 0.08, 0.7), (262, 0.06, 0.55), (415, 0.045, 0.4), (690, 0.03, 0.25), (1130, 0.02, 0.15)]
BOARD = [(185, 0.07, 1.0), (312, 0.055, 0.8), (525, 0.045, 0.6), (880, 0.032, 0.4), (1460, 0.022, 0.25), (2350, 0.015, 0.12)]
# Coin (small nickel-plated steel disc) - high, ringing.
COIN = [(4380, 0.55, 1.0), (7520, 0.4, 0.7), (9950, 0.33, 0.55), (12900, 0.25, 0.4), (6100, 0.3, 0.2)]
# Wire noodle basket.
WIRE = [(2120, 0.14, 0.6), (3610, 0.12, 0.6), (5930, 0.1, 0.5), (8350, 0.07, 0.35), (980, 0.08, 0.2)]


def bamboo(f1):
    """Free-free bar (chopstick): partials 1 : 2.756 : 5.404 : 8.933, heavily damped."""
    return [(f1, 0.07, 0.45), (f1 * 2.756, 0.05, 1.0), (f1 * 5.404, 0.035, 0.8), (f1 * 8.933, 0.022, 0.55),
            (f1 * 13.34, 0.015, 0.3)]


# ----------------------------------------------------------------- room

def room_ir(seed=7, rt60=0.30, size=1.0):
    """Small tiled kitchen: sparse early reflections + two-band diffuse tail."""
    rng = np.random.default_rng(seed)
    n = ns(rt60 * 1.3)
    ir = np.zeros(n)
    ir[0] = 1.0
    early = np.array([2.6, 4.1, 5.9, 7.3, 9.4, 11.2, 13.8, 16.1, 19.5, 23.0, 27.4]) * size
    for k, ms in enumerate(early):
        i = ns(ms / 1000)
        g = 0.5 * (0.8 ** k) * rng.uniform(0.7, 1.1) * (1 if rng.uniform() > 0.2 else -1)
        ir[i:i + 3] += g * np.array([0.5, 1.0, 0.5]) / 2   # slight smear = absorption
    t = tvec(n)
    w = rng.standard_normal(n)
    tail = lp(w, 2600, 2) * np.exp(-6.91 * t / rt60) + 0.6 * hp(w, 2600, 2) * np.exp(-6.91 * t / (rt60 * 0.55))
    onset = np.clip((t - 0.008) / 0.015, 0, 1)
    tail *= onset
    tail *= np.sqrt(0.08 / np.sum(tail ** 2))           # direct-to-reverb ~ +11 dB
    ir += tail
    return ir


ROOM = room_ir()


def apply_room(x, wet, loop=False):
    if wet <= 0:
        return x
    ir = ROOM.copy()
    ir[1:] *= wet / 0.25
    if loop:
        y = signal.fftconvolve(x, ir)
        out = y[:len(x)].copy()
        tail = y[len(x):]
        out[:len(tail)] += tail                        # circular: tail wraps to the start
        return out
    return signal.fftconvolve(x, ir)


# ----------------------------------------------------------------- loudness

def loudness_db(x):
    """Rough momentary loudness: K-ish weighting, max 100 ms RMS."""
    w = hp(x, 80, 2) + 0.55 * hp(x, 2000, 1)
    win = ns(0.1)
    p = signal.fftconvolve(w ** 2, np.ones(win) / win, mode='valid')
    return 10 * np.log10(np.max(p) + 1e-12)


def finish(x, room=0.22, loop=False, target=-17.0, peak_db=-3.0, tail_db=-62.0):
    x = apply_room(x, room, loop)
    if loop:
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(len(x), 1 / SR)
        X *= 1 / np.sqrt(1 + (30 / np.maximum(f, 1e-3)) ** 4)   # circular 30 Hz high-pass
        X[0] = 0
        x = np.fft.irfft(X, len(x))
    else:
        x = hp(x, 30, 2)
        pk = np.max(np.abs(x))
        loud = np.nonzero(np.abs(x) > pk * 10 ** (tail_db / 20))[0]
        end = min(len(x), loud[-1] + ns(0.03)) if len(loud) else len(x)
        x = fade(x[:end], 0.0, min(0.06, end / SR * 0.2))
    # Gain to the loudness target; if that would push transients past the peak
    # ceiling, let a soft lookahead limiter shave up to 4 dB off the clicks
    # (so a chopstick clack isn't quieter than a pour), then cap the peak.
    ceil = 10 ** (peak_db / 20)
    g = 10 ** ((target - loudness_db(x)) / 20)
    g = min(g, ceil / np.max(np.abs(x)) * 10 ** (4 / 20))
    x = limit(x * g, ceil)
    return x * min(1.0, ceil / np.max(np.abs(x)))


def limit(x, ceil, look_ms=1.5, release_ms=40):
    """Soft lookahead peak limiter (gain dips smoothly around each peak)."""
    need = np.minimum(1.0, ceil / np.maximum(np.abs(x), 1e-9))
    w = max(3, ns(look_ms / 1000))
    g = minimum_filter1d(need, 2 * w + 1)            # lookahead: duck before the peak
    a = np.exp(-1 / ns(release_ms / 1000))
    out = np.empty_like(g)
    cur = 1.0
    for i, v in enumerate(g):                          # instant attack, smooth release
        cur = v if v < cur else 1 - a * (1 - cur)
        if cur > v:
            cur = v
        out[i] = cur
    win = np.hanning(w + 2)[1:-1]
    out = np.convolve(out, win / win.sum(), 'same')
    return x * out


# ----------------------------------------------------------------- sounds

def s_pour_broth(rng):
    dur = 2.45
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    on, off = 0.06, 1.95
    # stream intensity: quick swell, slight wobble from the ladle tilt, thinning tail
    env = np.clip((t - on) / 0.12, 0, 1) * np.clip((off - t) / 0.35 + 0.15, 0, 1)
    env = np.clip(env, 0, 1) * (1 + 0.15 * smooth_noise(rng, n, 3))
    env = np.maximum(env, 0)
    prog = np.clip((t - on) / (off - on), 0, 1)           # fill level 0..1

    # 1) stream bubbles: entrained air, pitch rising as the bowl fills
    def rate(ts):
        return 950 * np.interp(ts, t, env)
    bubble_cloud(buf, rng, on, off + 0.1, rate, 1100, 450, 3600, amp=0.10,
                 rise=(0.1, 0.8), fshift=lambda ts: 1 + 0.7 * np.interp(ts, t, prog))
    # a few deep glugs as the stream first punches in
    for k in range(4):
        add(buf, bubble(rng.uniform(220, 380), 0.55, 0.6, 0.8), on + 0.02 + k * rng.uniform(0.03, 0.07))
    # 2) splashing stream noise with fast flutter (column breaking up)
    flut = np.abs(1 + 0.8 * smooth_noise(rng, n, 35))
    noise = bp(rng.standard_normal(n), 250, 8000) * flut * env
    # 3) the rising "filling" cavity resonance (air column above the broth)
    fc = 620 * (1 + 2.0 * prog ** 1.3)
    reso = svf_bandpass(noise, fc, 4.5) + 0.5 * svf_bandpass(noise, fc * 2.1, 6)
    body = lp(rng.standard_normal(n), 320, 2) * env * (1.2 - 0.6 * prog)
    buf += 0.10 * noise + 0.30 * reso + 0.35 * body
    # 4) the stream breaks into a dribble, then the last drips
    for ts in np.sort(rng.uniform(off - 0.05, off + 0.2, 7)):
        add(buf, drop_plink(rng, rng.uniform(1400, 2600), 0.25), ts)
    add(buf, drop_plink(rng, 1900, 0.3), off + 0.33)
    add(buf, drop_plink(rng, 2300, 0.18), off + 0.47)
    return finish(buf, room=0.25)


def s_ladle_clink(rng):
    buf = np.zeros(ns(0.9))
    for t0, g in ((0.005, 1.0), (0.2, 0.62)):
        hit = modal(BOWL_FULL, 0.8, rng, width_ms=0.07, spread=0.3)
        hit += 0.7 * modal(LADLE, 0.8, rng, width_ms=0.05, spread=0.3)
        click = hp(rng.standard_normal(ns(0.002)), 4000) * np.linspace(1, 0, ns(0.002))
        hit[:len(click)] += 0.25 * click
        add(buf, hit, t0, g)
    # a drop shaken off the ladle
    add(buf, drop_plink(rng, 2100, 0.12), 0.42)
    return finish(buf, room=0.28)


def s_plop_light(rng, k):
    buf = np.zeros(ns(0.6))
    if k == 3:          # leafy greens: soft splat, small low bubble
        add(buf, noise_burst(rng, 0.06, 500, 3500, 0.002, 0.012), 0.004, 0.5)
        add(buf, bubble(rng.uniform(650, 800), 0.45, 0.6, 1.1), 0.012)
        add(buf, bubble(rng.uniform(1500, 1900), 0.15, 1.0), 0.05)
    else:               # petal / chopped scallion: a crisp chirping plink
        if k == 2:      # flutters onto the surface first
            add(buf, noise_burst(rng, 0.02, 1500, 6000, 0.001, 0.004), 0.004, 0.2)
        t0 = 0.004 if k == 1 else 0.035
        add(buf, noise_burst(rng, 0.015, 2000, 9000, 0.0004, 0.0025), t0, 0.35)
        f0 = 980 if k == 1 else 1220
        add(buf, bubble(f0, 1.0, rise=1.0 if k == 1 else 0.75, decay_mul=0.9), t0 + 0.002)
        add(buf, bubble(f0 * 1.9, 0.18, 0.6), t0 + rng.uniform(0.03, 0.06))
    return finish(buf, room=0.24, target=-19)


def s_plop_heavy(rng, k):
    buf = np.zeros(ns(0.9))
    t0 = 0.004
    # low thump of the mass hitting the surface
    thump = lp(rng.standard_normal(ns(0.08)), 260, 4) * env_adsr(ns(0.08), 0.004, 0.018)
    if k == 1:          # meat slice: flat slap, wide shallow splash
        add(buf, thump, t0, 3.0)
        add(buf, noise_burst(rng, 0.12, 400, 5000, 0.0015, 0.022), t0, 0.9)
        add(buf, bubble(330, 0.9, 0.5, 0.9), t0 + 0.008)
        add(buf, bubble(560, 0.5, 0.7), t0 + 0.02)
        ndrops = 5
    elif k == 2:        # egg: round, deep "bloop" from the cavity it drags down
        add(buf, thump, t0, 2.2)
        add(buf, noise_burst(rng, 0.06, 600, 4000, 0.001, 0.01), t0, 0.5)
        add(buf, bubble(290, 1.2, 1.4, 0.7, fmax_mul=1.8), t0 + 0.03)
        add(buf, bubble(720, 0.35, 0.9), t0 + 0.07)
        ndrops = 3
    else:               # noodle bundle: wetter, longer, several slaps
        for j, g in enumerate((1.0, 0.6, 0.4)):
            add(buf, thump, t0 + j * 0.035, 2.4 * g)
            add(buf, noise_burst(rng, 0.1, 300, 4500, 0.002, 0.03), t0 + j * 0.035, 0.7 * g)
        add(buf, bubble(360, 0.8, 0.5), t0 + 0.012)
        bubble_cloud(buf, rng, 0.02, 0.35, lambda ts: 160 * np.exp(-ts / 0.12), 160, 500, 2200, amp=0.22)
        ndrops = 4
    # splash droplets falling back and the bubbles left behind
    for ts in np.sort(rng.uniform(0.07, 0.3, ndrops)):
        add(buf, drop_plink(rng, rng.uniform(1300, 3200), rng.uniform(0.08, 0.2)), ts)
    bubble_cloud(buf, rng, 0.05, 0.5, lambda ts: 25 * np.exp(-ts / 0.2), 25, 700, 2000, amp=0.12)
    return finish(buf, room=0.24)


def s_sizzle(rng, k):
    dur = 1.45
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    t0 = 0.012
    # the slice touching down
    add(buf, lp(rng.standard_normal(ns(0.05)), 400, 2) * env_adsr(ns(0.05), 0.003, 0.012), t0, 1.2)
    add(buf, bubble(420, 0.25, 0.4), t0 + 0.004)
    tau1 = 0.26 if k == 1 else 0.34
    rate = lambda ts: np.where(ts < t0, 0, 2600 * np.exp(-(ts - t0) / tau1) + 140 * np.exp(-(ts - t0) / 0.8))
    # crisp micro-pops, heavy-tailed sizes
    for ts in poisson_times(rng, t0, dur, rate, 2750):
        a = min(6.0, rng.pareto(2.2) + 0.4) * 0.07
        add(buf, crackle_pop(rng) * a, ts)
    # bigger spits: steam bursting through the oil film
    for ts in poisson_times(rng, t0, dur, lambda ts: 28 * np.exp(-(ts - t0) / 0.45), 30):
        add(buf, noise_burst(rng, 0.02, 2500, 12000, 0.0003, 0.003) * 0.35, ts)
        add(buf, bubble(rng.uniform(1600, 4000), 0.12, 2.0, 1.4), ts)
    # frying bubbles under the slice
    bubble_cloud(buf, rng, t0, dur, lambda ts: 220 * np.exp(-(ts - t0) / 0.3), 220, 600, 2600, amp=0.05)
    # fluttering hiss, following the crackle density
    dens = np.sqrt(rate(t) / 2740)
    hiss = bp(rng.standard_normal(n), 3000, 13000, 2) * dens * np.abs(1 + 0.6 * smooth_noise(rng, n, 60))
    buf += 0.07 * hiss
    return finish(buf, room=0.2)


def s_oil_pour(rng):
    dur = 1.15
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    on, off = 0.02, 0.62
    env = np.clip((t - on) / 0.05, 0, 1) * np.clip((off - t) / 0.25, 0, 1)
    # thick, smooth stream: low, rounded noise
    stream = bp(rng.standard_normal(n), 150, 1400, 2) * env * np.abs(1 + 0.4 * smooth_noise(rng, n, 9))
    buf += 0.35 * stream
    # glugs as air gulps back into the oil jug (slow, low, viscous)
    for j, ts in enumerate((0.04, 0.16, 0.27, 0.37, 0.46)):
        f = rng.uniform(170, 260) * (1 + 0.08 * j)
        add(buf, bubble(f, 0.9 * (1 - 0.12 * j), 0.6, 1.6, 1.4, life=rng.uniform(0.05, 0.09)), ts)
        add(buf, lp(rng.standard_normal(ns(0.04)), 500) * env_adsr(ns(0.04), 0.005, 0.01) * 0.6, ts)
    # landing on broth: few soft bubbles
    bubble_cloud(buf, rng, 0.05, off, lambda ts: 70 + 0 * ts, 70, 500, 1500, amp=0.12, decay_mul=1.4)
    # the slick spreading over hot broth: a faint soft fizz that swells and fades
    fizz = hp(rng.standard_normal(n), 3500, 2) * np.clip((t - 0.2) / 0.3, 0, 1) * np.exp(-np.maximum(t - 0.5, 0) / 0.25)
    for ts in poisson_times(rng, 0.2, dur, lambda ts: 300 * np.exp(-np.maximum(ts - 0.5, 0) / 0.2), 300):
        add(buf, crackle_pop(rng, 3000, 10000) * 0.025, ts)
    buf += 0.025 * fizz
    return finish(buf, room=0.22, target=-18)


def s_egg_crack(rng):
    buf = np.zeros(ns(1.2))

    def shell_crack(t0, nclicks, span, g):
        add(buf, modal(BOWL_FULL, 0.5, rng, width_ms=0.15, spread=0.3), t0, 0.35 * g)
        knock = bp(rng.standard_normal(ns(0.02)), 500, 1600) * env_adsr(ns(0.02), 0.0005, 0.004)
        add(buf, knock, t0, 0.6 * g)
        for ts in np.sort(rng.uniform(0, span, nclicks)) ** 1.3 / span ** 0.3:
            add(buf, crackle_pop(rng, 2000, 7500) * rng.uniform(0.3, 1.0) * g, t0 + ts)

    shell_crack(0.01, 6, 0.006, 0.8)                  # first tap
    shell_crack(0.2, 14, 0.018, 1.0)                  # second tap breaks it
    # thumbs pull the shell open: dry crinkle
    for ts in poisson_times(rng, 0.42, 0.52, lambda ts: 180 + 0 * ts, 180):
        add(buf, crackle_pop(rng, 2500, 8000) * rng.uniform(0.1, 0.4), ts)
    # wet slip of the egg white
    m = ns(0.14)
    slip = bp(rng.standard_normal(m), 350, 2200) * np.abs(1 + 0.8 * smooth_noise(rng, m, 25)) * env_adsr(m, 0.02, 0.05)
    add(buf, slip, 0.5, 0.12)
    # the egg slides into the broth
    add(buf, lp(rng.standard_normal(ns(0.05)), 300, 4) * env_adsr(ns(0.05), 0.003, 0.012), 0.62, 1.2)
    add(buf, bubble(560, 0.6, 1.1, 0.9), 0.625)
    add(buf, bubble(980, 0.2, 0.9), 0.66)
    add(buf, drop_plink(rng, 2100, 0.08), 0.72)
    return finish(buf, room=0.24)


def s_noodle_slide(rng):
    dur = 1.35
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    # slithering off the plate: low-mid wet friction with slow flutter
    slide_env = np.clip(t / 0.06, 0, 1) * np.clip((0.55 - t) / 0.25, 0, 1)
    flut = np.clip(1 + 0.9 * smooth_noise(rng, n, 11), 0, None)
    slither = bp(rng.standard_normal(n), 350, 2800) * slide_env * flut
    buf += 0.10 * slither
    # sticky little wet smacks as strands peel off each other
    for ts in poisson_times(rng, 0.0, 0.5, lambda ts: 45 + 0 * ts, 45):
        m = ns(0.008)
        add(buf, bp(rng.standard_normal(m), 400, 2500) * env_adsr(m, 0.0005, 0.0015), ts, rng.uniform(0.05, 0.25))
    # the bundle meets the broth
    tin = 0.28
    thump = lp(rng.standard_normal(ns(0.08)), 280, 4) * env_adsr(ns(0.08), 0.006, 0.025)
    add(buf, thump, tin, 2.2)
    add(buf, noise_burst(rng, 0.15, 350, 4000, 0.004, 0.04), tin, 0.6)
    add(buf, bubble(340, 0.7, 0.6), tin + 0.01)
    # continuing slide into the broth: wet swish + dense bubble tail
    sub_env = np.clip((t - tin) / 0.04, 0, 1) * np.exp(-np.maximum(t - tin, 0) / 0.22)
    buf += 0.10 * bp(rng.standard_normal(n), 300, 3500) * sub_env * flut
    bubble_cloud(buf, rng, tin, dur, lambda ts: 200 * np.exp(-(ts - tin) / 0.22), 200, 500, 2400, amp=0.16)
    for ts in np.sort(rng.uniform(tin + 0.05, tin + 0.35, 4)):
        add(buf, drop_plink(rng, rng.uniform(1500, 3000), 0.08), ts)
    return finish(buf, room=0.24)


def s_noodle_lift(rng):
    dur = 1.9
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    # wire basket knocks the pot rim
    add(buf, modal(WIRE, 0.4, rng, width_ms=0.08), 0.005, 0.35)
    # breaking the surface: rush of water + big bubbles
    add(buf, lp(rng.standard_normal(ns(0.25)), 700, 2) * env_adsr(ns(0.25), 0.03, 0.08), 0.03, 0.9)
    add(buf, noise_burst(rng, 0.3, 500, 7000, 0.02, 0.09), 0.04, 0.45)
    bubble_cloud(buf, rng, 0.03, 0.3, lambda ts: 250 * np.exp(-(ts - 0.03) / 0.1), 250, 220, 1100, amp=0.3)
    # water pouring back through the mesh: dense drops thinning to drips
    drain = lambda ts: np.where(ts < 0.12, 0, 420 * np.exp(-(ts - 0.12) / 0.32) + 6)
    for ts in poisson_times(rng, 0.12, dur - 0.1, drain, 430):
        add(buf, drop_plink(rng, amp=0.09 * rng.lognormal(0, 0.4)), ts)
    stream = bp(rng.standard_normal(n), 900, 7000) * np.sqrt(drain(t) / 426) * np.abs(1 + 0.6 * smooth_noise(rng, n, 30))
    buf += 0.06 * stream
    # distinct last drips
    for ts in (1.05, 1.28, 1.44, 1.63, 1.77):
        add(buf, drop_plink(rng, rng.uniform(1400, 2400), rng.uniform(0.12, 0.22)), ts)
    return finish(buf, room=0.28)


def loop_render(rng, L, build):
    buf = np.zeros(ns(L))
    build(buf)
    return buf


def s_boil_loop(rng):
    L = 4.0
    n = ns(L)
    buf = np.zeros(n)
    flat = lambda r: (lambda ts: r + 0 * ts)
    # surging intensity, periodic over the loop (integer cycles)
    tt = tvec(n)
    surge = 1 + 0.25 * np.sin(TWO_PI * 2 * tt / L + 0.4) + 0.15 * np.sin(TWO_PI * 5 * tt / L + 1.3)
    sg = lambda ts: np.interp(ts % L, tt, surge)
    # big rolling blubs, mid bubbles, small fizz
    for ts in poisson_times(rng, 0, L, lambda ts: 16 * sg(ts), 24):
        add(buf, bubble(rng.uniform(110, 260), 1.0 * rng.lognormal(0, 0.3), rng.uniform(0.3, 0.9), 0.9, 1.6,
                       life=rng.uniform(0.03, 0.12)), ts, wrap=True)
        add(buf, lp(rng.standard_normal(ns(0.04)), 450) * env_adsr(ns(0.04), 0.004, 0.012), ts, 0.5, wrap=True)
    bubble_cloud(buf, rng, 0, L, lambda ts: 140 * sg(ts), 200, 280, 1300, amp=0.28, wrap=True)
    bubble_cloud(buf, rng, 0, L, lambda ts: 420 * sg(ts), 600, 1300, 4200, amp=0.10, wrap=True)
    # surface spits
    for ts in poisson_times(rng, 0, L, flat(18), 18):
        add(buf, noise_burst(rng, 0.03, 1500, 9000, 0.001, 0.006), ts, 0.18, wrap=True)
    # rumbling bed (circular-filtered noise)
    w = rng.standard_normal(n)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    W *= 1 / np.sqrt(1 + (f / 500) ** 2) / np.sqrt(1 + (60 / np.maximum(f, 1)) ** 4)
    bed = np.fft.irfft(W, n)
    bed = bed / np.std(bed) * surge * np.abs(1 + 0.5 * smooth_noise(rng, n, 6, circular=True))
    buf += 0.06 * bed
    return finish(buf, room=0.2, loop=True, target=-19)


def s_simmer_loop(rng):
    L = 4.0
    n = ns(L)
    buf = np.zeros(n)
    for ts in poisson_times(rng, 0, L, lambda ts: 16 + 0 * ts, 16):
        f = 600 * (2600 / 600) ** rng.uniform() ** 0.8
        add(buf, bubble(f, bubble_amp(f, rng) * 0.6, rng.uniform(0.2, 1.2)), ts, wrap=True)
    for ts in poisson_times(rng, 0, L, lambda ts: 2.5 + 0 * ts, 2.5):
        add(buf, bubble(rng.uniform(330, 520), 0.9, rng.uniform(0.4, 1.0), 0.9, life=rng.uniform(0.05, 0.15)), ts, wrap=True)
        add(buf, drop_plink(rng, rng.uniform(1800, 3000), 0.1), ts + 0.03, wrap=True)
    for ts in poisson_times(rng, 0, L, lambda ts: 30 + 0 * ts, 30):
        add(buf, crackle_pop(rng, 3000, 9000) * 0.03, ts, wrap=True)
    w = rng.standard_normal(n)
    W = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    W *= 1 / np.sqrt(1 + (f / 350) ** 2) / np.sqrt(1 + (80 / np.maximum(f, 1)) ** 4)
    bed = np.fft.irfft(W, n)
    buf += 0.02 * bed / np.std(bed) * np.abs(1 + 0.4 * smooth_noise(rng, n, 2, circular=True))
    return finish(buf, room=0.22, loop=True, target=-21)


def chopstick_clack(rng, g=1.0):
    fa, fb = rng.uniform(470, 520), rng.uniform(530, 590)
    y = modal(bamboo(fa), 0.25, rng, width_ms=0.05, spread=0.35)
    y += 0.8 * modal(bamboo(fb), 0.25, rng, width_ms=0.05, spread=0.35)
    click = hp(rng.standard_normal(ns(0.0015)), 3000) * np.linspace(1, 0, ns(0.0015))
    y[:len(click)] += 0.35 * click
    return y * g


def s_chopsticks(rng, k):
    buf = np.zeros(ns(0.5))
    if k == 1:          # clack-clack: tapping the tips together
        add(buf, chopstick_clack(rng), 0.004)
        add(buf, chopstick_clack(rng, 0.75), 0.13)
    else:               # one clack and a little rattle as they settle
        add(buf, chopstick_clack(rng), 0.004)
        add(buf, chopstick_clack(rng, 0.25), 0.026)
        add(buf, chopstick_clack(rng, 0.12), 0.041)
    return finish(buf, room=0.24, target=-18)


def s_bowl_set(rng):
    buf = np.zeros(ns(0.9))
    for t0, g, w in ((0.004, 0.45, 0.5), (0.02, 1.0, 0.35), (0.048, 0.18, 0.3)):
        add(buf, modal(BOWL_FULL, 0.7, rng, width_ms=w, spread=0.35), t0, 0.5 * g)
        add(buf, modal(COUNTER, 0.4, rng, width_ms=1.2, spread=0.3), t0, 1.6 * g)
    # heavy bowl body: a soft low thump, and grit of the unglazed foot ring
    add(buf, lp(rng.standard_normal(ns(0.06)), 160, 4) * env_adsr(ns(0.06), 0.004, 0.015), 0.02, 3.0)
    add(buf, noise_burst(rng, 0.03, 2500, 8000, 0.001, 0.006), 0.02, 0.12)
    # broth sloshing in the bowl
    add(buf, bp(rng.standard_normal(ns(0.25)), 300, 1500) * env_adsr(ns(0.25), 0.04, 0.06), 0.04, 0.08)
    add(buf, bubble(780, 0.12, 0.6), 0.09)
    return finish(buf, room=0.26)


def s_saucer_set(rng):
    buf = np.zeros(ns(0.8))
    contacts = ((0.004, 1.0), (0.034, 0.5), (0.056, 0.32), (0.071, 0.2), (0.081, 0.12))
    for t0, g in contacts:
        add(buf, modal(DISH, 0.7, rng, width_ms=0.12, spread=0.4, damp=0.6), t0, 0.6 * g)
        add(buf, modal([(f * 1.6, t60, a) for f, t60, a in COUNTER], 0.3, rng, width_ms=0.6), t0, 0.9 * g)
    return finish(buf, room=0.26, target=-18)


def s_stir(rng):
    dur = 1.15
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    env = np.clip(t / 0.1, 0, 1) * np.clip((dur - 0.05 - t) / 0.35, 0, 1)
    speed = 0.6 + 0.4 * np.sin(TWO_PI * 1.8 * t) ** 2          # two laps round the bowl
    fc = 700 * 2 ** (0.9 * np.sin(TWO_PI * 1.8 * t + 0.5))
    w = rng.standard_normal(n) * env * speed * np.abs(1 + 0.6 * smooth_noise(rng, n, 14))
    swish = lp(svf_bandpass(w, fc, 2.2), 2600, 2) + 0.05 * bp(w, 2000, 5000)
    buf += 0.25 * swish
    bubble_cloud(buf, rng, 0.05, dur - 0.2, lambda ts: 110 * np.interp(ts, t, env * speed), 110, 350, 1800, amp=0.16)
    # chopsticks brushing the side of the full bowl
    for t0, g in ((0.27, 0.6), (0.82, 0.4)):
        add(buf, modal(BOWL_FULL, 0.4, rng, width_ms=0.25), t0, 0.2 * g)
        add(buf, chopstick_clack(rng, 0.25 * g), t0)
    return finish(buf, room=0.22, target=-19)


def s_slurp(rng, k):
    dur = 0.95 if k == 1 else 1.25
    n = ns(dur)
    buf = np.zeros(n)
    t = tvec(n)
    if k == 1:
        segs = [(0.02, 0.62)]
    else:
        segs = [(0.02, 0.28), (0.4, 0.95)]
    air = np.zeros(n)
    for a, b in segs:
        air += np.clip((t - a) / 0.02, 0, 1) * np.clip((b - t) / 0.06, 0, 1)
    # liquid and noodles keep interrupting the air jet
    gate = np.clip(0.55 + 0.7 * smooth_noise(rng, n, 28), 0.05, 1.4)
    jet = rng.standard_normal(n) * air * gate
    # mouth opening changes along the slurp: formants sweep
    sweep = np.interp(t, [0, 0.15, 0.5, 1.0, dur], [1500, 2400, 2900, 2300, 2000])
    voice = svf_bandpass(jet, sweep, 3.5) + 0.55 * svf_bandpass(jet, sweep * 1.85, 5) + 0.12 * hp(jet, 5000)
    buf += 0.35 * voice
    # wet gurgles in the mouth
    for a, b in segs:
        bubble_cloud(buf, rng, a, b, lambda ts: 45 + 0 * ts, 45, 300, 1300, amp=0.25, rise=(0.6, 2.0), decay_mul=1.5)
        # noodle strands slapping the lips
        for ts in poisson_times(rng, a, b, lambda ts: 14 + 0 * ts, 14):
            m = ns(0.01)
            add(buf, bp(rng.standard_normal(m), 250, 1800) * env_adsr(m, 0.0005, 0.002), ts, rng.uniform(0.15, 0.4))
        # lips close on the last strand: little "tp"
        m = ns(0.03)
        pop = lp(rng.standard_normal(m), 900, 2) * env_adsr(m, 0.0008, 0.004) + 0.4 * bubble(600, 1.0, 0.5, 2.5)[:m]
        add(buf, pop, b - 0.01, 0.35)
    return finish(buf, room=0.2, target=-18)


def s_knife_chop(rng, k):
    buf = np.zeros(ns(0.55))
    t_hit = 0.03
    if k == 1:          # through spring onion: crisp crunch, then the board
        for ts in np.sort(rng.uniform(0.004, t_hit, 22)):
            add(buf, crackle_pop(rng, 1500, 8000) * rng.uniform(0.15, 0.6), ts)
        add(buf, noise_burst(rng, 0.03, 1200, 7000, 0.006, 0.006), 0.004, 0.2)
    else:               # through meat: soft, wet give
        m = ns(t_hit)
        add(buf, bp(rng.standard_normal(m), 300, 2000) * np.linspace(0.2, 1, m), 0.004, 0.18)
    add(buf, modal(BOARD, 0.35, rng, width_ms=0.4, spread=0.3), t_hit, 1.0)
    add(buf, lp(rng.standard_normal(ns(0.06)), 110, 4) * env_adsr(ns(0.06), 0.003, 0.02), t_hit, 3.5)
    blade = [(1350, 0.1, 0.5), (3720, 0.08, 0.6), (5640, 0.06, 0.5), (8100, 0.04, 0.3)]
    add(buf, modal(blade, 0.3, rng, width_ms=0.06, spread=0.3), t_hit, 0.08)
    click = hp(rng.standard_normal(ns(0.0015)), 2500) * np.linspace(1, 0, ns(0.0015))
    add(buf, click, t_hit, 0.15)
    return finish(buf, room=0.24)


def s_coin_drop(rng):
    buf = np.zeros(ns(1.5))

    def impact(t0, g, on_coin=False):
        add(buf, modal(COIN, 0.9, rng, width_ms=0.04, spread=0.6, detune=0.01, damp=0.7), t0, 0.35 * g)
        if not on_coin:
            add(buf, modal(DISH, 0.6, rng, width_ms=0.06, spread=0.4, damp=0.5), t0, 0.4 * g)

    for c, (t0, g) in enumerate(((0.005, 1.0), (0.13, 0.85), (0.24, 0.7))):
        dt, gg = 0.075, g
        tt = t0
        for b in range(6):                      # bounces, each lower and quicker
            impact(tt, gg, on_coin=(c > 0 and b % 2 == 1))
            tt += dt
            dt *= 0.62
            gg *= 0.55
        for j in range(7):                      # flat rattle as it settles
            impact(tt + j * 0.008 * (1 - j * 0.08), gg * 0.6 * (1 - j * 0.1), on_coin=c > 0)
    return finish(buf, room=0.26)


def s_bell_counter(rng):
    f1 = 1870
    modes = [
        (f1, 2.6, 1.0), (f1 * 1.0017, 2.6, 0.7),
        (f1 * 2.43, 1.7, 0.55), (f1 * 2.445, 1.7, 0.35),
        (f1 * 3.92, 1.0, 0.32), (f1 * 5.61, 0.65, 0.2), (f1 * 7.48, 0.4, 0.12), (f1 * 0.57, 1.6, 0.08),
    ]
    buf = np.zeros(ns(2.8))
    tick = bp(rng.standard_normal(ns(0.006)), 800, 3000) * env_adsr(ns(0.006), 0.0003, 0.0012)
    add(buf, tick, 0.003, 0.25)                  # the plunger
    add(buf, modal(modes, 2.75, rng, width_ms=0.05, spread=0.15), 0.008, 1.0)
    return finish(buf, room=0.3, target=-18, tail_db=-55)


SOUNDS = {
    'pour_broth': s_pour_broth,
    'ladle_clink': s_ladle_clink,
    **{f'plop_light_{k}': (lambda rng, k=k: s_plop_light(rng, k)) for k in (1, 2, 3)},
    **{f'plop_heavy_{k}': (lambda rng, k=k: s_plop_heavy(rng, k)) for k in (1, 2, 3)},
    **{f'sizzle_{k}': (lambda rng, k=k: s_sizzle(rng, k)) for k in (1, 2)},
    'oil_pour': s_oil_pour,
    'egg_crack': s_egg_crack,
    'noodle_slide': s_noodle_slide,
    'noodle_lift': s_noodle_lift,
    'boil_loop': s_boil_loop,
    'simmer_loop': s_simmer_loop,
    **{f'chopsticks_{k}': (lambda rng, k=k: s_chopsticks(rng, k)) for k in (1, 2)},
    'bowl_set': s_bowl_set,
    'saucer_set': s_saucer_set,
    'stir': s_stir,
    **{f'slurp_{k}': (lambda rng, k=k: s_slurp(rng, k)) for k in (1, 2)},
    **{f'knife_chop_{k}': (lambda rng, k=k: s_knife_chop(rng, k)) for k in (1, 2)},
    'coin_drop': s_coin_drop,
    'bell_counter': s_bell_counter,
}


# ----------------------------------------------------------------- output

def write_wav(path, x, rng):
    d = (rng.uniform(-0.5, 0.5, len(x)) + rng.uniform(-0.5, 0.5, len(x))) / 32768   # TPDF dither
    pcm = np.clip(np.round((x + d) * 32767), -32768, 32767).astype(np.int16)
    wavfile.write(path, SR, pcm)


def encode(wav, out):
    """AAC-LC .m4a (Safari/iOS, Chrome, Edge) + Ogg Opus fallback for browsers
    built without the proprietary AAC decoder (e.g. open-source Chromium)."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '96k',
                    '-ac', '1', '-ar', str(SR), '-movflags', '+faststart', out], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libopus', '-b:a', '48k',
                    '-ac', '1', '-application', 'audio', out[:-4] + '.ogg'], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('names', nargs='*', help='sounds to render (default: all)')
    ap.add_argument('--wav', help='also keep the 16-bit WAVs in this directory')
    ap.add_argument('--out', default=OUT_DIR)
    args = ap.parse_args()
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found')
    names = args.names or list(SOUNDS)
    os.makedirs(args.out, exist_ok=True)
    tmp = args.wav or tempfile.mkdtemp()
    os.makedirs(tmp, exist_ok=True)
    for name in names:
        rng = rng_for(name)
        x = SOUNDS[name](rng)
        if name.endswith('_loop'):
            # One period plus a repeat of its first LOOP_PAD seconds: any window of
            # exactly LOOP_LEN inside is seamless, whatever priming/padding the
            # AAC/Opus decoder leaves. foley.js loops [0.1 s, 0.1 s + LOOP_LEN].
            x = np.concatenate([x, x[:ns(LOOP_PAD)]])
        wav = os.path.join(tmp, name + '.wav')
        write_wav(wav, x, rng)
        out = os.path.join(args.out, name + '.m4a')
        encode(wav, out)
        print(f'{name:16s} {len(x) / SR:5.2f}s  peak {20 * np.log10(np.max(np.abs(x))):6.1f} dBFS  '
              f'loud {loudness_db(x):6.1f}  {os.path.getsize(out) / 1024:6.1f} KB m4a  '
              f'{os.path.getsize(out[:-4] + ".ogg") / 1024:6.1f} KB ogg')
    if not args.wav:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
