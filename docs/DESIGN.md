# Scorcher design system (November 2026)

Three styles, decided by the owner in November 2026:

1. **Play**: the Wiki race, the evolution game, Your Sky and Your Tree.
2. **Science**: Scorcher Sky, Scorcher Tree and the Science tools, built above all for usefulness, with many tools for education and research.
3. **Build**: Scorcher Build, the engineering platform, a separately branded product.

Play and Science are one family (one type, one ground, one set of evidence colours); Play adds the temperature scale. Build has its own type and colour.

Mockups: `mockups/suite/play.html`, `science.html`, `landing.html` (the suite page, in the family style, with Build as a guest band) and `build.html`. The shared family stylesheet is `mockups/suite/family.css`.

## Rules for all three

These follow the impeccable craft floor and the UI/UX Pro Max checklist. The owner's brief: minimal and brilliant, sharp edges, modern, clean, not generic.

- **Prove, don't claim.** The first view shows how the thing works: the evidence labels in a real sentence (suite), a working calculator (Science), a route warming towards its target (Play), an agent's pick on a seismic section (Build).
- **Headings** carry one idea, eight words or fewer, in sentence case. No eyebrow or kicker labels.
- **No italics for emphasis** and **no all-caps**. Italics stay only where convention needs them (species names, titles of works).
- **Sharp edges.** Radius 0 everywhere.
- **One authored motion per page.** It uses an exponential ease-out, content is visible by default, and `prefers-reduced-motion` is honoured.
- **Monospace only for data:** numbers, code, coordinates, file names.
- **Honest material.** Generated visuals, example puzzles and proposed features are labelled. Never invent prices, customers or capabilities.
- **Evidence labels are the same colours everywhere:**

  | Label | Colour |
  |---|---|
  | Published | #1f7a48 |
  | Derived | #2457d6 |
  | Modelled | #9a6a08 |
  | Illustrative | #7a4bb8 |

## The family: Play and Science

| | |
|---|---|
| Type | **Atkinson Hyperlegible Next** (variable 200–800) and **Atkinson Hyperlegible Mono**, from the Braille Institute, chosen for legibility for learners. The slashed zero is part of the design and stays. Self-hosted, SIL OFL. |
| Ground | #fbfbf9 page, #ffffff panels, #f1f2ef sunk areas, ink #121417 |
| Display | weight 780–790, tracking −0.03 em, line height about 0.96 |
| Section heading | weight 760, 28–44 px |
| Body | 17 px, weight 400, line height 1.55 |
| Mark | the word Scorcher beside a square filled with the temperature scale |

**Science adds utility.**
- A global search for objects, species, coordinates and DOIs.
- A tool bench: tools listed by task, with the open tool beside them.
- The tasks: Explore, Find, Measure, Compare, Cite, Teach and Data.
- Every output shows its value, its label and its method on one row.
- Worksheets give worked answers, revealed step by step.
- A citation record and export for every value.
- Live versus planned is always stated.
- Scorcher Sky itself keeps its dark field, because its subject is the night sky.

**Play adds warmth.**
- The temperature scale: #2456c7 → #3f8fd0 → #9fbf6a → #f2b233 → #f07a1f → #e2361b. It is the race's own mechanic (the page warms as you close in) and is used for progress, the primary action and the mark.
- Larger display type for the puzzle.
- One big action.
- Earned objects, each linking to Scorcher Sky or Tree.

## Build

Build keeps the brand in `build.html`:

| | |
|---|---|
| Type | Mona Sans with a variable width axis (wide for display) and Geist Mono |
| Ground | cool #f3f4f1 |
| Field colour | #1d3aa8, with #b8142f as the seismic polarity pair |
| Highlight | signal #e4ff3a |

Build is for buyers at work. It never uses the temperature scale. It uses the evidence colours only in its reports.

## Carrying it into the live apps (next)

- **Race:** move to Atkinson and the Play tokens; remove the italic display serif and the small tracked capitals; square the corners.
- **Sky:** keep the dark field; use Atkinson in the inspector instead of italic Garamond; keep the evidence tags as above; add the Science bar and search.
- **Tree:** move to the family ground and Atkinson; species names stay italic; clade labels in sentence case.
