#!/usr/bin/env python3
"""Wrapped logos: the word Scorcher bent along a rising curve that keeps curling round into the five climbing dots.
Writes outlined SVGs to brand/wrap/ (no font needed to open them); `node tools/make-brand.js` is not needed for these:
python3 tools/make-logo-wrap.py && node tools/make-logo-wrap.js renders the PNGs."""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); OUT = os.path.join(ROOT, 'brand', 'wrap'); os.makedirs(OUT, exist_ok=True)
REG = TTFont(os.path.join(ROOT, 'fonts', 'eb-garamond-latin-400-normal.woff2')); ITA = TTFont(os.path.join(ROOT, 'fonts', 'eb-garamond-latin-400-italic.woff2'))
LIGHT = dict(bg='#f3eee4', ink='#16130f', acc='#d63a1f', ramp=['#2a4f8a', '#5c8cbe', '#d6be8c', '#f08c50', '#d63a1f'])
DARK = dict(bg='#16130f', ink='#f3eee4', acc='#ff6a45', ramp=['#4f7fc4', '#7ba4d4', '#e2cfa0', '#f59a62', '#ff6a45'])

class Bend(BasePen):
    """Draws a glyph through a mapping f(x, y) -> (X, Y), flattening curves so the bend stays smooth."""
    def __init__(self, gs, f, n=14): super().__init__(gs); self.f, self.n, self.d, self.cur = f, n, [], (0, 0)
    def _moveTo(self, p): self.d.append('M%.2f %.2f' % self.f(*p)); self.cur = p
    def _lineTo(self, p):
        for i in range(1, 7): t = i / 6; self.d.append('L%.2f %.2f' % self.f(self.cur[0] + (p[0] - self.cur[0]) * t, self.cur[1] + (p[1] - self.cur[1]) * t))
        self.cur = p
    def _curveToOne(self, a, b, c):
        p0 = self.cur
        for i in range(1, self.n + 1):
            t = i / self.n; m = 1 - t
            self.d.append('L%.2f %.2f' % self.f(m**3 * p0[0] + 3 * m * m * t * a[0] + 3 * m * t * t * b[0] + t**3 * c[0], m**3 * p0[1] + 3 * m * m * t * a[1] + 3 * m * t * t * b[1] + t**3 * c[1]))
        self.cur = c
    def _qCurveToOne(self, a, c):
        p0 = self.cur
        for i in range(1, self.n + 1):
            t = i / self.n; m = 1 - t
            self.d.append('L%.2f %.2f' % self.f(m * m * p0[0] + 2 * m * t * a[0] + t * t * c[0], m * m * p0[1] + 2 * m * t * a[1] + t * t * c[1]))
        self.cur = c
    def _closePath(self): self.d.append('Z')

def layout(parts, size):
    """[(font, string)] -> list of (font, glyphname, x_offset_px) and total width in px."""
    out, pos = [], 0.0
    for font, s in parts:
        cmap, gs, k = font.getBestCmap(), font.getGlyphSet(), size / font['head'].unitsPerEm
        for ch in s: g = cmap[ord(ch)]; out.append((font, g, pos)); pos += gs[g].width * k
    return out, pos

def curve(th, total, step=0.5):
    """Arc-length parametrised curve from a heading function th(s). Returns lookup(s) -> (x, y, heading)."""
    pts, x, y, s = [(0.0, 0.0, 0.0, th(0))], 0.0, 0.0, 0.0
    while s < total:
        x += math.cos(th(s)) * step; y += math.sin(th(s)) * step; s += step; pts.append((s, x, y, th(s)))
    def at(u):
        i = max(0, min(len(pts) - 2, int(u / step))); a_, b_ = pts[i], pts[i + 1]; k = (u - a_[0]) / step
        return a_[1] + (b_[1] - a_[1]) * k, a_[2] + (b_[2] - a_[2]) * k, a_[3] + (b_[3] - a_[3]) * k
    return at

