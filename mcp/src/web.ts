import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname } from "node:path";
import { parse } from "yaml";
import { HttpError, type Auth } from "./auth.js";
import { isVerified, loadSource } from "./course.js";
import type { Forgejo } from "./forgejo.js";
import { startCourse, upgradeCourse } from "./instance.js";
import { computeStats, type ProfileConfig, type Stats } from "./profile.js";
import type { Clients } from "./clients.js";
import { diagnose, type Results } from "./results.js";

/** La interfaz web: una SPA estática (el build de Astro en web/dist) y una API chica arriba de Forgejo. */
type State = "done" | "ready" | "locked";
const HINT_MARK = /<!-- byox:pista:(\d+) -->/;
const DIST = new URL("../web/dist/", import.meta.url);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const json = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};

export function web(fj: Forgejo, base: ProfileConfig, results: Results, clients: Clients, auth: Auth, onProgress: (user: string) => void) {
  const scopes = new Map<string, ReturnType<typeof scope>>();
  const forUser = (user: string) => {
    let s = scopes.get(user);
    if (!s) scopes.set(user, (s = scope(user)));
    return s;
  };

  /** Todo lo que depende de quién mira: sus repos, su progreso, su perfil. El catálogo de cursos es común. */
  function scope(user: string) {
  const cfg: ProfileConfig = { ...base, user };
  const owner = user;
  const repoUrl = (slug: string) => `${cfg.publicUrl}/${owner}/${slug}`;

  /** Resumen del último resultado de una etapa: si falló, qué y dónde. */
  async function resultOf(slug: string, id: number | string, full = false) {
    const r = (await results.get(`${owner}/${slug}`))[String(id)];
    if (!r) return null;
    const d = r.ok ? null : diagnose(r.log);
    return {
      ok: r.ok,
      at: r.at,
      sha: r.sha,
      runUrl: r.run ? `${repoUrl(slug)}/actions/runs/${r.run}` : null,
      message: d?.message ?? null,
      kind: d?.kind ?? null,
      where: d?.where ?? null,
      fileUrl: d?.where ? `${repoUrl(slug)}/src/commit/${r.sha}/${d.where.path}#L${d.where.line}` : null,
      ...(full ? { log: r.log, highlight: d?.highlight ?? [] } : {}),
    };
  }
  const bodyCache = new Map<string, string>();
  let statsCache: { at: number; stats: Stats } | undefined;

  /** Estructura del curso: la del repo del alumno si arrancó, si no la del repo fuente. */
  async function structure(slug: string) {
    const started = !!(await fj.find(`/repos/${owner}/${slug}`));
    const yaml = await fj.raw(cfg.org, slug, "course.yaml").catch(() => null);
    const source = yaml ? parse(yaml.toString("utf8")) : null;
    const course = started
      ? JSON.parse((await fj.raw(owner, slug, ".course/course.json")).toString("utf8"))
      : source;
    if (!course) return null;
    // Quién lo escribió sale del repo fuente: el repo del alumno puede ser de antes de que existiera el campo.
    if (source && started) Object.assign(course, { origin: source.origin, author: source.author });
    const hints = new Map<number, number>((source?.issues ?? []).map((i: any) => [i.id, i.hints?.length ?? 0]));
    return { started, course, source, hints };
  }

  async function issueStates(slug: string) {
    const issues = await fj.all<any>(`/repos/${owner}/${slug}/issues?state=all&type=issues`);
    return new Map<number, any>(issues.map((i) => [i.number, i]));
  }

  const stateOf = (i: any, gh: any, byNum: Map<number, any>): State =>
    gh?.state === "closed"
      ? "done"
      : i.deps.every((d: number) => byNum.get(d)?.state === "closed")
        ? "ready"
        : "locked";

  async function courses() {
    const repos = await fj.all<any>(`/orgs/${cfg.org}/repos`);
    return Promise.all(
      repos.map(async (r) => {
        const s = await structure(r.name).catch(() => null);
        let done = 0;
        let newStages = 0;
        const failing: any[] = [];
        let byNum: Map<number, any> | undefined;
        if (s?.started) {
          const states = (byNum = await issueStates(r.name));
          done = [...states.values()].filter((i) => i.state === "closed").length;
          // Etapas que el curso fuente tiene y tu repo todavía no: se traen con upgrade.
          newStages = (s.source?.issues ?? []).filter((i: any) => !states.has(i.id)).length;
          for (const i of s.course.issues) {
            if (stateOf(i, states.get(i.id), states) !== "ready") continue;
            const res = await resultOf(r.name, i.id);
            // "todo": la etapa está sin empezar (el esqueleto), no es una falla.
            if (res && !res.ok && res.kind !== "todo") failing.push({ n: i.id, title: i.title, ...res });
          }
        }
        // Cuántas etapas tiene cada tramo y cuántas llevas: las barras de progreso las dibujan por tramo.
        const parts = (s?.course?.milestones ?? []).map((m: any) => {
          const list = (s?.course?.issues ?? []).filter((i: any) => i.milestone === m.id);
          return { total: list.length, done: list.filter((i: any) => byNum?.get(i.id)?.state === "closed").length };
        });
        return {
          slug: r.name,
          title: s?.course?.title ?? r.name,
          description: s?.course?.description ?? r.description,
          image: s?.course?.image ?? "",
          topics: s?.course?.topics ?? [],
          origin: s?.course?.origin ?? null,
          author: s?.course?.author ?? null,
          started: !!s?.started,
          done,
          total: s?.course?.issues?.length ?? 0,
          parts,
          newStages,
          updatedAt: r.updated_at,
          failing,
        };
      }),
    );
  }

  async function course(slug: string) {
    const s = await structure(slug);
    if (!s) return null;
    const byNum = s.started ? await issueStates(slug) : new Map();
    const issues = await Promise.all(s.course.issues.map(async (i: any) => {
      const gh = byNum.get(i.id);
      return {
        n: i.id,
        title: i.title,
        milestone: i.milestone,
        labels: i.labels ?? [],
        deps: i.deps ?? [],
        test: i.test,
        hints: s.hints.get(i.id) ?? 0,
        state: s.started ? stateOf(i, gh, byNum) : i.deps?.length ? "locked" : "ready",
        closedAt: gh?.closed_at ?? null,
        result: s.started ? await resultOf(slug, i.id) : null,
      };
    }));
    return {
      slug,
      started: s.started,
      newStages: s.started ? (s.source?.issues ?? []).filter((i: any) => !byNum.has(i.id)).length : 0,
      title: s.course.title,
      description: s.course.description,
      image: s.course.image,
      topics: s.course.topics ?? [],
      origin: s.course.origin ?? null,
      author: s.course.author ?? null,
      milestones: s.course.milestones,
      issues,
      setup: s.started ? await resultOf(slug, "setup", true) : null,
      cloneUrl: `${cfg.publicUrl}/${owner}/${slug}.git`,
      repoUrl: `${cfg.publicUrl}/${owner}/${slug}`,
      sourceUrl: `${cfg.publicUrl}/${cfg.org}/${slug}`,
    };
  }

  /** El README del curso renderizado: el de tu repo si lo empezaste, si no el del repo fuente. */
  async function readme(slug: string) {
    const started = !!(await fj.find(`/repos/${owner}/${slug}`));
    const repoOwner = started ? owner : cfg.org;
    const branch = await fj.find<any>(`/repos/${repoOwner}/${slug}/branches/main`);
    const key = `readme:${repoOwner}/${slug}@${branch?.commit?.id}`;
    let html = bodyCache.get(key);
    if (!html) {
      const md = await fj.raw(repoOwner, slug, "README.md").then((b) => b.toString("utf8")).catch(() => "");
      html = md ? await fj.markdown(md, `${repoOwner}/${slug}`) : "";
      bodyCache.set(key, html);
    }
    return { html };
  }

  async function issue(slug: string, n: number) {
    const gh = await fj.req<any>("GET", `/repos/${owner}/${slug}/issues/${n}`);
    const ctx = `${owner}/${slug}`;
    const key = `${slug}#${n}@${gh.updated_at}`;
    // Sacar el pie que agrega byox: la UI y el CLI lo muestran a su manera.
    const markdown = (gh.body as string).replace(/\n+---\s*\n+\*\*Verificar\*\*[\s\S]*$/, "");
    let html = bodyCache.get(key);
    if (!html) {
      html = await fj.markdown(markdown, ctx);
      bodyCache.set(key, html);
    }
    const comments = await fj.all<any>(`/repos/${owner}/${slug}/issues/${n}/comments`);
    const hints: { k: number; html: string; markdown: string; at: string }[] = [];
    const activity: { kind: string; text: string; at: string }[] = [];
    for (const c of comments) {
      const m = HINT_MARK.exec(c.body);
      if (m) {
        const text = c.body.replace(HINT_MARK, "").replace(/^\s*###[^\n]*\n/, "").trim();
        hints.push({ k: Number(m[1]), html: await fj.markdown(text, ctx), markdown: text, at: c.created_at });
      } else if (c.body.startsWith("✅")) activity.push({ kind: "pass", text: c.body.split("\n")[0], at: c.created_at });
      else if (c.body.startsWith("🔓")) activity.push({ kind: "unlock", text: c.body, at: c.created_at });
      else if (c.body.trim() === "/pista") activity.push({ kind: "ask", text: "Pediste una pista", at: c.created_at });
    }
    return {
      html,
      markdown,
      hints,
      activity,
      url: gh.html_url,
      state: gh.state,
      result: await resultOf(slug, n, true),
    };
  }

  async function status(slug: string) {
    const byNum = await issueStates(slug);
    const branch = await fj.find<any>(`/repos/${owner}/${slug}/branches/main`);
    let run = null;
    if (branch) {
      const sha = branch.commit.id as string;
      const st = await fj.req<any>("GET", `/repos/${owner}/${slug}/commits/${sha}/status`);
      const statuses: any[] = st.statuses ?? [];
      run = {
        sha,
        message: (branch.commit.message as string).split("\n")[0],
        at: branch.commit.timestamp,
        state: statuses.length ? st.state : "none",
        // Forgejo devuelve target_url relativo a su raíz.
        url: ((u?: string) => (u ? new URL(u, cfg.publicUrl).href : null))(statuses.find((s) => s.target_url)?.target_url),
      };
    }
    const res = await results.get(`${owner}/${slug}`);
    const issues = [...byNum.values()].map((i) => ({
      n: i.number,
      closed: i.state === "closed",
      ok: res[i.number]?.ok ?? null,
      at: res[i.number]?.at ?? null,
    }));
    return { issues, run };
  }

  /** Estado de los servicios para el indicador de la barra lateral. */
  async function health() {
    const forgejo = await fj.find("/version").then((v) => (v ? "ok" : "down")).catch(() => "down");
    let runner = "unknown";
    try {
      const runners = await fj.req<any[]>("GET", "/admin/actions/runners");
      runner = runners.some((r) => r.status === "active")
        ? "busy"
        : runners.some((r) => r.status === "idle")
          ? "ok"
          : "down";
    } catch {
      runner = "down";
    }
    return { forgejo, runner, mcp: "ok", mcpClient: await clients.status(owner), version: "0.3.0", user: owner, forgejoUrl: cfg.publicUrl };
  }

  /** Línea de tiempo: pushes y etapas cerradas en todos los cursos empezados. */
  async function activity() {
    const repos = await fj.all<any>(`/orgs/${cfg.org}/repos`);
    const events: any[] = [];
    await Promise.all(
      repos.map(async (r) => {
        if (!(await fj.find(`/repos/${owner}/${r.name}`))) return;
        const [issues, commits] = await Promise.all([
          issueStates(r.name),
          fj.req<any[]>("GET", `/repos/${owner}/${r.name}/commits?limit=30&stat=false&verification=false&files=false`),
        ]);
        for (const i of issues.values()) {
          if (i.state === "closed") events.push({ kind: "done", course: r.name, n: i.number, title: i.title, at: i.closed_at });
        }
        for (const c of commits) {
          const message = (c.commit.message as string).split("\n")[0];
          // Los commits de byox (creación y mantenimiento) no son actividad tuya.
          if (message.startsWith("🎉 ") || message.startsWith("🔧 ") || message === "Initial commit") continue;
          events.push({ kind: "push", course: r.name, sha: c.sha, title: message, at: c.commit.author.date });
        }
      }),
    );
    return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 60);
  }

  async function stats() {
    if (!statsCache || Date.now() - statsCache.at > 60_000) {
      statsCache = { at: Date.now(), stats: await computeStats(fj, cfg) };
    }
    return statsCache.stats;
  }

  /** Pide la siguiente pista: el workflow `pista.yml` la publica como comentario del issue. */
  async function askHint(slug: string, n: number) {
    await fj.as(owner).req("POST", `/repos/${owner}/${slug}/issues/${n}/comments`, { body: "/pista" });
  }

  return { cfg, courses, course, issue, status, stats, readme, askHint, health, activity, api: { courses, course, issue, status, stats, readme, askHint } };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    const m = (re: RegExp) => re.exec(p);
    let r: RegExpExecArray | null;

    // La landing está en /, la app en /app. Las rutas viejas de la app (links guardados, el CLI) redirigen.
    if (req.method === "GET" && (p === "/cursos" || p === "/actividad" || p.startsWith("/c/"))) {
      res.writeHead(301, { Location: `/app${p}${url.search}` });
      res.end();
      return true;
    }
    // La documentación son páginas estáticas: /docs, /docs/<página>.
    if (req.method === "GET" && (p === "/docs" || p.startsWith("/docs/")) && !extname(p) && !p.includes("..")) {
      const file = await readFile(new URL(`docs${p.replace(/\/+$/, "").slice("/docs".length)}/index.html`, DIST)).catch(() => null);
      res.writeHead(file ? 200 : 404, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
      res.end(file ?? "No encontrado");
      return true;
    }
    // La landing en inglés.
    if (req.method === "GET" && (p === "/en" || p === "/en/")) {
      res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache", "Content-Language": "en" });
      res.end(await readFile(new URL("en/index.html", DIST)));
      return true;
    }
    if (req.method === "GET" && (p === "/" || p === "/app" || p.startsWith("/app/"))) {
      res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" });
      res.end(await readFile(new URL(p === "/" ? "index.html" : "app/index.html", DIST)));
      return true;
    }
    if (req.method === "GET" && TYPES[extname(p)] && !p.includes("..")) {
      const file = await readFile(new URL(`.${p}`, DIST)).catch(() => null);
      if (file) {
        // Lo que está en /_astro/ lleva el hash en el nombre: no cambia nunca.
        const cache = p.startsWith("/_astro/") ? "public, max-age=31536000, immutable" : "no-cache";
        res.writeHead(200, { "Content-Type": TYPES[extname(p)], "Cache-Control": cache });
        res.end(file);
        return true;
      }
    }
    if (!p.startsWith("/api/")) return false;

    try {
      const who = await auth.principal(req);
      if (!who) return json(res, { error: "Inicia sesión.", login: true }, 401), true;
      const w = forUser(who.user);
      if (req.method === "GET" && p === "/api/courses") return json(res, await w.courses()), true;
      if (req.method === "GET" && p === "/api/profile") return json(res, await w.stats()), true;
      if (req.method === "GET" && p === "/api/health") return json(res, await w.health()), true;
      if (req.method === "GET" && p === "/api/activity") return json(res, await w.activity()), true;
      if (req.method === "GET" && (r = m(/^\/api\/courses\/([^/]+)$/))) {
        const c = await w.course(r[1]);
        return c ? json(res, c) : json(res, { error: "No existe ese curso" }, 404), true;
      }
      if (req.method === "GET" && (r = m(/^\/api\/courses\/([^/]+)\/status$/))) return json(res, await w.status(r[1])), true;
      if (req.method === "GET" && (r = m(/^\/api\/courses\/([^/]+)\/readme$/))) return json(res, await w.readme(r[1])), true;
      if (req.method === "GET" && (r = m(/^\/api\/courses\/([^/]+)\/issues\/(\d+)$/))) {
        return json(res, await w.issue(r[1], Number(r[2]))), true;
      }
      if (req.method === "POST" && (r = m(/^\/api\/courses\/([^/]+)\/issues\/(\d+)\/hint$/))) {
        await w.askHint(r[1], Number(r[2]));
        return json(res, { ok: true }), true;
      }
      if (req.method === "POST" && (r = m(/^\/api\/courses\/([^/]+)\/start$/))) {
        const src = await loadSource(fj, base.org, r[1]);
        if (src.errors.length) return json(res, { error: src.errors.join("\n") }, 400), true;
        if (!(await isVerified(fj, base.org, r[1], src.sha))) {
          return json(res, { error: "El curso no está verificado. Ejecuta `byox check` o pide a tu asistente que ejecute verify_course." }, 400), true;
        }
        await startCourse(fj, w.cfg, src, false);
        onProgress(who.user);
        return json(res, { ok: true }), true;
      }
      if (req.method === "POST" && (r = m(/^\/api\/courses\/([^/]+)\/upgrade$/))) {
        const src = await loadSource(fj, base.org, r[1]);
        if (src.errors.length) return json(res, { error: src.errors.join("\n") }, 400), true;
        if (!(await isVerified(fj, base.org, r[1], src.sha))) {
          return json(res, { error: "La versión nueva del curso todavía no está verificada." }, 400), true;
        }
        const log = await upgradeCourse(fj, w.cfg, src);
        onProgress(who.user);
        return json(res, { ok: true, log }), true;
      }
      json(res, { error: "No encontrado" }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json(res, { error: e.message }, e.status), true;
      console.error(e);
      json(res, { error: (e as Error).message }, 500);
    }
    return true;
  }


  return { handle, forUser };
}

export type WebApi = ReturnType<ReturnType<typeof web>["forUser"]>["api"];
