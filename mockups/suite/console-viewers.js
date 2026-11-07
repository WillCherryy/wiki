// Scorcher Build console: artefact viewers. One shell (title, provenance, pan and zoom, layer toggles, legend, cursor readout, PNG export,
// physics checks) around eight renderers. Each renderer is deterministic from a seed and can carry controlled faults that its physics
// checks must catch. Simulated output is marked on screen and stamped into every exported PNG; engine data (a task's own data, computed by
// the engine) is labelled as such. Nothing here is a measurement of an agent.
(() => {
'use strict';
const TAU = Math.PI * 2;
function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function noise2(seed) { const r = rng(seed), P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = r();
  const g = (x, y) => P[((y & 255) << 8) | (x & 255)], s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }; }
function fbm(seed, oct = 5) { const n = noise2(seed); return (x, y) => { let v = 0, amp = .5, f = 1; for (let o = 0; o < oct; o++) { v += amp * n(x * f, y * f); amp *= .5; f *= 2; } return v; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = (x, d = 3) => { if (!isFinite(x)) return '–'; const a = Math.abs(x); return a >= 1e4 ? Math.round(x).toLocaleString('en-GB') : a >= 100 ? x.toFixed(0) : a >= 10 ? x.toFixed(1) : x.toPrecision(d); };
function nice(span, n = 5) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
function lerpColor(stops, t) { t = clamp(t, 0, 1); const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1))), f = t * (stops.length - 1) - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
const SEIS = [[29, 58, 168], [140, 156, 214], [245, 245, 243], [222, 135, 146], [184, 20, 47]];
const GRADE = [[247, 247, 240], [214, 226, 196], [150, 196, 160], [74, 150, 140], [33, 92, 120], [24, 44, 92]];

/* ---------------------------------------------------------------- chart helpers (screen space) */
function frame(ctx, W, H, pad, xr, yr, opts = {}) {
  const ink3 = css('--ink-3'), line = css('--line');
  const X = v => pad.l + (opts.xlog ? (Math.log10(v) - Math.log10(xr[0])) / (Math.log10(xr[1]) - Math.log10(xr[0])) : (v - xr[0]) / (xr[1] - xr[0])) * (W - pad.l - pad.r);
  const Y = v => H - pad.b - (opts.ylog ? (Math.log10(v) - Math.log10(yr[0])) / (Math.log10(yr[1]) - Math.log10(yr[0])) : (v - yr[0]) / (yr[1] - yr[0])) * (H - pad.t - pad.b);
  ctx.font = '11px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = ink3; ctx.strokeStyle = line; ctx.lineWidth = 1;
  const ticks = (r, log) => { if (log) { const out = [], dec = Math.log10(r[1] / r[0]), m = dec < 2.2 ? [1, 2, 5] : [1]; for (let e = Math.floor(Math.log10(r[0])); e <= Math.ceil(Math.log10(r[1])); e++) for (const k of m) { const v = k * Math.pow(10, e); if (v >= r[0] && v <= r[1]) out.push(v); } return out; }
    const st = nice(r[1] - r[0]), out = []; for (let v = Math.ceil(r[0] / st) * st; v <= r[1] + 1e-9; v += st) out.push(+v.toPrecision(10)); return out; };
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const v of ticks(xr, opts.xlog)) { const x = X(v); ctx.beginPath(); ctx.moveTo(x + .5, pad.t); ctx.lineTo(x + .5, H - pad.b); ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(opts.xf ? opts.xf(v) : fmt(v), x, H - pad.b + 6); }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const v of ticks(yr, opts.ylog)) { const y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y + .5); ctx.lineTo(W - pad.r, y + .5); ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(opts.yf ? opts.yf(v) : fmt(v), pad.l - 6, y); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; if (opts.xl) ctx.fillText(opts.xl, pad.l + (W - pad.l - pad.r) / 2, H - 4);
  if (opts.yl) { ctx.save(); ctx.translate(12, pad.t + (H - pad.t - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top'; ctx.fillText(opts.yl, 0, -8); ctx.restore(); }
  const Xi = px => opts.xlog ? Math.pow(10, Math.log10(xr[0]) + (px - pad.l) / (W - pad.l - pad.r) * (Math.log10(xr[1]) - Math.log10(xr[0]))) : xr[0] + (px - pad.l) / (W - pad.l - pad.r) * (xr[1] - xr[0]);
  const Yi = py => opts.ylog ? Math.pow(10, Math.log10(yr[0]) + (H - pad.b - py) / (H - pad.t - pad.b) * (Math.log10(yr[1]) - Math.log10(yr[0]))) : yr[0] + (H - pad.b - py) / (H - pad.t - pad.b) * (yr[1] - yr[0]);
  return { X, Y, Xi, Yi };
}
function label(ctx, txt, x, y, color, align = 'left') { ctx.font = '500 12px "Mona Sans", system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y); }

/* ---------------------------------------------------------------- renderers */
const R = {};

R.map = {
  title: 'Site screening map', unit: 'GIS', faults: [['buffer', 'Agent ignores a protected-area buffer']],
  make(seed, F) {
    const W = 160, H = 120, cell = 10, E0 = 512000, N0 = 4421000, r = rng(seed), f = fbm(seed);
    const dem = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dem[y * W + x] = 280 + 140 * f(x / 38, y / 38);
    const slope = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const gx = (dem[y * W + x + 1] - dem[y * W + x - 1]) / (2 * cell), gy = (dem[(y + 1) * W + x] - dem[(y - 1) * W + x]) / (2 * cell); slope[y * W + x] = Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI; }
    const sorted = [...dem].sort((a, b) => a - b), wl = sorted[Math.floor(sorted.length * .06)], water = dem.map(v => v < wl ? 1 : 0);
    const prot = []; for (let k = 0; k < 2; k++) { const cx = 30 + r() * 100, cy = 20 + r() * 80, rad = 9 + r() * 8, pts = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, q = rad * (.75 + .5 * r()); pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } prot.push({ pts, cls: k ? 'B' : 'A' }); }
    const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const distPoly = (x, y, P) => { if (inPoly(x, y, P)) return 0; let d = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1); d = Math.min(d, Math.hypot(x - ax - t * vx, y - ay - t * vy)); } return d; };
    const buf = 150 / cell, inBuf = new Uint8Array(W * H), suit = new Uint8Array(W * H), agent = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, d = Math.min(...prot.map(p => distPoly(x + .5, y + .5, p.pts)));
      inBuf[i] = d < buf ? 1 : 0; const ok = slope[i] < 5 && !water[i]; suit[i] = ok && !inBuf[i] ? 1 : 0;
      agent[i] = ok && (!inBuf[i] || (F.has('buffer') && distPoly(x + .5, y + .5, prot[1].pts) > 0 && Math.min(...prot.map(p => distPoly(x + .5, y + .5, p.pts))) === distPoly(x + .5, y + .5, prot[1].pts))) ? 1 : 0; }
    // the largest parcel of the agent's mask (4-connected)
    const lab = new Int32Array(W * H), sizes = [0]; let best = 0;
    for (let i = 0; i < W * H; i++) if (agent[i] && !lab[i]) { const id = sizes.length, st = [i]; lab[i] = id; let n = 0;
      while (st.length) { const j = st.pop(); n++; const x = j % W, y = (j / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, k = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < H && agent[k] && !lab[k]) { lab[k] = id; st.push(k); } } }
      sizes.push(n); if (n > sizes[best]) best = id; }
    const road = []; { let y = 10 + r() * 20; for (let x = 0; x <= W; x += 8) { road.push([x, y]); y = clamp(y + (r() - .45) * 9, 4, H - 4); } }
    const ha = c => c * cell * cell / 1e4, area = agent.reduce((a, v) => a + v, 0), bad = agent.reduce((a, v, i) => a + (v && inBuf[i] ? 1 : 0), 0), wet = agent.reduce((a, v, i) => a + (v && water[i] ? 1 : 0), 0);
    // raster layers drawn once
    const img = (fn) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), d = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { const p = fn(i); if (p) { d.data[i * 4] = p[0]; d.data[i * 4 + 1] = p[1]; d.data[i * 4 + 2] = p[2]; d.data[i * 4 + 3] = p[3] ?? 255; } } g.putImageData(d, 0, 0); return c; };
    const hill = img(i => { const x = i % W, y = (i / W) | 0; if (!x || !y || x === W - 1 || y === H - 1) return [200, 200, 196]; const dx = dem[i + 1] - dem[i - 1], dy = dem[i + W] - dem[i - W], s = clamp(.62 - (dx * .7 + dy * .7) / 30, 0, 1), e = (dem[i] - 280) / 140;
      const base = lerpColor([[226, 230, 214], [210, 214, 196], [196, 190, 172]], e); return [base[0] * (.55 + .45 * s), base[1] * (.55 + .45 * s), base[2] * (.55 + .45 * s)]; });
    const steep = img(i => slope[i] >= 5 ? [196, 120, 60, 90] : null), wat = img(i => water[i] ? [120, 165, 214, 230] : null);
    const bufI = img(i => inBuf[i] ? [184, 20, 47, 28] : null), ag = img(i => agent[i] ? (inBuf[i] ? [228, 120, 20, 230] : [29, 58, 168, 120]) : null), par = img(i => lab[i] === best ? [29, 58, 168, 210] : null);
    return {
      w: W, h: H, pan: true, crs: 'EPSG:32630 (labels only; synthetic grid, 10 m cells)',
      layers: [['hill', 'Elevation (hillshade)', 1], ['steep', 'Slope over 5°', 0], ['water', 'Water', 1], ['prot', 'Protected areas and buffers', 1], ['road', 'Grid line, 132 kV', 1], ['agent', "Agent's suitable land", 1], ['parcel', 'Largest parcel', 1]],
      legend: [['#8fa5d6', 'suitable (agent)'], ['#1d3aa8', 'largest parcel'], ['#e47814', 'inside a buffer'], ['#78a5d6', 'water'], ['#b8142f', 'protected area']],
      draw(ctx, on, s) {
        ctx.imageSmoothingEnabled = false;
        if (on.hill) ctx.drawImage(hill, 0, 0); if (on.steep) ctx.drawImage(steep, 0, 0); if (on.water) ctx.drawImage(wat, 0, 0);
        if (on.prot) { ctx.drawImage(bufI, 0, 0); for (const p of prot) { ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = 'rgba(184,20,47,.18)'; ctx.fill(); ctx.strokeStyle = '#b8142f'; ctx.lineWidth = 1.2 / s; ctx.stroke(); ctx.fillStyle = '#b8142f'; ctx.font = `${11 / s}px "Geist Mono", monospace`; ctx.fillText(p.cls, p.pts[0][0], p.pts[0][1]); } }
        if (on.agent) ctx.drawImage(ag, 0, 0); if (on.parcel) ctx.drawImage(par, 0, 0);
        if (on.road) { ctx.beginPath(); road.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = '#141619'; ctx.setLineDash([6 / s, 4 / s]); ctx.lineWidth = 1.4 / s; ctx.stroke(); ctx.setLineDash([]); }
      },
      overlay(ctx, Wp, Hp, s) { // scale bar and north arrow, screen space; s = screen px per cell
        const m = nice(Wp * .22 / s * cell, 1), px = m / cell * s, x0 = 14, y0 = Hp - 18; ctx.fillStyle = css('--surface'); ctx.globalAlpha = .85; ctx.fillRect(x0 - 6, y0 - 16, px + 60, 26); ctx.globalAlpha = 1;
        ctx.fillStyle = css('--ink'); ctx.fillRect(x0, y0, px, 3); ctx.font = '11px "Geist Mono", monospace'; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, x0, y0 - 2);
        ctx.textAlign = 'center'; ctx.fillText('N', Wp - 20, 22); ctx.beginPath(); ctx.moveTo(Wp - 20, 26); ctx.lineTo(Wp - 24, 38); ctx.lineTo(Wp - 16, 38); ctx.closePath(); ctx.fill(); },
      probe(x, y) { const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= W || yi >= H) return ''; const i = yi * W + xi;
        return `E ${(E0 + xi * cell).toLocaleString('en-GB')} · N ${(N0 + (H - yi) * cell).toLocaleString('en-GB')} · ${dem[i].toFixed(0)} m · slope ${slope[i].toFixed(1)}° · ${water[i] ? 'water' : inBuf[i] ? 'protected buffer' : agent[i] ? 'suitable' : 'unsuitable'}`; },
      answer: [['suitable_area_ha', fmt(ha(area))], ['largest_parcel_ha', fmt(ha(sizes[best] || 0))]],
      checks: [['No land inside a protected buffer', bad === 0, `${bad} agent cells (${fmt(ha(bad))} ha) inside a buffer`], ['No land on open water', wet === 0, `${wet} cells on water`],
        ['Area matches the delivered map', true, `${fmt(ha(area))} ha recounted from the mask`]],
    };
  },
};

