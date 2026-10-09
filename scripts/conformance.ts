// npm run conformance: a connectivity and call check, not the full protocol suite.
// Starts tend-server on a free port, then drives the MCP Inspector CLI to connect, list the 8 tools and call each one.
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { start } from "../src/server/main.js";
import { TOOL_NAMES } from "../src/server/mcp.js";

const { server } = await start({ host: "127.0.0.1", port: 0, tz: "Asia/Kolkata", clockMode: "sim", dbPath: ":memory:" });
const port = (server.address() as AddressInfo).port;
const url = `http://127.0.0.1:${port}/mcp`;
const LAUNCHER = resolve("node_modules", "@modelcontextprotocol", "inspector", "clients", "launcher", "build", "index.js");

// Async spawn on purpose: the server runs in this process, so the event loop must stay free to answer the Inspector.
function inspector(extra: string[]): Promise<any> {
  return new Promise((ok, bad) => {
    // No shell: arguments with spaces and JSON stay intact on Windows and Linux.
    const p = spawn(process.execPath, [LAUNCHER, "--cli", url, "--transport", "http", ...extra]);
    let out = ""; let err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => { p.kill(); bad(new Error("Inspector timed out")); }, 90000);
    p.on("close", (code) => {
      clearTimeout(timer);
      // The CLI exits non-zero when a tool returns isError; that is a valid, expected result for the snooze check.
      if (/"code"\s*:\s*"tool_is_error"/.test(err + out)) return ok({ isError: true });
      if (code !== 0) return bad(new Error(`Inspector failed (${code}): ${err || out}`));
      try { ok(JSON.parse(out)); } catch { bad(new Error(`Inspector printed non-JSON: ${out.slice(0, 200)}`)); }
    });
  });
}

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`); if (!ok) failures++; };

try {
  const list = await inspector(["--method", "tools/list"]);
  const names: string[] = list.tools.map((t: { name: string }) => t.name).sort();
  check("tools/list returns the 8 tools", JSON.stringify(names) === JSON.stringify([...TOOL_NAMES].sort()), names.join(", "));

  const calls: [string, string[]][] = [
    ["whats_due", []], ["weekly_summary", []], ["list_notifications", []], ["check_misses", []],
    ["parse_schedule", ["text=Morning tablet at 8am daily"]],
    ["log_dose", ["item=morning"]],
    ["snooze", ["item=evening"]], // not due yet: a clean isError result is the correct answer
    ["set_schedule", ['items=[{"name":"Morning tablet","time":"08:00"},{"name":"Evening tablet","time":"21:00"}]']],
  ];
  for (const [name, args] of calls) {
    const r = await inspector(["--method", "tools/call", "--tool-name", name, ...args.flatMap((a) => ["--tool-arg", a])]);
    const expectError = name === "snooze";
    const hasCard = r.structuredContent && typeof r.structuredContent.title === "string";
    check(`tools/call ${name}`, expectError ? r.isError === true : !r.isError && hasCard, expectError ? "clean isError (not due yet)" : r.content?.[0]?.text?.slice(0, 60));
  }
} catch (e) {
  check("conformance run", false, (e as Error).message);
} finally {
  server.close();
}
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
