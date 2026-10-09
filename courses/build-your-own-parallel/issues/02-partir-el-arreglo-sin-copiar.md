## Objetivo

Tu `split` de Python armaba listas nuevas. En Rust podés partir un slice en pedazos que apuntan a la misma memoria, sin copiar ni un elemento. Este paso es solo eso: partir bien, con la misma cuenta que usabas en Python.

## Contrato

En `src/reduce.rs`:

```rust
/// Tamaño de cada pedazo para que salgan como mucho `p` pedazos.
pub fn slice_size(n: usize, p: usize) -> usize {
  todo!()
}

pub fn slice(a: &[i64], p: usize) -> Vec<&[i64]> {
  todo!()
}
```

## Reglas

- `p == 0` tiene que entrar en pánico: es un error de quien llama.
- Sin `to_vec` ni `clone`.

## Para descubrir

- En Python era `cs = (n + P - 1) // P`. ¿Qué pasa en Rust si `n` es 0 y le pasás ese tamaño al método que parte el slice?
- La firma de `slice` no tiene lifetimes escritos y compila igual. ¿De quién son prestados los `&[i64]` que devolvés?

## Hecho cuando

- [ ] `sh .course/run.sh 2` pasa.

## Para ir más allá (no bloquea)

- Podés explicar con tus palabras por qué `slice` no copia nada.

**En la guía:** Ejercicio 5 (split)

## Para leer

- [`slice::chunks`](https://doc.rust-lang.org/std/primitive.slice.html#method.chunks)
- [Elisión de lifetimes](https://doc.rust-lang.org/reference/lifetime-elision.html)
