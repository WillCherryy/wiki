#!/usr/bin/env node
'use strict';
// Puts the Galaxy's hottest stars into the star catalogue once each, so Scorcher Sky and Your Sky draw, name and count them like every other star.
//   NODE_USE_ENV_PROXY=1 node tools/merge-hot-stars.js [--dry]
// Sources: Galactic O-Star Catalog (Maíz Apellániz et al. 2004, ApJS 151, 103) and the VIIth Catalogue of Galactic Wolf–Rayet Stars
// (van der Hucht 2001, New Astron. Rev. 45, 135), both via NASA HEASARC.
// - A hot star that is already in stars/catalogue.bin (Gaia DR3 or HYG) is matched by position, with its V magnitude checked against the
//   catalogue star's apparent magnitude so a chance alignment is not taken for the star. It keeps the catalogue's position and distance
//   (Gaia's parallax), and gains its spectral type and catalogue name.
// - A hot star not in the catalogue is appended as a new section, at its published position and distance, with brightness from its V magnitude
//   and colour from its B−V, computed the way the catalogue's own stars are (apparent magnitude and distance, no correction for dust).
// - Entries that are the same star (a catalogue listing it twice, or a Wolf–Rayet star with an O-type companion) become one, their types joined.
// Writes stars/catalogue.bin (replacing any earlier hot section), stars/names.txt, stars/hot.json, and removes O and Wolf–Rayet rows from stars/points.json.
const fs = require('fs'), path = require('path'), { tap } = require('./votable.js');
const ROOT = path.join(__dirname, '..'), CATF = path.join(ROOT, 'stars', 'catalogue.bin'), NAMESF = path.join(ROOT, 'stars', 'names.txt'), HOTF = path.join(ROOT, 'stars', 'hot.json'), PTF = path.join(ROOT, 'stars', 'points.json');
const HEASARC = 'https://heasarc.gsfc.nasa.gov/xamin/vo/tap', LYPC = 3.26156, D2R = Math.PI / 180;
const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];   // J2000 equatorial -> galactic
const toGal = (ra, de, ly) => { const e = [Math.cos(de * D2R) * Math.cos(ra * D2R), Math.cos(de * D2R) * Math.sin(ra * D2R), Math.sin(de * D2R)]; return M.map(r => (r[0] * e[0] + r[1] * e[1] + r[2] * e[2]) * ly); };
const toEq = (x, y, z) => { const r = Math.hypot(x, y, z), g = [x / r, y / r, z / r], e = [0, 1, 2].map(j => M[0][j] * g[0] + M[1][j] * g[1] + M[2][j] * g[2]); return [((Math.atan2(e[1], e[0]) / D2R) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, e[2]))) / D2R]; };
const sepArcmin = (a1, d1, a2, d2) => { const x = Math.sin((d2 - d1) * D2R / 2) ** 2 + Math.cos(d1 * D2R) * Math.cos(d2 * D2R) * Math.sin((a2 - a1) * D2R / 2) ** 2; return 2 * Math.asin(Math.sqrt(Math.min(1, x))) / D2R * 60; };
const clean = s => String(s || '').replace(/\.\s/g, ' ').replace(/\s+/g, ' ').trim();

function readCatalogue() {
  const b = fs.readFileSync(CATF), tag = b.toString('ascii', 0, 4); if (tag !== 'SCT3') throw new Error('expected an SCT3 catalogue, found ' + tag);
  const n = b.readUInt32LE(4), secs = []; for (let i = 0; i < n; i++) secs.push({ unit: b.readFloatLE(8 + i * 8), count: b.readUInt32LE(12 + i * 8) });
  let o = 8 + n * 8; const recs = []; secs.forEach((s, si) => { for (let i = 0; i < s.count; i++, o += 10) recs.push({ sec: si, raw: b.subarray(o, o + 10), x: b.readInt16LE(o) * s.unit, y: b.readInt16LE(o + 2) * s.unit, z: b.readInt16LE(o + 4) * s.unit, am: b.readInt16LE(o + 6) / 100, unit: s.unit }); });
  const names = new Map(); for (const l of fs.readFileSync(NAMESF, 'utf8').split('\n')) { const k = l.indexOf('\t'); if (k > 0) names.set(+l.slice(0, k), l.slice(k + 1)); }
  return { secs, recs, names };
}

