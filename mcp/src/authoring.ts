import { readdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { parse } from "yaml";
import { z } from "zod";
import { loadSource, sourceFromFiles, VERIFY_CONTEXT } from "./course.js";
import type { Forgejo } from "./forgejo.js";
import { notify } from "./notify.js";
import type { Verifier } from "./verify.js";

/**
 * Escribir cursos a mano y compartirlos:
 * - plantillas por lenguaje para arrancar un curso nuevo (byox new),
 * - el estado de un repo fuente (formato y verificación) para el autor (byox check),
 * - exportar un curso a un código y importarlo en otro byox,
 * - el webhook que verifica el repo fuente en cada push.
 */

export interface AuthoringConfig {
  org: string;
  publicUrl: string;
}

export const TEMPLATES: Record<string, { label: string; image: string }> = {
  python: { label: "Python", image: "python:3.13" },
  rust: { label: "Rust", image: "rust:1.99" },
  go: { label: "Go", image: "golang:1.27" },
  node: { label: "JavaScript (Node)", image: "node:22-bookworm" },
};

const SLUG = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const CODE_PREFIX = "byox1-";
const MAX_BUNDLE = 64 * 1024 * 1024;
const MAX_FILES = 5000;
const TEMPLATES_DIR = new URL("../assets/templates/", import.meta.url);

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── Código de un curso ───────────────────────────────────────────────────────

/** Lo que va adentro del código: los archivos del repo fuente, tal cual. */
const Bundle = z.object({
  byox: z.literal(1),
  slug: z.string(),
  title: z.string(),
  sha: z.string(),
  verified: z.boolean(),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  /** Archivos de texto, como texto: comprimen mucho mejor que en base64. */
  files: z.record(z.string()),
  /** Los demás, en base64. */
  binary: z.record(z.string()).default({}),
});
type Bundle = z.infer<typeof Bundle>;

function pack(b: Bundle): string {
  const json = Buffer.from(JSON.stringify(b));
  const packed = brotliCompressSync(json, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: json.length },
  });
  return CODE_PREFIX + packed.toString("base64url");
}

function unpack(code: string): { bundle: Bundle; files: Map<string, Buffer> } {
  const clean = code.replace(/\s+/g, "");
  if (!clean.startsWith(CODE_PREFIX)) throw new HttpError(400, `Eso no es un código de byox: tiene que empezar con ${CODE_PREFIX}`);
  const body = clean.slice(CODE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new HttpError(400, "El código tiene caracteres que no van. ¿Se copió entero?");
  let data: unknown;
  try {
    const raw = brotliDecompressSync(Buffer.from(body, "base64url"), { maxOutputLength: MAX_BUNDLE });
    data = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "El código está incompleto o roto. ¿Se cortó al copiarlo?");
  }
  const parsed = Bundle.safeParse(data);
  if (!parsed.success) throw new HttpError(400, "El código no tiene un curso de byox adentro (o es de una versión más nueva).");
  const bundle = parsed.data;
  const files = new Map<string, Buffer>();
  for (const [p, c] of Object.entries(bundle.files)) files.set(p, Buffer.from(c, "utf8"));
  for (const [p, c] of Object.entries(bundle.binary)) files.set(p, Buffer.from(c, "base64"));
  if (files.size > MAX_FILES) throw new HttpError(400, `El curso tiene ${files.size} archivos; el máximo es ${MAX_FILES}.`);
  for (const p of files.keys()) {
    const bad =
      p.length > 300 ||
      p.startsWith("/") ||
      p.includes("\\") ||
      p.includes("\0") ||
      p.split("/").some((s) => s === "" || s === "." || s === "..") ||
      p === ".git" ||
      p.startsWith(".git/");
    if (bad) throw new HttpError(400, `El código trae un archivo con una ruta inválida: ${p}`);
  }
  return { bundle, files };
}

const isText = (b: Buffer) => !b.includes(0) && Buffer.from(b.toString("utf8"), "utf8").equals(b);

