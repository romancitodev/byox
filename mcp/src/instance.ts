import { readFileSync } from "node:fs";
import { hintsOf, under, type Course, type CourseIssue, type Source } from "./course.js";
import { blobSha, type Forgejo } from "./forgejo.js";

export interface Config {
  user: string;
  bot: string;
  botToken: string;
  publicUrl: string;
  /** Secreto con el que el CI de cada repo avisa a /hooks (uno por repo). */
  hook: (repo: string) => string;
}

const asset = (name: string) => readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");
const PALETTE = ["1f6feb", "8250df", "bf3989", "d1242f", "bc4c00", "9a6700", "1a7f37", "0969da", "6e7781"];
const color = (s: string) => PALETTE[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Crea el repo del alumno a partir del repo fuente ya validado. */
export async function startCourse(admin: Forgejo, cfg: Config, src: Source, reset: boolean): Promise<string> {
  const course = src.course!;
  const owner = cfg.user;
  // Todo lo que se crea queda a nombre del alumno.
  const fj = admin.as(owner);
  const repo = src.slug;
  const log: string[] = [];

  if (await fj.find(`/repos/${owner}/${repo}`)) {
    if (!reset) throw new Error(`Ya existe ${owner}/${repo}. Pasá reset: true para borrar el progreso y empezar de cero.`);
    await fj.req("DELETE", `/repos/${owner}/${repo}`);
    log.push("Borré el repo anterior.");
  }

  await fj.req("POST", "/user/repos", {
    name: repo,
    description: course.description,
    private: true,
    auto_init: true,
    default_branch: "main",
  });
  await fj.req("PATCH", `/repos/${owner}/${repo}`, { has_actions: true, has_wiki: false, has_pull_requests: false });
  try {
    const topics = course.topics.map((t) => t.toLowerCase()).filter((t) => /^[a-z0-9][a-z0-9-]{0,34}$/.test(t));
    await fj.req("PUT", `/repos/${owner}/${repo}/topics`, { topics });
  } catch {
    log.push("No pude poner los topics (no es grave).");
  }

  // Labels: los del curso más los dos de estado.
  const labelNames = new Set(course.issues.flatMap((i) => i.labels));
  const labels = new Map<string, number>();
  const mk = async (name: string, c: string, description = "") =>
    labels.set(name, (await fj.req("POST", `/repos/${owner}/${repo}/labels`, { name, color: c, description })).id);
  await mk("disponible", "2da44e", "Sus dependencias están cerradas: se puede hacer.");
  await mk("bloqueado", "8c959f", "Falta cerrar alguna dependencia.");
  for (const name of labelNames) await mk(name, color(name));

  const milestones = new Map<string, number>();
  for (const [k, m] of course.milestones.entries()) {
    const ms = await fj.req("POST", `/repos/${owner}/${repo}/milestones`, {
      title: `${k + 1} · ${m.title}`,
      description: m.description,
    });
    milestones.set(m.id, ms.id);
  }

  // Los issues se crean en orden para que el número de Forgejo coincida con el id.
  for (const i of course.issues) {
    const created = await fj.req("POST", `/repos/${owner}/${repo}/issues`, {
      title: i.title,
      body: renderBody(i, src),
      milestone: milestones.get(i.milestone),
      labels: [...i.labels, i.deps.length ? "bloqueado" : "disponible"].map((l) => labels.get(l)),
    });
    if (created.number !== i.id) throw new Error(`El issue ${i.id} quedó como #${created.number}; el repo no estaba limpio.`);
  }
  for (const i of course.issues) {
    for (const d of i.deps) {
      await fj.req("POST", `/repos/${owner}/${repo}/issues/${i.id}/dependencies`, { owner, repo, index: d });
    }
  }

  await fj.req("PUT", `/repos/${owner}/${repo}/collaborators/${cfg.bot}`, { permission: "write" });
  const hints = Buffer.from(JSON.stringify(hintsOf(course))).toString("base64");
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_HINTS`, { data: hints });
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_TOKEN`, { data: cfg.botToken });
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_HOOK`, { data: cfg.hook(`${owner}/${repo}`) });
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_HOOK`, { data: cfg.hook(`${owner}/${repo}`) });

  // El commit va al final: dispara el primer run, y para entonces ya existe todo.
  const files: Record<string, Buffer | string> = {
    ...Object.fromEntries(under(src, "files")),
    "README.md": renderReadme(src, `${cfg.publicUrl}/${owner}/${repo}`),
    ...generatedFiles(src),
  };
  await fj.commit(owner, repo, files, `🎉 ${course.title}`);

  const url = `${cfg.publicUrl}/${owner}/${repo}`;
  const ready = course.issues.filter((i) => i.deps.length === 0).map((i) => `#${i.id}`);
  return [
    ...log,
    `Listo: ${url}`,
    `${course.issues.length} issues en ${course.milestones.length} milestones. Arrancan disponibles: ${ready.join(", ")}.`,
    `git clone ${url}.git`,
  ].join("\n");
}

