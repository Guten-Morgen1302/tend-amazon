# Design: Tend, an Alexa+ caregiver-coordination MCP server

Status: APPROVED (office hours, Oct 9 2026), kept current with the zero-spend decision.
Mode: Builder (hackathon). Solo builder, Windows, no hardware, 0 rupees to spend.
Authority: `docs/plans/PLAN.md` (Build contract at the top) wins wherever the two differ.

## Problem
Amazon Developer Hackathon 2026, Alexa+ track. Deadline Oct 24 2026 00:30 IST (Fri Oct 23 12:00 PM PDT); internal target Oct 22 18:00 IST. Judged equally on Tech Implementation, Design, Potential Impact, Quality of the Idea. The rules call a single-turn Q&A bot or a thin API wrapper "obvious"; they call agentic workflows, state across sessions and media cards "creative".

Families coordinating care for an older relative ("did Mom take her pills?") rely on sticky notes and group chats. A voice assistant is already in the room but has no durable care state and cannot tell a caregiver anything.

## What it is
A real, spec-conformant MCP server (Streamable HTTP, protocol version 2025-11-25 or later, gated in T0) that holds care state: schedules, doses, misses, escalations. A simulated Alexa+ display and a caregiver view call it through a server-side MCP client. Live Alexa+ is unavailable to hackathon participants (user-stated), so everything Alexa+ is labeled simulated. No AI and no paid service: the parser is deterministic and messages are templates.

Demo story: the elder logs a dose; a skipped clock makes the 8:00 dose overdue; after 60 minutes of grace exactly one escalation is queued for the caregiver, once per slot even under concurrent callers; a late dose resolves it with a follow-up line instead of a second message.

## Premises (settled)
1. Alexa+ track is the best fit: hardware-free, largest prize, shippable solo.
2. The simulated Alexa+ path is delivered and allowed by the rules; the MCP server is real.
3. Eldercare coordination is a credible, specific impact story; creativity comes from durable state, idempotent escalation and typed cards, not from a model.
4. Zero spend: no AWS, no Bedrock, no LLM. AWS Builder mini challenge is not entered. Open Source mini challenge only if T12 ships.
5. How real Alexa+ renders MCP results is unknown; the card contract is ours and the simulator is the reference renderer. No claim of real Alexa+ rendering.

## Approaches
- **A (chosen): narrowest wedge.** One elder, one caregiver, one loop; 8 tools; SQLite; deterministic parser and templates; simulator with three routes. Effort M, risk low.
- B (ruled out): multi-persona platform with auth and push. Effort XL, spends the schedule on plumbing.
- C (deferred, post-submission): Fire TV elder companion. Needs another toolchain.

## Core behavior
Tools (8): `set_schedule`, `parse_schedule` (proposal only, confirm before save, versioned), `log_dose` (idempotent per slot), `whats_due`, `check_misses`, `weekly_summary`, `list_notifications`, `snooze`. Miss rule: grace 60 min, one snooze of 30 min. Escalation: check-on-call plus a 30 s simulator poll, one row per (person, item, local_date, slot_hhmm), MISSED and ESCALATED in one transaction, late dose marks it resolved. Delivery is a queued row shown in the simulator, no SMS or push. Cards: `structuredContent` with `ui` card or carousel and a `layout` hint. Security: 127.0.0.1, Origin and Host allowlists, bearer if hosted, synthetic data only, escaped rendering. Not a medical device; never gives dosing advice (guardrail on every outgoing message).

## Success criteria
- A judge runs it from the README in under 5 minutes with no accounts or keys.
- Demo video under 2:45 following `docs/demo-script.md`.
- `npm run conformance` connects the MCP Inspector, lists 8 tools and calls each.
- Guardrail and Origin/Host tests pass; at least 5 friction-log entries; submitted by Oct 22 18:00 IST.

## Distribution
Public GitHub repo, MIT license, README quick start (`npm install && npm start`). Local only; no hosting. Fallback if private: share with testing@devpost.com and the named Amazon reviewers at submission time.

## Dependencies
Free accounts only: Devpost, GitHub, YouTube. Free tools: Node >= 22.13, the MCP TypeScript SDK, MCP Inspector, vitest, Playwright.

## Assignment
Run T0 (the Day-1 spike in `docs/plans/PLAN.md`), then scaffold (T1), once the user says go.
