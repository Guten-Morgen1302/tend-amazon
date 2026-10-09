// Time zone helpers built on Intl only (no dependency). DST-safe slot math lives here.
export interface LocalParts { date: string; hh: number; mm: number; dow: number; } // dow: 0=Mon..6=Sun

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return true; } catch { return false; }
}

const DOW: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function localParts(ts: number, tz: string): LocalParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(new Date(ts))) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hh: Number(p.hour), mm: Number(p.minute), dow: DOW[p.weekday] ?? 0 };
}

function offsetMs(ts: number, tz: string): number {
  const l = localParts(ts, tz);
  const [y, m, d] = l.date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, l.hh, l.mm) - Math.floor(ts / 60000) * 60000;
}

/** Local wall-clock date + HH:MM in tz -> UTC ms. An ambiguous time (DST fall back) takes the first occurrence; a nonexistent time (DST gap) moves forward. */
export function zonedToUtc(date: string, hhmm: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const t1 = guess - offsetMs(guess, tz);
  const t2 = guess - offsetMs(t1, tz);
  const matches = (t: number) => { const l = localParts(t, tz); return l.date === date && l.hh === hh && l.mm === mm; };
  const ok = [t1, t2].filter(matches);
  if (ok.length > 0) return Math.min(...ok);
  return Math.max(t1, t2);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function dowOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string): string { return addDays(date, -dowOf(date)); }

export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtClock(ts: number, tz: string): string {
  const l = localParts(ts, tz);
  return fmt12(`${String(l.hh).padStart(2, "0")}:${String(l.mm).padStart(2, "0")}`);
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
