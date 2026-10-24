#!/usr/bin/env python3
"""Soft, unhurried score for the calm advert: glass bells and marimba on a pentatonic scale, a warm pad and a long reverb.
Every note is placed from tools/video/.calm-events.json, which tools/make-calm.js writes from the picture itself, so what you
hear lands on what you see.  numpy only: no samples, no licences.  Output: brand/video/scorcher-calm.wav"""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); SR = 44100
EV = json.load(open(os.path.join(HERE, 'video', '.calm-events.json'))); DUR = EV['duration']; B = 60 / 96
N = int(SR * (DUR + 4)); rng = np.random.default_rng(3)
t_ = lambda d: np.arange(int(SR * d)) / SR; hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
dry = [np.zeros(N, np.float32), np.zeros(N, np.float32)]; send = [np.zeros(N, np.float32), np.zeros(N, np.float32)]

def put(buf, t0, sig, g=1.0):
    i = int(t0 * SR); n = min(len(sig), len(buf) - i)
    if n > 0 and i >= 0: buf[i:i + n] += (sig[:n] * g).astype(np.float32)

def bell(f, vel):                                   # glass bell: inharmonic partials, each fading at its own rate
    t = t_(3.2); s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1.0, 1.7), (2.756, .45, 2.8), (5.404, .22, 4.4), (8.93, .1, 6.5)))
    return s * np.minimum(t / .004, 1) * vel * .5

def marimba(f, vel):                                # warm wooden tone: fundamental plus a short, bright fourth partial
    t = t_(1.6); s = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.4) + .35 * np.sin(2 * np.pi * f * 3.99 * t) * np.exp(-t * 14) + .06 * rng.standard_normal(len(t)) * np.exp(-t * 90)
    return s * np.minimum(t / .003, 1) * vel * .7

def chime(f, vel):                                  # tiny high shimmer
    t = t_(2.6); s = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.6) + .5 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 4.0)
    return s * np.minimum(t / .003, 1) * vel * .32 * (1 + .25 * np.sin(2 * np.pi * 5 * t) * np.exp(-t * 2))

KIND = {'bell': bell, 'marimba': marimba, 'chime': chime}
for e in EV['events']:
    sg = KIND[e['kind']](hz(e['midi'] + (12 if e['kind'] == 'chime' else 0)), e['vel']); pan = e['pan']
    for ch, gain in ((0, np.cos(pan * np.pi / 2)), (1, np.sin(pan * np.pi / 2))):
        put(dry[ch], e['t'], sg, .55 * gain * 1.2); put(send[ch], e['t'], sg, .75 * gain * 1.2)
# pad: a slow cycle of C, Am, F, G chords with long overlapping swells
CH = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 53, 57, 60], [43, 50, 55, 59]]
for bar in range(int(DUR / (4 * B)) + 1):
    t0 = bar * 4 * B - .3; d = 4 * B + 1.4; tt = t_(d); env = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.6
    for k, m in enumerate(CH[bar % 4]):
        s = sum(np.sin(2 * np.pi * hz(m) * dt * tt + ph) for dt, ph in ((.997, 0), (1.003, 1.3))) * env * (.045 if k else .06)
        put(dry[k % 2], max(0, t0), s, 1.0); put(dry[(k + 1) % 2], max(0, t0), s, .4); put(send[0], max(0, t0), s, .3); put(send[1], max(0, t0), s, .3)
# a soft rush of air as the dots gather into the word, and a low breath under the finish
def air(d, lo, hi):
    n = int(SR * d); x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((np.log(np.maximum(f, 20)) - np.log((lo * hi) ** .5)) / .9) ** 2); y = np.fft.irfft(X, n)
    return y / np.max(np.abs(y)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
a = air(7 * B, 500, 3500)
for ch in (0, 1): put(dry[ch], 26 * B, a, .12); put(send[ch], 26 * B, a, .2)
sub = np.sin(2 * np.pi * hz(36) * t_(8 * B)) * np.sin(np.pi * np.linspace(0, 1, int(SR * 8 * B))) ** 1.5
for ch in (0, 1): put(dry[ch], 38 * B, sub, .14)
# reverb: a long, soft, slightly dark tail
def ir(sec=4.2):
    n = int(SR * sec); t = np.arange(n) / SR; out = []
    for _ in range(2):
        x = rng.standard_normal(n) * np.exp(-t * 1.5); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= 1 / (1 + (f / 3600) ** 2); out.append(np.fft.irfft(X, n))
    return out
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); X = np.fft.rfft(x, n); return np.fft.irfft(X * np.fft.rfft(h, n), n)[:len(x)]
h = ir(); wet = [conv(send[0], h[0]) * .42, conv(send[1], h[1]) * .42]
mix = np.stack([dry[0] + wet[0], dry[1] + wet[1]], 1)[:int(SR * DUR)]
fade = np.ones(len(mix), np.float32); f0 = int(SR * 1.8); fade[-f0:] = np.linspace(1, 0, f0) ** 1.4; fi = int(SR * .4); fade[:fi] = np.linspace(0, 1, fi); mix *= fade[:, None]
mix *= 0.5 / np.percentile(np.abs(mix), 99); mix = np.tanh(mix * 1.2) / np.tanh(1.2); mix *= .9 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, 'scorcher-calm.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(DUR))]
print(f'scorcher-calm.wav: {DUR:.1f}s, {len(EV["events"])} notes, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))
