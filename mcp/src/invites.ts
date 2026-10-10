import { createHash, randomBytes } from "node:crypto";
import type { Table } from "./store.js";

/**
 * Códigos de invitación. Cada uno puede vencer, servir para una o varias cuentas (o para todas las que
 * quieran) y recuerda quién se registró con él. Sólo se guarda el hash: el código se ve completo una vez, al crearlo.
 */
export interface Invite {
  by: string;
  created: string;
  note?: string;
  /** ISO. Sin valor, no vence. */
  expires?: string;
  /** Cuántas cuentas puede crear. Los códigos viejos no lo traen y valen una; `null` es ilimitado. */
  max?: number | null;
  uses?: { user: string; at: string }[];
  revoked?: boolean;
}

export type InviteState = "active" | "used" | "expired" | "revoked";

export interface InviteView {
  /** Para revocar: el comienzo del hash (el código en sí no se guarda). */
  id: string;
  note: string | null;
  by: string;
  created: string;
  expires: string | null;
  /** null: ilimitado. */
  max: number | null;
  used: number;
  state: InviteState;
  uses: { user: string; at: string }[];
}

export type InviteProblem = "invalid" | "expired" | "exhausted" | "ttl" | "max";
export class InviteError extends Error {
  constructor(readonly reason: InviteProblem) {
    super(reason);
  }
}

export const MAX_TTL_HOURS = 24 * 365;
export const MAX_USES = 1000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export class Invites {
  /** Cola de canjes: dos personas con el último cupo no pueden pasar a la vez. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private table: Table<Invite>, private now: () => number = Date.now) {}

  private limit(i: Invite): number | null {
    return i.max === undefined ? 1 : i.max;
  }

  private state(i: Invite): InviteState {
    if (i.revoked) return "revoked";
    if (i.expires && Date.parse(i.expires) <= this.now()) return "expired";
    const max = this.limit(i);
    if (max !== null && (i.uses?.length ?? 0) >= max) return "used";
    return "active";
  }

  private view(key: string, i: Invite): InviteView {
    return {
      id: key.slice(0, 12),
      note: i.note ?? null,
      by: i.by,
      created: i.created,
      expires: i.expires ?? null,
      max: this.limit(i),
      used: i.uses?.length ?? 0,
      state: this.state(i),
      uses: i.uses ?? [],
    };
  }

  /**
   * Crea un código. `ttlHours`: horas de vida (sin valor o null, no vence). `max`: cuántas cuentas
   * (sin valor, una; null, ilimitado).
   */
  async create(by: string, o: { note?: string; ttlHours?: number | null; max?: number | null } = {}): Promise<{ code: string; id: string }> {
    let expires: string | undefined;
    if (o.ttlHours !== undefined && o.ttlHours !== null) {
      if (!Number.isFinite(o.ttlHours) || o.ttlHours < 1 || o.ttlHours > MAX_TTL_HOURS) throw new InviteError("ttl");
      expires = new Date(this.now() + o.ttlHours * 3_600_000).toISOString();
    }
    let max: number | null = 1;
    if (o.max === null) max = null;
    else if (o.max !== undefined) {
      if (!Number.isInteger(o.max) || o.max < 1 || o.max > MAX_USES) throw new InviteError("max");
      max = o.max;
    }
    const code = `inv_${randomBytes(12).toString("hex")}`;
    const note = String(o.note ?? "").trim().slice(0, 80) || undefined;
    await this.table.set(sha(code), { by, created: new Date(this.now()).toISOString(), note, expires, max, uses: [] });
    return { code, id: sha(code).slice(0, 12) };
  }

  /** Los más nuevos primero. */
  async list(): Promise<InviteView[]> {
    const rows = await this.table.entries();
    return rows.map(([k, i]) => this.view(k, i)).sort((a, b) => b.created.localeCompare(a.created));
  }

  /** Deja de servir. Si alguien ya se registró con él, queda en la lista (con quiénes); si no, se borra. */
  async revoke(id: string): Promise<boolean> {
    const found = (await this.table.entries()).find(([k]) => k.startsWith(id));
    if (!found) return false;
    const [key, inv] = found;
    if (inv.uses?.length) await this.table.set(key, { ...inv, revoked: true });
    else await this.table.del(key);
    return true;
  }

  /**
   * Canjea un código: comprueba que sirva, corre `make` (que crea la cuenta y devuelve el usuario) y recién
   * entonces anota el uso. Si `make` falla, el código no se gasta.
   */
  redeem(code: string, make: () => Promise<string>): Promise<{ user: string; note: string | null }> {
    const run = async () => {
      const clean = String(code ?? "").trim();
      const key = sha(clean);
      const inv = clean ? await this.table.get(key) : undefined;
      if (!inv || inv.revoked) throw new InviteError("invalid");
      const state = this.state(inv);
      if (state === "expired") throw new InviteError("expired");
      if (state === "used") throw new InviteError("exhausted");
      const user = await make();
      await this.table.set(key, { ...inv, uses: [...(inv.uses ?? []), { user, at: new Date(this.now()).toISOString() }] });
      return { user, note: inv.note ?? null };
    };
    const p = this.queue.then(run);
    this.queue = p.then(() => undefined, () => undefined);
    return p;
  }
}
