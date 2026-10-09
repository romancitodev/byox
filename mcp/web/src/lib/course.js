// Lo que comparten la app y la landing para mostrar un curso.

/** Los cursos se titulan con el slug (build-your-own-redis); en la UI va "Build your own Redis". */
export function courseName(title = "") {
  if (/\s/.test(title) || !title.includes("-")) return title;
  const m = /^build-your-own-(.+)$/.exec(title);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  return m ? `Build your own ${m[1].split("-").map(cap).join(" ")}` : cap(title.split("-").join(" "));
}

// Colores de GitHub Linguist: los mismos que el alumno ya asocia a cada lenguaje.
const LANGS = [
  [/^rust/, "Rust", "#dea584"],
  [/^python/, "Python", "#3572a5"],
  [/^golang|^go:/, "Go", "#00add8"],
  [/^node|^oven\/bun|^denoland/, "JavaScript", "#f1e05a"],
  [/^gcc|^alpine.*gcc/, "C", "#555555"],
  [/^eclipse-temurin|^openjdk|^maven|^gradle/, "Java", "#b07219"],
  [/^mcr\.microsoft\.com\/dotnet/, "C#", "#178600"],
  [/^ruby/, "Ruby", "#701516"],
  [/^elixir/, "Elixir", "#6e4a7e"],
  [/^haskell/, "Haskell", "#5e5086"],
  [/^swift/, "Swift", "#f05138"],
  [/^zig/, "Zig", "#ec915c"],
];

/** El lenguaje del curso, sacado de la imagen de Docker donde corren los tests. */
export function language(image = "") {
  const hit = LANGS.find(([re]) => re.test(image));
  return hit ? { name: hit[1], color: hit[2] } : { name: image.split(":")[0] || "—", color: "var(--ink-3)" };
}
