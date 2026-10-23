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

## Take payments (Supporter pack, £2.99)
1. Create a Lemon Squeezy store (it is the seller and handles VAT), then a product: one-off payment, £2.99. Use test mode first.
2. Copy the product's checkout link and add the player id to it, then put it in `config.js`:
```powershell
(Get-Content config.js) -replace "checkoutUrl: ''","checkoutUrl: 'https://YOURSTORE.lemonsqueezy.com/buy/PRODUCT-ID?checkout[custom][pid]={pid}'" | Set-Content -Encoding utf8 config.js
git add config.js; git commit -m "Turn on the Supporter pack"; git push
```
3. In Lemon Squeezy go to Settings, Webhooks, add `https://playwarmer.app/api/webhook/lemonsqueezy`, tick `order_created` and `order_refunded`, and choose any long random signing secret. Store the same secret in Cloudflare:
```powershell
npx wrangler secret put LS_SIGNING_SECRET
```
4. Buy it yourself in test mode, then open the site: the menu should say Supporter within a minute. Switch the store to live mode when happy.

## Turn on the watch-a-video rewind (optional, needs approval)
Without this, every player simply gets one free rewind per puzzle and nobody sees a video. To use Google AdSense for Games:
1. Apply at adsense.google.com with `https://playwarmer.app`, add the site, and apply for the games/rewarded ads programme. Approval can take weeks and usually wants steady traffic.
2. In AdSense turn on the consent message (Privacy and messaging) for the UK and EEA, which Google requires.
3. Put your publisher id in `config.js` and your `ads.txt` line in the repo root (AdSense shows both):
```powershell
(Get-Content config.js) -replace "adsenseClient: ''","adsenseClient: 'ca-pub-0000000000000000'" | Set-Content -Encoding utf8 config.js
Set-Content -Encoding ascii ads.txt "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
git add config.js ads.txt; git commit -m "Turn on the rewarded video"; git push
```
4. While testing, also set `adsenseTest: true` in `config.js` so Google shows test ads, then set it back to false.
Nothing from Google loads until a player taps Watch video. If no ad is available, or an ad blocker is on, the rewind is simply granted.
