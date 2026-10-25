// Zero-dependency server: serves the game, stores scores, players and leagues in data.json.
// Usage: node server.js   (PORT env var optional)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data.json');
let db = { scores: {}, players: {}, leagues: {}, reports: [], activity: {}, counters: {}, overrides: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch {}

let pending = false;
function save() {
  if (pending) return; pending = true;
  setTimeout(() => { pending = false; fs.writeFile(DATA + '.tmp', JSON.stringify(db), err => { if (!err) fs.rename(DATA + '.tmp', DATA, () => {}); }); }, 200);
}

let stats = null; import('./worker/stats.js').then(m => { stats = m; });
let puzzleCheck = null; import('./worker/puzzle.js').then(m => { puzzleCheck = m; });
const utcDay = () => new Date().toISOString().slice(0, 10);
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|bingpreview|yandex|duckduck|pingdom|uptime|monitor|python|curl|wget|scrapy|axios|node-fetch|go-http|java\/|okhttp|libwww|httpclient|phantom|selenium|puppeteer/i, SRC_OK = /^[a-z0-9._:-]{1,40}$/i;
const bumpC = (day, k) => { db.counters = db.counters || {}; const key = day + '|' + k; db.counters[key] = (db.counters[key] || 0) + 1; };
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
const dayOk = day => DAY.test(day) && Math.abs(Date.parse(day + 'T12:00:00Z') - Date.now()) <= 48 * 3600e3;
const xpOf = pid => (db.players[pid] || {}).xp || 0;

function board(mode, day, league, purist) {
  let all = Object.values(db.scores);
  if (purist && mode !== 'streak') all = all.filter(e => e.purist);
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


// ---- streamer lobbies (same LobbyCore as the Worker's Durable Object) with a minimal WebSocket server ------------------
const crypto = require('crypto');
const lobbies = new Map();
let LobbyCore = null; const coreReady = import('./worker/lobby-core.js').then(m => { LobbyCore = m.LobbyCore; });
const rnd = (n, chars) => Array.from(crypto.randomBytes(n), x => chars[x % chars.length]).join('');
function wsFrame(str) {
  const p = Buffer.from(str), n = p.length;
  const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255])]);
  return Buffer.concat([h, p]);
}
function wsAttach(socket, lobby) {
  const conn = { send: s => { if (!socket.destroyed) socket.write(wsFrame(s)); } };
  let buf = Buffer.alloc(0);
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 15, masked = buf[1] & 128; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) return socket.destroy();
      if (buf.length < off + (masked ? 4 : 0) + len) return;
      const mask = masked ? buf.subarray(off, off + 4) : null; off += masked ? 4 : 0;
      const payload = Buffer.from(buf.subarray(off, off + len)); if (mask) for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      buf = buf.subarray(off + len);
      if (op === 8) return socket.end();
      if (op === 9) { socket.write(Buffer.concat([Buffer.from([0x8a, len]), payload])); continue; }
      if (op === 1 && len < 2000) lobby.core.message(conn, payload.toString());
    }
  });
  const drop = () => lobby.core.leave(conn); socket.on('close', drop); socket.on('error', drop);
  lobby.core.join(conn);
}
setInterval(() => { const t = Date.now(); for (const [c, l] of lobbies) if (l.core.idle() && t - l.core.lastActive > 6 * 3600e3) lobbies.delete(c); }, 600000).unref();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), q = url.searchParams;
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type'); res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  if (url.pathname === '/api/lobby' && req.method === 'POST') {
    if (limited(req.socket.remoteAddress)) return json(res, 429, { error: 'slow down' });
    return readBody(req, async b => {
      await coreReady;
      for (let i = 0; i < 6; i++) {
        const code = rnd(5, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'); if (lobbies.has(code)) continue;
        const key = rnd(20, 'abcdefghijklmnopqrstuvwxyz0123456789'), core = new LobbyCore({ code, hostKey: key });
        if (!b || !core.setPuzzle({ from: b.from, to: b.to, par: b.par })) return json(res, 400, { error: 'invalid puzzle' });
        lobbies.set(code, { core }); bumpC(utcDay(), 'lobby'); save(); return json(res, 200, { code, key });
      }
      json(res, 503, { error: 'try again' });
    });
  }
  { const m = url.pathname.match(/^\/api\/lobby\/([A-Za-z0-9]{4,8})$/); if (m && req.method === 'GET') { const l = lobbies.get(m[1].toUpperCase()); return l ? json(res, 200, { code: l.core.code, phase: l.core.phase, n: l.core.players.size }) : json(res, 404, { error: 'no such lobby' }); } }
  if (url.pathname === '/api/daily' && req.method === 'GET') {
    const day = q.get('day') || ''; if (!DAY.test(day)) return json(res, 400, { error: 'invalid' });
    if (day > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) return json(res, 404, { error: 'none' });   // picks stay secret until the day before
    const o = (db.overrides || {})[day]; return o ? json(res, 200, o) : json(res, 404, { error: 'none' });
  }
  if (url.pathname === '/api/admin/daily' && req.method === 'GET') {
    const key = process.env.ADMIN_KEY; if (!key) return json(res, 404, { error: 'not found' });
    if ((req.headers.authorization || '') !== 'Bearer ' + key) return json(res, 401, { error: 'unauthorised' });
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    return json(res, 200, Object.values(db.overrides || {}).filter(o => o.day >= since).sort((a, b) => (a.day < b.day ? -1 : 1)));
  }
  if (url.pathname === '/api/admin/daily' && req.method === 'POST') {
    const key = process.env.ADMIN_KEY; if (!key) return json(res, 404, { error: 'not found' });
    if ((req.headers.authorization || '') !== 'Bearer ' + key) return json(res, 401, { error: 'unauthorised' });
    return readBody(req, b => {
      if (!b || !puzzleCheck) return json(res, 400, { error: 'invalid' });
      db.overrides = db.overrides || {};
      if (b.remove) { if (!DAY.test(b.day)) return json(res, 400, { error: 'bad day' }); delete db.overrides[b.day]; save(); return json(res, 200, { ok: true }); }
      const c = puzzleCheck.checkOverride(b); if (!c.ok) return json(res, 400, { error: c.error });
      db.overrides[c.value.day] = c.value; save(); json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/admin/stats' && req.method === 'GET') {
    const key = process.env.ADMIN_KEY; if (!key) return json(res, 404, { error: 'not found' });
    if ((req.headers.authorization || '') !== 'Bearer ' + key) return json(res, 401, { error: 'unauthorised' });
    if (!stats) return json(res, 503, { error: 'starting' });
    const days = Math.max(1, Math.min(120, parseInt(q.get('days'), 10) || 30)), act = Object.values(db.activity || {}), firsts = new Map();
    for (const r of act) if (!firsts.has(r.pid) || r.day < firsts.get(r.pid)) firsts.set(r.pid, r.day);
    return json(res, 200, stats.computeStats({ today: utcDay(), days, activity: act, firsts, acq: Object.entries(db.acq || {}).map(([pid, a]) => ({ pid, ...a })), counters: Object.entries(db.counters || {}).map(([k, n]) => { const [day, ...rest] = k.split('|'); return { day, k: rest.join('|'), n }; }), scores: Object.values(db.scores), orders: [], reports: (db.reports || []).slice().reverse() }));
  }
  if (url.pathname === '/api/admin/exclude' && req.method === 'POST') {
    const key = process.env.ADMIN_KEY; if (!key || (req.headers.authorization || '') !== 'Bearer ' + key) return json(res, 401, { error: 'unauthorised' });
    return readBody(req, b => {
      if (!b || !/^[a-z0-9]{6,16}$/.test(b.pid)) return json(res, 400, { error: 'invalid' });
      db.excluded = db.excluded || {}; db.acq = db.acq || {};
      if (b.on === false) delete db.excluded[b.pid]; else { db.excluded[b.pid] = Date.now(); delete db.acq[b.pid]; for (const k of Object.keys(db.activity || {})) if (db.activity[k].pid === b.pid) delete db.activity[k]; }
      save(); json(res, 200, { ok: true, excluded: b.on !== false });
    });
  }
  if (url.pathname === '/api/event' && req.method === 'POST') {
    if (limited(req.socket.remoteAddress)) return json(res, 429, { error: 'slow down' });
    return readBody(req, b => {
      if (!b) return json(res, 400, { error: 'invalid' });
      const day = utcDay();
      const ua = req.headers['user-agent'] || '', src = SRC_OK.test(b.src || '') ? String(b.src).toLowerCase() : '', camp = SRC_OK.test(b.camp || '') ? String(b.camp).toLowerCase() : '';
      if (BOT_UA.test(ua) || !ua) { bumpC(day, 'bot'); save(); return json(res, 200, { ok: true }); }
      if (b.e === 'visit') { bumpC(day, 'visit'); bumpC(day, 's:' + (src || 'direct')); bumpC(day, b.ret ? 'vr' : 'vn'); if (camp) bumpC(day, 'm:' + camp); if (['mobile', 'desktop'].includes(b.dev)) bumpC(day, 'd:' + b.dev); const cc = String(req.headers['cf-ipcountry'] || '').toUpperCase(); if (/^[A-Z]{2}$/.test(cc)) bumpC(day, 'c:' + cc); save(); return json(res, 200, { ok: true }); }
      if (!/^[a-z0-9]{6,16}$/.test(b.pid) || !['start', 'finish', 'share'].includes(b.e) || (b.mode && !['daily', 'practice', 'pack', 'challenge', 'live'].includes(b.mode))) return json(res, 400, { error: 'invalid' });
      if ((db.excluded || {})[b.pid]) return json(res, 200, { ok: true, excluded: true });
      db.acq = db.acq || {}; if (!db.acq[b.pid]) db.acq[b.pid] = { src: src || 'direct', camp, first_day: day };
      db.activity = db.activity || {}; const key = day + ':' + b.pid, r = db.activity[key] || (db.activity[key] = { day, pid: b.pid, started: 0, finished: 0, daily_started: 0, daily_won: 0, shared: 0 }), daily = b.mode === 'daily';
      if (b.e === 'start' || b.e === 'finish') r.started = 1; if (b.e === 'finish') r.finished = 1; if (daily && b.e !== 'share') r.daily_started = 1; if (daily && b.e === 'finish') r.daily_won = 1; if (b.e === 'share') r.shared = 1;
      save(); json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/reports' && req.method === 'GET') {
    const key = process.env.ADMIN_KEY; if (!key) return json(res, 404, { error: 'not found' });
    if ((req.headers.authorization || '') !== 'Bearer ' + key) return json(res, 401, { error: 'unauthorised' });
    return json(res, 200, db.reports.slice(-100).reverse().map(({ pid, ...r }) => r));
  }
  if (url.pathname === '/api/report' && req.method === 'POST') {
    if (limited(req.socket.remoteAddress)) return json(res, 429, { error: 'slow down' });
    return readBody(req, b => {
      const t = x => String(x || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80), note = String((b && b.note) || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 200);
      if (!b || !t(b.from) || !t(b.to) || !['unsolvable', 'offensive', 'broken', 'other'].includes(b.reason) || !['daily', 'practice', 'pack', 'challenge', 'live'].includes(b.mode) || (b.day && !DAY.test(b.day)) || (b.pid && !/^[a-z0-9]{6,16}$/.test(b.pid))) return json(res, 400, { error: 'invalid' });
      db.reports = (db.reports || []).concat({ id: Date.now(), created_at: Date.now(), day: b.day || null, mode: b.mode, from_title: t(b.from), to_title: t(b.to), reason: b.reason, note, pid: b.pid || null }).slice(-1000);
      save(); json(res, 200, { ok: true });
    });
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
      delete db.players[b.pid]; if (db.acq) delete db.acq[b.pid]; db.reports = (db.reports || []).filter(r => r.pid !== b.pid); for (const k of Object.keys(db.activity || {})) if (db.activity[k].pid === b.pid) delete db.activity[k];
      for (const L of Object.values(db.leagues)) L.members = L.members.filter(m => m !== b.pid);
      save(); json(res, 200, { ok: true });
    });
  }
  if (url.pathname === '/api/entitlements' && req.method === 'GET') {
    const pid = q.get('pid') || ''; if (!/^[a-z0-9]{6,16}$/.test(pid)) return json(res, 400, { error: 'invalid' });
    return json(res, 200, { supporter: !!(db.supporters || {})[pid] });
  }
  if (url.pathname === '/api/dev/supporter' && req.method === 'POST' && process.env.DEV === '1') {   // local testing only; production uses signed payment webhooks (worker/)
    return readBody(req, b => { if (!b || !/^[a-z0-9]{6,16}$/.test(b.pid)) return json(res, 400, { error: 'invalid' }); (db.supporters = db.supporters || {})[b.pid] = b.on !== false; save(); json(res, 200, { ok: true }); });
  }
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });
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

      const ok = dayOk(b.day) && Number.isInteger(b.clicks) && b.clicks >= 1 && b.clicks <= 200 &&
        Number.isInteger(b.secs) && b.secs >= 1 && b.secs < 86400 && Number.isInteger(b.score) &&
        Array.isArray(b.path) && b.path.length >= 2 && b.path.length <= 300;
      if (!ok) return json(res, 400, { error: 'invalid' });
      const key = `${b.day}:${b.pid}`;
      if (!db.scores[key]) db.scores[key] = { pid: b.pid, day: b.day, clicks: b.clicks, secs: b.secs, score: Math.min(1000, b.score), path: cleanPath(b.path), purist: b.purist === true }; // first result of the day stands
      save(); json(res, 200, { ok: true });
    });
  }
  const TYPES = { '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html' };
  const STATIC = {}; ['/cats.js', '/clean.js', '/packs.js', '/config.js', '/legal.js', '/legal.css', '/styles.css', '/puzzles.json', '/pool.json', '/packs.json', '/privacy.html', '/terms.html', '/overlay.html', '/overlay.css', '/admin.html', '/admin-puzzles.html', '/admin.css', '/solver.js', '/wikiclient.js', '/favicon.svg', '/og.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png', '/manifest.webmanifest', '/ads.txt'].forEach(f => { STATIC[f] = TYPES[path.extname(f)]; });
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
server.on('upgrade', (req, socket) => {
  const m = new URL(req.url, 'http://x').pathname.match(/^\/api\/lobby\/([A-Za-z0-9]{4,8})\/ws$/), l = m && lobbies.get(m[1].toUpperCase()), k = req.headers['sec-websocket-key'];
  if (!l || !k) return socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(k + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
  wsAttach(socket, l);
});
server.listen(PORT, () => console.log(`Scorcher running on http://localhost:${PORT}`));
