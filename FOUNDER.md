# Founder cheat sheet (PowerShell)

Run these from the project folder, for example `C:\Users\will\wiki-warmer`.

## One-time per PowerShell window
(Windows PowerShell 5 can corrupt the pound sign when it rewrites files, so the snippets below use .NET methods that keep UTF-8 intact. If `git pull --rebase` complains about unstaged changes, run `git stash` first, or `git reset --hard origin/main` if you have nothing worth keeping.)
```powershell
cd C:\Users\will\wiki-warmer
git pull
npm install
$env:WARMER_URL = "https://playscorcher.com"                       # or https://wiki.will-34e.workers.dev
$env:WARMER_KEY = "PASTE-YOUR-ADMIN-KEY"
$env:WIKI_UA    = "Scorcher/1.0 (you@example.com)"           # Wikipedia asks scripts to say who they are
```

## Analytics
```powershell
npm run stats                    # summary in the terminal (add -- --days 7 for a week)
```
Or open `/admin.html` on your site and enter the key. Optional cookie-free visit counts: create a Cloudflare Web Analytics
site, copy its token, then
```powershell
$c = [IO.File]::ReadAllText("$PWD\config.js")
$c = $c.Replace("analytics: ''", "analytics: 'PASTE-TOKEN'")
[IO.File]::WriteAllText("$PWD\config.js", $c, (New-Object Text.UTF8Encoding $false))
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

## Take payments with Stripe (Supporter pack, £2.99)
Nothing to install: the site already understands Stripe. You only need a Payment Link and a webhook. Do everything in **test mode** first (the toggle at the top of the Stripe dashboard).
1. **Product.** Product catalogue, Add product: "Scorcher Supporter Pack", one-off price £2.99 GBP.
2. **Payment Link.** Payment Links, New: pick that product, switch off adjustable quantity, and under "Require customers to accept your terms" add `https://playscorcher.com/terms.html`. Copy the link (it looks like `https://buy.stripe.com/test_...`).
3. **Give the link to the site.** The `?client_reference_id={pid}` part is how Stripe tells us which player paid. Replace the link below with yours:
```powershell
$c = [IO.File]::ReadAllText("$PWD\config.js")
$c = $c.Replace("checkoutUrl: ''", "checkoutUrl: 'https://buy.stripe.com/test_XXXX?client_reference_id={pid}'")
[IO.File]::WriteAllText("$PWD\config.js", $c, (New-Object Text.UTF8Encoding $false))
git add config.js; git commit -m "Turn on the Supporter pack (Stripe test mode)"; git push
```
4. **Webhook.** Developers, Webhooks, Add endpoint: `https://playscorcher.com/api/webhook/stripe`, events `checkout.session.completed` and `charge.refunded`. Reveal the signing secret (`whsec_...`) and store it:
```powershell
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```
5. **Test.** Open the site, Menu, Support, tick the consent box, Buy. Use card `4242 4242 4242 4242`, any future date, any CVC. Back on the site the menu should say Supporter within a minute (or press "I have paid, check my purchase").
6. **Go live.** Switch the dashboard to live mode, repeat steps 1 to 4 (live products, link and webhook have their own ids and secret), put the live link in `config.js` and the live secret in Cloudflare.
You never need to share or store a Stripe secret key (`sk_...`) for this. The publishable key (`pk_...`) is not used by Payment Links. Full refunds in Stripe remove the pack automatically.
Tax: Stripe is only the payment processor, so you are the seller. In the UK you do not charge VAT until your taxable turnover passes the VAT registration threshold (£90,000 at the time of writing, check gov.uk), but keep records. Selling to EU consumers has its own rules, so get advice before you grow.
Using Lemon Squeezy or Paddle instead? Set `paymentProvider: 'lemonsqueezy'` in `config.js` so the legal pages say they are the seller. Their webhook is `/api/webhook/lemonsqueezy` with the secret `LS_SIGNING_SECRET`.

## Turn on the watch-a-video rewind (optional, needs approval)
Without this, every player simply gets one free rewind per puzzle and nobody sees a video. To use Google AdSense for Games:
1. Apply at adsense.google.com with `https://playscorcher.com`, add the site, and apply for the games/rewarded ads programme. Approval can take weeks and usually wants steady traffic.
2. In AdSense turn on the consent message (Privacy and messaging) for the UK and EEA, which Google requires.
3. Put your publisher id in `config.js` and your `ads.txt` line in the repo root (AdSense shows both):
```powershell
$c = [IO.File]::ReadAllText("$PWD\config.js")
$c = $c.Replace("adsenseClient: ''", "adsenseClient: 'ca-pub-0000000000000000'")
[IO.File]::WriteAllText("$PWD\config.js", $c, (New-Object Text.UTF8Encoding $false))
Set-Content -Encoding ascii ads.txt "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
git add config.js ads.txt; git commit -m "Turn on the rewarded video"; git push
```
4. While testing, also set `adsenseTest: true` in `config.js` so Google shows test ads, then set it back to false.
Nothing from Google loads until a player taps Watch video. If no ad is available, or an ad blocker is on, the rewind is simply granted.
