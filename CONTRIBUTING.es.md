# Cómo contribuir a byox

[English](CONTRIBUTING.md) | **Español**

Gracias por querer sumar. byox acepta código, cursos nuevos, documentación y reportes de
errores. Antes de empezar con algo grande, abrí un issue para charlarlo: evita trabajo
duplicado y te dice rápido si la idea encaja.

Participar implica respetar el [código de conducta](CODE_OF_CONDUCT.md). Si encontraste una
vulnerabilidad, **no abras un issue**: seguí [SECURITY.es.md](SECURITY.es.md).

## Qué hay en el repo

| Carpeta | Qué es |
|---|---|
| `mcp/` | Servidor (TypeScript, Node 22): API, MCP, estado y verificación de cursos. Tests en `mcp/test/` |
| `mcp/web/` | Landing, documentación (`src/docs/*.md`) y app web, en Astro |
| `mcp/assets/` | Lo que byox copia a los repos de los alumnos (workflows, `byox.mjs`, plantillas, `guide.md`) |
| `cli/` | El comando `byox`, en Rust |
| `courses/`, `examples/` | Cursos incluidos |
| `deploy/k8s-sim/` | Simulación de dos VPS en Kubernetes (kind), en Bash. Tests en `deploy/k8s-sim/test*.sh` |

## Entorno de desarrollo

Lo único imprescindible es Docker con Compose, Git y `bash` (en Windows, Git Bash o WSL).
No hace falta tener Node en tu máquina: el servidor y la web se compilan y se prueban en
contenedores.

```bash
git clone https://github.com/romancitodev/byox.git
cd byox
bash setup.sh                      # primera vez: crea usuario, bot, org y runner
docker compose up -d --build mcp   # después de cambiar el servidor o la web
```

La app queda en http://localhost:3333/app (usuario y contraseña en `.env`, que nunca se
sube: está en `.gitignore`).

### La web con recarga en vivo

Con el MCP corriendo en Docker y Node 22 instalado:

```bash
cd mcp/web && npm install && npm run dev
```

Queda en http://localhost:4321 y le pasa `/api` al MCP en `:3333` (otro destino con `BYOX_API`).
No toques `mcp/web/src/legacy/`.

### El CLI

Necesitás Rust 1.85 o más nuevo (usa la edición 2024):

```bash
cd cli
cargo build
cargo run -- --help
```

También podés compilarlo sin instalar nada en el host:

```bash
docker run --rm -v "$PWD/cli:/src:ro" -v byox-cargo-target:/target -e CARGO_TARGET_DIR=/target \
  -w /src rust:1-bookworm cargo build --locked
```

## Correr los tests

Estos son los mismos comandos que corre el CI (`.github/workflows/ci.yml`).

**Servidor MCP** (compila con `tsc` y corre los tests de `mcp/test/`):

```bash
docker build --target build -t byox-mcp:build ./mcp
docker run --rm -v "$PWD/mcp/test:/app/test:ro" byox-mcp:build node --test "test/*.test.mjs"
```

En Windows con Git Bash, prefijá los comandos con `MSYS_NO_PATHCONV=1` y usá `$(pwd -W)` en lugar de `$PWD`
dentro de los `-v`.

**Web** (comprueba que compila):

```bash
docker build --target web -t byox-mcp:web ./mcp
```

**Simulación de Kubernetes** (opcional, necesita `kind` y `kubectl`, y tarda): `deploy/k8s-sim/sim.sh up` y `sim.sh test`.

Si tocás el servidor y agregás comportamiento, sumá un test en `mcp/test/` (usan `node:test`, sin
dependencias). Los cambios en la web y el CLI no tienen tests automáticos todavía: probalos a mano y
contá en el PR qué comprobaste.

## Formato de los commits

Gitmoji + conventional commits, en inglés:

```
<type>(<scope>): <emoji> <description>
```

