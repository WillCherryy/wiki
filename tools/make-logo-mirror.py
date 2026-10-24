#!/usr/bin/env python3
"""Mirror logo: the five-dot mark exactly as it always was, with the word Scorcher below it bent along the same curve (the
dots' own curve, scaled up to the width of the word), so the word rises the way the dots do.
Writes outlined SVGs to brand/mirror/; `node tools/make-logo-wrap.js brand/mirror` renders the PNGs."""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location('wrap', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make-logo-wrap.py')); W = importlib.util.module_from_spec(spec); spec.loader.exec_module(W)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); OUT = os.path.join(ROOT, 'brand', 'mirror'); os.makedirs(OUT, exist_ok=True)
DOTS = [(9, 47, 3.2), (21, 42, 4.2), (33, 34, 5.4), (44, 24, 6.8), (54, 12, 8.4)]          # the mark, on its 64 grid

def build(th, size=200, m=2.9, align=0.5, gap=0.16, lift=1.0):
    lay, width = W.layout([(W.REG, 'Scorch'), (W.ITA, 'er')], size)
    xs, ys = np.array([d[0] for d in DOTS], float), np.array([d[1] for d in DOTS], float)
    a, b, c = np.polyfit(xs, ys, 2)                                                       # the mark's own curve
    gx = np.linspace(xs[0], xs[-1], 2000); gy = a * gx ** 2 + b * gx + c
    Lu = float(np.sum(np.hypot(np.diff(gx), np.diff(gy))))
    k = width / (m * Lu)                                                                  # px per grid unit for the dots
    cx, cy = gx * k, gy * k                                                               # dots' curve in px
    ax, ay = cx[int(len(cx) * align)], cy[int(len(cy) * align)]                           # scale about this point
    tx, ty = ax + m * (cx - ax), ay + m * (cy - ay)                                       # the word's baseline: same curve, m times bigger
    if lift != 1.0:                                                                       # flatter: same bend, but only `lift` of the heading change
        h0 = np.arctan2(np.gradient(gy), np.gradient(gx)); hh = lift * h0
        step = (m * Lu * k) / len(hh); ds = np.full(len(hh), step)
        tx = np.cumsum(np.cos(hh) * ds); ty = np.cumsum(np.sin(hh) * ds)
        tx += np.mean(cx) - np.mean(tx)                                                 # centred under the dots
        ty += np.mean(cy) - np.mean(ty)
    seg = np.hypot(np.diff(tx), np.diff(ty)); sacc = np.concatenate([[0], np.cumsum(seg)])
    head = np.arctan2(np.gradient(ty), np.gradient(tx))
    dots = [(x * k, y * k, r * k, th['ramp'][i]) for i, (x, y, r) in enumerate(DOTS)]
    cap = 0.68 * size
    def curve_pt(u, dx, dy):
        u = min(max(u, 0), sacc[-1]); i = int(np.searchsorted(sacc, u)); i = min(max(i, 1), len(sacc) - 1)
        t = (u - sacc[i - 1]) / max(seg[i - 1], 1e-9); x = tx[i - 1] + (tx[i] - tx[i - 1]) * t + dx; y = ty[i - 1] + (ty[i] - ty[i - 1]) * t + dy
        return x, y, head[i - 1] + (head[i] - head[i - 1]) * t
    # slide the word away from the dots (down and to the right of the curve) until it clears every dot
    mid = int(len(cx) * 0.5); nx, ny = -math.sin(head[mid]) * -1, math.cos(head[mid]) * -1                         # right-hand normal of the heading
    nx, ny = -math.sin(head[mid]), math.cos(head[mid])
    if lift != 1.0: nx, ny = 0.0, 1.0
    d = 0.0
    while True:
        ok = True
        for dxp, dyp, r, _ in dots:
            dist = np.min(np.hypot(tx + nx * d - dxp, ty + ny * d - dyp))
            if dist < cap + r + size * gap: ok = False; break
        if ok: break
        d += 1.0
    def f(x, y):
        px, py, ang = curve_pt(x, nx * d, ny * d); return px + math.sin(ang) * y, py - math.cos(ang) * y
    paths = []
    for font, g, off in lay:
        kk = size / font['head'].unitsPerEm; gs = font.getGlyphSet(); pen = W.Bend(gs, lambda x, y, kk=kk, off=off: f(off + x * kk, y * kk)); gs[g].draw(pen); paths.append((' '.join(pen.d), font is W.ITA))
    pts = []
    for dd, _ in paths:
        vals = [float(v) for v in dd.replace('M', ' ').replace('L', ' ').replace('Z', ' ').split()]; pts += list(zip(vals[0::2], vals[1::2]))
    pts += [(x - r, y - r) for x, y, r, _ in dots] + [(x + r, y + r) for x, y, r, _ in dots]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts); y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    return paths, dots, (x0, y0, x1 - x0, y1 - y0)

def svg(name, th, bg, **kw):
    paths, dots, (x0, y0, w, h) = build(th, **kw); m = 70; s = max(w, h) + 2 * m; ox, oy = x0 - (s - w) / 2, y0 - (s - h) / 2
    body = ''.join(f'<path d="{d}" fill="{th["acc"] if it else th["ink"]}"/>' for d, it in paths) + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}"/>' for x, y, r, c in dots)
    rect = f'<rect x="{ox:.1f}" y="{oy:.1f}" width="{s:.1f}" height="{s:.1f}" fill="{th["bg"]}"/>' if bg else ''
    open(os.path.join(OUT, name + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ox:.1f} {oy:.1f} {s:.1f} {s:.1f}">{rect}{body}</svg>')

if __name__ == '__main__':
    for name, kw in {'mirror': dict(m=2.9, align=0.5), 'mirror-soft': dict(m=2.9, lift=0.55), 'mirror-gentle': dict(m=2.9, lift=0.3)}.items():
        svg(name + '-light', W.LIGHT, True, **kw); svg(name + '-dark', W.DARK, True, **kw); svg(name + '-transparent', W.LIGHT, False, **kw); svg(name + '-transparent-on-dark', W.DARK, False, **kw)
    print('wrote', len(os.listdir(OUT)), 'files')
