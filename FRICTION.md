# Friction log

Real problems hit while building Tend. Format: task, steps, expected vs actual, severity, workaround, suggestion.

## 1. Alexa+ cannot be reached by hackathon participants
- **Task:** Connect an MCP server to a live Alexa+ for the Alexa+ track.
- **Steps:** Read the rules and tried to find the participant path; fetched Amazon developer pages for Alexa+ MCP docs.
- **Expected:** A documented way for participants to connect a self-hosted MCP server to Alexa+.
- **Actual:** The only statement found is community-sourced (reported by the builder, not confirmed in Amazon docs): the Alexa+ add-on toolkit is not open to participants. Several Amazon doc URLs I tried returned 404 to a scripted fetch.
- **Severity:** High for the track's headline promise.
- **Workaround:** Built a simulated Alexa+ web app and kept the MCP server real, which the rules allow.
- **Suggestion:** State plainly on the hackathon page whether participants can reach Alexa+ at all, and link a working quickstart or a local Alexa+ simulator that renders MCP results and cards.

## 2. MCP Inspector CLI exits non-zero when a tool returns isError
- **Task:** Script a conformance check that calls every tool.
- **Steps:** Ran `mcp-inspector --cli <url> --transport http --method tools/call --tool-name snooze` for a call that correctly returns `isError: true`.
- **Expected:** Exit 0 with the isError result printed, since the protocol call succeeded.
- **Actual:** Exit 1 with `{"error":{"code":"tool_is_error"...}}`, so a correct error result looks like a crash.
- **Severity:** Medium.
- **Workaround:** The script treats `tool_is_error` as the expected result for that case.
- **Suggestion:** Print the result and exit 0 by default, with a flag such as `--fail-on-tool-error`.

## 3. MCP Inspector CLI through npx and a shell breaks arguments on Windows
- **Task:** Pass `--tool-arg text=Morning tablet at 8am daily` and JSON arguments.
- **Steps:** Spawned `npx mcp-inspector ...` with a shell.
- **Expected:** Arguments with spaces and JSON survive.
- **Actual:** `Invalid parameter format: tablet. Use key=value format.` The shell split the value.
- **Severity:** Medium.
- **Workaround:** Spawn `node node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js` directly with no shell. That path is not documented as an entry point.
- **Suggestion:** Document the programmatic or no-shell invocation, or accept `--tool-arg-json`.

## 4. Inspector CLI crashes after printing its result on Windows
- **Task:** Run the same script on Windows.
- **Steps:** Called a tool that returns `isError`.
- **Expected:** Clean exit.
- **Actual:** After the JSON error, the process died with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76` (exit code 3221226505).
- **Severity:** Low (output is still correct).
- **Workaround:** Read the printed JSON first and ignore the exit code for the expected-error case.
- **Suggestion:** Close handles before `process.exit` in the CLI error path.

## 5. node:sqlite prints an ExperimentalWarning on every start
- **Task:** Use SQLite with no native build step on Windows.
- **Steps:** `import { DatabaseSync } from "node:sqlite"` on Node 24.
- **Expected:** Stable built-in or a quiet opt-in.
- **Actual:** Works well (it avoided a `better-sqlite3` native build), but every process prints `ExperimentalWarning: SQLite is an experimental feature`, including each child process in tests.
- **Severity:** Low.
- **Workaround:** Documented in the README; tests strip the line when asserting on stderr.
- **Suggestion:** Stabilize the module, or document `--disable-warning=ExperimentalWarning` for it.

## 6. A stateless MCP server is easy, but the docs lead with sessions
- **Task:** Serve tools with no session state.
- **Steps:** Read the Streamable HTTP examples, then tried `sessionIdGenerator: undefined` with `enableJsonResponse: true`.
- **Expected:** An obvious stateless recipe.
- **Actual:** It works well (a tool call needs no `initialize`, a new server per request is fine) but I only found it by reading the `.d.ts` comments. Most examples show the stateful path.
- **Severity:** Low (positive finding with a docs gap).
- **Workaround:** Read the SDK's type docs.
- **Suggestion:** Add a first-class "stateless JSON" example to the quickstart.

## 7. Official reference for the headline adherence statistic is hard to fetch
- **Task:** Cite a source for medication non-adherence in the README.
- **Steps:** Tried the WHO report "Adherence to long-term therapies" on WHO IRIS.
- **Expected:** A fetchable page or PDF.
- **Actual:** HTTP 403 and an HTML wall for scripted access, so I could not verify the figure there.
- **Severity:** Low.
- **Workaround:** Cited a PubMed-indexed review whose abstract I could read directly (Brown and Bussell 2011).
- **Suggestion:** Not for the hackathon team: an agent-readable abstract link would help everyone who cites it.
