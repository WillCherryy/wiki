#!/usr/bin/env python3
"""Original score for the Cosmos film (tools/video/cosmos.html): pipe organ, strings and a slow clock, written for this film and
synthesised here, so it is ours to use anywhere. A minor, shaped to the picture:
  0-12 a lone organ and a high ostinato over the night sky; 12-27 the clock starts and the chords walk down as Earth falls away;
  27 the Milky Way: full organ; 41-56 thinning to a drone for Betelgeuse and the pulsar; 56-71 a long climb into TON 618, the
  biggest chord at 66; 71-88 the deep field and the end card, resolving to A major and dying away.
usage: python3 tools/make-cosmos-audio.py [out.wav]   (numpy only)"""
import os, sys, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 44100; DUR = 88.0; N = int(SR * DUR); rng = np.random.default_rng(11)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'brand', 'video', 'scorcher-cosmos.wav')
NOTE = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'Bb': 1, 'B': 2}
def hz(n):   # 'A4', 'C#3' ...
    name, octv = (n[:-1], int(n[-1])); return 440.0 * 2 ** ((NOTE[name] + 12 * (octv - 4)) / 12)
L = np.zeros(N, np.float64); R = np.zeros(N, np.float64)
def add(t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR); n = min(len(sig), N - i)
    if n <= 0 or i < 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + n] += sig[:n] * gain * l * 1.414; R[i:i + n] += sig[:n] * gain * r * 1.414
def env(n, a, r, sustain=1.0):
    e = np.ones(n) * sustain; na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, sustain, na) ** 1.6 if na < n else np.linspace(0, sustain, n) ** 1.6
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr) ** 1.4
    return e
# --- organ: flue registration (16', 8', 4', 2 2/3', 2'), slight unsteadiness of wind, a breath of chiff at the attack
STOPS = {'soft': [(1, 1.0), (2, .32), (3, .08), (4, .06)], 'full': [(.5, .55), (1, 1.0), (2, .62), (3, .3), (4, .34), (6, .12), (8, .1)], 'flute': [(1, 1.0), (2, .18), (3, .04)]}
def organ(f, dur, reg='soft', a=.35, r=1.1):
    n = int(SR * (dur + r)); t = np.arange(n) / SR; s = np.zeros(n)
    wob = 1 + .0011 * np.sin(2 * np.pi * (4.6 + rng.random()) * t + rng.random() * 6)
    for k, amp in STOPS[reg]:
        fk = f * k * (1 + (rng.random() - .5) * .0016)
        if fk > 9000: continue
        ph = 2 * np.pi * np.cumsum(fk * wob) / SR + rng.random() * 6.28
        s += amp * np.sin(ph) * (1 / (1 + (fk / 3800) ** 2))
    ch = rng.standard_normal(min(n, int(.06 * SR))) * np.exp(-np.arange(min(n, int(.06 * SR))) / (SR * .012)) * .03
    s[:len(ch)] += np.convolve(ch, np.ones(8) / 8, 'same')
    return s * env(n, a, r)
def strings(f, dur, a=1.6, r=2.0):   # five detuned bowed voices, warm and slow
    n = int(SR * (dur + r)); t = np.arange(n) / SR; s = np.zeros(n)
    for v in range(5):
        det = 1 + (v - 2) * .0028; vib = 1 + .0035 * np.sin(2 * np.pi * (5.1 + v * .17) * t + v)
        ph = 2 * np.pi * np.cumsum(f * det * vib) / SR
        for h in range(1, 14):
            if f * h > 7000: break
            s += np.sin(h * ph) / h * (1 / (1 + (f * h / 2200) ** 2))
    return s / 5 * env(n, a, r)
def bell(f, dur=1.6):   # the ostinato: a soft, glassy organ flute
    n = int(SR * dur); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + .2 * np.sin(2 * np.pi * f * 2 * t) + .06 * np.sin(2 * np.pi * f * 3.01 * t)
    return s * np.minimum(1, t / .012) * np.exp(-t * 2.2)
def tick(dur=.09):   # a wooden tick: a short band of noise around 2.5 kHz
    n = int(SR * dur); x = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * .005)); S = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); S *= np.exp(-((f - 2400) / 900) ** 2); return np.fft.irfft(S, n) * 2.2
def boom(dur=5.0, f=38):
    n = int(SR * dur); t = np.arange(n) / SR; fr = f * (1 + .6 * np.exp(-t * 3)); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * .9) * np.minimum(1, t / .03)
def swell(dur, f0=180, f1=2600):   # air rising: filtered noise sweeping up
    n = int(SR * dur); t = np.arange(n) / SR; x = rng.standard_normal(n); S = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR); S *= np.exp(-((np.log(fr + 1) - np.log((f0 * f1) ** .5)) ** 2) / 2.2); y = np.fft.irfft(S, n)
    return y / (np.abs(y).max() + 1e-9) * (t / dur) ** 2.2
