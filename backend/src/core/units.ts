// Unit conversion for the quantities that trip up field data. Factors are exact definitions or standard values (NIST SP 811).
const LENGTH: Record<string, number> = { m: 1, km: 1000, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254, mi: 1609.344 };
const AREA: Record<string, number> = { m2: 1, km2: 1e6, acre: 4046.8564224, mi2: 2589988.110336 };
const PRESSURE: Record<string, number> = { pa: 1, kpa: 1e3, mpa: 1e6, bar: 1e5, psi: 6894.757293168 };
const VISCOSITY: Record<string, number> = { 'pa*s': 1, 'pa s': 1, 'mpa*s': 1e-3, 'mpa s': 1e-3, cp: 1e-3, p: 0.1 };
const COMPRESSIBILITY: Record<string, number> = { '1/pa': 1, '1/kpa': 1e-3, '1/mpa': 1e-6, '1/bar': 1e-5, '1/psi': 1 / 6894.757293168 };
const FLOW: Record<string, number> = { 'l/s': 1, 'm3/s': 1000, 'm3/h': 1 / 3.6, 'm3/d': 1 / 86.4, gpm: 3.785411784 / 60, 'bbl/d': 158.987294928 / 86400 };   // US gallon
const MASSFLOW: Record<string, number> = { 'kg/s': 1, 't/h': 1 / 3.6, 'kg/h': 1 / 3600 };
const TIME: Record<string, number> = { s: 1, min: 60, h: 3600, d: 86400 };
const GROUPS = [LENGTH, AREA, PRESSURE, VISCOSITY, COMPRESSIBILITY, FLOW, MASSFLOW, TIME];
export function convert(value: number, from: string, to: string): number {
  if (from === to) return value;
  const f = from.toLowerCase(), t = to.toLowerCase();
  if (['c', 'f', 'k'].includes(f) && ['c', 'f', 'k'].includes(t)) {
    const c = f === 'c' ? value : f === 'f' ? (value - 32) * 5 / 9 : value - 273.15;
    return t === 'c' ? c : t === 'f' ? c * 9 / 5 + 32 : c + 273.15;
  }
  for (const g of GROUPS) { const a = g[f], b = g[t]; if (a !== undefined && b !== undefined) return value * a / b; }
  throw new Error(`cannot convert ${from} to ${to}`);
}
