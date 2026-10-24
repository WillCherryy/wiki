#!/usr/bin/env python3
"""Score for the eat advert (Agar.io style): a rising pentatonic pop on every cell the big dot swallows, a groove that builds with its size, a snare-roll dash, a hit and slow-motion boom on the impact, then bells as the debris re-forms the logo. Cues come from tools/video/.eat-events.json (written from the picture itself). Based on the race score, numpy only. Output: brand/video/scorcher-eat.wav

Original docstring for the race advert: (140 BPM, A minor): four-on-the-floor kick, offbeat bass, claps, 16th hats and an
arpeggio, with a bell ping on every link the dots find, a whoosh and pop at each hole, loops with a swoosh, a snare-roll build
into the final spiral and a big hit on the last drop. Cues come from tools/video/.eat-events.json, written from the picture
itself, so the sound lands on what you see. numpy only, no samples. """
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass'))
kick, clap, hat, snare, riser, pluck = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'riser', 'pluck'))
D = json.load(open(os.path.join(HERE, 'video', '.eat-events.json'))); DUR, EV = D['duration'], D['events']; HIT = [e['t'] for e in EV if e['kind'] == 'hit'][0]; DASH = [e['t'] for e in EV if e['kind'] == 'dash'][0]
BPM = 132; B = 60 / BPM; rng = np.random.default_rng(9)
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


ROOT = [33, 29, 36, 31]; CHORD = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]; SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81]
# groove: it builds as the blob grows (sparse -> kick -> full), then drops out for the dash and the hit
G0 = 0.0; nb = int((HIT - .5) / B) + 1
for i in range(nb):
    t = G0 + i * B; bar = i // 4; ch = (bar // 2) % 4; k = i % 4
    if t > HIT - .45: break
    lvl = 0 if t < 2.4 else 1 if t < 6.0 else 2
    both(dry, t + B / 2, hat(True), .3 + .15 * lvl)
    if lvl >= 1:
        both(dry, t, kick(1.05), .9); kicks.append(t)
        for q in (0, .25, .75): both(dry, t + q * B, hat(), .2)
        bs = reese(hz(ROOT[ch] + (12 if k % 2 else 0)), B * .42); both(mus, t + B / 2, bs, .5)
    if lvl >= 2:
        if k in (1, 3) and t < DASH - 1.5: both(dry, t, clap(), .55)
        if k == 0 or (k == 2):
            st = stab(hz(CHORD[ch][0] + 12), B * .55); both(mus, t, st, .45); both(send, t, st, .18)
        for j, m in enumerate(CHORD[ch]): pk = pluck(hz(m + 12), .26); both(mus, t + j * B / 4 + (B / 2 if k % 2 else 0), pk, .12); both(send, t + j * B / 4, pk, .1)
# the dash: snare roll that speeds up, riser, then a beat of near silence before the hit
for j in range(20):
    th = DASH - .2 + j * ((HIT - DASH - .1) / 20) * (1 - .35 * j / 20); both(dry, th, snare(), .15 + .6 * j / 20)
both(dry, DASH - .3, riser(HIT - DASH + .1, 200, 5200), .5)
heroN = 0
for e in EV:
    t, kd = e['t'], e['kind']
    if kd == 'eat':
        m = SCALE[heroN % len(SCALE)] + (12 if (heroN // len(SCALE)) % 2 else 0); heroN += 1; sg = pop(hz(m + 12)); pan = (heroN * .37) % 1; gl, gr = np.cos(pan * np.pi / 2), np.sin(pan * np.pi / 2)
        put(dry[0], t, sg, .6 * gl); put(dry[1], t, sg, .6 * gr); both(send, t, sg, .25)
        ch = noise(int(SR * .05)) * np.exp(-t_(.05) * 70); both(dry, t, ch, .12)
    elif kd == 'eat2': both(dry, t, pop(hz(SCALE[(int(t * 3)) % len(SCALE)] + 24)), .22)
    elif kd == 'hit':
        imp = ns['impact'](); both(dry, t, imp, 1.8); kicks.append(t)
        bm = np.sin(2 * np.pi * np.cumsum(26 + 48 * np.exp(-t_(3.5) * 3)) / SR) * np.exp(-t_(3.5) * 1.0); both(dry, t, bm, 2.2)
    elif kd == 'boom':
        for r in range(5): both(dry, t + r * .09, thud(hz(33 - r * 2)), 1.0 - r * .12)
        sw = sweep(2.4, 6000, 150, .7); both(dry, t, sw, 1.0); both(send, t, sw, .5)
    elif kd == 'arrive':
        d = int(e['a']); m = (69, 72, 76, 79, 84)[max(d, 0)] if d >= 0 else 88
        bl = bell(hz(m), .7); both(dry, t, bl, .16); both(send, t, bl, .25)
# slow-motion shimmer under the debris and a rising swell into the logo
sh = riser(2.6, 300, 3000); both(dry, HIT + .4, sh, 1.0)
# the logo: a bright chord and a bell run when the wordmark wipes in
RV = [e['t'] for e in EV if e['kind'] == 'reveal'][0]; TG = [e['t'] for e in EV if e['kind'] == 'tag'][0]
for j, m in enumerate((57, 64, 69, 72, 76, 81)):
    t = t_(DUR - RV + 1); env = np.minimum(t / .03, 1) * np.exp(-t * .55); s = sum(saw(hz(m) * d, t, 9) for d in (.997, 1.003)) * env * .1; both(mus, RV, s, .22); both(send, RV, s, .1)
both(dry, RV, ns['impact'](), .08)
for j, m in enumerate((81, 84, 88, 93, 88, 84)): bl = bell(hz(m), .6); tt = RV + .25 + j * .16; both(dry, tt, bl, .1); both(send, tt, bl, .2)
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
with wave.open(os.path.join(out, f'scorcher-eat.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(DUR))]
print(f'scorcher-eat.wav: {DUR:.1f}s, {len(EV)} cues, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))
