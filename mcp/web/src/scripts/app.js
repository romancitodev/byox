// byox: interfaz para seguir los cursos. Una SPA: fetch a /api e íconos de Lucide.
import { createIcons } from "lucide";
import { icons } from "./icons.js";
import { courseName, language } from "../lib/course.js";
import { LANG, locale, t, setLang } from "./i18n.js";

const $app = document.getElementById("app");
/** La app vive en /app: el router del cliente resuelve /app, /app/cursos, /app/actividad y /app/c/<curso>/<n>. */
const A = "/app";
const appPath = () => location.pathname.replace(/^\/app(?=\/|$)/, "") || "/";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const api = async (path, opts) => {
  // El servidor localiza sus mensajes de /api/auth según esta cabecera.
  const res = await fetch(`/api${path}`, { ...opts, headers: { ...opts?.headers, "X-Byox-Lang": LANG } });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {}
  // Sesión vencida a mitad de camino: volver al login en vez de dejar la pantalla rota.
  if (res.status === 401 && !path.startsWith("/auth/") && S.me) {
    S.me = null;
    showLogin(t("Tu sesión terminó. Inicia sesión de nuevo."));
  }
  if (!res.ok) throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status, data });
  return data;
};
const post = (path, body) =>
  api(path, typeof body === "string"
    ? { method: "POST", headers: { "Content-Type": "text/plain" }, body }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
const ago = (iso) => {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return t("recién");
  if (s < 3600) return t("hace {n} min", { n: Math.round(s / 60) });
  if (s < 86400) return t("hace {n} h", { n: Math.round(s / 3600) });
  const d = Math.round(s / 86400);
  return d === 1 ? t("ayer") : t("hace {n} días", { n: d });
};
const plural = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;
const ic = (name) => `<i data-lucide="${name}"></i>`;
const paint = () => createIcons({ icons, attrs: { "stroke-width": 1.75 } });
const IS_WIN = /Windows/.test(navigator.userAgent);
// El logo: dos etapas que se juntan y desbloquean una tercera.
const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 6.4C11 6.4 11.5 12 14.2 12M6.6 17.6C11 17.6 11.5 12 14.2 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/><circle cx="4.6" cy="6.4" r="2.6" fill="currentColor"/><circle cx="4.6" cy="17.6" r="2.6" fill="currentColor"/><circle cx="18" cy="12" r="4.4" fill="var(--ember)"/></svg>';
// Con getters para que el texto siga al idioma si se cambia con la app abierta.
const STATE_LABEL = { get done() { return t("Completada"); }, get ready() { return t("Disponible"); }, get locked() { return t("Bloqueada"); } };

/** Comandos para probar una etapa, en el orden en que conviene ofrecerlos. */
const testCommands = (n) => [
  { id: "cli", label: "byox", cmd: `byox test ${n}`, note: t("Corre en Docker, en la misma imagen que el CI.") },
  { id: "win", label: "PowerShell / cmd", cmd: `.course\\test ${n}`, note: t("Sin el CLI: también corre en Docker.") },
  { id: "sh", label: "Git Bash / Linux", cmd: `sh .course/run.sh ${n}`, note: t("Con las herramientas instaladas en tu máquina.") },
];

// ---------- estado global ----------
const S = { courses: null, health: null, profile: null, slim: false };
try { S.slim = localStorage.getItem("byox-slim") === "1"; } catch {}
let ctx = null; // curso abierto: { slug, course, n, tab, poll, run, issueCache, collapsed }

async function loadGlobals() {
  const [courses, health, profile] = await Promise.all([
    api("/courses").then((cs) => cs.map(named)).catch(() => S.courses ?? []),
    api("/health").catch(() => null),
    api("/profile").catch(() => S.profile),
  ]);
  Object.assign(S, { courses, health, profile });
}
/** El título para mostrar y el lenguaje, iguales en toda la app. */
const named = (c) => ({ ...c, title: courseName(c.title), lang: language(c.image) });
const fetchCourse = (slug) => api(`/courses/${encodeURIComponent(slug)}`).then(named);

// ---------- tema ----------
function cycleTheme() {
  const order = [undefined, "dark", "light"];
  const cur = document.documentElement.dataset.theme;
  const next = order[(order.indexOf(cur) + 1) % order.length];
  if (next) document.documentElement.dataset.theme = next;
  else delete document.documentElement.dataset.theme;
  try { next ? localStorage.setItem("byox-theme", next) : localStorage.removeItem("byox-theme"); } catch {}
  toast(t("Tema: {tema}", { tema: next === "dark" ? t("oscuro") : next === "light" ? t("claro") : t("el del sistema") }));
}

// ---------- notificaciones ----------
function toast(text, icon = "check") {
  document.querySelector(".toast")?.remove();
  const bad = icon === "circle-x";
  const el = document.createElement("div");
  el.className = `toast${bad ? " bad" : ""}`;
  el.setAttribute("role", bad ? "alert" : "status");
  el.innerHTML = `${ic(icon)}<span>${esc(clip(text, 120))}</span>`;
  document.body.append(el);
  paint();
  // Un error se queda lo justo para leerlo; una confirmación se va rápido.
  setTimeout(() => el.remove(), bad ? 5000 : 2600);
}
function copy(text, what) {
  navigator.clipboard?.writeText(text);
  toast(what ?? t("Comando copiado"));
}

// ---------- shell ----------
const SIDE_CAP = 5;
function sidebar(active) {
  const h = S.health;
  const sysOk = h && h.forgejo === "ok" && h.runner !== "down";
  const sysLed = !h ? "" : !sysOk ? "down" : h.runner === "busy" ? "busy" : "ok";
  const sysText = !h
    ? t("Comprobando servicios…")
    : h.forgejo !== "ok"
      ? t("Forgejo no responde")
      : h.runner === "down"
        ? t("Runner sin conexión")
        : h.runner === "busy"
          ? t("Ejecutando tests")
          : t("Servicios operativos");
  const started = (S.courses ?? []).filter((c) => c.started);
  const finished = started.filter((c) => c.total && c.done === c.total);
  const inProgress = started.filter((c) => !finished.includes(c));
  const nav = (href, icon, label, key, extra = "") =>
    `<a class="nav-item ${active === key ? "on" : ""}" href="${href}" data-link title="${label}">${ic(icon)}<span class="hide-slim">${label}</span>${extra}</a>`; // label ya viene traducido
  const failingN = started.reduce((s, c) => s + (c.failing?.length ?? 0), 0);
  const courseItem = (c) => {
    const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
    const dot = c.failing?.length ? "fail" : c.done === c.total ? "fin" : "on";
    return `<a class="nav-item nav-course ${ctx?.slug === c.slug ? "on" : ""}" href="${A}/c/${esc(c.slug)}" data-link title="${esc(c.title)}">
      <span class="dot ${dot}"></span><span class="hide-slim" style="overflow:hidden;text-overflow:ellipsis">${esc(c.title)}</span>
      <span class="bar hide-slim"><i style="width:${pct}%"></i></span></a>`;
  };
  return `<aside class="side" aria-label="${t("Navegación")}">
    <div class="ws">
      <button class="logo" data-act="slim" title="${S.slim ? t("Expandir la barra ( [ )") : t("Plegar la barra ( [ )")}" aria-label="${t("Plegar o expandir la barra")}">${LOGO}</button>
      <span class="hide-slim grow">byox</span>
      <button class="collapse hide-slim" data-act="slim" title="${t("Plegar la barra ( [ )")}" aria-label="${t("Plegar la barra")}">${ic("panel-left")}</button>
    </div>
    <button class="search" data-act="palette" title="${t("Buscar y ejecutar (Ctrl K)")}">${ic("search")}<span class="hide-slim">${t("Buscar…")}</span><kbd class="hide-slim">Ctrl K</kbd></button>
    ${nav(`${A}/`, "house", t("Inicio"), "home", failingN ? `<span class="count hide-slim" title="${t("Etapas con el test fallando")}"><span class="led down"></span> ${failingN}</span>` : "")}
    ${nav(`${A}/cursos`, "book-open", t("Cursos"), "courses", `<span class="count hide-slim">${S.courses?.length ?? ""}</span>`)}
    ${nav(`${A}/actividad`, "activity", t("Actividad"), "activity")}
    ${nav(`${A}/creados`, "pen-line", t("Creados"), "authored")}
    ${inProgress.length ? `<div class="side-label">${t("En curso")}</div>${inProgress.slice(0, SIDE_CAP).map(courseItem).join("")}${inProgress.length > SIDE_CAP ? `<a class="nav-item side-more hide-slim" href="${A}/cursos" data-link>${t("y {n} más…", { n: inProgress.length - SIDE_CAP })}</a>` : ""}` : ""}
    ${finished.length ? `<div class="side-label">${t("Terminados")}</div>${finished.slice(0, 3).map(courseItem).join("")}${finished.length > 3 ? `<a class="nav-item side-more hide-slim" href="${A}/cursos" data-link>${t("y {n} más…", { n: finished.length - 3 })}</a>` : ""}` : ""}
    <div class="grow"></div>
    <a class="sys" href="${esc(h?.forgejoUrl ?? "http://localhost:3000")}/admin/actions/runners" target="_blank" rel="noopener"
       title="Forgejo: ${h?.forgejo ?? "?"} · Runner: ${h?.runner ?? "?"} · MCP: ${h?.mcp ?? "?"}"><span class="led ${sysLed}"></span><span class="hide-slim">${sysText}</span></a>
    ${((m) => `<button class="sys" data-act="mcp" title="${esc(m.detail)}"><span class="led ${m.led}"></span><span class="hide-slim">${esc(m.label)}</span></button>`)(mcpInfo())}
    <a class="me ${active === "account" ? "on" : ""}" href="${A}/cuenta" data-link title="${t("Tu cuenta")}">
      <span class="avatar">${esc((S.me?.user ?? h?.user ?? "?")[0].toUpperCase())}</span><span class="name hide-slim">${esc(S.me?.user ?? h?.user ?? "")}</span><span class="ver hide-slim">v${esc(h?.version ?? "")}</span></a>
  </aside>`;
}

function shell(active, crumbs, actions, body) {
  const slim = S.slim || (active === "course" && S.slimAuto !== false && window.innerWidth < 1500);
  $app.innerHTML = `<div class="shell ${slim ? "slim" : ""}">
    ${sidebar(active)}
    <div class="page">
      <header class="pagebar"><nav class="crumbs" aria-label="${t("Ubicación")}">${crumbs}</nav><span class="grow"></span><div id="bar-actions" style="display:flex;gap:8px;align-items:center">${actions}</div></header>
      <div class="content${body === loading ? "" : " view-in"}" id="content" tabindex="-1">${body}</div>
    </div>
  </div>`;
  paint();
  if (active !== "course") tabSignal(null);
}
const crumb = (parts) =>
  parts
    .map((p, k) => (k === parts.length - 1 ? `<span class="cur">${p.label}</span>` : `<a href="${p.href}" data-link>${p.label}</a>${ic("chevron-right")}`))
    .join("");
const flameChip = () =>
  S.profile ? `<span class="chip ${S.profile.streak ? "flame" : ""} keep" title="${t("Tu racha")}">${ic("flame")}${plural(S.profile.streak, "día", "días")}</span>` : "";
// Doherty: un esqueleto con la forma de lo que viene se siente más rápido que un spinner.
const loading = '<div class="skeleton pad" aria-busy="true"><i style="width:30%"></i><i></i><i style="width:85%"></i><i style="width:60%"></i></div>';
/** Truncado único: recorta con «…» en el límite dado (los textos largos llevan el completo en title). */
function clip(s, n) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
/** Ilustraciones de estados vacíos: trazo fino con el motivo del logo (nodos unidos) y un punto brasa como acento. */
const ART = {
  courses: '<circle cx="14" cy="20" r="5"/><circle cx="14" cy="44" r="5"/><path d="M19 20c10 0 10 12 20 12M19 44c10 0 10-12 20-12" stroke-dasharray="3 4"/><circle cx="46" cy="32" r="8" class="acc"/>',
  activity: '<path d="M6 36h14l5-14 8 26 6-18 4 6h15"/><circle cx="58" cy="36" r="3.5" class="acc"/>',
  tests: '<rect x="10" y="10" width="44" height="12" rx="3"/><rect x="10" y="26" width="44" height="12" rx="3" stroke-dasharray="3 4"/><rect x="10" y="42" width="44" height="12" rx="3" stroke-dasharray="3 4"/><path d="m16 16 3 3 5-6" class="acc"/>',
  error: '<path d="M24 22 14 32a8 8 0 0 0 11 11l6-6M40 42l10-10A8 8 0 0 0 39 21l-6 6"/><path d="m28 36 8-8" stroke-dasharray="2 5"/><circle cx="50" cy="14" r="3.5" class="acc"/>',
  search: '<circle cx="28" cy="28" r="14"/><path d="m39 39 12 12"/><circle cx="52" cy="14" r="3.5" class="acc"/>',
  done: '<circle cx="32" cy="32" r="18"/><path d="m24 33 6 6 11-13" class="acc"/>',
};
/** Estado vacío con intención: ilustración, qué pasa, qué hacer. `title`, `text` y `action` son HTML ya escapado. */
const empty = (kind, title, text = "", action = "") =>
  `<div class="empty">${kind ? `<svg class="empty-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[kind]}</svg>` : ""}${title ? `<b>${title}</b>` : ""}${text}${action ? `<div class="empty-act">${action}</div>` : ""}</div>`;
const langTag = (c) => (c.lang ? `<span class="lang"><i style="background:${c.lang.color}"></i>${esc(c.lang.name)}</span>` : "");

function segs(issues, cur) {
  if (issues.length <= 24) return `<div class="segs" aria-hidden="true">${issues.map((i) => `<i class="${i.state}${i.n === cur ? " cur" : ""}"></i>`).join("")}</div>`;
  // Con muchas etapas un segmento por etapa no se lee: un bloque por tramo, lleno con lo terminado.
  const groups = [];
  for (const i of issues) {
    const g = groups.at(-1);
    if (g && g.ms === i.milestone) g.list.push(i);
    else groups.push({ ms: i.milestone, list: [i] });
  }
  return `<div class="segs grouped" aria-hidden="true">${groups
    .map(({ list }) => {
      const done = list.filter((i) => i.state === "done").length;
      const k = list.findIndex((i) => i.n === cur);
      const mark = k < 0 ? "" : `<u style="left:${(k / list.length) * 100}%;width:${100 / list.length}%"></u>`;
      return `<i style="flex:${list.length}"><b style="width:${(done / list.length) * 100}%"></b>${mark}</i>`;
    })
    .join("")}</div>`;
}

/** La barra de progreso de un curso en las listas: un bloque por tramo (con muchas etapas) o un segmento por etapa. */
function segsOf(c) {
  const parts = c.parts ?? [];
  if (c.total <= 24 || parts.length < 2) return segs(fakeIssues(c));
  return `<div class="segs grouped" aria-hidden="true">${parts
    .filter((p) => p.total)
    .map((p) => `<i style="flex:${p.total}"><b style="width:${(p.done / p.total) * 100}%"></b></i>`)
    .join("")}</div>`;
}

function heatmap(p, weeks) {
  const active = new Set(p.active);
  const today = new Date(`${p.today}T12:00:00`);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - ((weeks - 1) * 7 + dow));
  let cells = "";
  for (let k = 0; k < weeks * 7; k++) {
    const d = new Date(start);
    d.setDate(start.getDate() + k);
    const key = d.toLocaleDateString("en-CA");
    const cls = d > today ? "fut" : `${active.has(key) ? "on" : ""}${key === p.today ? " today" : ""}`;
    cells += `<i class="${cls}" title="${key}"></i>`;
  }
  return `<div class="heat" role="img" aria-label="${t("{n} días con actividad", { n: p.active.length })}">${cells}</div>`;
}

/** Gradiente de meta: cuánto falta para cerrar el tramo (milestone) de una etapa. */
function milestoneGoal(c, i) {
  const ms = c.milestones.find((m) => m.id === i.milestone);
  const left = c.issues.filter((x) => x.milestone === i.milestone && x.state !== "done").length;
  const title = ms?.title ?? t("este tramo");
  return { left, text: left === 0 ? t("Completaste {title}.", { title }) : left === 1 ? t("Te queda 1 etapa para completar {title}.", { title }) : t("Te quedan {left} etapas para completar {title}.", { left, title }) };
}

/** Dónde falló, como link al archivo y la línea en ese commit. */
function whereLink(r) {
  if (!r?.where) return "";
  const loc = `${r.where.path}:${r.where.line}${r.where.col ? `:${r.where.col}` : ""}`;
  return r.fileUrl ? `<a class="where" href="${esc(r.fileUrl)}" target="_blank" rel="noopener">${ic("file-code")}<code>${esc(loc)}</code></a>` : `<span class="where">${ic("file-code")}<code>${esc(loc)}</code></span>`;
}

/**
 * Lo esperado y lo obtenido, si el mensaje del test los trae. Carga cognitiva: encontrar la diferencia
 * dentro de un log es trabajo; acá van uno arriba del otro con la parte distinta marcada.
 * Si el formato no dice cuál es cuál (left/right de Rust, a != b de unittest), se muestran tal cual.
 */
function expectation(r) {
  const text = [r.message ?? "", ...(r.log ?? "").split("\n")];
  const clean = (s) => s.trim().replace(/^`|`,?$/g, "").replace(/,$/, "").trim();
  const pick = (a, b, la, lb) => (a && b && a !== b ? { a: clean(a), b: clean(b), la, lb } : null);
  for (const line of text) {
    let m = /esperaba:?\s*(.+?),\s*(?:obtuve|obtuvo|pero (?:dio|fue|devolvió)|recibí|recibió)\s*:?\s*(.+)$/i.exec(line);
    if (m) return pick(m[1], m[2], "Esperado", "Obtenido");
    m = /expected:?\s*(.+?),\s*(?:got|but got|received|found)\s*:?\s*(.+)$/i.exec(line);
    if (m) return pick(m[1], m[2], "Esperado", "Obtenido");
    m = /\bgot:?\s*(.+?),?\s+want:?\s*(.+)$/i.exec(line);
    if (m) return pick(m[2], m[1], "Esperado", "Obtenido");
    m = /\bleft:\s*(.+?)\s+right:\s*(.+)$/.exec(line);
    if (m) return pick(m[1], m[2], "left", "right");
    m = /AssertionError(?: \[ERR_ASSERTION\])?:\s*(.+?)\s*(!==?)\s*(.+)$/.exec(line);
    if (m) return m[2] === "!==" ? pick(m[3], m[1], "Esperado", "Obtenido") : pick(m[1], m[3], "Primero", "Segundo");
  }
  // Rust con el formato en varias líneas:  left: 9  /  right: 7
  const log = r.log ?? "";
  const l = /^\s*left:\s*(.+)$/m.exec(log), rr = /^\s*right:\s*(.+)$/m.exec(log);
  return l && rr ? pick(l[1], rr[1], "left", "right") : null;
}

