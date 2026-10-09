import { openDb } from "../src/server/db/db.js";
import { Core } from "../src/server/core.js";
import { SimClock, demoStart } from "../src/server/clock.js";
import { seedDemo } from "../src/seed/seed.js";

export const TZ = "Asia/Kolkata";

export function makeCore(path = ":memory:", tz = TZ) {
  const db = openDb(path);
  const clock = new SimClock(demoStart(tz));
  const core = new Core(db, clock, tz);
  seedDemo(core, tz);
  return { core, clock, db };
}

export const count = (db: ReturnType<typeof openDb>, sql: string, ...p: any[]) => Number((db.prepare(sql).get(...p) as any).n);
