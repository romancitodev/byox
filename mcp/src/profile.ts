import type { Forgejo } from "./forgejo.js";
import type { Config } from "./instance.js";

const PROFILE_REPO = ".profile";
const WEEKS = 16;

export interface Taken {
  name: string;
  done: number;
  total: number;
  finishedAt?: string;
}

export type ProfileConfig = Config & { org: string; tz: string };

export interface Stats {
  created: string[];
  taken: Taken[];
  /** Días con actividad, YYYY-MM-DD en la zona horaria del usuario. */
  active: string[];
  streak: number;
  best: number;
  today: string;
}

/** Un día cuenta si hubo un commit tuyo o un issue cerrado en algún curso. */
export async function computeStats(fj: Forgejo, cfg: ProfileConfig): Promise<Stats> {
  const day = dayFn(cfg.tz);

  const created = (await fj.all<any>(`/orgs/${cfg.org}/repos`)).map((r) => r.name as string).sort();
  const mine = new Set(
    (await Promise.all(created.map(async (n) => ((await fj.find(`/repos/${cfg.user}/${n}`)) ? n : null)))).filter((n): n is string => !!n),
  );
  const active = new Set<string>();
  const taken: Taken[] = [];

  for (const name of created.filter((n) => mine.has(n))) {
    const issues = await fj.all<any>(`/repos/${cfg.user}/${name}/issues?state=all&type=issues`);
    const closed = issues.filter((i) => i.state === "closed");
    for (const i of closed) active.add(day(i.closed_at));
    const t: Taken = { name, done: closed.length, total: issues.length };
    if (issues.length > 0 && closed.length === issues.length) {
      t.finishedAt = closed.map((i) => i.closed_at as string).sort().at(-1);
    }
    taken.push(t);
    for (const c of await fj.all<any>(`/repos/${cfg.user}/${name}/commits?stat=false&verification=false&files=false`)) {
      // Sin filtrar por autor: tu email de git local no tiene por qué ser el de Forgejo.
      const msg = c.commit.message as string;
      if (!msg.startsWith("🎉 ") && !msg.startsWith("🔧 ") && msg !== "Initial commit") active.add(day(c.commit.author.date));
    }
  }

  const today = new Date();
  const back = (n: number) => day(new Date(today.getTime() - n * 86_400_000));
  // La racha sigue viva si hoy todavía no hiciste nada pero ayer sí.
  let streak = 0;
  for (let n = active.has(back(0)) ? 0 : 1; active.has(back(n)); n++) streak++;
  const sortedDays = [...active].sort();
  let best = 0;
  let run = 0;
  for (let k = 0; k < sortedDays.length; k++) {
    const prev = k > 0 ? new Date(sortedDays[k - 1]).getTime() : NaN;
    run = new Date(sortedDays[k]).getTime() - prev === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { created, taken, active: sortedDays, streak, best, today: back(0) };
}

const dayFn = (tz: string) => (iso: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(typeof iso === "string" ? new Date(iso) : iso);

/**
 * Regenera el README de `<user>/.profile`, que Forgejo muestra en el perfil:
 * cursos creados, tomados y terminados, la racha y un heatmap chico.
 */
export async function refreshProfile(fj: Forgejo, cfg: ProfileConfig): Promise<void> {
  const day = dayFn(cfg.tz);
  const { created, taken, streak, best, ...s } = await computeStats(fj, cfg);
  const active = new Set(s.active);
  const today = new Date();
  const mine = new Set(taken.map((t) => t.name));
  const finished = taken.filter((t) => t.finishedAt);
  const inProgress = taken.filter((t) => !t.finishedAt);
  const url = cfg.publicUrl;
  const bar = (t: Taken) => {
    const n = t.total ? Math.round((t.done / t.total) * 10) : 0;
    return `${"▰".repeat(n)}${"▱".repeat(10 - n)}`;
  };

  const md = [
    `# ${streak > 0 ? "🔥" : "🪵"} ${streak} ${streak === 1 ? "día" : "días"} de racha`,
    "",
    `Récord: **${best}** · Días activos: **${active.size}**`,
    "",
    "| Creados | Tomados | Terminados | Issues cerrados |",
    "|:-:|:-:|:-:|:-:|",
    `| ${created.length} | ${taken.length} | ${finished.length} | ${taken.reduce((s, t) => s + t.done, 0)} |`,
    "",
    `## Últimas ${WEEKS} semanas`,
    "",
    heatmap(active, today, day),
    "",
  ];
  if (inProgress.length) {
    md.push("## En curso", "");
    for (const t of inProgress) md.push(`- [${t.name}](${url}/${cfg.user}/${t.name}) \`${bar(t)}\` ${t.done}/${t.total}`);
    md.push("");
  }
  if (finished.length) {
    md.push("## Terminados", "");
    for (const t of finished) md.push(`- 🏁 [${t.name}](${url}/${cfg.user}/${t.name}) · ${day(t.finishedAt!)}`);
    md.push("");
  }
  md.push("## Creados", "");
  if (created.length === 0) md.push("Todavía ninguno.");
  for (const n of created) md.push(`- [${n}](${url}/${cfg.org}/${n})${mine.has(n) ? "" : " · sin empezar"}`);
  md.push("", `<sub>Lo genera byox. Actualizado: ${new Date().toLocaleString("es-AR", { timeZone: cfg.tz, hourCycle: "h23" })}</sub>`, "");
  const readme = md.join("\n");

  if (!(await fj.find(`/repos/${cfg.user}/${PROFILE_REPO}`))) {
    await fj.as(cfg.user).req("POST", "/user/repos", {
      name: PROFILE_REPO,
      description: "Perfil generado por byox",
      private: false,
      auto_init: true,
      default_branch: "main",
    });
  }
  const current = await fj.raw(cfg.user, PROFILE_REPO, "README.md").catch(() => Buffer.from(""));
  // Ignorar la línea de "Actualizado" para no commitear sólo porque pasó el tiempo.
  const strip = (s: string) => s.replace(/<sub>.*<\/sub>/, "");
  if (strip(current.toString("utf8")) !== strip(readme)) {
    await fj.commit(cfg.user, PROFILE_REPO, { "README.md": readme }, "📊 Actualizar perfil");
  }
}

function heatmap(active: Set<string>, today: Date, day: (d: Date) => string): string {
  // Columnas = semanas (de lunes a domingo), filas = días, como en GitHub.
  const dow = (today.getUTCDay() + 6) % 7;
  const start = new Date(today.getTime() - ((WEEKS - 1) * 7 + dow) * 86_400_000);
  const rows = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => [d]);
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86_400_000);
      rows[d].push(date > today ? "　" : active.has(day(date)) ? "🟩" : "⬜");
    }
  }
  return ["```", ...rows.map((r) => r.join(" ")), "```"].join("\n");
}
