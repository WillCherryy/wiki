'use strict';
// Streamer lobby: race rules on a fake clock, then a real WebSocket round trip against the dev server.
const assert = require('assert');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const mkConn = () => { const c = { got: [], send: s => c.got.push(JSON.parse(s)) }; c.last = t => [...c.got].reverse().find(m => m.t === t); return c; };

async function core() {
  const { LobbyCore } = await import(path.join(__dirname, '..', 'worker', 'lobby-core.js'));
  let t = 1e6, timers = [];
  const clock = { now: () => t, setTimer: (f, ms) => { const h = { f, at: t + ms }; timers.push(h); return h; }, clearTimer: h => { timers = timers.filter(x => x !== h); } };
  const advance = ms => { t += ms; for (const h of timers.filter(x => x.at <= t)) { timers = timers.filter(x => x !== h); h.f(); } };
  const L = new LobbyCore({ code: 'ABCDE', hostKey: 'secretkey', ...clock });
  assert(!L.setPuzzle({ from: 'X', to: 'x' }) && L.setPuzzle({ from: 'Tour de France', to: 'India', par: 3 }), 'puzzle validation');

  const host = mkConn(), a = mkConn(), b = mkConn(), c = mkConn(), view = mkConn(), evil = mkConn();
  [host, a, b, c, view, evil].forEach(x => L.join(x));
  assert.strictEqual(a.last('s').puzzle, null, 'the puzzle is hidden until the countdown');
  L.message(evil, JSON.stringify({ t: 'host', key: 'nope' })); L.message(evil, JSON.stringify({ t: 'start' }));
  assert.strictEqual(L.phase, 'open', 'only the host can start');
  L.message(host, JSON.stringify({ t: 'host', key: 'secretkey' })); L.message(view, JSON.stringify({ t: 'view' }));
  const hello = (conn, pid, name) => L.message(conn, JSON.stringify({ t: 'hello', pid, name }));
  hello(a, 'alicepid01', 'Alice'); hello(b, 'bobbypid02', 'Bob'); hello(c, 'carolpid03', 'Carol');
  L.message(evil, JSON.stringify({ t: 'hello', pid: 'x', name: '' })); assert.strictEqual(evil.last('err').error, 'name', 'bad names are refused');
  assert.strictEqual(L.players.size, 3);

  L.message(host, JSON.stringify({ t: 'start' }));
  assert.strictEqual(L.phase, 'countdown'); assert.deepStrictEqual(a.last('s').puzzle, { from: 'Tour de France', to: 'India', par: 3 }, 'puzzle revealed at countdown');
  const mv = (conn, title, clicks, temp) => L.message(conn, JSON.stringify({ t: 'move', title, clicks, temp }));
  mv(a, 'France', 1, .3); assert.strictEqual(L.players.get('alicepid01').clicks, 0, 'moves before the gun are ignored');
  advance(5000); assert.strictEqual(L.phase, 'racing', 'countdown ends by itself');
  advance(1000);
  mv(a, 'France', 1, .3); mv(b, 'Cheese', 1, .05); mv(c, 'Cheese', 1, .08);
  mv(a, 'Spam', 2, .9); assert.strictEqual(L.players.get('alicepid01').clicks, 1, 'moves faster than 8 per second are dropped');
  advance(500); mv(a, 'British Empire', 2, .7);
  advance(1000);
  let bd = host.last('b'); assert.strictEqual(bd.top[0].n, 'Alice', 'warmest player leads while racing');
  assert.deepStrictEqual(bd.stuck.map(s => [s.title, s.n]), [['Cheese', 2], ['British Empire', 1]], 'coldest articles are listed first');
  assert(view.last('b').stuck && !a.last('b').stuck, 'only host/overlay get the stuck list');
  assert.strictEqual(a.last('b').me, 1, 'players see their own rank');

  L.message(a, JSON.stringify({ t: 'finish', clicks: 3 }));
  const ev = host.last('ev'); assert.strictEqual(ev.rank, 1); assert.strictEqual(ev.secs, 3, 'time is measured by the server from the start gun (2.5s rounds to 3)');
  advance(10000); L.message(b, JSON.stringify({ t: 'finish', clicks: 5 }));
  L.message(b, JSON.stringify({ t: 'finish', clicks: 1 })); assert.strictEqual(L.players.get('bobbypid02').clicks, 5, 'a finish counts once');
  advance(1000);
  bd = host.last('b'); assert.deepStrictEqual(bd.top.map(r => [r.n, r.d]), [['Alice', true], ['Bob', true], ['Carol', false]], 'finishers rank by time, then the rest by warmth');
  assert.strictEqual(bd.fin, 2);

  // reconnecting with the same id takes over the seat
  const a2 = mkConn(); L.join(a2); hello(a2, 'alicepid01', 'Alice'); assert.strictEqual(L.players.size, 3); assert(L.players.get('alicepid01').done, 'progress survives a reconnect');
  L.message(a, JSON.stringify({ t: 'move', title: 'Hack', clicks: 1, temp: 1 }));
  L.message(host, JSON.stringify({ t: 'end' })); assert.strictEqual(L.phase, 'ended');
  L.message(host, JSON.stringify({ t: 'reset', puzzle: { from: 'Apple', to: 'Moon' } }));
  assert.strictEqual(L.phase, 'open'); assert.strictEqual(L.round, 1); assert(![...L.players.values()].some(p => p.done), 'a new round clears results'); assert.strictEqual(L.puzzle.to, 'Moon');
  L.message(host, JSON.stringify({ t: 'kick', pid: 'carolpid03' })); assert.strictEqual(L.players.size, 2); assert(c.last('kicked'));
  console.log('ok: lobby rules (host-only control, server clock, rate limit, ranking, stuck list, reconnect, rounds)');
}

