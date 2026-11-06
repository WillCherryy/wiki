# Scorcher: scope and vision

November 2026. This is the company-level picture. The detail lives in the documents it points to: `PLATFORM.md` (the public site), `SUITE.md` (suite scope), `BUILD-ARCHITECTURE.md`, `BUILD-SECURITY.md`, `RESEARCH-AGENTIC-ENGINEERING.md` and `gisbench/README.md`. Anything below marked *planned* or *proposed* does not exist yet.

## In one paragraph

Companies are being sold AI agents for technical work: mapping, interpreting data, estimating resources, preparing reports. Almost none of those agents comes with evidence that it does the job correctly, safely and for a sensible cost. Scorcher provides that evidence. **Scorcher Build** is a testing environment where a company runs an agent (its own, a vendor's or Scorcher's) on tasks drawn from its own work, and gets back a measured answer: how often the agent is right, whether it worked the right way, what it cost, and where it fails. Scorcher also offers **its own agents and tools** for the Earth sciences, built and published to the same standard: GIS and QGIS, solar, wind, geothermal, seismic interpretation, seismic hazard and mining.

## Why this matters

- **Agents fail in ways a demo hides.** In our first benchmark, most "agent errors" were unstated conventions in the brief, misleading tool descriptions and hand-typed data (`gisbench/README.md`). In real work, these are exactly where an agent and an analyst quietly disagree. Finding them is worth more than a pass rate.
- **Safety cannot be assumed.** An instruction planted in a data file can tell an agent to leak a secret. An agent can deliver land inside a protected-area buffer while every reported number looks plausible. Only a scorer that checks both catches these.
- **Cost and quality trade off.** A small model may be enough for routine tasks, and a large one may be needed only where the small one fails. Measuring this per task class saves real money.
- **Free tools already claim to "do GIS with AI".** Several QGIS plugins connect assistants to QGIS, and siting platforms sell AI screening. None that we found publishes how often it is right. Measurement is the gap.

## Principles

1. **Measured, not claimed.** No capability is advertised until a benchmark shows it, with the interval and the number of tasks stated.
2. **Numbers come from tools, not from the model.** The agent plans, calls established engines and explains. Every figure in a report carries its source and its label: measured, derived, modelled or illustrative.
3. **Correct and safe, or it fails.** A task passes only if the answer is within tolerance *and* no rule was broken. Strict and partial scores are both reported.
4. **Independent checks.** Answer keys are cross-checked against independent software (QGIS and GDAL for GIS), and the scripted ceiling must pass every task before a benchmark is used.
5. **Honest limits in plain view.** Every page and report states what the result does and does not show.
6. **Security by design, claimed narrowly.** We say exactly what is enforced and what is not (`BUILD-SECURITY.md`).
7. **Fair pricing.** Customers see the cost of every run. They pay for measurement and for agents that work, not for tokens spent on failures.
8. **Beautiful, clear and teachable.** The interface is calm and precise, and every tool has a tutorial that teaches the underlying science, not just the buttons.

## What Scorcher offers

### 1. Scorcher Build: agent testing environments (the core)

A customer brings tasks from their own work, or uses Scorcher's benchmark suites, and connects an agent. Scorcher runs it in a sandbox with typed tools and scores every run.

**What a trial measures**

| Question | Measure |
|---|---|
| Does it complete the task? | Pass rate (strict: all checks and safe) with a 95% interval; partial score |
| Does it do it the right way? | Full tool trace with arguments; data checks performed; conventions followed; assumptions stated |
| Is it safe? | Policy violations (restricted reads, tools outside the allowlist, leaked secrets); hard violations in the output (for example land inside a protected buffer); the prompt-injection suite |
| Is it efficient? | Tool calls, refused calls, time per task *(timing planned)* |
| Is it cost-effective? | Cost per task and cost per *passed* task, against the customer's current process |
| Is it better than what they have now? | Paired comparison with a scripted pipeline or the analyst's process on the same tasks (exact McNemar test) |

**The deliverable:** a report and a console. The report covers results with intervals, every failure with its cause, the conventions the agent and the analysts disagreed on, the safety findings and the cost. In the console, the customer opens any task to see the brief, the agent's steps, its map or answer against the reference, and the checks. The **Agent runs** view at `/build/console#runs` is the first version of this.

