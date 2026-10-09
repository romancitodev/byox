import { defineConfig } from "astro/config";

// La web es estática: el MCP sirve dist/ y responde la API en /api.
// En `npm run dev`, Vite le pasa /api al MCP que corre en Docker.
// Dirección pública del sitio: hace falta para las URL absolutas de las vistas previas (og:image) y hreflang.
// PUBLIC_SITE_URL manda; en Vercel se toma la del proyecto; si no, la de producción actual.
const site =
  process.env.PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://byox-theta.vercel.app");

export default defineConfig({
  site,
  output: "static",
  // La documentación (src/docs/*.md): código resaltado, siempre oscuro como el resto del sitio.
  markdown: { shikiConfig: { theme: "github-dark-dimmed", wrap: false } },
  vite: {
    server: {
      proxy: { "/api": process.env.BYOX_API ?? "http://localhost:3333" },
    },
    plugins: [
      {
        // Igual que el MCP: las rutas del router del cliente devuelven la página de la app.
        name: "byox-spa-fallback",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (/^\/app\/./.test(req.url ?? "")) req.url = "/app";
            next();
          });
        },
      },
    ],
  },
});
