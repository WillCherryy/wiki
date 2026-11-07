# Scorcher Build console: design brief

The console is an instrument: it runs tests and shows evidence. Restraint of Linear and Stripe, the density of a scientific workstation,
the calm of a printed paper. Nothing decorative that carries no information. Implemented in `mockups/suite/build-console.html`
(served at /build/console and build.playscorcher.com/console).

## Principles

- One primary action per screen (Run; Open result; Export). Everything else is progressive disclosure: drawers, sheets, `details`.
- Evidence first: every number links to the tasks behind it, every task to its brief, answer, key, checks and tool calls.
- Calm by default; colour and weight only for failure and safety. Status never relies on colour alone: each state has a word and a glyph.
- Keyboard first: Ctrl-K or Cmd-K opens a command palette over screens, tests, runs, tasks and actions; Escape closes; Enter opens.
- Honest provenance: three kinds of data, always labelled.
  - **Measured**: a recorded run of a real agent.
  - **Engine data**: the task's own data, computed by the engine.
  - **Simulated**: generated in the page from a seed, for demos and onboarding. It is marked on screen and in every export (the mark
    is drawn into exported PNGs and printed reports), and never enters a score, a leaderboard or an evidence pack.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #fafaf9 | #0e0f11 | page |
| surface | #ffffff | #16181b | panels |
| line | #e6e6e3 | #26292d | hairlines (1 px), no shadows |
| ink / ink-2 / ink-3 | #141619 / #50565d / #8b9198 | #ecedee / #a5abb2 / #6f757c | text |
| accent | #1d3aa8 | #8ea2ff | the primary action and focus only |
| pass | #18794e | #4cc38a | passed, verified |
| fail | #c4253c | #ff6b81 | failed, flagged |
| unsafe | #b4510c | #ff9a4d | safety violations (also marked with a triangle glyph) |
| unverified | #8a5a00 | #e0b252 | outdated, simulated, not reviewed |

Type: Mona Sans for the interface (400, 500, 600), Geist Mono for numbers, identifiers and code; tabular figures everywhere. Scale
12 / 14 / 16 / 20 / 28. Spacing on an 8-point grid (4 for tight inline gaps). Radius 6 (controls) and 8 (panels). Motion 120 to 200 ms
ease-out, removed under `prefers-reduced-motion`. Light and dark themes, following the system unless chosen.

## Components

Shell (sidebar of screens, top bar with search and theme); button (primary, secondary, quiet); segmented control; checkbox list with
counts; filter chips; data table (sortable, selectable rows, sticky header); status label (glyph and word); stat (value, interval,
label); interval bar (point and 95% interval); timeline (steps with tool, arguments, result, verdict); safety strip; side sheet; command
palette; viewer shell (title, provenance line, canvas, pan and zoom, layer toggles, legend, cursor readout, PNG export, physics checks).

## Screens

1. **Run.** Agent: a Claude model, your agent over MCP, or a pasted configuration (validated JSON). Tasks: by discipline and tier
   (counts per group), by picking individual tasks from all 953 with filters (discipline, task type, brief level, trap, suite) and
   search, or a task of your own (statement, answer fields with units and tolerances, files; validated into a task spec). A sticky bar
   shows the selection, a rough token and cost estimate, and the one action. In the static console Run starts a labelled simulation;
   the same bar gives the exact command and, where the test runs there, the web app.
2. **Live run.** One timeline of steps per task: tool calls with arguments and results, engine verdicts and physics checks resolving
   in order. The safety strip (restricted reads, leaked secrets, calls outside policy, unsafe outputs) stays visible. Replays of
   recorded runs use their real traces and are labelled as replays.
3. **Result.** Pass rate with its 95% interval, correct answers, unsafe runs, cost per solved task; breakdown by discipline and by
   brief and trap; failure taxonomy; side-by-side with the scripted baselines on the same suite.
4. **Task inspector.** The brief, the agent's answer against the key with the difference and the tolerance, the physics checks with
   their detail, the tool calls, and a viewer of the artefact (the real pressure derivative for well tests; simulated illustrations
   elsewhere, marked).
5. **Evidence pack.** The run's ledger entry and hashes, method statement, what was measured, and a table of NIST AI RMF, ISO/IEC 42001
   and EU AI Act provisions, each marked with what the record contains and that no auditor has assessed it. Printable to PDF.
6. **Compare.** Agents and baselines on shared tasks: pass rate with intervals, cost against accuracy, versions over time; empty states
   say what is missing (a second model, a second version).
7. **Viewers.** Map, seismic section, contour map, P10/P50/P90 fan, hazard curve, solar yield, wind rose and well-test derivative, from
   a seed, with controlled faults (land inside a protected buffer, a pick on the wrong polarity, a mass-balance violation, P90 above
   P10, efficiency above the Carnot limit, energy above the sunlight, a planted instruction) that the physics checks visibly catch.

## Accessibility

WCAG 2.2 AA contrast in both themes; every control reachable by keyboard with a visible focus ring; status by word and glyph, not
colour alone; sheets and the palette trap focus and close on Escape; canvases have text alternatives (the checks and readouts);
responsive to tablet width, usable on a phone.
