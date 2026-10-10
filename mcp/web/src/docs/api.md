---
title: "API HTTP"
description: "Referencia de la API de byox: autenticación con sesión o token, formato de errores y todos los endpoints."
---

# API HTTP

<p class="lead">La web y el CLI usan la misma API, y puedes usarla desde tus propios scripts. Todo vive bajo <code>/api</code>, responde JSON y exige una cuenta.</p>

## Autenticación

Hay dos formas de identificarse, y el resultado es el mismo: la petición actúa como esa cuenta.

| Modo | Cómo | Para qué |
|---|---|---|
| Sesión | Cookie `byox_session`, que devuelve `POST /api/auth/login` | La web |
| Token personal | `Authorization: Bearer byox_…` | Scripts, el CLI y el MCP |

Los tokens se crean en **Cuenta → Tokens de acceso**, o con `POST /api/auth/tokens` desde una sesión.

```bash
# Con un token
curl -s https://byox.ejemplo.com/api/courses \
  -H "Authorization: Bearer $BYOX_TOKEN"

# Con una sesión
curl -s -c cookies.txt -X POST https://byox.ejemplo.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ana","password":"…"}'
curl -s -b cookies.txt https://byox.ejemplo.com/api/courses
```

## Errores

Los errores devuelven un cuerpo `{ "error": "mensaje" }` y el código HTTP correspondiente.

| Código | Cuándo |
|---|---|
| `400` | La petición es inválida (datos que faltan o no cumplen las reglas). |
| `401` | Falta la sesión o el token, o ya no valen. El cuerpo incluye `"login": true`. |
| `403` | La cuenta no tiene permiso para esa acción, o la petición con cookie no viene del mismo origen. |
| `404` | No existe el recurso. |
| `409` | Conflicto, por ejemplo un usuario que ya existe. |
| `413` | El cuerpo es demasiado grande. |
| `429` | Demasiados intentos; espera unos minutos. |

## Cuenta

| Método y ruta | Descripción | Acceso |
|---|---|---|
| `GET /api/auth/state` | Modo de registro y largo mínimo de contraseña. | Público |
| `POST /api/auth/login` | `{ username, password }`. Abre una sesión. | Público |
| `POST /api/auth/signup` | `{ username, email, password, invite? }`. Crea una cuenta y abre sesión. | Según `BYOX_SIGNUP` |
| `POST /api/auth/logout` | Cierra la sesión. | Público |
| `GET /api/auth/me` | La cuenta actual: `user`, `admin`, `email`. | Sesión o token |
| `POST /api/auth/password` | `{ current, next }`. Cambia la contraseña y cierra las demás sesiones. | Solo sesión |
| `GET /api/auth/tokens` | Tus tokens, sin el valor secreto. | Sesión o token |
| `POST /api/auth/tokens` | `{ name }`. Crea un token y devuelve su valor, una única vez. | Solo sesión |
| `DELETE /api/auth/tokens/:id` | Revoca un token. | Sesión o token |
| `POST /api/auth/invites` | `{ note?, ttlHours?, max? }`. Crea un código y lo devuelve completo (`{ code, id }`), una sola vez. `ttlHours`: de 1 a 8760 horas; sin valor, no vence. `max`: de 1 a 1000 cuentas; sin valor, una; `null`, sin límite. | Administrador |
| `GET /api/auth/invites` | Todos los códigos, los más nuevos primero: `{ id, note, by, created, expires, max, used, state, uses: [{ user, at }] }`. `state` es `active`, `used`, `expired` o `revoked`. | Administrador |
| `DELETE /api/auth/invites/<id>` | Revoca un código. Si ya creó cuentas queda en la lista como `revoked`; si no, se borra. | Administrador |

## Cursos y progreso

| Método y ruta | Descripción |
|---|---|
| `GET /api/courses` | El catálogo que ves tú (los públicos, los tuyos y los que ya empezaste), con tu progreso, los tests que fallan y, en cada curso, `visibility` (`public` o `private`), `stars`, `starred`, `canWrite` y `canManage`. |
| `GET /api/courses/:slug` | Un curso: tramos, etapas con su estado y resultado, URL de clonado y los mismos campos de visibilidad y estrellas. `404` si no lo ves. |
| `PUT /api/courses/:slug/visibility` | `{ public: true \| false }`. Publica el curso o lo vuelve privado. Solo su dueño o un administrador (`403` si no); para publicar, el último commit tiene que estar verificado (`400`). Al volverlo privado se borran las estrellas ajenas. |
| `PUT /api/courses/:slug/star` | Da tu estrella al curso. Responde `{ starred, stars }`. |
| `DELETE /api/courses/:slug/star` | Saca tu estrella. |
| `GET /api/courses/:slug/status` | El último push: commit, estado del CI y resultado por etapa. |
| `GET /api/courses/:slug/readme` | La portada del curso, ya renderizada a HTML. |
| `GET /api/courses/:slug/issues/:n` | Una etapa: consigna, pistas pedidas, actividad y último resultado con el log. |
| `POST /api/courses/:slug/issues/:n/hint` | Pide la siguiente pista. |
| `POST /api/courses/:slug/start` | Empieza el curso (crea tu repositorio). Exige un commit verificado. |
| `POST /api/courses/:slug/upgrade` | Trae lo nuevo del curso a tu repositorio, sin perder progreso. |
| `GET /api/profile` | Tu racha, tu récord, los días activos y tus cursos. |
| `GET /api/activity` | Los últimos pushes y etapas cerradas. |
| `GET /api/health` | Estado de Forgejo, del runner y de tu asistente conectado. |
| `GET /api/usage` | Tus llamadas al MCP de la semana: `mcpCalls`, `mcpLimit` (`null` si no tienes tope), `mcpRemaining` y `mcpResetsAt`. Ver [Cuentas y permisos](/docs/cuentas). |

## Autoría

Las rutas `POST` de esta sección requieren una cuenta que pueda crear cursos (administrador, o `BYOX_AUTHORS=all`).

| Método y ruta | Descripción |
|---|---|
| `GET /api/author` | Los cursos fuente y su estado de verificación. |
| `GET /api/author/templates` | Las plantillas disponibles (`python`, `rust`, `go`, `node`). |
| `GET /api/author/guide` | La guía de formato de un curso, en markdown. |
| `POST /api/author/new` | `{ slug, lang, title? }`. Crea un curso desde una plantilla. |
| `GET /api/author/:slug` | El estado de un curso: errores de formato y verificación por etapa. |
| `POST /api/author/:slug/verify` | Inicia la verificación. Responde `202`; consulta el estado con la ruta anterior. |
| `GET /api/courses/:slug/export` | El código `byox1-…` del curso, con metadatos. |
| `GET /api/courses/:slug/export.byox` | El mismo código como archivo descargable. |
| `POST /api/import/preview` | `{ code }`. Muestra qué trae un código, sin importar nada. |
| `POST /api/import` | `{ code, slug? }`. Importa un curso y lo verifica. |

## Rutas que no son de la API

| Ruta | Descripción |
|---|---|
| `GET /health` | Responde `ok` si el servicio vive. Sin autenticación; sirve para monitoreo. |
| `POST /mcp` | El servidor MCP. Exige `Authorization: Bearer byox_…`. |
| `POST /hooks/results`, `/hooks/progress` | Avisos internos del CI. Se validan con un secreto por repositorio; no son para uso externo. |
| `POST /hooks/source` | Webhook de Forgejo al publicar en un curso fuente. Viaja firmado. |