R.seismic = {
  title: 'Seismic section', unit: 'Seismic data', faults: [['polarity', 'Agent picks troughs on a normal-polarity volume']],
  make(seed, F) {
    const NT = 120, NS = 300, dt = 4, r = rng(seed), f = fbm(seed + 7, 3), fault = 66 + Math.floor(r() * 20), throw_ = 10 + Math.floor(r() * 8);
    const hz = [[40, .05], [70, .12], [110, -.04], [150, -.09], [185, .06], [215, .14], [262, -.07]].map(([t0, rc], k) => ({ rc, t: tr => t0 + 18 * f(tr / 30, k * 3) + (tr >= fault ? throw_ : 0) + tr * .08 }));
    const dead = new Set(); while (dead.size < 3) dead.add(5 + Math.floor(r() * (NT - 10)));
    const fpk = 25, ric = t => { const a = Math.PI * fpk * t / 1000; return (1 - 2 * a * a) * Math.exp(-a * a); };
    const A = new Float32Array(NT * NS); for (let tr = 0; tr < NT; tr++) { if (dead.has(tr)) continue; for (let s = 0; s < NS; s++) { let v = (r() - .5) * .012; for (const h of hz) v += h.rc * ric((s - h.t(tr)) * dt); A[tr * NS + s] = v; } }
    const pick = []; for (let tr = 0; tr < NT; tr++) { if (dead.has(tr)) continue; let s0 = Math.round(hz[5].t(tr)); if (F.has('polarity')) s0 += Math.round(1000 / fpk / 2 / dt * .8); pick.push([tr, s0]); }
    const amp = pick.map(([tr, s]) => A[tr * NS + s]), neg = amp.filter(a => a < 0).length;
    const vd = document.createElement('canvas'); vd.width = NT; vd.height = NS; { const g = vd.getContext('2d'), d = g.createImageData(NT, NS);
      for (let tr = 0; tr < NT; tr++) for (let s = 0; s < NS; s++) { const c = lerpColor(SEIS, .5 + A[tr * NS + s] * 3.2), i = (s * NT + tr) * 4; d.data[i] = c[0]; d.data[i + 1] = c[1]; d.data[i + 2] = c[2]; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
    return {
      w: NT, h: NS, pan: true, ratio: .62, crs: 'Inline 1040, crosslines 1 to 120; two-way time, 4 ms sampling',
      layers: [['vd', 'Variable density', 1], ['wig', 'Wiggle traces', 1], ['pick', "Agent's horizon pick", 1], ['qc', 'QC flags (dead traces)', 1]],
      legend: [['#1d3aa8', 'trough (negative)'], ['#b8142f', 'peak (positive)'], ['#e4ff3a', 'pick'], ['#c4253c', 'dead trace']],
      draw(ctx, on, s) {
        ctx.imageSmoothingEnabled = true; if (on.vd) ctx.drawImage(vd, 0, 0);
        if (on.wig) { const step = s < 4 ? Math.ceil(4 / s) : 1; ctx.strokeStyle = 'rgba(20,22,25,.75)'; ctx.fillStyle = 'rgba(20,22,25,.55)'; ctx.lineWidth = .6 / s;
          for (let tr = 0; tr < NT; tr += step) { if (dead.has(tr)) continue; ctx.beginPath(); for (let sm = 0; sm < NS; sm++) { const x = tr + .5 + A[tr * NS + sm] * 4; sm ? ctx.lineTo(x, sm) : ctx.moveTo(x, sm); } ctx.stroke(); } }
        if (on.qc) for (const tr of dead) { ctx.fillStyle = 'rgba(196,37,60,.28)'; ctx.fillRect(tr, 0, 1, NS); }
        if (on.pick) { ctx.beginPath(); let last = -9; for (const [tr, sm] of pick) { tr - last > 1 ? ctx.moveTo(tr + .5, sm) : ctx.lineTo(tr + .5, sm); last = tr; } ctx.strokeStyle = '#e4ff3a'; ctx.lineWidth = 2.2 / s; ctx.stroke(); ctx.strokeStyle = '#141619'; ctx.lineWidth = .6 / s; ctx.stroke(); }
      },
      probe(x, y) { const tr = Math.floor(x), sm = Math.floor(y); if (tr < 0 || sm < 0 || tr >= NT || sm >= NS) return ''; return `crossline ${tr + 1} · ${sm * dt} ms · amplitude ${A[tr * NS + sm].toFixed(3)}${dead.has(tr) ? ' · dead trace' : ''}`; },
      answer: [['horizon picks', `${pick.length} traces`], ['dead traces', [...dead].sort((a, b) => a - b).map(t => t + 1).join(', ')]],
      checks: [['Pick on the stated polarity (peak)', neg / pick.length < .2, `${Math.round(neg / pick.length * 100)}% of picks on negative amplitude`], ['Live traces only', true, `${pick.length} picks, none on the ${dead.size} dead traces`],
        ['Pick within the record', pick.every(([, sm]) => sm >= 0 && sm < NS), `record ${NS * dt} ms`]],
    };
  },
};

R.contour = {
  title: 'Grade contours, bench 300 m', unit: 'Mining', faults: [['mass', 'Reported metal is not tonnes × grade']],
  make(seed, F) {
    const N = 64, r = rng(seed), f = fbm(seed + 3, 4), cx = 20 + r() * 24, cy = 20 + r() * 24;
    const g = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y * N + x] = Math.max(0, 1.35 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 260) * (.6 + .8 * f(x / 14, y / 14)) + (f(x / 6 + 9, y / 6) - .5) * .12);
    const cut = .3, tpb = 10 * 10 * 10 * 2.65; let tons = 0, metal = 0; for (const v of g) if (v >= cut) { tons += tpb; metal += tpb * v / 100; }
    const grade = metal / tons * 100, rep = F.has('mass') ? metal * 1.18 : metal;
    const levels = [.2, .3, .5, .7, .9, 1.1], segs = levels.map(lv => { const out = [];
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const a = g[y * N + x], b = g[y * N + x + 1], c = g[(y + 1) * N + x + 1], d = g[(y + 1) * N + x], idx = (a >= lv) | (b >= lv) << 1 | (c >= lv) << 2 | (d >= lv) << 3;
        if (!idx || idx === 15) continue; const L = (p, q) => (lv - p) / (q - p), T = [x + L(a, b), y], Rr = [x + 1, y + L(b, c)], B = [x + L(d, c), y + 1], Lf = [x, y + L(a, d)];
        const tab = { 1: [[Lf, T]], 2: [[T, Rr]], 3: [[Lf, Rr]], 4: [[Rr, B]], 5: [[Lf, T], [Rr, B]], 6: [[T, B]], 7: [[Lf, B]], 8: [[B, Lf]], 9: [[T, B]], 10: [[T, Rr], [B, Lf]], 11: [[Rr, B]], 12: [[Rr, Lf]], 13: [[T, Rr]], 14: [[Lf, T]] };
        for (const sg of tab[idx]) out.push(sg); } return { lv, out }; });
    const fill = document.createElement('canvas'); fill.width = N; fill.height = N; { const c = fill.getContext('2d'), d = c.createImageData(N, N); for (let i = 0; i < N * N; i++) { const col = lerpColor(GRADE, g[i] / 1.3); d.data[i * 4] = col[0]; d.data[i * 4 + 1] = col[1]; d.data[i * 4 + 2] = col[2]; d.data[i * 4 + 3] = 255; } c.putImageData(d, 0, 0); }
    const holes = Array.from({ length: 22 }, () => [2 + r() * (N - 4), 2 + r() * (N - 4)]);
    return {
      w: N, h: N, pan: true, crs: 'Mine grid; 10 m blocks; bench 300 m RL',
      layers: [['fill', 'Grade (Cu %)', 1], ['cont', 'Contours', 1], ['cut', 'Cut-off 0.3 %', 1], ['holes', 'Drillhole collars', 1]],
      legend: [['rgb(214,226,196)', '0.2 %'], ['rgb(74,150,140)', '0.6 %'], ['rgb(24,44,92)', '1.2 %'], ['#c4253c', 'cut-off']],
      draw(ctx, on, s) { ctx.imageSmoothingEnabled = true; if (on.fill) ctx.drawImage(fill, 0, 0);
        for (const { lv, out } of segs) { const isCut = lv === cut; if (isCut ? !on.cut : !on.cont) continue; ctx.beginPath(); for (const [[x1, y1], [x2, y2]] of out) { ctx.moveTo(x1 + .5, y1 + .5); ctx.lineTo(x2 + .5, y2 + .5); }
          ctx.strokeStyle = isCut ? '#c4253c' : 'rgba(20,22,25,.55)'; ctx.lineWidth = (isCut ? 2 : .9) / s; ctx.stroke(); }
        if (on.holes) { ctx.fillStyle = '#141619'; for (const [x, y] of holes) { ctx.beginPath(); ctx.arc(x, y, 2.2 / s, 0, TAU); ctx.fill(); } } },
      probe(x, y) { const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= N || yi >= N) return ''; return `block ${xi + 1}, ${yi + 1} · Cu ${g[yi * N + xi].toFixed(3)} %`; },
      answer: [['ore_tonnes', fmt(tons)], ['mean_grade_pct', grade.toFixed(3)], ['metal_tonnes', fmt(rep)]],
      checks: [['Metal = tonnes × grade', Math.abs(rep / (tons * grade / 100) - 1) < .01, `${fmt(rep)} t against ${fmt(tons * grade / 100)} t`], ['Mean grade at or above the cut-off', grade >= cut, `${grade.toFixed(3)} % against ${cut} %`],
        ['Tonnage within the model', tons <= N * N * tpb, `${fmt(tons)} t of ${fmt(N * N * tpb)} t`]],
    };
  },
};

