# Scorcher Build: strategy, November 2026

Written 7 November 2026 after reading the live site (build.playscorcher.com, build ddb1412) and the repository. Assumptions: one founder,
little capital, no paying customer yet, one model (Claude Haiku 5.5) run so far, and every number below taken from the repository's own
results. Where the brief's premises are weak, this memo says so.

## Summary of decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Positioning | The independent test house for AI agents doing physical-world engineering: physics decides whether an agent's numbers are right and its behaviour safe. |
| 2 | Be best in the world at | Discriminating tasks with verified keys: tasks a careful engineer passes, weak agents fail, and whose answer key has itself been checked against something outside the code. |
| 3 | Independence | Stop offering "Scorcher's agent" as a product. Keep a reference baseline whose prompt and code are published and which is labelled as a baseline, never sold. |
| 4 | Moat | In order: private held-out sets on real data; a trap library with measured discrimination; a longitudinal, hash-chained record of agent versions; one auditor or insurer that co-signs the method. Code is not a moat. |
| 5 | Wedge | Subsurface and geothermal (well tests, resource estimates, the documents around them), sold first to vendors of energy agents who need third-party evidence to close sales, with one operator as design partner. |
| 6 | Regulation | Treat the EU AI Act as a later tailwind, not the reason to buy now (see section 5). |
| 7 | Stop now | Compliance-mapping language, "Both, side by side", the saturated 40/40 GIS headline as proof, and "real earth-science work" in the hero. |
| 8 | Kill criteria | No task tier that separates models by 25 points or more by end of Q2 2027; fewer than two paid pilots by end of Q3 2027. |

## 1. Positioning

One sentence: **Scorcher measures whether an AI agent's engineering answers are right and its behaviour safe, using the physics engines
engineers already trust, and keeps the record.**

The one thing to be best at is **task design that discriminates**. Everything else (engines, MCP plumbing, hash chains) is open source
or easy to copy. A benchmark is only valuable if it separates agents, and today it does not: Haiku passes 93% of current tasks
(88 to 97%, cluster bootstrap), the hard GIS set is saturated (Haiku and the scripted pipeline both 40/40), and TerraBench, a June 2026
academic benchmark on earth-system data, reports over 84% of agents' numerical answers outside tolerance. The difference is not that
Scorcher's agents are better; it is that Scorcher's tools do most of the method for them. The fix is less scaffolding, judgement
the brief does not settle, abstention, rate histories, and real data, which have started (the harder well tests, the PVGIS pack) but
have not been run with a model.

## 2. Independence

Options: (a) drop our own agent; (b) keep it behind strict structural separation; (c) a published reference baseline.

**Choose (c), which is (a) for the market.** No agent is sold. A baseline agent stays, because every result needs a comparison, but its
prompt, tools and code are public, it is labelled "reference baseline", and it is scored on the same footing as everyone else.
Structural separation (b) is what large firms do with Chinese walls; a one-person company cannot make that credible.

What it costs: the "no agent yet? use ours" onboarding path, any revenue from selling agents, and the demo in which our agent does well.
It is worth it, because a test house that sells the thing it tests has no product.

## 3. The moat

What compounds, in order of how hard it is to copy:

1. **Private held-out sets on real data.** Generated tasks protect the instance, not the distribution: anyone can run the public
   generator. Real worlds (field well tests, real seismic, real block models, real weather) with private keys cannot be regenerated.
   Candidates with public data whose licences need checking: Utah FORGE (geothermal, DOE Geothermal Data Repository), Equinor Volve
   (seismic, logs, production), MineLib (already used), PVGIS (already used).
2. **A trap library with measured discrimination.** Each trap kept with the evidence that it separates agents (pass rates by model,
   repeats, the failure it causes). This is what competitors would have to rediscover.
3. **The longitudinal record.** Every agent version, every run, hash-chained. It cannot be produced after the fact, and regressions
   between versions are exactly what buyers want.
4. **Accepted method.** One auditor, insurer or standards body that co-signs the method. This is slow and the single biggest
   multiplier of trust.

Not a moat: the engines, the MCP server, the scoring code. Publish the graders; keep the held-out sets private.

## 4. Vision

**Five years:** the crash-test house for autonomous engineering agents. A vendor cannot sell an agent into a utility, an operator or a
consultancy without a Scorcher rating for the work it will do, re-tested on every version, and insurers price cover from it. That is
plausible only if (i) agents do real engineering at volume, (ii) a failure becomes expensive enough for buyers to demand evidence, and
(iii) Scorcher's method is the one an auditor or insurer accepts. None is certain.

**Twelve months, sober:** one discipline (subsurface and geothermal) where Scorcher's tests separate agents, on at least one real-data
world; graders open and a public leaderboard of at least three models with repeats; two or three paid pilots; one named expert review
and one auditor or insurer conversation that has produced written feedback on the evidence pack.

## 5. Customers and wedge

**The regulatory premise is weaker than the brief assumes.** The EU's Digital Omnibus on AI (Regulation (EU) 2026/1744, in force
27 July 2026) moved the Annex III high-risk obligations from 2 August 2026 to 2 December 2027. More importantly, most of Scorcher's
tasks are not high-risk under Annex III at all: its critical-infrastructure entry covers safety components in the management and
operation of utilities, not a geothermal resource estimate or a site screen. ISO/IEC 42001 certifies a management system, not
accuracy, which is a real gap, but nobody is yet obliged to fill it. Regulation is a later tailwind, not the reason to buy now.

Who pays first, and for what:

