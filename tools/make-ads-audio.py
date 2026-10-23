#!/usr/bin/env python3
"""Soundtracks for the three Instagram adverts (general, players, streamers), synthesised with numpy only.
The instruments come from make-ad-audio.py; each track has its own tempo, key and arrangement, and its cuts land on the
same beat grid as tools/video/ads.html (scene lengths in beats are listed below, keep them in step).
Output: brand/video/scorcher-ad-<name>.wav"""
import os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-ad-audio.py')).read().split('ROOT = [33, 29, 36, 31]')[0]
ns = {'__name__': 'instruments'}; exec(src, ns)
SR, put, hz = ns['SR'], ns['put'], ns['hz']
kick, clap, hat, snare, tick, impact, riser, pluck, pad, bass = (ns[k] for k in ('kick', 'clap', 'hat', 'snare', 'tick', 'impact', 'riser', 'pluck', 'pad', 'bass'))

TRACKS = {
 # name: bpm, scene lengths in beats, chord roots (midi bass), chord tones (midi), feel
 'general':   dict(bpm=124, scenes=[4, 4, 8, 4, 4, 4, 4, 8], roots=[33, 29, 36, 31], chords=[[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]], swing=0.0, arp16=True, snare=False, power=0.95),
 'players':   dict(bpm=112, scenes=[4, 8, 8, 4, 4, 4, 8], roots=[36, 31, 33, 29], chords=[[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], swing=0.12, arp16=False, snare=False, power=0.8),
 'streamers': dict(bpm=140, scenes=[4, 8, 4, 4, 8, 4, 4, 4, 8], roots=[28, 24, 31, 26], chords=[[52, 55, 59, 64], [48, 52, 55, 60], [55, 59, 62, 67], [50, 54, 57, 62]], swing=0.0, arp16=True, snare=True, power=1.1),
}

def build(name, cfg):
    bpm, scenes = cfg['bpm'], cfg['scenes']; beat = 60 / bpm; total_beats = sum(scenes); secs = total_beats * beat
    N = int(SR * (secs + 1.5)); L = np.zeros(N, np.float32); R = np.zeros(N, np.float32); ML = np.zeros(N, np.float32); MR = np.zeros(N, np.float32)
    starts = [sum(scenes[:i]) for i in range(len(scenes))]; kicks = []
    T = lambda b: b * beat
    end_start = starts[-1]
    quiet = []                                    # (from_beat, to_beat) with no kick
    if name == 'streamers': quiet.append((starts[3], starts[3] + 4))                       # the countdown scene
    if name == 'general': pass
    def in_quiet(b): return any(a <= b < c for a, c in quiet)
    bars = total_beats // 4
    for bar in range(bars):
        b0 = bar * 4; ch = bar % 4; t0 = T(b0); in_end = b0 >= end_start
        for k in range(4):
            bb = b0 + k; t = T(bb)
            if not in_quiet(bb) and not (in_end and bb >= end_start + 6):
                put(L, t, kick(cfg['power'] * (0.75 if b0 < 4 else 1)), 0.95); put(R, t, kick(cfg['power'] * (0.75 if b0 < 4 else 1)), 0.95); kicks.append(t)
            if bar >= 1 and not in_quiet(bb) and not in_end:
                if k in (1, 3):
                    c = clap(); put(L, t, c, 0.55); put(R, t, c, 0.57)
                    if cfg['snare']: s_ = snare(); put(L, t, s_, 0.4); put(R, t, s_, 0.4)
                steps = 4 if cfg['arp16'] and name == 'streamers' else 2
                for j in range(steps):
                    th = t + j * beat / steps + (cfg['swing'] * beat / steps if j % 2 else 0); h = hat(open_=(j == steps - 1 and steps == 2 and bar >= 2)); g = 0.3 if j % 2 == 0 else 0.45
                    put(L, th, h, g); put(R, th, h, g * 0.9)
        # music bed
        if bar >= 2 and not in_end:
            for note in cfg['chords'][ch][:3]:
                p = pad(hz(note), 4 * beat + 0.05); put(ML, t0, p, 0.06); put(MR, t0, p, 0.06)
        if not in_end:
            for kk, bt in enumerate([0, 1.5, 2, 2.75, 3.5]):
                tt = t0 + T(bt)
                if in_quiet(b0 + int(bt)): continue
                f = hz(cfg['roots'][ch] + (12 if kk == 3 else 0)); sg = bass(f, 0.26); put(ML, tt, sg, 0.55); put(MR, tt, sg, 0.55)
        if bar >= 1 and not in_end:
            notes = cfg['chords'][ch]; order = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2]
            step = 16 if cfg['arp16'] else 8; octv = 12 if name == 'players' else 0
            for k in range(step):
                tt = t0 + k * 4 * beat / step
                if in_quiet(b0 + k * 4 // step): continue
                f = hz(notes[order[k % 16]] + octv); sg = pluck(f, 0.3) * (0.85 if k % 4 else 1.15); pan = 0.5 + 0.4 * np.sin(k)
                put(ML, tt, sg, 0.17 * (1 - pan)); put(MR, tt, sg, 0.17 * pan); put(MR, tt + .375, sg, .07 * (1 - pan) + .03); put(ML, tt + .375, sg, .07 * pan + .03)
    # snare rolls into every cut, risers on the scene ends
    for i in range(1, len(scenes)):
        s = T(starts[i]); roll = i % 2 == 1 or name != 'general'
        if roll and not in_quiet(starts[i] - 1):
            for k in range(8):
                th = s - beat + k * beat / 8; sn = snare(); g = .22 + .5 * k / 8; put(L, th, sn, g); put(R, th, sn, g)
        im = impact(); put(L, s, im, 0.34 if i < len(scenes) - 1 else 0.6); put(R, s, im, 0.34 if i < len(scenes) - 1 else 0.6)
        if i in (3, len(scenes) - 1) or name == 'streamers':
            rs = riser(min(2 * beat * 2, T(starts[i]))); put(L, max(0, s - len(rs) / SR), rs, 0.22); put(R, max(0, s - len(rs) / SR), rs, 0.22)
    im = impact(); put(L, 0, im, 0.3); put(R, 0, im, 0.3)
    # per-ad touches that match the on-screen action
    if name == 'streamers':
        for k, tb in enumerate([0, 1, 2]): tk = tick(1100 + 250 * k); put(L, T(starts[3] + tb), tk, .55); put(R, T(starts[3] + tb), tk, .55)
        go = impact(); put(L, T(starts[3] + 3), go, .5); put(R, T(starts[3] + 3), go, .5)
        for tb in (.6, 1.2, 2.0, 3.2, 3.8, 4.4, 5.0, 5.6): tk = tick(1900); put(L, T(starts[1] + tb), tk, .14); put(R, T(starts[1] + tb), tk, .14)
        for tb in (1.0, 2.4): im2 = impact(); put(L, T(starts[5] + tb), im2, .3); put(R, T(starts[5] + tb), im2, .3)
    if name == 'players':
        rs = riser(2.1 * beat * 2, 220, 3000); put(L, T(1.2), rs, .3); put(R, T(1.2), rs, .3)
        for n in (3, 7, 14, 30):
            tb = starts[1] + .8 + (n - 1) / 4.2; sg = pluck(hz(72 + [0, 4, 7, 12][(3, 7, 14, 30).index(n)]), .6); put(ML, T(tb), sg, .35); put(MR, T(tb), sg, .35)
        for tb in (2, 5.4, 6.4): sg = pluck(hz(79), .4); put(ML, T(starts[2] + tb), sg, .3); put(MR, T(starts[2] + tb), sg, .3)
    if name == 'general':
        for tb in (3, 5, 7): tk = tick(1500); put(L, T(starts[2] + tb), tk, .35); put(R, T(starts[2] + tb), tk, .35)
        for k, m in enumerate([57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76]): sg = pluck(hz(m + 12), .26); put(ML, T(starts[6] + .8) + k * .13, sg, .2); put(MR, T(starts[6] + .8) + k * .13, sg, .2)
    # end card: dot arpeggio, big chord, soft tail
    for k, m in enumerate((cfg['chords'][0][0] + 12, cfg['chords'][0][1] + 12, cfg['chords'][0][2] + 12, cfg['chords'][0][3] + 12, cfg['chords'][0][0] + 24)):
        sg = pluck(hz(m), .9); tt = T(end_start + .1 + k * .3); put(ML, tt, sg, .28); put(MR, tt, sg, .28)
    for note in [cfg['roots'][0] + 12] + cfg['chords'][0]: p = pad(hz(note), 3.4); put(ML, T(end_start + 1.8), p, .11); put(MR, T(end_start + 1.8), p, .11)
    duck = np.ones(N, np.float32)
    for k in kicks:
        i = int(k * SR); n = min(int(.28 * SR), N - i); x = np.arange(n) / SR; duck[i:i + n] *= (1 - .66 * np.exp(-x / .1)).astype(np.float32)
    mix = np.stack([L + ML * duck, R + MR * duck], 1)[:int(SR * secs)]
    fade = np.ones(len(mix), np.float32); f0 = int(SR * 1.5); fade[-f0:] = np.linspace(1, 0, f0) ** 1.5; mix *= fade[:, None]
    mix = np.tanh(mix * 1.5) / np.tanh(1.5); mix *= .89 / np.max(np.abs(mix))
    out = os.path.join(HERE, '..', 'brand', 'video'); os.makedirs(out, exist_ok=True); pcm = (mix * 32767).astype(np.int16)
    with wave.open(os.path.join(out, f'scorcher-ad-{name}.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    rms = [float(np.sqrt(np.mean(mix[int(i * SR):int((i + 1) * SR)] ** 2))) for i in range(int(secs))]
    print(f'{name}: {secs:.1f}s at {bpm} BPM, peak {np.max(np.abs(mix)):.2f}; rms/s', ' '.join(f'{r:.2f}' for r in rms))

if __name__ == '__main__':
    import sys
    for n in (sys.argv[1:] or TRACKS): build(n, TRACKS[n])
