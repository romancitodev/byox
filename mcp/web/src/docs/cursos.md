---
title: "Crear y compartir cursos"
description: "Cómo crear un curso con un asistente o a mano, el formato de course.yaml, cómo se verifica, y cómo compartirlo y actualizarlo."
---

# Crear y compartir cursos

<p class="lead">Un curso es un proyecto real dividido en etapas, cada una con su test. Puedes pedirle a tu asistente que lo escriba, o escribirlo tú con tu editor y Git. En los dos casos byox comprueba que se puede completar antes de publicarlo.</p>

<div class="callout note" data-t="Permisos">

Crear, verificar e importar cursos ejecuta código en Docker, así que requiere una cuenta de administrador, o que la instancia use `BYOX_AUTHORS=all`. Ver [Cuentas y permisos](/docs/cuentas).

</div>

## Con un asistente

La forma más rápida es pedírselo, con el MCP [conectado](/docs/asistente):

> Crea un curso de byox para construir un servidor HTTP desde cero en Go.

O con el comando `/mcp__byox__crear_curso`, que acepta el tema, el lenguaje y el número de etapas. El asistente sigue este flujo:

1. Lee la guía de formato (`get_format_guide`).
2. Investiga las fuentes reales de lo que va a construir: documentación, especificaciones, implementaciones.
3. Escribe el curso (`write_course_files`) y la solución de referencia a la par.
4. Valida el formato (`validate_course`).
5. Lo verifica contra la solución (`verify_course`) hasta que esté todo en verde.
6. Te pregunta si lo publica (`start_course`).

## A mano

Un curso también se puede escribir sin asistente:

```bash
byox new mi-curso --lang python    # python, rust, go o node
```

Eso crea `cursos/mi-curso` a partir de una plantilla que ya funciona (dos etapas, tests y solución) y la clona. Edita los archivos y haz `git push`: cada push al repositorio fuente se verifica solo en tu Docker. `byox check` muestra los errores de formato y, por etapa, si el esqueleto falla y la solución pasa.

Pon `origin: human` en `course.yaml` para que la web lo muestre como hecho a mano.

## Estructura de un curso

```text
README.md          la portada del curso
course.yaml        metadatos, tramos y etapas
issues/NN-*.md     el cuerpo de cada etapa (markdown)
files/**           se copia tal cual a la raíz del repositorio del alumno
solution/**        implementación de referencia; se aplica encima de files/ al verificar
```

## course.yaml

```yaml
title: build-your-own-redis
description: Un Redis de juguete en Go, del socket a la persistencia.
image: golang:1.25          # imagen donde corren los tests (necesita sh y git)
setup: go mod download      # opcional: corre una vez antes de los tests
topics: [go, redes, protocolos]
origin: ai                  # "ai" si lo escribe un asistente, "human" si lo hace una persona
author: ana                 # opcional

milestones:                 # en el orden en que se muestran
  - id: base
    title: El servidor
    description: Aceptar conexiones y hablar RESP.

issues:                     # ids 1..N, consecutivos y en orden
  - id: 1
    milestone: base
    title: Un servidor TCP que responde PONG
    labels: [fácil, redes]
    deps: []                # ids que tienen que estar cerrados antes
    body: issues/01-pong.md
    test: go test ./pasos/p01/...
    hints:                  # de lo más conceptual a lo más concreto
      - "¿Qué paquete de la std escucha en un puerto TCP?"
      - "`net.Listen` y un bucle con `Accept`."
      - "Cada conexión en su propia goroutine; responde `+PONG\\r\\n`."
```

### Campos

| Campo | Obligatorio | Qué es |
|---|---|---|
| `title`, `description` | Sí | Nombre y resumen del curso. |
| `image` | Sí | Imagen de Docker en la que corren los tests. Tiene que traer `sh` y `git`. |
| `setup` | No | Comando que se ejecuta una vez antes de los tests, por ejemplo para descargar dependencias. |
| `topics` | No | Etiquetas del curso. |
| `origin` | No | `ai` o `human`. La web distingue los cursos escritos por un asistente. |
| `milestones` | Sí | Los tramos, en el orden en que se muestran. |
| `issues[].id` | Sí | Número de la etapa: de 1 a N, sin huecos. Es el número del issue en Forgejo. |
| `issues[].deps` | Sí | Etapas que deben estar cerradas antes. Vacío si no depende de ninguna. |
| `issues[].test` | Sí | Script de `sh` que corre en la raíz del repositorio del alumno. Si sale con 0, la etapa pasa. |
| `issues[].hints` | No | Pistas, de la más conceptual a la más concreta. No se copian al repositorio del alumno. |

### Reglas que valida `validate_course`

- Los ids van de 1 a N, en orden y sin huecos.
- Cada dependencia apunta a una etapa que existe y el grafo no tiene ciclos.
- Todas las etapas tienen `test`. Si algo no se puede testear, hay que reformularlo hasta que se pueda.
- Las etiquetas `bloqueado` y `disponible` están reservadas: las maneja el bot.
- `files/` no puede traer `.course/` ni `.forgejo/`.

