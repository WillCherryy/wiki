/* The Observatory: the universe full screen with a quiet typographic HUD (an index of types, an inspector, a scale ruler in real units),
   a size comparison that scrolls through everything you own at true scale, and the catalogue that replaces the old Sky window.
   Uses the map engine in index.html (uniMap) and the renderer in skyobjects.js (SKY). */
(function () {
  'use strict';
  const LY_KM = 9.4607e12, RSUN_KM = 695700, AU_KM = 1.496e8;
  const nf = (v, d = 0) => v.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const sig = v => v >= 100 ? nf(Math.round(v)) : v >= 10 ? nf(v, 1) : v >= 1 ? nf(v, 2) : v >= .01 ? nf(v, 3) : v.toPrecision(2);
  // a length in light-years, in the unit a person would use
  const fmtLen = ly => { const km = ly * LY_KM; if (km < 1e6) return sig(km) + ' km'; if (km < .02 * AU_KM) return sig(km / RSUN_KM) + ' R☉'; if (ly < .3) return sig(km / AU_KM) + ' AU'; if (ly < 1e3) return sig(ly) + ' ly'; if (ly < 1e6) return sig(ly / 1e3) + ' kly'; if (ly < 1e9) return sig(ly / 1e6) + ' Mly'; return sig(ly / 1e9) + ' Gly'; };
  const fmtRad = rs => { const km = rs * RSUN_KM; if (rs < .02) return [sig(km) + ' km', rs < 1e-3 ? 'a city-sized star' : sig(km / 6371) + ' Earth radii']; if (rs > 2e3) return [sig(km / AU_KM) + ' AU', sig(rs) + ' solar radii']; return [sig(rs) + ' R☉', sig(km) + ' km']; };
  const RULER = { lo: -10, hi: 10, ticks: [['1 R☉', 7.36e-8], ['1 AU', 1.58e-5], ['1 ly', 1], ['1 kly', 1e3], ['1 Mly', 1e6], ['1 Gly', 1e9]] };
  const rulerX = ly => (Math.log10(ly) - RULER.lo) / (RULER.hi - RULER.lo);
  const SPEEDS = [['Real time', 1], ['1 day / s', 86400], ['1 year / s', 3.156e7], ['1,000 years / s', 3.156e10], ['1 million years / s', 3.156e13], ['100 million years / s', 3.156e15]];
  const bodyOf = n => { const q = sfNamed(String(n).split('#')[0]); return q ? { ...q, id: q.id, idx: q.idx } : null; };
  const typeName = id => (SKY.OBJ.find(o => o.id === id) || {}).name || '';
  const pluralType = n => n.replace(/y$/, 'ie') + 's';

  /* ------------------------------------------------------------------ the Observatory */
  function open(opt = {}) {
    closeModal(); const L = skySys(); if (!L.length) { toast('Solve a puzzle and your first object starts your universe'); return; }
    const host = document.createElement('div'); host.id = 'obs'; const types = SKY.OBJ.map((o, i) => ({ o, n: L.filter(b => b.idx === i).length })).filter(t => t.n), galaxies = L.filter(b => b.id === 'quasar').reduce((n, b) => n + (b.count || 1), 0);
    host.innerHTML = `<canvas id="obCv"></canvas><div class="ob-shade"></div>
      <header class="ob-top"><div class="ob-brand"><button class="ob-word" id="obHome">Scorch<b>er</b></button><span>Observatory</span></div><nav class="ob-crumbs" id="obCrumbs"></nav>
        <div class="ob-links"><button id="obSearch">Search <kbd>/</kbd></button><button id="obCompare">Compare sizes</button><button id="obCat">Catalogue</button><button id="obDisp">Display</button><button class="ob-x" id="obClose" aria-label="Close"></button></div></header>
      <aside class="ob-index" id="obIndex"><button data-t="" class="on"><i></i><span>Everything</span><em>${L.length}</em></button>${types.map(t => `<button data-t="${t.o.id}" style="--c:${t.o.c}"><i></i><span>${pluralType(t.o.name)}</span><em>${t.n}</em></button>`).join('')}</aside>
      <section class="ob-insp" id="obInsp"></section>
      <div class="ob-fov"><span>Field of view</span><b id="obFov">—</b></div>
      <div class="ob-time" id="obTime"><span>Time</span>${SPEEDS.map(([l], i) => `<button data-i="${i}" class="${i ? '' : 'on'}">${l}</button>`).join('')}<button id="obTour">Tour</button></div>
      <div class="ob-ruler" id="obRuler"><button class="ob-z" id="obOut" aria-label="Zoom out">−</button><div class="ob-line" id="obLine">${RULER.ticks.map(([l, v]) => `<i style="left:${rulerX(v) * 100}%"></i><u style="left:${rulerX(v) * 100}%">${l}</u>`).join('')}${Array.from({ length: 21 }, (_, k) => `<s style="left:${k * 5}%"></s>`).join('')}<b id="obMark"><em id="obMarkL"></em></b></div><button class="ob-z" id="obIn" aria-label="Zoom in">+</button></div>
      <div class="ob-hint" id="obHint">Scroll to zoom through twenty powers of ten · drag to move · tap anything</div>
      <div class="ob-search" id="obS" hidden><input id="obQ" placeholder="Find an object" autocomplete="off" spellcheck="false"><div class="ob-res" id="obRes"></div></div>`;
    document.body.appendChild(host); document.body.classList.add('obs-on'); try { host.requestFullscreen && host.requestFullscreen().catch(() => {}); } catch {}
    let qual = 1; const cv = host.querySelector('#obCv'), dpr = Math.min(2, window.devicePixelRatio || 1), size = () => { cv.width = Math.round(host.clientWidth * dpr * qual); cv.height = Math.round(host.clientHeight * dpr * qual); }; size();
    let sel = opt.focus || (L[0] && L[0].n), filter = new Set(), copyI = 1;
    const map = window.__map = uniMap(cv, L, { intro: !opt.focus, z: .4, noMini: true, onQuality: v => { qual = v; size(); }, follow: sel, focus: sel, newId: opt.newId, onPick: n => inspect(n) });
    const Q = s => host.querySelector(s);
    function inspect(n) {
      sel = n; copyI = 1; const q = bodyOf(n); if (!q) return; const o = SKY.OBJ[q.idx], b = { ...q, id: q.id }, rad = fmtRad(SKY.physR(b)), me = L.find(x => x.n === q.n), N = me ? me.count || 1 : 1, rn = ((P.sky.runs || {})[q.n] || {}).first, parts = crumbParts(map.lay, q.n);
      Q('#obCrumbs').innerHTML = parts.map((c, i) => `${i ? '<i></i>' : ''}<button data-c="${c.n == null ? '' : esc(c.n)}" class="${i === parts.length - 1 ? 'on' : ''}">${esc(c.t)}</button>`).join('');
      Q('#obCrumbs').querySelectorAll('button').forEach(x => x.onclick = () => { if (x.dataset.c) map.pick(x.dataset.c); else map.home(L[0].n); });
      const words = esc(q.n).split(' '), nm = words.length > 1 ? words.slice(0, -1).join(' ') + ' <span>' + words[words.length - 1] + '</span>' : `<span>${words[0]}</span>`;
      Q('#obInsp').style.setProperty('--c', o.c);
      Q('#obInsp').innerHTML = `<div class="ob-k">${esc(q.kind)} · ${RARITY[q.idx]}</div><h1>${nm}</h1><p>${esc(q.f)}</p>
        <dl><div><dt>${q.id === 'quasar' ? 'Event horizon' : 'Radius'}</dt><dd>${rad[0]}<small>${rad[1]}</small></dd></div><div><dt>Mass</dt><dd>${esc(SKY.massText(q.m))}</dd></div><div><dt>Temperature</dt><dd>${esc(q.t)}</dd></div>${rn ? `<div><dt>Earned</dt><dd>${rn.mode === 'daily' ? 'Daily ' + rn.num : rn.mode === 'pack' ? 'Pack' : 'Puzzle'} · ${rn.clicks} clicks</dd></div>` : ''}</dl>
        ${N > 1 ? `<div class="ob-copy"><button data-d="-1" aria-label="Previous copy">←</button><span><b id="obCi">01</b> / ${String(N).padStart(2, '0')}</span><u><i id="obCt" style="width:${100 / N}%"></i></u><button data-d="1" aria-label="Next copy">→</button></div>` : ''}
        <div class="ob-acts"><button class="p" id="obGo">Go to</button><button id="obCmp">Compare</button><button id="obIns">Inspect</button><a href="${wikiUrl(q.a)}" target="_blank" rel="noopener">Wikipedia ↗</a></div>`;
      Q('#obGo').onclick = () => map.pick(n); Q('#obCmp').onclick = () => compare(q.n); Q('#obIns').onclick = () => openInspect(q.n, () => {});
      Q('#obInsp').querySelectorAll('.ob-copy button').forEach(x => x.onclick = () => { copyI = ((copyI - 1 + +x.dataset.d + N) % N) + 1; Q('#obCi').textContent = String(copyI).padStart(2, '0'); Q('#obCt').style.marginLeft = (copyI - 1) / N * 100 + '%'; map.copyTo(q.n, copyI - 1); });
    }
    // type index = filter
    host.querySelectorAll('#obIndex button').forEach(x => x.onclick = () => { const t = x.dataset.t; if (!t) filter.clear(); else if (filter.has(t)) filter.delete(t); else filter.add(t); host.querySelectorAll('#obIndex button').forEach(y => y.classList.toggle('on', y.dataset.t ? filter.has(y.dataset.t) : !filter.size)); map.setFilter(filter); });
    // time
    host.querySelectorAll('#obTime [data-i]').forEach(x => x.onclick = () => { map.setSpeed(SPEEDS[+x.dataset.i][1]); host.querySelectorAll('#obTime [data-i]').forEach(y => y.classList.toggle('on', y === x)); });
    Q('#obTour').onclick = e => { const on = map.tour(!map.isTour()); e.currentTarget.classList.toggle('on', on); };
    // ruler: shows where you are on the ladder of sizes; drag along it to zoom
    const markUpdate = () => { const f = map.fov(), x = Math.max(0, Math.min(1, rulerX(f))); Q('#obMark').style.left = x * 100 + '%'; Q('#obMarkL').textContent = fmtLen(f); Q('#obFov').textContent = '≈ ' + fmtLen(f); };
    const tick = setInterval(markUpdate, 120); markUpdate();
    const line = Q('#obLine'); let rd = false; const fromRuler = e => { const r = line.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), ly = Math.pow(10, RULER.lo + x * (RULER.hi - RULER.lo)); map.zoomTo(cv.width / (ly / SKY.LYU)); };
    line.onpointerdown = e => { rd = true; line.setPointerCapture(e.pointerId); fromRuler(e); }; line.onpointermove = e => { if (rd) fromRuler(e); }; line.onpointerup = () => { rd = false; };
    Q('#obIn').onclick = () => map.zoom(3); Q('#obOut').onclick = () => map.zoom(1 / 3);
    // search
    const L2 = L.slice().sort((a, b) => a.n.localeCompare(b.n));
    const fill = qv => { const a = L2.filter(b => !qv || b.n.toLowerCase().includes(qv)).slice(0, 40); Q('#obRes').innerHTML = a.map(b => { const r = fmtRad(SKY.physR(b)); return `<button data-n="${esc(b.n)}" style="--c:${SKY.OBJ[b.idx].c}"><i></i><b>${esc(b.n)}</b><span>${esc(typeName(b.id))}</span><em>${r[0]}</em></button>`; }).join('') || '<p>Nothing by that name in your universe yet.</p>'; Q('#obRes').querySelectorAll('button').forEach(x => x.onclick = () => { search(false); map.pick(x.dataset.n); }); };
    const search = on => { Q('#obS').hidden = !on; if (on) { Q('#obQ').value = ''; fill(''); setTimeout(() => Q('#obQ').focus(), 30); } };
    Q('#obQ').oninput = e => fill(e.target.value.trim().toLowerCase()); Q('#obS').onclick = e => { if (e.target.id === 'obS') search(false); };
    Q('#obSearch').onclick = () => search(true); Q('#obCompare').onclick = () => compare(sel); Q('#obCat').onclick = () => { done(); openSky(); }; Q('#obDisp').onclick = () => dispMenu(host);
    const done = () => { clearInterval(tick); map.stop(); window.removeEventListener('resize', size); document.removeEventListener('keydown', key); document.body.classList.remove('obs-on'); if (document.fullscreenElement) { try { document.exitFullscreen(); } catch {} } host.remove(); if (opt.back) opt.back(); };
    const key = e => { if (!host.isConnected || document.getElementById('cmp')) return; if (e.key === 'Escape') { if (!Q('#obS').hidden) search(false); else done(); } else if (e.key === '/' && Q('#obS').hidden) { e.preventDefault(); search(true); } else if ((e.key === '+' || e.key === '=') && Q('#obS').hidden) map.zoom(2); else if (e.key === '-' && Q('#obS').hidden) map.zoom(.5); };
    document.addEventListener('keydown', key); window.addEventListener('resize', size);
    Q('#obClose').onclick = done; Q('#obHome').onclick = () => map.home(L[0].n);
    inspect(sel); if (opt.focus) setTimeout(() => { if (host.isConnected) map.pick(opt.focus); }, 400); setTimeout(() => { const h = Q('#obHint'); if (h) h.classList.add('gone'); }, 7000);
    return map;
  }

  /* ------------------------------------------------------------------ size comparison: everything you own, side by side at true scale */
  const REFS = [{ n: 'Earth', ref: 'earth', r: .00917, kind: 'Our planet, for scale', c: '#7fb4ff' }, { n: 'Jupiter', ref: 'jupiter', r: .1005, kind: 'The largest planet, for scale', c: '#e8c8a0' }];
  const PL = new Map();
  function planetTex(kind, S) {   // a quick sharp planet face for the two reference bodies
    const key = kind + S; if (PL.has(key)) return PL.get(key); const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), D = img.data, R = S / 2 - 1;
    const h2 = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + s * 97; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }, vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = h2(xi, yi, s), b = h2(xi + 1, yi, s), cc = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v; }, fb = (x, y, s) => vn(x, y, s) * .5 + vn(x * 2, y * 2, s + 1) * .25 + vn(x * 4, y * 4, s + 2) * .13 + vn(x * 8, y * 8, s + 3) * .07;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (x + .5 - S / 2) / R, dy = (y + .5 - S / 2) / R, r2 = dx * dx + dy * dy; if (r2 > 1) continue; const mu = Math.sqrt(1 - r2), lon = Math.atan2(dx, mu) * 2, lat = Math.asin(Math.max(-1, Math.min(1, dy))) * 2, k = (y * S + x) * 4, sh = Math.max(.08, .25 + .75 * (mu * .6 + (-dx * .5 - dy * .3 + .4) * .7));
      let col; if (kind === 'earth') { const land = fb(lon * 1.4 + 3, lat * 1.4, 4), cl = fb(lon * 2.5, lat * 3.2, 9); col = land > .55 ? [70 + 80 * land, 110 + 40 * land, 60] : [18, 52, 120 + 40 * land]; if (Math.abs(lat) > 2.6) col = [235, 240, 250]; if (cl > .58) col = col.map(v => v + (245 - v) * Math.min(1, (cl - .58) * 4)); }
      else { const band = Math.sin(lat * 7 + fb(lon * 2, lat * 6, 3) * 2.2); col = band > .2 ? [226, 196, 160] : band > -.4 ? [196, 140, 98] : [240, 226, 206]; const spot = Math.hypot((lon - .8) * 1.2, (lat + .7) * 2.4); if (spot < .32) col = [200, 100, 70]; }
      D[k] = col[0] * sh; D[k + 1] = col[1] * sh; D[k + 2] = col[2] * sh; D[k + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * R); }
    g.putImageData(img, 0, 0); PL.set(key, c); return c;
  }
  function compare(startName) {
    if (document.getElementById('cmp')) return; const own = skyList(), seen = new Set(), list = [];
    own.forEach(b => { if (seen.has(b.n)) return; seen.add(b.n); list.push({ n: b.n, b, r: SKY.physR(b), kind: b.kind, c: SKY.OBJ[b.idx].c, id: b.id }); });
    REFS.forEach(x => list.push({ ...x, r: x.r })); if (!own.some(b => b.n === 'The Sun')) list.push({ n: 'The Sun', ref: 'sun', r: 1, kind: 'Our star, for scale', c: '#ffc83a', b: { n: 'The Sun', id: 'sun', t: '≈ 5,800 K', m: 1, idx: 3 } });
    list.sort((a, b) => a.r - b.r);
    // lay them out edge to edge in solar radii, with a gap that scales with each object
    let x = 0; list.forEach((o, i) => { if (i) x += list[i - 1].r + o.r * 1.3; o.x = x; });
    const host = document.createElement('div'); host.id = 'cmp'; host.innerHTML = `<canvas id="cmpCv"></canvas><div class="cmp-top"><div class="ob-brand"><span class="cmp-t">Size comparison</span><span>${list.length} objects, smallest to largest, all to one scale</span></div><div class="ob-links"><button id="cmpX" class="ob-x" aria-label="Close"></button></div></div>
      <div class="cmp-info" id="cmpInfo"></div><div class="cmp-bar"><div class="cmp-scale"><i id="cmpSb"></i><span id="cmpSl"></span></div><div class="cmp-pos"><button id="cmpPrev">←</button><span id="cmpN"></span><button id="cmpNext">→</button></div></div><div class="ob-hint" id="cmpHint">Scroll, swipe or use the arrow keys</div>`;
    document.body.appendChild(host); const cv = host.querySelector('#cmpCv'), g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { cv.width = host.clientWidth * dpr; cv.height = host.clientHeight * dpr; }; size(); window.addEventListener('resize', size);
    let idx = Math.max(0, list.findIndex(o => o.n === startName)), tgt = idx, raf = 0, shown = -1; if (idx < 0) idx = tgt = 0;
    const t0 = performance.now(), info = host.querySelector('#cmpInfo');
    const setInfo = i => { if (i === shown) return; shown = i; const o = list[i], rr = fmtRad(o.r), prev = list[i - 1], sun = o.r; info.style.setProperty('--c', o.c);
      info.innerHTML = `<div class="ob-k">${esc(o.ref ? o.kind : (o.kind || typeName(o.id)))}</div><h1>${esc(o.n)}</h1><dl><div><dt>${o.id === 'quasar' ? 'Event horizon' : 'Radius'}</dt><dd>${rr[0]}<small>${rr[1]}</small></dd></div><div><dt>Against the Sun</dt><dd>${sun >= 1 ? '×' + sig(sun) : sig(sun) + ' ×'}</dd></div>${prev ? `<div><dt>Against ${esc(prev.n)}</dt><dd>×${sig(o.r / prev.r)}</dd></div>` : ''}</dl>`;
      host.querySelector('#cmpN').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0'); };
    const niceKm = km => { const p = Math.pow(10, Math.floor(Math.log10(km))), m = km / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; };
    const frame = now => { if (!host.isConnected) return; idx += (tgt - idx) * .085; if (Math.abs(tgt - idx) < .0005) idx = tgt; const w = cv.width, h = cv.height, K = Math.max(1, w / 1400), i0 = Math.max(0, Math.min(list.length - 1, Math.floor(idx))), i1 = Math.min(list.length - 1, i0 + 1), f = idx - i0;
      const r0 = list[i0].r, r1 = list[i1].r, R = Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * f), cx = list[i0].x + (list[i1].x - list[i0].x) * f, s = h * .17 / R, mid = w * .6, cy = h * .5;   // pixels per solar radius
      g.fillStyle = '#030208'; g.fillRect(0, 0, w, h); SKY.starfield(g, w, h, 0, Math.round(w * h / 2600), 13);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = K; g.beginPath(); g.moveTo(0, cy); g.lineTo(w, cy); g.stroke();
      const t = (now - t0) / 1000;
      list.forEach((o, i) => { const px = mid + (o.x - cx) * s, rp = o.r * s; if (px + rp * 3 < 0 || px - rp * 3 > w) return;
        if (o.ref === 'earth' || o.ref === 'jupiter') { if (rp < 1.2) { g.fillStyle = 'rgba(220,230,255,.8)'; g.beginPath(); g.arc(px, cy, Math.max(.7 * K, rp), 0, 7); g.fill(); } else { const S = Math.min(2048, Math.max(64, Math.pow(2, Math.ceil(Math.log2(rp * 2.1))))); g.drawImage(planetTex(o.ref, S), px - rp, cy - rp, rp * 2, rp * 2); } }
        else if (o.id === 'quasar') { const sh = rp * 2.6; if (sh < 1.5) { g.fillStyle = 'rgba(255,220,180,.9)'; g.beginPath(); g.arc(px, cy, 1.2 * K, 0, 7); g.fill(); } else {   // a black hole at true scale: the shadow (2.6 event-horizon radii), a hairline photon ring and the inner disc seen edge-on
          const gr = g.createRadialGradient(px, cy, sh * .95, px, cy, sh * 2.2); gr.addColorStop(0, 'rgba(255,190,120,.5)'); gr.addColorStop(.2, 'rgba(255,140,60,.18)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, cy, sh * 2.2, 0, 7); g.fill();
          g.save(); g.translate(px, cy); g.scale(1, .18); const dg = g.createRadialGradient(0, 0, sh, 0, 0, sh * 3.2); dg.addColorStop(0, 'rgba(255,235,200,.9)'); dg.addColorStop(.3, 'rgba(255,150,70,.45)'); dg.addColorStop(1, 'rgba(255,100,40,0)'); g.fillStyle = dg; g.beginPath(); g.arc(0, 0, sh * 3.2, 0, 7); g.fill(); g.restore();
          g.fillStyle = '#000'; g.beginPath(); g.arc(px, cy, sh, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,230,200,.85)'; g.lineWidth = Math.max(.8, sh * .012); g.beginPath(); g.arc(px, cy, sh * 1.01, 0, 7); g.stroke(); } }
        else SKY.bodyAt(g, o.b, px, cy, rp, 1, K, t);
        const near = Math.abs(i - idx) < 3.5; if (near && (rp > 1 || Math.abs(i - idx) < .5)) { const a = Math.max(0, 1 - Math.abs(i - idx) / 3.5); g.save(); g.globalAlpha = a; g.fillStyle = '#ece8f6'; g.font = `italic 400 ${Math.round(18 * K)}px "EB Garamond", Georgia, serif`; g.textAlign = 'center'; const ly = cy + Math.max(rp, 4 * K) + 34 * K; if (ly < h - 60 * K) { g.fillText(o.n, px, ly); g.font = `300 ${Math.round(11 * K)}px "IBM Plex Mono", monospace`; g.fillStyle = 'rgba(200,195,225,.7)'; g.fillText(fmtRad(o.r)[0], px, ly + 18 * K); } g.restore(); } });
      // scale bar
      const km = niceKm((w * .16) / s * RSUN_KM), bw = km / RSUN_KM * s / dpr; host.querySelector('#cmpSb').style.width = bw + 'px'; host.querySelector('#cmpSl').textContent = (km >= 1e8 ? sig(km / AU_KM) + ' AU' : nf(km) + ' km');
      setInfo(Math.round(idx)); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    const go = d => { tgt = Math.max(0, Math.min(list.length - 1, Math.round(tgt) + d)); };
    let acc = 0; cv.addEventListener('wheel', e => { e.preventDefault(); acc += e.deltaY + e.deltaX; if (Math.abs(acc) > 60) { go(Math.sign(acc)); acc = 0; } }, { passive: false });
    let sx = null; cv.onpointerdown = e => { sx = e.clientX; }; cv.onpointerup = e => { if (sx != null && Math.abs(e.clientX - sx) > 30) go(e.clientX < sx ? 1 : -1); sx = null; };
    host.querySelector('#cmpPrev').onclick = () => go(-1); host.querySelector('#cmpNext').onclick = () => go(1);
    const key = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1); else if (e.key === 'Escape') close(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('keydown', key); host.remove(); };
    document.addEventListener('keydown', key); host.querySelector('#cmpX').onclick = close; setTimeout(() => { const hh = host.querySelector('#cmpHint'); if (hh) hh.classList.add('gone'); }, 6000);
  }

  /* ------------------------------------------------------------------ the catalogue: every object, each row drawn to one true scale */
  function catalogue(box) {
    const cat = P.sky.cat, owned = Object.keys(cat).length, total = SKY.OBJ.reduce((n, o) => n + SKY.POOL[o.id].length, 0), finds = Object.values(cat).reduce((a, b) => a + b, 0), legend = SKY.POOL.quasar.filter(q => cat[q.n]).length;
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'], big = owned <= 12 ? words[owned] : nf(owned);
    const days = Array.from({ length: 28 }, (_, i) => { const d = new Date(Date.now() - (27 - i) * 864e5).toISOString().slice(0, 10), v = P.sky.log[d]; return v === undefined ? '<i></i>' : `<i class="on" style="--c:${SKY.OBJ[v].c}" title="${SKY.OBJ[v].name}"></i>`; }).join('');
    box.innerHTML = `<div class="cat-hd"><div><div class="ob-k">Catalogue</div><h1>${big} <em>of</em> ${total}</h1><p>Every object you have earned, largest first. Sizes keep their true order within each row; open Compare sizes to see them all at one true scale.</p>
      <div class="cat-go"><button id="catObs">Enter the observatory</button><button id="catCmp">Compare sizes</button></div></div>
      <div class="cat-stats"><div><b>${nf(finds)}</b><span>Finds</span></div><div><b>${SKY.OBJ.filter(o => SKY.POOL[o.id].some(q => cat[q.n])).length}</b><span>Types</span></div><div><b>${legend}</b><span>Galaxies</span></div><div class="cat-days"><span>Last 28 days</span><div>${days}</div></div></div></div>
      ${skyNext() ? `<div class="cat-next"><span>Next</span>${esc(skyNext())}</div>` : ''}
      ${SKY.OBJ.slice().reverse().map(o => { const list = SKY.POOL[o.id].slice().sort((a, b) => SKY.physR({ ...b, id: o.id }) - SKY.physR({ ...a, id: o.id })), have = list.filter(q => cat[q.n]).length;
        return `<section class="cat-row" style="--c:${o.c}"><header><span>${pluralType(o.name)}</span><u></u><em>${have} / ${list.length}</em></header><div class="cat-grid">${list.map(q => cat[q.n] ? `<button class="cat-pl" data-n="${esc(q.n)}" data-id="${o.id}"><canvas width="360" height="260"></canvas><b>${esc(q.n)}</b><span>${fmtRad(SKY.physR({ ...q, id: o.id }))[0]} · ${esc(SKY.massText(q.m))}</span>${cat[q.n] > 1 ? `<em>×${cat[q.n]}</em>` : ''}</button>` : `<div class="cat-pl lock"><div class="cat-ph"><i></i></div><b>Undiscovered</b><span>—</span></div>`).join('')}</div></section>`; }).join('')}
      <p class="cat-note">Plates are compressed (square root of radius) so every face stays visible. True ratios live in Compare sizes.</p>`;
    const draw = () => { box.querySelectorAll('.cat-row').forEach(row => { const pls = [...row.querySelectorAll('.cat-pl[data-n]')]; if (!pls.length) return; const id = pls[0].dataset.id, rs = pls.map(p => SKY.physR({ ...sfNamed(p.dataset.n), id })), mx = Math.max(...rs);
      pls.forEach((p, k) => { const c = p.querySelector('canvas'), g = c.getContext('2d'), w = c.width, h = c.height; g.fillStyle = '#05040b'; g.fillRect(0, 0, w, h); SKY.starfield(g, w, h, 0, 70, k + 3); const q = sfNamed(p.dataset.n), rp = id === 'quasar' ? h * .085 : id === 'neutron' ? h * .05 : Math.max(h * .045, Math.sqrt(rs[k] / mx) * h * .34); /* a quasar or neutron star at true scale would vanish: these rows show the object itself */ SKY.bodyAt(g, { ...q, id }, w / 2, h * .46, rp, 1, 1.4, 2); }); }); };
    draw(); let n = 0; const iv = setInterval(() => { if (!box.isConnected || ++n > 16) return clearInterval(iv); draw(); }, 450);   // sharper faces arrive from the worker: redraw a few times
    box.querySelectorAll('.cat-pl[data-n]').forEach(p => p.onclick = () => open({ focus: p.dataset.n, back: () => openSky() }));
    box.querySelector('#catObs').onclick = () => open({ back: () => openSky() }); box.querySelector('#catCmp').onclick = () => compare(skyList()[0] && skyList()[0].n);
  }

  window.Observatory = { open, compare, catalogue, fmtLen, fmtRad };
})();
