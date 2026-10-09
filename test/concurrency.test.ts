import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCore, count } from "./helpers.js";
import { openDb } from "../src/server/db/db.js";

function runChild(dbPath: string, startAt: number, rounds: number): Promise<{ created: number; code: number | null; err: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, ["--import", "tsx", "test/fixtures/escalate.ts", dbPath, String(startAt), String(rounds)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      const line = out.trim().split("\n").filter((l) => l.startsWith("{")).pop();
      ok({ created: line ? JSON.parse(line).created : -1, code, err: err.replace(/\(node:\d+\) ExperimentalWarning[^\n]*\n?/g, "").replace(/\(Use `node --trace-warnings[^\n]*\n?/g, "") });
    });
  });
}

describe("escalation idempotency across processes", () => {
  it("two OS processes calling check_misses for the same slot produce one escalation and one notification", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tend-"));
    const path = join(dir, "t.db");
    try {
      const { db } = makeCore(path);
      db.close();
      const startAt = Date.now() + 2500;
      const [a, b] = await Promise.all([runChild(path, startAt, 30), runChild(path, startAt, 30)]);
      expect(a.code, a.err).toBe(0);
      expect(b.code, b.err).toBe(0);
      // Exactly one of the two created the escalation; the loser's calls were no-ops or retried.
      expect(a.created + b.created).toBe(2 - 1); // morning only: evening is not due yet at 09:02
      const check = openDb(path);
      expect(count(check, "SELECT COUNT(*) AS n FROM escalations WHERE status='escalated'")).toBe(1);
      expect(count(check, "SELECT COUNT(*) AS n FROM notifications WHERE read=0")).toBe(1);
      check.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
