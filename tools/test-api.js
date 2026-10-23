'use strict';
// One API contract test, run against both implementations: the local dev server (server.js) and the
// Cloudflare Worker (worker/index.js) on a D1-compatible SQLite shim. They must behave identically.
const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { makeEnv } = require('./d1-shim');

const today = new Date().toISOString().slice(0, 10);
const shiftDay = n => new Date(Date.parse(today + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const A = 'alicepid01', B = 'bobbypid02', C = 'carolpid03';

async function scenario(call, label) {
  const ok = (r, msg) => assert.strictEqual(r.status, 200, `${label}: ${msg} → ${r.status} ${JSON.stringify(r.body)}`);
  const score = (pid, name, clicks, secs, purist, extra = {}) => call('POST', '/api/score', { pid, name, xp: 120, day: today, clicks, secs, score: 900, path: ['Start', 'Mid', 'End'], purist, ...extra });
  ok(await score(A, 'Alice', 3, 40, true), 'score A');
  ok(await score(B, 'Bob', 4, 30, false), 'score B');
  ok(await score(A, 'Alice', 1, 5, true, { path: ['Cheat', 'End'] }), 'duplicate A');          // the first result of the day stands
  let day = (await call('GET', `/api/leaderboard?mode=day&day=${today}`)).body;
  assert.deepStrictEqual(day.map(r => [r.name, r.clicks, r.secs, !!r.purist]), [['Alice', 3, 40, true], ['Bob', 4, 30, false]], `${label}: day board`);
  day = (await call('GET', `/api/leaderboard?mode=day&day=${today}&purist=1`)).body;
  assert.deepStrictEqual(day.map(r => r.name), ['Alice'], `${label}: purist filter`);
  for (const mode of ['week', 'all']) {
    const rows = (await call('GET', `/api/leaderboard?mode=${mode}&day=${today}`)).body;
    assert.deepStrictEqual(rows.map(r => [r.name, r.points, r.days]).sort(), [['Alice', 900, 1], ['Bob', 900, 1]], `${label}: ${mode} board`);
  }
  const streak = (await call('GET', `/api/leaderboard?mode=streak&day=${today}`)).body;
  assert.deepStrictEqual(streak.map(r => [r.name, r.streak]).sort(), [['Alice', 1], ['Bob', 1]], `${label}: streak board`);
  // leagues
  assert.strictEqual((await call('GET', '/api/league?code=ZZZZZZ')).status, 404, `${label}: unknown league`);
  assert.strictEqual((await call('POST', '/api/league', { pid: A, name: 'Alice', xp: 1, code: 'FRIEND' })).status, 404, `${label}: join missing league without a name`);
  let L = (await call('POST', '/api/league', { pid: A, name: 'Alice', xp: 1, code: 'FRIEND', leagueName: 'Friday Club' })).body;
  assert.deepStrictEqual([L.code, L.name, L.members], ['FRIEND', 'Friday Club', 1], `${label}: create league`);
  L = (await call('POST', '/api/league', { pid: B, name: 'Bob', xp: 1, code: 'friend' })).body;
  assert.deepStrictEqual([L.name, L.members], ['Friday Club', 2], `${label}: join league (case-insensitive)`);
  ok(await score(C, 'Carol', 5, 50, false), 'score C');
  assert.deepStrictEqual((await call('GET', `/api/leaderboard?mode=day&day=${today}&league=FRIEND`)).body.map(r => r.name), ['Alice', 'Bob'], `${label}: league board excludes non-members`);
  assert.deepStrictEqual((await call('GET', `/api/leaderboard?mode=day&day=${today}&league=NOPE12`)).body, [], `${label}: unknown league board`);
  // path map
  const pm = (await call('GET', `/api/paths?day=${today}`)).body;
  assert.strictEqual(pm.total, 3, `${label}: path total`); assert.strictEqual(pm.best, 3, `${label}: best`);
  assert.strictEqual(pm.nodes.find(n => n.p.join('>') === 'Start').n, 3, `${label}: root count`);
  // entitlements default to false
  assert.deepStrictEqual((await call('GET', `/api/entitlements?pid=${A}`)).body, { supporter: false }, `${label}: entitlement default`);
  assert.strictEqual((await call('GET', '/api/entitlements?pid=BAD!')).status, 400, `${label}: entitlement bad pid`);
  // validation
  for (const [what, bad] of [['pid', { pid: 'x!' }], ['clicks', { clicks: 0 }], ['name', { name: '  ' }], ['old day', { day: shiftDay(-10) }], ['future day', { day: shiftDay(10) }], ['path', { path: ['one'] }]]) {
    assert.strictEqual((await score('validpid99', 'Valid', 3, 40, false, bad)).status, 400, `${label}: rejects bad ${what}`);
  }
  assert.strictEqual((await call('POST', '/api/score', { not: 'a score' })).status, 400, `${label}: rejects junk`);
  // puzzle reports
  const rep = { mode: 'daily', day: today, from: 'Tour de France', to: 'India', reason: 'unsolvable', note: 'No link <b>ever</b> leads there', pid: C };
  ok(await call('POST', '/api/report', rep), 'report');
  for (const [what, bad] of [['reason', { reason: 'spam' }], ['mode', { mode: 'x' }], ['title', { from: '' }], ['day', { day: 'tomorrow' }]])
    assert.strictEqual((await call('POST', '/api/report', { ...rep, ...bad })).status, 400, `${label}: report rejects bad ${what}`);
  assert.strictEqual((await call('GET', '/api/reports', null, { authorization: 'Bearer wrong' })).status, 401, `${label}: reports need the admin key`);
  const got = (await call('GET', '/api/reports', null, { authorization: 'Bearer adminkey' })).body;
  assert.deepStrictEqual([got.length, got[0].reason, got[0].from_title, got[0].note.includes('<')], [1, 'unsolvable', 'Tour de France', false], `${label}: admin reads sanitised reports`);
  // anonymous usage events and the founder stats
  const ev = (body, headers) => call('POST', '/api/event', body, headers);
  ok(await ev({ e: 'visit' }, { 'cf-ipcountry': 'GB' }), 'visit event'); ok(await ev({ e: 'visit' }, { 'cf-ipcountry': 'US' }), 'visit event 2');
  ok(await ev({ e: 'start', pid: A, mode: 'daily' }), 'start A'); ok(await ev({ e: 'finish', pid: A, mode: 'daily' }), 'finish A'); ok(await ev({ e: 'share', pid: A }), 'share A'); ok(await ev({ e: 'start', pid: B, mode: 'practice' }), 'start B'); ok(await ev({ e: 'start', pid: A, mode: 'daily' }), 'repeat start is harmless');
  for (const bad of [{ e: 'nope', pid: A }, { e: 'start', pid: 'x!' }, { e: 'start', pid: A, mode: 'x' }]) assert.strictEqual((await ev(bad)).status, 400, `${label}: event rejects ${JSON.stringify(bad)}`);
  assert.strictEqual((await call('GET', '/api/admin/stats')).status, 401, `${label}: stats need the admin key`);
  const st = (await call('GET', '/api/admin/stats?days=7', null, { authorization: 'Bearer adminkey' })).body;
  assert.deepStrictEqual([st.kpis.playersToday, st.kpis.newToday, st.kpis.finishedToday, st.kpis.sharedToday], [2, 2, 1, 1], `${label}: stats today`);
  assert.deepStrictEqual(st.funnel.map(f => f[1]), [2, 2, 1, 1], `${label}: funnel`);
  assert.deepStrictEqual([st.puzzles[0].started, st.puzzles[0].won, st.puzzles[0].winRate], [1, 1, 100], `${label}: daily puzzle health`);
  assert.deepStrictEqual(st.countries.map(c => [c.code, c.n]).sort(), [['GB', 1], ['US', 1]], `${label}: countries are aggregate counts`);
  assert.strictEqual(st.series[st.series.length - 1].visits, 2, `${label}: visits`);
  // delete removes scores, league membership and the player
  ok(await call('POST', '/api/delete', { pid: A }), 'delete A');
  assert.deepStrictEqual((await call('GET', `/api/leaderboard?mode=day&day=${today}`)).body.map(r => r.name), ['Bob', 'Carol'], `${label}: board after delete`);
  assert.strictEqual((await call('GET', '/api/league?code=FRIEND')).body.members, 1, `${label}: league after delete`);
  assert.strictEqual((await call('GET', '/api/admin/stats?days=7', null, { authorization: 'Bearer adminkey' })).body.kpis.playersToday, 1, `${label}: delete removes the player's activity`);
  assert.strictEqual((await call('OPTIONS', '/api/score')).status, 204, `${label}: CORS preflight`);
}

async function viaWorker() {
  const worker = (await import(path.join(__dirname, '..', 'worker', 'index.js'))).default, env = makeEnv({ ADMIN_KEY: 'adminkey' });
  await scenario(async (method, p, body, headers = {}) => {
    const r = await worker.fetch(new Request('http://api.test' + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }), env);
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  }, 'worker');
}
async function viaServer() {
  const port = 3900 + Math.floor(Math.random() * 90), dir = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'warmer-'));
  require('fs').writeFileSync(path.join(dir, 'x'), '');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), DATA_FILE: path.join(dir, 'data.json'), ADMIN_KEY: 'adminkey' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  try {
    await scenario((method, p, body, headers = {}) => new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: p, method, headers: { 'content-type': 'application/json', ...headers } }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }));
      });
      req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
    }), 'server.js');
  } finally { child.kill(); }
}

(async () => { await viaWorker(); await viaServer(); console.log('ok: API contract holds for the Worker and the dev server'); })().catch(e => { console.error(e); process.exit(1); });