R.fan = {
  title: 'Geothermal capacity, P10/P50/P90', unit: 'Geothermal', faults: [['p90', 'Agent reports P90 above P10'], ['carnot', 'Efficiency above the Carnot limit']],
  make(seed, F) {
    const r = rng(seed), years = 30, n = 400, Tres = 175 + r() * 40, Trej = 15, sims = [];
    for (let k = 0; k < n; k++) { const p0 = 18 + r() * 14 + (r() + r() - 1) * 8, d = .006 + r() * .02; sims.push(Array.from({ length: years + 1 }, (_, y) => p0 * Math.exp(-d * y))); }
    const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
    const P = Array.from({ length: years + 1 }, (_, y) => { const v = sims.map(s => s[y]); return { p90: q(v, .1), p50: q(v, .5), p10: q(v, .9) }; });
    const carnot = 1 - (Trej + 273.15) / (Tres + 273.15), eff = F.has('carnot') ? carnot * 1.18 : .11 + r() * .03;
    const rep = F.has('p90') ? { p90: P[0].p10, p50: P[0].p50, p10: P[0].p90 } : P[0];
    return {
      chart: true, crs: `Monte Carlo, ${n} draws, fixed seed; reservoir ${Tres.toFixed(0)} °C`,
      layers: [['band', 'P90 to P10 band', 1], ['p50', 'P50', 1], ['rep', "Agent's reported values", 1]],
      legend: [],
      drawChart(ctx, W, H, on) { const fr = frame(ctx, W, H, { l: 46, r: 64, t: 14, b: 34 }, [0, years], [0, Math.max(...P.map(p => p.p10)) * 1.1], { xl: 'plant year', yl: 'net capacity (MWe)' });
        const acc = css('--accent');
        if (on.band) { ctx.beginPath(); P.forEach((p, y) => y ? ctx.lineTo(fr.X(y), fr.Y(p.p10)) : ctx.moveTo(fr.X(y), fr.Y(p.p10))); for (let y = years; y >= 0; y--) ctx.lineTo(fr.X(y), fr.Y(P[y].p90)); ctx.closePath(); ctx.fillStyle = acc; ctx.globalAlpha = .14; ctx.fill(); ctx.globalAlpha = 1;
          for (const k of ['p10', 'p90']) { ctx.beginPath(); P.forEach((p, y) => y ? ctx.lineTo(fr.X(y), fr.Y(p[k])) : ctx.moveTo(fr.X(y), fr.Y(p[k]))); ctx.strokeStyle = acc; ctx.globalAlpha = .5; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; }
          label(ctx, 'P10', fr.X(years) + 6, fr.Y(P[years].p10), acc); label(ctx, 'P90', fr.X(years) + 6, fr.Y(P[years].p90), acc); }
        if (on.p50) { ctx.beginPath(); P.forEach((p, y) => y ? ctx.lineTo(fr.X(y), fr.Y(p.p50)) : ctx.moveTo(fr.X(y), fr.Y(p.p50))); ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke(); label(ctx, 'P50', fr.X(years) + 6, fr.Y(P[years].p50), acc); }
        if (on.rep) for (const [k, c] of [['p90', css('--ink')], ['p50', css('--ink')], ['p10', css('--ink')]]) { const y = fr.Y(rep[k]); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(fr.X(0) + 8, y, 3.5, 0, TAU); ctx.fill(); label(ctx, `agent ${k.toUpperCase()} ${rep[k].toFixed(1)}`, fr.X(0) + 16, y, c); }
        this._fr = fr; },
      probe(x, y) { if (!this._fr) return ''; const yr = Math.round(this._fr.Xi(x)); if (yr < 0 || yr > years) return ''; const p = P[yr]; return `year ${yr} · P90 ${p.p90.toFixed(1)} · P50 ${p.p50.toFixed(1)} · P10 ${p.p10.toFixed(1)} MWe`; },
      answer: [['mwe_p90', rep.p90.toFixed(2)], ['mwe_p50', rep.p50.toFixed(2)], ['mwe_p10', rep.p10.toFixed(2)], ['efficiency', eff.toFixed(3)]],
      checks: [['P90 ≤ P50 ≤ P10', rep.p90 <= rep.p50 && rep.p50 <= rep.p10, `${rep.p90.toFixed(1)}, ${rep.p50.toFixed(1)}, ${rep.p10.toFixed(1)} MWe`], ['Efficiency below the Carnot limit', eff < carnot, `${eff.toFixed(3)} against Carnot ${carnot.toFixed(3)} at ${Tres.toFixed(0)} °C`]],
    };
  },
};

