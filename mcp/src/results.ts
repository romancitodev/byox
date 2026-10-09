import type { Db, Table } from "./store.js";

/** Lo que pasó con una etapa en el último run que la probó. */
export interface StageResult {
  ok: boolean;
  log: string;
  sha: string;
  run: string;
  at: string;
}

export interface Diagnosis {
  /** "compile" | "panic" | "assert" | "python" | "setup" | "unknown" */
  kind: string;
  /** Primera línea que explica el error. */
  message: string;
  /** Archivo y línea, si se pudo ubicar: { path: "src/scan.rs", line: 17, col: 5 }. */
  where?: { path: string; line: number; col?: number };
  /** Líneas del log que conviene resaltar (índices). */
  highlight: number[];
}

/** Resultados por repo: guarda el último de cada etapa, así el de #3 no se pierde si el push siguiente ya no lo prueba. */
export class Results {
  private table: Table<Record<string, StageResult>>;
  /** Un record() a la vez por repo: es leer, mezclar y volver a escribir. */
  private chain = new Map<string, Promise<unknown>>();

  constructor(db: Db) {
    this.table = db.table("results", { dir: "results", sep: "__" });
  }

  async get(repo: string): Promise<Record<string, StageResult>> {
    return (await this.table.get(repo)) ?? {};
  }

  record(body: { repo: string; sha: string; run: string; at: string; results: { id: string; ok: boolean; log: string }[] }) {
    const run = async () => {
      const current = await this.get(body.repo);
      for (const r of body.results) {
        current[r.id] = { ok: r.ok, log: r.log, sha: body.sha, run: body.run, at: body.at };
      }
      // Si el setup pasó, su error viejo ya no aplica.
      if (!body.results.some((r) => r.id === "setup")) delete current.setup;
      await this.table.set(body.repo, current);
    };
    const next = (this.chain.get(body.repo) ?? Promise.resolve()).then(run, run);
    this.chain.set(body.repo, next);
    next.finally(() => this.chain.get(body.repo) === next && this.chain.delete(body.repo)).catch(() => {});
    return next;
  }
}

/** Busca en la salida del test dónde falló y por qué. Reconoce Rust y Python; si no, la primera línea con pinta de error. */
export function diagnose(log: string): Diagnosis {
  const lines = log.split("\n");
  const at = (re: RegExp, from = 0) => {
    for (let k = from; k < lines.length; k++) if (re.test(lines[k])) return k;
    return -1;
  };

  // Rust, error de compilación:  error[E0425]: cannot find value `x`  /  --> src/scan.rs:17:5
  let k = at(/^error(\[E\d+\])?: /);
  if (k >= 0 && !/^error: test failed|^error: could not compile/.test(lines[k])) {
    const arrow = at(/^\s*--> /, k);
    const m = arrow >= 0 ? /-->\s+([^:\s]+):(\d+):(\d+)/.exec(lines[arrow]) : null;
    return {
      kind: "compile",
      message: lines[k].replace(/^error(\[E\d+\])?: /, ""),
      where: m ? { path: m[1], line: Number(m[2]), col: Number(m[3]) } : undefined,
      highlight: [k, arrow].filter((x) => x >= 0),
    };
  }

  // Rust, pánico en un test:  thread 'x' (12) panicked at tests/paso_07.rs:18:3:  + mensaje en las líneas siguientes
  k = at(/panicked at [^:\s]+:\d+:\d+/);
  if (k >= 0) {
    const m = /panicked at ([^:\s]+):(\d+):(\d+)/.exec(lines[k])!;
    const rest: string[] = [];
    for (let j = k + 1; j < lines.length && rest.length < 4 && lines[j].trim() && !/^note: /.test(lines[j]); j++) {
      rest.push(lines[j].trim());
    }
    const todo = /not yet implemented|not implemented/.test(rest.join(" "));
    return {
      kind: todo ? "todo" : /assertion/.test(rest.join(" ")) ? "assert" : "panic",
      message: todo ? "Todavía está el todo!() en el código" : rest.join(" ") || lines[k],
      where: { path: m[1], line: Number(m[2]), col: Number(m[3]) },
      highlight: [k, k + 1, k + 2, k + 3].filter((x) => x < lines.length && lines[x].trim()),
    };
  }

  // Python: el último  File "...", line N  del traceback y la excepción al final.
  const files = lines.map((l, i) => [i, /File "([^"]+)", line (\d+)/.exec(l)] as const).filter(([, m]) => m);
  if (files.length) {
    const [i, m] = files.at(-1)!;
    const exc = at(/^\w+(Error|Exception|Exit)\b/, i);
    return {
      // NotImplementedError es el esqueleto sin tocar, no una falla.
      kind: exc >= 0 && /^NotImplementedError/.test(lines[exc]) ? "todo" : "python",
      message: exc >= 0 ? lines[exc] : lines[i],
      where: { path: m![1].replace(/^\/work(space)?\/[^/]*\/?/, ""), line: Number(m![2]) },
      highlight: [i, exc].filter((x) => x >= 0),
    };
  }

  k = at(/error|fail|assert|exception|no such file|not found/i);
  return { kind: "unknown", message: k >= 0 ? lines[k].trim() : "El test terminó con error.", highlight: k >= 0 ? [k] : [] };
}
