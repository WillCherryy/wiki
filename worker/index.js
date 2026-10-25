// Scorcher API for Cloudflare Workers + D1.
// Same contract as the local dev server (server.js); tools/test-api.js runs one test against both.
const DAY = /^\d{4}-\d{2}-\d{2}$/, PID = /^[a-z0-9]{6,16}$/, CODE = /^[A-Z0-9]{4,8}$/;
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
const cleanPath = a => (Array.isArray(a) ? a : []).slice(0, 16).map(x => String(x).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80));
const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const hits = new Map(); // best-effort per-isolate rate limit; add a Cloudflare rate-limiting rule for real protection

import SCHEMA from './schema.js';
import { computeStats } from './stats.js';
import { checkOverride } from './puzzle.js';
export { Lobby } from './lobby.js';
let ready;

export default {
  async fetch(request, env) {
    const now = () => (env.TEST_NOW ? Number(env.TEST_NOW) : Date.now());
    const cors = { 'access-control-allow-origin': env.ALLOWED_ORIGIN || '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url), q = url.searchParams, path = url.pathname;
    if (!path.startsWith('/api/') && env.ASSETS) return env.ASSETS.fetch(request);   // everything else is the static site
    if (path.startsWith('/api/lobby')) return lobbyRoute(request, env, path, request.method, reply, now());
    try {
      if (!env.DB) return reply({ error: 'database not set up' }, 503);
      if (!ready) ready = env.DB.batch(SCHEMA.map(s => env.DB.prepare(s))).catch(e => { ready = null; throw e; });
      await ready;
      if (request.method === 'GET') {
        if (path === '/api/leaderboard') return reply(await leaderboard(env, q, now()));
        if (path === '/api/paths') return reply(await pathTree(env, dayParam(q, now())));
        if (path === '/api/league') { const L = await league(env, (q.get('code') || '').toUpperCase()); return L ? reply(L) : reply({ error: 'no such league' }, 404); }
        if (path === '/api/entitlements') { const pid = q.get('pid') || ''; return PID.test(pid) ? reply({ supporter: await isSupporter(env, pid) }) : reply({ error: 'invalid' }, 400); }
        if (path === '/api/health') return reply({ ok: true });
        if (path === '/api/reports') return await getReports(env, request, reply);
        if (path === '/api/admin/stats') return await adminStats(env, request, q, now(), reply);
        if (path === '/api/daily') return await getDaily(env, q.get('day') || '', reply);
        if (path === '/api/admin/daily') return await listOverrides(env, request, now(), reply);
        return reply({ error: 'not found' }, 404);
      }
      if (request.method !== 'POST') return reply({ error: 'not found' }, 404);
      const raw = await request.text();
      if (path.startsWith('/api/webhook/')) return await webhook(path.split('/').pop(), raw, request, env, now(), reply);
      const ip = request.headers.get('cf-connecting-ip') || 'x', t = now(), list = (hits.get(ip) || []).filter(x => t - x < 60000); list.push(t); hits.set(ip, list);
      if (list.length > 60) return reply({ error: 'slow down' }, 429);
      if (raw.length > 8000) return reply({ error: 'too large' }, 413);
      let b; try { b = JSON.parse(raw); } catch { return reply({ error: 'bad json' }, 400); }
      if (!b || typeof b !== 'object') return reply({ error: 'bad json' }, 400);
      if (path === '/api/score') return await postScore(env, b, now(), reply);
      if (path === '/api/league') return await postLeague(env, b, now(), reply);
      if (path === '/api/delete') return await postDelete(env, b, reply);
      if (path === '/api/report') return await postReport(env, b, now(), reply);
      if (path === '/api/event') return await postEvent(env, b, request, now(), reply);
      if (path === '/api/admin/daily') return await postOverride(env, b, request, now(), reply);
      if (path === '/api/admin/exclude') return await postExclude(env, b, request, reply);
      return reply({ error: 'not found' }, 404);
    } catch (e) { return reply({ error: 'server error' }, 500); }
  }
};

const dayParam = (q, t) => (DAY.test(q.get('day') || '') ? q.get('day') : new Date(t).toISOString().slice(0, 10));
const dayOk = (day, t) => DAY.test(day) && Math.abs(Date.parse(day + 'T12:00:00Z') - t) <= 48 * 3600e3;
const isSupporter = async (env, pid) => !!(await env.DB.prepare('SELECT 1 AS x FROM orders WHERE pid = ? LIMIT 1').bind(pid).first());
async function upsertPlayer(env, pid, name, xp, t) {
  await env.DB.prepare('INSERT INTO players (pid, name, xp, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET name = excluded.name, xp = MAX(players.xp, excluded.xp)').bind(pid, name, xp, t).run();
}
const playerFields = b => ({ name: cleanName(b.name), xp: Number.isInteger(b.xp) && b.xp >= 0 && b.xp < 1e6 ? b.xp : 0 });

async function postScore(env, b, t, reply) {
  const { name, xp } = playerFields(b);
  const ok = PID.test(b.pid) && name && dayOk(b.day, t) && Number.isInteger(b.clicks) && b.clicks >= 1 && b.clicks <= 200 &&
    Number.isInteger(b.secs) && b.secs >= 1 && b.secs < 86400 && Number.isInteger(b.score) && Array.isArray(b.path) && b.path.length >= 2 && b.path.length <= 300;
  if (!ok) return reply({ error: 'invalid' }, 400);
  await upsertPlayer(env, b.pid, name, xp, t);
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO scores (day, pid, clicks, secs, score, purist, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(b.day, b.pid, b.clicks, b.secs, Math.min(1000, Math.max(0, b.score)), b.purist === true ? 1 : 0, JSON.stringify(cleanPath(b.path)), t).run();
  if (ins.meta && ins.meta.changes === 1) await bumpStreak(env, b.pid, b.day);   // the first result of the day stands
  return reply({ ok: true });
}
async function bumpStreak(env, pid, day) {
  const p = await env.DB.prepare('SELECT streak, last_day, shield FROM players WHERE pid = ?').bind(pid).first(); if (!p) return;
  if (p.last_day && day <= p.last_day) return;
  let streak = 1, shield = p.shield || null;
  if (p.last_day === shift(day, -1)) streak = p.streak + 1;
  else if (p.last_day === shift(day, -2) && p.shield !== day.slice(0, 7) && await isSupporter(env, pid)) { streak = p.streak + 1; shield = day.slice(0, 7); }  // supporter streak shield, once a month
  await env.DB.prepare('UPDATE players SET streak = ?, last_day = ?, shield = ? WHERE pid = ?').bind(streak, day, shield, pid).run();
}

async function leaderboard(env, q, t) {
  const day = dayParam(q, t), mode = ['day', 'week', 'all', 'streak'].includes(q.get('mode')) ? q.get('mode') : 'day', code = (q.get('league') || '').toUpperCase(), purist = q.get('purist') === '1';
  const args = [], inLeague = col => { if (!code) return ''; args.push(code); return ` AND ${col} IN (SELECT pid FROM league_members WHERE code = ?)`; };
  if (code && !(await league(env, code))) return [];
  if (mode === 'streak') {
    args.push(shift(day, -1));
    const sql = `SELECT pid, name, xp, streak FROM players WHERE streak > 0 AND last_day >= ?${inLeague('pid')} ORDER BY streak DESC, name LIMIT 50`;
    return (await env.DB.prepare(sql).bind(...args).all()).results;
  }
  if (mode === 'day') {
    args.push(day);
    const sql = `SELECT s.pid AS pid, p.name AS name, p.xp AS xp, s.clicks AS clicks, s.secs AS secs, s.purist AS purist FROM scores s JOIN players p ON p.pid = s.pid WHERE s.day = ?${purist ? ' AND s.purist = 1' : ''}${inLeague('s.pid')} ORDER BY s.clicks, s.secs, s.created_at LIMIT 50`;
    return (await env.DB.prepare(sql).bind(...args).all()).results.map(r => ({ ...r, purist: !!r.purist }));
  }
  let where = '1 = 1'; if (mode === 'week') { where = 's.day BETWEEN ? AND ?'; args.push(shift(day, -6), day); }
  const sql = `SELECT s.pid AS pid, p.name AS name, p.xp AS xp, SUM(s.score) AS points, COUNT(*) AS days FROM scores s JOIN players p ON p.pid = s.pid WHERE ${where}${purist ? ' AND s.purist = 1' : ''}${inLeague('s.pid')} GROUP BY s.pid ORDER BY points DESC, name LIMIT 50`;
  return (await env.DB.prepare(sql).bind(...args).all()).results;
}

async function league(env, code) {
  if (!CODE.test(code)) return null;
  const L = await env.DB.prepare('SELECT name FROM leagues WHERE code = ?').bind(code).first(); if (!L) return null;
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM league_members WHERE code = ?').bind(code).first();
  return { name: L.name, members: n.n };
}
async function postLeague(env, b, t, reply) {
  const { name, xp } = playerFields(b), code = String(b.code || '').toUpperCase();
  if (!PID.test(b.pid) || !name) return reply({ error: 'invalid' }, 400);
  if (!CODE.test(code)) return reply({ error: 'invalid code' }, 400);
  let L = await league(env, code);
  if (!L) {
    const lname = cleanName(b.leagueName); if (!lname) return reply({ error: 'no such league' }, 404);
    await env.DB.prepare('INSERT OR IGNORE INTO leagues (code, name, created_at) VALUES (?, ?, ?)').bind(code, lname, t).run(); L = await league(env, code);
  }
  const member = await env.DB.prepare('SELECT 1 AS x FROM league_members WHERE code = ? AND pid = ?').bind(code, b.pid).first();
  if (!member && L.members >= 200) return reply({ error: 'league full' }, 400);
  await upsertPlayer(env, b.pid, name, xp, t);
  await env.DB.prepare('INSERT OR IGNORE INTO league_members (code, pid) VALUES (?, ?)').bind(code, b.pid).run();
  const after = await league(env, code); return reply({ code, name: after.name, members: after.members });
}
async function postDelete(env, b, reply) {
  if (!PID.test(b.pid)) return reply({ error: 'invalid' }, 400);
  await ensureAnalytics(env);
  await env.DB.batch([env.DB.prepare('DELETE FROM acq WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM scores WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM reports WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM activity WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM league_members WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM players WHERE pid = ?').bind(b.pid)]);
  return reply({ ok: true });
}

// Aggregated routes for the path map: every prefix of every finisher's route, with counts.
async function pathTree(env, day) {
  const rows = (await env.DB.prepare('SELECT clicks, path FROM scores WHERE day = ? LIMIT 5000').bind(day).all()).results.map(r => ({ clicks: r.clicks, path: JSON.parse(r.path) })).filter(r => r.path.length > 1);
  const nodes = new Map();
  for (const e of rows) for (let i = 1; i <= e.path.length; i++) { const k = e.path.slice(0, i).join('\u0001'), x = nodes.get(k) || { p: e.path.slice(0, i), n: 0 }; x.n++; nodes.set(k, x); }
  const kids = new Map();
  for (const x of nodes.values()) { const pk = x.p.slice(0, -1).join('\u0001'); (kids.get(pk) || kids.set(pk, []).get(pk)).push(x); }
  const keep = []; for (const list of kids.values()) keep.push(...list.sort((a, b) => b.n - a.n).slice(0, 4));
  const clicks = rows.map(e => e.clicks), best = rows.length ? Math.min(...clicks) : 0;
  return { total: rows.length, avg: rows.length ? clicks.reduce((a, b) => a + b, 0) / rows.length : 0, best, bestCount: clicks.filter(c => c === best).length, nodes: keep };
}

// ---- payments: signed webhooks from the payment provider record a purchase against the buyer's anonymous player ID
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}
const safeEqual = (a, b) => { a = String(a).trim(); b = String(b).trim(); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function recordOrder(env, provider, id, pid, t) {
  if (!id || !PID.test(pid || '')) return false;
  await env.DB.prepare('INSERT OR IGNORE INTO orders (id, provider, pid, created_at) VALUES (?, ?, ?, ?)').bind(String(id), provider, pid, t).run(); return true;
}
async function webhook(provider, raw, request, env, t, reply) {
  if (raw.length > 200000) return reply({ error: 'too large' }, 413);
  let evt;
  if (provider === 'lemonsqueezy') {
    if (!env.LS_SIGNING_SECRET) return reply({ error: 'not configured' }, 404);
    const sig = request.headers.get('x-signature') || '';
    if (!safeEqual(sig, await hmacHex(env.LS_SIGNING_SECRET, raw))) return reply({ error: 'bad signature' }, 401);
    try { evt = JSON.parse(raw); } catch { return reply({ error: 'bad json' }, 400); }
    const name = evt.meta && evt.meta.event_name, pid = evt.meta && evt.meta.custom_data && evt.meta.custom_data.pid, d = evt.data || {};
    if (name === 'order_created' && d.attributes && d.attributes.status === 'paid') await recordOrder(env, provider, d.id, pid, t);
    if (name === 'order_refunded') await env.DB.prepare('DELETE FROM orders WHERE provider = ? AND id = ?').bind(provider, String(d.id)).run();
    return reply({ ok: true });
  }
  if (provider === 'stripe') {
    if (!env.STRIPE_WEBHOOK_SECRET) return reply({ error: 'not configured' }, 404);
    const parts = Object.fromEntries((request.headers.get('stripe-signature') || '').split(',').map(x => x.split('=')).filter(x => x.length === 2));
    if (!parts.t || !parts.v1 || Math.abs(t / 1000 - Number(parts.t)) > 300) return reply({ error: 'bad signature' }, 401);
    if (!safeEqual(parts.v1, await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${parts.t}.${raw}`))) return reply({ error: 'bad signature' }, 401);
    try { evt = JSON.parse(raw); } catch { return reply({ error: 'bad json' }, 400); }
    const o = evt.data && evt.data.object || {};
    // the order id is the PaymentIntent, so a later refund event (which carries the same id) can find and remove it
    if (evt.type === 'checkout.session.completed' && o.payment_status === 'paid') await recordOrder(env, provider, o.payment_intent || o.id, o.client_reference_id, t);
    if (evt.type === 'charge.refunded' && o.refunded && o.payment_intent) await env.DB.prepare('DELETE FROM orders WHERE provider = ? AND id = ?').bind(provider, String(o.payment_intent)).run();
    return reply({ ok: true });
  }
  return reply({ error: 'not found' }, 404);
}

// ---- streamer lobbies (Durable Object, no database needed) ------------------------------------------------------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomString = (n, chars) => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => chars[x % chars.length]).join('');
async function lobbyRoute(request, env, path, method, reply, t) {
  if (!env.LOBBY) return reply({ error: 'lobbies not set up' }, 503);
  if (path === '/api/lobby' && method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'x', list = (hits.get('L' + ip) || []).filter(x => t - x < 3600e3); list.push(t); hits.set('L' + ip, list);
    if (list.length > 20) return reply({ error: 'slow down' }, 429);
    let b; try { b = await request.json(); } catch { return reply({ error: 'bad json' }, 400); }
    const puzzle = { from: b && b.from, to: b && b.to, par: b && b.par };
    for (let i = 0; i < 6; i++) {
      const code = randomString(5, ALPHABET), key = randomString(20, 'abcdefghijklmnopqrstuvwxyz0123456789');
      const res = await env.LOBBY.get(env.LOBBY.idFromName(code)).fetch('https://lobby/init', { method: 'POST', body: JSON.stringify({ code, hostKey: key, puzzle }) });
      if (res.status === 409) continue;
      if (res.ok && env.DB && ready) await bump(env, new Date(t).toISOString().slice(0, 10), 'lobby').run().catch(() => {});
      return res.ok ? reply({ code, key }) : reply({ error: 'invalid puzzle' }, 400);
    }
    return reply({ error: 'try again' }, 503);
  }
  const m = path.match(/^\/api\/lobby\/([A-Za-z0-9]{4,8})(\/ws)?$/); if (!m || method !== 'GET') return reply({ error: 'not found' }, 404);
  const stub = env.LOBBY.get(env.LOBBY.idFromName(m[1].toUpperCase()));
  const res = await stub.fetch(new Request('https://lobby' + (m[2] || '/info'), request));
  if (m[2]) return res;   // websocket upgrade response passes straight through
  return res.ok ? reply(await res.json()) : reply({ error: 'no such lobby' }, 404);
}

// ---- puzzle reports ----------------------------------------------------------------------------------------------
const REASONS = ['unsolvable', 'offensive', 'broken', 'other'], MODES = ['daily', 'practice', 'pack', 'challenge', 'live'];
const cleanTitle = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
async function postReport(env, b, t, reply) {
  const from = cleanTitle(b.from), to = cleanTitle(b.to), note = String(b.note || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 200);
  if (!from || !to || !REASONS.includes(b.reason) || !MODES.includes(b.mode) || (b.day && !DAY.test(b.day)) || (b.pid && !PID.test(b.pid))) return reply({ error: 'invalid' }, 400);
  await env.DB.prepare('INSERT INTO reports (created_at, day, mode, from_title, to_title, reason, note, pid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(t, b.day || null, b.mode, from, to, b.reason, note, b.pid || null).run();
  return reply({ ok: true });
}
async function getReports(env, request, reply) {
  const given = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!env.ADMIN_KEY) return reply({ error: 'not found' }, 404);
  if (!safeEqual(given, env.ADMIN_KEY)) return reply({ error: 'unauthorised' }, 401);
  return reply((await env.DB.prepare('SELECT id, created_at, day, mode, from_title, to_title, reason, note FROM reports ORDER BY id DESC LIMIT 100').all()).results);
}

// ---- anonymous usage events + founder stats ----------------------------------------------------------------------
const bump = (env, day, k) => env.DB.prepare('INSERT INTO counters (day, k, n) VALUES (?, ?, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1').bind(day, k);
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|bingpreview|yandex|duckduck|pingdom|uptime|monitor|python|curl|wget|scrapy|axios|node-fetch|go-http|java\/|okhttp|libwww|httpclient|phantom|selenium|puppeteer/i;
const SRC_OK = /^[a-z0-9._:-]{1,40}$/i, DEV_OK = ['mobile', 'desktop'];
let ensured = null;   // tables for traffic sources and excluded players are created on first use, so no manual migration is needed
const ensureAnalytics = env => ensured || (ensured = env.DB.batch([
  env.DB.prepare('CREATE TABLE IF NOT EXISTS acq (pid TEXT PRIMARY KEY, src TEXT NOT NULL, camp TEXT NOT NULL DEFAULT \'\', first_day TEXT NOT NULL)'),
  env.DB.prepare('CREATE TABLE IF NOT EXISTS excluded (pid TEXT PRIMARY KEY, created_at INTEGER NOT NULL)')
]).catch(e => { ensured = null; throw e; }));
async function postEvent(env, b, request, t, reply) {
  const day = new Date(t).toISOString().slice(0, 10);
  await ensureAnalytics(env);
  if (BOT_UA.test(request.headers.get('user-agent') || '') || !(request.headers.get('user-agent') || '')) { await bump(env, day, 'bot').run(); return reply({ ok: true }); }   // counted, never treated as players
  const src = SRC_OK.test(b.src || '') ? String(b.src).toLowerCase() : '', camp = SRC_OK.test(b.camp || '') ? String(b.camp).toLowerCase() : '';
  if (b.e === 'visit') {
    const cc = String(request.headers.get('cf-ipcountry') || '').toUpperCase();
    await env.DB.batch([bump(env, day, 'visit'), bump(env, day, 's:' + (src || 'direct')), bump(env, day, b.ret ? 'vr' : 'vn'),
      ...(camp ? [bump(env, day, 'm:' + camp)] : []), ...(DEV_OK.includes(b.dev) ? [bump(env, day, 'd:' + b.dev)] : []), ...(/^[A-Z]{2}$/.test(cc) ? [bump(env, day, 'c:' + cc)] : [])]);   // aggregate only: no IP, no player id
    return reply({ ok: true });
  }
  if (!PID.test(b.pid) || !['start', 'finish', 'share'].includes(b.e) || (b.mode && !MODES.includes(b.mode))) return reply({ error: 'invalid' }, 400);
  if (await env.DB.prepare('SELECT 1 FROM excluded WHERE pid = ?').bind(b.pid).first()) return reply({ ok: true, excluded: true });   // the founder's own devices
  const daily = b.mode === 'daily' ? 1 : 0, f = { started: b.e === 'start' || b.e === 'finish' ? 1 : 0, finished: b.e === 'finish' ? 1 : 0, daily_started: daily && b.e !== 'share' ? 1 : 0, daily_won: daily && b.e === 'finish' ? 1 : 0, shared: b.e === 'share' ? 1 : 0 };
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO acq (pid, src, camp, first_day) VALUES (?, ?, ?, ?)').bind(b.pid, src || 'direct', camp, day),
    env.DB.prepare('INSERT INTO activity (day, pid, started, finished, daily_started, daily_won, shared) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day, pid) DO UPDATE SET started = MAX(started, excluded.started), finished = MAX(finished, excluded.finished), daily_started = MAX(daily_started, excluded.daily_started), daily_won = MAX(daily_won, excluded.daily_won), shared = MAX(shared, excluded.shared)')
      .bind(day, b.pid, f.started, f.finished, f.daily_started, f.daily_won, f.shared)]);
  return reply({ ok: true });
}
// Founder only: stop counting a player id (their own devices) and wipe what was already counted for it.
async function postExclude(env, b, request, reply) {
  if (!isAdmin(env, request)) return reply({ error: 'unauthorised' }, 401);
  if (!PID.test(b.pid)) return reply({ error: 'invalid' }, 400);
  await ensureAnalytics(env);
  await env.DB.batch(b.on === false ? [env.DB.prepare('DELETE FROM excluded WHERE pid = ?').bind(b.pid)] : [env.DB.prepare('INSERT OR IGNORE INTO excluded (pid, created_at) VALUES (?, ?)').bind(b.pid, Date.now()), env.DB.prepare('DELETE FROM activity WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM acq WHERE pid = ?').bind(b.pid)]);
  return reply({ ok: true, excluded: b.on !== false });
}
async function adminStats(env, request, q, t, reply) {
  if (!env.ADMIN_KEY) return reply({ error: 'not found' }, 404);
  if (!safeEqual((request.headers.get('authorization') || '').replace(/^Bearer /, ''), env.ADMIN_KEY)) return reply({ error: 'unauthorised' }, 401);
  const today = new Date(t).toISOString().slice(0, 10), days = Math.max(1, Math.min(120, parseInt(q.get('days'), 10) || 30));
  const since = new Date(Date.parse(today + 'T00:00:00Z') - (days + 40) * 864e5).toISOString().slice(0, 10);
  await ensureAnalytics(env);
  const all = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results;
  const [activity, firstRows, counters, scores, orders, reports, acq] = await Promise.all([
    all('SELECT day, pid, started, finished, daily_started, daily_won, shared FROM activity WHERE day >= ?', since),
    all('SELECT pid, MIN(day) AS first FROM activity GROUP BY pid'),
    all('SELECT day, k, n FROM counters WHERE day >= ?', since),
    all('SELECT day, clicks, secs FROM scores WHERE day >= ?', since),
    all('SELECT created_at FROM orders WHERE created_at >= ?', Date.parse(since + 'T00:00:00Z')),
    all('SELECT created_at, day, mode, from_title, to_title, reason, note FROM reports ORDER BY id DESC LIMIT 200'),
    all('SELECT pid, src, camp, first_day FROM acq')
  ]);
  return reply(computeStats({ today, days, activity, firsts: new Map(firstRows.map(r => [r.pid, r.first])), counters, scores, orders, reports, acq }));
}

// ---- hand-picked daily puzzles -------------------------------------------------------------------------------------
const isAdmin = (env, request) => !!env.ADMIN_KEY && safeEqual((request.headers.get('authorization') || '').replace(/^Bearer /, ''), env.ADMIN_KEY);
const rowOut = r => ({ day: r.day, from: r.from_title, to: r.to_title, par: r.par, route: JSON.parse(r.route), alts: JSON.parse(r.alts || '[]') });
async function getDaily(env, day, reply) {
  if (!DAY.test(day)) return reply({ error: 'invalid' }, 400);
  if (day > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) return reply({ error: 'none' }, 404);   // picks stay secret until the day before
  const r = await env.DB.prepare('SELECT day, from_title, to_title, par, route, alts FROM daily_override WHERE day = ?').bind(day).first();
  return r ? reply(rowOut(r)) : reply({ error: 'none' }, 404);
}
async function listOverrides(env, request, t, reply) {
  if (!env.ADMIN_KEY) return reply({ error: 'not found' }, 404);
  if (!isAdmin(env, request)) return reply({ error: 'unauthorised' }, 401);
  const since = new Date(t - 7 * 864e5).toISOString().slice(0, 10);
  return reply((await env.DB.prepare('SELECT day, from_title, to_title, par, route, alts FROM daily_override WHERE day >= ? ORDER BY day').bind(since).all()).results.map(rowOut));
}
async function postOverride(env, b, request, t, reply) {
  if (!env.ADMIN_KEY) return reply({ error: 'not found' }, 404);
  if (!isAdmin(env, request)) return reply({ error: 'unauthorised' }, 401);
  if (b.remove) { if (!DAY.test(b.day)) return reply({ error: 'bad day' }, 400); await env.DB.prepare('DELETE FROM daily_override WHERE day = ?').bind(b.day).run(); return reply({ ok: true }); }
  const c = checkOverride(b); if (!c.ok) return reply({ error: c.error }, 400);
  const v = c.value;
  await env.DB.prepare('INSERT INTO daily_override (day, from_title, to_title, par, route, alts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET from_title = excluded.from_title, to_title = excluded.to_title, par = excluded.par, route = excluded.route, alts = excluded.alts, created_at = excluded.created_at').bind(v.day, v.from, v.to, v.par, JSON.stringify(v.route), JSON.stringify(v.alts), t).run();
  return reply({ ok: true });
}
