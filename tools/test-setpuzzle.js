'use strict';
// The founder's command-line puzzle tool, end to end: a fake MediaWiki API, the dev server, and tools/set-puzzle.js.
const assert = require('assert'), http = require('http'), os = require('os'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
// async on purpose: the fake Wikipedia lives in this process, so a blocking spawnSync would starve it
const exec = (args, env) => new Promise(res => { const c = spawn(process.execPath, args, { env }); let out = '', err = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d); c.on('close', code => res({ status: code, stdout: out, stderr: err })); });
const G = { 'Tour de France': ['France', 'Cycling'], France: ['British Empire', 'Colonialism'], Cycling: ['British Empire'], 'British Empire': ['India'], Colonialism: ['India'], India: [], Paris: [], Peru: ['Paris'], Mars: [] };
const inv = {}; for (const [k, v] of Object.entries(G)) for (const t of v) (inv[t] = inv[t] || []).push(k);
const page = t => `<div class="mw-parser-output"><p>${t} ${(G[t] || []).map(x => `<a href="/wiki/${x.replace(/ /g, '_')}">${x}</a>`).join(' ')}</p></div>`;
const wiki = http.createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams, send = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  if (q.get('action') === 'parse') { const t = q.get('page'); return G[t] ? send({ parse: { title: t, text: page(t) } }) : send({ error: { code: 'missingtitle', info: 'no' } }); }
  const ts = (q.get('titles') || '').split('|').filter(Boolean);
  if (q.get('prop') === 'links') return send({ query: { pages: ts.map(t => ({ title: t, links: (G[t] || []).map(title => ({ title })) })) } });
  if (q.get('prop') === 'linkshere') return send({ query: { pages: [{ title: ts[0], linkshere: (inv[ts[0]] || []).map(title => ({ title })) }] } });
  send({ error: { code: 'x', info: 'unsupported' } });
});
const get = (port, p, key) => fetch(`http://127.0.0.1:${port}${p}`, { headers: key ? { authorization: 'Bearer ' + key } : {} }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
wiki.listen(0, async () => {
  const port = 4300 + Math.floor(Math.random() * 400), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warmer-sp-'));
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), DATA_FILE: path.join(dir, 'data.json'), ADMIN_KEY: 'k3y' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await get(port, '/api/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    const env = { ...process.env, WARMER_URL: `http://127.0.0.1:${port}`, WARMER_KEY: 'k3y', WIKI_API: `http://127.0.0.1:${wiki.address().port}/w/api.php`, WIKI_CACHE: dir, WIKI_UA: 'test (x)' };
    const run = (...a) => exec([path.join(__dirname, 'set-puzzle.js'), ...a], env);
    const day = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    let r = await run('--day', day, '--from', 'Tour de France', '--to', 'India'); assert.strictEqual(r.status, 0, r.stdout + r.stderr); assert(r.stdout.includes('Solvable in 3 clicks') && r.stdout.includes('Saved'), r.stdout);
    const pub = (await get(port, `/api/daily?day=${day}`)).body; assert.deepStrictEqual([pub.par, pub.route.join('>'), pub.alts.length], [3, 'Tour de France>France>British Empire>India', 2], 'saved with the best route and two alternatives');
    r = await run('--day', day, '--from', 'Peru', '--to', 'Tour de France'); assert.strictEqual(r.status, 2, 'an unsolvable pair exits with code 2'); assert(r.stderr.includes('No route'), r.stderr);
    assert.strictEqual((await get(port, `/api/daily?day=${day}`)).body.from, 'Tour de France', 'a failed check leaves the saved puzzle alone');
    r = await run('--day', day, '--from', 'Mars', '--to', 'India', '--dry-run'); assert.strictEqual(r.status, 2);
    r = await run('--list'); assert(r.stdout.includes('Tour de France -> India'), r.stdout);
    r = await exec([path.join(__dirname, 'set-puzzle.js'), '--list'], { ...env, WARMER_KEY: 'wrong' }); assert(r.stderr.includes('did not accept'), 'a wrong key is explained');
    r = await run('--clear', day); assert(r.stdout.includes('Cleared')); assert.strictEqual((await get(port, `/api/daily?day=${day}`)).status, 404);
    r = await exec([path.join(__dirname, 'stats.js')], env); assert(r.stdout.includes('Players today'), r.stdout + r.stderr);
    console.log('ok: command-line puzzle tool and stats (route check, save, refuse unsolvable, list, clear)');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { srv.kill(); wiki.close(); }
});
