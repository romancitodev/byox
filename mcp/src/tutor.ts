import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Forgejo } from "./forgejo.js";
import type { WebApi } from "./web.js";

/**
 * Herramientas para acompañar al alumno mientras hace un curso: en qué está, qué pide una etapa,
 * por qué falla un test (con el log y el código en ese commit), pistas y revisión de su código.
 * Usan las mismas consultas que la web, así el asistente y la interfaz dicen lo mismo.
 */
type Deps = { fj: Forgejo; user: string; api: WebApi };

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });
const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "minúsculas, números, '-', '_' o '.'");
const STATE = { done: "completada", ready: "disponible", locked: "bloqueada" } as Record<string, string>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un fallo real: una etapa sin empezar (el test llega al todo!() del esqueleto) no cuenta. */
const isFailing = (i: any) => i.state === "ready" && i.result && !i.result.ok && i.result.kind !== "todo";
const where = (r: any) => (r?.where ? `${r.where.path}:${r.where.line}${r.where.col ? `:${r.where.col}` : ""}` : "");

/** Las líneas resaltadas del log con un poco de contexto, sin pasarse de largo. */
function logExcerpt(log: string, highlight: number[], max = 80): string {
  const lines = log.split("\n");
  if (!highlight.length) return lines.slice(-max).join("\n");
  const keep = new Set<number>();
  for (const h of highlight) for (let k = h - 3; k <= h + 3; k++) if (k >= 0 && k < lines.length) keep.add(k);
  const out: string[] = [];
  let last = -2;
  for (const k of [...keep].sort((a, b) => a - b).slice(0, max)) {
    if (k !== last + 1) out.push("…");
    out.push(`${highlight.includes(k) ? ">" : " "} ${lines[k]}`);
    last = k;
  }
  return out.join("\n");
}

/** Las líneas del archivo alrededor de `line`, numeradas y con la del error marcada. */
function codeExcerpt(src: string, line: number, around = 12): string {
  const lines = src.split("\n");
  const from = Math.max(1, line - around);
  const to = Math.min(lines.length, line + around);
  const width = String(to).length;
  const out: string[] = [];
  for (let k = from; k <= to; k++) out.push(`${k === line ? ">" : " "} ${String(k).padStart(width)} │ ${lines[k - 1]}`);
  return out.join("\n");
}

