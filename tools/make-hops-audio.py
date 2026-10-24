#!/usr/bin/env python3
"""Score for the hops advert, in the spirit of the Presto from Vivaldi's Summer (G minor, 188 bpm): a driving string orchestra synthesised from scratch (no samples) with racing 16th-note violin figures, repeated-note storm tremolo and scale runs, off-beat viola chords, a cello/bass 8th-note engine, tutti stabs and timpani, building hop by hop, then a collapse into the logo and a final G major tutti. It is original music written in that style, not a copy of the score. Cues come from tools/video/.hops-events.json. numpy only.
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
BPM = 188.2; B = 60 / BPM; rng = np.random.default_rng(9)
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






HOP = 5.1; B = HOP / 16; SX = B / 4; D0 = 6 * B
def D(h): return D0 + h * HOP
PC = {'Gm': [7, 10, 2], 'Cm': [0, 3, 7], 'D7': [2, 6, 9, 0], 'Eb': [3, 7, 10], 'F': [5, 9, 0], 'Bb': [10, 2, 5], 'Am7b5': [9, 0, 3, 7]}
ROOT = {'Gm': 7, 'Cm': 0, 'D7': 2, 'Eb': 3, 'F': 5, 'Bb': 10, 'Am7b5': 9}
PHR = [['Gm', 'Gm', 'Cm', 'D7'], ['Gm', 'Cm', 'D7', 'Gm'], ['Gm', 'Cm', 'F', 'Bb'], ['Eb', 'Am7b5', 'D7', 'Gm'], ['Gm', 'Cm', 'D7', 'Gm'], ['Cm', 'F', 'Bb', 'Eb'], ['Am7b5', 'D7', 'Gm', 'D7'], ['Gm', 'Cm', 'D7', 'D7']]
SCALE = [7, 9, 10, 0, 2, 3, 6]                      # G harmonic minor
def tones(ch, lo, hi, pcs=None):
    p = pcs or PC[ch]; return sorted(m for m in range(lo, hi + 1) if m % 12 in p)
def lowpass(x, fc):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); return np.fft.irfft(X / (1 + (f / fc) ** 4), n)
def bow(m, dur, vel=.7, att=.012, stac=False, vib=True):
    f = hz(m); t = t_(dur); K = int(min(16, 7500 / f)); out = np.zeros(len(t))
    ph0 = 2 * np.pi * np.cumsum(f * (1 + (.0035 * np.sin(2 * np.pi * 5.6 * t + m) * np.minimum(t / .25, 1) if vib else 0))) / SR
    for d in (.9975, 1.0, 1.0028):
        ph = ph0 * d
        for k in range(1, K + 1): out += np.sin(k * ph) / k ** 1.05
    env = np.minimum(t / att, 1) * (np.exp(-t * 14) if stac else np.minimum((dur - t) / .03, 1))
    return out / 3 * env * vel * .5
def stab(m, dur=.12, vel=.6): return bow(m, dur, vel, .004, True, False)
def timp(m=31, g=1.0):
    t = t_(.9); fr = hz(m) * (1 + .6 * np.exp(-t * 28)); ph = 2 * np.pi * np.cumsum(fr) / SR
    return (np.sin(ph) * np.exp(-t * 5.5) + .5 * noise(len(t)) * np.exp(-t * 90) * .5) * g
nbar = 4 * 8
for h in range(8):
    for b in range(4):
        ch = PHR[h][b]; t0 = D(h) + b * 4 * B; lvl = h; first = b == 0
        top = tones(ch, 69, 88); mid = tones(ch, 55, 74); low = tones(ch, 36, 52); bar = h * 4 + b
        # violins: tremolo storm on bar 0, arpeggios on 1 and 3, scale run on 2
        style = b % 4 if h % 2 == 0 else (b + 1) % 4
        seq = []
        if style == 0: seq = [top[len(top) // 2]] * 16
        elif style in (1, 3):
            ext = top + [m + 12 for m in top if m + 12 <= 91]; ix = [0, 1, 2, 3, 4, 3, 2, 1] * 2
            seq = [ext[min(i, len(ext) - 1)] for i in ix]
        else:
            rt = ROOT[ch]; sc = [m for m in range(60, 92) if m % 12 in SCALE]; s0 = min(range(len(sc)), key=lambda i: (abs(sc[i] % 12 - rt) > 0, abs(sc[i] - 67)))
            idx = list(range(s0, s0 + 8)) + list(range(s0 + 7, s0 - 1, -1)); seq = [sc[min(i, len(sc) - 1)] for i in idx]
        for i, m in enumerate(seq):
            v = .55 + (.25 if i % 4 == 0 else 0) + .02 * lvl; nt = bow(m, SX * 1.15, v, .006, True); pan = .3 + .4 * (i % 8) / 7
            put(dry[0], t0 + i * SX, nt, 1.1 * np.cos(pan * np.pi / 2)); put(dry[1], t0 + i * SX, nt, 1.1 * np.sin(pan * np.pi / 2)); both(send, t0 + i * SX, nt, .3)
        # viola off-beat chords (from hop 1)
        if lvl >= 1:
            for j in range(8):
                for m in mid[:3]: both(dry, t0 + j * B / 2 + B / 4, stab(m, B * .3, .5), .5)
        # cello/bass: driving 8ths on the root, octave jumps
        for j in range(8):
            rm = low[0] + (12 if j % 4 == 2 else 0); nt = bow(rm, B / 2 * .9, .85, .006, True, False); both(mus, t0 + j * B / 2, nt, .9)
        # tutti stabs on bar downbeats (phrase starts louder)
        if lvl >= 2 and (first or b == 2):
            for m in low[:2] + mid[:3] + top[:2]: both(dry, t0, stab(m, B * .55, .8 if first else .55), .5); both(send, t0, stab(m, B * .55, .6), .3)
        # timpani on the downbeat and a fill at the end of a phrase
        if lvl >= 4: both(dry, t0, timp(31 if ROOT[ch] in (7, 3) else 36), .9)
        if lvl >= 4 and b == 3:
            for j in range(4): both(dry, t0 + 3 * B + j * B / 4, timp(36), .3 + .08 * j)
# intro: low tremolo swelling in on G, and a bar of bass
for i in range(int(D0 / SX)):
    t = i * SX; v = .15 + .6 * (t / D0); both(mus, t, bow(55, SX * 1.1, v, .006, True, False), .7); both(dry, t, bow(79, SX * 1.1, v * .7, .006, True), .6)
both(dry, 0, riser(D0, 150, 2800), .35)
# collapse (the dominant D7 builds) and the final G major tutti
WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]; tc = D(7) + 3.8
both(dry, tc - .05, riser(WM - tc + .1, 200, 5200), .55)
for i in range(int((WM - tc) / SX)): t = tc + i * SX; both(dry, t, bow(86 if i % 2 else 81, SX * 1.1, .6 + .03 * i, .006, True), .7); both(dry, t, timp(38, 1.0), .4 * (i % 4 == 0))
for m, v in zip((31, 43, 50, 55, 59, 62, 67, 71, 74, 79), (1, .9, .8, .8, .8, .8, .75, .75, .7, .7)): nt = bow(m, 4.2, v, .02); both(dry, WM, nt, .11); both(send, WM, nt, .12)
both(dry, WM, timp(31, 1.4), .6); both(dry, WM, ns['impact'](), .3)
for j, m in enumerate((86, 91, 95, 98, 95, 91)): bl = bell(hz(m), .6); tt = WM + .25 + j * .2; both(dry, tt, bl, .1); both(send, tt, bl, .2)
for i in range(int(D(7) / B) + 1):
    t = i * B
    if t < D(2) - .01 or t > D(7) + 3.8: continue
    both(dry, t + B / 2, hat(True), .1)
for e in EV:
    t, kd = e['t'], e['kind']
    if kd == 'whip': both(dry, t, sweep(.45, 400, 6500, .6), .4)
    elif kd == 'mark': both(dry, t, sweep(.4, 2000, 4200, .5), .2)
    elif kd == 'zoom': both(dry, t, riser(.65, 300, 5200), .4)
    elif kd == 'iris': both(dry, t, thud(hz(34)), .7); both(dry, t, sweep(.7, 5000, 300, .5), .3); both(send, t, bell(hz(81), .6), .12)
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