/**
 * Trae a un repo ya empezado lo nuevo del curso fuente, sin perder el progreso:
 * - los milestones, labels e issues que faltan (con sus dependencias), y los textos de los que ya están;
 * - las pistas (el secreto BYOX_HINTS) y los archivos que genera byox;
 * - los archivos de files/ que no existen en el repo, y los que existen pero el alumno no tocó
 *   desde el commit con el que empezó el curso. Lo que el alumno modificó no se pisa nunca.
 */
export async function upgradeCourse(admin: Forgejo, cfg: Config, src: Source): Promise<string> {
  const course = src.course!;
  const owner = cfg.user;
  const fj = admin.as(owner);
  const repo = src.slug;
  const url = `${cfg.publicUrl}/${owner}/${repo}`;
  const log: string[] = [];

  const existing = await fj.all<any>(`/repos/${owner}/${repo}/issues?state=all&type=issues`);
  const byNumber = new Map<number, any>(existing.map((i) => [i.number, i]));
  const max = Math.max(0, ...existing.map((i) => i.number));
  const fresh = course.issues.filter((i) => i.id > max);

  const milestones = new Map<string, number>();
  const current = await fj.all<any>(`/repos/${owner}/${repo}/milestones?state=all`);
  for (const [k, m] of course.milestones.entries()) {
    const title = `${k + 1} · ${m.title}`;
    const found = current.find((x) => x.title === title);
    if (found) {
      milestones.set(m.id, found.id);
      continue;
    }
    const ms = await fj.req("POST", `/repos/${owner}/${repo}/milestones`, { title, description: m.description });
    milestones.set(m.id, ms.id);
    log.push(`Tramo nuevo: ${title}.`);
  }

  const labels = new Map<string, number>((await fj.all<any>(`/repos/${owner}/${repo}/labels`)).map((l) => [l.name, l.id]));
  for (const name of new Set([...fresh.flatMap((i) => i.labels), "disponible", "bloqueado"])) {
    if (!labels.has(name)) labels.set(name, (await fj.req("POST", `/repos/${owner}/${repo}/labels`, { name, color: color(name) })).id);
  }

  // Los issues que ya están: se actualizan título y texto si el curso los cambió.
  let edited = 0;
  for (const i of course.issues.filter((i) => byNumber.has(i.id))) {
    const gh = byNumber.get(i.id);
    const body = renderBody(i, src);
    if (gh.title !== i.title || gh.body.trim() !== body.trim()) {
      await fj.req("PATCH", `/repos/${owner}/${repo}/issues/${i.id}`, { title: i.title, body });
      edited++;
    }
  }
  if (edited) log.push(`Actualicé el texto de ${edited} etapa(s).`);

  // Los nuevos, en orden para que el número de Forgejo coincida con el id.
  const closed = new Set(existing.filter((i) => i.state === "closed").map((i) => i.number));
  for (const i of fresh) {
    const ready = i.deps.every((d) => closed.has(d));
    const created = await fj.req("POST", `/repos/${owner}/${repo}/issues`, {
      title: i.title,
      body: renderBody(i, src),
      milestone: milestones.get(i.milestone),
      labels: [...i.labels, ready ? "disponible" : "bloqueado"].map((l) => labels.get(l)),
    });
    if (created.number !== i.id) throw new Error(`El issue ${i.id} quedó como #${created.number}: el repo tiene issues que no son del curso.`);
  }
  for (const i of fresh) {
    for (const d of i.deps) await fj.req("POST", `/repos/${owner}/${repo}/issues/${i.id}/dependencies`, { owner, repo, index: d });
  }
  if (fresh.length) log.push(`${fresh.length} etapa(s) nueva(s): #${fresh[0].id} a #${fresh.at(-1)!.id}.`);

  const hints = Buffer.from(JSON.stringify(hintsOf(course))).toString("base64");
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_HINTS`, { data: hints });
  // Los secretos que dependen de la instancia se vuelven a escribir: así rotar BYOX_SECRET o el token del bot se arregla con un upgrade.
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_TOKEN`, { data: cfg.botToken });
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_HOOK`, { data: cfg.hook(`${owner}/${repo}`) });
  await fj.req("PUT", `/repos/${owner}/${repo}/actions/secrets/BYOX_HOOK`, { data: cfg.hook(`${owner}/${repo}`) });

  // Archivos: el árbol del commit con el que empezó el curso dice qué no tocó el alumno.
  const commits = await fj.all<any>(`/repos/${owner}/${repo}/commits?sha=main&stat=false&verification=false&files=false`);
  const start = [...commits].reverse().find((c) => c.commit.message.startsWith("🎉"));
  const startTree = start ? await fj.tree(owner, repo, start.sha) : new Map<string, string>();
  const tree = await fj.tree(owner, repo);
  const untouched = (path: string) => tree.has(path) && startTree.get(path) === tree.get(path);
  const files: Record<string, Buffer | string> = { ...generatedFiles(src) };
  if (!tree.has("README.md") || untouched("README.md")) files["README.md"] = renderReadme(src, url);
  const kept: string[] = [];
  let added = 0;
  for (const [path, content] of under(src, "files")) {
    if (!tree.has(path)) {
      files[path] = content;
      added++;
    } else if (untouched(path)) files[path] = content;
    else if (blobSha(content) !== tree.get(path)) kept.push(path);
  }
  const sha = await fj.commit(owner, repo, files, `🔧 Actualizar ${course.title}`);
  if (added) log.push(`${added} archivo(s) nuevo(s).`);
  if (kept.length) log.push(`No toqué ${kept.length} archivo(s) que modificaste: ${kept.slice(0, 8).join(", ")}${kept.length > 8 ? "…" : ""}.`);
  log.push(sha ? "El push dispara una corrida de tests." : "Los archivos ya estaban al día.");
  return [`Listo: ${url}`, ...log].join("\n");
}

/**
 * Los archivos que genera byox en el repo del alumno (no los toca el alumno).
 * `upgrade_course` los vuelve a escribir para traer mejoras sin perder progreso.
 */
export function generatedFiles(src: Source): Record<string, string> {
  const course = src.course!;
  // Las pistas no viajan al repo del alumno: van como secreto.
  const issues = course.issues.map(({ hints: _, ...rest }) => rest);
  const cache = cacheVolume(src.slug);
  return {
    ".course/course.json": JSON.stringify({ ...course, issues }, null, 2),
    ".course/run.sh": renderRunSh(course),
    ".course/test.cmd": renderTestCmd(course, cache),
    // Git en Windows convierte a CRLF y `sh` no entiende run.sh así; cmd, en cambio, quiere CRLF.
    ".gitattributes": [
      src.files.get("files/.gitattributes")?.toString("utf8").trimEnd(),
      ".course/** text eol=lf",
      "*.sh text eol=lf",
      "*.cmd text eol=crlf",
      "",
    ]
      .filter((l) => l !== undefined)
      .join("\n"),
    ".course/byox.mjs": asset("byox.mjs"),
    ".forgejo/workflows/byox.yml": asset("byox.yml").replaceAll("{{IMAGE}}", course.image).replaceAll("{{CACHE}}", cache),
    ".forgejo/workflows/pista.yml": asset("pista.yml"),
  };
}

/** Volumen de Docker con las cachés del curso (cargo, pip, go…), compartido por el CI y `test.cmd`. */
export const cacheVolume = (slug: string) => `byox-cache-${slug}`;

/** Variables que mandan las cachés de las herramientas comunes a /cache. */
export const CACHE_ENV: Record<string, string> = {
  CARGO_HOME: "/cache/cargo",
  CARGO_TARGET_DIR: "/cache/target",
  PIP_CACHE_DIR: "/cache/pip",
  GOCACHE: "/cache/go-build",
  GOMODCACHE: "/cache/go-mod",
  npm_config_cache: "/cache/npm",
};

/** `.course\test 7` en Windows: los mismos tests, en la misma imagen que el CI. */
function renderTestCmd(course: Course, cache: string): string {
  const env = Object.entries(CACHE_ENV)
    .map(([k, v]) => `-e ${k}=${v}`)
    .join(" ");
  return [
    "@echo off",
    "rem Generado por byox. Corre los tests en Docker, en la misma imagen que el CI.",
    "rem Uso: .course\\test 7   (sin numero: todos)",
    "setlocal",
    'pushd "%~dp0.."',
    "docker info >nul 2>&1 || (echo Docker no esta corriendo: abri Docker Desktop y proba de nuevo. & popd & exit /b 1)",
    `docker run --rm -t -v "%cd%:/work" -w /work -v ${cache}:/cache ${env} ${course.image} sh .course/run.sh %*`,
    "set code=%errorlevel%",
    "popd",
    "exit /b %code%",
    "",
  ].join("\r\n");
}

function renderBody(i: CourseIssue, src: Source): string {
  const body = src.files.get(i.body)!.toString("utf8").trimEnd();
  const lines = [
    body,
    "",
    "---",
    "",
    `**Verificar** · \`.course\\test ${i.id}\` (Windows, en Docker) o \`sh .course/run.sh ${i.id}\`, o pusheá a \`main\``,
  ];
  if (i.deps.length) lines.push(`**Depende de** · ${i.deps.map((d) => `#${d}`).join(", ")}`);
  if (i.hints.length) lines.push(`**Pistas** · comentá \`/pista\` (hay ${i.hints.length})`);
  return lines.join("  \n").replace(/\n {2}\n/g, "\n\n");
}

