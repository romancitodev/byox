// Textos que los scripts de la landing (landing.js, v2.js, quest.js, bento.js) escriben en la página.
// Los scripts leen el idioma de <html lang>; el contenido de la página vive en landing-i18n.js.
// Este módulo es pequeño a propósito: es lo único del diccionario que viaja al navegador.

export const ui = {
  es: {
    and: "y",
    // landing.js: grafo de etapas
    graph: {
      requires: "requiere",
      noReqs: "sin requisitos",
      unlocks: "desbloquea",
    },
    // v2.js
    copy: { copy: "Copiar", copied: "Copiado" },
    wait: {
      invalid: "Revisa el correo y elige cómo lo usarías.",
      sending: "Enviando…",
      ok: "Listo. Te avisaremos cuando esté disponible.",
      err: "No pudimos guardarlo. Inténtalo de nuevo en un rato.",
    },
    // bento.js: terminal del CLI
    bento: {
      test: "go test ./... -run TestPaso07",
      fail: "✕ parser.go:31:5 esperaba [echo, hola mundo]",
      hint: "Pista 2 de 3 · Dentro de comillas dobles…",
      done: "✓ #7 completa · se abre #9",
    },
    // quest.js: tablero interactivo
    quest: {
      state: { done: "Completa", running: "Probando…", ready: "Disponible", locked: "Bloqueada" },
      failed: "Falló",
      stageLabel: (n, title, st) => `Etapa ${n}, ${title}: ${st}`,
      failedRetry: "falló, reintenta",
      needs: (missing) => `Falta ${missing}`,
      noDeps: "Nada: es de las primeras",
      noOpens: "Es la última de su camino",
      retry: "Reintentar git push",
      simulate: "Simular git push",
      stageDone: "Etapa completa",
      runningCi: "Corriendo el CI…",
      completeFirst: (missing) => `Falta completar ${missing}`,
      planLog: "plan · issues abiertos",
      testLog: (test) => `test · ${test}`,
      failLog: (n, where) => `#${n} falló · ${where}`,
      passLog: (n, fresh) => `#${n} pasó${fresh.length ? ` · se abre ${fresh.join(", ")}` : ""}`,
      repoReady: (slug) => `Repositorio <em>${slug}</em> listo`,
      play: "Reproducir",
      stop: "Detener",
    },
  },
  en: {
    and: "and",
    graph: {
      requires: "requires",
      noReqs: "no requirements",
      unlocks: "unlocks",
    },
    copy: { copy: "Copy", copied: "Copied" },
    wait: {
      invalid: "Check your email and pick how you'd use it.",
      sending: "Sending…",
      ok: "Done. We'll let you know when it's available.",
      err: "We couldn't save it. Please try again in a while.",
    },
    bento: {
      test: "go test ./... -run TestStage07",
      fail: "✕ parser.go:31:5 expected [echo, hello world]",
      hint: "Hint 2 of 3 · Inside double quotes…",
      done: "✓ #7 complete · #9 opens",
    },
    quest: {
      state: { done: "Complete", running: "Testing…", ready: "Available", locked: "Locked" },
      failed: "Failed",
      stageLabel: (n, title, st) => `Stage ${n}, ${title}: ${st}`,
      failedRetry: "failed, retry",
      needs: (missing) => `Needs ${missing}`,
      noDeps: "None: it's one of the first",
      noOpens: "Last on its path",
      retry: "Retry git push",
      simulate: "Simulate git push",
      stageDone: "Stage complete",
      runningCi: "Running the CI…",
      completeFirst: (missing) => `Complete ${missing} first`,
      planLog: "plan · open issues",
      testLog: (test) => `test · ${test}`,
      failLog: (n, where) => `#${n} failed · ${where}`,
      passLog: (n, fresh) => `#${n} passed${fresh.length ? ` · ${fresh.join(", ")} ${fresh.length > 1 ? "open" : "opens"}` : ""}`,
      repoReady: (slug) => `Repository <em>${slug}</em> ready`,
      play: "Play",
      stop: "Stop",
    },
  },
};

/** Los textos de los scripts para el idioma de la página (<html lang>). */
export const uiFor = (lang) => (String(lang).toLowerCase().startsWith("en") ? ui.en : ui.es);
