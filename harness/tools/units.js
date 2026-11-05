'use strict';
// Unit conversion for the quantities that trip up field data. Factors are exact definitions or standard values.
const LENGTH = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344 };
const AREA = { m2: 1, km2: 1e6, acre: 4046.8564224, mi2: 2589988.110336 };
const PRESSURE = { pa: 1, kpa: 1e3, mpa: 1e6, bar: 1e5, psi: 6894.757293168 };
const GROUPS = { length: LENGTH, area: AREA, pressure: PRESSURE };
function convert(value, from, to) {
  if (from === to) return value;
  const F = u => u.toLowerCase(), f = F(from), t = F(to), temp = { c: 1, f: 1, k: 1 };
  if (f in temp && t in temp) { const c = f === 'c' ? value : f === 'f' ? (value - 32) * 5 / 9 : value - 273.15; return t === 'c' ? c : t === 'f' ? c * 9 / 5 + 32 : c + 273.15; }
  for (const g of Object.values(GROUPS)) if (f in g && t in g) return value * g[f] / g[t];
  throw new Error(`cannot convert ${from} to ${to}`);
}
module.exports = { convert };
