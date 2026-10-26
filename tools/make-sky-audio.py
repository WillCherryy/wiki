#!/usr/bin/env python3
"""Soundtrack for the Sky advert: the Vivaldi recording (Summer, Mvt 3 Presto), cut from the point tools/analyse-music-sky.py chose so the quasar lands on
the music's biggest hit, with a few soft effects on top (an airy swell into each object, a low thud and a hush on the quasar, a long swell into the logo).
No bells. usage: python3 tools/make-sky-audio.py [track.mp3] (default brand/audio/hops-music.mp3). numpy + ffmpeg."""
import os, wave, json, sys, subprocess, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 44100; rng = np.random.default_rng(5)
SB = json.loads(open(os.path.join(HERE, 'video', 'sky-beats.js')).read().split('window.SB = ')[1].rstrip().rstrip(';'))
DUR = SB['end']; bt = lambda b: (SB['b'][int(b)] * (1 - (b - int(b))) + SB['b'][int(b) + 1] * (b - int(b)))
track = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'brand', 'audio', 'hops-music.mp3')
tmp = tempfile.mktemp(suffix='.wav'); subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(SB['ta0']), '-t', str(DUR + .5), '-i', track, '-ac', '2', '-ar', str(SR), tmp], check=True)
w = wave.open(tmp); music = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2) / 32768; os.remove(tmp)
nm = int(SR * DUR); m = np.zeros((nm, 2), np.float32); m[:min(nm, len(music))] = music[:nm]
fi = int(SR * .3); m[:fi] *= np.linspace(0, 1, fi)[:, None] ** 1.5; fo = int(SR * 1.8); m[-fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]
t_ = lambda d: np.arange(int(SR * d)) / SR
def noise(n): return rng.standard_normal(n)
def bp(x, lo, hi): S = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); S[(f < lo) | (f > hi)] = 0; return np.fft.irfft(S, len(x))
def sweep(dur, f0, f1, g=1.0):
    t = t_(dur); f = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    return (bp(noise(len(t)), 500, 9000) * .6 + np.sin(ph) * .15) * np.sin(np.pi * t / dur) ** 1.4 * g
def thud(f, dur=1.4):
    t = t_(dur); fr = f * (.5 + .9 * np.exp(-t * 12)); ph = 2 * np.pi * np.cumsum(fr) / SR; return (np.sin(ph) * np.exp(-t * 3.2) + .3 * bp(noise(len(t)), 40, 400) * np.exp(-t * 20)) * 1.0
fx = np.zeros((nm, 2), np.float32)
def put(t0, sig, g):
    i = int(t0 * SR); n = min(len(sig), nm - i)
    if n > 0 and i >= 0: fx[i:i + n, :] += (sig[:n] * g)[:, None]
put(bt(0), sweep(bt(3) - bt(0), 150, 3000, .5), .10)                      # cold open swell
put(bt(5), sweep(bt(6) - bt(5), 800, 5000, .5), .08)                     # into the first object
for i in range(1, 9):                                                    # a soft airy lift into every landing
    s = 6 + i * 2 if i < 8 else 22; put(bt(s) - .35, sweep(.45, 900 + i * 200, 4200 + i * 300, .5), .07)
put(bt(22), thud(46), .75); put(bt(22), bp(noise(int(SR * 1.4)), 3000, 11000) * np.exp(-t_(1.4) * 3.5), .22)   # the quasar
put(bt(25.6), sweep(bt(26) - bt(25.6) + .5, 700, 4200, .5), .08)          # into your sky
put(bt(29.6), sweep(.6, 900, 4800, .5), .06); put(bt(41.6), sweep(.8, 600, 5200, .5), .08)   # it grows, then the camera flies
put(bt(43.2), sweep(.5, 1200, 4000, .5), .06); put(bt(46.2), sweep(.5, 1200, 4000, .5), .06); put(bt(49.2), sweep(.5, 1200, 4000, .5), .06)
put(bt(50), thud(52, 1.6), .5)                                           # the line lands
put(bt(55.4), sweep(bt(56) - bt(55.4) + .5, 500, 6500, .5), .10)         # into the logo
duck = np.ones(nm, np.float32)
for tt in (bt(22),):
    i = int(tt * SR); n = min(int(.3 * SR), nm - i); x = np.arange(n) / SR; duck[i:i + n] *= (1 - .25 * np.exp(-x / .09)).astype(np.float32)
mix = m * duck[:, None] + fx; mix *= .93 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, 'scorcher-sky.wav'), 'wb') as wv: wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((mix * 32767).astype(np.int16).tobytes())
print('scorcher-sky.wav: %.1fs from track %.1fs on, peak %.2f' % (DUR, SB['ta0'], np.max(np.abs(mix))))
