# Build status (Oct 9 2026)

## Built and verified
| Plan task | State | Evidence |
|---|---|---|
| T0 spike | done | `docs/spike-alexa.md` (SDK supports stateless JSON, structuredContent, protocol 2025-11-25; Inspector works headless on Windows) |
| T1 scaffold | done | LICENSE (MIT), README, FRICTION.md, THIRD_PARTY.md, Lexend + OFL, CI workflow, `.gitignore`; fresh `git clone` then `npm ci`, typecheck, tests and conformance all pass |
| T2 MCP server | done | stateless Streamable HTTP, Origin/Host allowlists, bearer when hosted, `/admin/*` sim-only, `npm run conformance` passes (Inspector connects, lists 8 tools, calls each) |
| T3 core | done | miss rule, one escalation per slot, DST-safe slots, snooze, late-dose resolution; two-OS-process concurrency test passes |
| T4 tools | done | 8 tools, Zod card contract emitted to `schemas/card.schema.json` and diffed in a test, audit log, JSON request log, `/health` |
| T5 parser, templates, guardrail | done | 10-case golden set, guardrail tests (every template, demo script and mockup string passes) |
| T6 simulator | done | sim-host (server-side MCP client) + UI, routes kitchen/care/demo, tray, demo-time chip, offline banner |
| T6b design | done | built to `DESIGN.md`; real screenshots in `docs/screens/` compared with `docs/mockups/` |
| T7a voice, T7b timeline | done | runtime-failure fallback tested; timeline with clock-skipped marker |
| T8 seed | done | idempotent; reset reproduces identical rows |
| T9 CI | done | Pushed to https://github.com/Guten-Morgen1302/tend-amazon; Actions green on Ubuntu and Windows, Node 22.13 and 24 (typecheck, tests, conformance, e2e) |
| T10 docs | done except impact check | README written; one cited statistic (Brown and Bussell 2011, PubMed abstract read directly) |

Tests: 61 unit/integration (vitest) + 13 Playwright e2e + conformance, all passing.

## Left for the owner
1. ~~Create the repo and push~~ done. The repo is currently **public** with MIT detected; switch it to private in Settings if you prefer, then share it with the reviewers at submission (see `docs/submission-checklist.md`).
2. **Record the demo video** (<3:00, public on YouTube) following `docs/demo-script.md`; take the voice shot in Chrome or Edge.
3. **Open Source mini challenge (T12), optional:** open a docs or example PR to `modelcontextprotocol/typescript-sdk` or the MCP Inspector repo; `FRICTION.md` entries 2, 3, 4 and 6 are real candidates.
4. **Fill the Devpost form** using `docs/submission-checklist.md`; confirm the live deadline and fields. Product feedback entries come from `FRICTION.md`.
5. Re-read the README impact paragraph: its statistic came from a PubMed abstract, not the WHO PDF (which was not fetchable).
