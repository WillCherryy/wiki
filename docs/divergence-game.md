# Divergence game (prototype): project notes

**Status:** working prototype, unlisted. Not linked from the app and not announced. Live at `/phylo.html` once deployed.

**What it is.** Two animals are shown (for example Lion and Tiger). The player drags a log-scale slider from 100,000 years to 1 billion years to guess when the two lineages split, with three guesses. Each guess gets a temperature word (Cold, Cool, Warm, Hot, Scorching, In sight!) and a direction hint (the split was older or more recent). A guess inside the published range counts as "In sight!". The reveal draws a small tree on a log time axis with the real split, its range, the player's guesses and a few landmarks (Homo sapiens, dinosaurs end, mass extinction, Cambrian), plus the clade name and a one-line fact. The share text is a row of coloured squares.

**Files.** `phylo.html` (the whole game), `phylo-data.js` (35 curated pairs: `ma` best estimate in millions of years, `lo`/`hi` plausible range, `clade`, `fact`), both listed in `tools/build-site.js`. Mockups in `brand/mockups/`, hub mockup source in `mockups/hub.html`.

**Scoring.** Temperature t = 1 if the guess is within [lo, hi], otherwise `max(0, 1 - |log10(guess / ma)| / 0.9)`. The daily pair comes from a fixed shuffle of the data seeded with 2026, starting 2026-11-01. `?pair=<id>` forces a pair and switches to practice mode; `?demo=40,6,3.9` pre-fills guesses (for screenshots).

**Before it is shown to players (must do):**
1. Verify every divergence date and range against TimeTree (timetree.org) and the primary papers. The values in `phylo-data.js` are approximate consensus numbers written from memory for the prototype.
2. Check TimeTree's licence if its data will be used directly; otherwise keep hand-curating from published papers (facts are not copyrightable).
3. Check photo credits. Photos load live from each species' Wikipedia article; keep the credit line and link.
4. Expand to 365+ pairs, or run it as a weekly game, before using it daily.
5. Show uncertainty honestly (ranges), and avoid pairs where the literature disagrees widely.

**Decisions and ideas.**
- Keep one shared streak across games if a hub is built; the hub layout is mocked up (`brand/mockups/hub-mobile.png`, `hub-desktop.png`).
- Do not build the hub until the link race shows healthy next-day and week-later return rates.
- Other "estimate a number" games that fit the same engine: where in the world is this place (distance), and guess the year for freely licensed images from Wikimedia Commons. Film stills are not usable for copyright reasons.
