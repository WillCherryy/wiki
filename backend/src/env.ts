import type { Trial } from './trial.ts';
export interface Env {
  TRIAL: DurableObjectNamespace<Trial>; DB: D1Database; FILES: R2Bucket;
  ANTHROPIC_API_KEY?: string;   // secret: `wrangler secret put ANTHROPIC_API_KEY`
  BUILD_ADMIN_KEY?: string;     // secret: the key for admin endpoints until real accounts exist
  ENVIRONMENT: string; MAX_FILE_BYTES: string;
}
