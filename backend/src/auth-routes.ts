// HTTP side of sign-in. Routes: GET /auth/{google|microsoft}/start, GET /auth/{google|microsoft}/callback, POST /auth/logout, GET /api/me.
// Dependencies (fetch, store, clock) are injected so the whole flow is tested without a network or a database.
import { AuthError, PROVIDERS, authorizeUrl, identityOf, pkcePair, randomToken, seal, sessionUser, signIn, unseal, verifyIdToken, type AuthStore, type Jwk, type OidcProvider, type User } from './core/auth.ts';
import { sha256 } from './core/chain.ts';
import { requestLink, redeemLink, MailError, type LoginTokenStore, type Mailer } from './core/email-login.ts';

export interface AuthConfig {
  publicUrl: string;          // where this backend is served, e.g. https://build.playscorcher.com (the OAuth redirect URIs live here)
  appUrl: string;             // where people land after signing in, e.g. https://playscorcher.com/build/console
  sessionSecret: string;      // HMAC key for the short-lived sign-in cookie
  clients: Partial<Record<OidcProvider, { id: string; secret: string }>>;
}
export interface AuthDeps { store: AuthStore; fetch: typeof fetch; now: () => number; tokens?: LoginTokenStore; mailer?: Mailer }

const SESSION = '__Host-sb_session', FLOW = '__Host-sb_flow';
const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
export const readCookie = (r: Request, name: string) => (r.headers.get('cookie') ?? '').split(/;\s*/).map(c => c.split('=')).find(([k]) => k === name)?.slice(1).join('=') ?? '';
const json = (o: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
const redirect = (to: string, cookies: string[] = []) => { const h = new Headers({ location: to, 'cache-control': 'no-store' }); for (const c of cookies) h.append('set-cookie', c); return new Response(null, { status: 302, headers: h }); };

const JWKS = new Map<string, { at: number; keys: { keys: Jwk[] } }>();
async function jwks(p: OidcProvider, f: typeof fetch, now: number, refresh = false) {
  const c = JWKS.get(p); if (c && !refresh && now - c.at < 36e5) return c.keys;
  const r = await f(PROVIDERS[p].jwks); if (!r.ok) throw new AuthError('could not fetch signing keys');
  const keys = await r.json() as { keys: Jwk[] }; JWKS.set(p, { at: now, keys }); return keys;
}
export const clearJwksCache = () => JWKS.clear();

export async function currentUser(r: Request, d: AuthDeps): Promise<User | null> { return sessionUser(d.store, readCookie(r, SESSION), d.now()); }

const page = (title: string, body: string) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f4f1;color:#0d0f0e;font:16px/1.5 system-ui,sans-serif}main{max-width:420px;padding:32px 24px}b{font-size:15px}h1{font-size:28px;letter-spacing:-.02em;margin:18px 0 8px}p{color:#474c49}button{margin-top:18px;height:50px;padding:0 22px;border:0;background:#0d0f0e;color:#f3f4f1;font:600 15px system-ui;cursor:pointer}button:hover{background:#1d3aa8}</style></head><body><main><b>Scorcher Build</b>${body}</main></body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } });

async function handleEmail(r: Request, url: URL, cfg: AuthConfig, d: AuthDeps): Promise<Response | null> {
  if (!d.tokens || !d.mailer) return json({ error: 'email sign-in is not configured' }, 503);
  if (url.pathname === '/auth/email/start' && r.method === 'POST') {
    const b = await r.json().catch(() => null) as { email?: unknown } | null;
    let out;
    try { out = await requestLink({ email: b?.email, client: r.headers.get('cf-connecting-ip') ?? 'unknown', store: d.tokens, mailer: d.mailer, publicUrl: cfg.publicUrl, now: d.now() }); }
    catch (e) { if (e instanceof MailError) { console.error('sign-in email failed:', e.message); return json({ error: `Sorry: ${e.message}. Try again in a few minutes.` }, 502); } throw e; }
    if (out.reason === 'invalid') return json({ error: 'that does not look like an email address' }, 400);
    if (out.reason === 'rate') return json({ error: 'too many sign-in links requested; try again in an hour' }, 429);
    return json({ ok: true, message: 'If that address can receive email, a sign-in link is on its way. It works once, for 15 minutes.' });   // the same reply for every address
  }
  if (url.pathname === '/auth/email/verify' && r.method === 'GET') {
    const t = url.searchParams.get('token') ?? '';
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(t)) return page('Link not valid', '<h1>This link is not valid.</h1><p>Ask for a new one from the sign-in page.</p>');
    // a page, not a sign-in: mail scanners open links, and must not spend them or sign in
    return page('Sign in', `<h1>Sign in to Scorcher Build</h1><p>Press the button to finish signing in on this device.</p><form method="post" action="/auth/email/verify"><input type="hidden" name="token" value="${t}"><button type="submit">Sign in</button></form>`);
  }
  if (url.pathname === '/auth/email/verify' && r.method === 'POST') {
    if (r.headers.get('origin') !== new URL(cfg.publicUrl).origin) return page('Not allowed', '<h1>That request came from somewhere else.</h1><p>Open the link from your email and press the button there.</p>');
    const form = await r.formData().catch(() => null);
    const email = await redeemLink(form?.get('token'), d.tokens, d.now());
    if (!email) return redirect(`${cfg.appUrl}?signin=failed&reason=link`);
    const { token } = await signIn(d.store, { provider: 'email', subject: email, email, name: null, tenantHint: null }, d.now());
    const h = new Headers({ location: cfg.appUrl, 'cache-control': 'no-store' }); h.append('set-cookie', cookie(SESSION, token, 7 * 86400));
    return new Response(null, { status: 303, headers: h });
  }
  return null;
}