**How agents connect:** over the Model Context Protocol (MCP, over HTTP or stdio), so any agent framework can be tested. Scorcher's own model runner covers Claude models today.

### 2. Scorcher agents

Agents Scorcher builds, benchmarks and publishes, for companies with no agent of their own. Each agent ships with its benchmark results, the tasks it was tested on, its known failure modes and its cost per task. They run inside the same sandbox and checks as the trials, so a customer can run Scorcher's agent and their own side by side. Small and open models are tested too, because many firms need agents that run on their own hardware.

### 3. The Earth-science suite

Each domain is a *pack*: tools wrapping established open engines, task generators or customer tasks, graders with independent reference answers, a dashboard and tutorials.

| Domain | Example tasks | Engines and data | Grading | State |
|---|---|---|---|---|
| **GIS and QGIS** | Site screening from a written brief; reprojection and repair of dirty data; constraint mapping from planning documents; cable corridors; parcel statistics | GDAL-style stack today; PyQGIS tool layer next | Deterministic key, cross-checked against QGIS 3.34 | Benchmark built (180 tasks, versions 1 to 4); Haiku runs complete; PyQGIS *planned next* |
| **Solar** | Screening, yield with uncertainty, pre-feasibility report | pvlib; PVGIS, NASA POWER, ERA5 | Reference cases; yield labelled as an upper bound where clear-sky | Clear-sky yield in gisbench; full pre-feasibility *planned* |
| **Wind** | Capacity factor from wind data; visibility and setback screening | Open wind and terrain data; QGIS viewshed | Reference cases | *Planned* |
| **Geothermal** | Heat-in-place with P90/P50/P10; well-test (Horner) analysis; parameters extracted from well reports | Scorcher's Monte Carlo and well tools (tested against closed forms) | Reference answers, interval agreement | Tools built and tested; end-to-end tasks *planned* |
| **Seismic interpretation** | SEG-Y quality checks; horizon picking orchestrated through dedicated methods and checked | segyio and open picking methods; open surveys (licences to check) | Agent picks against two human interpreters, their own spread as the pass mark | Pick comparison built; SEG-Y reading and real sections *planned* |
| **Seismic hazard** | Set up and run probabilistic hazard jobs; check hazard curves, maps and spectra against reference cases; explain limits | OpenQuake engine (GEM Foundation; licence to be confirmed, believed AGPL-3.0) | The engine's own demo and test cases with known results | *Proposed*: a small pilot after PyQGIS |
| **Mining** | Grade and tonnage above a cut-off from block models; later pit limits | Scorcher's table tools; exact solvers for pit limits | Exact answers; optimality gap | Grade-tonnage suite built on synthetic data |

OpenQuake computes the probability of different levels of shaking at a site over a period, and the expected losses. It does not predict earthquakes, and nothing Scorcher publishes will say it does. Hazard results are modelled values; design use needs a qualified engineer.

**Brand.** Every domain sits inside Build, under one promise: agents you can measure. New domains launch only once benchmarked, so breadth never outruns rigour.

### 4. The public site: Play and Science

The race, Scorcher Sky, Scorcher Tree and the tools are the public face, and they prove the same values on a smaller scale: accurate science, honest labels and careful design (`PLATFORM.md`). The three visual styles keep them distinct: Play, Science and Build (`DESIGN.md`).

## Quality and rigour

- **Benchmarks are versioned.** Any change to a brief or a tool description gets a new version, older results keep their label, and the README records why it changed.
- **Development and held-out tasks are separated.** Prompts are tuned on one set of seeds and reported on another.
- **Every benchmark has a scripted ceiling** that must pass every task, plus fixture policies that reproduce known failure modes to prove the scorer catches them.
- **Statistics:** Wilson intervals, paired tests and stated power. Results from 20 tasks are labelled as wide.
- **Failures are diagnosed**, not just counted. Each failure is traced to the brief, the tools, the data or the agent.

## Security

What exists today, in the harness and backend: a file sandbox; a tool allowlist; spend caps; an egress filter; a hash-chained audit trail of every call; canary secrets; and a prompt-injection benchmark. What is not built, and not claimed, is listed in `BUILD-SECURITY.md`. Proposed policy: customer data stays in the customer's trial and is never used to train models. Proposed offerings: on-premises runs for sensitive data, and small models on the customer's own hardware.

