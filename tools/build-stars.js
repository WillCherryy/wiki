#!/usr/bin/env node
'use strict';
// Packs a real star catalogue into stars/catalogue.bin for the Observatory: every star with a measured distance, placed in galactic coordinates.
//   node tools/build-stars.js                      HYG only (downloaded)
//   node tools/build-stars.js gaia.csv             a Gaia DR3 export (columns ra, dec, parallax, phot_g_mean_mag, bp_rp) merged with HYG
//   node tools/build-stars.js hyg.csv gaia.csv     both from local files
// HYG v4.1 (astronexus, CC BY-SA 4.0; Hipparcos, Yale and Gliese catalogues) supplies the brightest stars, which Gaia saturates on; with a Gaia file,
// HYG keeps only stars brighter than magnitude 4 and Gaia supplies everything fainter.
// File: 'SCT2', float32 light-years per unit, then 10-byte records (little-endian): int16 x, y, z (x towards the Galactic Centre, y towards
// l = 90 deg, z towards the north galactic pole, the Sun at the origin), int16 absolute magnitude x 100, int8 B-V colour x 50, int8 spare.
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'stars', 'catalogue.bin'), URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const get = u => new Promise((res, rej) => https.get(u, r => { if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode)); const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b).toString('utf8'))); }).on('error', rej));
const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];   // J2000 equatorial -> galactic
(async () => {
  const args = process.argv.slice(2), files = []; for (const a of args) files.push(fs.readFileSync(a, 'utf8')); if (!files.some(t => /(^|,)"?dist"?(,|$)/m.test(t.slice(0, 2000)))) files.unshift(await get(URL));
  const withGaia = files.some(t => /parallax/.test(t.slice(0, 2000)));
  global.window = {}; require(path.join(ROOT, 'skyobjects.js')); const named = new Set(); for (const L of Object.values(window.SKY.POOL)) for (const q of L) named.add(q.n);   // collectable objects are drawn by the game itself
  const stars = []; let skipped = 0;
  for (const csv of files) { const lines = csv.split(/\r?\n/), head = lines[0].split(',').map(s => s.replace(/"/g, '').trim()), col = n => head.indexOf(n), gaia = col('parallax') >= 0;
    const cRa = col('ra'), cDec = col('dec'), cDist = col('dist'), cAbs = col('absmag'), cCi = col('ci'), cName = col('proper'), cMag = col('mag'), cPlx = col('parallax'), cG = col('phot_g_mean_mag'), cBR = col('bp_rp');
    for (let i = 1; i < lines.length; i++) { if (!lines[i]) continue; const f = lines[i].match(/("([^"]*)"|[^,]*)(,|$)/g); if (!f || f.length < head.length) continue; const v = k => f[k].replace(/,$/, '').replace(/"/g, '');
      let ra, de, pc, am, ci, nm = '';
      if (gaia) { const plx = +v(cPlx), G = +v(cG), br = v(cBR) === '' ? .82 : +v(cBR); if (!(plx > 0) || !isFinite(G) || G < 4) { skipped++; continue; } ra = +v(cRa) * Math.PI / 180; de = +v(cDec) * Math.PI / 180; pc = 1000 / plx; am = G + 5 * Math.log10(plx / 100); ci = .7 * br + .05; }   // Gaia: parallax in mas, G magnitude; B-V from BP-RP (approximate)
      else { ra = +v(cRa) * 15 * Math.PI / 180; de = +v(cDec) * Math.PI / 180; pc = +v(cDist); am = +v(cAbs); ci = v(cCi) === '' ? .65 : +v(cCi); nm = cName >= 0 ? v(cName) : ''; if (withGaia && +v(cMag) >= 4) { skipped++; continue; } }
      if (!(pc > 0 && pc < 100000) || !isFinite(am) || nm === 'Sol' || named.has(nm)) { skipped++; continue; }
      const ly = pc * 3.26156, e = [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)]; stars.push([M[0][0] * e[0] + M[0][1] * e[1] + M[0][2] * e[2], M[1][0] * e[0] + M[1][1] * e[1] + M[1][2] * e[2], M[2][0] * e[0] + M[2][1] * e[1] + M[2][2] * e[2]].map(c => c * ly).concat([am, ci])); } }
  const far = Math.max(8000, ...stars.map(s => Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])))), unit = Math.max(.25, Math.min(far, 60000) / 32000);   // finest unit that fits the farthest star (Gaia reaches tens of thousands of light-years)
  const keep = stars.filter(s => Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])) / unit <= 32767), buf = Buffer.alloc(8 + keep.length * 10); buf.write('SCT2', 0, 'ascii'); buf.writeFloatLE(unit, 4);
  keep.forEach((s, n) => { const o = 8 + n * 10; buf.writeInt16LE(Math.round(s[0] / unit), o); buf.writeInt16LE(Math.round(s[1] / unit), o + 2); buf.writeInt16LE(Math.round(s[2] / unit), o + 4); buf.writeInt16LE(Math.round(Math.max(-327, Math.min(327, s[3])) * 100), o + 6); buf.writeInt8(Math.round(Math.max(-2.5, Math.min(2.5, s[4])) * 50), o + 8); });
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, buf);
  console.log(`stars/catalogue.bin: ${keep.length} stars, ${(buf.length / 1e6).toFixed(2)} MB, ${unit} ly per unit (${skipped + stars.length - keep.length} skipped: no distance, too far, or already a collectable object)`);
  if (withGaia) console.log('Credit to add (stars/CREDITS.md and the Terms): "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC)."');
})().catch(e => { console.error(e.message); process.exit(1); });
