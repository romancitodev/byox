---
title: "Llevarlo a producción"
description: "Poner byox en un servidor para otras personas: dominio, HTTPS con Caddy o nginx, firewall, copias de seguridad, restauración, actualizaciones y rotación de secretos."
---

# Llevarlo a producción

<p class="lead">Instalar byox en tu portátil y ponerlo a disposición de un equipo o un aula son dos cosas distintas. Esta guía cubre la segunda: un servidor con dominio, HTTPS, copias de seguridad y un plan de actualización.</p>

## Lista de verificación

Antes de dar acceso a otras personas:

- [ ] Una máquina o VM dedicada, no tu equipo de trabajo (ver [Seguridad](/docs/seguridad)).
- [ ] Dos nombres de dominio apuntando al servidor: uno para la app y otro para Forgejo.
- [ ] Un proxy inverso con HTTPS delante de los puertos 3333 y 3000.
- [ ] `BYOX_SIGNUP` en `closed` o `invite`, y `BYOX_AUTHORS` en `admin`.
- [ ] Copias de seguridad automáticas de los dos volúmenes y de `.env`.
- [ ] Un plan para actualizar.

## Dominio y proxy

byox publica sus puertos solo en `127.0.0.1`. Eso es lo que quieres en producción: el único punto de entrada es tu proxy, que termina TLS.

Necesitas dos nombres, por ejemplo `byox.ejemplo.com` para la app y `git.ejemplo.com` para Forgejo. Los alumnos usan la primera en el navegador y la segunda para clonar y hacer push.

### Con Caddy

Caddy obtiene y renueva los certificados solo:

```text
byox.ejemplo.com {
  reverse_proxy 127.0.0.1:3333
}

git.ejemplo.com {
  reverse_proxy 127.0.0.1:3000
}
```

### Con nginx

```nginx
server {
  server_name byox.ejemplo.com;
  listen 443 ssl;
  # ssl_certificate y ssl_certificate_key: los de tu certificado

  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
  }
}

server {
  server_name git.ejemplo.com;
  listen 443 ssl;
  client_max_body_size 512m;      # pushes grandes

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Variables

En `.env`:

```bash
BYOX_PUBLIC_URL=https://git.ejemplo.com
BYOX_DOMAIN=git.ejemplo.com
BYOX_WEB_URL=https://byox.ejemplo.com
BYOX_TRUST_PROXY=1
BYOX_SECURE_COOKIES=1
BYOX_SIGNUP=invite
```

Aplica los cambios:

```bash
docker compose up -d --build
```

`BYOX_TRUST_PROXY` hace que byox use la IP real de cada visitante para el límite de intentos de inicio de sesión. `BYOX_SECURE_COOKIES` marca la cookie de sesión como `Secure`. Cada variable está descrita en [Configuración](/docs/configuracion).

<div class="callout warn" data-t="Cambiar la dirección de Forgejo">

Si ya tenías repositorios clonados con la dirección anterior, cada persona debe actualizar su remoto: `git remote set-url origin https://git.ejemplo.com/<usuario>/<curso>.git`.

</div>

## Firewall

Solo necesitas abrir hacia fuera:

| Puerto | Para qué |
|---|---|
| 443 (y 80 para renovar certificados) | El proxy |
| 22 | SSH de administración |

Los puertos 3000, 3333 y 2222 quedan atados a `127.0.0.1`: no los abras. Si quieres que los alumnos usen `git` por SSH, publica el 2222 deliberadamente; por HTTPS no hace falta.

## Dimensionar

No hay una cifra única: depende de cuántas personas hagan push a la vez y de la imagen de cada curso. Lo que importa:

- **CPU y memoria**: cada push de un alumno arranca contenedores con la imagen del curso. El runner ejecuta `capacity` jobs en paralelo (2 por defecto, en `data/runner/config.yml`). Súbelo si ves cola.
- **Disco**: las imágenes de Docker de cada lenguaje se acumulan, y cada curso tiene un volumen de caché (`byox-cache-<curso>`) con las dependencias descargadas. Vigila el uso con `docker system df`.
- **Compilación**: la primera ejecución de un curso es la más lenta (descarga y compilación); las siguientes reutilizan la caché.

## Copias de seguridad

Todo el estado de byox está en dos volúmenes de Docker y en un archivo:

| Qué | Dónde | Por qué importa |
|---|---|---|
| Repositorios, cuentas, issues | volumen `byox_forgejo-data` | Es todo el contenido y el progreso. |
| Sesiones, tokens, secreto del CI | volumen `byox_mcp-data` | Sin él, hay que volver a crear tokens y reiniciar sesión. |
| Credenciales de la instancia | `.env` y `data/runner/` | Sin ellos no puedes reconectar los servicios. |

Una copia consistente se hace con la instancia detenida:

```bash
docker compose stop
docker run --rm -v byox_forgejo-data:/d -v "$PWD":/b alpine tar czf /b/forgejo-data.tgz -C /d .
docker run --rm -v byox_mcp-data:/d -v "$PWD":/b alpine tar czf /b/mcp-data.tgz -C /d .
tar czf config.tgz .env data/runner
docker compose start
```

Guarda esos tres archivos fuera del servidor, y cifra `config.tgz`: contiene credenciales. Programa la copia (por ejemplo, con `cron` de madrugada) y **prueba restaurarla** antes de necesitarla.

### Restaurar

Con los servicios detenidos y los volúmenes vacíos (o recreados):

```bash
docker compose down
docker run --rm -v byox_forgejo-data:/d -v "$PWD":/b alpine sh -c "cd /d && tar xzf /b/forgejo-data.tgz"
docker run --rm -v byox_mcp-data:/d -v "$PWD":/b alpine sh -c "cd /d && tar xzf /b/mcp-data.tgz"
tar xzf config.tgz
docker compose up -d
```

## Actualizar

```bash
git pull
docker compose up -d --build
```

Los datos se conservan. Antes de actualizar, haz una copia. Después:

- Los cursos que alumnos ya empezaron mantienen los workflows con los que se crearon. Para traer los nuevos sin perder progreso, usa `upgrade_course` desde el asistente. Si el curso además tiene etapas nuevas, la portada ofrece un botón **Actualizar** que hace lo mismo. Tu código no se toca nunca.
- Si ves resultados de tests que dejan de aparecer tras una actualización, es el caso anterior: el repositorio necesita su `upgrade`.

## Rotar secretos

| Qué rotar | Cómo |
|---|---|
| Contraseña de un usuario | Cambiarla desde **Cuenta**, o con `forgejo admin user change-password`. |
| Tokens personales | Revocarlos y crear otros en **Cuenta → Tokens de acceso**. |
| `BYOX_SECRET` | Cambia el valor en `.env` y ejecuta `docker compose up -d`. Los repositorios de alumnos dejan de poder informar resultados hasta que se ejecute `upgrade_course` en cada uno, porque su secreto de CI se deriva de este. |
| `BYOX_TOKEN` y `BYOX_BOT_TOKEN` | Genera tokens nuevos con `forgejo admin user generate-access-token`, actualiza `.env` y aplica. Para el bot, ejecuta después `upgrade_course` para que cada repositorio reciba el token nuevo. |

## Monitoreo

- **Salud**: `GET /health` responde `ok` si el servicio vive. Sirve para un monitor externo.
- **Estado de servicios**: la barra lateral de la app muestra el de Forgejo y el del runner.
- **Logs**: `docker compose logs -f` (agrega `mcp`, `forgejo` o `runner` para uno solo).
- **Espacio**: `docker system df` y `df -h`.
