#!/usr/bin/env python3
"""Generates the Warmer logo suite as outlined SVGs in brand/ (no font needed to open them).
Needs: pip install fonttools brotli.  Then run `node tools/make-brand.js` to render the PNGs."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'brand'); os.makedirs(OUT, exist_ok=True)
REG = TTFont(os.path.join(ROOT, 'fonts', 'eb-garamond-latin-400-normal.woff2'))
ITA = TTFont(os.path.join(ROOT, 'fonts', 'eb-garamond-latin-400-italic.woff2'))

INK, PAPER, ACCENT = '#16130f', '#f3eee4', '#d63a1f'
RAMP = ['#2a4f8a', '#5c8cbe', '#d6be8c', '#f08c50', '#d63a1f']
RAMP_DARK = ['#4f7fc4', '#7ba4d4', '#e2cfa0', '#f59a62', '#ff6a45']
DOTS = [(9, 47, 3.2), (21, 42, 4.2), (33, 34, 5.4), (44, 24, 6.8), (54, 12, 8.4)]   # x, y, r on a 64 grid
MARK_BOX = (4, 2, 60, 50)                                                           # tight viewBox of the five dots


KERN = {'Wa': -0.045}


def text(font, s, size, x, y):
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm
    k, pos, parts, prev = size / upm, x, [], ''
    for ch in s:
        pos += KERN.get(prev + ch, 0) * size   # the font's own kerning is not applied, so the pairs we use are set by hand
        g = cmap[ord(ch)]; pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, pos, y)))
        parts.append(pen.getCommands()); pos += gs[g].width * k; prev = ch
    return ' '.join(parts), pos - x


def mark(colors, mono=None, scale=1.0, dx=0, dy=0):
    return ''.join(f'<circle cx="{dx + x * scale:.2f}" cy="{dy + y * scale:.2f}" r="{r * scale:.2f}" fill="{mono or colors[i]}"/>' for i, (x, y, r) in enumerate(DOTS))


def wordmark(size, x, y, ink, accent):
    d1, w1 = text(REG, 'Warm', size, x, y); d2, w2 = text(ITA, 'er', size, x + w1 - size * 0.01, y)
    return f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{accent}"/>', w1 + w2 - size * 0.01


def svg(w, h, body, bg=None, rx=0):
    b = f'<rect width="{w}" height="{h}" rx="{rx}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}">{b}{body}</svg>\n'


def write(name, s): open(os.path.join(OUT, name), 'w').write(s)


def horizontal(ink, accent, colors, mono=None, bg=None):
    size = 120; sc = 2.05; mw, mh = MARK_BOX[2] * sc, MARK_BOX[3] * sc; pad = 40
    base = pad + mh * 0.82
    wm, ww = wordmark(size, 0, 0, ink, accent)
    W = pad + mw + 34 + ww + pad; H = pad * 2 + mh
    m = mark(colors, mono, sc, pad - MARK_BOX[0] * sc, pad - MARK_BOX[1] * sc)
    wm, ww = wordmark(size, pad + mw + 34, base, ink, accent if not mono else ink)
    return svg(W, H, m + wm, bg)


def stacked(ink, accent, colors, mono=None, bg=None):
    size = 150; sc = 3.0; mw, mh = MARK_BOX[2] * sc, MARK_BOX[3] * sc; pad = 56
    _, ww = wordmark(size, 0, 0, ink, accent)
    W = max(ww, mw) + pad * 2; H = pad + mh + 40 + size * 0.78 + pad
    m = mark(colors, mono, sc, (W - mw) / 2 - MARK_BOX[0] * sc, pad - MARK_BOX[1] * sc)
    wm, _ = wordmark(size, (W - ww) / 2, pad + mh + 40 + size * 0.7, ink, accent if not mono else ink)
    return svg(W, H, m + wm, bg)


def tight_mark(colors, mono=None, bg=None):
    x, y, w, h = MARK_BOX; pad = 4
    body = mark(colors, mono)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x - pad} {y - pad} {w + 2 * pad} {h + 2 * pad}" width="{(w + 2 * pad) * 8}" height="{(h + 2 * pad) * 8}">' + (f'<rect x="{x - pad}" y="{y - pad}" width="{w + 2 * pad}" height="{h + 2 * pad}" fill="{bg}"/>' if bg else '') + body + '</svg>\n'


def icon(bg, colors, scale=0.8, rx=14):
    cx, cy = 32 - 34.1 * scale, 32 - 26.9 * scale   # centre of the dots' bounding box (x 5.8-62.4, y 3.6-50.2)
    return svg(64, 64, mark(colors, None, scale, cx, cy), bg, rx)


def wordonly(ink, accent, mono=False):
    size = 140; _, ww = wordmark(size, 0, 0, ink, accent); pad = 30
    wm, _ = wordmark(size, pad, pad + size * 0.72, ink, ink if mono else accent)
    return svg(ww + pad * 2, size * 0.72 + size * 0.28 + pad * 2 - 20, wm)


write('mark.svg', tight_mark(RAMP)); write('mark-on-dark.svg', tight_mark(RAMP_DARK))
write('mark-black.svg', tight_mark(RAMP, INK)); write('mark-white.svg', tight_mark(RAMP, '#ffffff'))
write('wordmark.svg', wordonly(INK, ACCENT)); write('wordmark-on-dark.svg', wordonly(PAPER, '#ff6a45'))
write('wordmark-black.svg', wordonly(INK, INK, True)); write('wordmark-white.svg', wordonly('#ffffff', '#ffffff', True))
write('logo-horizontal.svg', horizontal(INK, ACCENT, RAMP)); write('logo-horizontal-on-dark.svg', horizontal(PAPER, '#ff6a45', RAMP_DARK, bg=INK))
write('logo-horizontal-black.svg', horizontal(INK, INK, RAMP, INK)); write('logo-horizontal-white.svg', horizontal('#fff', '#fff', RAMP, '#fff'))
write('logo-stacked.svg', stacked(INK, ACCENT, RAMP)); write('logo-stacked-on-dark.svg', stacked(PAPER, '#ff6a45', RAMP_DARK, bg=INK))
write('app-icon.svg', icon(INK, RAMP_DARK)); write('app-icon-light.svg', icon(PAPER, RAMP))
open(os.path.join(ROOT, 'favicon.svg'), 'w').write(icon(INK, RAMP_DARK, 0.9, 14))
print('logo suite written to brand/')
