# 🔨 byox

"Build your own X" self-hosted: cursos que son repos de Forgejo. Cada paso es
un issue con un test, los issues forman un grafo, y cada push corre los tests,
cierra lo que pasa y desbloquea lo siguiente. Los cursos los escribe una IA a
través de un MCP, verificados contra una solución real.

## Arrancar

Necesitás Docker y Git Bash (o cualquier `bash`).

```bash
bash setup.sh
```

Crea tu usuario administrador (`BYOX_USER`, por defecto `owner`), el bot `byox`, la
organización `cursos`, registra el runner y levanta todo. La contraseña queda en `.env`.

Todo exige una cuenta: entra a http://localhost:3333/app con ese usuario. Para
sumar personas, `BYOX_SIGNUP=invite` (o `open`) en `.env`. La guía completa de
instalación, HTTPS y variables está en http://localhost:3333/docs
(`mcp/web/src/pages/docs.astro`).

| | |
|---|---|
| **Tus cursos** | http://localhost:3333/app |
| Landing | http://localhost:3333 |
| Documentación | http://localhost:3333/docs |
| Forgejo | http://localhost:3000 |
| MCP | http://localhost:3333/mcp |

## El CLI

`byox` es un ejecutable nativo (Rust) que habla con la misma API que la web.
Adentro del repo de un curso detecta solo de qué curso se trata.

```bash
cargo install --path cli
byox login byox_…   # el token se crea en la app: Cuenta → Tokens (o variable BYOX_TOKEN)
```

| Comando | Qué hace |
|---|---|
| `byox` | Progreso, etapa actual y resultado del último push (con el error y el archivo:línea si falló) |
| `byox test [n]` | Corre los tests en Docker, en la misma imagen que el CI, y al final te dice qué falló y dónde. `--local` usa `sh` y tus herramientas |
| `byox watch` | Después de `git push`: espera al CI y te dice qué se cerró, qué se abrió y qué falló |
| `byox show [n]` | Las instrucciones de la etapa en la terminal |
| `byox hint [n]` | La siguiente pista |
| `byox log [n]` | La salida del test en el CI, con las líneas del error resaltadas |
| `byox open [n]` | Abre la etapa en la web |
| `byox courses` / `byox clone <curso>` | Tus cursos y clonar el repo de uno |
| `byox new <curso> --lang python\|rust\|go\|node` | Un curso escrito a mano, desde una plantilla que ya anda |
| `byox check [curso]` | Cómo quedó el curso que escribís: formato y, por etapa, si el esqueleto falla y la solución pasa |
| `byox start <curso>` | Empieza un curso verificado: crea tu repo con los issues |
| `byox export <curso>` | Copia el código del curso para compartirlo (`-o curso.byox` lo guarda en un archivo) |
| `byox import [código\|archivo]` | Importa un curso; sin argumentos, el código del portapapeles |
| `byox guide` | El formato de un curso |

Sin el CLI, en Windows: `.course\test 7` (también corre en Docker).

## La interfaz

http://localhost:3333/app es donde seguís los cursos, al estilo CodeCrafters:

- Barra lateral con las etapas por milestone: ✓ completada, ⋯ disponible, # bloqueada.
- La portada de cada curso (`/app/c/<curso>`) con el README, el mapa de etapas clickeable y un botón para seguir.
- Instrucciones renderizadas, el comando para verificar local y tus pistas (pedís la siguiente con un botón).
- Arriba, el estado del último push en vivo: corriendo, terminado, link a los logs.
- Cuando un push cierra etapas, festejo con lo que se desbloqueó y un botón a la siguiente.
- A la derecha: tu racha, el progreso y qué depende de qué.
- **Creados** (`/app/creados`): los cursos que escribiste, con el estado de la verificación de cada push
  (el esqueleto tiene que fallar y la solución pasar, etapa por etapa) y el log de lo que falla.
  Desde ahí se crea un curso nuevo a partir de una plantilla o se importa uno.
- **Compartir**: en la portada de un curso, un código `byox1-…` para copiar o un archivo `.byox` para
  descargar. Quien lo recibe lo importa desde Creados, con una vista previa antes de confirmar.

En http://localhost:3333 está la landing, que explica byox con un curso de ejemplo inventado.
Las rutas viejas (`/cursos`, `/actividad`, `/c/...`) redirigen a `/app`.

La web es un proyecto de [Astro](https://astro.build) en `mcp/web/` (landing en
`src/pages/index.astro`, app en `src/pages/app.astro`). El Dockerfile del MCP la
compila y el MCP sirve el resultado. Para trabajar en ella con recarga en vivo,
con el MCP corriendo en Docker:

