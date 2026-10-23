#!/usr/bin/env python3
"""Cinematic scores for the epic adverts (trailer, heat, lobby), synthesised with numpy only: no samples, no licences.
Timing (bpm, scene lengths, hit beats, the silent beat before the drop) is read from tools/video/epic-timing.js, the same
file the video uses, so every cut and impact lands on the picture.  Output: brand/video/scorcher-epic-<name>.wav"""
import json, os, re, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz, t_, saw, bandpass, pluck, riser, rng = (ns[k] for k in ('SR', 'put', 'hz', 't_', 'saw', 'bandpass', 'pluck', 'riser', 'rng'))
kick, clap, hat, snare = (ns[k] for k in ('kick', 'clap', 'hat', 'snare'))
TIMING = json.loads(re.search(r'window\.EPIC\s*=\s*(\{.*\});?\s*$', open(os.path.join(HERE, 'video', 'epic-timing.js')).read(), re.S).group(1))

def noise(n): return rng.standard_normal(n)

def boom(dur=3.4):
    t = t_(dur); f = 26 + 40 * np.exp(-t * 2.6); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 1.05) + 0.35 * np.sin(2 * ph) * np.exp(-t * 3.0)
    thud = bandpass(noise(len(t)), 30, 700) * np.exp(-t * 7) * 0.9
    return np.tanh((body * 1.2 + thud) * 1.4) * 0.9

def taiko(f0=82, dur=1.1, power=1.0):
    t = t_(dur); f = f0 * (0.58 + 0.42 * np.exp(-t * 16)); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 4.6) + 0.4 * np.sin(1.6 * ph) * np.exp(-t * 9)
    slap = bandpass(noise(len(t)), 150, 1800) * np.exp(-t * 26) * 0.55 + noise(len(t)) * np.exp(-t * 420) * 0.4
    return (body + slap) * power

def brass(f, dur, vel=1.0):
    t = t_(dur); out = np.zeros(len(t))
    cut = 3 + 15 * np.minimum(t / 0.30, 1) * np.exp(-t * 0.7)
    for det in (0.997, 1.0, 1.003):
        for k in range(1, 22):
            if k * f * det > SR / 2.4: break
            w = np.clip((cut - k) / 3.0, 0, 1) / k
            out += np.sin(2 * np.pi * k * f * det * t) * w
    env = np.minimum(t / 0.035, 1) * (0.6 + 0.4 * np.exp(-t * 2.2)) * np.minimum((dur - t) / 0.35, 1)
    return out * env * 0.28 * vel

def choir(f, dur, gain=1.0):
    t = t_(dur); out = np.zeros(len(t)); vib = 1 + 0.004 * np.sin(2 * np.pi * 5.1 * t + 0.7)
    for det, ph0 in ((0.995, 0.0), (1.0, 1.7), (1.006, 3.1), (1.0, 4.4)):
        ph = 2 * np.pi * np.cumsum(f * det * vib) / SR + ph0
        for k in range(1, 26):
            fk = k * f * det
            if fk > 5200: break
            w = sum(a * np.exp(-((fk - c) / bw) ** 2) for a, c, bw in ((1.0, 650, 170), (0.7, 1080, 220), (0.35, 2450, 420))) + 0.5 / k ** 1.6
            out += np.sin(k * ph) * w / (k ** 0.35)
    env = np.minimum(t / 0.9, 1) * np.minimum((dur - t) / 0.9, 1)
    return out * env * 0.05 * gain

def strings(f, dur=0.22):
    t = t_(dur); s = saw(f, t, 16) * 0.5 + saw(f * 1.004, t, 16) * 0.5; e = np.minimum(t / 0.01, 1) * np.exp(-t * 11)
    return s * e

def sub(f, dur, g=1.0):
    t = t_(dur); e = np.minimum(t / 0.01, 1) * np.minimum((dur - t) / 0.06, 1)
    return np.sin(2 * np.pi * f * t) * e * g

def revcym(dur):
    t = t_(dur); n = np.diff(np.append(noise(len(t)), 0)); n = np.diff(np.append(n, 0)); return n * (t / dur) ** 3 * 0.5

