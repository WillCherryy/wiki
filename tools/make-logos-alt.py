#!/usr/bin/env python3
"""Alternative Warmer logo directions -> brand/alt/*.svg and brand/alt-sheet.html (rendered by tools/make-brand.js).
Needs: pip install fonttools brotli."""
import os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make-logos.py')).read().split("write('mark.svg'")[0]
ns = {'__file__': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make-logos.py')}; exec(src, ns)
text, REG, ITA, INK, PAPER, ACCENT, RAMP, wordmark = (ns[k] for k in ['text', 'REG', 'ITA', 'INK', 'PAPER', 'ACCENT', 'RAMP', 'wordmark'])
OUT = os.path.join(ns['ROOT'], 'brand')
B, M, S, O, R = RAMP

def grad(i, a=B, b=R, vertical=False):
    mid = '#d6be8c'
    xy = 'x1="0" y1="1" x2="0" y2="0"' if vertical else 'x1="0" y1="0" x2="1" y2="0"'
    return f'<defs><linearGradient id="g{i}" {xy}><stop offset="0" stop-color="{a}"/><stop offset=".5" stop-color="{mid}"/><stop offset="1" stop-color="{b}"/></linearGradient></defs>'

def marks(bgdark=False):
    ink = PAPER if bgdark else INK; hub = INK if bgdark else PAPER
    return {
     'thermo-w': ('Thermo-W', grad(1) + f'<path d="M8 16L20 46L32 24L44 46L55 20" fill="none" stroke="url(#g1)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="56" cy="16" r="6" fill="{R}"/>', 'The W is a temperature trace: it starts cold and ends on the hot dot. Reads as a letter first, a graph second.'),
     'sonar': ('Sonar', f'<circle cx="32" cy="32" r="26" fill="none" stroke="{B}" stroke-width="3.6"/><circle cx="32" cy="32" r="18.5" fill="none" stroke="{M}" stroke-width="3.6"/><circle cx="32" cy="32" r="11.5" fill="none" stroke="{O}" stroke-width="3.6"/><circle cx="32" cy="32" r="5.5" fill="{R}"/>', 'Rings tighten around the target: you are getting warmer. Strongest as a pure symbol; works at tiny sizes.'),
     'dial': ('Thermostat', grad(2) + f'<path d="M9 44A23 23 0 0 1 55 44" fill="none" stroke="url(#g2)" stroke-width="8" stroke-linecap="round"/><path d="M32 44L45 24" stroke="{ink}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="44" r="5" fill="{ink}"/>', 'A gauge with the needle swinging to hot. Literal and instantly understood, a little more utilitarian.'),
     'horizon': ('Horizon', f'<path d="M5 48A27 27 0 0 1 59 48Z" fill="{B}"/><path d="M12 48A20 20 0 0 1 52 48Z" fill="{M}"/><path d="M19 48A13 13 0 0 1 45 48Z" fill="{O}"/><path d="M26 48A6 6 0 0 1 38 48Z" fill="{R}"/>', 'A sun coming up through cold air: the daily ritual, warmed. Friendly and calm; good on stream banners.'),
     'needle': ('Needle', f'<circle cx="32" cy="32" r="26" fill="none" stroke="{ink}" stroke-width="3.2"/><g transform="rotate(40 32 32)"><path d="M32 10L40 32H24Z" fill="{R}"/><path d="M32 54L40 32H24Z" fill="{B}"/></g><circle cx="32" cy="32" r="3" fill="{hub}" stroke="{ink}" stroke-width="1.5"/>', 'A compass needle: red for warm, blue for cold. Says navigation and temperature in one shape.'),
     'pin': ('Target pin', grad(3, B, R, True) + f'<path d="M32 59C21 44 14 35 14 26a18 18 0 0 1 36 0c0 9-7 18-18 33z" fill="url(#g3)"/><circle cx="32" cy="26" r="7" fill="{hub}"/>', 'A map pin that is cold at the tip and hot at the head. Strong on mobile; echoes “destination”.'),
     'signal': ('Signal', f'<rect x="7" y="38" width="10" height="16" rx="3" fill="{B}"/><rect x="21" y="30" width="10" height="24" rx="3" fill="{M}"/><rect x="35" y="20" width="10" height="34" rx="3" fill="{O}"/><rect x="49" y="8" width="10" height="46" rx="3" fill="{R}"/>', 'Four bars rising, like signal strength: the temperature meter as an icon. Bold and legible even at 16px.'),
    }

def lockup(mark_inner, ink, accent, size=110):
    sc = 1.55; mw = 64 * sc; pad = 30
    wm, ww = wordmark(size, pad + mw + 22, pad + 64 * sc * 0.76, ink, accent)
    W = pad * 2 + mw + 22 + ww; H = pad * 2 + 64 * sc
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:g} {H:g}" width="{W:g}" height="{H:g}"><g transform="translate({pad} {pad}) scale({sc})">{mark_inner}</g>{wm}</svg>\n', W, H