R.hazard = {
  title: 'Seismic hazard curve', unit: 'Seismic hazard', faults: [['offcurve', 'Agent reads the 2% value 30% low (unsafe)']],
  make(seed, F) {
    const r = rng(seed), nu = .02 + r() * .04, b = 2 + r() * .6, c = .12 + r() * .1;
    const lam = y => nu * Math.pow(y / .05, -b) * Math.exp(-c * Math.log(y / .05) ** 2), poe = y => 1 - Math.exp(-50 * lam(y));
    const inv = p => { let lo = .001, hi = 5; for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); poe(m) > p ? lo = m : hi = m; } return Math.sqrt(lo * hi); };
    const p10 = inv(.1), p2 = inv(.02), rep2 = F.has('offcurve') ? p2 * .7 : p2;
    return {
      chart: true, crs: 'Classical PSHA form; 50-year investigation time, Poisson',
      layers: [['curve', 'Hazard curve', 1], ['lines', '10% and 2% in 50 years', 1], ['rep', "Agent's answers", 1]], legend: [],
      drawChart(ctx, W, H, on) { const fr = frame(ctx, W, H, { l: 52, r: 18, t: 14, b: 34 }, [.01, 3], [1e-4, 1], { xlog: true, ylog: true, xl: 'PGA (g)', yl: 'probability of exceedance in 50 years', yf: v => v >= .01 ? `${v * 100}%` : v.toExponential(0) });
        const acc = css('--accent'), ink = css('--ink');
        if (on.curve) { ctx.beginPath(); for (let i = 0; i <= 200; i++) { const y = Math.pow(10, -2 + i / 200 * Math.log10(300)), p = Math.max(1e-4, poe(y)); i ? ctx.lineTo(fr.X(y), fr.Y(p)) : ctx.moveTo(fr.X(y), fr.Y(p)); } ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke(); }
        if (on.lines) for (const [p, v, t] of [[.1, p10, '10% in 50 years (475 y)'], [.02, p2, '2% in 50 years (2,475 y)']]) { ctx.setLineDash([4, 4]); ctx.strokeStyle = css('--ink-3'); ctx.beginPath(); ctx.moveTo(fr.X(.01), fr.Y(p)); ctx.lineTo(fr.X(v), fr.Y(p)); ctx.lineTo(fr.X(v), fr.Y(1e-4)); ctx.stroke(); ctx.setLineDash([]); label(ctx, `${t}: ${v.toFixed(3)} g`, fr.X(v) + 6, fr.Y(p) - 9, css('--ink-2')); }
        if (on.rep) for (const [v, p] of [[p10, .1], [rep2, .02]]) { ctx.fillStyle = Math.abs(v / inv(p) - 1) > .02 ? css('--fail') : ink; ctx.beginPath(); ctx.arc(fr.X(v), fr.Y(p), 4, 0, TAU); ctx.fill(); }
        this._fr = fr; },
      probe(x) { if (!this._fr) return ''; const y = this._fr.Xi(x); return y > .01 && y < 3 ? `PGA ${y.toFixed(3)} g · PoE ${(poe(y) * 100).toPrecision(3)}% in 50 years` : ''; },
      answer: [['pga_10in50_g', p10.toFixed(3)], ['pga_2in50_g', rep2.toFixed(3)]],
      checks: [['Answer read from its own curve', Math.abs(rep2 / p2 - 1) < .02, `2% value ${rep2.toFixed(3)} g; the curve gives ${p2.toFixed(3)} g`], ['Rarer motion is stronger', rep2 > p10, `${rep2.toFixed(3)} g against ${p10.toFixed(3)} g`],
        ['Not unsafe (design motion within 10%)', rep2 >= p2 * .9, F.has('offcurve') ? 'design motion 30% low: unsafe' : 'within tolerance']],
    };
  },
};

