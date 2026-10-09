# Plan: Tend (Alexa+ caregiver-coordination MCP server)

Source of truth for intent: `docs/designs/tend-alexa-mcp-caregiver.md` (office-hours design doc, APPROVED, Oct 9 2026).
Where this plan and the design doc differ on file layout, this plan wins (for example the guardrail lives at `src/server/guardrail.ts`; Origin is checked on every browser request, and a non-browser client on loopback that sends no Origin is exempt; the product has no LLM and no AWS dependency, per the zero-spend decision).
Hackathon: Amazon Developer Hackathon 2026. Target submit: Oct 22 2026 18:00 IST (13 days after Oct 9). Hard deadline Oct 24 00:30 IST.
Working dir: `C:\Hackathons\Amazon Developer Hackathon` only. Planning stage. No code, no pushes, no sharing, no submission.
**Premise update (user-stated, Oct 9):** hackathon developers cannot connect an MCP server to a live Alexa+ instance; the official Alexa+ add-on toolkit is not available to public participants. This is the user's statement (it matches an AI-search summary the user pasted, which cited unnamed community sources and a CLI I could not confirm exists), not independently verified by this plan; what IS verified from the rules text itself is that a simulated Alexa+ web app is an allowed path, and it agrees with the rules text, which offers a simulated Alexa+ experience as an alternative path. Consequences, all applied below: (1) the delivered Alexa+ experience is the simulator, labeled as simulated everywhere; (2) the MCP server stays real and spec-conformant (Streamable HTTP, Inspector-verified, called by the simulator's MCP client), which is the Tech Implementation core; (3) no sentence in the repo, video or submission may imply a live Alexa+ connection; (4) E3 (real Alexa+ skill) is dropped, not deferred; (5) the T0 Alexa+ docs check shrinks to recording this fact and re-reading the rules wording.

## Build contract (read this first; it overrides any older section of this file)

This file holds three reviews and their history, so older sections can describe superseded choices. A builder works from this block, `DESIGN.md`, `docs/demo-script.md` and `docs/submission-checklist.md`.

| Topic | Contract |
|---|---|
| Product | Tend: a spec-conformant MCP server (Streamable HTTP, protocol version pinned to what the installed SDK reports at `initialize`, target 2025-11-25 or later) for care coordination, plus a simulated Alexa+ display. Live Alexa+ is unavailable to participants (user-stated), so everything Alexa+ is labeled simulated. |
| Processes | `tend-server` (MCP, 127.0.0.1) and `sim-host` (server-side MCP client, intent router, serves the UI). `npm start` launches both. The browser never speaks MCP. |
| Transport | Stateless Streamable HTTP with JSON responses (ER1). No session map, no session-404 path. If T0 shows the SDK cannot, fall back to stateful and restore the re-init path. |
| Tools (8) | `set_schedule`, `parse_schedule`, `log_dose`, `whats_due`, `check_misses`, `weekly_summary`, `list_notifications`, `snooze`. Tool results carry `structuredContent` (`ui`: card or carousel, `layout` hint such as week-strip) plus a text fallback. |
| Time and keys | Slot identity = (person, item, local_date, slot_hhmm), materialized once, never recomputed (ER2). One escalation per slot, UNIQUE in SQLite. MISSED and ESCALATED written in one transaction. Grace 60 min, one snooze +30 min. |
| Demo-only endpoints | Enabled only when `TEND_CLOCK=sim`, loopback, bearer-protected, absent from `tools/list`, 404 otherwise (ER3, ER22): `POST /admin/clock` with `{advance_minutes}` or `{jump_to: "next_slot"}`; `POST /admin/reset` wipes the database and re-seeds. Reset then replaying the demo script reproduces the same state. |
| Demo clock and seed | Sim clock starts Fri 08:02 (`TEND_CLOCK=sim`). Seed: Mon to Thu complete, Thu PM an earlier escalation resolved 85 min late, Fri today, Sat and Sun upcoming. `/admin/clock` in sim-host forces an immediate `check_misses` and UI refresh (no waiting for the 30 s poll). The time chip is always visible in sim mode and adds "(skipped +X)" after any skip. Snooze is reachable by utterance only. |
| Demo persona and date | Persona "Mom" (elder) and "Alex" (caregiver), fictional; demo date Fri Oct 16 2026 in the server's configured IANA zone (default Asia/Kolkata); items "Morning tablet" 8:00 AM and "Evening tablet" 9:00 PM. |
| Storage | `node:sqlite`, `engines.node >= 22.13`, WAL, `busy_timeout`; fallback `better-sqlite3`. Seed contents: 7 synthetic days, one earlier escalation resolved late, generic labels ("Morning tablet", "Evening tablet"). |
| Parsing and messages | Deterministic parser (`src/server/parser.ts`) and fixed message templates (`src/server/templates.ts`). No LLM, no network calls, no paid service. Guardrail word list in `src/server/guardrail.ts` checks every outgoing message, including echoed user text. |
| Guardrail | Word list (case-insensitive, whole words and common forms): dosage, mg, mcg, ml, units, tablets of, increase, decrease, double, stop taking, take more, take less, overdose, diagnose, diagnosis, prescribe, prescription, cure. The words dose, doses, skip and treat are deliberately NOT on the list because the product's own copy uses them ("Next dose", "Late dose logged", "No missed doses", "skipped +1 h"). It runs on EVERY outgoing text: escalation messages, spoken Alexa lines, card text and fallback text, and error messages. Test: every string in `templates.ts`, every card string in `docs/demo-script.md` and every state in `docs/mockups/states.html` passes the guardrail, so the plan's own copy can never trip it. Medication names are user input: `set_schedule` rejects a name containing a banned word with a plain message, so a name is never echoed unchecked; all echoes go through templates and the guardrail. |
| Security | 127.0.0.1 bind, Origin and Host allowlists, bearer required when hosted, synthetic data only, escaped rendering, CSP. |
| UI routes | `?view=kitchen` (elder only), `?view=care`, `?view=demo` (split on wide screens, stacked on narrow; no tab bar). Top bar and the footer "Demo, not a medical device. Synthetic data." on every route. Visual reference: `docs/mockups/*.png`; tokens and rules: `DESIGN.md`. |
| Layout of files | `scripts/probes/*` (T0 only), `src/server/{mcp,http,core,clock,guardrail}.ts` (about 20 source files in total), `src/server/tools/{schedule,dose,query}.ts`, `src/server/db/*.ts`, `src/server/{parser,templates}.ts`, `src/sim/{host.ts,ui/*}`, `src/seed/*.ts`, `schemas/card.schema.json` (emitted from Zod), `test/**` |
| Tasks | T0 to T12 below, schedule and cut order below. |
| Honesty rules | Every "Alexa+" in the repo, video and submission is labeled simulated or describes the track; the router and parser are described as deterministic (no AI); not a medical device; synthetic data. T10 and T11 verify this with a grep and a script review. |

**Zero-spend decision (user, Oct 9):** the user will spend 0 rupees and has no card. So: no AWS account, no Bedrock, no paid API of any kind, and no LLM in the product. The intent router and schedule parser are deterministic and escalation messages are templates. The AWS Builder mini challenge is not entered. Everything used is free: GitHub, YouTube, Devpost, Node, the MCP SDK, vitest, Playwright, Lexend (OFL). Mini challenge entered: Open Source only, if T12 ships.

Gate G0: no build starts until the user says so. The dated schedule below assumes G0 clears on Oct 9; every day slips by the number of days G0 is late, and Day 13 plus Oct 23 absorb up to two days.

Decision authority: the user pre-authorized auto-selecting the recommended option at every decision ("approve all scopes, auto-accept the defaults"). Ledger row D-AUTO-1 covers every row below. Where a row says "auto", that is the authority cited.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| D-AUTO-1 (user) | Autonomous mode, no build, no outward actions, work only in this dir | in force | n/a | approved | User message, this session, whole pipeline |
| M1 CEO/0E | Mode choice; greenfield, solo, 13 days to the Oct 22 target. Rule default would be EXPANSION | SELECTIVE EXPANSION (chosen) | none pending | approved | auto, D-AUTO-1; SELECTIVE chosen for the solo timeline |
| E1 CEO/0G | Voice in/out in simulator (Web Speech API) | not in scope | add | approved | auto, D-AUTO-1; E1 only, optional toggle, text always works |
| E2 CEO/0G | "Missed dose to caregiver" causal timeline screen | not in scope | add | approved | auto, D-AUTO-1; E2 only |
| E3 CEO/0G | Real Alexa+ Agent Skill manifest | not in scope | dropped: live Alexa+ toolkit unavailable to participants (user-stated) | declined | user statement Oct 9, supersedes the earlier defer; removed from TODOS.md |
| E4 CEO/0G | Fire TV elder companion | not in scope | defer | deferred | auto, D-AUTO-1; TODOS.md; post-submission only |
| E5 CEO/0G | Bee ingest | not in scope | skip | declined | auto, D-AUTO-1; no device, would risk a false track claim |
| E6 CEO/0G | Multi-caregiver routing | not in scope | defer | deferred | auto, D-AUTO-1; v1 is one caregiver |
| E7 CEO/0G | MCP Inspector conformance check in CI | not in scope | add | approved | auto, D-AUTO-1; E7 only |
| S1 Sec1 | Browser never speaks MCP; a server-side `sim-host` is the MCP client | unspecified | sim-host client | approved | auto, D-AUTO-1; Sec 1 |
| S2 Sec1 | SQLite driver for Windows | unspecified | `node:sqlite` (Node 22+), fallback better-sqlite3 | approved | auto, D-AUTO-1; eng review confirms |
| S3 Sec1/4 | Injectable clock plus "advance time" control so a miss can be shown without waiting 60 min | missing | add | approved | auto, D-AUTO-1; Sec 4 gap |
| S4 Sec2 | Parser and template failure handling | gap | unparseable or oversize input returns a clear "I didn't understand" result; a guardrail failure falls back to a template | approved | auto, D-AUTO-1; Sec 2 |
| S5 Sec3 | Escape all free-text in simulator and in every outgoing message; medication names are untrusted input | missing | add | approved | auto, D-AUTO-1; Sec 3 |
| S6 Sec3 | Audit table of every tool call (who, what, when) | missing | add | approved | auto, D-AUTO-1; Sec 3/8 |
| S7 Sec6 | Test matrix below is required scope | partial | full | approved | auto, D-AUTO-1; Sec 6 |
| S8 Sec9 | Demo-day fallback: pre-recorded video plus seeded DB snapshot; tag before recording | missing | add | approved | auto, D-AUTO-1; Sec 9 |
| S9 Sec10 | `FRICTION.md` friction log started day 1 (10% judging bonus) | missing | add | approved | auto, D-AUTO-1; Sec 10 |
| S10 Sec11 | UI scope exists; run /plan-design-review next in the planning pipeline (its output feeds T6 and T6b) | n/a | run | approved | auto, D-AUTO-1; navigation only |
| OV1 Outside F1/F2 | Track fit and Alexa+ MCP reachability | unverified | answered by the user: live connection unavailable; simulated path is the plan, MCP server stays real; T0 records this and re-reads the rules wording in `docs/spike-alexa.md` | approved | user statement Oct 9 plus D-AUTO-1 |
| OV2 Outside F6 | Node and `node:sqlite` unchecked | assumed | T0 checks Node >= 22.13 and `node:sqlite` (ER5, ER15) | approved | auto, D-AUTO-1 |
| OV3 Outside F8 | Design has no budget | named only | add T6b design polish task, 0.5d, after design review | approved | auto, D-AUTO-1 |
| OV4 Outside F7/F10/F12 | T12 orphaned; no rubric-effort map; TODOS.md missing | gap | trace T12, add rubric map, TODOS.md created | approved | auto, D-AUTO-1 |
| OV5 Outside F11 | When do pushes and public links begin | unsequenced | repo creation and first push only after the user approves, at T1 (after planning) | approved | auto, D-AUTO-1; no outward action in the planning stage |
| OV6 Outside F3/F4 | Overbuilt simulator vs Alexa console; rubber-stamp governance | n/a | F3 declined (reason below); F4 noted, M1 and OV1 got explicit scrutiny | declined/noted | auto, D-AUTO-1 |
| SP1 Spec review K1/K3/K5 | State machine, git init, Origin semantics | gap | fixed in body | approved | auto, D-AUTO-1 |
| SP2 Spec review C1-C4/F1-F3 | Schedule, cut list, friction count, capacity | gap | fixed in body | approved | auto, D-AUTO-1 |
| Approval readiness | | | | recorded below | |

