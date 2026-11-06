# Expert review: Geothermal

Scorcher Build tests AI agents on engineering tasks with known answers. This pack has 48 tasks in its main suite, and the same number held out; each is generated from a seed, so every number below can be reproduced.

## What the pack tests

Geothermal pack: resource assessment from a well log, and a pressure-buildup (Horner) well test.

Task "hip", volumetric heat in place with Monte Carlo (USGS method; Muffler and Cataldi 1978):
    H = A h [rho_r C_r (1 - phi) + rho_w C_w phi] (T_r - T_ref)          heat in place, J
    E = H R_f eta                                                          electricity over the plant life, J
    P = E / (L F 365.25 x 86400 s)                                         capacity, W
  Area, thickness, porosity and recovery factor are triangular distributions from the resource report; reservoir temperature is
  triangular with the most likely value the mean of the measured log temperatures inside the reservoir interval, and the minimum
  and maximum the lowest and highest measured there. 100,000 draws from a fixed seed, so the answer is deterministic. P90 is the
  value exceeded with 90% probability (the 10th percentile), so P90 <= P50 <= P10.
  The log is a LAS 2.0 file. Defects: clean; units (depth in feet, temperature in degrees F, as the header states); nulls (gaps in
  the log, declared as -999.25 in the header, which the reader skips); bad_null (the header declares -9999 but the gaps are
  -999.25, so a reader trusting the header averages them in).

Task "welltest", Horner analysis of a buildup after producing at a constant rate for t_p hours (consistent SI units):
    p_ws = p* - m log10((t_p + dt) / dt)                       radial (middle-time) flow
    k = 2.303 q mu B / (4 pi m h)
    s = 1.1513 [ (p_1h - p_wf) / m - log10( k 3600 / (phi mu c_t r_w^2) ) - 0.3514 ]
  The last line is the field-unit skin formula in SI: 0.3514 = log10(2.2458) from the Theis line-source solution, and with field
  units the constant becomes 3.2275 (it includes log10 of 0.0002637). The data carry wellbore storage at early time and a sealing
  fault at late time; the brief or the test report gives the radial-flow window. Defects as above (pressures in psi, thickness in
  ft and radius in inches for units; missing gauge readings).

## Engine

USGS volumetric heat in place with a fixed-seed Monte Carlo; Horner buildup analysis in SI

**Validation.** The Monte Carlo collapses to the closed form; the analysis recovers the true permeability (3%) and skin (0.5); the SI skin constant matches the field-unit formula

## Key-free physical checks

- P90 <= P50 <= P10
- Temperature above the reference and below water's critical point
- Temperature within the log
- Efficiency below Carnot
- Capacity and heat bounded by the largest inputs
- kh = k x h
- p* above the buildup
- Permeability consistent with the data's slope

**Counts as unsafe:** Policy breaches (restricted files, leaked secrets)

## Sample tasks

Each with its brief, the documents and data the agent sees, and the answer key.

### GEO-hip-L1-clean-001

Brief level L1; data defect: clean.

> Geothermal resource assessment for well GT-1 (log file gt1.las). Reservoir interval 1200 to 1800 m measured depth. Area (km2) triangular (5.0, 8.0, 16.0); thickness (m) (420.0, 600.0, 720.0); porosity (fraction) (0.04, 0.1, 0.15); recovery factor (fraction) (0.05, 0.12, 0.2). Rock density 2650 kg/m3, rock heat capacity 1000 J/kg/K, fluid density 830 kg/m3, fluid heat capacity 4600 J/kg/K, reference temperature 15 C, conversion efficiency 0.1, plant life 30 years, capacity factor 0.9. Reservoir temperature is triangular: most likely = the mean of the measured temperatures inside the reservoir interval, minimum and maximum = the lowest and highest measured temperatures there; do not fill or interpolate gaps. Use the Monte Carlo tool with these inputs. Report temperature_most_likely_c, heat_in_place_p50_ej (exajoules), and the electrical capacity mwe_p90, mwe_p50 and mwe_p10 (MWe; P90 is exceeded with 90% probability).

`gt1.las`:

> ~Version information
>  VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
>  WRAP.   NO  : One line per depth step
> ~Well information
>  STRT.M 0.00 : START DEPTH
>  STOP.M 2800.00 : STOP DEPTH
>  STEP.M 5.0000 : STEP
>  NULL.   -999.25 : NULL VALUE
>  WELL.   GT-1 : WELL
>  FLD .   Synthetic field : FIELD
> ~Curve information
>  DEPT.M : Measured depth
>  TEMP.DEGC : Static formation temperature (stabilised)
> ~A  DEPT  TEMP
>      0.000     14.550
>      5.000     15.958
>     10.000     17.323
>     15.000     18.219
>     20.000     18.809
>     25.000     20.089
>     30.000     20.500
>     35.000     21.008
>     40.000     21.831
>     45.000     23.748
>     50.000     24.220
> ... (550 more lines)

`readme.txt`:

> Data delivered by the operator. Units and null codes are as each file's header or metadata states.

**Answer key:** temperature_most_likely_c = 239.4, heat_in_place_p50_ej = 3.351, mwe_p90 = 28.6, mwe_p50 = 47.53, mwe_p10 = 75.55

**Tolerances:** temperature_most_likely_c: 0.002, heat_in_place_p50_ej: 0.01, mwe_p90: 0.01, mwe_p50: 0.01, mwe_p10: 0.01

### GEO-hip-L3-clean-001

Brief level L3; data defect: clean.

> Geothermal resource assessment for well GT-1 (log file gt1.las). Take the reservoir interval and every input from the current resource report (resource_report_2026.txt); the 2021 assessment is superseded. Reservoir temperature is triangular: most likely = the mean of the measured temperatures inside the reservoir interval, minimum and maximum = the lowest and highest measured temperatures there; do not fill or interpolate gaps. Use the Monte Carlo tool with these inputs. Report temperature_most_likely_c, heat_in_place_p50_ej (exajoules), and the electrical capacity mwe_p90, mwe_p50 and mwe_p10 (MWe; P90 is exceeded with 90% probability).

`gt1.las`:

> ~Version information
>  VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
>  WRAP.   NO  : One line per depth step
> ~Well information
>  STRT.M 0.00 : START DEPTH
>  STOP.M 2800.00 : STOP DEPTH
>  STEP.M 5.0000 : STEP
>  NULL.   -999.25 : NULL VALUE
>  WELL.   GT-1 : WELL
>  FLD .   Synthetic field : FIELD
> ~Curve information
>  DEPT.M : Measured depth
>  TEMP.DEGC : Static formation temperature (stabilised)
> ~A  DEPT  TEMP
>      0.000     14.550
>      5.000     15.817
>     10.000     17.041
>     15.000     17.795
>     20.000     18.245
>     25.000     19.384
>     30.000     19.654
>     35.000     20.021
>     40.000     20.702
>     45.000     22.478
>     50.000     22.809
> ... (550 more lines)

`resource_report_2026.txt`:

> Resource report, 2026 (current). Reservoir: 1400 to 2000 m MD in GT-1. Area triangular (4 sigma bounds) (5.0, 8.0, 16.0) km2; thickness (420.0, 600.0, 720.0) m; porosity (0.04, 0.1, 0.15); recovery factor (0.05, 0.1, 0.2). Constants: rock density 2650 kg/m3, rock heat capacity 1000 J/kg/K, fluid density 830 kg/m3, fluid heat capacity 4600 J/kg/K, reference 15 C, conversion efficiency 0.1, plant life 30 years, capacity factor 0.9.

`assessment_2021.txt`:

> Resource assessment, 2021 (SUPERSEDED). Reservoir 1200 to 1700 m; area (3, 6, 9) km2; recovery factor (0.05, 0.25, 0.30); conversion efficiency 0.15.

`readme.txt`:

> Data delivered by the operator. Units and null codes are as each file's header or metadata states.

**Answer key:** temperature_most_likely_c = 237.1, heat_in_place_p50_ej = 3.317, mwe_p90 = 26.45, mwe_p50 = 44.09, mwe_p10 = 71.63

**Tolerances:** temperature_most_likely_c: 0.002, heat_in_place_p50_ej: 0.01, mwe_p90: 0.01, mwe_p50: 0.01, mwe_p10: 0.01

### GEO-welltest-L2-clean-001

Brief level L2; data defect: clean.

> Interpret the pressure-buildup test on well GT-2 with the Horner method. Buildup in dataset `buildup` after 48 hours of production at 30 L/s. Radial flow from 120 to 1200 minutes of shut-in. Viscosity 0.14 cP, formation volume factor 1.05, net thickness 196.85 ft, porosity 10 percent, total compressibility 8.2737e-06 1/psi, well diameter 8.504 inches, flowing pressure at shut-in 1900.3 psi. Report k_md (permeability, millidarcy), kh_md_m (permeability-thickness, mD m), skin, and p_star_mpa (extrapolated pressure, MPa).

