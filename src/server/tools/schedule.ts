import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Core } from "../core.js";
import { CardSchema } from "../cards.js";
import { parseSchedule, MAX_TEXT } from "../parser.js";
import { fmt12 } from "../time.js";
import { T } from "../templates.js";
import { ok, fail, run, PERSON_DEFAULT } from "./common.js";

const Person = z.string().min(1).max(20).default(PERSON_DEFAULT);

export function registerSchedule(server: McpServer, core: Core) {
  server.registerTool("parse_schedule", {
    title: "Parse a schedule",
    description: "Turns text like 'Morning tablet at 8am daily' into a PROPOSED schedule. It never saves. Confirm it with set_schedule using the returned version.",
    inputSchema: { text: z.string().min(1).max(MAX_TEXT), person: Person.optional() },
    outputSchema: CardSchema,
  }, ({ text, person }) => run(core, "parse_schedule", person ?? PERSON_DEFAULT, () => {
    const r = parseSchedule(text);
    const version = core.scheduleVersion();
    if (r.items.length === 0) return ok({ ui: "card", layout: "panel", title: "Not understood", text: r.errors[0] ?? T.notUnderstood(), items: [], actions: [], data: { errors: r.errors } });
    const lines = r.items.map((i) => `${i.name}, ${fmt12(i.hhmm)}, ${i.days === "daily" ? "every day" : i.days}`);
    return ok({
      ui: "card", layout: "list", title: "Save this schedule?",
      text: `${lines.join(". ")}. Save this schedule?`,
      items: r.items.map((i) => ({ label: i.name, value: fmt12(i.hhmm), meta: i.days })),
      actions: [{ label: "Save", tool: "set_schedule" }, { label: "Edit", tool: "parse_schedule" }],
      data: { version, items: r.items, errors: r.errors },
    });
  }));

  server.registerTool("set_schedule", {
    title: "Save a schedule",
    description: "Replaces a person's schedule. Pass the version from parse_schedule so a stale proposal is rejected.",
    inputSchema: {
      person: Person.optional(),
      items: z.array(z.object({ name: z.string().min(1).max(40), time: z.string().regex(/^\d{2}:\d{2}$/), days: z.enum(["daily", "weekdays", "weekends"]).optional() })).min(1).max(12),
      timezone: z.string().max(60).optional(),
      version: z.number().int().optional(),
    },
    outputSchema: CardSchema,
  }, ({ person, items, timezone, version }) => run(core, "set_schedule", person ?? PERSON_DEFAULT, () => {
    const v = core.setSchedule(person ?? PERSON_DEFAULT, items.map((i) => ({ name: i.name, hhmm: i.time, days: i.days })), timezone, version);
    core.ensureSlots(person ?? PERSON_DEFAULT);
    return ok({
      ui: "card", layout: "list", title: "Schedule saved", text: `Saved ${items.length} reminder${items.length === 1 ? "" : "s"}.`,
      items: core.schedule(person ?? PERSON_DEFAULT).map((i) => ({ label: i.name, value: fmt12(i.hhmm), meta: i.days })),
      actions: [], data: { version: v },
    });
  }));
}
