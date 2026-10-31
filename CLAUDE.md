# Scorcher

Start by reading `docs/PLATFORM.md`: the platform vision (Wiki race, Scorcher Sky, Scorcher Tree, a later evolution game, Your Sky and Your Tree), current status and next steps. Scorcher Tree's data and evidence rules are in `docs/tree-data.md`.

- Run `npm test` before committing; it includes browser checks of `/sky` and `/tree` (Playwright).
- Dev server: `node server.js` (http://localhost:3000). Tree data: `node tools/build-tree.js`; check it with `node tools/check-tree.js`.
- The owner uses Windows PowerShell and deploys with `git pull origin main` then `npm run deploy`.
- Never invent a date, support value or citation. Label measured, derived, modelled and illustrative values honestly.
- Keep explanations scientifically accurate and brief. UI should be beautiful and clean; educational content rigorous, well developed and of a good difficulty.
- Commit and push only when asked.
