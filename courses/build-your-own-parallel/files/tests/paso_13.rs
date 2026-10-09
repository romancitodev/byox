use rustminario::merge::parallel_merge_sort;
use rustminario::util::XorShift;

#[test]
fn ejemplo_de_clase() {
  let mut a = [5, 2, 8, 1, 9, 3, 7, 4];
  let rondas = parallel_merge_sort(&mut a, 4);
  assert_eq!(a, [1, 2, 3, 4, 5, 7, 8, 9]);
  assert_eq!(rondas, vec![2, 1]);
}

#[test]
fn rondas_segun_p() {
  let base = XorShift::new(2).vec_i64(1000, 10_000);
  let mut ordenado = base.clone();
  ordenado.sort();
  for (p, esperado) in [(1, vec![]), (2, vec![1]), (3, vec![1, 1]), (8, vec![4, 2, 1])] {
    let mut a = base.clone();
    assert_eq!(parallel_merge_sort(&mut a, p), esperado, "p={p}");
    assert_eq!(a, ordenado);
  }
}

#[test]
fn bordes() {
  let mut vacio: Vec<i64> = vec![];
  parallel_merge_sort(&mut vacio, 4);
  let mut uno = vec![42];
  parallel_merge_sort(&mut uno, 4);
  assert_eq!(uno, vec![42]);
}
