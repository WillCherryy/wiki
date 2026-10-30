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
      const VW = (window.SKY && window.SKY.view) || {}, rot = t * 2.6 + .6, tilt = VW.roll != null ? VW.roll + .65 : .35;
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
      const VW = (window.SKY && window.SKY.view) || {}, TILT = VW.roll != null ? VW.roll : -.3, INC = VW.inc != null ? VW.inc : 1, SY = .3, k = r / 128, spr = quasarDisc(), ray = (u, c) => `rgba(${c[0]},${c[1]},${c[2]},${u})`, br = .92 + .08 * Math.sin(t * 5.3) + .04 * Math.sin(t * 11.1);
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
      g.save(); g.scale(1, INC); g.drawImage(spr.back, -256 * k, -144 * k, 512 * k, 288 * k); g.restore(); g.globalAlpha = 1;
      // hot spots orbiting in the disc: brighter as they swing towards us
      const RMIN = r * .42, RMAX = r * 1.8;
      for (let i = 0; i < 46; i++) { const u = hash(i + 5), rad = RMIN + (RMAX - RMIN) * Math.pow(u, .9), sp = (.55 + 1.6 * (1 - u)), a0 = hash(i + 17) * TAU + t * sp, len = .12 + .5 * hash(i + 77); g.strokeStyle = ray(.22 + .45 * hash(i + 9), u < .3 ? [255, 238, 190] : u < .6 ? [255, 176, 70] : [236, 92, 40]); g.lineWidth = Math.max(.5, r * .018); g.beginPath(); g.ellipse(0, 0, rad, rad * SY, 0, a0, a0 + len); g.stroke(); }
      for (let i = 0; i < 3; i++) { const rad = r * (.62 + .3 * i), a = t * (1.9 - .5 * i) + i * 2.1, px = Math.cos(a) * rad, py = Math.sin(a) * rad * SY, boost = .55 + .45 * -Math.sin(a + .0); halo(g, px, py, r * .26, '#fff1c8', .7 * boost); }
      g.globalCompositeOperation = 'source-over';
      const sh = g.createRadialGradient(0, 0, r * .2, 0, 0, r * .36); sh.addColorStop(0, '#000'); sh.addColorStop(.85, '#000'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.beginPath(); g.arc(0, 0, r * .36, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter'; for (const [mul, al, w] of [[.335, .98, .035], [.36, .45, .06], [.4, .16, .1]]) { g.strokeStyle = ray(al * br, [255, 236, 200]); g.lineWidth = r * w; g.beginPath(); g.arc(0, 0, r * mul, 0, TAU); g.stroke(); }
      g.save(); g.scale(1, INC); g.drawImage(spr.front, -256 * k, -144 * k, 512 * k, 288 * k); g.restore();
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
  function surfaceTex(id, hi) {   // hi: the same painting at twice the resolution, used when a body fills much of the screen
    const key = hi ? id + '|hi' : id; let c = SURF.get(key); if (c) return c; const W = 1024, H = 512, Z = hi ? 2 : 1; c = document.createElement('canvas'); c.width = W * Z; c.height = H * Z; const g = c.getContext('2d'); g.scale(Z, Z); const sd = id.length * 7.3, R = k => hash(sd + k);
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
    const c2 = document.createElement('canvas'); c2.width = c.width * 2; c2.height = c.height; const k2 = c2.getContext('2d'); k2.drawImage(c, 0, 0); k2.drawImage(c, c.width, 0); SURF.set(key, c2); return c2;
  }
  function bodySurface(g, id, x, y, r, t) {   // the scrolled texture wrapped onto a sphere (vertical strips narrow towards the limb), with limb darkening, a soft highlight and a thin rim
    const sp = SURFSPEC[id]; if (!sp) return; const tex = surfaceTex(id, r > 110), W = tex.width / 2, H = tex.height, VW = (window.SKY && window.SKY.view) || {}, off = (((VW.spin != null ? VW.spin : t * sp.speed) * W) % W + W) % W, tl = VW.tilt || 0, sy0 = H * (.08 + .08 * tl), sh0 = H * .84, rr = r * .985, d = rr * 2, N = r > 70 ? 44 : r > 32 ? 26 : 0;
    g.save(); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.clip();
    if (!N) { g.drawImage(tex, off, sy0, H, sh0, x - rr, y - rr, d, d); }
    else for (let i = 0; i < N; i++) { const a0 = -1 + 2 * i / N, a1 = -1 + 2 * (i + 1) / N, l0 = Math.asin(a0), l1 = Math.asin(a1), u0 = off + (l0 / Math.PI + .5) * (W / 2) * 2 * .5 * 2, u1 = off + (l1 / Math.PI + .5) * (W / 2) * 2 * .5 * 2; g.drawImage(tex, u0, sy0, Math.max(.5, u1 - u0), sh0, x + a0 * rr, y - rr, (a1 - a0) * rr + .6, d); }
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
  const SBG = new Map();
  function starBg(g, w, h, n, seed, bg) {   // a still star field drawn once per size and reused: redrawing thousands of stars every frame was most of the cost of the comparison and close-up views
    const key = w + 'x' + h + '|' + n + '|' + seed + '|' + bg; let c = SBG.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext('2d'); if (bg) { cg.fillStyle = bg; cg.fillRect(0, 0, w, h); } starfield(cg, w, h, 0, n, seed); SBG.set(key, c); while (SBG.size > 6) SBG.delete(SBG.keys().next().value); }
    g.drawImage(c, 0, 0);
  }
  function starfield(g, w, h, t, n = 90, seed = 0) {   // a real random scatter (a seeded PRNG, not a lattice hash): many faint stars, a few bright ones, a hint of colour, mild clumping
    let a0 = (Math.floor(seed * 7919) + 1013904223) >>> 0; const rnd = () => { a0 = (a0 + 0x6D2B79F5) >>> 0; let t2 = a0; t2 = Math.imul(t2 ^ (t2 >>> 15), t2 | 1); t2 ^= t2 + Math.imul(t2 ^ (t2 >>> 7), t2 | 61); return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296; };
    g.save(); const tints = ['255,255,255', '255,238,215', '206,224,255', '255,214,190'], clumps = []; for (let i = 0; i < 7; i++) clumps.push([rnd(), rnd(), .14 + .2 * rnd()]);
    for (let i = 0; i < n; i++) { let x, y; if (rnd() < .08) { const c = clumps[Math.floor(rnd() * clumps.length)]; x = c[0] + (rnd() + rnd() + rnd() - 1.5) * c[2]; y = c[1] + (rnd() + rnd() + rnd() - 1.5) * c[2]; x = ((x % 1) + 1) % 1; y = ((y % 1) + 1) % 1; } else { x = rnd(); y = rnd(); }
      const u = rnd(), v = rnd(), big = Math.pow(u, 7), r = .28 + 1.5 * big + .25 * u, al = (.14 + .5 * Math.pow(v, 1.6) + .4 * big) * (.8 + .2 * Math.sin(t * (1 + rnd() * 2) + i)), tn = tints[Math.floor(rnd() * tints.length)];
      g.fillStyle = `rgba(${tn},${Math.min(1, al)})`; g.beginPath(); g.arc(x * w, y * h, r, 0, TAU); g.fill(); if (big > .12) { g.fillStyle = `rgba(${tn},${al * .16})`; g.beginPath(); g.arc(x * w, y * h, r * 3.2, 0, TAU); g.fill(); } }
    g.restore();
  }

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
  // display options, kept between visits: labels on or off, the label typeface, and how duplicate copies sit (a tight cluster or spread through the neighbourhood)
  const LBLFONTS = { fine: { name: 'Fine', f: '"Jost", "Instrument Sans", system-ui, sans-serif', w: 300, s: .5, ls: .26, caps: true }, elegant: { name: 'Elegant', f: '"Cormorant Garamond", "EB Garamond", Georgia, serif', w: 400, s: .82, ls: .1 }, classic: { name: 'Classic', f: '"EB Garamond", Georgia, serif', w: 400, s: 1, ls: .04 }, mono: { name: 'Technical', f: '"IBM Plex Mono", ui-monospace, monospace', w: 300, s: .5, ls: .08, caps: true } };
  const PREF = { on: true, font: 'fine', dup: 'cluster' }; try { const o = JSON.parse(localStorage.getItem('wikiio:sky') || '{}'); if (o && typeof o === 'object') { if (typeof o.on === 'boolean') PREF.on = o.on; if (LBLFONTS[o.font]) PREF.font = o.font; if (o.dup === 'spread' || o.dup === 'cluster') PREF.dup = o.dup; } } catch (e) {}
  const lf = () => LBLFONTS[PREF.font] || LBLFONTS.fine;
  function setPref(o) { Object.assign(PREF, o); try { localStorage.setItem('wikiio:sky', JSON.stringify(PREF)); } catch (e) {} LBL.clear(); }
  function drawLabel(g, l) { const F = lf(), sz = l.size * F.s, tx = F.caps ? l.text.toUpperCase() : l.text; g.save(); g.font = `${F.w} ${sz}px ${F.f}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; try { g.letterSpacing = (sz * F.ls) + 'px'; } catch (e) {} g.shadowColor = 'rgba(3,2,10,.95)'; g.shadowBlur = sz * .45; g.fillStyle = l.color; g.fillText(tx, l.x, l.y); g.shadowBlur = 0; if (F.caps) { const wd = g.measureText(tx).width; g.fillStyle = rgba('#ffffff', .22); g.fillRect(l.x - wd * .08 - 0, l.y + sz * .55, wd * .16, Math.max(.6, sz * .04)); } g.restore(); }
  // a system: Kepler orbits (T^2 ~ a^3, ellipses with the primary at a focus, faster at periapsis), a barycentre wobble, moons for duplicates.
  // The map is far larger than the view: pan with opt.cam = {x, y, z}; positions are world units with the primary at the origin.
  function kepler(M, e) { let E = M; for (let i = 0; i < 5; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  const SPREAD = 2.2, BASE = .95;   // how far apart the orbits sit: bigger is grander (periods follow Kepler's law, so far orbits turn slowly)
  // one object, drawn the way it would look: a point of light (sized by luminosity, coloured by temperature) until it is resolved, then a sharp shaded disc at its true size
  // ---- high-detail helpers shared by every object (the Cosmos film's renderers, brought into the app)
  const fbm2 = (x, y, o = 4) => { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= .5; f *= 2.03; } return s / n; };
  let PLUMEC = null;
  function plumeSprite() {   // a red supergiant's extended atmosphere: lumpy, lopsided gas several times the star's size (as interferometers see Betelgeuse)
    if (PLUMEC) return PLUMEC; const n = 384; PLUMEC = mk(n); const x = PLUMEC.getContext('2d'), im = x.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = (i - n / 2) / (n / 2), v = (j - n / 2) / (n / 2), r = Math.hypot(u, v), th = Math.atan2(v, u), lump = fbm2(Math.cos(th) * 2.2 + 3, Math.sin(th) * 2.2 + r * 3, 4), side = .55 + .45 * Math.cos(th - 2.3), a = Math.max(0, (1 - r) * (.25 + 1.1 * lump * side) - .05) * Math.exp(-r * 2.2), k = (j * n + i) * 4;
      im.data[k] = 255; im.data[k + 1] = 110 + 60 * lump; im.data[k + 2] = 60; im.data[k + 3] = Math.min(255, a * 255); }
    x.putImageData(im, 0, 0); return PLUMEC;
  }
  const BLOOM = new Map();
  function bloomSprite(tint, lg) {   // a star's wide halo: a brighter inner bloom and a faint outer one, at the right ratio for its luminosity
    const key = tint + lg; let c = BLOOM.get(key); if (c) return c; const n = 512, h2 = n / 2, k1 = (4 + 1.3 * lg) / (9 + 3 * lg); c = mk(n); const x = c.getContext('2d');
    for (const [rr, a] of [[1, Math.min(.12, .03 + .016 * lg)], [k1, Math.min(.32, .12 + .035 * lg)]]) { const gr = x.createRadialGradient(h2, h2, 0, h2, h2, h2 * rr); gr.addColorStop(0, rgba(tint, a)); gr.addColorStop(.3, rgba(tint, a * .45)); gr.addColorStop(.65, rgba(tint, a * .12)); gr.addColorStop(1, rgba(tint, 0)); x.fillStyle = gr; x.fillRect(0, 0, n, n); }
    if (BLOOM.size > 60) BLOOM.delete(BLOOM.keys().next().value); BLOOM.set(key, c); return c;
  }
  // ---- the eye's brightness range. Seen from above the map every star is at about the same distance, so its brightness goes with its luminosity.
  //      The eye adapts to the brightest star in view and sees about 14 magnitudes below it (a factor of ~400,000); fainter stars sink to a
  //      just-visible floor so they can still be found. Adaptation settles over about half a second, as the eye's does. EYE is null outside the map.
  let EYE = null, EYEF = null;
  const eyeK = b => { if (EYE == null || b.n === EYEF) return 1; const dm = 2.5 * (EYE - Math.log10(lumOf(b) + 1e-9)); return dm <= 0 ? 1 : Math.pow(clamp(1 - dm / 14), 1.6); };
  function starGlow(g, b, x, y, rpx, K, tint) {   // every star glows by its real luminosity: a bright core halo, a wide soft bloom, and for the most luminous a faint anamorphic streak, as a cinema lens sees them
    if (b.id === 'brown') { glowAt(g, x, y, rpx * 2.2 + 4 * K, tint, .1 * clamp((tempOf(b) - 250) / 1500)); return; }   // nearly all its light is infrared: only a faint glow in the visible
    const lg = Math.log10(1 + lumOf(b)), L2 = Math.round(lg * 2) / 2, Ro = rpx * (9 + 3 * L2) + 18 * K, e = eyeK(b), a0 = g.globalAlpha; g.globalAlpha = a0 * (.25 + .75 * e);
    glowAt(g, x, y, rpx * 2.4 + 4 * K, tint, .42);
    g.drawImage(bloomSprite(tint, L2), x - Ro, y - Ro, Ro * 2, Ro * 2);   // the wide bloom: two falloffs baked into one soft image, drawn once
    if (lg > 3.4 && rpx > 3) { const hw = Math.min(rpx * (10 + 2 * lg), 2400), a = Math.min(.22, .05 * (lg - 3)); g.save(); g.globalCompositeOperation = 'lighter'; const lgr = g.createLinearGradient(x - hw, 0, x + hw, 0); lgr.addColorStop(0, rgba(tint, 0)); lgr.addColorStop(.5, rgba(mixHex(tint, '#ffffff', .4), a)); lgr.addColorStop(1, rgba(tint, 0)); g.fillStyle = lgr; g.fillRect(x - hw, y - Math.max(.6, rpx * .025), hw * 2, Math.max(1.2, rpx * .05)); g.restore(); }
    g.globalAlpha = a0;
  }
  // ---- supernova remnants around their neutron stars: painted per pixel once, a few rows per frame, then kept
  const SNR = { 'Crab Pulsar': [5.5, 'crab'], 'Cassiopeia A': [5, 'casa'] }, SNRC = new Map();
  function snrTex(nm) {
    let s = SNRC.get(nm); if (s && s.done) return s.c; const kind = SNR[nm][1], w = 640, h = kind === 'crab' ? 480 : 640;
    if (!s) { s = { c: mk(w), row: 0, im: null, done: false }; s.c.height = h; s.im = s.c.getContext('2d').createImageData(w, h); SNRC.set(nm, s); }
    const cx = w / 2, cy = h / 2, ax = w * .42, ay = h * .4, rot = kind === 'crab' ? -.42 : 0, cr = Math.cos(rot), sr = Math.sin(rot), D = s.im.data, t0 = performance.now();
    while (s.row < h && performance.now() - t0 < 10) { const j = s.row++; for (let i = 0; i < w; i++) { const dx = i - cx, dy = j - cy, u = (dx * cr + dy * sr) / ax, v = (-dx * sr + dy * cr) / ay, q = Math.hypot(u, v), th = Math.atan2(v, u), k = (j * w + i) * 4;
        const wob = 1 + .1 * (fbm2(Math.cos(th) * 2 + 4, Math.sin(th) * 2, 3) - .5) * 2, qq = q / wob; if (qq > 1.08) continue; let R = 0, G = 0, B = 0;
        const n1 = fbm2(u * 5.5 + 3, v * 5.5, 5), n2 = fbm2(u * 11 + 9, v * 11 - 4, 4), ridge = Math.pow(1 - Math.abs(2 * n1 - 1), 16) * .9 + Math.pow(1 - Math.abs(2 * n2 - 1), 22) * .6;
        if (kind === 'crab') { const shell = sm3(clamp((qq - .25) / .45)) * (1 - sm3(clamp((qq - .92) / .14))), radial = .6 + .4 * Math.abs(Math.cos((th + fbm2(u * 3, v * 3, 2) * 2) * 9)), fil = ridge * radial * shell * 1.4, green = sm3(clamp((fbm2(u * 2.5 - 7, v * 2.5, 3) - .63) / .1)) * .5, yel = fbm2(u * 4 + 2, v * 4 - 1, 3), sync = Math.exp(-qq * qq * 2.6) * .3 * (.55 + .7 * fbm2(u * 6 - 2, v * 6, 4));
          R = fil * (1 - green * .5) + sync * .5; G = fil * (.3 + .35 * yel + green * .55) + sync * .62; B = fil * (.2 + green * .1) + sync; }   // a web of red and orange filaments around the pulsar's blue synchrotron glow
        else { const shell = Math.exp(-Math.pow((qq - .74) / .13, 2)), knots = Math.pow(1 - Math.abs(2 * n1 - 1), 10) * shell * 1.6, hue = fbm2(u * 2 + 5, v * 2, 3);
          const k2 = knots * 2.4 + Math.pow(1 - Math.abs(2 * n2 - 1), 14) * shell * 1.2; R = k2 * (.35 + .9 * sm3(clamp((hue - .5) / .2))) + shell * .025; G = k2 * (.45 + .55 * (1 - hue)) + shell * .03; B = k2 * (.85 - .45 * hue) + shell * .06; }   // a young shell of oxygen, silicon and iron knots, still expanding at 5,000 km/s
        const ex = 1.7, f = c => 255 * Math.pow(1 - Math.exp(-c * ex), 1 / 1.15), edge = 1 - sm3(clamp((qq - .96) / .12)); D[k] = f(R); D[k + 1] = f(G); D[k + 2] = f(B); D[k + 3] = 255 * edge * Math.min(1, Math.max(f(R), f(G), f(B)) / 60); } }
    if (s.row >= h) { s.c.getContext('2d').putImageData(s.im, 0, 0); s.done = true; return s.c; } return null;
  }
  function drawSNR(g, b, x, y, rpx) {
    const nm = b.n.split('#')[0], d = SNR[nm]; if (!d) return; const D = rpx * (d[0] / LYU) / (physR(b) * RSU) * 2; if (D < 14 || D > 9000) return; const tx = snrTex(nm); if (!tx) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = sm3(clamp((D - 14) / 60)); g.drawImage(tx, x - D / 2, y - D / 2 * tx.height / tx.width, D, D * tx.height / tx.width); g.restore();
  }
  // ---- neutron star beams: soft, broad, fading outward: radiation lighting the plasma along the magnetic axis, not a hard cone
  let BEAMC = null;
  function beamSprite() { if (BEAMC) return BEAMC; BEAMC = mk(256); BEAMC.height = 640; const x = BEAMC.getContext('2d'); x.filter = 'blur(10px)'; const lg = x.createLinearGradient(128, 620, 128, 20); lg.addColorStop(0, 'rgba(210,222,255,.75)'); lg.addColorStop(.15, 'rgba(180,195,255,.3)'); lg.addColorStop(.55, 'rgba(160,170,255,.08)'); lg.addColorStop(1, 'rgba(150,160,255,0)'); x.fillStyle = lg; x.beginPath(); x.moveTo(122, 620); x.lineTo(134, 620); x.lineTo(232, 20); x.lineTo(24, 20); x.closePath(); x.fill(); return BEAMC; }
  // ---- black holes on the graphics card: every pixel traced through a simple model of the bent light (the film's renderer, in WebGL)
  let GLB = null;
  const BHFS = `precision highp float; uniform vec2 uRes; uniform float uScale, uCi, uSi, uRin, uRout, uT, uAcc, uSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.3; a *= .5; } return s / .97; }
float disc(float R, float phi){ float rr = (R - uRin) / (uRout - uRin); if (rr < 0.0 || rr >= 1.0) return 0.0; float om = .3 * pow(R / uRin, -1.5) * uT, a = phi - om + log(R) * 1.6;
  float st = fbm(vec2(R * 3.2 + cos(a) * 2.6, sin(a) * 2.6 + R * .9)), cl = fbm(vec2(R * 1.2 + cos(a) * 5.0 + 5.0, sin(a) * 5.0)), fine = fbm(vec2(R * 9.0 + cos(a) * 9.0, sin(a) * 9.0 - R * 3.0));
  float prof = pow(uRin / R, 2.1) * (1.0 - sqrt(uRin / R) * .92) * 3.2, edge = smoothstep(0.0, .04, rr) * (1.0 - smoothstep(.7, 1.0, rr));
  return (.25 + .8 * st * st + .45 * cl * cl + .25 * fine) * prof * edge * (.35 + .65 * uAcc); }
vec3 col(float I, float D, float R){ float T = clamp(.35 + .5 * pow(uRin / R, .8) + .25 * (D - 1.0) - (1.0 - uAcc) * .35, 0.0, 1.0); float e = I * D * D * D; return e * vec3(min(1.0, .9 + T), .55 + .42 * T, .25 + .7 * T * T); }
void main(){ vec2 p = (gl_FragCoord.xy - uRes * .5) / uScale; float x = p.x, y = -p.y, b = length(p); vec3 c = vec3(0.0);
  if (b > 1.005) { float R = uRin + (b - 1.02) / 1.05 * (uRout * .55 - uRin), sinT = abs(y) / b; if (R > uRin * .98) { float I = disc(max(R, uRin), atan(y, x)) * 1.35 * (.3 + .7 * sinT) * (1.0 - smoothstep(1.7, 3.2, b)) * clamp(uSi * 1.3, 0.0, 1.0); c += col(I, 1.0 + .45 * (-x / b) * uSi, max(R, uRin)); } }
  float pr = exp(-pow((b - 1.015) / (.012 + .6 / uScale), 2.0)) * (.9 + .6 * (-x / b) * uSi); c += vec3(1.0, .9, .78) * pr;
  float Y = y / max(uCi, .06), Rd = length(vec2(x, Y)); if (Rd > uRin && Rd < uRout && (y > 0.0 || b > 1.0)) { float I = disc(Rd, atan(Y, x)), op = clamp(I * 2.2, 0.0, 1.0) * (y > 0.0 ? 1.0 : .9); c = c * (1.0 - op * .6) + col(I, 1.0 + .47 * (-x / Rd) * uSi, Rd); }
  c = min(c, vec3(1.0)); gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }   // light only: transparent where there is none, so whatever lies behind still shows`;
  function glbh() {
    if (GLB !== null) return GLB;
    try { const c = document.createElement('canvas'), gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true }); if (!gl) throw 0;
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
      const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }')); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, BHFS)); gl.linkProgram(pg); if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw 0; gl.useProgram(pg);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); const al = gl.getAttribLocation(pg, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
      const U = {}; ['uRes', 'uScale', 'uCi', 'uSi', 'uRin', 'uRout', 'uT', 'uAcc', 'uSeed'].forEach(n => U[n] = gl.getUniformLocation(pg, n)); GLB = { c, gl, U };
    } catch (e) { GLB = false; } return GLB;
  }
  function glBH(sh, ci, si, rin, rout, t, acc, seed) {   // sh: the shadow radius on screen; returns a canvas with the hole at its centre, or null
    const G = glbh(); if (!G) return null; const ext = [rout * 1.02, Math.max(3.4, rout * ci * 1.2)], k = Math.min(1, (Math.min(screen.width || 1400, 1400) > 900 ? 1400 : 900) / (ext[0] * 2 * sh)), sc = sh * k, w = Math.ceil(ext[0] * 2 * sc), h = Math.ceil(ext[1] * 2 * sc), { c, gl, U } = G;
    if (w < 4 || h < 4) return null; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uScale, sc); gl.uniform1f(U.uCi, ci); gl.uniform1f(U.uSi, si); gl.uniform1f(U.uRin, rin); gl.uniform1f(U.uRout, rout); gl.uniform1f(U.uT, t); gl.uniform1f(U.uAcc, acc); gl.uniform1f(U.uSeed, seed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return { c, w: w / k, h: h / k };
  }
  function bodyAt(g, b, x, y, rpx, sz, K, t) {
    const T = tempOf(b), tint = bbHex(T), pale = mixHex(tint, '#ffffff', .45);
    if (b.n.split('#')[0] === 'Eta Carinae' && rpx * 36000 > 20 && rpx * 36000 < 4000) { const D = rpx * 36000;   /* the Homunculus is ~0.6 light-years across: 36,000 times the star */ g.save(); g.translate(x, y); g.rotate(-.7); g.drawImage(homunculus(), -D / 2, -D / 2, D, D); g.restore(); }
    if (b.id === 'neutron') drawSNR(g, b, x, y, rpx);
    if (b.id === 'quasar') { if (rpx * 2.6 >= 4 * K) { drawBH(g, b, x, y, rpx, K, t); return; } if (rpx * 4 < 26 * K) { glowAt(g, x, y, (7 + 5 * sz) * K, '#ffd9a8', .9); glowAt(g, x, y, 2.6 * K, '#ffffff', 1); return; } g.save(); g.translate(x, y); paintBody(g, 'quasar', 0, 0, rpx * 4, t + b.idx, b); g.restore(); g.restore(); return; }
    if (rpx < 1.4) { const L = lumOf(b), e = eyeK(b), gr = K * (1.3 + 1.25 * Math.log10(1 + L * 3)) * (.45 + .55 * sz) * (.5 + .5 * e); glowAt(g, x, y, Math.min(gr, 9 * K), pale, (.22 + .5 * sz) * e);
      if (L > 2000 && sz > .4 && e > .6) { const sl = Math.min(26 * K, gr * 2.2) * sz; g.strokeStyle = rgba(pale, .35 * sz); g.lineWidth = Math.max(.5, .6 * K); g.beginPath(); g.moveTo(x - sl, y); g.lineTo(x + sl, y); g.moveTo(x, y - sl); g.lineTo(x, y + sl); g.stroke(); }   // diffraction spikes on the most luminous stars, as a telescope sees them
      g.fillStyle = `rgba(255,255,255,${(.5 + .45 * sz) * (.4 + .6 * e)})`; g.beginPath(); g.arc(x, y, Math.max(.55 * K, rpx) * (.75 + .25 * e), 0, TAU); g.fill(); return; }
    if (b.id === 'redgiant' && RSUN(b) > 250) { const ns = shellSprite(b), D = rpx * 7; g.save(); g.globalAlpha = .75; g.drawImage(ns, x - D / 2, y - D / 2, D, D); g.restore(); }   // a cool supergiant sheds dust: a faint lumpy shell several times its size
    const nm = b.n.split('#')[0], pu = PULSE[nm]; if (pu) rpx *= 1 + pu[1] * Math.sin(TAU * SIMT / pu[0] + hs2(nm) * TAU);   // pulsating variables breathe at their real period
    if (b.id === 'neutron') { glowAt(g, x, y, rpx * 2.4 + 4 * K, tint, .4); drawNS(g, b, x, y, rpx, K, t); return; }
    starGlow(g, b, x, y, rpx, K, tint);
    if (b.id === 'redgiant' && RSUN(b) > 300 && rpx > 6) { const D = rpx * 7.5; g.save(); g.globalAlpha = sm3(clamp((rpx - 6) / 30)) * .7; g.translate(x, y); g.rotate(hs2(nm + 'pl') * TAU); g.drawImage(plumeSprite(), -D / 2, -D / 2, D, D); g.restore(); }   // its swollen, lopsided atmosphere
    const tex = rpx >= 8 ? surfFor(b, rpx) : null;
    const ob = OBLATE[nm] || 1, ry = rpx / ob;
    if (tex) g.drawImage(tex, x - rpx, y - ry, rpx * 2, ry * 2);
    else { const gr = g.createRadialGradient(x - rpx * .2, y - rpx * .2, 0, x, y, rpx); gr.addColorStop(0, mixHex(tint, '#ffffff', .6)); gr.addColorStop(.7, tint); gr.addColorStop(1, mixHex(tint, '#000000', .45)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rpx, 0, TAU); g.fill(); }
    if (b.id === 'whitedwarf' && (nm === 'G 29-38' || nm === 'WD 1145+017') && rpx > 2) { g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(-.18); g.scale(1, .24); const r0 = rpx * 9, r1 = rpx * 45, dg = g.createRadialGradient(0, 0, r0, 0, 0, r1); dg.addColorStop(0, 'rgba(255,196,150,0)'); dg.addColorStop(.12, 'rgba(255,196,150,.15)'); dg.addColorStop(.45, 'rgba(230,170,130,.07)'); dg.addColorStop(1, 'rgba(200,150,120,0)'); g.fillStyle = dg; g.beginPath(); g.arc(0, 0, r1, 0, TAU); g.fill(); g.restore(); }   // a torn-apart planet: a faint dusty disc tens of white-dwarf radii across, lit by the star
    if ((b.id === 'redgiant' || b.id === 'sun' || b.id === 'reddwarf') && rpx > 20) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = sm3(clamp((rpx - 20) / 60)); const rg0 = b.id === 'redgiant', rim = g.createRadialGradient(x, y, rpx * .99, x, y, rpx * (rg0 ? 1.3 : 1.06)); rim.addColorStop(0, rgba(tint, rg0 ? .16 : .22)); rim.addColorStop(.35, rgba(tint, rg0 ? .06 : .07)); rim.addColorStop(1, rgba(tint, 0)); g.fillStyle = rim; g.beginPath(); g.arc(x, y, rpx * (rg0 ? 1.31 : 1.07), 0, TAU); g.fill(); g.restore(); }   // a hot chromosphere glowing at the limb; round a red supergiant, the faint haze of its extended molecular layer
  }

  // ---- neutron stars: a 12 km ball of degenerate matter at ~1 million K. Light bends round it (we see more than half), hot caps glow at the magnetic poles,
  //      a dipole field threads the space around it, and pulsars sweep two beams along the magnetic axis. Each one is drawn from what it really is.
  const NS = {   // spin period (s), magnetic inclination (rad), kind: radio pulsar / msp (recycled millisecond) / magnetar / thermal (no beams) / gamma (radio-quiet)
    'Crab Pulsar': [.0337, 1.0, 'radio'], 'Vela Pulsar': [.0893, 1.1, 'radio'], 'Geminga': [.237, .9, 'gamma'], 'PSR B1919+21': [1.337, .6, 'radio'], 'PSR B1913+16': [.059, .8, 'radio', 'binary'], 'PSR J0737−3039': [.0227, 1.3, 'radio', 'double'],
    'SGR 1806−20': [7.55, .7, 'magnetar'], 'SGR 1935+2154': [3.25, .8, 'magnetar'], 'PSR J0348+0432': [.039, .7, 'msp', 'wd'], 'Cassiopeia A': [0, 0, 'thermal'], 'PSR J1748−2446ad': [.00139, 1.2, 'msp'], 'PSR J0952−0607': [.00141, .9, 'msp', 'widow'],
    'PSR B1257+12': [.0062, .8, 'msp', 'planets'], 'PSR J1614−2230': [.00315, 1.1, 'msp', 'wd'], 'RX J1856.5−3754': [7.06, .4, 'thermal'] };
  function drawNS(g, b, x, y, R, K, t) {
    const nm = b.n.split('#')[0], d = NS[nm] || [.5, .8, 'radio'], [P, al, kind] = d, h = k => hs2(nm + k), mag = kind === 'magnetar', T = kind === 'thermal' ? 6e5 : mag ? 1.1e6 : kind === 'msp' ? 3e5 : 8e5;
    const spin = P ? TAU * t / (1.2 + 2.2 * Math.log10(1 + P / .0013)) : 0, inc = .35 + .9 * h('i'), tilt = (h('t') - .5) * 1.4, ca = Math.cos(al), sa = Math.sin(al);   // spin shown slowed but in true order: a millisecond pulsar whirls, a magnetar crawls
    const m = [sa * Math.cos(spin), ca, sa * Math.sin(spin)], ci = Math.cos(inc), si = Math.sin(inc), mv = [m[0], m[1] * ci - m[2] * si, m[1] * si + m[2] * ci], ct = Math.cos(tilt), st = Math.sin(tilt), P2 = (vx, vy) => [x + (vx * ct - vy * st) * R, y - (vx * st + vy * ct) * R];
    const col = mag ? '#c8b4ff' : kind === 'thermal' ? '#cfe2ff' : '#bfe6ff', flash = (kind === 'radio' || kind === 'msp') ? Math.pow(Math.max(0, mv[2]), 10) : 0;
    g.save(); g.globalCompositeOperation = 'lighter';
    glowAt(g, x, y, R * (3 + 5 * flash), col, .35 + .5 * flash);
    // (the dipole field itself is invisible, so it is not drawn)
    // beams along the magnetic axis
    if (kind === 'radio' || kind === 'msp' || kind === 'gamma') for (const sg of [1, -1]) { const L2 = 14, [ex, ey] = P2(mv[0] * L2 * sg, mv[1] * L2 * sg), [bx, by] = P2(0, 0), ang = Math.atan2(ey - by, ex - bx), w = .16, len = Math.hypot(ex - bx, ey - by), toward = Math.max(0, mv[2] * sg);
      g.save(); g.translate(bx, by); g.rotate(ang + Math.PI / 2); g.globalAlpha = (.28 + .45 * toward) * (kind === 'gamma' ? .6 : 1); const bw2 = len * .3; g.drawImage(beamSprite(), -bw2 / 2, -len, bw2, len * 1.03); g.restore(); }   // soft and broad, fading outward
    g.restore();
    // the star: bent light flattens the limb (we see ~3/4 of the surface), very faint granular texture, and two hot polar caps
    const tx = R >= 10 ? surfFor({ ...b, id: 'neutron', t: '40000 K' }, R) : null; if (tx) { g.drawImage(tx, x - R, y - R, R * 2, R * 2); } else { const gr = g.createRadialGradient(x - R * .15, y - R * .15, 0, x, y, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.75, mixHex(bbHex(Math.min(T, 4e4)), '#ffffff', .35)); gr.addColorStop(1, mixHex(bbHex(Math.min(T, 4e4)), '#6a86c0', .3)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); }
    if (R > 6) { g.save(); g.beginPath(); g.arc(x, y, R, 0, TAU); g.clip(); for (const sg of [1, -1]) { const vz = mv[2] * sg; if (vz < -.35) continue; const [cx2, cy2] = P2(mv[0] * sg * .78, mv[1] * sg * .78), cr = R * (kind === 'msp' ? .34 : mag ? .5 : .26) * (.55 + .45 * Math.max(0, vz + .35)), cg = g.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr); cg.addColorStop(0, 'rgba(255,255,255,1)'); cg.addColorStop(.4, rgba(mag ? '#e8dcff' : '#e4f6ff', .8)); cg.addColorStop(1, 'rgba(220,240,255,0)'); g.fillStyle = cg; g.fillRect(cx2 - cr, cy2 - cr, cr * 2, cr * 2); }
      g.restore(); }
    if (d[3] === 'double') { const a2 = TAU * t / 9 + 1, dd = R * 7, x2 = x + Math.cos(a2) * dd, y2 = y + Math.sin(a2) * dd * .3; drawNS.depth = (drawNS.depth || 0) + 1; if (drawNS.depth < 2) drawNS(g, { n: 'PSR J0737−3039B' }, x2, y2, R * .95, K, t * .6); drawNS.depth--; }   // the double pulsar: its twin, drawn close (really 800,000 km away)
  }
  NS['PSR J0737−3039B'] = [2.77, .6, 'radio'];

  // ---- black holes, drawn as general relativity shows them: the shadow (2.6 event-horizon radii), a razor photon ring, an accretion disc whose far side
  //      is lensed up and over the hole, Doppler beaming (the side coming toward us is brighter) and, for the radio-loud, a relativistic jet
  const BH = {   // inclination (rad, 0 = face-on), accretion (0..1: how bright and hot the disc is), jet, extra
    'TON 618': [1.15, 1, 1], 'S5 0014+81': [.5, .95, 1], 'OJ 287': [1.0, .8, 1, 'binary'], 'SDSS J0100+2802': [1.2, 1, 0], 'APM 08279+5255': [1.25, .95, 0, 'lensed'], 'Messier 87': [.3, .35, 1, 'ring'], 'Cygnus A': [1.35, .6, 1], 'Twin Quasar': [1.1, .8, 0, 'lensed'],
    'J0313−1806': [1.2, .9, 0], '3C 48': [1.0, .75, 1], '3C 273': [.7, .9, 1], 'ULAS J1342+0928': [1.15, .85, 0], '3C 279': [.2, .8, 1], 'Markarian 231': [1.3, .7, 0, 'dusty'], 'Centaurus A': [1.4, .25, 1, 'dusty'], 'Sagittarius A*': [.5, .06, 0, 'ring'] };
  const DISC = new Map();
  function discTex(nm, acc, ratio) {   // the accretion disc, face-on, shaded per pixel: hot white-blue inside, orange outside, spiral turbulence, Doppler-brighter on the approaching (left) side
    const key = nm; let c = DISC.get(key); if (c) return c; const S = 768, half = S / 2; c = mk(S); const g = c.getContext('2d'), img = g.createImageData(S, S), D = img.data;
    const h2 = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653); h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }, vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = h2(xi, yi, s), b2 = h2(xi + 1, yi, s), cc = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return a + (b2 - a) * u + (cc - a) * v + (a - b2 - cc + d) * u * v; };
    const sd = Math.floor(hs2(nm + 'disc') * 997), hot = acc > .7 ? [210, 225, 255] : [255, 236, 210], mid = acc > .7 ? [255, 214, 160] : [255, 170, 90], cool = acc > .7 ? [230, 110, 50] : [180, 60, 20];
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { const dx = (px + .5 - half) / half, dy = (py + .5 - half) / half, r = Math.hypot(dx, dy); if (r > 1 || r < ratio) continue; const u = (r - ratio) / (1 - ratio), a = Math.atan2(dy, dx), aw = a + Math.log(r) * 2.6, ca = Math.cos(aw), sa = Math.sin(aw), N = (k, f, rr) => vn(ca * k + r * rr + sd, sa * k + r * rr * .7, sd + f),   /* noise on the (wound) circle, so the pattern never breaks where the angle wraps */
      turb = .5 + .5 * (N(2.5, 0, 9) * .5 + N(7, 3, 34) * .3 + N(20, 5, 110) * .2), streak = .9 + .1 * Math.sin(r * 90 + N(3, 7, 4) * 9), heat = Math.pow(ratio / r, 1.1), dop = 1 + .55 * -Math.cos(a), inner = Math.min(1, u * 12),
      I = heat * turb * streak * dop * inner * (1 - Math.pow(u, 3)), c2 = I > .5 ? mid.map((v, i) => v + (hot[i] - v) * Math.min(1, (I - .5) * 2)) : cool.map((v, i) => v + (mid[i] - v) * I * 2), k = (py * S + px) * 4;
      D[k] = c2[0]; D[k + 1] = c2[1]; D[k + 2] = c2[2]; D[k + 3] = Math.min(255, 255 * Math.min(1, I * 1.4) * (.25 + .75 * acc)); }
    g.putImageData(img, 0, 0); DISC.set(key, c); return c;
  }
  function drawBH(g, b, x, y, rs, K, t) {
    const nm = b.n.split('#')[0], d = BH[nm] || [1, .7, 0], [inc, acc, jet, ex] = d, h = k => hs2(nm + k), sh = rs * 2.6, ci = Math.cos(inc), tilt = (h('t') - .5) * .9, rin = rs * 3, rout = rs * (12 + 6 * h('o')), hot = acc > .7 ? [255, 246, 236] : [255, 226, 190], warm = acc > .7 ? [255, 168, 96] : [255, 120, 50], ph = t * (.5 + .4 * h('w'));
    g.save(); g.translate(x, y); g.rotate(tilt);
    let tex0 = null; const tex = () => tex0 || (tex0 = discTex(nm, acc, rin / rout)), disc = front => { g.save(); g.beginPath(); if (front) g.rect(-rout * 1.1, 0, rout * 2.2, rout * 1.1); else g.rect(-rout * 1.1, -rout * 1.1, rout * 2.2, rout * 1.1); g.clip(); g.scale(1, ci); g.globalCompositeOperation = 'lighter'; g.drawImage(tex(), -rout, -rout, rout * 2, rout * 2); g.restore(); };
    // halo of scattered light
    glowAt(g, 0, 0, rout * 1.25, acc > .7 ? '#ffd2a0' : '#ff9a5c', .14 * acc + .03);
    if (ex === 'dusty') { g.save(); g.scale(1, ci * .9 + .1); g.strokeStyle = 'rgba(20,10,8,.55)'; g.lineWidth = rout * .35; g.beginPath(); g.arc(0, 0, rout * 1.1, 0, TAU); g.stroke(); g.restore(); }   // a dusty torus / dust lane
    if (jet) { g.save(); g.globalCompositeOperation = 'lighter'; for (const sg of [1, -1]) { const L = rs * (70 + 40 * h('j')), y0 = -sg * sh * .9; for (const [w0, w1, al] of [[.6, 4.2, .07], [.25, 1.6, .16], [.1, .6, .26]]) { const gr = g.createLinearGradient(0, y0, 0, -sg * L); gr.addColorStop(0, `rgba(215,232,255,${al})`); gr.addColorStop(.35, `rgba(170,200,255,${al * .45})`); gr.addColorStop(1, 'rgba(150,180,255,0)'); g.fillStyle = gr; g.globalAlpha = sg > 0 ? 1 : .4; g.beginPath(); g.moveTo(-rs * w0, y0); g.lineTo(-rs * w1, -sg * L); g.lineTo(rs * w1, -sg * L); g.lineTo(rs * w0, y0); g.closePath(); g.fill(); }   /* a bright spine inside a faint sheath; the counter-jet is beamed away from us and fainter */
        for (let k = 1; k < 7; k++) { const yy = -sg * L * (k / 7 + .03 * Math.sin(t * .7 + k)); glowAt(g, 0, yy, rs * (.5 + k * .2), '#d6e4ff', .22 * (1 - k / 8) * (sg > 0 ? 1 : .4)); } } g.globalAlpha = 1; g.restore(); }
    { const gb = sh >= 5 ? glBH(sh, ci, Math.sin(inc), rin / sh, rout / sh, t * (.5 + .4 * h('w')) * 2, acc, h('s') * 97) : null;   // on the graphics card when it can: the full lensed picture, every pixel traced
      if (gb) { g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, sh, 0, TAU); g.fill(); g.globalCompositeOperation = 'lighter'; g.drawImage(gb.c, -gb.w / 2, -gb.h / 2, gb.w, gb.h); g.globalCompositeOperation = 'source-over';
        if (ex === 'binary') { const a = TAU * t / 14, dd = rs * 30, bx = Math.cos(a) * dd, by = Math.sin(a) * dd * ci; g.save(); g.translate(bx, by); const s2 = sh * .14; glowAt(g, 0, 0, s2 * 5, '#ffcf9a', .5); g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, s2, 0, TAU); g.fill(); g.restore(); }
        g.restore(); return; } }
    disc(false);   // far side
    // the far side, lensed: light from behind the hole is bent up and over the top (and under the bottom) into a bright arch hugging the shadow
    if (ex !== 'ring') { const k2 = sh * 1.04 / rin, R2 = rout * k2 * .42; g.save(); g.globalCompositeOperation = 'lighter'; g.beginPath(); g.arc(0, 0, sh * 1.75, 0, TAU); g.arc(0, 0, sh * 1.015, 0, TAU, true); g.clip();
      g.save(); g.scale(1, .55 + .45 * (1 - Math.sin(inc) * .6)); g.globalAlpha = .95; g.drawImage(tex(), -R2 * 2.4, -R2 * 2.4, R2 * 4.8, R2 * 4.8); g.restore(); g.restore(); }
    g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 8; k++) { const rl = sh * (1.02 + k * .018); g.strokeStyle = `rgba(255,236,214,${(.3 - k * .03) * Math.max(.3, acc)})`; g.lineWidth = Math.max(.4, sh * .008); g.beginPath(); g.arc(0, 0, rl, 0, TAU); g.stroke(); } g.restore();
    if (ex === 'ring' && g.createConicGradient) { g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 14; k++) { const cg = g.createConicGradient(-Math.PI / 2, 0, 0), q = 1 - Math.abs(k - 6) / 8; [0, .25, .5, .75, 1].forEach(st => { const br = .5 + .5 * Math.cos((st - .55) * TAU); cg.addColorStop(st, `rgba(255,${150 + 80 * br | 0},${70 + 70 * br | 0},${(.12 + .55 * br) * q})`); }); g.strokeStyle = cg; g.lineWidth = sh * .035; g.beginPath(); g.arc(0, 0, sh * (1.02 + k * .025), 0, TAU); g.stroke(); } g.restore(); }   // seen face-on (M87*, Sgr A*): the Event Horizon Telescope's lopsided ring, brighter where gas streams toward us
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, sh, 0, TAU); g.fill();   // the shadow
    g.strokeStyle = 'rgba(255,240,220,.9)'; g.lineWidth = Math.max(.5, sh * .012); g.beginPath(); g.arc(0, 0, sh * 1.005, 0, TAU); g.stroke();   // the photon ring
    disc(true);   // near side, in front of the shadow
    if (ex === 'binary') { const a = TAU * t / 14, dd = rs * 30, bx = Math.cos(a) * dd, by = Math.sin(a) * dd * ci; g.save(); g.translate(bx, by); g.fillStyle = '#000'; const s2 = sh * .14; glowAt(g, 0, 0, s2 * 5, '#ffcf9a', .5); g.beginPath(); g.arc(0, 0, s2, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,230,200,.8)'; g.lineWidth = Math.max(.5, s2 * .05); g.stroke(); g.restore(); }   // OJ 287's smaller companion hole, plunging through the disc every 12 years
    g.restore();
  }
  let HOMU = null;
  function homunculus() {   // Eta Carinae's Homunculus: two dusty bipolar lobes and an equatorial skirt
    if (HOMU) return HOMU; const c = mk(512), g = c.getContext('2d'); g.translate(256, 256); g.globalCompositeOperation = 'lighter'; let sd = 7; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (const sg of [1, -1]) for (let i = 0; i < 900; i++) { const a = r() * TAU, rr = Math.sqrt(r()), x = Math.cos(a) * rr * 70, y = sg * (95 + Math.sin(a) * rr * 80), s2 = 4 + 16 * r(), gr = g.createRadialGradient(x, y, 0, x, y, s2); gr.addColorStop(0, `rgba(${200 + 55 * r() | 0},${110 + 60 * r() | 0},80,${.05 + .05 * (1 - rr)})`); gr.addColorStop(1, 'rgba(200,120,80,0)'); g.fillStyle = gr; g.fillRect(x - s2, y - s2, s2 * 2, s2 * 2); }
    for (let i = 0; i < 300; i++) { const x = (r() - .5) * 360, y = (r() - .5) * 18, s2 = 3 + 8 * r(), gr = g.createRadialGradient(x, y, 0, x, y, s2); gr.addColorStop(0, 'rgba(255,200,150,.06)'); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(x - s2, y - s2, s2 * 2, s2 * 2); }
    HOMU = c; return c; }
  const SHELL = new Map();
  function shellSprite(b) { const key = b.n.split('#')[0]; let c = SHELL.get(key); if (c) return c; c = mk(512); const g = c.getContext('2d'); g.globalCompositeOperation = 'lighter'; let sd = Math.floor(hs2(key + 'sh') * 1e9) | 1; const r = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let i = 0; i < 700; i++) { const a = r() * TAU, d = 256 * (.16 + Math.pow(r(), 1.4) * .8), x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d * (.85 + .15 * r()), s2 = 6 + 30 * r(), gr = g.createRadialGradient(x, y, 0, x, y, s2); gr.addColorStop(0, `rgba(200,${70 + 50 * r() | 0},40,${.05 * (1 - d / 256)})`); gr.addColorStop(1, 'rgba(200,80,40,0)'); g.fillStyle = gr; g.fillRect(x - s2, y - s2, s2 * 2, s2 * 2); }
    SHELL.set(key, c); return c; }
  // duplicates: every extra copy is the same object again. Cluster: a small open cluster around the first, a few light-years across; spread: copies scattered through the arms of random galaxies
  const CPAR = new Map(); let CPB = 0, CPL = 0;
  function copyParams(name, n) { let a = CPAR.get(name); if (!a) CPAR.set(name, a = []); for (let k = a.length + 1; k <= n; k++) a.push({ e: .1 + .3 * hs2(name + 'e' + k), om: hs2(name + 'o' + k) * TAU, M0: hs2(name + 'm' + k) * TAU, a: .35 * (1 + 1.1 * Math.sqrt(k)) * (1 + .15 * hs2(name + 'r' + k)) }); return a; }
  function copies(g, b, wp, count, o) {
    const n = Math.max(0, (count || 1) - 1); if (!n) return null; const { K, SY, Z, w, h, draw, place, toS } = o, P = copyParams(b.n, n), out = new Array(n);
    for (let k = 0; k < n; k++) { if (place) { out[k] = place(k + 1); continue; } const q = P[k], M = q.M0 + TAU * (o.cc || 0) / (Math.sqrt(Math.pow(q.a * LYU * 63241, 3) / Math.max(.1, (b.m || 1) * (n + 1))) * 3.156e7), E = kepler(M, q.e), x = q.a * (Math.cos(E) - q.e), y = q.a * Math.sqrt(1 - q.e * q.e) * Math.sin(E), c = Math.cos(q.om), s = Math.sin(q.om), wx = wp[0] + x * c - y * s, wy = wp[1] + (x * s + y * c) * SY, sp = toS(wx, wy); out[k] = { x: sp[0], y: sp[1], wx, wy }; }
    if (!draw) return out;
    for (let k = 0, drawn = 0; k < n && drawn < 400 && CPB < 1500; k++) { const p = out[k], m = o.rpx * 3 + 12; if (p.x < -m || p.x > w + m || p.y < -m || p.y > h + m) continue; drawn++; CPB++; bodyAt(g, b, p.x, p.y, o.rpx, o.sz, K, o.t); }
    if (o.fc > 0 && o.fc <= n) { const p = out[o.fc - 1], ph = (performance.now() / 1100) % 1; if (o.rpx < 7 * K) ring(g, p.x, p.y, (7 + 16 * ph) * K, '#ffffff', .6 * (1 - ph), K); else ring(g, p.x, p.y, o.rpx * 1.35, '#ffffff', .7, K); }
    return out;
  }
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
      let lbl = null; if (Z > .45 || list.length <= 8 || opt.focus === b.n) { lbl = { text: b.n, x: it.x, y: it.y + r * sc * 1.25 + 40, size: clamp(24 * Math.sqrt(Z), 20, 36), color: opt.focus === b.n ? '#ffffff' : rgba(OBJ[b.idx].c, .92), focus: opt.focus === b.n }; if (!opt.noLabels && PREF.on) drawLabel(g, lbl); }
      pos.push({ n: b.n, id: b.id, x: it.x, y: it.y, wx: it.wx, wy: it.wy, r: Math.max(r * sc, 18), lbl }); });
    // minimap: the whole system with the current view as a box
    const big = Math.max(380, ...orb.map(b => b.a * (1 + b.e))), R = 58, mx = 18 + R, my = opt.mini === 'tl' ? 52 + R : h - 18 - R, k = R / big; g.save(); g.fillStyle = 'rgba(10,8,22,.78)'; g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, R + 2, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(mx, my, R, 0, TAU); g.clip();
    orb.forEach(b => { g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(mx + bx * k, my + by * k * 1, b.a * k, b.a * k * SY, b.om, 0, TAU); g.stroke(); }); pos.forEach(p => { g.fillStyle = p.n === opt.focus ? '#fff' : rgba(OBJ[(list.find(l => l.n === p.n) || prim).idx].c, .95); g.beginPath(); g.arc(mx + p.wx * k, my + p.wy * k, p.n === opt.focus ? 3.4 : 2.2, 0, TAU); g.fill(); });
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(mx + (cam.x - w / 2 / Z) * k, my + (cam.y - h / 2 / Z) * k, w / Z * k, h / Z * k); g.restore();
    return pos;
  }

  // ---- the universe: a gravitational hierarchy. Each quasar you own is a galaxy nucleus; neutron stars and very heavy stars anchor sub-clusters; the rest orbit an anchor or the nucleus.
  // Galaxies orbit the heaviest nucleus on enormous, near-imperceptibly slow ellipses; clusters orbit their nucleus; stars orbit their anchor (T^2 ~ a^3 at every tier). Deterministic from the names.
  const hs2 = n => { let h = 2166136261; for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };   // FNV, then a murmur finaliser: names that differ only in their last character (k+'x', k+'y') now give unrelated numbers, which is what makes arms broad and stars scattered
  // ---- the layout: one fixed, real universe that you light up as you collect. The Milky Way is always home (Sagittarius A* at its centre, drawn
  //      faint until you own it); every star and remnant sits at its measured place in it; every other galaxy lies in its true direction on the
  //      sky, at its distance compressed on a log scale (the real spread, 12 million to 13 billion light-years, would leave all but one a speck).
  //      Nothing moves when something new arrives: collecting only adds lights.
  const GALD = { '3C 273': [12, 29.1, 2.05, 2440], 'TON 618': [12, 28.4, 31.48, 10800], '3C 48': [1, 37.7, 33.16, 3900], 'APM 08279+5255': [8, 31.7, 52.76, 12100], 'Markarian 231': [12, 56.2, 56.87, 581], 'Twin Quasar': [10, 1.3, 55.9, 8700],
    '3C 279': [12, 56.2, -5.79, 5000], 'J0313−1806': [3, 13.7, -18.1, 13030], 'OJ 287': [8, 54.8, 20.11, 3500], 'Messier 87': [12, 30.8, 12.39, 53.5], 'Cygnus A': [19, 59.5, 40.73, 760], 'Centaurus A': [13, 25.5, -43.02, 12],
    'S5 0014+81': [0, 17.1, 81.59, 12100], 'SDSS J0100+2802': [1, 0.2, 28.04, 12800], 'ULAS J1342+0928': [13, 42.1, 9.48, 13100] };   // RA (h, m), Dec (deg), light-travel distance (millions of light-years)
  const LMC = { n: 'Large Magellanic Cloud', ra: [5, 23.6, -69.76], ly: 162000, rly: 7000, stars: ['WOH G64', 'R136a1'] };
  // ---- landmarks: famous places that are simply there, not earned. Nebulae and clusters at their measured positions in the Milky Way, and the
  //      Local Group's galaxies. [RA h, m, Dec deg, distance ly, radius ly, kind, note]
  const LANDS = { 'Orion Nebula': [5, 35.3, -5.39, 1344, 12, 'emission', 'The nearest large star-forming region: a cloud of hydrogen lit by the hot young stars of the Trapezium.'],
    'Carina Nebula': [10, 45.1, -59.87, 7500, 115, 'emission', 'One of the largest star-forming nebulae in the Milky Way, and the home of Eta Carinae.'],
    'Eagle Nebula': [18, 18.8, -13.82, 5700, 35, 'emission', 'Home of the Pillars of Creation: columns of gas and dust where new stars are forming.'],
    'Lagoon Nebula': [18, 3.6, -24.38, 4100, 55, 'emission', 'A vast cloud of glowing hydrogen in Sagittarius, faintly visible to the naked eye.'],
    'Ring Nebula': [18, 53.6, 33.03, 2570, .65, 'planetary', 'A planetary nebula: the outer layers shed by a dying Sun-like star, glowing round the white dwarf it left.'],
    'Helix Nebula': [22, 29.6, -20.84, 655, 1.4, 'planetary', 'One of the nearest planetary nebulae, about three light-years across.'],
    'Pleiades': [3, 47.4, 24.12, 444, 8, 'open', 'A young cluster of hot blue stars drifting through a dusty cloud that scatters their light. Teide 1 lives here.'],
    'Hyades': [4, 27, 15.87, 153, 9, 'open', 'The nearest open cluster to the Sun: the V-shaped face of Taurus.'],
    'Omega Centauri': [13, 26.8, -47.48, 17090, 86, 'globular', 'The largest globular cluster in the Milky Way: about ten million stars, perhaps the core of a swallowed dwarf galaxy.'],
    '47 Tucanae': [0, 24.1, -72.08, 14700, 60, 'globular', 'A dense ball of more than a million old stars, second only to Omega Centauri in brightness.'],
    'Messier 13': [16, 41.7, 36.46, 22200, 72, 'globular', 'The Great Globular Cluster in Hercules: several hundred thousand stars about 12 billion years old.'],
    'Horsehead Nebula': [5, 40.9, -2.46, 1375, 3.5, 'dark', 'A cold cloud of dust shaped like a horse’s head, seen in silhouette against glowing hydrogen behind it.'],
    'Crab Nebula': [5, 34.5, 22.01, 6500, 5.5, 'snr', 'The wreck of a star whose explosion was recorded by astronomers in 1054. Its pulsar still spins 30 times a second at the centre.', 'Crab Pulsar'],
    'Cassiopeia A remnant': [23, 23.4, 58.8, 11000, 5, 'snr', 'The youngest known supernova remnant in the Milky Way, from a star that exploded about 350 years ago, as seen from Earth.', 'Cassiopeia A'],
    'Terzan 5': [17, 48.1, -24.78, 19000, 30, 'globular', 'A dense cluster near the Galactic Centre holding dozens of millisecond pulsars, among them the fastest-spinning known.'] };
  const STRUCT = { 'Galactic bar': [0, 0, 13500, 'A bar of old stars about 27,000 light-years long runs through the centre of the Milky Way, angled about 27 degrees from our line of sight.'],
    'Orion Arm': [-27200, 3400, 5000, 'The Sun’s own neighbourhood: a minor spiral arm, or spur, about 10,000 light-years long, between the Sagittarius and Perseus arms.'] };   // galactocentric x, y (ly; the Sun at x = -26,000), radius, note
  const LOCAL = [{ n: 'Large Magellanic Cloud', ra: [5, 23.6, -69.76], ly: 162000, rly: 7000, note: 'A dwarf galaxy 160,000 light-years away, home to R136a1, the most massive star known, and the hypergiant WOH G64.' },
    { n: 'Small Magellanic Cloud', ra: [0, 52.7, -72.83], ly: 200000, rly: 9500, note: 'A dwarf galaxy 200,000 light-years away, bound to the Large Magellanic Cloud.' },
    { n: 'Andromeda Galaxy', ra: [0, 42.7, 41.27], mly: 2.5, rly: 76000, note: 'The nearest large galaxy, 2.5 million light-years away, set to merge with the Milky Way in about 4.5 billion years.' },
    { n: 'Triangulum Galaxy', ra: [1, 33.9, 30.66], mly: 2.73, rly: 30000, note: 'The third-largest galaxy of the Local Group, after Andromeda and the Milky Way.' }];
  const LANDC = new Map();
  function landSprite(n, kind) {   // baked once: 256 px, drawn additively
    let c = LANDC.get(n); if (c) return c; const S = 256, H = S / 2, sd = hs2(n) * 50; c = mk(S); const x = c.getContext('2d'), im = x.createImageData(S, S), D = im.data;
    if (kind === 'emission' || kind === 'planetary') { for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = (i - H) / H, v = (j - H) / H, r = Math.hypot(u, v); if (r > 1) continue; const k = (j * S + i) * 4, w1 = fbm2(u * 2.2 + sd, v * 2.2, 5), w2 = fbm2(u * 6 + sd + 9, v * 6, 4); let R = 0, G = 0, B = 0;
        if (kind === 'emission') { const env = Math.pow(Math.max(0, 1 - r), 1.4) * sm3(clamp((w1 - .28) / .5)), core = Math.exp(-r * r * 9) * (.6 + .6 * w2), dust = sm3(clamp((fbm2(u * 3.4 - sd, v * 3.4, 4) - .5) / .26)); R = env * 1.1 + core * .55; G = env * .22 + core * .75; B = env * .38 + core * .7; const f = 1 - .55 * dust * sm3(clamp((.95 - r) / .3)); R *= f; G *= f; B *= f; }   // hydrogen-alpha red, doubly ionised oxygen teal near the hot stars, dark lanes of dust
        else { const ue = u, ve = v / .78, re = Math.hypot(ue, ve), rr = re + .07 * (w1 - .5), fil = .65 + .7 * fbm2(Math.atan2(ve, ue) * 3 + sd, re * 9, 3), shell = Math.exp(-Math.pow((rr - .6) / .17, 2)) * fil, inner = Math.exp(-rr * rr * 4.5) * .32 * (.8 + .4 * w2), halo = Math.exp(-Math.pow((rr - .82) / .12, 2)) * .12; R = shell * .62 + inner * .12 + halo * .5; G = shell * .2 + inner * .42 + halo * .15; B = shell * .2 + inner * .5 + halo * .2; }   /* an elliptical shell, filamentary: red nitrogen and hydrogen at the rim, blue-green oxygen within, a faint outer halo */   // a glowing shell: red at the rim, teal-blue inside
        const mxv = Math.max(R, G, B, 1e-4), al = Math.min(1, mxv); D[k] = R / mxv * 255; D[k + 1] = G / mxv * 255; D[k + 2] = B / mxv * 255; D[k + 3] = al * 255; }   // light only: where the nebula is dark, the sky shows through
      x.putImageData(im, 0, 0); if (kind === 'planetary') { const gr = x.createRadialGradient(H, H, 0, H, H, 4); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(H - 4, H - 4, 8, 8); } }
    else if (kind === 'dark') {   // the Horsehead: a dusty pillar and head in silhouette against the glowing edge of a hydrogen cloud, rising from a dark molecular cloud below
      const ell = (u, v, cx, cy, rx, ry, a) => { const c = Math.cos(a), sn = Math.sin(a), dx = u - cx, dy = v - cy, x2 = (dx * c + dy * sn) / rx, y2 = (-dx * sn + dy * c) / ry; return Math.sqrt(x2 * x2 + y2 * y2) - 1; };
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = (i - H) / H, v = (j - H) / H, r = Math.hypot(u, v); if (r > 1) continue; const k = (j * S + i) * 4, w1 = fbm2(u * 3 + sd, v * 3, 5), st = fbm2(u * 9 + sd, v * 1.6, 4), wob = (fbm2(u * 7 - sd, v * 7, 4) - .5) * .09;
        const glow = Math.pow(Math.max(0, 1 - r), .9) * sm3(clamp((.55 - v) / .9)) * (.5 + .35 * st + .3 * w1);   // the ionised sheet, streaked by the radiation of Sigma Orionis above
        const ground = v - (.26 + .06 * Math.sin(u * 5 + sd) + .12 * (w1 - .5)), neck = Math.max(Math.abs(u - .02 - .15 * (v - .26)) - .085, -.12 - v), head = ell(u, v, -.08, -.17, .16, .1, 2.5) * .12, snout = ell(u, v, -.2, -.075, .075, .06, 2.3) * .065, ear = ell(u, v, .03, -.29, .04, .065, -.3) * .05, mane = ell(u, v, .06, -.04, .055, .15, .15) * .06;
        const dist = Math.min(-ground, neck, head, snout, ear, mane) + wob, dust = sm3(clamp(.5 - dist / .025)), rim = Math.exp(-Math.pow(dist / .02, 2)) * .5;   // a soft, ragged edge, faintly rim-lit
        const L2 = glow * (1 - .94 * dust) + rim * glow * 1.4; D[k] = 255; D[k + 1] = 78 + 60 * rim; D[k + 2] = 92 + 40 * rim; D[k + 3] = Math.min(255, L2 * 255); }
      x.putImageData(im, 0, 0); }
    else { const glob = kind === 'globular', N = glob ? 1400 : n === 'Pleiades' ? 70 : 90; if (n === 'Pleiades') { const gr = x.createRadialGradient(H, H, 0, H, H, H); gr.addColorStop(0, 'rgba(110,150,255,.35)'); gr.addColorStop(1, 'rgba(110,150,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S); }   // the Pleiades' blue reflection nebula
      if (glob) { const gr = x.createRadialGradient(H, H, 0, H, H, H * .7); gr.addColorStop(0, 'rgba(255,236,200,.55)'); gr.addColorStop(1, 'rgba(255,236,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S); }
      for (let i = 0; i < N; i++) { const a = hs2(n + 'a' + i) * TAU, q = hs2(n + 'r' + i), r = glob ? H * .95 * q * q * q : H * .9 * Math.sqrt(q), br = hs2(n + 'b' + i), sz = glob ? .6 + br * 1.1 : .8 + Math.pow(br, 3) * 3.2, col = glob ? (br > .9 ? '255,190,130' : '255,240,215') : n === 'Hyades' && br > .85 ? '255,190,120' : '200,220,255';   // globulars: old yellow stars piled to the centre; open clusters: a loose scatter, a few bright
        x.fillStyle = `rgba(${col},${glob ? .5 + .5 * br : .45 + .55 * br})`; x.beginPath(); x.arc(H + Math.cos(a) * r, H + Math.sin(a) * r, sz, 0, TAU); x.fill(); } }
    LANDC.set(n, c); return c;
  }
  // ---- field stars: once every named object of a type is yours, each new one of that type is an unnamed star (or, for quasars, an unnamed galaxy).
  //      Its looks come from a real member of the type, its mass is varied, and it settles somewhere along the Milky Way's arms, as most stars do.
  const FIELDA = { brown: 'Brown_dwarf', reddwarf: 'Red_dwarf', redgiant: 'Red_giant', sun: 'Solar_analog', bluewhite: 'A-type_main-sequence_star', bluegiant: 'Blue_giant', whitedwarf: 'White_dwarf', neutron: 'Neutron_star', quasar: 'Quasar' };
  const FIELDN = /^Unnamed (.+) (\d{3,})$/;
  function field(id, k) { const o = OBJ.find(x => x.id === id), L = POOL[id], h = j => hs2(id + ':' + k + j), q = L[Math.floor(h('t') * L.length)], noun = id === 'quasar' ? 'galaxy' : o.name.toLowerCase();
    return { n: `Unnamed ${noun} ${String(k).padStart(3, '0')}`, id, idx: OBJ.indexOf(o), m: (q.m || 1) * (.7 + .7 * h('m')), t: q.t, kind: id === 'quasar' ? 'Galaxy with an active black hole' : q.kind, f: o.fact, a: FIELDA[id], field: true, count: 1 }; }
  const fieldOf = n => { const m = FIELDN.exec(String(n)); if (!m) return null; const o = OBJ.find(x => x.id === 'quasar' ? m[1] === 'galaxy' : x.name.toLowerCase() === m[1]); return o ? field(o.id, +m[2]) : null; };
  const rec = (id, n) => POOL[id].find(p => p.n === n) || (fieldOf(n) && fieldOf(n).id === id ? fieldOf(n) : null);
  const galR = mly => 14000 * (8 + 10 * Math.log10(Math.max(1, mly / 5)));   // compressed distance in world units: 12 Mly ~ 12 galaxy radii, 13 Gly ~ 42
  function layout(list0) {
    const list = []; list0.forEach(b => { if (b.id === 'quasar' && (b.count || 1) > 1) { list.push({ ...b, count: 1 }); for (let k = 2; k <= Math.min(b.count, 40); k++) list.push({ ...b, n: b.n + '#' + k, base: b.n, count: 1 }); } else list.push(b); });   // a quasar is always the heart of a galaxy, so every extra copy is another galaxy
    const owned = new Set(list.map(x => x.n)), qi = OBJ.findIndex(o => o.id === 'quasar'), bodies = [], idxOf = {}, add = (b, o) => { const e = { ...b, ...o }; idxOf[b.n] = bodies.length; bodies.push(e); return e; };
    const kT = (a, M) => Math.sqrt(Math.pow(a * LYU * 63241, 3) / Math.max(.05, M)) * 3.156e7 /* Kepler: T(yr) = sqrt(a(AU)^3 / M(M☉)), in seconds */, T = a => 30 * Math.pow(a / 300, 1.5), orb = (b, a, k) => ({ a, T: T(a), e: .05 + .3 * hs2(b.n + 'e'), om: hs2(b.n + 'o') * TAU, M0: hs2(b.n + 'm') * TAU, k });
    const rgOf = b => 14000 * (.8 + .14 * clamp(Math.log10(b.m || 1) - 9, 0, 2)), still = { fixed: true, nx: 0, ny: 0, T: 1e30, e: 0, om: 0, M0: 0 };
    // home: the Milky Way, at the origin
    const sgr = list.find(b => b.n === 'Sagittarius A*'), home = add(sgr || { n: 'Sagittarius A*', id: 'quasar', idx: qi, m: 4.3e6, ghost: 'The Milky Way', count: 1 }, { tier: 'nucleus', parent: -1, gal: 0, rg: 14000, a: 0, T: 1, e: 0, om: 0, M0: 0 });
    const hf = gframe(home, 0), hc = Math.cos(hf.rot), hs = Math.sin(hf.rot), rgLy = home.rg * LYU, onMap = (x, y) => [(x * hc - y * hs) * home.rg, (x * hs + y * hc) * home.rg * hf.sy];   // a direction in the galactic plane, turned and tilted as the Milky Way is drawn
    // other galaxies: true direction (galactic longitude, seen from above the disc), compressed distance
    const gals = list.filter(b => b.id === 'quasar' && b !== sgr), gp = [[0, 0]], gl = [home];
    gals.forEach(b => { const base = (b.base || b.n).split('#')[0], q = GALD[base], k = b.base ? +b.n.split('#')[1] : 1; let l, r;
      if (q) { [l] = galLB(q[0], q[1], q[2]); r = galR(q[3]); } else { l = hs2(base + 'gl') * TAU; r = galR(100 * Math.pow(10, 2.1 * hs2(base + 'gd'))); }   // an unnamed galaxy: 100 million to 13 billion light-years
      if (k > 1) { l += k * 2.39996; r *= 1 + .08 * (hs2(b.n + 'gk') - .5); }   // another copy: a sister galaxy at the same distance, a golden angle round the sky
      const [x, y] = onMap(Math.cos(l) * r / home.rg, Math.sin(l) * r / home.rg); gp.push([x, y]); gl.push(b); });
    for (let pass = 0; pass < 12; pass++) for (let i = 1; i < gp.length; i++) for (let j = 0; j < gp.length; j++) { if (i === j) continue; const dx = gp[i][0] - gp[j][0], dy = gp[i][1] - gp[j][1], d = Math.hypot(dx, dy) || 1, mn = 3.6 * 14000; if (d < mn) { const push = (mn - d) * (j ? .5 : 1); gp[i][0] += dx / d * push; gp[i][1] += dy / d * push; } }   // no two discs overlap
    gl.forEach((b, i) => { if (i) add(b, { tier: 'nucleus', parent: 0, gal: i, rg: rgOf(b), px: gp[i][0], py: gp[i][1], a: Math.hypot(gp[i][0], gp[i][1]), ...still }); });
    // the Local Group, always there: the Magellanic Clouds at their true distance, Andromeda and Triangulum on the compressed scale like other galaxies
    let lmc = -1; LOCAL.forEach(G => { const [l, bb] = galLB(...G.ra); let x, y; if (G.ly) { const d = G.ly * Math.cos(bb); [x, y] = onMap((-R0LY + d * Math.cos(l)) / rgLy, d * Math.sin(l) / rgLy); } else { const r = 14000 * (G.n === 'Triangulum Galaxy' ? 9 : 7.4); /* the Local Group: nearer than any other galaxy, spaced so the discs stay apart */ [x, y] = onMap(Math.cos(l) * r / home.rg, Math.sin(l) * r / home.rg); }
      if (G.n === 'Large Magellanic Cloud') lmc = bodies.length; add({ n: G.n, id: 'quasar', idx: qi, m: 1, ghost: G.n, note: G.note, dly: G.ly || G.mly * 1e6, count: 1 }, { tier: 'nucleus', parent: 0, gal: bodies.length, rg: G.rly / LYU, px: x, py: y, a: Math.hypot(x, y), ...still }); });
    // nebulae and clusters, at their measured places in the Milky Way
    for (const [n, q] of Object.entries(LANDS)) { if (q[7] && owned.has(q[7])) continue; const [l, bb] = galLB(q[0], q[1], q[2]), d = q[3]; add({ n, id: 'landmark', idx: qi, ghost: n, land: q[5], src: q[7], note: q[6], dly: d, rly: q[4], count: 1 }, { tier: 'landmark', parent: 0, gal: 0, real: [(-R0LY + d * Math.cos(bb) * Math.cos(l)) / rgLy, (d * Math.cos(bb) * Math.sin(l)) / rgLy], a: 0, T: 1, e: 0, om: 0, M0: 0 }); }
    for (const [n, q] of Object.entries(STRUCT)) add({ n, id: 'landmark', idx: qi, ghost: n, land: 'struct', note: q[3], dly: n === 'Orion Arm' ? 0 : Math.hypot(q[0] + R0LY, q[1]), rly: q[2], count: 1 }, { tier: 'landmark', parent: 0, gal: 0, real: [q[0] / rgLy, q[1] / rgLy], a: 0, T: 1, e: 0, om: 0, M0: 0 });   // named structures of the Milky Way itself
    // stars and remnants: each at its measured place; a companion orbits its partner when you own both
    const stars = list.filter(b => b.id !== 'quasar').sort((x, y) => (y.m || 1) - (x.m || 1) || (x.n < y.n ? -1 : 1)), comps = stars.filter(b => b.comp && owned.has(b.comp)), loose = stars.filter(b => !comps.includes(b));
    loose.forEach(b => { const tier = b.id === 'neutron' || (b.m || 0) >= 8 ? 'anchor' : 'member', q = NEAR[b.n];
      if (lmc >= 0 && LMC.stars.includes(b.n)) { add(b, { tier, parent: lmc, gal: bodies[lmc].gal, arm: true, ...orb(b, 3000) }); return; }
      if (q) { const [l, bb] = q[3] ? galLB(q[0], q[1], q[2]) : [0, 0], d = q[3]; add(b, { tier, parent: 0, gal: 0, real: [(-R0LY + d * Math.cos(bb) * Math.cos(l)) / rgLy, (d * Math.cos(bb) * Math.sin(l)) / rgLy], a: 0, T: 1, e: 0, om: 0, M0: 0 }); return; }
      add(b, { tier, parent: 0, gal: 0, arm: true, ...orb(b, 3000 + 4000 * hs2(b.n + 'ra')) }); });   // no measured place: somewhere along the Milky Way's arms
    const kC = {}; comps.forEach(b => { const par = idxOf[b.comp]; if (par == null) return; const j = kC[par] = (kC[par] || 0) + 1, a = 2e-4 * (1 + .6 * (j - 1)) * (1 + .1 * hs2(b.n + 'a')); add(b, { tier: 'member', parent: par, gal: bodies[par].gal, ...orb(b, a), T: kT(a, (bodies[par].m || 1) + (b.m || 1)) }); });   // companions orbit their real partner tens of AU away, over decades
    bodies.forEach(b => { if (b.comp && b.parent >= 0 && bodies[b.parent].real) b.home = true; });   // a real star's companions are real too: their copies scatter like its own
    // extents: how far each body's own system reaches (for framing and for the galaxy glow)
    const ext = bodies.map(() => 0); for (let i = bodies.length - 1; i >= 0; i--) { const b = bodies[i]; b.reach = ext[i]; if (b.parent >= 0 && b.tier !== 'nucleus' && !b.real && !b.arm) ext[b.parent] = Math.max(ext[b.parent], b.a * (1 + b.e) + b.reach); }
    bodies.forEach((b, i) => { b.reach = b.tier === 'nucleus' ? b.rg / 1.15 : ext[i]; let g = i; while (bodies[g].tier !== 'nucleus') g = bodies[g].parent; b.gi = g; });
    const dist = i => { const b = bodies[i]; if (b.parent < 0) return 0; if (b.real || b.arm) return dist(b.gi) + bodies[b.gi].rg; if (b.fixed) return Math.hypot(b.px, b.py); return dist(b.parent) + b.a * (1 + b.e); };
    const R = Math.max(380, ...bodies.map((b, i) => dist(i) + (b.tier === 'nucleus' ? b.rg : 0)));
    return { bodies, idxOf, R, home: 0 };
  }
  function lineage(lay, n) { const out = []; let i = lay.idxOf[n]; while (i != null && i >= 0) { const b = lay.bodies[i]; out.unshift(b); if (b.tier === 'nucleus') break; i = b.parent; } return out; }
  function kepAt(b, PH, ph) { const E = kepler(b.M0 + (ph != null ? ph : PH * TAU / b.T), b.e), x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om); return [x * c - y * s, x * s + y * c]; }
  // galaxy frame: every body that lives in a galaxy's arms is placed from its name onto the same spiral the picture draws, so stars line up with the arms and turn with them
  const INCL = { 'Andromeda Galaxy': [.24, 2.5], 'Triangulum Galaxy': [.58, .4], 'Large Magellanic Cloud': [.82, 0], 'Small Magellanic Cloud': [.6, .8] };   // real tilts (cosine of the inclination) and position angles
  const gframe = (gb, ang) => { const q = INCL[String(gb.n).split('#')[0]]; return { rot: (q ? q[1] : hs2(gb.n + 'r0') * TAU) + ang * (hs2(gb.n + 'd') > .5 ? 1 : -1), sy: q ? q[0] : .4 + .46 * hs2(gb.n + 'inc') }; };
  function armUnit(gb, name) {
    const { arms, wind, type } = gparams(gb), h = k => hs2(name + k); let u = .1 + .86 * Math.pow(h('au'), .85), th;
    if (type === 'ell') { u = .05 + .85 * Math.pow(h('au'), 1.3); th = h('at') * TAU; } else if (type === 'ring') { u = h('ar') > .7 ? .12 + .3 * h('au') : .5 + .12 * (h('au') - .5); th = h('at') * TAU; }
    else { const arm = Math.floor(h('aa') * arms), sc = (h('ax') + h('ay') - 1) * (.26 - .1 * u); th = arm * TAU / arms + wind * u * 1.7 + sc + gparams(gb).ph0; }
    return [u * Math.cos(th), u * Math.sin(th)];
  }
  const OMP = TAU / 7.9e15;   // the spiral pattern turns once in about 250 million years
  function armW(gb, gW, name, PH) { const f = gframe(gb, PH); let [x, y] = armUnit(gb, name); const r = Math.hypot(x, y), rly = Math.max(1, r * gb.rg * LYU), v = 220 * (1 - Math.exp(-rly / 3000)), om = v / (rly * 9.4607e12), d = (om - OMP) * (PH / OMP) * (hs2(gb.n + 'd') > .5 ? 1 : -1);   // a flat rotation curve: inner stars lap the pattern, outer ones fall behind
    if (d) { const cd = Math.cos(d), sd = Math.sin(d); [x, y] = [x * cd - y * sd, x * sd + y * cd]; } const c = Math.cos(f.rot), sn = Math.sin(f.rot); return [gW[0] + (x * c - y * sn) * gb.rg, gW[1] + (x * sn + y * c) * gb.rg * f.sy, 0]; }
  const RREAL = { 'Gliese 229 B': .1, 'Luhman 16': .1, 'WISE 0855−0714': .1, 'Epsilon Indi B': .09, 'Teide 1': .3, 'Proxima Centauri': .154, 'Barnard’s Star': .196, 'TRAPPIST-1': .119, 'Wolf 359': .16, 'Ross 128': .197, 'Lalande 21185': .39, 'Teegarden’s Star': .107, 'AU Microscopii': .75, 'Gliese 229 A': .58, 'Gliese 581': .3, 'Gliese 876': .37, 'Luyten’s Star': .35, 'Kapteyn’s Star': .29, 'Lacaille 9352': .47, 'Wolf 1061': .31, 'LHS 1140': .21, 'YZ Ceti': .16,
    'Betelgeuse': 764, 'Arcturus': 25.4, 'Aldebaran': 44.2, 'Antares': 680, 'Pollux': 9.1, 'Mira': 332, 'Gacrux': 84, 'VY Canis Majoris': 1420, 'UY Scuti': 909, 'WOH G64': 1540, 'Mu Cephei': 972, 'Rasalgethi': 284, 'R Doradus': 298, 'L2 Puppis': 123, 'Hamal': 14.9, 'Alphard': 50.5,
    'The Sun': 1, 'Alpha Centauri A': 1.22, 'Tau Ceti': .79, '51 Pegasi': 1.15, 'Beta Hydri': 1.81, '18 Scorpii': 1.02, 'HD 209458': 1.2, 'Kepler-452': 1.11, 'Procyon A': 2.05, '40 Eridani A': .81, 'Alpha Centauri B': .86, '55 Cancri': .94, 'Epsilon Eridani': .74, 'Epsilon Indi A': .71, '61 Cygni': .67, 'Kepler-22': .98, 'HD 189733': .76, 'Capella': 11.9, 'Polaris': 37.5, 'Delta Cephei': 44.5,
    'Sirius A': 1.71, 'Vega': 2.36, 'Regulus': 4.35, 'Fomalhaut': 1.84, 'Altair': 1.79, 'Castor': 2.4, 'Denebola': 1.73, 'Achernar': 7.3, 'Algol': 2.73, 'Deneb': 203, 'Alderamin': 2.3, 'Merak': 3, 'Alioth': 4.1, 'Rasalhague': 2.6, 'Beta Pictoris': 1.5, 'HR 8799': 1.44,
    'Spica': 7.47, 'Bellatrix': 5.75, 'Mimosa': 8.4, 'Rigel': 78.9, 'Alnilam': 42, 'Alnitak': 20, 'Mintaka': 16.5, 'Adhara': 13.9, 'Acrux': 7.8, 'Zeta Ophiuchi': 8.5, 'Naos': 14, 'Eta Carinae': 240, 'R136a1': 39, 'Saiph': 22.2, 'Meissa': 10, 'Hadar': 8.6,
    'Sirius B': .0084, 'Procyon B': .012, '40 Eridani B': .014, 'van Maanen’s Star': .011, 'WD 1856+534': .013 };   // published radii in solar radii; anything missing falls back to the type's mass-radius relation
  const RSUN = (b) => { const nm = String(b.n || '').split('#')[0]; if (RREAL[nm] != null) return RREAL[nm]; const m = Math.max(b.m || 1, .01); switch (b.id) { case 'brown': return .09 + .015 * hs2(b.n + 'rs'); case 'reddwarf': return .12 + .45 * Math.min(m, .6); case 'redgiant': return 40 * Math.pow(m, 1.1); case 'sun': return Math.pow(m, .8); case 'bluewhite': return 1.6 * Math.pow(m, .7); case 'bluegiant': return 4 * Math.pow(m, .6); case 'whitedwarf': return .0125; case 'neutron': return 1.72e-5; default: return 1; } };   // radius in solar radii, so the sizes you see keep their real order (compressed to a power of .45 to stay drawable)
  const LYU = 3.6, RSU = 7.36e-8 / LYU, AUU = 1.581e-5 / LYU;   // world units: one unit is 3.6 light-years, so a galaxy of 14,000 units is about 50,000 ly in radius; a solar radius and an AU in the same units
  const TDEF = { brown: 1100, reddwarf: 3200, redgiant: 3600, sun: 5800, bluewhite: 9500, bluegiant: 22000, whitedwarf: 24000, neutron: 600000, quasar: 1e6 };
  const tempOf = b => { const v = Number(String(b.t || '').replace(/[^0-9.]/g, '')); return v > 100 && v < 2e5 && !/million/i.test(b.t || '') ? v : TDEF[b.id] || 5800; };
  const bbHex = T => { const t = T / 100; let r, g, bl; if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; bl = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; } else { r = 329.7 * Math.pow(t - 60, -.1332); g = 288.12 * Math.pow(t - 60, -.0755); bl = 255; } const c = v => Math.round(clamp(v, 0, 255)); return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(bl)).toString(16).slice(1); };   // blackbody colour of a temperature
  const physR = b => b.id === 'quasar' ? 4.24e-6 * (b.m || 1e9) : RSUN(b);   // solar radii; for a quasar the black hole's event horizon (Schwarzschild radius)
  const lumOf = b => Math.pow(RSUN(b), 2) * Math.pow(tempOf(b) / 5772, 4);

  // ---- the real neighbourhood: right ascension (h, m), declination (deg) and distance (ly) for every catalogue star near enough to place for real.
  //      They are put in the home galaxy (the Milky Way when you own Sagittarius A*) at their true 3D positions around the Sun, 26,000 ly from the centre.
  const NEAR = { 'The Sun': [0, 0, 0, 0], 'Proxima Centauri': [14, 29.7, -62.68, 4.24], 'Alpha Centauri A': [14, 39.6, -60.83, 4.37], 'Alpha Centauri B': [14, 39.6, -60.84, 4.37], 'Barnard’s Star': [17, 57.8, 4.69, 5.96], 'Luhman 16': [10, 49.3, -53.32, 6.5], 'WISE 0855−0714': [8, 55.2, -7.24, 7.4],
    'Wolf 359': [10, 56.5, 7.01, 7.86], 'Lalande 21185': [11, 3.3, 35.97, 8.31], 'Sirius A': [6, 45.1, -16.72, 8.6], 'Epsilon Eridani': [3, 32.9, -9.46, 10.5], 'Lacaille 9352': [23, 5.9, -35.85, 10.7], 'Ross 128': [11, 47.7, .8, 11.0], '61 Cygni': [21, 6.9, 38.75, 11.4], 'Procyon A': [7, 39.3, 5.22, 11.5],
    'Epsilon Indi A': [22, 3.4, -56.79, 11.9], 'Tau Ceti': [1, 44.1, -15.94, 11.9], 'YZ Ceti': [1, 12.5, -16.99, 12.1], 'Luyten’s Star': [7, 27.4, 5.23, 12.4], 'Teegarden’s Star': [2, 53, 16.88, 12.5], 'Kapteyn’s Star': [5, 11.7, -45.02, 12.8], 'SCR 1845−6357 A': [18, 45.1, -63.96, 13.1], 'Wolf 1061': [16, 30.3, -12.67, 14.0],
    'van Maanen’s Star': [0, 49.2, 5.39, 14.1], 'Gliese 440': [11, 45.7, -64.84, 15.1], 'Gliese 876': [22, 53.3, -14.26, 15.2], '40 Eridani A': [4, 15.3, -7.65, 16.3], 'Altair': [19, 50.8, 8.87, 16.7], 'Stein 2051 A': [4, 31.2, 58.98, 18.0], 'Gliese 229 A': [6, 10.6, -21.86, 18.8], 'Gliese 570 D': [14, 57.5, -21.4, 19.2],
    'Gliese 581': [15, 19.4, -7.72, 20.5], 'Beta Hydri': [0, 25.8, -77.25, 24.3], 'Vega': [18, 36.9, 38.78, 25], 'Fomalhaut': [22, 57.6, -29.62, 25.1], 'AU Microscopii': [20, 45.2, -31.34, 32.3], 'Gliese 569 A': [14, 54.5, 16.1, 32], 'Pollux': [7, 45.3, 28.03, 33.8], 'Denebola': [11, 49.1, 14.57, 35.9], 'Arcturus': [14, 15.7, 19.18, 36.7],
    'TRAPPIST-1': [23, 6.5, -5.04, 40.7], '55 Cancri': [8, 52.6, 28.33, 41], 'Capella': [5, 16.7, 45.99, 42.9], '18 Scorpii': [16, 15.6, -8.37, 46.3], 'Rasalhague': [17, 34.9, 12.56, 48.6], 'LHS 1140': [0, 45, -15.27, 48.9], 'Alderamin': [21, 18.6, 62.59, 49], '51 Pegasi': [22, 57.5, 20.77, 50.6], 'Castor': [7, 34.6, 31.89, 51],
    'Beta Pictoris': [5, 47.3, -51.07, 63], 'HD 189733': [20, .7, 22.71, 64.5], 'Aldebaran': [4, 35.9, 16.51, 65], 'Hamal': [2, 7.2, 23.46, 66], 'Regulus': [10, 8.4, 11.97, 79], 'Merak': [11, 1.9, 56.38, 79.7], 'Alioth': [12, 54, 55.96, 83], 'Gacrux': [12, 31.2, -57.11, 88.6], 'Algol': [3, 8.2, 40.96, 90],
    'HR 8799': [23, 7.5, 21.13, 133], 'Achernar': [1, 37.7, -57.24, 139], 'HD 209458': [22, 3.2, 18.88, 159], 'Alphard': [9, 27.6, -8.66, 177], 'R Doradus': [4, 36.8, -62.08, 178], 'L2 Puppis': [7, 13.5, -44.65, 210], 'Spica': [13, 25.2, -11.16, 250], 'Bellatrix': [5, 25.1, 6.35, 250], 'Mimosa': [12, 47.7, -59.69, 280],
    'Mira': [2, 19.3, -2.98, 300], 'Acrux': [12, 26.6, -63.1, 320], 'Rasalgethi': [17, 14.6, 14.39, 360], 'Hadar': [14, 3.8, -60.37, 390], 'RX J1856.5−3754': [18, 56.6, -37.91, 400], 'Polaris': [2, 31.8, 89.26, 433], 'Adhara': [6, 58.6, -28.97, 430], 'Zeta Ophiuchi': [16, 37.2, -10.57, 440],
    'Betelgeuse': [5, 55.2, 7.41, 548], 'Antares': [16, 29.4, -26.43, 550], 'Saiph': [5, 47.8, -9.67, 650], 'Geminga': [6, 33.9, 17.77, 815], 'Rigel': [5, 14.5, -8.2, 860], 'Delta Cephei': [22, 29.2, 58.42, 887], 'Vela Pulsar': [8, 35.3, -45.18, 940], 'Naos': [8, 3.6, -40, 1080], 'Meissa': [5, 35.1, 9.93, 1100],
    'Mintaka': [5, 32, -.3, 1200], 'Alnitak': [5, 40.8, -1.94, 1260], 'Alnilam': [5, 36.2, -1.2, 2000], 'Deneb': [20, 41.4, 45.28, 2600], 'Mu Cephei': [21, 43.5, 58.78, 3000], 'VY Canis Majoris': [7, 23, -25.77, 3900], 'UY Scuti': [18, 27.6, -12.46, 5900], 'Crab Pulsar': [5, 34.5, 22.01, 6500],
    'Eta Carinae': [10, 45.1, -59.68, 7500], 'Cassiopeia A': [23, 23.4, 58.8, 11000], 'Kepler-22': [19, 16.9, 47.88, 640], 'Kepler-452': [19, 44, 44.28, 1800], 'PSR B1257+12': [13, 0, 12.68, 2300], 'WD 1856+534': [18, 57.7, 53.51, 82], 'Sirius B': [6, 45.1, -16.72, 8.6], 'Procyon B': [7, 39.3, 5.22, 11.5], '40 Eridani B': [4, 15.3, -7.65, 16.3],
    'Gliese 229 B': [6, 10.6, -21.86, 18.8], 'Epsilon Indi B': [22, 4.2, -56.78, 11.9], 'Teide 1': [3, 47.3, 24.36, 440], 'SCR 1845−6357 B': [18, 45.1, -63.96, 13.1], 'Gliese 569 B': [14, 54.5, 16.1, 32], 'LP 944-20': [3, 39.6, -35.43, 21], 'WISE 1828+2650': [18, 28.5, 26.84, 32],
    'PSO J318.5−22': [21, 14.1, -22.86, 72], '2M1207': [12, 7.6, -39.54, 211], 'HD 130948 BC': [14, 50.3, 23.91, 59], 'HD 130948 A': [14, 50.3, 23.91, 59], 'Stein 2051 B': [4, 31.2, 58.98, 18.0], 'G 29-38': [23, 28.8, 5.25, 57], 'BPM 37093': [12, 38.8, -49.8, 48],
    'PG 1159−035': [12, 1.8, -3.75, 2600], 'IK Pegasi B': [21, 26.4, 19.38, 154], 'WD 0137−349': [1, 39.7, -34.71, 330], 'WD 1145+017': [11, 48.6, 1.48, 570], 'PSR B1919+21': [19, 21.7, 21.88, 2300], 'PSR B1913+16': [19, 15.5, 16.1, 21000], 'PSR J0737−3039': [7, 37.9, -30.66, 3800],
    'SGR 1806−20': [18, 8.7, -20.41, 42000], 'PSR J0348+0432': [3, 48.7, 4.54, 6800], 'PSR J1748−2446ad': [17, 48.1, -24.77, 19000], 'PSR J0952−0607': [9, 52.1, -6.13, 20000], 'PSR J1614−2230': [16, 14.6, -22.5, 2200], 'SGR 1935+2154': [19, 34.9, 21.9, 30000],
    'WOH G64': [4, 55.2, -68.33, 160000], 'R136a1': [5, 38.7, -69.1, 163000] };
  const D2R = Math.PI / 180, R0LY = 26000;
  const galLB = (h, m, dec) => { const a = (h + m / 60) * 15 * D2R, d = dec * D2R, aG = 192.85948 * D2R, dG = 27.12825 * D2R, lN = 122.93192 * D2R, b = Math.asin(Math.sin(d) * Math.sin(dG) + Math.cos(d) * Math.cos(dG) * Math.cos(a - aG)), l = lN - Math.atan2(Math.cos(d) * Math.sin(a - aG), Math.sin(d) * Math.cos(dG) - Math.cos(d) * Math.sin(dG) * Math.cos(a - aG)); return [l, b]; };   // equatorial -> galactic coordinates
  // ---- planets: [name, radius (Earth radii), orbit (AU), period (days), look]. Only confirmed planets; a host's copies have none (the planets belong to the real star)
  const PLANETS = {
    'The Sun': [['Mercury', .383, .387, 88, 'mercury'], ['Venus', .949, .723, 224.7, 'venus'], ['Earth', 1, 1, 365.25, 'earth'], ['Mars', .532, 1.524, 687, 'mars'], ['Jupiter', 11.21, 5.203, 4333, 'jupiter'], ['Saturn', 9.45, 9.537, 10759, 'saturn'], ['Uranus', 4.01, 19.19, 30687, 'uranus'], ['Neptune', 3.88, 30.07, 60190, 'neptune']],
    'TRAPPIST-1': [['TRAPPIST-1 b', 1.116, .01154, 1.51, 'lava'], ['TRAPPIST-1 c', 1.097, .0158, 2.42, 'venus'], ['TRAPPIST-1 d', .788, .02227, 4.05, 'rock'], ['TRAPPIST-1 e', .92, .02925, 6.1, 'ocean'], ['TRAPPIST-1 f', 1.045, .03849, 9.21, 'ice'], ['TRAPPIST-1 g', 1.129, .04683, 12.35, 'ice'], ['TRAPPIST-1 h', .755, .06189, 18.77, 'ice']],
    'Proxima Centauri': [['Proxima d', .81, .02885, 5.12, 'rock'], ['Proxima b', 1.07, .0485, 11.19, 'ocean']], 'Ross 128': [['Ross 128 b', 1.1, .0496, 9.87, 'rock']], 'Teegarden’s Star': [['Teegarden b', 1.02, .0252, 4.91, 'ocean'], ['Teegarden c', 1.03, .0444, 11.4, 'ice']],
    'LHS 1140': [['LHS 1140 b', 1.73, .0946, 24.7, 'ocean']], 'Gliese 581': [['Gliese 581 e', 1.15, .0285, 3.15, 'lava'], ['Gliese 581 b', 4.3, .041, 5.37, 'neptune'], ['Gliese 581 c', 1.5, .073, 12.9, 'venus']], 'Gliese 876': [['Gliese 876 d', 1.7, .021, 1.94, 'lava'], ['Gliese 876 c', 10.5, .13, 30.1, 'gas'], ['Gliese 876 b', 11, .208, 61.1, 'gas'], ['Gliese 876 e', 3.9, .336, 124, 'neptune']],
    'AU Microscopii': [['AU Mic b', 4.2, .0645, 8.46, 'ice'], ['AU Mic c', 3.2, .1101, 18.86, 'ice']], '51 Pegasi': [['51 Pegasi b', 13.4, .0527, 4.23, 'hot']], 'HD 209458': [['Osiris (HD 209458 b)', 15.6, .0471, 3.52, 'hot']], 'HD 189733': [['HD 189733 b', 12.7, .031, 2.22, 'hotblue']],
    '55 Cancri': [['Janssen (55 Cnc e)', 1.88, .01544, .737, 'lava'], ['Galileo (55 Cnc b)', 11.5, .1134, 14.65, 'gas'], ['Brahe (55 Cnc c)', 6, .2373, 44.4, 'ice'], ['Harriot (55 Cnc f)', 6.5, .7708, 260.9, 'ice'], ['Lipperhey (55 Cnc d)', 11.2, 5.957, 4825, 'gas']],
    'Kepler-22': [['Kepler-22 b', 2.1, .849, 289.9, 'ocean']], 'Kepler-452': [['Kepler-452 b', 1.6, 1.046, 384.8, 'super']], 'Epsilon Eridani': [['AEgir (Eps Eri b)', 11.2, 3.48, 2692, 'gas']], 'Epsilon Indi A': [['Epsilon Indi Ab', 11.2, 11.6, 16400, 'gas']],
    'Beta Pictoris': [['Beta Pic c', 13, 2.7, 1200, 'gas'], ['Beta Pic b', 16, 9.9, 8400, 'gas']], 'HR 8799': [['HR 8799 e', 13, 16.4, 16400, 'gas'], ['HR 8799 d', 13, 27, 36500, 'gas'], ['HR 8799 c', 13, 41, 69000, 'gas'], ['HR 8799 b', 13, 68, 168000, 'gas']],
    'Barnard’s Star': [['Barnard d', .69, .0181, 2.34, 'lava'], ['Barnard b', .72, .0221, 3.15, 'lava'], ['Barnard c', .75, .0264, 4.12, 'mercury'], ['Barnard e', .64, .0366, 6.74, 'rock']],
    'Lalande 21185': [['Lalande 21185 b', 1.31, .0789, 12.95, 'venus'], ['Lalande 21185 c', 3.8, 2.94, 2946, 'neptune']], 'Luyten’s Star': [['Luyten c', 1.05, .0365, 4.72, 'rock'], ['Luyten b', 1.33, .0911, 18.65, 'ocean']],
    'Wolf 1061': [['Wolf 1061 b', 1.19, .0357, 4.58, 'lava'], ['Wolf 1061 c', 1.39, .089, 17.9, 'super'], ['Wolf 1061 d', 2.6, .468, 217, 'ice']], 'YZ Ceti': [['YZ Ceti b', .91, .0158, 2.02, 'lava'], ['YZ Ceti c', 1.04, .0209, 3.06, 'mercury'], ['YZ Ceti d', 1.02, .0277, 4.66, 'rock']],
    'Lacaille 9352': [['Lacaille 9352 b', 1.47, .068, 9.26, 'desert'], ['Lacaille 9352 c', 2.3, .1204, 21.8, 'super']], 'Pollux': [['Thestias (Pollux b)', 12.3, 1.70, 589.6, 'gas']],
    'PSR B1257+12': [['Draugr (A)', .3, .19, 25.3, 'rock'], ['Poltergeist (B)', 1.5, .36, 66.5, 'rock'], ['Phobetor (C)', 1.5, .46, 98.2, 'rock']], 'WD 1856+534': [['WD 1856 b', 10.4, .0204, 1.41, 'gas']], 'Tau Ceti': [] };
  // moons of the Solar System: [name, radius (km), orbit (km), period (days), look]
  const MOONS = { 'Earth': [['The Moon', 1737, 384400, 27.32, 'moon']], 'Mars': [['Phobos', 11, 9376, .319, 'moon'], ['Deimos', 6, 23460, 1.263, 'moon']],
    'Jupiter': [['Io', 1822, 421700, 1.769, 'io'], ['Europa', 1561, 671034, 3.551, 'europa'], ['Ganymede', 2634, 1070412, 7.155, 'ganymede'], ['Callisto', 2410, 1882709, 16.69, 'callisto']],
    'Saturn': [['Mimas', 198, 185539, .942, 'snow'], ['Enceladus', 252, 237948, 1.37, 'snow'], ['Tethys', 531, 294619, 1.888, 'snow'], ['Dione', 561, 377396, 2.737, 'snow'], ['Rhea', 764, 527108, 4.518, 'snow'], ['Titan', 2575, 1221870, 15.95, 'titan'], ['Iapetus', 735, 3560820, 79.32, 'iapetus']],
    'Uranus': [['Miranda', 236, 129390, 1.413, 'snow'], ['Ariel', 579, 191020, 2.52, 'snow'], ['Umbriel', 585, 266000, 4.144, 'callisto'], ['Titania', 789, 435910, 8.706, 'snow'], ['Oberon', 761, 583520, 13.46, 'callisto']], 'Neptune': [['Triton', 1353, 354759, -5.877, 'triton']] };
  // small-body belts around the Sun: [inner AU, outer AU, count, look]
  const BELTS = { 'The Sun': [['Asteroid belt', 2.1, 3.3, 2400, [196, 176, 150], .03], ['Kuiper belt', 30, 50, 2600, [150, 166, 196], .06], ['Oort cloud', 2000, 100000, 3200, [150, 170, 210], 1]] };
  const BELTPTS = new Map();
  function beltPts(key, a0, a1, n, th) { let p = BELTPTS.get(key); if (p) return p; p = new Float32Array(n * 4); for (let i = 0; i < n; i++) { const u = h3(i, 3, key.length), a = th === 1 ? a0 * Math.pow(a1 / a0, Math.pow(h3(i, 5, 2), .7)) : a0 + (a1 - a0) * (u * .6 + h3(i, 7, 1) * .4), ang = h3(i, 11, 4) * TAU, z = th === 1 ? (h3(i, 13, 9) * 2 - 1) : (h3(i, 13, 9) - .5) * th * 2; p[i * 4] = a; p[i * 4 + 1] = ang; p[i * 4 + 2] = z; p[i * 4 + 3] = h3(i, 17, 3); } BELTPTS.set(key, p); return p; }
  function drawBelts(g, nm, x, y, au, rot, fy, K, w, h, labels) {   // every asteroid and comet nucleus is a point on its own Kepler orbit; the Oort cloud is a sphere, so it is drawn as a round swarm
    const bl = BELTS[nm]; if (!bl) return; const c = Math.cos(rot), s2 = Math.sin(rot);
    for (const [bn, a0, a1, n, col, th] of bl) { const rr = a1 * au; if (rr < 20 * K || a0 * au > Math.hypot(w, h) * 3) continue; const pts = beltPts(bn, a0, a1, n, th), vis = Math.min(1, (rr - 20 * K) / (120 * K)), sph = th === 1;
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(sph ? .35 : .55) * vis})`; g.beginPath(); const sz = Math.max(.6, .8 * K);
      for (let i = 0; i < n; i++) { const a = pts[i * 4], M = pts[i * 4 + 1] + TAU * SIMT / (Math.pow(a, 1.5) * 3.156e7), ox = Math.cos(M) * a * au, oy0 = Math.sin(M) * a * au, z = pts[i * 4 + 2];
        let px, py; if (sph) { const r = a * au, ph = Math.acos(z), th2 = pts[i * 4 + 1]; px = x + r * Math.sin(ph) * Math.cos(th2); py = y + r * Math.sin(ph) * Math.sin(th2) * .9; } else { const oy = oy0 * fy + z * a * au * .3; px = x + ox * c - oy * s2; py = y + ox * s2 + oy * c; }
        if (px < -2 || px > w + 2 || py < -2 || py > h + 2) continue; const q = sz * (.6 + .8 * pts[i * 4 + 3]); g.rect(px - q / 2, py - q / 2, q, q); }
      g.fill();
      if (labels && PREF.on && rr > 60 * K && a0 * au < Math.max(w, h)) { const la = sph ? -.9 : 2.2, lr = (a0 + a1) / 2 * au * (sph ? .55 : 1), lx = x + Math.cos(la) * lr, ly = y + Math.sin(la) * lr * (sph ? .9 : fy); labels.push({ lbl: { text: bn, x: lx, y: ly, size: 12 * K, color: `rgba(${col[0]},${col[1]},${col[2]},.85)` }, pr: 3, m: 0 }); } }
  }
  const DEBRIS = { 'Fomalhaut': [133, 143, 'rgba(210,190,170,'], 'Beta Pictoris': [20, 130, 'rgba(220,200,180,'], 'Epsilon Eridani': [60, 70, 'rgba(200,190,180,'], 'Vega': [80, 200, 'rgba(190,200,230,'], 'HR 8799': [90, 300, 'rgba(200,190,175,'] };   // dust and comet belts (the Sun's is the Kuiper belt)
  const PCOL = { mercury: ['#8c8580', '#5e5852'], venus: ['#e8d6a6', '#c9b07a'], earth: ['#2f6fb8', '#e9eef6'], mars: ['#c1663f', '#7a3a22'], jupiter: ['#e6cfae', '#a8774f'], saturn: ['#e9d9a8', '#b8975c'], uranus: ['#b8e3ea', '#8cc7d2'], neptune: ['#4569d6', '#2b46a8'],
    rock: ['#8a7a6c', '#4a3f36'], lava: ['#2a1a16', '#ff6a2a'], ocean: ['#3d6f9e', '#d8e4ee'], ice: ['#a9c7d8', '#6c8fa8'], super: ['#7d8a6a', '#4a5440'], gas: ['#d8c39a', '#9a7450'], hot: ['#5a3a3a', '#d28a5a'], hotblue: ['#2a4c9c', '#7aa0e8'] };
  // ---- planets, rendered as lit spheres. Surfaces are sampled from 3D noise on the sphere itself (no seams, no pinched poles), stored once as albedo,
  //      specular and emission maps, then lit per pixel for the direction of their star: soft terminator, ocean glint, a scattering rim, glowing night-side lava.
  const h3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441); h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const n3 = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w2 = fz * fz * (3 - 2 * fz), L = (a, b2, t) => a + (b2 - a) * t;
    return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v), L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w2); };
  const f3 = (x, y, z, o = 5) => { let s2 = 0, a = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { s2 += a * n3(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 5.7); t += a; a *= .5; f *= 2.03; } return s2 / t; };
  const r3 = (x, y, z, o = 5) => { let s2 = 0, a = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { s2 += a * (1 - Math.abs(2 * n3(x * f + i * 11.1, y * f + i * 3.3, z * f - i * 7.7) - 1)); t += a; a *= .5; f *= 2.1; } return s2 / t; };   // ridged: cracks and mountain chains
  const cell3 = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let d1 = 9, id = 0; for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = xi + i, cy = yi + j, cz = zi + k, px = cx + h3(cx, cy, cz), py = cy + h3(cx + 7, cy, cz), pz = cz + h3(cx, cy + 7, cz), d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2; if (d < d1) { d1 = d; id = h3(cx, cy, cz + 9); } } return [Math.sqrt(d1), id]; };
  const sstep = (a, b2, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b2 - a))); return t * t * (3 - 2 * t); };
  const mx3 = (a, b2, t) => [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t];
  const ramp3 = (st, t) => { t = Math.max(0, Math.min(1, t)); let i = 1; while (i < st.length - 1 && t > st[i][0]) i++; const [a, ca] = st[i - 1], [b2, cb] = st[i]; return mx3(ca, cb, (t - a) / (b2 - a || 1)); };
  const GIANT = {   // band palettes from pole to pole for the giants; exoplanet giants pick one by name
    jupiter: [[0, [242, 232, 214]], [.42, [232, 214, 186]], [.58, [204, 150, 106]], [.8, [172, 112, 76]], [1, [150, 96, 66]]],
    saturn: [[0, [206, 188, 150]], [.3, [226, 204, 150]], [.5, [240, 222, 172]], [.7, [214, 186, 132]], [1, [196, 178, 140]]],
    uranus: [[0, [176, 222, 228]], [.5, [160, 214, 222]], [1, [150, 206, 216]]], neptune: [[0, [60, 96, 214]], [.4, [52, 84, 200]], [.6, [70, 108, 222]], [1, [48, 78, 190]]],
    gas: [[0, [190, 160, 120]], [.3, [214, 184, 140]], [.5, [160, 112, 80]], [.7, [222, 196, 156]], [1, [176, 140, 104]]], gas2: [[0, [150, 168, 186]], [.35, [196, 206, 212]], [.55, [120, 140, 160]], [.8, [210, 214, 216]], [1, [140, 156, 170]]],
    gas3: [[0, [172, 132, 150]], [.35, [214, 178, 180]], [.55, [140, 100, 120]], [.8, [222, 196, 196]], [1, [160, 120, 140]]], hot: [[0, [64, 30, 30]], [.4, [96, 44, 36]], [.6, [80, 36, 32]], [1, [60, 28, 28]]], hotblue: [[0, [30, 60, 140]], [.4, [46, 90, 180]], [.6, [36, 72, 160]], [1, [28, 54, 130]]] };
  // ---- real surface maps for the Solar System's planets and the Moon (equirectangular JPEGs in maps/, credits in maps/CREDITS.md). Until one has
  //      loaded the procedural surface stands in; on load the cached faces of that body are dropped and redrawn from the map.
  const MAPDIR = ((typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '') + 'maps/';
  const MAPF = { 'Earth': 'earth', 'Earth night': 'earth-night', 'The Moon': 'moon', 'Mercury': 'mercury', 'Mars': 'mars', 'Jupiter': 'jupiter', 'Saturn': 'saturn', 'Uranus': 'uranus', 'Neptune': 'neptune' }, MAPS = {};
  function mapOf(nm) {
    const f = MAPF[nm]; if (!f) return null; let t = MAPS[nm]; if (t) return t.d ? t : null;
    MAPS[nm] = t = {}; const im = new Image(); im.decoding = 'async';
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); t.w = im.width; t.h = im.height; t.d = x.getImageData(0, 0, t.w, t.h).data;
      const pre = nm.replace(' night', '') + '|'; for (const M of [PMAP, PLIT]) for (const k of [...M.keys()]) if (k.startsWith(pre)) M.delete(k); } catch (e) {} };
    im.onerror = () => { t.err = 1; }; im.src = MAPDIR + f + '.jpg'; return null;
  }
  function mapAt(t, x, y, z) {   // bilinear sample at a point of the unit sphere: longitude 0 at +z, east towards +x, north up +y
    const u = (Math.atan2(x, z) / TAU + .5) * t.w - .5, v = Math.max(0, Math.min(t.h - 1.001, (.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI) * t.h - .5)), u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0, w = t.w, D = t.d;
    const i00 = (v0 * w + ((u0 % w) + w) % w) * 4, i10 = (v0 * w + ((u0 + 1) % w + w) % w) * 4, i01 = i00 + w * 4, i11 = i10 + w * 4, o = [0, 0, 0];
    for (let k = 0; k < 3; k++) o[k] = (D[i00 + k] * (1 - fu) + D[i10 + k] * fu) * (1 - fv) + (D[i01 + k] * (1 - fu) + D[i11 + k] * fu) * fv;
    return o;
  }
  function mappedAt(nm, x, y, z, sd, lat, al) {   // the surface of a mapped body, or null while its map is loading
    const t = mapOf(nm); if (!t) return null; const c = mapAt(t, x, y, z);
    if (nm === 'Mars') { const L = (c[0] + c[1] + c[2]) / 3; return [mx3(c, [L * 1.22, L * .92, L * .66], .3), 0, null]; }   // the published Mars map runs orange; true colour is a duller butterscotch
    if (nm !== 'Earth') return [c, 0, null];
    const sea = sstep(6, 22, c[2] - c[0]) * (1 - sstep(.78, .86, al)); let sp = .55 * sea, city = null;   // the blue marble: open ocean takes the sun's glint
    const nt = mapOf('Earth night'); if (nt) { const n = mapAt(nt, x, y, z), L = (n[0] + n[1] + n[2]) / 765, lit = sstep(.1, .55, L) * (1 - sea * .8); if (lit > .01) city = [255 * lit, 190 * lit, 118 * lit]; }   // city lights from the Black Marble
    const wx = f3(x * 2 + 40, y * 2, z * 2, 3) - .5, cl = f3(x * 3.2 + wx * 2.5 + sd, y * 5 + wx * 3, z * 3.2, 6), band = .6 + .4 * Math.cos(lat * 6), cov = sstep(.56 - .08 * band, .78, cl) * .8;   // a light veil of weather, so the continents still read
    const out = mx3(c.map(q => Math.min(255, q * 1.08)), [242, 245, 250], cov * .9); sp *= 1 - cov; if (city) city = city.map(q => q * (1 - cov * .85));
    return [out, sp, city];
  }
  // ---- what we know about each exoplanet, turned into how it should look: its equilibrium temperature from its star and orbit, whether it is tidally locked,
  //      and for gas giants Sudarsky's cloud classes (I ammonia, II water, III clear, IV alkali, V silicate); young giants still glow with their own heat
  const GLOWT = { 'HR 8799 b': 900, 'HR 8799 c': 1100, 'HR 8799 d': 1150, 'HR 8799 e': 1150, 'Beta Pic b': 1700, 'Beta Pic c': 1250 }, PCX = new Map();
  function pctx(nm) { if (PCX.has(nm)) return PCX.get(nm); let o = null;
    for (const [host, L] of Object.entries(PLANETS)) { if (host === 'The Sun') continue; const p = L.find(q => q[0] === nm); if (!p) continue; let st = null; for (const id in POOL) { const q = POOL[id].find(r => r.n === host); if (q) { st = { ...q, id }; break; } }
      if (!st) break; const T = tempOf(st), Rs = RSUN(st) * .00465, a = p[2], teq = T * Math.sqrt(Rs / (2 * a)) * Math.pow(.7, .25); o = { teq, lock: a < .06 || (a < .12 && T < 4200), glow: GLOWT[nm] || 0 }; break; }
    PCX.set(nm, o); return o; }
  const SUD = { 1: [[0, [222, 204, 172]], [.4, [206, 182, 146]], [.6, [184, 150, 112]], [1, [214, 196, 164]]], 2: [[0, [236, 238, 240]], [.4, [212, 218, 226]], [.6, [232, 235, 238]], [1, [198, 206, 216]]], 3: [[0, [52, 92, 162]], [.5, [78, 122, 190]], [1, [46, 82, 150]]],
    4: [[0, [44, 40, 50]], [.5, [66, 56, 66]], [1, [40, 36, 46]]], 5: [[0, [110, 84, 70]], [.5, [140, 108, 88]], [1, [100, 76, 64]]], glow: [[0, [70, 36, 30]], [.5, [96, 52, 40]], [1, [64, 34, 30]]] };
  function surfaceAt(kind, nm, x, y, z, sd) {   // albedo, specular, emission at one point of the unit sphere (y is the spin axis)
    const lat = Math.asin(Math.max(-1, Math.min(1, y))), al = Math.abs(lat) / (Math.PI / 2);
    if (MAPF[nm]) { const r = mappedAt(nm, x, y, z, sd, lat, al); if (r) return r; }
    if (GIANT[kind] || kind === 'gas') { const cx = (kind === 'gas' || kind === 'neptune' && nm !== 'Neptune') ? pctx(nm) : null, cls = cx ? (cx.glow ? 'glow' : cx.teq < 150 ? 1 : cx.teq < 350 ? 2 : cx.teq < 850 ? 3 : cx.teq < 1400 ? 4 : 5) : 0;
      const pal = kind === 'neptune' && cx ? (cx.teq < 120 ? GIANT.neptune : cx.teq < 320 ? GIANT.uranus : SUD[2]) : cx && kind === 'gas' ? SUD[cls] : kind === 'gas' ? GIANT[['gas', 'gas2', 'gas3'][Math.floor(hs2(nm + 'gp') * 3)]] : GIANT[kind], calm = kind === 'uranus' ? .25 : kind === 'neptune' ? .6 : kind === 'saturn' ? .55 : 1;
      const cyc = kind === 'jupiter' ? 3.8 : kind === 'saturn' ? 3 : kind === 'uranus' ? .8 : kind === 'neptune' ? 1.6 : 2.6 + hs2(nm + 'cy') * 1.6, w1 = f3(x * 1.4 + sd, y * 1.4, z * 1.4, 4) - .5, w2 = f3(x * 2.2 + sd, y * 14, z * 2.2, 5) - .5, lo2 = Math.atan2(x, z), edge = Math.sin(lat * cyc * 4) * .5, v0 = ((y + 1) / 2 + .06 * Math.sin(y * 4.3 + hs2(nm + 'bw') * 6) + .03 * Math.sin(y * 11)) * cyc + calm * (.045 * w1 + .03 * w2 + .012 * Math.sin(lo2 * 9 + lat * 30 + w1 * 10) * (1 - Math.abs(edge))), tri = Math.abs((((v0 % 1) + 1) % 1) * 2 - 1);   // bands mirror up the planet; their edges shear into festoons
      let c = ramp3(pal, tri); const fine = f3(x * 8 + sd, y * 36, z * 8, 3); c = c.map(q => q * (.93 + .14 * fine * calm + (1 - calm) * .05));
      if (kind === 'jupiter') { const lo = Math.atan2(x, z) - .9, dl = Math.hypot(lo * 1.25, (lat + .38) * 3.2); if (dl < .3) { const sw = Math.sin(Math.atan2(lat + .38, lo) * 3 + dl * 30); c = mx3(c, mx3([196, 96, 62], [232, 150, 110], .5 + .5 * sw), sstep(.3, .12, dl)); }   // the Great Red Spot, swirling
        for (let k = 0; k < 9; k++) { const sl = (h3(k, 1, 7) - .5) * 1.6, so = h3(k, 2, 7) * 6.28, ds = Math.hypot((Math.atan2(x, z) - so + 9.42) % 6.28 - 3.14, (lat - sl) * 2.5); if (ds < .05) c = mx3(c, [250, 246, 238], sstep(.05, .015, ds)); } }   // white ovals
      if (kind === 'neptune' && nm === 'Neptune') { const lo = Math.atan2(x, z) - .4, dl = Math.hypot(lo, (lat + .4) * 2.6); if (dl < .22) c = mx3(c, [26, 40, 110], sstep(.22, .1, dl)); const st = f3(x * 3 + 4, y * 26, z * 3, 3); if (st > .66 && Math.abs(lat + .1) < .6) c = mx3(c, [236, 242, 252], sstep(.66, .78, st)); }   // the Great Dark Spot and bright methane cirrus
      if (kind === 'saturn' && al > .85) c = mx3(c, [150, 160, 150], sstep(.85, 1, al) * .5);
      if (kind === 'hot' || kind === 'hotblue') { const glow = sstep(.5, 1, f3(x * 3 + sd, y * 3, z * 3, 3)); return [c, kind === 'hotblue' ? .25 : .05, kind === 'hot' ? [255 * glow * .5, 90 * glow * .5, 40 * glow * .5] : null]; }
      if (cx && (cx.glow || cls === 5 || cls === 4)) { const T = cx.glow || cx.teq, k = clamp((T - 700) / 1400) * (.6 + .5 * f3(x * 3 + sd, y * 9, z * 3, 3)); return [c, 0, [255 * k * .8, 90 * k * .8, 50 * k * .8]]; }   // glowing with heat: its own (young giants) or its star's
      return [c, 0, null]; }
    if (kind === 'earth' || kind === 'ocean' || kind === 'super' || kind === 'desert') { const sea = kind === 'ocean' ? .62 : kind === 'desert' ? .2 : kind === 'super' ? .44 : .5, e = f3(x * 1.7 + sd, y * 1.7, z * 1.7, 6) + .18 * (r3(x * 3 + sd, y * 3, z * 3, 4) - .5);
      let c, sp = 0; const lk = kind === 'ocean' || kind === 'super' ? pctx(nm) : null, eye = lk && lk.lock && lk.teq > 170 && lk.teq < 330;   // tidally locked and temperate: an eyeball world, open sea facing its star, ice everywhere else
      if (e < sea) { const d = sstep(sea - .2, sea, e); c = mx3([5, 16, 42], [18, 56, 96], d); sp = .55; }
      else { const m = f3(x * 4 + 9, y * 4, z * 4, 4), hgt = (e - sea) / (1 - sea), dry = kind === 'desert' ? 1 : sstep(.45, .7, m * (1 - .5 * Math.cos(lat * 2)) + (1 - al) * .25 - .1);
        c = mx3(mx3([38, 56, 30], [66, 76, 44], m), mx3([158, 132, 96], [192, 160, 120], m), dry); if (kind === 'super') c = mx3(c, [96, 110, 88], .5); c = mx3(c, [130, 120, 112], sstep(.35, .7, hgt)); c = mx3(c, [236, 236, 240], sstep(.62, .8, hgt)); }
      const ice = al + .12 * (f3(x * 5, y * 5, z * 5, 3) - .5); if (ice > (kind === 'ocean' ? .7 : .8)) { c = mx3(c, [240, 246, 250], sstep(.8, .86, ice)); sp = 0; }
      if (eye) { const op = sstep(.56, .72, z + .14 * (f3(x * 4 + sd, y * 4, z * 4, 3) - .5)); c = mx3(mx3([212, 222, 232], [176, 196, 214], sstep(.6, .8, r3(x * 4, y * 4, z * 4, 4))), c, op); sp *= op; }
      let city = null; if (nm === 'Earth' && e >= sea && al < .75) { const n1 = f3(x * 70 + 3, y * 70, z * 70, 2), n2 = f3(x * 6 - 7, y * 6, z * 6, 3), n3 = f3(x * 18 + 1, y * 18, z * 18, 2), lit = sstep(.66, .8, n1) * sstep(.5, .66, n2) * (.4 + .6 * sstep(.5, .7, n3)) * (1 - al) * .8; if (lit > .02) city = [255 * lit, 176 * lit, 90 * lit]; }   // the lights of cities, seen only at night
      if (kind !== 'desert') { const wx = f3(x * 2 + 40, y * 2, z * 2, 3) - .5, cl = f3(x * 3.2 + wx * 2.5 + sd, y * 5 + wx * 3, z * 3.2, 6), band = .6 + .4 * Math.cos(lat * 6), cov = Math.min(1, sstep(.52 - .08 * band, .72, cl) * (kind === 'ocean' ? 1 : .9) + (eye ? sstep(.7, .98, z) * .6 * cl : 0));   /* a locked world piles thick cloud over the point beneath its star */ c = mx3(c, [244, 246, 250], cov * .92); sp *= 1 - cov; if (city) city = city.map(v => v * (1 - cov * .85)); }   // clouds, swirled and gathered in bands
      return [c, sp, city]; }
    if (kind === 'mars') { const e = f3(x * 2 + sd, y * 2, z * 2, 6), d = f3(x * 6, y * 6, z * 6, 4); let c = mx3([142, 86, 56], [198, 142, 98], e); c = mx3(c, [86, 60, 46], sstep(.55, .7, d) * .6);   /* butterscotch dust over dark basalt, as Mars looks in true colour */ const [cd] = cell3(x * 9, y * 9, z * 9); c = c.map(q => q * (cd < .18 ? .82 : cd < .24 ? 1.08 : 1)); if (al > .86) c = mx3(c, [242, 238, 232], sstep(.86, .9, al + .03 * (d - .5))); return [c, 0, null]; }
    if (kind === 'venus') { const w = f3(x * 1.5 + sd, y * 3, z * 1.5, 4), v = y * 3 + w * 1.8 + Math.atan2(x, z) * .3, b2 = .5 + .5 * Math.sin(v * 3); return [mx3([206, 170, 108], [246, 230, 190], .45 + .4 * b2 + .15 * f3(x * 6, y * 6, z * 6, 3)), 0, null]; }
    if (kind === 'lava') { const cr = r3(x * 3 + sd, y * 3, z * 3, 5), crack = sstep(.78, .95, cr), crust = f3(x * 6, y * 6, z * 6, 4); const c = mx3([34, 26, 24], [70, 56, 50], crust); return [mx3(c, [255, 150, 60], crack * .7), .05, [255 * crack, 110 * crack, 30 * crack]]; }
    if (kind === 'moon' || kind === 'callisto' || kind === 'ganymede' || kind === 'snow' || kind === 'iapetus') {   // cratered moons: maria on the Moon, dark ancient Callisto, grooved Ganymede, bright icy moons of Saturn, two-toned Iapetus
      const base = f3(x * 2 + sd, y * 2, z * 2, 5); let c = kind === 'moon' ? mx3([90, 88, 86], [196, 192, 186], base) : kind === 'callisto' ? mx3([58, 52, 46], [120, 110, 98], base) : kind === 'ganymede' ? mx3([96, 88, 80], [186, 178, 168], base) : kind === 'iapetus' ? (x > .2 * (f3(x * 3, y * 3, z * 3, 3) - .5) ? [66, 44, 30] : [226, 222, 214]) : mx3([196, 200, 206], [246, 248, 250], base);
      if (kind === 'moon') c = mx3(c, [70, 70, 72], sstep(.55, .62, f3(x * 1.3 + 5, y * 1.3, z * 1.3, 4)) * .7);   // the dark lava plains of the maria
      if (kind === 'ganymede') c = mx3(c, [210, 204, 194], sstep(.7, .85, r3(x * 3, y * 3, z * 3, 4)) * .6);
      let sh = 1; for (const [fq, rr] of [[3, .2], [8, .17], [20, .13]]) { const [d, id] = cell3(x * fq + sd, y * fq, z * fq), r = rr * (.5 + .5 * id); if (id > .4 && d < r * 1.3) sh *= d < r * .8 ? .82 : d < r ? 1.16 : 1 + .14 * (1.3 - d / r); if (kind === 'callisto' && d < r * .3 && id > .8) sh *= 1.6; } if (kind === 'callisto') { const [d, id] = cell3(x * 34 + sd, y * 34, z * 34); if (id > .5 && d < .13) sh *= 1.35 + id * .5; }   // Callisto is the most cratered body known: bright young ejecta peppers a dark crust
      return [c.map(q => Math.min(255, q * sh)), 0, null]; }
    if (kind === 'io') { const b2 = f3(x * 3 + sd, y * 3, z * 3, 5); let c = mx3([216, 190, 80], [246, 232, 150], b2); c = mx3(c, [186, 110, 50], sstep(.6, .75, f3(x * 6, y * 6, z * 6, 4)) * .7); const [d, id] = cell3(x * 6, y * 6, z * 6); if (id > .7 && d < .14) c = mx3(c, [40, 30, 20], .8); if (id > .7 && d > .14 && d < .26) c = mx3(c, [200, 80, 40], .5); return [c, 0, id > .93 && d < .06 ? [255, 120, 40] : null]; }   // sulphur plains and volcanoes with dark calderas and red haloes
    if (kind === 'europa') { const cr = r3(x * 2 + sd, y * 2, z * 2, 6), lines = sstep(.82, .95, cr), base = f3(x * 4, y * 4, z * 4, 4); let c = mx3([206, 196, 176], [240, 236, 226], base); c = mx3(c, [150, 92, 60], lines * .75); c = mx3(c, [176, 140, 110], sstep(.6, .8, f3(x * 1.5, y * 1.5, z * 1.5, 3)) * .4); return [c, .1, null]; }   // ice crust laced with reddish lineae
    if (kind === 'titan') { const v = f3(x * 1.5 + sd, y * 3, z * 1.5, 4); return [mx3([196, 136, 56], [232, 176, 90], .4 + .5 * v), 0, null]; }   // nothing but orange photochemical haze
    if (kind === 'triton') { const b2 = f3(x * 3 + sd, y * 3, z * 3, 5); let c = mx3([196, 170, 160], [236, 222, 214], b2); if (y < -.2) c = mx3(c, [240, 220, 210], .6); c = mx3(c, [120, 110, 100], sstep(.75, .85, r3(x * 5, y * 5, z * 5, 4)) * .4); return [c, 0, null]; }   // pink nitrogen ice, cantaloupe terrain
    if (kind === 'ice') { const cr = r3(x * 2.4 + sd, y * 2.4, z * 2.4, 5), lines = sstep(.86, .97, cr), base = f3(x * 3, y * 3, z * 3, 4); let c = mx3([170, 196, 214], [232, 240, 246], base); c = mx3(c, [150, 100, 70], lines * .6); return [c, .15, null]; }
    // bare rock (Mercury-like): craters at three scales with bright rims and rays
    const base = f3(x * 2.5 + sd, y * 2.5, z * 2.5, 5); let c = kind === 'mercury' ? mx3([92, 88, 86], [158, 152, 146], base) : mx3([62, 56, 52], [124, 114, 104], base);   /* airless worlds round red dwarfs are dark basalt, reflecting about a tenth of their light */ let sh = 1;
    for (const [fq, rr] of [[3, .22], [7, .18], [16, .14]]) { const [d, id] = cell3(x * fq + sd, y * fq, z * fq), r = rr * (.5 + .5 * id); if (id > .45 && d < r * 1.25) sh *= d < r * .8 ? .78 + .1 * (d / r) : d < r ? 1.18 : 1 + .1 * (1.25 - d / r); }
    return [c.map(q => q * sh), 0, null];
  }
  const PMAP = new Map(), PLIT = new Map(); let PBT = 0;
  function planetMaps(kind, nm, S) {   // the expensive part, done once per planet and size: albedo / specular / emission over the disc
    const key = nm + '|' + S; let m = PMAP.get(key); if (m) return m; if (PMAP.size > 24) PMAP.delete(PMAP.keys().next().value);
    const A = new Float32Array(S * S * 3), Sp = new Float32Array(S * S), E = new Float32Array(S * S * 3), sd = (hs2(nm + 'sd') * 40) | 0, tilt = (hs2(nm + 'tl') - .5) * .5 + (kind === 'uranus' ? 1.55 : 0), ct = Math.cos(tilt), st = Math.sin(tilt), spin = hs2(nm + 'sp') * 6.28, cs = Math.cos(spin), ss = Math.sin(spin), R = S / 2;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { const dx = (px + .5 - R) / R, dy = (py + .5 - R) / R, r2 = dx * dx + dy * dy; if (r2 > 1) continue; const dz = Math.sqrt(1 - r2);
      let x = dx * ct - dy * st, y = -(dx * st + dy * ct), z = dz; [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      const [c, sp, em] = surfaceAt(kind, nm, x, y, z, sd), i = py * S + px; A[i * 3] = c[0]; A[i * 3 + 1] = c[1]; A[i * 3 + 2] = c[2]; Sp[i] = sp; if (em) { E[i * 3] = em[0]; E[i * 3 + 1] = em[1]; E[i * 3 + 2] = em[2]; } }
    m = { A, Sp, E, S }; PMAP.set(key, m); return m;
  }
  const ATM = { titan: [[255, 190, 110], 1.4], triton: [[200, 210, 255], .2], io: [[255, 230, 160], .08],  earth: [[110, 160, 255], .9], ocean: [[110, 170, 255], 1], super: [[150, 180, 230], .7], venus: [[255, 236, 190], 1.1], neptune: [[120, 170, 255], .8], uranus: [[170, 236, 240], .8], jupiter: [[230, 220, 210], .35], saturn: [[240, 224, 190], .35], gas: [[210, 210, 230], .4], hot: [[255, 140, 90], .5], hotblue: [[130, 170, 255], .7], mars: [[230, 170, 140], .25], desert: [[220, 190, 150], .4] };
  function planetFace(kind, nm, S, la) {   // la: the direction of the star (radians, screen space) or null for the comparison view's soft key light
    const q = la == null ? -1 : Math.round(((la % TAU) + TAU) % TAU / TAU * 24) % 24, key = nm + '|' + S + '|' + q; let c = PLIT.get(key); if (c) { PLIT.delete(key); PLIT.set(key, c); return c; } if (PLIT.size > 40) PLIT.delete(PLIT.keys().next().value);
    const m = planetMaps(kind, nm, S), ang = q < 0 ? -2.35 : q / 24 * TAU, lz = q < 0 ? .62 : .32, lxy = Math.sqrt(1 - lz * lz), Lx = Math.cos(ang) * lxy, Ly = Math.sin(ang) * lxy, at = ATM[kind], giant = !!GIANT[kind] || kind === 'gas', night0 = nm === 'Earth' ? 0 : .25;
    const rc = Math.cos(-.32), rs2 = Math.sin(-.32), RN = [-.94 * rs2, .94 * rc, -.34], nL = RN[0] * Lx + RN[1] * Ly + RN[2] * lz;   // Saturn's ring plane, as the rings are drawn (tilted 20 degrees, turned -0.32 rad)
    c = mk(S); const g = c.getContext('2d'), img = g.createImageData(S, S), D = img.data, R = S / 2;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { const dx = (px + .5 - R) / R, dy = (py + .5 - R) / R, r2 = dx * dx + dy * dy; if (r2 > 1) continue; const dz = Math.sqrt(1 - r2), i = py * S + px, k = i * 4;
      const nd = dx * Lx + dy * Ly + dz * lz, dif = sstep(-.12, .55, nd) * (.25 + .75 * Math.max(0, nd)) + .02, hv = dz + lz, hx = Lx, hy = Ly, hl = Math.hypot(hx, hy, hv), sp = m.Sp[i] * Math.pow(Math.max(0, (dx * hx + dy * hy + dz * hv) / hl), 60) * sstep(0, .3, nd);
      let ld = giant ? .5 + .5 * Math.pow(dz, .6) : 1;   // gas giants darken towards the limb: we look through more of the cloud-top haze there
      if (kind === 'saturn' && Math.abs(nL) > .02) { const s2 = -(RN[0] * dx + RN[1] * dy + RN[2] * dz) / nL; if (s2 > 0) { const qx = dx + s2 * Lx, qy = dy + s2 * Ly, qz = dz + s2 * lz, rho = Math.hypot(qx, qy, qz); if (rho > 1.24 && rho < 2.29) ld *= 1 - (rho < 1.52 ? .25 : rho < 1.95 ? .8 : rho < 2.03 ? .05 : .55) * .9; } }   // the rings cast their shadow across the globe
      let r = m.A[i * 3] * dif * ld + 255 * sp, gg = m.A[i * 3 + 1] * dif * ld + 245 * sp, b = m.A[i * 3 + 2] * dif * ld + 230 * sp; const night = 1 - sstep(-.15, .2, nd); r += m.E[i * 3] * (night0 + (1 - night0) * night); gg += m.E[i * 3 + 1] * (night0 + (1 - night0) * night); b += m.E[i * 3 + 2] * (night0 + (1 - night0) * night);
      if (at) { const rim = Math.pow(1 - dz, 2.6) * at[1] * sstep(-.25, .35, nd), tw = Math.pow(1 - dz, 6) * at[1] * .5 * sstep(-.45, -.05, nd) * (1 - sstep(.1, .4, nd)); r += at[0][0] * (rim + tw); gg += at[0][1] * (rim + tw); b += at[0][2] * (rim + tw); }   // the lit atmosphere at the limb, and a thin twilight arc just past the terminator
      D[k] = r; D[k + 1] = gg; D[k + 2] = b; D[k + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * R * 1.2); }
    g.putImageData(img, 0, 0); PLIT.set(key, c); return c;
  }
  // ---- the 3D globe for Inspect: a WebGL sphere ray-cast per pixel, wrapped in the planet's own surface (real maps where we have them), lit by its star,
  //      with Saturn's rings as a true plane that takes the planet's shadow and casts its own. Drag turns it; the star stays put, so day and night stay honest.
  const OBLQ = { 'Mercury': .03, 'Venus': 177.4, 'Earth': 23.44, 'The Moon': 6.7, 'Mars': 25.19, 'Jupiter': 3.13, 'Saturn': 26.73, 'Uranus': 97.77, 'Neptune': 28.32 };
  function equirect(kind, nm, W, done) {   // the planet's surface unrolled: rgb + specular, and emission; baked in slices so the page never stalls
    const H = W / 2, A = new Uint8Array(W * H * 4), E = new Uint8Array(W * H * 4), sd = (hs2(nm + 'sd') * 40) | 0; let row = 0, dead = false;
    const step = () => { if (dead) return; const wait = n => MAPF[n] && !mapOf(n) && !MAPS[n].err; if (wait(nm) || nm === 'Earth' && wait('Earth night')) { setTimeout(step, 80); return; }   // a real map is still loading
      const t0 = performance.now(); while (row < H && performance.now() - t0 < 12) { const lat = (.5 - (row + .5) / H) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
        for (let i = 0; i < W; i++) { const lon = ((i + .5) / W - .5) * TAU, x = cl * Math.sin(lon), z = cl * Math.cos(lon), [c, sp, em] = surfaceAt(kind, nm, x, y, z, sd), k = (row * W + i) * 4;
          A[k] = Math.min(255, c[0]); A[k + 1] = Math.min(255, c[1]); A[k + 2] = Math.min(255, c[2]); A[k + 3] = Math.min(255, sp * 255); if (em) { E[k] = Math.min(255, em[0]); E[k + 1] = Math.min(255, em[1]); E[k + 2] = Math.min(255, em[2]); } E[k + 3] = 255; } row++; }
      if (row < H) setTimeout(step, 0); else done({ W, H, A, E }); };
    step(); return () => { dead = true; };
  }
  const GLOBEFS = `precision highp float; varying vec2 vP; uniform sampler2D uA, uE; uniform mat3 uR; uniform vec3 uL, uAtm; uniform float uAtmK, uGiant, uNight0, uRing, uScale, uAsp, uPix;
    float ringD(float r) { if (r < 1.24 || r > 2.29) return 0.; float d = r < 1.52 ? .22 : r < 1.95 ? .85 : r < 2.03 ? .05 : (r > 2.21 && r < 2.23) ? .08 : .6; return d * (.82 + .18 * sin(r * 431.) * sin(r * 157.)); }
    vec3 ringC(float r) { return r < 1.52 ? vec3(.62, .57, .5) : r < 1.95 ? vec3(.93, .86, .7) : vec3(.84, .78, .65); }
    void main() { vec2 p = vec2(vP.x * uAsp, vP.y) / uScale; float r2 = dot(p, p); vec3 col = vec3(0.); float al = 0.; vec3 RN = uR * vec3(0., 1., 0.);
      float rz = -1e9, rd = 0.; vec3 rc = vec3(0.);
      if (uRing > .5 && abs(RN.z) > .002) { rz = -(p.x * RN.x + p.y * RN.y) / RN.z; vec3 q = vec3(p, rz); float rho = length(q); rd = ringD(rho);
        if (rd > 0.) { float b = dot(q, uL), c = dot(q, q) - 1., disc = b * b - c; float sh = (disc > 0. && -b - sqrt(disc) > 0.) ? .06 : 1.; rc = ringC(rho) * (.3 + .7 * abs(dot(RN, uL))) * sh; } }
      if (r2 < 1.) { vec3 n = vec3(p, sqrt(1. - r2)); vec3 bd = n * uR; float lon = atan(bd.x, bd.z), lat = asin(clamp(bd.y, -1., 1.)); vec2 uv = vec2(lon / 6.2831853 + .5, .5 - lat / 3.1415927);
        vec4 A = texture2D(uA, uv); vec3 E = texture2D(uE, uv).rgb; float nd = dot(n, uL), dif = smoothstep(-.12, .55, nd) * (.25 + .75 * max(nd, 0.)) + .012; vec3 h = normalize(uL + vec3(0., 0., 1.));
        float sp = A.a * pow(max(dot(n, h), 0.), 60.) * smoothstep(0., .3, nd), ld = uGiant > .5 ? .5 + .5 * pow(n.z, .6) : 1.;
        if (uRing > .5 && abs(dot(uL, RN)) > .01) { float t = -dot(n, RN) / dot(uL, RN); if (t > 0.) ld *= 1. - ringD(length(n + t * uL)) * .85; }   // the rings' shadow on the globe
        vec3 c = A.rgb * dif * ld + vec3(1., .96, .9) * sp; c = mix(c, uAtm * dif * .9, clamp(uAtmK * .3 * pow(1. - n.z, 1.6), 0., .55)); float night = 1. - smoothstep(-.15, .2, nd); c += E * (uNight0 + (1. - uNight0) * night);
        float rim = pow(1. - n.z, 2.6) * uAtmK * smoothstep(-.25, .35, nd), tw = pow(1. - n.z, 6.) * uAtmK * .5 * smoothstep(-.45, -.05, nd) * (1. - smoothstep(.1, .4, nd)); c += uAtm * (rim + tw);
        float edge = clamp((1. - sqrt(r2)) * uScale * uPix, 0., 1.); col = c * edge; al = edge;
        if (rd > 0. && rz > n.z) { col = mix(col, rc, rd); al = max(al, rd); } }
      else if (rd > 0.) { col = rc * rd; al = rd; }
      if (r2 >= 1. && uAtmK > 0.) { float d = sqrt(r2) - 1., hz = exp(-d * 28.) * uAtmK * .35 * smoothstep(-.3, .4, dot(normalize(vec3(p, 0.)), uL)); col += uAtm * hz; al = max(al, min(1., hz)); }   // the thin glow of air beyond the limb
      gl_FragColor = vec4(col, al); }`;
  function globe(cv, kind, nm) {   // returns { draw(spin, pitch, zoom), stop() }
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); if (!gl) return null;
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }, pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a; varying vec2 vP; void main(){ vP = a; gl_Position = vec4(a, 0., 1.); }')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, GLOBEFS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null; gl.useProgram(pr);
    const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); const la = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n), tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([60, 60, 70, 0])); return t; };
    const tA = tex(0), tE = tex(1); gl.uniform1i(U('uA'), 0); gl.uniform1i(U('uE'), 1);
    const up = d => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tA); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, d.W, d.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, d.A); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, d.W, d.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, d.E); api.ready = d.W; };
    const at = ATM[kind], big = MAPF[nm] ? 2048 : 1024; let stopB = equirect(kind, nm, 256, d => { up(d); stopB = equirect(kind, nm, big, up); });   // a quick coarse surface first, then the sharp one
    const cxl = pctx(nm), ob = (cxl && cxl.lock ? 0 : OBLQ[nm] != null ? OBLQ[nm] : hs2(nm + 'ob') * 30) * Math.PI / 180;   // locked worlds have their spin axis upright
    const mat = (spin, pitch) => { const cy = Math.cos(spin), sy = Math.sin(spin), co = Math.cos(ob), so = Math.sin(ob), cp = Math.cos(pitch), spp = Math.sin(pitch), Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy], Rz = [co, so, 0, -so, co, 0, 0, 0, 1], Rx = [1, 0, 0, 0, cp, spp, 0, -spp, cp], mul = (a, b) => { const o = []; for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; }; return mul(Rx, mul(Rz, Ry)); };
    const api = { ready: 0, locked: !!(cxl && cxl.lock), faceStar(pitch) { let best = 0, bd = -9; for (let k = 0; k < 72; k++) { const s2 = k / 72 * TAU, m = mat(s2, pitch), d = -.62 * m[6] + .4 * m[7] + .68 * m[8]; if (d > bd) { bd = d; best = s2; } } return best; },   // the spin that turns the point beneath the star towards it
      draw(spin, pitch, zoom) { const w = cv.width, h = cv.height; gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniformMatrix3fv(U('uR'), false, new Float32Array(mat(spin, pitch)));   // body -> view: spin about the axis, the axis tilted by the obliquity, then the viewer's pitch
        const L = [-.62, .4, .68], ll = Math.hypot(...L); gl.uniform3f(U('uL'), L[0] / ll, L[1] / ll, L[2] / ll);
        gl.uniform3f(U('uAtm'), at ? at[0][0] / 255 : 0, at ? at[0][1] / 255 : 0, at ? at[0][2] / 255 : 0); gl.uniform1f(U('uAtmK'), at ? at[1] : 0); gl.uniform1f(U('uGiant'), GIANT[kind] || kind === 'gas' ? 1 : 0);
        gl.uniform1f(U('uNight0'), nm === 'Earth' ? 0 : .25); gl.uniform1f(U('uRing'), kind === 'saturn' ? 1 : 0); const sc = zoom * (kind === 'saturn' ? .36 : .78) * Math.min(1, w / h); gl.uniform1f(U('uScale'), sc); gl.uniform1f(U('uAsp'), w / h); gl.uniform1f(U('uPix'), h / 2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }, stop() { stopB && stopB(); const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } };
    return api;
  }
  function rings(g, x, y, rp, half, la) {   // Saturn's rings: C ring, B ring, the Cassini division, A ring with the Encke gap, seen from 20 degrees
    g.save(); g.translate(x, y); g.rotate(-.32); g.scale(1, .34); const lit = la == null ? 1 : .75 + .25 * Math.abs(Math.cos(la));
    for (let k = 0; k < 90; k++) { const u = 1.24 + k / 89 * 1.05, a = u < 1.52 ? .25 : u < 1.95 ? .82 : u < 2.03 ? .06 : (u > 2.21 && u < 2.23) ? .1 : .58, tone = u < 1.52 ? [170, 156, 132] : u < 1.95 ? [232, 214, 172] : [210, 196, 162], wob = .85 + .15 * h3(k, 3, 9);
      g.strokeStyle = `rgba(${tone[0] * lit | 0},${tone[1] * lit | 0},${tone[2] * lit | 0},${a * wob})`; g.lineWidth = Math.max(.5, rp * 1.05 / 89 * 1.3); g.beginPath(); g.arc(0, 0, rp * u, half ? 0 : Math.PI, half ? Math.PI : TAU); g.stroke(); }
    g.restore();
  }
  function drawPlanet(g, x, y, rp, kind, name, light, K) {   // light: the angle towards the star; null in the comparison view
    if (rp < 1.3) { g.fillStyle = rgba((PCOL[kind] || PCOL.rock)[0], .95); g.beginPath(); g.arc(x, y, Math.max(.7 * K, rp), 0, TAU); g.fill(); return; }
    if (kind === 'saturn' && rp > 3) rings(g, x, y, rp, false, light);
    const S = Math.min(MAPF[name] && mapOf(name) ? 1024 : 512, Math.max(32, Math.pow(2, Math.ceil(Math.log2(rp * 2.1))))), q = light == null ? -1 : Math.round(((light % TAU) + TAU) % TAU / TAU * 24) % 24, now = performance.now();
    let face = PLIT.get(name + '|' + S + '|' + q);
    if (!face) { if (now - PBT > 40 || !PMAP.has(name + '|' + S) && now - PBT > 40) { PBT = now; face = planetFace(kind, name, S, light); } else for (let s2 = S >> 1; s2 >= 32 && !face; s2 >>= 1) face = PLIT.get(name + '|' + s2 + '|' + q) || (PMAP.has(name + '|' + s2) ? planetFace(kind, name, s2, light) : null); }   // at most one new surface every 40 ms; a smaller cached one stands in meanwhile
    if (face) g.drawImage(face, x - rp, y - rp, rp * 2, rp * 2); else { const gr = g.createRadialGradient(x - rp * .3, y - rp * .3, 0, x, y, rp); gr.addColorStop(0, (PCOL[kind] || PCOL.rock)[0]); gr.addColorStop(1, '#050408'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rp, 0, TAU); g.fill(); }
    if (kind === 'saturn' && rp > 3) rings(g, x, y, rp, true, light);
  }
  function drawSystem(g, b, x, y, Z, K, w, h, labels, out, wx, wy) {   // a real star's planets and belts, at true scale and true periods
    const nm = b.n.split('#')[0], pl = PLANETS[nm], db = DEBRIS[nm]; if (!pl && !db && !BELTS[nm]) return; const rot = hs2(nm + 'sr') * TAU, fy = .35 + .5 * hs2(nm + 'sf'), au = AUU * Z, c = Math.cos(rot), s2 = Math.sin(rot);
    if (db && db[1] * au > 8 * K && db[0] * au < w * 4) { g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, fy); g.strokeStyle = db[2] + '.045)'; g.lineWidth = (db[1] - db[0]) * au; g.beginPath(); g.arc(0, 0, (db[0] + db[1]) / 2 * au, 0, TAU); g.stroke(); g.restore(); }
    drawBelts(g, nm, x, y, au, rot, fy, K, w, h, labels);
    if (!pl || !pl.length) return;
    pl.forEach(([pn, re, a, P, kind]) => { const ra = a * au, M = hs2(pn + 'M') * TAU + TAU * SIMT / (P * 86400), ox = Math.cos(M) * ra, oy = Math.sin(M) * ra * fy, px = x + ox * c - oy * s2, py = y + ox * s2 + oy * c, rp = re * .009158 * RSU * Z;
      if (out) out.push({ n: pn, id: 'planet', x: px, y: py, wx: wx + (px - x) / Z, wy: wy + (py - y) / Z, ax: wx, ay: wy, lx: (px - x) / Z, ly: (py - y) / Z, r: ra < 3 * K ? 0 : Math.max(rp, 10 * K), tier: 'planet' });   // always known, so the camera can fly to a planet from anywhere
      if (ra >= 3 * K && ra < w * 6) { g.strokeStyle = 'rgba(255,255,255,.11)'; g.lineWidth = Math.max(.5, .7 * K); g.beginPath(); g.ellipse(x, y, ra, ra * fy, rot, 0, TAU); g.stroke(); }
      if (ra >= 3 * K && px > -rp - 40 && px < w + rp + 40 && py > -rp - 40 && py < h + rp + 40) drawPlanet(g, px, py, rp, kind, pn, Math.atan2(y - py, x - px), K);
      const ml = MOONS[pn]; if (ml) { const kmz = Z * RSU / 695700; ml.forEach(([mn, mr, ma, mp, mk2]) => { const ro = ma * kmz, M2 = hs2(mn + 'M') * TAU + TAU * SIMT / (mp * 86400), mx = px + Math.cos(M2) * ro, my = py + Math.sin(M2) * ro * fy, mrp = mr * kmz;   // moons at their real distances and periods, on orbits seen at the system's tilt
        if (out) out.push({ n: mn, id: 'planet', x: mx, y: my, wx: wx + (mx - x) / Z, wy: wy + (my - y) / Z, ax: wx, ay: wy, lx: (mx - x) / Z, ly: (my - y) / Z, r: ro < 3 * K ? 0 : Math.max(mrp, 8 * K), tier: 'planet' }); if (ro < 4 * K) return;
        if (ro < w * 6) { g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = Math.max(.5, .6 * K); g.beginPath(); g.ellipse(px, py, ro, ro * fy, 0, 0, TAU); g.stroke(); }
        if (mx < -mrp - 20 || mx > w + mrp + 20 || my < -mrp - 20 || my > h + mrp + 20) return; drawPlanet(g, mx, my, mrp, mk2, mn, Math.atan2(y - my, x - mx), K);
        if (ro > 30 * K && mrp < 40 * K && labels && PREF.on) labels.push({ lbl: { text: mn, x: mx, y: my + Math.max(mrp, 2 * K) + 16 * K, size: 10 * K, color: 'rgba(200,196,220,.8)' }, pr: 5, m: 0 }); }); }
      if (ra > 34 * K && rp < 40 * K && labels && PREF.on) labels.push({ lbl: { text: pn, x: px, y: py + Math.max(rp, 2 * K) + 18 * K, size: 11 * K, color: 'rgba(214,208,232,.85)' }, pr: 4, m: 0 }); });
  }
  const mixHex = (a, b2, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b2.slice(1), 16), m = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t); return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1); };

  // ---- sharp surfaces: every resolved star is shaded per pixel at the size it is shown (limb darkening, two scales of convection, spots, cloud bands), off the main thread, cached by size
  function SHADER() {
    const h2 = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653); h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const fbm = (x, y, s) => vn(x, y, s) * .5 + vn(x * 2.1, y * 2.1, s + 1) * .26 + vn(x * 4.3, y * 4.3, s + 2) * .14 + vn(x * 8.7, y * 8.7, s + 3) * .07 + vn(x * 17, y * 17, s + 4) * .03;
    const wor = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9, id = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = xi + i, cy = yi + j, px = cx + h2(cx, cy, s), py = cy + h2(cx, cy, s + 7), d = (px - x) * (px - x) + (py - y) * (py - y); if (d < f1) { f2 = f1; f1 = d; id = h2(cx, cy, s + 13); } else if (d < f2) f2 = d; } return [Math.sqrt(f1), Math.sqrt(f2), id]; };
    const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const R = { giant: [[0, [34, 3, 2]], [.28, [138, 26, 8]], [.52, [214, 70, 20]], [.76, [255, 140, 56]], [1, [255, 222, 168]]], dwarfR: [[0, [60, 8, 4]], [.35, [176, 44, 14]], [.65, [246, 104, 40]], [.88, [255, 176, 110]], [1, [255, 226, 190]]],
      sun: [[0, [96, 30, 4]], [.35, [214, 112, 26]], [.62, [255, 188, 78]], [.84, [255, 232, 168]], [1, [255, 252, 238]]], hot: [[0, [24, 44, 130]], [.38, [112, 152, 255]], [.72, [198, 218, 255]], [1, [250, 252, 255]]],
      white: [[0, [70, 90, 160]], [.5, [190, 210, 255]], [1, [255, 255, 255]]], brown: [[0, [26, 6, 18]], [.3, [92, 26, 58]], [.55, [160, 64, 104]], [.8, [214, 128, 150]], [1, [246, 196, 196]]] };
    const P = { giant: { big: 2.6, fine: 9, micro: 40, limb: .82, con: .6, spots: 0, soft: 1 }, dwarfR: { big: 4, fine: 60, micro: 110, limb: .62, lv: .2, gran: .05, sg: .05, spots: 9, photo: 1, sc: .45, ss: 1.8 }, sun: { big: 5, fine: 90, micro: 180, limb: .47, lv: .23, gran: .04, sg: .03, fac: .18, spots: 5, photo: 1, sc: 1 }, hot: { big: 3, fine: 40, micro: 120, limb: .4, lv: .12, gran: .012, sg: .015, spots: 0, photo: 1 }, white: { big: 3, fine: 20, micro: 60, limb: .5, con: .025, spots: 0, smooth: 1 }, brown: { big: 3, fine: 14, micro: 50, limb: .55, con: .4, spots: 0, bands: 1 } };
    const ramp = (r, t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; let i = 1; while (i < r.length - 1 && t > r[i][0]) i++; const [a, ca] = r[i - 1], [b, cb] = r[i], k = (t - a) / (b - a); return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k]; };
    onmessage = e => { const { key, S, kind, seed, ramp: rpIn, par } = e.data, p = Object.assign({}, P[kind] || P.sun, par || {}), rp = rpIn || R[kind] || R.sun, D = new Uint8ClampedArray(S * S * 4), half = S / 2, rad = half - 1, spots = [];
      for (let i = 0; i < p.spots; i++) spots.push([(h2(i, 1, seed) - .5) * 2.4, (h2(i, 2, seed) > .5 ? 1 : -1) * (.2 + .35 * h2(i, 3, seed)), (.03 + .07 * h2(i, 4, seed)) * (p.ss || 1)]);
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { const x = (px + .5 - half) / rad, y = (py + .5 - half) / rad, r2 = x * x + y * y; if (r2 > 1.0) continue;
        const mu = Math.sqrt(1 - r2), lon = Math.atan2(x, mu), lat = Math.asin(Math.max(-1, Math.min(1, y))), wx = fbm(lon * 2 + seed, lat * 2, seed) - .5, wy = fbm(lon * 2, lat * 2 + seed, seed + 4) - .5; let I;
        if (p.smooth) { I = (1 - p.limb * (1 - mu) - .1 * (1 - mu) * (1 - mu)) * (1 + .06 * (fbm(lon * 3 + seed, lat * 3, seed) - .5)); for (const [sx, sy, sr] of spots) { const dx = lon - sx, dy = lat - sy, d = Math.sqrt(dx * dx + dy * dy); if (d < sr * 1.6) I *= d < sr ? .7 : .85; } }
        else if (p.bands) { const d = 1 - mu, v = lat * (p.nb || 5) + wx * 1.5 + .25 * Math.sin(lon * 2 + lat * 3), band = .5 + .5 * Math.sin(v * 3.1 + seed), patch = fbm(lon * 2.5 + wx, lat * 4 + wy, seed + 5); I = (1 - .55 * d - .25 * d * d) * (.76 + .07 * band + .17 * patch); }   // a brown dwarf: soft, low-contrast cloud belts and patches (its brightness varies by only a few per cent), under heavy limb darkening
        else if (p.photo) {   // a whole stellar disc: granules are far below a pixel here (the Sun has ~2 million), so what shows is limb darkening, spots and faculae
          const d = 1 - mu; I = .93 * (1 - p.limb * d - p.lv * d * d); const g1 = fbm(lon * p.fine / 1.6 + seed, lat * p.fine / 1.6, seed + 3) - .5, g2 = fbm(lon * p.big / 1.6 + seed, lat * p.big / 1.6, seed + 5); I *= 1 + p.gran * g1 + p.sg * (g2 - .5);
          if (p.fac) { const f = sm((fbm(lon * 7 + seed, lat * 7, seed + 8) - .58) / .12) * sm((d - .45) / .4) * (1 - sm((Math.abs(lat) - .7) / .2)); I *= 1 + p.fac * f; }   // faculae: bright magnetic patches that stand out near the limb
          for (const [sx, sy, sr] of spots) { const dx = (lon - sx) * Math.max(.35, mu), dy = lat - sy, q = Math.sqrt(dx * dx / Math.max(.35, mu) / Math.max(.35, mu) + dy * dy) / sr; if (p.ss > 1) { I *= 1 - p.sc * Math.exp(-q * q * 1.6); continue; } if (q < 1.8) { const k2 = q < .55 ? .22 + .1 * q : q < 1 ? .55 + .2 * (q - .55) / .45 : 1 - .12 * (1.8 - q) / .8; I *= 1 - p.sc * (1 - k2); } } }   // spots: a dark umbra inside a grey penumbra
        else if (p.soft) { const u = (lon + wx * .35) * p.big / 1.6 + seed, v = (lat + wy * .35) * p.big / 1.6, big = fbm(u * .8, v * .8, seed + 11), mid = fbm(u * 2.2 + wx * .6, v * 2.2 + wy * .6, seed + 12), fine = fbm(u * 7, v * 7, seed + 13), m = sm((big - .3) / .4) * .6 + sm((mid - .25) / .5) * .3 + fine * .1;   // a red supergiant: a handful of vast convection cells, soft-edged and blotchy as interferometers see them; no granular lanes at this scale
          I = .8 * Math.pow(mu, .6) * (1 - .25 * (1 - mu)) * (1 - p.con + p.con * 1.7 * m); }   // strong limb darkening: we see deep, hot layers at the centre and cool, high ones at the edge
        else { const u = (lon + wx * .5) * p.big / 1.6 + seed, v = (lat + wy * .5) * p.big / 1.6, [a1, a2, ia] = wor(u, v, seed), cell = (.55 + .45 * ia) * (1 - .55 * sm(a1 / .75)) * (.72 + .28 * sm((a2 - a1) / .4)), [b1, b2, ib] = wor((lon + wx * .15) * p.fine / 1.6, (lat + wy * .15) * p.fine / 1.6, seed + 3), gran = (.6 + .4 * ib) * (.5 + .5 * sm((b2 - b1) / .3)), [c1, c2] = wor(lon * p.micro / 1.6, lat * p.micro / 1.6, seed + 6), micro = 1 - Math.min(.12, S / 2048 * .12) * (1 - sm((c2 - c1) / .3)), n = fbm(u * 1.5, v * 1.5, seed + 9);
          I = (1 - p.limb * (1 - mu) - .18 * (1 - mu) * (1 - mu)) * (1 - p.con + p.con * (.6 * cell + .4 * gran)) * micro * (.74 + .52 * n);
          for (const [sx, sy, sr] of spots) { const dx = lon - sx, dy = lat - sy, d = Math.sqrt(dx * dx + dy * dy); if (d < sr * 1.6) I *= d < sr ? .35 + .3 * d / sr : .65 + .35 * (d - sr) / (sr * .6); } }
        if (p.gd) I *= 1 - p.gd * (1 - y * y);   // gravity darkening: a fast rotator's bulging equator is cooler
        if (p.hot) for (const [hx, hy, hr2] of p.hot) { const dx = lon - hx, dy = lat - hy, d2 = dx * dx + dy * dy; if (d2 < hr2 * hr2 * 4) I *= 1 + .35 * Math.exp(-d2 / (hr2 * hr2)); }
        const c = ramp(rp, I * 1.03), k = (py * S + px) * 4, edge = Math.min(1, (1 - Math.sqrt(r2)) * rad); D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2]; D[k + 3] = 255 * edge; }
      postMessage({ key, S, D }, [D.buffer]); };
  }
  const SURF2 = new Map(), SWQ = []; let SWK = null, SWbusy = false;
  const surfKind = id => ({ brown: 'brown', reddwarf: 'dwarfR', redgiant: 'giant', sun: 'sun', bluewhite: 'hot', bluegiant: 'hot', whitedwarf: 'white', neutron: 'white' })[id];
  function surfWorker() { if (SWK !== null) return SWK; try { SWK = new Worker(URL.createObjectURL(new Blob(['(' + SHADER.toString() + ')()'], { type: 'text/javascript' }))); SWK.onmessage = e => { const { key, S, D } = e.data, c = mk(S); c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(D.buffer), S, S), 0, 0); SURF2.set(key, c); SWbusy = false; while (SURF2.size > 14) SURF2.delete(SURF2.keys().next().value); pump(); }; SWK.onerror = () => { SWK = false; }; } catch (e) { SWK = false; } return SWK; }
  function pump() { if (SWbusy || !SWQ.length || !surfWorker()) return; const j = SWQ.pop(); SWQ.length = 0; SWbusy = true; SWK.postMessage(j); }
  const OBLATE = { 'Achernar': 1.35, 'Regulus': 1.32, 'Alderamin': 1.3, 'Altair': 1.2, 'Rasalhague': 1.15, 'Vega': 1.04, 'Denebola': 1.08, 'Zeta Ophiuchi': 1.18, 'Spica': 1.06 };   // equatorial / polar radius of the fastest-spinning stars
  const ACTIVE = { 'AU Microscopii': 14, 'YZ Ceti': 12, 'Proxima Centauri': 11, 'Wolf 359': 12, 'TRAPPIST-1': 6, 'Epsilon Eridani': 9, 'HD 189733': 8, 'Gliese 876': 6, 'Teegarden’s Star': 3 };
  const PULSE = { 'Delta Cephei': [4.637e5, .08], 'Polaris': [3.43e5, .015], 'Mira': [2.87e7, .2], 'Betelgeuse': [3.62e7, .05], 'R Doradus': [2.98e7, .08], 'L2 Puppis': [1.21e7, .07], 'Mu Cephei': [7.5e7, .04], 'Rasalgethi': [1.0e7, .05] };   // period (s), radius swing
  let SIMT = 0;
  function look(b) {   // everything that makes this star's face its own: a colour ramp from its real temperature, cell size from its radius, spots, bands, rotation
    const nm = b.n.split('#')[0], T = tempOf(b), R = RSUN(b), h = k => hs2(nm + k), kind = surfKind(b.id), bb = parseInt(bbHex(T).slice(1), 16), mx = (a, w, t) => a.map((v, i) => v + (w[i] - v) * t), C0 = [bb >> 16 & 255, bb >> 8 & 255, bb & 255], C = T < 4600 ? mx(C0, [255, 92, 30], .45 + clamp((4600 - T) / 1800) * .4) : T < 6600 ? mx(C0, [255, 186, 84], .5) : C0;   // the eye sees cool giants deep orange: saturate the blackbody a little
    const bt = clamp((T - 250) / 2400), btop = [72 + 183 * Math.pow(bt, .7), 20 + 102 * Math.pow(bt, 1.6), 32 + 28 * bt], bramp = [[0, btop.map(v => v * .06)], [.4, btop.map(v => v * .3)], [.75, btop.map(v => v * .68)], [1, btop]];   // a brown dwarf in visible light: a dim maroon ember (a 2,600 K one glows orange-red; a 285 K one is all but black)
    const hot = T > 7500, deep = hot ? mx(C, [20, 34, 110], .6).map(v => v * .35) : mx(C, [120, 10, 0], .55).map(v => v * .16), ramp = kind === 'brown' ? bramp : [[0, deep], [.32, hot ? C.map(v => v * .62) : mx(C, [150, 30, 0], .35).map(v => v * .5)], [.62, C.map(v => v * .9)], [.84, mx(C, [255, 255, 255], hot ? .4 : .18)], [1, mx(C, [255, 255, 255], hot ? .8 : T < 4600 ? .3 : .5)]];
    const par = {}; if (kind === 'giant' || kind === 'dwarfR' || kind === 'sun' || kind === 'hot') { const big = R > 400 ? 1.8 + h('b') * 1.2 : R > 60 ? 3 + h('b') * 2 : R > 8 ? 5 + h('b') * 3 : R > 1.5 ? 7 + h('b') * 3 : 8 + h('b') * 4; par.big = big; par.fine = big * (5 + 3 * h('f')); par.micro = par.fine * 3; }
    if (b.id === 'neutron') { par.limb = .12; par.con = .06; par.micro = 200; par.spots = 0; }   // light bending flattens a neutron star's limb
    if (kind === 'white') { if (nm === 'PG 1159−035') par.con = .12; if (nm === 'BPM 37093') par.micro = 300; }   // a pulsating pre-white dwarf churns
    if (ACTIVE[nm]) par.spots = ACTIVE[nm]; else if (kind === 'sun') par.spots = Math.floor(h('sp') * 8); else if (kind === 'dwarfR') par.spots = 2 + Math.floor(h('sp') * 6);
    if (OBLATE[nm]) par.gd = (OBLATE[nm] - 1) * .5;
    if (R > 400) par.hot = [[(h('h1') - .5) * 1.4, (h('h2') - .5) * 1.2, .35 + .2 * h('h3')], [(h('h4') - .5) * 1.6, (h('h5') - .5) * 1.4, .2 + .15 * h('h6')]];   // red supergiants show a few enormous convection cells, as interferometers see Betelgeuse
    if (kind === 'brown') { par.nb = 3 + Math.floor(h('nb') * 4); const tdw = clamp((1500 - T) / 600), top = btop.map((v, i) => v + ([v * .75, v * .55, v * 1.6][i] - v) * tdw * .5), rp2 = [[0, top.map(v => v * .06)], [.4, top.map(v => v * .3)], [.75, top.map(v => v * .68)], [1, top]]; return { kind, ramp: rp2, par, ob: 1 }; }   // L dwarfs glow a dull rust; methane-cooled T dwarfs lean towards a muted magenta, as sodium and potassium soak up the yellow
    return { kind, ramp, par, ob: OBLATE[nm] || 1 };
  }
  function surfFor(b, rpx) {   // the best picture of this star's face for this size, asking for a sharper one when needed
    const kind = surfKind(b.id); if (!kind) return null; const need = clamp(Math.pow(2, Math.ceil(Math.log2(rpx * 2.1))), 64, 2048), base = b.n.split('#')[0] + '|'; let best = null, bs = 0;
    for (let S = 64; S <= 2048; S *= 2) { const c = SURF2.get(base + S); if (c) { best = c; bs = S; if (S >= need) break; } }
    if (bs < need && surfWorker()) { const key = base + need; if (!SWQ.some(q => q.key === key)) { const lk = look(b); SWQ.push({ key, S: need, kind, seed: Math.floor(hs2(base) * 997) + 1, ramp: lk.ramp, par: lk.par }); } pump(); }
    if (best) { SURF2.delete(base + bs); SURF2.set(base + bs, best); } return best;
  }
  // pre-rendered sprites keep the heavy art out of the frame loop: a galaxy (arms, dust lanes, HII regions, bulge), a dense star cluster, tiled star layers and label bitmaps
  const SPR = new Map(), TILES = new Map(), LBL = new Map(), mk = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const GPAL = [['#ffe4bc', '#c4d4ff', '#ff9cb4'], ['#ffdcb0', '#b8ccff', '#ff8fae'], ['#ffe8c8', '#cfdcff', '#ffa0b0'], ['#ffd8a8', '#bcd2ff', '#ff96a8'], ['#ffeacc', '#c8d6ff', '#ffa8bc'], ['#ffe0b8', '#b4c8ff', '#ff8ca8']];   // real galaxy light: old golden stars in the bulge, blue-white young disc, pink hydrogen in star-forming knots
  const JETS = new Set(['Messier 87', 'Cygnus A', 'Centaurus A', '3C 273', '3C 279', 'OJ 287', 'S5 0014+81', 'TON 618', '3C 48']);   // radio-loud: only these launch kiloparsec jets (Sagittarius A* and the radio-quiet quasars do not)
  const GREAL_UNUSED = { 'Large Magellanic Cloud': 'flocc', 'Small Magellanic Cloud': 'flocc', 'Andromeda Galaxy': 'grand', 'Triangulum Galaxy': 'flocc', 'Messier 87': 'ell', 'Centaurus A': 'ell', 'Cygnus A': 'ell', 'Sagittarius A*': 'barred', 'TON 618': 'ell', 'Markarian 231': 'ring', '3C 273': 'ell', 'OJ 287': 'ell', '3C 48': 'flocc' };   // the real host galaxies where they are known (the Milky Way is a barred spiral; Markarian 231 is a disturbed merger)
  // the look of each galaxy, after real ones: whirl (M51, a grand-design spiral strung with pink star-forming knots, a small companion at the tip of an arm),
  // barred (NGC 1300: a long bar with straight dust lanes and arms from its ends), lens (a barred lenticular with an inner ring and faint blue outer arms),
  // redha (M106: arms glowing red with hydrogen), dustring (Andromeda: tightly wound, dusty arms like rings), flocc (M33: patchy fragments), irr (the Magellanic Clouds),
  // ell (M87), dustell (Centaurus A: an elliptical cut by a warped dust band), merger (Markarian 231: a bright core with tidal tails)
  const GLOOK = { 'Sagittarius A*': 'barred', 'Andromeda Galaxy': 'dustring', 'Triangulum Galaxy': 'flocc', 'Large Magellanic Cloud': 'irr', 'Small Magellanic Cloud': 'irr', 'Messier 87': 'ell', 'Cygnus A': 'ell', '3C 273': 'ell', 'TON 618': 'ell', 'OJ 287': 'ell', 'Centaurus A': 'dustell', 'Markarian 231': 'merger', '3C 48': 'redha' };
  const LOOKT = { whirl: 'grand', grand: 'grand', redha: 'grand', dustring: 'grand', barred: 'barred', lens: 'barred', flocc: 'flocc', irr: 'flocc', ell: 'ell', dustell: 'ell', merger: 'ell', ring: 'ring' };
  const gparams = b => { const h = k => hs2(b.n + k), base = String(b.n).split('#')[0], copy = String(b.n).includes('#'), t = h('gt'), look = !copy && GLOOK[base] || (t < .12 ? 'ell' : t < .17 ? 'ring' : t < .3 ? 'whirl' : t < .45 ? 'barred' : t < .55 ? 'lens' : t < .65 ? 'redha' : t < .75 ? 'flocc' : t < .82 ? 'dustell' : t < .87 ? 'merger' : 'grand'), type = LOOKT[look], a = h('a');
    const mw = base === 'Sagittarius A*' && !copy, m31 = base === 'Andromeda Galaxy', arms = mw ? 4 : look === 'whirl' || look === 'barred' || look === 'lens' || look === 'dustring' ? 2 : type === 'flocc' ? 5 + Math.floor(a * 3) : type === 'grand' ? (a < .55 ? 2 : a < .85 ? 3 : 4) : 3, wind = mw ? 3.2 : m31 ? 4.6 : look === 'dustring' ? 2.6 : type === 'flocc' ? 1.4 + h('w') * 1.0 : 1.2 + h('w') * 1.4;
    const barLen = look === 'barred' ? (base === 'Sagittarius A*' ? .3 : .38 + .1 * h('bl')) : look === 'lens' ? .26 : 0, barA = h('ba') * Math.PI, ph0 = barLen ? barA - wind * 1.7 * barLen : 0;   // arms leave from the ends of the bar
    return { type, look, arms, wind, barLen, barA, ph0, minor: mw, m31, pal: GPAL[Math.floor(h('p') * GPAL.length)] }; };
  // the same galaxy as live geometry, for close-ups: ~36,000 stars, diffuse arm blobs and dust lanes in unit coordinates, drawn crisp at any zoom (the sprite only serves the distant view)
  const DET = new Map();
  function galaxyField(b) {
    let f = DET.get(b.n); if (f) return f;
    let sd = Math.floor(hs2(b.n + 'seed') * 4294967296) >>> 0; const rnd = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const { arms, wind, pal } = gparams(b), NB = 12, bucket = [], styles = []; for (let c = 0; c < 3; c++) for (let a = 0; a < 4; a++) { bucket.push({ x: [], y: [], z: [] }); styles.push(rgba(pal[c], (c === 2 ? .5 : .12) + a * (c === 2 ? .12 : .09))); }
    const blobs = []; for (let k = 0; k < 700; k++) { const arm = k % arms, u = Math.pow(rnd(), .85), r = .08 + .9 * u, sc = (rnd() + rnd() - 1) * (.5 - .2 * u), th = arm * TAU / arms + wind * u * 1.7 + sc; blobs.push([r * Math.cos(th), r * Math.sin(th), (.04 + .11 * rnd()) , u < .25 ? pal[0] : pal[1]]); }
    const lanes = []; for (let arm = 0; arm < arms; arm++) { const pts = []; for (let i = 0; i <= 60; i++) { const u = .14 + .76 * i / 60, r = u, th = arm * TAU / arms + wind * u * 1.7 + .3; pts.push([r * Math.cos(th), r * Math.sin(th)]); } lanes.push(pts); }
    f = { bucket: [], styles, blobs, lanes, pal, arms, wind }; DET.set(b.n, f); return f;
  }
  // ---- stars that exist at every scale: the field is generated from hashed world cells at three neighbouring levels of detail that cross-fade as you zoom, so a galaxy never turns into a picture
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), h = (a, b) => hash(a * 127.1 + b * 311.7); return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy; };
  const hn = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };   // integer hash: hs2 takes strings, so numbers fed to it gave every star the same offset (a perfect grid)
  function cellStars(g, b, cx, cy, R, rot, SY, w, h, K, pal, arms, wind, alpha) { const GT = gparams(b).type, PH0 = gparams(b).ph0, r0g = .5 + .12 * hs2(b.n + 'rr');
    const cr = Math.cos(rot), sr = Math.sin(rot), X0 = [0, w, 0, w], Y0 = [0, 0, h, h], gx = [], gy = [];
    for (let i = 0; i < 4; i++) { const dx = (X0[i] - cx) / R, dy = (Y0[i] - cy) / (R * SY); gx.push(dx * cr + dy * sr); gy.push(-dx * sr + dy * cr); }
    const minx = Math.max(-1.1, Math.min(...gx)), maxx = Math.min(1.1, Math.max(...gx)), miny = Math.max(-1.1, Math.min(...gy)), maxy = Math.min(1.1, Math.max(...gy)); if (minx >= maxx || miny >= maxy) return;
    const lg = Math.log2(Math.max(1, R / (46 * K))), k0 = Math.floor(lg), fr = lg - k0, seed = hs2(b.n + 'cs') * 1000, SD = Math.floor(seed * 1000);
    for (const [lvl, wt] of [[k0 - 1, 1 - fr], [k0, 1], [k0 + 1, fr]]) { if (wt <= .01 || lvl < 0) continue;
      const cell = Math.pow(2, -lvl), sizeBase = (.55 + 1.0 * Math.pow(2, -(lvl - k0) * .5)) * K * .55, ix0 = Math.floor(minx / cell), ix1 = Math.floor(maxx / cell), iy0 = Math.floor(miny / cell), iy1 = Math.floor(maxy / cell);
      if ((ix1 - ix0 + 1) * (iy1 - iy0 + 1) > 2600) continue; const bk = [[], [], [], [], [], []], hz = lvl === k0 ? [] : null;
      for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) { const cxu = (ix + .5) * cell, cyu = (iy + .5) * cell, r = Math.hypot(cxu, cyu); if (r > 1.08) continue;
        const th = Math.atan2(cyu, cxu), armF = GT === 'ell' ? .5 : GT === 'ring' ? Math.exp(-Math.pow((r - r0g) / .07, 2)) * 2 : Math.pow(.5 + .5 * Math.cos(arms * (th - wind * 1.7 * r - PH0)), GT === 'flocc' ? 1.6 : 2.4) * (GT === 'flocc' ? .4 + 1.2 * vnoise(cxu * 5 + seed, cyu * 5) : 1), rho = GT === 'ell' ? (Math.exp(-r * 4.2) * 2.4 + .05) * (.7 + .5 * vnoise(cxu * 9 + seed, cyu * 9)) * (1 - Math.pow(Math.max(0, r - .85) / .23, 2)) : (Math.exp(-r * 3.4) * 1.5 + (GT === 'ring' ? .03 : .12)) * (.18 + 1.0 * armF) * (.35 + 1.3 * vnoise(cxu * 9 + seed, cyu * 9 + seed * .7)) * (1 - Math.pow(Math.max(0, r - .85) / .23, 2)), hk = ix * 73856093 ^ iy * 19349663 ^ lvl * 83492791;
        if (hz && hn(hk, 77, SD) < .6) { const jx = cxu + (hn(hk, 78, SD) - .5) * cell * 1.8, jy = cyu + (hn(hk, 79, SD) - .5) * cell * 1.8, hr = cell * R * (.45 + .9 * hn(hk, 80, SD)), hx = cx + (jx * cr - jy * sr) * R, hy = cy + (jx * sr + jy * cr) * R * SY; if (hx > -hr && hx < w + hr && hy > -hr && hy < h + hr) hz.push(hx, hy, hr, rho * (.5 + hn(hk, 81, SD))); }   // haze puffs: jittered in position, size and strength, never on a lattice
        const n = rho * 3.6, Lp = Math.exp(-n); let c = 0, pp = hn(hk, 50, SD); while (pp > Lp && c < 12) { c++; pp *= hn(hk, 50 + c, SD); }   /* Poisson count, so clumps and gaps look natural */ if (!c) continue;
        for (let j = 0; j < c; j++) { const u1 = hn(hk, j * 3 + 1, SD), u2 = hn(hk, j * 3 + 2, SD), u3 = hn(hk, j * 3 + 3, SD), px0 = (ix + u1) * cell, py0 = (iy + u2) * cell, sx = cx + (px0 * cr - py0 * sr) * R, sy = cy + (px0 * sr + py0 * cr) * R * SY;
          if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue; const rr = Math.hypot(px0, py0), col = rr < .2 ? 0 : (u3 > .965 ? 2 : 1), br = u3 > .965 ? 2 : (u3 > .8 ? 1 : 0); bk[col * 2 + (br ? 1 : 0)].push(sx, sy, sizeBase * (br === 2 ? 1.8 + 1.6 * u2 : .55 + 1.1 * u1 * u1)); } }
      if (hz) for (let j = 0; j < hz.length; j += 4) glowAt(g, hz[j], hz[j + 1], hz[j + 2], pal[1], Math.min(.22, hz[j + 3] * .1) * alpha * wt);
      bk.forEach((pts, i) => { if (!pts.length) return; const c = i >> 1, bright = i & 1; g.fillStyle = rgba(bright ? '#ffffff' : pal[c], (bright ? .9 : .42) * wt * alpha); g.beginPath(); for (let j = 0; j < pts.length; j += 3) { g.moveTo(pts[j] + pts[j + 2], pts[j + 1]); g.arc(pts[j], pts[j + 1], pts[j + 2], 0, TAU); } g.fill(); }); }
  }
  function galaxyDetail(g, b, cx, cy, R, rot, SY, w, h, K, hex, da, haze) {
    const f = galaxyField(b), cr = Math.cos(rot), sr = Math.sin(rot), kk = .42 * K * Math.pow(Math.max(1, R / (300 * K)), .15), fall = Math.min(1, Math.pow(650 * K / R, 1.3)), /* big blobs overlap more as you zoom in, so they thin out */ X = (x, y) => cx + (x * cr - y * sr) * R, Y = (x, y) => cy + (x * sr + y * cr) * R * SY;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = da;
    let n = gparams(b).type === 'ell' ? 1e9 : 0; for (const [bx, by, br, col] of f.blobs) { if (n > 220) break; const px = X(bx, by), py = Y(bx, by), rad = br * R; if (px < -rad || px > w + rad || py < -rad * SY || py > h + rad * SY) continue; glowAt(g, px, py, rad, col, .03 * haze * fall * clamp((2400 - R * 2.13) / 900)); if (++n > 220) break; }
    cellStars(g, b, cx, cy, R, rot, SY, w, h, K, f.pal, f.arms, f.wind, da);
    g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
    const GTy = gparams(b).type; if (false) f.lanes.forEach(pts => { for (const [lw, al] of [[.075, .16], [.033, .22]]) { g.strokeStyle = `rgba(8,6,18,${al * haze * fall * fall})`; g.lineWidth = Math.max(1, Math.min(lw * R * SY * 1.4, 90 * K)); g.beginPath(); let down = false, px0 = 0, py0 = 0; pts.forEach(([x, y], i) => { const px = X(x, y), py = Y(x, y); if (i) { const seen = !((px < -200 && px0 < -200) || (px > w + 200 && px0 > w + 200) || (py < -200 && py0 < -200) || (py > h + 200 && py0 > h + 200)); if (seen) { if (!down) g.moveTo(px0, py0); g.lineTo(px, py); down = true; } else down = false; } px0 = px; py0 = py; }); g.stroke(); } });
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1; const cr2 = R * .34; if (cx > -cr2 && cx < w + cr2 && cy > -cr2 && cy < h + cr2) { g.save(); g.translate(cx, cy); g.scale(1, SY); let gr = g.createRadialGradient(0, 0, 0, 0, 0, cr2); gr.addColorStop(0, rgba(f.pal[0], .3 * da * haze * fall)); gr.addColorStop(.35, rgba(f.pal[0], .1 * da * haze * fall)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, cr2, 0, TAU); g.fill(); g.restore(); }
    g.restore();
  }
  let BUILT = 0;   // at most one galaxy picture is painted per frame; the rest show a plain glow until their turn
  const LASTG = new Map();
  function galaxySprite(b, hex, need, rot = 0, sy = 1) {   // a picture per galaxy at its tilt and turn (re-made only if it turns noticeably); the best finished one is used while a better one is painted
    const want = need > 420 ? 768 : 384, q = '|' + Math.round(rot / .06) + '|' + Math.round(sy * 50), kHi = b.n + '|768' + q, kLo = b.n + '|384' + q, hi = SPR.get(kHi), lo = SPR.get(kLo);
    if (hi && hi.done) return hi.c; if (lo && lo.done && want === 384) return lo.c; const last = LASTG.get(b.n), best = lo && lo.done ? lo.c : last ? last : null;
    if (BUILT >= 1) return best; BUILT++; const key = lo && lo.done ? kHi : kLo; let st = SPR.get(key);
    if (!st) { if (SPR.size >= 30) SPR.delete(SPR.keys().next().value); st = galaxyBake(b, key === kHi ? 768 : 384, Math.round(rot / .06) * .06, Math.round(sy * 50) / 50); SPR.set(key, st); }
    galaxyStep(st, 9); if (st.done) { LASTG.set(b.n, st.c); return st.c; } return best;
  }
  function galaxyBake(b, S, rot = 0, sy = 1) {   // what a galaxy really is, as light, after Hubble's pictures of real ones
    const P = gparams(b), H = k => hs2(b.n + k), c = mk(S), direct = P.type === 'ell' || sy > .985 && Math.abs(rot) < 1e-6, S0 = direct ? S : S > 500 ? 512 : 384;
    return { c, S, S0, rot, sy, direct, phase: 'face', E: direct ? null : new Float32Array(S0 * S0 * 3), Dd: direct ? null : new Float32Array(S0 * S0), row: 0, im: direct ? c.getContext('2d').createImageData(S, S) : null, done: false, ...P, sd: H('sd') * 40, r0: .5 + .12 * H('rr'), cmpA: H('ca') * TAU, hii: P.look === 'whirl' ? 2.2 : P.look === 'flocc' || P.look === 'irr' ? 1.7 : P.look === 'redha' ? 1.2 : P.look === 'lens' ? .25 : .9, warmth: .85 + .3 * H('wm') };
  }
  function galaxyStep(st, ms) {   // three passes: the face-on light and dust maps, then (for discs) each sightline ray-marched through the disc at its real tilt
    if (st.done) return;

    const { S0, im, look, type, arms, wind, sd, barA, barLen, ph0, r0, hii, cmpA, warmth, minor, m31 } = st, Hh = S0 / 2, Rr = S0 * .47, t0 = performance.now(), cA = Math.cos(barA), sA = Math.sin(barA);
    const CB = [1, .86 * warmth + .1, .7 * warmth + .1], CD = [.66, .76, .98], CH = [1, .32, .52], CR = [1, .28, .3];   // old stars, young stars, hydrogen knots, diffuse hydrogen
    const sers = (r, re, k) => Math.exp(-7.67 * (Math.pow(Math.max(r, .004) / re, .25) - 1)) * k, ridge = (q, p) => Math.pow(1 - Math.abs(2 * q - 1), p);
    const pix = (x, y, r) => { let IB = 0; let Rc = 0, Gc = 0, Bc = 0, ext = 0; const add = (c, I) => { Rc += c[0] * I; Gc += c[1] * I; Bc += c[2] * I; };
        const w1 = fbm2(x * 3 + sd, y * 3, 4) - .5, w2 = fbm2(x * 7 - sd, y * 7, 3), taper = 1 - sm3(clamp((r - .8) / .32));
        if (type === 'ell') {
          if (look === 'merger') { const th = Math.atan2(y, x), psi = 2 * (th - 2.2 * r) + 1.5 * w1, tail = Math.pow(.5 + .5 * Math.cos(psi), 6) * sm3(clamp((r - .15) / .2)) * (1 - sm3(clamp((r - .95) / .2))) * (.4 + .9 * w2);
            add(CB, sers(r, .07, .06)); add([.9, .86, .86], tail * .1 * Math.exp(-r)); add(CD, tail * .05 * sm3(clamp((fbm2(x * 70 + sd, y * 70, 2) - .62) / .12))); ext = ridge(fbm2(x * 8 + sd, y * 8, 4), 9) * .6 * Math.exp(-r * 5); }   // a bright core, two tidal tails pulled out by the collision, chaotic dust
          else { const re = Math.hypot(x, y / .86); add(CB, sers(re, .32, .13) * (1 - sm3(clamp((re - .95) / .2))));
            if (look === 'dustell') { const xb = x * .94 + y * .34, yb = -x * .34 + y * .94, wv = yb - .06 * Math.sin(xb * 4 + 1) - .03 * w1, band = Math.exp(-Math.pow(wv / .09, 2)) * (1 - sm3(clamp((Math.abs(xb) - .62) / .18)));   // Centaurus A: a warped lane of dust from a swallowed spiral
              ext = band * (.75 + .25 * ridge(fbm2(xb * 14 + sd, yb * 14, 3), 3)); add([1, .55, .35], band * .05 * Math.exp(-Math.abs(xb) * 2)); add(CD, Math.exp(-Math.pow((Math.abs(wv) - .06) / .02, 2)) * .03 * sm3(clamp((fbm2(x * 40, y * 40, 2) - .6) / .2)) * (Math.abs(xb) < .4 ? 1 : 0)); } } }
        else { const th = Math.atan2(y, x), Ib = sers(r, look === 'lens' ? .07 : barLen ? .06 : m31 ? .15 : look === 'dustring' ? .11 : .085, m31 ? .06 : .045); let Id = Math.exp(-r / (look === 'irr' ? .35 : .27)) * .9 * taper, armI = 0, lane = 0, knot = 0;
          if (type === 'ring') { const q = Math.exp(-Math.pow((r - r0 + .05 * w1) / .07, 2)); armI = q * (.6 + .8 * w2) * 1.6; Id *= .35; }
          else if (look === 'irr') { const ox = x + .12, bar = Math.exp(-((ox * .9 + y * .4) ** 2 / .05 + (-ox * .4 + y * .9) ** 2 / .006)); armI = sm3(clamp((fbm2(x * 3.5 + sd, y * 3.5, 4) - .35) / .4)) * .8; Id *= .4 + .5 * armI; add(CB, bar * .3); Id *= .8; }   // an off-centre bar in a clumpy, armless disc
          else { const w3 = fbm2(x * 14 + sd, y * 14, 3) - .5, rin = barLen || .12, psi = arms * (th - wind * 1.7 * r - ph0) + (type === 'flocc' ? 4.5 : look === 'whirl' ? 1 : 2) * w1 + .9 * w3, inner = sm3(clamp((r - rin) / .14));
            const sharp = look === 'whirl' ? 3.2 : look === 'dustring' ? 4 : type === 'flocc' ? 1.4 : 2.2; armI = Math.pow(.5 + .5 * Math.cos(psi), sharp) * (type === 'flocc' ? .3 + 1.2 * w2 : .5 + .8 * w2) * inner; if (minor) armI *= .42 + .58 * (.5 + .5 * Math.cos(2 * (th - wind * 1.7 * r - ph0) + .5 * w1));   // the Milky Way: two major arms from the bar's ends, two fainter minor ones
            if (m31) { const rg = Math.exp(-Math.pow((r - .6 - .03 * w1) / .07, 2)); armI = Math.max(armI * .7, rg * (.6 + .7 * w2)); }   // Andromeda's great ring of star formation, 10 kpc out
            const fil = ridge(fbm2(x * 9 + sd, y * 9 - sd, 4), 10) * .8 + ridge(fbm2(x * 20 - sd, y * 20, 3), 10) * .5, coh = Math.pow(.5 + .5 * Math.cos(psi - arms * .3 * (1 + .3 * w1)), look === 'whirl' ? 26 : look === 'dustring' ? 8 : 5);   // dust: coherent lanes on the inner edge of the arms, laced with filaments
            lane = clamp((coh * (look === 'whirl' ? .55 : look === 'dustring' ? .6 : .5) + .45 * fil) * sm3(clamp((r - .05) / .1)) * taper * (type === 'flocc' ? .7 : 1.1));
            knot = sm3(clamp((fbm2(x * 44 + sd, y * 44, 3) - .66) / .14)) * Math.pow(.5 + .5 * Math.cos(psi + .5), 2) * inner * (r > .15 ? 1 : 0);   // star-forming knots strung along the leading edge
            if (look === 'lens') { const xl = x * cA + y * sA, yl = -x * sA + y * cA, rl = Math.hypot(xl / 1.18, yl / .86), lens = Math.exp(-Math.pow(rl / .3, 2.5)), ring = Math.exp(-Math.pow((rl - .46 - .03 * w1) / .045, 2)) * (.45 + .6 * w2); add(CB, lens * .5 + ring * .22); Id *= .25 + .75 * sm3(clamp((r - .55) / .1)); armI *= .7; lane *= .25; }   // the bright oval lens and inner ring of a barred lenticular, with a dark gap between
            if (barLen) { const xr = x * cA + y * sA, yr = -x * sA + y * cA, L = barLen; add(CB, Math.exp(-(xr * xr / (L * L * .6) + yr * yr / (L * L * .07))) * .5); if (look === 'barred') { Id *= .62 + .38 * sm3(clamp((r - L * .8) / .2)); lane = Math.max(lane, Math.exp(-Math.pow((yr * Math.sign(xr) + L * .12) / .014, 2)) * sm3(clamp((Math.abs(xr) - .05) / .08)) * (1 - sm3(clamp((Math.abs(xr) - L) / .08))) * .55); } }   // the bar, its straight dust lanes, and the dim zone inside the arms
            if (look === 'redha') add(CR, Id * armI * .5 * (.5 + w2) + Id * .08 * fil);   // M106: hydrogen glowing red across the arms
            if (look === 'whirl') { const ca = Math.cos(cmpA), sa = Math.sin(cmpA), cx = .86 * ca, cy = .86 * sa, dc = Math.hypot(x - cx, y - cy); add([1, .84, .62], sers(dc, .1, .05)); ext = Math.max(ext, ridge(fbm2(x * 12 + sd, y * 12, 3), 8) * .7 * Math.exp(-dc * 9)); } }   // the small companion at the tip of an arm, veiled in dust
          const clump = sm3(clamp((fbm2(x * 34 + sd, y * 34, 3) - .55) / .25)), spark = sm3(clamp((fbm2(x * 90 - sd, y * 90, 2) - .72) / .08)) * armI, mixd = sm3(clamp((r - .08) / .45));
          add([CB[0] + (CD[0] - CB[0]) * mixd, CB[1] + (CD[1] - CB[1]) * mixd, CB[2] + (CD[2] - CB[2]) * mixd], Id * (.55 + .6 * armI)); add(CD, Id * armI * (.25 + .5 * clump) + Id * spark * 1.6); add(CH, Id * knot * hii); IB = Ib; ext = Math.max(ext, lane * (.35 + .65 * Math.max(armI * 1.6, sm3(clamp((.45 - r) / .3))))); }
return [Rc, Gc, Bc, ext, IB]; };
    const tone = (Rc, Gc, Bc, D, k) => { const ex = 2.5, R2 = 1 - Math.exp(-ex * Rc), G2 = 1 - Math.exp(-ex * Gc), B2 = 1 - Math.exp(-ex * Bc), mx = Math.max(R2, G2, B2, 1e-4); D[k] = R2 / mx * 255; D[k + 1] = G2 / mx * 255; D[k + 2] = B2 / mx * 255; D[k + 3] = Math.min(1, mx) * 255; };
    if (st.phase === 'face') { while (st.row < S0 && performance.now() - t0 < ms) { const j = st.row++; for (let i = 0; i < S0; i++) { const x = (i + .5 - Hh) / Rr, y = (j + .5 - Hh) / Rr, r = Math.hypot(x, y); if (r > 1.2) continue; const v = pix(x, y, r), q = j * S0 + i;
          if (st.direct) { const e = 1 - (look === 'dustell' ? .92 : .55) * v[3]; tone((v[0] + CB[0] * v[4]) * Math.pow(e, .4), (v[1] + CB[1] * v[4]) * Math.pow(e, 1.05), (v[2] + CB[2] * v[4]) * Math.pow(e, 1.6), im.data, q * 4); }
          else { st.E[q * 3] = v[0]; st.E[q * 3 + 1] = v[1]; st.E[q * 3 + 2] = v[2]; st.Dd[q] = -Math.log(1 - .6 * Math.min(.98, v[3])); } } }
      if (st.row < S0) return; if (st.direct) { st.c.getContext('2d').putImageData(im, 0, 0); st.done = true; st.im = null; return; } st.phase = 'proj'; st.row = 0; st.out = st.c.getContext('2d').createImageData(st.S, st.S); }
    // the sightline through a disc of finite thickness: stars in a sech^2 layer, dust in a thinner one; light is gathered front to back and dimmed (and reddened) by the dust in front of it
    const S = st.S, O = st.out.data, Ho = S / 2, Ro = S * .47, c = Math.max(.02, st.sy), sn = Math.sqrt(1 - c * c), cr = Math.cos(st.rot), sr = Math.sin(st.rot), h = .04, hd = .016, E = st.E, Dd = st.Dd, qp = Math.sqrt(c * c + .36 * sn * sn), reB = barLen ? .06 : m31 ? .15 : look === 'dustring' ? .11 : look === 'lens' ? .07 : .085, kB = m31 ? .06 : .045;
    const at = (fu, fv, out) => { const fx = fu * Rr + Hh - .5, fy = fv * Rr + Hh - .5, ix = Math.floor(fx), iy = Math.floor(fy); if (ix < 0 || iy < 0 || ix >= S0 - 1 || iy >= S0 - 1) { out[0] = out[1] = out[2] = out[3] = 0; return; } const ax = fx - ix, ay = fy - iy, q00 = iy * S0 + ix, w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      for (let ch = 0; ch < 3; ch++) out[ch] = E[q00 * 3 + ch] * w00 + E[(q00 + 1) * 3 + ch] * w10 + E[(q00 + S0) * 3 + ch] * w01 + E[(q00 + S0 + 1) * 3 + ch] * w11; out[3] = Dd[q00] * w00 + Dd[q00 + 1] * w10 + Dd[q00 + S0] * w01 + Dd[q00 + S0 + 1] * w11; };
    const smp = [0, 0, 0, 0];
    while (st.row < S && performance.now() - t0 < ms) { const j = st.row++; for (let i = 0; i < S; i++) { const X = (i + .5 - Ho) / Ro, Y = -(j + .5 - Ho) / Ro; if (Math.hypot(X, Y) > 1.2) continue;
        let ta = -1e9, tb = 1e9; if (c > .02) { ta = (Y * sn - 3 * h) / c; tb = (Y * sn + 3 * h) / c; } if (sn > .02) { ta = Math.max(ta, (-1.2 - Y * c) / sn); tb = Math.min(tb, (1.2 - Y * c) / sn); } else { ta = Math.max(ta, -3 * h); tb = Math.min(tb, 3 * h); }
        let Rc = 0, Gc = 0, Bc = 0, tau = 0;
        if (tb > ta) { const N = Math.round(8 + 40 * sn), dt = (tb - ta) / N; for (let n = 0; n < N; n++) { const t = tb - (n + .5) * dt, v = Y * c + t * sn, w = -Y * sn + t * c, fu = X * cr - v * sr, fv = X * sr + v * cr; at(fu, fv, smp);
            const chs = 1 / Math.cosh(w / h), chd = 1 / Math.cosh(w / hd), ps = chs * chs / (2 * h) * dt, pd = chd * chd / (2 * hd) * dt, aR = Math.exp(-tau * .6), aG = Math.exp(-tau), aB = Math.exp(-tau * 1.45);
            Rc += smp[0] * ps * aR; Gc += smp[1] * ps * aG; Bc += smp[2] * ps * aB; tau += smp[3] * pd; } }
        const rb = Math.hypot(X, Y / qp), Ib = sers(rb, reB, kB) * Math.exp(-tau * .5);   // the bulge is a round 3D spheroid: it stays round however the disc is tilted, half behind the dust
        tone(Rc + CB[0] * Ib, Gc + CB[1] * Ib * Math.exp(-tau * .2), Bc + CB[2] * Ib * Math.exp(-tau * .4), O, (j * S + i) * 4); } }
    if (st.row >= S) { st.c.getContext('2d').putImageData(st.out, 0, 0); st.done = true; st.E = st.Dd = st.out = null; }
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
    if (r > 90) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(hex, a)); gr.addColorStop(.3, rgba(hex, a * .45)); gr.addColorStop(.65, rgba(hex, a * .12)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); return; }   // big glows are true gradients: a small texture stretched that far would show its pixels
    g.globalAlpha = a; g.drawImage(c, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
  }
  function starTile(sd, per, T = 640) { const key = sd + '|' + per + '|' + T; let c = TILES.get(key); if (!c) { c = mk(T); starfield(c.getContext('2d'), T, T, 0, Math.round(T * T / per), sd); TILES.set(key, c); } return c; }
  function labelImg(l) {
    const sz = Math.round(l.size / 2) * 2, key = l.text + '|' + sz + '|' + l.color + '|' + PREF.font; let e = LBL.get(key);
    if (!e) { if (LBL.size > 260) LBL.clear(); const probe = mk(8).getContext('2d'); const F = lf(); probe.font = `${F.w} ${sz * F.s}px ${F.f}`; try { probe.letterSpacing = (sz * F.s * F.ls) + 'px'; } catch (e) {} const wd = Math.ceil(probe.measureText(F.caps ? l.text.toUpperCase() : l.text).width + sz * 1.6), c = document.createElement('canvas'); c.width = wd; c.height = Math.ceil(sz * 2); drawLabel(c.getContext('2d'), { ...l, size: sz, x: wd / 2, y: sz * 1.3 }); e = { c, ox: wd / 2, oy: sz * 1.3 }; LBL.set(key, e); }
    return e;
  }
  const BSPR = new Map();
  function bodySprite(b) {   // small bodies are stamped from a cached frame instead of being repainted every frame
    let c = BSPR.get(b.n); if (c) { BSPR.delete(b.n); BSPR.set(b.n, c); return c; }
    if (BSPR.size >= 48) BSPR.delete(BSPR.keys().next().value);
    c = mk(256); const k = c.getContext('2d'); paintBody(k, b.id, 128, 128, 16, 2 + b.idx, b); BSPR.set(b.n, c); return c;
  }
  function universe(g, w, h, t, lay, opt = {}) {
    BUILT = 0; CPB = 0; g.clearRect(0, 0, w, h); if (opt.ov) { opt.ov.g.setTransform(1, 0, 0, 1, 0, 0); opt.ov.g.clearRect(0, 0, opt.ov.g.canvas.width, opt.ov.g.canvas.height); } const cam = opt.cam || { x: 0, y: 0, z: .1 }, Z = cam.z, SY = .56, U = Math.min(w, h), K = Math.max(1, w / 760), B = lay.bodies;
    const OX = cam.ox || 0, OY = cam.oy || 0;   // the camera is an anchor plus a fine offset: a moon a few thousand km from its planet sits ~1e-10 world units away, below what one float can resolve next to galactic coordinates
    if (!opt.noStars) for (const [par, per, sd] of [[.04, 9000, 9], [.1, 7000, 27]]) { const tile = starTile(sd, per, sd === 9 ? 640 : 1013), T = tile.width, ox = Math.round((((cam.x + OX) * par) % T + T) % T), oy = Math.round((((cam.y + OY) * par) % T + T) % T); for (let x = -ox; x < w; x += T) for (let y = -oy; y < h; y += T) g.drawImage(tile, x, y); }
    if (!B.length) return [];
    SIMT = opt.pt != null ? opt.pt : t; const PH = (opt.tau != null ? opt.tau : t) * 1.5, SPN = opt.spin != null ? opt.spin : PH * .0007, toS = (wx, wy) => [((wx - cam.x) - OX) * Z + w / 2, ((wy - cam.y) - OY) * Z + h / 2], W = [], vis = (x, y, m) => x > -m && x < w + m && y > -m && y < h + m, newT = opt.newId, born = n => newT === n ? clamp((opt.tNew == null ? 9 : opt.tNew) / 1.4) : 1;
    B.forEach((b, i) => { if (b.parent < 0) { W[i] = [0, 0, 0]; return; } if (b.real) { const gb = B[b.gi], f = gframe(gb, SPN), c = Math.cos(f.rot), sn = Math.sin(f.rot), [x, y] = b.real; W[i] = [W[b.gi][0] + (x * c - y * sn) * gb.rg, W[b.gi][1] + (x * sn + y * c) * gb.rg * f.sy, 0]; return; } if (b.fixed) { const ph = opt.phases ? opt.phases[i] : PH * TAU / b.T, c = Math.cos(ph), sn = Math.sin(ph), dx = b.px - b.nx, dy = b.py - b.ny; W[i] = [b.nx + dx * c - dy * sn, b.ny + dx * sn + dy * c, 0]; return; } if (b.arm) { W[i] = armW(B[b.gi], W[b.gi], b.n, SPN); return; } const q = kepAt(b, PH, opt.phases ? opt.phases[i] : null), p = W[b.parent]; W[i] = [p[0] + q[0], p[1] + q[1] * SY, q[1]]; });
    const NU = []; B.forEach((b, i) => { if (b.tier === 'nucleus') NU.push(i); });
    const col = b => OBJ[b.idx].c;
    // galaxy glow and spiral dust, then sub-cluster halos
    B.forEach((b, i) => { const reach = b.reach || (b.tier === 'nucleus' ? 340 : 0); if (b.tier === 'member' || !reach || reach * Z > 2.5e6) return; const gal = b.tier === 'nucleus', R = Math.max(gal ? reach * 1.15 * Z : (reach * 1.5 + 200) * Z, 0), p = toS(W[i][0], W[i][1]); if (R < 9 * K || !vis(p[0], p[1], R * 1.2)) return;
      if (!gal && R > w * 3) return;
      g.save(); g.translate(p[0], p[1]);
      if (gal) { const fr = gframe(b, SPN), rot = fr.rot, gSY = fr.sy, big = R / K, fadeS = clamp(1 - (R * 2.13 - 2600) / 2600), da = clamp((R * 2.13 - 360) / 360), haze = .1 + .9 * clamp(1 - (big - 1400) / 2600); if (fadeS > 0) { const D = R * 2.13, ell = gparams(b).type === 'ell', sp = galaxySprite(b, col(b), D, ell ? 0 : rot, ell ? 1 : gSY); g.save(); g.globalAlpha = fadeS; if (sp) g.drawImage(sp, -D / 2, -D / 2, D, D); else { g.scale(1, ell ? 1 : gSY); glowAt(g, 0, 0, R * 1.2, col(b), .5); } g.restore(); }   /* the picture is already the galaxy as seen, ray-marched at its tilt */ if (da > 0) { glowAt(g, 0, 0, R * 1.05, col(b), .16 * da * clamp(2.2 - big / 700)); g.restore(); g.save(); g.globalCompositeOperation = 'lighter'; galaxyDetail(g, b, p[0], p[1], R, rot, gSY, w, h, K, col(b), da, haze); g.restore(); g.save(); g.translate(p[0], p[1]); } } else { const D = R * 2.1, pal = [col(b), col(b), '#ffffff']; if (D < 360) g.drawImage(clusterSprite(b, col(b)), -D / 2, -D / 2, D, D); else { glowAt(g, 0, 0, R * 1.05, col(b), .22); g.restore(); g.save(); cellStars(g, b, p[0], p[1], R, 0, 1, w, h, K, pal, 3, 0, clamp((D - 360) / 300)); g.restore(); g.save(); g.translate(p[0], p[1]); } }
      g.restore(); });
    // orbits: a faint ellipse around the parent, drawn only when big enough to read, at most a budget of them (nearest the view first), stroked in three batches
    {
      const cand = []; B.forEach((b, i) => { if (b.parent < 0 || b.arm || b.fixed || b.real) return; const ap = b.a * (1 + b.e) * Z; if (ap < 10 * K || ap > w * 5) return; const c0 = toS(W[b.parent][0], W[b.parent][1]), dist = Math.hypot(Math.max(0, -c0[0], c0[0] - w), Math.max(0, -c0[1], c0[1] - h)); if (dist > ap * 1.3) return; cand.push({ b, ap, c0, foc: opt.focus === b.n || B[b.parent].n === opt.focus, pr: (opt.focus === b.n || B[b.parent].n === opt.focus ? -1e9 : 0) + Math.hypot(c0[0] - w / 2, c0[1] - h / 2) }); });
      cand.sort((x, y) => x.pr - y.pr); const paths = { f: [], m: [], t: [] };
      cand.slice(0, 10).forEach(c => (c.foc ? paths.f : c.b.tier === 'member' ? paths.m : paths.t).push(c));
      for (const [key, st, lw] of [['m', 'rgba(255,255,255,.1)', 1], ['t', 'rgba(190,200,255,.14)', 1], ['f', 'rgba(255,255,255,.3)', 2]]) { if (!paths[key].length) continue; g.strokeStyle = st; g.lineWidth = lw * K; g.beginPath();
        paths[key].forEach(({ b, ap }) => { const cs = Math.cos(b.om), sn = Math.sin(b.om), pw = W[b.parent], nseg = ap < 90 * K ? 36 : Math.min(160, Math.round(48 + ap / (6 * K))), bb = b.a * Math.sqrt(1 - b.e * b.e), mg = 40 * K; let px0 = 0, py0 = 0, down = false;
          for (let k = 0; k <= nseg; k++) { const E = k / nseg * TAU, x = b.a * (Math.cos(E) - b.e), y = bb * Math.sin(E), px = (pw[0] + x * cs - y * sn - cam.x - OX) * Z + w / 2, py = (pw[1] + (x * sn + y * cs) * SY - cam.y - OY) * Z + h / 2;
            if (k) { const seen = !((px < -mg && px0 < -mg) || (px > w + mg && px0 > w + mg) || (py < -mg && py0 < -mg) || (py > h + mg && py0 > h + mg)); if (seen) { if (!down) g.moveTo(px0, py0); g.lineTo(px, py); down = true; } else down = false; } px0 = px; py0 = py; } });
        g.stroke(); }
    }
    const labels = [], items = B.map((b, i) => ({ b, i, p: toS(W[i][0], W[i][1]), z: W[i][1] })).sort((x, y) => x.z - y.z), pos = [], zs = Math.pow(Z, .42) * Math.pow(.7, .58);
    CPL = 0; const spreadMode = PREF.dup === 'spread';
    if (!opt.noEye) { let top = -Infinity; items.forEach(it => { const b = it.b; if (b.ghost || b.id === 'quasar' || b.id === 'neutron' || (opt.filter && !opt.filter.has(b.id))) return; const m = Math.max(physR(b) * RSU * Z * 4, 2); if (it.p[0] > -m && it.p[0] < w + m && it.p[1] > -m && it.p[1] < h + m) top = Math.max(top, Math.log10(lumOf(b) + 1e-9)); });
      const E = lay._eye || (lay._eye = { v: null, t: 0 }), now = performance.now(); if (top > -Infinity) { if (E.v == null) E.v = top; else E.v += (top - E.v) * (1 - Math.exp(-Math.min(.1, (now - E.t) / 1000) * 4)); } E.t = now; EYE = E.v; EYEF = opt.focus; }   // the eye adapts to the brightest star in view
    items.forEach(it => { if (it.b.land) { const b = it.b, Rp = b.rly / LYU * Z, fov = w / Z * LYU; if (b.land === 'struct') { const on = clamp((fov - 15000) / 15000) * clamp((300000 - fov) / 100000); pos.push({ n: b.n, id: 'landmark', ghost: true, x: it.p[0], y: it.p[1], wx: W[it.i][0], wy: W[it.i][1], r: on > .3 ? 26 * K : 0, tier: 'landmark' }); if (on > 0 && !opt.noLabels && PREF.on && vis(it.p[0], it.p[1], 0)) labels.push({ lbl: { text: b.n, x: it.p[0], y: it.p[1], size: 13 * K, color: `rgba(230,214,190,${.55 * on})` }, pr: 2, m: 0 }); return; }   // a structure of the galaxy: a name at galactic scale only
        pos.push({ n: b.n, id: 'landmark', ghost: true, x: it.p[0], y: it.p[1], wx: W[it.i][0], wy: W[it.i][1], r: fov > 60000 ? 0 : Math.max(Rp, 10 * K), tier: 'landmark' }); if (!vis(it.p[0], it.p[1], Rp + 40 * K) || fov > 60000) return; const sz = Math.max(Rp, 2.2 * K), fade = clamp((60000 - fov) / 30000);   // a landmark: drawn at true size, never smaller than a faint mark
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = fade * (b.land === 'emission' ? .75 : .9) * (Rp < 2.2 * K ? .6 : 1); const tx = b.land === 'snr' ? snrTex(b.src) : landSprite(b.n, b.land); if (tx) g.drawImage(tx, it.p[0] - sz, it.p[1] - sz * tx.height / tx.width, sz * 2, sz * 2 * tx.height / tx.width); g.restore();
        if (!opt.noLabels && PREF.on && (Rp > 10 * K || fov < 9000)) labels.push({ lbl: { text: b.n, x: it.p[0], y: it.p[1] + Math.max(Rp, 4 * K) + 16 * K, size: 12 * K, color: `rgba(215,205,230,${.55 * fade})` }, pr: 3, m: 0 });
        return; }
      if (it.b.ghost) { { const mw = it.i === 0, R = B[it.i].rg * Z; if (!opt.noLabels && PREF.on && vis(it.p[0], it.p[1], 0) && R < w * 2 && (mw || R > 14 * K)) labels.push({ lbl: { text: it.b.ghost, x: it.p[0], y: it.p[1] + (mw ? 30 : 22) * K, size: (mw ? 17 : 13) * K, color: `rgba(205,210,235,${mw ? .62 : .5})` }, pr: mw ? 0 : 3, m: 0 }); } pos.push({ n: it.b.n, id: 'galaxy', ghost: true, x: it.p[0], y: it.p[1], wx: W[it.i][0], wy: W[it.i][1], r: 0, tier: 'nucleus' }); return; }   // a galaxy you have not yet reached the heart of: its light, its name, nothing to pick
      const b = it.b, i = it.i, nuc = b.tier === 'nucleus', gRs = B[b.gi].rg * Z, sz = nuc ? 1 : clamp(Math.log10(Math.max(1, gRs / (120 * K))) / Math.log10(40)), rpx = physR(b) * RSU * Z, bn = born(b.n);   // true size on screen: the galaxy is 10^12 times bigger than a star, so stars stay points of light until you are very close
      const tint = bbHex(tempOf(b)), toS2 = toS, co = { K, SY, Z, w, h, toS: toS2, rpx, sz, t, cc: opt.cc, fc: opt.focus === b.n ? opt.fc : 0, place: (spreadMode || b.real || b.home) && (b.count || 1) > 1 ? k => { const gi = NU[Math.floor(hs2(b.n + 'cg' + k) * NU.length)], wp = armW(B[gi], W[gi], b.n + '#' + k, SPN), sp = toS(wp[0], wp[1]); return { x: sp[0], y: sp[1], wx: wp[0], wy: wp[1] }; } : null };
      const many = (b.count || 1) > 1, dim = opt.filter && !opt.filter.has(b.id) && opt.focus !== b.n;
      if (!vis(it.p[0], it.p[1], rpx * 4 + 80)) { if ((b.real || b.home) && !(opt.filter && !opt.filter.has(b.id))) drawSystem(g, b, it.p[0], it.p[1], Z, K, w, h, labels, pos, W[i][0], W[i][1]); const cps = many ? copies(g, b, W[i], b.count, { ...co, draw: true }) : null; pos.push({ n: b.n, id: b.id, x: it.p[0], y: it.p[1], wx: W[i][0], wy: W[i][1], r: 0, tier: b.tier, copies: cps }); return; }
      if (dim) g.globalAlpha = .13;
      if (bn < 1) ring(g, it.p[0], it.p[1], (10 + 60 * bn) * K, tint, .7 * (1 - bn), 2 * K);
      if (nuc && b.id === 'quasar' && JETS.has(b.n.split('#')[0]) && rpx * 4 < 26 * K && gRs > 30 * K) {   // a quasar at galaxy scale: a blinding point with two hairline radio jets
        const ax = hs2(b.n + 'jet') * TAU, L2 = Math.min(gRs * .55, 2400 * K), c = Math.cos(ax), sn = Math.sin(ax) * SY;
        for (const sg of [1, -1]) { const gr = g.createLinearGradient(it.p[0], it.p[1], it.p[0] + c * L2 * sg, it.p[1] + sn * L2 * sg); gr.addColorStop(0, 'rgba(200,225,255,.55)'); gr.addColorStop(.6, 'rgba(160,190,255,.12)'); gr.addColorStop(1, 'rgba(160,190,255,0)'); g.strokeStyle = gr; g.lineWidth = Math.max(.6, K * .8); g.beginPath(); g.moveTo(it.p[0], it.p[1]); g.lineTo(it.p[0] + c * L2 * sg, it.p[1] + sn * L2 * sg); g.stroke(); }
      }
      bodyAt(g, b, it.p[0], it.p[1], rpx, sz, K, t);
      if (opt.focus === b.n && rpx < 7 * K) { const ph = (performance.now() / 1100) % 1; ring(g, it.p[0], it.p[1], (7 + 16 * ph) * K, '#ffffff', .6 * (1 - ph), K); }   // a faint ping so the selected object can be found in the vastness
      if (!dim && (b.real || b.home)) drawSystem(g, b, it.p[0], it.p[1], Z, K, w, h, labels, pos, W[i][0], W[i][1]);
      if (b.n === 'The Sun' && b.real) { const ly = Z / LYU; [[10, '10 ly'], [25, '25 ly'], [50, '50 ly'], [100, '100 ly'], [500, '500 ly'], [1000, '1,000 ly'], [5000, '5,000 ly']].forEach(([d, t2]) => { const rr = d * ly; if (rr < 60 * K || rr > Math.max(w, h)) return; g.strokeStyle = 'rgba(255,214,150,.13)'; g.lineWidth = K; g.setLineDash([2 * K, 5 * K]); g.beginPath(); g.arc(it.p[0], it.p[1], rr, 0, TAU); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,214,150,.5)'; g.font = `300 ${Math.round(10 * K)}px "IBM Plex Mono", monospace`; g.textAlign = 'left'; g.fillText(t2, it.p[0] + rr * .707 + 4 * K, it.p[1] - rr * .707 - 4 * K); }); }   // distance from home
      const cps = many ? copies(g, b, W[i], b.count, { ...co, draw: true }) : null;
      const foc = opt.focus === b.n, showL = !dim && (foc || (b.field ? false : nuc ? true : sz > .5)), rr = Math.max(rpx, 2 * K);
      let lbl = null; if (showL && !opt.noLabels && PREF.on) { lbl = { text: b.base || b.n, x: it.p[0], y: it.p[1] + (rpx > 3 ? rpx * 1.12 : 0) + 30 * K, size: (nuc ? 17 : 14) * K, color: foc ? '#ffffff' : rgba(mixHex(tint, '#ffffff', .35), .9), focus: foc }; labels.push({ lbl, pr: foc ? 0 : nuc ? 1 : b.tier === 'anchor' ? 2 : 3, m: b.m }); }
      if (dim) g.globalAlpha = 1;
      pos.push({ n: b.n, id: b.id, x: it.p[0], y: it.p[1], wx: W[i][0], wy: W[i][1], r: Math.max(rr, nuc ? 30 * K : 16 * K), lbl, tier: b.tier, copies: cps }); });
    EYE = null;
    { const taken = []; labels.sort((x, y) => x.pr - y.pr || y.m - x.m).forEach(({ lbl }) => { const wd = lbl.text.length * lbl.size * .5, bx = { x0: lbl.x - wd / 2, x1: lbl.x + wd / 2, y0: lbl.y - lbl.size, y1: lbl.y + lbl.size * .3 }; if (!lbl.focus && taken.some(q => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0)) return; taken.push(bx); if (opt.ov) { const f = opt.ov.f, im = labelImg({ ...lbl, size: lbl.size * f }); opt.ov.g.drawImage(im.c, lbl.x * f - im.ox, lbl.y * f - im.oy); } else { const im = labelImg(lbl); g.drawImage(im.c, lbl.x - im.ox, lbl.y - im.oy); } }); }
    // minimap: the whole universe with the view as a box
    if (!opt.noMini) {    const Rm = 40 * K, mx = 14 * K + Rm, my = opt.mini === 'tl' ? (opt.miniTop ? opt.miniTop() : 52 * K) + Rm : h - 18 * K - Rm, big = lay.R * 1.1, k = Rm / big; const mgx = opt.ov ? opt.ov.g : g; mgx.save(); if (opt.ov) mgx.setTransform(opt.ov.f, 0, 0, opt.ov.f, 0, 0); mgx.fillStyle = 'rgba(10,8,22,.78)'; mgx.strokeStyle = 'rgba(255,255,255,.2)'; mgx.lineWidth = 1.5 * K; mgx.beginPath(); mgx.arc(mx, my, Rm + 2 * K, 0, TAU); mgx.fill(); mgx.stroke(); mgx.beginPath(); mgx.arc(mx, my, Rm, 0, TAU); mgx.clip();
    B.forEach((b, i) => { const big2 = b.tier === 'nucleus'; mgx.fillStyle = b.n === opt.focus ? '#fff' : rgba(col(b), big2 ? 1 : .8); mgx.beginPath(); mgx.arc(mx + W[i][0] * k, my + W[i][1] * k, big2 ? 3.2 * K : b.tier === 'anchor' ? 2.2 * K : 1.4 * K, 0, TAU); mgx.fill(); });
    mgx.strokeStyle = '#fff'; mgx.lineWidth = 1.5 * K; mgx.strokeRect(mx + (cam.x + OX - w / 2 / Z) * k, my + (cam.y + OY - h / 2 / Z) * k, w / Z * k, h / Z * k); mgx.restore(); }
    return pos;
  }
  // one object's likeness, the same everywhere it appears (discovery card, home card, profile, share images, catalogue, universe): the body as the universe renderer draws it, framed for a card
  const PFR = { quasar: .035, neutron: .09 };
  function portrait(g, w, h, b, t, k = 1, o = {}) {
    const s = Math.min(w, h), e = k >= 1 ? 1 : 1 - Math.pow(1 - Math.max(0, k), 3), rp = (PFR[b.id] || .26) * s * (o.z || 1) * (.3 + .7 * e), K = s / 185;
    g.save(); g.globalAlpha = Math.min(1, .1 + e); bodyAt(g, b, o.cx != null ? o.cx : w / 2, o.cy != null ? o.cy : h * .5, rp, 1, K, t); g.restore();
  }
  function portraitReady(b, w, h, ms = 2500) {   // a share image is drawn once: wait until the sharp surface for that size has arrived from the worker
    const rp = (PFR[b.id] || .26) * Math.min(w, h), t0 = performance.now();
    return new Promise(res => { (function poll() { const c = surfKind(b.id) && b.id !== 'neutron' ? surfFor(b, rp) : true; if ((c && !SWbusy && !SWQ.length) || performance.now() - t0 > ms) return res(); setTimeout(poll, 60); })(); });
  }
  window.SKY = { pctx, gparams, globe, galaxyPic: (b, S, rot = 0, sy = 1) => { const st = galaxyBake(b, S, rot, sy); galaxyStep(st, 1e9); galaxyStep(st, 1e9); return st.c; }, GALD, LANDS, LOCAL, STRUCT, field, fieldOf, rec, glBH, pending: () => SWbusy || SWQ.length > 0, starBg, portrait, portraitReady, starTileURL: (i = 0) => { const L = [[9, 9000, 640], [27, 7000, 1013]][i], t = starTile(L[0], L[1], L[2]); return t._url || (t._url = t.toDataURL()); }, layout, lineage, universe, massText, drawV: paintV, SPREAD, BASE, OBJ, FR, POOL, landFx, drawLabel, galaxySprite, planetInfo: n => { for (const [host, L] of Object.entries(PLANETS)) for (const p of L) if (p[0] === n) return { host, re: p[1], a: p[2], P: p[3], kind: p[4] }; for (const [host, L] of Object.entries(MOONS)) for (const m of L) if (m[0] === n) return { host, re: m[1] / 6371, a: m[2] / 1.496e8, P: Math.abs(m[3]), kind: m[4], moon: true, km: m[2] }; return null; }, MOONS, PLANETS, NEAR, drawPlanet, planetFace, physR, tempOf, bbHex, lumOf, surfFor, LYU, RSU, AUU, bodyAt, relSize: b => clamp(Math.pow(RSUN(b), .45), .004, 40), PREF, LBLFONTS, setPref, draw: (g, id, x, y, r, t = 0) => paint(g, id, x, y, r, t), starfield, fade, land, system, orbits, byId: id => OBJ.find(o => o.id === id) };
})();