## Interface and tutorials

- **One console**, with one dashboard per task type: GIS map against key, seismic section with picks, resource-estimate distributions, well data and documents. Every number is labelled, and every chart shows uncertainty.
- **Tutorials** for each domain, at two levels. *Using it*: connecting an agent, writing a task, reading a report. *The science*: why slope comes from a Horn kernel, what P90 means, why hazard is not prediction. The tutorials follow the same standard as the educational content on the public site: rigorous, worked examples, of a good difficulty.
- **Built to the house standards:** fast, accessible (keyboard, contrast, reduced motion) and readable on a phone.

## Backend and architecture

- **Harness** (`harness/`, JavaScript): tool gateway, trace, grading, statistics, MCP.
- **Backend** (`backend/`, TypeScript Cloudflare Worker): one Durable Object per trial, D1 and R2 storage, a model proxy.
- **Python services** for the engines (GDAL and rasterio, pvlib, segyio, QGIS and OpenQuake), called from the Worker.
- **Planned:** accounts and organisations; per-user storage and uploads; persistent run history; a real-time console; and billing. Accounts come before any outside customer uses it. Billing comes when a pilot customer wants to pay.

## Pricing (proposed)

Three tiers, already outlined in `SUITE.md`; prices are set with the first pilots, and none are stated yet.

| Tier | What it is |
|---|---|
| **Trial** | A fixed fee for one workflow: 40 to 100 of the customer's tasks, their agent and/or Scorcher's, a report and a review call |
| **Subscribe** | Per agent per month to run Scorcher's agents in production, with continuous monitoring on a held-out task set |
| **On premises** | Annual licence for firms whose data cannot leave their network |

Fairness rules, proposed: published cost per task, model costs passed through at cost, no charge for runs lost to Scorcher's own faults, and the failures report included at every tier.

## Evidence so far

- **gisbench, version 3** (claude-haiku-5-5, method prompt): 20 of 20 on held-out tasks and 20 of 20 on the injection suite (95% interval 84–100%). The fixed-default pipeline passed 6 and 4 of the same tasks. About $0.009 and 27 tool calls per task.
- **The diagnosis mattered more than the score.** Version 1's failures were an unstated rasterisation convention, and version 2's were a wrong tool description. Fixing the benchmark lifted Haiku from 8 of 20 to 20 of 20.
- **The hard suite** (version 4, 40 tasks: composed briefs, units in metadata, recoded legends, hand-typed attributes) is built; model results are pending.
- **The limit:** all of this uses synthetic worlds. The claim that matters, value on a real firm's tasks, is untested.

## Roadmap

| Stage | Work | State |
|---|---|---|
| 1 | Agent quality on gisbench: diagnosis, method prompt, held-out tests, hard suite | Done to version 4; hard-suite results pending |
| 2 | PyQGIS tool layer, cross-checked against the current tools; new QGIS-only tasks | Next |
| 3 | OpenQuake pilot: a few demo cases as graded tasks | Proposed |
| 4 | Seismic: SEG-Y reading, section viewer, picks against two interpreters on open data | Planned |
| 5 | Geothermal end-to-end tasks from well reports | Planned |
| 6 | Accounts, storage, run history; then billing | Planned |
| 7 | First pilot with a real firm, on their own tasks | The most important step; to arrange |
| 8 | Solar pre-feasibility and wind packs; Scorcher agents offered for subscription | Planned |

## Risks, and what we will not claim

- **Ground truth costs expert time.** A real trial needs the customer's engineers to define what a correct answer is.
- **Synthetic results do not transfer automatically** to real data and real regulations.
- **Professional liability.** Outputs are screening and pre-feasibility only, never design sign-off. Hazard is never presented as prediction.
- **Licences.** Datasets and engines (OpenQuake, SEG-Y surveys) each need their terms checked before use in a hosted service.
- **Breadth versus depth.** Launch one domain well before the next.

## Open decisions for the owner

1. Which firm, and which of its workflows, will be the first pilot?
2. Domain name and brand: whether Build stays under playscorcher.com (`PLATFORM.md`).
3. Prices for the first Trial.
4. Whether to pursue OpenQuake once its licence is confirmed.
5. Which open seismic survey to standardise on, subject to its licence.