```bash
cd mcp/web && npm install && npm run dev
```

Queda en http://localhost:4321 y le pasa `/api` al MCP en `:3333` (otro destino con
`BYOX_API`). Para mostrar el link a GitHub en la landing, agregá `PUBLIC_GITHUB_URL`
al `.env` y volvé a levantar con `docker compose up -d --build mcp`.

Conectar Claude Code (el MCP exige un token personal, créalo en Cuenta → Tokens):

```bash
claude mcp add --transport http byox http://localhost:3333/mcp \
  --header "Authorization: Bearer byox_…"
```

## Cuentas y permisos

Las cuentas son usuarios de Forgejo; byox no guarda contraseñas. La web usa una sesión
(cookie `HttpOnly`) y el MCP y el CLI, tokens personales `byox_…` (se guardan hasheados).

| Variable | Valores | Qué hace |
|---|---|---|
| `BYOX_SIGNUP` | `closed` (defecto), `invite`, `open` | Quién puede crear cuenta |
| `BYOX_AUTHORS` | `admin` (defecto), `all` | Quién escribe, verifica e importa cursos (corre código en Docker) |
| `BYOX_PUBLIC_URL`, `BYOX_DOMAIN`, `BYOX_WEB_URL` | URLs | Direcciones públicas cuando no es localhost |
| `BYOX_TRUST_PROXY`, `BYOX_SECURE_COOKIES` | `1` | Detrás de un proxy con HTTPS |

Límite conocido: el bot `byox` es colaborador de todos los repos de alumnos y su token
va como secreto de Actions, así que una instancia compartida no está aislada entre
desconocidos. Úsala con equipos y aulas de confianza.

## En un servidor: Postgres

