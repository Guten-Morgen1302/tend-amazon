# T0 spike results (Oct 9 2026)

## What was checked on this machine
- Node v24.10.0; `node:sqlite` loads (prints ExperimentalWarning). `engines.node >= 22.13` is set.
- `@modelcontextprotocol/sdk` 1.32.1 (Zod peer `^3.25 || ^4.0`; Zod 4.6.5 installed): supports `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and `enableJsonResponse: true` (stateless JSON), `registerTool` with `outputSchema`, and `structuredContent`. `LATEST_PROTOCOL_VERSION` is `2025-11-25`, so the track's minimum is met. Gate passed.
- Probe 1 (stateless JSON): a tool call over plain HTTP POST works with no `initialize` and no session; verified by `test/http.test.ts` and by curl.
- Probe 2 (`structuredContent`): the result shape is `{ content: [{type:"text", text}], structuredContent: <card> }`; `outputSchema` is the card Zod schema; verified by `test/http.test.ts`.
- Probe 3 (Inspector CLI headless on Windows): works (`mcp-inspector --cli <url> --transport http --method tools/list`). Quirks recorded in `FRICTION.md` entries 2 to 4; `npm run conformance` handles them.
- Path is `C:\Hackathons\...`, not a OneDrive or Dropbox folder.

## Alexa+ access
- User-stated (Oct 9): hackathon developers cannot connect an MCP server to a live Alexa+; the toolkit is not available to participants. Not independently verified: Amazon doc URLs I tried returned 404 to a scripted fetch.
- Verified from the rules text (`docs/rules-snapshot.md`): a simulated Alexa+ web app is an allowed path, with the simulation source in the repo and a demo showing it working. Tend ships both a real MCP server and the simulator.

## Not checked
- The live Devpost form fields and the exact live deadline (the page was not fetchable here); `docs/submission-checklist.md` is drafted from the rules text and must be confirmed against the form at submission.
- Content policy for medication-related apps: the rules text lists no such restriction; Tend is labeled not a medical device and gives no advice.
