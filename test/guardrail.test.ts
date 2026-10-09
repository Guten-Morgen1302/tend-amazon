import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { BANNED, findBanned, validateItemName, safe } from "../src/server/guardrail.js";
import { T } from "../src/server/templates.js";

describe("guardrail", () => {
  it("blocks every banned word and phrase, any case, with extra spaces", () => {
    for (const w of BANNED) {
      expect(findBanned(`please ${w.toUpperCase()} now`), w).not.toBeNull();
      expect(findBanned(`x ${w.replace(/ /g, "   ")} y`), w).not.toBeNull();
    }
  });

  it("blocks full-width lookalikes through NFKC normalisation", () => {
    expect(findBanned("ｄｏｓａｇｅ")).toBe("dosage");
  });

  it("does not block the product's own words", () => {
    for (const ok of ["Next dose", "Late dose logged", "No missed doses", "Clock skipped ahead", "Morning tablet", "Evening tablet", "Overdue", "Treat yourself"]) {
      expect(findBanned(ok), ok).toBeNull();
    }
  });

  it("validates item names", () => {
    expect(validateItemName("Morning tablet")).toEqual({ ok: true, name: "Morning tablet" });
    expect(validateItemName("Aspirin 500 mg").ok).toBe(false);
    expect(validateItemName("<img onerror=1>").ok).toBe(false);
    expect(validateItemName("").ok).toBe(false);
    expect(validateItemName("x".repeat(41)).ok).toBe(false);
    expect(validateItemName("tab\u0001let").ok).toBe(false);
  });

  it("safe() falls back when text trips the guardrail", () => {
    expect(safe("take more now")).toBe("Something needs your attention.");
    expect(safe("fine")).toBe("fine");
  });

  it("every template output passes the guardrail", () => {
    const out = [
      T.escalation("Mom", "Morning tablet", "08:00", 62), T.escalation("Mom", "Evening tablet", "21:00", 90),
      T.followupLate("9:17 AM", 77), T.followupSnoozed(), T.due("Morning tablet", "8:00 AM"), T.overdue("9:02 AM", "Morning tablet", "08:00"),
      T.logged("8:02 AM", "evening tablet at 9:00 PM"), T.logged("8:02 AM", null), T.alreadyLogged("8:02 AM"),
      T.nothingDue("Evening tablet at 9:00 PM"), T.nothingDue(null), T.snoozed(30), T.notUnderstood(),
    ];
    for (const s of out) expect(findBanned(s), s).toBeNull();
    // templates must not be silently replaced by the fallback
    for (const s of out) expect(s).not.toBe("Something needs your attention.");
  });

  it("every visible string in the demo script and the mockups passes the guardrail", () => {
    const files = ["docs/demo-script.md", ...readdirSync("docs/mockups").filter((f) => f.endsWith(".html")).map((f) => `docs/mockups/${f}`)];
    for (const f of files) {
      const text = readFileSync(f, "utf8").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
      expect(findBanned(text), f).toBeNull();
    }
  });
});
