// Zero-dependency server: serves the game, stores scores, players and leagues in data.json.
// Usage: node server.js   (PORT env var optional)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data.json');
let db = { scores: {}, players: {}, leagues: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch {}

let pending = false;
function save() {
  if (pending) return; pending = true;
  setTimeout(() => { pending = false; fs.writeFile(DATA + '.tmp', JSON.stringify(db), err => { if (!err) fs.rename(DATA + '.tmp', DATA, () => {}); }); }, 200);
}

const hits = new Map();
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000);
  a.push(now); hits.set(ip, a); return a.length > 40;
}
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = (req, cb) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 8000) req.destroy(); }); req.on('end', () => { try { cb(JSON.parse(raw)); } catch { cb(null); } }); };
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function shift(day, n) { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
const cleanPath = a => (Array.isArray(a) ? a : []).slice(0, 16).map(x => String(x).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80));
const xpOf = pid => (db.players[pid] || {}).xp || 0;

function board(mode, day, league, purist) {
  let all = Object.values(db.scores);
  if (purist) all = all.filter(e => e.purist);
  if (league) {
    const L = db.leagues[league]; if (!L) return [];
    const set = new Set(L.members); all = all.filter(e => set.has(e.pid));
  }
  const nameOf = pid => (db.players[pid] || {}).name || 'Player';
  if (mode === 'streak') {
    const by = {};
    for (const e of all) (by[e.pid] || (by[e.pid] = new Set())).add(e.day);
    return Object.entries(by).map(([pid, days]) => {
      let d = days.has(day) ? day : shift(day, -1), n = 0;
      while (days.has(d)) { n++; d = shift(d, -1); }
      return { pid, name: nameOf(pid), xp: xpOf(pid), streak: n };
    }).filter(r => r.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 50);
  }
  if (mode === 'all' || mode === 'week') {
    const week = new Set(Array.from({ length: 7 }, (_, i) => shift(day, -i)));
    const by = {};
    for (const e of all) {
      if (mode === 'week' && !week.has(e.day)) continue;
      const b = by[e.pid] || (by[e.pid] = { pid: e.pid, name: nameOf(e.pid), xp: xpOf(e.pid), points: 0, days: 0 });
      b.points += e.score; b.days++;
    }
    return Object.values(by).sort((a, b) => b.points - a.points).slice(0, 50);
  }
  return all.filter(e => e.day === day).sort((a, b) => a.clicks - b.clicks || a.secs - b.secs).slice(0, 50)
    .map(e => ({ pid: e.pid, name: nameOf(e.pid), xp: xpOf(e.pid), clicks: e.clicks, secs: e.secs, purist: !!e.purist }));
}

