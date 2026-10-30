#!/usr/bin/env node
'use strict';
// Packs a real star catalogue into stars/catalogue.bin for the Observatory: every star with a measured distance, placed in galactic coordinates.
//   node tools/build-stars.js [catalogue.csv]
// Default input is the HYG database v4.1 (astronexus, CC BY-SA 4.0; Hipparcos, Yale Bright Star and Gliese catalogues), downloaded if no file is given.
// Any CSV with the HYG columns ra (hours), dec (deg), dist (parsecs), absmag and ci (B-V) works, so a Gaia extract converted to those columns drops in.
// Record (10 bytes, little-endian): int16 x, y, z in quarter light-years (x towards the Galactic Centre, y towards l = 90 deg, z towards the north
// galactic pole, the Sun at the origin), int16 absolute magnitude x 100, int8 colour index x 50, int8 spare.
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'stars', 'catalogue.bin'), URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const get = u => new Promise((res, rej) => https.get(u, r => { if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode)); const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b).toString('utf8'))); }).on('error', rej));
const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];   // J2000 equatorial -> galactic
(async () => {
  const csv = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await get(URL), lines = csv.split(/\r?\n/), head = lines[0].split(',').map(s => s.replace(/"/g, '')), col = n => head.indexOf(n);
  const cRa = col('ra'), cDec = col('dec'), cDist = col('dist'), cAbs = col('absmag'), cCi = col('ci'), cName = col('proper');
  global.window = {}; require(path.join(ROOT, 'skyobjects.js')); const named = new Set(); for (const L of Object.values(window.SKY.POOL)) for (const q of L) named.add(q.n);   // collectable objects are drawn by the game itself
  const buf = Buffer.alloc((lines.length) * 10); let n = 0, skipped = 0;
  for (let i = 1; i < lines.length; i++) { const f = lines[i].match(/("([^"]*)"|[^,]*)(,|$)/g); if (!f || f.length < head.length) continue; const v = k => f[k].replace(/,$/, '').replace(/"/g, '');
    const ra = +v(cRa) * 15 * Math.PI / 180, de = +v(cDec) * Math.PI / 180, pc = +v(cDist), am = +v(cAbs), ci = v(cCi) === '' ? .65 : +v(cCi), nm = cName >= 0 ? v(cName) : '';
    if (!(pc > 0 && pc < 100000) || !isFinite(am) || nm === 'Sol' || named.has(nm)) { skipped++; continue; }
    const ly = pc * 3.26156, e = [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)], g = M.map(r => (r[0] * e[0] + r[1] * e[1] + r[2] * e[2]) * ly * 4);
    if (g.some(c => Math.abs(c) > 32767)) { skipped++; continue; }
    const o = n * 10; buf.writeInt16LE(Math.round(g[0]), o); buf.writeInt16LE(Math.round(g[1]), o + 2); buf.writeInt16LE(Math.round(g[2]), o + 4); buf.writeInt16LE(Math.round(Math.max(-327, Math.min(327, am)) * 100), o + 6); buf.writeInt8(Math.round(Math.max(-2.5, Math.min(2.5, ci)) * 50), o + 8); n++; }
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, buf.subarray(0, n * 10));
  console.log(`stars/catalogue.bin: ${n} stars, ${(n * 10 / 1e6).toFixed(2)} MB (${skipped} skipped: no distance, beyond 8,000 ly, or already a collectable object)`);
})().catch(e => { console.error(e.message); process.exit(1); });
