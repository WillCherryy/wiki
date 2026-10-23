# Warmer API on Cloudflare (Workers + D1)

Same contract as the local dev server (`server.js`). `npm test` runs one test against both.

## One-time setup (about 10 minutes)
1. Install and log in: `npm i -g wrangler && wrangler login`
2. Create the database: `wrangler d1 create warmer`, then paste the printed `database_id` into `wrangler.toml`.
3. Create the tables: `wrangler d1 execute warmer --remote --file=worker/schema.sql`
4. Deploy: `wrangler deploy` (builds `dist/` and ships site + API together as one Worker at `https://warmer.<you>.workers.dev`; leave `api` in `config.js` empty, same origin). With Cloudflare Workers Builds set build command `npm run build:site` (or leave blank, wrangler runs it) and deploy command `npx wrangler deploy`.
5. In `config.js` set `api` to that URL (or a custom domain such as `https://api.warmer.site`, added under Workers → Settings → Domains). Set `ALLOWED_ORIGIN` in `wrangler.toml` to your site's origin.
6. Add a Cloudflare rate-limiting rule for `POST /api/*` (dashboard → Security → WAF) as real abuse protection.

## Supporter pack payments
Pick one provider (both are supported; you only need one). The buyer's anonymous Player ID travels through checkout and comes back in a signed webhook, which is how the purchase is matched to the player. No accounts needed.

### Lemon Squeezy (or similar merchant of record)
1. Create a product "Supporter pack" (£2.99, one-off) and copy its checkout link.
2. Set `checkoutUrl` in `config.js` to the link plus the custom-data parameter, e.g.
   `https://YOURSTORE.lemonsqueezy.com/checkout/buy/PRODUCT-ID?checkout[custom][pid]={pid}`
3. Webhooks → add `https://<your-worker>/api/webhook/lemonsqueezy`, events `order_created` and `order_refunded`, and choose a signing secret.
4. `wrangler secret put LS_SIGNING_SECRET` and paste the same secret.

### Stripe
1. Create a Payment Link for the product and set `checkoutUrl` to it plus `?client_reference_id={pid}`, e.g. `https://buy.stripe.com/XXXX?client_reference_id={pid}`.
2. Developers → Webhooks → add `https://<your-worker>/api/webhook/stripe`, event `checkout.session.completed`.
3. `wrangler secret put STRIPE_WEBHOOK_SECRET` with the endpoint's signing secret (`whsec_...`).
Note: with Stripe you are the seller, so VAT/sales tax is your responsibility (Stripe Tax can help). A merchant of record avoids that.

### Verify before launch
Do a real test purchase with the provider's test mode, and confirm `GET /api/entitlements?pid=<your player id>` returns `{"supporter":true}`.
The webhook formats follow each provider's documentation at the time of writing; check them against the current docs.

## Local development
`DEV=1 node server.js` serves the game and API on one port; `POST /api/dev/supporter {"pid":"...","on":true}` flips supporter status for testing the UI.

## Streamer lobbies
`worker/lobby.js` is a Durable Object (one per lobby, SQLite-backed so it works on the free plan); `wrangler.toml` already declares the binding and migration, so the first `wrangler deploy` creates it. Lobbies need no D1 database.
- Host: **Menu → Live races → Host a lobby**. Paste the viewer link (`/#l=CODE`) in chat; add `/overlay.html?c=CODE` in OBS as a 1920×1080 Browser Source (transparent background; add `&bg=1` to preview on a solid colour).
- Race logic lives in `worker/lobby-core.js` and is shared with the dev server, which speaks WebSocket too, so `node server.js` runs lobbies locally. `npm test` covers the rules and a real WebSocket round trip; the Durable Object wrapper itself can only be verified after deploying.
