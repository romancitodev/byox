---
title: "Cómo funciona"
description: "Los conceptos de byox: repositorios fuente y de alumno, etapas y grafo, el ciclo de CI, las pistas y la arquitectura de una instancia."
---

# Cómo funciona

<p class="lead">byox no tiene un motor de cursos propio. Usa piezas que ya existen (Git, issues, Actions y Docker) y las coordina con un pequeño servicio. Esta página explica cómo encajan.</p>

## Dos tipos de repositorio

Cada curso existe dos veces.

**El repositorio fuente** vive en la organización `cursos` y es privado. Lo escribe un asistente a través del MCP, o una persona a mano. Contiene la portada, un archivo `course.yaml` con las etapas, el cuerpo de cada etapa, el esqueleto que recibirá el alumno y una solución de referencia que el alumno no ve.

**El repositorio del alumno** se llama `<tu usuario>/<curso>` y también es privado. Se crea cuando empiezas el curso: byox copia el esqueleto, crea un issue por etapa, enlaza las dependencias entre ellos y agrega los workflows de CI. A partir de ahí es tuyo; el código que escribes ahí no se toca nunca.

| | Fuente | Alumno |
|---|---|---|
| Dónde | `cursos/<curso>` | `<tu usuario>/<curso>` |
| Quién lo crea | El asistente (`write_course_files`) | byox, al empezar el curso |
| Contiene | Etapas, tests, esqueleto, solución | Esqueleto, tus cambios, issues y workflows |
| Quién lo ve | Administradores y autores | Solo tú (y el bot que corre el CI) |

## Etapas y grafo

Cada etapa es un issue de Forgejo con un test asociado. Las etapas se agrupan en tramos (milestones) y declaran de qué otras etapas dependen. Una etapa está siempre en uno de tres estados:

| Estado | Significado |
|---|---|
| Completada | Su issue está cerrado. |
| Disponible | Todas sus dependencias están cerradas; puedes trabajar en ella. |
| Bloqueada | Falta cerrar alguna dependencia. |

Una etapa con dos dependencias, por ejemplo, queda bloqueada hasta que se cierren las dos. El mapa de etapas de cada curso muestra el grafo completo.

## El ciclo de CI

En cada `git push` a `main` del repositorio del alumno, Forgejo Actions ejecuta tres jobs:

<div class="dg">
<svg viewBox="0 0 800 150" role="img" aria-label="Ciclo de CI: push, plan, test, advance y resultado">
<text class="tag" x="0" y="22">1 · push</text><text class="tag" x="168" y="22">2 · plan</text><text class="tag hot" x="336" y="22">3 · test</text><text class="tag" x="504" y="22">4 · advance</text><text class="tag" x="672" y="22">5 · resultado</text>
<rect class="box" x="0" y="34" width="128" height="68" rx="9"/><text x="64" y="64" text-anchor="middle">Tu código</text><text class="sub" x="64" y="83" text-anchor="middle">git push a main</text>
<rect class="box" x="168" y="34" width="128" height="68" rx="9"/><text x="232" y="64" text-anchor="middle">plan</text><text class="sub" x="232" y="83" text-anchor="middle">issues abiertos</text>
<rect class="box hot" x="336" y="34" width="128" height="68" rx="9"/><text x="400" y="64" text-anchor="middle">test</text><text class="sub" x="400" y="83" text-anchor="middle">imagen del curso</text>
<rect class="box" x="504" y="34" width="128" height="68" rx="9"/><text x="568" y="64" text-anchor="middle">advance</text><text class="sub" x="568" y="83" text-anchor="middle">cierra y desbloquea</text>
<rect class="box ok" x="672" y="34" width="128" height="68" rx="9"/><text x="736" y="64" text-anchor="middle">Tu progreso</text><text class="sub" x="736" y="83" text-anchor="middle">web, CLI, asistente</text>
<path class="ln" d="M128 68H160"/><path class="arr" d="M160 63l8 5-8 5z"/>
<path class="ln" d="M296 68H328"/><path class="arr" d="M328 63l8 5-8 5z"/>
<path class="ln hot" d="M464 68H496"/><path class="arr hot" d="M496 63l8 5-8 5z"/>
<path class="ln" d="M632 68H664"/><path class="arr" d="M664 63l8 5-8 5z"/>
<path class="ln" d="M568 102V128H64V110"/><path class="arr" d="M59 112l5-8 5 8z"/>
<text class="sub" x="316" y="146" text-anchor="middle">las etapas desbloqueadas quedan listas para el siguiente push</text>
</svg>
</div>

1. **plan** lista los issues abiertos del repositorio.
2. **test** corre el test de cada uno dentro de la imagen de Docker del curso. Es el único paso que ejecuta tu código.
3. **advance** cierra los issues cuyo test pasó y cuyas dependencias están cerradas, en cascada. Luego mueve las etiquetas `bloqueado` y `disponible` y avisa a byox para que actualice tu progreso.

El runner no distingue entre «el test falló» y «la etapa todavía no está empezada»: ambos casos dejan el issue abierto. byox los separa al leer la salida. Si el test llega al `todo!()` del esqueleto (o a un `NotImplementedError` en Python), la etapa figura como sin empezar y no como fallo.

Para cada etapa que falla, byox guarda el final de la salida del test, deduce el archivo y la línea del error y los muestra en la web, en el CLI y al asistente. Por eso no hace falta abrir el log del CI.

### Probar en local

Los mismos tests corren en tu máquina, en la misma imagen que el CI:

```bash
sh .course/run.sh 7        # Linux, macOS, Git Bash: la etapa 7
sh .course/run.sh          # todas
.course\test 7             # Windows: corre en Docker
byox test 7                # con el CLI
```

## Pistas

Cada etapa puede traer pistas ordenadas de lo conceptual a lo concreto. Se piden de una en una:

- comentando `/pista` en el issue de la etapa;
- con el botón «Pedir la pista» de la etapa, en la web;
- con `byox hint`;
- o dejando que el asistente la pida con `get_hint`.

Un workflow publica la siguiente pista como comentario. Las pistas no están en tu repositorio: viajan como un secreto de Actions (`BYOX_HINTS`), así que no se pueden leer de antemano.

## Verificar un curso

Antes de que alguien pueda empezar un curso, byox comprueba que se puede completar. `verify_course` corre los tests de cada etapa dos veces, en la imagen del curso:

1. Solo con el esqueleto (`files/`): **todos los tests tienen que fallar**.
2. Con el esqueleto y la solución (`files/` más `solution/`): **todos tienen que pasar**.

El resultado queda como estado del commit. `start_course` se niega a publicar un commit que no esté verificado, y si el curso cambia, hay que volver a verificarlo.

## Arquitectura

Una instancia son tres servicios de Docker Compose. Todo lo demás son clientes.

<div class="dg">
<svg viewBox="0 0 800 340" role="img" aria-label="Arquitectura: clientes, la app de byox, Forgejo y el runner">
<text class="tag" x="0" y="14">Clientes</text>
<rect class="box" x="40" y="26" width="200" height="56" rx="9"/><text x="140" y="52" text-anchor="middle">Navegador</text><text class="sub" x="140" y="70" text-anchor="middle">/app</text>
<rect class="box" x="300" y="26" width="200" height="56" rx="9"/><text x="400" y="52" text-anchor="middle">Asistente</text><text class="sub" x="400" y="70" text-anchor="middle">MCP con token</text>
<rect class="box" x="560" y="26" width="200" height="56" rx="9"/><text x="660" y="52" text-anchor="middle">CLI byox</text><text class="sub" x="660" y="70" text-anchor="middle">API con token</text>
<path class="ln" d="M140 82V104H330V132"/><path class="arr" d="M325 124l5 8 5-8z"/>
<path class="ln" d="M400 82V132"/><path class="arr" d="M395 124l5 8 5-8z"/>
<path class="ln" d="M660 82V104H470V132"/><path class="arr" d="M465 124l5 8 5-8z"/>
<rect class="zone" x="0" y="112" width="800" height="226" rx="14"/><text class="tag" x="14" y="130">Tu instancia · docker compose</text>
<rect class="box hot" x="250" y="140" width="300" height="70" rx="10"/><text x="400" y="172" text-anchor="middle">byox · :3333</text><text class="sub" x="400" y="191" text-anchor="middle">web, API y servidor MCP</text>
<rect class="box" x="40" y="262" width="260" height="62" rx="10"/><text x="170" y="290" text-anchor="middle">Forgejo · :3000</text><text class="sub" x="170" y="308" text-anchor="middle">repos, issues y Actions</text>
<rect class="box" x="500" y="262" width="260" height="62" rx="10"/><text x="630" y="290" text-anchor="middle">Runner</text><text class="sub" x="630" y="308" text-anchor="middle">ejecuta los tests en Docker</text>
<path class="ln" d="M300 210V236H170V262"/><path class="arr" d="M165 254l5 8 5-8z"/><text class="sub" x="236" y="230" text-anchor="middle">API admin</text>
<path class="ln" d="M300 293H492"/><path class="arr" d="M492 288l8 5-8 5z"/><text class="sub" x="396" y="286" text-anchor="middle">jobs de Actions</text>
<path class="ln hot" d="M630 262V236H500V210"/><path class="arr hot" d="M495 218l5-8 5 8z"/><text class="sub" x="566" y="230" text-anchor="middle">resultados</text>
</svg>
</div>

| Servicio | Puerto | Qué hace |
|---|---|---|
| `forgejo` | 3000 (web), 2222 (SSH) | Guarda los repositorios, los issues y las cuentas. Ejecuta Actions. |
| `runner` | — | Toma los jobs de Forgejo y los corre en contenedores con el Docker del host. |
| `mcp` | 3333 | La app web, la API HTTP, el servidor MCP y la lógica de byox (empezar cursos, verificar, perfil, racha). |

Los clientes nunca hablan con Forgejo a través de byox para hacer `git push`: eso va directo a Forgejo, con tu usuario y contraseña de Forgejo (o un token de acceso).

## Dónde vive cada dato

| Dato | Dónde |
|---|---|
| Cuentas y contraseñas | Forgejo (base de datos SQLite en el volumen `forgejo-data`) |
| Repositorios fuente y de alumnos | Forgejo |
| Progreso | Los issues cerrados de cada repositorio de alumno |
| Sesiones, tokens y resultados de tests | Volumen `mcp-data` (archivos JSON; los tokens solo como huella) |
| Credenciales de la instancia | Archivo `.env` junto a `docker-compose.yml` |

Por defecto byox no usa una base de datos propia. Si borras el volumen `mcp-data` pierdes las sesiones, los tokens y los últimos resultados de tests; el progreso y el código siguen en Forgejo.

Para un servidor, `docker-compose.cloud.yml` guarda el estado de Forgejo y de byox en Postgres en vez de SQLite y archivos JSON (byox pasa a usar Postgres cuando tiene la variable `DATABASE_URL`). Las instrucciones están al principio de `docker-compose.cloud.yml`.