/** Las dos versiones con la parte que difiere marcada (prefijo y sufijo comunes quedan sin marcar). */
function diffView(x) {
  const cut = (s) => (s.length > 240 ? `${s.slice(0, 240)}…` : s);
  const a = cut(x.a), b = cut(x.b);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const mark = (s, cls) => `${esc(s.slice(0, pre))}<mark class="${cls}">${esc(s.slice(pre, s.length - suf))}</mark>${esc(s.slice(s.length - suf))}`;
  return `<div class="diff ${x.la === "Esperado" ? "known" : ""}" aria-label="${t("Comparación")}">
    <div class="diff-row"><span class="diff-l">${esc(t(x.la))}</span><code>${mark(a, "a")}</code></div>
    <div class="diff-row"><span class="diff-l">${esc(t(x.lb))}</span><code>${mark(b, "b")}</code></div>
  </div>`;
}

// ---------- inicio ----------
const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? t("Qué hora para programar") : h < 13 ? t("Buenos días") : h < 20 ? t("Buenas tardes") : t("Buenas noches");
};
async function home() {
  shell("home", crumb([{ label: t("Inicio") }]), flameChip(), loading);
  await loadGlobals();
  const courses = [...S.courses].sort((a, b) => Number(b.started) - Number(a.started) || b.updatedAt.localeCompare(a.updatedAt));
  const p = S.profile;
  const started = courses.filter((c) => c.started);
  const active = started.filter((c) => c.done < c.total);
  const failing = courses.flatMap((c) => (c.failing ?? []).map((f) => ({ ...f, slug: c.slug, course: c.title })));

  // El detalle de los cursos en curso da la próxima etapa de cada uno; la actividad, la semana.
  const [details, rawEvents] = await Promise.all([
    Promise.all(active.map((c) => fetchCourse(c.slug).catch(() => null))),
    api("/activity").catch(() => []),
  ]);
  const ready = details.filter(Boolean).flatMap((d) => d.issues.filter((i) => i.state === "ready").map((i) => ({ i, d })));
  const events = groupEvents(rawEvents);

  // Zeigarnik + Hick: lo que quedó a medias va primero, con una sola acción.
  let resume = "";
  const first = ready[0];
  if (first) {
    const { i, d } = first;
    const doneN = d.issues.filter((x) => x.state === "done").length;
    // Si el último push ya probó esta etapa y falló, el motivo va acá: es lo primero que hay que resolver.
    // Si solo llega al todo!() del esqueleto, está sin empezar: se muestra en gris, como en la etapa.
    const r = i.result;
    const last = !r || r.ok
      ? ""
      : r.kind === "todo"
        ? `<div class="resume-push todo">${ic("circle-dashed")}<span>${t("Sin empezar: el test alcanza el {code} del esqueleto", { code: "<code>todo!()</code>" })}</span>${whereLink(r)}</div>`
        : `<div class="resume-push">${ic("circle-x")}<span title="${esc(r.message ?? "")}">${esc(clip(r.message ?? t("El test falló"), 140))}</span>${whereLink(r)}</div>`;
    resume = `<div class="resume">
      <a class="resume-main" href="${A}/c/${esc(d.slug)}/${i.n}" data-link>
        <div class="grow"><div class="k">${t("Continúa con {curso}", { curso: esc(d.title) })}</div>
          <h2><span class="num">#${i.n}</span>${esc(i.title)}</h2>
          <div class="muted">${esc(milestoneGoal(d, i).text)}</div></div>
        <span class="btn primary">${t("Continuar")} ${ic("arrow-right")}</span></a>
      ${last}
    </div>`;
  }

  const anyDone = courses.some((c) => c.done > 0);

  // Etapas cerradas por día: salen de los eventos y del detalle de cada curso en curso (sin contar dos veces la misma).
  const dayKey = (d) => new Date(d).toLocaleDateString("en-CA");
  const closedAt = new Map();
  for (const e of rawEvents) if (e.kind === "done") closedAt.set(`${e.course}#${e.n}`, dayKey(e.at));
  for (const d of details) if (d) for (const i of d.issues) if (i.closedAt) closedAt.set(`${d.slug}#${i.n}`, dayKey(i.closedAt));
  const counts = new Map();
  for (const k of closedAt.values()) counts.set(k, (counts.get(k) ?? 0) + 1);
  const monday = new Date(p ? `${p.today}T12:00:00` : Date.now());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const doneWeek = [...closedAt.values()].filter((k) => k >= dayKey(monday)).length;
  // Sin cursos empezados: el catálogo es lo primero, como filas y no como tarjetas.
  const catalog = started.length
    ? ""
    : courses.length
      ? `<section class="hm-start"><div class="hm-h"><h2 class="eyebrow">${t("Elige tu primer curso")}</h2><a href="${A}/cursos" data-link>${t("Ver todos")}</a></div>
          <ul class="hm-rows">${courses.slice(0, 3).map((c) => courseLine(c, t("Ver el curso"))).join("")}</ul></section>`
      : noCourses();

  // Mis etapas: lo que falla primero, luego lo disponible, luego lo que aún no empezaste.
  const mine = details.filter(Boolean).flatMap((d) =>
    d.issues.filter((i) => i.state === "ready").map((i) => ({ i, d, kind: i.result && !i.result.ok && i.result.kind !== "todo" ? "fail" : i.result?.kind === "todo" ? "todo" : "ready" })));
  const nextCard = mine.length
    ? `<section class="mine"><div class="home-h"><h2>${t("Mis etapas")}</h2>
        <div class="seg" role="group" aria-label="${t("Filtrar etapas")}">${[["all", t("Todas"), mine.length], ["fail", t("Fallando"), failing_n(mine)], ["ready", t("Disponibles"), mine.filter((m) => m.kind !== "fail").length]]
          .map(([k, l, n]) => `<button type="button" data-f="${k}"${k === "fail" && !n ? " hidden" : ""}>${l} <span class="tnum">${n}</span></button>`).join("")}</div>
        <div class="seg" role="group" aria-label="${t("Agrupar por")}"><button type="button" data-g="state">${t("Estado")}</button><button type="button" data-g="course">${t("Curso")}</button></div>
        <span class="muted kbd-hint" title="${t("j k mover · Enter abrir · n continuar · f fallando · a todas · g agrupar")}"><kbd>j</kbd> <kbd>k</kbd> · <kbd>↵</kbd> · <kbd>g</kbd></span></div>
        <div class="mine-body"></div></section>`
    : "";
  const fresh = notStartedCard(courses);
  const never = S.health?.mcpClient?.state === "never";
  const nFail = failing_n(mine);
  const meta = started.length
    ? homeMeta({ p, doneWeek, failing: failing.length, href: nFail ? "#etapas" : `${A}/c/${failing[0]?.slug}/${failing[0]?.n}`, filter: nFail > 0 })
    : t("Elige un curso y resuelve la etapa 1.");
  const main = resume || nextCard
    ? `${resume}${nextCard}`
    : started.length ? empty("done", t("Todo al día"), t("No queda nada disponible. Elige otro curso cuando quieras.")) : "";
  const body = `<div class="wrap home">
    <div class="home-col">
      <div class="phead"><div><h1>${greeting()}${S.health?.user ? `, ${esc(S.health.user)}` : ""}</h1><p class="hm-meta">${meta}</p></div>${p && (started.length || p.active.length) ? contrib(p, 12, counts) : ""}</div>
      ${anyDone ? "" : firstSteps(courses)}${main ? `<div class="home-main" id="etapas">${main}</div>` : ""}
      ${catalog}
    </div>
    <aside class="rail">
      <section class="hm-recent"><div class="hm-h"><h2 class="eyebrow">${t("Recientes")}</h2><a href="${A}/actividad" data-link>${t("Ver todo")}</a></div>
        ${events.length ? `<ul class="feed">${events.slice(0, 5).map(eventRow).join("")}</ul>` : empty("activity", "", t("Aquí aparece cada push y cada etapa que cierres."))}</section>
      ${started.length ? fresh : ""}
      ${never ? assistantCard() : ""}
    </aside></div>`;
  shell("home", crumb([{ label: t("Inicio") }]), "", body);
  const draw = () => {
    const host = $app.querySelector(".mine-body");
    if (!host) return;
    S.homeFilter ??= "all";
    S.homeGroup ??= "state";
    S.homeOpen ??= new Set();
    host.innerHTML = mineList(mine, S.homeFilter, S.homeGroup, S.homeOpen);
    $app.querySelectorAll(".mine [data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.f === S.homeFilter)));
    $app.querySelectorAll(".mine [data-g]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.g === S.homeGroup)));
    paint();
  };
  $app.querySelectorAll(".mine [data-f]").forEach((b) => b.addEventListener("click", () => { S.homeFilter = b.dataset.f; draw(); }));
  $app.querySelectorAll(".mine [data-g]").forEach((b) => b.addEventListener("click", () => { S.homeGroup = b.dataset.g; draw(); }));
  $app.querySelector(".mine-body")?.addEventListener("click", (e) => {
    const m = e.target.closest("[data-more]");
    if (!m) return;
    S.homeOpen.add(m.dataset.more);
    draw();
  });
  $app.querySelector("[data-fail]")?.addEventListener("click", (e) => {
    e.preventDefault();
    S.homeFilter = "fail";
    draw();
    document.getElementById("etapas")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  homeApi = { draw, first: ready[0] ? `${A}/c/${ready[0].d.slug}/${ready[0].i.n}` : null, hasFail: nFail > 0 };
  draw();
  listNav();
}

const failing_n = (m) => m.filter((x) => x.kind === "fail").length;
const MINE_CAP = 8;
let homeApi = null;
/** Filas de «Mis etapas»: por estado o por curso (solo grupos con filas), con tope de MINE_CAP por grupo. */
function mineList(mine, filter, group, open) {
  const states = [["fail", t("Fallando"), "circle-x"], ["ready", t("Disponibles"), "circle"], ["todo", t("Sin empezar"), "circle-dashed"]];
  const pass = (m) => filter === "all" || (filter === "fail" ? m.kind === "fail" : m.kind !== "fail");
  const order = { fail: 0, ready: 1, todo: 2 };
  const groups = group === "course"
    ? [...new Map(mine.map((m) => [m.d.slug, m.d])).values()].map((d) => ({ key: d.slug, label: d.title, icon: "book-open", cls: "todo", list: mine.filter((m) => m.d === d && pass(m)).sort((a, b) => order[a.kind] - order[b.kind]) }))
    : states.map(([k, label, icon]) => ({ key: k, label, icon, cls: k, list: mine.filter((m) => m.kind === k && pass(m)) }));
  const row = ({ i, d, kind }) => {
    const ms = d.milestones.find((m) => m.id === i.milestone);
    const r = i.result;
    const mark = kind === "fail" ? `<span class="sr-only">${t("Fallando.")} </span>` : "";
    return `<li><a href="${A}/c/${esc(d.slug)}/${i.n}" data-link data-row><span class="num">#${i.n}</span>
      <span class="tt">${mark}${esc(i.title)}<small>${esc(d.title)} · ${esc(ms?.title ?? "")}</small></span>${kind === "fail" && r?.message ? `<span class="why" title="${esc(r.message)}">${esc(clip(r.message, 48))}</span>` : ""}${ic("arrow-right")}</a></li>`;
  };
  const out = groups
    .filter((g) => g.list.length)
    .map((g) => {
      const all = open.has(g.key);
      const shown = all ? g.list : g.list.slice(0, MINE_CAP);
      const rest = g.list.length - shown.length;
      return `<div class="ms-group"><div class="ms-gh st-${g.cls}">${ic(g.icon)}<b>${esc(g.label)}</b><span class="muted tnum">${g.list.length}</span></div>
        <ul class="next-list">${shown.map(row).join("")}</ul>${rest ? `<button type="button" class="ms-more" data-more="${esc(g.key)}">${t("Ver {n} más", { n: rest })}</button>` : ""}</div>`;
    })
    .join("");
  return out || (filter === "fail" ? empty("done", t("Ningún test falla"), t("Buen momento para avanzar con la siguiente.")) : empty("tests", t("No hay etapas disponibles"), t("Empieza un curso o espera a que se desbloquee la siguiente.")));
}

/** Atajos del inicio: j/k mueven el foco por las etapas, Enter abre, n continúa, f/a filtran, g agrupa. */
let listNavOn = false;
function listNav() {
  if (listNavOn) return;
  listNavOn = true;
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !homeApi || !document.querySelector(".mine")) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable || document.querySelector(".overlay")) return;
    const k = e.key;
    if (k === "j" || k === "k") {
      const rows = [...document.querySelectorAll(".mine [data-row]")];
      if (!rows.length) return;
      const at = rows.indexOf(document.activeElement);
      const row = rows[Math.max(0, Math.min(rows.length - 1, at < 0 ? 0 : at + (k === "j" ? 1 : -1)))];
      row.focus();
      row.scrollIntoView({ block: "nearest" });
    } else if (k === "n" && homeApi.first) navigate(homeApi.first);
    else if (k === "f") { S.homeFilter = S.homeFilter === "fail" ? "all" : "fail"; homeApi.draw(); }
    else if (k === "a") { S.homeFilter = "all"; homeApi.draw(); }
    else if (k === "g") { S.homeGroup = S.homeGroup === "course" ? "state" : "course"; homeApi.draw(); }
    else return;
    e.preventDefault();
  });
}

/**
 * Hick + ceguera a los banners: con cursos en marcha, la barra lateral ya los lista y crear uno nuevo
 * vive en Cursos y en la paleta. En el inicio solo quedan los que todavía no empezaste.
 */
function notStartedCard(courses) {
  const fresh = courses.filter((c) => !c.started);
  if (!fresh.length) return "";
  // El más reciente del catálogo que aún no empiezas; el resto queda a un clic en Cursos.
  const c = fresh[0];
  const more = fresh.length - 1;
  return `<section class="hm-next-course"><div class="hm-h"><h2 class="eyebrow">${t("Para seguir")}</h2><a href="${A}/cursos" data-link>${more ? t("{n} más sin empezar", { n: more }) : t("Ver todos")}</a></div>
    <ul class="hm-rows">${courseLine(c)}</ul></section>`;
}

/** Fila de un curso por empezar: nombre, lenguaje, tamaño y una flecha (con `cta`, también el verbo). */
function courseLine(c, cta = "") {
  return `<li><a class="hm-row" href="${A}/c/${esc(c.slug)}" data-link>
    <span class="hm-row-t"><b title="${esc(c.title)}">${esc(c.title)}</b><small>${langTag(c)}<span>${c.total ? plural(c.total, "etapa", "etapas") : t("Sin etapas")}</span></small></span>
    <span class="go">${cta}${ic("arrow-right")}</span></a></li>`;
}

/** La línea bajo el saludo: racha, etapas de la semana y estado de los tests, en texto corrido con íconos. */
function homeMeta({ p, doneWeek, failing, href, filter }) {
  const bit = (cls, icon, text) => `<span class="${cls}">${ic(icon)}${text}</span>`;
  return [
    p ? bit(p.streak ? "on" : "", "flame", p.streak ? t(p.streak === 1 ? "{n} día de racha" : "{n} días de racha", { n: p.streak }) : t("Sin racha")) : "",
    bit("", "check", t(doneWeek === 1 ? "{n} etapa esta semana" : "{n} etapas esta semana", { n: doneWeek })),
    failing
      ? `<a class="bad" href="${href}"${filter ? " data-fail" : " data-link"}>${ic("x")}${plural(failing, "test falla", "tests fallan")}</a>`
      : bit("ok", "check", t("Ningún test falla")),
  ].join("");
}

/** Paradox of the active user: nadie lee el README; los primeros pasos van en la cara, y se tachan solos. */
function firstSteps(courses) {
  const started = courses.some((c) => c.started);
  const steps = [
    { ok: started, t: t("Empieza un curso"), d: t("Se crea tu repositorio privado con las etapas y sus tests.") },
    { ok: false, t: t("Instala el CLI"), d: t("{cmd1} en el repositorio de byox. Es opcional: {cmd2} te indica qué falló y dónde.", { cmd1: "<code>cargo install --path cli</code>", cmd2: "<code>byox test</code>" }) },
    { ok: false, t: t("Clona tu repositorio y resuelve la primera etapa"), d: t("El esqueleto ya compila y trae los tests de cada etapa.") },
    { ok: false, t: t("Haz push a main"), d: t("Si el test pasa, la etapa se completa y se desbloquea la siguiente.") },
  ];
  const n = steps.filter((s) => s.ok).length;
  return `<section class="hm-steps"><div class="hm-h"><h2 class="eyebrow">${t("Primeros pasos")}</h2><span class="muted tnum">${t("{n} de {total}", { n, total: steps.length })}</span></div>
    <ol class="checklist">${steps.map((s) => `<li class="${s.ok ? "ok" : ""}"><span class="tick">${s.ok ? ic("check") : ""}</span><div><b>${s.t}</b><p>${s.d}</p></div></li>`).join("")}</ol></section>`;
}

/** Mini gráfico de actividad: una columna por semana (lunes a domingo), sin rótulos ni leyenda; el detalle va en cada celda. */
function contrib(p, weeks, counts) {
  const active = new Set(p.active);
  const today = new Date(`${p.today}T12:00:00`);
  const start = new Date(today);
  start.setDate(today.getDate() - ((weeks - 1) * 7 + ((today.getDay() + 6) % 7)));
  let cells = "", count = 0;
  for (let k = 0; k < weeks * 7; k++) {
    const d = new Date(start);
    d.setDate(start.getDate() + k);
    if (d > today) { cells += '<i class="fut"></i>'; continue; }
    const key = d.toLocaleDateString("en-CA");
    const on = active.has(key);
    if (on) count++;
    const n = counts?.get(key) ?? 0;
    const lv = !on ? "" : n >= 7 ? " l4" : n >= 4 ? " l3" : n >= 2 ? " l2" : " l1";
    const what = !on ? t("Sin actividad") : n ? plural(n, "etapa completada", "etapas completadas") : t("Con actividad");
    const label = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(d);
    cells += `<i class="${on ? "on" : ""}${lv}${key === p.today ? " today" : ""}" title="${what} · ${label}"></i>`;
  }
  return `<div class="gh" role="img" aria-label="${t("{dias} con actividad en las últimas {weeks} semanas", { dias: plural(count, "día", "días"), weeks })}">${cells}</div>`;
}

// ---------- asistente (el MCP) ----------
const mcpUrl = () => `${location.origin}/mcp`;
const mcpCmd = () => `claude mcp add --transport http byox ${mcpUrl()} --header "Authorization: Bearer byox_…"`;
const CLIENT_NAMES = { "claude-code": "Claude Code", "claude-ai": "Claude", cursor: "Cursor", vscode: "VS Code" };

