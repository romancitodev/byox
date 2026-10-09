// Tablero interactivo: simula pushes sobre un curso de ejemplo.
import { uiFor } from "../lib/landing-strings.js";
const T = uiFor(document.documentElement.lang); // textos según <html lang>
const S = T.quest;
const AND = T.and;
const root = document.querySelector("[data-quest]");
if (root) init(root);

function init(root) {
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mq = matchMedia("(max-width: 880px)");
  const { milestones, issues, slug, fail: failData } = JSON.parse(root.querySelector("[data-quest-data]").textContent);
  const $ = (s) => root.querySelector(s);
  const byN = new Map(issues.map((i) => [i.n, i]));
  const opens = new Map(issues.map((i) => [i.n, issues.filter((o) => o.deps.includes(i.n)).map((o) => o.n)]));
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 60) : ms));
  const cols = milestones.map((m) => issues.filter((i) => i.milestone === m.id));
  const maxRows = Math.max(...cols.map((c) => c.length));
  const R = 22;

  // --- estado
  let done = new Set(), running = null, sel = 1, playing = false, token = 0, failedOnce = false, failing = null, touched = false;
  const status = (n) => (done.has(n) ? "done" : running === n ? "running" : byN.get(n).deps.every((d) => done.has(d)) ? "ready" : "locked");
  const label = S.state;

  const svg = $("[data-q-svg]");
  const board = $("[data-q-board]");
  const segs = $("[data-q-segs]");
  issues.forEach((i) => { const s = document.createElement("i"); s.dataset.n = i.n; segs.appendChild(s); });
  const logEl = $("[data-q-log]");

  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent?.appendChild(e);
    return e;
  };
  const wrap = (t, max = 18) => {
    const lines = [""];
    for (const w of t.split(" ")) {
      const cur = lines[lines.length - 1];
      if (cur && (cur + " " + w).length > max) lines.push(w); else lines[lines.length - 1] = cur ? cur + " " + w : w;
    }
    return lines.length > 2 ? [lines[0], lines.slice(1).join(" ").slice(0, max - 1) + "…"] : lines;
  };

  // --- geometría (escritorio: milestones en columnas; móvil: en filas)
  let pos, nodes, edges, tip, tipBg, tipTx, colSubs;
  function layout() {
    const mobile = mq.matches;
    svg.replaceChildren();
    pos = new Map(); nodes = new Map(); edges = [];
    let W, H;
    if (!mobile) {
      const PX = 100, ROW = 108, TOP = 124;
      W = 780; H = TOP + (maxRows - 1) * ROW + R + 44;
      cols.forEach((list, c) => list.forEach((i, r) => pos.set(i.n, { x: PX + (c * (W - 2 * PX)) / (cols.length - 1), y: TOP + r * ROW, c, r })));
    } else {
      const BAND = 132;
      W = 340; H = cols.length * BAND - 8;
      cols.forEach((list, c) => list.forEach((i, r) => pos.set(i.n, { x: 58 + r * 112, y: c * BAND + 72, c, r })));
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.dataset.mobile = mobile ? "1" : "";

    colSubs = [];
    cols.forEach((list, c) => {
      if (!mobile) {
        const x = pos.get(list[0].n).x;
        el("rect", { x: x - 76, y: 16, width: 152, height: H - 32, rx: 14, class: "q-col" }, svg);
        el("text", { x, y: 48, class: "q-ms", "text-anchor": "middle" }, svg).textContent = milestones[c].title;
        colSubs.push(el("text", { x, y: 66, class: "q-ms-sub", "text-anchor": "middle" }, svg));
      } else {
        const y0 = c * 132;
        el("rect", { x: 4, y: y0, width: 332, height: 124, rx: 12, class: "q-col" }, svg);
        el("text", { x: 16, y: y0 + 26, class: "q-ms" }, svg).textContent = milestones[c].title;
        colSubs.push(el("text", { x: 324, y: y0 + 26, class: "q-ms-sub", "text-anchor": "end" }, svg));
      }
    });

    const gEdges = el("g", { class: "q-edges" }, svg);
    const gNodes = el("g", { class: "q-nodes" }, svg);

    for (const i of issues) {
      for (const d of i.deps) {
        const a = pos.get(d), b = pos.get(i.n);
        let path;
        if (!mobile) {
          if (a.c === b.c) {
            const bow = 56 + 24 * (Math.abs(b.r - a.r) - 1);
            path = `M${a.x + R} ${a.y} C${a.x + R + bow} ${a.y} ${b.x + R + bow} ${b.y} ${b.x + R} ${b.y}`;
          } else if (a.y === b.y && b.c - a.c > 1) {
            const dx = b.x - a.x;
            path = `M${a.x + R * 0.7} ${a.y - R * 0.7} C${a.x + dx / 5} ${a.y - 56} ${b.x - dx / 5} ${b.y - 56} ${b.x - R * 0.7} ${b.y - R * 0.7}`;
          } else {
            const dx = (b.x - a.x) / 2;
            path = `M${a.x + R} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x - R} ${b.y}`;
          }
        } else if (a.c === b.c) {
          path = `M${a.x + R} ${a.y} L${b.x - R} ${b.y}`;
        } else {
          path = `M${a.x} ${a.y + R} C${a.x} ${a.y + R + 46} ${b.x} ${b.y - R - 46} ${b.x} ${b.y - R}`;
        }
        edges.push({ from: d, to: i.n, p: el("path", { d: path }, gEdges) });
      }
    }

    for (const i of issues) {
      const { x, y } = pos.get(i.n);
      const g = el("g", { class: "q-node", transform: `translate(${x} ${y})`, role: "button" }, gNodes);
      el("circle", { r: R + 8, class: "q-halo" }, g);
      el("circle", { r: R, class: "q-disc" }, g);
      el("circle", { r: R + 5, class: "q-spin" }, g);
      el("circle", { r: R, class: "q-burst" }, g);
      el("path", { d: "M-8 0.5 -2.5 6 8.5 -5.5", class: "q-check" }, g);
      el("text", { class: "q-num", y: 0.5 }, g).textContent = i.n;
      const t = el("text", { class: "q-lbl", "text-anchor": "middle" }, g);
      wrap(i.title).forEach((ln, k) => { const s = el("tspan", { x: 0, y: R + 17 + k * 13 }, t); s.textContent = ln; });
      nodes.set(i.n, g);
      g.addEventListener("click", () => onNode(i.n));
      g.addEventListener("keydown", (e) => keyNode(e, i.n));
      g.addEventListener("pointerenter", () => { focusOn(i.n); showTip(i.n); });
      g.addEventListener("pointerleave", () => { focusOn(null); showTip(null); });
      g.addEventListener("focus", () => { focusOn(i.n); });
      g.addEventListener("blur", () => focusOn(null));
    }

    tip = el("g", { class: "q-tip", opacity: 0 }, svg);
    tipBg = el("rect", { height: 24, rx: 6 }, tip);
    tipTx = el("text", { "text-anchor": "middle", y: 16 }, tip);
    render();
  }

  function showTip(n) {
    if (!n || status(n) !== "locked") { tip.setAttribute("opacity", 0); return; }
    const missing = byN.get(n).deps.filter((d) => !done.has(d)).map((d) => "#" + d).join(` ${AND} `);
    const txt = S.needs(missing);
    const w = txt.length * 6.4 + 18, p = pos.get(n);
    tipBg.setAttribute("width", w); tipBg.setAttribute("x", -w / 2);
    tipTx.textContent = txt;
    tip.setAttribute("transform", `translate(${p.x} ${p.y - R - 34})`);
    tip.setAttribute("opacity", 1);
  }

  function log(html, cls = "") {
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = html;
    logEl.prepend(li);
    while (logEl.children.length > 5) logEl.lastChild.remove();
  }

  function focusOn(n) {
    const rel = new Set(n ? [n, ...byN.get(n).deps, ...opens.get(n)] : []);
    nodes.forEach((g, k) => g.classList.toggle("dim", !!n && !rel.has(k)));
    edges.forEach((e) => {
      const on = n && (e.from === n || e.to === n);
      e.p.classList.toggle("hl", !!on);
      e.p.classList.toggle("dim", !!n && !on);
    });
  }

  const STATES = ["done", "ready", "running", "locked"];
  function render() {
    nodes.forEach((g, n) => {
      const st = status(n);
      STATES.forEach((s) => g.classList.toggle(s, s === st));
      g.classList.toggle("sel", n === sel);
      g.classList.toggle("bad", failing === n);
      g.setAttribute("tabindex", n === sel ? 0 : -1);
      g.setAttribute("aria-disabled", st === "locked" ? "true" : "false");
      g.setAttribute("aria-label", S.stageLabel(n, byN.get(n).title, failing === n ? S.failedRetry : label[st]));
    });
    edges.forEach((e) => {
      const toSt = status(e.to), lit = done.has(e.from);
      e.p.classList.toggle("done", lit && toSt === "done");
      e.p.classList.toggle("flow", lit && (toSt === "ready" || toSt === "running"));
      e.p.classList.toggle("part", lit && toSt === "locked");
    });
    segs.querySelectorAll("i").forEach((s) => (s.className = status(Number(s.dataset.n))));
    $("[data-q-count]").textContent = done.size;
    colSubs.forEach((t, c) => { t.textContent = `${cols[c].filter((i) => done.has(i.n)).length}/${cols[c].length}`; });
    $("[data-q-hint]").hidden = done.size > 0 || running !== null || playing;
    root.classList.toggle("complete", done.size === issues.length);
    panel();
  }

  function chips(host, list, empty) {
    host.replaceChildren();
    if (!list.length) { const s = document.createElement("em"); s.textContent = empty; host.appendChild(s); return; }
    for (const n of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `chip ${status(n)}`;
      b.textContent = `#${n}`;
      b.title = byN.get(n).title;
      b.addEventListener("click", () => select(n));
      host.appendChild(b);
    }
  }

  function panel() {
    const i = byN.get(sel), st = status(sel), bad = failing === sel;
    $("[data-qp-n]").textContent = `#${i.n}`;
    const badge = $("[data-qp-badge]");
    badge.textContent = bad ? S.failed : label[st];
    badge.className = `qp-badge ${bad ? "bad" : st}`;
    $("[data-qp-title]").textContent = i.title;
    $("[data-qp-ms]").textContent = milestones.find((m) => m.id === i.milestone).title;
    chips($("[data-qp-deps]"), i.deps, S.noDeps);
    chips($("[data-qp-opens]"), opens.get(sel), S.noOpens);
    $("[data-qp-cmd]").textContent = i.test.startsWith("go test") ? `byox test ${i.n}` : `byox test ${i.n}`;
    const failBox = $("[data-qp-fail]");
    failBox.hidden = !bad;
    if (!bad) $("[data-qp-hintbox]").hidden = true;
    const run = $("[data-qp-run]");
    const complete = done.size === issues.length;
    run.hidden = complete;
    $("[data-qp-end]").hidden = !complete;
    run.disabled = st !== "ready" || playing;
    const missing = i.deps.filter((d) => !done.has(d));
    run.textContent = bad ? S.retry : st === "ready" ? S.simulate : st === "done" ? S.stageDone : st === "running" ? S.runningCi : S.completeFirst(missing.map((d) => "#" + d).join(` ${AND} `));
  }

  function select(n) { sel = n; render(); }

  function onNode(n) {
    select(n);
    if (status(n) === "ready" && !playing) complete(n);
  }

  function keyNode(e, n) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNode(n); return; }
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
      const score = along + across * 2.2;
      if (score < bs) { bs = score; best = k; }
    }
    if (best) { select(best); nodes.get(best).focus(); }
  }

  async function complete(n) {
    if (running) return;
    const my = token;
    const before = new Set(issues.filter((i) => status(i.n) === "ready").map((i) => i.n));
    running = n; sel = n; failing = null;
    log(`<span class="p">$</span> git push <em>#${n}</em>`);
    render();
    await wait(380);
    if (my !== token) return;
    log(`<span class="d">${S.planLog}</span>`);
    await wait(320);
    if (my !== token) return;
    log(`<span class="d">${S.testLog(byN.get(n).test)}</span>`);
    await wait(480);
    if (my !== token) return;
    running = null;

    // un fallo guionado, una sola vez, en la primera etapa que requiere varias: muestra error, pista y reintento
    if (!failedOnce && byN.get(n).deps.length > 1) {
      failedOnce = true; failing = n;
      log(`<b class="bad">✕</b> ${S.failLog(n, failData.where)}`, "bad");
      render();
      const g = nodes.get(n);
      g.classList.add("shake"); setTimeout(() => g.classList.remove("shake"), 500);
      return "fail";
    }

    failing = null;
    done.add(n);
    const fresh = issues.filter((i) => status(i.n) === "ready" && !before.has(i.n)).map((i) => i.n);
    log(`<span class="d">advance</span> <b class="ok">✓</b> ${S.passLog(n, fresh.map((f) => "#" + f))}`, "ok");
    render();
    const g = nodes.get(n);
    g.classList.add("pop");
    fresh.forEach((f) => nodes.get(f).classList.add("unlock"));
    setTimeout(() => { g.classList.remove("pop"); fresh.forEach((f) => nodes.get(f)?.classList.remove("unlock")); }, 1300);
    if (done.size === issues.length && !playing && !reduce) setTimeout(() => $("[data-qp-end] a")?.focus({ preventScroll: true }), 400);
    return "ok";
  }

  async function play() {
    if (playing) { playing = false; syncPlay(); render(); return; }
    reset(true);
    playing = true; syncPlay(); render();
    const my = token;
    await wait(500);
    while (playing && my === token) {
      const next = issues.find((i) => status(i.n) === "ready");
      if (!next) break;
      const r = await complete(next.n);
      if (my !== token) return;
      await wait(r === "fail" ? 1700 : 550);
    }
    if (my === token) { playing = false; syncPlay(); render(); }
  }
  function syncPlay() {
    const b = $("[data-q-play]");
    b.querySelector("span").textContent = playing ? S.stop : S.play;
    b.classList.toggle("on", playing);
  }
  function reset(keepPlay) {
    token++;
    if (!keepPlay) playing = false;
    done = new Set(); running = null; sel = 1; failedOnce = false; failing = null;
    logEl.replaceChildren();
    syncPlay();
    render();
  }

  root.querySelectorAll("[data-q-reset]").forEach((b) => b.addEventListener("click", () => { touched = true; reset(); }));
  $("[data-q-play]").addEventListener("click", () => { touched = true; play(); });
  $("[data-qp-run]").addEventListener("click", () => status(sel) === "ready" && !playing && complete(sel));
  $("[data-qp-hint]").addEventListener("click", () => { const h = $("[data-qp-hintbox]"); h.hidden = !h.hidden; });

  // cualquier interacción propia detiene la reproducción y cede el control
  root.addEventListener("pointerdown", (e) => {
    if (e.target.closest("[data-q-play]")) return;
    touched = true;
    if (playing) { playing = false; syncPlay(); render(); }
  }, true);

  // el foco sigue al cursor sobre el tablero
  board.addEventListener("pointermove", (e) => {
    const r = board.getBoundingClientRect();
    board.style.setProperty("--mx", `${e.clientX - r.left}px`);
    board.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });

  mq.addEventListener("change", layout);

  // al verse el tablero por primera vez, se reproduce solo; fuera de pantalla se pausan las animaciones
  new IntersectionObserver(([e]) => {
    root.classList.toggle("off", !e.isIntersecting);
    if (e.isIntersecting && !touched && !started && !reduce) { started = true; play(); }
  }, { threshold: 0.55 }).observe(root);
  let started = false;

  layout();
  log(S.repoReady(slug));
}
