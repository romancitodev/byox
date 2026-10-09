## Objetivo

En Python el paralelo perdía siempre. Medí tu `parallel_reduce` contra `iter().sum()` y armá la misma tabla que en la entrega. El test corre el ejemplo y chequea la forma de la tabla, no los tiempos (dependen de la máquina): las conclusiones son tuyas.

## Contrato

En `examples/reduccion.rs`:

```rust
// examples/reduccion.rs  ->  cargo run --release --example reduccion
//
// Una fila por n (1_000, 1_000_000 y 50_000_000) que empiece con el n
// alineado a la derecha, seguido del tiempo de iter().sum() y, para cada
// p (1, 2, 4, 8 y available_parallelism()), el tiempo y el speedup entre
// paréntesis:
//
//            n   iter().sum      p = 1    ...
//         1000       0.1 µs     117.7 µs (0.00x)   ...
```

## Reglas

- Siempre con `--release`. En debug los números no significan nada.

## Para descubrir

- Con n = 1.000, ¿conviene paralelizar? ¿Desde qué n empieza a ganar?
- Con n grande, ¿el speedup llega a P? Si no, pensá qué recurso comparten todos los cores cuando recorren un arreglo enorme.
- Compará con tu tabla del 5e. ¿Qué dos costos de Python ya no están?

## Hecho cuando

- [ ] El ejemplo imprime una fila por cada n con el speedup de cada p, como `(1.67x)`.

## Para ir más allá (no bloquea)

- Explicá por qué el speedup no llega a P.
- Compará con tu tabla del 5e y nombrá los costos de Python que desaparecieron.

**En la guía:** Ejercicio 5e

## Para leer

- [`std::thread::available_parallelism`](https://doc.rust-lang.org/std/thread/fn.available_parallelism.html)
- [Ejemplos en Cargo](https://doc.rust-lang.org/cargo/reference/cargo-targets.html#examples)
