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
| File sandbox, tool policy, spend cap, egress filter and a hash-chained audit trail (`sandbox.js`, `gateway.js`); see `BUILD-SECURITY.md` | Built, tested |
| Customer task spec (`taskspec.js`) and `run-spec.js`; file tools `files_list`, `files_read`, `table_query` | Built, tested |
| Mining suite (grade and tonnage) and a prompt-injection suite (`packs.js`) | Built on synthetic data |
| Fixture agents (`agents.js`) and `run-trial.js` | Built. They are scripted recipes, not language models and not Scorcher's agents |
| Model runner (`llm-agent.js`, `run-llm-trial.js`): a Claude model works tasks over MCP route 1, with token and cost accounting (`pricing.js`) and a spend cap | Built and tested with a stand-in model. **Not yet run against a real model: no API key in the build environment** |
| MCP over HTTP with one bearer token per trial (`mcp.js`) | Built; an agent working a task over it is in the tests |
| MCP over stdio (`node harness/mcp.js --task res-001`) | Built; tested with an SDK client (the trace is written when the agent disconnects) |
| GIS adapters (QGIS), ArcGIS, SEG-Y reading, document extraction | Not built |
| Persistence, accounts, billing, a real dashboard behind the console mockup | Not built |

The concept pages are also served at `/build/` and `/build/console` (dev server and site build; noindex; labelled as concepts with synthetic data). `mockups/suite/build-console.html` is the console mockup. It fills the window on a desktop (panels scroll inside themselves, never the page) and scales up on large screens. Its overview, agents and resource-estimate views display a real harness run (`node harness/export-sample.js` regenerates `build-sample.js`) on synthetic tasks; the GIS, seismic, well and document views compute on synthetic data in the page and are labelled so.

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

## Getting a real model in

The runner is built; what is missing is a credential. `llm-agent.js` is a route-1 client: it connects to the harness over MCP with a trial token, shows the model the gateway's tools (not the accounting tool), runs the tool loop, and records tokens as it goes. `run-llm-trial.js` runs it over the synthetic tasks and saves a scorecard to `harness/results/`; the console picks that up the next time `node harness/export-sample.js` runs.

To run it:
1. Add `ANTHROPIC_API_KEY` as an environment variable (or network secret) in the cloud environment's settings, so a new session has it. Never paste it into a chat. On your own machine, set it in the shell.
2. `cd harness && npm install`, then from the repo root `npm run agent -- --model claude-haiku-5-5` prints the estimate and stops; add `--yes` to spend. `--max-cost` caps the whole run (default $1). `--suite resource|mining|security` picks the task set and `--prompt baseline|hardened` the safety instruction.
3. A useful first sequence on the cheapest tier (rough estimates at the placeholder token counts, a few cents each): the resource suite, the mining suite, then the security suite once with `--prompt baseline` and once with `--prompt hardened`. Each saves a scorecard to `harness/results/`; `node harness/export-sample.js` puts them in the console.

Choices made on purpose, because this is a comparison platform:
- **No refusal fallback.** A server-side fallback would silently swap in another model and the scorecard would credit the wrong one. A refusal is recorded as a refusal.
- **No prompt caching, no thinking settings.** Each call is billed at the plain published rates, and every model runs at its own defaults.
- **A generic prompt.** It does not say which tools to use, in what order, or to convert units: finding that out is what is being tested.
- **A spend cap and an estimate first.** Nothing spends money without `--yes`.
- **The model is a setting.** `--model` takes any model with a price in `pricing.js`.

What a first run will tell us: whether a current model, left to itself, handles the unit trap, produces a proper P90 to P10, and uses the review gate. With 24 tasks the interval on its pass rate is about ±10 points, so the honest first result is a rough one.

## Price, quality and benchmarks per agent

The console's **Agents and plans** view lists each agent with: quality (pass rate with a 95 % interval and a first-attempt rate), tokens in and out, cost per task split into input and output, and **cost per correct answer** (total spend divided by passes: a cheap agent that is often wrong can cost more per right answer than a dearer one). Below that, benchmarks: pass rates on fixed task sets with their intervals. Today there are two (metric-unit and field-unit resource estimates); each new task family adds more, each graded in its own class.

- **Model cost** is tokens at the published per-million-token rates in `pricing.js` (source and date stated; prices change, so check the live page before quoting a customer). Route-1 token counts are self-reported by the agent's client and labelled so; routes 2 and 3 can measure them through a proxy.
- **Fixtures have no cost** (they are not models). **Models not yet run show only the price list and an estimate** that assumes 25,000 input and 3,000 output tokens per task, a placeholder until a run measures it. The console never shows made-up results for a model that has not run.
- **Scorcher's own prices are not set** and nothing in the code or the console has a number for them (`docs/SUITE.md`: agreed with the first pilots).

## Using Scorcher's agent, and subscribing

The offer is: run your agent, Scorcher's, or both on the same tasks, then subscribe to Scorcher's if it earns its place. Scorcher's agent is the same kind of thing as a customer's: a loop with a prompt, a model and the gateway's tools, run on our side (route 2 with our own prompt and key). It gets no special access, and its runs are scored by the same graders, so the comparison is fair.

What a subscription needs, none of which exists yet:
- **Accounts for organisations**, with roles. The Worker today knows only anonymous player IDs.
- **Entitlements**: a record that organisation X may run agent Y. The Worker already verifies signed payment webhooks (Stripe and Lemon Squeezy) and records purchases as entitlements for the race's supporter packs, so the signing, storage and checking pattern can be reused; the keys, plans and usage metering are new.
- **Metering**: tokens per run, measured at our model proxy, so usage is billed from our own record and not from a customer's claim.
- **A decision on pricing**: model use bundled into a fee, or passed through at cost plus a margin. Open.
- **For paying customers on their own data**: an audit trail, retention rules and an on-premises option. This is the heaviest part.

