#!/usr/bin/env node
'use strict';
// Builds stars/points.json for Scorcher Sky: catalogued objects that are not ordinary stars, each at its published position and distance, with the method.
//   node tools/build-points.js
// Sources (all public; credits in stars/CREDITS.md):
//   galaxies within ~11 Mpc   Updated Nearby Galaxy Catalog (Karachentsev, Makarov & Kaisina 2013, AJ 145, 101), via NASA HEASARC (table neargalcat)
//   farther galaxies          IRAS PSCz redshift survey (Saunders et al. 2000, MNRAS 317, 55), via HEASARC (iraspscz); distance from the redshift
//   pulsars                   ATNF Pulsar Catalogue (Manchester et al. 2005, AJ 129, 1993), web query; distances by parallax, association or the YMW16 electron-density model
//   O stars                   Galactic O-Star Catalog (Maíz Apellániz et al. 2004, ApJS 151, 103), via HEASARC (ostars)
//   Wolf–Rayet stars          VIIth Catalogue of Galactic Wolf–Rayet Stars (van der Hucht 2001, New Astron. Rev. 45, 135), via HEASARC (wrcat)
//   ultracool dwarfs          UltracoolSheet v2.0 (Best et al. 2025, doi:10.5281/zenodo.15802304, CC BY 4.0)
// Objects already drawn by the map (its featured objects) are left out, matched by position.
const fs = require('fs'), path = require('path'), { tap } = require('./votable.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'stars', 'points.json'), HEASARC = 'https://heasarc.gsfc.nasa.gov/xamin/vo/tap';
const UCS = 'https://zenodo.org/api/records/15802304/files/UltracoolSheet%20-%20Main.csv/content';
const ATNF = 'https://www.atnf.csiro.au/research/pulsar/psrcat/proc_form.php?version=2.9.0&JName=JName&RaJ=RaJ&DecJ=DecJ&P0=P0&Dist=Dist&Dist_DM=Dist_DM&PX=PX&Dist_A=Dist_A&Type=Type&startUserDefined=true&c1_val=&c2_val=&c3_val=&c4_val=&sort_attr=jname&sort_order=asc&condition=&pulsar_names=&ephemeris=short&coords_unit=raj%2Fdecj&radius=&coords_1=&coords_2=&style=Short+csv+without+errors&no_value=*&fsize=3&x_axis=&x_scale=linear&y_axis=&y_scale=linear&state=query&table_bottom.x=40&table_bottom.y=0';
const LYPC = 3.26156, H0 = 67.66, C = 299792.458;
const fetchText = async (u, ok = () => true) => { for (let t = 0; ; t++) { try { const r = await fetch(u, { headers: { 'user-agent': 'ScorcherSky/1.0 (https://playscorcher.com/sky)' } }); const x = await r.text(); if (r.ok && ok(x)) return x; if (t >= 4) throw new Error(u.slice(0, 60) + ' HTTP ' + r.status); } catch (e) { if (t >= 4) throw e; } await new Promise(f => setTimeout(f, 3000 * (t + 1))); } };   // some hosts drop connections now and then
// galaxy names written the usual way: NGC0253 -> NGC 253, IC3104 -> IC 3104, ESO006-001 -> ESO 006-001, CIRCINUS -> Circinus; PSCz's short forms
// E (ESO), M (MCG), MK (Markarian) written out, and a bare IRAS designation given its prefix. Messier numbers added for the famous nearby ones.
const MESSIER = { 'NGC 221': 32, 'NGC 205': 110, 'NGC 3031': 81, 'NGC 3034': 82, 'NGC 5236': 83, 'NGC 4736': 94, 'NGC 4826': 64, 'NGC 5457': 101, 'NGC 5194': 51, 'NGC 4258': 106, 'NGC 5055': 63 };
function galName(n0) { let n = String(n0).trim();
  n = n.replace(/^MESSIER0*(\d+)$/, 'Messier $1').replace(/^MCG\s*([+-])/, 'MCG $1').replace(/^(NGC|IC|UGCA|UGC|PGC|DDO|KKH|KKR|KKS|KK)\s*0*(\d)/, '$1 $2').replace(/^ESO\s*(\d)/, 'ESO $1').replace(/^E (\d+)-\s*(\d+\w*)$/, 'ESO $1-$2').replace(/^MK (\d+)/, 'Mrk $1').replace(/^M\s*([+-]\d\d)-\s*(\d+)-\s*(\d+)/, 'MCG $1-$2-$3').replace(/^CGCG\s*(\d+)-\s*(\d+)/, 'CGCG $1-$2').replace(/^(\d{4,5}[+-]\d{4})$/, 'IRAS $1');
  if (/^[A-Z][A-Z ]{3,}$/.test(n) && !/^(NGC|UGC|ESO|IC|DDO|PGC|KK|LV|HIPASS)/.test(n)) n = n.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());   // CIRCINUS -> Circinus
  return MESSIER[n] ? `Messier ${MESSIER[n]} (${n})` : n; }
