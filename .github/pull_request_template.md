## Qué cambia

<!-- Una o dos frases. -->

## Por qué

<!-- El problema o el issue que resuelve (Cierra #...). -->

## Cómo lo probé

<!-- Marcá lo que corresponda y contá qué comprobaste a mano. -->

- [ ] Tests del servidor: `docker build --target build -t byox-mcp:build ./mcp` y `docker run --rm -v "$PWD/mcp/test:/app/test:ro" byox-mcp:build node --test "test/*.test.mjs"`
- [ ] Scripts de la VPS: `docker run --rm -v "$PWD:/w" -w /w node:22-bookworm bash deploy/vps/test.sh`
- [ ] Web: `docker build --target web -t byox-mcp:web ./mcp`
- [ ] CLI: `cargo build --locked` en `cli/`
- [ ] Probado a mano (qué):

## Lista de control

- [ ] Los commits siguen `<type>(<scope>): <emoji> <description>`, en inglés.
- [ ] Actualicé la documentación (`mcp/web/src/docs/`, README) si cambia el comportamiento.
- [ ] No incluye secretos, `.env` ni datos personales.
- [ ] Si es un curso: el esqueleto falla y la solución pasa (`byox check`), cita sus fuentes y no copia material con copyright.
