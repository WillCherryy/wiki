/* The Observatory: the universe full screen with a quiet typographic HUD (an index of types, an inspector, a scale ruler in real units),
   a size comparison that scrolls through everything you own at true scale, and the catalogue that replaces the old Sky window.
   Uses the map engine in index.html (uniMap) and the renderer in skyobjects.js (SKY). */
(function () {
  'use strict';
  const LY_KM = 9.4607e12, RSUN_KM = 695700, AU_KM = 1.496e8;
  const nf = (v, d = 0) => v.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const lyText = d => d >= 1e9 ? sig(d / 1e9) + ' billion ly' : d >= 1e6 ? sig(d / 1e6) + ' million ly' : nf(Math.round(d)) + ' ly';
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
  /* ---- the sound of the sky: a quiet, slowly breathing drone, retuned to whatever you are looking at. Web Audio only, nothing downloaded; off with one tap and remembered */
  const SkySound = {
    ctx: null, on: (() => { try { return localStorage.getItem('wikiio:skysnd') !== '0'; } catch { return true; } })(), n: {},
    MOOD: { brown: [41, 260, 0, 0], reddwarf: [46, 320, 0, 0], redgiant: [44, 280, .05, 0], sun: [55, 520, 0, 0], bluewhite: [65, 900, .02, 0], bluegiant: [73, 1300, .04, 0], whitedwarf: [82, 1500, 0, .5], neutron: [62, 1100, .03, 1], quasar: [33, 420, .2, 0], galaxy: [49, 620, .08, 0], planet: [52, 480, 0, 0] },   // [root Hz, brightness, solar-wind hiss, pulsar tick]
    start() {
      if (this.ctx || !this.on) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; let c; try { c = this.ctx = new AC(); } catch { return; }
      const N = this.n, out = N.out = c.createGain(); out.gain.value = 0; out.connect(c.destination); out.gain.linearRampToValueAtTime(.055, c.currentTime + 4);
      const lp = N.lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = .6; lp.connect(out);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .045; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();   // the drone breathes over about twenty seconds
      N.osc = [[1, 0], [1.4983, 4], [2, -3], [.5, 2]].map(([r, det], i) => { const o = c.createOscillator(), g = c.createGain(); o.type = i === 1 ? 'triangle' : 'sine'; o.frequency.value = 55 * r; o.detune.value = det; g.gain.value = [.5, .16, .22, .4][i]; o.connect(g); g.connect(lp); o.start(); return { o, r }; });
      const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { b = .985 * b + .015 * (Math.random() * 2 - 1); d[i] = b * 6; }
      const ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .7; N.hiss = c.createGain(); N.hiss.gain.value = .03; ns.connect(bp); bp.connect(N.hiss); N.hiss.connect(out); ns.start();
      const tk = c.createOscillator(), tg = c.createGain(); tk.type = 'sine'; tk.frequency.value = 1320; tg.gain.value = 0; tk.connect(tg); tg.connect(out); tk.start(); N.tick = tg;   // a faint high glint that pulses for neutron stars
      const pl = c.createOscillator(), pg = c.createGain(); pl.type = 'square'; pl.frequency.value = 1.6; pg.gain.value = 0; pl.connect(pg); pg.connect(tg.gain); pl.start(); N.pulse = pg; N.pulseO = pl;
      this.mood(this.last || 'galaxy');
    },
    mood(k) { this.last = k; const c = this.ctx, N = this.n; if (!c) return; const m = this.MOOD[k] || this.MOOD.galaxy, t = c.currentTime;
      N.osc.forEach(({ o, r }) => { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(m[0] * r, t, 1.2); });
      N.lp.frequency.cancelScheduledValues(t); N.lp.frequency.setTargetAtTime(m[1], t, 1.5); N.hiss.gain.setTargetAtTime(.025 + m[2], t, 1.5);
      N.tick.gain.setTargetAtTime(m[3] ? .012 : 0, t, .8); N.pulse.gain.setTargetAtTime(m[3] ? .012 : 0, t, .8); N.pulseO.frequency.setTargetAtTime(k === 'whitedwarf' ? .25 : 1.6, t, .5); },
    stop() { const c = this.ctx; if (!c) return; this.ctx = null; try { this.n.out.gain.setTargetAtTime(0, c.currentTime, .4); setTimeout(() => c.close(), 1600); } catch {} },
    toggle() { this.on = !this.on; try { localStorage.setItem('wikiio:skysnd', this.on ? '1' : '0'); } catch {} if (this.on) this.start(); else this.stop(); return this.on; },
    duck(v) { if (this.ctx) this.n.out.gain.setTargetAtTime(v ? .02 : .055, this.ctx.currentTime, .6); }
  };
  window.SkySound = SkySound;
  function open(opt = {}) {
    closeModal(); const L = skySys(); if (!L.length) { toast('Solve a puzzle and your first object starts your universe'); return; }
    const host = document.createElement('div'); host.id = 'obs'; const types = SKY.OBJ.map((o, i) => ({ o, n: L.filter(b => b.idx === i).length })).filter(t => t.n), galaxies = L.filter(b => b.id === 'quasar').reduce((n, b) => n + (b.count || 1), 0);
    host.innerHTML = `<canvas id="obCv"></canvas><div class="ob-shade"></div><section class="ob-coll" id="obColl" hidden><div class="catbox" id="obCatBox"></div></section>
      <header class="ob-top"><div class="ob-brand"><button class="ob-word" id="obHome">Scorch<b>er</b></button><nav class="ob-tabs" id="obTabs"><button data-v="u" class="on">Universe</button><button data-v="c">Collection</button></nav></div><nav class="ob-crumbs" id="obCrumbs"></nav>
        <div class="ob-links"><button id="obSearch">Search <kbd>/</kbd></button><button id="obCompare">Compare sizes</button><button id="obDisp">Display</button><button id="obSnd" aria-pressed="${SkySound.on}" title="Ambient sound">Sound</button><button class="ob-x" id="obClose" aria-label="Close"></button></div></header>
      <aside class="ob-index" id="obIndex"><button data-t="" class="on"><i></i><span>Everything</span><em>${L.length}</em></button>${types.map(t => `<button data-t="${t.o.id}" style="--c:${t.o.c}"><i></i><span>${pluralType(t.o.name)}</span><em>${t.n}</em></button>`).join('')}</aside>
      <section class="ob-insp" id="obInsp"></section>
      <div class="ob-fov"><span>Field of view</span><b id="obFov">—</b></div>
      <div class="ob-time" id="obTime"><span>Time</span>${SPEEDS.map(([l], i) => `<button data-i="${i}" class="${i ? '' : 'on'}">${l}</button>`).join('')}<button id="obTour">Tour</button></div>
      <div class="ob-ruler" id="obRuler"><button class="ob-z" id="obOut" aria-label="Zoom out">−</button><div class="ob-line" id="obLine">${RULER.ticks.map(([l, v]) => `<i style="left:${rulerX(v) * 100}%"></i><u style="left:${rulerX(v) * 100}%">${l}</u>`).join('')}${Array.from({ length: 21 }, (_, k) => `<s style="left:${k * 5}%"></s>`).join('')}<b id="obMark"><em id="obMarkL"></em></b></div><button class="ob-z" id="obIn" aria-label="Zoom in">+</button></div>
      <div class="ob-hint" id="obHint">Scroll to zoom through twenty powers of ten · drag to move · tap anything</div>
      <div class="ob-search" id="obS" hidden><input id="obQ" placeholder="Find an object" autocomplete="off" spellcheck="false"><div class="ob-res" id="obRes"></div></div>`;
    document.body.appendChild(host); document.body.classList.add('obs-on'); try { host.requestFullscreen && host.requestFullscreen().catch(() => {}); } catch {}
    let qual = 1; const cv = host.querySelector('#obCv'), dpr = Math.min(1.5, window.devicePixelRatio || 1), size = () => { cv.width = Math.round(host.clientWidth * dpr * qual); cv.height = Math.round(host.clientHeight * dpr * qual); }; size();
    const tour1 = !opt.focus && !opt.newId && !P.sky.toured && !matchMedia('(prefers-reduced-motion: reduce)').matches, home0 = L.some(b => b.n === 'The Sun') ? 'The Sun' : L[0].n;   // first visit: a guided flight; a new find: a flight out to it
    let sel = opt.focus || 'Sagittarius A*', filter = new Set(), copyI = 1;   // with nothing chosen, open on the whole universe with the Milky Way, home, at its centre
    const map = window.__map = uniMap(cv, L, { intro: !opt.focus && !tour1, z: .4, noMini: true, onQuality: v => { qual = v; size(); }, follow: opt.focus || null, focus: opt.focus || null, newId: opt.newId, onPick: n => { SKY.mark(null); inspect(n); }, onEmpty: (x, y, k) => identifyStar(x, y, k) });
    const Q = s => host.querySelector(s);
    const KINDS = { moon: 'Our Moon', io: 'The most volcanic world known', europa: 'Ice shell over a hidden ocean', ganymede: 'The largest moon, with its own magnetic field', callisto: 'The most cratered surface known', snow: 'Icy moon', titan: 'A moon with a thick nitrogen atmosphere and methane lakes', iapetus: 'Two-toned moon, one side dark as coal', triton: 'Orbits backwards: a captured dwarf planet',  earth: 'Our home world', ocean: 'Possible ocean world', super: 'Super-Earth', desert: 'Hot rocky world', lava: 'Lava world: its dayside is molten rock', mercury: 'Airless rocky world', rock: 'Rocky world', venus: 'Rocky world under thick clouds', ice: 'Icy world', mars: 'Cold desert world', jupiter: 'Gas giant', saturn: 'Ringed gas giant', uranus: 'Ice giant, tipped on its side', neptune: 'Ice giant', gas: 'Gas giant', hot: 'Hot Jupiter', hotblue: 'Hot Jupiter where it rains glass' };
    function inspectPlanet(n, pi) {
      SkySound.mood('planet'); sel = n; const sz = fmtRad(pi.re * .009158), per = pi.P < 2 ? sig(pi.P * 24) + ' hours' : pi.P < 800 ? sig(pi.P) + ' days' : sig(pi.P / 365.25) + ' years', star = SKY.OBJ[(sfNamed(pi.host) || { idx: 3 }).idx];
      Q('#obCrumbs').innerHTML = `<button data-c="">Universe</button><i></i><button data-c="${esc(pi.host)}">${esc(pi.host)}${pi.moon ? '' : ' system'}</button><i></i><button class="on">${esc(n)}</button>`; Q('#obCrumbs').querySelectorAll('button').forEach(x => x.onclick = () => { if (x.dataset.c) map.pick(x.dataset.c); else if (x.dataset.c === '') map.home('Sagittarius A*'); });
      Q('#obInsp').style.setProperty('--c', '#bcd2ff'); const w = esc(n).split(' ');
      Q('#obInsp').innerHTML = `<div class="ob-k">${pi.moon ? 'Moon of ' + esc(pi.host) : 'Planet'} · ${esc(KINDS[pi.kind] || 'Planet')}</div><h1>${w.length > 1 ? w.slice(0, -1).join(' ') + ' <span>' + w[w.length - 1] + '</span>' : '<span>' + w[0] + '</span>'}</h1>
        <dl><div><dt>Radius</dt><dd>${sig(pi.re)} Earths<small>${sz[0]}</small></dd></div><div><dt>Orbit</dt><dd>${pi.moon ? nf(pi.km) + ' km' : sig(pi.a) + ' AU'}<small>from ${esc(pi.host)}</small></dd></div><div><dt>Year</dt><dd>${per}</dd></div>${SKY.planetLon(n) != null ? `<div><dt>${pi.moon ? 'Position' : 'Where it is today'}</dt><dd>${Math.round(((SKY.planetLon(n) * 180 / Math.PI) % 360 + 360) % 360)}°<small>${pi.moon ? 'its real place in its orbit' : 'its real place, ecliptic longitude'}</small></dd></div>` : ''}</dl>
        <div class="ob-acts"><button class="p" id="obGo">Go to</button><button id="obGlobe">Inspect</button><button id="obStar">Its star</button><button id="obCmp">Compare</button></div>`; Q('#obGlobe').onclick = () => openGlobe(n, () => {});
      Q('#obGo').onclick = () => map.pick(n); Q('#obStar').textContent = pi.moon ? 'Its planet' : 'Its star'; Q('#obStar').onclick = () => map.pick(pi.host); Q('#obCmp').onclick = () => compare(n, [n, 'Earth', 'Jupiter'].filter((v, i, a) => a.indexOf(v) === i), 'all');
    }
    function identifyStar(x, y, k) {   // tap a real star from the Gaia/HYG catalogue: what it is, how far, how bright
      const st = SKY.identify(x, y, 20 * k); if (!st) { SKY.mark(null); return; } SKY.mark(st.src); SkySound.mood(st.T > 20000 ? 'bluegiant' : st.T > 7500 ? 'bluewhite' : st.T > 5200 ? 'sun' : st.M < 1 ? 'redgiant' : 'reddwarf');
      const show = () => { const nm = st.name == null ? SKY.starName(st.src) : st.name, title = nm || 'A catalogue star', w = esc(title).split(' '), lyT = st.ly >= 1000 ? nf(Math.round(st.ly / 10) * 10) : sig(st.ly);
        Q('#obCrumbs').innerHTML = `<button data-c="">Universe</button><i></i><button data-c="Sagittarius A*">Milky Way</button><i></i><button class="on">${esc(title)}</button>`; Q('#obCrumbs').querySelectorAll('button').forEach(b => b.onclick = () => { SKY.mark(null); if (b.dataset.c) map.pick(b.dataset.c); else map.home('Sagittarius A*'); });
        Q('#obInsp').style.setProperty('--c', st.hex);
        Q('#obInsp').innerHTML = `<div class="ob-k">${esc(st.kind)} · real star</div><h1>${w.length > 1 ? w.slice(0, -1).join(' ') + ' <span>' + w[w.length - 1] + '</span>' : '<span>' + w[0] + '</span>'}</h1>
          <p>${nm ? '' : 'One of the 756,000 stars measured by the Gaia and Hipparcos missions. It has no name, only a catalogue entry. '}Its place, brightness and colour are measured, not modelled. Earn objects to collect stars; this one is part of the sky you explore.</p>
          <dl><div><dt>Distance from the Sun</dt><dd>${lyT} ly</dd></div><div><dt>Luminosity</dt><dd>${st.L >= 100 ? nf(Math.round(st.L)) : sig(st.L)} Suns</dd></div><div><dt>Temperature</dt><dd>≈ ${nf(st.T)} K<small>from its colour</small></dd></div><div><dt>Absolute magnitude</dt><dd>${st.M.toFixed(1)}</dd></div></dl>`; };
      show(); if (st.name == null) { const t0 = Date.now(), iv = setInterval(() => { if (SKY.namesReady() || Date.now() - t0 > 6000) { clearInterval(iv); show(); } }, 200); }
    }
    function inspect(n) {
      { const pi = SKY.planetInfo(n); if (pi) return inspectPlanet(n, pi); }
      { const gb = map.lay.bodies[map.lay.idxOf[n]]; if (gb && gb.ghost) { sel = n; SkySound.mood('galaxy'); setTimeout(() => { if (sel === n && host.isConnected) logVisit(n); }, 2600);   /* logged once you have arrived and lingered */ const mw = gb.ghost === 'The Milky Way';   // a galaxy you see but have not collected the heart of
        const KL = { emission: 'Emission nebula · star-forming region', planetary: 'Planetary nebula', open: 'Open star cluster', globular: 'Globular cluster', dark: 'Dark nebula', snr: 'Supernova remnant', struct: 'Structure of the Milky Way' }, inMW = !!gb.land, dl = !gb.dly ? 'The Sun is in it' : lyText(gb.dly), wd = esc(gb.ghost).split(' ');
        Q('#obCrumbs').innerHTML = `<button data-c="">Universe</button><i></i>${inMW ? '<button data-c="Sagittarius A*">Milky Way</button><i></i>' : ''}<button class="on">${esc(mw ? 'Milky Way' : gb.ghost)}</button>`; Q('#obCrumbs').querySelectorAll('button').forEach(x => x.onclick = () => { if (x.dataset.c) map.pick(x.dataset.c); else map.home('Sagittarius A*'); }); Q('#obInsp').style.setProperty('--c', '#cfc9e2');
        Q('#obInsp').innerHTML = mw ? `<div class="ob-k">Our galaxy · barred spiral</div><h1>The Milky <span>Way</span></h1><p>About 100,000 light-years across, with a few hundred billion stars. The Sun sits 26,000 light-years from the centre, where Sagittarius A*, a black hole of four million suns, waits to be found.</p>
          <dl><div><dt>Diameter</dt><dd>~100,000 ly</dd></div><div><dt>Distance</dt><dd>You are here</dd></div></dl><div class="ob-acts"><button class="p" id="obGo">Go to</button></div>`
          : `<div class="ob-k">${inMW ? KL[gb.land] : gb.far ? 'Distant galaxy, magnified by a cluster' : 'Galaxy of the Local Group'} · landmark</div><h1>${wd.length > 1 ? wd.slice(0, -1).join(' ') + ' <span>' + wd[wd.length - 1] + '</span>' : '<span>' + wd[0] + '</span>'}</h1><p>${esc(gb.note || '')}</p>
          <dl><div><dt>Diameter</dt><dd>~${nf(Math.round((gb.rly || gb.rg * SKY.LYU) * 2 * (gb.rly < 5 ? 10 : 1)) / (gb.rly < 5 ? 10 : 1), 1)} ly</dd></div><div><dt>Distance</dt><dd>${dl}${gb.mly || (gb.dly >= 1e6) ? '<small>true direction; the map compresses distance</small>' : ''}</dd></div><div><dt>Collectable</dt><dd>${gb.src ? 'Its star is' : 'No'}<small>${gb.src ? 'earn ' + esc(gb.src) + ' and it joins your sky' : 'it is simply there'}</small></dd></div></dl><div class="ob-acts"><button class="p" id="obGo">Go to</button></div>`; Q('#obGo').onclick = () => map.pick(n); return; } }
      sel = n; copyI = 1; const q = bodyOf(n); if (!q) return; SkySound.mood(q.id); const o = SKY.OBJ[q.idx], b = { ...q, id: q.id }, rad = fmtRad(SKY.physR(b)), me = L.find(x => x.n === q.n), N = me ? me.count || 1 : 1, rn = ((P.sky.runs || {})[q.n] || {}).first, parts = crumbParts(map.lay, q.n);
      Q('#obCrumbs').innerHTML = parts.map((c, i) => `${i ? '<i></i>' : ''}<button data-c="${c.n == null ? '' : esc(c.n)}" class="${i === parts.length - 1 ? 'on' : ''}">${esc(c.t)}</button>`).join('');
      Q('#obCrumbs').querySelectorAll('button').forEach(x => x.onclick = () => { if (x.dataset.c) map.pick(x.dataset.c); else map.home('Sagittarius A*'); });
      const words = esc(q.n).split(' '), nm = words.length > 1 ? words.slice(0, -1).join(' ') + ' <span>' + words[words.length - 1] + '</span>' : `<span>${words[0]}</span>`;
      Q('#obInsp').style.setProperty('--c', o.c);
      Q('#obInsp').innerHTML = `<div class="ob-k">${esc(q.kind)} · ${RARITY[q.idx]}</div><h1>${nm}</h1><p>${esc(q.f)}</p>
        <dl><div><dt>${q.id === 'quasar' ? 'Event horizon' : 'Radius'}</dt><dd>${rad[0]}<small>${rad[1]}</small></dd></div><div><dt>Mass</dt><dd>${esc(SKY.massText(q.m))}</dd></div><div><dt>Temperature</dt><dd>${esc(q.t)}</dd></div>${SKY.NEAR[q.n] && SKY.NEAR[q.n][3] ? `<div><dt>Distance from the Sun</dt><dd>${lyText(SKY.NEAR[q.n][3])}<small>${SKY.NEAR[q.n][3] > 1e5 ? 'in another galaxy' : 'its real place in the sky'}</small></dd></div>` : SKY.GALD[q.n] ? `<div><dt>Distance</dt><dd>${SKY.GALD[q.n][3] >= 1000 ? sig(SKY.GALD[q.n][3] / 1000) + ' billion ly' : sig(SKY.GALD[q.n][3]) + ' million ly'}<small>true direction; the map compresses distance</small></dd></div>` : ''}${(SKY.PLANETS[q.n] || []).length ? `<div><dt>Planets</dt><dd>${SKY.PLANETS[q.n].length}<small>${SKY.PLANETS[q.n].map(p => p[0].replace(/ \(.*\)/, '')).slice(0, 4).join(', ')}${SKY.PLANETS[q.n].length > 4 ? '…' : ''}</small></dd></div>` : ''}${rn ? `<div><dt>Earned</dt><dd>${rn.mode === 'daily' ? 'Daily ' + rn.num : rn.mode === 'pack' ? 'Pack' : 'Puzzle'} · ${rn.clicks} clicks</dd></div>` : ''}</dl>
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
    const LM = map.lay.bodies.filter(b => b.ghost && b.note), fill = qv => { const a = L2.filter(b => !qv || b.n.toLowerCase().includes(qv)).slice(0, 40), lm = qv ? LM.filter(b => b.n.toLowerCase().includes(qv)).slice(0, 12) : []; Q('#obRes').innerHTML = lm.map(b => `<button data-n="${esc(b.n)}" style="--c:#cfc9e2"><i></i><b>${esc(b.n)}</b><span>Landmark</span><em></em></button>`).join('') + a.map(b => { const r = fmtRad(SKY.physR(b)); return `<button data-n="${esc(b.n)}" style="--c:${SKY.OBJ[b.idx].c}"><i></i><b>${esc(b.n)}</b><span>${esc(typeName(b.id))}</span><em>${r[0]}</em></button>`; }).join('') || '<p>Nothing by that name in your universe yet.</p>'; Q('#obRes').querySelectorAll('button').forEach(x => x.onclick = () => { search(false); map.pick(x.dataset.n); }); };
    const search = on => { Q('#obS').hidden = !on; if (on) { Q('#obQ').value = ''; fill(''); setTimeout(() => Q('#obQ').focus(), 30); } };
    Q('#obQ').oninput = e => fill(e.target.value.trim().toLowerCase()); Q('#obS').onclick = e => { if (e.target.id === 'obS') search(false); };
    Q('#obSearch').onclick = () => search(true); Q('#obCompare').onclick = () => compare(sel); Q('#obDisp').onclick = () => dispMenu(host);
    const done = () => { SkySound.stop(); clearInterval(tick); map.stop(); window.removeEventListener('resize', size); document.removeEventListener('keydown', key); document.body.classList.remove('obs-on'); if (document.fullscreenElement) { try { document.exitFullscreen(); } catch {} } host.remove(); if (opt.back) opt.back(); };
    const key = e => { if (!host.isConnected || document.getElementById('cmp')) return; if (e.key === 'Escape') { if (!Q('#obS').hidden) search(false); else if (host.classList.contains('coll')) view('u'); else done(); } else if (e.key === '/' && Q('#obS').hidden) { e.preventDefault(); search(true); } else if ((e.key === '+' || e.key === '=') && Q('#obS').hidden) map.zoom(2); else if (e.key === '-' && Q('#obS').hidden) map.zoom(.5); };
    document.addEventListener('keydown', key); window.addEventListener('resize', size);
    SkySound.start(); Q('#obSnd').onclick = e => { const on = SkySound.toggle(); e.currentTarget.setAttribute('aria-pressed', on); };
    Q('#obClose').onclick = done; Q('#obHome').onclick = () => { view('u'); map.home('Sagittarius A*'); };
    // two views of one sky: the universe, and the collection (the catalogue, charts and locked objects). The map rests while the collection is open
    const view = v => { const c = v === 'c'; SkySound.duck(c); host.classList.toggle('coll', c); Q('#obColl').hidden = !c; map.pause(c); Q('#obTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
      if (c) { catalogue(Q('#obCatBox'), { go: n => { view('u'); map.pick(n); } }); Q('#obColl').scrollTop = 0; if (opt.row) { const el = Q(`.cat-pl[data-id="${CSS.escape(opt.row)}"]`); opt.row = ''; if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 60); } } };
    Q('#obTabs').querySelectorAll('button').forEach(x => x.onclick = () => view(x.dataset.v)); if (opt.tab === 'c') view('c');
    const say = (eye, big, small, ms) => { let c = Q('#obSay'); if (!c) { c = document.createElement('div'); c.id = 'obSay'; c.className = 'ob-say'; host.appendChild(c); } c.innerHTML = `<span>${eye}</span><b>${big}</b>${small ? `<em>${small}</em>` : ''}`; c.classList.remove('gone'); host.classList.add('saying'); clearTimeout(c._t); if (ms) c._t = setTimeout(() => { c.classList.add('gone'); host.classList.remove('saying'); }, ms); return c; };   // while the sky speaks, the panels step back
    const distFromSun = n => { const q = SKY.NEAR[n]; if (q && q[3]) return q[3]; const g = SKY.GALD[n.split('#')[0]]; if (g) return g[3] * 1e6; const ps = map.pos(), a = ps.find(p => p.n === n), b = ps.find(p => p.n === 'The Sun'); return a && b ? Math.hypot(a.wx - b.wx, a.wy - b.wy) * SKY.LYU : 0; };
    const lyT = d => d >= 1e9 ? sig(d / 1e9) + ' billion light-years' : d >= 1e6 ? sig(d / 1e6) + ' million light-years' : nf(Math.round(d)) + ' light-years';
    if (opt.newId && L.some(b => b.n === 'The Sun') && opt.newId !== 'The Sun') {   // a new find: start at home, then fly out to where it really is
      setTimeout(() => { if (!host.isConnected) return; map.jump('The Sun', 60); setTimeout(() => { if (!host.isConnected) return; map.pick(opt.newId); const d = distFromSun(opt.newId); say('A new light in your sky', esc(opt.newId), d ? lyT(d) + ' from the Sun' : '', 8000); }, 1300); }, 150);
    } else if (opt.focus) setTimeout(() => { if (host.isConnected) map.pick(opt.focus); }, 400);
    if (tour1) {   // the first time: a short guided flight from your own stars out to the edge of the universe
      P.sky.toured = 1; saveP(); let on = true; const stop = () => { if (!on) return; on = false; P.sky.toured = 1; saveP(); const c = Q('#obSay'); if (c) c.classList.add('gone'); host.classList.remove('saying'); cv.removeEventListener('pointerdown', stop); };
      cv.addEventListener('pointerdown', stop); const steps = [
        [300, () => { map.jump(home0, 40); say('Your sky', 'Every light here, you earned', 'Each one is a real object, placed where it really is.'); }],
        [4800, () => map.pick('Sagittarius A*')], [5600, () => say('Home', 'The Milky Way', '100,000 light-years across. Your stars live in it.')],
        [10600, () => map.pick('Andromeda Galaxy')], [11400, () => say('Our neighbours', 'The Local Group', 'The Magellanic Clouds, Andromeda and Triangulum.')],
        [16400, () => map.home('Sagittarius A*')], [17200, () => say('The edge', 'Quasars, billions of light-years away', 'Scroll to zoom · drag to move · tap anything', 6500)], [23500, stop]];
      steps.forEach(([t, f]) => setTimeout(() => { if (on && host.isConnected) f(); }, t)); setTimeout(() => { const c = Q('#obSay'); if (c && on) { const k = document.createElement('button'); k.className = 'ob-skip'; k.textContent = 'Skip'; k.onclick = () => { stop(); map.home('Sagittarius A*'); }; c.appendChild(k); } }, 400);
    }
    inspect(sel); setTimeout(() => { const h = Q('#obHint'); if (h) h.classList.add('gone'); }, 7000);
    return map;
  }

  /* ------------------------------------------------------------------ size comparison: everything you own, side by side at true scale */
  const REFS = [{ n: 'Earth', ref: 'earth', r: .00917, kind: 'Our planet, for scale', c: '#7fb4ff' }, { n: 'Jupiter', ref: 'jupiter', r: .1005, kind: 'The largest planet, for scale', c: '#e8c8a0' }];
  function compare(startName, pick, mode, src) {   // pick: only these names (any objects you own, plus Earth, Jupiter and the Sun); mode 'all' shows them side by side in one frame; src: the objects to choose from (Scorcher Sky passes everything; Your Sky, what you own)
    if (document.getElementById('cmp')) return; const own = src || skyList(), seen = new Set(); let list = [];
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
          if (o.ref === 'planet') SKY.drawPlanet(g, px, cy, rp, o.pk, o.n, null, K); else if (o.ref === 'earth' || o.ref === 'jupiter') SKY.drawPlanet(g, px, cy, rp, o.ref, o.ref === 'earth' ? 'Earth' : 'Jupiter', null, K);
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
        if (o.ref === 'planet') SKY.drawPlanet(g, px, cy, rp, o.pk, o.n, null, K); else if (o.ref === 'earth' || o.ref === 'jupiter') SKY.drawPlanet(g, px, cy, rp, o.ref, o.ref === 'earth' ? 'Earth' : 'Jupiter', null, K);
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
      pk.querySelector('#cpAll').onclick = () => { close(); compare(list[Math.round(idx)].n, null, null, src); };
      pk.querySelector('#cpGo').onclick = () => { if (chosen.size < 2) return toast('Choose at least two objects'); const names = [...chosen]; close(); compare(names[0], names, 'all', src); }; };
    host.querySelector('#cmpPrev').onclick = () => go(-1); host.querySelector('#cmpNext').onclick = () => go(1);
    const key = e => { if (host.querySelector('.cmp-pick') && e.key !== 'Escape') return; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1); else if (e.key === 'Escape') { const pk = host.querySelector('.cmp-pick'); if (pk) pk.remove(); else close(); } };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('keydown', key); host.remove(); if (OM && OM.pause) OM.pause(false); };
    document.addEventListener('keydown', key); host.querySelector('#cmpX').onclick = close; setTimeout(() => { const hh = host.querySelector('#cmpHint'); if (hh) hh.classList.add('gone'); }, 6000);
  }

  /* ------------------------------------------------------------------ the catalogue: every object, each row drawn to one true scale */
  function catalogue(box, co = {}) {   // co.go(name): inside the Observatory, a plate flies the universe to it
    const cat = P.sky.cat, fld = P.sky.field || {}, owned = Object.keys(cat).length, total = SKY.OBJ.reduce((n, o) => n + SKY.POOL[o.id].length, 0), finds = Object.values(cat).reduce((a, b) => a + b, 0) + Object.values(fld).reduce((a, b) => a + b, 0), legend = SKY.POOL.quasar.filter(q => cat[q.n]).length;
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'], big = owned <= 12 ? words[owned] : nf(owned);
    const days = Array.from({ length: 28 }, (_, i) => { const d = new Date(Date.now() - (27 - i) * 864e5).toISOString().slice(0, 10), v = P.sky.log[d]; return v === undefined ? '<i></i>' : `<i class="on" style="--c:${SKY.OBJ[v].c}" title="${SKY.OBJ[v].name}"></i>`; }).join('');
    box.innerHTML = `<div class="cat-hd"><div><div class="ob-k">Catalogue</div><h1>${big} <em>of</em> ${total}</h1><p>Every object you have earned. Search, sort and filter below; open Compare sizes to see them all at one true scale.</p>
      <div class="cat-go">${co.go ? '' : '<button id="catObs">Enter the observatory</button>'}<button id="catCmp">Compare sizes</button></div></div>
      <div class="cat-stats"><div><b>${nf(finds)}</b><span>Finds</span></div><div><b>${SKY.OBJ.filter(o => SKY.POOL[o.id].some(q => cat[q.n])).length}</b><span>Types</span></div><div><b>${legend}</b><span>Galaxies</span></div><div class="cat-days"><span>Last 28 days</span><div>${days}</div></div></div></div>
      ${skyNext() ? `<div class="cat-next"><span>Next</span>${esc(skyNext())}</div>` : ''}
      ${(() => { const tn = tonight(); return `<div class="cat-tonight" style="--c:${tn.o.c}"><span>Tonight</span><b>${esc(tn.n)}</b>${cat[tn.n] ? 'is already in your sky.' : `is overhead: earn a ${esc(tn.o.name.toLowerCase())} today and it is yours.`}</div>`; })()}
      <nav class="cat-tabs" id="catTabs"><button data-t="obj">Objects <em>${owned} / ${total}</em></button><button data-t="charts">Star charts <em>${CHARTS.filter(c => chartDone(c.id)).length} / ${CHARTS.length}</em></button><button data-t="log">Logbook <em>${logLands().filter(n => (P.sky.visits || {})[n]).length} / ${logLands().length}</em></button></nav>
      <div class="cat-pane" data-p="charts">
      <section class="cat-charts"><header><span>Star charts</span><u></u><em>${CHARTS.filter(c => chartDone(c.id)).length} / ${CHARTS.length} complete</em></header>
        <p class="cat-aimnote">${P.sky.aim && !cat[P.sky.aim] ? `Telescope aimed at <b>${esc(P.sky.aim)}</b>. The next ${esc((typeOfName(P.sky.aim) || { name: 'object' }).name.toLowerCase())} you earn will be it.` : 'Tap a missing object to aim your telescope at it: the next one of its type you earn will be that one.'}</p>
        <div class="cat-cgrid">${CHARTS.map(c => { const h = chartHave(c), done = h === c.m.length, tr = COS.trail.find(t => t.id === 'chart-' + c.id); return `<div class="cat-chart ${done ? 'done' : ''}"><div class="cch"><b>${esc(c.name)}</b><em>${h} / ${c.m.length}</em></div><p>${esc(c.d)}</p><div class="ccm">${c.m.map(n => { const o = typeOfName(n); return cat[n] ? `<button class="on" data-n="${esc(n)}" style="--c:${o.c}"><i></i>${esc(n)}</button>` : `<button class="aim ${P.sky.aim === n ? 'cur' : ''}" data-aim="${esc(n)}" style="--c:${o.c}" title="Aim the telescope: needs a ${esc(o.name.toLowerCase())}"><i></i>${esc(n)}</button>`; }).join('')}</div><div class="ccr"><span class="sw" style="background:${tr.sw}"></span>${done ? `${esc(tr.name)} trail unlocked` : `Reward: the ${esc(tr.name)} trail`}</div></div>`; }).join('')}</div></section>
      </div>
      <div class="cat-pane" data-p="log">
      ${(() => { const v = P.sky.visits || {}, L2 = logLands(), c = L2.filter(n => v[n]).length; return `<section class="cat-charts cat-log"><header><span>Field logbook</span><u></u><em>${c} / ${L2.length} visited</em></header><p class="cat-aimnote">Landmarks are not earned, they are found: fly to one in the universe and inspect it to log it. Ten unlock the <b>Wanderer</b> trail, all of them the <b>Cartographer</b>.</p>
        <div class="ccm">${L2.map(n => `<button class="${v[n] ? 'on' : ''}" data-n="${esc(n)}" style="--c:${v[n] ? '#e8d5b0' : '#6a6680'}"><i></i>${esc(n)}</button>`).join('')}</div></section>`; })()}
      </div>
      <div class="cat-pane" data-p="obj">
        <div class="cat-bar" id="catBar">
          <label class="cat-q"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="catQ" placeholder="Search by name or kind" autocomplete="off" spellcheck="false"><button type="button" id="catQx" aria-label="Clear search">✕</button></label>
          <div class="cat-sel"><span>Show</span>${[['all', 'All'], ['own', 'Collected'], ['miss', 'Missing']].map(([v, l]) => `<button data-show="${v}">${l}</button>`).join('')}</div>
          <div class="cat-sel"><span>Sort</span>${[['size', 'Size'], ['temp', 'Temperature'], ['dist', 'Distance'], ['name', 'Name'], ['new', 'Recently found']].map(([v, l]) => `<button data-sort="${v}">${l}</button>`).join('')}</div>
          <div class="cat-types"><button data-type="" style="--c:#cfc9e2"><i></i>All types</button>${SKY.OBJ.map(o => `<button data-type="${o.id}" style="--c:${o.c}"><i></i>${pluralType(o.name)} <em>${SKY.POOL[o.id].filter(q => cat[q.n]).length}</em></button>`).join('')}</div>
        </div>
        <div id="catRes"></div>
        <p class="cat-note">Plates are compressed (square root of radius) so every face stays visible. True ratios live in Compare sizes.</p>
      </div>`;
    // ---- objects: search, show, type, sort; remembered on this device
    let st = { q: '', show: 'all', type: '', sort: 'size' }; try { Object.assign(st, JSON.parse(localStorage.getItem('wikiio:catq')) || {}); st.q = ''; } catch {}
    const runs = P.sky.runs || {}, ALL = []; SKY.OBJ.forEach(o => SKY.POOL[o.id].forEach(q => { const b = { ...q, id: o.id }, nd = SKY.NEAR[q.n], gd = SKY.GALD[q.n]; ALL.push({ q, o, id: o.id, own: !!cat[q.n], r: SKY.physR(b), T: SKY.tempOf(b), d: nd && nd[3] ? nd[3] : gd ? gd[3] * 1e6 : q.n === 'The Sun' ? 0 : Infinity, at: (runs[q.n] && runs[q.n].first && runs[q.n].first.at) || 0 }); }));
    const lyT = d => !isFinite(d) ? '—' : d === 0 ? 'Here' : d >= 1e9 ? sig(d / 1e9) + ' billion ly' : d >= 1e6 ? sig(d / 1e6) + ' million ly' : nf(Math.round(d)) + ' ly', ago = t => { const dd = Math.floor((Date.now() - t) / 864e5); return dd < 1 ? 'Today' : dd === 1 ? 'Yesterday' : dd + ' days ago'; };
    const meta = e => !e.own ? (P.sky.aim === e.q.n ? 'Telescope aimed' : 'Undiscovered · aim') : st.sort === 'temp' ? (e.id === 'quasar' ? esc(e.q.t) : '≈ ' + nf(Math.round(e.T / 100) * 100) + ' K') : st.sort === 'dist' ? lyT(e.d) : st.sort === 'new' ? (e.at ? ago(e.at) : 'Found earlier') : `${fmtRad(e.r)[0]} · ${esc(SKY.massText(e.q.m))}`;
    const plate = e => e.own ? `<button class="cat-pl" data-n="${esc(e.q.n)}" data-id="${e.id}" style="--c:${e.o.c}"><canvas width="360" height="260"></canvas><b>${esc(e.q.n)}</b><span>${meta(e)}</span>${st.type || st.sort === 'size' ? '' : `<small>${esc(e.o.name)}</small>`}</button>` : `<button class="cat-pl lock ${P.sky.aim === e.q.n ? 'cur' : ''}" data-aim="${esc(e.q.n)}" style="--c:${e.o.c}"><div class="cat-ph"><i></i></div><b>${esc(e.q.n)}</b><span>${meta(e)}</span></button>`;
    const cmp = { size: (a, b) => b.r - a.r, temp: (a, b) => b.T - a.T, dist: (a, b) => a.d - b.d, name: (a, b) => a.q.n.localeCompare(b.q.n), new: (a, b) => b.at - a.at || b.own - a.own };
    const render = () => {
      try { localStorage.setItem('wikiio:catq', JSON.stringify({ show: st.show, type: st.type, sort: st.sort })); } catch {}
      box.querySelectorAll('[data-show]').forEach(x => x.classList.toggle('on', x.dataset.show === st.show)); box.querySelectorAll('[data-sort]').forEach(x => x.classList.toggle('on', x.dataset.sort === st.sort)); box.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x.dataset.type === st.type));
      const qq = st.q.trim().toLowerCase(), hit = e => (!qq || (e.q.n + ' ' + e.q.kind + ' ' + e.o.name).toLowerCase().includes(qq)) && (st.show === 'all' || (st.show === 'own') === e.own) && (!st.type || e.id === st.type);
      const list = ALL.filter(hit).sort((a, b) => (st.sort === 'new' ? 0 : b.own - a.own) || cmp[st.sort](a, b)), res = box.querySelector('#catRes');
      if (!list.length) { res.innerHTML = `<p class="cat-none">Nothing matches${qq ? ` “${esc(st.q)}”` : ''}.${st.show !== 'all' || st.type ? ' <button id="catReset">Clear filters</button>' : ''}</p>`; const r = box.querySelector('#catReset'); if (r) r.onclick = () => { st = { ...st, show: 'all', type: '', q: '' }; box.querySelector('#catQ').value = ''; render(); }; return; }
      const grouped = st.sort === 'size' && !qq;   // the classic view: one row per type, largest first; any other sort or a search is one list
      res.innerHTML = grouped ? SKY.OBJ.slice().reverse().filter(o => list.some(e => e.id === o.id)).map(o => { const L = list.filter(e => e.id === o.id), have = SKY.POOL[o.id].filter(q => cat[q.n]).length;
          return `<section class="cat-row" style="--c:${o.c}"><header><span>${pluralType(o.name)}</span><u></u><em>${have} / ${SKY.POOL[o.id].length}${fld[o.id] ? ` · +${fld[o.id]} unnamed` : ''}</em></header><div class="cat-grid">${L.map(plate).join('')}</div></section>`; }).join('')
        : `<section class="cat-row"><header><span>${list.length} ${list.length === 1 ? 'object' : 'objects'}${qq ? ` matching “${esc(st.q)}”` : ''}</span><u></u></header><div class="cat-grid">${list.map(plate).join('')}</div></section>`;
      res.querySelectorAll('.cat-pl[data-n]').forEach(p => p.onclick = () => go(p.dataset.n)); res.querySelectorAll('[data-aim]').forEach(p => p.onclick = () => aim(p.dataset.aim)); draw();
    };
    const draw = () => { const rows = [...box.querySelectorAll('#catRes .cat-row')]; rows.forEach(row => { const pls = [...row.querySelectorAll('.cat-pl[data-n]')]; if (!pls.length) return; const mxBy = {}; pls.forEach(p => { const id = p.dataset.id, r = SKY.physR({ ...sfNamed(p.dataset.n), id }); mxBy[id] = Math.max(mxBy[id] || 0, r); });
      pls.forEach((p, k) => { const id = p.dataset.id, c = p.querySelector('canvas'), g = c.getContext('2d'), w = c.width, h = c.height, q = sfNamed(p.dataset.n), r = SKY.physR({ ...q, id }); g.fillStyle = '#05040b'; g.fillRect(0, 0, w, h); SKY.starfield(g, w, h, 0, 70, k + 3); const rp = id === 'quasar' ? h * .035 : id === 'neutron' ? h * .07 : Math.max(h * .045, Math.sqrt(r / mxBy[id]) * h * .34); /* a quasar or neutron star at true scale would vanish: these rows show the object itself */ SKY.bodyAt(g, { ...q, id }, w / 2, h * .46, rp, 1, 1.4, 2); }); }); };
    const go = n => co.go ? co.go(n) : open({ focus: n });
    const aim = n => { P.sky.aim = P.sky.aim === n ? '' : n; saveP(); const sc = box.closest('.ob-coll, .pagebody, #modal, .modal') || document.scrollingElement, y = sc.scrollTop; catalogue(box, co); sc.scrollTop = y; };   // one aim at a time; tap again to release it
    let tq = 0; box.querySelector('#catQ').oninput = e => { clearTimeout(tq); tq = setTimeout(() => { st.q = e.target.value; render(); }, 120); };
    box.querySelector('#catQx').onclick = () => { box.querySelector('#catQ').value = ''; st.q = ''; render(); };
    box.querySelectorAll('[data-show]').forEach(x => x.onclick = () => { st.show = x.dataset.show; render(); }); box.querySelectorAll('[data-sort]').forEach(x => x.onclick = () => { st.sort = x.dataset.sort; render(); });
    box.querySelectorAll('[data-type]').forEach(x => x.onclick = () => { st.type = st.type === x.dataset.type ? '' : x.dataset.type; render(); });
    // sub-tabs: objects, star charts, logbook
    let tab = 'obj'; try { tab = sessionStorage.getItem('wikiio:cattab') || 'obj'; } catch {}
    const setTab = t => { tab = t; try { sessionStorage.setItem('wikiio:cattab', t); } catch {} box.querySelectorAll('#catTabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t)); box.querySelectorAll('.cat-pane').forEach(x => { x.hidden = x.dataset.p !== t; }); if (t === 'obj') draw(); };
    box.querySelectorAll('#catTabs button').forEach(x => x.onclick = () => setTab(x.dataset.t));
    box.querySelectorAll('.cat-pane[data-p="charts"] [data-aim]').forEach(p => p.onclick = () => aim(p.dataset.aim));
    box.querySelectorAll('.cat-pane:not([data-p="obj"]) .ccm button[data-n]').forEach(p => p.onclick = () => go(p.dataset.n));
    render(); setTab(tab); let n = 0; const iv = setInterval(() => { if (!box.isConnected || ++n > 16) return clearInterval(iv); if (tab === 'obj') draw(); }, 450);   // sharper faces arrive from the worker: redraw a few times
    if (box.querySelector('#catObs')) box.querySelector('#catObs').onclick = () => open(); box.querySelector('#catCmp').onclick = () => compare(skyList()[0] && skyList()[0].n);
  }

  window.Observatory = { open, compare, catalogue, fmtLen, fmtRad };
})();
