import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { makeCore } from "./helpers.js";
import { createTendServer } from "../src/server/http.js";
import { seedDemo } from "../src/seed/seed.js";
import { CardSchema, cardJsonSchema } from "../src/server/cards.js";
import { TOOL_NAMES } from "../src/server/mcp.js";
import { start, isLoopback } from "../src/server/main.js";

let server: Server; let base = ""; let port = 0; let ctx: ReturnType<typeof makeCore>;

beforeAll(async () => {
  ctx = makeCore();
  server = createTendServer(ctx.core, { host: "127.0.0.1", port: 0, onReset: () => seedDemo(ctx.core, "Asia/Kolkata") });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

async function client() {
  const c = new Client({ name: "test", version: "1" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return c;
}
const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => c.callTool({ name, arguments: args }) as Promise<any>;

describe("MCP over stateless Streamable HTTP", () => {
  it("negotiates the latest protocol version and lists exactly the 8 tools", async () => {
    const c = await client();
    expect(LATEST_PROTOCOL_VERSION >= "2025-11-25").toBe(true);
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    await c.close();
  });

  it("every tool returns a valid card with structuredContent and a text fallback", async () => {
    const c = await client();
    for (const [name, args] of [["whats_due", {}], ["weekly_summary", {}], ["list_notifications", {}], ["check_misses", {}], ["parse_schedule", { text: "Morning tablet at 8am daily" }]] as const) {
      const r = await call(c, name, args);
      expect(r.isError, name).toBeFalsy();
      expect(CardSchema.safeParse(r.structuredContent).success, name).toBe(true);
      expect(r.content[0].text.length, name).toBeGreaterThan(0);
    }
    await c.close();
  });

  it("parse_schedule never saves; a stale version is rejected by set_schedule", async () => {
    const c = await client();
    const before = ctx.core.schedule("mom").length;
    const p = await call(c, "parse_schedule", { text: "Noon tablet at 12pm" });
    expect(ctx.core.schedule("mom").length).toBe(before);
    const version = p.structuredContent.data.version;
    const ok = await call(c, "set_schedule", { items: [{ name: "Morning tablet", time: "08:00" }, { name: "Evening tablet", time: "21:00" }], version });
    expect(ok.isError).toBeFalsy();
    const stale = await call(c, "set_schedule", { items: [{ name: "Noon tablet", time: "12:00" }], version });
    expect(stale.isError).toBe(true);
    expect(stale.content[0].text).toMatch(/out of date/);
    await c.close();
  });

  it("a poisoned medication name is rejected before it can be stored or echoed", async () => {
    const c = await client();
    const r = await call(c, "set_schedule", { items: [{ name: "Aspirin 500 mg dosage", time: "08:00" }] });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/advice or dosing/);
    const xss = await call(c, "set_schedule", { items: [{ name: "<img src=x onerror=alert(1)>", time: "08:00" }] });
    expect(xss.isError).toBe(true);
    await c.close();
  });

  it("the demo flow over MCP: log, skip the clock, one alert, late dose resolves it", async () => {
    await fetch(`${base}/admin/reset`, { method: "POST" });
    const c = await client();
    await fetch(`${base}/admin/clock`, { method: "POST", body: JSON.stringify({ advance_minutes: 60 }) });
    const due = await call(c, "whats_due");
    expect(due.structuredContent.data.mode).toBe("overdue");
    await call(c, "check_misses"); await call(c, "check_misses");
    let n = await call(c, "list_notifications");
    expect(n.structuredContent.data.unread).toBe(1);
    await fetch(`${base}/admin/clock`, { method: "POST", body: JSON.stringify({ advance_minutes: 15 }) });
    const logged = await call(c, "log_dose", { item: "morning" });
    expect(logged.structuredContent.data.result).toBe("late");
    n = await call(c, "list_notifications");
    expect(n.structuredContent.data.total).toBe(2);
    expect(n.structuredContent.items[0].meta).toBe("Logged at 9:17 AM, 77 minutes late.");
    await c.close();
  });
});

describe("transport security", () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };

  it("refuses a bad Origin and a bad Host", async () => {
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: { ...headers, origin: "http://evil.example" }, body })).status).toBe(403);
    // Host cannot be overridden by fetch, so use a raw request
    const { request } = await import("node:http");
    const status = await new Promise<number>((ok, bad) => {
      const r = request({ host: "127.0.0.1", port, path: "/health", headers: { host: "evil.example" } }, (res) => { res.resume(); ok(res.statusCode ?? 0); });
      r.on("error", bad); r.end();
    });
    expect(status).toBe(403);
  });

  it("allows a request with no Origin (the server-side simulator host) and the loopback origin", async () => {
    expect((await fetch(`${base}/mcp`, { method: "POST", headers, body })).status).toBe(200);
    expect((await fetch(`${base}/mcp`, { method: "POST", headers: { ...headers, origin: `http://127.0.0.1:${port}` }, body })).status).toBe(200);
  });

  it("is stateless: GET and DELETE on /mcp are 405", async () => {
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
    expect((await fetch(`${base}/mcp`, { method: "DELETE" })).status).toBe(405);
  });

  it("rejects oversize and invalid JSON bodies", async () => {
    expect((await fetch(`${base}/mcp`, { method: "POST", headers, body: "{nope" })).status).toBe(400);
    expect((await fetch(`${base}/mcp`, { method: "POST", headers, body: "x".repeat(70 * 1024) })).status).toBe(413);
  });

  it("health works and unknown paths are 404", async () => {
    const h = await (await fetch(`${base}/health`)).json();
    expect(h).toMatchObject({ status: "ok", name: "tend", clockMode: "sim", db: "ok" });
    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });

  it("admin endpoints validate input", async () => {
    expect((await fetch(`${base}/admin/clock`, { method: "POST", body: JSON.stringify({ advance_minutes: -5 }) })).status).toBe(400);
    expect((await fetch(`${base}/admin/clock`, { method: "POST", body: JSON.stringify({ advance_minutes: 99999999 }) })).status).toBe(400);
    expect((await fetch(`${base}/admin/clock`)).status).toBe(405);
    expect((await fetch(`${base}/admin/clock`, { method: "POST", body: JSON.stringify({ jump_to: "next_slot" }) })).status).toBe(200);
  });
});