// Aggregated routes for the "path map": every prefix of every finisher's route, with counts.
function pathTree(day) {
  const rows = Object.values(db.scores).filter(e => e.day === day && Array.isArray(e.path) && e.path.length > 1);
  const nodes = new Map();
  for (const e of rows) for (let i = 1; i <= e.path.length; i++) {
    const k = e.path.slice(0, i).join('\u0001'), x = nodes.get(k) || { p: e.path.slice(0, i), n: 0 };
    x.n++; nodes.set(k, x);
  }
  const kids = new Map();   // keep the 4 busiest children per parent so the payload stays small
  for (const x of nodes.values()) { const pk = x.p.slice(0, -1).join('\u0001'); (kids.get(pk) || kids.set(pk, []).get(pk)).push(x); }
  const keep = [];
  for (const list of kids.values()) keep.push(...list.sort((a, b) => b.n - a.n).slice(0, 4));
  const clicks = rows.map(e => e.clicks), best = Math.min(...clicks);
  return { total: rows.length, avg: rows.length ? clicks.reduce((a, b) => a + b, 0) / rows.length : 0, best: rows.length ? best : 0, bestCount: clicks.filter(c => c === best).length, nodes: keep };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), q = url.searchParams;
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type'); res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const day = DAY.test(q.get('day') || '') ? q.get('day') : new Date().toISOString().slice(0, 10);
    const mode = ['day', 'week', 'all', 'streak'].includes(q.get('mode')) ? q.get('mode') : 'day';
    return json(res, 200, board(mode, day, (q.get('league') || '').toUpperCase(), q.get('purist') === '1'));
  }
  if (url.pathname === '/api/paths' && req.method === 'GET') {
    const day = DAY.test(q.get('day') || '') ? q.get('day') : new Date().toISOString().slice(0, 10);
    return json(res, 200, pathTree(day));
  }
  if (url.pathname === '/api/delete' && req.method === 'POST') {
    if (limited(req.socket.remoteAddress)) return json(res, 429, { error: 'slow down' });
    return readBody(req, b => {
      if (!b || !/^[a-z0-9]{6,16}$/.test(b.pid)) return json(res, 400, { error: 'invalid' });
      for (const k of Object.keys(db.scores)) if (db.scores[k].pid === b.pid) delete db.scores[k];
      delete db.players[b.pid];
      for (const L of Object.values(db.leagues)) L.members = L.members.filter(m => m !== b.pid);
      save(); json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/league' && req.method === 'GET') {
    const L = db.leagues[(q.get('code') || '').toUpperCase()];
    return L ? json(res, 200, { name: L.name, members: L.members.length }) : json(res, 404, { error: 'no such league' });
  }
  if (req.method === 'POST' && (url.pathname === '/api/score' || url.pathname === '/api/league')) {
    if (limited(req.socket.remoteAddress)) return json(res, 429, { error: 'slow down' });
    return readBody(req, b => {
      if (!b) return json(res, 400, { error: 'bad json' });
      const name = cleanName(b.name);
      if (!/^[a-z0-9]{6,16}$/.test(b.pid) || !name) return json(res, 400, { error: 'invalid' });
      const xp = Number.isInteger(b.xp) && b.xp >= 0 && b.xp < 1e6 ? b.xp : 0;
      db.players[b.pid] = { name, xp: Math.max(xp, xpOf(b.pid)) };

      if (url.pathname === '/api/league') {
        const code = String(b.code || '').toUpperCase();
        if (!/^[A-Z0-9]{4,8}$/.test(code)) return json(res, 400, { error: 'invalid code' });
        let L = db.leagues[code];
        if (!L) {
          const lname = cleanName(b.leagueName);
          if (!lname) return json(res, 404, { error: 'no such league' });
          L = db.leagues[code] = { name: lname, members: [] };
        }
        if (!L.members.includes(b.pid)) { if (L.members.length >= 200) return json(res, 400, { error: 'league full' }); L.members.push(b.pid); }
        save(); return json(res, 200, { code, name: L.name, members: L.members.length });
      }

      const ok = DAY.test(b.day) && Number.isInteger(b.clicks) && b.clicks >= 1 && b.clicks <= 200 &&
        Number.isInteger(b.secs) && b.secs >= 1 && b.secs < 86400 && Number.isInteger(b.score) &&
        Array.isArray(b.path) && b.path.length >= 2 && b.path.length <= 300;
      if (!ok) return json(res, 400, { error: 'invalid' });
      const key = `${b.day}:${b.pid}`;
      if (!db.scores[key]) db.scores[key] = { pid: b.pid, day: b.day, clicks: b.clicks, secs: b.secs, score: Math.min(1000, b.score), path: cleanPath(b.path), purist: b.purist === true }; // first result of the day stands
      save(); json(res, 200, { ok: true });
    });
  }
  const TYPES = { '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html' };
  const STATIC = {}; ['/cats.js', '/clean.js', '/packs.js', '/config.js', '/legal.js', '/legal.css', '/styles.css', '/puzzles.json', '/pool.json', '/packs.json', '/privacy.html', '/terms.html'].forEach(f => { STATIC[f] = TYPES[path.extname(f)]; });
  const ft = url.pathname.match(/^\/fonts\/([\w.-]+\.(woff2|txt))$/);
  if (req.method === 'GET' && ft) {
    return fs.readFile(path.join(__dirname, 'fonts', ft[1]), (e, buf) => {
      if (e) return json(res, 404, {});
      res.writeHead(200, { 'content-type': ft[2] === 'woff2' ? 'font/woff2' : 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' }); res.end(buf);
    });
  }
  if (req.method === 'GET' && STATIC[url.pathname]) {
    return fs.readFile(path.join(__dirname, url.pathname), (e, buf) => {
      if (e) return json(res, 404, {});
      res.writeHead(200, { 'content-type': STATIC[url.pathname] + '; charset=utf-8', 'cache-control': 'no-cache' }); res.end(buf);
    });
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'index.html'), (e, buf) => {
      if (e) return json(res, 500, { error: 'missing index.html' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(buf);
    });
  }
  json(res, 404, { error: 'not found' });
});
server.listen(PORT, () => console.log(`wikilink running on http://localhost:${PORT}`));
