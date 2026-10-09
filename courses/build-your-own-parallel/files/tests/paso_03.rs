use rustminario::reduce::parallel_reduce;
use rustminario::util::XorShift;

#[test]
fn coincide_con_sum() {
  let a: Vec<i64> = (1..=1000).collect();
  for p in [1, 2, 3, 4, 7, 8, 2000] {
    assert_eq!(parallel_reduce(&a, p), a.iter().sum::<i64>());
  }
}

#[test]
fn vacio_da_el_neutro() {
  assert_eq!(parallel_reduce(&[], 4), 0);
}

#[test]
fn grande_y_aleatorio() {
  let a = XorShift::new(1).vec_i64(1_000_000, 1000);
  assert_eq!(parallel_reduce(&a, 8), a.iter().sum::<i64>());
}
