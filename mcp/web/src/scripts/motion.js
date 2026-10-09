// Movimiento de /app con GSAP. Corto, con intención y sin bloquear: nada espera a una animación.
// Se anima al entrar a una vista, al abrir un diálogo y al cambiar de pestaña; los repintados por
// sondeo (CI, progreso) no pasan por aquí, así que no parpadean. Con prefers-reduced-motion no hace nada.
import { gsap } from "gsap";

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const on = () => !reduce.matches;
const EASE = "power3.out";
const CAP = 16; // más allá de lo visible se anima al hacer scroll, no de golpe

gsap.defaults({ ease: EASE, overwrite: "auto" });

const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight;
};
const clear = (els) => gsap.set(els, { clearProps: "opacity,transform,visibility" });

/** Entrada escalonada de un grupo; lo que cae fuera de pantalla aparece al llegar. */
function stagger(els, vars = {}) {
  els = [...els];
  if (!els.length) return;
  const { y = 10, each = 0.045, duration = 0.42, delay = 0, lazy = true, ...rest } = vars;
  const now = els.filter(inView).slice(0, CAP);
  const later = els.filter((e) => !now.includes(e));
  gsap.fromTo(now, { opacity: 0, y }, { opacity: 1, y: 0, duration, delay, stagger: each, onComplete: () => clear(now), ...rest });
  if (!later.length || !lazy) return;
  gsap.set(later, { opacity: 0, y });
  const io = new IntersectionObserver((hits) => {
    for (const h of hits) {
      if (!h.isIntersecting) continue;
      io.unobserve(h.target);
      gsap.to(h.target, { opacity: 1, y: 0, duration, onComplete: () => clear(h.target) });
    }
  }, { rootMargin: "0px 0px -6% 0px" });
  later.forEach((e) => io.observe(e));
}

/** Barras segmentadas: los tramos se llenan de izquierda a derecha. */
function bars(root) {
  const segs = [...root.querySelectorAll(".segs:not(.grouped) i, .segs.grouped u")].filter(inView).slice(0, 80);
  if (!segs.length) return;
  gsap.fromTo(segs, { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.5, stagger: { amount: 0.4 }, delay: 0.12, clearProps: "transform" });
}

let first = true;

/** Vista nueva (Inicio, Cursos, Actividad, Cuenta, curso…). */
export function page() {
  if (!on()) return;
  const root = document.getElementById("content");
  if (!root) return;
  const course = root.querySelector(".course");
  if (course) {
    stagger(course.querySelectorAll(".stages .stage"), { y: 0, x: -8, each: 0.016, duration: 0.3, lazy: false });
    stagger(course.querySelectorAll(".aside > section"), { y: 0, x: 10, each: 0.07, delay: 0.1 });
    article();
    bars(course);
  } else {
    gsap.fromTo(root.querySelectorAll(".phead"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.38, clearProps: "opacity,transform" });
    gsap.fromTo(root.querySelectorAll(".resume"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.08, clearProps: "opacity,transform" });
    stagger(root.querySelectorAll(".ccard, .card, .ms-group, .hm-recent, .acct > *"), { delay: 0.1 });
    stagger(root.querySelectorAll(".hm-row, .feed li"), { y: 6, each: 0.025, duration: 0.32, delay: 0.16, lazy: false });
    bars(root);
  }
  if (first) {
    first = false;
    stagger(document.querySelectorAll(".side .nav-item, .side .search"), { y: 0, x: -8, each: 0.035, duration: 0.35 });
  }
}

/** Etapa nueva dentro del mismo curso: sólo el artículo y su lista de pistas/salida. */
export function article() {
  if (!on()) return;
  const art = document.querySelector("#main .article");
  if (!art) return;
  gsap.fromTo(art, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, clearProps: "opacity,transform" });
  const main = document.getElementById("main");
  if (main) main.scrollTop = 0;
}

/** Cambio de pestaña o de comando dentro de una etapa. */
export function swap() {
  if (!on()) return;
  const parts = document.querySelectorAll("#main .article > :not(.cover-tabs):not(.phead)");
  stagger(parts, { y: 6, each: 0.03, duration: 0.28 });
}

