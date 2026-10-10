---
title: "Asistente (MCP)"
description: "Conecta Claude Code u otro cliente MCP a byox, qué herramientas y comandos expone y cómo sacarles partido."
---

# Asistente (MCP)

<p class="lead">byox incluye un servidor MCP. Con él, tu asistente puede escribir y verificar cursos, y acompañarte mientras haces uno: leer la etapa, entender por qué falla un test y señalarte la línea.</p>

## Conectar

El servidor vive en `/mcp` de tu instancia y usa HTTP. No acepta peticiones anónimas: cada persona usa un token personal.

1. Entra a la app y ve a **Cuenta → Tokens de acceso**.
2. Crea un token y copia el comando de Claude Code que aparece (el token no vuelve a mostrarse).
3. Ejecútalo una vez:

```bash
claude mcp add --transport http byox http://localhost:3333/mcp \
  --header "Authorization: Bearer byox_…"
```

Cambia `localhost:3333` por la dirección pública de tu instancia si no es local.

### Otros clientes

Cualquier cliente compatible con MCP sobre HTTP funciona. Necesita dos datos:

| Dato | Valor |
|---|---|
| URL del servidor | `https://tu-instancia/mcp` |
| Cabecera | `Authorization: Bearer byox_…` |

### Comprobar que funciona

La barra lateral de la app muestra el estado del asistente. Pasa a «conectado» cuando el cliente usó el MCP en los últimos 15 minutos, y muestra cuál fue la última herramienta que ejecutó. El estado es por cuenta: cada persona ve el de su propio asistente.

<div class="callout tip" data-t="Si algo falla">

Un `401` casi siempre es un token mal copiado o revocado. Crea otro en **Cuenta**. Más casos en [Solución de problemas](/docs/problemas).

</div>

## Qué puede hacer

El asistente actúa siempre como la cuenta del token, con sus mismos permisos.

### Mientras haces un curso

| Herramienta | Para qué |
|---|---|
| `where_am_i` | Tu progreso en cada curso empezado, las etapas disponibles y los tests que fallan, con el mensaje y el `archivo:línea`. |
| `get_stage` | La consigna completa de una etapa, de qué depende, qué desbloquea y su último resultado. |
| `explain_failure` | Por qué falla un test: el diagnóstico, las líneas del log que importan y tu código alrededor del error, en el commit donde falló. |
| `get_hint` | Pide la siguiente pista de una etapa. Cada pista pedida queda registrada. |
| `read_my_code` | Lee tu repositorio en Forgejo cuando el código no está en el directorio de trabajo. |
| `ci_status` | El último push: commit, estado del CI y resultado de cada etapa probada. |
| `my_stats` | Tu racha, tu récord y los cursos creados, empezados y terminados. |
| `course_status` | El progreso de un curso empezado: qué está cerrado, disponible o bloqueado. |
| `list_courses` | Los cursos de la instancia y tu progreso en cada uno. |

El asistente está instruido para explicar la causa y señalar el archivo y la línea, pero no escribir la solución completa salvo que se la pidas.

### Para crear cursos

Estas herramientas solo funcionan con una cuenta que pueda crear cursos: un administrador, o cualquiera si la instancia usa `BYOX_AUTHORS=all`.

Cada cuenta tiene un cupo de llamadas al MCP por semana (50 por defecto; los administradores no tienen tope). Escribir un curso con un asistente son varias llamadas, así que conviene pedirle que junte los archivos en pocas escrituras. Ver [Cuentas y permisos](/docs/cuentas).

| Herramienta | Para qué |
|---|---|
| `get_format_guide` | La guía del formato de un curso. El asistente la lee antes de escribir. |
| `read_course` | Lee los archivos de un repositorio fuente. |
| `write_course_files` | Crea o actualiza archivos de un curso en un solo commit. |
| `validate_course` | Revisa el formato, el grafo y los archivos. Es rápido y no corre tests. |
| `verify_course` | Corre los tests contra el esqueleto (deben fallar) y contra la solución (deben pasar). Puede tardar varios minutos. |
| `export_course` / `import_course` | Comparte un curso como código `byox1-…` o importa uno. |
| `start_course` | Publica tu repositorio del curso. Exige un commit verificado. |
| `upgrade_course` | Trae a tu repositorio lo nuevo del curso sin perder progreso. |

## Comandos

En Claude Code, byox registra cuatro comandos que aparecen con el prefijo `/mcp__byox__`:

| Comando | Qué hace |
|---|---|
| `/mcp__byox__atascado` | Ayuda con la etapa en la que estás, sin darte la solución. Acepta el curso y la etapa. |
| `/mcp__byox__que_sigue` | Tu progreso y qué etapa conviene hacer ahora. Empieza por los tests que fallan. |
| `/mcp__byox__revisar_etapa` | Revisa tu código de una etapa ya completada: legibilidad, casos borde e idiomaticidad. |
| `/mcp__byox__crear_curso` | Crea, verifica y publica un curso nuevo. Acepta el tema, el lenguaje y el número de etapas. |

## Ejemplos de uso

- **Estás atascado:** «Estoy trabado en la etapa 12. Explícame por qué falla, sin darme la solución.»
- **No sabes por dónde seguir:** «¿Qué sigue?»
- **Quieres un curso nuevo:** «Crea un curso de byox de 10 etapas para escribir un intérprete de Lisp en Python.»

Al crear un curso, el asistente lo escribe, lo verifica y te pregunta antes de publicarlo. Con `verify_course` no hay forma de publicar un curso cuyos tests no se pueden completar.

## Privacidad

El asistente solo ve lo que las herramientas le devuelven: tu progreso, las consignas, los logs de tus tests y tu código cuando se lo pides o cuando llama a `explain_failure` o `read_my_code`. Todo viaja entre tu cliente y tu instancia; byox no contacta con ningún servicio externo.
