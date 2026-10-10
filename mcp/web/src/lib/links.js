// A dónde apunta "Empezar": la app de esta misma instancia (/app), una nube (PUBLIC_APP_URL) o,
// si la landing está publicada sola (p. ej. en Vercel) y no hay nube, la guía para instalarlo (/docs).
const cloud = import.meta.env.PUBLIC_APP_URL;
const landingOnly = import.meta.env.PUBLIC_LANDING_ONLY === "1";

export const appHref = cloud ? `${cloud.replace(/\/$/, "")}/app` : landingOnly ? "/docs" : "/app";
export const startHref = cloud ? `${cloud.replace(/\/$/, "")}/app/cursos` : landingOnly ? "/docs" : "/app/cursos";
export const hasApp = !landingOnly || !!cloud;

// El repositorio: público, así que el enlace sale siempre. PUBLIC_GITHUB_URL permite apuntar a un fork.
export const githubUrl = import.meta.env.PUBLIC_GITHUB_URL || "https://github.com/romancitodev/byox";

// Etiquetas por idioma. Sin app propia (solo landing) el botón lleva a la guía de instalación.
const installOnly = landingOnly && !cloud;
const labels = {
  es: { start: installOnly ? "Instalar byox" : "Empezar un curso", nav: installOnly ? "Instalar" : "Empezar gratis" },
  en: { start: installOnly ? "Install byox" : "Start a course", nav: installOnly ? "Install" : "Start for free" },
};
export const startLabelFor = (lang = "es") => (labels[lang] ?? labels.es).start;
export const navLabelFor = (lang = "es") => (labels[lang] ?? labels.es).nav;
// Compatibilidad: las etiquetas en español, que es el idioma principal.
export const startLabel = labels.es.start;
export const navLabel = labels.es.nav;
