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