- `type`: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci`, `build`, etc.
- `scope` (opcional): `mcp`, `web`, `cli`, `deploy`, `courses`, `docs`, etc.
- `emoji`: de [gitmoji.org](https://gitmoji.org) (✨ funcionalidad, 🐛 corrección, 📝 documentación, 🔧 configuración, 💄 estilos, ⚡ rendimiento, ✅ tests).
- La descripción va en minúsculas, en imperativo y sin punto final. No hay nada más en la primera línea.

Ejemplos reales del historial:

```
feat(mcp): ✨ pluggable state store, usage metering and a Docker pool
fix(deploy): 🐛 mark shell scripts as executable
fix(web): 💄 stop the account tokens panel from overflowing
```

Commits chicos, cada uno con un solo propósito. Si agregás un script `.sh`, que quede ejecutable en Git
(`git update-index --chmod=+x ruta/al/script.sh`).

## Pull requests

1. Hacé un fork y una rama desde `main`.
2. Corré los tests que correspondan (arriba).
3. Abrí el PR con la plantilla: qué cambia, por qué y cómo lo probaste.
4. Si cambia algo visible (comandos, variables, comportamiento), actualizá la documentación en
   `mcp/web/src/docs/` y el README. La documentación tiene que decir la verdad: no describas lo que todavía no existe.

## Proponer un curso nuevo

Un curso es un proyecto real dividido en etapas, cada una con su test. Hay dos caminos.

**1. Abrir un issue de «propuesta de curso»** con el tema, el lenguaje, para quién es, una lista tentativa de
etapas y las fuentes que vas a usar. Sirve para ver si ya hay alguien trabajando en algo parecido.

**2. Escribirlo.** El formato lo define la guía de formato de byox (`mcp/assets/guide.md`), la misma que
usa el asistente:

- con el CLI: `byox guide`;
- con un asistente conectado al MCP: la herramienta `get_format_guide`;
- en la documentación: [Crear y compartir cursos](mcp/web/src/docs/cursos.md).

El flujo a mano:

```bash
byox new build-your-own-grep --lang rust    # plantilla que ya pasa la verificación
# editá course.yaml, issues/, files/ (lo que recibe el alumno) y solution/
git push
byox check                                  # formato + esqueleto falla + solución pasa, etapa por etapa
```

También podés subir una carpeta a una instancia en marcha y verificarla:

```bash
docker run --rm --network byox -e BYOX_TOKEN=byox_… -v "$PWD:/w" -w /w node:22-bookworm-slim \
  node scripts/push-course.mjs courses/mi-curso --verify
```

Requisitos para que un curso entre en `courses/`:

- **Verificado.** Con solo `files/`, todos los tests fallan; con `files/` más `solution/`, todos pasan.
  La solución es completa y se corrió de verdad.
- **Fuentes reales.** Los contratos, los mensajes y los números salen de la documentación oficial, la
  especificación o de correr la implementación real, y cada etapa cierra con «Para leer».
- **Material propio.** No se copian tests, enunciados ni texto de cursos de pago, libros u otros
  proyectos con copyright o sin licencia clara. Se pueden citar como lectura, con su enlace.
- **Créditos.** La portada tiene una sección «Créditos» con las fuentes.
- **Licencia.** Los cursos de este repositorio son [CC BY-SA 4.0](courses/LICENSE): al enviarlo aceptás
  publicarlo bajo esa licencia.

## Documentación

La documentación oficial está en `mcp/web/src/docs/*.md` (licencia CC BY 4.0) y el orden del menú en
`mcp/web/src/lib/docs-nav.js`. Los README (`README.md` en inglés y `README.es.md` en español) son la portada: mantenelos en sintonía, cortos y con enlaces a la documentación.
Escribimos en español rioplatense, con un tono llano y sin marketing.

## Licencias de lo que aportás

Al enviar una contribución aceptás que se publique con la licencia de la parte del repositorio donde
cae: AGPL-3.0-or-later para el código, MIT para `mcp/assets/`, CC BY-SA 4.0 para los cursos y CC BY 4.0
para la documentación (ver la sección «Licencias» del [README](README.es.md)).
