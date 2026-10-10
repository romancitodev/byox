import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { loadSource, under, VERIFY_CONTEXT, type Source } from "./course.js";
import { pickDocker } from "./docker.js";
import type { Forgejo } from "./forgejo.js";
import { renderRunSh } from "./instance.js";
import { notify } from "./notify.js";
import type { Db, Table } from "./store.js";

const run = promisify(execFile);
const TIMEOUT_MS = 20 * 60_000;
const TAIL = 40;

interface Outcome {
  passed: Set<number>;
  /** Salida de cada issue, separada por las líneas de resultado de run.sh. */
  logs: Map<number, string>;
  raw: string;
}

/**
 * Corre los tests en la imagen del curso dos veces: con el esqueleto (todo tiene
 * que fallar) y con el esqueleto + solution/ (todo tiene que pasar). Deja el
 * resultado como commit status en el repo fuente.
 */
export interface StageCheck {
  id: number;
  title: string;
  /** Con el esqueleto tiene que fallar. */
  skeleton: "pasa" | "falla";
  /** Con la solución tiene que pasar. */
  solution: "pasa" | "falla";
  ok: boolean;
  /** Si algo salió mal, el final de la salida que lo explica. */
  log?: string;
}

export async function verifyCourse(
  fj: Forgejo,
  org: string,
  src: Source,
): Promise<{ ok: boolean; report: string; stages: StageCheck[] }> {
  const course = src.course!;
  const skeleton = under(src, "files");
  const solution = new Map([...skeleton, ...under(src, "solution")]);

  // Un solo daemon para toda la verificación: el pull y las dos corridas tienen que caer en la misma máquina.
  const env = await pickDocker();
  await run("docker", ["pull", "-q", course.image], { timeout: TIMEOUT_MS, env }).catch(() => {});
  const [skel, sol] = await Promise.all([execute(src, skeleton, env), execute(src, solution, env)]);

  const out: string[] = [];
  const bad: string[] = [];
  const stages: StageCheck[] = [];
  for (const i of course.issues) {
    const s = skel.passed.has(i.id) ? "pasa" : "falla";
    const r = sol.passed.has(i.id) ? "pasa" : "falla";
    const ok = s === "falla" && r === "pasa";
    out.push(`${ok ? "✅" : "❌"} #${i.id} ${i.title} · esqueleto: ${s} · solución: ${r}`);
    if (s === "pasa") bad.push(`#${i.id} pasa con el esqueleto: el test no prueba nada o el esqueleto ya lo resuelve.`);
    if (r === "falla") {
      bad.push(`#${i.id} falla con la solución:\n\`\`\`\n${tail(sol.logs.get(i.id) ?? sol.raw)}\n\`\`\``);
    }
    const log = r === "falla" ? tail(sol.logs.get(i.id) ?? sol.raw) : s === "pasa" ? tail(skel.logs.get(i.id) ?? "") : "";
    stages.push({ id: i.id, title: i.title, skeleton: s, solution: r, ok, ...(log ? { log } : {}) });
  }
  const ok = bad.length === 0;
  const report = [
    `# Verificación de ${src.slug} @ ${src.sha.slice(0, 7)} en \`${course.image}\``,
    "",
    ...out,
    ...(ok ? ["", "Todo en orden: el curso se puede publicar con start_course."] : ["", "## Problemas", "", ...bad]),
  ].join("\n");

  await fj.req("POST", `/repos/${org}/${src.slug}/statuses/${src.sha}`, {
    context: VERIFY_CONTEXT,
    state: ok ? "success" : "failure",
    description: ok ? "Esqueleto falla y solución pasa en todos los issues" : `${bad.length} problema(s)`,
  });
  return { ok, report, stages };
}

/** Lo último que se sabe de la verificación de un curso. */
export interface Verification {
  slug: string;
  sha: string;
  /** "pending" mientras corre; "invalid" si course.yaml o los archivos no pasan la validación. */
  state: "pending" | "success" | "failure" | "invalid";
  startedAt: string;
  finishedAt?: string;
  image?: string;
  errors: string[];
  warnings: string[];
  stages: StageCheck[];
  report?: string;
}

const DEBOUNCE_MS = 15_000;

/**
 * Verifica los cursos, de a una verificación por curso. La usan verify_course, la web y el
 * webhook de push al repo fuente: así un curso escrito a mano se verifica solo con cada push.
 */
export class Verifier {
  private running = new Map<string, Promise<Verification>>();
  private timers = new Map<string, NodeJS.Timeout>();
  private cache = new Map<string, Verification | null>();
  /** Commits que hizo el MCP: los verifica quien los escribió (verify_course), no el webhook. */
  private own = new Set<string>();

  private table: Table<Verification>;

  constructor(private fj: Forgejo, private org: string, db: Db) {
    this.table = db.table("verify", { dir: "verify", sep: "_" });
  }

  async get(slug: string): Promise<Verification | null> {
    if (!this.cache.has(slug)) {
      this.cache.set(slug, (await this.table.get(slug)) ?? null);
    }
    return this.cache.get(slug) ?? null;
  }

  private async save(v: Verification) {
    this.cache.set(v.slug, v);
    await this.table.set(v.slug, v);
  }

  /** Un commit que escribió el MCP: el webhook no lo verifica solo. */
  ownCommit(sha: string | null) {
    if (sha) this.own.add(sha);
  }

