# 🔨 byox

"Build your own X" self-hosted: cursos que son repos de Forgejo. Cada etapa es
un issue con un test, los issues forman un grafo, y cada push corre los tests,
cierra lo que pasa y desbloquea lo siguiente. Los cursos los puede escribir una
IA a través de un MCP, o una persona a mano, y en los dos casos se verifican
contra una solución real antes de publicarse.

[English summary](README.en.md) · [Documentación](mcp/web/src/docs/index.md) · [Contribuir](CONTRIBUTING.md) · [Seguridad](SECURITY.md)

## Cómo funciona

Un curso es un proyecto real dividido en etapas. Quien lo toma recibe un
repositorio con un esqueleto que compila y tests que fallan; resolver una etapa
es hacer que su test pase.

1. `byox start <curso>` (o el botón de la app) crea tu repo privado con un issue por etapa.
2. Escribís el código y probás en local con `byox test`, en la misma imagen de Docker que usa el CI.
3. Hacés `git push`. El runner de Forgejo corre los tests de los issues abiertos.
4. Los que pasan se cierran, se desbloquean los que dependían de ellos y la app y el CLI te muestran el resultado (con archivo y línea si algo falló).

Todo corre en tu máquina o en tu servidor: un Forgejo, un runner que ejecuta los
tests en Docker y una aplicación (web, API y servidor MCP). No hay servicios
externos ni cuentas de terceros.

## Estado del proyecto

byox se puede instalar y usar hoy, pero es un proyecto joven. Qué hay y qué no:

