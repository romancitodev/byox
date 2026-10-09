## Objetivo

En la teoría cada posición es un hilo. Acá vas a usar `p` hilos por paso, cada uno con un rango de posiciones. Lo interesante no es el resultado sino lo que te dice el compilador en el camino.

## Contrato

En `src/scan.rs`:

```rust
/// Scan inclusivo con Hillis-Steele, con `p` hilos por paso.
/// Devuelve cuántas sumas hizo, contadas como en el 3c.
pub fn hillis_steele(a: &mut [i64], p: usize) -> usize {
  todo!()
}
```

## Reglas

- Cada paso tiene que leer el estado anterior, como dice la teoría.

## Para descubrir

- Intentalo primero sin copia: que cada hilo haga `a[i] += a[i - stride]` sobre su rango. ¿Qué error te da? Es el mismo problema del 3d, solo que acá ni siquiera compila.
- La teoría dice "sobre una copia del estado anterior". ¿Hace falta copiar el arreglo entero en cada paso, o alcanza con tener dos e ir alternándolos?
- Contá las sumas: con n = 8 tiene que darte 17, como en el 3c.

## Hecho cuando

- [ ] `sh .course/run.sh 8` pasa.

## Para ir más allá (no bloquea)

- Guardá el error del compilador del primer intento y relacionalo con el 3d.
- Medí contra el scan por bloques del #7. ¿Cuál gana con 8 hilos y por qué?

**En la guía:** Ejercicio 3

## Para leer

- [Hillis y Steele, *Data parallel algorithms* (1986)](https://doi.org/10.1145/7902.7903)
- [`std::mem::swap`](https://doc.rust-lang.org/std/mem/fn.swap.html)
