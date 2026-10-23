#!/usr/bin/env node
'use strict';
// Pick the daily puzzle from the command line. Finds a verified route of four clicks or fewer (the same solver the
// puzzle page uses), then saves it through the admin API. Players see it from the day before, so it is live at their midnight.
//
//   node tools/set-puzzle.js --from "Tour de France" --to "India"            (for tomorrow, UK date)
//   node tools/set-puzzle.js --day 2026-10-26 --from "Mozart" --to "Volcano"
//   node tools/set-puzzle.js --list                                            (upcoming hand-picked puzzles)
//   node tools/set-puzzle.js --clear 2026-10-26
//   add --dry-run to check a pair without saving it
// Needs WARMER_URL (your site) and WARMER_KEY (the admin key) in the environment; WIKI_UA should name a contact.
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = n => process.argv.includes('--' + n);
const URL_ = (process.env.WARMER_URL || '').replace(/\/$/, ''), KEY = process.env.WARMER_KEY || '';
const die = (m, code = 1) => { console.error(m); process.exit(code); };
if (!/^https?:\/\//.test(URL_)) die('Set WARMER_URL first, for example:  $env:WARMER_URL = "https://wiki.will-34e.workers.dev"');
if (!KEY) die('Set WARMER_KEY first:  $env:WARMER_KEY = "your-admin-key"');
const call = async (method, p, body) => {
  const r = await fetch(URL_ + p, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  if (r.status === 401) die('The server did not accept that admin key.');
  if (r.status === 404 && p.startsWith('/api/admin')) die('The server has no ADMIN_KEY set (or the address is wrong).');
  return { status: r.status, body: j };
};
const nice = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const tomorrowUK = () => { const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); return new Date(Date.parse(t + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10); };

(async () => {
  if (flag('list')) {
    const r = await call('GET', '/api/admin/daily'); if (r.status !== 200) die('Could not list: ' + r.status);
    if (!r.body.length) return console.log('No hand-picked puzzles yet.');
    for (const o of r.body) console.log(`${o.day}  ${nice(o.day).padEnd(12)} ${o.from} -> ${o.to}  (par ${o.par}, ${1 + o.alts.length} route${o.alts.length ? 's' : ''})`);
    return;
  }
  const clear = arg('clear'); if (clear) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clear)) die('Use a date like 2026-10-26.');
    const r = await call('POST', '/api/admin/daily', { day: clear, remove: true }); return console.log(r.status === 200 ? `Cleared ${clear}.` : 'Could not clear: ' + JSON.stringify(r.body));
  }
  const from = arg('from'), to = arg('to'), day = arg('day', tomorrowUK());
  if (!from || !to) die('Give --from and --to, for example:  node tools/set-puzzle.js --from "Tour de France" --to "India"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) die('Use a date like 2026-10-26.');
  if (!process.env.WIKI_UA) process.env.WIKI_UA = 'Scorcher-set-puzzle/1.0 (contact: set WIKI_UA to your email)';
  const { findRoute } = require('./solver');
  console.log(`Checking ${from} -> ${to} (this can take a minute for four-click routes)...`);
  const res = await findRoute(from, to, { maxPar: 4, alts: 2, altCap: 40, onStep: m => console.log('  ' + m) });
  if (!res) die(`No route of four clicks or fewer was found from "${from}" to "${to}", or one of the pages does not exist. Try another pair.`, 2);
  console.log(`\nSolvable in ${res.par} click${res.par === 1 ? '' : 's'}.`);
  [res.route, ...res.alts].forEach((r, i) => console.log(`  ${i ? 'Also  ' : 'Best  '} ${r.join('  ->  ')}`));
  if (flag('dry-run')) return console.log('\nDry run: nothing saved.');
  const r = await call('POST', '/api/admin/daily', { day, from: res.route[0], to: res.route[res.route.length - 1], route: res.route, alts: res.alts });
  if (r.status !== 200) die('Could not save: ' + JSON.stringify(r.body));
  console.log(`\nSaved for ${nice(day)} (${day}). Players get it from the day before, and it is live at their midnight.`);
})().catch(e => die('Something went wrong: ' + (e && e.message || e)));
