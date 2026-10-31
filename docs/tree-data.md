# Scorcher Tree: data and evidence rules

Scorcher Tree is a **selected** tree: a curated set of species, placed by the published synthesis of evolutionary relationships, with every age and every support value traceable to a paper. These rules are enforced by `tools/check-tree.js`, which runs in `npm test`.

## Files

| File | What it is | Edited by |
|---|---|---|
| `tree/species.json` | The curated selection: scientific name, common name, group | Hand |
| `tree/draft-topology.nwk` | A conservative fallback topology, used only when the Open Tree of Life cannot be reached. Debated or unchecked splits are left as polytomies. | Hand |
| `tree/nodes/<node-id>.json` | One evidence record per node: relationship and age evidence, each value with a citation | Hand (reviews) |
| `tree/citations.json` | Every cited work: DOI, authors, year, title, and whether the DOI was verified | Hand + `--verify` |
| `tree/timetree.json` | TimeTree 5 node ages for every branch point, cached with the clade each was checked against | `tools/fetch-timetree.js` only |
| `tree/images.json` | Hand-chosen Commons photos for species whose Wikidata image cannot be used (licence or credit), with the reason | Hand |
| `treedata/vertebrates.json` | The built dataset the explorer loads | `tools/build-tree.js` only |

Build: `node tools/build-tree.js [--otol] [--images] [--verify]`. Without flags it uses the draft topology and the local records only. Check: `node tools/check-tree.js` (add `--strict` before a public release). Refresh TimeTree: `node tools/fetch-timetree.js` (about four minutes; it is rate-limited on purpose).

### Topology from the Open Tree

`--otol` matches every name with the Open Tree TNRS (exact matches only) and takes the induced subtree of the synthesis. Tips are mapped back by OTT id, never by label text, because OTT unique names can carry a disambiguator (*Gadus morhua* is "Gadus morhua (species in domain Eukaryota)"). A taxon that is not monophyletic in the synthesis ("broken"; at present *Tyto alba*, after the split of the barn owls) comes back as the MRCA node it is placed at, and is mapped to its species. Single-child nodes, one per named rank along each path, are collapsed: the innermost name labels the node (it is the true MRCA of the selected species in the full tree; outer names are kept as `aliases`).

### Photos

`--images` takes each species' Wikidata image (P18, preferring a "preferred"-rank statement), or the file named in `tree/images.json`, and reads its licence and credit from Commons. It keeps only CC0, public domain, CC BY and CC BY-SA, rejects anything flagged non-free, and stores the author (`artist`) and, when the licensor asks for a specific attribution text, that text (`credit`), which the explorer shows instead. A CC BY or CC BY-SA photo whose author is unknown is replaced through `tree/images.json`, since the attribution it requires cannot be given.

## The built dataset

```
{ version, section, built, status: "draft" | "built", topology: { source, version },
  taxa:  { <taxonId>: { sci, common, group, ott?, wikidata?, image?: { thumb, page, artist, licence, licenceUrl } } },
  tree:  { id, children: [ ... ] }          // a tip is { id: <taxonId> }
  nodes: { <nodeId>: NodeRecord },
  citations: { <key>: { doi, authors, year, title, journal, verified } } }
```

### NodeRecord

```
{ name, common?, blurb?,
  mrca: [ species, ... ],      // the record attaches to the MRCA of these species on whatever topology is built
  exact?: true,                // attach only if that MRCA's species are exactly these (for clades a draft polytomy lacks)
  relationship: { status, note?, support?: [ { metric, value, data, cite } ], competing?: [ { name, summary, cite } ] },
  age: { fossilMin?:  { ma, taxon, formation, dating, cite, checked, note? },
         softMax?:    { ma, basis, cite, checked },
         challenge?:  { taxon, formation, dating, cite, checked, note },   // published evidence against the calibration, kept beside it, not merged
         clock?:      [ { lo, mid?, hi, method, data, cite, checked?, note?, studies?, adjusted? } ],
         display:     { lo, hi, mid?, source } | null },
  review: "reviewed" | null }
```

`checked` says exactly where the value was read (paper, table or section, node number). Clock intervals keep the kind their study published: a 95% HPD or credibility interval for a single study; for TimeTree, the confidence interval of the median across studies (`studies` says how many), which summarises the literature and is not a date uncertainty. `adjusted` is TimeTree's own age adjusted so that no node is older than its parent, kept for reference when it differs from the median.