`readme.txt`:

> Data delivered by the operator. Units and null codes are as each file's header or metadata states.

`buildup`: 70 rows, columns dt_h, pws. First rows:

| dt_h | pws |
|---|---|
| 0.01 | 13.13 |
| 0.01134 | 13.14 |
| 0.01287 | 13.14 |
| 0.0146 | 13.15 |
| 0.01656 | 13.16 |

**Answer key:** k_md = 88.75, kh_md_m = 5325, skin = 2.834, p_star_mpa = 14.75

**Tolerances:** k_md: 0.02, kh_md_m: 0.02, skin: exact / see text, p_star_mpa: 0.002

### GEO-hip-L1-clean-002

Brief level L1; data defect: clean.

> Geothermal resource assessment for well GT-1 (log file gt1.las). Reservoir interval 1600 to 2200 m measured depth. Area (km2) triangular (5.0, 8.0, 14.0); thickness (m) (420.0, 600.0, 720.0); porosity (fraction) (0.04, 0.1, 0.15); recovery factor (fraction) (0.05, 0.12, 0.2). Rock density 2650 kg/m3, rock heat capacity 1000 J/kg/K, fluid density 830 kg/m3, fluid heat capacity 4600 J/kg/K, reference temperature 15 C, conversion efficiency 0.12, plant life 30 years, capacity factor 0.9. Reservoir temperature is triangular: most likely = the mean of the measured temperatures inside the reservoir interval, minimum and maximum = the lowest and highest measured temperatures there; do not fill or interpolate gaps. Use the Monte Carlo tool with these inputs. Report temperature_most_likely_c, heat_in_place_p50_ej (exajoules), and the electrical capacity mwe_p90, mwe_p50 and mwe_p10 (MWe; P90 is exceeded with 90% probability).

`gt1.las`:

> ~Version information
>  VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
>  WRAP.   NO  : One line per depth step
> ~Well information
>  STRT.M 0.00 : START DEPTH
>  STOP.M 2800.00 : STOP DEPTH
>  STEP.M 5.0000 : STEP
>  NULL.   -999.25 : NULL VALUE
>  WELL.   GT-1 : WELL
>  FLD .   Synthetic field : FIELD
> ~Curve information
>  DEPT.M : Measured depth
>  TEMP.DEGC : Static formation temperature (stabilised)
> ~A  DEPT  TEMP
>      0.000     14.921
>      5.000     15.960
>     10.000     16.421
>     15.000     16.993
>     20.000     17.330
>     25.000     16.773
>     30.000     19.617
>     35.000     18.681
>     40.000     21.689
>     45.000     21.434
>     50.000     20.648
> ... (550 more lines)

`readme.txt`:

> Data delivered by the operator. Units and null codes are as each file's header or metadata states.

**Answer key:** temperature_most_likely_c = 239.1, heat_in_place_p50_ej = 3.154, mwe_p90 = 32.95, mwe_p50 = 53.64, mwe_p10 = 82.46

**Tolerances:** temperature_most_likely_c: 0.002, heat_in_place_p50_ej: 0.01, mwe_p90: 0.01, mwe_p50: 0.01, mwe_p10: 0.01

### GEO-hip-L3-clean-002

Brief level L3; data defect: clean.

> Geothermal resource assessment for well GT-1 (log file gt1.las). Take the reservoir interval and every input from the current resource report (resource_report_2026.txt); the 2021 assessment is superseded. Reservoir temperature is triangular: most likely = the mean of the measured temperatures inside the reservoir interval, minimum and maximum = the lowest and highest measured temperatures there; do not fill or interpolate gaps. Use the Monte Carlo tool with these inputs. Report temperature_most_likely_c, heat_in_place_p50_ej (exajoules), and the electrical capacity mwe_p90, mwe_p50 and mwe_p10 (MWe; P90 is exceeded with 90% probability).

`gt1.las`:

