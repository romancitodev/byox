import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Forgejo } from "./forgejo.js";
import { notify } from "./notify.js";
import type { Db, Table } from "./store.js";

/**
 * Cuentas reales. La identidad es un usuario de Forgejo: byox no guarda contraseñas, las valida contra
 * Forgejo. Para la web hay una sesión (cookie HttpOnly, guardada en el servidor); para el MCP y el CLI,
 * tokens personales `byox_…` que cada persona crea desde su cuenta y que acá sólo se guardan hasheados.
 */
export type SignupMode = "open" | "invite" | "closed";

export interface Principal {
  user: string;
  admin: boolean;
  via: "session" | "token";
}

export interface AuthConfig {
  bot: string;
  org: string;
  signup: SignupMode;
  /** Se confía en X-Forwarded-* (detrás de un proxy). */
  trustProxy: boolean;
  /** Fuerza la cookie `Secure`; si no, se deduce de X-Forwarded-Proto. */
  secureCookies: boolean;
}

const COOKIE = "byox_session";
const SESSION_MS = 14 * 86_400_000;
const TOKEN_PREFIX = "byox_";
const RESERVED = new Set(["admin", "root", "api", "app", "docs", "cursos", "byox", "bot", "support", "soporte", "static", "assets"]);
const USERNAME = /^[a-z0-9][a-z0-9_.-]{1,38}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const rand = (n: number) => randomBytes(n).toString("base64url");

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Idioma que pide el cliente: la cabecera X-Byox-Lang (la elige la app) o, si no, Accept-Language. */
export function langOf(req: IncomingMessage): "es" | "en" {
  const own = String(req.headers["x-byox-lang"] ?? "").toLowerCase();
  if (own === "en" || own === "es") return own;
  return /^en\b/i.test(String(req.headers["accept-language"] ?? "")) ? "en" : "es";
}

const EN: Record<string, string> = {
  "Demasiados intentos. Espera unos minutos y vuelve a probar.": "Too many attempts. Wait a few minutes and try again.",
  "Usuario o contraseña incorrectos.": "Incorrect username or password.",
  "El registro está cerrado en esta instancia.": "Sign-ups are closed on this instance.",
  "Demasiados registros desde esta red. Prueba más tarde.": "Too many sign-ups from this network. Try again later.",
  "Necesitas un código de invitación válido.": "You need a valid invitation code.",
  "Usuario no válido: usa 2 a 39 letras minúsculas, números, '.', '-' o '_'.": "Invalid username: use 2 to 39 lowercase letters, numbers, '.', '-' or '_'.",
  "Escribe un correo válido.": "Enter a valid email address.",
  "Ese usuario ya existe.": "That username is already taken.",
  "Ese correo ya está en uso.": "That email is already in use.",
  "No pude crear la cuenta.": "Could not create the account.",
  "Inicia sesión.": "Sign in.",
  "Cambia la contraseña desde la web.": "Change your password from the web app.",
  "La contraseña actual no es correcta.": "The current password is incorrect.",
  "Crea tokens desde la web.": "Create tokens from the web app.",
  "Ya tienes 20 tokens. Revoca alguno.": "You already have 20 tokens. Revoke one.",
  "No existe ese token.": "That token does not exist.",
  "Sólo un administrador puede invitar.": "Only an administrator can invite.",
  "Sólo un administrador puede ver las invitaciones.": "Only an administrator can view invitations.",
  "No encontrado.": "Not found.",
  "Error interno.": "Internal error.",
  "Origen no permitido.": "Origin not allowed.",
  "Demasiado grande.": "Payload too large.",
  "El cuerpo no es JSON.": "The request body is not JSON.",
};

/** El mensaje en el idioma del cliente (el español es el original). */
export function localize(msg: string, req: IncomingMessage): string {
  if (langOf(req) === "es") return msg;
  const min = /^La contraseña necesita al menos (\d+) caracteres\.$/.exec(msg);
  if (min) return `The password needs at least ${min[1]} characters.`;
  return EN[msg] ?? msg;
}

interface Session { u: string; exp: number }
interface Pat { u: string; name: string; created: string; last?: string }
interface Invite { by: string; created: string; note?: string }

/** Ventanas de intentos por clave, para frenar fuerza bruta y abuso del registro. */
class Limiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  /** true si todavía hay cupo (y lo consume). */
  take(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
  reset(key: string) {
    this.hits.delete(key);
  }
}

