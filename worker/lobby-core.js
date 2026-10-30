// Live lobbies: pure race logic, independent of transport. Two modes: 'stream' (the host runs everything, viewers race) and 'friends'
// (a room: everyone sees who is there and the race card, anyone can set the race from any Wikipedia article, players mark themselves ready).
// The Cloudflare Durable Object (worker/lobby.js) and the dev server (server.js) both wrap this class.
// A "conn" is { send(string) }; the core never touches sockets or clocks directly, so it is easy to test.

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const MAX_PLAYERS = 1000, COUNTDOWN_MS = 5000, FLUSH_MS = 1000, AUTO_END_MS = 45 * 60 * 1000;

export class LobbyCore {
  constructor({ code, hostKey, mode = 'stream', now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
    Object.assign(this, { code, hostKey, now, setTimer, clearTimer }); this.mode = mode === 'friends' ? 'friends' : 'stream'; this.hostPid = ''; this.setBy = '';
    this.puzzle = null; this.phase = 'open'; this.round = 0; this.startAt = 0;
    this.conns = new Set(); this.players = new Map();   // pid -> player
    this.flushT = null; this.endT = null; this.dirty = false; this.lastActive = now();
  }

  // ---- lifecycle -------------------------------------------------------------------------------------------------
  setPuzzle(p) {
    const s = v => clean(v, 80);
    if (!p || !s(p.from) || !s(p.to) || s(p.from).toLowerCase() === s(p.to).toLowerCase()) return false;
    this.puzzle = { from: s(p.from), to: s(p.to), par: Number.isInteger(p.par) && p.par > 0 && p.par < 20 ? p.par : null };
    return true;
  }
  join(conn) { this.conns.add(conn); this.lastActive = this.now(); this.sendState(conn); }
  leave(conn) {
    this.conns.delete(conn);
    if (conn.pid && this.players.has(conn.pid)) { const p = this.players.get(conn.pid); if (p.conn === conn) { p.conn = null; p.online = false; p.ready = false; if (this.mode === 'friends' && this.phase === 'open' && !p.done) this.players.delete(p.pid);   /* someone who leaves a waiting room is gone, not counted */
      this.dirty = true; this.schedule(); } }
  }
  idle() { return this.conns.size === 0; }

  // ---- inbound ---------------------------------------------------------------------------------------------------
  message(conn, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    this.lastActive = this.now();
    if (m.t === 'host') { if (m.key && m.key === this.hostKey) { conn.host = true; if (conn.pid) this.hostPid = conn.pid; conn.send(JSON.stringify({ t: 'host', ok: true })); this.sendBoard(conn, true); } else conn.send(JSON.stringify({ t: 'host', ok: false })); return; }
    if (m.t === 'view') { conn.view = true; this.sendBoard(conn, true); return; }
    if (m.t === 'hello') return this.hello(conn, m);
    if (conn.host && ['start', 'reset', 'end', 'kick'].includes(m.t)) return this.control(m);
    const p = conn.pid && this.players.get(conn.pid); if (!p || p.conn !== conn) return;
    if (m.t === 'move') return this.move(p, m);
    if (m.t === 'finish') return this.finish(p, m);
    if (m.t === 'ready' && this.mode === 'friends' && this.phase === 'open') { p.ready = !!m.on; this.dirty = true; return this.flush(); }
    if (m.t === 'set' && this.mode === 'friends') return this.set(p, m);
  }
  set(p, m) {   // friends: anyone in the room can set the next race, from any two articles
    if (this.phase === 'countdown' || this.phase === 'racing') return;
    const q = m.puzzle || {}, cur = this.puzzle; if (cur && q.from === cur.from && q.to === cur.to) { if (Number.isInteger(q.par) && q.par > 0 && q.par < 20) cur.par = q.par; return this.broadcastState(); }   // the same race again only adds its par
    if (!this.setPuzzle(m.puzzle)) return p.conn && p.conn.send(JSON.stringify({ t: 'err', error: 'puzzle' }));
    this.setBy = p.name; if (this.phase === 'ended') { this.phase = 'open'; this.round++; this.startAt = 0; this.resetProgress(); }
    for (const q of this.players.values()) q.ready = false;
    this.dirty = true; this.broadcastState(); this.flush();
  }

  hello(conn, m) {
    const pid = clean(m.pid, 16), name = clean(m.name, 20);
    if (!/^[a-z0-9]{6,16}$/.test(pid) || !name) return conn.send(JSON.stringify({ t: 'err', error: 'name' }));
    let p = this.players.get(pid);
    if (!p) {
      if (this.players.size >= MAX_PLAYERS) return conn.send(JSON.stringify({ t: 'err', error: 'full' }));
      p = { pid, name, title: null, clicks: 0, temp: 0, done: false, secs: null, finishedAt: 0, lastMove: 0, conn: null, online: false, ready: false, joinedAt: this.now() };
      this.players.set(pid, p);
    }
    if (p.conn && p.conn !== conn) { p.conn.pid = null; }    // a newer tab takes over
    p.name = name; p.conn = conn; p.online = true; conn.pid = pid; if (conn.host) this.hostPid = pid;
    this.dirty = true; this.schedule(); this.sendState(conn); this.sendBoard(conn);
  }

  control(m) {
    const t = this.now();
    if (m.t === 'start') {
      if (this.phase === 'racing' || this.phase === 'countdown' || !this.puzzle) return;
      if (this.phase === 'ended') this.round++;
      this.phase = 'countdown'; this.startAt = t + COUNTDOWN_MS; this.resetProgress();
      this.clearTimer(this.endT); this.endT = this.setTimer(() => this.startRace(), COUNTDOWN_MS);
    } else if (m.t === 'reset') {
      if (m.puzzle && !this.setPuzzle(m.puzzle)) return; if (m.puzzle) this.setBy = '';
      this.clearTimer(this.endT); for (const q of this.players.values()) q.ready = false; this.phase = 'open'; this.round++; this.startAt = 0; this.resetProgress();
    } else if (m.t === 'end') {
      if (this.phase !== 'racing') return;
      this.endRace();
    } else if (m.t === 'kick') {
      const p = this.players.get(clean(m.pid, 16)); if (!p) return;
      if (p.conn) { p.conn.send(JSON.stringify({ t: 'kicked' })); p.conn.pid = null; }
      this.players.delete(p.pid);
    }
    this.dirty = true; this.broadcastState(); this.flush();
  }
  startRace() { if (this.phase !== 'countdown') return; this.phase = 'racing'; this.endT = this.setTimer(() => this.endRace(), AUTO_END_MS); this.broadcastState(); this.flush(); }
  endRace() { this.clearTimer(this.endT); this.phase = 'ended'; this.dirty = true; this.broadcastState(); this.flush(); }
  resetProgress() { for (const p of this.players.values()) Object.assign(p, { title: null, clicks: 0, temp: 0, done: false, secs: null, finishedAt: 0 }); }

  racing() { return this.phase === 'racing' || (this.phase === 'countdown' && this.now() >= this.startAt); }
  move(p, m) {
    if (!this.racing() || p.done) return;
    const t = this.now(); if (t - p.lastMove < 120) return; p.lastMove = t;
    const title = clean(m.title, 80); if (!title) return;
    p.title = title; p.clicks = Number.isInteger(m.clicks) && m.clicks >= 0 && m.clicks <= 300 ? m.clicks : p.clicks;
    p.temp = typeof m.temp === 'number' && m.temp >= 0 && m.temp <= 1 ? Math.round(m.temp * 100) / 100 : p.temp;
    this.dirty = true; this.schedule();
  }
  finish(p, m) {
    if (!this.racing() || p.done) return;
    const clicks = Number.isInteger(m.clicks) && m.clicks >= 1 && m.clicks <= 300 ? m.clicks : null; if (!clicks) return;
    const t = this.now(), secs = Math.max(1, Math.round((t - this.startAt) / 1000));   // the clock is the server's, not the player's
    Object.assign(p, { done: true, clicks, secs, temp: 1, finishedAt: t, title: this.puzzle.to });
    const rank = [...this.players.values()].filter(x => x.done).length;
    const ev = JSON.stringify({ t: 'ev', k: 'fin', name: p.name, clicks, secs, rank });
    for (const c of this.conns) c.send(ev);
    this.dirty = true; this.flush();
  }

  // ---- outbound --------------------------------------------------------------------------------------------------
  stateMsg() {
    const live = this.phase !== 'open' || this.mode === 'friends';   // a friends room shows the race card; a stream keeps it secret until the countdown
    return { t: 's', mode: this.mode, phase: this.phase, round: this.round, now: this.now(), startAt: this.startAt, code: this.code, puzzle: live ? this.puzzle : null, has: !!this.puzzle, setBy: this.setBy, hostPid: this.hostPid };
  }
  sendState(conn) { conn.send(JSON.stringify(this.stateMsg())); }
  broadcastState() { const s = JSON.stringify(this.stateMsg()); for (const c of this.conns) c.send(s); }

  order() {
    const all = [...this.players.values()];
    return all.sort((a, b) => (b.done - a.done) || (a.done ? a.secs - b.secs || a.clicks - b.clicks : b.temp - a.temp || a.clicks - b.clicks));
  }
  board(full) {
    const ord = this.order(), top = ord.slice(0, full ? 15 : 10).map(p => ({ n: p.name, c: p.clicks, s: p.secs, d: p.done, tp: p.temp, at: p.title }));
    const on = ord.filter(p => p.online).length, out = { t: 'b', now: this.now(), n: on, all: this.players.size, on, fin: ord.filter(p => p.done).length, top };   // n counts the people actually here
    if (this.mode === 'friends') out.room = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).slice(0, 60).map(p => ({ pid: p.pid, n: p.name, on: p.online, r: p.ready, h: p.pid === this.hostPid, d: p.done }));
    if (full) {
      const by = new Map();
      for (const p of ord) if (!p.done && p.title && p.online) { const e = by.get(p.title) || { title: p.title, n: 0, tp: 0, names: [] }; e.n++; e.tp += p.temp; if (e.names.length < 3) e.names.push(p.name); by.set(p.title, e); }
      // "Weirdest" = furthest from the target (lowest temperature), busiest first as a tie-break.
      out.stuck = [...by.values()].map(e => ({ title: e.title, n: e.n, tp: Math.round(e.tp / e.n * 100) / 100, names: e.names })).sort((a, b) => a.tp - b.tp || b.n - a.n).slice(0, 8);
      out.players = ord.slice(0, 200).map(p => ({ pid: p.pid, n: p.name, on: p.online, d: p.done }));
    }
    return out;
  }
  sendBoard(conn, full) { const b = this.board(full || conn.host || conn.view); if (conn.pid) b.me = this.order().findIndex(p => p.pid === conn.pid) + 1; conn.send(JSON.stringify(b)); }
  schedule() { if (!this.flushT) this.flushT = this.setTimer(() => { this.flushT = null; if (this.dirty) this.flush(); }, FLUSH_MS); }
  flush() {
    this.dirty = false; this.clearTimer(this.flushT); this.flushT = null;
    if (!this.conns.size) return;
    const ord = this.order(), rankOf = new Map(ord.map((p, i) => [p.pid, i + 1]));
    const slim = JSON.stringify(this.board(false)), full = JSON.stringify(this.board(true));
    for (const c of this.conns) {
      const base = c.host || c.view ? full : slim;
      c.send(c.pid ? base.slice(0, -1) + `,"me":${rankOf.get(c.pid) || 0}}` : base);
    }
  }
}
