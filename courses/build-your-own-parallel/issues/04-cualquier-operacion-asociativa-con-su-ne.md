## Objetivo

Generalizá la reducción como en el ejercicio 2: cualquier operación asociativa con su elemento neutro. El compilador te va a pedir que demuestres qué cosas se pueden mandar y compartir entre hilos.

## Contrato

En `src/reduce.rs`:

```rust
pub fn reduce_with<T, F>(a: &[T], p: usize, neutro: T, op: F) -> T
where
  F: Fn(T, T) -> T, // le falta algo para poder usarse desde varios hilos
  // ¿y T? Completalo vos.
{
  todo!()
}
```

## Reglas

- Los parciales se combinan en el orden de los pedazos.

## Para descubrir

- Cada hilo arranca su acumulador desde el neutro. ¿Cuántas copias del neutro necesitás y qué trait te deja hacerlas?
- Todos los hilos usan la misma `op` al mismo tiempo. Ya es `Fn`, pero ¿qué más tiene que cumplir para que eso sea seguro?
- El test de strings no es conmutativo, como la concatenación del 2e. ¿Tu implementación respeta el orden?

## Hecho cuando

- [ ] `sh .course/run.sh 4` pasa.

## Para ir más allá (no bloquea)

- Dejá un comentario con cada bound y por qué hace falta.

**En la guía:** Ejercicio 2

## Para leer

- [`Send` y `Sync` en el Rustonomicon](https://doc.rust-lang.org/nomicon/send-and-sync.html)
- [`std::marker::Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html)
