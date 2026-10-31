#!/usr/bin/env node
'use strict';
// Adds the Sun's neighbourhood to stars/catalogue.bin: every star within 100 pc (326 ly) that Gaia DR3 measured to better than 10% in parallax,
// at fine precision, plus the bright stars Gaia saturates on (from HYG). The stars beyond 100 pc already in the catalogue are kept as they are.
//   node tools/build-stars-near.js [--hyg hyg.csv] near.csv [bright.csv …]
// near.csv: a Gaia DR3 export of   SELECT source_id, ra, dec, parallax, parallax_error, phot_g_mean_mag, phot_bp_mean_mag, phot_rp_mean_mag
//   FROM gaiadr3.gaia_source WHERE parallax > 10 AND parallax_over_error > 10 AND ruwe < 1.4   (the same as gaia.dr3lite on GAVO, with parallax > 10*parallax_error)
// bright.csv: the same columns WHERE parallax > 10 AND parallax_over_error > 10 AND ruwe >= 1.4 AND phot_g_mean_mag < 10.5: bright stars and binaries often have a
//   high RUWE, and the far catalogue never cut on it, so they are kept as before (the RUWE cut guards against spurious parallaxes among faint stars)
// Output format 'SCT3': 'SCT3', uint32 section count, then per section float32 ly-per-unit and uint32 record count, then the records of every section in
// order (10 bytes each, as in SCT2). Section 0: the far stars (coarse unit); section 1: the neighbourhood (fine unit). names.txt numbers the records in that order.
// Stars already in stars/points.json as ultracool dwarfs (with their spectral types) are left out here, so none is drawn twice.
const fs = require('fs'), path = require('path'), https = require('https');
const { hygName, M, readIn } = require('./build-stars.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'stars', 'catalogue.bin'), NAMES = path.join(ROOT, 'stars', 'names.txt'), R100 = 326.156;
const HYGURL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const get = u => new Promise((res, rej) => https.get(u, r => { if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode)); const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b).toString('utf8'))); }).on('error', rej));
const toGal = (raDeg, deDeg, ly) => { const ra = raDeg * Math.PI / 180, de = deDeg * Math.PI / 180, e = [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)]; return M.map(r => (r[0] * e[0] + r[1] * e[1] + r[2] * e[2]) * ly); };

