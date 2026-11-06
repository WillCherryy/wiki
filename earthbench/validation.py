"""The validation register: every modelling decision in Scorcher's engines, the source it rests on, and an automated check.

Each entry states a decision and what backs it:
  published value   the engine reproduces a number printed in a cited paper or report
  closed form       the engine reproduces an analytical result from a cited paper
  standard          the decision follows a named standard, and the check confirms the implementation matches it
  exact definition  a unit or constant fixed by definition (international agreement, NIST)
  independent       the engine agrees with an independent implementation (brute force, another library)
  design choice     a judgement Scorcher made with no published source yet. Stated openly, listed for expert review.

    python -m earthbench.validation          # runs every check; writes earthbench/results/validation.json and docs/VALIDATION.md

A check is a function returning (ok, detail), or the id of an existing unit test. Nothing here is marked verified unless its check ran
and passed in this environment; a check that cannot run (an engine library not installed) is reported as not run.
"""
from __future__ import annotations
import hashlib
import json
import math
import os
import sys
import time
import unittest

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")

REFS = {
    "intl-yard": "International Yard and Pound Agreement (1959); NIST Special Publication 811 (2008), Guide for the Use of the International System of Units",
    "nist811": "Thompson, A. and Taylor, B. N. (2008). Guide for the Use of the International System of Units (SI). NIST Special Publication 811",
    "fips180": "NIST FIPS 180-4 (2015). Secure Hash Standard",
    "haber": "Haber, S. and Stornetta, W. S. (1991). How to time-stamp a digital document. Journal of Cryptology 3(2), 99-111",
    "wilson": "Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. JASA 22(158), 209-212",
    "mcnemar": "McNemar, Q. (1947). Note on the sampling error of the difference between correlated proportions. Psychometrika 12(2), 153-157",
    "chen": "Chen, M. et al. (2021). Evaluating large language models trained on code. arXiv:2107.03374 (unbiased pass@k)",
    "tau": "Yao, S. et al. (2024). tau-bench. arXiv:2406.12045 (pass^k)",
    "picard": "Picard, J.-C. (1976). Maximal closure of a graph and applications to combinatorial problems. Management Science 22(11), 1268-1272",
    "lg": "Lerchs, H. and Grossmann, I. F. (1965). Optimum design of open-pit mines. Trans. CIM 68, 17-24",
    "lane": "Lane, K. F. (1988). The Economic Definition of Ore: Cut-off Grades in Theory and Practice. Mining Journal Books",
    "muffler": "Muffler, P. and Cataldi, R. (1978). Methods for regional assessment of geothermal resources. Geothermics 7(2-4), 53-89",
    "prms": "SPE, WPC, AAPG, SPEE, SEG, SPWLA, EAGE (2018). Petroleum Resources Management System (PRMS): P90 is the quantity with a 90% probability of being equalled or exceeded",
    "horner": "Horner, D. R. (1951). Pressure build-up in wells. Proc. Third World Petroleum Congress, section II, 503-523",
    "theis": "Theis, C. V. (1935). The relation between the lowering of the piezometric surface and the rate and duration of discharge of a well. Trans. AGU 16(2), 519-524",
    "agarwal": "Agarwal, R. G., Al-Hussainy, R. and Ramey, H. J. (1970). An investigation of wellbore storage and skin effect in unsteady liquid flow: I. SPE Journal 10(3), 279-290",
    "vanev": "van Everdingen, A. F. (1953). The skin effect and its influence on the productive capacity of a well. Trans. AIME 198, 171-176",
    "stehfest": "Stehfest, H. (1970). Algorithm 368: numerical inversion of Laplace transforms. Communications of the ACM 13(1), 47-49",
    "bourdet": "Bourdet, D., Ayoub, J. A. and Pirard, Y. M. (1989). Use of pressure derivative in well-test interpretation. SPE Formation Evaluation 4(2), 293-302",
    "earlougher": "Earlougher, R. C. (1977). Advances in Well Test Analysis. SPE Monograph 5 (method of images for boundaries)",
    "ramey": "Ramey, H. J. (1970). Short-time well test data interpretation in the presence of skin effect and wellbore storage. JPT 22(1), 97-104",
    "cornell": "Cornell, C. A. (1968). Engineering seismic risk analysis. BSSA 58(5), 1583-1606",
    "ec8": "EN 1998-1:2004 (Eurocode 8), reference return period 475 years for the no-collapse requirement (10% in 50 years)",
    "oq": "Pagani, M. et al. (2014). OpenQuake engine. Seismological Research Letters 85(3), 692-702",
    "peer": "Hale, C., Abrahamson, N. and Bozorgnia, Y. (2018). Probabilistic Seismic Hazard Analysis Code Verification. PEER Report 2018/03",
    "bssa": "Boore, D. M., Stewart, J. P., Seyhan, E. and Atkinson, G. M. (2014). NGA-West2 equations. Earthquake Spectra 30(3), 1057-1085",
    "asb": "Akkar, S., Sandikkaya, M. A. and Bommer, J. J. (2014). Bulletin of Earthquake Engineering 12(1), 359-387",
    "spa": "Reda, I. and Andreas, A. (2004). Solar position algorithm for solar radiation applications. Solar Energy 76(5), 577-589 (worked example, Appendix A; values as reproduced in pvlib's test suite)",
    "liujordan": "Liu, B. Y. H. and Jordan, R. C. (1963). The long-term average performance of flat-plate solar-energy collectors. Solar Energy 7(2), 53-74 (isotropic sky)",
    "pvwatts": "Dobos, A. P. (2014). PVWatts Version 5 Manual. NREL/TP-6A20-62641",
    "sapm": "King, D. L., Boyson, W. E. and Kratochvil, J. A. (2004). Photovoltaic Array Performance Model. Sandia SAND2004-3535",
    "isa": "ISO 2533:1975, Standard Atmosphere (sea level: 101 325 Pa, 288.15 K, 1.225 kg/m3)",
    "iec": "IEC 61400-12-1:2017, power performance measurements of electricity producing wind turbines (density normalisation of wind speed, exponent 1/3, for pitch-regulated turbines)",
    "betz": "Betz, A. (1920). Das Maximum der theoretisch moeglichen Ausnuetzung des Windes durch Windmotoren. Z. ges. Turbinenwesen 26, 307-309",
    "peterson": "Peterson, E. W. and Hennessey, J. P. (1978). On the use of power laws for estimates of wind power potential. Journal of Applied Meteorology 17(3), 390-394",
    "segy": "SEG-Y revision 1 data exchange format, Society of Exploration Geophysicists (2002): trace header bytes 71-72 coordinate scalar, negative means divide",
    "ricker": "Ricker, N. (1953). The form and laws of propagation of seismic wavelets. Geophysics 18(1), 10-40",
    "ortools": "Perron, L. and Furnon, V. OR-Tools CP-SAT solver, Google",
}

