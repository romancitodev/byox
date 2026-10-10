import { HttpError } from "./auth.js";
import { isVerified } from "./course.js";
import type { Forgejo } from "./forgejo.js";
import { notify } from "./notify.js";

/**
 * Quién puede hacer qué con cada curso. No hay una tabla propia: la visibilidad, los permisos y las estrellas
 * son los de Forgejo sobre el repo fuente del curso (`<org>/<slug>`). Se le pregunta a Forgejo como si fuera cada
 * persona (cabecera Sudo), así que lo que acá se ve es exactamente lo que Forgejo le deja ver:
 *
 * - privado (por defecto): lo ven quien lo creó, quienes agregues como colaboradores y los administradores.
 * - público: lo ve y puede empezarlo cualquier cuenta de la instancia. Es el flag `private` del repo.
 * - estrella: la estrella de Forgejo de esa cuenta sobre el repo; `stars_count` es el total.
 * - dueño: quien tiene permiso de administrador sobre el repo. Quien crea un curso queda como dueño.
 */
export interface CourseAccess {
  slug: string;
  description: string;
  updatedAt: string;
  public: boolean;
  stars: number;
  /** Puede cambiar sus archivos y verificarlo. */
  write: boolean;
  /** Puede cambiar su visibilidad. */
  manage: boolean;
}

export type Need = "see" | "write" | "manage";

const SLUG = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const TTL_MS = 4000;

export class Catalog {
  private seen = new Map<string, { at: number; p: Promise<CourseAccess | null> }>();
  private stars = new Map<string, { at: number; p: Promise<Set<string>> }>();

  constructor(private fj: Forgejo, private org: string) {}

  private memo<T>(map: Map<string, { at: number; p: Promise<T> }>, key: string, make: () => Promise<T>): Promise<T> {
    const hit = map.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
    const p = make();
    map.set(key, { at: Date.now(), p });
    p.catch(() => map.delete(key));
    return p;
  }

  /** Se llama después de cambiar algo (visibilidad, estrella, un curso nuevo) para que no se sirva lo viejo. */
  bust() {
    this.seen.clear();
    this.stars.clear();
  }

  /** Lo que Forgejo le deja hacer a `user` con el curso; null si no existe o no lo puede ver. */
  access(user: string, slug: string): Promise<CourseAccess | null> {
    if (!SLUG.test(slug)) return Promise.resolve(null);
    return this.memo(this.seen, `${user}/${slug}`, async () => {
      const r = await this.fj.as(user).find<any>(`/repos/${this.org}/${slug}`);
      if (!r?.permissions?.pull) return null;
      return {
        slug: r.name,
        description: r.description ?? "",
        updatedAt: r.updated_at,
        public: !r.private,
        stars: r.stars_count ?? 0,
        write: !!r.permissions.push,
        manage: !!r.permissions.admin,
      };
    });
  }

  /** Como `access`, pero corta con 404 si no lo ve (sin revelar que existe) o 403 si le falta el permiso. */
  async need(user: string, slug: string, need: Need): Promise<CourseAccess> {
    const a = await this.access(user, slug);
    if (!a) throw new HttpError(404, `No existe el curso ${slug}.`);
    if (need === "write" && !a.write) throw new HttpError(403, `No puedes modificar el curso ${slug}: es de otra persona.`);
    if (need === "manage" && !a.manage) throw new HttpError(403, "Solo quien creó el curso, o un administrador, puede cambiar su visibilidad.");
    return a;
  }

  /** Los cursos que `user` puede ver. */
  async list(user: string): Promise<CourseAccess[]> {
    const names = await this.names();
    return (await Promise.all(names.map((n) => this.access(user, n)))).filter((a): a is CourseAccess => !!a);
  }

  /** Todos los repos fuente, vea quien vea. Para uso interno: nunca se le muestra tal cual a una cuenta. */
  async names(): Promise<string[]> {
    return (await this.fj.all<any>(`/orgs/${this.org}/repos`)).map((r) => r.name as string);
  }

  /** Slugs de los cursos con tu estrella. */
  starred(user: string): Promise<Set<string>> {
    return this.memo(this.stars, user, async () => {
      const repos = await this.fj.as(user).all<any>("/user/starred");
      return new Set(repos.filter((r) => r.owner?.login === this.org).map((r) => r.name as string));
    });
  }

  /** Pone o saca tu estrella. Forgejo sólo deja estrellar lo que ves. */
  async star(user: string, slug: string, on: boolean): Promise<{ starred: boolean; stars: number }> {
    await this.need(user, slug, "see");
    await this.fj.as(user).req(on ? "PUT" : "DELETE", `/user/starred/${this.org}/${slug}`);
    this.bust();
    return { starred: on, stars: (await this.access(user, slug))?.stars ?? 0 };
  }

  /** Publica o vuelve privado un curso. Sólo su dueño; y para publicarlo, el último commit tiene que estar verificado. */
  async setPublic(user: string, slug: string, on: boolean): Promise<CourseAccess> {
    const a = await this.need(user, slug, "manage");
    if (a.public === on) return a;
    if (on) {
      const head = await this.fj.find<any>(`/repos/${this.org}/${slug}/branches/main`);
      const sha = head?.commit?.id as string | undefined;
      if (!sha || !(await isVerified(this.fj, this.org, slug, sha))) {
        throw new HttpError(400, "El último commit del curso no está verificado: verifícalo antes de publicarlo, así nadie ve un curso que no se puede empezar.");
      }
    }
    // Lo hace Forgejo como esa persona: si no fuera dueña, rechaza el cambio él mismo.
    await this.fj.as(user).req("PATCH", `/repos/${this.org}/${slug}`, { private: !on });
    this.bust();
    notify.send("course", "info", on ? "Curso publicado" : "Curso vuelto privado", { Curso: slug, Usuario: user });
    return (await this.access(user, slug))!;
  }

  /** Deja a `user` como dueño de un curso que acaba de crear (colaborador con permiso de administrador del repo). */
  async claim(user: string, slug: string): Promise<void> {
    this.bust();
    // Los administradores ya lo administran todo; no hace falta agregarlos.
    if ((await this.access(user, slug))?.manage) return;
    await this.fj.req("PUT", `/repos/${this.org}/${slug}/collaborators/${encodeURIComponent(user)}`, { permission: "admin" });
    this.bust();
  }
}

/**
 * La organización de cursos tiene que ser «limited» (visible sólo para cuentas con sesión): con «private», un repo
 * público no lo ve nadie fuera de la org y las estrellas no funcionan. Los repos que siguen privados no cambian.
 */
export async function ensureOrgVisibility(fj: Forgejo, org: string): Promise<void> {
  const o = await fj.find<any>(`/orgs/${org}`);
  if (o && o.visibility === "private") {
    await fj.req("PATCH", `/orgs/${org}`, { visibility: "limited" });
    console.log(`organización ${org}: visibilidad private -> limited (para poder publicar cursos)`);
  }
}
