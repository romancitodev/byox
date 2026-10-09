// Bento de funciones: entrada escalonada, ciclos por celda, tipeo del CLI y pausa fuera de pantalla.
import { uiFor } from "../lib/landing-strings.js";
const S = uiFor(document.documentElement.lang); // textos según <html lang>
const bento = document.querySelector("[data-bento]");
if (bento) init(bento);

function init(bento) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cells = [...bento.querySelectorAll(".b-cell")];
  const cell = (n) => bento.querySelector(`[data-cell="${n}"]`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  cells.forEach((c, i) => c.style.setProperty("--i", i));
  const idle = (c) => c.classList.contains("off") || document.hidden;

  // ciclo genérico: avanza t según las duraciones y se detiene mientras la celda no se ve
  function cycle(c, durations, apply) {
    let t = 0;
    apply(t);
    (function next() {
      if (idle(c)) return void setTimeout(next, 400);
      setTimeout(() => { t = (t + 1) % durations.length; apply(t); next(); }, durations[t]);
    })();
  }

  const ci = cell("ci");
  const ciApply = (t) => { for (let k = 1; k <= 6; k++) ci.classList.toggle("t" + k, t >= k); };
  const live = cell("live"), hint = cell("hint"), docs = cell("docs");
  const srcs = [...hint.querySelectorAll(".b-src em")];
  let srcIdx = 0;
  const hintApply = (t) => {
    hint.dataset.t = t;
    hint.querySelector("[data-hn]").textContent = t === 2 ? "3" : "2";
    if (t === 0) { srcs.forEach((e, i) => e.classList.toggle("on", i === srcIdx % srcs.length)); srcIdx++; }
  };

  function countUp(el, to) {
    const t0 = performance.now() + 300;
    const tick = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / 900));
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // --- terminal del CLI
  const typer = cell("cli").querySelector("[data-typer]");
  const modeBtns = [...cell("cli").querySelectorAll("[data-mode]")];
  const cmds = { docker: "byox test 7", local: "byox test --local", win: ".course\\test 7" };
  const order = ["docker", "local", "win"];
  let mode = "docker", pinned = false, runId = 0;
  const script = (m) => [
    { t: "$ " + cmds[m], type: true },
    { t: S.bento.test, cls: "d" },
    { t: S.bento.fail, cls: "bad" },
    { t: "$ byox hint", type: true },
    { t: S.bento.hint, cls: "d" },
    { t: "$ git push && byox watch", type: true },
    { t: "plan · test · advance", cls: "d" },
    { t: S.bento.done, cls: "ok" },
  ];
  const mkLine = (l) => {
    const d = document.createElement("div");
    if (l.cls) d.className = l.cls;
    typer.appendChild(d);
    return d;
  };
  const setText = (d, text) => {
    d.textContent = text;
    if (text.startsWith("$ ")) { d.textContent = ""; const p = document.createElement("span"); p.className = "p"; p.textContent = "$"; d.append(p, " " + text.slice(2)); }
  };
  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m));
  }
  function printAll() {
    typer.replaceChildren();
    for (const l of script(mode)) setText(mkLine(l), l.t);
  }
  async function runTerm() {
    const my = ++runId;
    const alive = () => my === runId;
    typer.replaceChildren();
    for (const l of script(mode)) {
      while (alive() && idle(cell("cli"))) await wait(400);
      if (!alive()) return;
      const d = mkLine(l);
      if (l.type) {
        for (let i = 1; i <= l.t.length; i++) {
          if (!alive()) return;
          setText(d, l.t.slice(0, i));
          await wait(28);
        }
        await wait(220);
      } else { setText(d, l.t); await wait(150); }
      if (typer.children.length > 8) typer.firstChild.remove();
    }
    await wait(1800);
    if (!alive()) return;
    if (!pinned) setMode(order[(order.indexOf(mode) + 1) % order.length]);
    runTerm();
  }
  modeBtns.forEach((b) => b.addEventListener("click", () => {
    pinned = true;
    setMode(b.dataset.mode);
    if (reduce) printAll(); else runTerm();
  }));

  // --- repetir el error al pasar el mouse (mínimo 2 s entre repeticiones)
  const err = cell("err");
  let lastErr = 0;
  err.addEventListener("pointerenter", () => {
    if (reduce || !err.classList.contains("go") || performance.now() - lastErr < 2200) return;
    lastErr = performance.now();
    err.classList.remove("go");
    void err.offsetWidth;
    err.classList.add("go");
  });

  // --- estados finales con movimiento reducido
  if (reduce) {
    bento.classList.add("in");
    ciApply(6); live.dataset.t = 1; hintApply(2); docs.dataset.t = 0;
    cells.forEach((c) => c.classList.add("go"));
    cell("streak").querySelector("[data-count]").textContent = "12";
    printAll();
    return;
  }

  // --- pausa fuera de pantalla
  const offIO = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("off", !e.isIntersecting)), { threshold: 0 });
  cells.forEach((c) => offIO.observe(c));

  // --- entrada: .in en el marco y .go en cada celda cuando ya está quieta
  const start = {
    ci: () => cycle(ci, [600, 500, 500, 900, 500, 400, 2200], ciApply),
    live: () => cycle(live, [1800, 2600, 1600], (t) => { live.dataset.t = t; }),
    hint: () => cycle(hint, [2200, 300, 3500], hintApply),
    docs: () => cycle(docs, [3500, 3500], (t) => { docs.dataset.t = t; }),
    streak: () => countUp(cell("streak").querySelector("[data-count]"), 12),
    cli: () => runTerm(),
    err: () => {},
  };
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    o.disconnect();
    bento.classList.add("in");
    cells.forEach((c, i) => setTimeout(() => { c.classList.add("go"); start[c.dataset.cell]?.(); }, i * 80 + 450));
  }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }).observe(bento);
}