def crash(dur=3.0):
    t = t_(dur); n = np.diff(np.append(noise(len(t)), 0)); n = np.diff(np.append(n, 0)); return n * np.exp(-t * 1.5) * 0.55

def ir(sec=3.2):
    n = int(SR * sec); t = np.arange(n) / SR; out = []
    for ch in range(2):
        x = noise(n) * np.exp(-t * 2.3); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= 1 / (1 + (f / 4500) ** 2); out.append(np.fft.irfft(X, n))
    return np.stack(out)

def convolve(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); X = np.fft.rfft(x, n)
    return np.stack([np.fft.irfft(X * np.fft.rfft(h[c], n), n)[:len(x)] for c in range(2)], 1)

def reese(f, dur, g=1.0):
    t = t_(dur); s = sum(saw(f * d, t, 10) for d in (0.994, 1.0, 1.006)) / 3 + 0.6 * np.sin(2 * np.pi * f * t)
    return s * np.minimum(t / 0.008, 1) * np.minimum((dur - t) / 0.03, 1) * 0.5 * g

def build_strobe(name, cfg):
    """Original club-style track: tension build, a held breath, then a four-on-the-floor drop with an offbeat bass,
    syncopated chord stabs and claps. Every strobe flash in the picture lands on a kick."""
    bpm = cfg['bpm']; beat = 60 / bpm; T = lambda b: b * beat
    scenes = [s['b'] for s in cfg['scenes']]; total = sum(scenes); end_start = sum(scenes[:-1]); drop = cfg['drop']; s0, s1 = cfg['silence']; secs = total * beat
    N = int(SR * (secs + 4.5)); z = lambda: np.zeros(N, np.float32)
    DL, DR, ML, MR, FL, FR, SL, SR_ = z(), z(), z(), z(), z(), z(), z(), z()
    ROOT = [33, 29, 36, 31]; CHORD = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]
    kicks = []; both = lambda L, R, tt, sg, g: (put(L, tt, sg, g), put(R, tt, sg, g))
    for bar in range(int(total // 4)):
        b0 = bar * 4; ch = bar % 4; main = drop <= b0 < end_start; intro = b0 < drop
        d = np.zeros(int(SR * (4 * beat + 0.6))); tt = t_(len(d) / SR)
        for note in (ROOT[ch], ROOT[ch] + 7): d += sum(saw(hz(note) * dt, tt, 6) for dt in (0.997, 1.003)) * np.minimum(tt / 0.6, 1) * 0.5
        both(ML, MR, T(b0), d, 0.2)
        if intro:
            for k in range(8):                                                         # quiet eighth-note hats and a pulsing sub
                both(DL, DR, T(b0 + k * 0.5), hat(), 0.25 + 0.04 * bar)
            if b0 >= 4:
                for k in range(4): both(DL, DR, T(b0 + k), kick(0.7), 0.0 if b0 < 6 else 0.8); kicks.append(T(b0 + k))
        if main:
            for k in range(4):
                tk = T(b0 + k); both(DL, DR, tk, kick(1.15), 1.0); kicks.append(tk)
                both(DL, DR, T(b0 + k + 0.5), hat(True), 0.55)
                bs = reese(hz(ROOT[ch] + (12 if k % 2 else 0)), beat * 0.42); both(ML, MR, T(b0 + k + 0.5), bs, 0.62)
                for q in (0, 0.25, 0.75): both(DL, DR, T(b0 + k + q), hat(), 0.28)
            for k in (1, 3): both(DL, DR, T(b0 + k), clap(), 0.65)
            for q in (0, 0.75, 1.5, 2.25, 3.0):                                          # 3-3-2 style chord stabs
                st = brass(hz(CHORD[ch][0] + 12), beat * 0.5, 0.9); both(FL, FR, T(b0 + q), st, 0.5); both(SL, SR_, T(b0 + q), st, 0.25)
                st2 = brass(hz(CHORD[ch][2] + 12), beat * 0.5, 0.7); both(FL, FR, T(b0 + q), st2, 0.35)
            if bar % 4 == 3:                                                               # fill into the next phrase
                for k in range(8): sn = snare(); both(DL, DR, T(b0 + 3 + k * 0.125), sn, 0.25 + 0.09 * k)
    # build: riser over the first scenes, snare roll that speeds up, then the gap
    rs = riser(T(drop - 1.0), 180, 4200); both(FL, FR, 0.0, rs, 0.6)
    for k in range(int((drop - 4) * 8)):
        tt = T(4 + k * 0.125 * 4 / 4) if False else T(4 + k * 0.5 * (1 - 0.5 * k / ((drop - 4) * 2 + 1)))
        if tt >= T(s0): break
        both(DL, DR, tt, snare(), 0.2 + 0.5 * (tt / T(s0)))
    rc = revcym(T(s0 - 4)); both(FL, FR, max(0, T(s0) - len(rc) / SR), rc, 0.5)
    for h in cfg['hits']:
        tt = T(h['b']); w = h['w']
        if w >= 0.9:
            bm = boom(); both(DL, DR, tt, bm, 0.9); cr = crash(); both(FL, FR, tt, cr, 0.5); both(SL, SR_, tt, bm, 0.4); kicks.append(tt)
        else: both(DL, DR, tt, boom(1.8), 0.4)
    for k, m in enumerate((69, 72, 76, 81, 84, 88)):                                      # end-card bells
        sg = pluck(hz(m + 12), 1.6); tt = T(end_start) + T(1.5) + k * 0.14; both(FL, FR, tt, sg, 0.22); both(SL, SR_, tt, sg, 0.35)
    for note in (57, 64, 69, 76):
        c = choir(hz(note), 4 * beat * 2, 1.0); both(ML, MR, T(end_start), c, 0.5)
    gate = np.ones(N, np.float32); a, b_ = int(T(s0) * SR), int(T(s1) * SR); gate[a:b_] = 0.0; ramp = int(0.03 * SR); gate[a - ramp:a] = np.linspace(1, 0, ramp)
    duck = np.ones(N, np.float32)
    for k in kicks:
        i = int(k * SR); n = min(int(0.3 * SR), N - i); x = np.arange(n) / SR; duck[i:i + n] *= (1 - 0.65 * np.exp(-x / 0.1)).astype(np.float32)
    dl, dr = (DL + ML * duck) * gate + FL * np.minimum(duck + 0.3, 1), (DR + MR * duck) * gate + FR * np.minimum(duck + 0.3, 1)
    wet = convolve((((DL + DR) * 0.25) + (ML + MR) * 0.35 + (FL + FR) * 0.35) * gate + SL + SR_, ir(2.4)) * 0.26
    mix = np.stack([dl, dr], 1)[:wet.shape[0]] + wet; mix = mix[:int(SR * (secs + 2.5))]
    fade = np.ones(len(mix), np.float32); f0 = int(SR * 2.0); fade[-f0:] = np.linspace(1, 0, f0) ** 1.6; mix *= fade[:, None]
    mix *= 0.55 / np.percentile(np.abs(mix), 97); mix = np.tanh(mix * 1.7) / np.tanh(1.7); mix *= 0.93 / np.max(np.abs(mix))
    out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
    with wave.open(os.path.join(out, f'scorcher-epic-{name}.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
    rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(secs))]
    print(f'{name}: {secs:.1f}s at {bpm} BPM, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))

def build(name):
    if TIMING[name].get('style') == 'strobe': return build_strobe(name, TIMING[name])
    cfg = TIMING[name]; bpm = cfg['bpm']; beat = 60 / bpm; T = lambda b: b * beat
    scenes = [s['b'] for s in cfg['scenes']]; starts = [sum(scenes[:i]) for i in range(len(scenes))]; total = sum(scenes)
    drop, end_start = cfg['drop'], starts[-1]; s0, s1 = cfg['silence']; secs = total * beat
    N = int(SR * (secs + 4.5)); z = lambda: np.zeros(N, np.float32)
    DL, DR, ML, MR, FL, FR, SL, SR_ = z(), z(), z(), z(), z(), z(), z(), z()       # drums, music, post-gate fx, reverb send
    ROOT = [33, 29, 36, 31]; CHORD = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]]
    pan = lambda L, R, tt, sg, g, p=0.5: (put(L, tt, sg, g * (1 - p) * 1.4), put(R, tt, sg, g * p * 1.4))
    kicks = []
    bars = int(total // 4)
    for bar in range(bars):
        b0 = bar * 4; ch = bar % 4; main = drop <= b0 < end_start; intro = b0 < drop; end = b0 >= end_start
        for note in (ROOT[ch] + 12, ROOT[ch] + 19): pan(ML, MR, T(b0), sub(hz(note), 4 * beat + 0.2, 0.0), 0)     # keeps the bar grid explicit
        d = np.zeros(int(SR * (4 * beat + 0.8)))
        for note in (ROOT[ch], ROOT[ch] + 7):
            tt = t_(len(d) / SR); d += sum(saw(hz(note) * dt, tt, 6) for dt in (0.997, 1.003)) * np.minimum(tt / 0.8, 1) * 0.5
        put(ML, T(b0), d, 0.20); put(MR, T(b0), d, 0.20)
        if b0 >= 4 or name != 'trailer':
            for k, note in enumerate(CHORD[ch]):
                c = choir(hz(note - 12 * (1 if k == 0 else 0)), 4 * beat + 0.9, 1.0 if not intro else 0.55); put(ML, T(b0), c, 0.55 if k % 2 == 0 else 0.3); put(MR, T(b0), c, 0.3 if k % 2 == 0 else 0.55)
        if main:
            for k in range(8):                                                       # string ostinato + sub pulse, eighth notes
                tt = T(b0 + k * 0.5); nt = CHORD[ch][[0, 1, 2, 3, 2, 1, 2, 3][k]] + 12 * (k % 2 == 0)
                sg = strings(hz(nt)); pan(ML, MR, tt, sg, 0.17 * (1.25 if k % 4 == 0 else 1), 0.5 + 0.3 * np.sin(k + bar))
                put(ML, tt, bass_ := sub(hz(ROOT[ch]), beat * 0.45, 0.5), 0.5); put(MR, tt, bass_, 0.5)
            for k in (0, 2):
                tp = taiko(78 if k == 0 else 92, 1.1, 1.0); put(DL, T(b0 + k), tp, 0.95); put(DR, T(b0 + k), tp, 0.95); kicks.append(T(b0 + k))
            for k in (1, 3):
                tp = taiko(130, 0.5, 0.55); put(DL, T(b0 + k), tp, 0.6); put(DR, T(b0 + k), tp, 0.6)
            for k in (1.5, 3.5):
                tp = taiko(110, 0.4, 0.4); put(DL, T(b0 + k), tp, 0.45); put(DR, T(b0 + k), tp, 0.45)
            if bar % 2 == 0:
                bs = brass(hz(CHORD[ch][0] - 12), 2 * beat, 1.0); put(ML, T(b0), bs, 0.55); put(MR, T(b0), bs, 0.55)
        if intro and b0 >= max(0, drop - 8):
            for k in range(4): hb = sub(55, 0.2, 0.9) * np.exp(-t_(0.2) * 14); put(DL, T(b0 + k), hb, 0.7); put(DR, T(b0 + k), hb, 0.7)
    # intro tension: climbing plucks, a long riser and a snare-like roll into the silent beat
    rs = riser((drop - 2.2) * beat if drop > 6 else (drop - 0.5) * beat, 200, 3600); put(FL, max(0, T(drop) - len(rs) / SR - (T(s1) - T(s0)) * 0 - 0.0), rs, 0.5); put(FR, max(0, T(drop) - len(rs) / SR), rs, 0.5)
    for k in range(10):
        tt = T(max(0, drop - 3.5)) + k * beat * 0.25; tp = taiko(100 + 6 * k, 0.3, 0.3 + 0.07 * k); put(DL, tt, tp, 0.55); put(DR, tt, tp, 0.55)
    # hits: boom + crash + brass braam for the big ones, taiko doubles for the rest, rising pings for the small ones
    ping_i = 0
    for h in cfg['hits']:
        tt = T(h['b']); w = h['w']
        if w >= 0.9:
            bm = boom(); put(DL, tt, bm, 0.95); put(DR, tt, bm, 0.95); cr = crash(); put(FL, tt, cr, 0.5); put(FR, tt, cr, 0.5); kicks.append(tt)
            bs = brass(hz(33 + 12), 2.6, 1.3); put(FL, tt, bs, 0.6); put(FR, tt, bs, 0.6)
            bs2 = brass(hz(45 + 7), 2.6, 1.0); put(FL, tt, bs2, 0.4); put(FR, tt, bs2, 0.4); put(SL, tt, bm, 0.5); put(SR_, tt, bm, 0.5)
        elif w >= 0.6:
            bm = boom(2.2); put(DL, tt, bm, 0.5); put(DR, tt, bm, 0.5); tp = taiko(70, 1.3, 1.1); put(DL, tt, tp, 0.9); put(DR, tt, tp, 0.9); kicks.append(tt)
        else:
            tp = taiko(95, 0.6, 0.8); put(DL, tt, tp, 0.6); put(DR, tt, tp, 0.6)
            sg = pluck(hz(76 + 2 * ping_i), 0.7); put(FL, tt, sg, 0.28); put(FR, tt, sg, 0.28); put(SL, tt, sg, 0.3); put(SR_, tt, sg, 0.3); ping_i += 1
        put(SL, tt, taiko(80, 1.0, 0.5), 0.3); put(SR_, tt, taiko(80, 1.0, 0.5), 0.3)
    # end card: bell arpeggio over the final chord, then a long tail
    for k, m in enumerate((69, 72, 76, 81, 84, 88)):
        sg = pluck(hz(m + 12), 1.6); tt = T(end_start) + T(1.5) + k * 0.14; put(FL, tt, sg, 0.22); put(FR, tt, sg, 0.22); put(SL, tt, sg, 0.35); put(SR_, tt, sg, 0.35)
    # silence the bed inside the gap before the drop (a held breath), then duck the music under every big hit
    gate = np.ones(N, np.float32); a, b_ = int(T(s0) * SR), int(T(s1) * SR); gate[a:b_] = 0.0; ramp = int(0.04 * SR); gate[a - ramp:a] = np.linspace(1, 0, ramp)
    duck = np.ones(N, np.float32)
    for k in kicks:
        i = int(k * SR); n = min(int(0.5 * SR), N - i); x = np.arange(n) / SR; duck[i:i + n] *= (1 - 0.6 * np.exp(-x / 0.18)).astype(np.float32)
    dry_l, dry_r = (DL + ML * duck) * gate + FL, (DR + MR * duck) * gate + FR
    hb = np.arange(N) / SR; wet = convolve(((DL + DR) * 0.5 * 0.5 + (ML + MR) * 0.5 * 0.7 + (FL + FR) * 0.5 * 0.7) * gate + SL + SR_, ir()) * 0.30
    mix = np.stack([dry_l, dry_r], 1)[:wet.shape[0]] + wet
    mix = mix[:int(SR * (secs + 3.0))]
    fade = np.ones(len(mix), np.float32); f0 = int(SR * 2.4); fade[-f0:] = np.linspace(1, 0, f0) ** 1.6; mix *= fade[:, None]
    mix *= 0.55 / np.percentile(np.abs(mix), 97)                                 # level the body of the track, then let the hits push into the limiter
    mix = np.tanh(mix * 1.7) / np.tanh(1.7); mix *= 0.93 / np.max(np.abs(mix))
    out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True)
    with wave.open(os.path.join(out, f'scorcher-epic-{name}.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
    rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(secs))]
    print(f'{name}: {secs:.1f}s at {bpm} BPM, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))

if __name__ == '__main__':
    import sys
    for n in (sys.argv[1:] or TIMING): build(n)