// ── Plantillas ───────────────────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function templateFiles(lang: string, vars: Record<string, string>): Promise<Record<string, Buffer>> {
  const root = fileURLToPath(new URL(`${lang}/`, TEMPLATES_DIR));
  const out: Record<string, Buffer> = {};
  for (const abs of await walk(root)) {
    const path = relative(root, abs).split("\\").join("/");
    let content = await readFile(abs);
    if (isText(content)) {
      let text = content.toString("utf8");
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{{${k}}}`, v);
      content = Buffer.from(text);
    }
    out[path] = content;
  }
  return out;
}

// ── El módulo ────────────────────────────────────────────────────────────────

export function authoring(fj: Forgejo, cfg: AuthoringConfig, verifier: Verifier) {
  const org = cfg.org;
  const sourceUrl = (slug: string) => `${cfg.publicUrl}/${org}/${slug}`;
  const exists = async (slug: string) => !!(await fj.find(`/repos/${org}/${slug}`));

  function checkSlug(slug: string) {
    if (!SLUG.test(slug)) {
      throw new HttpError(400, "El nombre del curso va en minúsculas, con números, '-', '_' o '.', como build-your-own-redis.");
    }
  }

  async function createRepo(slug: string, description: string, by: string | undefined, how: string) {
    await fj.req("POST", `/orgs/${org}/repos`, {
      name: slug,
      description,
      private: true,
      auto_init: true,
      default_branch: "main",
    });
    notify.send("course", "info", "Curso creado", { Curso: slug, Autor: by, Cómo: how });
  }

  /** El commit status de la verificación: lo deja verify_course aunque no haya registro local. */
  async function verifyStatus(slug: string, sha: string): Promise<string | null> {
    if (!sha) return null;
    const statuses = await fj.all<any>(`/repos/${org}/${slug}/commits/${sha}/statuses`);
    return statuses.find((s) => s.context === VERIFY_CONTEXT)?.status ?? null;
  }
  const verifiedAt = async (slug: string, sha: string) => (await verifyStatus(slug, sha)) === "success";

  /** Un curso nuevo a partir de una plantilla que anda, para escribirlo a mano. */
  async function newCourse(input: { slug: string; lang: string; title?: string }, user: string) {
    const slug = input.slug.trim();
    checkSlug(slug);
    const tpl = TEMPLATES[input.lang];
    if (!tpl) throw new HttpError(400, `No hay plantilla para "${input.lang}". Hay: ${Object.keys(TEMPLATES).join(", ")}.`);
    if (await exists(slug)) throw new HttpError(409, `Ya existe el curso ${slug}.`);
    const title = input.title?.trim() || slug;
    const files = await templateFiles(input.lang, { TITLE: title, SLUG: slug, AUTHOR: user });
    const description = parse(files["course.yaml"].toString("utf8"))?.description ?? "";
    await createRepo(slug, description, user, `plantilla ${input.lang}`);
    const sha = await fj.commit(org, slug, files, `🎉 Nuevo curso desde la plantilla de ${tpl.label}`);
    verifier.ownCommit(sha);
    verifier.start(slug);
    return { slug, lang: input.lang, cloneUrl: `${sourceUrl(slug)}.git`, sourceUrl: sourceUrl(slug) };
  }

  /** Cursos creados (repos fuente) con su origen y el estado de la verificación. */
  async function list() {
    const repos = await fj.all<any>(`/orgs/${org}/repos`);
    return Promise.all(
      repos.map(async (r) => {
        const branch = await fj.find<any>(`/repos/${org}/${r.name}/branches/main`);
        const yaml = await fj.raw(org, r.name, "course.yaml").then((b) => parse(b.toString("utf8"))).catch(() => null);
        const v = await verifier.get(r.name);
        const sha = branch?.commit?.id ?? "";
        return {
          slug: r.name,
          title: yaml?.title ?? r.name,
          description: yaml?.description ?? r.description ?? "",
          origin: yaml?.origin ?? null,
          author: yaml?.author ?? null,
          sha,
          updatedAt: branch?.commit?.timestamp ?? r.updated_at,
          verify: await verifySummary(r.name, sha, v),
          sourceUrl: sourceUrl(r.name),
        };
      }),
    );
  }

  async function verifySummary(slug: string, sha: string, v: Awaited<ReturnType<Verifier["get"]>>) {
    const busy = verifier.busy(slug);
    if (!v || v.sha !== sha) {
      // Sin registro de este commit: puede haberlo verificado una versión anterior de byox.
      const st = busy ? "pending" : await verifyStatus(slug, sha);
      const state = st === "success" || st === "failure" || st === "pending" ? st : st === "error" ? "failure" : "none";
      return { state, sha: v?.sha ?? null, stale: !!v, busy, at: v ? (v.finishedAt ?? v.startedAt) : null, problems: 0 };
    }
    return {
      state: busy ? "pending" : v.state,
      sha: v.sha,
      stale: false,
      busy,
      at: v.finishedAt ?? v.startedAt,
      problems: v.errors.length + v.stages.filter((s) => !s.ok).length,
    };
  }

  /** Todo lo que el autor necesita saber del último commit: formato, verificación y qué falla. */
  async function status(slug: string, user: string) {
    if (!(await exists(slug))) throw new HttpError(404, `No existe el curso ${slug}.`);
    const src = await loadSource(fj, org, slug);
    const v = await verifier.get(slug);
    const c = src.course;
    const head = await fj.find<any>(`/repos/${org}/${slug}/branches/main`);
    return {
      slug,
      sha: src.sha,
      message: ((head?.commit?.message as string) ?? "").split("\n")[0],
      title: c?.title ?? slug,
      origin: c?.origin ?? null,
      author: c?.author ?? null,
      image: c?.image ?? null,
      issues: c?.issues.length ?? 0,
      milestones: c?.milestones.length ?? 0,
      errors: src.errors,
      warnings: src.warnings,
      verify: await verifySummary(slug, src.sha, v),
      // La última verificación, aunque sea de un commit anterior: sirve para ver qué fallaba.
      last: v,
      started: !!(await fj.find(`/repos/${user}/${slug}`)),
      cloneUrl: `${sourceUrl(slug)}.git`,
      sourceUrl: sourceUrl(slug),
    };
  }

  async function exportCourse(slug: string, user: string) {
    checkSlug(slug);
    if (!(await exists(slug))) throw new HttpError(404, `No existe el curso ${slug}.`);
    const src = await loadSource(fj, org, slug);
    if (src.errors.length) {
      throw new HttpError(400, `El curso tiene errores de formato y hay que arreglarlos antes de compartirlo:\n${src.errors.join("\n")}`);
    }
    const files: Record<string, string> = {};
    const binary: Record<string, string> = {};
    for (const [p, b] of [...src.files].sort(([a], [b]) => a.localeCompare(b))) {
      if (isText(b)) files[p] = b.toString("utf8");
      else binary[p] = b.toString("base64");
    }
    const verified = await verifiedAt(slug, src.sha);
    const code = pack({
      byox: 1,
      slug,
      title: src.course!.title,
      sha: src.sha,
      verified,
      exportedAt: new Date().toISOString(),
      exportedBy: user,
      files,
      binary,
    });
    return {
      slug,
      title: src.course!.title,
      sha: src.sha,
      verified,
      files: src.files.size,
      bytes: code.length,
      filename: `${slug}.byox`,
      code,
    };
  }

  /** Qué hay adentro de un código, sin importar nada. */
  async function preview(code: string) {
    const { bundle, files } = unpack(code);
    const src = sourceFromFiles(bundle.slug, files);
    const c = src.course;
    let suggested = bundle.slug;
    for (let k = 2; await exists(suggested); k++) suggested = `${bundle.slug}-${k}`;
    return {
      slug: bundle.slug,
      title: c?.title ?? bundle.title,
      description: c?.description ?? "",
      image: c?.image ?? null,
      topics: c?.topics ?? [],
      origin: c?.origin ?? null,
      author: c?.author ?? null,
      issues: c?.issues.length ?? 0,
      milestones: c?.milestones.map((m) => m.title) ?? [],
      files: files.size,
      verified: bundle.verified,
      exportedAt: bundle.exportedAt,
      exportedBy: bundle.exportedBy ?? null,
      exists: suggested !== bundle.slug,
      suggestedSlug: suggested,
      errors: src.errors,
      warnings: src.warnings,
    };
  }

  /** Crea el repo fuente con los archivos del código y lo verifica acá, con tu Docker. */
  async function importCourse(code: string, as?: string, user?: string) {
    const { bundle, files } = unpack(code);
    const slug = (as ?? bundle.slug).trim();
    checkSlug(slug);
    if (await exists(slug)) throw new HttpError(409, `Ya existe un curso ${slug}: hace falta importarlo con otro nombre.`);
    const src = sourceFromFiles(slug, files);
    if (src.errors.length) throw new HttpError(400, `El curso del código no es válido:\n${src.errors.join("\n")}`);
    await createRepo(slug, src.course!.description, user, "importado");
    const from = bundle.exportedBy ? ` de ${bundle.exportedBy}` : "";
    const sha = await fj.commit(org, slug, Object.fromEntries(files), `📦 Importar ${src.course!.title}${from}`);
    verifier.ownCommit(sha);
    verifier.start(slug);
    return { slug, title: src.course!.title, sourceUrl: sourceUrl(slug), verifying: true };
  }

  async function guide() {
    return readFile(new URL("../assets/guide.md", import.meta.url), "utf8");
  }

  // ── HTTP ───────────────────────────────────────────────────────────────────

  async function body(req: IncomingMessage, preRead?: string): Promise<any> {
    if (preRead !== undefined) return preRead ? JSON.parse(preRead) : {};
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BUNDLE) throw new HttpError(413, "Demasiado grande.");
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    // Un código pegado tal cual (text/plain), o JSON con { code }.
    if (raw.trimStart().startsWith(CODE_PREFIX)) return { code: raw };
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, "El cuerpo no es JSON.");
    }
  }

  const json = (res: ServerResponse, data: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  };

  async function handle(req: IncomingMessage, res: ServerResponse, user: string): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    const get = req.method === "GET";
    const post = req.method === "POST";
    let r: RegExpExecArray | null;
    try {
      if (get && p === "/api/author") return json(res, await list()), true;
      if (get && p === "/api/author/templates") {
        return json(res, Object.entries(TEMPLATES).map(([lang, t]) => ({ lang, ...t }))), true;
      }
      if (get && p === "/api/author/guide") {
        res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
        res.end(await guide());
        return true;
      }
      if (post && p === "/api/author/new") return json(res, await newCourse(await body(req), user), 201), true;
      if (get && (r = /^\/api\/author\/([^/]+)$/.exec(p))) return json(res, await status(r[1], user)), true;
      if (post && (r = /^\/api\/author\/([^/]+)\/verify$/.exec(p))) {
        if (!(await exists(r[1]))) throw new HttpError(404, `No existe el curso ${r[1]}.`);
        verifier.start(r[1]);
        return json(res, { slug: r[1], busy: true }, 202), true;
      }
      if (get && (r = /^\/api\/courses\/([^/]+)\/export$/.exec(p))) return json(res, await exportCourse(r[1], user)), true;
      if (get && (r = /^\/api\/courses\/([^/]+)\/export\.byox$/.exec(p))) {
        const e = await exportCourse(r[1], user);
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${e.filename}"`,
          "Cache-Control": "no-store",
        });
        res.end(`${e.code}\n`);
        return true;
      }
      if (post && p === "/api/import/preview") return json(res, await preview((await body(req)).code ?? "")), true;
      if (post && p === "/api/import") {
        const b = await body(req);
        return json(res, await importCourse(b.code ?? "", b.slug || undefined, user), 201), true;
      }
    } catch (e) {
      if (e instanceof HttpError) return json(res, { error: e.message }, e.status), true;
      console.error(e);
      return json(res, { error: (e as Error).message }, 500), true;
    }
    return false;
  }

  /** Webhook de Forgejo: push a un repo de la organización de cursos. Sólo vale con la firma correcta. */
  async function sourceHook(req: IncomingMessage, res: ServerResponse, verify: (raw: string, sig: string | undefined) => boolean) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 2_000_000) throw new HttpError(413, "Demasiado grande.");
    }
    const sig = req.headers["x-forgejo-signature"] ?? req.headers["x-gitea-signature"];
    if (!verify(raw, Array.isArray(sig) ? sig[0] : sig)) return void res.writeHead(401).end();
    const e = await body(req, raw);
    if (e?.repository?.owner?.username === org && e.ref === "refs/heads/main" && e.after) verifier.onPush(e.repository.name, e.after);
    res.writeHead(204).end();
  }

  return { handle, sourceHook, newCourse, list, status, exportCourse, preview, importCourse };
}

export type Authoring = ReturnType<typeof authoring>;

/**
 * Webhook de la organización de cursos: cada push a un repo fuente avisa al MCP, que lo
 * verifica. Forgejo sólo manda webhooks a hosts permitidos (webhook.ALLOWED_HOST_LIST).
 */
export async function ensureWebhook(fj: Forgejo, org: string, url: string, secret: string) {
  const hooks = await fj.all<any>(`/orgs/${org}/hooks`);
  const config = { url, content_type: "json", secret };
  const found = hooks.find((h) => h.config?.url === url);
  // Forgejo no devuelve el secreto: se vuelve a poner siempre, así un webhook viejo sin firma queda firmado.
  if (found) return void (await fj.req("PATCH", `/orgs/${org}/hooks/${found.id}`, { active: true, config }));
  await fj.req("POST", `/orgs/${org}/hooks`, {
    type: "forgejo",
    active: true,
    events: ["push"],
    branch_filter: "main",
    config,
  });
  console.log(`webhook de ${org} -> ${url}`);
}
