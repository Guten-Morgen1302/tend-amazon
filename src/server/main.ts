import { resolve } from "node:path";
import { openDb } from "./db/db.js";
import { Core } from "./core.js";
import { makeClock, SimClock } from "./clock.js";
import { createTendServer } from "./http.js";
import { seedDemo } from "../seed/seed.js";

export interface Config { host: string; port: number; tz: string; clockMode: string; token?: string; dbPath: string; }

export function loadConfig(env = process.env): Config {
  return {
    host: env.TEND_HOST ?? "127.0.0.1",
    port: Number(env.TEND_PORT ?? 3100),
    tz: env.TEND_TZ ?? "Asia/Kolkata",
    clockMode: env.TEND_CLOCK ?? "sim",
    token: env.TEND_TOKEN || undefined,
    dbPath: env.TEND_DB ?? resolve("data", "tend.db"),
  };
}

export function isLoopback(host: string): boolean { return ["127.0.0.1", "localhost", "::1"].includes(host); }

export async function start(cfg: Config) {
  if (!isLoopback(cfg.host) && !cfg.token) throw new Error("Refusing to bind a non-loopback host without TEND_TOKEN.");
  const db = openDb(cfg.dbPath);
  const clock = makeClock(cfg.clockMode, cfg.tz);
  const core = new Core(db, clock, cfg.tz);
  const hasPeople = (db.prepare("SELECT COUNT(*) AS n FROM people").get() as { n: number }).n > 0;
  // Sim mode always reseeds so the demo is reproducible; real mode keeps existing data.
  if (!hasPeople || clock.mode === "sim") seedDemo(core, cfg.tz);
  const server = createTendServer(core, { host: cfg.host, port: cfg.port, token: cfg.token, onReset: () => seedDemo(core, cfg.tz) });
  await new Promise<void>((ok) => server.listen(cfg.port, cfg.host, ok));
  return { server, core, db, clock: clock as SimClock };
}
