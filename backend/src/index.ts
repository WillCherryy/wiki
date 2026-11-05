// Scorcher Build backend: a Worker separate from the race's. Routes are few and explicit; everything about a trial lives in its Durable Object.
import { TaskSpec, type TaskPrivate, type TaskPublic } from './core/types.ts';
import { sha256 } from './core/chain.ts';
import { canariesOf } from './core/secrets.ts';
import { R2Store, MAX_TABLE } from './core/files.ts';
import { anthropicComplete, runModelLoop, systemPrompt } from './core/model.ts';
import { PRICES } from './core/pricing.ts';
import type { TrialInit } from './core/trial-core.ts';
import type { Env } from './env.ts';
export { Trial } from './trial.ts';

const TENANT = 'dev';   // one tenant until accounts exist (docs/BUILD-ARCHITECTURE.md)
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const bearer = (r: Request) => /^Bearer (\S+)$/.exec(r.headers.get('authorization') ?? '')?.[1] ?? '';
// compare digests, not the secrets, and without an early exit
async function safeEqual(a: string, b: string): Promise<boolean> { const [x, y] = await Promise.all([sha256(a), sha256(b)]); let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; }
const isAdmin = async (r: Request, env: Env) => !!env.BUILD_ADMIN_KEY && await safeEqual(bearer(r), env.BUILD_ADMIN_KEY);
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url), p = url.pathname, m = req.method;
    try {
      if (p === '/health') return json({ ok: true, service: 'scorcher-build', environment: env.ENVIRONMENT, secrets: { anthropic: !!env.ANTHROPIC_API_KEY, admin: !!env.BUILD_ADMIN_KEY } });
      if (!p.startsWith('/api/')) return json({ error: 'not found' }, 404);
      const call = /^\/api\/trials\/([a-f0-9]{16,64})\/(call|trace|score|run)$/.exec(p);

      // a trial's own agent calls tools with the per-trial token; everything else needs the admin key
      if (call && call[2] === 'call' && m === 'POST') {
        const stub = env.TRIAL.get(env.TRIAL.idFromName(call[1]!)); if (!(await stub.checkToken(bearer(req)).catch(() => false))) return json({ error: 'a valid trial token is required' }, 401);
        const b = await req.json().catch(() => null) as { tool?: unknown; args?: unknown } | null; if (!b || typeof b.tool !== 'string') return json({ error: 'body must be { tool, args }' }, 400);
        const o = await stub.call(b.tool, b.args ?? {}); return new Response(o.ok ? `{"ok":true,"result":${o.text}}` : JSON.stringify({ ok: false, error: o.text }), { status: o.ok ? 200 : 422, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      if (!(await isAdmin(req, env))) return json({ error: 'unauthorised' }, 401);

      if (p === '/api/tasks' && m === 'POST') {
        const parsed = TaskSpec.safeParse(await req.json().catch(() => null)); if (!parsed.success) return json({ error: 'invalid spec', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, 400);
        const s = parsed.data; for (const f of s.files) if (f.path.startsWith('/') || f.path.includes('\\') || f.path.split('/').includes('..')) return json({ error: `file "${f.path}": paths must be relative and stay inside the task` }, 400);
        await env.DB.prepare('INSERT INTO tasks (id, tenant, title, domain, spec, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tenant, id) DO UPDATE SET title = excluded.title, domain = excluded.domain, spec = excluded.spec').bind(s.id, TENANT, s.title, s.domain, JSON.stringify(s), Date.now()).run();
        return json({ id: s.id, upload: s.files.map(f => `/api/tasks/${s.id}/files/${f.path}`) }, 201);
      }
      const up = /^\/api\/tasks\/([a-z0-9-]+)\/files\/(.+)$/.exec(p);
      if (up && m === 'PUT') {
        const row = await env.DB.prepare('SELECT spec FROM tasks WHERE tenant = ? AND id = ?').bind(TENANT, up[1]).first<{ spec: string }>(); if (!row) return json({ error: 'no such task' }, 404);
        const name = decodeURIComponent(up[2]!); if (!(JSON.parse(row.spec) as { files: { path: string }[] }).files.some(f => f.path === name)) return json({ error: 'file is not declared in the spec' }, 400);
        const max = +env.MAX_FILE_BYTES, len = +(req.headers.get('content-length') ?? NaN); if (!Number.isFinite(len) || len > max) return json({ error: `content-length is required and must be at most ${max} bytes` }, 413);
        await env.FILES.put(`${TENANT}/${up[1]}/${name}`, req.body, { httpMetadata: { contentType: 'application/octet-stream' } }); return json({ stored: name, bytes: len });
      }
      if (p === '/api/trials' && m === 'POST') {
        const b = await req.json().catch(() => null) as { taskId?: unknown } | null; if (!b || typeof b.taskId !== 'string') return json({ error: 'body must be { taskId }' }, 400);
        const row = await env.DB.prepare('SELECT spec FROM tasks WHERE tenant = ? AND id = ?').bind(TENANT, b.taskId).first<{ spec: string }>(); if (!row) return json({ error: 'no such task' }, 404);
        const s = JSON.parse(row.spec) as TaskSpec, prefix = `${TENANT}/${s.id}/`, store = new R2Store(env.FILES), canaries: string[] = [];
        for (const f of s.files) if (f.sensitivity === 'restricted') { const o = await store.get(prefix + f.path, MAX_TABLE); if (o) canaries.push(...canariesOf(o.text)); }
        const task: TaskPublic = { id: s.id, title: s.title, statement: s.statement, instructions: s.instructions ?? null, answer: s.answer, files: s.files.map(f => ({ name: f.path, sensitivity: f.sensitivity })), policy: s.policy ?? null, limits: { maxCalls: s.limits?.maxCalls ?? 60, maxCostUsd: s.limits?.maxCostUsd ?? 1 } };
        const priv: TaskPrivate = { reference: s.reference, canaries }, id = hex(8), token = hex(24), init: TrialInit = { id, prefix, task, priv };
        await env.TRIAL.get(env.TRIAL.idFromName(id)).init(init, token); await env.DB.prepare('INSERT INTO trials (id, tenant, task_id, created_at) VALUES (?, ?, ?, ?)').bind(id, TENANT, s.id, Date.now()).run();
        return json({ trialId: id, token, note: 'the token is shown once' }, 201);
      }
      if (call) {
        const stub = env.TRIAL.get(env.TRIAL.idFromName(call[1]!));
        if (call[2] === 'trace' && m === 'GET') return new Response(await stub.trace(), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
        if (call[2] === 'score' && m === 'GET') return json(await stub.score());
        if (call[2] === 'run' && m === 'POST') {   // a model works the trial with Scorcher's key (route 2); long runs belong on a queue (next step)
          if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set: run `wrangler secret put ANTHROPIC_API_KEY`' }, 503);
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
