// sim-host: the server-side MCP client plus the simulated Alexa+ display backend.
// The browser never speaks MCP. It talks to this host, which calls tend-server through a real MCP client.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { routeUtterance, MAX_TEXT } from "../server/parser.js";
import { T } from "../server/templates.js";
import type { Card } from "../server/cards.js";

export interface HostOptions { port: number; tendUrl: string; token?: string; uiDir?: string; }
export interface ToolResult { card: Card | null; text: string; isError: boolean; }

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const CSP = "default-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const MAX_BODY = 16 * 1024;
const ALLOWED_ACTIONS = new Set(["log_dose", "snooze", "set_schedule", "check_misses"]);

function json(res: ServerResponse, status: number, body: unknown) {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "content-security-policy": CSP, "x-content-type-options": "nosniff" });
  res.end(s);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > MAX_BODY) throw Object.assign(new Error("Request too large"), { status: 413 }); chunks.push(c as Buffer); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

export function formatSkip(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return `+${[h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ")}`;
}

export function createHost(opts: HostOptions): Server & { skips: string[] } {
  const uiDir = resolve(opts.uiDir ?? join(process.cwd(), "src", "sim", "ui"));
  const skips: string[] = [];
  const headers: Record<string, string> = opts.token ? { authorization: `Bearer ${opts.token}` } : {};

  async function tool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const client = new Client({ name: "tend-sim-host", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(opts.tendUrl), { requestInit: { headers } });
    try {
      await client.connect(transport);
      const r: any = await client.callTool({ name, arguments: args });
      const text = String(r.content?.[0]?.text ?? "");
      return { card: (r.structuredContent as Card) ?? null, text, isError: Boolean(r.isError) };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async function admin(path: string, body: unknown) {
    const base = new URL(opts.tendUrl);
    const r = await fetch(`${base.origin}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body ?? {}) });
    if (!r.ok) throw new Error(`admin ${path} failed (${r.status})`);
    return (await r.json()) as { nowText: string; skippedMinutes: number };
  }

  async function health() {
    const base = new URL(opts.tendUrl);
    const r = await fetch(`${base.origin}/health`);
    if (!r.ok) throw new Error("tend-server unhealthy");
    return (await r.json()) as { clockMode: string; nowText: string; skippedMinutes: number };
  }

  async function state() {
    try {
      const [h, due, week, alerts] = await Promise.all([health(), tool("whats_due"), tool("weekly_summary"), tool("list_notifications")]);
      const skipped = h.skippedMinutes;
      const chip = h.clockMode === "sim" ? `Demo time ${h.nowText}${skipped > 0 ? ` (skipped ${formatSkip(skipped)})` : ""}` : `Time ${h.nowText}`;
      return { offline: false, clockMode: h.clockMode, nowText: h.nowText, chip, skippedMinutes: skipped, skipLabel: skips.length ? `Clock skipped ahead (${skips.join(", then ")})` : null, due: due.card, week: week.card, alerts: alerts.card };
    } catch {
      return { offline: true };
    }
  }

  async function say(text: string) {
    const intent = routeUtterance(text);
    let result: ToolResult;
    switch (intent.kind) {
      case "whats_due": result = await tool("whats_due"); break;
      case "log": result = await tool("log_dose", intent.item ? { item: intent.item } : {}); break;
      case "snooze": result = await tool("snooze", intent.item ? { item: intent.item } : {}); break;
      case "week": result = await tool("weekly_summary"); break;
      case "alerts": result = await tool("list_notifications"); break;
      case "schedule": result = await tool("parse_schedule", { text: intent.text }); break;
      default: result = { card: null, text: T.notUnderstood(), isError: false };
    }
    return { intent: intent.kind, reply: result.text, isError: result.isError, card: result.card };
  }

  const server = createServer(async (req, res) => {
    try {
      const port = (server.address() as AddressInfo | null)?.port ?? opts.port;
      const host = req.headers.host ?? "";
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return json(res, 403, { error: "Host not allowed" });
      const origin = req.headers.origin;
      if (origin !== undefined && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return json(res, 403, { error: "Origin not allowed" });
      const url = new URL(req.url ?? "/", `http://${host}`);

      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/state" && req.method === "GET") return json(res, 200, await state());
        if (req.method !== "POST") return json(res, 405, { error: "POST only" });
        const body = await readJson(req);
        if (url.pathname === "/api/say") {
          const t = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT) : "";
          return json(res, 200, { ...(await say(t)), state: await state() });
        }
        if (url.pathname === "/api/action") {
          if (!ALLOWED_ACTIONS.has(body.tool)) return json(res, 400, { error: "Unknown action" });
          const args = body.args && typeof body.args === "object" ? body.args : {};
          const r = await tool(body.tool, args);
          return json(res, 200, { reply: r.text, isError: r.isError, card: r.card, state: await state() });
        }
        if (url.pathname === "/api/clock") {
          if (typeof body.advance_minutes === "number") {
            await admin("/admin/clock", { advance_minutes: body.advance_minutes });
            skips.push(formatSkip(body.advance_minutes));
          } else if (body.jump_to === "next_slot") {
            await admin("/admin/clock", { jump_to: "next_slot" });
            skips.push("to the next dose");
          } else return json(res, 400, { error: "Bad clock request" });
          await tool("check_misses"); // a clock skip refreshes immediately instead of waiting for the poll
          return json(res, 200, { state: await state() });
        }
        if (url.pathname === "/api/reset") {
          await admin("/admin/reset", {});
          skips.length = 0;
          return json(res, 200, { state: await state() });
        }
        return json(res, 404, { error: "Not found" });
      }

      // static files
      const rel = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = normalize(join(uiDir, rel));
      if (!file.startsWith(uiDir)) return json(res, 403, { error: "Forbidden" });
      try {
        const data = await readFile(file);
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "content-security-policy": CSP, "x-content-type-options": "nosniff", "cache-control": "no-cache" });
        res.end(data);
      } catch {
        json(res, 404, { error: "Not found" });
      }
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      if (!res.headersSent) json(res, status, { error: status === 500 ? "Internal error" : (e as Error).message });
    }
  }) as Server & { skips: string[] };
  server.skips = skips;
  return server;
}
