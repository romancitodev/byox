// byox — documentación: menú móvil, índice con scrollspy, copiar código y buscador (Ctrl K o /).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- menú móvil ----------
const side = $("#docs-side");
const menu = $("[data-menu]");
const scrim = $("[data-scrim]");
function setMenu(open) {
  side.classList.toggle("open", open);
  scrim.hidden = !open;
  menu.setAttribute("aria-expanded", String(open));
}
menu?.addEventListener("click", () => setMenu(!side.classList.contains("open")));
scrim?.addEventListener("click", () => setMenu(false));
side?.addEventListener("click", (e) => e.target.closest("a") && setMenu(false));

// ---------- índice de la página ----------
const links = $$(".docs-toc a");
if (links.length) {
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const heads = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const mark = () => {
    // El último título que ya pasó el borde superior (con margen para la barra fija).
    let cur = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top <= 110) cur = h;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = heads.at(-1);
    links.forEach((a) => a.classList.toggle("on", a === byId.get(cur?.id)));
  };
  addEventListener("scroll", mark, { passive: true });
  mark();
}

// ---------- listas numeradas que siguen a otra (start="3") ----------
for (const ol of $$(".doc ol[start]")) ol.style.counterReset = `step ${Number(ol.getAttribute("start")) - 1}`;

// ---------- copiar código ----------
for (const pre of $$(".doc pre")) {
  const wrap = document.createElement("div");
  wrap.className = "codeblock";
  pre.replaceWith(wrap);
  wrap.append(pre);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy";
  btn.textContent = "Copiar";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
      btn.textContent = "Copiado";
      btn.classList.add("done");
    } catch {
      btn.textContent = "No se pudo";
    }
    setTimeout(() => {
      btn.textContent = "Copiar";
      btn.classList.remove("done");
    }, 1600);
  });
  wrap.append(btn);
}

// ---------- buscador ----------
const find = $("[data-find]");
const input = $("input", find);
const list = $(".docs-find-list", find);
const empty = $(".docs-find-empty", find);
let index = null;
let results = [];
let sel = 0;

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function load() {
  if (index) return index;
  try {
    index = await (await fetch("/docs/search.json")).json();
  } catch {
    index = [];
  }
  return index;
}

/** Puntaje por página: el título pesa más que las secciones, y éstas más que el texto. */
function search(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out = [];
  for (const p of index) {
    const title = norm(p.title);
    const text = norm(p.text);
    let score = 0;
    let ok = true;
    let hit = null;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const sec = p.sections.find((s) => norm(s.text).includes(t));
      const at = text.indexOf(t);
      if (!inTitle && !sec && at < 0) { ok = false; break; }
      score += (inTitle ? 10 : 0) + (sec ? 5 : 0) + (at >= 0 ? 1 : 0);
      if (!hit && at >= 0) hit = at;
    }
    if (!ok) continue;
    const firstSec = p.sections.find((s) => terms.some((t) => norm(s.text).includes(t)));
    const start = hit == null ? 0 : Math.max(0, hit - 50);
    let snippet = p.text.slice(start, start + 160);
    if (start > 0) snippet = `…${snippet.replace(/^\S*\s/, "")}`;
    out.push({ p, score, sec: firstSec, snippet, terms });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

function mark(text, terms) {
  let html = esc(text);
  for (const t of terms) {
    if (t.length < 2) continue;
    html = html.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
  }
  return html;
}

function paint() {
  empty.hidden = results.length > 0 || !input.value.trim();
  list.innerHTML = results
    .map(
      (r, k) => `<li role="option"><a href="${r.p.url}${r.sec ? `#${r.sec.id}` : ""}" aria-selected="${k === sel}">
        <span class="t">${esc(r.p.title)}${r.sec ? ` <span style="color:var(--ink-3);font-weight:400">› ${esc(r.sec.text)}</span>` : ""}<small>${esc(r.p.group)}</small></span>
        <span class="s">${mark(r.snippet, r.terms)}</span></a></li>`,
    )
    .join("");
}

function open() {
  find.hidden = false;
  input.value = "";
  results = [];
  sel = 0;
  paint();
  load();
  input.focus();
}
const close = () => (find.hidden = true);

input.addEventListener("input", async () => {
  await load();
  results = search(input.value);
  sel = 0;
  paint();
});
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!results.length) return;
    sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
    paint();
    $(`[aria-selected="true"]`, list)?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    const a = $(`[aria-selected="true"]`, list);
    if (a) location.href = a.getAttribute("href");
  }
});
find.addEventListener("click", (e) => e.target === find && close());
list.addEventListener("click", () => close());
$$("[data-search]").forEach((b) => b.addEventListener("click", open));
addEventListener("keydown", (e) => {
  const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); find.hidden ? open() : close(); }
  else if (e.key === "/" && !typing && find.hidden) { e.preventDefault(); open(); }
  else if (e.key === "Escape") { close(); setMenu(false); }
});
