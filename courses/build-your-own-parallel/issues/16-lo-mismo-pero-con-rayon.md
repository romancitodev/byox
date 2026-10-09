## Objetivo

Ahora que sabés qué hay debajo, mirá cuánto te ahorra una biblioteca. Rayon no reparte pedazos fijos: usa work stealing, así que un hilo que termina antes le roba trabajo a otro.

## Contrato

En `src/rayon_bonus.rs`:

```rust
// #16: lo mismo, pero con rayon.
// Agregá `rayon = "1"` en [dependencies] del Cargo.toml de la raíz.

pub fn rayon_reduce(a: &[i64]) -> i64 {
  todo!()
}

pub fn rayon_merge_sort(a: &mut [i64]) {
  todo!()
}
```

## Reglas

- Es el único issue con un crate externo: agregá `rayon = "1"` en `[dependencies]` del `Cargo.toml` de la raíz.
- Para el merge sort, usá tu `merge` del #12.

## Para descubrir

- El `reduce` de rayon te pide el neutro como una closure, no como un valor. ¿Por qué una closure? Pensá en cuántas copias del neutro necesitabas en el #4.
- `rayon::join(a, b)` corre dos cosas en paralelo. ¿Cómo queda un merge sort recursivo con eso? ¿Hasta qué tamaño conviene seguir partiendo?
- Medí contra tu `parallel_merge_sort` y contra `par_sort_unstable`. ¿Quién gana, y por cuánto?

## Hecho cuando

- [ ] `sh .course/run.sh 16` pasa.

## Para ir más allá (no bloquea)

- Tabla final: tu versión contra rayon contra la std, para reducción y merge sort.

## Para leer

- [rayon](https://docs.rs/rayon/latest/rayon/)
- [`rayon::join`](https://docs.rs/rayon/latest/rayon/fn.join.html)
- [`ParallelIterator::reduce`](https://docs.rs/rayon/latest/rayon/iter/trait.ParallelIterator.html#method.reduce)
