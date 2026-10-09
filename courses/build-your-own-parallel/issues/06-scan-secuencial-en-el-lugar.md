## Objetivo

El scan de un core, pero modificando el arreglo en el lugar en vez de devolver uno nuevo. Es la base para los dos pasos que siguen.

## Contrato

En `src/scan.rs`:

```rust
pub fn inclusive_scan(a: &mut [i64]) {
  todo!()
}

pub fn exclusive_scan(a: &mut [i64]) {
  todo!()
}
```

## Reglas

- Sin alocar memoria nueva.

## Para descubrir

- En el inclusivo, `a[i] += a[i - 1]` lee y escribe el mismo slice en la misma línea. ¿Por qué el borrow checker lo acepta?
- El exclusivo en el lugar es traicionero: si pisás `a[i]` perdés el valor que necesitás para el siguiente. ¿Qué tenés que guardar antes?

## Hecho cuando

- [ ] `sh .course/run.sh 6` pasa.

**En la guía:** Ejercicios 3 y 4

## Para leer

- [`std::mem::replace`](https://doc.rust-lang.org/std/mem/fn.replace.html)
- [Prefix sum](https://en.wikipedia.org/wiki/Prefix_sum)
