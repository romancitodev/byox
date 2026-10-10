import type { Db, Table } from "./store.js";

/**
 * Cuánto usa cada cuenta: llamadas al MCP por semana y cursos empezados por mes. Las llamadas tienen tope semanal
 * (`take`); los cursos sólo se cuentan, para medir antes de fijar los límites de los planes de la nube. Los minutos
 * de runner no se miden acá (los tiene Forgejo, en las tareas de Actions).
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

  /** Cuándo empieza la semana siguiente (lunes 00:00 UTC): cuando se vuelve a llenar el cupo. */
  static nextWeek(d = new Date()): Date {
    const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return new Date(t + (8 - (d.getUTCDay() || 7)) * 86_400_000);
  }

  /** Llamadas a herramientas del MCP (`tools/call`). */
  async call(user: string, n = 1) {
    await this.calls.incr(`${user}:${Usage.week()}`, n);
  }

  /**
   * Gasta `n` llamadas del cupo semanal; sin `limit` (null) no hay tope y sólo cuenta. Suma y, si se pasó,
   * lo devuelve: así dos requests a la vez no se cuelan, y una rechazada no gasta nada.
   */
  async take(user: string, n: number, limit: number | null, now = new Date()): Promise<{ ok: boolean; used: number }> {
    const key = `${user}:${Usage.week(now)}`;
    const used = await this.calls.incr(key, n);
    if (limit === null || used <= limit) return { ok: true, used };
    await this.calls.incr(key, -n);
    return { ok: false, used: used - n };
  }

  /** Un curso empezado este mes. Empezarlo de nuevo (reset) no cuenta dos veces. */
  async course(user: string, slug: string) {
    const key = `${user}:${Usage.month()}`;
    const have = (await this.courses.get(key)) ?? [];
    if (!have.includes(slug)) await this.courses.set(key, [...have, slug]);
  }

  async summary(user: string, limit: number | null = null) {
    const week = Usage.week();
    const month = Usage.month();
    const mcpCalls = (await this.calls.get(`${user}:${week}`)) ?? 0;
    return {
      week,
      mcpCalls,
      /** Tope semanal de llamadas; null si esta cuenta no tiene. */
      mcpLimit: limit,
      mcpRemaining: limit === null ? null : Math.max(0, limit - mcpCalls),
      mcpResetsAt: Usage.nextWeek().toISOString(),
      month,
      activeCourses: (await this.courses.get(`${user}:${month}`)) ?? [],
    };
  }
}
