#!/usr/bin/env python3
"""Score for the field advert: a playful marimba-and-hats stroll while the blobs wander and bump (boings and pops on every hop and collision), a gust of wind that brings in the full groove as they tumble down the hill, a launch whoosh, then bells as they form the logo in the air and a bright chord when Scorcher appears. Cues come from tools/video/.field-events.json (written from the picture itself). Based on the race score, numpy only. Output: brand/video/scorcher-field.wav

Original docstring for the race advert: (140 BPM, A minor): four-on-the-floor kick, offbeat bass, claps, 16th hats and an
arpeggio, with a bell ping on every link the dots find, a whoosh and pop at each hole, loops with a swoosh, a snare-roll build
into the final spiral and a big hit on the last drop. Cues come from tools/video/.field-events.json, written from the picture
itself, so the sound lands on what you see. numpy only, no samples. """
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck'))
D = json.load(open(os.path.join(HERE, 'video', '.field-events.json'))); DUR, EV = D['duration'], D['events']; TW = [e['t'] for e in EV if e['kind'] == 'wind'][0] + .3; WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]; TAG = [e['t'] for e in EV if e['kind'] == 'tag'][0]; ARR = [e['t'] for e in EV if e['kind'] == 'arrive']; LAUNCH = [e['t'] for e in EV if e['kind'] == 'launch']; TB = min(ARR) - 2.7
BPM = 112; B = 60 / BPM; rng = np.random.default_rng(9)
N = int(SR * (DUR + 4)); z = lambda: np.zeros(N, np.float32)
dry = [z(), z()]; send = [z(), z()]; mus = [z(), z()]; kicks = []
both = lambda bufs, t, sg, g: (put(bufs[0], t, sg, g), put(bufs[1], t, sg, g))

def noise(n): return rng.standard_normal(n)
def sweep(dur, f0, f1, g=1.0):                       # band-limited noise whose centre moves from f0 to f1
    n = int(SR * dur); x = noise(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); u = np.linspace(0, 1, len(f))
    out = np.zeros(n); k = 10
    for i in range(k):
        a, b = i / k, (i + 1) / k; c = f0 * (f1 / f0) ** ((a + b) / 2); Y = X * np.exp(-((np.log(np.maximum(f, 20)) - np.log(c)) / .55) ** 2); seg = np.fft.irfft(Y, n)
        env = np.exp(-((np.linspace(0, 1, n) - (a + b) / 2) / .12) ** 2); out += seg * env
    return out / np.max(np.abs(out)) * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.2 * g
def bell(f, vel):
    t = t_(2.4); s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1.0, 2.2), (2.756, .45, 3.4), (5.404, .22, 5.2)))
    return s * np.minimum(t / .003, 1) * vel * .55
def thud(f):
    t = t_(.5); fr = f * (.55 + .9 * np.exp(-t * 18)); ph = 2 * np.pi * np.cumsum(fr) / SR
    return (np.sin(ph) * np.exp(-t * 7) + .4 * noise(len(t)) * np.exp(-t * 120)) * 1.1
def pop(f):
    t = t_(.22); fr = f * (4 * np.exp(-t * 35) + 1); ph = 2 * np.pi * np.cumsum(fr) / SR
    return (np.sin(ph) * np.exp(-t * 18) + .3 * noise(len(t)) * np.exp(-t * 200)) * .9
def reese(f, dur):
    t = t_(dur); s = sum(saw(f * d, t, 10) for d in (.994, 1.0, 1.006)) / 3 + .7 * np.sin(2 * np.pi * f * t)
    return s * np.minimum(t / .006, 1) * np.minimum((dur - t) / .03, 1) * .55
def stab(f, dur):
    t = t_(dur); cut = 3 + 14 * np.exp(-t * 12); o = np.zeros(len(t))
    for k in range(1, 18):
        if k * f > 9000: break
        o += np.sin(2 * np.pi * k * f * t) * np.clip((cut - k) / 3, 0, 1) / k
    return o * np.minimum(t / .004, 1) * np.exp(-t * 5) * .45



def boing(m, dur=.4):
    t = t_(dur); f = hz(m) * (1 + 1.2 * np.exp(-t * 9)) * (1 + .03 * np.sin(t * 60)); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 8) * np.minimum(t / .003, 1)