function waitFor(ws, pred, ms = 8000) {
  return new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('timeout waiting for message')), ms);
    const on = e => { const m = JSON.parse(e.data); if (pred(m)) { clearTimeout(to); ws.removeEventListener('message', on); res(m); } };
    ws.addEventListener('message', on);
  });
}
const open = url => new Promise((res, rej) => { const ws = new WebSocket(url); ws.onopen = () => res(ws); ws.onerror = () => rej(new Error('ws error ' + url)); });
const post = (port, p, body) => new Promise((res, rej) => { const r = http.request({ port, path: p, method: 'POST', headers: { 'content-type': 'application/json' } }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res({ status: x.statusCode, body: JSON.parse(d) })); }); r.on('error', rej); r.end(JSON.stringify(body)); });

async function wire() {
  const port = 3300 + Math.floor(Math.random() * 400);
  const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: port, DATA_FILE: path.join(require('os').tmpdir(), 'lobby-test-' + port + '.json') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await post(port, '/api/lobby', {}); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    assert.strictEqual((await post(port, '/api/lobby', { from: 'A', to: 'A' })).status, 400, 'same start and target is refused');
    const made = await post(port, '/api/lobby', { from: 'Tour de France', to: 'India', par: 3 }); assert.strictEqual(made.status, 200); const { code, key } = made.body;
    const base = `ws://localhost:${port}/api/lobby/${code}/ws`;
    const host = await open(base), p1 = await open(base), p2 = await open(base), ov = await open(base);
    host.send(JSON.stringify({ t: 'host', key })); assert.strictEqual((await waitFor(host, m => m.t === 'host')).ok, true);
    ov.send(JSON.stringify({ t: 'view' }));
    p1.send(JSON.stringify({ t: 'hello', pid: 'wsalice001', name: 'Alice' })); p2.send(JSON.stringify({ t: 'hello', pid: 'wsbob00001', name: 'Bob' }));
    await waitFor(host, m => m.t === 'b' && m.n === 2);
    const go = waitFor(p1, m => m.t === 's' && m.phase === 'racing');
    host.send(JSON.stringify({ t: 'start' })); assert.strictEqual((await waitFor(p2, m => m.t === 's' && m.phase === 'countdown')).puzzle.to, 'India');
    await go;
    p1.send(JSON.stringify({ t: 'move', title: 'France', clicks: 1, temp: .4 }));
    const snap = await waitFor(ov, m => m.t === 'b' && m.stuck && m.stuck.some(s => s.title === 'France')); assert(snap);
    const fin = waitFor(ov, m => m.t === 'ev'); p1.send(JSON.stringify({ t: 'finish', clicks: 3 })); assert.strictEqual((await fin).name, 'Alice');
    const mine = await waitFor(p2, m => m.t === 'b' && m.fin === 1 && m.me === 2); assert(mine);
    assert.strictEqual((await new Promise(r => { const ws = new WebSocket(`ws://localhost:${port}/api/lobby/ZZZZZ/ws`); ws.onerror = () => r('refused'); ws.onopen = () => r('open'); })), 'refused', 'unknown lobby codes are refused');
    [host, p1, p2, ov].forEach(w => w.close());
    console.log('ok: lobby over real WebSockets (create, join, countdown, live board, finish alert)');
  } finally { srv.kill(); }
}

core().then(wire).catch(e => { console.error(e); process.exit(1); });
