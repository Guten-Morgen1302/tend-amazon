import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Core } from "../core.js";
import { CardSchema } from "../cards.js";
import { T } from "../templates.js";
import { fmt12 } from "../time.js";
import { ok, run, dueCard, PERSON_DEFAULT } from "./common.js";

const Person = z.string().min(1).max(20).default(PERSON_DEFAULT);
const Item = z.string().min(1).max(40).optional();

export function registerDose(server: McpServer, core: Core) {
  server.registerTool("log_dose", {
    title: "Log a dose",
    description: "Records that a dose was taken. Idempotent per slot: logging twice says 'Already logged'. A late dose resolves its alert instead of sending another message.",
    inputSchema: { person: Person.optional(), item: Item },
    outputSchema: CardSchema,
  }, ({ person, item }) => run(core, "log_dose", person ?? PERSON_DEFAULT, () => {
    const p = person ?? PERSON_DEFAULT;
    const r = core.logDose(p, item);
    const next = r.next ? `${r.next.item.toLowerCase()} ${r.next.whenText}` : null;
    const text = r.kind === "already" ? T.alreadyLogged(r.clock!) : r.kind === "nothing" ? T.nothingDue(r.next ? `${r.next.item} ${r.next.whenText}` : null) : T.logged(r.clock!, next);
    const card = dueCard(core, p);
    return ok({ ...card, text, data: { ...(card.data ?? {}), result: r.kind, loggedItem: r.item ?? null, loggedAt: r.clock ?? null, minutesLate: r.minutesLate ?? null } });
  }));

  server.registerTool("snooze", {
    title: "Snooze a reminder",
    description: "Snoozes the current dose once by 30 minutes if it is inside the grace window. After an alert has been sent it marks the alert as snoozed instead.",
    inputSchema: { person: Person.optional(), item: Item },
    outputSchema: CardSchema,
  }, ({ person, item }) => run(core, "snooze", person ?? PERSON_DEFAULT, () => {
    const p = person ?? PERSON_DEFAULT;
    const r = core.snooze(p, item);
    const text = r.kind === "snoozed" ? T.snoozed(r.minutes) : "Okay. The alert is marked as snoozed.";
    const card = dueCard(core, p);
    return ok({ ...card, text, data: { ...(card.data ?? {}), result: r.kind, item: r.item } });
  }));

  server.registerTool("check_misses", {
    title: "Check for missed doses",
    description: "Applies the miss rule (60 minute grace) and queues at most one caregiver message per missed slot. Safe to call repeatedly and concurrently.",
    inputSchema: { person: Person.optional() },
    outputSchema: CardSchema,
  }, ({ person }) => run(core, "check_misses", person ?? PERSON_DEFAULT, () => {
    const made = core.checkMisses(person ?? PERSON_DEFAULT);
    return ok({
      ui: "card", layout: "list", title: made.length ? "New alerts" : "No new alerts",
      text: made.length ? made.map((m) => m.message).join(" ") : "No new missed doses.",
      items: made.map((m) => ({ label: m.item, value: fmt12(m.hhmm), state: "missed" as const })),
      actions: [], data: { created: made.length },
    });
  }));
}
