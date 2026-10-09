// i18n de la app: el español es el original y hace de clave; el inglés vive en i18n-en.js.
// Un texto sin traducción se queda en español (degradación elegante).
import { EN } from "./i18n-en.js";

const KEY = "byox-lang";
const detect = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {}
  return /^en\b/i.test(navigator.language ?? "") ? "en" : "es";
};

/** Idioma activo ("es" | "en"). Es un binding vivo: cambia con setLang(). */
export let LANG = detect();
/** Código para Intl y toLocale*String. */
export let locale = LANG;
document.documentElement.lang = LANG;

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);

/** t("Hola, {name}", { name }): el texto en español es la clave; `{x}` se interpola. */
export function t(es, vars) {
  return fill(LANG === "en" ? EN[es] ?? es : es, vars);
}

/** Cambia el idioma, lo recuerda y avisa a la app para que repinte la vista actual. */
export function setLang(l) {
  LANG = l === "en" ? "en" : "es";
  locale = LANG;
  document.documentElement.lang = LANG;
  try { localStorage.setItem(KEY, LANG); } catch {}
  document.dispatchEvent(new CustomEvent("byox-lang", { detail: LANG }));
}
