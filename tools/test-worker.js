'use strict';
// Worker-only behaviour: signed payment webhooks, supporter entitlement, and streak rules over simulated days.
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { makeEnv } = require('./d1-shim');

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const noon = day => Date.parse(day + 'T12:00:00Z');

(async () => {
  const worker = (await import(path.join(__dirname, '..', 'worker', 'index.js'))).default;
  const env = makeEnv({ DEBUG_ERR: '1', LS_SIGNING_SECRET: 'ls-secret', STRIPE_WEBHOOK_SECRET: 'whsec_test', TEST_NOW: String(noon('2026-03-10')) });
  const call = async (method, p, body, headers = {}) => {
    const init = { method, headers: { 'content-type': 'application/json', ...headers } };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const r = await worker.fetch(new Request('http://api.test' + p, init), env); return { status: r.status, body: await r.json() };
  };
  const setDay = d => { env.TEST_NOW = String(noon(d)); };
  const play = (pid, day) => { setDay(day); return call('POST', '/api/score', { pid, name: pid, xp: 10, day, clicks: 3, secs: 30, score: 800, path: ['A', 'B', 'C'] }); };
  const streakOf = async (pid, day) => { setDay(day); const rows = (await call('GET', `/api/leaderboard?mode=streak&day=${day}`)).body; const r = rows.find(x => x.pid === pid); return r ? r.streak : 0; };

  // ---- Lemon Squeezy webhook
  const PID = 'supporter01';
  const order = (id, status = 'paid', event = 'order_created', pid = PID) => JSON.stringify({ meta: { event_name: event, custom_data: { pid } }, data: { id, type: 'orders', attributes: { status } } });
  const ls = (body, secret = 'ls-secret') => call('POST', '/api/webhook/lemonsqueezy', body, { 'x-signature': hmac(secret, body) });
  assert.deepStrictEqual((await call('GET', `/api/entitlements?pid=${PID}`)).body, { supporter: false });
  assert.strictEqual((await ls(order('1001'), 'wrong-secret')).status, 401, 'LS: wrong signature rejected');
  assert.strictEqual((await call('POST', '/api/webhook/lemonsqueezy', order('1001'), {})).status, 401, 'LS: missing signature rejected');
  assert.strictEqual((await ls(order('1001', 'pending'))).status, 200); assert.strictEqual((await call('GET', `/api/entitlements?pid=${PID}`)).body.supporter, false, 'LS: unpaid order grants nothing');
  assert.strictEqual((await ls(order('1001'))).status, 200); assert.strictEqual((await call('GET', `/api/entitlements?pid=${PID}`)).body.supporter, true, 'LS: paid order grants supporter');
  assert.strictEqual((await ls(order('1001'))).status, 200); assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1, 'LS: replayed webhook is idempotent');
  const tampered = order('1002'); assert.strictEqual((await call('POST', '/api/webhook/lemonsqueezy', tampered.replace('1002', '1003'), { 'x-signature': hmac('ls-secret', tampered) })).status, 401, 'LS: tampered body rejected');
  assert.strictEqual((await ls(order('1002', 'paid', 'order_created', 'not a pid!'))).status, 200); assert.strictEqual(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1, 'LS: order without a valid player id is ignored');
  assert.strictEqual((await ls(order('1001', 'refunded', 'order_refunded'))).status, 200); assert.strictEqual((await call('GET', `/api/entitlements?pid=${PID}`)).body.supporter, false, 'LS: refund removes supporter');

  // ---- Stripe webhook
  const session = (id, pid = 'stripebuyer1', paid = 'paid') => JSON.stringify({ id: 'evt_' + id, type: 'checkout.session.completed', data: { object: { id, payment_intent: 'pi_' + id, client_reference_id: pid, payment_status: paid } } });
  const refund = (id, full = true) => JSON.stringify({ id: 'evt_r' + id, type: 'charge.refunded', data: { object: { id: 'ch_' + id, payment_intent: 'pi_' + id, refunded: full } } });
  const stripe = (body, ts = Math.floor(Number(env.TEST_NOW) / 1000), secret = 'whsec_test') => call('POST', '/api/webhook/stripe', body, { 'stripe-signature': `t=${ts},v1=${hmac(secret, `${ts}.${body}`)}` });
  assert.strictEqual((await stripe(session('cs_1'), undefined, 'bad')).status, 401, 'Stripe: wrong secret rejected');
  assert.strictEqual((await stripe(session('cs_1'), Math.floor(Number(env.TEST_NOW) / 1000) - 3600)).status, 401, 'Stripe: stale timestamp rejected');
  assert.strictEqual((await stripe(session('cs_1', 'stripebuyer1', 'unpaid'))).status, 200); assert.strictEqual((await call('GET', '/api/entitlements?pid=stripebuyer1')).body.supporter, false, 'Stripe: unpaid session grants nothing');
  assert.strictEqual((await stripe(session('cs_1'))).status, 200); assert.strictEqual((await call('GET', '/api/entitlements?pid=stripebuyer1')).body.supporter, true, 'Stripe: paid session grants supporter');
  // ---- restoring a purchase with the checkout email (a buyer whose browser data was cleared has a new Player ID)
  const withMail = (id, pid, email) => JSON.stringify({ id: 'evt_' + id, type: 'checkout.session.completed', data: { object: { id, payment_intent: 'pi_' + id, client_reference_id: pid, payment_status: 'paid', customer_details: { email } } } });
  assert.strictEqual((await stripe(withMail('cs_m1', 'mailbuyer01', 'Buyer@Example.com'))).status, 200);
  assert.strictEqual((await call('GET', '/api/entitlements?pid=newdevice01')).body.supporter, false, 'restore: a new Player ID starts without the pack');
  assert.strictEqual((await call('POST', '/api/restore', { pid: 'newdevice01', email: 'someone@else.com' })).status, 404, 'restore: unknown email finds nothing');
  assert.strictEqual((await call('POST', '/api/restore', { pid: 'newdevice01', email: 'not an email' })).status, 400, 'restore: bad email rejected');
  assert.strictEqual((await call('POST', '/api/restore', { pid: 'newdevice01', email: '  buyer@example.COM ' })).body.supporter, true, 'restore: the checkout email (any case) restores the pack');
  assert.strictEqual((await call('GET', '/api/entitlements?pid=newdevice01')).body.supporter, true, 'restore: the new Player ID is now a supporter');
  for (const x of ['dev2device1', 'dev3device1']) assert.strictEqual((await call('POST', '/api/restore', { pid: x, email: 'buyer@example.com' })).body.supporter, true);
  assert.strictEqual((await call('POST', '/api/restore', { pid: 'dev4device1', email: 'buyer@example.com' })).status, 429, 'restore: at most three extra devices per purchase');
  assert.strictEqual((await stripe(refund('cs_m1'))).status, 200); assert.strictEqual((await call('GET', '/api/entitlements?pid=newdevice01')).body.supporter, false, 'restore: a refund removes restored copies too');
  assert.strictEqual((await call('POST', '/api/webhook/paddle', '{}')).status, 404, 'unknown provider');
  assert.strictEqual((await stripe(refund('cs_1', false))).status, 200); assert.strictEqual((await call('GET', '/api/entitlements?pid=stripebuyer1')).body.supporter, true, 'Stripe: a partial refund keeps the pack');
  assert.strictEqual((await stripe(refund('cs_1'))).status, 200); assert.strictEqual((await call('GET', '/api/entitlements?pid=stripebuyer1')).body.supporter, false, 'Stripe: a full refund removes the pack');
  const bare = makeEnv(); assert.strictEqual((await worker.fetch(new Request('http://api.test/api/webhook/stripe', { method: 'POST', body: '{}' }), bare)).status, 404, 'webhook disabled until its secret is configured');

  // ---- streaks: normal players reset after a missed day
  await play('plainplayer', '2026-03-10'); await play('plainplayer', '2026-03-11');
  assert.strictEqual(await streakOf('plainplayer', '2026-03-11'), 2, 'streak grows on consecutive days');
  await play('plainplayer', '2026-03-13');
  assert.strictEqual(await streakOf('plainplayer', '2026-03-13'), 1, 'streak resets after a missed day');
  assert.strictEqual(await streakOf('plainplayer', '2026-03-16'), 0, 'stale streaks are hidden from the board');

  // ---- supporters get one streak shield per month
  await ls(order('2001', 'paid', 'order_created', 'shieldfan01'));
  await play('shieldfan01', '2026-03-10'); await play('shieldfan01', '2026-03-11');
  await play('shieldfan01', '2026-03-13');                                   // missed the 12th: shield saves the streak
  assert.strictEqual(await streakOf('shieldfan01', '2026-03-13'), 3, 'supporter streak shield covers one missed day');
  await play('shieldfan01', '2026-03-15');                                   // missed the 14th: shield already used this month
  assert.strictEqual(await streakOf('shieldfan01', '2026-03-15'), 1, 'only one shield per month');
  await play('shieldfan01', '2026-03-16'); await play('shieldfan01', '2026-04-01');
  assert.strictEqual(await streakOf('shieldfan01', '2026-04-01'), 1, 'new month, but no missed-day streak to save here');
  await play('shieldfan01', '2026-04-03');
  assert.strictEqual(await streakOf('shieldfan01', '2026-04-03'), 2, 'shield refreshes in a new month');

  // ---- an old day cannot be backfilled
  setDay('2026-03-20'); assert.strictEqual((await call('POST', '/api/score', { pid: 'backfiller1', name: 'x', xp: 0, day: '2026-03-10', clicks: 3, secs: 30, score: 800, path: ['A', 'B'] })).status, 400, 'old days are rejected');
  console.log('ok: webhooks, entitlements and streak rules behave');
})().catch(e => { console.error(e); process.exit(1); });