const r4 = v => Math.round(v * 1e4) / 1e4, sig = (v, n = 4) => +Number(v).toPrecision(n);
const hms = s => { const p = String(s).split(':').map(Number); return (p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600) * 15; }, dms = s => { const t = String(s).trim(), sg = t[0] === '-' ? -1 : 1, p = t.replace(/^[+-]/, '').split(':').map(Number); return sg * (p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600); };
function csvRows(text) { const out = []; let row = [], f = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; } else f += c; } if (f || row.length) { row.push(f); out.push(row); } return out; }
// comoving distance for a redshift (flat Lambda-CDM, Planck 2018), in Mly: the same relation the map uses
const comoving = z => { const Om = .3111, OL = 1 - Om, E = x => Math.sqrt(Om * Math.pow(1 + x, 3) + OL), n = 200; let s = 0; for (let i = 0; i < n; i++) { const a = z * i / n, b = z * (i + 1) / n; s += (1 / E(a) + 1 / E(b)) / 2 * (b - a); } return C / H0 * LYPC * s; };

(async () => {
  global.window = {}; require(path.join(ROOT, 'skyobjects.js')); const SKY = window.SKY;   // the featured objects, to leave out
  const featured = [], featuredG = []; for (const [n, q] of Object.entries(SKY.NEAR)) if (q[3]) featured.push([(q[0] + q[1] / 60) * 15, q[2], n, q[3]]); for (const [n, q] of Object.entries(SKY.GALD)) featuredG.push([(q[0] + q[1] / 60) * 15, q[2], n]);
  for (const L of SKY.LOCAL) featuredG.push([(L.ra[0] + L.ra[1] / 60) * 15, L.ra[2], L.n]);    // featured objects only: a nebula or cluster (a landmark) does not stand in for the stars inside it
  const near = (ra, de, arcmin, list = featured, ly = 0) => list.find(([r, d, , dl]) => (!ly || !dl || Math.abs(dl - ly) < .3 * dl) && Math.abs(d - de) * 60 < arcmin && Math.abs(((r - ra + 540) % 360) - 180) * Math.cos(de * Math.PI / 180) * 60 < arcmin);
  const rows = [], skipped = {}, skip = (k, why) => { skipped[k + ': ' + why] = (skipped[k + ': ' + why] || 0) + 1; };
  const add = (set, name, ra, de, ly, x = {}) => { if (!(ly > 0) || !isFinite(ra) || !isFinite(de)) return skip(set, 'no distance or position'); const jn = s => ((/J\d{4}[+-]\d{2,4}[A-Za-z]*/.exec(String(s).replace(/−/g, '-')) || [])[0] || ''), fj = set === 'pulsar' && jn(name) ? featured.find(q => jn(q[2]) && jn(name).startsWith(jn(q[2])) && /^[A-Z]?$/.test(jn(name).slice(jn(q[2]).length))) : null;   /* a component (A, B) belongs to its featured system; cluster members (a, b…) do not */ if (fj) return skip(set, 'featured already (' + fj[2] + ')');   // pulsars by their J name when the featured one has one
    const f = set === 'pulsar' ? near(ra, de, 1, featured.filter(q => !jn(q[2])), ly) : set.startsWith('gal') ? near(ra, de, 6, featuredG) : near(ra, de, { pulsar: .2, ucd: 2 }[set] || 1, featured, ly); /* galaxies against the featured galaxies; stars against the featured stars: within 0.2′ for pulsars (precise, and packed in clusters), 2′ for fast-moving dwarfs, and 30% in distance */ if (f) return skip(set, 'featured already (' + f[2] + ')'); rows.push({ s: set, n: name, ra: r4(ra), de: r4(de), d: sig(ly), ...x }); };

  console.log('nearby galaxies (UNGC)…'); { const t = await tap(HEASARC, 'SELECT name, ra, dec, distance, distance_method, morph_type, linear_diameter, log_ks_luminosity, axial_ratio FROM neargalcat'); const k = n => t.fields.indexOf(n);
    for (const r of t.rows) { const nm = r[k('name')]; if (/^Milky Way$/i.test(nm)) continue; add('galaxy', galName(nm), r[k('ra')], r[k('dec')], r[k('distance')] * 1e6 * LYPC, { m: r[k('distance_method')] || 'h', t: r[k('morph_type')], dk: r[k('linear_diameter')], lk: r[k('log_ks_luminosity')], q: r[k('axial_ratio')], src: 'ungc' }); } }
  const haveG = rows.filter(r => r.s === 'galaxy').map(r => [r.ra, r.de]);
  console.log('PSCz galaxies…'); { const t = await tap(HEASARC, "SELECT name, alt_name, ra, dec, radial_velocity FROM iraspscz WHERE radial_velocity > 1000 AND optical_class_code LIKE 'g%' AND optical_class_code <> 'g?'"); const k = n => t.fields.indexOf(n);
    for (const r of t.rows) { const ra = r[k('ra')], de = r[k('dec')], v = r[k('radial_velocity')]; if (haveG.some(([a, d]) => Math.abs(d - de) < .02 && Math.abs(((a - ra + 540) % 360) - 180) * Math.cos(de * Math.PI / 180) < .02)) { skip('galaxy-z', 'in UNGC already'); continue; }
      const z = v / C; add('galaxy-z', galName(r[k('alt_name')] || r[k('name')]), ra, de, comoving(z) * 1e6, { v, src: 'pscz' }); } }   // distance from the redshift; below ~1,000 km/s a galaxy's own motion swamps the expansion, so those are left to the nearby-galaxy catalogue
  console.log('pulsars (ATNF)…'); { const html = await fetchText(ATNF, x => /<pre>/.test(x)), pre = /<pre>([\s\S]*?)<\/pre>/.exec(html), ver = (/Version: ([\d.]+)/.exec(html) || [])[1];
    for (const l of pre[1].replace(/&[a-z]+;/g, ' ').split('\n')) { const c = l.split(';'); if (c.length < 10 || !/^\d+$/.test(c[0].trim())) continue; const [, nm, raj, decj, p0, dist, ddm, px, da, type] = c.map(x => x.trim()); const D = +dist; if (!(D > 0)) { skip('pulsar', 'no distance'); continue; }
      const how = px !== '*' && +px > 0 && Math.abs(1 / +px - D) / D < .05 ? 'px' : da !== '*' ? 'assoc' : ddm !== '*' && Math.abs(+ddm - D) / D < .01 ? 'dm' : 'other';   // which distance the catalogue adopted
      add('pulsar', 'PSR ' + nm, hms(raj), dms(decj), D * 1000 * LYPC, { p: p0 === '*' ? null : +p0, m: how, ty: type === '*' ? '' : type.replace(/\[[^\]]*\]/g, '') }); }
    console.log('  ATNF catalogue version', ver || '?'); }
  console.log('O stars (GOSC)…'); { const t = await tap(HEASARC, 'SELECT name, alt_name, ra, dec, distance, spect_type, vmag FROM ostars'); const k = n => t.fields.indexOf(n);
    for (const r of t.rows) { const D = r[k('distance')]; if (!(D > 0)) { skip('ostar', 'no distance'); continue; } add('ostar', r[k('name')], r[k('ra')], r[k('dec')], D * 1000 * LYPC, { sp: (r[k('spect_type')] || '').replace(/\.\s/g, ' ').replace(/\s+/g, ' ').trim(), V: r[k('vmag')] || null }); } }
  console.log('Wolf–Rayet stars…'); { const t = await tap(HEASARC, 'SELECT name, alt_name_1, ra, dec, distance, spect_type FROM wrcat'); const k = n => t.fields.indexOf(n);
    for (const r of t.rows) { const D = r[k('distance')]; if (!(D > 0)) { skip('wr', 'no distance'); continue; } add('wr', r[k('name')], r[k('ra')], r[k('dec')], D * 1000 * LYPC, { sp: r[k('spect_type')] || '', alt: r[k('alt_name_1')] || '' }); } }
  console.log('ultracool dwarfs (UltracoolSheet)…'); { const T = csvRows(await fetchText(UCS)), h = T[0], k = n => h.indexOf(n);
    for (const r of T.slice(1)) { if (r.length < h.length / 2) continue; const D = +r[k('dist_formula')], e = +r[k('disterr_formula')], has = c => r[k(c)] && !/^(null|nan)$/i.test(r[k(c)]), num = +r[k('sptnum_formula')], sp = (num >= 20 ? (has('spt_ir') ? r[k('spt_ir')] : has('spt_opt') ? r[k('spt_opt')] : '') : (has('spt_opt') ? r[k('spt_opt')] : has('spt_ir') ? r[k('spt_ir')] : '')).replace(/:\s*/, ' ');   // optical types for M and L dwarfs, infrared for T and Y, as is usual
      if (!(D > 0)) { skip('ucd', 'no distance'); continue; } if (!/^[MLTY]/.test(sp)) { skip('ucd', 'no spectral type'); continue; }
      add('ucd', r[k('name')], +r[k('ra_j2000_formula')], +r[k('dec_j2000_formula')], D * LYPC, { sp, ed: e > 0 ? sig(e / D, 2) : null, m: (r[k('dist_formula_source')] || '').toLowerCase().includes('plx') ? 'px' : 'phot' }); } }
  const sets = {
    galaxy: { title: 'Nearby galaxy', cite: 'Karachentsev, Makarov & Kaisina 2013 (Updated Nearby Galaxy Catalog), AJ 145, 101' },
    'galaxy-z': { title: 'Galaxy', cite: 'Saunders et al. 2000 (IRAS PSCz redshift survey), MNRAS 317, 55' },
    pulsar: { title: 'Pulsar', cite: 'ATNF Pulsar Catalogue (Manchester et al. 2005), AJ 129, 1993; distances as adopted there (Yao, Manchester & Wang 2017 model for dispersion measures)' },
    ostar: { title: 'O-type star', cite: 'Galactic O-Star Catalog (Maíz Apellániz et al. 2004), ApJS 151, 103' },
    wr: { title: 'Wolf–Rayet star', cite: 'VIIth Catalogue of Galactic Wolf–Rayet Stars (van der Hucht 2001), New Astron. Rev. 45, 135' },
    ucd: { title: 'Ultracool dwarf', cite: 'UltracoolSheet v2.0 (Best et al. 2025), doi:10.5281/zenodo.15802304, CC BY 4.0' } };
  const out = { v: 1, built: new Date().toISOString().slice(0, 10), sets, rows };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const per = {}; rows.forEach(r => per[r.s] = (per[r.s] || 0) + 1);
  console.log(`stars/points.json: ${rows.length} objects, ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`, per); console.log('left out:', skipped);
})().catch(e => { console.error(e.message); process.exit(1); });