## Los tests

El comando `test` de una etapa corre dentro de la imagen del curso, en la raíz del repositorio del alumno. Dos propiedades importan mucho:

- **Tiene que funcionar aunque las etapas posteriores no estén hechas.** En lenguajes que compilan todo el paquete, un test del paso 5 que llama a una función que aún no existe rompería el paso 1. La solución habitual es un archivo de test por etapa: en Rust, `tests/paso_01.rs` con `cargo test --test paso_01` (cada archivo de `tests/` es un crate aparte); en Go, un paquete por paso (`pasos/p01/`); en Python o JavaScript, un archivo por paso (`pytest tests/test_01.py`).
- **Un test solo puede depender del código de su etapa y de sus dependencias.** Si necesita algo de otra etapa, esa etapa va en `deps`.

Los tests son visibles: están en el repositorio del alumno y está bien que los lea.

## El cuerpo de cada etapa

El bot agrega al final cómo verificarla, las dependencias y cuántas pistas hay, así que no lo repitas. Una estructura que funciona:

```markdown
## Objetivo
Qué vas a construir y por qué importa. Conéctalo con lo que ya sabe.

## Contrato
La firma o la interfaz exacta que el test espera.

## Reglas
- Restricciones que fuerzan el aprendizaje.

## Para descubrir
- Preguntas que llevan a la idea clave sin decírsela.

## Hecho cuando
- [ ] El test pasa.

## Para leer
- [Documentación oficial](https://…)
```

## Verificación

`verify_course` (o `byox check`) corre `.course/run.sh` en la imagen del curso dos veces:

| Con | Resultado esperado |
|---|---|
| Solo `files/` (el esqueleto) | **Todos** los tests fallan |
| `files/` más `solution/` | **Todos** los tests pasan |

Si un test pasa con el esqueleto, esa etapa se cerraría sola en el primer push, así que la verificación falla. El resultado queda como estado del commit, y `start_course` no publica un commit sin verificar. Cada vez que cambias el curso hay que volver a verificar.

## Una solución real

Un curso con una API que no existe o un test que no compila es peor que no tener curso. Por eso:

- **Fuentes reales.** Antes de escribir un contrato, un test o una pista, contrástalo con la documentación oficial, la especificación o el código de una implementación real, en la versión que trae `image`.
- **Solución completa.** `solution/` debe resolver el curso entero. Es la prueba de que se puede hacer, y el alumno no la ve.
- **Números medidos.** Si una etapa menciona una salida, un tiempo o un conteo, sácalo de una corrida real.
- **Cita.** Cada etapa termina con «Para leer» y los enlaces que usaste.

## La portada

El `README.md` es lo primero que ve el alumno al abrir su repositorio. byox lo usa como introducción y le agrega debajo el mapa del grafo, la lista de etapas por tramo y cómo se usa, así que eso no hace falta escribirlo. Una portada que funciona tiene un título con emoji, una frase que dice qué vas a construir, una demo con salida real, qué vas a aprender, los requisitos con el tiempo por tramo y los créditos de las fuentes.

## Publicar para ti

`start_course` (o `byox start`, o el botón **Empezar el curso** de la web) crea tu repositorio del curso: issues, tramos, grafo de dependencias, etiquetas, pistas y workflows. Con `reset: true` borra el progreso y arranca de cero.

## Compartir

`export_course` (o `byox export <curso>`, o el botón **Compartir** de la portada) produce un código `byox1-…` con el repositorio fuente completo comprimido, **incluida la solución**. Los cursos grandes conviene pasarlos como archivo: `byox export <curso> -o curso.byox` guarda el mismo código en un `.byox`.

Quien lo recibe lo importa pegándolo en **Creados → Importar**, con `byox import` o con `import_course`. Antes de confirmar ve una vista previa de lo que trae. Al importar se crea el repositorio fuente y se verifica en su Docker.

<div class="callout warn" data-t="Importa solo de gente de confianza">

Los tests de un curso importado corren en tu Docker. Un código `byox1-…` de un desconocido puede ejecutar lo que quiera en tu máquina.

</div>

## Actualizar un curso

Cuando cambias un curso ya publicado, vuelve a verificarlo. Quienes ya lo empezaron traen los cambios con `upgrade_course` (o el botón **Actualizar** cuando hay etapas nuevas), sin perder el progreso: se suman las etapas y tramos nuevos, se corrigen los textos y se actualizan los archivos que genera byox y los archivos del curso que el alumno no tocó. El código del alumno no se modifica nunca.

## Diseño pedagógico

- Una etapa es una sesión de trabajo: entre 20 minutos y 2 horas.
- El grafo no tiene por qué ser una línea. Si dos cosas son independientes, que se puedan hacer en cualquier orden.
- Cada tramo termina con algo que funciona y se puede mostrar.
- Cierra el curso con etapas de bonus que no bloqueen a nadie.
- Las pistas guían, no resuelven: la última puede ser casi la solución, pero nunca el código entero.
