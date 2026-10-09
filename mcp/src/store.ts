import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

/**
 * Dónde guarda byox su estado (sesiones, tokens, invitaciones, resultados, verificaciones…).
 * Por defecto son archivos JSON en BYOX_DATA, sin dependencias: el camino de quien se instala byox en su casa.
 * Con DATABASE_URL pasa todo a Postgres, en una sola tabla `kv`, para correr con más de un nodo o con backups de verdad.
 */
export interface Table<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  /** Suma `by` a un contador (atómico) y devuelve el total. Sólo para tablas de números. */
  incr(key: string, by?: number): Promise<number>;
  /** Todas las filas. Para tablas chicas (sesiones, tokens…); las de un archivo por clave no lo soportan. */
  entries(): Promise<[string, T][]>;
}

/** Una tabla con un archivo por clave (resultados, verificaciones): `<BYOX_DATA>/<dir>/<clave con sep>.json`. */
export interface PerKey {
  dir: string;
  /** Con qué se reemplaza lo que no sea [\w.-] al armar el nombre del archivo. */
  sep: string;
}

export interface Db {
  readonly kind: "file" | "postgres";
  table<T>(name: string, perKey?: PerKey): Table<T>;
  /** Un valor que se genera una vez y se conserva (el secreto de firma). */
  secret(name: string, make: () => string): Promise<string>;
  close(): Promise<void>;
}

/** Un JSON en disco (0600) con todas las filas y escritura diferida. */
class MapFile<T> implements Table<T> {
  private data?: Promise<Record<string, T>>;
  private timer: NodeJS.Timeout | undefined;
  constructor(private file: string) {}

  private load(): Promise<Record<string, T>> {
    return (this.data ??= readFile(this.file, "utf8").then(JSON.parse).catch(() => ({})));
  }
  private flush() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.load()
        .then(async (d) => {
          await mkdir(join(this.file, ".."), { recursive: true });
          await writeFile(this.file, JSON.stringify(d), { mode: 0o600 });
        })
        .catch((e) => console.error("store:", e.message));
    }, 500);
  }

  async get(key: string) {
    return (await this.load())[key];
  }
  async set(key: string, value: T) {
    (await this.load())[key] = value;
    this.flush();
  }
  async del(key: string) {
    delete (await this.load())[key];
    this.flush();
  }
  async incr(key: string, by = 1) {
    // Sin ningún await entre leer y escribir: dos incr seguidos no se pisan.
    const d = (await this.load()) as Record<string, unknown>;
    const n = (Number(d[key]) || 0) + by;
    d[key] = n;
    this.flush();
    return n;
  }
  async entries() {
    return Object.entries(await this.load());
  }
}

class FilePerKey<T> implements Table<T> {
  constructor(private dir: string, private sep: string) {}
  private file(key: string) {
    return join(this.dir, `${key.replace(/[^\w.-]+/g, this.sep)}.json`);
  }
  async get(key: string) {
    return readFile(this.file(key), "utf8").then(JSON.parse).catch(() => undefined);
  }
  async set(key: string, value: T) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(key), JSON.stringify(value));
  }
  async del(key: string) {
    await rm(this.file(key), { force: true });
  }
  async incr(): Promise<number> {
    throw new Error("esta tabla guarda un archivo por clave y no tiene contadores");
  }
  async entries(): Promise<[string, T][]> {
    throw new Error("esta tabla guarda un archivo por clave y no se puede listar");
  }
}

class FileDb implements Db {
  readonly kind = "file" as const;
  constructor(private dir: string) {}

  table<T>(name: string, perKey?: PerKey): Table<T> {
    return perKey ? new FilePerKey<T>(join(this.dir, perKey.dir), perKey.sep) : new MapFile<T>(join(this.dir, `${name}.json`));
  }
  async secret(name: string, make: () => string) {
    const file = join(this.dir, name);
    const have = (await readFile(file, "utf8").catch(() => "")).trim();
    if (have) return have;
    const value = make();
    await mkdir(this.dir, { recursive: true });
    await writeFile(file, value, { mode: 0o600 });
    return value;
  }
  async close() {}
}

class PgTable<T> implements Table<T> {
  constructor(private pool: pg.Pool, private ns: string) {}

  async get(key: string) {
    const r = await this.pool.query("SELECT value FROM kv WHERE ns = $1 AND key = $2", [this.ns, key]);
    return r.rows[0]?.value as T | undefined;
  }
  async set(key: string, value: T) {
    await this.pool.query(
      `INSERT INTO kv (ns, key, value) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (ns, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [this.ns, key, JSON.stringify(value)],
    );
  }
  async del(key: string) {
    await this.pool.query("DELETE FROM kv WHERE ns = $1 AND key = $2", [this.ns, key]);
  }
  async incr(key: string, by = 1) {
    const r = await this.pool.query(
      `INSERT INTO kv (ns, key, value) VALUES ($1, $2, to_jsonb($3::bigint))
       ON CONFLICT (ns, key) DO UPDATE SET value = to_jsonb((kv.value #>> '{}')::bigint + $3::bigint), updated_at = now()
       RETURNING (value #>> '{}')::bigint AS n`,
      [this.ns, key, by],
    );
    return Number(r.rows[0].n);
  }
  async entries() {
    const r = await this.pool.query("SELECT key, value FROM kv WHERE ns = $1", [this.ns]);
    return r.rows.map((row): [string, T] => [row.key, row.value]);
  }
}

class PgDb implements Db {
  readonly kind = "postgres" as const;
  constructor(private pool: pg.Pool) {}

  table<T>(name: string): Table<T> {
    return new PgTable<T>(this.pool, name);
  }
  async secret(name: string, make: () => string) {
    const t = this.table<string>("meta");
    const have = await t.get(name);
    if (have) return have;
    // Si dos nodos arrancan a la vez, gana el primero y el otro lee el suyo.
    await this.pool.query("INSERT INTO kv (ns, key, value) VALUES ('meta', $1, $2::jsonb) ON CONFLICT DO NOTHING", [name, JSON.stringify(make())]);
    return (await t.get(name))!;
  }
  async close() {
    await this.pool.end();
  }
}

export async function openDb(dir: string, url?: string): Promise<Db> {
  if (!url) return new FileDb(dir);
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  // La base puede estar todavía arrancando (compose): se reintenta un rato antes de rendirse.
  for (let tries = 0; ; tries++) {
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS kv (
           ns text NOT NULL,
           key text NOT NULL,
           value jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now(),
           PRIMARY KEY (ns, key)
         )`,
      );
      return new PgDb(pool);
    } catch (e) {
      if (tries >= 20) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
