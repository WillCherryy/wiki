# Scorcher: platform vision and plan

The owner's own words for the goal: develop Scorcher into a coherent platform for **intellectual exploration**, built on the existing Wikipedia race game and astronomy explorer. Priorities: elegant design, intuitive interaction, scientific accuracy. Each game must be enjoyable without its rewards; each explorer must be useful without playing; not every game needs a matching explorer.

Preferences that apply to all work here: keep explanations scientifically accurate, brief and to the point; make website UI beautiful and clean; make educational content high quality, rigorous, at a good difficulty level and well developed.

## Products and audiences

| Path | Product | Audience | Rewards |
|---|---|---|---|
| `/` (and `/p/...`, `/find/...`) | **Wiki race**: the daily Wikipedia link race, with par, replays, friends rooms, streamer lobbies, packs, leagues | General public | Collect astronomy objects into **Your Sky** |
| `/sky` | **Scorcher Sky**: the whole universe, nothing to unlock | Students and researchers (also schools) | None |
| `/tree` | **Scorcher Tree**: the evolutionary tree explorer, vertebrates first | Students and researchers | None on the explorer itself |
| later | **Evolution game**: a distinctive deduction game, inspired by Metazooa in principle (clue currency is evolutionary distance); original mechanic, not a copy | General public | Awards organisms to **Your Tree** |
| later | **Your Tree** | Players | Reward-based overlay highlighting collected organisms inside their true evolutionary relationships |

- **Your Sky** (personal collection, earned through play) and **Scorcher Sky** (the full explorer) are two views of one engine. A change to the renderer, data or viewers must show up in both. Same intention for **Your Tree** and **Scorcher Tree**.
- Reward-based means Your Sky and Your Tree; the base explorers stay reward-free.
- The astronomy rewards in the Wiki race are a bonus and should stay optional. A natural bridge is deep links: an article about a star opens it in Sky, one about a species opens it in Tree.
- One domain with paths. The current domain is `playscorcher.com` (all that was available). The owner worries "play" suggests games only, undersells the explorers and may put off schools; a neutral name such as `scorcher` is preferred if one can be had. Because products live on paths, moving later is a redirect. **Open decision.**
- Later: connect to the owner's educational platform, **Demosthenes Academy**, for deeper explanations and practice. Start with deep links from explanations to lessons; build no login integration until there is a clear need. Needs stable entry IDs in Sky and Tree first. Nothing built yet.

## Architecture

Separate data from game state:
- **Catalogues** (stars, planets, organisms, facts) are plain data. Each entry has an ID, sources, and a measured-vs-modelled flag.
- **Explorers** are views over catalogues. No account, no progress.
- **Your Sky / Your Tree** are overlays asking which entries the player collected. They never change the data.
- **Games** read catalogues and write progress. Rewards live only here.

Stack: static site (`index.html`, `sky.html`, `tree.html`, shared JS and CSS), built by `tools/build-site.js` into `dist/`; one Cloudflare Worker (`worker/`) serving the site and API with D1 and a Durable Object for lobbies; `server.js` is the dev server mirroring the Worker routes. Deploy: `npm run deploy` (pulls main, builds, runs wrangler, verifies `/build.txt`). Tests: `npm test`. The owner develops on Windows (PowerShell).

Shared sky engine: `skyobjects.js` (renderer and data), `universe.js` (pannable map `uniMap`, planet globe, close-up viewer, display menu), `observatory.js` (Your Sky: observatory, collection catalogue, size comparison, sound). `sky-app.js` and `sky.css` are only the scientific interface around them.

## Status

**Wiki race and Your Sky:** live and mature. Friends rooms and streamer lobbies were fixed (the Workers runtime rejects an unbound global timer, regression-tested). Planets sit at real positions via simplified orbital elements; airless worlds use Minnaert lighting.

