#!/usr/bin/env node
'use strict';
// Builds treedata/vertebrates.json for Scorcher Tree from the curated inputs in tree/ (see docs/tree-data.md).
//   node tools/build-tree.js            draft topology + local evidence records, no network
//   --otol      topology from the Open Tree of Life synthesis (api.opentreeoflife.org), matched by name
//   --images    a freely licensed photo per species from Wikidata (P18) and Wikimedia Commons, with credit
//   --verify    check every citation's DOI against Crossref (title and year must match)
// Ages are never fetched or estimated here: they come only from the evidence records, each with a citation.
// A node with no published age gets only the bracket its dated neighbours imply ("bounded").
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), IN = path.join(ROOT, 'tree'), OUT = path.join(ROOT, 'treedata', 'vertebrates.json');
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------- Newick */
function parseNewick(s) {   // labels may be quoted; branch lengths and comments are ignored
  let i = 0; const src = s.trim().replace(/;\s*$/, '');
  const label = () => { let t = ''; if (src[i] === "'") { i++; while (i < src.length) { if (src[i] === "'" && src[i + 1] === "'") { t += "'"; i += 2; } else if (src[i] === "'") { i++; break; } else t += src[i++]; } }
    else while (i < src.length && !',():;['.includes(src[i])) t += src[i++]; if (src[i] === '[') { while (i < src.length && src[i] !== ']') i++; i++; } if (src[i] === ':') { i++; while (i < src.length && !',();'.includes(src[i])) i++; } return t.trim(); };
  const node = () => { const n = {}; if (src[i] === '(') { i++; n.children = [node()]; while (src[i] === ',') { i++; n.children.push(node()); } if (src[i] !== ')') throw new Error('Newick: expected ) at ' + i); i++; } n.label = label(); return n; };
  const t = node(); if (i < src.length) throw new Error('Newick: trailing text at ' + i); return t;
}

/* ---------------- tree helpers */
const tipsOf = n => n.children ? n.children.flatMap(tipsOf) : [n.id];
function mrca(tree, ids) { let best = null; (function f(n) { if (!n.children) return; const t = new Set(tipsOf(n)); if (ids.every(x => t.has(x))) { best = n; n.children.forEach(f); } })(tree); return best; }
function walk(n, f, parent = null) { f(n, parent); (n.children || []).forEach(c => walk(c, f, n)); }

// bounded intervals: at least as old as the oldest dated thing below, no older than the youngest dated thing above (strictly from published values)
function deriveBounds(tree, nodes) {
  const ownFloor = n => { const a = (nodes[n.id] || {}).age || {}, d = a.display; return Math.max(d && d.source === 'calibration' ? d.lo : 0, a.fossilMin ? a.fossilMin.ma : 0); };   // floors come only from fossils (hard minimums), never from the low end of a clock estimate
  const floor = new Map(); (function up(n) { if (!n.children) { floor.set(n.id, 0); return 0; } let f = ownFloor(n); n.children.forEach(c => { f = Math.max(f, up(c)); }); floor.set(n.id, f); return f; })(tree);
  (function down(n, ceil) { if (!n.children) return; const rec = nodes[n.id] || (nodes[n.id] = { relationship: { status: 'pending' }, age: {}, review: null }); rec.age = rec.age || {}; const d = rec.age.display;
    if (!d || d.source === 'bounded') {   // its own fossil minimum and soft maximum count, as do the floors of its descendants and the ceiling of its ancestors
      const lo = n.children.reduce((m, c) => Math.max(m, floor.get(c.id)), rec.age.fossilMin ? rec.age.fossilMin.ma : 0), hi = Math.min(ceil, rec.age.softMax ? rec.age.softMax.ma : Infinity);
      rec.age.display = lo > 0 || isFinite(hi) ? { lo: lo || null, hi: isFinite(hi) ? hi : null, source: 'bounded' } : null; }
    const own = rec.age.display ? (rec.age.display.hi != null ? rec.age.display.hi : Infinity) : Infinity; n.children.forEach(c => down(c, Math.min(ceil, own))); })(tree, Infinity);
}

// a TimeTree entry with an interval TimeTree actually published, for a clade that matches ours (see tools/fetch-timetree.js)
const ttUsable = e => !e.conflict && !e.unavailable && e.studies >= 2 && e.ciLow > 0 && e.ciLow <= e.median && e.median <= e.ciHigh;

