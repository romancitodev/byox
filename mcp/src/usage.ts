import type { Db, Table } from "./store.js";

/**
 * Cuánto usa cada cuenta, para medir antes de fijar los límites de los planes de la nube. Por ahora sólo cuenta:
 * no corta a nadie. Llamadas al MCP por semana y cursos empezados por mes. Los minutos de runner no se miden acá
 * (los tiene Forgejo, en las tareas de Actions).
 */
export class Usage {
  private calls: Table<number>;
  private courses: Table<string[]>;

  constructor(db: Db) {
    this.calls = db.table("usage-calls");
    this.courses = db.table("usage-courses");
  }

  /** Semana ISO en UTC: "2026-W41". */
  static week(d = new Date()): string {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); // el jueves de esa semana decide el año
    const year = t.getUTCFullYear();
    const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  static month(d = new Date()): string {
    return d.toISOString().slice(0, 7);
  }

  /** Llamadas a herramientas del MCP (`tools/call`). */
  async call(user: string, n = 1) {
    await this.calls.incr(`${user}:${Usage.week()}`, n);
  }

  /** Un curso empezado este mes. Empezarlo de nuevo (reset) no cuenta dos veces. */
  async course(user: string, slug: string) {
    const key = `${user}:${Usage.month()}`;
    const have = (await this.courses.get(key)) ?? [];
    if (!have.includes(slug)) await this.courses.set(key, [...have, slug]);
  }

  async summary(user: string) {
    const week = Usage.week();
    const month = Usage.month();
    return {
      week,
      mcpCalls: (await this.calls.get(`${user}:${week}`)) ?? 0,
      month,
      activeCourses: (await this.courses.get(`${user}:${month}`)) ?? [],
    };
  }
}
