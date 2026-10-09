import { describe, it, expect } from "vitest";
import { parseSchedule, routeUtterance } from "../src/server/parser.js";

describe("parseSchedule golden set", () => {
  const cases: [string, { name: string; hhmm: string; days: string }[]][] = [
    ["Morning tablet at 8am daily", [{ name: "Morning tablet", hhmm: "08:00", days: "daily" }]],
    ["Evening tablet at 9pm", [{ name: "Evening tablet", hhmm: "21:00", days: "daily" }]],
    ["Noon tablet 12pm", [{ name: "Noon tablet", hhmm: "12:00", days: "daily" }]],
    ["Midnight tablet at 12am", [{ name: "Midnight tablet", hhmm: "00:00", days: "daily" }]],
    ["Morning tablet at 8:30 am weekdays", [{ name: "Morning tablet", hhmm: "08:30", days: "weekdays" }]],
    ["Weekend tablet at 10:15 pm on weekends", []],
    ["Evening tablet at 21:00", [{ name: "Evening tablet", hhmm: "21:00", days: "daily" }]],
    ["Morning tablet at 8am; Evening tablet at 9pm", [{ name: "Morning tablet", hhmm: "08:00", days: "daily" }, { name: "Evening tablet", hhmm: "21:00", days: "daily" }]],
    ["morning tablet at 8am, evening tablet at 8:45pm", [{ name: "Morning tablet", hhmm: "08:00", days: "daily" }, { name: "Evening tablet", hhmm: "20:45", days: "daily" }]],
    ["Afternoon tablet at 3 p.m. every day", [{ name: "Afternoon tablet", hhmm: "15:00", days: "daily" }]],
  ];
  for (const [text, want] of cases) {
    it(text, () => {
      const r = parseSchedule(text);
      if (want.length) expect(r.items).toEqual(want); else expect(r.items.length + r.errors.length).toBeGreaterThan(0);
    });
  }

  it("rejects bad input with a clear message, never a guess", () => {
    expect(parseSchedule("").errors[0]).toMatch(/didn't understand/);
    expect(parseSchedule("blah blah").errors[0]).toMatch(/Try: Morning tablet at 8am daily/);
    expect(parseSchedule("Tablet at 25:00").errors[0]).toMatch(/does not exist/);
    expect(parseSchedule("Tablet at 13pm").errors[0]).toMatch(/does not exist/);
    expect(parseSchedule("Aspirin dosage at 8am").errors[0]).toMatch(/advice or dosing/);
    expect(parseSchedule("<b>x</b> at 8am").errors[0]).toMatch(/letters/);
    expect(parseSchedule("a".repeat(501)).errors[0]).toMatch(/too long/);
  });
});

describe("routeUtterance", () => {
  it("maps the demo phrases", () => {
    expect(routeUtterance("I took my morning pills")).toEqual({ kind: "log", item: "morning" });
    expect(routeUtterance("took it")).toEqual({ kind: "log", item: undefined });
    expect(routeUtterance("What's due?")).toEqual({ kind: "whats_due" });
    expect(routeUtterance("snooze the evening one")).toEqual({ kind: "snooze", item: "evening" });
    expect(routeUtterance("how was the week")).toEqual({ kind: "week" });
    expect(routeUtterance("show alerts")).toEqual({ kind: "alerts" });
    expect(routeUtterance("Morning tablet at 8am daily")).toMatchObject({ kind: "schedule" });
    expect(routeUtterance("")).toEqual({ kind: "unknown" });
    expect(routeUtterance("tell me a joke")).toEqual({ kind: "unknown" });
  });
});