/** Plegar o desplegar un tramo de la lista de etapas. `commit` cambia el estado y repinta la lista. */
let folding = false;
export function fold(row, id, folds, commit) {
  const group = (li) => {
    const out = [];
    for (let n = li.nextElementSibling; n && !n.querySelector(":scope > .ms-row"); n = n.nextElementSibling) out.push(n);
    return out;
  };
  const items = group(row.closest("li"));
  if (!on() || folding || (folds && !items.length)) return commit();
  const chevron = (r) => r.querySelector(":scope > svg");
  folding = true;
  const done = () => { folding = false; };
  if (folds) {
    gsap.to(chevron(row), { rotation: 0, duration: 0.2 });
    gsap.to(items, { height: 0, opacity: 0, overflow: "hidden", duration: 0.22, ease: "power2.inOut", stagger: { amount: 0.1, from: "end" }, onComplete: () => { commit(); done(); } });
  } else {
    commit();
    const r = document.querySelector(`[data-fold="${CSS.escape(id)}"]`);
    if (!r) return done();
    gsap.fromTo(chevron(r), { rotation: 0 }, { rotation: 90, duration: 0.22, clearProps: "transform" });
    gsap.from(group(r.closest("li")), { height: 0, opacity: 0, overflow: "hidden", duration: 0.3, stagger: { amount: 0.18 }, clearProps: "height,opacity,overflow", onComplete: done });
  }
}

/** Barra lateral: el ancho se interpola y las etiquetas se desvanecen, en lugar de aparecer de golpe. */
export function slim(shell, willSlim, apply) {
  if (!on() || matchMedia("(max-width: 760px)").matches) return apply();
  const labels = [...shell.querySelectorAll(".side .hide-slim")];
  const cols = (w) => `${w}px minmax(0, 1fr)`;
  gsap.killTweensOf([shell, ...labels]);
  if (willSlim) {
    gsap.to(labels, { opacity: 0, duration: 0.12 });
    gsap.fromTo(shell, { gridTemplateColumns: cols(236) }, { gridTemplateColumns: cols(52), duration: 0.26, ease: "power3.inOut", onComplete: () => { apply(); gsap.set(labels, { clearProps: "opacity" }); gsap.set(shell, { clearProps: "gridTemplateColumns" }); } });
  } else {
    apply();
    gsap.set(shell, { gridTemplateColumns: cols(52) });
    gsap.to(shell, { gridTemplateColumns: cols(236), duration: 0.28, ease: "power3.inOut", clearProps: "gridTemplateColumns" });
    gsap.fromTo(shell.querySelectorAll(".side .hide-slim"), { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.25, delay: 0.1, stagger: 0.012, clearProps: "opacity,transform" });
  }
}

/** Lista que se repinta por un filtro: las filas entran de nuevo, rápido. */
export function list(host) {
  if (!on() || !host) return;
  stagger(host.querySelectorAll(".hm-row, .ms-group, .empty"), { y: 6, each: 0.02, duration: 0.26, lazy: false });
}

/** Confirmación táctil (copiar, guardar…). */
export function pop(el) {
  if (el && on()) gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: "back.out(3)", clearProps: "transform" });
}

/** <details>: el contenido se despliega y se recoge con altura, no de golpe. */
function details() {
  const body = (d) => [...d.children].filter((c) => c.tagName !== "SUMMARY");
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || !on()) return;
    gsap.from(body(d), { height: 0, opacity: 0, overflow: "hidden", duration: 0.28, clearProps: "height,opacity,overflow" });
  }, true);
  document.addEventListener("click", (e) => {
    const sum = e.target.closest?.("details > summary");
    const d = sum?.parentElement;
    if (!d?.open || !on() || d._closing) return;
    e.preventDefault();
    d._closing = true;
    gsap.to(body(d), { height: 0, opacity: 0, overflow: "hidden", duration: 0.2, ease: "power2.inOut", onComplete: () => { d.open = false; d._closing = false; gsap.set(body(d), { clearProps: "height,opacity,overflow" }); } });
  });
}

/** Diálogos, paleta y avisos: entran con un poco de cuerpo. */
function watch() {
  new MutationObserver((list) => {
    if (!on()) return;
    for (const m of list) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches?.(".overlay")) {
          gsap.fromTo(n, { opacity: 0 }, { opacity: 1, duration: 0.18, clearProps: "opacity" });
          const box = n.querySelector(".modal, .palette");
          if (box) gsap.fromTo(box, { opacity: 0, y: 14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: "back.out(1.5)", clearProps: "opacity,transform" });
        } else if (n.matches?.(".toast")) {
          gsap.fromTo(n, { opacity: 0, y: 16, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(1.6)", clearProps: "opacity,transform" });
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/** Presión en los botones: respuesta táctil sin tocar el CSS de cada uno. */
function press() {
  const sel = ".btn, .q-btn, .chip, .icon-btn";
  const to = (e, s) => {
    const b = e.target.closest?.(sel);
    if (b && !b.disabled && on()) gsap.to(b, { scale: s, duration: s < 1 ? 0.1 : 0.35, ease: s < 1 ? "power2.out" : "back.out(3)", overwrite: "auto", clearProps: s === 1 ? "transform" : "" });
  };
  document.addEventListener("pointerdown", (e) => to(e, 0.96));
  for (const ev of ["pointerup", "pointercancel", "pointerout"]) document.addEventListener(ev, (e) => to(e, 1));
}

watch();
press();
details();