- **relationship.status** is one of `resolved` (no serious competing hypothesis in recent literature), `debated` (named competing hypotheses, listed under `competing`), `unresolved` (a published polytomy: the data cannot yet decide), or `pending` (not yet reviewed here: a draft polytomy means *we* have not resolved it, not that science has not).
- **support** values are copied exactly as published (bootstrap, posterior probability, gene concordance…) with the metric named. No support value is ever computed or estimated here.
- **age** keeps three kinds of evidence apart and never merges them:
  - `fossilMin`: the oldest accepted fossil of the group gives a **minimum** age.
  - `softMax`: absence from older, well-sampled rocks gives a **soft maximum**.
  - `clock`: molecular-clock estimates, each a published interval from one study.
- **display** is what the explorer draws. Its `source` says where it came from:
  - `review`: chosen by a reviewed node's evidence review; `lo`/`hi` must equal one of the node's published clock intervals or its fossil/maximum bounds.
  - `calibration`: a published fossil calibration bracket, from the node's own `fossilMin` to its `softMax` (a constraint on the age, not an estimate of it; the tree places the node at the minimum).
  - `synthesis`: one published clock interval (for a node not yet reviewed in depth), with its citation in `clock`. A record chooses it explicitly, preferring a primary study whose sampling spans the node; a node without one shows its TimeTree interval, added by the build. Within a lineage the same study is used where possible, so that ages from different calibration schemes are not stacked.
  - `bounded`: no published estimate; the build derives only the bracket implied by dated neighbours (at least as old as its oldest dated descendant, no older than its dated parent). No midpoint is ever drawn for a bounded node.

## Rules

1. **No number without a citation.** Every `ma`, `lo`, `hi`, `mid` and support `value` has a `cite` key that exists in `citations.json`. Strict mode also requires the citation's DOI to be verified against Crossref.
2. **Never invent a date or a confidence value.** `display` for `review` and `synthesis` nodes must come from the node's own published records; `bounded` intervals are derived by the build, never typed in.
3. **Intervals are ordered**: `lo ≤ mid ≤ hi`, all positive, in millions of years before present (Ma).
4. **Time runs one way**: no node's displayed interval may lie entirely before its parent's (a child cannot be older than its ancestor). A conflict is reported, not silently fixed.
5. **A fossil minimum is a floor**: a node's displayed `hi` must not be younger than its own `fossilMin` (a strict-mode error; a warning in draft).
6. **Unresolved stays unresolved**: a node with more than two children must have status `unresolved` or `pending`.
7. **Debates are named**: a `debated` node lists at least two competing hypotheses.
8. **Images are freely licensed and credited**: only CC0, public domain, CC BY and CC BY-SA, with artist and licence stored.

## Review workflow (per node)

1. Collect the primary papers: the phylogenomic studies for the relationship; the fossil calibration (specimen, formation, radiometric or biostratigraphic dating); clock studies with their published intervals.
2. Write `tree/nodes/<id>.json` with each value and its citation key; add each work to `citations.json` with its DOI.
3. `node tools/build-tree.js --verify`: every DOI resolves and its title and year match.
4. A second person checks each number against the paper and sets `review: "reviewed"`.

## Status of the age evidence (second pass, October 2026)

Every number below was read in the paper itself (full text from the publisher, Palaeontologia Electronica, PLOS or Europe PMC), and each record's `checked` field names the table, section or node. All eight cited DOIs resolve on Crossref with matching titles and years (`--verify`). No node is yet `reviewed`: that needs a second person.

**Fossil calibrations (Benton et al. 2015, doi:10.26879/424; Sauria from Ezcurra, Scheyer & Butler 2014)**

