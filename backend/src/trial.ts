// One Durable Object per trial. Calls to a trial are serialised by the runtime, which is exactly what an append-only hash chain needs.
// State is kept in the object's SQLite storage: the init record, a snapshot (rewritten after each call, small) and the trace (append-only rows).
import { DurableObject } from 'cloudflare:workers';
import { TrialCore, type CallOutcome, type Snapshot, type TrialInit } from './core/trial-core.ts';
import { R2Store } from './core/files.ts';
import { sha256, verifyChain } from './core/chain.ts';
import type { TraceEntry } from './core/types.ts';
import type { Env } from './env.ts';

export class Trial extends DurableObject<Env> {
  private core: TrialCore | null = null; private tokenHash = '';
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL); CREATE TABLE IF NOT EXISTS trace (i INTEGER PRIMARY KEY, j TEXT NOT NULL)');
      const get = (k: string) => ctx.storage.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]?.['v'] as string | undefined, init = get('init');
      if (init) { const trace = ctx.storage.sql.exec('SELECT j FROM trace ORDER BY i').toArray().map(r => JSON.parse(r['j'] as string) as TraceEntry);
        this.tokenHash = get('tokenHash') ?? ''; this.core = new TrialCore(JSON.parse(init) as TrialInit, new R2Store(env.FILES), JSON.parse(get('snap') ?? 'null') ?? undefined, trace); }
    });
  }
  private put(k: string, v: string) { this.ctx.storage.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v); }
  async init(init: TrialInit, token: string): Promise<void> {
    if (this.core) throw new Error('trial already initialised');
    this.tokenHash = await sha256(token); this.put('init', JSON.stringify(init)); this.put('tokenHash', this.tokenHash); this.core = new TrialCore(init, new R2Store(this.env.FILES)); this.put('snap', JSON.stringify(this.core.snapshot()));
  }
  async checkToken(token: string): Promise<boolean> { return !!this.core && (await sha256(token)) === this.tokenHash; }
  /** Returns the result (or the error message) as JSON text: cheaper than structured-cloning arbitrary values, and Durable Object RPC cannot type `unknown`. */
  async call(tool: string, args: unknown): Promise<{ ok: boolean; text: string }> {
    const c = this.need(), o: CallOutcome = await c.call(tool, args);
    this.ctx.storage.sql.exec('INSERT INTO trace (i, j) VALUES (?, ?)', o.entry.i, JSON.stringify(o.entry)); this.put('snap', JSON.stringify(c.snapshot() satisfies Snapshot));
    return o.ok ? { ok: true, text: JSON.stringify(o.result) } : { ok: false, text: o.error };
  }
  async trace(): Promise<string> { const c = this.need(); return JSON.stringify({ trace: c.trace, chain: await verifyChain(c.trace) }); }
  async score() { return this.need().score(); }
  async status() { const c = this.need(); return { id: c.id, task: c.task.id, calls: c.trace.length, done: c.done, violations: c.violations.length }; }
  private need(): TrialCore { if (!this.core) throw new Error('trial not initialised'); return this.core; }
}