| Buyer | Buys | Why now | Price logic (hypotheses to test) |
|---|---|---|---|
| Vendors of energy and engineering agents | An independent evaluation report on their agent for the work they sell; re-tests per release | Enterprise buyers ask for evidence; a third-party report shortens sales | Fixed-fee evaluation per agent and discipline, then a subscription per release; anchored to the cost of the deal it unblocks |
| Operators and consultancies choosing an agent | A bake-off of shortlisted agents on their kind of task, their data kept private | Procurement due diligence, and liability if the agent is wrong | Fixed-fee pilot; anchored to a few engineer-weeks of review |
| AI labs and environment buyers | Training environments with verifiable rewards in engineering | They pay now | Per environment; only separate training sets, never the held-out ones |
| Insurers, regulators | Later | When claims or rules make evidence necessary | Partnership, not revenue, in year one |

Lab revenue is the easiest cash and the biggest threat to independence. Allow it only with a hard rule: held-out sets are never sold
or trained on.

## 6. Twelve-month roadmap

| Quarter | Work | Measurable milestone |
|---|---|---|
| Q4 2026 (to Feb 2027) | Drop "Scorcher's agent"; fix the site's claims; run Haiku and one frontier model, with repeats, on the harder well tests and the real-weather pack; open the grader code | A tier where the scripted analyst passes 100% and the gap between a small and a frontier model is measured with a 95% cluster-bootstrap interval |
| Q1 2027 | Discriminating tier across three disciplines; first real-data world in the wedge (a field well test or real logs) | Spread of at least 25 points between two models, interval excluding zero; one real-data world with a key reviewed by an engineer |
| Q2 2027 | Public reproducible leaderboard (three or more models, repeats, clustered intervals); external red team of the graders and traps | Leaderboard reproducible from a clean checkout; red-team findings published with fixes |
| Q3 2027 | Two named expert reviews; evidence pack revised with an auditor's or insurer's written feedback; two or three paid pilots | Signed pilots; written feedback that names what is and is not accepted as evidence |

## 7. Risks, indicators and kill criteria

| Risk | Leading indicator | Kill or pivot criterion |
|---|---|---|
| Tasks do not discriminate | A frontier model above 85% on each new tier | No tier with a 25-point spread by end of Q2 2027: pivot to selling training environments |
| No buyer pays for evaluation | Pilot conversations end at "interesting" | Fewer than two paid pilots by end of Q3 2027 |
| A key is wrong in public | External findings against an engine | Any unfixed key error found by an outsider: stop publishing that pack until it is fixed |
| A well-funded entrant (Scale, Mercor, an environment start-up) builds engineering tasks | Their announcements in energy | Respond by partnering or supplying, not competing on volume |
| One-person bandwidth | Roadmap milestones slipping a quarter | Bring in a co-founder or narrow to the wedge only |

## 8. Stop doing or claiming now

- "Reports map the evidence to NIST AI RMF, ISO/IEC 42001 and the EU AI Act": no auditor has accepted any of it. Say what the record
  contains and that its use as evidence is untested.
- "Bring your agent or use ours" and "Both, side by side": see section 2.
- The 40/40 hard GIS figure as a headline: it shows saturation, not quality.
- "Real earth-science and energy work" in the hero: one pack of 31 tasks has real inputs; the rest are synthetic.
- "Lawful to use": Scorcher cannot establish lawfulness.
- Inconsistent counts: the hero lists seven workflows while the page claims nine disciplines and the table lists eleven packs.
  Use one list everywhere.

## Decisions taken (7 November 2026)

The owner's answers to the five decisions below:
1. **Drop "Scorcher's agent": yes.** Done in the app, the landing page, the console and the docs. A published reference baseline (Claude Haiku, public prompt and tools) stays as a comparison and is labelled as one.
2. **Wedge: subsurface and geothermal.** The hard tier is built there first (well tests); other disciplines follow.
3. **First customers: vendors of energy agents.** Pricing now reads: an evaluation (one agent, one discipline, fixed fee), a re-test per release (subscription), and private tasks built from a customer's work. No prices are set before the first pilots.
4. **Open grader code, private held-out sets:** not yet answered; the hard tier is public, and its private counterpart is the next item.
5. **Budget for two models with repeats and two expert reviews:** yes. Not yet spent; the commands are in earthbench/README.md.

The hard tier (suite `hard`, 27 well-test tasks, brief H1) is the answer to "make the tasks much harder". It removes every well-test routine: the agent gets a calculator, column maths, a derivative and a straight-line fit, and must choose the method. It adds gauge noise, a three-step rate history, a constant-pressure boundary and a boundary-type answer. What it has **not** yet shown is that it separates models: no model has been run on it. The scripted analyst passes 27 of 27, the textbook recipe 8 of 27, the naive pipeline none; those prove the tasks are solvable and the traps bite, not that a language model fails them. The first measurement, Haiku and a stronger model with repeats, decides whether this tier meets the kill criterion in section 7.

## The five decisions that were put to the owner

1. **Drop "Scorcher's agent" as a product and keep a published baseline?** Recommended: yes.
2. **Wedge discipline:** subsurface and geothermal (recommended: Scorcher's strongest engines, a hard well-test tier already built, and
   no competing benchmark) or renewables (larger market, more competition).
3. **First customer segment:** agent vendors in energy (recommended: faster sales, they need the report) or operators and consultancies.
4. **Open the grader code under an open licence, keep held-out sets private?** Recommended: yes. Note that the hazard pack runs
   OpenQuake (AGPL-3.0), which sets terms for a hosted service.
5. **Budget for the next measurement:** a small fixed amount of API credit for two models with repeats on the new tiers, and paid days
   for two named expert reviewers. Recommended: yes, before any more building.

Sources: Regulation (EU) 2026/1744 summaries (artificialintelligenceact.eu, Technology.org, 13 October 2026); TerraBench,
arXiv:2606.13148 (June 2026); repository results (earthbench/results, gisbench/results).
