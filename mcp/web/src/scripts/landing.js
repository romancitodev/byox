// byox — landing: aparecer al hacer scroll, el demo del hero, el asistente, el grafo y los detalles.
import { uiFor } from "../lib/landing-strings.js";
// Los textos dependen del idioma de la página (<html lang>): es por defecto, en en /en.
const S = uiFor(document.documentElement.lang);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// ---------- nav ----------
const nav = document.querySelector(".l-nav");
const onScroll = () => nav?.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- aparecer al hacer scroll, en cascada dentro de cada grupo ----------
const io = new IntersectionObserver(
  (entries) => {
    const shown = entries.filter((e) => e.isIntersecting);
    shown.forEach((e, k) => {
      e.target.style.transitionDelay = `${Math.min(k, 5) * 70}ms`;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  },
  { rootMargin: "0px 0px -8% 0px" },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
// Si la página carga sin verse (pestaña de fondo, capturas, crawlers) el observer no avisa:
// mejor mostrar todo que dejar la landing en blanco.
const revealAll = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in"));
if (document.hidden) revealAll();
setTimeout(() => {
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.getBoundingClientRect().top < innerHeight && el.classList.add("in"));
}, 1500);

/** Corre `play` mientras el elemento se ve; lo frena (al terminar la vuelta) cuando sale de pantalla. */
function whileVisible(el, play, { once = false } = {}) {
  let visible = false;
  let running = false;
  let played = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !running && !(once && played)) loop();
  }, { threshold: 0.35 }).observe(el);
  async function loop() {
    running = true;
    do {
      await play();
      played = true;
    } while (!once && visible && !document.hidden);
    running = false;
  }
  document.addEventListener("visibilitychange", () => !document.hidden && visible && !running && !(once && played) && loop());
}

// ---------- foco que sigue al cursor en las tarjetas ----------
for (const card of document.querySelectorAll(".tile, .audience article, .steps li")) {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
}

// ---------- pasos: se encienden en orden ----------
const steps = document.querySelector("[data-steps]");
if (steps && !reduced) {
  const items = [...steps.children];
  whileVisible(steps, async () => {
    for (const li of items) {
      items.forEach((x) => x.classList.toggle("on", x === li));
      await wait(1800);
    }
  });
}

// ---------- demo del hero ----------
// La demo es la vista de un curso de la app. Todo cambia con `data-state` (fail -> run -> ok):
// el CSS muestra los fragmentos `data-v` del estado y pinta los `data-b`/`data-a` (antes/después).
const demo = document.querySelector("[data-demo]");
if (demo) {
  const cells = [...demo.querySelectorAll("[data-b]")];
  const curNode = demo.querySelector(".stage.cur");
  const setState = (state) => {
    demo.dataset.state = state;
    for (const c of cells) c.dataset.cs = state === "ok" ? c.dataset.a : c.dataset.b;
  };

  const sparks = () => {
    if (reduced) return;
    const r = demo.querySelector(".dm-modal .ingot").getBoundingClientRect();
    const colors = ["var(--ember)", "#ffb347", "#ffd27a", "var(--done)"];
    for (let k = 0; k < 24; k++) {
      const s = document.createElement("span");
      const a = (Math.PI * 2 * k) / 24 + Math.random() * 0.3;
      const d = 50 + Math.random() * 80;
      s.className = "spark";
      s.style.left = `${r.left + r.width / 2}px`;
      s.style.top = `${r.top + r.height / 2}px`;
      s.style.background = colors[k % colors.length];
      s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      s.style.setProperty("--dy", `${Math.sin(a) * d - 20}px`);
      document.body.append(s);
      setTimeout(() => s.remove(), 1000);
    }
  };

  const scene = async () => {
    demo.removeAttribute("data-celebrate");
    setState("fail"); // el test del push anterior falló: se ve qué esperaba y dónde
    await wait(4200);
    setState("run"); // nuevo push (se escribe en la terminal): el runner ejecuta los tests
    await wait(3600);
    setState("ok"); // pasó: se cierra la etapa y se abre la siguiente
    curNode?.classList.add("pop");
    setTimeout(() => curNode?.classList.remove("pop"), 300);
    await wait(900);
    demo.setAttribute("data-celebrate", "");
    sparks();
    await wait(4300);
    demo.removeAttribute("data-celebrate");
    await wait(500);
  };

  // Sin animación (o con pantalla pequeña de fondo): el estado final, quieto, sin el aviso.
  setState("ok");
  if (!reduced) {
    setState("fail");
    whileVisible(demo, scene);
  }
}

