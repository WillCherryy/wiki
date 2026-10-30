#!/usr/bin/env node
'use strict';
// Packs a real star catalogue into stars/catalogue.bin for the Observatory: every star with a measured distance, placed in galactic coordinates.
//   node tools/build-stars.js                      HYG only (downloaded)
//   node tools/build-stars.js gaia.csv             a Gaia DR3 export (columns ra, dec, parallax, phot_g_mean_mag, bp_rp) merged with HYG
//   node tools/build-stars.js hyg.csv gaia.csv     both from local files
// A Gaia Archive result can be given as CSV or as the VOTable it downloads (.vot or .vot.gz, TABLEDATA or BINARY2).
// HYG v4.1 (astronexus, CC BY-SA 4.0; Hipparcos, Yale and Gliese catalogues) supplies the brightest stars, which Gaia saturates on; with a Gaia file,
// HYG keeps only stars brighter than magnitude 4 and Gaia supplies everything fainter.
// File: 'SCT2', float32 light-years per unit, then 10-byte records (little-endian): int16 x, y, z (x towards the Galactic Centre, y towards
// l = 90 deg, z towards the north galactic pole, the Sun at the origin), int16 absolute magnitude x 100, int8 B-V colour x 50, int8 spare.
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'stars', 'catalogue.bin'), URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
// a VOTable (the Gaia Archive's download format) read into the same CSV text the rest of this script expects
function votToCsv(xml) {
  const fields = [...xml.matchAll(/<FIELD\b([^>]*)>/g)].map(m => ({ name: /name="([^"]+)"/.exec(m[1])[1], type: /datatype="([^"]+)"/.exec(m[1])[1], size: (/arraysize="([^"]+)"/.exec(m[1]) || [])[1] }));
  const head = fields.map(f => f.name).join(','), rows = [head];
  const td = /<TABLEDATA>([\s\S]*?)<\/TABLEDATA>/.exec(xml);
  if (td) { for (const tr of td[1].split(/<TR>/).slice(1)) rows.push([...tr.matchAll(/<TD>([^<]*)<\/TD>|<TD\/>/g)].map(m => m[1] || '').join(',')); return rows.join('\n'); }
  const b64 = /<STREAM[^>]*>([\s\S]*?)<\/STREAM>/.exec(xml); if (!b64) throw new Error('VOTable: no TABLEDATA or STREAM');
  const buf = Buffer.from(b64[1].replace(/\s+/g, ''), 'base64'), two = /<BINARY2>/.test(xml), nb = two ? Math.ceil(fields.length / 8) : 0, W = { double: 8, float: 4, long: 8, int: 4, short: 2, unsignedByte: 1, boolean: 1 };
  let o = 0; while (o < buf.length) { const nulls = buf.subarray(o, o + nb); o += nb; const vals = [];
    fields.forEach((f, k) => { if (f.size || !W[f.type]) throw new Error('VOTable: unsupported field ' + f.name); let v; switch (f.type) { case 'double': v = buf.readDoubleBE(o); break; case 'float': v = buf.readFloatBE(o); break; case 'long': v = Number(buf.readBigInt64BE(o)); break; case 'int': v = buf.readInt32BE(o); break; case 'short': v = buf.readInt16BE(o); break; default: v = buf[o]; }
      o += W[f.type]; const isNull = two && (nulls[k >> 3] >> (7 - (k & 7)) & 1); vals.push(isNull || Number.isNaN(v) ? '' : String(v)); });
    rows.push(vals.join(',')); }
  return rows.join('\n');
}
// star names: traditional name, else Bayer or Flamsteed with the constellation's genitive, else Gliese, HD or HIP number
const GREEK = { Alp: 'Alpha', Bet: 'Beta', Gam: 'Gamma', Del: 'Delta', Eps: 'Epsilon', Zet: 'Zeta', Eta: 'Eta', The: 'Theta', Iot: 'Iota', Kap: 'Kappa', Lam: 'Lambda', Mu: 'Mu', Nu: 'Nu', Xi: 'Xi', Omi: 'Omicron', Pi: 'Pi', Rho: 'Rho', Sig: 'Sigma', Tau: 'Tau', Ups: 'Upsilon', Phi: 'Phi', Chi: 'Chi', Psi: 'Psi', Ome: 'Omega' };
const GEN = { And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Boötis', Cae: 'Caeli', Cam: 'Camelopardalis', Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris', Cap: 'Capricorni', Car: 'Carinae', Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini', Col: 'Columbae', Com: 'Comae Berenices', CrA: 'Coronae Australis', CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis', Cyg: 'Cygni', Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani', For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis', Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis', LMi: 'Leonis Minoris', Lep: 'Leporis', Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii', Mon: 'Monocerotis', Mus: 'Muscae', Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis', Pav: 'Pavonis', Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris', Psc: 'Piscium', PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli', Sge: 'Sagittae', Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti', Ser: 'Serpentis', Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii', Tri: 'Trianguli', TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris', Vel: 'Velorum', Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae' };
function hygName(v, c) { const g = k => c[k] >= 0 ? v(c[k]) : ''; const pr = g('proper'); if (pr) return pr; const con = GEN[g('con')], by = g('bayer'), fl = g('flam');
  if (con && by) { const m = /^([A-Z][a-z]{1,2})(-?\d*)$/.exec(by); if (m && GREEK[m[1]]) return GREEK[m[1]] + (m[2] ? m[2].replace('-', '') : '') + ' ' + con; } if (con && fl) return fl + ' ' + con;
  const gl = g('gl'); if (gl) return gl.replace(/^Gl\s*/, 'Gliese ').replace(/^GJ\s*/, 'GJ '); const hd = g('hd'); if (hd) return 'HD ' + hd; const hip = g('hip'); if (hip) return 'HIP ' + hip; return ''; }
const readIn = f => { let b = fs.readFileSync(f); if (/\.gz$/.test(f)) b = require('zlib').gunzipSync(b); const t = b.toString('utf8'); return /^\s*<\?xml|<VOTABLE/.test(t.slice(0, 500)) ? votToCsv(t) : t; };
const get = u => new Promise((res, rej) => https.get(u, r => { if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode)); const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b).toString('utf8'))); }).on('error', rej));
const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];   // J2000 equatorial -> galactic
(async () => {
  const args = process.argv.slice(2), files = []; for (const a of args) files.push(readIn(a)); if (!files.some(t => /(^|,)"?dist"?(,|$)/m.test(t.slice(0, 2000)))) files.unshift(await get(URL));
  const isG = t => /parallax/.test(t.slice(0, 2000)), withGaia = files.some(isG); files.sort((a, b) => isG(a) - isG(b));   // HYG first: its names are matched onto the Gaia stars
  global.window = {}; require(path.join(ROOT, 'skyobjects.js')); const named = new Set(); for (const L of Object.values(window.SKY.POOL)) for (const q of L) named.add(q.n);   // collectable objects are drawn by the game itself
  const NEARP = Object.values(window.SKY.NEAR).filter(q => q[3]).map(q => [(q[0] + q[1] / 60) * 15, q[2], q[3]]), isGame = (raD, deD, ly) => NEARP.some(([r, d, dl]) => Math.abs(d - deD) < .06 && Math.abs((r - raD + 540) % 360 - 180) * Math.cos(deD * Math.PI / 180) < .06 && Math.abs(dl - ly) < .25 * dl);   // the same star as a collectable, whatever its catalogue calls it
  const stars = [], hygPos = new Map(); let skipped = 0; const cellK = (ra, de) => Math.floor(de * 20) * 100000 + Math.floor(ra * 20);   // 3-arcminute cells, for matching Gaia stars to HYG names
  for (const csv of files) { const lines = csv.split(/\r?\n/), head = lines[0].split(',').map(s => s.replace(/"/g, '').trim()), col = n => head.indexOf(n), gaia = col('parallax') >= 0;
    const cc = Object.fromEntries(['proper', 'con', 'bayer', 'flam', 'gl', 'hd', 'hip'].map(k => [k, col(k)])), cRa = col('ra'), cDec = col('dec'), cDist = col('dist'), cAbs = col('absmag'), cCi = col('ci'), cName = col('proper'), cMag = col('mag'), cPlx = col('parallax'), cG = col('phot_g_mean_mag'), cBR = col('bp_rp');
    for (let i = 1; i < lines.length; i++) { if (!lines[i]) continue; const f = lines[i].match(/("([^"]*)"|[^,]*)(,|$)/g); if (!f || f.length < head.length) continue; const v = k => f[k].replace(/,$/, '').replace(/"/g, '');
      let ra, de, pc, am, ci, nm = '', label = '';
      if (gaia) { const plx = +v(cPlx), G = +v(cG), br = v(cBR) === '' ? .82 : +v(cBR); if (!(plx > 0) || !isFinite(G) || G < 4) { skipped++; continue; } ra = +v(cRa) * Math.PI / 180; de = +v(cDec) * Math.PI / 180; pc = 1000 / plx; am = G + 5 * Math.log10(plx / 100); ci = .7 * br + .05;
        const rd = +v(cRa), dd = +v(cDec); for (let a = -1; a <= 1 && !label; a++) for (let bq = -1; bq <= 1 && !label; bq++) for (const h of hygPos.get(cellK(rd + bq / 20, dd + a / 20)) || []) { const dra = (h[0] - rd) * Math.cos(dd * Math.PI / 180) * 3600, dde = (h[1] - dd) * 3600; if (dra * dra + dde * dde < 64 && Math.abs(h[2] - G) < 1.6) { label = h[3]; break; } } }   // the same star in HYG: within 8 arcseconds and 1.6 magnitudes   // Gaia: parallax in mas, G magnitude; B-V from BP-RP (approximate)
      else { ra = +v(cRa) * 15 * Math.PI / 180; de = +v(cDec) * Math.PI / 180; pc = +v(cDist); am = +v(cAbs); ci = v(cCi) === '' ? .65 : +v(cCi); nm = cName >= 0 ? v(cName) : ''; label = hygName(v, cc); if (withGaia && label && +v(cMag) >= 3.5) { const rd = +v(cRa) * 15, dd = +v(cDec), k = cellK(rd, dd); (hygPos.get(k) || hygPos.set(k, []).get(k)).push([rd, dd, +v(cMag), label]); } if (withGaia && +v(cMag) >= 4) { skipped++; continue; } }
      if (!(pc > 0 && pc < 100000) || !isFinite(am) || nm === 'Sol' || named.has(nm) || isGame(ra * 180 / Math.PI, de * 180 / Math.PI, pc * 3.26156)) { skipped++; continue; }
      const ly = pc * 3.26156, e = [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)]; stars.push([M[0][0] * e[0] + M[0][1] * e[1] + M[0][2] * e[2], M[1][0] * e[0] + M[1][1] * e[1] + M[1][2] * e[2], M[2][0] * e[0] + M[2][1] * e[1] + M[2][2] * e[2]].map(c => c * ly).concat([am, ci, label])); } }
  let far = 8000; for (const s of stars) far = Math.max(far, Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])); const unit = Math.max(.25, Math.min(far, 60000) / 32000);   // finest unit that fits the farthest star (Gaia reaches tens of thousands of light-years)
  const keep = stars.filter(s => Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])) / unit <= 32767), buf = Buffer.alloc(8 + keep.length * 10); buf.write('SCT2', 0, 'ascii'); buf.writeFloatLE(unit, 4);
  keep.forEach((s, n) => { const o = 8 + n * 10; buf.writeInt16LE(Math.round(s[0] / unit), o); buf.writeInt16LE(Math.round(s[1] / unit), o + 2); buf.writeInt16LE(Math.round(s[2] / unit), o + 4); buf.writeInt16LE(Math.round(Math.max(-327, Math.min(327, s[3])) * 100), o + 6); buf.writeInt8(Math.round(Math.max(-2.5, Math.min(2.5, s[4])) * 50), o + 8); });
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, buf);
  const names = []; keep.forEach((s, n) => { if (s[5]) names.push(n + '\t' + s[5]); }); fs.writeFileSync(path.join(path.dirname(OUT), 'names.txt'), names.join('\n'));   // record number -> name, for tap-to-identify
  console.log(`stars/names.txt: ${names.length} named stars`);
  console.log(`stars/catalogue.bin: ${keep.length} stars, ${(buf.length / 1e6).toFixed(2)} MB, ${unit} ly per unit (${skipped + stars.length - keep.length} skipped: no distance, too far, or already a collectable object)`);
  if (withGaia) console.log('Credit to add (stars/CREDITS.md and the Terms): "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC)."');
})().catch(e => { console.error(e.message); process.exit(1); });
