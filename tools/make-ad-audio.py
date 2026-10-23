#!/usr/bin/env python3
"""Synthesises the soundtrack for the Scorcher advert (32 s, 120 BPM, A minor) with numpy only: no samples, no licences.
Beat grid matches tools/video/ad.html: scene cuts land on bar lines (every 2 s), the countdown ticks at 22.0/22.5/23.0 s and
the streak counter climbs from 24.9 s. Output: brand/video/scorcher-ad.wav"""
import os, wave
import numpy as np

SR, BPM, SECS = 44100, 120, 32
BEAT = 60 / BPM
N = int(SR * (SECS + 1))
rng = np.random.default_rng(7)
L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)          # drums + fx (not ducked)
ML = np.zeros(N, np.float32); MR = np.zeros(N, np.float32)        # music bed (ducked by the kick)
t_ = lambda dur: np.arange(int(SR * dur)) / SR
hz = lambda midi: 440.0 * 2 ** ((midi - 69) / 12)

def put(buf, t0, sig, g=1.0):
    i = int(t0 * SR); n = min(len(sig), len(buf) - i)
    if n > 0 and i >= 0: buf[i:i + n] += (sig[:n] * g).astype(np.float32)

def saw(f, t, h=14):
    return sum(np.sin(2 * np.pi * k * f * t) / k for k in range(1, h + 1) if k * f < SR / 2.2) * (2 / np.pi)

def kick(power=1.0):
    t = t_(0.55); f = 46 + 130 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 6.5) + 0.35 * np.sin(2 * ph) * np.exp(-t * 18) + 0.25 * np.exp(-t * 400) * rng.standard_normal(len(t))) * power

def bandpass(x, lo, hi):
    S = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); S[(f < lo) | (f > hi)] = 0; return np.fft.irfft(S, len(x))

def clap():
    t = t_(0.32); n = bandpass(rng.standard_normal(len(t)), 900, 4200)
    e = sum(np.exp(-np.clip(t - d, 0, None) * 55) * (t >= d) for d in (0, 0.011, 0.023)) * 0.6 + np.exp(-t * 14) * 0.5
    return n * e * 1.6

def hat(open_=False):
    t = t_(0.28 if open_ else 0.06); n = np.diff(rng.standard_normal(len(t) + 1)); n = np.diff(np.append(n, 0))
    return n * np.exp(-t * (14 if open_ else 80)) * 0.55

def snare():
    t = t_(0.3); n = bandpass(rng.standard_normal(len(t)), 1500, 7500)
    return (n * np.exp(-t * 22) * 1.1 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.5)

def tick(f=1400):
    t = t_(0.09); return np.sin(2 * np.pi * f * t) * np.exp(-t * 60) * 0.7

def impact():
    t = t_(2.6); n = np.diff(np.append(rng.standard_normal(len(t)), 0)); n = np.diff(np.append(n, 0))
    return n * np.exp(-t * 2.4) * 0.8 + np.sin(2 * np.pi * 38 * t) * np.exp(-t * 2.2) * 1.0

def riser(dur, f0=180, f1=2400):
    t = t_(dur); f = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    n = bandpass(rng.standard_normal(len(t)), 600, 9000)
    return (np.sin(ph) * 0.35 + n * 0.5) * (t / dur) ** 2.2

def pluck(f, dur=0.38):
    t = t_(dur); e = np.exp(-t * 11) * (1 - np.exp(-t * 900))
    return (saw(f, t, 9) * 0.5 + np.sin(2 * np.pi * f * t) * 0.5) * e

def pad(f, dur):
    t = t_(dur); s = sum(saw(f * d, t, 7) for d in (0.996, 1.0, 1.004)) / 3
    e = np.minimum(t / 0.25, 1) * np.minimum((dur - t) / 0.4, 1)
    return s * e

def bass(f, dur=0.24):
    t = t_(dur); e = np.minimum(t / 0.006, 1) * np.exp(-t * 7)
    return (saw(f, t, 8) * 0.55 + np.sin(2 * np.pi * f * t) * 0.65) * e

ROOT = [33, 29, 36, 31]                                                  # A1, F1, C2, G1 as midi
CHORD = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]
KICKS = []

def drums(bar, b0):
    # b0 = bar start in seconds; sections follow the scene map
    s = bar // 2                                                          # scene index (4 s each)
    full = s >= 1
    for beat in range(4):
        t0 = b0 + beat * BEAT
        silent = (s == 5 and bar == 10 and beat >= 0) and 22.0 <= t0 < 23.5   # countdown breakdown
        if not silent and not (s == 7 and bar == 15 and beat > 1):
            put(L, t0, kick(0.9 if s else 0.7), 0.95); put(R, t0, kick(0.9 if s else 0.7), 0.95); KICKS.append(t0)
        if full and beat in (1, 3) and not (22.0 <= t0 < 23.5) and s < 7:
            c = clap(); put(L, t0, c, 0.6); put(R, t0, c, 0.62)
        if full and not (22.0 <= t0 < 23.5) and s < 7:
            for k in range(2):
                th = t0 + k * BEAT / 2; h = hat(open_=(k == 1 and s >= 2)); g = 0.34 if k == 0 else 0.5
                put(L, th, h, g * (0.9 if k else 1)); put(R, th, h, g * (1 if k else 0.9))
    if s in (3, 5, 9, 11) and bar % 2 == 1 and not (22.0 <= b0 + 3 * BEAT < 23.5):   # snare roll into each cut
        for k in range(8):
            th = b0 + 3 * BEAT + k * BEAT / 8; sn = snare(); g = 0.25 + 0.5 * k / 8; put(L, th, sn, g); put(R, th, sn, g)

