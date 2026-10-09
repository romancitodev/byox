import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

const DIR = process.env.BYOX_DATA ?? "/data";

/** Resultados por repo: guarda el último de cada etapa, así el de #3 no se pierde si el push siguiente ya no lo prueba. */
export class Results {
  private cache = new Map<string, Record<string, StageResult>>();

  private file(repo: string) {
    return join(DIR, "results", `${repo.replace(/[^\w.-]+/g, "__")}.json`);
  }

  async get(repo: string): Promise<Record<string, StageResult>> {
    if (!this.cache.has(repo)) {
      const data = await readFile(this.file(repo), "utf8").then(JSON.parse).catch(() => ({}));
      this.cache.set(repo, data);
    }
    return this.cache.get(repo)!;
  }

  async record(body: { repo: string; sha: string; run: string; at: string; results: { id: string; ok: boolean; log: string }[] }) {
    const current = await this.get(body.repo);
    for (const r of body.results) {
      current[r.id] = { ok: r.ok, log: r.log, sha: body.sha, run: body.run, at: body.at };
    }
    // Si el setup pasó, su error viejo ya no aplica.
    if (!body.results.some((r) => r.id === "setup")) delete current.setup;
    await mkdir(join(DIR, "results"), { recursive: true });
    await writeFile(this.file(body.repo), JSON.stringify(current));
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