## NOT in scope

Deferred (also in TODOS.md): E4 Fire TV companion; E6 multi-caregiver routing. Dropped: E3 real Alexa+ Agent Skill (live toolkit unavailable).
Rejected: E5 Bee ingest (no device; would be a false-track risk). Real push or SMS delivery. Auth and accounts beyond one bearer token. Any real patient data. Any dosing advice.

## What already exists

Nothing in this dir (empty, not a git repo). Reused externally: the official MCP TypeScript SDK (server and client, Streamable HTTP transport), MCP Inspector, `node:sqlite`, Zod, Web Speech API in the browser. No Tend code is rebuilt that an off-the-shelf piece provides.

## Dream state delta

```
CURRENT STATE              THIS PLAN                          12-MONTH IDEAL
nothing           --->     one elder, one caregiver,   --->   multi-household care graph on
                           8-tool MCP server, simulator,      real Alexa+, push to caregivers,
                           synthetic data, no AI, zero cost   clinician-reviewed schedules,
                                                              audited, consent-based sharing
```
Reversibility of this plan is high; nothing here forecloses the ideal.

---

## Section 1: Architecture Review

**Current scope:** SELECTIVE EXPANSION; baseline plus E1, E2, E7; E4, E6 deferred; E3 dropped; E5 skipped. Governing rows: M1, E1-E7 (D-AUTO-1).

```
 Browser (sim-ui, SPA)  --HTTP------>  sim-host (Node, server-side)
   voice in/out (E1)                     |  intent router: deterministic
   cards, carousel, notif panel          |  MCP client (Streamable HTTP)
   timeline (E2), time-advance (S3)      v
                                    tend-server (Node, MCP 2025-11-25)
                                      |-- tools (8) --> core (miss rule, escalation, clock)
                                      |-- parser.ts + templates.ts (deterministic)
                                      |-- guardrail (word list + schema)
                                      '-- node:sqlite (file, gitignored) + audit table
 MCP Inspector (browser/CLI) -----------^  (Origin allowlist, localhost bind, bearer if hosted)
```

Findings:
- S1: the design never said who calls the MCP server. Resolved: sim-host is a server-side MCP client and sends no `Origin` header, so it is exempt from the Origin check by design (it is a non-browser client on loopback; with a hosted server it must send the bearer). The Origin allowlist exists for browser clients, namely the MCP Inspector. A browser request carrying any other Origin is refused. Because a rebound same-origin GET can omit Origin, the server also validates the `Host` header against an allowlist (`127.0.0.1:<port>`, `localhost:<port>`) and refuses anything else. Allowed browser origins: `http://127.0.0.1:<port>` and `http://localhost:<port>` for the MCP Inspector only; the simulator's UI talks to sim-host, not to tend-server, and sim-host (a non-browser client) sends no Origin.
- S2: `better-sqlite3` needs a native build on Windows. `node:sqlite` removes that risk. Confirm in eng review.
- The intent router is a regex/keyword matcher over a small utterance set. It must be labeled in the README and video as deterministic, not an LLM or AI. This is an honesty requirement, not a gap.
- Data flow, four paths for `log_dose`: happy (slot found, row inserted, card returned); nil (no `item`: Zod rejects, tool returns `isError` with a message); empty (schedule has no items: "nothing scheduled" card, not an error); error (DB locked: retry 2x with 50 ms backoff, then `isError` with a request id).
- State machine, escalation:
```
 PENDING_SLOT --(dose logged)--------------------------> DONE
 PENDING_SLOT --(snooze, only inside grace window)------> PENDING_SLOT (grace +30 min, once)
 PENDING_SLOT --(now > slot+grace, no dose)-------------> MISSED (escalation row created, UNIQUE key)
 MISSED + ESCALATED are written in ONE transaction (the escalation row and its queued notification); MISSED is never observable alone
 snooze first runs check_misses, so a snooze after the grace window but before the lazy check hits MISSED/ESCALATED and is treated as snooze-after-escalation
 ESCALATED --(late dose logged)-------------------------> RESOLVED_LATE (follow-up line, no 2nd notification)
 ESCALATED --(snooze after escalation)------------------> SUPERSEDED (follow-up line)
 SUPERSEDED --(late dose logged)-----------------------> RESOLVED_LATE (follow-up line)
 Invalid: RESOLVED_LATE -> ESCALATED; snooze when no grace window remains and no escalation exists; a second snooze; snooze on a DONE or RESOLVED_LATE slot (rejected with a clear message)

          (blocked by UNIQUE(person, item, local_date, slot_hhmm) plus a status guard in the transition function, ER2)
```
- Single points of failure: one process, one SQLite file. Acceptable for a demo. Rollback if broken: `git checkout <tag>`; seconds.
- Scaling: irrelevant at this scale; the first thing to break at 100x is the 30 s poll. Not a goal.
- Security architecture: see Section 3.
- Elegance (SELECTIVE): the card contract (`structuredContent` schema) is designed so that a renderer could consume it. Nothing here claims real Alexa+ rendering; the simulator is the reference renderer.

Decision gate: S1, S2 applied (rows above).

## Section 2: Error & Rescue Map

Implementation-ready at capability level (exact classes named in the eng review).

```
 CODEPATH               | WHAT CAN GO WRONG                  | ERROR CLASS
 -----------------------|------------------------------------|------------------------
 Tool input             | missing/wrong-type/oversize field  | ZodError
 log_dose               | duplicate for same slot            | idempotent no-op (not an error)
 SQLite access          | locked, disk full, corrupt file    | SqliteBusy / SqliteIo
 clock/timezone         | invalid IANA zone, DST gap/overlap | InvalidTimezone
 check_misses           | concurrent callers, same slot      | UNIQUE violation (expected, swallowed by design)
                        | guardrail rejects (dosing words)   | GuardrailReject
 MCP transport          | bad Origin, missing bearer (hosted) | 403 / 401
                        | (sessions: none under stateless transport, ER1; row returns only if T0 forces stateful) | n/a
 sim-host               | tend-server down                    | UpstreamUnavailable
 Web Speech API (E1)    | unsupported browser, mic denied     | feature-detect, hide mic

 ERROR CLASS        | RESCUED? | RESCUE ACTION                                   | USER SEES
 -------------------|----------|-------------------------------------------------|------------------------------
 ZodError           | Y        | tool returns isError + field message            | "I didn't catch the item name"
 SqliteBusy         | Y        | retry 2x, 50 ms backoff, then isError + req id  | "Try again" card
 SqliteIo           | Y        | log, isError, no crash                          | "Storage problem" card
 InvalidTimezone    | Y        | reject at set_schedule                          | validation message
 GuardrailReject    | Y        | template message used, event logged             | normal result
 Origin/401         | Y        | refuse, log                                     | client error
 Session 404 (only if stateful fallback) | Y | sim-host reinitializes once        | transparent
 UpstreamUnavailable| Y        | simulator banner                                | "Tend is offline" banner
```
No catch-all handlers. Parser input is length-limited and unparseable input returns a clear "I didn't understand" result, never a guess.

## Section 3: Security & Threat Model

| Threat | Likelihood | Impact | Mitigated? |
|---|---|---|---|
| DNS rebinding / cross-origin calls to localhost MCP | Med | Med | Yes: 127.0.0.1 bind, Origin allowlist and Host-header allowlist |
| Hosted without auth | Low | High | Yes: refuses to start without bearer env var |
| Stored XSS via medication name rendered in simulator | Med | Med | S5: render with textContent / escaped templates, CSP header |
| Dosing or advice text reaching a message (for example echoed from a medication name) | Med | High (health) | Guardrail word list on every outgoing message; templates only; test with a poisoned medication name |
| Real patient data entered by a judge | Low | High | README banner, seed-only data, UI footer "Demo, not a medical device" |
| Secrets (bearer token) committed | Med | High | `.env` gitignored, gitleaks/redact scan before any push (pre-push hook), `.env.example` only |
| Dependency risk | Low | Med | Few deps, lockfile committed, `npm audit` in CI |
| IDOR (person ids) | Low | Low | Single seeded household; ids validated against a fixed set |
| No audit trail | Med | Low | S6: `audit_log` table, append-only from the tool layer |

Input validation: Zod schemas with max lengths (name 80, free text 500), unicode normalization (NFC), reject control characters. Injection: parameterized SQL only. Decision gate: S5, S6 applied.

## Section 4: Data Flow & Interaction Edge Cases

```
 utterance -> VALIDATE(len, charset) -> ROUTE(intent) -> TOOL CALL -> PERSIST(sqlite) -> CARD
    |nil/empty       |too long          |no intent         |timeout        |locked          |render fails
    v                v                  v                  v               v                v
 "say again"     truncate+warn      "I can do X,Y,Z"   retry/offline     retry then err   text fallback
```

Async ordering (shared mutable state: escalation rows). Invariant: at most one escalation per (person, item, slot).
```
 Caller A (whats_due)        Caller B (poll)        Shared state
 check_misses: read slot     .                      no escalation
 .                           check_misses: read     no escalation
 INSERT escalation           .                      escalation(1)
 .                           INSERT escalation      UNIQUE violation -> ignored
```
Both completion orders end with exactly one row because the UNIQUE key, not the read-then-write, enforces the invariant. Regression test: run N concurrent `check_misses` and assert one row (and one notification).

| INTERACTION | EDGE CASE | HANDLED? | HOW |
|---|---|---|---|
| Log dose button | double click | Yes | idempotent per slot |
| Tap confirm on parsed schedule | stale proposal (schedule changed) | Gap -> fix | proposal carries a version; `set_schedule` rejects stale |
| Demo recording | wait 60 min for a miss | Gap -> S3 | injectable clock plus "advance time" |
| Weekly carousel | zero days of data | Yes | empty-state card |
| Weekly strip | 7+ items | Yes | cap 7 columns (rows below 420px), no horizontal scroll |
| DST change inside the week | slot times shift | Gap -> fix | store local time plus IANA zone, compute slots per day; DST tests |
| Notification panel | backlog of 50 | Yes | cap 20 newest, "show more" |
| Voice (E1) | mic denied/unsupported | Yes | feature-detect, text input always present |
| Server restart mid-demo | no sessions to lose (stateless, ER1); state is in SQLite | Yes | the next request just works |

## Section 5: Code Quality Review

Nothing exists yet; constraints for the build:
- Layout: `src/server/` (mcp, tools, core, db, parser, templates, guardrail), `src/sim/` (host, ui), `src/seed/`, `test/`. Tools are thin; logic lives in `core/` so tests do not need MCP.
- One time source (`clock.ts`) used everywhere; no direct `Date.now()` in `core/`.
- Flag: any function with more than 5 branches gets split (the miss-rule evaluator is the likely offender).
- Avoid over-engineering: no ORM, no DI container, no plugin system.

## Section 6: Test Review