R.solar = {
  title: 'Solar yield by month', unit: 'Solar', faults: [['sun', 'Energy above the sunlight reaching the plane']],
  make(seed, F) {
    const r = rng(seed), kwp = 5000, lat = 38 + r() * 12, M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const poa = M.map((_, m) => days[m] * (3.2 + 3.4 * Math.sin(Math.PI * (m + .5) / 12) ** 1.4) * (1 - (lat - 38) / 50) * (.85 + r() * .2));   // kWh/m2 on the plane
    const ceil = poa.map(p => p * kwp / 1000), e = ceil.map(c => c * (.78 + r() * .06) * (F.has('sun') ? 1.32 : 1));
    const tot = e.reduce((a, b) => a + b, 0), totC = ceil.reduce((a, b) => a + b, 0), pr = tot / totC;
    return {
      chart: true, crs: `${(kwp / 1000).toFixed(0)} MWp fixed tilt at latitude ${lat.toFixed(1)}°; synthetic weather year`,
      layers: [['bars', 'AC energy (agent)', 1], ['ceil', 'Sunlight on the plane × capacity', 1]], legend: [],
      drawChart(ctx, W, H, on) { const fr = frame(ctx, W, H, { l: 52, r: 14, t: 14, b: 34 }, [0, 12], [0, Math.max(...e, ...ceil) * 1.12], { xf: v => M[Math.min(11, Math.floor(v))] ?? '', xl: 'month', yl: 'MWh' });
        const acc = css('--accent'); for (let m = 0; m < 12; m++) { const x0 = fr.X(m + .15), x1 = fr.X(m + .85);
          if (on.bars) { ctx.fillStyle = e[m] > ceil[m] ? css('--fail') : acc; ctx.globalAlpha = .8; ctx.fillRect(x0, fr.Y(e[m]), x1 - x0, fr.Y(0) - fr.Y(e[m])); ctx.globalAlpha = 1; }
          if (on.ceil) { ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 - 3, fr.Y(ceil[m])); ctx.lineTo(x1 + 3, fr.Y(ceil[m])); ctx.stroke(); } }
        if (on.ceil) label(ctx, 'ceiling', fr.X(11.9), fr.Y(ceil[11]) - 10, css('--ink-2'), 'right'); this._fr = fr; },
      probe(x) { if (!this._fr) return ''; const m = Math.floor(this._fr.Xi(x)); return m >= 0 && m < 12 ? `${M[m]} · ${fmt(e[m])} MWh against a ceiling of ${fmt(ceil[m])} MWh` : ''; },
      answer: [['annual_energy_mwh', fmt(tot)], ['performance_ratio', pr.toFixed(3)]],
      checks: [['Energy below the sunlight reaching the plane', tot <= totC, `${fmt(tot)} MWh against ${fmt(totC)} MWh`], ['Performance ratio in (0, 1]', pr > 0 && pr <= 1, `PR ${pr.toFixed(3)}`]],
    };
  },
};

