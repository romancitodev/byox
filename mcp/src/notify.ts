/**
 * Avisos a un canal de Discord por webhook. Sin DISCORD_WEBHOOK_URL no hace nada, y enviar nunca rompe a quien
 * lo llama: falla en silencio (con una línea en el log). Cola con ritmo, para no pasarse del límite de Discord,
 * y los avisos repetidos dentro de unos minutos se agrupan en uno solo.
 *
 * Lo que llega por acá puede traer texto de usuarios (nombres de cursos, mensajes de error): se limpia de
 * tokens y contraseñas, se recorta, y `allowed_mentions` impide que alguien dispare @everyone en tu canal.
 */
export type Level = "info" | "warn" | "error";
/** system: arranque, parada y servicios caídos. signup: cuentas nuevas. course: cursos creados. verify: resultado de verify_course.
 *  start: alguien empezó un curso (ruidoso, apagado por defecto). security: intentos sospechosos. error: fallos del servidor. */
export type Category = "system" | "signup" | "course" | "verify" | "start" | "security" | "error";

const DEFAULT_EVENTS = "system,signup,course,verify,security,error";
const WEBHOOK = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const COLORS: Record<Level, number> = { info: 0x3ba55d, warn: 0xfaa61a, error: 0xed4245 };
const ICONS: Record<Category, string> = { system: "🖥️", signup: "👤", course: "📚", verify: "🧪", start: "🚀", security: "🔐", error: "🔥" };
const DEDUP_MS = 5 * 60_000;
const MAX_QUEUE = 25;

export interface NotifyOptions {
  url?: string;
  /** Categorías separadas por coma, o "all". */
  events?: string;
  /** ID de usuario de Discord al que mencionar en los errores. */
  pingUser?: string;
  /** Etiqueta del pie: qué instancia manda el aviso. */
  name?: string;
  /** Para los tests. */
  fetch?: typeof fetch;
  /** Milisegundos entre mensajes. */
  gap?: number;
}

interface Payload {
  username: string;
  content?: string;
  allowed_mentions: { parse: []; users: string[] };
  embeds: unknown[];
}

/** Saca de un texto lo que no debe salir del servidor, quita caracteres de control y lo recorta. */
export function clean(s: unknown, max = 1000): string {
  const t = String(s ?? "")
    .replace(/https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/gi, "[webhook]")
    .replace(/\bbyox_[A-Za-z0-9_-]{8,}/g, "byox_…")
    .replace(/\b(Bearer|token|password|contraseña|secret)(\s*[=:]?\s+|=)[^\s"']{6,}/gi, "$1 …")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://…")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export class Notifier {
  readonly enabled: boolean;
  private events: Set<string>;
  private pingUser: string;
  private name: string;
  private doFetch: typeof fetch;
  private gap: number;
  private url: string;
  private queue: Payload[] = [];
  private dropped = 0;
  private pumping = false;
  private recent = new Map<string, { at: number; n: number }>();
  private idle: (() => void)[] = [];

  constructor(o: NotifyOptions = {}) {
    this.url = (o.url ?? "").trim();
    if (this.url && !WEBHOOK.test(this.url)) {
      console.error("DISCORD_WEBHOOK_URL no parece un webhook de Discord (https://discord.com/api/webhooks/<id>/<token>): los avisos quedan apagados.");
      this.url = "";
    }
    this.enabled = !!this.url;
    const raw = (o.events ?? "").trim() || DEFAULT_EVENTS;
    this.events = new Set(raw === "all" ? Object.keys(ICONS) : raw.split(",").map((e) => e.trim()).filter(Boolean));
    this.pingUser = /^\d{15,25}$/.test(o.pingUser ?? "") ? o.pingUser! : "";
    this.name = clean(o.name || "byox", 80);
    this.doFetch = o.fetch ?? fetch;
    this.gap = o.gap ?? 1500;
  }

  /**
   * Encola un aviso. `key` agrupa repeticiones (por defecto: categoría y título); los info no se agrupan.
   * Devuelve false si no se mandó (apagado, categoría desactivada o repetido).
   */
  send(cat: Category, level: Level, title: string, fields: Record<string, unknown> = {}, opts: { text?: string; key?: string } = {}): boolean {
    if (!this.enabled || !this.events.has(cat)) return false;
    if (this.queue.length >= MAX_QUEUE) {
      this.dropped++;
      return false;
    }
    const now = Date.now();
    const out: { name: string; value: string; inline: boolean }[] = [];
    if (level !== "info") {
      const key = opts.key ?? `${cat}|${title}`;
      const seen = this.recent.get(key);
      if (seen && now - seen.at < DEDUP_MS) {
        seen.n++;
        return false;
      }
      if (seen?.n) out.push({ name: "Repeticiones desde el aviso anterior", value: String(seen.n), inline: true });
      this.recent.set(key, { at: now, n: 0 });
      if (this.recent.size > 200) for (const [k, v] of this.recent) if (now - v.at > DEDUP_MS) this.recent.delete(k);
    }
    for (const [name, value] of Object.entries(fields).slice(0, 20)) {
      if (value === undefined || value === null || value === "") continue;
      out.push({ name: clean(name, 80), value: clean(value, 400) || "—", inline: true });
    }
    if (this.dropped) {
      out.push({ name: "Avisos descartados por exceso", value: String(this.dropped), inline: true });
      this.dropped = 0;
    }
    const ping = level === "error" && this.pingUser ? this.pingUser : "";
    this.queue.push({
      username: "byox",
      ...(ping ? { content: `<@${ping}>` } : {}),
      allowed_mentions: { parse: [], users: ping ? [ping] : [] },
      embeds: [
        {
          title: clean(`${ICONS[cat]} ${title}`, 250),
          ...(opts.text ? { description: clean(opts.text, 1500) } : {}),
          color: COLORS[level],
          fields: out,
          footer: { text: this.name },
          timestamp: new Date(now).toISOString(),
        },
      ],
    });
    void this.pump();
    return true;
  }

  /** Espera a que se vacíe la cola (o a que pase `ms`): para no perder el último aviso al apagar. */
  flush(ms = 3000): Promise<void> {
    if (!this.queue.length && !this.pumping) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      t.unref?.();
      this.idle.push(() => (clearTimeout(t), resolve()));
    });
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length) {
        const msg = this.queue.shift()!;
        await this.post(msg);
        if (this.queue.length) await new Promise((r) => setTimeout(r, this.gap));
      }
    } finally {
      this.pumping = false;
      for (const f of this.idle.splice(0)) f();
    }
  }

  private async post(msg: Payload) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.doFetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 429) {
          const wait = Number((await res.json().catch(() => ({})))?.retry_after ?? res.headers.get("retry-after") ?? 1);
          await new Promise((r) => setTimeout(r, Math.min(Math.max(wait, 0.5), 30) * 1000));
          continue;
        }
        if (!res.ok) console.error(`Discord respondió ${res.status}: aviso descartado.`);
        return;
      } catch (e) {
        if (attempt === 2) console.error(`No pude avisar a Discord: ${(e as Error).message}`);
      }
    }
  }
}

/** Lo que usa el servidor: se configura con el entorno. */
export const notify = new Notifier({
  url: process.env.DISCORD_WEBHOOK_URL,
  events: process.env.DISCORD_EVENTS,
  pingUser: process.env.DISCORD_PING_USER,
  name: process.env.BYOX_INSTANCE_NAME || (() => { try { return new URL(process.env.BYOX_WEB_URL ?? "").host; } catch { return "byox"; } })(),
});