/** El MCP no tiene sesiones: "conectado" es que un cliente lo usó en los últimos minutos. */
function mcpInfo() {
  const m = S.health?.mcpClient;
  if (!m) return { led: "", label: t("Asistente"), detail: t("Comprobando…") };
  const who = m.client ? CLIENT_NAMES[m.client.name] ?? m.client.name : t("Asistente");
  const tool = m.lastTool ? t("Última herramienta: {name}, {when}.", { name: m.lastTool.name, when: ago(m.lastTool.at) }) : "";
  if (m.state === "active") return { led: "ok", label: t("{who} conectado", { who }), detail: tool || t("Actividad {when}.", { when: ago(m.lastSeen) }) };
  if (m.state === "idle") return { led: "idle", label: t("{who} inactivo", { who }), detail: t("Última actividad {when}. {tool}", { when: ago(m.lastSeen), tool }) };
  return { led: "warn", label: t("Conectar asistente"), detail: t("Ningún asistente usó el MCP de byox todavía.") };
}
const mcpChip = () => {
  const m = mcpInfo();
  return `<button class="chip mcp" data-act="mcp" title="${esc(m.detail)}"><span class="led ${m.led}"></span>${esc(m.label)}</button>`;
};
const cmdBox = (cmd) =>
  `<div class="clone"><code title="${esc(cmd)}">${esc(cmd)}</code><button class="icon-btn" data-copy="${esc(cmd)}" aria-label="${t("Copiar")}">${ic("copy")}</button></div>`;

function assistantCard() {
  const m = mcpInfo();
  const never = S.health?.mcpClient?.state === "never";
  return `<section class="assistant"><div class="hm-h"><h2 class="eyebrow">${t("Asistente")}</h2><button class="link" data-act="mcp">${t("Detalles")}</button></div>
    <div class="as-state"><span class="led ${m.led}"></span><b>${esc(m.label)}</b></div>
    <p class="muted">${esc(m.detail)}</p>
    ${never ? `<p>${t("Conecta Claude Code para crear, verificar y publicar cursos:")}</p>${cmdBox(mcpCmd())}` : ""}
  </section>`;
}

function mcpDialog() {
  const m = mcpInfo();
  const el = document.createElement("div");
  el.className = "overlay";
  el.innerHTML = `<div class="modal mcp-modal" role="dialog" aria-modal="true" aria-labelledby="mcpt">
    <button class="icon-btn x" aria-label="${t("Cerrar")}">${ic("x")}</button>
    <h2 id="mcpt">${t("Asistente")}</h2>
    <div class="as-state"><span class="led ${m.led}"></span><b>${esc(m.label)}</b></div>
    <p class="muted">${esc(m.detail)}</p>
    <h3>${t("Conectar Claude Code")}</h3>
    <p>${t("Crea un token en {cuenta}, cámbialo por {token} y ejecuta el comando una vez. Después, Claude Code puede usar las herramientas de byox en cualquier proyecto.", { cuenta: `<a href="${A}/cuenta" data-link>${t("Cuenta")}</a>`, token: "<code>byox_…</code>" })}</p>
    ${cmdBox(mcpCmd())}
    <h3>${t("Mientras haces un curso")}</h3>
    <ul class="tools">
      <li><code>where_am_i</code>: ${t("tu progreso, las etapas disponibles y los tests que fallan.")}</li>
      <li><code>explain_failure</code>: ${t("por qué falla un test, con el log y tu código en ese commit.")}</li>
      <li><code>get_stage</code> ${t("y")} <code>get_hint</code>: ${t("la consigna de una etapa y la siguiente pista.")}</li>
      <li><code>ci_status</code>, <code>read_my_code</code> ${t("y")} <code>my_stats</code>: ${t("el último push, tu repositorio y tu racha.")}</li>
    </ul>
    <h3>${t("Para crear cursos")}</h3>
    <ul class="tools">
      <li><code>write_course_files</code> ${t("y")} <code>validate_course</code>: ${t("escribir un curso y revisar su formato y su grafo.")}</li>
      <li><code>verify_course</code>: ${t("ejecutar los tests contra el esqueleto y la solución de referencia.")}</li>
      <li><code>start_course</code>: ${t("publicar tu repositorio del curso.")}</li>
    </ul>
    <h3>${t("Comandos en Claude Code")}</h3>
    <ul class="tools">
      <li><code>/mcp__byox__atascado</code>: ${t("ayuda con la etapa en la que estás, sin darte la solución.")}</li>
      <li><code>/mcp__byox__que_sigue</code>: ${t("tu progreso y qué etapa conviene hacer ahora.")}</li>
      <li><code>/mcp__byox__revisar_etapa</code>: ${t("revisión de tu código de una etapa completada.")}</li>
      <li><code>/mcp__byox__crear_curso</code>: ${t("crea, verifica y publica un curso nuevo.")}</li>
    </ul>
    <p class="muted">${t("El estado se calcula según la actividad: el asistente figura como conectado si usó el MCP en los últimos 15 minutos.")}</p>
  </div>`;
  document.body.append(el);
  paint();
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  el.addEventListener("click", (e) => (e.target === el || e.target.closest(".x")) && close());
}

/** Crear un curso es pedírselo al asistente: ejemplos listos para copiar. */
function newCourseCard(compact = false) {
  // Se le piden al asistente en el idioma de la interfaz.
  const prompts = [
    t("Crea un curso de byox para construir un servidor HTTP desde cero en Go."),
    t("Crea un curso de byox de 10 etapas para escribir un intérprete de Lisp en Python."),
    t("Crea un curso de byox sobre un almacén clave-valor con persistencia en Rust."),
  ];
  const connected = S.health?.mcpClient && S.health.mcpClient.state !== "never";
  const list = `<ul class="prompts">${prompts.map((p) => `<li><span>${esc(p)}</span><button class="icon-btn" data-copy="${esc(p)}" data-what="${t("Instrucción copiada")}" aria-label="${t("Copiar")}">${ic("copy")}</button></li>`).join("")}</ul>`;
  // En Cursos el botón "Nuevo curso" ya está arriba: las ideas quedan plegadas para no repetir la acción.
  if (compact) return `<details class="card new-course fold"><summary><span>${t("Ideas para pedirle a tu asistente")}</span>${ic("chevron-right")}</summary><div class="card-b">${list}</div></details>`;
  return `<div class="card new-course"><div class="card-h"><span>${t("Crea un curso nuevo")}</span><button class="link" data-act="mcp">${connected ? t("Ver herramientas") : t("Conectar asistente")}</button></div><div class="card-b">
    <p class="muted">${t("Pídeselo a tu asistente. Lo escribe, ejecuta los tests contra una solución de referencia y lo publica cuando todo pasa.")}</p>
    ${list}
  </div></div>`;
}

const courseState = (c) =>
  !c.started
    ? `<span class="badge new">${t("Sin empezar")}</span>`
    : c.failing?.length
      ? `<span class="badge fail">${plural(c.failing.length, "test falla", "tests fallan")}</span>`
      : c.done === c.total
        ? `<span class="badge fin">${t("Terminado")}</span>`
        : `<span class="badge on">${t("En curso")}</span>`;
const fakeIssues = (c) => Array.from({ length: c.total }, (_, k) => ({ n: k + 1, state: k < c.done ? "done" : "locked" }));

function courseRow(c) {
  return `<tr data-href="${A}/c/${esc(c.slug)}">
    <td><div class="t1">${esc(c.title)} ${originBadge(c)}</div><div class="t2">${langTag(c)}<span class="desc" title="${esc(c.description)}">${esc(clip(c.description, 90))}</span></div></td>
    <td><div class="prog">${c.total ? segsOf(c) : ""}<span class="tnum muted">${c.done}/${c.total}</span></div></td>
    <td>${courseState(c)}</td>
    <td class="t2 when">${c.started ? ago(c.updatedAt) : "—"}</td></tr>`;
}
const noCourses = () => empty("courses", t("Aún no hay cursos"), t("Pídele al asistente que cree el primero con el MCP de byox."), `<button class="btn primary" data-act="new-course">${t("Crear un curso")}</button>`);
const coursesTable = (rows) =>
  rows ? `<table class="table"><thead><tr><th>${t("Curso")}</th><th>${t("Progreso")}</th><th>${t("Estado")}</th><th>${t("Actividad")}</th></tr></thead><tbody>${rows}</tbody></table>` : noCourses();