def music(bar, b0):
    s = bar // 2; ch = bar % 4
    if s == 0:
        put(ML, b0, pad(hz(CHORD[ch][0]) / 2, 2 * BEAT * 2), 0.12); put(MR, b0, pad(hz(CHORD[ch][0]) / 2, 2 * BEAT * 2), 0.12)
        return
    # pad
    if s >= 2 and s < 7:
        for note in CHORD[ch][:3]:
            p = pad(hz(note), 4 * BEAT + 0.05); put(ML, b0, p, 0.06); put(MR, b0, p, 0.06)
    # bass: offbeat eighths with a push
    if s < 7:
        pat = [0, 1.5, 2, 2.75, 3.5]
        for k, bt in enumerate(pat):
            f = hz(ROOT[ch] + (12 if k == 3 else 0)); sg = bass(f, 0.28 if k != 4 else 0.2)
            put(ML, b0 + bt * BEAT, sg, 0.55); put(MR, b0 + bt * BEAT, sg, 0.55)
    # arp: sixteenths, octave up in scenes 4-5
    if s >= 2 and s < 7:
        notes = CHORD[ch]; octv = 12 if s in (4, 5) else 0
        order = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]
        for k in range(16):
            tt = b0 + k * BEAT / 4
            if 22.0 <= tt < 23.5: continue
            f = hz(notes[order[k]] + octv); sg = pluck(f, 0.3) * (0.85 if k % 4 else 1.15)
            pan = 0.5 + 0.4 * np.sin(k)
            put(ML, tt, sg, 0.17 * (1 - pan)); put(MR, tt, sg, 0.17 * pan)
            put(MR, tt + 0.375, sg, 0.07 * (1 - pan) + 0.03); put(ML, tt + 0.375, sg, 0.07 * pan + 0.03)   # dotted-eighth echo

# ---- arrange ----
for bar in range(16):
    b0 = bar * 4 * BEAT; drums(bar, b0); music(bar, b0)
# scene-cut impacts and risers
for cut in (4, 8, 12, 16, 20, 24):
    im = impact(); put(L, cut, im, 0.38); put(R, cut, im, 0.38)
put(L, 0, impact(), 0.32); put(R, 0, impact(), 0.32)
for a, d in ((2.0, 2.0), (10.0, 2.0), (18.0, 2.0), (21.2, 2.3)):
    rs = riser(d); put(L, a, rs, 0.30); put(R, a, rs, 0.30)
# countdown ticks 3-2-1, then the drop
for k, tt in enumerate((22.0, 22.5, 23.0)):
    tk = tick(1100 + k * 200); put(L, tt, tk, 0.5); put(R, tt, tk, 0.5)
go = impact(); put(L, 23.5, go, 0.5); put(R, 23.5, go, 0.5)
# streak counter: twelve rising plucks from 24.9 s, one per counter tick
scale = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76]
for k, m in enumerate(scale):
    tt = 24.9 + k * 0.14; sg = pluck(hz(m + 12), 0.28); put(ML, tt, sg, 0.22); put(MR, tt, sg, 0.22)
# end card: dot assembly arpeggio (one note per dot) then the big chord
for k, m in enumerate((69, 72, 76, 81, 84)):
    tt = 28.1 + k * 0.14; sg = pluck(hz(m), 0.9); put(ML, tt, sg, 0.28); put(MR, tt, sg, 0.28)
imp = impact(); put(L, 28.0, imp, 0.55); put(R, 28.0, imp, 0.55)
for note in (45, 57, 60, 64, 67, 71):
    p = pad(hz(note), 3.6); put(ML, 28.8, p, 0.10); put(MR, 28.8, p, 0.10)
for tt in (30.0, 30.5, 31.0):
    c = tick(2200); put(L, tt, c, 0.18); put(R, tt, c, 0.18)

# sidechain pump on the music bed
duck = np.ones(N, np.float32)
for k in KICKS:
    i = int(k * SR); n = min(int(0.28 * SR), N - i); x = np.arange(n) / SR
    duck[i:i + n] *= (1 - 0.68 * np.exp(-x / 0.1)).astype(np.float32)
mixL = L + ML * duck; mixR = R + MR * duck
mix = np.stack([mixL, mixR], 1)[: SR * SECS]
fade = np.ones(len(mix), np.float32); f0 = int(SR * 1.8); fade[-f0:] = np.linspace(1, 0, f0) ** 1.5; fade[:int(SR * .01)] = np.linspace(0, 1, int(SR * .01))
mix *= fade[:, None]
mix = np.tanh(mix * 1.5) / np.tanh(1.5)                                  # gentle saturation: loud and glued, no hard clipping
mix *= 0.89 / np.max(np.abs(mix))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
pcm = (mix * 32767).astype(np.int16)
with wave.open(os.path.join(out, 'scorcher-ad.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
rms = [float(np.sqrt(np.mean(mix[i * SR:(i + 1) * SR] ** 2))) for i in range(SECS)]
print('wrote scorcher-ad.wav', SECS, 's; peak', round(float(np.max(np.abs(mix))), 3)); print('rms per second:', ' '.join(f'{r:.2f}' for r in rms))
