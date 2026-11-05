'use strict';
// A task's input files, as an agent may touch them. The manifest is the allowlist: a file that is not in it does not exist for the agent.
// Paths are checked for escape (.., absolute paths, backslashes, symlinks out of the task folder), reads are size-capped, and a file marked
// "restricted" can never be read or listed: an attempt is refused with the same message as a missing file and recorded as a violation.
// Nothing here writes. The platform never executes anything found in a file.
const fs = require('fs'), path = require('path');
const MAX = 200000;

class Sandbox {
  constructor(dir, files, { maxBytes = MAX } = {}) { this.dir = fs.realpathSync(dir); this.files = files; this.maxBytes = maxBytes; this.byName = new Map(files.map(f => [f.name, f])); }
  list() { return this.files.filter(f => f.sensitivity !== 'restricted').map(f => ({ name: f.name, bytes: this.bytes(f.name), sensitivity: f.sensitivity || 'normal' })); }
  bytes(name) { try { return fs.statSync(path.join(this.dir, name)).size; } catch { return null; } }
  // returns the absolute path of an allowed file, or throws; records a violation on the trial for escape and restricted attempts
  resolve(name, trial) {
    const deny = () => { throw new Error('no such file: ' + String(name).slice(0, 80)); };
    if (typeof name !== 'string' || !name || name.includes('\0') || name.includes('\\') || path.isAbsolute(name) || name.split('/').includes('..')) { trial.violate('path-escape', String(name).slice(0, 80)); deny(); }
    const f = this.byName.get(name); if (!f) deny();
    if (f.sensitivity === 'restricted') { trial.violate('restricted-read', name); deny(); }
    let real; try { real = fs.realpathSync(path.join(this.dir, name)); } catch { deny(); }
    if (real !== this.dir && !real.startsWith(this.dir + path.sep)) { trial.violate('path-escape', name); deny(); }
    return real;
  }
  read(name, trial, maxBytes = this.maxBytes) {
    const p = this.resolve(name, trial), cap = Math.min(maxBytes, this.maxBytes), size = fs.statSync(p).size, fd = fs.openSync(p, 'r');
    try { const buf = Buffer.alloc(Math.min(size, cap)); fs.readSync(fd, buf, 0, buf.length, 0); return { name, bytes: size, truncated: size > cap, content: buf.toString('utf8') }; } finally { fs.closeSync(fd); }
  }
  // whole file as text for the table tool, which returns only aggregates (a larger cap, because the content never reaches the model)
  readText(name, trial, cap = 5e6) { const p = this.resolve(name, trial); if (fs.statSync(p).size > cap) throw new Error('file too large for table queries'); return fs.readFileSync(p, 'utf8'); }
}
module.exports = { Sandbox, MAX };
