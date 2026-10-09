// Records REAL footage of the running simulator for the demo video (video/raw/*.mp4 + *.marks.json).
// Honest by construction: a script drives the real UI at human speed; nothing is mocked. The only addition is a drawn
// cursor, because headless screen capture has no pointer. The video labels these clips as an automated run.
//   npm start (in another terminal)  then  npx tsx scripts/record-demo.ts
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const BASE = process.env.SIM_URL ?? "http://127.0.0.1:3000";
const OUT = join("video", "raw");
mkdirSync(OUT, { recursive: true });

const CURSOR = `
(() => {
  const c = document.createElement('div');
  c.id = '__cur';
  c.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;left:0;top:0;pointer-events:none;transform:translate(-3px,-2px);transition:none';
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8-6.5 1.8L8.5 18z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const r = document.createElement('div');
  r.style.cssText = 'position:fixed;z-index:2147483646;width:14px;height:14px;border-radius:50%;border:3px solid #2dd4bf;pointer-events:none;opacity:0;transform:translate(-50%,-50%)';
  const add = () => { document.body.append(r, c); };
  document.body ? add() : document.addEventListener('DOMContentLoaded', add);
  addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; r.style.opacity = '1'; r.style.transition = 'none'; r.style.width = '14px'; r.style.height = '14px';
    requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = 'all 450ms ease-out'; r.style.width = '64px'; r.style.height = '64px'; r.style.opacity = '0'; }));
  }, true);
})();`;

interface Rec { page: Page; mark: (name: string) => void; finish: () => Promise<void>; }

