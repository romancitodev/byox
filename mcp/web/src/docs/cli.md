---
title: "CLI"
description: "Instala el CLI de byox, inicia sesión con un token y consulta la referencia de comandos."
---

# CLI

<p class="lead"><code>byox</code> es un ejecutable nativo (Rust) que usa la misma API que la web. Dentro del repositorio de un curso detecta solo de qué curso se trata.</p>

## Instalar

Necesitas [Rust](https://rustup.rs). No hay binarios publicados: el CLI se compila en tu máquina (aproximadamente un minuto). Directamente desde GitHub:

```bash
cargo install --git https://github.com/romancitodev/byox byox --locked
```

O, si ya clonaste el repositorio de byox:

```bash
cargo install --path cli
```

Eso deja el binario `byox` en tu `PATH` (normalmente `~/.cargo/bin`).

## Iniciar sesión

La API exige un token personal. Créalo en **Cuenta → Tokens de acceso** y guárdalo:

```bash
byox login byox_…
```

El token queda en un archivo de tu usuario, con permiso 600 en Linux y macOS:

| Sistema | Ruta |
|---|---|
| Windows | `%APPDATA%\byox\token` |
| Linux y macOS | `~/.config/byox/token` |

Otra opción es la variable de entorno `BYOX_TOKEN`, que tiene prioridad sobre el archivo. Útil para scripts y CI.

## Apuntar a tu instancia

Por defecto el CLI habla con `http://localhost:3333`. Para otra instancia, define su dirección:

```bash
export BYOX_URL=https://byox.ejemplo.com
```

## Referencia

| Comando | Qué hace |
|---|---|
| `byox` | Progreso, etapa actual y resultado del último push, con el error y el `archivo:línea` si falló. |
| `byox test [n]` | Corre los tests en Docker, en la misma imagen que el CI, y al final dice qué falló y dónde. Sin número prueba la etapa actual; `--all` prueba todas; `--local` usa `sh` y tus herramientas. |
| `byox watch` | Después de `git push`: espera al CI y dice qué se cerró, qué se desbloqueó y qué falló. |
| `byox show [n]` | Las instrucciones de la etapa, en la terminal. |
| `byox hint [n]` | Pide la siguiente pista. |
| `byox log [n]` | La salida del test en el CI, con las líneas del error resaltadas. |
| `byox open [n]` | Abre la etapa en la web. |
| `byox courses` | Tus cursos. |
| `byox clone <curso>` | Clona el repositorio de uno. |
| `byox start <curso>` | Empieza un curso verificado: crea tu repositorio con los issues. |
| `byox new <curso> --lang <lenguaje>` | Crea un curso a mano desde una plantilla que ya funciona. Lenguajes: `python`, `rust`, `go`, `node`. |
| `byox check [curso]` | Estado del curso que escribes: formato y, por etapa, si el esqueleto falla y la solución pasa. |
| `byox export <curso>` | Copia el código del curso para compartirlo. Con `-o curso.byox` lo guarda en un archivo. |
| `byox import [código\|archivo]` | Importa un curso. Sin argumentos, usa el código del portapapeles. |
| `byox guide` | El formato de un curso. |
| `byox login <token>` | Guarda tu token personal. |

Las etapas se identifican por su número. Sin número, `test`, `show`, `hint`, `log` y `open` usan la etapa actual (la primera disponible).

`new`, `check`, `export` e `import` son del lado de quien escribe cursos. `new`, `check` e `import` requieren una cuenta que pueda crear cursos (ver [Cuentas y permisos](/docs/cuentas)). `byox test` debe ejecutarse dentro del repositorio de un curso.

## Un flujo típico

```bash
byox courses                 # ¿qué hay?
byox start build-your-own-redis
byox clone build-your-own-redis
cd build-your-own-redis
byox show                    # lee la etapa actual
# …escribes código…
byox test                    # pruébalo en local
git add -A && git commit -m "Etapa 1" && git push
byox watch                   # espera al CI y mira qué se cerró
byox hint                    # si te atascas
```

## En Windows

Sin el CLI, cada repositorio de alumno trae un script equivalente que también corre en Docker:

```text
.course\test 7
```

El CLI y ese script comparten la misma imagen y el mismo comando que el CI, así que si el test pasa en local, pasa en el runner.