/** Tarjeta del catálogo: lo justo para decidir (lenguaje, tamaño, de qué trata) y una sola acción. */
function courseCard(c) {
  const cta = !c.started ? t("Ver el curso") : c.done === c.total ? t("Repasar") : t("Continuar");
  return `<a class="ccard" href="${A}/c/${esc(c.slug)}" data-link>
    <div class="ccard-top">${langTag(c)}<span class="tags">${originBadge(c)}${courseState(c)}</span></div>
    <h3>${esc(c.title)}</h3>
    <p>${esc(clip(c.description, 140))}</p>
    ${c.topics?.length ? `<div class="topics">${c.topics.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="ccard-foot"><div class="prog">${c.total ? segsOf(c) : ""}<span class="tnum muted">${c.started ? `${c.done}/${c.total}` : plural(c.total, "etapa", "etapas")}</span></div>
      <span class="go">${cta} ${ic("arrow-right")}</span></div>
  </a>`;
}

/**
 * Chunking: un push que cierra seis etapas es un evento, no seis. Junta las etapas cerradas seguidas
 * del mismo curso y, si las cerró un push, las cuelga de ese push.
 */
function groupEvents(events) {
  const out = [];
  const near = (a, b, min) => Math.abs(Date.parse(a) - Date.parse(b)) <= min * 60_000;
  for (const e of events) {
    const last = out.at(-1);
    if (e.kind === "done") {
      if (last?.kind === "done" && last.course === e.course && !last.push && near(last.oldest, e.at, 10)) {
        last.items.push(e);
        last.oldest = e.at;
      } else out.push({ kind: "done", course: e.course, at: e.at, oldest: e.at, items: [e] });
    } else if (last?.kind === "done" && last.course === e.course && !last.push && Date.parse(last.oldest) >= Date.parse(e.at) && near(last.oldest, e.at, 15)) {
      last.push = e;
    } else out.push(e);
  }
  return out;
}

function eventRow(e) {
  const course = (S.courses ?? []).find((c) => c.slug === e.course);
  const ctitle = esc(course?.title ?? e.course);
  const stage = (x) => `<a href="${A}/c/${esc(e.course)}/${x.n}" data-link>#${x.n}</a>`;
  if (e.kind === "push") {
    return `<li><span class="ico push">${ic("git-commit-horizontal")}</span><div class="what" title="${esc(e.title)}">${esc(clip(e.title, 60))}<div class="sub">${ctitle} · <code>${esc(e.sha.slice(0, 7))}</code></div></div><time>${ago(e.at)}</time></li>`;
  }
  const items = [...e.items].reverse();
  const head =
    items.length === 1
      ? `<a href="${A}/c/${esc(e.course)}/${items[0].n}" data-link>${t("Completaste {etapa}", { etapa: `<b>#${items[0].n} ${esc(items[0].title)}</b>` })}</a>`
      : `${t("Completaste {etapas}", { etapas: `<b>${t("{n} etapas", { n: items.length })}</b>` })} <span class="stages-list">${items.map(stage).join(" ")}</span>`;
  const sub = e.push ? `${ctitle} · <code>${esc(e.push.sha.slice(0, 7))}</code> ${esc(e.push.title)}` : ctitle;
  return `<li><span class="ico done">${ic("check")}</span><div class="what">${head}<div class="sub">${sub}</div></div><time>${ago(e.at)}</time></li>`;
}

// ---------- cursos y actividad ----------
async function coursesPage() {
  shell("courses", crumb([{ label: t("Cursos") }]), "", loading);
  await loadGlobals();
  const courses = [...S.courses].sort((a, b) => Number(b.started) - Number(a.started) || a.title.localeCompare(b.title));
  shell(
    "courses",
    crumb([{ label: t("Cursos") }]),
    "",
    `<div class="wrap"><div class="phead"><div><h1>${t("Cursos")}</h1><p>${t("{n}. Puedes crear más con tu asistente, desde una plantilla o importando un código.", { n: plural(courses.length, "curso disponible", "cursos disponibles") })}</p></div>
      <div class="phead-actions"><button class="btn" data-act="import">${ic("upload")}${t("Importar")}</button><button class="btn primary" data-act="new-course">${ic("plus")}${t("Nuevo curso")}</button></div></div>
      ${courses.length ? `<div class="cgrid">${courses.map(courseCard).join("")}</div>` : `<div class="card">${noCourses()}</div>`}
      ${newCourseCard(true)}</div>`,
  );
}

async function activityPage() {
  shell("activity", crumb([{ label: t("Actividad") }]), "", loading);
  const [raw] = await Promise.all([api("/activity").catch(() => []), S.courses ? null : loadGlobals()]);
  const events = groupEvents(raw);
  let html = "";
  let lastDay = "";
  for (const e of events) {
    const d = new Date(e.at);
    const day = d.toLocaleDateString(locale === "es" ? "es-AR" : locale, { weekday: "long", day: "numeric", month: "long" });
    if (day !== lastDay) html += `<li class="day">${day[0].toUpperCase() + day.slice(1)}</li>`;
    lastDay = day;
    html += eventRow(e);
  }
  shell(
    "activity",
    crumb([{ label: t("Actividad") }]),
    "",
    `<div class="wrap" style="max-width:820px"><div class="phead"><div><h1>${t("Actividad")}</h1><p>${t("Tus push y etapas completadas en todos los cursos.")}</p></div></div>
      <div class="card">${html ? `<ul class="feed">${html}</ul>` : empty("activity", t("Aún no hay actividad"), t("Cuando hagas push o cierres una etapa, lo verás aquí."))}</div></div>`,
  );
}

// ---------- curso ----------
async function coursePage(slug, n) {
  if (ctx?.slug !== slug) {
    stopPolling();
    shell("course", crumb([{ label: t("Cursos"), href: `${A}/cursos` }, { label: esc(courseName(slug)) }]), "", loading);
    const [course] = await Promise.all([fetchCourse(slug), S.courses ? null : loadGlobals()]);
    ctx = { slug, course, run: null, issueCache: new Map() };
  }
  const c = ctx.course;
  if (!c.started) return notStarted(c);
  // Sin etapa (/c/<curso>) es la portada: el README del curso.
  ctx.n = n ?? null;
  ctx.tab = "instrucciones";
  renderCourse();
  startPolling();
  loadIssue();
}

function notStarted(c) {
  shell(
    "course",
    crumb([{ label: t("Cursos"), href: `${A}/cursos` }, { label: esc(c.title) }]),
    "",
    `<div class="wrap" style="max-width:720px"><div class="phead"><div><h1>${esc(c.title)}</h1>${originBadge(c) ? `<p class="ph-meta">${originBadge(c)}${c.author ? `<span>${t("por {name}", { name: esc(c.author) })}</span>` : ""}</p>` : ""}<p>${esc(c.description)}</p></div></div>
      <div class="card"><div class="card-b">
        <p style="margin:0 0 14px">${t("Al empezar se crea tu repositorio privado con {n}, sus dependencias y los tests.", { n: plural(c.issues.length, "etapa", "etapas") })}</p>
        <div class="actions"><button class="btn primary" id="startBtn">${t("Empezar el curso")}</button><button class="btn" data-act="share" data-slug="${esc(c.slug)}">${ic("share-2")}${t("Compartir")}</button><span class="muted" id="startMsg"></span></div>
      </div></div><div class="md readme" id="md"></div></div>`,
  );
  loadReadme(c.slug).then((html) => {
    const md = document.getElementById("md");
    if (md && ctx?.slug === c.slug && !ctx.course.started) {
      md.innerHTML = html;
      enhanceMd(md);
    }
  });
  document.getElementById("startBtn").onclick = async (e) => {
    e.target.disabled = true;
    document.getElementById("startMsg").innerHTML = `<span class="spin"></span> ${t("Creando tu repositorio…")}`;
    try {
      await api(`/courses/${encodeURIComponent(c.slug)}/start`, { method: "POST" });
      ctx = null;
      S.courses = null;
      toast(t("Curso creado"));
      route();
    } catch (err) {
      document.getElementById("startMsg").textContent = err.message;
      e.target.disabled = false;
    }
  };
}

/** Falla de verdad: no cuenta una etapa sin empezar (el test llega al todo!() del esqueleto). */
const failing = (i) => i.state !== "done" && i.result && !i.result.ok && i.result.kind !== "todo";

function runChip() {
  const r = ctx?.run;
  const c = ctx?.course;
  if (!r || !c) return "";
  const sha = `<code>${esc(r.sha.slice(0, 7))}</code>`;
  if (r.state === "pending") return `<a class="chip" ${r.url ? `href="${esc(r.url)}" target="_blank" rel="noopener"` : ""}><span class="led busy"></span>${t("Ejecutando tests en {sha}", { sha })}</a>`;
  const fails = c.issues.filter((i) => i.state === "ready" && failing(i));
  if (fails.length) {
    const f = fails.find((i) => i.n === ctx.n) ?? fails[0];
    return `<a class="chip bad" href="${A}/c/${esc(c.slug)}/${f.n}" data-link title="${esc(f.result.message ?? "")}"><span class="led down"></span>${fails.length === 1 ? t("#{n} falla en {sha}", { n: f.n, sha }) : t("{n} etapas fallan en {sha}", { n: fails.length, sha })}</a>`;
  }
  if (r.state === "none") return `<span class="chip"><span class="led"></span>${t("Sin tests en {sha}", { sha })}</span>`;
  return `<a class="chip" ${r.url ? `href="${esc(r.url)}" target="_blank" rel="noopener"` : ""} title="${esc(r.message)}"><span class="led ok"></span>${t("Tests al día")} · ${sha} · ${ago(r.at)}</a>`;
}

function courseActions() {
  return `${mcpChip()}<span id="run-chip">${runChip()}</span>
    <a class="chip" href="${esc(ctx.course.repoUrl)}" target="_blank" rel="noopener" title="${t("Abrir el repositorio en Forgejo")}">${ic("git-branch")}Repo</a>
    ${flameChip()}`;
}

function renderCourse() {
  const c = ctx.course;
  const crumbs = [{ label: t("Cursos"), href: `${A}/cursos` }, { label: esc(c.title), href: `${A}/c/${esc(c.slug)}` }];
  if (ctx.n) crumbs.push({ label: `#${ctx.n}` });
  shell(
    "course",
    crumb(crumbs),
    courseActions(),
    `<div class="course"><nav class="track" id="track" aria-label="${t("Etapas")}"></nav><main class="main" id="main"></main><aside class="aside" id="aside"></aside></div>`,
  );
  renderTrack();
  renderMain();
  renderAside();
}

function renderTrack() {
  const c = ctx.course;
  const track = document.getElementById("track");
  if (!track) return;
  const scroll = track.scrollTop;
  const doneN = c.issues.filter((i) => i.state === "done").length;
  // Chunking: los tramos terminados se pliegan solos, salvo el que tiene la etapa abierta.
  ctx.collapsed ??= new Set(c.milestones.filter((m) => c.issues.filter((i) => i.milestone === m.id).every((i) => i.state === "done")).map((m) => m.id));
  const open = c.issues.find((i) => i.n === ctx.n)?.milestone;
  let items = "";
  for (const m of c.milestones) {
    const list = c.issues.filter((i) => i.milestone === m.id);
    const d = list.filter((i) => i.state === "done").length;
    const folded = ctx.collapsed.has(m.id) && m.id !== open;
    const prevDone = c.issues.filter((i) => i.n < list[0]?.n).every((i) => i.state === "done");
    items += `<li class="${[prevDone && list[0]?.state === "done" ? "lit" : "", folded ? "folded" : ""].join(" ").trim()}"><button class="ms-row" data-fold="${esc(m.id)}" aria-expanded="${!folded}">
      <span class="label">${esc(m.title)}</span><span class="n">${d === list.length ? ic("check") : ""}${d}/${list.length}</span>${ic("chevron-right")}</button></li>`;
    if (folded) continue;
    for (const i of list) {
      const cls = `stage ${i.state}${i.n === ctx.n ? " cur" : ""}${failing(i) && i.state === "ready" ? " fail" : ""}`;
      items += `<li class="${i.state === "done" ? "lit" : ""}"><a class="${cls}" href="${A}/c/${esc(c.slug)}/${i.n}" data-link data-tip="${esc(i.title)}${failing(i) && i.state === "ready" ? ` · ${t("el test falla:")} ${esc(i.result.message ?? "")}` : ""}">
        <span class="node">${i.state === "done" ? ic("check") : ""}</span><span class="sn">${i.n}</span><span class="st">${esc(i.title)}</span>
        ${failing(i) && i.state === "ready" ? `<span class="fail-dot" aria-label="${t("el test falla")}"></span>` : ""}</a></li>`;
    }
  }
  track.innerHTML = `<div class="track-h">${segs(c.issues, ctx.n)}<div class="t"><span>${t("{n} de {total} etapas", { n: doneN, total: c.issues.length })}</span><span class="mono">${esc(c.image)}</span></div></div><ol class="stages">${items}</ol>`;
  paint();
  track.scrollTop = scroll;
  trackTips(track);
  if (!ctx.centered) {
    const cur = track.querySelector(".stage.cur");
    const center = () => {
      const y = cur.getBoundingClientRect().top - track.getBoundingClientRect().top + track.scrollTop;
      track.scrollTop = Math.max(0, y - track.clientHeight / 2);
      ctx.centered = true;
    };
    if (cur && track.clientHeight) center();
    else if (cur) new ResizeObserver((_, ro) => track.clientHeight && (center(), ro.disconnect())).observe(track);
  }
}

// Tooltip propio de las etapas: el `title` nativo se dibuja sobre la línea del track.
// Un único nodo fijo, a la derecha del panel; solo aparece si el título está truncado (o la etapa falla).
function trackTips(track) {
  if (track._tips) return track._tips.hide();
  let tip = document.querySelector(".track-tip");
  if (!tip) document.body.append((tip = Object.assign(document.createElement("div"), { className: "track-tip" })));
  tip.setAttribute("aria-hidden", "true");
  const hide = () => tip.classList.remove("on");
  const show = (e) => {
    const a = e.target.closest?.(".stage[data-tip]");
    if (!a) return hide();
    const st = a.querySelector(".st");
    if (st.scrollWidth <= st.clientWidth && !a.classList.contains("fail")) return hide();
    tip.textContent = a.dataset.tip;
    const r = a.getBoundingClientRect(), t = track.getBoundingClientRect();
    tip.style.left = `${t.right + 8}px`;
    tip.style.top = `${r.top + r.height / 2}px`;
    tip.classList.add("on");
  };
  track.addEventListener("mouseover", show);
  track.addEventListener("focusin", show);
  for (const ev of ["mouseleave", "focusout", "scroll", "click"]) track.addEventListener(ev, hide);
  track.addEventListener("keydown", (e) => e.key === "Escape" && hide());
  track._tips = { hide };
}

function failBlock(r, i) {
  if (!r || r.ok || i.state === "done") return "";
  if (r.kind === "todo") {
    // Esqueleto sin tocar: no es una falla, pero el lugar donde empezar sí sirve.
    return i.state === "locked"
      ? ""
      : `<section class="failbox soft" aria-label="${t("Resultado del último test")}"><div class="fail-h">${ic("circle-dashed")}<b>${t("Sin empezar")}</b>
          <span class="muted">${t("el test alcanza el {code} del esqueleto", { code: "<code>todo!()</code>" })}</span>${r.where ? `<span style="margin-left:auto">${whereLink(r)}</span>` : ""}</div></section>`;
  }
  const lines = (r.log ?? "").split("\n");
  const hl = new Set(r.highlight ?? []);
  const log = lines.map((l, k) => `<span class="${hl.has(k) ? "hl" : ""}">${esc(l) || " "}</span>`).join("\n");
  const locked = i.state === "locked";
  return `<section class="failbox ${locked ? "soft" : ""}" aria-label="${t("Resultado del último test")}">
    <div class="fail-h">${ic(locked ? "info" : "circle-x")}<b>${locked ? t("El test falla, como se espera de una etapa bloqueada") : t("El test falló")}</b>
      <span class="muted">${t("en {sha}, {when}", { sha: `<code>${esc(r.sha.slice(0, 7))}</code>`, when: ago(r.at) })}</span>
      ${r.runUrl ? `<a class="chip" href="${esc(r.runUrl)}" target="_blank" rel="noopener">${ic("external-link")}Run</a>` : ""}</div>
    ${locked ? "" : `<div class="fail-b">
      <p class="msg">${esc(r.message ?? t("El test terminó con error."))}</p>
      ${((x) => (x ? diffView(x) : ""))(expectation(r))}
      ${whereLink(r)}
      ${r.log ? `<details class="log"><summary>${t("Salida del test")}</summary><pre>${log}</pre></details>` : ""}
    </div>`}
  </section>`;
}

function renderMain() {
  const main = document.getElementById("main");
  if (!main) return;
  const c = ctx.course;
  if (ctx.n == null) return renderCover(main);
  const i = c.issues.find((x) => x.n === ctx.n);
  if (!i) return (main.innerHTML = empty("search", t("Esta etapa no existe"), t("Elige otra en la lista de etapas.")));
  const data = ctx.issueCache.get(i.n);
  const ms = c.milestones.find((m) => m.id === i.milestone);
  const tabs = [
    ["instrucciones", t("Instrucciones"), ""],
    ["pistas", t("Pistas"), `<span class="cnt">${data?.hints.length ?? 0}/${i.hints}</span>`],
    ["salida", t("Salida del test"), failing(i) && i.state === "ready" ? `<span class="cnt bad">${t("falla")}</span>` : ""],
    ["actividad", t("Actividad"), ""],
  ]
    .map(([id, label, extra]) => `<button class="tab ${ctx.tab === id ? "on" : ""}" data-tab="${id}" role="tab" aria-selected="${ctx.tab === id}">${label}${extra}</button>`)
    .join("");
  const missing = i.deps.filter((d) => c.issues.find((x) => x.n === d)?.state !== "done");
  const notice =
    i.state === "locked"
      ? `<div class="notice">${ic("lock")}<div><b>${t("Etapa bloqueada.")}</b> ${t("Primero completa {lista}. Puedes leer la consigna mientras tanto.", { lista: missing.map((d) => `<a href="${A}/c/${esc(c.slug)}/${d}" data-link>#${d}</a>`).join(` ${t("y")} `) })}</div></div>`
      : i.state === "done"
        ? `<div class="notice done">${ic("circle-check")}<div><b>${t("Completada {when}.", { when: ago(i.closedAt) })}</b> ${t("Los tests pasaron en tu repo.")}</div></div>`
        : "";

  const prev = c.issues.find((x) => x.n === i.n - 1);
  const next = c.issues.find((x) => x.n === i.n + 1);
  const pageLink = (x, dir) =>
    x
      ? `<a class="page-link ${dir}" href="${A}/c/${esc(c.slug)}/${x.n}" data-link><small>${dir === "prev" ? `${ic("arrow-left")} ${t("Anterior")}` : `${t("Siguiente")} ${ic("arrow-right")}`}</small><span><span class="num">#${x.n}</span>${esc(x.title)}</span></a>`
      : "<span></span>";

  let body;
  if (!data) body = `<div class="skeleton" aria-busy="true"><i style="width:30%"></i><i></i><i></i><i style="width:80%"></i><i class="block"></i></div>`;
  else if (ctx.tab === "pistas") body = hintsView(i, data);
  else if (ctx.tab === "actividad") body = activityView(data);
  else if (ctx.tab === "salida") body = outputView(i, data);
  else body = `${notice}<div class="md" id="md">${data.html}</div>${verifyBox(i)}<nav class="pager" aria-label="${t("Etapas vecinas")}">${pageLink(prev, "prev")}${pageLink(next, "next")}</nav>`;

  main.innerHTML = `<article class="article">
    <h1 class="title"><span class="num">#${i.n}</span>${esc(i.title)}</h1>
    <div class="props"><span class="badge ${i.state}">${STATE_LABEL[i.state]}</span><span class="sep"></span>
      <span class="p">${ic("milestone")}${esc(ms?.title ?? "")}</span>
      ${i.labels.length ? `<span class="sep"></span><span class="p">${ic("tag")}${i.labels.map(esc).join(", ")}</span>` : ""}
      ${data ? `<span class="sep"></span><a class="p" href="${esc(data.url)}" target="_blank" rel="noopener">${ic("external-link")}${t("Issue en Forgejo")}</a>` : ""}</div>
    ${data && ctx.tab === "instrucciones" ? failBlock(data.result ?? i.result, i) : ""}
    <nav class="tabs" role="tablist">${tabs}</nav>
    ${body}
  </article>`;
  paint();
  main.querySelectorAll(".md").forEach(enhanceMd);
  addCopyButtons(main);
  foldOptional();
}

/** Portada del curso: el progreso, cómo seguir y el README. */
function renderCover(main) {
  const c = ctx.course;
  const doneN = c.issues.filter((x) => x.state === "done").length;
  const next = c.issues.find((x) => x.state === "ready");
  const action = next
    ? `<a class="btn primary" href="${A}/c/${esc(c.slug)}/${next.n}" data-link>${t("Continuar con #{n}", { n: next.n })} ${ic("arrow-right")}</a>`
    : doneN === c.issues.length
      ? `<span class="badge fin">${t("Terminado")}</span>`
      : "";
  main.innerHTML = `<article class="article">
    <h1 class="title">${esc(c.title)}</h1>
    ${originBadge(c) ? `<div class="cover-origin">${originBadge(c)}${c.author ? `<span class="muted">${t("por {name}", { name: esc(c.author) })}</span>` : ""}</div>` : ""}
    ${c.description ? `<p class="muted cover-desc">${esc(c.description)}</p>` : ""}
    <div class="cover-bar">${segs(c.issues)}<span class="tnum muted">${t("{n} de {total} etapas", { n: doneN, total: c.issues.length })}</span><button class="btn" data-act="share" data-slug="${esc(c.slug)}" title="${t("Compartir el curso con un código")}">${ic("share-2")}${t("Compartir")}</button>${action}</div>
    ${c.newStages ? `<div class="notice upgrade">${ic("refresh-cw")}<div><b>${t("El curso tiene {n}.", { n: plural(c.newStages, "etapa nueva", "etapas nuevas") })}</b> ${t("Actualizar las suma a tu repo con sus tests; tu código y tu progreso no se tocan.")}</div><button class="btn" id="upgradeBtn">${t("Actualizar")}</button></div>` : ""}
    <div class="cover-tabs" role="tablist" aria-label="${t("Contenido del curso")}">
      <button role="tab" id="tab-readme" aria-controls="pane-readme" data-cover-tab="readme" aria-selected="${ctx.coverTab !== "mapa"}">README</button>
      <button role="tab" id="tab-mapa" aria-controls="pane-mapa" data-cover-tab="mapa" aria-selected="${ctx.coverTab === "mapa"}">${ic("milestone")}${t("Mapa de etapas")}</button>
    </div>
    <div role="tabpanel" id="pane-readme" aria-labelledby="tab-readme" ${ctx.coverTab === "mapa" ? "hidden" : ""}>
    <div class="md readme" id="md">${ctx.readme ?? '<div class="skeleton" aria-busy="true"><i style="width:30%"></i><i></i><i></i><i style="width:80%"></i></div>'}</div>
    </div>
    <div role="tabpanel" id="pane-mapa" aria-labelledby="tab-mapa" ${ctx.coverTab === "mapa" ? "" : "hidden"}>${stageMap(c)}</div>
  </article>`;
  paint();
  drawStageMap(main, c);
  main.querySelectorAll("[data-cover-tab]").forEach((b) => b.addEventListener("click", () => {
    ctx.coverTab = b.dataset.coverTab;
    renderMain();
  }));

  const up = document.getElementById("upgradeBtn");
  if (up)
    up.onclick = async () => {
      up.disabled = true;
      up.innerHTML = `<span class="spin"></span> ${t("Actualizando…")}`;
      try {
        await api(`/courses/${encodeURIComponent(c.slug)}/upgrade`, { method: "POST" });
        ctx = null;
        S.courses = null;
        toast(t("Curso actualizado"));
        route();
      } catch (err) {
        toast(err.message);
        up.disabled = false;
        up.textContent = t("Actualizar");
      }
    };
  if (ctx.readme == null) {
    const slug = c.slug;
    loadReadme(slug).then((html) => {
      if (ctx?.slug !== slug) return;
      ctx.readme = html || `<p class="muted">${t("Este curso no tiene README.")}</p>`;
      if (ctx.n == null) renderMain();
    });
    return;
  }
  enhanceMd(document.getElementById("md"));
}

// ---------- mapa de etapas (portada del curso) ----------
const MAP = { W: 760, label: 150, row: 46 };
const HOME_MAP = {};

function stageMap(c) {
  const done = c.issues.filter((i) => i.state === "done").length;
  const ready = c.issues.filter((i) => i.state === "ready");
  return `<section class="stage-map" data-map aria-label="${t("Mapa de etapas")}">
    <div class="sm-head">
      <div class="sm-stat">${t("{n} de {total} etapas", { n: `<b class="tnum">${done}</b>`, total: c.issues.length })}${ready.length ? ` · <span class="rdy">${plural(ready.length, "disponible", "disponibles")}</span>` : ""}</div>
      <div class="sm-tools">
        <div class="sm-legend" aria-hidden="true"><span class="done">${t("Completa")}</span><span class="ready">${t("Disponible")}</span><span class="locked">${t("Bloqueada")}</span></div>
        <button type="button" class="sm-only" aria-pressed="false">${t("Solo disponibles")}</button>
      </div>
    </div>
    ${ready.length ? `<div class="sm-jump"><span>${t("Disponibles")}</span><div data-jump></div><em>${t("Clic para ver el detalle · Enter para abrir")}</em></div>` : ""}
    <div class="sm-body">
      <div class="sm-board" data-focus="" data-only="">
        <svg viewBox="0 0 ${MAP.W} 10" role="group" aria-label="${t("{n} de {total} etapas completas. Usa las flechas para moverte, Espacio para ver el detalle y Enter para abrir la etapa.", { n: done, total: c.issues.length })}"></svg>
        <div class="sm-tip" role="tooltip" hidden></div>
      </div>
      <aside class="sm-panel" aria-live="polite">
        <div class="sp-a">
          <div class="sp-head"><span class="sp-n mono"></span><span class="sp-badge"></span></div>
          <h3 class="sp-title"></h3>
          <p class="sp-ms muted"></p>
        </div>
        <div class="sp-b">
          <div class="sp-sec"><span>${t("Requiere")}</span><div class="sp-chips" data-deps></div></div>
          <div class="sp-sec"><span>${t("Desbloquea")}</span><div class="sp-chips" data-opens></div></div>
        </div>
        <div class="sp-c">
          <button type="button" class="sp-cmd" title="${t("Copiar el comando")}"></button>
          <a class="btn sp-go" href="#" data-link>${t("Abrir etapa")} ${ic("arrow-right")}</a>
        </div>
      </aside>
    </div>
  </section>`;
}

function drawStageMap(root, c) {
  const box = root.querySelector("[data-map]");
  if (!box) return;
  const svg = box.querySelector("svg");
  const board = box.querySelector(".sm-board");
  const tip = box.querySelector(".sm-tip");
  const panel = box.querySelector(".sm-panel");
  const q = (sel) => panel.querySelector(sel);
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent?.appendChild(e);
    return e;
  };
  const mq = matchMedia("(max-width: 700px)");
  let W = MAP.W, x0 = 0, x1 = 0, narrow = false;
  const byN = new Map(c.issues.map((i) => [i.n, i]));
  const bands = c.milestones.map((m) => ({ m, list: c.issues.filter((i) => i.milestone === m.id) })).filter((b) => b.list.length);
  const allDone = (l) => l.every((i) => i.state === "done");
  // En la portada el estado vive en ctx; en el inicio, en un registro aparte.
  const st = ctx?.slug === c.slug ? ctx : (HOME_MAP[c.slug] ??= {});
  st.mapOpen ??= new Set();
  let sel = byN.has(st.mapSel) ? st.mapSel : (c.issues.find((i) => i.state === "ready") ?? c.issues[0])?.n;
  const bandOf = (n) => bands.find((b) => b.list.some((i) => i.n === n));
  const isFolded = (b) => bands.length > 1 && allDone(b.list) && !st.mapOpen.has(b.m.id);
  let nodes = new Map(), edges = [], pos = new Map(), first = true;

  function layout() {
    narrow = mq.matches;
    W = narrow ? 340 : MAP.W;
    x0 = narrow ? 18 : MAP.label + 12;
    x1 = W - 14;
    const ROW = narrow ? 40 : MAP.row;
    svg.replaceChildren();
    nodes = new Map(); edges = []; pos = new Map();
    let y = 0;
    bands.forEach((b, bi) => {
      const { m, list } = b;
      const doneN = list.filter((i) => i.state === "done").length;
      if (bi) el("line", { x1: 0, x2: W, y1: y, y2: y, class: "sm-sep" }, svg);
      const title = (t) => (t.length > 21 ? t.slice(0, 20) + "…" : t);

      if (isFolded(b)) {
        const g = el("g", { class: "sm-fold", role: "button", tabindex: 0, "aria-label": t("Mostrar el tramo {title}, completo", { title: m.title }) }, svg);
        const fh = narrow ? 54 : 46;
        el("rect", { x: 0, y, width: W, height: fh, class: "hit" }, g);
        el("text", { x: 0, y: y + (narrow ? 22 : 28), class: "sm-ms" }, g).textContent = title(m.title);
        if (narrow) el("line", { x1: 0, x2: W, y1: y + 38, y2: y + 38, class: "sm-fillbar" }, g);
        else el("line", { x1: x0, x2: x1 - 150, y1: y + 23, y2: y + 23, class: "sm-fillbar" }, g);
        el("text", { x: W, y: y + (narrow ? 22 : 28), class: "sm-count end" }, g).textContent = `✓ ${t("{n} de {total}", { n: doneN, total: list.length })} · ${t("Mostrar")}`;
        const open = () => { st.mapOpen.add(m.id); layout(); };
        g.addEventListener("click", open);
        g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open()));
        y += fh;
        return;
      }

      // Como mínimo 26 de separación entre nodos: los tramos largos pasan a varias filas parejas.
      const maxPer = Math.floor((x1 - x0) / 26) + 1;
      const rows = Math.ceil(list.length / Math.min(list.length, maxPer));
      const perRow = Math.ceil(list.length / rows);
      const gap = perRow > 1 ? Math.min((x1 - x0) / (perRow - 1), 56) : 0;
      const h = narrow ? rows * ROW + 38 : rows * ROW + 36;
      const foldable = bands.length > 1 && allDone(list);
      const lbl = el("text", { x: 0, y: y + (narrow ? 22 : 34), class: "sm-ms" }, svg);
      lbl.textContent = title(m.title);
      el("title", {}, lbl).textContent = m.title;
      el("text", { x: narrow ? W - (foldable ? 64 : 0) : 0, y: y + (narrow ? 22 : 54), class: narrow ? "sm-count end" : "sm-count" }, svg).textContent = t("{n} de {total}", { n: doneN, total: list.length });
      if (foldable) {
        const fold = el("text", { x: narrow ? W : 0, y: y + (narrow ? 22 : 74), class: narrow ? "sm-link end" : "sm-link", role: "button", tabindex: 0 }, svg);
        fold.textContent = t("Plegar");
        const close = () => { st.mapOpen.delete(m.id); layout(); };
        fold.addEventListener("click", close);
        fold.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), close()));
      }
      for (let r = 0; r < rows; r++) {
        const rowList = list.slice(r * perRow, (r + 1) * perRow);
        const cy = y + (narrow ? 50 : 36) + r * ROW;
        const xs = rowList.map((_, k) => x0 + k * gap);
        rowList.forEach((i, k) => pos.set(i.n, { x: xs[k], y: cy }));
        // La vía solo une etapas con dependencia directa: así se ven las ramas en paralelo.
        let linked = 0;
        for (let k = 0; k < rowList.length - 1; k++) {
          const a = rowList[k], bb = rowList[k + 1];
          if (!(bb.deps ?? []).includes(a.n)) continue;
          linked++;
          const cls = a.state === "done" && bb.state === "done" ? "done" : a.state === "done" && bb.state === "ready" ? "go" : "";
          el("line", { x1: xs[k], x2: xs[k + 1], y1: cy, y2: cy, class: `sm-seg ${cls}` }, svg);
        }
        if (!linked && rowList.length > 1) el("line", { x1: xs[0], x2: xs.at(-1), y1: cy, y2: cy, class: "sm-seg faint" }, svg);
      }
      y += h;
    });
    svg.setAttribute("viewBox", `0 0 ${W} ${y}`);

    const gEdges = el("g", { class: "sm-edges" }, svg);
    const gNodes = el("g", { class: "sm-nodes" }, svg);
    for (const i of c.issues) {
      for (const d of i.deps ?? []) {
        const a = pos.get(d), b = pos.get(i.n);
        if (!a || !b) continue;
        const same = Math.abs(a.y - b.y) < 1;
        const d_ = same
          ? `M${a.x} ${a.y - 12} C${a.x + 10} ${a.y - 44} ${b.x - 10} ${b.y - 44} ${b.x} ${b.y - 12}`
          : `M${a.x} ${a.y + (b.y > a.y ? 12 : -12)} C${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y + (b.y > a.y ? -12 : 12)}`;
        edges.push({ from: d, to: i.n, p: el("path", { d: d_ }, gEdges) });
      }
    }
    let k = 0;
    for (const i of c.issues) {
      const p = pos.get(i.n);
      if (!p) continue;
      const a = el("g", { class: `sm-n st-${i.state}`, transform: `translate(${p.x} ${p.y})`, role: "button", tabindex: -1, "aria-label": t("Etapa {n}, {title}: {state}", { n: i.n, title: i.title, state: STATE_LABEL[i.state] }) }, gNodes);
      a.style.setProperty("--k", first ? Math.min(k++, 60) : 0);
      el("circle", { r: 15, class: "hit" }, a);
      el("circle", { r: 17, class: "ring" }, a);
      el("circle", { r: i.state === "ready" ? 13 : 10.5, class: "disc" }, a);
      if (i.state === "done") el("path", { d: "M-4.5 .5 -1.5 3.6 4.7 -3.2", class: "tick" }, a);
      else el("text", { y: 0.5, class: i.n > 99 ? "n small" : "n" }, a).textContent = i.n;
      nodes.set(i.n, a);
      a.addEventListener("click", () => select(i.n));
      a.addEventListener("keydown", (e) => keyNode(e, i.n));
      a.addEventListener("pointerenter", () => { focusOn(i.n); showTip(i.n, a); });
      a.addEventListener("pointerleave", () => { focusOn(sel, false); showTip(null); });
      a.addEventListener("focus", () => { focusOn(i.n); showTip(i.n, a); });
      a.addEventListener("blur", () => { focusOn(sel, false); showTip(null); });
    }
    board.dataset.anim = first ? "1" : "";
    first = false;
    updateSel();
  }

  function relOf(n) {
    const deps = (byN.get(n)?.deps ?? []).filter((d) => byN.has(d));
    const opens = c.issues.filter((x) => (x.deps ?? []).includes(n)).map((x) => x.n);
    return { it: byN.get(n), deps, opens };
  }

  function focusOn(n, dim = true) {
    board.dataset.focus = n && dim ? "1" : "";
    const { deps, opens } = relOf(n);
    nodes.forEach((g, k) => g.classList.toggle("rel", !!n && (k === n || deps.includes(k) || opens.includes(k))));
    edges.forEach((e) => {
      e.p.classList.toggle("dep", !!n && e.to === n);
      e.p.classList.toggle("open", !!n && e.from === n);
    });
  }

  function showTip(n, a) {
    if (!n || n === sel) { tip.hidden = true; return; }
    const it = byN.get(n);
    tip.innerHTML = `<b>#${it.n} ${esc(it.title)}</b><span>${STATE_LABEL[it.state]}</span>`;
    tip.hidden = false;
    const br = board.getBoundingClientRect(), nr = a.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const left = Math.max(4, Math.min(br.width - tw - 4, nr.left - br.left + nr.width / 2 - tw / 2));
    const above = nr.top - br.top - tip.offsetHeight - 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${above >= 4 ? above : nr.bottom - br.top + 10}px`;
  }

  function chips(host, list, empty) {
    host.replaceChildren();
    if (!list.length) { const em = document.createElement("em"); em.textContent = empty; host.appendChild(em); return; }
    for (const n of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `chip ${byN.get(n).state}`;
      b.textContent = `#${n}`;
      b.title = byN.get(n).title;
      b.addEventListener("click", () => select(n));
      host.appendChild(b);
    }
  }

  // Teclado: una sola parada de Tab, flechas para moverse, Espacio selecciona y Enter abre.
  function keyNode(e, n) {
    if (e.key === "Enter") { e.preventDefault(); navigate(`${A}/c/${encodeURIComponent(c.slug)}/${n}`); return; }
    if (e.key === " ") { e.preventDefault(); select(n); return; }
    const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const a = pos.get(n);
    let best = null, bs = Infinity;
    for (const [k, p] of pos) {
      if (k === n) continue;
      const dx = p.x - a.x, dy = p.y - a.y;
      const along = dx * d[0] + dy * d[1], across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
      if (along <= 4) continue;
      const score = along + across * 2.4;
      if (score < bs) { bs = score; best = k; }
    }
    if (best) { select(best); nodes.get(best)?.focus(); }
  }

  function updateSel() {
    nodes.forEach((g, k) => {
      g.classList.toggle("sel", k === sel);
      g.setAttribute("tabindex", k === sel ? 0 : -1);
    });
    box.querySelectorAll("[data-jump] .chip").forEach((b) => b.classList.toggle("sel", Number(b.dataset.n) === sel));
    focusOn(sel, false);
  }

  function select(n) {
    sel = n;
    st.mapSel = n;
    const band = bandOf(n);
    if (band && isFolded(band)) { st.mapOpen.add(band.m.id); layout(); }
    const { it, deps, opens } = relOf(n);
    panel.classList.remove("swap");
    void panel.offsetWidth;
    panel.classList.add("swap");
    q(".sp-n").textContent = `#${it.n}`;
    const badge = q(".sp-badge");
    badge.textContent = STATE_LABEL[it.state];
    badge.className = `sp-badge ${it.state}`;
    q(".sp-title").textContent = it.title;
    q(".sp-ms").textContent = c.milestones.find((m) => m.id === it.milestone)?.title ?? "";
    chips(q("[data-deps]"), deps, t("Nada: es de las primeras"));
    chips(q("[data-opens]"), opens, t("Es la última de su camino"));
    const cmd = `byox test ${it.n}`;
    const btn = q(".sp-cmd");
    btn.textContent = `$ ${cmd}`;
    btn.onclick = () => copy(cmd);
    const go = q(".sp-go");
    go.setAttribute("href", `${A}/c/${encodeURIComponent(c.slug)}/${it.n}`);
    go.innerHTML = `${it.state === "locked" ? t("Ver etapa") : it.state === "done" ? t("Revisar etapa") : t("Abrir etapa")} ${ic("arrow-right")}`;
    updateSel();
    paint();
  }

  // Atajos a las etapas disponibles
  const jump = box.querySelector("[data-jump]");
  if (jump) {
    const ready = c.issues.filter((i) => i.state === "ready");
    for (const i of ready.slice(0, 10)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip ready";
      b.dataset.n = i.n;
      b.textContent = `#${i.n}`;
      b.title = i.title;
      b.addEventListener("click", () => select(i.n));
      jump.appendChild(b);
    }
    if (ready.length > 10) jump.insertAdjacentHTML("beforeend", `<em>+${ready.length - 10}</em>`);
  }

  // Filtro: atenúa todo lo que no está disponible
  const only = box.querySelector(".sm-only");
  only.addEventListener("click", () => {
    const on = only.getAttribute("aria-pressed") !== "true";
    only.setAttribute("aria-pressed", String(on));
    board.dataset.only = on ? "1" : "";
  });

  layout();
  select(sel);
  mq.addEventListener("change", () => { first = true; layout(); });
}

