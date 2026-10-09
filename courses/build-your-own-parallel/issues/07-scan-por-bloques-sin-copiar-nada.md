## Objetivo

Las tres fases del ejercicio 5, pero todo en el lugar: cada hilo hace el scan de su pedazo, el principal calcula los offsets y cada hilo le suma el suyo. Ni una copia, ni una Queue.

## Contrato

En `src/scan.rs`:

```rust
pub fn parallel_scan(a: &mut [i64], p: usize) {
  todo!()
}
```

## Reglas

- Sin alocar el arreglo de nuevo (un `Vec` chiquito para los P totales sí).

## Para descubrir

- En el #2 usaste `chunks`. ¿Cuál es su hermano que te da pedazos `&mut`? ¿Por qué el compilador te deja mandar cada uno a un hilo distinto?
- En la fase 1, ¿cómo devuelve cada hilo su total si el scan ya lo escribió sobre su pedazo?
- Entre la fase 1 y la 3 tiene que haber una barrera. ¿Dónde está en tu código, si no escribiste ninguna?

## Hecho cuando

- [ ] `sh .course/run.sh 7` pasa.

## Para ir más allá (no bloquea)

- Medí contra `inclusive_scan` con n = 50 millones.

**En la guía:** Ejercicio 5

## Para leer

- [`slice::chunks_mut`](https://doc.rust-lang.org/std/primitive.slice.html#method.chunks_mut)
- [Prefix sum: algoritmos paralelos](https://en.wikipedia.org/wiki/Prefix_sum#Parallel_algorithms)
