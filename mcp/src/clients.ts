import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

const DIR = process.env.BYOX_DATA ?? "/data";
const FILE = join(DIR, "mcp-client.json");
/** Sin requests en este rato, el cliente ya no cuenta como activo. */
const ACTIVE_MS = 15 * 60_000;

export class Clients {
  /** Por usuario: cada persona conecta su propio asistente. */
  private data: Record<string, Seen> = {};
  private loaded = readFile(FILE, "utf8")
    .then((t) => {
      const d = JSON.parse(t);
      // El formato viejo era de un solo usuario: se descarta.
      this.data = d && typeof d === "object" && !("lastSeen" in d) ? d : {};
    })
    .catch(() => {});
  private saving: NodeJS.Timeout | undefined;

  /** Registra los mensajes JSON-RPC de un POST a /mcp (uno o un lote). */
  async seen(user: string, body: unknown) {
    await this.loaded;
    const mine = (this.data[user] ??= {});
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
    clearTimeout(this.saving);
    this.saving = setTimeout(() => {
      mkdir(DIR, { recursive: true })
        .then(() => writeFile(FILE, JSON.stringify(this.data)))
        .catch((e) => console.error("mcp-client:", e.message));
    }, 2000);
  }

  async status(user: string) {
    await this.loaded;
    const mine = this.data[user] ?? {};
    const last = mine.lastSeen ? Date.parse(mine.lastSeen) : 0;
    const state = !last ? "never" : Date.now() - last < ACTIVE_MS ? "active" : "idle";
    return { state, ...mine };
  }
}
