// The demo script (docs/demo-script.md) as a test, plus state, route and security checks.
import { test, expect, type Page } from "@playwright/test";

async function reset(page: Page) {
  await page.request.post("/api/reset", { data: {} });
}

test.describe("demo script", () => {
  test.beforeEach(async ({ page }) => { await reset(page); });

  test("full flow: ask, skip the clock, one alert, late dose resolves it", async ({ page }) => {
    await page.goto("/?view=demo");
    await expect(page.locator("#chip")).toHaveText("Demo time 8:02 AM");
    await expect(page.getByRole("heading", { name: "Simulated Alexa+ display" })).toBeVisible();
    await expect(page.locator(".panel .item")).toHaveText("Morning tablet");

    // shot 2: ask by typing
    await page.locator("#u").fill("What's due?");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".transcript .line").last()).toContainText("Your morning tablet is due at 8:00 AM.");

    // shot 3: skip +1 hour -> overdue, spoken line text appears in the transcript
    await page.getByRole("button", { name: "+1 hour" }).click();
    await expect(page.locator("#chip")).toHaveText("Demo time 9:02 AM (skipped +1 h)");
    await expect(page.locator(".status-overdue")).toContainText("Overdue");
    await expect(page.locator(".transcript .line").last()).toContainText("It is 9:02 AM. The 8:00 morning tablet is not logged yet.");

    // shot 4: caregiver side
    await expect(page.locator(".statusline")).toContainText("Missed: Morning tablet at 8:00 AM");
    await expect(page.locator(".alerts li").first()).toContainText("Mom has not logged her 8:00 morning tablet. It has been 62 minutes.");
    await expect(page.locator(".alerts li").first().locator(".new")).toHaveText("New");
    await expect(page.locator(".alerts li")).toHaveCount(2);
    await expect(page.locator(".rail li.skip")).toContainText("Clock skipped ahead (+1 h)");

    // exactly one escalation even after a refresh and a repeated skip-free poll
    await page.reload();
    await expect(page.locator(".alerts li")).toHaveCount(2);

    // shot 5: +15 min, late dose by typing
    await page.getByRole("button", { name: "+15 min" }).click();
    await expect(page.locator("#chip")).toHaveText("Demo time 9:17 AM (skipped +1 h 15 min)");
    await page.locator("#u").fill("I took my morning pills");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".alerts li").first().locator(".followup")).toHaveText("Logged at 9:17 AM, 77 minutes late.");
    await expect(page.locator(".okline")).toContainText("Logged late: Morning tablet at 9:17 AM");
    await expect(page.locator(".alerts li")).toHaveCount(2);
    await expect(page.locator(".rail li").last()).toContainText("Late dose logged");
    await expect(page.locator(".rail li.skip")).toContainText("Clock skipped ahead (+1 h, then +15 min)");
    await expect(page.locator(".panel .item")).toHaveText("Evening tablet");
  });

  test("I took it button, double tap is debounced and idempotent", async ({ page }) => {
    await page.goto("/?view=kitchen");
    const btn = page.getByRole("button", { name: "I took it" });
    await btn.click();
    await expect(page.locator(".panel .eyebrow")).toContainText("Morning tablet: taken at 8:02");
    await expect(page.locator(".panel .item")).toHaveText("Evening tablet");
    await page.locator("#u").fill("I took my morning pills");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".transcript .line").last()).toContainText("Already logged at 8:02 AM.");
  });

  test("routes: kitchen shows no caregiver alerts; care shows no kitchen panel; footer on both", async ({ page }) => {
    await page.goto("/?view=kitchen");
    await expect(page.locator(".alerts")).toHaveCount(0);
    await expect(page.locator("#pagefoot")).toBeVisible();
    await expect(page.locator("#tray")).toBeHidden();
    await page.goto("/?view=care");
    await expect(page.locator(".panel")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
    await expect(page.locator("#pagefoot")).toBeVisible();
    await page.goto("/?view=demo");
    await expect(page.locator("#tray")).toBeVisible();
  });

  test("week strip shows the seeded week; phone width becomes a 7 row list", async ({ page }) => {
    await page.goto("/?view=care");
    await expect(page.locator(".week .day")).toHaveCount(7);
    await expect(page.locator(".week .day").nth(3)).toContainText("Thu");
    await expect(page.locator(".foot", { hasText: "Demo data" })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 900 });
    const cols = await page.locator(".week").evaluate((n) => getComputedStyle(n).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("schedule proposal: confirm before save, unparseable input is a clear message", async ({ page }) => {
    await page.goto("/?view=kitchen");
    await page.locator("#u").fill("Noon tablet at 12pm");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".transcript .line").last()).toContainText("Save this schedule?");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".transcript .line").last()).toContainText("Saved 1 reminder");
    await page.locator("#u").fill("tell me a joke");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".transcript .line").last()).toContainText("I didn't understand");
  });

  test("hostile input renders as text and never as markup", async ({ page }) => {
    await page.goto("/?view=kitchen");
    await page.locator("#u").fill("<img src=x onerror=window.__pwned=1> at 8am");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".transcript .line").last()).toContainText("letters");
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    expect(await page.locator(".transcript img").count()).toBe(0);
  });

  test("chaos: tend-server down shows the offline banner, recovery clears it", async ({ page }) => {
    await page.goto("/?view=kitchen");
    await expect(page.locator("#offline")).toBeHidden();
    // simulate failure through the UI's own error path
    await page.route("**/api/say", (r) => r.abort());
    await page.locator("#u").fill("What's due?");
    await page.locator("#u").press("Enter");
    await expect(page.locator("#offline")).toBeVisible();
    await page.unroute("**/api/say");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator("#offline")).toBeHidden();
  });

  test("voice: a recognizer that fails at runtime shows a message and text input still works", async ({ page }) => {
    await page.addInitScript(() => {
      class Broken { start() { setTimeout(() => (this as any).onerror?.({ error: "network" }), 10); } }
      (window as any).webkitSpeechRecognition = Broken;
      (window as any).SpeechRecognition = Broken;
    });
    await page.goto("/?view=kitchen");
    await page.getByRole("button", { name: "Speak" }).click();
    await expect(page.locator(".transcript .line.err").last()).toContainText("Voice didn't work here. Type it instead.");
    await page.locator("#u").fill("What's due?");
    await page.locator("#u").press("Enter");
    await expect(page.locator(".transcript .line").last()).toContainText("morning tablet");
  });

  test("voice: no recognizer at all hides the mic, typing works", async ({ page }) => {
    await page.addInitScript(() => { delete (window as any).SpeechRecognition; delete (window as any).webkitSpeechRecognition; });
    await page.goto("/?view=kitchen");
    await expect(page.getByRole("button", { name: "Speak" })).toHaveCount(0);
    await expect(page.locator("#u")).toBeVisible();
  });

  test("accessibility basics: landmarks, labels, live region, targets", async ({ page }) => {
    await page.goto("/?view=demo");
    await expect(page.locator("main[aria-label='Kitchen display']")).toHaveCount(1);
    await expect(page.locator("main[aria-label='Caregiver']")).toHaveCount(1);
    await expect(page.locator("label[for='u']")).toHaveText("Say it or type it");
    await expect(page.locator("[role='status'][aria-live='polite']")).toHaveCount(1);
    const big = await page.getByRole("button", { name: "I took it" }).boundingBox();
    expect(big!.height).toBeGreaterThanOrEqual(64);
    const input = await page.locator("#u").boundingBox();
    expect(input!.height).toBeGreaterThanOrEqual(64);
    const tray = await page.getByRole("button", { name: "+15 min" }).boundingBox();
    expect(tray!.height).toBeGreaterThanOrEqual(48);
  });

  test("the swap animation plays when the due item changes and not on a plain refresh", async ({ page }) => {
    await page.goto("/?view=kitchen");
    await expect(page.locator(".panel .swap")).toHaveCount(1); // first paint animates once
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector("#u")!.dispatchEvent(new Event("input"))); // no state change
    await page.locator("#u").fill("x");
    await page.locator("#u").press("Enter"); // unknown utterance re-renders without changing the due item
    await expect(page.locator(".transcript .line").last()).toContainText("I didn't understand");
    await expect(page.locator(".panel .swap")).toHaveCount(0);
    await page.getByRole("button", { name: "I took it" }).click();
    await expect(page.locator(".panel .swap")).toHaveCount(1);
  });

  test("reduced motion: the swap animation is off", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", baseURL: "http://127.0.0.1:3000" });
    const page = await ctx.newPage();
    await page.request.post("/api/reset", { data: {} });
    await page.goto("/?view=kitchen");
    expect(await page.locator(".panel .swap").count()).toBe(0);
    await ctx.close();
  });

  test("security headers and host checks on the simulator host", async ({ page, request }) => {
    const r = await request.get("/");
    expect(r.headers()["content-security-policy"]).toContain("script-src 'self'");
    expect((await request.post("/api/action", { data: { tool: "whats_due" } })).status()).toBe(400); // not an allowed action
    expect((await request.get("/../package.json")).status()).not.toBe(200);
    expect((await request.get("/fonts/OFL.txt")).status()).toBe(200);
    expect((await request.post("/api/say", { headers: { origin: "http://evil.example" }, data: { text: "x" } })).status()).toBe(403);
  });
});