/* ---------------- network sources (only with flags) */
const post = async (url, body) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(url + ' ' + r.status + ' ' + (await r.text()).slice(0, 200)); return r.json(); };
const get = async (url, tries = 6) => {   // Wikimedia rate-limits bursts (429): wait as long as Retry-After asks, then try again
  for (let t = 0; ; t++) { const r = await fetch(url, { headers: { 'user-agent': 'ScorcherTree/0.1 (https://playscorcher.com/tree)' } });
    if (r.ok) return r.json(); if ((r.status === 429 || r.status >= 500) && t < tries) { await new Promise(f => setTimeout(f, 1000 * Math.min(60, +r.headers.get('retry-after') || 2 ** (t + 1)))); continue; }
    throw new Error(url + ' ' + r.status); } };
async function fromOpenTree(sp) {
  const m = await post('https://api.opentreeoflife.org/v3/tnrs/match_names', { names: sp.map(s => s[0]), context_name: 'Animals', do_approximate_matching: false }), ott = {}, miss = [];
  m.results.forEach(r => { const best = (r.matches || []).find(x => !x.is_approximate_match && x.score === 1) || (r.matches || [])[0]; if (best) ott[r.name] = best.taxon.ott_id; else miss.push(r.name); });
  if (miss.length) console.warn('  not matched in the Open Tree taxonomy:', miss.join(', '));
  const sub = await post('https://api.opentreeoflife.org/v3/tree_of_life/induced_subtree', { ott_ids: Object.values(ott), label_format: 'name_and_id' });
  // tips are resolved by OTT id, not label text: OTT unique names can carry a disambiguator ("Gadus morhua (species in domain Eukaryota)"),
  // and a taxon that is not monophyletic in the synthesis ("broken") comes back as the label of the MRCA node it is placed at
  const sciOf = Object.fromEntries(Object.entries(ott).map(([sci, id]) => ['ott' + id, sci])), broken = sub.broken || {};
  for (const [q, node] of Object.entries(broken)) { sciOf[node] = sciOf[q]; console.warn(`  ${sciOf[q]} (${q}) is not monophyletic in the synthesis: placed at its MRCA ${node}`); }
  const about = await post('https://api.opentreeoflife.org/v3/tree_of_life/about', {}).catch(() => ({}));
  return { newick: sub.newick, ott, sciOf, version: about.synth_id || 'unknown' };
}
async function wikimedia(sci, override) {   // Wikidata item by taxon name (P225), its image (P18) or a hand-chosen file (tree/images.json), the Commons licence and author
  const s = await get('https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=' + encodeURIComponent(`haswbstatement:"P225=${sci}"`));
  const q = s.query.search[0] && s.query.search[0].title; if (!q) return {};
  const e = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${q}`)).entities[q];
  const p18s = ((e.claims || {}).P18 || []).filter(c => c.rank !== 'deprecated' && c.mainsnak.datavalue), pick = p18s.find(c => c.rank === 'preferred') || p18s[0], p18 = override || (pick && pick.mainsnak.datavalue.value); if (!p18) return { wikidata: q };
  const ii = await get('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500&titles=' + encodeURIComponent('File:' + p18));
  const pg = Object.values(ii.query.pages)[0], info = pg.imageinfo && pg.imageinfo[0]; if (!info) return { wikidata: q };
  const md = info.extmetadata || {}, v = k => (md[k] || {}).value || '', lic = v('LicenseShortName');
  const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, x) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[x]).replace(/\s+/g, ' ').trim();
  if (String(v('NonFree')).toLowerCase() === 'true' || !/^(cc0|public domain|pd|cc by(-sa)? [0-9.]+)/i.test(lic)) return { wikidata: q, imageSkipped: lic || 'unknown licence' };
  const artist = strip(v('Artist')) || 'Unknown', attr = strip(v('Attribution')), credit = attr.length > 90 && attr.includes(': ') ? attr.slice(attr.lastIndexOf(': ') + 2) : attr;   // Attribution: the credit text the licensor asks for (sometimes inside a longer notice)
  return { wikidata: q, image: { thumb: info.thumburl, page: info.descriptionurl, artist, ...(credit && credit !== artist ? { credit } : {}), licence: lic, licenceUrl: v('LicenseUrl') } };
}
async function crossref(c) {
  const w = (await get('https://api.crossref.org/works/' + encodeURIComponent(c.doi))).message, title = (w.title || [''])[0], year = ((w.issued || {})['date-parts'] || [[0]])[0][0];
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), ok = norm(title).includes(norm(c.title).slice(0, 40)) && (!c.year || +c.year === +year);
  return { ok, title, year };
}

/* ---------------- build */
async function build(flags = {}) {
  const sp = JSON.parse(fs.readFileSync(path.join(IN, 'species.json'), 'utf8')), bySci = new Map(sp.species.map(s => [s[0], s]));
  const citations = JSON.parse(fs.readFileSync(path.join(IN, 'citations.json'), 'utf8'));
  let newick = fs.readFileSync(path.join(IN, 'draft-topology.nwk'), 'utf8'), topo = { source: 'draft', version: 'hand-curated fallback: debated or unchecked splits left unresolved' }, ottOf = {}, sciOf = {};
  if (flags.otol) { const o = await fromOpenTree(sp.species); newick = o.newick; ottOf = o.ott; sciOf = o.sciOf; topo = { source: 'Open Tree of Life synthesis', version: o.version }; }
  const raw = parseNewick(newick), taxa = {}, nodes = {}, seen = new Set();
  const tipName = l => { const key = (l.match(/(mrcaott\d+ott\d+|ott\d+)$/) || [])[1]; if (key && sciOf[key]) return sciOf[key]; const sci = l.replace(/_/g, ' ').replace(/\s+ott\d+$/, '').trim(); return bySci.has(sci) ? sci : null; };
  const tree = (function conv(n) {
    if (!n.children) { const sci = tipName(n.label); if (!sci) throw new Error('tip not in species.json: ' + n.label); const s = bySci.get(sci), id = slug(sci); seen.add(sci); taxa[id] = { sci, common: s[1], group: s[2], ...(ottOf[sci] ? { ott: ottOf[sci] } : {}) }; return { id }; }
    const lab = n.label.replace(/_/g, ' ').replace(/\s+(mrcaott\d+ott\d+|ott\d+)$/, '').replace(/\s*\([^)]*\)$/, '').trim(), name = /^mrcaott/.test(lab) ? '' : lab;
    if (n.children.length === 1) {   // a single-child node (every named rank on the path in an induced subtree): it names the same set of selected species as its child
      const c = conv(n.children[0]); if (!c.children) return c;   // a rank above one tip says nothing about this selection
      if (name) { if (!c.name) { c.name = name; c.id = slug(name); } c.aliases = [...(c.aliases || [c.name]), name].filter((x, i, a) => a.indexOf(x) === i); } return c; }   // the innermost name is the true MRCA of these species in the full tree; outer names are kept as aliases
    const kids = n.children.map(conv), id = name ? slug(name) : 'mrca-' + kids.map(k => tipsOf(k).sort()[0]).sort().slice(0, 2).join('--'); /* the smallest tip of two different children: their MRCA is this node, so the id is unique */ return { id, name, children: kids }; })(raw);
  const missing = sp.species.filter(s => !seen.has(s[0])).map(s => s[0]); if (missing.length) console.warn('  species not on the tree:', missing.join(', '));
  walk(tree, n => { if (n.children) nodes[n.id] = { name: n.name || null, relationship: { status: n.children.length > 2 ? 'pending' : 'pending' }, age: {}, review: null }; });
  // evidence records: matched by "mrca" (two or more species, robust to any topology) or by node id
  const claimed = new Map(), inUse = new Set(); walk(tree, n => inUse.add(n.id));
  for (const f of fs.readdirSync(path.join(IN, 'nodes')).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const rec = JSON.parse(fs.readFileSync(path.join(IN, 'nodes', f), 'utf8')), id = f.replace(/\.json$/, '');
    let target = rec.mrca ? mrca(tree, rec.mrca.map(slug)) : null; if (!target) walk(tree, n => { if (!target && n.children && (n.id === id || slug(n.name || '') === id || (n.aliases || []).some(a => slug(a) === id))) target = n; });
    if (target && rec.exact && tipsOf(target).sort().join('|') !== rec.mrca.map(slug).sort().join('|')) target = null;   // "exact": this clade only, never a larger node that happens to be the MRCA on another topology
    if (!target) { if (!rec.exact) console.warn('  evidence record matches no node on this topology:', f); continue; }
    if (claimed.has(target)) { console.warn(`  evidence records ${claimed.get(target)} and ${f} both match node ${target.id}: ${f} skipped`); continue; } claimed.set(target, f);
    if (target.id !== id && !inUse.has(id)) { inUse.delete(target.id); nodes[id] = nodes[target.id]; delete nodes[target.id]; target.id = id; inUse.add(id); }   // the record's id names the node, so links (#n=placentalia) survive a change of topology
    const { mrca: _m, exact: _e, ...body } = rec; nodes[target.id] = { ...nodes[target.id], ...body, name: body.name || nodes[target.id].name };
  }
  // TimeTree 5 synthesis ages (tree/timetree.json, written by tools/fetch-timetree.js), attached only to a node whose selected species are exactly
  // the clade TimeTree was checked against. A node with no display of its own shows this interval (source "synthesis").
  const ttFile = path.join(IN, 'timetree.json');
  if (fs.existsSync(ttFile)) { const T = JSON.parse(fs.readFileSync(ttFile, 'utf8')), byClade = new Map(T.nodes.filter(ttUsable).map(e => [e.clade.map(slug).sort().join('|'), e]));
    walk(tree, n => { if (!n.children) return; const e = byClade.get(tipsOf(n).sort().join('|')); if (!e) return; const a = nodes[n.id].age = nodes[n.id].age || {};
      const c = { lo: e.ciLow, mid: e.median, hi: e.ciHigh, method: `TimeTree 5 synthesis: the median of ${e.studies} published estimates, with the confidence interval of that median (not a credible interval for the date itself)`,
        data: e.proxies ? 'Queried with ' + e.proxies.join('; ') + ' (the species itself is not in TimeTree)' : 'Queried with ' + e.query.join(', '), cite: T.cite, studies: e.studies, retrieved: e.retrieved, ...(e.adjusted !== e.median ? { adjusted: e.adjusted } : {}) };
      a.clock = [...(a.clock || []), c]; if (!a.display) a.display = { lo: c.lo, mid: c.mid, hi: c.hi, source: 'synthesis' }; }); }
  deriveBounds(tree, nodes);
  if (flags.images) { const pick = JSON.parse(fs.readFileSync(path.join(IN, 'images.json'), 'utf8')); let k = 0; for (const [id, t] of Object.entries(taxa)) { try { const look = () => wikimedia(t.sci, pick[t.sci] && pick[t.sci].file); Object.assign(t, await look().catch(() => new Promise(f => setTimeout(f, 5000)).then(look))); if (t.imageSkipped) console.warn(`  no image for ${t.sci}: ${t.imageSkipped}`); } catch (e) { console.warn('  image lookup failed for', t.sci, e.message); } if (++k % 10 === 0) console.log(`  images: ${k}/${Object.keys(taxa).length}`); } }
  if (flags.verify) for (const [k, c] of Object.entries(citations)) { if (!c.doi) continue; try { const r = await crossref(c); c.verified = r.ok; c.verifiedAt = new Date().toISOString().slice(0, 10); if (!r.ok) console.warn(`  citation ${k}: Crossref has "${r.title}" (${r.year})`); } catch (e) { c.verified = false; console.warn(`  citation ${k}: DOI did not resolve (${e.message})`); } }
  if (flags.verify) fs.writeFileSync(path.join(IN, 'citations.json'), JSON.stringify(citations, null, 2) + '\n');
  const used = new Set(); JSON.stringify(nodes, (k, v) => { if (k === 'cite' && typeof v === 'string') used.add(v); return v; });
  const data = { version: 1, section: sp.section, built: new Date().toISOString(), status: topo.source === 'draft' ? 'draft' : 'built', topology: topo, taxa, tree, nodes, citations: Object.fromEntries(Object.entries(citations).filter(([k]) => used.has(k))) };
  return data;
}

if (require.main === module) {
  const flags = Object.fromEntries(['otol', 'images', 'verify'].map(f => [f, process.argv.includes('--' + f)]));
  build(flags).then(data => {
    const { validate } = require('./check-tree.js'), r = validate(data, { strict: false });
    r.warnings.slice(0, 12).forEach(w => console.warn('  warn: ' + w)); if (r.warnings.length > 12) console.warn(`  … and ${r.warnings.length - 12} more warnings`);
    if (r.errors.length) { r.errors.forEach(e => console.error('  ERROR: ' + e)); console.error('not written: fix the errors above'); process.exit(1); }
    fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(data));
    const nn = Object.keys(data.nodes).length, dated = Object.values(data.nodes).filter(n => n.age.display && n.age.display.source !== 'bounded').length, imgs = Object.values(data.taxa).filter(t => t.image).length;
    console.log(`treedata/vertebrates.json: ${Object.keys(data.taxa).length} species, ${nn} nodes (${dated} dated from the literature), ${imgs} images, topology: ${data.topology.source}`);
  }).catch(e => { console.error(e.message); process.exit(1); });
}
module.exports = { parseNewick, mrca, tipsOf, deriveBounds, build, slug, ttUsable };
