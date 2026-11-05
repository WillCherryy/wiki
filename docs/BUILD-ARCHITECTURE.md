# Scorcher Build: architecture

Scorcher Build lets an engineering or energy firm find out, on its own tasks, whether an agent is worth paying for. The owner's decisions are in `docs/SUITE.md`; the brand is in `docs/DESIGN.md`. This file is how the platform is built, what exists, and what does not.

First sector: geothermal. Domains: GIS (QGIS and ArcGIS), seismic section interpretation, resource estimates, well and drilling data, and documents (permits, environmental assessments).

## What exists today

`harness/` is a separate package (own `package.json`; not part of the site or the Worker). `cd harness && npm install`, then `npm test` there, or `npm test` at the repo root (it runs the harness tests last and skips them when the harness dependencies are not installed). `npm run harness` at the root runs the synthetic trial and prints the scorecard.

| Part | State |
|---|---|
| Statistics (`stats.js`): Wilson interval, paired bootstrap, Monte Carlo percentile interval | Built, tested against known values |
| Tool gateway (`gateway.js`): typed tools, per-trial trace, call budget, review gate | Built |
| Tools: `resource_volumetric_mc`, `well_horner`, `seismic_compare_picks`, `units_convert` | Built, tested against closed forms |
| Grading (`grade.js`) and synthetic resource tasks (`tasks.js`) | Built for the reference class |
| Fixture agents (`agents.js`) and `run-trial.js` | Built. They are scripted recipes, not language models and not Scorcher's agents |
| MCP over HTTP with one bearer token per trial (`mcp.js`) | Built; an agent working a task over it is in the tests |
| MCP over stdio (`node harness/mcp.js --task res-001`) | Built; tested with an SDK client (the trace is written when the agent disconnects) |
| GIS adapters (QGIS), ArcGIS, SEG-Y reading, document extraction | Not built |
| Persistence, accounts, billing, a real dashboard behind the console mockup | Not built |

`mockups/suite/build-console.html` is the console mockup. Its overview and resource-estimate views display a real harness run (`node harness/export-sample.js` regenerates `build-sample.js`) on synthetic tasks; the GIS, seismic, well and document views compute on synthetic data in the page and are labelled so.

## Principles

1. **The gateway is the instrument.** An agent touches nothing except through the gateway's tools. Every call is validated, timed and written to the trial's trace. This is the "workflow used" the client reviews, and it works the same for any agent.
2. **Tools compute; agents decide.** Reprojection, unit conversion and Monte Carlo are code. The agent calls them. A model does no arithmetic that a tool can do.
3. **Read-only on copies.** Tools never write to client data. Trials run on copies.
4. **Grade against something other than a model.** Order of preference: deterministic checks, a reference or expert answer, an engineer's review. A language-model check may only flag work for a person, and its agreement with human grades must be measured and reported.
5. **Report the interval, not the point.** A score is a rate with an interval and a sample size; two agents on the same tasks are compared pairwise; "inconclusive" is a valid verdict.
6. **Label what was measured and what was claimed.** Wall time and tool calls are measured by the gateway. Anything an external agent reports about itself (tokens, cost, internal steps) is shown as self-reported.

## Two kinds of uncertainty (never mixed)

- **In the engineering answer:** P90/P50/P10 for a resource estimate, a confidence interval on a corrected formation temperature, a spread on a horizon pick. It comes from the domain method (Monte Carlo over input distributions, a regression, an ensemble). It never comes from a model's stated confidence, which is poorly calibrated.
- **In the score of the agent:** Wilson interval on a pass rate, bootstrap interval on a paired difference. With 28 passes in 30 tasks the 95 % interval is about 79 % to 98 %.

Resource-estimate convention (as in oil, gas and geothermal practice): P90 is the value exceeded with 90 % probability, so P90 < P50 < P10. Every dashboard states it.

## Bring your own agent

Yes, it is possible, and it is the main design case. Four routes, in the order to build them:

| Route | What the client keeps private | What Scorcher measures | State |
|---|---|---|---|
| **1. Remote MCP.** The client's agent runs anywhere (their cloud, laptop, server) and connects to a per-trial MCP URL with a bearer token. It discovers the tools, calls `task_get`, works, and calls `submit_answer`. | Their prompts, model, code, reasoning | Every tool call, order, arguments, results, wall time, attempts. Tokens and cost: self-reported only | Built (HTTP) |
| **2. Hosted loop with their model and prompt.** Scorcher runs the loop; the client supplies a model endpoint or key and a system prompt. | The key and prompt (stored encrypted, deleted after the trial) | Everything above, plus tokens and cost through a metering proxy | Not built |
| **3. Container in a sandbox.** The client pushes an image; Scorcher runs it with no network except the gateway (and optionally their model endpoint on an allow-list), with CPU and time limits. | Source (it is an image) | CPU, memory, wall time, and tokens if their model calls go through the proxy. Reproducible | Not built |
| **4. On premises.** Scorcher ships the harness (gateway, tools, graders) to the client. Their agent runs there; data never leaves. Only scores and traces (no data) may be uploaded, if they choose | Everything | Everything, but Scorcher cannot audit the run | Harness and stdio MCP built; packaging for a client site not done |

Fairness across routes: the same tasks, the same tools, the same call budget, a hidden reference set the agent never sees, and the same accounting. The scorecard says which route a run used, because routes 1 and 4 allow self-reported figures.