async function startRecording(name: string, viewport: { width: number; height: number }, dsf: number): Promise<Rec> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const dir = join(OUT, `${name}-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: { t: number; file: string }[] = [];
  const marks: Record<string, number> = {};
  let n = 0;
  let pending = Promise.resolve();
  cdp.on("Page.screencastFrame", (f: any) => {
    const t = Date.now();
    const file = join(dir, `f${String(n++).padStart(5, "0")}.jpg`);
    frames.push({ t, file });
    pending = pending.then(async () => {
      writeFileSync(file, Buffer.from(f.data, "base64"));
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: Math.round(viewport.width * dsf), maxHeight: Math.round(viewport.height * dsf), everyNthFrame: 1 });
  const mark = (m: string) => { marks[m] = Date.now(); };
  const finish = async () => {
    await cdp.send("Page.stopScreencast").catch(() => undefined);
    await pending;
    const end = Date.now();
    await browser.close();
    if (frames.length === 0) throw new Error(`${name}: no frames captured`);
    const t0 = frames[0].t;
    // Resample to exactly 30 fps ourselves: output frame k shows the newest captured frame at or before k/30 s.
    // Every entry has the same duration, so the video length equals the recording length (no drift, no dropped time).
    const relPath = (f: string) => f.replace(/\\/g, "/").replace(/^.*?video\/raw\//, "");
    const total = (end - t0) / 1000;
    const nOut = Math.floor(total * 30);
    let list = "ffconcat version 1.0\n";
    let idx = 0;
    let lastFile = "";
    for (let k = 0; k < nOut; k++) {
      const tk = t0 + (k / 30) * 1000;
      while (idx + 1 < frames.length && frames[idx + 1].t <= tk) idx++;
      lastFile = relPath(frames[idx].file);
      list += `file '${lastFile}'\nduration ${(1 / 30).toFixed(6)}\n`;
    }
    list += `file '${lastFile}'\n`; // the concat demuxer needs the last file repeated for its duration to apply
    const listPath = join(OUT, `${name}.ffconcat`);
    writeFileSync(listPath, list);
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listPath, "-vf", "format=yuv420p", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", join(OUT, `${name}.mp4`)], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
    const rel = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +((v - t0) / 1000).toFixed(2)]));
    writeFileSync(join(OUT, `${name}.marks.json`), JSON.stringify({ duration: +((end - t0) / 1000).toFixed(2), marks: rel }, null, 1));
    rmSync(dir, { recursive: true, force: true });
    console.log(`${name}: ${((end - t0) / 1000).toFixed(1)}s`, rel);
  };
  return { page, mark, finish };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function glide(page: Page, x: number, y: number, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16));
  await page.mouse.move(x, y, { steps });
}
async function clickEl(page: Page, selector: string, opts: { name?: string } = {}) {
  const loc = opts.name ? page.getByRole("button", { name: opts.name, exact: true }) : page.locator(selector);
  const box = await loc.first().boundingBox();
  if (!box) throw new Error(`no box for ${selector || opts.name}`);
  await glide(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(150);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
/** Smooth scroll driven by requestAnimationFrame so the capture gets a frame per step. */
async function smoothScroll(page: Page, dy: number, ms = 900) {
  // A plain string, so the TypeScript runner cannot inject helpers (like __name) that do not exist in the page.
  await page.evaluate(`new Promise((done) => {
    const d = ${dy}, t = ${ms}, start = performance.now(), y0 = window.scrollY;
    const step = (now) => { const p = Math.min(1, (now - start) / t); const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; window.scrollTo(0, y0 + d * e); if (p < 1) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  })`);
}
async function typeInto(page: Page, text: string, perChar = 85) {
  await clickEl(page, "#u");
  await page.keyboard.type(text, { delay: perChar });
  await sleep(350);
  await page.keyboard.press("Enter");
}
const post = (page: Page, path: string, data: unknown) => page.request.post(BASE + path, { data });

async function main() {
  // ---- 1. the demo flow: ask, skip the clock, one alert, late dose resolves it ----
  {
    const { page, mark, finish } = await startRecording("flow", { width: 1280, height: 1000 }, 1.5);
    await post(page, "/api/reset", {});
    await page.goto(`${BASE}/?view=demo`);
    await page.waitForSelector(".panel .item");
    await page.mouse.move(900, 700);
    await sleep(2200);
    mark("ask_start");
    await typeInto(page, "What's due?");
    await page.waitForSelector(".transcript .line >> text=morning tablet is due");
    await sleep(2600);
    mark("ask_end");
    mark("skip_start");
    await clickEl(page, "", { name: "+1 hour" });
    await page.waitForSelector(".status-overdue");
    await sleep(4200);
    mark("skip_end");
    mark("caregiver_start");
    await page.mouse.move(1000, 260, { steps: 40 });
    await sleep(1800);
    await page.mouse.move(1000, 500, { steps: 40 });
    await sleep(1800);
    await page.mouse.move(1000, 760, { steps: 40 });
    await sleep(2400);
    mark("caregiver_end");
    mark("late_start");
    await clickEl(page, "", { name: "+15 min" });
    await sleep(2000);
    await typeInto(page, "I took my morning pills");
    await page.waitForSelector(".okline");
    await sleep(3800);
    mark("late_end");
    await finish();
  }

  // ---- 2. safety: advice words and markup are refused, a normal schedule is confirmed then saved ----
  {
    const { page, mark, finish } = await startRecording("safety", { width: 1280, height: 1000 }, 1.5);
    await post(page, "/api/reset", {});
    await page.goto(`${BASE}/?view=kitchen`);
    await page.waitForSelector(".panel .item");
    await page.mouse.move(900, 600);
    await sleep(1800);
    mark("bad_name_start");
    await typeInto(page, "Aspirin 500 mg dosage at 8am", 70);
    await page.waitForSelector(".transcript .line >> text=advice or dosing");
    await sleep(3000);
    mark("bad_name_end");
    mark("xss_start");
    await typeInto(page, "<img src=x onerror=boom()> at 8am", 70);
    await page.waitForSelector(".transcript .line >> text=Names can use letters");
    await sleep(3000);
    mark("xss_end");
    mark("good_start");
    await typeInto(page, "Noon tablet at 12pm", 80);
    await page.waitForSelector(".transcript .line >> text=Save this schedule?");
    await sleep(1800);
    await clickEl(page, "", { name: "Save" });
    await page.waitForSelector(".transcript .line >> text=Saved 1 reminder");
    await sleep(2600);
    mark("good_end");
    await finish();
  }

  // ---- 3. the caregiver on a phone ----
  {
    await (async () => {
      const b = await chromium.launch();
      const c = await b.newContext();
      const p = await c.newPage();
      await p.request.post(BASE + "/api/reset", { data: {} });
      await p.request.post(BASE + "/api/clock", { data: { advance_minutes: 60 } });
      await p.request.post(BASE + "/api/clock", { data: { advance_minutes: 15 } });
      await p.request.post(BASE + "/api/say", { data: { text: "I took my morning pills" } });
      await b.close();
    })();
    const { page, mark, finish } = await startRecording("phone", { width: 390, height: 844 }, 3);
    await page.goto(`${BASE}/?view=care`);
    await page.waitForSelector(".okline");
    await page.mouse.move(200, 500);
    await sleep(2200);
    mark("scroll_start");
    for (let i = 0; i < 5; i++) { await smoothScroll(page, 300, 1100); await sleep(500); }
    await sleep(1500);
    mark("scroll_end");
    await finish();
  }
  const b = await chromium.launch();
  await (await b.newContext()).request.post(BASE + "/api/reset", { data: {} });
  await b.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
