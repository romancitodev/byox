# Cómo escribir un curso de byox

Un curso es un "build your own X": un proyecto real que se construye paso a paso.
Cada paso es un **issue** con un **test** que lo verifica. Los issues forman un
**grafo**: un issue queda bloqueado hasta que se cierran sus dependencias. El
alumno pushea a su repo y Forgejo Actions corre los tests de los issues abiertos,
cierra los que pasan y desbloquea los siguientes.

Vos sos el autor. El alumno es una persona que quiere aprender haciendo: no le
des la solución, dale el contrato y las preguntas que lo llevan a descubrirla.

## Archivos del repo fuente

El curso vive en `cursos/<slug>` (privado). El slug es el nombre del repo del alumno.

```
README.md          # la portada del curso (ver "El README")
course.yaml        # metadata, milestones e issues
issues/NN-*.md     # el cuerpo de cada issue (markdown)
files/**           # se copia tal cual a la raíz del repo del alumno
solution/**        # implementación de referencia; se aplica encima de files/ al verificar
```

## Nada inventado

Un curso con una API que no existe o un test que no compila es peor que no
tener curso. Por eso:

- **Fuentes reales.** Antes de escribir un contrato, un test o una pista,
  verificalo contra la doc oficial, la spec o el código de una implementación
  real (por ejemplo, el RESP de Redis contra redis.io/docs/reference/protocol-spec,
  no de memoria). Usá la versión que trae `image`.
- **Solución de referencia.** `solution/` tiene los archivos que, puestos encima
  de `files/`, resuelven el curso entero. No la ve el alumno. Escribila de verdad
  y completa: es la prueba de que el curso se puede hacer.
- **verify_course** corre `.course/run.sh` en `image` dos veces: con `files/`
  todos los tests tienen que **fallar** y con `files/` + `solution/` todos tienen
  que **pasar**. Deja el resultado como commit status, y `start_course` no publica
  un commit que no esté verificado.
- **Números medidos.** Si un issue menciona una salida, un tiempo o un conteo,
  sacalo de una corrida real.
- **Citá.** Cada issue cierra con "Para leer": los links que usaste.

### course.yaml

```yaml
title: build-your-own-redis
description: Un Redis de juguete en Go, del socket a la persistencia.
image: golang:1.25          # imagen donde corren los tests. Necesita `sh` y `git`.
setup: go mod download      # opcional: corre una vez antes de los tests
topics: [go, redes, protocolos]
origin: ai                  # "ai" si lo escribe un asistente, "human" si lo arma una persona a mano
author: ana                # opcional: quién lo escribió

milestones:                 # en el orden en que se muestran
  - id: base
    title: El servidor
    description: Aceptar conexiones y hablar RESP.

issues:                     # ids 1..N, consecutivos y en orden
  - id: 1
    milestone: base
    title: Un servidor TCP que responde PONG
    labels: [fácil, redes]
    deps: []                # ids de los issues que tienen que estar cerrados antes
    body: issues/01-pong.md
    test: go test ./pasos/p01/...
    hints:                  # de la más conceptual a la más concreta
      - "¿Qué paquete de la std escucha en un puerto TCP?"
      - "`net.Listen` y un loop con `Accept`."
      - "Cada conexión en su propia goroutine; respondé `+PONG\\r\\n`."
```

Reglas que valida `validate_course`:

- `id` va de 1 a N, sin huecos y en orden. Es el número del issue en Forgejo.
- Cada `deps` apunta a ids existentes y el grafo no tiene ciclos.
- Todo issue tiene `test`. **Si algo no se puede testear, reformulalo hasta que
  se pueda.** Por ejemplo, "medí el speedup y explicá por qué no llega a P" pasa
  a ser "escribí `speedup(n, p)`, que devuelva el speedup medido, y un test que
  chequee que con n chico es < 1".
- Los labels `bloqueado` y `disponible` están reservados: los maneja el bot.
- `files/` no puede traer `.course/` ni `.forgejo/`.

### El comando `test`

- Es un script de `sh` que corre en la raíz del repo del alumno, dentro de `image`.
  Puede tener varias líneas. Si sale con 0, el issue pasa.
- El alumno lo corre local con `sh .course/run.sh <id>`.
- **Tiene que andar aunque los pasos posteriores no estén hechos.** Ojo con los
  lenguajes que compilan todo el paquete: un test del paso 5 que llama a una
  función que todavía no existe rompe el build del paso 1. Algunas soluciones:
  - Rust: un test de integración por paso (`tests/paso_01.rs`) y
    `cargo test --test paso_01`. Cada archivo de `tests/` es un crate aparte.
  - Go: un paquete de tests por paso (`pasos/p01/`) que importa el del alumno.
  - Python/JS: un archivo de test por paso (`pytest tests/test_01.py`).
  - Si no hay otra, guardá los tests en `files/.tests/` y que el comando los
    copie al lugar correcto antes de correrlos.