```
 NEW THING                    | TYPE         | HAPPY            | FAILURE                      | EDGE
 miss rule                    | unit         | slot passes grace| clock before slot            | DST, midnight, tz change
 escalation idempotency       | unit+integ   | one row          | N concurrent callers         | late dose after escalation
 snooze                       | unit         | grace +30        | snooze twice (rejected)      | snooze after escalation
 set_schedule / parse_schedule| unit         | valid schedule   | bad tz, oversize, bad times, stale proposal version | unicode names, empty list
 log_dose                     | integ        | recorded         | unknown item                 | double call
 weekly_summary               | integ        | 7 day carousel   | no data                      | partial week
 list_notifications           | integ        | queued msg       | none                         | 50 backlog
 card contract                | schema test  | all tools valid  | extra/missing field          | text fallback present
 guardrail                    | unit         | clean text passes| each banned word rejected    | casing, unicode lookalikes
 MCP transport                | integ        | initialize+call  | bad Origin, bad Host, no bearer (hosted; server refuses to start) | stateless: no session path (ER1)
 MCP conformance (E7)         | CI           | Inspector CLI list+call tools | n/a             |
 sim-host intent router       | unit         | each phrase maps | unknown phrase               | empty/long input
 sim-ui                       | e2e (Playwright) | full demo script | server down banner       | voice unsupported
 seed                         | integ        | 7 days loaded    | re-run is idempotent         |
```
Pyramid: many unit on `core/`, a few integration over MCP, one e2e that is the demo script. Flakiness: all time tests use the injected clock, none sleep. "2 am Friday" test (the one test that would make shipping late at night safe): the full demo script e2e passes from a clean checkout with the default path. Hostile QA test: poisoned medication name through the parser, the templates and the UI. Chaos test: kill tend-server mid-demo; banner appears and recovery works.
Parser: a golden set of 10 cases for `parse_schedule` runs against the deterministic parser. S7 applied.

## Section 7: Performance Review

Tiny data (one household, 7-day history). Slowest path: `weekly_summary` (one query, under 20 ms). SQLite: index on `(person, item, local_date, slot_hhmm)` UNIQUE and on `(person, taken_at)`. No caching needed. The 30 s poll is a cheap read. No issues found.

## Section 8: Observability & Debuggability

- Structured JSON logs (one line per tool call: request id, tool, person, duration, outcome).
- Metrics are logs-derived; a `GET /health` returns version, clock mode, db ok.
- Debug 3 weeks later: `audit_log` plus logs reconstruct who did what.
- Alerts/dashboards: none needed for a demo. Runbook = README "Troubleshooting": port busy, Node version, bad bearer.
- Joy (SELECTIVE): E2's timeline doubles as a debugging view of the escalation chain.

## Section 9: Deployment & Rollout

Local only (decided). No migrations beyond `CREATE TABLE IF NOT EXISTS` plus a `schema_version` row. No feature flags except `TEND_CLOCK`. Rollout: tag `demo-v1` before recording. Rollback: checkout the tag. Post-run verification (first 5 minutes): `npm test`, `/health`, Inspector lists 8 tools, seed loads, demo script e2e passes. S8: keep a recorded video as the primary artifact so a judge's environment never gates the score.

## Section 10: Long-Term Trajectory

- Debt introduced: deterministic router is a stand-in; no live Alexa+ integration is possible for participants (user-stated), so the simulator is the Alexa+ surface. Testing debt: no real-device test. Documentation debt: card contract needs a schema file in the repo.
- Reversibility: 5/5. Path dependency: low. Knowledge concentration: solo, so README plus `docs/` must carry it.
- Phase 2: multi-caregiver (E6), Fire TV (E4), and a real Alexa+ skill if Amazon ever opens the toolkit. The MCP tool layer is intended to support these without changes, to be verified when attempted.
- Platform potential: the card contract could be reused by other MCP servers; unproven until a second consumer exists.
- Retrospective: E1/E2/E7 are independent of the deferred items; nothing rejected is load-bearing.
- S9: start `FRICTION.md` on day 1; every tool/SDK hiccup becomes an entry (task, steps, expected vs actual, severity, workaround, suggestion).

## Section 11: Design & UX Review (UI scope: yes, the simulator)

Information architecture: elder view (big "I took them" action, next dose card) and caregiver view (notifications, weekly carousel, timeline). The first screen must show the next due dose and the notification panel.

| FEATURE | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|---|---|---|---|---|---|
| whats_due card | skeleton | "Nothing due" | offline banner | check + next dose | some overdue |
| weekly carousel | skeleton | "No history yet" | retry | 7 cards | mixed days |
| notifications | skeleton | "All quiet" | retry | message list | read/unread |
| parse confirm | spinner | n/a | message | saved toast | edited |
| timeline (E2) | skeleton | "No misses" | retry | chain | superseded |

AI-slop risk: high if left generic. Direction (hand to design review): large type, high contrast, one accent, no gradients or card-grid sameness, touch targets 48px+ (64px on the elder surface), keyboard navigable, ARIA live region for notifications. `DESIGN.md` now exists at the repo root. Journey arc: calm routine, then one clear nudge, then reassurance. Responsive: simulator is desktop-first with a phone-width caregiver view. The design review has since run (S10).

## Outside Voice

Provider: Claude Code runner (`gstack-claude-code`, read-only), status completed. Native Codex was not used, per the user's standing instruction. This is an independent Claude process, not a different model family; cross-model agreement is not claimed.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | Critical | Track fit unverified | The official rules say entrants "may submit a simulated Alexa+ experience", with source and a demo. Plan keeps the real MCP server too. T0 adds a written spike to confirm. Resolved by OV1. |
| F2 | Critical | Alexa+ MCP reachability unverified | Answered by the user: not available to participants. The simulated path is the plan; the real MCP server remains. Wording stays "designed so a renderer could consume it". OV1. |
| F3 | High | Simulator is overbuilt; use the Alexa console simulator | Declined. The Alexa developer console simulates Alexa *skills*, not MCP servers with typed cards. The hackathon rules name MCP as the integration, and the simulator is the demo surface the rules allow. Cost is held to T6 (1d) plus T6b polish. |
| F4 | High | Rubber-stamp governance | Noted. M1 and OV1 are the real strategic calls and now carry explicit written reasoning. |
| F6 | High | Node 22 / `node:sqlite` unchecked | T0 verifies Node >= 22.13 before any build; fallback `better-sqlite3` verified to build on this machine in T0. OV2. |
| F7 | Medium | T12 orphaned | Traced to the Open Source mini challenge (design doc, premise 4). OV4. |
| F8 | Medium | Design not budgeted | T6b added. OV3. |
| F9 | Medium | 14 vs 13 days | Fixed. |
| F10 | Medium | No rubric-effort map | Added below. OV4. |
| F11 | Medium | Push/public-link sequencing | Added: no repo creation, push or public upload until the user approves; T1 starts after planning. Also check hackathon rules on AI-assistance disclosure at T11. OV5. |
| F12 | Low | TODOS.md missing | Created. |
| F13 | Low | Windows vs Linux CI | T9 verify step runs the matrix on both. |
| F14 | Low | Medication-domain content policy | The rules list no domain restriction; T0 re-reads the official rules for content policy and records the answer. |

OUTSIDE COVERAGE: Claude Code runner completed. Native Codex: not run by instruction. Disabled: no.

### Rubric to effort map

| Criterion | Tasks that earn it | Share of build effort |
|---|---|---|
| Tech Implementation | T2, T3, T4, T5, T9 | about 45% |
| Design | T6, T6b, T7 | about 25% |
| Potential Impact | T10, T11 (story, honesty, caregiver framing) | about 15% |
| Quality of the Idea | T3 escalation design, T4 card contract, T7 timeline | about 15% |

## Approval readiness

