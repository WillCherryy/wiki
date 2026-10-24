#!/usr/bin/env python3
"""Score for the hops advert: Beethoven's Ode to Joy (Symphony No. 9, public domain), arranged here as a building orchestral piece and synthesised from scratch (no samples): violins carry the tune, then add flutes and horns; pizzicato-style cellos and violas drive the 8ths, timpani and a snare that rolls into every transition, cymbal crashes on every hop, and the whole piece lands on a D major tutti when Scorcher appears. Everything sits on a beat grid (one hop = 8 beats at 94 bpm), and the picture's transitions land on those beats. Cues come from tools/video/.hops-events.json. numpy only.
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
BPM = 94; B = 60 / BPM; rng = np.random.default_rng(9)
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







HOP = 5.1; B = HOP / 8; D0 = 3 * B
def D(h): return D0 + h * HOP
PC = {'D': [2, 6, 9], 'A': [9, 1, 4], 'G': [7, 11, 2]}; ROOT = {'D': 38, 'A': 45, 'G': 43}
def tones(ch, lo, hi): return sorted(m for m in range(lo, hi + 1) if m % 12 in PC[ch])
def lowpass(x, fc):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); return np.fft.irfft(X / (1 + (f / fc) ** 4), n)
def bow(m, dur, vel=.7, att=.02, stac=False, vib=True):
    f = hz(m); t = t_(dur); K = int(min(16, 7500 / f)); out = np.zeros(len(t))
    ph0 = 2 * np.pi * np.cumsum(f * (1 + (.0035 * np.sin(2 * np.pi * 5.6 * t + m) * np.minimum(t / .25, 1) if vib else 0))) / SR
    for d in (.9975, 1.0, 1.0028):
        ph = ph0 * d
        for k in range(1, K + 1): out += np.sin(k * ph) / k ** 1.05
    env = np.minimum(t / att, 1) * (np.exp(-t * 14) if stac else np.minimum((dur - t) / .05, 1))
    return out / 3 * env * vel * .5
def stab(m, dur=.12, vel=.6): return bow(m, dur, vel, .004, True, False)
def horn(m, dur, vel=.7):
    t = t_(dur); o = sum(saw(hz(m) * d, t, 10) for d in (.998, 1.002)); o = lowpass(o, 1500) * vel * .22
    return o * np.minimum(t / .07, 1) * np.minimum((dur - t) / .06, 1)
def flute(m, dur, vel=.7):
    t = t_(dur); f = hz(m) * (1 + .004 * np.sin(2 * np.pi * 5 * t)); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + .35 * np.sin(2 * ph) + .12 * np.sin(3 * ph)) * vel * .3 * np.minimum(t / .05, 1) * np.minimum((dur - t) / .05, 1)
def timp(m=38, g=1.0):
    t = t_(.9); fr = hz(m) * (1 + .6 * np.exp(-t * 28)); ph = 2 * np.pi * np.cumsum(fr) / SR
    return (np.sin(ph) * np.exp(-t * 5.5) + .5 * noise(len(t)) * np.exp(-t * 90) * .5) * g
# Ode to Joy in D major: (beats, midi)
A1 = [[(1, 66), (1, 66), (1, 67), (1, 69)], [(1, 69), (1, 67), (1, 66), (1, 64)], [(1, 62), (1, 62), (1, 64), (1, 66)], [(1.5, 66), (.5, 64), (2, 64)]]
A2 = A1[:3] + [[(1.5, 64), (.5, 62), (2, 62)]]
BR = [[(1, 64), (1, 64), (1, 66), (1, 62)], [(1, 64), (.5, 66), (.5, 67), (1, 66), (1, 62)], [(1, 64), (.5, 66), (.5, 67), (1, 66), (.5, 64), (.5, 62)], [(2, 64), (2, 57)]]
MEL = [A1, A2, BR, A2]
CH = [[('D', 'D'), ('D', 'A'), ('D', 'D'), ('A', 'A')], [('D', 'D'), ('D', 'A'), ('D', 'D'), ('D', 'D')], [('G', 'G'), ('D', 'D'), ('G', 'D'), ('A', 'A')], [('D', 'D'), ('D', 'A'), ('D', 'D'), ('D', 'D')]]
for h in range(8):
    ph = h // 2; half = h % 2; lvl = h
    for j in range(2):
        bar = half * 2 + j; t0 = D(h) + j * 4 * B; chs = CH[ph][bar]; x = 0.0
        for bt, m in MEL[ph][bar]:
            ts = t0 + x * B; dur = bt * B * .98 + .04; x += bt
            both(dry, ts, bow(m, dur, .8), 1.0); both(send, ts, bow(m, dur, .5), .25)
            if lvl >= 1: both(dry, ts, bow(m + 12, dur, .6), .55)
            if lvl >= 3: both(dry, ts, flute(m + 12, dur, .7), .5)
            if lvl >= 5: both(dry, ts, horn(m - 12, dur, .8), .7); both(dry, ts, horn(m, dur, .6), .45)
        for e in range(8):
            c = chs[0] if e < 4 else chs[1]; tt = t0 + e * B / 2; mid = tones(c, 55, 71)
            if lvl >= 1 and e % 2 == 1:
                for m in mid[:3]: both(dry, tt, stab(m, B * .3, .5), .5)
            if lvl >= 4:
                for q in range(2): both(dry, tt + q * B / 4, stab(mid[1 + q % 2], B * .2, .45 + .2 * (q == 0)), .4)
        for bt in range(4):
            c = chs[0] if bt < 2 else chs[1]; r = ROOT[c] + (12 if lvl >= 2 and bt % 2 else 0)
            both(mus, t0 + bt * B, bow(r, B * .9, .9, .01, True, False), .9)
            if lvl >= 1 and bt % 2 == 0: both(dry, t0 + bt * B, timp(ROOT[c] - 0 if ROOT[c] < 45 else 33, 1.0), .5 + .05 * lvl)
        if lvl >= 2:
            for m in tones(chs[0], 38, 62)[:4]: both(dry, t0, stab(m, B * .8, .7), .45); both(send, t0, stab(m, B * .8, .5), .3)
        if lvl >= 2: both(dry, t0, hat(True), .4 + .04 * lvl)
        if lvl >= 3:
            for bt in range(4): both(dry, t0 + bt * B + B / 2, hat(), .14)
        if lvl >= 4:
            for bt in range(8): both(dry, t0 + bt * B / 2 + B / 4, snare(), .1 + .02 * lvl) if bt % 2 else None
    # snare roll + reverse cymbal into the next transition
    if lvl >= 1:
        for q in range(8): both(dry, D(h) + HOP - B + q * B / 8, snare(), .15 + .6 * q / 8)
        both(dry, D(h) + HOP - 1.4, sweep(1.4, 2500, 9000, .5), .35)
# intro: timpani roll swelling into the first beat, low strings
for i in range(12): t = i * (D0 / 12); both(dry, t, timp(38, .5 + .5 * i / 12), .5 * (i / 12) + .1)
both(mus, 0, bow(38, D0, .6, .3), .8); both(dry, 0, riser(D0, 150, 2800), .35)
WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]; tc = D(7) + 3.8
both(dry, tc - .05, riser(WM - tc + .1, 200, 5200), .5)
for m, v in zip((26, 38, 45, 50, 54, 57, 62, 66, 69, 74), (1, .9, .8, .8, .8, .8, .75, .75, .7, .7)): nt = bow(m, 4.2, v, .02); both(dry, WM, nt, .05); both(send, WM, nt, .06)
for m in (62, 66, 69): both(dry, WM, horn(m, 3.5, .8), .2)
both(dry, WM, timp(26, 1.4), .45); both(dry, WM, ns['impact'](), .2); both(dry, WM, hat(True), .4)
for j, m in enumerate((86, 90, 93, 98, 93, 90)): bl = bell(hz(m), .6); tt = WM + .25 + j * .2; both(dry, tt, bl, .1); both(send, tt, bl, .2)
for e in EV:
    t, kd = e['t'], e['kind']
    if kd == 'whip': both(dry, t, sweep(.45, 400, 6500, .6), .4)
    elif kd == 'mark': both(dry, t, pop(hz(96)), .14)
    elif kd == 'zoom': both(dry, t, riser(B, 300, 5200), .4)
    elif kd == 'iris': both(dry, t, thud(hz(34)), .9); both(dry, t, ns['impact'](), .2); both(dry, t, hat(True), .6); both(send, t, bell(hz(86), .6), .12)
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