describe("hosted mode and real clock", () => {
  it("refuses to start on a non-loopback host without a token", async () => {
    expect(isLoopback("0.0.0.0")).toBe(false);
    await expect(start({ host: "0.0.0.0", port: 0, tz: "Asia/Kolkata", clockMode: "sim", dbPath: ":memory:" })).rejects.toThrow(/TEND_TOKEN/);
  });

  it("requires the bearer token when configured; /admin and tools/list stay hidden in real clock mode", async () => {
    const s = await start({ host: "127.0.0.1", port: 0, tz: "Asia/Kolkata", clockMode: "real", token: "s3cret", dbPath: ":memory:" });
    const p = (s.server.address() as AddressInfo).port;
    const h = { "content-type": "application/json", accept: "application/json, text/event-stream" };
    const b = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect((await fetch(`http://127.0.0.1:${p}/mcp`, { method: "POST", headers: h, body: b })).status).toBe(401);
    expect((await fetch(`http://127.0.0.1:${p}/mcp`, { method: "POST", headers: { ...h, authorization: "Bearer wrong" }, body: b })).status).toBe(401);
    const good = await fetch(`http://127.0.0.1:${p}/mcp`, { method: "POST", headers: { ...h, authorization: "Bearer s3cret" }, body: b });
    expect(good.status).toBe(200);
    expect(JSON.stringify(await good.json())).not.toContain("admin");
    expect((await fetch(`http://127.0.0.1:${p}/admin/clock`, { method: "POST", headers: { authorization: "Bearer s3cret" }, body: "{}" })).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${p}/admin/reset`, { method: "POST", headers: { authorization: "Bearer s3cret" } })).status).toBe(404);
    await new Promise<void>((ok) => s.server.close(() => ok()));
  });
});

describe("card contract", () => {
  it("schemas/card.schema.json matches the Zod definition", () => {
    const onDisk = JSON.parse(readFileSync("schemas/card.schema.json", "utf8"));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(cardJsonSchema())));
  });
});