(async () => {
  const dry = process.argv.includes('--dry');
  console.log('O stars and Wolf–Rayet stars from HEASARC…');
  const O = await tap(HEASARC, 'SELECT name, alt_name, ra, dec, distance, spect_type, vmag, bv_color FROM ostars'), Wt = await tap(HEASARC, 'SELECT name, alt_name_3, ra, dec, distance, spect_type, vmag, bv_color FROM wrcat');
  const col = (t, r, c) => r[t.fields.indexOf(c)], hot = [];
  for (const r of O.rows) hot.push({ set: 'ostar', n: clean(col(O, r, 'name')), ra: col(O, r, 'ra'), de: col(O, r, 'dec'), kpc: col(O, r, 'distance'), sp: clean(col(O, r, 'spect_type')), V: col(O, r, 'vmag'), bv: col(O, r, 'bv_color') });
  for (const r of Wt.rows) hot.push({ set: 'wr', n: clean(col(Wt, r, 'name')), alt: clean(col(Wt, r, 'alt_name_3')), ra: col(Wt, r, 'ra'), de: col(Wt, r, 'dec'), kpc: col(Wt, r, 'distance'), sp: clean(col(Wt, r, 'spect_type')), V: col(Wt, r, 'vmag'), bv: col(Wt, r, 'bv_color') });
  const C = readCatalogue(), base = C.secs.length >= 3 && C.secs[2].hot ? 2 : Math.min(2, C.secs.length), keep = C.recs.filter(r => r.sec < 2);   // sections 0 (far) and 1 (100 pc) are Gaia/HYG; any third is an earlier hot section, rebuilt here
  // the catalogue stars by direction, in 0.25-degree cells
  const cell = new Map(), ck = (ra, de) => Math.floor((de + 90) * 4) * 2000 + Math.floor(ra * 4); keep.forEach((s, i) => { const [ra, de] = toEq(s.x, s.y, s.z); s.ra = ra; s.de = de; s.ly = Math.hypot(s.x, s.y, s.z); s.mapp = s.am + 5 * Math.log10(s.ly / LYPC / 10); s.i = i; const k = ck(ra, de); (cell.get(k) || cell.set(k, []).get(k)).push(s); });
  const near = (ra, de, tolArc) => { const out = [], dd = Math.ceil(tolArc / 15) + 1; for (let a = -dd; a <= dd; a++) for (let b = -dd * 4; b <= dd * 4; b++) for (const s of cell.get(ck((ra + b / 4 + 360) % 360, de + a / 4)) || []) { const d = sepArcmin(ra, de, s.ra, s.de); if (d <= Math.max(tolArc, Math.min(3, 1.3 * 0.87 * s.unit / s.ly * 3437.75))) out.push([s, d]); } return out; };   // the catalogue stores positions to its unit in 3D, so its directions carry that uncertainty
  const linked = new Map(), loose = [], why = { matched: 0, 'no distance': 0, 'merged duplicate': 0, appended: 0, 'no magnitude': 0 };
  for (const h of hot) {
    const hly = h.kpc > 0 ? h.kpc * 1000 * LYPC : 0, c = near(h.ra, h.de, 0.5).filter(([s, d]) => (h.V == null ? s.mapp < 12.5 : Math.abs(s.mapp - h.V) < 1.6) && (hly ? s.ly / hly > .4 && s.ly / hly < 2.5 : true) && (hly || h.V != null || d <= .5)).sort((p, q) => p[1] - q[1])[0];   // G and V differ by up to a magnitude or so for reddened hot stars; a distance more than 2.5 times off is a foreground star by chance alignment, not this one
    if (c) { const s = c[0], e = linked.get(s.i); why.matched++; if (e) { e.sp.push(h.sp); e.names.push(h.n); e.sets.add(h.set); e.src.push({ set: h.set, n: h.n, ly: h.kpc ? Math.round(h.kpc * 1000 * LYPC) : null }); } else linked.set(s.i, { sp: [h.sp], names: [h.n], sets: new Set([h.set]), src: [{ set: h.set, n: h.n, ly: h.kpc ? Math.round(h.kpc * 1000 * LYPC) : null }], alt: h.alt }); continue; }
    if (!(h.kpc > 0)) { why['no distance']++; continue; } if (h.V == null) { why['no magnitude']++; continue; }
    const dup = loose.find(q => sepArcmin(q.ra, q.de, h.ra, h.de) < 0.05); if (dup) { why['merged duplicate']++; dup.sp.push(h.sp); dup.names.push(h.n); dup.sets.add(h.set); continue; }   // within 3 arcseconds: the same star listed again
    loose.push({ ...h, sp: [h.sp], names: [h.n], sets: new Set([h.set]) }); }
  why.appended = loose.length;
  const uniq = a => [...new Set(a.filter(Boolean))], label = e => { const ns = uniq(e.names); return ns[0] + (ns.length > 1 ? ' (' + ns.slice(1).join(', ') + ')' : ''); };
  // the new section: unmatched hot stars at their published distance, brightness and colour as the catalogue computes them
  const pts = loose.map(h => { const ly = h.kpc * 1000 * LYPC, [x, y, z] = toGal(h.ra, h.de, ly), am = h.V - 5 * Math.log10(ly / LYPC / 10); return { x, y, z, am, ci: h.bv == null ? -.3 : h.bv, h }; });
  const far = Math.max(...pts.map(p => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)))), hu = far * 1.001 / 32767;
  const rec = p => { const b = Buffer.alloc(10); b.writeInt16LE(Math.round(p.x / hu), 0); b.writeInt16LE(Math.round(p.y / hu), 2); b.writeInt16LE(Math.round(p.z / hu), 4); b.writeInt16LE(Math.round(Math.max(-327, Math.min(327, p.am)) * 100), 6); b.writeInt8(Math.round(Math.max(-2.5, Math.min(2.5, p.ci)) * 50), 8); return b; };
  const n0 = C.secs[0].count, n1 = C.secs[1].count, links = {};
  for (const [i, e] of linked) links[i] = { n: label(e), sp: uniq(e.sp).join(' + '), sets: [...e.sets], src: e.src, gaia: true };
  pts.forEach((p, j) => { links[n0 + n1 + j] = { n: label(p.h), sp: uniq(p.h.sp).join(' + '), sets: [...p.h.sets], src: [{ set: p.h.set, n: p.h.n, ly: Math.round(p.h.kpc * 1000 * LYPC) }], gaia: false }; });
  const perSet = s => Object.values(links).filter(l => l.sets.includes(s)).length;
  console.log(`matched to catalogue stars: ${linked.size} stars (${why.matched} catalogue entries); appended: ${pts.length}; left out:`, { 'no distance': why['no distance'], 'no magnitude': why['no magnitude'], 'merged duplicates': why['merged duplicate'] });
  console.log(`hot stars now in the catalogue: ${Object.keys(links).length} (O-star catalogue entries ${perSet('ostar')}, Wolf–Rayet ${perSet('wr')}); new section unit ${hu.toFixed(3)} ly`);
  if (dry) return;
  const head = Buffer.alloc(8 + 24); head.write('SCT3', 0, 'ascii'); head.writeUInt32LE(3, 4); [[C.secs[0].unit, n0], [C.secs[1].unit, n1], [hu, pts.length]].forEach(([u, c], k) => { head.writeFloatLE(u, 8 + k * 8); head.writeUInt32LE(c, 12 + k * 8); });
  fs.writeFileSync(CATF, Buffer.concat([head, ...keep.map(s => s.raw), ...pts.map(rec)]));
  const names = new Map([...C.names].filter(([k]) => k < n0 + n1)); for (const [k, l] of Object.entries(links)) if (!names.has(+k)) names.set(+k, l.n.split(' (')[0]);   // a hot star keeps its catalogue name if it has one, else takes its O-star or WR designation
  fs.writeFileSync(NAMESF, [...names].sort((a, b) => a[0] - b[0]).map(([k, v]) => k + '\t' + v).join('\n'));
  fs.writeFileSync(HOTF, JSON.stringify({ v: 1, built: new Date().toISOString().slice(0, 10), sets: { ostar: 'Galactic O-Star Catalog (Maíz Apellániz et al. 2004), ApJS 151, 103', wr: 'VIIth Catalogue of Galactic Wolf–Rayet Stars (van der Hucht 2001), New Astron. Rev. 45, 135' }, links }));
  try { const P = JSON.parse(fs.readFileSync(PTF, 'utf8')); const before = P.rows.length; P.rows = P.rows.filter(r => r.s !== 'ostar' && r.s !== 'wr'); delete P.sets.ostar; delete P.sets.wr; fs.writeFileSync(PTF, JSON.stringify(P)); console.log(`stars/points.json: ${before - P.rows.length} O and Wolf–Rayet rows removed (now in the catalogue)`); } catch (e) { console.warn('points.json not updated:', e.message); }
  console.log(`stars/catalogue.bin: ${(fs.statSync(CATF).size / 1e6).toFixed(2)} MB; stars/hot.json: ${Object.keys(links).length} hot stars`);
})().catch(e => { console.error(e.message); process.exit(1); });
