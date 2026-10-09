import { parse } from "yaml";
import { z } from "zod";
import type { Forgejo } from "./forgejo.js";

export const RESERVED_LABELS = ["bloqueado", "disponible"];
// Los secretos de Actions tienen un límite de 64 KiB; dejamos margen para el base64.
const MAX_HINTS_BYTES = 45_000;

const Milestone = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
});

const Issue = z.object({
  id: z.number().int().positive(),
  milestone: z.string(),
  title: z.string().min(1),
  labels: z.array(z.string()).default([]),
  deps: z.array(z.number().int()).default([]),
  body: z.string().min(1),
  test: z.string().trim().min(1, "todo issue necesita `test`; si no se puede testear, reformulalo"),
  hints: z.array(z.string()).default([]),
});

const CourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  image: z.string().min(1),
  setup: z.string().default(""),
  topics: z.array(z.string()).default([]),
  /** Quién lo escribió: "human" si lo armó una persona a mano, "ai" si lo escribió un asistente con el MCP. */
  origin: z.enum(["human", "ai"]).optional(),
  author: z.string().optional(),
  milestones: z.array(Milestone).min(1),
  issues: z.array(Issue).min(1),
});

export type Course = z.infer<typeof CourseSchema>;
export type CourseIssue = z.infer<typeof Issue>;

export interface Source {
  slug: string;
  /** Commit del repo fuente que se cargó. */
  sha: string;
  course?: Course;
  /** Todos los archivos del repo fuente. */
  files: Map<string, Buffer>;
  errors: string[];
  warnings: string[];
}

export const VERIFY_CONTEXT = "byox/verify";

/** Si `sha` del repo fuente pasó la verificación (el commit status que deja verify_course). */
export async function isVerified(fj: Forgejo, org: string, slug: string, sha: string): Promise<boolean> {
  const statuses = await fj.all<any>(`/repos/${org}/${slug}/commits/${sha}/statuses`);
  return statuses.find((s) => s.context === VERIFY_CONTEXT)?.status === "success";
}

export async function loadSource(fj: Forgejo, org: string, slug: string): Promise<Source> {
  const branch = await fj.find<any>(`/repos/${org}/${slug}/branches/main`);
  const src: Source = { slug, sha: branch?.commit?.id ?? "", files: new Map(), errors: [], warnings: [] };
  if (!src.sha) {
    src.errors.push(`El repo ${org}/${slug} no existe o está vacío.`);
    return src;
  }
  const tree = await fj.tree(org, slug, src.sha);
  await Promise.all([...tree.keys()].map(async (p) => src.files.set(p, await fj.raw(org, slug, p, src.sha))));
  validate(src);
  return src;
}

/** Un curso armado con archivos que no están en Forgejo (por ejemplo, uno importado), validado igual. */
export function sourceFromFiles(slug: string, files: Map<string, Buffer>): Source {
  const src: Source = { slug, sha: "", files, errors: [], warnings: [] };
  validate(src);
  return src;
}

/** Archivos con prefijo `dir/`, sin el prefijo. */
export function under(src: Source, dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const [p, c] of src.files) if (p.startsWith(`${dir}/`)) out.set(p.slice(dir.length + 1), c);
  return out;
}

function validate(src: Source) {
  const { errors, warnings, files } = src;
  const yamlText = files.get("course.yaml")?.toString("utf8");
  if (yamlText === undefined) {
    errors.push("Falta course.yaml en la raíz.");
    return;
  }
  let data: unknown;
  try {
    data = parse(yamlText);
  } catch (e) {
    errors.push(`course.yaml no es YAML válido: ${(e as Error).message}`);
    return;
  }
  const parsed = CourseSchema.safeParse(data);
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors.push(`course.yaml: ${i.path.join(".") || "(raíz)"}: ${i.message}`);
    return;
  }
  const course = parsed.data;

  const msIds = new Set<string>();
  for (const m of course.milestones) {
    if (msIds.has(m.id)) errors.push(`Milestone duplicado: ${m.id}`);
    msIds.add(m.id);
  }

  course.issues.forEach((i, k) => {
    const where = `issue ${i.id}`;
    if (i.id !== k + 1) errors.push(`Los ids van de 1 a N en orden: en la posición ${k + 1} hay ${i.id}.`);
    if (!msIds.has(i.milestone)) errors.push(`${where}: el milestone "${i.milestone}" no existe.`);
    if (!files.has(i.body)) errors.push(`${where}: no existe el archivo ${i.body}.`);
    for (const d of i.deps) {
      if (d === i.id) errors.push(`${where}: depende de sí mismo.`);
      else if (d < 1 || d > course.issues.length) errors.push(`${where}: depende de ${d}, que no existe.`);
    }
    for (const l of i.labels) if (RESERVED_LABELS.includes(l)) errors.push(`${where}: el label "${l}" está reservado.`);
    if (i.hints.length === 0) warnings.push(`${where}: no tiene pistas.`);
  });

  const cycle = findCycle(course.issues);
  if (cycle) errors.push(`El grafo tiene un ciclo: ${cycle.join(" -> ")}`);

  for (const m of course.milestones) {
    if (!course.issues.some((i) => i.milestone === m.id)) warnings.push(`El milestone "${m.id}" no tiene issues.`);
  }
  if (!course.issues.some((i) => i.deps.length === 0)) errors.push("Ningún issue arranca disponible (todos tienen deps).");

  const hintsSize = Buffer.byteLength(JSON.stringify(hintsOf(course)));
  if (hintsSize > MAX_HINTS_BYTES) errors.push(`Las pistas ocupan ${hintsSize} bytes; el máximo es ${MAX_HINTS_BYTES}.`);

  if (!files.has("README.md")) warnings.push("Falta README.md en la raíz: es la portada del curso.");
  if (files.has("files/README.md")) errors.push("files/README.md se pisaría: la portada va en README.md de la raíz.");

  const shipped = [...files.keys()].filter((p) => p.startsWith("files/"));
  if (shipped.length === 0) warnings.push("files/ está vacío: el alumno arranca sin esqueleto.");
  if (![...files.keys()].some((p) => p.startsWith("solution/"))) {
    errors.push("Falta solution/: una implementación de referencia real que pase todos los tests.");
  }
  for (const p of files.keys()) {
    if (/^(files|solution)\/\.(course|forgejo)\//.test(p)) errors.push(`${p}: .course/ y .forgejo/ los genera byox.`);
  }

  if (errors.length === 0) src.course = course;
}

function findCycle(issues: CourseIssue[]): number[] | null {
  const deps = new Map(issues.map((i) => [i.id, i.deps]));
  const color = new Map<number, 1 | 2>();
  const stack: number[] = [];
  const visit = (n: number): number[] | null => {
    if (color.get(n) === 2) return null;
    if (color.get(n) === 1) return [...stack.slice(stack.indexOf(n)), n];
    color.set(n, 1);
    stack.push(n);
    for (const d of deps.get(n) ?? []) {
      const c = visit(d);
      if (c) return c;
    }
    stack.pop();
    color.set(n, 2);
    return null;
  };
  for (const i of issues) {
    const c = visit(i.id);
    if (c) return c;
  }
  return null;
}

export function hintsOf(course: Course): Record<number, string[]> {
  return Object.fromEntries(course.issues.map((i) => [i.id, i.hints]));
}
