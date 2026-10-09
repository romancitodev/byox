## Objetivo

La versión del #10 crea hilos nuevos en cada fase. Tu Python creaba P procesos una sola vez y los sincronizaba con una barrera. Hacé eso: `p` hilos que viven todo el algoritmo y se esperan con `std::sync::Barrier`. Es el issue más difícil del curso.

## Contrato

En `src/oddeven.rs`:

```rust
pub fn barrier_brick_sort(a: &mut [i64], p: usize) -> Stats {
  todo!()
}
```

## Reglas

- Sin `unsafe` y sin `Mutex`.
- Cada hilo toca los pares k, k + p, k + 2p… de cada fase, como en tu Python.

## Para descubrir

- Con hilos que viven todo el algoritmo, el hilo k toca el par (0,1) en una fase y el (1,2) en la siguiente. ¿Podés darle un `&mut` fijo al arrancar? ¿Qué te dice eso de lo que hacía `mp.Array(lock=False)` por debajo?
- Si no podés tener `&mut` compartido, ¿qué tipos te dejan escribir a través de una referencia compartida sin usar locks?
- `Barrier::wait()` te devuelve algo parecido al `wait() == 0` de Python. ¿Para qué te sirve acá?
- Si ya hay una barrera entre fases, ¿qué `Ordering` necesitan tus atómicos?

## Hecho cuando

- [ ] `sh .course/run.sh 11` pasa.
- [ ] Pasa varias veces seguidas: los bugs de concurrencia no aparecen siempre.

## Para ir más allá (no bloquea)

- Medí contra el #10 con n = 20.000. ¿Cuál gana y por qué?

**En la guía:** Ejercicio 6 (versión con mp.Barrier)

## Para leer

- [`std::sync::Barrier`](https://doc.rust-lang.org/std/sync/struct.Barrier.html)
- [`AtomicI64`](https://doc.rust-lang.org/std/sync/atomic/type.AtomicI64.html)
- [Mara Bos, *Rust Atomics and Locks*, cap. 3](https://marabos.nl/atomics/memory-ordering.html)
