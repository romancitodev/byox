---
title: "Inicio rápido"
description: "Instala byox, entra a la app, conecta tu asistente y resuelve tu primera etapa en unos diez minutos."
---

# Inicio rápido

<p class="lead">Al final de esta guía tendrás una instancia de byox funcionando en tu máquina y una etapa de un curso resuelta, con el test pasando en el CI.</p>

Necesitas Docker con Compose, Git y un shell `bash`. En Windows, usa Git Bash o WSL. Si vas a instalarlo en un servidor para más personas, empieza aquí y sigue con [Llevarlo a producción](/docs/produccion).

## Instalar

1. Comprueba que las herramientas están disponibles.

   ```bash
   docker --version && docker compose version && git --version
   ```

2. Clona el repositorio y ejecuta el script de instalación.

   ```bash
   git clone <url-del-repositorio> byox
   cd byox
   bash setup.sh
   ```

El script tarda unos minutos la primera vez, porque descarga las imágenes de Forgejo y del runner. Al terminar imprime algo así:

   ```text
   Listo.
     App:      http://localhost:3333/app   (usuario: admin, contraseña en .env)
     Forgejo:  http://localhost:3000       (la misma cuenta)
   ```

<div class="callout note" data-t="Qué hizo el script">

Creó tu usuario administrador y el usuario bot `byox`, la organización `cursos`, registró el runner y levantó los tres servicios. Las credenciales quedaron en `.env`. Puedes volver a ejecutarlo sin riesgo: lo que ya existe se salta.

</div>

## Entrar

3. Abre [http://localhost:3333/app](http://localhost:3333/app) e inicia sesión con el usuario que mostró el script. La contraseña está en el archivo `.env`, en la variable `BYOX_PASSWORD`. Cámbiala desde **Cuenta**.

## Conectar tu asistente

El asistente es quien escribe los cursos y te ayuda cuando te atascas. El servidor MCP de byox no acepta peticiones anónimas, así que necesita un token personal.

4. Ve a **Cuenta → Tokens de acceso**, escribe un nombre y pulsa **Crear token**. Copia el comando que aparece: el token no vuelve a mostrarse.

   ```bash
   claude mcp add --transport http byox http://localhost:3333/mcp \
     --header "Authorization: Bearer byox_…"
   ```

Cuando tu asistente use una herramienta de byox, el indicador de la barra lateral cambia a «conectado». Más detalles en [Asistente (MCP)](/docs/asistente).

## Empezar un curso

5. En **Cursos**, abre uno y pulsa **Empezar el curso**. byox crea tu repositorio privado `<tu usuario>/<curso>` con una etapa por issue.

   Si todavía no hay cursos, pídele a tu asistente que cree el primero: «Crea un curso de byox para construir un servidor HTTP desde cero en Go». Lo escribe, lo verifica contra una solución de referencia y te pregunta si lo publica. Los detalles están en [Crear y compartir cursos](/docs/cursos).

## Resolver la primera etapa

6. Clona tu repositorio. Forgejo te pide usuario y contraseña de tu cuenta.

   ```bash
   git clone http://localhost:3000/<tu-usuario>/<curso>.git
   cd <curso>
   ```

7. Lee la etapa en la app (o con `byox show` si instalaste el [CLI](/docs/cli)), escribe el código y prueba en local. El test corre en Docker, en la misma imagen que usará el CI.

   ```bash
   sh .course/run.sh 1      # Linux, macOS, Git Bash
   .course\test 1           # Windows
   ```

8. Cuando el test pase, súbelo.

   ```bash
   git add -A && git commit -m "Etapa 1" && git push
   ```

## Ver cómo se cierra

El push dispara los tests en el runner. En unos segundos la etapa pasa a **Completada** en la app, se desbloquean las que dependían de ella y tu racha suma un día. Si un test falla, la pestaña **Salida** de la etapa muestra el archivo y la línea del error.

<div class="callout tip" data-t="Con el CLI">

`byox watch` espera al CI después del push y te dice qué se cerró, qué se desbloqueó y qué falló, sin salir de la terminal.

</div>

## Qué sigue

<div class="cards">

<a class="card" href="/docs/como-funciona"><b>Cómo funciona</b><span>El ciclo de CI, las pistas y la arquitectura.</span></a>

<a class="card" href="/docs/cuentas"><b>Cuentas y permisos</b><span>Invita a más personas a tu instancia.</span></a>

<a class="card" href="/docs/produccion"><b>Llevarlo a producción</b><span>Dominio, HTTPS, copias de seguridad.</span></a>

</div>
