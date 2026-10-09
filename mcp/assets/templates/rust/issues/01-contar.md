## Objetivo

Contar las palabras de un texto, como hace `wc -w`. Es la base de todo lo que sigue.

## Contrato

En `src/lib.rs`:

```rust
pub fn count_words(text: &str) -> usize
```

## Para descubrir

- ¿Qué pasa con dos espacios seguidos? ¿Y con un texto vacío?
- ¿Un tab o un salto de línea separan palabras?

## Hecho cuando

- [ ] `cargo test --test paso_01` pasa.

## Para leer

- [`str::split_whitespace`](https://doc.rust-lang.org/std/primitive.str.html#method.split_whitespace)
