// Deterministic schedule parser and intent router. No AI, no network. Free text in, a proposal out (never saved here).
import { validateItemName } from "./guardrail.js";

export interface ParsedItem { name: string; hhmm: string; days: string; } // days: "daily" | "weekdays" | "weekends"
export interface ParseResult { items: ParsedItem[]; errors: string[]; }

export const MAX_TEXT = 500;
const RX = /^(.+?)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?:\s+(daily|every\s*day|each\s*day|weekdays?|weekends?))?$/i;
const EXAMPLE = "Try: Morning tablet at 8am daily.";

function normDays(s?: string): string {
  if (!s) return "daily";
  const t = s.toLowerCase();
  if (t.startsWith("weekday")) return "weekdays";
  if (t.startsWith("weekend")) return "weekends";
  return "daily";
}

export function parseSchedule(text: string): ParseResult {
  const errors: string[] = [];
  const items: ParsedItem[] = [];
  const src = text.normalize("NFC");
  if (src.length > MAX_TEXT) return { items, errors: [`That is too long. Keep it under ${MAX_TEXT} characters.`] };
  const parts = src.split(/[;\n]|,(?!\d)/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { items, errors: [`I didn't understand. ${EXAMPLE}`] };
  for (const part of parts) {
    const m = RX.exec(part);
    if (!m) { errors.push(`I didn't understand "${part.slice(0, 40)}". ${EXAMPLE}`); continue; }
    let h = Number(m[2]);
    const min = m[3] ? Number(m[3]) : 0;
    const ap = m[4]?.toLowerCase().replace(/\./g, "");
    if (min > 59 || h > 23 || (ap && (h < 1 || h > 12))) { errors.push(`"${part.slice(0, 40)}" has a time that does not exist.`); continue; }
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const v = validateItemName(m[1].replace(/\s+(at|@)$/i, ""));
    if (!v.ok) { errors.push(v.error); continue; }
    const name = v.name.charAt(0).toUpperCase() + v.name.slice(1);
    items.push({ name, hhmm: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, days: normDays(m[5]) });
  }
  return { items, errors };
}

export function daysMatch(days: string, dow: number): boolean {
  if (days === "weekdays") return dow <= 4;
  if (days === "weekends") return dow >= 5;
  return true;
}

export type Intent =
  | { kind: "whats_due" }
  | { kind: "log"; item?: string }
  | { kind: "snooze"; item?: string }
  | { kind: "week" }
  | { kind: "alerts" }
  | { kind: "schedule"; text: string }
  | { kind: "unknown" };

const PARTS = /\b(morning|evening|afternoon|night|noon)\b/;

/** Deterministic intent router used by the simulator host. */
export function routeUtterance(raw: string): Intent {
  const t = raw.normalize("NFC").trim().replace(/\s+/g, " ").slice(0, MAX_TEXT);
  const l = t.toLowerCase();
  if (!l) return { kind: "unknown" };
  if (/\bsnooze\b|\bremind me (later|again)\b/.test(l)) return { kind: "snooze", item: PARTS.exec(l)?.[1] };
  if (/\b(i\s+)?(took|taken|had|logged)\b/.test(l)) return { kind: "log", item: PARTS.exec(l)?.[1] };
  if (/what'?s due|what is due|next dose|due now|what do i take/.test(l)) return { kind: "whats_due" };
  if (/\bweek\b|\bhistory\b|how was/.test(l)) return { kind: "week" };
  if (/\balerts?\b|\bnotifications?\b/.test(l)) return { kind: "alerts" };
  if (/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/.test(l) || /^(set|schedule)\b/.test(l)) {
    return { kind: "schedule", text: t.replace(/^(set|schedule)\s*(a\s+)?(schedule\s*)?:?\s*/i, "") };
  }
  return { kind: "unknown" };
}
