'use strict';
// Scripted fixture agents. They are test fixtures for the harness, not Scorcher's agents and not language models: each follows a fixed
// recipe so that the grading, the review gate and the statistics can be tested against known behaviour.
const { call } = require('./gateway');

const mapDist = (d, f) => d.kind === 'fixed' ? { kind: 'fixed', value: f(d.value) } : d.kind === 'uniform' ? { kind: 'uniform', min: f(d.min), max: f(d.max) } : { kind: 'tri', min: f(d.min), mode: f(d.mode), max: f(d.max) };
const strip = d => { const { unit, ...rest } = d; return rest; };
const SI = i => ({ rhoC: i.rhoC, recovery: i.recovery, efficiency: i.efficiency, lifeYears: i.lifeYears, loadFactor: i.loadFactor });

function submit(trial, r) { return call(trial, 'submit_answer', { answer: { p90: r.p90, p50: r.p50, p10: r.p10, unit: 'MWe', method: 'Volumetric heat-in-place, Monte Carlo over the stated input distributions.', steps: ['task_get', 'units_convert', 'resource_volumetric_mc', 'submit_answer'] } }); }

// converts every field-unit input with the unit tool, runs the Monte Carlo, submits
function careful(trial) {
  const i = call(trial, 'task_get').inputs, conv = (d, to) => mapDist(d, x => call(trial, 'units_convert', { value: x, from: d.unit || '', to }).value);
  const fx = (unit, to) => call(trial, 'units_convert', { value: 1, from: unit, to }).value;
  const inputs = { areaKm2: mapDist(strip(i.area), x => x * fx(i.area.unit, 'km2')), thicknessM: mapDist(strip(i.thickness), x => x * fx(i.thickness.unit, 'm')),
    tempC: conv(i.temperature, 'C'), refTempC: conv(i.refTemp, 'C'), ...SI(i) };
  const r = call(trial, 'resource_volumetric_mc', { inputs, n: 20000, seed: 7 }); submit(trial, r);
}

// treats the numbers as already metric; if the review gate rejects the answer it reads the hint and redoes the job with conversion
function unitBlind(trial) {
  const i = call(trial, 'task_get').inputs, raw = { areaKm2: strip(i.area), thicknessM: strip(i.thickness), tempC: strip(i.temperature), refTempC: strip(i.refTemp), ...SI(i) };
  const r = call(trial, 'resource_volumetric_mc', { inputs: raw, n: 20000, seed: 7 }), s = submit(trial, r);
  if (!s.accepted && s.errors.some(e => /units/.test(e))) careful(trial);
}

// every input at its central value: no distribution, so no interval
function pointEstimate(trial) {
  const i = call(trial, 'task_get').inputs, mid = d => d.kind === 'fixed' ? d.value : d.kind === 'uniform' ? (d.min + d.max) / 2 : d.mode;
  const fx = (unit, to) => call(trial, 'units_convert', { value: 1, from: unit, to }).value, fixed = x => ({ kind: 'fixed', value: x });
  const inputs = { areaKm2: fixed(mid(i.area) * fx(i.area.unit, 'km2')), thicknessM: fixed(mid(i.thickness) * fx(i.thickness.unit, 'm')), tempC: fixed(call(trial, 'units_convert', { value: mid(i.temperature), from: i.temperature.unit, to: 'C' }).value),
    refTempC: fixed(call(trial, 'units_convert', { value: i.refTemp.value, from: i.refTemp.unit, to: 'C' }).value), rhoC: fixed(i.rhoC.mode), recovery: fixed(i.recovery.mode), efficiency: fixed(i.efficiency.mode), lifeYears: i.lifeYears, loadFactor: i.loadFactor };
  submit(trial, call(trial, 'resource_volumetric_mc', { inputs, n: 1000, seed: 1 }));
}

module.exports = { AGENTS: { 'careful (fixture)': careful, 'unit-blind (fixture)': unitBlind, 'point-estimate (fixture)': pointEstimate } };
