// Child process used by concurrency.test.ts: opens the shared SQLite file and hammers check_misses.
import { openDb } from "../../src/server/db/db.js";
import { Core } from "../../src/server/core.js";
import { SimClock, demoStart } from "../../src/server/clock.js";

const [dbPath, startAt, rounds] = process.argv.slice(2);
const tz = "Asia/Kolkata";
const clock = new SimClock(demoStart(tz));
clock.advance(60);
const core = new Core(openDb(dbPath), clock, tz);
while (Date.now() < Number(startAt)) { /* barrier: both processes start together */ }
let created = 0;
for (let i = 0; i < Number(rounds); i++) created += core.checkMisses("mom").length;
console.log(JSON.stringify({ created }));
