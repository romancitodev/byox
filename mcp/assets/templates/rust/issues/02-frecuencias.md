## Objetivo

Saber cuántas veces aparece cada palabra. Es el primer paso de cualquier índice o buscador.

## Contrato

En `src/lib.rs`:

```rust
pub fn word_frequencies(text: &str) -> HashMap<String, usize>
```

## Reglas

- `Hola` y `hola` son la misma palabra.

## Hecho cuando

- [ ] `cargo test --test paso_02` pasa.

## Para leer

- [`HashMap::entry`](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.entry)
- [`str::to_lowercase`](https://doc.rust-lang.org/std/primitive.str.html#method.to_lowercase)