const loadReadme = (slug) =>
  api(`/courses/${encodeURIComponent(slug)}/readme`)
    .then((d) => d.html)
    .catch((e) => `${empty("error", t("No se pudo cargar el README"), esc(e.message))}`);

function verifyBox(i) {
  const cmds = testCommands(i.n);
  const pick = ctx.cmdTab ?? (IS_WIN ? "cli" : "cli");
  const cur = cmds.find((x) => x.id === pick) ?? cmds[0];
  return `<section class="verify">
    <div class="verify-h">${ic("terminal")}${t("Pruébala")}<span>${t("Cuando pase, haz push a {main} y la etapa se completará automáticamente.", { main: "<code>main</code>" })}</span></div>
    <div class="cmd-tabs" role="tablist">${cmds.map((x) => `<button role="tab" class="${x.id === cur.id ? "on" : ""}" data-cmd="${x.id}">${esc(x.label)}</button>`).join("")}</div>
    <div class="term"><code>${esc(cur.cmd)}</code><button class="copy" data-copy="${esc(cur.cmd)}">${ic("copy")}${t("Copiar")}</button></div>
    <p>${esc(cur.note)}</p>
  </section>`;
}

function outputView(i, data) {
  const r = data.result;
  if (!r) return empty("tests", t("Aún no hay salida del CI"), t("Haz push a main y aquí verás qué dijo el test."));
  const lines = (r.log ?? "").split("\n");
  const hl = new Set(r.highlight ?? []);
  return `<div class="out-h"><span class="badge ${r.ok ? "done" : "fail"}">${r.ok ? t("Pasó") : t("Falló")}</span>
      <span class="muted">${t("en {sha}, {when}", { sha: `<code>${esc(r.sha.slice(0, 7))}</code>`, when: ago(r.at) })}</span>${whereLink(r)}
      ${r.runUrl ? `<a class="chip" href="${esc(r.runUrl)}" target="_blank" rel="noopener" style="margin-left:auto">${ic("external-link")}${t("Run completo")}</a>` : ""}</div>
    ${r.log ? `<pre class="logbox">${lines.map((l, k) => `<span class="${hl.has(k) ? "hl" : ""}">${esc(l) || " "}</span>`).join("\n")}</pre>` : `<p class="muted">${t("El run no envió la salida (la imagen del curso no incluye base64).")}</p>`}`;
}

function hintsView(i, data) {
  const list = data.hints
    .map((h) => `<div class="hint"><div class="hint-h">${ic("lightbulb")}${t("Pista {k} de {total}", { k: h.k, total: i.hints })}<time>${ago(h.at)}</time></div><div class="md">${h.html}</div></div>`)
    .join("");
  const left = i.hints - data.hints.length;
  const action =
    i.hints === 0
      ? `<p class="muted">${t("Esta etapa no tiene pistas.")}</p>`
      : left > 0
        ? `<div class="actions"><button class="btn primary" id="hintBtn">${ic("lightbulb")}${t("Pedir la pista {k} de {total}", { k: data.hints.length + 1, total: i.hints })}</button>
           <span class="muted" id="hintMsg">${t("Van de la idea general a lo concreto.")}</span></div>`
        : `<p class="muted">${t("Ya tienes todas las pistas de esta etapa.")}</p>`;
  return `${list || `<p class="muted" style="margin-top:0">${t("Aún no has pedido pistas.")}</p>`}${action}`;
}

/** Los comentarios que deja byox en el issue llegan en español del servidor: se traducen los conocidos. */
function actText(s) {
  const m = /^Los tests pasaron en (\w+)\.$/.exec(s);
  return m ? t("Los tests pasaron en {sha}.", { sha: m[1] }) : t(s);
}

function activityView(data) {
  if (!data.activity.length) return empty("activity", t("Sin movimiento todavía"), t("El historial de esta etapa aparece tras tu primer push."));
  const icon = { pass: "check", unlock: "lock-open", ask: "lightbulb" };
  return `<div class="card"><ul class="feed">${data.activity
    .slice()
    .reverse()
    .map((a) => `<li><span class="ico ${a.kind === "pass" ? "done" : a.kind}">${ic(icon[a.kind] ?? "dot")}</span><div class="what">${esc(actText(a.text.replace(/^[✅🔓]\s*/u, "").trim()))}</div><time>${ago(a.at)}</time></li>`)
    .join("")}</ul></div>`;
}

function renderAside() {
  const aside = document.getElementById("aside");
  if (!aside || !ctx) return;
  const c = ctx.course;
  const i = c.issues.find((x) => x.n === ctx.n);
  const doneN = c.issues.filter((x) => x.state === "done").length;
  const link = (x) => `<li><a href="${A}/c/${esc(c.slug)}/${x.n}" data-link><span class="mini ${x.state}"></span><span class="n">${x.n}</span><span class="tt">${esc(x.title)}</span></a></li>`;
  const deps = i ? i.deps.map((d) => c.issues.find((x) => x.n === d)).filter(Boolean) : [];
  const unlocks = i ? c.issues.filter((x) => x.deps.includes(i.n)) : [];
  const goal = i ? milestoneGoal(c, i) : null;
  aside.innerHTML = `
    ${doneN === 0 ? `<section><h3>${t("Primeros pasos")}</h3><ol class="steps">
      <li>${t("Clona tu repositorio")}<div class="clone"><code>git clone ${esc(c.cloneUrl)}</code><button class="icon-btn" data-copy="git clone ${esc(c.cloneUrl)}" aria-label="${t("Copiar")}">${ic("copy")}</button></div></li>
      <li>${t("Resuelve la etapa y pruébala con {cmd}", { cmd: `<code>byox test ${i?.n ?? 1}</code>` })}</li>
      <li>${t("Haz push a {main}: si el test pasa, la etapa se completa.", { main: "<code>main</code>" })}</li></ol></section>` : ""}
    <section><h3>${goal ? esc(goal.title ?? t("Objetivo")) : t("Progreso")}</h3>${segs(c.issues, ctx.n)}<p class="muted tnum">${t("{n} de {total} etapas", { n: doneN, total: c.issues.length })}</p>
      ${goal ? `<p class="goal">${goal.left === 0 ? ic("circle-check") : ""}${esc(goal.text)}</p>` : ""}</section>
    ${deps.length ? `<section><h3>${t("Necesita")}</h3><ul class="links">${deps.map(link).join("")}</ul></section>` : ""}
    ${unlocks.length ? `<section><h3>${t("Al completarla se desbloquean")}</h3><ul class="links">${unlocks.map(link).join("")}</ul></section>` : ""}
    ${doneN ? `<section><h3>${t("Tu repositorio")}</h3><div class="clone"><code title="git clone ${esc(c.cloneUrl)}">git clone ${esc(c.cloneUrl)}</code><button class="icon-btn" data-copy="git clone ${esc(c.cloneUrl)}" aria-label="${t("Copiar")}">${ic("copy")}</button></div></section>` : ""}`;
  paint();
}

async function loadIssue(force = false) {
  const n = ctx.n;
  if (n == null || (!force && ctx.issueCache.has(n))) return renderMain();
  try {
    const data = await api(`/courses/${encodeURIComponent(ctx.slug)}/issues/${n}`);
    ctx.issueCache.set(n, data);
    if (ctx.n === n) renderMain();
  } catch (e) {
    document.getElementById("main").innerHTML = `${empty("error", t("No se pudo cargar la etapa"), esc(e.message), `<button class="btn" data-act="reload">${t("Reintentar")}</button>`)}`;
  }
}

/** Markdown que viene de Forgejo, mapeado a la web: links internos, `#3` y el mapa en Mermaid. */
function enhanceMd(root) {
  if (!root || !ctx?.course) return;
  mapLinks(root);
  linkIssueRefs(root);
  addCopyButtons(root);
  renderMaps(root);
}

/** Un botón de copiar en cada bloque de código (consignas, pistas, README y salida del test). */
function addCopyButtons(root) {
  for (const pre of root?.querySelectorAll("pre") ?? []) {
    if (pre.parentElement.classList.contains("codewrap") || pre.querySelector("code.language-mermaid")) continue;
    const wrap = document.createElement("div");
    wrap.className = "codewrap";
    pre.replaceWith(wrap);
    wrap.innerHTML = `<button class="code-copy" type="button" aria-label="${t("Copiar código")}">${ic("copy")}<span>${t("Copiar")}</span></button>`;
    wrap.prepend(pre);
  }
  paint();
}

function copyCode(btn) {
  navigator.clipboard?.writeText(btn.parentElement.querySelector("pre").textContent.replace(/\n$/, ""));
  btn.classList.add("done");
  btn.innerHTML = `${ic("check")}<span>${t("Copiado")}</span>`;
  paint();
  setTimeout(() => {
    btn.classList.remove("done");
    btn.innerHTML = `${ic("copy")}<span>${t("Copiar")}</span>`;
    paint();
  }, 1600);
}

const hasIssue = (n) => ctx.course.issues.some((x) => x.n === n);

