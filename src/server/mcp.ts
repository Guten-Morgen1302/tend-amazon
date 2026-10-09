import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Core } from "./core.js";
import { registerSchedule } from "./tools/schedule.js";
import { registerDose } from "./tools/dose.js";
import { registerQuery } from "./tools/query.js";

export const SERVER_NAME = "tend";
export const SERVER_VERSION = "0.1.0";
export const TOOL_NAMES = ["set_schedule", "parse_schedule", "log_dose", "whats_due", "check_misses", "weekly_summary", "list_notifications", "snooze"] as const;

/** A fresh MCP server per request (stateless transport). State lives in SQLite, not in the server object. */
export function buildMcp(core: Core): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerSchedule(server, core);
  registerDose(server, core);
  registerQuery(server, core);
  return server;
}
