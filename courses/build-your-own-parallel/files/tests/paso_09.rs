use rustminario::oddeven::{Stats, brick_sort, inversions};

#[test]
fn ejercicio_6() {
  let mut a = [7, 2, 8, 4, 1, 6, 3, 5];
  assert_eq!(inversions(&a), 16);
  let s = brick_sort(&mut a);
  assert_eq!(a, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert_eq!(s, Stats { sorted_at_phase: 6, phases_run: 8, swaps: 16 });
}

#[test]
fn peor_caso() {
  let mut a = [8, 7, 6, 5, 4, 3, 2, 1];
  let s = brick_sort(&mut a);
  assert_eq!(s, Stats { sorted_at_phase: 8, phases_run: 10, swaps: 28 });
}

#[test]
fn ya_ordenado_y_vacio() {
  let esperado = Stats { sorted_at_phase: 0, phases_run: 2, swaps: 0 };
  assert_eq!(brick_sort(&mut [1, 2, 3]), esperado);
  assert_eq!(brick_sort(&mut []), esperado);
}
