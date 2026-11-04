# Scorcher suite: scope for the landing page, applied-science agents, APIs and the Tree's next sections

Status: **scoping, nothing here is built** (November 2026). Read with `docs/PLATFORM.md`.

**Owner decisions (November 2026):**
- The daily race stays the first page (`/`). The suite landing page is a **mockup only** for now (`mockups/suite/landing.html`, would live at `/suite`), to be integrated later.
- Build's first users: **energy companies** wanting to learn whether agentic AI can automate parts of their work. Offered as a paid **pilot** that measures an agent against their current process. Scorcher will also ship its own agents later.
- **Engineering** is a research question, not yet a product: run trials to find where LLM agents genuinely help engineers, and publish what works and what does not.
- **Paid tiers:** Trial (one workflow, fixed fee), Subscribe (per agent, monthly), On premises (annual); prices set with the first pilots.
- **Build's offer (refined):** companies buy a trial in which they test **their own agents**, **Scorcher's agents** (if they have none), or both side by side, on 40–100 tasks drawn from their own work, measured against their current process (tasks completed, time, cost per task, failures a person had to fix). If it is worth their time, they **subscribe** to run Scorcher's agents in production. Start with **smaller companies**, using LLMs and small language models (SLMs, which can run on their own hardware) to connect to **legacy technology** (desktop applications without APIs, industry file formats, historian and SCADA exports, documents) and automate tasks. Domains: **QGIS and geospatial processing, seismic data and imaging, data analysis, drilling engineering software, solar and wind**. Agents connect over an API or the Model Context Protocol.
- Build's interface: `mockups/suite/build.html`, rebuilt to the system in `docs/DESIGN.md` (a live synthetic seismic section with the agent's pick, the page as a borehole with a depth rail, photographs revealed as shifting seismic traces, a labelled example comparison report). Frames in `mockups/suite/frames/`, scroll recordings in `mockups/suite/video/`, photo credits in `mockups/suite/img/credits.json`.

**Vision (owner):** Scorcher should simultaneously *inspire people* and *be a highly useful science and research tool*. The same honesty rules run through everything: every number has a source; measured, derived, modelled and illustrative are labelled; nothing is invented.

## 1. The suite

| Strand | Products | For | State |
|---|---|---|---|
| **Play** | Wiki race (daily), Your Sky (collection), evolution game, Your Tree | General public | Race and Your Sky live; game and Your Tree not built |
| **Explore** | Scorcher Sky (`/sky`), Scorcher Tree (`/tree`) | Students, researchers, schools | Both live |
| **Build** (new) | Agentic platforms: Solar, Wind, Geothermal, Engineering | Engineers, developers, students, councils, community energy groups | Scoping (section 3) |
| **Learn** | Demosthenes Academy links | Students | Later |
| **Data** | Public Scorcher API | Developers, researchers, teachers | Scoping (section 4) |

## 2. Landing page

**Job:** in ten seconds, show what Scorcher is (a suite that inspires and is genuinely useful), route each visitor to the right product, and earn trust with the honesty that sets it apart.

**Audiences and their first click:** players → today's race; curious public → Sky or Tree; students and researchers → Sky, Tree, the data; engineers and energy professionals → Build; developers → API.

