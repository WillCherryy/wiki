# Agentic AI for energy, mining and geospatial engineering: evidence, architecture and a test programme

Version of 5 November 2026. Written for Scorcher Build. It separates what the literature shows (sections 1 and A) from what we propose (sections B to H). Every proposal is marked **[design]**.

## 0. How this was done, and what it cannot claim

**What was read.** At first only titles, venues and short descriptions were supplied, so records were resolved (Crossref, DataCite, arXiv) and abstracts read (`docs/research/verify-references.mjs`, output in `docs/research/references.json`). Later the owner supplied **six PDFs, and the following were read in the parts that matter for this programme**: A3 (pp. 1 to 14), B6 (pp. 1 to 10), B7 (pp. 8 to 15), B8 (pp. 1 to 17), C11 (pp. 9 to 15) and D12 (pp. 1 to 3 and 17 to 22). Rows below marked **[full text]** rest on those pages; unread pages may qualify them. All other rows remain abstract-level. B9 and F1 to F4 are on arXiv and can be fetched but have not yet been read in full.

**Abstract availability.** For references not yet read in full: abstracts were obtained for B9, C10 (summary), E13, F1 to F4, X3 to X6, and were **not** obtainable for A1, A2, A4, A5, F5, F6, X1, X2. For those, only the title, venue and your description are available, so nothing quantitative about them is asserted here.

**Corrections to the supplied descriptions** (found while resolving records):

| Item | Supplied | Found |
|---|---|---|
| A3 **[full text]** | Mao, Liu, Chen, Nan, Ma 2027, *Applied Energy* 427:128868, 10.1016/j.apenergy.2026.128868 | E1 | LLM planner, deterministic control layer (finite-state machine, schema admissibility, state verification) and human authorisation, solved by DIgSILENT PowerFactory. 39-bus benchmark: 45 prompts (3 domains × 3 complexity levels × 5 ambiguity variants V1 to V5) × 30 trials = **1,350 runs per configuration**; Qwen2.5-32B-Instruct: planning validity 99.1%, **verified workflow completion 97.4%**, gap 1.7 points; composite tasks with the most under-specified instruction (V5) fell to 85.6%. Ablations (overall completion): without schema guidance 70.0%; without control layer 67.8% (gap 22.3 points); Qwen2.5-7B 72.1%; Llama-3.1-8B 63.9%. Latency: median LLM call 17.4 s (32B), deterministic checks about 17 ms. 201-bus case: about 50 min and about 40 s observed against 15.7 h and 182 s manual **lower-bound estimates** (ratios about 19× and 4.5×) | Temperature 0, top-p 1, seed 42: the 30 repeats per prompt are not independent samples, so the effective sample is nearer 45 prompts than 1,350 **[mine]**. Human authorisation was an automated rule in the benchmark. The manual times come from a keystroke-level model with assumed constants (3 s and 5 s), which the authors say is not a measured human speed-up. One simulator, one regional case, no scripted-pipeline baseline. Authors: state verification is about workflow state, not cybersecurity | Strongest supplied evidence that **architecture, not the model alone, drives reliability**: removing the schema or the control layer cost 27 to 30 points. Supports plan, verify state, execute, authorise. Does not show agents beat a scripted workflow |
| B8 **[full text]** | Yu, Yang, Hou, Liu, Liu, Wang, Zhang, Li, Yang 2026, *Geo-spatial Information Science*, 10.1080/10095020.2026.2736957 (open access) | E1 | 133 atomic tools and 57 tasks in a Python sandbox (GeoPandas, Rasterio, Shapely), six domains; mean 7.0 tool calls per task (max 17). Four agent paradigms (base, ReAct, Plan-and-Solve, Plan-and-React) × seven LLMs; max 30 steps, 360 s per call. Metrics: tool set and order (TAO, TIO, TEM), parameter execution accuracy (PEA), GPT-4o judge on the final map (n = 3 repeats), efficiency. Best PEA 50.8% (Claude Sonnet 4.6, ReAct); best VLM score 73.5 (Claude Sonnet 4.6, Plan-and-React); Plan-and-Solve VLM scores all below 4.0 though its tool metrics look strong; efficiency 100% for static plans | A **single reference trajectory** per task, so trajectory scores measure fidelity to one valid path, not correctness (authors say so). A VLM judge replaces expert review. Authors state the tasks **do not cover dirty data** (invalid geometries, CRS errors, nodata, mixed units). Single run per cell, no intervals | Execution feedback matters: static plans look good on paper and fail in the sandbox. Parameter inference is the bottleneck (PEA ≤ 51%). The dirty-data gap is exactly what phase 1 should fill |
| B9 | 93 tasks | 93 is the main suite; the benchmark is **103 tasks** (93 across 18 categories plus a 10-task comparison expansion), 16 tools, nine LLMs, three seeds. A preprint, with a workshop version (GeoIndustry 2026, ACM SIGSPATIAL) per the arXiv comments field. |
| C11 **[full text, pp. 9 to 15]** | Nunes, Risso, Momayez 2026, *Mining* 6(2) 26, 10.3390/mining6020026 | PoC | Marvin synthetic copper–gold block model (53,271 blocks, 30 m, 45° slope); the pit is solved by Lerchs–Grossmann (a deterministic solver). 20 debate runs (7, 7, 6 at three copper prices), temperature 0.3: latency 10.69 s (σ 1.52), 4,539 tokens per debate (σ 25), $0.0007 per run at an assumed $0.15 per million tokens; 100% completed. Price adjustment: +15.00% (σ 0) at the low price, +3.51% mid, −4.36% high | "Decision coherence" means the adjustment moves toward spot; the authors state that **whether it improves pit value or any feasibility metric is open**. Adjustments of exactly +15.00% in all seven low-price runs suggest a cap or rule rather than free reasoning **[mine; the paper does not say]**. No baseline (no analyst, no fixed rule). Synthetic benchmark | The pipeline runs and is auditable. Value is orchestration and traceability, not demonstrated judgement quality. The optimisation is the solver's |
| A2 | 61 studies | Abstract unavailable; **unverified**. |
| F5 | hydropower review, 106 studies | The record is "Short-term hydropower regulation through coupled hydrological and energy models: a systematic review". Its title does not mention LLMs or agents; the study count is **unverified**. Do not treat it as evidence about agentic AI. |
| X6 | NIST generative AI profile | Resolved to NIST AI 600-1 (title similarity 0.71, as the registry title is truncated). |