def spiral(Lt, a, b, Ld):
    """Heading eases from flat to -a radians over the word, then keeps turning faster for Ld pixels until it has turned b more."""
    c1 = 2 * a / Lt; c2 = (b - c1 * Ld) / (Ld * Ld)
    return lambda s: -a * (s / Lt) ** 2 if s <= Lt else -a - c1 * (s - Lt) - c2 * (s - Lt) ** 2

def build(name, th, size=200, shape='rise', voff=0.14):
    lay, width = layout([(REG, 'Scorch'), (ITA, 'er')], size)
    radii = [size * v for v in (0.05, 0.068, 0.09, 0.118, 0.15)]; gap = size * 0.07
    if shape == 'circle':
        R = width / math.radians(188); heading = lambda s: -math.pi / 2 + s / R; Ld = R * 3.0
    else:
        a, b, k = {'rise': (1.0, 3.1, 2.3), 'round': (1.15, 4.9, 3.6)}[shape]; Ld = size * k; heading = spiral(width, a, b, Ld)
    at = curve(heading, width + Ld + 60)
    def f(x, y):                                                             # glyph space (x along the baseline, y up) -> bent position
        cx, cy, ang = at(x); return cx + math.sin(ang) * y, cy - math.cos(ang) * y
    paths = []
    for font, g, off in lay:
        k = size / font['head'].unitsPerEm; gs = font.getGlyphSet(); pen = Bend(gs, lambda x, y, k=k, off=off: f(off + x * k, y * k))
        gs[g].draw(pen); paths.append((' '.join(pen.d), font is ITA))
    dots, u = [], width + size * 0.34 + radii[0]                              # five dots keep following the curve past the word, growing as they go
    for i in range(5):
        x, y = f(u, size * voff); dots.append((x, y, radii[i], th['ramp'][i]))
        if i < 4:
            while True:                                                       # step on until the next dot clears this one
                u += 0.5; nx, ny = f(u, size * voff)
                if math.hypot(nx - x, ny - y) >= radii[i] + radii[i + 1] + gap: break
    allpts = []
    for d, _ in paths:
        vals = [float(v) for v in d.replace('M', ' ').replace('L', ' ').replace('Z', ' ').split()]; allpts += list(zip(vals[0::2], vals[1::2]))
    allpts += [(x - r, y - r) for x, y, r, _ in dots] + [(x + r, y + r) for x, y, r, _ in dots]
    x0, x1 = min(p[0] for p in allpts), max(p[0] for p in allpts); y0, y1 = min(p[1] for p in allpts), max(p[1] for p in allpts)
    return paths, dots, (x0, y0, x1 - x0, y1 - y0)

def svg(name, th, bg, **kw):
    paths, dots, (x0, y0, w, h) = build(name, th, **kw); m = 60; s = max(w, h) + 2 * m
    ox, oy = x0 - (s - w) / 2, y0 - (s - h) / 2
    body = ''.join(f'<path d="{d}" fill="{th["acc"] if it else th["ink"]}"/>' for d, it in paths) + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}"/>' for x, y, r, c in dots)
    rect = f'<rect x="{ox:.1f}" y="{oy:.1f}" width="{s:.1f}" height="{s:.1f}" fill="{th["bg"]}"/>' if bg else ''
    open(os.path.join(OUT, name + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ox:.1f} {oy:.1f} {s:.1f} {s:.1f}">{rect}{body}</svg>')

if __name__ == '__main__':
    for shape in ('rise', 'round', 'circle'):
        svg(f'wrap-{shape}-light', LIGHT, True, shape=shape); svg(f'wrap-{shape}-dark', DARK, True, shape=shape)
        svg(f'wrap-{shape}-transparent', LIGHT, False, shape=shape); svg(f'wrap-{shape}-transparent-on-dark', DARK, False, shape=shape)
    print('wrote', sorted(os.listdir(OUT)))