**Sections (top to bottom):**
1. **Hero:** one line of vision (draft: "Explore the universe, life and the planet's energy, with every number traced to its source"), a live visual (the real sky rendering, or the tree), and two calls to action: *Play today's race* and *Explore*.
2. **Explore:** Sky and Tree side by side, each with a live preview (canvas, not a screenshot), three facts that prove depth (for example "992,000 real stars · 15,000 galaxies · every value labelled"), and one example deep link.
3. **Play:** the daily race (today's start and target), Your Sky, the evolution game marked *coming*.
4. **Build:** Solar, Wind, Geothermal, Engineering, each with the question it answers and a *coming / private beta* label. No claims about capability until each exists.
5. **How we handle evidence:** the four labels (Published, Derived, Modelled, Illustrative), with one worked example. This is the differentiator; it belongs on the front page.
6. **For schools and researchers:** citations, data sources, the API, Demosthenes Academy (later).
7. **Footer:** sources and credits, privacy, terms, contact.

**Routing (decided):** the race stays at `/`; the suite page would live at `/suite`, linked from the race's header and footer.

**Design:** Scorcher's editorial identity (EB Garamond, Jost, IBM Plex Mono; paper for Tree and Build, night for Sky). Fast: previews load lazily, the hero works without them. Accessible: keyboard, contrast, reduced motion. Phone first for the race; desktop shown well for the tools.

**Domain:** `playscorcher.com` undersells Explore and Build (see `PLATFORM.md`). The landing page is the moment to decide; paths make a later move a redirect.

## 3. Build: agentic applied-science platforms

**What "agentic" means here:** a Claude-based agent (via the Claude API, tool use) that turns a plain-language question into a sequence of tool calls: fetch site data from authoritative sources, run established open-source calculation engines, check results against limits, and write a report in which every number carries its source and label. The agent plans and explains; **the numbers come from the tools, never from the model.**

**Common architecture (build once, reuse four times):**
- *Tools:* data fetchers (each returning value, units, source, licence, retrieval date), calculators (deterministic, unit-tested, version-pinned), a report writer.
- *Provenance:* the Sky/Tree labelling extended to engineering: measured (site data), modelled (simulation), assumed (user input or default), with every assumption listed and editable.
- *Guardrails:* refuse or flag out-of-scope requests; never present output as certified design; physical-plausibility checks on every result; a human-readable audit trail of every tool call.
- *Runtime:* calculations in a Python service (the engines below are Python), called from the Cloudflare Worker; agent orchestration server-side with keys in secrets; per-user rate limits and cost caps; results cached.
- *Accounts:* this is the first part of Scorcher that needs sign-in (saved projects, usage limits, billing).

| Platform | First question it answers | Authoritative data (check licences) | Open calculation engines |
|---|---|---|---|
| **Solar** | "What would a PV system on this roof or site produce, and what would it pay back?" | PVGIS (EU JRC), NREL NSRDB / PVWatts API, NASA POWER, Copernicus ERA5 | pvlib-python (Sandia/open source) |
| **Wind** | "What is the wind resource and likely yield at this site, and for which turbine class?" | Global Wind Atlas (DTU/World Bank), NREL WIND Toolkit, ERA5, NASA POWER | windpowerlib, PyWake (DTU) for wakes |
| **Geothermal** | "Is ground-source or deep geothermal plausible here, and roughly what output?" | Global Heat Flow Database (IHFC), national surveys (BGS UK, USGS, ThermoGIS NL) | GEOPHIRES (NREL, open source); borehole heat exchanger models |
| **Engineering** | Needs narrowing. Candidates: structural sizing checks, thermal or energy balance, materials selection | Material property databases, standards (licensing is often restrictive) | Domain-specific; decide after the first three |

**MVP:** Solar pre-feasibility for one site: inputs (location, roof area, tilt, orientation, shading notes, tariff), outputs (annual and monthly yield with uncertainty, payback range, a cited PDF report). It has the best open data and the most mature engine, and the clearest public value. Then Wind, then Geothermal. "Engineering" stays undefined until a specific user and question are chosen.

**Risks to manage:** professional liability (pre-feasibility only, stated plainly; no design sign-off); data licences (some datasets forbid redistribution or commercial use); accuracy (validate each engine against published reference cases before launch); cost (agent and API calls per report; cap and cache); regulation (UK and EU consumer-advice rules for financial projections; GDPR for saved sites).

**Fit with the vision:** *inspire* (a site's sunlight or wind made visible, using the Sky's rendering skills) and *useful* (a defensible, sourced pre-feasibility report).

## 4. APIs

**Outbound (Scorcher calling others):** the data sources above, plus those Sky and Tree already use (Gaia, HEASARC, ATNF, Open Tree, TimeTree, Wikidata/Commons, Crossref). Rule: fetch at build time where possible (as now); live calls only where data is site-specific (Build), cached, with keys in Worker secrets.

**Inbound (a public Scorcher API):** read-only JSON for Sky objects, catalogue stars (by id or position), Tree nodes (topology, ages with citations, evidence), and later Build reports. Every response carries sources, labels and licence. Constraints: HYG is CC BY-SA (share-alike passes to API output), Gaia needs its acknowledgement, Commons images keep their individual licences. Versioned (`/api/v1/`), rate-limited, keys for heavy use. Start with Tree nodes and Sky objects; it is cheap because the data is already built.

## 5. Should Your Sky include the 15,000 galaxies?

**Recommendation: not as collectables; yes as an optional context layer, later.** Your Sky's meaning is *what you earned*; 15,000 galaxies most players never see in a game would bury the collection. But a "Show the full sky" switch (off by default, same engine as Scorcher Sky, galaxies faint and not collectable) gives context cheaply, and the new *Scorcher Sky ↗* link on every object covers the full view now. Build the switch only if players ask for it.

## 6. Scorcher Tree: expansions

**Where it stands:** 91 vertebrates on the Open Tree topology, ages on 84 of 90 branch points (10 fossil calibrations read in the papers, clocks from primary studies and TimeTree 5), photos for all, 8 verified DOIs, no node yet reviewed by a person.

**Expansion options, in recommended order:**
1. **Finish vertebrates properly:** cite the competing hypotheses (strict mode passes), evidence reviews for 15 major nodes with human sign-off, widen to about 300 species where the data is good (more mammals, birds, fishes).
2. **Early life and the whole tree of life:** the root (LUCA), Bacteria, Archaea, the origin of eukaryotes, with the early-life evidence panels from the original brief: cyanobacterial microfossils, stromatolites (contested), the Great Oxidation Event as a minimum for oxygenic photosynthesis, kept apart from clock estimates. Needs a log time axis (4 Gyr to today).
3. **Plants and fungi:** land plants (mosses to flowering plants), the colonisation of land, fungi and their relationship to animals (Opisthokonta). Good fossil calibrations exist (the Rhynie chert).
4. **Invertebrates:** arthropods, molluscs, echinoderms, the Cambrian explosion with its fossil sites (Burgess Shale, Chengjiang).
5. **Your Tree and the evolution game** (`PLATFORM.md`), once 1 and 2 give enough well-dated nodes.

**Technical:** the canvas explorer handles a few hundred tips; beyond about 1,000 it needs level-of-detail (clades drawn as summaries until opened) and data loaded by section. The evidence model and checker already scale. A Tree–Sky bridge: the geological axis could link to an "Earth through time" view (continents, atmosphere), a natural place for the inspire side.

## 7. Suggested order

1. Landing page, once the routing decision is made (`/` or `/suite`).
2. Tree: finish vertebrates (cited debates, first reviewed nodes).
3. Public API v1 (Tree nodes, Sky objects).
4. Build: Solar MVP, with the shared agent architecture.
5. Tree: early life and the whole tree of life.
6. Wind, then Geothermal; define Engineering.
7. 3D view for galaxies in Scorcher Sky (see `PLATFORM.md`).

## Decisions needed from the owner

- Domain: keep `playscorcher.com` or move to a neutral name before launch of the suite?
- Build: which energy company first, and which of its workflows (the mockup lists five candidates)?
- Engineering research: which two or three workflows to trial first, with which engineers?
- Prices for the paid tiers, once a pilot has shown the value.
