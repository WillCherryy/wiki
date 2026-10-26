#!/usr/bin/env python3
"""Soundtrack for the Sky edit (tools/video/sky.html), 140 BPM, A minor, numpy only. Cold open (low drone), the heat climbs, then each of the nine objects
lands on its own chime-free pluck that climbs one scale step per tier, the drums build, a big hit on the quasar, a breath, then the line and the logo."""
import os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck, pad, bass, impact, tick = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck', 'pad', 'bass', 'impact', 'tick'))
BPM = 140; B = 60 / BPM; NB = 38; DUR = NB * B; rng = np.random.default_rng(31)
N = int(SR * (DUR + 2.5)); z = lambda: np.zeros(N, np.float32)
DL, DR, ML, MR = z(), z(), z(), z(); D = (DL, DR); M = (ML, MR); kicks = []
bt = lambda b: b * B
def both(buf, t, sig, g=1.0, w=0.0): put(buf[0], t, sig, g); put(buf[1], t + w, sig, g)
def noise(n): return rng.standard_normal(n)
SC = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81]   # A minor pentatonic-ish climb
# cold open (0-3): a low drone and sparse ice-like ticks
both(M, bt(0), pad(hz(33), bt(3)), .2, .01); both(M, bt(0), pad(hz(45), bt(3)), .12, .012)
for i, b in enumerate((0.0, 1.0, 2.0)): both(D, bt(b), impact()[:int(SR * .8)], .16)
both(D, bt(0), riser(bt(3), 150, 3000), .35)
# the climb (3-6): a heartbeat kick and a rising pad
for b in range(3, 6): both(D, bt(b), kick(1.0), .7); kicks.append(bt(b)); both(M, bt(b + .5), bass(hz(33), .22), .4)
both(M, bt(3), pad(hz(57), bt(3)), .14, .01); both(M, bt(3), pad(hz(64), bt(3)), .1, .012); both(D, bt(4), riser(bt(2), 300, 5200), .35)
for i in range(8): both(D, bt(5 + i / 8), snare(), .08 + i * .03)
# the nine objects (6-22, then the quasar to 26)
for i in range(9):
    s = 6 + i * 2 if i < 8 else 22; L = 2 if i < 8 else 4; note = SC[i]
    both(M, bt(s), pluck(hz(note + 12), .5), .26 + .02 * i, .008); both(M, bt(s + .5), pluck(hz(note + 19), .3), .16, .008)
    both(M, bt(s), pad(hz(note - 12), bt(L)), .1, .012); both(M, bt(s), pad(hz(note), bt(L)), .08, .014)
    for b in range(int(L)):
        t = bt(s + b); both(D, t, kick(1.0), .75 + .02 * i); kicks.append(t); both(M, t + bt(.5), bass(hz(33 if i % 2 == 0 else 36), .22), .45)
        both(D, t + bt(.5), hat(True), .12 + .012 * i)
        if b % 2 == 1: both(D, t, clap(), .4 + .02 * i)
        if i >= 4:
            for q in range(4): both(D, t + bt(q / 4), hat(), .07 + .02 * (q % 2))
both(D, bt(22), impact(), .9); both(D, bt(22), kick(1.3), 1.0); both(D, bt(22), bandpass(noise(int(SR * 1.6)), 3000, 11000) * np.exp(-t_(1.6) * 3.2), .45)
for i in range(8): both(D, bt(21 + i / 8), snare(), .08 + i * .04)
both(D, bt(21), riser(bt(1), 400, 9000), .4)
# the line (26-30): a held chord and a hush
for f in (45, 57, 64, 72, 76): both(M, bt(26), pad(hz(f), bt(10)), .1, .012)
for i, n in enumerate([69, 72, 76, 81, 84, 88]): both(M, bt(27 + i * .4), pluck(hz(n), .7), .2, .008)
both(D, bt(27.1), kick(1.1), .6); kicks.append(bt(27.1)); both(D, bt(30), kick(1.0), .6); both(D, bt(34), kick(1.0), .4)
for i, n in enumerate([69, 72, 76, 81, 84]): both(M, bt(30.1 + i * .33), pluck(hz(n), .7), .22, .008)
n = N; duck = np.ones(n, np.float32)
for t in kicks:
    i = int(t * SR); m = min(int(.28 * SR), n - i); x = np.arange(m) / SR; duck[i:i + m] *= (1 - .5 * np.exp(-x / .09)).astype(np.float32)
mix = np.stack([DL + ML * duck, DR + MR * duck], 1)
fade = np.ones(n, np.float32); e = int(DUR * SR); fo = int(1.4 * SR); fade[e - fo:e] = np.linspace(1, 0, fo); fade[e:] = 0; fade[:int(.01 * SR)] = np.linspace(0, 1, int(.01 * SR))
mix = np.tanh(mix * fade[:, None] * 1.25)[:e + int(.1 * SR)]; mix *= .92 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, 'scorcher-sky.wav'), 'wb') as wv: wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((mix * 32767).astype(np.int16).tobytes())
print('scorcher-sky.wav: %.1fs, peak %.2f' % (len(mix) / SR, np.max(np.abs(mix))))
