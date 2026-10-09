---
title: "Cuentas y permisos"
description: "Cómo funcionan las cuentas de byox: modos de registro, roles, invitaciones, sesiones, tokens y límites."
---

# Cuentas y permisos

<p class="lead">Todo en byox exige una cuenta. Las cuentas son usuarios de Forgejo: byox no guarda contraseñas, las valida contra Forgejo, y cada persona ve y modifica solo lo suyo.</p>

## Cómo se identifica quién es quién

| Cliente | Credencial | Cómo se obtiene |
|---|---|---|
| App web | Sesión en una cookie `HttpOnly` | Iniciando sesión con usuario y contraseña |
| Servidor MCP | Token personal `byox_…` en `Authorization: Bearer` | **Cuenta → Tokens de acceso** |
| CLI y API | El mismo token personal | **Cuenta → Tokens de acceso** |
| `git clone` y `git push` | Usuario y contraseña de Forgejo, o un token de acceso de Forgejo | Tu cuenta de Forgejo |

Una petición sin credenciales válidas recibe `401`, tanto en la API como en el MCP. Las únicas rutas abiertas son la landing, esta documentación, el cascarón de la app, `/health` y los endpoints para iniciar sesión o registrarse. Los avisos internos del CI (`/hooks`) se validan con un secreto propio de cada repositorio.

## Quién puede registrarse

Se controla con `BYOX_SIGNUP`.

| Valor | Comportamiento | Cuándo usarlo |
|---|---|---|
| `closed` | Nadie se registra solo; el administrador crea las cuentas. | Uso personal o un equipo pequeño. Es el valor por defecto. |
| `invite` | Se puede crear una cuenta, pero hace falta un código de invitación de un solo uso. | Un aula o un equipo al que invitas persona por persona. |
| `open` | Cualquiera crea una cuenta con usuario, correo y contraseña. | Una instancia pública. Combínalo con `BYOX_AUTHORS=admin`. |

Los nombres de usuario van de 2 a 39 caracteres: minúsculas, números, `.`, `-` y `_`. Algunos nombres están reservados (`admin`, `api`, `docs`, `app`, el de la organización de cursos y el del bot). La contraseña necesita al menos 10 caracteres.

## Roles

Hay dos: administrador y usuario. El rol sale de la marca de administrador de la cuenta en Forgejo.

| | Usuario | Administrador |
|---|---|---|
| Ver el catálogo de cursos | Sí | Sí |
| Empezar cursos y tener su propio progreso | Sí | Sí |
| Crear tokens y cambiar su contraseña | Sí | Sí |
| Crear códigos de invitación | No | Sí (con `BYOX_SIGNUP=invite`) |
| Escribir, verificar e importar cursos | Solo con `BYOX_AUTHORS=all` | Sí |

Escribir, verificar e importar cursos ejecuta código en Docker, por eso está restringido por defecto. Solo pon `BYOX_AUTHORS=all` si confías en todas las cuentas de la instancia.

### Crear un administrador o un usuario

Con el registro cerrado, las cuentas se crean desde Forgejo:

```bash
docker compose exec -u git forgejo forgejo admin user create \
  --username ana --email ana@ejemplo.com \
  --password "una-contraseña-larga" --must-change-password=false
```

Agrega `--admin` para crear un administrador. La persona puede cambiar su contraseña después desde **Cuenta**.

## Invitaciones

Con `BYOX_SIGNUP=invite`, un administrador abre **Cuenta → Invitaciones** y pulsa **Crear código**. Cada código sirve para una sola cuenta y se consume al usarse. La persona invitada abre la pantalla de inicio de sesión, elige **Crear una**, y completa usuario, correo, contraseña y el código.

## Sesiones

- Una sesión dura 14 días. La cookie es `HttpOnly` y `SameSite=Lax`, y las peticiones que modifican datos solo se aceptan si vienen de la propia página.
- Las sesiones se guardan en el servidor. Cerrar sesión la invalida de inmediato.
- Cambiar la contraseña cierra todas las demás sesiones de esa cuenta.
- Si desactivas o eliminas una cuenta en Forgejo, deja de poder entrar en menos de un minuto, aunque tenga una sesión o tokens vigentes.

## Tokens personales

Un token deja que un asistente o el CLI actúen como tú, con tus mismos permisos.

- Se crean en **Cuenta → Tokens de acceso**. El valor completo se muestra una sola vez.
- byox guarda solo su huella SHA-256. Si alguien obtiene el archivo de datos, no obtiene tokens utilizables.
- Cada cuenta puede tener hasta 20. La lista muestra cuándo se creó y se usó por última vez cada uno.
- Revocar un token lo invalida al instante.
- Un token no puede crear otros tokens ni cambiar la contraseña: eso solo se hace desde la web, con sesión.

## Límites contra abuso

| Qué | Límite |
|---|---|
| Intentos de inicio de sesión | 8 cada 10 minutos por combinación de red y usuario |
| Registros nuevos | 10 por hora por red |

Pasado el límite, la respuesta es `429` hasta que se libera la ventana. Detrás de un proxy, necesitas `BYOX_TRUST_PROXY=1` para que el límite use la IP real de cada visitante; ver [Configuración](/docs/configuracion).

## Restablecer una contraseña

Si una persona olvida su contraseña, un administrador puede fijar una nueva desde Forgejo:

```bash
docker compose exec -u git forgejo forgejo admin user change-password \
  --username ana --password "otra-contraseña-larga" --must-change-password=false
```
