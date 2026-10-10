import { statfs } from "node:fs/promises";
import type { Forgejo } from "./forgejo.js";
import { notify, type Notifier } from "./notify.js";

/**
 * Vigila lo que hace falta para que byox ande: Forgejo, el runner y el disco de los datos. Avisa sólo cuando algo
 * cambia de estado (cayó, volvió), y recién después de dos revisiones seguidas mal, para no gritar por un parpadeo.
 * El primer resultado sólo fija el estado inicial: un arranque no dispara "recuperado".
 */
export interface Check {
  name: string;
  /** null si está bien; un texto con el problema si no. */
  run: () => Promise<string | null>;
}

const FAILS_TO_ALERT = 2;

export class Watch {
  private state = new Map<string, { bad: boolean; fails: number; known: boolean }>();
  constructor(private checks: Check[], private out: Notifier = notify) {}

  /** Una vuelta de revisiones. Pública para poder probarla sin timers. */
  async tick() {
    for (const c of this.checks) {
      const problem = await c.run().catch((e: Error) => `no pude revisarlo: ${e.message}`);
      const s = this.state.get(c.name) ?? { bad: false, fails: 0, known: false };
      if (problem) {
        s.fails++;
        if (!s.bad && s.fails >= FAILS_TO_ALERT) {
          s.bad = true;
          this.out.send("system", "error", `${c.name}: con problemas`, {}, { text: problem, key: `watch|${c.name}` });
        }
      } else {
        if (s.bad) this.out.send("system", "info", `${c.name}: recuperado`);
        s.bad = false;
        s.fails = 0;
      }
      s.known = true;
      this.state.set(c.name, s);
    }
  }

  start(everyMs = 60_000, firstAfterMs = 30_000) {
    const loop = () => void this.tick().catch((e) => console.error("watch:", e.message));
    setTimeout(() => {
      loop();
      setInterval(loop, everyMs).unref();
    }, firstAfterMs).unref();
  }
}

/** Las revisiones de una instancia: Forgejo, runner y disco (con DISK_ALERT_PCT, por defecto 85%). */
export function defaultChecks(fj: Forgejo, dataDir: string, diskPct = Number(process.env.DISK_ALERT_PCT) || 85): Check[] {
  return [
    {
      name: "Forgejo",
      run: async () => ((await fj.find("/version").catch(() => null)) ? null : "no responde"),
    },
    {
      name: "Runner",
      run: async () => {
        const runners = await fj.req<any[]>("GET", "/admin/actions/runners");
        return runners.some((r) => r.status === "active" || r.status === "idle") ? null : "ningún runner está activo: los tests no corren";
      },
    },
    {
      name: "Disco",
      run: async () => {
        const s = await statfs(dataDir);
        const used = Math.round((1 - Number(s.bavail) / Number(s.blocks)) * 100);
        return used >= diskPct ? `${used}% usado (aviso desde ${diskPct}%)` : null;
      },
    },
  ];
}
