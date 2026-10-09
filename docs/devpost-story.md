## Inspiration

About half of patients with a chronic illness don't take their medicines as prescribed ([Brown and Bussell, Mayo Clinic Proceedings, 2011](https://pubmed.ncbi.nlm.nih.gov/21389250/)). In a family, "did Mom take her pills?" gets answered with sticky notes and a group chat that forgets. A voice assistant is already in the room, but it has no memory and can't tell the right person anything. We wanted a small, honest slice of that idea: durable care state, and one alert to the caregiver when a dose is missed.

## What it does

Tend is a real MCP server (Streamable HTTP, stateless, protocol 2025-11-25 or later) with eight tools that keep a medication schedule, log doses, apply a miss rule and queue caregiver alerts.

- A dose slot is **missed** 60 minutes after it is due (one 30-minute snooze allowed). Tend then queues **exactly one** alert for that slot, even if the check runs a hundred times from two processes.
- A **late dose resolves the alert** with a follow-up line ("Logged at 9:17 AM, 77 minutes late.") and sends no second message.
- Every tool returns a typed **card** (`structuredContent` plus a text fallback). A simulated Alexa+ display (kitchen view) and a caregiver view render those cards.
- Tend **never gives medical advice**. A guardrail checks every outgoing text, and medication names with advice words are rejected when saved.

**What is real and what is simulated:** the MCP server, its state, the miss rule and the alerts are real. The Alexa+ display and the intent router are a simulation, labeled as such everywhere. We did not use a live Alexa+. There is **no AI model** in the product: the parser and router are deterministic and the messages are fixed templates. It costs $0 and needs no accounts or keys. It is not a medical device and uses synthetic data only.

## How we built it

Node 22+ and TypeScript, the official MCP TypeScript SDK, Zod (the card contract is defined once and emitted as JSON Schema, with a test that fails on drift), and `node:sqlite`. A server-side simulator host acts as the MCP client, so the browser never speaks MCP. Slots are keyed by `(person, item, local date, local time)` and written once, so daylight-saving changes and schedule edits can't create duplicates. The alert row has a unique key, and the missed state and the queued notification are written in one transaction. The UI is plain HTML and JavaScript, Lexend as the typeface, built to a design system we wrote before coding. The demo video was made with Remotion from real recordings of the running app.

## Challenges we ran into

- **Idempotency under a race.** We test it with two separate OS processes hitting one SQLite file; it produces one alert, not two.
- **A guardrail that matched nothing.** A shell heredoc ate the backslashes in its regular expression. Our tests caught it, and now every template, the demo script and every on-screen string are checked against the guardrail.
- **Time.** Spring-forward and fall-back days, nonexistent local times, and a demo clock you can skip without hiding that you skipped.
- **Tooling friction.** The MCP Inspector CLI exits non-zero when a tool correctly returns `isError`, mangles arguments through a shell on Windows, and crashes on exit there. We logged these in `FRICTION.md` with workarounds.
- **No live Alexa+.** So we built the simulation path the rules allow and kept the server real.

## Accomplishments that we're proud of

- 61 unit and integration tests, 13 browser tests, and a conformance check where the MCP Inspector connects, lists all eight tools and calls each one.
- CI green on Windows and Linux, Node 22.13 and 24.
- A design reviewed against real rendered screenshots, with measured contrast and a phone layout.
- A fresh `git clone`, `npm install`, `npm start` runs the whole demo in about two minutes with nothing to sign up for.

## What we learned

A stateless MCP server is simple and robust, but the docs lead with sessions. Honest labeling (what is real, what is simulated) makes a project easier to trust. The most valuable test in the repo is the one that tries to break the main promise.

## What's next for Tend: a care-coordination MCP server

Multiple caregivers with roles and quiet hours, a real Alexa+ skill if the toolkit opens to developers, a Fire TV companion screen for the elder, and a clinician-reviewed schedule format. Not done yet and not claimed: real push or SMS delivery, authentication beyond a bearer token, and any clinical validation.
