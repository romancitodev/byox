// Un curso inventado para ilustrar la landing. No sale de ningún curso real del usuario.
import { language } from "./course.js";

const image = "golang:1.25";
export const sample = {
  slug: "build-your-own-shell",
  title: "Build your own Shell",
  image,
  lang: language(image),
  milestones: [
    { id: "repl", title: "El REPL" },
    { id: "builtins", title: "Builtins" },
    { id: "exec", title: "Procesos" },
    { id: "pipes", title: "Pipes" },
  ],
  issues: [
    { n: 1, milestone: "repl", title: "Un prompt que lee líneas", deps: [] },
    { n: 2, milestone: "repl", title: "Salir con exit y Ctrl-D", deps: [1] },
    { n: 3, milestone: "builtins", title: "echo y pwd", deps: [1] },
    { n: 4, milestone: "builtins", title: "cd, con ~ y rutas relativas", deps: [3] },
    { n: 5, milestone: "exec", title: "Buscar programas en el PATH", deps: [1] },
    { n: 6, milestone: "exec", title: "Ejecutar con argumentos", deps: [5] },
    { n: 7, milestone: "exec", title: "Comillas simples y dobles", deps: [3, 6] },
    { n: 8, milestone: "pipes", title: "Redirigir la salida con >", deps: [6] },
    { n: 9, milestone: "pipes", title: "Un pipe entre dos procesos", deps: [7] },
    { n: 10, milestone: "pipes", title: "Pipes de N procesos", deps: [8, 9] },
  ].map((i) => ({ ...i, test: `go test ./... -run TestPaso${String(i.n).padStart(2, "0")}` })),
  hint: {
    n: 7,
    of: 3,
    text: "Recorré la línea de a un carácter y llevá un estado: afuera, adentro de comillas simples o adentro de dobles.",
  },
};

// La misma muestra en inglés (/en). Mismos números, dependencias y tramos: solo cambia el texto.
const titlesEn = [
  "A prompt that reads lines",
  "Quit with exit and Ctrl-D",
  "echo and pwd",
  "cd, with ~ and relative paths",
  "Finding programs on the PATH",
  "Running with arguments",
  "Single and double quotes",
  "Redirecting output with >",
  "A pipe between two processes",
  "Pipes of N processes",
];
const milestonesEn = ["The REPL", "Builtins", "Processes", "Pipes"];
export const sampleEn = {
  ...sample,
  milestones: sample.milestones.map((m, k) => ({ ...m, title: milestonesEn[k] })),
  issues: sample.issues.map((i, k) => ({
    ...i,
    title: titlesEn[k],
    test: `go test ./... -run TestStage${String(i.n).padStart(2, "0")}`,
  })),
  hint: {
    n: 7,
    of: 3,
    text: "Walk the line one character at a time and keep a state: outside quotes, inside single quotes or inside double quotes.",
  },
};

/** La muestra según el idioma de la página. */
export const getSample = (lang) => (lang === "en" ? sampleEn : sample);

/**
 * La escena del demo: una etapa a mitad de curso cuyas dependencias ya están cerradas,
 * y lo que se abre al cerrarla. Se calcula con los deps, no está escrita a mano.
 */
export function demoScene(course) {
  const byN = new Map(course.issues.map((i) => [i.n, i]));
  const cur = course.issues.find((i) => i.deps.length > 1) ?? course.issues[Math.floor(course.issues.length / 2)];
  const done = new Set();
  const close = (n) => {
    if (done.has(n)) return;
    for (const d of byN.get(n)?.deps ?? []) close(d);
    done.add(n);
  };
  for (const i of course.issues) if (i.n < cur.n) close(i.n);
  for (const d of cur.deps) close(d);
  const ready = (i, closed) => !closed.has(i.n) && i.deps.every((d) => closed.has(d));
  const after = new Set([...done, cur.n]);
  const opens = course.issues.filter((i) => !ready(i, done) && ready(i, after));
  const state = (i, closed) => (closed.has(i.n) ? "done" : ready(i, closed) ? "ready" : "locked");
  return {
    cur,
    opens,
    before: Object.fromEntries(course.issues.map((i) => [i.n, state(i, done)])),
    after: Object.fromEntries(course.issues.map((i) => [i.n, state(i, after)])),
  };
}
