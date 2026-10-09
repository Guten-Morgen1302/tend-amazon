import { loadConfig, start } from "./main.js";

process.env.TEND_LOG ??= "json";
const cfg = loadConfig();
start(cfg)
  .then(() => console.log(`tend-server listening on http://${cfg.host}:${cfg.port}/mcp (clock: ${cfg.clockMode})`))
  .catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
