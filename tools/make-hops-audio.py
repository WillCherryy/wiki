#!/usr/bin/env python3
"""Soundtrack for the hops advert: a real recording (Vivaldi, The Four Seasons - Summer, Mvt 3 Presto) cut to the section tools/analyse-music.py chose, so every transition in the picture lands on a beat of the recording, plus a few punchy effects on top (whip, riser into each zoom, thud and hit on each iris, a riser into the logo and a big hit when Scorcher appears). Usage: python3 tools/make-hops-audio.py [track.mp3]  (default brand/audio/hops-music.mp3). Cues come from tools/video/.hops-events.json. numpy + ffmpeg.
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
D = json.load(open(os.path.join(HERE, 'video', '.hops-events.json'))); DUR, EV = D['duration'], D['events']; HB = json.load(open(os.path.join(HERE, 'video', 'hops-beats.json'))); D0 = 1.1; HOP = 2.2; D7 = D0 + 7 * HOP; WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]
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








import sys, subprocess, tempfile
track = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'brand', 'audio', 'hops-music.mp3')
tmp = tempfile.mktemp(suffix='.wav'); subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(HB['ta0']), '-t', str(DUR + .5), '-i', track, '-ac', '2', '-ar', str(SR), tmp], check=True)
w = wave.open(tmp); music = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2) / 32768; os.remove(tmp)
nm = int(SR * DUR); m = np.zeros((nm, 2), np.float32); m[:min(nm, len(music))] = music[:nm]
fi = int(SR * .35); m[:fi] *= np.linspace(0, 1, fi)[:, None] ** 1.5; fo = int(SR * 1.6); m[-fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]
iris = [e['t'] for e in EV if e['kind'] == 'iris']; zoom = [e['t'] for e in EV if e['kind'] == 'zoom']
WM = [e['t'] for e in EV if e['kind'] == 'reveal'][0]; coll = [e['t'] for e in EV if e['kind'] == 'collapse'][0]
for e in EV:
    t, kd = e['t'], e['kind']
    if kd == 'whip': both(dry, t, sweep(.45, 400, 6500, .6), .35)
    elif kd == 'zoom': i = zoom.index(t); d = max(.2, iris[i] - t); both(dry, t, riser(d, 300, 5200), .32)
    elif kd == 'iris': both(dry, t, thud(hz(34)), .75); both(dry, t, ns['impact'](), .18); both(dry, t, hat(True), .35); both(send, t, bell(hz(86), .6), .1)
both(dry, coll, riser(WM - coll, 200, 5200), .45)
both(dry, WM, thud(hz(31)), 1.0); both(dry, WM, ns['impact'](), .45); both(dry, WM, hat(True), .5)
for j, mm in enumerate((86, 90, 93, 98, 93, 90)): bl = bell(hz(mm), .6); tt = WM + .25 + j * .2; both(dry, tt, bl, .1); both(send, tt, bl, .2)
def ir(sec=2.6):
    n = int(SR * sec); t = np.arange(n) / SR; out = []
    for _ in range(2):
        x = noise(n) * np.exp(-t * 2.2); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= 1 / (1 + (f / 4500) ** 2); out.append(np.fft.irfft(X, n))
    return out
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); X = np.fft.rfft(x, n); return np.fft.irfft(X * np.fft.rfft(h, n), n)[:len(x)]
h = ir(); sfx = [dry[c] + conv(send[c], h[c]) * .3 for c in range(2)]
sfxm = np.stack(sfx, 1)[:nm]
# duck the recording slightly under each hit so the effects read
duck = np.ones(nm, np.float32)
for t in iris + [WM]:
    i = int(t * SR); n = min(int(.25 * SR), nm - i); x = np.arange(n) / SR; duck[i:i + n] *= (1 - .3 * np.exp(-x / .08)).astype(np.float32)
mix = m * duck[:, None] * 1.0 + sfxm * .9
mix *= .93 / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
with wave.open(os.path.join(out, 'scorcher-hops.wav'), 'wb') as wv: wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((mix * 32767).astype(np.int16).tobytes())
print('scorcher-hops.wav: %.1fs from track %.1fs on, peak %.2f' % (DUR, HB['ta0'], np.max(np.abs(mix))))