// ---------- el asistente creando un curso ----------
const assist = document.querySelector("[data-assist]");
if (assist) {
  const rows = [...assist.querySelectorAll("[data-line]")];
  const typed = assist.querySelector("[data-type]");
  const text = typed.dataset.type;
  const show = (row) => row.classList.add("shown");
  const still = () => {
    typed.textContent = text;
    rows.forEach((r) => r.classList.add("shown", "done"));
  };
  // Cargada en segundo plano, la sesión se muestra completa hasta que entre en pantalla.
  if (reduced || document.hidden) still();
  if (!reduced) {
    whileVisible(assist, async () => {
      rows.forEach((r) => r.classList.remove("shown", "done", "busy"));
      typed.textContent = "";
      show(rows[0]);
      for (let k = 1; k <= text.length; k++) {
        typed.textContent = text.slice(0, k);
        await wait(28 + Math.random() * 30);
      }
      rows[0].classList.add("done");
      await wait(600);
      for (const row of rows.slice(1, -1)) {
        show(row);
        row.classList.add("busy");
        await wait(900 + Math.random() * 700);
        row.classList.replace("busy", "done");
        await wait(250);
      }
      show(rows.at(-1));
      await wait(5000);
    });
  }
}

// ---------- grafo ----------
const graph = document.querySelector("[data-graph]");
if (graph) {
  const order = JSON.parse(graph.dataset.order);
  const info = JSON.parse(graph.dataset.info);
  const caption = graph.querySelector("[data-caption]");
  const nodes = new Map([...graph.querySelectorAll(".gnode")].map((g) => [Number(g.dataset.n), g]));
  const paths = [...graph.querySelectorAll(".edges path")];
  const defaultCaption = caption.innerHTML;

  const paint = (done) => {
    for (const [n, g] of nodes) {
      const st = done.has(n) ? "done" : info[n].deps.every((d) => done.has(d)) ? "ready" : "locked";
      g.classList.remove("done", "ready", "locked");
      g.classList.add(st);
    }
    for (const p of paths) p.classList.toggle("lit", done.has(Number(p.dataset.from)) && done.has(Number(p.dataset.to)));
  };

  const play = async () => {
    const done = new Set();
    paint(done);
    await wait(600);
    for (const n of order) {
      done.add(n);
      paint(done);
      await wait(260);
    }
    await wait(2600);
  };

  // Al pasar por una etapa: qué requiere y qué desbloquea.
  const focus = (g) => {
    const n = Number(g.dataset.n);
    const opens = Object.entries(info).filter(([, x]) => x.deps.includes(n)).map(([k]) => `#${k}`);
    const needs = info[n].deps.map((d) => `#${d}`);
    caption.innerHTML = `<b>#${n} ${esc(info[n].t)}</b> · ${needs.length ? `${S.graph.requires} ${needs.join(` ${S.and} `)}` : S.graph.noReqs}${opens.length ? ` · ${S.graph.unlocks} ${opens.join(", ")}` : ""}`;
    for (const p of paths) p.classList.toggle("hl", p.dataset.to === String(n) || p.dataset.from === String(n));
  };
  const blur = () => {
    caption.innerHTML = defaultCaption;
    paths.forEach((p) => p.classList.remove("hl"));
  };
  for (const g of nodes.values()) {
    g.addEventListener("pointerenter", () => focus(g));
    g.addEventListener("focus", () => focus(g));
    g.addEventListener("pointerleave", blur);
    g.addEventListener("blur", blur);
  }

  if (reduced) paint(new Set(order.slice(0, Math.ceil(order.length / 2))));
  else whileVisible(graph, play);
}