/** La intro la escribe el autor (README.md del repo fuente); el mapa y el uso los arma byox. */
function renderReadme(src: Source, url: string): string {
  const course = src.course!;
  const intro = src.files.get("README.md")?.toString("utf8").trimEnd() ?? `# ${course.title}\n\n${course.description}`;
  const label = (i: CourseIssue) => `"#${i.id} ${i.title.replace(/"/g, "#quot;")}"`;
  const out = [intro, "", "## Mapa del curso", "", "```mermaid", "flowchart TD"];
  for (const [k, m] of course.milestones.entries()) {
    out.push(`  subgraph m${k}["${k + 1} · ${m.title.replace(/"/g, "#quot;")}"]`);
    for (const i of course.issues.filter((i) => i.milestone === m.id)) out.push(`    i${i.id}[${label(i)}]`);
    out.push("  end");
  }
  for (const i of course.issues) for (const d of i.deps) out.push(`  i${d} --> i${i.id}`);
  out.push("```", "");
  for (const [k, m] of course.milestones.entries()) {
    out.push(`### ${k + 1} · ${m.title}`, "", m.description, "");
    for (const i of course.issues.filter((i) => i.milestone === m.id)) {
      out.push(`- [#${i.id} ${i.title}](${url}/issues/${i.id})`);
    }
    out.push("");
  }
  out.push(
    "## Cómo se usa",
    "",
    "- Elegí un issue con el label `disponible` y resolvelo.",
    "- Probalo local con `.course\\test <número>` en Windows (corre en Docker, igual que el CI) o `sh .course/run.sh <número>` en Linux/macOS. Sin número corre todos.",
    "- Pusheá a `main`: si el test pasa, el issue se cierra y se desbloquean los que dependían de él.",
    "- Si te trabás, comentá `/pista` en el issue.",
    "",
    "`.course/` y `.forgejo/` los genera byox: no los toques.",
    "",
  );
  return out.join("\n");
}

