# Docs index (Tend, Amazon Developer Hackathon 2026)

Read in this order. The Build contract at the top of `plans/PLAN.md` overrides anything older.

| File | What it is |
|---|---|
| `plans/PLAN.md` | Master plan: Build contract, zero-spend amendment, CEO, engineering and design reviews, tasks T0-T12, schedule, final review report |
| `designs/tend-alexa-mcp-caregiver.md` | Original office-hours design doc (problem, premises, approaches). Superseded where PLAN.md differs |
| `reviews/ceo-plan.md` | CEO scope decisions (accepted, deferred, dropped) and spec-review history |
| `reviews/eng-test-plan.md` | Test plan artifact from the engineering review |
| `reviews/TODOS-snapshot.md` | Snapshot of the repo-root `TODOS.md` (the root file is the live one) |
| `demo-script.md` | Timed demo video script, also the Playwright demo test |
| `submission-checklist.md` | Every Devpost field and verification tick |
| `rules-snapshot.md` | Verbatim rule clauses the plan relies on |
| `mockups/` | Rendered UI references (`*.png`) and their HTML/CSS source |
| `../DESIGN.md` | Design tokens and rules (repo root by convention; single source) |
| `../TODOS.md` | Deferred work (live file) |

Not created yet: `spike-alexa.md` (T0 output), `FRICTION.md` (T1, root).

Screens: `docs/mockups/` are the design references; `docs/screens/` are real screenshots of the built simulator (`npm run screens`). The build adds a Send button and a "Speak alerts aloud" toggle that the mockups do not show.

`aws-integration-plan.md` is a PLAN for an optional Bedrock integration. It is **not implemented**; the Devpost answer stays "No / N/A" until its checklist is complete.
