#!/usr/bin/env node
'use strict';
// Caches TimeTree 5 (Kumar et al. 2022, doi:10.1093/molbev/msac174) node ages for every branch point of Scorcher Tree, in tree/timetree.json.
//   node tools/fetch-timetree.js            the draft topology and the last built topology (treedata/vertebrates.json)
// For each internal node it asks TimeTree for the MRCA of one species from each child (that MRCA is the node), then asks again with the
// node's sister added: if TimeTree returns the same node, its clade is not ours (the two trees disagree) and the entry is marked a conflict.
// Each entry stores the exact set of selected species in the clade it was checked against; the build attaches it only to a node with that
// same set, so an estimate is never moved onto a differently composed clade. Numbers are stored as TimeTree returns them (two decimals).
const fs = require('fs'), path = require('path');
const { build, tipsOf, ttUsable: usable } = require('./build-tree.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'tree', 'timetree.json'), UA = { 'user-agent': 'ScorcherTree/0.1 (https://playscorcher.com/tree)' };
const sleep = ms => new Promise(f => setTimeout(f, ms)), r2 = x => x == null ? null : Math.round(x * 100) / 100;

async function json(url, tries = 5) { for (let t = 0; ; t++) { try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.json(); if (t >= tries || r.status < 500 && r.status !== 429) throw new Error(url + ' ' + r.status); } catch (e) { if (t >= tries) throw e; } await sleep(2000 * 2 ** t); } }
async function ncbiIds(species) {   // NCBI taxon ids (TimeTree's keys) from the Open Tree taxonomy's source list
  const m = await (await fetch('https://api.opentreeoflife.org/v3/tnrs/match_names', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ names: species, context_name: 'Animals', do_approximate_matching: false }) })).json(), out = {};
  for (const r of m.results) { const best = (r.matches || [])[0]; if (!best) continue; const n = (best.taxon.tax_sources || []).find(s => s.startsWith('ncbi:')); if (n) out[r.name] = +n.slice(5); }
  return out;
}
const mrcaQuery = ids => json('https://timetree.org/api/mrca/id/' + ids.join('+') + '/json');

