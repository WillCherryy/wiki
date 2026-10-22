'use strict';
// Offline test: runs the solver against a fake MediaWiki API whose pages contain links that exist in the
// API graph but are NOT playable (infobox, "See also"), and compares par with brute-force truth.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const N = 120;
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const names = Array.from({ length: N }, (_, i) => 'N' + i);
const body = {}, info = {}, also = {};
names.forEach(n => {
  body[n] = new Set(); info[n] = new Set(); also[n] = new Set();
  for (let k = 0; k < 4; k++) body[n].add(names[Math.floor(rnd() * N)]);
  for (let k = 0; k < 3; k++) info[n].add(names[Math.floor(rnd() * N)]);
  for (let k = 0; k < 2; k++) also[n].add(names[Math.floor(rnd() * N)]);
  [body, info, also].forEach(m => m[n].delete(n));
});
const apiLinks = n => [...new Set([...body[n], ...info[n], ...also[n]])];
const a = t => `<a href="/wiki/${t}" title="${t}">${t}</a>`;
const html = n => `<div class="mw-parser-output"><table class="infobox"><tr><td>${[...info[n]].map(a).join(' ')}</td></tr></table><p>${n} text ${[...body[n]].map(a).join(', ')} <a href="/wiki/File:X.png">f</a>.</p><div class="mw-heading mw-heading2"><h2 id="See_also">See also</h2></div><ul>${[...also[n]].map(t => `<li>${a(t)}</li>`).join('')}</ul><div class="mw-heading mw-heading2"><h2 id="References">References</h2></div><p>${a('N0')}</p></div>`;

const server = http.createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams, send = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (q.get('action') === 'parse') {
    const p = q.get('page'); if (!body[p]) return send({ error: { code: 'missingtitle', info: 'no page' } });
    return send({ parse: { title: p, text: html(p) } });
  }
  const titles = (q.get('titles') || '').split('|').filter(Boolean);
  if (q.get('prop') === 'links') { // tiny limit to exercise continuation across pages
    const flat = []; titles.forEach((t, pi) => (body[t] ? apiLinks(t) : []).forEach((l, li) => flat.push([pi, li, l])));
    const start = q.get('plcontinue') ? +q.get('plcontinue') : 0, slice = flat.slice(start, start + 10);
    const pages = titles.map(t => ({ title: t, links: [] })); slice.forEach(([pi, , l]) => pages[pi].links.push({ ns: 0, title: l }));
    const o = { query: { pages } }; if (start + 10 < flat.length) o.continue = { plcontinue: String(start + 10), continue: '||' };
    return send(o);
  }
  if (q.get('prop') === 'linkshere') {
    const t = titles[0], all = names.filter(n => apiLinks(n).includes(t)).map(n => ({ ns: 0, title: n }));
    const start = q.get('lhcontinue') ? +q.get('lhcontinue') : 0, o = { query: { pages: [{ title: t, linkshere: all.slice(start, start + 7) }] } };
    if (start + 7 < all.length) o.continue = { lhcontinue: String(start + 7), continue: '||' };
    return send(o);
  }
  send({ error: { code: 'x', info: 'unsupported' } });
});

server.listen(0, async () => {
  process.env.WIKI_API = `http://127.0.0.1:${server.address().port}/w/api.php`;
  process.env.WIKI_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiio-'));
  process.env.WIKI_CONCURRENCY = '4';
  const { findRoute } = require('./solver');
  const { extract } = require('./build-pool');
  const dist = (s, t) => { const d = { [s]: 0 }, qu = [s]; while (qu.length) { const x = qu.shift(); for (const y of body[x]) if (!(y in d)) { d[y] = d[x] + 1; qu.push(y); } } return d[t]; };
  let checked = 0, found = 0, nullOk = 0;
  for (let i = 0; i < 40; i++) {
    const s = names[Math.floor(rnd() * N)], t = names[Math.floor(rnd() * N)]; if (s === t) continue;
    const truth = dist(s, t), r = await findRoute(s, t, { maxPar: 4, verifyCap: 1e6, b2Mids: 1e6 });
    if (truth !== undefined && truth <= 4) {
      assert(r, `${s}->${t} expected par ${truth}`); assert.strictEqual(r.par, truth, `${s}->${t} par ${r.par} != ${truth}`);
      r.route.forEach((x, k) => k && assert(body[r.route[k - 1]].has(x), `hop ${r.route[k - 1]}->${x} is not a playable link`)); found++;
    } else { assert.strictEqual(r, null, `${s}->${t} expected none, got ${r && r.par}`); nullOk++; }
    checked++;
  }
  // build-pool extraction
  const pool = extract('<div class="mw-parser-output"><h2>Arts <span>(10)</span></h2><ul>' + Array.from({ length: 6 }, (_, i) => `<li><a href="/wiki/Art_${i}">x</a> – <a href="/wiki/Other">d</a></li>`).join('') + '<li><a href="/wiki/List_of_x">l</a></li><li><a href="/wiki/Category:C">c</a></li></ul></div>');
  assert.deepStrictEqual(Object.keys(pool), ['Arts']); assert.strictEqual(pool.Arts.length, 6);
  console.log(`ok: ${checked} pairs (${found} routes matched brute-force par, ${nullOk} correctly rejected); pool extract ok`);
  // end-to-end: schedule builder writes puzzles.json
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiio-out-')), poolF = path.join(tmp, 'pool.json'), outF = path.join(tmp, 'puzzles.json');
  fs.writeFileSync(poolF, JSON.stringify({ A: names.slice(0, 60), B: names.slice(60) }));
  await new Promise((res, rej) => require('child_process').spawn(process.execPath, [path.join(__dirname, 'build-puzzles.js'), '--pool', poolF, '--out', outF, '--days', '4', '--from', '2030-01-01'], { env: process.env, stdio: 'ignore' }).on('exit', c => c === 0 ? res() : rej(new Error('build-puzzles exited ' + c))));
  const doc = JSON.parse(fs.readFileSync(outF, 'utf8')), days = Object.keys(doc.days);
  assert.strictEqual(days.length, 4);
  days.forEach(d => { const e = doc.days[d]; assert.strictEqual(e.route.length - 1, e.par); assert(e.par >= 2 && e.par <= 4); e.route.forEach((x, k) => k && assert(body[e.route[k - 1]].has(x))); });
  const { build } = require('./build-packs');
  const pk = await build([{ id: 't', puzzles: [{ from: names[1], to: names[2] }, { from: names[3], to: names[3] }] }], { maxPar: 4 });
  assert.strictEqual(pk.t.length, 2); assert.strictEqual(pk.t[1], null);
  if (pk.t[0]) { assert.strictEqual(pk.t[0].route.length - 1, pk.t[0].par); }
  console.log('ok: build-packs returned', pk.t.map(x => x ? 'par ' + x.par : 'null').join(', '));
  console.log('ok: build-puzzles wrote', days.length, 'days:', days.map(d => `${d} par ${doc.days[d].par}`).join(', '));
  server.close();
});
