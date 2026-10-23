// Validation for hand-picked daily puzzles, shared by the Worker and the dev server.
// Every puzzle must be solvable in four clicks or fewer, and the stored route is the proof.
const DAY = /^\d{4}-\d{2}-\d{2}$/, norm = t => String(t).replace(/_/g, ' ').trim().toLowerCase();
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
const okRoute = (r, from, to) => Array.isArray(r) && r.length >= 2 && r.length <= 5 && r.every(x => typeof x === 'string' && clean(x)) && norm(r[0]) === norm(from) && norm(r[r.length - 1]) === norm(to) && new Set(r.map(norm)).size === r.length;

// returns {ok: true, value} or {ok: false, error}
export function checkOverride(b) {
  if (!b || !DAY.test(b.day)) return { ok: false, error: 'bad day' };
  const from = clean(b.from), to = clean(b.to);
  if (!from || !to || norm(from) === norm(to)) return { ok: false, error: 'bad titles' };
  if (!okRoute(b.route, from, to)) return { ok: false, error: 'the route must start at the start article, end at the target, and have 4 clicks or fewer' };
  const route = b.route.map(clean), par = route.length - 1;
  if (b.par != null && b.par !== par) return { ok: false, error: 'par does not match the route' };
  const alts = (Array.isArray(b.alts) ? b.alts : []).slice(0, 2);
  for (const a of alts) if (!okRoute(a, from, to)) return { ok: false, error: 'a second route is not valid' };
  return { ok: true, value: { day: b.day, from, to, par, route, alts: alts.map(a => a.map(clean)) } };
}
