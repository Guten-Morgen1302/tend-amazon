import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3000", trace: "off", screenshot: "off", viewport: { width: 1440, height: 1100 } },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: { TEND_DB: "data/e2e.db", TEND_CLOCK: "sim", TEND_PORT: "3100", SIM_PORT: "3000" },
  },
});
