/* Scorcher Sky: the whole universe, nothing to unlock, for students and researchers.
   The same renderer (skyobjects.js), map engine and viewers (universe.js) and size comparison (observatory.js) as Your Sky in the game,
   so anything changed there changes here, and the other way round. This file is only the scientific interface around them:
   every value carries a tag saying where it comes from (published, derived, modelled or illustrative). */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg) { let t = $('#sxToast'); if (!t) { t = document.createElement('div'); t.id = 'sxToast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400); }

// every named object, as if all were collected (the game's Your Sky shows only what a player has earned)
const ALL = (() => { const out = []; SKY.OBJ.forEach((o, i) => SKY.POOL[o.id].forEach(q => out.push({ ...q, id: o.id, idx: i, count: 1 }))); return out.sort((x, y) => y.m - x.m || y.idx - x.idx || x.n.localeCompare(y.n)); })();
function skyList() { return ALL; }   // observatory.js's size comparison reads the object list through this name

/* ------------------------------------------------------------------ units, coordinates and formatting */
const LY_PC = 3.26156, AU_KM = 1.495978707e8, RE_KM = 6371, RSUN_KM = 695700;
const EQ2GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];   // J2000 equatorial to galactic (the same matrix tools/build-stars.js uses)
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const nf = (v, d = 0) => v.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const sig = v => v >= 100 ? nf(Math.round(v)) : v >= 10 ? nf(v, 1) : v >= 1 ? nf(v, 2) : v >= .01 ? nf(v, 3) : v.toPrecision(2);
const minus = s => String(s).replace(/^-/, '−');
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const s3 = v => { if (!isFinite(v) || v === 0) return String(v); const e = Math.floor(Math.log10(Math.abs(v))); if (e >= 7 || e <= -4) { const m = v / Math.pow(10, e); return `${Number(m.toPrecision(3))} × 10${String(e).replace(/./g, c => SUP[c])}`; } return Number(v.toPrecision(3)).toLocaleString('en', { maximumFractionDigits: 6 }); };   // three significant figures, scientific notation when very large or small
const radText = R => R < .02 ? [s3(R * RSUN_KM) + ' km', s3(R * RSUN_KM / RE_KM) + ' R⊕'] : R > 2000 ? [s3(R * RSUN_KM / AU_KM) + ' AU', s3(R) + ' R☉'] : [s3(R) + ' R☉', s3(R * RSUN_KM) + ' km'];
const massSci = m => m < .1 ? s3(m * 1047.6) + ' Jupiter masses' : s3(m) + ' M☉';
const PREF = Object.assign({ detail: 'simple', unit: 'ly' }, (() => { try { return JSON.parse(localStorage.getItem('scorcher:skylab') || '{}'); } catch { return {}; } })());
const savePref = () => { try { localStorage.setItem('scorcher:skylab', JSON.stringify(PREF)); } catch {} };

const raOf = (h, m) => (h + m / 60) * 15;   // degrees
const fmtRA = deg => { const h = ((deg / 15) % 24 + 24) % 24, H = Math.floor(h), m = (h - H) * 60; return `${H}h ${m.toFixed(1).padStart(4, '0')}m`; };
const fmtDec = d => minus((d >= 0 ? '+' : '-') + Math.abs(d).toFixed(2)) + '°';
const sexDec = d => { const a = Math.abs(d), D = Math.floor(a), M = Math.round((a - D) * 60); return `${d < 0 ? '−' : '+'}${M === 60 ? D + 1 : D}° ${String(M === 60 ? 0 : M).padStart(2, '0')}′`; };
const unitVec = (ra, de) => [Math.cos(de * D2R) * Math.cos(ra * D2R), Math.cos(de * D2R) * Math.sin(ra * D2R), Math.sin(de * D2R)];
const toGal = (ra, de) => { const e = unitVec(ra, de), g = EQ2GAL.map(r => r[0] * e[0] + r[1] * e[1] + r[2] * e[2]); return [((Math.atan2(g[1], g[0]) * R2D) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, g[2]))) * R2D]; };
const fromGalXYZ = (x, y, z) => { const r = Math.hypot(x, y, z), g = [x / r, y / r, z / r], e = [0, 1, 2].map(j => EQ2GAL[0][j] * g[0] + EQ2GAL[1][j] * g[1] + EQ2GAL[2][j] * g[2]); return [((Math.atan2(e[1], e[0]) * R2D) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, e[2]))) * R2D]; };
const sep = (ra1, de1, ra2, de2) => { const a = unitVec(ra1, de1), b = unitVec(ra2, de2); return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * R2D; };
const lyText = ly => ly >= 1e9 ? sig(ly / 1e9) + ' billion ly' : ly >= 1e6 ? sig(ly / 1e6) + ' million ly' : ly >= 1e3 ? nf(Math.round(ly / (ly >= 1e4 ? 100 : 10)) * (ly >= 1e4 ? 100 : 10)) + ' ly' : sig(ly) + ' ly';
const pcText = ly => { const pc = ly / LY_PC; return pc >= 1e9 ? sig(pc / 1e9) + ' Gpc' : pc >= 1e6 ? sig(pc / 1e6) + ' Mpc' : pc >= 1e3 ? sig(pc / 1e3) + ' kpc' : sig(pc) + ' pc'; };
const dist = ly => PREF.unit === 'pc' ? [pcText(ly), lyText(ly)] : [lyText(ly), pcText(ly)];
const fmtLen = ly => { const km = ly * 9.4607e12; if (km < 1e6) return sig(km) + ' km'; if (km < .02 * AU_KM) return sig(km / RSUN_KM) + ' R☉'; if (ly < .3) return sig(km / AU_KM) + ' AU'; return PREF.unit === 'pc' ? pcText(ly) : ly < 1e3 ? sig(ly) + ' ly' : ly < 1e6 ? sig(ly / 1e3) + ' kly' : ly < 1e9 ? sig(ly / 1e6) + ' Mly' : sig(ly / 1e9) + ' Gly'; };
const period = d => d < 2 ? sig(d * 24) + ' hours' : d < 800 ? sig(d) + ' days' : sig(d / 365.25) + ' years';
const wiki = a => 'https://en.wikipedia.org/wiki/' + a, wikiQ = n => 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(n);
const simbadId = n => 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=' + encodeURIComponent(n.replace(/[’‘]/g, "'").replace(/−/g, '-'));
const simbadCone = (ra, de, arcmin) => `https://simbad.cds.unistra.fr/simbad/sim-coo?Coord=${ra.toFixed(4)}%20${de >= 0 ? '%2B' : ''}${de.toFixed(4)}&CooFrame=ICRS&Radius=${Math.max(1, Math.ceil(arcmin))}&Radius.unit=arcmin`;

