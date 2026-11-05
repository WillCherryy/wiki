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