Por defecto Forgejo usa SQLite y el MCP guarda su estado (sesiones, tokens, invitaciones,
resultados) en archivos JSON de `BYOX_DATA`: no hace falta nada más. Para un servidor,
`docker-compose.cloud.yml` pasa los dos a Postgres (una base y un usuario por servicio).
En el `.env`:

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml
```

y corré `./setup.sh`, que genera las contraseñas de la base. Sin ese archivo el MCP sigue
con archivos; con `DATABASE_URL` en su entorno usa Postgres (tabla `kv`, se crea sola).
Forgejo elige la base al arrancar por primera vez: para mover una instalación que ya
existe hay que hacer `forgejo dump` y restaurar. Las instrucciones de backup están al
principio de `docker-compose.cloud.yml`.

## Cómo funciona

```
cursos/<slug>            repo fuente (lo escribe la IA)
├── README.md            portada
├── course.yaml          milestones, issues, deps, tests, pistas
├── issues/*.md          cuerpo de cada issue
├── files/**             esqueleto que recibe el alumno
└── solution/**          solución de referencia (no se publica)

<vos>/<slug>             tu repo (lo crea start_course)
├── .course/run.sh       corre los tests: sh .course/run.sh [n...]
├── .course/byox.mjs     plan / advance / hint, lo usan los workflows
└── .forgejo/workflows/  byox.yml (push) y pista.yml (/pista)
```

En cada push a `main`:

1. **plan** (node): lista los issues abiertos.
2. **test** (la imagen del curso): corre el test de cada uno.
3. **advance** (node): cierra los que pasaron y tienen sus dependencias
   cerradas (en cascada), mueve los labels `bloqueado` y `disponible` y
   avisa al MCP para actualizar tu perfil.

Comentar `/pista` en un issue publica la siguiente pista. Las pistas viajan
como secreto de Actions, no están en tu repo.

## Herramientas del MCP

| Herramienta | Qué hace |
|---|---|
| `get_format_guide` | El formato y las reglas para escribir un curso |
| `list_courses` | Cursos creados y su progreso |
| `read_course` | Lee archivos del repo fuente |
| `write_course_files` | Escribe archivos en el repo fuente (un commit) |
| `validate_course` | Chequea formato y grafo |
| `verify_course` | Corre los tests en la imagen real: el esqueleto tiene que fallar y la solución pasar |
| `start_course` | Publica tu repo del curso (sólo si el commit está verificado) |
| `course_status` | Qué está cerrado, disponible o bloqueado |
| `export_course` / `import_course` | El código de un curso para compartirlo, e importarlo |

Para acompañar al alumno mientras hace un curso:

| Herramienta | Qué hace |
|---|---|
| `where_am_i` | Progreso de cada curso, etapas disponibles y tests que fallan con su archivo:línea |
| `get_stage` | La consigna de una etapa, de qué depende, qué desbloquea y las pistas ya pedidas |
| `explain_failure` | Por qué falla un test: diagnóstico, líneas del log y el código del alumno en ese commit |
| `get_hint` | Pide la siguiente pista y la devuelve cuando el bot la publica |
| `ci_status` | El último push y el resultado de cada etapa probada |
| `read_my_code` | Lee el repo del alumno en Forgejo |
| `my_stats` | Racha, récord y cursos creados, empezados y terminados |

Y prompts, que en Claude Code aparecen como comandos: `/mcp__byox__atascado`,
`/mcp__byox__que_sigue`, `/mcp__byox__revisar_etapa` y `/mcp__byox__crear_curso`.

La web muestra si hay un asistente conectado: como el MCP no tiene sesiones, cuenta
como conectado el cliente que lo usó en los últimos 15 minutos.

## Perfil

El MCP mantiene `<vos>/.profile`, que Forgejo muestra en tu perfil. Ahí van tu
racha (días con commits o issues cerrados), los cursos creados, tomados y
terminados, y un heatmap de 16 semanas. Se actualiza cuando avanzás y cada 30
minutos.

## Escribir un curso a mano

Además de pedírselo a la IA, podés armar un curso vos, con tu editor y git:

```bash
byox new build-your-own-grep --lang rust --title "build-your-own-grep"
cd build-your-own-grep
# course.yaml, issues/, files/ (lo que recibe el alumno) y solution/
git push
byox check
byox start build-your-own-grep
```

`byox new` crea `cursos/<curso>` desde una plantilla con dos issues, tests y
solución que ya pasan la verificación, con `origin: human` en `course.yaml`
(la web lo marca como hecho a mano). Forgejo avisa al MCP en cada push al repo
fuente y el MCP lo verifica solo (15 s después del último push): con `files/`
cada test tiene que fallar y con `files/` + `solution/`, pasar. `byox check`
espera el resultado y te muestra qué etapa falla, con la salida del test. En la
web está en **Creados**. El formato completo: `byox guide`.

## Compartir un curso

`byox export <curso>` copia al portapapeles un código `byox1-…`: el repo fuente
entero (con la solución) comprimido. No pasa por ningún servidor: lo mandás por
donde quieras y la otra persona lo pega en `byox import` o en **Importar** de la
web, en su propio byox. Se crea el repo fuente y se verifica en su Docker; si
pasa, lo empieza con `byox start`. Un curso chico ocupa unos 4 KB y uno de 16
etapas, unos 23 KB: para esos conviene `byox export <curso> -o curso.byox`, que
guarda el mismo código en un archivo.

Los tests de un curso importado corren en tu Docker: importá códigos de gente
en la que confiás.

## Subir un curso desde una carpeta

```bash
docker run --rm --network byox -v "$PWD:/w" -w /w node:22-bookworm-slim \
  node scripts/push-course.mjs examples/build-your-own-calc --verify --start
```

`examples/build-your-own-calc` es un curso chico de ejemplo (3 issues, Python) y
`courses/build-your-own-parallel` es el curso de la Clase 9 (16 issues, Rust).

## Licencias

Cada parte tiene la licencia que mejor le calza, con el texto completo en el `LICENSE` de su carpeta.

| Qué | Licencia | Dónde |
|---|---|---|
| Código: app, API, servidor MCP, web, CLI, `setup.sh` y Compose | [AGPL-3.0-or-later](LICENSE) | raíz del repositorio |
| Plantillas, workflows y guía que byox copia a los repositorios de los alumnos | [MIT](mcp/assets/LICENSE) | `mcp/assets/` |
| Cursos de ejemplo | [CC BY-SA 4.0](courses/LICENSE) | `courses/`, `examples/` |
| Documentación | [CC BY 4.0](mcp/web/src/docs/LICENSE) | `mcp/web/src/docs/` |

- Puedes usar, modificar y autoalojar byox gratis. Si ofreces una versión modificada como servicio en red, la AGPL te pide publicar tus cambios bajo la misma licencia.
- Lo que byox genera dentro de los repositorios de tus alumnos (workflows, scripts de prueba) es MIT, así que no impone condiciones a tus cursos. Los cursos que escribas son tuyos y los licencias como quieras.
- Los cursos de `courses/` y `examples/` citan sus fuentes (especificaciones, documentación y libros) en la sección «Para leer» de cada etapa y en su portada; esas obras conservan sus propias licencias.
