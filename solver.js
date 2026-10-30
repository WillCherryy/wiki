// Finds verified shortest routes between two articles using only links a player can click.
// Shared by the offline tools (Node) and the founder's puzzle page (browser): both pass in a graph client `g`
// with norm(t), playable(t) -> {title, links, set} | null, outLinks(titles) -> Map, inLinks(title, cap) -> [titles].
//
// Candidate routes are enumerated from the API link graph (a superset of playable links, so no playable route is
// missed) with a meet-in-the-middle search, then each hop is verified against the playable (cleaned) article.
// "par" is the length of the shortest verified route found. `alts` asks for further distinct routes of that same length.
(function (root) {
  function makeSolver(g) {
    const { norm } = g;
    async function verify(route) {
      for (let i = 0; i < route.length - 1; i++) {
        const p = await g.playable(route[i]);
        if (!p || !p.set.has(norm(route[i + 1]))) return false;
      }
      return true;
    }

    async function findRoute(a, b, { maxPar = 4, verifyCap = 400, b2Mids = 150, alts = 0, altCap = 60, log = () => {}, onStep = () => {} } = {}) {
      const pa = await g.playable(a), pb = await g.playable(b);
      if (!pa || !pb) return null;
      const A = pa.title, B = pb.title, nb = norm(B), na = norm(A);
      if (na === nb) return null;
      const want = 1 + alts;
      const done = (par, found) => ({ par, route: found[0], alts: found.slice(1) });
      // collects verified routes for one level; `tryRoute` returns true once enough are found or the extra budget is spent
      const level = () => {
        const found = [], seen = new Set(); let extra = 0;
        return {
          found,
          async add(route) {
            const k = route.map(norm).join('>'); if (seen.has(k)) return false; seen.add(k);
            if (!(await verify(route))) return false;
            found.push(route); return true;
          },
          full() { return found.length >= want; },
          spent() { if (found.length) extra++; return found.length >= want || (found.length && extra > altCap); }
        };
      };

      if (pa.set.has(nb)) return done(1, [[A, B]]);

      onStep('Reading ' + A);
      const F1 = pa.links.filter(t => norm(t) !== na && norm(t) !== nb);
      onStep('Finding pages that link to ' + B);
      const inB = await g.inLinks(B);
      const B1 = new Map(inB.map(t => [norm(t), t]));
      log(`  ${A}: ${F1.length} playable links, ${B1.size} backlinks to ${B}`);

      // par 2
      let L = level(), tried = 0;
      for (const m of F1) {
        if (!B1.has(norm(m))) continue;
        if (++tried > verifyCap) break;
        await L.add([A, m, B]); if (L.spent()) break;
      }
      if (L.found.length) return done(2, L.found);
      // the list of pages linking to a very popular target is cut short, so also read what each of a's links links to (needed for par 3 anyway)
      onStep('Looking for 3-click routes');
      const out = await g.outLinks(F1);
      tried = 0;
      for (const m of F1) {
        if (B1.has(norm(m)) || !(out.get(m) || []).some(t => norm(t) === nb)) continue;
        if (++tried > verifyCap) break;
        await L.add([A, m, B]); if (L.spent()) break;
      }
      if (L.found.length) return done(2, L.found);
      if (maxPar < 3) return null;

      // par 3: a -> m1 -> m2 -> b, with m2 a backlink of b
      L = level(); tried = 0;
      outer3: for (const m1 of F1) {
        for (const m2 of out.get(m1) || []) {
          const n2 = norm(m2);
          if (!B1.has(n2) || n2 === na || n2 === norm(m1)) continue;
          if (++tried > verifyCap) break outer3;
          await L.add([A, m1, m2, B]); if (L.spent()) break outer3;
        }
      }
      if (L.found.length) return done(3, L.found);
      if (maxPar < 4) return null;

      // par 4: a -> m1 -> m2 -> m3 -> b, m3 a backlink of b, m2 a backlink of m3 (sampled)
      onStep('Looking for 4-click routes (this can take a minute)');
      const B2 = new Map(); // m2 -> backlinks-of-b it can reach (several, so a non-playable hop does not hide a playable one)
      for (const m3 of [...B1.values()].slice(0, b2Mids)) {
        for (const m2 of await g.inLinks(m3, 800)) { const k = norm(m2); if (!B2.has(k)) B2.set(k, []); B2.get(k).push(m3); }
      }
      L = level(); tried = 0;
      outer4: for (const m1 of F1) {
        for (const m2 of out.get(m1) || []) {
          if (norm(m2) === na || norm(m2) === norm(m1)) continue;
          for (const m3 of B2.get(norm(m2)) || []) {
            if (norm(m3) === na || norm(m3) === norm(m1) || norm(m3) === norm(m2)) continue;
            if (++tried > verifyCap) break outer4;
            await L.add([A, m1, m2, m3, B]); if (L.spent()) break outer4;
          }
        }
      }
      return L.found.length ? done(4, L.found) : null;
    }
    return { findRoute, verify };
  }
  const api = { makeSolver };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WikiSolver = api;
})(typeof window !== 'undefined' ? window : globalThis);
