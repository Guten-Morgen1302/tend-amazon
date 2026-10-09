import type { Core } from "../core.js";
import { CoreError } from "../core.js";
import type { Card } from "../cards.js";
import { findBanned, GuardrailError } from "../guardrail.js";
import { fmt12, fmtClock } from "../time.js";
import { T } from "../templates.js";
import { randomUUID } from "node:crypto";

export const PERSON_DEFAULT = "mom";

export function ok(card: Card) {
  const bad = findBanned(JSON.stringify(card));
  if (bad) return fail(`Tend cannot show advice or dosing text ("${bad}").`);
  return { content: [{ type: "text" as const, text: card.text }], structuredContent: card as unknown as Record<string, unknown> };
}

export function fail(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

/** Runs a tool body, records an audit row, and turns known errors into clean isError results. */
export function run(core: Core, tool: string, person: string | null, fn: () => ReturnType<typeof ok>) {
  const started = Date.now();
  const log = (outcome: string) => {
    if (process.env.TEND_LOG === "json") console.log(JSON.stringify({ ts: new Date().toISOString(), requestId: randomUUID(), tool, person, durationMs: Date.now() - started, outcome }));
  };
  try {
    const r = fn();
    core.audit(tool, person, "ok");
    log("ok");
    return r;
  } catch (e) {
    const msg = e instanceof CoreError || e instanceof GuardrailError ? e.message : "Something went wrong. Please try again.";
    const outcome = e instanceof CoreError ? e.code : e instanceof GuardrailError ? "guardrail" : "error";
    try { core.audit(tool, person, outcome); } catch { /* audit is best effort */ }
    log(outcome);
    return fail(msg);
  }
}

/** The "what is due" card used by whats_due, log_dose and snooze. */
export function dueCard(core: Core, personId: string, prefix?: string): Card {
  const r = core.whatsDue(personId);
  const tz = r.person.tz;
  const now = fmtClock(r.now, tz);
  const list = [...r.overdue, ...r.due].sort((a, b) => a.due_ts - b.due_ts);
  const nowTxt = (s: string) => (prefix ? `${prefix} ${s}` : s);
  if (list.length === 0) {
    const next = r.next;
    const after = next ? core.nextInfo(personId, next.dueTs) : null;
    const nextLine = after ? `${after.whenText.startsWith("tomorrow") ? "Tomorrow" : "Next"}: ${after.item} ${after.whenText.replace(/^tomorrow /, "")}` : "";
    return {
      ui: "card", layout: "panel",
      title: next ? next.item : "Nothing due",
      text: nowTxt(T.nothingDue(next ? `${next.item} ${next.whenText}` : null)),
      items: next ? [{ label: next.item, value: fmt12(next.hhmm), state: "upcoming" }] : [],
      actions: next ? [{ label: "I took it", tool: "log_dose", args: { item: next.item } }] : [],
      data: { mode: next ? "upcoming" : "empty", nowText: now, nextLine },
    };
  }
  const primary = list[0];
  const overdue = primary.status === "missed";
  const next = r.next;
  const nextLine = next ? `${next.whenText.startsWith("tomorrow") ? "Tomorrow" : "Next"}: ${next.item} ${next.whenText.replace(/^tomorrow /, "")}` : "";
  return {
    ui: "card", layout: "panel",
    title: primary.item,
    text: nowTxt(overdue ? T.overdue(now, primary.item, primary.slot_hhmm) : T.due(primary.item, fmt12(primary.slot_hhmm))),
    items: list.slice(0, 4).map((s) => ({
      label: s.item, value: fmt12(s.slot_hhmm), state: s.status === "missed" ? "overdue" : "due",
      meta: s.status === "missed" ? `Was due ${fmt12(s.slot_hhmm)}, now ${now}` : undefined,
    })),
    actions: [{ label: "I took it", tool: "log_dose", args: { item: primary.item } }],
    data: { mode: overdue ? "overdue" : "due", nowText: now, nextLine, moreOverdue: Math.max(0, list.length - 1) },
  };
}
