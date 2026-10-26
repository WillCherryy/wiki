#!/usr/bin/env python3
"""Soundtrack for the Evo edit (tools/video/evo.html), 140 BPM, A minor, numpy only. Same beat grid as the picture: 0-4 hook, 8 hops of 6 beats
(2 beats of page and tap, 4 beats of animation), 52-58 the family tree, 58-66 logo. Each hop climbs a chord (Am F C G, twice) and adds a layer;
a soft bloom as each link opens and an air sweep as the next page arrives. No bells, hits only on the hook and the final tree."""
import os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck, pad, bass, impact, tick = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck', 'pad', 'bass', 'impact', 'tick'))
BPM = 140; B = 60 / BPM; HOP0, HL, NH = 4, 6, 8; FIN = HOP0 + NH * HL; LOGO = FIN + 6; NB = LOGO + 8; DUR = NB * B; rng = np.random.default_rng(21)
N = int(SR * (DUR + 2.5)); z = lambda: np.zeros(N, np.float32)
DL, DR, ML, MR = z(), z(), z(), z(); D = (DL, DR); M = (ML, MR); kicks = []
bt = lambda b: b * B
def both(buf, t, sig, g=1.0, w=0.0): put(buf[0], t, sig, g); put(buf[1], t + w, sig, g)
def noise(n): return rng.standard_normal(n)
def sweep(dur, f0, f1, g=1.0):
    t = t_(dur); f = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    return (bandpass(noise(len(t)), 500, 9000) * 0.6 + np.sin(ph) * 0.15) * np.sin(np.pi * t / dur) ** 1.4 * g
def bloom(dur, f0, f1, g=1.0):   # a rising airy swell that opens each link
    t = t_(dur); f = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    return (bandpass(noise(len(t)), 800, 7000) * 0.5 + np.sin(ph) * 0.3) * (t / dur) ** 1.6 * np.exp(-(t / dur - 1) ** 2 * 0) * g
# chords: (bass root midi, chord tones) for Am F C G Am F C G
PROG = [(33, [57, 60, 64]), (29, [53, 57, 60]), (36, [60, 64, 67]), (31, [55, 59, 62]), (33, [57, 60, 64]), (29, [53, 57, 60]), (36, [60, 64, 67]), (31, [55, 59, 62])]
SC = [0, 2, 4, 7, 9, 12, 14, 16]   # arp steps above the chord root
# ---- hook (0-4)
for b in (0, 1, 2): both(D, bt(b), impact()[:int(SR * .6)], .22)
both(D, bt(0), riser(bt(4), 200, 5200), .5)
for i in range(8): both(D, bt(3 + i / 8), hat(), .18 + i * .03)
both(M, bt(0), pad(hz(45), bt(4)), .14, .008)
# ---- hops
for h in range(NH):
    s = HOP0 + h * HL; r, ch = PROG[h]
    both(M, bt(s), pad(hz(ch[0] + 12), bt(6)), .12, .01); both(M, bt(s), pad(hz(ch[1] + 12), bt(6)), .1, .012); both(M, bt(s), pad(hz(ch[2] + 12), bt(6)), .08, .014)
    for b in range(6):
        t = bt(s + b); full = b >= 2; both(D, t, kick(1.0), .85 if full else .45); kicks.append(t)
        both(M, t + bt(.5), bass(hz(r), .22), .5 if full else .3)
        both(D, t + bt(.5), hat(True), .2 if full else .1)
        if full and b % 2 == 1: both(D, t, clap(), .5)
        if full and h >= 2:
            for q in range(4): both(D, t + bt(q / 4), hat(), .08 + .03 * (q % 2))
        elif full: both(D, t, hat(), .12)
        if full:
            for q in range(2): both(M, t + bt(q / 2), pluck(hz(r + 36 + SC[(b * 2 + q + h) % 8] % 12 + (12 if (b + q) % 3 == 0 else 0)), .22), .13 + .01 * h, .007)
    if h >= 4:
        for b in range(16): both(M, bt(s + 2 + b / 4), pluck(hz(ch[b % 3] + 24), .14), .08, .005)
    both(D, bt(s + 1.6), tick(1800), .22); both(D, bt(s + 1.6), tick(900), .16)
    both(D, bt(s + 1.65), bloom(bt(.7), 700, 5200, .5), .09)
    both(D, bt(s + 5.55), sweep(.45, 900, 4200, .5), .07)
    if h in (3, 7): both(D, bt(s + 4), riser(bt(2), 300, 6000), .3)
both(D, bt(HOP0 - 1), sweep(bt(1), 900, 4200, .5), .07)
# ---- tree (52-58)
both(D, bt(FIN), impact(), .8); both(D, bt(FIN), kick(1.3), 1.0); kicks.append(bt(FIN))
both(D, bt(FIN), bandpass(noise(int(SR * 1.6)), 3000, 11000) * np.exp(-t_(1.6) * 3.2), .4)
for i, n in enumerate([69, 72, 76, 81, 84, 88, 93, 88]): both(M, bt(FIN + .5 + i * .5), pluck(hz(n), .6), .2, .008)
for f in (57, 64, 72, 76): both(M, bt(FIN), pad(hz(f), bt(6)), .1, .012)
for b in range(FIN + 1, LOGO):
    t = bt(b); both(D, t, kick(.9), .7); kicks.append(t)
    if b % 2 == 0: both(D, t, clap(), .45)
    both(D, t + bt(.5), hat(True), .16); both(M, t + bt(.5), bass(hz(PROG[(b - FIN) % 4][0]), .22), .42)
# ---- logo (58-66)
both(D, bt(LOGO), sweep(bt(1), 1200, 6000, .5), .1)
for i, n in enumerate([69, 72, 76, 81, 84]): both(M, bt(LOGO + .1 + i * .33), pluck(hz(n), .7), .22, .008)
for f in (45, 52, 57, 60, 64): both(M, bt(LOGO), pad(hz(f), bt(8)), .1, .012)
both(D, bt(LOGO), kick(1.0), .6); both(D, bt(LOGO + 4), kick(1.0), .45); both(D, bt(LOGO + 6), kick(1.0), .3)
n = N; duck = np.ones(n, np.float32)
for t in kicks:
    i = int(t * SR); m = min(int(.28 * SR), n - i); x = np.arange(m) / SR; duck[i:i + m] *= (1 - .55 * np.exp(-x / .09)).astype(np.float32)
mix = np.stack([DL + ML * duck, DR + MR * duck], 1)
fade = np.ones(n, np.float32); e = int(DUR * SR); fo = int(1.4 * SR); fade[e - fo:e] = np.linspace(1, 0, fo); fade[e:] = 0; fade[:int(.01 * SR)] = np.linspace(0, 1, int(.01 * SR))
mix = np.tanh(mix * fade[:, None] * 1.25)[:e + int(.1 * SR)]; mix *= .92 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, 'scorcher-evo.wav'), 'wb') as wv: wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((mix * 32767).astype(np.int16).tobytes())
print('scorcher-evo.wav: %.1fs, peak %.2f' % (len(mix) / SR, np.max(np.abs(mix))))
