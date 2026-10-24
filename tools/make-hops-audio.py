#!/usr/bin/env python3
"""Score for the hops advert: Bach's Prelude in C major (BWV 846, public domain), synthesised here as a piano, one bar per Wikipedia hop, under a cinematic bed (sub pedal, slow pad) with a heartbeat pulse that builds into a four-on-the-floor groove, whips, a marker swipe, risers into each zoom and a thud on each iris, then a collapse into the logo and a final C major chord. Cues come from tools/video/.hops-events.json (written from the picture itself). numpy only, no samples.
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
BPM = 72.73; B = 60 / BPM; rng = np.random.default_rng(9)
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





B = 60 / 72.727; SX = B / 4; HOP = 3.3; D0 = 1.65
def D(h): return D0 + h * HOP
BARS = [[60, 64, 67, 72, 76], [60, 62, 69, 74, 77], [59, 62, 67, 74, 77], [60, 64, 67, 72, 76], [60, 64, 69, 76, 81], [60, 62, 66, 69, 74], [59, 62, 67, 74, 79], [59, 60, 64, 67, 72]]
TENSION = [59, 62, 67, 74, 77]; PATTERN = [0, 1, 2, 3, 4, 2, 3, 4]
def lowpass(x, fc):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); return np.fft.irfft(X / (1 + (f / fc) ** 4), n)
def piano(m, dur=3.0, vel=.7):
    f = hz(m); t = t_(dur); out = np.zeros(len(t)); dec0 = .9 + f / 500
    for k in range(1, 10):
        if k * f > 9500: break
        amp = vel / k ** 1.2; inh = 1 + .00035 * k * k
        for det in (-.0009, 0, .0009): out += amp / 3 * np.sin(2 * np.pi * f * k * inh * (1 + det) * t) * np.exp(-t * dec0 * (1 + .55 * (k - 1)))
    hm = noise(len(t)) * np.exp(-t * 110) * vel * .05; hm = lowpass(hm, 3500)
    return (out + hm) * np.minimum(t / .0025, 1) * np.minimum((dur - t) / .08, 1)
def pad(ms, dur, g=.05):
    t = t_(dur); o = np.zeros(len(t))
    for m in ms:
        for d in (.996, 1.0, 1.004): o += saw(hz(m) * d, t, 12)
    o = lowpass(o, 900) * g
    return o * np.minimum(t / 1.1, 1) * np.minimum((dur - t) / .9, 1)
def sub(m, dur, g=.6):
    t = t_(dur); return np.sin(2 * np.pi * hz(m) * t) * np.minimum(t / .25, 1) * np.minimum((dur - t) / .4, 1) * g
# bed + prelude: one bar per hop
for h in range(8):
    t0 = D(h); bar = BARS[h]
    both(mus, t0, sub(bar[0] - 24, HOP + .3, .55), 1.0)
    both(mus, t0, pad([bar[0] - 12, bar[2], bar[3]], HOP + 1.0, .07 + .012 * h), 1.0); both(send, t0, pad([bar[2], bar[3], bar[4]], HOP + 1.0, .04), 1.0)
    pk = piano(bar[0] - 12, 3.4, .55); both(dry, t0, pk, .55)
    for i in range(16):
        m = bar[PATTERN[i % 8]]; v = .62 + (.18 if i % 4 == 0 else 0) + (.08 if i % 8 == 0 else 0); pn = piano(m, 3.0, v)
        pan = .35 + .3 * (i % 8) / 7; put(dry[0], t0 + i * SX, pn, .5 * np.cos(pan * np.pi / 2)); put(dry[1], t0 + i * SX, pn, .5 * np.sin(pan * np.pi / 2)); both(send, t0 + i * SX, pn, .2)
# intro swell on the C pedal
both(mus, 0.0, sub(36, D0 + .3, .5), 1.0); both(mus, 0.0, pad([48, 55, 64], D0 + .6, .06), 1.0)
for i in range(4): both(dry, .2 + i * SX * 2, piano((60, 64, 67, 72)[i], 2.0, .5), .35)
# collapse bar (tension), final chord
t0 = D(7) + HOP; both(mus, t0, sub(35, 2.2, .5), 1.0); both(mus, t0, pad([47, 62, 67, 74], 2.4, .09), 1.0)
for i in range(8):
    pn = piano(TENSION[PATTERN[i]], 2.4, .7 + .02 * i); both(dry, t0 + i * SX, pn, .5); both(send, t0 + i * SX, pn, .25)
WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]
for m, v in zip((36, 48, 55, 64, 67, 72, 76, 79), (.9, .8, .7, .7, .7, .7, .65, .6)): pn = piano(m, 5.0, v); both(dry, WM, pn, .5); both(send, WM, pn, .3)
both(mus, WM, sub(24, 4.5, .9), 1.0); both(mus, WM, pad([48, 55, 60, 64, 67, 72], 4.5, .09), 1.0); both(dry, WM, ns['impact'](), .55)
for j, m in enumerate((84, 88, 91, 96, 91, 88)): bl = bell(hz(m), .6); tt = WM + .3 + j * .2; both(dry, tt, bl, .1); both(send, tt, bl, .2)
# rhythm that builds with the hops: heartbeat, then four-on-the-floor, claps, hats
for i in range(int((D(7) + HOP) / B) + 2):
    t = i * B
    if t < D(1) - .01 or t > D(7) + HOP - .1: continue
    h = int((t - D0) / HOP); heart = i % 2 == 0
    if h < 3 and not heart: continue
    both(dry, t, kick(1.0), .5 + .06 * h); kicks.append(t)
    if h >= 2: both(dry, t + B / 2, hat(True), .12 + .02 * h)
    if h >= 4 and i % 4 in (1, 3): both(dry, t, clap(), .3)
    if h >= 3: both(dry, t + B / 4, hat(), .07); both(dry, t + B * .75, hat(), .07)
    if h >= 5 and i % 4 == 0: both(mus, t, reese(hz(BARS[h][0] - 24), B * .9), .32)
for e in EV:
    t, kd = e['t'], e['kind']
    if kd == 'whip': both(dry, t, sweep(.42, 400, 6500, .6), .6)
    elif kd == 'start': both(dry, t, riser(1.2, 150, 3500), .45)
    elif kd == 'mark': both(dry, t, sweep(.4, 2000, 4200, .5), .3); both(dry, t + .42, pop(hz(96)), .16)
    elif kd == 'zoom': both(dry, t, riser(.65, 300, 5200), .55)
    elif kd == 'iris': both(dry, t, thud(hz(34)), 1.0); both(dry, t, sweep(.7, 5000, 300, .5), .4); both(send, t, bell(hz(81), .6), .16)
    elif kd == 'collapse': both(dry, t - .1, riser(1.65, 200, 5200), .55)
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
