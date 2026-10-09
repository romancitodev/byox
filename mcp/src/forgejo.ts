import { createHash } from "node:crypto";

/** El sha que git le da a un blob con este contenido. */
export const blobSha = (b: Buffer) =>
  createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");

export class ForgejoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class Forgejo {
  constructor(private base: string, private token: string, private sudo?: string) {}

  /** El mismo cliente actuando como `user` (hace falta un token de administrador). Lo que crea queda a su nombre. */
  as(user: string): Forgejo {
    return new Forgejo(this.base, this.token, user);
  }

  /** Valida usuario y contraseña contra Forgejo. Devuelve la cuenta, o null si no coinciden. */
  async basic(user: string, password: string): Promise<any | null> {
    const res = await fetch(`${this.base}/api/v1/user`, {
      headers: { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`, Accept: "application/json" },
    });
    return res.ok ? res.json() : null;
  }

  private async fetch(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(`${this.base}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `token ${this.token}`,
        ...(this.sudo ? { Sudo: this.sudo } : {}),
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new ForgejoError(res.status, `${method} ${path} -> ${res.status}: ${await res.text()}`);
    return res;
  }

  async req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const text = await (await this.fetch(method, path, body)).text();
    return (text ? JSON.parse(text) : null) as T;
  }

  /** Como `req` pero devuelve null en 404. */
  async find<T = any>(path: string): Promise<T | null> {
    try {
      return await this.req<T>("GET", path);
    } catch (e) {
      if (e instanceof ForgejoError && e.status === 404) return null;
      throw e;
    }
  }

  async all<T = any>(path: string): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; ; page++) {
      const sep = path.includes("?") ? "&" : "?";
      const batch = await this.req<T[]>("GET", `${path}${sep}limit=50&page=${page}`);
      out.push(...batch);
      if (batch.length < 50) return out;
    }
  }

  /** Markdown -> HTML con el renderer de Forgejo (sanitizado y con resaltado de código). */
  async markdown(text: string, context: string): Promise<string> {
    const res = await this.fetch("POST", "/markdown", { Text: text, Mode: "gfm", Context: context });
    return res.text();
  }

  async raw(owner: string, repo: string, path: string, ref = "main"): Promise<Buffer> {
    const enc = path.split("/").map(encodeURIComponent).join("/");
    const res = await this.fetch("GET", `/repos/${owner}/${repo}/raw/${enc}?ref=${ref}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Blobs del árbol de `ref`: path -> sha. Vacío si el repo no tiene commits. */
  async tree(owner: string, repo: string, ref = "main"): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (let page = 1; ; page++) {
      const t = await this.find<any>(`/repos/${owner}/${repo}/git/trees/${ref}?recursive=true&per_page=1000&page=${page}`);
      if (!t) return out;
      for (const e of t.tree ?? []) if (e.type === "blob") out.set(e.path, e.sha);
      if (!t.truncated) return out;
    }
  }

  /** Un commit con varios archivos. `null` borra el archivo. Devuelve el sha del commit, o null si no había cambios. */
  async commit(owner: string, repo: string, files: Record<string, Buffer | string | null>, message: string): Promise<string | null> {
    const existing = await this.tree(owner, repo);
    const ops = [];
    for (const [path, content] of Object.entries(files)) {
      const sha = existing.get(path);
      if (content === null) {
        if (sha) ops.push({ operation: "delete", path, sha });
        continue;
      }
      const buf = Buffer.from(content);
      if (sha === blobSha(buf)) continue; // sin cambios
      ops.push({ operation: sha ? "update" : "create", path, sha, content: buf.toString("base64") });
    }
    if (ops.length === 0) return null;
    const res = await this.req<any>("POST", `/repos/${owner}/${repo}/contents`, { branch: "main", message, files: ops });
    return res?.commit?.sha ?? null;
  }
}
