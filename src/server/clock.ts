import { zonedToUtc } from "./time.js";

export interface Clock { now(): number; mode: "real" | "sim"; skippedMinutes(): number; advance(minutes: number): number; set(ts: number): void; }

export class RealClock implements Clock {
  mode = "real" as const;
  now() { return Date.now(); }
  skippedMinutes() { return 0; }
  advance(): number { throw new Error("The wall clock cannot be advanced."); }
  set(): void { throw new Error("The wall clock cannot be set."); }
}

/** Frozen demo clock: only moves when advance() is called. */
export class SimClock implements Clock {
  mode = "sim" as const;
  private base: number; private t: number;
  constructor(start: number) { this.base = start; this.t = start; }
  now() { return this.t; }
  skippedMinutes() { return Math.round((this.t - this.base) / 60000); }
  advance(minutes: number) { this.t += minutes * 60000; return this.t; }
  set(ts: number) { this.t = ts; }
  reset() { this.t = this.base; }
}

export const DEMO_START_DATE = "2026-10-16";
export const DEMO_START_HHMM = "08:02";
export function demoStart(tz: string): number { return zonedToUtc(DEMO_START_DATE, DEMO_START_HHMM, tz); }
export function makeClock(mode: string | undefined, tz: string): Clock {
  return mode === "real" ? new RealClock() : new SimClock(demoStart(tz));
}
