## Objetivo

Fase 1: cada hilo ordena su pedazo. Fase 2: árbol de merges, un hilo por par en cada ronda, y el pedazo que sobra pasa directo. Igual que tu Python, pero sin Queue ni pickle: todo en memoria compartida.

## Contrato

En `src/merge.rs`:

```rust
/// Ordena `a` con `p` hilos. Devuelve cuántos merges hubo en cada ronda,
/// como el `[2, 1]` de tu Python con P = 4.
pub fn parallel_merge_sort(a: &mut [i64], p: usize) -> Vec<usize> {
  todo!()
}
```

## Reglas

- En la fase 1 podés usar `sort_unstable` en cada pedazo, como el `sorted()` de tu Python.
- Un solo buffer auxiliar en total, no uno por merge.

## Para descubrir

- Un merge no puede escribir sobre su propia entrada. ¿Cuántos buffers necesitás en total?
- En cada ronda, cada hilo escribe en un rango distinto del destino, y los rangos no miden todos lo mismo. ¿Cómo conseguís varios `&mut` que no se superpongan?
- ¿Qué hacés con el pedazo que sobra cuando la cantidad es impar?
- Cuando termina, ¿en cuál de los dos buffers quedó el resultado?

## Hecho cuando

- [ ] `sh .course/run.sh 13` pasa.

## Para ir más allá (no bloquea)

- Medí contra `sort_unstable` con n = 10 millones y p = 1, 2, 4, 8. Compará con tu tabla del 8d.

**En la guía:** Ejercicio 8

## Para leer

- [`slice::split_at_mut`](https://doc.rust-lang.org/std/primitive.slice.html#method.split_at_mut)
- [`slice::sort_unstable`](https://doc.rust-lang.org/std/primitive.slice.html#method.sort_unstable)
