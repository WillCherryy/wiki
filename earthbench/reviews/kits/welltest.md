# Expert review: Well tests

Scorcher Build tests AI agents on engineering tasks with known answers. This pack has 24 tasks in its main suite, and the same number held out; each is generated from a seed, so every number below can be reproduced.

## What the pack tests

Geothermal well tests, advanced: pressure buildups with wellbore storage, skin and sometimes a sealing fault.

The data come from the engine in welltest_engine.py (the exact Laplace-space solution, inverted numerically, plus an image well for
the fault), with gauge noise and resolution. The agent must do what a well-test analyst does:
  - plot the Bourdet derivative and find the radial-flow period: after the wellbore-storage hump, before any boundary;
  - fit the semilog (Horner) line in that window only, and turn its slope into permeability and its intercept into skin;
  - say whether a sealing boundary is seen (the derivative doubles late in the test).
A semilog line through the storage period or through the boundary period gives the wrong permeability, often by a factor of two or
more. The key is the permeability and skin the data were generated with. The window is graded too, by one rule at both ends: it must lie
where the derivative is within 10 % of radial flow (after storage has faded to 10 %, before the fault adds 10 %), with 25 % slack in
time for sampling. Tolerances: k within 10 %, skin within 0.75.

Data defects: clean; units (pressure in psi, time in minutes); nulls (dropouts coded -999.25, declared in the table); mass_rate
(the rate is reported in t/h, with the reservoir fluid density in the brief). Briefs: L1 SI; L2 field and mixed units; L3 in a
test report with a superseded preliminary revision that gives a shorter flowing time.

## Engine

Exact radial-flow solution with wellbore storage and skin (Laplace space, Stehfest inversion), an image well for a sealing fault, buildup by superposition; Bourdet derivative

**Validation.** Matches the line-source log approximation, the storage unit slope, skin adding exactly S and a fault doubling the derivative; Horner in the radial window recovers k within 0.5 % and skin within 0.05; an analyst reading only the derivative passes every task

## Key-free physical checks

- Window flat on the derivative
- Permeability matches the data's slope in the window
- Fault claim matches the derivative's late rise
- Skin physically attainable

**Counts as unsafe:** Policy breaches (restricted files, leaked secrets)

## Sample tasks

Each with its brief, the documents and data the agent sees, and the answer key.

### WT-buildup-L1-clean-001

Brief level L1; data defect: clean.

> Interpret the buildup test of well GT-2 in table `buildup`. The well flowed at a constant 0.04932 m3/s at reservoir conditions for 388.1 hours, then was shut in; flowing bottom-hole pressure at shut-in 18.4306 MPa. Reservoir: net thickness 177.2 m, porosity 0.149, viscosity 1.832e-04 Pa s, total compressibility 1.719e-09 1/Pa, well radius 0.108 m. Report k_md (permeability, mD), skin, fault_seen (true if a sealing boundary shows in the data), and the shut-in time window you fitted the semilog line over, dt_from_h and dt_to_h (hours since shut-in).

`readme.txt`:

> Buildup test export, table `buildup`: dt_h (time since shut-in, h) and pws_pa (bottom-hole pressure, Pa).

`buildup`: 160 rows, columns dt_h, pws_pa. First rows:

| dt_h | pws_pa |
|---|---|
| 0.002 | 1.856e+07 |
| 0.002159 | 1.856e+07 |
| 0.002331 | 1.857e+07 |
| 0.002517 | 1.857e+07 |
| 0.002717 | 1.858e+07 |

**Answer key:** k_md = 154.1, skin = -0.52, fault_seen = True, radial_from_h = 0.04843, radial_to_h = 21.07

**Tolerances:** k_md: 0.1, skin: 0.75, fault_seen: exact / see text, dt_from_h: exact / see text, dt_to_h: exact / see text

### WT-buildup-L2-clean-001

Brief level L2; data defect: clean.

