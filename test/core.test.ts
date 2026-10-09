import { describe, it, expect } from "vitest";
import { makeCore, count } from "./helpers.js";
import { openDb } from "../src/server/db/db.js";
import { Core, CoreError } from "../src/server/core.js";
import { SimClock } from "../src/server/clock.js";
import { zonedToUtc, localParts, addDays, mondayOf } from "../src/server/time.js";

describe("miss rule and escalation", () => {
  it("does nothing inside the 60 minute grace window", () => {
    const { core, clock, db } = makeCore();
    clock.advance(57); // 08:59, due 08:00, grace ends 09:00
    expect(core.checkMisses("mom")).toHaveLength(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM escalations WHERE created_ts > 0 AND status='escalated'")).toBe(0);
  });

  it("escalates once after grace and is idempotent across repeated calls", () => {
    const { core, clock, db } = makeCore();
    clock.advance(60); // 09:02
    const first = core.checkMisses("mom");
    expect(first).toHaveLength(1);
    expect(first[0].message).toBe("Mom has not logged her 8:00 morning tablet. It has been 62 minutes.");
    for (let i = 0; i < 5; i++) expect(core.checkMisses("mom")).toHaveLength(0);
    core.whatsDue("mom"); core.weekly("mom");
    expect(count(db, "SELECT COUNT(*) AS n FROM escalations WHERE status='escalated'")).toBe(1);
    expect(count(db, "SELECT COUNT(*) AS n FROM notifications WHERE read=0")).toBe(1);
  });

  it("a late dose resolves the alert with a follow-up and sends no second notification", () => {
    const { core, clock, db } = makeCore();
    clock.advance(60); core.checkMisses("mom");
    clock.advance(15);
    const r = core.logDose("mom", "morning");
    expect(r.kind).toBe("late");
    expect(r.minutesLate).toBe(77);
    const n = core.notifications("alex");
    expect(n[0].followup).toBe("Logged at 9:17 AM, 77 minutes late.");
    expect(count(db, "SELECT COUNT(*) AS n FROM notifications")).toBe(2); // the seeded Thursday alert plus today's
    expect(count(db, "SELECT COUNT(*) AS n FROM escalations WHERE status='resolved_late'")).toBe(2);
  });

  it("logging twice is idempotent", () => {
    const { core } = makeCore();
    expect(core.logDose("mom", "morning").kind).toBe("logged");
    const again = core.logDose("mom", "morning");
    expect(again.kind).toBe("already");
    expect(again.clock).toBe("8:02 AM");
  });

  it("nothing to log when nothing is due soon", () => {
    const { core, clock } = makeCore();
    core.logDose("mom", "morning");
    clock.advance(10);
    expect(core.logDose("mom", "evening").kind).toBe("nothing");
  });
});

describe("snooze", () => {
  it("extends the grace once by 30 minutes", () => {
    const { core, clock } = makeCore();
    clock.advance(30); // 08:32
    expect(core.snooze("mom", "morning").kind).toBe("snoozed");
    clock.advance(48); // 09:20, past 60 but inside 90
    expect(core.checkMisses("mom")).toHaveLength(0);
    clock.advance(15); // 09:35 past 90
    expect(core.checkMisses("mom")).toHaveLength(1);
  });

  it("rejects a second snooze", () => {
    const { core, clock } = makeCore();
    clock.advance(10);
    core.snooze("mom", "morning");
    expect(() => core.snooze("mom", "morning")).toThrow(/already snoozed/);
  });

  it("after the grace window but before the lazy check it supersedes the alert instead", () => {
    const { core, clock, db } = makeCore();
    clock.advance(70); // past grace, nobody called check_misses yet
    const r = core.snooze("mom", "morning");
    expect(r.kind).toBe("superseded");
    expect(count(db, "SELECT COUNT(*) AS n FROM escalations WHERE status='superseded'")).toBe(1);
    expect(core.notifications("alex")[0].followup).toMatch(/Snoozed after the alert/);
  });

  it("rejects snooze on a logged slot and before it is due", () => {
    const { core, clock } = makeCore();
    core.logDose("mom", "morning");
    expect(() => core.snooze("mom", "morning")).toThrow(CoreError);
    clock.advance(0);
    expect(() => core.snooze("mom", "evening")).toThrow(/not due yet/);
  });
});

describe("schedule", () => {
  it("rejects a stale proposal version", () => {
    const { core } = makeCore();
    const v = core.scheduleVersion();
    core.setSchedule("mom", [{ name: "Morning tablet", hhmm: "08:00" }], undefined, v);
    expect(() => core.setSchedule("mom", [{ name: "Morning tablet", hhmm: "09:00" }], undefined, v)).toThrow(/out of date/);
  });

  it("rejects banned words, bad names, bad zones and oversize lists", () => {
    const { core } = makeCore();
    expect(() => core.setSchedule("mom", [{ name: "Aspirin dosage", hhmm: "08:00" }])).toThrow(/advice or dosing/);
    expect(() => core.setSchedule("mom", [{ name: "<script>", hhmm: "08:00" }])).toThrow(/letters/);
    expect(() => core.setSchedule("mom", [{ name: "Ok", hhmm: "08:00" }], "Mars/Base")).toThrow(/time zone/);
    expect(() => core.setSchedule("mom", Array.from({ length: 13 }, (_, i) => ({ name: "A" + i, hhmm: "08:00" })))).toThrow();
    expect(() => core.person("nobody")).toThrow(/Unknown person/);
  });

  it("never recomputes a materialized slot from a later edit", () => {
    const { core, db } = makeCore();
    core.ensureSlots("mom");
    const before = db.prepare("SELECT due_ts FROM slots WHERE item='Morning tablet' AND local_date='2026-10-16'").get() as any;
    core.setSchedule("mom", [{ name: "Morning tablet", hhmm: "09:30" }]);
    core.ensureSlots("mom");
    const after = db.prepare("SELECT due_ts FROM slots WHERE item='Morning tablet' AND local_date='2026-10-16' AND slot_hhmm='08:00'").get() as any;
    expect(after.due_ts).toBe(before.due_ts);
  });
});

describe("queries", () => {
  it("shows the seeded week with Thursday evening resolved late and Fri morning due", () => {
    const { core } = makeCore();
    const w = core.weekly("mom");
    expect(w.weekStart).toBe("2026-10-12");
    expect(w.days.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(w.days[3].state).toBe("taken");
    expect(w.days[4].doses[0].state).toBe("due");
    expect(w.days[5].state).toBe("upcoming");
    expect(w.timeline?.status).toBe("resolved_late");
  });

  it("lists most overdue first and builds a timeline for a live alert", () => {
    const { core, clock } = makeCore();
    clock.advance(13 * 60 + 5); // 21:07 -> morning missed too? morning escalates, evening only due
    const d = core.whatsDue("mom");
    expect(d.overdue.map((s) => s.item)).toEqual(["Morning tablet"]);
    expect(d.due.map((s) => s.item)).toEqual(["Evening tablet"]);
    const t = core.timeline("mom")!;
    expect(t.events.map((e) => e.label)).toEqual(["Morning tablet scheduled", "Grace period ended", "Alert sent to caregiver"]);
  });
});

describe("time zones and DST", () => {
  it("handles US spring-forward and fall-back days", () => {
    const tz = "America/New_York";
    expect(zonedToUtc("2026-10-31", "08:00", tz)).toBe(Date.UTC(2026, 9, 31, 12, 0)); // EDT
    expect(zonedToUtc("2026-11-01", "08:00", tz)).toBe(Date.UTC(2026, 10, 1, 13, 0)); // EST after fall back
    expect(zonedToUtc("2026-03-08", "02:30", tz)).toBe(Date.UTC(2026, 2, 8, 7, 30)); // nonexistent time moves forward to 03:30 EDT
    expect(zonedToUtc("2026-03-09", "08:00", tz)).toBe(Date.UTC(2026, 2, 9, 12, 0));
  });

  it("materializes one slot per item per local day across a DST change", () => {
    const db = openDb(":memory:");
    const tz = "America/New_York";
    const clock = new SimClock(zonedToUtc("2026-11-01", "07:00", tz));
    const core = new Core(db, clock, tz);
    db.prepare("INSERT INTO people(id,name,tz,role) VALUES('mom','Mom',?,'elder')").run(tz);
    core.setSchedule("mom", [{ name: "Morning tablet", hhmm: "08:00" }]);
    core.ensureSlots("mom"); core.ensureSlots("mom");
    expect(count(db, "SELECT COUNT(*) AS n FROM slots WHERE local_date='2026-11-01'")).toBe(1);
    expect(localParts((db.prepare("SELECT due_ts FROM slots").get() as any).due_ts, tz).hh).toBe(8);
  });

  it("local date helpers", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(mondayOf("2026-10-16")).toBe("2026-10-12");
  });
});

describe("seed and audit", () => {
  it("seeding twice yields identical rows (idempotent, reset reproduces the demo state)", () => {
    const { core, db } = makeCore();
    const snap = () => JSON.stringify(["slots", "escalations", "notifications", "items", "people"].map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY 1,2,3,4`).all()));
    const a = snap();
    core.clock.advance(120); core.whatsDue("mom");
    (core.clock as SimClock).reset();
    seedAgain(core);
    expect(snap()).toBe(a);
  });

  it("writes an audit row per tool call outcome", () => {
    const { core, db } = makeCore();
    core.audit("whats_due", "mom", "ok");
    expect(count(db, "SELECT COUNT(*) AS n FROM audit_log WHERE tool='whats_due'")).toBe(1);
  });
});

import { seedDemo } from "../src/seed/seed.js";
function seedAgain(core: Core) { seedDemo(core, "Asia/Kolkata"); }
