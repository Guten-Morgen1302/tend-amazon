// Tend core: schedules, dose slots, the miss rule and escalations. No MCP, no HTTP here, so tests need neither.
import type { Db } from "./db/db.js";
import { tx } from "./db/db.js";
import type { Clock } from "./clock.js";
import { addDays, DAY_NAMES, dowOf, fmt12, fmtClock, localParts, mondayOf, zonedToUtc, isValidTimeZone } from "./time.js";
import { daysMatch } from "./parser.js";
import { T } from "./templates.js";
import { validateItemName } from "./guardrail.js";

export const GRACE_MIN = 60;
export const SNOOZE_MIN = 30;
const MIN = 60000;

export interface Person { id: string; name: string; tz: string; role: string; }
export interface ItemRow { person: string; name: string; hhmm: string; days: string; }
export interface SlotRow { person: string; item: string; local_date: string; slot_hhmm: string; due_ts: number; status: string; taken_ts: number | null; snoozed: number; }
export interface EscRow { person: string; item: string; local_date: string; slot_hhmm: string; status: string; created_ts: number; resolved_ts: number | null; notification_id: number | null; }

export class CoreError extends Error { constructor(message: string, public code = "invalid") { super(message); } }

type Row = Record<string, any>; // node:sqlite rows are plain objects

export type SlotState = "taken" | "missed" | "due" | "upcoming" | "nodata";
export interface DueResult { due: SlotRow[]; overdue: SlotRow[]; next: NextInfo | null; person: Person; now: number; }
export interface NextInfo { item: string; hhmm: string; dueTs: number; date: string; whenText: string; }

export class Core {
  constructor(public db: Db, public clock: Clock, public defaultTz = "Asia/Kolkata") {}

  // ---------- people and schedule ----------
  person(id: string): Person {
    const p = this.db.prepare("SELECT * FROM people WHERE id = ?").get(id) as Row | undefined;
    if (!p) throw new CoreError(`Unknown person "${id.slice(0, 20)}".`, "unknown_person");
    return p as Person;
  }

  scheduleVersion(): number { return Number((this.db.prepare("SELECT value FROM meta WHERE key='schedule_version'").get() as Row).value); }

  schedule(personId: string): ItemRow[] {
    return this.db.prepare("SELECT * FROM items WHERE person = ? ORDER BY hhmm, name").all(personId) as unknown as ItemRow[];
  }

