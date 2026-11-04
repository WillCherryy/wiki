# Scorcher design system (suite, November 2026)

The system behind `mockups/suite/landing.html` and `mockups/suite/build.html`, to be carried into the live Race, Sky and Tree. Guided by the impeccable craft floor and the UI/UX Pro Max checklist; the owner's brief: minimal and brilliant, sharp edges, modern, innovative, clean, not generic, cool typography; no all-caps subheadings, no overuse of italics, short headings.

## Principles

- **Prove, don't claim.** The first viewport demonstrates the mechanism: the evidence labels inside a real sentence (suite), an agent's pick on a seismic section (Build).
- **One idea per heading,** eight words or fewer, sentence case, a full stop when it is a statement. No eyebrow or kicker labels above headings, ever.
- **No italics for emphasis.** Emphasis comes from weight, size or colour. Italics stay only where convention needs them (species names, titles of works).
- **No all-caps** for labels or headings. Small labels are sentence case.
- **Sharp edges:** border radius 0 everywhere (buttons, inputs, panels, images, tags).
- **Colour owns whole regions.** Each product has one field colour that fills its section; accents are not sprinkled.
- **One authored motion per page** (the trace wipe on Build, the screen wipe on the suite page), exponential ease-out, content visible by default, `prefers-reduced-motion` honoured.
- **Data looks like data:** monospace with tabular figures only for numbers, code, file names and measurements; never as a "technical" costume.
- **Honest material:** generated visuals and synthetic examples are labelled as such where a visitor could mistake them for real data. No invented prices, customers or capabilities.

## Type

| Role | Face | Setting |
|---|---|---|
| Display | Mona Sans | weight 640–660, width 118–122 %, tracking −0.035 to −0.04 em, line height 0.92–0.96, `text-wrap: balance` |
| Section heading | Mona Sans | weight 620, width 112 %, tracking −0.03 em |
| Item heading | Mona Sans | weight 600–620, width 110 % |
| Body | Mona Sans | 17 px, weight 400, width 100 %, line height 1.55, measure 40–52 ch, `text-wrap: pretty` |
| Data, code, captions | Geist Mono | 12–15 px, tabular figures |

Both faces are self-hosted (SIL Open Font License): `mockups/suite/fonts/`. Mona Sans is variable in width as well as weight; the width axis is the signature (wide for display, normal for reading).

## Colour

| Token | Value | Use |
|---|---|---|
| ground | #f3f4f1 | page (cool, not cream) |
| ink | #0d0f0e | text, primary buttons, rules at 16 % |
| race | #e8401c | the race's field |
| sky | #0b1234 | the sky's field (Scorcher Sky itself stays dark) |
| tree | #1d4a2c | the tree's field |
| build | #1d3aa8 | Build's field; with #b8142f, the seismic polarity pair |
| signal | #e4ff3a | the one highlight: focus of attention on dark fields, the key plan's button, selection |
| published / derived / modelled / illustrative | #1f7a48 / #2b5aa0 / #9a6a08 / #7a4bb8 | the evidence labels, everywhere the same |

Light ground for the suite and Build (people evaluating at desks in daylight); dark only where the subject is the night sky.

## Components

- **Buttons:** 52 px (40 px in the bar), square, 1.5 px border; one primary per view (ink, or the field's light colour on a field); hover fills with the field colour or the signal.
- **Inputs:** square cells sharing 1.5 px rules, label above value in sentence case.
- **Rows instead of cards:** indexes and lists are full-width rows with hairline rules; a row fills with its colour on hover.
- **Tables:** right-aligned tabular figures, hairline rules, the recommended row tinted, never zebra-striped.
- **Evidence label:** a small square swatch plus the word; inline in prose as a coloured underline and a small tag, with the source on hover or focus.
- **Browser surfaces:** themed selection (ink on signal), square scrollbar, 2 px focus ring offset 3 px.

## Carrying it into the live apps (next)

- Race: replace small tracked capitals and italic display serif in headings with the type roles above; square the remaining rounded corners.
- Sky: keep its dark field; swap the italic Garamond names in the inspector and the capitalised eyebrows for Mona Sans; evidence tags as above.
- Tree: the paper ground becomes the cool ground; species names stay italic (convention); clade labels in sentence case instead of spaced capitals.
