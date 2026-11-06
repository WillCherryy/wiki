# Expert reviews

A pack is only as credible as the people who have checked it. This folder holds the review kits sent to outside engineers and their verdicts.

- `kits/<pack>.md`: the kit for a pack: method, engine, validation, physical checks, six sample tasks with their keys, and the questions. Rebuild with `python -m earthbench.review_kit <pack>`.
- `<pack>.json`: a reviewer's verdict, in the template at the end of the kit. One object, or a list for several reviewers.

Rules:
- Only a real reviewer's own answers go here, with the date they gave them. Nothing is written on their behalf.
- Their name is published only with written permission (`permission_to_publish_name`); otherwise the dashboard shows "named on request".
- Findings are acted on, and the change is noted against the finding, with the commit.

No pack has been reviewed by an outside expert yet.