| Node | Minimum | Soft max | Fossil, formation | Change |
|---|---|---|---|---|
| Amniota | 318 | 332.9 | *Hylonomus lyelli*, Joggins Fm, Nova Scotia | Confirmed. The first pass said a 2025 study places *Hylonomus* outside crown Amniota: wrong. That study (Long et al. 2025, *Nature*) treats *Hylonomus* as a crown amniote; it reports crown-amniote trackways from the Snowy Plains Fm, Victoria, probably 358.9–354 Ma, which would raise the minimum above this soft maximum. Recorded as a `challenge`, not merged. |
| Mammalia | 164.9 | 201.5 | *Ambondro mahabo*, upper Isalo "Group", Madagascar | Confirmed; formation corrected. |
| Theria | 156.3 | 169.6 | *Juramaia sinensis*, Tiaojishan Fm, Liaoning | Taxon and formation added. |
| Placentalia | **61.6** | 164.6 | *Ravenictis krausei*, Ravenscrag Fm, Saskatchewan | Minimum was missing. The soft maximum rests on *Juramaia* as the oldest eutherian; the first pass's "disputed Jurassic age" is not in the paper and was removed. |
| Rodentia | 56 | 66 | *Paramys atavus*, Fort Union Fm, Montana | Taxon and formation added. |
| Primates | 56 | **66** | *Altiatlasius koulchii*, Adrar Mgorn 1, Morocco | Confirmed in the paper; soft maximum added. |
| Catarrhini | 24.44 | **34.0** | *Rukwapithecus fleaglei*, Nsungwe Fm, Tanzania | Soft maximum was 33.9: the paper gives 34.0 (33.9 ± 0.1). |
| Hominidae | 11.6 | **33.9** | *Sivapithecus indicus*, Chinji Fm, Pakistan | Confirmed in the paper; soft maximum added. |
| Homo–Pan | 6.5 | **10** | *Sahelanthropus tchadensis*, Toros-Menalla, Chad | Soft maximum added. |
| Sauria | 254.7 | **269.3** | *Protorosaurus speneri*, Kupferschiefer, Zechstein Group, Germany | Taxon, formation and the paper's maximum (*Lanthanolania*) added. |

**Molecular clocks from primary papers (mean or median, 95% interval)**

- *Tarver et al. 2016* (doi:10.1093/gbe/evv261), Table 6: Theria 163.92 (156.67–169.79), Placentalia 92.96 (86.43–99.91), and 23 further mammal nodes. The first pass's rounded abstract values were replaced with the table's. Mapped by the table's node structure: our "Artiodactyla" (pig, cattle, whales) is their node 54 "Pig/Cow", 58.62 (56.92–60.23), because their node 53 also contains a lineage outside pig + cow. Their root (Mammalia) is not used: its calibration is one the authors themselves rerun.
- *Claramunt & Cracraft 2015* (doi:10.1126/sciadv.1501005): crown birds, median **96.6** (84.2–114.3), genomic data set. The first pass had 95, the abstract's rounding.
- *Stiller et al. 2024* (doi:10.1038/s41586-024-07323-1): Neoaves as sampled here (Columbaves vs the rest) 66.5 (65.2–67.9).
- *Irisarri et al. 2017* (doi:10.1038/s41559-017-0240-5), Supplementary Table 9, genome-wide estimates (calibration C16; conservative credibility intervals): Chondrichthyes, Sarcopterygii, Rhipidistia, Tetrapoda, Lissamphibia, Amniota, Sauria, Lepidosauria, Archosauria. Only rows the table labels are used; its mammal and bird rows (sparse sampling) are not.
- *Homo–Pan:* Tarver et al. 8.94 (7.51–10.10), a phylogenomic node age: it dates sequence divergence, which precedes the population split. Moorjani et al. 2016 is still not used.

**TimeTree 5** (Kumar et al. 2022, doi:10.1093/molbev/msac174): 83 of the 90 branch points on the Open Tree topology. Seven are left out: three where TimeTree's clade differs from ours (the order of Scrotifera's lineages, early Neoaves, and the Open Tree's placement of the whale shark with the hammerhead), three that need a species TimeTree lacks with no clean stand-in (*Neoceratodus*, *Phascolarctos*, *Orycteropus*), and one dated by a single study. Nine species are absent from TimeTree as species; six are queried by the lowest TimeTree taxon that contains them and none of their nearby selected relatives (for example *Myxine glutinosa* by Myxinidae), and the record says so.

Still to do:
- Fossil calibrations for the remaining nodes: Benton et al. 2015 covers most of them (Vertebrata through Neoaves).
- Intervals for the ray-finned fishes from Hughes et al. 2018 (PNAS): its supplementary tables could not be downloaded here; the main text gives only a mean (about 379 Ma for crown Actinopterygii).
- Displayed midpoints from different studies can sit slightly above their parent's (three TimeTree medians do). The explorer never draws a node older than its parent; the published interval bars are unchanged.
- Floors on undated nodes come only from fossil minimums (hard constraints), never from the low end of a clock interval.