## Is it possible, will it work, and how complex is it?

**Possible: yes.** Every piece exists in the world and the core is built here: a typed tool gateway, a trace, a review gate, graders, statistics, MCP over HTTP and stdio, and a model runner. Nothing in the design needs research to be feasible.

**Will it work: as an evaluation platform, yes; whether agents are good at these jobs is the open question, and it is empirical.** The platform's value is that it finds out honestly, for a given firm, on its own tasks. Reasons for caution, in order of how likely they are to bite:
1. **Ground truth costs expert time.** Reference answers, tolerances, and (for seismic) a second interpreter must come from the client's engineers. Without them the scores are not trustworthy, and no software fixes that.
2. **Proprietary and legacy software.** Open tools (QGIS, SEG-Y libraries, our own Monte Carlo) are easy to wrap. ArcGIS needs a licence and its own scripting; some seismic packages are GUI-only; screen control is slow and brittle. Each package is its own project and has licence terms to check.
3. **Models may be good at some tasks and poor at others.** Unit handling and calculation-through-tools are likely strong; interpretation under uncertainty and long messy documents are less certain. Synthetic results do not transfer to a client's real data.
4. **Security and data.** Energy firms may not send data to a third party; the on-premises route and small local models then become the product, and cost more to build and support.
5. **Selling to small firms** who may not have a person to run a trial. This is a business risk, not a technical one.

**How complex?** Rough estimates by one developer working with an AI assistant, to be treated as ranges and not commitments. The largest uncertainty is in client tasks and software access, not code.

| Stage | What | Rough effort |
|---|---|---|
| Prove it | A real model on the resource task and its honest scorecard (needs the key); QGIS adapter and one GIS task | days to 2 weeks |
| Pilot-ready | Persistence for trials; a trace and scorecard viewer wired to real data; hosted loop (route 2); two or three domains on a first client's real, frozen tasks; on-premises packaging | 1 to 3 months |
| Product | Accounts and roles, billing and metering, audit logging, security review, more adapters, support and operations | 6 to 12 months or more, and likely more than one person |

**The sensible next step is not more code.** Find one geothermal firm, pick one task that costs them real time, have their engineer write down what a correct answer is, and run a trial on it, before building more adapters. The harness is ready for that.

## Where people put their task

Intake is a **task spec**: JSON next to the files it names (`taskspec.js`; a worked example is in `harness/examples/grade-tonnage/`). It holds:
- **what is to be done** (`statement`) and the **team's own procedure** (`instructions`: pasted text, a checklist, notes, definitions). The agent reads both as part of the task. This is where script-style instructions go;
- **files**, each marked normal or restricted. Attached scripts (PyQGIS, Python) are read as text; **the platform never executes them**. A restricted file cannot be read by the agent, and the secret-looking values in it are guarded against appearing in an answer;
- **what a correct answer is**: named numeric fields with units and tolerances, and a reference value for each, kept hidden from the agent;
- **the tools allowed** (nothing by default beyond reading the task and submitting) and **limits** (calls, spend);
- the **agent**: Scorcher's, the customer's own over MCP, or both.

`node harness/run-spec.js task.json --check` validates a spec and shows exactly what the agent will see, spending nothing; with `--model … --yes` it runs a Claude model on it within the spec's own policy and cap. The console's **New task** view is a form for the same spec: it validates as you type, reads attached files in the browser only (to show size, a fingerprint, the columns of a CSV and how many secret values a restricted file holds), and produces the JSON. Running from the browser needs the hosted service, which is not built.

Today a custom task is graded as a numeric reference (each field within its tolerance). Rule checks (a script decides) and expert-spread grading for judgement tasks are planned for custom tasks. What cannot be written down as a number or a rule needs a human reviewer.

## More domains: mining, solar, wind

A domain is a pack: task generators or a customer's own tasks, typed read-only tools, graders and hidden reference data (`packs.js`). Geothermal and mining are built on synthetic data; solar and wind are planned. The mining suite (grade and tonnage above a cut-off from a block model CSV) needed one new tool (`table_query`) and a file sandbox, and reuses the gateway, trace, graders, statistics, security model and console unchanged. Solar and wind would follow the same way: for example a PV yield estimate or a wind capacity factor, with uncertainty, graded against a reference. Interfaces to specific commercial packages in any of these sectors have not been verified here; each is its own adapter and licence check. The console's **Suites** view lists every task family with its grading class and state.

## Small models first

The safest and cheapest place for a small model is a narrow step, on the customer's own hardware. The design:
1. **Code first** for anything computable.
2. **A small model** for narrow, high-volume steps (extraction, classification, formatting).
3. **A large model** for planning and ambiguity.

The platform does not assume a split; it measures it. Run the same tasks on each tier (Haiku 5.5 is the smallest and cheapest hosted Claude; truly local open-weight models connect as route 4 over MCP) and compare quality, safe rate and cost per correct answer. A router that sends each step to the cheapest tier that clears the quality bar is a later feature and needs per-step measurements the harness does not yet make.

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

1. Resource estimate end to end (done in the harness on synthetic tasks, with fixture agents; the model runner is built). Next: supply an API key, run a real model over MCP, and record the first honest scorecard with its intervals whatever it shows.
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
