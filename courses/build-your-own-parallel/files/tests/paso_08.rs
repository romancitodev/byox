use rustminario::scan::{hillis_steele, inclusive_scan};
use rustminario::util::XorShift;

#[test]
fn ejemplo_de_la_teoria() {
  let mut a = [3, 1, 7, 4, 2, 8, 5, 6];
  let sumas = hillis_steele(&mut a, 4);
  assert_eq!(a, [3, 4, 11, 15, 17, 25, 30, 36]);
  assert_eq!(sumas, 17);
}

#[test]
fn sumas_para_1024() {
  let mut a = vec![1; 1024];
  assert_eq!(hillis_steele(&mut a, 8), 9217);
}

#[test]
fn coincide_con_secuencial() {
  let mut r = XorShift::new(9);
  for n in [0, 1, 5, 64, 1000] {
    for p in [1, 3, 8] {
      let mut a = r.vec_i64(n, 100);
      let mut b = a.clone();
      hillis_steele(&mut a, p);
      inclusive_scan(&mut b);
      assert_eq!(a, b, "n={n} p={p}");
    }
  }
}