def ramp_word(size=120, ink_dark=False):
    cols = [B, M, '#a6b8b4', S, O, R]
    pos, parts = 0, []
    pad = 30
    for i, ch in enumerate('Warmer'):
        font = ITA if ch in 'er' else REG
        d, w = text(font, ch, size, pad + pos, pad + size * 0.72); parts.append(f'<path d="{d}" fill="{cols[i]}"/>'); pos += w
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {pos + 2 * pad:g} {size + 2 * pad - 10:g}" width="{pos + 2 * pad:g}" height="{size + 2 * pad - 10:g}">' + ''.join(parts) + '</svg>\n', pos + 2 * pad, size + 2 * pad - 10

cards = []
light, dark = marks(False), marks(True)
for i, (k, (name, inner, desc)) in enumerate(light.items(), 1):
    svg, W, H = lockup(inner, INK, ACCENT)
    open(os.path.join(OUT, 'alt', f'{k}-logo.svg'), 'w').write(svg)
    open(os.path.join(OUT, 'alt', f'{k}-mark.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">{inner}</svg>\n')
    icon = f'<svg viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" fill="{INK}"/><g transform="translate(9.6 9.6) scale(.7)">{dark[k][1]}</g></svg>'
    cards.append(f'<div class="c"><div class="n">{chr(64 + i)} · {name}</div><div class="lk">{svg.replace(f"width=\"{W:g}\" height=\"{H:g}\"", "width=\"100%\"")}</div><div class="ic">{icon}</div><div class="d">{desc}</div></div>')
svg, W, H = ramp_word()
open(os.path.join(OUT, 'alt', 'ramp-wordmark.svg'), 'w').write(svg)
w_icon = ramp_word()[0]
cards.append(f'<div class="c"><div class="n">H · Ramp wordmark</div><div class="lk">{svg.replace(f"width=\"{W:g}\" height=\"{H:g}\"", "width=\"100%\"")}</div><div class="ic" style="display:grid;place-items:center;background:{INK};color:{PAPER};font:400 40px/1 S;white-space:nowrap">W<i style="color:#ff6a45">er</i></div><div class="d">No symbol at all: each letter warms from cold blue to hot red. Distinctive in type-led spaces and easy to animate; needs the “W” alone as the app icon.</div></div>')
html = f'''<style>
@font-face{{font-family:S;src:url(file://{ns["ROOT"]}/fonts/eb-garamond-latin-400-normal.woff2)}}
@font-face{{font-family:S;font-style:italic;src:url(file://{ns["ROOT"]}/fonts/eb-garamond-latin-400-italic.woff2)}}
@font-face{{font-family:U;font-weight:500;src:url(file://{ns["ROOT"]}/fonts/instrument-sans-latin-500-normal.woff2)}}
@font-face{{font-family:U;font-weight:600;src:url(file://{ns["ROOT"]}/fonts/instrument-sans-latin-600-normal.woff2)}}
*{{box-sizing:border-box}}body{{margin:0;background:#ebe6da;font-family:U;color:{INK};padding:40px;width:1500px}}
h1{{font:400 46px S;margin:0 0 4px}}p.s{{margin:0 0 24px;color:#7a7265;font-size:15px}}
.g{{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}}
.c{{background:#fbf8f1;border:1px solid #d8cfbf;padding:22px 26px;display:grid;grid-template-columns:1fr 92px;gap:8px 22px;align-items:center}}
.n{{grid-column:1/-1;font:600 11px U;letter-spacing:.18em;text-transform:uppercase;color:#7a7265}}
.lk{{width:100%;max-width:560px}}.ic{{width:92px;height:92px;border-radius:21px;overflow:hidden}}
.d{{grid-column:1/-1;font:500 14px/1.45 U;color:#4b453b}}
</style><body><h1>Warmer — alternative directions</h1><p class="s">The primary mark (five climbing dots) is on the first sheet. These seven symbols and one type-only option are drawn in the same palette and typeface.</p><div class="g">{''.join(cards)}</div></body>'''
open(os.path.join(OUT, 'alt-sheet.html'), 'w').write(html)
print('alt logos written')
