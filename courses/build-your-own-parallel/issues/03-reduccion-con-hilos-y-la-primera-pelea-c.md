## Objetivo

Cada hilo suma su pedazo y el hilo principal suma los parciales, igual que tu `parallel_reduce` de Python. La diferencia es que acá los hilos leen el arreglo original, sin que nadie les mande una copia.

## Contrato

En `src/reduce.rs`:

```rust
pub fn parallel_reduce(a: &[i64], p: usize) -> i64 {
  todo!()
}
```

## Reglas

- Solo `std`.
- Sin `Arc` y sin `clone` del arreglo.
- Sin canales: buscá otra forma de recibir los resultados.

## Para descubrir

- Probá primero con `std::thread::spawn` pasándole un pedazo. Leé el error entero: ¿qué te dice sobre `'static` y sobre cuánto puede vivir un hilo?
- En Python necesitabas `(idx, resultado)` en la Queue porque llegaban desordenados. ¿Qué te devuelve `join()` acá? ¿Hace falta el idx?
- ¿Qué pasaría si la función devolviera antes de que algún hilo terminara de leer su pedazo?

## Hecho cuando

- [ ] `sh .course/run.sh 3` pasa.

## Para ir más allá (no bloquea)

- Podés explicar por qué con `scope` no hace falta `'static`.

**En la guía:** Ejercicio 1

## Para leer

- [`std::thread::scope`](https://doc.rust-lang.org/std/thread/fn.scope.html)
- [`std::thread::spawn` y su `'static`](https://doc.rust-lang.org/std/thread/fn.spawn.html)