- Los tests son visibles. Están en el repo del alumno y está bien que los lea.
- Un test sólo puede depender del código de su issue y de sus dependencias
  (transitivas). Si necesita algo de otro issue, agregalo a `deps`.

### El cuerpo de cada issue

El bot le agrega al final cómo verificarlo, las dependencias y cuántas pistas
hay, así que no lo repitas. Estructura recomendada:

```markdown
## Objetivo
Qué vas a construir y por qué importa. Conectalo con lo que ya sabe.

## Contrato
La firma o la interfaz exacta que el test espera, con `todo!()` o equivalente.

## Reglas
- Restricciones que fuerzan el aprendizaje (sin crates, sin copiar, etc.).

## Para descubrir
- Preguntas que lo llevan a la idea clave sin decírsela.

## Hecho cuando
- [ ] El test pasa.
- [ ] Algo verificable que agregue valor (lo chequea el test, no una persona).

## Para leer
- [Doc oficial de lo que se usa](https://...)
- [La spec o la implementación real en la que se basa](https://...)
```

### El README

Es la portada: lo primero que ve el alumno al abrir su repo, y lo que lo
engancha o lo espanta. Tiene que ser lindo. byox lo usa como intro del README
del alumno y le agrega abajo el **mapa del grafo** (Mermaid), la lista de issues
por milestone y cómo se usa, así que eso no lo escribas.

````markdown
# 🧮 build-your-own-calc

Una calculadora de expresiones en Python, del texto crudo al resultado.

```console
$ python -c 'from calc import evaluar; print(evaluar("12 + 3*(4-1)"))'
21
```

## Qué vas a aprender

- Cómo un tokenizer convierte texto en piezas con significado.
- Por qué un parser descendente recursivo resuelve la precedencia "solo".
- A reportar errores con posición, como un compilador.

## Antes de arrancar

- Python 3.13 y saber escribir funciones y loops.
- ~1 h para *Tokens*, ~2 h para *Evaluar*.

## Créditos

Basado en [Crafting Interpreters](https://craftinginterpreters.com/), cap. 4 y 6.
````

- **La demo es real**: salida copiada de correr `solution/`, no inventada.
- Escaneable: títulos cortos, listas, un bloque de código. Nada de muros de texto.
- Sin palabras de marketing ("potente", "increíble", "domina").
- Nada de `files/README.md`: se pisaría.

### Pistas

Van en `hints`, no en el cuerpo. El alumno comenta `/pista` y el bot le da la
siguiente. Escribilas de más conceptual a más concreta: la última puede ser casi
la solución, pero nunca el código entero. Las pistas no se copian al repo del
alumno (viajan como secreto de Actions).

### files/

El esqueleto del proyecto: `Cargo.toml`, `go.mod`, `package.json`, los stubs con
los contratos y los tests de todos los pasos. Arrancá con lo mínimo para que
`setup` y el test del issue 1 corran (y fallen).

## Flujo de trabajo

1. `get_format_guide` (esto).
2. Investigá: docs, specs e implementaciones reales de lo que se va a construir.
3. `write_course_files` de a varios archivos por vez. Podés reescribirlos cuantas
   veces quieras. Escribí `solution/` a la par de los tests.
4. `validate_course` hasta que no haya errores (rápido, no corre nada).
5. `verify_course` hasta que esté todo en verde. Si un test pasa con el
   esqueleto, el issue se cerraría solo en el primer push.
6. `start_course` crea el repo del alumno con issues, milestones, grafo, labels,
   secretos y workflows. Con `reset: true` borra el progreso y arranca de cero.
7. `course_status` muestra por dónde va.

## Escribirlo a mano

Un curso también se puede escribir sin asistente, con tu editor y git:

1. `byox new <slug> --lang python|rust|go|node` crea `cursos/<slug>` desde una
   plantilla que ya anda (dos issues, tests y solución) y la clona.
2. Editá los archivos y hacé `git push`. Cada push al repo fuente se verifica
   solo en tu Docker: con `files/` los tests fallan y con `solution/` pasan.
3. `byox check` muestra los errores de formato y, por issue, si el esqueleto
   falla y la solución pasa; si algo falla, la salida del test.
4. `byox start <slug>` crea tu repo del curso (sólo si el último commit está verificado).

Poné `origin: human` en course.yaml: la web lo muestra como hecho a mano.

## Compartir

`byox export <slug>` (o `export_course`, o la web) da un código `byox1-…` con
el repo fuente entero comprimido, solución incluida. Quien lo recibe lo pega en
`byox import`, en `import_course` o en la web: se crea el repo fuente y se
verifica en su Docker. Los cursos grandes conviene pasarlos como archivo
(`byox export <slug> -o curso.byox`): adentro está el mismo código.

## Diseño pedagógico

- Un issue es una sesión de trabajo: entre 20 minutos y 2 horas.
- El grafo no tiene que ser una línea. Si dos cosas son independientes, que se
  puedan hacer en cualquier orden.
- Cada milestone termina con algo que funciona y se puede mostrar.
- Cerrá el curso con issues de "bonus" que no bloqueen a nadie.