/** Los links a issues del curso abren la etapa acá; el resto (archivos, docs) en otra pestaña. */
function mapLinks(root) {
  const base = S.health?.forgejoUrl ?? "http://localhost:3000";
  for (const a of root.querySelectorAll("a[href]")) {
    const raw = a.getAttribute("href");
    if (raw.startsWith("#") || a.hasAttribute("data-link")) continue;
    let u;
    try {
      u = new URL(raw, `${base}/`);
    } catch {
      continue;
    }
    const m = u.origin === new URL(base).origin && u.pathname.match(/^\/[^/]+\/([^/]+)\/issues\/(\d+)\/?$/);
    if (m && decodeURIComponent(m[1]) === ctx.slug && hasIssue(Number(m[2]))) {
      a.setAttribute("href", `${A}/c/${encodeURIComponent(ctx.slug)}/${m[2]}`);
      a.setAttribute("data-link", "");
      a.removeAttribute("target");
    } else if (u.origin !== location.origin) {
      a.href = u.href;
      a.target = "_blank";
      a.rel = "noopener";
    }
  }
}

/** Los diagramas Mermaid del README (el mapa del curso), con cada etapa clickeable y pintada por estado. */
async function renderMaps(root) {
  const blocks = [...root.querySelectorAll("pre > code.language-mermaid")];
  if (!blocks.length) return;
  // El mapa de etapas de la portada ya muestra el grafo real: el diagrama del README sobra.
  if (document.querySelector("[data-map]")) {
    blocks.forEach((b) => b.parentElement.remove());
    return;
  }
  const { default: mermaid } = await import("mermaid");
  const themeAttr = document.documentElement.dataset.theme;
  const dark = themeAttr ? themeAttr === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "strict", fontFamily: "Inter, sans-serif" });
  const slug = ctx.slug;
  const stateOf = new Map(ctx.course.issues.map((x) => [x.n, x.state]));
  for (const code of blocks) {
    const pre = code.parentElement;
    try {
      const { svg } = await mermaid.render(`map-${Math.random().toString(36).slice(2)}`, code.textContent);
      if (!pre.isConnected) return;
      const box = document.createElement("div");
      box.className = "map";
      box.innerHTML = svg;
      for (const node of box.querySelectorAll("g.node")) {
        const n = Number(/flowchart-i(\d+)-/.exec(node.id)?.[1]);
        if (!stateOf.has(n)) continue;
        node.classList.add("stage-node", `st-${stateOf.get(n)}`);
        node.dataset.n = n;
        node.setAttribute("role", "link");
        node.setAttribute("tabindex", "0");
        node.setAttribute("aria-label", t("Etapa #{n}", { n }));
      }
      const go = (e) => {
        const node = e.target.closest?.("g.stage-node");
        if (node && (e.type === "click" || e.key === "Enter")) navigate(`${A}/c/${slug}/${node.dataset.n}`);
      };
      box.addEventListener("click", go);
      box.addEventListener("keydown", go);
      pre.replaceWith(box);
    } catch (e) {
      // Si el fuente no es válido queda el bloque de código como estaba.
      pre.classList.remove("is-loading");
      console.warn("mermaid:", e);
    }
  }
}

/** Los `#3` del markdown pasan a ser links a la etapa. */
function linkIssueRefs(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (/#\d+/.test(t.nodeValue) && !t.parentElement.closest("code, pre, a")) nodes.push(t);
  }
  for (const t of nodes) {
    const span = document.createElement("span");
    span.innerHTML = esc(t.nodeValue).replace(/#(\d+)\b/g, (m, d) =>
      hasIssue(Number(d)) ? `<a href="${A}/c/${esc(ctx.slug)}/${d}" data-link>${m}</a>` : m,
    );
    t.replaceWith(span);
  }
}

/** Carga cognitiva: lo que no bloquea ("Para ir más allá") arranca plegado. */
function foldOptional() {
  const root = document.getElementById("md");
  const h = [...(root?.querySelectorAll("h2") ?? [])].find((x) => x.textContent.startsWith("Para ir más allá"));
  if (!h) return;
  const details = document.createElement("details");
  details.className = "optional";
  details.innerHTML = `<summary>${t("Para ir más allá")} <span class="muted">${t("(opcional)")}</span></summary>`;
  let el = h.nextElementSibling;
  while (el && (el.tagName === "UL" || el.tagName === "OL")) {
    const nextEl = el.nextElementSibling;
    details.append(el);
    el = nextEl;
  }
  h.replaceWith(details);
}

// ---------- polling: festejo y fallas nuevas ----------
// ---------- el CI en la pestaña ----------
// Flow: haces push desde la terminal y la pestaña de byox te dice cómo terminó sin volver a mirarla,
// como GitHub con el favicon de un PR. El título y el favicon llevan el estado del último push.
const BASE_TITLE = document.title;
const BASE_ICON = document.querySelector('link[rel="icon"]')?.getAttribute("href");
const SIGNAL = { run: ["●", "#f9732f"], fail: ["✕", "#dc2626"], ok: ["✓", "#16a34a"] };
const iconWith = (color) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#18181b"/><g transform="translate(4 4)"><path d="M6.6 6.4C11 6.4 11.5 12 14.2 12M6.6 17.6C11 17.6 11.5 12 14.2 12" fill="none" stroke="#f4f4f5" stroke-width="2" stroke-linecap="round" opacity=".6"/><circle cx="4.6" cy="6.4" r="2.6" fill="#f4f4f5"/><circle cx="4.6" cy="17.6" r="2.6" fill="#f4f4f5"/><circle cx="18" cy="12" r="4.4" fill="#f9732f"/></g><circle cx="25" cy="25" r="7" fill="${color}" stroke="#18181b" stroke-width="2"/></svg>`)}`;

/** Qué decir en la pestaña: corriendo, qué falla, o "al día" durante unos minutos después de pasar. */
function ciSignal() {
  const r = ctx?.run;
  if (!r || !ctx.course) return null;
  if (r.state === "pending") return ["run", t("Ejecutando tests en {sha}", { sha: r.sha.slice(0, 7) })];
  const fails = ctx.course.issues.filter((i) => i.state === "ready" && failing(i));
  if (fails.length) return ["fail", fails.length === 1 ? t("#{n} falla", { n: fails[0].n }) : t("{n} etapas fallan", { n: fails.length })];
  if (r.state !== "none" && r.at && Date.now() - Date.parse(r.at) < 10 * 60_000) return ["ok", t("Tests al día")];
  return null;
}
function tabSignal(sig = ciSignal()) {
  const link = document.querySelector('link[rel="icon"]');
  document.title = sig ? `${SIGNAL[sig[0]][0]} ${sig[1]} · ${BASE_TITLE}` : BASE_TITLE;
  if (link && BASE_ICON) link.setAttribute("href", sig ? iconWith(SIGNAL[sig[0]][1]) : BASE_ICON);
}

function stopPolling() {
  clearInterval(ctx?.poll);
}
function startPolling() {
  stopPolling();
  let last = 0;
  const tick = async (force = false) => {
    if (!ctx) return;
    // En segundo plano sigue mirando, más espaciado: es cuando más sirve el aviso en la pestaña.
    if (document.hidden && !force && Date.now() - last < 10_000) return;
    last = Date.now();
    try {
      const s = await api(`/courses/${encodeURIComponent(ctx.slug)}/status`);
      ctx.run = s.run;
      const byN = new Map(s.issues.map((x) => [x.n, x]));
      const newly = ctx.course.issues.filter((x) => x.state !== "done" && byN.get(x.n)?.closed);
      const resultsMoved = ctx.course.issues.some((x) => (byN.get(x.n)?.at ?? null) !== (x.result?.at ?? null));
      if (newly.length || resultsMoved) {
        const before = new Map(ctx.course.issues.map((x) => [x.n, x.state]));
        const beforeAt = new Map(ctx.course.issues.map((x) => [x.n, x.result?.at]));
        ctx.course = await fetchCourse(ctx.slug);
        // Una falla es nueva si su resultado cambió desde la última carga (y no es una etapa sin empezar).
        const newFail = ctx.course.issues.filter((x) => x.state === "ready" && failing(x) && x.result.at !== beforeAt.get(x.n));
        ctx.issueCache.delete(ctx.n);
        const unlocked = ctx.course.issues.filter((x) => before.get(x.n) === "locked" && x.state === "ready");
        renderTrack();
        renderAside();
        loadIssue(true);
        const othersDone = (S.courses ?? []).some((x) => x.slug !== ctx.slug && x.done > 0);
        S.courses = null;
        const streak0 = S.profile?.streak ?? 0;
        loadGlobals().then(() => {
          document.querySelector(".side") && (document.querySelector(".side").outerHTML = sidebar("course"), paint());
          const st = S.profile?.streak ?? 0;
          if (newly.length && st > streak0 && st > 1) setTimeout(() => toast(st >= (S.profile.best ?? 0) ? t("Racha de {n} días: tu mejor hasta ahora.", { n: st }) : t("Racha de {n} días. Sigue así.", { n: st }), "flame"), 1800);
        });
        if (newly.length) celebrate(newly, unlocked, othersDone);
        else if (newFail.length) {
          const f = newFail.find((x) => x.n === ctx.n) ?? newFail[0];
          toast(t("#{n} no pasó: {why}", { n: f.n, why: ctx.course.issues.find((x) => x.n === f.n)?.result?.message ?? t("mira la salida del test") }), "circle-x");
        }
      }
      const chip = document.getElementById("run-chip");
      if (chip) {
        chip.innerHTML = runChip();
        paint();
      }
      tabSignal();
    } catch {}
  };
  tick(true);
  ctx.poll = setInterval(tick, 4000);
  ctx.tick = tick;
}
document.addEventListener("visibilitychange", () => !document.hidden && ctx?.tick?.());
setInterval(async () => {
  // La salud del sistema y la lista de cursos se refrescan solas cada minuto.
  if (document.hidden) return;
  await loadGlobals();
  const side = document.querySelector(".side");
  const p = appPath();
  const active = p.startsWith("/c/") ? "course" : p === "/" ? "home" : p.split("/")[1];
  if (side) side.outerHTML = sidebar({ cursos: "courses", actividad: "activity", creados: "authored" }[active] ?? active);
  document.querySelectorAll(".chip.mcp").forEach((c) => (c.outerHTML = mcpChip()));
  paint();
}, 60_000);

function celebrate(done, unlocked, othersDone = true) {
  const c = ctx.course;
  const next = unlocked[0] ?? c.issues.find((x) => x.state === "ready");
  const finished = c.issues.every((x) => x.state === "done");
  let summary = "";
  if (finished) {
    const closes = c.issues.map((x) => x.closedAt).filter(Boolean);
    const days = new Set(closes.map((t) => new Date(t).toLocaleDateString("en-CA"))).size;
    summary = `<dl class="facts"><div><dt>${c.issues.length}</dt><dd>${t("etapas")}</dd></div><div><dt>${c.milestones.length}</dt><dd>${t("tramos")}</dd></div><div><dt>${days}</dt><dd>${days === 1 ? t("día de trabajo") : t("días de trabajo")}</dd></div></dl>`;
  }
  const goal = !finished ? milestoneGoal(c, done.at(-1)) : null;
  // Primer test en verde de todos: un momento que merece su propio mensaje (se recuerda solo en este navegador).
  let first = false;
  try {
    first = !finished && !othersDone && c.issues.filter((x) => x.state === "done").length === done.length && !localStorage.getItem("byox-first-green");
    if (first) localStorage.setItem("byox-first-green", "1");
  } catch {}
  const el = document.createElement("div");
  el.className = "overlay";
  el.innerHTML = `<div class="modal ${finished ? "final" : ""}${first ? " first" : ""}" role="dialog" aria-modal="true" aria-labelledby="mt">
    <button class="icon-btn x" aria-label="${t("Cerrar")}">${ic("x")}</button>
    <div class="ingot">${ic(finished ? "trophy" : "circle-check")}</div>
    <h2 id="mt">${finished ? t("Terminaste {title}", { title: esc(c.title) }) : first ? t("Tu primer test en verde") : done.length > 1 ? t("{n} etapas de un golpe", { n: done.length }) : t("Etapa cerrada")}</h2>
    <p class="what">${finished ? t("Todas las etapas, con sus tests en verde. Lo construiste tú, pieza por pieza.") : first ? `${t("Esto es lo que se siente al cerrar una etapa. Quedan más.")}<br>` : ""}${finished ? "" : done.map((d) => `#${d.n} ${esc(d.title)}`).join("<br>")}</p>
    ${summary}${goal ? `<p class="goal">${goal.left === 0 ? ic("circle-check") : ""}${esc(goal.text)}</p>` : ""}
    ${unlocked.length ? `<div class="unl"><p>${unlocked.length > 1 ? t("Desbloqueadas") : t("Desbloqueada")}</p>${unlocked.map((u) => `<div>#${u.n} ${esc(u.title)}</div>`).join("")}</div>` : ""}
    ${next && !finished ? `<button class="btn primary" data-go="${next.n}">${t("Continuar con #{n}", { n: next.n })}</button>` : `<a class="btn primary" href="${A}/" data-link data-close>${t("Volver al inicio")}</a>`}
  </div>`;
  document.body.append(el);
  paint();
  el.querySelector(".btn").focus();
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  el.addEventListener("click", (e) => {
    if (e.target === el || e.target.closest(".x, [data-close]")) close();
    const go = e.target.closest("[data-go]");
    if (go) {
      close();
      navigate(`${A}/c/${ctx.slug}/${go.dataset.go}`);
    }
  });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const r = el.querySelector(".ingot").getBoundingClientRect();
    const colors = ["var(--ember)", "#ffb347", "#ffd27a", "var(--done)"];
    for (let k = 0; k < (finished ? 64 : 30); k++) {
      const s = document.createElement("span");
      const a = (Math.PI * 2 * k) / 30 + Math.random() * 0.3;
      const d = 70 + Math.random() * 120;
      s.className = "spark";
      s.style.left = `${r.left + r.width / 2}px`;
      s.style.top = `${r.top + r.height / 2}px`;
      s.style.background = colors[k % colors.length];
      s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      s.style.setProperty("--dy", `${Math.sin(a) * d - 30}px`);
      document.body.append(s);
      setTimeout(() => s.remove(), 1100);
    }
  }
}

async function askHint() {
  const btn = document.getElementById("hintBtn");
  const msg = document.getElementById("hintMsg");
  const n = ctx.n;
  const had = ctx.issueCache.get(n)?.hints.length ?? 0;
  btn.disabled = true;
  msg.innerHTML = `<span class="spin"></span> ${t("Solicitando la pista…")}`;
  try {
    await api(`/courses/${encodeURIComponent(ctx.slug)}/issues/${n}/hint`, { method: "POST" });
    for (let tries = 0; tries < 30; tries++) {
      await new Promise((r) => setTimeout(r, 2000));
      const data = await api(`/courses/${encodeURIComponent(ctx.slug)}/issues/${n}`);
      if (data.hints.length > had) {
        ctx.issueCache.set(n, data);
        if (ctx.n === n) renderMain();
        toast(t("Pista lista. Está en la pestaña Pistas."), "lightbulb");
        return;
      }
    }
    msg.textContent = t("La pista no llegó a tiempo. Revisa que el runner esté activo y vuelve a pedirla.");
  } catch (e) {
    msg.textContent = e.message;
  }
  btn.disabled = false;
}

// ---------- paleta de comandos (Ctrl K) ----------
function paletteItems() {
  const items = [];
  const add = (group, icon, title, run, hint = "") => items.push({ group, icon, title, run, hint });
  const go = t("Ir a"), acts = t("Acciones");
  add(go, "house", t("Inicio"), () => navigate(`${A}/`));
  add(go, "book-open", t("Cursos"), () => navigate(`${A}/cursos`));
  add(go, "activity", t("Actividad"), () => navigate(`${A}/actividad`));
  add(go, "pen-line", t("Creados"), () => navigate(`${A}/creados`));
  add(acts, "plus", t("Nuevo curso"), newCourseDialog);
  add(acts, "upload", t("Importar un curso"), importDialog);
  if (ctx?.course) add(acts, "share-2", t("Compartir {title}", { title: ctx.course.title }), () => shareDialog(ctx.slug));
  if (ctx?.course?.started) {
    const c = ctx.course;
    const next = c.issues.find((x) => x.state === "ready");
    if (next) add(acts, "arrow-right", t("Ir a la próxima etapa: #{n} {title}", { n: next.n, title: next.title }), () => navigate(`${A}/c/${c.slug}/${next.n}`), "n");
    if (ctx.n) {
      add(acts, "terminal", t("Copiar el comando para probar #{n}", { n: ctx.n }), () => copy(`byox test ${ctx.n}`));
      add(acts, "lightbulb", t("Pedir una pista para #{n}", { n: ctx.n }), () => {
        ctx.tab = "pistas";
        renderMain();
        setTimeout(() => document.getElementById("hintBtn")?.click(), 50);
      });
    }
    add(acts, "git-branch", t("Abrir el repositorio en Forgejo"), () => window.open(c.repoUrl, "_blank"));
    for (const i of c.issues) add(c.title, i.state === "done" ? "circle-check" : i.state === "ready" ? "circle-dot" : "circle", `#${i.n} ${i.title}`, () => navigate(`${A}/c/${c.slug}/${i.n}`), STATE_LABEL[i.state]);
  }
  for (const c of S.courses ?? []) add(t("Cursos"), "book-open", c.title, () => navigate(`${A}/c/${c.slug}`), c.started ? `${c.done}/${c.total}` : t("sin empezar"));
  const prefs = t("Preferencias");
  add(prefs, "sun-moon", t("Cambiar el tema"), cycleTheme);
  add(prefs, "panel-left", t("Plegar o expandir la barra lateral"), toggleSlim, "[");
  add(prefs, "keyboard", t("Ver los atajos de teclado"), shortcuts, "?");
  return items;
}