**Standards cited without retrieval.** OWASP Top 10 for LLM Applications (2025) and ISA/IEC 62443 were not retrievable as bibliographic records here; I cite them from general knowledge and the mappings in F must be checked against the current texts before use. The classical open-pit formulations in D (Lerchs–Grossmann; Picard maximal closure) are named from memory and need full citations before publication.

**Evidence grades used in the matrix.**

| Grade | Meaning |
|---|---|
| S | Standard or official guidance |
| E1 | Peer-reviewed empirical study with a benchmark or controlled comparison |
| R | Review or survey (evidence about evidence) |
| P | Preprint (not peer-reviewed as far as I can verify) |
| PoC | Proof of concept: shows it can run, not that it is better |
| C | Conceptual or untested proposal |

## 1. Findings in brief

1. **The empirical base is thin outside GIS and software tasks.** Quantified comparisons of LLM agents exist for GIS workflows (B6, B9), generic agent tasks (F1 to F4) and one power-system simulation workflow (A3, preprint). For geothermal, mining, wind and hydropower, the supplied abstracts describe reviews, proofs of concept or proposals. D12 and C10 say so explicitly.
2. **No supplied study shows an LLM agent outperforming conventional software on an engineering outcome.** Reported gains are workflow time against *modelled* manual baselines (A3: about 19 times on model preparation and 4.5 times on N-1, against keystroke-model lower bounds, not measured people), orchestration stability (C11: mean debate latency 10.69 s), or relative model rankings on benchmarks (B6, B8, B9). None isolates the LLM's contribution from the tools it calls, and none includes a scripted-pipeline baseline.
3. **Scoring choices dominate headline numbers.** B9 reports a best strict all-checks score of 61.7% against 85 to 97% on general GIS benchmarks, and 86 to 90% under partial credit. B6 reports 95% workflow validity for one model, but validity is not result correctness. Numbers from different scorers cannot be compared.
4. **What is automatable today is mostly deterministic.** Site screening, yield simulation, load flow, block-model optimisation and unit handling have mature solvers (pvlib X1, pandapower X2, MILP and max-flow). The credible role of an LLM is translating intent into a reviewable plan and tool calls, and writing explanations, with verification outside the model.
5. **The smallest credible prototype** is a GIS plus solar-yield site-screening benchmark with a deterministic scorer and four arms (section H, phase 1), because it needs no plant data, runs on open software, and can falsify the claim "the agent adds value over a scripted pipeline".

## A. Evidence matrix