| Hecho | Pendiente o con límites |
|---|---|
| Instalación local con `setup.sh` y Docker Compose | La suite de tests automáticos cubre el servidor MCP y los scripts de la VPS; la web y el CLI se prueban a mano |
| Cuentas (usuarios de Forgejo), sesiones y tokens personales | El **registro abierto no es seguro todavía**: el bot es colaborador de todos los repos y el runner usa el socket de Docker del host (ver [Seguridad](SECURITY.md)) |
| Servidor MCP con herramientas para escribir, verificar y publicar cursos, y para acompañar a quien cursa | Aislamiento de la ejecución de tests, credenciales por repositorio y cuotas: sin implementar |
| App web, landing y documentación (Astro) | Una nube de pago es un plan a futuro; no hay planes, precios ni fechas |
| CLI nativo (Rust): progreso, tests, pistas, creación y compartir cursos | El curso de Redis está incompleto (66 etapas publicadas; ver [Cursos](#cursos)) |
| Estado en archivos JSON, o en Postgres para servidores | Mover una instalación existente a Postgres es manual |
| Kit de despliegue para una VPS (Caddy, backups, avisos a Discord) y simulación de dos VPS en Kubernetes con kind | La simulación de Kubernetes es un banco de pruebas, no un método de instalación |

## Inicio rápido

Necesitás Docker (con Compose), Git y `bash` (en Windows, Git Bash o WSL).

```bash
git clone https://github.com/romancitodev/byox.git
cd byox
bash setup.sh
```

`setup.sh` crea tu usuario administrador (`BYOX_USER`, por defecto `owner`), el
bot `byox`, la organización `cursos`, registra el runner y levanta todo. La
contraseña queda en `.env`. Se puede volver a correr sin riesgo.

Todo exige una cuenta: entrá a http://localhost:3333/app con ese usuario. Para
sumar personas, `BYOX_SIGNUP=invite` (o `open`) en `.env`.

| | |
|---|---|
| **Tus cursos** | http://localhost:3333/app |
| Landing | http://localhost:3333 |
| Documentación | http://localhost:3333/docs |
| Forgejo | http://localhost:3000 |
| MCP | http://localhost:3333/mcp |

La guía paso a paso está en [Inicio rápido](mcp/web/src/docs/inicio-rapido.md).

## Componentes

| Carpeta | Qué es | Tecnología |
|---|---|---|
| [`mcp/`](mcp) | Servidor: API HTTP, servidor MCP, estado, verificación de cursos | TypeScript (Node 22) |
| [`mcp/web/`](mcp/web) | Landing, documentación y app web; el MCP sirve el resultado compilado | Astro |
| [`mcp/assets/`](mcp/assets) | Lo que byox copia a cada repo de alumno (workflows, scripts, plantillas, guía de formato) | YAML, JS, plantillas |
| [`cli/`](cli) | El comando `byox` | Rust |
| [`courses/`](courses), [`examples/`](examples) | Cursos incluidos | Ver [Cursos](#cursos) |
| [`deploy/vps/`](deploy/vps) | Kit para una sola VPS: bootstrap, Caddy, backups, monitor y avisos a Discord | Bash, Caddy |
| [`deploy/k8s-sim/`](deploy/k8s-sim) | Simulación de dos VPS con runners horizontales en kind | Bash, Kubernetes |
| [`docker-compose.yml`](docker-compose.yml), [`docker-compose.cloud.yml`](docker-compose.cloud.yml) | Los servicios y la variante con Postgres | Docker Compose |
| [`setup.sh`](setup.sh), [`scripts/`](scripts) | Instalación y subida de cursos desde una carpeta | Bash, Node |

La instancia son tres servicios: `forgejo` (repos, issues, Actions), `runner`
(ejecuta los tests en contenedores con el Docker del host) y `mcp` (la app).

## Cursos

| Curso | Lenguaje | Etapas | Estado |
|---|---|---|---|
| [`build-your-own-redis`](courses/build-your-own-redis) | Rust | 66, en 5 tramos (RESP, servidor, strings, expiración, listas) | En desarrollo: faltan persistencia, transacciones, pub/sub, replicación y más. Los tests comparan contra un `redis-server` real |
| [`build-your-own-parallel`](courses/build-your-own-parallel) | Rust | 16, en 6 tramos | Publicado: reducción, scan, odd-even y merge sort paralelos |
| [`build-your-own-calc`](examples/build-your-own-calc) | Python | 3, en 2 tramos | Ejemplo chico: tokenizer y evaluador |

Cada etapa termina con una sección «Para leer» y cada curso cita sus fuentes en la
portada: especificaciones, documentación oficial y libros. Esas obras conservan
sus propias licencias; los cursos no copian su contenido.

Para subir un curso desde una carpeta a una instancia en marcha (con un token personal en `BYOX_TOKEN`):

```bash
docker run --rm --network byox -e BYOX_TOKEN=byox_… -v "$PWD:/w" -w /w node:22-bookworm-slim \
  node scripts/push-course.mjs examples/build-your-own-calc --verify --start
```

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

Sin el CLI, en Windows: `.course\test 7` (también corre en Docker). Más en [CLI](mcp/web/src/docs/cli.md).

## La app web

http://localhost:3333/app es donde seguís los cursos:

- Barra lateral con las etapas por milestone: ✓ completada, ⋯ disponible, # bloqueada.
- La portada de cada curso (`/app/c/<curso>`) con el README, el mapa de etapas clickeable y un botón para seguir.
- Instrucciones renderizadas, el comando para verificar local y tus pistas (pedís la siguiente con un botón).
- Arriba, el estado del último push en vivo: corriendo, terminado, link a los logs.
- Cuando un push cierra etapas, un aviso con lo que se desbloqueó y un botón a la siguiente.
- A la derecha: tu racha, el progreso y qué depende de qué.
- **Creados** (`/app/creados`): los cursos que escribiste, con el estado de la verificación de cada push
  (el esqueleto tiene que fallar y la solución pasar, etapa por etapa) y el log de lo que falla.
  Desde ahí se crea un curso nuevo a partir de una plantilla o se importa uno.
- **Compartir**: en la portada de un curso, un código `byox1-…` para copiar o un archivo `.byox` para descargar.
  Quien lo recibe lo importa desde Creados, con una vista previa antes de confirmar.

La landing (http://localhost:3333) explica byox con un curso de ejemplo inventado.
Las rutas viejas (`/cursos`, `/actividad`, `/c/...`) redirigen a `/app`.

La web es un proyecto de [Astro](https://astro.build) en `mcp/web/` (landing en
`src/pages/index.astro`, app en `src/pages/app.astro`, documentación en
`src/docs/`). El Dockerfile del MCP la compila y el MCP sirve el resultado. Para
trabajar en ella con recarga en vivo, con el MCP corriendo en Docker:

```bash
cd mcp/web && npm install && npm run dev
```

Queda en http://localhost:4321 y le pasa `/api` al MCP en `:3333` (otro destino con
`BYOX_API`). Para mostrar el link a GitHub en la landing, agregá `PUBLIC_GITHUB_URL`
al `.env` y volvé a levantar con `docker compose up -d --build mcp`.

## El asistente (MCP)

Conectar Claude Code (el MCP exige un token personal, créalo en Cuenta → Tokens):

```bash
claude mcp add --transport http byox http://localhost:3333/mcp \
  --header "Authorization: Bearer byox_…"
```

Para escribir y publicar cursos:

| Herramienta | Qué hace |
|---|---|
| `get_format_guide` | El formato y las reglas para escribir un curso |
| `list_courses` | Cursos creados y su progreso |
| `read_course` | Lee archivos del repo fuente |
| `write_course_files` | Escribe archivos en el repo fuente (un commit) |
| `validate_course` | Chequea formato y grafo |
| `verify_course` | Corre los tests en la imagen real: el esqueleto tiene que fallar y la solución pasar |
| `start_course` | Publica tu repo del curso (sólo si el commit está verificado) |
| `upgrade_course` | Trae a un repo ya empezado los cambios del curso, sin tocar el código del alumno |
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
como conectado el cliente que lo usó en los últimos 15 minutos. Más en
[Asistente (MCP)](mcp/web/src/docs/asistente.md).

## Cuentas y permisos

Las cuentas son usuarios de Forgejo; byox no guarda contraseñas. La web usa una sesión
(cookie `HttpOnly`) y el MCP y el CLI, tokens personales `byox_…` (se guardan hasheados).

| Variable | Valores | Qué hace |
|---|---|---|
| `BYOX_SIGNUP` | `closed` (defecto), `invite`, `open` | Quién puede crear cuenta |
| `BYOX_AUTHORS` | `admin` (defecto), `all` | Quién escribe, verifica e importa cursos (corre código en Docker) |
| `BYOX_PUBLIC_URL`, `BYOX_DOMAIN`, `BYOX_WEB_URL` | URLs | Direcciones públicas cuando no es localhost |
| `BYOX_TRUST_PROXY`, `BYOX_SECURE_COOKIES` | `1` | Detrás de un proxy con HTTPS |

Todas las variables están en [Configuración](mcp/web/src/docs/configuracion.md).

> **Límite conocido.** El bot `byox` es colaborador de todos los repos de alumnos y su
> token va como secreto de Actions, y los tests corren con el Docker del host. Una
> instancia compartida no está aislada entre desconocidos: usala con equipos y aulas
> de confianza. Los detalles están en [SECURITY.md](SECURITY.md).

## En un servidor

- **Postgres.** Por defecto Forgejo usa SQLite y el MCP guarda su estado (sesiones, tokens,
  invitaciones, resultados) en archivos JSON de `BYOX_DATA`. Para un servidor,
  `docker-compose.cloud.yml` pasa los dos a Postgres (una base y un usuario por servicio):
  poné `COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml` en el `.env` y corré `./setup.sh`,
  que genera las contraseñas. Con `DATABASE_URL` en su entorno el MCP usa Postgres (tabla `kv`,
  se crea sola). Forgejo elige la base al arrancar por primera vez: para mover una instalación
  que ya existe hay que hacer `forgejo dump` y restaurar.
- **Una VPS.** [`deploy/vps`](deploy/vps/README.md) trae el paso a paso: DNS, `bootstrap.sh` (usuario
  `deploy`, firewall, Docker, Caddy), HTTPS, backups, monitor y avisos a Discord por webhook.
- **Simulación.** [`deploy/k8s-sim`](deploy/k8s-sim) levanta en kind el equivalente a dos VPS
  (una con el núcleo, otras con runners) para probar la topología.
- La guía general: [Llevarlo a producción](mcp/web/src/docs/produccion.md).

## Qué crea byox

```
cursos/<slug>            repo fuente (lo escribe la IA o una persona)
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

En cada push a `main`: **plan** lista los issues abiertos; **test** corre el test de cada
uno en la imagen del curso; **advance** cierra los que pasaron y tienen sus dependencias
cerradas (en cascada), mueve los labels `bloqueado` y `disponible` y avisa al MCP para
actualizar tu perfil. Comentar `/pista` en un issue publica la siguiente pista; las pistas
viajan como secreto de Actions y no están en tu repo. El MCP mantiene además
`<vos>/.profile`, que Forgejo muestra en tu perfil: racha, cursos y un heatmap de 16 semanas.
Más detalle en [Cómo funciona](mcp/web/src/docs/como-funciona.md).

## Escribir y compartir cursos

Además de pedírselo a la IA, podés armar un curso vos, con tu editor y git:

```bash
byox new build-your-own-grep --lang rust --title "build-your-own-grep"
cd build-your-own-grep
# course.yaml, issues/, files/ (lo que recibe el alumno) y solution/
git push
byox check
byox start build-your-own-grep
```

`byox new` crea `cursos/<curso>` desde una plantilla con dos issues, tests y solución que
ya pasan la verificación, con `origin: human` en `course.yaml`. Forgejo avisa al MCP en
cada push al repo fuente y el MCP lo verifica solo (15 s después del último push): con
`files/` cada test tiene que fallar y con `files/` + `solution/`, pasar. El formato
completo: `byox guide` o [Crear y compartir cursos](mcp/web/src/docs/cursos.md).

`byox export <curso>` copia al portapapeles un código `byox1-…`: el repo fuente entero (con
la solución) comprimido. No pasa por ningún servidor: lo mandás por donde quieras y la otra
persona lo pega en `byox import` o en **Importar** de la web. Los tests de un curso
importado corren en tu Docker: importá códigos de gente en la que confiás.

## Contribuir

Las contribuciones son bienvenidas: código, cursos nuevos, documentación y reportes de
errores. [CONTRIBUTING.md](CONTRIBUTING.md) explica cómo levantar el entorno, correr los
tests, el formato de los commits y cómo proponer un curso. Participar implica respetar el
[código de conducta](CODE_OF_CONDUCT.md). Las vulnerabilidades se reportan en privado, como
indica [SECURITY.md](SECURITY.md).

## Licencias

Cada parte tiene la licencia que mejor le calza, con el texto completo en el `LICENSE` de su carpeta.

| Qué | Licencia | Dónde |
|---|---|---|
| Código: app, API, servidor MCP, web, CLI, `setup.sh` y Compose | [AGPL-3.0-or-later](LICENSE) | raíz del repositorio |
| Plantillas, workflows y guía que byox copia a los repositorios de los alumnos | [MIT](mcp/assets/LICENSE) | `mcp/assets/` |
| Cursos de ejemplo | [CC BY-SA 4.0](courses/LICENSE) | `courses/`, `examples/` |
| Documentación | [CC BY 4.0](mcp/web/src/docs/LICENSE) | `mcp/web/src/docs/` |

- Podés usar, modificar y autoalojar byox gratis. Si ofrecés una versión modificada como servicio en red, la AGPL te pide publicar tus cambios bajo la misma licencia.
- Lo que byox genera dentro de los repositorios de tus alumnos (workflows, scripts de prueba) es MIT, así que no impone condiciones a tus cursos. Los cursos que escribas son tuyos y los licenciás como quieras.
- Los cursos de `courses/` y `examples/` citan sus fuentes (especificaciones, documentación y libros) en la sección «Para leer» de cada etapa y en su portada; esas obras conservan sus propias licencias.
- Las dependencias no están incluidas en el repositorio: se instalan con `npm` y `cargo`. Las directas son de licencias permisivas (MIT, ISC, Apache-2.0, OFL para las fuentes), salvo [GSAP](https://gsap.com/standard-license), que tiene una licencia propia de uso gratuito y no es de código abierto.
