'use strict';
// Synthetic resource-estimate tasks, generated from a seed. Real trials would use the client's own tasks; these exist to exercise the harness.
// A task has a public statement (what an agent sees) and a reference answer (what only the grader sees).
const { rng } = require('./stats');
const { monteCarlo, normalise } = require('./tools/resource');

const FIELD = [{ area: 'acre', thickness: 'ft', temp: 'F' }, { area: 'mi2', thickness: 'ft', temp: 'F' }], METRIC = { area: 'km2', thickness: 'm', temp: 'C' };
const AREA_FROM_KM2 = { km2: 1, acre: 247.1053815, mi2: 0.386102159 };

function generate(n = 24, seed = 20261105) {
  const r = rng(seed), tasks = [];
  for (let i = 0; i < n; i++) {
    const field = i % 3 === 0, u = field ? FIELD[(i / 3) % 2] : METRIC;   // a third of the tasks come in field units, the usual trap
    const modeKm2 = 2 + r() * 10, modeM = 300 + r() * 600, tmin = 150 + r() * 50, tmax = tmin + 30 + r() * 30;
    const a = AREA_FROM_KM2[u.area], t = x => u.temp === 'F' ? x * 9 / 5 + 32 : x, l = x => u.thickness === 'ft' ? x / 0.3048 : x;
    tasks.push({
      id: 'res-' + String(i + 1).padStart(3, '0'), domain: 'resource', synthetic: true,
      statement: 'Estimate the electrical capacity of this prospect over its project life with the volumetric heat-in-place method. Report P90, P50 and P10 in MWe, using the exceedance convention (P90 is the value exceeded with 90 % probability, so P90 < P50 < P10).',
      inputs: {
        area: { kind: 'tri', min: +(0.5 * modeKm2 * a).toFixed(2), mode: +(modeKm2 * a).toFixed(2), max: +(1.8 * modeKm2 * a).toFixed(2), unit: u.area },
        thickness: { kind: 'tri', min: +l(0.6 * modeM).toFixed(0), mode: +l(modeM).toFixed(0), max: +l(1.5 * modeM).toFixed(0), unit: u.thickness },
        temperature: { kind: 'uniform', min: +t(tmin).toFixed(0), max: +t(tmax).toFixed(0), unit: u.temp },
        refTemp: { kind: 'fixed', value: +t(15).toFixed(0), unit: u.temp },
        rhoC: { kind: 'tri', min: 2.4, mode: 2.7, max: 3.0 }, recovery: { kind: 'tri', min: 0.1, mode: 0.25, max: 0.4 }, efficiency: { kind: 'tri', min: 0.08, mode: 0.12, max: 0.16 },
        lifeYears: { kind: 'fixed', value: 30 }, loadFactor: { kind: 'fixed', value: 0.9 },
      },
      unitsNote: 'rhoC is in MJ per cubic metre per kelvin; recovery, efficiency and loadFactor are fractions; lifeYears is in years.',
    });
  }
  return tasks;
}

const cache = new Map();
function reference(task) { if (!cache.has(task.id)) cache.set(task.id, monteCarlo(normalise(task), { n: 200000, seed: 9001 })); return cache.get(task.id); }
module.exports = { generate, reference };
