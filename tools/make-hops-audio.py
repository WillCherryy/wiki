#!/usr/bin/env python3
"""Score for the hops advert: a calm, curious groove with a rising pluck arpeggio on every Wikipedia hop, a whip whoosh into each page, a marker swipe on the link, a riser into the zoom and a thud on the iris, then a collapse into the logo and a bright chord. Cues come from tools/video/.hops-events.json (written from the picture itself). numpy only.
Original docstring for the race advert: (140 BPM, A minor): four-on-the-floor kick, offbeat bass, claps, 16th hats and an
arpeggio, with a bell ping on every link the dots find, a whoosh and pop at each hole, loops with a swoosh, a snare-roll build
into the final spiral and a big hit on the last drop. Cues come from tools/video/.hops-events.json, written from the picture
itself, so the sound lands on what you see. numpy only, no samples. """
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck'))
D = json.load(open(os.path.join(HERE, 'video', '.hops-events.json'))); DUR, EV = D['duration'], D['events']; D0 = 1.1; HOP = 2.2; D7 = D0 + 7 * HOP; WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]
BPM = 109.09; B = 60 / BPM; rng = np.random.default_rng(9)
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




B = .55
CH = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; BASS = [33, 29, 36, 31]; PENT = [0, 2, 4, 7, 9, 12, 14, 16]
nb = int(D7 / B + 6)
for i in range(nb):
    t = i * B; bar = i // 4; ch = bar % 4; k = i % 4
    if t >= D7 + 2.1: break
    if t >= D0 - .05:
        both(dry, t, kick(1.0), .8); kicks.append(t)
        both(dry, t + B / 2, hat(True), .26)
        for q in (.25, .75): both(dry, t + q * B, hat(), .14)
        if k in (1, 3): both(dry, t, clap(), .35)
        both(mus, t, pluck(hz(BASS[ch] + 12), .5), .5)
        if k in (0, 2):
            for j, m in enumerate(CH[ch]): pk = pluck(hz(m + 12), .5); both(mus, t + j * B / 6, pk, .13); both(send, t + j * B / 6, pk, .1)
    else: both(dry, t + B / 2, hat(), .1)
hop = lambda h: min(h, 7)
for e in EV:
    t, kd = e['t'], e['kind']
    if kd == 'whip': both(dry, t, sweep(.32, 500, 6500, .6), .6)
    elif kd == 'start': both(dry, t - .1, riser(.7, 150, 3000), .45)
    elif kd == 'mark': both(dry, t, sweep(.26, 2200, 4200, .5), .32); both(dry, t + .26, pop(hz(96)), .18)
    elif kd == 'zoom': both(dry, t, riser(.4, 300, 4800), .5)
    elif kd == 'iris':
        both(dry, t, thud(hz(34)), .9); both(dry, t, clap(), .4); both(send, t, bell(hz(81), .6), .18); both(dry, t, sweep(.5, 5000, 300, .5), .35)
    elif kd == 'note':
        h = int(e['a']) // 4; j = int(e['b']); ch = h % 4; m = CH[ch][j % 3] + 12 + (12 if j == 3 else 0) + min(h, 5)
        pk = pluck(hz(m + 12), .5); both(dry, t, pk, .32); both(send, t, pk, .22); both(dry, t, bell(hz(m + 24), .35), .06)
    elif kd == 'collapse': both(dry, t - .1, riser(.95, 200, 4500), .5)
for j, m in enumerate((57, 64, 69, 72, 76, 81)):
    t = t_(DUR - WM + 1); env = np.minimum(t / .03, 1) * np.exp(-t * .6); s = sum(saw(hz(m) * d, t, 9) for d in (.997, 1.003)) * env * .1; both(mus, WM, s, .5); both(send, WM, s, .2)
both(dry, WM, ns['impact'](), .45)
for j, m in enumerate((81, 84, 88, 93, 88, 84)): bl = bell(hz(m), .6); tt = WM + .25 + j * .16; both(dry, tt, bl, .12); both(send, tt, bl, .2)
for i in range(5): both(dry, D7 + 2.3 + i * .12, bell(hz(72 + i * 4), .5), .12)
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
fade = np.ones(len(mix), np.float32); f0 = int(SR * .8); fade[-f0:] = np.linspace(1, 0, f0) ** 1.5; mix *= fade[:, None]
mix *= .55 / np.percentile(np.abs(mix), 97); mix = np.tanh(mix * 1.6) / np.tanh(1.6); mix *= .93 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, f'scorcher-hops.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(DUR))]
print(f'scorcher-hops.wav: {DUR:.1f}s, {len(EV)} cues, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))
