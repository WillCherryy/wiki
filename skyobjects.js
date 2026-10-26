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
  const DRAW = {
    brown(g, x, y, r, t) {
      halo(g, x, y, r * 2.1, '#c0508a', .3); sphere(g, x, y, r, '#e29ac4', '#8a3f78', '#2a1030', 3, t, 0, '#000', 0, .55);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); for (let i = 0; i < 16; i++) { const yy = y + (i / 15 - .5) * r * 1.9, w = r * (.04 + hash(i) * .09), off = Math.sin(t * .35 + i * 1.7) * r * .05; g.fillStyle = i % 3 === 0 ? 'rgba(255,190,205,.22)' : i % 3 === 1 ? 'rgba(60,15,45,.34)' : 'rgba(200,120,150,.2)'; g.beginPath(); g.ellipse(x + off, yy, r * 1.1, w, 0, 0, TAU); g.fill(); }
      const sx = x + r * (.28 + .1 * Math.sin(t * .25)), sy = y + r * .22; g.fillStyle = 'rgba(255,215,225,.5)'; g.beginPath(); g.ellipse(sx, sy, r * .22, r * .12, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,235,240,.45)'; g.lineWidth = r * .02; g.beginPath(); g.ellipse(sx, sy, r * .15, r * .07, 0, .5, 5); g.stroke(); g.restore();
      const sh = g.createRadialGradient(x - r * .3, y - r * .3, r * .5, x, y, r * 1.02); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = sh; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); ring(g, x, y, r * .985, '#ff9ac8', .25, r * .03);
    },
    reddwarf(g, x, y, r, t) {
      halo(g, x, y, r * 2.8, '#ff3a20', .5); sphere(g, x, y, r, '#ffa070', '#e6482e', '#5a0e06', 21, t, 34, '#ffb078', .5, .5);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); [[.3, -.25, .16], [-.35, .2, .12], [.1, .45, .09]].forEach(([a, b, c]) => { g.fillStyle = 'rgba(120,30,14,.4)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r * 1.6, c * r * 1.3, .4, 0, TAU); g.fill(); g.fillStyle = 'rgba(40,6,4,.6)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r, c * r * .8, .4, 0, TAU); g.fill(); }); g.restore();
      const fl = .5 + .5 * Math.sin(t * 1.3); loopArc(g, x, y, r * .99, -.9, .42, r * .26 * (.6 + .5 * fl), '#ffc090', .7, r * .05, Math.sin(t * 2) * r * .02); loopArc(g, x, y, r * .99, 2.1, .32, r * .18, '#ff9060', .55, r * .04, 0);
    },
    redgiant(g, x, y, r0, t) {
      const r = r0 * (1 + .018 * Math.sin(t * .9)); for (let i = 3; i >= 1; i--) halo(g, x, y, r * (1.25 + i * .45), '#ff5a28', .16 + .06 * (4 - i));
      sphere(g, x, y, r, '#ffc490', '#f06a30', '#7a1e0c', 44, t, 26, '#ffd8a8', .6, .5);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); for (let i = 0; i < 18; i++) { const a = hash(i + 200) * TAU, d = Math.sqrt(hash(i + 230)) * r * .9, w = r * (.16 + hash(i + 260) * .18), px = x + Math.cos(a) * d + Math.sin(t * .2 + i) * r * .01, py = y + Math.sin(a) * d, gr = g.createRadialGradient(px, py, 0, px, py, w); gr.addColorStop(0, 'rgba(255,214,150,.38)'); gr.addColorStop(.7, 'rgba(255,170,100,.12)'); gr.addColorStop(1, 'rgba(120,30,10,.0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, w, 0, TAU); g.fill(); } g.restore();
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const a = hash(i + 3) * TAU + t * .04; halo(g, x + Math.cos(a) * r * .98, y + Math.sin(a) * r * .98, r * .3, '#ff7a3a', .26); } g.restore();
    },
    sun(g, x, y, r, t) {
      halo(g, x, y, r * 3.2, '#ffb020', .5); g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) { const a = i / 46 * TAU + hash(i) * .1, l = r * (1.35 + hash(i + 40) * .75 + .08 * Math.sin(t * .6 + i)); const gr = g.createLinearGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * l, y + Math.sin(a) * l); gr.addColorStop(0, 'rgba(255,214,120,.34)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.strokeStyle = gr; g.lineWidth = r * (.025 + hash(i + 9) * .04); g.lineCap = 'round'; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .98, y + Math.sin(a) * r * .98); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } g.restore();
      sphere(g, x, y, r, '#fffbe0', '#ffd23e', '#e07a0e', 66, t, 90, '#ffffff', .5, .4);
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); [[.35, -.2, .1], [-.3, .25, .075], [.05, .5, .06]].forEach(([a, b, c]) => { g.fillStyle = 'rgba(140,60,10,.65)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r * 1.7, c * r * 1.3, .3, 0, TAU); g.fill(); g.fillStyle = 'rgba(40,12,4,.85)'; g.beginPath(); g.ellipse(x + a * r, y + b * r, c * r, c * r * .75, .3, 0, TAU); g.fill(); }); g.restore();
      loopArc(g, x, y, r * .995, -.55, .5, r * .24, '#ff9c3a', .85, r * .045, Math.sin(t * 1.6) * r * .03); loopArc(g, x, y, r * .995, 2.45, .36, r * .17, '#ffb05a', .75, r * .04, Math.sin(t * 1.9 + 1) * r * .02);
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
      const p = (t * .22) % 1; halo(g, x, y, r * 7, '#9cc4ff', .5);
      for (let k = 0; k < 2; k++) { const q = (p + k * .5) % 1, rr = r * (1.8 + q * 4.2); g.strokeStyle = k ? `rgba(255,140,200,${.26 * (1 - q)})` : `rgba(110,230,230,${.32 * (1 - q)})`; g.lineWidth = Math.max(.5, r * (.1 - .06 * q)); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); }
      sphere(g, x, y, r * .5, '#ffffff', '#eaf4ff', '#a6ccff', 5, t, 0, '#fff', 0, .2); halo(g, x, y, r * 1.4, '#ffffff', .95); spikes(g, x, y, r * 3.8, '#e8f3ff', .85, .5, 4); spikes(g, x, y, r * 2, '#cfe6ff', .35, .5 + Math.PI / 4, 4);
    },
    neutron(g, x, y, r, t) {
      const rot = t * 2.6 + .6; halo(g, x, y, r * 3.2, '#5fd8ff', .5); const pu = (t * 2.6 / TAU) % 1; ring(g, x, y, r * (.4 + pu * 3.2), '#8be8ff', .35 * (1 - pu), r * .05);
      g.save(); g.translate(x, y); g.rotate(rot); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(120,220,255,.3)'; g.lineWidth = r * .035; for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * .5 * i, 0, r * .5 * i, r * .9 * i, 0, 0, TAU); g.stroke(); }
      for (const s of [-1, 1]) { const gr = g.createLinearGradient(0, 0, 0, s * r * 3.8); gr.addColorStop(0, 'rgba(190,248,255,.95)'); gr.addColorStop(.5, 'rgba(120,220,255,.4)'); gr.addColorStop(1, 'rgba(120,220,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-r * .2, 0); g.lineTo(0, s * r * 3.8); g.lineTo(r * .2, 0); g.fill(); for (let i = 0; i < 7; i++) { const q = ((t * .7 + i / 7) % 1); g.fillStyle = `rgba(200,250,255,${.8 * (1 - q)})`; g.beginPath(); g.arc((hash(i) - .5) * r * .2 * q, s * r * (.4 + q * 3.2), r * .05, 0, TAU); g.fill(); } }
      g.restore(); sphere(g, x, y, r * .32, '#ffffff', '#c2f2ff', '#58c4ec', 8, t, 0, '#fff', 0, .2); halo(g, x, y, r * .8, '#ffffff', .9);
    },
    quasar(g, x, y, r, t) {
      halo(g, x, y, r * 2.8, '#ff8a3a', .38); g.save(); g.translate(x, y); g.rotate(-.28); g.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) { const fl = .88 + .12 * Math.sin(t * 8 + s), L = r * 3.4 * fl, gr = g.createLinearGradient(0, 0, 0, s * L); gr.addColorStop(0, 'rgba(210,230,255,.9)'); gr.addColorStop(.6, 'rgba(130,175,255,.28)'); gr.addColorStop(1, 'rgba(110,160,255,0)'); for (const wd of [.34, .2, .08]) { g.fillStyle = gr; g.globalAlpha = wd < .1 ? .9 : .33; g.beginPath(); g.moveTo(-r * wd * .3, 0); g.lineTo(-r * wd, s * L); g.lineTo(r * wd, s * L); g.lineTo(r * wd * .3, 0); g.fill(); } g.globalAlpha = 1;
        for (let i = 0; i < 4; i++) { const q = ((t * .5 + i / 4) % 1); g.fillStyle = `rgba(220,238,255,${.9 * (1 - q)})`; g.beginPath(); g.arc(0, s * q * L, r * (.07 + .05 * q), 0, TAU); g.fill(); } }
      g.restore(); g.save(); g.translate(x, y); g.rotate(-.28); g.scale(1, .3);
      for (let i = 0; i < 60; i++) { const q = i / 59, rad = r * 1.35 * (1.15 - q * .85), a = clamp(.3 + .6 * q); g.strokeStyle = q < .3 ? `rgba(200,50,30,${a})` : q < .55 ? `rgba(255,${110 + q * 150 | 0},50,${a})` : q < .8 ? `rgba(255,${190 + q * 60 | 0},120,${a})` : `rgba(255,250,235,${a})`; g.lineWidth = r * .05; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke(); }
      g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const a0 = hash(i + 5) * TAU + t * (.9 - hash(i) * .5), rad = r * 1.35 * (.4 + hash(i + 17) * .7); g.strokeStyle = `rgba(255,230,190,${.18 + hash(i) * .3})`; g.lineWidth = r * .02; g.beginPath(); g.arc(0, 0, rad, a0, a0 + .5 + hash(i + 2)); g.stroke(); }
      g.restore();
      g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, r * .3, 0, TAU); g.fill(); g.save(); g.translate(x, y); g.rotate(-.28); g.strokeStyle = 'rgba(255,232,200,.9)'; g.lineWidth = r * .05; g.beginPath(); g.arc(0, 0, r * .33, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,215,160,.7)'; g.lineWidth = r * .07; g.beginPath(); g.ellipse(0, -r * .04, r * .44, r * .38, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke(); g.restore();
    }
  };

  // every object gets a glow pass on top: layered additive halos, an incandescent core and a bright rim. It breathes, and hotter objects glow harder.
  const GLOW = { brown: ['#ff6aa8', .3, 0], reddwarf: ['#ff4a2a', .75, .5], redgiant: ['#ff7a30', .9, .55], sun: ['#ffb838', 1.05, .7], bluewhite: ['#9cc4ff', 1.15, .8], bluegiant: ['#6fa0ff', 1.3, .85], whitedwarf: ['#b8d8ff', 1.2, 1], neutron: ['#6fe8ff', 1.3, 1], quasar: ['#ff9a48', 1.25, .5] };
  function glowPass(g, id, x, y, r, t) {
    const [c, k, core] = GLOW[id] || GLOW.sun, seed = id.length * 1.7, pu = 1 + .07 * Math.sin(t * 1.6 + seed) + .03 * Math.sin(t * 4.1 + seed * 2);
    g.save(); g.globalCompositeOperation = 'lighter';
    const rr = id === 'whitedwarf' ? r * .6 : id === 'neutron' ? r * .5 : r;   // those two draw a small body inside a large radius
    halo(g, x, y, rr * 1.3 * pu, c, .34 * k); halo(g, x, y, rr * 2.3 * pu, c, .24 * k); halo(g, x, y, rr * 4.2 * pu, c, .13 * k);
    if (core > 0 && id !== 'quasar') { const gr = g.createRadialGradient(x, y, 0, x, y, rr * 1.05); gr.addColorStop(0, `rgba(255,255,255,${.5 * core * pu})`); gr.addColorStop(.55, rgba(c, .22 * core)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr * 1.05, 0, TAU); g.fill(); }
    if (['reddwarf', 'redgiant', 'sun', 'bluegiant', 'bluewhite'].includes(id)) { ring(g, x, y, r * 1.0, c, .38 * pu, r * .05); ring(g, x, y, r * 1.06, '#ffffff', .12, r * .04); }
    g.restore();
  }
  const paint = (g, id, x, y, r, t) => { if (id === 'quasar') { glowPass(g, id, x, y, r, t); DRAW.quasar(g, x, y, r, t); return; } (DRAW[id] || DRAW.sun)(g, x, y, r, t); glowPass(g, DRAW[id] ? id : 'sun', x, y, r, t); };
  function starfield(g, w, h, t, n = 90, seed = 0) { g.save(); for (let i = 0; i < n; i++) { const x = hash(seed + i) * w, y = hash(seed + i + 500) * h, r = .4 + hash(seed + i + 900) * 1.3, a = .25 + .6 * hash(seed + i + 1300) * (.7 + .3 * Math.sin(t * (1 + hash(i) * 2) + i)); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.restore(); }
  function fade(g, w, h, inner = .55) { g.save(); g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner * .5, w / 2, h / 2, Math.hypot(w, h) * .5); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.7, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); }
  // the landing: particles converge, a flash and shock rings (more for hotter objects), then the object grows in with a small overshoot
  function land(g, w, h, id, idx, t) {
    const o = OBJ.find(q => q.id === id) || OBJ[3], cx = w / 2, cy = h * .53, R = (FR[id] || .2) * h, pow = (idx + 1) / 9; g.clearRect(0, 0, w, h);
    const shake = idx >= 6 && t > .38 && t < .75 ? (1 - (t - .38) / .37) * 4 * pow : 0; g.save(); g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    starfield(g, w, h, t, Math.round(w * h / 5500), 3);
    if (t < .42) { const u = clamp(t / .38), e = u * u * u; for (let i = 0; i < 40; i++) { const a = hash(i + 11) * TAU, d0 = h * (.55 + hash(i + 23) * .25), d = d0 * (1 - e), d2 = d0 * (1 - Math.pow(clamp(u - .12), 3)); g.strokeStyle = rgba(o.c, .15 + .6 * u); g.lineWidth = 1 + 1.5 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.stroke(); } halo(g, cx, cy, R * (.3 + 1.4 * u), o.c, .25 + .7 * u); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3 + 9 * u, 0, TAU); g.fill(); }
    const rings = idx >= 7 ? 3 : idx >= 4 ? 2 : 1; for (let i = 0; i < rings; i++) { const u = clamp((t - .38 - i * .1) / .8); if (u > 0 && u < 1) ring(g, cx, cy, R * (.4 + 4.4 * easeOut(u)), i % 2 ? '#ffffff' : o.c, .8 * (1 - u), R * .14 * (1 - u) + 1); }
    const k = clamp((t - .4) / .85); if (k > 0) paint(g, id, cx, cy, Math.max(.5, R * clamp(easeBack(k), 0, 1.15)), t);
    const fl = clamp(1 - (t - .38) / .4); if (t >= .38 && fl > 0) { const fg = g.createRadialGradient(cx, cy, 0, cx, cy, h * (.5 + .5 * pow)); fg.addColorStop(0, `rgba(255,255,255,${fl * (.3 + .55 * pow)})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(-10, -10, w + 20, h + 20); }
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
  const hs = str => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973; return h; };

  function landFx(g, id, idx, t, cx, cy, R, w, h) {
    const o = OBJ.find(q => q.id === id) || OBJ[3], pow = (idx + 1) / 9;
    if (t < .42) { const u = clamp(t / .38), e = u * u * u; for (let i = 0; i < 40; i++) { const a = hash(i + 11) * TAU, d0 = h * (.45 + hash(i + 23) * .25), d = d0 * (1 - e), d2 = d0 * (1 - Math.pow(clamp(u - .12), 3)); g.strokeStyle = rgba(o.c, .15 + .6 * u); g.lineWidth = 1 + 1.5 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.stroke(); } halo(g, cx, cy, R * (.3 + 1.4 * u), o.c, .25 + .7 * u); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3 + 9 * u, 0, TAU); g.fill(); }
    const rings = idx >= 7 ? 3 : idx >= 4 ? 2 : 1; for (let i = 0; i < rings; i++) { const u = clamp((t - .38 - i * .1) / .8); if (u > 0 && u < 1) ring(g, cx, cy, R * (.4 + 4.4 * easeOut(u)), i % 2 ? '#ffffff' : o.c, .8 * (1 - u), R * .14 * (1 - u) + 1); }
    const fl = clamp(1 - (t - .38) / .4); if (t >= .38 && fl > 0) { const fg = g.createRadialGradient(cx, cy, 0, cx, cy, h * (.5 + .5 * pow)); fg.addColorStop(0, `rgba(255,255,255,${fl * (.3 + .55 * pow)})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(0, 0, w, h); }
  }
  function drawLabel(g, l) { g.save(); g.font = `400 ${l.size}px "EB Garamond", Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; try { g.letterSpacing = (l.size * .04) + 'px'; } catch (e) {} g.shadowColor = 'rgba(6,5,14,.95)'; g.shadowBlur = l.size * .35; g.fillStyle = l.color; g.fillText(l.text, l.x, l.y); g.shadowBlur = 0; g.fillText(l.text, l.x, l.y); g.restore(); }
  // a system: Kepler orbits (T^2 ~ a^3, ellipses with the primary at a focus, faster at periapsis), a barycentre wobble, moons for duplicates.
  // The map is far larger than the view: pan with opt.cam = {x, y, z}; positions are world units with the primary at the origin.
  function kepler(M, e) { let E = M; for (let i = 0; i < 5; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  function orbits(w, list) {   // list sorted hottest first: [{n, id, idx, count}]; every body after the first orbits the primary
    return list.slice(1).map((b, i) => { const k = hs(b.n), a = w * (.3 + 1.1 * Math.log(1 + .9 * i)) + (hash(k) - .5) * w * .06, T = 9 * Math.pow(a / (w * .44), 1.5); return { ...b, a, T, e: .05 + .3 * hash(k + 3.1), om: hash(k + 7.7) * TAU, M0: hash(k + 1.3) * TAU }; });
  }
  function system(g, w, h, t, list, opt = {}) {
    g.clearRect(0, 0, w, h); const cam = opt.cam || { x: 0, y: 0, z: 1 }, Z = cam.z, SY = .56, U = Math.min(w, h); if (!list.length) { starfield(g, w, h, t * .3, 60, 9); return []; }
    const ox = ((cam.x * .12) % w + w) % w, oy = ((cam.y * .12) % h + h) % h; g.save(); g.translate(-ox, -oy); for (const [dx, dy] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.save(); g.translate(dx, dy); starfield(g, w, h, t * .3, Math.round(w * h / 9000), 9); g.restore(); } g.restore();
    const prim = list[0], orb = orbits(760, list), pos = [], toS = (wx, wy) => [(wx - cam.x) * Z + w / 2, (wy - cam.y) * Z + h / 2];
    const bornOf = n => opt.ages && opt.ages[n] != null ? clamp(opt.ages[n] / 1.4) : opt.newId === n ? clamp((opt.tNew == null ? 9 : opt.tNew) / 1.4) : 1, TS = opt.ts || 2.4, PH = opt.tau != null ? opt.tau : t * TS, at = (b, off = 0) => { const E = kepler(b.M0 + (PH - off * TS) * TAU / b.T, b.e), x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om); return [x * c - y * s, x * s + y * c]; };
    let bx = 0, by = 0, mt = 1; orb.forEach(b => { const q = at(b), bornW = bornOf(b.n), mass = .012 * (b.idx + 1) * sm3(bornW); bx += q[0] * mass; by += q[1] * mass; mt += mass; }); bx = -bx / mt * (opt.wobble == null ? .35 : opt.wobble); by = -by / mt * (opt.wobble == null ? .35 : opt.wobble);
    const items = [], vis = (x, y, m) => x > -m && x < w + m && y > -m && y < h + m;
    orb.forEach(b => { const foc = opt.focus === b.n; g.strokeStyle = foc ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.1)'; g.lineWidth = foc ? 2 : 1; g.beginPath(); for (let i = 0; i <= 120; i++) { const E = i / 120 * TAU, x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om), p = toS(bx + x * c - y * s, by + (x * s + y * c) * SY); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
      const q = at(b), wx = bx + q[0], wy = by + q[1] * SY, p = toS(wx, wy);
      if (foc) { g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); const c0 = toS(bx, by); g.moveTo(c0[0], c0[1]); for (let i = 0; i <= 14; i++) { const qq = at(b, 1.4 - i * .1), pp = toS(bx + qq[0], by + qq[1] * SY); g.lineTo(pp[0], pp[1]); } g.fill(); }
      items.push({ b, x: p[0], y: p[1], z: q[1], wx, wy }); });
    const pp = toS(bx, by); items.push({ b: prim, x: pp[0], y: pp[1], z: 0, wx: bx, wy: by, prim: true }); items.sort((a, b) => a.z - b.z);
    items.forEach(it => { const b = it.b, base = (FR[b.id] || .2) * U * (it.prim ? .62 : .4) * Z; if (!vis(it.x, it.y, base * 6 + 80)) { pos.push({ n: b.n, id: b.id, x: it.x, y: it.y, wx: it.wx, wy: it.wy, r: 0 }); return; }
      let r = base; if (it.prim && opt.primScale != null) r *= Math.max(.001, opt.primScale); const born = bornOf(b.n); r *= Math.max(.01, easeBack(born));
      if (!it.prim) for (let i = 1; i < 12; i++) { const q = at(b, i * .07), p = toS(bx + q[0], by + q[1] * SY); g.fillStyle = rgba(OBJ[b.idx].c, .22 * (1 - i / 12)); g.beginPath(); g.arc(p[0], p[1], Math.max(1.5, r * .08 * (1 - i / 12)), 0, TAU); g.fill(); }
      if (born < 1) ring(g, it.x, it.y, base * (.6 + 3 * born), OBJ[b.idx].c, .7 * (1 - born), 3);
      const sc = it.prim ? 1 : .6 + .2 * clamp(it.z / 1500 * .5 + .5, 0, 1); if (r * sc < 15) { halo(g, it.x, it.y, Math.max(8, r * sc * 3.2), OBJ[b.idx].c, .85); g.fillStyle = '#fff'; g.beginPath(); g.arc(it.x, it.y, Math.max(1.6, r * sc * .32), 0, TAU); g.fill(); } else { g.save(); g.translate(it.x, it.y); paint(g, b.id, 0, 0, Math.max(.5, r * sc), t + b.idx); g.restore(); }
      for (let k = 0; k < Math.min(5, b.count - 1); k++) { const rs = r * sc * (1.9 + .4 * k) + 8, th = t * (2.3 - .25 * k) + hash(hs(b.n) + k) * TAU; g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.ellipse(it.x, it.y, rs, rs * SY, 0, 0, TAU); g.stroke(); g.fillStyle = rgba(OBJ[b.idx].c, .95); g.beginPath(); g.arc(it.x + Math.cos(th) * rs, it.y + Math.sin(th) * rs * SY, 2.6 + (it.prim ? 1 : 0), 0, TAU); g.fill(); }
      let lbl = null; if (Z > .45 || opt.focus === b.n) { lbl = { text: b.n, x: it.x, y: it.y + r * sc * 1.25 + 40, size: clamp(24 * Math.sqrt(Z), 20, 36), color: opt.focus === b.n ? '#ffffff' : rgba(OBJ[b.idx].c, .92), focus: opt.focus === b.n }; if (!opt.noLabels) drawLabel(g, lbl); }
      pos.push({ n: b.n, id: b.id, x: it.x, y: it.y, wx: it.wx, wy: it.wy, r: Math.max(r * sc, 18), lbl }); });
    // minimap: the whole system with the current view as a box
    const big = Math.max(380, ...orb.map(b => b.a * (1 + b.e))), R = 58, mx = 18 + R, my = opt.mini === 'tl' ? 52 + R : h - 18 - R, k = R / big; g.save(); g.fillStyle = 'rgba(10,8,22,.78)'; g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, R + 2, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(mx, my, R, 0, TAU); g.clip();
    orb.forEach(b => { g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(mx + bx * k, my + by * k * 1, b.a * k, b.a * k * SY, b.om, 0, TAU); g.stroke(); }); pos.forEach(p => { g.fillStyle = p.n === opt.focus ? '#fff' : rgba(OBJ[(list.find(l => l.n === p.n) || prim).idx].c, .95); g.beginPath(); g.arc(mx + p.wx * k, my + p.wy * k, p.n === opt.focus ? 3.4 : 2.2, 0, TAU); g.fill(); });
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(mx + (cam.x - w / 2 / Z) * k, my + (cam.y - h / 2 / Z) * k, w / Z * k, h / Z * k); g.restore();
    return pos;
  }
  window.SKY = { OBJ, FR, POOL, landFx, drawLabel, draw: (g, id, x, y, r, t = 0) => paint(g, id, x, y, r, t), starfield, fade, land, system, orbits, byId: id => OBJ.find(o => o.id === id) };
})();