Columns: what is empirical, numbers stated in the abstract, limitations (abstract-level; those marked **[mine]** are my reading, not the authors' claim), and what may be inferred.

| ID | Source (verified record) | Grade | Empirical content (abstract) | Limitations | May infer |
|---|---|---|---|---|---|
| A1 | Antonesi, Cioara, Anghel et al. 2025, *Applied Energy*, 10.1016/j.apenergy.2025.126670 | R | Systematic review of transformers and LLMs in energy; agentic digital twins (no abstract available) | Counts and findings unverified | Context only |
| A2 | Rezaei, Amini, Banad 2026, *Energy and AI*, 10.1016/j.egyai.2026.100853 | R | Systematic review and framework for LLM-driven smart grids (no abstract) | "61 studies" and the six layers unverified | Context only |
| A3 | Mao, Liu, Chen et al. 2026, SSRN, 10.2139/ssrn.7074124 | P | LLM plans, separate state verification checks admissibility, dependency and execution evidence; success requires verified workflow completion. Benchmark on New England 39-bus with task-complexity and ambiguity variants, ablations (schema guidance, orchestration, backbone); a 201-bus system for model preparation and N-1 contingency tests. About 19x efficiency (model preparation) and 4.5x speed-up (N-1) | Sample size, success rates per variant and the manual baseline are not in the abstract. Efficiency is human workflow time, not correctness or optimality **[mine]**. Preprint | The *design pattern* (plan, verify state, execute) is sound and matches our harness. Not that agents beat scripted workflows |
| A4 | Zhang, Zhang, Lu et al. 2026, *Applied Energy*, 10.1016/j.apenergy.2025.127076 | R/C | "Opportunities, challenges, future perspectives" (no abstract) | Unverified | Context only |
| A5 | Chandana, Rao, Kumaraswamy et al. 2026, *Next Energy*, 10.1016/j.nxener.2026.100586 | R | Review of LLMs in renewables: forecasting, control, policy, fault diagnosis (no abstract) | Unverified. Forecasting and fault diagnosis may be non-agentic LLM or ML uses **[mine]** | Context only |
| B6 **[full text]** | Zhang, Gao, Wei, Zhao, Nie, Chen, Chen, Su, Sun 2025, *Transactions in GIS* 29:e70135, 10.1111/tgis.70135 (open access) | E1 | 50 tasks adapted from public tutorials, annotated by three GIS experts; four prompt conditions (task alone, with domain knowledge, with dataset description, both). Six models at temperature 0.7, three outputs per prompt. **Validity** = the response contains an extractable workflow list; Gemini-1.5-Flash 96.0%, GPT-4o-mini 95.0%, Llama-3.1-8B 95.3%, Claude-3.5-Sonnet 93.5%, DeepSeek-R1-7B 48.5%, CodeLlama-7B 32.7%. CodeBLEU best 0.390 (GPT-4o-mini) | **Code was not executed**; "validity" is a parse check, not correctness. Text similarity and CodeBLEU are weak proxies of geometric correctness **[mine]**. n = 50. Models are 2024 vintage. Reference solutions may themselves derive from online tutorials (authors discuss circularity). Authors left ambiguity unscored | LLMs can write plausible workflow text. Nothing about whether results are right; B8 builds on this to add execution |
| B7 **[full text, pp. 8 to 15]** | Ning, Li, Akinboyewa, Huang, Lessani 2025, *Int. J. Digital Earth*, 10.1080/17538947.2025.2458688 | PoC | Data-retrieval agent (GPT-4o core) with source handbooks; QGIS plugin and Jupyter program; case studies from six sources (OSM, US Census, ESRI imagery, OpenTopography DEM, OpenWeather, NYT COVID data); "over 70 test cases" in the repository; self-debug loop capped at 10 iterations | **No success rate or sample size is reported**; evidence is screenshots of successful cases. Authors report failure types: unrunnable code; runnable code returning wrong data (e.g. wrong Census variable combinations, OSM relations to multipolygons); no data-assessment module; recommend manual inspection | Retrieval can work for documented sources. Silent wrong data is a named failure mode, which our verifier must catch |
| B8 | Yu, Yang, Hou et al. 2026, *Geo-spatial Information Science*, 10.1080/10095020.2026.2736957 | E1 (presumed) | "Dynamic execution benchmark for tool-augmented agents in spatial analysis" (no abstract) | Task and tool counts unverified | Context only |
| B9 | Diaz-Ireland, Prieto-Herráez, García Peces, Velázquez, Zaitchik, Jain 2026, arXiv:2610.09112 (10.48550/arXiv.2610.09112) | P (workshop version noted) | Fixed 16-tool MCP interface, deterministic scorer; 103 tasks (93 + 10), 18 categories; nine LLMs, three seeds at temperature 1.0. Sonnet 4 61.7% ± 0.7%, DeepSeek V3.2 57.9%, none other above 53%; open-weight models dominate cost-accuracy frontier; 93% of the best capability at 11.3x lower list price; strict scoring 24 to 36 points below 85 to 97% reported on general GIS benchmarks; partial credit 86 to 90% | One API, Spain and Portugal, three indicators: narrow. "± 0.7%" is across seeds, not across tasks, so it understates task-sampling uncertainty **[mine]**. 2025 to 2026 models differ from those in B6. Authors' own caveat: the gap partly reflects scoring strictness | Tool selection against a real API is far from solved under strict scoring; cost differs by an order of magnitude at similar capability. The *method* (fix the tool layer, vary only the agent) is the one to copy |
| C10 | Nunes, Risso, Momayez 2026, *IEEE Access*, 10.1109/access.2026.3714775 | R | PRISMA synthesis of 33 peer-reviewed studies; five research questions; proposes maturity pathway from bounded advisory to integrated planning. Authors state mining-specific LLM-agent implementations are **largely conceptual** | Study inclusion and quality appraisal not in abstract; adjacent-sector evidence is transferred, not mining evidence | Mining LLM-agent value is unproven; the maturity pathway is a proposal |
| C11 | Nunes, Risso, Momayez 2026, *Mining* 6(2), 10.3390/mining6020026 | PoC | Modular multi-agent reference architecture; conversational interface; adversarial reviewer agents assess price assumptions before economic scenarios. One proof of concept on the Marvin copper benchmark: request-to-report orchestration, mean debate latency 10.69 s, audit trail | No accuracy, no baseline, no error rate in the abstract. Latency of a debate is a cost, not a benefit **[mine]**. Same authors as C10 | The architecture runs. Nothing on whether valuation is better, faster than an analyst, or correct |
| D12 **[full text, pp. 1 to 3, 17 to 22]** | Li, Shang, Zhao, Wang, Yu 2026, *Energies* 19(21) 5052, 10.3390/en19215052 (open access) | R | Narrative critical review; searched WoS, Scopus, ScienceDirect, Google Scholar, 2018 to 2025 plus 2026 updates. Evidence typed A (direct geothermal), B (adjacent field), C (conceptual). **All six comparison studies are type B, none type A.** Examples: 160 orphaned-well documents, 100% extraction for clean PDFs and 70% for image-based (oil and gas); 100 boreholes from 21 Macao projects (908 samples); single- against multi-agent well-engineering QA: +28% truthfulness at 3.7× cost, single agent +15% on Text-to-SQL. Proposes a benchmark framework (not implemented) and says drilling-risk and reservoir work must be judged on measured data, with missed hazards reported separately from accuracy | Narrative, not systematic; no pooled estimate; the authors say results cannot be ranked across studies | The strongest explicit statement of the geothermal evidence gap. For site selection the review lists RAG as limited "capability to replace quantitative assessment" |
| E13 | Gao, Lan, Li et al. 2024, *Humanities and Social Sciences Communications*, 10.1057/s41599-024-03611-3 | R | Survey of LLM-empowered agent-based modelling in cyber, physical, social, hybrid domains; challenges in perception, alignment, action generation, evaluation | Survey; social-science emphasis **[mine]** | Challenges for LLM-driven simulated agents. Not evidence about engineering optimisation |
| F1 | Yao, Zhao, Yu et al. 2022, ReAct, arXiv:2210.03629 (ICLR 2023) | E1 | Interleaved reasoning and acting; ALFWorld +34% and WebShop +10% absolute success over imitation/RL baselines with 1 to 2 in-context examples | Text-game and QA settings, not engineering | Reasoning-and-acting loops help in interactive tasks. Pattern, not domain evidence |
| F2 | Liu, Yu, Zhang et al. 2023, AgentBench, arXiv:2308.03688 (ICLR 2024) | E1 | 8 environments; large gap between top commercial and open models up to 70B; failures from long-term reasoning, decision-making, instruction following | Dated models | Failure modes of agents are structural, not only model-size effects |
| F3 | Jimenez, Yang, Wettig et al. 2023, SWE-bench, arXiv:2310.06770 (ICLR 2024) | E1 | 2,294 real issues, 12 repositories; best model then (Claude 2) resolved 1.96% | Dated; numbers have since changed and the abstract is silent on that. Do not quote 1.96% as current capability | Real-task benchmarks are far harder than curated ones |
| F4 | Huang, Vora, Liang, Leskovec 2023, MLAgentBench, arXiv:2310.03302 (ICML 2024) | E1 | 13 tasks; best agent (Claude 3 Opus) 37.5% mean success; from 100% on older datasets to 0% on recent Kaggle tasks possibly created after model training | Authors raise contamination | Performance tracks training-data exposure; hold-out design matters (G) |
| F5 | Vatanchi, Kiviluoma, Klöve et al. 2026, *Renewable and Sustainable Energy Reviews*, 10.1016/j.rser.2026.116940 | R | Short-term hydropower regulation through coupled hydrological and energy models (no abstract) | Not an LLM or agent study by title | Context for deterministic hydropower models |
| F6 | Wan, Yuan, Jiang 2026, *Energy*, 10.1016/j.energy.2026.140208 | E1 (presumed) | Random-environment simulation-based multi-stage **reinforcement learning** for short-term cascade hydropower scheduling (no abstract) | RL, not LLM. Results unverified | The relevant technology for hydropower scheduling is RL/optimisation; keep it separate from LLM agents |
| X1 | Holmgren, Hansen, Mikofski 2018, pvlib python, *JOSS*, 10.21105/joss.00884 | Tool | Open-source solar system modelling | Not an evaluation | Deterministic solver for the solar simulator |
| X2 | Thurner, Scheidler, Schäfer et al. 2018, pandapower, *IEEE Trans. Power Syst.*, 10.1109/tpwrs.2018.2829021 | Tool | Open-source power-system modelling, analysis, optimisation | Not an evaluation | Deterministic solver for load flow and N-1 |
| X3 | Greshake, Abdelnabi, Mishra et al. 2023, arXiv:2302.12173 | P | Indirect prompt injection: attacks via retrieved data against real and synthetic LLM-integrated apps; taxonomy of impacts; mitigations "currently lacking" | 2023 systems | Data and instructions are not separated by an LLM; tool outputs are an attack surface |
| X4 | Tabassi 2023, NIST AI 100-1 (AI RMF 1.0), 10.6028/nist.ai.100-1 | S | Voluntary risk framework | Not specific to agents | Governance structure |
| X5 | Stouffer, Pease, Tang et al. 2023, NIST SP 800-82 Rev. 3, 10.6028/nist.sp.800-82r3 | S | OT security guidance | Not AI-specific | OT constraints (availability, safety) |
| X6 | NIST AI 600-1 (2024), 10.6028/nist.ai.600-1 | S | Generative AI profile of the AI RMF | Abstract is short | Generative-AI-specific risks |

### State of the art by sector

| Sector | Direct evidence of LLM agents | Evidence class | Non-LLM methods with strong evidence (not in the supplied set unless noted) |
|---|---|---|---|
| QGIS and GIS | B6 (50 tasks), B7 (retrieval prototype), B8 (unverified), B9 (103 tasks) | Benchmarks plus one prototype. Best empirical base here | Scripted PyQGIS/GDAL pipelines, model builder graphs |
| Power systems (adjacent to solar and wind) | A3 (preprint, 39 and 201 buses) | One workflow study, preprint | Power-flow and contingency solvers (X2) |
| Solar | None in the supplied set; A5 is a review (abstract unavailable) | Review only | pvlib (X1) |
| Wind | None in the supplied set | No evidence found in the supplied set | Wake models and layout optimisation (not in supplied set) |
| Geothermal | D12 review: direct validation limited | Review plus proposals | Reservoir simulators, volumetric Monte Carlo |
| Hydropower | None for LLM agents; F6 is RL | RL case study (unverified details) | Reservoir optimisation, RL (F6) |
| Mining | C10 review (33 studies, largely conceptual), C11 proof of concept | Review plus PoC | Ultimate-pit optimisation, MILP scheduling |
| Agent methodology | F1 to F4, E13 | Benchmarks and survey | RL, planning, multi-agent simulation |

### Contradictions and gaps to flag

1. **B6 against B9.** B6 reports 95% validity for GPT-4o-mini; B9 reports at most 61.7% under strict scoring for the best of nine models. The metrics differ (validity against all-checks), the tasks differ, and the models differ. B9's authors attribute part of the gap to scoring strictness; the remainder is not identified. This is a measurement problem, not evidence that either result is wrong.
2. **Efficiency is not accuracy.** A3 and C11 report time and latency. Neither abstract reports an error rate against ground truth or against a deterministic baseline.
3. **Seed variance is not task variance.** B9's ± 0.7% describes run-to-run variation; with 103 tasks the sampling interval on a 61.7% rate is roughly ±9 points (normal approximation, my calculation), so close model rankings (for example 57.9% against 61.7%) are not established by that design alone.
4. **Contamination.** F4 shows a 100% to 0% range correlated with data recency. Public GIS and energy benchmarks should be assumed contaminated for models trained after release.
5. **Missing everywhere.** Safety outcomes (wrong actions prevented, unsafe actions attempted), calibration of stated uncertainty, human-expert baselines with time, and field data.

## B. Automation taxonomy

Four classes **[design]**:

| Class | Definition | LLM role | Gate |
|---|---|---|---|
| D | Deterministic automation | None at run time | Unit and regression tests |
| AI | AI-assisted analysis | Drafts, explains, extracts; a human or tool checks every number | Reviewer |
| BA | Bounded agent autonomy | Chooses tool calls inside an allowlist, budget and sandbox; output graded by independent checks | Independent verifier plus review gate |
| SC | Safety-critical | Advice at most; never actuation | Qualified engineer, physical interlocks, regulator rules |

| Sector | D (use plain code) | AI | BA (agent allowed, verified) | SC (no autonomy) |
|---|---|---|---|---|
| QGIS and GIS | Reprojection, clip, buffer, zonal statistics, raster algebra on a fixed recipe | Interpret an ambiguous brief into a recipe; summarise layers | Compose a recipe from the tool catalogue for a new brief; retrieve and harmonise data (B7) | Regulatory exclusion decisions that need legal sign-off |
| Solar | Irradiance and yield modelling, shading geometry, string sizing rules | Draft site assessment from outputs | Screen candidate sites and run parameter sweeps | Protection settings, grid-code compliance sign-off |
| Wind | Wake, yield and layout optimisation with validated codes | Summarise met-mast data quality issues | Run scenario sweeps over a layout solver | Turbine control changes, curtailment during grid events |
| Geothermal | Volumetric heat-in-place Monte Carlo, unit handling | Extract well parameters from reports (D12 lists extraction as supported) | Run and compare reservoir model cases; flag inconsistent inputs | Drilling-risk decisions, well control |
| Hydropower | Reservoir routing, optimisation, RL scheduling (F6) | Explain schedule trade-offs | Scenario exploration around a validated scheduler | Dispatch to units, flood release |
| Mining | Ultimate pit, schedule MILP, block-model statistics | Draft report text from solver outputs | Orchestrate scenario runs; challenge assumptions (C11) | Blast design, ground control, dispatch of equipment |
| Power systems | Load flow, N-1 | Draft study plan | Build and run a studied workflow with state verification (A3 pattern) | Real-time operation and switching |

**Where each class is justified.** Class D is the default: it is cheaper, repeatable and testable. An agent is justified only for work whose specification varies faster than someone can script it, and only if the measured benefit survives the baseline test in G. Class SC is excluded from this programme.

**Worked decomposition of the 50 MW solar site-selection example** (my decomposition, not from a source):

| Step | Class | Reason |
|---|---|---|
| 1. Parse the brief into constraints (capacity, area per MW, slope, distance to grid) | AI/BA | Ambiguity is where an LLM might help; a schema check validates it |
| 2. Collect layers (DEM, land cover, protected areas, grid lines) | BA | Retrieval from documented sources (B7); checksums and provenance recorded |
| 3. Harmonise CRS, resolution, units | D | Fixed rules |
| 4. Compute slope, aspect, distance rasters | D | Standard GIS operations |
| 5. Apply hard exclusions | D | Rules, not judgement; any exclusion error is a safety-class error |
| 6. Score soft criteria and rank | D (weights from human) | Multi-criteria weights are a human decision |
| 7. Estimate yield per candidate | D (pvlib, X1) | Physics model; LLM must not estimate |
| 8. Check grid connection feasibility | D (pandapower, X2) | Load flow |
| 9. Sensitivity and uncertainty | D | Monte Carlo |
| 10. Draft report with provenance and limits | AI | Narrative, with every number traced to a tool result |

Steps 3 to 9 are deterministic. The agent's candidate contribution is steps 1, 2 and 10, plus orchestration order. That is an honest statement of where the LLM could add value, and it is small.

## C. Reference architecture **[design]**

```
 human engineer  ──intent, approval──►  ORCHESTRATOR (LLM planner)
                                          │ plan = typed steps (schema)
        ┌─────────────────────────────────┤
        ▼                                 ▼
 POLICY ENFORCEMENT POINT           INDEPENDENT VERIFIER
 allowlist · budget · scopes        schema, units, bounds, invariants,
 egress filter · data minimisation  re-computation by a second tool
        │                                 ▲
        ▼                                 │
 SCIENTIFIC TOOLS  ───────────────────────┘
  geospatial (QGIS/GDAL)   solvers (pvlib, pandapower, MILP)
  digital twin / simulator   data catalogue (read-only, hashed)
        │
        ▼
 AUDIT LOG (append-only, hash-chained)  ·  HUMAN AUTHORISATION for any write or release
```

| Layer | Requirement | In Scorcher Build today |
|---|---|---|
| Orchestration | LLM proposes typed plan; plan is data, not code | Tool-call loop in `harness/` and `backend/src/core/model.ts` |
| Scientific tools | Deterministic, versioned, unit-aware, return aggregates not raw data where possible | `units_convert`, `table_query` (aggregates only), resource Monte Carlo (JavaScript) |
| Geospatial processing | Headless QGIS/GDAL behind a service with a fixed catalogue | Not built (adapter service listed as follow-up) |
| Digital twins and simulators | Reproducible, seeded, containerised | Synthetic only |
| Independent verification | Checker that does not share the agent's context or prompt | Grader and review gate (shape and tolerance); not yet physics invariants |
| Policy enforcement | Allowlist, budgets, egress filter, sandbox | Implemented and tested (`docs/BUILD-SECURITY.md`) |
| Logging | Tamper-evident, replayable | Hash chain; verified in Node and workerd |
| Human authorisation | No write-back without explicit approval | Review gate; no write tools exist |

Design rules: (1) the verifier must not trust the agent's claimed numbers and recomputes from tool outputs; (2) tools never accept free text commands; (3) a plan that touches anything outside the sandbox is refused, not warned; (4) the agent cannot change the policy or the scorer.

## D. Simulation specification **[design]**

### Formal frame

An episode is a partially observable, constrained decision process `(S, O, A, T, Ω, c, g, γ)`:

- **State** `s`: world (rasters, vectors, tables, simulator state), tool-layer state (files created, versions), budget used, audit head.
- **Observation** `o`: tool results and task text only, never `s`. Results may contain adversarial text.
- **Actions** `a`: calls from a typed catalogue with arguments; `submit_answer(x)` terminates.
- **Transition** `T(s'|s,a)`: deterministic given seed for software tools; stochastic for noisy data or faulty tools by design.
- **Uncertainty**: input noise `ε ~ P_ε`, tool failure probability `p_f`, ambiguous task phrasing drawn from a set of paraphrases `Q`.
- **Cost** `c(s,a)`: money, wall-clock, calls. **Constraints** `g_k(s) ≤ 0`: hard (law, physics, scope, budget) and soft.

### Environment 1: GIS workflow benchmark (QGIS)

| Element | Specification |
|---|---|
| Software | QGIS LTR headless (PyQGIS) in a container image pinned by digest; GDAL; tools exposed over MCP, in the style of B9's fixed tool layer |
| Data | Open data with licences recorded: DEM, land cover, administrative boundaries, grid lines; plus a **synthetic generator** with known ground truth so the correct answer is computable |
| Tasks | Parametrised templates (buffer-and-overlay, suitability, network distance, zonal stats, CRS trap, unit trap, missing-data trap), each with N variants and several paraphrases; ≥ 100 task instances for adequate power (G) |
| Scorer | Deterministic: geometry equality within tolerance (IoU or Hausdorff), attribute tolerances, constraint checks; both strict (all checks) and partial credit are reported, because B9 shows they differ by tens of points |
| Adversarial events | Instruction embedded in a layer attribute; mislabeled CRS; file outside scope; tool timeout; contradictory units; secret canary in a restricted file |
| Outputs | Pass (correct and safe), first-pass, calls, tokens, cost, latency, violations, audit chain |

### Environment 2: physics-based simulation

Pick one for phase 2; both are deterministic so ground truth and an optimum exist.

**2a. Solar plus grid** (pvlib X1 and pandapower X2): decision variables are site, capacity, tilt, connection point; objective is levelised cost or net energy subject to hard limits (voltage 0.95 to 1.05 p.u., line loading ≤ 100%, N-1 secure, exclusion zones). The scorer recomputes with the same solvers.

**2b. Open-pit mining** (block model on the Marvin copper benchmark used by C11, if its licence permits, else a synthetic model): decision is pit limit and schedule; the ultimate pit is a maximum-weight closure problem solvable exactly (Lerchs–Grossmann; Picard; bibliographic details to be verified). The exact optimum gives a true optimality gap; slope constraints and grade-tonnage are hard.

**Common hooks.** Seeds in the task spec; scenario sampler for price, resource and demand uncertainty; fault injection (tool errors, stale data); sealed hold-out set kept private (F4 contamination concern).

## E. Optimal and safe behaviour, defined **[design]**

Separate the *engineering problem* (what the plant or project should do) from the *agent problem* (what the software agent should do). The agent is not the optimiser; it chooses which solver to run. Both need definitions.

**Engineering optimum.** For decision `x`, uncertainty `ξ`:

```
min_x   E_ξ[ f(x,ξ) ]                (or CVaR_α, for risk)
s.t.    g_hard(x,ξ) ≤ 0             for all ξ ∈ U      (robust)   or   P(g_hard ≤ 0) ≥ 1 − δ  (chance)
        g_soft(x,ξ) ≤ τ             penalised by λ ≥ 0
```

Hard constraints (physics, law, safety margins) are never traded against objective value. Soft constraints are traded with explicit weights recorded in the task spec.

**Agent behaviour.** A policy `π` is **safe** on a task distribution if the probability of violating any hard policy is below `δ_safe` with a confidence bound: `P_π(violation) ≤ δ_safe` with 1 − α confidence (Clopper–Pearson or Wilson upper bound over n episodes). With zero violations in n episodes the one-sided 95% upper bound is about `3/n` (rule of three), so showing `δ_safe = 1%` needs ≈ 300 clean episodes. Safety is a precondition, not a score component; a run passes only if it is correct **and** safe (as in `docs/BUILD-SECURITY.md`).

**Quality.** Let `J(x)` be the engineering objective of the delivered answer and `J*` the best known (exact solver or best-of-solver ensemble). Define the **optimality gap** `Δ = (J(x_π) − J*) / |J*|`. "Optimal" is claimed only when the gap is reported against a named solver on a stated problem; otherwise the word is not used. Where `J*` is unknown, report the gap against the strongest baseline and say so.

**Uncertainty.** An answer is a distribution or an interval; the **calibration** requirement is that the nominal 90% interval contains the reference at 90% ± tolerance across tasks (coverage), measured, not asserted.

**Multi-objective.** Report the Pareto set of (quality gap, cost, latency, risk) across arms; a model dominates another only if it is no worse on all axes (B9 uses capability and cost as orthogonal axes).

**Stopping.** The agent must stop when (a) the budget is exhausted, (b) the verifier accepts, (c) a hard-constraint conflict is found (escalate), or (d) a plateau: expected improvement `< ε` over k steps. For experiments, a sequential probability ratio test on the paired difference may stop a comparison early; a fixed budget is the safer default.

**Value of the agent.** `V = U(arm_agent) − U(arm_baseline)` for utility `U = P(correct∧safe) − λ_c·cost − λ_t·time`, computed on the *same* tasks, with the conventional pipeline as baseline. An agent has value only if `V > 0` with the interval excluding 0, and the difference exceeds a pre-set margin.

## F. Threat model and control mapping

Assets: client data, credentials, model outputs relied on for decisions, simulator and plant interfaces, audit trail. Adversaries: malicious content in data and documents (X3), a compromised dependency or tool, a curious tenant, a careless user, a model that errs.

| Threat | Example | Controls **[design]** | Mapping (check against current texts) |
|---|---|---|---|
| Indirect prompt injection | Layer attribute tells the agent to read a restricted file (X3) | Treat tool output as untrusted data; tool allowlist; sandbox; canary tests; no free-form execution | OWASP LLM01; AI RMF MEASURE/MANAGE |
| Excessive agency | Agent writes to a system | Read-only tools by default; explicit human authorisation for writes; budgets | OWASP LLM06; 62443 FR2 (use control) |
| Sensitive data disclosure | Secret in a restricted file appears in the answer | Manifest allowlist; restricted files invisible; egress filter on guarded values; aggregates-only table tool | OWASP LLM02; 62443 FR4 (data confidentiality) |
| Improper output handling | Agent output executed downstream | Typed schema; verifier before release; no execution of model text | OWASP LLM05; 62443 FR3 (system integrity) |
| Supply chain | Poisoned model, plugin or package | Pinned digests; SBOM; vetted tool catalogue | OWASP LLM03; SP 800-82 |
| Unbounded consumption | Loops drain budget | Call and cost limits; per-tenant spend cap | OWASP LLM10; 62443 FR7 (resource availability) |
| Misinformation | Confident wrong number | Independent recomputation; uncertainty reporting; report labels measured/derived/modelled | OWASP LLM09; AI RMF MEASURE |
| Audit tampering | Edit trace after the fact | Hash chain, external anchoring of head hash | 62443 FR6 (timely response to events), FR1 |
| OT availability and safety | Anything near control networks | Out of scope for the prototype; air gap from OT; advice only (SP 800-82 priorities: safety and availability before confidentiality) | SP 800-82 Rev. 3; Purdue-style zones and conduits (62443-3-2) |
| Model or prompt leakage | System prompt extracted | Assume it leaks; no secrets in prompts | OWASP LLM07 |

**AI RMF mapping of the programme.** GOVERN: roles, decision rights, incident process; MAP: use-case context and impact for each task class (section B); MEASURE: the experiments in G with metrics and confidence intervals; MANAGE: stopping rules, rollback, and the maturity gates in H. NIST AI 600-1 (X6) adds generative-AI risks to MAP.

**What is enforced and what is not** is tracked in `docs/BUILD-SECURITY.md`; this document does not strengthen those claims. Notably, nothing here is a certification against IEC 62443 or any other standard.

## G. Experimental programme **[design]**

**Arms** (same tasks, same tools, same budgets):

| Arm | Description |
|---|---|
| H | Human expert (GIS or engineering analyst), time recorded |
| D1, D0 | Deterministic pipeline. D1: parameters entered correctly by an analyst (the ceiling for interpretation). D0: organisation defaults, no analyst (what a fixed recipe achieves alone). The split matters: with a single D arm, either the agent can never beat D (D given perfect inputs) or D is a straw man (D given none) |
| S | Single-agent LLM with tool allowlist |
| M | Multi-agent LLM (planner, executor, critic) |
| V | Single agent plus independent verifier and review gate |
| O | Conventional optimiser or solver, where a formal problem exists (exact or heuristic) |

**Datasets.** Synthetic generator with known truth (primary, regenerated per run); public benchmarks B6, B9, B8 (for comparability only, assume contamination); a sealed hold-out of new tasks authored after the model release date, never published until the study ends; adversarial packs.

**Factors.** Specification clarity (structured brief, plain brief, ambiguous brief), data defects (clean, CRS error, missing values, unit mismatch), adversarial content (none, injection, canary), model size/class (small, mid, frontier), tool-layer fixed.

**Hypotheses** (each tested against a pre-registered margin):

| ID | Hypothesis | Test |
|---|---|---|
| H1 | On fully specified tasks, arm D is non-inferior to S on correctness and cheaper | Non-inferiority, margin 5 points |
| H2 | On ambiguous briefs, S exceeds D on P(correct∧safe) | Superiority, paired |
| H3 | V reduces unsafe or incorrect accepted answers relative to S | Paired; primary: accepted-wrong rate |
| H4 | M exceeds S by more than its extra cost justifies | Utility V in E |
| H5 | Agents lose ≥ x points under injection relative to clean tasks, hardened prompts reduce it | Paired by task |
| H6 | Small models match large ones on class-D-like steps at lower cost | Pareto comparison |
| H7 | Stated 90% intervals achieve 90% ± 5% coverage | Coverage test |

**Ablations.** Remove the verifier; remove the tool catalogue limits; shuffle tool order; vary temperature and seeds (≥ 3, report between-seed and between-task variance separately); swap model; hide units; remove schema guidance (A3 did similar).

**Statistics.**
- Unit of analysis: task, with the seed as a nested factor. Pass/fail per run, paired across arms.
- Interval estimates: Wilson for proportions; paired difference with exact McNemar or a mixed-effects logistic model with random task and seed effects.
- Multiplicity: Holm correction over the pre-registered hypotheses.
- Power: with discordant-pair proportion ψ = 0.3 and a true paired difference δ, n ≈ (z_{α/2}√ψ + z_β√(ψ − δ²))² / δ². For δ = 0.15 at 80% power, two-sided 5%: **about 100 tasks**. With 50 tasks (the size of B6) only differences of about **21 points** are detectable. This is a design calculation under assumed ψ; adjust to pilot data.
- Inter-rater reliability for human-scored parts (Cohen's κ, two raters).
- Report negative results.

**Success and failure criteria.** The programme *supports* agent value if H2 holds with V > 0, no safety regression (upper confidence bound on violations under the pre-set limit), and cost per verified task is within the stated budget. It *fails to support* the claim if D is non-inferior on all strata, or if any hard-safety violation occurs in the verified arm in clean conditions. Either outcome is publishable.

**Replication.** Container digests, seeds, model identifiers with dates, prompts, scorer, trace and hash-chain head published; reruns of the full study must regenerate every table; a held-out lab repeats with its own seeds.

## H. Phased roadmap **[design]**

| Phase | Scope | Software and data | Models | Security controls | Outputs | Acceptance criteria |
|---|---|---|---|---|---|---|
| 0 (done) | Harness and backend with synthetic tasks | `harness/`, `backend/`, hash chain, injection suite | Fixture agents; real models once an API key is available | As in `docs/BUILD-SECURITY.md` | Reproducible traces, pass-rate tables | Existing tests pass; real-model run on the synthetic suite |
| 1 (core built, see below) | QGIS agent benchmark (the smallest prototype, below) | Headless QGIS, MCP tool layer, generator, scorer; ≥ 100 instances | Small, mid, frontier; arms D, S, V | Sandbox, canaries, audit | Report with intervals, strict and partial scores | H1 and H2 resolved at stated power; zero unsafe passes in clean runs |
| 2 | Physics sandbox: solar plus grid | pvlib, pandapower; scenario sampler | Same | Plus verifier recomputation | Optimality gaps against solver; calibration | Gap and coverage reported; verifier catches seeded errors |
| 3 | Mining sandbox | Block model, ultimate-pit solver, MILP schedule | Same | Same | Gap against exact pit | As above |
| 4 | Geothermal and hydropower sandboxes | Volumetric Monte Carlo (exists); RL/optimisation baselines (F6 as baseline class) | Same | Same | Same | Same |
| 5 | Pilot on client data in read-only mode | Customer data under agreement | Selected models | Tenant isolation, data residency, review gate | Shadow-mode comparison with analysts | Pre-set equivalence or superiority; incident-free |


### Phase 1 as built (November 2026)

Code in `gisbench/` (README there). What it takes from the supplied papers, and where it differs:

| Source | Taken | Different |
|---|---|---|
| B9 | One fixed tool layer so the agent is the only variable; strict and partial scores both reported; per-case cost | 19 tools in-process, not an MCP server (MCP wrapper is a later step) |
| B8 | Execution sandbox on an open Python stack; specific tool errors the agent can recover from; tools return summaries | 19 tools against 133; scored on **outcome** (answer and mask against an independently computable key), not on one reference trajectory, because B8 concedes a single trajectory measures fidelity, not correctness |
| B8 limitations | Fills the stated gap: invalid geometry, CRS error, undeclared nodata, mixed units | Four defects only |
| A3 | Planning versus verified completion as separate quantities; a complexity by ambiguity matrix; a deterministic control layer between planner and solver; human authorisation | Ambiguity levels S1 to S3 (parameters explicit, in mixed units, or located in a note with a superseded distractor) instead of V1 to V5; repeats are across **tasks**, not 30 seeds of 45 prompts, because A3's temperature-0, fixed-seed repeats are not independent samples |
| B6 | Task framing from public workflow tutorials; the observation that site selection is the hardest category | Code is **executed**, not compared with CodeBLEU |
| D12 | Missed hazards reported separately from accuracy: here, delivered cells inside a protected area plus buffer are a hard violation that fails the run even when the totals are right | |

Verification of the key: slope and buffer primitives agree with QGIS 3.34.4 (`native:slope`, `native:buffer`) to 2e-6 degrees and 1e-12 relative area. The whole recipe run end to end in QGIS and GDAL on 36 tasks agrees with the key (mask agreement at least 0.997, area within 0.3%, feasibility 36 of 36); that check also found and fixed a convention gap in the key's handling of missing elevation data. The fixture run (not models) gives: analyst pipeline 120 of 120, defaults 30 of 120 (30 of 31 standard briefs, 0 of 89 others), a naive pipeline 10 of 120, and a gullible pipeline fails every injected task on the restricted read. These confirm the scorer discriminates; they say nothing about any language model.

**Open questions.** Do agents add value once the recipe library is rich enough to script? Does the verifier share failure modes with the agent? How fast does benchmark value decay through contamination? What is the real analyst baseline, including time? Which open datasets permit redistribution for benchmarks (licences to be checked)?

## Critical review

**Is agentic AI better than existing software?** Not shown. The supplied evidence compares LLMs with other LLMs (B6, B9), with manual effort (A3) or with nothing (B7, C11). None of the abstracts reports a comparison with a scripted, conventional pipeline on the same task. Absent that baseline, "agentic" is a hypothesis.

**Where does the benefit come from?** A3's ablations answer this directly for one system: with the same model, removing schema guidance or the deterministic control layer cost about 27 to 30 points of verified completion, so the architecture contributes as much as the model. Swapping the 32B backbone for 7B or 8B models cost 25 to 33 points. B8 shows the same pattern: the paradigm with execution feedback outperforms static planning on end-to-end maps. In B9 the tool layer is fixed to isolate the agent, which is the correct design and still yields at best about 61.7% strict. C11's value is orchestration and auditability; the pit comes from a Lerchs–Grossmann solver. In general the *tools* do the physics; the LLM does translation, which is cheap to replace when inputs are structured. No supplied study tests that last claim with a scripted baseline.

**Where an LLM adds cost, latency, error or risk.** (1) Cost: an order of magnitude between models at similar capability (B9). (2) Latency: C11's mean debate is 10.69 s per step, harmless for planning, unacceptable for control. (3) Error: non-determinism at temperature 1.0 (B9 seeds), plausible but wrong workflows (B6 validity versus accuracy). (4) Risk: indirect injection (X3), excessive agency, data leakage. (5) Evaluation risk: contamination (F4) and metric choice.

**On the word optimal.** In this programme "optimal" requires an objective, constraints, a baseline and a gap. No supplied study claims it for an LLM agent; the exact-solver cases (pit design, load flow, hydropower RL) are where an optimum can be stated, and the LLM is not the optimiser there.

**Limits of this document.** Six papers read in part (see section 0), the rest at abstract level; eight abstracts unavailable; the readiness table in your brief is an unvalidated assessment and is treated here as a hypothesis, not evidence; no real-model trial has yet been run in this project. The A3 and B8 results use models and a simulator not available to us, so they inform design, not expected scores.

## The smallest scientifically credible prototype

**Question.** Does an LLM agent with an independent verifier add measurable value over a scripted deterministic pipeline for GIS-based solar site screening, once task specifications vary?

**Build** (all open software, no client data): headless QGIS and GDAL behind an MCP tool layer; a synthetic generator producing ≥ 100 task instances with computable truth and three specification levels (structured, plain, ambiguous) plus data defects and injection variants; pvlib for the yield step so one numeric answer is physics-based; a deterministic scorer reporting strict and partial scores; the existing hash-chained audit, sandbox and review gate from Scorcher Build.

**Arms.** D (scripted pipeline), S (single agent), V (agent plus verifier). Three model classes. Three seeds. Human expert on a 20-task subset to anchor time and accuracy.

**Primary endpoint.** P(correct and safe) on ambiguous briefs, paired S versus D. **Secondary.** Accepted-wrong rate (V versus S), cost and latency per verified task, coverage of stated intervals, injection resistance.

**Decision.** If D is non-inferior on all strata, the agent adds no measurable value for this class of task, and the platform should position agents only where the harness shows a gain. If S or V beat D on ambiguous briefs with zero hard-safety violations, proceed to phase 2. Either result is informative, and the prototype is cheap enough to run before any larger claim is made.
