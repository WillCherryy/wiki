'use strict';
// Polite, cached MediaWiki API client used by the offline puzzle tooling.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DOMParser } = require('linkedom');
const WikiClean = require('../clean.js');

const API = process.env.WIKI_API || 'https://en.wikipedia.org/w/api.php';
const UA = process.env.WIKI_UA || 'wikilink-puzzle-builder/0.2 (set WIKI_UA to your contact URL or email)';
const CONC = +process.env.WIKI_CONCURRENCY || 3;
const CACHE_DIR = process.env.WIKI_CACHE || path.join(__dirname, '.cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const norm = WikiClean.norm;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let active = 0; const waiters = [];
const acquire = async () => { if (active >= CONC) await new Promise(r => waiters.push(r)); active++; };
const release = () => { active--; const w = waiters.shift(); if (w) w(); };
let calls = 0;

async function api(params, tries = 5) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  let lastErr;
  for (let i = 0; i < tries; i++) {
    let retry = false;
    await acquire();
    try {
      calls++;
      const r = await fetch(`${API}?${qs}`, { headers: { 'user-agent': UA, 'accept-encoding': 'gzip' } });
      if (r.status === 429 || r.status >= 500) retry = true, lastErr = new Error('http ' + r.status);
      else {
        const j = await r.json();
        if (j.error && j.error.code === 'maxlag') retry = true, lastErr = new Error('maxlag');
        else if (j.error) throw Object.assign(new Error(j.error.info || j.error.code), { fatal: true });
        else return j;
      }
    } catch (e) { if (e.fatal) throw e; retry = true; lastErr = e; }
    finally { release(); }
    if (retry) await sleep(800 * 2 ** i);
  }
  throw lastErr || new Error('api failed');
}

const keyOf = (kind, t) => path.join(CACHE_DIR, crypto.createHash('sha1').update(kind + '\0' + t).digest('hex') + '.json');
function cacheGet(kind, t) { try { return JSON.parse(fs.readFileSync(keyOf(kind, t), 'utf8')); } catch { return undefined; } }
function cacheSet(kind, t, v) { try { fs.writeFileSync(keyOf(kind, t), JSON.stringify(v)); } catch {} }

// API out-links (a superset of what is playable: includes infobox, navboxes, "See also").
async function outLinks(titles) {
  const res = new Map(), need = [];
  for (const t of titles) { const c = cacheGet('out', t); if (c) res.set(t, c); else need.push(t); }
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50), acc = new Map(batch.map(t => [t, []]));
    let cont = {};
    do {
      const j = await api({ action: 'query', prop: 'links', titles: batch.join('|'), pllimit: 'max', plnamespace: '0', redirects: '1', ...cont });
      const q = j.query || {}, alias = new Map();
      for (const t of batch) {
        let f = t;
        for (const n of q.normalized || []) if (n.from === f) { f = n.to; break; }
        for (const r of q.redirects || []) if (r.from === f) { f = r.to; break; }
        if (!alias.has(f)) alias.set(f, []); alias.get(f).push(t);
      }
      for (const p of q.pages || []) for (const req of alias.get(p.title) || []) for (const l of p.links || []) acc.get(req).push(l.title);
      cont = j.continue || null;
    } while (cont);
    for (const [t, arr] of acc) { const u = [...new Set(arr)]; cacheSet('out', t, u); res.set(t, u); }
  }
  return res;
}

// Pages that link to `title` (direct linkers only, redirects excluded), capped.
async function inLinks(title, cap = 3000) {
  const ck = 'in' + cap, c = cacheGet(ck, title); if (c) return c;
  const out = []; let cont = {};
  do {
    const j = await api({ action: 'query', prop: 'linkshere', titles: title, lhlimit: 'max', lhnamespace: '0', lhprop: 'title|redirect', redirects: '1', ...cont });
    const p = ((j.query || {}).pages || [])[0] || {};
    for (const l of p.linkshere || []) if (!l.redirect) out.push(l.title);
    cont = out.length < cap ? j.continue : null;
  } while (cont);
  const u = [...new Set(out)].slice(0, cap); cacheSet(ck, title, u); return u;
}

// The playable links of an article, exactly as the game computes them. null if the page is missing.
const memo = new Map();
async function playable(title) {
  const k = norm(title); if (memo.has(k)) return memo.get(k);
  let v = cacheGet('page', title);
  if (v === undefined) {
    try {
      const j = await api({ action: 'parse', page: title, redirects: '1', prop: 'text', disableeditsection: '1', disablelimitreport: '1', disabletoc: '1' });
      const doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
      const root = doc.querySelector('.mw-parser-output') || doc.body;
      WikiClean.clean(root);
      v = { title: j.parse.title, links: [...new Set(Array.from(root.querySelectorAll('a[data-t]')).map(a => a.getAttribute('data-t')))] };
    } catch (e) { if (!e.fatal) throw e; v = null; }
    cacheSet('page', title, v);
  }
  if (v) { v.set = new Set(v.links.map(norm)); memo.set(norm(v.title), v); }
  memo.set(k, v); return v;
}

module.exports = { api, outLinks, inLinks, playable, norm, sleep, stats: () => ({ calls }) };
