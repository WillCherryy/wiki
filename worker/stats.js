// Founder dashboard maths. Pure functions over plain rows, shared by the Worker (D1) and the dev server (JSON file).
const DAY_MS = 864e5;
const parse = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fmt = ms => new Date(ms).toISOString().slice(0, 10);
export const shiftDay = (d, n) => fmt(parse(d) + n * DAY_MS);
const monday = d => { const t = parse(d), dow = (new Date(t).getUTCDay() + 6) % 7; return fmt(t - dow * DAY_MS); };
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);

// activity: [{day, pid, started, finished, daily_started, daily_won, shared}] for the window (and a little before it)
// firsts: Map pid -> first day ever seen. counters: [{day, k, n}]. scores: [{day, clicks, secs}]. orders: [{created_at}]. reports: [{created_at, day, mode, from_title, to_title, reason, note}]
export function computeStats({ today, days = 30, activity, firsts, counters, scores, orders, reports, acq = [] }) {
  days = Math.max(1, Math.min(120, days));
  const start = shiftDay(today, -(days - 1)), list = Array.from({ length: days }, (_, i) => shiftDay(start, i));
  const byDay = new Map(list.map(d => [d, { day: d, players: 0, newPlayers: 0, returning: 0, started: 0, finished: 0, shared: 0, visits: 0 }]));
  const pidDays = new Map();                                       // pid -> Set(day) over everything we were given
  for (const r of activity) { (pidDays.get(r.pid) || pidDays.set(r.pid, new Set()).get(r.pid)).add(r.day); }
  for (const r of activity) {
    const row = byDay.get(r.day); if (!row) continue;
    row.players++; row.started += r.started ? 1 : 0; row.finished += r.finished ? 1 : 0; row.shared += r.shared ? 1 : 0;
    if (firsts.get(r.pid) === r.day) row.newPlayers++; else row.returning++;
  }
  for (const c of counters) if (c.k === 'visit' && byDay.has(c.day)) byDay.get(c.day).visits = c.n;
  const series = list.map(d => byDay.get(d)), sum = k => series.reduce((a, r) => a + r[k], 0);

  // funnel over the window, in sessions and player-days: visits -> started -> finished -> shared
  const visits = sum('visits'), st = sum('started');
  const funnel = [['Visited the site', Math.max(visits, st)], ['Started a puzzle', st], ['Solved one', sum('finished')], ['Shared the result', sum('shared')]];

  // cohorts: players grouped by the week they first appeared; day-N retention is "active exactly N days after first day", shown only once every member could have returned
  const cohorts = new Map();
  for (const [pid, first] of firsts) { if (first < shiftDay(today, -90)) continue; const w = monday(first); (cohorts.get(w) || cohorts.set(w, []).get(w)).push([pid, first]); }
  const retention = [...cohorts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 8).map(([week, members]) => {
    const out = { week, players: members.length };
    for (const n of [1, 7, 30]) {
      const mature = members.every(([, f]) => shiftDay(f, n) < today);   // the day N after the last joiner has fully passed
      out['d' + n] = mature ? pct(members.filter(([pid, f]) => (pidDays.get(pid) || new Set()).has(shiftDay(f, n))).length, members.length) : null;
    }
    return out;
  });

  // daily puzzle health, last 7 days
  const puzzles = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDay(today, -i), act = activity.filter(r => r.day === d), st = act.filter(r => r.daily_started).length, won = act.filter(r => r.daily_won).length;
    const sc = scores.filter(s => s.day === d), rep = reports.filter(r => r.day === d);
    puzzles.push({ day: d, started: st, won, winRate: pct(won, st), avgClicks: sc.length ? Math.round(sc.reduce((a, s) => a + s.clicks, 0) / sc.length * 10) / 10 : null, medianSecs: median(sc.map(s => s.secs)), reports: rep.length, title: rep[0] ? `${rep[0].from_title} → ${rep[0].to_title}` : null });
  }

  // buyers per week (last 8 weeks)
  const wk = new Map(); for (let i = 7; i >= 0; i--) wk.set(monday(shiftDay(today, -7 * i)), 0);
  for (const o of orders) { const w = monday(fmt(o.created_at)); if (wk.has(w)) wk.set(w, wk.get(w) + 1); }
  const buyers = [...wk.entries()].map(([week, n]) => ({ week, buyers: n }));

  const cc = new Map(); for (const c of counters) if (c.k.startsWith('c:') && c.day >= start && c.day <= today) cc.set(c.k.slice(2), (cc.get(c.k.slice(2)) || 0) + c.n);
  const countries = [...cc.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, n }));
  const lobbies = list.slice(-7).map(d => ({ day: d, created: (counters.find(c => c.day === d && c.k === 'lobby') || { n: 0 }).n }));

  // traffic sources: visits (sessions) per channel from the counters, and what the players who arrived through each channel went on to do
  const win = c => c.day >= start && c.day <= today, cnt = pre => { const m = new Map(); for (const c of counters) if (c.k.startsWith(pre) && win(c)) m.set(c.k.slice(pre.length), (m.get(c.k.slice(pre.length)) || 0) + c.n); return m; };
  const sv = cnt('s:'), srcMap = new Map(), ev = new Map();
  for (const r of activity) { const e = ev.get(r.pid) || ev.set(r.pid, { started: 0, finished: 0 }).get(r.pid); e.started = e.started || r.started; e.finished = e.finished || r.finished; }
  for (const a of acq) {
    if (a.first_day < start || a.first_day > today) continue;
    const o = srcMap.get(a.src) || srcMap.set(a.src, { src: a.src, newPlayers: 0, started: 0, finished: 0, returned: 0 }).get(a.src), e = ev.get(a.pid) || { started: 0, finished: 0 };
    o.newPlayers++; o.started += e.started ? 1 : 0; o.finished += e.finished ? 1 : 0; o.returned += (pidDays.get(a.pid) || new Set()).size >= 2 ? 1 : 0;
  }
  for (const k of sv.keys()) if (!srcMap.has(k)) srcMap.set(k, { src: k, newPlayers: 0, started: 0, finished: 0, returned: 0 });
  const sources = [...srcMap.values()].map(o => ({ ...o, visits: sv.get(o.src) || 0, playRate: pct(o.started, o.newPlayers), finishRate: pct(o.finished, o.newPlayers), returnRate: pct(o.returned, o.newPlayers) })).sort((a, b) => b.visits + b.newPlayers - (a.visits + a.newPlayers));
  const campaigns = [...cnt('m:').entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, visits]) => ({ name, visits }));
  const devices = [...cnt('d:').entries()].map(([name, n]) => ({ name, n })), mix = { newSessions: (cnt('vn').get('') || 0), returningSessions: (cnt('vr').get('') || 0), bots: (cnt('bot').get('') || 0) };

  const todayRow = byDay.get(today), prevWeek = byDay.get(shiftDay(today, -7));
  return {
    generated: Date.now(), today, days,
    kpis: { playersToday: todayRow.players, playersLastWeek: prevWeek ? prevWeek.players : null, newToday: todayRow.newPlayers, finishedToday: todayRow.finished, finishRate: pct(todayRow.finished, todayRow.started), sharedToday: todayRow.shared, buyers: buyers.reduce((a, b) => a + b.buyers, 0), lobbies7d: lobbies.reduce((a, b) => a + b.created, 0), d1: (retention.find(r => r.d1 != null) || {}).d1 ?? null },
    series, funnel, retention, puzzles, buyers, countries, lobbies, sources, campaigns, devices, mix,
    reports: reports.slice(0, 10).map(r => ({ created_at: r.created_at, mode: r.mode, reason: r.reason, note: r.note, title: `${r.from_title} → ${r.to_title}` }))
  };
}
