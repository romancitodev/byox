import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { authoring, ensureWebhook } from "./authoring.js";
import { Auth, HttpError, langOf, localize, type Principal, type SignupMode } from "./auth.js";
import { Clients } from "./clients.js";
import { isVerified, loadSource, VERIFY_CONTEXT, type Source } from "./course.js";
import { Forgejo } from "./forgejo.js";
import { courseStatus, startCourse, upgradeCourse } from "./instance.js";
import { notify } from "./notify.js";
import { Results } from "./results.js";
import { openDb } from "./store.js";
import { Usage } from "./usage.js";
import { refreshProfile } from "./profile.js";
import { Verifier } from "./verify.js";
import { registerTutor } from "./tutor.js";
import { web } from "./web.js";
import { defaultChecks, Watch } from "./watch.js";

const env = (k: string, d?: string) => {
  const v = process.env[k] || d;
  if (v === undefined) throw new Error(`Falta la variable ${k}`);
  return v;
};
const cfg = {
  // Sin usuario fijo: cada request lleva el suyo (ver auth.ts). Los módulos reciben una copia con `user`.
  user: "",
  bot: env("BYOX_BOT"),
  botToken: env("BYOX_BOT_TOKEN"),
  org: env("BYOX_ORG", "cursos"),
  publicUrl: env("BYOX_PUBLIC_URL", "http://localhost:3000"),
  webUrl: env("BYOX_WEB_URL", "http://localhost:3333"),
  tz: env("BYOX_TZ", "America/Argentina/Buenos_Aires"),
  hook: (repo: string) => auth.hookToken(repo),
};
const dataDir = env("BYOX_DATA", "/data");
// closed (self-hosted por defecto): sólo entran cuentas que crea el administrador. invite: con código. open: cualquiera.
const signup = env("BYOX_SIGNUP", "closed") as SignupMode;
// Quién puede escribir y verificar cursos (corren código en Docker): sólo administradores, o todos.
const authorsAll = env("BYOX_AUTHORS", "admin") === "all";
// Tope semanal de llamadas al MCP por cuenta. Los administradores no tienen tope. 0 lo apaga para todos.
const mcpWeeklyLimit = Math.max(0, Math.floor(Number(env("BYOX_MCP_WEEKLY_LIMIT", "50"))) || 0) || null;
const limitFor = (p: Principal) => (p.admin ? null : mcpWeeklyLimit);
const fj = new Forgejo(env("FORGEJO_URL"), env("BYOX_TOKEN"));
// Con DATABASE_URL el estado vive en Postgres; si no, en archivos JSON dentro de BYOX_DATA.
const db = await openDb(dataDir, process.env.DATABASE_URL || undefined);
console.log(`estado en ${db.kind === "postgres" ? "Postgres" : `archivos (${dataDir})`}`);
const auth = new Auth(fj, {
  bot: cfg.bot,
  org: cfg.org,
  signup,
  trustProxy: env("BYOX_TRUST_PROXY", "") === "1",
  secureCookies: env("BYOX_SECURE_COOKIES", "") === "1",
}, db);
await auth.init();
const canAuthor = (p: Principal) => p.admin || authorsAll;
const guide = readFileSync(new URL("../assets/guide.md", import.meta.url), "utf8");

