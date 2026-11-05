// Unit conversion for the quantities that trip up field data. Factors are exact definitions or standard values.
const LENGTH: Record<string, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344 };
const AREA: Record<string, number> = { m2: 1, km2: 1e6, acre: 4046.8564224, mi2: 2589988.110336 };
const PRESSURE: Record<string, number> = { pa: 1, kpa: 1e3, mpa: 1e6, bar: 1e5, psi: 6894.757293168 };
const GROUPS = [LENGTH, AREA, PRESSURE];
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