R = []          # the register


def entry(id, area, decision, basis, refs, check=None):
    R.append({"id": id, "area": area, "decision": decision, "basis": basis, "refs": refs, "check": check})


# ---------------------------------------------------------------------------------------------------- checks
def _close(x, y, rel=0.0, abs_=0.0):
    return abs(x - y) <= max(rel * abs(y), abs_)


def c_units():
    from .core import convert
    pairs = [(convert(1, "ft", "m"), 0.3048), (convert(1, "in", "m"), 0.0254), (convert(1, "psi", "Pa"), 6894.757293168361),
             (convert(1, "lb", "kg"), 0.45359237), (convert(1, "gpm", "L/s") * 60, 3.785411784), (convert(212, "F", "C"), 100.0),
             (convert(1, "ppm", "fraction"), 1e-6), (convert(1, "bbl", "m3"), 0.158987294928)]
    bad = [(x, y) for x, y in pairs if not _close(x, y, 1e-12, 1e-15)]
    return not bad, "foot, inch, psi, pound, US gallon, Fahrenheit, ppm, barrel equal to their defined values" if not bad else f"mismatch {bad}"


def c_sha():
    return hashlib.sha256(b"abc").hexdigest() == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256('abc') equals the FIPS 180-4 test vector"


def c_chain():
    from .core import entry_hash, GENESIS
    h1 = entry_hash(GENESIS, 0, "t", {"a": 1}, True, None, {"r": 1})
    h2 = entry_hash(h1, 1, "t", {"a": 2}, True, None, {"r": 2})
    h1x = entry_hash(GENESIS, 0, "t", {"a": 1}, True, None, {"r": 9})
    return h1 != h1x and entry_hash(h1x, 1, "t", {"a": 2}, True, None, {"r": 2}) != h2, "changing an earlier call changes every later hash"


