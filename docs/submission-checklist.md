# Submission checklist (Devpost, Amazon Developer Hackathon 2026)

Source: the official rules text as provided on Oct 9 2026 (key clauses saved verbatim in `docs/rules-snapshot.md`). Re-confirm each line against the live "Enter a Submission" form in T0 (l) and tick it off in T11. Deadline: Oct 24 2026 00:30 GMT+5:30 (Devpost page) = Fri Oct 23 2026 12:00 PM PDT (UTC-7; arithmetic checked, and an AI-search summary the user pasted on Oct 9 gives the same moment); internal target Oct 22 18:00 IST (Oct 22 05:30 AM PDT). T0 still reads the live form.

## Required
- [ ] Project title and short description of what it does and how it works (mention what is real and what is simulated: spec-conformant MCP server with durable state is real; the Alexa+ display and the intent router are simulated).
- [ ] Primary track: **Alexa+** (simulated Alexa+ experience path; MCP server, spec 2025-11-25 or later, Streamable HTTP).
- [ ] Mini challenges entered: **Open Source** only, if T12 ships (AWS Builder dropped: zero-spend decision).
- [ ] GitHub repository URL. Public with a detectable open-source license (MIT) in the About box, README with setup and run instructions at the top. Fallback only: private repo shared with testing@devpost.com and chris-trag, knmeiss, giolaq, anishamalde, mosesroth, emersonsklar (invitations expire in 7 days; add at submission time).
- [ ] Source for the simulation is in the repo (rules: the simulated path still needs its source and a demo showing it working).
- [ ] Demo video: under 3:00, public on YouTube or Vimeo, English, shows the project working (the simulator plus the MCP server), no third-party trademarks or copyrighted music, "Simulated Alexa+ display" label visible on screen.
- [ ] Product feedback, one entry per tool or SDK used (see list below): what it was used for, what worked, what needs work, onboarding, would build again (yes/no and why).
- [ ] If the project existed before the hackathon: explanation of what was built during the window. (It did not: state "built during the submission window".)

## Mini-challenge fields (each only if that mini challenge is entered)
- [ ] Open Source: contribution URL, project repository URL, GitHub username, and a description of what was done, how it works, why it matters. Also link the contribution from the README.

## Optional but scored
- [ ] Friction log (up to 10% judging bonus): entries with task, steps, expected vs actual, severity, workaround, suggestion. Source: `FRICTION.md` (at least 5 entries). Attach as a link to the file in the repo and paste into the Devpost field if one exists (T0 records how the form accepts it).
- [ ] Feature requests: description, why it matters, priority (critical, important, nice-to-have).

## Tools and SDKs needing feedback entries
1. `@modelcontextprotocol/sdk` (TypeScript SDK, server and client, Streamable HTTP)
2. MCP Inspector (CLI mode, conformance script)
3. Amazon Devices Builder Tools or Alexa+ documentation, as far as they were read (including the finding that live Alexa+ connection is unavailable to participants)
4. Devpost form and rules (onboarding feel)
Each entry is derived from `FRICTION.md`; none may be invented.

## Verification (T11 ticks these)
- [ ] Every checklist line above has an artifact or a link.
- [ ] Video length read from YouTube, under 3:00.
- [ ] `grep -ri "alexa" README.md docs/ <submission text>`: every mention is labeled simulated or describes the track.
- [ ] LICENSE detected by GitHub; repo public (or fallback shares sent).
