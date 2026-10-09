// Synthetic demo data. Idempotent: running it again wipes and rewrites the same rows.
import { Core } from "../server/core.js";
import { resetDb } from "../server/db/db.js";
import { addDays, zonedToUtc } from "../server/time.js";
import { DEMO_START_DATE } from "../server/clock.js";
import { T } from "../server/templates.js";

export const ITEMS = [
  { name: "Morning tablet", hhmm: "08:00" },
  { name: "Evening tablet", hhmm: "21:00" },
];

/** Mon to Thu complete (Thu evening was an earlier escalation resolved 85 min late), Fri today, Sat and Sun upcoming. */
export function seedDemo(core: Core, tz: string): void {
  const db = core.db;
  resetDb(db);
  db.prepare("INSERT INTO people(id,name,tz,role) VALUES('mom','Mom',?, 'elder')").run(tz);
  db.prepare("INSERT INTO people(id,name,tz,role) VALUES('alex','Alex',?, 'caregiver')").run(tz);
  core.setSchedule("mom", ITEMS.map((i) => ({ ...i, days: "daily" })));
  const friday = DEMO_START_DATE;
  const ins = db.prepare("INSERT INTO slots(person,item,local_date,slot_hhmm,due_ts,status,taken_ts,snoozed) VALUES('mom',?,?,?,?,?,?,0)");
  for (let back = 4; back >= 1; back--) {
    const date = addDays(friday, -back); // Mon..Thu
    for (const it of ITEMS) {
      const due = zonedToUtc(date, it.hhmm, tz);
      const thuPm = back === 1 && it.hhmm === "21:00";
      if (thuPm) {
        const takenTs = due + 85 * 60000;
        ins.run(it.name, date, it.hhmm, due, "taken_late", takenTs);
        const created = due + 62 * 60000;
        const n = db.prepare("INSERT INTO notifications(caregiver,message,followup,created_ts,read) VALUES('alex',?,?,?,1)").run(
          T.escalation("Mom", it.name, it.hhmm, 62), T.followupLate("10:25 PM", 85), created);
        db.prepare("INSERT INTO escalations(person,item,local_date,slot_hhmm,status,created_ts,resolved_ts,notification_id) VALUES('mom',?,?,?,'resolved_late',?,?,?)")
          .run(it.name, date, it.hhmm, created, takenTs, Number(n.lastInsertRowid));
      } else {
        ins.run(it.name, date, it.hhmm, due, "taken", due + 3 * 60000);
      }
    }
  }
}
