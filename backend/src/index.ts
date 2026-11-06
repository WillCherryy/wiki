// Scorcher Build backend: a Worker separate from the race's. Routes are few and explicit; everything about a trial lives in its Durable Object.
import { TaskSpec, type TaskPrivate, type TaskPublic } from './core/types.ts';
import { sha256 } from './core/chain.ts';
import { canariesOf } from './core/secrets.ts';
import { R2Store, MAX_TABLE } from './core/files.ts';
import { anthropicComplete, runModelLoop, systemPrompt } from './core/model.ts';
import { PRICES } from './core/pricing.ts';
import type { TrialInit } from './core/trial-core.ts';
import type { Env } from './env.ts';
import { handleAuth, currentUser, type AuthConfig, type AuthDeps } from './auth-routes.ts';
import { D1AuthStore } from './core/auth.ts';
import { D1LoginTokens, ResendMailer } from './core/email-login.ts';
import { catalogue, findTask } from './catalogue.ts';
import { handleMcp } from './mcp.ts';
export { Trial } from './trial.ts';

const ADMIN_TENANT = 'dev';   // the admin key's tenant; signed-in people work in their organisation's tenant
const authConfig = (env: Env): AuthConfig => ({ publicUrl: env.PUBLIC_URL ?? 'http://localhost:8787', appUrl: env.APP_URL ?? 'http://localhost:3000/build/console', sessionSecret: env.SESSION_SECRET ?? '',
  clients: { google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET } : undefined,
             microsoft: env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET ? { id: env.MICROSOFT_CLIENT_ID, secret: env.MICROSOFT_CLIENT_SECRET } : undefined } });
const authDeps = (env: Env): AuthDeps => ({ store: new D1AuthStore(env.DB), fetch: (u, i) => fetch(u, i), now: () => Date.now(),
  ...(env.RESEND_API_KEY && env.EMAIL_FROM ? { tokens: new D1LoginTokens(env.DB), mailer: new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM) } : {}) });
// the console is served from APP_URL's origin; it calls this API with the session cookie
const corsFor = (r: Request, env: Env): Record<string, string> => { const o = r.headers.get('origin'), app = env.APP_URL ? new URL(env.APP_URL).origin : null;
  return o && app && o === app ? { 'access-control-allow-origin': o, 'access-control-allow-credentials': 'true', vary: 'origin' } : {}; };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const bearer = (r: Request) => /^Bearer (\S+)$/.exec(r.headers.get('authorization') ?? '')?.[1] ?? '';