const INSTRUCTIONS = `byox convierte "build your own X" en repos de Forgejo: cada paso es un issue con un test, los issues forman un grafo y Forgejo Actions cierra los que pasan. Vos sos el autor de los cursos.

Antes de escribir un curso, llamá a get_format_guide.

Cupo: cada cuenta tiene un número limitado de llamadas a herramientas por semana (los administradores no). Sé económico: escribí todos los archivos del curso en pocas llamadas a write_course_files (decenas de archivos por llamada), no repitas get_format_guide ni validate_course sin haber cambiado nada, y si una herramienta responde que se acabó el cupo, avisale a la persona cuándo se renueva en vez de reintentar.

Calidad: nada inventado.
- Basate en fuentes reales. Antes de escribir un contrato, un test o una pista sobre una API, una librería, un protocolo o un comportamiento del lenguaje, verificalo contra la documentación oficial, la especificación (RFC, spec del formato) o el código fuente de una implementación real. Usá las herramientas que tengas (docs MCP como context7, búsqueda web, leer repos reales) y fijate que la versión coincida con la de \`image\`.
- Ejecutá antes de afirmar. Si tenés shell o Docker, probá los snippets. Los números (salidas, tamaños, tiempos, conteos) salen de una corrida real, no de una estimación.
- Todo curso trae solution/: una implementación de referencia completa y real. verify_course corre los tests en la imagen del curso: con el esqueleto tienen que fallar todos y con la solución tienen que pasar todos. start_course se niega a publicar un commit que no pasó verify_course.
- En course.yaml poné \`origin: ai\`: la web distingue los cursos que escribe un asistente de los que arma una persona a mano.
- Citá. Cada issue termina con una sección "Para leer" con links a las fuentes reales que usaste: docs, specs, código.
- Si algo no lo pudiste verificar, decíselo al usuario en el chat en vez de publicarlo como cierto.

README: cada curso tiene un README.md en la raíz del repo fuente, y tiene que ser lindo. Es la portada: lo primero que ve el alumno y lo que lo engancha. Título con un emoji, una frase que diga qué vas a construir, una demo con salida real de correr la solución, qué vas a aprender, requisitos y tiempo estimado por milestone, y créditos a las fuentes. Escaneable, sin muros de texto ni palabras de marketing. byox le agrega abajo el mapa del grafo y cómo se usa, así que no los repitas.

Pedagogía: el alumno aprende haciendo. Dale contratos, reglas y preguntas que lo lleven a la idea. Las pistas van de lo conceptual a lo concreto y nunca son la solución entera.

Acompañar al alumno: además de autor, sos su tutor mientras hace un curso. Para saber en qué está usá where_am_i; para leer una etapa, get_stage; si un test falla, explain_failure te da el diagnóstico, el log y su código en ese commit; ci_status dice cómo terminó el último push. Explicá la causa y señalá el archivo y la línea, hacé preguntas que lo lleven a la idea y no escribas la solución completa salvo que te la pida. Pedí pistas con get_hint solo si el alumno quiere una.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });
const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "minúsculas, números, '-', '_' o '.'");

function problems(src: Source): string {
  return [
    ...src.errors.map((e) => `❌ ${e}`),
    ...src.warnings.map((w) => `⚠️ ${w}`),
  ].join("\n");
}

function buildServer(me: Principal): McpServer {
  const mine = { ...cfg, user: me.user };
  const needAuthor = () =>
    canAuthor(me) ? null : fail("Tu cuenta no puede crear ni verificar cursos en esta instancia. Pídele a un administrador que te dé permiso.");
  const server = new McpServer({ name: "byox", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "get_format_guide",
    { description: "Formato de un curso de byox y cómo escribir uno. Leelo antes de crear o editar un curso." },
    async () => text(guide),
  );

  server.registerTool(
    "list_courses",
    { description: "Lista los cursos creados (repos fuente) y el progreso de los que están empezados." },
    async () => {
      const repos = await fj.all<any>(`/orgs/${cfg.org}/repos`);
      if (repos.length === 0) return text("No hay cursos todavía.");
      const lines = await Promise.all(
        repos.map(async (r) => {
          const issues = await fj.find<any[]>(`/repos/${me.user}/${r.name}/issues?state=all&type=issues&limit=50`);
          const progress = issues
            ? `${issues.filter((i) => i.state === "closed").length}/${issues.length}`
            : "sin empezar";
          return `- ${r.name}: ${r.description || "(sin descripción)"} · ${progress}`;
        }),
      );
      return text(lines.join("\n"));
    },
  );

  server.registerTool(
    "read_course",
    {
      description:
        "Lee el repo fuente de un curso. Sin `paths` devuelve la lista de archivos; con `paths`, el contenido de esos archivos.",
      inputSchema: { slug: slugSchema, paths: z.array(z.string()).optional() },
    },
    async ({ slug, paths }) => {
      const tree = await fj.tree(cfg.org, slug);
      if (tree.size === 0) return fail(`No existe ${cfg.org}/${slug} o está vacío.`);
      if (!paths?.length) return text([...tree.keys()].sort().join("\n"));
      const parts = await Promise.all(
        paths.map(async (p) =>
          tree.has(p) ? `=== ${p}\n${(await fj.raw(cfg.org, slug, p)).toString("utf8")}` : `=== ${p}\n(no existe)`,
        ),
      );
      return text(parts.join("\n\n"));
    },
  );

  server.registerTool(
    "write_course_files",
    {
      description:
        "Crea o actualiza archivos en el repo fuente de un curso (lo crea si no existe), en un solo commit. `content: null` borra el archivo.",
      inputSchema: {
        slug: slugSchema,
        description: z.string().optional().describe("Descripción del repo, sólo al crearlo"),
        message: z.string().optional().describe("Mensaje del commit"),
        files: z.array(z.object({ path: z.string().min(1), content: z.string().nullable() })).min(1),
      },
    },
    async ({ slug, description, message, files }) => {
      const no = needAuthor();
      if (no) return no;
      if (!(await fj.find(`/repos/${cfg.org}/${slug}`))) {
        await fj.req("POST", `/orgs/${cfg.org}/repos`, {
          name: slug,
          description: description ?? "",
          private: true,
          auto_init: true,
          default_branch: "main",
        });
        notify.send("course", "info", "Curso creado", { Curso: slug, Autor: me.user, Cómo: "asistente (MCP)" });
      }
      const sha = await fj.commit(
        cfg.org,
        slug,
        Object.fromEntries(files.map((f) => [f.path.replace(/^\/+/, ""), f.content])),
        message ?? `Actualizar ${files.length} archivo(s)`,
      );
      // Lo verifica verify_course cuando el curso esté listo, no el webhook en cada escritura.
      verifier.ownCommit(sha);
      return text(`Listo: ${files.length} archivo(s) en ${cfg.publicUrl}/${cfg.org}/${slug}`);
    },
  );

  server.registerTool(
    "validate_course",
    { description: "Valida el formato del curso (course.yaml, grafo, archivos). Rápido, no corre tests.", inputSchema: { slug: slugSchema } },
    async ({ slug }) => {
      const src = await loadSource(fj, cfg.org, slug);
      if (src.errors.length) return fail(problems(src));
      const c = src.course!;
      return text(
        [`✅ ${c.title}: ${c.issues.length} issues, ${c.milestones.length} milestones.`, problems(src)]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "verify_course",
    {
      description:
        "Corre los tests en la imagen real del curso: con el esqueleto (files/) tienen que fallar todos y con files/ + solution/ tienen que pasar todos. Puede tardar varios minutos. start_course requiere que el último commit esté verificado.",
      inputSchema: { slug: slugSchema },
    },
    async ({ slug }) => {
      const no = needAuthor();
      if (no) return no;
      const src = await loadSource(fj, cfg.org, slug);
      if (src.errors.length) return fail(problems(src));
      const v = await verifier.run(slug);
      const report = v.report ?? v.errors.join("\n");
      return v.state === "success" ? text(report) : fail(report);
    },
  );

  server.registerTool(
    "export_course",
    {
      description:
        "Exporta un curso a un código (byox1-…) para compartirlo: lleva el repo fuente entero, con la solución, comprimido. Quien lo recibe lo importa en su byox con import_course, `byox import` o la web.",
      inputSchema: { slug: slugSchema },
    },
    async ({ slug }) => {
      const e = await author.exportCourse(slug, me.user);
      return text(
        [
          `${e.title} @ ${e.sha.slice(0, 7)}: ${e.files} archivos, ${Math.ceil(e.bytes / 1024)} KB${e.verified ? "" : " (el commit no está verificado)"}.`,
          `También se descarga como archivo: ${cfg.webUrl}/api/courses/${slug}/export.byox`,
          "",
          e.code,
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "import_course",
    {
      description:
        "Importa un curso desde un código de byox (byox1-…): crea el repo fuente y lo verifica en tu Docker. Con `preview: true` sólo muestra qué trae. Los tests del curso corren en Docker, así que importá códigos de gente en la que confiás.",
      inputSchema: {
        code: z.string().min(10),
        slug: slugSchema.optional().describe("Otro nombre, si ya tenés un curso con el mismo"),
        preview: z.boolean().default(false),
      },
    },
    async ({ code, slug, preview }) => {
      const no = needAuthor();
      if (no) return no;
      if (preview) return text(JSON.stringify(await author.preview(code), null, 2));
      const r = await author.importCourse(code, slug, me.user);
      return text(`Importado: ${r.title} en ${r.sourceUrl}. Se está verificando; mirá el estado con validate_course o en la web.`);
    },
  );

  server.registerTool(
    "start_course",
    {
      description:
        "Crea tu repo del curso a partir del repo fuente verificado: issues, milestones, grafo de dependencias, labels, pistas y workflows. Con reset: true borra tu progreso y arranca de cero.",
      inputSchema: { slug: slugSchema, reset: z.boolean().default(false) },
    },
    async ({ slug, reset }) => {
      const src = await loadSource(fj, cfg.org, slug);
      if (src.errors.length) return fail(problems(src));
      const statuses = await fj.all<any>(`/repos/${cfg.org}/${slug}/commits/${src.sha}/statuses`);
      const verified = statuses.find((s) => s.context === VERIFY_CONTEXT);
      if (verified?.status !== "success") {
        return fail(
          `El commit ${src.sha.slice(0, 7)} de ${cfg.org}/${slug} no pasó verify_course${verified ? "" : " (no se corrió)"}. Corré verify_course primero.`,
        );
      }
      const out = await startCourse(fj, mine, src, reset);
      usage.course(me.user, slug).catch((e) => console.error("uso:", e.message));
      notify.send("start", "info", "Curso empezado", { Usuario: me.user, Curso: slug });
      scheduleProfile(me.user);
      return text(out);
    },
  );

  server.registerTool(
    "course_status",
    { description: "Progreso de un curso empezado: qué está cerrado, disponible y bloqueado.", inputSchema: { slug: slugSchema } },
    async ({ slug }) => text(await courseStatus(fj, mine, slug)),
  );

  server.registerTool(
    "upgrade_course",
    {
      description:
        "Trae a tu repo del curso lo nuevo del curso fuente sin perder el progreso: etapas y tramos nuevos (issues, dependencias, pistas), los textos corregidos, los archivos que genera byox y los archivos del curso que no modificaste. Tu código no se toca. Sólo con un commit verificado.",
      inputSchema: { slug: slugSchema },
    },
    async ({ slug }) => {
      if (!(await fj.find(`/repos/${me.user}/${slug}`))) return fail(`No existe ${me.user}/${slug}. Para empezarlo usá start_course.`);
      const src = await loadSource(fj, cfg.org, slug);
      if (src.errors.length) return fail(problems(src));
      if (!(await isVerified(fj, cfg.org, slug, src.sha))) return fail("El último commit del curso no está verificado. Corré verify_course primero.");
      return text(await upgradeCourse(fj, mine, src));
    },
  );

  registerTutor(server, { fj, user: me.user, api: web_.forUser(me.user).api });
  return server;
}

/** Responde a cada `tools/call` con un error de herramienta (lo ve el asistente y se lo cuenta a la persona). */
function weeklyLimitReached(req: IncomingMessage, res: ServerResponse, who: Principal, calls: any[], limit: number, used: number) {
  const reset = Usage.nextWeek();
  const en = langOf(req) === "en";
  const when = reset.toISOString().slice(0, 10);
  const msg = en
    ? `You have used your ${limit} MCP calls for this week (${used}/${limit}). The quota refills on Monday ${when} (UTC). The web app and the CLI are not affected.`
    : `Usaste tus ${limit} llamadas al MCP de esta semana (${used}/${limit}). El cupo se renueva el lunes ${when} (UTC). La web y el CLI siguen funcionando.`;
  const answers = calls.map((m) => ({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: msg }], isError: true } }));
  notify.send("security", "info", "Llegó al tope semanal de llamadas MCP", { Usuario: who.user, Tope: String(limit) }, { key: `mcp-limit|${who.user}|${Usage.week()}` });
  res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(answers.length === 1 ? answers[0] : answers));
}

// El perfil se regenera cuando avanza un curso (el workflow avisa), al publicar
// uno y cada 30 minutos para que la racha se corte sola a la medianoche.
const profileTimers = new Map<string, NodeJS.Timeout>();
function scheduleProfile(user: string, delay = 3000) {
  clearTimeout(profileTimers.get(user));
  profileTimers.set(
    user,
    setTimeout(() => {
      refreshProfile(fj, { ...cfg, user }).catch((e) => console.error(`perfil de ${user}:`, e.message));
    }, delay),
  );
}
// El perfil se regenera cuando avanza un curso (el workflow avisa), al empezar uno y cada 30 minutos
// para que la racha se corte sola a la medianoche.
const refreshAll = (delay = 0) =>
  auth.users().then((us) => us.forEach((u, k) => scheduleProfile(u, delay + k * 2000))).catch((e) => console.error("perfiles:", e.message));
setInterval(() => refreshAll(), 30 * 60_000);
setTimeout(() => refreshAll(), 10_000);

const results = new Results(db);
const verifier = new Verifier(fj, cfg.org, db);
const author = authoring(fj, cfg, verifier);
// Los push a los repos fuente (cursos escritos a mano) se verifican solos.
const hookUrl = env("BYOX_HOOK_URL", "http://mcp:3333/hooks/source");
const hook = (tries = 0) =>
  ensureWebhook(fj, cfg.org, hookUrl, auth.webhookSecret).catch((e) => {
    console.error("webhook:", e.message);
    if (tries < 10) setTimeout(() => hook(tries + 1), 30_000);
  });
hook();
const clients = new Clients(db);
const usage = new Usage(db);
const web_ = web(fj, cfg, results, clients, auth, (user) => scheduleProfile(user), usage);
const handleWeb = web_.handle;

createServer(async (req, res) => {
  try {
    const hookRepo = async (): Promise<{ repo: string; body: any } | null> => {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 5_000_000) throw new HttpError(413, "Demasiado grande.");
      }
      const body = JSON.parse(raw || "{}");
      const sent = req.headers["x-byox-hook"];
      return typeof body.repo === "string" && auth.checkHook(body.repo, Array.isArray(sent) ? sent[0] : sent)
        ? { repo: body.repo, body }
        : null;
    };
    if (req.url === "/hooks/results" && req.method === "POST") {
      // Lo manda el job `advance` de cada push: qué pasó en cada etapa y su salida. Cada repo firma con su propio secreto.
      const h = await hookRepo();
      if (!h) return void res.writeHead(401).end();
      await results.record(h.body);
      res.writeHead(204).end();
      return;
    }
    if (req.url === "/hooks/progress" && req.method === "POST") {
      const h = await hookRepo();
      if (!h) return void res.writeHead(401).end();
      scheduleProfile(h.repo.split("/")[0]);
      res.writeHead(204).end();
      return;
    }
    if (req.url === "/hooks/source" && req.method === "POST") {
      await author.sourceHook(req, res, (raw, sig) => auth.checkSignature(raw, sig));
      return;
    }
    if (req.url === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (req.url?.startsWith("/mcp")) {
      const who = await auth.principal(req);
      if (!who) {
        res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": 'Bearer realm="byox"' });
        res.end(JSON.stringify({ error: "Falta el token. Crea uno en tu cuenta de byox y agrégalo como `Authorization: Bearer byox_…`." }));
        return;
      }
      // El cuerpo se lee acá para saber qué cliente es (lo muestra la web) y cuántas herramientas pide; se le pasa ya parseado.
      let body: unknown;
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        try {
          body = JSON.parse(raw);
          clients.seen(who.user, body);
        } catch {
          body = undefined;
        }
        const calls = (Array.isArray(body) ? body : [body]).filter((m: any) => m?.method === "tools/call");
        if (calls.length) {
          const limit = limitFor(who);
          const taken = await usage.take(who.user, calls.length, limit).catch((e) => {
            console.error("uso:", e.message);
            return { ok: true, used: 0 }; // si el contador falla, no se le corta el servicio a nadie
          });
          if (!taken.ok) return void weeklyLimitReached(req, res, who, calls, limit!, taken.used);
        }
      }
      // Sin sesiones: un servidor y un transporte por request.
      const server = buildServer(who);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }
    if (await auth.handle(req, res)) return;
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (path.startsWith("/api/")) {
      const who = await auth.principal(req);
      if (!who) {
        res.writeHead(401, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ error: "Inicia sesión.", login: true }));
        return;
      }
      // Escribir, verificar e importar cursos corre código ajeno en Docker: no es para cualquier cuenta.
      if (req.method === "POST" && (path.startsWith("/api/author") || path.startsWith("/api/import")) && !canAuthor(who)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Tu cuenta no puede crear ni importar cursos en esta instancia." }));
        return;
      }
      if (path === "/api/usage" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(await usage.summary(who.user, limitFor(who))));
        return;
      }
      if (await author.handle(req, res, who.user)) return;
    }
    if (await handleWeb(req, res)) return;
    res.writeHead(404).end();
  } catch (e) {
    if (e instanceof HttpError) {
      if (!res.headersSent) res.writeHead(e.status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: localize(e.message, req) }));
      return;
    }
    console.error(e);
    const path = (req.url ?? "").split("?")[0];
    notify.send("error", "error", "Error interno del servidor", { Ruta: `${req.method} ${path}` }, { text: (e as Error)?.stack ?? String(e), key: `500|${req.method} ${path}|${(e as Error)?.message}` });
    if (!res.headersSent) res.writeHead(500).end("Error interno");
  }
}).listen(3333, () => {
  console.log("byox en :3333 (web en /, MCP en /mcp)");
  notify.send("system", "info", "byox arrancó", {
    Estado: db.kind === "postgres" ? "Postgres" : "archivos",
    Registro: signup,
    Autores: authorsAll ? "todos" : "administradores",
    Avisos: "activos",
  });
  new Watch(defaultChecks(fj, dataDir)).start();
});

// Un error que nadie atrapó deja el proceso en un estado dudoso: se avisa y se sale (Docker lo levanta de nuevo).
const die = (what: string, e: unknown) => {
  console.error(what, e);
  notify.send("error", "error", what, {}, { text: (e as Error)?.stack ?? String(e), key: `proc|${what}` });
  void notify.flush(4000).finally(() => process.exit(1));
};
process.on("uncaughtException", (e) => die("Excepción sin atrapar", e));
process.on("unhandledRejection", (e) => die("Promesa rechazada sin atrapar", e));
// docker stop manda SIGTERM: se avisa de la parada antes de salir.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    notify.send("system", "warn", "byox se está deteniendo", { Señal: sig });
    void notify.flush(3000).finally(() => process.exit(0));
  });
}
