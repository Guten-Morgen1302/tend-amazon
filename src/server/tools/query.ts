import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Core } from "../core.js";
import { CardSchema } from "../cards.js";
import { fmt12 } from "../time.js";
import { ok, run, dueCard, PERSON_DEFAULT } from "./common.js";

const Person = z.string().min(1).max(20).default(PERSON_DEFAULT);

export function registerQuery(server: McpServer, core: Core) {
  server.registerTool("whats_due", {
    title: "What is due",
    description: "Shows what is due or overdue now and what comes next. Runs the miss check first.",
    inputSchema: { person: Person.optional() },
    outputSchema: CardSchema,
  }, ({ person }) => run(core, "whats_due", person ?? PERSON_DEFAULT, () => ok(dueCard(core, person ?? PERSON_DEFAULT))));

  server.registerTool("weekly_summary", {
    title: "Weekly summary",
    description: "The week Monday to Sunday: per day, per dose state, as a week-strip card, plus the timeline of the latest alert.",
    inputSchema: { person: Person.optional() },
    outputSchema: CardSchema,
  }, ({ person }) => run(core, "weekly_summary", person ?? PERSON_DEFAULT, () => {
    const w = core.weekly(person ?? PERSON_DEFAULT);
    const parts = w.days.map((d) => `${d.label}: ${d.doses.length === 0 ? "no data" : d.doses.map((x) => `${x.state}`).join(", ")}`);
    return ok({
      ui: "carousel", layout: "week-strip", title: "This week",
      text: parts.join(". ") + ".",
      items: w.days.map((d) => ({ label: d.label, value: d.date, state: d.state, meta: d.today ? "today" : undefined, doses: d.doses })),
      actions: [],
      timeline: w.timeline ? { title: w.timeline.title, status: w.timeline.status, events: w.timeline.events.map(({ time, label, kind }) => ({ time, label, kind })) } : undefined,
      data: { weekStart: w.weekStart },
    });
  }));

  server.registerTool("list_notifications", {
    title: "Caregiver alerts",
    description: "Lists queued caregiver messages, newest first. Set mark_read to mark them read.",
    inputSchema: { caregiver: z.string().min(1).max(20).default("alex").optional(), mark_read: z.boolean().optional() },
    outputSchema: CardSchema,
  }, ({ caregiver, mark_read }) => run(core, "list_notifications", caregiver ?? "alex", () => {
    const n = core.notifications(caregiver ?? "alex", mark_read ?? false);
    return ok({
      ui: "card", layout: "list", title: "Alerts",
      text: n.length ? n.slice(0, 3).map((x) => x.message).join(" ") : "All quiet. No missed doses.",
      items: n.slice(0, 20).map((x) => ({ label: x.message, value: x.whenText, meta: x.followup ?? undefined, state: x.read ? undefined : "missed" as const })),
      actions: [], data: { unread: n.filter((x) => !x.read).length, total: n.length },
    });
  }));
}

export { fmt12 };
