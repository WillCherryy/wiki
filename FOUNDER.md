# Founder cheat sheet (PowerShell)

Run these from the project folder, for example `C:\Users\will\wiki-warmer`.

## One-time per PowerShell window
```powershell
cd C:\Users\will\wiki-warmer
git pull
npm install
$env:WARMER_URL = "https://playwarmer.app"                       # or https://wiki.will-34e.workers.dev
$env:WARMER_KEY = "PASTE-YOUR-ADMIN-KEY"
$env:WIKI_UA    = "Warmer/1.0 (you@example.com)"           # Wikipedia asks scripts to say who they are
```

## Analytics
```powershell
npm run stats                    # summary in the terminal (add -- --days 7 for a week)
```
Or open `/admin.html` on your site and enter the key. Optional cookie-free visit counts: create a Cloudflare Web Analytics
site, copy its token, then
```powershell
(Get-Content config.js) -replace "analytics: ''","analytics: 'PASTE-TOKEN'" | Set-Content -Encoding utf8 config.js
git add config.js; git commit -m "Turn on Cloudflare Web Analytics"; git push
```

## Set the daily puzzle
```powershell
npm run set-puzzle -- --from "Tour de France" --to "India"              # tomorrow, UK date
npm run set-puzzle -- --day 2026-10-28 --from "Mozart" --to "Volcano"   # a specific day
npm run set-puzzle -- --from "Tea" --to "Apollo 11" --dry-run           # check only
npm run set-puzzle -- --list                                            # what is set
npm run set-puzzle -- --clear 2026-10-28                                # undo a day
```
The tool refuses any pair that cannot be solved in four clicks or fewer. The browser version is `/admin-puzzles.html`.

## When does it go live?
Each player's puzzle changes at midnight on their own device clock (UK players at UK midnight). The server hands out a
hand-picked puzzle from the day before, so setting tomorrow's puzzle any time today is enough. No schedule or cron is involved.
A day with nothing set uses the scheduled puzzle, then an automatic pick.

## Deploy
```powershell
git pull
npx wrangler deploy
```
