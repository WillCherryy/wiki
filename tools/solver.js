'use strict';
// Finds a verified shortest route between two articles using only links a player can click.
//
// Candidate routes are enumerated from the API link graph (a superset of playable links, so no
// playable route is missed) with a meet-in-the-middle search, then each hop is verified against
// the playable (cleaned) article. "par" is the length of the shortest verified route found.
const g = require('./wikigraph');
const { norm } = g;

async function verify(route) {
  for (let i = 0; i < route.length - 1; i++) {
    const p = await g.playable(route[i]);
    if (!p || !p.set.has(norm(route[i + 1]))) return false;
  }
  return true;
}

async function findRoute(a, b, { maxPar = 4, verifyCap = 400, b2Mids = 150, log = () => {} } = {}) {
  const pa = await g.playable(a), pb = await g.playable(b);
  if (!pa || !pb) return null;
  const A = pa.title, B = pb.title, nb = norm(B), na = norm(A);
  if (na === nb) return null;
  if (pa.set.has(nb)) return { par: 1, route: [A, B] };

  const F1 = pa.links.filter(t => norm(t) !== na && norm(t) !== nb);
  const inB = await g.inLinks(B);
  const B1 = new Map(inB.map(t => [norm(t), t]));
  log(`  ${A}: ${F1.length} playable links, ${B1.size} backlinks to ${B}`);

  // par 2
  let tried = 0;
  for (const m of F1) {
    if (!B1.has(norm(m))) continue;
    if (++tried > verifyCap) break;
    if (await verify([A, m, B])) return { par: 2, route: [A, m, B] };
  }
  if (maxPar < 3) return null;

  // par 3: a -> m1 -> m2 -> b, with m2 a backlink of b
  const out = await g.outLinks(F1);
  tried = 0;
  for (const m1 of F1) {
    for (const m2 of out.get(m1) || []) {
      const n2 = norm(m2);
      if (!B1.has(n2) || n2 === na || n2 === norm(m1)) continue;
      if (++tried > verifyCap) break;
      if (await verify([A, m1, m2, B])) return { par: 3, route: [A, m1, m2, B] };
    }
    if (tried > verifyCap) break;
  }
  if (maxPar < 4) return null;

  // par 4: a -> m1 -> m2 -> m3 -> b, m3 a backlink of b, m2 a backlink of m3 (sampled)
  const B2 = new Map(); // m2 -> backlinks-of-b it can reach (several, so a non-playable hop does not hide a playable one)
  for (const m3 of [...B1.values()].slice(0, b2Mids)) {
    for (const m2 of await g.inLinks(m3, 800)) { const k = norm(m2); if (!B2.has(k)) B2.set(k, []); B2.get(k).push(m3); }
  }
  tried = 0;
  for (const m1 of F1) {
    for (const m2 of out.get(m1) || []) {
      if (norm(m2) === na || norm(m2) === norm(m1)) continue;
      for (const m3 of B2.get(norm(m2)) || []) {
        if (norm(m3) === na || norm(m3) === norm(m1) || norm(m3) === norm(m2)) continue;
        if (++tried > verifyCap) break;
        if (await verify([A, m1, m2, m3, B])) return { par: 4, route: [A, m1, m2, m3, B] };
      }
      if (tried > verifyCap) break;
    }
    if (tried > verifyCap) break;
  }
  return null;
}

module.exports = { findRoute, verify };
