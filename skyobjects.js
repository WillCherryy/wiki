/* Scorcher's sky: nine astronomical objects, coolest to hottest, drawn procedurally on a canvas (no images).
   SKY.draw(g, id, x, y, r, t)   paints one object centred at (x, y) with body radius r (halos reach ~3-6 r).
   SKY.land(g, w, h, id, idx, t) the landing animation on the results card (converge, flash, shock ring, object grows in).
   SKY.system(g, w, h, t, list, opt) a small planetary system: the hottest object you own at the centre, the rest on Keplerian orbits. */
(function () {
  const TAU = Math.PI * 2, hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
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
  function starfield(g, w, h, t, n = 90, seed = 0) { g.save(); for (let i = 0; i < n; i++) { const x = hash(seed + i) * w, y = hash(seed + i + 500) * h, r = .4 + hash(seed + i + 900) * 1.3, a = .25 + .6 * hash(seed + i + 1300) * (.7 + .3 * Math.sin(t * (1 + hash(i) * 2) + i)); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.restore(); }
  function fade(g, w, h, inner = .55) { g.save(); g.globalCompositeOperation = 'destination-in'; const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner * .5, w / 2, h / 2, Math.hypot(w, h) * .5); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.7, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); }
  // the landing: particles converge, a flash and shock rings (more for hotter objects), then the object grows in with a small overshoot
  function land(g, w, h, id, idx, t) {
    const o = OBJ.find(q => q.id === id) || OBJ[3], cx = w / 2, cy = h * .53, R = (FR[id] || .2) * h, pow = (idx + 1) / 9; g.clearRect(0, 0, w, h);
    const shake = idx >= 6 && t > .38 && t < .75 ? (1 - (t - .38) / .37) * 4 * pow : 0; g.save(); g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    starfield(g, w, h, t, Math.round(w * h / 5500), 3);
    if (t < .42) { const u = clamp(t / .38), e = u * u * u; for (let i = 0; i < 40; i++) { const a = hash(i + 11) * TAU, d0 = h * (.55 + hash(i + 23) * .25), d = d0 * (1 - e), d2 = d0 * (1 - Math.pow(clamp(u - .12), 3)); g.strokeStyle = rgba(o.c, .15 + .6 * u); g.lineWidth = 1 + 1.5 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2); g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.stroke(); } halo(g, cx, cy, R * (.3 + 1.4 * u), o.c, .25 + .7 * u); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3 + 9 * u, 0, TAU); g.fill(); }
    const rings = idx >= 7 ? 3 : idx >= 4 ? 2 : 1; for (let i = 0; i < rings; i++) { const u = clamp((t - .38 - i * .1) / .8); if (u > 0 && u < 1) ring(g, cx, cy, R * (.4 + 4.4 * easeOut(u)), i % 2 ? '#ffffff' : o.c, .8 * (1 - u), R * .14 * (1 - u) + 1); }
    const k = clamp((t - .4) / .85); if (k > 0) DRAW[id](g, cx, cy, Math.max(.5, R * clamp(easeBack(k), 0, 1.15)), t);
    const fl = clamp(1 - (t - .38) / .4); if (t >= .38 && fl > 0) { const fg = g.createRadialGradient(cx, cy, 0, cx, cy, h * (.5 + .5 * pow)); fg.addColorStop(0, `rgba(255,255,255,${fl * (.3 + .55 * pow)})`); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(-10, -10, w + 20, h + 20); }
    g.restore(); fade(g, w, h);
  }
  // a system: Kepler orbits (T^2 ~ a^3, ellipses with the primary at a focus, faster at periapsis), a barycentre wobble, moons for duplicates
  function kepler(M, e) { let E = M; for (let i = 0; i < 5; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  function orbits(w, list) {   // list is sorted hottest first: [{id, idx, count}]
    const m = list.length - 1, maxA = w * .44; return list.slice(1).map((b, i) => { const a = m === 1 ? maxA * .6 : maxA * (.3 + .7 * i / (m - 1)), T = 8 * Math.pow(a / (w * .2), 1.5); return { ...b, a, T, e: .06 + .32 * hash(b.idx + 3.1), om: hash(b.idx + 7.7) * TAU, M0: hash(b.idx + 1.3) * TAU }; });
  }
  function system(g, w, h, t, list, opt = {}) {
    g.clearRect(0, 0, w, h); starfield(g, w, h, t * .3, Math.round(w * h / 4500), 9); if (!list.length) return [];
    const cx = w / 2, cy = h * .5, SY = .56, U = Math.min(w, h), prim = list[0], orb = orbits(w, list), pos = [];
    const at = (b, tt) => { const E = kepler(b.M0 + tt * TAU / b.T, b.e), x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om); return [x * c - y * s, x * s + y * c]; };
    let bx = 0, by = 0, mt = 1; orb.forEach(b => { const q = at(b, t), mass = .012 * (b.idx + 1); bx += q[0] * mass; by += q[1] * mass; mt += mass; }); bx = -bx / mt; by = -by / mt;
    const items = [];
    orb.forEach(b => { const foc = opt.focus === b.id; g.strokeStyle = foc ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.12)'; g.lineWidth = foc ? 2 : 1; g.beginPath(); for (let i = 0; i <= 120; i++) { const E = i / 120 * TAU, x = b.a * (Math.cos(E) - b.e), y = b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), c = Math.cos(b.om), s = Math.sin(b.om), px = cx + bx + x * c - y * s, py = cy + by + (x * s + y * c) * SY; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      if (foc) { g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(cx + bx, cy + by); for (let i = 0; i <= 14; i++) { const q = at(b, t - 1.4 + i * .1); g.lineTo(cx + bx + q[0], cy + by + q[1] * SY); } g.fill(); }
      const q = at(b, t); items.push({ b, x: cx + bx + q[0], y: cy + by + q[1] * SY, z: q[1] }); });
    items.push({ b: prim, x: cx + bx, y: cy + by, z: 0, prim: true }); items.sort((a, b) => a.z - b.z);
    items.forEach(it => { const b = it.b, base = (FR[b.id] || .2) * U * (it.prim ? .62 : .4); let r = base; const born = opt.newId === b.id ? clamp((opt.tNew == null ? 9 : opt.tNew) / 1.4) : 1; r *= Math.max(.01, easeBack(born));
      if (!it.prim) for (let i = 1; i < 12; i++) { const q = at(b, t - i * .07); g.fillStyle = rgba(OBJ[b.idx].c, .22 * (1 - i / 12)); g.beginPath(); g.arc(cx + bx + q[0], cy + by + q[1] * SY, Math.max(1.5, r * .08 * (1 - i / 12)), 0, TAU); g.fill(); }
      if (born < 1) ring(g, it.x, it.y, base * (.6 + 3 * born), OBJ[b.idx].c, .7 * (1 - born), 3);
      g.save(); g.translate(it.x, it.y); const sc = it.prim ? 1 : .55 + .25 * ((it.z / (w * .44)) * .5 + .5); DRAW[b.id](g, 0, 0, Math.max(.5, r * sc), t + b.idx); g.restore();
      for (let k = 0; k < Math.min(5, b.count - 1); k++) { const rs = r * sc * (1.9 + .4 * k) + 8, th = t * (2.3 - .25 * k) + hash(b.idx * 9 + k) * TAU; g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.ellipse(it.x, it.y, rs, rs * SY, 0, 0, TAU); g.stroke(); g.fillStyle = rgba(OBJ[b.idx].c, .95); g.beginPath(); g.arc(it.x + Math.cos(th) * rs, it.y + Math.sin(th) * rs * SY, 2.6 + (it.prim ? 1 : 0), 0, TAU); g.fill(); }
      pos.push({ id: b.id, x: it.x, y: it.y, r: Math.max(r * sc, 14) }); });
    return pos;
  }
  window.SKY = { OBJ, FR, draw: (g, id, x, y, r, t = 0) => (DRAW[id] || DRAW.sun)(g, x, y, r, t), starfield, fade, land, system, orbits, byId: id => OBJ.find(o => o.id === id) };
})();
