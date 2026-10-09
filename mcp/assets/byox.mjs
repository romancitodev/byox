// Generado por byox. Lo usan los workflows de .forgejo/ para avanzar el curso.
//   node .course/byox.mjs plan             -> ids de los issues abiertos
//   node .course/byox.mjs advance 1 3 ...  -> cierra los que pasaron y destraba el grafo
//   node .course/byox.mjs hint <n>         -> publica la siguiente pista del issue n
import { readFileSync, appendFileSync } from "node:fs";

const course = JSON.parse(readFileSync(new URL("./course.json", import.meta.url), "utf8"));
const { BYOX_URL, BYOX_TOKEN, GITHUB_REPOSITORY: REPO, GITHUB_SHA: SHA = "", GITHUB_OUTPUT } = process.env;
const LOCKED = "bloqueado";
const READY = "disponible";
const HINT_MARK = (k) => `<!-- byox:pista:${k} -->`;

async function api(method, path, body) {
  const res = await fetch(`${BYOX_URL}/api/v1/repos/${REPO}${path}`, {
    method,
    headers: { Authorization: `token ${BYOX_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function all(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await api("GET", `${path}${sep}limit=50&page=${page}`);
    out.push(...batch);
    if (batch.length < 50) return out;
  }
}

async function state() {
  const issues = await all("/issues?state=all&type=issues");
  const byNum = new Map(issues.map((i) => [i.number, i]));
  const closed = new Set(course.issues.filter((i) => byNum.get(i.id)?.state === "closed").map((i) => i.id));
  return { byNum, closed };
}

const output = (k, v) => {
  console.log(`${k}=${v}`);
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `${k}=${v}\n`);
};

async function plan() {
  const { closed } = await state();
  output("ids", course.issues.filter((i) => !closed.has(i.id)).map((i) => i.id).join(" "));
}

async function advance(passed) {
  const { byNum, closed } = await state();
  const ready = (i) => i.deps.every((d) => closed.has(d));
  const done = [];

  // Cerrar en cascada: si pasan el 2 y el 3, y el 3 depende del 2, se cierran los dos.
  for (let changed = true; changed; ) {
    changed = false;
    for (const i of course.issues) {
      if (closed.has(i.id) || !passed.has(i.id) || !ready(i)) continue;
      await api("POST", `/issues/${i.id}/comments`, {
        body: `✅ Los tests pasaron en ${SHA.slice(0, 7)}.\n\n\`${i.test.split("\n")[0]}\``,
      });
      await api("PATCH", `/issues/${i.id}`, { state: "closed" });
      closed.add(i.id);
      done.push(i);
      changed = true;
    }
  }

  const labels = new Map((await all("/labels")).map((l) => [l.name, l.id]));
  const unlocked = [];
  for (const i of course.issues) {
    const names = new Set((byNum.get(i.id)?.labels ?? []).map((l) => l.name));
    if (closed.has(i.id)) {
      // Un issue cerrado no está ni bloqueado ni disponible.
      for (const l of [LOCKED, READY]) if (names.has(l)) await api("DELETE", `/issues/${i.id}/labels/${labels.get(l)}`);
      continue;
    }
    const want = ready(i) ? READY : LOCKED;
    const drop = want === READY ? LOCKED : READY;
    if (names.has(want) && !names.has(drop)) continue;
    if (names.has(drop)) await api("DELETE", `/issues/${i.id}/labels/${labels.get(drop)}`);
    if (!names.has(want)) await api("POST", `/issues/${i.id}/labels`, { labels: [labels.get(want)] });
    if (want === READY) {
      await api("POST", `/issues/${i.id}/comments`, { body: "🔓 Se cerraron sus dependencias: ya podés arrancar." });
      unlocked.push(i);
    }
  }

  console.log("");
  for (const i of done) console.log(`✅ #${i.id} ${i.title}`);
  for (const i of unlocked) console.log(`🔓 #${i.id} ${i.title}`);
  for (const i of course.issues) {
    if (!closed.has(i.id) && ready(i) && !unlocked.includes(i)) console.log(`⏳ #${i.id} ${i.title}`);
  }
  if (closed.size === course.issues.length) console.log(`\n🎉 Terminaste ${course.title}.`);

  // Avisarle al MCP para que actualice el perfil (racha, progreso). Si no está, no pasa nada.
  if (done.length) {
    await fetch("http://mcp:3333/hooks/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Byox-Hook": process.env.BYOX_HOOK ?? "" },
      body: JSON.stringify({ repo: REPO }),
    }).catch(() => {});
  }
  await sendReport(passed);
}

/** Manda al MCP qué pasó en cada etapa y el final de su salida, para que la web muestre el error. */
async function sendReport(passed) {
  const raw = Buffer.from(process.env.BYOX_REPORT ?? "", "base64").toString("utf8");
  const results = [];
  const re = /^===BYOX (\S+) (ok|fail)===$/gm;
  const marks = [...raw.matchAll(re)];
  marks.forEach((m, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].index : raw.length;
    results.push({ id: m[1], ok: m[2] === "ok", log: raw.slice(m.index + m[0].length + 1, end).trimEnd() });
  });
  // Sin reporte (imagen sin base64, job roto) igual avisamos el resultado, sin log.
  if (!results.length) {
    for (const id of passed) results.push({ id: String(id), ok: true, log: "" });
  }
  const body = {
    repo: REPO,
    sha: SHA,
    run: process.env.BYOX_RUN ?? "",
    job: process.env.BYOX_TEST_RESULT ?? "",
    at: new Date().toISOString(),
    results,
  };
  await fetch("http://mcp:3333/hooks/results", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Byox-Hook": process.env.BYOX_HOOK ?? "" },
    body: JSON.stringify(body),
  }).catch((e) => console.log(`No pude mandar el reporte al MCP: ${e.message}`));
}

async function hint(n) {
  const all_ = JSON.parse(Buffer.from(process.env.BYOX_HINTS ?? "", "base64").toString("utf8") || "{}");
  const hints = all_[n] ?? [];
  const comments = await all(`/issues/${n}/comments`);
  let given = 0;
  while (comments.some((c) => c.body.includes(HINT_MARK(given + 1)))) given++;
  let body;
  if (hints.length === 0) body = "Este issue no tiene pistas.";
  else if (given >= hints.length) body = `Ya te di las ${hints.length} pistas de este issue. Releelas de abajo para arriba 🙂`;
  else body = `${HINT_MARK(given + 1)}\n### 💡 Pista ${given + 1} de ${hints.length}\n\n${hints[given]}`;
  await api("POST", `/issues/${n}/comments`, { body });
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "plan") await plan();
else if (cmd === "advance") await advance(new Set(args.map(Number)));
else if (cmd === "hint") await hint(Number(args[0]));
else {
  console.error("uso: byox.mjs plan | advance <ids...> | hint <n>");
  process.exit(2);
}
