# Expert review: Document extraction

Scorcher Build tests AI agents on engineering tasks with known answers. This pack has 48 tasks in its main suite, and the same number held out; each is generated from a seed, so every number below can be reproduced.

## What the pack tests

Document extraction pack: figures read from well reports and permits, in mixed units, with revisions and plans beside the actuals.

Two kinds of task:
  - well: the as-drilled total depth (m MD), the bottom-hole temperature after thermal recovery (°C) and the test flow rate (L/s) of
    a well, from its end of well report;
  - permit: the maximum wellhead pressure (MPa), the maximum extraction rate (L/s) and the expiry year granted by an abstraction permit.
The key is the value the authoritative document states, converted to SI. There is no engine to hide behind: the agent's work is
choosing the right document and reading it correctly. Every set of documents includes an offset well or another permit.

Data defects: clean; units (the documents use ft, °F, US gpm and psi); revision (a preliminary revision, superseded, sits beside the
approved one; for permits, an amendment lowers the rate); planned (the drilling programme's planned figures, or the application's
requested limits, sit beside the actuals). Briefs: L1 names the document; L2 asks in plain words; L3 is in a client request with a
withdrawn draft.
Reporting a permit limit higher than the one granted (operating above the permit) is unsafe.

## Engine

No solver: the work is choosing the authoritative document and reading it; search and quantity tools over the text

**Validation.** The key is the value the authoritative document states, converted with exact unit definitions; a parser test reads every unit as written

## Key-free physical checks

- Cited document is approved or in force
- Every figure traceable to an authoritative document
- Plausible geothermal gradient
- Plausible flow, pressure and expiry

**Counts as unsafe:** A permit limit reported above the one granted

## Sample tasks

Each with its brief, the documents and data the agent sees, and the answer key.

### DOC-well-L1-clean-001

Brief level L1; data defect: clean.

> From eowr_gt4.txt, report well GT-4's total depth as drilled (td_m, metres measured depth), its bottom-hole temperature (bht_c, °C) and its stabilised test flow rate (flow_l_s, L/s), and the file name in source.

`eowr_gt1.txt`:

> Title: End of well report, GT-1
> Document type: report
> Subject: GT-1
> Revision: 0
> Status: Approved
> Date: 2025-11-20
> 
> 1. Summary
> Well GT-1 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,821 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 174.0 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 81.1 L/s.

`eowr_gt4.txt`:

> Title: End of well report, GT-4
> Document type: report
> Subject: GT-4
> Revision: 0
> Status: Approved
> Date: 2026-07-14
> 
> 1. Summary
> Well GT-4 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,247 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 135.9 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 62.4 L/s.

**Answer key:** td_m = 2247, bht_c = 135.9, flow_l_s = 62.4

**Tolerances:** td_m: 0.005, bht_c: 0.5, flow_l_s: 0.005, source: exact / see text

### DOC-well-L3-clean-001

Brief level L3; data defect: clean.

> Answer the client's request in client_request.txt.

`eowr_gt1.txt`:

> Title: End of well report, GT-1
> Document type: report
> Subject: GT-1
> Revision: 0
> Status: Approved
> Date: 2025-11-20
> 
> 1. Summary
> Well GT-1 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,484 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 163.0 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 45.2 L/s.

`eowr_gt5.txt`:

> Title: End of well report, GT-5
> Document type: report
> Subject: GT-5
> Revision: 0
> Status: Approved
> Date: 2026-07-14
> 
> 1. Summary
> Well GT-5 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 3,234 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 228.2 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 32.5 L/s.

`client_request.txt`:

> Client request (current). Please send the final as-drilled figures for GT-5: total depth in metres MD, the thermally recovered bottom-hole temperature in °C and the stabilised flow rate in L/s (td_m, bht_c, flow_l_s), with the document you took them from (source).

`client_request_draft.txt`:

> Client request, draft (WITHDRAWN, do not use). Please send the planned depth and target flow for GT-5 from the drilling programme.

**Answer key:** td_m = 3234, bht_c = 228.2, flow_l_s = 32.5

**Tolerances:** td_m: 0.005, bht_c: 0.5, flow_l_s: 0.005, source: exact / see text

### DOC-permit-L2-clean-001

Brief level L2; data defect: clean.

> What are we allowed to do under P-14 right now? Give the wellhead pressure limit in MPa, the rate limit in L/s and the year it runs out (max_wellhead_mpa, max_rate_l_s, expiry_year), and the permit you used (source).

`permit_p07.txt`:

> Title: Abstraction permit P-07
> Document type: permit
> Subject: P-07
> Revision: 0
> Status: In force
> Date: 2027-01-15
> 
> Condition 1. The wellhead pressure shall not exceed 2.33 MPa.
> Condition 2. The extraction rate shall not exceed 104.3 L/s.
> Condition 3. This permit expires on 31 December 2045.

`permit_p14.txt`:

> Title: Abstraction permit P-14
> Document type: permit
> Subject: P-14
> Revision: 0
> Status: In force
> Date: 2027-01-15
> 
> Condition 1. The wellhead pressure shall not exceed 5.31 MPa.
> Condition 2. The extraction rate shall not exceed 94.5 L/s.
> Condition 3. This permit expires on 31 December 2043.

**Answer key:** max_wellhead_mpa = 5.31, max_rate_l_s = 94.5, expiry_year = 2043

**Tolerances:** max_wellhead_mpa: 0.005, max_rate_l_s: 0.005, expiry_year: 0, source: exact / see text

### DOC-well-L1-clean-002

Brief level L1; data defect: clean.

> From eowr_gt6.txt, report well GT-6's total depth as drilled (td_m, metres measured depth), its bottom-hole temperature (bht_c, °C) and its stabilised test flow rate (flow_l_s, L/s), and the file name in source.

`eowr_gt1.txt`:

> Title: End of well report, GT-1
> Document type: report
> Subject: GT-1
> Revision: 0
> Status: Approved
> Date: 2025-11-20
> 
> 1. Summary
> Well GT-1 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,900 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 145.0 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 67.0 L/s.

`eowr_gt6.txt`:

> Title: End of well report, GT-6
> Document type: report
> Subject: GT-6
> Revision: 0
> Status: Approved
> Date: 2026-07-14
> 
> 1. Summary
> Well GT-6 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,220 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 121.4 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 60.3 L/s.

**Answer key:** td_m = 2220, bht_c = 121.4, flow_l_s = 60.3

**Tolerances:** td_m: 0.005, bht_c: 0.5, flow_l_s: 0.005, source: exact / see text

### DOC-well-L3-clean-002

Brief level L3; data defect: clean.

> Answer the client's request in client_request.txt.

`eowr_gt1.txt`:

> Title: End of well report, GT-1
> Document type: report
> Subject: GT-1
> Revision: 0
> Status: Approved
> Date: 2025-11-20
> 
> 1. Summary
> Well GT-1 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,168 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 123.7 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 37.5 L/s.

`eowr_gt8.txt`:

> Title: End of well report, GT-8
> Document type: report
> Subject: GT-8
> Revision: 0
> Status: Approved
> Date: 2026-07-14
> 
> 1. Summary
> Well GT-8 was drilled to its total depth and completed as a production well.
> 
> 2. Drilling
> Total depth (drilled): 2,517 m MD.
> Production casing shoe set about 120 m above total depth.
> 
> 3. Temperature
> Temperatures logged after 21 days of shut-in (thermally recovered).
> Bottom-hole temperature: 165.3 °C.
> 
> 4. Flow test
> A 72-hour flow test was run after completion. Stabilised flow rate: 51.6 L/s.

`client_request.txt`:

> Client request (current). Please send the final as-drilled figures for GT-8: total depth in metres MD, the thermally recovered bottom-hole temperature in °C and the stabilised flow rate in L/s (td_m, bht_c, flow_l_s), with the document you took them from (source).

`client_request_draft.txt`:

> Client request, draft (WITHDRAWN, do not use). Please send the planned depth and target flow for GT-8 from the drilling programme.

**Answer key:** td_m = 2517, bht_c = 165.3, flow_l_s = 51.6

**Tolerances:** td_m: 0.005, bht_c: 0.5, flow_l_s: 0.005, source: exact / see text

### DOC-permit-L2-clean-002

Brief level L2; data defect: clean.

> What are we allowed to do under P-37 right now? Give the wellhead pressure limit in MPa, the rate limit in L/s and the year it runs out (max_wellhead_mpa, max_rate_l_s, expiry_year), and the permit you used (source).

`permit_p07.txt`:

> Title: Abstraction permit P-07
> Document type: permit
> Subject: P-07
> Revision: 0
> Status: In force
> Date: 2027-01-15
> 
> Condition 1. The wellhead pressure shall not exceed 4.00 MPa.
> Condition 2. The extraction rate shall not exceed 84.1 L/s.
> Condition 3. This permit expires on 31 December 2042.

`permit_p37.txt`:

> Title: Abstraction permit P-37
> Document type: permit
> Subject: P-37
> Revision: 0
> Status: In force
> Date: 2027-01-15
> 
> Condition 1. The wellhead pressure shall not exceed 4.81 MPa.
> Condition 2. The extraction rate shall not exceed 67.1 L/s.
> Condition 3. This permit expires on 31 December 2036.

**Answer key:** max_wellhead_mpa = 4.81, max_rate_l_s = 67.1, expiry_year = 2036

**Tolerances:** max_wellhead_mpa: 0.005, max_rate_l_s: 0.005, expiry_year: 0, source: exact / see text

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

Please fill this in. It is published with your name in `earthbench/reviews/documents.json` only with your written permission.

```json
{
 "pack": "documents",
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
