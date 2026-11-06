# Scorcher Build backend

A Cloudflare Worker, **separate from the race's** (`../wrangler.toml`), so customer data and its secrets never share a blast radius with the game.

```
Worker (src/index.ts)           routes, admin key, trial tokens, model proxy
  Durable Object per trial      src/trial.ts: serialised calls, SQLite state, hash-chained audit trace
  D1                            tasks and trials (migrations/)
  R2                            customer files, one prefix per task
core (src/core/)                no Cloudflare types: the same code runs in the Worker and in tests
```

The tools, sandbox, policy, audit chain, grading and model loop are ported from `../harness/`; a trace written by either verifies in the other (a test checks it). The model loop calls Claude with the key held as a Worker secret; nothing falls back to another model.

## Develop

```powershell
cd backend
npm install
"BUILD_ADMIN_KEY=dev-admin-key-local-only" | Out-File -Encoding ascii .dev.vars   # git-ignored
npm run migrate:local
npx wrangler dev                      # http://localhost:8787
node scripts/smoke.mjs                # in another window: the whole flow on the real Workers runtime
npm run typecheck ; npm test          # also run by the root `npm test`
```

## Deploy (once, then `npm run deploy`)

```powershell
npx wrangler login
npx wrangler d1 create scorcher-build              # copy the printed id into wrangler.toml
npx wrangler r2 bucket create scorcher-build-files # R2 must be enabled on the account first
npm run migrate
npx wrangler secret put BUILD_ADMIN_KEY            # a long random string
npx wrangler secret put ANTHROPIC_API_KEY          # needed only for /api/trials/:id/run
npm run deploy
```

Secrets are stored encrypted by Cloudflare and survive deploys. Decide the subdomain, then uncomment `routes` in `wrangler.toml`.

## API (admin key, except a trial's own calls)

| | |
|---|---|
| `GET /health` | status, and whether the secrets are set (never their values) |
| `POST /api/tasks` | a task spec (`src/core/types.ts`); returns the upload URLs |
| `PUT /api/tasks/:id/files/*` | a file declared in the spec (size-capped, content-length required) |
| `POST /api/trials` | `{taskId}`: creates a trial, returns its one-time token |
| `POST /api/trials/:id/call` | `{tool, args}` with the **trial token** |
| `GET /api/trials/:id/trace`, `/score` | the audit chain (verified) and the grade |
| `POST /api/trials/:id/run` | `{model, prompt}`: a model works the trial, with a spend cap |

## Not built yet (see `../docs/BUILD-ARCHITECTURE.md`)

Real accounts and tenants (one `dev` tenant, one admin key); an MCP endpoint at the edge; queues for long runs (the run endpoint is synchronous); per-tenant encryption; the Resource Monte Carlo and the other domain tools (only the file, table and unit tools are ported); the QGIS adapter service.


## Pages on the same host

`build.playscorcher.com` serves everything from this one Worker: the landing page at `/`, the console at `/console` (static files built into `public/` from `mockups/suite` by `scripts/build-public.mjs`, which `npm run deploy` runs first), and the API, sign-in and health from the Worker's code (`/api/*`, `/auth/*`, `/health`). One origin means the sign-in cookie works in the console without any cross-site rules. On this host "Start a trial" opens the email sign-in.

## Accounts: sign in by emailed link (the default)

People type their email at `GET /auth/signin` and get a link. The link opens a page with a "Sign in" button; only pressing it (a same-origin POST) signs in, because mail scanners such as Outlook Safe Links open every link in an email and would otherwise spend it or sign in themselves. Links are 256-bit random tokens, valid for 15 minutes, single use, stored only as SHA-256. Every address gets the same reply, so the form cannot reveal who has an account, and requests are limited to 5 per address and 20 per client per hour. Each person gets a private workspace at first sign-in. Google and Microsoft sign-in (below) stay available, off until their secrets are set, for when a firm wants single sign-on with Office 365.

Set up once:

1. Create a free account at resend.com and verify a sending domain (it asks you to add a few DNS records at your domain registrar; `scorcher.dev` when you have it, or a subdomain of `playscorcher.com` until then).
2. Create an API key in Resend, then `npx wrangler secret put RESEND_API_KEY`.
3. In `wrangler.toml` set `EMAIL_FROM = "Scorcher <signin@your-verified-domain>"`, plus `PUBLIC_URL` and `APP_URL`.
4. `npx wrangler secret put SESSION_SECRET` (a long random string), `npm run migrate`, `npm run deploy`, then open `PUBLIC_URL/auth/signin`.

`/health` shows `email: true` once both are set.

## Accounts: sign in with Google or Microsoft

People sign in with a Google or Microsoft account (OpenID Connect, authorization code flow with PKCE). The Worker verifies each ID token itself: RS256 signature against the provider's published keys, issuer (for Microsoft, the account's own tenant), audience, expiry, issue time, the nonce it issued, and for Google a verified email. Sessions are random 256-bit tokens in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; only their SHA-256 is stored. Requests that change data with a session must come from `APP_URL`'s origin. At first sign-in each person gets a private workspace (an organisation); teams join by invitation, never by email domain, because Microsoft does not guarantee its email claim is verified. The admin key keeps working for scripts.

Routes: `GET /auth/google/start`, `GET /auth/microsoft/start` (the two "Sign in with" buttons link here), the matching `/callback`s, `POST /auth/logout`, `GET /api/me`.

Set up once (the owner):

1. Decide the backend's address and set `PUBLIC_URL` and `APP_URL` in `wrangler.toml`.
2. **Google:** Google Cloud console, APIs and services, Credentials, Create credentials, OAuth client ID, type Web application. Authorised redirect URI: `PUBLIC_URL/auth/google/callback`. Configure the consent screen (app name Scorcher Build, scopes openid, email, profile). Then `npx wrangler secret put GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
3. **Microsoft:** Microsoft Entra admin centre, App registrations, New registration. Supported account types: accounts in any organisational directory and personal Microsoft accounts. Redirect URI (Web): `PUBLIC_URL/auth/microsoft/callback`. Certificates and secrets, New client secret. Then `npx wrangler secret put MICROSOFT_CLIENT_ID` (the Application ID) and `MICROSOFT_CLIENT_SECRET`.
4. `npx wrangler secret put SESSION_SECRET` (a long random string), then `npm run migrate` (adds the accounts tables) and `npm run deploy`.

`/health` reports which of these are set. Tests (`test/auth.test.ts`) cover the full flow against a fake provider, and refusal of a forged signature, wrong audience, expired token, replayed nonce, wrong issuer or tenant, unverified Google email, the "none" algorithm and a forged state.