Approval readiness: PASS. Checked rows: D-AUTO-1, M1, E1-E7, S1-S10, OV1-OV6, SP1-SP2, each citing D-AUTO-1 (the user's autonomous authorization, this session) or the recorded outside/spec-review finding. Process note: one blanket authorization is weaker evidence than per-row answers. The two highest-stakes rows, M1 and OV1, got separate written scrutiny (rationale in the ledger and the spike task). No declined or deferred item is in accepted work. Unanswered choices: none.

## Implementation Tasks

Synthesized from this review's findings. Run with Claude Code; checkbox as you ship.

- [ ] **T0 (P1, human: ~5h / CC: n/a)** Day-1 spike (about 5h; if Day 1 overruns, items (e), (f), (j), (l) move to Day 2 first): (letters b, g, h, m are intentionally unused) (a) `node --version` >= 22.13 and `node:sqlite` works; confirm `better-sqlite3` fallback builds; (c) re-read the official rules for the simulated-Alexa+ path and for content policy on medication-related apps, and write `docs/spike-alexa.md` recording that live Alexa+ connection is unavailable to participants (user-stated Oct 9) and what the rules require of a simulation (source in the repo, working demo); (d) `git init`; (e) confirm Devpost registration, GitHub and YouTube accounts exist; (f) check whether the Alexa developer console simulator can drive an MCP server (the outside-voice F3 decline relies on it not being able to); (i) SDK capability check: installed `@modelcontextprotocol/sdk` version, `structuredContent`/`outputSchema` support, stateless Streamable HTTP with JSON responses, negotiated protocol version at `initialize` (pass/fail gate: it must be 2025-11-25 or later, otherwise stop and re-plan before building), Zod peer range; (j) confirm the Devpost deadline hour and timezone on the page; (k) path is not under OneDrive or Dropbox; (l) capture the live Devpost form fields into `docs/submission-checklist.md` (already drafted from the rules) including how the friction log and mini-challenge fields are submitted; (n) three de-risking probes, each a tiny script kept in `scripts/probes/`, which has its own `package.json` and install so T0 does not wait for T1 (T1 adopts or deletes it): (1) the SDK serves a tool over stateless Streamable HTTP with JSON responses and a client calls it; (2) a tool result with `structuredContent` round-trips and its exact shape is written into the spike file; (3) the Inspector CLI can connect, list and call headlessly on this Windows machine, and if it cannot, the SDK-client fallback for `npm run conformance` is written now. Output decides whether ER1 stays stateless.
  - Surfaced by: Outside voice F1, F2, F6, F14; spec review C1, K3; user statement on Alexa+ access
  - Files: docs/spike-alexa.md, docs/submission-checklist.md, scripts/probes/*
  - Verify: the file exists and answers (a), (c), (f); the checklist matches the live form; Node version recorded; `git status` works; account checklist ticked; the three probes pass or have a written fallback; SDK versions and protocol version recorded in the spike file
- [ ] **T1 (P1, human: ~3h / CC: ~15min)** Repo scaffold: MIT license, README stub, `.gitignore` (db, .env), `.env.example`, lockfile, `engines.node >= 22.13` (ER15), vitest and Playwright (ER7), `FRICTION.md`, `THIRD_PARTY.md` (Lexend OFL text next to the font file), a pre-push secret-scan hook (gstack-redact or gitleaks), README skeleton with placeholders (so T10 is polish, not a first draft), a test that the self-hosted Lexend file loads from a local HTML page with its OFL text readable, first commit and tag `scaffold` (S9, S8). No GitHub repo creation or push until the user approves.
  - Surfaced by: Sec 3 secrets, Sec 10 friction log
  - Files: LICENSE, README.md, .gitignore, .env.example, FRICTION.md, THIRD_PARTY.md, src/sim/ui/fonts/*, test/font.test.ts, package.json
  - Verify: fresh clone installs; secret scan is clean; OFL.txt present beside the Lexend file
- [ ] **T2 (P1, human: ~1d / CC: ~30min)** MCP server skeleton on stateless Streamable HTTP with JSON responses (ER1; stateful only if the T0 check says the SDK cannot), `/admin/clock` and `/admin/reset` dev endpoints (ER3, ER22), Inspector pinned (ER8), URLs use 127.0.0.1 (ER18), Origin allowlist and bearer-if-hosted (S1), and a local `npm run conformance` script that drives the MCP Inspector CLI to connect, list the 8 tools and call each (a connectivity and call check, not the full protocol suite; E7; CI in T9 is a bonus)
  - Surfaced by: Sec 1, Sec 3
  - Files: src/server/mcp.ts, src/server/http.ts
  - Verify: hosted mode without a bearer token refuses to start; bad Host and bad Origin both refused; `npm run conformance` passes locally; Inspector connects; bad Origin gets 403; `/admin/*` return 404 when `TEND_CLOCK` is not `sim` and `tools/list` stays at 8 (ER3); reset then replay reproduces the same state (ER22)
- [ ] **T3 (P1, human: ~1d / CC: ~30min)** Core: clock, schedule model, miss rule, escalation with UNIQUE(person, item, local_date, slot_hhmm) materialized once and never recomputed (ER2), pure `slotsForDay`/`isMissed`/`transition`, state machine (S2, S3)
  - Surfaced by: Sec 1 state machine, Sec 4 async
  - Files: src/server/core.ts, src/server/clock.ts, src/server/db/*.ts
  - Verify: unit tests incl. DST; concurrency exercised with two separate OS processes spawned with `child_process` from the vitest test (ER16) calling `check_misses` for the same slot with `busy_timeout` set and WAL on, asserting one escalation row and one notification (losers are no-ops or retried, not 'no errors'); snooze-after-grace-before-check test
- [ ] **T4 (P1, human: ~1d / CC: ~30min)** Eight tools in three files (`schedule.ts`, `dose.ts`, `query.ts`), Zod schemas with the card defined once, including a `layout` hint such as `week-strip` (DS21), and JSON Schema emitted and diffed in a test (ER6), audit log (S6), proposal version rejected when stale (`parse_schedule` returns a version, `set_schedule` rejects mismatches), check-on-call (`whats_due`, `log_dose`, `weekly_summary` run `check_misses` first), `list_notifications` mark-read, `GET /health`, structured JSON log line per tool call (request id, tool, person, duration, outcome)
  - Surfaced by: Sec 2, Sec 3
  - Files: src/server/tools/*.ts, schemas/card.schema.json
  - Verify: schema tests; Inspector call for each tool; stale-version test; check-on-call test; mark-read test; `/health` returns version, clock mode, db ok
- [ ] **T5 (P1, human: ~0.5d / CC: ~20min)** Deterministic parser and message templates (no LLM, zero spend), input length limits, and the guardrail on every outgoing message (S4, S5)
  - Surfaced by: Sec 2, Sec 3
  - Files: src/server/parser.ts, src/server/templates.ts, src/server/guardrail.ts
  - Verify: 10-case golden set for `parse_schedule` passes; unparseable and oversize input returns the clear "I didn't understand" result; poisoned medication name and each banned word are blocked by the guardrail in outgoing messages; every string in `templates.ts`, `docs/demo-script.md` and `docs/mockups/states.html` passes the guardrail
- [ ] **T6 (P1, human: ~1d / CC: ~30min)** sim-host (MCP client, intent router) and sim-ui built to the Design Review section and `DESIGN.md`: routes `?view=kitchen|care|demo` (DS19, DS34), elder panel with no cards (DS3, DS15, DS16, DS24), week strip (DS4, DS29), alert list, confirm step, demo tray plus persistent demo-time chip (DS11, DS18), 1.5 s debounce (DS26), footnotes and labels (DS13, DS27), with escaping and CSP (S1, S3, S5)
  - Surfaced by: Sec 1, Sec 4, Sec 11
  - Files: src/sim/**
  - Verify: the Playwright demo script passes from a clean checkout on the default path, minus the voice shot (T7a) and the timeline marker (T7b), plus the router case that maps "I took my morning pills" to `log_dose(Morning tablet)`; hostile test (poisoned medication name through the parser, templates and UI renders as escaped text); chaos test (kill tend-server mid-demo, banner appears, recovery works); one Playwright test per state in `docs/mockups/states.png` except voice-failed, which is verified in T7a (loading, empty, first run, offline, already logged, two overdue most-overdue-first, schedule confirm, empty alerts, partial week) plus route tests for `?view=kitchen|care|demo` and the 1.5 s debounce
- [ ] **T6b (P1, human: ~0.5d / CC: ~20min)** Design pass: implement against `DESIGN.md` and the rendered references in `docs/mockups/` (DESIGN.md already written), use the Lexend font self-hosted in T1 (verify its OFL text ships; `THIRD_PARTY.md`), then typography, spacing, motion (DS7; specified, not yet rendered), browser surfaces (DS8), responsive (DS9), shared header and anchor (DS20), 'Simulated' label (DS28), spoken overdue line (DS17), accessibility (DS10), target sizes (DS31), top bar, footer and heading (DS32)
  - Surfaced by: Outside voice F8; Sec 11; Design Review DS1-DS29
  - Files: src/sim/ui/**
  - Verify: OFL text ships with the font; contrast pairs re-measured against tokens; keyboard-only run of the demo script; Playwright a11y checks (landmarks, live regions, target sizes); reduced-motion run; run `/design-review` on the live simulator and fix findings
- [ ] **T7a (P2, human: ~0.25d / CC: ~10min)** E1 voice in/out, feature-detected plus runtime `onerror`/`onnomatch` fallback to text (ER19; Chrome or Edge for the recording)
  - Surfaced by: scope E1
  - Files: src/sim/ui/voice.ts
  - Verify: unsupported-browser path hides the mic; a stubbed failing recognizer shows a visible message and text input still works
- [ ] **T7b (P1, human: ~0.25d / CC: ~10min)** E2 missed-dose timeline screen (rail as an `<ol>` with node text, DS5, DS25)
  - Surfaced by: scope E2
  - Files: src/sim/ui/timeline.ts
  - Verify: timeline renders the chain (scheduled, clock-skipped marker, grace ended, alert sent, late dose) for the miss produced by advance-time in the demo script; the FULL demo script (voice and timeline included) passes end to end here, with `npm run conformance`
- [ ] **T8 (P1, human: ~0.5d / CC: ~15min)** Seed command with synthetic week; idempotent (Sec 4); generic medication labels such as 'Morning tablet' and 'Evening tablet', no real drug names (DS14); contents: 7 synthetic days, one earlier escalation resolved late, one clean day
  - Files: src/seed/*.ts
  - Verify: run twice, same row count; `/admin/reset` then seed reproduces identical rows
- [ ] **T9 (P2, human: ~0.5d / CC: ~15min)** CI: tests, `npm audit`, Inspector conformance (E7)
  - Files: .github/workflows/ci.yml
  - Verify: CI green on Linux and Windows runners, Node 22.13 and current LTS, on a branch, after the user approves repo creation
- [ ] **T10 (P1, human: ~1d / CC: ~30min)** Docs: README quick start, card contract, honesty notes (deterministic router, simulated Alexa+, not a medical device), an impact paragraph with 2 to 3 cited and linkable statistics on medication adherence and family caregiving (none invented; each source opened and the quoted figure confirmed before it is used), explicit non-claims, a note that the 60-minute grace is configurable and set for demo visibility, a note that snooze-after-escalation, DST and multi-item days are covered by the test suite rather than the video, and `docs/demo-script.md` kept in sync
  - Files: README.md, docs/
  - Verify: `grep -ri alexa README.md docs/` shows every hit labeled simulated or describing the track; every cited statistic's link resolves and matches the quote; stranger test, under 5 min from clean clone; README has a Troubleshooting section (port busy, Node version, bad bearer)
- [ ] **T11 (P1, human: ~1d / CC: n/a)** Demo video following `docs/demo-script.md` (timed, under 2:45), submission text, per-tool product feedback (tools listed in `docs/submission-checklist.md`, each entry derived from `FRICTION.md`), friction log polish
  - Verify: public YouTube link and duration read from YouTube under 3:00; the first 20 seconds state what is real and what is simulated; video has no third-party trademarks or copyrighted music and shows the 'Simulated Alexa+ display' label; script reviewed against the honesty rules; every line of `docs/submission-checklist.md` ticked with a link; repo public, LICENSE detected by GitHub, README run instructions at the top (or the private-repo fallback shares sent); per-tool feedback has one entry for each listed tool; friction log linked or pasted as the form requires; on Oct 22 morning the live Devpost deadline is re-read; Open Source fields filled if T12 shipped; optional feature requests entered if any came out of the friction log; friction log has at least 5 entries; tag `demo-v1`, a seeded DB snapshot and a fallback recording exist (S8); voice take recorded in Chrome or Edge; AI-assistance disclosure checked against the rules
- [ ] **T12 (P2, human: ~0.5d)** Open Source mini challenge: contribution to a public repo; candidates (decide by day 6): (1) a docs or example fix in `modelcontextprotocol/typescript-sdk` found through `FRICTION.md`, (2) an issue or small fix in the MCP Inspector repo; open on day 11
  - Surfaced by: design doc premise 4 and the zero-spend decision; outside voice F7
  - Files: none in this repo; record URL in README
  - Verify: PR or fork URL recorded in the README and in the Devpost mini-challenge field with repo URL, GitHub username and a short description

Effort assumptions: scaffolding ~100x, features ~30x, tests ~50x, research ~3x. These CC ratios are optimistic for Playwright and DST tests, so the schedule below carries slack.

### Schedule and cut order (13 days from Oct 9; submit Oct 22 18:00 IST)

| Day | Date | Tasks |
|---|---|---|
| 1 | Oct 9 | T0, T1 (T0 includes the Devpost, GitHub, YouTube account checklist; T0 items (e), (f), (j), (l) may finish on Day 2) |
| 2 | Oct 10 | T2, local `npm run conformance` script; T0 leftovers (e), (f), (j), (l) |
| 3 | Oct 11 | T3 |
| 4 | Oct 12 | T4 |
| 5 | Oct 13 | T5, T8 |
| 6 | Oct 14 | T6 part 1; decide T12 target; user approves repo creation (gate G1) |
| 7 | Oct 15 | T6 part 2 |
| 8 | Oct 16 | design check (budget 1h: compare the built UI with `docs/mockups/`), T7a voice, T7b timeline |
| 9 | Oct 17 | T6b, T9 |
| 10 | Oct 18 | T10; start T11 text drafts, product feedback, friction log polish; full rehearsal take of the demo script as a safety recording (typed if T7a was cut; drop it if T10 overruns, Day 13 absorbs it) |
| 11 | Oct 19 | T12 open the contribution; T11 drafts continue |
| 12 | Oct 20 | T11 record the demo (tag `demo-v1`, DB snapshot, fallback video) |
| 13 | Oct 21 | buffer; final checks |
| submit | Oct 22, by 18:00 IST | submit; Oct 23 stays free as emergency buffer |

Gate G1 (user approves GitHub repo creation and first push) by Oct 14. If not approved by Oct 16, CI (T9), the public PR (T12) and the public video link slip to the submission day; T12 and T9 then follow the cut order below.

Cut order if behind (cut first to last): T12 mini challenge, T7a voice (E1; demo-script shot 2 has a typed fallback; the Speak button is hidden by feature detection, so the mockups still hold, minus the mic), T9 CI matrix (the local conformance script stays), T6b polish depth. Never cut: T2, T3, T4, T5 (parser, templates, guardrail), T6 core, T7b timeline (E2, the demo money shot), T8 seed, T10, T11.

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW - COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | empty dir, no git, no TODOs; greenfield     |
  | Step 0               | 3 adds (E1,E2,E7), 2 deferred, 1 dropped, 1 skipped |
  | Section 1  (Arch)    | 3 issues found (S1,S2, honesty of router)   |
  | Section 2  (Errors)  | 10 error paths mapped, 1 GAP (S4, resolved) |
  | Section 3  (Security)| 9 threats mapped, 3 needed action; 4 High-impact rows, all mitigated |
  | Section 4  (Data/UX) | 9 edge cases mapped, 3 unhandled (resolved) |
  | Section 5  (Quality) | 2 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 0 open gaps (hostile/chaos tests in the matrix and T6) |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 1 gap found (audit log, resolved)           |
  | Section 9  (Deploy)  | 1 risk flagged (demo-day fallback)          |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 3           |
  | Section 11 (Design)  | 3 issues, run /plan-design-review next      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (8 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 10 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 8 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | E4 and E6 there; E3 removed (dropped)       |
  | Scope proposals      | 7 proposed, 3 accepted (EXP + SEL)          |
  | CEO plan             | written                                     |
  | Outside voice        | Claude runner completed, 13 findings        |
  | Lake Score           | N/A (no coverage-scored question asked)     |
  | Diagrams produced    | architecture, data flow, state machine,     |
  |                      | async schedule, error table                 |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  +====================================================================+
```

### Failure Modes Registry

```
 CODEPATH               | FAILURE MODE            | RESCUED? | TEST? | USER SEES?      | LOGGED?
 log_dose               | duplicate slot          | Y        | Y     | same card       | Y
 check_misses           | concurrent callers      | Y        | Y     | one notification| Y
 check_misses           | DST shift               | Y        | Y     | correct slots   | Y
  message templates     | dosing text             | Y        | Y     | template        | Y
 mcp transport          | bad Origin/token        | Y        | Y     | client error    | Y
 mcp transport          | stateless: no session   | Y        | Y     | n/a             | Y
 sim-ui                 | server down             | Y        | Y     | banner          | Y
 sim-ui                 | XSS in name             | Y        | Y     | escaped text    | Y
```

---

# Engineering Review (/plan-eng-review)

Target: this plan (`docs/plans/PLAN.md`), after the CEO review. Autonomous run: the user pre-authorized the recommended option for every decision (D-AUTO-1). Compact ledger form is used for that reason: each row below has the finding, plan baseline, runtime evidence, the chosen option and its scope. Rows are independent: accepting one does not accept another.

## Scope Challenge

**Runtime evidence (bounded probe, this machine):** `node --version` = v24.10.0; `require('node:sqlite')` loads and prints `ExperimentalWarning: SQLite is an experimental feature`; npm 11.7.0. The directory holds no code yet, so there is nothing to reuse and no tests to inherit. History check: not a git repo, so none is available.

**What already solves each sub-problem (Layer 1/2 per Search Before Building):**
- MCP server and client with Streamable HTTP: the official TypeScript SDK **[Layer 1]**.
- Connectivity and call check: MCP Inspector CLI **[Layer 1]**.
- Validation and JSON Schema: Zod, plus a Zod-to-JSON-Schema converter **[Layer 1]**.
- Storage: `node:sqlite`, built in **[Layer 1]**, experimental flag noted.
- Browser E2E: Playwright **[Layer 1]**; unit/integration: vitest **[Layer 2]**.
- Voice: Web Speech API, built in to Chromium **[Layer 1]**.
Nothing is rebuilt that one of these provides. Web search was not run for this pass (Aside not checked; in-distribution knowledge only), so SDK stateless-mode behavior is a T0/T2 verification item, not an assumption.

**Complexity check (estimates):** about 24 files proposed (src/server: mcp, http, tools x8, core x5, db x2, parser, templates, guardrail; src/sim: host (with router), ui x4; seed; tests) and 2 new services (tend-server, sim-host). This is over 8 files and 2 services, so the complexity gate trips.

**Complexity gate (auto per D-AUTO-1):**
- Feature cuts proposed: none. The CEO review already trimmed scope; all accepted features stay.
- Structure question, `Original arrangement` (one file per tool, about 24 files) vs `Smaller arrangement` (tools grouped in three files `schedule.ts`, `dose.ts`, `query.ts`; core in `core.ts` + `clock.ts`; sim-host and router in one `sim/host.ts`; about 20 files). Both keep the same features, contracts and approved fixes. Pending remedies not decided here: none (all engineering rows below are decided).
- Chosen: **Smaller arrangement** (recommended: fewer moving parts, same behavior; the split into files is reversible). Answer ref: D-AUTO-1.

Scope Challenge result: **scope accepted as-is** (a smaller arrangement that preserves scope is not a scope reduction). TODOS.md cross-reference: E4, E6 remain deferred, E3 dropped; none blocks this plan.

## Findings and decisions

Format: `[SEV] (confidence N/10) plan-line - description`. Plan quotes are from `docs/plans/PLAN.md` as of this review.

### Section 1: Architecture

**A1 [P1] (8/10) Section 2 error table - session lifecycle is needless state.** Quote: `Session 404        | Y        | sim-host reinitializes once`. Tools are pure request/response; no server-initiated notifications or streaming are planned, so MCP sessions add a session map, an expiry path and a client re-init path for no benefit.
- Plan baseline: stateful sessions implied (session 404 path).
- Runtime evidence: unknown; SDK stateless mode is documented behavior but unverified here. Verify in T2.
- Options: A) Stateless Streamable HTTP (new transport per request, JSON responses) (recommended); B) Keep stateful sessions; C) Investigate first.
- Decision **ER1 = A**, approved, ref D-AUTO-1. Scope: T2 builds stateless mode; the session-404 rescue row and the "session 404 re-init" test are removed; if the SDK cannot run stateless with JSON responses, T2 falls back to stateful and restores that row (condition recorded, not pre-approved otherwise).
- Completeness: A 9/10, B 7/10.

**A2 [P1] (8/10) Section 1 state machine - escalation key breaks across DST and schedule edits.** Quote: `blocked by UNIQUE(person,item,slot)`. If `slot` is a UTC instant, a DST change or a mid-day `set_schedule` edit can create a second row for what the user sees as one dose slot, or merge two.
- Plan baseline: UNIQUE on (person, item, slot), slot undefined.
- Options: A) Key = (person, item, local_date, slot_hhmm); a slot row is materialized once, when first evaluated, and never recomputed from later schedule edits (recommended); B) Key on UTC instant; C) Key includes schedule version.
- Decision **ER2 = A**, approved, ref D-AUTO-1. Scope: T3 data model and tests (DST spring-forward and fall-back days; schedule edited after a slot is materialized).
- Completeness: A 9/10, B 5/10, C 8/10.

**A3 [P2] (8/10) ledger S3 - "advance time" has no safe home.** Quote: `Injectable clock plus "advance time" control`. If that control is an MCP tool it ships to real clients and can be called by anything that reaches the server.
- Options: A) Dev-only HTTP endpoint `POST /admin/clock`, enabled only when `TEND_CLOCK=sim`, loopback and bearer-protected, and absent from `tools/list` (recommended); B) A ninth MCP tool; C) Restart server with a new clock value.
- Decision **ER3 = A**, approved, ref D-AUTO-1. Scope: T2/T3/T6; test that `/admin/clock` returns 404 when `TEND_CLOCK` is not `sim` and that the tool list stays at 8.
- Completeness: A 9/10, B 6/10, C 4/10.


**A5 [confirmation] (9/10) ledger S2 - `node:sqlite` is viable here.** Runtime evidence above. Decision **ER5**: keep `node:sqlite`; set `engines.node >= 22.13`; document the experimental warning in the README; `better-sqlite3` stays the documented fallback. Approved, ref D-AUTO-1 (reaffirms ledger S2).

Architecture diagram (updated):
```
 sim-ui (browser) --HTTP--> sim-host --(stateless Streamable HTTP, JSON)--> tend-server
   voice, cards                |  router: regex (deterministic)   |-- tools: schedule.ts dose.ts query.ts
   POST /admin/clock (dev) ----+                                                 |-- core.ts (+clock.ts, miss rule, slot rows)
                                                                                 |-- parser.ts, templates.ts (deterministic)
                                                                                 |-- guardrail.ts
                                                                                 '-- node:sqlite file + audit_log
 npm start  =  tend-server + sim-host (one command, concurrently)
```

Data flow, `check_misses` (four paths):
```
 INPUT(person) -> VALIDATE(zod) -> LOAD schedule+tz -> MATERIALIZE today's slots (INSERT OR IGNORE by local key)
    nil: zod error      unknown person: error     empty schedule: no slots, empty result
 -> EVALUATE (now > slot+grace, no dose) -> INSERT escalation (UNIQUE) + notification in ONE txn -> RETURN rows
    DB busy: retry 2x then isError     UNIQUE hit: no-op, return existing row
```

Production failure per new path: unparseable input -> clear "I didn't understand" result (handled, tested). Disk file locked by antivirus on Windows -> `SqliteBusy` retry then card "Try again" (handled, tested).

### Section 2: Code quality

**Q1 [P2] (8/10) task T4 - the card contract has two sources of truth.** Quote: `Files: src/server/tools/*.ts, schemas/card.schema.json`. A hand-written JSON schema will drift from the Zod types the tools actually return.
- Options: A) Define the card in Zod once; emit `schemas/card.schema.json` at build and diff it in a test (recommended); B) Hand-maintain both.
- Decision **ER6 = A**, approved, ref D-AUTO-1. Scope: T4.

**Q2 [P2] (9/10) no test framework exists (directory is empty).** Choose one so tasks are executable.
- Options: A) vitest for unit and integration, Playwright for the demo E2E (recommended); B) node:test plus Playwright; C) Jest.
- Decision **ER7 = A**, approved, ref D-AUTO-1. Scope: T1 installs; no tests written in this review.

**Q3 [P3] (7/10) task T2 - `npm run conformance` must be reproducible.** Pin `@modelcontextprotocol/inspector` as a devDependency in the lockfile instead of `npx latest`; otherwise the check changes under you the week of the demo.
- Decision **ER8 = pin** (recommended option), approved, ref D-AUTO-1. Scope: T2.

**Q4 [P3] (6/10, medium confidence, verify) branches.** The miss-rule evaluator has grace, snooze, timezone, DST and escalation-state conditions; expect more than 5 branches. Split into `slotsForDay()`, `isMissed()`, `transition()` as pure functions. Folded into ER2's scope (same module, same tests); no separate choice needed because it is an implementation shape inside an approved contract.

Stale diagram audit: PLAN.md diagrams updated above (architecture and state machine); the CEO-section architecture diagram is superseded by this one. Note added in the CEO section pointer below.

### Section 3: Test review

Framework: none detected (empty directory); ER7 selects vitest + Playwright. Nothing is built here.

```
CODE PATHS (all PLANNED; nothing exists)                USER FLOWS
[+] core.ts / clock.ts                                  [+] Elder logs a dose
  |-- slotsForDay()  [PLAN ***] DST, tz change, edit        |-- [PLAN ***][->E2E] say it, card shown, history updated
  |-- isMissed()     [PLAN ***] grace edge, snooze        [+] Missed dose
  |-- transition()   [PLAN ***] all valid + invalid          |-- [PLAN ***][->E2E] advance clock, notification, timeline
  '-- check_misses   [PLAN ***] 2-connection concurrency  [+] Late dose after escalation
[+] tools (8)        [PLAN ***] schema+Inspector per tool    '-- [PLAN **] follow-up line, no 2nd notification
  guardrail.ts       [PLAN ***] each banned word, casing    |-- [PLAN **][->E2E] confirm step, stale proposal rejected
[+] http/mcp.ts      [PLAN ***] Origin, Host, bearer       [+] Caregiver weekly view
[+] seed             [PLAN **]  idempotent                  [+] Failure states
                                                             '-- [PLAN **]  mic unsupported/denied
COVERAGE: 0/13 implemented (greenfield). Planned: 13/13 paths have a named test. Every planned path names its test.
```

Test value bar: each critical path carries a value card in the Test Plan artifact below. Proposals that failed the bar: "sim-ui renders cards" snapshot test (folded into the E2E demo script); one test per tool for validation (collapsed into one table-driven test).

IRON RULE (regression): greenfield, so no existing behavior is at risk. The one behavior that must never regress once built is escalation idempotency; its contract is already approved (S7, concurrency test via ER2 key). Decision **ER9** approved, ref D-AUTO-1 (reaffirms S7).

Parser scope: `parse_schedule` golden set (10 cases, deterministic parser); guardrail word-list tests are deterministic. Baseline: the deterministic parser's results.

Tests made obsolete: none.

### Section 4: Performance

Scale: one household, about 50 rows per week, one sim client polling every 30 s. No N+1 shapes. `node:sqlite` is synchronous: queries run on the event loop; at this size each is sub-millisecond, no issue (medium confidence, no benchmark taken). Slowest path: `weekly_summary` (one query, under 20 ms). Unbounded structures: notification list capped at 20 in the UI; audit_log grows by one row per tool call, trivial for a demo.

**P1 [P3] (6/10, verify) Playwright browser download.** Roughly a few hundred MB on first install (unmeasured here); note in README and pin the browser channel to Chromium. No decision needed; documentation inside T10.

## Decision ledger (engineering)

| ID | Choice | Chosen | Answer ref | Accepted scope |
|---|---|---|---|---|
| ER0 | File/class structure | Smaller arrangement | D-AUTO-1 | about 20 files; same features |
| ER1 | Session lifecycle | Stateless Streamable HTTP, JSON responses; fallback to stateful only if the SDK cannot | D-AUTO-1 | T2; remove session-404 row/test |
| ER2 | Escalation key and slot materialization | (person, item, local_date, slot_hhmm), materialize-once | D-AUTO-1 | T3 data model, DST tests |
| ER3 | Advance-time control | Dev-only `/admin/clock` | D-AUTO-1 | T2/T3/T6 |
| ER5 | SQLite driver | `node:sqlite`, engines >= 22.13, fallback documented | D-AUTO-1 | T0/T1 |
| ER6 | Card schema source | Zod once, emit JSON Schema | D-AUTO-1 | T4 |
| ER7 | Test frameworks | vitest + Playwright | D-AUTO-1 | T1 |
| ER8 | Inspector pin | pinned devDependency | D-AUTO-1 | T2 |
| ER9 | Regression contract | escalation idempotency, as S7 | D-AUTO-1 | T3 |
| ER10 | SDK capability and protocol version | verify in T0, pin reported version, text-block fallback for cards | D-AUTO-1 | T0, T4 |
| ER11 | Inspector CLI headless | verified in T0 probe 3; T2 only writes the SDK-client fallback if the probe failed | D-AUTO-1 | T0, T2 |
| ER12 | Zod version | pin to SDK peer range | D-AUTO-1 | T0, T2 |
| ER15 | node:sqlite engines | >= 22.13, matrix tests oldest allowed | D-AUTO-1 | T1, T9 |
| ER16 | Concurrency test mechanism | separate processes | D-AUTO-1 | T3 |
| ER17 | Sync-folder check | T0 item (k) | D-AUTO-1 | T0 |
| ER18 | Loopback host naming | 127.0.0.1 everywhere | D-AUTO-1 | T2, T10 |
| ER19 | Voice runtime failure | onerror/onnomatch fallback plus stub test | D-AUTO-1 | T7a |
| ER20 | Deadline confirmation | T0 re-confirms hour and timezone | D-AUTO-1 | T0 |
| ER21 | Echoed-text wording | echoed medication-name text is not a control; the controls are input limits, the guardrail and templates | D-AUTO-1 | Sec 3 text |
| ER22 | Demo reset and next-slot control | `POST /admin/reset` and `{jump_to: next_slot}` on `/admin/clock`, same gating as ER3; reset reproduces demo state | D-AUTO-1 | T2, T3, T8 |
Approval readiness (engineering): PASS. Checked rows: ER0-ER3, ER5-ER12, ER15-ER22, each citing D-AUTO-1 (the user's autonomous authorization this session) with its exact scope in the Accepted-scope column.

## Failure modes (additions)

```
 CODEPATH              | FAILURE MODE                     | TEST? | ERROR HANDLING? | USER SEES
 slot materialization  | schedule edited after slot made  | Y     | Y (immutable)   | old slot kept
 /admin/clock          | called outside TEND_CLOCK=sim    | Y     | Y (404)         | not found
 stateless transport   | SDK refuses stateless+JSON       | Y(T2) | Y (fallback)    | none
 conformance script    | inspector version drifts         | Y     | Y (pinned)      | CI red, not silent
```
Critical gaps: 0.

## Worktree parallelization strategy

Solo builder, one repo: **sequential implementation, no parallelization opportunity** for code. Two lanes are independent in time only: (Lane A) T2 -> T3 -> T4 -> T5 (server), (Lane B) T6 -> T6b -> T7 (sim) starting once the card schema from T4 exists; the schedule already serializes them, so no worktrees are used.

## Test Plan Artifact

Saved to `~/.gstack/projects/AmazonDeveloperHackathon/harsh-unknown-eng-review-test-plan-*.md` (discovery path, see Completion summary). Summary:
- Critical paths: log a dose by voice and see the card; missed dose to notification to timeline; late dose after escalation; confirm-before-save schedule parse.
  - Value: protects=escalation idempotency across callers and DST; fails_when=duplicate notification or wrong slot day; why_new=no tests exist yet; seam=none
  - Value: protects=guardrail blocks dosing text in outgoing messages; fails_when=banned phrase reaches the notification; why_new=no tests exist yet; seam=none
  - Value: protects=Origin and Host refusal, bearer required when hosted; fails_when=a foreign Origin is served; why_new=no tests exist yet; seam=none
  - Value: protects=card contract matches the emitted JSON Schema; fails_when=Zod and schema diverge; why_new=no tests exist yet; seam=none
- Edge cases: DST days, poisoned medication name, server killed mid-demo, mic unsupported, empty and partial week, stale proposal.
- Tests to retire: none. Pending decisions: none.

## Outside Voice (engineering review)

Provider: Claude Code runner (`gstack-claude-code`, read-only), completed. Not a different model family; no cross-model agreement is claimed. Native Codex not used, per standing instruction. Input: the working plan including the engineering section.

| # | Severity | Finding | Disposition (all by D-AUTO-1, recommended option) |
|---|---|---|---|
| 1 | Critical | Card contract assumes SDK `structuredContent` support; unverified | **ER10** T0 adds a capability check (installed SDK version, `structuredContent` and `outputSchema` on a tool, negotiated protocol version); if absent, cards go inside a JSON text block and the contract is unchanged |
| 2 | Medium | "MCP 2025-11-25" stated without citation | **ER10** pin to what the SDK reports at `initialize`; record in README |
| 3 | Medium | Inspector `--cli` headless scripting unconfirmed | **ER11** verified in T0 probe 3; T2 writes the SDK-client fallback only if the probe failed; fallback: a small script using the SDK client for list+call |
| 4 | Medium | Zod major-version mismatch with SDK | **ER12** pin Zod to the SDK's peer range in T0/T2 |
| 9 | High | `node:sqlite` flag consistency across contexts | **ER15** evidence here: Node v24.10.0 loads it without a flag (it is unflagged from 22.13). Fix `engines` and the CI matrix to >= 22.13 and test on the oldest allowed version; every npm script runs through the same entry; no flag needed or threaded |
| 10 | Medium | Worker threads vs processes for the concurrency test | **ER16** separate processes only |
| 11 | Low | WAL under a sync client folder | **ER17** T0 item (k) check: path is `C:\Hackathons\...`, not OneDrive/Dropbox; documented in README |
| 12 | Low | `localhost` can resolve to `::1` | **ER18** all URLs and docs use `127.0.0.1`; `localhost` stays in the allowlist but is not used by the project |
| 13 | High | Web Speech `SpeechRecognition` may exist but fail at runtime in Playwright Chromium | **ER19** runtime `onerror`/`onnomatch` fallback to text with a visible message; separate test that stubs a failing recognizer; the claim "voice unsupported" test is now "voice fails at runtime" |
| 14 | Medium | Exact Devpost deadline hour and timezone | **ER20** T0 confirms it on the Devpost page; the plan already uses Oct 24 00:30 GMT+5:30 from the page text, to be re-confirmed |
| 15 | Low | Echoed text is not a control | **ER21** controls are input limits, guardrail and templates |

OUTSIDE COVERAGE (engineering): Claude Code runner completed, 11 findings, 0 unresolved, 0 declined.

## Completion summary (engineering)

- Step 0: Scope Challenge - scope accepted as-is (smaller file arrangement chosen, ER0)
- Architecture Review: 4 issues found (A1-A3, A5)
- Code Quality Review: 4 issues found (Q1-Q4)
- Test Review: diagram produced, 13 planned paths all with a named test, 0 gaps; 0 of 13 implemented (greenfield)
- Performance Review: 1 issue found (P1, documentation only)
- NOT in scope: written (see top of plan)
- What already exists: written (Scope Challenge, Layer 1/2 tools)
- TODOS.md updates: 0 new items proposed (E4, E6 there; E3 removed)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: Claude Code runner, completed (11 findings, all dispositioned)
- Parallelization: sequential, 0 parallel lanes (solo builder)
- Lake Score: 12/12 recommendations chose the complete option where a coverage score applied
- Task JSONL for /autoplan: not written (this pipeline is not /autoplan); the task list is in Implementation Tasks above.

---

# Design Review (/plan-design-review)

Target: this plan, UI scope = the Tend simulator (`src/sim/ui`). Autonomous run: every decision below was auto-selected as the recommended option under the user's blanket authorization (D-AUTO-1); each issue still gets its own row. The gstack designer needs an OpenAI API key and the user said no OpenAI, so mockups were authored by Claude as plain HTML/CSS (`docs/mockups/`) and rendered with gstack's own headless browser; they were then read as images and corrected (see Visual verification below). The first-pass text-only ratings in the passes below are the initial scores; the final scores use the rendered evidence.

## Step 0

**Initial design rating: 4/10.** The plan specifies behavior and states (Sec 11 table) but names no typeface, color, spacing, layout or per-viewport behavior, and it describes the UI as "cards, carousel, notification panel". A 10 for this plan: two clearly different surfaces (elder at arm's length, caregiver on a phone or desktop) with named tokens, a hierarchy per screen, every state written as what the person sees, one authored motion moment, and an accessibility spec the implementer can test.

**DESIGN.md status:** none existed at the start of this review. A full `/design-consultation` was out of proportion for a 13-day sprint, so DS2 defined the tokens and `DESIGN.md` was written at the repo root from the rendered mockups; it is now the single token source.

**Existing design leverage:** nothing in the repo. External: Web Speech API, system focus behavior, `prefers-reduced-motion`.

**Focus areas:** all seven passes (auto-selected).

**Classifier (per section):** elder surface = OPERATE with a very low interaction budget; caregiver surface = OPERATE; the README and demo video framing = READ/PERSUADE but those are not UI in this plan. No landing page exists, so landing rules do not apply.

## Pass 1: Information Architecture (initial 3/10, after 9/10)

Gap: the plan lists widgets, not a hierarchy. Constraint worship: if each surface shows only three things, which three?

- **Elder surface "Today", three things:** (1) the next dose, huge: name, time, one button "I took it"; (2) what Alexa just said, as text; (3) a single line of tomorrow's first dose. Everything else (history, settings) is absent.
- **Caregiver surface "Care", three things:** (1) status line: "All on track" or "Missed: <item> at <time>"; (2) the alert list; (3) the week strip. The timeline is an inline section below the week strip.
- **Demo split view (DS1):** on desktop the page shows both surfaces side by side, headed "Simulated Alexa+ display" (kitchen) and the caregiver status line, so one screen recording carries the whole story. On a phone `?view=demo` stacks the kitchen display above the caregiver view; the kitchen and care routes are single surfaces. There is no tab bar.

```
 DESKTOP (>=901px)  split view (matches docs/mockups/demo.png)
 +-------------------------------------+-----------------------------------------+
 | KITCHEN DISPLAY                     | CAREGIVER                               |
 |  Overdue (clock icon + word)        |  Status: Missed: Morning tablet 8:00 AM |
 |  Morning tablet   8:00 AM           |  Alerts (newest first)                  |
 |  [ I took it ]    (72px target)     |  This week: Mon..Sun strip              |
 |  Tomorrow: Morning tablet 8:00 AM   |  Timeline (inline section)              |
 |  Simulated Alexa+ display           |                                         |
 |  Alexa line, [type or Speak] (64px) |                                         |
 +-------------------------------------+-----------------------------------------+
 | Demo controls: +15 min  +1 hour  Next dose  Reset      Demo, not a medical device |
 +-----------------------------------------------------------------------------------+
 generic labels and synthetic data only
```
Decision **DS1** approved (D-AUTO-1): split view at 901px and wider, stacked at 900px and below, no tabs; the three-things rule above is the contract.

## Pass 2: Interaction State Coverage (initial 5/10, after 9/10)

The CEO table lists states by label; it does not say what the person sees. Replacement (what the user sees, per state):

| FEATURE | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|---|---|---|---|---|---|
| Next-dose panel | text "Checking..." in the same box, no spinner jump | "Nothing due today. Next: tomorrow 8:00 AM." plus "Add a reminder" link | banner "Can't reach Tend. Your last saved schedule is shown." with Retry | panel slides to the next dose, "Logged at 8:02" for 3 s | some doses overdue: overdue ones in the alert color with the word "Overdue" |
| I took it | button text "Saving..." disabled | n/a | inline "Couldn't save. Try again." button stays | "Taken" check plus time | already taken: "Already logged at 8:02" |
| Voice / Speak | "Listening..." with a live caption | "Say something like: I took my morning pills" | "Voice didn't work here. Type it instead." (focus moves to text field) | transcript appears in the field before sending | partial transcript is editable before send |
| Alert list | three skeleton rows | "All quiet. No missed doses." | "Couldn't load alerts." Retry | list with unread marker | read and unread mixed; older than 20 behind "Show more" |
| Week strip | 7 empty day slots | "No history yet. Seed the demo week." (demo) | "Couldn't load the week." Retry | 7 days, each with dots per dose | partial week: missing days show "no data", not zero |
| Schedule confirm | "Reading your message..." | n/a | "I couldn't understand that. Try: Morning tablet at 8am daily." | "Saved" toast, then panel updates | proposal edited, must be re-confirmed |
| Timeline | skeleton rail | "No missed doses this week." | Retry | rail: scheduled, grace ends, alert sent, late dose | superseded: node labeled "Snoozed after alert" |
| Server offline | n/a | n/a | full-width banner on both surfaces | auto-clears on recovery | n/a |

Decision **DS6** approved (D-AUTO-1): this table replaces the CEO Sec 11 table and goes into T6/T6b verify.

## Pass 3: User Journey & Emotional Arc (initial 4/10, after 9/10)

Storyboard (accepted journey from the demo script):

| STEP | USER DOES | USER FEELS | PLAN SPECIFIES |
|---|---|---|---|
| 1 | Elder glances at the kitchen display at 8:00 | Calm, expects the routine | Next-dose panel, one button, no other choices |
| 2 | Says or taps "I took my pills" | Quick relief, "done" | "Taken" check, 300 ms ease-out shift, no confetti |
| 3 | The same morning the clock jumps +1 h (demo control); the 8:00 dose is missed | Mild unease, then reassurance | Panel turns "Overdue" in a calm amber, no alarm sound |
| 4 | Caregiver sees the alert | Concern with a clear next step | Status line plus message "Mom has not logged her 8:00 morning tablet. It has been 62 minutes." |
| 5 | Caregiver opens the timeline | Understanding, not blame | Rail with four event nodes (plus a clock-skipped marker in the demo), plain times, no red wall |
| 6 | Late dose is logged | Relief | Alert gets a follow-up line "Logged at 9:17", rail node closes |

Time horizons: 5 seconds = one big word and one button; 5 minutes = the user learns the routine; 5 years = it should feel like a quiet household object, not a medical alarm. Decision **DS5** (the timeline rail design, E2) approved (D-AUTO-1): vertical rail, time labels in tabular numerals, one accent per node type, no color-only meaning.

## Pass 4: AI Slop Risk (initial 4/10, after 9/10)

Classifier: OPERATE. Hard-rejection check on the plan as written: (7) "app UI made of stacked cards instead of layout" **hit** in the CEO Sec 11 ("cards, carousel, notification panel"); (6) "carousel with no narrative purpose" **partial hit**: the weekly "carousel" is a data viewer, not a story. Litmus (plan text, no mockup): brand unmistakable: NO (no name or mark specified); one visual anchor: NO until DS3; scannable by headlines: YES after DS1; one job per section: YES; cards necessary: NO; motion improves hierarchy: not specified; premium without shadows: n/a (no shadows specified).

Fixes (each its own row):
- **DS3** (approved): the elder surface has **no cards**. It is one large panel: item name at 52px, time at 36px in tabular numerals, one 72px-tall button. The panel is a layout region, not a card (no border-radius mosaic, no shadow).
- **DS4** (approved): the week "carousel" renders as a 7-column **week strip**: one column per day, one dot per scheduled dose (filled = taken, ring = missed, dashed = upcoming) plus a word label. It earns the "carousel" contract on Alexa-style surfaces (swipe on phones) because the narrative is the week. The Alexa-facing payload still says `ui: "carousel"`.
- **DS12** (approved): no rocket/emoji decoration, no icon-in-circle rows, no centered-everything; text is left-aligned; two radii only (4px controls, 12px panels); no gradients, no glow.
- Brand: product name "Tend" set in the UI typeface at 20px semibold as a plain-text wordmark (no logo asset in v1). Brand is a quiet top bar on every route, including the kitchen display, reading "Tend" and "Simulated Alexa+ demo"; the kitchen region itself is headed "Simulated Alexa+ display".
- The three looks check: not cream+serif+terracotta, not near-black+neon, not hairline+italic+mono. Chosen look is a cool-neutral, daylight Operate look (see tokens). Light mode is derived from the use scene: a kitchen counter in daylight, viewed from about 1.5 m. A caregiver evening/dark theme is **not** in scope (deferred, TODOS.md).

## Pass 5: Design System Alignment (initial 2/10, after 8/10)

Decision **DS2** (approved): tokens are defined once, in `DESIGN.md` (root) and mirrored in `docs/mockups/tend.css`; this plan no longer carries a copy.

Tokens, type sizes, contrast measurements, radii, spacing and motion live in `DESIGN.md` only (single source, DS22).
"Premium without shadows": no box-shadows at all in v1; depth comes from spacing and the hairline. Font note: Lexend is a reading-proficiency typeface with plain zeros, a real design choice and not a default stack; if the font file cannot be self-hosted, fall back to IBM Plex Sans (allowed on Operate surfaces), never system-ui as the primary.
No new components beyond: Panel, Button (primary, secondary), Banner (status, ok and offline variants), AlertRow, WeekStrip, Rail, Toast, DemoTray, Chip. That is the full vocabulary (same list in `DESIGN.md`).

## Pass 6: Responsive & Accessibility (initial 3/10, after 9/10)

**Viewports (DS9 approved):**
- Kitchen display, tablet landscape 1024x768 and up: elder surface only fills the screen; panel left 60%, Alexa transcript right 40%.
- Desktop >= 901px: split view (above).
- Tablet portrait 768 and below: `?view=demo` stacks the elder surface above the caregiver surface; `?view=kitchen` and `?view=care` are single surfaces.
- Phone 375: one surface per route; `?view=demo` stacks kitchen above caregiver; no tab bar. Below 420px the week strip becomes a 7-row list (DS29), no horizontal scroll.

**Accessibility spec (DS10 approved):**
- Landmarks: `header`, `main` per surface (`aria-label="Kitchen display"` / `"Caregiver"`), no `nav` (no tab bar).
- Targets: elder 64px minimum, caregiver 48px (above the 44px floor).
- Contrast: body 7:1 on the elder surface, 4.5:1 minimum anywhere, verified with the token values above.
- Keyboard: Tab order follows visual order; Enter/Space activate; the Speak button has a text label and `aria-pressed` while listening.
- Live regions: Alexa's reply and new alerts use `role="status"` with `aria-live="polite"`; the offline banner uses `role="alert"`.
- Visible labels on every field; no placeholder-as-label; the utterance field is always visible even when voice works.
- Status never relies on color: every state has a word and an icon (check, clock, dash).
- `prefers-reduced-motion`: the one motion moment becomes an instant swap.
- Text resizes to 200% without loss; layout reflows, no horizontal scroll anywhere.
- Font size floor 16px body, 14px only for timestamps and metadata.

## Pass 7: Unresolved Design Decisions

| DECISION NEEDED | DECISION (all auto per D-AUTO-1) | IF DEFERRED, WHAT HAPPENS |
|---|---|---|
| Does the elder see the caregiver's alerts? | No. Elder sees only their dose and Alexa lines (calm, no surveillance feel) | Engineer mirrors the alert list onto the elder screen |
| Demo controls: where and how visible? **DS11** | An always-visible "Demo controls" strip at the page foot: +15 min, +1 hour, next dose, reset; labeled as demo chrome, never inside the kitchen display region | Time buttons end up inside the panel and read as product features |
| Honest labeling of the simulation **DS13** | Persistent label "Simulated Alexa+ display" on the kitchen surface and "Demo, not a medical device" footer | Judges or viewers mistake it for the real Alexa+ UI or a medical product |
| The one motion moment **DS7** | On "I took it": the panel content slides up 12px and fades to the next dose, 300 ms ease-out from a visible default; nothing else animates; reduced-motion = instant | Every element gets a hover/entrance effect (slop) |
| Browser surfaces **DS8** | Theme `::selection` (teal 25% on ink), `caret-color: accent`, `accent-color: accent` for native controls, `scrollbar-color`, tabular numerals on all times, 3px focus rings | Default blue selection and system focus rings |
| Copy voice **DS30** | Utility language, short, second person for the elder ("Next: ..."), plain third person without contractions for the caregiver ("Mom has not logged..."); no exclamation points, no "Welcome" | Generic assistant copy |
| Persona names in seed data | Synthetic, obviously fictional ("Mom", "Alex"); no real medication brands that could imply advice: generic placeholders like "Morning tablet", "Evening tablet" | Real drug names imply clinical correctness |
| Dark/caregiver evening theme | Deferred (TODOS.md) | none for v1 |

The seed-data row refines S5/guardrail: medication labels in seed data are generic ("Morning tablet"), which also removes any health-advice signal from the demo video.

## Design decision ledger

| ID | Decision | Answer ref | Scope |
|---|---|---|---|
| DS1 | Split view at 901px and wider, stacked at 900px and below, no tabs; three-things rule per surface | D-AUTO-1 | T6 layout |
| DS2 | Tokens and Lexend (changed from Atkinson after rendering); DESIGN.md written | D-AUTO-1 | T6b implements against DESIGN.md |
| DS3 | Elder surface has no cards; one panel | D-AUTO-1 | T6 |
| DS4 | Week strip (7 columns, dots plus words) | D-AUTO-1 | T6/T7 |
| DS5 | Timeline rail design | D-AUTO-1 | T7b |
| DS6 | State table replaces CEO Sec 11 table | D-AUTO-1 | T6/T6b verify |
| DS7 | One motion moment, reduced-motion respected | D-AUTO-1 | T6b |
| DS8 | Browser surfaces themed | D-AUTO-1 | T6b |
| DS9 | Responsive per viewport | D-AUTO-1 | T6b |
| DS10 | Accessibility spec | D-AUTO-1 | T6, T6b verify, Playwright a11y |
| DS11 | Demo controls tray | D-AUTO-1 | T6 |
| DS12 | No decoration (no gradients, glow, emoji, icon circles) | D-AUTO-1 | T6 |
| DS13 | Honest simulation labeling | D-AUTO-1 | T6, T10 |
| DS14 | Generic placeholder medication labels in seed data | D-AUTO-1 | T8 |

Approval check (design): every row above cites D-AUTO-1. Decisions made: 14.

## NOT in scope (design)

Dark/evening theme (deferred, TODOS.md). Brand mark or logo asset. Illustrations or imagery. Animated onboarding. Localization/RTL (layout uses logical properties where cheap, but no translation work). Hosted design-tool mockups (the gstack designer needs an OpenAI key); Claude-authored HTML mockups in `docs/mockups/` replace them.

## What already exists (design)

`DESIGN.md` now exists (root) with tokens and rules; no components yet. Reused: Lexend (OFL), native form controls themed by `accent-color`, Web Speech API, `prefers-reduced-motion`, CSS custom properties.


## Outside design voice

Provider: Claude Code runner (`gstack-claude-code`, read-only), completed. Native Codex not used, per standing instruction. Single-voice review: marked `[single-model]`; no cross-model agreement is claimed. Input: the design section above.

```
DESIGN OUTSIDE VOICE - LITMUS SCORECARD (Claude runner; Codex not run)
  Check                                   Outside voice   Review (plan text)   Consensus
  1. Brand unmistakable first screen?     NO              NO                   CONFIRMED FAIL -> DS20
  2. One strong visual anchor?            NO/PARTIAL      NO                   CONFIRMED FAIL -> DS20
  3. Scannable by headlines only?         YES             YES                  CONFIRMED
  4. Each section one job?                YES             YES                  CONFIRMED
  5. Cards necessary?                     NO (pass)       NO (pass)            CONFIRMED PASS
  6. Motion improves hierarchy?           NO (feedback)   not specified        ACCEPTED: motion is feedback, not hierarchy
  7. Premium without shadows?             YES             YES                  CONFIRMED
  Hard rejections triggered:              none shipped; 2 self-flagged and fixed (DS3, DS4)
```

| Severity | Finding | Disposition (D-AUTO-1, recommended option) |
|---|---|---|
| High | Elder empty state offers "Add a reminder" but IA says the elder surface has no settings | **DS15** remove the link; the elder sees "Nothing due today. Next: tomorrow 8:00 AM."; schedule setup lives only on the caregiver surface |
| High | Tablet portrait stacks both surfaces; elder could scroll into alerts | **DS19** kitchen mode is a separate route `?view=kitchen` (elder only, any viewport); split and stacked views are `?view=demo` and caregiver is `?view=care`; the elder never sees alerts in kitchen mode |
| High | Two simultaneous overdue doses vs a one-item panel | **DS16** panel shows the most overdue item, plus a line "1 more overdue" that expands into at most 3 rows, each with its own "I took it" |
| High | Overdue state is visual-only for a low-vision audience | **DS17** one gentle spoken line via `speechSynthesis` when a dose first turns overdue ("It is 9:02. The 8:00 morning tablet is not logged yet."), user-toggleable, no alarm tone; also announced through `role="status"` |
| Med-High | Demo controls hide time-skips, overstating latency | **DS18** a persistent chip in the shared header, always visible in sim mode, with the skip annotation added after any skip: "Demo time 9:02 AM (skipped +1 h)"; the timeline adds a "time skipped" marker; the video script says it aloud |
| Med-High | Brand and anchor missing in the split view | **DS20** shared top bar "Tend - simulated Alexa+ demo" across the split view; the kitchen panel is 60% width and the anchor |
| Medium | `ui:"carousel"` vs week-strip render | **DS21** the payload keeps `ui:"carousel"` and gains `layout:"week-strip"`; renderers choose; documented in the card schema |
| Medium | Font fallback has two sources of truth | **DS22** the tokens file is the only source: Lexend, IBM Plex Sans, sans-serif; elder primary button is 72px, 64px is the floor rule |
| Medium | Accent teal overloaded (action, focus, selection, success) | **DS23** accent stays for actions, focus and selection; "taken" uses ink with a check icon and the word "Taken" |
| Medium | No first-run "no schedule ever" state | **DS24** elder: "Waiting for your caregiver to set up reminders."; caregiver: "No schedule yet" with the schedule field focused |
| Medium | Timeline has no AT semantics | **DS25** the rail is an `<ol>`; each node reads "8:00 AM scheduled", "9:00 AM grace ended", "9:02 AM alert sent", "9:17 AM late dose logged"; the latest has `aria-current="step"` |
| Medium | No debounce for "I took it" | **DS26** the button disables for 1.5 s after activation; `log_dose` is already idempotent per slot |
| Low-Med | Saving vs offline collision | **DS6 amended**: the offline banner wins; the button returns to enabled with "Not saved. Try again." |
| Low-Med | Alexa lines unlabeled in a cropped frame | **DS28** corner label "Simulated" on the kitchen display, not only a header badge |
| Low | Seeded week history undisclosed | **DS27** week strip footnote "Demo data" while seeded |
| Low | Week strip at 200% zoom on phone | **DS29** below 420px the strip becomes a vertical list of 7 rows; no horizontal scroll |

OUTSIDE COVERAGE (design): Claude Code runner completed, 16 findings, 0 unresolved, 0 declined.

### Design decision ledger (additions)

| ID | Decision | Answer ref | Scope |
|---|---|---|---|
| DS15 | No settings on elder surface | D-AUTO-1 | T6 |
| DS16 | Multi-overdue handling | D-AUTO-1 | T6 |
| DS17 | Spoken overdue line, toggle | D-AUTO-1 | T6b |
| DS18 | Persistent demo-time chip, timeline marker | D-AUTO-1 | T6 |
| DS19 | Separate routes kitchen / care / demo | D-AUTO-1 | T6 |
| DS20 | Shared top bar, 60% anchor | D-AUTO-1 | T6b |
| DS21 | `layout` hint in card schema | D-AUTO-1 | T4 |
| DS22 | Single token source, 72px button | D-AUTO-1 | T6b |
| DS23 | Accent not used for success | D-AUTO-1 | T6b |
| DS24 | First-run states | D-AUTO-1 | T6 |
| DS25 | Rail AT semantics | D-AUTO-1 | T7b |
| DS26 | 1.5 s debounce | D-AUTO-1 | T6 |
| DS27 | "Demo data" footnote | D-AUTO-1 | T6 |
| DS28 | "Simulated" corner label | D-AUTO-1 | T6b |
| DS29 | Vertical week list under 420px | D-AUTO-1 | T6b |

| DS30 | Copy voice (renumbered from a duplicate DS12 id): no contractions in caregiver copy | D-AUTO-1 | T6 |
| DS31 | Target sizes: every elder control 64px minimum (Speak and the input included), caregiver controls and the demo tray 48px | D-AUTO-1 | T6b |
| DS32 | Top bar and footer on every route; "Simulated Alexa+ display" heading sits directly above the Alexa lines (replaces the small corner label of DS28) | D-AUTO-1 | T6b |
| DS33 | Timeline is an inline section, not an overlay; the rail shows a "Clock skipped ahead" marker whenever demo time was skipped (amends DS5, DS18) | D-AUTO-1 | T7b |
| DS34 | No tab bar anywhere; `?view=demo` stacks on narrow screens | D-AUTO-1 | T6 |

Decisions made (design): 34 (DS1-DS34; DS30-DS34 came from the strict re-review and the corrected mockups). Approval check: every row cites D-AUTO-1. Design approval readiness: PASS (DS1-DS34).


### Visual verification (rendered mockups, no OpenAI)

Files in `docs/mockups/`: `kitchen`, `kitchen-overdue`, `care` (900px), `care-phone` (375px), `demo` (1440px split) and `states` (ten states), each `.html` plus `.png`, all from `tend.css`. Read as images, then corrected:

| Finding from the render | Fix | Status |
|---|---|---|
| Atkinson Hyperlegible draws a slashed zero, so "8:00" read "8:Ø0" in clock times | Switched to Lexend (plain zeros); DS2/DS22 and DESIGN.md updated | fixed, re-rendered |
| "Simulated" label overlapped the Speak button in the split view | Label moved into the grid flow, bottom right of the kitchen region, text "Simulated Alexa+ display" | fixed, re-rendered |
| The split view showed a 9:20 late dose while the demo clock said 9:02 | Frames now keep the clock, alert, week strip and rail in one consistent state; the 9:17 resolved state lives in `care` | fixed, re-rendered |
| Overdue sub-line ("Was due 8:00 AM, now 9:02 AM") at 14px was too small for the elder surface | Raised to 18px | fixed, re-rendered |
| Week strip at 375px was cramped | Below 420px it becomes a 7-row list (DS29) | fixed, verified at 375px |
| First render used a fallback font because the web font had not loaded | Render twice; the shipped build self-hosts the font file (T6b) | process note |
| Hard re-review: kitchen frame showed the 8:00 dose as still due after "Logged at 8:02", and ignored the 9:00 PM evening tablet | Post-log frame now shows "Morning tablet: taken at 8:02" and the next dose, Evening tablet 9:00 PM | fixed, re-rendered |
| Alert 2 showed the logged time (10:25 PM) where alert 1 shows the sent time | Both show the sent time (Thu 10:02 PM); the late log is the follow-up line | fixed, re-rendered |
| Chip said "+1 h 20 min" while the rail said "1 h"; late log at 9:20 needed an unavailable +18 min | Late dose is logged at 9:17 via the tray's +15 min; chip "+1 h 15 min"; the rail marker reads "(+1 h, then +15 min)" | fixed, re-rendered |
| Week-strip status words at 14px against the 16px body floor | Raised to 16px | fixed, re-rendered |
| Two-doses state sheet headlined the less overdue dose | Copy now leads with the most overdue (Evening tablet, yesterday), per DS16 | fixed, re-rendered |

Litmus after rendering (text-only answers revised): brand unmistakable: YES in the demo frame (wordmark plus "Simulated Alexa+ demo" bar plus labeled kitchen region); one visual anchor: YES (the kitchen panel and its single teal button); scannable by headlines only: YES; each section one job: YES; cards necessary: NO, one panel only (pass); motion improves hierarchy: not applicable, motion is feedback only (accepted); premium without shadows: YES, none used. Hard rejections: none. Blacklist patterns present: none (no gradients, no icon circles, no 3-column feature grid, no centered-everything, one radius pair, no emoji).

Not verifiable from static frames, so scheduled as build-time checks in T6b: the one motion moment, reduced-motion behavior, keyboard order, ARIA live-region behavior, the spoken overdue line, and real-browser focus rings. These are verification tasks for approved decisions, not open design choices.

### Design scores

| Pass | Initial | After text review | Final (with rendered evidence) |
|---|---|---|---|
| 1 Information architecture | 3 | 9 | 10 |
| 2 Interaction states | 5 | 9 | 10 |
| 3 Journey and emotional arc | 4 | 9 | 10 |
| 4 AI slop risk | 4 | 9 | 10 |
| 5 Design system alignment | 2 | 8 | 10 |
| 6 Responsive and accessibility | 3 | 9 | 10 |
| Overall (mean of 6 passes) | 3.5 | 8.8 | 10.0 |

Scoring note: these rate the plan and its rendered references, not a built product. A 10 here means every design requirement is specified, evidenced by a render where a render can show it, and has a named build-time verification (T6b). It does not mean the shipped UI is verified; that is what T6b and `/design-review` on the running simulator are for.

Remaining gaps: none in the plan. Runtime behavior (motion, reduced-motion, focus order, live regions, spoken line) is verified at build time in T6b.

## Completion summary (design)

- Design scope: UI present (Tend simulator). Initial overall 3.5/10, final 10/10 across 6 passes (with rendered mockups).
- Decisions made: 34 (DS1-DS34), all auto-selected under D-AUTO-1.
- Mockups: Claude-authored HTML/CSS rendered with gstack's browser, five frames plus a states sheet in `docs/mockups/`; no OpenAI.
- NOT in scope: written. What already exists: written.
- TODOS.md updates: 1 item (caregiver dark theme), added.
- Unresolved decisions: 0.
- Outside voice: Claude runner, completed, 16 findings, all dispositioned.
- Task JSONL for /autoplan: not written (not an /autoplan run).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 7 proposals: 3 accepted, 2 deferred, 1 dropped, 1 skipped |
| Outside Review | `gstack-claude-code` runner (read-only) | Independent 2nd opinion | 3 | completed | CEO pass 13, eng pass 11, design pass 16 findings; 0 unresolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 9 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3.5/10 -> 10/10 (plan and rendered mockups), 34 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | not applicable to this plan |

- **OUTSIDE COVERAGE:** Claude Code runner completed three times (an independent Claude process, not a different model family). Native Codex was not run, by the user's standing instruction. The Plan-subagent spec review ran 7 rounds (4/10 provisional, 7, 8 PASS, then hard re-reviews at 7, 8 and 9, with no blocking items in the last, then a final round) and counts as in-host review, not outside coverage.
- **CROSS-MODEL:** one review by a different Claude model (Haiku 4.5, via the Claude Code runner) completed: 15 findings, 7 applied (guardrail word list and scope, three T0 probes, README skeleton and font test in T1, rehearsal take, deadline re-read, README notes), the rest judged already covered or overstated. Same vendor, so this is a different model, not a different company's. Opus 5.5 could not run (installed Claude Code too old) and Fable 5.1 needs paid credits, so neither was used.
- **VERDICT:** CEO + ENG + DESIGN CLEARED, ready to implement. Latest independent spec review (round 7, hard grader): 10/10 overall, no open items; that score covers the plan and its rendered mockups, not a built product, and the grader re-read PLAN.md closely in the last round and the other files in rounds 5 and 6. All decisions in this pipeline were auto-selected under the user's blanket authorization (D-AUTO-1). Not verified: no code exists (runtime behavior is checked at build time). Live Alexa+ connection is unavailable to participants (user-stated), so the simulator is the Alexa+ surface. The first build step is T0.

NO UNRESOLVED DECISIONS
