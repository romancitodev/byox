# 🧵 build-your-own-parallel

Los algoritmos de la Clase 9 (reducción, scan, odd-even y merge sort), reescritos
en Rust con hilos de verdad. Sin GIL, sin pickle y con un compilador que te frena
las carreras antes de que corran.

```console
$ cargo run --release --example reduccion
hilos disponibles: 12

           n   iter().sum                p = 1                p = 2                p = 4                p = 8
        1000       0.1 µs     117.7 µs (0.00x)     190.7 µs (0.00x)     322.8 µs (0.00x)     592.5 µs (0.00x)
     1000000     123.7 µs     286.3 µs (0.43x)     254.9 µs (0.49x)     321.7 µs (0.38x)     568.9 µs (0.22x)
    50000000     26.96 ms     30.13 ms (0.89x)     16.15 ms (1.67x)     13.06 ms (2.06x)     14.07 ms (1.92x)
```

<sub>Corrida real de la solución de referencia en una máquina de 12 hilos (sin la columna p = 12). ¿Por qué no pasa de 2x? Eso es el #5.</sub>

## Qué vas a aprender

- Partir datos sin copiarlos y prestarlos a hilos con `thread::scope`.
- Qué significan `Send` y `Sync`, y por qué el compilador te los pide.
- Por qué el bug del 3d (leer y escribir el mismo arreglo en un paso) ni siquiera compila.
- Barreras implícitas (el fin de un scope) y explícitas (`Barrier`), y atómicos con `Relaxed`.
- Merge sort paralelo con un solo buffer y el corte con búsqueda binaria que destraba la última ronda.
- Cuánto te ahorra rayon cuando ya sabés qué hay debajo.

## Antes de arrancar

- Rust 1.99 o más nuevo, y haber hecho (o leído) la entrega en Python de la Clase 9.
- **Preparación** y **Reducción**: una tarde.
- **Scan** y **Odd-Even**: un par de tardes cada uno. El #11 es el más difícil del curso.
- **Merge sort**: un fin de semana.

## Créditos

- W. Daniel Hillis y Guy L. Steele Jr., [*Data parallel algorithms*](https://doi.org/10.1145/7902.7903), CACM, 1986.
- George Marsaglia, [*Xorshift RNGs*](https://www.jstatsoft.org/article/view/v008i14), Journal of Statistical Software, 2003.
- Mara Bos, [*Rust Atomics and Locks*](https://marabos.nl/atomics/), O'Reilly, 2023.
