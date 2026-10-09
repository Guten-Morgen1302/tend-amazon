# Devpost form answers (copy and paste)

## Additional info
- **Upload file:** skip (optional). Everything is in the repo.
- **Submitter type:** Individual
- **Organization name:** N/A
- **Country of residence:** your own (the owner picks)
- **Canada province:** N/A
- **Primary track:** Alexa+
- **Code repository URL:** https://github.com/Guten-Morgen1302/tend-amazon
- **New or existing before Aug 31 2026:** New. Built during the submission period (first commit Oct 9 2026).
- **AWS Builder Mini Challenge:** No. Tend uses no AWS service. Leave the description box empty or write "N/A: no AWS services used."
- **Open Source Mini Challenge:** No, unless you open a pull request first. The rules ask for a new, additional project or a contribution to a public repository alongside the primary submission; Tend itself is the primary submission, so do not claim it unless a real contribution URL exists. If you open one (see `docs/STATUS.md`), fill: contribution URL, repo URL above, your GitHub username `Guten-Morgen1302`, and a description of what, how and why.

## Optional fields
- **Friction log:** https://github.com/Guten-Morgen1302/tend-amazon/blob/main/FRICTION.md
- **Project testing link:** https://github.com/Guten-Morgen1302/tend-amazon#quick-start-about-two-minutes (no hosted demo: it runs locally with `npm install && npm start`, no accounts or keys)

### Feature requests
1. **Alexa+ access for hackathon participants, or a local Alexa+ simulator that renders MCP results and cards.** Why it matters: the track's headline is connecting an MCP server to Alexa+, but we could not reach it, so we built a stand-in and could not test how cards really render. Priority: **Critical**.
2. **MCP Inspector CLI: print the result and exit 0 when a tool returns `isError`, with a flag such as `--fail-on-tool-error`.** Why: a correct error result looks like a crash in scripted conformance checks. Priority: **Important**.
3. **A first-class "stateless JSON" example in the MCP TypeScript SDK quickstart.** Why: we found it only by reading type comments; most examples show sessions. Priority: **Nice-to-have**.
4. **Inspector CLI: accept `--tool-arg-json` and document a no-shell launcher entry point.** Why: arguments with spaces break through a shell on Windows. Priority: **Important**.

## Product feedback

**Q1. Which developer tools, APIs and SDKs did you use, and for what?**
- `@modelcontextprotocol/sdk` 1.32 (TypeScript): the MCP server (stateless Streamable HTTP, `registerTool`, `outputSchema`, `structuredContent`) and the MCP client inside the simulator host.
- MCP Inspector CLI: connectivity and call check (`npm run conformance`) that lists the 8 tools and calls each.
- Zod 4: input validation and the card contract, emitted as JSON Schema.
- Node.js built-in `node:sqlite`: durable state with no native build.
- Playwright and Vitest: 13 browser tests and 61 unit and integration tests.
- GitHub Actions: CI on Windows and Linux, Node 22.13 and 24.
- Video only: Remotion, ffmpeg, and Google's Gemini text-to-speech for the voice-over. None of these is in the product.
- We did not use any Amazon SDK, Alexa+ toolkit, Fire TV, Bee or Ring API, or AWS service.

**Q2. What worked well?**
- The MCP TypeScript SDK made a spec-conformant server quick: `registerTool` with Zod schemas, automatic `tools/list`, and stateless mode with JSON responses worked first time. Protocol version 2025-11-25 is supported.
- `outputSchema` plus `structuredContent` gave us a clean typed-card contract with a text fallback.
- The Inspector CLI is genuinely useful for headless checks once it runs.
- `node:sqlite` avoided native-build problems on Windows and was fast enough for WAL and multi-process tests.
- Playwright, Vitest and Actions were reliable and fast.

**Q3. What needs work?** (details and workarounds in FRICTION.md)
- Alexa+: we could not connect to it as a participant; the only statement we found is community-sourced, and several Amazon doc URLs returned 404 to a scripted fetch. A clear statement on the hackathon page and a local simulator would help a lot.
- Inspector CLI: exits non-zero when a tool correctly returns `isError`; arguments with spaces break through a shell on Windows; the process crashed on exit on Windows (libuv assertion) after printing correct output.
- MCP SDK docs lead with sessions; the stateless JSON recipe is easy to miss.
- `node:sqlite` prints an ExperimentalWarning on every process start.

**Q4. How was onboarding (zero to hello world)?**
- MCP SDK: under 30 minutes to a working server and client; the type definitions were the best documentation.
- Inspector CLI: quick for listing tools, slower for scripted calls because of the issues above.
- Alexa+: no onboarding was possible for us.

**Q5. Would you build with these again? Yes/No, and why.**
- **Yes for MCP:** the standard is small, the SDK is solid, and a stateless server with typed results is a good fit for assistants.
- **For Alexa+:** yes, once participants can reach it. Without access we could only build a simulation, so we could not judge it.

## Closing questions
- **Eligibility checkboxes (age, jurisdiction, not an employee or agent of the promotion entities):** only you can tick these, after reading the rules.
- **Which AI tools did you use while working on this project?** Claude (Claude Code with Sonnet 5.5 and a Haiku 4.5 reviewer) for planning, code, tests, reviews and the demo-video project; Google Gemini (`gemini-3.8-flash-tts`) for the video's voice-over and `gemini-3.5-flash` to transcribe the lines back for checking. There is no AI model in the Tend product itself.
- **Level of learning:** your choice. An honest description: significant, in MCP's stateless Streamable HTTP, idempotent design under concurrency, and DST-safe scheduling.
- **Did you gain AI value you can use in your career?** Your choice.