> ~Version information
>  VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
>  WRAP.   NO  : One line per depth step
> ~Well information
>  STRT.M 0.00 : START DEPTH
>  STOP.M 2800.00 : STOP DEPTH
>  STEP.M 5.0000 : STEP
>  NULL.   -999.25 : NULL VALUE
>  WELL.   GT-1 : WELL
>  FLD .   Synthetic field : FIELD
> ~Curve information
>  DEPT.M : Measured depth
>  TEMP.DEGC : Static formation temperature (stabilised)
> ~A  DEPT  TEMP
>      0.000     14.921
>      5.000     16.276
>     10.000     17.053
>     15.000     17.941
>     20.000     18.594
>     25.000     18.353
>     30.000     21.513
>     35.000     20.893
>     40.000     24.217
>     45.000     24.278
>     50.000     23.808
> ... (550 more lines)

`resource_report_2026.txt`:

> Resource report, 2026 (current). Reservoir: 1200 to 1800 m MD in GT-1. Area triangular (4 sigma bounds) (6.0, 10.0, 14.0) km2; thickness (420.0, 600.0, 720.0) m; porosity (0.04, 0.1, 0.15); recovery factor (0.05, 0.1, 0.2). Constants: rock density 2650 kg/m3, rock heat capacity 1000 J/kg/K, fluid density 830 kg/m3, fluid heat capacity 4600 J/kg/K, reference 15 C, conversion efficiency 0.1, plant life 30 years, capacity factor 0.9.

`assessment_2021.txt`:

> Resource assessment, 2021 (SUPERSEDED). Reservoir 1000 to 1500 m; area (3, 6, 9) km2; recovery factor (0.05, 0.25, 0.30); conversion efficiency 0.15.

`readme.txt`:

> Data delivered by the operator. Units and null codes are as each file's header or metadata states.

**Answer key:** temperature_most_likely_c = 259.2, heat_in_place_p50_ej = 3.882, mwe_p90 = 32.23, mwe_p50 = 51.17, mwe_p10 = 78.19

**Tolerances:** temperature_most_likely_c: 0.002, heat_in_place_p50_ej: 0.01, mwe_p90: 0.01, mwe_p50: 0.01, mwe_p10: 0.01

### GEO-welltest-L2-clean-002

Brief level L2; data defect: clean.

> Interpret the pressure-buildup test on well GT-2 with the Horner method. Buildup in dataset `buildup` after 48 hours of production at 30 L/s. Radial flow from 120 to 1200 minutes of shut-in. Viscosity 0.14 cP, formation volume factor 1.05, net thickness 492.13 ft, porosity 10 percent, total compressibility 8.2737e-06 1/psi, well diameter 8.504 inches, flowing pressure at shut-in 2061.4 psi. Report k_md (permeability, millidarcy), kh_md_m (permeability-thickness, mD m), skin, and p_star_mpa (extrapolated pressure, MPa).

`readme.txt`:

> Data delivered by the operator. Units and null codes are as each file's header or metadata states.

`buildup`: 70 rows, columns dt_h, pws. First rows:

| dt_h | pws |
|---|---|
| 0.01 | 14.27 |
| 0.01134 | 14.27 |
| 0.01287 | 14.28 |
| 0.0146 | 14.29 |
| 0.01656 | 14.3 |

**Answer key:** k_md = 19.73, kh_md_m = 2960, skin = 2.851, p_star_mpa = 17

**Tolerances:** k_md: 0.02, kh_md_m: 0.02, skin: exact / see text, p_star_mpa: 0.002

## Questions

1. Is the method the one a competent practitioner would use for these tasks? What would you do differently?
2. Are the engine and its validation sound? Is anything missing from the validation?
3. Are the answer keys right? Check at least three of the sample tasks below by your own method.
4. Are the tolerances fair: would you accept an answer just inside them, and reject one just outside?
5. Are the data defects realistic? Which common real-world problems are missing?
6. Are the briefs realistic? Is any brief ambiguous, so that two competent people could reasonably disagree?
7. Do the physical checks (no answer key) hold up? Could any of them flag a correct answer?
8. What would make this pack representative of real work in your field?

## Your verdict

Please fill this in. It is published with your name in `earthbench/reviews/geothermal.json` only with your written permission.

```json
{
 "pack": "geothermal",
 "reviewer": "",
 "role_and_organisation": "",
 "years_in_the_field": null,
 "date": "YYYY-MM-DD",
 "tasks_checked_by_own_method": [],
 "verdict": "sound | sound with changes | not sound",
 "findings": [],
 "permission_to_publish_name": false
}
```