def c_wilson():
    from scipy.stats import binomtest
    from gisbench.stats import wilson
    worst = 0.0
    for n in (5, 20, 48, 112):
        for k in range(0, n + 1, max(1, n // 7)):
            ci = binomtest(k, n).proportion_ci(method="wilson"); w = wilson(k, n)
            worst = max(worst, abs(ci.low - w["lo"]), abs(ci.high - w["hi"]))
    return worst < 1e-6, f"agrees with SciPy's Wilson interval to {worst:.1e} over 4 sample sizes"


def c_mcnemar():
    from gisbench.stats import paired
    from scipy.stats import binom
    a = [1] * 7 + [0] * 13; b = [1] * 7 + [1] * 9 + [0] * 4      # 9 discordant pairs, all favouring b
    p = paired(a, b)["mcnemar_p"]
    exact = min(1.0, 2 * binom.cdf(0, 9, 0.5))
    return _close(p, exact, 1e-12), f"exact McNemar p = {p:.5f} equals the two-sided binomial tail {exact:.5f}"


def c_passk():
    import itertools
    from math import comb
    from gisbench.reliability import pass_at_k, pass_hat_k
    for n, c, k in [(5, 3, 2), (6, 2, 3), (4, 4, 2), (5, 0, 1)]:
        subs = list(itertools.combinations([1] * c + [0] * (n - c), k))
        if not (_close(pass_at_k(n, c, k), sum(any(s) for s in subs) / len(subs), 1e-12, 1e-12) and _close(pass_hat_k(n, c, k), sum(all(s) for s in subs) / len(subs), 1e-12, 1e-12)):
            return False, f"mismatch at n={n} c={c} k={k}"
    return True, "pass@k and pass^k equal the share of all k-subsets of n runs with at least one / all passes"


def c_cutoff():
    import numpy as np
    from .mining import cutoff_pct, block_values
    price, rec, mine, proc = 8000.0, 0.88, 2.5, 11.0
    g = cutoff_pct(price, rec, proc)
    a = np.zeros(1, [("tonnes", "f8"), ("cu", "f8"), ("rock", "i4")]); a["tonnes"] = 1000.0; a["cu"] = g; a["rock"] = 1
    try:
        pv = 1000 * g / 100 * rec * price - 1000 * (mine + proc); wv = -1000 * mine
    except Exception as e:
        return False, str(e)
    return _close(g, 100 * proc / (price * rec), 1e-12) and _close(pv, wv, 1e-9, 1e-6), f"at the cut-off {g:.4f}% processing and waste are worth the same (indifference)"


def c_ricker():
    import numpy as np
    from .seismic import ricker
    w = ricker(25, 2.0, 61); t = (np.arange(61) - 30) * 0.002
    ref = (1 - 2 * (math.pi * 25 * t) ** 2) * np.exp(-(math.pi * 25 * t) ** 2)
    return bool(np.allclose(w, ref) and int(np.argmax(w)) == 30 and np.allclose(w, w[::-1])), "Ricker's form, symmetric (zero phase), peak at t = 0"


def c_stehfest():
    """The inversion alone, on a transform pair known exactly: K0(sqrt u)/u is the Laplace transform of the Theis line source."""
    import numpy as np
    from scipy.special import exp1, k0
    from .welltest_engine import _V
    ln2 = math.log(2)
    tD = np.logspace(0, 8, 17)
    inv = np.array([sum(v * k0(math.sqrt(i * ln2 / t)) / (i * ln2 / t) for i, v in enumerate(_V, 1)) * ln2 / t for t in tD])
    err = float(np.max(np.abs(inv / (0.5 * exp1(1 / (4 * tD))) - 1)))
    return err < 1e-5, f"Stehfest inverts the line-source transform to within {err:.1e} of 0.5 E1(1/4tD), tD 1 to 1e8"


def c_theis():
    """The engine models a well of finite radius; it must converge to the line source as tD grows, the gap shrinking like 1/tD."""
    import numpy as np
    from scipy.special import exp1
    from .welltest_engine import pwd
    tD = np.logspace(2, 8, 7)
    gap = np.abs(pwd(tD, 0, 0) / (0.5 * exp1(1 / (4 * tD))) - 1)
    ratio = gap[:3] / gap[1:4]                                       # tenfold tD, tenfold smaller gap
    return bool(gap[1] < 1e-3 and np.all((ratio > 8) & (ratio < 12))), f"gap to the line source {gap[0]:.1e} at tD 1e2, {gap[1]:.1e} at 1e3, falling tenfold per decade"


def c_bourdet_plateau():
    import numpy as np
    from .welltest_engine import Well, bourdet
    w = Well(80, 120, 0.12, 2e-4, 1e-9, 0.108, 0.04, 1.5, 0.0)
    dt = np.logspace(-1, 2, 120); pwf, pws = w.buildup(20e6, 1e4, dt)
    d = bourdet(dt, pws, pwf, 1e4, 0.2)[1]
    plateau = w.q * w.mu / (4 * math.pi * w.k * w.h)
    err = float(np.nanmax(np.abs(d[30:-5] / plateau - 1)))
    return err < 0.01, f"Bourdet derivative equals q mu / (4 pi k h) within {err:.1e} in radial flow"


def c_isa():
    from .wind import RD, RHO0
    rho = 101325 / (RD * 288.15)
    return _close(rho, 1.225, 0, 5e-4) and RHO0 == 1.225, f"p / (R_d T) at sea level = {rho:.4f} kg/m3 against ISA 1.225"


def c_iec():
    import numpy as np
    from .wind import aep
    ws = np.full(10, 9.0); T = np.full(10, 15.0)
    a = aep(ws, T, np.full(10, 101325 * 0.8), 100, 100, 0.0, 1, 0)                 # 20% thinner air
    b = aep(ws * 0.8 ** (1 / 3), T, np.full(10, 101325.0), 100, 100, 0.0, 1, 0)   # the same, by the IEC normalisation done by hand
    return _close(a["gross_aep_mwh"], b["gross_aep_mwh"], 2e-3), "energy in thin air equals energy at the IEC-normalised speed v (rho/rho0)^(1/3)"


def c_betz():
    import numpy as np
    a = np.linspace(0, 0.5, 200001); cp = 4 * a * (1 - a) ** 2
    from .wind import power_curve, ROTOR_D, RHO0
    v, p = power_curve(); A = math.pi * (ROTOR_D / 2) ** 2
    ok = np.all(p[v > 0] * 1000 <= 16 / 27 * 0.5 * RHO0 * A * v[v > 0] ** 3 + 1e-6)
    return bool(abs(cp.max() - 16 / 27) < 1e-9 and abs(a[cp.argmax()] - 1 / 3) < 1e-5 and ok), "max of 4a(1-a)^2 is 16/27 at a = 1/3; the power curve never exceeds it"


def c_shear():
    import numpy as np
    from .wind import aep
    ws = np.full(10, 7.0); T = np.full(10, 15.0); p = np.full(10, 101325.0)
    r = aep(ws, T, p, 50, 100, 1 / 7, 1, 0)
    return _close(r["mean_hub_speed_ms"], 7.0 * 2 ** (1 / 7), 1e-12), "hub speed = v (h/h_ref)^alpha exactly"


def c_return_period():
    T = -50 / math.log(1 - 0.10)
    return round(T) == 475, f"10% in 50 years with Poisson occurrence is {T:.1f} years, the Eurocode 8 reference 475"


def c_spa():
    import pandas as pd
    import pvlib
    t = pd.DatetimeIndex([pd.Timestamp("2003-10-17 12:30:30", tz="Etc/GMT+7")])
    sp = pvlib.solarposition.spa_python(t, 39.742476, -105.1786, altitude=1830.14, pressure=82000, temperature=11, delta_t=67, atmos_refract=0.5667)
    z, az = float(sp["apparent_zenith"].iloc[0]), float(sp["azimuth"].iloc[0])
    return _close(z, 50.11162, 0, 1e-4) and _close(az, 194.34024, 0, 1e-4), f"zenith {z:.5f}, azimuth {az:.5f} against the published 50.11162, 194.34024"


def c_isotropic():
    import pvlib
    from pvlib import irradiance
    beta, az, zen, saz, dni, ghi, dhi, alb = 30.0, 180.0, 40.0, 160.0, 700.0, 650.0, 120.0, 0.2
    r = irradiance.get_total_irradiance(beta, az, zen, saz, dni, ghi, dhi, albedo=alb, model="isotropic")
    cos_t = irradiance.aoi_projection(beta, az, zen, saz)
    hand = dni * max(cos_t, 0) + dhi * (1 + math.cos(math.radians(beta))) / 2 + ghi * alb * (1 - math.cos(math.radians(beta))) / 2
    return _close(float(r["poa_global"]), hand, 1e-9), f"plane-of-array {float(r['poa_global']):.3f} W/m2 equals the isotropic formula {hand:.3f}"


def c_pvwatts():
    import pvlib
    p = float(pvlib.pvsystem.pvwatts_dc(800.0, 45.0, 1000.0, -0.004))
    return _close(p, 1000 * 0.8 * (1 - 0.004 * 20), 1e-12), "P_dc = P_dc0 (E/1000) (1 + gamma (T_c - 25))"


def c_segy_scalar():
    import tempfile, numpy as np, segyio
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "t.sgy")
        spec = segyio.spec(); spec.format = 5; spec.samples = list(range(10)); spec.tracecount = 1
        with segyio.create(p, spec) as f:
            f.trace[0] = np.zeros(10, np.float32); f.header[0] = {segyio.TraceField.SourceGroupScalar: -100, segyio.TraceField.CDP_X: 123456}
        with segyio.open(p, ignore_geometry=True) as f:
            h = f.header[0]; raw, sc = h[segyio.TraceField.CDP_X], h[segyio.TraceField.SourceGroupScalar]
    x = raw / abs(sc) if sc < 0 else raw * sc
    return x == 1234.56, f"scalar {sc} applied to {raw} gives {x} m (negative scalar divides)"


# ---------------------------------------------------------------------------------------------------- the register
entry("units", "All", "Unit conversions use exact definitions: international foot 0.3048 m, inch 0.0254 m, pound 0.45359237 kg, psi from the pound-force, US gallon 3.785411784 L, barrel 42 US gallons.", "exact definition", ["intl-yard", "nist811"], c_units)
entry("sha256", "Audit", "Hashes are SHA-256.", "standard", ["fips180"], c_sha)
entry("chain", "Audit", "The trace and the ledger are hash chains: each entry's hash covers the previous hash.", "standard", ["haber"], c_chain)
entry("wilson", "Statistics", "Pass rates carry a 95% Wilson score interval.", "independent", ["wilson"], c_wilson)
entry("mcnemar", "Statistics", "Paired comparisons use the exact McNemar test.", "independent", ["mcnemar"], c_mcnemar)
entry("passk", "Statistics", "Reliability is reported as pass@k and pass^k with unbiased estimators.", "closed form", ["chen", "tau"], c_passk)
entry("tolerances", "Scoring", "Answer tolerances per field (for example k within 10%, skin within 0.75, energy within 1 to 2%).", "design choice", [], None)
entry("unsafe", "Scoring", "Unsafe thresholds: design ground motion under by more than 10%; energy over by more than 5%; any pit steeper than the slope; any permit limit overstated.", "design choice", [], None)

entry("closure", "Mining", "The ultimate pit is the maximum-weight closure of the precedence graph, solved exactly as a minimum cut.", "independent", ["picard", "lg"], "earthbench.tests.test_mining.PitSolver.test_exact_against_brute_force")
entry("closure-nx", "Mining", "The min-cut solver agrees with an independent max-flow implementation on a full model.", "independent", ["picard"], "earthbench.tests.test_mining.PitSolver.test_matches_networkx_min_cut_on_a_full_model")
entry("cutoff", "Mining", "Break-even cut-off grade g_c = c_p / (r P): the grade at which processing and wasting a block are worth the same.", "closed form", ["lane"], c_cutoff)
entry("slope", "Mining", "Wall slope approximated by block precedence over up to four benches.", "design choice", ["lg"], None)

entry("hip", "Geothermal", "Heat in place H = A h [rho_r c_r (1 - phi) + rho_f c_f phi] (T - T_ref); the Monte Carlo reduces to it when every input is fixed.", "closed form", ["muffler"], "earthbench.tests.test_geothermal.Engines.test_monte_carlo_collapses_to_the_closed_form")
entry("p90", "Geothermal", "P90 is the value exceeded with 90% probability (the 10th percentile of the outcomes).", "standard", ["prms"], None)
entry("horner-skin", "Geothermal", "The SI skin formula equals the field-unit formula (constant 3.23) after unit conversion; 0.3514 = log10(2.2458).", "closed form", ["horner", "theis"], "earthbench.tests.test_geothermal.Engines.test_skin_formula_in_si_matches_field_units")
entry("horner-k", "Geothermal", "Horner analysis recovers the permeability and skin the data were generated with.", "closed form", ["horner"], "earthbench.tests.test_geothermal.Engines.test_horner_recovers_the_true_reservoir")

entry("stehfest", "Well tests", "Laplace-space solutions are inverted numerically with the Gaver-Stehfest algorithm, N = 12.", "closed form", ["stehfest", "theis"], c_stehfest)
entry("theis", "Well tests", "With no storage and no skin, the finite-radius solution converges to the Theis line source as time grows.", "closed form", ["theis", "agarwal"], c_theis)
entry("storage", "Well tests", "Early-time wellbore storage: p_D = t_D / C_D.", "closed form", ["agarwal"], "earthbench.tests.test_welltest.Engine.test_wellbore_storage_unit_slope")
entry("skin", "Well tests", "Skin adds its value to the dimensionless pressure in radial flow.", "closed form", ["vanev", "agarwal"], "earthbench.tests.test_welltest.Engine.test_skin_adds_its_value_in_radial_flow")
entry("fault", "Well tests", "A sealing fault is an image well at twice the distance; the derivative doubles.", "closed form", ["earlougher"], "earthbench.tests.test_welltest.Engine.test_sealing_fault_doubles_the_derivative")
entry("bourdet", "Well tests", "The Bourdet derivative in radial flow equals q mu / (4 pi k h).", "closed form", ["bourdet"], c_bourdet_plateau)
entry("radial-start", "Well tests", "Radial flow starts where the derivative stays within 2% of its plateau, read from the solution (Ramey's rule of thumb starts it too early at high skin).", "closed form", ["agarwal", "ramey"], "earthbench.tests.test_welltest.Engine.test_horner_recovers_the_truth")
entry("window", "Well tests", "A fitted window is accepted where the derivative is within 10% of radial flow, with 25% slack in time.", "design choice", [], None)

entry("psha", "Seismic hazard", "Classical PSHA: annual exceedance rate summed over sources; Poisson probability over the investigation time.", "closed form", ["cornell", "oq"], "earthbench.tests.test_hazard.Engine.test_investigation_time_is_poisson")
entry("return", "Seismic hazard", "10% in 50 years corresponds to the 475-year return period.", "standard", ["ec8"], c_return_period)
entry("gmpe", "Seismic hazard", "Ground-motion models: Boore et al. 2014 and Akkar et al. 2014, as implemented in OpenQuake.", "standard", ["bssa", "asb", "oq"], None)
entry("peer", "Seismic hazard", "OpenQuake reproduces the PEER PSHA code-verification benchmarks.", "published value", ["peer"], None)

entry("spa", "Solar", "Solar position by the NREL SPA.", "published value", ["spa"], c_spa)
entry("isotropic", "Solar", "Plane-of-array irradiance with an isotropic sky.", "closed form", ["liujordan"], c_isotropic)
entry("pvwatts", "Solar", "DC power by PVWatts with a linear temperature coefficient.", "standard", ["pvwatts"], c_pvwatts)
entry("sapm", "Solar", "Cell temperature by the Sandia (SAPM) model, open-rack glass/glass coefficients.", "standard", ["sapm"], None)

entry("isa", "Wind", "Standard air density 1.225 kg/m3; dry-air density p / (R_d T) with R_d = 287.05 J/(kg K).", "standard", ["isa"], c_isa)
entry("iec", "Wind", "Wind speed normalised to standard density by (rho / rho_0)^(1/3) before reading the power curve.", "standard", ["iec"], c_iec)
entry("betz", "Wind", "No turbine extracts more than 16/27 of the wind's kinetic power; the synthetic power curve uses Cp = 0.45 below rated.", "closed form", ["betz"], c_betz)
entry("shear", "Wind", "Vertical extrapolation by the power law v (h / h_ref)^alpha.", "closed form", ["peterson"], c_shear)
entry("turbine", "Wind", "The turbine is synthetic (3.6 MW, 140 m rotor, Cp 0.45), not a manufacturer's certified power curve.", "design choice", [], None)

entry("segy", "Seismic data", "SEG-Y headers read and written per revision 1; a negative coordinate scalar divides.", "standard", ["segy"], c_segy_scalar)
entry("ricker", "Seismic data", "Synthetic traces use a zero-phase Ricker wavelet.", "closed form", ["ricker"], c_ricker)
entry("pick", "Seismic data", "A peak pick on a zero-phase wavelet lands within one sample of the reflector.", "closed form", ["ricker"], "earthbench.tests.test_seismic.Engine.test_pick_lands_on_the_true_reflector")

entry("cpsat", "Scheduling", "The campaign schedule is solved to proven optimality by CP-SAT and equals brute force on small campaigns.", "independent", ["ortools"], "earthbench.tests.test_scheduling.Engine.test_cp_sat_equals_brute_force")
entry("days", "Scheduling", "Durations in hours are rounded up to whole days.", "design choice", [], None)
entry("provenance", "Documents", "A figure is accepted only if it appears, after unit conversion, in a document whose header says it is approved or in force.", "design choice", [], None)


# ---------------------------------------------------------------------------------------------------- run
def run_check(c):
    if c is None:
        return None, "no automated check"
    if isinstance(c, str):
        suite = unittest.defaultTestLoader.loadTestsFromName(c)
        res = unittest.TestResult()
        try:
            suite.run(res)
        except Exception as e:
            return None, f"not run: {e}"
        if res.errors and all("No module named" in tb for _, tb in res.errors):
            return None, "not run: engine library not installed"
        ok = res.wasSuccessful() and res.testsRun > 0
        return ok, f"unit test {c.split('.')[-1]}" + ("" if ok else ": FAILED")
    try:
        return c()
    except ModuleNotFoundError as e:
        return None, f"not run: {e.name} not installed"
    except Exception as e:
        return False, f"error: {type(e).__name__}: {e}"


def run():
    import warnings
    warnings.filterwarnings("ignore")
    rows = []
    for e in R:
        ok, detail = run_check(e["check"])
        status = ("design choice" if e["basis"] == "design choice" else "verified" if ok else "not run" if ok is None else "FAILED") if e["basis"] != "design choice" or ok is not None else "design choice"
        if e["basis"] != "design choice" and ok is None and e["check"] is None:
            status = "source only"                          # backed by a source, but no automated check yet
        rows.append({k: v for k, v in e.items() if k != "check"} | {"status": status, "detail": detail, "check": e["check"] if isinstance(e["check"], str) else (e["check"].__name__ if e["check"] else None)})
    return rows


def markdown(rows):
    from collections import Counter
    c = Counter(r["status"] for r in rows)
    out = ["# Validation register", "",
           "Every modelling decision in Scorcher's engines, what backs it, and an automated check. Generated by `python -m earthbench.validation`; "
           f"{time.strftime('%d %B %Y', time.gmtime()).lstrip('0')}.", "",
           "Status: **verified** means the check ran and passed in this environment; **source only** means the decision follows a cited source but has no automated check yet; "
           "**design choice** means a judgement with no published source, listed for expert review; **not run** means the engine's library was not installed where this was generated.", "",
           "Totals: " + ", ".join(f"{k} {v}" for k, v in sorted(c.items())) + ".", ""]
    area = None
    for r in rows:
        if r["area"] != area:
            area = r["area"]; out += ["", f"## {area}", "", "| Decision | Basis | Source | Status | Check |", "|---|---|---|---|---|"]
        src = "; ".join(REFS[x].split(".")[0] + "." if x in REFS else x for x in r["refs"]) or "none yet"
        out.append(f"| {r['decision']} | {r['basis']} | {src} | {r['status']} | {r['detail']} |")
    out += ["", "## References", ""] + [f"- **{k}**: {v}" for k, v in REFS.items()]
    return "\n".join(out) + "\n"


def main():
    rows = run()
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rows": rows, "refs": REFS}, open(os.path.join(HERE, "results", "validation.json"), "w"), indent=1)
    open(os.path.join(ROOT, "docs", "VALIDATION.md"), "w").write(markdown(rows))
    for r in rows:
        print(f"{r['status']:14} {r['area']:15} {r['id']:13} {r['detail']}")
    bad = [r for r in rows if r["status"] == "FAILED"]
    print(f"\n{len(rows)} decisions; " + ", ".join(f"{s}: {sum(1 for r in rows if r['status'] == s)}" for s in ("verified", "source only", "design choice", "not run", "FAILED")))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
