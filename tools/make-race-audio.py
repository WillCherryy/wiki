#!/usr/bin/env python3
"""Fast, punchy score for the race advert (140 BPM, A minor): four-on-the-floor kick, offbeat bass, claps, 16th hats and an
arpeggio, with a bell ping on every link the dots find, a whoosh and pop at each hole, loops with a swoosh, a snare-roll build
into the final spiral and a big hit on the last drop. Cues come from tools/video/.race-events.json, written from the picture
itself, so the sound lands on what you see. numpy only, no samples. Output: brand/video/scorcher-race.wav"""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck'))
D = json.load(open(os.path.join(HERE, 'video', '.race-events.json'))); DUR, EV, T0, ENDT, LASTT = D['duration'], D['events'], D['t0'], D['endT'], D['lastT']; SUF = D.get('suffix', '')
BPM = 140; B = 60 / BPM; rng = np.random.default_rng(9)
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

# groove grid: bar lines start where the race starts
ROOT = [33, 29, 36, 31]; CHORD = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]
beat = lambda i: T0 + i * B
nb = int((LASTT - T0) / B) + 1
for i in range(-int(T0 / B) - 1, nb):
    t = beat(i)
    if t < 0: continue
    bar = i // 4; ch = (bar // 2) % 4; k = i % 4; build = t >= ENDT
    for lay in ((dry,), ):
        pass
    if t >= T0 - .01 and t < LASTT - B * 1.0 - .02:                           # the groove drops out for the last beat so the final hit lands
        kk = kick(1.05); both(dry, t, kk, .95); kicks.append(t)
        if k in (1, 3) and not (build and t > LASTT - B * 4): both(dry, t, clap(), .6)
        both(dry, t + B / 2, hat(True), .5)
        for q in (0, .25, .75): both(dry, t + q * B, hat(), .26)
        bs = reese(hz(ROOT[ch] + (12 if k % 2 else 0)), B * .42); both(mus, t + B / 2, bs, .6)
        for q in (0, .75, 1.5, 2.25):                                            # syncopated chord stab on the 3-3-2
            if k == 0 or (k == 2 and q == 0): st = stab(hz(CHORD[ch][0] + 12), B * .55); both(mus, t + q * B, st, .5); both(send, t + q * B, st, .18)
        if k in (0, 2):
            for j, m in enumerate(CHORD[ch]): pk = pluck(hz(m + 12), .26); both(mus, t + j * B / 4, pk, .16); both(send, t + j * B / 4, pk, .12)
    elif t < T0 - .01:                                                            # intro: sparse hats building
        both(dry, t, hat(), .22 + .12 * (t / T0))
# build into the final spiral: snare roll that speeds up, riser, then the kick drops out for the last beat
n_roll = 16
for j in range(n_roll):
    th = LASTT - B * 2.2 + j * (B * 2.2 / n_roll) * (1 - .35 * j / n_roll); both(dry, th, snare(), .22 + .6 * j / n_roll)
rs = riser(LASTT - ENDT, 200, 4200); both(dry, ENDT, rs, .45)
# cues from the picture
for e in EV:
    t, kd = e['t'], e['kind']; pan = e['pan']; gl, gr = np.cos(pan * np.pi / 2), np.sin(pan * np.pi / 2)
    if kd == 'ping':
        sg = bell(hz(e['midi'] + 12), e['vel']); put(dry[0], t, sg, .5 * gl); put(dry[1], t, sg, .5 * gr); put(send[0], t, sg, .7 * gl); put(send[1], t, sg, .7 * gr)
    elif kd == 'thud': sg = thud(hz(e['midi'] + 12)); both(dry, t, sg, .85)
    elif kd == 'whoosh': sg = sweep(.7 if e['vel'] == 1 else .6, 300, 5000, .5); both(dry, t - .35, sg, .6); both(send, t - .35, sg, .3)
    elif kd == 'pop': sg = pop(hz(e['midi'] + 12)); both(dry, t, sg, .8); both(send, t, sg, .3)
    elif kd == 'swoosh': sg = sweep(.9, 400, 2500, .5); both(dry, t, sg, .5)
    elif kd == 'drain':
        dr = sweep(2.2, 4000, 120, .6); both(dry, t - 2.2, dr, .7); tt = t_(2.2); ph = 2 * np.pi * np.cumsum(500 * np.exp(-tt * 1.4)) / SR; both(dry, t - 2.2, np.sin(ph) * np.sin(np.pi * np.clip(tt / 2.2, 0, 1)) ** 1.5, .22)
# the last drop and the end card: a huge hit, a bright chord and bells
imp = ns['impact'](); both(dry, LASTT, imp, 1.0); kicks.append(LASTT)
bm = np.sin(2 * np.pi * np.cumsum(28 + 40 * np.exp(-t_(3.0) * 3)) / SR) * np.exp(-t_(3.0) * 1.1); both(dry, LASTT, bm, 1.3)
for j, m in enumerate((57, 64, 69, 72, 76, 81)):
    t = t_(DUR - LASTT + 1); env = np.minimum(t / .03, 1) * np.exp(-t * .55); s = sum(saw(hz(m) * d, t, 9) for d in (.997, 1.003)) * env * .1; both(mus, LASTT + .02, s, 1.0); both(send, LASTT + .02, s, .25)
for j, m in enumerate((81, 84, 88, 93, 88, 84)): bl = bell(hz(m), .6); tt = LASTT + 1.2 + j * .16; both(dry, tt, bl, .35); both(send, tt, bl, .6)
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
with wave.open(os.path.join(out, f'scorcher-race{SUF}.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(DUR))]
print(f'scorcher-race{SUF}.wav: {DUR:.1f}s, {len(EV)} cues, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))
