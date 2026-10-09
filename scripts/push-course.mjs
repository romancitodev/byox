// Sube una carpeta de curso al MCP de byox, como lo haría la IA autora.
//   node scripts/push-course.mjs <carpeta> [--verify] [--start] [--reset]
// Desde el host sin Node:
//   docker run --rm --network byox -v "$PWD:/w" -w /w node:22-bookworm-slim \
//     node scripts/push-course.mjs examples/build-your-own-calc --verify --start
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

// BYOX_TOKEN: un token personal (Cuenta → Tokens). BYOX_MCP: otra URL del MCP.
const MCP = process.env.BYOX_MCP ?? "http://mcp:3333/mcp";
const [dir, ...flags] = process.argv.slice(2);
if (!dir) {
  console.error("uso: push-course.mjs <carpeta> [--verify] [--start] [--reset]");
  process.exit(2);
}
const slug = basename(dir.replace(/\/+$/, ""));

let id = 0;
async function call(name, args) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(process.env.BYOX_TOKEN && { Authorization: `Bearer ${process.env.BYOX_TOKEN}` }),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
  });
  const raw = await res.text();
  // Streamable HTTP puede responder JSON o SSE.
  const json = raw.startsWith("{") ? raw : raw.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
  const msg = JSON.parse(json ?? "{}");
  if (msg.error) throw new Error(`${name}: ${msg.error.message}`);
  const text = msg.result.content.map((c) => c.text).join("\n");
  console.log(`\n── ${name}\n${text}`);
  if (msg.result.isError) process.exit(1);
}

const IGNORE = new Set([".git", "__pycache__", "node_modules", "target", ".DS_Store"]);
const walk = (d) =>
  readdirSync(d)
    .filter((f) => !IGNORE.has(f))
    .flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dir).map((p) => ({ path: relative(dir, p).replaceAll("\\", "/"), content: readFileSync(p, "utf8") }));

await call("write_course_files", { slug, files, message: `Subir ${slug} desde push-course` });
await call("validate_course", { slug });
if (flags.includes("--verify")) await call("verify_course", { slug });
if (flags.includes("--start")) await call("start_course", { slug, reset: flags.includes("--reset") });