/** Coincidencia difusa: las letras de la búsqueda en orden. Puntúa más las seguidas y al inicio de palabra. */
function fuzzy(q, text) {
  if (!q) return { score: 0, marks: [] };
  const t = text.toLowerCase();
  let score = 0;
  let last = -2;
  const marks = [];
  for (const ch of q.toLowerCase()) {
    const k = t.indexOf(ch, last + 1);
    if (k < 0) return null;
    score += k === last + 1 ? 3 : 1;
    if (k === 0 || /[\s#\-/]/.test(t[k - 1])) score += 2;
    marks.push(k);
    last = k;
  }
  return { score: score - t.length * 0.01, marks };
}

function palette() {
  if (document.querySelector(".palette")) return;
  const all = paletteItems();
  const el = document.createElement("div");
  el.className = "overlay top";
  el.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="${t("Paleta de comandos")}">
    <div class="palette-in">${ic("search")}<input id="pq" placeholder="${t("Busca una etapa, un curso o una acción…")}" autocomplete="off" spellcheck="false" aria-controls="pl"></div>
    <div class="palette-list" id="pl" role="listbox"></div>
    <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> ${t("moverse")}</span><span><kbd>Enter</kbd> ${t("abrir")}</span><span><kbd>Esc</kbd> ${t("cerrar")}</span></div>
  </div>`;
  document.body.append(el);
  paint();
  const input = el.querySelector("#pq");
  const list = el.querySelector("#pl");
  let shown = [];
  let sel = 0;
  const mark = (text, marks) => [...text].map((ch, k) => (marks.includes(k) ? `<mark>${esc(ch)}</mark>` : esc(ch))).join("");
  const render = () => {
    const q = input.value.trim();
    shown = all
      .map((it) => ({ it, m: fuzzy(q, it.title) }))
      .filter((x) => x.m)
      .sort((a, b) => (q ? b.m.score - a.m.score : 0))
      .slice(0, 40);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    let html = "";
    let group = "";
    shown.forEach(({ it, m }, k) => {
      if (!q && it.group !== group) html += `<div class="palette-group">${esc(it.group)}</div>`;
      group = it.group;
      html += `<div class="palette-item ${k === sel ? "sel" : ""}" role="option" aria-selected="${k === sel}" data-k="${k}">${ic(it.icon)}<span class="tt">${mark(it.title, m.marks)}</span><span class="hint2">${esc(it.hint)}</span></div>`;
    });
    list.innerHTML = html || empty("search", t("Sin resultados"), t("Prueba con otra palabra o con el número de la etapa."));
    paint();
    list.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  };
  const close = () => el.remove();
  const runSel = (k = sel) => {
    const x = shown[k];
    if (!x) return;
    close();
    x.it.run();
  };
  input.addEventListener("input", () => {
    sel = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") (sel = Math.min(sel + 1, shown.length - 1)), render(), e.preventDefault();
    else if (e.key === "ArrowUp") (sel = Math.max(sel - 1, 0)), render(), e.preventDefault();
    else if (e.key === "Enter") runSel(), e.preventDefault();
    else if (e.key === "Escape") close(), e.preventDefault();
  });
  el.addEventListener("click", (e) => {
    const item = e.target.closest(".palette-item");
    if (item) runSel(Number(item.dataset.k));
    else if (e.target === el) close();
  });
  render();
  input.focus();
}

// ---------- atajos ----------
const keys = () => [
  ["Ctrl K", t("Buscar o ejecutar cualquier cosa")],
  ["← / k", t("Etapa anterior")],
  ["→ / j", t("Etapa siguiente")],
  ["n", t("Próxima etapa disponible")],
  ["1 2 3 4", t("Instrucciones, pistas, salida, actividad")],
  ["[", t("Plegar o expandir la barra lateral")],
  [t("En el inicio: j k"), t("Moverte por tus etapas (Enter abre, n continúa)")],
  [t("En el inicio: f a g"), t("Solo fallando, todas, agrupar por estado o curso")],
  ["?", t("Mostrar esta ayuda")],
];
function shortcuts() {
  const el = document.createElement("div");
  el.className = "overlay";
  el.innerHTML = `<div class="modal keys" role="dialog" aria-modal="true" aria-labelledby="kt">
    <button class="icon-btn x" aria-label="${t("Cerrar")}">${ic("x")}</button>
    <h2 id="kt">${t("Atajos de teclado")}</h2>
    <dl>${keys().map(([k, d]) => `<dt>${k.split(" ").map((x) => (x === "/" ? ` ${t("o")} ` : `<kbd>${esc(x)}</kbd>`)).join(" ")}</dt><dd>${d}</dd>`).join("")}</dl>
  </div>`;
  document.body.append(el);
  paint();
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => (e.key === "Escape" || e.key === "?") && close();
  setTimeout(() => document.addEventListener("keydown", onKey));
  el.addEventListener("click", (e) => (e.target === el || e.target.closest(".x")) && close());
}

function toggleSlim() {
  S.slim = !document.querySelector(".shell")?.classList.contains("slim");
  S.slimAuto = false;
  try { localStorage.setItem("byox-slim", S.slim ? "1" : "0"); } catch {}
  document.querySelector(".shell")?.classList.toggle("slim", S.slim);
}

// ---------- cursos propios: compartir, importar y escribir a mano ----------
/** Un diálogo con el cierre de siempre (Esc, fondo, la X). Devuelve el elemento y cómo cerrarlo. */
function dialog(html, cls = "") {
  const el = document.createElement("div");
  el.className = "overlay";
  el.innerHTML = `<div class="modal form ${cls}" role="dialog" aria-modal="true">
    <button class="icon-btn x" aria-label="${t("Cerrar")}">${ic("x")}</button>${html}</div>`;
  document.body.append(el);
  paint();
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  el.addEventListener("click", (e) => (e.target === el || e.target.closest(".x")) && close());
  return { el, close };
}

const originBadge = (c) =>
  c?.origin === "human"
    ? `<span class="origin human" title="${esc(c.author ? t("Escrito a mano por {name}", { name: c.author }) : t("Escrito a mano"))}">${ic("hand")}${t("Hecho a mano")}</span>`
    : c?.origin === "ai"
      ? `<span class="origin ai" title="${t("Escrito por un asistente y verificado contra una solución de referencia")}">${ic("sparkles")}${t("IA")}</span>`
      : "";

const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`);

async function shareDialog(slug) {
  const d = dialog(`<h2>${t("Compartir curso")}</h2><div class="skeleton" aria-busy="true"><i></i><i style="width:70%"></i><i class="block"></i></div>`, "share");
  try {
    const x = await api(`/courses/${encodeURIComponent(slug)}/export`);
    d.el.querySelector(".modal").innerHTML = `<button class="icon-btn x" aria-label="${t("Cerrar")}">${ic("x")}</button>
      <h2>${t("Compartir {title}", { title: esc(courseName(x.title)) })}</h2>
      <p class="muted">${t("Quien reciba el código puede importarlo desde Creados. Incluye las etapas, los tests, el esqueleto y la solución de referencia.")}</p>
      <div class="share-meta"><span>${plural(x.files, "archivo", "archivos")} · ${kb(x.bytes)}</span><span class="mono">${esc(x.sha.slice(0, 7))}</span>
        ${x.verified ? `<span class="ok">${ic("circle-check")}${t("Verificado")}</span>` : `<span class="warn">${ic("triangle-alert")}${t("Sin verificar")}</span>`}</div>
      ${x.verified ? "" : `<p class="note warn">${t("Este commit no pasó la verificación: quien lo importe lo verá como no verificado hasta que pase.")}</p>`}
      <textarea class="code-field" readonly rows="5" aria-label="${t("Código del curso")}">${esc(x.code)}</textarea>
      <div class="actions"><button class="btn primary" data-copy="${esc(x.code)}" data-what="${t("Código copiado")}">${ic("copy")}${t("Copiar código")}</button>
        <a class="btn" href="/api/courses/${encodeURIComponent(slug)}/export.byox" download="${esc(x.filename)}">${ic("download")}${t("Descargar {file}", { file: esc(x.filename) })}</a></div>`;
    paint();
    d.el.querySelector(".code-field").addEventListener("focus", (e) => e.target.select());
  } catch (e) {
    d.el.querySelector(".skeleton").outerHTML = `<p class="note bad">${esc(e.message)}</p>`;
  }
}

function importDialog() {
  const d = dialog(`<h2>${t("Importar un curso")}</h2>
    <p class="muted">${t("Pega el código que te pasaron o suelta el archivo {file}.", { file: "<code>.byox</code>" })}</p>
    <label class="drop" id="drop">
      <textarea id="imp-code" class="code-field" rows="5" placeholder="byox1-…" spellcheck="false"></textarea>
      <span class="drop-hint">${ic("file-up")}${t("Suelta un archivo .byox o {pick}", { pick: `<u>${t("elige uno")}</u>` })}<input type="file" id="imp-file" accept=".byox,text/plain" hidden></span>
    </label>
    <p class="note">${ic("shield-alert")}${t("Los tests del curso se ejecutan en tu Docker. Importa solo cursos de personas en las que confíes.")}</p>
    <div id="imp-out"></div>
    <div class="actions"><button class="btn primary" id="imp-preview" disabled>${t("Ver vista previa")}</button><span class="muted" id="imp-msg"></span></div>`, "import");
  const $ = (s) => d.el.querySelector(s);
  const code = $("#imp-code");
  const btn = $("#imp-preview");
  const msg = $("#imp-msg");
  let preview = null;
  const reset = () => {
    preview = null;
    $("#imp-out").innerHTML = "";
    btn.textContent = t("Ver vista previa");
    btn.disabled = !code.value.trim();
    msg.textContent = "";
  };
  code.addEventListener("input", reset);
  const load = async (file) => {
    code.value = (await file.text()).trim();
    reset();
    btn.click();
  };
  $("#imp-file").addEventListener("change", (e) => e.target.files[0] && load(e.target.files[0]));
  const drop = $("#drop");
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]);
  });

  const showPreview = (p) => {
    const blocked = p.errors.length > 0;
    $("#imp-out").innerHTML = `<div class="preview">
      <div class="pv-top">${langTag({ lang: language(p.image) })}${originBadge(p)}${p.verified ? `<span class="ok">${ic("circle-check")}${t("Verificado al exportar")}</span>` : `<span class="warn">${ic("triangle-alert")}${t("Sin verificar")}</span>`}</div>
      <h3>${esc(courseName(p.title))}</h3>
      ${p.description ? `<p>${esc(p.description)}</p>` : ""}
      <div class="topics">${p.milestones.map((m) => `<span>${esc(m)}</span>`).join("")}</div>
      <div class="pv-meta">${plural(p.issues, "etapa", "etapas")} · ${plural(p.milestones.length, "tramo", "tramos")} · ${plural(p.files, "archivo", "archivos")}${p.exportedBy ? ` · ${t("exportado por {name}", { name: esc(p.exportedBy) })}` : ""}${p.exportedAt ? ` ${ago(p.exportedAt)}` : ""}</div>
      ${p.errors.length ? `<ul class="problems bad">${p.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${p.warnings.length ? `<ul class="problems warn">${p.warnings.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${blocked ? "" : `<label class="field"><span>${t("Nombre del curso")}</span><input id="imp-slug" value="${esc(p.exists ? p.suggestedSlug : p.slug)}" spellcheck="false">
        <small>${p.exists ? t("Ya tienes un curso llamado {slug}; se importará con otro nombre.", { slug: `<code>${esc(p.slug)}</code>` }) : t("Minúsculas, números y guiones.")}</small></label>`}
    </div>`;
    paint();
    btn.textContent = t("Importar curso");
    btn.disabled = blocked;
    msg.textContent = blocked ? t("El código tiene errores y no se puede importar.") : "";
  };

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.innerHTML = '<span class="spin"></span>';
    try {
      if (!preview) {
        preview = await post("/import/preview", code.value.trim());
        showPreview(preview);
        return;
      }
      const slug = $("#imp-slug")?.value.trim() || undefined;
      msg.innerHTML = `<span class="spin"></span> ${t("Importando…")}`;
      const r = await post("/import", { code: code.value.trim(), slug });
      d.close();
      S.courses = null;
      toast(t("{title} importado. Verificando…", { title: courseName(r.title) }));
      navigate(`${A}/creados/${encodeURIComponent(r.slug)}`);
    } catch (e) {
      msg.textContent = "";
      if (e.status === 409 && preview) {
        // El 409 no trae sugerencia: se usa la de la vista previa si el nombre elegido era otro.
        const input = $("#imp-slug");
        const suggest = preview.suggestedSlug && input?.value !== preview.suggestedSlug;
        if (suggest) input.value = preview.suggestedSlug;
        msg.textContent = suggest ? `${e.message} ${t("Te sugerimos otro nombre.")}` : `${e.message} ${t("Elige otro nombre.")}`;
      } else {
        if (!preview) reset();
        msg.textContent = e.message;
      }
      btn.disabled = false;
    }
  });
  code.focus();
}

async function newCourseDialog() {
  const d = dialog(`<h2>${t("Nuevo curso")}</h2>
    <p class="muted">${t("Se crea el repositorio fuente con una plantilla que ya pasa la verificación. Después lo editas con git y cada push se verifica solo.")}</p>
    <form id="nc">
      <label class="field"><span>${t("Título")}</span><input name="title" placeholder="Build your own Shell" autocomplete="off"></label>
      <label class="field"><span>${t("Nombre (slug)")}</span><input name="slug" required pattern="[a-z0-9][a-z0-9._\\-]*" placeholder="build-your-own-shell" spellcheck="false" autocomplete="off">
        <small>${t("Minúsculas, números y guiones. Es el nombre del repositorio.")}</small></label>
      <fieldset class="field"><legend>${t("Lenguaje")}</legend><div class="langs" id="nc-langs"><span class="spin"></span></div></fieldset>
      <div class="actions"><button class="btn primary" type="submit">${ic("plus")}${t("Crear curso")}</button><span class="muted" id="nc-msg"></span></div>
    </form>`, "new-course-form");
  const form = d.el.querySelector("#nc");
  const slug = form.elements.slug;
  let touched = false;
  slug.addEventListener("input", () => (touched = true));
  form.elements.title.addEventListener("input", (e) => {
    if (!touched) slug.value = e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  });
  try {
    const tpls = await api("/author/templates");
    d.el.querySelector("#nc-langs").innerHTML = tpls
      .map((t, k) => `<label class="lang-opt"><input type="radio" name="lang" value="${esc(t.lang)}" ${k === 0 ? "checked" : ""}>
        <span>${langTag({ lang: language(t.image) })}<b>${esc(t.label)}</b><small class="mono">${esc(t.image)}</small></span></label>`)
      .join("");
  } catch (e) {
    d.el.querySelector("#nc-langs").textContent = e.message;
  }
  form.elements.title.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = d.el.querySelector("#nc-msg");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    msg.innerHTML = `<span class="spin"></span> ${t("Creando…")}`;
    try {
      const r = await post("/author/new", { slug: slug.value.trim(), lang: form.elements.lang.value, title: form.elements.title.value.trim() || undefined });
      d.close();
      S.courses = null;
      toast(t("Curso creado. Verificando la plantilla…"));
      navigate(`${A}/creados/${encodeURIComponent(r.slug)}`);
    } catch (err) {
      msg.textContent = err.status === 409 ? t("Ya existe un curso con ese nombre.") : err.message;
      btn.disabled = false;
    }
  });
}

/** Estado de la verificación, igual en la lista y en el detalle. */
function verifyChip(v) {
  if (!v) return "";
  if (v.busy || v.state === "pending") return `<span class="vchip busy">${ic("loader-circle")}${t("Verificando…")}</span>`;
  const map = {
    success: ["ok", "circle-check", t("Verificado")],
    failure: ["bad", "circle-x", t("No pasa la verificación")],
    invalid: ["bad", "triangle-alert", t("Formato inválido")],
    none: ["", "circle-dashed", t("Sin verificar")],
  };
  const [cls, icon, label] = map[v.state] ?? map.none;
  return `<span class="vchip ${cls}${v.stale ? " stale" : ""}" title="${v.stale ? t("La última verificación es de un commit anterior") : ""}">${ic(icon)}${label}${v.stale ? ` · ${t("desactualizada")}` : ""}</span>`;
}

let authorPoll = null;
const stopAuthorPoll = () => clearTimeout(authorPoll);

async function authoredPage() {
  stopAuthorPoll();
  shell("authored", crumb([{ label: t("Creados") }]), "", loading);
  const [list] = await Promise.all([api("/author"), S.courses ? null : loadGlobals()]);
  const rows = list
    .map((c) => `<tr data-href="${A}/creados/${esc(c.slug)}">
      <td><div class="t1">${esc(courseName(c.title))} ${originBadge(c)}</div><div class="t2 mono">${esc(c.slug)}</div></td>
      <td>${verifyChip(c.verify)}</td>
      <td class="t2">${c.verify.problems ? plural(c.verify.problems, "problema", "problemas") : "—"}</td>
      <td class="t2">${ago(c.updatedAt)}</td></tr>`)
    .join("");
  shell(
    "authored",
    crumb([{ label: t("Creados") }]),
    "",
    `<div class="wrap"><div class="phead"><div><h1>${t("Creados")}</h1><p>${t("Los cursos que escribiste tú o tu asistente. Cada push a su repositorio fuente se verifica automáticamente.")}</p></div>
      <div class="phead-actions"><button class="btn" data-act="import">${ic("upload")}${t("Importar")}</button><button class="btn primary" data-act="new-course">${ic("plus")}${t("Nuevo curso")}</button></div></div>
      <div class="card">${rows
        ? `<table class="table"><thead><tr><th>${t("Curso")}</th><th>${t("Verificación")}</th><th>${t("Problemas")}</th><th>${t("Último cambio")}</th></tr></thead><tbody>${rows}</tbody></table>`
        : `${empty("courses", t("Aún no creaste cursos"), t("Empieza desde una plantilla, importa un código o pídeselo a tu asistente."))}`}</div></div>`,
  );
  if (list.some((c) => c.verify.busy || c.verify.state === "pending")) {
    authorPoll = setTimeout(() => appPath() === "/creados" && authoredPage(), 4000);
  }
}

