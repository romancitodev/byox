import type { Db, Table } from "./store.js";

/**
 * Quién usó el MCP por última vez. El servidor no tiene sesiones (un transporte por request),
 * así que "conectado" se infiere de la actividad: el `initialize` dice qué cliente es
 * (Claude Code se presenta como "claude-code") y cada `tools/call`, qué herramienta usó.
 */
interface Seen {
  client?: { name: string; version?: string };
  firstSeen?: string;
  lastSeen?: string;
  lastTool?: { name: string; at: string };
}

/** Sin requests en este rato, el cliente ya no cuenta como activo. */
const ACTIVE_MS = 15 * 60_000;

export class Clients {
  /** Por usuario: cada persona conecta su propio asistente. */
  private table: Table<Seen>;
  private cache = new Map<string, Seen>();
  private dirty = new Set<string>();
  private saving: NodeJS.Timeout | undefined;

  constructor(db: Db) {
    this.table = db.table("mcp-client");
  }

  private async load(user: string): Promise<Seen> {
    let mine = this.cache.get(user);
    if (!mine) {
      const stored = await this.table.get(user);
      // Puede haber llegado otro request mientras se leía: gana el que ya estaba en la caché.
      mine = this.cache.get(user) ?? (stored && typeof stored === "object" ? stored : {});
      this.cache.set(user, mine);
    }
    return mine;
  }

  /** Registra los mensajes JSON-RPC de un POST a /mcp (uno o un lote). */
  async seen(user: string, body: unknown) {
    const mine = await this.load(user);
    const now = new Date().toISOString();
    for (const m of Array.isArray(body) ? body : [body]) {
      if (!m || typeof m !== "object") continue;
      const { method, params } = m as { method?: string; params?: any };
      if (method === "initialize" && params?.clientInfo?.name) {
        mine.client = { name: String(params.clientInfo.name), version: params.clientInfo.version };
      }
      if (method === "tools/call" && params?.name) mine.lastTool = { name: String(params.name), at: now };
    }
    mine.firstSeen ??= now;
    mine.lastSeen = now;
    // Varias requests seguidas se guardan una sola vez.
    this.dirty.add(user);
    clearTimeout(this.saving);
    this.saving = setTimeout(() => {
      const users = [...this.dirty];
      this.dirty.clear();
      Promise.all(users.map((u) => this.table.set(u, this.cache.get(u)!))).catch((e) => console.error("mcp-client:", e.message));
    }, 2000);
  }

  async status(user: string) {
    const mine = await this.load(user);
    const last = mine.lastSeen ? Date.parse(mine.lastSeen) : 0;
    const state = !last ? "never" : Date.now() - last < ACTIVE_MS ? "active" : "idle";
    return { state, ...mine };
  }
}
