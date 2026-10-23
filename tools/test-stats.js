'use strict';
// The founder dashboard's cohort and funnel maths, on hand-made rows over several days.
const assert = require('assert');
const path = require('path');
(async () => {
  const { computeStats, shiftDay } = await import(path.join(__dirname, '..', 'worker', 'stats.js'));
  const today = '2026-10-23', d = n => shiftDay(today, -n);
  const act = [];
  const play = (pid, day, extra = {}) => act.push({ day, pid, started: 1, finished: 0, daily_started: 1, daily_won: 0, shared: 0, ...extra });
  // cohort of 4 who all first played on Oct 6 (a Tuesday, 17 days ago): p1,p2 return next day; p1 also on day 7; p3 returns on day 2 only
  for (const p of ['p1', 'p2', 'p3', 'p4']) play(p, d(17));
  play('p1', d(16)); play('p2', d(16)); play('p3', d(15)); play('p1', d(10), { finished: 1, daily_won: 1, shared: 1 });
  // two brand-new players today, one returning
  play('n1', today); play('n2', today, { finished: 1, daily_won: 1 }); play('p1', today);
  const firsts = new Map(); for (const r of act) if (!firsts.has(r.pid) || r.day < firsts.get(r.pid)) firsts.set(r.pid, r.day);
  const s = computeStats({ today, days: 30, activity: act, firsts, counters: [{ day: today, k: 'visit', n: 9 }, { day: today, k: 'c:GB', n: 5 }, { day: d(1), k: 'lobby', n: 2 }], scores: [{ day: today, clicks: 3, secs: 40 }, { day: today, clicks: 5, secs: 100 }], orders: [{ created_at: Date.parse(today + 'T10:00:00Z') }], reports: [{ created_at: 1, day: today, mode: 'daily', from_title: 'A', to_title: 'B', reason: 'unsolvable', note: '' }] });
  const last = s.series[s.series.length - 1];
  assert.deepStrictEqual([last.players, last.newPlayers, last.returning, last.visits], [3, 2, 1, 9], 'new versus returning today');
  const c = s.retention.find(r => r.players === 4);
  assert.deepStrictEqual([c.d1, c.d7, c.d30], [50, 25, null], 'cohort retention: day 1 is 2 of 4, day 7 is 1 of 4 (p1), day 30 is not measurable yet');
  assert.deepStrictEqual(s.funnel.map(f => f[1]), [11, 11, 2, 1], 'funnel in sessions and player-days: visits (at least the starts), started, solved, shared');
  assert.deepStrictEqual([s.puzzles[0].started, s.puzzles[0].won, s.puzzles[0].avgClicks, s.puzzles[0].medianSecs, s.puzzles[0].reports], [3, 1, 4, 70, 1], 'today’s puzzle health');
  assert.strictEqual(s.buyers[s.buyers.length - 1].buyers, 1, 'buyers this week'); assert.deepStrictEqual(s.countries, [{ code: 'GB', n: 5 }]); assert.strictEqual(s.kpis.lobbies7d, 2);
  console.log('ok: founder stats maths (new/returning, cohorts, funnel, puzzle health, buyers)');
})().catch(e => { console.error(e); process.exit(1); });