// compare digests, not the secrets, and without an early exit
async function safeEqual(a: string, b: string): Promise<boolean> { const [x, y] = await Promise.all([sha256(a), sha256(b)]); let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; }
const isAdmin = async (r: Request, env: Env) => !!env.BUILD_ADMIN_KEY && await safeEqual(bearer(r), env.BUILD_ADMIN_KEY);
const RUNS_PER_DAY = 25;   // Scorcher's agent, per organisation: a spend guard while the service is young
type TrialStub = DurableObjectStub<import('./trial.ts').Trial>;
// one way to start a trial, whatever the task's source: files must already be in R2 under prefix
async function startTrial(env: Env, tenant: string, s: TaskSpec, prefix: string, agent: string | null) {
  const store = new R2Store(env.FILES), canaries: string[] = [];
  for (const f of s.files) if (f.sensitivity === 'restricted') { const o = await store.get(prefix + f.path, MAX_TABLE); if (o) canaries.push(...canariesOf(o.text)); }
  const task: TaskPublic = { id: s.id, title: s.title, statement: s.statement, instructions: s.instructions ?? null, answer: s.answer, files: s.files.map(f => ({ name: f.path, sensitivity: f.sensitivity })), policy: s.policy ?? null, limits: { maxCalls: s.limits?.maxCalls ?? 60, maxCostUsd: s.limits?.maxCostUsd ?? 1 } };
  const priv: TaskPrivate = { reference: s.reference, canaries }, id = hex(8), token = hex(24), init: TrialInit = { id, prefix, task, priv };
  await env.TRIAL.get(env.TRIAL.idFromName(id)).init(init, token);
  await env.DB.prepare('INSERT INTO trials (id, tenant, task_id, created_at, title, agent) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenant, s.id, Date.now(), s.title, agent).run();
  return { id, token };
}
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url), p = url.pathname, m = req.method;
    try {
      if (p === '/health') return json({ ok: true, service: 'scorcher-build', environment: env.ENVIRONMENT, secrets: { anthropic: !!env.ANTHROPIC_API_KEY, admin: !!env.BUILD_ADMIN_KEY, session: !!env.SESSION_SECRET, email: !!(env.RESEND_API_KEY && env.EMAIL_FROM), google: !!env.GOOGLE_CLIENT_ID, microsoft: !!env.MICROSOFT_CLIENT_ID } });
      if (m === 'OPTIONS') { const c = corsFor(req, env); return new Response(null, { status: c['access-control-allow-origin'] ? 204 : 403, headers: { ...c, 'access-control-allow-methods': 'GET, POST, PUT', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' } }); }
      if (p.startsWith('/auth/') || p === '/api/me') {
        if (!env.SESSION_SECRET) return json({ error: 'sign-in is not configured: set SESSION_SECRET' }, 503);
        const r = await handleAuth(req, authConfig(env), authDeps(env)); if (r) { for (const [k, v] of Object.entries(corsFor(req, env))) r.headers.set(k, v); return r; }
      }
      const mcp = /^\/mcp\/([a-f0-9]{16})(?:\/([a-f0-9]{48}))?$/.exec(p);
      if (mcp) {   // an agent connected over MCP: the trial's token, in the path or as a bearer header
        const stub = env.TRIAL.get(env.TRIAL.idFromName(mcp[1]!)), token = mcp[2] ?? bearer(req);
        if (!(await stub.checkToken(token).catch(() => false))) return json({ error: 'a valid trial token is required' }, 401);
        const row = await env.DB.prepare('SELECT title FROM trials WHERE id = ?').bind(mcp[1]).first<{ title: string | null }>();
        return handleMcp(req, stub, `Scorcher Build trial: ${row?.title ?? mcp[1]}. Call task_get for the task.`);
      }
      if (!p.startsWith('/api/')) return json({ error: 'not found' }, 404);
      const call = /^\/api\/trials\/([a-f0-9]{16,64})\/(call|trace|score|run)$/.exec(p);

      // a trial's own agent calls tools with the per-trial token; everything else needs the admin key
      if (call && call[2] === 'call' && m === 'POST') {
        const stub = env.TRIAL.get(env.TRIAL.idFromName(call[1]!)); if (!(await stub.checkToken(bearer(req)).catch(() => false))) return json({ error: 'a valid trial token is required' }, 401);
        const b = await req.json().catch(() => null) as { tool?: unknown; args?: unknown } | null; if (!b || typeof b.tool !== 'string') return json({ error: 'body must be { tool, args }' }, 400);
        const o = await stub.call(b.tool, b.args ?? {}); return new Response(o.ok ? `{"ok":true,"result":${o.text}}` : JSON.stringify({ ok: false, error: o.text }), { status: o.ok ? 200 : 422, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      // who is asking: the admin key (tenant "dev"), or a signed-in person (their first organisation's tenant)
      let TENANT = ADMIN_TENANT;
      const admin = await isAdmin(req, env);
      if (!admin) {
        const user = env.SESSION_SECRET ? await currentUser(req, authDeps(env)) : null; if (!user) return json({ error: 'unauthorised' }, 401);
        if (m !== 'GET' && !corsFor(req, env)['access-control-allow-origin']) return json({ error: 'requests that change data must come from the app' }, 403);   // cookies ride along cross-site; the origin cannot be forged by a browser
        const orgs = await new D1AuthStore(env.DB).orgsOf(user.id); if (!orgs.length) return json({ error: 'no organisation' }, 403);
        TENANT = `org:${orgs[0]!.id}`;
      }

      if (p === '/api/tasks' && m === 'POST') {
        const parsed = TaskSpec.safeParse(await req.json().catch(() => null)); if (!parsed.success) return json({ error: 'invalid spec', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, 400);
        const s = parsed.data; for (const f of s.files) if (f.path.startsWith('/') || f.path.includes('\\') || f.path.split('/').includes('..')) return json({ error: `file "${f.path}": paths must be relative and stay inside the task` }, 400);
        await env.DB.prepare('INSERT INTO tasks (id, tenant, title, domain, spec, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tenant, id) DO UPDATE SET title = excluded.title, domain = excluded.domain, spec = excluded.spec').bind(s.id, TENANT, s.title, s.domain, JSON.stringify(s), Date.now()).run();
        return json({ id: s.id, upload: s.files.map(f => `/api/tasks/${s.id}/files/${f.path}`) }, 201);
      }
      if (p === '/api/tasks' && m === 'GET') {   // the organisation's own tasks; the reference answers never leave the server
        const rows = (await env.DB.prepare('SELECT id, title, domain, spec, created_at FROM tasks WHERE tenant = ? ORDER BY created_at DESC LIMIT 100').bind(TENANT).all<{ id: string; title: string; domain: string; spec: string; created_at: number }>()).results;
        const out = await Promise.all(rows.map(async r => { const s = JSON.parse(r.spec) as TaskSpec;
          const files = await Promise.all(s.files.map(async f => ({ name: f.path, sensitivity: f.sensitivity, uploaded: (await env.FILES.head(`${TENANT}/${s.id}/${f.path}`)) !== null })));
          return { id: r.id, title: r.title, domain: r.domain, statement: s.statement, fields: s.answer.fields.map(f => ({ name: f.name, unit: f.unit ?? null })), files, created_at: r.created_at }; }));
        return json({ tasks: out });
      }
      const up = /^\/api\/tasks\/([a-z0-9-]+)\/files\/(.+)$/.exec(p);
      if (up && m === 'PUT') {
        const row = await env.DB.prepare('SELECT spec FROM tasks WHERE tenant = ? AND id = ?').bind(TENANT, up[1]).first<{ spec: string }>(); if (!row) return json({ error: 'no such task' }, 404);
        const name = decodeURIComponent(up[2]!); if (!(JSON.parse(row.spec) as { files: { path: string }[] }).files.some(f => f.path === name)) return json({ error: 'file is not declared in the spec' }, 400);
        const max = +env.MAX_FILE_BYTES, len = +(req.headers.get('content-length') ?? NaN); if (!Number.isFinite(len) || len > max) return json({ error: `content-length is required and must be at most ${max} bytes` }, 413);
        await env.FILES.put(`${TENANT}/${up[1]}/${name}`, req.body, { httpMetadata: { contentType: 'application/octet-stream' } }); return json({ stored: name, bytes: len });
      }
      if (p === '/api/catalogue' && m === 'GET') {
        return json({ tasks: catalogue().map(c => ({ id: c.spec.id, title: c.spec.title, domain: c.spec.domain, summary: c.summary, skills: c.skills, minutes: c.minutes, statement: c.spec.statement,
          fields: c.spec.answer.fields.map(f => ({ name: f.name, unit: f.unit ?? null })), files: c.spec.files.map(f => ({ name: f.path, sensitivity: f.sensitivity })) })) });
      }
      if (p === '/api/trials' && m === 'POST') {
        const b = await req.json().catch(() => null) as { taskId?: unknown; catalogueId?: unknown; agent?: unknown } | null;
        const agent = b?.agent === 'scorcher' || b?.agent === 'mcp' ? b.agent : null;
        if (b && typeof b.catalogueId === 'string') {
          const c = findTask(b.catalogueId); if (!c) return json({ error: 'no such catalogue task' }, 404);
          const prefix = `${TENANT}/catalogue/${c.spec.id}/`;
          for (const [name, text] of Object.entries(c.files)) await env.FILES.put(prefix + name, text, { httpMetadata: { contentType: 'text/plain' } });
          const t = await startTrial(env, TENANT, c.spec, prefix, agent);
          const base = env.PUBLIC_URL ?? new URL(req.url).origin;
          return json({ trialId: t.id, token: t.token, mcpUrl: `${base}/mcp/${t.id}/${t.token}`, note: 'the token is shown once: it is the agent\'s key to this trial only' }, 201);
        }
        if (!b || typeof b.taskId !== 'string') return json({ error: 'body must be { catalogueId } or { taskId }' }, 400);
        const row = await env.DB.prepare('SELECT spec FROM tasks WHERE tenant = ? AND id = ?').bind(TENANT, b.taskId).first<{ spec: string }>(); if (!row) return json({ error: 'no such task' }, 404);
        const s = JSON.parse(row.spec) as TaskSpec;
        const missing = (await Promise.all(s.files.map(async f => (await env.FILES.head(`${TENANT}/${s.id}/${f.path}`)) ? null : f.path))).filter(Boolean);
        if (missing.length) return json({ error: `upload these files first: ${missing.join(', ')}` }, 409);
        const t = await startTrial(env, TENANT, s, `${TENANT}/${s.id}/`, agent);
        const base = env.PUBLIC_URL ?? new URL(req.url).origin;
        return json({ trialId: t.id, token: t.token, mcpUrl: `${base}/mcp/${t.id}/${t.token}`, note: 'the token is shown once' }, 201);
      }
      if (p === '/api/trials' && m === 'GET') {
        const rows = (await env.DB.prepare('SELECT id, task_id, title, agent, created_at FROM trials WHERE tenant = ? ORDER BY created_at DESC LIMIT 50').bind(TENANT).all<{ id: string; task_id: string; title: string | null; agent: string | null; created_at: number }>()).results;
        const out = await Promise.all(rows.map(async r => { const stub = env.TRIAL.get(env.TRIAL.idFromName(r.id)) as TrialStub;
          const [st, sc] = await Promise.all([stub.status().catch(() => null), stub.score().catch(() => null)]);
          return { ...r, status: st, score: sc ? { pass: sc.pass, correct: sc.correct, safe: sc.safe, category: sc.category } : null }; }));
        return json({ trials: out });
      }
      const one = /^\/api\/trials\/([a-f0-9]{16,64})$/.exec(p);
      if ((one || call) && !admin) {   // a person sees only their organisation's trials
        const own = await env.DB.prepare('SELECT 1 AS ok FROM trials WHERE id = ? AND tenant = ?').bind((one ?? call)![1], TENANT).first();
        if (!own) return json({ error: 'no such trial' }, 404);
      }
      if (one && m === 'GET') {
        const stub = env.TRIAL.get(env.TRIAL.idFromName(one[1]!)) as TrialStub;
        const [st, sc, tr, row] = await Promise.all([stub.status(), stub.score(), stub.trace(), env.DB.prepare('SELECT task_id, title, agent, created_at FROM trials WHERE id = ?').bind(one[1]).first()]);
        const cat = row ? findTask(String((row as { task_id: string }).task_id)) : null;   // the grade's checks already show answer against reference
        return json({ trial: row, status: st, score: sc, ...JSON.parse(tr), reference: st.done && cat ? cat.spec.reference : null });
      }
      if (call) {
        const stub = env.TRIAL.get(env.TRIAL.idFromName(call[1]!)) as TrialStub;
        if (call[2] === 'trace' && m === 'GET') return new Response(await stub.trace(), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
        if (call[2] === 'score' && m === 'GET') return json(await stub.score());
        if (call[2] === 'run' && m === 'POST') {   // a model works the trial with Scorcher's key (route 2); long runs belong on a queue (next step)
          if (!env.ANTHROPIC_API_KEY) return json({ error: "Scorcher's agent is not switched on yet: the owner sets ANTHROPIC_API_KEY on the scorcher-build Worker" }, 503);
          const since = Date.now() - 864e5, used = await env.DB.prepare('SELECT COUNT(*) AS n FROM trials WHERE tenant = ? AND ran_at > ?').bind(TENANT, since).first<{ n: number }>();
          if (!admin && (used?.n ?? 0) >= RUNS_PER_DAY) return json({ error: `the daily limit of ${RUNS_PER_DAY} agent runs is reached; try again tomorrow` }, 429);
          if ((await stub.status()).done) return json({ error: 'this trial is finished; start a new one' }, 409);
          await env.DB.prepare('UPDATE trials SET ran_at = ?, agent = ? WHERE id = ?').bind(Date.now(), 'scorcher', call[1]).run();
          const b = await req.json().catch(() => ({})) as { model?: string; prompt?: 'baseline' | 'hardened' }, model = b.model ?? 'claude-haiku-5-5'; if (!PRICES[model]) return json({ error: `no price for ${model}` }, 400);
          let done = false;
          const run = await runModelLoop({ complete: await anthropicComplete(env.ANTHROPIC_API_KEY), model, system: systemPrompt(b.prompt === 'hardened' ? 'hardened' : 'baseline'), maxCostUsd: 1, isDone: () => done,
            callTool: async (name, input) => { const o = await stub.call(name, input); if (name === 'submit_answer' && o.ok && o.text.includes('"accepted":true')) done = true; return o; } });
          return json({ status: await stub.status(), run, score: await stub.score() });
        }
      }
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: 'internal error', detail: e instanceof Error ? e.message : String(e) }, 500); }
  },
} satisfies ExportedHandler<Env>;
