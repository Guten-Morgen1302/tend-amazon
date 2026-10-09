// Fixed message templates. Every string passes through the guardrail before leaving the server.
import { safe } from "./guardrail.js";
import { fmt12 } from "./time.js";

const bare = (hhmm: string) => fmt12(hhmm).replace(/ AM$/, "");

export const T = {
  escalation: (person: string, item: string, hhmm: string, minutes: number) =>
    safe(`${person} has not logged her ${bare(hhmm)} ${item.toLowerCase()}. It has been ${minutes} minutes.`),
  followupLate: (clock: string, minutesLate: number) => safe(`Logged at ${clock}, ${minutesLate} minutes late.`),
  followupSnoozed: () => "Snoozed after the alert. No second message was sent.",
  due: (item: string, clock: string) => safe(`Your ${item.toLowerCase()} is due at ${clock}.`),
  overdue: (clock: string, item: string, hhmm: string) => safe(`It is ${clock}. The ${bare(hhmm)} ${item.toLowerCase()} is not logged yet.`),
  logged: (clock: string, next: string | null) => safe(next ? `Logged at ${clock}. Next is ${next}.` : `Logged at ${clock}.`),
  alreadyLogged: (clock: string) => safe(`Already logged at ${clock}.`),
  nothingDue: (next: string | null) => safe(next ? `Nothing due today. Next: ${next}.` : "Waiting for your caregiver to set up reminders."),
  snoozed: (minutes: number) => safe(`Okay. I will check again ${minutes} minutes later.`),
  notUnderstood: () => "I didn't understand. Try: Morning tablet at 8am daily.",
};
