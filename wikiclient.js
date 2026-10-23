// Browser client for the MediaWiki API, exposing the same graph interface as tools/wikigraph.js (see solver.js).
// Needs clean.js loaded first. Polite by design: small concurrency, retries with back-off, results cached in memory.
(function (root) {
  const norm = WikiClean.norm, sleep = ms => new Promise(r => setTimeout(r, ms));
  function makeGraph({ endpoint = 'https://en.wikipedia.org/w/api.php', conc = 4 } = {}) {
    let active = 0, calls = 0; const waiters = [], memo = new Map(), outC = new Map(), inC = new Map();
    const acquire = async () => { if (active >= conc) await new Promise(r => waiters.push(r)); active++; };
    const release = () => { active--; const w = waiters.shift(); if (w) w(); };
    async function api(params, tries = 5) {
      const qs = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', maxlag: '5', ...params });
      let last;
      for (let i = 0; i < tries; i++) {
        let retry = false; await acquire();
        try {
          calls++;
          const r = await fetch(`${endpoint}?${qs}`);
          if (r.status === 429 || r.status >= 500) { retry = true; last = new Error('http ' + r.status); }
          else { const j = await r.json(); if (j.error && j.error.code === 'maxlag') { retry = true; last = new Error('maxlag'); } else if (j.error) throw Object.assign(new Error(j.error.info || j.error.code), { fatal: true }); else return j; }
        } catch (e) { if (e.fatal) throw e; retry = true; last = e; } finally { release(); }
        if (retry) await sleep(700 * 2 ** i);
      }
      throw last || new Error('api failed');
    }
    async function outLinks(titles) {
      const res = new Map(), need = [];
      for (const t of titles) { if (outC.has(t)) res.set(t, outC.get(t)); else need.push(t); }
      for (let i = 0; i < need.length; i += 50) {
        const batch = need.slice(i, i + 50), acc = new Map(batch.map(t => [t, []]));
        let cont = {};
        do {
          const j = await api({ action: 'query', prop: 'links', titles: batch.join('|'), pllimit: 'max', plnamespace: '0', redirects: '1', ...cont });
          const q = j.query || {}, alias = new Map();
          for (const t of batch) { let f = t; for (const n of q.normalized || []) if (n.from === f) { f = n.to; break; } for (const r of q.redirects || []) if (r.from === f) { f = r.to; break; } if (!alias.has(f)) alias.set(f, []); alias.get(f).push(t); }
          for (const p of q.pages || []) for (const req of alias.get(p.title) || []) for (const l of p.links || []) acc.get(req).push(l.title);
          cont = j.continue || null;
        } while (cont);
        for (const [t, arr] of acc) { const u = [...new Set(arr)]; outC.set(t, u); res.set(t, u); }
      }
      return res;
    }
    async function inLinks(title, cap = 3000) {
      const ck = cap + '|' + title; if (inC.has(ck)) return inC.get(ck);
      const out = []; let cont = {};
      do {
        const j = await api({ action: 'query', prop: 'linkshere', titles: title, lhlimit: 'max', lhnamespace: '0', lhprop: 'title|redirect', redirects: '1', ...cont });
        const p = ((j.query || {}).pages || [])[0] || {};
        for (const l of p.linkshere || []) if (!l.redirect) out.push(l.title);
        cont = out.length < cap ? j.continue : null;
      } while (cont);
      const u = [...new Set(out)].slice(0, cap); inC.set(ck, u); return u;
    }
    async function playable(title) {
      const k = norm(title); if (memo.has(k)) return memo.get(k);
      let v = null;
      try {
        const j = await api({ action: 'parse', page: title, redirects: '1', prop: 'text', disableeditsection: '1', disablelimitreport: '1', disabletoc: '1' });
        const doc = new DOMParser().parseFromString(j.parse.text, 'text/html'), rootEl = doc.querySelector('.mw-parser-output') || doc.body;
        WikiClean.clean(rootEl);
        v = { title: j.parse.title, links: [...new Set(Array.from(rootEl.querySelectorAll('a[data-t]')).map(a => a.getAttribute('data-t')))] };
        v.set = new Set(v.links.map(norm));
      } catch (e) { if (!e.fatal) throw e; v = null; }
      memo.set(k, v); if (v) memo.set(norm(v.title), v); return v;
    }
    // type-ahead for the puzzle picker
    async function search(q) { const j = await api({ action: 'opensearch', search: q, limit: '8', namespace: '0' }); return (Array.isArray(j) ? j[1] : []) || []; }
    return { norm, api, outLinks, inLinks, playable, search, stats: () => ({ calls }) };
  }
  root.WikiClient = { makeGraph };
})(typeof window !== 'undefined' ? window : globalThis);