if (require.main === module) (async () => {
  const sp = JSON.parse(fs.readFileSync(path.join(ROOT, 'tree', 'species.json'), 'utf8')).species.map(s => s[0]);
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}, ncbi = { ...(old.ncbi || {}), ...(await ncbiIds(sp)) };
  const miss = sp.filter(s => !ncbi[s]); if (miss.length) console.warn('  no NCBI id:', miss.join(', '));
  const trees = [(await build({})).tree]; try { trees.push(JSON.parse(fs.readFileSync(path.join(ROOT, 'treedata', 'vertebrates.json'), 'utf8')).tree); } catch {}
  const sciOf = {}; for (const s of sp) sciOf[s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')] = s;
  // TimeTree lacks some species but holds a higher taxon containing them (its timeline for the species starts there). Such a taxon stands in
  // for the species only if it contains none of the nearby selected species (everything under the species' grandparent on our tree).
  const have = new Set(), ids = sp.map(s => ncbi[s]).filter(Boolean); for (let i = 0; i < ids.length; i += 15) { const r = await mrcaQuery(ids.slice(i, i + 15)); const m = new Set((r.missing_ids || []).map(Number)); ids.slice(i, i + 15).forEach(x => { if (!m.has(x)) have.add(x); }); await sleep(400); }
  const near = new Map(); (function f(n, up) { if (!n.children) { near.set(sciOf[n.id], (up[1] ? tipsOf(up[1]) : []).map(i => sciOf[i]).filter(x => x !== sciOf[n.id])); return; } n.children.forEach(c => f(c, [n, up[0]])); })(trees[trees.length - 1], [null, null]);
  const tt = {}, proxies = {}; for (const s of sp) if (have.has(ncbi[s])) tt[s] = ncbi[s];
  const lines = {}; for (const s of sp.filter(x => !tt[x] && ncbi[x])) { lines[s] = (await json('https://timetree.org/api/timeline/' + encodeURIComponent(s) + '/json')).filter(c => c.ncbi_id > 0); await sleep(400); }
  for (const s of Object.keys(lines)) {
    for (const c of lines[s]) { let clean = true;
      for (const x of near.get(s) || []) { const xid = have.has(ncbi[x]) ? ncbi[x] : lines[x] && lines[x][0] && lines[x][0].ncbi_id; if (!xid) continue;   // a neighbour TimeTree also lacks is tested by its own lowest taxon
        if (+xid === +c.ncbi_id) { clean = false; break; } const r = await mrcaQuery([c.ncbi_id, xid]); await sleep(300); if (+r.taxon_id === +c.ncbi_id) { clean = false; break; } }
      if (clean) { tt[s] = c.ncbi_id; proxies[s] = { ncbi: c.ncbi_id, name: c.name.scientific, rank: c.rank }; break; } }
    console.log(`  ${s}: not in TimeTree as a species; ${proxies[s] ? `standing in with ${proxies[s].rank} ${proxies[s].name}` : 'no clean higher taxon, left out'}`);
  }
  const jobs = new Map();   // clade key -> { clade, query, sister }
  for (const tree of trees) (function f(n, parent) { if (!n.children) return; const clade = tipsOf(n).map(i => sciOf[i]).sort(), key = clade.join('|');
    const rep = c => { const t = tipsOf(c).map(i => sciOf[i]).sort(); return t.find(x => tt[x]) || t[0]; }, query = n.children.map(rep), sib = parent && parent.children.find(c => c !== n), sister = sib ? rep(sib) : null;   // each child is represented by a species TimeTree holds
    if (!jobs.has(key)) jobs.set(key, { clade, query, sister }); n.children.forEach(c => f(c, n)); })(tree, null);
  const entries = [], when = new Date().toISOString().slice(0, 10); let k = 0;
  for (const { clade, query, sister } of jobs.values()) {
    const prev = (old.nodes || []).find(e => e.clade.join('|') === clade.join('|'));
    if (prev && process.argv.includes('--keep')) { entries.push(prev); continue; }
    if (query.some(s => !tt[s])) { entries.push({ clade, query, unavailable: 'a species is not in TimeTree: ' + query.filter(s => !tt[s]).join(', ') }); continue; }
    try {
      const a = await mrcaQuery(query.map(s => tt[s])); await sleep(400);
      let conflict = false; if (sister && tt[sister]) { const b = await mrcaQuery([...query, sister].map(s => tt[s])); conflict = b.mrca_ttid === a.mrca_ttid; await sleep(400); }
      const times = String(a.time_estimates || '').replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
      const used = query.filter(x => proxies[x]).map(x => `${x} as ${proxies[x].name}`);
      entries.push({ clade, query, ...(used.length ? { proxies: used } : {}), ttid: a.mrca_ttid, ncbiTaxon: a.taxon_id, median: r2(a.precomputed_age), ciLow: r2(a.precomputed_ci_low), ciHigh: r2(a.precomputed_ci_high), adjusted: r2(a.adjusted_age), studies: times.length, ...(conflict ? { conflict: `TimeTree's clade for these species also contains ${sister}` } : {}), retrieved: when });
    } catch (e) { console.warn('  TimeTree failed for', query.join(' + '), e.message); if (prev) entries.push(prev); }
    if (++k % 10 === 0) console.log(`  ${k}/${jobs.size}`);
  }
  fs.writeFileSync(OUT, JSON.stringify({ _note: 'TimeTree 5 node ages (Kumar et al. 2022), written by tools/fetch-timetree.js: median of the published study estimates for the node and the confidence interval of that median. Do not edit by hand.', source: 'https://timetree.org', cite: 'kumar2022', ncbi, proxies, nodes: entries }, null, 1) + '\n');
  const ok = entries.filter(usable), bad = entries.filter(e => e.conflict);
  console.log(`tree/timetree.json: ${entries.length} clades, ${ok.length} usable, ${bad.length} topology conflicts, ${entries.length - ok.length - bad.length} without an interval`);
})().catch(e => { console.error(e); process.exit(1); });