export async function handleAuth(r: Request, cfg: AuthConfig, d: AuthDeps): Promise<Response | null> {
  const url = new URL(r.url);
  if (url.pathname.startsWith('/auth/email/')) return handleEmail(r, url, cfg, d);
  if (url.pathname === '/auth/signin' && r.method === 'GET') {
    const sso = (['microsoft', 'google'] as const).filter(p => cfg.clients[p]).map(p => `<p><a href="/auth/${p}/start" style="color:#0d0f0e">Sign in with ${p === 'microsoft' ? 'Microsoft' : 'Google'}</a></p>`).join('');
    const res = page('Sign in', `<h1>Sign in</h1><p>We email you a link. It works once, for 15 minutes; no password to remember.</p>
<form id="f"><input id="e" type="email" required autocomplete="email" placeholder="you@company.com" aria-label="Email address" style="width:100%;box-sizing:border-box;height:50px;padding:0 14px;border:1.5px solid #0d0f0e;background:#fff;font:16px system-ui"><button type="submit">Email me a link</button></form><p id="m" role="status"></p>${sso}
<script nonce="signin">document.getElementById('f').onsubmit=async e=>{e.preventDefault();const m=document.getElementById('m');m.textContent='Sending...';try{const r=await fetch('/auth/email/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:document.getElementById('e').value})});const j=await r.json();m.textContent=j.message||j.error}catch{m.textContent='Could not reach the server; try again.'}}</script>`);
    res.headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-signin'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'");
    return res;
  }
  const m = /^\/auth\/(google|microsoft)\/(start|callback)$/.exec(url.pathname);
  if (m) {
    const p = m[1] as OidcProvider, client = cfg.clients[p];
    if (!client?.id || !client.secret) return json({ error: `${p} sign-in is not configured` }, 503);
    const redirectUri = `${cfg.publicUrl}/auth/${p}/callback`;
    if (m[2] === 'start' && r.method === 'GET') {
      const state = randomToken(16), nonce = randomToken(16), { verifier, challenge } = await pkcePair();
      const flow = await seal({ p, state, nonce, verifier }, cfg.sessionSecret, 600, d.now());
      return redirect(authorizeUrl(p, client.id, redirectUri, state, nonce, challenge), [cookie(FLOW, flow, 600)]);
    }
    if (m[2] === 'callback' && r.method === 'GET') {
      const fail = (why: string) => redirect(`${cfg.appUrl}?signin=failed&reason=${encodeURIComponent(why)}`, [cookie(FLOW, '', 0)]);
      if (url.searchParams.get('error')) return fail(url.searchParams.get('error')!);
      const flow = await unseal<{ p: OidcProvider; state: string; nonce: string; verifier: string }>(readCookie(r, FLOW), cfg.sessionSecret, d.now());
      if (!flow || flow.p !== p || flow.state !== url.searchParams.get('state')) return fail('state');
      const code = url.searchParams.get('code'); if (!code) return fail('code');
      const tr = await d.fetch(PROVIDERS[p].token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: client.id, client_secret: client.secret, code_verifier: flow.verifier }) });
      if (!tr.ok) return fail('token');
      const idToken = (await tr.json() as { id_token?: string }).id_token; if (!idToken) return fail('token');
      let claims;
      try { claims = await verifyIdToken(idToken, { provider: p, jwks: await jwks(p, d.fetch, d.now()), audience: client.id, nonce: flow.nonce, now: d.now() }); }
      catch (e) {
        if (e instanceof AuthError && e.message === 'signing key not found') {   // keys rotate: refetch once
          try { claims = await verifyIdToken(idToken, { provider: p, jwks: await jwks(p, d.fetch, d.now(), true), audience: client.id, nonce: flow.nonce, now: d.now() }); } catch { return fail('verify'); }
        } else return fail('verify');
      }
      const { token } = await signIn(d.store, identityOf(p, claims), d.now());
      return redirect(cfg.appUrl, [cookie(SESSION, token, 7 * 86400), cookie(FLOW, '', 0)]);
    }
    return json({ error: 'method not allowed' }, 405);
  }
  if (url.pathname === '/auth/logout' && r.method === 'POST') {
    const t = readCookie(r, SESSION); if (t) await d.store.deleteSession(await sha256(t));
    return json({ ok: true }, 200, { 'set-cookie': cookie(SESSION, '', 0) });
  }
  if (url.pathname === '/api/me' && r.method === 'GET') {
    const u = await currentUser(r, d); if (!u) return json({ signedIn: false }, 401);
    return json({ signedIn: true, user: { id: u.id, email: u.email, name: u.name, provider: u.provider }, orgs: await d.store.orgsOf(u.id) });
  }
  return null;
}
