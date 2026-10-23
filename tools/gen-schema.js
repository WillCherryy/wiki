// Regenerates worker/schema.js from worker/schema.sql.
const fs = require('fs'), p = require('path').join(__dirname, '..', 'worker');
const stmts = fs.readFileSync(p + '/schema.sql', 'utf8').replace(/--[^\n]*/g, '').split(';').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
fs.writeFileSync(p + '/schema.js', '// Generated from schema.sql (node tools/gen-schema.js); the Worker applies it once per isolate so no manual D1 step is needed.\nexport default ' + JSON.stringify(stmts, null, 1) + ';\n');
