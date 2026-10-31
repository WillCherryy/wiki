# Scorcher Tree: data and evidence rules

Scorcher Tree is a **selected** tree: a curated set of species, placed by the published synthesis of evolutionary relationships, with every age and every support value traceable to a paper. These rules are enforced by `tools/check-tree.js`, which runs in `npm test`.

## Files

| File | What it is | Edited by |
|---|---|---|
| `tree/species.json` | The curated selection: scientific name, common name, group | Hand |
| `tree/draft-topology.nwk` | A conservative fallback topology, used only when the Open Tree of Life cannot be reached. Debated or unchecked splits are left as polytomies. | Hand |
| `tree/nodes/<node-id>.json` | One evidence record per node: relationship and age evidence, each value with a citation | Hand (reviews) |
| `tree/citations.json` | Every cited work: DOI, authors, year, title, and whether the DOI was verified | Hand + `--verify` |
| `treedata/vertebrates.json` | The built dataset the explorer loads | `tools/build-tree.js` only |

Build: `node tools/build-tree.js [--otol] [--images] [--verify]`. Without flags it uses the draft topology and the local records only. Check: `node tools/check-tree.js` (add `--strict` before a public release).

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
  relationship: { status, note?, support?: [ { metric, value, data, cite } ], competing?: [ { name, summary, cite } ] },
  age: { fossilMin?:  { ma, ± , taxon, formation, dating, cite },
         softMax?:    { ma, basis, cite },
         clock?:      [ { lo, mid?, hi, method, data, cite } ],
         display:     { lo, hi, mid?, source } | null },
  review: "reviewed" | null }
```

- **relationship.status** is one of `resolved` (no serious competing hypothesis in recent literature), `debated` (named competing hypotheses, listed under `competing`), `unresolved` (a published polytomy: the data cannot yet decide), or `pending` (not yet reviewed here: a draft polytomy means *we* have not resolved it, not that science has not).
- **support** values are copied exactly as published (bootstrap, posterior probability, gene concordance…) with the metric named. No support value is ever computed or estimated here.
- **age** keeps three kinds of evidence apart and never merges them:
  - `fossilMin`: the oldest accepted fossil of the group gives a **minimum** age.
  - `softMax`: absence from older, well-sampled rocks gives a **soft maximum**.
  - `clock`: molecular-clock estimates, each a published interval from one study.
- **display** is what the explorer draws. Its `source` says where it came from:
  - `review`: chosen by a reviewed node's evidence review; `lo`/`hi` must equal one of the node's published clock intervals or its fossil/maximum bounds.
  - `calibration`: a published fossil calibration bracket, from the node's own `fossilMin` to its `softMax` (a constraint on the age, not an estimate of it; the tree places the node at the minimum).
  - `synthesis`: one published synthesis interval (for a node not yet reviewed in depth), with its citation in `clock`.
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

## Status of the age evidence (first pass)

Eleven branch points carry fossil evidence, all from Benton et al. 2015 (doi:10.26879/424) except Sauria (Ezcurra, Scheyer & Butler 2014, doi:10.1371/journal.pone.0089165). The sandbox could not open the papers or Crossref, so each value was confirmed only against an index of the paper (its Zenodo treatment records, the Fossil Calibration Database, or a table citing it); each record's `checked` field says which. Every citation is therefore `verified: false` until `--verify` runs and a reviewer checks the number against the paper.

To check first:
- **Amniota (318–332.9 Ma):** a 2025 analysis reportedly places *Hylonomus* outside crown Amniota; if accepted, the minimum needs another fossil.
- **Theria (156.3–169.6 Ma), Rodentia (56–66 Ma), Catarrhini (24.44–33.9 Ma):** add the fossil taxa and formations.
- **Placentalia (soft maximum 164.6 Ma):** taken from a secondary table and based on *Juramaia*, whose Jurassic age is disputed.
- **Primates (≥ 56 Ma), Hominidae (≥ 11.6 Ma):** from a secondary table; confirm in the paper.
- No molecular-clock estimates yet: add published intervals (e.g. from TimeTree 5 and primary studies) once the sources can be reached.
