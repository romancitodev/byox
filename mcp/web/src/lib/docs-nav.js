// Estructura de la documentación: grupos y páginas en el orden en que se leen.
// `slug` es el nombre del archivo en src/docs/ ("index" es la portada, /docs).
export const nav = [
  {
    title: "Empezar",
    pages: [
      { slug: "index", title: "Introducción" },
      { slug: "inicio-rapido", title: "Inicio rápido" },
      { slug: "como-funciona", title: "Cómo funciona" },
    ],
  },
  {
    title: "Self-hosting",
    pages: [
      { slug: "instalacion", title: "Instalación" },
      { slug: "configuracion", title: "Configuración" },
      { slug: "cuentas", title: "Cuentas y permisos" },
      { slug: "produccion", title: "Llevarlo a producción" },
      { slug: "seguridad", title: "Seguridad" },
    ],
  },
  {
    title: "Usar byox",
    pages: [
      { slug: "asistente", title: "Asistente (MCP)" },
      { slug: "cli", title: "CLI" },
      { slug: "cursos", title: "Crear y compartir cursos" },
    ],
  },
  {
    title: "Referencia",
    pages: [
      { slug: "api", title: "API HTTP" },
      { slug: "problemas", title: "Solución de problemas" },
    ],
  },
];

export const flat = nav.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.title })));
export const href = (slug) => (slug === "index" ? "/docs" : `/docs/${slug}`);