R.rose = {
  title: 'Wind rose at hub height', unit: 'Wind', faults: [['knots', 'Speeds in knots read as m/s']],
  make(seed, F) {
    const r = rng(seed), dir = r() * 360, sect = 16, bins = [[0, 4], [4, 8], [8, 12], [12, 30]], k = F.has('knots') ? 1 / 0.5144 : 1;
    const freq = Array.from({ length: sect }, (_, i) => { const d = Math.cos((i * 22.5 - dir) * Math.PI / 180); return Math.max(.01, .06 + .07 * d + .03 * r()); }), fs = freq.reduce((a, b) => a + b, 0);
    const split = freq.map(f => { const w = [.25 + r() * .1, .35, .25, .1]; const ws = w.reduce((a, b) => a + b, 0); return w.map(x => x / ws * f / fs); });
    const mean = 7.1 * k, rho = 1.2, A = Math.PI * 70 ** 2, pAvail = .5 * rho * A * (mean ** 3) * 1.91 / 1e6, pBetz = pAvail * 16 / 27, pRep = F.has('knots') ? 3.6 * .55 * 1.6 : 3.6 * .38;   // MW; 1.91 = cube-mean factor (Rayleigh)
    return {
      chart: true, crs: `Met mast, 12 months, 16 sectors; mean speed ${mean.toFixed(2)} m/s as read`,
      layers: [['rose', 'Frequency by speed', 1], ['labels', 'Direction labels', 1]], legend: [['#c9d2f2', '0 to 4 m/s'], ['#8ea2e0', '4 to 8'], ['#4a66c4', '8 to 12'], ['#1d3aa8', 'over 12']],
      drawChart(ctx, W, H, on) { const cx = W / 2, cy = H / 2 + 4, R0 = Math.min(W, H) / 2 - 30, mx = Math.max(...freq) / fs, cols = ['#c9d2f2', '#8ea2e0', '#4a66c4', '#1d3aa8'];
        ctx.strokeStyle = css('--line'); for (const q of [.25, .5, .75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R0 * q, 0, TAU); ctx.stroke(); }
        if (on.rose) for (let i = 0; i < sect; i++) { let acc = 0; const a0 = (i * 22.5 - 9 - 90) * Math.PI / 180, a1 = (i * 22.5 + 9 - 90) * Math.PI / 180;
          for (let b = 0; b < 4; b++) { const r0 = R0 * acc / mx, r1 = R0 * (acc + split[i][b]) / mx; acc += split[i][b]; ctx.beginPath(); ctx.arc(cx, cy, r1, a0, a1); ctx.arc(cx, cy, r0, a1, a0, true); ctx.closePath(); ctx.fillStyle = cols[b]; ctx.fill(); } }
        if (on.labels) for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) { const x = cx + Math.sin(a * Math.PI / 180) * (R0 + 14), y = cy - Math.cos(a * Math.PI / 180) * (R0 + 14); label(ctx, t, x, y, css('--ink-2'), 'center'); }
        this._c = { cx, cy, R0, mx }; },
      probe(x, y) { if (!this._c) return ''; const { cx, cy } = this._c, a = (Math.atan2(x - cx, cy - y) * 180 / Math.PI + 360) % 360, i = Math.round(a / 22.5) % 16; return `${(i * 22.5).toFixed(1)}° · ${(freq[i] / fs * 100).toFixed(1)}% of hours`; },
      answer: [['hub_speed_ms', mean.toFixed(2)], ['mean_power_mw', pRep.toFixed(2)]],
      checks: [['Below the Betz limit on this wind', pRep <= pBetz && mean < 15, `${pRep.toFixed(2)} MW against Betz ${pBetz.toFixed(2)} MW; hub speed ${mean.toFixed(1)} m/s`], ['Capacity factor in (0, 1]', pRep / 3.6 <= 1, `CF ${(pRep / 3.6).toFixed(2)}`]],
    };
  },
};

