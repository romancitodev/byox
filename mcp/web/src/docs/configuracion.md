---
title: "Configuración"
description: "Todas las variables de entorno de byox, cómo aplicarlas y cómo ajustar el runner."
---

# Configuración

<p class="lead">byox se configura con variables de entorno en el archivo <code>.env</code>, junto a <code>docker-compose.yml</code>. Casi todo tiene un valor por defecto sensato para una instalación local.</p>

## Cómo aplicar un cambio

1. Edita `.env`.
2. Ejecuta `docker compose up -d`. Compose recrea solo los servicios cuyo entorno cambió.

Las variables `PUBLIC_*` se incorporan al compilar la web, así que necesitan reconstruir: `docker compose up -d --build mcp`.

## Cuentas

| Variable | Por defecto | Qué hace |
|---|---|---|
| `BYOX_SIGNUP` | `closed` | Quién puede crear cuenta. `closed`: solo el administrador. `invite`: con un código de invitación. `open`: cualquiera. |
| `BYOX_AUTHORS` | `admin` | Quién puede escribir, verificar e importar cursos. `admin`: solo administradores. `all`: cualquier cuenta. |

Detalles y consecuencias de cada valor en [Cuentas y permisos](/docs/cuentas).

## Direcciones públicas

Cuando byox no corre en `localhost`, estas tres variables le dicen cuáles son las direcciones por las que te alcanzan los demás.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `BYOX_PUBLIC_URL` | `http://localhost:3000` | Dirección pública de Forgejo. Es la que usan los alumnos para clonar y hacer push, y la que aparece en los enlaces a repositorios. |
| `BYOX_DOMAIN` | `localhost` | Dominio de Forgejo, sin protocolo. También se usa para las URL de clonado por SSH. |
| `BYOX_WEB_URL` | `http://localhost:3333` | Dirección pública de la app de byox. Aparece en los enlaces de exportación de cursos. |

## Detrás de un proxy

| Variable | Por defecto | Qué hace |
|---|---|---|
| `BYOX_TRUST_PROXY` | vacío | Con `1`, byox confía en las cabeceras `X-Forwarded-For`, `-Host` y `-Proto`. Se usa para el límite de intentos de inicio de sesión por IP y para detectar HTTPS. |
| `BYOX_SECURE_COOKIES` | vacío | Con `1`, la cookie de sesión se marca siempre como `Secure`. |

<div class="callout warn" data-t="Solo con un proxy de confianza">

Activa `BYOX_TRUST_PROXY` únicamente si el servicio solo es alcanzable a través de tu proxy. Si no, cualquiera puede falsificar su IP con esa cabecera y esquivar el límite de intentos.

</div>

## Secretos

| Variable | Por defecto | Qué hace |
|---|---|---|
| `BYOX_SECRET` | se genera | Secreto con el que se firman los avisos del CI. Si no lo defines, byox crea uno al arrancar y lo guarda en el volumen de datos. Defínelo solo si necesitas que sea el mismo entre reinstalaciones. |

## Zona horaria

| Variable | Por defecto | Qué hace |
|---|---|---|
| `BYOX_TZ` | `America/Argentina/Buenos_Aires` | Zona horaria con la que se cuentan los días de la racha y se muestran las fechas del perfil. |

## Generadas por la instalación

`setup.sh` crea estas variables. No las cambies a mano a menos que sepas lo que haces.

| Variable | Qué es |
|---|---|
| `BYOX_USER` | Usuario administrador inicial (por defecto `admin`). |
| `BYOX_PASSWORD` | Su contraseña al momento de la instalación. No se actualiza si la cambias después. |
| `BYOX_TOKEN` | Token de acceso del administrador que usa el servicio de byox para hablar con Forgejo. |
| `BYOX_BOT` | Nombre del usuario bot (por defecto `byox`). |
| `BYOX_BOT_TOKEN` | Token del bot. Va como secreto de Actions en cada repositorio de alumno. |
| `BYOX_ORG` | Organización de los repositorios fuente (por defecto `cursos`). |

<div class="callout danger" data-t="Credenciales">

`BYOX_TOKEN` da control total sobre Forgejo. `.env` se escribe con permiso 600: no lo subas a un repositorio ni lo compartas.

</div>

## Compilación de la web

Se leen al compilar el sitio y quedan dentro de la landing y la documentación. Con Docker, `PUBLIC_GITHUB_URL` y `PUBLIC_WAITLIST_URL` se toman del `.env` al ejecutar `docker compose up -d --build mcp`.

| Variable | Qué hace |
|---|---|
| `PUBLIC_GITHUB_URL` | Muestra un enlace a GitHub en la landing y la documentación. |
| `PUBLIC_WAITLIST_URL` | Endpoint que recibe `POST` con `{ email, perfil }`. Si no está definido, el formulario de lista de espera no se muestra. |

### Publicar la landing y la documentación por separado

El sitio estático (carpeta `mcp/web`) se puede publicar solo, por ejemplo en Vercel, con `npm run build`. En ese caso no existe una app en la misma dirección, y estas variables, que se definen en el entorno de compilación del proyecto, ajustan los botones:

| Variable | Qué hace |
|---|---|
| `PUBLIC_LANDING_ONLY` | Con `1`, los botones «Empezar» apuntan a la documentación en lugar de a `/app`, y el menú ofrece «Instalar». |
| `PUBLIC_APP_URL` | Dirección de una app ya desplegada (por ejemplo `https://app.ejemplo.com`). Si está definida, los botones apuntan a ella. |

## El runner

El runner se configura en `data/runner/config.yml`, que escribe `setup.sh`. Los ajustes que más interesan:

```yaml
runner:
  capacity: 2        # jobs en paralelo
  timeout: 1h        # tiempo máximo de un job
```

Cada push de un alumno genera varios jobs, y la verificación de cursos también ejecuta contenedores. Si varios alumnos hacen push a la vez, sube `capacity` y reinicia el runner:

```bash
docker compose restart runner
```

El límite real es la CPU y la memoria de la máquina: cada job arranca un contenedor con la imagen del curso.

## Puertos

Los puertos se definen en `docker-compose.yml`, no en `.env`. Para cambiar uno, edita el lado izquierdo del mapeo y actualiza la variable de dirección correspondiente:

```yaml
ports:
  - "127.0.0.1:3334:3333"   # la app, ahora en el 3334
```

Después ajusta `BYOX_WEB_URL` y aplica con `docker compose up -d`.
