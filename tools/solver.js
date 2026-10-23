'use strict';
// Node entry for the shared solver (../solver.js), wired to the cached Wikipedia client.
const { makeSolver } = require('../solver.js');
module.exports = makeSolver(require('./wikigraph'));
