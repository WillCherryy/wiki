#!/usr/bin/env node
'use strict';
// A quick look at the founder dashboard from the terminal.  node tools/stats.js [--days 30]
// Needs WARMER_URL and WARMER_KEY in the environment.
const URL_ = (process.env.WARMER_URL || '').replace(/\/$/, ''), KEY = process.env.WARMER_KEY || '';
const i = process.argv.indexOf('--days'), days = i > 0 ? +process.argv[i + 1] || 30 : 30;
if (!/^https?:\/\//.test(URL_) || !KEY) { console.error('Set WARMER_URL and WARMER_KEY first.'); process.exit(1); }
(async () => {
  const r = await fetch(`${URL_}/api/admin/stats?days=${days}`, { headers: { authorization: 'Bearer ' + KEY } });
  if (r.status === 401) { console.error('The server did not accept that admin key.'); process.exit(1); }
  if (!r.ok) { console.error('The server returned ' + r.status); process.exit(1); }
  const s = await r.json(), k = s.kpis, p = (a, w = 8) => String(a == null ? '-' : a).padStart(w);
  console.log(`\nWarmer, ${s.today} (UTC), last ${s.days} days\n`);
  console.log(`  Players today       ${p(k.playersToday)}   (a week ago: ${k.playersLastWeek == null ? '-' : k.playersLastWeek})`);
  console.log(`  New today           ${p(k.newToday)}`);
  console.log(`  Solved today        ${p(k.finishedToday)}   (${k.finishRate == null ? '-' : k.finishRate + '%'} of starts)`);
  console.log(`  Shared today        ${p(k.sharedToday)}`);
  console.log(`  Came back next day  ${p(k.d1 == null ? null : k.d1 + '%')}`);
  console.log(`  Supporters (8 wks)  ${p(k.buyers)}`);
  console.log(`  Live lobbies (7d)   ${p(k.lobbies7d)}\n`);
  console.log('  Funnel: ' + s.funnel.map(([n, v]) => `${n} ${v}`).join('  >  '));
  if (s.countries.length) console.log('  Countries: ' + s.countries.slice(0, 6).map(c => `${c.code} ${c.n}`).join(', '));
  const bad = s.puzzles.filter(x => x.reports || (x.winRate != null && x.started >= 20 && x.winRate < 45));
  if (bad.length) console.log('\n  Puzzles to look at: ' + bad.map(x => `${x.day} (${x.winRate == null ? '-' : x.winRate + '%'} solved, ${x.reports} reports)`).join('; '));
  if (s.reports.length) { console.log('\n  Latest reports:'); s.reports.slice(0, 5).forEach(x => console.log(`   - ${x.title}: ${x.reason}${x.note ? ' - ' + x.note : ''}`)); }
  console.log('');
})().catch(e => { console.error(e.message); process.exit(1); });