export class Auth {
  private sessions: Table<Session>;
  private tokens: Table<Pat>;
  private invites: Table<Invite>;
  private secret = "";
  private seen = new Map<string, { at: number; admin: boolean; ok: boolean }>();
  private logins = new Limiter(8, 10 * 60_000);
  private signups = new Limiter(10, 3_600_000);

  constructor(private fj: Forgejo, private cfg: AuthConfig, db: Db) {
    this.db = db;
    this.sessions = db.table("sessions");
    this.tokens = db.table("tokens");
    this.invites = db.table("invites");
  }
  private db: Db;

  async init() {
    this.secret = process.env.BYOX_SECRET || (await this.db.secret("secret", () => randomBytes(32).toString("hex")));
    await this.purge();
    setInterval(() => this.purge().catch((e) => console.error("sesiones:", e.message)), 3_600_000).unref();
  }

  /** Borra las sesiones vencidas. */
  private async purge() {
    const now = Date.now();
    for (const [k, s] of await this.sessions.entries()) if (s.exp < now) await this.sessions.del(k);
  }

  get signupMode() {
    return this.cfg.signup;
  }

  /** Secreto propio de cada repo para los avisos del CI a /hooks: si un alumno lo filtra, sólo vale para su repo. */
  hookToken(repo: string): string {
    return createHmac("sha256", this.secret).update(`hook:${repo}`).digest("hex");
  }
  checkHook(repo: string, given: string | undefined): boolean {
    if (!given) return false;
    const a = Buffer.from(this.hookToken(repo));
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  /** El secreto del webhook que Forgejo manda al publicar en un repo fuente. */
  get webhookSecret() {
    return createHmac("sha256", this.secret).update("webhook:source").digest("hex");
  }
  checkSignature(raw: string, header: string | undefined): boolean {
    if (!header) return false;
    const want = createHmac("sha256", this.webhookSecret).update(raw).digest("hex");
    const got = header.replace(/^sha256=/, "");
    return want.length === got.length && timingSafeEqual(Buffer.from(want), Buffer.from(got));
  }

  /** Quién hace la request: la sesión de la cookie o un token personal. null si nadie. */
  async principal(req: IncomingMessage): Promise<Principal | null> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization ?? ""))?.[1];
    if (bearer?.startsWith(TOKEN_PREFIX)) {
      const key = sha(bearer);
      const pat = await this.tokens.get(key);
      if (!pat) return null;
      const info = await this.lookup(pat.u);
      if (!info.ok) return null;
      if (!pat.last || Date.now() - Date.parse(pat.last) > 60_000) {
        pat.last = new Date().toISOString();
        this.tokens.set(key, pat).catch((e) => console.error("auth:", e.message));
      }
      return { user: pat.u, admin: info.admin, via: "token" };
    }
    const id = parseCookies(req)[COOKIE];
    if (!id) return null;
    const s = await this.sessions.get(sha(id));
    if (!s || s.exp < Date.now()) return null;
    const info = await this.lookup(s.u);
    if (!info.ok) return null;
    // Sesión con cookie: las requests que cambian cosas tienen que venir de nuestra propia página.
    if (req.method && !/^(GET|HEAD|OPTIONS)$/.test(req.method)) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== this.host(req)) throw new HttpError(403, "Origen no permitido.");
    }
    return { user: s.u, admin: info.admin, via: "session" };
  }

  /** ¿Existe y puede entrar? Se cachea un minuto para no consultar Forgejo en cada request. */
  private async lookup(user: string): Promise<{ ok: boolean; admin: boolean }> {
    const hit = this.seen.get(user);
    if (hit && Date.now() - hit.at < 60_000) return hit;
    const u = await this.fj.find<any>(`/users/${encodeURIComponent(user)}`).catch(() => null);
    const info = { at: Date.now(), ok: !!u && !u.prohibit_login && u.login !== this.cfg.bot, admin: !!u?.is_admin };
    this.seen.set(user, info);
    return info;
  }

  /** Usuarios con cuenta (sin el bot): para regenerar perfiles. */
  async users(): Promise<string[]> {
    const all = await this.fj.all<any>("/admin/users");
    return all.filter((u) => u.login !== this.cfg.bot && !u.prohibit_login).map((u) => u.login as string);
  }

  private host(req: IncomingMessage) {
    return String((this.cfg.trustProxy && req.headers["x-forwarded-host"]) || req.headers.host || "");
  }
  private secure(req: IncomingMessage) {
    return this.cfg.secureCookies || (this.cfg.trustProxy && req.headers["x-forwarded-proto"] === "https");
  }
  private ip(req: IncomingMessage) {
    const fwd = this.cfg.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() : "";
    return fwd || req.socket.remoteAddress || "?";
  }

  private setCookie(req: IncomingMessage, res: ServerResponse, value: string, maxAge: number) {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${this.secure(req) ? "; Secure" : ""}`,
    );
  }

  private async startSession(req: IncomingMessage, res: ServerResponse, user: string) {
    const id = rand(32);
    await this.sessions.set(sha(id), { u: user, exp: Date.now() + SESSION_MS });
    this.setCookie(req, res, id, SESSION_MS / 1000);
  }

  private async me(p: Principal) {
    const u = await this.fj.find<any>(`/users/${encodeURIComponent(p.user)}`);
    return { user: p.user, admin: p.admin, avatar: u?.avatar_url ?? null, email: u?.email ?? null };
  }

  /** Las rutas /api/auth/*. Devuelve true si la request era de acá. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const p = new URL(req.url ?? "/", "http://x").pathname;
    if (!p.startsWith("/api/auth/")) return false;
    const send = (data: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    };
    try {
      const get = req.method === "GET";
      const post = req.method === "POST";
      const route = `${req.method} ${p}`;

      if (get && p === "/api/auth/state") return send({ signup: this.cfg.signup, minPassword: MIN_PASSWORD }), true;

      if (post && p === "/api/auth/login") {
        const b = await readJson(req);
        const user = String(b.username ?? "").trim().toLowerCase();
        const key = `${this.ip(req)}|${user}`;
        if (!this.logins.take(key)) {
          notify.send("security", "warn", "Demasiados intentos de inicio de sesión", { Usuario: user.slice(0, 40), IP: this.ip(req) }, { key: `login|${key}` });
          throw new HttpError(429, "Demasiados intentos. Espera unos minutos y vuelve a probar.");
        }
        const info = user && b.password ? await this.fj.basic(user, String(b.password)) : null;
        // Mismo mensaje exista o no el usuario, para no revelar cuentas.
        if (!info || info.login === this.cfg.bot || info.prohibit_login) throw new HttpError(401, "Usuario o contraseña incorrectos.");
        this.logins.reset(key);
        // Una cuenta de administrador que entra es lo que más conviene ver si no fuiste vos.
        if (info.is_admin) notify.send("security", "info", "Inicio de sesión de administrador", { Usuario: info.login, IP: this.ip(req) });
        await this.startSession(req, res, info.login);
        return send(await this.me({ user: info.login, admin: !!info.is_admin, via: "session" })), true;
      }

      if (post && p === "/api/auth/logout") {
        const id = parseCookies(req)[COOKIE];
        if (id) await this.sessions.del(sha(id));
        this.setCookie(req, res, "", 0);
        return send({ ok: true }), true;
      }

      if (post && p === "/api/auth/signup") {
        if (this.cfg.signup === "closed") throw new HttpError(403, "El registro está cerrado en esta instancia.");
        if (!this.signups.take(this.ip(req))) {
          notify.send("security", "warn", "Demasiados registros desde una misma red", { IP: this.ip(req) }, { key: `signup|${this.ip(req)}` });
          throw new HttpError(429, "Demasiados registros desde esta red. Prueba más tarde.");
        }
        const b = await readJson(req);
        const code = String(b.invite ?? "").trim();
        const invite = code ? await this.invites.get(sha(code)) : undefined;
        if (this.cfg.signup === "invite" && !invite) throw new HttpError(403, "Necesitas un código de invitación válido.");
        const username = String(b.username ?? "").trim().toLowerCase();
        const email = String(b.email ?? "").trim().toLowerCase();
        const password = String(b.password ?? "");
        if (!USERNAME.test(username) || RESERVED.has(username) || username === this.cfg.org || username === this.cfg.bot) {
          throw new HttpError(400, "Usuario no válido: usa 2 a 39 letras minúsculas, números, '.', '-' o '_'.");
        }
        if (!EMAIL.test(email)) throw new HttpError(400, "Escribe un correo válido.");
        if (password.length < MIN_PASSWORD) throw new HttpError(400, `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
        if (await this.fj.find(`/users/${username}`)) throw new HttpError(409, "Ese usuario ya existe.");
        await this.fj
          .req("POST", "/admin/users", { username, email, password, must_change_password: false, send_notify: false, visibility: "private" })
          .catch((e) => {
            throw new HttpError(400, /email/i.test(e.message) ? "Ese correo ya está en uso." : "No pude crear la cuenta.");
          });
        if (invite) {
          await this.invites.del(sha(code));
        }
        notify.send("signup", "info", "Nueva cuenta", { Usuario: username, Registro: invite ? "con invitación" : this.cfg.signup });
        await this.startSession(req, res, username);
        return send(await this.me({ user: username, admin: false, via: "session" }), 201), true;
      }

      // Desde acá hace falta estar dentro.
      const who = await this.principal(req);
      if (!who) throw new HttpError(401, "Inicia sesión.");

      if (get && p === "/api/auth/me") return send(await this.me(who)), true;

      if (post && p === "/api/auth/password") {
        if (who.via !== "session") throw new HttpError(403, "Cambia la contraseña desde la web.");
        const b = await readJson(req);
        const next = String(b.next ?? "");
        if (next.length < MIN_PASSWORD) throw new HttpError(400, `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`);
        if (!(await this.fj.basic(who.user, String(b.current ?? "")))) throw new HttpError(403, "La contraseña actual no es correcta.");
        await this.fj.req("PATCH", `/admin/users/${encodeURIComponent(who.user)}`, { login_name: who.user, source_id: 0, password: next });
        // Cerrar las demás sesiones, menos esta.
        const mine = sha(parseCookies(req)[COOKIE] ?? "");
        for (const [k, s] of await this.sessions.entries()) if (s.u === who.user && k !== mine) await this.sessions.del(k);
        return send({ ok: true }), true;
      }

      if (get && p === "/api/auth/tokens") {
        const list = (await this.tokens.entries())
          .filter(([, t]) => t.u === who.user)
          .map(([id, t]) => ({ id: id.slice(0, 12), name: t.name, created: t.created, last: t.last ?? null }));
        return send(list), true;
      }
      if (post && p === "/api/auth/tokens") {
        if (who.via !== "session") throw new HttpError(403, "Crea tokens desde la web.");
        const b = await readJson(req);
        const name = String(b.name ?? "").trim().slice(0, 60) || "Asistente";
        if ((await this.tokens.entries()).filter(([, t]) => t.u === who.user).length >= 20) throw new HttpError(400, "Ya tienes 20 tokens. Revoca alguno.");
        const token = `${TOKEN_PREFIX}${rand(32)}`;
        await this.tokens.set(sha(token), { u: who.user, name, created: new Date().toISOString() });
        // Es la única vez que se ve completo.
        return send({ token, id: sha(token).slice(0, 12), name }, 201), true;
      }
      let r: RegExpExecArray | null;
      if (req.method === "DELETE" && (r = /^\/api\/auth\/tokens\/([0-9a-f]{12})$/.exec(p))) {
        const key = (await this.tokens.entries()).find(([k, t]) => k.startsWith(r![1]) && t.u === who.user)?.[0];
        if (!key) throw new HttpError(404, "No existe ese token.");
        await this.tokens.del(key);
        return send({ ok: true }), true;
      }

      if (route === "POST /api/auth/invites") {
        if (!who.admin) throw new HttpError(403, "Sólo un administrador puede invitar.");
        const b = await readJson(req);
        const code = `inv_${rand(12)}`;
        await this.invites.set(sha(code), { by: who.user, created: new Date().toISOString(), note: String(b.note ?? "").slice(0, 80) || undefined });
        return send({ code }, 201), true;
      }
      if (route === "GET /api/auth/invites") {
        if (!who.admin) throw new HttpError(403, "Sólo un administrador puede ver las invitaciones.");
        return send((await this.invites.entries()).map(([, i]) => ({ by: i.by, created: i.created, note: i.note ?? null }))), true;
      }

      throw new HttpError(404, "No encontrado.");
    } catch (e) {
      if (e instanceof HttpError) return send({ error: localize(e.message, req) }, e.status), true;
      console.error(e);
      return send({ error: localize("Error interno.", req) }, 500), true;
    }
  }
}

export { HttpError };

function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new HttpError(413, "Demasiado grande.");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, "El cuerpo no es JSON.");
  }
}
