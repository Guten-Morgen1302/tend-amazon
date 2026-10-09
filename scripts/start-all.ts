// npm start: runs tend-server and sim-host in one process group and prints the demo URL.
import { spawn, type ChildProcess } from "node:child_process";

const kids: ChildProcess[] = [];
function run(script: string) {
  const p = spawn(process.execPath, ["--import", "tsx", script], { stdio: "inherit", env: process.env });
  p.on("exit", (code) => { if (code) { console.error(`${script} exited with code ${code}`); stop(code ?? 1); } });
  kids.push(p);
}
function stop(code = 0) { for (const k of kids) k.kill(); process.exit(code); }
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

run("src/server/index.ts");
setTimeout(() => run("src/sim/index.ts"), 1200);
setTimeout(() => console.log(`\nOpen http://127.0.0.1:${process.env.SIM_PORT ?? 3000}/?view=demo\n`), 3000);