PENT = [60, 62, 64, 67, 69, 72, 74, 76]; CH = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [53, 57, 60]]; BASS = [36, 43, 45, 41]
last = max(WM, TB + 4.0)
nb = int(WM / B) + 1
for i in range(nb):
    t = i * B; bar = i // 4; ch = (bar // 2) % 4; k = i % 4
    if t >= WM - .2: break
    act = TW - .1 <= t < TB + .9; calm = t < TW - .1
    if calm or act:
        both(dry, t + B / 2, hat(True), .16 if calm else .3)
        for q in (0, .5):
            m = PENT[(i * 3 + int(q * 4) + bar * 2) % len(PENT)] + (12 if (i + bar) % 5 == 0 else 0)
            if (i * 7 + int(q * 2)) % 3 != 2: pk = pluck(hz(m + 12), .3); both(mus, t + q * B, pk, .2 if calm else .26); both(send, t + q * B, pk, .12)
        if k in (0, 2): both(mus, t, pluck(hz(BASS[ch] + 12), .45), .38)
    if act:
        both(dry, t, kick(1.0), .9); kicks.append(t)
        if k in (1, 3): both(dry, t, clap(), .55)
        for q in (.25, .75): both(dry, t + q * B, hat(), .2)
        bs = reese(hz(BASS[ch] + (12 if k % 2 else 0)), B * .42); both(mus, t + B / 2, bs, .5)
        if k in (0, 2): st = stab(hz(CH[ch][0] + 24), B * .55); both(mus, t, st, .4); both(send, t, st, .16)
# the gust: noise sweeping up, then a snare roll into the launch
both(dry, TW - .6, sweep(2.6, 250, 3500, .6), .75)
tl = min(LAUNCH) if LAUNCH else TB
for j in range(16):
    th = tl - 1.4 + j * (1.4 / 16) * (1 - .3 * j / 16); both(dry, th, snare(), .15 + .5 * j / 16)
both(dry, TB - .5, riser(2.4, 220, 5000), .4)
cnt = 0
for e in EV:
    t, kd = e['t'], e['kind']; pan = e.get('pan', .5); gl, gr = np.cos(pan * np.pi / 2), np.sin(pan * np.pi / 2)
    if kd == 'hop': sg = boing(int(84 - e['b'] / 8)); put(dry[0], t, sg, .17 * gl); put(dry[1], t, sg, .17 * gr); both(send, t, sg, .1)
    elif kd == 'bump':
        if t - (globals().get('_lb', -9)) < .09: continue
        _lb = t; v = e['b']; sg = pop(hz(52 + int(v * 12))); put(dry[0], t, sg, (.12 + .3 * v) * gl); put(dry[1], t, sg, (.12 + .3 * v) * gr); both(dry, t, thud(hz(36)), .06 + .18 * v)
    elif kd == 'land' and e['b'] > .25 and t > TW: both(dry, t, thud(hz(33 + int(e['a']))), .3 + .5 * e['b'])
    elif kd == 'launch': sg = sweep(.9, 400, 6000, .6); both(dry, t - .3, sg, .5); both(dry, t, pop(hz(76 + int(e['a']) * 2)), .6); both(send, t, pop(hz(88)), .3)
    elif kd == 'arrive': bl = bell(hz((72, 76, 79, 84, 88)[int(e['a'])]), .7); both(dry, t, bl, .16); both(send, t, bl, .3)
    elif kd == 'absorb': both(dry, t, bell(hz(91 + 2 * int(e['a'])), .5), .1); both(send, t, bell(hz(91), .5), .15)
both(dry, TB + .7, sweep(2.5, 200, 2500, .5), .6)
for j, m in enumerate((57, 64, 69, 72, 76, 81)):
    t = t_(DUR - WM + 1); env = np.minimum(t / .03, 1) * np.exp(-t * .55); s = sum(saw(hz(m) * d, t, 9) for d in (.997, 1.003)) * env * .1; both(mus, WM, s, .5); both(send, WM, s, .2)
both(dry, WM, ns['impact'](), .5)
for j, m in enumerate((81, 84, 88, 93, 88, 84)): bl = bell(hz(m), .6); tt = WM + .25 + j * .16; both(dry, tt, bl, .1); both(send, tt, bl, .2)
# sidechain, reverb, master
duck = np.ones(N, np.float32)
for k in kicks:
    i = int(k * SR); n = min(int(.28 * SR), N - i); x = np.arange(n) / SR; duck[i:i + n] *= (1 - .6 * np.exp(-x / .09)).astype(np.float32)
def ir(sec=2.6):
    n = int(SR * sec); t = np.arange(n) / SR; out = []
    for _ in range(2):
        x = noise(n) * np.exp(-t * 2.2); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= 1 / (1 + (f / 4500) ** 2); out.append(np.fft.irfft(X, n))
    return out
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); X = np.fft.rfft(x, n); return np.fft.irfft(X * np.fft.rfft(h, n), n)[:len(x)]
h = ir(); wet = [conv(send[c], h[c]) * .3 for c in range(2)]
mix = np.stack([dry[c] + mus[c] * duck + wet[c] for c in range(2)], 1)[:int(SR * DUR)]
fade = np.ones(len(mix), np.float32); f0 = int(SR * 2.0); fade[-f0:] = np.linspace(1, 0, f0) ** 1.5; mix *= fade[:, None]
mix *= .55 / np.percentile(np.abs(mix), 97); mix = np.tanh(mix * 1.6) / np.tanh(1.6); mix *= .93 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, f'scorcher-field.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(DUR))]
print(f'scorcher-field.wav: {DUR:.1f}s, {len(EV)} cues, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))