async function authorPage(slug, quiet = false) {
  stopAuthorPoll();
  const crumbs = (title) => crumb([{ label: t("Creados"), href: `${A}/creados` }, { label: esc(title) }]);
  if (!quiet) shell("authored", crumbs(courseName(slug)), "", loading);
  const [c] = await Promise.all([api(`/author/${encodeURIComponent(slug)}`), S.courses ? null : loadGlobals()]);
  if (appPath() !== `/creados/${slug}`) return;
  const title = courseName(c.title);
  const v = c.verify;
  const last = c.last;
  const stageRow = (s) => `<tr class="${s.ok ? "" : "bad"}">
      <td class="mono t2">#${s.id}</td><td>${esc(s.title)}</td>
      <td>${s.skeleton === "falla" ? `<span class="ok">${ic("check")}${t("falla")}</span>` : `<span class="bad">${ic("x")}${t("pasa")}</span>`}</td>
      <td>${s.solution === "pasa" ? `<span class="ok">${ic("check")}${t("pasa")}</span>` : `<span class="bad">${ic("x")}${t("falla")}</span>`}</td>
      <td>${s.ok ? `<span class="ok">${ic("circle-check")}</span>` : `<span class="bad">${ic("circle-x")}</span>`}</td></tr>
    ${s.log ? `<tr class="log-row"><td></td><td colspan="4"><details><summary>${t("Salida del test")}</summary><pre>${esc(s.log)}</pre></details></td></tr>` : ""}`;
  const staleNote = v.stale
    ? `<p class="note warn">${ic("triangle-alert")}${t("Este resultado es del commit {old}; el último es {new}.", { old: `<code>${esc(last?.sha?.slice(0, 7) ?? "")}</code>`, new: `<code>${esc(c.sha.slice(0, 7))}</code>` })} ${v.busy ? t("Se está verificando.") : t("Verifica de nuevo para actualizarlo.")}</p>`
    : "";
  const body = `<div class="wrap" style="max-width:960px">
    <div class="phead"><div><h1>${esc(title)}</h1>
      <p class="ph-meta">${originBadge(c)}<span class="mono">${esc(c.slug)}</span>${c.image ? langTag({ lang: language(c.image) }) : ""}<span>${plural(c.issues, "etapa", "etapas")} · ${plural(c.milestones, "tramo", "tramos")}</span></p></div>
      <div class="phead-actions">
        <button class="btn" data-act="verify" data-slug="${esc(c.slug)}" ${v.busy ? "disabled" : ""}>${ic("refresh-cw")}${t("Verificar ahora")}</button>
        <button class="btn" data-act="share" data-slug="${esc(c.slug)}">${ic("share-2")}${t("Compartir")}</button>
        <a class="btn primary" href="${A}/c/${esc(c.slug)}" data-link>${c.started ? t("Ver curso") : t("Empezar curso")}</a></div></div>
    <div class="cols"><section>
      <div class="card"><div class="card-h"><span>${t("Verificación")}</span>${verifyChip(v)}</div><div class="card-b">
        ${staleNote}
        ${last
          ? `<p class="muted" style="margin:0 0 12px">${t("El esqueleto tiene que fallar y la solución tiene que pasar en cada etapa. Commit {sha} en {image}, {when}.", { sha: `<code>${esc(last.sha.slice(0, 7))}</code>`, image: `<code>${esc(last.image ?? c.image ?? "")}</code>`, when: ago(last.finishedAt ?? last.startedAt) })}</p>
             ${last.stages?.length ? `<table class="table vtable"><thead><tr><th></th><th>${t("Etapa")}</th><th>${t("Esqueleto")}</th><th>${t("Solución")}</th><th></th></tr></thead><tbody>${last.stages.map(stageRow).join("")}</tbody></table>` : ""}
             ${last.errors?.length ? `<ul class="problems bad">${last.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`
          : `${empty("tests", t("Aún no se verificó"), v.busy ? t("La verificación está en curso.") : t("Pulsa “Verificar ahora” o haz push al repositorio fuente."))}`}
      </div></div>
      ${c.errors.length || c.warnings.length ? `<div class="card"><div class="card-h"><span>${t("Formato")}</span></div><div class="card-b">
        ${c.errors.length ? `<ul class="problems bad">${c.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${c.warnings.length ? `<ul class="problems warn">${c.warnings.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div>` : ""}
    </section>
    <aside>
      <div class="card"><div class="card-h"><span>${t("Editar el curso")}</span><a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${t("Repositorio")}</a></div><div class="card-b steps-box">
        <p>${t("1. Clona el repositorio fuente:")}</p>${cmdBox(`git clone ${c.cloneUrl}`)}
        <p>${t("2. Comprueba tus cambios antes de subirlos:")}</p>${cmdBox("byox check")}
        <p>${t("3. Haz push a {main}: se verifica solo en unos segundos.", { main: "<code>main</code>" })}</p>
        <p class="muted">${t("El formato está en la {guide}.", { guide: `<a href="/api/author/guide" target="_blank" rel="noopener">${t("guía de cursos")}</a>` })}</p>
      </div></div>
      <div class="card"><div class="card-h"><span>${t("Último commit")}</span></div><div class="card-b">
        <p class="mono" style="margin:0">${esc(c.sha.slice(0, 7))}</p><p style="margin:4px 0 0">${esc(c.message ?? "")}</p></div></div>
    </aside></div></div>`;
  shell("authored", crumbs(title), "", body);
  addCopyButtons(document.getElementById("content"));
  if (v.busy || v.state === "pending") authorPoll = setTimeout(() => authorPage(slug, true), 3000);
}

async function verifyNow(slug) {
  try {
    await post(`/author/${encodeURIComponent(slug)}/verify`);
    toast(t("Verificación en curso"));
    authorPage(slug, true);
  } catch (e) {
    toast(e.message, "circle-x");
  }
}

// ---------- cuenta: iniciar sesión, registro, tokens ----------
/** Mensaje de un error de la API, en lenguaje de persona. */
const errText = (e) => (e?.status ? e.message : t("No pude conectarme con byox. Revisa que el servidor esté en marcha."));

async function showLogin(note = "") {
  S.authState ??= await api("/auth/state").catch(() => ({ signup: "closed", minPassword: 10 }));
  loginPage(note);
}

function loginPage(note = "", mode = "login") {
  const st = S.authState ?? { signup: "closed", minPassword: 10 };
  const canSignup = st.signup !== "closed";
  const signing = mode === "signup" && canSignup;
  S.loginMode = signing ? "signup" : "login";
  const other = LANG === "en" ? ["es", "Español"] : ["en", "English"];
  $app.innerHTML = `<main class="auth">
    <div class="auth-card">
      <a class="auth-brand" href="/" aria-label="${t("byox, inicio")}"><span class="logo">${LOGO}</span><span>byox</span></a>
      <h1>${signing ? t("Crea tu cuenta") : t("Inicia sesión")}</h1>
      <p class="muted">${signing ? t("Tu progreso, tu racha y tus repositorios quedan en tu cuenta.") : t("Entra para seguir tus cursos.")}</p>
      ${note ? `<div class="notice"><span>${esc(note)}</span></div>` : ""}
      <form class="auth-form" novalidate>
        <label class="field"><span>${t("Usuario")}</span><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus /></label>
        ${signing ? `<label class="field"><span>${t("Correo")}</span><input name="email" type="email" autocomplete="email" required /></label>` : ""}
        <label class="field"><span>${t("Contraseña")}</span><input name="password" type="password" autocomplete="${signing ? "new-password" : "current-password"}" required />${signing ? `<small class="muted">${t("Al menos {n} caracteres.", { n: st.minPassword })}</small>` : ""}</label>
        ${signing && st.signup === "invite" ? `<label class="field"><span>${t("Código de invitación")}</span><input name="invite" autocomplete="off" spellcheck="false" required /></label>` : ""}
        <div class="auth-err" role="alert" hidden></div>
        <button class="btn primary" type="submit">${signing ? t("Crear cuenta") : t("Entrar")}</button>
      </form>
      <p class="auth-alt">${canSignup ? (signing ? `${t("¿Ya tienes cuenta?")} <button class="link" data-auth-mode="login">${t("Inicia sesión")}</button>` : `${t("¿No tienes cuenta?")} <button class="link" data-auth-mode="signup">${t("Crear una")}</button>`) : `<span class="muted">${t("El registro está cerrado: pídele una cuenta a quien administra esta instancia.")}</span>`}</p>
      <p class="auth-foot"><a href="/docs">${t("Documentación")}</a> · <a href="#" data-lang="${other[0]}" lang="${other[0]}">${other[1]}</a></p>
    </div>
  </main>`;
  paint();
  const form = $app.querySelector(".auth-form");
  const err = $app.querySelector(".auth-err");
  $app.querySelectorAll("[data-auth-mode]").forEach((b) => b.addEventListener("click", () => loginPage("", b.dataset.authMode)));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("button[type=submit]");
    err.hidden = true;
    btn.disabled = true;
    try {
      S.me = await post(signing ? "/auth/signup" : "/auth/login", data);
      await loadGlobals();
      route();
    } catch (ex) {
      err.textContent = errText(ex);
      err.hidden = false;
      btn.disabled = false;
      form.querySelector("input[name=password]").select();
    }
  });
}

async function logout() {
  await post("/auth/logout").catch(() => {});
  Object.assign(S, { me: null, courses: null, health: null, profile: null });
  ctx = null;
  history.pushState(null, "", `${A}/`);
  showLogin(t("Cerraste sesión."));
}

const when = (iso) => (iso ? ago(iso) : t("nunca"));
const tokenCmds = (tok) => [
  ["Claude Code", `claude mcp add --transport http byox ${mcpUrl()} --header "Authorization: Bearer ${tok}"`],
  [t("CLI de byox"), `byox login ${tok}`],
];

async function accountPage() {
  shell("account", crumb([{ label: t("Cuenta") }]), "", loading);
  const me = S.me ?? (await api("/auth/me"));
  S.me = me;
  const [tokens, invites] = await Promise.all([
    api("/auth/tokens").catch(() => []),
    me.admin && S.authState?.signup === "invite" ? api("/auth/invites").catch(() => []) : [],
  ]);
  const forgejo = S.health?.forgejoUrl ?? "http://localhost:3000";
  const tokenRows = tokens.length
    ? tokens.map((k) => `<li><div><b>${esc(k.name)}</b><small class="muted">${t("Creado {when} · último uso: {last}", { when: ago(k.created), last: when(k.last) })}</small></div><button class="btn" data-revoke="${esc(k.id)}">${t("Revocar")}</button></li>`).join("")
    : `<li class="muted empty-row">${t("Todavía no creaste ningún token.")}</li>`;
  const html = `<div class="wrap acct">
    <div class="phead"><div><h1>${t("Cuenta")}</h1><p>${esc(me.user)}${me.admin ? ` · <span class="badge on">${t("Administrador")}</span>` : ""}${me.email ? ` · ${esc(me.email)}` : ""}</p></div>
      <div class="phead-actions"><a class="btn" href="${esc(forgejo)}/${esc(me.user)}" target="_blank" rel="noopener">${ic("external-link")} ${t("Perfil en Forgejo")}</a><button class="btn" data-act="logout">${ic("log-out")} ${t("Cerrar sesión")}</button></div></div>

    <section class="card"><div class="card-h"><span>${t("Tokens de acceso")}</span></div><div class="card-b">
      <p class="muted">${t("Un token deja que tu asistente (MCP) o el CLI actúen como tú. Se muestra una sola vez; si lo pierdes, revócalo y crea otro.")}</p>
      <ul class="tok-list">${tokenRows}</ul>
      <form class="tok-new"><input name="name" placeholder="${t("Nombre, por ejemplo: Claude Code en mi portátil")}" maxlength="60" aria-label="${t("Nombre del token")}" /><button class="btn primary" type="submit">${t("Crear token")}</button></form>
      <div class="tok-reveal" hidden></div>
    </div></section>

    <section class="card"><div class="card-h"><span>${t("Contraseña")}</span></div><div class="card-b">
      <form class="pw-form" novalidate>
        <label class="field"><span>${t("Contraseña actual")}</span><input name="current" type="password" autocomplete="current-password" required /></label>
        <label class="field"><span>${t("Nueva contraseña")}</span><input name="next" type="password" autocomplete="new-password" required /><small class="muted">${t("Al menos {n} caracteres. Se cierran tus demás sesiones.", { n: S.authState?.minPassword ?? 10 })}</small></label>
        <div class="auth-err" role="alert" hidden></div>
        <button class="btn" type="submit">${t("Cambiar contraseña")}</button>
      </form>
    </div></section>

    <section class="card"><div class="card-h"><span>Idioma / Language</span></div><div class="card-b">
      <div class="seg" role="group" aria-label="Idioma / Language"><button type="button" data-lang="es" lang="es" aria-pressed="${LANG === "es"}">Español</button><button type="button" data-lang="en" lang="en" aria-pressed="${LANG === "en"}">English</button></div>
    </div></section>

    ${me.admin && S.authState?.signup === "invite" ? `<section class="card"><div class="card-h"><span>${t("Invitaciones")}</span></div><div class="card-b">
      <p class="muted">${t("Cada código sirve para una cuenta.")} ${invites.length ? t("Hay {n}.", { n: plural(invites.length, "código sin usar", "códigos sin usar") }) : t("No hay códigos sin usar.")}</p>
      <button class="btn" data-act="invite">${t("Crear código")}</button>
      <div class="inv-out" hidden></div>
    </div></section>` : ""}
  </div>`;
  shell("account", crumb([{ label: t("Cuenta") }]), "", html);

  const out = $app.querySelector(".tok-reveal");
  $app.querySelector(".tok-new").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    try {
      const tk = await post("/auth/tokens", { name: e.target.name.value });
      out.hidden = false;
      out.innerHTML = `<div class="notice done"><span><b>${t("Copia tu token ahora.")}</b> ${t("No volverá a mostrarse.")}</span></div>${cmdBox(tk.token)}
        ${tokenCmds(tk.token).map(([l, c]) => `<p class="muted">${esc(l)}</p>${cmdBox(c)}`).join("")}
        <button class="btn" data-act="reload">${t("Listo")}</button>`;
      paint();
    } catch (ex) {
      toast(errText(ex), "circle-x");
      btn.disabled = false;
    }
  });
  $app.querySelectorAll("[data-revoke]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(t("¿Revocar este token? Lo que lo use dejará de funcionar."))) return;
      try {
        await api(`/auth/tokens/${b.dataset.revoke}`, { method: "DELETE" });
        toast(t("Token revocado"));
        accountPage();
      } catch (ex) {
        toast(errText(ex), "circle-x");
      }
    }),
  );
  const pw = $app.querySelector(".pw-form");
  pw.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = pw.querySelector(".auth-err");
    err.hidden = true;
    try {
      await post("/auth/password", { current: pw.current.value, next: pw.next.value });
      pw.reset();
      toast(t("Contraseña actualizada"));
    } catch (ex) {
      err.textContent = errText(ex);
      err.hidden = false;
    }
  });
  $app.querySelector("[data-act=logout]")?.addEventListener("click", logout);
  $app.querySelector("[data-act=invite]")?.addEventListener("click", async (e) => {
    try {
      const { code } = await post("/auth/invites", {});
      const box = $app.querySelector(".inv-out");
      box.hidden = false;
      box.innerHTML = `<p class="muted">${t("Compártelo con quien vaya a registrarse:")}</p>${cmdBox(code)}`;
      paint();
      e.target.blur();
    } catch (ex) {
      toast(errText(ex), "circle-x");
    }
  });
  paint();
}

// ---------- router ----------
function navigate(path) {
  history.pushState(null, "", path);
  route();
}

async function route() {
  await routeInner();
  // Teclado y lectores de pantalla: al cambiar de vista el foco pasa al contenido, no se queda en el link anterior.
  if (!document.querySelector(".overlay")) document.getElementById("content")?.focus({ preventScroll: true });
}
async function routeInner() {
  const parts = appPath().split("/").filter(Boolean);
  document.querySelectorAll(".overlay").forEach((o) => o.remove());
  stopAuthorPoll();
  try {
    if (parts[0] === "c" && parts[1]) {
      const slug = decodeURIComponent(parts[1]);
      const n = parts[2] ? Number(parts[2]) : undefined;
      if (ctx?.slug === slug && n && ctx.n && document.getElementById("track")) {
        // De una etapa a otra del mismo curso: sólo cambia la etapa, sin redibujar el shell.
        ctx.n = n;
        ctx.tab = "instrucciones";
        document.querySelector(".crumbs .cur").textContent = `#${n}`;
        renderTrack();
        renderAside();
        document.getElementById("main").scrollTop = 0;
        return loadIssue();
      }
      return await coursePage(slug, n);
    }
    stopPolling();
    ctx = null;
    if (parts[0] === "cursos") return await coursesPage();
    if (parts[0] === "actividad") return await activityPage();
    if (parts[0] === "creados") return parts[1] ? await authorPage(decodeURIComponent(parts[1])) : await authoredPage();
    if (parts[0] === "cuenta") return await accountPage();
    await home();
  } catch (e) {
    if (e.status === 401) return; // api() ya mostró el login
    shell("home", crumb([{ label: t("Error") }]), "", `${empty("error", t("No se pudo cargar la página"), esc(e.message), `<button class="btn" data-act="reload">${t("Reintentar")}</button>`)}`);
  }
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey && e.button === 0) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
    return;
  }
  const row = e.target.closest("tr[data-href]");
  if (row) return navigate(row.dataset.href);
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "reload") route();
  if (act === "slim") toggleSlim();
  if (act === "palette") palette();
  if (act === "mcp") mcpDialog();
  if (act === "import") importDialog();
  if (act === "new-course") newCourseDialog();
  if (act === "share") shareDialog(e.target.closest("[data-slug]").dataset.slug);
  if (act === "verify") verifyNow(e.target.closest("[data-slug]").dataset.slug);
  const lg = e.target.closest("[data-lang]");
  if (lg) {
    e.preventDefault();
    if (lg.dataset.lang !== LANG) setLang(lg.dataset.lang);
    return;
  }
  const cc = e.target.closest(".code-copy");
  if (cc) return copyCode(cc);
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    ctx.tab = tab.dataset.tab;
    renderMain();
  }
  const cmd = e.target.closest("[data-cmd]");
  if (cmd) {
    ctx.cmdTab = cmd.dataset.cmd;
    renderMain();
  }
  const cp = e.target.closest("[data-copy]");
  if (cp) copy(cp.dataset.copy, cp.dataset.what);
  if (e.target.closest("#hintBtn")) askHint();
  const fold = e.target.closest("[data-fold]");
  if (fold && ctx) {
    const id = fold.dataset.fold;
    ctx.collapsed.has(id) ? ctx.collapsed.delete(id) : ctx.collapsed.add(id);
    renderTrack();
  }
});

// Doherty: precargar la etapa cuando la apuntás, así abre sin espera.
function prefetch(e) {
  const a = e.target.closest?.("a[data-link]");
  const m = a?.getAttribute("href").match(/^\/app\/c\/([^/]+)\/(\d+)$/);
  if (!m || !ctx || m[1] !== ctx.slug) return;
  const n = Number(m[2]);
  ctx.prefetching ??= new Set();
  if (ctx.issueCache.has(n) || ctx.prefetching.has(n)) return;
  ctx.prefetching.add(n);
  const slug = ctx.slug;
  api(`/courses/${encodeURIComponent(slug)}/issues/${n}`)
    .then((d) => ctx?.slug === slug && ctx.issueCache.set(n, d))
    .catch(() => {})
    .finally(() => ctx?.prefetching?.delete(n));
}
document.addEventListener("pointerover", prefetch);
document.addEventListener("focusin", prefetch);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    return palette();
  }
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable]") || document.querySelector(".overlay")) return;
  if (e.key === "?" || (e.key === "/" && e.shiftKey)) return shortcuts();
  if (e.key === "[") return toggleSlim();
  if (!ctx?.course?.started) return;
  const go = (n) => hasIssue(n) && navigate(`${A}/c/${ctx.slug}/${n}`);
  if (e.key === "n") {
    const r = ctx.course.issues.find((x) => x.state === "ready");
    if (r) go(r.n);
  } else if (!ctx.n) return;
  else if (e.key === "ArrowRight" || e.key === "j") go(ctx.n + 1);
  else if (e.key === "ArrowLeft" || e.key === "k") go(ctx.n - 1);
  else if (["1", "2", "3", "4"].includes(e.key)) {
    ctx.tab = ["instrucciones", "pistas", "salida", "actividad"][Number(e.key) - 1];
    renderMain();
  } else return;
  e.preventDefault();
});

addEventListener("popstate", route);
/** Cambio de idioma con la app abierta: se vuelve a pintar la vista actual, sin recargar. */
document.addEventListener("byox-lang", () => {
  if (document.querySelector(".auth")) return loginPage("", S.loginMode);
  document.querySelectorAll(".overlay, .toast").forEach((o) => o.remove());
  if (ctx?.course?.started && document.getElementById("track")) {
    renderCourse();
    tabSignal();
  } else route();
});
/** Primero quién eres: sin sesión se muestra el login y la app no carga nada más. */
async function boot() {
  try {
    S.me = await api("/auth/me");
  } catch (e) {
    if (e.status === 401) return showLogin();
    // El servidor no responde: se sigue, y cada vista muestra su error con «Reintentar».
  }
  await loadGlobals();
  route();
}
boot();