  /** Lo llama el webhook de push: espera un poco por si llegan más pushes y verifica el último. */
  onPush(slug: string, sha: string) {
    if (this.own.delete(sha)) return;
    clearTimeout(this.timers.get(slug));
    this.timers.set(
      slug,
      setTimeout(() => {
        this.timers.delete(slug);
        this.run(slug).catch((e) => console.error(`verificar ${slug}:`, e.message));
      }, DEBOUNCE_MS),
    );
  }

  /** Arranca una verificación sin esperarla. */
  start(slug: string) {
    clearTimeout(this.timers.get(slug));
    this.timers.delete(slug);
    this.run(slug).catch((e) => console.error(`verificar ${slug}:`, e.message));
  }

  /** Si hay una verificación corriendo o a punto de arrancar. */
  busy(slug: string) {
    return this.running.has(slug) || this.timers.has(slug);
  }

  /**
   * Verifica el último commit del curso. Si ya hay una corriendo, espera a que termine:
   * si era de ese mismo commit la reusa, si no, verifica el commit nuevo.
   */
  async run(slug: string): Promise<Verification> {
    const current = this.running.get(slug);
    if (current) {
      const done = await current.catch(() => null);
      const head = await this.fj.find<any>(`/repos/${this.org}/${slug}/branches/main`);
      if (done && done.sha === head?.commit?.id) return done;
      return this.run(slug);
    }
    const p = this.execute(slug).finally(() => this.running.delete(slug));
    this.running.set(slug, p);
    return p;
  }

  private async execute(slug: string): Promise<Verification> {
    const src = await loadSource(this.fj, this.org, slug);
    const v: Verification = {
      slug,
      sha: src.sha,
      state: "pending",
      startedAt: new Date().toISOString(),
      image: src.course?.image,
      errors: src.errors,
      warnings: src.warnings,
      stages: [],
    };
    if (!src.sha) return { ...v, state: "invalid" };
    const status = (state: string, description: string) =>
      this.fj
        .req("POST", `/repos/${this.org}/${slug}/statuses/${src.sha}`, { context: VERIFY_CONTEXT, state, description })
        .catch(() => {});
    if (src.errors.length) {
      const out: Verification = { ...v, state: "invalid", finishedAt: new Date().toISOString() };
      await status("failure", `${src.errors.length} error(es) de formato`);
      await this.save(out);
      notify.send("verify", "warn", "Curso con errores de formato", { Curso: slug }, { text: src.errors.join("\n"), key: `verify|${slug}` });
      return out;
    }
    await status("pending", "Corriendo esqueleto y solución");
    await this.save(v);
    try {
      const { ok, report, stages } = await verifyCourse(this.fj, this.org, src);
      const out: Verification = { ...v, state: ok ? "success" : "failure", stages, report, finishedAt: new Date().toISOString() };
      await this.save(out);
      if (ok) notify.send("verify", "info", "Curso verificado", { Curso: slug });
      else notify.send("verify", "warn", "Un curso no pasó la verificación", { Curso: slug }, { text: report, key: `verify|${slug}` });
      return out;
    } catch (e) {
      await status("error", "La verificación se cortó");
      const out: Verification = {
        ...v,
        state: "failure",
        errors: [`La verificación se cortó: ${(e as Error).message}`],
        finishedAt: new Date().toISOString(),
      };
      await this.save(out);
      notify.send("verify", "error", "Se cortó una verificación", { Curso: slug }, { text: (e as Error).message, key: `verify|${slug}` });
      return out;
    }
  }
}

async function execute(src: Source, files: Map<string, Buffer>, env: NodeJS.ProcessEnv): Promise<Outcome> {
  const dir = await mkdtemp(join(tmpdir(), "byox-"));
  const name = `byox-verify-${dir.slice(-6).toLowerCase()}`;
  try {
    for (const [p, c] of files) await put(join(dir, p), c);
    await put(join(dir, ".course/run.sh"), renderRunSh(src.course!));
    await run("docker", // 2>&1 adentro del contenedor: si no, docker separa stderr y se pierde a qué issue pertenece cada línea.
      ["create", "--name", name, "-w", "/work", "--entrypoint", "sh", src.course!.image, "-c", "sh .course/run.sh 2>&1"], { env });
    await run("docker", ["cp", `${dir}/.`, `${name}:/work`], { env });
    const raw = await run("docker", ["start", "-a", name], { timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, env })
      .then((r) => r.stdout + r.stderr)
      .catch((e) => `${e.stdout ?? ""}${e.stderr ?? ""}${e.killed ? "\n(timeout)" : ""}`);
    return parse(raw);
  } finally {
    await run("docker", ["rm", "-f", name], { env }).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
}

async function put(path: string, content: Buffer | string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function parse(raw: string): Outcome {
  const passed = new Set<number>();
  const logs = new Map<number, string>();
  let chunk: string[] = [];
  for (const line of raw.split("\n")) {
    const m = /^(✅|❌) #(\d+) /.exec(line);
    if (!m) {
      chunk.push(line);
      continue;
    }
    const id = Number(m[2]);
    if (m[1] === "✅") passed.add(id);
    logs.set(id, chunk.join("\n"));
    chunk = [];
  }
  return { passed, logs, raw };
}

const tail = (s: string) => s.trim().split("\n").slice(-TAIL).join("\n");
