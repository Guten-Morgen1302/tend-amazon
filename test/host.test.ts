import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, statSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { start } from "../src/server/main.js";
import { createHost, formatSkip } from "../src/sim/host.js";
import { makeCore } from "./helpers.js";

let tend: Awaited<ReturnType<typeof start>>; let host: Server; let base = "";

beforeAll(async () => {
  tend = await start({ host: "127.0.0.1", port: 0, tz: "Asia/Kolkata", clockMode: "sim", dbPath: ":memory:" });
  const tendPort = (tend.server.address() as AddressInfo).port;
  host = createHost({ port: 0, tendUrl: `http://127.0.0.1:${tendPort}/mcp` });
  await new Promise<void>((ok) => host.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(host.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((ok) => host.close(() => ok()));
  await new Promise<void>((ok) => tend.server.close(() => ok()));
});

const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<any>);

describe("sim-host", () => {
  it("routes utterances to MCP tools through a real MCP client", async () => {
    await post("/api/reset", {});
    const due = await post("/api/say", { text: "What's due?" });
    expect(due.intent).toBe("whats_due");
    expect(due.reply).toBe("Your morning tablet is due at 8:00 AM.");
    expect(due.state.chip).toBe("Demo time 8:02 AM");
    const logged = await post("/api/say", { text: "I took my morning pills" });
    expect(logged.intent).toBe("log");
    expect(logged.card.data.result).toBe("logged");
    const unknown = await post("/api/say", { text: "tell me a joke" });
    expect(unknown.reply).toMatch(/I didn't understand/);
  });

  it("clock skips refresh immediately and track a skip label; reset clears it", async () => {
    await post("/api/reset", {});
    const r = await post("/api/clock", { advance_minutes: 60 });
    expect(r.state.chip).toBe("Demo time 9:02 AM (skipped +1 h)");
    expect(r.state.due.data.mode).toBe("overdue");
    expect(r.state.skipLabel).toBe("Clock skipped ahead (+1 h)");
    const r2 = await post("/api/clock", { advance_minutes: 15 });
    expect(r2.state.skipLabel).toBe("Clock skipped ahead (+1 h, then +15 min)");
    const reset = await post("/api/reset", {});
    expect(reset.state.skipLabel).toBeNull();
    expect(reset.state.chip).toBe("Demo time 8:02 AM");
  });

  it("only allows the whitelisted actions and validates clock input", async () => {
    expect((await fetch(base + "/api/action", { method: "POST", body: JSON.stringify({ tool: "drop_everything" }) })).status).toBe(400);
    expect((await fetch(base + "/api/clock", { method: "POST", body: JSON.stringify({ advance_minutes: "lots" }) })).status).toBe(400);
    expect((await fetch(base + "/api/say", { method: "POST", body: "{bad" })).status).toBe(400);
  });

  it("serves static files safely with a strict CSP and blocks path traversal", async () => {
    const r = await fetch(base + "/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect((await fetch(base + "/..%2f..%2fpackage.json")).status).not.toBe(200);
    expect((await fetch(base + "/nope.js")).status).toBe(404);
    expect((await fetch(base + "/fonts/Lexend-Variable.ttf")).status).toBe(200);
  });

  it("reports offline (not a crash) when tend-server is unreachable", async () => {
    const lonely = createHost({ port: 0, tendUrl: "http://127.0.0.1:1/mcp" });
    await new Promise<void>((ok) => lonely.listen(0, "127.0.0.1", ok));
    const b = `http://127.0.0.1:${(lonely.address() as AddressInfo).port}`;
    const s = await (await fetch(b + "/api/state")).json();
    expect(s).toEqual({ offline: true });
    await new Promise<void>((ok) => lonely.close(() => ok()));
  });

  it("formats skip labels", () => {
    expect(formatSkip(60)).toBe("+1 h");
    expect(formatSkip(15)).toBe("+15 min");
    expect(formatSkip(75)).toBe("+1 h 15 min");
    expect(formatSkip(0)).toBe("");
  });
});

describe("self-hosted font", () => {
  it("ships the Lexend file and its OFL text, and the CSS loads it locally", () => {
    const f = "src/sim/ui/fonts/Lexend-Variable.ttf";
    expect(statSync(f).size).toBeGreaterThan(100_000);
    expect(readFileSync(f).subarray(0, 4).toString("hex")).toBe("00010000"); // TrueType header
    expect(readFileSync("src/sim/ui/fonts/OFL.txt", "utf8")).toContain("SIL OPEN FONT LICENSE");
    const css = readFileSync("src/sim/ui/tend.css", "utf8");
    expect(css).toContain("/fonts/Lexend-Variable.ttf");
    expect(css).not.toMatch(/fonts\.googleapis|@import/);
  });
});

describe("notifications", () => {
  it("mark_read marks everything read", () => {
    const { core, clock } = makeCore();
    clock.advance(60); core.checkMisses("mom");
    expect(core.notifications("alex").filter((n) => !n.read)).toHaveLength(1);
    core.notifications("alex", true);
    expect(core.notifications("alex").filter((n) => !n.read)).toHaveLength(0);
  });
});