export function registerTutor(server: McpServer, { fj, user, api }: Deps) {
  const started = async (slug: string) => {
    const c = await api.course(slug);
    if (!c) throw new Error(`No existe el curso ${slug}.`);
    if (!c.started) throw new Error(`${slug} todavía no está empezado. Empiézalo desde la web o con start_course.`);
    return c;
  };

  server.registerTool(
    "where_am_i",
    {
      description:
        "Resumen de dónde está el alumno: progreso de cada curso empezado, etapas disponibles, etapas cuyo test falla (con el mensaje y el archivo:línea) y el estado del último push. Úsalo al empezar a ayudar o cuando pregunte qué sigue.",
      inputSchema: { slug: slugSchema.optional().describe("Un curso en particular; sin esto, todos los empezados") },
    },
    async ({ slug }) => {
      const list = slug ? [{ slug }] : (await api.courses()).filter((c) => c.started);
      if (!list.length) return text("No hay cursos empezados. Usa list_courses para ver los disponibles.");
      const blocks = await Promise.all(
        list.map(async ({ slug }) => {
          const c = await started(slug);
          const st = await api.status(slug);
          const done = c.issues.filter((i: any) => i.state === "done").length;
          const ready = c.issues.filter((i: any) => i.state === "ready");
          const failing = ready.filter(isFailing);
          const run = st.run;
          const lines = [`## ${c.title}${c.title !== slug ? ` (${slug})` : ""}: ${done}/${c.issues.length} etapas`];
          if (run) lines.push(`Último push: ${run.sha.slice(0, 7)} "${run.message}" · CI: ${run.state}${run.url ? ` · ${run.url}` : ""}`);
          if (failing.length) {
            lines.push("Tests que fallan:");
            for (const i of failing) lines.push(`- #${i.n} ${i.title}: ${i.result.message ?? "falló"}${where(i.result) ? ` (${where(i.result)})` : ""}`);
          }
          if (ready.length) {
            lines.push("Disponibles:");
            for (const i of ready) {
              const ms = c.milestones.find((m: any) => m.id === i.milestone);
              const left = c.issues.filter((x: any) => x.milestone === i.milestone && x.state !== "done").length;
              lines.push(`- #${i.n} ${i.title} · ${ms?.title ?? i.milestone} (quedan ${left} en el tramo) · \`${i.test}\``);
            }
          } else if (done === c.issues.length) lines.push("Curso completado.");
          return lines.join("\n");
        }),
      );
      return text(blocks.join("\n\n"));
    },
  );

  server.registerTool(
    "get_stage",
    {
      description:
        "La consigna completa de una etapa (markdown), su estado, de qué depende y qué desbloquea, el comando de test, las pistas ya pedidas y el último resultado del CI.",
      inputSchema: { slug: slugSchema, n: z.number().int().positive() },
    },
    async ({ slug, n }) => {
      const c = await started(slug);
      const i = c.issues.find((x: any) => x.n === n);
      if (!i) return fail(`${slug} no tiene la etapa #${n}.`);
      const data = await api.issue(slug, n);
      const ms = c.milestones.find((m: any) => m.id === i.milestone);
      const dep = (d: number) => {
        const x = c.issues.find((y: any) => y.n === d);
        return `#${d} ${x?.title ?? ""} (${STATE[x?.state] ?? "?"})`;
      };
      const unlocks = c.issues.filter((x: any) => x.deps.includes(n)).map((x: any) => `#${x.n} ${x.title}`);
      const r = data.result;
      return text(
        [
          `# #${n} ${i.title}`,
          `Estado: ${STATE[i.state]} · Tramo: ${ms?.title ?? i.milestone} · Test: \`${i.test}\``,
          i.deps.length ? `Requiere: ${i.deps.map(dep).join(", ")}` : "Sin requisitos.",
          unlocks.length ? `Al completarla desbloquea: ${unlocks.join(", ")}` : "",
          r ? `Último resultado: ${r.ok ? "pasó" : `falló: ${r.message ?? "sin mensaje"}${where(r) ? ` (${where(r)})` : ""}`} en ${r.sha.slice(0, 7)}` : "Todavía no se ejecutó en el CI.",
          `Pistas: ${data.hints.length} de ${i.hints} pedidas.`,
          "",
          "## Consigna",
          data.markdown,
          ...data.hints.map((h: any) => `\n## Pista ${h.k}\n${h.markdown}`),
        ]
          .filter((l) => l !== "")
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "explain_failure",
    {
      description:
        "Por qué falla el test de una etapa: el diagnóstico, las líneas del log que importan y el código del alumno alrededor del error, en el commit donde falló. Sin `n`, toma la primera etapa disponible que falla. Explica la causa y señala la línea; no escribas la solución completa salvo que el alumno la pida.",
      inputSchema: { slug: slugSchema, n: z.number().int().positive().optional() },
    },
    async ({ slug, n }) => {
      const c = await started(slug);
      const target = n ?? c.issues.find(isFailing)?.n;
      if (!target) return text("No hay etapas disponibles con el test fallando. Usa where_am_i para ver el estado.");
      const i = c.issues.find((x: any) => x.n === target);
      if (!i) return fail(`${slug} no tiene la etapa #${target}.`);
      const data = await api.issue(slug, target);
      const r = data.result as any;
      if (!r) return text(`#${target} todavía no se ejecutó en el CI. Pídele al alumno que haga push o que corra \`byox test ${target}\`.`);
      if (r.ok) return text(`El test de #${target} pasó en ${r.sha.slice(0, 7)}.`);
      const out = [
        `# #${target} ${i.title}: el test falló en ${r.sha.slice(0, 7)}`,
        `Test: \`${i.test}\` · Tipo: ${r.kind ?? "desconocido"}${r.runUrl ? ` · Run: ${r.runUrl}` : ""}`,
        `Mensaje: ${r.message ?? "(sin mensaje)"}`,
      ];
      if (r.kind === "todo") out.push("La etapa está sin empezar: el test llega al todo!() del esqueleto.");
      if (r.where) {
        out.push(`Dónde: ${where(r)}`);
        const src = await fj.raw(user, slug, r.where.path, r.sha).then((b) => b.toString("utf8")).catch(() => null);
        if (src) out.push("", `## ${r.where.path} en ${r.sha.slice(0, 7)}`, "```", codeExcerpt(src, r.where.line), "```");
      }
      if (r.log) out.push("", "## Log (las líneas marcadas con > son las del error)", "```", logExcerpt(r.log, r.highlight ?? []), "```");
      return text(out.join("\n"));
    },
  );

  server.registerTool(
    "get_hint",
    {
      description:
        "Pide la siguiente pista de una etapa y la devuelve cuando el bot la publica (puede tardar hasta un minuto). Úsalo solo si el alumno pide una pista o acepta recibirla: cada pista pedida queda registrada.",
      inputSchema: { slug: slugSchema, n: z.number().int().positive() },
    },
    async ({ slug, n }) => {
      const c = await started(slug);
      const i = c.issues.find((x: any) => x.n === n);
      if (!i) return fail(`${slug} no tiene la etapa #${n}.`);
      const before = await api.issue(slug, n);
      if (before.hints.length >= i.hints) return text(`#${n} no tiene más pistas: ya se pidieron las ${i.hints}.`);
      await api.askHint(slug, n);
      for (let t = 0; t < 30; t++) {
        await wait(2000);
        const now = await api.issue(slug, n);
        if (now.hints.length > before.hints.length) {
          const h = now.hints.at(-1)!;
          return text(`Pista ${h.k} de ${i.hints} para #${n}:\n\n${h.markdown}`);
        }
      }
      return fail("La pista no llegó en un minuto. Comprueba que el runner de Forgejo esté activo.");
    },
  );

  server.registerTool(
    "read_my_code",
    {
      description:
        "Lee el repositorio del alumno en Forgejo (rama main, o `ref`). Sin `paths` lista los archivos; con `paths` devuelve su contenido. Sirve cuando el código no está en el directorio de trabajo.",
      inputSchema: { slug: slugSchema, paths: z.array(z.string()).optional(), ref: z.string().optional() },
    },
    async ({ slug, paths, ref }) => {
      const tree = await fj.tree(user, slug, ref ?? "main");
      if (!tree.size) return fail(`No existe ${user}/${slug} o está vacío.`);
      if (!paths?.length) return text([...tree.keys()].filter((p) => !p.startsWith(".forgejo/")).sort().join("\n"));
      const parts = await Promise.all(
        paths.map(async (p) => (tree.has(p) ? `=== ${p}\n${(await fj.raw(user, slug, p, ref ?? "main")).toString("utf8")}` : `=== ${p}\n(no existe)`)),
      );
      return text(parts.join("\n\n"));
    },
  );

  server.registerTool(
    "ci_status",
    {
      description: "El último push de un curso: commit, estado del CI (pending, success, failure) y el resultado de cada etapa probada.",
      inputSchema: { slug: slugSchema },
    },
    async ({ slug }) => {
      const c = await started(slug);
      const st = await api.status(slug);
      if (!st.run) return text("Todavía no hay pushes en este curso.");
      const r = st.run;
      const tested = c.issues.filter((i: any) => i.result && i.result.sha === r.sha);
      return text(
        [
          `Commit ${r.sha.slice(0, 7)} "${r.message}" · CI: ${r.state}${r.url ? ` · ${r.url}` : ""}`,
          r.state === "pending" ? "El CI todavía está corriendo; vuelve a consultar en unos segundos." : "",
          ...tested.map((i: any) => `- #${i.n} ${i.title}: ${i.result.ok ? "pasó" : `falló: ${i.result.message ?? ""}${where(i.result) ? ` (${where(i.result)})` : ""}`}`),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "my_stats",
    { description: "La racha del alumno (días seguidos con commits o etapas completadas), su récord y los cursos creados, empezados y terminados." },
    async () => {
      const s = await api.stats();
      const finished = s.taken.filter((t: any) => t.total && t.done === t.total).length;
      return text(
        [
          `Racha: ${s.streak} día(s) · Récord: ${s.best} · Días con actividad: ${s.active.length}`,
          `Cursos: ${s.created.length} creados, ${s.taken.length} empezados, ${finished} terminados.`,
          ...s.taken.map((t: any) => `- ${t.name}: ${t.done}/${t.total}`),
        ].join("\n"),
      );
    },
  );

  // Prompts: en Claude Code aparecen como /mcp__byox__<nombre>.
  server.registerPrompt(
    "atascado",
    {
      title: "Estoy atascado",
      description: "Ayuda con la etapa en la que estás trabado, sin darte la solución.",
      argsSchema: { curso: z.string().optional(), etapa: z.string().optional() },
    },
    ({ curso, etapa }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Estoy atascado${etapa ? ` en la etapa #${etapa}` : ""}${curso ? ` de ${curso}` : ""}. Usa where_am_i${curso ? "" : " para ubicar el curso"}, get_stage y explain_failure para entender qué pide la etapa y por qué falla. Explícame la causa con el archivo y la línea, y hazme una o dos preguntas que me acerquen a la solución. No escribas la solución completa; si hace falta, ofréceme pedir una pista con get_hint.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "que_sigue",
    { title: "¿Qué sigue?", description: "Tu progreso y qué etapa conviene hacer ahora." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Usa where_am_i y dime en qué estoy. Si hay tests fallando, empieza por ahí. Si no, recomiéndame una etapa disponible (la que más acerque a completar un tramo), resume su consigna con get_stage y dime el comando para probarla.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "revisar_etapa",
    {
      title: "Revisar mi solución",
      description: "Revisión de tu código de una etapa ya completada: legibilidad, casos borde e idiomaticidad.",
      argsSchema: { curso: z.string(), etapa: z.string() },
    },
    ({ curso, etapa }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Revisa mi solución de la etapa #${etapa} de ${curso}. Lee la consigna con get_stage y mi código con read_my_code (o del directorio de trabajo si está acá). Dime qué está bien, qué casos borde no cubro, qué sería más idiomático en el lenguaje del curso y si hay algo que vaya a complicar las etapas que desbloquea. Sé concreto, con líneas y ejemplos cortos.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "crear_curso",
    {
      title: "Crear un curso",
      description: "Crea, verifica y publica un curso nuevo de byox.",
      argsSchema: { tema: z.string(), lenguaje: z.string().optional(), etapas: z.string().optional() },
    },
    ({ tema, lenguaje, etapas }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Crea un curso de byox para construir ${tema}${lenguaje ? ` en ${lenguaje}` : ""}${etapas ? `, en unas ${etapas} etapas` : ""}. Lee get_format_guide antes de empezar, escribe el curso con write_course_files, valídalo con validate_course y verifícalo con verify_course hasta que el esqueleto falle y la solución pase en todas las etapas. Cuando esté verificado, pregúntame si empiezo el curso yo con start_course para probarlo, y si quiero hacerlo público con set_course_visibility (por defecto queda privado, solo para mí).`,
          },
        },
      ],
    }),
  );
}