function readCatalogue() {   // the existing file, SCT2 or SCT3: the far section's records with their names
  const b = fs.readFileSync(OUT), tag = b.toString('ascii', 0, 4), names = new Map(); for (const l of fs.readFileSync(NAMES, 'utf8').split('\n')) { const k = l.indexOf('\t'); if (k > 0) names.set(+l.slice(0, k), l.slice(k + 1)); }
  let secs, o; if (tag === 'SCT3') { const n = b.readUInt32LE(4); secs = []; for (let i = 0; i < n; i++) secs.push({ unit: b.readFloatLE(8 + i * 8), count: b.readUInt32LE(12 + i * 8) }); o = 8 + n * 8; }
  else if (tag === 'SCT2') { secs = [{ unit: b.readFloatLE(4), count: (b.length - 8) / 10 }]; o = 8; } else throw new Error('unknown catalogue format ' + tag);
  const far = [], s0 = secs[0]; for (let i = 0; i < s0.count; i++) { const p = o + i * 10, x = b.readInt16LE(p) * s0.unit, y = b.readInt16LE(p + 2) * s0.unit, z = b.readInt16LE(p + 4) * s0.unit; far.push({ x, y, z, raw: b.subarray(p, p + 10), name: names.get(i) || '' }); }
  return { unit: s0.unit, far };
}
(async () => {
  const av = process.argv.slice(2), hi = av.indexOf('--hyg'), hygFile = hi >= 0 ? av.splice(hi, 2)[1] : null, gaiaFiles = av; if (!gaiaFiles.length) { console.error('usage: node tools/build-stars-near.js [--hyg hyg.csv] near.csv [bright.csv …]'); process.exit(1); }
  global.window = {}; require(path.join(ROOT, 'skyobjects.js')); const SKY = window.SKY, named = new Set(); for (const L of Object.values(SKY.POOL)) for (const q of L) named.add(q.n);
  const NEARP = Object.values(SKY.NEAR).filter(q => q[3]).map(q => [(q[0] + q[1] / 60) * 15, q[2], q[3]]), isGame = (ra, de, ly) => NEARP.some(([r, d, dl]) => Math.abs(d - de) < .06 && Math.abs((r - ra + 540) % 360 - 180) * Math.cos(de * Math.PI / 180) < .06 && Math.abs(dl - ly) < .25 * dl);   // a collectable is drawn by the map itself
  let ucd = []; try { ucd = JSON.parse(fs.readFileSync(path.join(ROOT, 'stars', 'points.json'), 'utf8')).rows.filter(r => r.s === 'ucd'); } catch {}
  const ucdCell = new Map(), ck = (ra, de) => Math.floor(de * 10) * 10000 + Math.floor(ra * 10); ucd.forEach(r => { const k = ck(r.ra, r.de); (ucdCell.get(k) || ucdCell.set(k, []).get(k)).push(r); });
  const isUcd = (ra, de, ly) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const r of ucdCell.get(ck(ra + b / 10, de + a / 10)) || []) { const dra = (r.ra - ra) * Math.cos(de * Math.PI / 180) * 3600, dde = (r.de - de) * 3600; if (dra * dra + dde * dde < 3600 && Math.abs(r.d - ly) < .15 * r.d) return true; } return false; };   // within 60″ (its J2000 position against Gaia's 2016: these dwarfs move fast) and 15% in distance
  const { unit, far } = readCatalogue(), keepFar = far.filter(s => Math.hypot(s.x, s.y, s.z) >= R100);
  console.log(`existing catalogue: ${far.length} stars (unit ${unit.toFixed(3)} ly); keeping ${keepFar.length} beyond 100 pc`);
  // HYG: the bright stars within 100 pc (Gaia saturates on them) and the names for the rest
  const hyg = (hygFile ? readIn(hygFile) : await get(HYGURL)).split(/\r?\n/), hh = hyg[0].split(',').map(s => s.replace(/"/g, '')), hc = n => hh.indexOf(n), cc = Object.fromEntries(['proper', 'con', 'bayer', 'flam', 'gl', 'hd', 'hip'].map(k => [k, hc(k)]));
  const near = [], hygPos = new Map(), cellK = (ra, de) => Math.floor(de * 20) * 100000 + Math.floor(ra * 20); let skipped = { game: 0, ucd: 0, far: 0, bad: 0 };
  for (let i = 1; i < hyg.length; i++) { const f = hyg[i].match(/("([^"]*)"|[^,]*)(,|$)/g); if (!f || f.length < hh.length) continue; const v = k => f[k].replace(/,$/, '').replace(/"/g, ''); const pc = +v(hc('dist')), ra = +v(hc('ra')) * 15, de = +v(hc('dec')), mag = +v(hc('mag')), nm = v(hc('proper')), label = hygName(v, cc);
    if (!(pc > 0) || pc >= 100 || nm === 'Sol') continue; if (label && mag >= 3.5) { const k = cellK(ra, de); (hygPos.get(k) || hygPos.set(k, []).get(k)).push([ra, de, mag, label]); }
    if (mag >= 4) continue; const ly = pc * 3.26156; if (named.has(nm) || isGame(ra, de, ly)) { skipped.game++; continue; } near.push([...toGal(ra, de, ly), +v(hc('absmag')), v(hc('ci')) === '' ? .65 : +v(hc('ci')), label]); }
  // Gaia: everything else within 100 pc
  const seen = new Set(); for (const gf of gaiaFiles) { const G = readIn(gf).split(/\r?\n/), gh = G[0].split(',').map(s => s.replace(/"/g, '').trim()), gc = n => gh.indexOf(n), bpI = gc('phot_bp_mean_mag'), rpI = gc('phot_rp_mean_mag'), brI = gc('bp_rp'), sI = gc('source_id');
  for (let i = 1; i < G.length; i++) { const f = G[i].split(','); if (f.length < gh.length) continue; const plx = +f[gc('parallax')], g = +f[gc('phot_g_mean_mag')], ra = +f[gc('ra')], de = +f[gc('dec')];
    if (sI >= 0) { if (seen.has(f[sI])) continue; seen.add(f[sI]); } if (!(plx > 10) || !isFinite(g) || g < 4) { skipped.bad++; continue; } const ly = 1000 / plx * 3.26156; if (ly >= R100) { skipped.far++; continue; }
    if (isGame(ra, de, ly)) { skipped.game++; continue; } if (isUcd(ra, de, ly)) { skipped.ucd++; continue; }
    const br = brI >= 0 ? (f[brI] === '' ? NaN : +f[brI]) : (f[bpI] === '' || f[rpI] === '' ? NaN : +f[bpI] - +f[rpI]), ci = isFinite(br) ? .7 * br + .05 : .82 * .7 + .05, am = g + 5 * Math.log10(plx / 100);
    let label = ''; for (let a = -1; a <= 1 && !label; a++) for (let b = -1; b <= 1 && !label; b++) for (const h of hygPos.get(cellK(ra + b / 20, de + a / 20)) || []) { const dra = (h[0] - ra) * Math.cos(de * Math.PI / 180) * 3600, dde = (h[1] - de) * 3600; if (dra * dra + dde * dde < 64 && Math.abs(h[2] - g) < 1.6) { label = h[3]; break; } }   // the same star in HYG: within 8″ and 1.6 magnitudes
    near.push([...toGal(ra, de, ly), am, ci, label]); } }
  const nu = R100 * 1.001 / 32767, rec = s => { const b = Buffer.alloc(10); b.writeInt16LE(Math.round(s[0] / nu), 0); b.writeInt16LE(Math.round(s[1] / nu), 2); b.writeInt16LE(Math.round(s[2] / nu), 4); b.writeInt16LE(Math.round(Math.max(-327, Math.min(327, s[3])) * 100), 6); b.writeInt8(Math.round(Math.max(-2.5, Math.min(2.5, s[4])) * 50), 8); return b; };
  const head = Buffer.alloc(8 + 16); head.write('SCT3', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeFloatLE(unit, 8); head.writeUInt32LE(keepFar.length, 12); head.writeFloatLE(nu, 16); head.writeUInt32LE(near.length, 20);
  fs.writeFileSync(OUT, Buffer.concat([head, ...keepFar.map(s => s.raw), ...near.map(rec)]));
  const names = []; keepFar.forEach((s, i) => { if (s.name) names.push(i + '\t' + s.name); }); near.forEach((s, i) => { if (s[5]) names.push((keepFar.length + i) + '\t' + s[5]); }); fs.writeFileSync(NAMES, names.join('\n'));
  console.log(`stars/catalogue.bin: ${keepFar.length} far + ${near.length} within 100 pc (${(nu * 1000).toFixed(1)} thousandths of a ly per unit), ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB; ${names.length} named; left out:`, skipped);
})().catch(e => { console.error(e.message); process.exit(1); });