export function renderRunSh(course: Course): string {
  const cases = course.issues
    .map((i) => `    ${i.id}) ( set -e\n${i.test.trim()}\n    ) ;;`)
    .join("\n");
  const setup = course.setup.trim();
  return `#!/bin/sh
# Generado por byox. Uso: sh .course/run.sh [número...]   (sin números: todos)
cd "$(dirname "$0")/.." || exit 1
ids="$*"
[ -z "$ids" ] && ids=${shq(course.issues.map((i) => i.id).join(" "))}
out="\${TMPDIR:-/tmp}/byox-run-$$"
mkdir -p "$out"

# En CI: un reporte por etapa (pasó o falló y el final de su salida), en base64,
# para que la web muestre qué falló y dónde. Si no hay base64, no hay reporte.
report() {
  [ -n "$GITHUB_OUTPUT" ] || return 0
  echo "passed=$passed" >> "$GITHUB_OUTPUT"
  command -v base64 >/dev/null 2>&1 || return 0
  for f in "$out"/*.log; do
    [ -f "$f" ] || continue
    id="$(basename "$f" .log)"
    st=ok
    case " $failed " in *" $id "*) st=fail ;; esac
    echo "===BYOX $id $st==="
    tail -c 6000 "$f"
    echo ""
  done | base64 | tr -d '\\n' > "$out/report"
  printf 'report=' >> "$GITHUB_OUTPUT"
  cat "$out/report" >> "$GITHUB_OUTPUT"
  echo "" >> "$GITHUB_OUTPUT"
}

passed=""
failed=""
${
  setup
    ? `echo "──── setup ────"
( set -e
${setup}
) > "$out/setup.log" 2>&1
st=$?
cat "$out/setup.log"
if [ $st -ne 0 ]; then
  echo "❌ falló el setup"
  failed="setup"
  report
  [ -n "$GITHUB_OUTPUT" ] && exit 0
  exit 1
fi
rm -f "$out/setup.log"
`
    : ""
}run_one() {
  case "$1" in
${cases}
    *) echo "No existe el issue $1"; false ;;
  esac
}
title_of() {
  case "$1" in
${course.issues.map((i) => `    ${i.id}) echo ${shq(i.title)} ;;`).join("\n")}
    *) echo "?" ;;
  esac
}

for id in $ids; do
  echo ""
  run_one "$id" > "$out/$id.log" 2>&1
  st=$?
  cat "$out/$id.log"
  if [ $st -eq 0 ]; then passed="$passed $id"; r="✅"; else failed="$failed $id"; r="❌"; fi
  echo "$r #$id $(title_of "$id")"
done
echo ""
echo "pasan:$passed"
echo "fallan:$failed"
report
rm -rf "$out"
# En CI que falle un test no es un error: los bloqueados fallan siempre.
[ -n "$GITHUB_OUTPUT" ] && exit 0
[ -z "$failed" ]
`;
}

