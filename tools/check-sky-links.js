#!/usr/bin/env node
'use strict';
// Checks that every sky object's Wikipedia article exists (run it somewhere that can reach Wikipedia):  node tools/check-sky-links.js
global.window = {}; require('../skyobjects.js');
const all = Object.values(window.SKY.POOL).flat(), title = a => decodeURIComponent(a).replace(/_/g, ' ');
(async () => {
  let bad = 0;
  for (let i = 0; i < all.length; i += 40) {
    const chunk = all.slice(i, i + 40), url = 'https://en.wikipedia.org/w/api.php?action=query&redirects=1&format=json&titles=' + encodeURIComponent(chunk.map(q => title(q.a)).join('|')),
      j = await (await fetch(url, { headers: { 'user-agent': 'scorcher-link-check' } })).json(), pages = Object.values(j.query.pages || {}), missing = new Set(pages.filter(p => 'missing' in p).map(p => p.title)), norm = {};
    for (const n of j.query.normalized || []) norm[n.from] = n.to; for (const r of j.query.redirects || []) norm[r.from] = r.to;
    for (const q of chunk) { let t = title(q.a); t = norm[t] || t; t = norm[t] || t; if (missing.has(t)) { bad++; console.log('MISSING', q.n, '->', q.a); } }
  }
  console.log(bad ? bad + ' of ' + all.length + ' links need fixing' : 'all ' + all.length + ' links resolve');
})();
