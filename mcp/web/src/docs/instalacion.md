---
title: "Instalación"
description: "Requisitos, qué hace setup.sh, puertos, estructura de archivos y cómo detener, reiniciar o desinstalar byox."
---

# Instalación

<p class="lead">byox se instala con un script y se administra con <code>docker compose</code>. Esta página detalla lo que ocurre durante la instalación y cómo comprobar que quedó bien.</p>

## Requisitos

| Qué | Detalle |
|---|---|
| Docker y Compose | Docker Desktop en Windows y macOS; Docker Engine y el plugin de Compose en Linux. |
| Git y bash | En Windows, Git Bash o WSL. El script no funciona desde PowerShell ni CMD. |
| Puertos libres | `3000` (Forgejo), `3333` (app y MCP) y `2222` (SSH de Git). |
| Disco | Las imágenes de cada lenguaje (Rust, Go, Python…) se descargan la primera vez que corre un curso y pueden pesar cientos de MB cada una. |
| Acceso al socket de Docker | El runner y el servicio de byox montan `/var/run/docker.sock` para ejecutar los tests. |

<div class="callout warn" data-t="El socket de Docker">

Montar el socket de Docker equivale a dar acceso de administrador a la máquina a todo lo que corre en esos contenedores. Es necesario para ejecutar los tests, y es la razón por la que conviene instalar byox en una máquina dedicada si vas a darle cuentas a otras personas. Lo desarrolla la página de [Seguridad](/docs/seguridad).

</div>

## Instalar

```bash
git clone https://github.com/romancitodev/byox.git byox
cd byox
bash setup.sh
```

### Qué hace `setup.sh`

1. Levanta Forgejo y espera a que responda en `http://localhost:3000`.
2. Crea tu usuario administrador (`BYOX_USER`, por defecto `admin`) con una contraseña aleatoria de 24 caracteres.
3. Crea el usuario bot `byox`, que ejecuta el CI y publica las pistas. No puede iniciar sesión en la app.
4. Genera un token de acceso para el administrador (lo usa el servicio de byox) y otro para el bot (va como secreto de Actions en cada repositorio de alumno).
5. Crea la organización `cursos`, donde viven los repositorios fuente.
6. Registra el runner y escribe su configuración en `data/runner/config.yml`.
7. Escribe las credenciales en `.env` (permiso 600) y levanta todo con `docker compose up -d --build`.

El script es idempotente. Si vuelves a ejecutarlo, salta lo que ya existe y conserva las variables que hayas agregado a mano en `.env`. Solo reescribe las que genera él: `BYOX_USER`, `BYOX_PASSWORD`, `BYOX_TOKEN`, `BYOX_BOT`, `BYOX_BOT_TOKEN` y `BYOX_ORG`.

## Qué queda instalado

```text
byox/
├── docker-compose.yml     los tres servicios
├── .env                   credenciales y configuración (no lo subas a Git)
├── setup.sh               instalación idempotente
├── data/runner/           configuración y registro del runner
├── mcp/                   la app: servidor, API y web (se compila en Docker)
├── cli/                   el CLI de byox, en Rust
└── courses/               cursos de ejemplo
```

| Servicio | Imagen | Puerto en el host |
|---|---|---|
| `forgejo` | Forgejo 16 | `127.0.0.1:3000` y `127.0.0.1:2222` |
| `runner` | Forgejo Runner 13 | ninguno |
| `mcp` | Se compila desde `mcp/` | `127.0.0.1:3333` |

Los puertos se publican solo en `127.0.0.1`. Para exponerlos a otras personas hace falta un proxy inverso con HTTPS; ver [Llevarlo a producción](/docs/produccion).

## Comprobar la instalación

```bash
docker compose ps
```

Los tres servicios deben figurar como `running`, y `forgejo` además como `healthy`. También puedes consultar el endpoint de salud, que responde `ok` sin autenticación:

```bash
curl -s http://localhost:3333/health
```

Dentro de la app, la barra lateral muestra el estado de Forgejo y del runner. Si el runner figura «sin conexión», revisa [Solución de problemas](/docs/problemas).

## Operar el día a día

| Acción | Comando |
|---|---|
| Ver los logs de la app | `docker compose logs -f mcp` |
| Reiniciar un servicio | `docker compose restart mcp` |
| Aplicar un cambio de `.env` | `docker compose up -d` |
| Reconstruir tras actualizar el código | `docker compose up -d --build` |
| Detener todo, conservando los datos | `docker compose stop` |

## Desinstalar

```bash
docker compose down
```

Detiene y elimina los contenedores, pero conserva los volúmenes, es decir, tus repositorios y cuentas.

<div class="callout danger" data-t="Borra los datos">

`docker compose down -v` elimina también los volúmenes: todos los repositorios, usuarios y el progreso de todos los alumnos. No se puede deshacer. Haz antes una [copia de seguridad](/docs/produccion#copias-de-seguridad).

</div>
