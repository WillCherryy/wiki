/* Scorcher's sky: nine astronomical objects, coolest to hottest, drawn procedurally on a canvas (no images).
   SKY.draw(g, id, x, y, r, t)   paints one object centred at (x, y) with body radius r (halos reach ~3-6 r).
   SKY.land(g, w, h, id, idx, t) the landing animation on the results card (converge, flash, shock ring, object grows in).
   SKY.system(g, w, h, t, list, opt) a small planetary system: the hottest object you own at the centre, the rest on Keplerian orbits. */
(function () {
  const TAU = Math.PI * 2, hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), sm3 = k => k * k * (3 - 2 * k);
  const easeBack = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }, easeOut = k => 1 - Math.pow(1 - k, 3);
  const OBJ = [
    { id: 'brown', name: 'Brown dwarf', k: 1000, temp: '≈ 1,000 K', kind: 'Substellar object', c: '#d070a8', fact: 'Too small to fuse hydrogen, it glows only with the heat left from its formation.' },
    { id: 'reddwarf', name: 'Red dwarf', k: 3000, temp: '≈ 3,000 K', kind: 'Main-sequence star', c: '#f0523a', fact: 'The most common stars in the galaxy: dim, cool, and able to burn for trillions of years.' },
    { id: 'redgiant', name: 'Red giant', k: 4000, temp: '≈ 4,000 K', kind: 'Evolved star', c: '#f57a34', fact: 'A dying star swollen to tens of times its old size. Huge, but cool on the surface.' },
    { id: 'sun', name: 'Sun-like star', k: 5800, temp: '≈ 5,800 K', kind: 'Main-sequence star', c: '#ffc83a', fact: 'Hydrogen fuses to helium in the core. The Sun is about 4.6 billion years old, roughly halfway through its life.' },
    { id: 'bluewhite', name: 'Blue-white star', k: 10000, temp: '≈ 10,000 K', kind: 'Main-sequence star', c: '#bcd6ff', fact: 'Stars like Sirius burn hotter and brighter than the Sun, and live far shorter lives.' },
    { id: 'bluegiant', name: 'Blue giant', k: 25000, temp: '≈ 25,000 K', kind: 'Massive star', c: '#6fa4ff', fact: 'Massive stars shine tens of thousands of times brighter than the Sun and last only millions of years.' },
    { id: 'whitedwarf', name: 'White dwarf', k: 50000, temp: 'young ≈ 50,000 K', kind: 'Stellar remnant', c: '#a9d0ff', fact: 'The Earth-sized core left behind by a Sun-like star. It cools slowly over billions of years.' },
    { id: 'neutron', name: 'Neutron star', k: 1e6, temp: '≈ 1,000,000 K', kind: 'Stellar remnant', c: '#5fe0ff', fact: 'A city-sized ball of neutrons, denser than an atomic nucleus. Some spin hundreds of times a second as pulsars.' },
    { id: 'quasar', name: 'Quasar', k: 1e7, temp: 'millions of K', kind: 'Accreting black hole', c: '#ffa24a', fact: 'Gas spiralling into a supermassive black hole heats to millions of degrees and can outshine its entire galaxy.' }
  ];
  const FR = { brown: .22, reddwarf: .2, redgiant: .23, sun: .21, bluewhite: .15, bluegiant: .16, whitedwarf: .11, neutron: .12, quasar: .15 };
  const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function halo(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(.3, rgba(col, a * .45)); gr.addColorStop(.65, rgba(col, a * .12)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function sphere(g, x, y, r, c0, c1, c2, seed, t, gran, gcol, glo = .55, dark = .5) {
    dark = dark * .55;
    const gr = g.createRadialGradient(x - r * .3, y - r * .3, r * .06, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(.62, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (gran) { g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); for (let i = 0; i < gran; i++) { const a = hash(seed + i) * TAU, d = Math.sqrt(hash(seed + i + 90)) * r, w = r * (.04 + hash(seed + i + 40) * .09), dr = Math.sin(t * .4 + i) * r * .012, px = x + Math.cos(a) * d + dr, py = y + Math.sin(a) * d, lite = hash(seed + i + 7) > .5;
      g.fillStyle = lite ? rgba(gcol, .08 + hash(seed + i + 3) * glo * .3) : `rgba(0,0,0,${.05 + hash(seed + i + 3) * .1})`; g.beginPath(); g.ellipse(px, py, w, w * .8, a, 0, TAU); g.fill(); } g.restore(); }
    const sh = g.createRadialGradient(x - r * .3, y - r * .3, r * .45, x, y, r * 1.02); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, `rgba(0,0,0,${dark})`); g.fillStyle = sh; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  function spikes(g, x, y, len, col, a, rot = 0, n = 4) { g.save(); g.translate(x, y); g.rotate(rot); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { g.rotate(Math.PI / (n / 2)); const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(.25, rgba(col, a * .35)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -len * .012); g.lineTo(len, 0); g.lineTo(0, len * .012); g.fill(); } g.restore(); }
  function ring(g, x, y, r, col, a, w) { g.strokeStyle = rgba(col, a); g.lineWidth = Math.max(.5, w); g.beginPath(); g.arc(x, y, Math.max(.1, r), 0, TAU); g.stroke(); }
  function loopArc(g, x, y, r, a0, span, h, col, a, w, sway) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(col, a * .55); g.lineWidth = w * 1.8; g.lineCap = 'round'; g.beginPath(); const x0 = x + Math.cos(a0) * r, y0 = y + Math.sin(a0) * r, x1 = x + Math.cos(a0 + span) * r, y1 = y + Math.sin(a0 + span) * r, am = a0 + span / 2, mx = x + Math.cos(am) * (r + h * 1.6 + sway), my = y + Math.sin(am) * (r + h * 1.6 + sway); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke(); g.strokeStyle = rgba('#ffffff', a * .5); g.lineWidth = w * .5; g.stroke(); g.restore(); }
  // a solar prominence: a glowing arch of plasma strands rising from the limb, swaying, then fading and re-forming elsewhere
  function prominence(g, x, y, r, t, seed, col, rate, hMul = 1) {
    const life = (t * rate + hash(seed) * 7) % 1, cyc = Math.floor(t * rate + hash(seed) * 7), al = Math.sin(life * Math.PI), a = hash(seed + cyc * 1.7) * TAU, span = (.2 + .22 * hash(seed + cyc)) * (.6 + .5 * al), h = r * (.26 + .4 * hash(seed + cyc + 3)) * hMul * (.5 + .6 * al);
    if (al < .02) return; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const f = 1 - k * .1, sw = Math.sin(t * 1.3 + k + seed) * span * .06, a0 = a - span / 2 * f + sw, a1 = a + span / 2 * f + sw, hh = h * (1 + .22 * k / 8), ca = (a0 + a1) / 2;
      g.strokeStyle = rgba(col, al * (.55 - k * .04)); g.lineWidth = Math.max(.7, r * (.02 + .008 * (k % 3))); g.beginPath(); g.moveTo(Math.cos(a0) * r * .99 + x, Math.sin(a0) * r * .99 + y); g.quadraticCurveTo(x + Math.cos(ca) * (r + 2 * hh), y + Math.sin(ca) * (r + 2 * hh), x + Math.cos(a1) * r * .99, y + Math.sin(a1) * r * .99); g.stroke(); }
    g.strokeStyle = rgba(col, al * .2); g.lineWidth = r * .1; g.beginPath(); g.moveTo(Math.cos(a - span / 2) * r + x, Math.sin(a - span / 2) * r + y); g.quadraticCurveTo(x + Math.cos(a) * (r + 2 * h), y + Math.sin(a) * (r + 2 * h), x + Math.cos(a + span / 2) * r, y + Math.sin(a + span / 2) * r); g.stroke();
    for (const e of [-1, 1]) halo(g, x + Math.cos(a + e * span / 2) * r, y + Math.sin(a + e * span / 2) * r, r * .12, '#ffffff', al * .35);
    g.restore();
  }
  let QDISC = null;
  function quasarDisc() {   // the accretion disc, lensed, with Doppler beaming: built once at r = 128 as a back layer and a front layer (the near side that passes in front of the hole)
    if (QDISC) return QDISC; const r = 128, SY = .3, N = 40, RMIN = r * .42, RMAX = r * 1.8, mkc = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 288; return c; }, back = mkc(), front = mkc(), ray = (u, c) => `rgba(${c[0]},${c[1]},${c[2]},${u})`;
    const heat = q => q < .12 ? [255, 255, 255] : q < .3 ? [255, 238, 190] : q < .55 ? [255, 176, 70] : q < .8 ? [236, 92, 40] : [150, 36, 28];
    const ring = (g, i, half) => { const q = i / (N - 1), rad = RMAX - (RMAX - RMIN) * Math.pow(q, .85), c = heat(1 - q), al = Math.min(1, .14 + .62 * q); g.lineWidth = Math.max(.7, r * (.05 - .025 * q)); g.beginPath(); if (half === 'back') g.ellipse(0, 0, rad, rad * SY, 0, Math.PI, TAU); else g.ellipse(0, 0, rad, rad * SY, 0, 0, Math.PI); g.strokeStyle = ray(al, c); g.stroke();
      g.beginPath(); g.ellipse(0, 0, rad, rad * SY, 0, half === 'back' ? Math.PI : Math.PI * .5, half === 'back' ? Math.PI * 1.5 : Math.PI, false); g.strokeStyle = ray(al * .6, [255, 255, 255]); g.lineWidth *= .6; g.stroke(); };
    { const g = back.getContext('2d'); g.translate(256, 144); g.globalCompositeOperation = 'lighter';
      const vg = g.createRadialGradient(0, 0, RMIN * .9, 0, 0, RMAX); vg.addColorStop(0, 'rgba(255,220,150,.5)'); vg.addColorStop(.35, 'rgba(255,140,60,.3)'); vg.addColorStop(.75, 'rgba(200,60,30,.14)'); vg.addColorStop(1, 'rgba(150,36,28,0)'); g.save(); g.scale(1, SY); g.fillStyle = vg; g.beginPath(); g.arc(0, 0, RMAX, 0, TAU); g.fill(); g.restore();
      for (let i = 0; i < N; i++) ring(g, i, 'back');
      for (const [k, al, up] of [[.62, .95, -1], [.5, .5, 1]]) for (let j = 0; j < 8; j++) { const q = j / 7, rad = r * (k + q * .26), c = heat(.05 + q * .6); g.strokeStyle = ray(al * (1 - q * .6) * .85, c); g.lineWidth = Math.max(.7, r * (.05 - q * .03)); g.beginPath(); g.arc(0, 0, rad, up < 0 ? Math.PI * 1.04 : 0, up < 0 ? Math.PI * 1.96 : Math.PI * .96); g.stroke(); }
      const core = g.createRadialGradient(0, 0, 0, 0, 0, r * .75); core.addColorStop(0, 'rgba(255,250,235,.55)'); core.addColorStop(.4, 'rgba(255,190,110,.18)'); core.addColorStop(1, 'rgba(255,150,60,0)'); g.save(); g.scale(1, SY * 1.6); g.fillStyle = core; g.beginPath(); g.arc(0, 0, r * .75, 0, TAU); g.fill(); g.restore(); }
    { const g = front.getContext('2d'); g.translate(256, 144); g.globalCompositeOperation = 'lighter'; for (let i = Math.round(N * .62); i < N; i++) ring(g, i, 'front'); }
    QDISC = { back, front }; return QDISC;
  }
  const DRAW = {
    brown(g, x, y, r, t) {
      halo(g, x, y, r * 3.2, '#ff5a9a', .34); halo(g, x, y, r * 1.7, '#ffb070', .26); sphere(g, x, y, r, '#e29ac4', '#8a3f78', '#2a1030', 3, t, 0, '#000', 0, .55);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); for (let i = 0; i < 16; i++) { const yy = y + (i / 15 - .5) * r * 1.9, w = r * (.04 + hash(i) * .09), off = Math.sin(t * .35 + i * 1.7) * r * .05; g.fillStyle = i % 3 === 0 ? 'rgba(255,190,205,.22)' : i % 3 === 1 ? 'rgba(60,15,45,.34)' : 'rgba(200,120,150,.2)'; g.beginPath(); g.ellipse(x + off, yy, r * 1.1, w, 0, 0, TAU); g.fill(); }
      const sx = x + r * (.28 + .1 * Math.sin(t * .25)), sy = y + r * .22; g.fillStyle = 'rgba(255,215,225,.5)'; g.beginPath(); g.ellipse(sx, sy, r * .22, r * .12, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,235,240,.45)'; g.lineWidth = r * .02; g.beginPath(); g.ellipse(sx, sy, r * .15, r * .07, 0, .5, 5); g.stroke(); g.restore();
      const sh = g.createRadialGradient(x - r * .3, y - r * .3, r * .5, x, y, r * 1.02); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = sh; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); ring(g, x, y, r * .985, '#ff9ac8', .25, r * .03);
    },
    reddwarf(g, x, y, r, t) {
      halo(g, x, y, r * 4, '#ff3a20', .42); halo(g, x, y, r * 2.2, '#ff7a40', .3); { const fp = (t * .13) % 1; if (fp < .35) { const k = Math.sin(fp / .35 * Math.PI), a = hash(Math.floor(t * .13) + 3) * TAU; g.save(); g.globalCompositeOperation = 'lighter'; halo(g, x + Math.cos(a) * r * (1 + .5 * k), y + Math.sin(a) * r * (1 + .5 * k), r * (.5 + .9 * k), '#ffd0a0', .55 * k); g.restore(); } } sphere(g, x, y, r, '#ffa070', '#e6482e', '#5a0e06', 21, t, 34, '#ffb078', .5, .5);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); [[.3, -.25, .16], [-.35, .2, .12], [.1, .45, .09]].forEach(([a, b, c]) => { g.fillStyle = 'rgba(120,30,14,.4)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r * 1.6, c * r * 1.3, .4, 0, TAU); g.fill(); g.fillStyle = 'rgba(40,6,4,.6)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r, c * r * .8, .4, 0, TAU); g.fill(); }); g.restore();
      prominence(g, x, y, r, t, 11, '#ffb890', .09, .8); prominence(g, x, y, r, t, 23, '#ff9060', .07, .6);
    },
    redgiant(g, x, y, r0, t) {
      for (let k = 0; k < 3; k++) { const q = ((t * .06 + k / 3) % 1); g.strokeStyle = `rgba(255,130,70,${.18 * (1 - q)})`; g.lineWidth = Math.max(1, r0 * .05 * (1 - q)); g.beginPath(); g.arc(x, y, r0 * (1.5 + q * 2.4), 0, TAU); g.stroke(); }
      const r = r0 * (1 + .018 * Math.sin(t * .9)); halo(g, x, y, r * 4.4, '#ff4a1a', .32); g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const a = hash(i + 70) * TAU + t * .03, L = r * (1.8 + .9 * hash(i + 90)); g.save(); g.translate(x, y); g.rotate(a); const pg = g.createLinearGradient(r * .9, 0, L, 0); pg.addColorStop(0, 'rgba(255,120,50,.13)'); pg.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = pg; g.beginPath(); g.moveTo(r * .9, -r * .16); g.quadraticCurveTo(L * .7, -r * .3 + Math.sin(t * .4 + i) * r * .08, L, -r * .05); g.lineTo(L, r * .05); g.quadraticCurveTo(L * .7, r * .3 + Math.sin(t * .4 + i) * r * .08, r * .9, r * .16); g.closePath(); g.fill(); g.restore(); } g.restore(); for (let i = 3; i >= 1; i--) halo(g, x, y, r * (1.25 + i * .45), '#ff5a28', .16 + .06 * (4 - i));
      sphere(g, x, y, r, '#ffc490', '#f06a30', '#7a1e0c', 44, t, 26, '#ffd8a8', .6, .5);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); for (let i = 0; i < 18; i++) { const a = hash(i + 200) * TAU, d = Math.sqrt(hash(i + 230)) * r * .9, w = r * (.16 + hash(i + 260) * .18), px = x + Math.cos(a) * d + Math.sin(t * .2 + i) * r * .01, py = y + Math.sin(a) * d, gr = g.createRadialGradient(px, py, 0, px, py, w); gr.addColorStop(0, 'rgba(255,214,150,.38)'); gr.addColorStop(.7, 'rgba(255,170,100,.12)'); gr.addColorStop(1, 'rgba(120,30,10,.0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, w, 0, TAU); g.fill(); } g.restore();
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const a = hash(i + 3) * TAU + t * .04; halo(g, x + Math.cos(a) * r * .98, y + Math.sin(a) * r * .98, r * .3, '#ff7a3a', .26); } g.restore();
    },
    sun(g, x, y, r, t) {
      halo(g, x, y, r * 3.2, '#ffb020', .5); g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + hash(i + 7) * .3 + t * .02, l = r * (2 + 1.1 * hash(i + 60)), w = r * (.07 + .1 * hash(i + 90)); g.save(); g.translate(x, y); g.rotate(a); const q = g.createLinearGradient(r, 0, l, 0); q.addColorStop(0, 'rgba(255,220,150,.16)'); q.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = q; g.beginPath(); g.moveTo(r * .95, -w * .5); g.lineTo(l, -w * 2.2); g.lineTo(l, w * 2.2); g.lineTo(r * .95, w * .5); g.closePath(); g.fill(); g.restore(); }
      for (let i = 0; i < 46; i++) { const a = i / 46 * TAU + hash(i) * .1, l = r * (1.35 + hash(i + 40) * .75 + .08 * Math.sin(t * .6 + i)); const gr = g.createLinearGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * l, y + Math.sin(a) * l); gr.addColorStop(0, 'rgba(255,214,120,.34)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.strokeStyle = gr; g.lineWidth = r * (.025 + hash(i + 9) * .04); g.lineCap = 'round'; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .98, y + Math.sin(a) * r * .98); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } g.restore();
      sphere(g, x, y, r, '#fffbe0', '#ffd23e', '#e07a0e', 66, t, 90, '#ffffff', .5, .4);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); [[.35, -.2, .1], [-.3, .25, .075], [.05, .5, .06]].forEach(([a, b, c]) => { g.fillStyle = 'rgba(140,60,10,.65)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r * 1.7, c * r * 1.3, .3, 0, TAU); g.fill(); g.fillStyle = 'rgba(40,12,4,.85)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r, c * r * .75, .3, 0, TAU); g.fill(); }); g.restore();
      prominence(g, x, y, r, t, 31, '#ff9c4a', .06, 1.2); prominence(g, x, y, r, t, 47, '#ffb05a', .08, .9); prominence(g, x, y, r, t, 59, '#ff8a3a', .05, 1);
    },
    bluewhite(g, x, y, r, t) {
      halo(g, x, y, r * 4.4, '#8fb8ff', .55); halo(g, x, y, r * 2.2, '#ffffff', .5); sphere(g, x, y, r, '#ffffff', '#e4efff', '#9ebcf2', 12, t, 0, '#fff', 0, .3);
      spikes(g, x, y, r * 4.4, '#d6e6ff', .8, .15 + Math.sin(t * .2) * .02); spikes(g, x, y, r * 2.6, '#cfe0ff', .35, .15 + Math.PI / 4, 4); ring(g, x, y, r * 2.3, '#cfe0ff', .09, r * .03); ring(g, x, y, r * 3.5, '#a9c8ff', .06, r * .05);
    },
    bluegiant(g, x, y, r, t) {
      halo(g, x, y, r * 4.4, '#4f8cff', .6); const sh = (t * .12) % 1; ring(g, x, y, r * (2 + sh * 1.2), '#6fb4ff', .22 * (1 - sh), r * .05); ring(g, x, y, r * (2.5 + ((sh + .5) % 1) * 1.2), '#6fe0ff', .16 * (1 - ((sh + .5) % 1)), r * .04);
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + t * .06, l = r * (1.7 + hash(i) * 1.1 + .15 * Math.sin(t * 2 + i)), gr = g.createLinearGradient(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l); gr.addColorStop(0, 'rgba(150,195,255,.42)'); gr.addColorStop(1, 'rgba(150,195,255,0)'); g.strokeStyle = gr; g.lineWidth = r * .04; g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } g.restore();
      sphere(g, x, y, r, '#f2f7ff', '#6fa4ff', '#2048b8', 31, t, 30, '#bcd6ff', .5, .5); spikes(g, x, y, r * 3.6, '#b4d0ff', .65, -.12);
    },
    whitedwarf(g, x, y, r, t) {
      // a white dwarf: a point of blinding blue-white light with chromatic diffraction rays, a debris ring and its tiny planet, inside a Helix-like planetary nebula
      const pul = 1 + .05 * Math.sin(t * 2.2);
      halo(g, x, y, r * 8, '#7fb4ff', .42); { const D = r * 10.5; g.save(); g.translate(x, y); g.rotate(t * .012); g.globalAlpha = .85; g.drawImage(helixTex(), -D / 2, -D / 2, D, D); g.restore(); }
      for (let k = 0; k < 2; k++) { const q = ((t * .2) + k * .5) % 1; g.strokeStyle = k ? `rgba(255,150,210,${.22 * (1 - q)})` : `rgba(120,235,235,${.28 * (1 - q)})`; g.lineWidth = Math.max(.5, r * (.08 - .05 * q)); g.beginPath(); g.arc(x, y, r * (1.8 + q * 5.2), 0, TAU); g.stroke(); }
      g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 120; i++) { const a = i / 120 * TAU * 3 + t * (.5 + .2 * hash(i)), rad = r * (1.55 + .6 * hash(i + 9)), tw = .5 + .5 * Math.sin(t * 3 + i); const px = Math.cos(a) * rad, py = Math.sin(a) * rad * .3; g.fillStyle = `rgba(210,235,255,${.2 + .5 * tw * hash(i + 4)})`; g.beginPath(); g.arc(px, py, Math.max(.5, r * .028), 0, TAU); g.fill(); }
      { const a = t * .9, px = Math.cos(a) * r * 2.1, py = Math.sin(a) * r * .63; halo(g, px, py, r * .35, '#9bd0ff', .6); g.fillStyle = '#eaf6ff'; g.beginPath(); g.arc(px, py, Math.max(.8, r * .07), 0, TAU); g.fill(); }
      g.restore();
      // chromatic diffraction: the same cross drawn three times, each a little rotated, in red, green and blue
      for (const [col, da, al] of [['#ff9a9a', -.035, .5], ['#a8ffb4', 0, .55], ['#9ac4ff', .035, .6]]) { spikes(g, x, y, r * 6.2 * pul, col, al, .5 + da, 4); }
      spikes(g, x, y, r * 3.4, '#ffffff', .55, .5 + Math.PI / 4, 4); spikes(g, x, y, r * 2.2, '#cfe6ff', .45, .5 + Math.PI / 8, 8);
      halo(g, x, y, r * 2.2, '#bcd8ff', .7 * pul); sphere(g, x, y, r * .42, '#ffffff', '#eaf4ff', '#a6ccff', 5, t, 0, '#fff', 0, .2); halo(g, x, y, r * 1.1, '#ffffff', 1);
    },
    neutron(g, x, y, r, t) {
      // a pulsar: a city-sized core, a swirling wind nebula, a tilted dipole field, and two lighthouse beams that sweep the sky and ping once a turn
      const rot = t * 2.6 + .6, tilt = .35;
      halo(g, x, y, r * 6, '#4fb6ff', .34); { const D = r * 13; g.save(); g.translate(x, y); g.rotate(-t * .01); g.globalAlpha = .9; g.drawImage(crabTex(), -D / 2, -D / 2, D, D); g.restore(); }
      g.save(); g.translate(x, y); g.globalCompositeOperation = 'lighter';
      // the wind: rings flung outward from the equator, bright where they are young
      for (let k = 0; k < 4; k++) { const q = ((t * .24) + k / 4) % 1, rr = r * (1.2 + q * 4.6); g.strokeStyle = `rgba(170,220,255,${.4 * (1 - q) * (1 - q)})`; g.lineWidth = Math.max(.6, r * (.07 - .045 * q)); g.beginPath(); g.ellipse(0, 0, rr, rr * .34, tilt - .5, 0, TAU); g.stroke(); }
      g.rotate(rot * 0 + tilt + Math.PI / 2);
      // dipole field lines, glowing and a little dashed, tilted off the spin axis
      for (let i = 1; i <= 5; i++) for (const sd of [-1, 1]) { const w = r * .6 * i, h = r * 1.15 * i, al = .5 - i * .07; g.strokeStyle = `rgba(140,225,255,${al})`; g.lineWidth = Math.max(.6, r * .045); g.setLineDash([r * .5, r * .12]); g.lineDashOffset = -t * r * .6 * sd; g.beginPath(); g.ellipse(sd * w, 0, w, h, 0, 0, TAU); g.stroke(); } g.setLineDash([]);
      g.restore();
      // the beams
      g.save(); g.translate(x, y); g.rotate(rot); g.globalCompositeOperation = 'lighter';
      for (const sg of [-1, 1]) { const L = r * 7, cg = g.createLinearGradient(0, 0, 0, sg * L); cg.addColorStop(0, 'rgba(190,245,255,.5)'); cg.addColorStop(.45, 'rgba(120,215,255,.18)'); cg.addColorStop(1, 'rgba(120,215,255,0)'); g.fillStyle = cg; g.beginPath(); g.moveTo(-r * .08, 0); g.lineTo(-r * .85, sg * L); g.lineTo(r * .85, sg * L); g.lineTo(r * .08, 0); g.closePath(); g.fill();
        const cg2 = g.createLinearGradient(0, 0, 0, sg * r * 4.4); cg2.addColorStop(0, 'rgba(255,255,255,.95)'); cg2.addColorStop(.5, 'rgba(160,235,255,.5)'); cg2.addColorStop(1, 'rgba(160,235,255,0)'); g.fillStyle = cg2; g.beginPath(); g.moveTo(-r * .16, 0); g.lineTo(0, sg * r * 4.4); g.lineTo(r * .16, 0); g.closePath(); g.fill();
        for (let i = 0; i < 8; i++) { const q = ((t * .8 + i / 8) % 1); g.fillStyle = `rgba(210,250,255,${.8 * (1 - q)})`; g.beginPath(); g.arc((hash(i + sg) - .5) * r * .3 * q, sg * r * (.4 + q * 5), r * .05, 0, TAU); g.fill(); } }
      g.restore();
      // a flash and ring each time a beam sweeps past
      const ph = (t * 2.6 / Math.PI) % 1, fl = Math.max(0, 1 - ph * 3.2); if (fl > 0) { halo(g, x, y, r * (1.8 + 2 * (1 - fl)), '#ffffff', .55 * fl); ring(g, x, y, r * (.5 + ph * 5), '#bff2ff', .55 * (1 - ph), r * .06); }
      halo(g, x, y, r * 1.6, '#9fe6ff', .7); sphere(g, x, y, r * .3, '#ffffff', '#c2f2ff', '#58c4ec', 8, t, 0, '#fff', 0, .2); halo(g, x, y, r * .8, '#ffffff', 1);
    },
    quasar(g, x, y, r, t) {
      // a supermassive black hole: a lensed accretion disc (cached art) with orbiting hot spots, a photon ring, helical jets with shock knots, radio lobes and a coronal haze
      const TILT = -.3, SY = .3, k = r / 128, spr = quasarDisc(), ray = (u, c) => `rgba(${c[0]},${c[1]},${c[2]},${u})`, br = .92 + .08 * Math.sin(t * 5.3) + .04 * Math.sin(t * 11.1);
      halo(g, x, y, r * 4.2, '#ff7a30', .2); halo(g, x, y, r * 2.4, '#ffa060', .26 * br); halo(g, x, y, r * 1.3, '#ffe0b0', .22 * br);
      g.save(); g.translate(x, y); g.rotate(TILT); g.globalCompositeOperation = 'lighter';
      for (const sgn of [-1, 1]) {
        const L = r * 4.6, flick = .9 + .1 * Math.sin(t * 7 + sgn), sw = (z) => Math.sin(t * .7 + sgn + z * 2.2) * r * .035 * z;
        for (const [wd, al, col] of [[.22, .09, [110, 160, 255]], [.12, .18, [150, 200, 255]], [.055, .48, [215, 235, 255]], [.02, .95, [255, 255, 255]]]) {
          const g0 = g.createLinearGradient(0, 0, 0, sgn * L); g0.addColorStop(0, ray(al * flick, col)); g0.addColorStop(.55, ray(al * .5 * flick, col)); g0.addColorStop(1, ray(0, col));
          g.fillStyle = g0; g.beginPath(); g.moveTo(-r * wd * .5, 0); g.quadraticCurveTo(-r * wd * 1.2 + sw(.5), sgn * L * .5, -r * wd * 2.2 + sw(1), sgn * L); g.lineTo(r * wd * 2.2 + sw(1), sgn * L); g.quadraticCurveTo(r * wd * 1.2 + sw(.5), sgn * L * .5, r * wd * .5, 0); g.closePath(); g.fill();
        }
        // helical filaments wound around the jet
        for (let h = 0; h < 2; h++) { g.strokeStyle = `rgba(190,225,255,${.4 - h * .14})`; g.lineWidth = Math.max(.7, r * .018); g.beginPath(); for (let i = 0; i <= 28; i++) { const z = i / 28, w = Math.sin(z * 14 - t * 2.2 + h * Math.PI) * r * (.03 + .1 * z); i ? g.lineTo(w + sw(z), sgn * L * z * .95) : g.moveTo(w, 0); } g.stroke(); }
        for (let i = 0; i < 6; i++) { const q = ((t * .32 + i / 6) % 1), yy = sgn * L * (.1 + .9 * q), a2 = (1 - q) * (.4 + .6 * Math.sin(q * Math.PI)), rad = r * (.05 + .19 * q), xx = sw(q); halo(g, xx, yy, rad * 3, '#bcd8ff', a2 * .55); g.fillStyle = `rgba(240,248,255,${a2})`; g.beginPath(); g.arc(xx, yy, rad * .42, 0, TAU); g.fill(); }
        const lg = g.createRadialGradient(0, sgn * L, 0, 0, sgn * L, r * 1.3); lg.addColorStop(0, 'rgba(150,190,255,.24)'); lg.addColorStop(.5, 'rgba(120,160,255,.09)'); lg.addColorStop(1, 'rgba(120,160,255,0)'); g.fillStyle = lg; g.beginPath(); g.ellipse(0, sgn * L, r * 1.3, r * .95, 0, 0, TAU); g.fill();
      }
      g.restore();
      g.save(); g.translate(x, y); g.rotate(TILT); g.globalCompositeOperation = 'lighter'; g.globalAlpha = br;
      g.drawImage(spr.back, -256 * k, -144 * k, 512 * k, 288 * k); g.globalAlpha = 1;
      // hot spots orbiting in the disc: brighter as they swing towards us
      const RMIN = r * .42, RMAX = r * 1.8;
      for (let i = 0; i < 46; i++) { const u = hash(i + 5), rad = RMIN + (RMAX - RMIN) * Math.pow(u, .9), sp = (.55 + 1.6 * (1 - u)), a0 = hash(i + 17) * TAU + t * sp, len = .12 + .5 * hash(i + 77); g.strokeStyle = ray(.22 + .45 * hash(i + 9), u < .3 ? [255, 238, 190] : u < .6 ? [255, 176, 70] : [236, 92, 40]); g.lineWidth = Math.max(.5, r * .018); g.beginPath(); g.ellipse(0, 0, rad, rad * SY, 0, a0, a0 + len); g.stroke(); }
      for (let i = 0; i < 3; i++) { const rad = r * (.62 + .3 * i), a = t * (1.9 - .5 * i) + i * 2.1, px = Math.cos(a) * rad, py = Math.sin(a) * rad * SY, boost = .55 + .45 * -Math.sin(a + .0); halo(g, px, py, r * .26, '#fff1c8', .7 * boost); }
      g.globalCompositeOperation = 'source-over';
      const sh = g.createRadialGradient(0, 0, r * .2, 0, 0, r * .36); sh.addColorStop(0, '#000'); sh.addColorStop(.85, '#000'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.beginPath(); g.arc(0, 0, r * .36, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter'; for (const [mul, al, w] of [[.335, .98, .035], [.36, .45, .06], [.4, .16, .1]]) { g.strokeStyle = ray(al * br, [255, 236, 200]); g.lineWidth = r * w; g.beginPath(); g.arc(0, 0, r * mul, 0, TAU); g.stroke(); }
      g.drawImage(spr.front, -256 * k, -144 * k, 512 * k, 288 * k);
      g.restore();
    }
  };

  // every object gets a glow pass on top: layered additive halos, an incandescent core and a bright rim. It breathes, and hotter objects glow harder.
  const GLOW = { brown: ['#ff7ab0', .62, .12], reddwarf: ['#ff4a2a', 1.0, .5], redgiant: ['#ff7a30', 1.2, .6], sun: ['#ffb838', 1.05, .7], bluewhite: ['#9cc4ff', 1.15, .3], bluegiant: ['#6fa0ff', 1.3, .35], whitedwarf: ['#b8d8ff', 1.2, 1], neutron: ['#6fe8ff', 1.3, 1], quasar: ['#ff9a48', 1.25, .5] };
  function glowPass(g, id, x, y, r, t) {
    const [c, k, core] = GLOW[id] || GLOW.sun, seed = id.length * 1.7, pu = 1 + .07 * Math.sin(t * 1.6 + seed) + .03 * Math.sin(t * 4.1 + seed * 2);
    g.save(); g.globalCompositeOperation = 'lighter';
    const rr = id === 'whitedwarf' ? r * .6 : id === 'neutron' ? r * .5 : r;   // those two draw a small body inside a large radius
    if (id !== 'bluewhite' && id !== 'bluegiant') halo(g, x, y, rr * 1.3 * pu, c, .34 * k); halo(g, x, y, rr * 2.3 * pu, c, .24 * k); halo(g, x, y, rr * 4.2 * pu, c, .13 * k);
    if (core > 0 && id !== 'quasar') { const gr = g.createRadialGradient(x, y, 0, x, y, rr * 1.05); gr.addColorStop(0, `rgba(255,255,255,${.5 * core * pu})`); gr.addColorStop(.55, rgba(c, .22 * core)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr * 1.05, 0, TAU); g.fill(); }
    if (['reddwarf', 'redgiant', 'sun', 'bluegiant', 'bluewhite'].includes(id)) { ring(g, x, y, r * 1.0, c, .38 * pu, r * .05); ring(g, x, y, r * 1.06, '#ffffff', .12, r * .04); }
    g.restore();
  }
  // ---- hand-built surface textures: each star or brown dwarf gets a seamless 1024x512 map (bands, granulation, convection cells, spots) drawn once, then scrolled across the disc with limb darkening
  const SURF = new Map(), SURFSPEC = {
    bluewhite: { base: '#9cbcf6', speed: .03, limb: .3 }, bluegiant: { base: '#5a8cf0', speed: .018, limb: .4 }, brown: { base: '#9a4a86', speed: .012 }, reddwarf: { base: '#d8452c', speed: .006 }, redgiant: { base: '#e2602c', speed: .003 }, sun: { base: '#ffc02e', speed: .01 }
  };
  function surfaceTex(id) {
    let c = SURF.get(id); if (c) return c; const W = 1024, H = 512; c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), sd = id.length * 7.3, R = k => hash(sd + k);
    const wrap = (fn) => { for (const dx of [-W, 0, W]) { g.save(); g.translate(dx, 0); fn(); g.restore(); } };
    g.fillStyle = SURFSPEC[id].base; g.fillRect(0, 0, W, H);
    const blob = (x, y, rx, ry, col, a, rot = 0) => { wrap(() => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }); };
    if (id === 'brown') {   // turbulent latitude bands in mauve, rose and cream, with swirling storm ovals
      const pal = ['#f0b6cf', '#a24f86', '#5a2050', '#d58aae', '#7a3568', '#f6cfdc'];
      for (let row = 0; row < 26; row++) { const y0 = row / 26 * H, h = H / 26, col = pal[Math.floor(R(row) * pal.length)], amp = 4 + 10 * R(row + 40), fr = 2 + Math.floor(R(row + 80) * 4), ph = R(row + 120) * TAU;
        wrap(() => { g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x / W * TAU * fr + ph) * amp); for (let x = W; x >= 0; x -= 16) g.lineTo(x, y0 + h * 1.15 + Math.sin(x / W * TAU * fr + ph + .6) * amp); g.closePath(); g.fillStyle = rgba(col, .34 + .3 * R(row + 5)); g.fill(); }); }
      for (let i = 0; i < 70; i++) blob(R(i + 200) * W, R(i + 300) * H, 30 + 70 * R(i + 400), 4 + 8 * R(i + 500), R(i + 600) > .5 ? '#ffe3ee' : '#4a1744', .16 + .2 * R(i + 700));
      for (let k = 0; k < 3; k++) { const x = R(k + 800) * W, y = H * (.3 + .4 * R(k + 810)); blob(x, y, 52, 30, '#fff1f6', .9); blob(x, y, 34, 19, '#f4a9c8', .7); wrap(() => { g.strokeStyle = 'rgba(255,240,246,.55)'; g.lineWidth = 2.2; g.beginPath(); for (let a = 0; a < 9; a += .15) { const rr = 3 + a * 3.1; g.lineTo(x + Math.cos(a) * rr * 1.7, y + Math.sin(a) * rr); } g.stroke(); }); }
    } else if (id === 'bluewhite') {   // a fast rotator: hot, almost limb-free plasma with a bright equatorial belt and darker, gravity-dimmed poles
      for (let i = 0; i < 500; i++) { const rr = 10 + 26 * R(i + 1); blob(R(i) * W, R(i + 3000) * H, rr, rr * .7, R(i + 2000) > .5 ? '#f2f7ff' : '#5f8ae0', .3); }
      for (let i = 0; i < 40; i++) blob(R(i + 400) * W, H * (.35 + .3 * R(i + 420)), 120 + 120 * R(i + 440), 18 + 22 * R(i + 460), '#eaf2ff', .3);
      const pg = g.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, 'rgba(70,100,190,.55)'); pg.addColorStop(.28, 'rgba(70,100,190,0)'); pg.addColorStop(.72, 'rgba(70,100,190,0)'); pg.addColorStop(1, 'rgba(70,100,190,.55)'); g.fillStyle = pg; g.fillRect(0, 0, W, H);
    } else if (id === 'bluegiant') {   // turbulent plasma: long wavering streaks and hot bright knots in deep blue
      for (let row = 0; row < 40; row++) { const y0 = row / 40 * H, col = R(row) > .5 ? '#a6c8ff' : '#2a4fc8', amp = 5 + 12 * R(row + 40), fr = 3 + Math.floor(R(row + 80) * 5), ph = R(row + 120) * TAU;
        wrap(() => { g.beginPath(); g.moveTo(0, y0); for (let x = 0; x <= W; x += 12) g.lineTo(x, y0 + Math.sin(x / W * TAU * fr + ph) * amp); for (let x = W; x >= 0; x -= 12) g.lineTo(x, y0 + 9 + Math.sin(x / W * TAU * fr + ph + .5) * amp); g.closePath(); g.fillStyle = rgba(col, .2 + .18 * R(row + 9)); g.fill(); }); }
      for (let i = 0; i < 380; i++) { const rr = 7 + 18 * R(i + 1); blob(R(i) * W, R(i + 3000) * H, rr, rr * .8, R(i + 2000) > .55 ? '#e8f2ff' : '#173a9a', .3); }
    } else if (id === 'redgiant') {   // vast convection cells: bright upwellings in dark lanes
      g.fillStyle = '#9a3a16'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 220; i++) { const rr = 22 + 34 * R(i + 11); blob(R(i) * W, R(i + 50) * H, rr, rr * (.8 + .4 * R(i + 77)), '#ffb26a', .6); blob(R(i) * W, R(i + 50) * H, rr * .5, rr * .45, '#ffe4b0', .28); }
      for (let i = 0; i < 40; i++) blob(R(i + 300) * W, R(i + 350) * H, 90 + 80 * R(i + 380), 50 + 40 * R(i + 390), '#6a1c0a', .35);
    } else if (id === 'sun') {   // fine granulation, bright faculae and a few sunspot groups
      g.fillStyle = '#f4a420'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 2600; i++) { const rr = 5 + 11 * R(i + 1); blob(R(i) * W, R(i + 9000) * H, rr, rr, R(i + 4000) > .45 ? '#fff4b8' : '#c8680c', .55); }
      for (let i = 0; i < 24; i++) blob(R(i + 500) * W, H * (.25 + .5 * R(i + 520)), 40 + 50 * R(i + 540), 10 + 14 * R(i + 560), '#fffbe0', .5, (R(i + 580) - .5) * .6);
      for (let k = 0; k < 4; k++) { const x = R(k + 900) * W, y = H * (.3 + .4 * R(k + 910)); for (let j = 0; j < 3; j++) { const dx = (j - 1) * 22 + (R(k * 3 + j) - .5) * 10, dy = (R(k * 5 + j) - .5) * 14; blob(x + dx, y + dy, 26, 22, '#8a3a06', .75); blob(x + dx, y + dy, 13, 11, '#1c0a02', .95); } }
    } else {   // red dwarf: mottled, with strong dark starspot groups
      for (let i = 0; i < 700; i++) { const rr = 8 + 20 * R(i + 1); blob(R(i) * W, R(i + 3000) * H, rr, rr, R(i + 2000) > .5 ? '#ff9a68' : '#7a1c0c', .4); }
      for (let k = 0; k < 6; k++) { const x = R(k + 900) * W, y = H * (.2 + .6 * R(k + 910)), rr = 22 + 34 * R(k + 920); blob(x, y, rr * 1.7, rr * 1.5, '#5a1408', .55); blob(x, y, rr, rr * .85, '#1e0604', .9); }
    }
    const c2 = document.createElement('canvas'); c2.width = W * 2; c2.height = H; const k2 = c2.getContext('2d'); k2.drawImage(c, 0, 0); k2.drawImage(c, W, 0); SURF.set(id, c2); return c2;
  }
  function bodySurface(g, id, x, y, r, t) {   // the scrolled texture wrapped onto a sphere (vertical strips narrow towards the limb), with limb darkening, a soft highlight and a thin rim
    const sp = SURFSPEC[id]; if (!sp) return; const tex = surfaceTex(id), W = tex.width / 2, H = tex.height, off = ((t * sp.speed * W) % W + W) % W, rr = r * .985, d = rr * 2, N = r > 70 ? 44 : r > 32 ? 26 : 0;
    g.save(); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.clip();
    if (!N) { g.drawImage(tex, off, 0, H, H, x - rr, y - rr, d, d); }
    else for (let i = 0; i < N; i++) { const a0 = -1 + 2 * i / N, a1 = -1 + 2 * (i + 1) / N, l0 = Math.asin(a0), l1 = Math.asin(a1), u0 = off + (l0 / Math.PI + .5) * (W / 2) * 2 * .5 * 2, u1 = off + (l1 / Math.PI + .5) * (W / 2) * 2 * .5 * 2; g.drawImage(tex, u0, 0, Math.max(.5, u1 - u0), H, x + a0 * rr, y - rr, (a1 - a0) * rr + .6, d); }
    const sh = g.createRadialGradient(x - rr * .3, y - rr * .32, rr * .2, x, y, rr * 1.02); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,' + (sp.limb != null ? sp.limb : .68) + ')'); g.fillStyle = sh; g.fillRect(x - rr, y - rr, d, d);
    g.restore();
  }

  let HELIX = null, CRAB = null;
  function helixTex() {   // the Helix-style planetary nebula around a white dwarf: a glowing ring of thousands of comet-like knots, cyan inside and red outside, with a second, tilted ring
    if (HELIX) return HELIX; const S = 640, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.globalCompositeOperation = 'lighter';
    const ringSet = (rx, ry, tilt, n, w, seed) => { g.save(); g.rotate(tilt); for (let k = 0; k < n; k++) { const a = hash(k + seed) * TAU, u = hash(k * 2 + seed + .5), rad = 1 + (u - .5) * w, x0 = Math.cos(a) * rx * rad, y0 = Math.sin(a) * ry * rad, q = (u - .5) / w + .5,
        col = q < .3 ? [120, 240, 255] : q < .55 ? [150, 255, 210] : q < .78 ? [255, 214, 120] : [255, 110, 90], len = S * (.012 + .03 * hash(k + seed + 9)), dx = Math.cos(a) * len, dy = Math.sin(a) * len * ry / rx;
        const gr = g.createLinearGradient(x0 - dx, y0 - dy, x0 + dx * 1.6, y0 + dy * 1.6); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(.35, `rgba(${col},${.28 + .3 * hash(k + seed + 3)})`); gr.addColorStop(1, `rgba(${col},0)`); g.strokeStyle = gr; g.lineWidth = 1 + 2.2 * hash(k + seed + 5); g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 - dx, y0 - dy); g.lineTo(x0 + dx * 1.6, y0 + dy * 1.6); g.stroke(); }
      const hg = g.createRadialGradient(0, 0, Math.min(rx, ry) * .55, 0, 0, Math.max(rx, ry) * 1.12); hg.addColorStop(0, 'rgba(80,200,230,0)'); hg.addColorStop(.6, 'rgba(70,190,225,.1)'); hg.addColorStop(.85, 'rgba(255,170,110,.12)'); hg.addColorStop(1, 'rgba(255,110,80,0)'); g.fillStyle = hg; g.beginPath(); g.ellipse(0, 0, rx * 1.15, ry * 1.15, 0, 0, TAU); g.fill(); g.restore(); };
    ringSet(S * .36, S * .31, -.35, 650, .24, 1); ringSet(S * .22, S * .3, .9, 240, .2, 400);
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(0, 0, S * .3, 0, 0, S * .5); m.addColorStop(0, '#000'); m.addColorStop(.7, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(-S / 2, -S / 2, S, S); HELIX = c; return c;
  }
  function crabTex() {   // a pulsar wind nebula: blue-white synchrotron glow inside, a web of orange and rose filaments outside, bright arcs at the shock
    if (CRAB) return CRAB; const S = 640, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, S * .3); gr.addColorStop(0, 'rgba(190,230,255,.5)'); gr.addColorStop(.5, 'rgba(90,150,255,.2)'); gr.addColorStop(1, 'rgba(60,110,230,0)'); g.fillStyle = gr; g.save(); g.scale(1, .78); g.rotate(.5); g.beginPath(); g.arc(0, 0, S * .3, 0, TAU); g.fill(); g.restore();
    g.save(); g.rotate(.5); g.scale(1, .76); g.lineCap = 'round';
    for (let k = 0; k < 230; k++) { const a0 = hash(k) * TAU, r0 = S * (.08 + .3 * hash(k + 50)), arc = .25 + 1.1 * hash(k + 90), wob = (hash(k + 130) - .5) * S * .1, q = r0 / (S * .38), col = q < .35 ? [150, 200, 255] : q < .6 ? [255, 190, 130] : [255, 110, 100];
      g.strokeStyle = `rgba(${col},${.1 + .22 * hash(k + 170)})`; g.lineWidth = .8 + 2.2 * hash(k + 210); g.beginPath(); for (let j = 0; j <= 24; j++) { const a = a0 + arc * j / 24, jj = j / 2, rr = r0 + Math.sin(jj * .42 + k) * wob * .35 + wob * jj / 12; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
    for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(210,235,255,${.16 + .03 * k})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, S * (.06 + .018 * k), S * (.04 + .012 * k), 0, hash(k) * TAU, hash(k) * TAU + 2 + hash(k + 4)); g.stroke(); }
    g.restore();
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(0, 0, S * .26, 0, 0, S * .5); m.addColorStop(0, '#000'); m.addColorStop(.62, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(-S / 2, -S / 2, S, S); CRAB = c; return c;
  }
  let NEB = null;
  function nebulaTex() {   // a planetary nebula: irregular glowing shells and filaments around a white dwarf, drawn once
    if (NEB) return NEB; const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.globalCompositeOperation = 'lighter';
    for (const [rad, col, w] of [[.78, '#5fe6e0', .1], [.62, '#9be0ff', .08], [.46, '#ff7ac8', .12], [.3, '#ffb0e0', .07]]) for (let k = 0; k < 120; k++) { const a = hash(k + rad * 90) * TAU, rr = S * .5 * rad * (.86 + .28 * hash(k * 3 + rad * 11)), sz = S * (.015 + .05 * hash(k + 7 + rad)); g.fillStyle = (() => { const gr = g.createRadialGradient(Math.cos(a) * rr, Math.sin(a) * rr * .9, 0, Math.cos(a) * rr, Math.sin(a) * rr * .9, sz); gr.addColorStop(0, rgba(col, .18)); gr.addColorStop(1, rgba(col, 0)); return gr; })(); g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr * .9, sz, 0, TAU); g.fill(); }
    g.lineCap = 'round'; for (let k = 0; k < 46; k++) { const a = hash(k + 300) * TAU, r0 = S * (.1 + .12 * hash(k + 9)), r1 = S * (.3 + .18 * hash(k + 19)); g.strokeStyle = rgba(hash(k + 5) > .5 ? '#bff4ff' : '#ffb8e6', .1 + .12 * hash(k + 6)); g.lineWidth = 1 + 2 * hash(k + 4); g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * .9); g.quadraticCurveTo(Math.cos(a + .25) * (r0 + r1) / 2, Math.sin(a + .25) * (r0 + r1) / 2, Math.cos(a + .12) * r1, Math.sin(a + .12) * r1 * .9); g.stroke(); }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(0, 0, S * .18, 0, 0, S * .5); m.addColorStop(0, '#000'); m.addColorStop(.6, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(-S / 2, -S / 2, S, S);
    NEB = c; return c;
  }
  // ---- extra layers: nebulae and dust drawn behind a body, and finishing details (chromosphere, aurora, transiting planet, diffraction) drawn on top
  let REFL = null, DUST = null;
  function reflTex() {   // a blue reflection nebula: wispy filaments of scattered starlight
    if (REFL) return REFL; const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let k = 0; k < 90; k++) { const a0 = hash(k + 3) * TAU, r0 = S * (.1 + .3 * hash(k + 40)), arc = .5 + 1.6 * hash(k + 80), w = 8 + 26 * hash(k + 120); g.strokeStyle = rgba(hash(k + 7) > .5 ? '#7fb4ff' : '#4f86ff', .05 + .09 * hash(k + 160)); g.lineWidth = w; g.beginPath(); for (let j = 0; j <= 18; j++) { const a = a0 + arc * j / 18, rr = r0 + Math.sin(j * .5 + k) * S * .03 + j * 1.2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .85); } g.stroke(); }
    for (let k = 0; k < 40; k++) { const a = hash(k + 300) * TAU, rr = S * (.1 + .3 * hash(k + 330)), sz = 30 + 60 * hash(k + 360), gr = g.createRadialGradient(Math.cos(a) * rr, Math.sin(a) * rr, 0, Math.cos(a) * rr, Math.sin(a) * rr, sz); gr.addColorStop(0, 'rgba(120,170,255,.1)'); gr.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, sz, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(0, 0, S * .12, 0, 0, S * .5); m.addColorStop(0, '#000'); m.addColorStop(.6, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(-S / 2, -S / 2, S, S); REFL = c; return c;
  }
  function dustTex() {   // clumpy shells of dust thrown off by a giant: dark, rust and gold arcs
    if (DUST) return DUST; const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.globalCompositeOperation = 'lighter';
    for (const [rad, col, n] of [[.3, '#ff9a50', 90], [.4, '#d86a38', 100], [.47, '#a8462a', 80]]) for (let k = 0; k < n; k++) { const a = hash(k + rad * 70) * TAU, rr = S * rad * (.94 + .12 * hash(k * 3 + rad * 9)), sz = S * (.012 + .04 * hash(k + rad * 5)), gr = g.createRadialGradient(Math.cos(a) * rr, Math.sin(a) * rr, 0, Math.cos(a) * rr, Math.sin(a) * rr, sz); gr.addColorStop(0, rgba(col, .2)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, sz, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(0, 0, S * .2, 0, 0, S * .5); m.addColorStop(0, '#000'); m.addColorStop(.7, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(-S / 2, -S / 2, S, S); DUST = c; return c;
  }
  function under(g, id, x, y, r, t) {
    if (id === 'bluegiant') { const D = r * 12; g.save(); g.translate(x, y); g.rotate(t * .008); g.globalAlpha = .38; g.drawImage(reflTex(), -D / 2, -D / 2, D, D); g.restore(); }
    else if (id === 'bluewhite') { const D = r * 8; g.save(); g.translate(x, y); g.rotate(-t * .006); g.globalAlpha = .22; g.drawImage(reflTex(), -D / 2, -D / 2, D, D); g.restore(); }
    else if (id === 'redgiant') { const D = r * 9; g.save(); g.translate(x, y); g.rotate(t * .01); g.globalAlpha = .7; g.drawImage(dustTex(), -D / 2, -D / 2, D, D); g.restore(); }
  }
  function extras(g, id, x, y, r, t) {
    g.save(); g.globalCompositeOperation = 'lighter';
    if (id === 'sun') {
      ring(g, x, y, r * 1.012, '#ff5a64', .5, r * .03);   // the thin pink chromosphere
      for (let i = 0; i < 70; i++) { const a = i / 70 * TAU + hash(i) * .05, l = r * (.04 + .07 * hash(i + 9) * (.7 + .3 * Math.sin(t * 2 + i))); g.strokeStyle = 'rgba(255,110,90,.45)'; g.lineWidth = Math.max(.6, r * .012); g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * (r + l), y + Math.sin(a) * (r + l)); g.stroke(); }
      const cp = (t * .07) % 1; if (cp < .6) { const u = cp / .6, a = hash(Math.floor(t * .07) + 5) * TAU, d = r * (1.1 + 1.9 * easeOut(u)); g.strokeStyle = `rgba(255,205,150,${.2 * (1 - u)})`; g.lineWidth = r * (.16 * (1 - u) + .03); g.beginPath(); g.arc(x + Math.cos(a) * d * .55, y + Math.sin(a) * d * .55, d * .45, a - 1.1, a + 1.1); g.stroke(); }   // a coronal mass ejection
    } else if (id === 'reddwarf') {
      ring(g, x, y, r * 1.012, '#ff4a40', .5, r * .03);
      const a = t * .55, px = Math.cos(a) * r * 2.1, py = Math.sin(a) * r * .5, front = Math.sin(a) > 0, hid = !front && Math.abs(px) < r;
      if (!hid) { g.globalCompositeOperation = 'source-over'; g.fillStyle = front ? '#120808' : '#2a1410'; g.beginPath(); g.arc(x + px, y + py, r * .13, 0, TAU); g.fill(); g.globalCompositeOperation = 'lighter'; ring(g, x + px, y + py, r * .135, '#ff9a6a', .6, r * .025); }
    } else if (id === 'brown') {
      for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(${k ? '200,120,255' : '255,120,220'},${.34 - k * .08 + .12 * Math.sin(t * 1.4 + k + sg)})`; g.lineWidth = r * (.07 - k * .015); g.beginPath(); g.ellipse(x, y + sg * r * (.78 - k * .05), r * (.5 - k * .05), r * (.14 + .02 * k), 0, sg > 0 ? .1 : Math.PI + .1, sg > 0 ? Math.PI - .1 : TAU - .1); g.stroke(); }   // aurorae at the poles
      const fl = (t * 1.3) % 1, id2 = Math.floor(t * 1.3); if (fl < .25) { const ang = hash(id2 + 9) * TAU, d = r * .75 * Math.sqrt(hash(id2 + 13)); halo(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, r * .3 * (1 - fl * 2), '#ffe6ff', .7 * (1 - fl * 4)); }   // lightning
    } else if (id === 'bluewhite') {
      for (let i = 0; i < 3; i++) { ring(g, x, y, r * (2.7 + i * .85), i % 2 ? '#ffd0d0' : '#d0e0ff', .1 * (1 - i * .25), r * .03); }   // Airy rings
      for (const [col, da] of [['#ff7a7a', .25], ['#7affa0', 0], ['#7aa4ff', -.25]]) spikes(g, x, y, r * 5.4, col, .22 + .16 * Math.sin(t * 6 + da * 9), .15 + da * .05, 4);
    } else if (id === 'bluegiant') {
      for (let k = 0; k < 2; k++) { const u = ((t * .1) + k * .5) % 1; g.strokeStyle = `rgba(160,210,255,${.28 * (1 - u)})`; g.lineWidth = r * .05 * (1 - u) + .6; g.beginPath(); g.arc(x, y, r * (1.6 + u * 3.4), -.9, .9); g.stroke(); g.beginPath(); g.arc(x, y, r * (1.6 + u * 3.4), Math.PI - .9, Math.PI + .9); g.stroke(); }   // wind bow shocks
    } else if (id === 'redgiant') {
      const pu = .5 + .5 * Math.sin(t * .8); halo(g, x, y, r * 1.7, '#ff8a40', .2 + .12 * pu);
    } else if (id === 'quasar') {
      const L = r * 7, fl = .16 + .06 * Math.sin(t * 3); g.save(); g.translate(x, y); g.rotate(-.3); const lg = g.createLinearGradient(-L, 0, L, 0); lg.addColorStop(0, 'rgba(255,200,140,0)'); lg.addColorStop(.5, `rgba(255,236,200,${fl})`); lg.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = lg; g.fillRect(-L, -r * .018, L * 2, r * .036); g.restore();   // an anamorphic lens streak
    }
    g.restore();
  }
  const paint = (g, id, x, y, r, t) => { if (id === 'quasar') { glowPass(g, id, x, y, r, t); DRAW.quasar(g, x, y, r, t); if (r > 10) extras(g, id, x, y, r, t); return; } if (r > 10) under(g, id, x, y, r, t); (DRAW[id] || DRAW.sun)(g, x, y, r, t); if (SURFSPEC[id] && r > 5) bodySurface(g, id, x, y, r, t); if (r > 10) extras(g, id, x, y, r, t); glowPass(g, DRAW[id] ? id : 'sun', x, y, r, t); };
  // a subtle colour cast over the body only (the 'color' blend keeps the shading), plus a faint tinted halo: individual character without leaving the type
  function tintBody(g, b, r) {
    const soft = b.id === 'quasar' || b.id === 'whitedwarf' || b.id === 'neutron', R = r * (b.id === 'quasar' ? 1.6 : .9);   // stars have a hard edge to clip to; the others fade out
    g.save(); g.globalCompositeOperation = 'color';
    if (soft) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, rgba(b.tint, b.ta * 1.5)); gr.addColorStop(.55, rgba(b.tint, b.ta * 1.1)); gr.addColorStop(1, rgba(b.tint, 0)); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); }
    else { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip(); g.fillStyle = rgba(b.tint, b.ta * 1.5); g.fillRect(-r, -r, r * 2, r * 2); }
    g.restore(); g.save(); g.globalCompositeOperation = 'lighter'; halo(g, 0, 0, r * 2.4, b.tint, b.ta * .35); g.restore();
  }
  // paint with an individual's look: q = { s: size multiplier, tint, ta } (a POOL entry)
  // one body with its individual look; real multiples are drawn as two bodies around a shared centre (a lensed quasar: two images and a faint arc)
  function paintBody(g, id, x, y, r, t, q) {
    const one = (px, py, pr) => { paint(g, id, px, py, pr, t); if (q && q.tint && pr > 12) { g.save(); g.translate(px, py); tintBody(g, { id, tint: q.tint, ta: q.ta }, pr); g.restore(); } };
    if (!q || !q.twin) return one(x, y, r);
    const c = OBJ.find(o => o.id === id).c, ph = hs2(q.n) * TAU;
    if (q.twin === 'lens') {
      const d = r * 1.3, a = -.5 + ph * .05; halo(g, x, y, r * 1.1, '#ffd9a0', .3); g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(c, .3); g.lineWidth = Math.max(1, r * .05); g.lineCap = 'round';
      g.beginPath(); g.arc(x, y, d, a + .5, a + Math.PI - .5); g.stroke(); g.beginPath(); g.arc(x, y, d * .9, a + Math.PI + .5, a + TAU - .5); g.stroke(); g.restore();
      one(x + Math.cos(a) * d, y + Math.sin(a) * d * .85, r * .62); one(x - Math.cos(a) * d * .9, y - Math.sin(a) * d * .8, r * .48); return;
    }
    const th = t * .8 + ph, d = r * 1.05, dx = Math.cos(th) * d, dy = Math.sin(th) * d * .5, front = Math.sin(th) > 0;   // the nearer one is drawn last
    const A = [x + dx, y + dy, r * .62], B2 = [x - dx, y - dy, r * .5]; (front ? [B2, A] : [A, B2]).forEach(b => one(b[0], b[1], b[2]));
  }
  function paintV(g, id, x, y, r, t, q) { if (!q) return paint(g, id, x, y, r, t); paintBody(g, id, x, y, r * (q.s || 1), t, q); }
  function starfield(g, w, h, t, n = 90, seed = 0) { g.save(); for (let i = 0; i < n; i++) { const x = hash(seed + i) * w, y = hash(seed + i + 500) * h, r = .4 + hash(seed + i + 900) * 1.3, a = .25 + .6 * hash(seed + i + 1300) * (.7 + .3 * Math.sin(t * (1 + hash(i) * 2) + i)); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.restore(); }
  function fade(g, w, h, inner = .55) { g.save(); g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner * .5, w / 2, h / 2, Math.hypot(w, h) * .5); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.7, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); }
  // the landing: particles converge, a flash and shock rings (more for hotter objects), then the object grows in with a small overshoot
  function land(g, w, h, id, idx, t, q) {
    const o = OBJ.find(q => q.id === id) || OBJ[3], cx = w / 2, cy = h * .53, R = (FR[id] || .2) * h, pow = (idx + 1) / 9; g.clearRect(0, 0, w, h);
    const shake = idx >= 6 && t > .38 && t < .75 ? (1 - (t - .38) / .37) * 4 * pow : 0; g.save(); g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    starfield(g, w, h, t, Math.round(w * h / 5500), 3);
    if (t < .42) { const u = clamp(t / .38), e = u * u * u; for (let i = 0; i < 40; i++) { const a = hash(i + 11) * TAU, d0 = h * (.55 + hash(i + 23) * .25), d = d0 * (1 - e), d2 = d0 * (1 - Math.pow(clamp(u - .12), 3)); g.strokeStyle = rgba(o.c, .15 + .6 * u); g.lineWidth = 1 + 1.5 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.stroke(); } halo(g, cx, cy, R * (.3 + 1.4 * u), o.c, .25 + .7 * u); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3 + 9 * u, 0, TAU); g.fill(); }
    const rings = idx >= 7 ? 3 : idx >= 4 ? 2 : 1; for (let i = 0; i < rings; i++) { const u = clamp((t - .38 - i * .1) / .8); if (u > 0 && u < 1) ring(g, cx, cy, R * (.4 + 4.4 * easeOut(u)), i % 2 ? '#ffffff' : o.c, .8 * (1 - u), R * .14 * (1 - u) + 1); }
    if (idx >= 5 && t > .38 && t < 1.7) {   // the rarer the find, the bigger the burst: rays tear outward, sparks fly, a second wave follows
      const u = clamp((t - .38) / 1.2), e = easeOut(u), n = 28 + idx * 6; g.save(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) { const a = hash(i + 61) * TAU, r0 = R * (.5 + 1.1 * e * (.6 + .8 * hash(i + 3))), r1 = r0 + R * (.25 + 1.5 * hash(i + 9)) * (1 - u * .6), al = (1 - u) * (.35 + .5 * hash(i + 21)); const gr = g.createLinearGradient(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1); gr.addColorStop(0, rgba(i % 3 ? '#ffffff' : o.c, 0)); gr.addColorStop(.5, rgba(i % 3 ? '#ffffff' : o.c, al)); gr.addColorStop(1, rgba(o.c, 0)); g.strokeStyle = gr; g.lineWidth = 1 + 2.4 * hash(i + 33); g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); }
      for (let i = 0; i < 46; i++) { const a = hash(i + 301) * TAU, d = R * (.4 + 3.2 * e * hash(i + 7)), al = (1 - u) * (.4 + .5 * hash(i + 5)); g.fillStyle = rgba('#ffffff', al); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d * .9, 1 + 2 * hash(i + 15), 0, TAU); g.fill(); }
      if (idx >= 7) { const u2 = clamp((t - .6) / 1.1); if (u2 > 0 && u2 < 1) { ring(g, 0, 0, R * (.4 + 5.2 * easeOut(u2)), '#ffffff', .5 * (1 - u2), R * .05); ring(g, 0, 0, R * (.3 + 4 * easeOut(u2)), o.c, .6 * (1 - u2), R * .09); } }
      g.restore();
    }
    const k = clamp((t - .4) / .85); if (k > 0) paintV(g, id, cx, cy, Math.max(.5, R * clamp(easeBack(k), 0, 1.15)), t, q);
    const fl = clamp(1 - (t - .38) / .4); if (t >= .38 && fl > 0) { const fg = g.createRadialGradient(cx, cy, 0, cx, cy, h * (.5 + .5 * pow)); fg.addColorStop(0, `rgba(255,255,255,${fl * (.2 + .32 * pow)})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(-10, -10, w + 20, h + 20); }
    g.restore(); fade(g, w, h);
  }
  // real objects: four famous examples of each type. n = display name, a = Wikipedia article, f = a fact
  const POOL = {
    brown: [
      { n: 'Gliese 229 B', a: 'Gliese 229', kind: 'T-dwarf brown dwarf', t: '≈ 900 K', f: 'The first brown dwarf ever confirmed (1995). In 2024 it turned out to be two brown dwarfs orbiting each other.' },
      { n: 'Luhman 16', a: 'Luhman 16', kind: 'Binary brown dwarf', t: '≈ 1,300 K', f: 'A pair of brown dwarfs 6.5 light-years away, the third-closest system to the Sun.' },
      { n: 'WISE 0855−0714', a: 'WISE_0855−0714', kind: 'Y-dwarf brown dwarf', t: '≈ 285 K', f: 'The coldest brown dwarf known, about as cool as Earth’s polar regions, 7.4 light-years away.' },
      { n: 'Epsilon Indi B', a: 'Epsilon Indi', kind: 'Binary brown dwarf', t: '≈ 1,000 K', f: 'Two brown dwarfs orbiting each other, only about 12 light-years from the Sun.' }],
    reddwarf: [
      { n: 'Proxima Centauri', a: 'Proxima Centauri', kind: 'M-type red dwarf', t: '≈ 3,000 K', f: 'The closest star to the Sun, 4.25 light-years away, with a planet about Earth’s mass in its habitable zone.' },
      { n: 'Barnard’s Star', a: 'Barnard%27s_Star', kind: 'M-type red dwarf', t: '≈ 3,200 K', f: 'A red dwarf 6 light-years away with the fastest apparent motion of any star across our sky.' },
      { n: 'TRAPPIST-1', a: 'TRAPPIST-1', kind: 'Ultracool red dwarf', t: '≈ 2,600 K', f: 'A small, cool star 40 light-years away with seven Earth-sized planets.' },
      { n: 'Wolf 359', a: 'Wolf_359', kind: 'M-type red dwarf', t: '≈ 2,800 K', f: 'A faint, flare-prone red dwarf about 7.9 light-years away, one of our nearest neighbours.' }],
    redgiant: [
      { n: 'Betelgeuse', a: 'Betelgeuse', kind: 'Red supergiant', t: '≈ 3,600 K', f: 'Orion’s shoulder. Placed where the Sun is, it would swallow the orbit of Mars. It will end as a supernova.' },
      { n: 'Arcturus', a: 'Arcturus', kind: 'Orange giant', t: '≈ 4,300 K', f: 'The brightest star of the northern sky, an ageing giant 37 light-years away.' },
      { n: 'Aldebaran', a: 'Aldebaran', kind: 'Orange giant', t: '≈ 3,900 K', f: 'The glowing eye of Taurus, a giant about 65 light-years away.' },
      { n: 'Antares', a: 'Antares', kind: 'Red supergiant', t: '≈ 3,600 K', f: 'The red heart of Scorpius, hundreds of times wider than the Sun.' }],
    sun: [
      { n: 'The Sun', a: 'Sun', kind: 'G-type main-sequence star', t: '≈ 5,800 K', f: 'Hydrogen fuses to helium in its core. It is about 4.6 billion years old, roughly halfway through its life.' },
      { n: 'Alpha Centauri A', a: 'Alpha_Centauri', kind: 'G-type main-sequence star', t: '≈ 5,800 K', f: 'A near twin of the Sun, 4.37 light-years away, in a triple system with Proxima.' },
      { n: 'Tau Ceti', a: 'Tau_Ceti', kind: 'G-type main-sequence star', t: '≈ 5,300 K', f: 'A Sun-like star only 12 light-years away, long a favourite target in the search for other worlds.' },
      { n: '51 Pegasi', a: '51_Pegasi', kind: 'G-type main-sequence star', t: '≈ 5,800 K', f: 'Where the first planet around a Sun-like star, 51 Pegasi b, was found in 1995.' }],
    bluewhite: [
      { n: 'Sirius A', a: 'Sirius', kind: 'A-type main-sequence star', t: '≈ 9,900 K', f: 'The brightest star in the night sky, 8.6 light-years away and twice the Sun’s mass.' },
      { n: 'Vega', a: 'Vega', kind: 'A-type main-sequence star', t: '≈ 9,600 K', f: 'A bright summer star 25 light-years away, once used as the zero point of the magnitude scale.' },
      { n: 'Regulus', a: 'Regulus', kind: 'B-type main-sequence star', t: '≈ 12,000 K', f: 'The heart of Leo, 79 light-years away, spinning so fast it is visibly flattened.' },
      { n: 'Fomalhaut', a: 'Fomalhaut', kind: 'A-type main-sequence star', t: '≈ 8,600 K', f: 'A young star 25 light-years away, ringed by a vast belt of dust.' }],
    bluegiant: [
      { n: 'Spica', a: 'Spica', kind: 'Blue giant', t: '≈ 22,000 K', f: 'The brightest star in Virgo, a close pair of blue stars about 250 light-years away.' },
      { n: 'Bellatrix', a: 'Bellatrix', kind: 'Blue giant', t: '≈ 22,000 K', f: 'Orion’s other shoulder, a blue giant about 250 light-years away.' },
      { n: 'Mimosa', a: 'Beta_Crucis', kind: 'Blue giant', t: '≈ 27,000 K', f: 'One of the stars of the Southern Cross, a blue giant about 280 light-years away.' },
      { n: 'Rigel', a: 'Rigel', kind: 'Blue supergiant', t: '≈ 12,000 K', f: 'Orion’s bright foot, tens of thousands of times more luminous than the Sun.' }],
    whitedwarf: [
      { n: 'Sirius B', a: 'Sirius_B', kind: 'White dwarf', t: '≈ 25,000 K', f: 'The first white dwarf discovered (1862): a star of about one Sun-mass packed into Earth’s size.' },
      { n: 'Procyon B', a: 'Procyon', kind: 'White dwarf', t: '≈ 7,700 K', f: 'The faint white dwarf companion of bright Procyon, 11.5 light-years away.' },
      { n: '40 Eridani B', a: '40_Eridani', kind: 'White dwarf', t: '≈ 16,500 K', f: 'One of the first white dwarfs ever identified, in a triple system 16 light-years away.' },
      { n: 'van Maanen’s Star', a: 'Van_Maanen%27s_Star', kind: 'White dwarf', t: '≈ 6,000 K', f: 'The nearest solitary white dwarf, 14 light-years away, its surface dusted with rocky debris.' }],
    neutron: [
      { n: 'Crab Pulsar', a: 'Crab_Pulsar', kind: 'Pulsar', t: '≈ 1,000,000 K', f: 'The core left by the supernova seen from Earth in 1054. It spins about 30 times a second.' },
      { n: 'Vela Pulsar', a: 'Vela_Pulsar', kind: 'Pulsar', t: '≈ 1,000,000 K', f: 'A neutron star spinning about 11 times a second inside the Vela supernova remnant.' },
      { n: 'Geminga', a: 'Geminga', kind: 'Gamma-ray pulsar', t: '≈ 500,000 K', f: 'A pulsar about 800 light-years away that shines mostly in gamma rays and spins every 0.24 seconds.' },
      { n: 'PSR B1919+21', a: 'PSR_B1919%2B21', kind: 'Pulsar', t: '≈ 1,000,000 K', f: 'The first pulsar ever found, spotted by Jocelyn Bell Burnell in 1967.' }],
    quasar: [
      { n: '3C 273', a: '3C_273', kind: 'Quasar', t: 'millions of K', f: 'The first quasar to have its distance measured (1963), about 2.4 billion light-years away.' },
      { n: 'TON 618', a: 'TON_618', kind: 'Quasar', t: 'millions of K', f: 'Powered by one of the most massive black holes known, tens of billions of times the mass of the Sun.' },
      { n: '3C 48', a: '3C_48', kind: 'Quasar', t: 'millions of K', f: 'Among the first quasars found, in 1960, when it looked like an odd star that was loud in radio waves.' },
      { n: 'APM 08279+5255', a: 'APM_08279%2B5255', kind: 'Lensed quasar', t: 'millions of K', f: 'A quasar magnified by a gravitational lens, with signs of an enormous reservoir of water vapour.' }]
  };

  // more famous examples, so each type has 6 to 8
  const MORE = {
    brown: [
      { n: 'Teide 1', a: 'Teide_1', kind: 'M-type brown dwarf', t: '≈ 2,600 K', f: 'One of the first brown dwarfs confirmed, found in the Pleiades star cluster in 1995.' },
      { n: 'Gliese 570 D', a: 'Gliese_570', kind: 'T-dwarf brown dwarf', t: '≈ 800 K', f: 'A cool brown dwarf in a four-body system about 19 light-years away, with methane in its atmosphere.' }],
    reddwarf: [
      { n: 'Ross 128', a: 'Ross_128', kind: 'M-type red dwarf', t: '≈ 3,200 K', f: 'A quiet red dwarf 11 light-years away with a temperate Earth-sized planet.' },
      { n: 'Lalande 21185', a: 'Lalande_21185', kind: 'M-type red dwarf', t: '≈ 3,600 K', f: 'The fourth-nearest star system to the Sun, about 8.3 light-years away.' },
      { n: 'Teegarden’s Star', a: 'Teegarden%27s_Star', kind: 'M-type red dwarf', t: '≈ 2,900 K', f: 'A small red dwarf 12.5 light-years away with two Earth-mass planets.' },
      { n: 'AU Microscopii', a: 'AU_Microscopii', kind: 'M-type red dwarf', t: '≈ 3,700 K', f: 'A young, flaring red dwarf 32 light-years away, circled by a dusty disc and planets.' }],
    redgiant: [
      { n: 'Pollux', a: 'Pollux_(star)', kind: 'Orange giant', t: '≈ 4,600 K', f: 'The brightest star in Gemini, an orange giant 34 light-years away with a known planet.' },
      { n: 'Mira', a: 'Mira', kind: 'Red giant, variable', t: '≈ 3,000 K', f: 'A pulsating red giant that swells and fades over about 11 months. The first variable star of its kind found.' },
      { n: 'Gacrux', a: 'Gamma_Crucis', kind: 'Red giant', t: '≈ 3,600 K', f: 'The nearest red giant to the Sun, at the top of the Southern Cross, 88 light-years away.' },
      { n: 'VY Canis Majoris', a: 'VY_Canis_Majoris', kind: 'Red hypergiant', t: '≈ 3,500 K', f: 'One of the largest stars known, over a thousand times wider than the Sun.' }],
    sun: [
      { n: 'Beta Hydri', a: 'Beta_Hydri', kind: 'G-type subgiant', t: '≈ 5,900 K', f: 'An old, Sun-like star 24 light-years away, a glimpse of what the Sun may look like in the future.' },
      { n: '18 Scorpii', a: '18_Scorpii', kind: 'G-type main-sequence star', t: '≈ 5,800 K', f: 'One of the best-known solar twins, almost identical to the Sun in mass, age and composition.' },
      { n: 'HD 209458', a: 'HD_209458', kind: 'G-type main-sequence star', t: '≈ 6,100 K', f: 'The star where an exoplanet was first seen crossing in front of its star, in 1999.' },
      { n: 'Kepler-452', a: 'Kepler-452', kind: 'G-type main-sequence star', t: '≈ 5,700 K', f: 'A Sun-like star about 1,800 light-years away, host of the “Earth cousin” planet Kepler-452b.' }],
    bluewhite: [
      { n: 'Altair', a: 'Altair', kind: 'A-type main-sequence star', t: '≈ 7,700 K', f: 'A bright star 17 light-years away that spins once in about 9 hours, bulging at its equator.' },
      { n: 'Castor', a: 'Castor_(star)', kind: 'A-type star system', t: '≈ 10,000 K', f: 'The twin of Gemini, a system of six stars about 51 light-years away.' },
      { n: 'Denebola', a: 'Denebola', kind: 'A-type main-sequence star', t: '≈ 8,500 K', f: 'The tail of Leo, 36 light-years away, surrounded by a disc of dust.' },
      { n: 'Achernar', a: 'Achernar', kind: 'B-type main-sequence star', t: '≈ 15,000 K', f: 'A star so fast-spinning that it is squashed into a flattened shape, about 140 light-years away.' }],
    bluegiant: [
      { n: 'Alnilam', a: 'Alnilam', kind: 'Blue supergiant', t: '≈ 27,000 K', f: 'The middle star of Orion’s Belt, about 2,000 light-years away and over 100,000 times brighter than the Sun.' },
      { n: 'Alnitak', a: 'Alnitak', kind: 'Blue supergiant system', t: '≈ 29,000 K', f: 'The eastern star of Orion’s Belt, near the Flame Nebula, and a multiple star system.' },
      { n: 'Mintaka', a: 'Mintaka', kind: 'Blue giant system', t: '≈ 30,000 K', f: 'The western star of Orion’s Belt, a multiple system lying almost on the celestial equator.' },
      { n: 'Adhara', a: 'Epsilon_Canis_Majoris', kind: 'Blue supergiant', t: '≈ 22,000 K', f: 'The brightest source of extreme ultraviolet light in our sky, about 400 light-years away.' }],
    whitedwarf: [
      { n: 'Gliese 440', a: 'Gliese_440', kind: 'White dwarf', t: '≈ 8,000 K', f: 'A lone white dwarf about 15 light-years away, among the closest to the Sun.' },
      { n: 'Stein 2051 B', a: 'Stein_2051', kind: 'White dwarf', t: '≈ 7,100 K', f: 'Its passage in front of a distant star let astronomers weigh it by gravitational lensing, in 2017.' },
      { n: 'G 29-38', a: 'G_29-38', kind: 'Pulsating white dwarf', t: '≈ 11,500 K', f: 'A white dwarf that pulses in brightness and is ringed by dust from shattered rocky bodies.' }],
    neutron: [
      { n: 'PSR B1913+16', a: 'PSR_B1913%2B16', kind: 'Binary pulsar', t: '≈ 1,000,000 K', f: 'The first pulsar found in a binary. Its slowly shrinking orbit confirmed that gravitational waves exist.' },
      { n: 'PSR J0737−3039', a: 'PSR_J0737%E2%88%923039', kind: 'Double pulsar', t: '≈ 1,000,000 K', f: 'The only known system of two pulsars orbiting each other, about 2,000 light-years away.' },
      { n: 'SGR 1806−20', a: 'SGR_1806-20', kind: 'Magnetar', t: '≈ 1,000,000 K', f: 'A magnetar whose 2004 flare briefly outshone the whole galaxy in gamma rays.' },
      { n: 'PSR J0348+0432', a: 'PSR_J0348%2B0432', kind: 'Heavy pulsar', t: '≈ 1,000,000 K', f: 'A neutron star about twice the mass of the Sun, orbited by a white dwarf.' }],
    quasar: [
      { n: 'Markarian 231', a: 'Markarian_231', kind: 'Quasar', t: 'millions of K', f: 'The closest known quasar, about 600 million light-years away, in a merging galaxy.' },
      { n: 'Twin Quasar', a: 'Twin_Quasar', kind: 'Lensed quasar', t: 'millions of K', f: 'One quasar seen twice, split by a gravitational lens. It was the first lens ever found, in 1979.' },
      { n: '3C 279', a: '3C_279', kind: 'Blazar', t: 'millions of K', f: 'A quasar whose jet points almost straight at us, flaring in gamma rays, about 5 billion light-years away.' },
      { n: 'J0313−1806', a: 'J0313%E2%88%921806', kind: 'Distant quasar', t: 'millions of K', f: 'Seen as it was about 670 million years after the Big Bang, among the most distant quasars known.' }]
  };
  Object.keys(MORE).forEach(k => POOL[k].push(...MORE[k]));
  // a third batch: every type now has well over a dozen real objects (m = solar masses; quasars: the central black hole)
  const E = (n, a, kind, t, m, f) => ({ n, a, kind, t, m, f });
  const MORE2 = {
    brown: [E('SCR 1845−6357 B', 'SCR_1845-6357', 'T-dwarf brown dwarf', '≈ 950 K', .04, 'A cool brown dwarf orbiting a red dwarf about 13 light-years away, one of the nearest known.'),
      E('Gliese 569 B', 'Gliese_569', 'Binary brown dwarf', '≈ 2,000 K', .12, 'Two brown dwarfs orbiting each other, themselves circling a flaring red dwarf about 32 light-years away.'),
      E('LP 944-20', 'LP_944-20', 'M-dwarf brown dwarf', '≈ 2,300 K', .06, 'A brown dwarf about 21 light-years away, detected in X-rays in 2000: the first seen that way.'),
      E('WISE 1828+2650', 'WISE_1828%2B2650', 'Y-dwarf brown dwarf', '≈ 300 K', .01, 'One of the coldest brown dwarfs known, at roughly room temperature.'),
      E('PSO J318.5−22', 'PSO_J318.5-22', 'Rogue planetary-mass object', '≈ 1,100 K', .0076, 'A planet-mass object drifting alone about 80 light-years away, with no star to orbit.'),
      E('2M1207', '2M1207', 'Young brown dwarf', '≈ 2,500 K', .025, 'A young brown dwarf with a planet-mass companion imaged in 2004, often called the first directly imaged exoplanet.'),
      E('HD 130948 BC', 'HD_130948', 'Binary brown dwarf', '≈ 1,900 K', .115, 'Two brown dwarfs orbiting each other and a Sun-like star about 60 light-years away; their orbit gave direct masses.')],
    reddwarf: [E('Gliese 229 A', 'Gliese_229', 'M-type red dwarf', '≈ 3,700 K', .58, 'A red dwarf 19 light-years away whose companion turned out, in 2024, to be two brown dwarfs.'),
      E('Gliese 569 A', 'Gliese_569', 'M-type red dwarf', '≈ 3,500 K', .35, 'A magnetically active red dwarf about 32 light-years away that holds a pair of brown dwarfs in orbit.'),
      E('SCR 1845−6357 A', 'SCR_1845-6357', 'M-type red dwarf', '≈ 2,700 K', .1, 'A very small red dwarf about 13 light-years away with a cool brown dwarf in orbit.'),
      E('Stein 2051 A', 'Stein_2051', 'M-type red dwarf', '≈ 3,200 K', .5, 'A red dwarf 18 light-years away; its white dwarf partner let astronomers weigh a star by gravitational lensing.'),
      E('Gliese 581', 'Gliese_581', 'M-type red dwarf', '≈ 3,500 K', .3, 'A red dwarf about 20 light-years away that hosted some of the first claimed habitable-zone planets.'),
      E('Gliese 876', 'Gliese_876', 'M-type red dwarf', '≈ 3,200 K', .33, 'The first red dwarf found with planets: two giants locked in a 2:1 orbital resonance, 15 light-years away.'),
      E('Luyten’s Star', 'Luyten%27s_Star', 'M-type red dwarf', '≈ 3,300 K', .29, 'A quiet red dwarf 12 light-years away with a super-Earth in its habitable zone.'),
      E('Kapteyn’s Star', 'Kapteyn%27s_Star', 'M-type red subdwarf', '≈ 3,500 K', .28, 'A red subdwarf from the galaxy’s old halo, 13 light-years away and moving fast across the sky.'),
      E('Lacaille 9352', 'Lacaille_9352', 'M-type red dwarf', '≈ 3,700 K', .49, 'One of the closest stars to the Sun, 10.7 light-years away, with two known super-Earths.'),
      E('Wolf 1061', 'Wolf_1061', 'M-type red dwarf', '≈ 3,400 K', .29, 'A red dwarf 14 light-years away with three known planets, one in its habitable zone.'),
      E('LHS 1140', 'LHS_1140', 'M-type red dwarf', '≈ 3,000 K', .18, 'A red dwarf 49 light-years away with a rocky super-Earth in the habitable zone, studied by JWST.'),
      E('YZ Ceti', 'YZ_Ceti', 'M-type flare star', '≈ 3,000 K', .13, 'A flaring red dwarf 12 light-years away; radio bursts hint at interactions with its planets.')],
    redgiant: [E('UY Scuti', 'UY_Scuti', 'Red supergiant', '≈ 3,300 K', 9, 'One of the largest stars known, roughly 900 to 1,700 times the Sun’s radius.'),
      E('WOH G64', 'WOH_G64', 'Red supergiant', '≈ 3,400 K', 25, 'A giant in the Large Magellanic Cloud, the first star outside our galaxy imaged in detail (2024).'),
      E('Mu Cephei', 'Mu_Cephei', 'Red supergiant', '≈ 3,750 K', 19, 'Herschel’s “Garnet Star”: among the most luminous red supergiants visible to the naked eye.'),
      E('Rasalgethi', 'Alpha_Herculis', 'Red giant', '≈ 3,300 K', 2.5, 'The head of Hercules: a pulsating red giant in a multiple system, hundreds of times wider than the Sun.'),
      E('R Doradus', 'R_Doradus', 'Red giant', '≈ 2,700 K', 1.2, 'A red giant with the largest apparent size of any star except the Sun; ALMA has mapped its surface.'),
      E('L2 Puppis', 'L2_Puppis', 'Red giant', '≈ 3,500 K', .7, 'A dying Sun-like star 200 light-years away, a preview of the Sun’s future, with a disc seen by ALMA.'),
      E('Hamal', 'Hamal', 'Orange giant', '≈ 4,500 K', 1.5, 'The brightest star in Aries, an orange giant 66 light-years away.'),
      E('Alphard', 'Alpha_Hydrae', 'Orange giant', '≈ 4,100 K', 3, 'The solitary star of Hydra, an orange giant 177 light-years away.')],
    sun: [E('Procyon A', 'Procyon', 'F-type main-sequence star', '≈ 6,500 K', 1.5, 'The eighth brightest star in the sky, 11.5 light-years away, with a white dwarf companion.'),
      E('40 Eridani A', '40_Eridani', 'K-type main-sequence star', '≈ 5,200 K', .84, 'An orange dwarf 16 light-years away in a triple system with a white dwarf and a red dwarf.'),
      E('Alpha Centauri B', 'Alpha_Centauri', 'K-type main-sequence star', '≈ 5,200 K', .9, 'The orange partner of Alpha Centauri A in the Sun’s nearest star system, 4.4 light-years away.'),
      E('55 Cancri', '55_Cancri', 'G-type main-sequence star', '≈ 5,200 K', .9, 'A Sun-like star 41 light-years away with five known planets, including a lava-world super-Earth.'),
      E('Epsilon Eridani', 'Epsilon_Eridani', 'K-type main-sequence star', '≈ 5,000 K', .82, 'A young orange dwarf 10.5 light-years away, ringed by dust and orbited by a giant planet.'),
      E('Epsilon Indi A', 'Epsilon_Indi', 'K-type main-sequence star', '≈ 4,600 K', .76, 'An orange dwarf 12 light-years away; JWST imaged a cold giant planet around it in 2024.'),
      E('61 Cygni', '61_Cygni', 'Binary K dwarfs', '≈ 4,500 K', .7, 'The first star whose distance was measured (Bessel, 1838): two orange dwarfs 11.4 light-years away.'),
      E('HD 130948 A', 'HD_130948', 'G-type main-sequence star', '≈ 5,900 K', 1.1, 'A Sun-like star about 60 light-years away, circled by a pair of brown dwarfs.'),
      E('Kepler-22', 'Kepler-22', 'G-type main-sequence star', '≈ 5,500 K', .97, 'Host of Kepler-22b, in 2011 the first planet Kepler confirmed in a habitable zone; about 620 light-years away.'),
      E('HD 189733', 'HD_189733', 'K-type main-sequence star', '≈ 4,900 K', .8, 'Host of a hot Jupiter whose deep blue colour was measured in 2013, 64 light-years away.'),
      E('Capella', 'Capella', 'Binary of yellow giants', '≈ 5,000 K', 2.6, 'The sixth brightest star, two yellow giants orbiting each other 43 light-years away.'),
      E('Polaris', 'Polaris', 'Cepheid supergiant', '≈ 6,000 K', 5.4, 'The North Star, a pulsating supergiant roughly 430 light-years away.'),
      E('Delta Cephei', 'Delta_Cephei', 'Cepheid supergiant', '≈ 5,900 K', 4.5, 'The star that names the Cepheids, whose rhythmic pulsing became a cosmic yardstick.')],
    bluewhite: [E('Algol', 'Algol', 'Eclipsing binary', '≈ 12,500 K', 3.2, 'The “Demon Star”: a blue-white star eclipsed by a dimmer partner every 2.9 days, 90 light-years away.'),
      E('Deneb', 'Deneb', 'White supergiant', '≈ 8,500 K', 19, 'A supergiant tens of thousands of times brighter than the Sun, in the Summer Triangle, about 2,600 light-years away.'),
      E('Alderamin', 'Alderamin', 'A-type main-sequence star', '≈ 7,700 K', 1.7, 'A rapidly spinning star 49 light-years away that will be near the pole star in about 5,500 years.'),
      E('Merak', 'Beta_Ursae_Majoris', 'A-type main-sequence star', '≈ 9,400 K', 2.7, 'One of the Big Dipper’s “pointer” stars, 79 light-years away.'),
      E('Alioth', 'Alioth', 'A-type chemically peculiar star', '≈ 9,500 K', 3.2, 'The brightest star in the Big Dipper, with a strong and oddly oriented magnetic field, 83 light-years away.'),
      E('Rasalhague', 'Alpha_Ophiuchi', 'A-type giant', '≈ 8,000 K', 2.4, 'The head of the Serpent Bearer, a fast-rotating star about 49 light-years away.'),
      E('Beta Pictoris', 'Beta_Pictoris', 'A-type main-sequence star', '≈ 8,000 K', 1.75, 'A young star 63 light-years away wrapped in a dusty debris disc with at least two giant planets.'),
      E('HR 8799', 'HR_8799', 'A/F-type main-sequence star', '≈ 7,400 K', 1.5, 'A young star 129 light-years away with four giant planets imaged directly.')],
    bluegiant: [E('Acrux', 'Alpha_Crucis', 'Binary of blue giants', '≈ 28,000 K', 15, 'The brightest star of the Southern Cross: two hot, massive stars 320 light-years away.'),
      E('Zeta Ophiuchi', 'Zeta_Ophiuchi', 'O-type blue star', '≈ 34,000 K', 20, 'A runaway star, probably flung out by a supernova companion, driving a bow shock through space.'),
      E('Naos', 'Zeta_Puppis', 'O-type blue supergiant', '≈ 40,000 K', 56, 'One of the hottest stars visible to the naked eye, shining about 800,000 times brighter than the Sun.'),
      E('Eta Carinae', 'Eta_Carinae', 'Luminous blue variable', '≈ 35,000 K', 100, 'In 1843 it briefly became the second brightest star in the sky and threw out the Homunculus Nebula.'),
      E('R136a1', 'R136a1', 'Wolf–Rayet star', '≈ 46,000 K', 200, 'The most massive star known, about 200 times the Sun’s mass, in the Tarantula Nebula.'),
      E('Saiph', 'Kappa_Orionis', 'B-type supergiant', '≈ 26,500 K', 15, 'The Hunter’s knee, a blue supergiant about 650 light-years away.'),
      E('Meissa', 'Lambda_Orionis', 'O-type giant', '≈ 36,000 K', 25, 'The Hunter’s head, a hot blue star lighting a huge ring of gas about 1,100 light-years away.'),
      E('Hadar', 'Beta_Centauri', 'Triple blue giants', '≈ 25,000 K', 11, 'A triple system of hot blue stars about 390 light-years away, the 11th brightest star in the sky.')],
    whitedwarf: [E('BPM 37093', 'BPM_37093', 'Crystallising white dwarf', '≈ 11,000 K', 1.1, 'Its carbon core has crystallised into a vast diamond-like lattice, about 50 light-years away.'),
      E('WD 1856+534', 'WD_1856%2B534', 'White dwarf with a planet', '≈ 4,700 K', .52, 'A giant planet orbits this white dwarf every 34 hours, having survived the star’s red-giant phase.'),
      E('PG 1159−035', 'PG_1159-035', 'Pulsating white dwarf', '≈ 140,000 K', .59, 'A very hot, pulsating white dwarf that gave its name to a whole class of variable stars.'),
      E('IK Pegasi B', 'IK_Pegasi', 'Massive white dwarf', '≈ 35,000 K', 1.15, 'A heavy white dwarf 150 light-years away whose partner star may one day feed it towards a supernova.'),
      E('WD 0137−349', 'WD_0137-349', 'White dwarf with a brown dwarf', '≈ 16,500 K', .4, 'A brown dwarf survived being swallowed by this star as it swelled into a red giant.'),
      E('WD 1145+017', 'WD_1145%2B017', 'White dwarf with shattered debris', '≈ 15,900 K', .6, 'Fragments of a shattered planetesimal cross its face, dimming it every few hours.')],
    neutron: [E('Cassiopeia A', 'Cassiopeia_A', 'Young neutron star', '≈ 2,000,000 K', 1.4, 'Born in a supernova whose light reached Earth about 340 years ago; its cooling can be measured year by year.'),
      E('PSR J1748−2446ad', 'PSR_J1748-2446ad', 'Millisecond pulsar', '≈ 1,000,000 K', 1.4, 'The fastest-spinning pulsar known: 716 rotations every second.'),
      E('PSR J0952−0607', 'PSR_J0952-0607', 'Black-widow pulsar', '≈ 1,000,000 K', 2.35, 'Among the heaviest neutron stars known: about 2.3 Suns packed into a city, spinning 707 times a second.'),
      E('PSR B1257+12', 'PSR_B1257%2B12', 'Pulsar with planets', '≈ 1,000,000 K', 1.4, 'The first planets found beyond the Solar System (1992) orbit this pulsar.'),
      E('PSR J1614−2230', 'PSR_J1614-2230', 'Heavy millisecond pulsar', '≈ 1,000,000 K', 1.9, 'A neutron star of about 1.9 Suns whose weight ruled out many exotic models of matter.'),
      E('RX J1856.5−3754', 'RX_J1856.5-3754', 'Isolated neutron star', '≈ 700,000 K', 1.4, 'One of the nearest neutron stars, about 400 light-years away, glowing alone from leftover heat.'),
      E('SGR 1935+2154', 'SGR_1935%2B2154', 'Magnetar', '≈ 1,000,000 K', 1.4, 'In 2020 this magnetar produced the first fast radio burst traced to our own galaxy.')],
    quasar: [E('OJ 287', 'OJ_287', 'Blazar with a black-hole pair', 'millions of K', 1.8e10, 'Its flares are thought to come from a smaller black hole crossing the disc of a giant one, about every 12 years.'),
      E('Messier 87', 'Messier_87', 'Active galactic nucleus', 'millions of K', 6.5e9, 'Its black hole gave us the first image of a black hole’s shadow, in 2019.'),
      E('Sagittarius A*', 'Sagittarius_A*', 'Supermassive black hole', 'faint, hot flow', 4.3e6, 'The black hole at the centre of our own Milky Way, about 4 million Suns, imaged in 2022.'),
      E('Cygnus A', 'Cygnus_A', 'Radio galaxy', 'millions of K', 2.5e9, 'One of the strongest radio sources in the sky, with jets that carve lobes hundreds of thousands of light-years wide.'),
      E('Centaurus A', 'Centaurus_A', 'Radio galaxy', 'millions of K', 5.5e7, 'The nearest active galaxy, 12 million light-years away, with a dark dust lane and powerful jets.'),
      E('S5 0014+81', 'S5_0014%2B81', 'Quasar', 'millions of K', 4e10, 'One of the most luminous quasars known, powered by a black hole of tens of billions of Suns.'),
      E('SDSS J0100+2802', 'SDSS_J0100%2B2802', 'Distant quasar', 'millions of K', 1.2e10, 'Seen as it was less than a billion years after the Big Bang, with a black hole of about 12 billion Suns.'),
      E('ULAS J1342+0928', 'ULAS_J1342%2B0928', 'Distant quasar', 'millions of K', 8e8, 'Seen as it was about 690 million years after the Big Bang, the most distant quasar known when found in 2017.')]
  };
  Object.keys(MORE2).forEach(k => POOL[k].push(...MORE2[k]));
  // mass in solar masses (quasars: the central black hole). The system map is ordered by it: the heaviest object you own sits at the centre.
  const MASS = { 'Gliese 229 B': .068, 'Luhman 16': .06, 'WISE 0855−0714': .005, 'Epsilon Indi B': .108, 'Teide 1': .054, 'Gliese 570 D': .048,
    'Proxima Centauri': .122, 'Barnard’s Star': .144, 'TRAPPIST-1': .09, 'Wolf 359': .11, 'Ross 128': .17, 'Lalande 21185': .39, 'Teegarden’s Star': .09, 'AU Microscopii': .5,
    'Betelgeuse': 18, 'Arcturus': 1.1, 'Aldebaran': 1.16, 'Antares': 12, 'Pollux': 1.9, 'Mira': 1.2, 'Gacrux': 1.5, 'VY Canis Majoris': 17,
    'The Sun': 1, 'Alpha Centauri A': 1.1, 'Tau Ceti': .78, '51 Pegasi': 1.11, 'Beta Hydri': 1.1, '18 Scorpii': 1.02, 'HD 209458': 1.15, 'Kepler-452': 1.04,
    'Sirius A': 2.06, 'Vega': 2.14, 'Regulus': 3.8, 'Fomalhaut': 1.92, 'Altair': 1.86, 'Castor': 2.8, 'Denebola': 1.78, 'Achernar': 6.7,
    'Spica': 11.4, 'Bellatrix': 8.6, 'Mimosa': 16, 'Rigel': 21, 'Alnilam': 40, 'Alnitak': 33, 'Mintaka': 24, 'Adhara': 12.6,
    'Sirius B': 1.02, 'Procyon B': .6, '40 Eridani B': .5, 'van Maanen’s Star': .68, 'Gliese 440': .5, 'Stein 2051 B': .67, 'G 29-38': .6,
    'Crab Pulsar': 1.4, 'Vela Pulsar': 1.4, 'Geminga': 1.4, 'PSR B1919+21': 1.4, 'PSR B1913+16': 1.44, 'PSR J0737−3039': 1.34, 'SGR 1806−20': 1.4, 'PSR J0348+0432': 2.01,
    '3C 273': 9e8, 'TON 618': 6.6e10, '3C 48': 1e9, 'APM 08279+5255': 1e10, 'Markarian 231': 1.5e8, 'Twin Quasar': 2.5e9, '3C 279': 5e8, 'J0313−1806': 1.6e9 };
  // individual looks: a size that follows mass within the type, plus a subtle body tint (colour, strength). Every object stays recognisably its type.
  const TINT = { 'APM 08279+5255': ['#4f94ff', .42], 'TON 618': ['#ffe2b0', .3], '3C 273': ['#bfe0ff', .3], 'J0313−1806': ['#ff6a50', .3], 'Markarian 231': ['#ffcf80', .3],
    'Betelgeuse': ['#ff2e18', .3], 'Antares': ['#ff1c10', .34], 'VY Canis Majoris': ['#c81408', .36], 'Mira': ['#ff9460', .3], 'Arcturus': ['#ffa040', .3], 'Aldebaran': ['#ff8a40', .3], 'Pollux': ['#ffb060', .26],
    'Rigel': ['#8cb8ff', .26], 'Spica': ['#7c8cff', .26], 'Alnilam': ['#a6d0ff', .24], 'Vega': ['#a8c0ff', .2], 'Sirius A': ['#ffffff', .2], 'Achernar': ['#8ec0ff', .26],
    'Proxima Centauri': ['#ff4020', .26], 'TRAPPIST-1': ['#b01808', .34], 'WISE 0855−0714': ['#6a2a9a', .4], 'Gliese 229 B': ['#c05a90', .3], 'Crab Pulsar': ['#78ffd0', .26], 'SGR 1806−20': ['#c890ff', .28],
    'The Sun': ['#ffe060', .16], 'Tau Ceti': ['#ffd890', .22], 'Kepler-452': ['#ffd070', .22], 'Sirius B': ['#d8ecff', .22] };
  // real multiples are drawn as pairs around a shared centre; companions orbit their real partner whenever you own both
  const TWIN = { 'Luhman 16': 'binary', 'Epsilon Indi B': 'binary', 'Gliese 229 B': 'binary', 'Gliese 569 B': 'binary', 'HD 130948 BC': 'binary', 'PSR J0737−3039': 'binary', 'PSR B1913+16': 'binary', 'Castor': 'binary', '61 Cygni': 'binary', 'Capella': 'binary', 'Algol': 'binary', 'Acrux': 'binary', 'Hadar': 'binary', 'OJ 287': 'binary', 'Twin Quasar': 'lens' };
  const COMP = { 'Sirius B': 'Sirius A', 'Procyon B': 'Procyon A', '40 Eridani B': '40 Eridani A', 'Stein 2051 B': 'Stein 2051 A', 'Proxima Centauri': 'Alpha Centauri A', 'Alpha Centauri B': 'Alpha Centauri A', 'Gliese 229 B': 'Gliese 229 A', 'Gliese 569 B': 'Gliese 569 A', 'SCR 1845−6357 B': 'SCR 1845−6357 A', 'HD 130948 BC': 'HD 130948 A', 'Epsilon Indi B': 'Epsilon Indi A' };
  const RANGE = { quasar: [.78, 1.45] }, DEFR = [.86, 1.22];
  OBJ.forEach((o, oi) => { const L = POOL[o.id], lm = L.map(q => Math.log10(q.m || MASS[q.n] || 1)), lo = Math.min(...lm), hi = Math.max(...lm), [a, b] = RANGE[o.id] || DEFR;
    L.forEach((q, i) => { q.m = q.m || MASS[q.n] || 1; if (TWIN[q.n]) q.twin = TWIN[q.n]; if (COMP[q.n]) q.comp = COMP[q.n]; q.s = a + (b - a) * (hi > lo ? (lm[i] - lo) / (hi - lo) : .5);
      const tt = TINT[q.n]; if (tt) { q.tint = tt[0]; q.ta = tt[1]; } else { const nb = OBJ[clamp(oi + (hash(i * 3.3 + oi) > .5 ? 1 : -1), 0, OBJ.length - 1)]; q.tint = nb.c; q.ta = .08 + .12 * hash(i * 1.7 + oi * 5); } }); });
  function massText(m) { return m >= 1e9 ? (m / 1e9).toFixed(m >= 1e10 ? 0 : 1).replace(/\.0$/, '') + ' billion Suns' : m >= 1e6 ? Math.round(m / 1e6) + ' million Suns' : m >= 10 ? Math.round(m) + ' Suns' : m >= .1 ? '≈ ' + m.toFixed(2).replace(/0$/, '') + ' Suns' : '≈ ' + Math.round(m * 1047.6) + ' Jupiters'; }
  const hs = str => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973; return h; };

  function landFx(g, id, idx, t, cx, cy, R, w, h) {
    const o = OBJ.find(q => q.id === id) || OBJ[3], pow = (idx + 1) / 9;
    if (t < .42) { const u = clamp(t / .38), e = u * u * u; for (let i = 0; i < 40; i++) { const a = hash(i + 11) * TAU, d0 = h * (.45 + hash(i + 23) * .25), d = d0 * (1 - e), d2 = d0 * (1 - Math.pow(clamp(u - .12), 3)); g.strokeStyle = rgba(o.c, .15 + .6 * u); g.lineWidth = 1 + 1.5 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.stroke(); } halo(g, cx, cy, R * (.3 + 1.4 * u), o.c, .25 + .7 * u); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3 + 9 * u, 0, TAU); g.fill(); }
    const rings = idx >= 7 ? 3 : idx >= 4 ? 2 : 1; for (let i = 0; i < rings; i++) { const u = clamp((t - .38 - i * .1) / .8); if (u > 0 && u < 1) ring(g, cx, cy, R * (.4 + 4.4 * easeOut(u)), i % 2 ? '#ffffff' : o.c, .8 * (1 - u), R * .14 * (1 - u) + 1); }
    const fl = clamp(1 - (t - .38) / .4); if (t >= .38 && fl > 0) { const fg = g.createRadialGradient(cx, cy, 0, cx, cy, h * (.5 + .5 * pow)); fg.addColorStop(0, `rgba(255,255,255,${fl * (.2 + .32 * pow)})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; { const rd = h * (.5 + .5 * pow); g.fillRect(cx - rd, cy - rd, rd * 2, rd * 2); } }
  }
  function drawLabel(g, l) { g.save(); g.font = `400 ${l.size}px "EB Garamond", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; try { g.letterSpacing = (l.size * .04) + 'px'; } catch (e) {} g.shadowColor = 'rgba(6,5,14,.95)'; g.shadowBlur = l.size * .35; g.fillStyle = l.color; g.fillText(l.text, l.x, l.y); g.shadowBlur = 0; g.fillText(l.text, l.x, l.y); g.restore(); }
  // a system: Kepler orbits (T^2 ~ a^3, ellipses with the primary at a focus, faster at periapsis), a barycentre wobble, moons for duplicates.
  // The map is far larger than the view: pan with opt.cam = {x, y, z}; positions are world units with the primary at the origin.
  function kepler(M, e) { let E = M; for (let i = 0; i < 5; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  const SPREAD = 2.2, BASE = .95;   // how far apart the orbits sit: bigger is grander (periods follow Kepler's law, so far orbits turn slowly)
  function orbits(w, list, spread = SPREAD, base = BASE) {   // list sorted hottest first: [{n, id, idx, count}]; every body after the first orbits the primary
    return list.slice(1).map((b, i) => { const k = hs(b.n), a = (w * (base + 1.1 * Math.log(1 + .9 * i)) + (hash(k) - .5) * w * .06) * spread, T = 9 * Math.pow(a / (w * .44), 1.5); return { ...b, a, T, e: .05 + .3 * hash(k + 3.1), om: hash(k + 7.7) * TAU, M0: hash(k + 1.3) * TAU }; });
  }
  function system(g, w, h, t, list, opt = {}) {
    g.clearRect(0, 0, w, h); const cam = opt.cam || { x: 0, y: 0, z: 1 }, Z = cam.z, SY = .56, U = Math.min(w, h); if (!list.length) { starfield(g, w, h, t * .3, 60, 9); return []; }
    const ox = ((cam.x * .12) % w + w) % w, oy = ((cam.y * .12) % h + h) % h; g.save(); g.translate(-ox, -oy); for (const [dx, dy] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.save(); g.translate(dx, dy); starfield(g, w, h, t * .3, Math.round(w * h / 9000), 9); g.restore(); } g.restore();
    const prim = list[0], orb = orbits(760, list, opt.spread, opt.base), pos = [], toS = (wx, wy) => [(wx - cam.x) * Z + w / 2, (wy - cam.y) * Z + h / 2];
    const bornOf = n => opt.ages && opt.ages[n] != null ? clamp(opt.ages[n] / 1.4) : opt.newId === n ? clamp((opt.tNew == null ? 9 : opt.tNew) / 1.4) : 1, TS = opt.ts || 1.5, PH = opt.tau != null ? opt.tau : t * TS, at = (b, off = 0) => { const E = kepler(b.M0 + (PH - off * TS) * TAU / b.T, b.e), x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om); return [x * c - y * s, x * s + y * c]; };
    let bx = 0, by = 0, mt = 1; orb.forEach(b => { const q = at(b), bornW = bornOf(b.n), mass = .012 * (b.idx + 1) * sm3(bornW); bx += q[0] * mass; by += q[1] * mass; mt += mass; }); bx = -bx / mt * (opt.wobble == null ? .35 : opt.wobble); by = -by / mt * (opt.wobble == null ? .35 : opt.wobble);
    const items = [], vis = (x, y, m) => x > -m && x < w + m && y > -m && y < h + m;
    orb.forEach(b => { const foc = opt.focus === b.n; g.strokeStyle = foc ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.1)'; g.lineWidth = foc ? 2 : 1; g.beginPath(); for (let i = 0; i <= 120; i++) { const E = i / 120 * TAU, x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om), p = toS(bx + x * c - y * s, by + (x * s + y * c) * SY); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
      const q = at(b), wx = bx + q[0], wy = by + q[1] * SY, p = toS(wx, wy);
      if (foc) { g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); const c0 = toS(bx, by); g.moveTo(c0[0], c0[1]); for (let i = 0; i <= 14; i++) { const qq = at(b, 1.4 - i * .1), pp = toS(bx + qq[0], by + qq[1] * SY); g.lineTo(pp[0], pp[1]); } g.fill(); }
      items.push({ b, x: p[0], y: p[1], z: q[1], wx, wy }); });
    const pp = toS(bx, by); items.push({ b: prim, x: pp[0], y: pp[1], z: 0, wx: bx, wy: by, prim: true }); items.sort((a, b) => a.z - b.z);
    items.forEach(it => { const b = it.b, zs = opt.sizeExp ? Math.pow(Z, opt.sizeExp) * Math.pow(.7, 1 - opt.sizeExp) : Z, base = (FR[b.id] || .2) * (b.s || 1) * U * (it.prim ? .62 : .4) * zs; if (!vis(it.x, it.y, base * 6 + 80)) { pos.push({ n: b.n, id: b.id, x: it.x, y: it.y, wx: it.wx, wy: it.wy, r: 0 }); return; }
      let r = base; if (it.prim && opt.primScale != null) r *= Math.max(.001, opt.primScale); const born = bornOf(b.n); r *= Math.max(.01, easeBack(born));
      if (!it.prim) for (let i = 1; i < 12; i++) { const q = at(b, i * .07), p = toS(bx + q[0], by + q[1] * SY); g.fillStyle = rgba(OBJ[b.idx].c, .22 * (1 - i / 12)); g.beginPath(); g.arc(p[0], p[1], Math.max(1.5, r * .08 * (1 - i / 12)), 0, TAU); g.fill(); }
      if (born < 1) ring(g, it.x, it.y, base * (.6 + 3 * born), OBJ[b.idx].c, .7 * (1 - born), 3);
      const sc = it.prim ? 1 : .6 + .2 * clamp(it.z / 1500 * .5 + .5, 0, 1); if (r * sc < 15) { halo(g, it.x, it.y, Math.max(8, r * sc * 3.2), OBJ[b.idx].c, .85); g.fillStyle = '#fff'; g.beginPath(); g.arc(it.x, it.y, Math.max(1.6, r * sc * .32), 0, TAU); g.fill(); } else { g.save(); g.translate(it.x, it.y); paint(g, b.id, 0, 0, Math.max(.5, r * sc), t + b.idx); if (b.tint && r * sc > 12) tintBody(g, b, Math.max(.5, r * sc)); g.restore(); }
      for (let k = 0; k < Math.min(5, b.count - 1); k++) { const rs = r * sc * (1.9 + .4 * k) + 8, th = t * (2.3 - .25 * k) + hash(hs(b.n) + k) * TAU; g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.ellipse(it.x, it.y, rs, rs * SY, 0, 0, TAU); g.stroke(); g.fillStyle = rgba(OBJ[b.idx].c, .95); g.beginPath(); g.arc(it.x + Math.cos(th) * rs, it.y + Math.sin(th) * rs * SY, 2.6 + (it.prim ? 1 : 0), 0, TAU); g.fill(); }
      let lbl = null; if (Z > .45 || list.length <= 8 || opt.focus === b.n) { lbl = { text: b.n, x: it.x, y: it.y + r * sc * 1.25 + 40, size: clamp(24 * Math.sqrt(Z), 20, 36), color: opt.focus === b.n ? '#ffffff' : rgba(OBJ[b.idx].c, .92), focus: opt.focus === b.n }; if (!opt.noLabels) drawLabel(g, lbl); }
      pos.push({ n: b.n, id: b.id, x: it.x, y: it.y, wx: it.wx, wy: it.wy, r: Math.max(r * sc, 18), lbl }); });
    // minimap: the whole system with the current view as a box
    const big = Math.max(380, ...orb.map(b => b.a * (1 + b.e))), R = 58, mx = 18 + R, my = opt.mini === 'tl' ? 52 + R : h - 18 - R, k = R / big; g.save(); g.fillStyle = 'rgba(10,8,22,.78)'; g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, R + 2, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(mx, my, R, 0, TAU); g.clip();
    orb.forEach(b => { g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(mx + bx * k, my + by * k * 1, b.a * k, b.a * k * SY, b.om, 0, TAU); g.stroke(); }); pos.forEach(p => { g.fillStyle = p.n === opt.focus ? '#fff' : rgba(OBJ[(list.find(l => l.n === p.n) || prim).idx].c, .95); g.beginPath(); g.arc(mx + p.wx * k, my + p.wy * k, p.n === opt.focus ? 3.4 : 2.2, 0, TAU); g.fill(); });
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(mx + (cam.x - w / 2 / Z) * k, my + (cam.y - h / 2 / Z) * k, w / Z * k, h / Z * k); g.restore();
    return pos;
  }

  // ---- the universe: a gravitational hierarchy. Each quasar you own is a galaxy nucleus; neutron stars and very heavy stars anchor sub-clusters; the rest orbit an anchor or the nucleus.
  // Galaxies orbit the heaviest nucleus on enormous, near-imperceptibly slow ellipses; clusters orbit their nucleus; stars orbit their anchor (T^2 ~ a^3 at every tier). Deterministic from the names.
  const hs2 = n => { let h = 2166136261; for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
  function layout(list) {
    const items = list.slice().sort((x, y) => (y.m || 1) - (x.m || 1) || y.idx - x.idx || (x.n < y.n ? -1 : 1)), quas = items.filter(b => b.id === 'quasar'), nuclei = quas.length ? quas : items.slice(0, 1);
    const rest = items.filter(b => !nuclei.includes(b)), owned = new Set(items.map(x => x.n)), comps = rest.filter(b => b.comp && owned.has(b.comp)), loose = rest.filter(b => !comps.includes(b)), anchors = loose.filter(b => b.id === 'neutron' || (b.m || 0) >= 8), members = loose.filter(b => !anchors.includes(b));
    const W = nuclei.map(b => Math.max(.5, Math.log10(b.m || 1) - 7 + .5)), SW = W.reduce((a, b) => a + b, 0), galOf = b => { let u = hs2(b.n + 'g') * SW, i = 0; while (i < W.length - 1 && u > W[i]) { u -= W[i]; i++; } return i; };
    const bodies = [], idxOf = {}, add = (b, o) => { const e = { ...b, ...o }; idxOf[b.n] = bodies.length; bodies.push(e); return e; };
    const T = a => 30 * Math.pow(a / 300, 1.5), orb = (b, a, k) => ({ a, T: T(a), e: .05 + .3 * hs2(b.n + 'e'), om: hs2(b.n + 'o') * TAU, M0: hs2(b.n + 'm') * TAU, k });
    nuclei.forEach((b, i) => { const a = 110000 * (1 + 1.0 * (i - 1)) * (1 + .15 * hs2(b.n + 'a')); add(b, i === 0 ? { tier: 'nucleus', parent: -1, gal: i, a: 0, T: 1, e: 0, om: 0, M0: 0 } : { tier: 'nucleus', parent: 0, gal: i, ...orb(b, a) }); });
    const kA = nuclei.map(() => 0); anchors.forEach(b => { const g = galOf(b), a = (7500 + 3800 * kA[g]++) * (1 + .12 * hs2(b.n + 'a')); add(b, { tier: 'anchor', parent: nuclei.findIndex((n, i) => i === g) >= 0 ? idxOf[nuclei[g].n] : 0, gal: g, ...orb(b, a) }); });
    const kM = {}; members.forEach(b => { const g = galOf(b), mine = anchors.filter(x => galOf(x) === g), toAnchor = mine.length && hs2(b.n + 'p') > .3, par = toAnchor ? idxOf[mine[Math.floor(hs2(b.n + 'q') * mine.length)].n] : idxOf[nuclei[g].n], j = kM[par] = (kM[par] || 0) + 1 - 1, base = toAnchor ? 1000 + 650 * j : 3200 + 1500 * j;
      kM[par] = j + 1; add(b, { tier: 'member', parent: par, gal: g, ...orb(b, base * (1 + .1 * hs2(b.n + 'a'))) }); });
    const kC = {}; comps.forEach(b => { const par = idxOf[b.comp], j = kC[par] = (kC[par] || 0) + 1; add(b, { tier: 'member', parent: par, gal: bodies[par].gal, ...orb(b, (320 + 170 * (j - 1)) * (1 + .1 * hs2(b.n + 'a'))) }); });   // companions orbit their real partner
    // extents: how far each body's own system reaches (for framing and for the galaxy glow)
    const ext = bodies.map(() => 0); for (let i = bodies.length - 1; i >= 0; i--) { const b = bodies[i]; b.reach = Math.max(ext[i], b.tier === 'member' ? 0 : 0); if (b.parent >= 0 && b.tier !== 'nucleus') ext[b.parent] = Math.max(ext[b.parent], b.a * (1 + b.e) + b.reach); }
    bodies.forEach((b, i) => { b.reach = ext[i]; });
    const R = Math.max(380, ...bodies.map((b, i) => { let r = 0, j = i; while (j >= 0) { r += bodies[j].a * (1 + bodies[j].e); j = bodies[j].parent; } return r + b.reach * 0; }));
    return { bodies, idxOf, R };
  }
  function lineage(lay, n) { const out = []; let i = lay.idxOf[n]; while (i != null && i >= 0) { const b = lay.bodies[i]; out.unshift(b); if (b.tier === 'nucleus') break; i = b.parent; } return out; }
  function kepAt(b, PH) { const E = kepler(b.M0 + PH * TAU / b.T, b.e), x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om); return [x * c - y * s, x * s + y * c]; }
  // pre-rendered sprites keep the heavy art out of the frame loop: a galaxy (arms, dust lanes, HII regions, bulge), a dense star cluster, tiled star layers and label bitmaps
  const SPR = new Map(), TILES = new Map(), LBL = new Map(), mk = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const GPAL = [['#fff0cf', '#a6c8ff', '#ff90b8'], ['#ffe2b4', '#86ecff', '#ff80dc'], ['#ffdcae', '#b8a0ff', '#ffb878']];
  const gparams = b => ({ arms: 2 + Math.floor(hs2(b.n + 'a') * 3), wind: 2.4 + hs2(b.n + 'w') * 2.6, pal: GPAL[Math.floor(hs2(b.n + 'p') * 3)] });
  // the same galaxy as live geometry, for close-ups: ~36,000 stars, diffuse arm blobs and dust lanes in unit coordinates, drawn crisp at any zoom (the sprite only serves the distant view)
  const DET = new Map();
  function galaxyField(b) {
    let f = DET.get(b.n); if (f) return f;
    let sd = Math.floor(hs2(b.n + 'seed') * 4294967296) >>> 0; const rnd = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const { arms, wind, pal } = gparams(b), NB = 12, bucket = [], styles = []; for (let c = 0; c < 3; c++) for (let a = 0; a < 4; a++) { bucket.push({ x: [], y: [], z: [] }); styles.push(rgba(pal[c], (c === 2 ? .5 : .12) + a * (c === 2 ? .12 : .09))); }
    for (let k = 0; k < 36000; k++) { const arm = k % arms, u = Math.pow(rnd(), .8), r = .05 + .95 * u, sc = (rnd() + rnd() - 1) * (.34 - .12 * u), th = arm * TAU / arms + wind * u * 1.7 + sc, hii = rnd() > .965, c = u < .22 ? 0 : hii ? 2 : 1, a = Math.min(3, Math.floor(rnd() * 4 * (1 - .4 * u))), bk = bucket[c * 4 + a]; bk.x.push(r * Math.cos(th)); bk.y.push(r * Math.sin(th)); bk.z.push(hii ? 1.5 + 1.8 * rnd() : .5 + 1.1 * rnd()); }
    const blobs = []; for (let k = 0; k < 700; k++) { const arm = k % arms, u = Math.pow(rnd(), .85), r = .08 + .9 * u, sc = (rnd() + rnd() - 1) * (.5 - .2 * u), th = arm * TAU / arms + wind * u * 1.7 + sc; blobs.push([r * Math.cos(th), r * Math.sin(th), (.04 + .11 * rnd()) , u < .25 ? pal[0] : pal[1]]); }
    const lanes = []; for (let arm = 0; arm < arms; arm++) { const pts = []; for (let i = 0; i <= 60; i++) { const u = .14 + .76 * i / 60, r = u, th = arm * TAU / arms + wind * u * 1.7 + .3; pts.push([r * Math.cos(th), r * Math.sin(th)]); } lanes.push(pts); }
    f = { bucket, styles, blobs, lanes, pal }; DET.set(b.n, f); return f;
  }
  function galaxyDetail(g, b, cx, cy, R, rot, SY, w, h, K, hex, da, haze) {
    const f = galaxyField(b), cr = Math.cos(rot), sr = Math.sin(rot), kk = .42 * K * Math.pow(Math.max(1, R / (300 * K)), .15), fall = Math.min(1, Math.pow(650 * K / R, 1.3)), /* big blobs overlap more as you zoom in, so they thin out */ X = (x, y) => cx + (x * cr - y * sr) * R, Y = (x, y) => cy + (x * sr + y * cr) * R * SY;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = da;
    let n = 0; for (const [bx, by, br, col] of f.blobs) { const px = X(bx, by), py = Y(bx, by), rad = br * R; if (px < -rad || px > w + rad || py < -rad * SY || py > h + rad * SY) continue; glowAt(g, px, py, rad, col, .07 * haze * fall); if (++n > 260) break; }
    f.bucket.forEach((bk, i) => { g.fillStyle = f.styles[i]; g.beginPath(); let m = 0, lim = 170; for (let j = 0; j < bk.x.length; j++) { const px = cx + (bk.x[j] * cr - bk.y[j] * sr) * R, py = cy + (bk.x[j] * sr + bk.y[j] * cr) * R * SY; if (px < -4 || px > w + 4 || py < -4 || py > h + 4) continue; const sz = bk.z[j] * kk; if (i >= 8) { g.moveTo(px + sz, py); g.arc(px, py, sz, 0, TAU); } else g.rect(px - sz, py - sz, sz * 2, sz * 2); if (++m > lim) break; } g.fill(); });
    g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
    f.lanes.forEach(pts => { for (const [lw, al] of [[.075, .16], [.033, .22]]) { g.strokeStyle = `rgba(8,6,18,${al * haze * Math.max(.4, fall)})`; g.lineWidth = Math.max(1, Math.min(lw * R * SY * 1.4, 90 * K)); g.beginPath(); let down = false, px0 = 0, py0 = 0; pts.forEach(([x, y], i) => { const px = X(x, y), py = Y(x, y); if (i) { const seen = !((px < -200 && px0 < -200) || (px > w + 200 && px0 > w + 200) || (py < -200 && py0 < -200) || (py > h + 200 && py0 > h + 200)); if (seen) { if (!down) g.moveTo(px0, py0); g.lineTo(px, py); down = true; } else down = false; } px0 = px; py0 = py; }); g.stroke(); } });
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1; const cr2 = R * .34; if (cx > -cr2 && cx < w + cr2 && cy > -cr2 && cy < h + cr2) { g.save(); g.translate(cx, cy); g.scale(1, SY); let gr = g.createRadialGradient(0, 0, 0, 0, 0, cr2); gr.addColorStop(0, rgba(f.pal[0], .9 * da * haze * fall)); gr.addColorStop(.35, rgba(hex, .36 * da * haze * fall)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, cr2, 0, TAU); g.fill(); g.restore(); }
    g.restore();
  }
  function galaxySprite(b, hex) {
    let c = SPR.get(b.n); if (c) return c; c = mk(512); const g = c.getContext('2d'), S = 512, m = S / 2, R = S * .47, { arms, wind, pal } = gparams(b);
    g.translate(m, m); g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.05); gr.addColorStop(0, rgba(hex, .3)); gr.addColorStop(.4, rgba(pal[1], .07)); gr.addColorStop(1, rgba(pal[1], 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 1.05, 0, TAU); g.fill();
    for (let k = 0; k < 900; k++) { const arm = k % arms, u = Math.pow(hs2(b.n + k + 'U'), .85), r = R * (.08 + .9 * u), sc = (hs2(b.n + k + 'X') + hs2(b.n + k + 'Y') - 1) * (.5 - .2 * u), th = arm * TAU / arms + wind * u * 1.7 + sc, col = u < .25 ? pal[0] : pal[1], rad = 10 + 26 * hs2(b.n + k + 'R');   // soft diffuse body of the arms
      const x = Math.cos(th) * r, y = Math.sin(th) * r, bl = g.createRadialGradient(x, y, 0, x, y, rad); bl.addColorStop(0, rgba(col, .07 * (1 - .5 * u))); bl.addColorStop(1, rgba(col, 0)); g.fillStyle = bl; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    for (let k = 0; k < 9000; k++) { const arm = k % arms, u = Math.pow(hs2(b.n + k + 'u'), .8), r = R * (.05 + .95 * u), sc = (hs2(b.n + k + 'x') + hs2(b.n + k + 'y') - 1) * (.34 - .12 * u), th = arm * TAU / arms + wind * u * 1.7 + sc, hii = hs2(b.n + k + 'h') > .965, col = u < .22 ? pal[0] : hii ? pal[2] : pal[1];
      g.fillStyle = rgba(col, (hii ? .55 : .1 + .34 * hs2(b.n + k + 'v')) * (1 - .45 * u)); g.beginPath(); g.arc(Math.cos(th) * r, Math.sin(th) * r, hii ? 1.5 + 1.8 * hs2(b.n + k + 's') : .5 + 1.1 * hs2(b.n + k + 's'), 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
    for (let arm = 0; arm < arms; arm++) for (const [lw, al] of [[18, .16], [8, .22]]) { g.strokeStyle = `rgba(8,6,18,${al})`; g.lineWidth = lw; g.beginPath(); for (let i = 0; i <= 44; i++) { const u = .14 + .76 * i / 44, r = R * u, th = arm * TAU / arms + wind * u * 1.7 + .3; i ? g.lineTo(Math.cos(th) * r, Math.sin(th) * r) : g.moveTo(Math.cos(th) * r, Math.sin(th) * r); } g.stroke(); }
    g.globalCompositeOperation = 'lighter'; gr = g.createRadialGradient(0, 0, 0, 0, 0, R * .34); gr.addColorStop(0, rgba(pal[0], .95)); gr.addColorStop(.35, rgba(hex, .38)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * .34, 0, TAU); g.fill();
    gr = g.createRadialGradient(0, 0, 0, 0, 0, R * .09); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * .09, 0, TAU); g.fill();
    SPR.set(b.n, c); return c;
  }
  function clusterSprite(b, hex) {
    let c = SPR.get('c:' + b.n); if (c) return c; c = mk(256); const g = c.getContext('2d'), m = 128, R = 120; g.translate(m, m); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, rgba(hex, .3)); gr.addColorStop(.3, rgba(hex, .1)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    for (let k = 0; k < 520; k++) { const r = R * .95 * Math.pow(hs2(b.n + k + 'r'), 1.9), a = hs2(b.n + k + 'a') * TAU; g.fillStyle = rgba(hs2(b.n + k + 'c') > .55 ? '#ffffff' : hex, .15 + .5 * hs2(b.n + k + 'v')); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, .6 + 1.1 * hs2(b.n + k + 's'), 0, TAU); g.fill(); }
    SPR.set('c:' + b.n, c); return c;
  }
  const GLOWS = new Map();
  function glowAt(g, x, y, r, hex, a) {   // a cached soft glow stamped at any size: far cheaper than building a radial gradient per body per frame
    let c = GLOWS.get(hex); if (!c) { c = mk(96); const k = c.getContext('2d'), gr = k.createRadialGradient(48, 48, 0, 48, 48, 48); gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(.3, rgba(hex, .45)); gr.addColorStop(.65, rgba(hex, .12)); gr.addColorStop(1, rgba(hex, 0)); k.fillStyle = gr; k.fillRect(0, 0, 96, 96); GLOWS.set(hex, c); }
    g.globalAlpha = a; g.drawImage(c, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
  }
  function starTile(sd, per) { const T = 640, key = sd + '|' + per; let c = TILES.get(key); if (!c) { c = mk(T); starfield(c.getContext('2d'), T, T, 0, Math.round(T * T / per), sd); TILES.set(key, c); } return c; }
  function labelImg(l) {
    const sz = Math.round(l.size / 2) * 2, key = l.text + '|' + sz + '|' + l.color; let e = LBL.get(key);
    if (!e) { if (LBL.size > 260) LBL.clear(); const probe = mk(8).getContext('2d'); probe.font = `400 ${sz}px "EB Garamond", Georgia, serif`; const wd = Math.ceil(probe.measureText(l.text).width + sz * 1.4), c = document.createElement('canvas'); c.width = wd; c.height = Math.ceil(sz * 2); drawLabel(c.getContext('2d'), { ...l, size: sz, x: wd / 2, y: sz * 1.3 }); e = { c, ox: wd / 2, oy: sz * 1.3 }; LBL.set(key, e); }
    return e;
  }
  const BSPR = new Map();
  function bodySprite(b) {   // small bodies are stamped from a cached frame instead of being repainted every frame
    let c = BSPR.get(b.n); if (c) { BSPR.delete(b.n); BSPR.set(b.n, c); return c; }
    if (BSPR.size >= 48) BSPR.delete(BSPR.keys().next().value);
    c = mk(256); const k = c.getContext('2d'); paintBody(k, b.id, 128, 128, 16, 2 + b.idx, b); BSPR.set(b.n, c); return c;
  }
  function universe(g, w, h, t, lay, opt = {}) {
    g.clearRect(0, 0, w, h); if (opt.ov) { opt.ov.g.setTransform(1, 0, 0, 1, 0, 0); opt.ov.g.clearRect(0, 0, opt.ov.g.canvas.width, opt.ov.g.canvas.height); } const cam = opt.cam || { x: 0, y: 0, z: .1 }, Z = cam.z, SY = .56, U = Math.min(w, h), K = Math.max(1, w / 760), B = lay.bodies;
    if (!opt.noStars) for (const [par, per, sd] of [[.05, 9000, 9]]) { const tile = starTile(sd, per), T = tile.width, ox = Math.round(((cam.x * par) % T + T) % T), oy = Math.round(((cam.y * par) % T + T) % T); for (let x = -ox; x < w; x += T) for (let y = -oy; y < h; y += T) g.drawImage(tile, x, y); }
    if (!B.length) return [];
    const PH = (opt.tau != null ? opt.tau : t) * 1.5, toS = (wx, wy) => [(wx - cam.x) * Z + w / 2, (wy - cam.y) * Z + h / 2], W = [], vis = (x, y, m) => x > -m && x < w + m && y > -m && y < h + m, newT = opt.newId, born = n => newT === n ? clamp((opt.tNew == null ? 9 : opt.tNew) / 1.4) : 1;
    B.forEach((b, i) => { if (b.parent < 0) { W[i] = [0, 0, 0]; return; } const q = kepAt(b, PH), p = W[b.parent]; W[i] = [p[0] + q[0], p[1] + q[1] * SY, q[1]]; });
    const col = b => OBJ[b.idx].c;
    // galaxy glow and spiral dust, then sub-cluster halos
    B.forEach((b, i) => { if (b.tier === 'member' || !b.reach) return; const gal = b.tier === 'nucleus', R = Math.max(gal ? b.reach * 1.15 * Z : (b.reach * 1.5 + 200) * Z, gal ? 38 * K : 0), p = toS(W[i][0], W[i][1]); if (R < 9 * K || !vis(p[0], p[1], R * 1.2)) return;
      if (!gal && R > w * 3) return;
      g.save(); g.translate(p[0], p[1]);
      if (gal) { const rot = PH * .0007 * (hs2(b.n + 'd') > .5 ? 1 : -1), big = R / K, fadeS = clamp(1 - (big - 380) / 380), da = clamp((big - 300) / 380), haze = .1 + .9 * clamp(1 - (big - 1400) / 2600); if (fadeS > 0) { g.save(); g.scale(1, SY); g.globalAlpha = fadeS; const D = R * 2.13; g.drawImage(galaxySprite(b, col(b)), -D / 2, -D / 2, D, D); g.restore(); } if (da > 0) { g.restore(); g.save(); g.globalCompositeOperation = 'lighter'; galaxyDetail(g, b, p[0], p[1], R, rot, SY, w, h, K, col(b), da, haze); g.restore(); g.save(); g.translate(p[0], p[1]); } } else { const D = R * 2.1; g.drawImage(clusterSprite(b, col(b)), -D / 2, -D / 2, D, D); }
      g.restore(); });
    // orbits: a faint ellipse around the parent, drawn only when big enough to read, at most a budget of them (nearest the view first), stroked in three batches
    {
      const cand = []; B.forEach((b, i) => { if (b.parent < 0) return; const ap = b.a * (1 + b.e) * Z; if (ap < 10 * K || ap > w * 5) return; const c0 = toS(W[b.parent][0], W[b.parent][1]), dist = Math.hypot(Math.max(0, -c0[0], c0[0] - w), Math.max(0, -c0[1], c0[1] - h)); if (dist > ap * 1.3) return; cand.push({ b, ap, c0, foc: opt.focus === b.n || B[b.parent].n === opt.focus, pr: (opt.focus === b.n || B[b.parent].n === opt.focus ? -1e9 : 0) + Math.hypot(c0[0] - w / 2, c0[1] - h / 2) }); });
      cand.sort((x, y) => x.pr - y.pr); const paths = { f: [], m: [], t: [] };
      cand.slice(0, 10).forEach(c => (c.foc ? paths.f : c.b.tier === 'member' ? paths.m : paths.t).push(c));
      for (const [key, st, lw] of [['m', 'rgba(255,255,255,.1)', 1], ['t', 'rgba(190,200,255,.14)', 1], ['f', 'rgba(255,255,255,.3)', 2]]) { if (!paths[key].length) continue; g.strokeStyle = st; g.lineWidth = lw * K; g.beginPath();
        paths[key].forEach(({ b, ap }) => { const cs = Math.cos(b.om), sn = Math.sin(b.om), pw = W[b.parent], nseg = ap < 90 * K ? 36 : Math.min(160, Math.round(48 + ap / (6 * K))), bb = b.a * Math.sqrt(1 - b.e * b.e), mg = 40 * K; let px0 = 0, py0 = 0, down = false;
          for (let k = 0; k <= nseg; k++) { const E = k / nseg * TAU, x = b.a * (Math.cos(E) - b.e), y = bb * Math.sin(E), px = (pw[0] + x * cs - y * sn - cam.x) * Z + w / 2, py = (pw[1] + (x * sn + y * cs) * SY - cam.y) * Z + h / 2;
            if (k) { const seen = !((px < -mg && px0 < -mg) || (px > w + mg && px0 > w + mg) || (py < -mg && py0 < -mg) || (py > h + mg && py0 > h + mg)); if (seen) { if (!down) g.moveTo(px0, py0); g.lineTo(px, py); down = true; } else down = false; } px0 = px; py0 = py; } });
        g.stroke(); }
    }
    const labels = [], items = B.map((b, i) => ({ b, i, p: toS(W[i][0], W[i][1]), z: W[i][1] })).sort((x, y) => x.z - y.z), pos = [], zs = Math.pow(Z, .42) * Math.pow(.7, .58);
    items.forEach(it => { const b = it.b, i = it.i, nuc = b.tier === 'nucleus', base = (FR[b.id] || .2) * (b.s || 1) * U * (nuc ? .46 : b.tier === 'anchor' ? .36 : .28) * zs, bn = born(b.n);
      if (!vis(it.p[0], it.p[1], base * 6 + 80)) { pos.push({ n: b.n, id: b.id, x: it.p[0], y: it.p[1], wx: W[i][0], wy: W[i][1], r: 0, tier: b.tier }); return; }
      const dim = opt.filter && !opt.filter.has(b.id) && opt.focus !== b.n; if (dim) g.globalAlpha = .13;
      const r = Math.max(.01, base * Math.max(.01, easeBack(bn))), rr = Math.max(r, nuc ? 6 * K : 3 * K);
      if (bn < 1) ring(g, it.p[0], it.p[1], base * (.6 + 3 * bn), col(b), .7 * (1 - bn), 3);
      if (rr < 15 * K) { glowAt(g, it.p[0], it.p[1], Math.max(8 * K, rr * 3.2), col(b), .85); g.fillStyle = '#fff'; g.beginPath(); g.arc(it.p[0], it.p[1], Math.max(1.6 * K, rr * .32), 0, TAU); g.fill(); }
      else { if (r < 26 * K) { const sc = r / 16, sp = bodySprite(b); g.drawImage(sp, it.p[0] - 128 * sc, it.p[1] - 128 * sc, 256 * sc, 256 * sc); } else { g.save(); g.translate(it.p[0], it.p[1]); paintBody(g, b.id, 0, 0, r, t + b.idx, b); g.restore(); } }
      for (let k = 0; k < Math.min(4, (b.count || 1) - 1); k++) { const rs = rr * (1.9 + .4 * k) + 8 * K, th = t * (2.3 - .25 * k) + hs2(b.n + k) * TAU; g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = K; g.beginPath(); g.ellipse(it.p[0], it.p[1], rs, rs * SY, 0, 0, TAU); g.stroke(); g.fillStyle = rgba(col(b), .95); g.beginPath(); g.arc(it.p[0] + Math.cos(th) * rs, it.p[1] + Math.sin(th) * rs * SY, Math.max(1.8 * K, rr * .09), 0, TAU); g.fill(); }
      const foc = opt.focus === b.n, orbPx = b.tier === 'member' ? (B[b.parent].a ? b.a * Z : 0) : 0, near = b.tier === 'member' ? b.a * (1 + b.e) * Z > 55 * K : true, showL = !dim && (foc || (nuc ? true : b.tier === 'anchor' ? b.a * Z > 90 * K || b.reach * Z > 30 * K : near && b.a * Z > 60 * K));
      let lbl = null; if (showL && !opt.noLabels) { lbl = { text: b.n, x: it.p[0], y: it.p[1] + rr * 1.25 + 38 * K, size: clamp((nuc ? 30 : 24) * Math.sqrt(Math.min(Z * 6, 4)) * K, 16 * K, 40 * K), color: foc ? '#ffffff' : rgba(col(b), .92), focus: foc }; labels.push({ lbl, pr: foc ? 0 : nuc ? 1 : b.tier === 'anchor' ? 2 : 3, m: b.m }); }
      if (dim) g.globalAlpha = 1;
      pos.push({ n: b.n, id: b.id, x: it.p[0], y: it.p[1], wx: W[i][0], wy: W[i][1], r: Math.max(rr, nuc ? 46 * K : 18 * K), lbl, tier: b.tier }); });
    { const taken = []; labels.sort((x, y) => x.pr - y.pr || y.m - x.m).forEach(({ lbl }) => { const wd = lbl.text.length * lbl.size * .5, bx = { x0: lbl.x - wd / 2, x1: lbl.x + wd / 2, y0: lbl.y - lbl.size, y1: lbl.y + lbl.size * .3 }; if (!lbl.focus && taken.some(q => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0)) return; taken.push(bx); if (opt.ov) { const f = opt.ov.f, im = labelImg({ ...lbl, size: lbl.size * f }); opt.ov.g.drawImage(im.c, lbl.x * f - im.ox, lbl.y * f - im.oy); } else { const im = labelImg(lbl); g.drawImage(im.c, lbl.x - im.ox, lbl.y - im.oy); } }); }
    // minimap: the whole universe with the view as a box
    const Rm = 40 * K, mx = 14 * K + Rm, my = opt.mini === 'tl' ? (opt.miniTop ? opt.miniTop() : 52 * K) + Rm : h - 18 * K - Rm, big = lay.R * 1.1, k = Rm / big; const mgx = opt.ov ? opt.ov.g : g; mgx.save(); if (opt.ov) mgx.setTransform(opt.ov.f, 0, 0, opt.ov.f, 0, 0); mgx.fillStyle = 'rgba(10,8,22,.78)'; mgx.strokeStyle = 'rgba(255,255,255,.2)'; mgx.lineWidth = 1.5 * K; mgx.beginPath(); mgx.arc(mx, my, Rm + 2 * K, 0, TAU); mgx.fill(); mgx.stroke(); mgx.beginPath(); mgx.arc(mx, my, Rm, 0, TAU); mgx.clip();
    B.forEach((b, i) => { const big2 = b.tier === 'nucleus'; mgx.fillStyle = b.n === opt.focus ? '#fff' : rgba(col(b), big2 ? 1 : .8); mgx.beginPath(); mgx.arc(mx + W[i][0] * k, my + W[i][1] * k, big2 ? 3.2 * K : b.tier === 'anchor' ? 2.2 * K : 1.4 * K, 0, TAU); mgx.fill(); });
    mgx.strokeStyle = '#fff'; mgx.lineWidth = 1.5 * K; mgx.strokeRect(mx + (cam.x - w / 2 / Z) * k, my + (cam.y - h / 2 / Z) * k, w / Z * k, h / Z * k); mgx.restore();
    return pos;
  }
  window.SKY = { starTileURL: () => { const t = starTile(9, 9000); return t._url || (t._url = t.toDataURL()); }, STAR_PAR: .05, layout, lineage, universe, massText, drawV: paintV, SPREAD, BASE, OBJ, FR, POOL, landFx, drawLabel, draw: (g, id, x, y, r, t = 0) => paint(g, id, x, y, r, t), starfield, fade, land, system, orbits, byId: id => OBJ.find(o => o.id === id) };
})();
