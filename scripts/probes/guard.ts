import { findBanned, validateItemName } from "../../src/server/guardrail.js";
import { makeCore } from "../../test/helpers.js";

console.log(findBanned("Aspirin dosage"), JSON.stringify(validateItemName("Aspirin dosage")));
const { core } = makeCore();
try { core.setSchedule("mom", [{ name: "Aspirin dosage", hhmm: "08:00" }]); console.log("no throw"); } catch (e) { console.log("threw", (e as Error).message); }
