# Scorcher

Start by reading `docs/PLATFORM.md`: the platform vision (Wiki race, Scorcher Sky, Scorcher Tree, a later evolution game, Your Sky and Your Tree), current status and next steps. Scorcher Tree's data and evidence rules are in `docs/tree-data.md`. The suite scope (landing page, agentic Solar/Wind/Geothermal/Engineering platforms, public API, Tree expansions) is in `docs/SUITE.md`; Scorcher Build's architecture and the working harness (`harness/`, its own `npm install`) are in `docs/BUILD-ARCHITECTURE.md`, its security model (what is enforced, what is not, what cannot be claimed) in `docs/BUILD-SECURITY.md`; the visual system is `docs/DESIGN.md`: three styles. Play (race, `/evolve`, Your Sky, Your Tree) keeps the race's plate (EB Garamond, Jost, the logo); Science (`/sky`, `/tree`, `/tools`) uses Atkinson Hyperlegible Next and Mono; Build is its own brand (Mona Sans, Geist Mono). No all-caps or spaced capitals, no italic emphasis, square corners.

- Run `npm test` before committing; it includes browser checks of `/sky` and `/tree` (Playwright).
- Dev server: `node server.js` (http://localhost:3000). Tree data: `node tools/build-tree.js`; check it with `node tools/check-tree.js`.
- The owner uses Windows PowerShell and deploys with `git pull origin main` then `npm run deploy`.
- Never invent a date, support value or citation. Label measured, derived, modelled and illustrative values honestly.
- Keep explanations scientifically accurate and brief. UI should be beautiful and clean; educational content rigorous, well developed and of a good difficulty.
- Work directly on `main` and push there (the owner's instruction, October 2026); commit and push only when asked.
- Refresh TimeTree ages with `node tools/fetch-timetree.js`; full tree build: `node tools/build-tree.js --otol --images --verify`.