/* ------------------------------------------------------------------ provenance: what kind of number is this? */
const TAG = {
  pub: ['Published', 'A value from the scientific literature or a survey catalogue, rounded for display.'],
  der: ['Derived', 'Calculated here from published values, by the method stated beside it.'],
  mod: ['Modelled', 'From a general relation for this type of object, not a measurement of this object.'],
  ill: ['Illustrative', 'A visual choice that makes the object visible or legible. Not data.']
};
const GLOSS = {
  ra: 'Right ascension: the sky\'s equivalent of longitude, measured eastward along the celestial equator in hours (24 h = 360°). J2000 means the coordinate grid of 1 January 2000.',
  dec: 'Declination: the sky\'s equivalent of latitude, from +90° at the north celestial pole to −90° at the south.',
  gal: 'Galactic coordinates: longitude l and latitude b measured from the Sun, with l = 0° towards the centre of the Milky Way and b = 0° along its disc.',
  dist: 'How far away it is. One light-year (ly) is the distance light travels in a year, about 9.46 trillion km; one parsec (pc) is 3.26 ly.',
  lt: 'For very distant objects the universe expanded while their light travelled. This is the light-travel distance: the time the light has been on its way, times the speed of light. The present-day (comoving) distance is larger.',
  rad: 'Radius in solar radii (R☉, 695,700 km) or Earth radii (R⊕, 6,371 km).',
  mass: 'Mass in solar masses (M☉, 1.989 × 10³⁰ kg), or Jupiter masses for brown dwarfs and planets.',
  temp: 'Effective temperature of the visible surface, in kelvin (K). 0 K is absolute zero; the Sun\'s surface is about 5,800 K.',
  lum: 'Power radiated, in units of the Sun\'s output (L☉, 3.83 × 10²⁶ W). Here from the Stefan–Boltzmann law, L = (R/R☉)² (T/T☉)⁴.',
  vlum: 'Brightness in visible light relative to the Sun, from the absolute magnitude. It leaves out ultraviolet and infrared, so it underestimates very hot and very cool stars.',
  absmag: 'Absolute magnitude: how bright the star would look from 10 parsecs. Lower is brighter; the Sun is +4.83.',
  eh: 'The event horizon of a non-spinning black hole (the Schwarzschild radius), 2GM/c², about 2.95 km for every solar mass.',
  ecl: 'Heliocentric ecliptic longitude: the planet\'s direction around the Sun, measured in the plane of Earth\'s orbit from the March equinox.',
  orbit: 'Semi-major axis: half the longest diameter of the orbit, its average distance from what it orbits. 1 AU is the Earth–Sun distance, 149.6 million km.',
  per: 'Orbital period: how long one orbit takes.',
  size: 'Approximate diameter of the visible cloud or cluster. Edges are diffuse, so published sizes vary.',
  place: 'How the map places this object. The direction from the Sun is always true; across intergalactic space the map compresses distance so galaxies fit on one screen.'
};

/* ------------------------------------------------------------------ the facts for any object, with their provenance */
const SGRA = { ra: raOf(17, 45.67), dec: -29.008, ly: 26670, src: 'GRAVITY Collaboration 2019 (8.18 kpc)' };
const KINDS = { moon: 'Our Moon', io: 'Volcanic moon', europa: 'Ice shell over a subsurface ocean', ganymede: 'Largest moon in the Solar System', callisto: 'Heavily cratered icy moon', snow: 'Icy moon', titan: 'Moon with a thick nitrogen atmosphere', iapetus: 'Two-toned icy moon', triton: 'Retrograde moon, probably a captured dwarf planet', earth: 'Rocky planet with liquid water', ocean: 'Possible ocean world', super: 'Super-Earth', desert: 'Hot rocky world', lava: 'Lava world', mercury: 'Airless rocky planet', rock: 'Rocky planet', venus: 'Rocky planet under thick clouds', ice: 'Icy world', mars: 'Cold desert planet', jupiter: 'Gas giant', saturn: 'Ringed gas giant', uranus: 'Ice giant', neptune: 'Ice giant', gas: 'Gas giant', hot: 'Hot Jupiter', hotblue: 'Hot Jupiter' };
const WIKI_SS = { Mercury: 'Mercury_(planet)', 'The Moon': 'Moon', Io: 'Io_(moon)', Europa: 'Europa_(moon)', Ganymede: 'Ganymede_(moon)', Callisto: 'Callisto_(moon)', Titan: 'Titan_(moon)', Triton: 'Triton_(moon)', Phobos: 'Phobos_(moon)', Deimos: 'Deimos_(moon)', Iapetus: 'Iapetus_(moon)', Miranda: 'Miranda_(moon)' };
const LAND_KIND = { emission: 'Emission nebula', planetary: 'Planetary nebula', open: 'Open star cluster', globular: 'Globular cluster', dark: 'Dark nebula', snr: 'Supernova remnant' };
const posRows = (ra, de, src, unc) => { const [l, b] = toGal(ra, de), u = unc ? ` ± ${unc}` : '';
  return [{ k: 'Right ascension (J2000)', v: fmtRA(ra) + u, s: PREF.detail === 'full' ? nf(ra, 3) + '°' : '', tag: unc ? 'der' : 'pub', src, g: 'ra' },
    { k: 'Declination (J2000)', v: fmtDec(de) + u, s: PREF.detail === 'full' ? sexDec(de) : '', tag: unc ? 'der' : 'pub', src, g: 'dec' },
    { k: 'Galactic l, b', v: `${nf(l, 2)}°, ${minus(nf(b, 2))}°`, tag: 'der', src: 'Converted from RA and Dec (IAU 1958 galactic frame, J2000)', g: 'gal', full: true }]; };
const distRow = (ly, src, lt) => { const [a, b] = dist(ly); return { k: 'Distance from the Sun', v: a, s: b + (lt ? ' · light-travel distance' : ''), tag: 'pub', src, g: lt ? 'lt' : 'dist' }; };
const LIT = 'Literature value, compiled from published sources and rounded; check the SIMBAD record for the primary reference';

