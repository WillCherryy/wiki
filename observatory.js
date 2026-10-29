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
    let qual = 1; const cv = host.querySelector('#obCv'), dpr = Math.min(1.5, window.devicePixelRatio || 1), size = () => { cv.width = Math.round(host.clientWidth * dpr * qual); cv.height = Math.round(host.clientHeight * dpr * qual); }; size();
    let sel = opt.focus || (L[0] && L[0].n), filter = new Set(), copyI = 1;
    const map = window.__map = uniMap(cv, L, { intro: !opt.focus, z: .4, noMini: true, onQuality: v => { qual = v; size(); }, follow: sel, focus: sel, newId: opt.newId, onPick: n => inspect(n) });
    const Q = s => host.querySelector(s);
    const KINDS = { moon: 'Our Moon', io: 'The most volcanic world known', europa: 'Ice shell over a hidden ocean', ganymede: 'The largest moon, with its own magnetic field', callisto: 'The most cratered surface known', snow: 'Icy moon', titan: 'A moon with a thick nitrogen atmosphere and methane lakes', iapetus: 'Two-toned moon, one side dark as coal', triton: 'Orbits backwards: a captured dwarf planet',  earth: 'Our home world', ocean: 'Possible ocean world', super: 'Super-Earth', desert: 'Hot rocky world', lava: 'Lava world: its dayside is molten rock', mercury: 'Airless rocky world', rock: 'Rocky world', venus: 'Rocky world under thick clouds', ice: 'Icy world', mars: 'Cold desert world', jupiter: 'Gas giant', saturn: 'Ringed gas giant', uranus: 'Ice giant, tipped on its side', neptune: 'Ice giant', gas: 'Gas giant', hot: 'Hot Jupiter', hotblue: 'Hot Jupiter where it rains glass' };
    function inspectPlanet(n, pi) {
      sel = n; const sz = fmtRad(pi.re * .009158), per = pi.P < 2 ? sig(pi.P * 24) + ' hours' : pi.P < 800 ? sig(pi.P) + ' days' : sig(pi.P / 365.25) + ' years', star = SKY.OBJ[(sfNamed(pi.host) || { idx: 3 }).idx];
      Q('#obCrumbs').innerHTML = `<button data-c="">Universe</button><i></i><button data-c="${esc(pi.host)}">${esc(pi.host)}${pi.moon ? '' : ' system'}</button><i></i><button class="on">${esc(n)}</button>`; Q('#obCrumbs').querySelectorAll('button').forEach(x => x.onclick = () => { if (x.dataset.c) map.pick(x.dataset.c); else if (x.dataset.c === '') map.home(L[0].n); });
      Q('#obInsp').style.setProperty('--c', '#bcd2ff'); const w = esc(n).split(' ');
      Q('#obInsp').innerHTML = `<div class="ob-k">${pi.moon ? 'Moon of ' + esc(pi.host) : 'Planet'} · ${esc(KINDS[pi.kind] || 'Planet')}</div><h1>${w.length > 1 ? w.slice(0, -1).join(' ') + ' <span>' + w[w.length - 1] + '</span>' : '<span>' + w[0] + '</span>'}</h1>
        <dl><div><dt>Radius</dt><dd>${sig(pi.re)} Earths<small>${sz[0]}</small></dd></div><div><dt>Orbit</dt><dd>${pi.moon ? nf(pi.km) + ' km' : sig(pi.a) + ' AU'}<small>from ${esc(pi.host)}</small></dd></div><div><dt>Year</dt><dd>${per}</dd></div></dl>
        <div class="ob-acts"><button class="p" id="obGo">Go to</button><button id="obStar">Its star</button><button id="obCmp">Compare</button></div>`;
      Q('#obGo').onclick = () => map.pick(n); Q('#obStar').textContent = pi.moon ? 'Its planet' : 'Its star'; Q('#obStar').onclick = () => map.pick(pi.host); Q('#obCmp').onclick = () => compare(n, [n, 'Earth', 'Jupiter'].filter((v, i, a) => a.indexOf(v) === i), 'all');
    }
    function inspect(n) {
      { const pi = SKY.planetInfo(n); if (pi) return inspectPlanet(n, pi); }
      sel = n; copyI = 1; const q = bodyOf(n); if (!q) return; const o = SKY.OBJ[q.idx], b = { ...q, id: q.id }, rad = fmtRad(SKY.physR(b)), me = L.find(x => x.n === q.n), N = me ? me.count || 1 : 1, rn = ((P.sky.runs || {})[q.n] || {}).first, parts = crumbParts(map.lay, q.n);
      Q('#obCrumbs').innerHTML = parts.map((c, i) => `${i ? '<i></i>' : ''}<button data-c="${c.n == null ? '' : esc(c.n)}" class="${i === parts.length - 1 ? 'on' : ''}">${esc(c.t)}</button>`).join('');
      Q('#obCrumbs').querySelectorAll('button').forEach(x => x.onclick = () => { if (x.dataset.c) map.pick(x.dataset.c); else map.home(L[0].n); });
      const words = esc(q.n).split(' '), nm = words.length > 1 ? words.slice(0, -1).join(' ') + ' <span>' + words[words.length - 1] + '</span>' : `<span>${words[0]}</span>`;
      Q('#obInsp').style.setProperty('--c', o.c);
      Q('#obInsp').innerHTML = `<div class="ob-k">${esc(q.kind)} · ${RARITY[q.idx]}</div><h1>${nm}</h1><p>${esc(q.f)}</p>
        <dl><div><dt>${q.id === 'quasar' ? 'Event horizon' : 'Radius'}</dt><dd>${rad[0]}<small>${rad[1]}</small></dd></div><div><dt>Mass</dt><dd>${esc(SKY.massText(q.m))}</dd></div><div><dt>Temperature</dt><dd>${esc(q.t)}</dd></div>${SKY.NEAR[q.n] && SKY.NEAR[q.n][3] ? `<div><dt>Distance from the Sun</dt><dd>${sig(SKY.NEAR[q.n][3])} ly<small>its real place in the sky</small></dd></div>` : ''}${(SKY.PLANETS[q.n] || []).length ? `<div><dt>Planets</dt><dd>${SKY.PLANETS[q.n].length}<small>${SKY.PLANETS[q.n].map(p => p[0].replace(/ \(.*\)/, '')).slice(0, 4).join(', ')}${SKY.PLANETS[q.n].length > 4 ? '…' : ''}</small></dd></div>` : ''}${rn ? `<div><dt>Earned</dt><dd>${rn.mode === 'daily' ? 'Daily ' + rn.num : rn.mode === 'pack' ? 'Pack' : 'Puzzle'} · ${rn.clicks} clicks</dd></div>` : ''}</dl>
        ${N > 1 ? `<div class="ob-copy"><button data-d="-1" aria-label="Previous copy">←</button><span><b id="obCi">01</b> / ${String(N).padStart(2, '0')}</span><u><i id="obCt" style="width:${100 / N}%"></i></u><button data-d="1" aria-label="Next copy">→</button></div>` : ''}
        <div class="ob-acts"><button class="p" id="obGo">Go to</button><button id="obCmp">Compare</button><button id="obIns">Inspect</button><a href="${wikiUrl(q.a)}" target="_blank" rel="noopener">Wikipedia ↗</a></div>`;
      host.querySelectorAll('.ob-objs button').forEach(y => y.classList.toggle('cur', y.dataset.n === q.n));
      Q('#obGo').onclick = () => map.pick(n); Q('#obCmp').onclick = () => compare(q.n, [q.n, 'The Sun', 'Earth'].filter((v, i, a) => a.indexOf(v) === i), 'all'); Q('#obIns').onclick = () => openInspect(q.n, () => {});
      Q('#obInsp').querySelectorAll('.ob-copy button').forEach(x => x.onclick = () => { copyI = ((copyI - 1 + +x.dataset.d + N) % N) + 1; Q('#obCi').textContent = String(copyI).padStart(2, '0'); Q('#obCt').style.marginLeft = (copyI - 1) / N * 100 + '%'; map.copyTo(q.n, copyI - 1); });
    }
    // type index = filter
    // the index: pick a type to open its objects (largest first) and dim the rest; pick an object to fly there
    let openT = '';
    const drawIndex = () => { const box = Q('#obIndex'); box.innerHTML = `<button data-t="" class="${openT ? '' : 'on'}"><i></i><span>Everything</span><em>${L.length}</em></button>` + types.map(t => { const on = openT === t.o.id, objs = on ? L.filter(b => b.id === t.o.id).sort((a, b) => SKY.physR(b) - SKY.physR(a)) : [];
        return `<button data-t="${t.o.id}" class="${on ? 'on' : ''}" style="--c:${t.o.c}"><i></i><span>${pluralType(t.o.name)}</span><em>${t.n}</em></button>${on ? `<div class="ob-objs">${objs.map(b => `<button data-n="${esc(b.n)}" class="${b.n === sel ? 'cur' : ''}"><span>${esc(b.n)}</span><em>${fmtRad(SKY.physR(b))[0]}</em></button>`).join('')}</div>` : ''}`; }).join('');
      { const pls = []; L.forEach(b => (SKY.PLANETS[b.n] || []).forEach(p => pls.push(p))); if (pls.length) { const on = openT === 'planet'; box.insertAdjacentHTML('beforeend', `<button data-t="planet" class="${on ? 'on' : ''}" style="--c:#bcd2ff"><i></i><span>Planets</span><em>${pls.length}</em></button>${on ? `<div class="ob-objs">${pls.map(p => `<button data-n="${esc(p[0])}" class="${p[0] === sel ? 'cur' : ''}"><span>${esc(p[0])}</span><em>${sig(p[1])} R⊕</em></button>`).join('')}</div>` : ''}`); } }
      box.querySelectorAll('button[data-t]').forEach(x => x.onclick = () => { const t = x.dataset.t; openT = !t || openT === t ? '' : t; filter.clear(); if (openT && openT !== 'planet') filter.add(openT); map.setFilter(filter); drawIndex(); });
      box.querySelectorAll('button[data-n]').forEach(x => x.onclick = () => { map.pick(x.dataset.n); box.querySelectorAll('button[data-n]').forEach(y => y.classList.toggle('cur', y === x)); }); };
    drawIndex();
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
      let col; if (kind === 'earth') { const land = fb(lon * 1.4 + 3, lat * 1.4, 4), cl = fb(lon * 2.5, lat * 3.2, 9); const dry = fb(lon * 3 + 9, lat * 3, 2); col = land > .55 ? (dry > .55 ? [176, 150, 104] : [52 + 40 * dry, 96 + 30 * land, 46]) : [10, 34 + 20 * land, 92 + 50 * land]; if (Math.abs(lat) > 2.6) col = [235, 240, 250]; if (cl > .58) col = col.map(v => v + (245 - v) * Math.min(1, (cl - .58) * 4)); }
      else { const sw = fb(lon * 1.5, lat * 9, 3), v = lat * 5.2 + (sw - .5) * .9 + Math.sin(lon * 4 + lat * 12) * .05, band = .5 + .5 * Math.sin(v * 3.3), fine = fb(lon * 6 + sw * 2, lat * 30, 7), zone = [244, 232, 212], belt = [176, 118, 80], k2 = Math.pow(band, 1.4) * .85 + fine * .15;   // zones and belts, with turbulent edges
        col = belt.map((b2, i) => b2 + (zone[i] - b2) * k2); if (Math.abs(lat) > 2.2) col = col.map(c => c * .82 + 20);   // greyer poles
        const sx = (lon - .8) * 1.25, sy = (lat + .62) * 2.6, sp = Math.hypot(sx, sy); if (sp < .36) { const q = 1 - sp / .36; col = col.map((c, i) => c + ([206, 104, 70][i] - c) * Math.min(1, q * 2.2) * (.75 + .25 * Math.sin(Math.atan2(sy, sx) * 3 + sp * 30))); } }   // the Great Red Spot, with its swirl
      D[k] = col[0] * sh; D[k + 1] = col[1] * sh; D[k + 2] = col[2] * sh; D[k + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * R); }
    g.putImageData(img, 0, 0); PL.set(key, c); return c;
  }
  function compare(startName, pick, mode) {   // pick: only these names (any objects you own, plus Earth, Jupiter and the Sun); mode 'all' shows them side by side in one frame
    if (document.getElementById('cmp')) return; const own = skyList(), seen = new Set(); let list = [];
    own.forEach(b => { if (seen.has(b.n)) return; seen.add(b.n); list.push({ n: b.n, b, r: SKY.physR(b), kind: b.kind, c: SKY.OBJ[b.idx].c, id: b.id }); });
    REFS.forEach(x => list.push({ ...x, r: x.r })); if (!own.some(b => b.n === 'The Sun')) list.push({ n: 'The Sun', ref: 'sun', r: 1, kind: 'Our star, for scale', c: '#ffc83a', b: { n: 'The Sun', id: 'sun', t: '≈ 5,800 K', m: 1, idx: 3 } });
    own.forEach(b => (SKY.PLANETS[b.n] || []).forEach(([pn, re, a, P, kind]) => { if (pn === 'Earth' || pn === 'Jupiter') return; list.push({ n: pn, ref: 'planet', kind: 'Planet of ' + b.n, pk: kind, r: re * .009158, c: '#cfe0ff' }); }));
    const full = list.slice(); if (pick && pick.length) list = list.filter(o => pick.includes(o.n)); if (!list.length) list = full;
    list.sort((a, b) => a.r - b.r); let allMode = mode === 'all' && list.length > 1;
    // lay them out edge to edge in solar radii, with a gap that scales with each object
    let x = 0; list.forEach((o, i) => { if (i) { const p = list[i - 1], gap = o => o.id === 'neutron' ? 6 : o.id === 'quasar' ? 14 : 1.3; x += p.r * gap(p) + o.r * gap(o); } o.x = x; });   // room for the field lines of neutron stars and the discs of black holes
    const host = document.createElement('div'); host.id = 'cmp'; host.innerHTML = `<canvas id="cmpCv"></canvas><div class="cmp-top"><div class="ob-brand"><span class="cmp-t">Size comparison</span><span>${list.length} objects, smallest to largest, all to one scale</span></div><div class="ob-links"><button id="cmpPick">Choose objects</button><button id="cmpMode">${allMode ? 'One by one' : 'All at once'}</button><button id="cmpX" class="ob-x" aria-label="Close"></button></div></div>
      <div class="cmp-info" id="cmpInfo"></div><div class="cmp-bar"><div class="cmp-scale"><i id="cmpSb"></i><span id="cmpSl"></span></div><div class="cmp-pos"><button id="cmpPrev">←</button><span id="cmpN"></span><button id="cmpNext">→</button></div></div><div class="ob-hint" id="cmpHint">Scroll, swipe or use the arrow keys</div>`;
    (document.fullscreenElement || document.body).appendChild(host); const OM = document.getElementById('obs') && window.__map; if (OM && OM.pause) OM.pause(true);   // inside the full-screen observatory, or the browser keeps it on top; the universe rests while this is open
    const cv = host.querySelector('#cmpCv'), g = cv.getContext('2d'), dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const size = () => { cv.width = host.clientWidth * dpr; cv.height = host.clientHeight * dpr; }; size(); window.addEventListener('resize', size);
    let idx = Math.max(0, list.findIndex(o => o.n === startName)), tgt = idx, raf = 0, shown = -1; if (idx < 0) idx = tgt = 0;
    const t0 = performance.now(), info = host.querySelector('#cmpInfo');
    const setInfo = i => { if (i === shown) return; if (shown === -2) shown = -1; shown = i; const o = list[i], rr = fmtRad(o.r), prev = list[i - 1], sun = o.r; info.style.setProperty('--c', o.c);
      info.innerHTML = `<div class="ob-k">${esc(o.ref ? o.kind : (o.kind || typeName(o.id)))}</div><h1>${esc(o.n)}</h1><dl><div><dt>${o.id === 'quasar' ? 'Event horizon' : 'Radius'}</dt><dd>${rr[0]}<small>${rr[1]}</small></dd></div><div><dt>Against the Sun</dt><dd>${sun >= 1 ? '×' + sig(sun) : sig(sun) + ' ×'}</dd></div>${prev ? `<div><dt>Against ${esc(prev.n)}</dt><dd>×${sig(o.r / prev.r)}</dd></div>` : ''}</dl>`;
      host.querySelector('#cmpN').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0'); };
    const niceKm = km => { const p = Math.pow(10, Math.floor(Math.log10(km))), m = km / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; };
    let drawn = 0, lastIdx = -1;
    const frame = now => { if (!host.isConnected) return; if (idx === tgt && lastIdx === idx && now - drawn < 48) { raf = requestAnimationFrame(frame); return; } drawn = now; lastIdx = idx;   // at rest it redraws ~20 times a second (the stars still turn); while moving, every frame
      idx += (tgt - idx) * .085; if (Math.abs(tgt - idx) < .0005) idx = tgt; const w = cv.width, h = cv.height, K = Math.max(1, w / 1400), i0 = Math.max(0, Math.min(list.length - 1, Math.floor(idx))), i1 = Math.min(list.length - 1, i0 + 1), f = idx - i0;
      const fr = o => o.r * (o.id === 'quasar' ? 6 : o.id === 'neutron' ? 2.2 : o.pk === 'saturn' ? 2.3 : 1), r0 = fr(list[i0]), r1 = fr(list[i1]), R = Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * f), cx = list[i0].x + (list[i1].x - list[i0].x) * f, s = h * .17 / R, mid = w * .6, cy = h * .5;   // pixels per solar radius
      SKY.starBg(g, w, h, Math.round(w * h / 2600), 13, '#030208');
      if (allMode) { const t = (now - t0) / 1000, X0 = w * .34, X1 = w * .97, gapMin = Math.min(110 * K, (w * .63) / list.length * .8), mx = Math.max(...list.map(fr)); let S2 = Math.min(h * .36 / mx, (X1 - X0) / list.reduce((a, o) => a + 2.1 * fr(o), 0)), slots;   // every chosen object in one frame, at one true scale
        for (let it = 0; it < 60; it++) { slots = list.map(o => Math.max(2.08 * fr(o) * S2, gapMin)); if (slots.reduce((a, b) => a + b, 0) <= X1 - X0 || list.every(o => 2.08 * fr(o) * S2 < gapMin)) break; S2 *= .93; }
        let xx = X0 + (X1 - X0 - slots.reduce((a, b) => a + b, 0)) / 2;
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = K; g.beginPath(); g.moveTo(X0 - 20 * K, cy); g.lineTo(w, cy); g.stroke();
        list.forEach((o, i) => { const rp = o.r * S2, ext = fr(o) * S2, px = xx + slots[i] / 2; xx += slots[i];
          if (o.ref === 'planet') SKY.drawPlanet(g, px, cy, rp, o.pk, o.n, null, K); else if (o.ref === 'earth' || o.ref === 'jupiter') { if (rp < 1.2) { g.fillStyle = 'rgba(220,230,255,.85)'; g.beginPath(); g.arc(px, cy, Math.max(.7 * K, rp), 0, 7); g.fill(); } else g.drawImage(planetTex(o.ref, Math.min(2048, Math.max(64, Math.pow(2, Math.ceil(Math.log2(rp * 2.1)))))), px - rp, cy - rp, rp * 2, rp * 2); }
          else SKY.bodyAt(g, o.b, px, cy, rp, 1, K, t);
          const big = ext > 60 * K, up = !big && i % 2, ly = big ? cy + ext + 40 * K : up ? cy - Math.max(ext, 8 * K) - 46 * K - (i % 4 > 1 ? 34 * K : 0) : cy + Math.max(ext, 8 * K) + 40 * K + (i % 4 > 1 ? 34 * K : 0);
          g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = K; g.beginPath(); g.moveTo(px, cy + (ly < cy ? -1 : 1) * Math.max(rp + 3 * K, 6 * K)); g.lineTo(px, ly + (ly < cy ? 10 : -24) * K); g.stroke();
          g.textAlign = 'center'; g.fillStyle = '#ece8f6'; g.font = `italic 400 ${Math.round(17 * K)}px "EB Garamond", Georgia, serif`; g.fillText(o.n, px, ly); g.fillStyle = 'rgba(200,195,225,.75)'; g.font = `300 ${Math.round(10.5 * K)}px "IBM Plex Mono", monospace`; g.fillText(fmtRad(o.r)[0], px, ly + 17 * K); });
        const km = niceKm((w * .16) / S2 * RSUN_KM), bw = km / RSUN_KM * S2 / dpr; host.querySelector('#cmpSb').style.width = bw + 'px'; host.querySelector('#cmpSl').textContent = (km >= 1e8 ? sig(km / AU_KM) + ' AU' : nf(km) + ' km');
        if (shown !== -2) { shown = -2; const big = list[list.length - 1]; info.style.setProperty('--c', big.c); info.innerHTML = `<div class="ob-k">${list.length} objects · one true scale</div><h1>${esc(big.n)}</h1><dl>${list.slice().reverse().map(o => `<div><dt>${esc(o.n)}</dt><dd>${o === big ? '×1' : '1 / ' + sig(big.r / o.r)}<small>${fmtRad(o.r)[0]}</small></dd></div>`).join('')}</dl>`; host.querySelector('#cmpN').textContent = 'All ' + list.length; }
        raf = requestAnimationFrame(frame); return; }
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = K; g.beginPath(); g.moveTo(0, cy); g.lineTo(w, cy); g.stroke();
      const t = (now - t0) / 1000;
      list.forEach((o, i) => { const px = mid + (o.x - cx) * s, rp = o.r * s; if (px + rp * 3 < 0 || px - rp * 3 > w) return;
        if (o.ref === 'planet') SKY.drawPlanet(g, px, cy, rp, o.pk, o.n, null, K); else if (o.ref === 'earth' || o.ref === 'jupiter') { if (rp < 1.2) { g.fillStyle = 'rgba(220,230,255,.8)'; g.beginPath(); g.arc(px, cy, Math.max(.7 * K, rp), 0, 7); g.fill(); } else { const S = Math.min(2048, Math.max(64, Math.pow(2, Math.ceil(Math.log2(rp * 2.1))))); g.drawImage(planetTex(o.ref, S), px - rp, cy - rp, rp * 2, rp * 2); } }
        else SKY.bodyAt(g, o.b, px, cy, rp, 1, K, t);
        const near = Math.abs(i - idx) < 3.5; if (near && (rp > 1 || Math.abs(i - idx) < .5)) { const a = Math.max(0, 1 - Math.abs(i - idx) / 3.5); g.save(); g.globalAlpha = a; g.fillStyle = '#ece8f6'; g.font = `italic 400 ${Math.round(18 * K)}px "EB Garamond", Georgia, serif`; g.textAlign = 'center'; const ly = cy + Math.max(rp, 4 * K) + 34 * K; if (ly < h - 60 * K) { g.fillText(o.n, px, ly); g.font = `300 ${Math.round(11 * K)}px "IBM Plex Mono", monospace`; g.fillStyle = 'rgba(200,195,225,.7)'; g.fillText(fmtRad(o.r)[0], px, ly + 18 * K); } g.restore(); } });
      // scale bar
      const km = niceKm((w * .16) / s * RSUN_KM), bw = km / RSUN_KM * s / dpr; host.querySelector('#cmpSb').style.width = bw + 'px'; host.querySelector('#cmpSl').textContent = (km >= 1e8 ? sig(km / AU_KM) + ' AU' : nf(km) + ' km');
      setInfo(Math.round(idx)); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    const go = d => { tgt = Math.max(0, Math.min(list.length - 1, Math.round(tgt) + d)); };
    let acc = 0; cv.addEventListener('wheel', e => { e.preventDefault(); acc += e.deltaY + e.deltaX; if (Math.abs(acc) > 60) { go(Math.sign(acc)); acc = 0; } }, { passive: false });
    let sx = null; cv.onpointerdown = e => { sx = e.clientX; }; cv.onpointerup = e => { if (sx != null && Math.abs(e.clientX - sx) > 30) go(e.clientX < sx ? 1 : -1); sx = null; };
    host.querySelector('#cmpMode').onclick = e => { allMode = !allMode && list.length > 1; shown = -1; e.currentTarget.textContent = allMode ? 'One by one' : 'All at once'; };
    host.querySelector('#cmpPick').onclick = () => { const chosen = new Set(pick && pick.length ? list.map(o => o.n) : []), pk = document.createElement('div'); pk.className = 'ob-search cmp-pick'; host.appendChild(pk);
      pk.innerHTML = `<input id="cpQ" placeholder="Choose objects to compare" autocomplete="off" spellcheck="false"><div class="cp-bar"><span id="cpN"></span><button id="cpAll">Everything</button><button id="cpGo" class="p">Compare</button></div><div class="ob-res" id="cpRes"></div>`;
      const byR = full.slice().sort((a, b) => b.r - a.r), draw = q => { pk.querySelector('#cpRes').innerHTML = byR.filter(o => !q || o.n.toLowerCase().includes(q)).map(o => `<button data-n="${esc(o.n)}" class="${chosen.has(o.n) ? 'on' : ''}" style="--c:${o.c}"><i></i><b>${esc(o.n)}</b><span>${esc(o.ref ? 'Reference' : typeName(o.id))}</span><em>${fmtRad(o.r)[0]}</em></button>`).join('');
          pk.querySelector('#cpN').textContent = chosen.size ? chosen.size + ' chosen' : 'Tap objects to choose them'; pk.querySelectorAll('#cpRes button').forEach(b => b.onclick = () => { chosen.has(b.dataset.n) ? chosen.delete(b.dataset.n) : chosen.add(b.dataset.n); b.classList.toggle('on'); pk.querySelector('#cpN').textContent = chosen.size ? chosen.size + ' chosen' : 'Tap objects to choose them'; }); };
      draw(''); pk.querySelector('#cpQ').oninput = e => draw(e.target.value.trim().toLowerCase()); setTimeout(() => pk.querySelector('#cpQ').focus(), 30);
      pk.querySelector('#cpAll').onclick = () => { close(); compare(list[Math.round(idx)].n); };
      pk.querySelector('#cpGo').onclick = () => { if (chosen.size < 2) return toast('Choose at least two objects'); const names = [...chosen]; close(); compare(names[0], names, 'all'); }; };
    host.querySelector('#cmpPrev').onclick = () => go(-1); host.querySelector('#cmpNext').onclick = () => go(1);
    const key = e => { if (host.querySelector('.cmp-pick') && e.key !== 'Escape') return; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1); else if (e.key === 'Escape') { const pk = host.querySelector('.cmp-pick'); if (pk) pk.remove(); else close(); } };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('keydown', key); host.remove(); if (OM && OM.pause) OM.pause(false); };
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
      ${(() => { const tn = tonight(); return `<div class="cat-tonight" style="--c:${tn.o.c}"><span>Tonight</span><b>${esc(tn.n)}</b>${cat[tn.n] ? 'is already in your sky.' : `is overhead: earn a ${esc(tn.o.name.toLowerCase())} today and it is yours.`}</div>`; })()}
      <section class="cat-charts"><header><span>Star charts</span><u></u><em>${CHARTS.filter(c => chartDone(c.id)).length} / ${CHARTS.length} complete</em></header>
        <p class="cat-aimnote">${P.sky.aim && !cat[P.sky.aim] ? `Telescope aimed at <b>${esc(P.sky.aim)}</b>. The next ${esc((typeOfName(P.sky.aim) || { name: 'object' }).name.toLowerCase())} you earn will be it.` : 'Tap a missing object to aim your telescope at it: the next one of its type you earn will be that one.'}</p>
        <div class="cat-cgrid">${CHARTS.map(c => { const h = chartHave(c), done = h === c.m.length, tr = COS.trail.find(t => t.id === 'chart-' + c.id); return `<div class="cat-chart ${done ? 'done' : ''}"><div class="cch"><b>${esc(c.name)}</b><em>${h} / ${c.m.length}</em></div><p>${esc(c.d)}</p><div class="ccm">${c.m.map(n => { const o = typeOfName(n); return cat[n] ? `<button class="on" data-n="${esc(n)}" style="--c:${o.c}"><i></i>${esc(n)}</button>` : `<button class="aim ${P.sky.aim === n ? 'cur' : ''}" data-aim="${esc(n)}" style="--c:${o.c}" title="Aim the telescope: needs a ${esc(o.name.toLowerCase())}"><i></i>${esc(n)}</button>`; }).join('')}</div><div class="ccr"><span class="sw" style="background:${tr.sw}"></span>${done ? `${esc(tr.name)} trail unlocked` : `Reward: the ${esc(tr.name)} trail`}</div></div>`; }).join('')}</div></section>
      ${SKY.OBJ.slice().reverse().map(o => { const list = SKY.POOL[o.id].slice().sort((a, b) => SKY.physR({ ...b, id: o.id }) - SKY.physR({ ...a, id: o.id })), have = list.filter(q => cat[q.n]).length;
        return `<section class="cat-row" style="--c:${o.c}"><header><span>${pluralType(o.name)}</span><u></u><em>${have} / ${list.length}</em></header><div class="cat-grid">${list.map(q => cat[q.n] ? `<button class="cat-pl" data-n="${esc(q.n)}" data-id="${o.id}"><canvas width="360" height="260"></canvas><b>${esc(q.n)}</b><span>${fmtRad(SKY.physR({ ...q, id: o.id }))[0]} · ${esc(SKY.massText(q.m))}</span>${cat[q.n] > 1 ? `<em>×${cat[q.n]}</em>` : ''}</button>` : `<button class="cat-pl lock ${P.sky.aim === q.n ? 'cur' : ''}" data-aim="${esc(q.n)}"><div class="cat-ph"><i></i></div><b>${esc(q.n)}</b><span>${P.sky.aim === q.n ? 'Telescope aimed' : 'Undiscovered · aim'}</span></button>`).join('')}</div></section>`; }).join('')}
      <p class="cat-note">Plates are compressed (square root of radius) so every face stays visible. True ratios live in Compare sizes.</p>`;
    const draw = () => { box.querySelectorAll('.cat-row').forEach(row => { const pls = [...row.querySelectorAll('.cat-pl[data-n]')]; if (!pls.length) return; const id = pls[0].dataset.id, rs = pls.map(p => SKY.physR({ ...sfNamed(p.dataset.n), id })), mx = Math.max(...rs);
      pls.forEach((p, k) => { const c = p.querySelector('canvas'), g = c.getContext('2d'), w = c.width, h = c.height; g.fillStyle = '#05040b'; g.fillRect(0, 0, w, h); SKY.starfield(g, w, h, 0, 70, k + 3); const q = sfNamed(p.dataset.n), rp = id === 'quasar' ? h * .035 : id === 'neutron' ? h * .07 : Math.max(h * .045, Math.sqrt(rs[k] / mx) * h * .34); /* a quasar or neutron star at true scale would vanish: these rows show the object itself */ SKY.bodyAt(g, { ...q, id }, w / 2, h * .46, rp, 1, 1.4, 2); }); }); };
    draw(); let n = 0; const iv = setInterval(() => { if (!box.isConnected || ++n > 16) return clearInterval(iv); draw(); }, 450);   // sharper faces arrive from the worker: redraw a few times
    box.querySelectorAll('.cat-pl[data-n]').forEach(p => p.onclick = () => open({ focus: p.dataset.n, back: () => openSky() }));
    box.querySelectorAll('.ccm button[data-n]').forEach(p => p.onclick = () => open({ focus: p.dataset.n, back: () => openSky() }));
    box.querySelectorAll('[data-aim]').forEach(p => p.onclick = () => { const n = p.dataset.aim; P.sky.aim = P.sky.aim === n ? '' : n; saveP(); const y = (box.closest('.pagebody, #modal, .modal') || document.scrollingElement).scrollTop; catalogue(box); const sc = box.closest('.pagebody, #modal, .modal') || document.scrollingElement; sc.scrollTop = y; });   // one aim at a time; tap again to release it
    box.querySelector('#catObs').onclick = () => open({ back: () => openSky() }); box.querySelector('#catCmp').onclick = () => compare(skyList()[0] && skyList()[0].n);
  }

  window.Observatory = { open, compare, catalogue, fmtLen, fmtRad };
})();