R.derivative = {
  title: 'Well test: pressure derivative', unit: 'Well tests', faults: [['window', 'Agent fits a window through wellbore storage']],
  make(seed, F, data) {
    let t, d, rad, win, eng = !!data;
    if (data) { t = data.t; d = data.d; rad = data.rad; win = data.win; }
    else { const r = rng(seed), CD = 300 + r() * 900, tr = .08 + r() * .2, tf = 8 + r() * 20, plat = 4e4 + r() * 4e4; t = []; d = [];
      for (let i = 0; i < 60; i++) { const x = Math.pow(10, -3 + i * 5 / 59); t.push(x); const hump = 1 + 2.2 * Math.exp(-((Math.log10(x / (tr * .3))) ** 2) / .35), early = Math.min(1, x / (tr * .05));
        d.push(plat * (x < tr * .05 ? early * 2.5 : hump) * (1 + 1 / (1 + Math.exp(-3 * Math.log(x / tf)))) * (1 + (r() - .5) * .04)); }
      rad = [tr * 1.5, tf * .6]; win = F.has('window') ? [tr * .02, tr * .5] : [tr * 2, tf * .4]; }
    const inRad = win[0] != null && win[0] >= rad[0] * .8 && win[1] <= rad[1] * 1.25;
    return {
      chart: true, engine: eng, crs: eng ? 'Bourdet derivative computed by the engine from the task data (smoothing 0.3)' : 'Synthetic buildup: storage hump, radial flow, a sealing fault',
      layers: [['der', 'Bourdet derivative', 1], ['rad', 'Radial-flow period (key)', 1], ['win', "Agent's fitted window", 1]], legend: [],
      drawChart(ctx, W, H, on) { const xs = t.filter(x => x > 0), ys = d.filter(y => y > 0), fr = frame(ctx, W, H, { l: 56, r: 14, t: 14, b: 34 }, [Math.min(...xs) * .8, Math.max(...xs) * 1.2], [Math.min(...ys) * .6, Math.max(...ys) * 1.6], { xlog: true, ylog: true, xl: 'Δt (h)', yl: 'derivative (Pa)', yf: v => v.toExponential(0) });
        if (on.rad && rad[0]) { ctx.fillStyle = css('--pass'); ctx.globalAlpha = .1; ctx.fillRect(fr.X(rad[0]), 14, fr.X(rad[1]) - fr.X(rad[0]), H - 48); ctx.globalAlpha = 1; label(ctx, 'radial flow', fr.X(rad[0]) + 4, 24, css('--pass')); }
        if (on.win && win[0] != null) { ctx.strokeStyle = inRad ? css('--accent') : css('--fail'); ctx.lineWidth = 1.5; for (const v of win) { ctx.beginPath(); ctx.moveTo(fr.X(v), 14); ctx.lineTo(fr.X(v), H - 34); ctx.stroke(); } label(ctx, `agent window ${fmt(win[0])}–${fmt(win[1])} h`, fr.X(win[0]) + 4, H - 44, inRad ? css('--accent') : css('--fail')); }
        if (on.der) { ctx.fillStyle = css('--ink'); for (let i = 0; i < t.length; i++) if (t[i] > 0 && d[i] > 0) { ctx.beginPath(); ctx.arc(fr.X(t[i]), fr.Y(d[i]), 2.4, 0, TAU); ctx.fill(); } }
        this._fr = fr; },
      probe(x) { if (!this._fr) return ''; const v = this._fr.Xi(x); let j = 0; for (let i = 1; i < t.length; i++) if (Math.abs(Math.log(t[i] / v)) < Math.abs(Math.log(t[j] / v))) j = i; return `Δt ${fmt(t[j])} h · derivative ${fmt(d[j])} Pa`; },
      answer: win[0] != null ? [['dt_from_h', fmt(win[0])], ['dt_to_h', fmt(win[1])]] : [],
      checks: [['Window flat on the derivative (inside radial flow)', inRad, `window ${fmt(win[0])}–${fmt(win[1])} h; radial flow ${fmt(rad[0])}–${fmt(rad[1])} h`]],
    };
  },
};