  setSchedule(personId: string, items: { name: string; hhmm: string; days?: string }[], timezone?: string, expectedVersion?: number): number {
    const p = this.person(personId);
    if (expectedVersion !== undefined && expectedVersion !== this.scheduleVersion()) throw new CoreError("That proposal is out of date. Ask again and confirm the new one.", "stale_proposal");
    if (items.length === 0 || items.length > 12) throw new CoreError("A schedule needs between 1 and 12 items.");
    if (timezone && !isValidTimeZone(timezone)) throw new CoreError("That time zone is not valid.", "invalid_timezone");
    const clean = items.map((i) => {
      const v = validateItemName(i.name);
      if (!v.ok) throw new CoreError(v.error, "invalid_name");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.hhmm)) throw new CoreError("Times must look like 08:00.");
      const days = i.days ?? "daily";
      if (!["daily", "weekdays", "weekends"].includes(days)) throw new CoreError("Days must be daily, weekdays or weekends.");
      return { name: v.name, hhmm: i.hhmm, days };
    });
    return tx(this.db, () => {
      this.db.prepare("DELETE FROM items WHERE person = ?").run(personId);
      const ins = this.db.prepare("INSERT OR REPLACE INTO items(person,name,hhmm,days) VALUES(?,?,?,?)");
      for (const i of clean) ins.run(personId, i.name, i.hhmm, i.days);
      if (timezone && timezone !== p.tz) this.db.prepare("UPDATE people SET tz = ? WHERE id = ?").run(timezone, personId);
      const v = this.scheduleVersion() + 1;
      this.db.prepare("UPDATE meta SET value = ? WHERE key='schedule_version'").run(String(v));
      return v;
    });
  }

  // ---------- slots ----------
  /** Materialize today's slots once. Existing rows are never recomputed from later schedule edits. */
  ensureSlots(personId: string): void {
    const p = this.person(personId);
    const l = localParts(this.clock.now(), p.tz);
    const ins = this.db.prepare("INSERT OR IGNORE INTO slots(person,item,local_date,slot_hhmm,due_ts,status,snoozed) VALUES(?,?,?,?,?,'pending',0)");
    tx(this.db, () => {
      for (const it of this.schedule(personId)) {
        if (!daysMatch(it.days, l.dow)) continue;
        ins.run(personId, it.name, l.date, it.hhmm, zonedToUtc(l.date, it.hhmm, p.tz));
      }
    });
  }

  private todaySlots(personId: string): SlotRow[] {
    const p = this.person(personId);
    const date = localParts(this.clock.now(), p.tz).date;
    return this.db.prepare("SELECT * FROM slots WHERE person = ? AND local_date = ? ORDER BY due_ts, item").all(personId, date) as unknown as SlotRow[];
  }

  private graceEnd(s: SlotRow): number { return s.due_ts + (GRACE_MIN + (s.snoozed ? SNOOZE_MIN : 0)) * MIN; }

  // ---------- the miss rule ----------
  /** Safe to call repeatedly and concurrently: at most one escalation per (person, item, local_date, slot_hhmm). */
  checkMisses(personId: string, caregiver = "alex"): { item: string; hhmm: string; notificationId: number; message: string }[] {
    const p = this.person(personId);
    this.ensureSlots(personId);
    const now = this.clock.now();
    const created: { item: string; hhmm: string; notificationId: number; message: string }[] = [];
    const pending = this.todaySlots(personId).filter((s) => s.status === "pending" && now > this.graceEnd(s));
    for (const s of pending) {
      tx(this.db, () => {
        const cur = this.db.prepare("SELECT status FROM slots WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").get(s.person, s.item, s.local_date, s.slot_hhmm) as Row | undefined;
        if (!cur || cur.status !== "pending") return;
        const minutes = Math.floor((now - s.due_ts) / MIN);
        const message = T.escalation(p.name, s.item, s.slot_hhmm, minutes);
        const r = this.db.prepare("INSERT OR IGNORE INTO escalations(person,item,local_date,slot_hhmm,status,created_ts) VALUES(?,?,?,?, 'escalated', ?)").run(s.person, s.item, s.local_date, s.slot_hhmm, now);
        if (Number(r.changes) === 1) {
          const n = this.db.prepare("INSERT INTO notifications(caregiver,message,created_ts) VALUES(?,?,?)").run(caregiver, message, now);
          const nid = Number(n.lastInsertRowid);
          this.db.prepare("UPDATE escalations SET notification_id=? WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").run(nid, s.person, s.item, s.local_date, s.slot_hhmm);
          created.push({ item: s.item, hhmm: s.slot_hhmm, notificationId: nid, message });
        }
        this.db.prepare("UPDATE slots SET status='missed' WHERE person=? AND item=? AND local_date=? AND slot_hhmm=? AND status='pending'").run(s.person, s.item, s.local_date, s.slot_hhmm);
      });
    }
    return created;
  }

  // ---------- logging ----------
  logDose(personId: string, itemHint?: string): { kind: "logged" | "late" | "already" | "nothing"; item?: string; hhmm?: string; clock?: string; minutesLate?: number; next: NextInfo | null; person: Person } {
    const p = this.person(personId);
    this.checkMisses(personId);
    const now = this.clock.now();
    const hint = itemHint?.trim().toLowerCase();
    const matches = (s: SlotRow) => !hint || s.item.toLowerCase().includes(hint);
    const slots = this.todaySlots(personId).filter(matches);
    const open = slots.filter((s) => (s.status === "pending" || s.status === "missed") && s.due_ts <= now + 120 * MIN);
    const stamp = fmtClock(now, p.tz);
    if (open.length === 0) {
      const done = slots.filter((s) => (s.status === "taken" || s.status === "taken_late") && s.due_ts <= now + 120 * MIN).sort((a, b) => (b.taken_ts ?? 0) - (a.taken_ts ?? 0))[0];
      if (done) return { kind: "already", item: done.item, hhmm: done.slot_hhmm, clock: fmtClock(done.taken_ts ?? now, p.tz), next: this.nextInfo(personId), person: p };
      return { kind: "nothing", next: this.nextInfo(personId), person: p };
    }
    const s = open[0];
    const result = tx(this.db, () => {
      const cur = this.db.prepare("SELECT status FROM slots WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").get(s.person, s.item, s.local_date, s.slot_hhmm) as Row;
      if (cur.status === "pending") {
        this.db.prepare("UPDATE slots SET status='taken', taken_ts=? WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").run(now, s.person, s.item, s.local_date, s.slot_hhmm);
        return { kind: "logged" as const };
      }
      if (cur.status === "missed") {
        this.db.prepare("UPDATE slots SET status='taken_late', taken_ts=? WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").run(now, s.person, s.item, s.local_date, s.slot_hhmm);
        const e = this.db.prepare("SELECT * FROM escalations WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").get(s.person, s.item, s.local_date, s.slot_hhmm) as Row | undefined;
        const late = Math.floor((now - s.due_ts) / MIN);
        if (e && e.status === "escalated") {
          this.db.prepare("UPDATE escalations SET status='resolved_late', resolved_ts=? WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").run(now, s.person, s.item, s.local_date, s.slot_hhmm);
          if (e.notification_id) this.db.prepare("UPDATE notifications SET followup=? WHERE id=?").run(T.followupLate(stamp, late), e.notification_id);
        }
        return { kind: "late" as const, minutesLate: late };
      }
      return { kind: "already" as const };
    });
    return { ...result, item: s.item, hhmm: s.slot_hhmm, clock: stamp, next: this.nextInfo(personId), person: p } as any;
  }

  snooze(personId: string, itemHint?: string): { kind: "snoozed" | "superseded"; item: string; minutes: number } {
    this.person(personId);
    this.checkMisses(personId); // lazy escalation first, so a snooze after the grace window is a snooze-after-escalation
    const hint = itemHint?.trim().toLowerCase();
    const slots = this.todaySlots(personId).filter((s) => !hint || s.item.toLowerCase().includes(hint));
    const open = slots.filter((s) => s.status === "pending" || s.status === "missed").sort((a, b) => a.due_ts - b.due_ts);
    const now = this.clock.now();
    const s = open.find((x) => x.due_ts <= now) ?? open[0];
    if (!s) throw new CoreError("Nothing to snooze. Everything due is already logged.", "nothing_to_snooze");
    return tx(this.db, () => {
      if (s.status === "missed") {
        const e = this.db.prepare("SELECT * FROM escalations WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").get(s.person, s.item, s.local_date, s.slot_hhmm) as Row | undefined;
        if (!e || e.status !== "escalated") throw new CoreError("That reminder was already handled.", "already_handled");
        this.db.prepare("UPDATE escalations SET status='superseded', resolved_ts=? WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").run(now, s.person, s.item, s.local_date, s.slot_hhmm);
        if (e.notification_id) this.db.prepare("UPDATE notifications SET followup=? WHERE id=?").run(T.followupSnoozed(), e.notification_id);
        return { kind: "superseded" as const, item: s.item, minutes: 0 };
      }
      if (s.snoozed) throw new CoreError("That reminder was already snoozed once.", "already_snoozed");
      if (now < s.due_ts) throw new CoreError("That dose is not due yet.", "not_due");
      this.db.prepare("UPDATE slots SET snoozed=1 WHERE person=? AND item=? AND local_date=? AND slot_hhmm=? AND snoozed=0").run(s.person, s.item, s.local_date, s.slot_hhmm);
      return { kind: "snoozed" as const, item: s.item, minutes: SNOOZE_MIN };
    });
  }

  // ---------- queries ----------
  /** The next scheduled occurrence strictly after now that has no slot row marked done or missed. */
  nextInfo(personId: string, after?: number): NextInfo | null {
    const p = this.person(personId);
    const now = after ?? this.clock.now();
    const today = localParts(this.clock.now(), p.tz).date;
    const items = this.schedule(personId);
    let best: NextInfo | null = null;
    for (let d = 0; d < 8; d++) {
      const date = addDays(today, d);
      for (const it of items) {
        if (!daysMatch(it.days, dowOf(date))) continue;
        const due = zonedToUtc(date, it.hhmm, p.tz);
        if (due <= now) continue;
        const row = this.db.prepare("SELECT status FROM slots WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").get(personId, it.name, date, it.hhmm) as Row | undefined;
        if (row && row.status !== "pending") continue;
        if (!best || due < best.dueTs) {
          const whenText = d === 0 ? `at ${fmt12(it.hhmm)}` : d === 1 ? `tomorrow at ${fmt12(it.hhmm)}` : `on ${DAY_NAMES[dowOf(date)]} at ${fmt12(it.hhmm)}`;
          best = { item: it.name, hhmm: it.hhmm, dueTs: due, date, whenText };
        }
      }
    }
    return best;
  }

  whatsDue(personId: string): DueResult {
    const p = this.person(personId);
    this.checkMisses(personId);
    const now = this.clock.now();
    const slots = this.todaySlots(personId);
    return {
      person: p, now,
      due: slots.filter((s) => s.status === "pending" && s.due_ts <= now),
      overdue: slots.filter((s) => s.status === "missed"),
      next: this.nextInfo(personId),
    };
  }

  weekly(personId: string): { weekStart: string; days: { label: string; date: string; today: boolean; doses: { item: string; hhmm: string; state: SlotState }[]; state: SlotState }[]; timeline: Timeline | null } {
    const p = this.person(personId);
    this.checkMisses(personId);
    const now = this.clock.now();
    const today = localParts(now, p.tz).date;
    const start = mondayOf(today);
    const sched = this.schedule(personId);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      let doses: { item: string; hhmm: string; state: SlotState }[] = [];
      if (date <= today) {
        const rows = this.db.prepare("SELECT * FROM slots WHERE person=? AND local_date=? ORDER BY slot_hhmm").all(personId, date) as unknown as SlotRow[];
        doses = rows.map((r) => ({ item: r.item, hhmm: r.slot_hhmm, state: (r.status === "taken" || r.status === "taken_late" ? "taken" : r.status === "missed" ? "missed" : r.due_ts <= now ? "due" : "upcoming") as SlotState }));
      } else {
        doses = sched.filter((it) => daysMatch(it.days, i)).map((it) => ({ item: it.name, hhmm: it.hhmm, state: "upcoming" as SlotState }));
      }
      const state: SlotState = doses.length === 0 ? "nodata" : doses.some((d) => d.state === "missed") ? "missed" : doses.every((d) => d.state === "taken") ? "taken" : "upcoming";
      days.push({ label: DAY_NAMES[i], date, today: date === today, doses, state });
    }
    return { weekStart: start, days, timeline: this.timeline(personId) };
  }

  timeline(personId: string): Timeline | null {
    const p = this.person(personId);
    const e = this.db.prepare("SELECT * FROM escalations WHERE person = ? ORDER BY created_ts DESC LIMIT 1").get(personId) as EscRow | undefined;
    if (!e) return null;
    const slot = this.db.prepare("SELECT * FROM slots WHERE person=? AND item=? AND local_date=? AND slot_hhmm=?").get(e.person, e.item, e.local_date, e.slot_hhmm) as SlotRow | undefined;
    const due = slot?.due_ts ?? zonedToUtc(e.local_date, e.slot_hhmm, p.tz);
    const graceEnd = slot ? this.graceEnd(slot) : due + GRACE_MIN * MIN;
    const ev: TimelineEvent[] = [
      { ts: due, time: fmtClock(due, p.tz), label: `${e.item} scheduled`, kind: "done" },
      { ts: graceEnd, time: fmtClock(graceEnd, p.tz), label: "Grace period ended", kind: "plain" },
      { ts: e.created_ts, time: fmtClock(e.created_ts, p.tz), label: "Alert sent to caregiver", kind: "alert" },
    ];
    if (e.status === "resolved_late" && e.resolved_ts) ev.push({ ts: e.resolved_ts, time: fmtClock(e.resolved_ts, p.tz), label: "Late dose logged", kind: "done" });
    if (e.status === "superseded" && e.resolved_ts) ev.push({ ts: e.resolved_ts, time: fmtClock(e.resolved_ts, p.tz), label: "Snoozed after alert", kind: "plain" });
    return { title: `What happened at ${fmt12(e.slot_hhmm)}`, status: e.status, events: ev };
  }

  notifications(caregiver: string, markRead = false): { id: number; message: string; followup: string | null; whenText: string; read: boolean; ts: number }[] {
    const p = this.person("mom");
    const now = this.clock.now();
    const today = localParts(now, p.tz).date;
    const rows = this.db.prepare("SELECT * FROM notifications WHERE caregiver = ? ORDER BY created_ts DESC, id DESC LIMIT 50").all(caregiver) as Row[];
    const out = rows.map((r) => {
      const l = localParts(r.created_ts, p.tz);
      const when = fmtClock(r.created_ts, p.tz);
      return { id: Number(r.id), message: String(r.message), followup: (r.followup as string | null) ?? null, whenText: l.date === today ? when : `${DAY_NAMES[l.dow]} ${when}`, read: Boolean(r.read), ts: Number(r.created_ts) };
    });
    if (markRead) this.db.prepare("UPDATE notifications SET read = 1 WHERE caregiver = ?").run(caregiver);
    return out;
  }

  audit(tool: string, person: string | null, outcome: string): void {
    this.db.prepare("INSERT INTO audit_log(ts,tool,person,outcome) VALUES(?,?,?,?)").run(this.clock.now(), tool, person, outcome);
  }
}

export interface TimelineEvent { ts: number; time: string; label: string; kind: "done" | "alert" | "plain"; }
export interface Timeline { title: string; status: string; events: TimelineEvent[]; }
