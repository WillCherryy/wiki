'use strict';
// Bottom-hole temperature correction by the Horner method.
// After circulation stops for time tc (h), the measured temperature at shut-in time dt (h) follows
//   T(dt) = Tf + m ln((tc + dt) / dt)     (m is negative: a well cooled by circulation warms back towards Tf as shut-in time grows)
// so a straight-line fit of T against x = ln((tc + dt) / dt) has intercept Tf, the formation temperature (x -> 0 as dt -> infinity).
// The interval on Tf comes from the regression standard error and Student's t. Few readings give a wide interval, which is the honest answer.
const T975 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
const t975 = df => df < 1 ? NaN : df <= 30 ? T975[df] : df <= 60 ? 2.0 : 1.96;

// readings: [{ dtHours, tempC }], tcHours: circulation time before the readings
function hornerExtrapolate(readings, tcHours) {
  const n = readings.length; if (n < 2) throw new Error('need at least two readings');
  if (!(tcHours > 0)) throw new Error('circulation time must be positive');
  if (readings.some(r => !(r.dtHours > 0))) throw new Error('shut-in times must be positive');
  const x = readings.map(r => Math.log((tcHours + r.dtHours) / r.dtHours)), y = readings.map(r => r.tempC);
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  if (sxx === 0) throw new Error('readings must be at different shut-in times');
  const m = sxy / sxx, Tf = my - m * mx;
  if (n === 2) return { formationTempC: Tf, slope: m, df: 0, ci95: null, n, note: 'two readings fit a line exactly: no interval can be estimated' };
  let rss = 0; for (let i = 0; i < n; i++) rss += (y[i] - (Tf + m * x[i])) ** 2;
  const df = n - 2, s2 = rss / df, se = Math.sqrt(s2 * (1 / n + mx * mx / sxx)), h = t975(df) * se;
  return { formationTempC: Tf, slope: m, df, se, ci95: [Tf - h, Tf + h], n, residualC: Math.sqrt(s2) };
}
module.exports = { hornerExtrapolate };
