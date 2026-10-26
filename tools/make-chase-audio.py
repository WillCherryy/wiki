#!/usr/bin/env python3
"""Soundtrack for the Chase edit (tools/video/chase.html), 140 BPM, A minor, numpy only. The picture is laid out on the same beat grid
(0-4 hook, 4-8 title card, 8-32 four hops of 6 beats, 32-40 win, 40-48 logo), so every tap and whip lands on the music. Layers join per hop:
kick+bass+hat, then clap+arp, then 16th hats+pad, then riser+lead. A subtle click on each tap and a soft air sweep on each page change, no bells."""
import os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck, pad, bass, impact, tick = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck', 'pad', 'bass', 'impact', 'tick'))
BPM = 140; B = 60 / BPM; NB = 48; DUR = NB * B; rng = np.random.default_rng(11)
N = int(SR * (DUR + 2.5)); z = lambda: np.zeros(N, np.float32)
DL, DR, ML, MR = z(), z(), z(), z()           # drums/fx (dry) and the music bed (ducked by the kick)
bt = lambda b: b * B
def both(buf, t, sig, g=1.0, w=0.0):
    put(buf[0], t, sig, g); put(buf[1], t + w, sig, g)
D = (DL, DR); M = (ML, MR); kicks = []
def noise(n): return rng.standard_normal(n)
def sweep(dur, f0, f1, g=1.0):
    t = t_(dur); f = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    n = bandpass(noise(len(t)), 500, 9000); return (n * 0.6 + np.sin(ph) * 0.15) * np.sin(np.pi * t / dur) ** 1.4 * g

ROOT = [33, 33, 29, 36, 31, 33]; CH = [[57, 60, 64, 69], [57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]
# ---- hook (0-4): sub thuds on 0,1,2, a building noise riser, stuttering hats into the title card
for b in (0, 1, 2): both(D, bt(b), impact()[:int(SR * .6)], .22)
both(D, bt(0), riser(bt(4), 200, 5200), .5)
for i in range(8): both(D, bt(3 + i / 8), hat(), .18 + i * .03)
# ---- title card (4-8): half-time, pad drone, sparse plucks, snare roll up into the whip
for b in (4, 6): both(D, bt(b), kick(1.0), .8); kicks.append(bt(b))
for b in (5, 7): both(D, bt(b), clap(), .55)
both(M, bt(4), pad(hz(45), bt(4)), .16, .008); both(M, bt(4), pad(hz(57), bt(4)), .1, .01)
for i, n in enumerate([69, 72, 76, 72, 69, 72, 76, 79]): both(M, bt(4 + i * .5), pluck(hz(n), .32), .22, .006)
for i in range(16): both(D, bt(6 + i / 8) + 0, snare(), .1 + i * .035)
# ---- hops (8-32)
ARP = [0, 7, 12, 15, 12, 7, 15, 19]
for h in range(4):
    s = 8 + 6 * h; r = ROOT[h + 1]; ch = CH[h + 1]
    for b in range(6):
        t = bt(s + b); both(D, t, kick(1.0), .85); kicks.append(t)
        both(M, t + bt(.5), bass(hz(r), .22), .5)
        if h >= 1 and b % 2 == 1: both(D, t, clap(), .5)
        both(D, t + bt(.5), hat(True), .2)
        if h >= 2:
            for q in range(4): both(D, t + bt(q / 4), hat(), .09 + .03 * (q % 2))
        else: both(D, t, hat(), .12)
        if h >= 1:
            for q in range(2): both(M, t + bt(q / 2), pluck(hz(r + 36 + ARP[(b * 2 + q) % 8]), .22), .14 + .02 * h, .007)
    if h >= 2: both(M, bt(s), pad(hz(ch[0] + 12), bt(6)), .12, .01); both(M, bt(s), pad(hz(ch[2] + 12), bt(6)), .1, .012)
    if h >= 3:
        both(D, bt(s), riser(bt(5), 300, 6000), .35)
        for b in range(24): both(M, bt(s + b / 4), pluck(hz(ch[b % 4] + 24), .14), .09, .005)
    # click on the tap, air on the whip (subtle, no bell)
    both(D, bt(s + 4.4), tick(1800), .25); both(D, bt(s + 4.4), tick(900), .18)
    both(D, bt(s + 5.05), sweep(.45, 900, 4200, .5), .07)
both(D, bt(7.05), sweep(.45, 900, 4200, .5), .07)
# drop out for one beat before the win, then the hit
for i in range(8): both(D, bt(31 + i / 8), snare(), .08 + i * .05)
both(D, bt(31), riser(bt(1), 400, 9000), .4)
# ---- win (32-40)
both(D, bt(32), impact(), .9); kicks.append(bt(32)); both(D, bt(32), kick(1.3), 1.0)
both(D, bt(32), bandpass(noise(int(SR * 1.6)), 3000, 11000) * np.exp(-t_(1.6) * 3.2), .45)
for i, n in enumerate([69, 72, 76, 81, 84, 88, 93]): both(M, bt(32.6 + i * .25), pluck(hz(n), .5), .2, .008)
for b in range(33, 40):
    t = bt(b); both(D, t, kick(.9), .7 if b < 38 else .45); kicks.append(t)
    if b % 2 == 0: both(D, t, clap(), .45)
    both(D, t + bt(.5), hat(True), .16)
    both(M, t + bt(.5), bass(hz(ROOT[(b - 32) % 4 + 1]), .22), .42)
for i, bb in enumerate([33.6, 34.1, 34.6]): both(M, bt(bb), pluck(hz(88 + i * 4), .6), .24, .008)
both(M, bt(32), pad(hz(57), bt(8)), .12, .01); both(M, bt(32), pad(hz(64), bt(8)), .1, .012); both(M, bt(32), pad(hz(72), bt(8)), .08, .014)
# ---- logo (40-48): soft chord swell, dots plinking in, a clean ring-out
both(D, bt(40), sweep(bt(1), 1200, 6000, .5), .1)
for i, n in enumerate([69, 72, 76, 81, 84]): both(M, bt(40.1 + i * .33), pluck(hz(n), .7), .22, .008)
for f in (45, 52, 57, 60, 64): both(M, bt(40), pad(hz(f), bt(8)), .1, .012)
both(D, bt(40), kick(1.0), .6); both(D, bt(44), kick(1.0), .45); both(D, bt(46), kick(1.0), .3)
# ---- mix: duck the music bed under every kick, then bring the two together
n = N; duck = np.ones(n, np.float32)
for t in kicks:
    i = int(t * SR); m = min(int(.28 * SR), n - i); x = np.arange(m) / SR; duck[i:i + m] *= (1 - .55 * np.exp(-x / .09)).astype(np.float32)
mix = np.stack([DL + ML * duck, DR + MR * duck], 1)
fade = np.ones(n, np.float32); e = int(DUR * SR); fo = int(1.4 * SR); fade[e - fo:e] = np.linspace(1, 0, fo); fade[e:] = 0; fade[:int(.01 * SR)] = np.linspace(0, 1, int(.01 * SR))
mix = np.tanh(mix * fade[:, None] * 1.25)[:e + int(.1 * SR)]
mix *= .92 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, 'scorcher-chase.wav'), 'wb') as wv: wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((mix * 32767).astype(np.int16).tobytes())
print('scorcher-chase.wav: %.1fs, peak %.2f' % (len(mix) / SR, np.max(np.abs(mix))))
