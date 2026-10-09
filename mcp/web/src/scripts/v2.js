// Landing v2: palabra rotativa, focos que siguen al cursor, contadores, leyes de UX y copiar comando.
import { uiFor } from "../lib/landing-strings.js";
const S = uiFor(document.documentElement.lang); // textos según <html lang>
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Revelado escalonado dentro de cada grupo de hermanos.
document.querySelectorAll(".v2-steps, .v2-bento, .v2-aud, .v2-vs").forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty("--i", i)));

// --- palabra rotativa que se escribe y se borra
const rot = document.querySelector("[data-rotate]");
if (rot && !reduce) {
  const words = JSON.parse(rot.dataset.words);
  const el = rot.querySelector(".v2-word");
  (async () => {
    let k = 0;
    for (;;) {
      await wait(1900);
      for (let n = el.textContent.length; n >= 0; n--) { el.textContent = words[k].slice(0, n); await wait(32); }
      k = (k + 1) % words.length;
      for (let n = 1; n <= words[k].length; n++) { el.textContent = words[k].slice(0, n); await wait(55); }
    }
  })();
}

// --- foco: variables --mx/--my relativas a cada tarjeta
if (!reduce) {
  addEventListener("pointermove", (e) => {
    const t = e.target.closest?.("[data-spot]");
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${e.clientX - r.left}px`);
    t.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });
}


// --- copiar comando
document.querySelectorAll("[data-copy]").forEach((el) => {
  const label = el.querySelector("span");
  const copy = async () => {
    try { await navigator.clipboard.writeText(el.dataset.copy); } catch { return; }
    el.classList.add("ok"); label.textContent = S.copy.copied;
    setTimeout(() => { el.classList.remove("ok"); label.textContent = S.copy.copy; }, 1600);
  };
  el.addEventListener("click", copy);
  el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), copy()));
});


// --- scroll: todo se calcula en un único rAF
const clamp = (v) => Math.max(0, Math.min(1, v));
const stage = document.querySelector(".v2-stage");
const story = document.querySelector("[data-story]");
const bar = document.querySelector("[data-progress]");
const hero = document.querySelector(".v2-hero");

// títulos: cada palabra se ilumina según el avance del título por la pantalla
const heads = [...document.querySelectorAll(".v2-head h2")].map((h) => {
  const words = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t.trim()) { frag.append(t); return; }
          const w = document.createElement("span");
          w.className = "w"; w.textContent = t; words.push(w); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(h);
  return { h, words };
});

let ticking = false;
function frame() {
  ticking = false;
  const vh = innerHeight;
  const max = document.documentElement.scrollHeight - vh;
  bar?.style.setProperty("--pg", max > 0 ? clamp(scrollY / max).toFixed(4) : 0);
  hero?.style.setProperty("--sy", scrollY);
  if (stage) stage.style.setProperty("--sp", clamp((vh - stage.getBoundingClientRect().top) / (vh * 0.85)).toFixed(3));
  if (story && !matchMedia("(max-width: 880px)").matches) {
    const r = story.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - vh * 0.85) + 0.05);
    story.style.setProperty("--sp", p.toFixed(3));
    story.dataset.active = Math.min(2, Math.floor(p * 3));
  }
  for (const { h, words } of heads) {
    const t = h.getBoundingClientRect().top;
    const p = clamp((vh * 0.92 - t) / (vh * 0.4));
    words.forEach((w, i) => w.style.setProperty("--wo", i / words.length < p ? 1 : 0.22));
  }
}
if (!reduce) {
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener("resize", frame);
  frame();
} else {
  stage?.style.setProperty("--sp", 1);
}


// --- lista de espera: POST JSON al endpoint configurado en PUBLIC_WAITLIST_URL
const wl = document.querySelector("[data-waitlist]");
if (wl) {
  const state = wl.querySelector(".state");
  const btn = wl.querySelector("button");
  wl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(wl));
    if (data.web) return; // trampa para bots
    if (!/^\S+@\S+\.\S+$/.test(data.email ?? "") || !data.perfil) {
      state.className = "state err"; state.textContent = S.wait.invalid;
      return;
    }
    btn.disabled = true; state.className = "state"; state.textContent = S.wait.sending;
    try {
      const res = await fetch(wl.dataset.waitlist, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.email, perfil: data.perfil }) });
      if (!res.ok) throw new Error(String(res.status));
      wl.reset(); state.className = "state ok"; state.textContent = S.wait.ok;
    } catch {
      state.className = "state err"; state.textContent = S.wait.err;
    } finally { btn.disabled = false; }
  });
}
