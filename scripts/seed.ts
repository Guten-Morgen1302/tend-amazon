import { loadConfig } from "../src/server/main.js";
import { openDb } from "../src/server/db/db.js";
import { Core } from "../src/server/core.js";
import { makeClock } from "../src/server/clock.js";
import { seedDemo } from "../src/seed/seed.js";

const cfg = loadConfig();
seedDemo(new Core(openDb(cfg.dbPath), makeClock(cfg.clockMode, cfg.tz), cfg.tz), cfg.tz);
console.log(`Seeded synthetic demo data into ${cfg.dbPath}`);