**The agent contract.** `task_get` returns the statement and inputs (never the reference). The agent works with the tools. `submit_answer` takes the answer, `method` text and optional `steps`. A review gate then runs deterministic checks that need no reference (schema, units, ordering, physical plausibility). If it rejects the answer, it says why, and the agent may fix it and resubmit. The scorecard reports **first attempt** and **final** results separately, plus how many attempts it took, so a retry loop cannot hide failures.

## Grading classes

| Class | Pass means | Example |
|---|---|---|
| **Rule** | A script says so | File converts, schema valid, units correct |
| **Reference** | Within a stated tolerance of an expert or reference answer | P50 within 5 % and P90, P10 within 10 % of the reference calculation (wider than the reference's Monte Carlo error, which is under 1 %) |
| **Judgement** | Within the spread of human experts | A horizon pick lying between two interpreters' picks, widened by a stated tolerance |

For judgement tasks the baseline is human-to-human disagreement, not "truth": interpretation is non-unique. The scorecard reports the humans' own spread beside the agent's.

Failures are categorised (format, units, no-uncertainty, value, no-answer), because a client learns more from why an agent failed than from how often.

## Statistics

- Pass rate: Wilson 95 % interval, with n shown.
- Two agents: paired bootstrap on the per-task difference, reported with discordant counts (tasks only one passed). Verdict is "a better", "b better" or "inconclusive".
- Sample size: with about 30 tasks the interval on one rate is roughly ±10 points, and a paired difference needs a large gap to be conclusive. The console says so, and recommends more tasks when a result is inconclusive. Tasks should be drawn from the client's own work, fixed before the agents run.
- Seeds are recorded; a trial can be re-run.

## Models: small, large, and code

Route by step, not by product:
- **Code** for everything computable.
- **A large model** to plan, read messy documents and decide the next step.
- **A small model** (SLM) for narrow, high-volume steps: field extraction, classifying drilling-report events, normalising formats. These are the candidates for the client's own hardware.

Because the harness runs the same task with different models, "where do small models suffice?" is a result Scorcher can publish. For seismic, a general language model looking at a section image is not a good picker; dedicated trained networks are. The agent should orchestrate such tools and check their output.

The platform treats the model as a setting, never a constant: a comparison platform that fixes the model cannot compare models.

## Interfaces to the client's software

MCP is a protocol that exposes tools to an agent uniformly; the software still needs some programmatic route. Wrap each tool in a thin, typed, versioned adapter, expose the adapters through MCP, and log every call there.

| Software | Route | Notes |
|---|---|---|
| QGIS | The processing command line or PyQGIS | Open source; first GIS target |
| ArcGIS | ArcPy or the ArcGIS API for Python | Needs a licensed installation; check the licence terms before automating |
| Seismic | Open SEG-Y libraries first; commercial packages through their own SDKs where one exists | Interfaces differ by package and have not been verified here |
| Resource estimate | The volumetric Monte Carlo tool; reservoir simulators later (file-based input) | The method is simple enough to write as open code |
| GUI-only software | Scripting or file-based batch; screen control as a last resort | Slow and brittle: graded and priced separately |

## Security and data

- Tokens are per trial, short-lived and scoped to that trial's tools.
- No tool writes; no tool reaches the grader's reference set.
- Documents are untrusted input: an agent reading a PDF can be attacked by text inside it. Tool results are data, never instructions; the review gate does not rely on the agent's own judgement.
- Sensitive data: on-premises route (4), or private deployment. Retention is the client's decision.
- Known gap: a malformed call rejected by the MCP protocol layer before it reaches the gateway is not in the trace.

## Dashboards, one per task

All share a frame: task, arms, verdict, grading class, the workflow trace, and review controls. The main panel is specific to the task (mockup: `mockups/suite/build-console.html`):

| Task | Main panel | Needs from the harness |
|---|---|---|
| Resource estimate | Distribution with P90/P50/P10 and their Monte Carlo intervals; inputs table with sources and distributions; sensitivity; comparison with the reference | `resource_volumetric_mc`, reference run |
| GIS screening | Map with layers, agent against reference, difference view, ranked sites with the range of their ranks under weight changes, layer lineage and coordinate-system checks | QGIS adapter (not built) |
| Seismic interpretation | Section with agent, interpreter A and interpreter B picks; pick-difference histogram; the humans' own spread as the pass mark; accept or reject per pick | `seismic_compare_picks`; SEG-Y reading (not built) |
| Well and drilling data | Temperature profile before and after correction with the interval; event timeline; classification errors | `well_horner`; log and report parsers (not built) |
| Documents | Clause by clause with the source passage; what the agent found, missed and got wrong against a human reading | Extraction tools (not built) |

## Build order

1. Resource estimate end to end (done in the harness on synthetic tasks, with fixture agents). Next: connect a real model agent over MCP and record the first honest result; write the resulting scorecard up with its intervals whatever it shows.
2. Persistence for trials, a read-only viewer for traces and scorecards, and the console fed from it.
3. QGIS adapter and the GIS task; a first real client task set, drawn and frozen before running.
4. Seismic data preparation (SEG-Y checks), then pick comparison on real sections with two interpreters.
5. Documents; then ArcGIS and commercial packages, once licensing is understood.
6. Routes 2 and 3 for bringing an agent; metering proxy.

## Open questions for the owner

- A geothermal contact to say which tasks actually cost the most time. The task list here is my understanding, not verified.
- Who the second interpreter is for seismic tasks (the baseline needs two humans).
- The model for the first real agent (the harness is model-agnostic; the choice sets cost).
- A citation to verify before any client-facing use: the volumetric method reference (Muffler and Cataldi, 1978), named in `harness/tools/resource.js`. The default input ranges in the synthetic tasks are assumptions, not sourced values.