export async function courseStatus(admin: Forgejo, cfg: Config, slug: string): Promise<string> {
  const owner = cfg.user;
  const fj = admin.as(owner);
  if (!(await fj.find(`/repos/${owner}/${slug}`))) return `No existe ${owner}/${slug}. Arrancalo con start_course.`;
  const issues = (await fj.all<any>(`/repos/${owner}/${slug}/issues?state=all&type=issues`)).sort(
    (a, b) => a.number - b.number,
  );
  const done = issues.filter((i) => i.state === "closed").length;
  const out = [`# ${owner}/${slug}: ${done}/${issues.length}`, ""];
  const byMs = new Map<string, any[]>();
  for (const i of issues) {
    const k = i.milestone?.title ?? "(sin milestone)";
    byMs.set(k, [...(byMs.get(k) ?? []), i]);
  }
  for (const [ms, list] of [...byMs].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    out.push(`## ${ms}`);
    for (const i of list) {
      const names = i.labels.map((l: any) => l.name);
      const mark = i.state === "closed" ? "✅" : names.includes("disponible") ? "🟢" : "🔒";
      out.push(`${mark} #${i.number} ${i.title}`);
    }
    out.push("");
  }
  out.push(`${cfg.publicUrl}/${owner}/${slug}`);
  return out.join("\n");
}
