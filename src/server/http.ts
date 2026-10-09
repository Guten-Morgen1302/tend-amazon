import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import type { Core } from "./core.js";
import { buildMcp, SERVER_VERSION } from "./mcp.js";
import { SimClock } from "./clock.js";
import { fmtClock, zonedToUtc } from "./time.js";

export interface HttpOptions { host: string; port: number; token?: string; extraOrigins?: string[]; onReset?: () => void; }

const MAX_BODY = 64 * 1024;

function json(res: ServerResponse, status: number, body: unknown) {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "content-length": Buffer.byteLength(s) });
  res.end(s);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request too large"), { status: 413 });
    chunks.push(c as Buffer);
  }
  if (chunks.length === 0) return undefined;
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

function bearerOk(req: IncomingMessage, token?: string): boolean {
  if (!token) return true;
  const h = req.headers.authorization ?? "";
  const given = Buffer.from(h.startsWith("Bearer ") ? h.slice(7) : "");
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function createTendServer(core: Core, opts: HttpOptions): Server {
  const server = createServer(async (req, res) => {
    try {
      const port = (server.address() as AddressInfo | null)?.port ?? opts.port;
      const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...(process.env.TEND_ALLOWED_HOSTS?.split(",") ?? [])]);
      const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...(opts.extraOrigins ?? [])]);
      const host = req.headers.host ?? "";
      if (!allowedHosts.has(host)) return json(res, 403, { error: "Host not allowed" });
      const origin = req.headers.origin;
      if (origin !== undefined && !allowedOrigins.has(origin)) return json(res, 403, { error: "Origin not allowed" });

      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/health" && req.method === "GET") {
        return json(res, 200, { status: "ok", name: "tend", version: SERVER_VERSION, protocol: LATEST_PROTOCOL_VERSION, clockMode: core.clock.mode, db: "ok" });
      }
      if (!bearerOk(req, opts.token)) return json(res, 401, { error: "Missing or wrong bearer token" });

      if (url.pathname === "/mcp") {
        if (req.method !== "POST") { res.setHeader("allow", "POST"); return json(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)." }, id: null }); }
        const body = await readBody(req);
        const mcp = buildMcp(core);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on("close", () => { void transport.close(); void mcp.close(); });
        await mcp.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      if (url.pathname.startsWith("/admin/")) {
        // Demo-only controls: sim clock mode, loopback only, bearer if configured. Otherwise they do not exist.
        if (core.clock.mode !== "sim" || !LOOPBACK.has(req.socket.remoteAddress ?? "")) return json(res, 404, { error: "Not found" });
        if (req.method !== "POST") return json(res, 405, { error: "POST only" });
        const body = ((await readBody(req)) ?? {}) as Record<string, unknown>;
        const clock = core.clock as SimClock;
        const tz = core.person("mom").tz;
        if (url.pathname === "/admin/clock") {
          if (typeof body.advance_minutes === "number" && Number.isFinite(body.advance_minutes) && body.advance_minutes > 0 && body.advance_minutes <= 7 * 24 * 60) {
            clock.advance(Math.round(body.advance_minutes));
          } else if (body.jump_to === "next_slot") {
            const n = core.nextInfo("mom");
            if (n) clock.set(zonedToUtc(n.date, n.hhmm, tz));
          } else return json(res, 400, { error: "Send {advance_minutes: 1..10080} or {jump_to: 'next_slot'}" });
          return json(res, 200, { now: clock.now(), nowText: fmtClock(clock.now(), tz), skippedMinutes: clock.skippedMinutes() });
        }
        if (url.pathname === "/admin/reset") {
          clock.reset();
          opts.onReset?.();
          return json(res, 200, { now: clock.now(), nowText: fmtClock(clock.now(), tz), skippedMinutes: 0 });
        }
        return json(res, 404, { error: "Not found" });
      }
      return json(res, 404, { error: "Not found" });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      if (!res.headersSent) json(res, status, { error: status === 500 ? "Internal error" : (e as Error).message });
      else res.end();
    }
  });
  return server;
}
