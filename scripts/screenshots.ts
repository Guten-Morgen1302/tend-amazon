// Captures real screenshots of the running simulator into docs/screens/ (used to compare the build with docs/mockups/).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.SIM_URL ?? "http://127.0.0.1:3000";
mkdirSync("docs/screens", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const post = (p: string, d: unknown) => page.request.post(base + p, { data: d });

await post("/api/reset", {});
await page.goto(`${base}/?view=kitchen`); await page.waitForSelector(".panel .item");
await page.screenshot({ path: "docs/screens/kitchen.png" });
await page.locator("#u").fill("I took my morning pills"); await page.locator("#u").press("Enter");
await page.waitForSelector(".panel .eyebrow >> text=taken");
await page.screenshot({ path: "docs/screens/kitchen-after-log.png" });

await post("/api/reset", {});
await post("/api/clock", { advance_minutes: 60 });
await page.goto(`${base}/?view=demo`); await page.waitForSelector(".status-overdue");
await page.screenshot({ path: "docs/screens/demo.png", fullPage: true });
await page.goto(`${base}/?view=kitchen`); await page.waitForSelector(".status-overdue");
await page.screenshot({ path: "docs/screens/kitchen-overdue.png" });

await post("/api/clock", { advance_minutes: 15 });
await page.goto(`${base}/?view=demo`); await page.locator("#u").fill("I took my morning pills"); await page.locator("#u").press("Enter");
await page.waitForSelector(".okline");
await page.goto(`${base}/?view=care`); await page.waitForSelector(".okline");
await page.screenshot({ path: "docs/screens/care.png", fullPage: true });
await page.setViewportSize({ width: 375, height: 900 });
await page.goto(`${base}/?view=care`); await page.waitForSelector(".okline");
await page.screenshot({ path: "docs/screens/care-phone.png", fullPage: true });
await post("/api/reset", {});
await browser.close();
console.log("screenshots written to docs/screens/");
