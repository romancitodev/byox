use rustminario::scan::{exclusive_scan, inclusive_scan};

#[test]
fn inclusivo_de_la_teoria() {
  let mut a = [3, 1, 7, 4];
  inclusive_scan(&mut a);
  assert_eq!(a, [3, 4, 11, 15]);
}

#[test]
fn exclusivo_de_la_teoria() {
  let mut a = [3, 8, 5, 2, 7, 4, 9, 6];
  exclusive_scan(&mut a);
  assert_eq!(a, [0, 3, 11, 16, 18, 25, 29, 38]);
}

#[test]
fn bordes() {
  let mut vacio: [i64; 0] = [];
  inclusive_scan(&mut vacio);
  exclusive_scan(&mut vacio);
  let mut uno = [5];
  exclusive_scan(&mut uno);
  assert_eq!(uno, [0]);
}
