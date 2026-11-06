"""Expert review kit: everything an outside engineer needs to judge a pack, in one document, and the record their verdict goes into.

    python -m earthbench.review_kit welltest          # writes earthbench/reviews/kits/welltest.md

Send the kit to a practising engineer in the field. Their answers go in earthbench/reviews/<pack>.json (the template is at the end of
the kit). Nothing is recorded as reviewed until a real person has reviewed it; the dashboard shows "not yet reviewed" until then.
"""
from __future__ import annotations
import json
import os
import sys
from .run import pack
from .export import ABOUT

HERE = os.path.dirname(__file__)
REVIEWS = os.path.join(HERE, "reviews")

QUESTIONS = [
    "Is the method the one a competent practitioner would use for these tasks? What would you do differently?",
    "Are the engine and its validation sound? Is anything missing from the validation?",
    "Are the answer keys right? Check at least three of the sample tasks below by your own method.",
    "Are the tolerances fair: would you accept an answer just inside them, and reject one just outside?",
    "Are the data defects realistic? Which common real-world problems are missing?",
    "Are the briefs realistic? Is any brief ambiguous, so that two competent people could reasonably disagree?",
    "Do the physical checks (no answer key) hold up? Could any of them flag a correct answer?",
    "What would make this pack representative of real work in your field?",
]


def _val(v):
    if isinstance(v, float):
        return f"{v:.4g}"
    return json.dumps(v) if isinstance(v, (list, dict)) else str(v)


def kit(name, n=6):
    P = pack(name)
    a = ABOUT.get(name, {"title": name})
    tasks = P.suite("main")
    pick = [tasks[i * len(tasks) // n] for i in range(n)]
    out = [f"# Expert review: {a['title']}", "",
           f"Scorcher Build tests AI agents on engineering tasks with known answers. This pack has {len(tasks)} tasks in its main suite, "
           f"and the same number held out; each is generated from a seed, so every number below can be reproduced.", "",
           "## What the pack tests", "", (P.__doc__ or "").strip(), "",
           "## Engine", "", a.get("engine", ""), "", "**Validation.** " + a.get("validated", ""), "",
           "## Key-free physical checks", ""] + [f"- {x}" for x in a.get("physics", [])] + ["",
           "**Counts as unsafe:** " + a.get("unsafe", "policy breaches"), "",
           "## Sample tasks", "", "Each with its brief, the documents and data the agent sees, and the answer key.", ""]
    for t in pick:
        k = P.key(t)
        out += [f"### {t.id}", "", f"Brief level {t.spec}; data defect: {t.defect}.", "", "> " + t.statement.replace("\n", "\n> "), ""]
        for dn, txt in t.docs.items():
            lines = txt.strip().splitlines()
            body = lines[:25] + ([f"... ({len(lines) - 25} more lines)"] if len(lines) > 25 else [])
            out += [f"`{dn}`:", "", "> " + "\n> ".join(body), ""]
        for dn, v in t.data.items():
            if hasattr(v, "dtype") and v.dtype.names:
                cols = list(v.dtype.names)
                out += [f"`{dn}`: {v.shape[0]} rows, columns {', '.join(cols)}. First rows:", "", "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
                out += ["| " + " | ".join(_val(r[c].item() if hasattr(r[c], 'item') else r[c]) for c in cols) + " |" for r in v[:5]] + [""]
        out += ["**Answer key:** " + ", ".join(f"{f} = {_val(k[f])}" for f in k if not hasattr(k[f], "shape")), "",
                "**Tolerances:** " + ", ".join(f"{f}: {tol if tol is not None else 'exact / see text'}" for f, (_, _, tol) in t.answer_fields.items()), ""]
    out += ["## Questions", ""] + [f"{i}. {q}" for i, q in enumerate(QUESTIONS, 1)] + ["",
            "## Your verdict", "", f"Please fill this in. It is published with your name in `earthbench/reviews/{name}.json` only with your written permission.", "",
            "```json", json.dumps({"pack": name, "reviewer": "", "role_and_organisation": "", "years_in_the_field": None, "date": "YYYY-MM-DD",
                                   "tasks_checked_by_own_method": [], "verdict": "sound | sound with changes | not sound", "findings": [], "permission_to_publish_name": False}, indent=1), "```", ""]
    return "\n".join(out)


def status(name):
    p = os.path.join(REVIEWS, f"{name}.json")
    if not os.path.exists(p):
        return {"reviewed": False, "reviews": []}
    r = json.load(open(p))
    r = r if isinstance(r, list) else [r]
    return {"reviewed": any(x.get("reviewer") and x.get("date") for x in r),
            "reviews": [{"reviewer": x["reviewer"] if x.get("permission_to_publish_name") else "named on request", "role": x.get("role_and_organisation", ""),
                         "date": x.get("date"), "verdict": x.get("verdict")} for x in r if x.get("reviewer")]}


def main(argv=None):
    a = argv or sys.argv[1:]
    if not a:
        print(__doc__); return 2
    os.makedirs(os.path.join(REVIEWS, "kits"), exist_ok=True)
    for name in a:
        p = os.path.join(REVIEWS, "kits", f"{name}.md")
        open(p, "w").write(kit(name))
        print("wrote", os.path.relpath(p))
    return 0


if __name__ == "__main__":
    sys.exit(main())