# --- the chords: (start, end, root, triad notes in the left hand, register)
CH = [
    (1.5, 12.0, 'A1', ['A2', 'E3', 'A3', 'C4'], 'soft'),
    (12.0, 15.6, 'A1', ['A2', 'E3', 'C4', 'E4'], 'soft'), (15.6, 19.2, 'F1', ['F2', 'C3', 'A3', 'C4'], 'soft'), (19.2, 22.8, 'C2', ['C3', 'G3', 'C4', 'E4'], 'soft'), (22.8, 27.0, 'G1', ['G2', 'D3', 'B3', 'D4'], 'soft'),
    (27.0, 30.6, 'F1', ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'], 'full'), (30.6, 34.2, 'E1', ['C3', 'G3', 'C4', 'E4', 'G4'], 'full'), (34.2, 37.8, 'D1', ['D3', 'A3', 'D4', 'F4', 'A4'], 'full'), (37.8, 41.6, 'A1', ['A2', 'E3', 'A3', 'C4', 'E4'], 'full'),
    (41.6, 48.6, 'D1', ['D3', 'A3', 'F4'], 'soft'), (48.6, 56.0, 'Bb0', ['Bb2', 'F3', 'D4'], 'soft'),
    (56.0, 59.4, 'A1', ['A2', 'E3', 'C4'], 'soft'), (59.4, 62.8, 'F1', ['F2', 'C3', 'A3', 'C4'], 'full'), (62.8, 66.2, 'D1', ['F2', 'D3', 'A3', 'D4', 'F4'], 'full'), (66.2, 71.4, 'E1', ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4', 'G#4'], 'full'),
    (71.4, 75.0, 'A1', ['A2', 'E3', 'C4', 'E4'], 'soft'), (75.0, 78.0, 'F1', ['F2', 'C3', 'A3', 'C4'], 'soft'), (78.0, 87.5, 'A1', ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4'], 'soft'),
]
LOUD = lambda t: np.interp(t, [0, 12, 26, 27, 41, 44, 56, 62, 66.2, 70, 72, 78, 88], [.13, .2, .38, 1.0, .85, .26, .3, .6, 1.12, .8, .26, .4, .3])
for (a, b, root, notes, reg) in CH:
    d = b - a + .05; g = LOUD(a)
    add(a, organ(hz(root) * 2, d, 'full' if reg == 'full' else 'soft', a=.5, r=1.6), .16 * g)   # the pedal
    for k, nn in enumerate(notes):
        add(a, organ(hz(nn), d, reg, a=.6 if reg == 'soft' else .25, r=1.5), (.09 if reg == 'soft' else .085) * g, pan=(k / max(1, len(notes) - 1) - .5) * .7)
    if a >= 26.5 and not (41 < a < 56):   # strings double the top voices where the picture is grand
        for k, nn in enumerate(notes[-3:]):
            add(a, strings(hz(nn) * 2, d, a=1.8 if a < 27.5 else 1.0), .05 * g, pan=(k - 1) * .5)
    if 41 < a < 56:   # a high, quiet string harmonic over the drone
        add(a, strings(hz(notes[-1]) * 4, d, a=2.5, r=3), .03)
# --- the ostinato: two notes rocking, the figure of a clock; it changes with the harmony
def chord_at(t):
    for (a, b, root, notes, reg) in CH:
        if a <= t < b: return notes
    return CH[-1][3]
STEP = .3
t = 4.0
while t < 80.0:
    if 41.6 < t < 46 or 71.4 < t < 73: t += STEP; continue
    notes = chord_at(t); top = [hz(n) * 4 for n in notes[-2:]] if len(notes) >= 2 else [hz(notes[-1]) * 4]
    k = int(round((t - 4.0) / STEP)); f = top[k % len(top)] if k % 4 != 3 else top[0] * 1.5
    while f > 1900: f /= 2
    dens = LOUD(t) * (.35 if t < 12 else .55 if t < 27 else .6)
    if t < 12 and k % 2: t += STEP; continue
    add(t, bell(f, 1.4), .045 * dens, pan=.35 if k % 2 else -.35)
    t += STEP
# --- the clock: a soft tick every 1.2 s from Earth to the end of the dive, faster for the pulsar
for tt in np.arange(12.0, 71.4, 1.2): add(tt, tick(), .05 if tt < 48 else .035, pan=.15)
for tt in np.arange(48.6, 56.0, 1 / 3.0): add(tt, tick(.05), .028 * (1 - abs(tt - 52.3) / 4.5), pan=-.2)   # the pulsar, slowed to a heartbeat
# --- the great moments: air rising into them, a low boom under them
add(24.2, swell(2.8, 160, 3000), .07); add(27.0, boom(6.0, 36), .38)
add(63.0, swell(3.2, 120, 3600), .09); add(66.2, boom(7.0, 30), .5)
add(77.0, swell(1.4, 400, 2600), .04)
# --- the hall: a long stereo reverb, bright early and dark late
def ir(seed, T=5.0):
    rg = np.random.default_rng(seed); n = int(SR * T); t = np.arange(n) / SR; x = rg.standard_normal(n)
    early = x * np.exp(-t / .35); late = np.convolve(x, np.ones(24) / 24, 'same') * np.exp(-t / 1.6)
    y = early * .5 + late * 1.0; y[:int(.018 * SR)] *= np.linspace(0, 1, int(.018 * SR)); return y / np.sqrt((y ** 2).sum())
def conv(x, h):
    n = len(x) + len(h) - 1; m = 1 << (n - 1).bit_length(); return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:len(x)]
wl, wr = conv(L, ir(3)), conv(R, ir(4))
mixL, mixR = L * .5 + wl * 1.25, R * .5 + wr * 1.25
# gentle high cut, soft limiting, fades
def hicut(x, fc=9000):
    S = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); S /= np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(S, len(x))
mixL, mixR = hicut(mixL), hicut(mixR)
pk = max(np.abs(mixL).max(), np.abs(mixR).max()); mixL, mixR = mixL / pk * 1.05, mixR / pk * 1.05
mixL, mixR = np.tanh(mixL), np.tanh(mixR)
fade = np.ones(N); fi = int(SR * 1.2); fo = int(SR * 3.5); fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo) ** 1.6
mixL *= fade; mixR *= fade; pk = max(np.abs(mixL).max(), np.abs(mixR).max()); mixL, mixR = mixL / pk * .89, mixR / pk * .89
os.makedirs(os.path.dirname(OUT), exist_ok=True)
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.stack([mixL, mixR], 1) * 32767).astype(np.int16).tobytes()); w.close(); print('wrote', OUT)
