// Índice de búsqueda de la documentación: título, secciones y texto plano de cada página.
import { flat, href } from "../../lib/docs-nav.js";

const raw = import.meta.glob("../../docs/*.md", { eager: true, query: "?raw", import: "default" });

/** Markdown -> texto plano, lo justo para buscar y mostrar un fragmento. */
function plain(md) {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/```[\w-]*\n([\s\S]*?)```/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>|]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Igual que los ids que genera Astro (github-slugger): minúsculas, sin puntuación, espacios a guiones y tildes conservadas.
const slugify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");

export function GET() {
  const pages = flat.map((p) => {
    const md = (raw[`../../docs/${p.slug}.md`] ?? "").replace(/\r\n/g, "\n");
    const sections = [...md.replace(/```[\s\S]*?```/g, "").matchAll(/^##\s+(.+)$/gm)].map((m) => ({ text: m[1].trim(), id: slugify(m[1].trim().replace(/[`*]/g, "")) }));
    return { title: p.title, group: p.group, url: href(p.slug), sections, text: plain(md) };
  });
  return new Response(JSON.stringify(pages), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