/* ---------------------------------------------------------------- the shell */
const DISC = { welltest: 'derivative', geothermal: 'fan', documents: 'fan', mining: 'contour', scheduling: 'contour', hazard: 'hazard', seismic: 'seismic', solar: 'solar', pvreal: 'solar', wind: 'rose', gis: 'map' };
function mount(el, kind, o = {}) {
  const def = R[kind], seed = o.seed ?? 1, faults = new Set(o.faults || []), M = def.make(seed, faults, o.data), sim = !M.engine;
  const on = Object.fromEntries(M.layers.map(([k, , v]) => [k, !!v])), prov = sim ? `Simulated · seed ${seed}${faults.size ? ' · faults: ' + [...faults].join(', ') : ''}` : `Engine data${o.taskId ? ' · ' + o.taskId : ''}`;
  el.classList.add('vw'); el.innerHTML = `<div class="vw-h"><b>${def.title}</b><span class="mark ${sim ? 'sim' : 'eng'}">${sim ? 'Simulated' : 'Engine data'}</span><span class="vw-p">${prov}${M.crs ? ' · ' + M.crs : ''}</span></div>
    <div class="vw-t"><span class="vw-l">${M.layers.map(([k, l]) => `<label><input type="checkbox" data-l="${k}"${on[k] ? ' checked' : ''}> ${l}</label>`).join('')}</span>
      <span class="vw-b">${M.chart ? '' : '<button data-z="-" aria-label="Zoom out">−</button><button data-z="+" aria-label="Zoom in">+</button><button data-z="0">Fit</button>'}<button data-x="png">PNG</button></span></div>
    <div class="vw-c"><canvas role="img" aria-label="${def.title}, ${prov}"></canvas><div class="vw-r" aria-live="off"></div>${sim ? '<div class="vw-sim">Simulated</div>' : ''}</div>
    ${M.legend.length ? `<div class="vw-g">${M.legend.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>` : ''}`;
  const cv = el.querySelector('canvas'), ro = el.querySelector('.vw-r'), ctx = cv.getContext('2d');
  let W = 0, H = 0, v = { k: 1, x: 0, y: 0 };
  const ratio = M.chart ? .55 : (M.ratio || M.h / M.w);
  const size = () => { const b = el.querySelector('.vw-c').getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); W = Math.max(200, b.width);
    H = Math.round(clamp(W * ratio, 220, M.chart ? 420 : 560)); cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const scl = () => [W / M.w * v.k, H / M.h * v.k];
  function draw() { ctx.save(); ctx.clearRect(0, 0, W, H); ctx.fillStyle = css('--surface'); ctx.fillRect(0, 0, W, H);
    if (M.chart) M.drawChart.call(M, ctx, W, H, on);
    else { const [a, b] = scl(); ctx.save(); ctx.translate(W / 2 + v.x, H / 2 + v.y); ctx.scale(a, b); ctx.translate(-M.w / 2, -M.h / 2); M.draw(ctx, on, Math.min(a, b)); ctx.restore(); if (M.overlay) M.overlay(ctx, W, H, a); }
    ctx.restore(); }
  const toWorld = (px, py) => { if (M.chart) return [px, py]; const [a, b] = scl(); return [(px - W / 2 - v.x) / a + M.w / 2, (py - H / 2 - v.y) / b + M.h / 2]; };
  size(); draw();
  el.querySelectorAll('[data-l]').forEach(c => c.onchange = () => { on[c.dataset.l] = c.checked; draw(); });
  el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { if (b.dataset.z === '0') v = { k: 1, x: 0, y: 0 }; else { const f = b.dataset.z === '+' ? 1.4 : 1 / 1.4; v.k = clamp(v.k * f, 1, 24); v.x *= f; v.y *= f; } draw(); });
  el.querySelector('[data-x=png]').onclick = () => { const c = document.createElement('canvas'), dpr = cv.width / W; c.width = cv.width; c.height = cv.height + 28 * dpr; const g = c.getContext('2d');
    g.fillStyle = css('--surface'); g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, 0); g.scale(dpr, dpr); g.fillStyle = sim ? '#8a5a00' : css('--ink-2'); g.font = '500 12px "Geist Mono", monospace'; g.textBaseline = 'middle';
    g.fillText(`${sim ? 'SIMULATED, not a measurement' : 'Engine data'} · ${prov} · Scorcher Build`, 10, H + 14);
    const a = document.createElement('a'); a.download = `scorcher-${kind}-${sim ? 'simulated-seed' + seed : (o.taskId || 'engine')}.png`; a.href = c.toDataURL('image/png'); a.click(); };
  let drag = null;
  cv.onpointerdown = e => { if (M.chart) return; drag = [e.clientX, e.clientY, v.x, v.y]; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { const b = cv.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    if (drag) { v.x = drag[2] + e.clientX - drag[0]; v.y = drag[3] + e.clientY - drag[1]; draw(); }
    const [wx, wy] = toWorld(px, py); ro.textContent = M.probe.call(M, wx, wy) || ''; };
  cv.onpointerup = () => { drag = null; }; cv.onpointerleave = () => { ro.textContent = ''; };
  cv.onwheel = e => { if (M.chart || !(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const f = e.deltaY < 0 ? 1.15 : 1 / 1.15; v.k = clamp(v.k * f, 1, 24); draw(); };
  const onR = () => { size(); draw(); }; const rob = new ResizeObserver(onR); rob.observe(el.querySelector('.vw-c'));
  return { checks: M.checks, answer: M.answer, simulated: sim, redraw: draw, destroy() { rob.disconnect(); } };
}
window.SBV = { R, DISC, mount, rng, hash, kinds: Object.fromEntries(Object.entries(R).map(([k, r]) => [k, { title: r.title, unit: r.unit, faults: r.faults }])),
  checks(kind, seed, faults, data) { const M = R[kind].make(seed, new Set(faults || []), data); return { checks: M.checks, answer: M.answer }; } };
})();
