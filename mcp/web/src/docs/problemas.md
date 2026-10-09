---
title: "Solución de problemas"
description: "Los problemas más comunes al instalar y usar byox, con su causa y su solución."
---

# Solución de problemas

<p class="lead">Los problemas frecuentes, ordenados por dónde aparecen. Si ninguno encaja, empieza por los logs: <code>docker compose logs -f</code>.</p>

## Instalación

### `setup.sh` falla con rutas raras en Windows

Ejecútalo desde Git Bash o WSL, no desde PowerShell ni CMD.

### Un puerto está ocupado

Otro programa usa el 3000, el 3333 o el 2222. Cambia el lado izquierdo del mapeo en `docker-compose.yml` (por ejemplo `"127.0.0.1:3334:3333"`) y ajusta `BYOX_WEB_URL` o `BYOX_PUBLIC_URL`. Después ejecuta `docker compose up -d`.

### `docker compose ps` muestra un servicio caído

Mira sus logs con `docker compose logs <servicio>`. Si es `mcp`, el motivo suele estar en las últimas líneas: una variable que falta en `.env` o Forgejo todavía sin responder.

## Cuenta y acceso

### No puedo iniciar sesión

- Comprueba el usuario y la contraseña. La contraseña de `BYOX_PASSWORD` en `.env` es la de la instalación: si la cambiaste después, ese valor ya no coincide.
- Tras 8 intentos fallidos en 10 minutos, el inicio de sesión se bloquea un rato (`429`). Espera y reintenta.
- Si la cuenta se desactivó en Forgejo, byox tampoco la deja entrar.

### Olvidé la contraseña

Un administrador puede fijar una nueva desde Forgejo:

```bash
docker compose exec -u git forgejo forgejo admin user change-password \
  --username admin --password "nueva-contraseña-larga" --must-change-password=false
```

### El asistente no se conecta (401)

El token es incorrecto, está incompleto o fue revocado. Crea uno nuevo en **Cuenta → Tokens de acceso** y registra el MCP de nuevo con el comando que muestra la pantalla. Comprueba también que la cabecera sea `Authorization: Bearer byox_…`, con la palabra `Bearer` y un espacio.

### El asistente se conecta pero no puede crear cursos

Tu cuenta no puede crear cursos en esta instancia. Pídele a un administrador que use una cuenta de administrador, o que defina `BYOX_AUTHORS=all` en `.env` (ver [Cuentas y permisos](/docs/cuentas)).

### «Registro cerrado»

Es el modo por defecto (`BYOX_SIGNUP=closed`). Un administrador crea la cuenta, o cambia a `invite` para repartir códigos.

## Git y repositorios

### `git clone` o `git push` piden usuario y contraseña

Es lo esperado: tus repositorios son privados. Usa tu usuario y contraseña de Forgejo, o genera un token de acceso en Forgejo (Ajustes → Aplicaciones) y úsalo como contraseña.

### `Ya existe <usuario>/<curso>`

Ya empezaste ese curso. Para volver a empezar de cero (borra el progreso), pídele al asistente `start_course` con `reset: true`.

### Cambié la dirección de Forgejo y mis repositorios dejaron de funcionar

Actualiza el remoto: `git remote set-url origin https://git.ejemplo.com/<usuario>/<curso>.git`.

## CI y tests

### Hice push y no pasa nada

- Mira el estado del runner en la barra lateral de la app, o con `docker compose logs runner`.
- Si el runner no se registró, borra `data/runner/config.yml` y ejecuta de nuevo `bash setup.sh`.
- Si hay muchos pushes a la vez, los jobs hacen cola: sube `capacity` en `data/runner/config.yml` y reinicia el runner.

### El CI corre pero la etapa no se cierra ni muestra el error

Puede ser que el repositorio no pueda informar sus resultados a byox. Pasa cuando el repositorio se creó antes de actualizar byox, o cuando rotaste `BYOX_SECRET` o el token del bot. Se arregla trayendo los workflows nuevos:

- desde el asistente: `upgrade_course` sobre ese curso;
- o desde la portada del curso, con el botón **Actualizar**, si ofrece etapas nuevas.

El código de tu repositorio no se toca.

### El test pasa en local y falla en el CI (o al revés)

El CI y `byox test` usan la misma imagen y el mismo comando, así que la diferencia suele ser el estado del repositorio: archivos sin subir, o un test que depende de algo que no está en el commit. Confirma con `git status`, y prueba con `byox test` (que usa Docker) en lugar de `--local`.

### Docker no está corriendo

`byox test` y `.course\test` necesitan Docker. En Windows y macOS, abre Docker Desktop y vuelve a probar.

### La verificación de un curso nunca termina

Verificar descarga la imagen del curso y compila, y la primera vez puede tardar varios minutos. Sigue el avance en **Creados**. Si parece colgada, mira `docker compose logs -f mcp`.

## Recursos

### Se está llenando el disco

Las imágenes de Docker y las cachés de los cursos se acumulan. Revisa el uso con `docker system df`. Puedes borrar imágenes sin usar con `docker image prune`, y la caché de un curso concreto con `docker volume rm byox-cache-<curso>`; se vuelve a generar la próxima vez que corra.

### Todo va lento al correr varios cursos

Cada job arranca un contenedor. Revisa CPU y memoria de la máquina, y ajusta `capacity` del runner a lo que aguanta.

## Todavía no se resuelve

Reúne esto antes de pedir ayuda:

```bash
docker compose ps
docker compose logs --tail 100 mcp
docker compose logs --tail 100 forgejo
docker compose logs --tail 100 runner
```

Antes de compartir nada, revisa que no incluya credenciales. Nunca compartas el archivo `.env`.