> Interpret the buildup test of well GT-2 in table `buildup`. The well flowed at a constant 254.29 m3/h at reservoir conditions for 124.0 hours, then was shut in; flowing bottom-hole pressure at shut-in 2588.19 psi. Reservoir: net thickness 602 ft, porosity 5.8 %, viscosity 0.159 cP, total compressibility 6.144e-06 1/psi, well radius 4.25 in. Report k_md (permeability, mD), skin, fault_seen (true if a sealing boundary shows in the data), and the shut-in time window you fitted the semilog line over, dt_from_h and dt_to_h (hours since shut-in).

`readme.txt`:

> Buildup test export, table `buildup`: dt_h (time since shut-in, h) and pws_pa (bottom-hole pressure, Pa).

`buildup`: 160 rows, columns dt_h, pws_pa. First rows:

| dt_h | pws_pa |
|---|---|
| 0.002 | 1.804e+07 |
| 0.002144 | 1.805e+07 |
| 0.002298 | 1.806e+07 |
| 0.002463 | 1.807e+07 |
| 0.00264 | 1.807e+07 |

**Answer key:** k_md = 229.8, skin = 2.93, fault_seen = False, radial_from_h = 0.06502, radial_to_h = 124

**Tolerances:** k_md: 0.1, skin: 0.75, fault_seen: exact / see text, dt_from_h: exact / see text, dt_to_h: exact / see text

### WT-buildup-L3-clean-001

Brief level L3; data defect: clean.

> Interpret the buildup test of well GT-2 described in the test report. Report k_md (permeability, mD), skin, fault_seen (true if a sealing boundary shows in the data), and the shut-in time window you fitted the semilog line over, dt_from_h and dt_to_h (hours since shut-in).

`readme.txt`:

> Buildup test export, table `buildup`: dt_h (time since shut-in, h) and pws_pa (bottom-hole pressure, Pa).

`test_report_rev2.txt`:

> Well test report GT-2, revision 2 (approved; supersedes revision 1). The well flowed at a constant 0.07066 m3/s at reservoir conditions for 387.2 hours, then was shut in; flowing bottom-hole pressure at shut-in 15.4796 MPa. Reservoir: net thickness 238.9 m, porosity 0.058, viscosity 2.033e-04 Pa s, total compressibility 5.481e-10 1/Pa, well radius 0.108 m.

`test_report_rev1.txt`:

> Well test report GT-2, revision 1 (PRELIMINARY, superseded by revision 2). Flowing time 193.6 hours (field log not yet reconciled). Rate and reservoir data as revision 2.

`buildup`: 160 rows, columns dt_h, pws_pa. First rows:

| dt_h | pws_pa |
|---|---|
| 0.002 | 1.596e+07 |
| 0.002159 | 1.598e+07 |
| 0.002331 | 1.6e+07 |
| 0.002516 | 1.602e+07 |
| 0.002717 | 1.604e+07 |

**Answer key:** k_md = 106.9, skin = 3.57, fault_seen = True, radial_from_h = 0.05318, radial_to_h = 21.02

**Tolerances:** k_md: 0.1, skin: 0.75, fault_seen: exact / see text, dt_from_h: exact / see text, dt_to_h: exact / see text

### WT-buildup-L1-clean-002

Brief level L1; data defect: clean.

> Interpret the buildup test of well GT-2 in table `buildup`. The well flowed at a constant 0.07442 m3/s at reservoir conditions for 271.3 hours, then was shut in; flowing bottom-hole pressure at shut-in 22.0085 MPa. Reservoir: net thickness 222.4 m, porosity 0.115, viscosity 1.661e-04 Pa s, total compressibility 6.866e-10 1/Pa, well radius 0.108 m. Report k_md (permeability, mD), skin, fault_seen (true if a sealing boundary shows in the data), and the shut-in time window you fitted the semilog line over, dt_from_h and dt_to_h (hours since shut-in).

`readme.txt`:

> Buildup test export, table `buildup`: dt_h (time since shut-in, h) and pws_pa (bottom-hole pressure, Pa).

`buildup`: 160 rows, columns dt_h, pws_pa. First rows:

| dt_h | pws_pa |
|---|---|
| 0.002 | 2.221e+07 |
| 0.002154 | 2.222e+07 |
| 0.002321 | 2.224e+07 |
| 0.0025 | 2.225e+07 |
| 0.002692 | 2.227e+07 |

**Answer key:** k_md = 80.65, skin = 0.79, fault_seen = False, radial_from_h = 0.139, radial_to_h = 271.3

**Tolerances:** k_md: 0.1, skin: 0.75, fault_seen: exact / see text, dt_from_h: exact / see text, dt_to_h: exact / see text

### WT-buildup-L2-clean-002

Brief level L2; data defect: clean.

> Interpret the buildup test of well GT-2 in table `buildup`. The well flowed at a constant 283.23 m3/h at reservoir conditions for 229.0 hours, then was shut in; flowing bottom-hole pressure at shut-in 2426.58 psi. Reservoir: net thickness 525 ft, porosity 18.9 %, viscosity 0.153 cP, total compressibility 4.877e-06 1/psi, well radius 4.25 in. Report k_md (permeability, mD), skin, fault_seen (true if a sealing boundary shows in the data), and the shut-in time window you fitted the semilog line over, dt_from_h and dt_to_h (hours since shut-in).

`readme.txt`:

> Buildup test export, table `buildup`: dt_h (time since shut-in, h) and pws_pa (bottom-hole pressure, Pa).

`buildup`: 160 rows, columns dt_h, pws_pa. First rows:

| dt_h | pws_pa |
|---|---|
| 0.002 | 1.689e+07 |
| 0.002152 | 1.69e+07 |
| 0.002316 | 1.69e+07 |
| 0.002492 | 1.691e+07 |
| 0.002681 | 1.691e+07 |

**Answer key:** k_md = 230.6, skin = -0.83, fault_seen = True, radial_from_h = 0.02939, radial_to_h = 12.43

**Tolerances:** k_md: 0.1, skin: 0.75, fault_seen: exact / see text, dt_from_h: exact / see text, dt_to_h: exact / see text

### WT-buildup-L3-clean-002

Brief level L3; data defect: clean.

> Interpret the buildup test of well GT-2 described in the test report. Report k_md (permeability, mD), skin, fault_seen (true if a sealing boundary shows in the data), and the shut-in time window you fitted the semilog line over, dt_from_h and dt_to_h (hours since shut-in).

`readme.txt`:

> Buildup test export, table `buildup`: dt_h (time since shut-in, h) and pws_pa (bottom-hole pressure, Pa).

`test_report_rev2.txt`:

> Well test report GT-2, revision 2 (approved; supersedes revision 1). The well flowed at a constant 0.06648 m3/s at reservoir conditions for 73.1 hours, then was shut in; flowing bottom-hole pressure at shut-in 16.0470 MPa. Reservoir: net thickness 113.2 m, porosity 0.112, viscosity 2.128e-04 Pa s, total compressibility 1.207e-09 1/Pa, well radius 0.108 m.

`test_report_rev1.txt`:

> Well test report GT-2, revision 1 (PRELIMINARY, superseded by revision 2). Flowing time 36.6 hours (field log not yet reconciled). Rate and reservoir data as revision 2.

`buildup`: 160 rows, columns dt_h, pws_pa. First rows:

| dt_h | pws_pa |
|---|---|
| 0.002 | 1.627e+07 |
| 0.002137 | 1.628e+07 |
| 0.002283 | 1.629e+07 |
| 0.002439 | 1.629e+07 |
| 0.002605 | 1.63e+07 |

**Answer key:** k_md = 244, skin = -0.95, fault_seen = False, radial_from_h = 0.03416, radial_to_h = 73.13

**Tolerances:** k_md: 0.1, skin: 0.75, fault_seen: exact / see text, dt_from_h: exact / see text, dt_to_h: exact / see text

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

Please fill this in. It is published with your name in `earthbench/reviews/welltest.json` only with your written permission.

```json
{
 "pack": "welltest",
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
