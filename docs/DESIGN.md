# Scorcher design system (November 2026)

Three styles, decided by the owner in November 2026:

| Style | Products | Look |
|---|---|---|
| **Play** | The race (`/`), Evolve (`/evolve`), Your Sky, Your Tree | The race's own editorial plate |
| **Science** | Scorcher Sky (`/sky`), Scorcher Tree (`/tree`), Scorcher Tools (`/tools`) | Built above all for usefulness |
| **Build** | Scorcher Build | A separate brand; mockup only: `mockups/suite/build.html` |

The owner likes the existing logo and the race's structure, so **Play keeps the race's identity** rather than adopting the Atkinson mockup. `mockups/suite/play.html` is superseded by the live race and Evolve. The Scorcher wordmark (EB Garamond, with a red italic "er") and the five-dot mark (cold to hot) sit on every Play and Science page. Science pages pair the wordmark with a product name: Sky, Tree or Tools.

## Rules for all three

These follow the impeccable craft floor and the owner's brief: minimal, beautiful, sharp edges, not generic.

- **No all-caps, no spaced capitals.** Labels are sentence case.
- **No italics for emphasis.** Italics stay only for:
  - the wordmark's "er"
  - the race's target article and Evolve's answer (Play)
  - scientific names and titles of works (convention)
- **Square corners.** Exceptions:
  - round photo thumbnails of species
  - round dots that stand for stars or species
- **Headings:** one idea, short, in sentence case.
- **Monospace only for data:** numbers, coordinates, ages, code.
- **Honest material.** Every value is labelled; illustrative and planned things say so. Evidence colours never change between pages:

  | Label | Colour |
  |---|---|
  | Published | #1f7a48 |
  | Derived | #2457d6 |
  | Modelled | #9a6a08 |
  | Illustrative | #7a4bb8 |

  Sky, on its dark field, uses lighter tints of the same four.
- **One authored motion per view,** with `prefers-reduced-motion` honoured.

## Play

**Fonts**

| Role | Font |
|---|---|
| Display and reading | EB Garamond |
| Interface | Jost, 13–15 px, weight 500, sentence case, normal tracking |
| Numbers | IBM Plex Mono |

**Colour**
- Warm paper #f3eee4, with sheets #fbf8f1 and ink #16130f.
- Accent: vermilion #d63a1f.
- The temperature scale (#2a4f8a → #5c8cbe → #d6be8c → #f08c50 → #d63a1f) is Play's signature: the logo dots, the race's warmer and colder, and the age of each ancestor in Evolve.

**Structure**
- The race's plate: start above target, one "Play today's puzzle" line, the prize scale, and modes as numbered rows.
- Mode titles are upright serif.

**How it's built**
- In the race, a final "Refine" layer at the end of `styles.css` removes the spaced capitals, decorative italics and rounded corners from the older layers. It uses `:root:not(#_)` so it outranks their `!important` rules.
- Share images (canvas) are sentence case too.
- Evolve (`evolve.html`) carries the same tokens in its own small stylesheet.
- Dark mode follows the race's setting.

## Science

**Fonts:** Atkinson Hyperlegible Next (with its italic, for scientific names) and Atkinson Hyperlegible Mono, from the Braille Institute. They were chosen for legibility for learners, and the slashed zero is part of the design. They are self-hosted in `fonts/` under SIL OFL.

**Colour**

| Page | Background |
|---|---|
| Tree and Tools | light ground #fbfbf9, panels #fff, sunk areas #f1f2ef, ink #121417 |
| Sky | keeps its dark field (its subject is the night sky) |

**Utility**
- Search on every page.
- Tools listed by task.
- Every output shows its value, label and method on one row.
- Worked answers are revealed step by step.
- Pages say how to cite them.
- Sky, Tree and Tools link to one another in the bar.

**Files**
- `sky.css` ends with a Science override layer.
- `tree.css` and `tree-app.js` use Atkinson throughout, including the canvas, where clade and period labels are sentence case.
- `science.css` is the stylesheet for `/tools`.

## Build

The Build brand is in `mockups/suite/build.html`:

| | |
|---|---|
| Type | Mona Sans (with its width axis) and Geist Mono |
| Ground | cool #f3f4f1 |
| Field colour | #1d3aa8, with #b8142f as the seismic polarity pair |
| Highlight | signal #e4ff3a |

Build never uses the temperature scale. It uses the evidence colours only in its reports.

## Mockups

`mockups/suite/` holds the November concepts:
- `landing.html`: the suite page, which would live at `/suite`
- `science.html`: the origin of `/tools`
- `play.html`: superseded
- `build.html`

The suite page still shows the Atkinson family for Play. Before it goes live, it should switch to the race's plate style described above.
