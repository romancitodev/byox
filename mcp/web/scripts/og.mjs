// Genera las imágenes de vista previa (Open Graph) de byox: 1200x630, en public/og/.
// No es una dependencia del proyecto: se instalan solo para regenerarlas y se ejecuta a mano.
//   npm i --no-save satori @resvg/resvg-js @fontsource/inter @fontsource/jetbrains-mono
//   node scripts/og.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const font = (pkg, file) => readFileSync(new URL(`../node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url));
const fonts = [
  { name: "Inter", data: font("inter", "inter-latin-500-normal.woff"), weight: 500, style: "normal" },
  { name: "Inter", data: font("inter", "inter-latin-700-normal.woff"), weight: 700, style: "normal" },
  { name: "Inter", data: font("inter", "inter-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "JetBrains Mono", data: font("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff"), weight: 500, style: "normal" },
];

const EMBER = "#f9732f";
const INK = "#f0f0f2";
const INK2 = "#b0b0b8";
const INK3 = "#8c8c96";
const LINE = "#2a2a30";
const DONE = "#3fb950";

const h = (type, style, children, props = {}) => ({ type, props: { style, children, ...props } });
const svg = (viewBox, w, hgt, children, style = {}) => ({ type: "svg", props: { viewBox, width: w, height: hgt, style, xmlns: "http://www.w3.org/2000/svg", children } });
const el = (type, props) => ({ type, props });

// El logo: dos etapas que se juntan y desbloquean una tercera.
const logo = (size) =>
  svg("0 0 24 24", size, size, [
    el("path", { d: "M6.6 6.4C11 6.4 11.5 12 14.2 12M6.6 17.6C11 17.6 11.5 12 14.2 12", fill: "none", stroke: INK, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.6 }),
    el("circle", { cx: 4.6, cy: 6.4, r: 2.6, fill: INK }),
    el("circle", { cx: 4.6, cy: 17.6, r: 2.6, fill: INK }),
    el("circle", { cx: 18, cy: 12, r: 4.4, fill: EMBER }),
  ]);

// Un grafo de etapas: dos terminadas, una en curso y dos bloqueadas.
function graph(w = 500, hgt = 320) {
  const nodes = {
    a: [70, 80, "done"],
    b: [70, 240, "done"],
    c: [250, 160, "cur"],
    d: [430, 80, "lock"],
    e: [430, 240, "lock"],
  };
  const edges = [["a", "c"], ["b", "c"], ["c", "d"], ["c", "e"]];
  const path = ([x1, y1], [x2, y2]) => `M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
  const kids = [];
  for (const [f, t] of edges) {
    const live = nodes[f][2] === "done" || (f === "c" && false);
    kids.push(el("path", { d: path(nodes[f], nodes[t]), fill: "none", stroke: nodes[f][2] === "done" ? DONE : LINE, "stroke-width": 3, "stroke-linecap": "round", "stroke-dasharray": nodes[t][2] === "lock" ? "2 9" : "0" }));
  }
  for (const [k, [x, y, s]] of Object.entries(nodes)) {
    if (s === "done") {
      kids.push(el("circle", { cx: x, cy: y, r: 26, fill: DONE }));
      kids.push(el("path", { d: `M${x - 10} ${y + 1} l7 8 l14 -17`, fill: "none", stroke: "#06210d", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    } else if (s === "cur") {
      kids.push(el("circle", { cx: x, cy: y, r: 50, fill: "none", stroke: EMBER, "stroke-opacity": 0.25, "stroke-width": 2 }));
      kids.push(el("circle", { cx: x, cy: y, r: 36, fill: "#1a0f08", stroke: EMBER, "stroke-width": 4 }));
      kids.push(el("circle", { cx: x, cy: y, r: 13, fill: EMBER }));
    } else {
      kids.push(el("circle", { cx: x, cy: y, r: 24, fill: "#121214", stroke: "#44444d", "stroke-width": 3 }));
    }
  }
  return svg("0 0 500 320", w, hgt, kids);
}

function card({ eyebrow, lines, sub, tags, size = 92 }) {
  return h(
    "div",
    {
      width: 1200,
      height: 630,
      display: "flex",
      position: "relative",
      backgroundColor: "#09090b",
      backgroundImage: `radial-gradient(circle at 12% 0%, rgba(249,115,47,0.28) 0%, rgba(249,115,47,0) 46%), radial-gradient(circle at 100% 100%, rgba(249,115,47,0.10) 0%, rgba(249,115,47,0) 40%)`,
      fontFamily: "Inter",
      color: INK,
    },
    [
      // rejilla de puntos
      h("div", { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.4px, transparent 1.6px)", backgroundSize: "26px 26px" }, ""),
      // columna de texto
      h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "58px 0 56px 72px", width: 700, height: 516 }, [
        h("div", { display: "flex", alignItems: "center", gap: 16 }, [
          logo(46),
          h("div", { fontSize: 38, fontWeight: 800, letterSpacing: -1 }, "byox"),
        ]),
        h("div", { display: "flex", flexDirection: "column" }, [
          h("div", { fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 500, letterSpacing: 3, color: EMBER, textTransform: "uppercase", marginBottom: 22 }, eyebrow),
          ...lines.map((line) =>
            h("div", { display: "flex", fontSize: size, fontWeight: 800, lineHeight: 1.04, letterSpacing: -3.5 }, line.map((part) => h("span", { color: part.hot ? EMBER : INK, whiteSpace: "pre" }, part.t))),
          ),
          h("div", { fontSize: 29, fontWeight: 500, color: INK2, marginTop: 26, lineHeight: 1.35, maxWidth: 640 }, sub),
        ]),
        h("div", { display: "flex", gap: 12 }, tags.map((t) => h("div", { fontFamily: "JetBrains Mono", fontSize: 19, fontWeight: 500, color: INK3, padding: "8px 14px", border: `1.5px solid ${LINE}`, borderRadius: 8, backgroundColor: "rgba(18,18,20,0.7)" }, t))),
      ]),
      // ilustración
      h("div", { position: "absolute", right: 28, top: 214, display: "flex" }, graph(400, 256)),
    ],
  );
}

const T = (t, hot = false) => ({ t, hot });
const specs = {
  "og-es": {
    eyebrow: "Build your own X",
    lines: [[T("Construye tu")], [T("propio "), T("X", true)]],
    sub: "Proyectos reales con tests que te dicen en segundos si funciona. En tu propia máquina.",
    tags: ["Self-hosted", "Forgejo", "Docker"],
  },
  "og-en": {
    eyebrow: "Build your own X",
    lines: [[T("Build your")], [T("own "), T("X", true)]],
    sub: "Real projects with tests that tell you in seconds if it works. On your own machine.",
    tags: ["Self-hosted", "Forgejo", "Docker"],
  },
  "og-docs": {
    eyebrow: "Guías y referencia",
    lines: [[T("Documentación")], [T("de "), T("byox", true)]],
    size: 84,
    sub: "Instala, configura y opera byox en tu propio servidor.",
    tags: ["Self-hosting", "MCP", "API"],
  },
};

const out = new URL("../public/og/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, spec] of Object.entries(specs)) {
  const svgText = await satori(card(spec), { width: 1200, height: 630, fonts });
  const png = new Resvg(svgText, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  writeFileSync(new URL(`${name}.png`, out), png);
  console.log(name, `${Math.round(png.length / 1024)} KB`);
}