function factsObj(q) {
  const o = SKY.OBJ[q.idx], near = SKY.NEAR[q.n], gd = SKY.GALD[q.n], sun = q.n === 'The Sun', rows = [];
  let pos = null; if (near && near[3]) pos = { ra: raOf(near[0], near[1]), dec: near[2], ly: near[3], src: LIT }; else if (gd) pos = { ra: raOf(gd[0], gd[1]), dec: gd[2], ly: gd[3] * 1e6, src: LIT, lt: gd[3] >= 1000 }; else if (q.n === 'Sagittarius A*') pos = SGRA;
  if (pos) rows.push(...posRows(pos.ra, pos.dec, pos.src), distRow(pos.ly, pos.src, pos.lt)); else if (sun) rows.push({ k: 'Distance from Earth', v: '1 AU', s: '149.6 million km · 8.3 light-minutes', tag: 'pub', src: 'IAU 2012 definition of the astronomical unit', g: 'orbit' });
  const R = SKY.physR(q), rr = radText(R);
  if (q.id === 'quasar') rows.push({ k: 'Event horizon radius', v: rr[0], s: rr[1], tag: 'der', src: 'Schwarzschild radius 2GM/c² from the published black-hole mass', g: 'eh' });
  else rows.push({ k: 'Radius', v: rr[0], s: rr[1], tag: SKY.hasRadius(q.n) ? 'pub' : 'mod', src: SKY.hasRadius(q.n) ? LIT : `No published radius held here: estimated from the mass with a typical ${o.name.toLowerCase()} mass–radius relation`, g: 'rad' });
  rows.push({ k: q.id === 'quasar' ? 'Black-hole mass' : 'Mass', v: massSci(q.m), s: q.m < .1 ? s3(q.m) + ' M☉' : '', tag: 'pub', src: LIT, g: 'mass' });
  if (q.t) rows.push({ k: 'Temperature', v: q.t, s: q.id === 'quasar' ? 'of the hot gas around the black hole' : '', tag: 'pub', src: LIT, g: 'temp' });
  if (!['quasar', 'neutron'].includes(q.id)) { const L = SKY.lumOf(q), ok = SKY.hasRadius(q.n) && /\d/.test(q.t || ''); rows.push({ k: 'Luminosity', v: s3(L) + ' L☉', tag: ok ? 'der' : 'mod', src: ok ? 'Stefan–Boltzmann law from the radius and temperature above' : 'From a modelled radius, so only indicative', g: 'lum', full: !ok }); }
  const pl = SKY.PLANETS[q.n] || []; if (pl.length) rows.push({ k: 'Known planets held here', v: String(pl.length), s: pl.map(p => p[0]).slice(0, 5).join(', ') + (pl.length > 5 ? '…' : ''), tag: 'pub', src: 'NASA Exoplanet Archive / literature, a selection' });
  const place = sun ? 'At the centre of its own system, 26,700 ly from the centre of the Milky Way.' : gd ? 'True direction from the Sun. Distances between galaxies are compressed so the universe fits on one map.' : pos && pos.ly > 1e5 ? 'Placed in its host galaxy, in its true direction. Distances between galaxies are compressed.' : 'At its true position in three dimensions around the Sun: direction and distance.';
  return { name: q.n, eyebrow: q.kind && q.kind.toLowerCase() !== o.name.toLowerCase() ? `${o.name} · ${q.kind}` : o.name, c: o.c, blurb: q.f, rows, place, pic: 'Illustrative rendering from its type, temperature and size', links: [['Wikipedia', wiki(q.a)], sun ? null : ['SIMBAD', simbadId(q.n)]].filter(Boolean), acts: ['go', 'look', 'cmp'] };
}
function factsPlanet(n, pi) {
  const ss = pi.host === 'The Sun' || ['Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].includes(pi.host), rows = [], lon = SKY.planetLon(n);
  rows.push({ k: 'Radius', v: pi.re < .1 ? nf(Math.round(pi.re * RE_KM)) + ' km' : sig(pi.re) + ' R⊕', s: pi.re < .1 ? sig(pi.re) + ' R⊕' : nf(Math.round(pi.re * RE_KM)) + ' km', tag: 'pub', src: ss ? 'NASA planetary fact sheets' : 'NASA Exoplanet Archive / literature', g: 'rad' });
  rows.push({ k: pi.moon ? 'Orbit radius' : 'Semi-major axis', v: pi.moon ? nf(pi.km) + ' km' : sig(pi.a) + ' AU', s: pi.moon ? '' : nf(Math.round(pi.a * AU_KM / 1e6)) + ' million km', tag: 'pub', src: ss ? 'NASA planetary fact sheets' : 'NASA Exoplanet Archive / literature', g: 'orbit' });
  rows.push({ k: 'Orbital period', v: period(pi.P), tag: 'pub', src: ss ? 'NASA planetary fact sheets' : 'NASA Exoplanet Archive / literature', g: 'per' });
  if (lon != null) { const deg = ((lon * R2D) % 360 + 360) % 360, moon = n === 'The Moon'; rows.push({ k: moon ? 'Mean longitude now' : 'Ecliptic longitude now', v: Math.round(deg) + '°', s: moon ? '± about 6° (mean motion only)' : '± about 1°', tag: 'der', src: moon ? 'The Moon\'s mean longitude; the real Moon can be up to about 6° ahead or behind' : 'J2000 mean orbital elements (Standish, JPL) and Kepler\'s equation, for the date shown at the bottom of the screen', g: 'ecl' }); }
  rows.push({ k: 'Surface', v: SKY.hasMap(n) ? 'Spacecraft imagery' : 'Illustrative', tag: SKY.hasMap(n) ? 'pub' : 'ill', src: SKY.hasMap(n) ? 'NASA and Solar System Scope maps (see Data & methods)' : 'No image of this surface exists; its look is chosen from its size and temperature' });
  return { name: n, eyebrow: `${pi.moon ? 'Moon of ' : 'Planet of '}${pi.host} · ${KINDS[pi.kind] || 'Planet'}`, c: '#bcd2ff', blurb: '', rows, place: ss ? 'In its real orbit, at its real place on the date shown. Orbits are drawn true to scale.' : 'Orbit drawn true to scale; its position along the orbit is not known here, so it starts at an arbitrary point.', links: [['Wikipedia', WIKI_SS[n] ? wiki(WIKI_SS[n]) : wikiQ(n)], ss ? null : ['SIMBAD', simbadId(n)]].filter(Boolean), acts: ['go', 'globe', 'cmp'], host: pi.host };
}
function factsLand(gb) {
  const n = gb.ghost || gb.n, rows = []; let eyebrow = 'Landmark', blurb = gb.note || '', place = 'True direction and distance from the Sun.';
  if (n === 'The Milky Way') return { name: 'The Milky Way', eyebrow: 'Our galaxy · barred spiral', c: '#cfc9e2', blurb: 'A barred spiral galaxy of a few hundred billion stars. The Sun lies in its disc, between two spiral arms.', rows: [{ k: 'Diameter of the stellar disc', v: '≈ 100,000 ly', s: 'the disc has no sharp edge; some studies find stars out to about twice this', tag: 'pub', src: 'Literature range' }, { k: 'Sun to centre', v: dist(SGRA.ly)[0], s: dist(SGRA.ly)[1], tag: 'pub', src: SGRA.src }, { k: 'Spiral arms, bar and disc on the map', v: 'Modelled', tag: 'mod', src: 'A painted model based on published maps of the arms and bar. We cannot photograph our own galaxy from outside.' }], place: 'You are inside it. Its overall shape is modelled; the stars near the Sun are real catalogue stars.', links: [['Wikipedia', wiki('Milky_Way')]], acts: ['go'] };
  const L = SKY.LANDS[n], LO = SKY.LOCAL.find(x => x.n === n), ST = SKY.STRUCT[n];
  if (L) { eyebrow = (LAND_KIND[L[5]] || 'Nebula') + ' · in the Milky Way'; blurb = L[6]; rows.push(...posRows(raOf(L[0], L[1]), L[2], LIT), distRow(L[3], LIT), { k: 'Diameter', v: '≈ ' + fmtLen(L[4] * 2), tag: 'pub', src: LIT, g: 'size' }); }
  else if (LO) { eyebrow = 'Galaxy · Local Group'; blurb = LO.note; rows.push(...posRows(raOf(LO.ra[0], LO.ra[1]), LO.ra[2], LIT), distRow(LO.ly, LIT), { k: 'Diameter', v: '≈ ' + fmtLen(LO.rly * 2), tag: 'pub', src: LIT, g: 'size' }); place = LO.ly >= 1e6 ? 'True direction from the Sun. Distances between galaxies are compressed.' : place; }
  else if (ST) { eyebrow = 'Structure of the Milky Way'; blurb = ST[3]; rows.push({ k: 'On the map', v: 'Modelled', tag: 'mod', src: 'Drawn from published maps of the Galaxy; no outside view exists' }); place = 'Part of the modelled shape of the Milky Way.'; }
  else if (gb.far) { eyebrow = 'Distant galaxy'; }
  return { name: n, eyebrow, c: '#cfc9e2', blurb, rows, place, pic: L || LO ? 'Illustrative rendering of a cloud, cluster or galaxy of this kind and size' : '', links: [['Wikipedia', wikiQ(n)], ST ? null : ['SIMBAD', simbadId(n)]].filter(Boolean), acts: ['go'] };
}
function factsStar(st) {
  const [ra, de] = fromGalXYZ(st.gx, st.gy, st.gz), d = Math.hypot(st.gx, st.gy, st.gz), unc = Math.atan2((st.unit || .85) * .87, Math.max(d, .1)) * R2D, uTxt = unc >= 1 ? nf(unc, 0) + '°' : unc >= 1 / 60 ? nf(unc * 60, 0) + '′' : nf(unc * 3600, 0) + '″';
  const bright = st.M - 5 + 5 * Math.log10(d / LY_PC) < 4, src = bright ? 'HYG database v4.1 (Hipparcos, Yale, Gliese)' : 'Gaia DR3 parallax (better than 10%)';
  const rows = [...posRows(ra, de, `Recovered from the packed catalogue, which stores positions to the nearest ${sig(st.unit || .85)} ly; for exact coordinates open the SIMBAD search`, uTxt),
    distRow(d, src),
    { k: 'Apparent magnitude', v: (st.M - 5 + 5 * Math.log10(d / LY_PC)).toFixed(1), tag: 'der', src: 'From the absolute magnitude and distance', g: 'absmag', full: true },
    { k: 'Absolute magnitude', v: minus(st.M.toFixed(1)), tag: 'pub', src: bright ? src : 'Gaia DR3 G magnitude and parallax', g: 'absmag' },
    { k: 'Temperature', v: '≈ ' + nf(st.T) + ' K', s: 'from its colour', tag: 'der', src: 'Ballesteros (2012) colour–temperature relation, from B−V (approximated from Gaia BP−RP)', g: 'temp' },
    { k: 'Visual luminosity', v: s3(st.L) + ' L☉', tag: 'der', src: 'From the absolute magnitude; no bolometric correction', g: 'vlum' },
    ...(st.R == null ? [] : [{ k: 'Radius (rough estimate)', v: '≈ ' + sig(st.R) + ' R☉', tag: 'der', src: 'From the visual luminosity and colour temperature by the Stefan–Boltzmann law. With no bolometric correction it underestimates very hot and very cool stars; the disc drawn when you approach uses this size', g: 'size' }]),
    { k: 'Spectral class (estimate)', v: st.kind, tag: 'der', src: 'Estimated from colour and absolute magnitude, not from a spectrum' }];
  return { name: st.name || 'A catalogue star', eyebrow: 'Catalogue star · real measurement', c: st.hex, blurb: st.name ? '' : 'One of the 756,000 stars in the catalogue behind this map, from the Gaia and Hipparcos missions. It has no common name.', rows, place: 'At its measured position in three dimensions. Fly to it to approach it; close in, it is drawn as a disc at its estimated size.', links: [['SIMBAD near here', simbadCone(ra, de, unc * 60 * 1.2)]], acts: ['go'], oi: st.src };
}
function facts(n) {
  const pi = SKY.planetInfo(n); if (pi) return factsPlanet(n, pi);
  const gb = map && map.lay.bodies[map.lay.idxOf[n]]; if (gb && gb.ghost) return factsLand(gb);
  const q = sfNamed(String(n).split('#')[0]); return q ? factsObj(q) : null;
}

/* ------------------------------------------------------------------ the page */
const RULER = { lo: -10, hi: 10, ticks: [['1 R☉', 7.36e-8], ['1 AU', 1.58e-5], ['1 ly', 1], ['1 kly', 1e3], ['1 Mly', 1e6], ['1 Gly', 1e9]] };
const rulerX = ly => (Math.log10(ly) - RULER.lo) / (RULER.hi - RULER.lo);
const SPEEDS = [['Pause', 0], ['Real time', 1], ['1 day/s', 86400], ['1 year/s', 3.156e7], ['1 Myr/s', 3.156e13]];
const ICON = { search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>', list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>', x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>', info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>' };
let map = null, sel = null, curFacts = null, tapStar = null;

const app = $('#sxApp');
app.innerHTML = `<div class="sx-map" id="sxMap"><canvas id="sxCv" aria-label="Map of the universe. Drag to move, scroll or pinch to zoom, tap an object to inspect it."></canvas></div>
<header class="sx-top">
  <a class="sx-brand" href="/sky" aria-label="Scorcher Sky home"><span class="w">Scorch<b>er</b></span><span class="s">Sky</span></a>
  <button class="sx-ib sx-browse-btn" id="sxBrowseBtn" aria-label="Browse objects">${ICON.list}</button>
  <label class="sx-search"><span>${ICON.search}</span><input id="sxQ" type="search" placeholder="Search a name or coordinates (e.g. 05h35m −05.4)" autocomplete="off" spellcheck="false" aria-label="Search by name or coordinates"><kbd>/</kbd></label>
  <nav class="sx-nav">
    <div class="sx-seg" role="group" aria-label="Level of detail"><button data-detail="simple">Essentials</button><button data-detail="full">Full data</button></div>
    <div class="sx-seg" role="group" aria-label="Distance unit"><button data-unit="ly">ly</button><button data-unit="pc">pc</button></div>
    <button class="sx-lnk" id="sxLabels" aria-pressed="true">Labels</button>
    <button class="sx-lnk" id="sxMethods">Data &amp; methods</button>
    <button class="sx-lnk" id="sxHelp">Help</button>
    <a class="sx-lnk sx-play" href="/">Play Scorcher</a>
  </nav>
</header>
<aside class="sx-browse" id="sxBrowse" aria-label="Browse objects">
  <div class="sx-tabs" role="tablist"><button data-b="obj" class="on">Objects</button><button data-b="pl">Planets</button><button data-b="land">Landmarks</button></div>
  <div class="sx-sort"><label>Sort <select id="sxSort"><option value="dist">Distance</option><option value="name">Name</option><option value="size">Size</option></select></label><button class="sx-ib sx-close-b" id="sxBrowseX" aria-label="Close">${ICON.x}</button></div>
  <div class="sx-list" id="sxList"></div>
  <div class="sx-bfoot"><div class="sx-seg" role="group" aria-label="Distance unit"><button data-unit="ly">ly</button><button data-unit="pc">pc</button></div><button class="sx-lnk" data-open="sxMethods">Data &amp; methods</button><button class="sx-lnk" data-open="sxHelp">Help</button><a class="sx-lnk" href="/">Play</a></div>
</aside>
<section class="sx-insp" id="sxInsp" aria-live="polite"></section>
<div class="sx-res" id="sxRes" hidden></div>
<footer class="sx-bot">
  <button class="sx-legend-btn" id="sxLegendBtn"><i class="t-pub"></i><i class="t-der"></i><i class="t-mod"></i><i class="t-ill"></i><span>How to read this map</span></button>
  <div class="sx-ruler"><button class="sx-ib" id="sxOut" aria-label="Zoom out">${ICON.minus}</button><div class="sx-line" id="sxLine" role="slider" aria-label="Scale: field of view" tabindex="0">${RULER.ticks.map(([l, v]) => `<i style="left:${rulerX(v) * 100}%"></i><u style="left:${rulerX(v) * 100}%">${l}</u>`).join('')}<b id="sxMark"></b></div><button class="sx-ib" id="sxIn" aria-label="Zoom in">${ICON.plus}</button><span class="sx-fov"><em>Field of view</em><b id="sxFov">—</b></span></div>
  <div class="sx-time"><div class="sx-seg" id="sxSpeed" role="group" aria-label="Time speed">${SPEEDS.map(([l], i) => `<button data-s="${i}" class="${i === 1 ? 'on' : ''}">${l}</button>`).join('')}</div><span class="sx-date" id="sxDate" title="The date the Solar System is drawn for. Planet motion is capped at about two days per second so orbits stay smooth; galaxies turn at the chosen rate.">—</span></div>
</footer>
<dialog class="sx-dlg" id="sxDlg"><button class="sx-ib sx-dlg-x" aria-label="Close" onclick="this.closest('dialog').close()">${ICON.x}</button><div id="sxDlgBody"></div></dialog>`;
const cv = $('#sxCv'), host = $('#sxMap');
let qual = 1; const dpr = Math.min(1.5, window.devicePixelRatio || 1), size = () => { cv.width = Math.round(host.clientWidth * dpr * qual); cv.height = Math.round(host.clientHeight * dpr * qual); }; size();
window.addEventListener('resize', size);

/* ---- inspector */
const tagHTML = (t, src) => `<span class="sx-tag t-${t}" tabindex="0" title="${esc(TAG[t][0] + ': ' + TAG[t][1] + (src ? '\nSource: ' + src : ''))}">${TAG[t][0]}</span>`;
function renderInsp() {
  const F = curFacts, box = $('#sxInsp'); if (!F) return welcome(); const full = PREF.detail === 'full', w = esc(F.name).split(' '), srcs = [], fn = src => src ? (srcs.indexOf(src) + 1 || srcs.push(src)) : 0;   // full data: each distinct source once, as a numbered note
  box.style.setProperty('--c', F.c || '#cfc9e2'); box.classList.add('has');
  box.innerHTML = `<div class="sx-grab" aria-hidden="true"></div><button class="sx-ib sx-insp-x" id="sxInspX" aria-label="Close">${ICON.x}</button>
    <div class="sx-eye">${esc(F.eyebrow)}</div><h1>${w.length > 1 ? w.slice(0, -1).join(' ') + ' <span>' + w[w.length - 1] + '</span>' : '<span>' + w[0] + '</span>'}</h1>
    ${F.blurb ? `<p class="sx-blurb">${esc(F.blurb)}</p>` : ''}
    <table class="sx-data"><tbody>${F.rows.filter(r => full || !r.full).map((r, i) => `<tr><th scope="row">${r.g ? `<button class="sx-k" data-g="${r.g}" data-i="${i}" aria-expanded="false">${esc(r.k)}</button>` : esc(r.k)}</th><td><b>${esc(r.v)}</b>${r.s ? `<small>${esc(r.s)}</small>` : ''}</td><td>${tagHTML(r.tag, r.src)}${full && r.src ? `<sup class="sx-fn">${fn(r.src)}</sup>` : ''}</td></tr>${r.g ? `<tr class="sx-def" data-d="${i}" hidden><td colspan="3">${esc(GLOSS[r.g])}</td></tr>` : ''}`).join('')}
      ${F.pic ? `<tr class="sx-pic"><th scope="row">Picture</th><td><small>${esc(F.pic)}</small></td><td>${tagHTML('ill', F.pic)}</td></tr>` : ''}</tbody></table>
    ${full && srcs.length ? `<ol class="sx-srcs" aria-label="Sources">${srcs.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <details class="sx-place"><summary>Where it is on the map</summary><p>${esc(F.place)}</p></details>
    <div class="sx-acts">${F.acts.includes('go') ? '<button class="p" data-a="go">Fly to</button>' : ''}${F.acts.includes('look') ? '<button data-a="look">Close-up</button>' : ''}${F.acts.includes('globe') ? '<button data-a="globe">Globe</button>' : ''}${F.acts.includes('cmp') ? '<button data-a="cmp">Compare sizes</button>' : ''}${F.host ? `<button data-a="host">${SKY.planetInfo(F.name).moon ? 'Its planet' : 'Its star'}</button>` : ''}<button data-a="copy">Copy data</button></div>
    <div class="sx-links">${F.links.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join('')}</div>`;
  $('#sxInspX').onclick = () => { curFacts = null; sel = null; SKY.mark(null); setHash(''); renderInsp(); };
  $$('.sx-k', box).forEach(b => b.onclick = () => { const d = $(`.sx-def[data-d="${b.dataset.i}"]`, box), on = d.hidden; d.hidden = !on; b.setAttribute('aria-expanded', on); });
  $$('.sx-acts button', box).forEach(b => b.onclick = () => act(b.dataset.a));
  $('.sx-grab', box).onclick = () => box.classList.toggle('open');
}
function act(a) {
  const F = curFacts; if (!F) return;
  if (a === 'go') map.pick(F.oi != null ? '★' + F.oi : F.name);
  else if (a === 'look') openInspect(F.name, () => {});
  else if (a === 'globe') openGlobe(F.name, () => {});
  else if (a === 'host') map.pick(F.host);
  else if (a === 'cmp') Observatory.compare(F.name, [F.name, 'The Sun', 'Earth'].filter((v, i, x) => x.indexOf(v) === i), 'all', ALL);
  else if (a === 'copy') { const link = location.origin + '/sky#o=' + encodeURIComponent(F.name), txt = [F.name + ' — ' + F.eyebrow, ...F.rows.map(r => `${r.k}: ${r.v}${r.s ? ' (' + r.s + ')' : ''} [${TAG[r.tag][0]}${r.src ? '; ' + r.src : ''}]`), '', `Scorcher Sky, ${link}, retrieved ${new Date().toISOString().slice(0, 10)}`].join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Data copied, with sources'), () => { prompt('Copy:', txt); }); }
}
function welcome() {
  const box = $('#sxInsp'); box.classList.remove('has'); box.style.setProperty('--c', '#ff9a6b');
  box.innerHTML = `<div class="sx-grab" aria-hidden="true"></div><div class="sx-eye">A scientific explorer</div><h1>The universe, <span>to scale</span></h1>
    <p class="sx-blurb">Real stars from the Gaia and Hipparcos missions, the planets on today's date, nearby galaxies and distant quasars, from the size of a neutron star to billions of light-years.</p>
    <ol class="sx-how"><li><span><b>Tap</b> any object or star to see what is known about it.</span></li><li><span><b>Scroll or pinch</b> to zoom through twenty powers of ten.</span></li><li><span><b>Search</b> a name or sky coordinates with <kbd>/</kbd>.</span></li></ol>
    <div class="sx-tagkey">${Object.entries(TAG).map(([k, [n, d]]) => `<div>${tagHTML(k)}<span>${esc(d)}</span></div>`).join('')}</div>
    <div class="sx-acts"><button class="p" data-a="tour-sun">Start at the Sun</button><button data-a="tour-mw">Our galaxy</button><button data-a="tour-far">The most distant</button></div>`;
  const go = { 'tour-sun': 'The Sun', 'tour-mw': 'Sagittarius A*', 'tour-far': 'ULAS J1342+0928' };
  $$('.sx-acts button', box).forEach(b => b.onclick = () => map.pick(go[b.dataset.a])); $('.sx-grab', box).onclick = () => box.classList.toggle('open');
}
function show(n) { sel = n; curFacts = facts(n); if (curFacts) setHash(n); renderInsp(); }
let lastStar = null;
function showStar(st) { sel = null; lastStar = st; curFacts = factsStar(st); setHash('★' + st.src); renderInsp(); }
const setHash = n => { try { history.replaceState(null, '', n ? '#o=' + encodeURIComponent(n) : location.pathname); } catch {} };

/* ---- the map itself */
map = window.__map = uniMap(cv, ALL, { intro: !/#o=/.test(location.hash), z: .4, noMini: true, catLabels: true, onQuality: v => { qual = v; size(); }, onPick: n => { closeBrowse(); if (n[0] === '★') { const oi = +n.slice(1), st = SKY.starInfo(oi); SKY.mark(oi); if (st) { showStar(st); setHash(n); } return; } SKY.mark(null); show(n); }, onEmpty: (x, y, k) => {
  const st = SKY.identify(x, y, 20 * k); if (!st) { SKY.mark(null); return; } const now = Date.now(), again = tapStar && tapStar.oi === st.src && now - tapStar.t < 400; tapStar = { oi: st.src, t: now };
  if (again) { map.pick('★' + st.src); return; }   // double-tap a star to approach it
  SKY.mark(st.src); showStar(st);
  if (st.name == null) { const t0 = Date.now(), iv = setInterval(() => { if (SKY.namesReady() || Date.now() - t0 > 6000) { clearInterval(iv); st.name = SKY.starName(st.src); if (curFacts && curFacts.c === st.hex) showStar(st); } }, 200); } } });

/* ---- browse */
const LANDN = () => map.lay.bodies.filter(b => b.ghost && (b.note || b.ghost === 'The Milky Way')).map(b => b.n);
const distOf = n => { const a = SKY.NEAR[n]; if (a) return a[3]; const g = SKY.GALD[n]; if (g) return g[3] * 1e6; if (n === 'Sagittarius A*') return SGRA.ly; const L = SKY.LANDS[n]; if (L) return L[3]; const LO = SKY.LOCAL.find(x => x.n === n); return LO ? LO.ly : Infinity; };
let btab = 'obj', openT = '';
function drawList(filter = '') {
  const box = $('#sxList'), sortBy = $('#sxSort').value, f = filter.toLowerCase(), by = (a, sz, dk = x => distOf(x.n)) => a.sort(sortBy === 'name' ? (x, y) => x.n.localeCompare(y.n) : sortBy === 'size' ? (x, y) => sz(y) - sz(x) : (x, y) => dk(x) - dk(y) || x.n.localeCompare(y.n));
  const row = (n, sub, c, right) => `<button class="sx-row ${n === sel ? 'cur' : ''}" data-n="${esc(n)}" style="--c:${c}"><i></i><span><b>${esc(n)}</b><small>${esc(sub)}</small></span><em>${esc(right)}</em></button>`;
  const dTxt = n => { const d = distOf(n); return n === 'The Sun' ? '—' : isFinite(d) ? fmtLen(d) : ''; };
  if (btab === 'obj') { const CG = SKY.catGroups();   // every star the map draws counts: the featured objects plus the catalogue stars of each type
    const onScreen = () => { const r = box.getBoundingClientRect(), st = getComputedStyle(box.closest('aside, section, div') || box); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && st.visibility !== 'hidden' && +st.opacity !== 0; };
    if (!CG && onScreen()) { SKY.catLoad(); clearTimeout(drawList.w); drawList.w = setTimeout(() => drawList($('#sxQ').value.trim()), 700); }
    box.innerHTML = SKY.OBJ.map((o, i) => { const items = by(ALL.filter(b => b.idx === i && (!f || b.n.toLowerCase().includes(f))), b => SKY.physR(b)), all = ALL.filter(b => b.idx === i).length, cn = CG && CG.n[o.id] || 0;
      const cat = CG && CG.named[o.id] ? CG.named[o.id].filter(x => !f || x.name.toLowerCase().includes(f)) : []; if (!items.length && !cat.length) return ''; const on = !!f || openT === o.id;
      const cs = on ? cat.slice().sort(sortBy === 'name' ? (x, y) => x.name.localeCompare(y.name) : sortBy === 'size' ? (x, y) => y.R - x.R : (x, y) => x.ly - y.ly) : [], SHOW = 40;
      const catRows = cs.slice(0, SHOW).map(x => row('★' + x.oi, 'Catalogue star', o.c, sortBy === 'size' ? '≈ ' + sig(x.R) + ' R☉' : fmtLen(x.ly)).replace(`<b>★${x.oi}</b>`, `<b>${esc(x.name)}</b>`)).join('');
      const head = cn ? `<div class="sx-sub">${nf(all)} featured, with full data</div>` : '', tail = cn && on ? `<div class="sx-sub">In the catalogue: ${nf(cn)} stars of this type<small>Classified from colour and brightness, not spectra. The catalogue holds stars brighter than magnitude 10.5, so luminous giants are over-represented and faint dwarfs rare. ${nf(CG.named[o.id].length)} have a proper name${cs.length > SHOW ? `; the ${SHOW} ${sortBy === 'name' ? 'first by name' : sortBy === 'size' ? 'largest' : 'nearest'} are listed, search for the rest` : ''}. Tap any other star on the map to identify it.</small></div>${catRows}` : '';
      return `<div class="sx-grp ${on ? 'on' : ''}"><button class="sx-gh" data-t="${o.id}" style="--c:${o.c}" aria-expanded="${on}"><i></i><span>${esc(o.name.replace(/y$/, 'ie') + 's')}</span><em>${nf(all + cn)}</em></button>${on ? head + items.map(b => row(b.n, b.kind, o.c, sortBy === 'size' ? radText(SKY.physR(b))[0] : dTxt(b.n))).join('') + tail : ''}</div>`; }).join('') || '<p class="sx-none">Nothing by that name.</p>'; }
  else if (btab === 'pl') { const groups = Object.entries(SKY.PLANETS).map(([h, L]) => [h, by(L.map(p => ({ n: p[0], p })).filter(x => !f || x.n.toLowerCase().includes(f) || h.toLowerCase().includes(f)), x => x.p[1], x => x.p[2])]).filter(g => g[1].length);
    box.innerHTML = groups.map(([h, L]) => `<div class="sx-grp on"><div class="sx-gh static"><span>${esc(h === 'The Sun' ? 'Solar System' : h)}</span><em>${L.length}</em></div>${L.map(x => row(x.n, h === 'The Sun' ? KINDS[x.p[4]] || 'Planet' : 'Planet of ' + h, '#bcd2ff', sortBy === 'size' ? sig(x.p[1]) + ' R⊕' : sig(x.p[2]) + ' AU')).join('')}${h === 'The Sun' ? Object.entries(SKY.MOONS).flatMap(([pl, M]) => M.filter(m => !f || m[0].toLowerCase().includes(f)).map(m => row(m[0], 'Moon of ' + pl, '#9fb2d8', nf(m[1]) + ' km'))).join('') : ''}</div>`).join('') || '<p class="sx-none">Nothing by that name.</p>'; }
  else { const L = by(LANDN().filter(n => !f || n.toLowerCase().includes(f)).map(n => ({ n })), x => { const a = SKY.LANDS[x.n]; return a ? a[4] : (SKY.LOCAL.find(y => y.n === x.n) || {}).rly || 0; });
    box.innerHTML = L.map(x => { const a = SKY.LANDS[x.n], LO = SKY.LOCAL.find(y => y.n === x.n); return row(x.n, a ? LAND_KIND[a[5]] || 'Nebula' : LO ? 'Galaxy' : SKY.STRUCT[x.n] ? 'Galactic structure' : x.n === 'The Milky Way' ? 'Our galaxy' : 'Landmark', '#cfc9e2', dTxt(x.n)); }).join('') || '<p class="sx-none">Nothing by that name.</p>'; }
  $$('.sx-gh[data-t]', box).forEach(b => b.onclick = () => { openT = openT === b.dataset.t ? '' : b.dataset.t; map.setFilter(openT ? new Set([openT]) : null); drawList($('#sxQ').value.trim()); });
  $$('.sx-row', box).forEach(b => b.onclick = () => map.pick(b.dataset.n));
}
$$('.sx-tabs button').forEach(b => b.onclick = () => { btab = b.dataset.b; $$('.sx-tabs button').forEach(x => x.classList.toggle('on', x === b)); openT = ''; map.setFilter(null); drawList($('#sxQ').value.trim()); });
$('#sxSort').onchange = () => drawList($('#sxQ').value.trim());
const openBrowse = () => document.body.classList.add('browse'), closeBrowse = () => document.body.classList.remove('browse');
$('#sxBrowseBtn').onclick = () => { document.body.classList.toggle('browse'); setTimeout(() => drawList($('#sxQ').value.trim()), 450); };   // after the panel has slid in, so its counts can load $('#sxBrowseX').onclick = closeBrowse;

/* ---- search: names, or a position on the sky */
const POSITIONED = () => { const out = []; ALL.forEach(b => { const a = SKY.NEAR[b.n], g = SKY.GALD[b.n]; if (a && a[3]) out.push([b.n, raOf(a[0], a[1]), a[2], SKY.OBJ[b.idx].name]); else if (g) out.push([b.n, raOf(g[0], g[1]), g[2], SKY.OBJ[b.idx].name]); });
  out.push(['Sagittarius A*', SGRA.ra, SGRA.dec, 'Black hole']); Object.entries(SKY.LANDS).forEach(([n, L]) => out.push([n, raOf(L[0], L[1]), L[2], LAND_KIND[L[5]] || 'Nebula'])); SKY.LOCAL.forEach(L => out.push([L.n, raOf(L.ra[0], L.ra[1]), L.ra[2], 'Galaxy'])); return out; };
function parseCoord(s) {   // "05h35m17s -05d23m", "5 35.3 -5.39", "05:35:17 -05:23:28", or decimal degrees "83.8 -5.39"
  const t = s.trim().replace(/[−–]/g, '-').replace(/[hdms°′″'":]/gi, ' ').replace(/\s+/g, ' ').trim(), p = t.split(' ');
  if (!/^[+-]?\d/.test(t) || p.some(x => !/^[+-]?\d+(\.\d+)?$/.test(x))) return null; const sIdx = p.findIndex((x, i) => i > 0 && /^[+-]/.test(x)), hms = /h/i.test(s) || /:/.test(s);
  let ra, de; if (p.length === 2 && !hms) { ra = +p[0]; de = +p[1]; } else { const k = sIdx > 0 ? sIdx : Math.ceil(p.length / 2), A = p.slice(0, k).map(Number), D = p.slice(k).map(Number), sg = /^-/.test(p[k] || '') ? -1 : 1; ra = (A[0] + (A[1] || 0) / 60 + (A[2] || 0) / 3600) * 15; de = sg * (Math.abs(D[0]) + (D[1] || 0) / 60 + (D[2] || 0) / 3600); }
  return ra >= 0 && ra < 360 && de >= -90 && de <= 90 ? [ra, de] : null; }
function search(v) {
  const res = $('#sxRes'), q = v.trim(); drawList(q); if (!q) { res.hidden = true; return; }
  const c = parseCoord(q); let html;
  if (c) { const near = POSITIONED().map(([n, ra, de, k]) => [n, sep(c[0], c[1], ra, de), k]).sort((a, b) => a[1] - b[1]).slice(0, 8);
    html = `<div class="sx-res-h">Nearest to RA ${fmtRA(c[0])}, Dec ${fmtDec(c[1])}</div>${near.map(([n, d, k]) => `<button data-n="${esc(n)}"><b>${esc(n)}</b><span>${esc(k)}</span><em>${d < 1 ? nf(d * 60, 1) + '′' : nf(d, 1) + '°'} away</em></button>`).join('')}<a class="sx-res-ext" href="${simbadCone(c[0], c[1], 10)}" target="_blank" rel="noopener">Search every catalogued object within 10′ on SIMBAD ↗</a>`; }
  else { const f = q.toLowerCase(), hits = [...ALL.map(b => [b.n, SKY.OBJ[b.idx].name]), ...Object.values(SKY.PLANETS).flat().map(p => [p[0], 'Planet']), ...Object.values(SKY.MOONS).flat().map(m => [m[0], 'Moon']), ...LANDN().map(n => [n, 'Landmark'])].filter(([n]) => n.toLowerCase().includes(f)).sort((a, b) => (a[0].toLowerCase().indexOf(f) - b[0].toLowerCase().indexOf(f)) || a[0].localeCompare(b[0])).slice(0, 10);
    const ready = SKY.namesReady(); if (!ready) { SKY.catLoad(); clearTimeout(search.w); search.w = setTimeout(() => { if ($('#sxQ').value.trim() === q) search(q); }, 400); }
    const stars = ready && q.length >= 2 ? SKY.starSearch(q, Math.max(3, 12 - hits.length)) : [], du = ly => PREF.unit === 'pc' ? nf(ly / 3.2616, ly < 32.6 ? 1 : 0) + ' pc' : nf(ly, ly < 100 ? 1 : 0) + ' ly';
    const rows = [...hits.map(([n, k]) => [n, n, k]), ...stars.map(s => ['★' + s.oi, s.name, 'Catalogue star · ' + du(s.ly)])];   // the 111,000 named stars of the catalogue, brightest first
    html = rows.length ? rows.map(([id, n, k]) => `<button data-n="${esc(id)}"><b>${esc(n)}</b><span>${esc(k)}</span></button>`).join('') + (ready ? '' : '<p class="sx-res-wait">Loading the names of catalogue stars…</p>') : ready ? `<p>Nothing by that name here, among the drawn objects or the 111,000 named stars of the catalogue.</p><a class="sx-res-ext" href="${simbadId(q)}" target="_blank" rel="noopener">Look up “${esc(q)}” on SIMBAD ↗</a>` : '<p class="sx-res-wait">Loading the names of catalogue stars…</p>'; }
  res.innerHTML = html; res.hidden = false; $$('button', res).forEach(b => b.onclick = () => { res.hidden = true; $('#sxQ').blur(); map.pick(b.dataset.n); });
}
$('#sxQ').oninput = e => search(e.target.value);
$('#sxQ').onkeydown = e => { if (e.key === 'Enter') { const b = $('#sxRes button'); if (b) b.click(); } else if (e.key === 'Escape') { e.target.value = ''; search(''); e.target.blur(); } };
document.addEventListener('pointerdown', e => { if (!e.target.closest('#sxRes, .sx-search')) $('#sxRes').hidden = true; });

/* ---- settings */
const syncSeg = () => { $$('[data-detail]').forEach(b => b.classList.toggle('on', b.dataset.detail === PREF.detail)); $$('[data-unit]').forEach(b => b.classList.toggle('on', b.dataset.unit === PREF.unit)); $('#sxLabels').setAttribute('aria-pressed', !!SKY.PREF.on); };
$$('[data-detail]').forEach(b => b.onclick = () => { PREF.detail = b.dataset.detail; savePref(); syncSeg(); renderInsp(); });
$$('[data-unit]').forEach(b => b.onclick = () => { PREF.unit = b.dataset.unit; savePref(); syncSeg(); if (curFacts) curFacts = sel ? facts(sel) : lastStar ? factsStar(lastStar) : curFacts; renderInsp(); drawList($('#sxQ').value.trim()); });
$('#sxLabels').onclick = () => { SKY.setPref({ on: !SKY.PREF.on }); syncSeg(); };
syncSeg();

/* ---- scale and time */
const line = $('#sxLine'); let rd = false;
const fromRuler = e => { const r = line.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); map.zoomTo(cv.width / (Math.pow(10, RULER.lo + x * (RULER.hi - RULER.lo)) / SKY.LYU)); };
line.onpointerdown = e => { rd = true; line.setPointerCapture(e.pointerId); fromRuler(e); }; line.onpointermove = e => { if (rd) fromRuler(e); }; line.onpointerup = () => { rd = false; };
line.onkeydown = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); map.zoom(1 / 2); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); map.zoom(2); } };
$('#sxIn').onclick = () => map.zoom(3); $('#sxOut').onclick = () => map.zoom(1 / 3);
$$('#sxSpeed button').forEach(b => b.onclick = () => { map.setSpeed(SPEEDS[+b.dataset.s][1]); $$('#sxSpeed button').forEach(x => x.classList.toggle('on', x === b)); });
const pad = v => String(v).padStart(2, '0');
setInterval(() => { const f = map.fov(), x = Math.max(0, Math.min(1, rulerX(f))); $('#sxMark').style.left = x * 100 + '%'; $('#sxFov').textContent = fmtLen(f); line.setAttribute('aria-valuetext', fmtLen(f));
  const d = new Date(SKY.epoch0 + map.clock().pt * 1000); $('#sxDate').textContent = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`; }, 150);

/* ---- dialogs */
const dlg = (html) => { $('#sxDlgBody').innerHTML = html; const d = $('#sxDlg'); if (!d.open) d.showModal(); };
$('#sxDlg').addEventListener('click', e => { if (e.target.id === 'sxDlg') e.target.close(); });
const legendHTML = () => `<h2>How to read this map</h2>
  <p>Every value in the inspector carries one of four labels, so you can see what is measured and what is a picture.</p>
  <div class="sx-tagkey">${Object.entries(TAG).map(([k, [n, d]]) => `<div>${tagHTML(k)}<span>${esc(d)}</span></div>`).join('')}</div>
  <h3>What is true on the map</h3><ul>
  <li><b>Directions</b> from the Sun are true for every star, nebula, galaxy and quasar.</li>
  <li><b>Distances</b> are true within the Milky Way and its satellite galaxies. Between galaxies, the map compresses distance so the universe fits on one screen; the inspector always gives the real distance.</li>
  <li><b>Sizes</b> are drawn at true scale relative to each other: a neutron star really is a dot beside a red supergiant.</li>
  <li><b>Planets of the Solar System</b> sit at their real places for the date shown at the bottom right. Exoplanet orbits are true in size, but where each planet is along its orbit is not known here.</li></ul>
  <h3>What is modelled or illustrative</h3><ul>
  <li>The <b>shape of the Milky Way</b> (arms, bar, dust) is a model based on published maps; nobody has seen it from outside.</li>
  <li><b>Other galaxies' shapes</b> follow their published type and orientation, painted, not photographed.</li>
  <li><b>Surfaces</b> of stars and exoplanets are illustrative. The Solar System's planets and the Moon use spacecraft maps.</li>
  <li>Glows, halos and the brightness of objects are tuned so things stay visible. They are not photometry.</li></ul>`;
const methodsHTML = () => `<h2>Data &amp; methods</h2>
  <h3>Sources</h3><ul class="sx-src-list">
  <li><b>Gaia DR3</b> (European Space Agency): stars brighter than G = 10.5 with parallaxes better than 10%. This work has made use of data from the ESA mission Gaia (<a href="https://www.cosmos.esa.int/gaia" target="_blank" rel="noopener">cosmos.esa.int/gaia</a>), processed by the Gaia Data Processing and Analysis Consortium (DPAC). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.</li>
  <li><b>HYG database v4.1</b> (David Nash; Hipparcos, Yale Bright Star and Gliese catalogues) for stars brighter than magnitude 4, which saturate Gaia. CC BY-SA 4.0.</li>
  <li><b>Named objects</b> (about 140 stars, white dwarfs, neutron stars and quasars, with their planets): positions, distances, radii, masses and temperatures compiled from the published literature and rounded. Per-value citations are not yet attached; each object links to its SIMBAD record for the primary references.</li>
  <li><b>Solar System planets:</b> J2000 mean orbital elements (E. M. Standish, JPL) and Kepler's equation. Physical values from NASA planetary fact sheets.</li>
  <li><b>Surface maps:</b> NASA Blue Marble and Black Marble (public domain), NASA SVS CGI Moon Kit from LRO (public domain), Solar System Scope maps based on NASA imagery (CC BY 4.0).</li>
  <li><b>Sagittarius A*</b> distance: GRAVITY Collaboration (2019), A&amp;A 625, L10.</li></ul>
  <h3>Accuracy</h3>
  <table class="sx-acc"><thead><tr><th>Quantity</th><th>Accuracy here</th></tr></thead><tbody>
  <tr><td>Catalogue star distances</td><td>Parallax error under 10% (Gaia); HYG for the brightest stars</td></tr>
  <tr><td>Catalogue star coordinates</td><td>Stored to the nearest 0.84 ly in 3D, so a few arcminutes for distant stars and up to several degrees for the nearest. The inspector states the uncertainty and links to SIMBAD for exact values.</td></tr>
  <tr><td>Planet positions</td><td>About 1° in ecliptic longitude. Orbital inclinations are not drawn.</td></tr>
  <tr><td>The Moon's position</td><td>Mean motion only: up to about 6° out.</td></tr>
  <tr><td>Named-object values</td><td>Rounded literature values; uncertainties not yet shown.</td></tr></tbody></table>
  <p class="sx-note">Scorcher Sky is for learning and exploring. It is not an ephemeris or a research catalogue: for precise positions use <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> for the Solar System and <a href="https://simbad.cds.unistra.fr/simbad/" target="_blank" rel="noopener">SIMBAD</a> or the <a href="https://gea.esac.esa.int/archive/" target="_blank" rel="noopener">Gaia Archive</a> for stars.</p>
  <h3>Coming next</h3><ul><li>Planet and Moon positions from a full ephemeris (astronomy-engine), with any date and time.</li><li>Citations and published uncertainties on every named-object value.</li></ul>`;
const helpHTML = () => `<h2>Help</h2><table class="sx-acc"><tbody>
  <tr><td>Move</td><td>Drag, or use a trackpad</td></tr><tr><td>Zoom</td><td>Scroll, pinch, <kbd>+</kbd> <kbd>−</kbd>, or drag along the scale bar</td></tr>
  <tr><td>Inspect</td><td>Tap an object; tap empty sky to identify the nearest catalogue star</td></tr><tr><td>Search</td><td><kbd>/</kbd>, then a name or coordinates such as <code>05h35m −05.4</code>, <code>05:35:17 -05:23:28</code> or <code>83.82 -5.39</code></td></tr>
  <tr><td>Browse</td><td><kbd>B</kbd> opens the object list</td></tr><tr><td>Detail</td><td><kbd>D</kbd> switches between Essentials and Full data</td></tr><tr><td>Labels</td><td><kbd>L</kbd></td></tr><tr><td>Close</td><td><kbd>Esc</kbd></td></tr></tbody></table>
  <p>Tap a field name in the inspector to see what it means. Every object has a link you can share: the address bar updates as you explore.</p>`;
$$('[data-open]').forEach(b => b.onclick = () => { closeBrowse(); $('#' + b.dataset.open).click(); });
$('#sxLegendBtn').onclick = () => dlg(legendHTML()); $('#sxMethods').onclick = () => dlg(methodsHTML()); $('#sxHelp').onclick = () => dlg(helpHTML());

/* ---- keyboard */
document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || document.getElementById('cmp') || document.getElementById('inspect') || $('#sxDlg').open) return;
  if (e.key === '/') { e.preventDefault(); $('#sxQ').focus(); } else if (e.key === '+' || e.key === '=') map.zoom(2); else if (e.key === '-' || e.key === '_') map.zoom(.5);
  else if (e.key === 'l' || e.key === 'L') $('#sxLabels').click(); else if (e.key === 'd' || e.key === 'D') { PREF.detail = PREF.detail === 'full' ? 'simple' : 'full'; savePref(); syncSeg(); renderInsp(); }
  else if (e.key === 'b' || e.key === 'B') document.body.classList.toggle('browse'); else if (e.key === '?') $('#sxHelp').click();
  else if (e.key === 'Escape') { if (document.body.classList.contains('browse')) closeBrowse(); else if (curFacts) $('#sxInspX').click(); }
});

drawList(); renderInsp();
{ const m = location.hash.match(/#o=(.+)$/); if (m) { const n = decodeURIComponent(m[1]); if (n[0] === '★') { SKY.catLoad(); const t0 = Date.now(), iv = setInterval(() => { if (SKY.namesReady() && SKY.catAnchor(+n.slice(1))) { clearInterval(iv); map.pick(n); } else if (Date.now() - t0 > 15000) clearInterval(iv); }, 250); } else setTimeout(() => map.pick(n), 350); } }
