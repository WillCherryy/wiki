// wikilink API for Cloudflare Workers + D1.
// Same contract as the local dev server (server.js); tools/test-api.js runs one test against both.
const DAY = /^\d{4}-\d{2}-\d{2}$/, PID = /^[a-z0-9]{6,16}$/, CODE = /^[A-Z0-9]{4,8}$/;
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
const cleanPath = a => (Array.isArray(a) ? a : []).slice(0, 16).map(x => String(x).replace(/[\u0000-\u001f<>]/g, '').slice(0, 80));
const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const hits = new Map(); // best-effort per-isolate rate limit; add a Cloudflare rate-limiting rule for real protection

export default {
  async fetch(request, env) {
    const now = () => (env.TEST_NOW ? Number(env.TEST_NOW) : Date.now());
    const cors = { 'access-control-allow-origin': env.ALLOWED_ORIGIN || '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url), q = url.searchParams, path = url.pathname;
    if (!path.startsWith('/api/') && env.ASSETS) return env.ASSETS.fetch(request);   // everything else is the static site
    try {
      if (request.method === 'GET') {
        if (path === '/api/leaderboard') return reply(await leaderboard(env, q, now()));
        if (path === '/api/paths') return reply(await pathTree(env, dayParam(q, now())));
        if (path === '/api/league') { const L = await league(env, (q.get('code') || '').toUpperCase()); return L ? reply(L) : reply({ error: 'no such league' }, 404); }
        if (path === '/api/entitlements') { const pid = q.get('pid') || ''; return PID.test(pid) ? reply({ supporter: await isSupporter(env, pid) }) : reply({ error: 'invalid' }, 400); }
        if (path === '/api/health') return reply({ ok: true });
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
  await env.DB.batch([env.DB.prepare('DELETE FROM scores WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM league_members WHERE pid = ?').bind(b.pid), env.DB.prepare('DELETE FROM players WHERE pid = ?').bind(b.pid)]);
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
const safeEqual = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
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
    if (evt.type === 'checkout.session.completed' && o.payment_status === 'paid') await recordOrder(env, provider, o.id, o.client_reference_id, t);
    return reply({ ok: true });
  }
  return reply({ error: 'not found' }, 404);
}
