---
title: "Seguridad"
description: "Qué protege byox, qué no, los riesgos de ejecutar código de cursos y una lista de endurecimiento para tu instancia."
---

# Seguridad

<p class="lead">byox ejecuta código: el de los tests de cada curso, que puede venir de un asistente o de otra persona. Esta página explica qué protege y qué no, para que decidas con información a quién das acceso.</p>

## Resumen

| | |
|---|---|
| **Sirve bien para** | Uso personal, un equipo o un aula en los que confías en todas las cuentas. |
| **No está pensado todavía para** | Un servicio público abierto a desconocidos que comparten la misma máquina. |

Si la instancia es tuya y de gente de confianza, sigue la lista de endurecimiento del final y estarás bien. Si quieres ofrecerla a desconocidos, lee la sección «Qué falta para una instancia pública».

## Qué protege byox

- **Todo exige una cuenta.** La API y el servidor MCP rechazan con `401` cualquier petición sin sesión o token válidos.
- **Cada persona ve lo suyo.** El progreso, la racha y los repositorios de alumno son por usuario. El catálogo de cursos es común a la instancia.
- **Las contraseñas no pasan por byox para guardarse.** Se validan contra Forgejo; byox solo guarda sesiones y la huella de los tokens.
- **Los tokens se guardan como huella SHA-256** y se pueden revocar. El valor completo se muestra una sola vez.
- **Las sesiones usan cookies `HttpOnly` y `SameSite=Lax`.** Las peticiones que modifican datos y llegan con cookie deben venir del mismo origen.
- **Hay un límite de intentos** de inicio de sesión y de registro, para frenar la fuerza bruta.
- **Los avisos del CI no se pueden falsificar entre repositorios.** Cada repositorio de alumno tiene su propio secreto para informar resultados; si un alumno lo filtra, solo sirve para su repositorio. El webhook que avisa de los cambios en los cursos fuente viaja firmado.
- **Escribir, verificar e importar cursos está restringido** a administradores por defecto (`BYOX_AUTHORS=admin`).
- **El bot no puede iniciar sesión** en la app.

## Qué no protege

### Ejecutar código de cursos

Los tests corren en contenedores que usan el Docker del host a través de `/var/run/docker.sock`, montado en el runner y en el servicio de byox. Un contenedor con acceso a ese socket puede, si el código es malicioso, controlar el host. Consecuencias prácticas:

- **Importar un curso es ejecutar código de otra persona.** Importa solo códigos `byox1-…` de gente en quien confíes. Antes de confirmar ves una vista previa de lo que trae.
- **Un curso escrito por un asistente también ejecuta código.** Verifica los cursos antes de publicarlos y revisa lo que genera.
- **Un alumno controla los workflows de su repositorio**, así que puede hacer que su CI ejecute lo que quiera dentro del contenedor del job.

### El bot compartido

El usuario `byox` es colaborador con permiso de escritura de todos los repositorios de alumnos, y su token está disponible como secreto de Actions en cada uno. Como cada alumno controla sus workflows, puede leer ese token, y con él acceder a los repositorios privados de los demás alumnos de la misma instancia.

Para un equipo o un aula de confianza, esto es aceptable. Para desconocidos, no.

### Credenciales en el servidor

`.env` contiene el token del administrador de Forgejo y la contraseña inicial. Quien lea ese archivo controla la instancia. El permiso es 600, pero cuida quién tiene acceso al servidor.

## Qué falta para una instancia pública

Para abrir byox a desconocidos que comparten servidor, hace falta resolver, como mínimo:

1. **Un entorno de ejecución aislado** para los tests, en lugar del Docker del host: por ejemplo, gVisor o Firecracker, con límites de CPU, memoria, red y tiempo.
2. **Credenciales por repositorio** en lugar de un bot compartido: un token que solo alcance el repositorio de ese alumno.
3. **Cuotas por usuario** de minutos de CI y de almacenamiento.
4. **Revisión de los cursos** antes de que se publiquen a otras personas.

Estas piezas no están implementadas. Hasta entonces, no ofrezcas byox como servicio abierto.

## Lista de endurecimiento

- [ ] Instálalo en una máquina o VM dedicada, sin nada más sensible.
- [ ] Mantén `BYOX_SIGNUP=closed` o `invite`.
- [ ] Mantén `BYOX_AUTHORS=admin`. Pon `all` solo si confías en todas las cuentas.
- [ ] Publícalo detrás de HTTPS y define `BYOX_SECURE_COOKIES=1`.
- [ ] No expongas los puertos 3000, 3333 ni 2222 directamente a internet.
- [ ] Usa contraseñas largas; cambia la inicial de `.env`.
- [ ] Revoca los tokens que ya no uses.
- [ ] Haz copias de seguridad y prueba restaurarlas.
- [ ] Actualiza con regularidad (`git pull` y `docker compose up -d --build`).
- [ ] Ten a mano la [rotación de secretos](/docs/produccion#rotar-secretos).
