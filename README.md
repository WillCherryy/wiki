# wiki.io

A daily Wikipedia link race with par, replays, friend challenges, companion packs, cosmetics and leagues.
No accounts: progress lives on the player's device (with a backup code).

## Layout
| Path | What |
|---|---|
| `index.html`, `clean.js`, `cats.js`, `packs.js` | The game (static, no build step) |
| `config.js` | **Edit first:** operator name, contact email, API base URL |
| `privacy.html`, `terms.html` | Legal pages (read `config.js`) |
| `server.js` | Leaderboard / league / path-map API (zero-dependency Node, JSON file storage) |
| `tools/` | Puzzle builders (run by CI against real Wikipedia) and an offline test |
| `.github/workflows/` | `pages.yml` deploys the site, `puzzles.yml` builds puzzles weekly, `test.yml` |

## Run locally
    node server.js            # http://localhost:3000 (PORT env var optional), serves the game and the API

## Go live (GitHub Pages + API)
1. Edit `config.js`: set `operator` and `contact` (the legal pages show a red draft banner until you do).
2. Repo Settings → Pages → Source: **GitHub Actions**. Push to `main` and `pages.yml` deploys.
3. Actions → **Build puzzles** → Run workflow (first run builds the article pools, schedules ~45 days of puzzles and verifies the packs).
4. Custom domain: add a `CNAME` file containing your domain, point DNS at GitHub Pages, tick "Enforce HTTPS".
5. Leaderboards, leagues and path maps need the API (`server.js`) running somewhere with HTTPS; set its URL as `api` in `config.js`.
   GitHub Pages alone is static, so without the API those features show "offline" and everything else works.

## Content pipeline (local, optional)
    npm install
    export WIKI_UA="wiki.io/1.0 (you@example.com)"
    node tools/build-pool.js        # pool.json (~10k) + daily-pool.json (~1k) from Vital Articles
    node tools/build-puzzles.js     # puzzles.json (resumable)
    node tools/build-packs.js       # packs.json
    npm test                        # offline test against a fake Wikipedia API

## Notes
- Rewarded video: `Ads.rewarded()` in `index.html` is a placeholder; define `window.WIKIIO_ADS = { rewarded: () => Promise<boolean> }` to plug in a provider.
- Article text is Wikipedia content under CC BY-SA 4.0; attribution is shown on every article. Not affiliated with Wikipedia or the Wikimedia Foundation.