**Scorcher Sky (`/sky`): built.** Everything unlocked; every value tagged Published, Derived, Modelled or Illustrative; Essentials and Full data modes with numbered source notes; RA/Dec (J2000) and galactic coordinates; coordinate and name search; tap empty sky to identify one of 756,000 Gaia/HYG catalogue stars (positions stored only to ~0.84 ly, so the page states the uncertainty and links SIMBAD); scale ruler; UTC clock; Data and methods panel; phone layout; shareable links.
Known limits (stated on the page): named-object values are rounded literature values without per-value citations; planet positions about 1 degree, the Moon's up to about 6 degrees; no arbitrary date.
- **Decided, not yet done:** replace the simplified planet and Moon positions with **astronomy-engine** (MIT licence), giving any date and time and RA/Dec from Earth; link JPL Horizons for arcsecond work. Deliberately not the first change.
- Later options: per-value citations for the named objects; a **schools** version (brief, classroom mode, child safety, curriculum fit, accessibility, measured-vs-modelled labelling); galaxy, neutron star, white dwarf and exoplanet detail upgrades; real lunar relief from LRO elevation data. An open question from the owner: Moon "wobble" (needs the planet, zoom level and whether the disc or the label moves).

**Scorcher Tree (`/tree`): built, on the Open Tree topology, with checked ages.** See `docs/tree-data.md` for the full evidence rules. Summary: a selected tree (91 vertebrates), canvas explorer with smooth zoom, collapsible groups, search, two-species comparison to the last common ancestor, an inspector showing relationship status, competing hypotheses and three kinds of age evidence (fossil minimum, soft maximum, molecular clock) never merged, deep links, and a geological time axis that switches on by itself once most branch points have published ages. `tools/build-tree.js` builds `treedata/vertebrates.json`; `tools/check-tree.js` enforces the rules (no number without a citation, displayed ages only from published intervals, no invented midpoints, polytomies stay unresolved, debates named, images freely licensed and credited).
- Topology from the Open Tree synthesis (opentree16.1); all 91 names match it exactly. The hand-made draft remains only as the offline fallback.
- Ages (October 2026 pass): 10 fossil calibrations read in Benton et al. 2015 and Ezcurra et al. 2014, with taxa, formations and dating; several values corrected. Clock estimates on 84 of 90 branch points: primary studies where their sampling spans the node (Tarver 2016 for 25 mammal nodes, Irisarri 2017 for deep nodes, Claramunt & Cracraft 2015, Stiller 2024), TimeTree 5 for the rest (`tools/fetch-timetree.js`, cached in `tree/timetree.json`). All 8 DOIs verified on Crossref. The time axis is on. No node is yet `reviewed`. Details and what changed: the status section of `docs/tree-data.md`.
- 91/91 species have freely licensed, credited Commons photos; `tree/images.json` holds hand-picked replacements where the Wikidata image's licence or credit could not be used.
- `node tools/check-tree.js --strict` still fails only on 8 uncited competing hypotheses (Placentalia, Archelosauria, Toxicofera).
- Mockups for reference: `mockups/tree/`.

**Evolution game:** not built. `phylo.html` and `phylo-data.js` are an old unlisted prototype (guess when two animals diverged); its dates are unverified and must not be shown to players. `docs/divergence-game.md` has its notes. The intended design is a deduction game integrated with the Tree; it needs an original mechanic and paper playtests before any build.

## Next steps, in order

1. **Tree evidence** (done: Open Tree topology, photos, age checks, clock estimates; see Status). Remaining, in order:
   - Cite the competing hypotheses on the three debated nodes, so strict mode passes.
   - Fossil calibrations for the remaining nodes from Benton et al. 2015 (it covers most of them), and fish clock intervals (Hughes et al. 2018's supplement could not be downloaded from the sandbox).
   - Draft evidence reviews for the 15 to 50 major nodes; each needs a human check before `review: "reviewed"`.
   - Network notes: Open Tree, Crossref, TimeTree, Palaeontologia Electronica, PLOS and Europe PMC are reachable; Wikimedia rate-limits bursts (the build retries); zenodo.org and some publishers return 403.
2. Sky: astronomy-engine positions, then per-value citations.
3. Evolution game: design spike with paper playtests, using the Tree data, before any build.
4. Your Tree overlay, then Wiki race deep links into Sky and Tree.
5. Demosthenes Academy connection.

## Principles to keep

- Never invent a date, support value or citation. Unknown stays unknown and is labelled.
- Label measured, derived, modelled and illustrative honestly; never present a picture as data.
- Check licences and credit every image; Wikipedia text is CC BY-SA, Gaia and HYG terms are in `stars/CREDITS.md`.
- Make claims only after verifying them in the real runtime (an earlier lobby fix was wrongly declared done from the dev server alone).
- Do not commit or push unless asked; do not open pull requests unless asked.
