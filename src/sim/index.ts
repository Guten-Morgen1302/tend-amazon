import { createHost } from "./host.js";

const port = Number(process.env.SIM_PORT ?? 3000);
const tendUrl = process.env.TEND_URL ?? `http://127.0.0.1:${process.env.TEND_PORT ?? 3100}/mcp`;
const server = createHost({ port, tendUrl, token: process.env.TEND_TOKEN || undefined });
server.listen(port, "127.0.0.1", () => console.log(`sim-host listening on http://127.0.0.1:${port}/?view=demo (MCP server: ${tendUrl})`));
