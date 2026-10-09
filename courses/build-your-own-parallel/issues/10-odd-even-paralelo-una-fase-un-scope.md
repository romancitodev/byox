## Objetivo

Que cada fase la hagan `p` hilos. En Python usaste `mp.Array(lock=False)` y confiaste en que nadie se pisaba. Acá el compilador lo tiene que poder demostrar.

## Contrato

En `src/oddeven.rs`:

```rust
pub fn parallel_brick_sort(a: &mut [i64], p: usize) -> Stats {
  todo!()
}
```

## Reglas

- Sin `unsafe`, sin atómicos y sin locks.

## Para descubrir

- Los pares de una fase son `a[start..]` cortado de a 2. ¿Qué método te da pedazos `&mut` de exactamente 2 y descarta el que sobra?
- Tenés muchos pares y `p` hilos. ¿Cómo le das varios pares a cada hilo sin perder la garantía de que no se superponen?
- En el 6d escribiste que hacía falta una barrera entre fases. ¿Dónde está en esta versión?

## Hecho cuando

- [ ] `sh .course/run.sh 10` pasa.

## Para ir más allá (no bloquea)

- Podés señalar en tu código el lugar exacto donde está la barrera.

**En la guía:** Ejercicio 6d

## Para leer

- [`slice::chunks_exact_mut`](https://doc.rust-lang.org/std/primitive.slice.html#method.chunks_exact_mut)
