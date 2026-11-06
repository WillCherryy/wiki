import type { Trial } from './trial.ts';
export interface Env {
  TRIAL: DurableObjectNamespace<Trial>; DB: D1Database; FILES: R2Bucket;
  ANTHROPIC_API_KEY?: string;   // secret: `wrangler secret put ANTHROPIC_API_KEY`
  BUILD_ADMIN_KEY?: string;     // secret: the key for admin endpoints until real accounts exist
  ENVIRONMENT: string; MAX_FILE_BYTES: string;
  PUBLIC_URL?: string; APP_URL?: string;              // vars: where this backend is served; where people land after signing in
  SESSION_SECRET?: string;                            // secret: signs the short-lived sign-in cookie
  GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string;          // secrets: Google Cloud console, OAuth client (web application)
  MICROSOFT_CLIENT_ID?: string; MICROSOFT_CLIENT_SECRET?: string;    // secrets: Microsoft Entra admin centre, app registration
}
